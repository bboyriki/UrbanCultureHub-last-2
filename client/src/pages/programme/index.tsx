import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { PROGRAMME_CATEGORY_LABELS } from "@shared/schema";
import {
  Plus, Calendar, ChevronLeft, ChevronRight, Clock, Users, Euro,
  RotateCcw, Edit2, Trash2, Lock, Globe, RefreshCw, ArrowLeft,
  Repeat, CheckCircle2, CreditCard, Ticket, UserCheck, BarChart3, Activity, Award,
} from "lucide-react";
import type { ProgrammeItem, ProgrammeAccess } from "@shared/schema";

const CATEGORY_COLORS: Record<string, string> = {
  fitness_class:     "bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-400/30",
  yoga:              "bg-green-500/20 text-green-700 dark:text-green-300 border-green-400/30",
  pilates:           "bg-pink-500/20 text-pink-700 dark:text-pink-300 border-pink-400/30",
  boxing:            "bg-red-500/20 text-red-700 dark:text-red-300 border-red-400/30",
  martial_arts:      "bg-red-500/20 text-red-700 dark:text-red-300 border-red-400/30",
  crossfit:          "bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-400/30",
  spinning:          "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-400/30",
  dance_class:       "bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-400/30",
  dance_battle:      "bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-400/30",
  open_floor:        "bg-violet-500/20 text-violet-700 dark:text-violet-300 border-violet-400/30",
  open_training:     "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-400/30",
  personal_training: "bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-400/30",
  group_session:     "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-400/30",
  sports_training:   "bg-green-500/20 text-green-700 dark:text-green-300 border-green-400/30",
  workshop:          "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-400/30",
  dj_night:          "bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-400/30",
  live_music:        "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-400/30",
  exhibition:        "bg-teal-500/20 text-teal-700 dark:text-teal-300 border-teal-400/30",
  open_mic:          "bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-400/30",
  event:             "bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-400/30",
  private_event:     "bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-400/30",
  other:             "bg-muted text-muted-foreground border-border",
};

const CATEGORY_EMOJIS: Record<string, string> = {
  fitness_class: "🏋️", yoga: "🧘", pilates: "🤸", boxing: "🥊",
  martial_arts: "🥋", crossfit: "💪", spinning: "🚴",
  dance_class: "💃", dance_battle: "🕺", open_floor: "🪩",
  open_training: "🏃", personal_training: "👤", group_session: "👥",
  sports_training: "⚽", workshop: "🔨", dj_night: "🎛️",
  live_music: "🎵", exhibition: "🖼️", open_mic: "🎤",
  event: "📅", private_event: "🔒", other: "📋",
};

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function formatTime(dt: Date | string) {
  const d = new Date(dt);
  return d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dt: Date | string) {
  const d = new Date(dt);
  return d.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function getWeekDays(baseDate: Date): Date[] {
  const d = new Date(baseDate);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return dd;
  });
}

function getMonthDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (firstDay + 6) % 7;
  const cells: (Date | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

interface ItemFormData {
  title: string;
  description: string;
  category: string;
  startDate: string;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  recurrenceType: string;
  recurrenceEnd: string;
  isPublic: boolean;
  capacity: string;
  ticketPrice: string;
  locationId: string;
  spotName: string;
}

const DEFAULT_FORM: ItemFormData = {
  title: "",
  description: "",
  category: "other",
  startDate: new Date().toISOString().slice(0, 10),
  startTime: "20:00",
  endTime: "23:00",
  isRecurring: false,
  recurrenceType: "weekly",
  recurrenceEnd: "",
  isPublic: true,
  capacity: "",
  ticketPrice: "",
  locationId: "",
  spotName: "",
};

export default function ProgrammePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ProgrammeItem | null>(null);
  const [form, setForm] = useState<ItemFormData>(DEFAULT_FORM);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [attendeesItemId, setAttendeesItemId] = useState<number | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const { data: access, isLoading: accessLoading } = useQuery<ProgrammeAccess | null>({
    queryKey: ["/api/programme/access"],
  });

  const { data: attendees = [], isLoading: attendeesLoading } = useQuery<any[]>({
    queryKey: ["/api/programme/items", attendeesItemId, "attendees"],
    queryFn: async () => {
      if (!attendeesItemId) return [];
      const res = await fetch(`/api/programme/items/${attendeesItemId}/attendees`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load attendees");
      return res.json();
    },
    enabled: !!attendeesItemId,
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery<ProgrammeItem[]>({
    queryKey: ["/api/programme/items"],
    enabled: !!access?.isEnabled,
  });

  const { data: ownerAnalytics, isLoading: analyticsLoading } = useQuery<any>({
    queryKey: ["/api/programme/owner/analytics"],
    enabled: showAnalytics && !!access?.isEnabled,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/programme/items", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/programme/items"] });
      toast({ title: "Programme item added" });
      closeForm();
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest(`/api/programme/items/${id}`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/programme/items"] });
      toast({ title: "Updated" });
      closeForm();
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/programme/items/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/programme/items"] });
      toast({ title: "Deleted" });
      setDeleteId(null);
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const closeForm = () => { setShowForm(false); setEditingItem(null); setForm(DEFAULT_FORM); };

  const openCreate = (date?: Date) => {
    const d = date || new Date();
    setForm({ ...DEFAULT_FORM, startDate: d.toISOString().slice(0, 10) });
    setEditingItem(null);
    setShowForm(true);
  };

  const openEdit = (item: ProgrammeItem) => {
    const start = new Date(item.startTime);
    const end = new Date(item.endTime);
    setForm({
      title: item.title,
      description: item.description || "",
      category: item.category,
      startDate: start.toISOString().slice(0, 10),
      startTime: start.toTimeString().slice(0, 5),
      endTime: end.toTimeString().slice(0, 5),
      isRecurring: item.isRecurring,
      recurrenceType: item.recurrenceType || "weekly",
      recurrenceEnd: item.recurrenceEnd ? new Date(item.recurrenceEnd).toISOString().slice(0, 10) : "",
      isPublic: item.isPublic,
      capacity: item.capacity?.toString() || "",
      ticketPrice: item.ticketPrice?.toString() || "",
      locationId: (item as any).locationId?.toString() || "",
      spotName: (item as any).spotName || "",
    });
    setEditingItem(item);
    setShowForm(true);
  };

  const { data: mySpots = [] } = useQuery<any[]>({
    queryKey: ["/api/spots/owner", (user as any)?.id],
    enabled: !!access?.isEnabled && !!(user as any)?.id,
  });

  const handleSubmit = () => {
    if (!form.title.trim()) { toast({ title: "Title required", variant: "destructive" }); return; }
    const startTime = new Date(`${form.startDate}T${form.startTime}:00`);
    const endTime = new Date(`${form.startDate}T${form.endTime}:00`);
    if (endTime <= startTime) { toast({ title: "End time must be after start time", variant: "destructive" }); return; }
    const selectedSpot = form.locationId ? mySpots.find((s: any) => s.id === parseInt(form.locationId)) : null;
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      isRecurring: form.isRecurring,
      recurrenceType: form.isRecurring ? form.recurrenceType : null,
      recurrenceEnd: form.isRecurring && form.recurrenceEnd ? new Date(form.recurrenceEnd).toISOString() : null,
      isPublic: form.isPublic,
      capacity: form.capacity ? parseInt(form.capacity) : null,
      ticketPrice: form.ticketPrice ? parseFloat(form.ticketPrice) : null,
      locationId: form.locationId ? parseInt(form.locationId) : null,
      spotName: selectedSpot ? selectedSpot.name : (form.spotName || null),
    };
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const navigate_ = (dir: 1 | -1) => {
    const d = new Date(currentDate);
    if (viewMode === "day") d.setDate(d.getDate() + dir);
    else if (viewMode === "week") d.setDate(d.getDate() + 7 * dir);
    else d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  };

  const goToday = () => setCurrentDate(new Date());

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const monthCells = useMemo(() => getMonthDays(currentDate.getFullYear(), currentDate.getMonth()), [currentDate]);

  // Returns items visible on a given day, including recurring occurrences
  const getItemsForDay = (d: Date): (ProgrammeItem & { occurrenceStart: Date; occurrenceEnd: Date })[] => {
    const result: (ProgrammeItem & { occurrenceStart: Date; occurrenceEnd: Date })[] = [];
    for (const item of items) {
      const start = new Date(item.startTime);
      const end = new Date(item.endTime);
      const durMs = end.getTime() - start.getTime();
      if (!item.isRecurring || !item.recurrenceType) {
        if (isSameDay(start, d)) {
          result.push({ ...item, occurrenceStart: start, occurrenceEnd: end });
        }
      } else {
        if (d < start) continue;
        const recEnd = item.recurrenceEnd ? new Date(item.recurrenceEnd) : null;
        if (recEnd && d > recEnd) continue;
        const daysDiff = Math.round((d.getTime() - start.getTime()) / 86400000);
        let matches = false;
        if (item.recurrenceType === "daily" && daysDiff >= 0) matches = true;
        else if (item.recurrenceType === "weekly" && daysDiff % 7 === 0) matches = true;
        else if (item.recurrenceType === "monthly" && d.getDate() === start.getDate()) matches = true;
        if (matches) {
          const occStart = new Date(d);
          occStart.setHours(start.getHours(), start.getMinutes(), 0, 0);
          const occEnd = new Date(occStart.getTime() + durMs);
          result.push({ ...item, occurrenceStart: occStart, occurrenceEnd: occEnd });
        }
      }
    }
    return result.sort((a, b) => a.occurrenceStart.getTime() - b.occurrenceStart.getTime());
  };

  const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6:00 – 23:00

  const getItemStyleForHour = (item: ProgrammeItem & { occurrenceStart?: Date; occurrenceEnd?: Date }) => {
    const start = item.occurrenceStart || new Date(item.startTime);
    const end = item.occurrenceEnd || new Date(item.endTime);
    const top = ((start.getHours() - 6) + start.getMinutes() / 60) * 60;
    const height = Math.max(((end.getTime() - start.getTime()) / 3600000) * 60, 30);
    return { top, height };
  };

  if (!user) return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
      <Lock className="w-12 h-12 text-muted-foreground mb-4" />
      <h2 className="font-bold text-lg mb-2">Sign in required</h2>
      <Button onClick={() => navigate("/auth/login")} data-testid="button-signin">Sign In</Button>
    </div>
  );

  if (accessLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (!access || !access.isEnabled) return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center max-w-sm mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
        <Calendar className="w-8 h-8 text-muted-foreground" />
      </div>
      <h2 className="font-bold text-xl mb-2">Programme Planner</h2>
      {(user as any)?.role === "spot_owner" ? (
        <p className="text-muted-foreground text-sm mb-6">
          Your spot owner account is registered. An admin will review and activate your calendar access soon.
          Once approved, you'll be able to schedule classes, sessions and events for your spot.
        </p>
      ) : (
        <p className="text-muted-foreground text-sm mb-6">
          This feature is available for verified venue and spot owners. If you own a place,
          sign up as a Spot Owner or contact the admin to get access.
        </p>
      )}
      <Button variant="outline" onClick={() => navigate("/")} data-testid="button-back-home" className="gap-2">
        <ArrowLeft className="w-4 h-4" /> Back to Home
      </Button>
    </div>
  );

  const todayItems = getItemsForDay(currentDate);
  const isToday = isSameDay(currentDate, new Date());

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="p-1.5 rounded-lg hover:bg-muted" data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-base leading-tight" data-testid="text-venue-name">{access.venueName}</h1>
            <p className="text-xs text-muted-foreground">Programme Planner</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAnalytics(true)}
            className="p-1.5 rounded-lg hover:bg-muted border border-border"
            title="Analytics"
            data-testid="button-analytics"
          >
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
          </button>
          <Button size="sm" onClick={() => openCreate()} className="gap-1.5 rounded-xl" data-testid="button-add-item">
            <Plus className="w-4 h-4" /> Add class
          </Button>
        </div>
      </div>

      {/* View mode tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border shrink-0">
        <div className="flex rounded-xl bg-muted/50 p-0.5 gap-0.5 mr-auto">
          {(["day", "week", "month"] as const).map(m => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${viewMode === m ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              data-testid={`tab-view-${m}`}
            >
              {m}
            </button>
          ))}
        </div>
        <button onClick={() => navigate_(- 1)} className="p-1.5 rounded-lg hover:bg-muted" data-testid="button-prev">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button onClick={goToday} className="px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-muted" data-testid="button-today">Today</button>
        <button onClick={() => navigate_(1)} className="p-1.5 rounded-lg hover:bg-muted" data-testid="button-next">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Date header */}
      <div className="px-4 py-2 shrink-0">
        <p className="font-semibold text-sm" data-testid="text-current-period">
          {viewMode === "day" && `${DAYS_SHORT[currentDate.getDay()]}, ${currentDate.getDate()} ${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
          {viewMode === "week" && `${weekDays[0].getDate()} – ${weekDays[6].getDate()} ${MONTHS[weekDays[0].getMonth()]} ${weekDays[0].getFullYear()}`}
          {viewMode === "month" && `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">

        {/* DAY VIEW */}
        {viewMode === "day" && (
          <div className="relative px-4 pb-8">
            {itemsLoading ? (
              <div className="flex justify-center py-12"><RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="relative">
                {HOURS.map(h => (
                  <div key={h} className="flex items-start gap-3 mb-0" style={{ height: 60 }}>
                    <span className="text-xs text-muted-foreground w-10 shrink-0 pt-0.5">{String(h).padStart(2, "0")}:00</span>
                    <div className="flex-1 border-t border-border/50 relative" />
                  </div>
                ))}
                {/* Overlay items */}
                <div className="absolute top-0 left-14 right-0">
                  {todayItems.map(item => {
                    const { top, height } = getItemStyleForHour(item);
                    const colorClass = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.other;
                    return (
                      <div
                        key={item.id}
                        className={`absolute left-1 right-2 rounded-lg border px-2 py-1 cursor-pointer transition-all hover:shadow-md ${colorClass}`}
                        style={{ top, height: Math.max(height, 40) }}
                        onClick={() => openEdit(item)}
                        data-testid={`item-day-${item.id}`}
                      >
                        <p className="font-semibold text-xs leading-tight truncate">{CATEGORY_EMOJIS[item.category]} {item.title}</p>
                        <p className="text-xs opacity-70">{formatTime(item.occurrenceStart || item.startTime)} – {formatTime(item.occurrenceEnd || item.endTime)}</p>
                        {!item.isPublic && <Lock className="w-3 h-3 opacity-50 mt-0.5" />}
                      </div>
                    );
                  })}
                </div>
                {todayItems.length === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pt-24">
                    <p className="text-sm text-muted-foreground">No events scheduled</p>
                    <button onClick={() => openCreate(currentDate)} className="text-xs text-primary mt-1 font-medium" data-testid="button-add-day">+ Add class for this day</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* WEEK VIEW */}
        {viewMode === "week" && (
          <div className="pb-6">
            {/* Day header row */}
            <div className="grid grid-cols-7 gap-px bg-border/30 border-b border-border">
              {weekDays.map((d, i) => {
                const isT = isSameDay(d, new Date());
                return (
                  <div key={i} className="bg-background text-center py-2 px-1">
                    <p className="text-xs text-muted-foreground">{DAYS_SHORT[(d.getDay() + 6) % 7 + 1 > 6 ? 0 : (d.getDay())]}</p>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center mx-auto text-sm font-semibold ${isT ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
                      {d.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Events per day */}
            <div className="grid grid-cols-7 gap-px bg-border/20 min-h-[300px]">
              {weekDays.map((d, i) => {
                const dayItems = getItemsForDay(d);
                const isT = isSameDay(d, new Date());
                return (
                  <div
                    key={i}
                    className={`bg-background p-1 min-h-[120px] cursor-pointer`}
                    onClick={() => { setCurrentDate(d); setViewMode("day"); }}
                    data-testid={`week-day-${i}`}
                  >
                    {dayItems.slice(0, 4).map(item => (
                      <div
                        key={item.id}
                        className={`mb-0.5 px-1.5 py-0.5 rounded text-xs truncate border cursor-pointer ${CATEGORY_COLORS[item.category] || CATEGORY_COLORS.other}`}
                        onClick={e => { e.stopPropagation(); openEdit(item); }}
                        data-testid={`item-week-${item.id}`}
                      >
                        {CATEGORY_EMOJIS[item.category]} {formatTime(item.occurrenceStart || item.startTime)} {item.title}
                      </div>
                    ))}
                    {dayItems.length > 4 && (
                      <p className="text-xs text-muted-foreground pl-1">+{dayItems.length - 4} more</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* MONTH VIEW */}
        {viewMode === "month" && (
          <div className="px-2 pb-6">
            {/* Day labels */}
            <div className="grid grid-cols-7 mb-1">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                <div key={d} className="text-center text-xs text-muted-foreground py-1 font-medium">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {monthCells.map((d, i) => {
                if (!d) return <div key={i} className="h-16 rounded-lg bg-muted/10" />;
                const dayItems = getItemsForDay(d);
                const isT = isSameDay(d, new Date());
                const isCurr = d.getMonth() === currentDate.getMonth();
                return (
                  <div
                    key={i}
                    className={`h-16 rounded-lg p-1 cursor-pointer transition-colors ${isT ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/40 border border-transparent"} ${!isCurr ? "opacity-40" : ""}`}
                    onClick={() => { setCurrentDate(d); setViewMode("day"); }}
                    data-testid={`month-day-${d.getDate()}`}
                  >
                    <p className={`text-xs font-semibold mb-0.5 ${isT ? "text-primary" : "text-foreground"}`}>{d.getDate()}</p>
                    {dayItems.slice(0, 2).map(item => (
                      <div key={item.id} className={`text-xs px-1 py-px rounded truncate border mb-px ${CATEGORY_COLORS[item.category] || CATEGORY_COLORS.other}`} data-testid={`item-month-${item.id}`}>
                        {item.title}
                      </div>
                    ))}
                    {dayItems.length > 2 && <p className="text-xs text-muted-foreground">+{dayItems.length - 2}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Form Sheet */}
      <Sheet open={showForm} onOpenChange={v => { if (!v) closeForm(); }}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl px-5 pb-10">
          <div className="mx-auto w-10 h-1 rounded-full bg-muted mb-5 mt-2" />
          <h2 className="font-bold text-base mb-5">{editingItem ? "Edit class / session" : "Add class / session"}</h2>

          <div className="space-y-4">
            <div>
              <Label htmlFor="prog-title" className="text-xs font-medium mb-1.5 block">Title *</Label>
              <Input
                id="prog-title"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Morning Boxing, Open Training, Yoga Flow"
                data-testid="input-title"
              />
            </div>

            <div>
              <Label htmlFor="prog-spot" className="text-xs font-medium mb-1.5 block">Spot / Venue</Label>
              <Select
                value={form.locationId || "none"}
                onValueChange={v => setForm(f => ({ ...f, locationId: v === "none" ? "" : v }))}
              >
                <SelectTrigger id="prog-spot" data-testid="select-spot">
                  <SelectValue placeholder="Select your spot (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific spot</SelectItem>
                  {(mySpots as any[]).filter((s: any) => s.approvalStatus === 'approved').map((spot: any) => (
                    <SelectItem key={spot.id} value={spot.id.toString()}>{spot.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Linking to a spot shows this event on your spot's public page</p>
            </div>

            <div>
              <Label htmlFor="prog-category" className="text-xs font-medium mb-1.5 block">Category</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger id="prog-category" data-testid="select-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PROGRAMME_CATEGORY_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{CATEGORY_EMOJIS[val]} {label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="prog-date" className="text-xs font-medium mb-1.5 block">Date *</Label>
                <Input id="prog-date" type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} data-testid="input-date" />
              </div>
              <div>
                <Label htmlFor="prog-start" className="text-xs font-medium mb-1.5 block">Start *</Label>
                <Input id="prog-start" type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} data-testid="input-start-time" />
              </div>
              <div>
                <Label htmlFor="prog-end" className="text-xs font-medium mb-1.5 block">End *</Label>
                <Input id="prog-end" type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} data-testid="input-end-time" />
              </div>
            </div>

            <div>
              <Label htmlFor="prog-desc" className="text-xs font-medium mb-1.5 block">Description</Label>
              <Textarea
                id="prog-desc"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What's included? Equipment needed? Level required?"
                rows={3}
                className="resize-none text-sm"
                data-testid="textarea-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="prog-capacity" className="text-xs font-medium mb-1.5 block">Capacity</Label>
                <Input id="prog-capacity" type="number" min="1" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} placeholder="e.g. 150" data-testid="input-capacity" />
              </div>
              <div>
                <Label htmlFor="prog-price" className="text-xs font-medium mb-1.5 block">Ticket Price (€)</Label>
                <Input id="prog-price" type="number" min="0" step="0.50" value={form.ticketPrice} onChange={e => setForm(f => ({ ...f, ticketPrice: e.target.value }))} placeholder="0 = Free" data-testid="input-ticket-price" />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20">
              <div className="flex items-center gap-2">
                <Repeat className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Recurring event</span>
              </div>
              <Switch checked={form.isRecurring} onCheckedChange={v => setForm(f => ({ ...f, isRecurring: v }))} data-testid="switch-recurring" />
            </div>

            {form.isRecurring && (
              <div className="grid grid-cols-2 gap-3 pl-2">
                <div>
                  <Label htmlFor="prog-recurrence" className="text-xs font-medium mb-1.5 block">Repeat</Label>
                  <Select value={form.recurrenceType} onValueChange={v => setForm(f => ({ ...f, recurrenceType: v }))}>
                    <SelectTrigger id="prog-recurrence" data-testid="select-recurrence-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="prog-recurrence-end" className="text-xs font-medium mb-1.5 block">Until</Label>
                  <Input id="prog-recurrence-end" type="date" value={form.recurrenceEnd} onChange={e => setForm(f => ({ ...f, recurrenceEnd: e.target.value }))} data-testid="input-recurrence-end" />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20">
              <div className="flex items-center gap-2">
                {form.isPublic ? <Globe className="w-4 h-4 text-green-600" /> : <Lock className="w-4 h-4 text-muted-foreground" />}
                <div>
                  <p className="text-sm font-medium">{form.isPublic ? "Public event" : "Private event"}</p>
                  <p className="text-xs text-muted-foreground">{form.isPublic ? "Visible to everyone" : "Only you can see this"}</p>
                </div>
              </div>
              <Switch checked={form.isPublic} onCheckedChange={v => setForm(f => ({ ...f, isPublic: v }))} data-testid="switch-public" />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            {editingItem && (
              <Button
                variant="outline"
                className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => { setDeleteId(editingItem.id); setShowForm(false); }}
                data-testid="button-delete-item"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </Button>
            )}
            <Button variant="outline" onClick={closeForm} className="flex-1" data-testid="button-cancel-form">Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="flex-1"
              data-testid="button-save-item"
            >
              {createMutation.isPending || updateMutation.isPending ? "Saving…" : editingItem ? "Update" : "Add Event"}
            </Button>
          </div>
          {editingItem && (
            <button
              onClick={() => { setAttendeesItemId(editingItem.id); setShowForm(false); }}
              className="mt-4 w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2 border border-dashed border-border rounded-xl"
              data-testid="button-view-attendees"
            >
              <UserCheck className="w-4 h-4" /> View attendees
            </button>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 pb-8 px-4">
          <div className="bg-background rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-base mb-2">Delete this event?</h3>
            <p className="text-sm text-muted-foreground mb-5">This cannot be undone.</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteId(null)} data-testid="button-cancel-delete">Cancel</Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => deleteMutation.mutate(deleteId!)}
                disabled={deleteMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Attendees Sheet */}
      <Sheet open={!!attendeesItemId} onOpenChange={v => { if (!v) setAttendeesItemId(null); }}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl px-5 pb-10">
          <div className="mx-auto w-10 h-1 rounded-full bg-muted mb-5 mt-2" />
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-base flex items-center gap-2">
              <UserCheck className="w-5 h-5" />
              Attendees
            </h2>
            {attendeesItemId && (
              <span className="text-xs text-muted-foreground">{attendees.length} registered</span>
            )}
          </div>
          {attendeesLoading ? (
            <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : attendees.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No registrations yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {attendees.map((a: any) => (
                <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border">
                  {a.profilePicture ? (
                    <img src={a.profilePicture} alt={a.displayName} className="w-9 h-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">{(a.displayName || "?")[0].toUpperCase()}</span>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{a.displayName || "Unknown"}</p>
                    {a.email && <p className="text-xs text-muted-foreground truncate">{a.email}</p>}
                  </div>
                  <div className="shrink-0">
                    {a.status === "paid" && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />Paid
                      </span>
                    )}
                    {a.status === "reserved" && (
                      <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-medium">
                        <Ticket className="w-3.5 h-3.5" />Reserved
                      </span>
                    )}
                    {a.status === "pending_payment" && (
                      <span className="inline-flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                        <CreditCard className="w-3.5 h-3.5" />Pending
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Owner Analytics Sheet */}
      <Sheet open={showAnalytics} onOpenChange={v => { if (!v) setShowAnalytics(false); }}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl px-5 pb-10">
          <div className="mx-auto w-10 h-1 rounded-full bg-muted mb-5 mt-2" />
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-base">Your Analytics</h2>
            {ownerAnalytics?.venueName && (
              <span className="text-xs text-muted-foreground">— {ownerAnalytics.venueName}</span>
            )}
          </div>

          {analyticsLoading ? (
            <div className="flex justify-center py-12"><RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : !ownerAnalytics ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No booking data yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* KPI row */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Total classes", value: ownerAnalytics.totalClasses, sub: `${ownerAnalytics.activeClasses} active`, color: "text-blue-600" },
                  { label: "Total bookings", value: ownerAnalytics.totalBookings, sub: `${ownerAnalytics.confirmedBookings} confirmed`, color: "text-green-600" },
                  { label: "Revenue", value: `€${(ownerAnalytics.totalRevenue || 0).toFixed(2)}`, sub: "paid bookings", color: "text-orange-600" },
                  { label: "Fill rate", value: ownerAnalytics.totalBookings > 0 ? `${Math.round((ownerAnalytics.confirmedBookings / ownerAnalytics.totalBookings) * 100)}%` : "—", sub: "confirmed vs total", color: "text-purple-600" },
                ].map(({ label, value, sub, color }) => (
                  <div key={label} className="rounded-xl border p-3 bg-muted/20">
                    <p className={`text-xl font-bold ${color}`}>{value}</p>
                    <p className="text-xs font-medium mt-0.5">{label}</p>
                    <p className="text-xs text-muted-foreground">{sub}</p>
                  </div>
                ))}
              </div>

              {/* Weekly trend */}
              {ownerAnalytics.weeklyTrend?.length > 0 && (
                <div className="rounded-xl border p-4 bg-card">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Bookings — Last 8 Weeks</h3>
                  <div className="flex items-end gap-1 h-16">
                    {ownerAnalytics.weeklyTrend.map((w: any, i: number) => {
                      const maxCount = Math.max(...ownerAnalytics.weeklyTrend.map((x: any) => x.count), 1);
                      const heightPct = Math.max((w.count / maxCount) * 100, w.count > 0 ? 5 : 0);
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                          {w.count > 0 && <span className="text-[9px] text-muted-foreground">{w.count}</span>}
                          <div className="w-full rounded-t-sm bg-primary/70" style={{ height: `${heightPct}%`, minHeight: w.count > 0 ? 3 : 0 }} />
                          <span className="text-[8px] text-muted-foreground">{new Date(w.week).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Top classes */}
              {ownerAnalytics.topClasses?.length > 0 && (
                <div className="rounded-xl border p-4 bg-card">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Award className="w-4 h-4 text-primary" /> Your Classes</h3>
                  <div className="space-y-2">
                    {ownerAnalytics.topClasses.map((cls: any, i: number) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{cls.title}</p>
                          <p className="text-xs text-muted-foreground capitalize">{cls.category.replace(/_/g, " ")} · {cls.capacity > 0 ? `${cls.capacity} spots` : "No cap"}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold">{cls.count}</p>
                          {cls.revenue > 0 && <p className="text-xs text-green-600">€{cls.revenue.toFixed(2)}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
