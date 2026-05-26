import { useState } from "react";
import { Sparkles, Search, ChevronDown, ChevronUp, Lock, Loader2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAIAccess } from "@/hooks/useAIAccess";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface EventRecommendation {
  id: number;
  reason: string;
  highlight: string;
}

interface AIEventFinderProps {
  events: Array<{ id: number; title: string; category?: string; location?: string; date?: string }>;
  onHighlight?: (ids: number[]) => void;
}

export default function AIEventFinder({ events, onHighlight }: AIEventFinderProps) {
  const access = useAIAccess();
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ recommendations: EventRecommendation[]; summary: string } | null>(null);

  if (!user) return null;

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResults(null);
    try {
      const r = await fetch("/api/ai/events/recommend", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, events }),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setResults(data);
      if (onHighlight && data.recommendations) {
        onHighlight(data.recommendations.map((r: EventRecommendation) => r.id));
      }
    } catch (err: any) {
      toast({ title: "AI Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 to-purple-50 dark:from-primary/10 dark:to-purple-950/20 overflow-hidden mb-4">
      {/* Header toggle */}
      <button
        data-testid="btn-ai-event-finder-toggle"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary/5 transition-colors"
      >
        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 text-left">
          <span className="text-[13px] font-semibold">AI Event Finder</span>
          <span className="text-[11px] text-muted-foreground ml-2">Beschrijf wat je zoekt</span>
        </div>
        {!access.hasAccess && <Lock className="w-3.5 h-3.5 text-muted-foreground/60" />}
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {!access.hasAccess ? (
            <div className="text-center py-4 space-y-2">
              <Lock className="w-6 h-6 text-muted-foreground/40 mx-auto" />
              <p className="text-xs text-muted-foreground">AI Event Finder is beschikbaar voor Premium leden.</p>
              <Link href="/ai-assistant">
                <Button size="sm" className="text-xs h-7">Upgrade naar Premium</Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <Input
                  data-testid="input-ai-event-query"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="bv. 'een breakdance battle dit weekend' of 'gratis muziek event'"
                  className="text-sm h-9 bg-white dark:bg-gray-900"
                  onKeyDown={e => e.key === "Enter" && handleSearch()}
                />
                <Button
                  data-testid="btn-ai-event-search"
                  onClick={handleSearch}
                  disabled={loading || !query.trim()}
                  size="sm"
                  className="h-9 shrink-0"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                </Button>
              </div>

              {loading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  AI zoekt de beste events voor jou…
                </div>
              )}

              {results && (
                <div className="space-y-2">
                  {results.summary && (
                    <p className="text-[12px] text-primary font-medium bg-primary/10 rounded-lg px-3 py-1.5">
                      {results.summary}
                    </p>
                  )}
                  {results.recommendations?.map((rec, i) => (
                    <div key={rec.id} className="flex gap-2.5 bg-white dark:bg-gray-900 rounded-xl px-3 py-2.5 border border-border/50">
                      <div className="w-6 h-6 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <Calendar className="w-3 h-3 text-primary shrink-0" />
                          <p className="text-[12px] font-semibold truncate">
                            {events.find(e => e.id === rec.id)?.title || `Event #${rec.id}`}
                          </p>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{rec.reason}</p>
                        {rec.highlight && (
                          <p className="text-[10px] text-primary/80 mt-0.5 font-medium">✦ {rec.highlight}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-1.5 flex-wrap">
                {["breakdance battle dit weekend", "gratis events Amsterdam", "muziek event aankomende week", "workshop voor beginners"].map(s => (
                  <button
                    key={s}
                    onClick={() => setQuery(s)}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
