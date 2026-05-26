import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DollarSign, Calendar, Globe, Building2, Search, Filter,
  Plus, Edit3, Trash2, Sparkles, ExternalLink, RefreshCw,
  AlertTriangle, CheckCircle, Clock, Archive, Eye, Database,
  TrendingUp, Users, Loader2, X, ChevronDown, ChevronUp,
  Mail, Phone, Link, Tag, MapPin, Zap, BookOpen, Star,
  ArrowRight, FileText, Banknote, Coins, Handshake, Receipt,
} from "lucide-react";

interface FundingOpportunity {
  id: number;
  title: string;
  shortSummary?: string;
  fullDescription?: string;
  providerName?: string;
  providerEmail?: string;
  providerPhone?: string;
  providerWebsite?: string;
  officialSourceLink?: string;
  applicationLink?: string;
  sourceName?: string;
  status: string;
  amountMin?: number;
  amountMax?: number;
  amountText?: string;
  applicationStartDate?: string;
  deadline?: string;
  workPeriod?: string;
  targetAudience?: string;
  eligibility?: string;
  aiEligibilitySummary?: string;
  whatItCanBeUsedFor?: string;
  restrictions?: string;
  requiredDocuments?: string;
  applicationSteps?: string;
  faq?: string;
  contactInfo?: string;
  categories?: string[];
  applicantTypes?: string[];
  regions?: string[];
  municipalities?: string[];
  provinces?: string[];
  country?: string;
  euNationalLocal?: string;
  tags?: string[];
  language?: string;
  fundingType?: string;
  recurring?: boolean;
  coFinancingRequired?: boolean;
  internalNotes?: string;
  aiConfidence?: number;
  isDuplicate?: boolean;
  reviewStatus?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface FundingSource {
  id: number;
  name: string;
  url: string;
  sourceType: string;
  categoryFocus?: string;
  regionFocus?: string;
  isActive?: boolean;
  crawlFrequency?: string;
  lastRun?: string;
  lastSuccess?: string;
  lastError?: string;
  notes?: string;
  trustLevel?: number;
  healthStatus?: string;
}

interface FundingStats {
  total: number;
  published: number;
  draft: number;
  expired: number;
  needsReview: number;
  duplicates: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  culture: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  art: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  sports: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  youth: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  education: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  innovation: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  social_impact: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  community_development: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  creative_industries: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  digitalization: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  sponsorship: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  app_development: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  software_development: "bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300",
  tech_innovation: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  r_and_d: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  open_source: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-300",
  entrepreneurship: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  performing_arts: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  documentary: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  media: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
  sustainability: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  inclusion: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  dance: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  music: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
};

const FUNDING_TYPE_CONFIG: Record<string, { label: string; color: string; accent: string; icon: any }> = {
  subsidy:     { label: "Subsidie",         color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300", accent: "border-l-emerald-500", icon: Banknote },
  grant:       { label: "Fonds/Grant",      color: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",   accent: "border-l-violet-500",  icon: Coins },
  sponsorship: { label: "Sponsoring",       color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",       accent: "border-l-amber-500",   icon: Handshake },
  loan:        { label: "Lening",           color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",           accent: "border-l-blue-500",    icon: Receipt },
  investment:  { label: "Investering",      color: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",               accent: "border-l-sky-500",     icon: TrendingUp },
  tax_credit:  { label: "Belastingkorting", color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",           accent: "border-l-cyan-500",    icon: Receipt },
};

const FUNDING_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(FUNDING_TYPE_CONFIG).map(([k, v]) => [k, v.label])
);

const CATEGORY_FILTER_OPTIONS = [
  { value: "all", label: "Alle categorieën" },
  { value: "app_development", label: "App Ontwikkeling" },
  { value: "software_development", label: "Software Ontwikkeling" },
  { value: "tech_innovation", label: "Tech Innovatie" },
  { value: "r_and_d", label: "R&D" },
  { value: "digitalization", label: "Digitalisering" },
  { value: "open_source", label: "Open Source" },
  { value: "culture", label: "Cultuur" },
  { value: "art", label: "Kunst" },
  { value: "music", label: "Muziek" },
  { value: "dance", label: "Dans" },
  { value: "performing_arts", label: "Podiumkunsten" },
  { value: "sports", label: "Sport" },
  { value: "youth", label: "Jeugd" },
  { value: "education", label: "Educatie" },
  { value: "social_impact", label: "Sociale Impact" },
  { value: "community_development", label: "Community" },
  { value: "creative_industries", label: "Creatieve Industrie" },
  { value: "media", label: "Media" },
  { value: "documentary", label: "Documentaire" },
  { value: "entrepreneurship", label: "Ondernemerschap" },
  { value: "inclusion", label: "Inclusie" },
  { value: "sustainability", label: "Duurzaamheid" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  published: { label: "Actief",          color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",   icon: CheckCircle },
  draft:     { label: "Concept",         color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",          icon: Clock },
  expired:   { label: "Verlopen",        color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",           icon: Archive },
  archived:  { label: "Gearchiveerd",    color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",          icon: Archive },
};

function formatAmount(opp: FundingOpportunity) {
  if (opp.amountText) return opp.amountText;
  if (opp.amountMin && opp.amountMax) return `€${opp.amountMin.toLocaleString("nl-NL")} – €${opp.amountMax.toLocaleString("nl-NL")}`;
  if (opp.amountMin) return `Vanaf €${opp.amountMin.toLocaleString("nl-NL")}`;
  if (opp.amountMax) return `Tot €${opp.amountMax.toLocaleString("nl-NL")}`;
  return "Bedrag niet opgegeven";
}

function formatDeadline(deadline?: string) {
  if (!deadline) return null;
  const d = new Date(deadline);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const formatted = d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
  if (diffDays < 0) return { text: `Verlopen (${formatted})`, urgent: false, expired: true, days: diffDays };
  if (diffDays <= 14) return { text: `${formatted} (${diffDays}d)`, urgent: true, expired: false, days: diffDays };
  if (diffDays <= 60) return { text: `${formatted} (${diffDays}d)`, urgent: false, expired: false, days: diffDays };
  return { text: formatted, urgent: false, expired: false, days: diffDays };
}

function OpportunityDetail({ opp, onClose, onEnrich, enriching }: {
  opp: FundingOpportunity;
  onClose: () => void;
  onEnrich: (id: number) => void;
  enriching: boolean;
}) {
  const dl = formatDeadline(opp.deadline);
  const typeConf = opp.fundingType ? FUNDING_TYPE_CONFIG[opp.fundingType] : null;
  return (
    <div className="space-y-5 text-sm">
      {/* Quick-action buttons at the top */}
      <div className="flex gap-2 flex-wrap">
        {opp.applicationLink && (
          <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 flex-1" asChild>
            <a href={opp.applicationLink} target="_blank" rel="noopener noreferrer">
              <ArrowRight className="w-3.5 h-3.5" />Aanvragen
            </a>
          </Button>
        )}
        {opp.officialSourceLink && (
          <Button size="sm" variant="outline" className="gap-1.5 flex-1" asChild>
            <a href={opp.officialSourceLink} target="_blank" rel="noopener noreferrer">
              <Globe className="w-3.5 h-3.5" />Officiële website
            </a>
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => onEnrich(opp.id)}
          disabled={enriching}
          data-testid={`button-enrich-${opp.id}`}
        >
          {enriching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-cyan-500" />}
          AI Verrijken
        </Button>
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap gap-2">
        {typeConf && (
          <Badge className={typeConf.color}>{typeConf.label}</Badge>
        )}
        {opp.euNationalLocal && (
          <Badge variant="outline">
            {opp.euNationalLocal === "eu" ? "🇪🇺 EU" : opp.euNationalLocal === "national" ? "🇳🇱 Nationaal" : "🏙️ Lokaal"}
          </Badge>
        )}
        {opp.categories?.slice(0, 3).map(c => (
          <Badge key={c} className={CATEGORY_COLORS[c] || "bg-gray-100 text-gray-700"}>{c}</Badge>
        ))}
        {opp.aiConfidence && (
          <Badge className="bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300">
            <Sparkles className="w-3 h-3 mr-1" />AI {opp.aiConfidence}%
          </Badge>
        )}
        {opp.recurring && <Badge variant="outline" className="text-xs">Jaarlijks</Badge>}
        {opp.coFinancingRequired && <Badge className="bg-amber-100 text-amber-800 text-xs">Co-financiering vereist</Badge>}
      </div>

      {/* Amount + Deadline grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-1.5 font-semibold text-green-800 dark:text-green-300 mb-1">
            <DollarSign className="w-3.5 h-3.5" /> Bedrag
          </div>
          <div className="text-green-900 dark:text-green-100 font-bold text-base">{formatAmount(opp)}</div>
        </div>
        {dl && (
          <div className={`p-3 rounded-lg border ${dl.expired ? "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800" : dl.urgent ? "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800" : "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800"}`}>
            <div className={`flex items-center gap-1.5 font-semibold mb-1 ${dl.expired ? "text-red-800 dark:text-red-300" : dl.urgent ? "text-amber-800 dark:text-amber-300" : "text-blue-800 dark:text-blue-300"}`}>
              <Calendar className="w-3.5 h-3.5" /> {dl.expired ? "Verlopen" : dl.urgent ? "⚡ Sluit snel!" : "Deadline"}
            </div>
            <div className={`font-medium ${dl.expired ? "text-red-900 dark:text-red-100" : dl.urgent ? "text-amber-900 dark:text-amber-100" : "text-blue-900 dark:text-blue-100"}`}>{dl.text}</div>
          </div>
        )}
      </div>

      {opp.shortSummary && (
        <div>
          <div className="font-semibold text-foreground mb-1">Samenvatting</div>
          <p className="text-muted-foreground leading-relaxed">{opp.shortSummary}</p>
        </div>
      )}

      {opp.aiEligibilitySummary && (
        <div className="p-3 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800">
          <div className="flex items-center gap-1.5 font-semibold text-cyan-800 dark:text-cyan-300 mb-1">
            <Sparkles className="w-3.5 h-3.5" /> AI Geschiktheidsanalyse
          </div>
          <p className="text-cyan-900 dark:text-cyan-100">{opp.aiEligibilitySummary}</p>
        </div>
      )}

      {opp.eligibility && (
        <div>
          <div className="font-semibold text-foreground mb-1">Voorwaarden</div>
          <p className="text-muted-foreground">{opp.eligibility}</p>
        </div>
      )}

      {opp.whatItCanBeUsedFor && (
        <div>
          <div className="font-semibold text-foreground mb-1">Waarvoor te gebruiken</div>
          <p className="text-muted-foreground">{opp.whatItCanBeUsedFor}</p>
        </div>
      )}

      {opp.targetAudience && (
        <div>
          <div className="font-semibold text-foreground mb-1">Doelgroep</div>
          <p className="text-muted-foreground">{opp.targetAudience}</p>
        </div>
      )}

      {opp.restrictions && (
        <div>
          <div className="flex items-center gap-1.5 font-semibold text-red-700 dark:text-red-400 mb-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Beperkingen
          </div>
          <p className="text-muted-foreground">{opp.restrictions}</p>
        </div>
      )}

      {opp.requiredDocuments && (
        <div>
          <div className="font-semibold text-foreground mb-1">Benodigde documenten</div>
          <p className="text-muted-foreground whitespace-pre-line">{opp.requiredDocuments}</p>
        </div>
      )}

      {opp.applicationSteps && (
        <div>
          <div className="font-semibold text-foreground mb-1">Aanvraagstappen</div>
          <p className="text-muted-foreground whitespace-pre-line">{opp.applicationSteps}</p>
        </div>
      )}

      {opp.workPeriod && (
        <div>
          <div className="font-semibold text-foreground mb-1">Uitvoeringsperiode</div>
          <p className="text-muted-foreground">{opp.workPeriod}</p>
        </div>
      )}

      {opp.applicantTypes && opp.applicantTypes.length > 0 && (
        <div>
          <div className="font-semibold text-foreground mb-1.5">Aanvraagtypes</div>
          <div className="flex flex-wrap gap-1.5">
            {opp.applicantTypes.map(t => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
          </div>
        </div>
      )}

      {opp.tags && opp.tags.length > 0 && (
        <div>
          <div className="font-semibold text-foreground mb-1.5">Tags</div>
          <div className="flex flex-wrap gap-1.5">
            {opp.tags.map(t => <Badge key={t} variant="secondary" className="text-xs">#{t}</Badge>)}
          </div>
        </div>
      )}

      <div className="border-t pt-4 space-y-2">
        <div className="font-semibold text-foreground mb-2">Contactgegevens</div>
        {opp.providerName && <div className="flex items-center gap-2 text-muted-foreground"><Building2 className="w-3.5 h-3.5 shrink-0" />{opp.providerName}</div>}
        {opp.providerEmail && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="w-3.5 h-3.5 shrink-0" />
            <a href={`mailto:${opp.providerEmail}`} className="hover:underline text-blue-600 dark:text-blue-400">{opp.providerEmail}</a>
          </div>
        )}
        {opp.contactInfo && <div className="flex items-start gap-2 text-muted-foreground"><Phone className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span>{opp.contactInfo}</span></div>}
      </div>

      {opp.internalNotes && (
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <div className="font-semibold text-amber-800 dark:text-amber-300 mb-1">Interne notities</div>
          <p className="text-amber-900 dark:text-amber-100 text-xs">{opp.internalNotes}</p>
        </div>
      )}
    </div>
  );
}

export default function AdminFunding() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("opportunities");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterScope, setFilterScope] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [selectedOpp, setSelectedOpp] = useState<FundingOpportunity | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddSource, setShowAddSource] = useState(false);
  const [enrichingId, setEnrichingId] = useState<number | null>(null);

  // Auto-seed on mount (idempotent — safe to run every time)
  useEffect(() => {
    fetch("/api/admin/funding/seed", { method: "POST", credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (d.new > 0) {
          queryClient.invalidateQueries({ queryKey: ["/api/admin/funding/opportunities"] });
          queryClient.invalidateQueries({ queryKey: ["/api/admin/funding/stats"] });
        }
      })
      .catch(() => {});
  }, []);

  const { data: stats } = useQuery<FundingStats>({
    queryKey: ["/api/admin/funding/stats"],
    queryFn: async () => {
      const r = await fetch("/api/admin/funding/stats", { credentials: "include" });
      return r.json();
    },
    refetchInterval: 30000,
  });

  const { data: opportunities = [], isLoading } = useQuery<FundingOpportunity[]>({
    queryKey: ["/api/admin/funding/opportunities", filterStatus, filterType, filterCategory, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterType !== "all") params.set("fundingType", filterType);
      if (search) params.set("search", search);
      if (filterCategory !== "all") params.set("category", filterCategory);
      const r = await fetch(`/api/admin/funding/opportunities?${params}`, { credentials: "include" });
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: sources = [] } = useQuery<FundingSource[]>({
    queryKey: ["/api/admin/funding/sources"],
    queryFn: async () => {
      const r = await fetch("/api/admin/funding/sources", { credentials: "include" });
      return r.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/admin/funding/opportunities/${id}`, { method: "DELETE", credentials: "include" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/funding/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/funding/stats"] });
      toast({ title: "Verwijderd" });
      setSelectedOpp(null);
    },
  });

  const deleteSourceMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/admin/funding/sources/${id}`, { method: "DELETE", credentials: "include" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/funding/sources"] });
      toast({ title: "Bron verwijderd" });
    },
  });

  const enrichMutation = useMutation({
    mutationFn: async (id: number) => {
      setEnrichingId(id);
      const r = await fetch(`/api/admin/funding/opportunities/${id}/enrich`, { method: "POST", credentials: "include" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      return d;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/funding/opportunities"] });
      if (selectedOpp) setSelectedOpp(data.opportunity);
      toast({ title: "AI verrijking voltooid", description: "Gegevens zijn bijgewerkt op basis van AI-analyse." });
      setEnrichingId(null);
    },
    onError: (e: any) => {
      toast({ title: "AI verrijking mislukt", description: e.message, variant: "destructive" });
      setEnrichingId(null);
    },
  });

  // Client-side scope filter (not sent to server)
  const filtered = opportunities.filter(o => {
    if (filterScope !== "all" && o.euNationalLocal !== filterScope) return false;
    return true;
  });

  const hasActiveFilters = filterStatus !== "all" || filterType !== "all" || filterScope !== "all" || filterCategory !== "all" || search !== "";

  const clearFilters = () => {
    setFilterStatus("all");
    setFilterType("all");
    setFilterScope("all");
    setFilterCategory("all");
    setSearch("");
  };

  // Type breakdown from loaded data
  const typeBreakdown = Object.entries(FUNDING_TYPE_CONFIG).map(([key, conf]) => ({
    key,
    label: conf.label,
    color: conf.color,
    count: filtered.filter(o => o.fundingType === key).length,
  })).filter(t => t.count > 0);

  const now = new Date();
  const upcomingDeadlines = filtered
    .filter(o => o.deadline && new Date(o.deadline) > now && o.status === "published")
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
    .slice(0, 8);

  const handleManualSeed = () => {
    fetch("/api/admin/funding/seed", { method: "POST", credentials: "include" })
      .then(r => r.json())
      .then(d => {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/funding/opportunities"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/funding/stats"] });
        toast({ title: d.message || "Data vernieuwd" });
      });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            Funding Intelligence
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Nederlandse subsidies, grants, leningen en fiscale voordelen voor 2026
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleManualSeed}
          variant="outline"
          className="gap-1.5 shrink-0"
          data-testid="button-refresh-funding"
        >
          <RefreshCw className="w-3.5 h-3.5" />Synchroniseren
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Totaal",     value: stats?.total ?? 0,       icon: Database,       color: "text-foreground" },
          { label: "Actief",     value: stats?.published ?? 0,   icon: CheckCircle,    color: "text-green-600" },
          { label: "Concept",    value: stats?.draft ?? 0,       icon: Clock,          color: "text-gray-500" },
          { label: "Verlopen",   value: stats?.expired ?? 0,     icon: Archive,        color: "text-red-500" },
          { label: "Review",     value: stats?.needsReview ?? 0, icon: AlertTriangle,  color: "text-amber-500" },
          { label: "Duplicaten", value: stats?.duplicates ?? 0,  icon: Eye,            color: "text-blue-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-border/50">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{label}</span>
                <Icon className={`w-3.5 h-3.5 ${color}`} />
              </div>
              <div className={`text-xl font-bold ${color}`}>{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Type breakdown pills */}
      {typeBreakdown.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {typeBreakdown.map(t => (
            <button
              key={t.key}
              onClick={() => setFilterType(filterType === t.key ? "all" : t.key)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${filterType === t.key ? "ring-2 ring-offset-1 ring-foreground/20" : "opacity-80 hover:opacity-100"} ${t.color}`}
              data-testid={`button-type-filter-${t.key}`}
            >
              {t.label}
              <span className="font-bold">{t.count}</span>
            </button>
          ))}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-8">
          <TabsTrigger value="opportunities" className="text-xs px-3 h-7">
            Kansen {filtered.length > 0 && <span className="ml-1 bg-foreground/10 px-1.5 py-0.5 rounded-full text-xs">{filtered.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="deadlines" className="text-xs px-3 h-7">
            Deadlines {upcomingDeadlines.length > 0 && <span className="ml-1 text-amber-600 font-bold">{upcomingDeadlines.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="sources" className="text-xs px-3 h-7">Bronnen ({sources.length})</TabsTrigger>
        </TabsList>

        {/* OPPORTUNITIES TAB */}
        <TabsContent value="opportunities" className="space-y-3 mt-3">

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Zoeken op naam, aanbieder, beschrijving..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm pr-8"
              data-testid="input-funding-search"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36 h-8 text-xs" data-testid="select-filter-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle statussen</SelectItem>
                <SelectItem value="published">Actief</SelectItem>
                <SelectItem value="draft">Concept</SelectItem>
                <SelectItem value="expired">Verlopen</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterScope} onValueChange={setFilterScope}>
              <SelectTrigger className="w-36 h-8 text-xs" data-testid="select-filter-scope">
                <SelectValue placeholder="Scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle niveaus</SelectItem>
                <SelectItem value="local">🏙️ Lokaal</SelectItem>
                <SelectItem value="national">🇳🇱 Nationaal</SelectItem>
                <SelectItem value="eu">🇪🇺 EU</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-44 h-8 text-xs" data-testid="select-filter-type2">
                <SelectValue placeholder="Type financiering" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle types</SelectItem>
                <SelectItem value="subsidy">Subsidie</SelectItem>
                <SelectItem value="grant">Grant/Fonds</SelectItem>
                <SelectItem value="tax_credit">Belastingkorting</SelectItem>
                <SelectItem value="loan">Lening</SelectItem>
                <SelectItem value="investment">Investering</SelectItem>
                <SelectItem value="sponsorship">Sponsoring</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-48 h-8 text-xs" data-testid="select-filter-category">
                <SelectValue placeholder="Categorie" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_FILTER_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex-1" />
            {hasActiveFilters && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={clearFilters}
                data-testid="button-clear-filters"
              >
                <X className="w-3.5 h-3.5" />Filters wissen
              </Button>
            )}
            <Button
              size="sm"
              className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setShowAddModal(true)}
              data-testid="button-add-opportunity"
            >
              <Plus className="w-3.5 h-3.5" />Toevoegen
            </Button>
          </div>

          {/* Result count */}
          {!isLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{filtered.length}</span>
              {filtered.length === 1 ? "subsidie gevonden" : "subsidies gevonden"}
              {hasActiveFilters && <span>· <button onClick={clearFilters} className="text-blue-600 dark:text-blue-400 hover:underline">Alle tonen</button></span>}
            </div>
          )}

          {/* List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border-2 border-dashed border-border rounded-xl">
              <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-semibold text-base">Geen resultaten</p>
              <p className="text-sm mt-1">
                {hasActiveFilters ? "Pas je filters aan of wis ze om meer te zien." : "Klik op Synchroniseren om data te laden."}
              </p>
              {hasActiveFilters && (
                <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={clearFilters}>
                  <X className="w-3.5 h-3.5" />Filters wissen
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(opp => {
                const dl = formatDeadline(opp.deadline);
                const statusConf = STATUS_CONFIG[opp.status] || STATUS_CONFIG.draft;
                const StatusIcon = statusConf.icon;
                const typeConf = opp.fundingType ? FUNDING_TYPE_CONFIG[opp.fundingType] : null;
                const TypeIcon = typeConf?.icon ?? Banknote;
                return (
                  <Card
                    key={opp.id}
                    className={`border-border/50 hover:border-border/80 hover:shadow-sm cursor-pointer transition-all border-l-4 ${typeConf?.accent ?? "border-l-gray-300 dark:border-l-gray-600"}`}
                    onClick={() => setSelectedOpp(opp)}
                    data-testid={`card-opportunity-${opp.id}`}
                  >
                    <CardContent className="p-3.5">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">

                          {/* Top row: type badge + scope + status */}
                          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                            {typeConf && (
                              <Badge className={`${typeConf.color} text-xs flex items-center gap-1 h-5`}>
                                <TypeIcon className="w-3 h-3" />{typeConf.label}
                              </Badge>
                            )}
                            {opp.euNationalLocal && (
                              <span className="text-xs">
                                {opp.euNationalLocal === "eu" ? "🇪🇺" : opp.euNationalLocal === "national" ? "🇳🇱" : "🏙️"}
                              </span>
                            )}
                            <div className="flex-1" />
                            <Badge className={`${statusConf.color} text-xs flex items-center gap-1 h-5`}>
                              <StatusIcon className="w-3 h-3" />{statusConf.label}
                            </Badge>
                          </div>

                          {/* Title */}
                          <h3 className="font-semibold text-sm text-foreground leading-snug mb-1">{opp.title}</h3>

                          {/* Summary */}
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{opp.shortSummary}</p>

                          {/* Info row */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mb-2.5">
                            <span className="font-bold text-green-700 dark:text-green-400">{formatAmount(opp)}</span>
                            {opp.providerName && (
                              <span className="text-muted-foreground flex items-center gap-1">
                                <Building2 className="w-3 h-3 shrink-0" />{opp.providerName}
                              </span>
                            )}
                            {dl && (
                              <span className={`flex items-center gap-1 ${dl.expired ? "text-red-500 font-medium" : dl.urgent ? "text-amber-500 font-medium" : "text-muted-foreground"}`}>
                                <Calendar className="w-3 h-3 shrink-0" />
                                {dl.expired ? "⛔ Verlopen" : dl.urgent ? `⚡ ${dl.text}` : dl.text}
                              </span>
                            )}
                          </div>

                          {/* Category tags */}
                          {opp.categories && opp.categories.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2.5">
                              {opp.categories.slice(0, 3).map(c => (
                                <Badge key={c} className={`${CATEGORY_COLORS[c] || "bg-gray-100 text-gray-700"} text-xs h-4 px-1.5`}>{c}</Badge>
                              ))}
                              {opp.categories.length > 3 && (
                                <Badge variant="outline" className="text-xs h-4 px-1.5">+{opp.categories.length - 3}</Badge>
                              )}
                            </div>
                          )}

                          {/* Action buttons */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {opp.applicationLink && (
                              <Button
                                size="sm"
                                className="h-6 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 px-2"
                                asChild
                                onClick={e => e.stopPropagation()}
                                data-testid={`button-apply-${opp.id}`}
                              >
                                <a href={opp.applicationLink} target="_blank" rel="noopener noreferrer">
                                  <ArrowRight className="w-3 h-3" />Aanvragen
                                </a>
                              </Button>
                            )}
                            {opp.officialSourceLink && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-xs gap-1 px-2"
                                asChild
                                onClick={e => e.stopPropagation()}
                                data-testid={`button-source-${opp.id}`}
                              >
                                <a href={opp.officialSourceLink} target="_blank" rel="noopener noreferrer">
                                  <Globe className="w-3 h-3" />Website
                                </a>
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs gap-1 px-2 text-muted-foreground"
                              onClick={e => { e.stopPropagation(); setSelectedOpp(opp); }}
                              data-testid={`button-detail-${opp.id}`}
                            >
                              <Eye className="w-3 h-3" />Details
                            </Button>
                          </div>
                        </div>

                        {/* Right action column */}
                        <div className="flex flex-col gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={e => { e.stopPropagation(); enrichMutation.mutate(opp.id); }}
                            disabled={enrichingId === opp.id}
                            title="AI verrijken"
                            data-testid={`button-quick-enrich-${opp.id}`}
                          >
                            {enrichingId === opp.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
                            }
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                            onClick={e => { e.stopPropagation(); if (confirm("Verwijderen?")) deleteMutation.mutate(opp.id); }}
                            title="Verwijderen"
                            data-testid={`button-delete-${opp.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* DEADLINES TAB */}
        <TabsContent value="deadlines" className="mt-3">
          {upcomingDeadlines.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border-2 border-dashed border-border rounded-xl">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-semibold">Geen aankomende deadlines</p>
              <p className="text-sm mt-1">Alle deadlines zijn verlopen of nog niet ingesteld.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingDeadlines.map(opp => {
                const dl = formatDeadline(opp.deadline);
                const diffDays = opp.deadline ? Math.ceil((new Date(opp.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                const urgency = diffDays <= 7 ? "red" : diffDays <= 30 ? "amber" : "blue";
                return (
                  <Card
                    key={opp.id}
                    className={`border-l-4 cursor-pointer hover:shadow-sm transition-all ${urgency === "red" ? "border-l-red-500" : urgency === "amber" ? "border-l-amber-500" : "border-l-blue-500"}`}
                    onClick={() => setSelectedOpp(opp)}
                  >
                    <CardContent className="p-3.5 flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 font-bold ${urgency === "red" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" : urgency === "amber" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" : "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"}`}>
                        <span className="text-lg leading-none">{diffDays}</span>
                        <span className="text-xs font-normal">dagen</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm line-clamp-1">{opp.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{opp.providerName} · {dl?.text}</div>
                        {opp.applicationLink && (
                          <a
                            href={opp.applicationLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 mt-1"
                            onClick={e => e.stopPropagation()}
                          >
                            <ArrowRight className="w-3 h-3" />Aanvragen
                          </a>
                        )}
                      </div>
                      <div className="text-sm font-bold text-green-700 dark:text-green-400 shrink-0 text-right">
                        {formatAmount(opp)}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* SOURCES TAB */}
        <TabsContent value="sources" className="mt-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{sources.length} gegevensbronnen geconfigureerd</p>
            <Button
              size="sm"
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 h-8"
              onClick={() => setShowAddSource(true)}
              data-testid="button-add-source"
            >
              <Plus className="w-3.5 h-3.5" />Bron toevoegen
            </Button>
          </div>
          <div className="space-y-2">
            {sources.map(src => (
              <Card key={src.id} className="border-border/50 hover:border-border/80 transition-colors">
                <CardContent className="p-3.5 flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${src.healthStatus === "healthy" ? "bg-green-500" : src.healthStatus === "error" ? "bg-red-500" : "bg-gray-400"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{src.name}</span>
                      <Badge variant="outline" className="text-xs">{src.sourceType}</Badge>
                      {src.regionFocus && <span className="text-xs text-muted-foreground">📍 {src.regionFocus}</span>}
                    </div>
                    <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-1" onClick={e => e.stopPropagation()}>
                      <Globe className="w-3 h-3 shrink-0" />{src.url.substring(0, 60)}{src.url.length > 60 ? "..." : ""}
                    </a>
                    {src.categoryFocus && <div className="text-xs text-muted-foreground mt-0.5">📂 {src.categoryFocus}</div>}
                    {src.notes && <div className="text-xs text-muted-foreground mt-0.5 italic">{src.notes}</div>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex gap-0.5">
                      {Array.from({ length: src.trustLevel || 3 }).map((_, i) => (
                        <Star key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />
                      ))}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                      onClick={() => { if (confirm("Bron verwijderen?")) deleteSourceMutation.mutate(src.id); }}
                      data-testid={`button-delete-source-${src.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={!!selectedOpp} onOpenChange={v => { if (!v) setSelectedOpp(null); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl mx-auto rounded-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base leading-snug pr-8">{selectedOpp?.title}</DialogTitle>
            <DialogDescription className="sr-only">Subsidie detail</DialogDescription>
          </DialogHeader>
          {selectedOpp && (
            <OpportunityDetail
              opp={selectedOpp}
              onClose={() => setSelectedOpp(null)}
              onEnrich={id => enrichMutation.mutate(id)}
              enriching={enrichingId === selectedOpp.id}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Add Opportunity Modal */}
      <AddOpportunityModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/admin/funding/opportunities"] });
          queryClient.invalidateQueries({ queryKey: ["/api/admin/funding/stats"] });
          setShowAddModal(false);
          toast({ title: "Kans toegevoegd" });
        }}
      />

      {/* Add Source Modal */}
      <AddSourceModal
        open={showAddSource}
        onClose={() => setShowAddSource(false)}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/admin/funding/sources"] });
          setShowAddSource(false);
          toast({ title: "Bron toegevoegd" });
        }}
      />
    </div>
  );
}

function AddOpportunityModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: "", shortSummary: "", providerName: "", providerEmail: "", officialSourceLink: "",
    applicationLink: "", amountText: "", deadline: "", fundingType: "subsidy",
    status: "published", euNationalLocal: "national", targetAudience: "", eligibility: "",
    regions: "", categories: "", applicantTypes: "", tags: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.title) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        regions: form.regions ? form.regions.split(",").map(s => s.trim()) : [],
        categories: form.categories ? form.categories.split(",").map(s => s.trim()) : [],
        applicantTypes: form.applicantTypes ? form.applicantTypes.split(",").map(s => s.trim()) : [],
        tags: form.tags ? form.tags.split(",").map(s => s.trim()) : [],
        deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      };
      const r = await fetch("/api/admin/funding/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (r.ok) onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg mx-auto rounded-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kans toevoegen</DialogTitle>
          <DialogDescription className="sr-only">Nieuwe subsidie of sponsoring toevoegen</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div><Label className="text-xs">Titel *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="mt-1 h-8" data-testid="input-opp-title" /></div>
          <div><Label className="text-xs">Korte samenvatting</Label><Textarea value={form.shortSummary} onChange={e => setForm(f => ({ ...f, shortSummary: e.target.value }))} className="mt-1" rows={2} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Type</Label>
              <Select value={form.fundingType} onValueChange={v => setForm(f => ({ ...f, fundingType: v }))}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="subsidy">Subsidie</SelectItem>
                  <SelectItem value="grant">Grant/Fonds</SelectItem>
                  <SelectItem value="sponsorship">Sponsoring</SelectItem>
                  <SelectItem value="loan">Lening</SelectItem>
                  <SelectItem value="investment">Investering</SelectItem>
                  <SelectItem value="tax_credit">Belastingkorting</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Scope</Label>
              <Select value={form.euNationalLocal} onValueChange={v => setForm(f => ({ ...f, euNationalLocal: v }))}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">Lokaal</SelectItem>
                  <SelectItem value="national">Nationaal</SelectItem>
                  <SelectItem value="eu">EU</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Aanbieder</Label><Input value={form.providerName} onChange={e => setForm(f => ({ ...f, providerName: e.target.value }))} className="mt-1 h-8" /></div>
            <div><Label className="text-xs">E-mail aanbieder</Label><Input value={form.providerEmail} onChange={e => setForm(f => ({ ...f, providerEmail: e.target.value }))} className="mt-1 h-8" /></div>
          </div>
          <div><Label className="text-xs">Bedrag</Label><Input value={form.amountText} onChange={e => setForm(f => ({ ...f, amountText: e.target.value }))} placeholder="bijv. €5.000 – €50.000" className="mt-1 h-8" /></div>
          <div><Label className="text-xs">Deadline</Label><Input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} className="mt-1 h-8" /></div>
          <div><Label className="text-xs">Officiële link</Label><Input value={form.officialSourceLink} onChange={e => setForm(f => ({ ...f, officialSourceLink: e.target.value }))} className="mt-1 h-8" /></div>
          <div><Label className="text-xs">Aanvraaglink</Label><Input value={form.applicationLink} onChange={e => setForm(f => ({ ...f, applicationLink: e.target.value }))} className="mt-1 h-8" /></div>
          <div><Label className="text-xs">Doelgroep</Label><Input value={form.targetAudience} onChange={e => setForm(f => ({ ...f, targetAudience: e.target.value }))} className="mt-1 h-8" /></div>
          <div><Label className="text-xs">Categorieën (komma-gescheiden)</Label><Input value={form.categories} onChange={e => setForm(f => ({ ...f, categories: e.target.value }))} placeholder="culture, art, youth" className="mt-1 h-8" /></div>
          <div><Label className="text-xs">Aanvraagtypes (komma-gescheiden)</Label><Input value={form.applicantTypes} onChange={e => setForm(f => ({ ...f, applicantTypes: e.target.value }))} placeholder="stichting, zzp, individual" className="mt-1 h-8" /></div>
          <div><Label className="text-xs">Tags (komma-gescheiden)</Label><Input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="amsterdam, hip-hop, breaking" className="mt-1 h-8" /></div>
          <div><Label className="text-xs">Regio's (komma-gescheiden)</Label><Input value={form.regions} onChange={e => setForm(f => ({ ...f, regions: e.target.value }))} placeholder="Amsterdam, Rotterdam" className="mt-1 h-8" /></div>
        </div>
        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={onClose}>Annuleren</Button>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSave} disabled={saving || !form.title} data-testid="button-save-opportunity">
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Opslaan…</> : "Opslaan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddSourceModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: "", url: "", sourceType: "html", categoryFocus: "", regionFocus: "", notes: "", trustLevel: "4" });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name || !form.url) return;
    setSaving(true);
    try {
      const r = await fetch("/api/admin/funding/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, trustLevel: parseInt(form.trustLevel), isActive: true, crawlFrequency: "weekly", healthStatus: "healthy" }),
        credentials: "include",
      });
      if (r.ok) onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md mx-auto rounded-xl">
        <DialogHeader>
          <DialogTitle>Bron toevoegen</DialogTitle>
          <DialogDescription className="sr-only">Nieuwe gegevensbron toevoegen</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div><Label className="text-xs">Naam *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1 h-8" data-testid="input-source-name" /></div>
          <div><Label className="text-xs">URL *</Label><Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." className="mt-1 h-8" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Type</Label>
              <Select value={form.sourceType} onValueChange={v => setForm(f => ({ ...f, sourceType: v }))}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="html">Website</SelectItem>
                  <SelectItem value="api">API</SelectItem>
                  <SelectItem value="rss">RSS Feed</SelectItem>
                  <SelectItem value="manual">Handmatig</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Betrouwbaarheid (1-5)</Label><Input type="number" min="1" max="5" value={form.trustLevel} onChange={e => setForm(f => ({ ...f, trustLevel: e.target.value }))} className="mt-1 h-8" /></div>
          </div>
          <div><Label className="text-xs">Categorie focus</Label><Input value={form.categoryFocus} onChange={e => setForm(f => ({ ...f, categoryFocus: e.target.value }))} placeholder="cultuur, sport, jeugd" className="mt-1 h-8" /></div>
          <div><Label className="text-xs">Regio focus</Label><Input value={form.regionFocus} onChange={e => setForm(f => ({ ...f, regionFocus: e.target.value }))} placeholder="Nederland, Amsterdam" className="mt-1 h-8" /></div>
          <div><Label className="text-xs">Notities</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="mt-1 h-8" /></div>
        </div>
        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={onClose}>Annuleren</Button>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSave} disabled={saving || !form.name || !form.url} data-testid="button-save-source">
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Opslaan…</> : "Bron opslaan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
