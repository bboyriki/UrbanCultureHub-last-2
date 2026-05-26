import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import FixPromptPanel from "./FixPromptPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldAlert, ShieldCheck, ShieldX, AlertTriangle, Info,
  RefreshCw, ArrowRight, CheckCircle2, Clock, Zap, Bot,
  Lock, Activity, Database, Key, Globe,
  Loader2, Sparkles, BarChart2, AlertOctagon, CheckCheck,
  XCircle, MinusCircle, Users, FileWarning,
  History, Shield, Radio, Ban,
  CircleDot, Terminal,
  MousePointerClick, Waves, Network, TriangleAlert,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface SafetyIssue {
  id: string;
  severity: "critical" | "warning" | "info";
  category: string;
  title: string;
  description: string;
  count?: number;
  action?: string;
  actionLabel?: string;
}

interface SafetyReport {
  score: number;
  issues: SafetyIssue[];
  generatedAt: string;
}

interface ProtectionHeader { name: string; status: "active" | "removed" | "partial"; detail: string }
interface FirewallRule { name: string; limit: string; scope: string; status: "active" | "disabled" }
interface ProtectionStatus {
  score: number;
  headers: ProtectionHeader[];
  firewallRules: FirewallRule[];
  sessionSecurity: { httpOnly: boolean; sameSite: string; secure: boolean; maxAgeHours: number; rolling: boolean };
  authentication: { provider: string; localPasswordStorage: boolean; tokenExpiry: string; sessionBacked: boolean; adminRoleCheck: boolean; firebaseJwtVerification: boolean; doubleAuthCheck: boolean };
  environmentChecklist: Array<{ name: string; present: boolean; critical: boolean }>;
  dataProtection: Array<{ item: string; status: "safe" | "active" | "warning"; detail: string }>;
  suspiciousActivity: Array<{ visitorId: string; requestCount: number; paths: string[] }>;
  trafficStats: { totalRequestsLastHour: number; uniqueVisitorsLastHour: number; totalRequestsLast24h: number };
  recentAdminActivity: Array<{ adminName: string; actionType: string; targetType: string; details: string; createdAt: string }>;
  pendingIncidents: { contentFlags: number; deletionRequests: number; contactMessages: number };
  databaseHealth: { connected: boolean; responseMs: number; activeConnections: number };
  generatedAt: string;
}

interface LiveSecurityEvent {
  id: number;
  type: string;
  severity: string;
  ip: string | null;
  path: string | null;
  message: string;
  createdAt: string;
  resolved: boolean;
}

interface LiveFeed {
  recentEvents: LiveSecurityEvent[];
  trafficLast5Min: number;
  trafficLastMinute: number;
  activeSessions: number;
  failedLoginsLastHour: number;
  successfulLoginsLastHour: number;
  lockedIps: number;
  blockedIpCount: number;
  severityCounts: { critical: number; high: number; medium: number; low: number };
  hotPaths: Array<{ path: string; count: number }>;
  timestamp: string;
}

interface IpBlock {
  id: number;
  ip: string;
  reason: string;
  permanent: boolean;
  expiresAt: string | null;
  createdAt: string;
}

interface LockedOutIp {
  ip: string;
  remaining: number;
  failureCount: number;
}

interface SecurityEventLog {
  events: LiveSecurityEvent[];
  total: number;
  limit: number;
  offset: number;
}

interface AdminSafetyMonitorProps {
  onNavigate?: (section: string) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const severityOrder = { critical: 0, warning: 1, info: 2 };

const severityConfig = {
  critical: { bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-900/50", badge: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400" },
  warning: { bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-900/50", badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400" },
  info: { bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-900/50", badge: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400" },
};

const eventSeverityColors: Record<string, string> = {
  critical: "text-red-500",
  high: "text-orange-500",
  medium: "text-amber-500",
  low: "text-blue-400",
};

const eventSeverityBg: Record<string, string> = {
  critical: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/40",
  high: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900/40",
  medium: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/40",
  low: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/40",
};

function ScoreRing({ score, size = 140 }: { score: number; size?: number }) {
  const radius = size === 140 ? 52 : 36;
  const circ = 2 * Math.PI * radius;
  const filled = (score / 100) * circ;
  const color = score >= 80 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
  const center = size / 2;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="currentColor" strokeWidth={size === 140 ? 10 : 7} className="text-muted/20" />
        <circle cx={center} cy={center} r={radius} fill="none" stroke={color} strokeWidth={size === 140 ? 10 : 7}
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.8s ease" }} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`font-bold tabular-nums ${size === 140 ? "text-3xl" : "text-xl"}`} style={{ color }}>{score}</span>
        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Score</span>
      </div>
    </div>
  );
}

function SeverityIcon({ severity }: { severity: SafetyIssue["severity"] }) {
  if (severity === "critical") return <ShieldX className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />;
  if (severity === "warning") return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />;
  return <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />;
}

function StatusChip({ ok, partial, label }: { ok?: boolean; partial?: boolean; label: string }) {
  if (partial) return <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">{label}</span>;
  if (ok) return <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">{label}</span>;
  return <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400">{label}</span>;
}

function formatActionType(at: string) {
  return at.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function timeAgo(isoStr: string) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function PulseDot({ color = "bg-green-500" }: { color?: string }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-60`} />
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${color}`} />
    </span>
  );
}

function EventTypeBadge({ type }: { type: string }) {
  const label = type.replace(/_/g, " ").toLowerCase();
  const colors: Record<string, string> = {
    rate_limit_exceeded: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400",
    auth_failure: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400",
    ip_blocked: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400",
    ip_unblocked: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400",
    suspicious_request: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400",
    admin_action: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400",
    login_success: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400",
  };
  return (
    <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${colors[type] ?? "bg-muted text-muted-foreground"}`}>
      {label}
    </span>
  );
}

// ── Live Tab Component ─────────────────────────────────────────────────────────

function LiveTab({ liveFeed, isLoading, lastUpdated }: {
  liveFeed: LiveFeed | null | undefined;
  isLoading: boolean;
  lastUpdated: Date | null;
}) {
  const [tickCount, setTickCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTickCount(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (isLoading && !liveFeed) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const feed = liveFeed;
  const hasCritical = (feed?.severityCounts.critical ?? 0) > 0;
  const hasHigh = (feed?.severityCounts.high ?? 0) > 0;

  return (
    <div className="space-y-4">
      {/* Live status bar */}
      <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${hasCritical ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50" : hasHigh ? "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900/40" : "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/40"}`}>
        <div className="flex items-center gap-2.5">
          <PulseDot color={hasCritical ? "bg-red-500" : hasHigh ? "bg-orange-500" : "bg-green-500"} />
          <span className="text-xs font-bold uppercase tracking-wider">
            {hasCritical ? "CRITICAL ALERT" : hasHigh ? "HIGH ALERT" : "LIVE — ALL CLEAR"}
          </span>
        </div>
        {lastUpdated && (
          <span className="text-[10px] text-muted-foreground">
            Updated {timeAgo(lastUpdated.toISOString())}
          </span>
        )}
      </div>

      {/* Quick stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Active Sessions",
            value: feed?.activeSessions ?? 0,
            icon: <Users className="h-4 w-4 text-blue-500" />,
            color: "text-blue-600 dark:text-blue-400",
          },
          {
            label: "Req / Last Min",
            value: feed?.trafficLastMinute ?? 0,
            icon: <Waves className="h-4 w-4 text-green-500" />,
            color: "text-green-600 dark:text-green-400",
          },
          {
            label: "Failed Logins",
            value: feed?.failedLoginsLastHour ?? 0,
            icon: <Ban className="h-4 w-4 text-amber-500" />,
            color: (feed?.failedLoginsLastHour ?? 0) > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
            alert: (feed?.failedLoginsLastHour ?? 0) > 5,
          },
          {
            label: "Blocked IPs",
            value: feed?.blockedIpCount ?? 0,
            icon: <Network className="h-4 w-4 text-purple-500" />,
            color: (feed?.blockedIpCount ?? 0) > 0 ? "text-purple-600 dark:text-purple-400" : "text-muted-foreground",
          },
        ].map(stat => (
          <Card key={stat.label} className={stat.alert ? "border-amber-200 dark:border-amber-900/50" : ""}>
            <CardContent className="pt-3 pb-3">
              <div className="flex items-start justify-between gap-1">
                {stat.icon}
                {stat.alert && <PulseDot color="bg-amber-500" />}
              </div>
              <div className={`text-2xl font-bold tabular-nums mt-1 ${stat.color}`}>{stat.value}</div>
              <div className="text-[10px] text-muted-foreground">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Severity breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 text-amber-500" />
            Security Events — Last Hour
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2">
            {([
              { key: "critical", label: "Critical", color: "text-red-500", bg: "bg-red-100 dark:bg-red-900/30" },
              { key: "high", label: "High", color: "text-orange-500", bg: "bg-orange-100 dark:bg-orange-900/30" },
              { key: "medium", label: "Medium", color: "text-amber-500", bg: "bg-amber-100 dark:bg-amber-900/30" },
              { key: "low", label: "Low", color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-900/30" },
            ] as const).map(s => {
              const count = feed?.severityCounts[s.key] ?? 0;
              return (
                <div key={s.key} className={`rounded-lg p-2.5 text-center ${s.bg}`}>
                  <div className={`text-xl font-bold tabular-nums ${count > 0 ? s.color : "text-muted-foreground"}`}>{count}</div>
                  <div className="text-[10px] text-muted-foreground">{s.label}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Hot paths */}
      {(feed?.hotPaths?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MousePointerClick className="h-4 w-4" /> Hot Paths — Last 5 Min
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {feed!.hotPaths.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="font-mono text-muted-foreground truncate max-w-[200px]">{p.path}</span>
                <span className="font-bold tabular-nums text-foreground">{p.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Live event stream */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            Live Security Feed
            <PulseDot color="bg-primary" />
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!feed?.recentEvents?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <CircleDot className="h-8 w-8 mx-auto mb-2 opacity-30 animate-pulse" />
              <p className="text-xs">No security events recorded yet.</p>
            </div>
          ) : (
            <ScrollArea className="h-[320px]">
              <div className="divide-y divide-border/30">
                {feed.recentEvents.map((evt) => (
                  <div key={evt.id} className={`px-4 py-2.5 flex items-start gap-3 ${evt.resolved ? "opacity-50" : ""}`}>
                    <span className={`text-[9px] mt-0.5 font-bold uppercase w-12 shrink-0 tabular-nums ${eventSeverityColors[evt.severity] ?? "text-muted-foreground"}`}>
                      {evt.severity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <EventTypeBadge type={evt.type} />
                        {evt.ip && <span className="text-[10px] font-mono text-muted-foreground">{evt.ip}</span>}
                        {evt.path && <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[120px]">{evt.path}</span>}
                      </div>
                      <p className="text-xs text-foreground mt-0.5 leading-snug">{evt.message}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">{timeAgo(evt.createdAt)}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Threats Tab Component ──────────────────────────────────────────────────────

function ThreatsTab({ onNavigate }: { onNavigate?: (s: string) => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [blockIp, setBlockIp] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [blockPermanent, setBlockPermanent] = useState(false);
  const [blockHours, setBlockHours] = useState("24");
  const [eventFilter, setEventFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");

  const { data: blockedIps, isLoading: loadingBlocked, refetch: refetchBlocked } = useQuery<IpBlock[]>({
    queryKey: ["/api/admin/security/blocked-ips"],
    refetchInterval: 30_000,
  });

  const { data: lockoutIps, isLoading: loadingLockout, refetch: refetchLockout } = useQuery<LockedOutIp[]>({
    queryKey: ["/api/admin/security/lockout-ips"],
    refetchInterval: 10_000,
  });

  const unlockIpMutation = useMutation({
    mutationFn: (ip: string) => apiRequest(`/api/admin/security/lockout-ips/${encodeURIComponent(ip)}`, "DELETE").then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Lockout cleared", description: "IP can now log in again." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/security/lockout-ips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/security/live"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to clear lockout.", variant: "destructive" }),
  });

  const clearAllLockoutsMutation = useMutation({
    mutationFn: () => apiRequest("/api/admin/security/lockout-ips", "DELETE").then(r => r.json()),
    onSuccess: () => {
      toast({ title: "All lockouts cleared" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/security/lockout-ips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/security/live"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to clear lockouts.", variant: "destructive" }),
  });

  const { data: eventLog, isLoading: loadingEvents, refetch: refetchEvents } = useQuery<SecurityEventLog>({
    queryKey: ["/api/admin/security/events", eventFilter, severityFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "50", offset: "0" });
      if (eventFilter !== "all") params.set("type", eventFilter);
      if (severityFilter !== "all") params.set("severity", severityFilter);
      const r = await apiRequest(`/api/admin/security/events?${params}`, "GET");
      return r.json();
    },
    refetchInterval: 15_000,
  });

  const blockMutation = useMutation({
    mutationFn: () => apiRequest("/api/admin/security/block-ip", "POST", {
      ip: blockIp.trim(),
      reason: blockReason.trim(),
      permanent: blockPermanent,
      durationHours: blockPermanent ? undefined : parseInt(blockHours),
    }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "IP blocked", description: `${blockIp} has been blocked.` });
      setBlockIp(""); setBlockReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/security/blocked-ips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/security/live"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to block IP.", variant: "destructive" }),
  });

  const unblockMutation = useMutation({
    mutationFn: (ip: string) => apiRequest(`/api/admin/security/block-ip/${encodeURIComponent(ip)}`, "DELETE").then(r => r.json()),
    onSuccess: () => {
      toast({ title: "IP unblocked" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/security/blocked-ips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/security/live"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to unblock IP.", variant: "destructive" }),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/admin/security/events/${id}/resolve`, "PATCH").then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/security/events"] });
    },
  });

  return (
    <div className="space-y-4">
      {/* Block IP form */}
      <Card className="border-red-200 dark:border-red-900/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Ban className="h-4 w-4 text-red-500" /> Block IP Address
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              placeholder="IP address (e.g. 1.2.3.4)"
              value={blockIp}
              onChange={e => setBlockIp(e.target.value)}
              className="text-sm font-mono"
              data-testid="input-block-ip"
            />
            <Input
              placeholder="Reason (e.g. brute force, spam)"
              value={blockReason}
              onChange={e => setBlockReason(e.target.value)}
              className="text-sm"
              data-testid="input-block-reason"
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="permanent-toggle"
                checked={blockPermanent}
                onCheckedChange={setBlockPermanent}
                data-testid="switch-permanent-block"
              />
              <Label htmlFor="permanent-toggle" className="text-xs cursor-pointer">Permanent</Label>
            </div>
            {!blockPermanent && (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Duration:</Label>
                <Select value={blockHours} onValueChange={setBlockHours}>
                  <SelectTrigger className="w-28 h-7 text-xs" data-testid="select-block-duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 hour</SelectItem>
                    <SelectItem value="6">6 hours</SelectItem>
                    <SelectItem value="24">24 hours</SelectItem>
                    <SelectItem value="168">7 days</SelectItem>
                    <SelectItem value="720">30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button
              size="sm"
              variant="destructive"
              className="gap-1.5 ml-auto"
              onClick={() => blockMutation.mutate()}
              disabled={!blockIp.trim() || !blockReason.trim() || blockMutation.isPending}
              data-testid="button-block-ip"
            >
              {blockMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
              Block IP
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Login Lockouts (in-memory rate-limit lockouts) */}
      <Card className="border-amber-200 dark:border-amber-900/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lock className="h-4 w-4 text-amber-500" />
              Login Lockouts
              {lockoutIps && lockoutIps.length > 0 && (
                <Badge className="text-[10px] h-4 px-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">{lockoutIps.length}</Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-1">
              {lockoutIps && lockoutIps.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-amber-600 hover:text-amber-700 gap-1"
                  onClick={() => clearAllLockoutsMutation.mutate()}
                  disabled={clearAllLockoutsMutation.isPending}
                  data-testid="button-clear-all-lockouts"
                >
                  {clearAllLockoutsMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                  Clear All
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => refetchLockout()} data-testid="button-refresh-lockouts">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-[11px] text-muted-foreground mb-3">
            IPs temporarily locked after too many failed login attempts. Admin accounts (<span className="font-mono">oudaialmouti@gmail.com</span>, <span className="font-mono">rmaru2889@gmail.com</span>) are permanently exempt and can never be locked.
          </p>
          {loadingLockout ? (
            <div className="space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-10 rounded" />)}</div>
          ) : !lockoutIps?.length ? (
            <div className="text-center py-4 text-muted-foreground">
              <CheckCircle2 className="h-7 w-7 mx-auto mb-1.5 text-green-500 opacity-60" />
              <p className="text-xs">No IPs currently locked out.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lockoutIps.map(item => (
                <div key={item.ip} className="flex items-center justify-between gap-2 rounded-lg border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2" data-testid={`lockout-ip-${item.ip}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-semibold">{item.ip}</span>
                      <Badge variant="outline" className="text-[9px] h-4 px-1 border-amber-400/50 text-amber-600 dark:text-amber-400">
                        {item.failureCount} failures
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Unlocks in {item.remaining >= 60 ? `${Math.ceil(item.remaining / 60)}m` : `${item.remaining}s`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-green-600 shrink-0"
                    onClick={() => unlockIpMutation.mutate(item.ip)}
                    disabled={unlockIpMutation.isPending}
                    title="Unlock this IP"
                    data-testid={`button-unlock-${item.ip}`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Currently blocked IPs */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Network className="h-4 w-4 text-purple-500" />
              Blocked IPs
              {blockedIps && blockedIps.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1">{blockedIps.length}</Badge>
              )}
            </CardTitle>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => refetchBlocked()} data-testid="button-refresh-blocked">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingBlocked ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 rounded" />)}</div>
          ) : !blockedIps?.length ? (
            <div className="text-center py-6 text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500 opacity-60" />
              <p className="text-xs">No IPs currently blocked.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {blockedIps.map(block => (
                <div key={block.id} className="flex items-start justify-between gap-2 rounded-lg border border-border/50 px-3 py-2" data-testid={`blocked-ip-${block.id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-semibold">{block.ip}</span>
                      {block.permanent
                        ? <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400">Permanent</span>
                        : block.expiresAt
                          ? <span className="text-[9px] text-muted-foreground">Expires {timeAgo(block.expiresAt)}</span>
                          : null
                      }
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{block.reason}</p>
                    <p className="text-[10px] text-muted-foreground/60">Blocked {timeAgo(block.createdAt)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-green-600 shrink-0"
                    onClick={() => unblockMutation.mutate(block.ip)}
                    disabled={unblockMutation.isPending}
                    title="Unblock IP"
                    data-testid={`button-unblock-${block.id}`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security event log with filters */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              Security Event Log
              {eventLog && <span className="text-xs text-muted-foreground font-normal">({eventLog.total} total)</span>}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="h-7 text-xs w-24" data-testid="select-severity-filter">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={eventFilter} onValueChange={setEventFilter}>
                <SelectTrigger className="h-7 text-xs w-32" data-testid="select-event-filter">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="auth_failure">Auth Failure</SelectItem>
                  <SelectItem value="rate_limit_exceeded">Rate Limit</SelectItem>
                  <SelectItem value="ip_blocked">IP Blocked</SelectItem>
                  <SelectItem value="suspicious_request">Suspicious</SelectItem>
                  <SelectItem value="admin_action">Admin Action</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => refetchEvents()} data-testid="button-refresh-events">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingEvents ? (
            <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 rounded" />)}</div>
          ) : !eventLog?.events?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <CircleDot className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">No events match your filters.</p>
            </div>
          ) : (
            <ScrollArea className="h-[380px]">
              <div className="divide-y divide-border/30">
                {eventLog.events.map(evt => (
                  <div key={evt.id} className={`px-4 py-2.5 flex items-start gap-3 ${evt.resolved ? "opacity-40" : ""}`} data-testid={`event-row-${evt.id}`}>
                    <div className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${
                      evt.severity === "critical" ? "bg-red-500" :
                      evt.severity === "high" ? "bg-orange-500" :
                      evt.severity === "medium" ? "bg-amber-500" : "bg-blue-400"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <EventTypeBadge type={evt.type} />
                        {evt.ip && <span className="text-[10px] font-mono text-muted-foreground">{evt.ip}</span>}
                        {evt.path && <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[100px]">{evt.path}</span>}
                      </div>
                      <p className="text-xs text-foreground/80 mt-0.5 leading-snug">{evt.message}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] text-muted-foreground tabular-nums">{timeAgo(evt.createdAt)}</span>
                      {!evt.resolved && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-green-600"
                          onClick={() => resolveMutation.mutate(evt.id)}
                          title="Mark resolved"
                          data-testid={`button-resolve-event-${evt.id}`}
                        >
                          <CheckCheck className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function AdminSafetyMonitor({ onNavigate }: AdminSafetyMonitorProps) {
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiTokens, setAiTokens] = useState<{ input: number; output: number } | null>(null);
  const [liveLastUpdated, setLiveLastUpdated] = useState<Date | null>(null);

  // ── Health report query ──
  const {
    data: report, isLoading: loadingReport, isFetching: fetchingReport,
    refetch: refetchReport, dataUpdatedAt,
  } = useQuery<SafetyReport | null>({
    queryKey: ["/api/admin/safety/report"],
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 2,
  });

  // ── Protection status query ──
  const {
    data: protection, isLoading: loadingProtection,
    refetch: refetchProtection,
  } = useQuery<ProtectionStatus | null>({
    queryKey: ["/api/admin/protection/status"],
    refetchInterval: 120_000,
    staleTime: 60_000,
    retry: 2,
  });

  // ── Live feed query — fast polling ──
  const {
    data: liveFeed, isLoading: loadingLive,
    refetch: refetchLive,
  } = useQuery<LiveFeed | null>({
    queryKey: ["/api/admin/security/live"],
    refetchInterval: 5_000,
    staleTime: 2_000,
    retry: 1,
  });

  useEffect(() => {
    if (liveFeed) setLiveLastUpdated(new Date());
  }, [liveFeed]);

  // ── AI Analyze mutation ──
  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("/api/admin/safety/analyze", "POST", {
        issues: report?.issues ?? [],
        score: report?.score ?? 100,
      });
      return r.json();
    },
    onSuccess: (data) => {
      setAiAnalysis(data.analysis);
      setAiError(null);
      setAiTokens({ input: data.inputTokens, output: data.outputTokens });
    },
    onError: (err: any) => {
      const msg = err?.message ?? String(err);
      const status = err?.status;
      if (status === 401) setAiError("Not authenticated. Please refresh the page and try again.");
      else if (msg.includes("500")) setAiError("AI service error. The Anthropic connection may be temporarily unavailable.");
      else setAiError(`Failed to contact AI: ${msg.substring(0, 120)}`);
    },
  });

  const sorted = [...(report?.issues ?? [])].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  const criticals = sorted.filter(i => i.severity === "critical").length;
  const warnings = sorted.filter(i => i.severity === "warning").length;
  const infos = sorted.filter(i => i.severity === "info").length;
  const lastChecked = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : null;

  const safetyFixIssues = useMemo(() => {
    const issues: import("./FixPromptPanel").FixIssue[] = [];
    (report?.issues ?? [])
      .filter(i => i.severity !== "info")
      .forEach(i => {
        issues.push({
          severity: i.severity === "critical" ? "critical" : "warning",
          title: i.title,
          detail: i.description,
          category: i.category,
          recommendation: i.action ?? undefined,
        });
      });
    (protection?.headers ?? [])
      .filter(h => h.status !== "active")
      .forEach(h => {
        issues.push({
          severity: "high",
          title: `Security header missing or partial: ${h.name}`,
          detail: h.detail,
          category: "HTTP Security Headers",
          recommendation: `Add or fix the ${h.name} header in your Express middleware`,
        });
      });
    (protection?.environmentChecklist ?? [])
      .filter(e => !e.present && e.critical)
      .forEach(e => {
        issues.push({
          severity: "critical",
          title: `Missing critical environment variable: ${e.name}`,
          detail: `The environment variable "${e.name}" is not set but is required for the application to operate securely.`,
          category: "Environment",
          recommendation: "Add this variable to your Replit secrets / environment variables",
        });
      });
    return issues;
  }, [report, protection]);

  const liveCritical = (liveFeed?.severityCounts.critical ?? 0) + (liveFeed?.severityCounts.high ?? 0);

  return (
    <div className="space-y-4" data-testid="safety-monitor">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" /> Advanced Security Center
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time threat detection, live feed, IP blocking, AI analysis & full server audit.
          </p>
        </div>
        <Button variant="outline" size="sm"
          onClick={() => { refetchReport(); refetchProtection(); refetchLive(); }}
          disabled={fetchingReport}
          className="gap-1.5 shrink-0"
          data-testid="button-refresh-safety"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${fetchingReport ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <Tabs defaultValue="live">
        <TabsList className="w-full grid grid-cols-5">
          <TabsTrigger value="live" className="gap-1 text-xs" data-testid="tab-live">
            <Radio className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Live</span>
            {liveCritical > 0 && (
              <span className="ml-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center">{liveCritical}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="health" className="gap-1 text-xs" data-testid="tab-health">
            <Activity className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Health</span>
            {criticals > 0 && <span className="ml-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center">{criticals}</span>}
          </TabsTrigger>
          <TabsTrigger value="threats" className="gap-1 text-xs" data-testid="tab-threats">
            <Ban className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Threats</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-1 text-xs" data-testid="tab-ai-advisor">
            <Bot className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">AI</span>
          </TabsTrigger>
          <TabsTrigger value="shield" className="gap-1 text-xs" data-testid="tab-shield">
            <Lock className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Shield</span>
          </TabsTrigger>
        </TabsList>

        {/* ── LIVE TAB ──────────────────────────────────────────────────────── */}
        <TabsContent value="live" className="mt-4">
          <LiveTab liveFeed={liveFeed} isLoading={loadingLive} lastUpdated={liveLastUpdated} />
        </TabsContent>

        {/* ── HEALTH TAB ─────────────────────────────────────────────────────── */}
        <TabsContent value="health" className="space-y-4 mt-4">
          {loadingReport ? (
            <div className="space-y-3"><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-24 rounded-xl" /></div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className={`border ${!report || report.score >= 80 ? "border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-950/20" : report.score >= 50 ? "border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20" : "border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20"}`}>
                  <CardContent className="pt-5 flex flex-col items-center gap-3">
                    <ScoreRing score={report?.score ?? 100} />
                    <div className="text-center">
                      <p className="font-semibold text-sm">
                        {!report || report.score >= 80 ? "App is Healthy" : report.score >= 50 ? "Needs Attention" : "Critical Issues Found"}
                      </p>
                      {lastChecked && <p className="text-xs text-muted-foreground flex items-center gap-1 justify-center mt-0.5"><Clock className="h-3 w-3" /> Checked {lastChecked}</p>}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Issue Breakdown</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { label: "Critical", count: criticals, color: "text-red-500", icon: <ShieldX className="h-4 w-4 text-red-500" /> },
                      { label: "Warning", count: warnings, color: "text-amber-500", icon: <AlertTriangle className="h-4 w-4 text-amber-500" /> },
                      { label: "Info", count: infos, color: "text-blue-500", icon: <Info className="h-4 w-4 text-blue-500" /> },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">{item.icon}<span className="text-sm font-medium">{item.label}</span></div>
                        <span className={`text-lg font-bold tabular-nums ${item.count > 0 ? item.color : "text-muted-foreground"}`}>{item.count}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {sorted.length === 0 ? (
                <Card className="border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-950/20">
                  <CardContent className="pt-6 flex flex-col items-center gap-3 pb-6">
                    <ShieldCheck className="h-12 w-12 text-green-500" />
                    <div className="text-center">
                      <p className="font-semibold text-green-700 dark:text-green-400">No Issues Detected</p>
                      <p className="text-sm text-muted-foreground mt-1">All systems running normally.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-green-600 dark:text-green-500 justify-center">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Events · Content · Privacy · Traffic · Data Integrity
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2.5">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Zap className="h-3.5 w-3.5" /> Active Issues ({sorted.length})
                  </h3>
                  {sorted.map((issue) => {
                    const cfg = severityConfig[issue.severity];
                    return (
                      <div key={issue.id} className={`rounded-lg border p-4 ${cfg.bg} ${cfg.border}`} data-testid={`issue-${issue.id}`}>
                        <div className="flex items-start gap-3">
                          <SeverityIcon severity={issue.severity} />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${cfg.badge}`}>{issue.severity}</span>
                              <span className="text-[11px] text-muted-foreground">{issue.category}</span>
                              {issue.count !== undefined && <Badge variant="secondary" className="text-[10px] h-4 px-1">{issue.count}</Badge>}
                            </div>
                            <p className="font-semibold text-sm leading-snug">{issue.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{issue.description}</p>
                          </div>
                          {issue.action && onNavigate && (
                            <Button size="sm" variant="outline" className="shrink-0 gap-1 text-xs h-7 px-2"
                              onClick={() => onNavigate(issue.action!)} data-testid={`button-fix-${issue.id}`}>
                              {issue.actionLabel ?? "Fix"} <ArrowRight className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <Card className="bg-muted/30">
                <CardContent className="pt-4 pb-4">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Monitored checks</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs text-muted-foreground">
                    {["Pending event approvals", "Flagged / reported content", "GDPR/AVG deletion requests", "Unresolved contact messages", "Orphaned data integrity", "Admin activity presence", "Traffic spike detection", "Zero-traffic alerts", "Auto-refresh every 60s"].map(item => (
                      <div key={item} className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />{item}</div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── THREATS TAB ───────────────────────────────────────────────────── */}
        <TabsContent value="threats" className="mt-4">
          <ThreatsTab onNavigate={onNavigate} />
        </TabsContent>

        {/* ── AI ADVISOR TAB ────────────────────────────────────────────────── */}
        <TabsContent value="ai" className="space-y-4 mt-4">
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Claude AI Security Advisor</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Deep analysis of every issue — root causes, risk levels, exact resolution steps, and preventive measures tailored to this app.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => { setAiError(null); analyzeMutation.mutate(); }}
                disabled={analyzeMutation.isPending || loadingReport}
                className="w-full gap-2"
                data-testid="button-ai-analyze"
              >
                {analyzeMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing with Claude…</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> {aiAnalysis ? "Re-Analyze Issues" : "Analyze Issues with AI"}</>
                )}
              </Button>
              {aiError && (
                <p className="text-xs text-destructive mt-2 flex items-start gap-1.5">
                  <AlertOctagon className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {aiError}
                </p>
              )}
              {aiTokens && !aiError && (
                <p className="text-[10px] text-muted-foreground mt-2 text-right">
                  Tokens used: {aiTokens.input.toLocaleString()} in · {aiTokens.output.toLocaleString()} out
                </p>
              )}
            </CardContent>
          </Card>

          {analyzeMutation.isPending && (
            <Card>
              <CardContent className="pt-5 space-y-2">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className={`h-4 rounded ${i === 0 ? "w-3/4" : i === 5 ? "w-1/2" : "w-full"}`} />)}
              </CardContent>
            </Card>
          )}

          {aiAnalysis && !analyzeMutation.isPending && (
            <Card className="border-primary/20 overflow-hidden">
              {/* Advisory header banner */}
              <div className="px-5 py-3.5 flex items-center justify-between gap-3 border-b border-border/60"
                style={{ background: "linear-gradient(135deg, hsl(var(--primary)/0.08) 0%, transparent 100%)" }}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold leading-none">AI Security Advisory Report</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Claude — {new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}</p>
                  </div>
                </div>
                {aiTokens && (
                  <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums hidden sm:block">
                    {aiTokens.output.toLocaleString()} tokens
                  </span>
                )}
              </div>

              {/* Report body — no inner scroll; page scrolls naturally */}
              <CardContent className="pt-5 pb-6">
                <div className="ai-report-body">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }) => (
                        <h1 className="text-base font-bold text-foreground mt-5 mb-2 pb-1.5 border-b border-border/40 first:mt-0">{children}</h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="text-sm font-bold text-foreground mt-5 mb-2 pb-1 border-b border-border/30 first:mt-0">{children}</h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-sm font-semibold text-foreground mt-4 mb-1.5 first:mt-0">{children}</h3>
                      ),
                      p: ({ children }) => (
                        <p className="text-sm text-foreground/90 leading-relaxed mb-3 last:mb-0">{children}</p>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-semibold text-foreground">{children}</strong>
                      ),
                      ul: ({ children }) => (
                        <ul className="mb-3 ml-3 space-y-1 list-none">{children}</ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="mb-3 ml-4 space-y-1 list-decimal">{children}</ol>
                      ),
                      li: ({ children, ordered, ...props }: any) =>
                        ordered ? (
                          <li className="text-sm text-foreground/90 leading-relaxed pl-0.5" {...props}>{children}</li>
                        ) : (
                          <li className="text-sm text-foreground/90 leading-relaxed flex items-start gap-2 list-none" {...props}>
                            <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0 flex-shrink-0" />
                            <span className="flex-1">{children}</span>
                          </li>
                        ),
                      code: ({ children }) => (
                        <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono text-foreground/90">{children}</code>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-2 border-primary/40 pl-3 my-3 text-sm text-muted-foreground italic">{children}</blockquote>
                      ),
                      hr: () => <hr className="border-border/40 my-4" />,
                    }}
                  >
                    {aiAnalysis}
                  </ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          )}

          {!aiAnalysis && !analyzeMutation.isPending && !aiError && (
            <div className="text-center py-12 text-muted-foreground">
              <Bot className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Click "Analyze Issues with AI" for a detailed security assessment.</p>
              <p className="text-xs mt-1">Works even when no issues are detected — Claude will confirm your security posture.</p>
            </div>
          )}
        </TabsContent>

        {/* ── SHIELD TAB ────────────────────────────────────────────────────── */}
        <TabsContent value="shield" className="space-y-4 mt-4">
          {loadingProtection ? (
            <div className="space-y-3">
              <Skeleton className="h-36 rounded-xl" />
              <Skeleton className="h-36 rounded-xl" />
              <Skeleton className="h-48 rounded-xl" />
            </div>
          ) : protection ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className={`sm:col-span-1 ${protection.score >= 80 ? "border-green-200 dark:border-green-900/50" : "border-amber-200 dark:border-amber-900/50"}`}>
                  <CardContent className="pt-5 flex flex-col items-center gap-2 pb-4">
                    <ScoreRing score={protection.score} size={96} />
                    <p className="text-xs font-semibold text-center">Protection Score</p>
                    <p className="text-[10px] text-muted-foreground text-center">
                      {protection.score >= 90 ? "Excellent" : protection.score >= 70 ? "Good" : protection.score >= 50 ? "Fair" : "Needs Work"}
                    </p>
                  </CardContent>
                </Card>
                <Card className="sm:col-span-2">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart2 className="h-4 w-4" />Live Traffic</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {[
                      { label: "Page views (last hour)", value: protection.trafficStats.totalRequestsLastHour.toLocaleString() },
                      { label: "Unique visitors (last hour)", value: protection.trafficStats.uniqueVisitorsLastHour.toLocaleString() },
                      { label: "Page views (last 24h)", value: protection.trafficStats.totalRequestsLast24h.toLocaleString() },
                      { label: "Suspicious visitors (> 50 req/h)", value: protection.suspiciousActivity.length, alert: protection.suspiciousActivity.length > 0 },
                    ].map(row => (
                      <div key={row.label} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground text-xs">{row.label}</span>
                        <span className={`font-bold tabular-nums text-sm ${(row as any).alert ? "text-red-500" : ""}`}>{row.value}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {(protection.pendingIncidents.contentFlags + protection.pendingIncidents.deletionRequests + protection.pendingIncidents.contactMessages) > 0 && (
                <Card className="border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <FileWarning className="h-4 w-4" /> Pending Security Incidents
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-3 gap-3 text-center">
                    {[
                      { label: "Content Flags", count: protection.pendingIncidents.contentFlags, action: "content-flags" },
                      { label: "GDPR Deletions", count: protection.pendingIncidents.deletionRequests, action: "gdpr" },
                      { label: "Contact Msgs", count: protection.pendingIncidents.contactMessages, action: "contact" },
                    ].map(item => (
                      <button key={item.label} onClick={() => onNavigate?.(item.action)}
                        className={`rounded-lg p-2.5 text-sm cursor-pointer transition-colors ${item.count > 0 ? "bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60" : "bg-muted/40"}`}>
                        <div className={`text-xl font-bold tabular-nums ${item.count > 0 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>{item.count}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{item.label}</div>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              )}

              {protection.suspiciousActivity.length > 0 && (
                <Card className="border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-red-700 dark:text-red-400">
                      <Users className="h-4 w-4" /> Suspicious Visitors (&gt; 50 req/hour)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {protection.suspiciousActivity.map((v, i) => (
                      <div key={i} className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-xs font-mono text-muted-foreground">{v.visitorId}</span>
                          <div className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[220px]">{v.paths.join(" · ")}</div>
                        </div>
                        <Badge variant="destructive" className="text-[10px] shrink-0">{v.requestCount} req</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card className={protection.databaseHealth.connected ? "border-green-200 dark:border-green-900/50" : "border-red-200 dark:border-red-900/50"}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Database className="h-4 w-4" />Database Health</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-3 text-center text-sm">
                  <div>
                    <div className="flex justify-center mb-1">
                      {protection.databaseHealth.connected
                        ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                        : <XCircle className="h-5 w-5 text-red-500" />}
                    </div>
                    <div className="text-[10px] text-muted-foreground">Connection</div>
                    <div className="font-semibold text-xs">{protection.databaseHealth.connected ? "Online" : "Offline"}</div>
                  </div>
                  <div>
                    <div className="font-bold text-lg tabular-nums">{protection.databaseHealth.responseMs}ms</div>
                    <div className="text-[10px] text-muted-foreground">Response Time</div>
                  </div>
                  <div>
                    <div className="font-bold text-lg tabular-nums">{protection.databaseHealth.activeConnections}</div>
                    <div className="text-[10px] text-muted-foreground">Active Conns</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Key className="h-4 w-4" />Environment Secrets</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {protection.environmentChecklist.map(sec => (
                      <div key={sec.name} className="flex items-center gap-2">
                        {sec.present
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                          : sec.critical
                            ? <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                            : <MinusCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                        <span className={`text-xs ${!sec.present && sec.critical ? "text-red-600 dark:text-red-400 font-semibold" : !sec.present ? "text-amber-600 dark:text-amber-400" : ""}`}>
                          {sec.name}
                        </span>
                        {sec.critical && !sec.present && <Badge variant="destructive" className="text-[9px] h-3.5 px-1 ml-auto">Required</Badge>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4" />Firewall Rules</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {protection.firewallRules.map(rule => (
                    <div key={rule.name} className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold">{rule.name}</span>
                          <StatusChip ok={rule.status === "active"} label={rule.limit} />
                        </div>
                        <p className="text-[11px] text-muted-foreground">{rule.scope}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Globe className="h-4 w-4" />Security Headers</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {protection.headers.map((h) => (
                    <div key={h.name} className="flex items-start gap-2.5">
                      {h.status === "partial"
                        ? <MinusCircle className="h-4 w-4 text-amber-500 shrink-0" />
                        : <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold">{h.name}</span>
                          <StatusChip ok={h.status !== "partial"} partial={h.status === "partial"} label={h.status} />
                        </div>
                        <p className="text-[11px] text-muted-foreground">{h.detail}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2"><Lock className="h-4 w-4" />Session Security</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5 text-xs">
                    {[
                      { label: "HttpOnly Cookies", ok: protection.sessionSecurity.httpOnly },
                      { label: `SameSite: ${protection.sessionSecurity.sameSite}`, ok: true },
                      { label: `Secure flag${!protection.sessionSecurity.secure ? " (dev mode)" : ""}`, ok: protection.sessionSecurity.secure, partial: !protection.sessionSecurity.secure },
                      { label: `Max age: ${protection.sessionSecurity.maxAgeHours}h`, ok: true },
                      { label: "Rolling session renewal", ok: protection.sessionSecurity.rolling },
                    ].map(item => (
                      <div key={item.label} className="flex items-center gap-2">
                        {item.ok
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                          : item.partial
                            ? <MinusCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                            : <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                        <span className={!item.ok && !item.partial ? "text-amber-600 dark:text-amber-400" : ""}>{item.label}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2"><Lock className="h-4 w-4" />Authentication</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5 text-xs">
                    {[
                      { label: protection.authentication.provider, ok: true },
                      { label: "No local password storage", ok: !protection.authentication.localPasswordStorage },
                      { label: `Token: ${protection.authentication.tokenExpiry}`, ok: true },
                      { label: "Session-backed auth", ok: protection.authentication.sessionBacked },
                      { label: "Admin role enforcement", ok: protection.authentication.adminRoleCheck },
                      { label: "Firebase JWT verification", ok: protection.authentication.firebaseJwtVerification },
                      { label: "Double auth check (Firebase + session)", ok: protection.authentication.doubleAuthCheck },
                    ].map(item => (
                      <div key={item.label} className="flex items-center gap-2">
                        {item.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Database className="h-4 w-4" />Data Protection (AVG/GDPR)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {protection.dataProtection.map((dp) => (
                      <div key={dp.item} className="flex items-start gap-2">
                        {dp.status === "warning"
                          ? <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                          : <CheckCheck className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />}
                        <div>
                          <p className="text-xs font-semibold">{dp.item}</p>
                          <p className="text-[11px] text-muted-foreground leading-tight">{dp.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><History className="h-4 w-4" />Admin Activity (Last 24h)</CardTitle>
                </CardHeader>
                <CardContent>
                  {protection.recentAdminActivity.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">No admin activity in the last 24 hours.</p>
                  ) : (
                    <div className="space-y-2">
                      {protection.recentAdminActivity.map((action, i) => (
                        <div key={i} className="flex items-start gap-2.5 border-b border-border/40 pb-2 last:border-0 last:pb-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary/60 mt-1.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold">{formatActionType(action.actionType)}</span>
                              <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(action.createdAt)}</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              By <span className="font-medium">{action.adminName}</span> · {action.targetType}
                              {action.details && ` · ${action.details}`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Shield data unavailable. Please refresh or check your connection.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <FixPromptPanel section="Safety Monitor" issues={safetyFixIssues} />
    </div>
  );
}
