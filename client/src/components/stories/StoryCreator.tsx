import { useState, useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X, Camera, Type, Upload, Loader2, Film, Smile, Sparkles,
  ChevronLeft, Music, Sticker, AlignCenter, Bold
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { uploadVideoToCloudinary } from "@/lib/cloudinaryUpload";

const BG_GRADIENTS = [
  { id: "g1", value: "linear-gradient(135deg,#667eea,#764ba2)", label: "Purple" },
  { id: "g2", value: "linear-gradient(135deg,#f093fb,#f5576c)", label: "Pink" },
  { id: "g3", value: "linear-gradient(135deg,#4facfe,#00f2fe)", label: "Blue" },
  { id: "g4", value: "linear-gradient(135deg,#43e97b,#38f9d7)", label: "Green" },
  { id: "g5", value: "linear-gradient(135deg,#fa709a,#fee140)", label: "Sunset" },
  { id: "g6", value: "linear-gradient(135deg,#a18cd1,#fbc2eb)", label: "Lavender" },
  { id: "g7", value: "linear-gradient(135deg,#ffecd2,#fcb69f)", label: "Peach" },
  { id: "g8", value: "linear-gradient(135deg,#2d3436,#636e72)", label: "Dark" },
  { id: "g9", value: "linear-gradient(135deg,#ff6b6b,#ee5a24)", label: "Fire" },
  { id: "g10", value: "linear-gradient(135deg,#00b09b,#96c93d)", label: "Nature" },
];

const TEXT_FONTS = [
  { id: "f1", label: "Bold", style: { fontWeight: 800, fontStyle: "normal" } },
  { id: "f2", label: "Italic", style: { fontWeight: 400, fontStyle: "italic" } },
  { id: "f3", label: "Thin", style: { fontWeight: 300, fontStyle: "normal" } },
];

const EMOJI_STICKERS = ["🔥", "❤️", "😍", "✨", "💯", "🎉", "👏", "💪", "🌟", "🎵", "🏆", "😂"];

const IMAGE_FILTERS = [
  { id: "none", label: "Original", css: "" },
  { id: "vivid", label: "Vivid", css: "saturate(1.8) contrast(1.1)" },
  { id: "warm", label: "Warm", css: "sepia(0.4) saturate(1.5) brightness(1.05)" },
  { id: "cool", label: "Cool", css: "hue-rotate(20deg) saturate(1.2) brightness(1.05)" },
  { id: "fade", label: "Fade", css: "brightness(1.1) contrast(0.85) saturate(0.85)" },
  { id: "mono", label: "Mono", css: "grayscale(1)" },
  { id: "drama", label: "Drama", css: "contrast(1.4) saturate(1.3) brightness(0.9)" },
  { id: "golden", label: "Golden", css: "sepia(0.6) saturate(1.8) brightness(1.1)" },
];

type Mode = "pick" | "media" | "text";
type Tool = "none" | "filters" | "text-tool" | "stickers";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function StoryCreator({ open, onClose }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [mode, setMode] = useState<Mode>("pick");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string>("");
  const [isVideo, setIsVideo] = useState(false);
  const [caption, setCaption] = useState("");
  const [selectedBg, setSelectedBg] = useState(BG_GRADIENTS[0]);
  const [textContent, setTextContent] = useState("");
  const [selectedFont, setSelectedFont] = useState(TEXT_FONTS[0]);
  const [activeTool, setActiveTool] = useState<Tool>("none");
  const [selectedFilter, setSelectedFilter] = useState(IMAGE_FILTERS[0]);
  const [overlayEmojis, setOverlayEmojis] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const reset = () => {
    setMode("pick");
    setMediaFile(null);
    setMediaPreview("");
    setIsVideo(false);
    setCaption("");
    setTextContent("");
    setSelectedBg(BG_GRADIENTS[0]);
    setSelectedFont(TEXT_FONTS[0]);
    setActiveTool("none");
    setSelectedFilter(IMAGE_FILTERS[0]);
    setOverlayEmojis([]);
    setUploadProgress(0);
    setIsUploading(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleFile = useCallback((file: File) => {
    const video = file.type.startsWith("video");
    if (video && file.size > 500 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 500 MB for video stories.", variant: "destructive" });
      return;
    }
    if (!video && file.size > 20 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Max 20 MB for photo stories.", variant: "destructive" });
      return;
    }
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
    setIsVideo(video);
    setMode("media");
    setActiveTool("none");
    setSelectedFilter(IMAGE_FILTERS[0]);
  }, [toast]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const addEmojiOverlay = (emoji: string) => {
    setOverlayEmojis(prev => [...prev, emoji]);
    setActiveTool("none");
  };

  const mutation = useMutation({
    mutationFn: async () => {
      setIsUploading(true);
      setUploadProgress(0);

      let mediaUrl = "";
      let mediaType = "text";
      const captionFinal = mode === "text" ? textContent.trim() : caption.trim();
      const overlayText = overlayEmojis.join(" ");
      const finalCaption = overlayText ? `${captionFinal} ${overlayText}`.trim() : captionFinal;

      if (mode === "media" && mediaFile) {
        mediaType = isVideo ? "video" : "image";

        // Get Cloudinary signature
        const sigRes = await apiRequest("/api/stories/upload-signature", "GET");
        const { signature, timestamp, folder, apiKey, cloudName } = await sigRes.json();

        // Upload to Cloudinary directly
        const result = await uploadVideoToCloudinary(
          mediaFile,
          { signature, timestamp, folder, apiKey, cloudName },
          {
            onProgress: (pct) => setUploadProgress(pct),
            extraFields: isVideo ? {} : {},
          }
        );

        if (!result?.secure_url) throw new Error("Upload failed — no URL returned");
        setUploadProgress(95);
        mediaUrl = result.secure_url;
      }

      const body: Record<string, string> = {
        mediaType,
        ...(mediaUrl ? { mediaUrl } : {}),
        ...(finalCaption ? { caption: finalCaption } : {}),
        ...(mode === "text" ? { bgColor: selectedBg.value, mediaUrl: "" } : {}),
      };

      const res = await apiRequest("/api/stories", "POST", body);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to share story");
      }
      setUploadProgress(100);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/stories/feed"] });
      toast({ title: "Story shared!", description: "Visible to your followers for 24 hours." });
      handleClose();
    },
    onError: (err: any) => {
      setIsUploading(false);
      setUploadProgress(0);
      toast({ title: "Failed to share story", description: err.message || "Please try again.", variant: "destructive" });
    },
  });

  const canPost = mode === "media" ? !!mediaFile : !!textContent.trim();

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <SheetContent
        side="bottom"
        className="h-[96vh] p-0 rounded-t-3xl overflow-hidden flex flex-col bg-black border-0"
      >
        {/* Upload progress overlay */}
        <AnimatePresence>
          {isUploading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4"
            >
              <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
              <p className="text-white font-semibold text-base">Sharing your story…</p>
              <div className="w-48 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-pink-500 to-purple-600 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <p className="text-white/50 text-sm">{uploadProgress}%</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
          <button
            onClick={mode === "pick" ? handleClose : () => { setMode("pick"); setActiveTool("none"); }}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white"
            data-testid="btn-story-back"
          >
            {mode === "pick" ? <X className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          <span className="text-white font-bold text-base">
            {mode === "pick" ? "New Story" : mode === "text" ? "Text Story" : isVideo ? "Video Story" : "Photo Story"}
          </span>
          <Button
            size="sm"
            disabled={!canPost || mutation.isPending || isUploading}
            onClick={() => mutation.mutate()}
            className="rounded-full px-4 h-8 text-sm font-semibold bg-white text-black hover:bg-white/90 disabled:opacity-40"
            data-testid="btn-story-share"
          >
            {mutation.isPending || isUploading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : "Share"
            }
          </Button>
        </div>

        <AnimatePresence mode="wait">
          {/* Mode picker */}
          {mode === "pick" && (
            <motion.div
              key="pick"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center gap-5 px-6"
            >
              <div className="text-center mb-2">
                <div className="text-5xl mb-3">✨</div>
                <h2 className="text-white text-2xl font-black">Add to Your Story</h2>
                <p className="text-white/50 text-sm mt-1.5">Share a moment — it disappears in 24 hours</p>
              </div>

              <div className="w-full max-w-xs space-y-3">
                {/* Photo or Video */}
                <button
                  onClick={() => fileRef.current?.click()}
                  data-testid="btn-story-photo"
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/10 border border-white/20 text-white hover:bg-white/15 active:scale-[0.97] transition-all"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center shrink-0">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-base">Photo or Video</p>
                    <p className="text-xs text-white/50 mt-0.5">Upload from your library</p>
                  </div>
                </button>

                {/* Text Story */}
                <button
                  onClick={() => setMode("text")}
                  data-testid="btn-story-text"
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/10 border border-white/20 text-white hover:bg-white/15 active:scale-[0.97] transition-all"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shrink-0">
                    <Type className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-base">Text Story</p>
                    <p className="text-xs text-white/50 mt-0.5">Write on a gradient background</p>
                  </div>
                </button>
              </div>

              <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileInput} />
            </motion.div>
          )}

          {/* Media preview mode */}
          {mode === "media" && mediaPreview && (
            <motion.div
              key="media"
              initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {/* Preview area */}
              <div className="flex-1 relative overflow-hidden">
                {isVideo ? (
                  <video
                    ref={videoRef}
                    src={mediaPreview}
                    className="w-full h-full object-cover"
                    loop muted playsInline autoPlay
                  />
                ) : (
                  <img
                    src={mediaPreview}
                    alt="preview"
                    className="w-full h-full object-cover"
                    style={{ filter: selectedFilter.css }}
                  />
                )}

                {/* Emoji overlays */}
                {overlayEmojis.map((e, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="absolute text-4xl select-none"
                    style={{
                      top: `${20 + (i * 12) % 60}%`,
                      left: `${10 + (i * 17) % 80}%`,
                    }}
                  >
                    {e}
                  </motion.div>
                ))}

                {/* Tool panels */}
                <AnimatePresence>
                  {activeTool === "filters" && !isVideo && (
                    <motion.div
                      initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                      className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-md p-4"
                      onClick={e => e.stopPropagation()}
                    >
                      <p className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">Filters</p>
                      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                        {IMAGE_FILTERS.map(f => (
                          <button
                            key={f.id}
                            onClick={() => { setSelectedFilter(f); setActiveTool("none"); }}
                            className="flex flex-col items-center gap-1.5 shrink-0"
                          >
                            <div
                              className={cn(
                                "w-14 h-14 rounded-xl overflow-hidden ring-2 transition-all",
                                selectedFilter.id === f.id ? "ring-white" : "ring-transparent"
                              )}
                            >
                              <img
                                src={mediaPreview}
                                alt={f.label}
                                className="w-full h-full object-cover"
                                style={{ filter: f.css }}
                              />
                            </div>
                            <span className="text-white/70 text-[10px]">{f.label}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {activeTool === "stickers" && (
                    <motion.div
                      initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                      className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-md p-4"
                      onClick={e => e.stopPropagation()}
                    >
                      <p className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">Stickers</p>
                      <div className="grid grid-cols-6 gap-3">
                        {EMOJI_STICKERS.map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => addEmojiOverlay(emoji)}
                            className="text-3xl w-12 h-12 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 active:scale-90 transition-all"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                      {overlayEmojis.length > 0 && (
                        <button
                          onClick={() => setOverlayEmojis([])}
                          className="mt-3 text-white/50 text-xs"
                        >
                          Clear all stickers
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Top right: change media */}
                <button
                  onClick={() => fileRef.current?.click()}
                  className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm text-white text-xs font-semibold border border-white/20"
                >
                  Change
                </button>
              </div>

              {/* Toolbar */}
              <div className="shrink-0 bg-black/90 border-t border-white/10">
                {/* Tool icons row */}
                {!isVideo && (
                  <div className="flex items-center justify-around px-4 py-2 border-b border-white/5">
                    <button
                      onClick={() => setActiveTool(t => t === "filters" ? "none" : "filters")}
                      className={cn(
                        "flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors",
                        activeTool === "filters" ? "bg-white/20 text-white" : "text-white/60"
                      )}
                    >
                      <Sparkles className="w-5 h-5" />
                      <span className="text-[10px]">Filters</span>
                    </button>
                    <button
                      onClick={() => setActiveTool(t => t === "stickers" ? "none" : "stickers")}
                      className={cn(
                        "flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors",
                        activeTool === "stickers" ? "bg-white/20 text-white" : "text-white/60"
                      )}
                    >
                      <Smile className="w-5 h-5" />
                      <span className="text-[10px]">Stickers</span>
                    </button>
                    {isVideo && (
                      <button className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-white/60">
                        <Film className="w-5 h-5" />
                        <span className="text-[10px]">Video</span>
                      </button>
                    )}
                  </div>
                )}

                {isVideo && (
                  <div className="flex items-center justify-around px-4 py-2 border-b border-white/5">
                    <button
                      onClick={() => setActiveTool(t => t === "stickers" ? "none" : "stickers")}
                      className={cn(
                        "flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors",
                        activeTool === "stickers" ? "bg-white/20 text-white" : "text-white/60"
                      )}
                    >
                      <Smile className="w-5 h-5" />
                      <span className="text-[10px]">Stickers</span>
                    </button>
                    <div className="flex flex-col items-center gap-1 px-3 py-1.5 text-white/40">
                      <Film className="w-5 h-5" />
                      <span className="text-[10px]">Video</span>
                    </div>
                  </div>
                )}

                {/* Caption input */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <input
                    value={caption}
                    onChange={e => setCaption(e.target.value)}
                    placeholder="Add a caption…"
                    maxLength={150}
                    data-testid="input-story-caption"
                    className="flex-1 bg-transparent text-white placeholder:text-white/30 text-sm outline-none"
                  />
                  <span className="text-white/30 text-xs shrink-0">{caption.length}/150</span>
                </div>
              </div>

              <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileInput} />
            </motion.div>
          )}

          {/* Text story mode */}
          {mode === "text" && (
            <motion.div
              key="text"
              initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {/* Text preview canvas */}
              <div
                className="flex-1 flex items-center justify-center p-8 relative cursor-text"
                style={{ background: selectedBg.value }}
              >
                <textarea
                  value={textContent}
                  onChange={e => setTextContent(e.target.value)}
                  placeholder="Type something…"
                  maxLength={200}
                  autoFocus
                  data-testid="input-story-text"
                  className="resize-none bg-transparent border-0 text-white text-center text-3xl placeholder:text-white/50 focus:outline-none shadow-none leading-tight p-0 w-full max-h-[60vh] overflow-hidden"
                  style={{
                    textShadow: "0 2px 12px rgba(0,0,0,0.4)",
                    ...selectedFont.style,
                  }}
                  rows={4}
                />
              </div>

              {/* Bottom controls */}
              <div className="shrink-0 bg-black/90 border-t border-white/10">
                {/* Font styles */}
                <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5">
                  <span className="text-white/40 text-xs mr-1">Style</span>
                  {TEXT_FONTS.map(f => (
                    <button
                      key={f.id}
                      onClick={() => setSelectedFont(f)}
                      className={cn(
                        "px-3 py-1 rounded-full text-sm transition-all",
                        selectedFont.id === f.id
                          ? "bg-white text-black"
                          : "bg-white/10 text-white/70"
                      )}
                      style={f.style}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Background picker */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="text-white/40 text-xs shrink-0">Background</span>
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide flex-1">
                    {BG_GRADIENTS.map(bg => (
                      <button
                        key={bg.id}
                        onClick={() => setSelectedBg(bg)}
                        className={cn(
                          "w-8 h-8 rounded-full shrink-0 transition-transform active:scale-90",
                          selectedBg.id === bg.id ? "ring-2 ring-white ring-offset-1 ring-offset-black scale-110" : ""
                        )}
                        style={{ background: bg.value }}
                        title={bg.label}
                        data-testid={`btn-story-bg-${bg.id}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  );
}
