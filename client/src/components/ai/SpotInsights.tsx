import { useState } from "react";
import { Sparkles, Clock, Backpack, Zap, ShieldAlert, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAIAccess } from "@/hooks/useAIAccess";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface SpotInsightsData {
  bestTime: string;
  vibe: string;
  whatToBring: string[];
  tips: string[];
  safetyNote: string | null;
}

interface SpotInsightsProps {
  spotName: string;
  spotType?: string;
  address?: string;
  description?: string;
  cacheKey?: string;
}

const insightCache: Record<string, SpotInsightsData> = {};

export function SpotInsights({ spotName, spotType, address, description, cacheKey }: SpotInsightsProps) {
  const access = useAIAccess();
  const { language } = useLanguage();
  const { toast } = useToast();
  const [insights, setInsights] = useState<SpotInsightsData | null>(
    cacheKey ? (insightCache[cacheKey] ?? null) : null
  );
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [generated, setGenerated] = useState(!!insights);

  const isNL = language === "nl";

  const ui = {
    buttonLabel: isNL ? "AI Spot Inzichten" : "AI Spot Insights",
    loadingLabel: isNL ? "AI inzichten laden…" : "Loading AI insights…",
    headerLabel: isNL ? "AI Spot Inzichten" : "AI Spot Insights",
    vibeLabel: isNL ? "Sfeer" : "Vibe",
    bestTimeLabel: isNL ? "Beste tijd" : "Best time",
    bringLabel: isNL ? "Neem mee" : "Bring",
    tipsLabel: isNL ? "Tips" : "Tips",
    errTitle: isNL ? "Fout" : "Error",
    errMsg: isNL ? "Kon geen inzichten genereren." : "Could not generate insights.",
    errRetry: isNL ? "Probeer opnieuw." : "Please try again.",
  };

  if (!access.hasAccess && !access.isLoading) return null;

  const generate = async () => {
    setLoading(true);
    try {
      const res = await apiRequest("/api/ai/spot-insights", "POST", {
        spotName,
        spotType,
        address,
        description,
        language,
      });
      const data = await res.json();

      if (res.status !== 200) {
        toast({ title: ui.errTitle, description: data.message || ui.errMsg, variant: "destructive" });
        return;
      }

      if (cacheKey) insightCache[cacheKey] = data;
      setInsights(data);
      setGenerated(true);
      setExpanded(true);
    } catch {
      toast({ title: ui.errTitle, description: ui.errRetry, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!generated) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={generate}
        disabled={loading}
        className="gap-2 w-full border-primary/30 text-primary hover:bg-primary/5"
        data-testid="button-generate-spot-insights"
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Sparkles className="w-3.5 h-3.5" />
        )}
        {loading ? ui.loadingLabel : ui.buttonLabel}
      </Button>
    );
  }

  if (!insights) return null;

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/[0.03] overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between w-full px-3.5 py-2.5 text-left"
        data-testid="button-toggle-spot-insights"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-sm font-semibold text-primary">{ui.headerLabel}</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-primary/60" />
        ) : (
          <ChevronDown className="w-4 h-4 text-primary/60" />
        )}
      </button>

      <div className={cn("overflow-hidden transition-all duration-300", expanded ? "max-h-[600px]" : "max-h-0")}>
        <div className="px-3.5 pb-3.5 space-y-3 border-t border-primary/10 pt-3">
          {/* Vibe */}
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{ui.vibeLabel}</span>
            </div>
            <p className="text-sm text-foreground leading-snug">{insights.vibe}</p>
          </div>

          {/* Best time */}
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{ui.bestTimeLabel}</span>
            </div>
            <p className="text-sm text-foreground leading-snug">{insights.bestTime}</p>
          </div>

          {/* What to bring */}
          {insights.whatToBring?.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Backpack className="w-3.5 h-3.5 text-green-500" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{ui.bringLabel}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {insights.whatToBring.map((item) => (
                  <span
                    key={item}
                    className="px-2 py-0.5 rounded-full bg-muted text-xs font-medium text-foreground border border-border/60"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tips */}
          {insights.tips?.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{ui.tipsLabel}</span>
              <ul className="space-y-1">
                {insights.tips.map((tip) => (
                  <li key={tip} className="flex gap-2 text-sm text-foreground leading-snug">
                    <span className="text-primary mt-0.5 flex-shrink-0">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Safety note */}
          {insights.safetyNote && (
            <div className="flex gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-snug">{insights.safetyNote}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
