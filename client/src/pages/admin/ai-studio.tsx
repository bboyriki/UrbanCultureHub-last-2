import { useState, useRef, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  Video, Image, Type, Sparkles, Download, Copy, RefreshCw,
  Loader2, CheckCircle2, XCircle, Clock, Wand2, Film,
  ZapIcon, AlertTriangle, ChevronRight, Play, Share2,
  Settings2, Upload, ImageIcon, Key, ExternalLink,
  Star, Zap, DollarSign, Timer, CheckCircle, Circle,
} from "lucide-react";

// ─── Model Registry ──────────────────────────────────────────────────────────

interface AIModel {
  id: string;
  name: string;
  provider: "replicate" | "fal" | "runway" | "openai";
  providerLabel: string;
  replicateModel?: string;
  falModel?: string;
  description: string;
  costEstimate: string;
  costRaw: number;
  quality: number;
  speed: string;
  speedMs: number;
  tags: string[];
  inputMode: "text" | "image" | "both";
  aspectRatios: string[];
  maxDuration: number;
  gradient: string;
}

const MODELS: AIModel[] = [
  {
    id: "wan-2.1",
    name: "Wan 2.1 480p",
    provider: "replicate",
    providerLabel: "Replicate",
    replicateModel: "wavespeedai/wan-2.1-t2v-480p",
    description: "Ultra-fast text-to-video, great for quick prototypes and social clips.",
    costEstimate: "~€0.01/video",
    costRaw: 0.01,
    quality: 3,
    speed: "15–30s",
    speedMs: 22500,
    tags: ["Cheapest", "Fast"],
    inputMode: "text",
    aspectRatios: ["16:9", "9:16", "1:1"],
    maxDuration: 5,
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    id: "luma-ray-flash",
    name: "Luma Ray Flash",
    provider: "replicate",
    providerLabel: "Replicate",
    replicateModel: "luma/ray-flash-2-720p",
    description: "Cinematic 720p clips with smooth motion and great scene understanding.",
    costEstimate: "~€0.02/video",
    costRaw: 0.02,
    quality: 4,
    speed: "30–60s",
    speedMs: 45000,
    tags: ["Best Value", "720p"],
    inputMode: "text",
    aspectRatios: ["16:9", "9:16", "1:1", "4:3"],
    maxDuration: 9,
    gradient: "from-blue-500 to-violet-600",
  },
  {
    id: "ltx-video",
    name: "LTX Video",
    provider: "fal",
    providerLabel: "Fal.ai",
    falModel: "fal-ai/ltx-video",
    description: "Real-time latent video generation — one of the fastest models available.",
    costEstimate: "~€0.01/video",
    costRaw: 0.01,
    quality: 3,
    speed: "10–20s",
    speedMs: 15000,
    tags: ["Real-time", "Free tier"],
    inputMode: "text",
    aspectRatios: ["16:9", "9:16", "1:1"],
    maxDuration: 5,
    gradient: "from-orange-500 to-pink-600",
  },
  {
    id: "kling-v1.6",
    name: "Kling v1.6",
    provider: "fal",
    providerLabel: "Fal.ai",
    falModel: "fal-ai/kling-video/v1.6/standard/text-to-video",
    description: "Premium 1080p clips with excellent motion quality and artistic control.",
    costEstimate: "~€0.04/video",
    costRaw: 0.04,
    quality: 5,
    speed: "60–120s",
    speedMs: 90000,
    tags: ["Premium Quality", "1080p"],
    inputMode: "text",
    aspectRatios: ["16:9", "9:16", "1:1"],
    maxDuration: 10,
    gradient: "from-rose-500 to-orange-500",
  },
  {
    id: "minimax-video",
    name: "MiniMax Video",
    provider: "fal",
    providerLabel: "Fal.ai",
    falModel: "fal-ai/minimax-video",
    description: "Highly creative text-to-video with vivid colours and strong narrative coherence.",
    costEstimate: "~€0.05/video",
    costRaw: 0.05,
    quality: 5,
    speed: "60–90s",
    speedMs: 75000,
    tags: ["Creative", "Vivid"],
    inputMode: "text",
    aspectRatios: ["16:9", "9:16"],
    maxDuration: 6,
    gradient: "from-purple-600 to-pink-600",
  },
  {
    id: "runway-gen4",
    name: "Runway Gen-4",
    provider: "runway",
    providerLabel: "RunwayML",
    description: "Hollywood-grade image-to-video with photorealistic motion and temporal consistency.",
    costEstimate: "~€0.25/video",
    costRaw: 0.25,
    quality: 5,
    speed: "30–60s",
    speedMs: 45000,
    tags: ["Hollywood Grade", "Best Quality"],
    inputMode: "image",
    aspectRatios: ["1280:720", "720:1280", "1104:832"],
    maxDuration: 10,
    gradient: "from-slate-600 to-slate-800",
  },
  {
    id: "sora",
    name: "OpenAI Sora",
    provider: "openai",
    providerLabel: "OpenAI",
    description: "OpenAI Sora 2 — state-of-the-art video generation. Duration: 4, 8, or 12 seconds.",
    costEstimate: "Sora 2 API",
    costRaw: 1,
    quality: 5,
    speed: "2–5 min",
    speedMs: 210000,
    tags: ["Flagship", "Premium"],
    inputMode: "text",
    aspectRatios: ["1280x720", "720x1280"],
    maxDuration: 12,
    gradient: "from-violet-600 to-purple-700",
  },
];

const PROVIDER_INFO: Record<string, { color: string; bg: string; docsUrl: string; keyName: string; signupUrl: string }> = {
  replicate: { color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800", docsUrl: "https://replicate.com/docs", keyName: "REPLICATE_API_TOKEN", signupUrl: "https://replicate.com/account/api-tokens" },
  fal:       { color: "text-orange-700 dark:text-orange-400",   bg: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800",   docsUrl: "https://fal.ai/docs",       keyName: "FAL_KEY",              signupUrl: "https://fal.ai/dashboard/keys" },
  runway:    { color: "text-slate-700 dark:text-slate-400",     bg: "bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-700",       docsUrl: "https://docs.runwayml.com", keyName: "RUNWAY_API_SECRET",    signupUrl: "https://app.runwayml.com/settings/api" },
  openai:    { color: "text-violet-700 dark:text-violet-400",   bg: "bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800",   docsUrl: "https://platform.openai.com", keyName: "OPENAI_API_KEY",    signupUrl: "https://platform.openai.com/api-keys" },
};

// ─── Types ────────────────────────────────────────────────────────────────────

type Tool = "video" | "image" | "text";
type InputMode = "text" | "image";
type JobStatus = "queued" | "in_progress" | "succeeded" | "failed";

interface VideoJob {
  id: string;
  status: JobStatus;
  url?: string;
  error?: string;
  prompt: string;
  modelId: string;
  startedAt: number;
  pollKey?: string;
}

interface GeneratedImage {
  url: string;
  prompt: string;
  revisedPrompt?: string;
  generatedAt: number;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function QualityStars({ n }: { n: number }) {
  return (
    <span className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={cn("w-2.5 h-2.5", i <= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
      ))}
    </span>
  );
}

function ProviderBadge({ provider }: { provider: string }) {
  const labels: Record<string, string> = { replicate: "Replicate", fal: "Fal.ai", runway: "RunwayML", openai: "OpenAI" };
  const colors: Record<string, string> = {
    replicate: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
    fal:       "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
    runway:    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400",
    openai:    "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400",
  };
  return <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide", colors[provider])}>{labels[provider]}</span>;
}

function JobStatusBadge({ status }: { status: JobStatus }) {
  const cfg = {
    queued:      { icon: Clock,        label: "Queued",      cls: "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/30" },
    in_progress: { icon: Loader2,      label: "Processing",  cls: "text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/30" },
    succeeded:   { icon: CheckCircle2, label: "Done",        cls: "text-green-600 bg-green-50 border-green-200 dark:bg-green-950/30" },
    failed:      { icon: XCircle,      label: "Failed",      cls: "text-red-600 bg-red-50 border-red-200 dark:bg-red-950/30" },
  }[status];
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0", cfg.cls)}>
      <Icon className={cn("w-3 h-3", status === "in_progress" && "animate-spin")} />
      {cfg.label}
    </span>
  );
}

function ModelCard({ model, selected, available, onClick }: {
  model: AIModel; selected: boolean; available: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col gap-3 p-4 rounded-2xl border-2 text-left transition-all min-w-[180px] w-[180px] flex-shrink-0",
        selected
          ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
          : "border-border hover:border-primary/40 hover:bg-muted/40",
        !available && "opacity-60"
      )}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-1">
        <div className={cn("w-8 h-8 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0", model.gradient)}>
          <Film className="w-4 h-4 text-white" />
        </div>
        {!available && (
          <span className="text-[9px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">No key</span>
        )}
        {selected && available && (
          <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
        )}
      </div>

      {/* Name + provider */}
      <div>
        <p className="font-bold text-sm text-foreground leading-tight">{model.name}</p>
        <ProviderBadge provider={model.provider} />
      </div>

      {/* Tags */}
      {model.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {model.tags.slice(0,2).map(tag => (
            <span key={tag} className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="space-y-1.5 border-t pt-2">
        <div className="flex items-center justify-between">
          <QualityStars n={model.quality} />
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Timer className="w-2.5 h-2.5" /> {model.speed}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <DollarSign className="w-2.5 h-2.5" /> {model.costEstimate}
        </div>
      </div>

      {selected && (
        <div className="absolute inset-0 rounded-2xl ring-2 ring-primary ring-offset-1 pointer-events-none" />
      )}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AIStudioPage() {
  const { toast } = useToast();
  const [activeTool, setActiveTool] = useState<Tool>("video");
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [selectedModelId, setSelectedModelId] = useState("wan-2.1");
  const [showApiSetup, setShowApiSetup] = useState(false);

  // Video state
  const [videoPrompt, setVideoPrompt] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [duration, setDuration] = useState(5);
  const [videoJobs, setVideoJobs] = useState<VideoJob[]>([]);
  const [videoLoading, setVideoLoading] = useState(false);
  const pollTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  // Image state
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageModel, setImageModel] = useState("gpt-image-1"); // gpt-image-1 | dall-e-3 | flux-1.1-pro
  const [imageSize, setImageSize] = useState("1024x1024");
  const [imageQuality, setImageQuality] = useState("high");
  const [imageStyle, setImageStyle] = useState("vivid");
  const [imageLoading, setImageLoading] = useState(false);
  const [images, setImages] = useState<GeneratedImage[]>([]);

  // Text state
  const [textPrompt, setTextPrompt] = useState("");
  const [textType, setTextType] = useState("caption");
  const [textLoading, setTextLoading] = useState(false);
  const [textResult, setTextResult] = useState("");
  const [textHistory, setTextHistory] = useState<{ type: string; prompt: string; result: string }[]>([]);

  // Provider availability
  const { data: providers } = useQuery<Record<string, boolean>>({
    queryKey: ["/api/admin/ai-studio/providers"],
    queryFn: async () => {
      const res = await apiRequest("/api/admin/ai-studio/providers", "GET");
      return res.json();
    },
    staleTime: 30000,
  });

  const serverSyncTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifiedJobs = useRef<Set<string>>(new Set());

  // Sync Sora jobs from server on mount and whenever there are pending Sora jobs
  const syncServerJobs = useCallback(async () => {
    try {
      const res = await apiRequest("/api/admin/ai-studio/jobs", "GET");
      const serverJobs: Array<{ id: string; status: string; url?: string; error?: string; prompt: string; modelId: string; startedAt: number }> = await res.json();
      if (!Array.isArray(serverJobs)) return;

      setVideoJobs(prev => {
        const merged = [...prev];
        for (const sj of serverJobs) {
          const existing = merged.find(j => j.id === sj.id);
          if (existing) {
            existing.status = sj.status as JobStatus;
            if (sj.url) existing.url = sj.url;
            if (sj.error) existing.error = sj.error;
          } else {
            merged.unshift({ id: sj.id, status: sj.status as JobStatus, url: sj.url, error: sj.error, prompt: sj.prompt, modelId: sj.modelId || "sora", startedAt: sj.startedAt || Date.now() });
          }
        }
        return merged;
      });

      // Notify when jobs complete
      for (const sj of serverJobs) {
        if (sj.status === "succeeded" && !notifiedJobs.current.has(sj.id)) {
          notifiedJobs.current.add(sj.id);
          toast({ title: "🎬 Sora video ready!", description: "Your video has finished generating." });
        }
      }

      const hasPending = serverJobs.some(j => j.status !== "succeeded" && j.status !== "failed");
      if (!hasPending && serverSyncTimer.current) {
        clearInterval(serverSyncTimer.current);
        serverSyncTimer.current = null;
      }
    } catch { /* silently ignore */ }
  }, [toast]);

  const syncServerJobsRef = useRef(syncServerJobs);
  useEffect(() => { syncServerJobsRef.current = syncServerJobs; }, [syncServerJobs]);

  useEffect(() => {
    syncServerJobsRef.current();
    return () => {
      if (serverSyncTimer.current) clearInterval(serverSyncTimer.current);
    };
  }, []);

  // Start polling server for Sora job updates
  const startServerSync = useCallback(() => {
    if (serverSyncTimer.current) return;
    serverSyncTimer.current = setInterval(syncServerJobs, 10000);
  }, [syncServerJobs]);

  useEffect(() => {
    const timers = pollTimers.current;
    return () => timers.forEach(t => clearInterval(t));
  }, []);

  const selectedModel = MODELS.find(m => m.id === selectedModelId) || MODELS[0];

  const isModelAvailable = useCallback((model: AIModel): boolean => {
    if (!providers) return false;
    if (model.id === "sora") return !!(providers as any).sora;
    return !!providers[model.provider];
  }, [providers]);

  const filteredModels = MODELS.filter(m =>
    inputMode === "text" ? m.inputMode !== "image" : m.inputMode !== "text"
  );

  // ── Image upload ────────────────────────────────────────────────────────────
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // ── Polling ─────────────────────────────────────────────────────────────────
  const startPolling = useCallback((job: VideoJob) => {
    const interval = setInterval(async () => {
      try {
        let res: Response;
        const model = MODELS.find(m => m.id === job.modelId);
        if (!model) return;

        if (model.provider === "replicate") {
          res = await apiRequest(`/api/admin/ai-studio/replicate/${job.id}`, "GET");
        } else if (model.provider === "fal") {
          res = await apiRequest(`/api/admin/ai-studio/fal/status?model=${encodeURIComponent(model.falModel!)}&requestId=${job.id}`, "GET");
        } else if (model.provider === "runway") {
          res = await apiRequest(`/api/admin/ai-studio/runway/${job.id}`, "GET");
        } else {
          res = await apiRequest(`/api/admin/ai-studio/video/${job.id}`, "GET");
        }

        const data = await res.json();
        setVideoJobs(prev => prev.map(j => j.id === job.id ? { ...j, ...data, status: data.status as JobStatus } : j));

        if (data.status === "succeeded" || data.status === "failed") {
          clearInterval(interval);
          pollTimers.current.delete(job.id);
          if (data.status === "succeeded") {
            toast({ title: "🎬 Video ready!", description: `Your ${model.name} video has been generated.` });
          }
        }
      } catch {
        clearInterval(interval);
        pollTimers.current.delete(job.id);
      }
    }, 6000);
    pollTimers.current.set(job.id, interval);
  }, [toast]);

  // ── Generate video ──────────────────────────────────────────────────────────
  const handleGenerateVideo = async () => {
    const model = selectedModel;
    if (!isModelAvailable(model)) {
      toast({ title: "API key missing", description: `Add ${PROVIDER_INFO[model.provider].keyName} to use ${model.name}.`, variant: "destructive" });
      setShowApiSetup(true);
      return;
    }
    if (inputMode === "text" && !videoPrompt.trim()) return;
    if (inputMode === "image" && !imagePreview) return;

    setVideoLoading(true);
    try {
      let res: Response;
      let jobId: string;

      if (model.provider === "replicate") {
        const input: any = {};
        if (inputMode === "text") {
          input.prompt = videoPrompt.trim();
        } else {
          input.image = imagePreview;
          if (videoPrompt.trim()) input.prompt = videoPrompt.trim();
        }
        const aspectMap: Record<string, string> = { "16:9": "1280:720", "9:16": "720:1280", "1:1": "720:720", "4:3": "960:720" };
        input.aspect_ratio = aspectMap[aspectRatio] || aspectRatio;
        input.duration = duration;

        res = await apiRequest("/api/admin/ai-studio/replicate/generate", "POST", {
          model: model.replicateModel,
          input,
        });
        const d = await res.json();
        if (d.error) throw new Error(d.error);
        jobId = d.predictionId;

      } else if (model.provider === "fal") {
        const input: any = { prompt: videoPrompt.trim() || "Urban culture video", aspect_ratio: aspectRatio, duration };
        if (inputMode === "image" && imagePreview) input.image_url = imagePreview;

        res = await apiRequest("/api/admin/ai-studio/fal/generate", "POST", {
          model: model.falModel,
          input,
        });
        const d = await res.json();
        if (d.error) throw new Error(d.error);
        jobId = d.requestId;

      } else if (model.provider === "runway") {
        const body: any = { model: "gen4_turbo", duration, ratio: aspectRatio };
        if (videoPrompt.trim()) body.promptText = videoPrompt.trim();
        if (imagePreview) body.promptImage = imagePreview;
        res = await apiRequest("/api/admin/ai-studio/runway/generate", "POST", body);
        const d = await res.json();
        if (d.error) throw new Error(d.error);
        jobId = d.taskId;

      } else {
        res = await apiRequest("/api/admin/ai-studio/video", "POST", {
          prompt: videoPrompt.trim(), size: aspectRatio, duration,
        });
        const d = await res.json();
        if (d.error) throw new Error(d.error);
        jobId = d.jobId;
      }

      const newJob: VideoJob = { id: jobId, status: "queued", prompt: videoPrompt || "Image-to-video", modelId: model.id, startedAt: Date.now() };
      setVideoJobs(prev => [newJob, ...prev]);
      if (model.id === "sora") {
        // Server handles polling — just sync periodically so we see updates when we return
        startServerSync();
      } else {
        startPolling(newJob);
      }
      toast({ title: "Generation started", description: `${model.name} is generating your video (${model.speed})` });
      setVideoPrompt("");

    } catch (err: any) {
      const msg = err.message || "Failed to start generation";
      toast({ title: "Generation failed", description: msg, variant: "destructive" });
    } finally {
      setVideoLoading(false);
    }
  };

  // ── Generate image ──────────────────────────────────────────────────────────
  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) return;
    setImageLoading(true);
    try {
      const res = await apiRequest("/api/admin/ai-studio/image", "POST", { prompt: imagePrompt, size: imageSize, quality: imageQuality, style: imageStyle, model: imageModel });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setImages(prev => [{ url: data.url, prompt: imagePrompt, revisedPrompt: data.revisedPrompt, generatedAt: Date.now() }, ...prev]);
      const modelNames: Record<string, string> = { "gpt-image-1": "GPT Image 1", "dall-e-3": "DALL-E 3", "flux-1.1-pro": "Flux 1.1 Pro" };
      toast({ title: `Image generated with ${modelNames[imageModel] || imageModel}!` });
      setImagePrompt("");
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setImageLoading(false);
    }
  };

  // ── Generate text ───────────────────────────────────────────────────────────
  const handleGenerateText = async () => {
    if (!textPrompt.trim()) return;
    setTextLoading(true);
    setTextResult("");
    try {
      const res = await apiRequest("/api/admin/ai-studio/text", "POST", { prompt: textPrompt, type: textType });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTextResult(data.text);
      setTextHistory(prev => [{ type: textType, prompt: textPrompt, result: data.text }, ...prev.slice(0, 9)]);
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setTextLoading(false);
    }
  };

  const copyText = (text: string) => { navigator.clipboard.writeText(text); toast({ title: "Copied!" }); };
  const downloadUrl = (url: string, name: string) => { const a = document.createElement("a"); a.href = url; a.download = name; a.target = "_blank"; a.click(); };

  const TEXT_TYPES = [
    { value: "caption",      label: "Caption",      icon: "📱", desc: "Social captions + hashtags" },
    { value: "announcement", label: "Announcement", icon: "📢", desc: "Event announcements" },
    { value: "email",        label: "Email",        icon: "✉️", desc: "Marketing email copy" },
    { value: "description",  label: "Description",  icon: "📍", desc: "Spot & venue descriptions" },
  ];

  const IMAGE_MODELS = [
    { id: "gpt-image-1", name: "GPT Image 1", badge: "⭐ Best", desc: "OpenAI's newest & highest quality model", gradient: "from-violet-500 to-purple-600", provider: "OpenAI" },
    { id: "flux-1.1-pro", name: "Flux 1.1 Pro", badge: "Photorealistic", desc: "Black Forest Labs — ultra-detailed realism", gradient: "from-orange-500 to-amber-500", provider: "Replicate" },
    { id: "dall-e-3", name: "DALL-E 3", badge: "Classic", desc: "OpenAI DALL-E 3 — supports vivid/natural style", gradient: "from-blue-500 to-cyan-500", provider: "OpenAI" },
  ];
  const GPT1_SIZES    = [{ v: "1024x1024", l: "Square", s: "1:1" }, { v: "1536x1024", l: "Landscape", s: "3:2" }, { v: "1024x1536", l: "Portrait", s: "2:3" }];
  const DALLE3_SIZES  = [{ v: "1024x1024", l: "Square", s: "1:1" }, { v: "1536x1024", l: "Landscape", s: "16:9" }, { v: "1024x1536", l: "Portrait", s: "9:16" }];
  const IMAGE_SIZES   = imageModel === "dall-e-3" ? DALLE3_SIZES : GPT1_SIZES;
  const IMAGE_STYLES  = [{ v: "vivid", l: "Vivid", d: "Bold & dramatic" }, { v: "natural", l: "Natural", d: "Subtle & realistic" }];
  const GPT1_QUALITIES  = [{ v: "medium", d: "Balanced" }, { v: "high", d: "Highest detail" }, { v: "low", d: "Fastest" }];
  const DALLE3_QUALITIES = [{ v: "standard", d: "Faster" }, { v: "high", d: "HD detail" }];
  const IMAGE_QUALITIES = imageModel === "dall-e-3" ? DALLE3_QUALITIES : GPT1_QUALITIES;
  const selectedImgModel = IMAGE_MODELS.find(m => m.id === imageModel) || IMAGE_MODELS[0];

  const configuredCount = providers ? Object.values(providers).filter(Boolean).length : 0;

  return (
    <AdminLayout>
      <div className="space-y-6 pb-10">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
              <Wand2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">AI Creative Studio</h1>
              <p className="text-sm text-muted-foreground">Generate videos, images, and copy with multiple AI models</p>
            </div>
          </div>
          <Button
            variant="outline" size="sm"
            onClick={() => setShowApiSetup(p => !p)}
            className={cn("gap-2 text-xs", showApiSetup && "border-primary text-primary")}
          >
            <Key className="w-3.5 h-3.5" />
            {configuredCount}/4 connected
          </Button>
        </div>

        {/* ── API Setup panel ─────────────────────────────────────────────── */}
        {showApiSetup && (
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-semibold text-sm text-foreground">Provider API Keys</h2>
              <span className="text-xs text-muted-foreground ml-auto">Add keys in Replit Secrets tab</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(PROVIDER_INFO).map(([key, info]) => {
                const isReady = providers?.[key];
                const labelMap: Record<string, string> = { openai: "OpenAI", replicate: "Replicate", fal: "Fal.ai", runway: "RunwayML" };
                return (
                  <div key={key} className={cn("flex items-center gap-3 p-3 rounded-xl border", info.bg)}>
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", isReady ? "bg-green-500" : "bg-muted")}>
                      {isReady ? <CheckCircle className="w-4 h-4 text-white" /> : <Circle className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs font-bold", info.color)}>{labelMap[key]}</p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">{info.keyName}</p>
                    </div>
                    <a href={info.signupUrl} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] text-primary hover:underline flex items-center gap-0.5 flex-shrink-0">
                      Get key <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                );
              })}
            </div>
            {/* Sora-specific setup guide */}
            <div className="rounded-xl border border-violet-200 bg-violet-50 dark:bg-violet-950/20 dark:border-violet-800 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center flex-shrink-0">
                  <Film className="w-3.5 h-3.5 text-white" />
                </div>
                <p className="text-xs font-bold text-violet-800 dark:text-violet-300">Sora Video Setup</p>
                {(providers as any)?.sora ? (
                  <span className="ml-auto text-[10px] font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Connected</span>
                ) : (
                  <span className="ml-auto text-[10px] font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Key needed</span>
                )}
              </div>
              <p className="text-[11px] text-violet-700 dark:text-violet-400 leading-relaxed">
                Sora video generation requires your personal OpenAI API key with Sora model access. ChatGPT Plus gives you access to Sora on the web — for the API, add credits at <strong>platform.openai.com</strong>.
              </p>
              <ol className="text-[11px] text-violet-700 dark:text-violet-400 space-y-1 list-decimal list-inside">
                <li>Go to <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline font-medium">platform.openai.com/api-keys</a> and create a new key</li>
                <li>Add API credits at <a href="https://platform.openai.com/settings/organization/billing" target="_blank" rel="noopener noreferrer" className="underline font-medium">Billing</a></li>
                <li>In Replit: open Secrets (🔒) → add <code className="bg-violet-100 dark:bg-violet-900/40 px-1 rounded font-mono">OPENAI_API_KEY</code></li>
              </ol>
            </div>
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              <strong>How to add other keys:</strong> Open the Secrets tab (🔒) in the left sidebar → click "New Secret" → paste the key name and value.
            </p>
          </div>
        )}

        {/* ── Tool selector ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: "video" as Tool, label: "Video",      icon: Video,    badge: `${MODELS.length} models`, gradient: "from-violet-500 to-purple-600" },
            { id: "image" as Tool, label: "Images",     icon: ImageIcon, badge: "GPT Image 1",             gradient: "from-violet-500 to-purple-600" },
            { id: "text"  as Tool, label: "Copy Writer", icon: Type,    badge: "GPT-4o",                  gradient: "from-green-500 to-emerald-500" },
          ].map(tool => {
            const Icon = tool.icon;
            return (
              <button key={tool.id} onClick={() => setActiveTool(tool.id)}
                className={cn(
                  "relative flex flex-col items-start gap-2 p-4 rounded-2xl border-2 transition-all text-left",
                  activeTool === tool.id ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40 hover:bg-muted/50"
                )}>
                <div className={cn("w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center", tool.gradient)}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-bold text-sm text-foreground">{tool.label}</p>
                  <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">{tool.badge}</span>
                </div>
                {activeTool === tool.id && <div className="absolute inset-0 rounded-2xl ring-2 ring-primary ring-offset-1 pointer-events-none" />}
              </button>
            );
          })}
        </div>

        {/* ── VIDEO TAB ──────────────────────────────────────────────────── */}
        {activeTool === "video" && (
          <div className="space-y-5">

            {/* Input mode toggle */}
            <div className="flex bg-muted rounded-xl p-1 gap-1 w-fit">
              {[
                { id: "text" as InputMode,  label: "Text → Video", icon: Type },
                { id: "image" as InputMode, label: "Image → Video", icon: ImageIcon },
              ].map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => { setInputMode(id); const valid = filteredModels.find(m => m.id === selectedModelId); if (!valid) setSelectedModelId(filteredModels[0]?.id || "wan-2.1"); }}
                  className={cn("flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                    inputMode === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>

            {/* Model selection */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Choose Model</label>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                {filteredModels.map(model => (
                  <ModelCard
                    key={model.id}
                    model={model}
                    selected={selectedModelId === model.id}
                    available={isModelAvailable(model)}
                    onClick={() => setSelectedModelId(model.id)}
                  />
                ))}
              </div>
            </div>

            {/* Model description */}
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-muted/50 border">
              <div className={cn("w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center flex-shrink-0", selectedModel.gradient)}>
                <Film className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-foreground">{selectedModel.name}</span>
                  <ProviderBadge provider={selectedModel.provider} />
                  {!isModelAvailable(selectedModel) && (
                    <span className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                      Needs API key
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedModel.description}</p>
              </div>
            </div>

            {/* Sora contextual setup note */}
            {selectedModel.id === "sora" && !(providers as any)?.sora && (
              <div className="flex items-start gap-3 p-4 rounded-xl border border-violet-200 bg-violet-50 dark:bg-violet-950/20 dark:border-violet-800">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-xs font-bold text-violet-800 dark:text-violet-300">Connect Sora to your ChatGPT Plus account</p>
                  <p className="text-[11px] text-violet-700 dark:text-violet-400 leading-relaxed">
                    Your ChatGPT Plus subscription gives you Sora on the web. To use the video API here, you also need an OpenAI API key from <strong>platform.openai.com</strong> with API credits added.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-lg transition-colors">
                      Get API Key <ExternalLink className="w-3 h-3" />
                    </a>
                    <button onClick={() => setShowApiSetup(true)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 dark:text-violet-300 border border-violet-300 dark:border-violet-700 px-3 py-1.5 rounded-lg hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors">
                      <Settings2 className="w-3 h-3" /> Setup guide
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Image upload (for image mode) */}
            {inputMode === "image" && (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Source Image</label>
                {imagePreview ? (
                  <div className="relative rounded-xl overflow-hidden border group">
                    <img src={imagePreview} alt="Source" className="w-full max-h-48 object-contain bg-black" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button size="sm" variant="secondary" onClick={() => { setImagePreview(null); setImageFile(null); }}>
                        Change Image
                      </Button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-32 rounded-xl border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors bg-muted/30 hover:bg-muted/50">
                    <Upload className="w-6 h-6 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground font-medium">Upload image</span>
                    <span className="text-xs text-muted-foreground">PNG, JPG, WEBP</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                )}
              </div>
            )}

            {/* Prompt */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">
                {inputMode === "image" ? "Motion Prompt (optional)" : "Video Prompt"}
              </label>
              <Textarea
                value={videoPrompt}
                onChange={e => setVideoPrompt(e.target.value)}
                placeholder={inputMode === "text"
                  ? "e.g. A breakdancer performing power moves on Amsterdam's Leidseplein at night, neon lights reflecting on wet pavement, cinematic slow motion..."
                  : "e.g. Slow camera push forward, soft wind movement..."}
                className="h-24 resize-none text-sm"
                data-testid="input-video-prompt"
              />
              <p className="text-xs text-muted-foreground">{videoPrompt.length}/500 chars — be specific about scene, lighting, camera movement for best results.</p>
            </div>

            {/* Settings row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wide">Aspect Ratio</label>
                <div className="flex flex-wrap gap-1.5">
                  {selectedModel.aspectRatios.map(r => (
                    <button key={r} onClick={() => setAspectRatio(r)}
                      className={cn("px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                        aspectRatio === r ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/50")}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wide">Duration: {duration}s</label>
                <input type="range" min={selectedModel.id === "sora" ? 4 : 3} max={selectedModel.maxDuration} step={selectedModel.id === "sora" ? 4 : 1} value={duration}
                  onChange={e => setDuration(Number(e.target.value))}
                  className="w-full accent-primary" />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{selectedModel.id === "sora" ? "4s" : "3s"}</span><span>{selectedModel.maxDuration}s</span>
                </div>
              </div>
            </div>

            {/* Generate button */}
            <Button
              onClick={handleGenerateVideo}
              disabled={videoLoading || (!videoPrompt.trim() && inputMode === "text") || (inputMode === "image" && !imagePreview)}
              className={cn("w-full h-12 text-white font-bold text-sm rounded-xl gap-2 bg-gradient-to-r hover:opacity-90 transition-opacity shadow-lg", selectedModel.gradient)}
              data-testid="button-generate-video"
            >
              {videoLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Starting generation…</>
                : <><Sparkles className="w-4 h-4" /> Generate with {selectedModel.name} · {selectedModel.costEstimate}</>
              }
            </Button>

            {/* Jobs gallery */}
            {videoJobs.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Generation Queue</h3>
                {videoJobs.map(job => {
                  const jobModel = MODELS.find(m => m.id === job.modelId);
                  const elapsed = Math.round((Date.now() - job.startedAt) / 1000);
                  return (
                    <div key={job.id} className="rounded-2xl border bg-card overflow-hidden">
                      {/* Job header */}
                      <div className="flex items-start gap-3 p-4">
                        <div className={cn("w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center flex-shrink-0", jobModel?.gradient || "from-muted to-muted")}>
                          <Film className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-xs font-semibold text-foreground">{jobModel?.name}</span>
                            {jobModel && <ProviderBadge provider={jobModel.provider} />}
                            <JobStatusBadge status={job.status} />
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1">{job.prompt}</p>
                        </div>
                      </div>

                      {(job.status === "queued" || job.status === "in_progress") && (
                        <div className="px-4 pb-4 space-y-2">
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: `${Math.min(95, (elapsed / (jobModel?.speedMs || 60000)) * 100)}%` }} />
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            Generating… {elapsed}s elapsed · Expected: {jobModel?.speed}
                          </p>
                        </div>
                      )}

                      {job.status === "succeeded" && job.url && (
                        <div className="px-4 pb-4 space-y-3">
                          <video src={job.url} controls className="w-full rounded-xl bg-black" style={{ maxHeight: 300 }} />
                          <div className="flex gap-2 flex-wrap">
                            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => downloadUrl(job.url!, `ai-video-${job.id.slice(0,8)}.mp4`)}>
                              <Download className="w-3 h-3" /> Download
                            </Button>
                            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => copyText(job.url!)}>
                              <Copy className="w-3 h-3" /> Copy URL
                            </Button>
                            <Button size="sm" className="gap-1.5 text-xs bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:opacity-90" onClick={() => { copyText(job.url!); toast({ title: "URL copied! Paste it when creating a Reel." }); }}>
                              <Share2 className="w-3 h-3" /> Publish to Reels
                            </Button>
                          </div>
                        </div>
                      )}

                      {job.status === "failed" && (
                        <div className="px-4 pb-4">
                          <p className="text-xs text-destructive bg-destructive/5 rounded-lg px-3 py-2">{job.error || "Generation failed"}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── IMAGE TAB ──────────────────────────────────────────────────── */}
        {activeTool === "image" && (
          <div className="space-y-5">

            {/* Model picker */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Image Model</label>
              <div className="grid grid-cols-3 gap-2">
                {IMAGE_MODELS.map(m => (
                  <button key={m.id} onClick={() => { setImageModel(m.id); setImageQuality(m.id === "dall-e-3" ? "standard" : "high"); setImageSize("1024x1024"); }}
                    className={cn("flex flex-col gap-1.5 p-3 rounded-2xl border-2 transition-all text-left",
                      imageModel === m.id ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40 hover:bg-muted/50")}>
                    <div className={cn("w-8 h-8 rounded-xl bg-gradient-to-br flex items-center justify-center", m.gradient)}>
                      <ImageIcon className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-xs text-foreground leading-tight">{m.name}</p>
                      <span className="text-[9px] font-bold text-primary bg-primary/10 px-1 py-0.5 rounded-full">{m.badge}</span>
                    </div>
                    {imageModel === m.id && <div className="absolute inset-0 rounded-2xl ring-2 ring-primary ring-offset-1 pointer-events-none" />}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">{selectedImgModel.desc} · <span className="font-medium">{selectedImgModel.provider}</span></p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Image Prompt</label>
              <Textarea value={imagePrompt} onChange={e => setImagePrompt(e.target.value)}
                placeholder="e.g. Urban graffiti artist painting a vibrant mural in Amsterdam, street photography, cinematic golden hour lighting, film grain..."
                className="h-28 resize-none text-sm" data-testid="input-image-prompt" />
            </div>

            <div className={cn("grid gap-3", imageModel === "dall-e-3" ? "grid-cols-3" : "grid-cols-2")}>
              {[
                { label: "Size", items: IMAGE_SIZES, value: imageSize, set: setImageSize, keyFn: (s: any) => s.v, labelFn: (s: any) => <><span className="font-semibold">{s.l}</span><span className="block text-[10px] opacity-70">{s.s}</span></> },
                ...(imageModel === "dall-e-3" ? [{ label: "Style", items: IMAGE_STYLES, value: imageStyle, set: setImageStyle, keyFn: (s: any) => s.v, labelFn: (s: any) => <><span className="font-semibold capitalize">{s.l}</span><span className="block text-[10px] opacity-70">{s.d}</span></> }] : []),
                { label: "Quality", items: IMAGE_QUALITIES, value: imageQuality, set: setImageQuality, keyFn: (s: any) => s.v, labelFn: (s: any) => <><span className="font-semibold capitalize">{s.v}</span><span className="block text-[10px] opacity-70">{s.d}</span></> },
              ].map(group => (
                <div key={group.label} className="space-y-2">
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wide">{group.label}</label>
                  <div className="flex flex-col gap-1.5">
                    {group.items.map((item: any) => (
                      <button key={group.keyFn(item)} onClick={() => group.set(group.keyFn(item))}
                        className={cn("px-3 py-2 rounded-xl text-xs border text-left transition-colors",
                          group.value === group.keyFn(item) ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/50")}>
                        {group.labelFn(item)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <Button onClick={handleGenerateImage} disabled={imageLoading || !imagePrompt.trim()}
              className={cn("w-full h-12 text-white font-bold rounded-xl gap-2 shadow-lg hover:opacity-90", `bg-gradient-to-r ${selectedImgModel.gradient}`)}
              data-testid="button-generate-image">
              {imageLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Sparkles className="w-4 h-4" /> Generate with {selectedImgModel.name}</>}
            </Button>

            {images.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Generated Images</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {images.map((img, i) => (
                    <div key={i} className="rounded-2xl border bg-card overflow-hidden group">
                      <div className="relative">
                        <img src={img.url} alt={img.prompt} className="w-full object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button size="sm" variant="secondary" onClick={() => downloadUrl(img.url, `image-${i+1}.png`)}><Download className="w-3 h-3 mr-1" /> Save</Button>
                          <Button size="sm" variant="secondary" onClick={() => copyText(img.url)}><Copy className="w-3 h-3 mr-1" /> URL</Button>
                        </div>
                      </div>
                      <div className="p-3">
                        <p className="text-xs font-medium text-foreground line-clamp-2">{img.prompt}</p>
                        {img.revisedPrompt && img.revisedPrompt !== img.prompt && (
                          <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2"><span className="font-medium">AI enhanced:</span> {img.revisedPrompt}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TEXT TAB ───────────────────────────────────────────────────── */}
        {activeTool === "text" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-2">
              {TEXT_TYPES.map(t => (
                <button key={t.value} onClick={() => setTextType(t.value)}
                  className={cn("flex items-start gap-2.5 p-3.5 rounded-2xl border-2 text-left transition-all",
                    textType === t.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}
                  data-testid={`button-text-type-${t.value}`}>
                  <span className="text-lg">{t.icon}</span>
                  <div>
                    <span className="text-sm font-bold text-foreground block">{t.label}</span>
                    <span className="text-[11px] text-muted-foreground">{t.desc}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Your Instructions</label>
              <Textarea value={textPrompt} onChange={e => setTextPrompt(e.target.value)}
                placeholder={
                  textType === "caption" ? "e.g. Caption for a breakdance battle at NDSM Wharf Amsterdam. High energy, Dutch+English street style." :
                  textType === "announcement" ? "e.g. Friday night skate session at Museumplein — free entry, starts 20:00, all skill levels." :
                  textType === "email" ? "e.g. Monthly newsletter intro about upcoming summer events in Rotterdam." :
                  "e.g. Rooftop bouldering gym in Amsterdam Noord with hip-hop music and urban vibe."
                }
                className="h-28 resize-none text-sm" data-testid="input-text-prompt" />
            </div>

            <Button onClick={handleGenerateText} disabled={textLoading || !textPrompt.trim()}
              className="w-full h-12 bg-gradient-to-r from-green-500 to-emerald-500 hover:opacity-90 text-white font-bold rounded-xl gap-2 shadow-lg shadow-green-500/20"
              data-testid="button-generate-text">
              {textLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Writing…</> : <><ZapIcon className="w-4 h-4" /> Generate with GPT-4o</>}
            </Button>

            {textResult && (
              <div className="p-4 rounded-2xl bg-muted border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Generated</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => copyText(textResult)}><Copy className="w-3 h-3 mr-1" /> Copy</Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={handleGenerateText} disabled={textLoading}><RefreshCw className="w-3 h-3 mr-1" /> Retry</Button>
                  </div>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{textResult}</p>
              </div>
            )}

            {textHistory.length > 1 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recent</h3>
                {textHistory.slice(1).map((item, i) => (
                  <div key={i} className="p-3 rounded-xl border bg-card space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-primary uppercase">{item.type}</span>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => copyText(item.result)}><Copy className="w-2.5 h-2.5 mr-1" /> Copy</Button>
                    </div>
                    <p className="text-xs text-foreground line-clamp-3 whitespace-pre-wrap">{item.result}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
