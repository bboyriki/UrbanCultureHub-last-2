import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Mic, Volume2, Play, Pause, Download, Trash2, RefreshCw,
  Sparkles, Wand2, Music, History, AlertCircle,
  Loader2, Upload, Copy, Check, Zap, Globe, Users, Clock,
  Star, Headphones, Radio, Film,
  BarChart3, Info, ExternalLink, SlidersHorizontal,
  StopCircle, Save, BookMarked, Cpu, Tag, FileAudio,
  ChevronDown, ChevronUp, Search, Filter, Layers, Plus,
  X, ArrowRight, Repeat, Gauge,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ELVoice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
  preview_url?: string;
  labels?: Record<string, string>;
  samples?: any[];
  fine_tuning?: { is_allowed_to_fine_tune: boolean };
  high_quality_base_model_ids?: string[];
  sharing?: { status: string };
}

interface ELModel {
  model_id: string;
  name: string;
  description: string;
  can_be_finetuned: boolean;
  can_do_text_to_speech: boolean;
  can_do_voice_conversion: boolean;
  languages: Array<{ language_id: string; name: string }>;
  token_cost_factor: number;
}

interface ELHistoryItem {
  history_item_id: string;
  voice_id: string;
  voice_name: string;
  model_id: string;
  text: string;
  date_unix: number;
  character_count_change_from: number;
  character_count_change_to: number;
  state: string;
  source: string;
  voice_category: string;
}

interface ELSubscription {
  tier: string;
  character_count: number;
  character_limit: number;
  voice_limit: number;
  voice_add_edit_counter: number;
  max_voice_add_edits: number;
  can_use_instant_voice_cloning: boolean;
  can_use_professional_voice_cloning: boolean;
  next_character_count_reset_unix: number;
  status: string;
  currency?: string;
}

interface TTSPreset {
  id: string;
  name: string;
  text: string;
  voiceId: string;
  modelId: string;
  stability: number;
  similarity: number;
  style: number;
  speed: number;
  speakerBoost: boolean;
  outputFormat: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const MODELS_FALLBACK = [
  { id: "eleven_multilingual_v2", name: "Multilingual v2", desc: "Best quality, 29 languages", cost: 1 },
  { id: "eleven_flash_v2_5", name: "Flash v2.5", desc: "Ultra-fast, low latency", cost: 0.5 },
  { id: "eleven_turbo_v2_5", name: "Turbo v2.5", desc: "Fast with good quality", cost: 0.5 },
  { id: "eleven_multilingual_v1", name: "Multilingual v1", desc: "Legacy multilingual", cost: 1 },
  { id: "eleven_monolingual_v1", name: "English v1", desc: "Original English model", cost: 1 },
];

const LANGUAGES = [
  "English", "Dutch", "German", "French", "Spanish", "Italian", "Portuguese",
  "Polish", "Hindi", "Arabic", "Turkish", "Russian", "Japanese", "Chinese", "Korean",
];

const SFX_CATEGORIES = {
  "Urban Culture": [
    "Hip-hop beat drop with heavy bass",
    "Crowd cheering at a street dance battle",
    "Vinyl record scratch DJ",
    "Breaking battle applause",
    "Urban street ambience Amsterdam",
    "Boombox playing outside",
  ],
  "Nature & Ambient": [
    "Rain on city streets at night",
    "Busy Amsterdam canal sounds",
    "Park ambience with birds",
    "Wind through urban buildings",
  ],
  "Events & Notifications": [
    "Notification chime — positive",
    "Countdown timer beep",
    "Audience applause large venue",
    "Event start fanfare",
  ],
  "Music & Beats": [
    "Heavy bass drop",
    "Snare drum rimshot",
    "Sub-bass wobble",
    "Cymbal crash",
  ],
};

const VOICE_DESC_TEMPLATES = [
  "Young Dutch male, Amsterdam accent, energetic and street-smart for urban culture",
  "Mature female Dutch narrator, warm, authoritative and professional",
  "Youthful hip-hop MC voice, charismatic, confident and expressive",
  "Professional Dutch event announcer, clear, dynamic and upbeat",
  "Calm Dutch podcast host, conversational and trustworthy",
  "Energetic female DJ host, enthusiastic and modern urban style",
];

// ── useAudioRecorder ──────────────────────────────────────────────────────────

function useAudioRecorder() {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start(100);
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch {
      throw new Error("Microphone access denied");
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const clearRecording = useCallback(() => {
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
  }, []);

  return { recording, audioBlob, audioUrl, duration, startRecording, stopRecording, clearRecording };
}

// ── Waveform Bars ─────────────────────────────────────────────────────────────

function WaveformBars({ active, count = 14 }: { active: boolean; count?: number }) {
  const heights = [3, 6, 10, 7, 12, 5, 9, 8, 11, 6, 10, 4, 8, 5];
  return (
    <div className="flex items-center gap-[2px]" style={{ height: 20 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="w-[2.5px] rounded-full bg-purple-400 transition-all"
          style={{
            height: active ? `${heights[i % heights.length]}px` : "3px",
            transitionDuration: "150ms",
            transitionDelay: `${i * 25}ms`,
            opacity: active ? 0.9 : 0.4,
            animation: active ? `barBounce 0.7s ease-in-out ${i * 0.06}s infinite alternate` : "none",
          }}
        />
      ))}
      <style>{`
        @keyframes barBounce {
          from { transform: scaleY(0.4); }
          to { transform: scaleY(1.2); }
        }
      `}</style>
    </div>
  );
}

// ── AudioPlayer ───────────────────────────────────────────────────────────────

function AudioPlayer({ b64, label, onDownload, compact }: {
  b64: string; label?: string; onDownload?: () => void; compact?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const src = `data:audio/mpeg;base64,${b64}`;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  const toggle = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(src);
      audioRef.current.addEventListener("timeupdate", () => {
        const a = audioRef.current!;
        setProgress(a.duration ? (a.currentTime / a.duration) * 100 : 0);
      });
      audioRef.current.addEventListener("loadedmetadata", () => setDuration(audioRef.current!.duration));
      audioRef.current.addEventListener("ended", () => { setPlaying(false); setProgress(0); });
    }
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !audioRef.current.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pct * audioRef.current.duration;
  };

  const download = () => {
    const a = document.createElement("a"); a.href = src;
    a.download = `${(label || "elevenlabs").replace(/[^a-z0-9]/gi, "-")}.mp3`; a.click();
    onDownload?.();
  };

  return (
    <div className={cn("flex items-center gap-3 bg-[#1a1033]/80 border border-purple-800/30 rounded-xl", compact ? "px-3 py-2" : "px-4 py-3")}>
      <button onClick={toggle} className="w-9 h-9 rounded-full bg-purple-600 hover:bg-purple-500 flex items-center justify-center text-white shrink-0 transition-colors">
        {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0 space-y-1.5">
        {label && !compact && <p className="text-[11px] text-purple-200 font-medium truncate">{label}</p>}
        <div className="flex items-center gap-2">
          <WaveformBars active={playing} count={12} />
          <div className="flex-1 relative h-1.5 bg-purple-900/60 rounded-full overflow-hidden cursor-pointer" onClick={seek}>
            <div className="absolute left-0 top-0 h-full bg-purple-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
        {duration > 0 && <p className="text-[10px] text-purple-500">{fmt(duration * progress / 100)} / {fmt(duration)}</p>}
      </div>
      <button onClick={download} className="w-8 h-8 rounded-lg bg-purple-900/40 hover:bg-purple-800/60 flex items-center justify-center text-purple-300 transition-colors shrink-0">
        <Download className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── VoiceCard ─────────────────────────────────────────────────────────────────

function VoiceCard({ voice, onSelect, onPreview, selected, previewing, showDelete, onDelete }: {
  voice: ELVoice; onSelect?: (v: ELVoice) => void; onPreview?: (v: ELVoice) => void;
  selected?: boolean; previewing?: boolean; showDelete?: boolean; onDelete?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const accent = voice.labels?.accent || "";
  const gender = voice.labels?.gender || "";
  const age = voice.labels?.age || "";
  const useCase = voice.labels?.use_case || "";
  const language = voice.labels?.language || "";
  const desc = voice.description || [gender, accent, age].filter(Boolean).join(" · ");

  const catColor: Record<string, string> = {
    premade: "bg-blue-900/40 text-blue-300 border-blue-700/40",
    cloned: "bg-purple-900/40 text-purple-300 border-purple-700/40",
    professional: "bg-amber-900/40 text-amber-300 border-amber-700/40",
    generated: "bg-emerald-900/40 text-emerald-300 border-emerald-700/40",
  };

  return (
    <div className={cn(
      "group rounded-2xl border p-4 cursor-pointer transition-all duration-200",
      selected ? "border-purple-500 bg-purple-900/30 ring-1 ring-purple-500" : "border-purple-800/30 bg-[#1a1033]/50 hover:border-purple-600/50 hover:bg-[#1a1033]/80"
    )} onClick={() => onSelect?.(voice)}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0", selected ? "bg-purple-600" : "bg-purple-900/60")}>
            <Mic className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-white truncate">{voice.name}</p>
            {desc && <p className="text-[10px] text-purple-400 truncate">{desc}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className={cn("text-[9px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wide", catColor[voice.category] || "bg-gray-900/40 text-gray-300 border-gray-700/40")}>
            {voice.category}
          </span>
          {showDelete && voice.category === "cloned" && (
            <button onClick={e => { e.stopPropagation(); onDelete?.(voice.voice_id); }}
              className="w-5 h-5 rounded flex items-center justify-center text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {language && <div className="flex items-center gap-1 mb-2"><Tag className="w-2.5 h-2.5 text-purple-500" /><span className="text-[9px] text-purple-500 uppercase tracking-wider">{language}</span></div>}
      {useCase && <p className="text-[10px] text-purple-400 mb-2 truncate">💼 {useCase}</p>}

      {expanded && (
        <div className="mt-2 mb-2 space-y-1 text-[10px] text-purple-500 bg-purple-950/40 rounded-lg p-2">
          <p className="font-mono text-purple-600 break-all">{voice.voice_id}</p>
          {Object.entries(voice.labels || {}).map(([k, v]) => (
            <p key={k}><span className="text-purple-600 capitalize">{k}:</span> {v}</p>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5 mt-3">
        <button onClick={e => { e.stopPropagation(); onPreview?.(voice); }}
          className={cn("flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors",
            previewing ? "bg-purple-600 text-white" : "bg-purple-900/40 text-purple-300 hover:bg-purple-800/60")}>
          {previewing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
          {previewing ? "Loading…" : "Preview"}
        </button>
        <button onClick={e => { e.stopPropagation(); setExpanded(x => !x); }}
          className="w-7 h-7 rounded-lg bg-purple-900/30 flex items-center justify-center text-purple-500 hover:text-purple-300 transition-colors">
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        {selected && (
          <div className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center">
            <Check className="w-3.5 h-3.5 text-white" />
          </div>
        )}
      </div>
    </div>
  );
}

// ── ModelCard ─────────────────────────────────────────────────────────────────

function ModelCard({ model, onSelect }: { model: ELModel; onSelect?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-[#1a1033]/50 border border-purple-800/30 rounded-2xl p-4 hover:border-purple-600/40 transition-all">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-900/60 flex items-center justify-center">
            <Cpu className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-white">{model.name}</p>
            <p className="text-[10px] text-purple-500 font-mono">{model.model_id}</p>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          {model.can_do_text_to_speech && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-900/40 text-blue-300 border border-blue-800/30">TTS</span>}
          {model.can_do_voice_conversion && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-900/40 text-emerald-300 border border-emerald-800/30">S2S</span>}
          {model.can_be_finetuned && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-900/40 text-amber-300 border border-amber-800/30">Finetune</span>}
        </div>
      </div>
      <p className="text-[11px] text-purple-400 mb-3 leading-relaxed">{model.description}</p>
      <div className="flex items-center justify-between text-[10px] text-purple-500 mb-2">
        <span>Cost factor: ×{model.token_cost_factor}</span>
        <span>{model.languages?.length || 0} languages</span>
      </div>
      {model.languages?.length > 0 && (
        <>
          <div className="flex flex-wrap gap-1">
            {(expanded ? model.languages : model.languages.slice(0, 8)).map(l => (
              <span key={l.language_id} className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-900/30 text-purple-400 border border-purple-800/20">{l.name}</span>
            ))}
            {!expanded && model.languages.length > 8 && (
              <button onClick={() => setExpanded(true)} className="text-[9px] text-purple-500 hover:text-purple-300 px-1.5 py-0.5">+{model.languages.length - 8} more</button>
            )}
          </div>
        </>
      )}
      {onSelect && (
        <Button size="sm" className="w-full mt-3 bg-purple-700/50 hover:bg-purple-600 text-white text-[11px] h-8" onClick={onSelect}>
          Use this model <ArrowRight className="w-3 h-3 ml-1" />
        </Button>
      )}
    </div>
  );
}

// ── Error Parser ─────────────────────────────────────────────────────────────

function parseELError(err: any): string {
  const raw: string = err?.message || String(err);
  try {
    // Format from throwIfResNotOk: "401: {...json...}"
    const jsonStart = raw.indexOf("{");
    if (jsonStart >= 0) {
      const parsed = JSON.parse(raw.slice(jsonStart));
      // ElevenLabs wraps errors: { error, detail: { detail: { status, message } } }
      const inner = parsed?.detail?.detail || parsed?.detail || {};
      if (inner?.status === "quota_exceeded" || inner?.message?.includes("quota")) {
        const remaining = inner.message?.match(/(\d+) credits remaining/)?.[1];
        const required = inner.message?.match(/(\d+) credits are required/)?.[1];
        if (remaining && required) {
          return `Quota exceeded — ${required} credits needed but only ${remaining} remaining. Shorten your text or upgrade your ElevenLabs plan.`;
        }
        return `Quota exceeded: ${inner.message || "Not enough credits"}`;
      }
      if (inner?.message) return inner.message;
      if (parsed?.error && parsed.error !== "TTS failed") return parsed.error;
    }
  } catch { /* fall through */ }
  // Strip the leading "401: " / "403: " status prefix for cleaner display
  return raw.replace(/^\d{3}:\s*/, "").slice(0, 200);
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ElevenLabsAdminPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");

  // TTS state
  const [ttsText, setTtsText] = useState("");
  const [ttsVoiceId, setTtsVoiceId] = useState("");
  const [ttsModel, setTtsModel] = useState("eleven_multilingual_v2");
  const [ttsStability, setTtsStability] = useState([0.5]);
  const [ttsSimilarity, setTtsSimilarity] = useState([0.75]);
  const [ttsStyle, setTtsStyle] = useState([0.0]);
  const [ttsSpeed, setTtsSpeed] = useState([1.0]);
  const [ttsSpeakerBoost, setTtsSpeakerBoost] = useState(true);
  const [ttsOutputFormat, setTtsOutputFormat] = useState("mp3_44100_128");
  const [ttsAudio, setTtsAudio] = useState<string | null>(null);
  const [ttsCharCost, setTtsCharCost] = useState<number | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presets, setPresets] = useState<TTSPreset[]>(() => {
    try { return JSON.parse(localStorage.getItem("el-tts-presets") || "[]"); } catch { return []; }
  });

  // Batch TTS
  const [batchMode, setBatchMode] = useState(false);
  const [batchTexts, setBatchTexts] = useState("Text line 1\nText line 2\nText line 3");
  const [batchResults, setBatchResults] = useState<Array<{ text: string; audio?: string; error?: string }>>([]);
  const [batchRunning, setBatchRunning] = useState(false);

  // Voice Library state
  const [voiceFilter, setVoiceFilter] = useState("all");
  const [voiceSearch, setVoiceSearch] = useState("");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [previewAudios, setPreviewAudios] = useState<Record<string, string>>({});
  const [voiceView, setVoiceView] = useState<"grid" | "list">("grid");

  // Voice Cloning state
  const [cloneName, setCloneName] = useState("");
  const [cloneDesc, setCloneDesc] = useState("");
  const [cloneFiles, setCloneFiles] = useState<File[]>([]);
  const cloneInputRef = useRef<HTMLInputElement>(null);
  const cloneRecorder = useAudioRecorder();

  // Sound Effects state
  const [sfxText, setSfxText] = useState("");
  const [sfxDuration, setSfxDuration] = useState("");
  const [sfxInfluence, setSfxInfluence] = useState([0.3]);
  const [sfxAudio, setSfxAudio] = useState<string | null>(null);
  const [sfxCategory, setSfxCategory] = useState<string>("Urban Culture");

  // Speech-to-Speech state
  const [s2sVoiceId, setS2sVoiceId] = useState("");
  const [s2sFile, setS2sFile] = useState<File | null>(null);
  const [s2sAudio, setS2sAudio] = useState<string | null>(null);
  const s2sInputRef = useRef<HTMLInputElement>(null);
  const s2sRecorder = useAudioRecorder();

  // Voice Design state
  const [vdDescription, setVdDescription] = useState("");
  const [vdText, setVdText] = useState("");
  const [vdResult, setVdResult] = useState<any>(null);
  const [vdSaveName, setVdSaveName] = useState("");
  const [vdSavingId, setVdSavingId] = useState<string | null>(null);

  // Dubbing state
  const [dubSourceUrl, setDubSourceUrl] = useState("");
  const [dubTargetLang, setDubTargetLang] = useState("nl");
  const [dubSourceLang, setDubSourceLang] = useState("auto");
  const [dubName, setDubName] = useState("");
  const [dubNumSpeakers, setDubNumSpeakers] = useState("0");
  const [dubFile, setDubFile] = useState<File | null>(null);
  const [dubResult, setDubResult] = useState<any>(null);
  const dubInputRef = useRef<HTMLInputElement>(null);

  // History state
  const [historySearch, setHistorySearch] = useState("");
  const [historySource, setHistorySource] = useState("all");
  const [historyAudios, setHistoryAudios] = useState<Record<string, string>>({});
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<Set<string>>(new Set());

  // ── Queries ───────────────────────────────────────────────────────────────────

  const fetchEl = async (path: string) => {
    const r = await fetch(path, { credentials: "include" });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e as any).error || `Error ${r.status}`); }
    return r.json();
  };

  const { data: statusData, isLoading: statusLoading, refetch: refetchStatus, isError: statusError } = useQuery<any>({
    queryKey: ["/api/admin/elevenlabs/status"],
    queryFn: async () => {
      try {
        const r = await fetch("/api/admin/elevenlabs/status", { credentials: "include" });
        return r.json();
      } catch { return { ok: false, error: "Network error" }; }
    },
    staleTime: 60_000,
    retry: 1,
  });

  const { data: voicesData, isLoading: voicesLoading, refetch: refetchVoices } = useQuery<{ voices: ELVoice[] }>({
    queryKey: ["/api/admin/elevenlabs/voices"],
    queryFn: () => fetchEl("/api/admin/elevenlabs/voices"),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const { data: modelsData, isLoading: modelsLoading } = useQuery<ELModel[]>({
    queryKey: ["/api/admin/elevenlabs/models"],
    queryFn: () => fetchEl("/api/admin/elevenlabs/models"),
    staleTime: 60 * 60_000,
    retry: 1,
  });

  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useQuery<{ history: ELHistoryItem[]; has_more: boolean }>({
    queryKey: ["/api/admin/elevenlabs/history"],
    queryFn: () => fetchEl("/api/admin/elevenlabs/history?page_size=50"),
    enabled: activeTab === "history",
    staleTime: 30_000,
    retry: 1,
  });

  const voices = voicesData?.voices || [];
  const models: ELModel[] = Array.isArray(modelsData) ? modelsData : [];
  const subscription: ELSubscription | undefined = statusData?.subscription;
  const connected = statusData?.ok === true;

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const ttsMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("/api/admin/elevenlabs/tts", "POST", {
        voiceId: ttsVoiceId, text: ttsText, modelId: ttsModel, outputFormat: ttsOutputFormat,
        voiceSettings: { stability: ttsStability[0], similarity_boost: ttsSimilarity[0], style: ttsStyle[0], use_speaker_boost: ttsSpeakerBoost, speed: ttsSpeed[0] },
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e as any).error || "TTS failed"); }
      return r.json();
    },
    onSuccess: (data: any) => {
      setTtsAudio(data.audio);
      setTtsCharCost(data.characters);
      toast({ title: "Audio generated!", description: `${data.characters} characters used` });
    },
    onError: (err: any) => toast({ title: "TTS Error", description: parseELError(err), variant: "destructive" }),
  });

  const sfxMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("/api/admin/elevenlabs/sound-effects", "POST", {
        text: sfxText, durationSeconds: sfxDuration ? parseFloat(sfxDuration) : null, promptInfluence: sfxInfluence[0],
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e as any).error || "SFX failed"); }
      return r.json();
    },
    onSuccess: (data: any) => { setSfxAudio(data.audio); toast({ title: "Sound effect generated!" }); },
    onError: (err: any) => toast({ title: "SFX Error", description: parseELError(err), variant: "destructive" }),
  });

  const deleteHistoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest(`/api/admin/elevenlabs/history/${id}`, "DELETE");
      return r.json().catch(() => ({ ok: true }));
    },
    onSuccess: () => { refetchHistory(); toast({ title: "Deleted" }); },
    onError: (err: any) => toast({ title: "Error", description: parseELError(err), variant: "destructive" }),
  });

  const cloneMutation = useMutation({
    mutationFn: async () => {
      if (!cloneName) throw new Error("Voice name required");
      const files = cloneFiles.length > 0 ? cloneFiles :
        cloneRecorder.audioBlob ? [new File([cloneRecorder.audioBlob], "recording.webm", { type: "audio/webm" })] : [];
      if (files.length === 0) throw new Error("Audio files or recording required");
      const fd = new FormData();
      fd.append("name", cloneName);
      if (cloneDesc) fd.append("description", cloneDesc);
      files.forEach(f => fd.append("files", f, f.name));
      const r = await fetch("/api/admin/elevenlabs/voices/clone", { method: "POST", body: fd, credentials: "include" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Clone failed");
      return d;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/elevenlabs/voices"] });
      setCloneName(""); setCloneDesc(""); setCloneFiles([]); cloneRecorder.clearRecording();
      toast({ title: "Voice cloned!", description: `Voice ID: ${data.voice_id}` });
    },
    onError: (err: any) => toast({ title: "Clone Error", description: parseELError(err), variant: "destructive" }),
  });

  const deleteVoiceMutation = useMutation({
    mutationFn: async (voiceId: string) => {
      const r = await apiRequest(`/api/admin/elevenlabs/voices/${voiceId}`, "DELETE");
      return r.json().catch(() => ({ ok: true }));
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/elevenlabs/voices"] }); toast({ title: "Voice deleted" }); },
    onError: (err: any) => toast({ title: "Error", description: parseELError(err), variant: "destructive" }),
  });

  const s2sMutation = useMutation({
    mutationFn: async () => {
      if (!s2sVoiceId) throw new Error("Voice required");
      const file = s2sFile || (s2sRecorder.audioBlob ? new File([s2sRecorder.audioBlob], "recording.webm", { type: "audio/webm" }) : null);
      if (!file) throw new Error("Audio file or recording required");
      const fd = new FormData();
      fd.append("voiceId", s2sVoiceId);
      fd.append("audio", file, file.name);
      const r = await fetch("/api/admin/elevenlabs/speech-to-speech", { method: "POST", body: fd, credentials: "include" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      return d;
    },
    onSuccess: (data: any) => { setS2sAudio(data.audio); toast({ title: "Speech-to-Speech complete!" }); },
    onError: (err: any) => toast({ title: "Error", description: parseELError(err), variant: "destructive" }),
  });

  const vdMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("/api/admin/elevenlabs/voice-design/generate", "POST", {
        voiceDescription: vdDescription, text: vdText || undefined,
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e as any).error || "Voice design failed"); }
      return r.json();
    },
    onSuccess: (data: any) => { setVdResult(data); toast({ title: "Voice design generated!" }); },
    onError: (err: any) => toast({ title: "Error", description: parseELError(err), variant: "destructive" }),
  });

  const vdSaveMutation = useMutation({
    mutationFn: async (generated_voice_id: string) => {
      if (!vdSaveName.trim()) throw new Error("Name required");
      const r = await apiRequest("/api/admin/elevenlabs/voice-design/save", "POST", {
        generated_voice_id, voice_name: vdSaveName, voice_description: vdDescription,
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e as any).error || "Save failed"); }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/elevenlabs/voices"] });
      setVdSaveName(""); setVdSavingId(null);
      toast({ title: "Voice saved to library!" });
    },
    onError: (err: any) => toast({ title: "Error", description: parseELError(err), variant: "destructive" }),
  });

  const dubMutation = useMutation({
    mutationFn: async () => {
      if (!dubSourceUrl && !dubFile) throw new Error("URL or file required");
      const fd = new FormData();
      fd.append("target_lang", dubTargetLang);
      if (dubName) fd.append("name", dubName);
      if (dubNumSpeakers !== "0") fd.append("num_speakers", dubNumSpeakers);
      if (dubSourceUrl) fd.append("source_url", dubSourceUrl);
      if (dubSourceLang !== "auto") fd.append("source_lang", dubSourceLang);
      if (dubFile) fd.append("file", dubFile, dubFile.name);
      const r = await fetch("/api/admin/elevenlabs/dubbing", { method: "POST", body: fd, credentials: "include" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Dubbing failed");
      return d;
    },
    onSuccess: (data: any) => { setDubResult(data); toast({ title: "Dubbing job created!", description: `ID: ${data.dubbing_id}` }); },
    onError: (err: any) => toast({ title: "Error", description: parseELError(err), variant: "destructive" }),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────────

  const previewVoice = async (voice: ELVoice) => {
    if (previewAudios[voice.voice_id]) {
      new Audio(`data:audio/mpeg;base64,${previewAudios[voice.voice_id]}`).play(); return;
    }
    setPreviewingVoiceId(voice.voice_id);
    try {
      const r = await fetch("/api/admin/elevenlabs/preview", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId: voice.voice_id }),
      });
      const d = await r.json();
      if (d.audio) {
        setPreviewAudios(prev => ({ ...prev, [voice.voice_id]: d.audio }));
        new Audio(`data:audio/mpeg;base64,${d.audio}`).play();
      }
    } catch { toast({ title: "Preview failed", variant: "destructive" }); }
    finally { setPreviewingVoiceId(null); }
  };

  const playHistoryItem = async (id: string) => {
    if (historyAudios[id]) { new Audio(`data:audio/mpeg;base64,${historyAudios[id]}`).play(); return; }
    setHistoryLoadingId(id);
    try {
      const r = await fetch(`/api/admin/elevenlabs/history/${id}/audio`, { credentials: "include" });
      const d = await r.json();
      if (d.audio) { setHistoryAudios(prev => ({ ...prev, [id]: d.audio })); new Audio(`data:audio/mpeg;base64,${d.audio}`).play(); }
    } catch { toast({ title: "Playback failed", variant: "destructive" }); }
    finally { setHistoryLoadingId(null); }
  };

  const savePreset = () => {
    if (!presetName.trim()) return;
    const preset: TTSPreset = {
      id: Date.now().toString(), name: presetName,
      text: ttsText, voiceId: ttsVoiceId, modelId: ttsModel,
      stability: ttsStability[0], similarity: ttsSimilarity[0], style: ttsStyle[0],
      speed: ttsSpeed[0], speakerBoost: ttsSpeakerBoost, outputFormat: ttsOutputFormat,
    };
    const updated = [...presets, preset];
    setPresets(updated);
    localStorage.setItem("el-tts-presets", JSON.stringify(updated));
    setPresetName(""); setShowPresets(false);
    toast({ title: "Preset saved!", description: preset.name });
  };

  const loadPreset = (p: TTSPreset) => {
    setTtsText(p.text); setTtsVoiceId(p.voiceId); setTtsModel(p.modelId);
    setTtsStability([p.stability]); setTtsSimilarity([p.similarity]); setTtsStyle([p.style]);
    setTtsSpeed([p.speed]); setTtsSpeakerBoost(p.speakerBoost); setTtsOutputFormat(p.outputFormat);
    setShowPresets(false); toast({ title: "Preset loaded!", description: p.name });
  };

  const deletePreset = (id: string) => {
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated);
    localStorage.setItem("el-tts-presets", JSON.stringify(updated));
  };

  const runBatchTTS = async () => {
    const lines = batchTexts.split("\n").map(t => t.trim()).filter(Boolean);
    if (!lines.length || !ttsVoiceId) { toast({ title: "Add texts and select a voice", variant: "destructive" }); return; }
    setBatchRunning(true);
    setBatchResults(lines.map(text => ({ text })));
    for (let i = 0; i < lines.length; i++) {
      try {
        const r = await fetch("/api/admin/elevenlabs/tts", {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            voiceId: ttsVoiceId, text: lines[i], modelId: ttsModel, outputFormat: ttsOutputFormat,
            voiceSettings: { stability: ttsStability[0], similarity_boost: ttsSimilarity[0], style: ttsStyle[0], use_speaker_boost: ttsSpeakerBoost, speed: ttsSpeed[0] },
          }),
        });
        const d = await r.json();
        setBatchResults(prev => prev.map((item, idx) => idx === i ? { ...item, audio: d.audio } : item));
      } catch {
        setBatchResults(prev => prev.map((item, idx) => idx === i ? { ...item, error: "Failed" } : item));
      }
    }
    setBatchRunning(false);
  };

  const filteredVoices = voices.filter(v => {
    const matchesCat = voiceFilter === "all" || v.category === voiceFilter;
    const matchesSearch = !voiceSearch || v.name.toLowerCase().includes(voiceSearch.toLowerCase()) ||
      (v.labels && Object.values(v.labels).join(" ").toLowerCase().includes(voiceSearch.toLowerCase()));
    const matchesLang = languageFilter === "all" || (v.labels?.language || "").toLowerCase().includes(languageFilter.toLowerCase());
    return matchesCat && matchesSearch && matchesLang;
  });

  const filteredHistory = (historyData?.history || []).filter(item => {
    const matchesSearch = !historySearch || item.text?.toLowerCase().includes(historySearch.toLowerCase()) ||
      item.voice_name?.toLowerCase().includes(historySearch.toLowerCase());
    const matchesSource = historySource === "all" || item.source === historySource;
    return matchesSearch && matchesSource;
  });

  const usagePct = subscription ? Math.round((subscription.character_count / subscription.character_limit) * 100) : 0;
  const resetDate = subscription?.next_character_count_reset_unix ? new Date(subscription.next_character_count_reset_unix * 1000) : null;
  const ttsModels = models.filter(m => m.can_do_text_to_speech);
  const s2sModels = models.filter(m => m.can_do_voice_conversion);
  const remainingChars = subscription ? subscription.character_limit - subscription.character_count : null;

  const panel = "bg-[#120c24] border border-purple-900/40 rounded-2xl";

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0d0820] text-white">

      {/* Header */}
      <div className="border-b border-purple-900/40 bg-gradient-to-r from-[#1a0d35] via-[#120c24] to-[#0d0820] px-6 py-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-purple-900/40">
              <Volume2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">ElevenLabs Studio</h1>
              <p className="text-[11px] text-purple-400">AI Voice · TTS · Cloning · Dubbing · Urban Culture Hub</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {statusLoading ? (
              <div className="flex items-center gap-2 text-purple-400 text-[12px]"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Connecting…</div>
            ) : connected ? (
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-900/40 text-emerald-400 border border-emerald-700/40 px-3 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse inline-block" /> Connected
                </Badge>
                {subscription && (
                  <span className="text-[11px] text-purple-400 capitalize font-medium">{subscription.tier} Plan</span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Badge className="bg-red-900/40 text-red-400 border border-red-700/40 px-3 py-1">
                  <AlertCircle className="w-3 h-3 mr-1" /> {statusData?.error || "Not Connected"}
                </Badge>
                <Button size="sm" variant="ghost" onClick={() => refetchStatus()} className="text-purple-400 h-8 text-[11px]">
                  <RefreshCw className="w-3 h-3 mr-1" /> Retry
                </Button>
              </div>
            )}
            <a href="https://elevenlabs.io" target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-[11px] text-purple-500 hover:text-purple-300 transition-colors">
              elevenlabs.io <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Usage bar */}
        {subscription && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-purple-400">Character Usage</span>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-purple-300 font-medium">
                    {subscription.character_count.toLocaleString()} / {subscription.character_limit.toLocaleString()}
                  </span>
                  <span className={cn("text-[10px] font-medium", usagePct > 80 ? "text-red-400" : "text-purple-500")}>{usagePct}%</span>
                </div>
              </div>
              <div className="h-2.5 rounded-full bg-purple-900/60 overflow-hidden">
                <div className={cn("h-full rounded-full transition-all duration-700", usagePct > 80 ? "bg-red-500" : usagePct > 60 ? "bg-amber-500" : "bg-gradient-to-r from-purple-500 to-indigo-500")}
                  style={{ width: `${Math.min(usagePct, 100)}%` }} />
              </div>
              {resetDate && <p className="text-[10px] text-purple-600 mt-1">Resets {format(resetDate, "MMMM d, yyyy")}</p>}
              {remainingChars !== null && remainingChars <= 100 && (
                <div className="flex items-center gap-1.5 mt-1">
                  <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                  <p className="text-[10px] text-red-400 font-medium">
                    Only {remainingChars} credits left — upgrade at <a href="https://elevenlabs.io/subscription" target="_blank" rel="noreferrer" className="underline hover:text-red-300">elevenlabs.io/subscription</a>
                  </p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-around gap-2">
              <div className="text-center">
                <p className="text-lg font-bold text-white">{voices.filter(v => v.category === "cloned").length}</p>
                <p className="text-[9px] text-purple-500 uppercase tracking-wide">Cloned Voices</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-white">{remainingChars?.toLocaleString() || "—"}</p>
                <p className="text-[9px] text-purple-500 uppercase tracking-wide">Chars Left</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-white">{voices.length}</p>
                <p className="text-[9px] text-purple-500 uppercase tracking-wide">Total Voices</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <div className="px-6 pt-4 pb-0 border-b border-purple-900/30 overflow-x-auto">
          <TabsList className="bg-transparent border-0 p-0 h-auto gap-0 flex min-w-max">
            {[
              { id: "overview", icon: BarChart3, label: "Overview" },
              { id: "tts", icon: Volume2, label: "TTS Studio" },
              { id: "voices", icon: Mic, label: "Voices" },
              { id: "clone", icon: Users, label: "Clone Voice" },
              { id: "sfx", icon: Music, label: "Sound FX" },
              { id: "s2s", icon: Radio, label: "Speech→Speech" },
              { id: "design", icon: Wand2, label: "Voice Design" },
              { id: "dubbing", icon: Globe, label: "Dubbing" },
              { id: "models", icon: Cpu, label: "Models" },
              { id: "history", icon: History, label: "History" },
            ].map(tab => (
              <TabsTrigger key={tab.id} value={tab.id}
                className="text-[11px] font-medium px-4 py-3 rounded-none border-b-2 data-[state=active]:border-purple-500 data-[state=active]:text-white border-transparent text-purple-500 hover:text-purple-300 transition-all flex items-center gap-1.5 shrink-0">
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="px-6 py-6">

          {/* ── OVERVIEW ──────────────────────────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-5 mt-0">
            {statusLoading ? (
              <div className="flex items-center justify-center py-24"><Loader2 className="w-7 h-7 animate-spin text-purple-500" /></div>
            ) : !connected ? (
              <div className={cn(panel, "p-12 text-center space-y-4")}>
                <div className="w-16 h-16 rounded-full bg-red-900/20 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-8 h-8 text-red-400" />
                </div>
                <div>
                  <p className="text-white font-semibold text-lg">ElevenLabs Not Connected</p>
                  <p className="text-sm text-purple-300 mt-1">{statusData?.error || "Could not reach ElevenLabs API"}</p>
                  <p className="text-xs text-purple-500 mt-2">Make sure ELEVENLABS_API_KEY is set in your environment secrets.</p>
                </div>
                <Button onClick={() => refetchStatus()} className="bg-purple-700 hover:bg-purple-600">
                  <RefreshCw className="w-4 h-4 mr-2" /> Test Connection
                </Button>
              </div>
            ) : (
              <>
                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: "Characters Used", value: subscription?.character_count.toLocaleString() || "–", sub: `of ${subscription?.character_limit.toLocaleString() || "–"}`, icon: Zap, color: "text-purple-400", bg: "bg-purple-900/40" },
                    { label: "Characters Remaining", value: remainingChars?.toLocaleString() || "–", sub: `${100 - usagePct}% remaining`, icon: Gauge, color: "text-emerald-400", bg: "bg-emerald-900/30" },
                    { label: "Total Voices", value: voicesLoading ? "…" : voices.length, sub: `${voices.filter(v => v.category === "cloned").length} cloned · ${voices.filter(v => v.category === "premade").length} premade`, icon: Mic, color: "text-indigo-400", bg: "bg-indigo-900/40" },
                    { label: "Voice Slots", value: subscription ? `${subscription.voice_add_edit_counter}/${subscription.max_voice_add_edits}` : "–", sub: "custom voice edits used", icon: Users, color: "text-amber-400", bg: "bg-amber-900/30" },
                  ].map((stat, i) => (
                    <div key={i} className={cn(panel, "p-4")}>
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-[10px] text-purple-500 uppercase tracking-wider">{stat.label}</span>
                        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", stat.bg)}>
                          <stat.icon className={cn("w-3.5 h-3.5", stat.color)} />
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-white">{stat.value}</p>
                      <p className="text-[10px] text-purple-600 mt-1">{stat.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Plan Capabilities + Quick Actions */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className={cn(panel, "p-5")}>
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Star className="w-4 h-4 text-amber-400" /> Plan Capabilities</h3>
                    <div className="space-y-2.5">
                      {[
                        { label: "Text-to-Speech", ok: true, desc: "Full access" },
                        { label: "Sound Effects", ok: true, desc: "AI-generated SFX" },
                        { label: "Speech-to-Speech", ok: true, desc: "Voice transformation" },
                        { label: "Instant Voice Cloning", ok: subscription?.can_use_instant_voice_cloning, desc: subscription?.can_use_instant_voice_cloning ? "Available" : "Upgrade required" },
                        { label: "Professional Voice Cloning", ok: subscription?.can_use_professional_voice_cloning, desc: subscription?.can_use_professional_voice_cloning ? "Available" : "Upgrade required" },
                        { label: "Dubbing", ok: true, desc: "29+ languages" },
                        { label: "Voice Design", ok: true, desc: "Generate AI voices" },
                      ].map((cap, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0", cap.ok ? "bg-emerald-600" : "bg-gray-800")}>
                            {cap.ok ? <Check className="w-3 h-3 text-white" /> : <X className="w-2.5 h-2.5 text-gray-500" />}
                          </div>
                          <span className="text-[12px] text-purple-200 flex-1">{cap.label}</span>
                          <span className={cn("text-[10px]", cap.ok ? "text-purple-500" : "text-gray-600")}>{cap.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={cn(panel, "p-5")}>
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Zap className="w-4 h-4 text-purple-400" /> Quick Actions</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "TTS Studio", tab: "tts", icon: Volume2, desc: "Convert text to speech", color: "bg-purple-600/20 border-purple-700/40 hover:bg-purple-600/30" },
                        { label: "Browse Voices", tab: "voices", icon: Mic, desc: "Explore all voices", color: "bg-indigo-600/20 border-indigo-700/40 hover:bg-indigo-600/30" },
                        { label: "Clone a Voice", tab: "clone", icon: Users, desc: "Create custom voice", color: "bg-violet-600/20 border-violet-700/40 hover:bg-violet-600/30" },
                        { label: "Sound Effects", tab: "sfx", icon: Music, desc: "Generate audio SFX", color: "bg-pink-600/20 border-pink-700/40 hover:bg-pink-600/30" },
                        { label: "Voice Design", tab: "design", icon: Wand2, desc: "Design new AI voices", color: "bg-fuchsia-600/20 border-fuchsia-700/40 hover:bg-fuchsia-600/30" },
                        { label: "AI Dubbing", tab: "dubbing", icon: Globe, desc: "Translate & dub content", color: "bg-blue-600/20 border-blue-700/40 hover:bg-blue-600/30" },
                      ].map(a => (
                        <button key={a.tab} onClick={() => setActiveTab(a.tab)}
                          className={cn("flex items-start gap-2.5 p-3 rounded-xl border transition-all text-left", a.color)}>
                          <a.icon className="w-4 h-4 text-purple-300 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[12px] font-semibold text-white leading-tight">{a.label}</p>
                            <p className="text-[10px] text-purple-400 mt-0.5">{a.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Recent history preview */}
                {historyData?.history && historyData.history.length > 0 && (
                  <div className={cn(panel, "p-5")}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Clock className="w-4 h-4 text-purple-400" /> Recent Generations</h3>
                      <button onClick={() => setActiveTab("history")} className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1">
                        View all <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      {historyData.history.slice(0, 5).map(item => (
                        <div key={item.history_item_id} className="flex items-center gap-3 bg-[#0d0820]/60 rounded-xl px-3 py-2.5">
                          <div className="w-7 h-7 rounded-lg bg-purple-900/40 flex items-center justify-center shrink-0">
                            {item.source === "TTS" ? <Volume2 className="w-3 h-3 text-purple-400" /> : <Music className="w-3 h-3 text-purple-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] text-white truncate">{item.text || "(sound effect)"}</p>
                            <p className="text-[10px] text-purple-500">{item.voice_name} · {format(new Date(item.date_unix * 1000), "MMM d, HH:mm")}</p>
                          </div>
                          <span className="text-[9px] text-purple-600">{(item.character_count_change_to - item.character_count_change_from)} chars</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* ── TTS STUDIO ────────────────────────────────────────────────────── */}
          <TabsContent value="tts" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Left: Editor */}
              <div className="lg:col-span-2 space-y-4">
                {/* Mode toggle */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 bg-[#1a1033]/60 border border-purple-900/30 rounded-xl p-1">
                    <button onClick={() => setBatchMode(false)} className={cn("px-4 py-1.5 rounded-lg text-[11px] font-medium transition-colors", !batchMode ? "bg-purple-600 text-white" : "text-purple-400 hover:text-purple-300")}>Single</button>
                    <button onClick={() => setBatchMode(true)} className={cn("px-4 py-1.5 rounded-lg text-[11px] font-medium transition-colors", batchMode ? "bg-purple-600 text-white" : "text-purple-400 hover:text-purple-300")}>
                      <Layers className="w-3 h-3 mr-1 inline" /> Batch
                    </button>
                  </div>
                  {presets.length > 0 && (
                    <Button size="sm" variant="ghost" onClick={() => setShowPresets(x => !x)} className="text-purple-400 hover:text-white h-8 text-[11px]">
                      <BookMarked className="w-3.5 h-3.5 mr-1.5" /> Presets ({presets.length})
                    </Button>
                  )}
                </div>

                {/* Presets panel */}
                {showPresets && (
                  <div className={cn(panel, "p-4 space-y-3")}>
                    <div className="flex items-center gap-2 mb-2">
                      <Input value={presetName} onChange={e => setPresetName(e.target.value)} placeholder="Preset name…"
                        className="h-8 text-[12px] bg-[#0d0820] border-purple-800/40 text-white flex-1" />
                      <Button size="sm" onClick={savePreset} disabled={!presetName.trim()} className="bg-purple-700 hover:bg-purple-600 h-8 shrink-0">
                        <Save className="w-3.5 h-3.5 mr-1" /> Save
                      </Button>
                    </div>
                    <div className="space-y-1">
                      {presets.map(p => (
                        <div key={p.id} className="flex items-center gap-2 bg-[#0d0820]/60 rounded-lg px-3 py-2">
                          <button onClick={() => loadPreset(p)} className="flex-1 text-left text-[12px] text-purple-300 hover:text-white transition-colors">{p.name}</button>
                          <button onClick={() => deletePreset(p.id)} className="text-red-500/60 hover:text-red-400"><X className="w-3 h-3" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!batchMode ? (
                  <div className={cn(panel, "p-5 space-y-4")}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">Text Input</h3>
                      <div className="flex items-center gap-3">
                        {ttsCharCost && <span className="text-[10px] text-emerald-400">Last: {ttsCharCost} chars</span>}
                        <span className={cn("text-[11px] font-medium", ttsText.length > 4500 ? "text-red-400" : "text-purple-400")}>{ttsText.length} / 5000</span>
                      </div>
                    </div>
                    <Textarea data-testid="input-tts-text" value={ttsText} onChange={e => setTtsText(e.target.value)}
                      placeholder="Type or paste your text here…" maxLength={5000}
                      className="h-40 bg-[#0d0820] border-purple-800/40 text-white placeholder:text-purple-700 resize-none focus-visible:ring-purple-600 text-[13px] leading-relaxed" />

                    {/* Voice selector */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[11px] text-purple-400 mb-1.5 block">Voice *</Label>
                        <Select value={ttsVoiceId} onValueChange={setTtsVoiceId}>
                          <SelectTrigger className="bg-[#0d0820] border-purple-800/40 text-white focus:ring-purple-600 h-10" data-testid="select-tts-voice">
                            <SelectValue placeholder="Select a voice…" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#1a1033] border-purple-800/40 max-h-[280px]">
                            {voices.map(v => (
                              <SelectItem key={v.voice_id} value={v.voice_id} className="text-purple-200 focus:bg-purple-900/40">
                                <span>{v.name}</span>
                                <span className="text-purple-500 ml-2 text-[10px] capitalize">{v.category}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[11px] text-purple-400 mb-1.5 block">Model</Label>
                        <Select value={ttsModel} onValueChange={setTtsModel}>
                          <SelectTrigger className="bg-[#0d0820] border-purple-800/40 text-white focus:ring-purple-600 h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#1a1033] border-purple-800/40">
                            {(ttsModels.length > 0 ? ttsModels.map(m => ({ id: m.model_id, name: m.name })) : MODELS_FALLBACK).map(m => (
                              <SelectItem key={m.id} value={m.id} className="text-purple-200 focus:bg-purple-900/40">{m.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Output format */}
                    <div>
                      <Label className="text-[11px] text-purple-400 mb-1.5 block">Output Format</Label>
                      <Select value={ttsOutputFormat} onValueChange={setTtsOutputFormat}>
                        <SelectTrigger className="bg-[#0d0820] border-purple-800/40 text-white focus:ring-purple-600 h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1033] border-purple-800/40">
                          {[
                            { id: "mp3_22050_32", name: "MP3 22kHz 32kbps (Smallest)" },
                            { id: "mp3_44100_64", name: "MP3 44.1kHz 64kbps" },
                            { id: "mp3_44100_128", name: "MP3 44.1kHz 128kbps (Standard)" },
                            { id: "mp3_44100_192", name: "MP3 44.1kHz 192kbps (High Quality)" },
                            { id: "pcm_16000", name: "PCM 16kHz (Raw)" },
                            { id: "pcm_24000", name: "PCM 24kHz (Raw)" },
                            { id: "pcm_44100", name: "PCM 44.1kHz (Studio)" },
                          ].map(f => (
                            <SelectItem key={f.id} value={f.id} className="text-purple-200 focus:bg-purple-900/40">{f.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {remainingChars !== null && remainingChars < ttsText.length && ttsText.length > 0 && (
                      <div className="flex items-start gap-2 bg-red-950/30 border border-red-800/40 rounded-xl p-3">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[12px] text-red-400 font-semibold">Not enough credits</p>
                          <p className="text-[11px] text-red-500 mt-0.5">
                            This text needs <strong>{ttsText.length}</strong> credits but you only have <strong>{remainingChars}</strong> remaining.
                            Shorten your text by {ttsText.length - remainingChars} characters or{" "}
                            <a href="https://elevenlabs.io/subscription" target="_blank" rel="noreferrer" className="underline hover:text-red-300">upgrade your plan</a>.
                          </p>
                        </div>
                      </div>
                    )}
                    <Button data-testid="btn-tts-generate" onClick={() => ttsMutation.mutate()}
                      disabled={ttsMutation.isPending || !ttsText.trim() || !ttsVoiceId || (remainingChars !== null && remainingChars < ttsText.length)}
                      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white h-11 font-semibold text-[13px] disabled:opacity-50">
                      {ttsMutation.isPending
                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating…</>
                        : <><Volume2 className="w-4 h-4 mr-2" /> Generate Speech</>}
                    </Button>
                  </div>
                ) : (
                  /* Batch Mode */
                  <div className={cn(panel, "p-5 space-y-4")}>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-white">Batch Texts (one per line)</h3>
                        <span className="text-[10px] text-purple-500">{batchTexts.split("\n").filter(Boolean).length} texts</span>
                      </div>
                      <Textarea value={batchTexts} onChange={e => setBatchTexts(e.target.value)}
                        placeholder={"Line 1: First text\nLine 2: Second text\nLine 3: Third text"} rows={8}
                        className="bg-[#0d0820] border-purple-800/40 text-white placeholder:text-purple-700 resize-none font-mono text-[12px]" />
                    </div>
                    <div>
                      <Label className="text-[11px] text-purple-400 mb-1.5 block">Voice for all</Label>
                      <Select value={ttsVoiceId} onValueChange={setTtsVoiceId}>
                        <SelectTrigger className="bg-[#0d0820] border-purple-800/40 text-white h-10">
                          <SelectValue placeholder="Select voice…" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1033] border-purple-800/40 max-h-[280px]">
                          {voices.map(v => <SelectItem key={v.voice_id} value={v.voice_id} className="text-purple-200 focus:bg-purple-900/40">{v.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={runBatchTTS} disabled={batchRunning || !ttsVoiceId}
                      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 h-11 font-semibold">
                      {batchRunning ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing…</> : <><Layers className="w-4 h-4 mr-2" /> Run Batch</>}
                    </Button>
                    {batchResults.map((r, i) => (
                      <div key={i} className="bg-[#0d0820]/60 rounded-xl p-3 border border-purple-900/30">
                        <p className="text-[11px] text-purple-400 mb-2 truncate">{r.text}</p>
                        {r.audio ? <AudioPlayer b64={r.audio} label={r.text.slice(0, 40)} compact /> : r.error ? <p className="text-[11px] text-red-400">{r.error}</p> : <div className="flex items-center gap-2 text-[11px] text-purple-500"><Loader2 className="w-3 h-3 animate-spin" /> Processing…</div>}
                      </div>
                    ))}
                  </div>
                )}

                {ttsAudio && !batchMode && (
                  <div className={cn(panel, "p-4")}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[12px] text-purple-400 font-medium flex items-center gap-1.5"><FileAudio className="w-3.5 h-3.5" /> Generated Audio</p>
                      <Button size="sm" variant="ghost" onClick={() => { setShowPresets(true); }} className="text-[10px] text-purple-500 h-7">
                        <Save className="w-3 h-3 mr-1" /> Save preset
                      </Button>
                    </div>
                    <AudioPlayer b64={ttsAudio} label={ttsText.slice(0, 60) + (ttsText.length > 60 ? "…" : "")} />
                  </div>
                )}
              </div>

              {/* Right: Voice Settings */}
              <div className={cn(panel, "p-5 space-y-5 h-fit")}>
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-semibold text-white">Voice Settings</h3>
                </div>

                {[
                  { label: "Stability", value: ttsStability, set: setTtsStability, min: 0, max: 1, step: 0.01, desc: "Higher = more consistent but less expressive." },
                  { label: "Similarity Boost", value: ttsSimilarity, set: setTtsSimilarity, min: 0, max: 1, step: 0.01, desc: "How closely the AI adheres to the original voice." },
                  { label: "Style Exaggeration", value: ttsStyle, set: setTtsStyle, min: 0, max: 1, step: 0.01, desc: "Amplifies the original speaker's style (v2 models)." },
                  { label: "Speed", value: ttsSpeed, set: setTtsSpeed, min: 0.7, max: 1.2, step: 0.05, desc: "1.0 = normal. 0.7 = slower, 1.2 = faster." },
                ].map(s => (
                  <div key={s.label} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-[11px] text-purple-300">{s.label}</Label>
                      <span className="text-[11px] font-mono text-purple-400 bg-purple-900/30 px-2 py-0.5 rounded">{s.value[0].toFixed(2)}</span>
                    </div>
                    <Slider value={s.value} onValueChange={s.set} min={s.min} max={s.max} step={s.step}
                      className="[&_[role=slider]]:bg-purple-500 [&_[role=slider]]:border-purple-400 [&_.bg-primary]:bg-purple-600" />
                    <p className="text-[9px] text-purple-700 leading-relaxed">{s.desc}</p>
                  </div>
                ))}

                <div className="flex items-center justify-between pt-1 border-t border-purple-900/30">
                  <div>
                    <Label className="text-[11px] text-purple-300">Speaker Boost</Label>
                    <p className="text-[9px] text-purple-700 mt-0.5">Boosts similarity to original voice</p>
                  </div>
                  <Switch checked={ttsSpeakerBoost} onCheckedChange={setTtsSpeakerBoost} className="data-[state=checked]:bg-purple-600" />
                </div>

                <Button variant="outline" size="sm" className="w-full border-purple-800/40 text-purple-400 hover:bg-purple-900/40 hover:text-white text-[11px]"
                  onClick={() => { setTtsStability([0.5]); setTtsSimilarity([0.75]); setTtsStyle([0.0]); setTtsSpeed([1.0]); setTtsSpeakerBoost(true); }}>
                  <Repeat className="w-3 h-3 mr-1.5" /> Reset to Defaults
                </Button>

                {/* Char cost estimate */}
                {ttsText.length > 0 && (
                  <div className={cn("rounded-xl p-3 border", remainingChars !== null && remainingChars < ttsText.length
                    ? "bg-red-950/40 border-red-800/40"
                    : "bg-purple-950/40 border-purple-800/20")}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      {remainingChars !== null && remainingChars < ttsText.length
                        ? <AlertCircle className="w-3 h-3 text-red-400" />
                        : <Zap className="w-3 h-3 text-purple-500" />}
                      <p className={cn("text-[10px] font-medium", remainingChars !== null && remainingChars < ttsText.length ? "text-red-400" : "text-purple-500")}>
                        {remainingChars !== null && remainingChars < ttsText.length ? "Quota Exceeded" : "Estimated Usage"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-purple-600">Characters needed</span>
                        <span className="text-purple-300">{ttsText.length.toLocaleString()}</span>
                      </div>
                      {remainingChars !== null && (
                        <>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-purple-600">Credits available</span>
                            <span className={cn(remainingChars < ttsText.length ? "text-red-400 font-medium" : "text-purple-300")}>
                              {remainingChars.toLocaleString()}
                            </span>
                          </div>
                          {remainingChars < ttsText.length && (
                            <p className="text-[10px] text-red-400 mt-1.5 leading-relaxed">
                              Shorten your text by {(ttsText.length - remainingChars).toLocaleString()} chars, or upgrade your ElevenLabs plan.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── VOICE LIBRARY ─────────────────────────────────────────────────── */}
          <TabsContent value="voices" className="mt-0 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-start">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500 pointer-events-none" />
                <Input data-testid="input-voice-search" value={voiceSearch} onChange={e => setVoiceSearch(e.target.value)}
                  placeholder="Search by name, accent, use case…"
                  className="pl-9 bg-[#0d0820] border-purple-800/40 text-white placeholder:text-purple-700 focus-visible:ring-purple-600" />
              </div>
              <Select value={languageFilter} onValueChange={setLanguageFilter}>
                <SelectTrigger className="bg-[#0d0820] border-purple-800/40 text-white w-40 h-10">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1033] border-purple-800/40">
                  <SelectItem value="all" className="text-purple-200 focus:bg-purple-900/40">All Languages</SelectItem>
                  {LANGUAGES.map(l => <SelectItem key={l} value={l.toLowerCase()} className="text-purple-200 focus:bg-purple-900/40">{l}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex gap-1.5 flex-wrap">
                {["all", "premade", "cloned", "professional", "generated"].map(cat => (
                  <button key={cat} onClick={() => setVoiceFilter(cat)}
                    className={cn("px-3 py-1.5 rounded-full text-[11px] font-medium capitalize transition-colors",
                      voiceFilter === cat ? "bg-purple-600 text-white" : "bg-[#1a1033]/60 text-purple-400 border border-purple-800/30 hover:bg-purple-900/40")}>
                    {cat}{cat === "all" ? ` (${voices.length})` : cat === "cloned" ? ` (${voices.filter(v => v.category === "cloned").length})` : ""}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-purple-500">
              <span>{filteredVoices.length} voice{filteredVoices.length !== 1 ? "s" : ""} shown</span>
              <div className="flex gap-1">
                {[{ id: "grid", label: "Grid" }, { id: "list", label: "List" }].map(v => (
                  <button key={v.id} onClick={() => setVoiceView(v.id as "grid" | "list")}
                    className={cn("px-2.5 py-1 rounded-lg text-[10px] transition-colors", voiceView === v.id ? "bg-purple-700 text-white" : "text-purple-500 hover:text-purple-300")}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {voicesLoading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-purple-500" /></div>
            ) : filteredVoices.length === 0 ? (
              <div className="text-center py-20 text-purple-600">No voices match your filters</div>
            ) : voiceView === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredVoices.map(v => (
                  <VoiceCard key={v.voice_id} voice={v} selected={ttsVoiceId === v.voice_id}
                    previewing={previewingVoiceId === v.voice_id}
                    onSelect={voice => { setTtsVoiceId(voice.voice_id); setActiveTab("tts"); toast({ title: `Voice selected: ${voice.name}`, description: "Switched to TTS Studio" }); }}
                    onPreview={previewVoice} showDelete onDelete={id => deleteVoiceMutation.mutate(id)} />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredVoices.map(v => (
                  <div key={v.voice_id} className={cn("flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer",
                    ttsVoiceId === v.voice_id ? "border-purple-500 bg-purple-900/20" : "border-purple-900/30 bg-[#1a1033]/40 hover:border-purple-700/40")}>
                    <div className="w-9 h-9 rounded-full bg-purple-900/60 flex items-center justify-center shrink-0">
                      <Mic className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-semibold text-white truncate">{v.name}</p>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full border capitalize text-purple-400 border-purple-800/30 bg-purple-900/30 shrink-0">{v.category}</span>
                      </div>
                      <p className="text-[10px] text-purple-500 truncate">{[v.labels?.gender, v.labels?.accent, v.labels?.language].filter(Boolean).join(" · ")}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => previewVoice(v)} className="w-8 h-8 rounded-lg bg-purple-900/40 hover:bg-purple-800/60 flex items-center justify-center text-purple-400 transition-colors">
                        {previewingVoiceId === v.voice_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                      </button>
                      <button onClick={() => { setTtsVoiceId(v.voice_id); setActiveTab("tts"); }} className="w-8 h-8 rounded-lg bg-purple-700/40 hover:bg-purple-600/60 flex items-center justify-center text-purple-300 transition-colors">
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── VOICE CLONING ─────────────────────────────────────────────────── */}
          <TabsContent value="clone" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className={cn(panel, "p-6 space-y-5")}>
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-semibold text-white">Instant Voice Clone</h3>
                  {subscription?.can_use_instant_voice_cloning
                    ? <Badge className="bg-emerald-900/40 text-emerald-400 border-emerald-700/40 text-[9px]">Available</Badge>
                    : <Badge className="bg-red-900/40 text-red-400 border-red-700/40 text-[9px]">Upgrade Required</Badge>}
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-purple-400">Voice Name *</Label>
                  <Input data-testid="input-clone-name" value={cloneName} onChange={e => setCloneName(e.target.value)}
                    placeholder="e.g. Riki's Voice" className="bg-[#0d0820] border-purple-800/40 text-white placeholder:text-purple-700" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-purple-400">Description (optional)</Label>
                  <Textarea value={cloneDesc} onChange={e => setCloneDesc(e.target.value)}
                    placeholder="Describe the voice characteristics…"
                    className="h-20 bg-[#0d0820] border-purple-800/40 text-white placeholder:text-purple-700 resize-none text-[12px]" />
                </div>

                {/* Upload or Record */}
                <div className="space-y-2">
                  <Label className="text-[11px] text-purple-400">Audio Source (1–25 samples, 30s+ each) *</Label>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <button onClick={() => cloneInputRef.current?.click()}
                      className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-purple-800/40 rounded-xl hover:border-purple-600/60 hover:bg-purple-900/10 transition-colors">
                      <Upload className="w-5 h-5 text-purple-500" />
                      <p className="text-[11px] text-purple-400 font-medium">Upload Files</p>
                      <p className="text-[9px] text-purple-600">MP3, WAV, M4A</p>
                    </button>
                    <button onClick={() => cloneRecorder.recording ? cloneRecorder.stopRecording() : cloneRecorder.startRecording()}
                      className={cn("flex flex-col items-center gap-2 p-4 border-2 border-dashed rounded-xl transition-all",
                        cloneRecorder.recording ? "border-red-500/60 bg-red-900/10" : "border-purple-800/40 hover:border-purple-600/60 hover:bg-purple-900/10")}>
                      {cloneRecorder.recording ? <StopCircle className="w-5 h-5 text-red-400 animate-pulse" /> : <Mic className="w-5 h-5 text-purple-500" />}
                      <p className="text-[11px] text-purple-400 font-medium">{cloneRecorder.recording ? "Stop Recording" : "Record Audio"}</p>
                      {cloneRecorder.recording && <p className="text-[9px] text-red-400 font-mono">{cloneRecorder.duration}s</p>}
                    </button>
                  </div>
                  <input ref={cloneInputRef} type="file" multiple accept="audio/*" className="hidden"
                    onChange={e => setCloneFiles(Array.from(e.target.files || []))} />

                  {cloneFiles.length > 0 && (
                    <div className="space-y-1">
                      {cloneFiles.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 bg-[#0d0820] rounded-lg px-3 py-2 border border-purple-800/30">
                          <Headphones className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                          <span className="text-[11px] text-purple-300 flex-1 truncate">{f.name}</span>
                          <span className="text-[10px] text-purple-600">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
                          <button onClick={() => setCloneFiles(prev => prev.filter((_, j) => j !== i))} className="text-red-500/60 hover:text-red-400"><X className="w-3 h-3" /></button>
                        </div>
                      ))}
                    </div>
                  )}

                  {cloneRecorder.audioUrl && (
                    <div className="flex items-center gap-2 bg-[#0d0820] rounded-lg px-3 py-2 border border-purple-800/30">
                      <Mic className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span className="text-[11px] text-purple-300 flex-1">Recording ({cloneRecorder.duration}s)</span>
                      <audio controls src={cloneRecorder.audioUrl} className="h-7" />
                      <button onClick={cloneRecorder.clearRecording} className="text-red-500/60 hover:text-red-400"><X className="w-3 h-3" /></button>
                    </div>
                  )}
                </div>

                <Button data-testid="btn-clone-voice" onClick={() => cloneMutation.mutate()}
                  disabled={cloneMutation.isPending || !cloneName || (cloneFiles.length === 0 && !cloneRecorder.audioBlob)}
                  className="w-full bg-purple-600 hover:bg-purple-500 h-11 font-semibold">
                  {cloneMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Cloning…</> : <><Users className="w-4 h-4 mr-2" /> Clone Voice</>}
                </Button>
              </div>

              {/* Cloned voices */}
              <div className={cn(panel, "p-5 space-y-3")}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Your Cloned Voices ({voices.filter(v => v.category === "cloned").length})</h3>
                  <Button variant="ghost" size="sm" onClick={() => refetchVoices()} className="text-purple-400 hover:text-white h-7 w-7 p-0">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                </div>
                {voicesLoading ? <Loader2 className="w-5 h-5 animate-spin text-purple-500" /> :
                  voices.filter(v => v.category === "cloned").length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="w-8 h-8 text-purple-800 mx-auto mb-2" />
                      <p className="text-[12px] text-purple-600">No cloned voices yet</p>
                      <p className="text-[10px] text-purple-700 mt-1">Upload audio samples to create your first clone</p>
                    </div>
                  ) : (
                    voices.filter(v => v.category === "cloned").map(v => (
                      <div key={v.voice_id} className="flex items-center gap-3 bg-[#0d0820] rounded-xl px-3 py-3 border border-purple-800/30 group">
                        <div className="w-9 h-9 rounded-full bg-purple-900/60 flex items-center justify-center shrink-0">
                          <Mic className="w-4 h-4 text-purple-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-white truncate">{v.name}</p>
                          <p className="text-[10px] text-purple-600 truncate font-mono">{v.voice_id}</p>
                        </div>
                        <div className="flex gap-1.5">
                          <button onClick={() => previewVoice(v)} className="w-8 h-8 rounded-lg bg-purple-900/40 hover:bg-purple-800/60 flex items-center justify-center text-purple-400 transition-colors">
                            {previewingVoiceId === v.voice_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                          </button>
                          <button onClick={() => { setTtsVoiceId(v.voice_id); setActiveTab("tts"); }} className="w-8 h-8 rounded-lg bg-purple-700/40 hover:bg-purple-600/60 flex items-center justify-center text-purple-300 transition-colors">
                            <ArrowRight className="w-3 h-3" />
                          </button>
                          <button onClick={() => deleteVoiceMutation.mutate(v.voice_id)} className="w-8 h-8 rounded-lg bg-red-900/20 hover:bg-red-900/40 flex items-center justify-center text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  )
                }
              </div>
            </div>
          </TabsContent>

          {/* ── SOUND EFFECTS ─────────────────────────────────────────────────── */}
          <TabsContent value="sfx" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              <div className={cn(panel, "p-6 space-y-5 lg:col-span-3")}>
                <div className="flex items-center gap-2">
                  <Music className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-semibold text-white">Sound Effects Generator</h3>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-purple-400">Describe the Sound Effect *</Label>
                  <Textarea data-testid="input-sfx-prompt" value={sfxText} onChange={e => setSfxText(e.target.value)}
                    placeholder="e.g. 'Hip-hop beat drop with heavy bass and vinyl scratching, urban street vibes'"
                    className="h-28 bg-[#0d0820] border-purple-800/40 text-white placeholder:text-purple-700 resize-none text-[13px] leading-relaxed" />
                  <p className="text-[10px] text-purple-600 text-right">{sfxText.length} chars</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-purple-400">Duration (seconds)</Label>
                    <Input value={sfxDuration} onChange={e => setSfxDuration(e.target.value)}
                      placeholder="Auto (max 22s)" type="number" min="0.5" max="22" step="0.5"
                      className="bg-[#0d0820] border-purple-800/40 text-white placeholder:text-purple-700 h-10" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label className="text-[11px] text-purple-400">Prompt Influence</Label>
                      <span className="text-[11px] font-mono text-purple-400">{sfxInfluence[0].toFixed(2)}</span>
                    </div>
                    <Slider value={sfxInfluence} onValueChange={setSfxInfluence} min={0} max={1} step={0.05}
                      className="[&_[role=slider]]:bg-purple-500 [&_[role=slider]]:border-purple-400 mt-3" />
                  </div>
                </div>

                <Button data-testid="btn-sfx-generate" onClick={() => sfxMutation.mutate()}
                  disabled={sfxMutation.isPending || !sfxText.trim()}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 h-11 font-semibold">
                  {sfxMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating…</> : <><Music className="w-4 h-4 mr-2" /> Generate Sound Effect</>}
                </Button>

                {sfxAudio && (
                  <div>
                    <p className="text-[11px] text-purple-400 mb-2 font-medium">Generated Sound Effect</p>
                    <AudioPlayer b64={sfxAudio} label={sfxText.slice(0, 50)} />
                  </div>
                )}
              </div>

              {/* Quick prompts by category */}
              <div className={cn(panel, "p-5 lg:col-span-2 space-y-4")}>
                <h3 className="text-sm font-semibold text-white">Quick Prompts</h3>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {Object.keys(SFX_CATEGORIES).map(cat => (
                    <button key={cat} onClick={() => setSfxCategory(cat)}
                      className={cn("text-[10px] px-2.5 py-1 rounded-full border transition-colors",
                        sfxCategory === cat ? "bg-purple-600 text-white border-purple-600" : "text-purple-400 border-purple-800/30 hover:border-purple-600/50")}>
                      {cat}
                    </button>
                  ))}
                </div>
                <div className="space-y-1.5">
                  {(SFX_CATEGORIES as any)[sfxCategory]?.map((p: string) => (
                    <button key={p} onClick={() => setSfxText(p)}
                      className="w-full text-left text-[11px] px-3 py-2.5 rounded-xl bg-purple-900/20 border border-purple-800/20 text-purple-300 hover:border-purple-600/40 hover:bg-purple-900/40 hover:text-white transition-all">
                      {p}
                    </button>
                  ))}
                </div>
                <div className={cn(panel, "p-3 space-y-2 border-purple-800/20")}>
                  <h4 className="text-[10px] font-semibold text-purple-400 uppercase tracking-wide">Use Cases</h4>
                  {[
                    { icon: "🎤", title: "Event Announcements", desc: "Dynamic intros for push notifications" },
                    { icon: "🎛️", title: "DJ & Music Content", desc: "Beats for reels & stories" },
                    { icon: "🏆", title: "Battle Atmosphere", desc: "Crowd sounds for competition content" },
                    { icon: "📱", title: "App UI Sounds", desc: "Notification & interaction sounds" },
                  ].map((u, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-base">{u.icon}</span>
                      <div><p className="text-[11px] text-purple-200 font-medium">{u.title}</p><p className="text-[9px] text-purple-500">{u.desc}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── SPEECH-TO-SPEECH ──────────────────────────────────────────────── */}
          <TabsContent value="s2s" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className={cn(panel, "p-6 space-y-5")}>
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-semibold text-white">Speech-to-Speech</h3>
                </div>
                <p className="text-[11px] text-purple-400">Transform the vocal characteristics of any audio while preserving the content, emotion and performance.</p>

                <div>
                  <Label className="text-[11px] text-purple-400 mb-1.5 block">Target Voice *</Label>
                  <Select value={s2sVoiceId} onValueChange={setS2sVoiceId}>
                    <SelectTrigger className="bg-[#0d0820] border-purple-800/40 text-white h-10">
                      <SelectValue placeholder="Choose target voice…" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1033] border-purple-800/40 max-h-[280px]">
                      {voices.map(v => <SelectItem key={v.voice_id} value={v.voice_id} className="text-purple-200 focus:bg-purple-900/40">{v.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {s2sModels.length > 0 && (
                  <div>
                    <Label className="text-[11px] text-purple-400 mb-1.5 block">Model</Label>
                    <Select defaultValue={s2sModels[0]?.model_id}>
                      <SelectTrigger className="bg-[#0d0820] border-purple-800/40 text-white h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1033] border-purple-800/40">
                        {s2sModels.map(m => <SelectItem key={m.model_id} value={m.model_id} className="text-purple-200 focus:bg-purple-900/40">{m.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-[11px] text-purple-400">Source Audio *</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => s2sInputRef.current?.click()}
                      className={cn("flex flex-col items-center gap-2 p-4 border-2 border-dashed border-purple-800/40 rounded-xl hover:border-purple-600/60 hover:bg-purple-900/10 transition-colors", s2sFile && "border-purple-500/40 bg-purple-900/10")}>
                      <Upload className="w-5 h-5 text-purple-500" />
                      <p className="text-[11px] text-purple-400 font-medium">{s2sFile ? s2sFile.name.slice(0, 20) : "Upload Audio"}</p>
                      <p className="text-[9px] text-purple-600">Any audio format</p>
                    </button>
                    <button onClick={() => s2sRecorder.recording ? s2sRecorder.stopRecording() : s2sRecorder.startRecording()}
                      className={cn("flex flex-col items-center gap-2 p-4 border-2 border-dashed rounded-xl transition-all",
                        s2sRecorder.recording ? "border-red-500/60 bg-red-900/10" : "border-purple-800/40 hover:border-purple-600/60 hover:bg-purple-900/10")}>
                      {s2sRecorder.recording ? <StopCircle className="w-5 h-5 text-red-400 animate-pulse" /> : <Mic className="w-5 h-5 text-purple-500" />}
                      <p className="text-[11px] text-purple-400 font-medium">{s2sRecorder.recording ? "Stop" : "Record"}</p>
                      {s2sRecorder.recording && <p className="text-[9px] text-red-400 font-mono">{s2sRecorder.duration}s</p>}
                    </button>
                  </div>
                  <input ref={s2sInputRef} type="file" accept="audio/*" className="hidden"
                    onChange={e => { setS2sFile(e.target.files?.[0] || null); s2sRecorder.clearRecording(); }} />
                  {s2sRecorder.audioUrl && !s2sFile && (
                    <div className="flex items-center gap-2 bg-[#0d0820] rounded-lg px-3 py-2 border border-purple-800/30">
                      <Mic className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span className="text-[11px] text-purple-300 flex-1">Recording ({s2sRecorder.duration}s)</span>
                      <audio controls src={s2sRecorder.audioUrl} className="h-7" />
                    </div>
                  )}
                </div>

                <Button onClick={() => s2sMutation.mutate()}
                  disabled={s2sMutation.isPending || !s2sVoiceId || (!s2sFile && !s2sRecorder.audioBlob)}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 h-11 font-semibold">
                  {s2sMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Transforming…</> : <><Radio className="w-4 h-4 mr-2" /> Transform Voice</>}
                </Button>
              </div>

              <div className="space-y-4">
                {s2sAudio && (
                  <div className={cn(panel, "p-5")}>
                    <p className="text-[11px] text-purple-400 mb-3 font-medium">Transformed Audio</p>
                    <AudioPlayer b64={s2sAudio} label="Speech-to-Speech Output" />
                  </div>
                )}
                <div className={cn(panel, "p-5 space-y-3")}>
                  <h4 className="text-[13px] font-semibold text-white">How it works</h4>
                  {[
                    { step: "1", text: "Record or upload any speech audio" },
                    { step: "2", text: "Choose a target voice from the library" },
                    { step: "3", text: "ElevenLabs transforms the vocal style" },
                    { step: "4", text: "Download the result in your chosen format" },
                  ].map(s => (
                    <div key={s.step} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-purple-700/60 flex items-center justify-center text-[11px] font-bold text-purple-300 shrink-0">{s.step}</div>
                      <p className="text-[12px] text-purple-300">{s.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── VOICE DESIGN ──────────────────────────────────────────────────── */}
          <TabsContent value="design" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className={cn(panel, "p-6 space-y-5")}>
                <div className="flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-semibold text-white">AI Voice Design</h3>
                </div>
                <p className="text-[11px] text-purple-400">Describe any voice in natural language and ElevenLabs will generate it. No audio samples needed.</p>

                <div className="space-y-1">
                  <Label className="text-[11px] text-purple-400">Voice Description *</Label>
                  <Textarea value={vdDescription} onChange={e => setVdDescription(e.target.value)}
                    placeholder="e.g. 'A confident young Dutch male with an Amsterdam accent, energetic and street-smart, perfect for urban culture content'"
                    className="h-32 bg-[#0d0820] border-purple-800/40 text-white placeholder:text-purple-700 resize-none text-[13px] leading-relaxed" />
                  <p className="text-[9px] text-purple-600 text-right">{vdDescription.length} chars — Be specific about gender, age, accent, tone and use case for best results</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-purple-400">Preview Text (optional)</Label>
                  <Textarea value={vdText} onChange={e => setVdText(e.target.value)}
                    placeholder="Leave empty for auto-generated preview text…"
                    className="h-20 bg-[#0d0820] border-purple-800/40 text-white placeholder:text-purple-700 resize-none text-[12px]" />
                </div>

                <div>
                  <p className="text-[10px] text-purple-500 mb-2 uppercase tracking-wide">Quick Templates</p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {VOICE_DESC_TEMPLATES.map(d => (
                      <button key={d} onClick={() => setVdDescription(d)}
                        className="text-left text-[10px] px-3 py-2 rounded-lg bg-purple-900/20 border border-purple-800/20 text-purple-400 hover:border-purple-600/40 hover:text-purple-200 hover:bg-purple-900/40 transition-all">
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <Button onClick={() => vdMutation.mutate()} disabled={vdMutation.isPending || !vdDescription.trim()}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 h-11 font-semibold">
                  {vdMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Designing Voice…</> : <><Wand2 className="w-4 h-4 mr-2" /> Design Voice</>}
                </Button>
              </div>

              <div className="space-y-4">
                {vdResult ? (
                  <div className={cn(panel, "p-5 space-y-4")}>
                    <p className="text-[12px] text-purple-400 font-medium">Generated Voice Previews</p>
                    {(vdResult.previews || (vdResult.audio_base_64 ? [{ audio_base_64: vdResult.audio_base_64, generated_voice_id: vdResult.generated_voice_id }] : [])).map((p: any, i: number) => (
                      <div key={i} className="space-y-3 bg-[#0d0820]/60 rounded-xl p-3 border border-purple-900/30">
                        <AudioPlayer b64={p.audio_base_64} label={`Voice Preview ${i + 1}`} />
                        {p.generated_voice_id && (
                          <div className="space-y-2">
                            <p className="text-[9px] text-purple-600 font-mono">ID: {p.generated_voice_id}</p>
                            {vdSavingId === p.generated_voice_id ? (
                              <div className="flex gap-2">
                                <Input value={vdSaveName} onChange={e => setVdSaveName(e.target.value)}
                                  placeholder="Voice name…" className="h-8 text-[11px] bg-[#0d0820] border-purple-800/40 text-white flex-1" />
                                <Button size="sm" onClick={() => vdSaveMutation.mutate(p.generated_voice_id)}
                                  disabled={vdSaveMutation.isPending || !vdSaveName.trim()}
                                  className="bg-emerald-700 hover:bg-emerald-600 h-8 shrink-0 text-[11px]">
                                  {vdSaveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3 mr-1" /> Save</>}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setVdSavingId(null)} className="h-8 text-purple-400"><X className="w-3 h-3" /></Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => { setVdSavingId(p.generated_voice_id); setVdSaveName(""); }}
                                className="w-full h-8 border-purple-800/40 text-purple-400 hover:bg-purple-900/40 hover:text-white text-[11px]">
                                <Save className="w-3 h-3 mr-1.5" /> Save to Voice Library
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={cn(panel, "p-8 text-center")}>
                    <Wand2 className="w-10 h-10 text-purple-800 mx-auto mb-3" />
                    <p className="text-[12px] text-purple-600">Your designed voice will appear here</p>
                  </div>
                )}
                <div className={cn(panel, "p-5 space-y-2")}>
                  <h4 className="text-[12px] font-semibold text-white flex items-center gap-1.5"><Info className="w-3.5 h-3.5 text-purple-400" /> Tips for best results</h4>
                  {["Specify gender, age and accent clearly", "Describe the emotional tone (calm, energetic, warm)", "Mention the use case (podcast, event, ads)", "Include speaking style (formal, casual, conversational)"].map((tip, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px] text-purple-400">
                      <Check className="w-3 h-3 text-purple-600 mt-0.5 shrink-0" /> {tip}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── DUBBING ───────────────────────────────────────────────────────── */}
          <TabsContent value="dubbing" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className={cn(panel, "p-6 space-y-5")}>
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-semibold text-white">AI Dubbing</h3>
                </div>
                <p className="text-[11px] text-purple-400">Dub any audio or video content into 29+ languages while preserving the original voice characteristics and emotion.</p>

                <div>
                  <Label className="text-[11px] text-purple-400">Project Name</Label>
                  <Input value={dubName} onChange={e => setDubName(e.target.value)} placeholder="e.g. UCH Event Promo NL→EN"
                    className="mt-1.5 bg-[#0d0820] border-purple-800/40 text-white placeholder:text-purple-700 h-10" />
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] text-purple-400">Source Content *</Label>
                  <Input value={dubSourceUrl} onChange={e => setDubSourceUrl(e.target.value)} placeholder="YouTube URL, video/audio link…"
                    className="bg-[#0d0820] border-purple-800/40 text-white placeholder:text-purple-700 h-10" />
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-purple-900/40" /><span className="text-[10px] text-purple-600">OR</span><div className="flex-1 h-px bg-purple-900/40" />
                  </div>
                  <button onClick={() => dubInputRef.current?.click()}
                    className={cn("w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-xl transition-colors",
                      dubFile ? "border-purple-500/40 bg-purple-900/10" : "border-purple-800/40 hover:border-purple-600/60 hover:bg-purple-900/10")}>
                    <Upload className="w-4 h-4 text-purple-500" />
                    <span className="text-[11px] text-purple-400">{dubFile ? dubFile.name : "Upload audio/video file"}</span>
                  </button>
                  <input ref={dubInputRef} type="file" accept="audio/*,video/*" className="hidden"
                    onChange={e => { setDubFile(e.target.files?.[0] || null); setDubSourceUrl(""); }} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] text-purple-400 mb-1.5 block">Source Language</Label>
                    <Select value={dubSourceLang} onValueChange={setDubSourceLang}>
                      <SelectTrigger className="bg-[#0d0820] border-purple-800/40 text-white h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1033] border-purple-800/40 max-h-[250px]">
                        <SelectItem value="auto" className="text-purple-200 focus:bg-purple-900/40">Auto-detect</SelectItem>
                        {[["nl","Dutch"], ["en","English"], ["de","German"], ["fr","French"], ["es","Spanish"], ["ar","Arabic"], ["tr","Turkish"]].map(([c, n]) =>
                          <SelectItem key={c} value={c} className="text-purple-200 focus:bg-purple-900/40">{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[11px] text-purple-400 mb-1.5 block">Target Language *</Label>
                    <Select value={dubTargetLang} onValueChange={setDubTargetLang}>
                      <SelectTrigger className="bg-[#0d0820] border-purple-800/40 text-white h-10"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-[#1a1033] border-purple-800/40 max-h-[250px]">
                        {[["nl","Dutch"],["en","English"],["de","German"],["fr","French"],["es","Spanish"],["ar","Arabic"],["tr","Turkish"],["pt","Portuguese"],["it","Italian"],["pl","Polish"],["zh","Chinese"],["ja","Japanese"],["ko","Korean"],["ru","Russian"],["hi","Hindi"]].map(([c, n]) =>
                          <SelectItem key={c} value={c} className="text-purple-200 focus:bg-purple-900/40">{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-[11px] text-purple-400 mb-1.5 block">Number of Speakers</Label>
                  <Select value={dubNumSpeakers} onValueChange={setDubNumSpeakers}>
                    <SelectTrigger className="bg-[#0d0820] border-purple-800/40 text-white h-10"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#1a1033] border-purple-800/40">
                      <SelectItem value="0" className="text-purple-200 focus:bg-purple-900/40">Auto-detect</SelectItem>
                      {[1,2,3,4,5,6].map(n => <SelectItem key={n} value={String(n)} className="text-purple-200 focus:bg-purple-900/40">{n} speaker{n !== 1 ? "s" : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={() => dubMutation.mutate()} disabled={dubMutation.isPending || (!dubSourceUrl && !dubFile)}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 h-11 font-semibold">
                  {dubMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting…</> : <><Film className="w-4 h-4 mr-2" /> Start Dubbing Job</>}
                </Button>
              </div>

              <div className="space-y-4">
                {dubResult && (
                  <div className={cn(panel, "p-5 space-y-3")}>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-emerald-900/40 flex items-center justify-center">
                        <Check className="w-4 h-4 text-emerald-400" />
                      </div>
                      <p className="text-sm font-semibold text-white">Dubbing Job Created</p>
                    </div>
                    <div className="space-y-2 bg-[#0d0820]/60 rounded-xl p-3 border border-purple-900/30">
                      {[
                        { label: "Dubbing ID", val: dubResult.dubbing_id },
                        { label: "Expected Duration", val: dubResult.expected_duration_sec ? `~${dubResult.expected_duration_sec}s` : "Calculating…" },
                      ].map(r => (
                        <div key={r.label} className="flex items-center gap-2">
                          <span className="text-[10px] text-purple-500 w-36">{r.label}</span>
                          <span className="text-[11px] text-purple-200 font-mono flex-1">{r.val}</span>
                          {r.label === "Dubbing ID" && <button onClick={() => navigator.clipboard.writeText(r.val)} className="text-purple-600 hover:text-purple-400"><Copy className="w-3 h-3" /></button>}
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-purple-500 italic">Dubbing jobs take several minutes to complete. Check your ElevenLabs dashboard for the final result and download.</p>
                    <a href="https://elevenlabs.io/dubbing" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300">
                      View in ElevenLabs Dashboard <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
                <div className={cn(panel, "p-5 space-y-3")}>
                  <h4 className="text-[13px] font-semibold text-white">Supported Languages (29+)</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {["Dutch", "English", "German", "French", "Spanish", "Italian", "Portuguese", "Polish", "Hindi", "Arabic", "Turkish", "Russian", "Japanese", "Chinese", "Korean", "Swedish", "Norwegian", "Danish", "Finnish", "Romanian", "Hungarian", "Czech", "Slovak", "Ukrainian", "Bulgarian", "Greek", "Vietnamese", "Indonesian", "Malay"].map(l => (
                      <span key={l} className="text-[9px] px-2 py-1 rounded-full bg-purple-900/30 text-purple-400 border border-purple-800/20">{l}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── MODELS ────────────────────────────────────────────────────────── */}
          <TabsContent value="models" className="mt-0 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Cpu className="w-4 h-4 text-purple-400" /> Available Models</h3>
              {modelsLoading && <Loader2 className="w-4 h-4 animate-spin text-purple-500" />}
            </div>

            {modelsLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-purple-500" /></div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {(models.length > 0 ? models : MODELS_FALLBACK.map(m => ({
                  model_id: m.id, name: m.name, description: m.desc,
                  can_do_text_to_speech: true, can_do_voice_conversion: false,
                  can_be_finetuned: false, languages: [], token_cost_factor: m.cost,
                }))).map(m => (
                  <ModelCard key={m.model_id} model={m as ELModel}
                    onSelect={() => { setTtsModel(m.model_id); setActiveTab("tts"); toast({ title: `Model selected: ${m.name}`, description: "Switched to TTS Studio" }); }} />
                ))}
              </div>
            )}

            <div className={cn(panel, "p-5")}>
              <h4 className="text-[12px] font-semibold text-white mb-3">Model Comparison</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-purple-900/40">
                      {["Model", "Speed", "Quality", "Cost", "Languages", "Best For"].map(h => (
                        <th key={h} className="text-left py-2 pr-4 text-purple-500 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-900/20">
                    {[
                      { name: "Multilingual v2", speed: "Slow", quality: "Best", cost: "1×", langs: "29+", bestFor: "High quality production" },
                      { name: "Flash v2.5", speed: "Ultra-fast", quality: "Good", cost: "0.5×", langs: "29+", bestFor: "Real-time & low latency" },
                      { name: "Turbo v2.5", speed: "Fast", quality: "Very Good", cost: "0.5×", langs: "29+", bestFor: "Balanced speed & quality" },
                      { name: "Multilingual v1", speed: "Medium", quality: "Good", cost: "1×", langs: "Multiple", bestFor: "Legacy compatibility" },
                      { name: "English v1", speed: "Medium", quality: "Good", cost: "1×", langs: "English only", bestFor: "English-only content" },
                    ].map((r, i) => (
                      <tr key={i} className="hover:bg-purple-900/10 transition-colors">
                        <td className="py-2.5 pr-4 text-white font-medium">{r.name}</td>
                        <td className="py-2.5 pr-4 text-purple-400">{r.speed}</td>
                        <td className="py-2.5 pr-4 text-purple-400">{r.quality}</td>
                        <td className="py-2.5 pr-4 text-purple-400">{r.cost}</td>
                        <td className="py-2.5 pr-4 text-purple-400">{r.langs}</td>
                        <td className="py-2.5 text-purple-500">{r.bestFor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* ── HISTORY ───────────────────────────────────────────────────────── */}
          <TabsContent value="history" className="mt-0 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white">Generation History</h3>
                {historyData?.history && <span className="text-[11px] text-purple-500">({filteredHistory.length} items)</span>}
              </div>
              <div className="flex items-center gap-2">
                {selectedHistory.size > 0 && (
                  <Button size="sm" variant="destructive" onClick={() => {
                    Array.from(selectedHistory).forEach(id => deleteHistoryMutation.mutate(id));
                    setSelectedHistory(new Set());
                  }} className="h-8 text-[11px]">
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete {selectedHistory.size}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => refetchHistory()} className="text-purple-400 hover:text-white h-8 text-[11px]">
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
                </Button>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-purple-500 pointer-events-none" />
                <Input value={historySearch} onChange={e => setHistorySearch(e.target.value)} placeholder="Search history…"
                  className="pl-9 bg-[#0d0820] border-purple-800/40 text-white placeholder:text-purple-700 h-9 text-[12px]" />
              </div>
              <div className="flex gap-1">
                {["all", "TTS", "STS", "SFX"].map(s => (
                  <button key={s} onClick={() => setHistorySource(s)}
                    className={cn("px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors",
                      historySource === s ? "bg-purple-600 text-white" : "text-purple-400 border border-purple-800/30 hover:bg-purple-900/40")}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {historyLoading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-purple-500" /></div>
            ) : filteredHistory.length === 0 ? (
              <div className={cn(panel, "p-16 text-center")}>
                <History className="w-10 h-10 text-purple-800 mx-auto mb-3" />
                <p className="text-purple-600 font-medium">No history yet</p>
                <p className="text-[11px] text-purple-700 mt-1">Generated audio will appear here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredHistory.map(item => {
                  const chars = item.character_count_change_to - item.character_count_change_from;
                  return (
                    <div key={item.history_item_id} className={cn(panel, "p-4 transition-all", selectedHistory.has(item.history_item_id) && "border-purple-500/50 bg-purple-900/20")}>
                      <div className="flex items-start gap-3">
                        <button onClick={() => setSelectedHistory(prev => { const n = new Set(prev); n.has(item.history_item_id) ? n.delete(item.history_item_id) : n.add(item.history_item_id); return n; })}
                          className={cn("w-5 h-5 rounded border mt-0.5 flex items-center justify-center shrink-0 transition-colors",
                            selectedHistory.has(item.history_item_id) ? "bg-purple-600 border-purple-600" : "border-purple-700/40 hover:border-purple-500")}>
                          {selectedHistory.has(item.history_item_id) && <Check className="w-3 h-3 text-white" />}
                        </button>
                        <div className="w-9 h-9 rounded-full bg-purple-900/40 flex items-center justify-center shrink-0">
                          {item.source === "TTS" ? <Volume2 className="w-4 h-4 text-purple-400" /> : <Music className="w-4 h-4 text-purple-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-white font-medium line-clamp-2 leading-snug">{item.text || "(sound effect)"}</p>
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            <span className="text-[10px] text-purple-400 font-medium">{item.voice_name}</span>
                            <span className="text-[10px] text-purple-700">·</span>
                            <Badge className="text-[9px] bg-purple-900/30 text-purple-400 border-purple-800/30 px-1.5 py-0">{item.source}</Badge>
                            <span className="text-[10px] text-purple-600">{chars > 0 ? `${chars} chars` : ""}</span>
                            <span className="text-[10px] text-purple-600">{format(new Date(item.date_unix * 1000), "MMM d, HH:mm")}</span>
                          </div>
                          {historyAudios[item.history_item_id] && (
                            <div className="mt-2">
                              <AudioPlayer b64={historyAudios[item.history_item_id]} label={item.text?.slice(0, 40)} compact />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-1.5 shrink-0">
                          <button onClick={() => playHistoryItem(item.history_item_id)}
                            className="w-8 h-8 rounded-lg bg-purple-900/40 hover:bg-purple-800/60 flex items-center justify-center text-purple-400 transition-colors">
                            {historyLoadingId === item.history_item_id ? <Loader2 className="w-3 h-3 animate-spin" /> : historyAudios[item.history_item_id] ? <Headphones className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => deleteHistoryMutation.mutate(item.history_item_id)}
                            className="w-8 h-8 rounded-lg bg-red-900/20 hover:bg-red-900/40 flex items-center justify-center text-red-400 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

        </div>
      </Tabs>
    </div>
  );
}
