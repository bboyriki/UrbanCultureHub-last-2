import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Calendar, ChevronLeft, ChevronRight, MapPin, Clock, Check, X,
  RefreshCw, AlertCircle, Star, TrendingUp, Filter, Search,
  Crosshair, ExternalLink, Users, Shield, ChevronDown, ChevronUp,
  CalendarDays, Sparkles
} from "lucide-react";

interface AdminSchedulePanelProps {
  isOpen: boolean;
  onToggle: () => void;
  onFlyTo: (lat: number, lng: number, zoom?: number) => void;
}

const STATUS_CONFIG = {
  approved: { color: "bg-green-500/15 text-green-400 border-green-500/30", dot: "bg-green-400", label: "Approved" },
  pending:  { color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30", dot: "bg-yellow-400", label: "Pending" },
  rejected: { color: "bg-red-500/15 text-red-400 border-red-500/30", dot: "bg-red-400", label: "Rejected" },
  past:     { color: "bg-gray-500/15 text-gray-400 border-gray-500/30", dot: "bg-gray-400", label: "Past" },
};

const CATEGORY_EMOJI: Record<string, string> = {
  breaking: "🕺", dance: "💃", graffiti: "🎨", music: "🎵", hiphop: "🎤",
  skate: "🛹", battle: "🥊", workshop: "📚", festival: "🎪", cypher: "🔄",
  competition: "🏆", art: "🖼️", concert: "🎶", default: "📅",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-NL", { weekday: "short", month: "short", day: "numeric" });
}

function groupByDate(evts: any[]) {
  const groups: Record<string, any[]> = {};
  evts.forEach(e => {
    const key = e.date || "unknown";
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  });
  return groups;
}

export default function AdminSchedulePanel({ isOpen, onToggle, onFlyTo }: AdminSchedulePanelProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved">("all");
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [flyingTo, setFlyingTo] = useState<number | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["/api/admin/map-schedule"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/map-schedule");
      return res.json ? res.json() : res;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const quickStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/admin/events/${id}/quick-status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/map-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Event updated" });
    },
    onError: () => toast({ title: "Failed to update event", variant: "destructive" }),
  });

  const events: any[] = data?.events || [];

  const filtered = events.filter(e => {
    const matchSearch = !search || e.title?.toLowerCase().includes(search.toLowerCase()) ||
      e.city?.toLowerCase().includes(search.toLowerCase()) ||
      e.location?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const grouped = groupByDate(filtered);
  const dateKeys = Object.keys(grouped).sort();

  const pendingCount = events.filter(e => e.status === "pending").length;

  const handleFlyTo = (evt: any) => {
    const lat = parseFloat(evt.latitude);
    const lng = parseFloat(evt.longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
      setFlyingTo(evt.id);
      onFlyTo(lat, lng, 15);
      setTimeout(() => setFlyingTo(null), 1500);
    } else {
      toast({ title: "No coordinates", description: "This event doesn't have map coordinates yet.", variant: "destructive" });
    }
  };

  return (
    <>
      {/* Toggle button — always visible on map */}
      <button
        onClick={onToggle}
        data-testid="btn-admin-schedule-toggle"
        className={cn(
          "absolute z-[1000] top-4 right-4 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold shadow-lg transition-all duration-200",
          "bg-gray-900/95 border border-white/10 text-white hover:bg-gray-800 backdrop-blur-sm",
          isOpen && "border-orange-500/50 bg-orange-500/10 text-orange-300"
        )}
        title="Admin Schedule Panel"
      >
        <Shield className="w-4 h-4" />
        <span className="hidden sm:inline">Schedule</span>
        {pendingCount > 0 && (
          <span className="ml-1 w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">
            {pendingCount > 9 ? "9+" : pendingCount}
          </span>
        )}
        {isOpen ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      {/* Panel */}
      {isOpen && (
        <div
          className="absolute z-[999] top-0 right-0 h-full w-[340px] max-w-[90vw] bg-gray-950/95 backdrop-blur-md border-l border-white/10 shadow-2xl flex flex-col"
          data-testid="admin-schedule-panel"
        >
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-white/10 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                  <CalendarDays className="w-3.5 h-3.5 text-orange-400" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Admin Schedule</div>
                  <div className="text-[10px] text-gray-500">{events.length} events · next 14 days</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
                </button>
                <button
                  onClick={onToggle}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search events..."
                className="pl-8 h-8 text-xs bg-white/5 border-white/10 text-white placeholder:text-gray-500 rounded-lg"
                data-testid="input-schedule-search"
              />
            </div>

            {/* Status filter pills */}
            <div className="flex gap-1.5">
              {(["all", "pending", "approved"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all capitalize",
                    statusFilter === s
                      ? s === "pending" ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40"
                        : s === "approved" ? "bg-green-500/20 text-green-400 border border-green-500/40"
                        : "bg-white/15 text-white border border-white/20"
                      : "bg-white/5 text-gray-500 border border-transparent hover:text-gray-300"
                  )}
                >
                  {s === "pending" && pendingCount > 0 ? `Pending (${pendingCount})` : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Event list */}
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-1">
              {isLoading && (
                <div className="flex items-center justify-center py-10 text-gray-500">
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  <span className="text-sm">Loading schedule...</span>
                </div>
              )}

              {!isLoading && filtered.length === 0 && (
                <div className="text-center py-10 text-gray-500">
                  <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No events match your filter</p>
                </div>
              )}

              {dateKeys.map(dateKey => {
                const dayEvents = grouped[dateKey];
                const dateLabel = formatDate(dateKey);
                const isToday = dateLabel === "Today";
                const isExpanded = expandedDate === null || expandedDate === dateKey;

                return (
                  <div key={dateKey} className="mb-1">
                    {/* Date header */}
                    <button
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors group"
                      onClick={() => setExpandedDate(isExpanded && expandedDate !== null ? null : dateKey)}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          isToday ? "bg-orange-400" : "bg-gray-600"
                        )} />
                        <span className={cn(
                          "text-xs font-bold",
                          isToday ? "text-orange-400" : "text-gray-400"
                        )}>
                          {dateLabel}
                        </span>
                        <span className="text-[10px] text-gray-600 bg-white/5 px-1.5 rounded">
                          {dayEvents.length}
                        </span>
                      </div>
                      {isExpanded ? <ChevronUp className="w-3 h-3 text-gray-600" /> : <ChevronDown className="w-3 h-3 text-gray-600" />}
                    </button>

                    {/* Events for this day */}
                    {isExpanded && dayEvents.map(evt => {
                      const statusCfg = STATUS_CONFIG[evt.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
                      const emoji = CATEGORY_EMOJI[evt.category?.toLowerCase()] || CATEGORY_EMOJI.default;
                      const hasCoords = evt.latitude && evt.longitude;

                      return (
                        <div
                          key={evt.id}
                          data-testid={`schedule-event-${evt.id}`}
                          className={cn(
                            "mx-1 mb-1 p-2.5 rounded-xl border transition-all",
                            "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06] hover:border-white/10"
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-base mt-0.5 shrink-0">{emoji}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-1">
                                <p className="text-xs font-semibold text-white leading-tight truncate">{evt.title}</p>
                                <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0", statusCfg.color)}>
                                  {statusCfg.label}
                                </span>
                              </div>

                              {/* Location + time */}
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {evt.city && (
                                  <span className="flex items-center gap-0.5 text-[10px] text-gray-500">
                                    <MapPin className="w-2.5 h-2.5" /> {evt.city}
                                  </span>
                                )}
                                {evt.date && (
                                  <span className="flex items-center gap-0.5 text-[10px] text-gray-500">
                                    <Clock className="w-2.5 h-2.5" />
                                    {new Date(evt.date).toLocaleDateString("en-NL", { month: "short", day: "numeric" })}
                                  </span>
                                )}
                                {(evt.attendee_count || evt.capacity) && (
                                  <span className="flex items-center gap-0.5 text-[10px] text-gray-500">
                                    <Users className="w-2.5 h-2.5" />
                                    {evt.attendee_count ?? 0}{evt.capacity ? `/${evt.capacity}` : ""}
                                  </span>
                                )}
                              </div>

                              {/* Actions row */}
                              <div className="flex items-center gap-1 mt-1.5">
                                {/* Fly to */}
                                <button
                                  onClick={() => handleFlyTo(evt)}
                                  disabled={!hasCoords}
                                  title={hasCoords ? "Fly to on map" : "No coordinates"}
                                  className={cn(
                                    "flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-colors",
                                    hasCoords
                                      ? "bg-blue-500/15 text-blue-400 border border-blue-500/20 hover:bg-blue-500/25"
                                      : "bg-white/5 text-gray-600 border border-white/5 cursor-not-allowed"
                                  )}
                                  data-testid={`btn-flyto-${evt.id}`}
                                >
                                  <Crosshair className={cn("w-2.5 h-2.5", flyingTo === evt.id && "animate-pulse")} />
                                  {flyingTo === evt.id ? "Flying..." : "Go to"}
                                </button>

                                {/* Quick approve (only for pending) */}
                                {evt.status === "pending" && (
                                  <>
                                    <button
                                      onClick={() => quickStatusMutation.mutate({ id: evt.id, status: "approved" })}
                                      disabled={quickStatusMutation.isPending}
                                      className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-green-500/15 text-green-400 border border-green-500/20 hover:bg-green-500/25 transition-colors"
                                      data-testid={`btn-approve-${evt.id}`}
                                    >
                                      <Check className="w-2.5 h-2.5" /> Approve
                                    </button>
                                    <button
                                      onClick={() => quickStatusMutation.mutate({ id: evt.id, status: "rejected" })}
                                      disabled={quickStatusMutation.isPending}
                                      className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 transition-colors"
                                      data-testid={`btn-reject-${evt.id}`}
                                    >
                                      <X className="w-2.5 h-2.5" /> Reject
                                    </button>
                                  </>
                                )}

                                {/* Feature badge */}
                                {evt.is_featured && (
                                  <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                                    <Star className="w-2 h-2" /> Featured
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Footer stats */}
          <div className="px-4 py-2 border-t border-white/10 shrink-0">
            <div className="flex items-center justify-between text-[10px] text-gray-600">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />
                  {events.filter(e => e.status === "pending").length} pending
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                  {events.filter(e => e.status === "approved").length} approved
                </span>
              </div>
              <span>Auto-refresh 1m</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
