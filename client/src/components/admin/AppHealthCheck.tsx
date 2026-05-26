import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2, XCircle, AlertTriangle, RefreshCw, ShieldCheck,
  Database, Key, Globe, Zap, ChevronDown, ChevronRight, Clock,
  Server, Info,
} from "lucide-react";
import { format } from "date-fns";
import FixPromptPanel, { FixIssue } from "./FixPromptPanel";

interface HealthCheck {
  id: string;
  name: string;
  category: string;
  status: "ok" | "warn" | "error";
  message: string;
  recommendation?: string;
  latencyMs?: number;
}

interface HealthReport {
  checks: HealthCheck[];
  summary: { total: number; errors: number; warnings: number; healthy: number };
  generatedAt: string;
}

function statusIcon(status: HealthCheck["status"]) {
  if (status === "ok") return <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />;
  if (status === "warn") return <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />;
  return <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
}

function statusBadge(status: HealthCheck["status"]) {
  if (status === "ok") return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">OK</Badge>;
  if (status === "warn") return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">Warning</Badge>;
  return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">Error</Badge>;
}

function categoryIcon(cat: string) {
  if (cat === "Database") return <Database className="w-4 h-4 text-blue-400" />;
  if (cat === "Environment") return <Key className="w-4 h-4 text-purple-400" />;
  if (cat === "Integration") return <Globe className="w-4 h-4 text-cyan-400" />;
  if (cat === "API Endpoint") return <Server className="w-4 h-4 text-orange-400" />;
  return <Zap className="w-4 h-4 text-muted-foreground" />;
}

function CheckRow({ check }: { check: HealthCheck }) {
  const [open, setOpen] = useState(check.status !== "ok");
  return (
    <div
      className={`border rounded-lg p-3 transition-colors ${
        check.status === "error" ? "border-red-500/30 bg-red-500/5" :
        check.status === "warn" ? "border-amber-500/30 bg-amber-500/5" :
        "border-border bg-card"
      }`}
      data-testid={`health-check-${check.id}`}
    >
      <button
        className="w-full flex items-center gap-3 text-left"
        onClick={() => setOpen(v => !v)}
      >
        {statusIcon(check.status)}
        <span className="flex-1 text-sm font-medium">{check.name}</span>
        {check.latencyMs !== undefined && check.latencyMs > 0 && (
          <span className="text-xs text-muted-foreground flex items-center gap-1 mr-2">
            <Clock className="w-3 h-3" />{check.latencyMs}ms
          </span>
        )}
        {statusBadge(check.status)}
        {open ? <ChevronDown className="w-3 h-3 text-muted-foreground ml-1" /> : <ChevronRight className="w-3 h-3 text-muted-foreground ml-1" />}
      </button>
      {open && (
        <div className="mt-2 pl-7 space-y-1">
          <p className="text-xs text-muted-foreground">{check.message}</p>
          {check.recommendation && (
            <div className="flex items-start gap-1.5 mt-1.5 p-2 rounded bg-muted/50">
              <Info className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-300">{check.recommendation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CategoryGroup({ category, checks }: { category: string; checks: HealthCheck[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const errors = checks.filter(c => c.status === "error").length;
  const warns = checks.filter(c => c.status === "warn").length;

  return (
    <div>
      <button
        className="flex items-center gap-2 w-full text-left py-2 px-1 hover:text-foreground text-muted-foreground transition-colors"
        onClick={() => setCollapsed(v => !v)}
      >
        {categoryIcon(category)}
        <span className="text-sm font-semibold">{category}</span>
        <span className="text-xs text-muted-foreground ml-1">({checks.length})</span>
        {errors > 0 && <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs ml-1">{errors} error{errors > 1 ? "s" : ""}</Badge>}
        {warns > 0 && <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs ml-1">{warns} warning{warns > 1 ? "s" : ""}</Badge>}
        <span className="ml-auto">{collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
      </button>
      {!collapsed && (
        <div className="space-y-2 mb-4">
          {checks.map(c => <CheckRow key={c.id} check={c} />)}
        </div>
      )}
    </div>
  );
}

export default function AppHealthCheck() {
  const forceRef = useRef(false);

  const { data, isLoading, isFetching, dataUpdatedAt, refetch } = useQuery<HealthReport & { cached?: boolean }>({
    queryKey: ["/api/admin/app-health"],
    queryFn: async () => {
      const url = forceRef.current ? "/api/admin/app-health?force=1" : "/api/admin/app-health";
      forceRef.current = false;
      const r = await apiRequest(url, "GET");
      return r.json();
    },
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const handleRunChecks = () => {
    forceRef.current = true;
    refetch();
  };

  const categories = data ? [...new Set(data.checks.map(c => c.category))] : [];

  const overallStatus = !data ? null :
    data.summary.errors > 0 ? "error" :
    data.summary.warnings > 0 ? "warn" : "ok";

  const fixIssues: FixIssue[] = (data?.checks ?? [])
    .filter(c => c.status !== "ok")
    .map(c => ({
      severity: c.status === "error" ? "error" : "warning",
      title: c.name,
      detail: c.message,
      category: c.category,
      recommendation: c.recommendation,
    } as FixIssue));

  return (
    <div className="space-y-6 p-1">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            App Health Check
            {data?.cached && (
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs ml-1">Cached</Badge>
            )}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Scans all app sections, APIs, integrations, and environment for issues
            {dataUpdatedAt ? ` · Last run ${format(new Date(dataUpdatedAt), "HH:mm:ss")}` : ""}
            {data?.cached ? " · Results cached (60s)" : ""}
          </p>
        </div>
        <Button
          onClick={handleRunChecks}
          disabled={isLoading || isFetching}
          data-testid="button-run-health-check"
        >
          <RefreshCw className={`w-4 h-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
          {isFetching ? "Running checks..." : "Run Checks"}
        </Button>
      </div>

      {/* Loading state */}
      {(isLoading || isFetching) && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Running health checks on all app sections...</p>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {data && !isFetching && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  {overallStatus === "ok" ? <CheckCircle2 className="w-4 h-4 text-green-400" /> :
                   overallStatus === "warn" ? <AlertTriangle className="w-4 h-4 text-amber-400" /> :
                   <XCircle className="w-4 h-4 text-red-400" />}
                  <span className="text-xs text-muted-foreground">Overall</span>
                </div>
                <p className={`text-2xl font-bold ${overallStatus === "ok" ? "text-green-400" : overallStatus === "warn" ? "text-amber-400" : "text-red-400"}`}>
                  {overallStatus === "ok" ? "Healthy" : overallStatus === "warn" ? "Warning" : "Issues Found"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{data.summary.total} checks run</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-muted-foreground">Passing</span>
                </div>
                <p className="text-2xl font-bold text-green-400" data-testid="stat-healthy">{data.summary.healthy}</p>
                <p className="text-xs text-muted-foreground mt-1">checks passing</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span className="text-xs text-muted-foreground">Warnings</span>
                </div>
                <p className="text-2xl font-bold text-amber-400" data-testid="stat-warnings">{data.summary.warnings}</p>
                <p className="text-xs text-muted-foreground mt-1">need attention</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <XCircle className="w-4 h-4 text-red-400" />
                  <span className="text-xs text-muted-foreground">Errors</span>
                </div>
                <p className="text-2xl font-bold text-red-400" data-testid="stat-errors">{data.summary.errors}</p>
                <p className="text-xs text-muted-foreground mt-1">must be fixed</p>
              </CardContent>
            </Card>
          </div>

          {/* Issues first — errors and warnings at top */}
          {(data.summary.errors > 0 || data.summary.warnings > 0) && (
            <Card className="border-amber-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Issues Requiring Attention ({data.summary.errors + data.summary.warnings})
                </CardTitle>
                <CardDescription>Fix errors first, then address warnings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.checks
                  .filter(c => c.status !== "ok")
                  .sort((a, b) => (a.status === "error" ? -1 : 1))
                  .map(c => <CheckRow key={`issue-${c.id}`} check={c} />)}
              </CardContent>
            </Card>
          )}

          {/* All checks by category */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">All Checks by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-2">
                {categories.map(cat => (
                  <CategoryGroup
                    key={cat}
                    category={cat}
                    checks={data.checks.filter(c => c.category === cat)}
                  />
                ))}
              </ScrollArea>
            </CardContent>
          </Card>

          <FixPromptPanel section="App Health Check" issues={fixIssues} />
        </>
      )}

      {/* Initial state */}
      {!data && !isLoading && !isFetching && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <ShieldCheck className="w-12 h-12 text-muted-foreground" />
            <div>
              <p className="font-medium">Click "Run Checks" to scan the entire app</p>
              <p className="text-sm text-muted-foreground mt-1">
                Checks database, integrations, API endpoints, environment variables, and all admin menu sections
              </p>
            </div>
            <Button onClick={() => refetch()} data-testid="button-start-health-check">
              <ShieldCheck className="w-4 h-4 mr-1.5" />
              Run Health Check
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
