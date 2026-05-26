import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { formatDistanceToNow, format } from "date-fns";
import {
  Loader2, Users, Film, FileText, AlertTriangle, Calendar, ShoppingCart,
  ArrowRight, UserPlus, Flag, Zap, BarChart3, Send, MapPin, Ticket,
  RefreshCw, Activity, Eye, CheckCircle2,
  Sparkles, Bot, BookOpen, Package, XCircle, ChevronRight,
  Radio, Shield, Wand2, Volume2, Bell, Settings, Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useState, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";

interface OverviewData {
  users: { total: number; today: number; thisWeek: number };
  posts: { total: number; today: number };
  reels: { total: number; today: number; totalViews: number };
  reports: { pending: number };
  events: { active: number; total: number };
  orders: { total: number; revenue: number };
  spots: { osm: number; spotlight: number; claims: { total: number; pending: number; approved: number } };
  tickets: { total: number; used: number; revenue: number; today: number };
  bookings: { total: number; pending: number; today: number };
  recentSignups: { id: number; displayName: string; profilePicture: string | null; role: string; createdAt: string }[];
  recentFlags: { id: number; contentType: string; reason: string; status: string; createdAt: string }[];
  recentActivity: { id: number; action_type: string; target_type: string; details: string | null; created_at: string; admin_name: string | null; admin_avatar: string | null }[];
}

function StatCard({
  icon: Icon, label, value, sub, color, badge, onClick,
}: {
  icon: React.ElementType; label: string; value: string | number; sub?: string;
  color: string; badge?: { label: string; variant: "default" | "destructive" | "secondary" | "outline" };
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-2xl p-4 border border-border bg-card flex flex-col gap-3 relative overflow-hidden transition-all duration-200",
        onClick && "cursor-pointer hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5"
      )}
    >
      <div className="flex items-start justify-between">
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", color)}>
          <Icon className="w-4 h-4" />
        </div>
        {badge && (
          <Badge variant={badge.variant} className="text-[10px] h-5 px-1.5">{badge.label}</Badge>
        )}
        {onClick && !badge && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />}
      </div>
      <div>
        <p className="text-xl font-bold text-foreground tabular-nums">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        <p className="text-xs font-medium text-muted-foreground mt-0.5">{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground/60 mt-0.5 leading-tight">{sub}</p>}
      </div>
    </div>
  );
}

const ACTION_META: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  user:       { icon: Users,        color: "text-blue-500",    bg: "bg-blue-500/10",    label: "User" },
  event:      { icon: Calendar,     color: "text-orange-500",  bg: "bg-orange-500/10",  label: "Event" },
  content:    { icon: FileText,     color: "text-purple-500",  bg: "bg-purple-500/10",  label: "Content" },
  ticket:     { icon: Ticket,       color: "text-cyan-500",    bg: "bg-cyan-500/10",    label: "Ticket" },
  location:   { icon: MapPin,       color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Spot" },
  system:     { icon: Zap,          color: "text-yellow-500",  bg: "bg-yellow-500/10",  label: "System" },
  booking:    { icon: BookOpen,     color: "text-pink-500",    bg: "bg-pink-500/10",    label: "Booking" },
  payment:    { icon: ShoppingCart, color: "text-green-500",   bg: "bg-green-500/10",   label: "Payment" },
  ai:         { icon: Bot,          color: "text-violet-500",  bg: "bg-violet-500/10",  label: "AI" },
  moderation: { icon: Shield,       color: "text-red-500",     bg: "bg-red-500/10",     label: "Report" },
};

function getActionMeta(actionType: string, targetType: string) {
  const key = Object.keys(ACTION_META).find(k =>
    actionType?.toLowerCase().includes(k) || targetType?.toLowerCase().includes(k)
  );
  return ACTION_META[key ?? "system"] ?? ACTION_META.system;
}

function ActivityItem({ item }: { item: OverviewData["recentActivity"][0] }) {
  const meta = getActionMeta(item.action_type, item.target_type);
  const Icon = meta.icon;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0">
      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5", meta.bg)}>
        <Icon className={cn("w-3.5 h-3.5", meta.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={cn("text-[10px] font-bold uppercase tracking-wide", meta.color)}>{meta.label}</span>
          <span className="text-xs text-foreground font-medium truncate capitalize">
            {item.action_type?.replace(/_/g, " ") ?? "action"}
          </span>
        </div>
        {item.details && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{item.details}</p>}
        <div className="flex items-center gap-2 mt-0.5">
          {item.admin_name && <span className="text-[10px] text-muted-foreground/60">{item.admin_name}</span>}
          <span className="text-[10px] text-muted-foreground/50">
            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function AdminOverviewPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data, isLoading, isFetching } = useQuery<OverviewData>({
    queryKey: ["/api/admin/overview"],
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const { data: pendingEvents = [] } = useQuery<any[]>({
    queryKey: ["/api/events/pending-count"],
    queryFn: async () => {
      try {
        const r = await fetch("/api/events");
        const events = await r.json();
        return Array.isArray(events) ? events.filter((e: any) => e.status === "pending" || !e.status) : [];
      } catch { return []; }
    },
    staleTime: 60000,
  });

  const { data: pendingLocations = [] } = useQuery<any[]>({
    queryKey: ["/api/locations/pending-count"],
    queryFn: async () => {
      try {
        const r = await apiRequest("/api/locations?showAll=true", "GET");
        const locs = await r.json();
        return Array.isArray(locs) ? locs.filter((l: any) => l.approvalStatus === "pending" || !l.approvalStatus) : [];
      } catch { return []; }
    },
    staleTime: 60000,
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/overview"] });
    setLastRefresh(new Date());
  }, [queryClient]);

  useEffect(() => {
    if (!isFetching) setLastRefresh(new Date());
  }, [isFetching]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!data) return null;

  const totalAttention =
    data.reports.pending + data.spots.claims.pending + data.bookings.pending +
    pendingEvents.length + pendingLocations.length;

  const stats = [
    { icon: Users,         label: "Total Users",     value: data.users.total,
      sub: `+${data.users.today} today · +${data.users.thisWeek} this week`,
      color: "bg-blue-500/15 text-blue-500", onClick: () => navigate("/admin/users") },
    { icon: Calendar,      label: "Events",           value: data.events.total,
      sub: `${data.events.active} active · ${pendingEvents.length} pending`,
      color: "bg-orange-500/15 text-orange-500", onClick: () => navigate("/admin/events"),
      badge: pendingEvents.length > 0 ? { label: `${pendingEvents.length} pending`, variant: "destructive" as const } : undefined },
    { icon: MapPin,        label: "Mapped Spots",     value: (data.spots.osm + data.spots.spotlight).toLocaleString(),
      sub: `${data.spots.spotlight} spotlight · ${data.spots.claims.pending} claims pending`,
      color: "bg-emerald-500/15 text-emerald-500", onClick: () => navigate("/admin/spots-overview"),
      badge: data.spots.claims.pending > 0 ? { label: `${data.spots.claims.pending} pending`, variant: "destructive" as const } : undefined },
    { icon: Ticket,        label: "Tickets Sold",     value: data.tickets.total,
      sub: `${data.tickets.used} used · €${(data.tickets.revenue / 100).toFixed(0)} revenue`,
      color: "bg-cyan-500/15 text-cyan-500" },
    { icon: Film,          label: "Reels",            value: data.reels.total,
      sub: `+${data.reels.today} today · ${(data.reels.totalViews / 1000).toFixed(1)}K views`,
      color: "bg-purple-500/15 text-purple-500", onClick: () => navigate("/admin/reels") },
    { icon: FileText,      label: "Posts",            value: data.posts.total,
      sub: `+${data.posts.today} today`, color: "bg-indigo-500/15 text-indigo-500" },
    { icon: BookOpen,      label: "Bookings",         value: data.bookings.total,
      sub: `${data.bookings.pending} pending · +${data.bookings.today} today`,
      color: "bg-pink-500/15 text-pink-500", onClick: () => navigate("/admin/service-bookings"),
      badge: data.bookings.pending > 0 ? { label: `${data.bookings.pending} pending`, variant: "secondary" as const } : undefined },
    { icon: ShoppingCart,  label: "Orders",           value: data.orders.total,
      sub: `€${Number(data.orders.revenue).toFixed(2)} total revenue`,
      color: "bg-teal-500/15 text-teal-500" },
    { icon: AlertTriangle, label: "Pending Reports",  value: data.reports.pending,
      sub: data.reports.pending > 0 ? "Requires attention" : "All clear",
      color: data.reports.pending > 0 ? "bg-red-500/15 text-red-500" : "bg-gray-500/15 text-gray-400",
      onClick: data.reports.pending > 0 ? () => navigate("/admin/moderation") : undefined,
      badge: data.reports.pending > 0 ? { label: "Action needed", variant: "destructive" as const } : undefined },
    { icon: Eye,           label: "Total Views",      value: data.reels.totalViews,
      sub: "Across all reels", color: "bg-amber-500/15 text-amber-500" },
  ];

  const quickActions = [
    { icon: Send,        label: "Broadcast",   desc: "Message all users",   path: "/admin/broadcast",        color: "text-blue-500 bg-blue-500/10" },
    { icon: Flag,        label: "Moderation",  desc: "Review reports",      path: "/admin/moderation",       color: "text-red-500 bg-red-500/10",      badge: data.reports.pending },
    { icon: MapPin,      label: "Spots",       desc: "Manage 36K+ spots",   path: "/admin/spots-overview",   color: "text-emerald-500 bg-emerald-500/10", badge: data.spots.claims.pending },
    { icon: Calendar,    label: "Programme",   desc: "Event planning",      path: "/admin/programme",        color: "text-orange-500 bg-orange-500/10" },
    { icon: Film,        label: "Reels",       desc: "Manage videos",       path: "/admin/reels",            color: "text-purple-500 bg-purple-500/10" },
    { icon: BarChart3,   label: "Analytics",   desc: "View trends",         path: "/admin/analytics",        color: "text-cyan-500 bg-cyan-500/10" },
    { icon: Users,       label: "Users",       desc: "Manage accounts",     path: "/admin/users",            color: "text-blue-500 bg-blue-500/10" },
    { icon: Package,     label: "Products",    desc: "Shop inventory",      path: "/admin/products",         color: "text-teal-500 bg-teal-500/10" },
    { icon: Shield,      label: "Security",    desc: "Platform safety",     path: "/admin/security-center",  color: "text-slate-500 bg-slate-500/10" },
    { icon: Layers,      label: "All Tools",   desc: "Scanner, Spotlight…", path: "/admin/tools",            color: "text-violet-500 bg-violet-500/10" },
  ];

  const systemHealth = [
    { label: "API",      ok: true },
    { label: "Events",   ok: data.events.active >= 0 },
    { label: "Spots",    ok: data.spots.osm > 0 },
    { label: "Payments", ok: true },
    { label: "Content",  ok: data.reports.pending < 20 },
  ];

  return (
    <div className="space-y-5 pb-8">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Urban Culture Hub · last updated {format(lastRefresh, "HH:mm:ss")}
          </p>
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
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40")} />
            {autoRefresh ? "Live" : "Paused"}
          </button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={refresh} disabled={isFetching}>
            <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Attention Banner */}
      {totalAttention > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-bold text-foreground">Needs Your Attention</span>
            <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600">{totalAttention} items</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.reports.pending > 0 && (
              <button onClick={() => navigate("/admin/moderation")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/25 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors">
                <Flag className="w-3.5 h-3.5" />{data.reports.pending} reports
              </button>
            )}
            {data.spots.claims.pending > 0 && (
              <button onClick={() => navigate("/admin/spots-overview")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                <MapPin className="w-3.5 h-3.5" />{data.spots.claims.pending} spot claims
              </button>
            )}
            {data.bookings.pending > 0 && (
              <button onClick={() => navigate("/admin/service-bookings")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-500/10 border border-pink-500/25 text-xs font-semibold text-pink-600 dark:text-pink-400 hover:bg-pink-500/20 transition-colors">
                <BookOpen className="w-3.5 h-3.5" />{data.bookings.pending} booking requests
              </button>
            )}
            {pendingEvents.length > 0 && (
              <button onClick={() => navigate("/admin/events")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/25 text-xs font-semibold text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 transition-colors">
                <Calendar className="w-3.5 h-3.5" />{pendingEvents.length} events to approve
              </button>
            )}
            {pendingLocations.length > 0 && (
              <button onClick={() => navigate("/admin/spots-overview")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/25 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition-colors">
                <MapPin className="w-3.5 h-3.5" />{pendingLocations.length} locations pending
              </button>
            )}
          </div>
        </div>
      )}

      {/* System Health */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">System</span>
        {systemHealth.map(s => (
          <div key={s.label} className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
            s.ok ? "bg-emerald-500/8 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                 : "bg-red-500/8 border-red-500/20 text-red-600 dark:text-red-400"
          )}>
            {s.ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
            {s.label}
          </div>
        ))}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-blue-500/8 border-blue-500/20 text-blue-600 dark:text-blue-400">
          <Radio className="w-3 h-3" />{data.events.active} active events
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {/* AI Tools Panel */}
      <div className="rounded-2xl overflow-hidden border border-purple-500/30 bg-gradient-to-br from-purple-950/60 via-indigo-950/40 to-[#0d0820]/80 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-bold text-white">AI Tools</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-600/30 text-purple-300 border border-purple-600/30 font-medium">Quick Access</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: Wand2,    label: "AI Studio",   desc: "Generate content, images & captions", path: "/admin/ai-studio",   gradient: "from-violet-600 to-purple-700" },
            { icon: Volume2,  label: "ElevenLabs",  desc: "Text-to-speech & voice cloning",      path: "/admin/elevenlabs",  gradient: "from-indigo-600 to-violet-700" },
            { icon: Sparkles, label: "AI Access",   desc: "Manage premium AI for users",         path: "/admin/ai-access",   gradient: "from-purple-600 to-pink-700" },
          ].map(t => (
            <button key={t.path} onClick={() => navigate(t.path)}
              className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/50 hover:bg-white/10 transition-all duration-200 text-left group">
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${t.gradient} flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform`}>
                <t.icon className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white leading-tight">{t.label}</p>
                <p className="text-[11px] text-purple-300/80 mt-0.5 leading-tight">{t.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Two-Column */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Live Activity Feed */}
        <div className="lg:col-span-3 rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border/50">
            <h2 className="font-bold text-sm text-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />Live Activity Feed
            </h2>
            <span className="text-[10px] text-muted-foreground">Auto-refreshes every 30s</span>
          </div>
          <div className="px-4 py-1 divide-y divide-border/30">
            {data.recentActivity.length === 0 ? (
              <div className="py-8 text-center">
                <Activity className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No activity yet</p>
              </div>
            ) : data.recentActivity.map(item => <ActivityItem key={item.id} item={item} />)}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card">
          <div className="px-4 pt-4 pb-3 border-b border-border/50">
            <h2 className="font-bold text-sm text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />Quick Actions
            </h2>
          </div>
          <div className="p-3 grid grid-cols-2 gap-2">
            {quickActions.map(a => (
              <button key={a.label} onClick={() => navigate(a.path)}
                className="relative flex flex-col items-start gap-1.5 p-3 rounded-xl border border-border bg-card hover:bg-accent hover:border-border/80 transition-all duration-150 text-left">
                {a.badge ? (
                  <div className="absolute top-2 right-2 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {a.badge}
                  </div>
                ) : null}
                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", a.color)}>
                  <a.icon className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="font-bold text-xs text-foreground leading-tight">{a.label}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{a.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recent Signups */}
        <div className="rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border/50">
            <h2 className="font-bold text-sm text-foreground flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-blue-500" />Recent Signups
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/users")} className="text-xs h-7">
              View all <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
          <div className="px-4 py-2 space-y-0.5">
            {data.recentSignups.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No recent signups</p>
            ) : data.recentSignups.map(u => (
              <div key={u.id} className="flex items-center gap-3 py-2 hover:bg-muted/30 rounded-xl px-1 transition-colors">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0 border border-border/50">
                  {u.profilePicture
                    ? <img src={u.profilePicture} alt="" className="w-full h-full object-cover" />
                    : <span className="text-xs font-bold text-muted-foreground">{u.displayName[0]?.toUpperCase()}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{u.displayName}</p>
                  <p className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}</p>
                </div>
                {u.role !== "user" && <Badge variant="outline" className="text-[10px] capitalize shrink-0">{u.role}</Badge>}
              </div>
            ))}
          </div>
        </div>

        {/* Recent Reports */}
        <div className="rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border/50">
            <h2 className="font-bold text-sm text-foreground flex items-center gap-2">
              <Flag className="w-4 h-4 text-red-500" />Recent Reports
              {data.reports.pending > 0 && <Badge variant="destructive" className="text-[10px] h-4 px-1">{data.reports.pending}</Badge>}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/moderation")} className="text-xs h-7">
              Review <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
          <div className="px-4 py-2 space-y-0.5">
            {data.recentFlags.length === 0 ? (
              <div className="py-6 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500/40 mx-auto mb-1.5" />
                <p className="text-sm text-muted-foreground">No reports — all clear</p>
              </div>
            ) : data.recentFlags.map(f => (
              <div key={f.id} className="flex items-start gap-3 py-2 hover:bg-muted/30 rounded-xl px-1 transition-colors">
                <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                  <Flag className="w-3.5 h-3.5 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] capitalize h-4 px-1">{f.contentType}</Badge>
                    <Badge variant={f.status === "pending" ? "destructive" : "secondary"} className="text-[10px] h-4 px-1">{f.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{f.reason}</p>
                  <p className="text-[10px] text-muted-foreground/60">{formatDistanceToNow(new Date(f.createdAt), { addSuffix: true })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
