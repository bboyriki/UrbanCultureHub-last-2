// ─────────────────────────────────────────────────────────────────────────────
// Admin · AI Legal Assistant (Dutch law) — admin-only
//
// Hybrid Claude flow with primary answer + validation pass.
// Voice-enabled (Web Speech API, EN/NL), structured answers (rights / risks /
// next steps / avoid), conversation history with category tags + star + export.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Scale, Mic, MicOff, Send, Star, Trash2, Plus, Download, Loader2,
  AlertTriangle, ShieldCheck, Siren, Sparkles, FileText, MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── types ──────────────────────────────────────────────────────────────────

type Conversation = {
  id: number;
  title: string;
  category: string;
  tags: string[];
  important: boolean;
  liveMode: boolean;
  createdAt: string;
  updatedAt: string;
};

type LegalMessage = {
  id: number;
  conversationId: number;
  role: "user" | "assistant" | "system";
  content: string;
  rights?: string | null;
  risks?: string | null;
  nextSteps?: string | null;
  thingsToAvoid?: string | null;
  shortSummary?: string | null;
  confidence?: "high" | "medium" | "low" | null;
  validationNotes?: string | null;
  flagged?: boolean;
  sources?: string[];
  voiceInput?: boolean;
  starred?: boolean;
  createdAt: string;
};

const CATEGORIES: { value: string; label: string }[] = [
  { value: "general",      label: "General" },
  { value: "police",       label: "Police interaction" },
  { value: "traffic",      label: "Traffic / fines" },
  { value: "tax",          label: "Tax (Belastingdienst)" },
  { value: "business",     label: "Business / ZZP / contracts" },
  { value: "consumer",     label: "Consumer / refunds" },
  { value: "privacy",      label: "Privacy / AVG / GDPR" },
  { value: "filming",      label: "Filming in public" },
  { value: "municipality", label: "Municipality rules" },
  { value: "housing",      label: "Housing / rental" },
  { value: "permits",      label: "Permits / events" },
  { value: "criminal",     label: "Criminal law" },
];

const CATEGORY_COLOR: Record<string, string> = {
  general:      "bg-slate-500/15 text-slate-700  dark:text-slate-300 border-slate-400/30",
  police:       "bg-blue-500/15  text-blue-700   dark:text-blue-300  border-blue-400/30",
  traffic:      "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-400/30",
  tax:          "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/30",
  business:     "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-400/30",
  consumer:     "bg-pink-500/15  text-pink-700   dark:text-pink-300   border-pink-400/30",
  privacy:      "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-400/30",
  filming:      "bg-cyan-500/15  text-cyan-700   dark:text-cyan-300   border-cyan-400/30",
  municipality: "bg-amber-500/15 text-amber-700  dark:text-amber-300  border-amber-400/30",
  housing:      "bg-teal-500/15  text-teal-700   dark:text-teal-300   border-teal-400/30",
  permits:      "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-400/30",
  criminal:     "bg-red-500/15   text-red-700    dark:text-red-300    border-red-400/30",
};

// ── voice input (Web Speech API) ───────────────────────────────────────────

function useVoiceInput(onResult: (text: string) => void, lang: "en-US" | "nl-NL") {
  const recRef = useRef<any>(null);
  const [listening, setListening] = useState(false);
  const supported = typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const start = () => {
    if (!supported) return;
    const Ctor: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = false;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const text = e.results?.[0]?.[0]?.transcript || "";
      if (text) onResult(text);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
    recRef.current = rec;
    setListening(true);
  };
  const stop = () => {
    try { recRef.current?.stop(); } catch {}
    setListening(false);
  };
  return { supported, listening, start, stop };
}

// ── main page ──────────────────────────────────────────────────────────────

export default function AdminLegalAssistantPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [liveMode, setLiveMode] = useState(false);
  const [voiceLang, setVoiceLang] = useState<"en-US" | "nl-NL">("en-US");
  const [voiceUsed, setVoiceUsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // ── conversations list ──
  const convsQ = useQuery<Conversation[]>({
    queryKey: ["/api/legal-assistant/conversations"],
  });

  // ── active conversation ──
  // NOTE: project's default queryFn only uses queryKey[0], so we provide an
  // explicit queryFn that includes the id in the URL.
  const activeQ = useQuery<{ conversation: Conversation; messages: LegalMessage[] }>({
    queryKey: ["/api/legal-assistant/conversations", activeId],
    enabled: !!activeId,
    queryFn: async () => {
      const r = await fetch(`/api/legal-assistant/conversations/${activeId}`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error(`Failed to load conversation (${r.status})`);
      return r.json();
    },
  });

  useEffect(() => {
    // auto-select first conversation when list loads
    if (!activeId && convsQ.data && convsQ.data.length) {
      setActiveId(convsQ.data[0].id);
    }
  }, [convsQ.data, activeId]);

  // auto-scroll on new message
  useEffect(() => {
    if (scrollRef.current) {
      requestAnimationFrame(() => {
        scrollRef.current!.scrollTop = scrollRef.current!.scrollHeight;
      });
    }
  }, [activeQ.data?.messages?.length]);

  // ── voice input ──
  const voice = useVoiceInput((text) => {
    setDraft((d) => (d ? d + " " + text : text));
    setVoiceUsed(true);
  }, voiceLang);

  // ── ask mutation ──
  const askMut = useMutation({
    mutationFn: async () => {
      const body = {
        conversationId: activeId,
        content: draft.trim(),
        voiceInput: voiceUsed,
        liveMode,
        category,
      };
      const r = await apiRequest("/api/legal-assistant/ask", "POST", body);
      return r.json();
    },
    onSuccess: (data: { conversation: Conversation; message: LegalMessage; elapsedMs: number }) => {
      setDraft("");
      setVoiceUsed(false);
      qc.invalidateQueries({ queryKey: ["/api/legal-assistant/conversations"] });
      if (data.conversation?.id) {
        setActiveId(data.conversation.id);
        qc.invalidateQueries({ queryKey: ["/api/legal-assistant/conversations", data.conversation.id] });
      }
      if (data.message?.flagged) {
        toast({
          title: "Validator flagged this answer",
          description: data.message.validationNotes || "Re-check before acting on this.",
          variant: "destructive",
        });
      }
    },
    onError: (e: any) => toast({
      title: "AI request failed",
      description: e?.message || "Please try again",
      variant: "destructive",
    }),
  });

  // ── new conversation ──
  const newConvMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("/api/legal-assistant/conversations", "POST", {
        title: "New consultation",
        category,
        liveMode,
      });
      return r.json();
    },
    onSuccess: (c: Conversation) => {
      qc.invalidateQueries({ queryKey: ["/api/legal-assistant/conversations"] });
      setActiveId(c.id);
    },
  });

  // ── delete conversation ──
  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest(`/api/legal-assistant/conversations/${id}`, "DELETE");
      return r.json();
    },
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["/api/legal-assistant/conversations"] });
      if (activeId === id) setActiveId(null);
    },
  });

  // ── star toggle ──
  const starMut = useMutation({
    mutationFn: async ({ id, starred }: { id: number; starred: boolean }) => {
      const r = await apiRequest(`/api/legal-assistant/messages/${id}`, "PATCH", { starred });
      return r.json();
    },
    onSuccess: () => activeId && qc.invalidateQueries({ queryKey: ["/api/legal-assistant/conversations", activeId] }),
  });

  // ── important toggle on conversation ──
  const importantMut = useMutation({
    mutationFn: async ({ id, important }: { id: number; important: boolean }) => {
      const r = await apiRequest(`/api/legal-assistant/conversations/${id}`, "PATCH", { important });
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/legal-assistant/conversations"] }),
  });

  // ── send on Enter (Shift+Enter = newline) ──
  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (draft.trim() && !askMut.isPending) askMut.mutate();
    }
  };

  const messages = activeQ.data?.messages ?? [];
  const conv = activeQ.data?.conversation;

  // sort: pinned (important) first, then most-recent
  const sortedConvs = useMemo(() => {
    const list = [...(convsQ.data || [])];
    list.sort((a, b) => (Number(b.important) - Number(a.important)) ||
      (new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
    return list;
  }, [convsQ.data]);

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl" data-testid="page-legal-assistant">

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2"
              data-testid="text-page-title">
            <Scale className="text-amber-600" />
            AI Legal Assistant
            <span className="text-xs font-medium text-muted-foreground ml-2 hidden md:inline">
              Dutch law · admin only
            </span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Hybrid Claude flow with a validation pass. Not a lawyer — for serious
            cases, verify with an official source or attorney.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => newConvMut.mutate()} disabled={newConvMut.isPending}
                  data-testid="button-new-conversation"
                  className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
            <Plus className="size-4 mr-1" />
            New consultation
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">

        {/* ── Sidebar: history ───────────────────────────────────────────── */}
        <Card className="p-3 h-[calc(100vh-220px)] min-h-[420px] flex flex-col">
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <MessageSquare className="size-4" /> History
            </h2>
            <Badge variant="secondary" className="text-[10px]">
              {sortedConvs.length}
            </Badge>
          </div>
          <ScrollArea className="flex-1 -mx-1">
            <div className="space-y-1 px-1">
              {convsQ.isLoading && (
                <div className="text-xs text-muted-foreground p-2">Loading…</div>
              )}
              {!convsQ.isLoading && sortedConvs.length === 0 && (
                <div className="text-xs text-muted-foreground p-3 text-center border rounded-lg border-dashed">
                  No consultations yet. Click <b>New consultation</b> to start.
                </div>
              )}
              {sortedConvs.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={cn(
                    "w-full text-left rounded-lg p-2 text-xs transition-colors border",
                    activeId === c.id
                      ? "bg-amber-500/10 border-amber-400/40"
                      : "border-transparent hover:bg-muted/50",
                  )}
                  data-testid={`button-conversation-${c.id}`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {c.important && <Star className="size-3 text-amber-500 fill-amber-500 shrink-0" />}
                    {c.liveMode && <Siren className="size-3 text-red-500 shrink-0" />}
                    <span className="font-semibold truncate flex-1">{c.title}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <Badge variant="outline" className={cn("h-4 px-1.5", CATEGORY_COLOR[c.category] || "")}>
                      {c.category}
                    </Badge>
                    <span>{new Date(c.updatedAt).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </Card>

        {/* ── Main: chat ────────────────────────────────────────────────── */}
        <Card className="flex flex-col h-[calc(100vh-220px)] min-h-[420px]">
          {/* conversation header */}
          {conv ? (
            <div className="border-b p-3 flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={cn(CATEGORY_COLOR[conv.category] || "")}>
                {conv.category}
              </Badge>
              <h2 className="text-sm font-semibold flex-1 truncate" data-testid="text-conversation-title">
                {conv.title}
              </h2>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => importantMut.mutate({ id: conv.id, important: !conv.important })}
                title={conv.important ? "Unpin" : "Mark important"}
                data-testid="button-toggle-important"
              >
                <Star className={cn("size-4", conv.important && "fill-amber-500 text-amber-500")} />
              </Button>
              <a
                href={`/api/legal-assistant/conversations/${conv.id}/export`}
                target="_blank" rel="noopener"
                title="Export as text"
              >
                <Button size="icon" variant="ghost" data-testid="button-export-conversation">
                  <Download className="size-4" />
                </Button>
              </a>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost" data-testid="button-delete-conversation">
                    <Trash2 className="size-4 text-red-500" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this consultation?</AlertDialogTitle>
                    <AlertDialogDescription>
                      All messages and validator notes will be permanently deleted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 hover:bg-red-700"
                      onClick={() => deleteMut.mutate(conv.id)}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : (
            <div className="border-b p-3 text-sm text-muted-foreground">
              Start a new consultation, or pick one from history.
            </div>
          )}

          {/* messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4" data-testid="list-messages">
            {!conv && (
              <EmptyState
                onPick={(q) => setDraft(q)}
              />
            )}
            {conv && messages.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-12">
                Ask your first question below. Tip: hold the <Mic className="inline size-3" /> button to speak.
              </div>
            )}
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} onStar={(s) => starMut.mutate({ id: m.id, starred: s })} />
            ))}
            {askMut.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Searching law · drafting answer · running validator…
              </div>
            )}
          </div>

          {/* composer */}
          <div className="border-t p-3 space-y-2 bg-background/60">
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-8 w-[180px] text-xs" data-testid="select-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={voiceLang} onValueChange={(v: any) => setVoiceLang(v)}>
                <SelectTrigger className="h-8 w-[110px] text-xs" data-testid="select-voice-lang">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en-US">🎤 English</SelectItem>
                  <SelectItem value="nl-NL">🎤 Nederlands</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1.5 ml-auto">
                <Switch checked={liveMode} onCheckedChange={setLiveMode} id="live-mode"
                        data-testid="switch-live-mode" />
                <Label htmlFor="live-mode" className="text-xs flex items-center gap-1 cursor-pointer">
                  <Siren className={cn("size-3.5", liveMode && "text-red-500")} />
                  Live situation
                </Label>
              </div>
            </div>
            <div className="flex items-end gap-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKey}
                placeholder={liveMode
                  ? "It's happening now — describe the situation…"
                  : "Ask a Dutch-law question, or describe your situation…"}
                className="min-h-[64px] resize-none"
                data-testid="input-question"
              />
              <div className="flex flex-col gap-2">
                {voice.supported && (
                  <Button
                    type="button"
                    variant={voice.listening ? "destructive" : "outline"}
                    size="icon"
                    onClick={voice.listening ? voice.stop : voice.start}
                    title={voice.listening ? "Stop" : `Speak (${voiceLang})`}
                    data-testid="button-voice"
                  >
                    {voice.listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                  </Button>
                )}
                <Button
                  onClick={() => askMut.mutate()}
                  disabled={!draft.trim() || askMut.isPending}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 text-white"
                  data-testid="button-send"
                >
                  {askMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </Button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground px-1">
              Not a lawyer · for serious matters consult a legal professional.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── message bubble ─────────────────────────────────────────────────────────

function MessageBubble({
  message,
  onStar,
}: {
  message: LegalMessage;
  onStar: (starred: boolean) => void;
}) {
  const isUser = message.role === "user";
  const conf = message.confidence;
  const confColor = conf === "high"
    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/30"
    : conf === "low"
    ? "bg-red-500/15 text-red-700 dark:text-red-300 border-red-400/30"
    : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400/30";

  if (isUser) {
    return (
      <div className="flex justify-end" data-testid={`message-user-${message.id}`}>
        <div className="max-w-[80%] rounded-2xl rounded-br-sm px-4 py-2.5 bg-primary text-primary-foreground text-sm whitespace-pre-wrap">
          {message.voiceInput && <Mic className="inline size-3 mr-1 opacity-70" />}
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start" data-testid={`message-assistant-${message.id}`}>
      <div className="max-w-[88%] w-full rounded-2xl rounded-bl-sm border bg-card p-4 space-y-3">
        {/* meta row */}
        <div className="flex items-center gap-2 flex-wrap text-[11px]">
          <Badge variant="outline" className={cn("border", confColor)}>
            <ShieldCheck className="size-3 mr-1" />
            {conf || "medium"} confidence
          </Badge>
          {message.flagged && (
            <Badge variant="outline" className="border bg-red-500/15 text-red-700 dark:text-red-300 border-red-400/30">
              <AlertTriangle className="size-3 mr-1" /> flagged
            </Badge>
          )}
          <span className="text-muted-foreground ml-auto">
            {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          <button
            onClick={() => onStar(!message.starred)}
            title={message.starred ? "Unstar" : "Star this answer"}
            data-testid={`button-star-message-${message.id}`}
          >
            <Star className={cn("size-3.5", message.starred && "fill-amber-500 text-amber-500")} />
          </button>
        </div>

        {/* structured fields if available, else raw content */}
        {message.shortSummary || message.rights || message.risks || message.nextSteps ? (
          <div className="space-y-3 text-sm">
            {message.shortSummary && (
              <Section icon={<Sparkles className="size-3.5" />} label="Summary" tone="indigo">
                {message.shortSummary}
              </Section>
            )}
            {message.rights && (
              <Section icon={<ShieldCheck className="size-3.5" />} label="Your rights" tone="emerald">
                {message.rights}
              </Section>
            )}
            {message.risks && (
              <Section icon={<AlertTriangle className="size-3.5" />} label="Risks" tone="amber">
                {message.risks}
              </Section>
            )}
            {message.nextSteps && (
              <Section icon={<Send className="size-3.5" />} label="Next steps" tone="blue">
                {message.nextSteps}
              </Section>
            )}
            {message.thingsToAvoid && (
              <Section icon={<MicOff className="size-3.5" />} label="Avoid" tone="red">
                {message.thingsToAvoid}
              </Section>
            )}
          </div>
        ) : (
          <div className="text-sm whitespace-pre-wrap">{message.content}</div>
        )}

        {/* sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="pt-2 border-t flex items-start gap-2 text-[11px] text-muted-foreground">
            <FileText className="size-3.5 mt-0.5 shrink-0" />
            <div className="flex flex-wrap gap-1">
              {message.sources.map((s, i) => (
                <Badge key={i} variant="secondary" className="text-[10px] font-normal">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* validator notes */}
        {message.flagged && message.validationNotes && (
          <div className="text-[11px] rounded-md bg-red-500/10 border border-red-400/30 p-2 text-red-700 dark:text-red-300">
            <b>Validator:</b> {message.validationNotes}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  icon, label, tone, children,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "indigo" | "emerald" | "amber" | "blue" | "red";
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    indigo:  "bg-indigo-500/10  border-indigo-400/30  text-indigo-900  dark:text-indigo-100",
    emerald: "bg-emerald-500/10 border-emerald-400/30 text-emerald-900 dark:text-emerald-100",
    amber:   "bg-amber-500/10   border-amber-400/30   text-amber-900   dark:text-amber-100",
    blue:    "bg-blue-500/10    border-blue-400/30    text-blue-900    dark:text-blue-100",
    red:     "bg-red-500/10     border-red-400/30     text-red-900     dark:text-red-100",
  };
  return (
    <div className={cn("rounded-lg border p-2.5", tones[tone])}>
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide opacity-80 mb-1">
        {icon} {label}
      </div>
      <div className="text-sm whitespace-pre-wrap leading-relaxed">{children}</div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  const examples = [
    "I got pulled over by police — what are my rights?",
    "Belastingdienst sent me a navordering — how do I respond?",
    "Can I film police officers in public?",
    "A client refuses to pay my invoice — what can I do as a ZZP?",
    "My landlord wants to raise the rent 15% — is that legal?",
  ];
  return (
    <div className="text-center py-8">
      <div className="inline-flex items-center justify-center size-12 rounded-full bg-amber-500/15 text-amber-600 mb-3">
        <Scale className="size-6" />
      </div>
      <h3 className="text-base font-semibold mb-1">Start a consultation</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Type or speak your question. Try one of these to get started:
      </p>
      <div className="grid gap-2 max-w-md mx-auto">
        {examples.map((q) => (
          <button
            key={q}
            onClick={() => onPick(q)}
            className="text-left text-xs px-3 py-2 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
            data-testid={`button-example-${q.slice(0, 20).replace(/\W+/g, "-")}`}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
