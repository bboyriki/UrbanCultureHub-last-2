import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles, Send, Loader2, CheckCircle, AlertCircle,
  TrendingUp, Calendar, Clock, Zap, RefreshCw, ChevronRight,
  Star, Bot, MessageSquare, BarChart3, Shield,
} from "lucide-react";

interface AiMessage {
  role: "user" | "assistant";
  content: string;
  actions?: { tool: string; result: string }[];
}

interface EventsHealth {
  score: number;
  issues: string[];
  suggestions: string[];
  counts: {
    pending: number;
    approved: number;
    rejected: number;
    total: number;
  };
}

const QUICK_ACTIONS = [
  { icon: "🔍", label: "Analyze all pending events and tell me which to approve" },
  { icon: "✅", label: "Approve all pending events in the queue" },
  { icon: "📊", label: "Give me a full platform summary and health report" },
  { icon: "⭐", label: "Which approved events should I feature on the homepage?" },
  { icon: "🔥", label: "What events should be marked as trending right now?" },
  { icon: "📋", label: "List all pending events with quality issues" },
];

export default function EventAiAssistant() {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: health, refetch: refetchHealth, isLoading: healthLoading } = useQuery<EventsHealth>({
    queryKey: ["/api/admin/events/ai/health"],
    queryFn: async () => {
      const res = await apiRequest("/api/admin/events/ai/health", "GET");
      return res.json();
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");

    const userMsg: AiMessage = { role: "user", content: msg };
    const history = messages.map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await apiRequest("/api/admin/events/ai/chat", "POST", {
        message: msg,
        history,
      });
      const data = await res.json();

      const assistantMsg: AiMessage = {
        role: "assistant",
        content: data.reply || "Done.",
        actions: data.actions || [],
      };
      setMessages(prev => [...prev, assistantMsg]);

      if (data.actions && data.actions.length > 0) {
        queryClient.invalidateQueries({ queryKey: ["/api/events", "admin"] });
        refetchHealth();
      }
    } catch (e: any) {
      toast({ title: "AI Error", description: e.message, variant: "destructive" });
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  const scoreColor = !health ? "text-muted-foreground" :
    health.score >= 80 ? "text-emerald-500" :
    health.score >= 50 ? "text-orange-500" : "text-red-500";

  const scoreBg = !health ? "bg-muted/30" :
    health.score >= 80 ? "bg-emerald-500" :
    health.score >= 50 ? "bg-orange-500" : "bg-red-500";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              Events AI Assistant
              <Badge variant="secondary" className="text-[10px] font-bold tracking-wider bg-blue-500/10 text-blue-500 border-blue-500/20">
                BETA
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground">Approves, analyzes, and manages your events platform using AI</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground h-8"
              onClick={() => setMessages([])}
              data-testid="btn-event-ai-new-chat"
            >
              New chat
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => refetchHealth()}
            disabled={healthLoading}
            data-testid="btn-event-ai-refresh"
          >
            <RefreshCw className={`w-4 h-4 ${healthLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Health + Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Platform Health Card */}
        <Card className="border-border/60">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <BarChart3 className="w-4 h-4" />
                Platform Health
              </span>
              {health && (
                <span className={`text-base font-bold ${scoreColor}`}>{health.score}/100</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {health ? (
              <>
                {/* Score bar */}
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${scoreBg}`}
                    style={{ width: `${health.score}%` }}
                  />
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <button
                    onClick={() => sendMessage(`Tell me about the ${health.counts.pending} pending events`)}
                    disabled={loading}
                    className="p-2 rounded-lg bg-orange-500/5 border border-orange-500/10 hover:border-orange-500/30 hover:bg-orange-500/10 transition-all group"
                    data-testid="btn-event-ai-pending"
                  >
                    <div className="text-lg font-bold text-orange-500">{health.counts.pending}</div>
                    <div className="text-[10px] text-muted-foreground group-hover:text-orange-400 transition-colors">Pending</div>
                  </button>
                  <button
                    onClick={() => sendMessage("Which approved events should I feature or promote?")}
                    disabled={loading}
                    className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 hover:border-emerald-500/30 hover:bg-emerald-500/10 transition-all group"
                    data-testid="btn-event-ai-approved"
                  >
                    <div className="text-lg font-bold text-emerald-500">{health.counts.approved}</div>
                    <div className="text-[10px] text-muted-foreground group-hover:text-emerald-400 transition-colors">Live</div>
                  </button>
                  <button
                    onClick={() => sendMessage("Show me all events — total breakdown by status")}
                    disabled={loading}
                    className="p-2 rounded-lg bg-muted/30 border border-border/60 hover:border-border transition-all group"
                    data-testid="btn-event-ai-total"
                  >
                    <div className="text-lg font-bold">{health.counts.total}</div>
                    <div className="text-[10px] text-muted-foreground">Total</div>
                  </button>
                </div>

                {/* Issues */}
                {health.issues.length > 0 && (
                  <div className="space-y-1">
                    {health.issues.map((issue, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(`Help me with this issue: ${issue}`)}
                        disabled={loading}
                        className="flex items-center gap-2 text-[11px] text-red-500/70 hover:text-red-500 w-full text-left transition-colors group"
                        data-testid={`btn-event-ai-issue-${i}`}
                      >
                        <AlertCircle className="w-3 h-3 shrink-0 text-red-500/50 group-hover:text-red-500 transition-colors" />
                        {issue}
                      </button>
                    ))}
                  </div>
                )}

                {/* Suggestions */}
                {health.suggestions.length > 0 && (
                  <div className="space-y-1 border-t border-border/40 pt-2">
                    {health.suggestions.slice(0, 3).map((s, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(s)}
                        disabled={loading}
                        className="flex items-center gap-2 text-[11px] text-orange-500/60 hover:text-orange-500 w-full text-left transition-colors"
                        data-testid={`btn-event-ai-suggestion-${i}`}
                      >
                        <ChevronRight className="w-3 h-3 shrink-0" />
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Capabilities Card */}
        <Card className="border-border/60 bg-gradient-to-br from-blue-500/3 to-violet-500/3">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Bot className="w-4 h-4" />
              What I Can Do
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2.5">
              {[
                { icon: Shield, label: "Review & approve/reject pending events", color: "text-orange-500" },
                { icon: Star, label: "Feature or promote standout events", color: "text-amber-500" },
                { icon: TrendingUp, label: "Set trending events for better visibility", color: "text-blue-500" },
                { icon: BarChart3, label: "Analyze event quality and platform health", color: "text-violet-500" },
                { icon: Zap, label: "Bulk approve the entire pending queue", color: "text-emerald-500" },
                { icon: MessageSquare, label: "Answer questions about your events", color: "text-cyan-500" },
              ].map(({ icon: Icon, label, color }, i) => (
                <div key={i} className="flex items-center gap-2.5 text-[12px] text-muted-foreground">
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${color}`} />
                  {label}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chat area */}
      <Card className="border-border/60">
        <CardContent className="p-4 space-y-4">
          {/* Messages */}
          <div className="min-h-[220px] max-h-[480px] overflow-y-auto space-y-3 scroll-smooth pr-1">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[220px] text-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/10 to-violet-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground/70">Events AI ready</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Ask me anything about your events, or try a quick action below</p>
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted/60 border border-border/60 rounded-tl-sm text-foreground"
                  }`}>
                    {msg.role === "assistant" && (
                      <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-border/40">
                        <div className="w-4 h-4 rounded bg-blue-500/20 flex items-center justify-center">
                          <Sparkles className="w-2.5 h-2.5 text-blue-400" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500/80">AI Assistant</span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap text-[13px]">{msg.content}</p>
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="mt-3 space-y-1.5 pt-2 border-t border-border/30">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Actions taken</p>
                        {msg.actions.map((a, j) => (
                          <div key={j} className="flex items-start gap-2 px-3 py-2 rounded-xl bg-emerald-500/8 border border-emerald-500/15 text-xs text-emerald-600 dark:text-emerald-400">
                            <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span>{a.result}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted/60 border border-border/60 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Sparkles className="w-3 h-3 text-blue-400 animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500/70">Working on it…</span>
                  </div>
                  <div className="flex gap-1">
                    {[0, 1, 2].map(k => (
                      <div key={k} className="w-1.5 h-1.5 rounded-full bg-blue-400/50 animate-bounce" style={{ animationDelay: `${k * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick actions (show when chat is empty) */}
          {messages.length === 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {QUICK_ACTIONS.map((action, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(action.label)}
                  disabled={loading}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-muted/40 border border-border/60 text-muted-foreground text-xs hover:bg-blue-500/5 hover:border-blue-500/25 hover:text-foreground transition-all text-left"
                  data-testid={`btn-event-ai-quick-${i}`}
                >
                  <span className="text-base shrink-0">{action.icon}</span>
                  <span className="leading-snug">{action.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="e.g. 'Approve all pending', 'Analyze event quality', 'Feature the best events'..."
              className="flex-1 text-sm"
              disabled={loading}
              data-testid="input-event-ai-message"
            />
            <Button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 shrink-0"
              data-testid="btn-event-ai-send"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
