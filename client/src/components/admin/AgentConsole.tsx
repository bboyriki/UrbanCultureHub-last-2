import { useState, useRef, useEffect, useCallback } from "react";
import {
  Bot, Send, Plus, Trash2, ChevronRight, ChevronDown, Terminal,
  FileCode, Database, Search, FolderOpen, Loader2, CheckCircle2,
  XCircle, Cpu, Zap, Square, Copy, Check, Activity, ShieldAlert,
  GitBranch, Stethoscope, Clock, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type AgentModel = "opus" | "sonnet";

const MODEL_OPTIONS: { key: AgentModel; label: string; desc: string; color: string }[] = [
  { key: "opus",   label: "Opus 4",   desc: "Most capable",  color: "text-violet-600" },
  { key: "sonnet", label: "Sonnet 4", desc: "Fast & efficient", color: "text-blue-600" },
];

const TOOL_META: Record<string, { icon: any; label: string; color: string }> = {
  read_file:         { icon: FileCode,    label: "Read File",       color: "text-blue-600"   },
  write_file:        { icon: FileCode,    label: "Write File",      color: "text-green-600"  },
  list_directory:    { icon: FolderOpen,  label: "List Directory",  color: "text-amber-600"  },
  run_command:       { icon: Terminal,    label: "Run Command",     color: "text-purple-600" },
  search_in_files:   { icon: Search,      label: "Search Files",    color: "text-cyan-600"   },
  grep_file_content: { icon: Search,      label: "Grep File",       color: "text-cyan-600"   },
  execute_sql:       { icon: Database,    label: "Execute SQL",     color: "text-orange-600" },
  get_project_tree:  { icon: FolderOpen,  label: "Project Tree",    color: "text-amber-600"  },
  check_typescript:  { icon: ShieldAlert, label: "TypeScript Check",color: "text-red-600"    },
  check_app_health:  { icon: Stethoscope, label: "Health Check",    color: "text-emerald-600"},
};

interface AgentEvent {
  type: "user" | "thinking" | "text" | "tool_call" | "tool_result" | "done" | "error";
  content?: string;
  tool?: string;
  input?: Record<string, any>;
  output?: string;
  error?: string;
  success?: boolean;
  id?: string;
  iteration?: number;
  elapsed?: number;
}

interface Conversation {
  id: string;
  title: string;
  events: AgentEvent[];
  history: { role: string; content: any }[];
  createdAt: Date;
  model: AgentModel;
  totalElapsed?: number;
  totalIterations?: number;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
      title="Copy response"
      data-testid="button-copy-response"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function ToolCallBlock({ event, result }: { event: AgentEvent; result?: AgentEvent }) {
  const [open, setOpen] = useState(false);
  const meta = TOOL_META[event.tool ?? ""] ?? { icon: Cpu, label: event.tool, color: "text-gray-600" };
  const Icon = meta.icon;

  const inputPreview = event.input?.file_path
    ?? event.input?.command
    ?? event.input?.pattern
    ?? event.input?.query
    ?? event.input?.dir_path
    ?? "";

  return (
    <div className={cn(
      "rounded-lg border text-xs overflow-hidden",
      result?.success === false
        ? "border-red-200 bg-red-50"
        : "border-border bg-muted/40"
    )}>
      <button
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-muted/60 transition-colors"
        onClick={() => setOpen(!open)}
        data-testid={`tool-block-${event.tool}`}
      >
        <Icon className={cn("w-3.5 h-3.5 shrink-0", meta.color)} />
        <span className={cn("font-medium", meta.color)}>{meta.label}</span>
        <span className="text-muted-foreground truncate flex-1 font-mono">{inputPreview}</span>
        {result ? (
          result.success
            ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
            : <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
        ) : (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />
        )}
        {open ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-border">
          <div className="px-3 py-2 bg-background/60">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Input</p>
            <pre className="text-xs whitespace-pre-wrap font-mono text-foreground leading-relaxed">
              {JSON.stringify(event.input, null, 2)}
            </pre>
          </div>
          {result && (
            <div className="px-3 py-2 border-t border-border">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                {result.success ? "Output" : "Error"}
              </p>
              <pre className={cn(
                "text-xs whitespace-pre-wrap font-mono leading-relaxed max-h-80 overflow-y-auto",
                result.success ? "text-foreground" : "text-red-600"
              )}>
                {result.success ? result.output : result.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AgentMessage({ events }: { events: AgentEvent[] }) {
  const toolCallMap = new Map<string, { call: AgentEvent; result?: AgentEvent }>();
  const orderedBlocks: Array<{ type: "text"; content: string } | { type: "tool"; id: string }> = [];

  for (const ev of events) {
    if (ev.type === "tool_call" && ev.id) {
      if (!toolCallMap.has(ev.id)) {
        toolCallMap.set(ev.id, { call: ev });
        orderedBlocks.push({ type: "tool", id: ev.id });
      }
    } else if (ev.type === "tool_result" && ev.id) {
      const entry = toolCallMap.get(ev.id);
      if (entry) entry.result = ev;
    } else if (ev.type === "text" && ev.content) {
      const last = orderedBlocks[orderedBlocks.length - 1];
      if (last?.type === "text") {
        last.content += ev.content;
      } else {
        orderedBlocks.push({ type: "text", content: ev.content });
      }
    }
  }

  const fullText = orderedBlocks
    .filter((b): b is { type: "text"; content: string } => b.type === "text")
    .map(b => b.content)
    .join("\n\n");

  return (
    <div className="space-y-2 group relative">
      {fullText && (
        <div className="absolute -top-1 right-0">
          <CopyButton text={fullText} />
        </div>
      )}
      {orderedBlocks.map((block, i) => {
        if (block.type === "text") {
          return (
            <div
              key={i}
              className="prose prose-sm max-w-none text-sm text-foreground
                [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:text-xs [&_pre]:overflow-x-auto
                [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
                [&_table]:w-full [&_th]:text-left [&_th]:font-semibold [&_th]:pb-1
                [&_tr]:border-b [&_tr]:border-border"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.content}</ReactMarkdown>
            </div>
          );
        }
        const entry = toolCallMap.get(block.id);
        if (!entry) return null;
        return <ToolCallBlock key={i} event={entry.call} result={entry.result} />;
      })}
    </div>
  );
}

function ElapsedTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return (
    <span className="tabular-nums">
      {m > 0 ? `${m}m ` : ""}{s}s
    </span>
  );
}

const STARTER_PROMPTS: { label: string; prompt: string; icon: any; color: string }[] = [
  {
    label: "Scan for errors",
    prompt: "Run a full error scan: check TypeScript errors and app health, then summarize all issues found with suggested fixes.",
    icon: ShieldAlert,
    color: "text-red-600 border-red-200 hover:border-red-400 hover:bg-red-50",
  },
  {
    label: "Health check",
    prompt: "Run a complete app health check — dependencies, database, schema, and code quality indicators.",
    icon: Stethoscope,
    color: "text-emerald-600 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50",
  },
  {
    label: "Project overview",
    prompt: "Show me the full project structure and explain the main files, architecture decisions, and data flow.",
    icon: GitBranch,
    color: "text-blue-600 border-blue-200 hover:border-blue-400 hover:bg-blue-50",
  },
  {
    label: "Database overview",
    prompt: "Show me the database schema, list all tables with row counts, and explain the main relationships.",
    icon: Database,
    color: "text-orange-600 border-orange-200 hover:border-orange-400 hover:bg-orange-50",
  },
  {
    label: "Security review",
    prompt: "Review server/routes.ts and server/agent/tools.ts for security vulnerabilities, missing auth checks, or unsafe data handling.",
    icon: Activity,
    color: "text-purple-600 border-purple-200 hover:border-purple-400 hover:bg-purple-50",
  },
  {
    label: "Performance audit",
    prompt: "Scan the codebase for performance issues: N+1 queries, missing indexes, large bundle imports, and slow API endpoints.",
    icon: BarChart3,
    color: "text-cyan-600 border-cyan-200 hover:border-cyan-400 hover:bg-cyan-50",
  },
];

export default function AgentConsole() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [pendingEvents, setPendingEvents] = useState<AgentEvent[]>([]);
  const [currentIteration, setCurrentIteration] = useState(0);
  const [runStartTime, setRunStartTime] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<AgentModel>("opus");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const activeConv = conversations.find((c) => c.id === activeId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.events, pendingEvents]);

  const newConversation = useCallback(() => {
    const id = `conv_${Date.now()}`;
    const conv: Conversation = {
      id,
      title: "New Session",
      events: [],
      history: [],
      createdAt: new Date(),
      model: selectedModel,
    };
    setConversations((prev) => [conv, ...prev]);
    setActiveId(id);
    setPendingEvents([]);
    return conv;
  }, [selectedModel]);

  const deleteConversation = useCallback((id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setPendingEvents([]);
    }
  }, [activeId]);

  const runAgent = useCallback(async (message: string, conv?: Conversation, modelOverride?: AgentModel) => {
    if (isRunning || !message.trim()) return;

    const model = modelOverride ?? selectedModel;
    const targetConv = conv ?? activeConv ?? newConversation();
    const msgText = message.trim();
    setInput("");
    setIsRunning(true);
    setCurrentIteration(0);
    setRunStartTime(Date.now());

    const userEvent: AgentEvent = { type: "user", content: msgText };
    const thinkingEvent: AgentEvent = { type: "thinking" };
    setPendingEvents([userEvent, thinkingEvent]);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const token = await (window as any).firebase?.apps?.[0]?.auth?.()?.currentUser?.getIdToken?.();

      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-ID": String(user?.id ?? ""),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: msgText, history: targetConv.history, model }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      const collectedEvents: AgentEvent[] = [userEvent];
      let currentPending: AgentEvent[] = [userEvent, thinkingEvent];
      let finalElapsed = 0;
      let finalIterations = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev: AgentEvent = JSON.parse(line.slice(6));

            if (ev.type === "thinking") {
              setCurrentIteration(ev.iteration ?? 0);
              currentPending = [...collectedEvents, thinkingEvent];
            } else if (ev.type === "done") {
              finalElapsed = ev.elapsed ?? 0;
              finalIterations = ev.iterations ?? 0;
              currentPending = collectedEvents;
            } else if (ev.type === "error") {
              collectedEvents.push(ev);
              currentPending = collectedEvents;
            } else {
              collectedEvents.push(ev);
              currentPending = [...collectedEvents, thinkingEvent];
            }

            setPendingEvents([...currentPending]);
          } catch {}
        }
      }

      const finalTitle = msgText.slice(0, 50) + (msgText.length > 50 ? "…" : "");

      setConversations((prev) =>
        prev.map((c) =>
          c.id === targetConv.id
            ? {
                ...c,
                title: c.title === "New Session" ? finalTitle : c.title,
                model,
                totalElapsed: finalElapsed,
                totalIterations: finalIterations,
                events: [...c.events, ...collectedEvents],
                history: [
                  ...c.history,
                  { role: "user", content: msgText },
                  {
                    role: "assistant",
                    content: collectedEvents
                      .filter((e) => e.type === "text")
                      .map((e) => e.content)
                      .join(""),
                  },
                ],
              }
            : c
        )
      );
      setPendingEvents([]);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        toast({ title: "Agent error", description: err.message, variant: "destructive" });
        setPendingEvents([]);
      }
    } finally {
      setIsRunning(false);
      setRunStartTime(null);
      setCurrentIteration(0);
    }
  }, [isRunning, activeConv, newConversation, user, toast, selectedModel]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      runAgent(input);
    }
  };

  const stopAgent = () => {
    abortRef.current?.abort();
    setIsRunning(false);
    setPendingEvents([]);
    setRunStartTime(null);
    setCurrentIteration(0);
  };

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Admin access required.</p>
      </div>
    );
  }

  const displayEvents = activeConv
    ? [
        ...activeConv.events,
        ...pendingEvents.filter(
          (e) => e.type !== "user" || !activeConv.events.some((ae) => ae.type === "user" && ae.content === e.content)
        ),
      ]
    : pendingEvents;

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[600px] border border-border rounded-xl overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-60 border-r border-border flex flex-col bg-muted/20 shrink-0">
        <div className="p-3 border-b border-border space-y-2">
          <Button
            size="sm"
            className="w-full gap-2"
            onClick={newConversation}
            data-testid="button-new-agent-session"
          >
            <Plus className="w-4 h-4" />
            New Session
          </Button>

          {/* Model selector */}
          <div className="flex gap-1 bg-muted rounded-lg p-0.5">
            {MODEL_OPTIONS.map((m) => (
              <button
                key={m.key}
                onClick={() => setSelectedModel(m.key)}
                disabled={isRunning}
                className={cn(
                  "flex-1 text-[10px] font-medium py-1 rounded-md transition-all",
                  selectedModel === m.key
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                data-testid={`model-select-${m.key}`}
                title={m.desc}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {conversations.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6 px-3">
                Start a new session to begin
              </p>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={cn(
                    "group flex items-start gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-xs transition-colors",
                    activeId === conv.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted text-foreground"
                  )}
                  onClick={() => { setActiveId(conv.id); setPendingEvents([]); }}
                  data-testid={`session-item-${conv.id}`}
                >
                  <Bot className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-60" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate leading-relaxed">{conv.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground">
                      <span className={cn("font-medium", MODEL_OPTIONS.find(m => m.key === conv.model)?.color)}>
                        {MODEL_OPTIONS.find(m => m.key === conv.model)?.label ?? conv.model}
                      </span>
                      {conv.totalElapsed && (
                        <>
                          <span>·</span>
                          <span>{conv.totalElapsed}s</span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity mt-0.5"
                    onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                    data-testid={`delete-session-${conv.id}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <span>
              {MODEL_OPTIONS.find(m => m.key === selectedModel)?.label ?? selectedModel}
            </span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold">AI Coding Agent</h2>
            <p className="text-xs text-muted-foreground truncate">
              Reads, writes, and fixes your codebase — including real-time error scanning
            </p>
          </div>

          {/* Live status when running */}
          {isRunning && runStartTime && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/60 rounded-lg px-3 py-1.5 shrink-0">
              <Loader2 className="w-3 h-3 animate-spin text-primary" />
              <span>Step {currentIteration}</span>
              <span className="text-border">·</span>
              <Clock className="w-3 h-3" />
              <ElapsedTimer startTime={runStartTime} />
            </div>
          )}

          <Badge variant="outline" className="text-xs gap-1 text-primary border-primary/30 shrink-0">
            <Cpu className="w-3 h-3" />
            Agent Mode
          </Badge>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1">
          <div className="max-w-3xl mx-auto px-5 py-6 space-y-6">
            {displayEvents.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 gap-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Zap className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1">Advanced Coding Agent</h3>
                  <p className="text-muted-foreground text-sm max-w-sm">
                    Ask me to scan for errors, review code, fix bugs, add features, or explain anything in your codebase.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
                  {STARTER_PROMPTS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.label}
                        className={cn(
                          "flex items-start gap-3 text-left px-4 py-3 rounded-xl border transition-colors",
                          item.color
                        )}
                        onClick={() => {
                          const conv = newConversation();
                          runAgent(item.prompt, conv);
                        }}
                        data-testid={`starter-${item.label.replace(/\s+/g, "-").toLowerCase()}`}
                      >
                        <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold">{item.label}</p>
                          <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">{item.prompt}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Render events */}
            {(() => {
              const blocks: Array<{ type: "user" | "agent"; events: AgentEvent[] }> = [];
              let currentAgentBlock: AgentEvent[] = [];

              for (const ev of displayEvents) {
                if (ev.type === "user") {
                  if (currentAgentBlock.length > 0) {
                    blocks.push({ type: "agent", events: [...currentAgentBlock] });
                    currentAgentBlock = [];
                  }
                  blocks.push({ type: "user", events: [ev] });
                } else {
                  currentAgentBlock.push(ev);
                }
              }
              if (currentAgentBlock.length > 0) {
                blocks.push({ type: "agent", events: [...currentAgentBlock] });
              }

              return blocks.map((block, i) => {
                if (block.type === "user") {
                  return (
                    <div key={i} className="flex justify-end" data-testid="message-user">
                      <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-3 text-sm">
                        <p className="whitespace-pre-wrap">{block.events[0].content}</p>
                      </div>
                    </div>
                  );
                }

                const hasThinking = block.events.some((e) => e.type === "thinking");
                const agentEvents = block.events.filter((e) => e.type !== "thinking");
                const hasContent = agentEvents.length > 0;
                const doneEvent = block.events.find(e => e.type === "done");

                return (
                  <div key={i} className="flex gap-3 items-start" data-testid="message-agent">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      {hasThinking && !hasContent ? (
                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                      ) : (
                        <Bot className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {hasThinking && !hasContent && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                          <span className="flex gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
                          </span>
                          <span>
                            Agent is working
                            {isRunning && currentIteration > 0 ? ` · step ${currentIteration}` : "…"}
                          </span>
                        </div>
                      )}
                      {hasContent && <AgentMessage events={agentEvents} />}
                      {doneEvent && (doneEvent.elapsed || doneEvent.iterations) && (
                        <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                          {doneEvent.iterations && <span>{doneEvent.iterations} step{doneEvent.iterations !== 1 ? "s" : ""}</span>}
                          {doneEvent.elapsed && doneEvent.iterations && <span>·</span>}
                          {doneEvent.elapsed && <span>{doneEvent.elapsed}s</span>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              });
            })()}

            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="px-5 pb-4 pt-3 border-t border-border shrink-0">
          <div className="max-w-3xl mx-auto">
            {/* Quick action buttons */}
            <div className="flex gap-1.5 mb-2 flex-wrap">
              <button
                onClick={() => {
                  const conv = activeConv ?? newConversation();
                  runAgent("Run check_typescript and check_app_health tools, then give me a full report of all errors and issues found.", conv);
                }}
                disabled={isRunning}
                className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-400 transition-colors disabled:opacity-40"
                data-testid="button-quick-scan-errors"
              >
                <ShieldAlert className="w-3 h-3" />
                Scan Errors
              </button>
              <button
                onClick={() => {
                  const conv = activeConv ?? newConversation();
                  runAgent("Run check_app_health and give me a summary.", conv);
                }}
                disabled={isRunning}
                className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-400 transition-colors disabled:opacity-40"
                data-testid="button-quick-health"
              >
                <Stethoscope className="w-3 h-3" />
                Health Check
              </button>
              <button
                onClick={() => {
                  const conv = activeConv ?? newConversation();
                  runAgent("Show me the full project tree and explain the architecture.", conv);
                }}
                disabled={isRunning}
                className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-400 transition-colors disabled:opacity-40"
                data-testid="button-quick-project-tree"
              >
                <FolderOpen className="w-3 h-3" />
                Project Tree
              </button>
              <button
                onClick={() => {
                  const conv = activeConv ?? newConversation();
                  runAgent("Run: SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size FROM pg_tables WHERE schemaname='public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;", conv);
                }}
                disabled={isRunning}
                className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg border border-orange-200 text-orange-600 hover:bg-orange-50 hover:border-orange-400 transition-colors disabled:opacity-40"
                data-testid="button-quick-db"
              >
                <Database className="w-3 h-3" />
                DB Status
              </button>
            </div>

            <div className="flex gap-2 items-end">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask the agent to scan errors, fix bugs, add features, or explain anything… (Enter to send)"
                className="min-h-[52px] max-h-40 resize-none rounded-xl text-sm"
                disabled={isRunning}
                rows={1}
                data-testid="agent-input"
              />
              {isRunning ? (
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-xl w-11 h-11 shrink-0 border-red-200 text-red-600 hover:bg-red-50"
                  onClick={stopAgent}
                  data-testid="button-stop-agent"
                  title="Stop agent"
                >
                  <Square className="w-4 h-4 fill-current" />
                </Button>
              ) : (
                <Button
                  onClick={() => runAgent(input)}
                  disabled={!input.trim()}
                  size="icon"
                  className="rounded-xl w-11 h-11 shrink-0"
                  data-testid="button-send-agent"
                >
                  <Send className="w-4 h-4" />
                </Button>
              )}
            </div>
            <p className="text-center text-xs text-muted-foreground mt-2">
              Using {MODEL_OPTIONS.find(m => m.key === selectedModel)?.label} · Full file, command, database, and error-scan access
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
