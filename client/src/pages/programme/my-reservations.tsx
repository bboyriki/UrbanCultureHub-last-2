import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Calendar, Clock, MapPin, Ticket, CheckCircle2,
  XCircle, CreditCard, Loader2, AlertTriangle, Euro, Activity,
  ChevronDown, ChevronUp, Map, Star,
} from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

// ── Category emojis ───────────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = {
  fitness_class: "🏋️", yoga: "🧘", pilates: "🤸", boxing: "🥊",
  martial_arts: "🥋", crossfit: "💪", spinning: "🚴",
  dance_class: "💃", dance_battle: "🕺", open_floor: "🪩",
  open_training: "🏃", personal_training: "👤", group_session: "👥",
  sports_training: "⚽", workshop: "🔧", dj_night: "🎛️",
  live_music: "🎵", exhibition: "🖼️", open_mic: "🎤",
  event: "📅", private_event: "🔒", other: "📋",
};

const CATEGORY_GRADIENT: Record<string, string> = {
  dance_class:    "from-purple-500/20 to-violet-500/10",
  dance_battle:   "from-purple-500/20 to-violet-500/10",
  open_floor:     "from-violet-500/20 to-fuchsia-500/10",
  fitness_class:  "from-orange-500/20 to-amber-500/10",
  crossfit:       "from-orange-500/20 to-amber-500/10",
  yoga:           "from-green-500/20 to-emerald-500/10",
  pilates:        "from-pink-500/20 to-rose-500/10",
  boxing:         "from-red-500/20 to-orange-500/10",
  martial_arts:   "from-red-500/20 to-orange-500/10",
  spinning:       "from-yellow-500/20 to-amber-500/10",
  dj_night:       "from-indigo-500/20 to-blue-500/10",
  live_music:     "from-blue-500/20 to-indigo-500/10",
  open_mic:       "from-orange-500/20 to-yellow-500/10",
  workshop:       "from-amber-500/20 to-yellow-500/10",
  exhibition:     "from-teal-500/20 to-cyan-500/10",
  other:          "from-muted to-muted/40",
  event:          "from-muted to-muted/40",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface Reservation {
  id: number;
  occurrenceDate: string;
  occurrenceStart: string | null;
  occurrenceEnd: string | null;
  status: string;
  amountPaid: string | null;
  createdAt: string;
  itemId: number;
  title: string;
  description: string | null;
  category: string;
  startTime: string;
  endTime: string;
  ticketPrice: string | null;
  venueName: string | null;
  organizerName: string | null;
}

function getDisplayTime(r: Reservation) {
  if (r.occurrenceStart) return new Date(r.occurrenceStart);
  const base = new Date(r.startTime);
  const [year, month, day] = r.occurrenceDate.split("-").map(Number);
  return new Date(year, month - 1, day, base.getHours(), base.getMinutes());
}
function getDisplayEndTime(r: Reservation) {
  if (r.occurrenceEnd) return new Date(r.occurrenceEnd);
  const base = new Date(r.startTime);
  const end = new Date(r.endTime);
  const durationMs = end.getTime() - base.getTime();
  return new Date(getDisplayTime(r).getTime() + durationMs);
}

// ── Status helpers ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "paid") return <Badge className="bg-green-500 text-white text-xs gap-1"><CheckCircle2 className="w-3 h-3" />Paid & confirmed</Badge>;
  if (status === "reserved") return <Badge className="bg-blue-500 text-white text-xs gap-1"><Ticket className="w-3 h-3" />Reserved</Badge>;
  if (status === "pending_payment") return <Badge className="bg-yellow-500 text-white text-xs gap-1"><CreditCard className="w-3 h-3" />Payment pending</Badge>;
  if (status === "cancelled") return <Badge variant="secondary" className="text-xs gap-1"><XCircle className="w-3 h-3" />Cancelled</Badge>;
  return <Badge variant="secondary" className="text-xs">{status}</Badge>;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MyReservationsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeFilter, setActiveFilter] = useState<"all" | "upcoming" | "past">("upcoming");

  const { data: reservations = [], isLoading } = useQuery<Reservation[]>({
    queryKey: ["/api/programme/my-reservations"],
  });

  const cancelMutation = useMutation({
    mutationFn: async (r: Reservation) => {
      const res = await apiRequest(`/api/programme/events/${r.itemId}/register`, "DELETE", { occurrenceDate: r.occurrenceDate });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Reservation cancelled", description: "Your spot has been released." });
      queryClient.invalidateQueries({ queryKey: ["/api/programme/my-reservations"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Stats ─────────────────────────────────────────────────────────────────

  const now = new Date();
  const upcoming = reservations.filter(r => {
    const t = getDisplayTime(r);
    return t >= now && r.status !== "cancelled";
  });
  const past = reservations.filter(r => {
    const t = getDisplayTime(r);
    return t < now || r.status === "cancelled";
  });
  const totalSpent = reservations
    .filter(r => r.status === "paid")
    .reduce((sum, r) => sum + parseFloat(r.amountPaid || "0"), 0);
  const confirmedCount = reservations.filter(r => r.status === "paid" || r.status === "reserved").length;

  // Next upcoming booking
  const nextBooking = upcoming.length > 0 ? upcoming.sort((a, b) => getDisplayTime(a).getTime() - getDisplayTime(b).getTime())[0] : null;

  const displayList = activeFilter === "upcoming" ? upcoming : activeFilter === "past" ? past : reservations;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">

      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setLocation("/programme/events")}
            className="p-2 hover:bg-muted rounded-full transition-colors"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-base leading-none">My Bookings</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Your class & session reservations</p>
          </div>
          {reservations.length > 0 && (
            <Badge variant="secondary" className="text-xs">{reservations.length} total</Badge>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : reservations.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <div className="text-5xl mb-4">🎟️</div>
            <p className="font-semibold text-base text-foreground">No bookings yet</p>
            <p className="text-sm mt-1 mb-5">Browse the schedule and reserve your first spot</p>
            <Button onClick={() => setLocation("/programme/events")} data-testid="button-browse-events">
              <Calendar className="w-4 h-4 mr-2" />
              Browse schedule
            </Button>
          </div>
        ) : (
          <>
            {/* ── Stats row ── */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Upcoming", value: upcoming.length, emoji: "📅", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900" },
                { label: "Confirmed", value: confirmedCount, emoji: "✅", color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/30 border-green-100 dark:border-green-900" },
                { label: "Total spent", value: totalSpent > 0 ? `€${totalSpent.toFixed(0)}` : "—", emoji: "💶", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/30 border-orange-100 dark:border-orange-900" },
              ].map(({ label, value, emoji, color, bg }) => (
                <div key={label} className={`rounded-2xl border p-3 text-center ${bg}`} data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
                  <div className="text-xl mb-0.5">{emoji}</div>
                  <p className={`text-lg font-bold leading-tight ${color}`}>{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>

            {/* ── Next booking highlight ── */}
            {nextBooking && (
              <div className={`rounded-2xl border p-4 bg-gradient-to-r ${CATEGORY_GRADIENT[nextBooking.category] || CATEGORY_GRADIENT.other}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Next session</span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="text-3xl shrink-0">{CATEGORY_EMOJI[nextBooking.category] || "📋"}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm leading-tight">{nextBooking.title}</h3>
                    {nextBooking.venueName && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 shrink-0" />{nextBooking.venueName}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs">
                      <span className="flex items-center gap-1 font-medium">
                        <Calendar className="w-3 h-3" />
                        {format(getDisplayTime(nextBooking), "EEEE d MMM", { locale: nl })}
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {format(getDisplayTime(nextBooking), "HH:mm")} – {format(getDisplayEndTime(nextBooking), "HH:mm")}
                      </span>
                    </div>
                  </div>
                  <StatusBadge status={nextBooking.status} />
                </div>
              </div>
            )}

            {/* ── Filter tabs ── */}
            <div className="flex gap-1 bg-muted rounded-xl p-1">
              {([
                { key: "upcoming", label: `Upcoming (${upcoming.length})` },
                { key: "past",     label: `Past (${past.length})` },
                { key: "all",      label: "All" },
              ] as const).map(f => (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  data-testid={`filter-${f.key}`}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeFilter === f.key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* ── Reservation list ── */}
            {displayList.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <div className="text-4xl mb-3">
                  {activeFilter === "upcoming" ? "📅" : "🕰️"}
                </div>
                <p className="text-sm">{activeFilter === "upcoming" ? "No upcoming bookings" : "No past bookings"}</p>
                {activeFilter === "upcoming" && (
                  <Button size="sm" className="mt-4" onClick={() => setLocation("/programme/events")}>
                    Browse schedule
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {displayList
                  .sort((a, b) => getDisplayTime(a).getTime() - getDisplayTime(b).getTime())
                  .map(r => (
                    <TicketCard
                      key={r.id}
                      reservation={r}
                      onCancel={r.status !== "cancelled" && r.status !== "paid" ? () => cancelMutation.mutate(r) : undefined}
                      isCancelling={cancelMutation.isPending}
                      onViewMap={() => {/* navigate to map with venue search */}}
                    />
                  ))
                }
              </div>
            )}

            {/* ── Browse more CTA ── */}
            <div className="border border-border rounded-2xl p-4 text-center bg-muted/30">
              <p className="text-sm font-medium mb-2">Find more sessions</p>
              <Button size="sm" variant="outline" onClick={() => setLocation("/programme/events")}>
                <Calendar className="w-3.5 h-3.5 mr-1.5" />
                Browse full schedule
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Ticket card component ─────────────────────────────────────────────────────

function TicketCard({ reservation: r, onCancel, isCancelling, onViewMap }: {
  reservation: Reservation;
  onCancel: (() => void) | undefined;
  isCancelling: boolean;
  onViewMap: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const start = getDisplayTime(r);
  const end = getDisplayEndTime(r);
  const isFree = !r.ticketPrice || parseFloat(r.ticketPrice) === 0;
  const isPast = start < new Date();
  const canCancel = onCancel && r.status !== "paid" && r.status !== "cancelled";
  const gradient = CATEGORY_GRADIENT[r.category] || CATEGORY_GRADIENT.other;

  return (
    <div
      className={`rounded-2xl border border-border overflow-hidden transition-opacity ${isPast && r.status !== "paid" ? "opacity-60" : ""}`}
      data-testid={`card-reservation-${r.id}`}
    >
      {/* ── Ticket header strip ── */}
      <div className={`bg-gradient-to-r ${gradient} px-4 py-3 flex items-center gap-3`}>
        <div className="text-2xl shrink-0">{CATEGORY_EMOJI[r.category] || "📋"}</div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm leading-tight truncate" data-testid={`text-title-${r.id}`}>{r.title}</h3>
          {r.venueName && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
              <MapPin className="w-3 h-3 shrink-0" />{r.venueName}
            </p>
          )}
        </div>
        <div className="shrink-0">
          <StatusBadge status={r.status} />
        </div>
      </div>

      {/* ── Ticket dashes (visual divider) ── */}
      <div className="flex items-center px-4 -my-px">
        <div className="w-4 h-4 rounded-full bg-background border border-border -ml-6 shrink-0" />
        <div className="flex-1 border-t-2 border-dashed border-border mx-1" />
        <div className="w-4 h-4 rounded-full bg-background border border-border -mr-6 shrink-0" />
      </div>

      {/* ── Ticket body ── */}
      <div className="bg-card px-4 pt-3 pb-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div>
            <p className="text-muted-foreground mb-0.5 uppercase tracking-wide text-[10px]">Date</p>
            <p className="font-semibold flex items-center gap-1">
              <Calendar className="w-3 h-3 text-muted-foreground" />
              {format(start, "EEE d MMM yyyy", { locale: nl })}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground mb-0.5 uppercase tracking-wide text-[10px]">Time</p>
            <p className="font-semibold flex items-center gap-1">
              <Clock className="w-3 h-3 text-muted-foreground" />
              {format(start, "HH:mm")} – {format(end, "HH:mm")}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground mb-0.5 uppercase tracking-wide text-[10px]">Price</p>
            <p className={`font-bold ${r.status === "paid" ? "text-green-600 dark:text-green-400" : isFree ? "text-green-600 dark:text-green-400" : "text-foreground"}`}>
              {r.status === "paid" && r.amountPaid
                ? `Paid €${parseFloat(r.amountPaid).toFixed(2)}`
                : isFree ? "Free" : `€${parseFloat(r.ticketPrice!).toFixed(2)}`
              }
            </p>
          </div>
          {r.organizerName && (
            <div>
              <p className="text-muted-foreground mb-0.5 uppercase tracking-wide text-[10px]">Organizer</p>
              <p className="font-semibold truncate">{r.organizerName}</p>
            </div>
          )}
        </div>

        {/* Pending payment warning */}
        {r.status === "pending_payment" && (
          <div className="mt-3 flex items-start gap-2 p-2.5 bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-200 dark:border-yellow-800 rounded-xl text-xs text-yellow-800 dark:text-yellow-300">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>Your spot is held but payment is still pending. Contact the venue or re-register to complete payment.</span>
          </div>
        )}

        {/* Description toggle */}
        {r.description && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? "Hide details" : "Show details"}
          </button>
        )}
        {expanded && r.description && (
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{r.description}</p>
        )}

        {/* Action buttons */}
        {(canCancel) && (
          <div className="mt-3 pt-3 border-t border-border flex gap-2">
            {canCancel && (
              <button
                onClick={onCancel}
                disabled={isCancelling}
                data-testid={`button-cancel-${r.id}`}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
              >
                {isCancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                Cancel reservation
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
