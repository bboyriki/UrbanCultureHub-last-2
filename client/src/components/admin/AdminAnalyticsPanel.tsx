import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  PieChart, Pie, Cell, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  Users, Eye, Clock, TrendingUp, Globe, Smartphone, Monitor, Tablet,
  Cookie, ShieldCheck, RefreshCw, MousePointerClick, Activity, Zap
} from "lucide-react";
import { format, subDays } from "date-fns";

const COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];

const DATE_RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

function formatDuration(s: number) {
  if (!s) return "0s";
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function DeviceIcon({ device }: { device: string }) {
  if (device?.toLowerCase() === "mobile") return <Smartphone className="h-4 w-4" />;
  if (device?.toLowerCase() === "tablet") return <Tablet className="h-4 w-4" />;
  return <Monitor className="h-4 w-4" />;
}

export default function AdminAnalyticsPanel() {
  const [days, setDays] = useState("30");

  const start = subDays(new Date(), parseInt(days)).toISOString();
  const end = new Date().toISOString();
  const params = `?startDate=${start}&endDate=${end}`;

  const { data: overview, isLoading: loadingOverview, refetch: refetchAll } = useQuery({
    queryKey: ["/api/admin/analytics/overview", days],
    queryFn: async () => {
      const r = await apiRequest(`/api/admin/analytics/overview${params}`, "GET");
      return r.json();
    },
  });

  const { data: devices = [] } = useQuery({
    queryKey: ["/api/admin/analytics/devices", days],
    queryFn: async () => {
      const r = await apiRequest(`/api/admin/analytics/devices${params}`, "GET");
      return r.json();
    },
  });

  const { data: sources = [] } = useQuery({
    queryKey: ["/api/admin/analytics/traffic-sources", days],
    queryFn: async () => {
      const r = await apiRequest(`/api/admin/analytics/traffic-sources${params}`, "GET");
      return r.json();
    },
  });

  const { data: topPages = [] } = useQuery({
    queryKey: ["/api/admin/analytics/top-pages", days],
    queryFn: async () => {
      const r = await apiRequest(`/api/admin/analytics/top-pages${params}&limit=8`, "GET");
      return r.json();
    },
  });

  const { data: dailyTraffic = [] } = useQuery({
    queryKey: ["/api/admin/analytics/daily-traffic", days],
    queryFn: async () => {
      const r = await apiRequest(`/api/admin/analytics/daily-traffic${params}`, "GET");
      return r.json();
    },
  });

  const { data: recentSessions = [] } = useQuery({
    queryKey: ["/api/admin/analytics/recent-sessions", days],
    queryFn: async () => {
      const r = await apiRequest(`/api/admin/analytics/recent-sessions?limit=10`, "GET");
      return r.json();
    },
    refetchInterval: 60000,
  });

  const { data: consentStats } = useQuery({
    queryKey: ["/api/admin/analytics/consent-stats"],
    queryFn: async () => {
      const r = await apiRequest("/api/admin/analytics/consent-stats", "GET");
      return r.json();
    },
    refetchInterval: 120000,
  });

  const consentChartData = consentStats
    ? [
        { name: "Analytics accepted", value: consentStats.analyticsAccepted, color: "#10b981" },
        { name: "Essential only", value: consentStats.essentialOnly, color: "#f59e0b" },
        { name: "Marketing accepted", value: consentStats.marketingAccepted, color: "#3b82f6" },
      ]
    : [];

  const maxPages = topPages[0]?.views || 1;
  const maxSources = sources[0]?.sessions || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">Analytics & Tracking</h2>
          <p className="text-sm text-muted-foreground">Visitor insights, sessions, devices and consent</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-36" data-testid="select-date-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetchAll()} data-testid="button-refresh-analytics">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Overview KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: "Unique Visitors",
            value: overview?.uniqueVisitors ?? "—",
            icon: Users,
            color: "text-blue-600",
            bg: "bg-blue-100 dark:bg-blue-900/30",
          },
          {
            label: "Total Sessions",
            value: overview?.totalSessions ?? "—",
            icon: Activity,
            color: "text-green-600",
            bg: "bg-green-100 dark:bg-green-900/30",
          },
          {
            label: "Page Views",
            value: overview?.totalPageViews ?? "—",
            icon: Eye,
            color: "text-purple-600",
            bg: "bg-purple-100 dark:bg-purple-900/30",
          },
          {
            label: "Avg Duration",
            value: overview?.avgSessionDuration ? formatDuration(overview.avgSessionDuration) : "—",
            icon: Clock,
            color: "text-amber-600",
            bg: "bg-amber-100 dark:bg-amber-900/30",
          },
        ].map((stat) => (
          <Card key={stat.label} className="border border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
                <div className={`p-2 rounded-full ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Daily traffic chart */}
      <Card className="border border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Daily Traffic
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dailyTraffic.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">No traffic data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={dailyTraffic} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="sessionGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="pageGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => format(new Date(d), "MMM d")} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  labelFormatter={(d) => format(new Date(d), "MMM d, yyyy")}
                />
                <Area type="monotone" dataKey="sessions" stroke="#f59e0b" fill="url(#sessionGrad)" strokeWidth={2} name="Sessions" />
                <Area type="monotone" dataKey="pageViews" stroke="#3b82f6" fill="url(#pageGrad)" strokeWidth={2} name="Page Views" />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Cookie Consent + Devices row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Cookie className="h-4 w-4 text-amber-500" />
              Cookie Consent Breakdown
            </CardTitle>
            <CardDescription className="text-xs">
              Total responses: {consentStats?.total ?? 0} · Registered users: {consentStats?.registeredUsers ?? 0}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!consentStats || consentStats.total === 0 ? (
              <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">No consent data yet</div>
            ) : (
              <div className="flex items-center gap-4">
                <PieChart width={120} height={120}>
                  <Pie data={consentChartData} cx={55} cy={55} innerRadius={32} outerRadius={55} dataKey="value" paddingAngle={3}>
                    {consentChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  />
                </PieChart>
                <div className="flex-1 space-y-2">
                  {consentChartData.map((item) => (
                    <div key={item.name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: item.color }} />
                          {item.name}
                        </span>
                        <span className="font-semibold">{item.value}</span>
                      </div>
                      <Progress
                        value={consentStats.total > 0 ? (item.value / consentStats.total) * 100 : 0}
                        className="h-1.5"
                      />
                    </div>
                  ))}
                  <div className="mt-3 pt-2 border-t border-border/60 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                    {consentStats.total > 0
                      ? `${Math.round((consentStats.analyticsAccepted / consentStats.total) * 100)}% accepted analytics`
                      : "No data"}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Monitor className="h-4 w-4 text-blue-500" />
              Device Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {devices.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">No device data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={devices} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="device" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  />
                  <Bar dataKey="sessions" name="Sessions" radius={[4, 4, 0, 0]}>
                    {devices.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Traffic Sources + Top Pages row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Globe className="h-4 w-4 text-purple-500" />
              Traffic Sources
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sources.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">No source data yet</div>
            ) : (
              sources.map((src: any, i: number) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ background: COLORS[i % COLORS.length] }} />
                      {src.source || "Direct"}
                    </span>
                    <span className="font-semibold">{src.sessions}</span>
                  </div>
                  <Progress value={(src.sessions / maxSources) * 100} className="h-1.5" />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MousePointerClick className="h-4 w-4 text-green-500" />
              Top Pages
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topPages.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">No page data yet</div>
            ) : (
              topPages.map((page: any, i: number) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="truncate max-w-[160px] text-muted-foreground">{page.path}</span>
                    <span className="font-semibold ml-2 shrink-0">{page.views} views</span>
                  </div>
                  <Progress value={(page.views / maxPages) * 100} className="h-1.5" />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent sessions */}
      <Card className="border border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Recent Sessions
            </CardTitle>
            <Badge variant="secondary" className="text-xs">{recentSessions.length} shown</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {recentSessions.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-sm text-muted-foreground">No sessions recorded yet</div>
          ) : (
            <div className="divide-y divide-border/60">
              {recentSessions.map((session: any) => (
                <div key={session.id} className="py-2.5 flex items-center gap-3 text-xs" data-testid={`row-session-${session.id}`}>
                  <div className="text-muted-foreground shrink-0">
                    <DeviceIcon device={session.deviceType} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium capitalize">{session.deviceType || "unknown"}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{session.browser || "unknown browser"}</span>
                      {session.os && <><span className="text-muted-foreground">·</span><span className="text-muted-foreground">{session.os}</span></>}
                      {session.utmSource && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1">
                          {session.utmSource}
                        </Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground mt-0.5">
                      {session.pageCount} pages · {session.duration ? formatDuration(session.duration) : "active"}
                    </div>
                  </div>
                  <div className="text-muted-foreground shrink-0 text-right">
                    {format(new Date(session.startedAt), "MMM d, HH:mm")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
