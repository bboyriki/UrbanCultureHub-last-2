import { useState } from "react";
import {
  Sparkles, MapPin, ChevronDown, ChevronUp, Lock, Loader2, Send,
  Zap, Music, Dumbbell, Palette, PersonStanding, Bike, Globe, Trees, Coffee, Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAIAccess } from "@/hooks/useAIAccess";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface SpotSuggestion { name: string; why: string; tip: string }
interface GuideResult { advice: string; suggestions: SpotSuggestion[]; vibe: string }

interface AISpotGuideProps {
  city?: string;
  nearbySpots?: Array<{ name: string; category?: string; description?: string }>;
}

const CATEGORY_FILTERS = [
  { key: "dance",    label: "Dance",    icon: PersonStanding, color: "#EC4899" },
  { key: "skate",    label: "Skate",    icon: Zap,            color: "#10B981" },
  { key: "music",    label: "Music",    icon: Music,           color: "#3B82F6" },
  { key: "art",      label: "Art",      icon: Palette,         color: "#8B5CF6" },
  { key: "sport",    label: "Sport",    icon: Dumbbell,        color: "#F97316" },
  { key: "bmx",      label: "BMX",      icon: Bike,            color: "#0EA5E9" },
  { key: "park",     label: "Park",     icon: Trees,           color: "#22C55E" },
  { key: "cafe",     label: "Café",     icon: Coffee,          color: "#D97706" },
  { key: "museum",   label: "Museum",   icon: Globe,           color: "#A855F7" },
];

const QUICK_MOODS = [
  { label: "🔥 trainen", q: "een goede plek om te trainen" },
  { label: "💡 inspiratie", q: "nieuwe inspiratie opdoen" },
  { label: "🛹 nieuwe spots", q: "nieuwe spots ontdekken" },
  { label: "😌 chill sessie", q: "relaxen en chill sessie" },
  { label: "🤝 samenwerken", q: "anderen ontmoeten en samenwerken" },
  { label: "🎤 open mic", q: "open mic of jam sessie" },
  { label: "📸 filmen", q: "filmen of fotografie spots" },
  { label: "🎨 maken", q: "iets creatiefs maken" },
];

export default function AISpotGuide({ city, nearbySpots }: AISpotGuideProps) {
  const access = useAIAccess();
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [mood, setMood] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GuideResult | null>(null);

  if (!user) return null;

  const getGuide = async (quickMood?: string, cat?: string | null) => {
    const q = quickMood || mood;
    setLoading(true);
    setResult(null);
    try {
      const spotsToSend = cat
        ? nearbySpots?.filter(s => s.category?.toLowerCase() === cat).slice(0, 15)
        : nearbySpots?.slice(0, 20);

      const r = await fetch("/api/ai/nearby/guide", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mood: q || (cat ? `beste ${cat} spots in de buurt` : "goede plekken"),
          city: city || user.city,
          artType: cat || user.artType,
          spots: spotsToSend,
        }),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (err: any) {
      toast({ title: "AI fout", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryFilter = (key: string) => {
    const newCat = activeCategory === key ? null : key;
    setActiveCategory(newCat);
    getGuide(mood || undefined, newCat);
  };

  return (
    <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/40 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50/50 dark:from-emerald-950/20 dark:via-teal-950/20 dark:to-cyan-950/10 overflow-hidden mb-3">
      {/* Header */}
      <button
        data-testid="btn-ai-spot-guide-toggle"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-emerald-50/60 dark:hover:bg-emerald-900/10 transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 shadow-sm">
          <Sparkles className="w-[18px] h-[18px] text-white" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-[13px] font-bold text-emerald-900 dark:text-emerald-100 leading-tight">AI Spot Agent</p>
          <p className="text-[11px] text-emerald-700/70 dark:text-emerald-300/70">
            {result ? `Vibe: ${result.vibe || "gevonden"}` : "Zoek de perfecte plek voor jou"}
          </p>
        </div>
        {!access.hasAccess && <Lock className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />}
        <div className={cn("transition-transform duration-200", open ? "rotate-0" : "rotate-0")}>
          {open ? <ChevronUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <ChevronDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
          {!access.hasAccess ? (
            <div className="text-center py-5 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6 text-emerald-600/60" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">AI Spot Agent</p>
                <p className="text-xs text-muted-foreground mt-0.5">Beschikbaar voor Premium leden.</p>
              </div>
              <Link href="/ai-assistant">
                <Button size="sm" className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 rounded-full px-4">
                  Upgrade naar Premium
                </Button>
              </Link>
            </div>
          ) : (
            <>
              {/* Search input */}
              <div className="flex gap-2">
                <Input
                  data-testid="input-ai-spot-mood"
                  value={mood}
                  onChange={e => setMood(e.target.value)}
                  placeholder="Wat zoek je? bv. 'een plek om te breaken'"
                  className="text-sm h-9 bg-white/80 dark:bg-gray-900/80 rounded-full border-emerald-200 dark:border-emerald-800 focus:border-emerald-400"
                  onKeyDown={e => e.key === "Enter" && getGuide()}
                />
                <Button
                  data-testid="btn-ai-spot-search"
                  onClick={() => getGuide()}
                  disabled={loading || (!mood.trim() && !activeCategory)}
                  size="sm"
                  className="h-9 w-9 shrink-0 rounded-full p-0 bg-emerald-600 hover:bg-emerald-700 transition-all"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </Button>
              </div>

              {/* Category filters */}
              <div>
                <p className="text-[10px] font-semibold text-emerald-700/60 dark:text-emerald-300/60 uppercase tracking-wider mb-2">Filter op type</p>
                <div className="flex gap-1.5 flex-wrap">
                  {CATEGORY_FILTERS.map(({ key, label, icon: Icon, color }) => (
                    <button
                      key={key}
                      onClick={() => handleCategoryFilter(key)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-150 border",
                        activeCategory === key
                          ? "text-white border-transparent shadow-sm"
                          : "bg-white/60 dark:bg-black/20 border-border/50 text-muted-foreground hover:border-border"
                      )}
                      style={activeCategory === key ? { background: color, borderColor: color } : {}}
                    >
                      <Icon className="w-3 h-3 shrink-0" style={activeCategory === key ? {} : { color }} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick mood chips */}
              <div>
                <p className="text-[10px] font-semibold text-emerald-700/60 dark:text-emerald-300/60 uppercase tracking-wider mb-2">Snel zoeken</p>
                <div className="flex gap-1.5 flex-wrap">
                  {QUICK_MOODS.map(({ label, q }) => (
                    <button key={q}
                      onClick={() => { setMood(q); getGuide(q, activeCategory); }}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-white/70 dark:bg-black/20 border border-emerald-200/60 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors font-medium">
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Loading state */}
              {loading && (
                <div className="flex items-center gap-3 bg-white/60 dark:bg-black/20 rounded-2xl px-4 py-3 border border-emerald-200/60">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Agent aan het zoeken…</p>
                    <p className="text-[10px] text-muted-foreground">Analyseer spots{activeCategory ? ` [${activeCategory}]` : ""} in {city || user.city || "de buurt"}</p>
                  </div>
                </div>
              )}

              {/* Results */}
              {result && !loading && (
                <div className="space-y-3 animate-in fade-in duration-300">
                  {/* Vibe + summary */}
                  <div className="bg-white/70 dark:bg-black/20 rounded-2xl px-4 py-3.5 border border-emerald-200/60 dark:border-emerald-800/40 space-y-2">
                    {result.vibe && (
                      <div className="flex items-center gap-2">
                        <Star className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="#F59E0B" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                          Vibe van vandaag: {result.vibe}
                        </span>
                      </div>
                    )}
                    {result.advice && (
                      <p className="text-[12.5px] text-foreground/80 leading-relaxed">{result.advice}</p>
                    )}
                  </div>

                  {/* Spot suggestions */}
                  {result.suggestions?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Aanbevolen spots</p>
                      {result.suggestions.map((s, i) => (
                        <div key={i}
                          className="bg-white/70 dark:bg-black/20 rounded-xl p-3.5 border border-border/50 space-y-1 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0">
                              <MapPin className="w-3 h-3 text-white" />
                            </div>
                            <p className="text-[13px] font-bold">{s.name}</p>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed pl-8">{s.why}</p>
                          {s.tip && (
                            <p className="text-[10.5px] text-emerald-700 dark:text-emerald-400 font-semibold pl-8">
                              💡 {s.tip}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
