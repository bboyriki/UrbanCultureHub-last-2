import { useState, lazy, Suspense } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  MapPin, ExternalLink, CalendarDays, ArrowLeft, Loader2, Clock,
  Phone, Sparkles, Shield, Star, ChevronRight, Users, Globe,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { format, isFuture } from "date-fns";

const ClaimSpotModal = lazy(() => import("@/components/community/ClaimSpotModal"));

const CATEGORY_CONFIG: Record<string, { emoji: string; label: string; gradient: string }> = {
  dance:        { emoji: "💃", label: "Dance",          gradient: "from-pink-500 to-rose-500" },
  music:        { emoji: "🎵", label: "Music",          gradient: "from-indigo-500 to-purple-500" },
  nightlife:    { emoji: "🌙", label: "Nightlife",      gradient: "from-violet-600 to-indigo-700" },
  skate:        { emoji: "🛹", label: "Skate",          gradient: "from-green-500 to-emerald-500" },
  sport:        { emoji: "🏋️", label: "Sport",         gradient: "from-orange-500 to-amber-500" },
  fitness:      { emoji: "💪", label: "Fitness",        gradient: "from-blue-500 to-cyan-500" },
  training:     { emoji: "💪", label: "Training",       gradient: "from-orange-500 to-amber-500" },
  cafe:         { emoji: "☕", label: "Café",           gradient: "from-amber-600 to-yellow-500" },
  food:         { emoji: "🍽️", label: "Food",          gradient: "from-orange-500 to-red-400" },
  restaurant:   { emoji: "🍽️", label: "Restaurant",    gradient: "from-orange-500 to-red-400" },
  comedy:       { emoji: "😄", label: "Comedy",         gradient: "from-yellow-400 to-amber-500" },
  art:          { emoji: "🎨", label: "Art",            gradient: "from-purple-500 to-pink-500" },
  graffiti:     { emoji: "🎨", label: "Graffiti",       gradient: "from-purple-500 to-pink-500" },
  community:    { emoji: "🤝", label: "Community",      gradient: "from-teal-500 to-cyan-500" },
  museum:       { emoji: "🏛️", label: "Museum",        gradient: "from-amber-500 to-yellow-600" },
  parkour:      { emoji: "🤸", label: "Parkour",        gradient: "from-yellow-500 to-amber-500" },
  bmx:          { emoji: "🚲", label: "BMX",            gradient: "from-sky-500 to-blue-500" },
  basketball:   { emoji: "🏀", label: "Basketball",     gradient: "from-orange-500 to-red-500" },
  padel:        { emoji: "🎾", label: "Padel",          gradient: "from-lime-500 to-green-500" },
  bouldering:   { emoji: "🧗", label: "Bouldering",     gradient: "from-violet-500 to-purple-600" },
  table_tennis: { emoji: "🏓", label: "Table Tennis",   gradient: "from-green-600 to-teal-500" },
  wellness:     { emoji: "🧖", label: "Wellness",       gradient: "from-pink-400 to-rose-400" },
  rap:          { emoji: "🎤", label: "Rap",            gradient: "from-rose-500 to-red-500" },
  beatbox:      { emoji: "🎤", label: "Beatbox",        gradient: "from-red-500 to-orange-500" },
  open_mic:     { emoji: "🎙️", label: "Open Mic",      gradient: "from-fuchsia-500 to-pink-500" },
  workshop:     { emoji: "🔧", label: "Workshop",       gradient: "from-blue-600 to-indigo-600" },
  culture:      { emoji: "🏙️", label: "Culture",       gradient: "from-sky-500 to-indigo-500" },
};

const SPORT_EMOJI: Record<string, string> = {
  soccer: "⚽", football: "⚽", basketball: "🏀", tennis: "🎾",
  swimming: "🏊", volleyball: "🏐", cycling: "🚴", skateboard: "🛹",
  parkour: "🤸", bmx: "🚲", climbing: "🧗", yoga: "🧘",
  fitness: "💪", gymnastics: "🤸", martial_arts: "🥋", dance: "💃",
  running: "🏃", athletics: "🏃",
};

const LEISURE_EMOJI: Record<string, string> = {
  sports_centre: "🏋️", stadium: "🏟️", pitch: "⚽", skate_park: "🛹",
  playground: "🛝", park: "🌳", swimming_pool: "🏊", fitness_centre: "💪",
  dance_studio: "💃", climbing: "🧗", bowling_alley: "🎳",
};

function getSpotEmoji(spot: any): string {
  if (spot.sport && SPORT_EMOJI[spot.sport]) return SPORT_EMOJI[spot.sport];
  if (spot.leisure && LEISURE_EMOJI[spot.leisure]) return LEISURE_EMOJI[spot.leisure];
  return "📍";
}

function getSpotGradient(spot: any): string {
  const cfg = CATEGORY_CONFIG[spot.category || "culture"];
  if (cfg) return cfg.gradient;
  if (spot.sport) return "from-orange-500 to-amber-500";
  if (spot.leisure === "skate_park") return "from-green-500 to-emerald-500";
  return "from-sky-500 to-indigo-500";
}

const DAYS: Record<string, string> = { Mo: "Mon", Tu: "Tue", We: "Wed", Th: "Thu", Fr: "Fri", Sa: "Sat", Su: "Sun" };

function formatDays(days: string[]): string {
  if (!days || days.length === 0) return "";
  if (days.length === 7) return "Every day";
  const labels = days.map(d => DAYS[d] || d);
  if (days.length >= 5) {
    const weekdays = ["Mo","Tu","We","Th","Fr"];
    const weekend = ["Sa","Su"];
    if (weekdays.every(d => days.includes(d)) && !days.includes("Sa") && !days.includes("Su")) return "Weekdays";
    if (weekend.every(d => days.includes(d)) && days.length === 2) return "Weekends";
  }
  return labels.join(", ");
}

function ScheduleCard({ schedule }: { schedule: any }) {
  const isRecurring = schedule.scheduleType === "recurring";
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/30 last:border-0">
      <div className="mt-0.5 h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
        <CalendarDays className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{schedule.title}</p>
        {schedule.activityType && (
          <p className="text-xs text-muted-foreground capitalize">{schedule.activityType.replace(/_/g, " ")}</p>
        )}
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {isRecurring && schedule.recurringDays?.length > 0 && (
            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
              {formatDays(schedule.recurringDays)}
            </span>
          )}
          {!isRecurring && schedule.eventDate && (
            <span className="text-xs text-violet-700 dark:text-violet-400 font-medium">
              {format(new Date(schedule.eventDate), "EEEE, d MMM yyyy")}
            </span>
          )}
          {schedule.startTime && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <Clock className="h-3 w-3" />
              {schedule.startTime}{schedule.endTime ? ` – ${schedule.endTime}` : ""}
            </span>
          )}
        </div>
        {schedule.notes && (
          <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">{schedule.notes}</p>
        )}
      </div>
      <Badge variant="outline" className={`text-[10px] shrink-0 ${isRecurring ? "border-emerald-300 text-emerald-700 dark:text-emerald-400" : "border-violet-300 text-violet-700 dark:text-violet-400"}`}>
        {isRecurring ? "Weekly" : "Event"}
      </Badge>
    </div>
  );
}

function SessionCard({ session }: { session: any }) {
  const start = new Date(session.startTime);
  const end = session.endTime ? new Date(session.endTime) : null;
  const isPast = start < new Date();
  return (
    <Link to={`/programme/${session.id}`}>
      <div className={`rounded-xl border p-3.5 cursor-pointer transition-all hover:border-primary/50 hover:shadow-sm ${isPast ? "opacity-60 bg-muted/30" : "bg-card"}`}>
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-sm text-foreground truncate">{session.title}</p>
          {isPast && <Badge variant="secondary" className="text-[10px] shrink-0">Past</Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />{format(start, "EEE d MMM, HH:mm")}
            {end && ` – ${format(end, "HH:mm")}`}
          </span>
          {session.price != null && (
            <span className="font-medium text-emerald-600">{Number(session.price) === 0 ? "Free" : `€${session.price}`}</span>
          )}
          {session.category && <Badge variant="outline" className="text-[10px] h-4 px-1.5">{session.category}</Badge>}
        </div>
      </div>
    </Link>
  );
}

export default function CitySpotDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const spotRef = `osm-${id}`;

  const [showClaim, setShowClaim] = useState(false);
  const [aiDesc, setAiDesc] = useState<string | null>(null);

  const { data: spot, isLoading } = useQuery<any>({
    queryKey: ["/api/city-spots/by-id", id],
    queryFn: async () => {
      const res = await fetch(`/api/city-spots/by-id/${id}`);
      if (!res.ok) throw new Error("Spot not found");
      return res.json();
    },
    enabled: !!id,
  });

  const { data: spotlight } = useQuery<any>({
    queryKey: ["/api/city-spots", id, "spotlight"],
    queryFn: async () => {
      const res = await fetch(`/api/city-spots/${id}/spotlight`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!id,
  });

  const { data: ownership } = useQuery<any>({
    queryKey: ["/api/spot-ownerships/spot", spotRef],
    queryFn: async () => {
      const res = await fetch(`/api/spot-ownerships/spot/${encodeURIComponent(spotRef)}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!id,
  });

  const { data: schedules = [] } = useQuery<any[]>({
    queryKey: ["/api/spot-schedules", spotRef],
    queryFn: async () => {
      const res = await fetch(`/api/spot-schedules/${encodeURIComponent(spotRef)}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id,
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<any[]>({
    queryKey: ["/api/city-spots", id, "sessions"],
    queryFn: async () => {
      const res = await fetch(`/api/city-spots/${id}/sessions`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id,
  });

  const enrichMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/spots/enrich", "POST", {
        name: spot?.name,
        category: spot?.category,
        address: spot?.address,
        opening_hours: spot?.opening_hours,
        website: spot?.website,
        sport: spot?.sport,
        leisure: spot?.leisure,
        amenity: spot?.amenity,
      });
      return res.json();
    },
    onSuccess: (data) => setAiDesc(data.description || null),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!spot) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        <span className="text-4xl">📍</span>
        <p className="text-muted-foreground text-center">Spot not found</p>
        <Button asChild variant="outline"><Link to="/community">Back to Spots</Link></Button>
      </div>
    );
  }

  const emoji = getSpotEmoji(spot);
  const gradient = getSpotGradient(spot);
  const isFeatured = !!spotlight;
  const hasOwner = !!ownership;

  const now = new Date();
  const upcomingSessions = sessions.filter(s => new Date(s.startTime) >= now);
  const pastSessions = sessions.filter(s => new Date(s.startTime) < now);

  const recurringSchedules = schedules.filter(s => s.scheduleType === "recurring");
  const eventSchedules = schedules.filter(s => s.scheduleType === "one_time" && s.eventDate && isFuture(new Date(s.eventDate)));

  const descriptionText = aiDesc || spotlight?.adminNote || null;

  return (
    <div className="max-w-2xl mx-auto pb-24">
      {/* Hero */}
      <div className={`relative h-56 w-full bg-gradient-to-br ${gradient} flex items-center justify-center overflow-hidden`}>
        <span className="text-[96px] opacity-90 drop-shadow-2xl select-none">{emoji}</span>
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        <div className="absolute top-4 left-4">
          <Button variant="ghost" size="sm"
            className="h-8 px-3 bg-black/30 hover:bg-black/50 text-white rounded-full gap-1.5 backdrop-blur-sm"
            onClick={() => history.back()}
            data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />Back
          </Button>
        </div>

        <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5">
          {isFeatured && (
            <Badge className="bg-amber-500/90 text-white border-0 shadow text-[10px]">
              <Star className="h-2.5 w-2.5 mr-1 fill-white" />Featured
            </Badge>
          )}
          <Badge className="bg-sky-500/90 text-white border-0 shadow text-[10px]">🏙️ City Spot</Badge>
        </div>

        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          <h1 className="text-xl font-bold text-white drop-shadow-lg leading-tight" data-testid="text-spot-name">
            {spot.name}
          </h1>
          {(spot.sport || spot.leisure) && (
            <p className="text-white/70 text-xs mt-0.5 capitalize">
              {[spot.sport, spot.leisure].filter(Boolean).join(" · ").replace(/_/g, " ")}
            </p>
          )}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Owner card */}
        {hasOwner && ownership?.ownerName && (
          <Card className="border-violet-200 dark:border-violet-800/50 bg-violet-50/50 dark:bg-violet-950/20">
            <CardContent className="px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-violet-200 dark:bg-violet-800 flex items-center justify-center shrink-0 overflow-hidden">
                  {ownership?.ownerAvatar
                    ? <img src={ownership.ownerAvatar} alt="" className="h-full w-full object-cover" />
                    : <Shield className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Managed by</p>
                  <p className="text-sm font-semibold text-violet-700 dark:text-violet-400 truncate">{ownership.ownerName}</p>
                </div>
                <Badge variant="outline" className="border-violet-300 text-violet-700 dark:text-violet-400 text-[10px] shrink-0">
                  <Shield className="h-3 w-3 mr-1" />Owner
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick info */}
        <div className="space-y-2.5">
          {spot.address && (
            <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary/60" />
              <span>{spot.address}</span>
            </div>
          )}
          {spot.opening_hours && (
            <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 mt-0.5 shrink-0 text-primary/60" />
              <span className="whitespace-pre-line">{spot.opening_hours}</span>
            </div>
          )}
          {spot.phone && (
            <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <Phone className="h-4 w-4 mt-0.5 shrink-0 text-primary/60" />
              <a href={`tel:${spot.phone}`} className="hover:text-primary transition-colors">{spot.phone}</a>
            </div>
          )}
          {spot.website && (
            <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <Globe className="h-4 w-4 mt-0.5 shrink-0 text-primary/60" />
              <a href={spot.website} target="_blank" rel="noopener noreferrer"
                className="hover:text-primary transition-colors truncate">
                {spot.website.replace(/^https?:\/\/(www\.)?/, "")}
              </a>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {spot.website && (
            <Button asChild variant="outline" size="sm" className="gap-1.5 rounded-full h-8 text-xs">
              <a href={spot.website} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />Website
              </a>
            </Button>
          )}
          <Button asChild variant="outline" size="sm" className="gap-1.5 rounded-full h-8 text-xs">
            <Link to={`/map?lat=${spot.lat}&lng=${spot.lon}`}>
              <MapPin className="h-3.5 w-3.5" />View on Map
            </Link>
          </Button>
          {spotlight?.linkedLocationId && (
            <Button asChild size="sm" className="gap-1.5 rounded-full h-8 text-xs">
              <Link to={`/locations/${spotlight.linkedLocationId}`}>
                <CalendarDays className="h-3.5 w-3.5" />Book Session
              </Link>
            </Button>
          )}
          {user && !hasOwner && !isAdmin && (
            <Button variant="outline" size="sm"
              className="gap-1.5 rounded-full h-8 text-xs border-violet-300 text-violet-700 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20"
              onClick={() => setShowClaim(true)}
              data-testid="button-claim-spot">
              <Shield className="h-3.5 w-3.5" />Claim Spot
            </Button>
          )}
        </div>

        {/* Description */}
        <div>
          {descriptionText ? (
            <div className="rounded-xl bg-muted/40 px-4 py-3">
              <p className="text-sm text-muted-foreground leading-relaxed">{descriptionText}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/60 px-4 py-4 flex flex-col items-center gap-2 text-center">
              <Sparkles className="h-5 w-5 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground/60">No description yet for this spot</p>
              <Button variant="outline" size="sm"
                className="gap-1.5 rounded-full h-7 text-xs text-violet-700 dark:text-violet-400 border-violet-300"
                onClick={() => enrichMutation.mutate()}
                disabled={enrichMutation.isPending}
                data-testid="button-ai-describe">
                {enrichMutation.isPending
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <Sparkles className="h-3 w-3" />}
                Generate AI description
              </Button>
            </div>
          )}
        </div>

        {/* Schedules section */}
        {schedules.length > 0 && (
          <div>
            <h2 className="font-semibold text-foreground flex items-center gap-2 mb-2 text-sm">
              <CalendarDays className="h-4 w-4 text-emerald-600" />
              Community Schedule
              <Badge variant="secondary" className="text-xs ml-1">{schedules.length}</Badge>
            </h2>
            <Card>
              <CardContent className="px-4 py-1 divide-y divide-border/30">
                {recurringSchedules.map(s => <ScheduleCard key={s.id} schedule={s} />)}
                {eventSchedules.map(s => <ScheduleCard key={s.id} schedule={s} />)}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Sessions section */}
        <div>
          <h2 className="font-semibold text-foreground flex items-center gap-2 mb-2 text-sm"
            data-testid="text-schedule-heading">
            <Users className="h-4 w-4 text-primary" />
            Sessions
            {sessions.length > 0 && (
              <Badge variant="secondary" className="text-xs ml-1">{upcomingSessions.length} upcoming</Badge>
            )}
          </h2>

          {sessionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 rounded-xl border border-dashed border-border/60 bg-muted/20 gap-2.5 text-center px-4">
              <CalendarDays className="h-7 w-7 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No sessions scheduled yet</p>
              <p className="text-xs text-muted-foreground/50 max-w-xs">
                {isAdmin
                  ? "Link this venue to a location in Admin → Spot Assignments to add sessions."
                  : "Check back later for upcoming sessions!"}
              </p>
              {isAdmin && (
                <Button asChild variant="outline" size="sm" className="rounded-full text-xs gap-1.5 mt-1 h-7">
                  <Link to="/admin/spot-assignments">
                    <ChevronRight className="h-3 w-3" />Spot Assignments
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingSessions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Upcoming</p>
                  {upcomingSessions.map(s => <SessionCard key={s.id} session={s} />)}
                </div>
              )}
              {pastSessions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Past</p>
                  {pastSessions.slice(0, 3).map(s => <SessionCard key={s.id} session={s} />)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Claim modal */}
      {showClaim && spot && (
        <Suspense fallback={null}>
          <ClaimSpotModal
            open={showClaim}
            spotRef={spotRef}
            spotName={spot.name}
            onClose={() => setShowClaim(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
