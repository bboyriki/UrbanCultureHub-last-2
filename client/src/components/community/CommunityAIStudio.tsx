import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Sparkles, Image as ImageIcon, Video, FileText, Send, Trash2, Save,
  RefreshCw, ChevronRight, Eye, Globe, Users, Copy, Check, Loader2,
  Zap, Film, Wand2, X, ArrowRight, Clock, CheckCircle2, AlertCircle,
  LayoutDashboard, PenSquare, Layers, Download, Timer, Clapperboard
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface DraftItem {
  id: string;
  type: "text" | "image" | "video";
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  caption?: string;
  createdAt: Date;
  status: "draft" | "ready";
}

type GenMode = "text" | "image" | "video";
type TextType = "caption" | "post" | "announcement" | "hook";
type ImageModel = "gpt-image-1" | "flux-1.1-pro";
type DoPModel = "dop-turbo" | "dop-standard" | "dop-lite";
type VideoAspect = "9:16" | "16:9" | "1:1";
type VideoEngine = "sora" | "dop";
type SoraDuration = 4 | 8 | 12;
type SoraAspect = "1280x720" | "720x1280";
type Privacy = "public" | "friends_only";

// ── Helper ─────────────────────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function StatusPill({ status, label }: { status: string; label: string }) {
  const map: Record<string, { icon: React.ReactNode; cls: string }> = {
    queued:     { icon: <Clock className="h-3 w-3" />, cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20" },
    processing: { icon: <Loader2 className="h-3 w-3 animate-spin" />, cls: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20" },
    succeeded:  { icon: <CheckCircle2 className="h-3 w-3" />, cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
    failed:     { icon: <AlertCircle className="h-3 w-3" />, cls: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20" },
  };
  const s = map[status] ?? map.queued;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", s.cls)}>
      {s.icon}{label}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Copy">
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function CommunityAIStudio() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  // ── generator state
  const [mode, setMode]             = useState<GenMode>("text");
  const [textPrompt, setTextPrompt] = useState("");
  const [textType, setTextType]     = useState<TextType>("caption");
  const [generatedText, setGeneratedText] = useState("");

  const [imagePrompt, setImagePrompt]   = useState("");
  const [imageModel, setImageModel]     = useState<ImageModel>("gpt-image-1");
  const [imageSize, setImageSize]       = useState("1024x1024");
  const [generatedImage, setGeneratedImage] = useState("");

  const [videoEngine, setVideoEngine]   = useState<VideoEngine>("sora");

  // DOP (Higgsfield) state
  const [videoPrompt, setVideoPrompt]   = useState("");
  const [dopModel, setDopModel]         = useState<DoPModel>("dop-turbo");
  const [videoAspect, setVideoAspect]   = useState<VideoAspect>("9:16");
  const [videoDuration, setVideoDuration] = useState(5);
  const [videoImageUrl, setVideoImageUrl] = useState("");
  const [videoJob, setVideoJob]         = useState<{ jobId: string; status: string; url?: string; error?: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sora state
  const [soraPrompt, setSoraPrompt]       = useState("");
  const [soraAspect, setSoraAspect]       = useState<SoraAspect>("1280x720");
  const [soraDuration, setSoraDuration]   = useState<SoraDuration>(8);
  const [soraJob, setSoraJob]             = useState<{ jobId: string; status: string; url?: string; error?: string } | null>(null);
  const [isSoraLoading, setIsSoraLoading] = useState(false);
  const soraPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── draft / publish state
  const [drafts, setDrafts]         = useState<DraftItem[]>([]);
  const [activeTab, setActiveTab]   = useState<"studio" | "drafts" | "publish">("studio");
  const [selectedDraft, setSelectedDraft] = useState<DraftItem | null>(null);

  // ── publish composer state
  const [publishContent, setPublishContent] = useState("");
  const [publishImage, setPublishImage]     = useState("");
  const [publishPrivacy, setPublishPrivacy] = useState<Privacy>("public");
  const [publishIsLoading, setPublishIsLoading] = useState(false);

  // ── Text generation ──────────────────────────────────────────────────────────
  const textMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/community/ai-studio/text", "POST", { prompt: textPrompt, type: textType });
      return res as any;
    },
    onSuccess: (data) => {
      setGeneratedText(data.text || "");
    },
    onError: (err: any) => {
      toast({ title: "Text generation failed", description: err.message, variant: "destructive" });
    },
  });

  // ── Image generation ─────────────────────────────────────────────────────────
  const imageMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/community/ai-studio/image", "POST", {
        prompt: imagePrompt,
        model: imageModel,
        size: imageSize,
      });
      return res as any;
    },
    onSuccess: (data) => {
      setGeneratedImage(data.url || "");
    },
    onError: (err: any) => {
      toast({ title: "Image generation failed", description: err.message, variant: "destructive" });
    },
  });

  // ── Video generation (Higgsfield) ────────────────────────────────────────────
  const videoMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/community/ai-studio/higgsfield/generate", "POST", {
        prompt: videoPrompt,
        dopModel,
        aspectRatio: videoAspect,
        duration: videoDuration,
        ...(videoImageUrl ? { imageUrl: videoImageUrl } : {}),
      });
      return res as any;
    },
    onSuccess: (data) => {
      if (data.jobId) {
        setVideoJob({ jobId: data.jobId, status: "queued" });
        startPolling(data.jobId);
      } else {
        toast({ title: "Video submission failed", description: "No job ID returned", variant: "destructive" });
      }
    },
    onError: (err: any) => {
      const msg = err.message || "Video generation failed";
      if (msg.includes("credentials not configured")) {
        toast({
          title: "Higgsfield not configured",
          description: "Add HF_API_KEY and HF_API_SECRET in your Secrets to enable video generation.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Video generation failed", description: msg, variant: "destructive" });
      }
    },
  });

  function startPolling(jobId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/community/ai-studio/higgsfield/${jobId}`, { credentials: "include" });
        const data = await res.json() as any;
        if (data.status === "succeeded") {
          setVideoJob({ jobId, status: "succeeded", url: data.url });
          if (pollRef.current) clearInterval(pollRef.current);
          toast({ title: "Video ready!", description: "Your Higgsfield video has been generated." });
        } else if (data.status === "failed") {
          setVideoJob({ jobId, status: "failed" });
          if (pollRef.current) clearInterval(pollRef.current);
          toast({ title: "Video generation failed", description: data.error || "Generation error", variant: "destructive" });
        } else {
          setVideoJob((prev) => prev ? { ...prev, status: data.status || "processing" } : null);
        }
      } catch {}
    }, 5000);
  }

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // ── Sora generation & polling ────────────────────────────────────────────────
  async function handleSoraGenerate() {
    if (!soraPrompt.trim() || isSoraLoading) return;
    setIsSoraLoading(true);
    setSoraJob(null);
    try {
      const res = await apiRequest("/api/admin/ai-studio/video", "POST", {
        prompt: soraPrompt.trim(),
        size: soraAspect,
        duration: soraDuration,
      });
      const d = await (res as Response).json();
      if (d.error) throw new Error(d.error);
      const jobId = d.jobId;
      setSoraJob({ jobId, status: "queued" });
      toast({ title: "Sora is generating…", description: "This takes 2–5 minutes. We'll notify you when it's ready." });
      startSoraPolling(jobId);
    } catch (err: any) {
      toast({ title: "Sora generation failed", description: err.message || "Check your OpenAI API key", variant: "destructive" });
    } finally {
      setIsSoraLoading(false);
    }
  }

  function startSoraPolling(jobId: string) {
    if (soraPollRef.current) clearInterval(soraPollRef.current);
    soraPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/ai-studio/video/${jobId}`, { credentials: "include" });
        const data = await res.json() as any;
        if (data.status === "succeeded") {
          setSoraJob({ jobId, status: "succeeded", url: data.url });
          if (soraPollRef.current) clearInterval(soraPollRef.current);
          toast({ title: "🎬 Sora video ready!", description: "Your OpenAI Sora video has been generated." });
        } else if (data.status === "failed") {
          setSoraJob({ jobId, status: "failed", error: data.error || "Generation failed" });
          if (soraPollRef.current) clearInterval(soraPollRef.current);
          toast({ title: "Sora generation failed", description: data.error || "Generation error", variant: "destructive" });
        } else {
          setSoraJob((prev) => prev ? { ...prev, status: data.status || "in_progress" } : null);
        }
      } catch {}
    }, 15000);
  }

  useEffect(() => {
    return () => { if (soraPollRef.current) clearInterval(soraPollRef.current); };
  }, []);

  // ── Draft management ─────────────────────────────────────────────────────────
  function saveToDraft(type: DraftItem["type"], content: string, extras?: Partial<DraftItem>) {
    const item: DraftItem = {
      id: uid(),
      type,
      content,
      createdAt: new Date(),
      status: "draft",
      ...extras,
    };
    setDrafts((prev) => [item, ...prev]);
    toast({ title: "Saved to drafts", description: "You can review and publish it from the Drafts tab." });
  }

  function deleteDraft(id: string) {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    if (selectedDraft?.id === id) setSelectedDraft(null);
  }

  function openDraftForPublish(draft: DraftItem) {
    setPublishContent(draft.content);
    setPublishImage(draft.imageUrl || draft.videoUrl || "");
    setSelectedDraft(draft);
    setActiveTab("publish");
  }

  // ── Publish to feed ──────────────────────────────────────────────────────────
  async function handlePublish() {
    if (!publishContent.trim()) {
      toast({ title: "Content required", description: "Add some text before publishing.", variant: "destructive" });
      return;
    }
    setPublishIsLoading(true);
    try {
      await apiRequest("/api/posts", "POST", {
        userId: user?.id,
        content: publishContent.trim(),
        image: publishImage || null,
        privacy: publishPrivacy,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts/feed"] });
      if (selectedDraft) {
        setDrafts((prev) => prev.filter((d) => d.id !== selectedDraft.id));
        setSelectedDraft(null);
      }
      setPublishContent("");
      setPublishImage("");
      setPublishPrivacy("public");
      setActiveTab("studio");
      toast({ title: "Published!", description: "Your post is now live in the community." });
    } catch (err: any) {
      toast({ title: "Publish failed", description: err.message, variant: "destructive" });
    } finally {
      setPublishIsLoading(false);
    }
  }

  // ── Publish video to Reels ────────────────────────────────────────────────
  const [isPublishingReel, setIsPublishingReel] = useState(false);

  async function publishToReels(videoUrl: string, caption: string, jobId: string) {
    if (!user?.id) {
      toast({ title: "Not logged in", description: "Please log in to publish to Reels.", variant: "destructive" });
      return;
    }
    setIsPublishingReel(true);
    try {
      await apiRequest("/api/reels", "POST", {
        userId: user.id,
        videoUrl,
        videoPublicId: `ai-generated-${jobId}`,
        caption: caption.trim() || null,
        duration: null,
        thumbnailUrl: null,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/reels"] });
      toast({ title: "Published to Reels!", description: "Your AI video is now live in Reels." });
      navigate("/reels");
    } catch (err: any) {
      toast({ title: "Failed to publish to Reels", description: err.message, variant: "destructive" });
    } finally {
      setIsPublishingReel(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl border border-border/60 bg-gradient-to-b from-background to-muted/20 shadow-lg overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-md">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-sm leading-tight">AI Publishing Studio</h2>
            <p className="text-[11px] text-muted-foreground leading-tight">Generate · Prepare · Publish</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {drafts.length > 0 && (
            <Badge variant="secondary" className="text-xs h-5 px-2">
              {drafts.length} draft{drafts.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </div>

      {/* ── Nav tabs ── */}
      <div className="flex border-b border-border/40 bg-muted/30">
        {(["studio", "drafts", "publish"] as const).map((t) => {
          const icons = { studio: <Wand2 className="h-3.5 w-3.5" />, drafts: <Layers className="h-3.5 w-3.5" />, publish: <Send className="h-3.5 w-3.5" /> };
          const labels = { studio: "Studio", drafts: `Drafts${drafts.length ? ` (${drafts.length})` : ""}`, publish: "Publish" };
          return (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              data-testid={`studio-tab-${t}`}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all border-b-2",
                activeTab === t
                  ? "border-primary text-primary bg-background"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {icons[t]}{labels[t]}
            </button>
          );
        })}
      </div>

      <div className="p-4 space-y-4">

        {/* ═══════════════ STUDIO TAB ═══════════════ */}
        {activeTab === "studio" && (
          <>
            {/* Mode picker */}
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: "text",  icon: <FileText className="h-4 w-4" />, label: "Text" },
                { key: "image", icon: <ImageIcon className="h-4 w-4" />, label: "Image" },
                { key: "video", icon: <Video className="h-4 w-4" />, label: "Video" },
              ] as const).map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMode(m.key)}
                  data-testid={`studio-mode-${m.key}`}
                  className={cn(
                    "flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-medium transition-all",
                    mode === m.key
                      ? "border-primary bg-primary/5 text-primary shadow-sm"
                      : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {m.icon}
                  {m.label}
                </button>
              ))}
            </div>

            {/* ── TEXT MODE ── */}
            {mode === "text" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</Label>
                  <div className="flex gap-1.5 flex-wrap">
                    {(["caption", "post", "announcement", "hook"] as TextType[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setTextType(t)}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-xs border transition-colors capitalize",
                          textType === t
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:border-primary/50"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <Textarea
                  placeholder="Describe the topic or vibe… e.g. 'breakdance battle in Rotterdam, raw energy'"
                  className="min-h-[80px] text-sm resize-none"
                  value={textPrompt}
                  onChange={(e) => setTextPrompt(e.target.value)}
                  data-testid="studio-text-prompt"
                />

                <Button
                  className="w-full gap-2"
                  onClick={() => textMutation.mutate()}
                  disabled={!textPrompt.trim() || textMutation.isPending}
                  data-testid="studio-generate-text"
                >
                  {textMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {textMutation.isPending ? "Generating…" : "Generate Text"}
                </Button>

                {generatedText && (
                  <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm leading-relaxed whitespace-pre-line flex-1">{generatedText}</p>
                      <CopyButton text={generatedText} />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => textMutation.mutate()}>
                        <RefreshCw className="h-3 w-3" />Regenerate
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => saveToDraft("text", generatedText)}>
                        <Save className="h-3 w-3" />Save Draft
                      </Button>
                      <Button size="sm" className="gap-1.5 text-xs" onClick={() => {
                        setPublishContent(generatedText);
                        setActiveTab("publish");
                      }}>
                        <ArrowRight className="h-3 w-3" />Use for Post
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── IMAGE MODE ── */}
            {mode === "image" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Model</Label>
                    <Select value={imageModel} onValueChange={(v) => setImageModel(v as ImageModel)}>
                      <SelectTrigger className="h-8 text-xs" data-testid="studio-image-model">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-image-1">GPT Image 1</SelectItem>
                        <SelectItem value="flux-1.1-pro">Flux 1.1 Pro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Size</Label>
                    <Select value={imageSize} onValueChange={setImageSize}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1024x1024">Square 1:1</SelectItem>
                        <SelectItem value="1536x1024">Landscape 3:2</SelectItem>
                        <SelectItem value="1024x1536">Portrait 2:3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Textarea
                  placeholder="Describe the image… e.g. 'Graffiti artist spraying a mural at night, neon lights, cinematic'"
                  className="min-h-[80px] text-sm resize-none"
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  data-testid="studio-image-prompt"
                />

                <Button
                  className="w-full gap-2"
                  onClick={() => imageMutation.mutate()}
                  disabled={!imagePrompt.trim() || imageMutation.isPending}
                  data-testid="studio-generate-image"
                >
                  {imageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                  {imageMutation.isPending ? "Generating…" : "Generate Image"}
                </Button>

                {generatedImage && (
                  <div className="rounded-xl border border-border/60 overflow-hidden space-y-0">
                    <img
                      src={generatedImage}
                      alt="Generated"
                      className="w-full object-cover max-h-72"
                    />
                    <div className="p-3 bg-muted/30 flex gap-2 flex-wrap">
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => imageMutation.mutate()}>
                        <RefreshCw className="h-3 w-3" />Regenerate
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => saveToDraft("image", imagePrompt, { imageUrl: generatedImage })}>
                        <Save className="h-3 w-3" />Save Draft
                      </Button>
                      <Button size="sm" className="gap-1.5 text-xs" onClick={() => {
                        setPublishImage(generatedImage);
                        setActiveTab("publish");
                      }}>
                        <ArrowRight className="h-3 w-3" />Use in Post
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── VIDEO MODE ── */}
            {mode === "video" && (
              <div className="space-y-3">
                {/* Engine switcher */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setVideoEngine("sora")}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all",
                      videoEngine === "sora"
                        ? "border-violet-500 bg-violet-500/10"
                        : "border-border hover:border-violet-300 hover:bg-muted/40"
                    )}
                    data-testid="studio-engine-sora"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-xs font-bold text-foreground">OpenAI Sora</span>
                    <span className="text-[10px] text-muted-foreground">Text → Video</span>
                    {videoEngine === "sora" && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500 text-white">Selected</span>}
                  </button>
                  <button
                    onClick={() => setVideoEngine("dop")}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all",
                      videoEngine === "dop"
                        ? "border-pink-500 bg-pink-500/10"
                        : "border-border hover:border-pink-300 hover:bg-muted/40"
                    )}
                    data-testid="studio-engine-dop"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
                      <Film className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-xs font-bold text-foreground">Higgsfield DOP</span>
                    <span className="text-[10px] text-muted-foreground">Image → Video</span>
                    {videoEngine === "dop" && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-pink-500 text-white">Selected</span>}
                  </button>
                </div>

                {/* ── SORA FORM ── */}
                {videoEngine === "sora" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
                      <Sparkles className="h-4 w-4 text-violet-500" />
                      <span className="text-xs font-medium text-violet-700 dark:text-violet-400">OpenAI Sora 2 — Flagship text-to-video</span>
                      <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground"><Timer className="h-3 w-3" />2–5 min</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Aspect Ratio</Label>
                        <Select value={soraAspect} onValueChange={(v) => setSoraAspect(v as SoraAspect)}>
                          <SelectTrigger className="h-8 text-xs" data-testid="studio-sora-aspect">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1280x720">16:9 (Landscape)</SelectItem>
                            <SelectItem value="720x1280">9:16 (Vertical)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Duration</Label>
                        <Select value={String(soraDuration)} onValueChange={(v) => setSoraDuration(Number(v) as SoraDuration)}>
                          <SelectTrigger className="h-8 text-xs" data-testid="studio-sora-duration">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="4">4 seconds</SelectItem>
                            <SelectItem value="8">8 seconds</SelectItem>
                            <SelectItem value="12">12 seconds</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Textarea
                      placeholder="Describe your video… e.g. 'A b-boy performing windmills on a rooftop in Amsterdam at golden hour, cinematic slow motion'"
                      className="min-h-[90px] text-sm resize-none"
                      value={soraPrompt}
                      onChange={(e) => setSoraPrompt(e.target.value)}
                      data-testid="studio-sora-prompt"
                    />

                    <Button
                      className="w-full gap-2 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800"
                      onClick={handleSoraGenerate}
                      disabled={!soraPrompt.trim() || isSoraLoading || soraJob?.status === "queued" || soraJob?.status === "in_progress"}
                      data-testid="studio-generate-sora"
                    >
                      {isSoraLoading || soraJob?.status === "queued" || soraJob?.status === "in_progress"
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Sparkles className="h-4 w-4" />}
                      {isSoraLoading ? "Submitting…" : soraJob?.status === "queued" || soraJob?.status === "in_progress" ? "Generating (2–5 min)…" : "Generate with Sora"}
                    </Button>

                    {soraJob && (
                      <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium">Sora Job</span>
                          <StatusPill
                            status={soraJob.status === "in_progress" ? "processing" : soraJob.status}
                            label={soraJob.status === "queued" ? "Queued" : soraJob.status === "in_progress" ? "Processing" : soraJob.status === "succeeded" ? "Ready" : "Failed"}
                          />
                        </div>
                        {(soraJob.status === "queued" || soraJob.status === "in_progress") && (
                          <p className="text-xs text-muted-foreground">Sora typically takes 2–5 minutes. You can navigate away — we'll notify you when it's done.</p>
                        )}
                        {soraJob.status === "succeeded" && soraJob.url && (
                          <div className="space-y-2">
                            <video src={soraJob.url} controls className="w-full rounded-lg max-h-56 bg-black" />
                            <div className="flex gap-2 flex-wrap">
                              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => saveToDraft("video", soraPrompt, { videoUrl: soraJob!.url })}>
                                <Save className="h-3 w-3" />Save Draft
                              </Button>
                              <Button
                                size="sm"
                                className="gap-1.5 text-xs bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800"
                                disabled={isPublishingReel}
                                data-testid="button-publish-sora-reel"
                                onClick={() => publishToReels(soraJob!.url!, soraPrompt, soraJob!.jobId)}
                              >
                                {isPublishingReel ? <Loader2 className="h-3 w-3 animate-spin" /> : <Clapperboard className="h-3 w-3" />}
                                Publish to Reels
                              </Button>
                              <a href={soraJob.url} download target="_blank" rel="noreferrer">
                                <Button size="sm" variant="ghost" className="gap-1.5 text-xs text-muted-foreground">
                                  <Download className="h-3 w-3" />Download
                                </Button>
                              </a>
                              <Button size="sm" variant="ghost" className="gap-1.5 text-xs text-muted-foreground" onClick={() => setSoraJob(null)}>
                                <X className="h-3 w-3" />Clear
                              </Button>
                            </div>
                          </div>
                        )}
                        {soraJob.status === "failed" && (
                          <p className="text-xs text-red-500">{soraJob.error || "Generation failed"}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ── DOP (Higgsfield) FORM ── */}
                {videoEngine === "dop" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-pink-500/10 border border-pink-500/20">
                      <Film className="h-4 w-4 text-pink-500" />
                      <span className="text-xs font-medium text-pink-700 dark:text-pink-400">Higgsfield DOP — Animates images with cinematic camera moves</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Model</Label>
                        <Select value={dopModel} onValueChange={(v) => setDopModel(v as DoPModel)}>
                          <SelectTrigger className="h-8 text-xs" data-testid="studio-video-model">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dop-turbo">DOP Turbo (fast)</SelectItem>
                            <SelectItem value="dop-standard">DOP Standard (best quality)</SelectItem>
                            <SelectItem value="dop-lite">DOP Lite (basic)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Aspect</Label>
                        <Select value={videoAspect} onValueChange={(v) => setVideoAspect(v as VideoAspect)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="9:16">9:16 (Vertical)</SelectItem>
                            <SelectItem value="16:9">16:9 (Wide)</SelectItem>
                            <SelectItem value="1:1">1:1 (Square)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Duration: {videoDuration}s</Label>
                      <input
                        type="range"
                        min={3}
                        max={10}
                        step={1}
                        value={videoDuration}
                        onChange={(e) => setVideoDuration(Number(e.target.value))}
                        className="w-full accent-primary"
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                        <span>3s</span><span>10s</span>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">
                        Source Image URL <span className="text-red-400">*</span>
                        <span className="text-muted-foreground/60 ml-1">(DOP animates your image with camera moves)</span>
                      </Label>
                      <Input
                        placeholder="https://... (JPEG or PNG — required)"
                        className={`h-8 text-xs ${!videoImageUrl && videoMutation.isError ? "border-red-500" : ""}`}
                        value={videoImageUrl}
                        onChange={(e) => setVideoImageUrl(e.target.value)}
                        data-testid="studio-video-image-url"
                      />
                    </div>

                    <Textarea
                      placeholder="Describe the motion… e.g. 'slow cinematic zoom in, golden hour lighting, dramatic camera pan'"
                      className="min-h-[80px] text-sm resize-none"
                      value={videoPrompt}
                      onChange={(e) => setVideoPrompt(e.target.value)}
                      data-testid="studio-video-prompt"
                    />

                    <Button
                      className="w-full gap-2 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700"
                      onClick={() => videoMutation.mutate()}
                      disabled={!videoPrompt.trim() || !videoImageUrl.trim() || videoMutation.isPending || videoJob?.status === "queued" || videoJob?.status === "processing"}
                      data-testid="studio-generate-video"
                    >
                      {videoMutation.isPending || videoJob?.status === "queued" || videoJob?.status === "processing"
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Film className="h-4 w-4" />}
                      {videoMutation.isPending ? "Submitting…" : videoJob?.status === "queued" || videoJob?.status === "processing" ? "Generating…" : "Generate Video"}
                    </Button>

                    {videoJob && (
                      <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium">Generation Job</span>
                          <StatusPill
                            status={videoJob.status}
                            label={videoJob.status === "queued" ? "Queued" : videoJob.status === "processing" ? "Processing" : videoJob.status === "succeeded" ? "Ready" : "Failed"}
                          />
                        </div>

                        {videoJob.status === "succeeded" && videoJob.url && (
                          <div className="space-y-2">
                            <video src={videoJob.url} controls className="w-full rounded-lg max-h-56 bg-black" />
                            <div className="flex gap-2 flex-wrap">
                              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => saveToDraft("video", videoPrompt, { videoUrl: videoJob.url })}>
                                <Save className="h-3 w-3" />Save Draft
                              </Button>
                              <Button
                                size="sm"
                                className="gap-1.5 text-xs bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700"
                                disabled={isPublishingReel}
                                data-testid="button-publish-higgsfield-reel"
                                onClick={() => publishToReels(videoJob.url!, videoPrompt, videoJob.jobId)}
                              >
                                {isPublishingReel ? <Loader2 className="h-3 w-3 animate-spin" /> : <Clapperboard className="h-3 w-3" />}
                                Publish to Reels
                              </Button>
                              <Button size="sm" variant="ghost" className="gap-1.5 text-xs text-muted-foreground" onClick={() => setVideoJob(null)}>
                                <X className="h-3 w-3" />Clear
                              </Button>
                            </div>
                          </div>
                        )}

                        {(videoJob.status === "queued" || videoJob.status === "processing") && (
                          <p className="text-xs text-muted-foreground">
                            Higgsfield is generating your video. This typically takes 1–3 minutes. You'll be notified when it's ready.
                          </p>
                        )}

                        {videoJob.status === "failed" && (
                          <div className="space-y-2">
                            <p className="text-xs text-red-500">Generation failed. Try adjusting your prompt or model settings.</p>
                            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { setVideoJob(null); videoMutation.mutate(); }}>
                              <RefreshCw className="h-3 w-3" />Retry
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ═══════════════ DRAFTS TAB ═══════════════ */}
        {activeTab === "drafts" && (
          <div className="space-y-3">
            {drafts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <Layers className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">No drafts yet</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Generate content in the Studio and save it here before publishing.
                </p>
                <Button size="sm" variant="outline" onClick={() => setActiveTab("studio")}>
                  Open Studio
                </Button>
              </div>
            ) : (
              drafts.map((draft) => (
                <div
                  key={draft.id}
                  className="rounded-xl border border-border/60 bg-background p-4 space-y-3 hover:border-primary/30 transition-colors"
                  data-testid={`draft-item-${draft.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {draft.type === "text"  && <FileText className="h-3.5 w-3.5 text-muted-foreground" />}
                      {draft.type === "image" && <ImageIcon className="h-3.5 w-3.5 text-blue-500" />}
                      {draft.type === "video" && <Video className="h-3.5 w-3.5 text-violet-500" />}
                      <span className="text-xs font-medium capitalize">{draft.type}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {draft.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteDraft(draft.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      data-testid={`button-delete-draft-${draft.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <p className="text-sm line-clamp-3 text-muted-foreground">{draft.content}</p>

                  {draft.imageUrl && (
                    <img src={draft.imageUrl} alt="Draft preview" className="rounded-lg w-full max-h-32 object-cover" />
                  )}
                  {draft.videoUrl && (
                    <video src={draft.videoUrl} className="rounded-lg w-full max-h-32 bg-black" />
                  )}

                  {draft.type === "video" && draft.videoUrl ? (
                    <Button
                      size="sm"
                      className="w-full gap-1.5 text-xs bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800"
                      disabled={isPublishingReel}
                      onClick={() => publishToReels(draft.videoUrl!, draft.content, draft.id)}
                      data-testid={`button-publish-reel-draft-${draft.id}`}
                    >
                      {isPublishingReel ? <Loader2 className="h-3 w-3 animate-spin" /> : <Clapperboard className="h-3 w-3" />}
                      Publish to Reels
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full gap-1.5 text-xs"
                      onClick={() => openDraftForPublish(draft)}
                      data-testid={`button-publish-draft-${draft.id}`}
                    >
                      <Send className="h-3 w-3" />Publish to Feed
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ═══════════════ PUBLISH TAB ═══════════════ */}
        {activeTab === "publish" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
              <p className="text-xs text-primary font-medium">
                {selectedDraft ? "Publishing draft to community feed" : "Compose and publish directly to community feed"}
              </p>
            </div>

            {/* Content */}
            <div>
              <Label className="text-xs font-semibold mb-1.5 block">Post Content</Label>
              <Textarea
                placeholder="What do you want to share with the community?"
                className="min-h-[120px] text-sm resize-none"
                value={publishContent}
                onChange={(e) => setPublishContent(e.target.value)}
                data-testid="publish-content"
              />
              <div className="text-right text-[10px] text-muted-foreground mt-1">
                {publishContent.length}/1000
              </div>
            </div>

            {/* Media preview */}
            {publishImage && (
              <div className="relative rounded-xl overflow-hidden border border-border/60">
                {publishImage.includes(".mp4") || publishImage.includes("video") ? (
                  <video src={publishImage} controls className="w-full max-h-48 bg-black" />
                ) : (
                  <img src={publishImage} alt="Post media" className="w-full max-h-48 object-cover" />
                )}
                <button
                  onClick={() => setPublishImage("")}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                  data-testid="button-remove-media"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Media URL input */}
            {!publishImage && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Media URL (optional)</Label>
                <Input
                  placeholder="Paste Cloudinary or Higgsfield URL…"
                  className="text-xs h-8"
                  value={publishImage}
                  onChange={(e) => setPublishImage(e.target.value)}
                  data-testid="publish-media-url"
                />
              </div>
            )}

            {/* Privacy */}
            <div>
              <Label className="text-xs font-semibold mb-1.5 block">Audience</Label>
              <div className="flex gap-2">
                <button
                  onClick={() => setPublishPrivacy("public")}
                  data-testid="publish-privacy-public"
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-all",
                    publishPrivacy === "public"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  )}
                >
                  <Globe className="h-3.5 w-3.5" />Everyone
                </button>
                <button
                  onClick={() => setPublishPrivacy("friends_only")}
                  data-testid="publish-privacy-followers"
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-all",
                    publishPrivacy === "friends_only"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  )}
                >
                  <Users className="h-3.5 w-3.5" />Followers
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 gap-1.5 text-sm"
                onClick={() => {
                  if (publishContent.trim()) saveToDraft("text", publishContent, { imageUrl: publishImage });
                  setActiveTab("drafts");
                }}
                disabled={publishIsLoading}
                data-testid="publish-save-draft"
              >
                <Save className="h-3.5 w-3.5" />Save Draft
              </Button>
              <Button
                className="flex-1 gap-1.5 text-sm"
                onClick={handlePublish}
                disabled={publishIsLoading || !publishContent.trim()}
                data-testid="publish-submit"
              >
                {publishIsLoading
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Send className="h-3.5 w-3.5" />}
                {publishIsLoading ? "Publishing…" : "Publish Now"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
