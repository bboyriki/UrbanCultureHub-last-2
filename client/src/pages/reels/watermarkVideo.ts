/**
 * Video sharing utilities for reels.
 *
 * All platforms — download the watermarked video blob, then hand it to
 * navigator.share({ files }) so the OS share sheet presents the actual
 * video file to Instagram / TikTok / any app.
 *
 * iOS WKWebView fallback — if file-sharing is not available, open the
 * download URL in a new browser layer and show an "Open App" CTA.
 */

/** Server-side watermark download URL */
export function getDownloadUrl(reelId: number): string {
  return `/api/reels/${reelId}/download`;
}

/**
 * Fetch the watermarked video as a Blob with progress tracking.
 * Safe on any platform — caller is responsible for size-gating.
 */
export async function fetchWatermarkedBlob(
  reelId: number,
  onProgress?: (loaded: number, total: number) => void,
  signal?: AbortSignal
): Promise<Blob> {
  const url = getDownloadUrl(reelId);
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Server returned ${res.status}`);

  const contentLength = res.headers.get("content-length");
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  if (total > 200_000_000) {
    throw new Error("Video file too large to share in-browser (>200 MB)");
  }

  const reader = res.body!.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress?.(loaded, total);
  }

  return new Blob(chunks, { type: "video/mp4" });
}

/** Device / capability detection — computed once at module load */
export const Device = (() => {
  const ua = navigator.userAgent;
  const isIOS      = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid  = /Android/i.test(ua);
  const isSafariBrowser = isIOS && /Safari\//i.test(ua) && !/CriOS|FxiOS/i.test(ua);
  const isWKWebView = isIOS && !isSafariBrowser;

  // Allow iOS Safari 15+ — it fully supports navigator.share({ files })
  // Only exclude WKWebView where the memory budget is much smaller
  const canShareFiles = !!navigator.canShare && (() => {
    try { return navigator.canShare({ files: [new File([], "t.mp4", { type: "video/mp4" })] }); }
    catch { return false; }
  })();

  const canShareUrl = typeof navigator.share === "function";

  return { isIOS, isAndroid, isMobile: isIOS || isAndroid, isWKWebView, canShareFiles, canShareUrl };
})();
