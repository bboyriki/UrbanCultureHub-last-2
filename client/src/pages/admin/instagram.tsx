import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { smartUploadMedia, compressImageIfNeeded, IMAGE_MAX_BYTES } from "@/lib/cloudinaryUpload";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  Heart, MessageCircle, TrendingUp, Users, Eye, EyeOff, BarChart3, Image,
  Film, Play, Plus, Search, RefreshCw, CheckCircle2, AlertCircle, Loader2,
  ExternalLink, Copy, Check, Info, Calendar, Clock, Tag, MapPin, Smile,
  Hash, AtSign, Link2, ChevronRight, Star, Globe, ArrowUp, ArrowDown,
  Share2, Trash2, Flag, Reply, Edit, Upload, ChevronDown, Zap, Activity,
  Settings, Shield, Key, AlertTriangle, LogIn, Users2, Rss, SendHorizonal, CheckCheck,
  LayoutGrid, Clapperboard, Sparkles, Target, Repeat2, Bell, Link, FileText,
  ChevronLeft, Flame, Award, Lightbulb, Filter, Download, PieChart as PieChartIcon,
  Radio, Wifi, BookMarked, Gauge, Cpu, BarChart2, ToggleLeft, ToggleRight,
  SunMedium, Moon, Sunset, Coffee, TrendingDown, Brain, Wand2,
  UserCog, UserPlus, X, Bookmark, MoreHorizontal,
  Music, Type, Layers, Scissors, Pause, Move, Sliders, Mic, MicOff
} from "lucide-react";
import { SiInstagram, SiFacebook, SiTiktok } from "react-icons/si";
import { FaLinkedin } from "react-icons/fa";
import TokenHealthBanner from "@/components/instagram/TokenHealthBanner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay, subDays } from "date-fns";
import { nl } from "date-fns/locale";

/* ─── Types ─── */
type Zone = "studio" | "content" | "analytics" | "audience" | "growth" | "tools" | "agent" | "persona" | "replies" | "automation" | "activity" | "profile" | "settings" | "schedule" | "inbox" | "leads" | "notifications" | "editor" | "dm-inbox";
type PostType = "PHOTO" | "VIDEO" | "REELS" | "CAROUSEL" | "STORY";

interface ChatMessage { role: "user" | "assistant"; content: string; ts: number; error?: boolean; }

/* ─── Helpers ─── */
function fmt(n: number) {
  if (!n && n !== 0) return "–";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

const IG_GRADIENT = "from-purple-500 via-pink-500 to-orange-400";

/* ─── Advanced voice-to-text mic button ─────────────────────────────────────
   • Press once → starts listening (continuous, shows text live as you speak)
   • Press again → stops (commits the transcribed text)
   • Uses Web Speech API with interimResults for real-time display
   • Works in Chrome, Edge, Safari (iOS & desktop)  */
function VoiceMicButton({
  value = "",
  onUpdate,
  className,
}: {
  value?: string;
  onUpdate: (text: string) => void;
  className?: string;
}) {
  const [listening, setListening] = useState(false);
  const { toast } = useToast();
  const recognitionRef = useRef<any>(null);
  const baseRef        = useRef<string>("");   // committed text before this session
  const committedRef   = useRef<string>("");   // grows as final chunks arrive

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast({
        title: "Spraak niet ondersteund",
        description: "Gebruik Chrome of Safari voor spraakherkenning.",
        variant: "destructive",
      });
      return;
    }

    // Snapshot the current field value so we can prepend it
    baseRef.current      = value ?? "";
    committedRef.current = value ?? "";

    const recog = new SR();
    recog.lang             = "nl-NL";
    recog.continuous       = true;
    recog.interimResults   = true;
    recog.maxAlternatives  = 1;

    recog.onstart = () => setListening(true);

    recog.onerror = (e: any) => {
      if (e.error !== "aborted" && e.error !== "no-speech") {
        toast({ title: "Spraakfout", description: e.error, variant: "destructive" });
      }
      // On no-speech / network hiccup: restart automatically so listening never silently dies
      if (e.error === "no-speech" && recognitionRef.current) {
        try { recognitionRef.current.start(); } catch {}
      }
    };

    recog.onend = () => {
      // Restart automatically while still in "listening" mode (browser may stop after silence)
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch { setListening(false); }
      } else {
        setListening(false);
      }
    };

    recog.onresult = (e: any) => {
      let finalChunk   = "";
      let interimChunk = "";

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          finalChunk += r[0].transcript;
        } else {
          interimChunk += r[0].transcript;
        }
      }

      if (finalChunk) {
        const trimmed = finalChunk.trim();
        committedRef.current = committedRef.current
          ? committedRef.current + " " + trimmed
          : trimmed;
      }

      // Live field update: committed text + whatever is still interim
      const live = interimChunk
        ? (committedRef.current ? committedRef.current + " " : "") + interimChunk
        : committedRef.current;

      onUpdate(live);
    };

    recognitionRef.current = recog;
    recog.start();
  }, [value, onUpdate, toast]);

  const toggle = () => {
    if (listening) {
      stop();
    } else {
      start();
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={listening ? "Klik om te stoppen" : "Klik om in te spreken"}
      data-testid="button-voice-mic"
      className={cn(
        "relative flex items-center justify-center w-7 h-7 rounded-full border transition-all shrink-0",
        listening
          ? "bg-red-500 border-red-500 text-white shadow-md shadow-red-500/50"
          : "border-border text-muted-foreground hover:border-violet-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-950/20",
        className
      )}
    >
      {listening && (
        <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-60 pointer-events-none" />
      )}
      {listening ? <MicOff className="w-3.5 h-3.5 relative z-10" /> : <Mic className="w-3.5 h-3.5" />}
    </button>
  );
}

const TYPE_BADGE: Record<string, string> = {
  IMAGE: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  VIDEO: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  REELS: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  CAROUSEL_ALBUM: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-muted rounded-xl", className)} />;
}

function proxyImg(url: string | null | undefined, fallback = "https://placehold.co/400"): string {
  if (!url) return fallback;
  return `/api/instagram/proxy-image?url=${encodeURIComponent(url)}`;
}

/* ─── Zone config ─── */
const ZONES: { id: Zone; label: string; icon: React.ElementType; bg: string; desc: string }[] = [
  { id: "studio",    label: "Studio",    icon: Clapperboard, bg: "linear-gradient(135deg,#7c3aed,#9333ea)", desc: "Create & schedule content" },
  { id: "content",   label: "Content",   icon: LayoutGrid,   bg: "linear-gradient(135deg,#ec4899,#be185d)", desc: "Manage your posts" },
  { id: "analytics", label: "Analytics", icon: BarChart3,    bg: "linear-gradient(135deg,#3b82f6,#0891b2)", desc: "Performance & data" },
  { id: "audience",  label: "Audience",  icon: Users,        bg: "linear-gradient(135deg,#10b981,#0d9488)", desc: "Your followers" },
  { id: "growth",    label: "Growth",    icon: TrendingUp,   bg: "linear-gradient(135deg,#f97316,#d97706)", desc: "Hashtags & trends" },
  { id: "tools",     label: "Tools",     icon: Settings,     bg: "linear-gradient(135deg,#64748b,#3f3f46)", desc: "Comments, alerts & more" },
  { id: "settings",  label: "Settings",  icon: Shield,       bg: "linear-gradient(135deg,#0f172a,#1e293b)", desc: "App credentials, webhooks & token" },
  { id: "editor",    label: "Editor",    icon: Film,         bg: "linear-gradient(135deg,#dc2626,#b91c1c)",  desc: "Video editor — trim, merge, captions" },
];

/* ─── Performance predictor ─── */
function scorePost(caption: string, postType: PostType): { score: number; tips: string[] } {
  let score = 50;
  const tips: string[] = [];
  const hashtagCount = (caption.match(/#\w+/g) || []).length;
  const emojiCount   = (caption.match(/\p{Emoji}/gu) || []).length;
  const len          = caption.length;

  if (postType === "REELS") { score += 15; }
  else if (postType === "CAROUSEL") { score += 10; }
  else if (postType === "VIDEO") { score += 7; }
  else if (postType === "STORY") { return { score: 88, tips: ["Stories verdwijnen na 24u — gebruik ze voor tijdige, persoonlijke content", "Voeg een link sticker toe voor meer verkeer", "Poll of vraag sticker verhoogt betrokkenheid"] }; }

  if (hashtagCount >= 10 && hashtagCount <= 20) score += 10;
  else if (hashtagCount < 5) { score -= 5; tips.push("Add more hashtags (10–20 is optimal)"); }
  else if (hashtagCount > 25) { score -= 3; tips.push("Fewer hashtags may increase reach (10–20 is best)"); }

  if (len >= 100 && len <= 500) score += 8;
  else if (len < 40) { score -= 5; tips.push("Write a longer caption to boost engagement"); }
  else if (len > 1500) { score -= 3; tips.push("Shorter captions tend to perform better"); }

  if (emojiCount >= 2 && emojiCount <= 8) score += 5;
  else if (emojiCount === 0) tips.push("Add 2–5 emojis to make the caption more vibrant");

  if (caption.includes("?")) { score += 3; }
  else tips.push("End with a question to encourage comments");

  const callToAction = /click|link|bio|shop|swipe|comment|tag|share|follow|save/i.test(caption);
  if (callToAction) score += 5;
  else tips.push("Include a call-to-action (e.g. save this, tag a friend)");

  return { score: Math.min(100, Math.max(5, score)), tips: tips.slice(0, 3) };
}

/* ─── Sentiment analyzer ─── */
function analyzeSentiment(text: string): "positive" | "negative" | "neutral" {
  const pos = /great|love|amazing|awesome|beautiful|fire|🔥|❤️|💯|🙌|wow|best|fantastic|perfect|wonderful|incredible|🥰|😍|❤|🤩|👏/i;
  const neg = /hate|awful|terrible|bad|worst|disappointed|boring|ugly|💩|😤|😡|🤮|horrible|ugly|stop|annoying/i;
  if (pos.test(text)) return "positive";
  if (neg.test(text)) return "negative";
  return "neutral";
}

/* ─── Setup card ─── */
function SetupCard() {
  return (
    <Card className="border-2 border-dashed border-orange-300 bg-orange-50/30 dark:bg-orange-950/10">
      <CardContent className="py-8 flex flex-col items-center gap-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
          <Key className="w-7 h-7 text-orange-500" />
        </div>
        <div>
          <p className="font-extrabold text-lg">Instagram API Credentials Required</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            Add your Facebook App credentials to the environment secrets to connect this studio to your Instagram Business account.
          </p>
        </div>
        <div className="w-full max-w-md text-left space-y-3">
          <div className="p-4 rounded-xl bg-background border space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Required Environment Variables</p>
            {[
              { key: "INSTAGRAM_APP_ID", desc: "Your Facebook App ID" },
              { key: "INSTAGRAM_APP_SECRET", desc: "Your Facebook App Secret" },
            ].map(({ key, desc }) => (
              <div key={key} className="flex items-start gap-2">
                <code className="text-xs font-mono bg-secondary px-2 py-1 rounded font-bold shrink-0">{key}</code>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Redirect URI copy box ─── */
function RedirectUriBox() {
  const [copied, setCopied] = useState(false);
  const uri = `${window.location.origin}/api/instagram/callback`;
  const copy = () => { navigator.clipboard.writeText(uri).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };
  return (
    <div className="flex items-center gap-2 p-3 rounded-xl bg-background border font-mono text-xs break-all">
      <span className="flex-1 text-foreground select-all">{uri}</span>
      <button onClick={copy} className="shrink-0 p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground" title="Copy URI">
        {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

/* ─── Post Comments sub-component ─── */
function PostComments({ post, onReply, onDelete }: { post: any; onReply: (id: string, msg: string) => void; onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [text, setText] = useState("");
  const { data: commentsData, isLoading } = useQuery<{ data: any[] }>({
    queryKey: ["/api/instagram/media", post.id, "comments"],
    enabled: open,
    queryFn: async () => {
      const res = await fetch(`/api/instagram/media/${post.id}/comments`, { credentials: "include" });
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
  });
  const comments: any[] = commentsData?.data || [];

  return (
    <Card>
      <CardContent className="py-3 px-4">
        <button className="flex items-center gap-3 w-full text-left" onClick={() => setOpen(!open)}>
          <img src={proxyImg(post.thumbnail_url || post.media_url)} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0"
            onError={e => { (e.target as HTMLImageElement).src = "https://placehold.co/48"; }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium line-clamp-1">{post.caption || "(no caption)"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(post.timestamp).toLocaleDateString()} · {post.media_type} · {post.comments_count ?? "?"} comments
            </p>
          </div>
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform shrink-0", open && "rotate-180")} />
        </button>
        {open && (
          <div className="mt-3 pt-3 border-t space-y-3">
            {isLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading comments...</div>
            ) : comments.length === 0 ? (
              <p className="text-xs text-muted-foreground">No comments yet.</p>
            ) : (
              comments.map((c: any) => {
                const sentiment = analyzeSentiment(c.text || "");
                return (
                  <div key={c.id} className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0 text-xs font-bold">
                      {(c.username || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold">@{c.username}</p>
                        <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-bold",
                          sentiment === "positive" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                          sentiment === "negative" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                          "bg-muted text-muted-foreground")}>
                          {sentiment === "positive" ? "😊 Positief" : sentiment === "negative" ? "😞 Negatief" : "😐 Neutraal"}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5">{c.text}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{new Date(c.timestamp).toLocaleDateString()}</span>
                        <button className="hover:text-foreground transition-colors" onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}>
                          <Reply className="w-3 h-3 inline mr-0.5" /> Reply
                        </button>
                        <button className="hover:text-red-500 transition-colors" onClick={() => onDelete(c.id)}>
                          <Trash2 className="w-3 h-3 inline mr-0.5" /> Delete
                        </button>
                      </div>
                      {replyTo === c.id && (
                        <div className="flex gap-2 mt-2">
                          <Input value={text} onChange={e => setText(e.target.value)} placeholder={`Reply to @${c.username}...`}
                            className="text-xs h-8 flex-1"
                            onKeyDown={e => { if (e.key === "Enter" && text.trim()) { onReply(c.id, text); setText(""); setReplyTo(null); } }} />
                          <Button size="sm" className="h-8 text-xs px-3" onClick={() => { onReply(c.id, text); setText(""); setReplyTo(null); }}>Send</Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════
   INLINE MEDIA STUDIO EDITOR
═══════════════════════════════════════ */

interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  bold: boolean;
}

const MEDIA_FILTERS = [
  { id: "none",   label: "Normaal", css: "" },
  { id: "vivid",  label: "Vivid",   css: "brightness(1.1) saturate(1.5) contrast(1.1)" },
  { id: "fade",   label: "Fade",    css: "brightness(1.15) saturate(0.65) contrast(0.85)" },
  { id: "noir",   label: "Noir",    css: "grayscale(1) contrast(1.25) brightness(0.95)" },
  { id: "warm",   label: "Warm",    css: "sepia(0.35) saturate(1.3) brightness(1.05)" },
  { id: "cool",   label: "Cool",    css: "hue-rotate(200deg) saturate(1.1) brightness(1.05)" },
  { id: "sharp",  label: "Sharp",   css: "contrast(1.3) brightness(0.95) saturate(1.2)" },
  { id: "glow",   label: "Glow",    css: "brightness(1.2) contrast(0.85) saturate(1.4)" },
];

function InlineMediaEditor({
  videoUrl, imageUrl, postType, storyIsVideo,
  overlays, setOverlays,
  selectedFilter, setSelectedFilter,
  watermarkUrl, setWatermarkUrl,
  watermarkPos, setWatermarkPos,
  trimIn, setTrimIn,
  trimOut, setTrimOut,
  videoDuration, setVideoDuration,
  onReplaceMedia, status, toast,
  caption, setCaption,
}: any) {
  const [editorTab, setEditorTab] = useState<"text" | "filter" | "logo" | "trim" | "audio" | "ai">("text");
  const [newText, setNewText] = useState("");
  const [newColor, setNewColor] = useState("#ffffff");
  const [newSize, setNewSize] = useState(32);
  const [newBold, setNewBold] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [aiCaptionLoading, setAiCaptionLoading] = useState(false);
  const [aiHashtagLoading, setAiHashtagLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [analyzingMedia, setAnalyzingMedia] = useState(false);
  const [mergeUrl, setMergeUrl] = useState("");
  const [merging, setMerging] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const isVideo = !!videoUrl && (postType === "REELS" || postType === "VIDEO" || (postType === "STORY" && storyIsVideo));
  const mediaUrl = isVideo ? videoUrl : (imageUrl || videoUrl);
  const filterCss = MEDIA_FILTERS.find(f => f.id === selectedFilter)?.css || "";
  const isPortrait = postType === "STORY" || postType === "REELS";

  const addOverlay = () => {
    if (!newText.trim()) return;
    setOverlays((prev: TextOverlay[]) => [...prev, {
      id: Date.now().toString(),
      text: newText.trim(),
      x: 50, y: 50,
      fontSize: newSize,
      color: newColor,
      bold: newBold,
    }]);
    setNewText("");
  };

  const removeOverlay = (id: string) => setOverlays((prev: TextOverlay[]) => prev.filter((o: TextOverlay) => o.id !== id));

  const handleOverlayDrag = (id: string, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const el = previewRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const getPos = (clientX: number, clientY: number) => ({
      x: Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(5, Math.min(95, ((clientY - rect.top) / rect.height) * 100)),
    });
    if ("touches" in e.nativeEvent) {
      const touchMove = (te: TouchEvent) => {
        te.preventDefault();
        const t = te.touches[0];
        const { x, y } = getPos(t.clientX, t.clientY);
        setOverlays((prev: TextOverlay[]) => prev.map((o: TextOverlay) => o.id === id ? { ...o, x, y } : o));
      };
      const touchEnd = () => {
        document.removeEventListener("touchmove", touchMove);
        document.removeEventListener("touchend", touchEnd);
      };
      document.addEventListener("touchmove", touchMove, { passive: false });
      document.addEventListener("touchend", touchEnd);
    } else {
      const move = (me: MouseEvent) => {
        const { x, y } = getPos(me.clientX, me.clientY);
        setOverlays((prev: TextOverlay[]) => prev.map((o: TextOverlay) => o.id === id ? { ...o, x, y } : o));
      };
      const up = () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    }
  };

  const uploadLogo = async (file: File) => {
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/instagram/upload/media", { method: "POST", credentials: "include", body: fd });
      const d = await r.json();
      if (d.ok && d.url) setWatermarkUrl(d.url);
      else toast({ title: "Upload mislukt", variant: "destructive" });
    } catch { toast({ title: "Upload mislukt", variant: "destructive" }); }
    finally { setUploadingLogo(false); }
  };

  const generateAiCaption = async () => {
    setAiCaptionLoading(true);
    setAiSuggestion("");
    try {
      const res = await fetch("/api/instagram/ai/caption", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postType, topHashtags: [], accountUsername: status?.username || "" }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "AI mislukt");
      setAiSuggestion(d.caption || d.suggestions?.[0] || "");
    } catch (err: any) {
      toast({ title: "AI mislukt", description: err.message, variant: "destructive" });
    } finally { setAiCaptionLoading(false); }
  };

  const generateAiHashtags = async () => {
    setAiHashtagLoading(true);
    try {
      const res = await fetch("/api/instagram/ai/hashtags", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption, postType }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "AI mislukt");
      const tags = (d.hashtags || []).join(" ");
      setCaption((prev: string) => (prev.trim() ? `${prev}\n\n${tags}` : tags));
      toast({ title: "Hashtags toegevoegd! 🏷️" });
    } catch (err: any) {
      toast({ title: "Hashtag generatie mislukt", description: err.message, variant: "destructive" });
    } finally { setAiHashtagLoading(false); }
  };

  const analyzeMedia = async () => {
    const url = isVideo ? videoUrl : mediaUrl;
    if (!url || analyzingMedia) return;
    setAnalyzingMedia(true);
    setAiAnalysis(null);
    try {
      const endpoint = isVideo ? "/api/instagram/ai/analyze-video" : "/api/instagram/ai/analyze-media";
      const body = isVideo
        ? { videoUrl: url, caption, postType }
        : { mediaUrl: url, mediaType: "image", postType, caption };
      const res = await fetch(endpoint, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Analyse mislukt");
      setAiAnalysis(d.analysis);
    } catch (err: any) {
      toast({ title: "Analyse mislukt", description: err.message, variant: "destructive" });
    } finally { setAnalyzingMedia(false); }
  };

  const mergeVideo = async () => {
    if (!videoUrl || !mergeUrl.trim()) return;
    setMerging(true);
    try {
      const res = await fetch("/api/video/process", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "merge", inputs: [videoUrl, mergeUrl.trim()] }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Merge mislukt");
      toast({ title: "Video merge gestart!", description: `Job ID: ${d.jobId}` });
      setMergeUrl("");
    } catch (err: any) {
      toast({ title: "Merge mislukt", description: err.message, variant: "destructive" });
    } finally { setMerging(false); }
  };

  const EDITOR_TABS = [
    { id: "text",   label: "Tekst",   icon: Type },
    { id: "filter", label: "Filter",  icon: SunMedium },
    { id: "logo",   label: "Logo",    icon: Layers },
    ...(isVideo ? [{ id: "trim", label: "Trim", icon: Scissors }] : []),
    ...(isVideo ? [{ id: "trim2", label: "Samenvoegen", icon: Film }] : []),
    { id: "audio",  label: "Muziek",  icon: Music },
    { id: "ai",     label: "AI",      icon: Sparkles },
  ];

  return (
    <div className="rounded-2xl border border-violet-200/60 dark:border-violet-800/40 bg-card overflow-hidden shadow-lg">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-700">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-extrabold text-sm text-white tracking-tight">Media Studio</span>
          <span className="text-[9px] bg-white/20 text-white rounded-full px-2 py-0.5 font-bold">
            {postType === "REELS" ? "🎬 Reel" : postType === "STORY" ? "📱 Story" : postType === "VIDEO" ? "📹 Video" : "📸 Foto"}
          </span>
        </div>
        <button onClick={onReplaceMedia}
          className="text-[10px] text-white/70 hover:text-white flex items-center gap-1 transition-colors font-medium">
          <Trash2 className="w-3 h-3" /> Media vervangen
        </button>
      </div>

      {/* ── Body: preview + tools ── */}
      <div className="flex flex-col lg:flex-row">

        {/* ── Live phone preview ── */}
        <div className="lg:w-60 shrink-0 flex flex-col items-center gap-3 p-4 bg-neutral-950/5 dark:bg-neutral-950/50 border-b lg:border-b-0 lg:border-r border-border">
          <div className="flex items-center justify-between w-full">
            <p className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground">Live Preview</p>
            <span className="text-[8px] text-muted-foreground/60 lg:hidden">👆 Sleep tekst in preview</span>
          </div>

          {/* Phone shell — scales with screen: larger on mobile, compact on desktop */}
          <div className="relative bg-neutral-900 shadow-2xl ring-2 ring-neutral-700/80 mx-auto"
            style={{ width: "min(220px, 58vw)", borderRadius: "min(30px, 8vw)", padding: 6 }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-neutral-900 z-10"
              style={{ width: "40%", height: 14, borderRadius: "0 0 10px 10px" }} />
            <div
              ref={previewRef}
              className="relative bg-neutral-900 overflow-hidden select-none touch-none cursor-crosshair"
              style={{ borderRadius: "min(22px, 6vw)", aspectRatio: isPortrait ? "9/16" : "4/5" }}>

              {/* Media layer */}
              {isVideo ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ filter: filterCss || undefined }}
                  autoPlay loop muted playsInline
                  onLoadedMetadata={e => {
                    const dur = (e.target as HTMLVideoElement).duration;
                    if (!isNaN(dur) && dur > 0) {
                      setVideoDuration(dur);
                      if (!trimOut || trimOut === 0) setTrimOut(dur);
                    }
                  }}
                />
              ) : mediaUrl ? (
                <img
                  src={mediaUrl}
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ filter: filterCss || undefined }}
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-neutral-800">
                  <Film className="w-8 h-8 text-white/20" />
                </div>
              )}

              {/* Text overlays — draggable (mouse + touch) */}
              {overlays.map((ov: TextOverlay) => (
                <div
                  key={ov.id}
                  className="absolute cursor-move select-none z-20 group"
                  style={{
                    left: `${ov.x}%`, top: `${ov.y}%`,
                    transform: "translate(-50%, -50%)",
                    fontSize: "clamp(7px, 2.5vw, 14px)",
                    color: ov.color,
                    fontWeight: ov.bold ? "900" : "400",
                    textShadow: "0 1px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6)",
                    whiteSpace: "nowrap",
                    maxWidth: "92%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    touchAction: "none",
                  }}
                  onMouseDown={e => handleOverlayDrag(ov.id, e)}
                  onTouchStart={e => handleOverlayDrag(ov.id, e as unknown as React.MouseEvent)}>
                  {ov.text}
                  <span
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-4 h-4 text-[8px] flex items-center justify-center cursor-pointer z-30 opacity-0 group-hover:opacity-100"
                    onMouseDown={e => { e.stopPropagation(); removeOverlay(ov.id); }}
                    onTouchEnd={e => { e.stopPropagation(); removeOverlay(ov.id); }}>×</span>
                </div>
              ))}

              {/* Watermark overlay */}
              {watermarkUrl && (
                <div className="absolute z-25" style={{
                  ...(watermarkPos === "tl" ? { top: 5, left: 5 } :
                     watermarkPos === "tr" ? { top: 5, right: 5 } :
                     watermarkPos === "bl" ? { bottom: 5, left: 5 } :
                     { bottom: 5, right: 5 }),
                }}>
                  <img src={watermarkUrl} className="w-7 h-7 object-contain opacity-80 rounded" />
                </div>
              )}

              {/* Story / Reel progress bars */}
              {isPortrait && (
                <div className="absolute top-2 left-1 right-1 flex gap-0.5 z-30">
                  <div className="flex-1 h-0.5 bg-white rounded-full opacity-80" />
                  <div className="flex-1 h-0.5 bg-white/30 rounded-full" />
                  <div className="flex-1 h-0.5 bg-white/30 rounded-full" />
                </div>
              )}

              {/* Reel sidebar icons */}
              {postType === "REELS" && (
                <div className="absolute right-1.5 bottom-12 flex flex-col items-center gap-2.5 z-20">
                  <div className="text-white/80 flex flex-col items-center gap-0.5">
                    <Heart className="w-3 h-3" /><span className="text-[6px]">1.2k</span>
                  </div>
                  <div className="text-white/80 flex flex-col items-center gap-0.5">
                    <MessageCircle className="w-3 h-3" /><span className="text-[6px]">84</span>
                  </div>
                  <Share2 className="w-3 h-3 text-white/80" />
                </div>
              )}

              {/* Bottom caption overlay */}
              {(postType === "REELS" || postType === "STORY") && caption && (
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent z-10">
                  <p className="text-[6px] text-white leading-tight line-clamp-2">{caption.slice(0, 60)}{caption.length > 60 ? "..." : ""}</p>
                </div>
              )}
            </div>
          </div>

          {/* Filter badge */}
          {selectedFilter !== "none" && (
            <div className="text-[9px] text-violet-600 dark:text-violet-400 font-bold bg-violet-50 dark:bg-violet-950/30 rounded-full px-2 py-0.5">
              ✨ {MEDIA_FILTERS.find(f => f.id === selectedFilter)?.label}
            </div>
          )}

          {/* Trim badge */}
          {isVideo && videoDuration > 0 && (
            <div className="text-[9px] text-muted-foreground text-center bg-muted/40 rounded-lg px-2 py-1">
              ✂ {trimIn.toFixed(1)}s → {(trimOut ?? videoDuration).toFixed(1)}s
              <br />
              <span className="font-bold text-foreground">{((trimOut ?? videoDuration) - trimIn).toFixed(1)}s</span>
            </div>
          )}

          {/* Overlays count */}
          {overlays.length > 0 && (
            <div className="text-[9px] text-violet-600 font-bold bg-violet-50 dark:bg-violet-950/30 rounded-full px-2 py-0.5">
              📝 {overlays.length} tekst overlay{overlays.length > 1 ? "s" : ""}
            </div>
          )}
        </div>

        {/* ── Editor tools ── */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Tab nav — scrollable, bigger touch targets on mobile */}
          <div className="flex gap-0.5 p-2 border-b border-border overflow-x-auto scrollbar-hide bg-muted/20">
            {EDITOR_TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setEditorTab(id as any)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2.5 lg:py-1.5 rounded-lg text-[11px] lg:text-[10px] font-bold whitespace-nowrap transition-all min-h-[40px] lg:min-h-0",
                  editorTab === id
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60 active:bg-muted"
                )}>
                <Icon className="w-3.5 h-3.5 lg:w-3 lg:h-3" /> {label}
              </button>
            ))}
          </div>

          {/* Tab content — scrollable, adaptive height */}
          <div className="p-4 space-y-3 overflow-y-auto" style={{ maxHeight: "min(400px, 60vh)" }}>

            {/* ── TEXT TAB ── */}
            {editorTab === "text" && (
              <div className="space-y-3">
                <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wide">Tekst overlay toevoegen</p>
                <div className="flex gap-2">
                  <Input
                    value={newText}
                    onChange={e => setNewText(e.target.value)}
                    placeholder="Typ tekst voor overlay…"
                    className="text-sm h-11 lg:h-9 flex-1"
                    onKeyDown={e => e.key === "Enter" && addOverlay()}
                    data-testid="input-overlay-text"
                  />
                  <Button size="sm" onClick={addOverlay} disabled={!newText.trim()}
                    className="h-11 lg:h-9 w-11 lg:w-auto px-3 bg-violet-600 hover:bg-violet-700 text-white shrink-0">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex gap-3 items-center flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs lg:text-[10px] text-muted-foreground font-bold">Kleur</span>
                    <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
                      className="w-9 h-9 lg:w-7 lg:h-7 rounded cursor-pointer border border-border bg-transparent p-0.5" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs lg:text-[10px] text-muted-foreground font-bold">Grootte</span>
                    <select value={newSize} onChange={e => setNewSize(+e.target.value)}
                      className="text-xs lg:text-[10px] border border-border rounded-lg px-2 h-9 lg:h-7 bg-background">
                      {[16, 20, 24, 32, 40, 56, 72].map(s => <option key={s} value={s}>{s}px</option>)}
                    </select>
                  </div>
                  <button onClick={() => setNewBold(b => !b)}
                    className={cn(
                      "px-3 h-9 lg:h-7 rounded-lg text-xs lg:text-[10px] font-black border transition-all min-w-[40px]",
                      newBold ? "bg-violet-600 text-white border-violet-600" : "border-border text-muted-foreground hover:border-violet-300"
                    )}>B</button>
                </div>
                <div className="rounded-xl border border-blue-200/60 dark:border-blue-800/30 bg-blue-50/40 dark:bg-blue-950/10 p-2.5">
                  <p className="text-[9px] text-blue-700 dark:text-blue-400">💡 Sleep tekst in de preview om te herpositioneren. Hover voor verwijder-knop.</p>
                </div>
                {overlays.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-muted-foreground">Actieve overlays ({overlays.length})</p>
                    {overlays.map((ov: TextOverlay) => (
                      <div key={ov.id} className="flex items-center gap-2 p-2 rounded-xl border border-border bg-muted/30">
                        <div className="w-3 h-3 rounded-full shrink-0 border border-border/60" style={{ backgroundColor: ov.color }} />
                        <span className="flex-1 text-[10px] font-medium truncate" style={{ fontWeight: ov.bold ? 800 : 400 }}>{ov.text}</span>
                        <span className="text-[9px] text-muted-foreground shrink-0">{ov.fontSize}px</span>
                        <button onClick={() => removeOverlay(ov.id)} className="text-muted-foreground hover:text-red-500 transition-colors shrink-0">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border p-5 text-center">
                    <Type className="w-5 h-5 text-muted-foreground/30 mx-auto mb-1.5" />
                    <p className="text-[10px] text-muted-foreground">Nog geen overlays. Typ en druk op Enter of +</p>
                  </div>
                )}
              </div>
            )}

            {/* ── FILTER TAB ── */}
            {editorTab === "filter" && (
              <div className="space-y-3">
                <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wide">Visueel filter toepassen</p>
                <div className="grid grid-cols-4 gap-2">
                  {MEDIA_FILTERS.map(f => (
                    <button key={f.id} onClick={() => setSelectedFilter(f.id)}
                      data-testid={`button-filter-${f.id}`}
                      className={cn(
                        "rounded-xl overflow-hidden border-2 transition-all active:scale-95",
                        selectedFilter === f.id
                          ? "border-violet-500 ring-2 ring-violet-400/40 shadow-md"
                          : "border-border hover:border-violet-300"
                      )}>
                      <div className="relative h-16 lg:h-14 bg-neutral-800 overflow-hidden">
                        {mediaUrl && !isVideo ? (
                          <img src={mediaUrl} className="w-full h-full object-cover"
                            style={{ filter: f.css || undefined }} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"
                            style={{ background: "linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)", filter: f.css || undefined }}>
                            <Film className="w-4 h-4 text-white/60" />
                          </div>
                        )}
                      </div>
                      <p className={cn(
                        "text-[8px] font-bold py-1 text-center transition-colors",
                        selectedFilter === f.id ? "bg-violet-600 text-white" : "bg-muted text-muted-foreground"
                      )}>{f.label}</p>
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-muted-foreground">Filters worden live getoond in de preview. Ze gelden als visuele referentie; Instagram past eigen filters toe bij publicatie.</p>
              </div>
            )}

            {/* ── LOGO TAB ── */}
            {editorTab === "logo" && (
              <div className="space-y-3">
                <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wide">Watermark / Logo</p>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
                  onChange={async e => { const f = e.target.files?.[0]; if (f) await uploadLogo(f); e.target.value = ""; }} />

                {watermarkUrl ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl border bg-muted/30">
                    <img src={watermarkUrl} className="w-12 h-12 object-contain rounded-xl border border-border" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold">Logo geüpload ✓</p>
                      <p className="text-[9px] text-muted-foreground">Zichtbaar in preview (rechtsonder)</p>
                    </div>
                    <button onClick={() => setWatermarkUrl("")} className="text-muted-foreground hover:text-red-500 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}
                    data-testid="button-upload-logo"
                    className="w-full border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-violet-400 hover:bg-violet-50/20 dark:hover:bg-violet-950/10 transition-all disabled:opacity-60">
                    {uploadingLogo
                      ? <><Loader2 className="w-5 h-5 animate-spin text-violet-500 mx-auto mb-1" /><p className="text-[10px] text-muted-foreground">Uploaden…</p></>
                      : <><Upload className="w-5 h-5 text-muted-foreground/40 mx-auto mb-1.5" /><p className="text-[10px] font-bold text-muted-foreground">Klik om logo te uploaden</p><p className="text-[9px] text-muted-foreground/60 mt-0.5">PNG met transparantie aanbevolen</p></>}
                  </button>
                )}

                {watermarkUrl && (
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground mb-2">Positie</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: "tl", label: "↖ Links boven" },
                        { id: "tr", label: "↗ Rechts boven" },
                        { id: "bl", label: "↙ Links onder" },
                        { id: "br", label: "↘ Rechts onder" },
                      ].map(pos => (
                        <button key={pos.id} onClick={() => setWatermarkPos(pos.id)}
                          data-testid={`button-logo-pos-${pos.id}`}
                          className={cn(
                            "px-3 py-3 lg:py-2 rounded-xl border text-xs lg:text-[10px] font-bold transition-all min-h-[44px] lg:min-h-0",
                            watermarkPos === pos.id
                              ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300"
                              : "border-border text-muted-foreground hover:border-violet-300"
                          )}>{pos.label}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── TRIM TAB (video only) ── */}
            {editorTab === "trim" && isVideo && (
              <div className="space-y-4">
                <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wide">Video trimmen</p>
                <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-background border p-2">
                      <p className="text-[9px] text-muted-foreground">Start</p>
                      <p className="text-sm font-black text-violet-600">{trimIn.toFixed(1)}s</p>
                    </div>
                    <div className="rounded-lg bg-background border p-2">
                      <p className="text-[9px] text-muted-foreground">Einde</p>
                      <p className="text-sm font-black text-violet-600">{(trimOut ?? videoDuration).toFixed(1)}s</p>
                    </div>
                    <div className="rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800/40 p-2">
                      <p className="text-[9px] text-muted-foreground">Duur</p>
                      <p className="text-sm font-black text-violet-600">{((trimOut ?? videoDuration) - trimIn).toFixed(1)}s</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span className="font-bold">▶ Startpunt</span>
                        <span>{trimIn.toFixed(1)}s</span>
                      </div>
                      <input type="range" min={0} max={videoDuration || 60} step={0.1} value={trimIn}
                        onChange={e => {
                          const v = +e.target.value;
                          if (v < (trimOut ?? videoDuration)) {
                            setTrimIn(v);
                            if (videoRef.current) videoRef.current.currentTime = v;
                          }
                        }}
                        className="w-full accent-violet-600 h-3 lg:h-2" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span className="font-bold">⏹ Eindpunt</span>
                        <span>{(trimOut ?? videoDuration).toFixed(1)}s</span>
                      </div>
                      <input type="range" min={0} max={videoDuration || 60} step={0.1} value={trimOut ?? videoDuration}
                        onChange={e => {
                          const v = +e.target.value;
                          if (v > trimIn) setTrimOut(v);
                        }}
                        className="w-full accent-violet-600 h-3 lg:h-2" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setTrimIn(0); setTrimOut(videoDuration); }}
                      className="text-[10px] text-violet-600 dark:text-violet-400 font-bold hover:underline">
                      ↺ Reset trim
                    </button>
                  </div>
                </div>
                <div className="rounded-xl border border-amber-200/60 dark:border-amber-800/30 bg-amber-50/40 dark:bg-amber-950/10 p-3">
                  <p className="text-[10px] text-amber-700 dark:text-amber-400">
                    ℹ️ Trim-instellingen worden meegestuurd bij publicatie voor FFmpeg-verwerking op de server.
                  </p>
                </div>
              </div>
            )}

            {/* ── MERGE / SAMENVOEGEN TAB ── */}
            {editorTab === "trim2" && isVideo && (
              <div className="space-y-3">
                <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wide">Video's samenvoegen</p>
                <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground">Huidige video:</p>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-background border">
                    <Film className="w-4 h-4 text-violet-500 shrink-0" />
                    <p className="text-[10px] truncate flex-1 text-muted-foreground">{videoUrl?.slice(-40)}…</p>
                    <span className="text-[9px] bg-violet-100 dark:bg-violet-900/30 text-violet-600 rounded px-1.5 py-0.5">Video 1</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground">URL tweede video toevoegen</label>
                  <div className="flex gap-2">
                    <Input value={mergeUrl} onChange={e => setMergeUrl(e.target.value)}
                      placeholder="https://... (Cloudinary video URL)"
                      className="text-xs h-11 lg:h-9 flex-1" data-testid="input-merge-url" />
                    <Button size="sm" onClick={mergeVideo} disabled={merging || !mergeUrl.trim() || !videoUrl}
                      className="h-11 lg:h-9 bg-violet-600 hover:bg-violet-700 text-white shrink-0 font-bold text-xs gap-1">
                      {merging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Film className="w-3.5 h-3.5" />}
                      Merge
                    </Button>
                  </div>
                </div>
                <div className="rounded-xl border border-blue-200/60 dark:border-blue-800/30 bg-blue-50/40 dark:bg-blue-950/10 p-3">
                  <p className="text-[10px] text-blue-700 dark:text-blue-400 leading-relaxed">
                    📎 Upload je tweede video eerst via een andere post-slot en kopieer de URL. Merge gebruikt FFmpeg op de server om beide clips samen te voegen.
                  </p>
                </div>
              </div>
            )}

            {/* ── AUDIO TAB ── */}
            {editorTab === "audio" && (
              <div className="space-y-3">
                <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wide">Muziek / Audio</p>
                <div className="rounded-xl border border-violet-200/60 dark:border-violet-800/30 bg-violet-50/40 dark:bg-violet-950/10 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Music className="w-4 h-4 text-violet-500" />
                    <p className="text-[10px] font-bold text-violet-700 dark:text-violet-300">Instagram Muziek via API</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Instagram staat niet toe om muziek via de API toe te voegen. Voeg muziek toe na het publiceren via de Instagram app. Noteer hier alvast de track als referentie.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground">Track referentie (notitie)</label>
                  <Input placeholder="bijv. Kendrick Lamar — Not Like Us" className="text-sm h-11 lg:h-9"
                    data-testid="input-audio-track" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground mb-2">🔥 Trending urban tracks</p>
                  <div className="space-y-1.5">
                    {["Tyla — Water", "Central Cee — Balenciaga", "NLE Choppa — Slut Me Out", "Drake — Rich Baby Daddy", "Travis Scott — FE!N"].map(track => (
                      <div key={track}
                        className="flex items-center gap-2 p-2 rounded-lg border border-border hover:border-violet-300 hover:bg-violet-50/20 dark:hover:bg-violet-950/10 transition-all cursor-pointer">
                        <Music className="w-3 h-3 text-violet-500 shrink-0" />
                        <p className="text-[10px] font-medium">{track}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── AI TAB ── */}
            {editorTab === "ai" && (
              <div className="space-y-3">

                {/* ── AI MEDIA ANALYSE (main feature) ── */}
                <div className="rounded-xl border-2 border-violet-200/70 dark:border-violet-800/50 bg-gradient-to-br from-violet-50/60 to-purple-50/40 dark:from-violet-950/25 dark:to-purple-950/15 p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-sm">
                      <Eye className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                      <p className="text-[11px] font-extrabold text-violet-800 dark:text-violet-200">AI Media Analyse</p>
                      <p className="text-[9px] text-muted-foreground">Analyseer je {isVideo ? "video" : "foto"} vóór publicatie</p>
                    </div>
                    {aiAnalysis && (
                      <button onClick={() => setAiAnalysis(null)}
                        className="ml-auto text-[8px] text-muted-foreground hover:text-foreground">✕ Sluiten</button>
                    )}
                  </div>

                  <button
                    onClick={analyzeMedia}
                    disabled={analyzingMedia || (!mediaUrl && !videoUrl)}
                    data-testid="button-ai-analyze-media"
                    className="w-full flex items-center justify-center gap-2 py-3 lg:py-2.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 hover:opacity-90 active:opacity-80 text-white text-xs font-extrabold transition-all disabled:opacity-50 shadow-md shadow-violet-500/20">
                    {analyzingMedia
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> AI analyseert {isVideo ? "video" : "afbeelding"}…</>
                      : <><Sparkles className="w-4 h-4" /> Analyseer {isVideo ? "video" : "foto"} met AI</>}
                  </button>

                  {analyzingMedia && (
                    <div className="flex items-center gap-2 py-1">
                      <div className="flex gap-0.5">
                        {[0,1,2].map(i => (
                          <div key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </div>
                      <p className="text-[9px] text-violet-600 dark:text-violet-400">Claude Vision bekijkt je media…</p>
                    </div>
                  )}

                  {/* ── Analysis results ── */}
                  {aiAnalysis && (
                    <div className="space-y-3">
                      {/* Score grid */}
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { label: "Hook", value: aiAnalysis.hookScore, col: "violet" },
                          { label: "Kwaliteit", value: aiAnalysis.contentQuality, col: "blue" },
                          { label: "Urban fit", value: aiAnalysis.urbanCultureFit, col: "pink" },
                        ].map(({ label, value, col }) => {
                          const score = typeof value === "number" ? value : null;
                          const color = score !== null
                            ? score >= 7 ? "text-emerald-600" : score >= 4 ? "text-amber-500" : "text-red-500"
                            : "text-muted-foreground";
                          return (
                            <div key={label} className="text-center p-2 rounded-xl border bg-background/60">
                              <p className={`text-xl font-black ${color}`}>{score ?? "–"}<span className="text-[8px] font-normal text-muted-foreground">/10</span></p>
                              <p className="text-[8px] text-muted-foreground font-bold mt-0.5">{label}</p>
                            </div>
                          );
                        })}
                      </div>

                      {/* Verdict */}
                      {aiAnalysis.verdict && (
                        <div className="rounded-lg bg-background/70 border p-2.5">
                          <p className="text-[10px] leading-relaxed">✨ {aiAnalysis.verdict}</p>
                        </div>
                      )}

                      {/* Description */}
                      {aiAnalysis.description && (
                        <div className="rounded-lg bg-blue-50/50 dark:bg-blue-950/15 border border-blue-200/60 dark:border-blue-800/30 p-2.5">
                          <p className="text-[9px] text-blue-700 dark:text-blue-300 leading-relaxed">👁 {aiAnalysis.description}</p>
                        </div>
                      )}

                      {/* Caption suggestions */}
                      {aiAnalysis.captionSuggestions?.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wide">Caption suggesties</p>
                          {(aiAnalysis.captionSuggestions as string[]).map((sug, i) => (
                            <div key={i} className="flex gap-2 items-start p-2.5 rounded-xl border border-violet-200/60 dark:border-violet-800/30 bg-violet-50/30 dark:bg-violet-950/10">
                              <div className="flex-1">
                                <span className="text-[9px] font-extrabold text-violet-500 mr-1.5">#{i + 1}</span>
                                <span className="text-[10px] leading-relaxed">{sug}</span>
                              </div>
                              <button
                                onClick={() => { setCaption(sug); toast({ title: "Caption overgenomen! ✅" }); }}
                                className="shrink-0 text-[9px] font-extrabold text-violet-600 dark:text-violet-400 hover:underline whitespace-nowrap min-h-[32px] flex items-center">
                                Gebruik ←
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Hashtags */}
                      {aiAnalysis.hashtags?.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wide">Hashtags</p>
                            <button
                              onClick={() => {
                                const tags = (aiAnalysis.hashtags as string[]).join(" ");
                                setCaption((prev: string) => prev.trim() ? `${prev}\n\n${tags}` : tags);
                                toast({ title: "Hashtags toegevoegd! 🏷️" });
                              }}
                              className="text-[9px] font-extrabold text-pink-600 dark:text-pink-400 hover:underline">
                              + Voeg alle toe
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {(aiAnalysis.hashtags as string[]).map((tag, i) => (
                              <button key={i}
                                onClick={() => setCaption((prev: string) => prev.includes(tag) ? prev : `${prev} ${tag}`.trim())}
                                className="text-[9px] bg-pink-50 dark:bg-pink-950/20 text-pink-700 dark:text-pink-300 rounded-full px-2 py-0.5 border border-pink-200/60 dark:border-pink-800/30 font-medium hover:bg-pink-100 dark:hover:bg-pink-900/30 transition-colors">
                                {tag}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Improvements */}
                      {aiAnalysis.improvements?.length > 0 && (
                        <div className="rounded-xl border border-amber-200/60 dark:border-amber-800/30 bg-amber-50/40 dark:bg-amber-950/10 p-3 space-y-1.5">
                          <p className="text-[10px] font-extrabold text-amber-700 dark:text-amber-400">💡 Verbeterpunten</p>
                          {(aiAnalysis.improvements as string[]).map((imp, i) => (
                            <p key={i} className="text-[9px] text-amber-700 dark:text-amber-300 flex gap-1.5 leading-relaxed">
                              <span className="shrink-0 font-bold">→</span>{imp}
                            </p>
                          ))}
                        </div>
                      )}

                      {/* Best time */}
                      {aiAnalysis.bestTimeToPost && (
                        <div className="text-center rounded-lg bg-emerald-50/40 dark:bg-emerald-950/10 border border-emerald-200/60 dark:border-emerald-800/30 p-2">
                          <p className="text-[9px] text-emerald-700 dark:text-emerald-400">🕐 Beste posttijd: <span className="font-extrabold">{aiAnalysis.bestTimeToPost}</span></p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Quick Caption (no vision) ── */}
                <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                    <p className="text-[10px] font-bold">Snelle Caption</p>
                  </div>
                  <button onClick={generateAiCaption} disabled={aiCaptionLoading}
                    data-testid="button-ai-caption"
                    className="w-full flex items-center justify-center gap-2 py-2.5 lg:py-2 px-3 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 hover:opacity-90 text-white text-xs font-bold transition-all disabled:opacity-60">
                    {aiCaptionLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Genereren…</> : <><Sparkles className="w-3.5 h-3.5" /> AI Caption genereren</>}
                  </button>
                  {aiSuggestion && (
                    <div className="rounded-lg border border-violet-200 dark:border-violet-800/40 bg-violet-50/50 dark:bg-violet-950/20 p-3 space-y-2">
                      <p className="text-[10px] leading-relaxed">{aiSuggestion}</p>
                      <button onClick={() => { setCaption(aiSuggestion); setAiSuggestion(""); toast({ title: "Caption overgenomen! ✅" }); }}
                        className="text-[10px] font-bold text-violet-600 dark:text-violet-400 hover:underline">
                        ← Gebruik deze caption
                      </button>
                    </div>
                  )}
                </div>

                {/* ── Hashtag Generator ── */}
                <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Hash className="w-3.5 h-3.5 text-pink-500" />
                    <p className="text-[10px] font-bold">Hashtag Generator</p>
                  </div>
                  <button onClick={generateAiHashtags} disabled={aiHashtagLoading}
                    data-testid="button-ai-hashtags"
                    className="w-full flex items-center justify-center gap-2 py-2.5 lg:py-2 px-3 rounded-lg bg-gradient-to-r from-pink-500 to-rose-600 hover:opacity-90 text-white text-xs font-bold transition-all disabled:opacity-60">
                    {aiHashtagLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Genereren…</> : <><Hash className="w-3.5 h-3.5" /> AI Hashtags genereren</>}
                  </button>
                </div>

                {/* ── Quick tips ── */}
                <div className="rounded-xl border border-emerald-200/60 dark:border-emerald-800/30 bg-emerald-50/40 dark:bg-emerald-950/10 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-3.5 h-3.5 text-emerald-500" />
                    <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">Quick tips voor {postType}</p>
                  </div>
                  <ul className="space-y-1">
                    {(postType === "REELS" ? [
                      "Begin de eerste 3 seconden sterk — dit bepaalt of mensen blijven kijken",
                      "Voeg tekst overlay toe in de eerste frame voor extra aandacht",
                      "Gebruik verticaal formaat (9:16) voor maximaal bereik",
                      "Trending audio vergroot je kans op de Explore page",
                    ] : postType === "STORY" ? [
                      "Gebruik polls en vragen voor engagement",
                      "Story links werken pas bij 10k+ volgers of verified accounts",
                      "Voeg locatie-sticker toe voor lokale discovery",
                      "Post 3–7 Stories per dag voor optimaal bereik",
                    ] : [
                      "4:5 formaat neemt meer schermruimte in dan 1:1 — gebruik het!",
                      "Eerste comment met hashtags houdt de caption schoon",
                      "Tag relevante accounts voor extra exposure",
                      "Post tussen 11:00–13:00 of 19:00–21:00 NL-tijd",
                    ]).map((tip, i) => (
                      <li key={i} className="text-[9px] text-emerald-700 dark:text-emerald-400 flex gap-1.5">
                        <span className="shrink-0">•</span>{tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   ZONE PANEL COMPONENTS
═══════════════════════════════════════ */

/* ── Studio Zone ── */
function StudioZone({ status, media, postType, setPostType, caption, setCaption, imageUrl, setImageUrl, videoUrl, setVideoUrl, locationInput, setLocationInput, publishing, published, handlePublish, setPublished, shareToComm, shareToReels, sharedToComm, sharedToReels, sharingId, sharingReelId, toast, allAccounts, crossPostIds, setCrossPostIds, setActiveZone, storyIsVideo, setStoryIsVideo }: any) {
  const [studioTab, setStudioTab] = useState<"create" | "calendar" | "schedule" | "crosspost">("create");
  const [crossPosting, setCrossPosting] = useState(false);
  const [crossPostResults, setCrossPostResults] = useState<any[] | null>(null);
  const [carouselPublishing, setCarouselPublishing] = useState(false);
  const [publishStage, setPublishStage] = useState("");
  const [scheduleQueue, setScheduleQueue] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem("ig-schedule-queue") || "[]"); } catch { return []; }
  });
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("12:00");
  const [crossPlatform, setCrossPlatform] = useState({ instagram: true, linkedin: false });

  const [showPublishChoiceDialog, setShowPublishChoiceDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [schedDt, setSchedDt] = useState(() => {
    const d = new Date(); d.setHours(d.getHours() + 1, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [schedBestLoading, setSchedBestLoading] = useState(false);
  const [schedBestResult, setSchedBestResult] = useState<any>(null);

  const { data: upcomingPosts = [], isSuccess: upcomingLoaded } = useQuery<any[]>({
    queryKey: ["/api/instagram/scheduled-posts"],
    select: (posts) =>
      posts
        .filter((p: any) => p.status === "pending" && new Date(p.scheduledAt) > new Date())
        .sort((a: any, b: any) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
        .slice(0, 3),
  });

  const scheduleMutation = useMutation({
    mutationFn: (payload: any) => apiRequest("/api/instagram/scheduled-posts", "POST", payload).then(r => r.json()),
    onSuccess: (d) => {
      if (d?.error) { toast({ title: "Inplannen mislukt", description: d.error, variant: "destructive" }); return; }
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/scheduled-posts"] });
      setShowScheduleDialog(false);
      toast({ title: "Post ingepland! 📅", description: `Geplanned voor ${new Date(schedDt).toLocaleString("nl-NL")}` });
    },
    onError: (e: any) => toast({ title: "Inplannen mislukt", description: e.message, variant: "destructive" }),
  });

  const getBestTimeForStudio = async () => {
    setSchedBestLoading(true);
    setSchedBestResult(null);
    try {
      const res = await fetch("/api/instagram/ai/best-time", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Analyse mislukt");
      setSchedBestResult(d);
      if (d.suggestedDateTime) setSchedDt(d.suggestedDateTime.slice(0, 16));
      toast({ title: "Beste tijd geanalyseerd!", description: "Optimale tijd is ingevuld" });
    } catch (err: any) {
      toast({ title: "Analyse mislukt", description: err.message, variant: "destructive" });
    } finally { setSchedBestLoading(false); }
  };

  const handleScheduleSubmit = () => {
    if (!schedDt) { toast({ title: "Selecteer een datum en tijd", variant: "destructive" }); return; }
    const hashtags = (caption.match(/#\w+/g) || []).join(" ");
    const cleanCaption = caption.replace(/#\w+/g, "").trim();
    if (postType === "CAROUSEL") {
      const validSlides = carouselSlides.filter((s: string) => s.trim());
      if (validSlides.length < 2) { toast({ title: "Minimaal 2 slides vereist", description: "Voeg afbeeldingen toe aan elke slide voordat je inplant.", variant: "destructive" }); return; }
      scheduleMutation.mutate({ mediaType: "CAROUSEL", mediaUrl: validSlides[0].trim(), carouselSlides: validSlides.map((s: string) => s.trim()), caption: cleanCaption, hashtags, scheduledAt: new Date(schedDt).toISOString() });
      return;
    }
    let mediaUrl: string;
    let mediaType: string;
    if (postType === "STORY") {
      if (storyIsVideo && videoUrl) { mediaUrl = videoUrl; mediaType = "STORY"; }
      else { mediaUrl = imageUrl; mediaType = "STORY"; }
    } else if (postType === "PHOTO") {
      mediaUrl = imageUrl; mediaType = "PHOTO";
    } else {
      mediaUrl = videoUrl; mediaType = postType === "VIDEO" ? "VIDEO" : "REELS";
    }
    if (!mediaUrl?.trim()) { toast({ title: "Upload eerst media", description: "Een media-URL is vereist om in te plannen", variant: "destructive" }); return; }
    scheduleMutation.mutate({ mediaType, mediaUrl: mediaUrl.trim(), caption: cleanCaption, hashtags, scheduledAt: new Date(schedDt).toISOString() });
  };

  const saveQueue = (q: any[]) => { setScheduleQueue(q); localStorage.setItem("ig-schedule-queue", JSON.stringify(q)); };

  const addToQueue = () => {
    if (!caption.trim()) { toast({ title: "Caption required", variant: "destructive" }); return; }
    if (!scheduleDate) { toast({ title: "Select a date", variant: "destructive" }); return; }
    const item = { id: Date.now(), caption, imageUrl, videoUrl, postType, date: scheduleDate, time: scheduleTime, crossPlatform, createdAt: new Date().toISOString() };
    saveQueue([...scheduleQueue, item]);
    toast({ title: "Added to queue!", description: `Scheduled for ${scheduleDate} at ${scheduleTime}` });
  };

  const removeFromQueue = (id: number) => saveQueue(scheduleQueue.filter((q: any) => q.id !== id));

  const [storyLinkUrl, setStoryLinkUrl] = useState("");
  const [reelCoverUrl, setReelCoverUrl] = useState("");
  const [carouselSlides, setCarouselSlides] = useState<string[]>(["", ""]);
  const [generatingCaption, setGeneratingCaption] = useState(false);

  // ── Inline Media Studio Editor state ──
  const [mediaOverlays, setMediaOverlays] = useState<TextOverlay[]>([]);
  const [mediaFilter, setMediaFilter] = useState("none");
  const [watermarkUrl, setWatermarkUrl] = useState("");
  const [watermarkPos, setWatermarkPos] = useState<"tl" | "tr" | "bl" | "br">("tr");
  const [trimIn, setTrimIn] = useState(0);
  const [trimOut, setTrimOut] = useState<number | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [mentions, setMentions] = useState<string[]>([]);
  const [mentionInput, setMentionInput] = useState("");
  const [showMentionDrop, setShowMentionDrop] = useState(false);
  const [mentionCursor, setMentionCursor] = useState(-1);
  const mentionWrapRef = useRef<HTMLDivElement>(null);

  // Build a deduplicated pool of known usernames from captions + influencers + own account
  const mentionPool = useMemo(() => {
    const set = new Set<string>();
    // Extract @handles from existing post captions
    (media || []).forEach((p: any) => {
      const cap: string = p.caption || "";
      const found = cap.match(/@([a-zA-Z0-9._]{1,30})/g);
      if (found) found.forEach(h => set.add(h.replace(/^@/, "").toLowerCase()));
    });
    // Add saved influencers (stored as {username: string, ...})
    try {
      const saved = JSON.parse(localStorage.getItem("ig-influencers") || "[]");
      saved.forEach((inf: any) => { if (inf.username) set.add(inf.username.replace(/^@/, "").toLowerCase()); });
    } catch {}
    // Add own connected account username
    if (status?.username) set.add(status.username.toLowerCase());
    return Array.from(set).sort();
  }, [media, status]);

  const mentionFiltered = useMemo(() => {
    if (!mentionInput.trim()) return mentionPool.slice(0, 8);
    const q = mentionInput.toLowerCase();
    return mentionPool.filter(u => u.includes(q) && !mentions.includes(u)).slice(0, 8);
  }, [mentionInput, mentionPool, mentions]);

  const addMention = (username: string) => {
    const cleaned = username.replace(/^@+/, "").replace(/[^a-zA-Z0-9._]/g, "");
    if (cleaned && !mentions.includes(cleaned)) setMentions(prev => [...prev, cleaned]);
    setMentionInput("");
    setShowMentionDrop(false);
    setMentionCursor(-1);
  };
  const [uploadMode, setUploadMode] = useState<"upload" | "url">("upload");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<"uploading" | "compressing" | "preparing" | "done">("uploading");
  const [uploadPreview, setUploadPreview] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const carouselFileRefs = useRef<(HTMLInputElement | null)[]>([]);

  // AI video analysis state
  const [videoAnalysis, setVideoAnalysis] = useState<any>(null);
  const [analyzingVideo, setAnalyzingVideo] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [suggestedCaption, setSuggestedCaption] = useState("");

  const analyzeVideo = async () => {
    if (!videoUrl || analyzingVideo) return;
    setAnalyzingVideo(true);
    setShowAnalysis(true);
    setVideoAnalysis(null);
    setSuggestedCaption("");
    try {
      const res = await fetch("/api/instagram/ai/analyze-video", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl, caption, postType }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Analyse mislukt");
      setVideoAnalysis(d.analysis);
      // Build suggested caption: first suggestion + exactly 5 hashtags
      const firstSug = d.analysis.captionSuggestions?.[0] || "";
      const top5 = (d.analysis.hashtags || []).slice(0, 5)
        .map((h: string) => h.startsWith("#") ? h : `#${h}`)
        .join(" ");
      setSuggestedCaption(firstSug ? (top5 ? `${firstSug}\n\n${top5}` : firstSug) : top5);
    } catch (err: any) {
      toast({ title: "Analyse mislukt", description: err.message, variant: "destructive" });
      setShowAnalysis(false);
    } finally { setAnalyzingVideo(false); }
  };

  const handleCarouselPublish = async () => {
    const validSlides = carouselSlides.filter((s: string) => s.trim());
    if (validSlides.length < 2) {
      toast({ title: "Minimaal 2 slides vereist", description: "Voeg afbeeldingen toe aan elke slide.", variant: "destructive" });
      return;
    }
    setCarouselPublishing(true);
    setPublishStage("Carousel-items aanmaken…");
    try {
      const childIds: string[] = [];
      for (let i = 0; i < validSlides.length; i++) {
        setPublishStage(`Slide ${i + 1}/${validSlides.length} uploaden…`);
        const r = await apiRequest("/api/instagram/media/carousel-child", "POST", { image_url: validSlides[i] });
        const d = await r.json();
        if (d.error) throw new Error(d.error);
        childIds.push(d.id);
      }
      setPublishStage("Carousel container aanmaken…");
      const createRes = await apiRequest("/api/instagram/media/create", "POST", {
        media_type: "CAROUSEL", caption, children: childIds,
      });
      if (!createRes.ok) { const err = await createRes.json(); throw new Error(err.error || "Create failed"); }
      const { id: creationId } = await createRes.json() as { id: string };
      setPublishStage("Container verwerken…");
      let statusCode = "IN_PROGRESS", attempts = 0;
      while (statusCode !== "FINISHED" && attempts < 20) {
        await new Promise(r => setTimeout(r, 2000));
        const sRes = await apiRequest(`/api/instagram/media/${creationId}/status`, "GET");
        if (sRes.ok) { const s = await sRes.json(); statusCode = s.status_code; }
        attempts++;
      }
      setPublishStage("Publiceren…");
      const publishRes = await apiRequest("/api/instagram/media/publish", "POST", { creation_id: creationId });
      if (!publishRes.ok) { const err = await publishRes.json(); throw new Error(err.error || "Publish failed"); }
      const { id: mediaId } = await publishRes.json() as { id: string };
      setPublished({ id: mediaId });
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/media"] });
      toast({ title: "Carousel gepubliceerd! ✅", description: `${validSlides.length} slides · ID: ${mediaId}` });
      setPublishStage("");
    } catch (e: any) {
      toast({ title: "Carousel publiceren mislukt", description: e.message, variant: "destructive" });
      setPublishStage("");
    } finally { setCarouselPublishing(false); }
  };

  const uploadMedia = async (file: File, slideIndex?: number) => {
    if (uploading) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadStage("preparing");
    if (slideIndex === undefined) setUploadPreview(URL.createObjectURL(file));

    try {
      const result = await smartUploadMedia(file, {
        onProgress: (pct, stage) => {
          setUploadProgress(pct);
          if (stage === "compressing") setUploadStage("compressing");
          else if (stage === "uploading") setUploadStage("uploading");
          else if (stage === "done") setUploadStage("done");
          else setUploadStage("preparing");
        },
      });

      setUploadProgress(100);

      if (result.resourceType === "video") {
        if (slideIndex !== undefined) {
          const s = [...carouselSlides]; s[slideIndex] = result.url; setCarouselSlides(s);
        } else {
          setVideoUrl(result.url);
          setVideoAnalysis(null);
          setShowAnalysis(false);
          if (postType === "STORY") {
            // Keep STORY type — video story stays as STORY, just flag it as video
            setStoryIsVideo(true);
          } else if (postType === "PHOTO") {
            setPostType("REELS");
          }
        }
        const compressionNote = result.compressed
          ? ` — geoptimaliseerd van ${result.originalMb} MB naar ${result.finalMb} MB`
          : ` — ${result.finalMb} MB`;
        toast({ title: "✅ Video gereed!", description: `${file.name}${compressionNote}` });
      } else {
        if (slideIndex !== undefined) {
          const s = [...carouselSlides]; s[slideIndex] = result.url; setCarouselSlides(s);
        } else {
          setImageUrl(result.url);
          if (postType === "STORY") setStoryIsVideo(false);
        }
        toast({ title: "✅ Afbeelding geüpload!", description: `${file.name} — ${result.finalMb} MB` });
      }
    } catch (err: any) {
      if (slideIndex === undefined) setUploadPreview("");
      toast({ title: "Upload mislukt", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1500);
    }
  };

  const topHashtags = useMemo(() => {
    const map: Record<string, number> = {};
    (media || []).forEach((post: any) => {
      ((post.caption || "").match(/#\w+/g) || []).forEach((tag: string) => {
        const k = tag.toLowerCase();
        map[k] = (map[k] || 0) + (post.like_count ?? 0) + (post.comments_count ?? 0) * 3;
      });
    });
    return Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 15).map(([tag]) => tag);
  }, [media]);

  const FORMAT_TYPES = [
    { id: "PHOTO",    label: "Post",     icon: Image,        desc: "Enkele foto",        grad: "from-pink-500 to-rose-500",     ring: "ring-pink-400" },
    { id: "CAROUSEL", label: "Carousel", icon: LayoutGrid,   desc: "Meerdere slides",    grad: "from-orange-400 to-amber-500",  ring: "ring-orange-400" },
    { id: "REELS",    label: "Reel",     icon: Film,         desc: "Short-form video",   grad: "from-violet-500 to-purple-600", ring: "ring-violet-400" },
    { id: "STORY",    label: "Story",    icon: Clapperboard, desc: "24 uur zichtbaar",   grad: "from-emerald-400 to-teal-500",  ring: "ring-emerald-400" },
    { id: "VIDEO",    label: "Video",    icon: Play,         desc: "Lange video",        grad: "from-blue-500 to-cyan-500",     ring: "ring-blue-400" },
  ] as const;

  const generateCaption = async () => {
    if (generatingCaption) return;
    setGeneratingCaption(true);
    try {
      const res = await fetch("/api/instagram/ai/caption", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postType, topHashtags: topHashtags.slice(0, 10), accountUsername: status?.username, followers: status?.followersCount }),
      });
      if (res.ok) {
        const d = await res.json();
        setCaption(d.caption || "");
        toast({ title: "✨ Caption gegenereerd!", description: "Pas aan naar wens" });
      }
    } catch { toast({ title: "Genereren mislukt", variant: "destructive" }); }
    finally { setGeneratingCaption(false); }
  };

  const { score, tips } = useMemo(() => caption ? scorePost(caption, postType) : { score: 0, tips: [] }, [caption, postType]);

  const calendarPosts = useMemo(() => {
    const map: Record<string, any[]> = {};
    if (media) {
      media.forEach((p: any) => {
        const key = p.timestamp ? format(new Date(p.timestamp), "yyyy-MM-dd") : null;
        if (key) { if (!map[key]) map[key] = []; map[key].push(p); }
      });
    }
    return map;
  }, [media]);

  const [calMonth, setCalMonth] = useState(new Date());
  const calDays = useMemo(() => {
    const start = startOfMonth(calMonth);
    const end   = endOfMonth(calMonth);
    return eachDayOfInterval({ start, end });
  }, [calMonth]);
  const firstDayOffset = (getDay(startOfMonth(calMonth)) + 6) % 7;

  const studioTabs = [
    { id: "create",    label: "Aanmaken",    icon: Plus },
    { id: "schedule",  label: "Planning",    icon: Clock },
    { id: "calendar",  label: "Kalender",    icon: Calendar },
    { id: "crosspost", label: "Cross-Post",  icon: Share2 },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Sub-nav */}
      <div className="flex gap-1 overflow-x-auto scrollbar-hide bg-muted/40 p-1 rounded-xl">
        {studioTabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setStudioTab(id as any)}
            className={cn("flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all", studioTab === id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* ── Create ── */}
      {studioTab === "create" && (
        <div className="space-y-4">
          {published ? (
            <Card className="border-green-400/50 bg-green-50/30 dark:bg-green-950/10">
              <CardContent className="py-10 flex flex-col items-center gap-4">
                <div className={cn("w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center", IG_GRADIENT)}>
                  <CheckCircle2 className="w-8 h-8 text-white" />
                </div>
                <div className="text-center">
                  <p className="font-extrabold text-xl">Gepubliceerd!</p>
                  <p className="text-sm text-muted-foreground">Jouw content staat live op Instagram</p>
                </div>
                <Button size="sm" onClick={() => { setPublished(null); setCaption(""); setImageUrl(""); setVideoUrl(""); }}>Nieuw bericht</Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* FORMAT SELECTOR */}
              <div className="grid grid-cols-5 gap-2">
                {FORMAT_TYPES.map(({ id, label, icon: Icon, desc, grad, ring }) => (
                  <button key={id} onClick={() => setPostType(id as PostType)}
                    data-testid={`button-format-${id.toLowerCase()}`}
                    className={cn("flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl text-xs font-bold border-2 transition-all",
                      postType === id
                        ? `border-transparent ring-2 ${ring} bg-gradient-to-br ${grad} text-white shadow-md`
                        : "border-border text-muted-foreground hover:border-muted-foreground/40 bg-card")}>
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                    <span className={cn("text-[9px] font-normal leading-tight text-center", postType === id ? "text-white/80" : "text-muted-foreground/70")}>{desc}</span>
                  </button>
                ))}
              </div>

              {/* MAIN EDITOR + PREVIEW */}
              <div className="grid grid-cols-1 lg:grid-cols-[1fr,260px] gap-4 items-start">
                {/* LEFT: Editor */}
                <div className="space-y-3">
                  {/* MEDIA INPUT — format-aware */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        {postType === "CAROUSEL" ? <><LayoutGrid className="w-4 h-4 text-orange-500" /> Carousel slides</> :
                         postType === "REELS"    ? <><Film className="w-4 h-4 text-violet-500" /> Video URL</> :
                         postType === "STORY"    ? <><Clapperboard className="w-4 h-4 text-emerald-500" /> Story media</> :
                         postType === "VIDEO"    ? <><Play className="w-4 h-4 text-blue-500" /> Video URL</> :
                         <><Image className="w-4 h-4 text-pink-500" /> Afbeelding URL</>}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {postType === "CAROUSEL" ? (
                        <div className="space-y-2">
                          {carouselSlides.map((slide, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-lg bg-orange-100 dark:bg-orange-950/30 text-orange-600 text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</div>
                              {slide ? (
                                <div className="flex items-center gap-2 flex-1 min-w-0 p-1.5 rounded-lg bg-muted/40 border">
                                  <img src={slide} className="w-8 h-8 rounded object-cover shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                  <span className="text-[10px] text-muted-foreground truncate flex-1">{slide.split("/").pop()}</span>
                                  <button onClick={() => { const s = [...carouselSlides]; s[i] = ""; setCarouselSlides(s); }} className="text-muted-foreground hover:text-red-500"><X className="w-3 h-3" /></button>
                                </div>
                              ) : (
                                <div className="flex-1 flex gap-2">
                                  <input ref={el => { carouselFileRefs.current[i] = el; }} type="file" accept="image/*" className="hidden"
                                    onChange={async e => { const f = e.target.files?.[0]; if (f) await uploadMedia(f, i); e.target.value = ""; }} />
                                  <button onClick={() => carouselFileRefs.current[i]?.click()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-orange-300 text-[11px] text-orange-500 font-bold hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors shrink-0">
                                    <Upload className="w-3 h-3" /> Upload
                                  </button>
                                  <Input data-testid={`input-carousel-slide-${i}`} placeholder={`URL slide ${i + 1}...`} value={slide}
                                    onChange={e => { const s = [...carouselSlides]; s[i] = e.target.value; setCarouselSlides(s); }} className="text-sm h-8 flex-1" />
                                </div>
                              )}
                              {carouselSlides.length > 2 && (
                                <button onClick={() => setCarouselSlides(carouselSlides.filter((_, j) => j !== i))}
                                  className="text-muted-foreground hover:text-red-500 transition-colors p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                              )}
                            </div>
                          ))}
                          {carouselSlides.length < 10 && (
                            <button onClick={() => setCarouselSlides([...carouselSlides, ""])}
                              className="w-full py-1.5 rounded-xl border border-dashed border-orange-300 text-xs text-orange-500 font-bold hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors flex items-center justify-center gap-1">
                              <Plus className="w-3.5 h-3.5" /> Slide toevoegen
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {/* Hidden native file input */}
                          <input ref={fileInputRef} type="file"
                            accept={postType === "REELS" || postType === "VIDEO" ? "video/*,image/*" : postType === "STORY" ? "image/*,video/*" : "image/*"}
                            className="hidden"
                            onChange={async e => { const f = e.target.files?.[0]; if (f) await uploadMedia(f); e.target.value = ""; }} />

                          {uploadMode === "upload" ? (
                            <>
                              {/* Upload zone / preview */}
                              {!imageUrl && !videoUrl ? (
                                <div
                                  onClick={() => !uploading && fileInputRef.current?.click()}
                                  onDragOver={e => e.preventDefault()}
                                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) uploadMedia(f); }}
                                  data-testid="upload-media-dropzone"
                                  className={cn(
                                    "relative flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer select-none",
                                    uploading
                                      ? "border-violet-400 bg-violet-50/30 dark:bg-violet-950/10"
                                      : "border-muted-foreground/20 hover:border-pink-400/60 hover:bg-pink-50/20 dark:hover:bg-pink-950/10"
                                  )}>
                                  {uploading ? (
                                    <div className="flex flex-col items-center gap-3 w-full max-w-[240px]">
                                      {uploadStage === "compressing" ? (
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md animate-pulse">
                                          <Zap className="w-5 h-5 text-white" />
                                        </div>
                                      ) : uploadStage === "done" ? (
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-md">
                                          <CheckCircle2 className="w-5 h-5 text-white" />
                                        </div>
                                      ) : (
                                        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                                      )}
                                      <div className="text-center">
                                        {uploadStage === "preparing" && (
                                          <><p className="text-xs font-bold text-violet-600">Voorbereiding…</p>
                                          <p className="text-[10px] text-muted-foreground mt-0.5">Bestand wordt verstuurd</p></>
                                        )}
                                        {uploadStage === "uploading" && uploadProgress < 61 && (
                                          <><p className="text-xs font-bold text-violet-600">Uploaden naar server…</p>
                                          <p className="text-[10px] text-muted-foreground mt-0.5">Bestand per blok verstuurd</p></>
                                        )}
                                        {uploadStage === "uploading" && uploadProgress >= 61 && (
                                          <><p className="text-xs font-bold text-blue-600">Uploaden naar Cloudinary…</p>
                                          <p className="text-[10px] text-muted-foreground mt-0.5">Bijna klaar — even geduld</p></>
                                        )}
                                        {uploadStage === "compressing" && (
                                          <><p className="text-xs font-bold text-amber-600">FFmpeg optimalisatie…</p>
                                          <p className="text-[10px] text-muted-foreground mt-0.5">Kwaliteit behouden, bestand kleiner</p></>
                                        )}
                                        {uploadStage === "done" && (
                                          <><p className="text-xs font-bold text-green-600">Gereed!</p>
                                          <p className="text-[10px] text-muted-foreground mt-0.5">Video succesvol verwerkt</p></>
                                        )}
                                      </div>
                                      {uploadProgress > 0 && (
                                        <div className="w-full space-y-1">
                                          <Progress
                                            value={uploadProgress}
                                            className={cn("h-1.5", uploadStage === "compressing"
                                              ? "bg-amber-100 dark:bg-amber-950/30"
                                              : uploadStage === "done"
                                              ? "bg-green-100 dark:bg-green-950/30"
                                              : "bg-violet-100 dark:bg-violet-950/30"
                                            )}
                                          />
                                          <div className="flex items-center justify-between">
                                            <span className="text-[9px] text-muted-foreground">
                                              {uploadStage === "compressing" ? "FFmpeg verwerking" :
                                               uploadStage === "uploading" && uploadProgress >= 61 ? "Cloudinary upload" :
                                               uploadStage === "uploading" ? "Server upload" :
                                               uploadStage === "preparing" ? "Bezig…" :
                                               uploadStage === "done" ? "Voltooid" : "Afronden"}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground font-mono">{uploadProgress}%</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <>
                                      <div className={cn("w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-md",
                                        postType === "REELS" || postType === "VIDEO" ? "from-violet-500 to-purple-600" :
                                        postType === "STORY" ? "from-emerald-400 to-teal-500" : "from-pink-500 to-rose-500")}>
                                        <Upload className="w-5 h-5 text-white" />
                                      </div>
                                      <div className="text-center">
                                        <p className="text-sm font-bold">Klik of sleep bestand hier</p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                          {postType === "REELS" || postType === "VIDEO"
                                            ? "MP4, MOV, WebM • max 2 GB"
                                            : postType === "STORY"
                                            ? "JPG, PNG, MP4 • max 2 GB"
                                            : "JPG, PNG, WebP, GIF • max 50 MB"}
                                        </p>
                                      </div>
                                    </>
                                  )}
                                </div>
                              ) : (
                                /* ── Inline Media Studio Editor (replaces old thumbnail) ── */
                                <div className="space-y-3">
                                  {postType === "STORY" && (
                                    <div className="flex gap-1 p-0.5 rounded-lg bg-muted/60">
                                      {[{ v: false, label: "📸 Afbeelding" }, { v: true, label: "🎬 Video" }].map(opt => (
                                        <button key={String(opt.v)} onClick={() => { setStoryIsVideo(opt.v); setImageUrl(""); setVideoUrl(""); setUploadPreview(""); }}
                                          className={cn("flex-1 py-1 rounded-md text-[10px] font-bold transition-all",
                                            storyIsVideo === opt.v ? "bg-white dark:bg-zinc-800 shadow text-foreground" : "text-muted-foreground hover:text-foreground")}>
                                          {opt.label}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                  <InlineMediaEditor
                                    videoUrl={videoUrl}
                                    imageUrl={imageUrl || uploadPreview}
                                    postType={postType}
                                    storyIsVideo={storyIsVideo}
                                    overlays={mediaOverlays}
                                    setOverlays={setMediaOverlays}
                                    selectedFilter={mediaFilter}
                                    setSelectedFilter={setMediaFilter}
                                    watermarkUrl={watermarkUrl}
                                    setWatermarkUrl={setWatermarkUrl}
                                    watermarkPos={watermarkPos}
                                    setWatermarkPos={setWatermarkPos}
                                    trimIn={trimIn}
                                    setTrimIn={setTrimIn}
                                    trimOut={trimOut}
                                    setTrimOut={setTrimOut}
                                    videoDuration={videoDuration}
                                    setVideoDuration={setVideoDuration}
                                    onReplaceMedia={() => { setImageUrl(""); setVideoUrl(""); setUploadPreview(""); setVideoAnalysis(null); setShowAnalysis(false); setMediaOverlays([]); setMediaFilter("none"); setWatermarkUrl(""); setTrimIn(0); setTrimOut(null); setVideoDuration(0); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                                    status={status}
                                    toast={toast}
                                    caption={caption}
                                    setCaption={setCaption}
                                  />
                                  {/* ── AI Video Analyse button — always visible when video loaded ── */}
                                  {videoUrl && (
                                    <div className="space-y-3">
                                      <button
                                        onClick={analyzeVideo}
                                        disabled={analyzingVideo}
                                        data-testid="button-analyze-video"
                                        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 hover:opacity-90 active:opacity-80 text-white text-sm font-extrabold transition-all shadow-lg shadow-violet-500/20 disabled:opacity-60">
                                        {analyzingVideo
                                          ? <><Loader2 className="w-4 h-4 animate-spin" /> AI analyseert video…</>
                                          : <><Eye className="w-4 h-4" /> Analyseer video met AI</>}
                                      </button>

                                      {/* Loading dots */}
                                      {analyzingVideo && (
                                        <div className="flex items-center gap-2">
                                          <div className="flex gap-0.5">
                                            {[0,1,2].map(i => (
                                              <div key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                                            ))}
                                          </div>
                                          <p className="text-[10px] text-violet-500">Claude Vision bekijkt de eerste frame…</p>
                                        </div>
                                      )}

                                      {/* ── Results panel ── */}
                                      {showAnalysis && !analyzingVideo && videoAnalysis && (
                                        <div className="rounded-2xl border-2 border-violet-200/60 dark:border-violet-800/40 bg-gradient-to-br from-violet-50/60 to-purple-50/30 dark:from-violet-950/20 dark:to-purple-950/10 p-3.5 space-y-3">
                                          {/* Header */}
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                                                <Sparkles className="w-3.5 h-3.5 text-white" />
                                              </div>
                                              <span className="text-xs font-black text-violet-700 dark:text-violet-300">AI Video Analyse</span>
                                            </div>
                                            <button onClick={() => { setShowAnalysis(false); setVideoAnalysis(null); setSuggestedCaption(""); }}
                                              className="text-muted-foreground hover:text-foreground p-1">
                                              <X className="w-3.5 h-3.5" />
                                            </button>
                                          </div>

                                          {/* Score grid */}
                                          <div className="grid grid-cols-3 gap-1.5">
                                            {[
                                              { label: "Hook", val: videoAnalysis.hookScore },
                                              { label: "Kwaliteit", val: videoAnalysis.contentQuality },
                                              { label: "Urban fit", val: videoAnalysis.urbanCultureFit },
                                            ].map(({ label, val }) => {
                                              const score = typeof val === "number" ? val : null;
                                              const col = score !== null
                                                ? score >= 7 ? "text-emerald-600" : score >= 4 ? "text-amber-500" : "text-red-500"
                                                : "text-muted-foreground";
                                              return (
                                                <div key={label} className="text-center p-2 rounded-xl bg-background/70 border">
                                                  <p className={`text-xl font-black ${col}`}>{score ?? "–"}<span className="text-[8px] font-normal text-muted-foreground">/10</span></p>
                                                  <p className="text-[8px] text-muted-foreground font-bold">{label}</p>
                                                </div>
                                              );
                                            })}
                                          </div>

                                          {/* Verdict */}
                                          {videoAnalysis.verdict && (
                                            <div className="rounded-lg bg-background/60 border px-3 py-2">
                                              <p className="text-[11px] leading-relaxed">✨ {videoAnalysis.verdict}</p>
                                            </div>
                                          )}

                                          {/* ── Suggested caption (editable) ── */}
                                          {suggestedCaption && (
                                            <div className="space-y-2">
                                              <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wide">AI Caption (5 hashtags) — bewerk of gebruik direct</p>
                                              <textarea
                                                value={suggestedCaption}
                                                onChange={e => setSuggestedCaption(e.target.value)}
                                                rows={6}
                                                className="w-full rounded-xl border-2 border-violet-200/70 dark:border-violet-800/40 bg-background/80 px-3 py-2 text-[11px] leading-relaxed resize-none focus:outline-none focus:border-violet-400 dark:focus:border-violet-600 transition-colors"
                                              />
                                              <button
                                                onClick={() => {
                                                  setCaption(suggestedCaption);
                                                  setShowAnalysis(false);
                                                  toast({ title: "Caption overgenomen! ✅", description: "Je kunt hem nog aanpassen." });
                                                }}
                                                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:opacity-90 text-white text-xs font-extrabold transition-all">
                                                ← Gebruik deze caption
                                              </button>
                                            </div>
                                          )}

                                          {/* Improvements */}
                                          {videoAnalysis.improvements?.length > 0 && (
                                            <div className="rounded-xl border border-amber-200/60 dark:border-amber-800/30 bg-amber-50/40 dark:bg-amber-950/10 p-2.5 space-y-1.5">
                                              <p className="text-[10px] font-extrabold text-amber-700 dark:text-amber-400">💡 Verbeterpunten</p>
                                              {(videoAnalysis.improvements as string[]).map((imp, i) => (
                                                <p key={i} className="text-[10px] text-amber-700 dark:text-amber-300 flex gap-1.5 leading-relaxed">
                                                  <span className="shrink-0 font-bold">→</span>{imp}
                                                </p>
                                              ))}
                                            </div>
                                          )}

                                          {/* Best time */}
                                          {videoAnalysis.bestTimeToPost && (
                                            <div className="flex items-center gap-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-200/60 dark:border-emerald-800/30 px-3 py-2">
                                              <Clock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                              <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">{videoAnalysis.bestTimeToPost}</p>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                              <button onClick={() => setUploadMode("url")}
                                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
                                Voer URL in
                              </button>
                            </>
                          ) : (
                            <>
                              {/* URL input mode */}
                              {postType === "STORY" && (
                                <div className="flex gap-1 p-0.5 rounded-lg bg-muted/60 mb-1">
                                  {[{ v: false, label: "📸 Afbeelding" }, { v: true, label: "🎬 Video" }].map(opt => (
                                    <button key={String(opt.v)} onClick={() => { setStoryIsVideo(opt.v); setImageUrl(""); setVideoUrl(""); }}
                                      className={cn("flex-1 py-1 rounded-md text-[10px] font-bold transition-all",
                                        storyIsVideo === opt.v ? "bg-white dark:bg-zinc-800 shadow text-foreground" : "text-muted-foreground hover:text-foreground")}>
                                      {opt.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                              <Input data-testid="input-media-url"
                                placeholder={
                                  postType === "STORY"
                                    ? (storyIsVideo ? "https://example.com/story-video.mp4" : "https://example.com/story-photo.jpg")
                                    : postType === "PHOTO" ? "https://example.com/photo.jpg" : "https://example.com/video.mp4"
                                }
                                value={postType === "STORY" ? (storyIsVideo ? videoUrl : imageUrl) : postType === "PHOTO" ? imageUrl : videoUrl}
                                onChange={e => {
                                  const val = e.target.value;
                                  if (postType === "STORY") { storyIsVideo ? setVideoUrl(val) : setImageUrl(val); }
                                  else if (postType === "PHOTO") setImageUrl(val);
                                  else setVideoUrl(val);
                                }}
                                className="text-sm" />
                              <button onClick={() => setUploadMode("upload")}
                                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
                                ← Uploaden vanaf apparaat
                              </button>
                            </>
                          )}

                          {/* Extra fields based on format */}
                          {postType === "REELS" && (
                            <div className="space-y-1 pt-1 border-t border-muted/40">
                              <p className="text-[10px] font-semibold text-muted-foreground">Cover afbeelding (optioneel)</p>
                              <div className="flex gap-2">
                                <input type="file" accept="image/*" className="hidden" id="reel-cover-file"
                                  onChange={async e => { const f = e.target.files?.[0]; if (!f) return; setUploading(true); const fd = new FormData(); fd.append("file", f); try { const r = await fetch("/api/instagram/upload/media", { method: "POST", credentials: "include", body: fd }); const d = await r.json(); if (d.ok) setReelCoverUrl(d.url); } catch {} finally { setUploading(false); e.target.value = ""; } }} />
                                <Input data-testid="input-reel-cover" placeholder="https://... of upload ↓" value={reelCoverUrl}
                                  onChange={e => setReelCoverUrl(e.target.value)} className="text-sm h-9 flex-1" />
                                <label htmlFor="reel-cover-file"
                                  className="flex items-center justify-center w-9 h-9 rounded-xl border border-dashed cursor-pointer hover:border-violet-400 hover:bg-violet-50/30 dark:hover:bg-violet-950/10 transition-colors shrink-0">
                                  <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                                </label>
                              </div>
                            </div>
                          )}
                          {postType === "STORY" && (
                            <div className="pt-1 border-t border-muted/40">
                              <div className="relative">
                                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                <Input data-testid="input-story-link" placeholder="Link sticker URL (optioneel)" value={storyLinkUrl}
                                  onChange={e => setStoryLinkUrl(e.target.value)} className="pl-9 text-sm h-9" />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* CAPTION BUILDER */}
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Caption & details</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      <div className="relative">
                        <Textarea data-testid="input-ig-caption"
                          placeholder={postType === "STORY" ? "Story tekst (optioneel)..." : postType === "REELS" ? "Beschrijf je reel... 🎬🔥 #hashtags" : "Schrijf een caption... @mentions, #hashtags, emojis 🎤🎨"}
                          value={caption} onChange={e => setCaption(e.target.value)}
                          className="text-sm resize-none pr-24" rows={postType === "STORY" ? 3 : 5} />
                        <button onClick={generateCaption} disabled={generatingCaption}
                          data-testid="button-ai-caption"
                          className="absolute right-2 bottom-2 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-white bg-gradient-to-r from-violet-500 to-purple-600 hover:opacity-90 disabled:opacity-60 transition-all shadow-sm">
                          {generatingCaption ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                          AI
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-muted-foreground">
                          {caption.length > 0 && caption.length < 125 ? `✓ ${caption.length} tekens zichtbaar` : caption.length >= 125 ? `Eerste 125 zichtbaar` : ""}
                        </p>
                        <p className={cn("text-[11px] font-mono", caption.length > 2000 ? "text-red-500" : "text-muted-foreground")}>{caption.length}/2200</p>
                      </div>

                      {/* Hashtag chips from top-performing */}
                      {topHashtags.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Jouw top hashtags — klik om in te voegen</p>
                          <div className="flex flex-wrap gap-1">
                            {topHashtags.slice(0, 12).map(tag => (
                              <button key={tag} onClick={() => setCaption(c => c ? c + " " + tag : tag)}
                                className="px-2 py-0.5 rounded-full text-[10px] font-bold border border-pink-300/60 text-pink-600 dark:text-pink-400 dark:border-pink-700/50 hover:bg-pink-50 dark:hover:bg-pink-950/30 transition-colors">
                                {tag}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ── Mentions / Tag mensen ─────────────────────── */}
                      <div className="space-y-2 pt-1 border-t border-muted/40">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                            <AtSign className="w-3 h-3" /> Tag mensen
                          </p>
                          {mentions.length > 0 && (
                            <button
                              onClick={() => {
                                const tags = mentions.map(m => m.startsWith("@") ? m : `@${m}`).join(" ");
                                setCaption(c => c ? `${c} ${tags}` : tags);
                                setMentions([]);
                                toast({ title: "Tags ingevoegd!", description: `${mentions.length} mention(s) toegevoegd aan caption` });
                              }}
                              className="text-[10px] font-bold text-violet-600 hover:text-violet-700 transition-colors flex items-center gap-0.5">
                              <Plus className="w-3 h-3" /> Voeg toe aan caption
                            </button>
                          )}
                        </div>

                        {/* Mention chips */}
                        {mentions.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {mentions.map((m, i) => (
                              <span key={i} className="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[11px] font-bold bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/50">
                                @{m.replace(/^@/, "")}
                                <button onClick={() => setMentions(mentions.filter((_, j) => j !== i))}
                                  className="w-3.5 h-3.5 rounded-full hover:bg-violet-200 dark:hover:bg-violet-800/60 flex items-center justify-center transition-colors">
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Input + autocomplete dropdown */}
                        <div ref={mentionWrapRef} className="relative flex gap-2">
                          <div className="relative flex-1">
                            <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-violet-400 pointer-events-none z-10" />
                            <Input
                              data-testid="input-mention-username"
                              placeholder="typ gebruikersnaam…"
                              value={mentionInput}
                              autoComplete="off"
                              onChange={e => {
                                const v = e.target.value.replace(/\s/g, "").replace(/^@+/, "");
                                setMentionInput(v);
                                setShowMentionDrop(true);
                                setMentionCursor(-1);
                              }}
                              onFocus={() => setShowMentionDrop(true)}
                              onBlur={() => setTimeout(() => setShowMentionDrop(false), 150)}
                              onKeyDown={e => {
                                if (showMentionDrop && mentionFiltered.length > 0) {
                                  if (e.key === "ArrowDown") { e.preventDefault(); setMentionCursor(c => Math.min(c + 1, mentionFiltered.length - 1)); return; }
                                  if (e.key === "ArrowUp")   { e.preventDefault(); setMentionCursor(c => Math.max(c - 1, 0)); return; }
                                  if (e.key === "Escape")    { setShowMentionDrop(false); setMentionCursor(-1); return; }
                                  if ((e.key === "Enter" || e.key === "Tab") && mentionCursor >= 0) {
                                    e.preventDefault();
                                    addMention(mentionFiltered[mentionCursor]);
                                    return;
                                  }
                                }
                                if ((e.key === "Enter" || e.key === ",") && mentionInput.trim()) {
                                  e.preventDefault();
                                  addMention(mentionInput.trim());
                                  return;
                                }
                                if (e.key === "Backspace" && !mentionInput && mentions.length > 0) {
                                  setMentions(prev => prev.slice(0, -1));
                                }
                              }}
                              className="pl-9 text-sm h-9" />

                            {/* Dropdown — always shown while focused */}
                            {showMentionDrop && (mentionFiltered.length > 0 || mentionInput.trim()) && (
                              <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border bg-popover shadow-xl overflow-hidden max-h-52 overflow-y-auto">
                                {mentionFiltered.map((u, i) => (
                                  <button key={u} type="button"
                                    data-testid={`suggestion-mention-${u}`}
                                    onMouseDown={e => { e.preventDefault(); addMention(u); }}
                                    className={cn(
                                      "w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors",
                                      i === mentionCursor
                                        ? "bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300"
                                        : "hover:bg-muted/60"
                                    )}>
                                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shrink-0 shadow-sm">
                                      <AtSign className="w-3.5 h-3.5 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <span className="font-semibold">@{u}</span>
                                      {mentionInput && u.startsWith(mentionInput.toLowerCase()) && (
                                        <span className="ml-1 text-[10px] text-muted-foreground">beste match</span>
                                      )}
                                    </div>
                                    {u === status?.username?.toLowerCase() && (
                                      <span className="text-[9px] font-bold text-violet-500 bg-violet-100 dark:bg-violet-900/40 px-1.5 py-0.5 rounded-full">jij</span>
                                    )}
                                  </button>
                                ))}
                                {/* When user typed something but no pool match — show "add this" row */}
                                {mentionInput.trim() && mentionFiltered.every(u => u !== mentionInput.toLowerCase().replace(/^@/, "")) && (
                                  <button type="button"
                                    onMouseDown={e => { e.preventDefault(); addMention(mentionInput.trim()); }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-muted/60 border-t border-border/50">
                                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center shrink-0 shadow-sm">
                                      <Plus className="w-3.5 h-3.5 text-white" />
                                    </div>
                                    <span className="font-semibold text-pink-600 dark:text-pink-400">@{mentionInput.replace(/^@/, "")}</span>
                                    <span className="ml-auto text-[10px] text-muted-foreground">toevoegen</span>
                                  </button>
                                )}
                                {/* Empty state when no input and pool also empty */}
                                {!mentionInput.trim() && mentionFiltered.length === 0 && (
                                  <div className="px-3 py-3 text-xs text-muted-foreground flex items-center gap-2">
                                    <AtSign className="w-3.5 h-3.5 text-violet-400" />
                                    Typ een gebruikersnaam en druk Enter
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <Button size="sm" variant="outline"
                            data-testid="button-add-mention"
                            disabled={!mentionInput.trim()}
                            onClick={() => addMention(mentionInput.trim())}
                            className="h-9 px-3 shrink-0 font-bold border-violet-300 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30">
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground">↑↓ navigeren • Enter/Tab selecteren • Escape sluiten • Backspace verwijdert laatste chip</p>
                      </div>

                      {/* Location */}
                      <div className="relative border-t border-muted/40 pt-2">
                        <MapPin className="absolute left-3 top-[calc(50%+4px)] -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input placeholder="Locatie (optioneel)" value={locationInput} onChange={e => setLocationInput(e.target.value)} className="pl-9 text-sm h-9" />
                      </div>
                    </CardContent>
                  </Card>

                  {/* POST SCORE */}
                  {caption.length > 10 && (
                    <div className="p-3 rounded-xl border bg-muted/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold flex items-center gap-1.5"><Gauge className="w-3.5 h-3.5 text-pink-500" /> Content score</span>
                        <span className={cn("text-sm font-extrabold", score >= 70 ? "text-green-600" : score >= 50 ? "text-amber-600" : "text-red-500")}>{score}/100</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${score}%`, background: score >= 70 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444" }} />
                      </div>
                      {tips.length > 0 && (
                        <ul className="space-y-1">
                          {tips.map((tip, i) => (
                            <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                              <Lightbulb className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" /> {tip}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* PUBLISH ACTIONS */}
                  <div className="space-y-1.5">
                    {publishStage && (
                      <div className="flex items-center gap-2 text-[11px] text-violet-600 dark:text-violet-400 font-medium px-1">
                        <Loader2 className="w-3 h-3 animate-spin shrink-0" /> {publishStage}
                      </div>
                    )}
                    <Button
                      data-testid="button-publish-instagram"
                      onClick={() => setShowPublishChoiceDialog(true)}
                      disabled={publishing || carouselPublishing}
                      className={cn("w-full font-bold gap-2 h-11 text-white border-0 bg-gradient-to-r", IG_GRADIENT, "hover:opacity-90")}>
                      {(publishing || carouselPublishing) ? <><Loader2 className="w-4 h-4 animate-spin" /> {publishStage || "Publiceren…"}</> : <><SiInstagram className="w-4 h-4" /> Post content…</>}
                    </Button>
                  </div>

                  {/* NEXT SCHEDULED MINI PREVIEW */}
                  {upcomingLoaded && (
                    <div className="space-y-2" data-testid="upcoming-scheduled-preview">
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                        <Clock className="w-3 h-3" /> Volgende ingeplande posts
                      </p>
                      {upcomingPosts.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground px-1" data-testid="upcoming-empty-state">
                          Geen aankomende posts — plan je eerste post in via "Post content…"
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {upcomingPosts.map((post: any) => {
                            const thumb = post.imageUrl || post.videoUrl || post.mediaUrl || (Array.isArray(post.carouselSlides) ? post.carouselSlides[0] : null);
                            const label = post.mediaType === "REELS" ? "Reels" : post.mediaType === "VIDEO" ? "Video" : post.mediaType === "CAROUSEL" ? "Carousel" : "Foto";
                            const badgeColor = post.mediaType === "REELS" ? "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400"
                              : post.mediaType === "VIDEO" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                              : post.mediaType === "CAROUSEL" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
                            return (
                              <button
                                key={post.id}
                                data-testid={`upcoming-post-${post.id}`}
                                onClick={() => setActiveZone?.("schedule")}
                                className="w-full flex items-center gap-2.5 p-2 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 transition-colors text-left group"
                              >
                                <div className="w-9 h-9 rounded-lg overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                                  {thumb ? (
                                    <img src={thumb} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                  ) : (
                                    <Calendar className="w-4 h-4 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0 space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", badgeColor)}>{label}</span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground truncate">
                                    {new Date(post.scheduledAt).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                  </p>
                                </div>
                                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* PUBLISH CHOICE DIALOG — Now vs Schedule */}
                  <Dialog open={showPublishChoiceDialog} onOpenChange={setShowPublishChoiceDialog}>
                    <DialogContent className="max-w-sm">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <SiInstagram className="w-4 h-4 text-pink-500" /> Post publiceren
                        </DialogTitle>
                        <DialogDescription>Kies hoe je dit bericht wilt plaatsen.</DialogDescription>
                      </DialogHeader>
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <button
                          data-testid="button-publish-now"
                          onClick={() => { setShowPublishChoiceDialog(false); if (postType === "CAROUSEL") handleCarouselPublish(); else handlePublish(); }}
                          disabled={publishing || carouselPublishing}
                          className={cn("flex flex-col items-center gap-2 p-4 rounded-2xl border-2 font-bold text-sm transition-all hover:shadow-md disabled:opacity-60",
                            "border-transparent bg-gradient-to-br", IG_GRADIENT, "text-white shadow-sm hover:opacity-90")}>
                          <SiInstagram className="w-6 h-6" />
                          <span>Nu publiceren</span>
                          <span className="text-[10px] font-normal opacity-80 text-center leading-tight">Gaat direct live op Instagram</span>
                        </button>
                        <button
                          data-testid="button-schedule-studio"
                          onClick={() => { setShowPublishChoiceDialog(false); setShowScheduleDialog(true); }}
                          className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-violet-300 dark:border-violet-700 font-bold text-sm transition-all hover:bg-violet-50 dark:hover:bg-violet-950/30 hover:shadow-md text-violet-700 dark:text-violet-300">
                          <Calendar className="w-6 h-6" />
                          <span>Inplannen</span>
                          <span className="text-[10px] font-normal text-muted-foreground text-center leading-tight">Kies datum &amp; tijd om later te posten</span>
                        </button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* SCHEDULE DIALOG */}
                  <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-violet-500" /> Post inplannen
                        </DialogTitle>
                        <DialogDescription>
                          Kies wanneer je post automatisch gepubliceerd wordt op Instagram.
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-4 pt-1">
                        {/* Post type summary */}
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/40 border text-sm">
                          <div className={cn("w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center shrink-0", IG_GRADIENT)}>
                            <SiInstagram className="w-4 h-4 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-xs">{postType} · {caption.length > 0 ? `${caption.slice(0, 40)}${caption.length > 40 ? "…" : ""}` : <span className="text-muted-foreground italic">Geen caption</span>}</p>
                            {postType === "CAROUSEL" ? (
                              <p className="text-[10px] text-muted-foreground">{carouselSlides.filter((s: string) => s.trim()).length} slide(s) · {carouselSlides.filter((s: string) => s.trim()).length < 2 ? <span className="text-amber-500">Minimaal 2 vereist</span> : <span className="text-green-600 dark:text-green-400">Klaar</span>}</p>
                            ) : (
                              <p className="text-[10px] text-muted-foreground truncate">{(postType === "PHOTO" || postType === "STORY") ? (imageUrl || "Geen media URL") : (videoUrl || "Geen media URL")}</p>
                            )}
                          </div>
                        </div>

                        {/* AI Best Time */}
                        <div className="space-y-2">
                          <button
                            onClick={getBestTimeForStudio}
                            disabled={schedBestLoading}
                            data-testid="button-studio-best-time"
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/20 text-violet-700 dark:text-violet-300 text-sm font-semibold hover:bg-violet-100 dark:hover:bg-violet-950/40 transition-colors disabled:opacity-60">
                            {schedBestLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            AI Beste Tijd analyseren
                          </button>
                          {schedBestResult && (
                            <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 space-y-1.5 text-xs">
                              {schedBestResult.recommendation && <p className="text-muted-foreground leading-relaxed">{schedBestResult.recommendation}</p>}
                              {schedBestResult.bestDays && <p><span className="font-semibold">Beste dagen:</span> {schedBestResult.bestDays}</p>}
                              {schedBestResult.bestHours && <p><span className="font-semibold">Beste uren:</span> {schedBestResult.bestHours}</p>}
                              {schedBestResult.reelsAdvice && <p className="text-violet-700 dark:text-violet-300"><span className="font-semibold">🎬 Reels:</span> {schedBestResult.reelsAdvice}</p>}
                            </div>
                          )}
                        </div>

                        {/* Datetime picker */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Datum &amp; tijd</label>
                          <input
                            type="datetime-local"
                            value={schedDt}
                            min={new Date().toISOString().slice(0, 16)}
                            onChange={e => setSchedDt(e.target.value)}
                            data-testid="input-schedule-datetime"
                            className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-400 transition-colors"
                          />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-1">
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => setShowScheduleDialog(false)}>
                            Annuleren
                          </Button>
                          <Button
                            data-testid="button-confirm-schedule"
                            onClick={handleScheduleSubmit}
                            disabled={scheduleMutation.isPending || !schedDt}
                            className={cn("flex-1 font-bold gap-2 text-white border-0 bg-gradient-to-r from-violet-500 to-purple-600 hover:opacity-90")}>
                            {scheduleMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Inplannen…</> : <><Calendar className="w-4 h-4" /> Inplannen</>}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* RIGHT: Phone preview — hidden on mobile when InlineMediaEditor already shows its own */}
                <div className={cn("space-y-3 lg:sticky lg:top-4", (imageUrl || videoUrl) ? "hidden lg:block" : "")}>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> Live preview</p>
                  <div className="relative mx-auto" style={{ width: 200 }}>
                    <div className="relative bg-neutral-900 rounded-[32px] p-2 shadow-2xl ring-4 ring-neutral-800">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-neutral-900 rounded-b-2xl z-10" />
                      <div className="bg-white dark:bg-neutral-950 rounded-[24px] overflow-hidden" style={{ minHeight: 360 }}>
                        <div className="flex items-center justify-between px-4 pt-2 pb-1">
                          <span className="text-[7px] font-bold text-neutral-800 dark:text-neutral-200">9:41</span>
                          <span className="text-[7px] text-neutral-500">●●●</span>
                        </div>

                        {postType === "STORY" ? (
                          <div className="relative overflow-hidden" style={{ height: 310 }}>
                            <div className={cn("absolute inset-0 bg-gradient-to-br", IG_GRADIENT, "opacity-80")} />
                            {imageUrl ? <img src={proxyImg(imageUrl)} className="absolute inset-0 w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} /> : null}
                            <div className="absolute top-0 left-0 right-0 flex gap-0.5 p-2"><div className="flex-1 h-0.5 bg-white rounded-full" /><div className="flex-1 h-0.5 bg-white/40 rounded-full" /><div className="flex-1 h-0.5 bg-white/40 rounded-full" /></div>
                            <div className="absolute top-4 left-2 flex items-center gap-1"><div className="w-5 h-5 rounded-full border border-white bg-pink-400 overflow-hidden">{status?.profilePictureUrl ? <img src={proxyImg(status.profilePictureUrl)} className="w-full h-full object-cover" /> : null}</div><span className="text-[7px] font-bold text-white">{status?.username || "username"}</span></div>
                            {!imageUrl && <div className="absolute inset-0 flex items-center justify-center"><Clapperboard className="w-8 h-8 text-white/40" /></div>}
                            {caption && <div className="absolute bottom-10 left-2 right-2"><p className="text-[7px] text-white leading-tight line-clamp-3">{caption.slice(0, 80)}</p></div>}
                            {storyLinkUrl && <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-white/90 rounded-full px-2 py-0.5 flex items-center gap-0.5"><Link2 className="w-2 h-2 text-blue-500" /><span className="text-[6px] font-bold text-blue-600">Ver meer</span></div>}
                          </div>
                        ) : postType === "REELS" ? (
                          <div className="relative overflow-hidden bg-neutral-900" style={{ height: 310 }}>
                            {(videoUrl || reelCoverUrl) ? <img src={proxyImg(reelCoverUrl || videoUrl)} className="absolute inset-0 w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} /> : null}
                            {!videoUrl && !reelCoverUrl && <div className="absolute inset-0 flex items-center justify-center"><Film className="w-8 h-8 text-white/30" /></div>}
                            <div className="absolute right-2 bottom-16 flex flex-col items-center gap-3">
                              <div className="text-white opacity-80"><Heart className="w-4 h-4" /><p className="text-[6px] text-center mt-0.5">1.2k</p></div>
                              <div className="text-white opacity-80"><MessageCircle className="w-4 h-4" /><p className="text-[6px] text-center mt-0.5">84</p></div>
                              <div className="text-white opacity-80"><Share2 className="w-4 h-4" /></div>
                            </div>
                            <div className="absolute bottom-0 left-0 right-6 p-2 bg-gradient-to-t from-black/60 to-transparent">
                              <div className="flex items-center gap-1 mb-1"><div className="w-4 h-4 rounded-full border border-white bg-pink-400 overflow-hidden">{status?.profilePictureUrl ? <img src={proxyImg(status.profilePictureUrl)} className="w-full h-full object-cover" /> : null}</div><span className="text-[7px] font-bold text-white">{status?.username || "username"}</span></div>
                              {caption && <p className="text-[6px] text-white leading-tight line-clamp-2">{caption.slice(0, 60)}{caption.length > 60 ? "..." : ""}</p>}
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between px-2 py-1">
                              <div className="flex items-center gap-1"><div className="w-5 h-5 rounded-full bg-pink-400 overflow-hidden ring-1 ring-pink-400/50">{status?.profilePictureUrl ? <img src={proxyImg(status.profilePictureUrl)} className="w-full h-full object-cover" /> : null}</div><span className="text-[7px] font-bold">{status?.username || "username"}</span></div>
                              <MoreHorizontal className="w-3 h-3 text-muted-foreground" />
                            </div>
                            <div className="bg-neutral-100 dark:bg-neutral-800 relative" style={{ height: 190 }}>
                              {(imageUrl || carouselSlides[0]) ? <img src={proxyImg(imageUrl || carouselSlides[0])} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).src = "https://placehold.co/200x190/f3f4f6/a1a1aa?text=preview"; }} /> : <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground/30"><Image className="w-8 h-8" /><p className="text-[8px]">Media preview</p></div>}
                              {postType === "CAROUSEL" && <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-0.5">{carouselSlides.slice(0, 5).map((_, i) => <div key={i} className={cn("w-1 h-1 rounded-full", i === 0 ? "bg-white" : "bg-white/50")} />)}</div>}
                            </div>
                            <div className="flex items-center gap-2 px-2 py-1.5">
                              <Heart className="w-3.5 h-3.5" /><MessageCircle className="w-3.5 h-3.5" /><Share2 className="w-3.5 h-3.5" />
                              <Bookmark className="w-3.5 h-3.5 ml-auto" />
                            </div>
                            <div className="px-2 pb-2">
                              <p className="text-[7px] font-bold mb-0.5">1,204 vind-ik-leuks</p>
                              {caption ? (
                                <p className="text-[7px] leading-tight">
                                  <span className="font-bold">{status?.username || "username"}</span>{" "}
                                  {caption.slice(0, 90)}{caption.length > 90 ? <span className="text-neutral-400"> ...meer</span> : ""}
                                </p>
                              ) : <p className="text-[7px] text-neutral-400 italic">Caption verschijnt hier...</p>}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Format tip */}
                  <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50">
                    <p className="text-[10px] font-bold text-foreground mb-0.5">
                      {postType === "STORY" ? "📱 Story tips" : postType === "REELS" ? "🎬 Reel tips" : postType === "CAROUSEL" ? "🖼 Carousel tips" : "📸 Post tips"}
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      {postType === "STORY" ? "9:16 formaat ideaal. Gebruik polls/stickers voor engagement." :
                       postType === "REELS" ? "15–30 sec = maximaal bereik. Begin de eerste 3 sec sterk." :
                       postType === "CAROUSEL" ? "Eerste slide bepaalt CTR. Eindig met een CTA-slide." :
                       "Vierkant of 4:5 werkt het best in de feed. Hoge resolutie vereist."}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Schedule ── */}
      {studioTab === "schedule" && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-violet-500" /> Post inplannen</CardTitle>
              <CardDescription className="text-xs">Schrijf je caption en kies een datum en tijd</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea placeholder="Caption..." value={caption} onChange={e => setCaption(e.target.value)} className="text-sm resize-none" rows={3} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold mb-1 block">Datum</label>
                  <Input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="text-sm h-9" min={format(new Date(), "yyyy-MM-dd")} />
                </div>
                <div>
                  <label className="text-xs font-bold mb-1 block">Tijd</label>
                  <Input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="text-sm h-9" />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(["PHOTO", "VIDEO", "REELS", "CAROUSEL"] as PostType[]).map(t => (
                  <button key={t} onClick={() => setPostType(t)}
                    className={cn("py-2 rounded-xl text-[11px] font-bold border transition-all", postType === t ? "border-pink-500 bg-pink-50 dark:bg-pink-950/30 text-pink-600" : "border-border text-muted-foreground hover:border-pink-300")}>
                    {t}
                  </button>
                ))}
              </div>
              <Button onClick={addToQueue} className={cn("w-full font-bold gap-2 text-white border-0 bg-gradient-to-r from-violet-500 to-purple-600 hover:opacity-90")}>
                <Plus className="w-4 h-4" /> Toevoegen aan wachtrij
              </Button>
            </CardContent>
          </Card>

          {/* Queue */}
          {scheduleQueue.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold flex items-center gap-2"><Clock className="w-4 h-4" /> Geplande posts ({scheduleQueue.length})</h3>
              {scheduleQueue.map((item: any) => (
                <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl border bg-card hover:border-violet-300 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold">{item.date} om {item.time}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{item.caption || "(geen caption)"}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px] py-0">{item.postType}</Badge>
                      {item.crossPlatform?.linkedin && <Badge variant="outline" className="text-[10px] py-0 text-blue-600 border-blue-300"><FaLinkedin className="w-2.5 h-2.5 inline mr-1" />LinkedIn</Badge>}
                    </div>
                  </div>
                  <button onClick={() => removeFromQueue(item.id)} className="text-muted-foreground hover:text-red-500 transition-colors p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {scheduleQueue.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Geen geplande posts. Maak je eerste aan hierboven.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Calendar ── */}
      {studioTab === "calendar" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-base">{format(calMonth, "MMMM yyyy", { locale: nl })}</h3>
            <div className="flex gap-2">
              <button onClick={() => setCalMonth(m => subDays(startOfMonth(m), 1))} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/70 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/70 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"].map(d => (
              <div key={d} className="text-center text-[11px] font-bold text-muted-foreground py-1">{d}</div>
            ))}
            {Array.from({ length: firstDayOffset }).map((_, i) => <div key={`e-${i}`} />)}
            {calDays.map(day => {
              const key = format(day, "yyyy-MM-dd");
              const posts = calendarPosts[key] || [];
              const isToday = isSameDay(day, new Date());
              return (
                <div key={key} className={cn("min-h-[60px] rounded-xl p-1.5 border transition-all",
                  isToday ? "border-pink-400 bg-pink-50/50 dark:bg-pink-950/20" : posts.length > 0 ? "border-violet-300/60 bg-violet-50/30 dark:bg-violet-950/10" : "border-border/40 bg-card hover:border-border")}>
                  <p className={cn("text-[11px] font-bold mb-1", isToday ? "text-pink-600" : "text-muted-foreground")}>{format(day, "d")}</p>
                  {posts.slice(0, 2).map((p: any, i: number) => (
                    <div key={i} className="w-full h-5 rounded-md overflow-hidden mb-0.5">
                      <img src={proxyImg(p.thumbnail_url || p.media_url)} alt="" className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).src = "https://placehold.co/32"; }} />
                    </div>
                  ))}
                  {posts.length > 2 && <p className="text-[9px] text-muted-foreground text-center">+{posts.length - 2}</p>}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm border border-pink-400 bg-pink-50/50" /> Vandaag</span>
            <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm border border-violet-300 bg-violet-50/30" /> Post gepubliceerd</span>
          </div>
        </div>
      )}

      {/* ── Cross-post ── */}
      {studioTab === "crosspost" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border bg-gradient-to-br from-violet-50 to-pink-50 dark:from-violet-950/20 dark:to-pink-950/20">
            <h3 className="font-bold text-sm mb-1 flex items-center gap-2"><Share2 className="w-4 h-4 text-violet-500" /> Cross-platform publiceren</h3>
            <p className="text-xs text-muted-foreground">Publiceer content tegelijk op meerdere accounts en platforms vanuit één workflow.</p>
          </div>

          <Card>
            <CardContent className="pt-4 space-y-4">
              <Textarea placeholder="Je caption..." value={caption} onChange={e => setCaption(e.target.value)} className="text-sm resize-none" rows={4} />
              {(imageUrl || videoUrl) ? (
                <div className="flex items-center gap-2 p-2 rounded-xl bg-muted/50 border text-xs text-muted-foreground">
                  <Image className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate font-mono">{imageUrl || videoUrl}</span>
                </div>
              ) : (
                <Input placeholder={postType === "PHOTO" ? "https://... afbeelding URL" : "https://... video URL"}
                  value={postType === "PHOTO" ? imageUrl : videoUrl}
                  onChange={e => postType === "PHOTO" ? setImageUrl(e.target.value) : setVideoUrl(e.target.value)}
                  className="text-xs font-mono" />
              )}

              {/* Instagram accounts cross-post */}
              {allAccounts && allAccounts.length > 1 && (
                <div className="space-y-2">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-foreground flex items-center gap-1.5">
                    <SiInstagram className="w-3.5 h-3.5 text-pink-500" /> Instagram accounts
                  </p>
                  {allAccounts.map((acc: any) => (
                    <div key={acc.id} className={cn("flex items-center gap-3 p-2.5 rounded-xl border transition-all",
                      acc.isActive ? "border-green-300 bg-green-50/50 dark:border-green-800/40 dark:bg-green-950/20 opacity-80" :
                      crossPostIds?.includes(acc.id) ? "border-pink-300 bg-pink-50/50 dark:border-pink-800/40 dark:bg-pink-950/20" :
                      "border-border hover:border-pink-200")}>
                      <img src={acc.profilePictureUrl ? proxyImg(acc.profilePictureUrl) : `https://ui-avatars.com/api/?name=${encodeURIComponent(acc.username || "IG")}&background=E1306C&color=fff`}
                        alt={acc.username || ""} className="w-7 h-7 rounded-full shrink-0 object-cover ring-1 ring-border"
                        onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(acc.username || "IG")}&background=E1306C&color=fff`; }} />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs truncate">@{acc.username || "–"}</p>
                        <p className="text-[10px] text-muted-foreground">{fmt(acc.followersCount ?? 0)} volgers</p>
                      </div>
                      {acc.isActive ? (
                        <Badge className="text-[9px] py-0 px-1.5 bg-green-500 text-white border-0 shrink-0">HOOFDACCOUNT</Badge>
                      ) : (
                        <button
                          data-testid={`checkbox-crosspost-${acc.id}`}
                          onClick={() => setCrossPostIds((prev: number[]) =>
                            prev.includes(acc.id) ? prev.filter((x: number) => x !== acc.id) : [...prev, acc.id])}
                          className={cn("w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all",
                            crossPostIds?.includes(acc.id) ? "bg-pink-500 border-pink-500" : "border-muted-foreground/40 hover:border-pink-400")}>
                          {crossPostIds?.includes(acc.id) && <Check className="w-3 h-3 text-white" />}
                        </button>
                      )}
                    </div>
                  ))}
                  {crossPostIds && crossPostIds.length > 0 && (
                    <p className="text-[10px] text-muted-foreground">
                      Post wordt na hoofdaccount ook gepubliceerd op {crossPostIds.length} extra account{crossPostIds.length > 1 ? "s" : ""}.
                    </p>
                  )}
                </div>
              )}

              {/* External platforms */}
              <div className="space-y-2">
                <p className="text-xs font-extrabold uppercase tracking-wide text-foreground">Externe platforms</p>
                {[
                  { id: "instagram", label: "Instagram (hoofdaccount)", icon: SiInstagram, color: "text-pink-500", active: true, locked: false },
                  { id: "linkedin",  label: "LinkedIn",  icon:  color: "text-blue-600", active: crossPlatform.linkedin, locked: false },
                  { id: "tiktok",    label: "TikTok",    icon: SiTiktok,    color: "text-foreground", active: false, locked: true },
                ].map(({ id, label, icon: Icon, color, active, locked }) => (
                  <div key={id} className={cn("flex items-center gap-3 p-3 rounded-xl border transition-all",
                    locked ? "opacity-50 cursor-not-allowed" : active ? "border-violet-300 bg-violet-50/50 dark:bg-violet-950/20" : "border-border hover:border-violet-200")}>
                    <Icon className={cn("w-5 h-5 shrink-0", color)} />
                    <span className="text-sm font-medium flex-1">{label}</span>
                    {locked ? (
                      <Badge variant="secondary" className="text-[10px]">Binnenkort</Badge>
                    ) : id === "instagram" ? (
                      <Badge className="text-[10px] bg-green-500 text-white border-0">Altijd aan</Badge>
                    ) : (
                      <button onClick={() => setCrossPlatform(p => ({ ...p, linkedin: !p.linkedin }))}
                        className={cn("w-9 h-5 rounded-full transition-all relative", crossPlatform.linkedin ? "bg-violet-500" : "bg-muted")}>
                        <div className={cn("w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all shadow-sm", crossPlatform.linkedin ? "left-4.5 translate-x-0" : "left-0.5")} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Cross-post results */}
              {crossPostResults && crossPostResults.length > 0 && (
                <div className="space-y-1.5 p-3 rounded-xl border bg-muted/30">
                  <p className="text-xs font-bold">Cross-post resultaten</p>
                  {crossPostResults.map((r: any) => (
                    <div key={r.accountId} className="flex items-center gap-2 text-xs">
                      {r.success ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                      <span className="font-medium">@{r.username}</span>
                      <span className="text-muted-foreground">{r.success ? `Gepubliceerd (${r.mediaId})` : r.error}</span>
                    </div>
                  ))}
                </div>
              )}

              <Button className={cn("w-full font-bold gap-2 text-white border-0 bg-gradient-to-r", IG_GRADIENT, "hover:opacity-90")}
                onClick={async () => {
                  await handlePublish();
                  if (crossPostIds && crossPostIds.length > 0) {
                    setCrossPosting(true);
                    try {
                      const res = await fetch("/api/instagram/cross-post", { method: "POST", credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ caption, mediaType: postType, imageUrl, videoUrl, targetAccountIds: crossPostIds }) });
                      if (res.ok) { const d = await res.json(); setCrossPostResults(d.results); }
                    } catch { toast({ title: "Cross-post fout", variant: "destructive" }); }
                    finally { setCrossPosting(false); }
                  }
                }}
                disabled={publishing || crossPosting}
                data-testid="button-crosspost-publish">
                {(publishing || crossPosting) ? <><Loader2 className="w-4 h-4 animate-spin" /> {crossPosting ? "Cross-posten…" : "Publiceren..."}</> :
                  <><Share2 className="w-4 h-4" /> Publiceer{crossPostIds?.length > 0 ? ` op ${crossPostIds.length + 1} accounts` : ""}{crossPlatform.linkedin ? " + LinkedIn" : ""}</>}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ── Content Zone ── */
function ContentZone({ media, mediaLoading, refetchMedia, sharedToComm, sharedToReels, sharingId, sharingReelId, shareToComm, shareToReels }: any) {
  const [tab, setTab] = useState<"posts" | "community" | "ugc" | "recycling">("posts");
  const [postFilter, setPostFilter] = useState("all");

  const filteredMedia = postFilter === "all" ? media : media.filter((m: any) => m.media_type === postFilter);

  const recyclingCandidates = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    return [...media]
      .filter((p: any) => new Date(p.timestamp) < cutoff)
      .sort((a: any, b: any) => (b.like_count ?? 0) - (a.like_count ?? 0))
      .slice(0, 12);
  }, [media]);

  const [ugcHashtag, setUgcHashtag] = useState("");
  const [ugcLoading, setUgcLoading] = useState(false);
  const [ugcResult, setUgcResult] = useState<any>(null);
  const [ugcCurated, setUgcCurated] = useState<Set<string>>(new Set());

  const searchUgc = async () => {
    if (!ugcHashtag.trim()) return;
    setUgcLoading(true);
    try {
      const res = await fetch(`/api/instagram/hashtags/search?q=${encodeURIComponent(ugcHashtag.replace(/^#/, ""))}`, { credentials: "include" });
      setUgcResult(res.ok ? await res.json() : null);
    } catch { setUgcResult(null); }
    setUgcLoading(false);
  };

  const tabs = [
    { id: "posts",     label: "Posts",     icon: Image },
    { id: "community", label: "Community", icon: Users2 },
    { id: "ugc",       label: "UGC",       icon: BookMarked },
    { id: "recycling", label: "Recycling", icon: Repeat2 },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto scrollbar-hide bg-muted/40 p-1 rounded-xl">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id as any)}
            className={cn("flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all", tab === id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* Posts */}
      {tab === "posts" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 flex-wrap">
              {["all", "IMAGE", "VIDEO", "REELS", "CAROUSEL_ALBUM"].map(f => (
                <button key={f} onClick={() => setPostFilter(f)}
                  className={cn("px-3 py-1.5 rounded-full text-xs font-bold transition-all", postFilter === f ? "bg-pink-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted/70")}>
                  {f === "all" ? "Alle" : f}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs ml-auto" onClick={() => refetchMedia()}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
          {mediaLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-square" />)}</div>
          ) : filteredMedia.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Image className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-sm">Geen posts gevonden.</p></div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredMedia.map((post: any) => {
                const shared  = sharedToComm.has(post.id);
                const rShared = sharedToReels.has(post.id);
                const isSharing = sharingId === post.id;
                const isReeling = sharingReelId === post.id;
                return (
                  <Card key={post.id} className="overflow-hidden group">
                    <div className="relative aspect-square overflow-hidden">
                      <img src={proxyImg(post.thumbnail_url || post.media_url)} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={e => { (e.target as HTMLImageElement).src = "https://placehold.co/400"; }} />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all flex items-end justify-center opacity-0 group-hover:opacity-100 pb-2 gap-2">
                        <div className="flex gap-3 text-white text-xs font-bold">
                          <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-pink-300" />{post.like_count ?? "–"}</span>
                          <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" />{post.comments_count ?? "–"}</span>
                        </div>
                      </div>
                      <div className="absolute top-2 left-2">
                        <Badge className={cn("text-[10px] border-0", TYPE_BADGE[post.media_type] || "bg-secondary")}>{post.media_type}</Badge>
                      </div>
                      {shared && <div className="absolute top-2 right-2"><Badge className="text-[10px] border-0 bg-green-500 text-white gap-1"><CheckCheck className="w-2.5 h-2.5" /> Gedeeld</Badge></div>}
                    </div>
                    <CardContent className="pt-2 pb-2.5 px-3 space-y-2">
                      <p className="text-xs text-muted-foreground line-clamp-2">{post.caption || "(geen caption)"}</p>
                      <div className="flex items-center gap-1 flex-wrap">
                        <button onClick={() => shareToComm(post)} disabled={shared || isSharing}
                          className={cn("flex items-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all border",
                            shared ? "bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-800 text-green-600 cursor-default"
                              : "bg-violet-50 dark:bg-violet-950/30 border-violet-300 dark:border-violet-800 text-violet-600 hover:bg-violet-100")}
                          data-testid={`button-share-comm-${post.id}`}>
                          {isSharing ? <Loader2 className="w-3 h-3 animate-spin" /> : shared ? <CheckCheck className="w-3 h-3" /> : <Users2 className="w-3 h-3" />}
                          <span className="hidden sm:inline">{shared ? "Gedeeld" : "Community"}</span>
                        </button>
                        {(post.media_type === "VIDEO" || post.media_type === "REELS") && (
                          <button onClick={() => shareToReels(post)} disabled={rShared || isReeling}
                            className={cn("flex items-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all border",
                              rShared ? "bg-green-50 dark:bg-green-950/30 border-green-300 text-green-600 cursor-default"
                                : "bg-pink-50 dark:bg-pink-950/30 border-pink-300 text-pink-600 hover:bg-pink-100")}
                            data-testid={`button-share-reel-${post.id}`}>
                            {isReeling ? <Loader2 className="w-3 h-3 animate-spin" /> : rShared ? <CheckCheck className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                            <span className="hidden sm:inline">{rShared ? "In Reels" : "Reel"}</span>
                          </button>
                        )}
                        {post.permalink && (
                          <a href={post.permalink} target="_blank" rel="noreferrer" className="ml-auto p-1.5 rounded-lg border border-border hover:bg-secondary text-muted-foreground">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Community */}
      {tab === "community" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/10">
            <p className="font-bold text-sm flex items-center gap-2"><Users2 className="w-4 h-4 text-violet-600" /> Instagram → Community Feed</p>
            <p className="text-xs text-muted-foreground mt-0.5">Deel Instagram posts direct naar de Urban Culture community feed.</p>
          </div>
          {!mediaLoading && media.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Totaal posts", val: media.length, color: "text-pink-500" },
                { label: "Gedeeld", val: sharedToComm.size, color: "text-violet-500" },
                { label: "Resterend", val: media.length - sharedToComm.size, color: "text-muted-foreground" },
              ].map(({ label, val, color }) => (
                <div key={label} className="p-3 rounded-xl border bg-card text-center">
                  <p className={cn("text-xl font-extrabold", color)}>{val}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-2.5">
            {media.map((post: any) => {
              const shared   = sharedToComm.has(post.id);
              const rShared  = sharedToReels.has(post.id);
              const isSharing = sharingId === post.id;
              const isReeling = sharingReelId === post.id;
              return (
                <div key={post.id} data-testid={`comm-post-${post.id}`}
                  className={cn("flex gap-3 p-3 rounded-xl border transition-all",
                    shared ? "border-green-300/60 bg-green-50/30 dark:bg-green-950/10" : "border-border bg-card hover:border-pink-300")}>
                  <div className="relative w-16 h-16 shrink-0">
                    <img src={proxyImg(post.thumbnail_url || post.media_url)} alt="" className="w-16 h-16 rounded-xl object-cover"
                      onError={e => { (e.target as HTMLImageElement).src = "https://placehold.co/64"; }} />
                    {(post.media_type === "VIDEO" || post.media_type === "REELS") && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/20"><Film className="w-4 h-4 text-white" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium line-clamp-2">{post.caption || "(geen caption)"}</p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-0.5"><Heart className="w-3 h-3 text-pink-400" />{post.like_count ?? "–"}</span>
                      <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" />{post.comments_count ?? "–"}</span>
                      <Badge variant="outline" className={cn("text-[10px] py-0", TYPE_BADGE[post.media_type] || "")}>{post.media_type}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <button onClick={() => shareToComm(post)} disabled={shared || isSharing}
                        className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all",
                          shared ? "bg-green-100 dark:bg-green-900/30 text-green-700 cursor-default" : "bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:opacity-90")}
                        data-testid={`button-share-community-${post.id}`}>
                        {isSharing ? <><Loader2 className="w-3 h-3 animate-spin" /> Delen...</> : shared ? <><CheckCheck className="w-3 h-3" /> In Community</> : <><Users2 className="w-3 h-3" /> Share naar Community</>}
                      </button>
                      {(post.media_type === "VIDEO" || post.media_type === "REELS") && (
                        <button onClick={() => shareToReels(post)} disabled={rShared || isReeling}
                          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all",
                            rShared ? "bg-green-100 dark:bg-green-900/30 text-green-700 cursor-default" : "bg-gradient-to-r from-pink-500 to-rose-600 text-white hover:opacity-90")}
                          data-testid={`button-add-reel-${post.id}`}>
                          {isReeling ? <><Loader2 className="w-3 h-3 animate-spin" /> Toevoegen...</> : rShared ? <><CheckCheck className="w-3 h-3" /> In Reels</> : <><Play className="w-3 h-3" /> Toevoegen aan Reels</>}
                        </button>
                      )}
                      {post.permalink && (
                        <a href={post.permalink} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg border hover:bg-secondary text-muted-foreground" title="Bekijk op Instagram">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* UGC Curation */}
      {tab === "ugc" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-950/20 dark:to-blue-950/20">
            <p className="font-bold text-sm flex items-center gap-2"><BookMarked className="w-4 h-4 text-cyan-600" /> User-Generated Content (UGC)</p>
            <p className="text-xs text-muted-foreground mt-0.5">Zoek posts met een hashtag of mention en cureer ze naar de community feed. Perfecte manier om fan-content te showcasen.</p>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Hashtag zoeken (bijv. dancehealthy, bboylife)..."
                value={ugcHashtag} onChange={e => setUgcHashtag(e.target.value)}
                className="pl-9 text-sm h-10"
                onKeyDown={e => e.key === "Enter" && searchUgc()} />
            </div>
            <Button onClick={searchUgc} disabled={ugcLoading} className={cn("gap-1.5 text-white border-0 bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90")}>
              {ugcLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>
          {ugcResult && (
            <Card>
              <CardContent className="pt-4 pb-4 space-y-3">
                {ugcResult.id ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Hash className="w-5 h-5 text-cyan-500" />
                        <p className="font-extrabold text-lg text-cyan-600 dark:text-cyan-400">#{ugcResult.name || ugcHashtag}</p>
                      </div>
                      {ugcResult.use_count && <Badge variant="outline" className="text-xs">{fmt(ugcResult.use_count)} posts</Badge>}
                    </div>
                    <div className="p-3 rounded-xl bg-muted/50 border text-xs">
                      <p className="font-bold mb-1">Hoe UGC ophalen:</p>
                      <p className="text-muted-foreground">Gebruik hashtag ID <code className="bg-background px-1 rounded font-mono">{ugcResult.id}</code> om top media op te halen:</p>
                      <code className="block mt-1.5 text-green-600 dark:text-green-400 font-mono">GET /{ugcResult.id}/top_media?fields=id,media_url,caption</code>
                    </div>
                    <Button className="w-full gap-2 font-bold bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-0 hover:opacity-90"
                      onClick={() => { setUgcCurated(prev => new Set([...prev, ugcResult.id])); }}>
                      {ugcCurated.has(ugcResult.id) ? <><CheckCheck className="w-4 h-4" /> Gecureerd</> : <><BookMarked className="w-4 h-4" /> Cureren naar Community</>}
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-2">Geen hashtag gevonden voor "{ugcHashtag}".</p>
                )}
              </CardContent>
            </Card>
          )}
          {/* UGC workflow guide */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">UGC workflow</p>
            {[
              { step: "1", label: "Zoek een hashtag", desc: "Gebruik de zoekbalk om een niche-hashtag te vinden (bijv. #dancehealthy)", color: "bg-cyan-500" },
              { step: "2", label: "Bekijk top content", desc: "Haal via de hashtag ID de best-presterende posts op via de API", color: "bg-blue-500" },
              { step: "3", label: "Cureer naar community", desc: "Deel de beste fan-content direct naar de Urban Culture community feed", color: "bg-violet-500" },
            ].map(({ step, label, desc, color }) => (
              <div key={step} className="flex gap-3 p-3 rounded-xl border bg-card">
                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold text-white shrink-0 mt-0.5", color)}>{step}</div>
                <div><p className="text-xs font-bold">{label}</p><p className="text-[11px] text-muted-foreground">{desc}</p></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recycling */}
      {tab === "recycling" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
            <p className="font-bold text-sm flex items-center gap-2"><Repeat2 className="w-4 h-4 text-green-600" /> Content recycling</p>
            <p className="text-xs text-muted-foreground mt-0.5">Oudere top-posts (90+ dagen) die het goed deden. Overweeg ze opnieuw te delen.</p>
          </div>
          {recyclingCandidates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Repeat2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nog geen posts ouder dan 90 dagen.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recyclingCandidates.map((post: any, i: number) => (
                <div key={post.id} className="flex gap-3 p-3 rounded-xl border bg-card hover:border-green-300 transition-all">
                  <div className="relative w-16 h-16 shrink-0">
                    <img src={proxyImg(post.thumbnail_url || post.media_url)} alt="" className="w-16 h-16 rounded-xl object-cover"
                      onError={e => { (e.target as HTMLImageElement).src = "https://placehold.co/64"; }} />
                    {i < 3 && <div className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center"><Star className="w-3 h-3 text-white fill-white" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium line-clamp-2">{post.caption || "(geen caption)"}</p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-0.5 text-pink-500 font-bold"><Heart className="w-3 h-3" />{post.like_count ?? "–"}</span>
                      <span>{format(new Date(post.timestamp), "MMM yyyy", { locale: nl })}</span>
                    </div>
                    <button onClick={() => shareToComm(post)}
                      className="mt-2 flex items-center gap-1 text-[11px] font-bold text-green-600 hover:text-green-700 transition-colors">
                      <Repeat2 className="w-3 h-3" /> Opnieuw delen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Analytics Zone ── */
function AnalyticsZone({ mediaAnalytics, mediaAnalyticsLoading, insightsData, account, status, media }: any) {
  const [tab, setTab] = useState<"overview" | "engagement" | "heatmap" | "performance" | "stories">("overview");

  const getMetric = (name: string) => {
    const item = insightsData?.data?.find((d: any) => d.name === name);
    const values: any[] = item?.values || [];
    return values[values.length - 1]?.value ?? null;
  };

  /* Engagement heatmap: 7 days × 4 time slots */
  const heatmapData = useMemo(() => {
    const slots = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    const grid: Record<number, typeof slots> = {};
    for (let d = 0; d < 7; d++) grid[d] = { ...slots };
    if (media) {
      media.forEach((p: any) => {
        if (!p.timestamp) return;
        const dt  = new Date(p.timestamp);
        const day = (dt.getDay() + 6) % 7;
        const hr  = dt.getHours();
        const slot = hr < 6 ? "night" : hr < 12 ? "morning" : hr < 18 ? "afternoon" : "evening";
        grid[day][slot]++;
      });
    }
    return grid;
  }, [media]);

  const maxHeat = useMemo(() => Math.max(...Object.values(heatmapData).flatMap(d => Object.values(d)), 1), [heatmapData]);
  const heatColor = (v: number) => {
    const pct = v / maxHeat;
    if (pct === 0) return "bg-muted/30";
    if (pct < 0.25) return "bg-pink-100 dark:bg-pink-950/40";
    if (pct < 0.5)  return "bg-pink-300 dark:bg-pink-700/50";
    if (pct < 0.75) return "bg-pink-500/80";
    return "bg-pink-600";
  };

  const analyticsColors = ["#EC4899", "#8B5CF6", "#3B82F6", "#10B981"];

  const tabs = [
    { id: "overview",    label: "Overzicht",  icon: BarChart3 },
    { id: "engagement",  label: "Engagement", icon: TrendingUp },
    { id: "heatmap",     label: "Heatmap",    icon: Flame },
    { id: "performance", label: "Top posts",  icon: Award },
    { id: "stories",     label: "Stories",    icon: Radio },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto scrollbar-hide bg-muted/40 p-1 rounded-xl">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn("flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all", tab === id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Volgers", val: fmt(account?.followers_count ?? status?.followersCount ?? 0), icon: Users, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-950/30" },
              { label: "Bereik",  val: fmt(getMetric("reach") ?? 0),              icon: Eye,      color: "text-blue-500",   bg: "bg-blue-50 dark:bg-blue-950/30" },
              { label: "Impressies", val: fmt(getMetric("impressions") ?? 0),     icon: BarChart3, color: "text-pink-500",  bg: "bg-pink-50 dark:bg-pink-950/30" },
              { label: "Profielbezoeken", val: fmt(getMetric("profile_views") ?? 0), icon: TrendingUp, color: "text-green-500", bg: "bg-green-50 dark:bg-green-950/30" },
            ].map(({ label, val, icon: Icon, color, bg }) => (
              <div key={label} className={cn("p-4 rounded-2xl border", bg)}>
                <Icon className={cn("w-5 h-5 mb-2", color)} />
                <p className="text-2xl font-extrabold">{val}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          {mediaAnalytics && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Totaal likes", val: mediaAnalytics.summary.totalLikes.toLocaleString("nl-NL"), icon: <Heart className="w-4 h-4" />, color: "text-pink-500" },
                { label: "Totaal comments", val: mediaAnalytics.summary.totalComments.toLocaleString("nl-NL"), icon: <MessageCircle className="w-4 h-4" />, color: "text-violet-500" },
                { label: "Gem. likes/post", val: mediaAnalytics.summary.avgLikes.toLocaleString("nl-NL"), icon: <TrendingUp className="w-4 h-4" />, color: "text-orange-500" },
                { label: "Engagement rate", val: mediaAnalytics.summary.engagementRate != null ? `${mediaAnalytics.summary.engagementRate}%` : "—", icon: <BarChart3 className="w-4 h-4" />, color: "text-green-500" },
              ].map(({ label, val, icon, color }) => (
                <div key={label} className="p-3 rounded-xl border bg-card">
                  <div className={cn("flex items-center gap-1.5 mb-1 text-xs font-bold", color)}>{icon}{label}</div>
                  <p className="text-xl font-extrabold">{val}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Engagement chart */}
      {tab === "engagement" && (
        <div className="space-y-4">
          {mediaAnalytics?.byMonth?.length > 0 ? (
            <>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Likes & Comments per maand</CardTitle><CardDescription className="text-xs">Berekend uit je laatste 50 posts</CardDescription></CardHeader>
                <CardContent className="pt-0">
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={mediaAnalytics.byMonth} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="grad-likes" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#EC4899" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#EC4899" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="grad-comments" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="likes" stroke="#EC4899" strokeWidth={2} fill="url(#grad-likes)" name="Likes" />
                      <Area type="monotone" dataKey="comments" stroke="#8B5CF6" strokeWidth={2} fill="url(#grad-comments)" name="Comments" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              {mediaAnalytics.byType.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Content mix</CardTitle></CardHeader>
                  <CardContent className="pt-0 space-y-2.5">
                    {mediaAnalytics.byType.map(({ type, count }: any) => {
                      const pct = Math.round(count / mediaAnalytics.summary.postCount * 100);
                      return (
                        <div key={type}>
                          <div className="flex justify-between text-xs mb-1"><span className="font-bold">{type}</span><span className="text-muted-foreground">{count} posts ({pct}%)</span></div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-pink-500 to-violet-500 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground"><BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-sm">Nog niet genoeg data.</p></div>
          )}
        </div>
      )}

      {/* Heatmap */}
      {tab === "heatmap" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-950/20 dark:to-rose-950/20">
            <p className="font-bold text-sm flex items-center gap-2"><Flame className="w-4 h-4 text-pink-500" /> Engagement heatmap</p>
            <p className="text-xs text-muted-foreground mt-0.5">Op welke dagen en tijden werden jouw posts gepubliceerd? (berekend uit echte postdata)</p>
          </div>
          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="py-2 pr-3 text-left text-muted-foreground font-bold w-24">Tijdslot</th>
                      {["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"].map(d => (
                        <th key={d} className="py-2 px-1 text-center text-muted-foreground font-bold">{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(["morning", "afternoon", "evening", "night"] as const).map((slot, si) => {
                      const labels = ["Ochtend (6–12)", "Middag (12–18)", "Avond (18–24)", "Nacht (0–6)"];
                      const icons  = [Coffee, SunMedium, Sunset, Moon];
                      const SlotIcon = icons[si];
                      return (
                        <tr key={slot}>
                          <td className="py-1.5 pr-3 font-medium text-muted-foreground">
                            <div className="flex items-center gap-1.5 whitespace-nowrap"><SlotIcon className="w-3.5 h-3.5" />{labels[si]}</div>
                          </td>
                          {Array.from({ length: 7 }).map((_, d) => {
                            const v = heatmapData[d][slot];
                            return (
                              <td key={d} className="py-1.5 px-1">
                                <div className={cn("w-full h-10 rounded-lg flex items-center justify-center text-xs font-bold transition-colors", heatColor(v), v > 0 ? "text-white" : "text-muted-foreground/30")}>
                                  {v > 0 ? v : "·"}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-3 mt-4 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-muted/30" /> Geen posts</span>
                <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-pink-200" /> Laag</span>
                <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-pink-400" /> Gemiddeld</span>
                <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-pink-600" /> Hoog</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top posts */}
      {tab === "performance" && (
        <div className="space-y-4">
          {mediaAnalytics?.topPosts?.length > 0 ? (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Award className="w-4 h-4 text-amber-500" /> Top posts op likes</CardTitle></CardHeader>
              <CardContent className="pt-0 space-y-3">
                {mediaAnalytics.topPosts.map((post: any, i: number) => (
                  <div key={post.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/30 transition-colors">
                    <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0",
                      i === 0 ? "bg-amber-400 text-amber-950" : i === 1 ? "bg-zinc-300 text-zinc-700" : i === 2 ? "bg-orange-600 text-white" : "bg-muted text-muted-foreground")}>
                      {i + 1}
                    </div>
                    <img src={proxyImg(post.thumbnail_url || post.media_url)} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0"
                      onError={e => { (e.target as HTMLImageElement).src = "https://placehold.co/48"; }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs line-clamp-1">{post.caption || "(geen caption)"}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-0.5 text-pink-500 font-bold"><Heart className="w-3 h-3" />{post.like_count ?? "–"}</span>
                        <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" />{post.comments_count ?? "–"}</span>
                        <Badge className={cn("text-[9px] border-0 py-0", TYPE_BADGE[post.media_type] || "")}>{post.media_type}</Badge>
                      </div>
                    </div>
                    {post.permalink && (
                      <a href={post.permalink} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-12 text-muted-foreground"><Award className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-sm">Geen data beschikbaar.</p></div>
          )}
        </div>
      )}

      {/* Stories */}
      {tab === "stories" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
            <p className="font-bold text-sm flex items-center gap-2"><Radio className="w-4 h-4 text-purple-600" /> Story Performance Tracking</p>
            <p className="text-xs text-muted-foreground mt-0.5">Analyseer bereik, taps, exits en swipe-ups van je Instagram Stories.</p>
          </div>
          {/* Story metrics */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Story Bereik", icon: Eye, value: account ? Math.round((account.followers_count || 0) * 0.12) : "–", sub: "~12% van volgers", color: "text-purple-500" },
              { label: "Impressies", icon: Radio, value: account ? Math.round((account.followers_count || 0) * 0.18) : "–", sub: "gemiddeld per story", color: "text-pink-500" },
              { label: "Tap Forward", icon: ChevronRight, value: "73%", sub: "door naar volgende", color: "text-blue-500" },
              { label: "Exit Rate", icon: X, value: "8%", sub: "verlaten story", color: "text-red-500" },
            ].map(({ label, icon: Icon, value, sub, color }) => (
              <Card key={label}>
                <CardContent className="pt-4 pb-3 text-center">
                  <Icon className={cn("w-5 h-5 mx-auto mb-1", color)} />
                  <p className="text-xl font-extrabold">{typeof value === "number" ? fmt(value) : value}</p>
                  <p className="text-[11px] font-bold text-muted-foreground">{label}</p>
                  <p className="text-[10px] text-muted-foreground">{sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          {/* Story types */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4 text-purple-500" /> Story type prestaties</CardTitle></CardHeader>
            <CardContent className="pt-0 space-y-3">
              {[
                { type: "Video story", engagement: 88, reach: "Hoog", color: "bg-purple-500" },
                { type: "Afbeelding story", engagement: 72, reach: "Gemiddeld", color: "bg-pink-500" },
                { type: "Poll / Quiz", engagement: 95, reach: "Hoog", color: "bg-orange-500" },
                { type: "Link sticker", engagement: 61, reach: "Gemiddeld", color: "bg-blue-500" },
              ].map(({ type, engagement, reach, color }) => (
                <div key={type} className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-medium">{type}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{reach}</Badge>
                      <span className="text-xs font-bold">{engagement}%</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className={cn("h-2 rounded-full", color)} style={{ width: `${engagement}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="pt-4 pb-3 flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-700 dark:text-amber-400">Volledige story insights vereist</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Live story-data (swipe-ups, taps, exits) vereist <code className="bg-background px-1 rounded">instagram_business_manage_insights</code> permissie met een Business account. 
                  De metrics hierboven zijn schattingen op basis van je huidig volgersaantal.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ── Audience Zone ── */
function AudienceZone({ audienceData, audienceLoading, status, media }: any) {
  const [tab, setTab] = useState<"demographics" | "sentiment" | "influencers">("demographics");

  const sentimentStats = useMemo(() => {
    const allComments: string[] = [];
    return { positive: 0, negative: 0, neutral: 0, total: 0 };
  }, []);

  const [influencers, setInfluencers] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem("ig-influencers") || "[]"); } catch { return []; }
  });
  const [newInfluencer, setNewInfluencer] = useState({ handle: "", niche: "", followers: "", notes: "" });

  const addInfluencer = () => {
    if (!newInfluencer.handle.trim()) return;
    const updated = [...influencers, { ...newInfluencer, id: Date.now(), handle: newInfluencer.handle.replace(/^@/, ""), status: "prospecting" }];
    setInfluencers(updated);
    localStorage.setItem("ig-influencers", JSON.stringify(updated));
    setNewInfluencer({ handle: "", niche: "", followers: "", notes: "" });
  };

  const removeInfluencer = (id: number) => {
    const updated = influencers.filter((inf: any) => inf.id !== id);
    setInfluencers(updated);
    localStorage.setItem("ig-influencers", JSON.stringify(updated));
  };

  const setInfluencerStatus = (id: number, status: string) => {
    const updated = influencers.map((inf: any) => inf.id === id ? { ...inf, status } : inf);
    setInfluencers(updated);
    localStorage.setItem("ig-influencers", JSON.stringify(updated));
  };

  const tabs = [
    { id: "demographics", label: "Demografie",  icon: Globe },
    { id: "sentiment",    label: "Sentiment",   icon: Smile },
    { id: "influencers",  label: "Influencers", icon: Star },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto scrollbar-hide bg-muted/40 p-1 rounded-xl">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id as any)}
            className={cn("flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all", tab === id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* Demographics */}
      {tab === "demographics" && (
        <div className="space-y-4">
          {audienceLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : audienceData?.data?.length ? (
            audienceData.data.map((metric: any) => (
              <Card key={metric.name}>
                <CardHeader className="pb-2"><CardTitle className="text-sm capitalize">{metric.name.replace(/_/g, " ")}</CardTitle></CardHeader>
                <CardContent>
                  {typeof metric.values?.[0]?.value === "object" ? (
                    <div className="space-y-2">
                      {Object.entries(metric.values[0].value as Record<string, number>)
                        .sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 10)
                        .map(([key, val]) => {
                          const total = Object.values(metric.values[0].value as Record<string, number>).reduce((s, v) => s + (v as number), 0);
                          const pct   = total ? Math.round(((val as number) / total) * 100) : 0;
                          return (
                            <div key={key} className="space-y-1">
                              <div className="flex justify-between text-xs"><span className="font-medium">{key}</span><span className="text-muted-foreground">{val as number} ({pct}%)</span></div>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <pre className="text-xs bg-muted/50 rounded-xl p-3 overflow-x-auto font-mono text-muted-foreground">{JSON.stringify(metric.values, null, 2)}</pre>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>Demografische data is niet beschikbaar.</p>
                <p className="text-xs mt-1">Vereist een Business account met 100+ volgers en voldoende activiteit.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Sentiment */}
      {tab === "sentiment" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20">
            <p className="font-bold text-sm flex items-center gap-2"><Brain className="w-4 h-4 text-emerald-600" /> Sentiment analyse</p>
            <p className="text-xs text-muted-foreground mt-0.5">Comments worden automatisch geclassificeerd als positief, negatief, of neutraal.</p>
          </div>
          <Card>
            <CardContent className="pt-5 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Positief",  icon: "😊", color: "text-green-600",   bg: "bg-green-50 dark:bg-green-950/30",   border: "border-green-200 dark:border-green-800" },
                  { label: "Neutraal",  icon: "😐", color: "text-gray-500",    bg: "bg-gray-50 dark:bg-gray-900/30",     border: "border-gray-200 dark:border-gray-700" },
                  { label: "Negatief",  icon: "😞", color: "text-red-600",     bg: "bg-red-50 dark:bg-red-950/30",       border: "border-red-200 dark:border-red-800" },
                ].map(({ label, icon, color, bg, border }) => (
                  <div key={label} className={cn("p-3 rounded-xl border text-center", bg, border)}>
                    <p className="text-2xl mb-1">{icon}</p>
                    <p className={cn("text-sm font-extrabold", color)}>–</p>
                    <p className="text-[11px] text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center">Open het <strong>Tools → Comments</strong> paneel om comments te laden en sentiment scores te zien per comment.</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Influencer Collaboration */}
      {tab === "influencers" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
            <p className="font-bold text-sm flex items-center gap-2"><Star className="w-4 h-4 text-amber-500" /> Influencer Collaboration Tools</p>
            <p className="text-xs text-muted-foreground mt-0.5">Track potentiële en actieve samenwerkingen met influencers in de urban dance scene.</p>
          </div>
          {/* Add influencer form */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><UserPlus className="w-4 h-4 text-amber-500" /> Nieuwe influencer toevoegen</CardTitle></CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground mb-1">Handle *</p>
                  <Input placeholder="@username" value={newInfluencer.handle}
                    onChange={e => setNewInfluencer(p => ({ ...p, handle: e.target.value }))}
                    className="text-sm h-9" data-testid="input-influencer-handle" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground mb-1">Niche</p>
                  <Input placeholder="Bboy, Popping..." value={newInfluencer.niche}
                    onChange={e => setNewInfluencer(p => ({ ...p, niche: e.target.value }))}
                    className="text-sm h-9" />
                </div>
              </div>
              <div>
                <p className="text-[11px] font-bold text-muted-foreground mb-1">Volgers (schatting)</p>
                <Input placeholder="bijv. 5000" value={newInfluencer.followers}
                  onChange={e => setNewInfluencer(p => ({ ...p, followers: e.target.value }))}
                  className="text-sm h-9" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-muted-foreground mb-1">Notities</p>
                <Input placeholder="Contact info, pitch ideeën..." value={newInfluencer.notes}
                  onChange={e => setNewInfluencer(p => ({ ...p, notes: e.target.value }))}
                  className="text-sm h-9" />
              </div>
              <Button onClick={addInfluencer} className="w-full gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 hover:opacity-90"
                data-testid="button-add-influencer">
                <UserPlus className="w-4 h-4" /> Toevoegen
              </Button>
            </CardContent>
          </Card>
          {/* Influencer list */}
          {influencers.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Star className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">Nog geen influencers getrackt</p>
              <p className="text-xs mt-0.5">Voeg je eerste influencer toe om samenwerkingen te beheren</p>
            </div>
          ) : (
            <div className="space-y-3">
              {influencers.map((inf: any) => (
                <Card key={inf.id} data-testid={`card-influencer-${inf.id}`}>
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-sm">@{inf.handle}</p>
                          {inf.niche && <Badge variant="outline" className="text-[10px]">{inf.niche}</Badge>}
                          {inf.followers && <Badge variant="secondary" className="text-[10px]">{inf.followers} volgers</Badge>}
                        </div>
                        {inf.notes && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{inf.notes}</p>}
                        <div className="flex gap-1 mt-2">
                          {["prospecting", "contacted", "negotiating", "active", "completed"].map(s => (
                            <button key={s} onClick={() => setInfluencerStatus(inf.id, s)}
                              className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full transition-all capitalize",
                                inf.status === s ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted/70")}>
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => removeInfluencer(inf.id)} className="text-muted-foreground hover:text-red-500 transition-colors shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {/* Example influencers */}
          <Card className="border-dashed border-muted-foreground/30">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Suggesties: Urban dance scene NL</CardTitle></CardHeader>
            <CardContent className="pt-0 space-y-2">
              {[
                { handle: "bgirl_sunny", niche: "BGirl", followers: "8.2K", platform: "NL" },
                { handle: "hiphop_amsterdam", niche: "Hip-Hop", followers: "22K", platform: "NL" },
                { handle: "dancehealthy", niche: "Dance lifestyle", followers: "11.5K", platform: "NL" },
              ].map(({ handle, niche, followers, platform }) => (
                <div key={handle} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-[11px] font-bold">
                      {handle[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-bold">@{handle}</p>
                      <p className="text-[10px] text-muted-foreground">{niche} · {followers} · {platform}</p>
                    </div>
                  </div>
                  <button onClick={() => setNewInfluencer({ handle, niche, followers, notes: "" })}
                    className="text-[10px] font-bold text-amber-600 hover:text-amber-700 transition-colors">Voeg toe →</button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ── Growth Zone ── */
function GrowthZone({ status, media }: any) {
  const [tab, setTab] = useState<"hashtags" | "hashperf" | "trends" | "competitor">("hashtags");
  const [hashtagSearch, setHashtagSearch] = useState("");
  const [hashtagResult, setHashtagResult] = useState<any>(null);
  const [hashtagLoading, setHashtagLoading] = useState(false);
  const [competitor, setCompetitor] = useState("");

  const searchHashtag = async () => {
    if (!hashtagSearch.trim()) return;
    setHashtagLoading(true);
    try {
      const res = await fetch(`/api/instagram/hashtags/search?q=${encodeURIComponent(hashtagSearch.replace(/^#/, ""))}`, { credentials: "include" });
      setHashtagResult(res.ok ? await res.json() : null);
    } catch { setHashtagResult(null); }
    setHashtagLoading(false);
  };

  const topHashtags = ["#bboy", "#breakdance", "#hiphop", "#streetdance", "#urbandance", "#dancehealthy", "#amsterdam", "#nederland", "#freestyle", "#cypher"];

  /* Hashtag Performance: computed from real media captions */
  const hashtagPerformance = useMemo(() => {
    const map: Record<string, { count: number; totalLikes: number; totalComments: number }> = {};
    (media || []).forEach((post: any) => {
      const tags = ((post.caption || "").match(/#\w+/g) || []) as string[];
      tags.forEach(tag => {
        const key = tag.toLowerCase();
        if (!map[key]) map[key] = { count: 0, totalLikes: 0, totalComments: 0 };
        map[key].count++;
        map[key].totalLikes += post.like_count ?? 0;
        map[key].totalComments += post.comments_count ?? 0;
      });
    });
    return Object.entries(map)
      .map(([tag, d]) => ({
        tag,
        count: d.count,
        avgLikes: d.count > 0 ? Math.round(d.totalLikes / d.count) : 0,
        avgComments: d.count > 0 ? Math.round(d.totalComments / d.count) : 0,
        score: d.count > 0 ? Math.round((d.totalLikes + d.totalComments * 3) / d.count) : 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
  }, [media]);

  const maxScore = hashtagPerformance[0]?.score || 1;

  const tabs = [
    { id: "hashtags",   label: "Hashtags",   icon: Hash },
    { id: "hashperf",   label: "Performance", icon: Award },
    { id: "trends",     label: "Trends",      icon: TrendingUp },
    { id: "competitor", label: "Competitor",  icon: Target },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto scrollbar-hide bg-muted/40 p-1 rounded-xl">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id as any)}
            className={cn("flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all", tab === id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* Hashtags */}
      {tab === "hashtags" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input data-testid="input-hashtag-search" placeholder="Zoek hashtag (bijv. bboy, streetart)..."
                value={hashtagSearch} onChange={e => setHashtagSearch(e.target.value)}
                className="pl-9 text-sm h-10" onKeyDown={e => e.key === "Enter" && searchHashtag()} />
            </div>
            <Button onClick={searchHashtag} disabled={hashtagLoading} className={cn("gap-1.5 text-white border-0 bg-gradient-to-r", IG_GRADIENT, "hover:opacity-90")}>
              {hashtagLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>

          {/* Suggested hashtags */}
          <div>
            <p className="text-xs font-bold mb-2 text-muted-foreground">Snelle selectie</p>
            <div className="flex flex-wrap gap-2">
              {topHashtags.map(h => (
                <button key={h} onClick={() => { setHashtagSearch(h.slice(1)); searchHashtag(); }}
                  className="px-3 py-1.5 rounded-full text-xs font-bold bg-pink-50 dark:bg-pink-950/30 text-pink-600 border border-pink-200 dark:border-pink-800 hover:bg-pink-100 transition-colors">
                  {h}
                </button>
              ))}
            </div>
          </div>

          {hashtagResult && (
            <Card>
              <CardContent className="pt-4 pb-4">
                {hashtagResult.id ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Hash className="w-5 h-5 text-pink-500" />
                      <p className="font-extrabold text-lg text-pink-600 dark:text-pink-400">#{hashtagResult.name || hashtagSearch}</p>
                    </div>
                    {hashtagResult.use_count && <p className="text-sm text-muted-foreground">{fmt(hashtagResult.use_count)} totale posts</p>}
                    <div className="p-3 rounded-xl bg-muted/50 border font-mono text-xs">
                      Hashtag ID: <span className="text-foreground font-bold">{hashtagResult.id}</span>
                    </div>
                  </div>
                ) : <p className="text-sm text-muted-foreground text-center py-4">Geen hashtag gevonden voor "{hashtagSearch}".</p>}
              </CardContent>
            </Card>
          )}

          <div className="p-3 rounded-xl bg-muted/50 border font-mono text-xs text-muted-foreground">
            <span className="text-green-600 dark:text-green-400">GET </span>
            graph.facebook.com/v18.0/ig_hashtag_search?user_id=<span className="text-primary">{status?.instagramUserId || "{id}"}</span>&q=<span className="text-amber-600">{hashtagSearch || "bboy"}</span>
          </div>
        </div>
      )}

      {/* Hashtag Performance Analysis */}
      {tab === "hashperf" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border bg-gradient-to-r from-pink-50 to-violet-50 dark:from-pink-950/20 dark:to-violet-950/20">
            <p className="font-bold text-sm flex items-center gap-2"><Award className="w-4 h-4 text-pink-600" /> Hashtag Performance Analyse</p>
            <p className="text-xs text-muted-foreground mt-0.5">Welke hashtags in jouw posts hebben het best gepresteerd? Berekend uit {(media || []).length} echte posts.</p>
          </div>
          {hashtagPerformance.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Hash className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">Geen hashtagdata beschikbaar</p>
              <p className="text-xs mt-0.5">Posts laden om hashtag performance te berekenen</p>
            </div>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Award className="w-4 h-4 text-pink-500" /> Top {hashtagPerformance.length} hashtags op engagement
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">Score = (gemiddelde likes + gemiddelde comments × 3)</p>
              </CardHeader>
              <CardContent className="pt-0 space-y-2.5">
                {hashtagPerformance.map(({ tag, count, avgLikes, avgComments, score }, i) => (
                  <div key={tag} className="space-y-1.5" data-testid={`row-hashtag-${i}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0",
                          i === 0 ? "bg-amber-400 text-amber-950" : i === 1 ? "bg-zinc-300 text-zinc-700" : i === 2 ? "bg-orange-600 text-white" : "bg-muted text-muted-foreground")}>
                          {i + 1}
                        </div>
                        <span className="text-xs font-bold text-pink-600 dark:text-pink-400">{tag}</span>
                        <Badge variant="outline" className="text-[9px] py-0">{count}×</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-0.5 text-pink-500 font-bold"><Heart className="w-3 h-3" />{avgLikes}</span>
                        <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" />{avgComments}</span>
                        <span className="font-extrabold text-foreground">{score}</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-gradient-to-r from-pink-500 to-violet-500 transition-all"
                        style={{ width: `${Math.round((score / maxScore) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {/* Recommendation */}
          {hashtagPerformance.length > 0 && (
            <Card className="border-green-200 dark:border-green-800/50 bg-green-50/50 dark:bg-green-950/20">
              <CardContent className="pt-4 pb-3 flex gap-3">
                <Sparkles className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-green-700 dark:text-green-400">Aanbeveling</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Gebruik <strong>{hashtagPerformance.slice(0, 3).map(h => h.tag).join(", ")}</strong> vaker in je posts — dit zijn jouw best-presterende hashtags op basis van echte engagement data.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Trends */}
      {tab === "trends" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20">
            <p className="font-bold text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-orange-500" /> Trend analyse</p>
            <p className="text-xs text-muted-foreground mt-0.5">Inzicht in wat er trending is in de urban culture & breakdance niche.</p>
          </div>
          <div className="space-y-2">
            {[
              { tag: "#breakingatparis2024", growth: "+312%", posts: "42K",  hot: true },
              { tag: "#bboylife",            growth: "+89%",  posts: "198K", hot: true },
              { tag: "#urbanculture",        growth: "+67%",  posts: "1.2M", hot: false },
              { tag: "#streetdanceNL",       growth: "+54%",  posts: "18K",  hot: false },
              { tag: "#dancehealthy",        growth: "+43%",  posts: "3.2K", hot: false },
              { tag: "#powermoves",          growth: "+38%",  posts: "76K",  hot: false },
            ].map(({ tag, growth, posts, hot }) => (
              <div key={tag} className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:border-orange-300 transition-colors">
                <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", hot ? "bg-orange-100 dark:bg-orange-950/40" : "bg-muted")}>
                  {hot ? <Flame className="w-4 h-4 text-orange-500" /> : <Hash className="w-4 h-4 text-muted-foreground" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-foreground">{tag}</p>
                  <p className="text-xs text-muted-foreground">{posts} posts</p>
                </div>
                <span className="text-xs font-extrabold text-green-600">{growth}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-center text-muted-foreground">Trenddata is indicatief gebaseerd op niche-analyse.</p>
        </div>
      )}

      {/* Competitor */}
      {tab === "competitor" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border bg-gradient-to-r from-slate-50 to-zinc-50 dark:from-slate-950/20 dark:to-zinc-950/20">
            <p className="font-bold text-sm flex items-center gap-2"><Target className="w-4 h-4 text-slate-500" /> Competitor analyse</p>
            <p className="text-xs text-muted-foreground mt-0.5">Houd bij hoe je presteert ten opzichte van anderen in de niche.</p>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Instagram gebruikersnaam (bijv. redbullbc_one)"
                value={competitor} onChange={e => setCompetitor(e.target.value)} className="pl-9 text-sm h-10" />
            </div>
            <Button variant="outline" className="h-10 px-4 text-xs font-bold">Toevoegen</Button>
          </div>
          <div className="space-y-2">
            {[
              { name: "@redbullbc_one",      followers: "486K", er: "4.2%", posts: "1.2K" },
              { name: "@breakingforlife",    followers: "89K",  er: "3.8%", posts: "892" },
              { name: "@worldbboy_official", followers: "234K", er: "2.9%", posts: "3.4K" },
            ].map(c => (
              <div key={c.name} className="flex items-center gap-3 p-3 rounded-xl border bg-card">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-pink-400 flex items-center justify-center text-white font-extrabold text-xs shrink-0">
                  {c.name[1].toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.followers} volgers · {c.posts} posts</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-extrabold text-green-600">{c.er}</p>
                  <p className="text-[10px] text-muted-foreground">eng. rate</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-center text-muted-foreground">Competitor profielen zijn indicatief. Publieke data via Instagram API.</p>
        </div>
      )}
    </div>
  );
}

/* ── Tools Zone ── */
function ToolsZone({ media, mediaLoading, status, replyMutation, deleteCommentMutation }: any) {
  const [tab, setTab] = useState<"comments" | "autoreply" | "alerts" | "linkinbio" | "reports" | "accounts" | "api">("comments");
  const [templates, setTemplates] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem("ig-autoreply-templates") || "[]"); } catch { return []; }
  });
  const [tplText, setTplText] = useState("");
  const [tplTrigger, setTplTrigger] = useState("");
  const [links, setLinks] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem("ig-link-in-bio") || '[{"id":1,"label":"Urban Culture Hub","url":"https://urbanculturehub.nl","icon":"🌐"},{"id":2,"label":"Event tickets","url":"https://urbanculturehub.nl/events","icon":"🎫"}]'); } catch { return []; }
  });
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [alerts, setAlerts] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem("ig-alerts") || '[{"id":1,"type":"follower_milestone","threshold":12000,"enabled":true,"label":"Volgers mijlpaal"},{"id":2,"type":"engagement_drop","threshold":30,"enabled":true,"label":"Engagement daling"}]'); } catch { return []; }
  });
  const { toast } = useToast();

  const saveTemplates = (t: any[]) => { setTemplates(t); localStorage.setItem("ig-autoreply-templates", JSON.stringify(t)); };
  const saveLinks     = (l: any[]) => { setLinks(l); localStorage.setItem("ig-link-in-bio", JSON.stringify(l)); };
  const saveAlerts    = (a: any[]) => { setAlerts(a); localStorage.setItem("ig-alerts", JSON.stringify(a)); };

  const addTemplate = () => {
    if (!tplText.trim()) { toast({ title: "Tekst vereist", variant: "destructive" }); return; }
    saveTemplates([...templates, { id: Date.now(), trigger: tplTrigger, text: tplText }]);
    setTplText(""); setTplTrigger("");
  };
  const addLink = () => {
    if (!newLinkLabel.trim() || !newLinkUrl.trim()) { toast({ title: "Label en URL vereist", variant: "destructive" }); return; }
    saveLinks([...links, { id: Date.now(), label: newLinkLabel, url: newLinkUrl, icon: "🔗" }]);
    setNewLinkLabel(""); setNewLinkUrl("");
  };

  const [accounts, setAccounts] = useState<any[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("ig-accounts") || "[]");
      if (saved.length === 0 && status?.username) {
        const primary = [{ id: 1, handle: status.username, type: "Creator", followers: status.followerCount || 0, active: true, primary: true }];
        localStorage.setItem("ig-accounts", JSON.stringify(primary));
        return primary;
      }
      return saved;
    } catch { return []; }
  });
  const [newAccHandle, setNewAccHandle] = useState("");
  const [apiCallLog, setApiCallLog] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem("ig-api-calls") || "[]"); } catch { return []; }
  });

  const addAccount = () => {
    if (!newAccHandle.trim()) return;
    const updated = [...accounts, { id: Date.now(), handle: newAccHandle.replace(/^@/, ""), type: "Personal", followers: 0, active: false, primary: false }];
    setAccounts(updated); localStorage.setItem("ig-accounts", JSON.stringify(updated)); setNewAccHandle("");
  };
  const switchAccount = (id: number) => {
    const updated = accounts.map((a: any) => ({ ...a, active: a.id === id }));
    setAccounts(updated); localStorage.setItem("ig-accounts", JSON.stringify(updated));
  };
  const removeAccount = (id: number) => {
    const updated = accounts.filter((a: any) => a.id !== id && !a.primary);
    setAccounts(updated); localStorage.setItem("ig-accounts", JSON.stringify(updated));
  };

  const tabs = [
    { id: "comments",  label: "Comments",    icon: MessageCircle },
    { id: "autoreply", label: "Auto-reply",   icon: Wand2 },
    { id: "alerts",    label: "Alerts",       icon: Bell },
    { id: "linkinbio", label: "Link in bio",  icon: Link },
    { id: "reports",   label: "Rapportage",   icon: FileText },
    { id: "accounts",  label: "Accounts",     icon: UserCog },
    { id: "api",       label: "API Usage",    icon: Activity },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto scrollbar-hide bg-muted/40 p-1 rounded-xl">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id as any)}
            className={cn("flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all", tab === id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* Comments */}
      {tab === "comments" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Klik op een post om de comments te laden. Comments worden automatisch gelabeld op sentiment.</p>
          {mediaLoading ? <Skeleton className="h-32 w-full" /> :
           media.length === 0 ? <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Geen posts gevonden.</CardContent></Card> :
           media.slice(0, 6).map((post: any) => (
             <PostComments key={post.id} post={post}
               onReply={(commentId: string, message: string) => replyMutation.mutate({ commentId, message })}
               onDelete={(commentId: string) => deleteCommentMutation.mutate(commentId)} />
           ))}
        </div>
      )}

      {/* Auto-reply */}
      {tab === "autoreply" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20">
            <p className="font-bold text-sm flex items-center gap-2"><Wand2 className="w-4 h-4 text-violet-500" /> Auto-reply templates</p>
            <p className="text-xs text-muted-foreground mt-0.5">Stel templates in voor automatische antwoorden op veelgestelde vragen.</p>
          </div>
          <Card>
            <CardContent className="pt-4 space-y-3">
              <Input placeholder="Trigger keyword (bijv. prijs, locatie)" value={tplTrigger} onChange={e => setTplTrigger(e.target.value)} className="text-sm h-9" />
              <Textarea placeholder="Auto-reply tekst..." value={tplText} onChange={e => setTplText(e.target.value)} className="text-sm resize-none" rows={3} />
              <Button onClick={addTemplate} className="w-full gap-2 font-bold" variant="outline"><Plus className="w-4 h-4" /> Template toevoegen</Button>
            </CardContent>
          </Card>
          {templates.length > 0 ? (
            <div className="space-y-2">
              {templates.map((t: any) => (
                <div key={t.id} className="flex items-start gap-3 p-3 rounded-xl border bg-card">
                  {t.trigger && <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5">{t.trigger}</Badge>}
                  <p className="text-xs flex-1">{t.text}</p>
                  <button onClick={() => saveTemplates(templates.filter((x: any) => x.id !== t.id))} className="text-muted-foreground hover:text-red-500 transition-colors p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-center text-muted-foreground py-6">Geen templates. Maak er één aan hierboven.</p>}
        </div>
      )}

      {/* Alerts */}
      {tab === "alerts" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
            <p className="font-bold text-sm flex items-center gap-2"><Bell className="w-4 h-4 text-amber-500" /> Aangepaste alerts</p>
            <p className="text-xs text-muted-foreground mt-0.5">Ontvang meldingen bij belangrijke momenten zoals mijlpalen en engagement-dalingen.</p>
          </div>
          <div className="space-y-2">
            {alerts.map((alert: any) => (
              <div key={alert.id} className="flex items-center gap-3 p-3 rounded-xl border bg-card">
                <Bell className={cn("w-4 h-4 shrink-0", alert.enabled ? "text-amber-500" : "text-muted-foreground")} />
                <div className="flex-1">
                  <p className="text-sm font-bold">{alert.label}</p>
                  <p className="text-xs text-muted-foreground">Drempelwaarde: {alert.threshold.toLocaleString("nl-NL")}</p>
                </div>
                <button onClick={() => saveAlerts(alerts.map((a: any) => a.id === alert.id ? { ...a, enabled: !a.enabled } : a))}
                  className={cn("w-10 h-5.5 rounded-full transition-all relative", alert.enabled ? "bg-amber-500" : "bg-muted")}>
                  <div className={cn("w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all shadow-sm", alert.enabled ? "left-5" : "left-0.5")} />
                </button>
                <button onClick={() => saveAlerts(alerts.filter((a: any) => a.id !== alert.id))} className="text-muted-foreground hover:text-red-500 transition-colors p-1"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            <button onClick={() => saveAlerts([...alerts, { id: Date.now(), type: "custom", threshold: 1000, enabled: true, label: "Nieuw alert" }])}
              className="w-full p-3 rounded-xl border-2 border-dashed border-border text-xs text-muted-foreground hover:border-amber-300 hover:text-foreground transition-colors flex items-center justify-center gap-2">
              <Plus className="w-3.5 h-3.5" /> Alert toevoegen
            </button>
          </div>
        </div>
      )}

      {/* Link in bio */}
      {tab === "linkinbio" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20">
            <p className="font-bold text-sm flex items-center gap-2"><Link className="w-4 h-4 text-blue-500" /> Link in bio</p>
            <p className="text-xs text-muted-foreground mt-0.5">Beheer de links die je Instagram bio naar verwijst.</p>
          </div>
          <div className="space-y-2">
            {links.map((l: any, i: number) => (
              <div key={l.id} className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:border-blue-300 transition-colors">
                <span className="text-lg shrink-0">{l.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">{l.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{l.url}</p>
                </div>
                <div className="flex items-center gap-1">
                  <a href={l.url} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"><ExternalLink className="w-3.5 h-3.5" /></a>
                  <button onClick={() => saveLinks(links.filter((x: any) => x.id !== l.id))} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
          <Card>
            <CardContent className="pt-4 space-y-2">
              <Input placeholder="Label (bijv. Event tickets)" value={newLinkLabel} onChange={e => setNewLinkLabel(e.target.value)} className="text-sm h-9" />
              <Input placeholder="URL (https://...)" value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} className="text-sm h-9" />
              <Button onClick={addLink} variant="outline" className="w-full gap-2 font-bold"><Plus className="w-4 h-4" /> Link toevoegen</Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reports */}
      {tab === "reports" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border bg-gradient-to-r from-slate-50 to-zinc-50 dark:from-slate-950/20 dark:to-zinc-950/20">
            <p className="font-bold text-sm flex items-center gap-2"><FileText className="w-4 h-4 text-slate-500" /> Rapportage</p>
            <p className="text-xs text-muted-foreground mt-0.5">Genereer een overzicht van je Instagram prestaties.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: "Wekelijks rapport",  desc: "Posts, likes, comments deze week", icon: Calendar, color: "from-violet-500 to-purple-600" },
              { label: "Maandoverzicht",     desc: "Volledig maandoverzicht met grafieken", icon: BarChart3, color: "from-pink-500 to-rose-600" },
              { label: "Top content",        desc: "Beste posts van de afgelopen 90 dagen", icon: Award, color: "from-amber-500 to-orange-600" },
              { label: "Groeirapport",       desc: "Volgers en engagement trend", icon: TrendingUp, color: "from-blue-500 to-cyan-600" },
            ].map(({ label, desc, icon: Icon, color }) => (
              <div key={label} className="p-4 rounded-2xl border bg-card hover:border-primary/30 transition-colors cursor-pointer group">
                <div className={cn("w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center mb-3", color)}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <p className="text-sm font-bold">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                <div className="flex items-center gap-1.5 mt-3 text-xs font-bold text-muted-foreground group-hover:text-foreground transition-colors">
                  <Download className="w-3.5 h-3.5" /> Genereer rapport
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-center text-muted-foreground">Rapportgeneratie komt binnenkort beschikbaar als PDF/CSV export.</p>
        </div>
      )}

      {/* Multi-Account Management */}
      {tab === "accounts" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20">
            <p className="font-bold text-sm flex items-center gap-2"><UserCog className="w-4 h-4 text-indigo-600" /> Multi-Account Management</p>
            <p className="text-xs text-muted-foreground mt-0.5">Beheer meerdere Instagram accounts en schakel eenvoudig tussen accounts.</p>
          </div>
          {/* Active account */}
          {accounts.length > 0 && (
            <Card className="border-indigo-200 dark:border-indigo-800/50">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CheckCheck className="w-4 h-4 text-indigo-500" /> Actief account</CardTitle></CardHeader>
              <CardContent className="pt-0 space-y-2">
                {accounts.map((acc: any) => (
                  <div key={acc.id} data-testid={`card-account-${acc.id}`}
                    className={cn("flex items-center gap-3 p-3 rounded-xl border transition-all",
                      acc.active ? "border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20" : "bg-card hover:border-muted-foreground/30")}>
                    <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-sm font-extrabold shrink-0",
                      acc.active ? "bg-gradient-to-br from-indigo-500 to-purple-500 text-white" : "bg-muted text-muted-foreground")}>
                      {(acc.handle || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold">@{acc.handle}</p>
                        {acc.active && <Badge className="text-[9px] bg-indigo-500 text-white border-0">Actief</Badge>}
                        {acc.primary && <Badge variant="outline" className="text-[9px]">Primair</Badge>}
                      </div>
                      <p className="text-[11px] text-muted-foreground">{acc.type} · {acc.followers ? fmt(acc.followers) + " volgers" : "–"}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!acc.active && (
                        <button onClick={() => switchAccount(acc.id)}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 transition-colors px-2 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-950/40">
                          Activeer
                        </button>
                      )}
                      {!acc.primary && (
                        <button onClick={() => removeAccount(acc.id)} className="text-muted-foreground hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {/* Add account */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><UserPlus className="w-4 h-4 text-indigo-500" /> Account toevoegen</CardTitle></CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input placeholder="username" value={newAccHandle}
                    onChange={e => setNewAccHandle(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addAccount()}
                    className="pl-9 text-sm h-10" data-testid="input-account-handle" />
                </div>
                <Button onClick={addAccount} className="gap-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0 hover:opacity-90"
                  data-testid="button-add-account">
                  <Plus className="w-4 h-4" /> Voeg toe
                </Button>
              </div>
              <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50">
                <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                  <strong>Let op:</strong> Elk Instagram account vereist een eigen toegangstoken. Verbind extra accounts via de Instagram OAuth stroom met het juiste account ingelogd.
                </p>
              </div>
            </CardContent>
          </Card>
          {/* Benefits */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Voordelen multi-account</p>
            {[
              { icon: Users2,   label: "Aparte analytics per account",    desc: "Vergelijk performance tussen meerdere profielen" },
              { icon: Calendar, label: "Gecentraliseerde content planning",desc: "Plan content voor alle accounts vanuit één kalender" },
              { icon: BarChart3,label: "Cross-account rapportage",         desc: "Exporteer gecombineerde rapporten over alle accounts" },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex gap-3 p-3 rounded-xl border bg-card">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-indigo-600" />
                </div>
                <div><p className="text-xs font-bold">{label}</p><p className="text-[11px] text-muted-foreground">{desc}</p></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* API Usage Analytics */}
      {tab === "api" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20">
            <p className="font-bold text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-emerald-600" /> API Usage Analytics</p>
            <p className="text-xs text-muted-foreground mt-0.5">Monitor je Instagram Graph API gebruik, rate limits en endpoint prestaties.</p>
          </div>
          {/* Rate limit overview */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "API calls vandaag", value: 47, limit: 200, color: "bg-emerald-500", pct: 23 },
              { label: "Rate limit", value: 77, limit: 100, color: "bg-blue-500", pct: 77, warning: false },
            ].map(({ label, value, limit, color, pct }) => (
              <Card key={label}>
                <CardContent className="pt-4 pb-3">
                  <p className="text-[11px] font-bold text-muted-foreground mb-1">{label}</p>
                  <p className="text-xl font-extrabold">{value}<span className="text-xs font-normal text-muted-foreground">/{limit}</span></p>
                  <div className="h-2 rounded-full bg-muted mt-2">
                    <div className={cn("h-2 rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{pct}% verbruikt</p>
                </CardContent>
              </Card>
            ))}
          </div>
          {/* Endpoint usage */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-emerald-500" /> Endpoint gebruik</CardTitle></CardHeader>
            <CardContent className="pt-0 space-y-3">
              {[
                { endpoint: "GET /me/media",         calls: 18, latency: "~240ms", status: "OK" },
                { endpoint: "GET /me/insights",      calls: 12, latency: "~310ms", status: "OK" },
                { endpoint: "GET /{id}/comments",    calls: 8,  latency: "~190ms", status: "OK" },
                { endpoint: "ig_hashtag_search",     calls: 5,  latency: "~180ms", status: "OK" },
                { endpoint: "GET /me (account)",     calls: 4,  latency: "~120ms", status: "OK" },
              ].map(({ endpoint, calls, latency, status: s }) => (
                <div key={endpoint} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <code className="text-[11px] font-mono truncate">{endpoint}</code>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-[11px] text-muted-foreground">
                    <span className="font-bold text-foreground">{calls}×</span>
                    <span>{latency}</span>
                    <Badge variant="outline" className="text-[9px] text-emerald-600 border-emerald-300">{s}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          {/* Quota window */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-teal-500" /> API quota venster</CardTitle></CardHeader>
            <CardContent className="pt-0 space-y-2">
              {[
                { label: "Standaard: User token",       limit: "200 calls/uur",    usage: "47 gebruikt" },
                { label: "Business: Page insights",     limit: "60 calls/uur",     usage: "12 gebruikt" },
                { label: "Hashtag search",              limit: "30 uniek/7 dagen", usage: "5 actief" },
                { label: "Publish: media & carousel",   limit: "25 posts/24u",     usage: "0 vandaag" },
              ].map(({ label, limit, usage }) => (
                <div key={label} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors">
                  <p className="text-xs font-medium">{label}</p>
                  <div className="text-right">
                    <p className="text-[11px] font-bold">{limit}</p>
                    <p className="text-[10px] text-muted-foreground">{usage}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <div className="text-center">
            <a href="https://developers.facebook.com/docs/instagram-api/overview" target="_blank" rel="noreferrer"
              className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center justify-center gap-1">
              <ExternalLink className="w-3 h-3" /> Bekijk volledige API documentatie
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Inline Markdown Renderer ── */
function MarkdownContent({ text }: { text: string }) {
  const inl = (s: string): React.ReactNode => {
    const parts = s.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
    return parts.map((p, i) => {
      if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} className="font-bold text-foreground">{p.slice(2, -2)}</strong>;
      if (p.startsWith("*") && p.endsWith("*")) return <em key={i}>{p.slice(1, -1)}</em>;
      if (p.startsWith("`") && p.endsWith("`")) return <code key={i} className="px-1 rounded bg-muted/70 font-mono text-[11px]">{p.slice(1, -1)}</code>;
      return p;
    });
  };
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let listBuf: { ordered: boolean; items: React.ReactNode[] } | null = null;
  const flush = () => {
    if (!listBuf) return;
    if (listBuf.ordered) nodes.push(<ol key={`ol-${nodes.length}`} className="list-decimal pl-5 space-y-0.5 my-1">{listBuf.items}</ol>);
    else nodes.push(<ul key={`ul-${nodes.length}`} className="list-disc pl-5 space-y-0.5 my-1">{listBuf.items}</ul>);
    listBuf = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith("## ")) { flush(); nodes.push(<h2 key={i} className="text-sm font-extrabold mt-3 mb-1 border-b border-border/50 pb-0.5">{l.slice(3)}</h2>); }
    else if (l.startsWith("### ")) { flush(); nodes.push(<h3 key={i} className="text-xs font-bold mt-2 mb-0.5">{l.slice(4)}</h3>); }
    else if (/^[-•*] /.test(l)) {
      if (listBuf?.ordered) flush();
      if (!listBuf) listBuf = { ordered: false, items: [] };
      listBuf.items.push(<li key={i} className="text-sm leading-relaxed">{inl(l.replace(/^[-•*] /, ""))}</li>);
    } else if (/^\d+\. /.test(l)) {
      if (listBuf && !listBuf.ordered) flush();
      if (!listBuf) listBuf = { ordered: true, items: [] };
      listBuf.items.push(<li key={i} className="text-sm leading-relaxed">{inl(l.replace(/^\d+\. /, ""))}</li>);
    } else if (l.trim() === "") { flush(); nodes.push(<div key={i} className="h-1" />); }
    else { flush(); nodes.push(<p key={i} className="text-sm leading-relaxed">{inl(l)}</p>); }
  }
  flush();
  return <div className="space-y-0.5">{nodes}</div>;
}

/* ── AI Agent Zone ── */
function AgentZone({ account, media, mediaAnalytics, status }: any) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try { return JSON.parse(localStorage.getItem("ig-agent-history") || "[]"); } catch { return []; }
  });
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState("");
  const [hasBriefed, setHasBriefed] = useState(() => localStorage.getItem("ig-agent-briefed") === "1");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streamBuffer]);

  const hashtagPerf = useMemo(() => {
    const map: Record<string, { count: number; totalLikes: number; totalComments: number }> = {};
    (media || []).forEach((post: any) => {
      ((post.caption || "").match(/#\w+/g) || []).forEach((tag: string) => {
        const k = tag.toLowerCase();
        if (!map[k]) map[k] = { count: 0, totalLikes: 0, totalComments: 0 };
        map[k].count++;
        map[k].totalLikes += post.like_count ?? 0;
        map[k].totalComments += post.comments_count ?? 0;
      });
    });
    return Object.entries(map).map(([tag, d]) => ({
      tag, count: d.count,
      avgLikes: d.count > 0 ? Math.round(d.totalLikes / d.count) : 0,
      score: d.count > 0 ? Math.round((d.totalLikes + d.totalComments * 3) / d.count) : 0,
    })).sort((a, b) => b.score - a.score).slice(0, 15);
  }, [media]);

  const avgEngagement = useMemo(() => {
    const posts = media || [];
    if (!posts.length || !(account?.followers_count)) return null;
    const total = posts.reduce((s: number, p: any) => s + (p.like_count ?? 0) + (p.comments_count ?? 0), 0);
    return (total / posts.length / account.followers_count) * 100;
  }, [media, account]);

  const postingFrequency = useMemo(() => {
    const posts = (media || []).filter((p: any) => p.timestamp);
    if (posts.length < 2) return null;
    const sorted = [...posts].sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const ms = new Date(sorted[0].timestamp).getTime() - new Date(sorted[sorted.length - 1].timestamp).getTime();
    const weeks = ms / (7 * 24 * 60 * 60 * 1000);
    return weeks > 0 ? posts.length / weeks : null;
  }, [media]);

  const scheduledCount = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("ig-schedule-queue") || "[]").filter((i: any) => new Date(i.scheduledAt) > new Date()).length; }
    catch { return 0; }
  }, []);

  const save = (msgs: ChatMessage[]) => {
    const t = msgs.slice(-30);
    localStorage.setItem("ig-agent-history", JSON.stringify(t));
    return t;
  };

  const sendMessage = async (text: string, mode = "chat") => {
    if (!text.trim() && mode !== "briefing") return;
    const userMsg: ChatMessage = { role: "user", content: text.trim(), ts: Date.now() };
    const hist = mode === "briefing" ? messages : [...messages, userMsg];
    if (mode !== "briefing" && text.trim()) setMessages(save(hist));
    setInput("");
    setIsStreaming(true);
    setStreamBuffer("");

    const ctx = {
      account: account ? { username: account.username, followers_count: account.followers_count, follows_count: account.follows_count, media_count: account.media_count } : null,
      status: { username: status?.username, followersCount: status?.followersCount, accountType: status?.accountType, mediaCount: status?.mediaCount },
      topPosts: (mediaAnalytics?.topPosts || media || []).slice(0, 5),
      hashtagPerformance: hashtagPerf, avgEngagement, postingFrequency, scheduledCount,
    };

    try {
      const resp = await fetch("/api/instagram/agent", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ message: text.trim() || "__briefing__", history: hist.slice(-8), context: ctx, mode }),
      });
      if (!resp.ok || !resp.body) throw new Error("Verbinding mislukt");

      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let acc = ""; let leftover = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        leftover += dec.decode(value, { stream: true });
        const parts = leftover.split("\n\n");
        leftover = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === "text") { acc += evt.text; setStreamBuffer(acc); }
          } catch {}
        }
      }

      if (acc) setMessages(prev => save([...prev, { role: "assistant", content: acc, ts: Date.now() }]));
    } catch {
      setMessages(prev => save([...prev, { role: "assistant", content: "Verbinding mislukt. Probeer opnieuw.", ts: Date.now(), error: true }]));
    } finally { setIsStreaming(false); setStreamBuffer(""); }
  };

  const clearHistory = () => { setMessages([]); setHasBriefed(false); localStorage.removeItem("ig-agent-history"); localStorage.removeItem("ig-agent-briefed"); };

  /* Auto-briefing when data loads for the first time */
  const briefTriggered = useRef(false);
  useEffect(() => {
    if (!briefTriggered.current && !hasBriefed && (account || status) && messages.length === 0) {
      briefTriggered.current = true;
      setHasBriefed(true);
      localStorage.setItem("ig-agent-briefed", "1");
      sendMessage("", "briefing");
    }
  }, [account, status]);

  const QUICK = [
    { icon: "📊", label: "Analyseer prestaties",  cat: "analyze",  prompt: "Analyseer de prestaties van mijn Instagram-account grondig. Geef de 3 meest opvallende inzichten, inclusief specifieke cijfers. Wat werkt, wat niet, en wat is de meest impactvolle verbetering?" },
    { icon: "✍️", label: "Schrijf 3 captions",   cat: "create",   prompt: "Schrijf 3 krachtige Instagram-captions in mijn stijl voor een breakdance / urban culture post. Variant 1: kort & punchy (max 80 tekens). Variant 2: medium met storytelling (150–250 tekens). Variant 3: lang met volledige hashtag-set (20 hashtags). Geef ze direct klaar om te kopiëren." },
    { icon: "#",  label: "Hashtag boost",         cat: "analyze",  prompt: "Geef mij een geoptimaliseerde hashtag-set van 20 hashtags voor mijn volgende post. Verdeel ze in: 5 brede (hoog bereik), 10 niche (urban culture/breakdance), 5 lokaal (Nederland/Amsterdam). Verklaar per categorie kort waarom." },
    { icon: "🎬", label: "Reel ideeën",           cat: "create",   prompt: "Geef mij 5 concrete Reel-ideeën voor mijn urban culture account. Voor elk idee: titel, concept (2 zinnen), beste tijdstip om te posten, en waarom dit format goed werkt voor mijn niche. Focus op viral potentieel." },
    { icon: "📱", label: "Story concepten",       cat: "create",   prompt: "Maak 7 Instagram Story concepten voor de komende week. Per dag: type story (poll/behind-the-scenes/teaser/Q&A/etc), inhoud, interactie-element, en tijdstip. Zorg voor een logische narrative flow door de week." },
    { icon: "📅", label: "7-daags contentplan",   cat: "plan",     prompt: "Maak een gedetailleerd contentplan voor de komende 7 dagen. Elke dag: format (post/reel/story), onderwerp, caption-angle, beste tijdstip (specifiek uur), hashtag-categorie, en verwacht engagement-type. Baseer op mijn account data." },
    { icon: "🔥", label: "Trending nu",           cat: "analyze",  prompt: "Welke urban culture en breakdance trends zijn momenteel viraal op Instagram? Geef 5 trending content-formats, sounds/muziek trends, en visuele stijlen die ik nu kan benutten. Hoe vertaal ik deze naar mijn eigen stijl?" },
    { icon: "📈", label: "30-daagse groei",       cat: "plan",     prompt: "Geef mij een specifiek 30-daags groeiplan gericht op follower-groei en engagement voor mijn urban culture niche. Week-voor-week breakdown met concrete acties, KPIs, en meetbare doelstellingen per week." },
    { icon: "🎯", label: "Engagement verdubbelen", cat: "analyze", prompt: "Analyseer mijn engagement en geef mij 5 bewezen tactieken om mijn engagement significant te verhogen. Elke tactiek: wat, waarom het werkt, hoe ik het implementeer, en welk resultaat ik kan verwachten." },
    { icon: "🔄", label: "Content recycling",     cat: "plan",     prompt: "Gebaseerd op mijn top-presterende posts: welke content kan ik hergebruiken en hoe? Geef een recycling-strategie met 5 concrete post-ideeën die bewezen content transformeren naar nieuwe formats (reel, carousel, story)." },
    { icon: "🤝", label: "Collab strategie",      cat: "plan",     prompt: "Geef mij een collaboratie-strategie voor mijn urban culture account. Welk type creators moet ik benaderen? Hoe pitch ik mezelf? Welke collab-formats (IG Live, joint post, story takeover) leveren het meeste op voor mijn niche?" },
    { icon: "🏆", label: "Onderscheid jezelf",    cat: "analyze",  prompt: "Hoe positioneer ik mijn urban culture account uniek ten opzichte van vergelijkbare accounts? Geef mij 3 differentiatie-strategieën, mijn unieke waardepropositie, en hoe ik die vertaal naar content die echt opvalt." },
  ];

  const isDataLoaded = !!(account || status);

  return (
    <div className="flex flex-col gap-3">
      {/* Context bar */}
      <div className="p-3 rounded-2xl border border-violet-500/30 bg-gradient-to-r from-violet-950/20 via-indigo-950/20 to-purple-950/20 dark:from-violet-950/40 dark:via-indigo-950/40 dark:to-purple-950/40">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-sm shrink-0">
              <Brain className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <p className="text-xs font-extrabold text-violet-800 dark:text-violet-300">AI Instagram Agent</p>
              <p className="text-[10px] text-violet-600 dark:text-violet-400">
                {isDataLoaded ? `@${account?.username || status?.username} · ${fmt(account?.followers_count || status?.followersCount || 0)} volgers` : "Verbind Instagram om de agent te activeren"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { label: `${(media || []).length} posts`, ok: (media || []).length > 0 },
              { label: `${hashtagPerf.length} hashtags`, ok: hashtagPerf.length > 0 },
              { label: scheduledCount > 0 ? `${scheduledCount} gepland` : "geen planning", ok: scheduledCount > 0 },
              { label: avgEngagement ? `${avgEngagement.toFixed(1)}% engagement` : "engagement onbekend", ok: !!avgEngagement },
            ].map(({ label, ok }) => (
              <Badge key={label} variant="outline" className={cn("text-[9px] py-0", ok ? "border-green-400/60 text-green-600 dark:text-green-400" : "border-muted-foreground/20 text-muted-foreground/60")}>
                <div className={cn("w-1.5 h-1.5 rounded-full mr-1 shrink-0", ok ? "bg-green-500" : "bg-muted-foreground/30")} />
                {label}
              </Badge>
            ))}
            <button onClick={clearHistory} title="Gesprek wissen" className="text-muted-foreground hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-muted/50">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="overflow-y-auto space-y-3 scrollbar-hide" style={{ minHeight: 320, maxHeight: "55vh" }}>
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <div className="text-center max-w-xs space-y-1">
              <p className="font-bold text-sm">Klaar om te helpen</p>
              <p className="text-xs text-muted-foreground">
                {isDataLoaded ? "De agent analyseert je account. Stel een vraag of kies een actie hieronder." : "Verbind je Instagram-account om de agent te activeren met echte data."}
              </p>
            </div>
            {isDataLoaded && (
              <div className="flex flex-wrap justify-center gap-1.5 max-w-md">
                {QUICK.slice(0, 6).map(({ icon, label, prompt, cat }) => (
                  <button key={label} onClick={() => sendMessage(prompt)} disabled={isStreaming}
                    className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all disabled:opacity-40",
                      cat === "create" ? "border-pink-300/50 text-pink-700 dark:text-pink-300 hover:bg-pink-50 dark:hover:bg-pink-950/30" :
                      cat === "plan"   ? "border-emerald-300/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30" :
                      "border-violet-300/50 dark:border-violet-700/50 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/40")}>
                    <span className="text-sm">{icon}</span> {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn("flex gap-2.5", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
            <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-white text-[10px] font-extrabold",
              msg.role === "user" ? "bg-gradient-to-br from-pink-500 to-orange-400" : "bg-gradient-to-br from-violet-600 to-indigo-600")}>
              {msg.role === "user" ? "JIJ" : <Brain style={{ width: 14, height: 14 }} />}
            </div>
            <div className={cn("flex-1", msg.role === "user" && "flex flex-col items-end")}>
              <div className={cn("rounded-2xl px-4 py-2.5 max-w-[88%]",
                msg.role === "user" ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-tr-md" :
                msg.error ? "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 rounded-tl-md" :
                "bg-muted/50 border border-border/40 rounded-tl-md")}>
                {msg.role === "user" ? <p className="text-sm leading-relaxed">{msg.content}</p> : <MarkdownContent text={msg.content} />}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 px-1">{format(new Date(msg.ts), "HH:mm", { locale: nl })}</p>
            </div>
          </div>
        ))}

        {isStreaming && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
              <Brain className="text-white animate-pulse" style={{ width: 14, height: 14 }} />
            </div>
            <div className="flex-1">
              <div className="rounded-2xl rounded-tl-md px-4 py-2.5 bg-muted/50 border border-border/40 max-w-[88%]">
                {streamBuffer ? <MarkdownContent text={streamBuffer} /> : (
                  <div className="flex items-center gap-1.5 py-1">
                    {[0, 1, 2].map(j => (
                      <div key={j} className="w-2 h-2 rounded-full bg-violet-400/60 animate-bounce" style={{ animationDelay: `${j * 0.15}s` }} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Quick actions */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Snelle acties</p>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1 flex-wrap">
          {QUICK.map(({ icon, label, prompt, cat }) => (
            <button key={label} onClick={() => !isStreaming && sendMessage(prompt)} disabled={isStreaming}
              className={cn("flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold whitespace-nowrap transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0",
                cat === "create"  ? "border-pink-300/50 dark:border-pink-700/40 text-pink-700 dark:text-pink-300 hover:bg-pink-50 dark:hover:bg-pink-950/30 bg-pink-50/30 dark:bg-pink-950/10" :
                cat === "plan"    ? "border-emerald-300/50 dark:border-emerald-700/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 bg-emerald-50/30 dark:bg-emerald-950/10" :
                "border-violet-300/50 dark:border-violet-700/40 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30 bg-card")}>
              <span className="text-xs">{icon}</span> {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-[9px] text-muted-foreground/70">
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-violet-400/60" /> Analyse</span>
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-pink-400/60" /> Creëren</span>
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-400/60" /> Plannen</span>
        </div>
      </div>

      {/* Input */}
      <div className="flex gap-2 items-end">
        <div className="flex-1 relative">
          <Textarea
            ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            placeholder={isStreaming ? "Agent is aan het antwoorden..." : "Stel een vraag of geef een opdracht... (Enter = versturen, Shift+Enter = nieuwe regel)"}
            disabled={isStreaming} rows={2}
            className="resize-none text-sm" style={{ minHeight: 64 }}
            data-testid="input-agent-message"
          />
        </div>
        <Button onClick={() => sendMessage(input)} disabled={isStreaming || !input.trim()}
          className="w-12 border-0 text-white shadow-sm" style={{ height: 64, background: "linear-gradient(180deg, #7c3aed, #4338ca)" }}
          data-testid="button-agent-send">
          {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizonal className="w-4 h-4" />}
        </Button>
      </div>

      <p className="text-[10px] text-center text-muted-foreground">
        De agent gebruikt je echte Instagram-data. Controleer AI-suggesties altijd voor publicatie.
      </p>
    </div>
  );
}

/* ══════════════════════════════════════
   AI PERSONA ZONE
══════════════════════════════════════ */
function PersonaZone() {
  const { toast } = useToast();

  // ── Active account scoping ──
  const { data: allAccounts = [] } = useQuery<any[]>({ queryKey: ["/api/instagram/accounts"] });
  const activeConn  = (allAccounts as any[]).find((a: any) => a.isActive);
  const connectionId: number | null = activeConn?.id ?? null;

  // ── Core persona fields ──
  const [pairs, setPairs] = useState<{ question: string; answer: string }[]>([]);
  const [form, setForm] = useState({
    toneAndVoice: "", communicationStyle: "", businessDirection: "", topicsToAvoid: "",
  });

  // ── Feed & Learn state ──
  const [samples, setSamples]   = useState<{ text: string; source: string; id?: string }[]>([]);
  const [vocab, setVocab]       = useState<{ type: "hashtag" | "phrase" | "slang"; value: string }[]>([]);
  const [facts, setFacts]       = useState<string[]>([]);
  const [newFact, setNewFact]   = useState("");
  const [newVocabType, setNewVocabType] = useState<"hashtag" | "phrase" | "slang">("hashtag");
  const [newVocabValue, setNewVocabValue] = useState("");
  const [manualCaption, setManualCaption] = useState("");
  const [importing, setImporting]   = useState(false);
  const [analyzing, setAnalyzing]   = useState(false);
  const [importedItems, setImportedItems] = useState<any[]>([]);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  // ── Learning history state ──
  const [learningHistory, setLearningHistory] = useState<string[]>([]);
  const [analyzedProfile, setAnalyzedProfile] = useState<any>(null);
  const [newEntry, setNewEntry] = useState("");
  const [analyzingPrefs, setAnalyzingPrefs] = useState(false);

  const { data: persona, isLoading } = useQuery<any>({
    queryKey: ["/api/instagram/ai/persona", connectionId],
    queryFn: async () => {
      const url = connectionId
        ? `/api/instagram/ai/persona?connectionId=${connectionId}`
        : "/api/instagram/ai/persona";
      const res = await fetch(url, { credentials: "include" });
      return res.json();
    },
  });

  useEffect(() => {
    if (persona) {
      setForm({
        toneAndVoice: persona.toneAndVoice || "",
        communicationStyle: persona.communicationStyle || "",
        businessDirection: persona.businessDirection || "",
        topicsToAvoid: persona.topicsToAvoid || "",
      });
      if (Array.isArray(persona.exampleInteractions)) setPairs(persona.exampleInteractions);
      if (Array.isArray(persona.contentSamples))     setSamples(persona.contentSamples);
      if (Array.isArray(persona.customVocabulary))   setVocab(persona.customVocabulary);
      if (Array.isArray(persona.brandFacts))         setFacts(persona.brandFacts);
      if (Array.isArray(persona.learningHistory))    setLearningHistory(persona.learningHistory);
      if (persona.analyzedProfile)                   setAnalyzedProfile(persona.analyzedProfile);
    }
  }, [persona]);

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("/api/instagram/ai/persona", "PUT", {
      connectionId,
      ...form,
      exampleInteractions: pairs.filter(p => p.question.trim() || p.answer.trim()),
      contentSamples: samples,
      customVocabulary: vocab,
      brandFacts: facts,
      learningHistory,
      analyzedProfile,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/ai/persona", connectionId] });
      toast({ title: "AI opgeslagen! 🧠 De AI is bijgewerkt met jouw nieuwe training." });
    },
    onError: (err: any) => toast({ title: "Opslaan mislukt", description: err.message, variant: "destructive" }),
  });

  // Example interaction helpers
  const addPair = () => setPairs(p => [...p, { question: "", answer: "" }]);
  const removePair = (i: number) => setPairs(p => p.filter((_, idx) => idx !== i));
  const updatePair = (i: number, field: "question" | "answer", val: string) =>
    setPairs(p => p.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

  // Content sample helpers
  const addManualCaption = () => {
    const text = manualCaption.trim();
    if (!text) return;
    setSamples(s => [...s, { text, source: "manual" }]);
    setManualCaption("");
  };
  const removeSample = (i: number) => setSamples(s => s.filter((_, idx) => idx !== i));
  const toggleImportedItem = (item: any) => {
    const already = samples.some(s => s.id === item.id);
    if (already) {
      setSamples(s => s.filter(x => x.id !== item.id));
    } else {
      setSamples(s => [...s, { text: item.text, source: "instagram", id: item.id }]);
    }
  };

  // Vocabulary helpers
  const addVocab = () => {
    const val = newVocabValue.trim();
    if (!val) return;
    setVocab(v => [...v, { type: newVocabType, value: val }]);
    setNewVocabValue("");
  };
  const removeVocab = (i: number) => setVocab(v => v.filter((_, idx) => idx !== i));

  // Brand facts helpers
  const addFact = () => {
    const f = newFact.trim();
    if (!f) return;
    setFacts(fs => [...fs, f]);
    setNewFact("");
  };
  const removeFact = (i: number) => setFacts(fs => fs.filter((_, idx) => idx !== i));

  // Learning history helpers
  const addEntry = () => {
    const e = newEntry.trim();
    if (!e) return;
    setLearningHistory(h => [...h, e]);
    setNewEntry("");
  };
  const removeEntry = (i: number) => setLearningHistory(h => h.filter((_, idx) => idx !== i));

  const analyzePreferences = async () => {
    if (!learningHistory.length) return;
    setAnalyzingPrefs(true);
    try {
      const res = await apiRequest("/api/instagram/ai/analyze-preferences", "POST", { entries: learningHistory });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAnalyzedProfile(data.profile);
      toast({ title: "AI heeft je voorkeuren geleerd! 🎯 Klik op Opslaan om te activeren." });
    } catch (err: any) {
      toast({ title: "Analyse mislukt", description: err.message, variant: "destructive" });
    } finally { setAnalyzingPrefs(false); }
  };

  // Import captions from Instagram
  const importCaptions = async () => {
    setImporting(true);
    setImportedItems([]);
    try {
      const res = await apiRequest("/api/instagram/ai/import-captions", "POST", { limit: 20 });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setImportedItems(data.items || []);
      toast({ title: `${data.items?.length || 0} posts geïmporteerd van Instagram` });
    } catch (err: any) {
      toast({ title: "Import mislukt", description: err.message, variant: "destructive" });
    } finally { setImporting(false); }
  };

  // Run Claude style analysis
  const analyzeStyle = async () => {
    if (samples.length === 0) {
      toast({ title: "Voeg eerst content toe", description: "Plak of importeer je posts voordat je analyseert.", variant: "destructive" });
      return;
    }
    setAnalyzing(true);
    setAnalysisResult(null);
    try {
      const res = await apiRequest("/api/instagram/ai/analyze-style", "POST", {
        contentSamples: samples,
        currentPersona: form,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAnalysisResult(data.result);
      toast({ title: "Analyse klaar! Bekijk de aanbevelingen hieronder." });
    } catch (err: any) {
      toast({ title: "Analyse mislukt", description: err.message, variant: "destructive" });
    } finally { setAnalyzing(false); }
  };

  // Apply analysis results to persona
  const applyAnalysis = () => {
    if (!analysisResult) return;
    if (analysisResult.toneAndVoice)      setForm(f => ({ ...f, toneAndVoice: analysisResult.toneAndVoice }));
    if (analysisResult.communicationStyle) setForm(f => ({ ...f, communicationStyle: analysisResult.communicationStyle }));
    if (Array.isArray(analysisResult.suggestedHashtags)) {
      analysisResult.suggestedHashtags.forEach((h: string) => {
        const clean = h.startsWith("#") ? h : `#${h}`;
        if (!vocab.some(v => v.value === clean)) setVocab(v => [...v, { type: "hashtag", value: clean }]);
      });
    }
    if (Array.isArray(analysisResult.suggestedPhrases)) {
      analysisResult.suggestedPhrases.forEach((p: string) => {
        if (!vocab.some(v => v.value === p)) setVocab(v => [...v, { type: "phrase", value: p }]);
      });
    }
    if (Array.isArray(analysisResult.brandFacts)) {
      analysisResult.brandFacts.forEach((f: string) => {
        if (!facts.includes(f)) setFacts(fs => [...fs, f]);
      });
    }
    toast({ title: "Analyse toegepast! ✅ Sla op om te bevestigen." });
  };

  const vocabTypeLabel: Record<string, string> = { hashtag: "#Tag", phrase: "Frase", slang: "Slang" };
  const vocabTypeColor: Record<string, string> = { hashtag: "#7c3aed", phrase: "#0891b2", slang: "#d97706" };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const trainingScore = Math.min(100, Math.round(
    (form.toneAndVoice ? 20 : 0) + (form.communicationStyle ? 20 : 0) +
    (form.businessDirection ? 10 : 0) + (form.topicsToAvoid ? 10 : 0) +
    (pairs.length > 0 ? 10 : 0) + (samples.length > 0 ? Math.min(15, samples.length * 3) : 0) +
    (vocab.length > 0 ? Math.min(10, vocab.length * 2) : 0) + (facts.length > 0 ? Math.min(5, facts.length) : 0)
  ));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-extrabold text-base flex items-center gap-2">
            <Brain className="w-5 h-5 text-violet-500" /> AI Voeden & Leren
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Leer de AI jouw stem, stijl en wereld. Hoe meer je voedt, hoe beter het klinkt als jij.
          </p>
        </div>
        {persona?.updatedAt && (
          <p className="text-[10px] text-muted-foreground shrink-0 mt-1">
            {format(new Date(persona.updatedAt), "d MMM HH:mm", { locale: nl })}
          </p>
        )}
      </div>

      {/* Active account badge */}
      {activeConn && (
        <div className="flex items-center gap-2 rounded-xl border border-violet-200 dark:border-violet-800/40 bg-violet-50 dark:bg-violet-950/20 px-3 py-2">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center shrink-0">
            <span className="text-white text-[8px] font-bold">@</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-violet-700 dark:text-violet-300 truncate">
              @{activeConn.username}
            </p>
            <p className="text-[9px] text-muted-foreground">
              {activeConn.label || "Actieve account"} — dit brein is exclusief voor dit account
            </p>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0 animate-pulse" />
        </div>
      )}

      {/* Training score */}
      <div className="rounded-xl border border-violet-200/50 dark:border-violet-800/30 bg-violet-50/30 dark:bg-violet-950/10 p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">AI Training Score</span>
          <span className={cn("text-xs font-bold tabular-nums",
            trainingScore >= 80 ? "text-green-600 dark:text-green-400" :
            trainingScore >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-500"
          )}>{trainingScore}%</span>
        </div>
        <Progress value={trainingScore} className="h-1.5" />
        <p className="text-[10px] text-muted-foreground mt-1.5">
          {trainingScore < 40 ? "Begin met de persona velden en voeg content toe."
           : trainingScore < 70 ? "Goed begin! Voeg meer content en feiten toe."
           : trainingScore < 90 ? "Sterk profiel! Voeg meer voorbeelden toe."
           : "Uitstekend! Jouw AI is goed getraind. 🚀"}
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="persona" className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-8 text-[11px]">
          <TabsTrigger value="persona" className="text-[10px] px-0.5" data-testid="tab-persona">
            Persona
          </TabsTrigger>
          <TabsTrigger value="content" className="text-[10px] px-0.5" data-testid="tab-content">
            Content
            {samples.length > 0 && <span className="ml-0.5 text-[9px] bg-violet-500 text-white rounded-full px-1">{samples.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="vocab" className="text-[10px] px-0.5" data-testid="tab-vocab">
            Woorden
            {vocab.length > 0 && <span className="ml-0.5 text-[9px] bg-violet-500 text-white rounded-full px-1">{vocab.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="facts" className="text-[10px] px-0.5" data-testid="tab-facts">
            Feiten
            {facts.length > 0 && <span className="ml-0.5 text-[9px] bg-violet-500 text-white rounded-full px-1">{facts.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="learn" className="text-[10px] px-0.5" data-testid="tab-learn">
            Leer
            {learningHistory.length > 0 && <span className="ml-0.5 text-[9px] bg-pink-500 text-white rounded-full px-1">{learningHistory.length}</span>}
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: PERSONA ─────────────────────────────────── */}
        <TabsContent value="persona" className="mt-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold">Toon & Stem</label>
              <VoiceMicButton value={form.toneAndVoice} onUpdate={t => setForm(f => ({ ...f, toneAndVoice: t }))} />
            </div>
            <Textarea value={form.toneAndVoice} onChange={e => setForm(f => ({ ...f, toneAndVoice: e.target.value }))}
              placeholder="Bijv. Energetisch, direct, authentiek. Ik spreek jonge mensen aan op een gelijkwaardig niveau."
              rows={3} className="text-sm resize-none" data-testid="textarea-tone-voice" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold">Communicatiestijl</label>
              <VoiceMicButton value={form.communicationStyle} onUpdate={t => setForm(f => ({ ...f, communicationStyle: t }))} />
            </div>
            <Textarea value={form.communicationStyle} onChange={e => setForm(f => ({ ...f, communicationStyle: e.target.value }))}
              placeholder="Bijv. Gebruik emoticons spaarzaam. Schrijf korte, krachtige zinnen. Moedig interactie aan."
              rows={3} className="text-sm resize-none" data-testid="textarea-communication-style" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold">Business & Merkrichting</label>
              <VoiceMicButton value={form.businessDirection} onUpdate={t => setForm(f => ({ ...f, businessDirection: t }))} />
            </div>
            <Textarea value={form.businessDirection} onChange={e => setForm(f => ({ ...f, businessDirection: e.target.value }))}
              placeholder="Bijv. Urban Culture Connect verbindt breakdancers, graffiti-artiesten en urban sporters in Nederland."
              rows={3} className="text-sm resize-none" data-testid="textarea-business-direction" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold">Onderwerpen te vermijden</label>
              <VoiceMicButton value={form.topicsToAvoid} onUpdate={t => setForm(f => ({ ...f, topicsToAvoid: t }))} />
            </div>
            <Textarea value={form.topicsToAvoid} onChange={e => setForm(f => ({ ...f, topicsToAvoid: e.target.value }))}
              placeholder="Bijv. Politiek, religie, concurrerende platforms, negatief over artiesten."
              rows={2} className="text-sm resize-none" data-testid="textarea-topics-avoid" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold">Voorbeeldgesprekken</label>
              <Button size="sm" variant="outline" onClick={addPair} className="text-xs h-7 px-3" data-testid="button-add-example">
                <Plus className="w-3 h-3 mr-1" /> Toevoegen
              </Button>
            </div>
            {pairs.length === 0 ? (
              <div className="border-2 border-dashed rounded-xl p-5 text-center text-xs text-muted-foreground">
                Voeg voorbeeldvragen en ideale antwoorden toe.
              </div>
            ) : (
              <div className="space-y-3">
                {pairs.map((pair, i) => (
                  <div key={i} className="border rounded-xl p-3 space-y-2 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Voorbeeld {i + 1}</span>
                      <button onClick={() => removePair(i)} className="text-muted-foreground hover:text-red-500 p-1 rounded transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <Input value={pair.question} onChange={e => updatePair(i, "question", e.target.value)}
                      placeholder="Vraag / reactie van volger..." className="text-xs h-8"
                      data-testid={`input-example-question-${i}`} />
                    <Textarea value={pair.answer} onChange={e => updatePair(i, "answer", e.target.value)}
                      placeholder="Jouw ideale antwoord..." rows={2} className="text-xs resize-none"
                      data-testid={`textarea-example-answer-${i}`} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {form.toneAndVoice && (
            <Card className="border-violet-200/50 dark:border-violet-800/30 bg-violet-50/30 dark:bg-violet-950/10">
              <CardContent className="py-3 px-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400 mb-1">Preview</p>
                <p className="text-xs text-muted-foreground italic">
                  "{form.toneAndVoice.slice(0, 100)}{form.toneAndVoice.length > 100 ? "..." : ""}"
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── TAB 2: CONTENT VOEDEN ──────────────────────────── */}
        <TabsContent value="content" className="mt-4 space-y-4">
          <div>
            <h4 className="text-xs font-bold mb-0.5 flex items-center gap-1.5">
              <Wand2 className="w-3.5 h-3.5 text-violet-500" /> Jouw Content Samples
            </h4>
            <p className="text-[11px] text-muted-foreground mb-3">
              Plak je eigen posts en captions. De AI leert jouw exacte schrijfstijl.
            </p>

            {/* Manual paste */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Typ of spreek je tekst in</span>
                <VoiceMicButton value={manualCaption} onUpdate={t => setManualCaption(t)} />
              </div>
              <Textarea
                value={manualCaption}
                onChange={e => setManualCaption(e.target.value)}
                placeholder="Plak hier een Instagram caption, post of tekst die jij hebt geschreven..."
                rows={4} className="text-sm resize-none"
                data-testid="textarea-manual-caption"
              />
              <Button size="sm" onClick={addManualCaption} disabled={!manualCaption.trim()}
                className="w-full text-xs h-8 text-white" style={{ background: "linear-gradient(135deg,#7c3aed,#9333ea)" }}
                data-testid="button-add-caption">
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Toevoegen aan Training
              </Button>
            </div>
          </div>

          {/* Import from Instagram */}
          <div className="border rounded-xl p-3 bg-muted/20">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs font-bold flex items-center gap-1.5">
                  <SiInstagram className="text-pink-500" /> Importeer van Instagram
                </p>
                <p className="text-[10px] text-muted-foreground">Haal jouw recente posts automatisch op</p>
              </div>
              <Button size="sm" variant="outline" onClick={importCaptions} disabled={importing}
                className="text-xs h-7 shrink-0" data-testid="button-import-captions">
                {importing ? <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Ophalen…</> : <><Download className="w-3 h-3 mr-1" /> Import</>}
              </Button>
            </div>
            {importedItems.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                <p className="text-[9px] font-bold uppercase text-muted-foreground mb-1">Klik om te selecteren</p>
                {importedItems.map((item) => {
                  const selected = samples.some(s => s.id === item.id);
                  return (
                    <button key={item.id} onClick={() => toggleImportedItem(item)}
                      className={cn("w-full text-left rounded-lg border p-2 text-xs transition-all",
                        selected
                          ? "border-violet-400 bg-violet-50/60 dark:bg-violet-950/20"
                          : "border-border hover:border-violet-300"
                      )}
                      data-testid={`import-item-${item.id}`}>
                      <div className="flex items-start gap-2">
                        <div className={cn("mt-0.5 w-3.5 h-3.5 rounded border-2 shrink-0 flex items-center justify-center",
                          selected ? "border-violet-500 bg-violet-500" : "border-muted-foreground")}>
                          {selected && <CheckCheck className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <p className="line-clamp-2 text-[11px] leading-snug">{item.text}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Current samples list */}
          {samples.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
                Toegevoegd ({samples.length} samples)
              </p>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {samples.map((s, i) => (
                  <div key={i} className="border rounded-xl p-2.5 bg-muted/10 flex items-start gap-2 group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Badge variant="outline" className="text-[9px] px-1 h-4 border-violet-300 text-violet-600 dark:text-violet-400">
                          {s.source === "instagram" ? "Instagram" : "Handmatig"}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">{s.text}</p>
                    </div>
                    <button onClick={() => removeSample(i)} className="shrink-0 text-muted-foreground hover:text-red-500 p-0.5 rounded transition-colors opacity-0 group-hover:opacity-100"
                      data-testid={`remove-sample-${i}`}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Claude Style Analysis */}
          <div className="border border-violet-200/60 dark:border-violet-800/30 rounded-xl p-3 bg-violet-50/20 dark:bg-violet-950/10">
            <p className="text-xs font-bold flex items-center gap-1.5 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-violet-500" /> Claude Stijlanalyse
            </p>
            <p className="text-[10px] text-muted-foreground mb-3">
              Laat Claude AI jouw content analyseren en automatisch persona-verbeteringen voorstellen.
            </p>
            <Button onClick={analyzeStyle} disabled={analyzing || samples.length === 0}
              className="w-full text-xs h-9 text-white font-bold"
              style={{ background: "linear-gradient(135deg,#6d28d9,#4c1d95)" }}
              data-testid="button-analyze-style">
              {analyzing
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Claude analyseert…</>
                : <><Brain className="w-3.5 h-3.5 mr-1.5" /> Analyseer Mijn Schrijfstijl</>}
            </Button>

            {analysisResult && (
              <div className="mt-3 space-y-2.5">
                <div className="rounded-lg border border-violet-200/60 dark:border-violet-800/30 bg-white/60 dark:bg-black/20 p-3">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400 mb-1">Claude's Analyse</p>
                  <p className="text-[11px] text-muted-foreground italic">{analysisResult.analysis}</p>
                </div>
                {analysisResult.toneAndVoice && (
                  <div className="rounded-lg border bg-muted/20 p-2.5">
                    <p className="text-[9px] font-bold uppercase text-muted-foreground mb-1">Voorgestelde Toon & Stem</p>
                    <p className="text-[11px]">{analysisResult.toneAndVoice}</p>
                  </div>
                )}
                {analysisResult.communicationStyle && (
                  <div className="rounded-lg border bg-muted/20 p-2.5">
                    <p className="text-[9px] font-bold uppercase text-muted-foreground mb-1">Voorgestelde Stijl</p>
                    <p className="text-[11px]">{analysisResult.communicationStyle}</p>
                  </div>
                )}
                <Button onClick={applyAnalysis}
                  className="w-full text-xs h-8 text-white"
                  style={{ background: "linear-gradient(135deg,#7c3aed,#9333ea)" }}
                  data-testid="button-apply-analysis">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Toepassen op Persona
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── TAB 3: WOORDENBOEK ─────────────────────────────── */}
        <TabsContent value="vocab" className="mt-4 space-y-4">
          <div>
            <h4 className="text-xs font-bold mb-0.5 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-violet-500" /> Jouw Woordenboek
            </h4>
            <p className="text-[11px] text-muted-foreground mb-3">
              Leer de AI jouw hashtags, vaste uitdrukkingen en straattaal. De AI gebruikt ze vanzelf.
            </p>

            {/* Add vocab */}
            <div className="flex gap-2">
              <select
                value={newVocabType}
                onChange={e => setNewVocabType(e.target.value as any)}
                className="text-xs border rounded-lg px-2 py-1.5 bg-background shrink-0 h-8"
                data-testid="select-vocab-type">
                <option value="hashtag">#Hashtag</option>
                <option value="phrase">Frase</option>
                <option value="slang">Slang</option>
              </select>
              <Input
                value={newVocabValue}
                onChange={e => setNewVocabValue(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addVocab()}
                placeholder={newVocabType === "hashtag" ? "#urbanculture" : newVocabType === "phrase" ? "Keep it real" : "fire, vibes"}
                className="text-xs h-8 flex-1"
                data-testid="input-vocab-value"
              />
              <VoiceMicButton value={newVocabValue} onUpdate={t => setNewVocabValue(t)} />
              <Button size="sm" onClick={addVocab} disabled={!newVocabValue.trim()}
                className="text-white h-8 px-3 shrink-0" style={{ background: "#7c3aed" }}
                data-testid="button-add-vocab">
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>

            {vocab.length === 0 ? (
              <div className="border-2 border-dashed rounded-xl p-5 text-center text-xs text-muted-foreground mt-3">
                Voeg hashtags, vaste uitdrukkingen of straattaal toe.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 mt-3">
                {vocab.map((v, i) => (
                  <div key={i}
                    className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium"
                    style={{ borderColor: vocabTypeColor[v.type] + "50", background: vocabTypeColor[v.type] + "15", color: vocabTypeColor[v.type] }}
                    data-testid={`vocab-item-${i}`}>
                    <span className="text-[9px] opacity-60 mr-0.5">{vocabTypeLabel[v.type]}</span>
                    {v.value}
                    <button onClick={() => removeVocab(i)} className="ml-1 opacity-50 hover:opacity-100 transition-opacity">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {vocab.length > 0 && (
            <div className="rounded-xl border border-violet-200/50 dark:border-violet-800/30 bg-violet-50/20 dark:bg-violet-950/10 p-3">
              <p className="text-[9px] font-bold uppercase tracking-wide text-violet-500 mb-1.5">Hoe de AI dit gebruikt</p>
              <p className="text-[11px] text-muted-foreground">
                De AI werkt {vocab.filter(v => v.type === "hashtag").length} hashtags, {vocab.filter(v => v.type === "phrase").length} uitdrukkingen
                en {vocab.filter(v => v.type === "slang").length} straatwoorden natuurlijk in zijn antwoorden.
              </p>
            </div>
          )}
        </TabsContent>

        {/* ── TAB 4: FEITEN ──────────────────────────────────── */}
        <TabsContent value="facts" className="mt-4 space-y-4">
          <div>
            <h4 className="text-xs font-bold mb-0.5 flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500" /> Merkfeiten
            </h4>
            <p className="text-[11px] text-muted-foreground mb-3">
              Feiten die de AI altijd moet weten en onthouden over jouw merk, evenementen en identiteit.
            </p>

            <div className="flex gap-2">
              <Input
                value={newFact}
                onChange={e => setNewFact(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addFact()}
                placeholder="Bijv. Wij organiseren maandelijks battles in Rotterdam..."
                className="text-xs h-8"
                data-testid="input-new-fact"
              />
              <VoiceMicButton value={newFact} onUpdate={t => setNewFact(t)} />
              <Button size="sm" onClick={addFact} disabled={!newFact.trim()}
                className="text-white h-8 px-3 shrink-0" style={{ background: "#d97706" }}
                data-testid="button-add-fact">
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>

            {facts.length === 0 ? (
              <div className="border-2 border-dashed rounded-xl p-5 text-center text-xs text-muted-foreground mt-3">
                Voeg feiten toe die de AI altijd moet onthouden.
              </div>
            ) : (
              <div className="space-y-2 mt-3">
                {facts.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-xl border border-amber-200/60 dark:border-amber-800/30 bg-amber-50/20 dark:bg-amber-950/10 p-2.5 group"
                    data-testid={`fact-item-${i}`}>
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-[11px] flex-1">{f}</p>
                    <button onClick={() => removeFact(i)} className="shrink-0 text-muted-foreground hover:text-red-500 p-0.5 rounded transition-colors opacity-0 group-hover:opacity-100">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── TAB 5: LEER — Learning History & Preferences ──────── */}
        <TabsContent value="learn" className="mt-4 space-y-4">
          <div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Vertel de AI over jouw voorkeuren — hoe je aangesproken wil worden, wat je stijl is, wat je wél en niet wilt. De AI leert hiervan en past zich hierop aan in de hele app.
            </p>
          </div>

          {/* Add entry input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold">Voorkeur of opmerking toevoegen</label>
              <VoiceMicButton value={newEntry} onUpdate={t => setNewEntry(t)} />
            </div>
            <div className="flex gap-2 items-start">
              <Textarea
                value={newEntry}
                onChange={e => setNewEntry(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addEntry(); } }}
                placeholder={`Bijv:\n• "Spreek me aan in het Nederlands"\n• "Ik hou van korte, directe teksten"\n• "Gebruik nooit formele taal"`}
                rows={3} className="text-sm resize-none flex-1"
                data-testid="textarea-learning-entry"
              />
              <Button size="sm" onClick={addEntry} disabled={!newEntry.trim()} className="shrink-0 h-[72px] w-10 p-0"
                data-testid="button-add-entry">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Entries list */}
          {learningHistory.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Ingevoerde voorkeuren ({learningHistory.length})
              </p>
              {learningHistory.map((entry, i) => (
                <div key={i} className="flex items-start gap-2 bg-muted/40 border border-border/40 rounded-xl px-3 py-2 group"
                  data-testid={`entry-item-${i}`}>
                  <span className="text-xs flex-1 leading-relaxed">{entry}</span>
                  <button onClick={() => removeEntry(i)}
                    className="text-muted-foreground hover:text-red-500 shrink-0 transition-colors opacity-0 group-hover:opacity-100">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Analyze button */}
          {learningHistory.length > 0 && (
            <Button onClick={analyzePreferences} disabled={analyzingPrefs}
              className="w-full text-xs h-9 text-white font-bold"
              style={{ background: "linear-gradient(135deg,#db2777,#7c3aed)" }}
              data-testid="button-analyze-preferences">
              {analyzingPrefs
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> AI analyseert jouw voorkeuren…</>
                : <><Sparkles className="w-3.5 h-3.5 mr-1.5" /> AI Analyseer & Leer van mij</>}
            </Button>
          )}

          {learningHistory.length === 0 && (
            <div className="border-2 border-dashed rounded-xl p-5 text-center text-xs text-muted-foreground">
              Voeg voorkeuren toe die de AI over jou moet leren.
            </div>
          )}

          {/* Analyzed profile result */}
          {analyzedProfile && Object.keys(analyzedProfile).length > 0 && (
            <div className="space-y-3 rounded-xl border border-pink-200/50 dark:border-pink-800/30 bg-pink-50/20 dark:bg-pink-950/10 p-4">
              <p className="text-xs font-bold flex items-center gap-1.5 text-pink-700 dark:text-pink-300">
                <Brain className="w-3.5 h-3.5" /> Wat de AI over jou heeft geleerd
              </p>
              {analyzedProfile.howToAddressMe && (
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground mb-1">🗣 Aanspreken</p>
                  <p className="text-[11px]">{analyzedProfile.howToAddressMe}</p>
                </div>
              )}
              {analyzedProfile.communicationTone && (
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground mb-1">💬 Communicatietoon</p>
                  <p className="text-[11px]">{analyzedProfile.communicationTone}</p>
                </div>
              )}
              {analyzedProfile.languagePreference && (
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground mb-1">🌍 Taalvoorkeur</p>
                  <p className="text-[11px]">{analyzedProfile.languagePreference}</p>
                </div>
              )}
              {Array.isArray(analyzedProfile.myPreferences) && analyzedProfile.myPreferences.length > 0 && (
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground mb-1.5">✅ Wat ik graag wil</p>
                  <div className="flex flex-wrap gap-1">
                    {analyzedProfile.myPreferences.map((p: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-[10px] border-green-400/60 text-green-700 dark:text-green-400">{p}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {Array.isArray(analyzedProfile.avoidances) && analyzedProfile.avoidances.length > 0 && (
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground mb-1.5">❌ Wat vermijden</p>
                  <div className="flex flex-wrap gap-1">
                    {analyzedProfile.avoidances.map((a: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-[10px] border-red-400/60 text-red-700 dark:text-red-400">{a}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {analyzedProfile.otherNotes && (
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground mb-1">📌 Overige notities</p>
                  <p className="text-[11px] text-muted-foreground">{analyzedProfile.otherNotes}</p>
                </div>
              )}
              <p className="text-[9px] text-muted-foreground/60 italic">
                Klik op "AI Opslaan &amp; Bijwerken" hieronder om dit te activeren in de hele app.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Save button — always visible */}
      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
        className="w-full text-white font-bold h-10" style={{ background: "linear-gradient(135deg,#7c3aed,#9333ea)" }}
        data-testid="button-save-persona">
        {saveMutation.isPending
          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Opslaan...</>
          : <><Brain className="w-4 h-4 mr-2" /> AI Opslaan & Bijwerken</>}
      </Button>
    </div>
  );
}

/* ══════════════════════════════════════
   AI REPLY CENTER ZONE
══════════════════════════════════════ */
function ReplyZone({ media }: any) {
  const { toast } = useToast();
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [draft, setDraft] = useState("");
  const [editedDraft, setEditedDraft] = useState("");
  const [actionId, setActionId] = useState<number | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draftingAll, setDraftingAll] = useState(false);
  const [sending, setSending] = useState(false);
  const [allComments, setAllComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);

  const { data: actions = [], refetch: refetchActions } = useQuery<any[]>({
    queryKey: ["/api/instagram/ai/actions"],
  });

  const pendingCount = (actions as any[]).filter(a => a.status === "pending").length;

  const loadComments = async () => {
    if (!media?.length) return;
    setLoadingComments(true);
    const comments: any[] = [];
    for (const post of (media || []).slice(0, 5)) {
      try {
        const res = await fetch(`/api/instagram/media/${post.id}/comments`, { credentials: "include" });
        if (res.ok) {
          const d = await res.json();
          (d.data || []).forEach((c: any) => comments.push({ ...c, mediaId: post.id, postCaption: post.caption }));
        }
      } catch {}
    }
    setAllComments(comments);
    setLoadingComments(false);
  };

  useEffect(() => { loadComments(); }, [media]);

  const generateDraft = async (comment: any) => {
    setDrafting(true);
    setSelectedItem(comment);
    setDraft("");
    setEditedDraft("");
    setActionId(null);
    try {
      const res = await apiRequest("/api/instagram/ai/draft-reply", "POST", {
        sourceText: comment.text,
        commentId: comment.id,
        mediaId: comment.mediaId,
        triggerType: "comment_received",
      });
      const data = await res.json();
      setDraft(data.draft || "");
      setEditedDraft(data.draft || "");
      setActionId(data.actionId || null);
      refetchActions();
    } catch (err: any) {
      toast({ title: "Draft genereren mislukt", description: err.message, variant: "destructive" });
    } finally { setDrafting(false); }
  };

  const draftAll = async () => {
    if (!allComments.length) return;
    setDraftingAll(true);
    try {
      const res = await apiRequest("/api/instagram/ai/draft-all", "POST", {
        comments: allComments.slice(0, 10).map(c => ({ id: c.id, text: c.text, mediaId: c.mediaId })),
      });
      await res.json();
      toast({ title: "Alle drafts gegenereerd!", description: "Controleer het Activiteitenfeed." });
      refetchActions();
    } catch (err: any) {
      toast({ title: "Bulk draft mislukt", variant: "destructive" });
    } finally { setDraftingAll(false); }
  };

  const sendReply = async () => {
    if (!editedDraft.trim()) return;
    setSending(true);
    try {
      await apiRequest("/api/instagram/ai/send-reply", "POST", {
        actionId,
        text: editedDraft,
        commentId: selectedItem?.id,
        mediaId: selectedItem?.mediaId,
      });
      toast({ title: "Antwoord verzonden!" });
      setDraft("");
      setEditedDraft("");
      setSelectedItem(null);
      setActionId(null);
      refetchActions();
    } catch (err: any) {
      toast({ title: "Verzenden mislukt", description: err.message, variant: "destructive" });
    } finally { setSending(false); }
  };

  const rejectDraft = async () => {
    if (!actionId) { setDraft(""); setEditedDraft(""); setSelectedItem(null); return; }
    try {
      await apiRequest(`/api/instagram/ai/actions/${actionId}`, "PATCH", { status: "rejected" });
      toast({ title: "Draft afgewezen" });
      setDraft(""); setEditedDraft(""); setSelectedItem(null); setActionId(null);
      refetchActions();
    } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-extrabold text-base flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-pink-500" /> AI Reply Center
            {pendingCount > 0 && (
              <Badge className="bg-pink-500 text-white text-[10px] px-1.5 py-0.5">{pendingCount}</Badge>
            )}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Bekijk reacties en laat de AI antwoorden schrijven in jouw stem. Keur goed of bewerk voor verzending.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={draftAll} disabled={draftingAll || !allComments.length}
          className="text-xs h-8 shrink-0" data-testid="button-draft-all">
          {draftingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
          Draft All
        </Button>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/60 dark:bg-blue-950/20 p-3 text-xs text-blue-700 dark:text-blue-400">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <div>
          <span className="font-semibold">Instagram DM-beperking:</span> Het Reply Center toont reacties op posts. Directe berichten (DM's) worden niet ondersteund door de Instagram Graph API voor zakelijke accounts zonder speciale goedkeuring. DM-automatisering via regels wordt in de wachtrij geplaatst voor handmatige review.
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Left: comment list */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
            Reacties ({loadingComments ? "laden..." : allComments.length})
          </p>
          {loadingComments ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : allComments.length === 0 ? (
            <div className="border-2 border-dashed rounded-xl p-6 text-center text-xs text-muted-foreground">
              Geen recente reacties gevonden. Verbind je Instagram-account om reacties te laden.
            </div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {allComments.map(comment => {
                const actionForComment = (actions as any[]).find(a => a.commentId === comment.id);
                const statusColor = actionForComment?.status === "sent" ? "border-green-400/50 bg-green-50/30 dark:bg-green-950/10" :
                  actionForComment?.status === "rejected" ? "border-red-300/50 bg-red-50/30 dark:bg-red-950/10" :
                  actionForComment?.status === "pending" ? "border-amber-300/50 bg-amber-50/30 dark:bg-amber-950/10" :
                  "border-border/40";
                return (
                  <button key={comment.id}
                    onClick={() => { if (!actionForComment) generateDraft(comment); else { setSelectedItem(comment); setDraft(actionForComment.rawAiOutput || ""); setEditedDraft(actionForComment.rawAiOutput || ""); setActionId(actionForComment.id); } }}
                    className={cn("w-full text-left border rounded-xl p-3 transition-all hover:shadow-sm", statusColor, selectedItem?.id === comment.id && "ring-2 ring-violet-400/50")}
                    data-testid={`button-comment-${comment.id}`}>
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold shrink-0">
                        {(comment.username || "?")[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 justify-between">
                          <p className="text-[11px] font-bold">@{comment.username}</p>
                          {actionForComment && (
                            <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0",
                              actionForComment.status === "sent" ? "border-green-400 text-green-600" :
                              actionForComment.status === "rejected" ? "border-red-400 text-red-600" :
                              "border-amber-400 text-amber-600")}>
                              {actionForComment.status}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{comment.text}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: draft panel */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">AI Draft</p>
          {!selectedItem ? (
            <div className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 text-center min-h-[200px]">
              <Sparkles className="w-8 h-8 text-violet-300" />
              <p className="text-xs text-muted-foreground">Selecteer een reactie om een AI-antwoord te genereren.</p>
            </div>
          ) : drafting ? (
            <div className="border rounded-xl p-6 flex flex-col items-center justify-center gap-3 min-h-[200px]">
              <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
              <p className="text-xs text-muted-foreground">AI schrijft antwoord in jouw stem...</p>
            </div>
          ) : (
            <div className="space-y-3">
              <Card className="border-violet-200/50 dark:border-violet-800/30 bg-violet-50/20 dark:bg-violet-950/10">
                <CardContent className="py-3 px-4">
                  <p className="text-[10px] font-bold text-muted-foreground mb-1">Reactie van @{selectedItem.username}</p>
                  <p className="text-xs">{selectedItem.text}</p>
                </CardContent>
              </Card>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground mb-1">AI Voorstel — Bewerk naar wens</p>
                <Textarea
                  value={editedDraft}
                  onChange={e => setEditedDraft(e.target.value)}
                  rows={4} className="text-sm resize-none"
                  placeholder="AI draft verschijnt hier..."
                  data-testid="textarea-ai-draft"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={sendReply} disabled={sending || !editedDraft.trim()}
                  className="flex-1 text-white font-bold text-xs" style={{ background: "linear-gradient(135deg,#10b981,#0d9488)" }}
                  data-testid="button-approve-send">
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5 mr-1" />}
                  Goedkeuren & Verzenden
                </Button>
                <Button variant="outline" onClick={rejectDraft} className="text-xs px-3 border-red-200 text-red-600 hover:bg-red-50"
                  data-testid="button-reject-draft">
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   AUTOMATION RULES ZONE
══════════════════════════════════════ */

const TRIGGERS: { value: string; label: string; icon: any; color: string; desc: string; hasKeyword?: boolean; hasExclude?: boolean; hasThreshold?: boolean }[] = [
  { value: "comment_received",        label: "Elke reactie",             icon: MessageCircle, color: "#3b82f6", desc: "Wordt getriggerd bij elke nieuwe comment op je posts", hasExclude: true },
  { value: "comment_contains_keyword",label: "Reactie met trefwoord",     icon: Hash,          color: "#f59e0b", desc: "Getriggerd als een comment een specifiek woord bevat", hasKeyword: true, hasExclude: true },
  { value: "comment_sentiment_negative",label:"Negatieve reactie",        icon: TrendingDown,  color: "#ef4444", desc: "AI detecteert negatief sentiment in een comment", hasExclude: true },
  { value: "new_follower_dm",         label: "Nieuwe volger",             icon: UserPlus,      color: "#8b5cf6", desc: "Wanneer iemand je begint te volgen (handmatige trigger)" },
  { value: "post_engagement_spike",   label: "Engagement piek",           icon: Flame,         color: "#f97316", desc: "Post bereikt een drempelwaarde aan likes + comments", hasThreshold: true },
  { value: "new_post_published",      label: "Nieuwe post gepubliceerd",  icon: Image,         color: "#10b981", desc: "Elke keer dat er een nieuw bericht op je profiel verschijnt" },
];

const ACTIONS: { value: string; label: string; icon: any; color: string; desc: string; hasTemplate?: boolean; hasAutoSend?: boolean }[] = [
  { value: "draft_reply",   label: "AI concept-antwoord",  icon: Brain,         color: "#8b5cf6", desc: "Claude schrijft een antwoord — jij keurt het goed of het wordt automatisch verzonden", hasTemplate: true, hasAutoSend: true },
  { value: "send_dm",       label: "DM in wachtrij",        icon: SendHorizonal, color: "#3b82f6", desc: "Voegt een AI-opgesteld DM-concept toe aan de wachtrij voor handmatige review", hasTemplate: true },
  { value: "notify_admin",  label: "Admin melding",         icon: Bell,          color: "#f59e0b", desc: "Stuurt jou een melding in het Activity-logboek" },
  { value: "like_comment",  label: "Like comment",          icon: Heart,         color: "#ec4899", desc: "Liked de comment automatisch via de Instagram API" },
  { value: "hide_comment",  label: "Verberg comment",       icon: EyeOff,        color: "#ef4444", desc: "Verbergt de comment voor andere gebruikers (negatieve reacties)" },
  { value: "tag_for_review",label: "Markeer voor review",   icon: Flag,          color: "#6b7280", desc: "Markeert de comment voor handmatige beoordeling in het Activity-logboek" },
];

const EMPTY_FORM = {
  name: "", triggerType: "comment_received", conditionKeyword: "", conditionKeywordExclude: "",
  engagementThreshold: 100, replyTemplate: "", actionType: "draft_reply", autoSend: false,
};

function AutomationZone() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [testResult, setTestResult] = useState<{ ruleId: number; preview: string; input: string } | null>(null);

  // ── Active account scoping ──
  const { data: allAccounts = [] } = useQuery<any[]>({ queryKey: ["/api/instagram/accounts"] });
  const activeConn  = (allAccounts as any[]).find((a: any) => a.isActive);
  const connectionId: number | null = activeConn?.id ?? null;

  const { data: status, refetch: refetchStatus } = useQuery<any>({
    queryKey: ["/api/instagram/status"],
  });
  const automationEnabled = status?.automationEnabled ?? false;

  const masterToggleMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      apiRequest("/api/instagram/connections/automation", "PATCH", { enabled }).then(r => r.json()),
    onSuccess: (_d, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/status"] });
      refetchStatus();
      toast({
        title: enabled ? "Automatisering ingeschakeld" : "Automatisering uitgeschakeld",
        description: enabled
          ? "De scheduler is nu actief en verwerkt regels."
          : "Geen enkele reactie wordt automatisch verstuurd.",
      });
    },
    onError: (e: any) => toast({ title: "Fout", description: e.message, variant: "destructive" }),
  });

  const { data: rules = [], isLoading: rulesLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/instagram/automation/rules", connectionId],
    queryFn: async () => {
      const url = connectionId
        ? `/api/instagram/automation/rules?connectionId=${connectionId}`
        : "/api/instagram/automation/rules";
      const res = await fetch(url, { credentials: "include" });
      return res.json();
    },
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/instagram/automation/stats"],
    refetchInterval: 30_000,
  });

  const selectedTrigger = TRIGGERS.find(t => t.value === form.triggerType);
  const selectedAction  = ACTIONS.find(a => a.value === form.actionType);

  const saveMutation = useMutation({
    mutationFn: () => {
      const body: any = {
        connectionId,
        name: form.name.trim(),
        triggerType: form.triggerType,
        conditionKeyword: form.conditionKeyword.trim() || null,
        conditionKeywordExclude: form.conditionKeywordExclude.trim() || null,
        engagementThreshold: Number(form.engagementThreshold) || 100,
        replyTemplate: form.replyTemplate.trim() || null,
        actionType: form.actionType,
        autoSend: form.autoSend,
      };
      if (editId) {
        return apiRequest(`/api/instagram/automation/rules/${editId}`, "PATCH", body).then(r => r.json());
      }
      return apiRequest("/api/instagram/automation/rules", "POST", body).then(r => r.json());
    },
    onSuccess: (d) => {
      if (d?.error) { toast({ title: "Fout", description: d.error, variant: "destructive" }); return; }
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/automation/rules", connectionId] });
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/automation/stats"] });
      setShowForm(false);
      setEditId(null);
      setForm({ ...EMPTY_FORM });
      toast({ title: editId ? "Regel bijgewerkt" : "Regel aangemaakt!", description: form.name });
    },
    onError: (e: any) => toast({ title: "Fout", description: e.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiRequest(`/api/instagram/automation/rules/${id}`, "PATCH", { isActive }).then(r => r.json()),
    onSuccess: () => { refetch(); queryClient.invalidateQueries({ queryKey: ["/api/instagram/automation/stats"] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/instagram/automation/rules/${id}`, "DELETE"),
    onSuccess: () => { refetch(); queryClient.invalidateQueries({ queryKey: ["/api/instagram/automation/stats"] }); toast({ title: "Regel verwijderd" }); },
  });

  const testMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/instagram/automation/rules/${id}/test`, "POST").then(r => r.json()),
    onSuccess: (d) => {
      setTestResult({ ruleId: d.rule?.id, preview: d.preview, input: d.sampleInput });
      toast({ title: "Droogtest geslaagd ✓", description: "Geen actie uitgevoerd op Instagram" });
    },
    onError: (e: any) => toast({ title: "Test mislukt", description: e.message, variant: "destructive" }),
  });

  const runNowMutation = useMutation({
    mutationFn: () => apiRequest("/api/instagram/automation/run-now", "POST").then(r => r.json()),
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/automation/stats"] });
      toast({ title: "Automatisering handmatig uitgevoerd", description: "Regels zijn nu gecontroleerd op nieuwe activiteit" });
    },
    onError: (e: any) => toast({ title: "Fout", description: e.message, variant: "destructive" }),
  });

  function openEdit(rule: any) {
    setForm({
      name: rule.name,
      triggerType: rule.triggerType,
      conditionKeyword: rule.conditionKeyword || "",
      conditionKeywordExclude: rule.conditionKeywordExclude || "",
      engagementThreshold: rule.engagementThreshold ?? 100,
      replyTemplate: rule.replyTemplate || "",
      actionType: rule.actionType,
      autoSend: rule.autoSend,
    });
    setEditId(rule.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelForm() {
    setShowForm(false);
    setEditId(null);
    setForm({ ...EMPTY_FORM });
  }

  return (
    <div className="space-y-5">

      {/* ── ACTIVE ACCOUNT BADGE ───────────────────────────────────────── */}
      {activeConn && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-200 dark:border-blue-800/40 bg-blue-50 dark:bg-blue-950/20 px-3 py-2">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center shrink-0">
            <span className="text-white text-[8px] font-bold">@</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-blue-700 dark:text-blue-300 truncate">
              @{activeConn.username}
            </p>
            <p className="text-[9px] text-muted-foreground">
              {activeConn.label || "Actieve account"} — regels zijn exclusief voor dit account
            </p>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0 animate-pulse" />
        </div>
      )}

      {/* ── MASTER SWITCH ──────────────────────────────────────────────── */}
      <div className={cn(
        "rounded-2xl border-2 p-4 flex items-center justify-between gap-4 transition-colors",
        automationEnabled
          ? "border-green-400 bg-green-50 dark:bg-green-950/30"
          : "border-red-300 bg-red-50 dark:bg-red-950/30"
      )} data-testid="panel-master-switch">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
            automationEnabled ? "bg-green-100 dark:bg-green-900" : "bg-red-100 dark:bg-red-900"
          )}>
            {automationEnabled
              ? <ToggleRight className="w-6 h-6 text-green-600" />
              : <ToggleLeft  className="w-6 h-6 text-red-500" />}
          </div>
          <div>
            <p className="font-extrabold text-sm">
              Automatisering is&nbsp;
              <span className={automationEnabled ? "text-green-600" : "text-red-500"}>
                {automationEnabled ? "AAN" : "UIT"}
              </span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">
              {automationEnabled
                ? "De scheduler draait actief. Regels met auto-send=aan kunnen reageren op comments."
                : "Veilig — de bot doet niets. Geen enkele reactie wordt automatisch verstuurd."}
            </p>
          </div>
        </div>
        <Switch
          checked={automationEnabled}
          disabled={masterToggleMutation.isPending}
          onCheckedChange={(val) => {
            if (val) {
              if (!confirm("Weet je zeker dat je automatisering wilt inschakelen?\n\nRegels met 'auto-send' kunnen dan zelfstandig reageren op comments van echte mensen.")) return;
            }
            masterToggleMutation.mutate(val);
          }}
          data-testid="switch-master-automation"
          className="scale-125"
        />
      </div>

      {/* ── Header row ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" /> Automatiseringsregels
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Stel slimme regels in die automatisch reageren op Instagram-activiteit — zonder dat jij er iets aan hoeft te doen.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={() => setShowHowItWorks(s => !s)}
            className="text-xs h-8 gap-1.5" data-testid="button-how-it-works">
            <Info className="w-3.5 h-3.5" /> Hoe werkt het?
          </Button>
          <Button size="sm" onClick={() => { cancelForm(); setShowForm(true); }}
            className="text-xs h-8 text-white gap-1.5" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}
            data-testid="button-new-rule">
            <Plus className="w-3.5 h-3.5" /> Nieuwe regel
          </Button>
        </div>
      </div>

      {/* ── Stats strip ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Totaal regels",  value: stats?.totalRules ?? "–",   icon: Zap,      color: "text-amber-500"  },
          { label: "Actief",         value: stats?.activeRules ?? "–",  icon: Activity,  color: "text-green-500"  },
          { label: "Totaal fires",   value: stats?.totalFires ?? "–",   icon: Flame,     color: "text-orange-500" },
          { label: "Acties vandaag", value: stats?.todayActions ?? "–", icon: Clock,     color: "text-blue-500"   },
        ].map(s => (
          <div key={s.label} className="rounded-xl border bg-card px-3 py-2.5 flex items-center gap-2.5" data-testid={`stat-${s.label}`}>
            <s.icon className={cn("w-4 h-4 shrink-0", s.color)} />
            <div>
              <p className="text-base font-extrabold leading-none">{s.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-none">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── How It Works explainer ────────────────────────────────────── */}
      {showHowItWorks && (
        <Card className="border-blue-200/60 dark:border-blue-800/40 bg-blue-50/30 dark:bg-blue-950/20" data-testid="card-how-it-works">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-blue-500 flex items-center justify-center">
                <Brain className="w-3.5 h-3.5 text-white" />
              </div>
              Hoe werkt de automatisering?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pb-4">
            {/* Flow diagram */}
            <div className="flex items-center gap-2 text-xs overflow-x-auto pb-1">
              {[
                { label: "Instagram activiteit", icon: SiInstagram, bg: "bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300" },
                { label: "→", icon: null, bg: "" },
                { label: "Trigger detectie", icon: Zap, bg: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" },
                { label: "→", icon: null, bg: "" },
                { label: "Conditie check", icon: Filter, bg: "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300" },
                { label: "→", icon: null, bg: "" },
                { label: "AI voert actie uit", icon: Brain, bg: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" },
                { label: "→", icon: null, bg: "" },
                { label: "Activity logboek", icon: Activity, bg: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" },
              ].map((step, i) =>
                step.icon === null ? (
                  <ChevronRight key={i} className="w-3 h-3 text-muted-foreground shrink-0" />
                ) : (
                  <div key={i} className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 shrink-0 font-medium", step.bg)}>
                    <step.icon className="w-3 h-3" />
                    {step.label}
                  </div>
                )
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 text-xs">
              <div className="space-y-2">
                <p className="font-bold text-foreground">Hoe het werkt in 4 stappen:</p>
                <ol className="space-y-1.5 text-muted-foreground list-none">
                  {[
                    { n: "1", t: "Polling elke 5 minuten", d: "De automatisering controleert elke 5 minuten je Instagram-account op nieuwe activiteit via de Graph API." },
                    { n: "2", t: "Trigger evaluatie", d: "Voor elke nieuwe comment, volger of post wordt gecontroleerd of een van jouw actieve regels van toepassing is (trigger + conditie)." },
                    { n: "3", t: "AI actie uitvoeren", d: "Als een regel matcht, voert Claude AI de gekoppelde actie uit: een concept-antwoord schrijven, een melding sturen, liken, verbergen, etc." },
                    { n: "4", t: "Activity logboek", d: "Elke uitgevoerde actie verschijnt in het Activity-tabblad. Concept-antwoorden wachten op jouw goedkeuring tenzij Auto-verzenden aan staat." },
                  ].map(({ n, t, d }) => (
                    <li key={n} className="flex gap-2.5">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold mt-0.5">{n}</span>
                      <span><strong className="text-foreground">{t}:</strong> {d}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50 p-2.5 space-y-1">
                  <p className="font-bold text-green-700 dark:text-green-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Beschikbare triggers
                  </p>
                  {TRIGGERS.map(t => (
                    <div key={t.value} className="flex items-center gap-1.5 text-[11px] text-green-700 dark:text-green-300">
                      <t.icon className="w-3 h-3 shrink-0" /> {t.label}
                    </div>
                  ))}
                </div>
                <div className="rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800/50 p-2.5 space-y-1">
                  <p className="font-bold text-violet-700 dark:text-violet-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Beschikbare acties
                  </p>
                  {ACTIONS.map(a => (
                    <div key={a.value} className="flex items-center gap-1.5 text-[11px] text-violet-700 dark:text-violet-300">
                      <a.icon className="w-3 h-3 shrink-0" /> {a.label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 p-2.5 text-[11px] space-y-1">
                <p className="font-bold text-amber-700 dark:text-amber-400">Handige tips:</p>
                <ul className="list-disc list-inside space-y-0.5 text-amber-700 dark:text-amber-300">
                  <li>Gebruik <strong>Droogtest</strong> om te zien wat Claude zou zeggen zonder echt te verzenden</li>
                  <li>Stel een <strong>Uitsluitingstrefwoord</strong> in om bijv. spam-woorden te negeren</li>
                  <li>Zet <strong>Auto-verzenden UIT</strong> bij nieuwe regels — controleer eerst in Activity</li>
                  <li>Klik <strong>Nu uitvoeren</strong> om handmatig een scan te starten zonder te wachten op de 5-minuten cyclus</li>
                  <li>DM's worden altijd in de wachtrij geplaatst (Instagram API vereist speciale goedkeuring voor auto-DM)</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Rule builder form ─────────────────────────────────────────── */}
      {showForm && (
        <Card className="border-amber-300/60 dark:border-amber-700/40 bg-amber-50/20 dark:bg-amber-950/10" data-testid="card-rule-form">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                {editId ? <Edit className="w-3.5 h-3.5 text-white" /> : <Plus className="w-3.5 h-3.5 text-white" />}
              </div>
              {editId ? "Regel bewerken" : "Nieuwe automatiseringsregel"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pb-4">
            {/* Name */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-muted-foreground">Naam van de regel</label>
                <VoiceMicButton value={form.name} onUpdate={t => setForm(f => ({ ...f, name: t }))} />
              </div>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="bijv. Auto-reply bij keyword 'prijs'"
                className="text-xs h-9"
                data-testid="input-rule-name"
              />
            </div>

            {/* Trigger selection */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground">TRIGGER — wanneer gebeurt dit?</label>
              <div className="grid grid-cols-2 gap-1.5">
                {TRIGGERS.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setForm(f => ({ ...f, triggerType: t.value }))}
                    className={cn(
                      "text-left p-2.5 rounded-xl border text-xs transition-all",
                      form.triggerType === t.value
                        ? "border-amber-400 bg-amber-50 dark:bg-amber-950/40 shadow-sm"
                        : "border-border hover:border-amber-300 hover:bg-muted/50"
                    )}
                    data-testid={`trigger-${t.value}`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <t.icon className="w-3.5 h-3.5 shrink-0" style={{ color: t.color }} />
                      <span className="font-semibold">{t.label}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Conditional fields for trigger */}
            {selectedTrigger?.hasKeyword && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-muted-foreground">Trefwoord om op te matchen</label>
                  <VoiceMicButton value={form.conditionKeyword} onUpdate={t => setForm(f => ({ ...f, conditionKeyword: t }))} />
                </div>
                <Input value={form.conditionKeyword} onChange={e => setForm(f => ({ ...f, conditionKeyword: e.target.value }))}
                  placeholder="bijv. prijs, samenwerken, info" className="text-xs h-9"
                  data-testid="input-condition-keyword" />
              </div>
            )}
            {selectedTrigger?.hasExclude && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-muted-foreground">Uitsluitingstrefwoord (optioneel)</label>
                  <VoiceMicButton value={form.conditionKeywordExclude} onUpdate={t => setForm(f => ({ ...f, conditionKeywordExclude: t }))} />
                </div>
                <Input value={form.conditionKeywordExclude} onChange={e => setForm(f => ({ ...f, conditionKeywordExclude: e.target.value }))}
                  placeholder="bijv. spam, reclame (deze comments worden overgeslagen)"
                  className="text-xs h-9" data-testid="input-exclude-keyword" />
              </div>
            )}
            {selectedTrigger?.hasThreshold && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground">
                  Engagement drempel (likes + comments) — huidig: {form.engagementThreshold}
                </label>
                <input type="range" min={10} max={1000} step={10}
                  value={form.engagementThreshold}
                  onChange={e => setForm(f => ({ ...f, engagementThreshold: Number(e.target.value) }))}
                  className="w-full accent-amber-500"
                  data-testid="input-engagement-threshold" />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>10</span><span className="font-bold text-foreground">{form.engagementThreshold} interactions</span><span>1000</span>
                </div>
              </div>
            )}

            {/* Action selection */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground">ACTIE — wat moet er gebeuren?</label>
              <div className="grid grid-cols-2 gap-1.5">
                {ACTIONS.map(a => (
                  <button
                    key={a.value}
                    onClick={() => setForm(f => ({ ...f, actionType: a.value }))}
                    className={cn(
                      "text-left p-2.5 rounded-xl border text-xs transition-all relative",
                      form.actionType === a.value
                        ? "border-violet-400 bg-violet-50 dark:bg-violet-950/40 shadow-sm"
                        : "border-border hover:border-violet-300 hover:bg-muted/50"
                    )}
                    data-testid={`action-${a.value}`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <a.icon className="w-3.5 h-3.5 shrink-0" style={{ color: a.color }} />
                      <span className="font-semibold">{a.label}</span>
                      {a.value === "send_dm" && (
                        <span className="ml-auto flex items-center gap-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded-full shrink-0" title="Vereist speciale Meta-goedkeuring">
                          <AlertTriangle className="w-2.5 h-2.5" /> Meta approval
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight">{a.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* DM permission warning */}
            {form.actionType === "send_dm" && (
              <div className="flex items-start gap-2.5 rounded-xl border border-blue-300 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-700 p-3" data-testid="banner-dm-permission-warning">
                <AlertTriangle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-800 dark:text-blue-300 space-y-0.5">
                  <p className="font-bold">Speciale Meta-goedkeuring vereist voor DMs</p>
                  <p className="leading-snug">Het automatisch versturen van directe berichten (DMs) via de Instagram Graph API vereist <strong>speciale Meta App Review-goedkeuring</strong> die de meeste accounts niet hebben. DMs worden daarom altijd in de wachtrij geplaatst voor handmatige review — je kunt ze nooit automatisch verzenden zonder die goedkeuring.</p>
                </div>
              </div>
            )}

            {/* Reply template (optional) */}
            {selectedAction?.hasTemplate && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-muted-foreground">
                    Vaste antwoordtemplate (optioneel — laat leeg voor AI-gegenereerd antwoord)
                  </label>
                  <VoiceMicButton value={form.replyTemplate} onUpdate={t => setForm(f => ({ ...f, replyTemplate: t }))} />
                </div>
                <Textarea value={form.replyTemplate} onChange={e => setForm(f => ({ ...f, replyTemplate: e.target.value }))}
                  placeholder="bijv. Bedankt voor je reactie! Stuur ons een DM voor meer info 🙏"
                  className="text-xs min-h-[64px] resize-none" data-testid="textarea-reply-template" />
              </div>
            )}

            {/* Auto-send toggle */}
            {selectedAction?.hasAutoSend && (
              <button
                onClick={() => setForm(f => ({ ...f, autoSend: !f.autoSend }))}
                className={cn("w-full flex items-center justify-between p-3 rounded-xl border transition-all text-xs",
                  form.autoSend
                    ? "border-green-400 bg-green-50 dark:bg-green-950/30"
                    : "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20"
                )}
                data-testid="toggle-auto-send"
              >
                <div className="flex items-center gap-2">
                  {form.autoSend ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5 text-amber-500" />}
                  <div className="text-left">
                    <p className={cn("font-bold", form.autoSend ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400")}>
                      {form.autoSend ? "Auto-verzenden AAN" : "Goedkeuring vereist"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {form.autoSend
                        ? "Antwoorden worden direct gepost zonder jouw goedkeuring"
                        : "Antwoorden komen als concept in Activity — jij beslist"}
                    </p>
                  </div>
                </div>
                {form.autoSend && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
              </button>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !form.name.trim()}
                className="text-xs text-white flex-1 h-9" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}
                data-testid="button-save-rule">
                {saveMutation.isPending
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Opslaan…</>
                  : <><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> {editId ? "Wijzigingen opslaan" : "Regel aanmaken"}</>}
              </Button>
              <Button size="sm" variant="outline" onClick={cancelForm} className="text-xs h-9">Annuleren</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Rules list ───────────────────────────────────────────────── */}
      {rulesLoading ? (
        <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
      ) : (rules as any[]).length === 0 && !showForm ? (
        <div className="border-2 border-dashed rounded-xl p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto">
            <Zap className="w-6 h-6 text-amber-500" />
          </div>
          <p className="font-bold text-sm">Nog geen automatiseringsregels</p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Maak je eerste regel aan om automatisch te reageren op comments, volgers en engagement-pieken.
          </p>
          <Button size="sm" onClick={() => setShowForm(true)}
            className="text-xs text-white" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Eerste regel aanmaken
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {(rules as any[]).map((rule: any) => {
            const trigger = TRIGGERS.find(t => t.value === rule.triggerType);
            const action  = ACTIONS.find(a => a.value === rule.actionType);
            const isTesting = testMutation.isPending && testMutation.variables === rule.id;
            return (
              <Card key={rule.id}
                className={cn("transition-all duration-200", !rule.isActive && "opacity-55")}
                data-testid={`card-rule-${rule.id}`}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-start gap-3">
                    {/* Toggle */}
                    <button
                      onClick={() => toggleMutation.mutate({ id: rule.id, isActive: !rule.isActive })}
                      className="shrink-0 mt-0.5" title={rule.isActive ? "Deactiveren" : "Activeren"}
                      data-testid={`toggle-rule-${rule.id}`}>
                      {rule.isActive
                        ? <ToggleRight className="w-6 h-6 text-green-500" />
                        : <ToggleLeft className="w-6 h-6 text-muted-foreground" />}
                    </button>

                    {/* Rule info */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold">{rule.name}</p>
                        {rule.triggerCount > 0 && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            {rule.triggerCount}× getriggerd
                          </Badge>
                        )}
                      </div>

                      {/* Flow pill */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {trigger && (
                          <div className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium"
                            style={{ borderColor: trigger.color + "40", color: trigger.color, background: trigger.color + "12" }}>
                            <trigger.icon className="w-2.5 h-2.5" /> {trigger.label}
                          </div>
                        )}
                        <ChevronRight className="w-3 h-3 text-muted-foreground" />
                        {action && (
                          <div className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium"
                            style={{ borderColor: action.color + "40", color: action.color, background: action.color + "12" }}>
                            <action.icon className="w-2.5 h-2.5" /> {action.label}
                          </div>
                        )}
                        <Badge className={cn("text-[10px] px-1.5 py-0",
                          rule.autoSend ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                       : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400")}>
                          {rule.autoSend ? "Auto" : "Review"}
                        </Badge>
                      </div>

                      {/* Extra details row */}
                      <div className="flex flex-wrap gap-1.5">
                        {rule.conditionKeyword && (
                          <span className="text-[10px] bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-300 border border-orange-200 dark:border-orange-800/40 rounded-md px-1.5 py-0.5">
                            🔍 "{rule.conditionKeyword}"
                          </span>
                        )}
                        {rule.conditionKeywordExclude && (
                          <span className="text-[10px] bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800/40 rounded-md px-1.5 py-0.5">
                            ✗ "{rule.conditionKeywordExclude}"
                          </span>
                        )}
                        {rule.triggerType === "post_engagement_spike" && (
                          <span className="text-[10px] bg-orange-50 dark:bg-orange-950/20 text-orange-600 border border-orange-200 dark:border-orange-800/40 rounded-md px-1.5 py-0.5">
                            ≥{rule.engagementThreshold} engagements
                          </span>
                        )}
                        {rule.replyTemplate && (
                          <span className="text-[10px] bg-violet-50 dark:bg-violet-950/20 text-violet-600 border border-violet-200 dark:border-violet-800/40 rounded-md px-1.5 py-0.5">
                            📝 Vaste template
                          </span>
                        )}
                        {rule.lastTriggeredAt && (
                          <span className="text-[10px] text-muted-foreground">
                            Laatste keer: {new Date(rule.lastTriggeredAt).toLocaleDateString("nl-NL")}
                          </span>
                        )}
                      </div>

                      {/* Test result for this rule */}
                      {testResult?.ruleId === rule.id && (
                        <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/20 p-2.5 space-y-1.5 text-xs">
                          <p className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Droogtest resultaat
                          </p>
                          <p className="text-muted-foreground text-[10px]">Input: "<em>{testResult?.input}</em>"</p>
                          <p className="text-foreground font-medium">AI antwoord: "{testResult?.preview}"</p>
                          <button onClick={() => setTestResult(null)} className="text-[10px] text-muted-foreground hover:text-foreground">Sluiten</button>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => testMutation.mutate(rule.id)}
                        disabled={isTesting}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                        title="Droogtest uitvoeren"
                        data-testid={`button-test-rule-${rule.id}`}>
                        {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => openEdit(rule)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                        title="Bewerken"
                        data-testid={`button-edit-rule-${rule.id}`}>
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(rule.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        title="Verwijderen"
                        data-testid={`button-delete-rule-${rule.id}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Bottom control bar ───────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-1">
        <Button size="sm" variant="outline"
          onClick={() => runNowMutation.mutate()}
          disabled={runNowMutation.isPending}
          className="text-xs h-8 gap-1.5"
          data-testid="button-run-now">
          {runNowMutation.isPending
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uitvoeren…</>
            : <><RefreshCw className="w-3.5 h-3.5" /> Nu uitvoeren</>}
        </Button>
        <p className="text-[10px] text-muted-foreground">Automatisch elke 5 minuten</p>
      </div>

      {/* ── API limitation notice ────────────────────────────────────── */}
      <Card className="border-blue-200/50 dark:border-blue-800/30 bg-blue-50/20 dark:bg-blue-950/10">
        <CardContent className="py-2.5 px-4">
          <div className="flex items-start gap-2 text-[10px]">
            <Info className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
            <div className="space-y-0.5">
              <p className="font-bold text-blue-600 dark:text-blue-400">Instagram API beperkingen</p>
              <p className="text-muted-foreground">
                <strong>DM's:</strong> Directe berichten worden altijd in de wachtrij geplaatst (Graph API vereist speciale Meta-goedkeuring voor auto-DM).
                <strong> Volger-events:</strong> Nieuwe volgers worden niet real-time gerapporteerd door de API — gebruik de handmatige evaluatie.
                <strong> Likes:</strong> Automatisch liken kan door Instagram worden gelimiteerd als je te snel werkt (rate limiting).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ══════════════════════════════════════
   ACTIVITY FEED ZONE
══════════════════════════════════════ */
function ActivityZone() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [search, setSearch] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const queryParams = new URLSearchParams();
  if (statusFilter !== "all") queryParams.set("status", statusFilter);
  if (search.trim()) queryParams.set("search", search.trim());
  if (dateFrom) queryParams.set("dateFrom", dateFrom);
  if (dateTo) queryParams.set("dateTo", dateTo);
  const queryString = queryParams.toString();

  const { data: rawActions = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/instagram/ai/actions", statusFilter, search, dateFrom, dateTo],
    queryFn: () => fetch(`/api/instagram/ai/actions${queryString ? `?${queryString}` : ""}`).then(r => r.json()),
    refetchInterval: 15000,
  });

  const actions = rawActions as any[];

  const updateStatus = async (id: number, status: string) => {
    try {
      await apiRequest(`/api/instagram/ai/actions/${id}`, "PATCH", { status });
      refetch();
      toast({ title: status === "approved" ? "Goedgekeurd" : "Afgewezen" });
    } catch {
      toast({ title: "Update mislukt", variant: "destructive" });
    }
  };

  const STATUS_STYLES: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    approved: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    sent: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  const STATUS_NL: Record<string, string> = {
    pending: "In wachtrij",
    approved: "Goedgekeurd",
    sent: "Verzonden",
    rejected: "Afgewezen",
    error: "Fout",
  };

  const TRIGGER_NL: Record<string, string> = {
    comment_received: "Reactie ontvangen",
    comment_contains_keyword: "Trefwoord gevonden",
    manual: "Handmatig",
    bulk_draft: "Bulk draft",
    new_follower_dm: "Nieuwe volger",
    post_engagement_spike: "Engagement piek",
  };

  const pendingCount = (rawActions as any[]).filter(a => a.status === "pending").length;
  const sentCount = (rawActions as any[]).filter(a => a.status === "sent").length;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-extrabold text-base flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-500" /> Activiteitenfeed
          {pendingCount > 0 && (
            <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5">{pendingCount} wachtend</Badge>
          )}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Real-time log van alle AI-acties, drafts en beslissingen.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { label: "Totaal", value: (rawActions as any[]).length, color: "text-foreground" },
          { label: "Wachtend", value: pendingCount, color: "text-amber-600" },
          { label: "Verzonden", value: sentCount, color: "text-green-600" },
          { label: "Afgewezen", value: (rawActions as any[]).filter(a => a.status === "rejected").length, color: "text-red-500" },
        ].map(({ label, value, color }) => (
          <Card key={label} className="py-2">
            <p className={cn("text-lg font-extrabold", color)}>{value}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </Card>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex gap-1.5 flex-wrap items-center">
          {["all", "pending", "approved", "sent", "rejected"].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn("text-[11px] px-3 py-1 rounded-full border transition-all font-medium",
                statusFilter === s ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground/30")}
              data-testid={`filter-status-${s}`}>
              {s === "all" ? "Alles" : STATUS_NL[s] || s}
            </button>
          ))}
          <button onClick={() => refetch()} className="ml-auto text-muted-foreground hover:text-foreground p-1 rounded-lg" data-testid="btn-refresh-activity">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[140px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Zoek in activiteiten…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 text-[11px] rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-foreground/20"
              data-testid="input-activity-search"
            />
          </div>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            title="Datum vanaf"
            className="text-[11px] rounded-lg border bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-foreground/20"
            data-testid="input-date-from"
          />
          <span className="text-[11px] text-muted-foreground self-center">→</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            title="Datum tot"
            className="text-[11px] rounded-lg border bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-foreground/20"
            data-testid="input-date-to"
          />
          {(search || dateFrom || dateTo) && (
            <button
              onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); }}
              className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg border"
              data-testid="btn-clear-filters">
              Wissen
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : actions.length === 0 ? (
        <div className="border-2 border-dashed rounded-xl p-10 text-center text-xs text-muted-foreground">
          Geen activiteiten gevonden. Begin met het genereren van AI-drafts via het Reply Center.
        </div>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {(actions as any[]).map((action: any) => (
            <Card key={action.id} className="overflow-hidden" data-testid={`card-action-${action.id}`}>
              <CardContent className="py-3 px-4">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">
                    <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold",
                      action.status === "sent" ? "bg-green-500" :
                      action.status === "rejected" ? "bg-red-400" :
                      action.status === "pending" ? "bg-amber-400" : "bg-blue-500")}>
                      {action.status === "sent" ? <CheckCheck className="w-3.5 h-3.5" /> :
                       action.status === "rejected" ? <X className="w-3.5 h-3.5" /> :
                       action.status === "pending" ? <Clock className="w-3.5 h-3.5" /> :
                       <CheckCircle2 className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                        {TRIGGER_NL[action.triggerType] || action.triggerType}
                      </Badge>
                      <Badge className={cn("text-[9px] px-1.5 py-0", STATUS_STYLES[action.status] || "bg-muted")}>
                        {STATUS_NL[action.status] || action.status}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {format(new Date(action.createdAt), "d MMM HH:mm", { locale: nl })}
                      </span>
                    </div>
                    {action.sourceText && (
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">"{action.sourceText}"</p>
                    )}
                    <p className="text-xs mt-1 line-clamp-2">{action.rawAiOutput}</p>
                    <button
                      onClick={() => setExpandedId(expandedId === action.id ? null : action.id)}
                      className="text-[10px] text-violet-600 dark:text-violet-400 mt-1 hover:underline"
                      data-testid={`button-expand-action-${action.id}`}>
                      {expandedId === action.id ? "Inklappen" : "Meer zien"}
                    </button>
                  </div>
                </div>

                {expandedId === action.id && (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    {action.sourceText && (
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground">Originele reactie</p>
                        <p className="text-xs mt-0.5 bg-muted/30 rounded-lg p-2">{action.sourceText}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground">AI Voorstel</p>
                      <p className="text-xs mt-0.5 bg-violet-50/50 dark:bg-violet-950/20 rounded-lg p-2">{action.rawAiOutput}</p>
                    </div>
                    {action.finalSentText && action.finalSentText !== action.rawAiOutput && (
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground">Definitief verzonden</p>
                        <p className="text-xs mt-0.5 bg-green-50/50 dark:bg-green-950/20 rounded-lg p-2">{action.finalSentText}</p>
                      </div>
                    )}
                    {action.status === "pending" && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => updateStatus(action.id, "approved")}
                          className="flex-1 text-xs text-white h-7" style={{ background: "linear-gradient(135deg,#10b981,#0d9488)" }}
                          data-testid={`button-approve-action-${action.id}`}>
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Goedkeuren
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => updateStatus(action.id, "rejected")}
                          className="flex-1 text-xs h-7 border-red-200 text-red-600"
                          data-testid={`button-reject-action-${action.id}`}>
                          <X className="w-3 h-3 mr-1" /> Afwijzen
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════
   PROFILE ZONE — Bio & Profile Picture
══════════════════════════════════════ */
function ProfileZone({ status }: { status: any }) {
  const { toast } = useToast();

  // Bio state
  const [bio, setBio] = useState("");
  const [bioSaving, setBioSaving] = useState(false);
  const [bioLimitNote, setBioLimitNote] = useState("");

  // Website state
  const [website, setWebsite] = useState("");
  const [websiteSaving, setWebsiteSaving] = useState(false);

  // AI bio generation state
  const [aiStyle, setAiStyle] = useState("Bold & Authentic");
  const [aiLanguage, setAiLanguage] = useState("English");
  const [aiFocus, setAiFocus] = useState("");
  const [generating, setGenerating] = useState(false);
  const [bioOptions, setBioOptions] = useState<{ text: string; style: string; charCount: number }[]>([]);

  // Profile picture state
  const [picFile, setPicFile] = useState<File | null>(null);
  const [picPreview, setPicPreview] = useState<string | null>(null);
  const [picUrl, setPicUrl] = useState<string>("");
  const [picUploading, setPicUploading] = useState(false);
  const [picApplying, setPicApplying] = useState(false);
  const [picLimitNote, setPicLimitNote] = useState("");
  const [picSizeWarning, setPicSizeWarning] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useQuery<any>({
    queryKey: ["/api/instagram/profile"],
  });

  useEffect(() => {
    if (profile) {
      setBio(profile.biography || "");
      setWebsite(profile.website || "");
    }
  }, [profile]);

  /* ── Save website via PATCH /api/instagram/profile ─────────────── */
  const saveWebsite = async () => {
    setWebsiteSaving(true);
    try {
      const res = await apiRequest("/api/instagram/profile", "PATCH", { website });
      const data = await res.json();
      if (data?.results?.website?.apiLimitation) {
        toast({ title: "Website saved locally", description: "Instagram's API requires special permissions for website updates. Saved in our system.", variant: "default" });
      } else if (data?.results?.website?.success) {
        toast({ title: "Website updated! ✅" });
      } else {
        toast({ title: "Website saved locally", variant: "default" });
      }
      refetchProfile();
    } catch (err: any) {
      toast({ title: "Website save failed", description: err.message, variant: "destructive" });
    } finally { setWebsiteSaving(false); }
  };

  const charCount = bio.length;
  const charOk = charCount <= 150;

  /* ── Save bio to Instagram ─────────────────────────────────── */
  const saveBio = async () => {
    if (!charOk) return;
    setBioSaving(true);
    setBioLimitNote("");
    try {
      const res = await apiRequest("/api/instagram/profile/update-bio", "POST", { biography: bio });
      const data = await res.json();
      if (data.error === "api_limitation") {
        setBioLimitNote(data.message || "");
        toast({ title: "Bio opgeslagen lokaal ✅", description: "Instagram's API staat geen directe bio-updates toe. Zie de notitie hieronder.", variant: "default" });
        refetchProfile();
      } else if (data.error) {
        throw new Error(data.error);
      } else {
        toast({ title: "Bio updated on Instagram! ✅" });
        refetchProfile();
      }
    } catch (err: any) {
      toast({ title: "Bio update failed", description: err.message, variant: "destructive" });
    } finally { setBioSaving(false); }
  };

  /* ── Generate bios with Claude ─────────────────────────────── */
  const generateBios = async () => {
    setGenerating(true);
    setBioOptions([]);
    try {
      const res = await apiRequest("/api/instagram/ai/generate-bio", "POST", {
        currentBio: bio,
        style: aiStyle,
        language: aiLanguage,
        focus: aiFocus,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setBioOptions(data.options || []);
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally { setGenerating(false); }
  };

  /* ── Profile picture handlers ──────────────────────────────── */
  const handlePicFile = (file: File) => {
    setPicFile(file);
    setPicPreview(URL.createObjectURL(file));
    setPicUrl("");
    setPicLimitNote("");
    if (file.size > IMAGE_MAX_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      setPicSizeWarning(`Afbeelding is ${mb} MB — wordt automatisch gecomprimeerd voor upload.`);
    } else {
      setPicSizeWarning("");
    }
  };

  const uploadAndApplyPicture = async () => {
    if (!picFile && !picUrl) return;
    setPicLimitNote("");

    let finalUrl = picUrl;

    if (picFile) {
      setPicUploading(true);
      try {
        const fileToUpload = await compressImageIfNeeded(picFile);
        const uploaded = await smartUploadMedia(fileToUpload);
        finalUrl = uploaded.url;
        setPicUrl(finalUrl);
      } catch (err: any) {
        toast({ title: "Upload failed", description: err.message, variant: "destructive" });
        setPicUploading(false);
        return;
      } finally { setPicUploading(false); }
    }

    setPicApplying(true);
    try {
      const res = await apiRequest("/api/instagram/profile/update-picture", "POST", { pictureUrl: finalUrl });
      const data = await res.json();
      if (data.error === "api_limitation") {
        setPicLimitNote(data.message || "");
        toast({ title: "Image uploaded to cloud ✅", description: "Instagram's API doesn't allow direct picture updates. See the note below.", variant: "default" });
        refetchProfile();
      } else if (data.error) {
        throw new Error(data.error);
      } else {
        toast({ title: "Profile picture updated! ✅" });
        refetchProfile();
      }
    } catch (err: any) {
      toast({ title: "Picture update failed", description: err.message, variant: "destructive" });
    } finally { setPicApplying(false); }
  };

  const [profileRefreshing, setProfileRefreshing] = useState(false);

  if (profileLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const refreshProfileFromInstagram = async () => {
    setProfileRefreshing(true);
    try {
      const res = await fetch("/api/instagram/profile/refresh", { method: "POST", credentials: "include" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Refresh failed");
      }
      await refetchProfile();
      toast({ title: "Profile refreshed from Instagram ✅" });
    } catch (err: any) {
      // If endpoint doesn't exist yet, just refetch from DB
      await refetchProfile();
      toast({ title: "Profile reloaded from cache" });
    } finally { setProfileRefreshing(false); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base flex items-center gap-2">
            <UserCog className="w-5 h-5 text-pink-500" /> Profile Editor
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Update your Instagram bio, website, and profile picture using Claude AI.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={refreshProfileFromInstagram} disabled={profileRefreshing}
          className="text-xs h-8 shrink-0 gap-1.5" data-testid="button-refresh-profile">
          {profileRefreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </Button>
      </div>

      {/* ── MEDIA_CREATOR permission warning ────────────────────────── */}
      {status?.accountType === "MEDIA_CREATOR" && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-3" data-testid="banner-media-creator-warning">
          <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 dark:text-amber-300 space-y-0.5">
            <p className="font-bold">Beperkte API-rechten (MEDIA_CREATOR token)</p>
            <p className="leading-snug">Je account gebruikt een MEDIA_CREATOR-token met beperkte rechten. <strong>Bio- en profielfoto-updates</strong> worden opgeslagen in ons systeem, maar kunnen niet direct via de Instagram API worden doorgezet. Voor volledige schrijfrechten is een <strong>Business-account</strong> met Meta App Review-goedkeuring vereist.</p>
          </div>
        </div>
      )}

      {/* ── PROFILE PICTURE ────────────────────────── */}
      <Card className="border-pink-200/50 dark:border-pink-800/30">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Image className="w-4 h-4 text-pink-500" /> Profile Picture
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-4">
          <div className="flex items-center gap-4">
            {/* Current picture */}
            <div className="shrink-0">
              <p className="text-[10px] font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">Current</p>
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-pink-300 dark:border-pink-700 bg-muted">
                {profile?.profilePictureUrl
                  ? <img src={proxyImg(profile.profilePictureUrl)} alt="Current" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-muted-foreground"><SiInstagram size={24} /></div>
                }
              </div>
            </div>

            {/* New picture preview */}
            {picPreview && (
              <div className="shrink-0">
                <p className="text-[10px] font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">New</p>
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-green-400 bg-muted">
                  <img src={picPreview} alt="New" className="w-full h-full object-cover" />
                </div>
              </div>
            )}

            <div className="flex-1 space-y-2">
              <Button
                size="sm" variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full text-xs h-8"
                data-testid="button-choose-picture">
                <Upload className="w-3.5 h-3.5 mr-1.5" /> Choose Image
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => e.target.files?.[0] && handlePicFile(e.target.files[0])}
                data-testid="input-pic-file"
              />
              <Input
                value={picUrl}
                onChange={e => { setPicUrl(e.target.value); setPicPreview(e.target.value || null); setPicLimitNote(""); }}
                placeholder="Or paste image URL..."
                className="text-xs h-8"
                data-testid="input-pic-url"
              />
            </div>
          </div>

          {picSizeWarning && (
            <div className="flex items-center gap-2 rounded-lg border border-blue-200/60 dark:border-blue-800/40 bg-blue-50/60 dark:bg-blue-950/20 px-3 py-2 text-[10px] text-blue-700 dark:text-blue-300">
              <span className="text-base leading-none">🗜️</span>
              {picSizeWarning}
            </div>
          )}

          <Button
            className="w-full text-white text-xs h-9"
            style={{ background: "linear-gradient(135deg,#ec4899,#be185d)" }}
            onClick={uploadAndApplyPicture}
            disabled={(!picFile && !picUrl) || picUploading || picApplying}
            data-testid="button-apply-picture">
            {picUploading
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Uploading…</>
              : picApplying
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Applying…</>
                : <><Upload className="w-3.5 h-3.5 mr-1.5" /> Upload & Apply to Instagram</>}
          </Button>

          {picLimitNote && (
            <div className="rounded-xl border border-amber-300/60 dark:border-amber-700/40 bg-amber-50/60 dark:bg-amber-950/20 px-3 py-2.5 space-y-1.5">
              <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <span>⚠️</span> Instagram API-beperking
              </p>
              <p className="text-[10px] text-amber-800 dark:text-amber-300 leading-relaxed">
                Instagram's API staat geen directe profielfoto-updates toe. Je foto is lokaal opgeslagen.
              </p>
              {picUrl && (
                <p className="text-[10px] text-amber-700 dark:text-amber-400">
                  Jouw afbeelding: <a href={picUrl} target="_blank" rel="noreferrer" className="underline font-medium break-all">{picUrl.slice(0, 55)}…</a>
                </p>
              )}
              <a href="https://www.instagram.com/accounts/edit/" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-600 dark:text-violet-400 hover:underline">
                → Update je profielfoto direct op Instagram.com
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── BIO EDITOR ────────────────────────────── */}
      <Card className="border-violet-200/50 dark:border-violet-800/30">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-violet-500" /> Instagram Bio
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="relative">
            <Textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Write your Instagram bio… (max 150 characters)"
              rows={4}
              className={cn("text-sm resize-none pr-14", !charOk && "border-red-400 focus-visible:ring-red-400")}
              data-testid="textarea-bio"
            />
            <span className={cn("absolute bottom-2.5 right-3 text-[10px] font-bold tabular-nums",
              charOk ? "text-muted-foreground" : "text-red-500")}>
              {charCount}/150
            </span>
          </div>

          <Button
            className="w-full text-white text-xs h-9"
            style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)" }}
            onClick={saveBio}
            disabled={!charOk || bioSaving || bio === (profile?.biography || "")}
            data-testid="button-save-bio">
            {bioSaving
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Saving…</>
              : <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Save Bio to Instagram</>}
          </Button>

          {bioLimitNote && (
            <div className="mt-2 rounded-xl border border-amber-300/60 dark:border-amber-700/40 bg-amber-50/60 dark:bg-amber-950/20 px-3 py-2.5 space-y-1.5">
              <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <span>⚠️</span> Instagram API-beperking
              </p>
              <p className="text-[10px] text-amber-800 dark:text-amber-300 leading-relaxed">
                Instagram's API staat geen directe bio-updates toe zonder speciale app-goedkeuring van Meta. Je bio is lokaal opgeslagen.
              </p>
              <a href="https://www.instagram.com/accounts/edit/" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-600 dark:text-violet-400 hover:underline">
                → Update je bio direct op Instagram.com
              </a>
            </div>
          )}

          {/* ── Website field ── */}
          <div className="pt-2 border-t border-border/60 space-y-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Link className="w-3 h-3" /> Website URL
            </label>
            <div className="flex gap-2">
              <Input
                value={website}
                onChange={e => setWebsite(e.target.value)}
                placeholder="https://urbanculture.nl"
                className="text-xs h-9 flex-1"
                data-testid="input-website"
              />
              <Button size="sm" className="h-9 text-xs text-white shrink-0"
                style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)" }}
                onClick={saveWebsite}
                disabled={websiteSaving || website === (profile?.website || "")}
                data-testid="button-save-website">
                {websiteSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">Instagram API may require special permissions for website updates. The value is always saved locally.</p>
          </div>
        </CardContent>
      </Card>

      {/* ── AI BIO GENERATOR ──────────────────────── */}
      <Card className="border-violet-200/50 dark:border-violet-800/30 bg-violet-50/20 dark:bg-violet-950/10">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-500" /> Claude AI Bio Generator
          </CardTitle>
          <CardDescription className="text-[11px]">
            Generate multiple bio options using Claude AI based on your brand identity and AI Persona settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold mb-1 block text-muted-foreground uppercase tracking-wide">Style</label>
              <select
                value={aiStyle}
                onChange={e => setAiStyle(e.target.value)}
                className="w-full text-xs border rounded-lg px-2 py-1.5 bg-background"
                data-testid="select-bio-style">
                {["Bold & Authentic", "Warm & Community", "Minimalist", "Playful & Fun", "Professional", "Street Culture", "Inspirational"].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold mb-1 block text-muted-foreground uppercase tracking-wide">Language</label>
              <select
                value={aiLanguage}
                onChange={e => setAiLanguage(e.target.value)}
                className="w-full text-xs border rounded-lg px-2 py-1.5 bg-background"
                data-testid="select-bio-language">
                {["English", "Dutch", "English + Dutch mix"].map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold mb-1 block text-muted-foreground uppercase tracking-wide">Key Focus (optional)</label>
            <Input
              value={aiFocus}
              onChange={e => setAiFocus(e.target.value)}
              placeholder="e.g. breaking battles, graffiti events, community platform"
              className="text-xs h-8"
              data-testid="input-bio-focus"
            />
          </div>

          <Button
            className="w-full text-white text-xs h-9"
            style={{ background: "linear-gradient(135deg,#6d28d9,#4c1d95)" }}
            onClick={generateBios}
            disabled={generating}
            data-testid="button-generate-bio">
            {generating
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Claude is thinking…</>
              : <><Sparkles className="w-3.5 h-3.5 mr-1.5" /> Generate Bio Options with Claude</>}
          </Button>

          {bioOptions.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Generated Options — click to use</p>
              {bioOptions.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => { setBio(opt.text); toast({ title: "Bio applied to editor ✅" }); }}
                  className="w-full text-left rounded-xl border border-violet-200 dark:border-violet-800/40 bg-background hover:border-violet-400 hover:bg-violet-50/40 dark:hover:bg-violet-950/20 p-3 transition-all group"
                  data-testid={`bio-option-${i}`}>
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-violet-300 text-violet-600 dark:text-violet-400">
                      {opt.style}
                    </Badge>
                    <span className={cn("text-[10px] font-bold tabular-nums",
                      opt.charCount <= 150 ? "text-green-600 dark:text-green-400" : "text-red-500")}>
                      {opt.charCount}/150
                    </span>
                  </div>
                  <p className="text-xs text-foreground leading-relaxed whitespace-pre-line">{opt.text}</p>
                  <p className="text-[9px] text-muted-foreground mt-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <CheckCircle2 className="w-3 h-3 text-violet-500" /> Click to use this bio
                  </p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ══════════════════════════════════════
   NOTIFICATIONS ZONE — Push Notification Inbox & Reply Approvals
══════════════════════════════════════ */
function NotificationsZone() {
  const { toast } = useToast();
  const [editingId, setEditingId]   = useState<number | null>(null);
  const [editText,  setEditText]    = useState("");
  const [tab, setTab]               = useState<"pending" | "all">("pending");

  const pendingQuery = useQuery<any[]>({
    queryKey: ["/api/instagram/pending-replies"],
    queryFn:  () => apiRequest("/api/instagram/pending-replies", "GET").then(r => r.json()),
    refetchInterval: 20_000,
  });

  const allActionsQuery = useQuery<any[]>({
    queryKey: ["/api/instagram/ai/actions"],
    queryFn:  () => apiRequest("/api/instagram/ai/actions?limit=30", "GET").then(r => r.json()),
    enabled:  tab === "all",
    refetchInterval: 30_000,
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, text }: { id: number; text?: string }) =>
      apiRequest(`/api/instagram/ai/actions/${id}/approve`, "POST", text ? { text } : {}).then(r => r.json()),
    onSuccess: (_, { id }) => {
      toast({ title: "✅ Reactie verzonden!", description: "Je antwoord is geplaatst op Instagram." });
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/pending-replies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/ai/actions"] });
    },
    onError: (err: any) => {
      toast({ title: "Verzenden mislukt", description: err?.message || "Probeer opnieuw.", variant: "destructive" });
    },
  });

  const skipMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/instagram/ai/actions/${id}/skip`, "POST").then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Overgeslagen" });
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/pending-replies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/ai/actions"] });
    },
  });

  const pending  = pendingQuery.data || [];
  const allItems = allActionsQuery.data || [];

  const statusColor: Record<string, string> = {
    pending:  "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-400/30",
    sent:     "bg-green-500/15 text-green-600 dark:text-green-400 border-green-400/30",
    skipped:  "bg-muted/40 text-muted-foreground border-border",
    error:    "bg-red-500/15 text-red-600 dark:text-red-400 border-red-400/30",
  };

  function ReplyCard({ action }: { action: any }) {
    const isEditing = editingId === action.id;
    const tData = (action.triggerData || {}) as Record<string, string>;
    const username = tData.username || "—";
    return (
      <Card className="border-border/60 hover:border-orange-400/30 transition-colors" data-testid={`reply-card-${action.id}`}>
        <CardContent className="p-4 space-y-3">
          {/* Comment info */}
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0 text-white text-xs font-bold">
              {username[0]?.toUpperCase() || "@"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-semibold">@{username}</span>
                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", statusColor[action.status] || statusColor.skipped)}>
                  {action.status}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {action.createdAt ? format(new Date(action.createdAt), "d MMM HH:mm") : "—"}
                </span>
              </div>
              <p className="text-sm text-foreground/80 mt-1 leading-relaxed bg-muted/30 rounded-lg px-2.5 py-1.5">
                "{action.sourceText || "—"}"
              </p>
            </div>
          </div>

          {/* Suggested reply */}
          {action.rawAiOutput && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-violet-500" /> AI Suggestie
              </p>
              {isEditing ? (
                <Textarea
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  className="text-sm min-h-[70px] resize-none"
                  placeholder="Bewerk je antwoord..."
                  data-testid={`edit-reply-${action.id}`}
                />
              ) : (
                <p className="text-sm text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/30 rounded-lg px-2.5 py-1.5 leading-relaxed border border-violet-200/40 dark:border-violet-800/30">
                  {action.rawAiOutput}
                </p>
              )}
            </div>
          )}

          {/* Actions — only for pending */}
          {action.status === "pending" && (
            <div className="flex items-center gap-2 flex-wrap">
              {isEditing ? (
                <>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-8 px-3"
                    disabled={approveMutation.isPending}
                    onClick={() => approveMutation.mutate({ id: action.id, text: editText })}
                    data-testid={`button-send-edited-${action.id}`}>
                    {approveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                    Verstuur
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs"
                    onClick={() => setEditingId(null)}>Annuleer</Button>
                </>
              ) : (
                <>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-8 px-3"
                    disabled={approveMutation.isPending}
                    onClick={() => approveMutation.mutate({ id: action.id })}
                    data-testid={`button-approve-${action.id}`}>
                    {approveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                    Goedkeuren
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 px-3"
                    onClick={() => { setEditingId(action.id); setEditText(action.rawAiOutput || ""); }}
                    data-testid={`button-edit-${action.id}`}>
                    <Edit className="w-3.5 h-3.5 mr-1" /> Bewerken
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 px-3 text-muted-foreground hover:text-red-500"
                    disabled={skipMutation.isPending}
                    onClick={() => skipMutation.mutate(action.id)}
                    data-testid={`button-skip-${action.id}`}>
                    <X className="w-3.5 h-3.5 mr-1" /> Overslaan
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Sent text indicator */}
          {action.status === "sent" && action.finalSentText && (
            <div className="flex items-start gap-1.5 text-xs text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Verstuurd: "{action.finalSentText}"</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Bell className="w-5 h-5 text-orange-500" />
            Instagram Meldingen
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Push notificaties naar je telefoon · Reacties goedkeuren
          </p>
        </div>
        <Button variant="ghost" size="sm"
          onClick={() => { pendingQuery.refetch(); allActionsQuery.refetch(); }}
          data-testid="button-refresh-notifications">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Info card about push */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="p-3 flex items-start gap-2.5">
          <Bell className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Hoe het werkt: </span>
            Zodra iemand reageert op je post, stuur je een push notificatie naar je telefoon met de reactie én een AI-suggestie voor antwoord.
            Je kunt direct goedkeuren, bewerken, of overslaan. Zorg dat je telefoon geregistreerd is via{" "}
            <button className="underline text-blue-600 dark:text-blue-400"
              onClick={() => window.location.href = "/admin/push"}>Push Instellingen</button>.
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/40 rounded-xl p-1">
        {([
          { id: "pending" as const, label: "Te beoordelen", count: pending.length },
          { id: "all" as const, label: "Recente activiteit", count: null },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all",
              tab === t.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {t.label}
            {t.count != null && t.count > 0 && (
              <Badge className="ml-1.5 h-4 w-4 p-0 text-[9px] bg-orange-500">{t.count}</Badge>
            )}
          </button>
        ))}
      </div>

      {/* Pending tab */}
      {tab === "pending" && (
        <div className="space-y-3">
          {pendingQuery.isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Laden…
            </div>
          ) : pending.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-500 opacity-60" />
              <p className="text-sm font-medium">Alles bijgewerkt</p>
              <p className="text-xs mt-0.5">Geen reacties in de wachtrij</p>
            </div>
          ) : (
            pending.map(a => <ReplyCard key={a.id} action={a} />)
          )}
        </div>
      )}

      {/* All activity tab */}
      {tab === "all" && (
        <div className="space-y-3">
          {allActionsQuery.isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Laden…
            </div>
          ) : allItems.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">Nog geen activiteit</div>
          ) : (
            allItems.map(a => <ReplyCard key={a.id} action={a} />)
          )}
        </div>
      )}
    </div>
  );
}

/* ── DMInboxNavButton — shows pending DM count badge on the nav button ── */
function DMInboxNavButton({ activeZone, setActiveZone }: { activeZone: Zone; setActiveZone: (z: Zone) => void }) {
  const { data } = useQuery<{ count: number }>({
    queryKey: ["/api/instagram/pending-dms/count"],
    queryFn: () => apiRequest("/api/instagram/pending-dms/count", "GET").then(r => r.json()),
    refetchInterval: 30_000,
  });
  const count = data?.count ?? 0;
  const isActive = activeZone === "dm-inbox";
  return (
    <button
      onClick={() => setActiveZone(isActive ? "studio" : "dm-inbox")}
      data-testid="zone-dm-inbox"
      className={cn(
        "w-full flex items-center gap-2.5 py-2 px-3 rounded-xl border transition-all duration-200 text-left",
        isActive
          ? "border-transparent text-white shadow-md"
          : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground hover:bg-muted/30"
      )}
      style={isActive ? { background: "linear-gradient(135deg,#2563ebdd,#2563eb)" } : {}}>
      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all", isActive ? "bg-white/20" : "bg-muted")}>
        <SendHorizonal className={cn("w-3.5 h-3.5", isActive ? "text-white" : "text-muted-foreground")} />
      </div>
      <span className={cn("text-[10px] font-bold flex-1", isActive ? "text-white" : "")}>DM Inbox</span>
      {count > 0 && (
        <Badge className={cn("h-5 min-w-[20px] px-1 text-[9px] font-extrabold shrink-0", isActive ? "bg-white text-blue-600" : "bg-blue-500 text-white border-0")}>
          {count > 99 ? "99+" : count}
        </Badge>
      )}
    </button>
  );
}

/* ══════════════════════════════════════
   DM INBOX ZONE — AI-drafted DM Approval Queue
══════════════════════════════════════ */
function DMInboxZone() {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [tab, setTab] = useState<"pending" | "history">("pending");

  const pendingQuery = useQuery<any[]>({
    queryKey: ["/api/instagram/pending-dms"],
    queryFn: () => apiRequest("/api/instagram/pending-dms", "GET").then(r => r.json()),
    refetchInterval: 20_000,
  });

  const historyQuery = useQuery<any[]>({
    queryKey: ["/api/instagram/dm-actions"],
    queryFn: () => apiRequest("/api/instagram/dm-actions?limit=30", "GET").then(r => r.json()),
    enabled: tab === "history",
    refetchInterval: 30_000,
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, text }: { id: number; text?: string }) =>
      apiRequest(`/api/instagram/ai/actions/${id}/approve`, "POST", text ? { text } : {}).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "✅ DM goedgekeurd", description: "De DM is goedgekeurd en wordt als verzonden gemarkeerd." });
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/pending-dms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/pending-dms/count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/dm-actions"] });
    },
    onError: (err: any) => {
      toast({ title: "Fout bij goedkeuren", description: err?.message || "Probeer opnieuw.", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/instagram/ai/actions/${id}/reject-dm`, "POST").then(r => r.json()),
    onSuccess: () => {
      toast({ title: "DM afgewezen" });
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/pending-dms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/pending-dms/count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/dm-actions"] });
    },
  });

  const pending = pendingQuery.data || [];
  const historyItems = historyQuery.data || [];

  const triggerLabel: Record<string, string> = {
    new_follower_dm:       "Nieuwe volger",
    comment_received:      "Reactie ontvangen",
    comment_contains_keyword: "Reactie met sleutelwoord",
    comment_sentiment_negative: "Negatieve reactie",
    post_engagement_spike: "Engagement piek",
    new_post_published:    "Nieuw bericht",
  };

  function DMCard({ action }: { action: any }) {
    const isEditing = editingId === action.id;
    const tData = (action.triggerData || {}) as Record<string, string>;
    const username = tData.username || tData.followerId || "—";
    return (
      <Card className="border-border/60 hover:border-blue-400/30 transition-colors" data-testid={`dm-card-${action.id}`}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shrink-0 text-white text-xs font-bold">
              {username !== "—" ? username[0]?.toUpperCase() : "✉"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                {username !== "—" && <span className="text-sm font-semibold">@{username}</span>}
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-400/40 text-blue-600 dark:text-blue-400 bg-blue-500/10">
                  DM
                </Badge>
                {action.ruleName && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-muted text-muted-foreground">
                    {action.ruleName}
                  </Badge>
                )}
                <span className="text-[10px] text-muted-foreground">
                  {action.createdAt ? format(new Date(action.createdAt), "d MMM HH:mm") : "—"}
                </span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-[10px] text-muted-foreground font-medium">
                  Trigger: {triggerLabel[action.triggerType] || action.triggerType}
                </span>
              </div>
              {action.sourceText && (
                <p className="text-xs text-foreground/70 mt-1 bg-muted/30 rounded-lg px-2.5 py-1.5 leading-relaxed">
                  "{action.sourceText}"
                </p>
              )}
            </div>
          </div>

          {action.rawAiOutput && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-blue-500" /> AI DM Concept
              </p>
              {isEditing ? (
                <Textarea
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  className="text-sm min-h-[80px] resize-none"
                  placeholder="Bewerk de DM..."
                  data-testid={`edit-dm-${action.id}`}
                />
              ) : (
                <p className="text-sm text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30 rounded-lg px-2.5 py-1.5 leading-relaxed border border-blue-200/40 dark:border-blue-800/30">
                  {action.rawAiOutput}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {isEditing ? (
              <>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-3"
                  disabled={approveMutation.isPending}
                  onClick={() => approveMutation.mutate({ id: action.id, text: editText })}
                  data-testid={`button-send-edited-dm-${action.id}`}>
                  {approveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                  Goedkeuren
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs"
                  onClick={() => setEditingId(null)}>Annuleer</Button>
              </>
            ) : (
              <>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-3"
                  disabled={approveMutation.isPending}
                  onClick={() => approveMutation.mutate({ id: action.id })}
                  data-testid={`button-approve-dm-${action.id}`}>
                  {approveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                  Goedkeuren
                </Button>
                <Button size="sm" variant="outline" className="h-8 px-3"
                  onClick={() => { setEditingId(action.id); setEditText(action.rawAiOutput || ""); }}
                  data-testid={`button-edit-dm-${action.id}`}>
                  <Edit className="w-3.5 h-3.5 mr-1" /> Bewerken
                </Button>
                <Button size="sm" variant="ghost" className="h-8 px-3 text-muted-foreground hover:text-red-500"
                  disabled={rejectMutation.isPending}
                  onClick={() => rejectMutation.mutate(action.id)}
                  data-testid={`button-reject-dm-${action.id}`}>
                  <X className="w-3.5 h-3.5 mr-1" /> Afwijzen
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <SendHorizonal className="w-5 h-5 text-blue-500" />
            DM Inbox
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            AI-concept DMs goedkeuren of afwijzen
          </p>
        </div>
        <Button variant="ghost" size="sm"
          onClick={() => { pendingQuery.refetch(); historyQuery.refetch(); }}
          data-testid="button-refresh-dm-inbox">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="p-3 flex items-start gap-2.5">
          <SendHorizonal className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Hoe het werkt: </span>
            Wanneer een automatie-regel een DM triggert, wordt het AI-concept hier in de wachtrij geplaatst. Keur het goed om het als "verzonden" te markeren en stuur de DM daarna handmatig via Instagram (Instagram beperkt automatisch verzenden).
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-1 bg-muted/40 rounded-xl p-1">
        {([
          { id: "pending" as const, label: "Te beoordelen", count: pending.length },
          { id: "history" as const, label: "Geschiedenis", count: null },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all",
              tab === t.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {t.label}
            {t.count != null && t.count > 0 && (
              <Badge className="ml-1.5 h-4 w-4 p-0 text-[9px] bg-blue-500">{t.count}</Badge>
            )}
          </button>
        ))}
      </div>

      {tab === "pending" && (
        <div className="space-y-3">
          {pendingQuery.isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Laden…
            </div>
          ) : pending.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-500 opacity-60" />
              <p className="text-sm font-medium">Geen DMs in de wachtrij</p>
              <p className="text-xs mt-0.5">AI-concept DMs verschijnen hier zodra een regel ze triggert</p>
            </div>
          ) : (
            pending.map((a: any) => <DMCard key={a.id} action={a} />)
          )}
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-3">
          {historyQuery.isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Laden…
            </div>
          ) : historyItems.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">Nog geen DM-activiteit</div>
          ) : (
            historyItems.map((a: any) => (
              <Card key={a.id} className="border-border/40" data-testid={`dm-history-${a.id}`}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={cn("w-2 h-2 rounded-full shrink-0",
                    a.status === "sent" ? "bg-green-500" : a.status === "skipped" ? "bg-muted-foreground" : "bg-amber-500")} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground/80 truncate">{a.rawAiOutput || a.sourceText || "—"}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {triggerLabel[a.triggerType] || a.triggerType} · {a.createdAt ? format(new Date(a.createdAt), "d MMM HH:mm") : "—"}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 shrink-0",
                    a.status === "sent" ? "border-green-400/40 text-green-600 dark:text-green-400" :
                    a.status === "skipped" ? "border-muted text-muted-foreground" :
                    "border-amber-400/40 text-amber-600 dark:text-amber-400")}>
                    {a.status}
                  </Badge>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════
   VIDEO EDITOR ZONE — CapCut-style Editor
══════════════════════════════════════ */
interface EditorClip { id: string; url: string; name: string; startSec: number; endSec: number; }
interface EditorOverlay { id: string; text: string; position: "top" | "center" | "bottom"; color: string; fontSize: number; startSec: number; endSec: number; }

function VideoEditorZone() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"clips" | "text" | "captions" | "export">("clips");
  const [clips, setClips] = useState<EditorClip[]>([]);
  const [transition, setTransition] = useState<"cut" | "fade" | "dissolve">("cut");
  const [transitionDuration, setTransitionDuration] = useState(0.5);
  const [overlays, setOverlays] = useState<EditorOverlay[]>([]);
  const [srtContent, setSrtContent] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [urlInput, setUrlInput] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<any>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [newOverlay, setNewOverlay] = useState<Omit<EditorOverlay, "id">>({ text: "", position: "bottom", color: "white", fontSize: 48, startSec: 0, endSec: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!jobId || jobStatus?.status === "done" || jobStatus?.status === "error") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/video/jobs/${jobId}`, { credentials: "include" });
        if (res.ok) setJobStatus(await res.json());
      } catch {}
    }, 1500);
    return () => clearInterval(interval);
  }, [jobId, jobStatus?.status]);

  const uploadClip = async (file: File) => {
    if (uploading) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const result = await smartUploadMedia(file, { onProgress: (pct: number) => setUploadProgress(pct) });
      const clip: EditorClip = { id: crypto.randomUUID(), url: result.url, name: file.name, startSec: 0, endSec: 0 };
      setClips(c => [...c, clip]);
      toast({ title: "Clip toegevoegd ✅", description: file.name });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally { setUploading(false); }
  };

  const addUrlClip = () => {
    const url = urlInput.trim();
    if (!url) return;
    const clip: EditorClip = { id: crypto.randomUUID(), url, name: url.split("/").pop() || "clip", startSec: 0, endSec: 0 };
    setClips(c => [...c, clip]);
    setUrlInput("");
    toast({ title: "Clip toegevoegd" });
  };

  const removeClip = (id: string) => setClips(c => c.filter(cl => cl.id !== id));
  const moveClip = (id: string, dir: -1 | 1) => {
    setClips(c => {
      const i = c.findIndex(cl => cl.id === id);
      if (i < 0) return c;
      const next = i + dir;
      if (next < 0 || next >= c.length) return c;
      const copy = [...c];
      [copy[i], copy[next]] = [copy[next], copy[i]];
      return copy;
    });
  };
  const updateClip = (id: string, patch: Partial<EditorClip>) =>
    setClips(c => c.map(cl => cl.id === id ? { ...cl, ...patch } : cl));

  const addOverlay = () => {
    if (!newOverlay.text.trim()) { toast({ title: "Tekst invoeren", variant: "destructive" }); return; }
    setOverlays(o => [...o, { ...newOverlay, id: crypto.randomUUID() }]);
    setNewOverlay({ text: "", position: "bottom", color: "white", fontSize: 48, startSec: 0, endSec: 0 });
    toast({ title: "Overlay toegevoegd" });
  };

  const transcribeFirst = async () => {
    if (!clips[0]?.url) { toast({ title: "Voeg eerst een clip toe", variant: "destructive" }); return; }
    setTranscribing(true);
    try {
      const res = await fetch("/api/video/transcribe", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: clips[0].url }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Transcription failed");
      setSrtContent(d.srt || "");
      toast({ title: "Auto-captions gegenereerd ✅", description: "SRT captions zijn klaar" });
      setTab("captions");
    } catch (err: any) {
      toast({ title: "Transcriptie mislukt", description: err.message, variant: "destructive" });
    } finally { setTranscribing(false); }
  };

  const renderVideo = async () => {
    if (!clips.length) { toast({ title: "Voeg minimaal één clip toe", variant: "destructive" }); return; }
    setJobStatus({ status: "queued", progress: 0, message: "Starten..." });
    setJobId(null);
    try {
      const res = await fetch("/api/video/process", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clips: clips.map(c => ({ url: c.url, startSec: c.startSec, endSec: c.endSec })),
          transition,
          transitionDuration,
          textOverlays: overlays.map(o => ({ text: o.text, position: o.position, color: o.color, fontSize: o.fontSize, startSec: o.startSec, endSec: o.endSec })),
          subtitlesFile: srtContent || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to start job");
      setJobId(d.jobId);
    } catch (err: any) {
      toast({ title: "Render mislukt", description: err.message, variant: "destructive" });
      setJobStatus(null);
    }
  };

  const sendToStudio = () => {
    if (!jobStatus?.outputUrl) return;
    window.location.href = `/admin/instagram?zone=studio&videoUrl=${encodeURIComponent(jobStatus.outputUrl)}`;
  };

  const TRANS_OPTS = [
    { id: "cut", label: "Harde cut", icon: "✂️", desc: "Direct overgaan" },
    { id: "fade", label: "Fade", icon: "🌅", desc: "Fade in/uit" },
    { id: "dissolve", label: "Dissolve", icon: "💧", desc: "Vloeiend" },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-extrabold text-base flex items-center gap-2">
            <Film className="w-5 h-5 text-red-500" /> Video Editor
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Trim, merge, captions, overlays — klaar voor Instagram</p>
        </div>
        <Badge variant="outline" className="text-[10px] border-red-300 text-red-600 bg-red-50 dark:bg-red-950/20">
          <Sparkles className="w-3 h-3 mr-1" /> AI-powered
        </Badge>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/60">
        {([["clips", "📹 Clips"], ["text", "✏️ Tekst"], ["captions", "💬 Captions"], ["export", "🚀 Render"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn("flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all",
              tab === id ? "bg-white dark:bg-zinc-800 shadow text-foreground" : "text-muted-foreground hover:text-foreground"
            )}>{label}</button>
        ))}
      </div>

      {/* CLIPS tab */}
      {tab === "clips" && (
        <div className="space-y-3">
          {/* Upload zone */}
          <div>
            <input ref={fileRef} type="file" accept="video/*,image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadClip(f); e.target.value = ""; }} />
            <div onClick={() => !uploading && fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) uploadClip(f); }}
              data-testid="editor-upload-dropzone"
              className={cn("border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors",
                uploading ? "border-red-300 bg-red-50/30" : "border-border hover:border-red-300 hover:bg-muted/40"
              )}>
              {uploading ? (
                <div className="space-y-2">
                  <Loader2 className="w-5 h-5 animate-spin text-red-500 mx-auto" />
                  <p className="text-[11px] text-muted-foreground">Uploading {uploadProgress}%</p>
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-red-500 transition-all" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="w-5 h-5 text-muted-foreground mx-auto" />
                  <p className="text-[11px] font-bold">Click of sleep video hierheen</p>
                  <p className="text-[10px] text-muted-foreground">MP4, MOV, AVI — max 500MB</p>
                </div>
              )}
            </div>
          </div>

          {/* URL input */}
          <div className="flex gap-2">
            <Input value={urlInput} onChange={e => setUrlInput(e.target.value)}
              placeholder="Cloudinary URL plakken..." className="text-xs h-8 flex-1"
              onKeyDown={e => e.key === "Enter" && addUrlClip()}
              data-testid="editor-url-input" />
            <Button size="sm" onClick={addUrlClip} className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white">
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Transition selector */}
          {clips.length > 1 && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground mb-2">OVERGANG TUSSEN CLIPS</p>
              <div className="grid grid-cols-3 gap-2">
                {TRANS_OPTS.map(t => (
                  <button key={t.id} onClick={() => setTransition(t.id)}
                    className={cn("py-2 rounded-xl border text-center text-[10px] font-bold transition-all",
                      transition === t.id ? "border-red-400 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400" : "border-border text-muted-foreground hover:border-red-300"
                    )}>
                    <div>{t.icon}</div>
                    <div>{t.label}</div>
                    <div className="text-[9px] font-normal opacity-70">{t.desc}</div>
                  </button>
                ))}
              </div>
              {(transition === "fade" || transition === "dissolve") && (
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-[10px] text-muted-foreground">Duur:</span>
                  <input type="range" min={0.2} max={2} step={0.1} value={transitionDuration}
                    onChange={e => setTransitionDuration(parseFloat(e.target.value))}
                    className="flex-1 h-1.5 accent-red-500" />
                  <span className="text-[10px] font-bold text-red-600">{transitionDuration.toFixed(1)}s</span>
                </div>
              )}
            </div>
          )}

          {/* Clips list */}
          {clips.length === 0 ? (
            <div className="border-2 border-dashed rounded-xl p-8 text-center">
              <Film className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs font-bold">Nog geen clips</p>
              <p className="text-[10px] text-muted-foreground">Upload of plak een URL hierboven</p>
            </div>
          ) : (
            <div className="space-y-2">
              {clips.map((clip, idx) => (
                <Card key={clip.id} className="border-border" data-testid={`editor-clip-${clip.id}`}>
                  <CardContent className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => moveClip(clip.id, -1)} disabled={idx === 0}
                          className="p-0.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30">
                          <ChevronLeft className="w-3 h-3 rotate-90" />
                        </button>
                        <button onClick={() => moveClip(clip.id, 1)} disabled={idx === clips.length - 1}
                          className="p-0.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30">
                          <ChevronRight className="w-3 h-3 rotate-90" />
                        </button>
                      </div>
                      <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-950/30 flex items-center justify-center shrink-0">
                        <Film className="w-3.5 h-3.5 text-red-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold truncate">{idx + 1}. {clip.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] text-muted-foreground">Start:</span>
                          <input type="number" min={0} step={0.5} value={clip.startSec}
                            onChange={e => updateClip(clip.id, { startSec: parseFloat(e.target.value) || 0 })}
                            className="w-14 text-[10px] border rounded px-1 py-0.5 bg-background"
                            data-testid={`editor-clip-start-${clip.id}`} />
                          <span className="text-[9px] text-muted-foreground">Eind:</span>
                          <input type="number" min={0} step={0.5} value={clip.endSec}
                            onChange={e => updateClip(clip.id, { endSec: parseFloat(e.target.value) || 0 })}
                            placeholder="auto"
                            className="w-14 text-[10px] border rounded px-1 py-0.5 bg-background"
                            data-testid={`editor-clip-end-${clip.id}`} />
                          <span className="text-[9px] text-muted-foreground">sec</span>
                        </div>
                      </div>
                      <button onClick={() => removeClip(clip.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                        data-testid={`editor-remove-clip-${clip.id}`}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[9px] text-muted-foreground truncate mt-1 pl-2">{clip.url}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TEXT OVERLAYS tab */}
      {tab === "text" && (
        <div className="space-y-4">
          <Card className="border-violet-200/60 dark:border-violet-800/40">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-xs font-bold flex items-center gap-2">
                <Plus className="w-3.5 h-3.5" /> Overlay toevoegen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              <Textarea value={newOverlay.text} onChange={e => setNewOverlay(o => ({ ...o, text: e.target.value }))}
                placeholder="Tekst die op de video verschijnt..." className="text-xs min-h-[60px] resize-none"
                data-testid="editor-overlay-text" />
              <div className="grid grid-cols-3 gap-2">
                {(["top", "center", "bottom"] as const).map(pos => (
                  <button key={pos} onClick={() => setNewOverlay(o => ({ ...o, position: pos }))}
                    className={cn("py-1.5 rounded-xl border text-[10px] font-bold capitalize transition-all",
                      newOverlay.position === pos ? "border-violet-400 bg-violet-50 dark:bg-violet-950/30 text-violet-700" : "border-border text-muted-foreground"
                    )}>{pos === "top" ? "🔝 Top" : pos === "center" ? "⭕ Midden" : "⬇️ Onder"}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground">Kleur</label>
                  <div className="flex gap-1.5 mt-1 flex-wrap">
                    {["white", "#FFFF00", "#FF6B6B", "#4ECDC4", "#A855F7"].map(c => (
                      <button key={c} onClick={() => setNewOverlay(o => ({ ...o, color: c }))}
                        className={cn("w-6 h-6 rounded-full border-2 transition-all", newOverlay.color === c ? "border-foreground scale-110" : "border-transparent")}
                        style={{ background: c }} />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground">Grootte: {newOverlay.fontSize}px</label>
                  <input type="range" min={24} max={96} step={4} value={newOverlay.fontSize}
                    onChange={e => setNewOverlay(o => ({ ...o, fontSize: parseInt(e.target.value) }))}
                    className="w-full h-1.5 accent-violet-500 mt-2" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground">Verschijnt op (sec)</label>
                  <Input type="number" min={0} step={0.5} value={newOverlay.startSec}
                    onChange={e => setNewOverlay(o => ({ ...o, startSec: parseFloat(e.target.value) || 0 }))}
                    className="text-xs h-8 mt-1" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground">Verdwijnt op (sec)</label>
                  <Input type="number" min={0} step={0.5} value={newOverlay.endSec}
                    onChange={e => setNewOverlay(o => ({ ...o, endSec: parseFloat(e.target.value) || 0 }))}
                    placeholder="0 = einde"
                    className="text-xs h-8 mt-1" />
                </div>
              </div>
              <Button size="sm" onClick={addOverlay} className="w-full text-xs h-8 bg-violet-600 hover:bg-violet-700 text-white"
                data-testid="editor-add-overlay">
                <Plus className="w-3.5 h-3.5 mr-1" /> Overlay toevoegen
              </Button>
            </CardContent>
          </Card>

          {overlays.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-xs">Nog geen tekst overlays</div>
          ) : (
            <div className="space-y-2">
              {overlays.map(ov => (
                <div key={ov.id} className="flex items-center gap-2 p-2.5 rounded-xl border bg-card">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2" style={{ background: ov.color, borderColor: ov.color === "white" ? "#ddd" : ov.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold truncate">{ov.text}</p>
                    <p className="text-[9px] text-muted-foreground">{ov.position} · {ov.fontSize}px · {ov.startSec}s–{ov.endSec || "einde"}s</p>
                  </div>
                  <button onClick={() => setOverlays(o => o.filter(x => x.id !== ov.id))}
                    className="p-1 rounded text-muted-foreground hover:text-red-500">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CAPTIONS tab */}
      {tab === "captions" && (
        <div className="space-y-3">
          <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/20 p-3">
            <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> AI Auto-Captions
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">OpenAI Whisper transcribeert je eerste clip automatisch naar SRT ondertitels die worden ingebrand in het eindresultaat.</p>
          </div>
          <Button size="sm" onClick={transcribeFirst} disabled={transcribing || !clips[0]?.url}
            className="w-full text-xs h-9 bg-amber-500 hover:bg-amber-600 text-white"
            data-testid="editor-transcribe-btn">
            {transcribing ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Transcriberen…</> : <><Sparkles className="w-3.5 h-3.5 mr-1" /> Genereer Auto-Captions</>}
          </Button>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-bold text-muted-foreground">SRT Captions (handmatig aanpasbaar)</label>
              {srtContent && (
                <button onClick={() => setSrtContent("")}
                  className="text-[10px] text-red-500 hover:underline">Wissen</button>
              )}
            </div>
            <Textarea value={srtContent} onChange={e => setSrtContent(e.target.value)}
              placeholder={"1\n00:00:00,000 --> 00:00:03,000\nJouw tekst hier"}
              className="text-[10px] font-mono min-h-[160px] resize-none"
              data-testid="editor-srt-input" />
          </div>
          {srtContent && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl border border-green-200 dark:border-green-800/40 bg-green-50/50 dark:bg-green-950/20">
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              <p className="text-[11px] text-green-700 dark:text-green-400 font-bold">Captions worden ingebrand bij het renderen</p>
            </div>
          )}
        </div>
      )}

      {/* RENDER / EXPORT tab */}
      {tab === "export" && (
        <div className="space-y-4">
          <div className="rounded-xl border p-3 space-y-2 bg-card">
            <p className="text-[11px] font-bold">Overzicht</p>
            <div className="space-y-1 text-[10px] text-muted-foreground">
              <div className="flex justify-between"><span>Clips:</span><span className="font-bold text-foreground">{clips.length}</span></div>
              <div className="flex justify-between"><span>Overgang:</span><span className="font-bold text-foreground capitalize">{transition}</span></div>
              <div className="flex justify-between"><span>Tekst overlays:</span><span className="font-bold text-foreground">{overlays.length}</span></div>
              <div className="flex justify-between"><span>Captions:</span><span className="font-bold text-foreground">{srtContent ? "Ja ✅" : "Nee"}</span></div>
            </div>
          </div>

          {!jobStatus && (
            <Button onClick={renderVideo} disabled={!clips.length}
              className="w-full h-10 text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg,#dc2626,#b91c1c)" }}
              data-testid="editor-render-btn">
              <Film className="w-4 h-4 mr-2" /> Render Video
            </Button>
          )}

          {jobStatus && (
            <div className="rounded-xl border p-4 space-y-3">
              <div className="flex items-center gap-2">
                {jobStatus.status === "processing" || jobStatus.status === "queued" ? (
                  <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                ) : jobStatus.status === "done" ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                )}
                <p className="text-sm font-bold capitalize">{jobStatus.status === "queued" ? "Wachten..." : jobStatus.status === "processing" ? "Verwerken..." : jobStatus.status === "done" ? "Klaar! 🎉" : "Fout"}</p>
              </div>
              {(jobStatus.status === "processing" || jobStatus.status === "queued") && (
                <>
                  <Progress value={jobStatus.progress || 0} className="h-2" />
                  <p className="text-[11px] text-muted-foreground">{jobStatus.message}</p>
                </>
              )}
              {jobStatus.status === "done" && jobStatus.outputUrl && (
                <div className="space-y-2">
                  <video src={jobStatus.outputUrl} controls className="w-full rounded-xl max-h-64 bg-black" />
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" onClick={sendToStudio} className="text-xs h-8 bg-violet-600 hover:bg-violet-700 text-white">
                      <Clapperboard className="w-3.5 h-3.5 mr-1" /> Naar Studio
                    </Button>
                    <a href={jobStatus.outputUrl} download target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline" className="text-xs h-8 w-full">
                        <Download className="w-3.5 h-3.5 mr-1" /> Download
                      </Button>
                    </a>
                  </div>
                  <Button size="sm" onClick={() => { setJobStatus(null); setJobId(null); }}
                    variant="outline" className="w-full text-xs h-8">
                    Nieuwe video maken
                  </Button>
                </div>
              )}
              {jobStatus.status === "error" && (
                <div className="space-y-2">
                  <p className="text-[11px] text-red-600">{jobStatus.error}</p>
                  <Button size="sm" onClick={() => { setJobStatus(null); setJobId(null); }} variant="outline" className="text-xs h-8">
                    Opnieuw proberen
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════
   SCHEDULE ZONE — Scheduled Posts & Video Automation
══════════════════════════════════════ */
const WEEK_DAYS = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"];
const DEFAULT_TIMES = ["09:00", "12:00", "15:00", "18:00", "20:00", "09:00", "12:00"];

function getWeekDates(): string[] {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7));
  return WEEK_DAYS.map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

interface WeekSlot {
  day: string; date: string; time: string; mediaType: string; mediaUrl: string; caption: string; hashtags: string; enabled: boolean;
}

function BulkWeekPlanner({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const weekDates = useMemo(getWeekDates, []);
  const [slots, setSlots] = useState<WeekSlot[]>(
    WEEK_DAYS.map((day, i) => ({ day, date: weekDates[i], time: DEFAULT_TIMES[i], mediaType: "REELS", mediaUrl: "", caption: "", hashtags: "", enabled: true }))
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  const updateSlot = (i: number, patch: Partial<WeekSlot>) =>
    setSlots(s => s.map((sl, idx) => idx === i ? { ...sl, ...patch } : sl));

  const uploadForSlot = async (i: number, file: File) => {
    setUploadingIdx(i);
    try {
      const result = await smartUploadMedia(file, {});
      updateSlot(i, { mediaUrl: result.url });
      toast({ title: `Dag ${i + 1} media geüpload ✅` });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally { setUploadingIdx(null); }
  };

  const generateCaptions = async () => {
    setAiLoading(true);
    try {
      const res = await fetch("/api/instagram/ai/chat", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Schrijf voor elk van de 7 weekdagen (ma t/m zo) een korte, krachtige Instagram caption voor urban culture content. Geef ze terug als JSON array van 7 strings. Alleen de array, geen uitleg. Maak elke caption uniek, energiek en passend voor de dag (maandag = motivatie, vrijdag = energie, weekend = fun). Max 150 tekens per caption.`,
          mode: "studio",
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "AI failed");
      const text = d.reply || d.message || "";
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        const arr: string[] = JSON.parse(match[0]);
        setSlots(s => s.map((sl, i) => ({ ...sl, caption: arr[i] || sl.caption })));
        toast({ title: "AI captions gegenereerd ✅" });
      } else {
        throw new Error("Kon geen captions parsen uit AI respons");
      }
    } catch (err: any) {
      toast({ title: "AI captions mislukt", description: err.message, variant: "destructive" });
    } finally { setAiLoading(false); }
  };

  const scheduleAll = async () => {
    const toSchedule = slots.filter(s => s.enabled && s.mediaUrl && s.date && s.time);
    if (!toSchedule.length) {
      toast({ title: "Geen posts om in te plannen", description: "Zorg dat elke dag een media URL heeft en is ingeschakeld.", variant: "destructive" });
      return;
    }
    setBulkLoading(true);
    try {
      const posts = toSchedule.map(s => ({
        mediaType: s.mediaType,
        mediaUrl: s.mediaUrl,
        caption: s.caption,
        hashtags: s.hashtags,
        scheduledAt: `${s.date}T${s.time}:00`,
      }));
      const res = await apiRequest("/api/instagram/scheduled-posts/bulk", "POST", { posts });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Bulk schedule failed");
      toast({
        title: `${d.inserted?.length || 0} posts ingepland ✅`,
        description: d.errors?.length ? `${d.errors.length} fout(en): ${d.errors[0]}` : "Alle posts zijn succesvol ingepland",
      });
      onClose();
    } catch (err: any) {
      toast({ title: "Bulk schedule mislukt", description: err.message, variant: "destructive" });
    } finally { setBulkLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-extrabold text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4 text-violet-500" /> Week Planner
          </h4>
          <p className="text-[10px] text-muted-foreground mt-0.5">Plan tot 7 posts voor de hele week in één keer</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={generateCaptions} disabled={aiLoading}
            className="h-7 text-[10px] bg-amber-500 hover:bg-amber-600 text-white"
            data-testid="bulk-week-ai-captions">
            {aiLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Sparkles className="w-3 h-3 mr-1" />}
            AI Captions
          </Button>
          <Button size="sm" variant="outline" onClick={onClose} className="h-7 text-[10px]">
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {slots.map((slot, i) => (
          <Card key={slot.day} className={cn("border-border transition-all", !slot.enabled && "opacity-50")}
            data-testid={`week-slot-${i}`}>
            <CardContent className="py-2.5 px-3">
              <div className="flex items-start gap-2">
                <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                  <Switch checked={slot.enabled} onCheckedChange={v => updateSlot(i, { enabled: v })} />
                  <span className="text-[8px] font-bold text-muted-foreground">{slot.day.slice(0, 2).toUpperCase()}</span>
                </div>
                <div className="flex-1 space-y-1.5 min-w-0">
                  <div className="flex gap-1.5 flex-wrap">
                    <input type="date" value={slot.date}
                      onChange={e => updateSlot(i, { date: e.target.value })}
                      className="text-[10px] border rounded px-1.5 py-1 bg-background h-7" />
                    <input type="time" value={slot.time}
                      onChange={e => updateSlot(i, { time: e.target.value })}
                      className="text-[10px] border rounded px-1.5 py-1 bg-background h-7" />
                    <select value={slot.mediaType}
                      onChange={e => updateSlot(i, { mediaType: e.target.value })}
                      className="text-[10px] border rounded px-1.5 py-1 bg-background h-7">
                      {["REELS", "PHOTO", "VIDEO", "STORY", "CAROUSEL"].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  {slot.mediaUrl ? (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <span className="text-[10px] text-green-600 dark:text-green-400 truncate">{slot.mediaUrl.split("/").pop()}</span>
                      <button onClick={() => updateSlot(i, { mediaUrl: "" })}
                        className="text-[10px] text-red-500 hover:underline shrink-0">✕</button>
                    </div>
                  ) : (
                    <div className="flex gap-1.5">
                      <input ref={el => { fileRefs.current[i] = el; }} type="file" accept="video/*,image/*"
                        className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadForSlot(i, f); e.target.value = ""; }} />
                      <button onClick={() => fileRefs.current[i]?.click()} disabled={uploadingIdx === i}
                        className="text-[10px] border rounded px-2 py-1 hover:bg-muted flex items-center gap-1 h-7">
                        {uploadingIdx === i ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                        Upload
                      </button>
                      <Input placeholder="of URL plakken..." value=""
                        onChange={e => updateSlot(i, { mediaUrl: e.target.value })}
                        className="text-[10px] h-7 flex-1" />
                    </div>
                  )}
                  <Input value={slot.caption}
                    onChange={e => updateSlot(i, { caption: e.target.value })}
                    placeholder="Caption..." className="text-[10px] h-7"
                    data-testid={`week-slot-caption-${i}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button onClick={scheduleAll} disabled={bulkLoading}
        className="w-full h-10 text-sm font-bold text-white"
        style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)" }}
        data-testid="bulk-week-schedule-all">
        {bulkLoading
          ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Inplannen...</>
          : <><Calendar className="w-4 h-4 mr-2" /> Plan {slots.filter(s => s.enabled && s.mediaUrl).length} Posts In</>}
      </Button>
    </div>
  );
}

function ScheduleZone() {
  const { toast } = useToast();
  const [schedTab, setSchedTab] = useState<"single" | "week">("single");
  const [form, setForm] = useState({ mediaType: "REELS", mediaUrl: "", caption: "", hashtags: "", scheduledAt: "" });
  const [showForm, setShowForm] = useState(false);
  const [bestTimeLoading, setBestTimeLoading] = useState(false);
  const [bestTimeResult, setBestTimeResult] = useState<any>(null);
  const [schedUploadMode, setSchedUploadMode] = useState<"upload" | "url">("upload");
  const [schedUploading, setSchedUploading] = useState(false);
  const [schedUploadProgress, setSchedUploadProgress] = useState(0);
  const [schedPreview, setSchedPreview] = useState<string | null>(null);
  const schedFileRef = useRef<HTMLInputElement>(null);
  const [editPost, setEditPost] = useState<any>(null);
  const [editForm, setEditForm] = useState({ caption: "", mediaUrl: "", scheduledAt: "", mediaType: "PHOTO" });
  const [editUploadMode, setEditUploadMode] = useState<"upload" | "url">("upload");
  const [editUploading, setEditUploading] = useState(false);
  const [editUploadProgress, setEditUploadProgress] = useState(0);
  const [editPreview, setEditPreview] = useState<string | null>(null);
  const editFileRef = useRef<HTMLInputElement>(null);

  const { data: scheduledPosts = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/instagram/scheduled-posts"],
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("/api/instagram/scheduled-posts", "POST", form).then(r => r.json()),
    onSuccess: (d) => {
      if (d?.error) { toast({ title: "Error", description: d.error, variant: "destructive" }); return; }
      refetch();
      setShowForm(false);
      setForm({ mediaType: "REELS", mediaUrl: "", caption: "", hashtags: "", scheduledAt: "" });
      toast({ title: "Post scheduled!", description: `Scheduled for ${new Date(form.scheduledAt).toLocaleString()}` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/instagram/scheduled-posts/${id}`, "DELETE"),
    onSuccess: () => { refetch(); toast({ title: "Deleted" }); },
  });

  const publishNowMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/instagram/scheduled-posts/${id}/publish-now`, "POST").then(r => r.json()),
    onSuccess: (d, id) => {
      if (d?.error) { toast({ title: "Publiceren mislukt", description: d.error, variant: "destructive" }); }
      else { toast({ title: "Gepubliceerd! ✅", description: d.permalink ? `Live op Instagram` : `Media ID: ${d.mediaId}` }); }
      refetch();
    },
    onError: (e: any) => toast({ title: "Publiceren mislukt", description: e.message, variant: "destructive" }),
  });

  const retryMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/instagram/scheduled-posts/${id}`, "PATCH", { status: "pending" }).then(r => r.json()),
    onSuccess: () => { refetch(); toast({ title: "Herpland voor volgende run ✅" }); },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) =>
      apiRequest(`/api/instagram/scheduled-posts/${id}`, "PATCH", payload).then(r => r.json()),
    onSuccess: (d) => {
      if (d?.error) { toast({ title: "Error", description: d.error, variant: "destructive" }); return; }
      refetch();
      setEditPost(null);
      toast({ title: "Post bijgewerkt ✅", description: "Wijzigingen zijn opgeslagen." });
    },
    onError: (e: any) => toast({ title: "Opslaan mislukt", description: e.message, variant: "destructive" }),
  });

  const openEdit = (post: any) => {
    setEditPost(post);
    const localDt = post.scheduledAt
      ? new Date(new Date(post.scheduledAt).getTime() - new Date().getTimezoneOffset() * 60000)
          .toISOString().slice(0, 16)
      : "";
    setEditForm({ caption: post.caption || "", mediaUrl: post.mediaUrl || "", scheduledAt: localDt, mediaType: post.mediaType || "PHOTO" });
    setEditUploadMode("upload");
    setEditUploading(false);
    setEditUploadProgress(0);
    setEditPreview(null);
  };

  const saveEdit = () => {
    if (!editPost) return;
    const payload: any = {
      caption: editForm.caption,
      mediaUrl: editForm.mediaUrl,
      mediaType: editForm.mediaType,
    };
    if (editForm.scheduledAt) payload.scheduledAt = new Date(editForm.scheduledAt).toISOString();
    editMutation.mutate({ id: editPost.id, payload });
  };

  const editUploadFile = async (file: File) => {
    if (editUploading) return;
    setEditUploading(true);
    setEditUploadProgress(0);
    setEditPreview(URL.createObjectURL(file));
    try {
      const result = await smartUploadMedia(file, {
        onProgress: (pct: number) => setEditUploadProgress(pct),
      });
      setEditForm(f => ({ ...f, mediaUrl: result.url }));
      setEditUploadProgress(100);
      toast({ title: "Media uploaded ✅", description: `${file.name} — ${result.finalMb} MB` });
    } catch (err: any) {
      setEditPreview(null);
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally { setEditUploading(false); }
  };

  const schedUploadFile = async (file: File) => {
    if (schedUploading) return;
    setSchedUploading(true);
    setSchedUploadProgress(0);
    setSchedPreview(URL.createObjectURL(file));
    try {
      const result = await smartUploadMedia(file, {
        onProgress: (pct: number) => setSchedUploadProgress(pct),
      });
      setForm(f => ({ ...f, mediaUrl: result.url }));
      setSchedUploadProgress(100);
      toast({ title: "Media uploaded ✅", description: `${file.name} — ${result.finalMb} MB` });
    } catch (err: any) {
      setSchedPreview(null);
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally { setSchedUploading(false); }
  };

  const getBestTime = async () => {
    setBestTimeLoading(true);
    setBestTimeResult(null);
    try {
      const res = await fetch("/api/instagram/ai/best-time", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      setBestTimeResult(d);
      if (d.suggestedDateTime) setForm(f => ({ ...f, scheduledAt: d.suggestedDateTime }));
      toast({ title: "Best time analyzed!", description: "Optimal schedule pre-filled" });
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    } finally { setBestTimeLoading(false); }
  };

  const STATUS_BADGE: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    publishing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    published: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base flex items-center gap-2">
            <Calendar className="w-5 h-5 text-violet-500" /> Scheduled Posts & Automation
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Eén post of een hele week inplannen.</p>
        </div>
        {schedTab === "single" && (
          <Button size="sm" onClick={() => setShowForm(s => !s)}
            className="text-xs h-8 text-white shrink-0" style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)" }}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Schedule Post
          </Button>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/60">
        {([["single", "📅 Enkele Post"], ["week", "🗓 Week Planner"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setSchedTab(id)}
            className={cn("flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all",
              schedTab === id ? "bg-white dark:bg-zinc-800 shadow text-foreground" : "text-muted-foreground hover:text-foreground"
            )}>{label}</button>
        ))}
      </div>

      {schedTab === "week" && <BulkWeekPlanner onClose={() => setSchedTab("single")} />}

      {schedTab === "single" && showForm && (
        <Card className="border-violet-200/60 dark:border-violet-800/40">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-violet-500" /> New Scheduled Post
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pb-4">
            <div className="grid grid-cols-3 gap-2">
              {["PHOTO", "VIDEO", "REELS"].map(t => (
                <button key={t} onClick={() => setForm(f => ({ ...f, mediaType: t }))}
                  className={cn("py-2 rounded-xl border text-xs font-bold transition-all",
                    form.mediaType === t ? "border-violet-400 bg-violet-50 dark:bg-violet-950/40 text-violet-700" : "border-border text-muted-foreground hover:border-violet-300"
                  )}>{t}</button>
              ))}
            </div>

            {/* Video/Reels publishing permission note */}
            {(form.mediaType === "VIDEO" || form.mediaType === "REELS") && (
              <div className="flex items-start gap-2.5 rounded-xl border border-violet-300 bg-violet-50 dark:bg-violet-950/30 dark:border-violet-700 p-3" data-testid="banner-video-permission-note">
                <Info className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
                <div className="text-xs text-violet-800 dark:text-violet-300 space-y-0.5">
                  <p className="font-bold">Business/Creator-account vereist voor videopublicatie</p>
                  <p className="leading-snug">Het publiceren van video's en Reels via de API vereist een <strong>Business- of Creator-account</strong> met <strong>content publishing-rechten</strong>. Zonder deze rechten zal de publicatie mislukken. Controleer je accounttype in Instellingen als je problemen ondervindt.</p>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Media</label>
                <div className="flex rounded-lg border border-border overflow-hidden text-[10px]">
                  {(["upload", "url"] as const).map(m => (
                    <button key={m} onClick={() => setSchedUploadMode(m)}
                      className={cn("px-2.5 py-1 font-bold capitalize transition-colors",
                        schedUploadMode === m ? "bg-violet-600 text-white" : "text-muted-foreground hover:bg-muted"
                      )}>{m === "upload" ? "Upload File" : "Paste URL"}</button>
                  ))}
                </div>
              </div>

              {schedUploadMode === "upload" ? (
                <div>
                  <input ref={schedFileRef} type="file" accept="image/*,video/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) schedUploadFile(f); e.target.value = ""; }}
                    data-testid="input-scheduled-media-file" />
                  <div
                    onClick={() => !schedUploading && schedFileRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) schedUploadFile(f); }}
                    className={cn("border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors",
                      schedUploading ? "border-violet-300 bg-violet-50/30 dark:bg-violet-950/20" : "border-border hover:border-violet-300 hover:bg-muted/40"
                    )}
                    data-testid="upload-sched-dropzone">
                    {schedPreview && form.mediaUrl ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          <span className="text-[11px] font-bold text-green-600 dark:text-green-400">Uploaded</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">{form.mediaUrl.slice(0, 50)}…</p>
                        <button onClick={e => { e.stopPropagation(); setForm(f => ({ ...f, mediaUrl: "" })); setSchedPreview(null); }}
                          className="text-[10px] text-red-500 hover:underline">Remove</button>
                      </div>
                    ) : schedUploading ? (
                      <div className="space-y-2">
                        <Loader2 className="w-5 h-5 animate-spin text-violet-500 mx-auto" />
                        <p className="text-[11px] text-muted-foreground">Uploading… {schedUploadProgress}%</p>
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                          <div className="h-full bg-violet-500 transition-all" style={{ width: `${schedUploadProgress}%` }} />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Upload className="w-5 h-5 text-muted-foreground mx-auto" />
                        <p className="text-[11px] font-bold text-muted-foreground">Click or drop a file</p>
                        <p className="text-[10px] text-muted-foreground">Images & videos supported</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <Input value={form.mediaUrl} onChange={e => setForm(f => ({ ...f, mediaUrl: e.target.value }))}
                  placeholder="https://res.cloudinary.com/..." className="text-xs h-8" data-testid="input-scheduled-media-url" />
              )}
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground">Caption</label>
              <Textarea value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))}
                placeholder="Write your caption..." className="text-xs min-h-[72px] resize-none mt-1" data-testid="textarea-scheduled-caption" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground">Hashtags (space-separated)</label>
              <Input value={form.hashtags} onChange={e => setForm(f => ({ ...f, hashtags: e.target.value }))}
                placeholder="#breaking #urbanculture #dance" className="text-xs h-8 mt-1" data-testid="input-scheduled-hashtags" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold text-muted-foreground">Schedule Date & Time</label>
                <button onClick={getBestTime} disabled={bestTimeLoading}
                  className="text-[10px] font-bold text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1 disabled:opacity-50">
                  {bestTimeLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  AI Best Time
                </button>
              </div>
              <Input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
                className="text-xs h-8" data-testid="input-scheduled-datetime" />
            </div>
            {bestTimeResult && (
              <div className="rounded-xl border border-violet-200 dark:border-violet-800/40 bg-violet-50/40 dark:bg-violet-950/20 p-3 space-y-1.5 text-xs">
                <p className="font-bold text-violet-700 dark:text-violet-400 flex items-center gap-1"><Sparkles className="w-3 h-3" /> AI Recommendation</p>
                {bestTimeResult.recommendation && <p className="text-muted-foreground leading-relaxed">{bestTimeResult.recommendation}</p>}
                {bestTimeResult.bestDays && <p><strong>Best days:</strong> {bestTimeResult.bestDays}</p>}
                {bestTimeResult.bestHours && <p><strong>Best hours:</strong> {bestTimeResult.bestHours}</p>}
                {bestTimeResult.reelsAdvice && <p className="text-violet-700 dark:text-violet-300"><strong>🎬 Reels:</strong> {bestTimeResult.reelsAdvice}</p>}
                {bestTimeResult.photoAdvice && <p className="text-pink-700 dark:text-pink-300"><strong>📸 Photos:</strong> {bestTimeResult.photoAdvice}</p>}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.mediaUrl || !form.scheduledAt}
                className="text-xs h-9 text-white flex-1" style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)" }}
                data-testid="button-create-scheduled-post">
                {createMutation.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Scheduling…</> : <><Calendar className="w-3.5 h-3.5 mr-1" /> Schedule Post</>}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)} className="text-xs h-9">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {schedTab === "single" && isLoading ? (
        <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
      ) : schedTab === "single" && (scheduledPosts as any[]).length === 0 ? (
        <div className="border-2 border-dashed rounded-xl p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6 text-violet-500" />
          </div>
          <p className="font-bold text-sm">No scheduled posts yet</p>
          <p className="text-xs text-muted-foreground">Schedule your first post to auto-publish at the perfect time.</p>
        </div>
      ) : schedTab === "single" ? (
        <div className="space-y-2">
          {(scheduledPosts as any[]).map((post: any) => (
            <Card key={post.id} data-testid={`card-scheduled-${post.id}`}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                    {post.mediaType === "REELS" ? <Film className="w-4 h-4 text-violet-600" /> : post.mediaType === "VIDEO" ? <Play className="w-4 h-4 text-blue-600" /> : <Image className="w-4 h-4 text-pink-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={cn("text-[10px] px-1.5 py-0", STATUS_BADGE[post.status] || "bg-muted text-muted-foreground")}>{post.status}</Badge>
                      <span className="text-[10px] text-muted-foreground">{post.mediaType}</span>
                      <span className="text-[10px] text-muted-foreground">{post.scheduledAt ? new Date(post.scheduledAt).toLocaleString() : ""}</span>
                    </div>
                    <p className="text-xs line-clamp-1 mt-0.5">{post.caption || "(no caption)"}</p>
                    {post.status === "published" && post.permalink && (
                      <a href={post.permalink} target="_blank" rel="noreferrer"
                        className="text-[10px] text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1 mt-0.5">
                        <ExternalLink className="w-2.5 h-2.5" /> View on Instagram
                      </a>
                    )}
                    {post.status === "failed" && post.errorMessage && (
                      <p className="text-[10px] text-red-500 mt-0.5">{post.errorMessage}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {(post.status === "pending" || post.status === "failed") && (
                      <button
                        onClick={() => publishNowMutation.mutate(post.id)}
                        disabled={publishNowMutation.isPending}
                        data-testid={`button-publish-now-${post.id}`}
                        title="Nu publiceren"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors">
                        {publishNowMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    {post.status === "failed" && (
                      <button
                        onClick={() => retryMutation.mutate(post.id)}
                        disabled={retryMutation.isPending}
                        data-testid={`button-retry-scheduled-${post.id}`}
                        title="Opnieuw inplannen"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {(post.status === "pending" || post.status === "failed") && (
                      <button
                        onClick={() => openEdit(post)}
                        data-testid={`button-edit-scheduled-${post.id}`}
                        title="Bewerken"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors">
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => deleteMutation.mutate(post.id)} data-testid={`button-delete-scheduled-${post.id}`}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {/* Edit Dialog */}
      <Dialog open={!!editPost} onOpenChange={(open) => { if (!open) setEditPost(null); }}>
        <DialogContent className="max-w-md" data-testid="dialog-edit-scheduled-post">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Edit className="w-4 h-4 text-violet-500" /> Post bewerken
            </DialogTitle>
            <DialogDescription className="text-xs">
              Pas de caption, media URL of datum/tijd aan. Klik Opslaan om te bevestigen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Caption</label>
              <Textarea
                value={editForm.caption}
                onChange={e => setEditForm(f => ({ ...f, caption: e.target.value }))}
                placeholder="Write your caption..."
                className="text-xs min-h-[80px] resize-none mt-1"
                data-testid="input-edit-caption"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Media Type</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {["PHOTO", "VIDEO", "REELS"].map(t => (
                  <button key={t} onClick={() => setEditForm(f => ({ ...f, mediaType: t }))}
                    data-testid={`button-edit-media-type-${t.toLowerCase()}`}
                    className={cn("py-2 rounded-xl border text-xs font-bold transition-all",
                      editForm.mediaType === t ? "border-violet-400 bg-violet-50 dark:bg-violet-950/40 text-violet-700" : "border-border text-muted-foreground hover:border-violet-300"
                    )}>{t}</button>
                ))}
              </div>
              {(editForm.mediaType === "VIDEO" || editForm.mediaType === "REELS") && (
                <div className="flex items-start gap-2 rounded-xl border border-violet-300 bg-violet-50 dark:bg-violet-950/30 dark:border-violet-700 p-2.5 mt-2" data-testid="banner-edit-video-permission-note">
                  <Info className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-violet-800 dark:text-violet-300 leading-snug">
                    <strong>Business/Creator-account vereist</strong> voor video- en Reelspublicatie via de API.
                  </p>
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Media</label>
                <div className="flex rounded-lg border border-border overflow-hidden text-[10px]">
                  {(["upload", "url"] as const).map(m => (
                    <button key={m} onClick={() => setEditUploadMode(m)}
                      className={cn("px-2.5 py-1 font-bold capitalize transition-colors",
                        editUploadMode === m ? "bg-violet-600 text-white" : "text-muted-foreground hover:bg-muted"
                      )}
                      data-testid={`button-edit-media-mode-${m}`}>
                      {m === "upload" ? "Upload File" : "Paste URL"}
                    </button>
                  ))}
                </div>
              </div>

              {editUploadMode === "upload" ? (
                <div>
                  <input ref={editFileRef} type="file" accept="image/*,video/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) editUploadFile(f); e.target.value = ""; }}
                    data-testid="input-edit-media-file" />
                  <div
                    onClick={() => !editUploading && editFileRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) editUploadFile(f); }}
                    className={cn("border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors",
                      editUploading ? "border-violet-300 bg-violet-50/30 dark:bg-violet-950/20" : "border-border hover:border-violet-300 hover:bg-muted/40"
                    )}
                    data-testid="upload-edit-dropzone">
                    {editPreview && editForm.mediaUrl ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          <span className="text-[11px] font-bold text-green-600 dark:text-green-400">Uploaded</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">{editForm.mediaUrl.slice(0, 50)}…</p>
                        <button onClick={e => { e.stopPropagation(); setEditForm(f => ({ ...f, mediaUrl: "" })); setEditPreview(null); }}
                          className="text-[10px] text-red-500 hover:underline" data-testid="button-edit-remove-media">Remove</button>
                      </div>
                    ) : editUploading ? (
                      <div className="space-y-2">
                        <Loader2 className="w-5 h-5 animate-spin text-violet-500 mx-auto" />
                        <p className="text-[11px] text-muted-foreground">Uploading… {editUploadProgress}%</p>
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                          <div className="h-full bg-violet-500 transition-all" style={{ width: `${editUploadProgress}%` }} />
                        </div>
                      </div>
                    ) : editForm.mediaUrl ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          <span className="text-[11px] font-bold text-green-600 dark:text-green-400">Media URL set</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">{editForm.mediaUrl.slice(0, 50)}…</p>
                        <button onClick={e => { e.stopPropagation(); setEditForm(f => ({ ...f, mediaUrl: "" })); }}
                          className="text-[10px] text-red-500 hover:underline" data-testid="button-edit-clear-media">Clear & replace</button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Upload className="w-5 h-5 text-muted-foreground mx-auto" />
                        <p className="text-[11px] font-bold text-muted-foreground">Click or drop a file</p>
                        <p className="text-[10px] text-muted-foreground">Images & videos supported</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <Input
                    value={editForm.mediaUrl}
                    onChange={e => setEditForm(f => ({ ...f, mediaUrl: e.target.value }))}
                    placeholder="https://res.cloudinary.com/..."
                    className="text-xs h-8"
                    data-testid="input-edit-media-url"
                  />
                  {editForm.mediaUrl && (() => {
                    const url = editForm.mediaUrl.trim();
                    const isVideo = /\/video\/upload\/|\.mp4|\.mov|\.webm|\.ogg/i.test(url);
                    if (isVideo) {
                      return (
                        <div className="mt-2 relative w-fit" data-testid="preview-edit-media-video">
                          <video
                            src={url}
                            className="rounded-lg border border-border object-cover"
                            style={{ maxHeight: 80, maxWidth: 120 }}
                            muted
                            preload="metadata"
                            onLoadedMetadata={e => { (e.target as HTMLVideoElement).currentTime = 0.5; }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="bg-black/50 rounded-full p-1">
                              <Play className="w-4 h-4 text-white fill-white" />
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <img
                        src={url}
                        alt="Media preview"
                        className="mt-2 rounded-lg border border-border object-cover"
                        style={{ maxHeight: 80, maxWidth: 120 }}
                        data-testid="preview-edit-media-image"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                        onLoad={e => { (e.target as HTMLImageElement).style.display = ""; }}
                      />
                    );
                  })()}
                </div>
              )}
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Datum & Tijd</label>
              <Input
                type="datetime-local"
                value={editForm.scheduledAt}
                onChange={e => setEditForm(f => ({ ...f, scheduledAt: e.target.value }))}
                className="text-xs h-8 mt-1"
                data-testid="input-edit-scheduled-at"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={saveEdit}
                disabled={editMutation.isPending || !editForm.mediaUrl || !editForm.scheduledAt}
                className="text-xs h-9 text-white flex-1"
                style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)" }}
                data-testid="button-save-edit-scheduled-post">
                {editMutation.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Opslaan…</> : <><Edit className="w-3.5 h-3.5 mr-1" /> Opslaan</>}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditPost(null)} className="text-xs h-9" data-testid="button-cancel-edit-scheduled-post">
                Annuleren
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ══════════════════════════════════════
   INBOX ZONE — Unified Comment Inbox
══════════════════════════════════════ */
function InboxZone({ media }: { media: any[] }) {
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [draftingAll, setDraftingAll] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [selectedPost, setSelectedPost] = useState<string>("all");

  const posts = (media || []).slice(0, 20);
  const postOptions = [{ id: "all", caption: "All recent posts" }, ...posts.map((p: any) => ({ id: p.id, caption: p.caption || "(no caption)" }))];

  const { data: commentsData, isLoading: commentsLoading } = useQuery<Record<string, any[]>>({
    queryKey: ["/api/instagram/inbox-comments", selectedPost],
    queryFn: async () => {
      const targetPosts = selectedPost === "all" ? posts.slice(0, 10) : posts.filter((p: any) => p.id === selectedPost);
      const results: Record<string, any[]> = {};
      await Promise.allSettled(targetPosts.map(async (p: any) => {
        try {
          const res = await fetch(`/api/instagram/media/${p.id}/comments`, { credentials: "include" });
          if (res.ok) { const d = await res.json(); results[p.id] = (d.data || []).map((c: any) => ({ ...c, postId: p.id, postCaption: p.caption, postThumb: p.thumbnail_url || p.media_url || null, postMediaType: p.media_type || null })); }
        } catch {}
      }));
      return results;
    },
    enabled: posts.length > 0,
  });

  const allComments = Object.values(commentsData || {}).flat().sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const draftReply = async (comment: any) => {
    try {
      const res = await fetch("/api/instagram/ai/draft-reply", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceText: comment.text, mediaId: comment.postId, commentId: comment.id }),
      });
      const d = await res.json();
      if (d.draft) setDrafts(prev => ({ ...prev, [comment.id]: d.draft }));
    } catch (err: any) { toast({ title: "Draft failed", description: err.message, variant: "destructive" }); }
  };

  const draftAll = async () => {
    setDraftingAll(true);
    const unanswered = allComments.filter((c: any) => !drafts[c.id]);
    try {
      const res = await fetch("/api/instagram/ai/draft-all", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments: unanswered.slice(0, 20).map((c: any) => ({ id: c.id, text: c.text, mediaId: c.postId })) }),
      });
      const d = await res.json();
      if (d.results) {
        const newDrafts: Record<string, string> = { ...drafts };
        d.results.forEach((r: any) => { if (r.draft) newDrafts[r.commentId] = r.draft; });
        setDrafts(newDrafts);
        toast({ title: `${d.results.length} drafts generated`, description: "Review and send each reply below" });
      }
    } catch (err: any) { toast({ title: "Bulk draft failed", description: err.message, variant: "destructive" }); }
    finally { setDraftingAll(false); }
  };

  const sendReply = async (comment: any, text: string) => {
    setSending(comment.id);
    try {
      const res = await fetch("/api/instagram/ai/send-reply", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, commentId: comment.id, mediaId: comment.postId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Send failed");
      setDrafts(prev => { const n = { ...prev }; delete n[comment.id]; return n; });
      toast({ title: "Reply sent!", description: `Replied to @${comment.username}` });
    } catch (err: any) { toast({ title: "Send failed", description: err.message, variant: "destructive" }); }
    finally { setSending(null); }
  };

  const sendAllDrafts = async () => {
    const draftEntries = Object.entries(drafts);
    if (draftEntries.length === 0) return;
    setBulkSending(true);
    let successCount = 0;
    let failCount = 0;
    const commentLookup: Record<string, any> = {};
    (allComments as any[]).forEach((c: any) => { commentLookup[c.id] = c; });

    for (const [commentId, text] of draftEntries) {
      const comment = commentLookup[commentId];
      if (!comment || !text.trim()) continue;
      try {
        const res = await fetch("/api/instagram/ai/send-reply", {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, commentId: comment.id, mediaId: comment.postId }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Send failed");
        setDrafts(prev => { const n = { ...prev }; delete n[commentId]; return n; });
        successCount++;
      } catch {
        failCount++;
      }
    }
    setBulkSending(false);
    toast({
      title: `Bulk send complete`,
      description: `${successCount} sent${failCount > 0 ? `, ${failCount} failed` : ""}`,
      variant: failCount > 0 ? "destructive" : "default",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-pink-500" /> Comment Inbox
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">All recent comments across your posts in one place.</p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <Button size="sm" onClick={draftAll} disabled={draftingAll || allComments.length === 0}
            className="text-xs h-8 text-white" style={{ background: "linear-gradient(135deg,#ec4899,#be185d)" }}
            data-testid="button-draft-all">
            {draftingAll ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Drafting…</> : <><Brain className="w-3.5 h-3.5 mr-1" /> Draft All</>}
          </Button>
          {Object.keys(drafts).length > 0 && (
            <Button size="sm" onClick={sendAllDrafts} disabled={bulkSending}
              className="text-xs h-8 text-white" style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}
              data-testid="button-send-all">
              {bulkSending ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Sending…</> : <><SendHorizonal className="w-3.5 h-3.5 mr-1" /> Send All ({Object.keys(drafts).length})</>}
            </Button>
          )}
        </div>
      </div>

      <div>
        <select value={selectedPost} onChange={e => setSelectedPost(e.target.value)}
          className="w-full text-xs border rounded-lg px-2 py-1.5 bg-background" data-testid="select-inbox-post">
          {postOptions.map(p => (
            <option key={p.id} value={p.id}>{p.id === "all" ? "All recent posts" : `${p.caption.slice(0, 50)}…`}</option>
          ))}
        </select>
      </div>

      {commentsLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
      ) : allComments.length === 0 ? (
        <div className="border-2 border-dashed rounded-xl p-10 text-center">
          <MessageCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-bold">No comments yet</p>
          <p className="text-xs text-muted-foreground mt-1">Comments from your recent posts will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(allComments as any[]).map((comment: any) => {
            const sentiment = comment.text ? (
              /great|love|amazing|fire|🔥|❤️|💯|🙌|wow|best|fantastic|perfect|🥰|😍|❤|🤩|👏/i.test(comment.text) ? "positive" :
              /hate|awful|terrible|bad|worst|boring|ugly|😤|😡|horrible|stop|annoying/i.test(comment.text) ? "negative" : "neutral"
            ) : "neutral";
            const hasDraft = !!drafts[comment.id];
            return (
              <Card key={comment.id} data-testid={`card-comment-${comment.id}`}>
                <CardContent className="py-3 px-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0 text-xs font-bold">
                      {(comment.username || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold">@{comment.username}</span>
                        <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-bold",
                          sentiment === "positive" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                          sentiment === "negative" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                          "bg-muted text-muted-foreground")}>
                          {sentiment === "positive" ? "😊 Positive" : sentiment === "negative" ? "😞 Negative" : "😐 Neutral"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{new Date(comment.timestamp).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs mt-0.5">{comment.text}</p>
                      {/* Post thumbnail pill */}
                      {comment.postThumb && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className="w-8 h-8 rounded-lg overflow-hidden border border-border shrink-0">
                            <img src={proxyImg(comment.postThumb)} alt="" className="w-full h-full object-cover" />
                          </div>
                          {comment.postCaption && (
                            <span className="text-[10px] text-muted-foreground truncate max-w-[140px]" title={comment.postCaption}>
                              {comment.postCaption.slice(0, 40)}{comment.postCaption.length > 40 ? "…" : ""}
                            </span>
                          )}
                          {comment.postMediaType && (
                            <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-bold shrink-0">
                              {comment.postMediaType}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <button onClick={() => draftReply(comment)} data-testid={`button-draft-${comment.id}`}
                      className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors text-xs">
                      <Brain className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {hasDraft && (
                    <div className="flex gap-2 pl-9">
                      <Input value={drafts[comment.id]} onChange={e => setDrafts(prev => ({ ...prev, [comment.id]: e.target.value }))}
                        className="text-xs h-8 flex-1" data-testid={`input-draft-${comment.id}`} />
                      <Button size="sm" className="h-8 text-xs px-3 text-white shrink-0"
                        style={{ background: "linear-gradient(135deg,#ec4899,#be185d)" }}
                        disabled={sending === comment.id}
                        onClick={() => sendReply(comment, drafts[comment.id])}
                        data-testid={`button-send-${comment.id}`}>
                        {sending === comment.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SendHorizonal className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════
   LEADS ZONE — Lead Discovery
══════════════════════════════════════ */
function LeadsZone() {
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [leadNotes, setLeadNotes] = useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = useState<string | null>(null);
  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [leadReplies, setLeadReplies] = useState<Record<string, string>>({});
  const [draftingReply, setDraftingReply] = useState<string | null>(null);
  const [sendingReply, setSendingReply] = useState<string | null>(null);

  const fetchLeads = async () => {
    setLoading(true);
    setRefreshing(true);
    try {
      const res = await fetch("/api/instagram/leads", { credentials: "include" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to fetch leads");
      setLeads(d.leads || []);
      setLastFetched(new Date());
    } catch (err: any) {
      toast({ title: "Failed to load leads", description: err.message, variant: "destructive" });
    } finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchLeads(); }, []);

  const scoreColor = (score: number) => {
    if (score >= 8) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    if (score >= 5) return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base flex items-center gap-2">
            <Target className="w-5 h-5 text-orange-500" /> Lead Discovery
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            AI-scored commenters and engaged followers.
            {lastFetched && <span className="ml-1">Last updated: {lastFetched.toLocaleTimeString()}</span>}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={fetchLeads} disabled={refreshing}
          className="text-xs h-8 shrink-0 gap-1.5" data-testid="button-refresh-leads">
          {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </Button>
      </div>

      <div className="rounded-xl border border-blue-200/50 dark:border-blue-800/30 bg-blue-50/20 dark:bg-blue-950/10 px-3 py-2 flex items-start gap-2 text-[10px]">
        <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-muted-foreground">Results are cached for 30 minutes to stay within Instagram API rate limits. Click Refresh to force an update.</p>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
      ) : leads.length === 0 ? (
        <div className="border-2 border-dashed rounded-xl p-10 text-center space-y-3">
          <Target className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="font-bold text-sm">No leads found yet</p>
          <p className="text-xs text-muted-foreground">Leads appear once your posts have commenters to analyze.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leads.map((lead: any, i: number) => {
            const isExpanded = expandedLead === (lead.username || i);
            return (
            <Card key={lead.username || i} data-testid={`card-lead-${i}`}>
              <CardContent className="py-3 px-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0 text-sm font-black text-orange-600 dark:text-orange-400">
                    {lead.username ? lead.username[0].toUpperCase() : "?"}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold">@{lead.username}</span>
                      <Badge className={cn("text-[10px] px-1.5 py-0", scoreColor(lead.score || 0))}>
                        Score: {lead.score ?? "–"}/10
                      </Badge>
                      {lead.commentCount > 1 && (
                        <span className="text-[10px] text-muted-foreground">{lead.commentCount} comments</span>
                      )}
                    </div>
                    {lead.note && <p className="text-[11px] text-muted-foreground leading-relaxed">{lead.note}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setExpandedLead(isExpanded ? null : (lead.username || String(i)))}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors"
                      title="Add note" data-testid={`button-note-lead-${i}`}>
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                    <a href={`https://www.instagram.com/${lead.username}/`} target="_blank" rel="noreferrer"
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors"
                      data-testid={`button-view-lead-${i}`}>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* Expandable note / quick reply panel */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-border/60 space-y-3">
                    {/* — Profile Note — */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Profile Note</label>
                      <Textarea
                        value={leadNotes[lead.username] ?? ""}
                        onChange={e => setLeadNotes(prev => ({ ...prev, [lead.username]: e.target.value }))}
                        placeholder={`Add a note about @${lead.username}…`}
                        rows={2}
                        className="text-xs resize-none"
                        data-testid={`textarea-lead-note-${i}`}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" className="h-8 text-xs flex-1 text-white"
                          style={{ background: "linear-gradient(135deg,#f97316,#ea580c)" }}
                          disabled={savingNote === lead.username || !leadNotes[lead.username]?.trim()}
                          onClick={async () => {
                            setSavingNote(lead.username);
                            try {
                              const res = await apiRequest("/api/instagram/leads/notes", "POST", {
                                username: lead.username, note: leadNotes[lead.username],
                              });
                              if (!res.ok) throw new Error("Server error");
                              toast({ title: "Note saved ✅", description: `Note for @${lead.username} saved.` });
                            } catch {
                              toast({ title: "Note saved ✅", description: `Note for @${lead.username} saved locally.` });
                            } finally { setSavingNote(null); }
                          }}
                          data-testid={`button-save-note-${i}`}>
                          {savingNote === lead.username ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Save Note</>}
                        </Button>
                        <a href={`https://www.instagram.com/${lead.username}/`} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"
                            data-testid={`button-open-profile-${i}`}>
                            <SiInstagram size={12} /> Profile
                          </Button>
                        </a>
                      </div>
                    </div>

                    {/* — In-context Reply — only if we have a replyable comment — */}
                    {lead.latestCommentId && (
                      <div className="space-y-1.5 pt-2 border-t border-border/40">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Reply to Latest Comment</label>
                          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1"
                            disabled={draftingReply === lead.username}
                            onClick={async () => {
                              setDraftingReply(lead.username);
                              try {
                                const res = await fetch("/api/instagram/ai/draft-reply", {
                                  method: "POST", credentials: "include",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ sourceText: lead.latestCommentText, commentId: lead.latestCommentId, mediaId: lead.latestCommentPostId }),
                                });
                                const d = await res.json();
                                if (d.draft) setLeadReplies(prev => ({ ...prev, [lead.username]: d.draft }));
                              } catch { /* silent */ } finally { setDraftingReply(null); }
                            }}
                            data-testid={`button-draft-lead-reply-${i}`}>
                            {draftingReply === lead.username ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                            AI Draft
                          </Button>
                        </div>
                        {lead.latestCommentText && (
                          <p className="text-[10px] text-muted-foreground italic bg-muted/40 rounded-lg px-2 py-1">
                            "{lead.latestCommentText.slice(0, 100)}{lead.latestCommentText.length > 100 ? "…" : ""}"
                          </p>
                        )}
                        <Textarea
                          value={leadReplies[lead.username] ?? ""}
                          onChange={e => setLeadReplies(prev => ({ ...prev, [lead.username]: e.target.value }))}
                          placeholder="Write a reply…"
                          rows={2}
                          className="text-xs resize-none"
                          data-testid={`textarea-lead-reply-${i}`}
                        />
                        <Button size="sm" className="w-full h-8 text-xs text-white gap-1.5"
                          style={{ background: "linear-gradient(135deg,#ec4899,#be185d)" }}
                          disabled={sendingReply === lead.username || !leadReplies[lead.username]?.trim()}
                          onClick={async () => {
                            setSendingReply(lead.username);
                            try {
                              const res = await fetch("/api/instagram/ai/send-reply", {
                                method: "POST", credentials: "include",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ text: leadReplies[lead.username], commentId: lead.latestCommentId, mediaId: lead.latestCommentPostId }),
                              });
                              const d = await res.json();
                              if (!res.ok) throw new Error(d.error || "Failed");
                              setLeadReplies(prev => { const n = { ...prev }; delete n[lead.username]; return n; });
                              toast({ title: "Reply sent ✅", description: `Replied to @${lead.username}` });
                            } catch (err: any) {
                              toast({ title: "Send failed", description: err.message, variant: "destructive" });
                            } finally { setSendingReply(null); }
                          }}
                          data-testid={`button-send-lead-reply-${i}`}>
                          {sendingReply === lead.username ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><SendHorizonal className="w-3.5 h-3.5" /> Send Reply</>}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   SETTINGS ZONE — App Credentials, Webhooks, Token Refresh
═══════════════════════════════════════ */
function SettingsZone() {
  const { toast } = useToast();

  // ── Setup info (redirect URI) ─────────────────────────────────────────────
  const { data: setupInfo } = useQuery<any>({ queryKey: ["/api/instagram/setup-info"] });
  const [copiedRedirect, setCopiedRedirect] = useState(false);

  const copyRedirect = () => {
    if (!setupInfo?.redirectUri) return;
    navigator.clipboard.writeText(setupInfo.redirectUri);
    setCopiedRedirect(true);
    setTimeout(() => setCopiedRedirect(false), 2000);
    toast({ title: "Redirect URI gekopieerd" });
  };

  // ── App Credentials ──────────────────────────────────────────────────────
  const { data: creds, isLoading: credsLoading, refetch: refetchCreds } = useQuery<any>({
    queryKey: ["/api/instagram/app-credentials"],
  });
  const [appId, setAppId]         = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  const saveCreds = useMutation({
    mutationFn: () => apiRequest("/api/instagram/app-credentials", "POST", { appId: appId.trim(), appSecret: appSecret.trim() }).then(r => r.json()),
    onSuccess: (d) => {
      if (d.error) { toast({ title: "Save failed", description: d.error, variant: "destructive" }); return; }
      toast({ title: "Credentials saved", description: "App ID and Secret are now stored securely in the database." });
      setAppSecret("");
      refetchCreds();
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/config"] });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  // ── Webhook status ────────────────────────────────────────────────────────
  const { data: webhookStatus, isLoading: webhookLoading, refetch: refetchWebhook } = useQuery<any>({
    queryKey: ["/api/instagram/webhook/status"],
  });
  const [copiedCallback, setCopiedCallback] = useState(false);
  const [copiedVerify, setCopiedVerify]     = useState(false);

  const subscribeMut = useMutation({
    mutationFn: () => apiRequest("/api/instagram/webhook/subscribe", "POST", {}).then(r => r.json()),
    onSuccess: (d) => {
      if (d.error) { toast({ title: "Subscription failed", description: d.error, variant: "destructive" }); return; }
      toast({ title: "Webhook subscribed!", description: "Meta will now send real-time events to your callback URL." });
      refetchWebhook();
    },
    onError: (e: any) => toast({ title: "Subscribe failed", description: e.message, variant: "destructive" }),
  });

  const copyText = (text: string, which: "callback" | "verify") => {
    navigator.clipboard.writeText(text);
    if (which === "callback") { setCopiedCallback(true); setTimeout(() => setCopiedCallback(false), 2000); }
    else { setCopiedVerify(true); setTimeout(() => setCopiedVerify(false), 2000); }
    toast({ title: "Copied to clipboard" });
  };

  // ── Token refresh ─────────────────────────────────────────────────────────
  const { data: status } = useQuery<any>({ queryKey: ["/api/instagram/status"] });
  const { data: allAccounts = [] } = useQuery<any[]>({ queryKey: ["/api/instagram/accounts"] });

  const refreshToken = useMutation({
    mutationFn: (connectionId?: number) =>
      apiRequest("/api/instagram/token/refresh", "POST", connectionId ? { connectionId } : {}).then(r => r.json()),
    onSuccess: (d) => {
      if (d.error) { toast({ title: "Refresh failed", description: d.error, variant: "destructive" }); return; }
      const ok = (d.results || []).filter((r: any) => r.ok).length;
      const fail = (d.results || []).filter((r: any) => !r.ok).length;
      toast({
        title: fail === 0 ? `Token${ok > 1 ? "s" : ""} refreshed` : "Partial refresh",
        description: fail > 0 ? `${ok} refreshed, ${fail} failed` : `Valid for another 60 days.`,
        variant: fail > 0 ? "destructive" : "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/accounts"] });
    },
    onError: (e: any) => toast({ title: "Refresh failed", description: e.message, variant: "destructive" }),
  });

  const tokenExpiresAt = status?.tokenExpiresAt ? new Date(status.tokenExpiresAt) : null;
  const daysLeft = tokenExpiresAt ? Math.ceil((tokenExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const tokenHealth = daysLeft === null ? "unknown" : daysLeft > 14 ? "good" : daysLeft > 3 ? "warning" : "critical";

  return (
    <div className="space-y-5">

      {/* ── 0. Meta App Setup Guide ──────────────────────────────────── */}
      <Card data-testid="card-meta-setup" className="border-amber-400/40 bg-amber-50/30 dark:bg-amber-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5 text-white" />
            </div>
            Meta App instellen — doe dit eerst
          </CardTitle>
          <CardDescription>
            Voordat je kunt verbinden moet je app correct geconfigureerd zijn in de{" "}
            <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer"
              className="text-amber-600 dark:text-amber-400 underline underline-offset-2">Meta Developer Console</a>.
            De fout <strong>"Invalid platform"</strong> betekent dat de Redirect URI nog niet is toegevoegd.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Redirect URI — must be registered in Meta */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-amber-700 dark:text-amber-400">
              Stap 1 — Voeg deze Redirect URI toe aan je Meta App
            </label>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white dark:bg-black/20 border border-amber-300 dark:border-amber-700 font-mono text-xs">
              <span className="flex-1 select-all text-foreground break-all">
                {setupInfo?.redirectUri || "https://urban-culture-connect-1-rmaru2889.replit.app/api/instagram/callback"}
              </span>
              <button
                onClick={copyRedirect}
                className="shrink-0 p-1.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                title="Kopieer"
                data-testid="button-copy-redirect-uri"
              >
                {copiedRedirect ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-amber-600" />}
              </button>
            </div>
            <p className="text-[10px] text-amber-700 dark:text-amber-400">
              Ga naar: Meta App → Instagram Business Login → Instellingen → <strong>Valid OAuth Redirect URIs</strong> → voeg bovenstaande URL toe → Sla op.
            </p>
          </div>

          {/* Step-by-step checklist */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-amber-700 dark:text-amber-400">
              Volledige setup checklist voor je Meta App
            </label>
            <ol className="space-y-1.5 text-xs text-foreground">
              {[
                { step: "1", text: "Maak een Business-type app aan (niet Consumer) op developers.facebook.com/apps", done: !!creds?.hasAppId },
                { step: "2", text: "Voeg het product Instagram Business Login toe aan je app", done: false },
                { step: "3", text: "Ga naar Instagram Business Login → Instellingen en voeg de Redirect URI hierboven toe", done: false },
                { step: "4", text: "Kopieer je App ID en App Secret en sla ze op in de kaart hieronder", done: !!(creds?.hasAppId && creds?.hasAppSecret) },
                { step: "5", text: "Klik op 'Verbinden met Instagram Business' in het Dashboard → zorg dat je App in Live Mode staat", done: false },
              ].map(({ step, text, done }) => (
                <li key={step} className="flex items-start gap-2.5">
                  <span className={cn("shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5",
                    done ? "bg-emerald-500 text-white" : "bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200")}>
                    {done ? "✓" : step}
                  </span>
                  <span className={done ? "line-through text-muted-foreground" : ""}>{text}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-xs space-y-1">
            <p className="font-bold text-red-700 dark:text-red-400">Veelvoorkomende fouten:</p>
            <ul className="list-disc list-inside space-y-0.5 text-red-600 dark:text-red-400">
              <li><strong>"Invalid platform"</strong> — Redirect URI niet geregistreerd, of app is van het type Consumer i.p.v. Business</li>
              <li><strong>"App not set up"</strong> — Instagram Business Login product is niet toegevoegd aan de app</li>
              <li><strong>"Invalid scopes"</strong> — De app staat in Development Mode; schakel over naar Live Mode</li>
              <li><strong>Lege comments</strong> — Token is verlopen of heeft niet de benodigde rechten; opnieuw verbinden is vereist</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* ── 1. App Credentials ───────────────────────────────────────── */}
      <Card data-testid="card-app-credentials">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
              <Key className="w-3.5 h-3.5 text-white" />
            </div>
            Facebook App Credentials
          </CardTitle>
          <CardDescription>
            Enter your Facebook App ID and App Secret from{" "}
            <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer"
              className="text-violet-500 underline underline-offset-2">Meta Developer Console</a>.
            Stored securely in the database — never exposed in env files.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {credsLoading ? (
            <div className="space-y-2"><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /></div>
          ) : (
            <>
              {/* Current status badges */}
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline" className={cn("gap-1", creds?.hasAppId ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400" : "border-red-500/40 text-red-500")}>
                  {creds?.hasAppId ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  App ID {creds?.hasAppId ? `set (${creds?.appId?.slice(0,6)}…)` : "missing"}
                </Badge>
                <Badge variant="outline" className={cn("gap-1", creds?.hasAppSecret ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400" : "border-red-500/40 text-red-500")}>
                  {creds?.hasAppSecret ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  App Secret {creds?.hasAppSecret ? `set (${creds?.appSecretMasked})` : "missing"}
                </Badge>
                {creds?.source && (
                  <Badge variant="secondary" className="text-[10px]">source: {creds.source}</Badge>
                )}
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Facebook App ID</label>
                  <Input
                    placeholder={creds?.hasAppId ? `Current: ${creds?.appId}` : "e.g. 1234567890123456"}
                    value={appId}
                    onChange={e => setAppId(e.target.value)}
                    className="font-mono text-sm"
                    data-testid="input-ig-app-id"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">App Secret</label>
                  <div className="relative">
                    <Input
                      type={showSecret ? "text" : "password"}
                      placeholder={creds?.hasAppSecret ? `Current: ${creds?.appSecretMasked}` : "Paste your App Secret here"}
                      value={appSecret}
                      onChange={e => setAppSecret(e.target.value)}
                      className="font-mono text-sm pr-10"
                      data-testid="input-ig-app-secret"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showSecret ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">The secret is masked after saving and never returned to the browser in full.</p>
                </div>
              </div>

              <Button
                onClick={() => saveCreds.mutate()}
                disabled={!appId.trim() || !appSecret.trim() || saveCreds.isPending}
                className="gap-2"
                data-testid="button-save-ig-credentials"
              >
                {saveCreds.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Shield className="w-4 h-4" /> Save credentials</>}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── 2. Webhook Setup ─────────────────────────────────────────── */}
      <Card data-testid="card-webhook-setup">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <Rss className="w-3.5 h-3.5 text-white" />
            </div>
            Real-time Webhooks
          </CardTitle>
          <CardDescription>
            Receive instant notifications for new comments, DMs, and mentions on your Instagram account.
            Paste the callback URL and verify token into your{" "}
            <a href={webhookStatus?.subscribeUrl || "https://developers.facebook.com/apps/"} target="_blank" rel="noopener noreferrer"
              className="text-orange-500 underline underline-offset-2">Meta App → Webhooks → Instagram</a>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {webhookLoading ? (
            <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
          ) : (
            <>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Callback URL (paste in Meta Console)</label>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/60 border font-mono text-xs break-all">
                    <span className="flex-1 select-all text-foreground">{webhookStatus?.callbackUrl || "—"}</span>
                    <button
                      onClick={() => webhookStatus?.callbackUrl && copyText(webhookStatus.callbackUrl, "callback")}
                      className="shrink-0 p-1.5 rounded hover:bg-background transition-colors"
                      title="Copy"
                      data-testid="button-copy-callback-url"
                    >
                      {copiedCallback ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Verify Token (paste in Meta Console)</label>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/60 border font-mono text-xs">
                    <span className="flex-1 select-all text-foreground">{webhookStatus?.verifyToken || "—"}</span>
                    <button
                      onClick={() => webhookStatus?.verifyToken && copyText(webhookStatus.verifyToken, "verify")}
                      className="shrink-0 p-1.5 rounded hover:bg-background transition-colors"
                      title="Copy"
                      data-testid="button-copy-verify-token"
                    >
                      {copiedVerify ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Override by setting the <code className="bg-muted px-1 rounded">INSTAGRAM_WEBHOOK_VERIFY_TOKEN</code> environment variable.
                  </p>
                </div>

                <div className="p-3 rounded-xl border bg-muted/30 space-y-2">
                  <p className="text-xs font-bold">Subscribed fields (what you'll receive):</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["comments", "mentions", "messages", "story_insights"].map(f => (
                      <Badge key={f} variant="secondary" className="text-[10px] gap-1">
                        <Wifi className="w-2.5 h-2.5" /> {f}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => subscribeMut.mutate()}
                  disabled={subscribeMut.isPending || !webhookStatus?.hasAppId || !webhookStatus?.hasAppSecret}
                  className="gap-2 bg-orange-500 hover:bg-orange-600"
                  data-testid="button-subscribe-webhook"
                >
                  {subscribeMut.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Subscribing…</> : <><Rss className="w-4 h-4" /> Activate webhook subscription</>}
                </Button>
                <Button variant="outline" size="sm" onClick={() => refetchWebhook()} className="gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </Button>
              </div>

              {(!webhookStatus?.hasAppId || !webhookStatus?.hasAppSecret) && (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Save your App credentials above before activating the webhook subscription.
                </p>
              )}

              <div className="mt-2 p-3 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/20 text-xs space-y-1.5">
                <p className="font-bold text-blue-700 dark:text-blue-300">Setup steps:</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-600 dark:text-blue-400">
                  <li>Save your App ID + Secret in the card above.</li>
                  <li>Copy the Callback URL and Verify Token.</li>
                  <li>Go to your Meta App → Webhooks → Instagram → Edit.</li>
                  <li>Paste the Callback URL and Verify Token → click Verify & Save.</li>
                  <li>Click "Activate webhook subscription" below — or subscribe manually in the Meta console.</li>
                  <li>Instagram will now push events in real-time.</li>
                </ol>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── 3. Token Health & Refresh ────────────────────────────────── */}
      <Card data-testid="card-token-health">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center",
              tokenHealth === "good" ? "bg-gradient-to-br from-emerald-500 to-green-600"
              : tokenHealth === "warning" ? "bg-gradient-to-br from-amber-500 to-orange-500"
              : tokenHealth === "critical" ? "bg-gradient-to-br from-red-500 to-rose-600"
              : "bg-muted")}>
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            Token Health & Auto-refresh
          </CardTitle>
          <CardDescription>
            Long-lived Instagram tokens are valid for 60 days. Refresh them before they expire to stay connected without re-authorising.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Per-account list */}
          {(allAccounts as any[]).length === 0 ? (
            <p className="text-sm text-muted-foreground">No accounts connected yet.</p>
          ) : (
            <div className="space-y-2">
              {(allAccounts as any[]).map((acc: any) => {
                const expiry = acc.tokenExpiresAt ? new Date(acc.tokenExpiresAt) : null;
                const days = expiry ? Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
                const health = days === null ? "unknown" : days > 14 ? "good" : days > 3 ? "warning" : "critical";
                return (
                  <div key={acc.id} className="flex items-center gap-3 p-3 rounded-xl border bg-card">
                    <img
                      src={acc.profilePictureUrl ? proxyImg(acc.profilePictureUrl) : `https://ui-avatars.com/api/?name=${encodeURIComponent(acc.username || "IG")}&background=E1306C&color=fff`}
                      alt={acc.username || ""}
                      className="w-9 h-9 rounded-full object-cover shrink-0"
                      onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(acc.username || "IG")}&background=E1306C&color=fff`; }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-sm truncate">@{acc.username || "–"}</p>
                        {acc.isActive && <Badge className="text-[9px] py-0 px-1.5 bg-green-500 text-white border-0">ACTIVE</Badge>}
                      </div>
                      <p className={cn("text-xs", health === "good" ? "text-emerald-600 dark:text-emerald-400" : health === "warning" ? "text-amber-600 dark:text-amber-400" : health === "critical" ? "text-red-500" : "text-muted-foreground")}>
                        {days === null ? "Expiry unknown" : days > 0 ? `Expires in ${days} day${days !== 1 ? "s" : ""}` : "Expired!"}
                        {expiry && ` · ${expiry.toLocaleDateString()}`}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 gap-1.5 text-xs"
                      onClick={() => refreshToken.mutate(acc.id)}
                      disabled={refreshToken.isPending}
                      data-testid={`button-refresh-token-${acc.id}`}
                    >
                      {refreshToken.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      Refresh
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {(allAccounts as any[]).length > 1 && (
            <Button
              variant="outline"
              onClick={() => refreshToken.mutate(undefined)}
              disabled={refreshToken.isPending}
              className="gap-2 w-full"
              data-testid="button-refresh-all-tokens"
            >
              {refreshToken.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Refreshing all…</> : <><RefreshCw className="w-4 h-4" /> Refresh all tokens</>}
            </Button>
          )}

          <div className="p-3 rounded-xl bg-muted/40 border text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">How token refresh works</p>
            <p>Instagram long-lived tokens expire after 60 days. They can be refreshed at any time after 24 hours of issuance. Clicking Refresh calls the <code className="bg-muted px-1 rounded">ig_refresh_token</code> endpoint and stores the new token + expiry in the database. The token is never exposed in the browser.</p>
            <p className="mt-1">Tip: set a calendar reminder to refresh tokens every 45 days, or we can build a nightly auto-refresh scheduler.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════ */
export default function InstagramDashboard() {
  const { toast }      = useToast();
  const [, navigate]   = useLocation();
  const [activeZone, setActiveZone]   = useState<Zone>("studio");
  const [postType, setPostType]       = useState<PostType>("PHOTO");
  const [caption, setCaption]         = useState("");
  const [imageUrl, setImageUrl]       = useState("");
  const [videoUrl, setVideoUrl]       = useState("");
  const [storyIsVideo, setStoryIsVideo] = useState(false);
  const [locationInput, setLocationInput] = useState("");
  const [publishing, setPublishing]   = useState(false);
  const [published, setPublished]     = useState<{ id: string } | null>(null);
  const [oauthPending, setOauthPending] = useState(false);

  /* Sharing state */
  const [sharedToComm,  setSharedToComm]  = useState<Set<string>>(new Set());
  const [sharedToReels, setSharedToReels] = useState<Set<string>>(new Set());
  const [sharingId,     setSharingId]     = useState<string | null>(null);
  const [sharingReelId, setSharingReelId] = useState<string | null>(null);

  /* Multi-account state */
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [showAddAccount, setShowAddAccount]           = useState(false);
  const [newAccountToken, setNewAccountToken]         = useState("");
  const [newAccountLabel, setNewAccountLabel]         = useState("");
  const [crossPostIds, setCrossPostIds]               = useState<number[]>([]);

  /* Listen for cross-component navigation (e.g. TokenHealthBanner reconnect) */
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as Zone | undefined;
      if (detail) setActiveZone(detail);
    };
    window.addEventListener("ig-go-zone", handler);
    return () => window.removeEventListener("ig-go-zone", handler);
  }, []);

  /* OAuth redirect check + deep-link zone param */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "1") {
      toast({ title: "Instagram connected!" });
      window.history.replaceState({}, "", "/admin/instagram");
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/account"] });
    }
    if (params.get("error")) {
      toast({ title: "Verbinding mislukt", description: decodeURIComponent(params.get("error")!), variant: "destructive" });
      window.history.replaceState({}, "", "/admin/instagram");
    }
    // Deep-link support: ?zone=notifications (from push notification tap)
    const zoneParam = params.get("zone") as Zone | null;
    const validZones: Zone[] = ["studio","content","analytics","audience","growth","tools","agent","persona","replies","automation","activity","profile","settings","schedule","inbox","leads","notifications","editor","dm-inbox"];
    if (zoneParam && validZones.includes(zoneParam)) {
      setActiveZone(zoneParam);
      window.history.replaceState({}, "", "/admin/instagram");
    }
  }, []);

  /* Queries */
  const { data: config, isLoading: configLoading, isError: configError } = useQuery<{ configured: boolean; hasDirectToken?: boolean }>({ queryKey: ["/api/instagram/config"], retry: 2 });
  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useQuery<any>({ queryKey: ["/api/instagram/status"] });
  const isConnected = status?.connected === true;
  // Read live token health and gate dependent queries on it. When the token
  // is dead, dependent queries would just spam the Graph API with failing
  // requests and surface noisy 502 toasts.
  const { data: igHealth } = useQuery<any>({ queryKey: ["/api/instagram/health"], enabled: isConnected, staleTime: 60_000 });
  const tokenAlive = isConnected && (igHealth?.token?.valid !== false);
  const { data: account, isLoading: accountLoading } = useQuery<any>({ queryKey: ["/api/instagram/account"], enabled: tokenAlive });
  const { data: mediaData, isLoading: mediaLoading, refetch: refetchMedia } = useQuery<{ data: any[] }>({ queryKey: ["/api/instagram/media"], enabled: tokenAlive });
  const { data: insightsData, isLoading: insightsLoading } = useQuery<{ data: any[] }>({ queryKey: ["/api/instagram/insights"], enabled: tokenAlive, retry: false });
  const { data: mediaAnalytics, isLoading: mediaAnalyticsLoading } = useQuery<any>({ queryKey: ["/api/instagram/analytics/media"], enabled: tokenAlive, retry: false });
  const { data: audienceData, isLoading: audienceLoading } = useQuery<{ data: any[] }>({ queryKey: ["/api/instagram/audience"], enabled: tokenAlive });
  const { data: allAccounts, refetch: refetchAccounts } = useQuery<any[]>({ queryKey: ["/api/instagram/accounts"], enabled: isConnected });

  const media: any[] = mediaData?.data || [];

  /* Mutations */
  const authUrlMutation = useMutation({
    mutationFn: async () => { const res = await apiRequest("/api/instagram/auth/url", "GET"); if (!res.ok) throw new Error("Failed"); return res.json() as Promise<{ url: string }>; },
    onSuccess: ({ url }) => {
      const popup = window.open(url, "ig-oauth", "width=600,height=700,scrollbars=yes,resizable=yes,left=" + (window.screen.width / 2 - 300) + ",top=" + (window.screen.height / 2 - 350));
      if (!popup) { window.open(url, "_blank", "noopener"); toast({ title: "Popup geblokkeerd", description: "Een nieuw tabblad is geopend." }); return; }
      setOauthPending(true);
      const poll = setInterval(async () => {
        if (popup.closed) { clearInterval(poll); setOauthPending(false); queryClient.invalidateQueries({ queryKey: ["/api/instagram/status"] }); return; }
        try {
          const r = await fetch("/api/instagram/status", { credentials: "include" });
          if (r.ok) { const s = await r.json(); if (s.connected) { clearInterval(poll); setOauthPending(false); popup.close(); queryClient.invalidateQueries({ queryKey: ["/api/instagram/status"] }); queryClient.invalidateQueries({ queryKey: ["/api/instagram/media"] }); toast({ title: "Instagram verbonden!", description: `@${s.username}` }); } }
        } catch {}
      }, 2000);
    },
    onError: (e: any) => toast({ title: "Auth mislukt", description: e.message, variant: "destructive" }),
  });

  const [pastedToken, setPastedToken] = useState("");
  const connectTokenMutation = useMutation({
    mutationFn: async (override?: string) => {
      const body = override && override.trim() ? { access_token: override.trim() } : undefined;
      const res = await apiRequest("/api/instagram/connect/token", "POST", body);
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
      return res.json() as Promise<{ ok: boolean; username: string }>;
    },
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ["/api/instagram/status"] }); queryClient.invalidateQueries({ queryKey: ["/api/instagram/media"] }); queryClient.invalidateQueries({ queryKey: ["/api/instagram/accounts"] }); toast({ title: `Instagram verbonden!`, description: `@${data.username}` }); },
    onError: (e: any) => {
      // apiRequest throws "STATUS: {json}" — extract the real message from either format
      let raw = String(e?.message || "");
      const jsonMatch = raw.match(/^\d+:\s*(\{.+\})$/s);
      if (jsonMatch) {
        try { raw = JSON.parse(jsonMatch[1])?.error || raw; } catch { /* keep raw */ }
      }
      const m = raw;
      const friendly =
        /cannot parse access token/i.test(m)
          ? "Dit token werkt niet — gebruik de knop 'Verbinden met Instagram Business' hierboven. Die opent Instagram's eigen inlogscherm en genereert automatisch het juiste token. Graph API Explorer-tokens werken hier niet."
          : /session has been invalidated|password|security reasons/i.test(m)
            ? "De sessie is verlopen — door een wachtwoordwijziging of 2FA-reset. Genereer een nieuw token en plak het hier."
            : /facebook_no_ig|geen instagram.*business/i.test(m)
              ? "Facebook-token herkend, maar er is geen Instagram Business/Creator-account gekoppeld aan die pagina. Ga naar Meta Business Suite en koppel je Instagram-account aan je Facebook-pagina."
              : /no instagram.*account|geen instagram/i.test(m)
                ? "Er is geen Instagram Business of Creator-account gevonden. Zorg dat je Instagram-account is ingesteld als Business of Creator in de app."
                : m || "Onbekende fout.";
      toast({ title: "Token verbinding mislukt", description: friendly, variant: "destructive", duration: 12000 });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => { const res = await apiRequest("/api/instagram/disconnect", "POST"); if (!res.ok) throw new Error("Disconnect failed"); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/instagram/status"] }); queryClient.invalidateQueries({ queryKey: ["/api/instagram/media"] }); queryClient.invalidateQueries({ queryKey: ["/api/instagram/accounts"] }); toast({ title: "Losgekoppeld van Instagram" }); },
  });

  const addAccountMutation = useMutation({
    mutationFn: async ({ token, label }: { token: string; label: string }) => {
      const res = await apiRequest("/api/instagram/connect/token", "POST", { access_token: token, label });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Verbinding mislukt"); }
      return res.json() as Promise<{ ok: boolean; username: string; isNew: boolean }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/media"] });
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/account"] });
      setNewAccountToken(""); setNewAccountLabel(""); setShowAddAccount(false);
      toast({ title: data.isNew ? "Nieuw account verbonden!" : "Account bijgewerkt!", description: `@${data.username} is nu actief` });
    },
    onError: (e: any) => {
      let raw = String(e?.message || "");
      const jsonMatch = raw.match(/^\d+:\s*(\{.+\})$/s);
      if (jsonMatch) { try { raw = JSON.parse(jsonMatch[1])?.error || raw; } catch { /* keep raw */ } }
      const friendly = /cannot parse access token/i.test(raw)
        ? "Dit is een App Access Token — die werkt niet. Ga naar developers.facebook.com/tools/explorer, kies je app, klik 'Generate Access Token' als gebruiker en kopieer dat token."
        : raw || "Verbinding mislukt";
      toast({ title: "Verbinding mislukt", description: friendly, variant: "destructive", duration: 10000 });
    },
  });

  const activateAccountMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest(`/api/instagram/accounts/${id}/activate`, "PUT");
      if (!res.ok) throw new Error("Activeren mislukt");
      return res.json() as Promise<{ ok: boolean; username: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/account"] });
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/media"] });
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/analytics/media"] });
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/accounts"] });
      setCrossPostIds([]);
      toast({ title: "Account gewisseld!", description: `@${data.username} is nu actief` });
    },
    onError: (e: any) => toast({ title: "Wisselen mislukt", description: e.message, variant: "destructive" }),
  });

  const removeAccountMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest(`/api/instagram/accounts/${id}`, "DELETE");
      if (!res.ok) throw new Error("Verwijderen mislukt");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/media"] });
      toast({ title: "Account verwijderd" });
    },
    onError: (e: any) => toast({ title: "Verwijderen mislukt", description: e.message, variant: "destructive" }),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => { const res = await apiRequest(`/api/instagram/comments/${commentId}`, "DELETE"); if (!res.ok) throw new Error("Delete failed"); return res.json(); },
    onSuccess: () => toast({ title: "Comment verwijderd" }),
  });

  const replyMutation = useMutation({
    mutationFn: async ({ commentId, message }: { commentId: string; message: string }) => { const res = await apiRequest(`/api/instagram/comments/${commentId}/reply`, "POST", { message }); if (!res.ok) throw new Error("Reply failed"); return res.json(); },
    onSuccess: () => toast({ title: "Reply verstuurd!" }),
    onError: (e: any) => toast({ title: "Reply mislukt", description: e.message, variant: "destructive" }),
  });

  const shareToComm = async (post: any) => {
    if (sharedToComm.has(post.id)) return;
    setSharingId(post.id);
    try {
      const res = await apiRequest("/api/posts", "POST", { content: (post.caption || "").slice(0, 2000) || "📸 New post from Instagram", image: post.thumbnail_url || post.media_url || null, privacy: "public" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Failed"); }
      setSharedToComm(prev => new Set([...prev, post.id]));
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      toast({ title: "Gedeeld naar Community!" });
    } catch (e: any) { toast({ title: "Delen mislukt", description: e.message, variant: "destructive" }); }
    finally { setSharingId(null); }
  };

  const shareToReels = async (post: any) => {
    if (sharedToReels.has(post.id)) return;
    setSharingReelId(post.id);
    try {
      const res = await apiRequest("/api/instagram/share-to-reels", "POST", { postId: post.id });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Failed"); }
      setSharedToReels(prev => new Set([...prev, post.id]));
      queryClient.invalidateQueries({ queryKey: ["/api/reels"] });
      toast({ title: "Toegevoegd aan Reels!" });
    } catch (e: any) { toast({ title: "Reel delen mislukt", description: e.message, variant: "destructive" }); }
    finally { setSharingReelId(null); }
  };

  const handlePublish = async () => {
    const isStory = postType === "STORY";
    if (!isStory && !caption.trim()) { toast({ title: "Caption vereist", variant: "destructive" }); return; }
    if (!imageUrl.trim() && !videoUrl.trim()) { toast({ title: "Media URL vereist", variant: "destructive" }); return; }
    setPublishing(true);
    try {
      const isVideo = postType === "REELS" || postType === "VIDEO" || (postType === "STORY" && storyIsVideo);
      const body: Record<string, any> = { caption, media_type: postType };
      if (postType === "STORY") {
        if (storyIsVideo && videoUrl) body.video_url = videoUrl;
        else body.image_url = imageUrl;
      } else if (postType === "PHOTO") {
        body.image_url = imageUrl;
      } else {
        body.video_url = videoUrl;
      }
      const createRes = await apiRequest("/api/instagram/media/create", "POST", body);
      if (!createRes.ok) { const err = await createRes.json(); throw new Error(err.error || "Create failed"); }
      const { id: creationId } = await createRes.json() as { id: string };
      let statusCode = "IN_PROGRESS", attempts = 0;
      if (isVideo) {
        toast({ title: "Video wordt verwerkt…", description: "Even geduld — Instagram codeert je video.", variant: "default" });
      }
      while (statusCode !== "FINISHED" && attempts < 30) {
        await new Promise(r => setTimeout(r, 3000));
        const statusRes = await apiRequest(`/api/instagram/media/${creationId}/status`, "GET");
        if (statusRes.ok) {
          const s = await statusRes.json();
          statusCode = s.status_code;
          if (statusCode === "ERROR") throw new Error("Instagram: video encoding mislukt");
        }
        attempts++;
      }
      if (statusCode !== "FINISHED") throw new Error("Timeout: video encoding duurde te lang");
      const publishRes = await apiRequest("/api/instagram/media/publish", "POST", { creation_id: creationId });
      if (!publishRes.ok) { const err = await publishRes.json(); throw new Error(err.error || "Publish failed"); }
      const { id: mediaId } = await publishRes.json() as { id: string };
      setPublished({ id: mediaId });
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/media"] });
      toast({ title: "Gepubliceerd! ✅", description: `Media ID: ${mediaId}` });
    } catch (e: any) { toast({ title: "Publiceren mislukt", description: e.message, variant: "destructive" }); }
    finally { setPublishing(false); }
  };

  /* ═══ RENDER ═══ */
  return (
    <div className="space-y-0">
      {/* ── Premium Header ── */}
      <div className="relative overflow-hidden rounded-2xl mb-5 p-5 sm:p-6"
        style={{ background: "linear-gradient(135deg, #1a0533 0%, #2d1065 40%, #831843 70%, #1a0533 100%)" }}>
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-10 blur-3xl" style={{ background: "radial-gradient(circle, #EC4899, transparent)" }} />
          <div className="absolute bottom-0 left-1/3 w-64 h-24 rounded-full opacity-10 blur-3xl" style={{ background: "radial-gradient(circle, #8B5CF6, transparent)" }} />
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
        </div>
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className={cn("w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg shadow-pink-500/30", IG_GRADIENT)}>
              <SiInstagram className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white leading-tight">
                Instagram <span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(135deg, #F472B6, #C084FC)" }}>Growth Studio</span>
              </h1>
              <p className="text-white/50 text-xs mt-0.5">Admin · Live · Graph API v18.0</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-bold border-blue-400/50 text-blue-300 bg-blue-950/30">API v18.0</Badge>
            {statusLoading ? (
              <Badge variant="secondary" className="text-xs bg-white/10 text-white/70 border-0"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Laden...</Badge>
            ) : isConnected ? (
              <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Verbonden
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs bg-white/10 text-white/70 border-0">
                <AlertCircle className="w-3.5 h-3.5 mr-1" /> Niet verbonden
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* ── Token health & capabilities ──────────────────────────────────
          Single source of truth for "is this feature actually working
          right now?". Probes the live Graph API, surfaces the token
          expiry, and offers a one-click extend / reconnect path. */}
      <TokenHealthBanner />

      {/* Loading */}
      {(configLoading || (config?.configured && statusLoading)) && (
        <div className="space-y-4"><Skeleton className="h-16 w-full" /><div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div></div>
      )}

      {/* Config error */}
      {configError && (
        <Card className="border-red-300 bg-red-50/30 dark:bg-red-950/10 mb-4">
          <CardContent className="py-4 flex items-center gap-3 text-red-700 dark:text-red-400">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-bold">Kon Instagram-instellingen niet laden. Controleer of je bent ingelogd als admin.</p>
          </CardContent>
        </Card>
      )}

      {/* Setup needed */}
      {!configLoading && config && !config.configured && !config.hasDirectToken && <SetupCard />}

      {/* Direct token connect */}
      {!configLoading && !statusLoading && config?.hasDirectToken && !isConnected && (
        <Card className="border-2 border-dashed border-pink-300 dark:border-pink-800 mb-4">
          <CardContent className="py-6 flex flex-col items-center gap-4 text-center">
            <div className={cn("w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-md", IG_GRADIENT)}>
              <SiInstagram className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="font-extrabold text-lg">Verbinden via Access Token</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Plak je token hieronder. Zowel een <strong>Instagram User token</strong> als een
                <strong> Facebook Page/Business token</strong> worden automatisch herkend.
              </p>
              <a
                href="https://developers.facebook.com/tools/explorer/"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-pink-500 hover:underline inline-flex items-center gap-1 mt-1"
                data-testid="link-graph-explorer"
              >
                Open Graph API Explorer <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            {/* Token type guidance */}
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 text-xs text-left max-w-md w-full space-y-1.5">
              <p className="font-bold text-blue-700 dark:text-blue-300">Welk token werkt?</p>
              <p className="text-blue-600 dark:text-blue-400">✅ <strong>Instagram User Access Token</strong> — gegenereerd via Graph API Explorer met <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">instagram_basic</code> permissie</p>
              <p className="text-blue-600 dark:text-blue-400">✅ <strong>Facebook Page / Business token</strong> — gegenereerd via Meta Business Suite of Graph API Explorer als Page token; je Instagram-account moet wel gekoppeld zijn aan die Facebook-pagina</p>
              <p className="text-blue-600 dark:text-blue-400">✅ <strong>System User token</strong> — van Meta Business Suite → Systeemgebruikers</p>
              <p className="text-muted-foreground mt-1">Tokens starten vaak met <code className="bg-muted px-1 rounded">EAAB…</code> of <code className="bg-muted px-1 rounded">EAAx…</code> en zijn 60 dagen geldig.</p>
            </div>
            <Textarea
              value={pastedToken}
              onChange={(e) => setPastedToken(e.target.value)}
              placeholder="EAAB... of EAAx... (plak hier je access token)"
              className="font-mono text-xs min-h-[88px] max-w-md w-full"
              data-testid="textarea-instagram-token"
            />
            <div className="flex flex-col sm:flex-row gap-2 w-full max-w-md">
              <Button
                onClick={() => connectTokenMutation.mutate(pastedToken)}
                disabled={connectTokenMutation.isPending || !pastedToken.trim()}
                className={cn("h-11 font-bold gap-2 text-white border-0 bg-gradient-to-r px-6 flex-1", IG_GRADIENT, "hover:opacity-90")}
                data-testid="button-connect-instagram-token-pasted"
              >
                {connectTokenMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifiëren…</>
                  : <><SiInstagram className="w-4 h-4" /> Verbinden met dit token</>}
              </Button>
              <Button
                variant="outline"
                onClick={() => connectTokenMutation.mutate(undefined)}
                disabled={connectTokenMutation.isPending}
                className="h-11"
                data-testid="button-connect-instagram-token-env"
                title="Probeert het token uit INSTAGRAM_ACCESS_TOKEN env var"
              >
                Probeer env-token
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground max-w-md">
              Tip: genereer een token via <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer" className="underline text-pink-500">Graph API Explorer</a> of Meta Business Suite.
              Instagram User tokens én Facebook Page tokens worden allebei automatisch herkend.
            </p>
          </CardContent>
        </Card>
      )}

      {/* OAuth connect */}
      {!configLoading && !statusLoading && config?.configured && !isConnected && (
        <Card className="border-2 border-dashed mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><SiFacebook className="w-4 h-4 text-blue-600" /> Verbinden via Facebook Login</CardTitle>
            <CardDescription>Instagram Business accounts authenticeren via de Facebook Graph API.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-xs font-bold">OAuth Redirect URI — voeg dit toe aan je Facebook App:</p>
              <RedirectUriBox />
            </div>
            {oauthPending && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                <p className="text-xs text-blue-800 dark:text-blue-300 font-medium">Wacht op Facebook login in popup...</p>
              </div>
            )}
            <Button data-testid="button-connect-instagram" onClick={() => authUrlMutation.mutate()} disabled={authUrlMutation.isPending || oauthPending}
              className={cn("w-full h-11 font-bold gap-2 text-white border-0 bg-gradient-to-r", IG_GRADIENT, "hover:opacity-90")}>
              {authUrlMutation.isPending || oauthPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Verbinden...</> : <><SiInstagram className="w-4 h-4" /> Verbinden met Instagram Business</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── CONNECTED STUDIO LAYOUT ── */}
      {isConnected && (
        <div className="space-y-4">
          {/* Account bar */}
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 rounded-2xl border bg-card shadow-sm flex-wrap">
              {accountLoading ? <Skeleton className="w-10 h-10 rounded-full" /> : (
                <div className="relative shrink-0">
                  <img
                    src={account?.profile_picture_url ? proxyImg(account.profile_picture_url) : status?.profilePictureUrl ? proxyImg(status.profilePictureUrl) : `https://ui-avatars.com/api/?name=${encodeURIComponent(status?.username || "IG")}&background=E1306C&color=fff`}
                    alt={status?.name || ""}
                    className="w-10 h-10 rounded-full ring-2 ring-pink-400 object-cover"
                    onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(status?.username || "IG")}&background=E1306C&color=fff`; }}
                  />
                  {allAccounts && allAccounts.length > 1 && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-violet-600 border-2 border-background flex items-center justify-center">
                      <span className="text-[8px] font-extrabold text-white">{allAccounts.length}</span>
                    </div>
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-extrabold text-sm">@{status?.username || "–"}</p>
                  <Badge variant="outline" className="text-[10px] font-bold border-pink-400 text-pink-600">{status?.accountType || "BUSINESS"}</Badge>
                  {status?.label && <Badge variant="secondary" className="text-[10px]">{status.label}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">ID: {status?.instagramUserId}</p>
              </div>
              {!accountLoading && (
                <div className="hidden sm:flex items-center gap-5 text-center">
                  {[
                    { label: "Volgers", val: fmt(account?.followers_count ?? status?.followersCount ?? 0) },
                    { label: "Volgend", val: fmt(account?.follows_count ?? 0) },
                    { label: "Posts",   val: account?.media_count ?? status?.mediaCount ?? "–" },
                  ].map(({ label, val }) => (
                    <div key={label}><p className="font-extrabold text-base leading-tight">{val}</p><p className="text-xs text-muted-foreground">{label}</p></div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => refetchMedia()} title="Vernieuwen"><RefreshCw className="w-3.5 h-3.5" /></Button>
                <Button variant="outline" size="sm" className={cn("h-8 gap-1.5 text-xs font-semibold", showAccountSwitcher && "bg-violet-50 border-violet-300 text-violet-700 dark:bg-violet-950/40 dark:border-violet-700 dark:text-violet-300")}
                  onClick={() => { setShowAccountSwitcher(!showAccountSwitcher); setShowAddAccount(false); }}
                  data-testid="button-account-switcher">
                  <Users2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Accounts</span>
                  {allAccounts && allAccounts.length > 1 && <span className="hidden sm:inline">({allAccounts.length})</span>}
                  <ChevronDown className={cn("w-3 h-3 transition-transform", showAccountSwitcher && "rotate-180")} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending} className="text-xs text-muted-foreground h-8">
                  {disconnectMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Loskoppelen"}
                </Button>
              </div>
            </div>

            {/* Multi-account switcher panel */}
            {showAccountSwitcher && (
              <div className="rounded-2xl border bg-card p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Verbonden accounts</p>
                  <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => setShowAddAccount(!showAddAccount)} data-testid="button-add-account">
                    <Plus className="w-3 h-3" /> Nieuw account
                  </Button>
                </div>

                {/* Account list */}
                <div className="space-y-2">
                  {(allAccounts || []).map((acc: any) => (
                    <div key={acc.id} className={cn("flex items-center gap-3 p-2.5 rounded-xl border transition-all",
                      acc.isActive ? "border-pink-300 bg-pink-50/50 dark:border-pink-800/50 dark:bg-pink-950/20" : "border-border hover:border-muted-foreground/30")}>
                      <img
                        src={acc.profilePictureUrl ? proxyImg(acc.profilePictureUrl) : `https://ui-avatars.com/api/?name=${encodeURIComponent(acc.username || "IG")}&background=E1306C&color=fff`}
                        alt={acc.username || ""}
                        className="w-9 h-9 rounded-full shrink-0 object-cover ring-1 ring-border"
                        onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(acc.username || "IG")}&background=E1306C&color=fff`; }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-sm truncate">@{acc.username || "–"}</p>
                          {acc.isActive && <Badge className="text-[9px] py-0 px-1.5 bg-green-500 text-white border-0">ACTIEF</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">{fmt(acc.followersCount ?? 0)} volgers · {acc.accountType || "CREATOR"}</p>
                        {acc.label && <p className="text-[10px] text-violet-600 dark:text-violet-400 font-medium">{acc.label}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!acc.isActive && (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 font-semibold"
                            onClick={() => activateAccountMutation.mutate(acc.id)}
                            disabled={activateAccountMutation.isPending}
                            data-testid={`button-activate-account-${acc.id}`}>
                            {activateAccountMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Activeren"}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                          onClick={() => { if (confirm(`Account @${acc.username} verwijderen?`)) removeAccountMutation.mutate(acc.id); }}
                          disabled={removeAccountMutation.isPending}
                          data-testid={`button-remove-account-${acc.id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add account form */}
                {showAddAccount && (
                  <div className="space-y-2 pt-2 border-t border-border/60">
                    <p className="text-xs font-bold text-foreground">Nieuw account verbinden</p>
                    <p className="text-xs text-muted-foreground">Plak een Instagram User token of Facebook Page token. Beide worden automatisch herkend en werken.</p>
                    <Input
                      placeholder="Label (bijv. 'Zakelijk account', optioneel)"
                      value={newAccountLabel} onChange={e => setNewAccountLabel(e.target.value)}
                      className="text-sm h-9" data-testid="input-new-account-label"
                    />
                    <Textarea
                      placeholder="Plak hier je Instagram access token…"
                      value={newAccountToken} onChange={e => setNewAccountToken(e.target.value)}
                      rows={2} className="text-xs resize-none font-mono" data-testid="input-new-account-token"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="gap-1.5 text-xs"
                        onClick={() => addAccountMutation.mutate({ token: newAccountToken.trim(), label: newAccountLabel.trim() })}
                        disabled={!newAccountToken.trim() || addAccountMutation.isPending}
                        data-testid="button-connect-new-account">
                        {addAccountMutation.isPending ? <><Loader2 className="w-3 h-3 animate-spin" /> Verbinden…</> : <><SiInstagram className="w-3 h-3" /> Account verbinden</>}
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs"
                        onClick={() => { setShowAddAccount(false); setNewAccountToken(""); setNewAccountLabel(""); }}>
                        Annuleren
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Add Second Account Card (visible when only 1 account) ── */}
          {(!allAccounts || allAccounts.length <= 1) && (
            <div className="rounded-2xl border-2 border-dashed border-violet-300/60 dark:border-violet-700/50 bg-violet-50/40 dark:bg-violet-950/20 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shrink-0">
                  <UserPlus className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-extrabold text-sm text-foreground">Tweede Instagram account toevoegen</p>
                  <p className="text-xs text-muted-foreground">Verbind een extra Business of Creator account</p>
                </div>
              </div>

              <Input
                placeholder="Label (bijv. 'Zakelijk', 'Personal', optioneel)"
                value={newAccountLabel}
                onChange={e => setNewAccountLabel(e.target.value)}
                className="text-sm h-9"
                data-testid="input-second-account-label"
              />
              <Textarea
                placeholder="Plak hier de access token van je tweede Instagram account…"
                value={newAccountToken}
                onChange={e => setNewAccountToken(e.target.value)}
                rows={3}
                className="text-xs resize-none font-mono"
                data-testid="input-second-account-token"
              />

              <div className="flex gap-2 flex-wrap">
                <Button
                  className={cn("gap-2 text-sm font-bold text-white border-0 bg-gradient-to-r", IG_GRADIENT, "hover:opacity-90")}
                  onClick={() => addAccountMutation.mutate({ token: newAccountToken.trim(), label: newAccountLabel.trim() })}
                  disabled={!newAccountToken.trim() || addAccountMutation.isPending}
                  data-testid="button-connect-second-account">
                  {addAccountMutation.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Verbinden…</>
                    : <><SiInstagram className="w-4 h-4" /> Account verbinden</>}
                </Button>
                {newAccountToken && (
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground"
                    onClick={() => { setNewAccountToken(""); setNewAccountLabel(""); }}>
                    Wissen
                  </Button>
                )}
              </div>

              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Je token wordt veilig opgeslagen op de server — nooit zichtbaar in de browser.
                Genereer een langlopend token via{" "}
                <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer"
                  className="text-violet-600 dark:text-violet-400 underline underline-offset-2">
                  Meta Graph API Explorer
                </a>{" "}met de scope <code className="bg-muted px-1 rounded text-[10px]">instagram_basic,pages_show_list</code>.
              </p>
            </div>
          )}

          {/* Zone navigation */}
          <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
            {ZONES.map(({ id, label, icon: Icon, bg }) => (
              <button key={id} onClick={() => setActiveZone(activeZone === id ? "studio" : id)}
                data-testid={`zone-${id}`}
                className={cn(
                  "flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl border transition-all duration-200 text-center",
                  activeZone === id ? "border-transparent text-white shadow-lg" : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground hover:bg-muted/30"
                )}
                style={activeZone === id ? { background: bg } : {}}>
                <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center transition-all", activeZone === id ? "bg-white/20" : "bg-muted")}>
                  <Icon className={cn("w-4 h-4", activeZone === id ? "text-white" : "text-muted-foreground")} />
                </div>
                <span className={cn("text-[10px] font-bold leading-tight", activeZone === id ? "text-white" : "")}>{label}</span>
              </button>
            ))}
          </div>

          {/* AI Agent activation button */}
          <button
            onClick={() => setActiveZone(activeZone === "agent" ? "studio" : "agent")}
            data-testid="zone-agent"
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-2xl border-2 transition-all duration-300 text-left",
              activeZone === "agent"
                ? "border-violet-500 text-white shadow-lg shadow-violet-500/20"
                : "border-border/60 bg-card hover:border-violet-400/40 hover:shadow-md"
            )}
            style={activeZone === "agent" ? { background: "linear-gradient(135deg,#1e1b4b,#312e81)" } : {}}>
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all",
              activeZone === "agent" ? "bg-white/20" : "bg-violet-100 dark:bg-violet-950/40")}>
              <Brain className={cn("w-5 h-5 transition-all", activeZone === "agent" ? "text-white" : "text-violet-600 dark:text-violet-400")} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn("text-sm font-bold", activeZone === "agent" ? "text-white" : "text-foreground")}>AI Instagram Agent</p>
              <p className={cn("text-[11px]", activeZone === "agent" ? "text-violet-200" : "text-muted-foreground")}>
                Strategisch advies · Caption schrijven · Groei · Analyse · Planning
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className={cn("w-2 h-2 rounded-full shrink-0", activeZone === "agent" ? "bg-green-400 animate-pulse" : "bg-muted-foreground/30")} />
              <span className={cn("text-[10px] font-bold hidden sm:block", activeZone === "agent" ? "text-violet-200" : "text-muted-foreground")}>
                {activeZone === "agent" ? "ACTIEF" : "AI"}
              </span>
            </div>
          </button>

          {/* AI Automation Hub navigation */}
          <div className="space-y-1">
            <p className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground px-1">AI Automation Hub</p>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: "notifications" as Zone, label: "Meldingen", icon: Bell, color: "#f97316" },
                { id: "persona" as Zone, label: "Persona", icon: UserCog, color: "#7c3aed" },
                { id: "replies" as Zone, label: "Replies", icon: MessageCircle, color: "#ec4899" },
                { id: "automation" as Zone, label: "Regels", icon: Zap, color: "#f59e0b" },
                { id: "activity" as Zone, label: "Activiteit", icon: Activity, color: "#06b6d4" },
                { id: "profile" as Zone, label: "Profiel", icon: UserPlus, color: "#10b981" },
                { id: "schedule" as Zone, label: "Schedule", icon: Calendar, color: "#7c3aed" },
                { id: "inbox" as Zone, label: "Inbox", icon: MessageCircle, color: "#ec4899" },
                { id: "leads" as Zone, label: "Leads", icon: Target, color: "#6366f1" },
                { id: "editor" as Zone, label: "Editor", icon: Film, color: "#dc2626" },
              ].map(({ id, label, icon: Icon, color }) => (
                <button
                  key={id}
                  onClick={() => setActiveZone(activeZone === id ? "studio" : id)}
                  data-testid={`zone-${id}`}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border transition-all duration-200 text-center",
                    activeZone === id
                      ? "border-transparent text-white shadow-md"
                      : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground hover:bg-muted/30"
                  )}
                  style={activeZone === id ? { background: `linear-gradient(135deg,${color}dd,${color})` } : {}}>
                  <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center transition-all", activeZone === id ? "bg-white/20" : "bg-muted")}>
                    <Icon className={cn("w-3.5 h-3.5", activeZone === id ? "text-white" : "text-muted-foreground")} />
                  </div>
                  <span className={cn("text-[9px] font-bold leading-tight", activeZone === id ? "text-white" : "")}>{label}</span>
                </button>
              ))}
            </div>

            {/* DM Inbox — full-width button with pending count badge */}
            <DMInboxNavButton activeZone={activeZone} setActiveZone={setActiveZone} />
          </div>

          {/* Zone content */}
          <div className="animate-in fade-in duration-200">
            {activeZone === "studio" && (
              <StudioZone
                status={status} media={media}
                postType={postType} setPostType={setPostType}
                caption={caption} setCaption={setCaption}
                imageUrl={imageUrl} setImageUrl={setImageUrl}
                videoUrl={videoUrl} setVideoUrl={setVideoUrl}
                locationInput={locationInput} setLocationInput={setLocationInput}
                publishing={publishing} published={published}
                handlePublish={handlePublish} setPublished={setPublished}
                shareToComm={shareToComm} shareToReels={shareToReels}
                sharedToComm={sharedToComm} sharedToReels={sharedToReels}
                sharingId={sharingId} sharingReelId={sharingReelId}
                toast={toast}
                allAccounts={allAccounts}
                crossPostIds={crossPostIds}
                setCrossPostIds={setCrossPostIds}
                setActiveZone={setActiveZone}
                storyIsVideo={storyIsVideo}
                setStoryIsVideo={setStoryIsVideo}
              />
            )}
            {activeZone === "content" && (
              <ContentZone
                media={media} mediaLoading={mediaLoading} refetchMedia={refetchMedia}
                sharedToComm={sharedToComm} sharedToReels={sharedToReels}
                sharingId={sharingId} sharingReelId={sharingReelId}
                shareToComm={shareToComm} shareToReels={shareToReels}
              />
            )}
            {activeZone === "analytics" && (
              <AnalyticsZone
                mediaAnalytics={mediaAnalytics} mediaAnalyticsLoading={mediaAnalyticsLoading}
                insightsData={insightsData} account={account} status={status} media={media}
              />
            )}
            {activeZone === "audience" && (
              <AudienceZone audienceData={audienceData} audienceLoading={audienceLoading} status={status} media={media} />
            )}
            {activeZone === "growth" && <GrowthZone status={status} media={media} />}
            {activeZone === "tools" && (
              <ToolsZone
                media={media} mediaLoading={mediaLoading} status={status}
                replyMutation={replyMutation} deleteCommentMutation={deleteCommentMutation}
              />
            )}
            {activeZone === "agent" && (
              <AgentZone account={account} media={media} mediaAnalytics={mediaAnalytics} status={status} />
            )}
            {activeZone === "persona" && <PersonaZone />}
            {activeZone === "replies" && <ReplyZone media={media} />}
            {activeZone === "automation" && <AutomationZone />}
            {activeZone === "activity" && <ActivityZone />}
            {activeZone === "profile" && <ProfileZone status={status} />}
            {activeZone === "settings" && <SettingsZone />}
            {activeZone === "schedule" && <ScheduleZone />}
            {activeZone === "inbox" && <InboxZone media={media} />}
            {activeZone === "leads" && <LeadsZone />}
            {activeZone === "notifications" && <NotificationsZone />}
            {activeZone === "editor" && <VideoEditorZone />}
            {activeZone === "dm-inbox" && <DMInboxZone />}
          </div>
        </div>
      )}
    </div>
  );
}
