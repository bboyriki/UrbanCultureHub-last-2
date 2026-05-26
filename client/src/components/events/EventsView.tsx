import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search, Plus, SlidersHorizontal, X, Shuffle, ChevronRight, ChevronLeft,
  MapPin, Zap, Star, Calendar, TrendingUp, Users, Baby, Flame, Sparkles,
  Music, LayoutGrid, List
} from "lucide-react";
import { format, isToday, addDays, startOfDay, endOfDay } from "date-fns";
import { nl, enUS } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Event } from "@shared/schema";
import { EVENT_CATEGORY_LABELS, EVENT_CATEGORY_ICONS } from "@/types";
import EventCard from "./EventCard";
import AddEventForm from "./AddEventForm";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLocalizedEvent } from "@/lib/localize";
import { deriveIsPaid, getEventPriceInfo } from "@/lib/eventPrice";

/* ─── Dutch cities ─── */
const DUTCH_CITIES = ["Amsterdam", "Rotterdam", "Utrecht", "Den Haag", "Haarlem", "Zaandam", "Almere", "Eindhoven"];

/* ─── Music sub-genres ─── */
const MUSIC_SUBGENRES = [
  { id: "all",        label: "All Music",      icon: "🎵", kw: null,                                                                                               dbKeys: [] as string[] },
  { id: "rock",       label: "Rock & Metal",   icon: "🎸", kw: /rock|metal|punk|grunge|indie|alternative|hardcore|emo|stoner|doom|post.rock/i,                     dbKeys: ["rock","metal","punk","indie","alternative"] },
  { id: "hiphop",     label: "Hip-Hop & Rap",  icon: "🎤", kw: /hip.?hop|\brap\b|trap|drill|hiphop|grime/i,                                                        dbKeys: ["hiphop","rap","trap"] },
  { id: "electronic", label: "Electronic",     icon: "🎛️", kw: /\bDJ\b|techno|house|trance|edm|rave|\bdnb\b|drum.n.bass|hardstyle|gabber|electro|ambient|synth/i, dbKeys: ["electronic","dance","techno","house","edm"] },
  { id: "afrobeats",  label: "Afrobeats",      icon: "🌍", kw: /afrobeats|afropop|afro.beats/i,                                                                    dbKeys: ["afrobeats","afropop"] },
  { id: "latin",      label: "Latin",          icon: "💃", kw: /latin|salsa|reggaeton|bachata|cumbia|merengue/i,                                                    dbKeys: ["latin","salsa","reggaeton"] },
  { id: "jazz",       label: "Jazz & Soul",    icon: "🎷", kw: /jazz|blues|soul|funk|swing|bebop|gospel|r&b|rnb/i,                                                  dbKeys: ["jazz","soul","blues","rnb","funk"] },
  { id: "classical",  label: "Classical",      icon: "🎹", kw: /klassiek|symfonisch|symphon|orchestra|orkest|philharmon|koor|chamber|opera|baroque|piano recital/i,  dbKeys: ["classical","opera","symphonic"] },
  { id: "folk",       label: "Folk & Country", icon: "🎻", kw: /\bfolk\b|country|bluegrass|acoustic|singer.songwriter|world music/i,                               dbKeys: ["folk","country","world","bluegrass"] },
  { id: "reggae",     label: "Reggae & Dub",   icon: "🌴", kw: /reggae|ska|\bdub\b|dancehall|roots/i,                                                              dbKeys: ["reggae","ska","dub","dancehall"] },
];
type MusicSubGenreId = typeof MUSIC_SUBGENRES[number]["id"];
function matchesMusicSubGenre(e: { musicGenre?: string | null; title: string; description?: string | null }, genre: typeof MUSIC_SUBGENRES[number]): boolean {
  if (e.musicGenre && genre.dbKeys.length > 0 && genre.dbKeys.includes(e.musicGenre)) return true;
  if (genre.kw) return genre.kw.test(e.title) || genre.kw.test(e.description ?? "");
  return false;
}

/* ─── Dance sub-styles ─── */
const DANCE_SUBSTYLES = [
  { id: "all",    label: "All Dance",            icon: "💃", kw: null as RegExp | null },
  { id: "hiphop", label: "Hip-Hop",             icon: "🤸", kw: /hip.?hop|breaking|b.?boy|b.?girl|cypher/i },
  { id: "latin",  label: "Latin",               icon: "🌶️", kw: /salsa|bachata|cumbia|merengue|cha.?cha|tango|rumba/i },
  { id: "street", label: "Street",              icon: "🛣️", kw: /street|popping|locking|waacking|vogue|house dance/i },
  { id: "ballet", label: "Ballet/Contemporary", icon: "🩰", kw: /ballet|contemporary|modern dance|jazz dance/i },
  { id: "afro",   label: "Afro",                icon: "🌍", kw: /afro|kizomba|zouk|semba/i },
];
type DanceSubStyleId = typeof DANCE_SUBSTYLES[number]["id"];
function matchesDanceSubStyle(e: { title: string; description?: string | null }, style: typeof DANCE_SUBSTYLES[number]): boolean {
  if (!style.kw) return true;
  return style.kw.test(e.title) || style.kw.test(e.description ?? "");
}

/* ─── Sports sub-types ─── */
const SPORTS_SUBTYPES = [
  { id: "all",      label: "All Sports",   icon: "🏆", kw: null as RegExp | null },
  { id: "running",  label: "Running",      icon: "🏃", kw: /run|marathon|5k|10k|triathlon/i },
  { id: "football", label: "Football",     icon: "⚽", kw: /football|soccer|voetbal/i },
  { id: "basket",   label: "Basketball",   icon: "🏀", kw: /basketball|basket/i },
  { id: "fitness",  label: "Fitness",      icon: "💪", kw: /fitness|gym|workout|crossfit|training|bootcamp/i },
  { id: "cycling",  label: "Cycling",      icon: "🚲", kw: /cycling|cycle|fiets|wielren|bike/i },
  { id: "martial",  label: "Martial Arts", icon: "🥋", kw: /martial|karate|judo|boxing|mma|kickbox|boks/i },
  { id: "skate",    label: "Skate",        icon: "🛹", kw: /skate|skateboard|longboard/i },
];
type SportsSubTypeId = typeof SPORTS_SUBTYPES[number]["id"];
function matchesSportsSubType(e: { title: string; description?: string | null }, sub: typeof SPORTS_SUBTYPES[number]): boolean {
  if (!sub.kw) return true;
  return sub.kw.test(e.title) || sub.kw.test(e.description ?? "");
}

/* ─── Category accent colors for pills ─── */
const CAT_COLORS: Record<string, [string, string]> = {
  music:       ["#E8500A", "#F59E0B"],
  dance:       ["#EC4899", "#8B5CF6"],
  family:      ["#16A34A", "#14B8A6"],
  cultural:    ["#7C3AED", "#4F46E5"],
  sports:      ["#2563EB", "#0EA5E9"],
  art:         ["#A78BFA", "#EC4899"],
  nightlife:   ["#6D28D9", "#312E81"],
  workshop:    ["#4F46E5", "#6366F1"],
  community:   ["#14B8A6", "#0EA5E9"],
  festival:    ["#F59E0B", "#EF4444"],
  food:        ["#F97316", "#EF4444"],
  competition: ["#DC2626", "#7C3AED"],
};

/* ─────────────────────────────────────────────────────────
   FEATURED CAROUSEL — auto-advancing with progress bar
───────────────────────────────────────────────────────── */
function FeaturedCarousel({ events, savedIds, onSaveToggle }: {
  events: Event[];
  savedIds?: Set<number>;
  onSaveToggle?: (id: number) => void;
}) {
  const [active, setActive]         = useState(0);
  const [progress, setProgress]     = useState(0);
  const [paused, setPaused]         = useState(false);
  const [imgErr, setImgErr]         = useState(false);
  const [, navigate]                = useLocation();
  const localizeEvent               = useLocalizedEvent();
  const { t, language }             = useLanguage();
  const DURATION                    = 5000;
  const FALLBACK                    = "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=1200&q=80";

  /* Auto-advance */
  useEffect(() => {
    if (paused || events.length <= 1) return;
    setProgress(0);
    const start = Date.now();
    const raf = { id: 0 };
    const tick = () => {
      const pct = Math.min(100, ((Date.now() - start) / DURATION) * 100);
      setProgress(pct);
      if (pct < 100) {
        raf.id = requestAnimationFrame(tick);
      } else {
        setActive(p => (p + 1) % events.length);
        setImgErr(false);
      }
    };
    raf.id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.id);
  }, [active, paused, events.length]);

  if (!events.length) return null;
  const event = events[active];
  const loc   = localizeEvent(event);
  const img   = imgErr ? FALLBACK : (event.image || FALLBACK);
  const isSaved = savedIds?.has(event.id) ?? false;

  return (
    <div
      className="relative rounded-2xl overflow-hidden mb-8 group"
      style={{ height: "clamp(280px, 45vw, 420px)" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      data-testid="featured-carousel"
    >
      {/* Background image with crossfade */}
      {events.map((ev, i) => (
        <img
          key={ev.id}
          src={ev.image || FALLBACK}
          alt={ev.title}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
          style={{ opacity: i === active ? 1 : 0 }}
          onError={i === active ? () => setImgErr(true) : undefined}
        />
      ))}

      {/* Gradient layers */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent pointer-events-none" />

      {/* Top: Featured badge + nav */}
      <div className="absolute top-4 left-4 right-4 flex items-start justify-between">
        <div className="flex gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-yellow-400 text-yellow-950 shadow-lg shadow-yellow-400/30">
            <Star className="h-3.5 w-3.5 fill-yellow-950" /> Featured
          </span>
          {event.isTrending && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-orange-500 text-white shadow-lg shadow-orange-500/30">
              <Zap className="h-3.5 w-3.5 fill-white" /> Trending
            </span>
          )}
        </div>
        {events.length > 1 && (
          <div className="flex gap-2">
            <button
              onClick={() => { setActive(p => (p - 1 + events.length) % events.length); setImgErr(false); }}
              className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors border border-white/10"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => { setActive(p => (p + 1) % events.length); setImgErr(false); }}
              className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors border border-white/10"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Bottom content */}
      <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-7">
        <p className="text-white/60 text-xs mb-1.5 flex items-center gap-2">
          <MapPin className="h-3 w-3" /> {event.city || event.location}
          <span className="w-px h-3 bg-white/20" />
          <Calendar className="h-3 w-3" /> {format(new Date(event.date), "d MMM yyyy", { locale: language === "nl" ? nl : enUS })}
        </p>
        <h2 className="text-white font-extrabold text-xl sm:text-2xl md:text-3xl leading-tight line-clamp-2 mb-3 max-w-2xl">
          {loc.title}
        </h2>
        {loc.description && (
          <p className="text-white/60 text-xs mb-4 line-clamp-2 max-w-xl hidden sm:block">{loc.description}</p>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            size="sm"
            className="font-black rounded-xl px-5 shadow-lg"
            onClick={() => navigate(`/events/${event.id}`)}
          >
            {t("events.viewDetails")} <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
          <span className={cn(
            "px-3 py-1.5 rounded-xl text-sm font-black",
            !deriveIsPaid(event) ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30" : "bg-white text-gray-900"
          )}>
            {getEventPriceInfo(event, t("events.free"), t("events.paid")).shortLabel}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      {events.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
          <div
            className="h-full bg-white/60 transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Dots */}
      {events.length > 1 && (
        <div className="absolute bottom-3 right-5 flex gap-1.5">
          {events.map((_, i) => (
            <button
              key={i}
              onClick={() => { setActive(i); setImgErr(false); }}
              className={cn("rounded-full transition-all duration-300 bg-white", i === active ? "w-5 h-1.5 opacity-100" : "w-1.5 h-1.5 opacity-40 hover:opacity-70")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   SECTION — horizontal scroll with premium header
───────────────────────────────────────────────────────── */
function Section({ title, emoji, events, savedIds, onSaveToggle, accent }: {
  title: string;
  emoji?: string;
  events: Event[];
  savedIds?: Set<number>;
  onSaveToggle?: (id: number) => void;
  accent?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();
  const { t } = useLanguage();

  const scroll = (dir: "left" | "right") => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: dir === "right" ? 340 : -340, behavior: "smooth" });
  };

  if (events.length === 0) return null;

  return (
    <div className="mb-10">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4 px-0">
        <div className="flex items-center gap-2.5">
          {emoji && <span className="text-2xl leading-none">{emoji}</span>}
          <h2 className="font-extrabold text-lg tracking-tight" style={accent ? { color: accent } : {}}>
            {title}
          </h2>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {events.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => scroll("left")} className="hidden md:flex w-8 h-8 rounded-full bg-muted items-center justify-center hover:bg-muted/70 transition-colors text-muted-foreground">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => scroll("right")} className="hidden md:flex w-8 h-8 rounded-full bg-muted items-center justify-center hover:bg-muted/70 transition-colors text-muted-foreground">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide snap-x snap-mandatory -mx-0">
        {events.map(event => (
          <div key={event.id} className="snap-start shrink-0 w-64 sm:w-72">
            <EventCard event={event} savedIds={savedIds} onSaveToggle={onSaveToggle} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Empty state ─── */
function EmptyState({ onAdd }: { onAdd: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-5">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-xl shadow-violet-500/30">
        <Calendar className="h-10 w-10 text-white" />
      </div>
      <div>
        <p className="font-extrabold text-lg">{t("events.noResults")}</p>
        <p className="text-sm text-muted-foreground mt-1">{t("events.tryOtherFilters")}</p>
      </div>
      <Button onClick={onAdd} className="rounded-xl gap-2 font-bold">
        <Plus className="h-4 w-4" /> {t("events.create")}
      </Button>
    </div>
  );
}

/* ─── Sub-filter strip helper ─── */
function SubFilterStrip<T extends { id: string; label: string; icon: string }>({
  items, active, onSelect, accentColor, testIdPrefix, counts,
}: {
  items: T[];
  active: string;
  onSelect: (id: string) => void;
  accentColor?: string;
  testIdPrefix?: string;
  counts: Record<string, number>;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
      {items.map(item => {
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            data-testid={testIdPrefix ? `${testIdPrefix}-${item.id}` : undefined}
            onClick={() => onSelect(item.id)}
            className={cn(
              "shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-all duration-200 border whitespace-nowrap",
              isActive
                ? "text-white border-transparent shadow-md scale-105"
                : "bg-card border-border text-foreground hover:border-primary/50 hover:shadow-sm"
            )}
            style={isActive && accentColor ? { backgroundColor: accentColor, borderColor: accentColor } : {}}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
            {(counts[item.id] ?? 0) > 0 && (
              <span className={cn("text-[10px] font-black px-1.5 py-0.5 rounded-full", isActive ? "bg-white/20" : "bg-muted text-muted-foreground")}>
                {counts[item.id]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════ */
const EventsView = () => {
  const { t, language }      = useLanguage();
  const [searchQuery, setSearchQuery]   = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [showFilters, setShowFilters]   = useState(false);
  const [sortBy, setSortBy]             = useState<string>("soonest");
  const [priceFilter, setPriceFilter]   = useState<"all" | "free" | "paid">("all");
  const [kidFilter, setKidFilter]       = useState(false);
  const [familyFilter, setFamilyFilter] = useState(false);
  const [dateFilter, setDateFilter]     = useState<"all" | "today" | "week" | "weekend" | "month">("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "local" | "ticketmaster">("all");
  const [musicSubGenre, setMusicSubGenre]   = useState<MusicSubGenreId>("all");
  const [danceSubStyle, setDanceSubStyle]   = useState<DanceSubStyleId>("all");
  const [sportsSubType, setSportsSubType]   = useState<SportsSubTypeId>("all");
  const [showAddEventForm, setShowAddEventForm] = useState(false);
  const [localSavedIds, setLocalSavedIds]   = useState<Set<number>>(new Set());
  const [visibleCount, setVisibleCount]         = useState(24);
  const [discoveryVisibleCount, setDiscoveryVisibleCount] = useState(24);
  const [viewMode, setViewMode]         = useState<"grid" | "list">("grid");
  const [, navigate]   = useLocation();
  const { user }       = useAuth();
  const { toast }      = useToast();

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["/api/events"],
    refetchInterval: 120000,
  });

  const { data: savedIds = [] } = useQuery<number[]>({
    queryKey: ["/api/events/saved-ids"],
    queryFn: async () => {
      if (!user) return [];
      const res = await apiRequest("/api/events/saved", "GET");
      const saved: Event[] = await res.json();
      return saved.map(e => e.id);
    },
    enabled: !!user,
  });

  const savedSet = useMemo(() => new Set([...savedIds, ...localSavedIds]), [savedIds, localSavedIds]);

  const handleSaveToggle = (id: number) => {
    setLocalSavedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  /* ── Localized sub-filter labels (react to language changes) ── */
  const localizedMusicSubGenres = useMemo(() => MUSIC_SUBGENRES.map(g => ({
    ...g,
    label: g.id === "all" ? t("filter.music.all")
         : g.id === "classical" ? t("filter.music.classical")
         : g.label,
  })), [language]);

  const localizedDanceSubStyles = useMemo(() => DANCE_SUBSTYLES.map(s => ({
    ...s,
    label: s.id === "all" ? t("filter.dance.all") : s.label,
  })), [language]);

  const localizedSportsSubTypes = useMemo(() => SPORTS_SUBTYPES.map(s => ({
    ...s,
    label: s.id === "all" ? t("filter.sports.all")
         : s.id === "football" ? t("filter.sports.football")
         : s.label,
  })), [language]);

  const now        = new Date();
  const dayOfWeek  = now.getDay();
  const daysUntilSat = dayOfWeek === 6 ? 0 : 6 - dayOfWeek;
  const thisSat    = startOfDay(addDays(now, daysUntilSat));
  const thisSun    = endOfDay(addDays(thisSat, 1));

  /* ── Filtered events ── */
  const filteredEvents = useMemo(() => {
    let filtered = Array.isArray(events) ? [...events] : [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.title.toLowerCase().includes(q) ||
        (e.description?.toLowerCase().includes(q)) ||
        (e.location?.toLowerCase().includes(q)) ||
        (e.city?.toLowerCase().includes(q))
      );
    }
    if (selectedCategory !== "all") filtered = filtered.filter(e => e.category === selectedCategory);
    if (selectedCategory === "music" && musicSubGenre !== "all") {
      const genre = MUSIC_SUBGENRES.find(g => g.id === musicSubGenre);
      if (genre) filtered = filtered.filter(e => matchesMusicSubGenre(e, genre));
    }
    if (selectedCategory === "dance" && danceSubStyle !== "all") {
      const style = DANCE_SUBSTYLES.find(s => s.id === danceSubStyle);
      if (style) filtered = filtered.filter(e => matchesDanceSubStyle(e, style));
    }
    if (selectedCategory === "sports" && sportsSubType !== "all") {
      const sub = SPORTS_SUBTYPES.find(s => s.id === sportsSubType);
      if (sub) filtered = filtered.filter(e => matchesSportsSubType(e, sub));
    }
    if (selectedCity !== "all") filtered = filtered.filter(e =>
      e.city?.toLowerCase().includes(selectedCity.toLowerCase()) ||
      e.location?.toLowerCase().includes(selectedCity.toLowerCase())
    );
    if (priceFilter === "free") filtered = filtered.filter(e => !deriveIsPaid(e));
    if (priceFilter === "paid") filtered = filtered.filter(e => deriveIsPaid(e));
    if (kidFilter)    filtered = filtered.filter(e => e.kidFriendly || e.familyFriendly || e.category === "family");
    if (familyFilter) filtered = filtered.filter(e => e.familyFriendly || e.category === "family");
    const nowMs = Date.now();
    if (dateFilter === "today") {
      filtered = filtered.filter(e => isToday(new Date(e.date)));
    } else if (dateFilter === "week") {
      const weekEnd = new Date(nowMs + 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(e => { const d = new Date(e.date); return d >= now && d <= weekEnd; });
    } else if (dateFilter === "weekend") {
      filtered = filtered.filter(e => { const d = new Date(e.date); return d >= thisSat && d <= thisSun; });
    } else if (dateFilter === "month") {
      const monthEnd = new Date(nowMs + 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(e => { const d = new Date(e.date); return d >= now && d <= monthEnd; });
    }
    if (sourceFilter === "local") filtered = filtered.filter(e => !e.source || e.source === "manual");
    else if (sourceFilter === "ticketmaster") filtered = filtered.filter(e => e.source === "ticketmaster");
    if (sortBy === "newest")     filtered.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
    else if (sortBy === "soonest")  filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    else if (sortBy === "popular")  filtered.sort((a, b) => (b.attendeeCount ?? 0) - (a.attendeeCount ?? 0));
    else if (sortBy === "price_asc")  filtered.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    else if (sortBy === "price_desc") filtered.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    return filtered;
  }, [events, searchQuery, selectedCategory, selectedCity, priceFilter, kidFilter, familyFilter, dateFilter, sourceFilter, sortBy, musicSubGenre, danceSubStyle, sportsSubType, now, thisSat, thisSun]);

  useEffect(() => { setVisibleCount(24); }, [searchQuery, selectedCategory, selectedCity, priceFilter, kidFilter, familyFilter, dateFilter, sourceFilter, sortBy, musicSubGenre, danceSubStyle, sportsSubType]);
  useEffect(() => {
    if (selectedCategory !== "music") setMusicSubGenre("all");
    if (selectedCategory !== "dance") setDanceSubStyle("all");
    if (selectedCategory !== "sports") setSportsSubType("all");
  }, [selectedCategory]);

  /* ── Discovery sections ── */
  const SEC = 30;
  const myPendingEvents   = useMemo(() => events.filter(e => e.status === "pending" && e.organizerId === user?.id), [events, user]);
  const approvedEvents    = useMemo(() => events.filter(e => e.status === "approved" || !e.status), [events]);
  const featuredEvents    = useMemo(() => approvedEvents.filter(e => e.isFeatured).slice(0, SEC), [approvedEvents]);
  const trendingEvents    = useMemo(() => approvedEvents.filter(e => e.isTrending).slice(0, SEC), [approvedEvents]);
  const todayEvents       = useMemo(() => approvedEvents.filter(e => isToday(new Date(e.date))).slice(0, SEC), [approvedEvents]);
  const thisWeekEvents    = useMemo(() => {
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return approvedEvents.filter(e => { const d = new Date(e.date); return d >= now && d <= weekEnd && !isToday(d); }).slice(0, SEC);
  }, [approvedEvents, now]);
  const thisWeekendEvents = useMemo(() => approvedEvents.filter(e => {
    const d = new Date(e.date); return d >= thisSat && d <= thisSun;
  }).slice(0, SEC), [approvedEvents, thisSat, thisSun]);
  const musicEvents       = useMemo(() => approvedEvents.filter(e => e.category === "music").slice(0, SEC), [approvedEvents]);
  const familyEvents      = useMemo(() => approvedEvents.filter(e => e.category === "family" || e.kidFriendly || e.familyFriendly).slice(0, SEC), [approvedEvents]);
  const culturalEvents    = useMemo(() => approvedEvents.filter(e => e.category === "cultural").slice(0, SEC), [approvedEvents]);
  const sportsEvents      = useMemo(() => approvedEvents.filter(e => e.category === "sports").slice(0, SEC), [approvedEvents]);
  const danceEvents       = useMemo(() => approvedEvents.filter(e => e.category === "dance").slice(0, SEC), [approvedEvents]);
  const freeEvents        = useMemo(() => approvedEvents.filter(e => !deriveIsPaid(e)).slice(0, SEC), [approvedEvents]);
  const amsterdamEvents   = useMemo(() => approvedEvents.filter(e => e.city === "Amsterdam").slice(0, SEC), [approvedEvents]);
  const rotterdamEvents   = useMemo(() => approvedEvents.filter(e => e.city === "Rotterdam").slice(0, SEC), [approvedEvents]);
  const groningenEvents   = useMemo(() => approvedEvents.filter(e => e.city === "Groningen").slice(0, SEC), [approvedEvents]);
  const haarlemEvents     = useMemo(() => approvedEvents.filter(e => e.city === "Haarlem").slice(0, SEC), [approvedEvents]);
  const utrechtEvents     = useMemo(() => approvedEvents.filter(e => e.city === "Utrecht").slice(0, SEC), [approvedEvents]);
  const eindhovenEvents   = useMemo(() => approvedEvents.filter(e => e.city === "Eindhoven").slice(0, SEC), [approvedEvents]);

  const freeCount       = useMemo(() => approvedEvents.filter(e => !deriveIsPaid(e)).length, [approvedEvents]);
  const thisWeekCount   = useMemo(() => {
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return approvedEvents.filter(e => { const d = new Date(e.date); return d >= now && d <= weekEnd; }).length;
  }, [approvedEvents, now]);

  const hasActiveFilters = selectedCategory !== "all" || selectedCity !== "all" || priceFilter !== "all" || kidFilter || familyFilter || dateFilter !== "all" || searchQuery || sourceFilter !== "all" || musicSubGenre !== "all" || danceSubStyle !== "all" || sportsSubType !== "all";
  const activeFilterCount = [selectedCategory !== "all", selectedCity !== "all", priceFilter !== "all", kidFilter, familyFilter, dateFilter !== "all", sourceFilter !== "all", musicSubGenre !== "all", danceSubStyle !== "all", sportsSubType !== "all"].filter(Boolean).length;
  const showDiscovery = !hasActiveFilters;

  const handleSurpriseMe = () => {
    const eligible = approvedEvents.filter(e => new Date(e.date) >= now);
    if (eligible.length === 0) { toast({ title: t("events.surpriseMeEmpty") }); return; }
    navigate(`/events/${eligible[Math.floor(Math.random() * eligible.length)].id}`);
  };

  const openAddEventModal = () => {
    if (!user) { navigate("/auth"); return; }
    setShowAddEventForm(true);
  };

  const clearAllFilters = () => {
    setSelectedCategory("all"); setSelectedCity("all"); setPriceFilter("all");
    setKidFilter(false); setFamilyFilter(false); setSearchQuery(""); setDateFilter("all");
    setSourceFilter("all"); setMusicSubGenre("all"); setDanceSubStyle("all"); setSportsSubType("all");
  };

  /* ── Music sub-genre counts ── */
  const musicCounts = useMemo(() => {
    const base = approvedEvents.filter(e => e.category === "music");
    return Object.fromEntries(MUSIC_SUBGENRES.map(g => [g.id, g.id === "all" ? base.length : base.filter(e => matchesMusicSubGenre(e, g)).length]));
  }, [approvedEvents]);
  const danceCounts = useMemo(() => {
    const base = approvedEvents.filter(e => e.category === "dance");
    return Object.fromEntries(DANCE_SUBSTYLES.map(s => [s.id, s.id === "all" ? base.length : base.filter(e => matchesDanceSubStyle(e, s)).length]));
  }, [approvedEvents]);
  const sportsCounts = useMemo(() => {
    const base = approvedEvents.filter(e => e.category === "sports");
    return Object.fromEntries(SPORTS_SUBTYPES.map(s => [s.id, s.id === "all" ? base.length : base.filter(e => matchesSportsSubType(e, s)).length]));
  }, [approvedEvents]);

  /* ═══ RENDER ═══ */
  return (
    <div className="w-full max-w-7xl mx-auto">

      {/* ══════════════════════════════════════════
          PREMIUM HERO HEADER
      ══════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-3xl mx-4 mt-6 mb-6 p-6 sm:p-8"
        style={{
          background: "linear-gradient(135deg, #1a0533 0%, #2d1065 40%, #1e1052 70%, #0f0728 100%)",
          boxShadow: "0 20px 60px -10px rgba(109,40,217,0.4)",
        }}>
        {/* Animated background orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-12 -left-12 w-56 h-56 rounded-full opacity-20 blur-3xl"
            style={{ background: "radial-gradient(circle, #8B5CF6, transparent)" }} />
          <div className="absolute top-6 right-16 w-40 h-40 rounded-full opacity-15 blur-2xl"
            style={{ background: "radial-gradient(circle, #EC4899, transparent)" }} />
          <div className="absolute -bottom-8 left-1/2 w-72 h-32 rounded-full opacity-10 blur-3xl"
            style={{ background: "radial-gradient(circle, #4F46E5, transparent)" }} />
          {/* Subtle dot grid */}
          <div className="absolute inset-0 opacity-5"
            style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        </div>

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-black text-violet-400 uppercase tracking-widest">🇳🇱 Nederland</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
                {t("events.heroPrefix")} <span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(135deg, #A78BFA, #EC4899)" }}>{t("events.heroHighlight")}</span>
              </h1>
              <p className="text-white/50 text-sm mt-1 font-medium">
                {t("events.heroSubtitle")}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                data-testid="button-surprise-me"
                size="sm"
                onClick={handleSurpriseMe}
                className="hidden sm:flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 text-white border-white/10 border font-bold rounded-xl"
                variant="ghost"
              >
                <Shuffle className="h-3.5 w-3.5" /> {t("events.surpriseMeBtn")}
              </Button>
              <Button
                data-testid="button-create-event"
                size="sm"
                onClick={openAddEventModal}
                className="flex items-center gap-1.5 text-xs font-black rounded-xl"
                style={{ background: "linear-gradient(135deg, #7C3AED, #EC4899)" }}
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t("events.addEvent")}</span>
                <span className="sm:hidden">{t("events.new")}</span>
              </Button>
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex gap-4 mb-5 flex-wrap">
            {[
              { label: t("events.statsTotal"), value: approvedEvents.length, icon: "🎉" },
              { label: t("events.statsThisWeek"), value: thisWeekCount, icon: "📅" },
              { label: t("events.statsFree"), value: freeCount, icon: "🆓" },
            ].map(stat => (
              <div key={stat.label} className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/10">
                <span className="text-base">{stat.icon}</span>
                <div>
                  <p className="text-white font-extrabold text-sm leading-none">{stat.value}</p>
                  <p className="text-white/40 text-[10px] leading-none mt-0.5">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Search bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <input
                data-testid="input-search-events"
                placeholder={t("events.searchPlaceholder")}
                className="w-full pl-10 pr-10 py-3 rounded-xl text-sm font-medium text-white placeholder-white/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-violet-400/50 transition-all"
                style={{ background: "rgba(255,255,255,0.08)" }}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              data-testid="button-toggle-filters"
              onClick={() => setShowFilters(f => !f)}
              className={cn(
                "relative w-12 h-12 rounded-xl flex items-center justify-center border transition-all duration-200 shrink-0",
                showFilters
                  ? "bg-violet-500 border-violet-400 text-white"
                  : "bg-white/10 border-white/10 text-white/60 hover:bg-white/20"
              )}
            >
              <SlidersHorizontal className="h-4.5 w-4.5" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-pink-500 text-white text-[10px] font-black flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <button
              data-testid="button-surprise-sm"
              onClick={handleSurpriseMe}
              className="w-12 h-12 rounded-xl bg-white/10 border border-white/10 text-white/60 hover:bg-white/20 flex items-center justify-center transition-all sm:hidden shrink-0"
            >
              <Shuffle className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          ADVANCED FILTER PANEL
      ══════════════════════════════════════════ */}
      {showFilters && (
        <div className="mx-4 mb-5 p-5 bg-card border border-border rounded-2xl space-y-5 animate-in fade-in slide-in-from-top-2 duration-200 shadow-lg">
          {/* City */}
          <div>
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2.5 block">📍 {t("filter.city")}</label>
            <div className="flex flex-wrap gap-2">
              {["all", ...DUTCH_CITIES].map(city => (
                <button
                  key={city}
                  data-testid={`filter-city-${city}`}
                  onClick={() => setSelectedCity(city)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-bold transition-all border",
                    selectedCity === city
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/50 border-border hover:border-primary/50"
                  )}
                >
                  {city === "all" ? t("events.allCities") : city}
                </button>
              ))}
            </div>
          </div>

          {/* Price */}
          <div>
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2.5 block">💰 {t("filter.price")}</label>
            <div className="flex gap-2">
              {(["all", "free", "paid"] as const).map(p => (
                <button
                  key={p}
                  data-testid={`filter-price-${p}`}
                  onClick={() => setPriceFilter(p)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                    priceFilter === p
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/50 border-border hover:border-primary/50"
                  )}
                >
                  {p === "all" ? t("filter.all") : p === "free" ? `🆓 ${t("filter.free")}` : `💳 ${t("filter.paid")}`}
                </button>
              ))}
            </div>
          </div>

          {/* Audience */}
          <div>
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2.5 block">👥 {t("filter.audience")}</label>
            <div className="flex gap-2 flex-wrap">
              <button
                data-testid="filter-kid-friendly"
                onClick={() => setKidFilter(f => !f)}
                className={cn("flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all border", kidFilter ? "bg-blue-500 text-white border-blue-500" : "bg-muted/50 border-border hover:border-blue-400")}
              >
                <Baby className="h-3.5 w-3.5" /> {t("events.kidFriendly")}
              </button>
              <button
                data-testid="filter-family-friendly"
                onClick={() => setFamilyFilter(f => !f)}
                className={cn("flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all border", familyFilter ? "bg-green-500 text-white border-green-500" : "bg-muted/50 border-border hover:border-green-400")}
              >
                <Users className="h-3.5 w-3.5" /> {t("events.familyFriendly")}
              </button>
            </div>
          </div>

          {/* Source */}
          <div>
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2.5 block">🗂️ {t("filter.source")}</label>
            <div className="flex gap-2 flex-wrap">
              {([
                { id: "all",          label: t("filter.allSources") },
                { id: "ticketmaster", label: "🎫 Ticketmaster" },
                { id: "local",        label: `🏠 ${t("filter.local")}` },
              ] as const).map(s => (
                <button
                  key={s.id}
                  data-testid={`filter-source-${s.id}`}
                  onClick={() => setSourceFilter(s.id)}
                  className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all border", sourceFilter === s.id ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 border-border hover:border-primary/50")}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div>
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2.5 block">↕️ {t("filter.sort")}</label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "soonest",    label: t("sort.soonest") },
                { id: "newest",     label: t("sort.newest") },
                { id: "popular",    label: t("sort.popular") },
                { id: "price_asc",  label: t("sort.priceAsc") },
                { id: "price_desc", label: t("sort.priceDesc") },
              ].map(s => (
                <button
                  key={s.id}
                  data-testid={`sort-${s.id}`}
                  onClick={() => setSortBy(s.id)}
                  className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all border", sortBy === s.id ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 border-border hover:border-primary/50")}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {hasActiveFilters && (
            <button onClick={clearAllFilters} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-bold transition-colors">
              <X className="h-3.5 w-3.5" /> {t("events.clearAll")}
            </button>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          DATE QUICK FILTERS
      ══════════════════════════════════════════ */}
      <div className="px-4 mb-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {([
            { id: "all",     label: t("filter.allDates"),    icon: "🗓️" },
            { id: "today",   label: t("filter.today"),       icon: "⚡" },
            { id: "week",    label: t("filter.thisWeek"),    icon: "📆" },
            { id: "weekend", label: t("filter.thisWeekend"), icon: "🎉" },
            { id: "month",   label: t("filter.thisMonth"),   icon: "📅" },
          ] as const).map(d => (
            <button
              key={d.id}
              data-testid={`filter-date-${d.id}`}
              onClick={() => setDateFilter(d.id)}
              className={cn(
                "shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 border whitespace-nowrap",
                dateFilter === d.id
                  ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                  : "bg-muted/40 border-border text-foreground hover:border-primary/50"
              )}
            >
              <span>{d.icon}</span> {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          CATEGORY FILTER STRIP
      ══════════════════════════════════════════ */}
      <div className="px-4 mb-5">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {([
            { id: "all",         label: t("cat.all"),         icon: "✨", count: approvedEvents.length },
            { id: "music",       label: t("cat.music"),       icon: "🎵", count: approvedEvents.filter(e => e.category === "music").length },
            { id: "dance",       label: t("cat.dance"),       icon: "💃", count: approvedEvents.filter(e => e.category === "dance").length },
            { id: "festival",    label: t("cat.festival"),    icon: "🎪", count: approvedEvents.filter(e => e.category === "festival").length },
            { id: "family",      label: t("cat.family"),      icon: "👨‍👩‍👧", count: approvedEvents.filter(e => e.category === "family" || e.kidFriendly || e.familyFriendly).length },
            { id: "cultural",    label: t("cat.cultural"),    icon: "🎭", count: approvedEvents.filter(e => e.category === "cultural").length },
            { id: "sports",      label: t("cat.sports"),      icon: "🏆", count: approvedEvents.filter(e => e.category === "sports").length },
            { id: "art",         label: t("cat.art"),         icon: "🎨", count: approvedEvents.filter(e => e.category === "art").length },
            { id: "nightlife",   label: t("cat.nightlife"),   icon: "🌙", count: approvedEvents.filter(e => e.category === "nightlife").length },
            { id: "workshop",    label: t("cat.workshop"),    icon: "🔧", count: approvedEvents.filter(e => e.category === "workshop").length },
            { id: "community",   label: t("cat.community"),   icon: "🤝", count: approvedEvents.filter(e => e.category === "community").length },
            { id: "food",        label: t("cat.food"),        icon: "🍕", count: approvedEvents.filter(e => e.category === "food").length },
            { id: "competition", label: t("cat.competition"), icon: "🥇", count: approvedEvents.filter(e => e.category === "competition").length },
          ]).map(cat => {
            const isActive = cat.id === "all" ? selectedCategory === "all" : selectedCategory === cat.id;
            const [c1, c2] = CAT_COLORS[cat.id] ?? ["#6D28D9", "#4F46E5"];
            return (
              <button
                key={cat.id}
                data-testid={`filter-category-${cat.id}`}
                onClick={() => setSelectedCategory(cat.id === "all" ? "all" : (selectedCategory === cat.id ? "all" : cat.id))}
                className={cn(
                  "shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-bold transition-all duration-200 border whitespace-nowrap",
                  isActive ? "text-white border-transparent shadow-md" : "bg-card border-border text-foreground hover:shadow-sm hover:border-primary/30"
                )}
                style={isActive ? {
                  background: `linear-gradient(135deg, ${c1}, ${c2})`,
                  boxShadow: `0 4px 14px 0 ${c1}40`,
                } : {}}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                {cat.count > 0 && (
                  <span className={cn("text-[10px] font-black px-1.5 py-0.5 rounded-full", isActive ? "bg-white/20 text-white" : "bg-muted text-muted-foreground")}>
                    {cat.count > 999 ? `${Math.round(cat.count / 100) / 10}k` : cat.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Music sub-genres ── */}
      {selectedCategory === "music" && (
        <div className="px-4 mb-4 animate-in fade-in slide-in-from-top-1 duration-200">
          <SubFilterStrip items={localizedMusicSubGenres} active={musicSubGenre} onSelect={id => setMusicSubGenre(id as MusicSubGenreId)} accentColor="#E8500A" testIdPrefix="filter-music-genre" counts={musicCounts} />
        </div>
      )}

      {/* ── Dance sub-styles ── */}
      {selectedCategory === "dance" && (
        <div className="px-4 mb-4 animate-in fade-in slide-in-from-top-1 duration-200">
          <SubFilterStrip items={localizedDanceSubStyles} active={danceSubStyle} onSelect={id => setDanceSubStyle(id as DanceSubStyleId)} accentColor="#EC4899" testIdPrefix="filter-dance-style" counts={danceCounts} />
        </div>
      )}

      {/* ── Sports sub-types ── */}
      {selectedCategory === "sports" && (
        <div className="px-4 mb-4 animate-in fade-in slide-in-from-top-1 duration-200">
          <SubFilterStrip items={localizedSportsSubTypes} active={sportsSubType} onSelect={id => setSportsSubType(id as SportsSubTypeId)} accentColor="#2563EB" testIdPrefix="filter-sports-sub" counts={sportsCounts} />
        </div>
      )}

      {/* ══════════════════════════════════════════
          DISCOVERY MODE (no active filters)
      ══════════════════════════════════════════ */}
      {showDiscovery && (
        <div className="px-4">

          {/* My pending events */}
          {myPendingEvents.length > 0 && (
            <div className="mb-8 rounded-2xl border border-yellow-400/30 bg-yellow-50/50 dark:bg-yellow-900/10 p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">⏳</span>
                <h2 className="font-extrabold text-base text-yellow-800 dark:text-yellow-300">{t("events.pendingTitle")}</h2>
                <Badge className="bg-yellow-400/30 text-yellow-800 dark:text-yellow-200 text-xs border-0">{myPendingEvents.length}</Badge>
              </div>
              <p className="text-xs text-yellow-700 dark:text-yellow-400 mb-4">{t("events.pendingDesc")}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {myPendingEvents.map(event => (
                  <div key={event.id} className="relative">
                    <div className="absolute top-3 left-3 z-20">
                      <Badge className="bg-yellow-400 text-yellow-950 text-[10px] font-black">{t("events.pendingBadge")}</Badge>
                    </div>
                    <EventCard event={event} savedIds={savedSet} onSaveToggle={handleSaveToggle} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Featured hero carousel */}
          {featuredEvents.length > 0 && (
            <FeaturedCarousel events={featuredEvents} savedIds={savedSet} onSaveToggle={handleSaveToggle} />
          )}

          {/* Today */}
          {todayEvents.length > 0 && (
            <Section emoji="⚡" title={t("section.today")} events={todayEvents} savedIds={savedSet} onSaveToggle={handleSaveToggle} accent="#F59E0B" />
          )}

          {/* Trending */}
          {trendingEvents.length > 0 && (
            <Section emoji="🔥" title={t("section.trending")} events={trendingEvents} savedIds={savedSet} onSaveToggle={handleSaveToggle} accent="#E8500A" />
          )}

          {/* This Weekend */}
          {thisWeekendEvents.length > 0 && (
            <Section emoji="🎉" title={t("section.thisWeekend")} events={thisWeekendEvents} savedIds={savedSet} onSaveToggle={handleSaveToggle} />
          )}

          {/* Free Events */}
          {freeEvents.length > 0 && (
            <Section emoji="🆓" title={t("section.freeEvents")} events={freeEvents} savedIds={savedSet} onSaveToggle={handleSaveToggle} accent="#10B981" />
          )}

          {/* Dance & Urban Culture */}
          {danceEvents.length > 0 && (
            <Section emoji="💃" title={t("section.danceEvents")} events={danceEvents} savedIds={savedSet} onSaveToggle={handleSaveToggle} accent="#EC4899" />
          )}

          {/* Music */}
          {musicEvents.length > 0 && (
            <Section emoji="🎵" title={t("section.musicEvents")} events={musicEvents} savedIds={savedSet} onSaveToggle={handleSaveToggle} accent="#E8500A" />
          )}

          {/* Family & Kids */}
          {familyEvents.length > 0 && (
            <Section emoji="👨‍👩‍👧" title={t("section.familyEvents")} events={familyEvents} savedIds={savedSet} onSaveToggle={handleSaveToggle} accent="#16A34A" />
          )}

          {/* Cultural */}
          {culturalEvents.length > 0 && (
            <Section emoji="🎭" title={t("section.culturalEvents")} events={culturalEvents} savedIds={savedSet} onSaveToggle={handleSaveToggle} accent="#7C3AED" />
          )}

          {/* Sports */}
          {sportsEvents.length > 0 && (
            <Section emoji="🏆" title={t("section.sportsEvents")} events={sportsEvents} savedIds={savedSet} onSaveToggle={handleSaveToggle} accent="#2563EB" />
          )}

          {/* City sections */}
          {amsterdamEvents.length > 0 && (
            <Section emoji="📍" title="Amsterdam" events={amsterdamEvents} savedIds={savedSet} onSaveToggle={handleSaveToggle} />
          )}
          {rotterdamEvents.length > 0 && (
            <Section emoji="📍" title="Rotterdam" events={rotterdamEvents} savedIds={savedSet} onSaveToggle={handleSaveToggle} />
          )}
          {groningenEvents.length > 0 && (
            <Section emoji="📍" title="Groningen" events={groningenEvents} savedIds={savedSet} onSaveToggle={handleSaveToggle} />
          )}
          {haarlemEvents.length > 0 && (
            <Section emoji="📍" title="Haarlem" events={haarlemEvents} savedIds={savedSet} onSaveToggle={handleSaveToggle} />
          )}
          {utrechtEvents.length > 0 && (
            <Section emoji="📍" title="Utrecht" events={utrechtEvents} savedIds={savedSet} onSaveToggle={handleSaveToggle} />
          )}
          {eindhovenEvents.length > 0 && (
            <Section emoji="📍" title="Eindhoven" events={eindhovenEvents} savedIds={savedSet} onSaveToggle={handleSaveToggle} />
          )}

          {/* All Events grid */}
          {approvedEvents.length > 0 && (
            <div className="mb-10">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">🌟</span>
                  <h2 className="font-extrabold text-lg tracking-tight">{t("section.allEvents")}</h2>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {approvedEvents.length}
                  </span>
                </div>
                {/* View mode toggle */}
                <div className="flex bg-muted rounded-xl p-1 gap-1">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={cn("p-1.5 rounded-lg transition-all", viewMode === "grid" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={cn("p-1.5 rounded-lg transition-all", viewMode === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {approvedEvents.slice(0, discoveryVisibleCount).map(event => (
                    <EventCard key={event.id} event={event} savedIds={savedSet} onSaveToggle={handleSaveToggle} />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {approvedEvents.slice(0, discoveryVisibleCount).map(event => (
                    <EventCard key={event.id} event={event} variant="compact" savedIds={savedSet} onSaveToggle={handleSaveToggle} />
                  ))}
                </div>
              )}
              {discoveryVisibleCount < approvedEvents.length && (
                <div className="mt-8 flex justify-center">
                  <Button
                    variant="outline"
                    className="rounded-xl px-8 font-bold"
                    onClick={() => setDiscoveryVisibleCount(c => c + 24)}
                    data-testid="button-load-more-discovery"
                  >
                    {t("events.loadMore")} ({approvedEvents.length - discoveryVisibleCount} {t("events.remaining")})
                  </Button>
                </div>
              )}
            </div>
          )}

          {approvedEvents.length === 0 && <EmptyState onAdd={openAddEventModal} />}
        </div>
      )}

      {/* ══════════════════════════════════════════
          FILTERED RESULTS
      ══════════════════════════════════════════ */}
      {!showDiscovery && (
        <div className="px-4">
          {/* Active filter chips */}
          <div className="flex flex-wrap gap-2 mb-5">
            {selectedCategory !== "all" && (
              <Badge variant="secondary" className="flex items-center gap-1.5 pr-1.5 font-bold">
                {EVENT_CATEGORY_ICONS[selectedCategory]} {EVENT_CATEGORY_LABELS[selectedCategory]}
                <button onClick={() => setSelectedCategory("all")} className="hover:text-foreground text-muted-foreground ml-0.5"><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {selectedCity !== "all" && (
              <Badge variant="secondary" className="flex items-center gap-1.5 pr-1.5 font-bold">
                <MapPin className="h-3 w-3" /> {selectedCity}
                <button onClick={() => setSelectedCity("all")} className="hover:text-foreground text-muted-foreground ml-0.5"><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {priceFilter !== "all" && (
              <Badge variant="secondary" className="flex items-center gap-1.5 pr-1.5 font-bold">
                {priceFilter === "free" ? `🆓 ${t("filter.free")}` : `💳 ${t("filter.paid")}`}
                <button onClick={() => setPriceFilter("all")} className="hover:text-foreground text-muted-foreground ml-0.5"><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {kidFilter && (
              <Badge variant="secondary" className="flex items-center gap-1.5 pr-1.5 font-bold">
                🧒 {t("events.kidFriendly")}
                <button onClick={() => setKidFilter(false)} className="hover:text-foreground text-muted-foreground ml-0.5"><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {familyFilter && (
              <Badge variant="secondary" className="flex items-center gap-1.5 pr-1.5 font-bold">
                👨‍👩‍👧 {t("events.family")}
                <button onClick={() => setFamilyFilter(false)} className="hover:text-foreground text-muted-foreground ml-0.5"><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {dateFilter !== "all" && (
              <Badge variant="secondary" className="flex items-center gap-1.5 pr-1.5 font-bold">
                <Calendar className="h-3 w-3" /> {dateFilter === "today" ? t("filter.today") : dateFilter === "week" ? t("filter.thisWeek") : dateFilter === "weekend" ? t("filter.thisWeekend") : t("filter.thisMonth")}
                <button onClick={() => setDateFilter("all")} className="hover:text-foreground text-muted-foreground ml-0.5"><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {searchQuery && (
              <Badge variant="secondary" className="flex items-center gap-1.5 pr-1.5 font-bold">
                <Search className="h-3 w-3" /> "{searchQuery}"
                <button onClick={() => setSearchQuery("")} className="hover:text-foreground text-muted-foreground ml-0.5"><X className="h-3 w-3" /></button>
              </Badge>
            )}
            <button onClick={clearAllFilters} className="text-xs text-muted-foreground hover:text-foreground font-bold transition-colors flex items-center gap-1">
              <X className="h-3 w-3" /> {t("events.clearAll")}
            </button>
          </div>

          {/* Results header */}
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm font-bold text-muted-foreground">
              <span className="text-foreground font-extrabold text-base">{filteredEvents.length}</span> {t("events.eventsFound")}
            </p>
            <div className="flex bg-muted rounded-xl p-1 gap-1">
              <button onClick={() => setViewMode("grid")} className={cn("p-1.5 rounded-lg transition-all", viewMode === "grid" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button onClick={() => setViewMode("list")} className={cn("p-1.5 rounded-lg transition-all", viewMode === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>

          {filteredEvents.length === 0 ? (
            <EmptyState onAdd={openAddEventModal} />
          ) : viewMode === "grid" ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredEvents.slice(0, visibleCount).map(event => (
                  <EventCard key={event.id} event={event} savedIds={savedSet} onSaveToggle={handleSaveToggle} />
                ))}
              </div>
              {visibleCount < filteredEvents.length && (
                <div className="mt-8 flex justify-center">
                  <Button variant="outline" className="rounded-xl px-8 font-bold" onClick={() => setVisibleCount(c => c + 24)} data-testid="button-load-more">
                    {t("events.loadMore")} ({filteredEvents.length - visibleCount} {t("events.remaining")})
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              {filteredEvents.slice(0, visibleCount).map(event => (
                <EventCard key={event.id} event={event} variant="compact" savedIds={savedSet} onSaveToggle={handleSaveToggle} />
              ))}
              {visibleCount < filteredEvents.length && (
                <div className="mt-6 flex justify-center">
                  <Button variant="outline" className="rounded-xl px-8 font-bold" onClick={() => setVisibleCount(c => c + 24)}>
                    {t("events.loadMore")}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add Event modal */}
      {showAddEventForm && (
        <AddEventForm
          open={showAddEventForm}
          onClose={() => setShowAddEventForm(false)}
        />
      )}
    </div>
  );
};

export default EventsView;
