import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AdminAction } from "@shared/schema";
import { useAuth } from "@/contexts/AuthContext";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  RefreshCw, Users, Calendar, FileText, Ticket, Zap, MapPin,
  ShoppingCart, Bot, Shield, Search, Clock, ChevronRight,
  Activity, BookOpen, ExternalLink, Hash, Info, CheckCircle2
} from "lucide-react";

type ActionFilterType = "all" | "user" | "event" | "content" | "ticket" | "system" | "location" | "booking" | "payment" | "ai";

interface ActionMeta {
  icon: React.ElementType;
  color: string;
  bg: string;
  label: string;
  filterKey: ActionFilterType;
}

const ACTION_META: Record<string, ActionMeta> = {
  user:     { icon: Users,        color: "text-blue-500",   bg: "bg-blue-500/12 dark:bg-blue-500/15",   label: "User",    filterKey: "user" },
  event:    { icon: Calendar,     color: "text-orange-500", bg: "bg-orange-500/12",                     label: "Event",   filterKey: "event" },
  content:  { icon: FileText,     color: "text-purple-500", bg: "bg-purple-500/12",                     label: "Content", filterKey: "content" },
  ticket:   { icon: Ticket,       color: "text-cyan-500",   bg: "bg-cyan-500/12",                       label: "Ticket",  filterKey: "ticket" },
  location: { icon: MapPin,       color: "text-emerald-500",bg: "bg-emerald-500/12",                    label: "Spot",    filterKey: "location" },
  system:   { icon: Zap,          color: "text-yellow-500", bg: "bg-yellow-500/12",                     label: "System",  filterKey: "system" },
  booking:  { icon: BookOpen,     color: "text-pink-500",   bg: "bg-pink-500/12",                       label: "Booking", filterKey: "booking" },
  payment:  { icon: ShoppingCart, color: "text-green-500",  bg: "bg-green-500/12",                      label: "Payment", filterKey: "payment" },
  ai:       { icon: Bot,          color: "text-violet-500", bg: "bg-violet-500/12",                     label: "AI",      filterKey: "ai" },
  flag:     { icon: Shield,       color: "text-red-500",    bg: "bg-red-500/12",                        label: "Report",  filterKey: "content" },
};

function getActionMeta(actionType: string): ActionMeta {
  const lower = (actionType ?? "").toLowerCase();
  const key = Object.keys(ACTION_META).find(k => lower.includes(k));
  return ACTION_META[key ?? "system"] ?? ACTION_META.system;
}

function humanizeAction(actionType: string): string {
  return actionType.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}

const FILTERS: { id: ActionFilterType; label: string; icon: React.ElementType; prefix?: string }[] = [
  { id: "all",      label: "All",     icon: Activity },
  { id: "user",     label: "Users",   icon: Users,        prefix: "user_" },
  { id: "event",    label: "Events",  icon: Calendar,     prefix: "event_" },
  { id: "location", label: "Spots",   icon: MapPin,       prefix: "location_" },
  { id: "content",  label: "Content", icon: FileText,     prefix: "content_" },
  { id: "ticket",   label: "Tickets", icon: Ticket,       prefix: "ticket_" },
  { id: "booking",  label: "Bookings",icon: BookOpen,     prefix: "booking_" },
  { id: "payment",  label: "Payment", icon: ShoppingCart, prefix: "payment_" },
  { id: "ai",       label: "AI",      icon: Bot,          prefix: "ai_" },
  { id: "system",   label: "System",  icon: Zap,          prefix: "system_" },
];

const ActivityLog = () => {
  const [filter, setFilter] = useState<ActionFilterType>("all");
  const [search, setSearch] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<AdminAction | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const adminId = user?.id;

  const { data: actions = [], isLoading, isFetching, refetch } = useQuery<AdminAction[]>({
    queryKey: ["/api/admin/actions", filter, adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const params: Record<string, string | number> = { adminId };
      const filterDef = FILTERS.find(f => f.id === filter);
      if (filterDef?.prefix) params.actionTypePrefix = filterDef.prefix;
      const response = await apiRequest("/api/admin/actions", "GET", params);
      return response.json();
    },
    enabled: !!adminId,
    refetchInterval: autoRefresh ? 20000 : false,
  });

  const filteredActions = actions.filter((action: AdminAction) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      action.actionType.toLowerCase().includes(q) ||
      action.targetType.toLowerCase().includes(q) ||
      (action.details?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Activity Log</h2>
            <p className="text-[11px] text-muted-foreground">{filteredActions.length} entries</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(v => !v)}
            className={cn(
              "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors",
              autoRefresh
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
                : "bg-muted border-border text-muted-foreground"
            )}
            data-testid="button-toggle-autorefresh"
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40")} />
            {autoRefresh ? "Live" : "Paused"}
          </button>
          <Button
            variant="outline" size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh-activity"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {FILTERS.map(f => {
          const Icon = f.icon;
          const isActive = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              data-testid={`filter-${f.id}`}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 border",
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-muted/40 border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="w-3 h-3" />
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search actions, targets, details…"
          className="pl-9 h-9 text-sm"
          value={search}
          onChange={e => setSearch(e.target.value)}
          data-testid="input-search-actions"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="py-12 text-center">
          <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading activity log…</p>
        </div>
      ) : filteredActions.length === 0 ? (
        <div className="py-12 text-center rounded-2xl border border-dashed border-border bg-muted/20">
          <CheckCircle2 className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No activity found</p>
          {search && <p className="text-xs text-muted-foreground/60 mt-1">Try clearing your search</p>}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <ul className="divide-y divide-border/50">
            {filteredActions.map((action: AdminAction) => {
              const meta = getActionMeta(action.actionType);
              const Icon = meta.icon;
              return (
                <li key={action.id}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer group"
                  onClick={() => { setSelectedAction(action); setDetailsOpen(true); }}
                  data-testid={`activity-row-${action.id}`}
                >
                  <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5", meta.bg)}>
                    <Icon className={cn("w-4 h-4", meta.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={cn("text-[9px] font-bold uppercase h-4 px-1.5 border-0", meta.bg, meta.color)}
                      >
                        {meta.label}
                      </Badge>
                      <span className="text-sm font-medium text-foreground">
                        {humanizeAction(action.actionType)}
                      </span>
                    </div>
                    {action.details && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{action.details}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                        <Hash className="w-3 h-3" />{action.targetType} {action.targetId ? `#${action.targetId}` : ""}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(action.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0 mt-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedAction && (() => {
                const meta = getActionMeta(selectedAction.actionType);
                const Icon = meta.icon;
                return (
                  <>
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", meta.bg)}>
                      <Icon className={cn("w-3.5 h-3.5", meta.color)} />
                    </div>
                    <span>{humanizeAction(selectedAction.actionType)}</span>
                  </>
                );
              })()}
            </DialogTitle>
          </DialogHeader>

          {selectedAction && (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Admin ID</p>
                  <p className="text-sm font-medium">#{selectedAction.adminId ?? "—"}</p>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Target</p>
                  <p className="text-sm font-medium capitalize">{selectedAction.targetType} {selectedAction.targetId ? `#${selectedAction.targetId}` : ""}</p>
                </div>
              </div>

              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Timestamp</p>
                <p className="text-sm font-medium">{format(new Date(selectedAction.createdAt), "d MMM yyyy 'at' HH:mm:ss")}</p>
                <p className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(selectedAction.createdAt), { addSuffix: true })}</p>
              </div>

              {selectedAction.details && (
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                    <Info className="w-3 h-3" /> Details
                  </p>
                  {(() => {
                    try {
                      const parsed = JSON.parse(selectedAction.details);
                      return (
                        <div className="space-y-1.5">
                          {parsed.message && <p className="text-sm font-medium">{parsed.message}</p>}
                          {parsed.scanCount != null && (
                            <p className="text-xs text-muted-foreground">Scan count: <strong>{parsed.scanCount}</strong></p>
                          )}
                          {parsed.timestamp && (
                            <p className="text-xs text-muted-foreground">
                              Scan time: {format(new Date(parsed.timestamp), "d MMM yyyy 'at' HH:mm:ss")}
                            </p>
                          )}
                          {parsed.scannerInfo && (
                            <details className="mt-2">
                              <summary className="text-[11px] font-semibold text-muted-foreground cursor-pointer">Scanner info</summary>
                              <pre className="text-[10px] bg-muted rounded p-2 mt-1 overflow-x-auto whitespace-pre-wrap">
                                {JSON.stringify(parsed.scannerInfo, null, 2)}
                              </pre>
                            </details>
                          )}
                          {!parsed.message && !parsed.scanCount && !parsed.timestamp && (
                            <pre className="text-xs bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap">
                              {JSON.stringify(parsed, null, 2)}
                            </pre>
                          )}
                        </div>
                      );
                    } catch {
                      return <p className="text-sm text-muted-foreground">{selectedAction.details}</p>;
                    }
                  })()}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDetailsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ActivityLog;
