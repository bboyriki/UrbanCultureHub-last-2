import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Download, FileSpreadsheet, FileText, FileDown, Brain, Sparkles, Filter,
  Building2, MapPin, Calendar, Users, Landmark, Target, RefreshCw,
  Plus, Edit3, Trash2, CheckCircle, Clock, XCircle, MessageSquare,
  Mail, Phone, Globe, Star, BarChart3, Zap, Search, ChevronDown,
  ChevronRight, Info, AlertCircle, TrendingUp, Award, Loader2, X,
  Eye, EyeOff, ArrowUpDown, Database, Layers, Bot, Send, Activity,
  ArrowRight, Flame, Shield, Map, Inbox,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type DataSource = "outreach_leads" | "gemeente" | "locations" | "events" | "spotlighted_places";

interface ExportFilters {
  sources: DataSource[];
  cities: string[];
  provinces: string[];
  types: string[];
  statuses: string[];
  categories: string[];
  search: string;
  limit: number;
}

interface GemeenteRecord {
  id: number;
  municipalityName: string;
  municipalityCode?: string;
  province?: string;
  city?: string;
  website?: string;
  department?: string;
  subDepartment?: string;
  departmentEmail?: string;
  departmentPhone?: string;
  contactName?: string;
  contactRole?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactLinkedin?: string;
  outreachStatus: string;
  outreachDate?: string;
  lastContactDate?: string;
  nextFollowUpDate?: string;
  emailSentCount?: number;
  outreachGoal?: string;
  priority?: string;
  hasUrbanCultureBudget?: boolean;
  culturalBudgetInfo?: string;
  internalNotes?: string;
  meetingNotes?: string;
  tags?: string[];
  aiScore?: number;
  aiSummary?: string;
  aiSuggestedApproach?: string;
  createdAt: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SOURCE_CONFIG: Record<DataSource, { label: string; icon: any; gradient: string; border: string; badge: string; description: string; count?: string }> = {
  outreach_leads:     { label: "Outreach Leads",     icon: Target,    gradient: "from-blue-600 to-indigo-700",   border: "border-blue-400/40",  badge: "bg-blue-500/20 text-blue-300",   description: "CRM leads, venues, sponsors, media" },
  gemeente:           { label: "Gemeente Outreach",  icon: Landmark,  gradient: "from-emerald-600 to-teal-700", border: "border-emerald-400/40",badge: "bg-emerald-500/20 text-emerald-300", description: "Municipality partnerships" },
  locations:          { label: "Map Spots",          icon: Map,       gradient: "from-orange-500 to-red-600",   border: "border-orange-400/40", badge: "bg-orange-500/20 text-orange-300",description: "70,000+ urban spots on the map", count: "70k+" },
  events:             { label: "Events",             icon: Calendar,  gradient: "from-purple-600 to-violet-700",border: "border-purple-400/40", badge: "bg-purple-500/20 text-purple-300",description: "All platform events" },
  spotlighted_places: { label: "Spotlighted Places", icon: Star,      gradient: "from-amber-500 to-yellow-600", border: "border-amber-400/40",  badge: "bg-amber-500/20 text-amber-300",  description: "Curated featured places" },
};

const OUTREACH_STATUS_CFG: Record<string, { label: string; color: string; dot: string }> = {
  niet_gecontacteerd: { label: "Niet Gecontacteerd", color: "bg-gray-800 text-gray-300 border-gray-700",       dot: "bg-gray-400" },
  gecontacteerd:      { label: "Gecontacteerd",       color: "bg-blue-900/60 text-blue-300 border-blue-700",   dot: "bg-blue-400" },
  reactie_ontvangen:  { label: "Reactie Ontvangen",   color: "bg-indigo-900/60 text-indigo-300 border-indigo-700", dot: "bg-indigo-400" },
  geinteresseerd:     { label: "Geïnteresseerd",      color: "bg-green-900/60 text-green-300 border-green-700",dot: "bg-green-400" },
  in_gesprek:         { label: "In Gesprek",           color: "bg-yellow-900/60 text-yellow-300 border-yellow-700", dot: "bg-yellow-400" },
  partnership:        { label: "Partnership",          color: "bg-emerald-900/60 text-emerald-300 border-emerald-700", dot: "bg-emerald-400 animate-pulse" },
  afgewezen:          { label: "Afgewezen",            color: "bg-red-900/60 text-red-300 border-red-700",     dot: "bg-red-400" },
};

const GOAL_OPTIONS = [
  { value: "subsidie", label: "Subsidie" },
  { value: "partnerschap", label: "Partnerschap" },
  { value: "pilot", label: "Pilot" },
  { value: "culturele_samenwerking", label: "Culturele Samenwerking" },
  { value: "evenement", label: "Evenement" },
  { value: "platform_adoptie", label: "Platform Adoptie" },
];

const DUTCH_PROVINCES = [
  "Noord-Holland", "Zuid-Holland", "Utrecht", "Noord-Brabant", "Gelderland",
  "Overijssel", "Friesland", "Groningen", "Drenthe", "Zeeland", "Limburg", "Flevoland",
];

const EMPTY_GEMEENTE: Partial<GemeenteRecord> = {
  municipalityName: "", province: "", city: "", department: "", departmentEmail: "",
  website: "", contactName: "", contactRole: "", contactEmail: "", contactPhone: "",
  outreachStatus: "niet_gecontacteerd", priority: "medium", outreachGoal: "partnerschap",
  internalNotes: "", tags: [],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d?: string | null) {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}

function scoreColor(score?: number | null) {
  if (!score) return "text-gray-500";
  if (score >= 80) return "text-emerald-400 font-bold";
  if (score >= 60) return "text-yellow-400 font-bold";
  return "text-red-400 font-bold";
}

function scoreBg(score?: number | null) {
  if (!score) return "bg-gray-800";
  if (score >= 80) return "bg-emerald-500/20 border-emerald-500/40";
  if (score >= 60) return "bg-yellow-500/20 border-yellow-500/40";
  return "bg-red-500/20 border-red-500/40";
}

// ── Animated counter ──────────────────────────────────────────────────────────
function AnimatedCounter({ target, duration = 1200 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress >= 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return <>{count.toLocaleString()}</>;
}

// ── Particle dots background ──────────────────────────────────────────────────
function GlowOrb({ className }: { className: string }) {
  return <div className={`absolute rounded-full blur-3xl opacity-20 pointer-events-none ${className}`} />;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function LeadExportPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("export");

  // ── Export state ──
  const [filters, setFilters] = useState<ExportFilters>({
    sources: ["outreach_leads"],
    cities: [], provinces: [], types: [], statuses: [], categories: [],
    search: "", limit: 0, // 0 = all records
  });
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState(0);

  // ── Gemeente state ──
  const [gemeenteDialog, setGemeenteDialog] = useState(false);
  const [editingGemeente, setEditingGemeente] = useState<Partial<GemeenteRecord>>(EMPTY_GEMEENTE);
  const [gemeenteSearch, setGemeenteSearch] = useState("");
  const [gemeenteStatusFilter, setGemeenteStatusFilter] = useState("");
  const [gemeenteProvinceFilter, setGemeenteProvinceFilter] = useState("");
  const [isScoringId, setIsScoringId] = useState<number | null>(null);
  const [expandedGemeente, setExpandedGemeente] = useState<number | null>(null);

  // ── Gemeente data ──────────────────────────────────────────────────────────
  const { data: gemeenteData = [], isLoading: gemeenteLoading } = useQuery<GemeenteRecord[]>({
    queryKey: ["/api/admin/gemeente", gemeenteSearch, gemeenteStatusFilter, gemeenteProvinceFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (gemeenteSearch) params.set("search", gemeenteSearch);
      if (gemeenteStatusFilter) params.set("status", gemeenteStatusFilter);
      if (gemeenteProvinceFilter) params.set("province", gemeenteProvinceFilter);
      const r = await apiRequest(`/api/admin/gemeente?${params}`, "GET");
      return r.json();
    },
  });

  // ── Gemeente mutations ────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<GemeenteRecord>) => {
      if (data.id) {
        const r = await apiRequest(`/api/admin/gemeente/${data.id}`, "PATCH", data);
        return r.json();
      }
      const r = await apiRequest("/api/admin/gemeente", "POST", data);
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/gemeente"] });
      setGemeenteDialog(false);
      setEditingGemeente(EMPTY_GEMEENTE);
      toast({ title: "Saved", description: "Municipality record saved." });
    },
    onError: () => toast({ title: "Error", description: "Failed to save.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest(`/api/admin/gemeente/${id}`, "DELETE");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/gemeente"] });
      toast({ title: "Deleted" });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete.", variant: "destructive" }),
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("/api/admin/gemeente/seed-defaults", "POST");
      return r.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/gemeente"] });
      toast({ title: "Seeded", description: `Added ${data.added} default gemeente records.` });
    },
    onError: () => toast({ title: "Seed failed", variant: "destructive" }),
  });

  const migrateMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("/api/admin/export/migrate", "POST");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Database ready", description: "Tables created/verified." });
      qc.invalidateQueries({ queryKey: ["/api/admin/gemeente"] });
    },
    onError: (e: any) => toast({ title: "Migration error", description: e.message, variant: "destructive" }),
  });

  // ── Export limit: 0 = no limit (all records) ──────────────────────────────
  const effectiveLimit = filters.sources.includes("locations")
    ? 999999  // always unlimited for spots
    : (filters.limit === 0 ? 999999 : filters.limit);

  // ── Load preview data ──────────────────────────────────────────────────────
  // Uses the new per-source preview endpoint. When multiple sources are
  // selected we fetch each in parallel and tag rows with their source so the
  // existing preview UI can colour-code them, but the data stays cleanly
  // separated server-side (no mixing in the actual export).
  const loadPreview = async () => {
    if (!filters.sources.length) {
      toast({ title: "Select a source", description: "Pick at least one data source to preview.", variant: "destructive" });
      return;
    }
    setIsLoadingPreview(true);
    try {
      const sharedFilters = {
        cities: filters.cities.filter(Boolean),
        provinces: filters.provinces.filter(Boolean),
        types: filters.types.filter(Boolean),
        statuses: filters.statuses.filter(Boolean),
        categories: filters.categories.filter(Boolean),
        search: filters.search || undefined,
      };
      const SRC_TAG: Record<DataSource, string> = {
        outreach_leads: "outreach_lead",
        gemeente: "gemeente",
        locations: "location",
        events: "event",
        spotlighted_places: "spotlighted_place",
      };
      const perSourceLimit = Math.max(20, Math.floor(200 / filters.sources.length));
      const results = await Promise.all(filters.sources.map(async (src) => {
        const r = await apiRequest("/api/admin/export/preview", "POST", {
          source: src,
          filters: sharedFilters,
          limit: perSourceLimit,
        });
        const json = await r.json();
        const rows = (json.rows || []).map((row: any) => ({ ...row, _source: SRC_TAG[src] }));
        return { src, rows, total: json.total || 0 };
      }));
      const allRows = results.flatMap(r => r.rows);
      const grandTotal = results.reduce((a, r) => a + r.total, 0);
      setPreviewData(allRows);
      setPreviewTotal(grandTotal);
      setShowPreview(true);
    } catch (e: any) {
      toast({ title: "Error loading preview", description: e?.message, variant: "destructive" });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // ── AI Analysis ───────────────────────────────────────────────────────────
  const runAiAnalysis = async () => {
    if (!previewData.length) {
      await loadPreview();
      return;
    }
    setIsAnalyzing(true);
    try {
      const r = await apiRequest("/api/admin/export/ai-analyze", "POST", {
        leads: previewData.slice(0, 100),
        analysisType: "full",
      });
      const { analysis } = await r.json();
      setAiAnalysis(analysis);
    } catch {
      toast({ title: "AI analysis failed", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── Export functions ───────────────────────────────────────────────────────
  // Each selected source is exported as its OWN file (or ZIP-of-parts for
  // huge datasets like the 70k+ map spots). No more browser-roundtrip of the
  // raw data — the server streams the finished file directly.
  // The `effectiveLimit` is intentionally not sent: the new builder always
  // exports the full filtered dataset for the chosen source.
  const doExport = async (type: "csv" | "excel" | "pdf") => {
    if (!filters.sources.length) {
      toast({ title: "Select a source", description: "Pick at least one data source first.", variant: "destructive" });
      return;
    }

    const fmt: "csv" | "xlsx" | "pdf" = type === "excel" ? "xlsx" : type;
    setIsExporting(type);
    setExportProgress(0);
    const progressInterval = setInterval(() => {
      setExportProgress(p => Math.min(p + Math.random() * 8, 88));
    }, 500);

    const sharedFilters = {
      cities: filters.cities.filter(Boolean),
      provinces: filters.provinces.filter(Boolean),
      types: filters.types.filter(Boolean),
      statuses: filters.statuses.filter(Boolean),
      categories: filters.categories.filter(Boolean),
      search: filters.search || undefined,
    };

    let totalRecords = 0;
    let totalParts = 0;
    let filesDownloaded = 0;
    const skippedSources: string[] = [];

    try {
      // Run each source sequentially so the browser doesn't try to start 5
      // simultaneous downloads (which most browsers block).
      for (const src of filters.sources) {
        const cfgLabel = SOURCE_CONFIG[src]?.label || src;
        try {
          const resp = await fetch("/api/admin/export/build", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              source: src,
              format: fmt,
              filters: sharedFilters,
              label: `uch-${src}`,
            }),
          });

          if (!resp.ok) {
            if (resp.status === 404) {
              skippedSources.push(`${cfgLabel} (no records)`);
              continue;
            }
            const errBody = await resp.json().catch(() => ({ message: resp.statusText }));
            throw new Error(errBody.message || `HTTP ${resp.status}`);
          }

          // Honour server-provided counts so the toast is accurate
          const partCount = parseInt(resp.headers.get("X-Export-Parts") || "1", 10);
          const partTotal = parseInt(resp.headers.get("X-Export-Total") || "0", 10);
          totalRecords += partTotal;
          totalParts += partCount;

          // Pull filename from Content-Disposition header
          const disp = resp.headers.get("Content-Disposition") || "";
          const m = disp.match(/filename="?([^";]+)"?/i);
          const fname = m ? m[1] : `uch-${src}-${today()}.${partCount > 1 ? "zip" : fmt}`;

          const blob = await resp.blob();
          triggerDownload(blob, fname);
          filesDownloaded += 1;
        } catch (e: any) {
          skippedSources.push(`${cfgLabel} (${e?.message || "failed"})`);
        }
      }

      setExportProgress(100);

      if (filesDownloaded === 0) {
        toast({
          title: "Nothing exported",
          description: skippedSources.length ? skippedSources.join("; ") : "No records matched.",
          variant: "destructive",
        });
      } else {
        const partNote = totalParts > filesDownloaded
          ? ` — split into ${totalParts} ZIP part-file${totalParts > 1 ? "s" : ""}`
          : "";
        const skipNote = skippedSources.length ? ` Skipped: ${skippedSources.join(", ")}.` : "";
        toast({
          title: `✓ ${type.toUpperCase()} exported`,
          description: `${totalRecords.toLocaleString()} records across ${filesDownloaded} file${filesDownloaded > 1 ? "s" : ""}${partNote}.${skipNote}`,
        });
      }
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    } finally {
      clearInterval(progressInterval);
      setTimeout(() => { setIsExporting(null); setExportProgress(0); }, 800);
    }
  };

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function today() {
    return new Date().toISOString().split("T")[0];
  }

  // ── Score gemeente record ─────────────────────────────────────────────────
  const scoreGemeente = async (id: number) => {
    setIsScoringId(id);
    try {
      await apiRequest(`/api/admin/gemeente/${id}/ai-score`, "POST");
      qc.invalidateQueries({ queryKey: ["/api/admin/gemeente"] });
      toast({ title: "Scored!", description: "AI score updated." });
    } catch {
      toast({ title: "Scoring failed", variant: "destructive" });
    } finally {
      setIsScoringId(null);
    }
  };

  const toggleSource = (src: DataSource) => {
    setFilters(f => ({
      ...f,
      sources: f.sources.includes(src) ? f.sources.filter(s => s !== src) : [...f.sources, src],
    }));
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const gemeenteStats = useMemo(() => {
    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    for (const g of gemeenteData) {
      byStatus[g.outreachStatus] = (byStatus[g.outreachStatus] || 0) + 1;
      byPriority[g.priority || "medium"] = (byPriority[g.priority || "medium"] || 0) + 1;
    }
    return { byStatus, byPriority, total: gemeenteData.length };
  }, [gemeenteData]);

  // ── Source icons for preview ───────────────────────────────────────────────
  const sourceColors: Record<string, string> = {
    outreach_lead: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
    gemeente: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
    location: "bg-orange-500/20 text-orange-300 border border-orange-500/30",
    event: "bg-purple-500/20 text-purple-300 border border-purple-500/30",
    spotlighted_place: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#080b14] text-white">
      {/* ── Animated Hero Header ────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0d1220] via-[#111827] to-[#0a0f1c] border-b border-white/5">
        <GlowOrb className="w-96 h-96 bg-blue-600 -top-32 -left-32" />
        <GlowOrb className="w-64 h-64 bg-emerald-500 top-0 right-1/3" />
        <GlowOrb className="w-80 h-80 bg-violet-600 -bottom-20 right-0" />

        {/* Animated grid pattern */}
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

        <div className="relative max-w-7xl mx-auto px-6 py-10">
          <div className="flex items-start justify-between flex-wrap gap-6">
            <div>
              <div className="flex items-center gap-4 mb-3">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 via-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <Database className="h-7 w-7 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-[#0d1220] animate-pulse" />
                </div>
                <div>
                  <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white via-blue-200 to-emerald-300 bg-clip-text text-transparent">
                    Outreach Intelligence
                  </h1>
                  <p className="text-gray-400 text-sm mt-0.5">AI-powered lead export & municipality outreach system</p>
                </div>
              </div>

              {/* Source pills */}
              <div className="flex flex-wrap gap-2 mt-4">
                {(Object.entries(SOURCE_CONFIG) as [DataSource, any][]).map(([src, cfg]) => {
                  const Icon = cfg.icon;
                  return (
                    <span key={src} className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-3 py-1 text-xs text-gray-300 transition-all">
                      <Icon className="h-3 w-3 text-gray-400" />
                      {cfg.label}
                      {cfg.count && <span className="ml-1 text-orange-400 font-bold">{cfg.count}</span>}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="border-white/10 text-gray-300 hover:bg-white/10 bg-white/5 rounded-xl h-9"
                onClick={() => migrateMutation.mutate()}
                disabled={migrateMutation.isPending}
                data-testid="button-migrate-db"
              >
                {migrateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Database className="h-4 w-4 mr-1.5" />}
                Setup DB
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 bg-white/5 border border-white/10 p-1 rounded-2xl shadow-sm h-auto flex gap-1">
            {[
              { value: "export", icon: Download, label: "Export Intelligence", color: "from-blue-500 to-indigo-600" },
              { value: "gemeente", icon: Landmark, label: "Gemeente Outreach", color: "from-emerald-500 to-teal-600" },
              { value: "ai", icon: Brain, label: "AI Intelligence", color: "from-violet-500 to-purple-600" },
            ].map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.value;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  data-testid={`tab-${tab.value}`}
                  className={`rounded-xl px-5 py-2.5 text-sm font-medium transition-all duration-200 flex items-center gap-2
                    ${active
                      ? `bg-gradient-to-r ${tab.color} text-white shadow-lg`
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* ══════════════════ TAB: EXPORT ══════════════════ */}
          <TabsContent value="export" className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

              {/* Left: Filter Panel */}
              <div className="lg:col-span-1 space-y-4">

                {/* Data Sources */}
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <Layers className="h-3.5 w-3.5 text-blue-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-white">Data Sources</h3>
                  </div>
                  <div className="space-y-2">
                    {(Object.entries(SOURCE_CONFIG) as [DataSource, any][]).map(([src, cfg]) => {
                      const Icon = cfg.icon;
                      const selected = filters.sources.includes(src);
                      return (
                        <button
                          key={src}
                          onClick={() => toggleSource(src)}
                          data-testid={`source-toggle-${src}`}
                          className={`w-full flex items-start gap-3 p-3 rounded-xl border transition-all duration-200 text-left group ${
                            selected
                              ? `bg-gradient-to-r ${cfg.gradient} bg-opacity-10 ${cfg.border} border-opacity-60`
                              : "border-white/5 hover:border-white/15 hover:bg-white/5"
                          }`}
                          style={selected ? { background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)" } : {}}
                        >
                          <div className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${selected ? "border-white bg-white/20" : "border-white/20 group-hover:border-white/40"}`}>
                            {selected && <CheckCircle className="h-3.5 w-3.5 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className={`w-5 h-5 rounded bg-gradient-to-br ${cfg.gradient} flex items-center justify-center`}>
                                <Icon className="h-3 w-3 text-white" />
                              </div>
                              <span className="text-sm font-medium text-white">{cfg.label}</span>
                              {cfg.count && <span className="text-xs font-bold text-orange-400 ml-auto">{cfg.count}</span>}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{cfg.description}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Filters */}
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Filter className="h-3.5 w-3.5 text-purple-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-white">Filters</h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-gray-400 mb-1.5 block">Search</Label>
                      <div className="relative">
                        <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-gray-500" />
                        <Input
                          placeholder="Name, city, email..."
                          value={filters.search}
                          onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                          className="pl-8 h-9 text-sm bg-white/5 border-white/10 text-white placeholder:text-gray-600 rounded-xl focus:border-blue-500/50"
                          data-testid="input-export-search"
                        />
                      </div>
                    </div>

                    {filters.sources.includes("outreach_leads") && (
                      <div>
                        <Label className="text-xs text-gray-400 mb-1.5 block">Lead Types</Label>
                        <div className="flex flex-wrap gap-1">
                          {["municipality", "venue", "cultural_org", "media", "sponsor"].map(t => (
                            <button
                              key={t}
                              onClick={() => setFilters(f => ({
                                ...f,
                                types: f.types.includes(t) ? f.types.filter(x => x !== t) : [...f.types, t],
                              }))}
                              data-testid={`filter-type-${t}`}
                              className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                                filters.types.includes(t)
                                  ? "bg-blue-500 text-white border-blue-500"
                                  : "border-white/15 text-gray-400 hover:border-blue-400/50 hover:text-white"
                              }`}
                            >
                              {t.replace("_", " ")}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {filters.sources.includes("gemeente") && (
                      <div>
                        <Label className="text-xs text-gray-400 mb-1.5 block">Province</Label>
                        <div className="flex flex-wrap gap-1">
                          {["Noord-Holland", "Zuid-Holland", "Utrecht", "Noord-Brabant"].map(p => (
                            <button
                              key={p}
                              onClick={() => setFilters(f => ({
                                ...f,
                                provinces: f.provinces.includes(p) ? f.provinces.filter(x => x !== p) : [...f.provinces, p],
                              }))}
                              className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                                filters.provinces.includes(p)
                                  ? "bg-emerald-500 text-white border-emerald-500"
                                  : "border-white/15 text-gray-400 hover:border-emerald-400/50 hover:text-white"
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Limit – hidden for locations (always all) */}
                    {!filters.sources.every(s => s === "locations") && (
                      <div>
                        <Label className="text-xs text-gray-400 mb-1.5 block">
                          Record Limit
                          {filters.sources.includes("locations") && (
                            <span className="ml-2 text-orange-400 font-semibold">Spots: always all</span>
                          )}
                        </Label>
                        <Select value={String(filters.limit)} onValueChange={v => setFilters(f => ({ ...f, limit: Number(v) }))}>
                          <SelectTrigger className="h-9 text-sm bg-white/5 border-white/10 text-white rounded-xl" data-testid="select-limit">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-900 border-white/10 text-white">
                            <SelectItem value="0">All Records (no limit)</SelectItem>
                            <SelectItem value="500">500 records</SelectItem>
                            <SelectItem value="1000">1,000 records</SelectItem>
                            <SelectItem value="5000">5,000 records</SelectItem>
                            <SelectItem value="10000">10,000 records</SelectItem>
                            <SelectItem value="50000">50,000 records</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Note for locations */}
                    {filters.sources.includes("locations") && (
                      <div className="flex items-start gap-2 bg-orange-500/10 border border-orange-500/20 rounded-xl p-3">
                        <Map className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-orange-300">All 37,000+ spots</p>
                          <p className="text-xs text-orange-400/70 mt-0.5">Map spots export has no limit. Use CSV or Excel for large datasets.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Export Panel */}
              <div className="lg:col-span-2 space-y-4">

                {/* Export Actions Card */}
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <Download className="h-3.5 w-3.5 text-blue-400" />
                    </div>
                    <h3 className="text-base font-semibold text-white">Export Data</h3>
                    {filters.sources.length > 0 && (
                      <div className="ml-auto flex flex-wrap gap-1">
                        {filters.sources.map(src => {
                          const cfg = SOURCE_CONFIG[src];
                          const Icon = cfg.icon;
                          return (
                            <span key={src} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${cfg.badge}`}>
                              <Icon className="h-2.5 w-2.5" />
                              {cfg.label}
                              <button onClick={() => toggleSource(src)} className="ml-0.5 hover:opacity-60">
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Export buttons */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { type: "pdf" as const,   label: "PDF Report",  sub: "Max 5k records", icon: FileText,       gradient: "from-red-600 to-rose-700",     glow: "shadow-red-500/30",    ring: "ring-red-500/30" },
                      { type: "excel" as const, label: "Excel",       sub: "All records",    icon: FileSpreadsheet, gradient: "from-emerald-600 to-teal-700", glow: "shadow-emerald-500/30",ring: "ring-emerald-500/30" },
                      { type: "csv" as const,   label: "CSV",         sub: "All records",    icon: FileDown,        gradient: "from-blue-600 to-indigo-700",  glow: "shadow-blue-500/30",   ring: "ring-blue-500/30" },
                    ].map(({ type, label, sub, icon: Icon, gradient, glow, ring }) => (
                      <button
                        key={type}
                        onClick={() => doExport(type)}
                        disabled={!!isExporting || filters.sources.length === 0}
                        data-testid={`button-export-${type}`}
                        className={`relative flex flex-col items-center gap-2.5 p-5 rounded-2xl border border-white/10 transition-all duration-300 disabled:opacity-40 group overflow-hidden
                          hover:scale-[1.03] hover:shadow-lg hover:${glow} hover:ring-1 hover:${ring}
                          ${isExporting === type ? "scale-[1.03] shadow-lg" : ""}`}
                        style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)" }}
                      >
                        {/* Animated bg on hover */}
                        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300 rounded-2xl`} />

                        {isExporting === type ? (
                          <div className="relative">
                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
                              <Loader2 className="h-6 w-6 text-white animate-spin" />
                            </div>
                          </div>
                        ) : (
                          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110`}>
                            <Icon className="h-6 w-6 text-white" />
                          </div>
                        )}
                        <div className="text-center relative">
                          <p className="font-bold text-white text-sm">{label}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
                        </div>

                        {/* Progress bar */}
                        {isExporting === type && (
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5 rounded-b-2xl overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${gradient} transition-all duration-300`}
                              style={{ width: `${exportProgress}%` }}
                            />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadPreview}
                      disabled={filters.sources.length === 0 || isLoadingPreview}
                      className="flex-1 border-white/10 text-gray-300 hover:bg-white/10 bg-white/5 rounded-xl"
                      data-testid="button-preview"
                    >
                      {isLoadingPreview ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Eye className="h-4 w-4 mr-1.5" />}
                      Preview Data
                    </Button>
                    <Button
                      size="sm"
                      onClick={runAiAnalysis}
                      disabled={isAnalyzing || filters.sources.length === 0}
                      className="flex-1 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white rounded-xl shadow-lg shadow-violet-500/20 border-0"
                      data-testid="button-ai-analyze"
                    >
                      {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
                      AI Analyze
                    </Button>
                  </div>

                  {filters.sources.length === 0 && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 bg-white/3 rounded-xl p-3 border border-white/5">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      Select at least one data source to enable export
                    </div>
                  )}
                </div>

                {/* Preview table */}
                {showPreview && previewData.length > 0 && (
                  <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-white/5">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-semibold text-white">Data Preview</span>
                        <span className="text-xs bg-white/10 text-gray-300 rounded-full px-2 py-0.5">
                          {previewData.length} shown
                          {previewTotal > previewData.length && ` of ${previewTotal.toLocaleString()} total`}
                        </span>
                      </div>
                      <button onClick={() => setShowPreview(false)} className="text-gray-500 hover:text-white transition-colors" data-testid="button-close-preview">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="overflow-auto max-h-80">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-[#0d1220]/95 backdrop-blur">
                          <tr className="border-b border-white/5">
                            {["Source", "Name / Org", "Type", "City / Address", "Email", "Status"].map(h => (
                              <th key={h} className="text-left px-4 py-2.5 font-medium text-gray-400 text-xs">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.map((row, i) => (
                            <tr key={i} className="border-b border-white/3 hover:bg-white/3 transition-colors" data-testid={`preview-row-${i}`}>
                              <td className="px-4 py-2">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${sourceColors[row._source] || "bg-gray-800 text-gray-400"}`}>
                                  {(row._source || "data").replace("_", " ")}
                                </span>
                              </td>
                              <td className="px-4 py-2 font-medium text-white max-w-[160px] truncate">{row.name || row.organization || "—"}</td>
                              <td className="px-4 py-2 text-gray-400">{row.type || row.category || "—"}</td>
                              <td className="px-4 py-2 text-gray-400 max-w-[140px] truncate">{row.city || row.address || "—"}</td>
                              <td className="px-4 py-2">
                                {row.email ? (
                                  <span className="text-emerald-400">✓</span>
                                ) : <span className="text-gray-600">—</span>}
                              </td>
                              <td className="px-4 py-2">
                                {row.status && (
                                  <span className="text-xs bg-white/10 text-gray-300 rounded px-1.5 py-0.5">
                                    {row.status}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {previewData.length > 0 && previewTotal > previewData.length && (
                        <div className="px-4 py-2.5 text-center text-xs text-gray-500 bg-white/2 border-t border-white/5">
                          Showing {previewData.length} of {previewTotal.toLocaleString()} records. Export to get all.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* AI Analysis panel (if on export tab) */}
                {aiAnalysis && (
                  <div className="bg-gradient-to-br from-violet-950/30 via-[#0d1220] to-blue-950/20 border border-violet-500/20 rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-violet-500/10">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center">
                          <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                        </div>
                        <span className="text-sm font-semibold text-white">AI Analysis Results</span>
                      </div>
                      {aiAnalysis.overallScore && (
                        <div className="flex items-center gap-2 bg-violet-500/20 border border-violet-500/30 rounded-full px-3 py-1">
                          <Star className="h-3.5 w-3.5 text-yellow-400" />
                          <span className="text-sm font-bold text-violet-300">{aiAnalysis.overallScore}/100</span>
                        </div>
                      )}
                    </div>
                    <div className="p-5 space-y-4 overflow-auto max-h-[500px]">
                      {aiAnalysis.executiveSummary && (
                        <div className="bg-white/3 rounded-xl p-4 border border-white/5">
                          <p className="text-xs font-bold text-violet-400 uppercase tracking-wider mb-2">Executive Summary</p>
                          <p className="text-sm text-gray-300 leading-relaxed">{aiAnalysis.executiveSummary}</p>
                        </div>
                      )}
                      {aiAnalysis.topInsights?.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Top Insights</p>
                          <div className="space-y-2">
                            {aiAnalysis.topInsights.map((insight: string, i: number) => (
                              <div key={i} className="flex items-start gap-2.5 bg-white/3 rounded-xl p-3 border border-white/5">
                                <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
                                  <CheckCircle className="h-3 w-3 text-emerald-400" />
                                </div>
                                <span className="text-sm text-gray-300">{insight}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {aiAnalysis.quickWins?.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Quick Wins</p>
                          <div className="flex flex-wrap gap-2">
                            {aiAnalysis.quickWins.map((w: string, i: number) => (
                              <span key={i} className="flex items-center gap-1.5 text-xs bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 rounded-full px-3 py-1.5">
                                <Zap className="h-3 w-3" />{w}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {aiAnalysis.highPriorityLeads?.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">High Priority</p>
                          <div className="flex flex-wrap gap-1.5">
                            {aiAnalysis.highPriorityLeads.map((lead: string, i: number) => (
                              <span key={i} className="text-xs bg-amber-500/15 border border-amber-500/25 text-amber-300 rounded-full px-2.5 py-1">
                                ⭐ {lead}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ══════════════════ TAB: GEMEENTE ══════════════════ */}
          <TabsContent value="gemeente" className="space-y-5">

            {/* Stats bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total", value: gemeenteStats.total, icon: Landmark, color: "from-emerald-600 to-teal-700", glow: "shadow-emerald-500/20" },
                { label: "Partnerships", value: gemeenteStats.byStatus.partnership || 0, icon: CheckCircle, color: "from-green-600 to-emerald-700", glow: "shadow-green-500/20" },
                { label: "In Gesprek", value: gemeenteStats.byStatus.in_gesprek || 0, icon: MessageSquare, color: "from-blue-600 to-indigo-700", glow: "shadow-blue-500/20" },
                { label: "High Priority", value: gemeenteStats.byPriority?.high || 0, icon: Flame, color: "from-red-600 to-orange-700", glow: "shadow-red-500/20" },
              ].map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={i}
                    className={`relative bg-white/[0.03] border border-white/10 rounded-2xl p-5 overflow-hidden hover:shadow-lg hover:${stat.glow} transition-all duration-300`}
                  >
                    <div className={`absolute -top-4 -right-4 w-20 h-20 rounded-full bg-gradient-to-br ${stat.color} opacity-10`} />
                    <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3 shadow-md`}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <div className="text-2xl font-black text-white">
                      <AnimatedCounter target={stat.value} />
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
                  </div>
                );
              })}
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap gap-3 items-center justify-between bg-white/[0.03] border border-white/10 rounded-2xl p-4">
              <div className="flex gap-2 flex-1 flex-wrap">
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                  <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-gray-500" />
                  <Input
                    placeholder="Search municipalities..."
                    value={gemeenteSearch}
                    onChange={e => setGemeenteSearch(e.target.value)}
                    className="pl-8 h-9 text-sm bg-white/5 border-white/10 text-white placeholder:text-gray-600 rounded-xl focus:border-emerald-500/50"
                    data-testid="input-gemeente-search"
                  />
                </div>
                <Select value={gemeenteStatusFilter || "all"} onValueChange={v => setGemeenteStatusFilter(v === "all" ? "" : v)}>
                  <SelectTrigger className="h-9 text-sm w-48 bg-white/5 border-white/10 text-white rounded-xl" data-testid="select-gemeente-status">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-white/10 text-white">
                    <SelectItem value="all">All statuses</SelectItem>
                    {Object.entries(OUTREACH_STATUS_CFG).map(([v, c]) => (
                      <SelectItem key={v} value={v}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={gemeenteProvinceFilter || "all"} onValueChange={v => setGemeenteProvinceFilter(v === "all" ? "" : v)}>
                  <SelectTrigger className="h-9 text-sm w-44 bg-white/5 border-white/10 text-white rounded-xl" data-testid="select-gemeente-province">
                    <SelectValue placeholder="All provinces" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-white/10 text-white">
                    <SelectItem value="all">All provinces</SelectItem>
                    {DUTCH_PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                {gemeenteData.length === 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      migrateMutation.mutate(undefined, {
                        onSuccess: () => setTimeout(() => seedMutation.mutate(), 500),
                      });
                    }}
                    disabled={seedMutation.isPending || migrateMutation.isPending}
                    data-testid="button-seed-gemeente"
                    className="border-white/10 text-gray-300 hover:bg-white/10 bg-white/5 rounded-xl"
                  >
                    {(seedMutation.isPending || migrateMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Database className="h-4 w-4 mr-1.5" />}
                    Load Defaults
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => { setEditingGemeente(EMPTY_GEMEENTE); setGemeenteDialog(true); }}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl shadow-lg shadow-emerald-500/20 border-0"
                  data-testid="button-add-gemeente"
                >
                  <Plus className="h-4 w-4 mr-1.5" />Add Municipality
                </Button>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
              {gemeenteLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                    <p className="text-sm text-gray-500">Loading municipalities...</p>
                  </div>
                </div>
              ) : gemeenteData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                    <Landmark className="h-8 w-8 text-gray-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400 font-medium">No municipality records yet</p>
                    <p className="text-sm text-gray-600 mt-1">Click "Load Defaults" to get started with 15 Dutch gemeenten</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-white/[0.02] border-b border-white/5">
                      <tr>
                        {["Municipality", "Department / Contact", "Status", "Priority", "AI Score", "Goal", ""].map(h => (
                          <th key={h} className="text-left px-4 py-3 font-medium text-gray-400 text-xs">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/3">
                      {gemeenteData.map(g => {
                        const statusCfg = OUTREACH_STATUS_CFG[g.outreachStatus] || { label: g.outreachStatus, color: "bg-gray-800 text-gray-400", dot: "bg-gray-400" };
                        const isExpanded = expandedGemeente === g.id;
                        return (
                          <>
                            <tr
                              key={g.id}
                              className="hover:bg-white/[0.03] transition-all duration-150 cursor-pointer"
                              data-testid={`gemeente-row-${g.id}`}
                              onClick={() => setExpandedGemeente(isExpanded ? null : g.id)}
                            >
                              <td className="px-4 py-3">
                                <div className="font-semibold text-white">{g.municipalityName}</div>
                                <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                  {g.city && <><MapPin className="h-2.5 w-2.5 text-gray-600" />{g.city}</>}
                                  {g.province && <span className="text-gray-600">· {g.province}</span>}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-xs font-medium text-gray-200">{g.department || "—"}</div>
                                {g.contactName && <div className="text-xs text-gray-500 mt-0.5">{g.contactName}</div>}
                                {g.departmentEmail && (
                                  <a href={`mailto:${g.departmentEmail}`} onClick={e => e.stopPropagation()} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-0.5 hover:underline">
                                    <Mail className="h-2.5 w-2.5" />{g.departmentEmail}
                                  </a>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${statusCfg.color}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                                  {statusCfg.label}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                                  g.priority === "high" ? "bg-red-500/15 text-red-400 border border-red-500/20" :
                                  g.priority === "medium" ? "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20" :
                                  "bg-white/5 text-gray-500 border border-white/5"
                                }`}>
                                  {g.priority || "medium"}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {g.aiScore ? (
                                  <div className={`inline-flex items-center gap-1 text-sm font-bold px-2 py-1 rounded-lg border ${scoreBg(g.aiScore)}`}>
                                    <span className={scoreColor(g.aiScore)}>{g.aiScore}</span>
                                    <span className="text-gray-600 text-xs">/100</span>
                                  </div>
                                ) : (
                                  <button
                                    onClick={e => { e.stopPropagation(); scoreGemeente(g.id); }}
                                    disabled={isScoringId === g.id}
                                    className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 bg-violet-500/10 border border-violet-500/20 rounded-lg px-2 py-1 transition-all"
                                    data-testid={`button-score-${g.id}`}
                                  >
                                    {isScoringId === g.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bot className="h-3 w-3" />}
                                    Score
                                  </button>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-xs text-gray-500 bg-white/5 rounded-lg px-2 py-1">{g.outreachGoal?.replace(/_/g, " ") || "—"}</span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                  <button
                                    onClick={() => { setEditingGemeente(g); setGemeenteDialog(true); }}
                                    className="p-1.5 rounded-lg hover:bg-blue-500/20 text-gray-500 hover:text-blue-400 transition-all"
                                    data-testid={`button-edit-${g.id}`}
                                  >
                                    <Edit3 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => { if (confirm(`Delete ${g.municipalityName}?`)) deleteMutation.mutate(g.id); }}
                                    className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-all"
                                    data-testid={`button-delete-${g.id}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                  <ChevronRight className={`h-3.5 w-3.5 text-gray-600 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                                </div>
                              </td>
                            </tr>
                            {/* Expanded row */}
                            {isExpanded && (
                              <tr key={`${g.id}-expanded`} className="bg-white/[0.015]">
                                <td colSpan={7} className="px-6 py-4">
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                                    {g.aiSummary && (
                                      <div className="sm:col-span-2 bg-violet-500/10 border border-violet-500/20 rounded-xl p-3">
                                        <p className="font-semibold text-violet-400 mb-1 flex items-center gap-1"><Sparkles className="h-3 w-3" /> AI Summary</p>
                                        <p className="text-gray-300">{g.aiSummary}</p>
                                      </div>
                                    )}
                                    {g.aiSuggestedApproach && (
                                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                                        <p className="font-semibold text-emerald-400 mb-1 flex items-center gap-1"><ArrowRight className="h-3 w-3" /> Suggested Approach</p>
                                        <p className="text-gray-300">{g.aiSuggestedApproach}</p>
                                      </div>
                                    )}
                                    {g.internalNotes && (
                                      <div className="sm:col-span-3 bg-white/3 border border-white/5 rounded-xl p-3">
                                        <p className="font-semibold text-gray-400 mb-1">Internal Notes</p>
                                        <p className="text-gray-400">{g.internalNotes}</p>
                                      </div>
                                    )}
                                    {g.website && (
                                      <a href={g.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300">
                                        <Globe className="h-3 w-3" />{g.website}
                                      </a>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ══════════════════ TAB: AI INTELLIGENCE ══════════════════ */}
          <TabsContent value="ai" className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

              {/* Config */}
              <div className="lg:col-span-1 space-y-4">
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center">
                      <Bot className="h-3.5 w-3.5 text-violet-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-white">Analysis Config</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="text-xs text-gray-500 bg-white/3 rounded-xl p-3 border border-white/5">
                      <p className="font-semibold text-gray-400 mb-1">How it works</p>
                      <p>Load a preview first, then click "Run AI Analysis". Claude AI will analyze your leads and return strategic insights, priorities, and outreach strategies.</p>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full border-white/10 text-gray-300 hover:bg-white/10 bg-white/5 rounded-xl"
                      onClick={loadPreview}
                      disabled={isLoadingPreview || filters.sources.length === 0}
                    >
                      {isLoadingPreview ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Database className="h-4 w-4 mr-2" />}
                      Load Data ({filters.sources.length} source{filters.sources.length !== 1 ? "s" : ""})
                    </Button>
                    {previewData.length > 0 && (
                      <div className="text-xs text-center text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl py-2">
                        {previewData.length} records ready for analysis
                      </div>
                    )}
                    <Button
                      className="w-full bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white rounded-xl shadow-lg shadow-violet-500/20 border-0"
                      onClick={runAiAnalysis}
                      disabled={isAnalyzing || filters.sources.length === 0}
                    >
                      {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                      {isAnalyzing ? "Claude is analyzing..." : "Run AI Analysis"}
                    </Button>
                  </div>
                </div>

                {/* Source selector mini */}
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
                  <p className="text-xs font-semibold text-gray-400 mb-3">Active Sources</p>
                  <div className="space-y-1.5">
                    {(Object.entries(SOURCE_CONFIG) as [DataSource, any][]).map(([src, cfg]) => {
                      const Icon = cfg.icon;
                      const active = filters.sources.includes(src);
                      return (
                        <button
                          key={src}
                          onClick={() => toggleSource(src)}
                          className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl transition-all text-left text-xs ${active ? `bg-gradient-to-r ${cfg.gradient} bg-opacity-15 text-white` : "text-gray-500 hover:text-gray-300 hover:bg-white/5"}`}
                          style={active ? { background: "rgba(255,255,255,0.05)" } : {}}
                        >
                          <div className={`w-5 h-5 rounded bg-gradient-to-br ${cfg.gradient} flex items-center justify-center`}>
                            <Icon className="h-3 w-3 text-white" />
                          </div>
                          <span className="flex-1">{cfg.label}</span>
                          {active && <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Results */}
              <div className="lg:col-span-2">
                {isAnalyzing && (
                  <div className="bg-white/[0.03] border border-violet-500/20 rounded-2xl p-8 flex flex-col items-center gap-4">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                        <Brain className="h-8 w-8 text-white" />
                      </div>
                      <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-violet-400 flex items-center justify-center animate-pulse">
                        <Sparkles className="h-3 w-3 text-white" />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-base font-semibold text-white">Claude is analyzing your data</p>
                      <p className="text-sm text-gray-500 mt-1">Processing up to 100 records — this may take 15–30 seconds</p>
                    </div>
                    <div className="w-48 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full animate-pulse" style={{ width: "70%" }} />
                    </div>
                  </div>
                )}

                {aiAnalysis && !isAnalyzing && (
                  <div className="space-y-4">
                    {/* Score card */}
                    {aiAnalysis.overallScore && (
                      <div className="bg-gradient-to-br from-violet-950/40 to-blue-950/20 border border-violet-500/20 rounded-2xl p-5 flex items-center gap-4">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 flex flex-col items-center justify-center shadow-lg shadow-violet-500/30">
                          <span className="text-2xl font-black text-white">{aiAnalysis.overallScore}</span>
                          <span className="text-xs text-violet-200">/100</span>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-violet-400 uppercase tracking-wider">Overall Intelligence Score</p>
                          {aiAnalysis.executiveSummary && (
                            <p className="text-sm text-gray-300 mt-1 leading-relaxed max-w-lg">{aiAnalysis.executiveSummary}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Insights grid */}
                    {aiAnalysis.topInsights?.length > 0 && (
                      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Top Insights</p>
                        <div className="space-y-2">
                          {aiAnalysis.topInsights.map((insight: string, i: number) => (
                            <div key={i} className="flex items-start gap-3 bg-white/3 rounded-xl p-3 border border-white/5">
                              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-emerald-400">{i + 1}</span>
                              </div>
                              <span className="text-sm text-gray-300">{insight}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Strategies */}
                    {aiAnalysis.outreachStrategies?.length > 0 && (
                      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Outreach Strategies</p>
                        <div className="space-y-3">
                          {aiAnalysis.outreachStrategies.map((s: any, i: number) => (
                            <div key={i} className="bg-white/3 border border-white/5 rounded-xl p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                  <Target className="h-3 w-3 text-blue-400" />
                                </div>
                                <span className="text-sm font-semibold text-blue-300">{s.target}</span>
                              </div>
                              <p className="text-sm text-gray-300">{s.approach}</p>
                              <div className="flex gap-3 mt-2 text-xs">
                                {s.timing && <span className="text-gray-500">⏱ {s.timing}</span>}
                                {s.expectedOutcome && <span className="text-emerald-500">→ {s.expectedOutcome}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quick wins + High priority */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {aiAnalysis.quickWins?.length > 0 && (
                        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-5">
                          <p className="text-xs font-bold text-yellow-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Zap className="h-3 w-3" /> Quick Wins</p>
                          <ul className="space-y-2">
                            {aiAnalysis.quickWins.map((w: string, i: number) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                                <ChevronRight className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />
                                {w}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {aiAnalysis.highPriorityLeads?.length > 0 && (
                        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5">
                          <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Flame className="h-3 w-3" /> High Priority</p>
                          <div className="space-y-1.5">
                            {aiAnalysis.highPriorityLeads.map((lead: string, i: number) => (
                              <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                                <Star className="h-3 w-3 text-amber-400 shrink-0" />
                                {lead}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {aiAnalysis.recommendedSequence && (
                      <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-5">
                        <p className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><ArrowRight className="h-3 w-3" /> Recommended Sequence</p>
                        <p className="text-sm text-gray-300">{aiAnalysis.recommendedSequence}</p>
                      </div>
                    )}
                  </div>
                )}

                {!aiAnalysis && !isAnalyzing && (
                  <div className="bg-white/[0.03] border border-white/10 border-dashed rounded-2xl p-12 flex flex-col items-center gap-4 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                      <Brain className="h-8 w-8 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-gray-400 font-medium">No analysis yet</p>
                      <p className="text-sm text-gray-600 mt-1">Select sources and click "Run AI Analysis" to get strategic insights</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Gemeente Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={gemeenteDialog} onOpenChange={open => { if (!open) { setGemeenteDialog(false); setEditingGemeente(EMPTY_GEMEENTE); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto bg-[#0d1220] border border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">{editingGemeente.id ? "Edit Municipality" : "Add Municipality"}</DialogTitle>
            <DialogDescription className="text-gray-500">Manage gemeente outreach details and contact information.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label className="text-xs text-gray-400">Municipality Name *</Label>
              <Input
                value={editingGemeente.municipalityName || ""}
                onChange={e => setEditingGemeente(g => ({ ...g, municipalityName: e.target.value }))}
                placeholder="e.g. Amsterdam"
                className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-gray-600 rounded-xl"
                data-testid="input-gemeente-name"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-400">Province</Label>
              <Select value={editingGemeente.province || ""} onValueChange={v => setEditingGemeente(g => ({ ...g, province: v }))}>
                <SelectTrigger className="mt-1 bg-white/5 border-white/10 text-white rounded-xl" data-testid="select-gemeente-province-form">
                  <SelectValue placeholder="Select province" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-white/10 text-white">
                  {DUTCH_PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-400">City</Label>
              <Input
                value={editingGemeente.city || ""}
                onChange={e => setEditingGemeente(g => ({ ...g, city: e.target.value }))}
                placeholder="Hoofdstad / gemeente city"
                className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-gray-600 rounded-xl"
                data-testid="input-gemeente-city"
              />
            </div>

            <Separator className="col-span-2 bg-white/5" />
            <p className="col-span-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Department</p>

            <div>
              <Label className="text-xs text-gray-400">Department</Label>
              <Input
                value={editingGemeente.department || ""}
                onChange={e => setEditingGemeente(g => ({ ...g, department: e.target.value }))}
                placeholder="e.g. Kunst & Cultuur"
                className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-gray-600 rounded-xl"
                data-testid="input-gemeente-department"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-400">Department Email</Label>
              <Input
                type="email"
                value={editingGemeente.departmentEmail || ""}
                onChange={e => setEditingGemeente(g => ({ ...g, departmentEmail: e.target.value }))}
                placeholder="cultuur@gemeente.nl"
                className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-gray-600 rounded-xl"
                data-testid="input-gemeente-dept-email"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-400">Website</Label>
              <Input
                value={editingGemeente.website || ""}
                onChange={e => setEditingGemeente(g => ({ ...g, website: e.target.value }))}
                placeholder="https://gemeente.nl/cultuur"
                className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-gray-600 rounded-xl"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-400">Department Phone</Label>
              <Input
                value={editingGemeente.departmentPhone || ""}
                onChange={e => setEditingGemeente(g => ({ ...g, departmentPhone: e.target.value }))}
                placeholder="+31 20..."
                className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-gray-600 rounded-xl"
              />
            </div>

            <Separator className="col-span-2 bg-white/5" />
            <p className="col-span-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Contact Person</p>

            <div>
              <Label className="text-xs text-gray-400">Contact Name</Label>
              <Input
                value={editingGemeente.contactName || ""}
                onChange={e => setEditingGemeente(g => ({ ...g, contactName: e.target.value }))}
                placeholder="Full name"
                className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-gray-600 rounded-xl"
                data-testid="input-gemeente-contact-name"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-400">Contact Role</Label>
              <Input
                value={editingGemeente.contactRole || ""}
                onChange={e => setEditingGemeente(g => ({ ...g, contactRole: e.target.value }))}
                placeholder="e.g. Beleidsmedewerker Cultuur"
                className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-gray-600 rounded-xl"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-400">Contact Email</Label>
              <Input
                type="email"
                value={editingGemeente.contactEmail || ""}
                onChange={e => setEditingGemeente(g => ({ ...g, contactEmail: e.target.value }))}
                placeholder="naam@gemeente.nl"
                className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-gray-600 rounded-xl"
              />
            </div>

            <Separator className="col-span-2 bg-white/5" />
            <p className="col-span-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Outreach Settings</p>

            <div>
              <Label className="text-xs text-gray-400">Status</Label>
              <Select value={editingGemeente.outreachStatus || "niet_gecontacteerd"} onValueChange={v => setEditingGemeente(g => ({ ...g, outreachStatus: v }))}>
                <SelectTrigger className="mt-1 bg-white/5 border-white/10 text-white rounded-xl" data-testid="select-outreach-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-white/10 text-white">
                  {Object.entries(OUTREACH_STATUS_CFG).map(([v, c]) => (
                    <SelectItem key={v} value={v}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-400">Priority</Label>
              <Select value={editingGemeente.priority || "medium"} onValueChange={v => setEditingGemeente(g => ({ ...g, priority: v }))}>
                <SelectTrigger className="mt-1 bg-white/5 border-white/10 text-white rounded-xl" data-testid="select-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-white/10 text-white">
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-400">Outreach Goal</Label>
              <Select value={editingGemeente.outreachGoal || "partnerschap"} onValueChange={v => setEditingGemeente(g => ({ ...g, outreachGoal: v }))}>
                <SelectTrigger className="mt-1 bg-white/5 border-white/10 text-white rounded-xl" data-testid="select-outreach-goal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-white/10 text-white">
                  {GOAL_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <Checkbox
                checked={editingGemeente.hasUrbanCultureBudget || false}
                onCheckedChange={v => setEditingGemeente(g => ({ ...g, hasUrbanCultureBudget: !!v }))}
                id="urban-budget"
                data-testid="checkbox-urban-budget"
                className="border-white/20 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
              />
              <Label htmlFor="urban-budget" className="text-sm cursor-pointer text-gray-300">Has urban culture budget</Label>
            </div>

            <div className="col-span-2">
              <Label className="text-xs text-gray-400">Internal Notes</Label>
              <Textarea
                value={editingGemeente.internalNotes || ""}
                onChange={e => setEditingGemeente(g => ({ ...g, internalNotes: e.target.value }))}
                placeholder="Add internal notes about this municipality..."
                className="mt-1 min-h-[80px] bg-white/5 border-white/10 text-white placeholder:text-gray-600 rounded-xl"
                data-testid="textarea-gemeente-notes"
              />
            </div>
          </div>

          <DialogFooter className="pt-4 gap-2">
            <Button variant="outline" onClick={() => { setGemeenteDialog(false); setEditingGemeente(EMPTY_GEMEENTE); }} className="border-white/10 text-gray-300 hover:bg-white/10 rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate(editingGemeente as any)}
              disabled={saveMutation.isPending || !editingGemeente.municipalityName}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl shadow-lg border-0"
              data-testid="button-save-gemeente"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Save Municipality
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
