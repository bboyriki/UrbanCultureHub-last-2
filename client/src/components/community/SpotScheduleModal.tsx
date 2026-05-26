import { useState, useRef, lazy, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  X, Plus, Trash2, CalendarDays, Clock, Repeat, Calendar,
  Loader2, Edit2, Check, ChevronDown, ChevronUp, Sparkles,
  MapPin, Save, Award,
} from "lucide-react";
import { cn } from "@/lib/utils";
const ClaimSpotModal = lazy(() => import("./ClaimSpotModal"));

// ── Types ────────────────────────────────────────────────────────────────
interface SpotSchedule {
  id: number;
  spotRef: string;
  spotName: string;
  title: string;
  activityType: string | null;
  scheduleType: "recurring" | "one_time";
  recurringDays: string[];
  startTime: string | null;
  endTime: string | null;
  eventDate: string | null;
  notes: string | null;
  isPublic: boolean;
  createdAt: string;
}

interface SpotScheduleModalProps {
  open: boolean;
  onClose: () => void;
  spotRef: string;   // e.g. "city-34", "osm-12345", "user-7"
  spotName: string;
  spotType?: string;
  spotAddress?: string;
}

// ── Constants ──────────────────────────────────────────────────────────
const WEEK_DAYS = [
  { key: "Mo", label: "Mon" },
  { key: "Tu", label: "Tue" },
  { key: "We", label: "Wed" },
  { key: "Th", label: "Thu" },
  { key: "Fr", label: "Fri" },
  { key: "Sa", label: "Sat" },
  { key: "Su", label: "Sun" },
];

const ACTIVITY_TYPES = [
  { value: "skate", label: "🛹 Skate Session", color: "#F59E0B" },
  { value: "breaking", label: "💃 Breaking / B-Boy", color: "#8B5CF6" },
  { value: "graffiti", label: "🎨 Graffiti Jam", color: "#10B981" },
  { value: "hip-hop", label: "🎤 Hip-Hop / MC", color: "#EF4444" },
  { value: "bmx", label: "🚲 BMX Session", color: "#F97316" },
  { value: "parkour", label: "🏃 Parkour", color: "#06B6D4" },
  { value: "dance", label: "🕺 Dance Training", color: "#EC4899" },
  { value: "music", label: "🎵 Music Session", color: "#3B82F6" },
  { value: "community", label: "👥 Community Meet", color: "#6B7280" },
  { value: "open", label: "✨ Open Session", color: "#7C3AED" },
  { value: "other", label: "📍 Other", color: "#9CA3AF" },
];

const DAY_COLORS: Record<string, string> = {
  Mo: "#6366F1", Tu: "#8B5CF6", We: "#EC4899", Th: "#F59E0B",
  Fr: "#10B981", Sa: "#EF4444", Su: "#3B82F6",
};

function getActivityDef(type: string | null) {
  return ACTIVITY_TYPES.find(a => a.value === type) || ACTIVITY_TYPES[ACTIVITY_TYPES.length - 1];
}

function formatTime(t: string | null) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function formatEventDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function getDayLabel(key: string) {
  return WEEK_DAYS.find(d => d.key === key)?.label || key;
}

// ── ScheduleCard component ─────────────────────────────────────────────
function ScheduleCard({ entry, isAdmin, onDelete, onTogglePublic }: {
  entry: SpotSchedule;
  isAdmin: boolean;
  onDelete: (id: number) => void;
  onTogglePublic: (id: number, isPublic: boolean) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const act = getActivityDef(entry.activityType);

  return (
    <div
      className="rounded-2xl border border-border/40 bg-card p-3 sm:p-4 space-y-3 transition-all duration-200 hover:shadow-md hover:border-border/70"
      data-testid={`schedule-entry-${entry.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-sm"
            style={{ background: `${act.color}20`, border: `1.5px solid ${act.color}40` }}>
            {act.label.split(" ")[0]}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm text-foreground leading-tight line-clamp-1">{entry.title}</p>
            <p className="text-[11px] text-muted-foreground">{act.label.replace(/^[^\s]+\s/, "")}</p>
          </div>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onTogglePublic(entry.id, !entry.isPublic)}
              className={cn(
                "text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors",
                entry.isPublic
                  ? "border-green-300 text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400"
                  : "border-gray-300 text-gray-500 bg-gray-50 dark:bg-gray-800"
              )}
              data-testid={`toggle-public-${entry.id}`}
            >
              {entry.isPublic ? "Public" : "Hidden"}
            </button>
            <button
              onClick={() => { setDeleting(true); onDelete(entry.id); }}
              disabled={deleting}
              className="w-7 h-7 rounded-full flex items-center justify-center text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors"
              data-testid={`delete-schedule-${entry.id}`}
            >
              {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            </button>
          </div>
        )}
      </div>

      {/* Time info */}
      <div className="flex flex-wrap gap-2">
        {entry.scheduleType === "recurring" && entry.recurringDays.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Repeat className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <div className="flex gap-1 flex-wrap">
              {entry.recurringDays.map(day => (
                <span key={day} className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                  style={{ background: `${DAY_COLORS[day] || "#6B7280"}18`, color: DAY_COLORS[day] || "#6B7280" }}>
                  {getDayLabel(day)}
                </span>
              ))}
            </div>
          </div>
        )}
        {entry.scheduleType === "one_time" && entry.eventDate && (
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <span className="text-[11px] font-medium text-foreground">{formatEventDate(entry.eventDate)}</span>
          </div>
        )}
        {(entry.startTime || entry.endTime) && (
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <span className="text-[11px] font-medium text-foreground">
              {formatTime(entry.startTime)}{entry.endTime ? ` – ${formatTime(entry.endTime)}` : ""}
            </span>
          </div>
        )}
      </div>

      {entry.notes && (
        <p className="text-[11px] text-muted-foreground leading-relaxed border-t border-border/30 pt-2">
          {entry.notes}
        </p>
      )}
    </div>
  );
}

// ── Add Schedule Form ─────────────────────────────────────────────────
interface AddFormState {
  title: string;
  activityType: string;
  scheduleType: "recurring" | "one_time";
  recurringDays: string[];
  startTime: string;
  endTime: string;
  eventDate: string;
  notes: string;
  isPublic: boolean;
}

function AddScheduleForm({ spotRef, spotName, onSuccess, onCancel }: {
  spotRef: string;
  spotName: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<AddFormState>({
    title: "",
    activityType: "open",
    scheduleType: "recurring",
    recurringDays: [],
    startTime: "10:00",
    endTime: "13:00",
    eventDate: "",
    notes: "",
    isPublic: true,
  });

  const set = (patch: Partial<AddFormState>) => setForm(f => ({ ...f, ...patch }));

  const toggleDay = (day: string) => {
    set({
      recurringDays: form.recurringDays.includes(day)
        ? form.recurringDays.filter(d => d !== day)
        : [...form.recurringDays, day],
    });
  };

  const createMut = useMutation({
    mutationFn: () => apiRequest(`/api/spot-schedules/${encodeURIComponent(spotRef)}`, "POST", {
      spotName,
      title: form.title,
      activityType: form.activityType || null,
      scheduleType: form.scheduleType,
      recurringDays: form.scheduleType === "recurring" ? form.recurringDays : [],
      startTime: form.startTime || null,
      endTime: form.endTime || null,
      eventDate: form.scheduleType === "one_time" ? form.eventDate || null : null,
      notes: form.notes || null,
      isPublic: form.isPublic,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/spot-schedules", spotRef] });
      qc.invalidateQueries({ queryKey: ["/api/spot-schedules", spotRef, "all"] });
      toast({ title: "Schedule added", description: `"${form.title}" is now live on ${spotName}` });
      onSuccess();
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const canSubmit = form.title.trim() &&
    (form.scheduleType === "one_time"
      ? !!form.eventDate
      : form.recurringDays.length > 0);

  return (
    <div className="space-y-4 p-1">
      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-foreground">Session title *</label>
        <Input
          value={form.title}
          onChange={e => set({ title: e.target.value })}
          placeholder='e.g. "Sunday Skate Session" or "Weekly B-Boy Training"'
          className="rounded-xl border-border/60 bg-muted/40 focus:bg-background text-sm"
          data-testid="input-schedule-title"
        />
      </div>

      {/* Activity type grid */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-foreground">Activity type</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {ACTIVITY_TYPES.map(act => (
            <button
              key={act.value}
              type="button"
              onClick={() => set({ activityType: act.value })}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-medium border transition-all text-left",
                form.activityType === act.value
                  ? "border-transparent shadow-sm scale-[1.02]"
                  : "border-border/40 bg-muted/30 text-muted-foreground hover:bg-muted/60"
              )}
              style={form.activityType === act.value
                ? { background: `${act.color}18`, borderColor: `${act.color}60`, color: act.color }
                : undefined
              }
              data-testid={`btn-activity-${act.value}`}
            >
              <span className="text-base leading-none">{act.label.split(" ")[0]}</span>
              <span className="line-clamp-1 leading-tight">{act.label.replace(/^[^\s]+\s/, "")}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Schedule type toggle */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-foreground">Schedule type</label>
        <div className="flex rounded-xl border border-border/50 p-0.5 bg-muted/30 gap-0.5">
          {[
            { value: "recurring", label: "🔁 Weekly recurring", icon: Repeat },
            { value: "one_time", label: "📅 One-time event", icon: Calendar },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => set({ scheduleType: opt.value as "recurring" | "one_time" })}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all",
                form.scheduleType === opt.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              data-testid={`btn-schedule-type-${opt.value}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Day picker (recurring only) */}
      {form.scheduleType === "recurring" && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Days *</label>
          <div className="flex gap-1.5 flex-wrap">
            {WEEK_DAYS.map(({ key, label }) => {
              const active = form.recurringDays.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleDay(key)}
                  className={cn(
                    "w-10 h-10 rounded-xl text-xs font-bold border transition-all",
                    active ? "shadow-sm scale-105" : "border-border/40 bg-muted/30 text-muted-foreground hover:bg-muted/60"
                  )}
                  style={active
                    ? { background: `${DAY_COLORS[key]}20`, borderColor: `${DAY_COLORS[key]}60`, color: DAY_COLORS[key] }
                    : undefined
                  }
                  data-testid={`day-${key}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Date picker (one_time only) */}
      {form.scheduleType === "one_time" && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Date *</label>
          <Input
            type="date"
            value={form.eventDate}
            onChange={e => set({ eventDate: e.target.value })}
            min={new Date().toISOString().split("T")[0]}
            className="rounded-xl border-border/60 bg-muted/40 focus:bg-background text-sm"
            data-testid="input-event-date"
          />
        </div>
      )}

      {/* Time range */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Start time</label>
          <Input
            type="time"
            value={form.startTime}
            onChange={e => set({ startTime: e.target.value })}
            className="rounded-xl border-border/60 bg-muted/40 focus:bg-background text-sm"
            data-testid="input-start-time"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">End time</label>
          <Input
            type="time"
            value={form.endTime}
            onChange={e => set({ endTime: e.target.value })}
            className="rounded-xl border-border/60 bg-muted/40 focus:bg-background text-sm"
            data-testid="input-end-time"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-foreground">Notes <span className="text-muted-foreground font-normal">(optional)</span></label>
        <Textarea
          value={form.notes}
          onChange={e => set({ notes: e.target.value })}
          placeholder="Equipment needed, skill level, contact info..."
          rows={2}
          className="resize-none rounded-xl border-border/60 bg-muted/40 focus:bg-background text-sm"
          data-testid="textarea-schedule-notes"
        />
      </div>

      {/* Visibility toggle */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/40">
        <div>
          <p className="text-xs font-semibold text-foreground">Public</p>
          <p className="text-[11px] text-muted-foreground">Visible to all users on this spot</p>
        </div>
        <Switch
          checked={form.isPublic}
          onCheckedChange={v => set({ isPublic: v })}
          data-testid="switch-schedule-public"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel}
          className="flex-1 rounded-xl border-border/60 h-10" data-testid="btn-cancel-schedule">
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => createMut.mutate()}
          disabled={!canSubmit || createMut.isPending}
          className="flex-1 rounded-xl h-10 gap-1.5 font-bold"
          data-testid="btn-save-schedule"
        >
          {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Schedule
        </Button>
      </div>
    </div>
  );
}

// ── Main SpotScheduleModal ────────────────────────────────────────────
export default function SpotScheduleModal({
  open, onClose, spotRef, spotName, spotType, spotAddress,
}: SpotScheduleModalProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const { toast } = useToast();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState<"schedule" | "manage">("schedule");
  const [showClaim, setShowClaim] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Encode spotRef to avoid URL issues with slashes
  const encodedRef = encodeURIComponent(spotRef);

  const { data: schedules = [], isLoading } = useQuery<SpotSchedule[]>({
    queryKey: ["/api/spot-schedules", spotRef, ...(isAdmin ? ["all"] : [])],
    queryFn: () => fetch(
      isAdmin
        ? `/api/spot-schedules/${encodedRef}/all`
        : `/api/spot-schedules/${encodedRef}`
    ).then(r => r.json()),
    enabled: open,
    staleTime: 30_000,
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/spot-schedules/entry/${id}`, "DELETE"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/spot-schedules", spotRef] });
      toast({ title: "Schedule removed" });
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const togglePublicMut = useMutation({
    mutationFn: ({ id, isPublic }: { id: number; isPublic: boolean }) =>
      apiRequest(`/api/spot-schedules/entry/${id}`, "PATCH", { isPublic }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/spot-schedules", spotRef] });
    },
    onError: () => toast({ title: "Failed to update visibility", variant: "destructive" }),
  });

  const recurringEntries = schedules.filter(s => s.scheduleType === "recurring");
  const oneTimeEntries = schedules.filter(s => s.scheduleType === "one_time")
    .filter(s => !s.eventDate || new Date(s.eventDate) >= new Date(new Date().toDateString()));

  if (!open) return null;

  return (
    <>
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center pb-[calc(52px+env(safe-area-inset-bottom,0px))] md:pb-0"
      ref={backdropRef}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="relative w-full sm:max-w-lg flex flex-col rounded-t-3xl sm:rounded-3xl bg-background shadow-2xl border border-border/50 overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300"
        style={{ maxHeight: "min(90dvh, calc(100dvh - 64px - env(safe-area-inset-bottom,0px)))" }}
      >
        {/* Drag handle */}
        <div className="flex-shrink-0 pt-3 pb-1 flex justify-center sm:hidden">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
        </div>

        {/* Header */}
        <div className="flex-shrink-0 px-4 pb-3 pt-1 border-b border-border/40">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
                style={{ background: "linear-gradient(135deg, #7C3AED20, #3B82F620)", border: "1.5px solid rgba(124,58,237,0.2)" }}>
                <CalendarDays className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="font-black text-base text-foreground leading-tight line-clamp-1">{spotName}</h2>
                <div className="flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <p className="text-[11px] text-muted-foreground truncate">
                    {spotAddress || "Netherlands"} · {schedules.length} schedule{schedules.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {user && !isAdmin && (
                <button
                  onClick={() => setShowClaim(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-[10px] font-bold border border-violet-200/60 hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors"
                  data-testid="btn-claim-spot"
                >
                  <Award className="w-3 h-3" />
                  Claim
                </button>
              )}
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors mt-0.5"
                data-testid="btn-close-schedule-modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex rounded-xl border border-border/40 p-0.5 bg-muted/30 gap-0.5 mt-3">
            <button
              onClick={() => { setTab("schedule"); setAdding(false); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all",
                tab === "schedule" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
              data-testid="tab-schedule"
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Schedule
            </button>
            {isAdmin && (
              <button
                onClick={() => setTab("manage")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all",
                  tab === "manage" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
                data-testid="tab-manage"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Manage
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-4 py-3 space-y-4">

            {/* ── MANAGE TAB (admin only) ── */}
            {tab === "manage" && isAdmin && (
              <div className="space-y-3">
                {!adding ? (
                  <Button
                    onClick={() => setAdding(true)}
                    className="w-full rounded-xl h-10 gap-2 font-bold"
                    data-testid="btn-add-schedule"
                  >
                    <Plus className="w-4 h-4" />
                    Add Schedule Entry
                  </Button>
                ) : (
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center">
                        <Plus className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <h3 className="font-bold text-sm text-foreground">New Schedule Entry</h3>
                    </div>
                    <AddScheduleForm
                      spotRef={spotRef}
                      spotName={spotName}
                      onSuccess={() => { setAdding(false); setTab("schedule"); }}
                      onCancel={() => setAdding(false)}
                    />
                  </div>
                )}

                {/* Existing entries in manage mode */}
                {schedules.length > 0 && !adding && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                      All entries ({schedules.length})
                    </p>
                    {schedules.map(entry => (
                      <ScheduleCard
                        key={entry.id}
                        entry={entry}
                        isAdmin={isAdmin}
                        onDelete={id => deleteMut.mutate(id)}
                        onTogglePublic={(id, isPublic) => togglePublicMut.mutate({ id, isPublic })}
                      />
                    ))}
                  </div>
                )}

                {schedules.length === 0 && !adding && (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                      <CalendarDays className="w-6 h-6 text-muted-foreground/50" />
                    </div>
                    <p className="font-semibold text-sm text-muted-foreground">No schedules yet</p>
                    <p className="text-[11px] text-muted-foreground/70 mt-1">Click "Add Schedule Entry" to get started</p>
                  </div>
                )}
              </div>
            )}

            {/* ── SCHEDULE TAB (public view) ── */}
            {tab === "schedule" && (
              <div className="space-y-4">
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="rounded-2xl bg-muted/40 animate-pulse h-20" />
                    ))}
                  </div>
                ) : schedules.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-purple-500/10 flex items-center justify-center mx-auto mb-4 border border-primary/10">
                      <CalendarDays className="w-7 h-7 text-primary/60" />
                    </div>
                    <p className="font-bold text-sm text-foreground mb-1">No sessions scheduled</p>
                    <p className="text-[11px] text-muted-foreground max-w-[220px] mx-auto leading-relaxed">
                      {isAdmin
                        ? 'Switch to "Manage" tab to add sessions for this spot'
                        : 'No schedule has been added for this spot yet'}
                    </p>
                    {isAdmin && (
                      <Button
                        onClick={() => setTab("manage")}
                        size="sm"
                        className="mt-4 rounded-full gap-1.5"
                        data-testid="btn-goto-manage"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Schedule
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    {recurringEntries.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="h-px flex-1 bg-border/40" />
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                            <Repeat className="w-3 h-3" />Weekly Sessions
                          </p>
                          <div className="h-px flex-1 bg-border/40" />
                        </div>
                        {recurringEntries.map(entry => (
                          <ScheduleCard
                            key={entry.id}
                            entry={entry}
                            isAdmin={isAdmin}
                            onDelete={id => deleteMut.mutate(id)}
                            onTogglePublic={(id, isPublic) => togglePublicMut.mutate({ id, isPublic })}
                          />
                        ))}
                      </div>
                    )}

                    {oneTimeEntries.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="h-px flex-1 bg-border/40" />
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                            <Calendar className="w-3 h-3" />Upcoming Events
                          </p>
                          <div className="h-px flex-1 bg-border/40" />
                        </div>
                        {oneTimeEntries.map(entry => (
                          <ScheduleCard
                            key={entry.id}
                            entry={entry}
                            isAdmin={isAdmin}
                            onDelete={id => deleteMut.mutate(id)}
                            onTogglePublic={(id, isPublic) => togglePublicMut.mutate({ id, isPublic })}
                          />
                        ))}
                      </div>
                    )}

                    {isAdmin && (
                      <button
                        onClick={() => setTab("manage")}
                        className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-primary/30 text-primary/70 hover:border-primary/60 hover:text-primary hover:bg-primary/5 transition-all text-xs font-semibold"
                        data-testid="btn-add-more"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add more sessions
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer info */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-border/40 bg-muted/20">
          <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
            Community spot on the <span className="font-bold text-foreground">Urban Culture Hub Netherlands</span> platform
          </p>
        </div>
      </div>
    </div>

    {/* Claim Spot Modal */}
    {showClaim && (
      <Suspense fallback={null}>
        <ClaimSpotModal
          open={showClaim}
          onClose={() => setShowClaim(false)}
          spotRef={spotRef}
          spotName={spotName}
          spotAddress={spotAddress}
        />
      </Suspense>
    )}
  </>
  );
}
