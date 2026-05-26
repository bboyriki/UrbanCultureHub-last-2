import { useState, lazy, Suspense } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MapPin, ExternalLink, CalendarDays, ArrowLeft, CalendarPlus,
  Clock, Loader2, Plus, CheckCircle, Trash2, X, Calendar,
  Shield, Sparkles,
} from "lucide-react";
import { format, isFuture } from "date-fns";

const ClaimSpotModal = lazy(() => import("@/components/community/ClaimSpotModal"));

const CATEGORY_CONFIG: Record<string, { emoji: string; label: string; gradient: string }> = {
  dance:        { emoji: "💃", label: "Dance",         gradient: "from-pink-500 to-rose-500" },
  music:        { emoji: "🎵", label: "Music",         gradient: "from-indigo-500 to-purple-500" },
  nightlife:    { emoji: "🌙", label: "Nightlife",     gradient: "from-violet-600 to-indigo-700" },
  skate:        { emoji: "🛹", label: "Skate",         gradient: "from-green-500 to-emerald-500" },
  sport:        { emoji: "🏋️", label: "Sport",        gradient: "from-orange-500 to-amber-500" },
  fitness:      { emoji: "💪", label: "Fitness",       gradient: "from-blue-500 to-cyan-500" },
  training:     { emoji: "💪", label: "Training",      gradient: "from-orange-500 to-amber-500" },
  cafe:         { emoji: "☕", label: "Café",          gradient: "from-amber-600 to-yellow-500" },
  food:         { emoji: "🍽️", label: "Food",         gradient: "from-orange-500 to-red-400" },
  restaurant:   { emoji: "🍽️", label: "Restaurant",   gradient: "from-orange-500 to-red-400" },
  comedy:       { emoji: "😄", label: "Comedy",        gradient: "from-yellow-400 to-amber-500" },
  art:          { emoji: "🎨", label: "Art",           gradient: "from-purple-500 to-pink-500" },
  graffiti:     { emoji: "🎨", label: "Graffiti",      gradient: "from-purple-500 to-pink-500" },
  community:    { emoji: "🤝", label: "Community",     gradient: "from-teal-500 to-cyan-500" },
  museum:       { emoji: "🏛️", label: "Museum",       gradient: "from-amber-500 to-yellow-600" },
  parkour:      { emoji: "🤸", label: "Parkour",       gradient: "from-yellow-500 to-amber-500" },
  bmx:          { emoji: "🚲", label: "BMX",           gradient: "from-sky-500 to-blue-500" },
  basketball:   { emoji: "🏀", label: "Basketball",    gradient: "from-orange-500 to-red-500" },
  padel:        { emoji: "🎾", label: "Padel",         gradient: "from-lime-500 to-green-500" },
  bouldering:   { emoji: "🧗", label: "Bouldering",    gradient: "from-violet-500 to-purple-600" },
  table_tennis: { emoji: "🏓", label: "Table Tennis",  gradient: "from-green-600 to-teal-500" },
  wellness:     { emoji: "🧖", label: "Wellness",      gradient: "from-pink-400 to-rose-400" },
  rap:          { emoji: "🎤", label: "Rap",           gradient: "from-rose-500 to-red-500" },
  beatbox:      { emoji: "🎤", label: "Beatbox",       gradient: "from-red-500 to-orange-500" },
  open_mic:     { emoji: "🎙️", label: "Open Mic",     gradient: "from-fuchsia-500 to-pink-500" },
  workshop:     { emoji: "🔧", label: "Workshop",      gradient: "from-blue-600 to-indigo-600" },
};

const SESSION_CATEGORIES = [
  { value: "fitness_class", label: "🏋️ Fitness Class" },
  { value: "yoga", label: "🧘 Yoga" },
  { value: "dance_class", label: "💃 Dance Class" },
  { value: "dance_battle", label: "🕺 Dance Battle" },
  { value: "open_floor", label: "🪩 Open Floor" },
  { value: "open_training", label: "🏃 Open Training" },
  { value: "group_session", label: "👥 Group Session" },
  { value: "sports_training", label: "⚽ Sports Training" },
  { value: "skate_session", label: "🛹 Skate Session" },
  { value: "parkour", label: "🤸 Parkour" },
  { value: "bmx", label: "🚲 BMX" },
  { value: "basketball", label: "🏀 Basketball" },
  { value: "music_session", label: "🎵 Music Session" },
  { value: "rap_session", label: "🎤 Rap Session" },
  { value: "graffiti_jam", label: "🎨 Graffiti Jam" },
  { value: "workshop", label: "🔧 Workshop" },
  { value: "community_event", label: "🤝 Community Event" },
  { value: "other", label: "📅 Other" },
];

const SESSION_EMOJIS: Record<string, string> = {
  fitness_class: "🏋️", yoga: "🧘", dance_class: "💃", dance_battle: "🕺",
  open_floor: "🪩", open_training: "🏃", group_session: "👥", sports_training: "⚽",
  skate_session: "🛹", parkour: "🤸", bmx: "🚲", basketball: "🏀",
  music_session: "🎵", rap_session: "🎤", graffiti_jam: "🎨",
  workshop: "🔧", community_event: "🤝", other: "📅",
};

// ─── Inline schedule section ────────────────────────────────────────────────
function ScheduleSection({
  locationId,
  isAdmin,
  user,
}: {
  locationId: number;
  isAdmin: boolean;
  user: any;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [reservingId, setReservingId] = useState<number | null>(null);

  const [form, setForm] = useState({
    title: "", category: "other", description: "",
    startTime: "10:00", endTime: "11:00",
    capacity: "", ticketPrice: "",
  });

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<any[]>({
    queryKey: [`/api/spots/${locationId}/sessions`],
    enabled: !!locationId,
  });

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const sessionsForDate = sessions
    .filter((s) => format(new Date(s.startTime), "yyyy-MM-dd") === dateStr)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const isToday = dateStr === format(today, "yyyy-MM-dd");

  const createMutation = useMutation({
    mutationFn: async () => {
      const startTime = `${dateStr}T${form.startTime}:00`;
      const endTime = `${dateStr}T${form.endTime}:00`;
      const res = await apiRequest(`/api/spots/${locationId}/sessions`, "POST", {
        title: form.title,
        category: form.category,
        description: form.description || null,
        startTime,
        endTime,
        capacity: form.capacity ? parseInt(form.capacity) : null,
        ticketPrice: form.ticketPrice || null,
        isPublic: true,
        isRecurring: false,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spots/${locationId}/sessions`] });
      setShowForm(false);
      setForm((f) => ({ ...f, title: "", description: "", capacity: "", ticketPrice: "" }));
      toast({ title: "Session added!", description: "People can now reserve this session." });
    },
    onError: () => {
      toast({ title: "Failed to add session", variant: "destructive" });
    },
  });

  const deleteSession = async (sessionId: number) => {
    setDeletingId(sessionId);
    try {
      await apiRequest(`/api/spots/sessions/${sessionId}`, "DELETE");
      queryClient.invalidateQueries({ queryKey: [`/api/spots/${locationId}/sessions`] });
      toast({ title: "Session removed" });
    } catch {
      toast({ title: "Failed to remove session", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const reserveMutation = useMutation({
    mutationFn: async (sessionId: number) => {
      setReservingId(sessionId);
      const res = await apiRequest(`/api/programme/events/${sessionId}/register`, "POST", { occurrenceDate: null });
      return res.json();
    },
    onSuccess: () => {
      setReservingId(null);
      queryClient.invalidateQueries({ queryKey: [`/api/spots/${locationId}/sessions`] });
      toast({ title: "Reserved!", description: "Your spot is confirmed. Check your profile schedule." });
    },
    onError: () => {
      setReservingId(null);
      toast({ title: "Could not reserve", variant: "destructive" });
    },
  });

  return (
    <Card className="mt-4">
      <CardContent className="p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold flex items-center gap-2 text-sm sm:text-base">
            <Calendar className="h-4 w-4 text-primary" />
            {isAdmin ? "Manage Schedule" : "Schedule"}
          </h2>
          {isAdmin && !showForm && (
            <Button
              size="sm"
              onClick={() => setShowForm(true)}
              className="gap-1.5 h-8 text-xs"
              data-testid="button-add-session-toggle"
            >
              <Plus className="h-3.5 w-3.5" /> Add Session
            </Button>
          )}
        </div>

        {/* 14-day date strip */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
          {days.map((d) => {
            const ds = format(d, "yyyy-MM-dd");
            const isSel = ds === dateStr;
            const isTod = ds === format(today, "yyyy-MM-dd");
            const hasEvents = sessions.some((s) => format(new Date(s.startTime), "yyyy-MM-dd") === ds);
            return (
              <button
                key={d.toISOString()}
                type="button"
                onClick={() => { setSelectedDate(d); setShowForm(false); }}
                className={`flex flex-col items-center justify-center min-w-[48px] h-16 rounded-2xl border transition-all flex-shrink-0 relative ${
                  isSel
                    ? "bg-primary text-primary-foreground border-primary shadow-md"
                    : isTod
                    ? "border-primary/60 text-primary bg-primary/5"
                    : "bg-card text-muted-foreground hover:bg-muted/60 border-border"
                }`}
              >
                <span className={`text-[10px] font-medium ${isSel ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {format(d, "EEE")}
                </span>
                <span className="text-base font-bold leading-tight">{format(d, "d")}</span>
                <span className={`text-[9px] ${isSel ? "text-primary-foreground/60" : "text-muted-foreground/60"}`}>
                  {format(d, "MMM")}
                </span>
                {hasEvents && !isSel && (
                  <span className="absolute bottom-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>

        {/* Day label */}
        <div className="mt-4 mb-3 flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">{isToday ? "Today" : format(selectedDate, "EEEE, dd MMMM")}</p>
            {sessionsForDate.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {sessionsForDate.length} session{sessionsForDate.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>

        {/* Add session form */}
        {isAdmin && showForm && (
          <div className="mb-4 p-4 rounded-xl border border-primary/30 bg-primary/5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Add session — {format(selectedDate, "dd MMMM")}</p>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Title *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g., Morning Dance Class"
                  className="mt-1 h-9"
                  data-testid="input-session-title"
                />
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SESSION_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Start time *</Label>
                  <Input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                    className="mt-1 h-9"
                    data-testid="input-session-start"
                  />
                </div>
                <div>
                  <Label className="text-xs">End time</Label>
                  <Input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                    className="mt-1 h-9"
                    data-testid="input-session-end"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Capacity (optional)</Label>
                  <Input
                    type="number"
                    value={form.capacity}
                    onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                    placeholder="Unlimited"
                    className="mt-1 h-9"
                    data-testid="input-session-capacity"
                  />
                </div>
                <div>
                  <Label className="text-xs">Price € (optional)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.ticketPrice}
                    onChange={(e) => setForm((f) => ({ ...f, ticketPrice: e.target.value }))}
                    placeholder="Free"
                    className="mt-1 h-9"
                    data-testid="input-session-price"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Description (optional)</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Short description…"
                  className="mt-1 h-9"
                  data-testid="input-session-description"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => {
                    if (!form.title.trim()) {
                      toast({ title: "Please enter a title", variant: "destructive" });
                      return;
                    }
                    createMutation.mutate();
                  }}
                  disabled={createMutation.isPending}
                  data-testid="button-save-session"
                >
                  {createMutation.isPending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <CheckCircle className="h-3.5 w-3.5" />
                  }
                  Save Session
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        )}

        {/* Sessions for selected date */}
        {sessionsLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading sessions…
          </div>
        ) : sessionsForDate.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
            <Calendar className="h-10 w-10 text-muted-foreground opacity-20" />
            <p className="text-sm text-muted-foreground">
              {isToday ? "No sessions today" : `No sessions on ${format(selectedDate, "EEEE")}`}
            </p>
            {isAdmin && !showForm && (
              <Button size="sm" variant="outline" className="mt-1 gap-1.5 text-xs" onClick={() => setShowForm(true)}>
                <Plus className="h-3.5 w-3.5" /> Add a session
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {sessionsForDate.map((session) => (
              <div
                key={session.id}
                className="flex items-start gap-3 p-3 rounded-xl border bg-card hover:bg-muted/20 transition-colors"
                data-testid={`schedule-item-${session.id}`}
              >
                <div className="flex flex-col items-center justify-center min-w-[48px] h-14 bg-primary/10 rounded-xl p-1.5 flex-shrink-0">
                  <span className="text-xl leading-none">{SESSION_EMOJIS[session.category] || "📋"}</span>
                  <span className="text-[10px] font-bold text-primary mt-0.5">
                    {format(new Date(session.startTime), "HH:mm")}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{session.title}</p>
                  {session.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{session.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(session.startTime), "HH:mm")}
                      {session.endTime && ` – ${format(new Date(session.endTime), "HH:mm")}`}
                    </span>
                    {session.capacity && (
                      <span className="text-xs text-muted-foreground">
                        {session.registrationCount || 0}/{session.capacity} spots
                      </span>
                    )}
                    {session.ticketPrice && parseFloat(session.ticketPrice) > 0 ? (
                      <Badge variant="secondary" className="text-xs">€{session.ticketPrice}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-300">Free</Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  {!isAdmin && (
                    session.isFull ? (
                      <Badge variant="secondary" className="text-xs">Full</Badge>
                    ) : user ? (
                      <Button
                        size="sm"
                        className="h-8 text-xs px-3"
                        onClick={() => reserveMutation.mutate(session.id)}
                        disabled={reservingId === session.id}
                        data-testid={`button-reserve-session-${session.id}`}
                      >
                        {reservingId === session.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Reserve"}
                      </Button>
                    ) : (
                      <Link to="/auth">
                        <Button size="sm" variant="outline" className="h-8 text-xs px-3">Log in</Button>
                      </Link>
                    )
                  )}
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteSession(session.id)}
                      disabled={deletingId === session.id}
                      data-testid={`button-delete-session-${session.id}`}
                    >
                      {deletingId === session.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Trash2 className="h-3 w-3" />
                      }
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {sessions.filter((s) => isFuture(new Date(s.startTime))).length > 0 && (
          <p className="text-xs text-muted-foreground text-center mt-4 pt-3 border-t">
            {sessions.filter((s) => isFuture(new Date(s.startTime))).length} upcoming session{sessions.filter((s) => isFuture(new Date(s.startTime))).length !== 1 ? "s" : ""} total
          </p>
        )}
      </CardContent>
    </Card>
  );
}

const DAYS: Record<string, string> = { Mo: "Mon", Tu: "Tue", We: "Wed", Th: "Thu", Fr: "Fri", Sa: "Sat", Su: "Sun" };
function formatDays(days: string[]): string {
  if (!days || days.length === 0) return "";
  if (days.length === 7) return "Every day";
  const labels = days.map(d => DAYS[d] || d);
  return labels.join(", ");
}

// ─── Main SpotlightDetail ────────────────────────────────────────────────────
export default function SpotlightDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const spotRef = `city-${id}`;

  const [showClaim, setShowClaim] = useState(false);
  const [aiDesc, setAiDesc] = useState<string | null>(null);

  const { data: spotlight, isLoading } = useQuery<any>({
    queryKey: ["/api/spots/spotlight", id],
    queryFn: async () => {
      const res = await fetch(`/api/spots/spotlight/${id}`);
      if (!res.ok) throw new Error("Spot not found");
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

  const { data: spotSchedules = [] } = useQuery<any[]>({
    queryKey: ["/api/spot-schedules", spotRef],
    queryFn: async () => {
      const res = await fetch(`/api/spot-schedules/${encodeURIComponent(spotRef)}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id,
  });

  const enrichMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/spots/enrich", "POST", {
        name: spotlight?.name,
        category: spotlight?.category,
        address: spotlight?.address,
        spotType: "spotlight",
      });
      return res.json();
    },
    onSuccess: (data) => setAiDesc(data.description || null),
    onError: () => toast({ title: "Failed to generate description", variant: "destructive" }),
  });

  const createLinkMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(`/api/admin/spot-assignments/${id}/link`, "POST");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spots/spotlight", id] });
      toast({ title: "Schedule set up!", description: "You can now add sessions below." });
    },
    onError: () => {
      toast({ title: "Failed to create schedule", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!spotlight) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        <span className="text-4xl">📍</span>
        <p className="text-muted-foreground text-center">Spot not found</p>
        <Button asChild variant="outline">
          <Link to="/community">Back to Spots</Link>
        </Button>
      </div>
    );
  }

  const cfg = CATEGORY_CONFIG[spotlight.category] || {
    emoji: "📍", label: spotlight.category || "Spot", gradient: "from-gray-500 to-slate-500",
  };

  return (
    <div className="max-w-2xl mx-auto pb-20">
      {/* Hero */}
      <div className={`relative h-52 w-full bg-gradient-to-br ${cfg.gradient} flex items-center justify-center`}>
        <span className="text-8xl opacity-90 drop-shadow-lg">{cfg.emoji}</span>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute top-4 left-4">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3 bg-black/30 hover:bg-black/50 text-white rounded-full gap-1.5 backdrop-blur-sm"
            onClick={() => history.back()}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
        {spotlight.active && (
          <div className="absolute top-4 right-4">
            <Badge className="bg-amber-500/95 text-white border-0 shadow">⭐ Featured</Badge>
          </div>
        )}
      </div>

      {/* Info section */}
      <div className="px-4 pt-4 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground leading-tight" data-testid="text-spot-name">
            {spotlight.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <Badge variant="outline" className="text-xs font-medium">
              {cfg.emoji} {cfg.label}
            </Badge>
            {spotlight.active && (
              <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-300 text-xs">
                ⭐ Spotlighted
              </Badge>
            )}
          </div>
        </div>

        {/* Owner card */}
        {ownership?.ownerName && (
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

        {spotlight.address && (
          <div className="flex items-start gap-2 text-muted-foreground text-sm">
            <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary/60" />
            <span>{spotlight.address}</span>
          </div>
        )}

        {/* Description / adminNote */}
        {(aiDesc || spotlight.adminNote) ? (
          <div className="rounded-xl bg-muted/40 px-4 py-3">
            <p className="text-sm text-muted-foreground leading-relaxed">{aiDesc || spotlight.adminNote}</p>
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
              {enrichMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Generate AI description
            </Button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {spotlight.website && (
            <Button asChild variant="outline" size="sm" className="gap-1.5 rounded-full h-8 text-xs">
              <a href={spotlight.website} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Website
              </a>
            </Button>
          )}
          <Button asChild variant="outline" size="sm" className="gap-1.5 rounded-full h-8 text-xs">
            <Link to={`/map?lat=${spotlight.lat}&lng=${spotlight.lon}`}>
              <MapPin className="h-3.5 w-3.5" />
              View on Map
            </Link>
          </Button>
          {user && !ownership && !isAdmin && (
            <Button variant="outline" size="sm"
              className="gap-1.5 rounded-full h-8 text-xs border-violet-300 text-violet-700 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20"
              onClick={() => setShowClaim(true)}
              data-testid="button-claim-spot">
              <Shield className="h-3.5 w-3.5" />Claim Spot
            </Button>
          )}
        </div>

        {/* Community spot schedules */}
        {spotSchedules.length > 0 && (
          <div>
            <h2 className="font-semibold text-foreground flex items-center gap-2 mb-2 text-sm">
              <CalendarDays className="h-4 w-4 text-emerald-600" />
              Community Schedule
              <Badge variant="secondary" className="text-xs ml-1">{spotSchedules.length}</Badge>
            </h2>
            <Card>
              <CardContent className="px-4 py-1 divide-y divide-border/30">
                {spotSchedules.map((s: any) => (
                  <div key={s.id} className="flex items-start gap-3 py-3 border-b border-border/30 last:border-0">
                    <div className="mt-0.5 h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                      <CalendarDays className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{s.title}</p>
                      {s.activityType && <p className="text-xs text-muted-foreground capitalize">{s.activityType.replace(/_/g, " ")}</p>}
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {s.scheduleType === "recurring" && s.recurringDays?.length > 0 && (
                          <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">{formatDays(s.recurringDays)}</span>
                        )}
                        {s.scheduleType === "one_time" && s.eventDate && (
                          <span className="text-xs text-violet-700 dark:text-violet-400 font-medium">
                            {format(new Date(s.eventDate), "EEEE, d MMM yyyy")}
                          </span>
                        )}
                        {s.startTime && (
                          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                            <Clock className="h-3 w-3" />
                            {s.startTime}{s.endTime ? ` – ${s.endTime}` : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${s.scheduleType === "recurring" ? "border-emerald-300 text-emerald-700 dark:text-emerald-400" : "border-violet-300 text-violet-700 dark:text-violet-400"}`}>
                      {s.scheduleType === "recurring" ? "Weekly" : "Event"}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Schedule section */}
        {spotlight.linkedLocationId ? (
          <ScheduleSection
            locationId={spotlight.linkedLocationId}
            isAdmin={isAdmin}
            user={user}
          />
        ) : (
          <div className="pt-2">
            <h2 className="font-semibold text-foreground flex items-center gap-2 mb-3 text-sm sm:text-base">
              <CalendarDays className="h-4 w-4 text-primary" />
              Schedule
            </h2>
            <div className="flex flex-col items-center justify-center py-10 rounded-xl border border-dashed border-border/60 bg-muted/30 gap-3">
              <CalendarDays className="h-8 w-8 text-muted-foreground/40" />
              <div className="text-center px-4">
                <p className="text-sm font-medium text-muted-foreground">No sessions scheduled yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
                  {isAdmin
                    ? "Set up a schedule for this spot to start adding sessions."
                    : "Check back later for upcoming sessions at this spot."}
                </p>
              </div>
              {isAdmin && (
                <Button
                  size="sm"
                  className="gap-1.5 rounded-full text-xs mt-1"
                  onClick={() => createLinkMutation.mutate()}
                  disabled={createLinkMutation.isPending}
                  data-testid="button-create-schedule"
                >
                  {createLinkMutation.isPending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <CalendarPlus className="h-3.5 w-3.5" />
                  }
                  Set Up Schedule
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {showClaim && spotlight && (
        <Suspense fallback={null}>
          <ClaimSpotModal
            open={showClaim}
            spotRef={spotRef}
            spotName={spotlight.name}
            onClose={() => setShowClaim(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
