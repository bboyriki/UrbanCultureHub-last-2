import { useState } from "react";
import { Sparkles, Copy, Loader2, Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAIAccess } from "@/hooks/useAIAccess";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface ReelCaptionResult {
  caption: string;
  hashtags: string[];
  callToAction: string;
}

interface AIReelCaptionProps {
  onInsert?: (caption: string) => void;
}

export default function AIReelCaption({ onInsert }: AIReelCaptionProps) {
  const access = useAIAccess();
  const { user } = useAuth();
  const { toast } = useToast();
  const [topic, setTopic] = useState("");
  const [vibe, setVibe] = useState("raw en authentiek");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReelCaptionResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [showHelper, setShowHelper] = useState(false);

  if (!user) return null;
  if (!showHelper) {
    return (
      <button
        data-testid="btn-ai-reel-caption-open"
        onClick={() => setShowHelper(true)}
        className="flex items-center gap-1.5 text-[11px] font-medium text-purple-600 hover:text-purple-800 transition-colors"
      >
        <Sparkles className="w-3.5 h-3.5" />
        AI Caption schrijven
      </button>
    );
  }

  const generate = async () => {
    if (!access.hasAccess) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await fetch("/api/ai/reels/caption", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, vibe, artType: user.artType }),
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

  const fullCaption = result ? `${result.caption}\n${result.callToAction ? result.callToAction + "\n" : ""}${result.hashtags?.join(" ")}` : "";

  const copy = async () => {
    try { await navigator.clipboard.writeText(fullCaption); } catch (_) {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (onInsert) onInsert(fullCaption);
  };

  const VIBES = ["raw en authentiek", "energiek", "inspirerend", "grappig", "chill en relaxed"];

  return (
    <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-violet-600" />
          <span className="text-[12px] font-semibold text-violet-800 dark:text-violet-300">AI Caption</span>
          {!access.hasAccess && <Lock className="w-3 h-3 text-muted-foreground/50" />}
        </div>
        <button onClick={() => setShowHelper(false)} className="text-[10px] text-muted-foreground hover:text-foreground">verberg</button>
      </div>

      {!access.hasAccess ? (
        <div className="text-center py-2 space-y-1.5">
          <p className="text-[11px] text-muted-foreground">AI captions zijn beschikbaar voor Premium leden.</p>
          <Link href="/ai-assistant">
            <Button size="sm" className="text-xs h-7 bg-violet-600 hover:bg-violet-700">Upgrade</Button>
          </Link>
        </div>
      ) : (
        <>
          <Input
            data-testid="input-ai-reel-topic"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="Waar gaat je reel over? bv. 'mijn beste power move'"
            className="text-xs h-8 bg-white dark:bg-gray-900"
            onKeyDown={e => e.key === "Enter" && generate()}
          />

          <div className="flex gap-1 flex-wrap">
            {VIBES.map(v => (
              <button key={v} onClick={() => setVibe(v)}
                className={`text-[9px] px-1.5 py-0.5 rounded-full border transition-colors ${vibe === v ? "bg-violet-600 text-white border-violet-600" : "border-border text-muted-foreground hover:border-violet-400"}`}>
                {v}
              </button>
            ))}
          </div>

          <Button
            data-testid="btn-ai-generate-reel-caption"
            onClick={generate}
            disabled={loading || !topic.trim()}
            size="sm"
            className="w-full h-7 text-[11px] bg-violet-600 hover:bg-violet-700"
          >
            {loading ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Genereren…</> : <><Sparkles className="w-3 h-3 mr-1" /> Genereer Caption</>}
          </Button>

          {result && (
            <div className="bg-white dark:bg-gray-900 rounded-lg p-2 border border-violet-200/60 space-y-1.5">
              <p className="text-xs font-medium">{result.caption}</p>
              {result.callToAction && <p className="text-[11px] text-violet-700 font-medium">{result.callToAction}</p>}
              {result.hashtags?.length > 0 && (
                <p className="text-[10px] text-muted-foreground leading-relaxed">{result.hashtags.join(" ")}</p>
              )}
              <div className="flex gap-1.5 pt-0.5">
                <Button
                  data-testid="btn-ai-copy-reel-caption"
                  size="sm"
                  className="flex-1 h-6 text-[10px] bg-violet-600 hover:bg-violet-700"
                  onClick={copy}
                >
                  {copied ? <><Check className="w-3 h-3 mr-0.5" /> Gekopieerd!</> : <><Copy className="w-3 h-3 mr-0.5" /> Gebruik deze caption</>}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
