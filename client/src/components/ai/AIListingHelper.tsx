import { useState } from "react";
import { Sparkles, Loader2, Check, ChevronDown, ChevronUp, Lock, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAIAccess } from "@/hooks/useAIAccess";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface ListingResult {
  title: string;
  description: string;
  tags: string[];
  priceSuggestion?: { min: number; max: number; currency: string };
  tip?: string;
}

interface AIListingHelperProps {
  onApply?: (data: { title?: string; description?: string; tags?: string[] }) => void;
  category?: string;
}

export default function AIListingHelper({ onApply, category }: AIListingHelperProps) {
  const access = useAIAccess();
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [condition, setCondition] = useState("goed");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ListingResult | null>(null);
  const [applied, setApplied] = useState(false);

  if (!user) return null;

  const generate = async () => {
    if (!description.trim()) return;
    setLoading(true);
    setResult(null);
    setApplied(false);
    try {
      const r = await fetch("/api/ai/marketplace/listing", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemDescription: description, category, condition }),
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

  const handleApply = () => {
    if (!result || !onApply) return;
    onApply({ title: result.title, description: result.description, tags: result.tags });
    setApplied(true);
    toast({ title: "AI resultaat toegepast", description: "Titel en beschrijving zijn ingevuld." });
  };

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 overflow-hidden">
      <button
        data-testid="btn-ai-listing-toggle"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-amber-50/50 transition-colors"
      >
        <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
        <span className="text-[12px] font-semibold text-amber-800 dark:text-amber-300 flex-1 text-left">AI Listing Helper</span>
        {!access.hasAccess && <Lock className="w-3 h-3 text-muted-foreground/50" />}
        {open ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-400" />}
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 space-y-2.5">
          {!access.hasAccess ? (
            <div className="text-center py-3 space-y-2">
              <p className="text-xs text-muted-foreground">AI Listing Helper is beschikbaar voor Premium leden.</p>
              <Link href="/ai-assistant">
                <Button size="sm" className="text-xs h-7 bg-amber-600 hover:bg-amber-700">Upgrade naar Premium</Button>
              </Link>
            </div>
          ) : (
            <>
              <Input
                data-testid="input-ai-listing-desc"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Beschrijf je artikel, bv. 'Nike Air Force 1 maat 42 wit, nauwelijks gedragen'"
                className="text-xs h-8 bg-white dark:bg-gray-900"
              />

              <div className="flex gap-1.5">
                {["nieuw", "zo goed als nieuw", "goed", "redelijk"].map(c => (
                  <button key={c} onClick={() => setCondition(c)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${condition === c ? "bg-amber-600 text-white border-amber-600" : "border-border text-muted-foreground hover:border-amber-400"}`}>
                    {c}
                  </button>
                ))}
              </div>

              <Button
                data-testid="btn-ai-generate-listing"
                onClick={generate}
                disabled={loading || !description.trim()}
                size="sm"
                className="w-full h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white"
              >
                {loading ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Genereren…</> : <><Sparkles className="w-3.5 h-3.5 mr-1" /> Maak listing aan</>}
              </Button>

              {result && (
                <div className="space-y-2">
                  <div className="bg-white dark:bg-gray-900 rounded-lg p-2.5 border border-amber-200/60 space-y-2">
                    <div>
                      <p className="text-[10px] font-medium text-amber-700 mb-0.5">Titel:</p>
                      <p className="text-xs font-semibold">{result.title}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-amber-700 mb-0.5">Beschrijving:</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">{result.description}</p>
                    </div>
                    {result.priceSuggestion && (
                      <div>
                        <p className="text-[10px] font-medium text-amber-700 mb-0.5">Aanbevolen prijs:</p>
                        <p className="text-sm font-bold text-amber-800">€{result.priceSuggestion.min} – €{result.priceSuggestion.max}</p>
                      </div>
                    )}
                    {result.tip && (
                      <p className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded px-2 py-1">💡 {result.tip}</p>
                    )}
                  </div>

                  {result.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {result.tags.map(tag => (
                        <span key={tag} className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full">{tag}</span>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {onApply && (
                      <Button
                        data-testid="btn-ai-apply-listing"
                        onClick={handleApply}
                        size="sm"
                        className="flex-1 h-7 text-[11px] bg-amber-600 hover:bg-amber-700"
                      >
                        {applied ? <><Check className="w-3 h-3 mr-1" /> Toegepast!</> : "Gebruik dit →"}
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="h-7 text-[11px] border-amber-300 text-amber-700"
                      onClick={async () => {
                        try { await navigator.clipboard.writeText(`${result.title}\n\n${result.description}`); } catch (_) {}
                        toast({ title: "Gekopieerd!" });
                      }}>
                      <Copy className="w-3 h-3 mr-1" /> Kopieer
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
