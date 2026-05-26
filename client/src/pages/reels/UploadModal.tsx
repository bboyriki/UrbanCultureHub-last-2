import { useState, useRef } from "react";
import { X, Upload, Film, Loader2, CheckCircle2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import AIReelCaption from "@/components/ai/AIReelCaption";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { uploadVideoToCloudinary, applyFullHd } from "@/lib/cloudinaryUpload";

const COMPRESS_THRESHOLD_MB = 80;
const COMPRESS_THRESHOLD = COMPRESS_THRESHOLD_MB * 1024 * 1024;

interface UploadModalProps {
  onClose: () => void;
  onUploaded: () => void;
}

type Step = "pick" | "caption" | "uploading" | "done";

type UploadPhase =
  | "sending"      // uploading raw file to server (< 100 MB: this = Cloudinary direct)
  | "optimizing"   // server is running FFmpeg
  | "uploading"    // server is pushing to Cloudinary
  | "saving";      // writing DB record

const PHASE_LABELS: Record<UploadPhase, string> = {
  sending:    "Sending video…",
  optimizing: "Optimizing video…",
  uploading:  "Uploading to cloud…",
  saving:     "Almost done…",
};

export default function UploadModal({ onClose, onUploaded }: UploadModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep]       = useState<Step>("pick");
  const [file, setFile]       = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [progress, setProgress] = useState(0);
  const [phase, setPhase]     = useState<UploadPhase>("sending");

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 500 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 500 MB per reel.", variant: "destructive" });
      return;
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setStep("caption");
  };

  // ── Small file path: direct Cloudinary upload (unchanged) ─────────────────
  const handleDirectUpload = async (f: File) => {
    setPhase("sending");
    const sigRes = await apiRequest("/api/reels/upload-signature", "GET");
    const { signature, timestamp, folder, apiKey, cloudName } = await sigRes.json();

    const uploadResult = await uploadVideoToCloudinary(
      f,
      { signature, timestamp, folder, apiKey, cloudName },
      {
        onProgress: (pct) => setProgress(Math.round(pct * 0.85)), // 0–85%
      }
    );

    return {
      secure_url: uploadResult.secure_url,
      public_id:  uploadResult.public_id,
      duration:   uploadResult.duration ?? 0,
    };
  };

  // ── Large file path: server-side FFmpeg compress → Cloudinary ─────────────
  const handleCompressUpload = async (f: File) => {
    setPhase("sending");

    // Phase 1: upload raw file to server (XHR for progress)
    const uploadToServer = (): Promise<{ secure_url: string; public_id: string; duration: number }> =>
      new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append("video", f);

        const xhr = new XMLHttpRequest();

        // Phase 1 progress: 0 → 40% while uploading to server
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 40));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch {
              reject(new Error("Invalid server response"));
            }
          } else {
            let msg = "Server error";
            try { msg = JSON.parse(xhr.responseText)?.error || msg; } catch {}
            reject(new Error(msg));
          }
        };

        xhr.onerror = () => reject(new Error("Network error"));

        // Phase 2: once file is fully sent (40%), simulate FFmpeg + Cloudinary phases
        xhr.upload.onloadend = () => {
          setPhase("optimizing");
          // Animate progress 40 → 80 slowly while server compresses
          let sim = 40;
          const tick = setInterval(() => {
            sim = Math.min(80, sim + 1);
            setProgress(sim);
            if (sim >= 80) {
              clearInterval(tick);
              setPhase("uploading");
              // Animate 80 → 90 while Cloudinary upload happens on server
              let sim2 = 80;
              const tick2 = setInterval(() => {
                sim2 = Math.min(90, sim2 + 1);
                setProgress(sim2);
                if (sim2 >= 90) clearInterval(tick2);
              }, 300);
            }
          }, 400);
        };

        // open must come before setRequestHeader
        xhr.open("POST", "/api/reels/compress-upload");

        // Attach Firebase auth token (same pattern as apiRequest in queryClient)
        try {
          const auth = await import("@/firebase/firebase").then((m) => m.auth);
          if (auth.currentUser) {
            const token = await auth.currentUser.getIdToken();
            if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
          }
        } catch {}

        xhr.send(formData);
      });

    return uploadToServer();
  };

  const handleUpload = async () => {
    if (!file) return;
    setStep("uploading");
    setProgress(0);

    try {
      const needsCompression = file.size > COMPRESS_THRESHOLD;

      const cloudResult = needsCompression
        ? await handleCompressUpload(file)
        : await handleDirectUpload(file);

      // Phase: saving to DB
      setPhase("saving");
      setProgress(93);

      const videoUrl      = applyFullHd(cloudResult.secure_url);
      const thumbnailUrl  = cloudResult.secure_url
        .replace(/\.[^/.]+$/, ".jpg")
        .replace("/video/upload/", "/video/upload/so_0/");

      await apiRequest("/api/reels", "POST", {
        videoUrl,
        videoPublicId: cloudResult.public_id,
        thumbnailUrl,
        caption: caption.trim() || null,
        duration: Math.round(cloudResult.duration ?? 0),
        status: "active",
      });

      setProgress(100);
      setStep("done");
      setTimeout(() => {
        onUploaded();
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error("Reel upload error:", err);
      toast({ title: "Upload failed", description: err.message || "Please try again.", variant: "destructive" });
      setStep("caption");
      setProgress(0);
    }
  };

  const isLargeFile = file && file.size > COMPRESS_THRESHOLD;

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-zinc-950 rounded-t-3xl md:rounded-2xl border border-zinc-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-white font-semibold text-base">
            {step === "pick"      && "New Reel"}
            {step === "caption"   && "Add caption"}
            {step === "uploading" && PHASE_LABELS[phase]}
            {step === "done"      && "Posted!"}
          </h2>
          {step !== "uploading" && step !== "done" && (
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-white transition-colors"
              data-testid="button-close-upload"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <div className="p-5">
          {/* STEP: Pick file */}
          {step === "pick" && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-4 h-52 border-2 border-dashed border-zinc-700 rounded-2xl cursor-pointer hover:border-primary/60 hover:bg-zinc-900 transition-all"
              data-testid="dropzone-video"
            >
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Film size={28} className="text-primary" />
              </div>
              <div className="text-center">
                <p className="text-white font-medium">Select a video</p>
                <p className="text-zinc-500 text-sm mt-1">MP4, MOV, WEBM · Max 500 MB</p>
              </div>
              <Button size="sm" variant="outline" className="border-zinc-700 text-white hover:bg-zinc-800">
                <Upload size={14} className="mr-2" />
                Browse files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm,video/*"
                className="hidden"
                onChange={handleFilePick}
                data-testid="input-video-file"
              />
            </div>
          )}

          {/* STEP: Caption */}
          {step === "caption" && previewUrl && (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-[9/16] max-h-64 flex items-center justify-center">
                <video
                  src={previewUrl}
                  className="h-full w-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
                <button
                  onClick={() => { setFile(null); setPreviewUrl(null); setStep("pick"); }}
                  className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80"
                  data-testid="button-change-video"
                >
                  <X size={12} />
                </button>
              </div>

              {/* Large-file notice — subtle, not alarming */}
              {isLargeFile && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700">
                  <Zap size={13} className="text-amber-400 shrink-0" />
                  <p className="text-xs text-zinc-400">
                    Large video detected — it will be compressed to high quality before posting.
                  </p>
                </div>
              )}

              <AIReelCaption onInsert={(text) => setCaption(text.slice(0, 300))} />
              <Textarea
                placeholder="Write a caption… #hiphop #breaking #streetculture"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={300}
                className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 resize-none h-20"
                data-testid="input-reel-caption"
              />
              <div className="flex justify-between items-center gap-3">
                <span className="text-xs text-zinc-500">{caption.length}/300</span>
                <Button
                  onClick={handleUpload}
                  className="flex-1 bg-primary hover:bg-primary/90"
                  data-testid="button-post-reel"
                >
                  Post Reel
                </Button>
              </div>
            </div>
          )}

          {/* STEP: Uploading / Optimizing */}
          {step === "uploading" && (
            <div className="flex flex-col items-center gap-5 py-6">
              <div className="relative w-20 h-20">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#27272a" strokeWidth="6" />
                  <circle
                    cx="40" cy="40" r="34" fill="none"
                    stroke={phase === "optimizing" ? "hsl(38 92% 50%)" : "hsl(var(--primary))"}
                    strokeWidth="6"
                    strokeDasharray={`${2 * Math.PI * 34}`}
                    strokeDashoffset={`${2 * Math.PI * 34 * (1 - progress / 100)}`}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  {phase === "optimizing"
                    ? <Zap size={22} className="text-amber-400 animate-pulse" />
                    : <Loader2 size={24} className="text-primary animate-spin" />
                  }
                </div>
              </div>
              <div className="text-center">
                <p className="text-white font-medium">{PHASE_LABELS[phase]}</p>
                <p className={cn(
                  "text-sm mt-1",
                  phase === "optimizing" ? "text-amber-400/70" : "text-zinc-400"
                )}>
                  {phase === "sending"    && `${progress}% — Sending to server`}
                  {phase === "optimizing" && "Compressing to Full HD — keeping best quality"}
                  {phase === "uploading"  && `${progress}% — Going to the cloud`}
                  {phase === "saving"     && "Saving your reel…"}
                </p>
              </div>
            </div>
          )}

          {/* STEP: Done */}
          {step === "done" && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 size={32} className="text-green-400" />
              </div>
              <p className="text-white font-semibold text-lg">Reel posted!</p>
              <p className="text-zinc-400 text-sm text-center">Your reel is live. The community will love it.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
