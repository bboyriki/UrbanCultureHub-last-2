const CHUNK_SIZE = 20 * 1024 * 1024;         // 20 MB per chunk — Cloudinary direct upload
const SERVER_CHUNK_SIZE = 5 * 1024 * 1024;  // 5 MB per chunk — server-side pipeline
const COMPRESS_THRESHOLD = 80 * 1024 * 1024; // Files > 80 MB go through server FFmpeg pipeline

export const IMAGE_MAX_BYTES = 9 * 1024 * 1024; // 9 MB — stay safely under Cloudinary 10 MB free limit

/**
 * Compress an image File in-browser using Canvas.
 * Resizes to max 2000×2000 px and re-encodes as JPEG at the given quality.
 * Returns the same File unchanged if it is already small enough.
 */
export async function compressImageIfNeeded(
  file: File,
  maxBytes = IMAGE_MAX_BYTES,
  maxDim = 2000,
  quality = 0.82
): Promise<File> {
  if (file.size <= maxBytes) return file;

  return new Promise<File>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width  = Math.round(width  * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width  = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read image")); };
    img.src = url;
  });
}

// Full HD compression applied to every reel URL after upload.
// c_limit   = preserve aspect ratio, only downscale (never upscale)
// w_1920    = max width 1920 px (handles both portrait & landscape)
// h_1920    = max height 1920 px
// q_auto:good = automatic quality compression (good tier)
// vc_h264   = H.264 codec — universally supported
export const FULL_HD_TRANSFORM = "c_limit,h_1920,q_auto:good,vc_h264,w_1920";

/**
 * Apply Full HD transformation to a Cloudinary video URL.
 * Optionally chain additional transformations (e.g. filters, speed).
 */
export function applyFullHd(secureUrl: string, extraTransform?: string): string {
  const transform = extraTransform
    ? `${FULL_HD_TRANSFORM}/${extraTransform}`
    : FULL_HD_TRANSFORM;
  return secureUrl.replace("/upload/", `/upload/${transform}/`);
}

interface UploadParams {
  signature: string;
  timestamp: number;
  folder: string;
  apiKey: string;
  cloudName: string;
}

interface UploadOptions {
  extraFields?: Record<string, string>;
  onProgress?: (pct: number) => void;
}

export async function uploadVideoToCloudinary(
  file: File,
  params: UploadParams,
  options: UploadOptions = {}
): Promise<any> {
  const { signature, timestamp, folder, apiKey, cloudName } = params;
  const { extraFields = {}, onProgress } = options;
  const resourceType = file.type.startsWith("video") ? "video" : "image";

  if (file.size <= 100 * 1024 * 1024) {
    return uploadSingle(file, cloudName, { signature, timestamp, folder, apiKey }, extraFields, onProgress, resourceType);
  }
  return uploadChunked(file, cloudName, { signature, timestamp, folder, apiKey }, extraFields, onProgress, resourceType);
}

/** Upload any media file (image or video) to Cloudinary with the correct endpoint */
export async function uploadMediaToCloudinary(
  file: File,
  params: UploadParams,
  options: UploadOptions = {}
): Promise<any> {
  return uploadVideoToCloudinary(file, params, options);
}

async function uploadSingle(
  file: File,
  cloudName: string,
  params: { signature: string; timestamp: number; folder: string; apiKey: string },
  extraFields: Record<string, string>,
  onProgress?: (pct: number) => void,
  resourceType: "video" | "image" = "video"
): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("signature", params.signature);
  formData.append("timestamp", String(params.timestamp));
  formData.append("folder", params.folder);
  formData.append("api_key", params.apiKey);
  for (const [k, v] of Object.entries(extraFields)) {
    formData.append(k, v);
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 85));
      }
    };
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`);
    xhr.onload = () => {
      if (xhr.status === 200) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        let msg = "Upload failed";
        try { msg = JSON.parse(xhr.responseText)?.error?.message || msg; } catch {}
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload. Check your connection."));
    xhr.send(formData);
  });
}

/* ── Smart Media Upload ──────────────────────────────────────────────────────
   Unified upload function for Instagram posts/reels/stories.

   Decision tree:
   ┌──────────────────────────────────────┬──────────────────────────────────────┐
   │ Image (any size)                     │ Server multipart → Cloudinary        │
   │ Video ≤ 80 MB                        │ Direct browser → Cloudinary (fast)   │
   │ Video > 80 MB                        │ Chunked to server → FFmpeg → Cloudinary│
   └──────────────────────────────────────┴──────────────────────────────────────┘
 ──────────────────────────────────────────────────────────────────────────── */
export async function smartUploadMedia(
  file: File,
  options: { onProgress?: (pct: number, stage?: string) => void } = {}
): Promise<{ url: string; resourceType: string; originalMb: string; finalMb: string; compressed: boolean }> {
  const { onProgress } = options;

  const isVideo = file.type.startsWith("video/");
  const needsServerPipeline = isVideo && file.size > COMPRESS_THRESHOLD;

  /* ── Path A: video > 80 MB → server chunked pipeline ────────────────── */
  if (needsServerPipeline) {
    return serverSmartUpload(file, onProgress);
  }

  /* ── Path B: video ≤ 80 MB → direct Cloudinary upload ──────────────── */
  if (isVideo) {
    const sigRes = await fetch("/api/instagram/upload-signature", { credentials: "include" });
    if (!sigRes.ok) throw new Error("Kon upload-configuratie niet ophalen");
    const sigData = await sigRes.json();
    const result = await uploadVideoToCloudinary(file, sigData, {
      onProgress: onProgress ? (pct) => onProgress(pct, "uploading") : undefined,
    });
    return {
      url: result.secure_url,
      resourceType: "video",
      originalMb: (file.size / 1024 / 1024).toFixed(1),
      finalMb: (file.size / 1024 / 1024).toFixed(1),
      compressed: false,
    };
  }

  /* ── Path C: image → server upload (always fast, never > 10 MB) ──────── */
  const fd = new FormData();
  fd.append("file", file);
  const xhr = new XMLHttpRequest();
  const result = await new Promise<any>((resolve, reject) => {
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 90), "uploading");
    };
    xhr.open("POST", "/api/instagram/upload/media");
    xhr.withCredentials = true;
    xhr.onload = () => {
      if (xhr.status === 200) { resolve(JSON.parse(xhr.responseText)); }
      else { let m = "Upload mislukt"; try { m = JSON.parse(xhr.responseText)?.error || m; } catch {} reject(new Error(m)); }
    };
    xhr.onerror = () => reject(new Error("Network error tijdens upload"));
    xhr.send(fd);
  });
  return {
    url: result.url,
    resourceType: "image",
    originalMb: (file.size / 1024 / 1024).toFixed(1),
    finalMb: (file.size / 1024 / 1024).toFixed(1),
    compressed: false,
  };
}

/* ── Server Chunked Smart Upload (for videos > 80 MB) ────────────────────── */
async function serverSmartUpload(
  file: File,
  onProgress?: (pct: number, stage?: string) => void
): Promise<{ url: string; resourceType: string; originalMb: string; finalMb: string; compressed: boolean }> {
  const totalChunks = Math.ceil(file.size / SERVER_CHUNK_SIZE);

  /* Step 1: init session */
  onProgress?.(2, "preparing");
  const initRes = await fetch("/api/instagram/smart-upload/init", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mimeType: file.type, originalName: file.name, totalChunks }),
  });
  if (!initRes.ok) {
    const e = await initRes.json().catch(() => ({}));
    throw new Error(e.error || "Kon upload sessie niet starten");
  }
  const { sessionId } = await initRes.json();

  /* Step 2: send chunks (0% → 60% of total progress) */
  for (let i = 0; i < totalChunks; i++) {
    const start = i * SERVER_CHUNK_SIZE;
    const end   = Math.min(start + SERVER_CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    const fd = new FormData();
    fd.append("chunk", chunk, file.name);
    fd.append("sessionId", sessionId);
    fd.append("chunkIndex", String(i));

    const chunkRes = await fetch("/api/instagram/smart-upload/chunk", {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    if (!chunkRes.ok) {
      const e = await chunkRes.json().catch(() => ({}));
      throw new Error(e.error || `Fout bij uploaden deel ${i + 1}/${totalChunks}`);
    }
    onProgress?.(Math.round(2 + ((i + 1) / totalChunks) * 58), "uploading");
  }

  /* Step 3: finalize — server compresses + uploads to Cloudinary via SSE (60% → 100%) */
  onProgress?.(61, "compressing");

  const data = await new Promise<any>((resolve, reject) => {
    fetch("/api/instagram/smart-upload/finalize", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).then((res) => {
      if (!res.body) {
        return res.json().then((e: any) => reject(new Error(e.error || "Verwerking op de server mislukt")));
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const pump = ({ done, value }: ReadableStreamReadResult<Uint8Array>): Promise<void> => {
        if (done) {
          reject(new Error("Verbinding verbroken voor voltooiing"));
          return Promise.resolve();
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let event: any;
          try { event = JSON.parse(line.slice(6)); } catch { continue; }

          if (event.type === "progress") {
            // SSE pct (0–99) maps to overall 60–99%
            const overall = 60 + Math.round((event.pct / 100) * 39);
            const stage = event.stage === "cloudinary" ? "uploading" : "compressing";
            onProgress?.(overall, stage);
          } else if (event.type === "done") {
            onProgress?.(100, "done");
            resolve(event);
            return Promise.resolve();
          } else if (event.type === "error") {
            reject(new Error(event.message || "Verwerking op de server mislukt"));
            return Promise.resolve();
          }
        }
        return reader.read().then(pump);
      };

      reader.read().then(pump).catch(reject);
    }).catch(reject);
  });

  return {
    url: data.url,
    resourceType: data.resourceType,
    originalMb: data.originalMb,
    finalMb: data.finalMb,
    compressed: data.compressed,
  };
}

async function uploadChunked(
  file: File,
  cloudName: string,
  params: { signature: string; timestamp: number; folder: string; apiKey: string },
  extraFields: Record<string, string>,
  onProgress?: (pct: number) => void,
  resourceType: "video" | "image" = "video"
): Promise<any> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const uniqueUploadId = `uch_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

  let lastResult: any = null;

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    const chunkFormData = new FormData();
    chunkFormData.append("file", chunk, file.name);
    chunkFormData.append("signature", params.signature);
    chunkFormData.append("timestamp", String(params.timestamp));
    chunkFormData.append("folder", params.folder);
    chunkFormData.append("api_key", params.apiKey);
    if (i === 0) {
      for (const [k, v] of Object.entries(extraFields)) {
        chunkFormData.append(k, v);
      }
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-Unique-Upload-Id": uniqueUploadId,
        "Content-Range": `bytes ${start}-${end - 1}/${file.size}`,
      },
      body: chunkFormData,
    });

    const text = await response.text();

    if (response.status !== 200 && response.status !== 308) {
      let msg = "Chunk upload failed";
      try { msg = JSON.parse(text)?.error?.message || msg; } catch {}
      throw new Error(msg);
    }

    if (text) {
      try { lastResult = JSON.parse(text); } catch {}
    }

    if (onProgress) {
      onProgress(Math.round(((i + 1) / totalChunks) * 85));
    }
  }

  if (!lastResult) throw new Error("Upload completed but no result received");
  return lastResult;
}
