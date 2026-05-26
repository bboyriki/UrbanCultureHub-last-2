import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  ShoppingCart, Search, Send, Loader2, ExternalLink, RefreshCw,
  TrendingDown, Star, Euro, Zap, Bot, User, Trash2, Globe, Package
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ParsedDeal {
  name: string;
  price?: string;
  store?: string;
  url?: string;
  description?: string;
  rating?: string;
  isHighlight?: boolean;
}

const STARTER_SEARCHES = [
  "Best gaming PC under €1000 in the Netherlands",
  "RTX 4070 graphics card — cheapest deals now",
  "Affordable mechanical keyboard + mouse combo",
  "MacBook Air vs Dell XPS 13 — price comparison",
  "Best DJ controller for beginners under €300",
  "Noise-cancelling headphones under €150",
];

function parseDealMentions(text: string): ParsedDeal[] {
  const deals: ParsedDeal[] = [];
  const urlRegex = /https?:\/\/[^\s\)\"\']+/g;
  const priceRegex = /€\s*[\d,\.]+|[\d,\.]+\s*euro/gi;
  const urls = text.match(urlRegex) || [];
  const prices = text.match(priceRegex) || [];

  if (urls.length === 0 && prices.length === 0) return deals;

  const lines = text.split("\n").filter(l => l.trim());
  for (const line of lines) {
    const hasPrice = priceRegex.test(line);
    const hasUrl = urlRegex.test(line);
    if (hasPrice || hasUrl) {
      const priceMatch = line.match(/€\s*[\d,\.]+|[\d,\.]+\s*euro/i);
      const urlMatch = line.match(/https?:\/\/[^\s\)\"\']+/);
      const storeMatch = line.match(/\[(.*?)\]|\*\*(.*?)\*\*|•\s+(.*?)[:–-]/);
      deals.push({
        name: line.replace(/https?:\/\/\S+/g, "").replace(/€\s*[\d,\.]+/g, "").trim().slice(0, 80),
        price: priceMatch ? priceMatch[0].trim() : undefined,
        url: urlMatch ? urlMatch[0] : undefined,
        store: storeMatch ? (storeMatch[1] || storeMatch[2] || storeMatch[3])?.trim() : undefined,
      });
    }
  }

  return deals.slice(0, 8);
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} mb-4`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isUser ? "bg-primary text-primary-foreground" : "bg-amber-500/20 border border-amber-500/40"}`}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
      </div>
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${isUser ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted/60 border border-border rounded-tl-sm"}`}>
        <div className="whitespace-pre-wrap break-words">
          {msg.content.split("\n").map((line, i, arr) => {
            const urlMatch = line.match(/https?:\/\/[^\s\)\"\']+/);
            if (urlMatch) {
              const parts = line.split(urlMatch[0]);
              const before = parts[0] || "";
              const after = parts.slice(1).join(urlMatch[0]) || "";
              return (
                <span key={i}>
                  {before}
                  <a href={urlMatch[0]} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-500 hover:underline font-medium">
                    <ExternalLink className="w-3 h-3" />{urlMatch[0].replace(/^https?:\/\/(www\.)?/, "").slice(0, 40)}
                  </a>
                  {after}
                  {i < arr.length - 1 && <br />}
                </span>
              );
            }
            const boldLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            return (
              <span key={i}>
                <span dangerouslySetInnerHTML={{ __html: boldLine }} />
                {i < arr.length - 1 && <br />}
              </span>
            );
          })}
        </div>
        <div className={`mt-1.5 text-xs opacity-50 ${isUser ? "text-right" : ""}`}>
          {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}

export default function AdminDealFinder() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || streaming) return;

    const userMsg: Message = { role: "user", content, timestamp: new Date() };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput("");
    setStreaming(true);
    setStreamingContent("");

    try {
      const res = await fetch("/api/admin/deal-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newHistory.map(m => ({ role: m.role, content: m.content })),
        }),
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Search failed");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let lineBuffer = "";
      let finished = false;

      if (reader) {
        while (!finished) {
          const { done, value } = await reader.read();
          if (done) break;
          lineBuffer += decoder.decode(value, { stream: true });
          const lines = lineBuffer.split("\n");
          lineBuffer = lines.pop() ?? "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === "text") {
                  accumulated += data.text;
                  setStreamingContent(accumulated);
                } else if (data.type === "done") {
                  finished = true;
                  break;
                } else if (data.type === "error") {
                  throw new Error(data.message || "Search failed");
                }
              } catch (parseErr: any) {
                if (parseErr.message !== "Search failed") {
                  // ignore JSON parse errors from partial keep-alive lines
                }
              }
            }
          }
        }
      }

      if (accumulated) {
        const assistantMsg: Message = {
          role: "assistant",
          content: accumulated,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMsg]);
      }
    } catch (err: any) {
      toast({ title: "Search failed", description: err.message, variant: "destructive" });
    } finally {
      setStreaming(false);
      setStreamingContent("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setStreamingContent("");
    setInput("");
  };

  const hasMessages = messages.length > 0 || streaming;

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[500px] max-h-[800px]">
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <ShoppingCart className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="font-semibold text-base">Real-Time Deal Finder</h2>
            <p className="text-xs text-muted-foreground">Searches the live web for current prices & offers</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs gap-1 border-green-500/40 text-green-600 dark:text-green-400">
            <Zap className="w-3 h-3" /> Live Search
          </Badge>
          {hasMessages && (
            <Button variant="ghost" size="sm" onClick={clearChat} className="gap-1 text-xs">
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </Button>
          )}
        </div>
      </div>

      {!hasMessages ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-3">
              <Globe className="w-8 h-8 text-amber-500" />
            </div>
            <h3 className="font-semibold text-lg">Ask about any product</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Ask about electronics, gear, equipment — get real-time prices from the web, best deals, price comparisons, and buying advice.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
            {STARTER_SEARCHES.map((s, i) => (
              <button
                key={i}
                onClick={() => sendMessage(s)}
                className="text-left text-xs px-3 py-2.5 rounded-xl border border-border bg-muted/40 hover:bg-muted/80 hover:border-amber-500/30 transition-all group"
                data-testid={`deal-starter-${i}`}
              >
                <Search className="w-3 h-3 text-muted-foreground group-hover:text-amber-500 inline mr-1.5 transition-colors" />
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1 pr-1" ref={scrollRef}>
          <div className="px-1 py-2">
            {messages.map((m, i) => <MessageBubble key={i} msg={m} />)}
            {streaming && (
              <div className="flex gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="max-w-[85%] bg-muted/60 border border-border rounded-2xl rounded-tl-sm px-4 py-3">
                  {streamingContent ? (
                    <div className="text-sm leading-relaxed whitespace-pre-wrap">{streamingContent}
                      <span className="inline-block w-1.5 h-3.5 bg-primary ml-0.5 animate-pulse rounded-sm" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Searching the web for deals...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      <div className="pt-3 border-t border-border mt-2">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="e.g. 'Best gaming monitor under €400' or 'Compare RTX 4070 prices in Netherlands'..."
            disabled={streaming}
            className="text-sm"
            data-testid="input-deal-search"
          />
          <Button
            onClick={() => sendMessage()}
            disabled={!input.trim() || streaming}
            size="icon"
            data-testid="button-send-deal"
            className="bg-amber-500 hover:bg-amber-600 text-white shrink-0"
          >
            {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5 text-center">
          Powered by Claude with live web search • Results are real-time from the web
        </p>
      </div>
    </div>
  );
}
