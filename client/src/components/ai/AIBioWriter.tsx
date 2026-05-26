import { useState } from "react";
import { Sparkles, Loader2, Check, RefreshCw, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAIAccess } from "@/hooks/useAIAccess";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface BioResult {
  bio: string;
  alternatives: string[];
}

interface AIBioWriterProps {
  onApply?: (bio: string) => void;
  currentBio?: string;
}

export default function AIBioWriter({ onApply, currentBio }: AIBioWriterProps) {
  const access = useAIAccess();
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [highlights, setHighlights] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BioResult | null>(null);
  const [applied, setApplied] = useState<string | null>(null);

  if (!user) return null;

  const generate = async () => {
    setLoading(true);
    setResult(null);
    try {
      const r = await fetch("/api/ai/profile/bio", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: user.displayName,
          artType: user.artType,
          city: user.city,
          highlights: highlights || currentBio || "",
        }),
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

  const handleApply = (bio: string) => {
    if (onApply) onApply(bio);
    setApplied(bio);
    setOpen(false);
    toast({ title: "Bio toegepast!", description: "Vergeet niet op Opslaan te klikken." });
  };

  if (!open) {
    return (
      <button
        data-testid="btn-ai-bio-open"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
      >
        <Sparkles className="w-3.5 h-3.5" />
        {applied ? "AI bio gebruikt ✓" : "AI bio schrijven"}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-blue-50 dark:from-primary/10 dark:to-blue-950/20 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-[12px] font-semibold">AI Bio Schrijver</span>
          {!access.hasAccess && <Lock className="w-3 h-3 text-muted-foreground/50" />}
        </div>
        <button onClick={() => setOpen(false)} className="text-[10px] text-muted-foreground hover:text-foreground">verberg</button>
      </div>

      {!access.hasAccess ? (
        <div className="text-center py-2 space-y-1.5">
          <p className="text-[11px] text-muted-foreground">AI Bio Schrijver is beschikbaar voor Premium leden.</p>
          <Link href="/ai-assistant">
            <Button size="sm" className="text-xs h-7">Upgrade naar Premium</Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="bg-white/60 dark:bg-gray-900/60 rounded-lg p-2 border border-border/40 space-y-0.5">
            <p className="text-[10px] text-muted-foreground">Jouw gegevens:</p>
            <p className="text-[11px] font-medium">{user.displayName}{user.artType ? ` · ${user.artType}` : ""}{user.city ? ` · ${user.city}` : ""}</p>
          </div>

          <Input
            data-testid="input-ai-bio-highlights"
            value={highlights}
            onChange={e => setHighlights(e.target.value)}
            placeholder="Optioneel: hoogtepunten, achievements, stijl… bv. 'finalist NK 2024, geeft workshops'"
            className="text-xs h-8 bg-white dark:bg-gray-900"
          />

          <Button
            data-testid="btn-ai-generate-bio"
            onClick={generate}
            disabled={loading}
            size="sm"
            className="w-full h-7 text-[11px]"
          >
            {loading ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Genereren…</> : <><Sparkles className="w-3 h-3 mr-1" /> Schrijf mijn bio</>}
          </Button>

          {result && (
            <div className="space-y-2">
              {/* Main bio */}
              <div className="bg-white dark:bg-gray-900 rounded-lg p-2.5 border border-primary/20 space-y-1.5">
                <p className="text-xs leading-relaxed">{result.bio}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-muted-foreground">{result.bio.length}/180 tekens</span>
                  <Button
                    data-testid="btn-ai-apply-bio"
                    size="sm"
                    className="h-6 text-[10px]"
                    onClick={() => handleApply(result.bio)}
                  >
                    {applied === result.bio ? <><Check className="w-3 h-3 mr-0.5" /> Toegepast</> : "Gebruik deze →"}
                  </Button>
                </div>
              </div>

              {/* Alternatives */}
              {result.alternatives?.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium text-muted-foreground">Alternatieven:</p>
                  {result.alternatives.map((alt, i) => (
                    <div key={i} className="bg-white dark:bg-gray-900 rounded-lg p-2 border border-border/50 flex items-start justify-between gap-2">
                      <p className="text-[11px] leading-relaxed flex-1">{alt}</p>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0"
                        onClick={() => handleApply(alt)}>
                        <Check className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={generate} disabled={loading} className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80">
                <RefreshCw className="w-3 h-3" /> Opnieuw genereren
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
