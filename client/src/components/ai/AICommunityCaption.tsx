import { useState } from "react";
import { Sparkles, Copy, RefreshCw, ChevronDown, ChevronUp, Lock, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAIAccess } from "@/hooks/useAIAccess";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface CaptionResult {
  caption: string;
  hashtags: string[];
  alternatives: string[];
}

interface AICommunityCaption {
  onInsert?: (text: string) => void;
}

export default function AICommunityCaption({ onInsert }: AICommunityCaption) {
  const access = useAIAccess();
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [mood, setMood] = useState("energiek en authentiek");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CaptionResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  if (!user) return null;

  const generate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await fetch("/api/ai/community/caption", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, mood, artType: user.artType, city: user.city }),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (err: any) {
      toast({ title: "AI Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyAndInsert = async (text: string, withHashtags = false) => {
    const full = withHashtags && result
      ? `${text}\n\n${result.hashtags.join(" ")}`
      : text;
    try { await navigator.clipboard.writeText(full); } catch (_) {}
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
    if (onInsert) onInsert(full);
  };

  const MOODS = ["energiek en authentiek", "grappig en luchtig", "inspirerend", "serieus en diepgaand", "raw en direct"];

  return (
    <div className="rounded-xl border border-purple-200 dark:border-purple-800/40 bg-gradient-to-r from-purple-50 to-fuchsia-50 dark:from-purple-950/20 dark:to-fuchsia-950/20 overflow-hidden">
      <button
        data-testid="btn-ai-caption-toggle"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-purple-50/50 dark:hover:bg-purple-900/20 transition-colors"
      >
        <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
        <span className="text-[12px] font-semibold text-purple-800 dark:text-purple-300 flex-1 text-left">AI Caption Assistent</span>
        {!access.hasAccess && <Lock className="w-3 h-3 text-muted-foreground/50" />}
        {open ? <ChevronUp className="w-3.5 h-3.5 text-purple-400" /> : <ChevronDown className="w-3.5 h-3.5 text-purple-400" />}
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 space-y-2.5">
          {!access.hasAccess ? (
            <div className="text-center py-3 space-y-2">
              <p className="text-xs text-muted-foreground">AI Caption Assistent is beschikbaar voor Premium leden.</p>
              <Link href="/ai-assistant">
                <Button size="sm" className="text-xs h-7 bg-purple-600 hover:bg-purple-700">Upgrade naar Premium</Button>
              </Link>
            </div>
          ) : (
            <>
              <Input
                data-testid="input-ai-caption-topic"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="Waar gaat je post over? bv. 'mijn battle win gisteren'"
                className="text-xs h-8 bg-white dark:bg-gray-900"
                onKeyDown={e => e.key === "Enter" && generate()}
              />

              <div className="flex gap-1.5 flex-wrap">
                {MOODS.map(m => (
                  <button key={m} onClick={() => setMood(m)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${mood === m ? "bg-purple-600 text-white border-purple-600" : "border-border text-muted-foreground hover:border-purple-400"}`}>
                    {m}
                  </button>
                ))}
              </div>

              <Button
                data-testid="btn-ai-generate-caption"
                onClick={generate}
                disabled={loading || !topic.trim()}
                size="sm"
                className="w-full h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white"
              >
                {loading ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Genereren…</> : <><Sparkles className="w-3.5 h-3.5 mr-1" /> Genereer Caption</>}
              </Button>

              {result && (
                <div className="space-y-2">
                  {/* Main caption */}
                  <div className="bg-white dark:bg-gray-900 rounded-lg p-2.5 border border-purple-200/60 space-y-1.5">
                    <p className="text-[11px] font-medium text-purple-700 dark:text-purple-300">Caption:</p>
                    <p className="text-xs leading-relaxed">{result.caption}</p>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" className="h-6 text-[10px] border-purple-300 text-purple-700 flex-1"
                        onClick={() => copyAndInsert(result.caption, true)}>
                        {copied === result.caption ? <><Check className="w-3 h-3 mr-0.5" /> Gekopieerd!</> : <><Copy className="w-3 h-3 mr-0.5" /> Kopieer + hashtags</>}
                      </Button>
                      {onInsert && (
                        <Button size="sm" className="h-6 text-[10px] bg-purple-600 hover:bg-purple-700 flex-1"
                          onClick={() => copyAndInsert(result.caption, true)}>
                          Gebruik deze
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Hashtags */}
                  {result.hashtags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {result.hashtags.map(tag => (
                        <span key={tag} className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded-full">
                          {tag.startsWith("#") ? tag : `#${tag}`}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Alternatives */}
                  {result.alternatives?.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-medium text-muted-foreground">Alternatieven:</p>
                      {result.alternatives.map((alt, i) => (
                        <div key={i} className="flex items-center gap-1.5 bg-white dark:bg-gray-900 rounded-lg px-2.5 py-1.5 border border-border/50">
                          <p className="text-[11px] flex-1">{alt}</p>
                          <button onClick={() => copyAndInsert(alt, false)} className="text-muted-foreground hover:text-purple-600">
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button onClick={generate} disabled={loading} className="flex items-center gap-1 text-[10px] text-purple-600 hover:text-purple-800">
                    <RefreshCw className="w-3 h-3" /> Opnieuw genereren
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
