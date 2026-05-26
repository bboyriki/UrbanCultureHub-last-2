import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import {
  Mail, Sparkles, Wand2, Save, Copy, Trash2, Loader2,
  Languages, Smile, Zap, Scissors, Target, ShieldCheck,
  ChevronRight, Bot, User as UserIcon, Settings, History,
  Activity, AlertCircle, CheckCircle2, FileText, RefreshCcw,
  Mic, MicOff, X, Undo2, Brain, TrendingUp, Eye,
} from "lucide-react";

// ─────────────────────── types ───────────────────────
type Mode = "A" | "B" | "combo";
type Lead = { id: number; name: string | null; organization: string; email: string | null; status: string; city: string | null; role: string | null; };
type ActiveConfig = {
  activeMode: Mode; realtimeEnabled: boolean; detectionEnabled: boolean;
  humanizerEnabled: boolean; defaultTone: string; defaultLanguage: string;
  modelA: { provider: string; model: string }; modelB: { provider: string; model: string };
};
type Settings = ActiveConfig & {
  id: number; modelAProvider: string; modelAId: string;
  modelBProvider: string; modelBId: string; dailyLimitPerUser: number; rolesAllowed: string[];
};
type Issue = { text: string; kind: string; severity: string; suggestion: string; explanation: string; };
type DetectResult = {
  verdict: string; ai_probability?: number; scores: Record<string, number>;
  red_flags?: string[]; strong_points?: string[]; notes: string;
};
type VoiceTarget = "instructions" | "subject" | "body";

// ─────────────────────── constants ───────────────────────
const EMAIL_TYPES = [
  { v: "custom",       l: "Custom" },      { v: "subject",      l: "Subject only" },
  { v: "follow_up",    l: "Follow-up" },   { v: "proposal",     l: "Proposal" },
  { v: "apology",      l: "Apology" },     { v: "cold",         l: "Cold outreach" },
  { v: "sales",        l: "Sales pitch" }, { v: "partnership",  l: "Partnership" },
  { v: "reminder",     l: "Reminder" },    { v: "short",        l: "Short & punchy" },
  { v: "long",         l: "Long-form" },   { v: "reactivation", l: "Re-activation" },
  { v: "thank_you",    l: "Thank you" },
];
const TONES = [
  { v: "professional", l: "Professional" }, { v: "friendly",   l: "Friendly" },
  { v: "direct",       l: "Direct & bold" }, { v: "warm",      l: "Warm & personal" },
  { v: "formal",       l: "Formal" },        { v: "casual",    l: "Casual" },
  { v: "persuasive",   l: "Persuasive" },
];
const LANGUAGES = [
  { v: "en", l: "🇬🇧 English" }, { v: "nl", l: "🇳🇱 Nederlands" },
  { v: "fr", l: "🇫🇷 French" },  { v: "de", l: "🇩🇪 German" },
  { v: "es", l: "🇪🇸 Spanish" },
];
const PROVIDERS = [
  { v: "anthropic", l: "Anthropic (Claude)" }, { v: "openai", l: "OpenAI (GPT)" },
];
const MODELS_BY_PROVIDER: Record<string, { v: string; l: string }[]> = {
  anthropic: [
    { v: "claude-sonnet-4-6", l: "Claude Sonnet 4.6 (balanced)" },
    { v: "claude-haiku-4-5",  l: "Claude Haiku 4.5 (fast)" },
  ],
  openai: [
    { v: "gpt-4o",      l: "GPT-4o (balanced)" },
    { v: "gpt-4o-mini", l: "GPT-4o mini (fast)" },
    { v: "gpt-4-turbo", l: "GPT-4 Turbo (powerful)" },
  ],
};
const VOICE_LANG: Record<string, string> = {
  en: "en-US", nl: "nl-NL", fr: "fr-FR", de: "de-DE", es: "es-ES",
};

const verdictColor = (v?: string) => {
  switch (v) {
    case "natural":          return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "slightly_ai":      return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    case "too_robotic":      return "bg-rose-500/15 text-rose-700 dark:text-rose-400";
    case "needs_humanizing": return "bg-orange-500/15 text-orange-700 dark:text-orange-400";
    default:                 return "bg-muted text-muted-foreground";
  }
};
const verdictLabel = (v?: string) => v ? v.replace(/_/g, " ") : "—";

// ─────────────────────── helper components ───────────────────────
function CopyBtn({
  text, label = "Copy", size = "default", variant = "outline", className,
}: { text: string; label?: string; size?: any; variant?: any; className?: string }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button size={size} variant={variant} onClick={handle}
      className={cn("transition-all", copied && "border-emerald-400 text-emerald-700 dark:text-emerald-400", className)}
      data-testid="button-copy-result">
      {copied
        ? <><CheckCircle2 className="h-4 w-4 mr-1.5" />Copied!</>
        : <><Copy className="h-4 w-4 mr-1.5" />{label}</>}
    </Button>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const bar = value >= 80 ? "bg-emerald-500" : value >= 60 ? "bg-amber-400" : value >= 40 ? "bg-orange-400" : "bg-rose-500";
  const txt = value >= 80 ? "text-emerald-700 dark:text-emerald-400" : value >= 60 ? "text-amber-700 dark:text-amber-400" : "text-rose-600";
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-muted-foreground capitalize">{label.replace(/_/g, " ")}</span>
        <span className={cn("text-[11px] font-bold tabular-nums", txt)}>{value}</span>
      </div>
      <div className="h-1.5 bg-muted/70 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700", bar)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function QuickBtn({ icon, label, onClick, loading }: {
  icon: React.ReactNode; label: string; onClick: () => void; loading: boolean;
}) {
  return (
    <Button size="sm" variant="outline" onClick={onClick} disabled={loading}
      className="h-8 text-xs shrink-0"
      data-testid={`button-quick-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      {loading ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <span className="mr-1.5">{icon}</span>}
      {label}
    </Button>
  );
}

function MicBtn({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <Button type="button" size="sm" variant={active ? "default" : "ghost"} onClick={onClick}
      className={cn("h-7 w-7 p-0 rounded-full transition-all shrink-0",
        active && "bg-rose-500 hover:bg-rose-600 text-white")}
      data-testid="button-mic" title={active ? "Stop recording" : "Start voice input"}>
      {active ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
    </Button>
  );
}

function ToggleRow({ label, value, onChange, testid }: {
  label: string; value: boolean; onChange: (v: boolean) => void; testid?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-sm font-normal">{label}</Label>
      <Switch checked={value} onCheckedChange={onChange} data-testid={testid} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border p-2 text-center">
      <div className="text-xl font-bold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

// ─────────────────────── voice hook ───────────────────────
function useVoiceInput(language: string) {
  const [listening, setListening]   = useState(false);
  const [target, setTarget]         = useState<VoiceTarget | null>(null);
  const [interim, setInterim]       = useState("");
  const recRef      = useRef<any>(null);
  const listeningRef = useRef(false);
  const committedRef = useRef<Record<VoiceTarget, string>>({ instructions: "", subject: "", body: "" });
  const settersRef   = useRef<Record<VoiceTarget, ((v: string) => void)>>({
    instructions: () => {}, subject: () => {}, body: () => {},
  });
  const targetRef = useRef<VoiceTarget | null>(null);

  const stop = useCallback(() => {
    listeningRef.current = false;
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
    setTarget(null);
    setInterim("");
    targetRef.current = null;
  }, []);

  const startFor = useCallback((t: VoiceTarget, currentText: string) => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return false;
    listeningRef.current = false;
    recRef.current?.stop();

    committedRef.current[t] = currentText;

    const rec = new SR();
    rec.continuous    = true;
    rec.interimResults = true;
    rec.lang = VOICE_LANG[language] || "en-US";

    rec.onresult = (e: any) => {
      let fin = "", int = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) fin += e.results[i][0].transcript;
        else int += e.results[i][0].transcript;
      }
      if (fin.trim()) {
        const base = committedRef.current[t];
        const next = (base ? base + " " : "") + fin.trim();
        committedRef.current[t] = next;
        settersRef.current[t](next);
        setInterim("");
      } else if (int) {
        setInterim(int);
      }
    };

    rec.onerror = (e: any) => {
      if (e.error !== "aborted") { listeningRef.current = false; setListening(false); setInterim(""); }
    };

    rec.onend = () => {
      if (listeningRef.current && recRef.current === rec) {
        try { rec.start(); } catch { listeningRef.current = false; setListening(false); setInterim(""); }
      }
    };

    recRef.current = rec;
    listeningRef.current = true;
    targetRef.current = t;
    rec.start();
    setTarget(t);
    setListening(true);
    return true;
  }, [language]);

  const toggleFor = useCallback((t: VoiceTarget, current: string) => {
    if (listeningRef.current && targetRef.current === t) { stop(); return; }
    startFor(t, current);
  }, [stop, startFor]);

  const registerSetter = useCallback((t: VoiceTarget, setter: (v: string) => void) => {
    settersRef.current[t] = setter;
  }, []);

  return { listening, target, interim, toggleFor, stop, registerSetter };
}

// ─────────────────────── page ───────────────────────
export default function AdminEmailWriterPage() {
  const cfgQ = useQuery<ActiveConfig>({ queryKey: ["/api/email-writer/active-config"] });
  const cfg  = cfgQ.data;

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto p-3 md:p-6 space-y-4">
        <header className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 grid place-items-center shadow-sm shrink-0">
            <Mail className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight" data-testid="text-page-title">AI Email Writer</h1>
            <p className="text-xs text-muted-foreground">Dual-model AI · Real-time grammar · 🎤 Voice input · CRM-aware</p>
          </div>
        </header>

        <Tabs defaultValue="editor" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-xs">
            <TabsTrigger value="editor"  data-testid="tab-editor">Editor</TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
            <TabsTrigger value="admin"   data-testid="tab-admin">Admin</TabsTrigger>
          </TabsList>

          <TabsContent value="editor" className="mt-4">
            {cfgQ.isLoading || !cfg
              ? <Skeleton className="h-96 w-full" />
              : <EditorPanel cfg={cfg} />}
          </TabsContent>
          <TabsContent value="history" className="mt-4"><HistoryPanel /></TabsContent>
          <TabsContent value="admin"   className="mt-4"><AdminPanel /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ─────────────────────── EDITOR PANEL ───────────────────────
function EditorPanel({ cfg }: { cfg: ActiveConfig }) {
  const { toast } = useToast();

  const [mode, setMode]                   = useState<Mode>(cfg.activeMode);
  const [emailType, setEmailType]         = useState("custom");
  const [tone, setTone]                   = useState(cfg.defaultTone);
  const [language, setLanguage]           = useState(cfg.defaultLanguage);
  const [instructions, setInstructions]   = useState("");
  const [recipientName, setRecipientName]   = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [leadId, setLeadId]               = useState<number | null>(null);
  const [subject, setSubject]             = useState("");
  const [body, setBody]                   = useState("");
  const [prevBody, setPrevBody]           = useState("");
  const [prevSubject, setPrevSubject]     = useState("");
  const [lastAction, setLastAction]       = useState<string | null>(null);
  const [issues, setIssues]               = useState<Issue[]>([]);
  const [detect, setDetect]               = useState<DetectResult | null>(null);
  const [genMeta, setGenMeta]             = useState<{ modelLabel?: string; latencyMs?: number; improvements?: string[]; delta?: string } | null>(null);

  const voice = useVoiceInput(language);

  // Register setters so voice hook can write into state
  useEffect(() => { voice.registerSetter("instructions", setInstructions); }, [voice]);
  useEffect(() => { voice.registerSetter("subject", setSubject); }, [voice]);
  useEffect(() => { voice.registerSetter("body", setBody); }, [voice]);

  // Stop voice when language changes
  useEffect(() => { voice.stop(); }, [language]); // eslint-disable-line

  // ── leads picker ──
  const [leadQuery, setLeadQuery] = useState("");
  const leadsQ = useQuery<Lead[]>({
    queryKey: ["/api/email-writer/leads", leadQuery],
    queryFn: async () => {
      const r = await fetch(`/api/email-writer/leads?q=${encodeURIComponent(leadQuery)}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });
  const selectedLead = useMemo(() => leadsQ.data?.find(l => l.id === leadId) || null, [leadsQ.data, leadId]);

  // ── generate ──
  const genMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/email-writer/generate", "POST", {
        mode, emailType, tone, language, instructions,
        leadId: leadId || undefined,
        recipient: recipientName || recipientEmail ? { name: recipientName, email: recipientEmail } : undefined,
      });
      return res.json();
    },
    onSuccess: (d: any) => {
      if (d?.error) { toast({ title: "Error", description: d.error, variant: "destructive" }); return; }
      setPrevBody(body); setPrevSubject(subject);
      setSubject(d.subject || ""); setBody(d.body || "");
      setGenMeta({ modelLabel: d.modelLabel, latencyMs: d.latencyMs, improvements: d.improvements, delta: d.delta });
      setIssues([]); setDetect(null); setLastAction("generate");
      voice.stop();
      toast({ title: "Email generated ✅", description: `${d.modelLabel} · ${d.latencyMs}ms` });
    },
    onError: (e: any) => toast({ title: "Generation failed", description: e.message, variant: "destructive" }),
  });

  // ── real-time grammar (debounced) ──
  const grammarTimer = useRef<NodeJS.Timeout | null>(null);
  const [grammarLoading, setGrammarLoading] = useState(false);
  const runGrammarCheck = useCallback(async (text: string) => {
    if (!cfg.realtimeEnabled) return;
    if (!text.trim() || text.length < 12) { setIssues([]); return; }
    setGrammarLoading(true);
    try {
      const r = await apiRequest("/api/email-writer/assist", "POST", { text, action: "grammar", language });
      const d = await r.json();
      setIssues(d.issues || []);
    } catch { /* ignore transient */ }
    finally { setGrammarLoading(false); }
  }, [cfg.realtimeEnabled, language]);

  useEffect(() => {
    if (grammarTimer.current) clearTimeout(grammarTimer.current);
    grammarTimer.current = setTimeout(() => runGrammarCheck(body), 2000);
    return () => { if (grammarTimer.current) clearTimeout(grammarTimer.current); };
  }, [body, runGrammarCheck]);

  // ── apply suggestion ──
  const applySuggestion = (issue: Issue) => {
    const idx = body.indexOf(issue.text);
    if (idx < 0) { toast({ title: "Snippet not found", variant: "destructive" }); return; }
    setPrevBody(body);
    setBody(body.slice(0, idx) + issue.suggestion + body.slice(idx + issue.text.length));
    setIssues(prev => prev.filter(i => i !== issue));
  };

  // ── quick action ──
  const [rewriting, setRewriting] = useState<string | null>(null);
  const quickAction = async (action: string, target: "body" | "subject" = "body") => {
    const text = target === "body" ? body : subject;
    if (!text.trim()) return;
    if (target === "body") setPrevBody(body); else setPrevSubject(subject);
    setRewriting(action);
    try {
      const r = await apiRequest("/api/email-writer/assist", "POST", { text, action, language });
      const d = await r.json();
      if (target === "body") { setBody(d.text || text); setLastAction(action); }
      else { setSubject(d.text || text); setLastAction(action + "_subject"); }
      toast({ title: `✅ Applied: ${action.replace(/_/g, " ")}` });
    } catch (e: any) {
      toast({ title: "Action failed", description: e.message, variant: "destructive" });
    } finally { setRewriting(null); }
  };

  // ── voice transcript cleanup ──
  const [refiningVoice, setRefiningVoice] = useState(false);
  const refineVoiceTranscript = async () => {
    if (!instructions.trim()) return;
    setRefiningVoice(true);
    try {
      const r = await apiRequest("/api/email-writer/assist", "POST", { text: instructions, action: "voice_refine", language });
      const d = await r.json();
      setInstructions(d.text || instructions);
      toast({ title: "✅ Voice transcript cleaned up" });
    } catch (e: any) {
      toast({ title: "Cleanup failed", description: e.message, variant: "destructive" });
    } finally { setRefiningVoice(false); }
  };

  // ── AI detection ──
  const detectMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("/api/email-writer/detect", "POST", { subject, body });
      return r.json();
    },
    onSuccess: (d: DetectResult) => { setDetect(d); setLastAction("detect"); },
    onError: (e: any) => toast({ title: "Detect failed", description: e.message, variant: "destructive" }),
  });

  // ── humanize ──
  const humanizeMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("/api/email-writer/humanize", "POST", { subject, body, tone, language });
      return r.json();
    },
    onSuccess: (d: any) => {
      setPrevBody(body); setPrevSubject(subject);
      setSubject(d.subject || subject); setBody(d.body || body);
      setLastAction("humanize"); setDetect(null);
      toast({ title: "✅ Humanized", description: `${d.latencyMs}ms` });
    },
    onError: (e: any) => toast({ title: "Humanize failed", description: e.message, variant: "destructive" }),
  });

  // ── save ──
  const saveMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("/api/email-writer/drafts", "POST", {
        leadId: leadId || undefined, recipientName, recipientEmail,
        subject, body, emailType, tone, language, modeUsed: mode,
        modelLabel: genMeta?.modelLabel,
        scoreClarity:         detect?.scores?.clarity,
        scorePersonalization: detect?.scores?.specificity ?? detect?.scores?.personalization,
        scoreProfessionalism: detect?.scores?.naturalness ?? detect?.scores?.professionalism,
        scoreHumanTone:       detect?.scores?.human_tone,
        scoreCallToAction:    detect?.scores?.cta_quality ?? detect?.scores?.call_to_action,
        aiVerdict: detect?.verdict, aiNotes: detect?.notes,
        humanized: humanizeMut.isSuccess, status: "draft",
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-writer/drafts"] });
      toast({ title: "✅ Saved to history" });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const undo = () => {
    if (prevBody)    { setBody(prevBody);       setPrevBody(""); }
    if (prevSubject) { setSubject(prevSubject);  setPrevSubject(""); }
    setLastAction(null);
  };

  const hasContent   = !!body.trim();
  const canUndo      = !!(prevBody || prevSubject);
  const fullEmail    = `Subject: ${subject}\n\n${body}`;
  const scoreKeys    = detect?.scores ? Object.keys(detect.scores) : [];
  const aiProb       = (detect as any)?.ai_probability;

  return (
    <div className="space-y-3">

      {/* ── Voice banner ─────────────────────────────────────────────── */}
      {voice.listening && (
        <div className="rounded-xl border-2 border-violet-400 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/40 p-3 flex items-start gap-3 shadow-sm" data-testid="voice-banner">
          <div className="relative shrink-0 mt-0.5">
            <Mic className="h-5 w-5 text-violet-600" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">Listening</span>
              <Badge variant="secondary" className="text-[10px] capitalize">{voice.target}</Badge>
              <span className="text-[10px] text-muted-foreground">speak naturally, I capture in real-time</span>
            </div>
            <p className="text-sm italic text-foreground/70 min-h-[1.25rem] truncate">
              {voice.interim || <span className="text-muted-foreground/40">…waiting for speech…</span>}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            {voice.target === "instructions" && (
              <>
                <Button size="sm" variant="outline" className="h-7 text-xs"
                  disabled={refiningVoice || !instructions.trim()} onClick={refineVoiceTranscript}>
                  {refiningVoice ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Brain className="h-3 w-3 mr-1" />}
                  Clean up
                </Button>
                <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => { voice.stop(); genMut.mutate(); }} disabled={genMut.isPending}>
                  <Sparkles className="h-3 w-3 mr-1" />Generate now
                </Button>
              </>
            )}
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={voice.stop}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── AI result strip ────────────────────────────────────────────── */}
      {lastAction && hasContent && !voice.listening && (
        <div className="rounded-xl border bg-muted/30 px-4 py-2.5 flex items-center gap-3 flex-wrap" data-testid="result-strip">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="text-sm text-muted-foreground flex-1 min-w-0">
            {lastAction === "generate"  ? "Email generated — ready to copy or edit" :
             lastAction === "humanize"  ? "Humanized — sounds more authentic now" :
             lastAction === "detect"    ? "AI analysis complete — see report below" :
             `Applied: ${lastAction.replace(/_/g, " ")}`}
          </span>
          <div className="flex items-center gap-2">
            {canUndo && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={undo} data-testid="button-undo">
                <Undo2 className="h-3.5 w-3.5 mr-1" />Undo
              </Button>
            )}
            <CopyBtn text={fullEmail} label="Copy email" size="sm" />
          </div>
        </div>
      )}

      {/* ── Main grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Setup card ── */}
        <Card className="lg:col-span-1 h-fit order-2 lg:order-1">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-600" />Setup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pb-5">

            <div>
              <Label className="text-xs text-muted-foreground">AI Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <SelectTrigger data-testid="select-mode" className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">Model A only</SelectItem>
                  <SelectItem value="B">Model B only</SelectItem>
                  <SelectItem value="combo">Combo (A drafts → B polishes)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">
                A: {cfg.modelA.provider}/{cfg.modelA.model} · B: {cfg.modelB.provider}/{cfg.modelB.model}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Type</Label>
                <Select value={emailType} onValueChange={setEmailType}>
                  <SelectTrigger data-testid="select-email-type" className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {EMAIL_TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Tone</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger data-testid="select-tone" className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TONES.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger data-testid="select-language" className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div>
              <Label className="text-xs text-muted-foreground">CRM contact (optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between font-normal mt-1 text-sm h-9" data-testid="button-lead-picker">
                    {selectedLead
                      ? <span className="truncate">{selectedLead.name || "—"} · {selectedLead.organization}</span>
                      : <span className="text-muted-foreground text-xs">Pick a contact…</span>}
                    <ChevronRight className="h-3.5 w-3.5 opacity-40 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <div className="p-2 border-b">
                    <Input placeholder="Search name / company / email…" value={leadQuery}
                      onChange={(e) => setLeadQuery(e.target.value)} className="h-8"
                      data-testid="input-lead-search" />
                  </div>
                  <ScrollArea className="h-52">
                    {leadsQ.isLoading
                      ? <div className="p-3 text-sm text-muted-foreground">Loading…</div>
                      : (leadsQ.data || []).length === 0
                        ? <div className="p-3 text-sm text-muted-foreground">No contacts.</div>
                        : (
                          <div className="py-1">
                            {leadId && (
                              <button onClick={() => setLeadId(null)}
                                className="w-full text-left px-3 py-2 text-xs text-muted-foreground hover:bg-muted"
                                data-testid="button-clear-lead">✕ Clear</button>
                            )}
                            {(leadsQ.data || []).map(l => (
                              <button key={l.id} onClick={() => setLeadId(l.id)}
                                className={cn("w-full text-left px-3 py-2 hover:bg-muted transition-colors", leadId === l.id && "bg-muted")}
                                data-testid={`button-lead-${l.id}`}>
                                <div className="text-sm font-medium truncate">{l.name || "(no name)"}</div>
                                <div className="text-xs text-muted-foreground truncate">{l.organization}{l.role ? ` · ${l.role}` : ""}</div>
                              </button>
                            ))}
                          </div>
                        )}
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">To (name)</Label>
                <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Alex" className="mt-1" data-testid="input-recipient-name" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">To (email)</Label>
                <Input value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="alex@…" className="mt-1" data-testid="input-recipient-email" />
              </div>
            </div>

            {/* Instructions + voice */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs text-muted-foreground">Instructions</Label>
                <div className="flex items-center gap-1">
                  {instructions.trim() && !voice.listening && (
                    <Button type="button" size="sm" variant="ghost"
                      className="h-6 px-1.5 text-[10px] text-violet-600 hover:text-violet-700"
                      onClick={refineVoiceTranscript} disabled={refiningVoice}
                      title="Clean up voice transcript with AI">
                      {refiningVoice ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Brain className="h-2.5 w-2.5 mr-0.5" />}
                      <span className="hidden sm:inline">Clean</span>
                    </Button>
                  )}
                  <MicBtn
                    active={voice.listening && voice.target === "instructions"}
                    onClick={() => voice.toggleFor("instructions", instructions)}
                  />
                </div>
              </div>
              <Textarea
                rows={4}
                placeholder='What should the email do? Type or speak — e.g. "follow up on our meeting, propose a demo next week"'
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                data-testid="textarea-instructions"
                className="resize-none text-sm"
              />
            </div>

            <Button onClick={() => genMut.mutate()} disabled={genMut.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-10 font-semibold"
              data-testid="button-generate">
              {genMut.isPending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating…</>
                : <><Sparkles className="h-4 w-4 mr-2" />Generate Email</>}
            </Button>

            {genMeta?.modelLabel && (
              <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                <Bot className="h-3 w-3 shrink-0" />
                <span className="truncate">{genMeta.modelLabel}</span>
                <span>·</span>
                <span>{genMeta.latencyMs}ms</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Editor card ── */}
        <Card className="lg:col-span-2 order-1 lg:order-2">
          <CardHeader className="pb-2 pt-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />Editor
              </CardTitle>
              <div className="flex items-center gap-2">
                {grammarLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                {!grammarLoading && issues.length > 0 && (
                  <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                    <AlertCircle className="h-2.5 w-2.5 mr-1" />{issues.length} suggestions
                  </Badge>
                )}
                {!grammarLoading && issues.length === 0 && body.length > 20 && cfg.realtimeEnabled && (
                  <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">
                    <CheckCircle2 className="h-2.5 w-2.5 mr-1" />Clean
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pb-5">

            {/* Subject */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs text-muted-foreground">Subject line</Label>
                <div className="flex items-center gap-1.5">
                  {subject.trim() && (
                    <CopyBtn text={subject} label="Copy" size="sm" variant="ghost" className="h-6 px-2 text-[10px]" />
                  )}
                  <MicBtn
                    active={voice.listening && voice.target === "subject"}
                    onClick={() => voice.toggleFor("subject", subject)}
                  />
                </div>
              </div>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject line…" className="font-medium"
                data-testid="input-subject" />
            </div>

            {/* Body */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs text-muted-foreground">Body</Label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground tabular-nums">{body.length} chars</span>
                  {body.trim() && (
                    <CopyBtn text={body} label="Copy body" size="sm" variant="ghost" className="h-6 px-2 text-[10px]" />
                  )}
                  <MicBtn
                    active={voice.listening && voice.target === "body"}
                    onClick={() => voice.toggleFor("body", body)}
                  />
                </div>
              </div>
              <Textarea
                rows={13}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write, paste, or generate an email. Tap the 🎤 mic to dictate. Quick actions below."
                className="font-mono text-sm leading-relaxed resize-none"
                data-testid="textarea-body"
              />
            </div>

            {/* Quick actions (scrollable on mobile) */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1" style={{ scrollbarWidth: "none" }}
              data-testid="toolbar-quick-actions">
              <QuickBtn icon={<Wand2 className="h-3.5 w-3.5"/>}       label="Fix grammar"   onClick={() => quickAction("fix_grammar")}   loading={rewriting === "fix_grammar"} />
              <QuickBtn icon={<Sparkles className="h-3.5 w-3.5"/>}    label="Improve"       onClick={() => quickAction("improve")}       loading={rewriting === "improve"} />
              <QuickBtn icon={<ShieldCheck className="h-3.5 w-3.5"/>} label="Professional"  onClick={() => quickAction("professional")} loading={rewriting === "professional"} />
              <QuickBtn icon={<Smile className="h-3.5 w-3.5"/>}       label="Friendlier"    onClick={() => quickAction("friendly")}     loading={rewriting === "friendly"} />
              <QuickBtn icon={<Zap className="h-3.5 w-3.5"/>}         label="Direct"        onClick={() => quickAction("direct")}       loading={rewriting === "direct"} />
              <QuickBtn icon={<Scissors className="h-3.5 w-3.5"/>}    label="Shorter"       onClick={() => quickAction("shorter")}      loading={rewriting === "shorter"} />
              <QuickBtn icon={<Target className="h-3.5 w-3.5"/>}      label="Strong CTA"    onClick={() => quickAction("stronger_cta")} loading={rewriting === "stronger_cta"} />
              <QuickBtn icon={<Languages className="h-3.5 w-3.5"/>}   label="Translate"     onClick={() => quickAction("translate")}    loading={rewriting === "translate"} />
              <QuickBtn icon={<TrendingUp className="h-3.5 w-3.5"/>}  label="Subject ✨"     onClick={() => quickAction("improve", "subject")} loading={rewriting === "improve_s"} />
            </div>

            {/* Grammar issues */}
            {issues.length > 0 && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/10 p-3 space-y-2"
                data-testid="container-issues">
                <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />Writing suggestions
                </div>
                <ul className="space-y-2">
                  {issues.map((iss, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs" data-testid={`issue-${i}`}>
                      <Badge variant="outline" className="shrink-0 text-[9px] uppercase mt-0.5">{iss.kind}</Badge>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap gap-1 items-center">
                          <span className="line-through text-muted-foreground">"{iss.text}"</span>
                          <span>→</span>
                          <span className="font-medium text-emerald-700 dark:text-emerald-400">"{iss.suggestion}"</span>
                        </div>
                        <div className="text-muted-foreground text-[10px] mt-0.5 italic">{iss.explanation}</div>
                      </div>
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] shrink-0"
                        onClick={() => applySuggestion(iss)} data-testid={`button-apply-${i}`}>Apply</Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Separator />

            {/* Bottom action bar */}
            <div className="flex flex-wrap gap-2" data-testid="toolbar-bottom">
              {cfg.detectionEnabled && (
                <Button variant="outline" onClick={() => detectMut.mutate()}
                  disabled={detectMut.isPending || !hasContent} data-testid="button-detect">
                  {detectMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
                  AI Detector
                </Button>
              )}
              {cfg.humanizerEnabled && (
                <Button variant="outline" onClick={() => humanizeMut.mutate()}
                  disabled={humanizeMut.isPending || !hasContent} data-testid="button-humanize">
                  {humanizeMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserIcon className="h-4 w-4 mr-2" />}
                  Humanize
                </Button>
              )}
              <CopyBtn text={fullEmail} label="Copy email" />
              <Button variant="outline" onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending || !hasContent} data-testid="button-save">
                {saveMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save
              </Button>
            </div>

            {/* Detection report */}
            {detect && (
              <div className="rounded-xl border p-4 space-y-3" data-testid="container-detect">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-semibold">AI Detection Report</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {aiProb !== undefined && (
                      <span className="text-xs text-muted-foreground">{100 - aiProb}% human</span>
                    )}
                    <Badge className={verdictColor(detect.verdict)} data-testid="badge-verdict">
                      {verdictLabel(detect.verdict)}
                    </Badge>
                  </div>
                </div>

                {/* Score bars */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                  {scoreKeys.map(k => <ScoreBar key={k} label={k} value={detect.scores[k] ?? 0} />)}
                </div>

                {/* Red flags */}
                {(detect as any).red_flags?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-rose-600 mb-1.5">AI patterns found</p>
                    <div className="flex flex-wrap gap-1">
                      {(detect as any).red_flags.slice(0, 6).map((f: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-[10px] border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400">{f}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Strong points */}
                {(detect as any).strong_points?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 mb-1.5">Human elements</p>
                    <div className="flex flex-wrap gap-1">
                      {(detect as any).strong_points.slice(0, 4).map((f: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-[10px] border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400">{f}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {detect.notes && (
                  <div className="rounded-lg bg-muted/40 border px-3 py-2 text-xs text-muted-foreground italic">
                    {detect.notes}
                  </div>
                )}

                {detect.verdict !== "natural" && cfg.humanizerEnabled && (
                  <Button size="sm" onClick={() => humanizeMut.mutate()} disabled={humanizeMut.isPending}
                    className="w-full bg-violet-600 hover:bg-violet-700 text-white">
                    {humanizeMut.isPending
                      ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Humanizing…</>
                      : <><UserIcon className="h-3.5 w-3.5 mr-1.5" />Humanize this email now</>}
                  </Button>
                )}
              </div>
            )}

            {/* Combo improvements */}
            {genMeta?.improvements && genMeta.improvements.length > 0 && (
              <div className="rounded-lg border bg-blue-50/50 dark:bg-blue-950/10 p-3 text-xs">
                <div className="font-semibold text-blue-700 dark:text-blue-400 mb-1.5 flex items-center gap-1.5">
                  <Bot className="h-3.5 w-3.5" />Combo mode — Model B improvements
                </div>
                <ul className="space-y-0.5 list-disc list-inside text-muted-foreground">
                  {genMeta.improvements.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────── HISTORY PANEL ───────────────────────
function HistoryPanel() {
  const { toast } = useToast();
  const draftsQ = useQuery<any[]>({ queryKey: ["/api/email-writer/drafts"] });
  const delMut = useMutation({
    mutationFn: async (id: number) => (await apiRequest(`/api/email-writer/drafts/${id}`, "DELETE")).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/email-writer/drafts"] }),
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  if (draftsQ.isLoading) return <Skeleton className="h-64 w-full" />;
  const rows = draftsQ.data || [];
  if (rows.length === 0) return (
    <Card><CardContent className="py-16 text-center">
      <History className="h-10 w-10 mx-auto mb-3 opacity-30" />
      <p className="text-sm text-muted-foreground">No saved emails yet.</p>
      <p className="text-xs text-muted-foreground mt-1">Generate one and click "Save".</p>
    </CardContent></Card>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {rows.map(r => (
        <Card key={r.id} data-testid={`draft-${r.id}`}>
          <CardContent className="p-4 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold text-sm truncate">{r.subject || "(no subject)"}</div>
              <Badge variant="outline" className="text-[10px] shrink-0">{r.modeUsed}</Badge>
            </div>
            <div className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap leading-relaxed">{r.body}</div>
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary" className="text-[10px]">{r.tone}</Badge>
              <Badge variant="secondary" className="text-[10px]">{r.language}</Badge>
              <Badge variant="secondary" className="text-[10px]">{r.emailType}</Badge>
              {r.aiVerdict && <Badge className={`text-[10px] ${verdictColor(r.aiVerdict)}`}>{verdictLabel(r.aiVerdict)}</Badge>}
              {r.humanized && <Badge className="text-[10px] bg-violet-500/15 text-violet-700 dark:text-violet-400">humanized</Badge>}
            </div>
            <div className="flex items-center justify-between pt-0.5">
              <div className="text-[10px] text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</div>
              <div className="flex gap-1">
                <CopyBtn text={`Subject: ${r.subject}\n\n${r.body}`} label="" size="sm" variant="ghost" className="h-7 w-7 p-0" />
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700"
                  onClick={() => delMut.mutate(r.id)} data-testid={`button-delete-${r.id}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─────────────────────── ADMIN PANEL ───────────────────────
function AdminPanel() {
  const { toast } = useToast();
  const settingsQ = useQuery<Settings>({ queryKey: ["/api/email-writer/settings"] });
  const usageQ    = useQuery<{ rows: any[]; totals: any }>({ queryKey: ["/api/email-writer/admin/usage"] });

  const [draft, setDraft] = useState<Settings | null>(null);
  useEffect(() => { if (settingsQ.data) setDraft(settingsQ.data); }, [settingsQ.data]);

  const saveMut = useMutation({
    mutationFn: async (patch: Partial<Settings>) => (await apiRequest("/api/email-writer/settings", "PUT", patch)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-writer/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-writer/active-config"] });
      toast({ title: "Settings saved" });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  if (settingsQ.isLoading || !draft) return <Skeleton className="h-64 w-full" />;
  const update = (patch: Partial<Settings>) => setDraft(prev => prev ? { ...prev, ...patch } : prev);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Settings className="h-4 w-4" />Models & defaults
        </CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(["A", "B"] as const).map((m) => (
            <div key={m} className="rounded-lg border p-3 space-y-2">
              <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Model {m}</div>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={m === "A" ? draft.modelAProvider : draft.modelBProvider}
                  onValueChange={(v) => update(m === "A"
                    ? { modelAProvider: v, modelAId: MODELS_BY_PROVIDER[v][0].v }
                    : { modelBProvider: v, modelBId: MODELS_BY_PROVIDER[v][0].v })}>
                  <SelectTrigger data-testid={`select-model-${m.toLowerCase()}-provider`}><SelectValue /></SelectTrigger>
                  <SelectContent>{PROVIDERS.map(p => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
                </Select>
                <Select
                  value={m === "A" ? draft.modelAId : draft.modelBId}
                  onValueChange={(v) => update(m === "A" ? { modelAId: v } : { modelBId: v })}>
                  <SelectTrigger data-testid={`select-model-${m.toLowerCase()}-id`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(MODELS_BY_PROVIDER[m === "A" ? draft.modelAProvider : draft.modelBProvider] || []).map(x =>
                      <SelectItem key={x.v} value={x.v}>{x.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}

          <div>
            <Label className="text-xs text-muted-foreground">Active mode (default)</Label>
            <Select value={draft.activeMode} onValueChange={(v) => update({ activeMode: v as Mode })}>
              <SelectTrigger data-testid="select-active-mode" className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="A">Model A only</SelectItem>
                <SelectItem value="B">Model B only</SelectItem>
                <SelectItem value="combo">Combination Mode</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Default tone</Label>
              <Select value={draft.defaultTone} onValueChange={(v) => update({ defaultTone: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{TONES.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Default language</Label>
              <Select value={draft.defaultLanguage} onValueChange={(v) => update({ defaultLanguage: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{LANGUAGES.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Daily limit per user (AI actions)</Label>
            <Input type="number" value={draft.dailyLimitPerUser} className="mt-1"
              onChange={(e) => update({ dailyLimitPerUser: Math.max(0, Number(e.target.value)) })}
              data-testid="input-daily-limit" />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Allowed roles (comma-separated)</Label>
            <Input className="mt-1"
              value={(draft.rolesAllowed || []).join(", ")}
              onChange={(e) => update({ rolesAllowed: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
              data-testid="input-roles-allowed" />
          </div>

          <Separator />
          <ToggleRow label="Real-time writing assistant" value={draft.realtimeEnabled} onChange={(v) => update({ realtimeEnabled: v })} testid="toggle-realtime" />
          <ToggleRow label="AI detection scanner"        value={draft.detectionEnabled} onChange={(v) => update({ detectionEnabled: v })} testid="toggle-detection" />
          <ToggleRow label="Humanizer"                   value={draft.humanizerEnabled} onChange={(v) => update({ humanizerEnabled: v })} testid="toggle-humanizer" />

          <Button className="w-full" onClick={() => saveMut.mutate(draft)} disabled={saveMut.isPending} data-testid="button-save-settings">
            {saveMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save settings
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4" />Usage (last 7 days)
            <Button size="sm" variant="ghost" className="h-7 ml-auto"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/email-writer/admin/usage"] })}
              data-testid="button-refresh-usage">
              <RefreshCcw className="h-3 w-3" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {usageQ.isLoading ? <Skeleton className="h-32 w-full" /> : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Total"  value={usageQ.data?.totals?.total ?? 0} />
                <Stat label="Errors" value={usageQ.data?.totals?.errors ?? 0} />
                <Stat label="Avg ms" value={Math.round(usageQ.data?.totals?.avgLatencyMs || 0)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">By action</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {Object.entries(usageQ.data?.totals?.byAction || {}).map(([k, v]) => (
                    <Badge key={k} variant="secondary" className="text-[10px]">{k}: {String(v)}</Badge>
                  ))}
                </div>
              </div>
              <Separator />
              <div>
                <Label className="text-xs text-muted-foreground">Recent logs</Label>
                <ScrollArea className="h-64 mt-1 rounded border">
                  <div className="divide-y">
                    {(usageQ.data?.rows || []).slice(0, 100).map((r: any) => (
                      <div key={r.id} className="flex items-center gap-2 px-2 py-1.5 text-[10px]">
                        <Badge variant="outline" className="text-[9px] shrink-0">{r.action}</Badge>
                        {r.mode && <span className="text-muted-foreground">{r.mode}</span>}
                        <span className="flex-1 truncate text-muted-foreground">{r.modelUsed || "—"}</span>
                        <span className="tabular-nums text-muted-foreground">{r.latencyMs ?? "—"}ms</span>
                        {!r.success && <Badge className="text-[9px] bg-rose-500/15 text-rose-700">err</Badge>}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
