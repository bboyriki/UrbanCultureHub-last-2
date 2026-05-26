import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import FixPromptPanel, { FixIssue } from "./FixPromptPanel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield, ShieldCheck, ShieldAlert, ShieldX, RefreshCw, Loader2,
  CheckCircle2, AlertTriangle, AlertOctagon, Users, Crown, Clock,
  Package, FileSignature, History, ExternalLink, ChevronDown, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface RbacCheck { id: string; label: string; ok: boolean; detail: string; }
interface PrivilegedUser {
  id: number; email: string; displayName: string; role: string;
  status: string | null; createdAt: string | null; updatedAt: string | null;
  isApproved: boolean | null; lastActiveAt: string | null; recentActions: number; isStale: boolean;
}
interface RbacResponse {
  score: number;
  checks: RbacCheck[];
  roles: { role: string; count: number }[];
  privileged: PrivilegedUser[];
  lastReview: { at: string; by: string; notes?: string | null } | null;
  reviewDueDays: number;
  totals: { users: number; privileged: number; superAdmin: number; stale: number };
}
interface DepsResponse {
  score: number;
  checkedAt: string;
  vulnerabilities: { critical: number; high: number; moderate: number; low: number; info: number; total: number };
  advisories: { name: string; severity: string; via: string; range: string; fixAvailable: boolean | string }[];
  outdated: { name: string; current: string; wanted: string; latest: string; majorBehind: number }[];
  outdatedCount: number;
  majorBehindCount: number;
  auditError: string | null;
  outdatedError: string | null;
}
interface RecentResponse { window: string; counts: { critical: number; high: number; medium: number; low: number; }; }

const scoreColor = (s: number) =>
  s >= 90 ? "text-emerald-500" : s >= 80 ? "text-lime-500" : s >= 65 ? "text-amber-500" : s >= 50 ? "text-orange-500" : "text-rose-500";
const scoreRing = (s: number) =>
  s >= 90 ? "ring-emerald-500/30 bg-emerald-500/5" : s >= 80 ? "ring-lime-500/30 bg-lime-500/5" :
  s >= 65 ? "ring-amber-500/30 bg-amber-500/5" : s >= 50 ? "ring-orange-500/30 bg-orange-500/5" : "ring-rose-500/30 bg-rose-500/5";
const grade = (s: number) => (s >= 90 ? "A" : s >= 80 ? "B" : s >= 65 ? "C" : s >= 50 ? "D" : "F");

const SEV_COLOR: Record<string, string> = {
  critical: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  high:     "bg-orange-500/15 text-orange-300 border-orange-500/30",
  moderate: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  low:      "bg-sky-500/15 text-sky-300 border-sky-500/30",
  info:     "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  unknown:  "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

export default function SecurityCenter() {
  const { toast } = useToast();
  const [reviewNotes, setReviewNotes] = useState("");
  const [showAllOutdated, setShowAllOutdated] = useState(false);

  const rbac = useQuery<RbacResponse>({ queryKey: ["/api/admin/security-center/rbac"] });
  const deps = useQuery<DepsResponse>({ queryKey: ["/api/admin/security-center/dependencies"], staleTime: 5 * 60 * 1000 });
  const recent = useQuery<RecentResponse>({ queryKey: ["/api/admin/security-center/recent"], refetchInterval: 60_000 });

  const signMutation = useMutation({
    mutationFn: async (notes: string) => {
      const r = await apiRequest("/api/admin/security-center/rbac-review/sign", "POST", { notes });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Sign-off failed");
      return j;
    },
    onSuccess: () => {
      toast({ title: "RBAC review signed", description: "Quarterly attestation recorded in the audit log." });
      setReviewNotes("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/security-center/rbac"] });
    },
    onError: (err: any) => toast({ title: "Couldn't sign", description: err?.message, variant: "destructive" }),
  });

  // Composite "platform health" score
  const overall = useMemo(() => {
    const r = rbac.data?.score;
    const d = deps.data?.score;
    if (r == null && d == null) return null;
    if (r == null) return d!;
    if (d == null) return r!;
    return Math.round((r + d) / 2);
  }, [rbac.data, deps.data]);

  const securityFixIssues: FixIssue[] = useMemo(() => {
    const issues: FixIssue[] = [];
    (deps.data?.advisories ?? []).forEach(a => {
      issues.push({
        severity: (["critical","high","moderate","low","info"].includes(a.severity) ? a.severity : "moderate") as FixIssue["severity"],
        title: `Vulnerable dependency: ${a.name}`,
        detail: `Via: ${a.via}${a.range ? ` · Affected range: ${a.range}` : ""}`,
        category: "Dependencies",
        recommendation: a.fixAvailable
          ? "Run: npm audit fix"
          : "Add an override in package.json or upgrade the parent package",
      });
    });
    (rbac.data?.checks ?? []).filter(c => !c.ok).forEach(c => {
      issues.push({
        severity: "warning",
        title: c.label,
        detail: c.detail,
        category: "Authorization (RBAC)",
      });
    });
    if ((rbac.data?.totals?.stale ?? 0) > 0) {
      issues.push({
        severity: "warning",
        title: `${rbac.data!.totals.stale} stale privileged account(s) detected`,
        detail: "These accounts have not been active for a long time but still hold elevated roles.",
        category: "Authorization (RBAC)",
        recommendation: "Review and demote or deactivate accounts that no longer need elevated access",
      });
    }
    return issues;
  }, [deps.data, rbac.data]);

  return (
    <div className="space-y-5" data-testid="security-center">
      {/* ── HERO ─────────────────────────────────────────────────── */}
      <Card className={cn("ring-1 backdrop-blur-sm overflow-hidden", overall != null ? scoreRing(overall) : "ring-zinc-500/20")}>
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start gap-5 flex-wrap">
            <div className={cn("w-20 h-20 rounded-2xl flex flex-col items-center justify-center ring-1", overall != null ? scoreRing(overall) : "ring-zinc-500/20")}>
              <div className={cn("text-3xl font-bold leading-none", overall != null ? scoreColor(overall) : "text-zinc-400")} data-testid="text-overall-score">
                {overall ?? "—"}
              </div>
              <div className={cn("text-[10px] mt-1 uppercase tracking-wider", overall != null ? scoreColor(overall) : "text-zinc-500")}>
                Grade {overall != null ? grade(overall) : "?"}
              </div>
            </div>
            <div className="flex-1 min-w-[240px]">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-5 h-5 text-primary" />
                <h2 className="text-lg sm:text-xl font-bold">Security Center</h2>
                <Badge variant="outline" className="text-[10px]">Authorization · Dependencies · Events</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Continuous, evidence-based view of the two areas the platform audit flagged for improvement —
                role-based access control and dependency hygiene — plus a live security-event pulse.
              </p>
              <div className="grid grid-cols-3 gap-3 mt-3 max-w-md">
                <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">RBAC</div>
                  <div className={cn("font-bold text-lg", rbac.data ? scoreColor(rbac.data.score) : "text-muted-foreground")} data-testid="text-rbac-score">
                    {rbac.data ? rbac.data.score : (rbac.isLoading ? "…" : "—")}
                  </div>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Deps</div>
                  <div className={cn("font-bold text-lg", deps.data ? scoreColor(deps.data.score) : "text-muted-foreground")} data-testid="text-deps-score">
                    {deps.data ? deps.data.score : (deps.isLoading ? "…" : "—")}
                  </div>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Events 7d</div>
                  <div className="font-bold text-lg" data-testid="text-events-count">
                    {recent.data ? recent.data.counts.critical + recent.data.counts.high + recent.data.counts.medium : "…"}
                  </div>
                </div>
              </div>
            </div>
            <Button
              variant="outline" size="sm"
              onClick={() => {
                rbac.refetch(); deps.refetch(); recent.refetch();
                toast({ title: "Refreshing all checks…" });
              }}
              data-testid="button-refresh-all"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", (rbac.isFetching || deps.isFetching) && "animate-spin")} />
              Recheck everything
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="rbac" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rbac" data-testid="tab-rbac"><Crown className="w-4 h-4 mr-1.5" />Authorization</TabsTrigger>
          <TabsTrigger value="deps" data-testid="tab-deps"><Package className="w-4 h-4 mr-1.5" />Dependencies</TabsTrigger>
          <TabsTrigger value="review" data-testid="tab-review"><FileSignature className="w-4 h-4 mr-1.5" />Quarterly Review</TabsTrigger>
        </TabsList>

        {/* ── RBAC TAB ─────────────────────────────────────────────── */}
        <TabsContent value="rbac" className="space-y-4">
          {rbac.isLoading && <Skel />}
          {rbac.data && (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" /> Principle of Least Privilege
                  </CardTitle>
                  <CardDescription>Auto-evaluated checks based on the live user database.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {rbac.data.checks.map((c) => (
                    <div key={c.id} data-testid={`check-${c.id}`}
                      className={cn("flex items-start gap-3 px-3 py-2.5 rounded-lg border",
                        c.ok ? "border-emerald-500/20 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5")}>
                      {c.ok
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{c.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{c.detail}</div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" /> Role distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {rbac.data.roles
                      .sort((a, b) => b.count - a.count)
                      .map((r) => {
                        const pct = rbac.data!.totals.users ? (r.count / rbac.data!.totals.users) * 100 : 0;
                        return (
                          <div key={r.role} data-testid={`role-${r.role}`}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-medium">{r.role}</span>
                              <span className="text-muted-foreground">{r.count} · {pct.toFixed(1)}%</span>
                            </div>
                            <Progress value={pct} className="h-1.5" />
                          </div>
                        );
                      })}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Crown className="w-4 h-4 text-amber-500" /> Privileged accounts
                      <Badge variant="outline" className="ml-auto">{rbac.data.privileged.length}</Badge>
                    </CardTitle>
                    <CardDescription>Anyone with admin, moderator or super_admin role.</CardDescription>
                  </CardHeader>
                  <CardContent className="max-h-[320px] overflow-y-auto space-y-1.5">
                    {rbac.data.privileged.length === 0 && (
                      <p className="text-sm text-muted-foreground italic">No privileged accounts.</p>
                    )}
                    {rbac.data.privileged.map((u) => (
                      <div key={u.id} data-testid={`priv-user-${u.id}`}
                        className={cn("flex items-center gap-3 px-2.5 py-2 rounded-lg border",
                          u.isStale ? "border-amber-500/30 bg-amber-500/5" : "border-border/50 bg-background/30")}>
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold shrink-0">
                          {(u.displayName || u.email || "?").slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{u.displayName || u.email}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{u.email}</div>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px]",
                            u.role === "super_admin" ? "border-amber-500/40 text-amber-400" :
                            u.role === "admin" ? "border-primary/40 text-primary" :
                            "border-sky-500/40 text-sky-400")}>
                          {u.role}
                        </Badge>
                        {u.isStale && (
                          <Badge className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            <Clock className="w-2.5 h-2.5 mr-1" />stale
                          </Badge>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* ── DEPENDENCIES TAB ─────────────────────────────────────── */}
        <TabsContent value="deps" className="space-y-4">
          {deps.isLoading && <Skel />}
          {deps.data && (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-primary" /> Dependency vulnerabilities
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      Last checked {format(new Date(deps.data.checkedAt), "PPp")}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
                    {(["critical","high","moderate","low","info"] as const).map((k) => (
                      <div key={k} data-testid={`vuln-${k}`}
                        className={cn("rounded-lg border px-3 py-2.5 text-center", SEV_COLOR[k])}>
                        <div className="text-2xl font-bold leading-none">{deps.data!.vulnerabilities[k]}</div>
                        <div className="text-[10px] uppercase mt-1 tracking-wider opacity-80">{k}</div>
                      </div>
                    ))}
                  </div>

                  {deps.data.advisories.length === 0 ? (
                    <p className="text-sm text-emerald-500 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> No advisories — dependencies are clean.
                    </p>
                  ) : (
                    <div className="border rounded-lg divide-y divide-border/60 max-h-[340px] overflow-y-auto">
                      {deps.data.advisories.map((a) => (
                        <div key={a.name} className="flex items-center gap-3 px-3 py-2" data-testid={`advisory-${a.name}`}>
                          <Badge variant="outline" className={cn("text-[10px] shrink-0", SEV_COLOR[a.severity] || SEV_COLOR.unknown)}>
                            {a.severity}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-sm truncate">{a.name}</div>
                            {a.via && <div className="text-[11px] text-muted-foreground truncate">via {a.via}</div>}
                          </div>
                          {a.fixAvailable && (
                            <Badge className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                              fix available
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <History className="w-4 h-4 text-amber-500" /> Outdated packages
                    </span>
                    <span className="text-xs text-muted-foreground font-normal">
                      {deps.data.outdatedCount} total · {deps.data.majorBehindCount} major behind
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {deps.data.outdated.length === 0 ? (
                    <p className="text-sm text-emerald-500 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Everything up to date.
                    </p>
                  ) : (
                    <div className="border rounded-lg divide-y divide-border/60">
                      {(showAllOutdated ? deps.data.outdated : deps.data.outdated.slice(0, 8)).map((o) => (
                        <div key={o.name} className="grid grid-cols-12 items-center gap-2 px-3 py-2 text-sm" data-testid={`outdated-${o.name}`}>
                          <div className="col-span-5 font-mono truncate">{o.name}</div>
                          <div className="col-span-2 text-muted-foreground text-xs">{o.current}</div>
                          <div className="col-span-2 text-muted-foreground text-xs">→ {o.latest}</div>
                          <div className="col-span-3 text-right">
                            {o.majorBehind > 0 && (
                              <Badge variant="outline" className={cn("text-[10px]",
                                o.majorBehind >= 2 ? "border-rose-500/40 text-rose-400" : "border-amber-500/40 text-amber-400")}>
                                {o.majorBehind} major behind
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                      {deps.data.outdated.length > 8 && (
                        <button
                          onClick={() => setShowAllOutdated(v => !v)}
                          className="w-full text-xs text-primary hover:underline py-2 flex items-center justify-center gap-1"
                          data-testid="button-toggle-outdated"
                        >
                          {showAllOutdated ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          {showAllOutdated ? "Show less" : `Show all ${deps.data.outdated.length}`}
                        </button>
                      )}
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-3">
                    Tip: run <code className="px-1.5 py-0.5 rounded bg-muted">npm outdated</code> locally and bump packages
                    in small batches. Consider Dependabot or Renovate Bot for full automation.
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── REVIEW TAB ───────────────────────────────────────────── */}
        <TabsContent value="review" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileSignature className="w-4 h-4 text-primary" /> Quarterly RBAC review
              </CardTitle>
              <CardDescription>
                Sign off that you've reviewed every privileged account and confirmed each one still
                requires its current role. Records the attestation in the admin audit log.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {rbac.data?.lastReview ? (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-3 text-sm">
                  <div className="flex items-center gap-2 font-medium text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" /> Last reviewed by {rbac.data.lastReview.by}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(rbac.data.lastReview.at), "PPpp")} · next review in {rbac.data.reviewDueDays} day(s)
                  </div>
                  {rbac.data.lastReview.notes && (
                    <div className="text-xs mt-2 text-muted-foreground italic">"{rbac.data.lastReview.notes}"</div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-3 text-sm flex items-center gap-2 text-amber-400">
                  <AlertOctagon className="w-4 h-4" /> No attestation on record yet.
                </div>
              )}
              <Textarea
                placeholder="Notes (optional) — e.g. 'Demoted user X to enthusiast; super_admin count remains at 1.'"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={3}
                data-testid="textarea-review-notes"
              />
              <Button
                onClick={() => signMutation.mutate(reviewNotes)}
                disabled={signMutation.isPending}
                data-testid="button-sign-review"
              >
                {signMutation.isPending
                  ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  : <FileSignature className="w-3.5 h-3.5 mr-1.5" />}
                Sign quarterly review
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <FixPromptPanel section="Security Center" issues={securityFixIssues} />
    </div>
  );
}

function Skel() {
  return (
    <Card>
      <CardContent className="py-12 flex items-center justify-center text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </CardContent>
    </Card>
  );
}
