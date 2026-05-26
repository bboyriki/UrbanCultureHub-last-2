import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot, Send, Plus, Trash2, MessageSquare, Loader2, ChevronLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface Conversation {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: number;
  conversationId: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface ConversationWithMessages extends Conversation {
  messages: Message[];
}

function MarkdownText({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: JSX.Element[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={i} className="bg-[hsl(220,13%,95%)] rounded-lg p-3 overflow-x-auto my-2 text-sm font-mono">
          {lang && <div className="text-xs text-muted-foreground mb-1">{lang}</div>}
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
    } else if (line.startsWith("### ")) {
      elements.push(<h3 key={i} className="font-semibold text-sm mt-3 mb-1">{line.slice(4)}</h3>);
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={i} className="font-semibold mt-3 mb-1">{line.slice(3)}</h2>);
    } else if (line.startsWith("# ")) {
      elements.push(<h1 key={i} className="font-bold text-lg mt-3 mb-1">{line.slice(2)}</h1>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(<li key={i} className="ml-4 list-disc">{formatInline(line.slice(2))}</li>);
    } else if (/^\d+\. /.test(line)) {
      elements.push(<li key={i} className="ml-4 list-decimal">{formatInline(line.replace(/^\d+\. /, ""))}</li>);
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(<p key={i} className="leading-relaxed">{formatInline(line)}</p>);
    }
    i++;
  }

  return <div className="text-sm space-y-0.5">{elements}</div>;
}

function formatInline(text: string): JSX.Element {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith("`") && part.endsWith("`")) {
          return <code key={idx} className="bg-[hsl(220,13%,95%)] px-1 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
        }
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={idx}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("*") && part.endsWith("*")) {
          return <em key={idx}>{part.slice(1, -1)}</em>;
        }
        return <span key={idx}>{part}</span>;
      })}
    </>
  );
}

export default function AiAgentPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { data: conversations = [], isLoading: convLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/ai/conversations"],
    enabled: !!user,
  });

  const { data: activeConv } = useQuery<ConversationWithMessages>({
    queryKey: ["/api/ai/conversations", activeConvId],
    enabled: !!activeConvId,
  });

  const createConv = useMutation({
    mutationFn: () => apiRequest("/api/ai/conversations", "POST", { title: "New Chat" }),
    onSuccess: (conv: Conversation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/conversations"] });
      setActiveConvId(conv.id);
    },
  });

  const deleteConv = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/ai/conversations/${id}`, "DELETE"),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/conversations"] });
      if (activeConvId === id) setActiveConvId(null);
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages, streamingContent]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming || !activeConvId) return;

    const text = input.trim();
    setInput("");
    setStreamingContent("");
    setIsStreaming(true);

    queryClient.setQueryData<ConversationWithMessages>(
      ["/api/ai/conversations", activeConvId],
      (old) => old ? {
        ...old,
        messages: [...(old.messages || []), {
          id: Date.now(),
          conversationId: activeConvId,
          role: "user" as const,
          content: text,
          createdAt: new Date().toISOString(),
        }],
      } : old
    );

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const token = await (window as any).firebase?.auth()?.currentUser?.getIdToken();
      const res = await fetch(`/api/ai/conversations/${activeConvId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content: text }),
        signal: ctrl.signal,
      });

      if (!res.ok) throw new Error("Request failed");

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                accumulated += data.content;
                setStreamingContent(accumulated);
              }
              if (data.done) {
                await queryClient.invalidateQueries({ queryKey: ["/api/ai/conversations", activeConvId] });
                await queryClient.invalidateQueries({ queryKey: ["/api/ai/conversations"] });
                setStreamingContent("");
              }
            } catch {}
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        toast({ title: "Error", description: "Failed to get AI response", variant: "destructive" });
      }
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
    }
  }, [input, isStreaming, activeConvId, queryClient, toast]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const messages = activeConv?.messages ?? [];
  const displayMessages = [...messages];
  if (streamingContent) {
    displayMessages.push({
      id: -1,
      conversationId: activeConvId!,
      role: "assistant",
      content: streamingContent,
      createdAt: new Date().toISOString(),
    });
  }

  const suggestions = [
    "What features does Urban Culture Connect have?",
    "Help me write a bio for my artist profile",
    "How do I create an event on the platform?",
    "Explain the nearby discovery feature",
  ];

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-4 text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Bot className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">Sign in to use AI Assistant</h2>
        <p className="text-muted-foreground max-w-xs">The AI assistant is available to signed-in users.</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r border-border bg-background transition-all duration-200",
          sidebarOpen ? "w-64 min-w-[16rem]" : "w-0 min-w-0 overflow-hidden"
        )}
        data-testid="ai-sidebar"
      >
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <Button
            variant="default"
            size="sm"
            className="flex-1 justify-start gap-2"
            onClick={() => createConv.mutate()}
            disabled={createConv.isPending}
            data-testid="button-new-chat"
          >
            {createConv.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            New Chat
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {convLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : conversations.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No conversations yet</p>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={cn(
                    "group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors",
                    activeConvId === conv.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted text-foreground"
                  )}
                  onClick={() => setActiveConvId(conv.id)}
                  data-testid={`conv-item-${conv.id}`}
                >
                  <MessageSquare className="w-4 h-4 shrink-0 opacity-60" />
                  <span className="flex-1 truncate">{conv.title}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-6 h-6 opacity-0 group-hover:opacity-100 shrink-0"
                    onClick={(e) => { e.stopPropagation(); deleteConv.mutate(conv.id); }}
                    data-testid={`button-delete-conv-${conv.id}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            data-testid="button-toggle-sidebar"
          >
            <ChevronLeft className={cn("w-4 h-4 transition-transform", !sidebarOpen && "rotate-180")} />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium leading-none">AI Assistant</p>
              <p className="text-xs text-muted-foreground">Powered by Claude</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {!activeConvId ? (
              <div className="flex flex-col items-center justify-center py-16 gap-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Bot className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold mb-1">How can I help you?</h2>
                  <p className="text-muted-foreground text-sm">
                    Ask me anything about Urban Culture Connect, get help with your profile, or just chat.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={async () => {
                        const conv = await createConv.mutateAsync();
                        setActiveConvId((conv as Conversation).id);
                        setInput(s);
                      }}
                      className="text-left px-4 py-3 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors text-sm text-foreground"
                      data-testid={`suggestion-${s.slice(0, 10)}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <Button
                  onClick={() => createConv.mutate()}
                  disabled={createConv.isPending}
                  data-testid="button-start-chat"
                >
                  {createConv.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Start a new chat
                </Button>
              </div>
            ) : displayMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <MessageSquare className="w-10 h-10 text-muted-foreground/40" />
                <p className="text-muted-foreground text-sm">Send a message to start the conversation</p>
              </div>
            ) : (
              displayMessages.map((msg, idx) => (
                <div
                  key={msg.id === -1 ? `streaming-${idx}` : msg.id}
                  className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}
                  data-testid={`message-${msg.role}-${idx}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-3",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    )}
                  >
                    {msg.role === "assistant" ? (
                      <MarkdownText content={msg.content} />
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    )}
                    {msg.id === -1 && (
                      <span className="inline-block w-1.5 h-4 bg-current animate-pulse ml-0.5 align-text-bottom" />
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        {activeConvId && (
          <div className="px-4 pb-4 pt-2 border-t border-border shrink-0">
            <div className="max-w-3xl mx-auto flex gap-2 items-end">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message AI assistant… (Enter to send, Shift+Enter for new line)"
                className="min-h-[52px] max-h-40 resize-none rounded-xl border-border focus:border-primary/40 text-sm"
                disabled={isStreaming}
                rows={1}
                data-testid="input-message"
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isStreaming}
                size="icon"
                className="rounded-xl w-11 h-11 shrink-0"
                data-testid="button-send"
              >
                {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground mt-2">
              AI can make mistakes. Verify important information.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
