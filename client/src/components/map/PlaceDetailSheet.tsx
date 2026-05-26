import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Star, MapPin, Clock, Globe, ThumbsUp, ThumbsDown,
  AlertCircle, ChevronDown, ChevronUp, Loader2, CheckCircle2,
  CalendarDays, Info, Sparkles, Zap, Eye, Lightbulb, Timer, Trophy, ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

function parseOpeningHours(raw: string): { label: string; times: string }[] {
  if (!raw) return [];
  const clean = raw.trim();
  if (clean === "24/7" || clean === "Mo-Su 00:00-24:00" || clean === "00:00-24:00") {
    return [{ label: "Daily", times: "Open 24/7" }];
  }
  const DAY_MAP: Record<string, string> = {
    Mo: "Mon", Tu: "Tue", We: "Wed", Th: "Thu", Fr: "Fri", Sa: "Sat", Su: "Sun",
  };
  const expandRange = (r: string) => {
    const [from, to] = r.split("-");
    const days = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
    const si = days.indexOf(from), ei = days.indexOf(to);
    if (si === -1 || ei === -1 || si > ei) return r;
    return days.slice(si, ei + 1).map(d => DAY_MAP[d] || d).join(", ");
  };
  const parts = clean.split(";").map(s => s.trim()).filter(Boolean);
  return parts.map(part => {
    const m = part.match(/^([A-Za-z,\-]+)\s+(.+)$/);
    if (!m) return { label: "Hours", times: part };
    const dayStr = m[1].replace(/([A-Z][a-z])-([A-Z][a-z])/g, (_, a, b) => expandRange(`${a}-${b}`))
      .replace(/([A-Z][a-z])/g, (d) => DAY_MAP[d] || d);
    return { label: dayStr, times: m[2] };
  });
}

interface PlaceDetailSheetProps {
  place: any | null;
  open: boolean;
  onClose: () => void;
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="transition-transform hover:scale-110 focus:outline-none"
          data-testid={`star-${n}`}
        >
          <Star
            className="w-7 h-7"
            fill={(hover || value) >= n ? "#F59E0B" : "none"}
            stroke={(hover || value) >= n ? "#F59E0B" : "#94A3B8"}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  );
}

function StarDisplay({ value, size = "sm" }: { value: number; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "w-3.5 h-3.5" : "w-5 h-5";
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} className={sz} fill={value >= n ? "#F59E0B" : "none"} stroke={value >= n ? "#F59E0B" : "#CBD5E1"} strokeWidth={1.5} />
      ))}
    </div>
  );
}

const CATEGORY_CONFIG: Record<string, {
  color: string; emoji: string; label: string;
  gradient: string; aiGradient: string; energyLabel: Record<string, string>;
}> = {
  dance:      { color: "#EC4899", emoji: "💃", label: "Dance",       gradient: "from-pink-500 to-rose-500",     aiGradient: "from-pink-50 to-rose-50 dark:from-pink-950/20 dark:to-rose-950/20",     energyLabel: { high: "High energy", "very-high": "Intense sessions", medium: "Mixed sessions", low: "Relaxed vibe" } },
  breakdance: { color: "#EC4899", emoji: "🕺", label: "Breakdance",  gradient: "from-pink-500 to-rose-500",     aiGradient: "from-pink-50 to-rose-50 dark:from-pink-950/20 dark:to-rose-950/20",     energyLabel: { high: "High energy", "very-high": "Battle energy", medium: "Practice vibe", low: "Chill session" } },
  music:      { color: "#3B82F6", emoji: "🎵", label: "Music",       gradient: "from-blue-500 to-indigo-500",   aiGradient: "from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20", energyLabel: { high: "Live & loud", "very-high": "Electric nights", medium: "Intimate sets", low: "Background vibes" } },
  skate:      { color: "#10B981", emoji: "🛹", label: "Skate",       gradient: "from-green-500 to-emerald-500", aiGradient: "from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20", energyLabel: { high: "High impact", "very-high": "Pro level", medium: "All levels", low: "Beginner friendly" } },
  parkour:    { color: "#F59E0B", emoji: "🤸", label: "Parkour",     gradient: "from-amber-500 to-yellow-500",  aiGradient: "from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20", energyLabel: { high: "Athletic", "very-high": "Expert moves", medium: "Mixed levels", low: "Chill training" } },
  sport:      { color: "#F97316", emoji: "🏋️", label: "Sport",      gradient: "from-orange-500 to-amber-500",  aiGradient: "from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20", energyLabel: { high: "Intense training", "very-high": "Elite level", medium: "Regular training", low: "Light exercise" } },
  fitness:    { color: "#0EA5E9", emoji: "💪", label: "Fitness",     gradient: "from-sky-500 to-blue-500",      aiGradient: "from-sky-50 to-blue-50 dark:from-sky-950/20 dark:to-blue-950/20",      energyLabel: { high: "Hard workouts", "very-high": "Beast mode", medium: "Good workouts", low: "Light fitness" } },
  museum:     { color: "#D97706", emoji: "🏛️", label: "Museum",     gradient: "from-amber-500 to-yellow-600",  aiGradient: "from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20", energyLabel: { high: "Busy & popular", "very-high": "Peak season", medium: "Moderate flow", low: "Quiet & peaceful" } },
  art:        { color: "#8B5CF6", emoji: "🎨", label: "Art",         gradient: "from-purple-500 to-pink-500",   aiGradient: "from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20", energyLabel: { high: "Vibrant scene", "very-high": "Opening night", medium: "Active gallery", low: "Contemplative" } },
  graffiti:   { color: "#8B5CF6", emoji: "✍️", label: "Graffiti",   gradient: "from-violet-500 to-purple-600", aiGradient: "from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20", energyLabel: { high: "Active wall", "very-high": "Full session", medium: "Regular activity", low: "Legal & calm" } },
  community:  { color: "#6366F1", emoji: "🤝", label: "Community",   gradient: "from-indigo-500 to-purple-500", aiGradient: "from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20", energyLabel: { high: "Lots of events", "very-high": "Major events", medium: "Regular meetups", low: "Quiet community" } },
  restaurant: { color: "#EF4444", emoji: "🍽️", label: "Restaurant", gradient: "from-red-500 to-orange-400",    aiGradient: "from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20",   energyLabel: { high: "Busy & lively", "very-high": "Full house", medium: "Cozy atmosphere", low: "Quiet dining" } },
  cafe:       { color: "#D97706", emoji: "☕", label: "Café",        gradient: "from-amber-600 to-yellow-500",  aiGradient: "from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20", energyLabel: { high: "Busy café", "very-high": "Peak hours", medium: "Regular flow", low: "Chill & quiet" } },
  other:      { color: "#64748B", emoji: "📍", label: "Place",       gradient: "from-slate-500 to-gray-500",    aiGradient: "from-slate-50 to-gray-50 dark:from-slate-950/20 dark:to-gray-950/20",   energyLabel: { high: "High energy", "very-high": "Very active", medium: "Moderate", low: "Calm" } },
};

const ENERGY_COLORS: Record<string, string> = {
  low: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  "very-high": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function AISpotAgentPanel({ place, reviews }: { place: any; reviews: any[] }) {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [triggered, setTriggered] = useState(false);
  const { toast } = useToast();

  const cat = (place.category || "other").toLowerCase();
  const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.other;

  const run = async () => {
    if (triggered) return;
    setTriggered(true);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/spot/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: place.name,
          category: cat,
          address: place.address,
          description: place.adminNote || place.description,
          opening_hours: place.opening_hours,
          website: place.website,
          reviews: reviews.slice(0, 5).map((r: any) => ({ rating: r.rating, review: r.review })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI error");
      setResult(data);
    } catch (err: any) {
      toast({ title: "AI tijdelijk niet beschikbaar", variant: "destructive" });
      setTriggered(false);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    if (!open && !triggered) run();
    setOpen(v => !v);
  };

  return (
    <div
      className={cn(
        "rounded-2xl border overflow-hidden transition-all duration-300",
        `bg-gradient-to-br ${cfg.aiGradient}`,
        open ? "border-opacity-60" : "border-opacity-30"
      )}
      style={{ borderColor: `${cfg.color}40` }}
    >
      <button
        onClick={handleToggle}
        className="w-full flex items-center gap-3 px-4 py-3 transition-colors"
        data-testid="btn-ai-spot-agent"
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
          style={{ background: `linear-gradient(135deg, ${cfg.color}dd, ${cfg.color}99)` }}
        >
          <Sparkles className="w-4.5 h-4.5 text-white w-[18px] h-[18px]" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-[13px] font-semibold leading-tight">AI Spot Agent</p>
          <p className="text-[11px] text-muted-foreground">
            {result ? "Analyse klaar" : triggered && loading ? "Analyseren…" : `Slimme analyse van dit ${cfg.label.toLowerCase()} spot`}
          </p>
        </div>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />}
        {!loading && (open ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />)}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
          {loading && (
            <div className="flex items-center gap-2.5 py-3 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: cfg.color }} />
              <span>Agent analyseert {place.name}…</span>
            </div>
          )}

          {result && !loading && (
            <div className="space-y-3">
              {/* Verdict + score */}
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  {result.verdict && (
                    <p className="text-[13px] font-semibold leading-snug"
                      style={{ color: cfg.color }}>
                      "{result.verdict}"
                    </p>
                  )}
                </div>
                {result.score && (
                  <div className="shrink-0 flex flex-col items-center rounded-xl px-2.5 py-1.5"
                    style={{ background: `${cfg.color}18`, border: `1.5px solid ${cfg.color}30` }}>
                    <span className="text-base font-black leading-none" style={{ color: cfg.color }}>{result.score}</span>
                    <span className="text-[9px] font-medium text-muted-foreground">/10</span>
                  </div>
                )}
              </div>

              {/* Best for tags */}
              {result.bestFor?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {result.bestFor.map((tag: string, i: number) => (
                    <span key={i} className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}25` }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Energy + best time */}
              <div className="flex items-center gap-2 flex-wrap">
                {result.energy && (
                  <span className={cn("text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1", ENERGY_COLORS[result.energy] || ENERGY_COLORS.medium)}>
                    <Zap className="w-3 h-3" />
                    {cfg.energyLabel?.[result.energy] || result.energy}
                  </span>
                )}
                {result.bestTime && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Timer className="w-3 h-3 shrink-0" />
                    {result.bestTime}
                  </span>
                )}
              </div>

              {/* Tips */}
              {result.tips?.length > 0 && (
                <div className="space-y-2">
                  {result.tips.map((tip: any, i: number) => (
                    <div key={i} className="rounded-xl px-3 py-2.5 space-y-0.5"
                      style={{ background: `${cfg.color}0d`, border: `1px solid ${cfg.color}20` }}>
                      <p className="text-[11px] font-semibold flex items-center gap-1.5" style={{ color: cfg.color }}>
                        <Lightbulb className="w-3 h-3 shrink-0" />
                        {tip.title}
                      </p>
                      <p className="text-[11px] text-foreground/80 leading-relaxed">{tip.body}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Insider tip */}
              {result.hidden && (
                <div className="rounded-xl px-3 py-2.5 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 border border-amber-200/60 dark:border-amber-800/40">
                  <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mb-0.5">
                    <Eye className="w-3 h-3 shrink-0" />
                    Insider tip
                  </p>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">{result.hidden}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PlaceDetailSheet({ place, open, onClose }: PlaceDetailSheetProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [isOpen, setIsOpen] = useState<boolean | null>(null);
  const [hoursCorrect, setHoursCorrect] = useState<boolean | null>(null);
  const [suggestedHours, setSuggestedHours] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [resolvedId, setResolvedId] = useState<number | null>(null);
  const [resolving, setResolving] = useState(false);

  const effectivePlaceId = place?.id ?? resolvedId;

  const { data: reviews = [], isLoading: reviewsLoading } = useQuery<any[]>({
    queryKey: [`/api/places/${effectivePlaceId}/reviews`],
    enabled: open && !!effectivePlaceId,
    staleTime: 60_000,
  });

  const submitMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/places/${effectivePlaceId}/reviews`, "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/places/${effectivePlaceId}/reviews`] });
      setSubmitted(true);
      setShowReviewForm(false);
      toast({ title: "Review submitted!", description: "Thanks for helping the community." });
    },
    onError: () => toast({ title: "Failed to submit review", variant: "destructive" }),
  });

  useEffect(() => {
    if (!open || !place) return;
    if (place.id) { setResolvedId(null); return; }
    if (place.osmId) {
      setResolving(true);
      apiRequest("/api/places/find-or-create-osm", "POST", {
        osmId: place.osmId,
        name: place.name,
        lat: place.lat,
        lon: place.lon,
        category: place.category,
        address: place.address || null,
      }).then(async (res) => {
        const data = await res.json();
        setResolvedId(data.id);
      }).catch(() => {
        toast({ title: "Couldn't load place details", variant: "destructive" });
      }).finally(() => setResolving(false));
    }
  }, [open, place]);

  if (!place) return null;

  const cat = (place.category || "other").toLowerCase();
  const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.other;

  const avgRating = reviews.length
    ? reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length
    : null;
  const openVotes = reviews.filter((r: any) => r.isStillOpen === true).length;
  const closedVotes = reviews.filter((r: any) => r.isStillOpen === false).length;
  const openTotal = openVotes + closedVotes;

  const handleSubmit = () => {
    if (rating === 0) { toast({ title: "Please select a star rating", variant: "destructive" }); return; }
    submitMutation.mutate({
      rating,
      review: reviewText.trim() || null,
      isStillOpen: isOpen,
      openingHoursCorrect: hoursCorrect,
      suggestedOpeningHours: hoursCorrect === false && suggestedHours.trim() ? suggestedHours.trim() : null,
    });
  };

  const resetForm = () => {
    setRating(0); setReviewText(""); setIsOpen(null); setHoursCorrect(null);
    setSuggestedHours(""); setSubmitted(false); setShowReviewForm(false);
    setResolvedId(null); setResolving(false);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) { resetForm(); onClose(); } }}>
      <SheetContent
        side="bottom"
        className="max-h-[92vh] overflow-y-auto rounded-t-3xl px-0 pb-8 shadow-2xl"
        data-testid="sheet-place-detail"
        style={{ "--sheet-border-color": cfg.color } as any}
      >
        {/* Colored top accent line */}
        <div className="h-[3px] w-full" style={{ background: `linear-gradient(to right, ${cfg.color}cc, ${cfg.color}44)` }} />

        <div className="sticky top-0 z-10 bg-background/98 backdrop-blur-md border-b border-border px-5 pb-3 pt-2">
          <div className="mx-auto w-10 h-1 rounded-full bg-muted mb-3" />
          <SheetHeader className="text-left">
            <div className="flex items-start gap-3">
              <div
                className="w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center text-2xl shadow-sm"
                style={{ background: `${cfg.color}18`, border: `1.5px solid ${cfg.color}40` }}
              >
                {cfg.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-base leading-tight">{place.name}</SheetTitle>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge
                    variant="secondary"
                    className="text-xs px-2 py-0.5 font-semibold"
                    style={{ background: `${cfg.color}18`, color: cfg.color, borderColor: `${cfg.color}35` }}
                  >
                    {cfg.label}
                  </Badge>
                  {avgRating !== null && (
                    <div className="flex items-center gap-1">
                      <StarDisplay value={Math.round(avgRating)} size="sm" />
                      <span className="text-xs text-muted-foreground">{avgRating.toFixed(1)} ({reviews.length})</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </SheetHeader>
        </div>

        <div className="px-5 pt-4 space-y-4">
          {place.adminNote && (
            <p className="text-sm text-foreground/80 leading-relaxed bg-muted/40 rounded-xl px-3 py-2.5 border border-border/50">
              {place.adminNote}
            </p>
          )}

          {/* Location details */}
          <div className="space-y-1.5">
            {place.address && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0" style={{ color: cfg.color + "99" }} />
                <span>{place.address}</span>
              </div>
            )}
            {place.opening_hours && (() => {
              const parsed = parseOpeningHours(place.opening_hours);
              if (parsed.length === 1 && parsed[0].times === "Open 24/7") {
                return (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 shrink-0" style={{ color: cfg.color + "99" }} />
                    <span className="font-semibold text-green-600 dark:text-green-400">Open 24/7</span>
                  </div>
                );
              }
              if (parsed.length <= 2) {
                return (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4 mt-0.5 shrink-0" style={{ color: cfg.color + "99" }} />
                    <div className="space-y-0.5">
                      {parsed.map((p, i) => (
                        <div key={i}><span className="font-medium text-foreground">{p.label}:</span> {p.times}</div>
                      ))}
                    </div>
                  </div>
                );
              }
              return (
                <div className="flex items-start gap-2 text-sm">
                  <Clock className="w-4 h-4 mt-2 shrink-0" style={{ color: cfg.color + "99" }} />
                  <div className="rounded-lg bg-muted/50 border border-border/50 px-3 py-2 w-full space-y-1">
                    {parsed.map((p, i) => (
                      <div key={i} className="flex justify-between gap-3 text-xs">
                        <span className="font-medium text-foreground">{p.label}</span>
                        <span className="text-muted-foreground">{p.times}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
            {place.website && (
              <div className="flex items-start gap-2 text-sm">
                <Globe className="w-4 h-4 mt-0.5 shrink-0" style={{ color: cfg.color + "99" }} />
                <a href={place.website} target="_blank" rel="noopener noreferrer"
                  className="hover:underline font-medium truncate" style={{ color: cfg.color }}>
                  {place.website.replace(/^https?:\/\//, "")}
                </a>
              </div>
            )}
          </div>

          {/* Action buttons */}
          {(place.osmId || place.id) && (
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm"
                className="flex-1 gap-1.5 rounded-full h-9 text-sm transition-all hover:shadow-sm"
                data-testid="button-view-details">
                <Link to={place.osmId ? `/spots/city/${place.osmId}` : `/spots/spotlight/${place.id}`}>
                  <Info className="w-3.5 h-3.5" />
                  Bekijk details
                </Link>
              </Button>
              <Button asChild size="sm"
                className="flex-1 gap-1.5 rounded-full h-9 text-sm text-white border-0 transition-all hover:shadow-md hover:scale-[1.02]"
                style={{ background: `linear-gradient(135deg, ${cfg.color}dd, ${cfg.color}aa)` }}
                data-testid="button-view-schedule">
                <Link to={place.osmId ? `/spots/city/${place.osmId}` : `/spots/spotlight/${place.id}`}>
                  <CalendarDays className="w-3.5 h-3.5" />
                  Schedule
                </Link>
              </Button>
            </div>
          )}

          {/* Community open status */}
          {openTotal > 0 && (
            <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium ${
              openVotes > closedVotes
                ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400"
                : "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
            }`}>
              {openVotes > closedVotes
                ? <><CheckCircle2 className="w-4 h-4 shrink-0" /> Community zegt: Nog open ({openVotes}/{openTotal} stemmen)</>
                : <><AlertCircle className="w-4 h-4 shrink-0" /> Community zegt: Mogelijk gesloten ({closedVotes}/{openTotal} stemmen)</>
              }
            </div>
          )}

          {/* ── AI Spot Agent ─────────────────────────────────────────────── */}
          <AISpotAgentPanel place={place} reviews={reviews} />

          {/* ── Reviews ───────────────────────────────────────────────────── */}
          <div className="border-t border-border pt-4">
            {resolving ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading reviews...</span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">Reviews{reviews.length > 0 ? ` (${reviews.length})` : ""}</h3>
                  {user && !submitted && effectivePlaceId && (
                    <button
                      onClick={() => setShowReviewForm(f => !f)}
                      className="text-xs font-medium flex items-center gap-1 hover:underline transition-colors"
                      style={{ color: cfg.color }}
                      data-testid="button-toggle-review-form"
                    >
                      {showReviewForm
                        ? <><ChevronUp className="w-3 h-3" />Verbergen</>
                        : <><ChevronDown className="w-3 h-3" />Schrijf review</>}
                    </button>
                  )}
                  {!user && <span className="text-xs text-muted-foreground">Log in om te reviewen</span>}
                </div>

                {showReviewForm && (
                  <div className="bg-muted/30 rounded-2xl p-4 space-y-4 mb-4 border border-border animate-in slide-in-from-top-2 duration-200">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">Jouw beoordeling *</p>
                      <StarPicker value={rating} onChange={setRating} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">Jouw review (optioneel)</p>
                      <Textarea
                        placeholder="Deel je ervaring met deze plek..."
                        value={reviewText}
                        onChange={e => setReviewText(e.target.value)}
                        rows={3}
                        className="resize-none text-sm rounded-xl"
                        data-testid="textarea-review"
                      />
                    </div>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Is deze plek nog open?</p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setIsOpen(isOpen === true ? null : true)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${isOpen === true ? "bg-green-500 text-white border-green-500" : "bg-background border-border text-muted-foreground hover:border-green-400"}`}
                          data-testid="button-still-open">
                          <ThumbsUp className="w-3 h-3" /> Ja, open
                        </button>
                        <button type="button" onClick={() => setIsOpen(isOpen === false ? null : false)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${isOpen === false ? "bg-red-500 text-white border-red-500" : "bg-background border-border text-muted-foreground hover:border-red-400"}`}
                          data-testid="button-now-closed">
                          <ThumbsDown className="w-3 h-3" /> Permanent gesloten
                        </button>
                      </div>
                    </div>

                    {place.opening_hours && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          Zijn de openingstijden correct?
                          <span className="ml-1 font-normal opacity-70">({place.opening_hours})</span>
                        </p>
                        <div className="flex gap-2 mb-2">
                          <button type="button"
                            onClick={() => { setHoursCorrect(hoursCorrect === true ? null : true); setSuggestedHours(""); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${hoursCorrect === true ? "bg-green-500 text-white border-green-500" : "bg-background border-border text-muted-foreground hover:border-green-400"}`}
                            data-testid="button-hours-correct">
                            ✓ Correct
                          </button>
                          <button type="button" onClick={() => setHoursCorrect(hoursCorrect === false ? null : false)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${hoursCorrect === false ? "bg-amber-500 text-white border-amber-500" : "bg-background border-border text-muted-foreground hover:border-amber-400"}`}
                            data-testid="button-hours-wrong">
                            ✗ Niet correct
                          </button>
                        </div>
                        {hoursCorrect === false && (
                          <div className="mt-2 space-y-1.5 animate-in slide-in-from-top-1 duration-150">
                            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Wat zijn de correcte openingstijden?
                            </p>
                            <Textarea
                              placeholder="bv. Ma–Vr 10:00–22:00, Za 12:00–23:00, Zo gesloten"
                              value={suggestedHours}
                              onChange={e => setSuggestedHours(e.target.value)}
                              rows={2}
                              className="resize-none text-xs rounded-xl"
                              data-testid="textarea-suggested-hours"
                            />
                            <p className="text-xs text-muted-foreground">Je suggestie wordt naar admin gestuurd.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {!place.opening_hours && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">
                          <Clock className="w-3 h-3 inline mr-1" />Ken jij de openingstijden?
                        </p>
                        <Textarea
                          placeholder="bv. Ma–Vr 10:00–22:00, Za 12:00–23:00, Zo gesloten"
                          value={suggestedHours}
                          onChange={e => setSuggestedHours(e.target.value)}
                          rows={2}
                          className="resize-none text-xs rounded-xl"
                          data-testid="textarea-add-hours"
                        />
                        {suggestedHours.trim() && (
                          <p className="text-xs text-muted-foreground mt-1">Wordt naar admin gestuurd voor review.</p>
                        )}
                      </div>
                    )}

                    <Button
                      onClick={handleSubmit}
                      disabled={submitMutation.isPending || rating === 0}
                      className="w-full rounded-full"
                      style={{ background: cfg.color }}
                      data-testid="button-submit-review"
                    >
                      {submitMutation.isPending
                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Versturen...</>
                        : "Review versturen"}
                    </Button>
                  </div>
                )}

                {submitted && (
                  <div className="flex items-center gap-2 px-3 py-2 mb-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm animate-in fade-in duration-200">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    Review verstuurd — bedankt!
                  </div>
                )}

                {reviewsLoading ? (
                  <div className="flex items-center justify-center py-6 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />Loading reviews...
                  </div>
                ) : reviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nog geen reviews — wees de eerste!</p>
                ) : (
                  <div className="space-y-3">
                    {reviews.map((r: any) => (
                      <div key={r.id} className="border border-border rounded-2xl p-3.5 space-y-1.5 transition-all hover:border-border/80 hover:shadow-sm" data-testid={`review-${r.id}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white"
                              style={{ background: `linear-gradient(135deg, ${cfg.color}cc, ${cfg.color}88)` }}>
                              {(r.displayName || "U").charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs font-medium">{r.displayName || "Member"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <StarDisplay value={r.rating} size="sm" />
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                        {r.review && <p className="text-sm text-foreground/80 leading-relaxed">{r.review}</p>}
                        <div className="flex flex-wrap gap-1.5">
                          {r.isStillOpen === true && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">✓ Nog open</span>}
                          {r.isStillOpen === false && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-medium">✗ Gesloten</span>}
                          {r.openingHoursCorrect === true && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium">🕐 Tijden kloppen</span>}
                          {r.openingHoursCorrect === false && r.suggestedOpeningHours && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium">
                              🕐 Suggestie: {r.suggestedOpeningHours}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
