import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar, Clock, MapPin, Users, ArrowLeft, Ticket,
  CheckCircle2, XCircle, Loader2, CreditCard, Euro,
  ChevronLeft, ChevronRight, Dumbbell, Zap, Star,
  Search, Bookmark, BookmarkCheck, Map as MapIcon, Flame, TrendingUp, Sparkles,
} from "lucide-react";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isToday } from "date-fns";
import { nl } from "date-fns/locale";
import AIEventFinder from "@/components/ai/AIEventFinder";

// ── Category definitions ──────────────────────────────────────────────────────

const SCHEDULE_CATEGORY_EMOJI: Record<string, string> = {
  fitness_class: "🏋️", yoga: "🧘", pilates: "🤸", boxing: "🥊",
  martial_arts: "🥋", crossfit: "💪", spinning: "🚴",
  dance_class: "💃", dance_battle: "🕺", open_floor: "🪩",
  open_training: "🏃", personal_training: "👤", group_session: "👥",
  sports_training: "⚽", workshop: "🔧", dj_night: "🎛️",
  live_music: "🎵", exhibition: "🖼️", open_mic: "🎤",
  event: "📅", private_event: "🔒", other: "📋",
};

const CATEGORY_COLORS: Record<string, string> = {
  fitness_class: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  yoga: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  pilates: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300",
  boxing: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  martial_arts: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  crossfit: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  spinning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  dance_class: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  dance_battle: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  open_floor: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  open_training: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  personal_training: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  group_session: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300",
  sports_training: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  workshop: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  dj_night: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  live_music: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  exhibition: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  event: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

// Discover tab: human-readable category groups for the 2500+ OSM/spotlight spots
const DISCOVER_FILTERS = [
  { key: "all",      label: "All",          emoji: "🌐" },
  { key: "dance",    label: "Dance",        emoji: "💃" },
  { key: "music",    label: "Music",        emoji: "🎵" },
  { key: "art",      label: "Art & Culture",emoji: "🎨" },
  { key: "fitness",  label: "Fitness",      emoji: "🏋️" },
  { key: "street",   label: "Street Sports",emoji: "🛹" },
  { key: "food",     label: "Food & Drink", emoji: "🍕" },
  { key: "chill",    label: "Chill Spots",  emoji: "☕" },
  { key: "shows",    label: "Shows",        emoji: "🎭" },
  { key: "shop",     label: "Shops",        emoji: "🛍️" },
  { key: "outdoor",  label: "Outdoor",      emoji: "🌿" },
];

// Map OSM category/type keywords → discover filter key
function osmToDiscoverCategory(cat: string): string {
  const c = (cat || "").toLowerCase();
  if (/dance|danc|bboy|breakdanc|hip.?hop/.test(c)) return "dance";
  if (/music|concert|dj|club|nightclub|bar|pub/.test(c)) return "music";
  if (/museum|gallery|art|graffiti|mural|exhibition|culture|cinema|theatre|theater/.test(c)) return "art";
  if (/gym|fitness|sport|yoga|pilates|boxing|crossfit|martial|skate.*park|basketball/.test(c)) return "fitness";
  if (/skate|bmx|parkour|street.*sport|basketball|breakdance/.test(c)) return "street";
  if (/restaurant|cafe|coffee|food|eat|takeaway|fast.?food|bakery|pizza|burger/.test(c)) return "food";
  if (/park|garden|chill|lounge|bench|library|community/.test(c)) return "chill";
  if (/theatre|theater|cinema|show|performance|comedy/.test(c)) return "shows";
  if (/shop|store|market|mall|boutique|record/.test(c)) return "shop";
  if (/outdoor|nature|forest|beach|river|lake/.test(c)) return "outdoor";
  return "other";
}

// ── Schedule helpers ──────────────────────────────────────────────────────────

function getWeekStart(baseDate: Date) {
  return startOfWeek(baseDate, { weekStartsOn: 1 });
}
function getWeekDays(weekStart: Date) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}
function statusBadge(status: string) {
  if (status === "paid") return <Badge className="bg-green-500 text-white text-xs py-0"><CheckCircle2 className="w-3 h-3 mr-0.5" />Paid</Badge>;
  if (status === "reserved") return <Badge className="bg-blue-500 text-white text-xs py-0"><Ticket className="w-3 h-3 mr-0.5" />Reserved</Badge>;
  if (status === "pending_payment") return <Badge className="bg-yellow-500 text-white text-xs py-0"><CreditCard className="w-3 h-3 mr-0.5" />Pending</Badge>;
  return null;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface PublicEvent {
  id: number;
  userId: number;
  title: string;
  description: string | null;
  category: string;
  startTime: string;
  endTime: string;
  occurrenceDate: string;
  isRecurring: boolean;
  recurrenceType: string | null;
  capacity: number | null;
  ticketPrice: string | null;
  venueName: string | null;
  venueType: string | null;
  organizerName: string | null;
  registrationCount: number;
  spotsLeft: number | null;
  isFree: boolean;
}

interface SpotCard {
  id: number | null;
  osmId: number | null;
  name: string;
  category: string;
  lat: number;
  lon: number;
  address?: string | null;
  isSpotlighted: boolean;
  isSaved?: boolean;
}

// ── Schedule category filter pills ───────────────────────────────────────────

const SCHEDULE_FILTERS = [
  { key: "all",       label: "All",       emoji: "🌐" },
  { key: "dance",     label: "Dance",     emoji: "💃" },
  { key: "fitness",   label: "Fitness",   emoji: "🏋️" },
  { key: "music",     label: "Music",     emoji: "🎵" },
  { key: "workshop",  label: "Workshop",  emoji: "🔧" },
  { key: "shows",     label: "Shows",     emoji: "🎭" },
  { key: "free",      label: "Free",      emoji: "🆓" },
];

function scheduleMatchesFilter(event: PublicEvent, key: string): boolean {
  if (key === "all") return true;
  if (key === "free") return event.isFree;
  const cat = event.category.toLowerCase();
  if (key === "dance") return /dance|open_floor/.test(cat);
  if (key === "fitness") return /fitness|yoga|pilates|boxing|martial|crossfit|spinning|training|group/.test(cat);
  if (key === "music") return /music|dj|open_mic/.test(cat);
  if (key === "workshop") return /workshop|exhibition/.test(cat);
  if (key === "shows") return /event/.test(cat);
  return true;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProgrammeEventsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAuthenticated = !!user;

  // View state
  const [activeTab, setActiveTab] = useState<"schedule" | "discover">("schedule");
  const [scheduleCategory, setScheduleCategory] = useState("all");
  const [discoverCategory, setDiscoverCategory] = useState("all");
  const [discoverSearch, setDiscoverSearch] = useState("");

  // Schedule state
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [selectedVenue, setSelectedVenue] = useState<string>("all");
  const [selectedEvent, setSelectedEvent] = useState<PublicEvent | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(() => format(new Date(), "yyyy-MM-dd"));

  // Discover page state
  const [selectedSpot, setSelectedSpot] = useState<SpotCard | null>(null);
  const [discoverPage, setDiscoverPage] = useState(0);
  const PAGE_SIZE = 24;

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchFrom = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 14); return d.toISOString().slice(0, 10); }, []);
  const fetchTo = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 56); return d.toISOString().slice(0, 10); }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get("payment");
    const itemId = params.get("item");
    const sessionId = params.get("session_id");
    if (paymentStatus === "success" && itemId && sessionId) {
      fetch(`/api/programme/activate-payment?item_id=${itemId}&session_id=${sessionId}`, { credentials: "include" })
        .then(r => r.json())
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/programme/public"] });
          queryClient.invalidateQueries({ queryKey: ["/api/programme/my-reservations"] });
          toast({ title: "Booking confirmed!", description: "Your spot is booked. See you there!" });
        })
        .catch(() => toast({ title: "Payment received", description: "Your booking has been recorded." }));
      window.history.replaceState({}, "", "/programme/events");
    } else if (paymentStatus === "cancelled") {
      toast({ title: "Payment cancelled", description: "Spot still reserved — complete payment anytime.", variant: "destructive" });
      window.history.replaceState({}, "", "/programme/events");
    }
  }, []);

  const { data: allEvents = [], isLoading: isLoadingSchedule } = useQuery<PublicEvent[]>({
    queryKey: ["/api/programme/public", fetchFrom, fetchTo],
    queryFn: async () => {
      const r = await fetch(`/api/programme/public?from=${fetchFrom}&to=${fetchTo}`, { credentials: "include" });
      return r.json();
    },
  });

  const { data: myRegsRaw } = useQuery<any[] | null>({
    queryKey: ["/api/programme/my-reservations"],
  });
  const myRegs = myRegsRaw ?? [];
  const myRegMap = useMemo(
    () => new Map<string, any>(myRegs.map((r: any) => [`${r.itemId}:${r.occurrenceDate}`, r])),
    [myRegs]
  );

  const { data: spotlights = [], isLoading: isLoadingSpotlights } = useQuery<any[]>({
    queryKey: ["/api/city-spots/spotlights"],
    enabled: activeTab === "discover",
  });

  const { data: savedLocationsData = [] } = useQuery<any[]>({
    queryKey: ["/api/users/saved-locations"],
    enabled: isAuthenticated,
  });
  const savedOsmIds = useMemo(
    () => new Set<number>((savedLocationsData).filter((d: any) => d.osmId != null).map((d: any) => Number(d.osmId))),
    [savedLocationsData]
  );

  // ── Save mutations ─────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: ({ osmId, name, category, lat, lon }: { osmId: number; name: string; category: string; lat: number; lon: number }) =>
      apiRequest(`/api/city-spots/${osmId}/save`, "POST", { name, category, lat, lon }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/saved-locations"] });
      toast({ title: "Spot saved!", description: "Added to your saved spots" });
    },
    onError: () => toast({ title: "Error", description: "Failed to save", variant: "destructive" }),
  });

  const unsaveMutation = useMutation({
    mutationFn: (osmId: number) => apiRequest(`/api/city-spots/${osmId}/save`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/saved-locations"] });
      toast({ title: "Removed from saved" });
    },
    onError: () => toast({ title: "Error", description: "Failed to unsave", variant: "destructive" }),
  });

  // ── Register/cancel mutations ──────────────────────────────────────────────

  function parseServerError(e: any): string {
    const raw: string = e?.message || "Unknown error";
    try {
      const jsonStr = raw.replace(/^\d+:\s*/, "");
      const parsed = JSON.parse(jsonStr);
      return parsed.message || raw;
    } catch {
      return raw.replace(/^\d+:\s*/, "").replace(/^Error:\s*/i, "");
    }
  }

  const registerMutation = useMutation({
    mutationFn: async (event: PublicEvent) => {
      const res = await apiRequest(`/api/programme/events/${event.id}/register`, "POST", {
        occurrenceDate: event.occurrenceDate,
        occurrenceStart: event.startTime,
        occurrenceEnd: event.endTime,
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.requiresPayment && data.checkoutUrl && data.checkoutUrl.startsWith('https://')) {
        toast({ title: "Redirecting to payment…", description: "You'll be taken to the checkout page." });
        setTimeout(() => { window.location.href = data.checkoutUrl; }, 600);
      } else {
        toast({ title: "Booked!", description: "Your spot is reserved." });
        queryClient.invalidateQueries({ queryKey: ["/api/programme/public"] });
        queryClient.invalidateQueries({ queryKey: ["/api/programme/my-reservations"] });
        setSelectedEvent(null);
      }
    },
    onError: (e: any) => {
      const msg = parseServerError(e);
      toast({ title: "Booking failed", description: msg, variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (event: PublicEvent) => {
      const res = await apiRequest(`/api/programme/events/${event.id}/register`, "DELETE", { occurrenceDate: event.occurrenceDate });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Booking cancelled" });
      queryClient.invalidateQueries({ queryKey: ["/api/programme/public"] });
      queryClient.invalidateQueries({ queryKey: ["/api/programme/my-reservations"] });
      setSelectedEvent(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Derived data ───────────────────────────────────────────────────────────

  const venues = useMemo(() => {
    const seen = new Set<string>();
    const list: { name: string; type: string | null }[] = [];
    allEvents.forEach(e => {
      if (e.venueName && !seen.has(e.venueName)) { seen.add(e.venueName); list.push({ name: e.venueName, type: e.venueType }); }
    });
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [allEvents]);

  const filteredEvents = useMemo(() => {
    let list = selectedVenue === "all" ? allEvents : allEvents.filter(e => e.venueName === selectedVenue);
    list = list.filter(e => scheduleMatchesFilter(e, scheduleCategory));
    return list;
  }, [allEvents, selectedVenue, scheduleCategory]);

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);

  const byDay = useMemo(() => {
    const map = new Map<string, PublicEvent[]>();
    filteredEvents.forEach(e => {
      const key = e.occurrenceDate;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    map.forEach((list, key) => map.set(key, list.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())));
    return map;
  }, [filteredEvents]);

  // Discover: combine spotlights + optionally more spots
  const allDiscoverSpots: SpotCard[] = useMemo(() => {
    return spotlights.map((s: any) => ({
      id: s.id,
      osmId: s.osmId ?? null,
      name: s.name,
      category: s.category || s.venueType || "other",
      lat: s.lat,
      lon: s.lon,
      address: s.address || s.vicinity || null,
      isSpotlighted: true,
      isSaved: s.osmId ? savedOsmIds.has(Number(s.osmId)) : false,
    }));
  }, [spotlights, savedOsmIds]);

  const filteredDiscoverSpots = useMemo(() => {
    let list = allDiscoverSpots;
    if (discoverCategory !== "all") {
      list = list.filter(s => osmToDiscoverCategory(s.category) === discoverCategory);
    }
    if (discoverSearch.trim()) {
      const q = discoverSearch.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || (s.address || "").toLowerCase().includes(q) || s.category.toLowerCase().includes(q));
    }
    return list;
  }, [allDiscoverSpots, discoverCategory, discoverSearch]);

  const paginatedSpots = useMemo(() => filteredDiscoverSpots.slice(0, (discoverPage + 1) * PAGE_SIZE), [filteredDiscoverSpots, discoverPage]);

  // Featured (spotlighted) recommendations
  const featuredSpots = useMemo(() => allDiscoverSpots.filter(s => s.isSpotlighted).slice(0, 8), [allDiscoverSpots]);

  const isPending = registerMutation.isPending || cancelMutation.isPending;
  const isCurrentWeek = format(weekStart, "yyyy-MM-dd") === format(getWeekStart(new Date()), "yyyy-MM-dd");

  const accentBar = (cat: string) => {
    const cls = CATEGORY_COLORS[cat] || "";
    if (cls.includes("orange")) return "bg-orange-400";
    if (cls.includes("green")) return "bg-green-400";
    if (cls.includes("purple") || cls.includes("violet")) return "bg-purple-400";
    if (cls.includes("blue") || cls.includes("sky") || cls.includes("cyan")) return "bg-blue-400";
    if (cls.includes("red")) return "bg-red-400";
    if (cls.includes("yellow")) return "bg-yellow-400";
    if (cls.includes("pink")) return "bg-pink-400";
    if (cls.includes("indigo")) return "bg-indigo-400";
    if (cls.includes("amber")) return "bg-amber-400";
    if (cls.includes("teal")) return "bg-teal-400";
    return "bg-gray-400";
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Header ── */}
      <div className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => setLocation("/")}
            className="p-2 hover:bg-muted rounded-full transition-colors"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-base leading-none">Programme</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Schedule & discover 2500+ spots</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs shrink-0"
            onClick={() => setLocation("/programme/my-reservations")}
            data-testid="link-my-bookings"
          >
            <Ticket className="w-3.5 h-3.5 mr-1" />
            My bookings
          </Button>
        </div>

        {/* ── Main tabs ── */}
        <div className="flex px-4 gap-1 border-b border-border">
          {([
            { key: "schedule", label: "📅 Schedule" },
            { key: "discover", label: "🗺 Discover" },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              data-testid={`tab-${tab.key}`}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── AI Event Finder ── */}
        <div className="px-4 pt-3">
          <AIEventFinder
            events={allEvents.map(e => ({
              id: e.id,
              title: e.title,
              category: e.category,
              location: e.venueName || undefined,
              date: e.occurrenceDate,
            }))}
          />
        </div>

        {/* ── Schedule sub-controls ── */}
        {activeTab === "schedule" && (
          <>
            {/* Category pill filters */}
            <div className="px-4 pt-2 pb-1 flex gap-2 overflow-x-auto no-scrollbar">
              {SCHEDULE_FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setScheduleCategory(f.key)}
                  data-testid={`filter-category-${f.key}`}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                    scheduleCategory === f.key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  <span>{f.emoji}</span>
                  <span>{f.label}</span>
                </button>
              ))}
            </div>

            {/* Venue filter */}
            {venues.length > 0 && (
              <div className="px-4 pb-1.5 flex gap-2 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setSelectedVenue("all")}
                  data-testid="filter-venue-all"
                  className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                    selectedVenue === "all"
                      ? "bg-foreground text-background"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  📍 All venues
                </button>
                {venues.map(v => (
                  <button
                    key={v.name}
                    onClick={() => setSelectedVenue(v.name)}
                    data-testid={`filter-venue-${v.name}`}
                    className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                      selectedVenue === v.name
                        ? "bg-foreground text-background"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            )}

            {/* Week navigation */}
            <div className="flex items-center gap-2 px-4 pb-3 pt-1">
              <button onClick={() => setWeekStart(w => subWeeks(w, 1))} className="p-1.5 hover:bg-muted rounded-lg transition-colors" data-testid="button-prev-week">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex-1 flex gap-1 overflow-x-auto no-scrollbar">
                {weekDays.map(day => {
                  const key = format(day, "yyyy-MM-dd");
                  const dayEvents = byDay.get(key) || [];
                  const isExpanded = expandedDay === key;
                  const today = isToday(day);
                  return (
                    <button
                      key={key}
                      onClick={() => setExpandedDay(isExpanded ? null : key)}
                      data-testid={`day-tab-${key}`}
                      className={`flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-xl transition-all min-w-[42px] ${
                        isExpanded ? "bg-primary text-primary-foreground" : today ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      <span className="text-[10px] font-medium uppercase">{format(day, "EEE", { locale: nl })}</span>
                      <span className={`text-base font-bold leading-none ${today && !isExpanded ? "text-primary" : ""}`}>{format(day, "d")}</span>
                      {dayEvents.length > 0 && (
                        <span className={`text-[9px] font-semibold ${isExpanded ? "text-primary-foreground/80" : "text-primary"}`}>{dayEvents.length}</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setWeekStart(w => addWeeks(w, 1))} className="p-1.5 hover:bg-muted rounded-lg transition-colors" data-testid="button-next-week">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}

        {/* ── Discover sub-controls ── */}
        {activeTab === "discover" && (
          <>
            {/* Search bar */}
            <div className="px-4 py-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search spots, venues, areas…"
                  value={discoverSearch}
                  onChange={e => { setDiscoverSearch(e.target.value); setDiscoverPage(0); }}
                  className="pl-9 h-9 text-sm"
                  data-testid="input-discover-search"
                />
              </div>
            </div>

            {/* Category pill filters */}
            <div className="px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
              {DISCOVER_FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => { setDiscoverCategory(f.key); setDiscoverPage(0); }}
                  data-testid={`filter-discover-${f.key}`}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                    discoverCategory === f.key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  <span>{f.emoji}</span>
                  <span>{f.label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">

        {/* ════════════════════ SCHEDULE TAB ════════════════════ */}
        {activeTab === "schedule" && (
          isLoadingSchedule ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="pb-8">
              {weekDays.map(day => {
                const key = format(day, "yyyy-MM-dd");
                const dayEvents = byDay.get(key) || [];
                const isExpanded = expandedDay === key;
                const today = isToday(day);

                return (
                  <div key={key}>
                    <button
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-border hover:bg-muted/30 transition-colors ${today ? "bg-primary/5" : ""}`}
                      onClick={() => setExpandedDay(isExpanded ? null : key)}
                      data-testid={`day-header-${key}`}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <span className={`font-bold text-sm ${today ? "text-primary" : "text-foreground"}`}>
                          {today ? "Today" : format(day, "EEEE", { locale: nl })}
                        </span>
                        <span className="text-xs text-muted-foreground">{format(day, "d MMMM", { locale: nl })}</span>
                      </div>
                      {dayEvents.length > 0 ? (
                        <Badge variant="secondary" className="text-xs">{dayEvents.length} {dayEvents.length === 1 ? "session" : "sessions"}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Nothing scheduled</span>
                      )}
                      <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                    </button>

                    {isExpanded && (
                      <div className="bg-muted/10">
                        {dayEvents.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">Nothing scheduled{selectedVenue !== "all" ? ` at ${selectedVenue}` : ""}</p>
                            <button className="mt-3 text-xs text-primary font-medium" onClick={() => setActiveTab("discover")}>
                              Discover spots instead →
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-0">
                            {dayEvents.map((event, idx) => {
                              const regKey = `${event.id}:${event.occurrenceDate}`;
                              const myReg = myRegMap.get(regKey);
                              const start = new Date(event.startTime);
                              const end = new Date(event.endTime);
                              const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);
                              const isFull = event.spotsLeft !== null && event.spotsLeft === 0 && !myReg;
                              const colorCls = CATEGORY_COLORS[event.category] || CATEGORY_COLORS.other;

                              return (
                                <div
                                  key={`${event.id}-${event.occurrenceDate}`}
                                  className={`flex items-stretch gap-0 border-b border-border last:border-b-0 cursor-pointer hover:bg-muted/30 transition-colors ${idx % 2 === 0 ? "bg-background" : "bg-muted/5"}`}
                                  onClick={() => setSelectedEvent(event)}
                                  data-testid={`class-card-${event.id}-${event.occurrenceDate}`}
                                >
                                  <div className="w-16 shrink-0 flex flex-col items-center justify-center py-3 border-r border-border/50 gap-0.5">
                                    <span className="text-xs font-bold text-foreground">{format(start, "HH:mm")}</span>
                                    <span className="text-[10px] text-muted-foreground">
                                      {durationMin >= 60 ? `${Math.floor(durationMin / 60)}h${durationMin % 60 ? (durationMin % 60) + "m" : ""}` : `${durationMin}m`}
                                    </span>
                                  </div>
                                  <div className={`w-1 shrink-0 ${accentBar(event.category)}`} />
                                  <div className="flex-1 px-3 py-3 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                          <span className="text-sm">{SCHEDULE_CATEGORY_EMOJI[event.category] || "📋"}</span>
                                          <span className="font-semibold text-sm leading-tight truncate" data-testid={`text-class-title-${event.id}`}>{event.title}</span>
                                        </div>
                                        {event.venueName && (
                                          <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                                            <MapPin className="w-3 h-3 shrink-0" />{event.venueName}
                                          </p>
                                        )}
                                      </div>
                                      <div className="flex flex-col items-end gap-1 shrink-0">
                                        {myReg && statusBadge(myReg.status)}
                                        <span className={`text-xs font-bold ${event.isFree ? "text-green-600 dark:text-green-400" : "text-primary"}`}>
                                          {event.isFree ? "Free" : `€${parseFloat(event.ticketPrice!).toFixed(2)}`}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1.5">
                                      {event.capacity && (
                                        <span className={`text-[11px] flex items-center gap-0.5 ${isFull ? "text-red-500" : "text-muted-foreground"}`}>
                                          <Users className="w-3 h-3" />
                                          {isFull ? "Full" : event.spotsLeft !== null ? `${event.spotsLeft} left` : `${event.capacity} spots`}
                                        </span>
                                      )}
                                      {event.isRecurring && <span className="text-[11px] text-muted-foreground">↻ {event.recurrenceType || "weekly"}</span>}
                                      {!myReg && !isFull && (
                                        <button className="ml-auto text-xs text-primary font-semibold hover:underline" onClick={e => { e.stopPropagation(); setSelectedEvent(event); }} data-testid={`button-quick-book-${event.id}-${event.occurrenceDate}`}>
                                          {event.isFree ? "Reserve →" : "Book →"}
                                        </button>
                                      )}
                                      {myReg && <span className="ml-auto text-[11px] text-green-600 dark:text-green-400 font-medium">✓ Booked</span>}
                                      {isFull && !myReg && <span className="ml-auto text-[11px] text-red-500 font-medium">Full</span>}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {weekDays.every(d => (byDay.get(format(d, "yyyy-MM-dd")) || []).length === 0) && !isLoadingSchedule && (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground px-6">
                  <Dumbbell className="w-10 h-10 mb-3 opacity-30" />
                  <p className="font-medium text-center">No sessions scheduled this week</p>
                  <p className="text-sm mt-1 text-center mb-4">
                    {selectedVenue !== "all" ? `${selectedVenue} has nothing for this week` : "Try another week or discover spots"}
                  </p>
                  <div className="flex gap-2">
                    {!isCurrentWeek && (
                      <Button size="sm" variant="outline" onClick={() => setWeekStart(getWeekStart(new Date()))} data-testid="button-go-to-today">
                        This week
                      </Button>
                    )}
                    <Button size="sm" onClick={() => setActiveTab("discover")} data-testid="button-go-discover">
                      <MapIcon className="w-3.5 h-3.5 mr-1.5" />Discover spots
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        )}

        {/* ════════════════════ DISCOVER TAB ════════════════════ */}
        {activeTab === "discover" && (
          <div className="pb-10">

            {/* Featured recommendations */}
            {discoverCategory === "all" && !discoverSearch && featuredSpots.length > 0 && (
              <div className="pt-4 pb-2">
                <div className="flex items-center gap-2 px-4 mb-3">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <h2 className="font-bold text-sm">Featured Spots</h2>
                  <Badge variant="secondary" className="text-xs ml-auto">{featuredSpots.length} picks</Badge>
                </div>
                <div className="flex gap-3 px-4 overflow-x-auto no-scrollbar pb-1">
                  {featuredSpots.map(spot => (
                    <FeaturedSpotCard
                      key={spot.osmId ?? spot.id}
                      spot={spot}
                      isSaved={spot.osmId ? savedOsmIds.has(spot.osmId) : false}
                      isAuthenticated={isAuthenticated}
                      onSave={() => {
                        if (!spot.osmId) return;
                        if (savedOsmIds.has(spot.osmId)) {
                          unsaveMutation.mutate(spot.osmId);
                        } else {
                          saveMutation.mutate({ osmId: spot.osmId, name: spot.name, category: spot.category, lat: spot.lat, lon: spot.lon });
                        }
                      }}
                      onView={() => setSelectedSpot(spot)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Stats bar */}
            <div className="px-4 py-3 flex items-center gap-2 text-xs text-muted-foreground border-b border-border">
              <TrendingUp className="w-3.5 h-3.5 shrink-0" />
              <span>
                {filteredDiscoverSpots.length.toLocaleString()} spot{filteredDiscoverSpots.length !== 1 ? "s" : ""}
                {discoverCategory !== "all" ? ` in ${DISCOVER_FILTERS.find(f => f.key === discoverCategory)?.label}` : " available"}
              </span>
              {discoverSearch && <span className="ml-auto font-medium text-primary">Searching "{discoverSearch}"</span>}
            </div>

            {/* Spot grid */}
            {isLoadingSpotlights ? (
              <div className="grid grid-cols-2 gap-3 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-40 rounded-xl" />
                ))}
              </div>
            ) : filteredDiscoverSpots.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground px-6">
                <Sparkles className="w-10 h-10 mb-3 opacity-30" />
                <p className="font-medium text-center">No spots found</p>
                <p className="text-sm mt-1 text-center">Try a different category or search term</p>
                <Button size="sm" variant="outline" className="mt-4" onClick={() => { setDiscoverCategory("all"); setDiscoverSearch(""); }}>
                  Clear filters
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 p-4">
                  {paginatedSpots.map(spot => (
                    <DiscoverSpotCard
                      key={spot.osmId ?? spot.id}
                      spot={spot}
                      isSaved={spot.osmId ? savedOsmIds.has(spot.osmId) : false}
                      isAuthenticated={isAuthenticated}
                      onSave={() => {
                        if (!spot.osmId) return;
                        if (savedOsmIds.has(spot.osmId)) {
                          unsaveMutation.mutate(spot.osmId);
                        } else {
                          saveMutation.mutate({ osmId: spot.osmId, name: spot.name, category: spot.category, lat: spot.lat, lon: spot.lon });
                        }
                      }}
                      onView={() => setSelectedSpot(spot)}
                    />
                  ))}
                </div>
                {paginatedSpots.length < filteredDiscoverSpots.length && (
                  <div className="flex justify-center px-4 pb-4">
                    <Button variant="outline" onClick={() => setDiscoverPage(p => p + 1)} data-testid="button-load-more">
                      Load more ({filteredDiscoverSpots.length - paginatedSpots.length} remaining)
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Schedule booking modal ── */}
      {selectedEvent && (
        <ClassBookingModal
          event={selectedEvent}
          myReg={myRegMap.get(`${selectedEvent.id}:${selectedEvent.occurrenceDate}`)}
          onClose={() => setSelectedEvent(null)}
          onBook={() => registerMutation.mutate(selectedEvent)}
          onCancel={() => cancelMutation.mutate(selectedEvent)}
          isPending={isPending}
        />
      )}

      {/* ── Spot detail modal ── */}
      {selectedSpot && (
        <SpotDetailModal
          spot={selectedSpot}
          isSaved={selectedSpot.osmId ? savedOsmIds.has(selectedSpot.osmId) : false}
          isAuthenticated={isAuthenticated}
          onClose={() => setSelectedSpot(null)}
          onSave={() => {
            if (!selectedSpot.osmId) return;
            if (savedOsmIds.has(selectedSpot.osmId)) {
              unsaveMutation.mutate(selectedSpot.osmId);
            } else {
              saveMutation.mutate({ osmId: selectedSpot.osmId, name: selectedSpot.name, category: selectedSpot.category, lat: selectedSpot.lat, lon: selectedSpot.lon });
            }
          }}
          onNavigate={() => {
            setLocation(`/map?lat=${selectedSpot.lat}&lng=${selectedSpot.lon}&osmId=${selectedSpot.osmId ?? ""}`);
          }}
        />
      )}
    </div>
  );
}

// ── Featured spot card (horizontal scroll) ────────────────────────────────────

function FeaturedSpotCard({ spot, isSaved, isAuthenticated, onSave, onView }: {
  spot: SpotCard;
  isSaved: boolean;
  isAuthenticated: boolean;
  onSave: () => void;
  onView: () => void;
}) {
  const discoverCat = osmToDiscoverCategory(spot.category);
  const filterInfo = DISCOVER_FILTERS.find(f => f.key === discoverCat) || DISCOVER_FILTERS[0];

  return (
    <div
      className="shrink-0 w-44 rounded-2xl border border-border bg-card overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
      onClick={onView}
      data-testid={`card-featured-${spot.osmId ?? spot.id}`}
    >
      <div className="h-24 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-4xl relative">
        {filterInfo.emoji}
        {spot.isSpotlighted && (
          <div className="absolute top-2 right-2">
            <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
          </div>
        )}
      </div>
      <div className="p-2.5">
        <h4 className="font-semibold text-xs leading-tight line-clamp-2 mb-1" data-testid={`text-featured-name-${spot.osmId ?? spot.id}`}>{spot.name}</h4>
        <div className="flex items-center justify-between mt-1.5">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{filterInfo.emoji} {filterInfo.label}</Badge>
          {isAuthenticated && (
            <button
              className="p-1 rounded-full hover:bg-muted transition-colors"
              onClick={e => { e.stopPropagation(); onSave(); }}
              data-testid={`button-save-featured-${spot.osmId ?? spot.id}`}
            >
              {isSaved
                ? <BookmarkCheck className="w-3.5 h-3.5 text-primary fill-primary" />
                : <Bookmark className="w-3.5 h-3.5 text-muted-foreground" />
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Discover spot card (grid) ─────────────────────────────────────────────────

function DiscoverSpotCard({ spot, isSaved, isAuthenticated, onSave, onView }: {
  spot: SpotCard;
  isSaved: boolean;
  isAuthenticated: boolean;
  onSave: () => void;
  onView: () => void;
}) {
  const discoverCat = osmToDiscoverCategory(spot.category);
  const filterInfo = DISCOVER_FILTERS.find(f => f.key === discoverCat) || DISCOVER_FILTERS[0];

  return (
    <Card
      className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow border-border"
      onClick={onView}
      data-testid={`card-spot-${spot.osmId ?? spot.id}`}
    >
      <div className="h-20 bg-gradient-to-br from-muted to-muted/40 flex items-center justify-center text-3xl relative">
        {filterInfo.emoji}
        {spot.isSpotlighted && (
          <div className="absolute top-1.5 left-1.5">
            <Badge className="text-[9px] px-1 py-0 bg-yellow-400 text-yellow-900 border-0">⭐ Featured</Badge>
          </div>
        )}
        {isAuthenticated && (
          <button
            className="absolute top-1.5 right-1.5 p-1 rounded-full bg-background/80 hover:bg-background transition-colors"
            onClick={e => { e.stopPropagation(); onSave(); }}
            data-testid={`button-save-${spot.osmId ?? spot.id}`}
          >
            {isSaved
              ? <BookmarkCheck className="w-3.5 h-3.5 text-primary fill-primary" />
              : <Bookmark className="w-3.5 h-3.5 text-muted-foreground" />
            }
          </button>
        )}
      </div>
      <CardContent className="p-2.5">
        <h4 className="font-semibold text-xs leading-tight line-clamp-2 mb-1" data-testid={`text-spot-name-${spot.osmId ?? spot.id}`}>{spot.name}</h4>
        {spot.address && <p className="text-[10px] text-muted-foreground truncate mb-1">{spot.address}</p>}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">{filterInfo.emoji} {filterInfo.label}</span>
          <button
            className="text-[10px] text-primary font-semibold hover:underline"
            onClick={e => { e.stopPropagation(); onView(); }}
          >
            View →
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Spot detail modal ─────────────────────────────────────────────────────────

function SpotDetailModal({ spot, isSaved, isAuthenticated, onClose, onSave, onNavigate }: {
  spot: SpotCard;
  isSaved: boolean;
  isAuthenticated: boolean;
  onClose: () => void;
  onSave: () => void;
  onNavigate: () => void;
}) {
  const discoverCat = osmToDiscoverCategory(spot.category);
  const filterInfo = DISCOVER_FILTERS.find(f => f.key === discoverCat) || DISCOVER_FILTERS[0];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-auto" data-testid="modal-spot-detail">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-3xl shrink-0 border border-border">
              {filterInfo.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-bold leading-tight">{spot.name}</DialogTitle>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <Badge variant="secondary" className="text-xs">{filterInfo.emoji} {filterInfo.label}</Badge>
                {spot.isSpotlighted && <Badge className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border-yellow-300">⭐ Featured</Badge>}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {spot.address && (
            <div className="flex items-start gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{spot.address}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapIcon className="w-4 h-4 shrink-0" />
            <span>Lat {spot.lat.toFixed(4)}, Lon {spot.lon.toFixed(4)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="capitalize text-xs">{spot.category.replace(/_/g, " ")}</span>
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-2 pt-2">
          <Button onClick={onNavigate} className="w-full" data-testid="button-view-on-map">
            <MapIcon className="w-4 h-4 mr-2" />
            View on Map
          </Button>
          {isAuthenticated && (
            <Button
              variant={isSaved ? "secondary" : "outline"}
              onClick={onSave}
              className="w-full"
              data-testid="button-save-spot"
            >
              {isSaved
                ? <><BookmarkCheck className="w-4 h-4 mr-2 fill-current" />Saved to profile</>
                : <><Bookmark className="w-4 h-4 mr-2" />Save this spot</>
              }
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} className="w-full" data-testid="button-close-spot-modal">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Class booking modal ───────────────────────────────────────────────────────

function ClassBookingModal({ event, myReg, onClose, onBook, onCancel, isPending }: {
  event: PublicEvent;
  myReg?: any;
  onClose: () => void;
  onBook: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);
  const isFull = event.spotsLeft !== null && event.spotsLeft === 0 && !myReg;
  const canBook = !myReg && !isFull;
  const canCancel = myReg && myReg.status !== "cancelled" && myReg.status !== "paid";
  const colorCls = CATEGORY_COLORS[event.category] || CATEGORY_COLORS.other;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-auto" data-testid="modal-class-detail">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl border ${colorCls} shrink-0`}>
              {SCHEDULE_CATEGORY_EMOJI[event.category] || "📋"}
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-bold leading-tight">{event.title}</DialogTitle>
              {event.venueName && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 shrink-0" />{event.venueName}
                  {event.venueType && <span className="text-muted-foreground/60 ml-1">· {event.venueType}</span>}
                </p>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {myReg && (
            <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium ${
              myReg.status === "paid" ? "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
              : myReg.status === "pending_payment" ? "bg-yellow-50 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800"
              : "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
            }`}>
              {myReg.status === "paid" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : myReg.status === "pending_payment" ? <CreditCard className="w-4 h-4 shrink-0" /> : <Ticket className="w-4 h-4 shrink-0" />}
              {myReg.status === "paid" ? "You're booked — payment confirmed" : myReg.status === "pending_payment" ? "Spot held — payment pending" : "You have a reserved spot"}
            </div>
          )}

          {isFull && (
            <div className="flex items-center gap-2 p-3 rounded-xl text-sm bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
              <XCircle className="w-4 h-4 shrink-0" />Class fully booked
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-sm"><Calendar className="w-4 h-4 text-muted-foreground shrink-0" /><span>{format(start, "EEE d MMM", { locale: nl })}</span></div>
            <div className="flex items-center gap-2 text-sm"><Clock className="w-4 h-4 text-muted-foreground shrink-0" /><span>{format(start, "HH:mm")}–{format(end, "HH:mm")}</span></div>
            {durationMin > 0 && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Zap className="w-4 h-4 shrink-0" /><span>{durationMin >= 60 ? `${Math.floor(durationMin / 60)}h${durationMin % 60 ? " " + durationMin % 60 + "m" : ""}` : `${durationMin} min`}</span></div>}
            {event.capacity && (
              <div className="flex items-center gap-2 text-sm"><Users className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className={isFull ? "text-red-500 font-medium" : "text-foreground"}>{event.registrationCount}/{event.capacity}{isFull ? " — Full" : event.spotsLeft !== null ? ` (${event.spotsLeft} left)` : ""}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm font-semibold"><Euro className="w-4 h-4 text-primary shrink-0" />
              <span className={event.isFree ? "text-green-600 dark:text-green-400" : "text-foreground"}>{event.isFree ? "Free" : `€${parseFloat(event.ticketPrice!).toFixed(2)}`}</span>
            </div>
            {event.isRecurring && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Star className="w-4 h-4 shrink-0" /><span>Recurring {event.recurrenceType || "weekly"}</span></div>}
          </div>
          {event.description && <p className="text-sm text-muted-foreground leading-relaxed border-t pt-3">{event.description}</p>}
        </div>

        <DialogFooter className="flex flex-col gap-2 pt-2">
          {canBook && (
            <Button onClick={onBook} disabled={isPending} className="w-full" size="lg" data-testid="button-book-class">
              {isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Processing…</> : event.isFree ? <><Ticket className="w-4 h-4 mr-2" />Reserve my spot</> : <><CreditCard className="w-4 h-4 mr-2" />Pay & book — €{parseFloat(event.ticketPrice!).toFixed(2)}</>}
            </Button>
          )}
          {canCancel && (
            <Button onClick={onCancel} disabled={isPending} variant="outline" className="w-full text-red-600 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30" data-testid="button-cancel-booking">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}Cancel reservation
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} className="w-full" data-testid="button-close-modal">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
