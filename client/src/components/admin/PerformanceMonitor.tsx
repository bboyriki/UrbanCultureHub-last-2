import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import FixPromptPanel, { FixIssue } from "./FixPromptPanel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Activity, RefreshCw, Trash2, Zap, Server, AlertTriangle,
  CheckCircle, Clock, TrendingUp, TrendingDown, Cpu, HardDrive,
  Lightbulb, BarChart2,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { format } from "date-fns";

interface EndpointStat {
  endpoint: string;
  count: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
  errors: number;
  errorRate: number;
  recentRequests: { ts: number; ms: number; status: number }[];
}

interface PerfReport {
  system: {
    uptimeSec: number;
    memHeapUsedMb: number;
    memHeapTotalMb: number;
    memRssMb: number;
    memPct: number;
    nodeVersion: string;
  };
  endpoints: EndpointStat[];
  recommendations: string[];
  collectedAt: string;
}

function msColor(ms: number) {
  if (ms < 350) return "#22c55e";
  if (ms < 700) return "#eab308";
  if (ms < 1200) return "#f97316";
  return "#ef4444";
}

function msBadge(ms: number) {
  if (ms < 350) return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Fast</Badge>;
  if (ms < 700) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">OK</Badge>;
  if (ms < 1200) return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Slow</Badge>;
  return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Critical</Badge>;
}

function formatUptime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function PerformanceMonitor() {
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data, isLoading, dataUpdatedAt, refetch } = useQuery<PerfReport>({
    queryKey: ["/api/admin/performance"],
    queryFn: async () => {
      const r = await apiRequest("/api/admin/performance", "GET");
      return r.json();
    },
    refetchInterval: autoRefresh ? 8000 : false,
    staleTime: 0,
  });

  const resetMutation = useMutation({
    mutationFn: () => apiRequest("/api/admin/performance/reset", "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/performance"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Activity className="w-8 h-8 animate-pulse text-primary" />
      </div>
    );
  }

  if (!data) return null;

  const { system, endpoints, recommendations } = data;
  const criticalEndpoints = endpoints.filter(e => e.avgMs >= 1200);
  const slowEndpoints = endpoints.filter(e => e.avgMs >= 700 && e.avgMs < 1200);
  const topChart = endpoints.slice(0, 12);

  const perfFixIssues: FixIssue[] = [
    ...criticalEndpoints.map(ep => ({
      severity: "critical" as const,
      title: `Critical endpoint: ${ep.endpoint}`,
      detail: `Avg: ${ep.avgMs}ms · P95: ${ep.p95Ms}ms · Max: ${ep.maxMs}ms · Error rate: ${ep.errorRate.toFixed(1)}%`,
      category: "Response Time",
      recommendation: "Investigate database queries, add caching, or optimize the route handler",
    })),
    ...slowEndpoints.map(ep => ({
      severity: "high" as const,
      title: `Slow endpoint: ${ep.endpoint}`,
      detail: `Avg: ${ep.avgMs}ms · P95: ${ep.p95Ms}ms · ${ep.errors} errors (${ep.errorRate.toFixed(1)}%)`,
      category: "Response Time",
      recommendation: "Profile this route and check for N+1 queries or missing indexes",
    })),
    ...endpoints.filter(ep => ep.errorRate > 5 && ep.avgMs < 700).map(ep => ({
      severity: "high" as const,
      title: `High error rate: ${ep.endpoint}`,
      detail: `${ep.errorRate.toFixed(1)}% error rate across ${ep.count} requests`,
      category: "Reliability",
      recommendation: "Check server logs for the root cause of these errors",
    })),
    ...(system.memPct > 80 ? [{
      severity: (system.memPct > 90 ? "critical" : "high") as FixIssue["severity"],
      title: "High memory usage",
      detail: `Heap: ${system.memHeapUsedMb}MB / ${system.memHeapTotalMb}MB (${system.memPct.toFixed(0)}%) · RSS: ${system.memRssMb}MB`,
      category: "System Resources",
      recommendation: "Profile for memory leaks; consider increasing Node.js heap via NODE_OPTIONS=--max-old-space-size",
    }] : []),
    ...recommendations.map(r => ({
      severity: "moderate" as const,
      title: r,
      detail: "Flagged by the performance analyzer",
      category: "Optimization",
    })),
  ];

  return (
    <div className="space-y-6 p-1">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Performance Monitor
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Live API response times &amp; system health
            {dataUpdatedAt ? ` · Updated ${format(new Date(dataUpdatedAt), "HH:mm:ss")}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(v => !v)}
            data-testid="button-toggle-autorefresh"
          >
            <Zap className="w-4 h-4 mr-1" />
            {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-perf">
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => resetMutation.mutate()}
            disabled={resetMutation.isPending}
            data-testid="button-reset-perf"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Reset
          </Button>
        </div>
      </div>

      {/* System Health */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Server className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-muted-foreground">Uptime</span>
            </div>
            <p className="text-2xl font-bold" data-testid="stat-uptime">{formatUptime(system.uptimeSec)}</p>
            <p className="text-xs text-muted-foreground mt-1">Node {system.nodeVersion}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-muted-foreground">Heap Memory</span>
            </div>
            <p className="text-2xl font-bold" data-testid="stat-memory">{system.memHeapUsedMb} MB</p>
            <Progress value={system.memPct} className="mt-2 h-1.5" />
            <p className="text-xs text-muted-foreground mt-1">{system.memPct}% of {system.memHeapTotalMb} MB</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Cpu className="w-4 h-4 text-orange-400" />
              <span className="text-xs text-muted-foreground">RSS Memory</span>
            </div>
            <p className="text-2xl font-bold" data-testid="stat-rss">{system.memRssMb} MB</p>
            <p className="text-xs text-muted-foreground mt-1">Total process memory</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart2 className="w-4 h-4 text-green-400" />
              <span className="text-xs text-muted-foreground">Endpoints Tracked</span>
            </div>
            <p className="text-2xl font-bold" data-testid="stat-endpoints">{endpoints.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {criticalEndpoints.length > 0 ? (
                <span className="text-red-400">{criticalEndpoints.length} critical</span>
              ) : slowEndpoints.length > 0 ? (
                <span className="text-yellow-400">{slowEndpoints.length} slow</span>
              ) : (
                <span className="text-green-400">All healthy</span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {recommendations.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  {r.includes("healthy") ? (
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  )}
                  <span data-testid={`recommendation-${i}`}>{r}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="table">
        <TabsList>
          <TabsTrigger value="table">Endpoint Table</TabsTrigger>
          <TabsTrigger value="chart">Response Time Chart</TabsTrigger>
          <TabsTrigger value="live">Live Feed</TabsTrigger>
        </TabsList>

        {/* Endpoint Table */}
        <TabsContent value="table" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">All Endpoints — sorted slowest first</CardTitle>
              <CardDescription>{endpoints.reduce((a, e) => a + e.count, 0)} total requests tracked</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[420px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card border-b">
                    <tr className="text-left text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Endpoint</th>
                      <th className="px-3 py-2 font-medium text-right">Avg</th>
                      <th className="px-3 py-2 font-medium text-right">P95</th>
                      <th className="px-3 py-2 font-medium text-right">Max</th>
                      <th className="px-3 py-2 font-medium text-right">Calls</th>
                      <th className="px-3 py-2 font-medium text-right">Errors</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpoints.map((ep, i) => (
                      <tr
                        key={ep.endpoint}
                        className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                        data-testid={`row-endpoint-${i}`}
                      >
                        <td className="px-4 py-2 font-mono text-xs max-w-[280px] truncate" title={ep.endpoint}>
                          {ep.endpoint}
                        </td>
                        <td className="px-3 py-2 text-right font-medium" style={{ color: msColor(ep.avgMs) }}>
                          {ep.avgMs}ms
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{ep.p95Ms}ms</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{ep.maxMs}ms</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{ep.count}</td>
                        <td className="px-3 py-2 text-right">
                          {ep.errors > 0 ? (
                            <span className="text-red-400">{ep.errors} ({ep.errorRate}%)</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="px-3 py-2">{msBadge(ep.avgMs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chart */}
        <TabsContent value="chart" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Top {topChart.length} Endpoints — Avg Response Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={topChart} layout="vertical" margin={{ left: 180, right: 20, top: 0, bottom: 0 }}>
                  <XAxis type="number" unit="ms" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="endpoint"
                    tick={{ fontSize: 10 }}
                    width={175}
                    tickFormatter={v => v.length > 35 ? v.slice(0, 35) + "…" : v}
                  />
                  <Tooltip
                    formatter={(v: any) => [`${v}ms`, "Avg"]}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="avgMs" radius={[0, 4, 4, 0]}>
                    {topChart.map((ep) => (
                      <Cell key={ep.endpoint} fill={msColor(ep.avgMs)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground justify-center">
                <span><span className="inline-block w-3 h-3 rounded bg-green-500 mr-1" />{"< 200ms fast"}</span>
                <span><span className="inline-block w-3 h-3 rounded bg-yellow-500 mr-1" />200–500ms ok</span>
                <span><span className="inline-block w-3 h-3 rounded bg-orange-500 mr-1" />500ms–1s slow</span>
                <span><span className="inline-block w-3 h-3 rounded bg-red-500 mr-1" />{"> 1s critical"}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Live Feed */}
        <TabsContent value="live" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recent Requests (per endpoint)</CardTitle>
              <CardDescription>Last 10 hits per tracked endpoint</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[420px]">
                {endpoints.slice(0, 20).map(ep => (
                  <div key={ep.endpoint} className="border-b px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs truncate max-w-[280px]" title={ep.endpoint}>{ep.endpoint}</span>
                      {msBadge(ep.avgMs)}
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {ep.recentRequests.slice().reverse().map((r, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: `${msColor(r.ms)}22`, color: msColor(r.ms) }}
                          title={`${format(new Date(r.ts), "HH:mm:ss")} — ${r.ms}ms — HTTP ${r.status}`}
                        >
                          {r.ms}ms
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <FixPromptPanel section="Performance Monitor" issues={perfFixIssues} />

      {/* Bottom legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground border-t pt-3">
        <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3 text-green-400" /> Fast {"<"} 200ms</span>
        <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-yellow-400" /> OK 200–500ms</span>
        <span className="flex items-center gap-1"><TrendingDown className="w-3 h-3 text-orange-400" /> Slow 500ms–1s</span>
        <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-red-400" /> Critical {">"}1s</span>
        <span className="ml-auto">P95 = 95th percentile response time</span>
      </div>
    </div>
  );
}
