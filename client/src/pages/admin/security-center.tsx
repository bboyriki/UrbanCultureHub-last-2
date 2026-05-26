import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Shield, ShieldCheck, ShieldAlert, ShieldX, Loader2,
  Play, RefreshCw, Mail, Clock, ChevronDown, ChevronUp,
  AlertTriangle, Info, Zap, Lock, Eye, Settings, CheckCircle,
  XCircle, AlertCircle, BarChart3, Calendar, Send, Trash2, Download
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ScanFinding {
  id: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  detail: string;
  fix: string;
}

interface ScanSection {
  id: string;
  name: string;
  icon: string;
  score: number;
  status: "pass" | "warn" | "fail";
  findings: ScanFinding[];
  aiSummary: string;
}

interface SecurityReport {
  id: number;
  scanId: string;
  status: "pending" | "running" | "complete" | "failed";
  triggeredBy: "manual" | "scheduled";
  overallScore: number | null;
  grade: string | null;
  sections: ScanSection[];
  summary: string | null;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  emailSent: boolean;
  createdAt: string;
  completedAt: string | null;
}

interface SecuritySettings {
  scanEnabled: boolean;
  scanFrequency: "weekly" | "monthly";
  notifyEmail: string;
  lastScan: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const severityConfig = {
  critical: { color: "text-red-600", bg: "bg-red-50 border-red-200", badge: "bg-red-100 text-red-700 border-red-300", icon: XCircle },
  high: { color: "text-orange-600", bg: "bg-orange-50 border-orange-200", badge: "bg-orange-100 text-orange-700 border-orange-300", icon: AlertTriangle },
  medium: { color: "text-amber-600", bg: "bg-amber-50 border-amber-200", badge: "bg-amber-100 text-amber-700 border-amber-300", icon: AlertCircle },
  low: { color: "text-blue-600", bg: "bg-blue-50 border-blue-200", badge: "bg-blue-100 text-blue-700 border-blue-300", icon: Info },
  info: { color: "text-gray-500", bg: "bg-gray-50 border-gray-200", badge: "bg-gray-100 text-gray-600 border-gray-200", icon: Info },
};

const scoreToColor = (score: number) => {
  if (score >= 80) return { ring: "ring-green-400", text: "text-green-600", bg: "bg-green-50", progress: "bg-green-500" };
  if (score >= 60) return { ring: "ring-amber-400", text: "text-amber-600", bg: "bg-amber-50", progress: "bg-amber-500" };
  return { ring: "ring-red-400", text: "text-red-600", bg: "bg-red-50", progress: "bg-red-500" };
};

const gradeConfig: Record<string, { color: string; label: string }> = {
  A: { color: "text-green-600 bg-green-50 border-green-300", label: "Excellent" },
  B: { color: "text-blue-600 bg-blue-50 border-blue-300", label: "Good" },
  C: { color: "text-amber-600 bg-amber-50 border-amber-300", label: "Fair" },
  D: { color: "text-orange-600 bg-orange-50 border-orange-300", label: "Poor" },
  F: { color: "text-red-600 bg-red-50 border-red-300", label: "Critical" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function SectionCard({ section }: { section: ScanSection }) {
  const [open, setOpen] = useState(false);
  const colors = scoreToColor(section.score);
  const actionable = section.findings.filter(f => f.severity !== "info");

  return (
    <div className={cn("border rounded-xl overflow-hidden transition-all", open ? "shadow-md" : "shadow-sm")}>
      <button
        className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
        data-testid={`section-toggle-${section.id}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl flex-shrink-0">{section.icon}</span>
          <div className="min-w-0">
            <p className="font-semibold text-sm">{section.name}</p>
            {section.aiSummary && (
              <p className="text-xs text-muted-foreground truncate max-w-xs">{section.aiSummary}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-2">
          {actionable.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {actionable.length} issue{actionable.length !== 1 ? "s" : ""}
            </Badge>
          )}
          <div className={cn("font-bold text-lg w-12 text-right", colors.text)}>
            {section.score}
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      <div className="px-4 pb-1">
        <Progress
          value={section.score}
          className="h-1.5 rounded-full"
        />
      </div>

      {open && (
        <div className="border-t bg-gray-50/50 p-4 space-y-3">
          {section.aiSummary && (
            <div className="flex gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
              <Zap className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-indigo-800">{section.aiSummary}</p>
            </div>
          )}
          {section.findings.map(f => {
            const cfg = severityConfig[f.severity];
            const Icon = cfg.icon;
            return (
              <div key={f.id} className={cn("rounded-lg border p-3", cfg.bg)}>
                <div className="flex items-start gap-2">
                  <Icon className={cn("w-4 h-4 flex-shrink-0 mt-0.5", cfg.color)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full border", cfg.badge)}>
                        {f.severity.toUpperCase()}
                      </span>
                      <span className="font-semibold text-sm">{f.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">{f.detail}</p>
                    {f.severity !== "info" && (
                      <div className="flex items-start gap-1 mt-1">
                        <span className="text-xs text-blue-600">💡</span>
                        <p className="text-xs text-blue-700">{f.fix}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ScanningAnimation({ progress }: { progress: number }) {
  const stages = [
    "🔐 Checking authentication...",
    "🛡️ Auditing access control...",
    "🔒 Analyzing data privacy...",
    "⚡ Testing API security...",
    "✅ Validating input handling...",
    "📁 Reviewing file security...",
    "💳 Auditing payment safety...",
    "📦 Scanning dependencies...",
    "⚙️ Checking environment...",
    "🤖 AI generating report...",
  ];
  const stageIndex = Math.min(Math.floor((progress / 100) * stages.length), stages.length - 1);

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <div className="relative">
        <div className="w-24 h-24 rounded-full border-4 border-indigo-100 flex items-center justify-center">
          <Shield className="w-10 h-10 text-indigo-400 animate-pulse" />
        </div>
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-500 animate-spin" />
      </div>
      <div className="text-center space-y-2">
        <p className="font-semibold text-foreground">{stages[stageIndex]}</p>
        <p className="text-sm text-muted-foreground">AI-powered analysis in progress…</p>
      </div>
      <div className="w-full max-w-sm space-y-1">
        <Progress value={progress} className="h-2" />
        <p className="text-xs text-muted-foreground text-right">{progress}%</p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SecurityCenterPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [selectedReport, setSelectedReport] = useState<SecurityReport | null>(null);
  const [settingsEmail, setSettingsEmail] = useState("");
  const [settingsFreq, setSettingsFreq] = useState<"weekly" | "monthly">("weekly");
  const [settingsEnabled, setSettingsEnabled] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: reports = [], isLoading: reportsLoading } = useQuery<SecurityReport[]>({
    queryKey: ["/api/admin/security/reports"],
    refetchInterval: activeScanId ? 5000 : false,
  });

  const { data: settings } = useQuery<SecuritySettings>({
    queryKey: ["/api/admin/security/settings"],
  });

  // ── Sync settings to state ───────────────────────────────────────────────
  useEffect(() => {
    if (settings) {
      setSettingsEmail(settings.notifyEmail);
      setSettingsFreq(settings.scanFrequency);
      setSettingsEnabled(settings.scanEnabled);
    }
  }, [settings]);

  // ── Auto-select latest report ────────────────────────────────────────────
  useEffect(() => {
    if (reports.length > 0 && !selectedReport && !activeScanId) {
      const latest = reports.find(r => r.status === "complete");
      if (latest) setSelectedReport(latest);
    }
  }, [reports, selectedReport, activeScanId]);

  // ── Poll active scan ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeScanId) {
      if (pollRef.current) clearInterval(pollRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
      return;
    }

    // Fake progress: 0→90% over 60s, jump to 100 on complete
    setScanProgress(0);
    progressRef.current = setInterval(() => {
      setScanProgress(p => Math.min(p + 1.5, 90));
    }, 1000);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/security/reports/${activeScanId}`, { credentials: "include" });
        const data: SecurityReport = await res.json();
        if (data.status === "complete" || data.status === "failed") {
          clearInterval(pollRef.current!);
          clearInterval(progressRef.current!);
          setScanProgress(100);
          setActiveScanId(null);
          queryClient.invalidateQueries({ queryKey: ["/api/admin/security/reports"] });
          if (data.status === "complete") {
            setSelectedReport(data);
            toast({ title: "Scan complete!", description: `Score: ${data.overallScore}/100 (Grade ${data.grade})` });
          } else {
            toast({ title: "Scan failed", description: "Check server logs.", variant: "destructive" });
          }
        }
      } catch {}
    }, 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [activeScanId, queryClient, toast]);

  // ── Mutations ────────────────────────────────────────────────────────────
  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/admin/security/scan", "POST", { sendEmail });
      const data = await res.json();
      return data;
    },
    onSuccess: (data) => {
      setActiveScanId(data.scanId);
      setSelectedReport(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/security/reports"] });
      toast({ title: "Scan started", description: "AI analysis running in the background…" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to start scan", description: err.message, variant: "destructive" });
    },
  });

  // Delete a report
  const [deleteTarget, setDeleteTarget] = useState<SecurityReport | null>(null);
  const deleteMutation = useMutation({
    mutationFn: async (scanId: string) => {
      const res = await apiRequest(`/api/admin/security/reports/${scanId}`, "DELETE");
      return res.json();
    },
    onSuccess: (_data, scanId) => {
      if (selectedReport?.scanId === scanId) setSelectedReport(null);
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/security/reports"] });
      toast({ title: "Report deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to delete report", description: err.message, variant: "destructive" });
    },
  });

  // Re-send a report by email
  const resendMutation = useMutation({
    mutationFn: async (scanId: string) => {
      const res = await apiRequest(`/api/admin/security/reports/${scanId}/resend-email`, "POST", {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/security/reports"] });
      toast({ title: "Report email sent", description: data?.email ? `Sent to ${data.email}` : undefined });
    },
    onError: (err: any) => {
      toast({ title: "Failed to send report", description: err.message, variant: "destructive" });
    },
  });

  // Export the displayed report as a downloadable JSON file
  const exportReport = (report: SecurityReport) => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = report.completedAt
      ? format(new Date(report.completedAt), "yyyy-MM-dd-HHmm")
      : format(new Date(report.createdAt), "yyyy-MM-dd-HHmm");
    a.href = url;
    a.download = `security-report-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const settingsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/admin/security/settings", "POST", {
        scanEnabled: settingsEnabled,
        scanFrequency: settingsFreq,
        notifyEmail: settingsEmail,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/security/settings"] });
      toast({ title: "Settings saved" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to save settings", description: err.message, variant: "destructive" });
    },
  });

  // ── Render ───────────────────────────────────────────────────────────────
  const isScanning = !!activeScanId;
  const latestComplete = reports.find(r => r.status === "complete");
  const displayReport = selectedReport || latestComplete;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-indigo-100 rounded-xl">
              <Shield className="w-6 h-6 text-indigo-600" />
            </div>
            <h1 className="text-2xl font-bold">Security Center</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            AI-powered security & privacy analysis for Urban Culture Hub
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {settings?.lastScan && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              Last scan {formatDistanceToNow(new Date(settings.lastScan), { addSuffix: true })}
            </span>
          )}
          <Button
            onClick={() => scanMutation.mutate()}
            disabled={isScanning || scanMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            data-testid="button-run-scan"
          >
            {isScanning ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scanning…</>
            ) : (
              <><Play className="w-4 h-4 mr-2" /> Run Scan</>
            )}
          </Button>
        </div>
      </div>

      {/* Scanning Animation */}
      {isScanning && (
        <Card className="border-indigo-200 bg-indigo-50/30">
          <CardContent className="pt-4">
            <ScanningAnimation progress={scanProgress} />
          </CardContent>
        </Card>
      )}

      {/* Main content grid */}
      {!isScanning && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: report list + settings */}
          <div className="space-y-4">
            {/* Settings Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Settings className="w-4 h-4" /> Schedule Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Auto-scan enabled</Label>
                  <Switch
                    checked={settingsEnabled}
                    onCheckedChange={setSettingsEnabled}
                    data-testid="switch-auto-scan"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Frequency</Label>
                  <Select value={settingsFreq} onValueChange={(v: any) => setSettingsFreq(v)}>
                    <SelectTrigger className="h-8 text-sm" data-testid="select-frequency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Report email</Label>
                  <Input
                    className="h-8 text-sm"
                    type="email"
                    value={settingsEmail}
                    onChange={e => setSettingsEmail(e.target.value)}
                    placeholder="admin@example.com"
                    data-testid="input-notify-email"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Leave empty to skip emails. Manual scans fall back to your account email.
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Send email on next scan</Label>
                  <Switch
                    checked={sendEmail}
                    onCheckedChange={setSendEmail}
                    data-testid="switch-send-email"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => settingsMutation.mutate()}
                  disabled={settingsMutation.isPending}
                  data-testid="button-save-settings"
                >
                  {settingsMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                  Save Settings
                </Button>
              </CardContent>
            </Card>

            {/* Report history */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" /> Scan History
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-80 overflow-y-auto">
                {reportsLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : reports.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No scans yet. Run your first scan!</p>
                ) : (
                  reports.map(r => (
                    <div
                      key={r.id}
                      className={cn(
                        "group w-full p-2 rounded-lg border transition-colors",
                        selectedReport?.id === r.id ? "bg-indigo-50 border-indigo-200" : "hover:bg-gray-50 border-transparent"
                      )}
                      data-testid={`report-item-${r.id}`}
                    >
                      <button
                        className="w-full text-left"
                        onClick={() => r.status === "complete" ? setSelectedReport(r) : null}
                        disabled={r.status !== "complete"}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              {r.status === "complete" ? (
                                <ShieldCheck className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                              ) : r.status === "failed" ? (
                                <ShieldX className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                              ) : (
                                <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin flex-shrink-0" />
                              )}
                              <span className="text-xs font-medium truncate">
                                {r.status === "complete" ? `Score ${r.overallScore}/100` : r.status}
                              </span>
                              {r.grade && (
                                <span className={cn("text-xs font-bold px-1.5 rounded border", gradeConfig[r.grade]?.color)}>
                                  {r.grade}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })} · {r.triggeredBy}
                            </p>
                          </div>
                          {r.emailSent && (
                            <Mail className="w-3 h-3 text-muted-foreground flex-shrink-0" aria-label="Emailed" />
                          )}
                        </div>
                      </button>
                      {r.status === "complete" && (
                        <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            className="text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-indigo-100 text-indigo-700 disabled:opacity-50"
                            onClick={(e) => { e.stopPropagation(); resendMutation.mutate(r.scanId); }}
                            disabled={resendMutation.isPending}
                            data-testid={`button-resend-${r.id}`}
                            title="Re-send report email"
                          >
                            <Send className="w-2.5 h-2.5" /> Email
                          </button>
                          <button
                            type="button"
                            className="text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-gray-200 text-gray-700"
                            onClick={(e) => { e.stopPropagation(); exportReport(r); }}
                            data-testid={`button-export-${r.id}`}
                            title="Download report as JSON"
                          >
                            <Download className="w-2.5 h-2.5" /> JSON
                          </button>
                          <button
                            type="button"
                            className="text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-red-100 text-red-600 ml-auto"
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }}
                            data-testid={`button-delete-${r.id}`}
                            title="Delete report"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}
                      {r.status === "failed" && r.summary && (
                        <p className="text-[10px] text-red-600 mt-1 line-clamp-2" title={r.summary}>
                          {r.summary}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: report detail */}
          <div className="lg:col-span-2 space-y-4">
            {!displayReport ? (
              <Card className="h-full">
                <CardContent className="flex flex-col items-center justify-center h-64 text-center">
                  <Shield className="w-12 h-12 text-muted-foreground/30 mb-3" />
                  <p className="font-medium text-muted-foreground">No scan results yet</p>
                  <p className="text-sm text-muted-foreground/60 mt-1">Click "Run Scan" to start your first analysis</p>
                  <Button
                    className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white"
                    onClick={() => scanMutation.mutate()}
                    data-testid="button-run-scan-empty"
                  >
                    <Play className="w-4 h-4 mr-2" /> Run First Scan
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Score header */}
                <Card className="border-0 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-indigo-900 to-indigo-700 p-5 text-white relative">
                    <div className="absolute top-3 right-3 flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-indigo-100 hover:bg-white/10 hover:text-white"
                        onClick={() => exportReport(displayReport)}
                        data-testid="button-export-report"
                        title="Download as JSON"
                      >
                        <Download className="w-3.5 h-3.5 mr-1" /> JSON
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-indigo-100 hover:bg-white/10 hover:text-white"
                        onClick={() => resendMutation.mutate(displayReport.scanId)}
                        disabled={resendMutation.isPending}
                        data-testid="button-resend-report"
                        title="Re-send report email"
                      >
                        {resendMutation.isPending
                          ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                          : <Send className="w-3.5 h-3.5 mr-1" />}
                        Email
                      </Button>
                    </div>
                    <div className="flex items-center justify-between gap-4 pr-32">
                      <div>
                        <p className="text-indigo-200 text-xs uppercase tracking-wider mb-1">Security Score</p>
                        <div className="flex items-baseline gap-3">
                          <span className="text-5xl font-black">{displayReport.overallScore ?? "–"}</span>
                          <span className="text-indigo-300 text-lg">/ 100</span>
                          {displayReport.grade && (
                            <span className={cn("text-2xl font-black px-3 py-0.5 rounded-lg border-2", gradeConfig[displayReport.grade]?.color)}>
                              {displayReport.grade}
                            </span>
                          )}
                        </div>
                        {displayReport.completedAt && (
                          <p className="text-indigo-300 text-xs mt-1">
                            <Calendar className="w-3 h-3 inline mr-1" />
                            {format(new Date(displayReport.completedAt), "PPP 'at' HH:mm")}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-4 text-center">
                        {displayReport.criticalCount > 0 && (
                          <div>
                            <div className="text-2xl font-black text-red-300">{displayReport.criticalCount}</div>
                            <div className="text-xs text-indigo-300">Critical</div>
                          </div>
                        )}
                        {displayReport.highCount > 0 && (
                          <div>
                            <div className="text-2xl font-black text-orange-300">{displayReport.highCount}</div>
                            <div className="text-xs text-indigo-300">High</div>
                          </div>
                        )}
                        <div>
                          <div className="text-2xl font-black text-amber-300">{displayReport.mediumCount}</div>
                          <div className="text-xs text-indigo-300">Medium</div>
                        </div>
                        <div>
                          <div className="text-2xl font-black text-blue-300">{displayReport.lowCount}</div>
                          <div className="text-xs text-indigo-300">Low</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Critical/high alerts banner */}
                  {(displayReport.criticalCount > 0 || displayReport.highCount > 0) && (
                    <div className="p-4 bg-red-50 border-b border-red-200">
                      <div className="flex gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs font-bold text-red-700 mb-0.5 uppercase tracking-wide">
                            Action required
                          </p>
                          <p className="text-sm text-red-900">
                            {displayReport.criticalCount > 0 && (
                              <span className="font-semibold">{displayReport.criticalCount} critical</span>
                            )}
                            {displayReport.criticalCount > 0 && displayReport.highCount > 0 && " and "}
                            {displayReport.highCount > 0 && (
                              <span className="font-semibold">{displayReport.highCount} high-severity</span>
                            )}
                            {" "}finding{(displayReport.criticalCount + displayReport.highCount) !== 1 ? "s" : ""} need attention. Expand the affected sections below for fix guidance.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Executive summary */}
                  {displayReport.summary && (
                    <div className="p-4 bg-indigo-50 border-b border-indigo-100">
                      <div className="flex gap-2">
                        <Zap className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-indigo-700 mb-0.5 uppercase tracking-wide">AI Executive Summary</p>
                          <p className="text-sm text-indigo-900">{displayReport.summary}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>

                {/* Section breakdown */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Section Breakdown</h3>
                    <Badge variant="outline" className="text-xs ml-auto">
                      {displayReport.sections.length} areas analyzed
                    </Badge>
                  </div>
                  {displayReport.sections.map(section => (
                    <SectionCard key={section.id} section={section} />
                  ))}
                </div>

                {/* Email status */}
                {displayReport.emailSent && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                    <CheckCircle className="w-4 h-4" />
                    Report emailed to admin
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete-confirm dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this scan report?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  Score {deleteTarget.overallScore ?? "–"}/100 · {format(new Date(deleteTarget.createdAt), "PPP 'at' HH:mm")}.
                  This permanently removes the scan history. The scan itself cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.scanId)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
