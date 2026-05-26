import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  BarChart3, TrendingUp, Users, Eye, Zap, ExternalLink, RefreshCw,
  CheckCircle2, AlertCircle, Loader2, LogIn, Copy, Check, Info,
  DollarSign, Target, Star, ChevronRight, Play, Film, Layers,
  Globe, Shield, Key, Settings, Share2, ArrowUp, ArrowDown,
  Activity, Sparkles, Megaphone, Radio, ToggleLeft, PieChart,
  Calendar, Clock, Link2, Award, Lightbulb, Wallet, BarChart2,
  TrendingDown, Brain, MousePointer, ChevronDown, X
} from "lucide-react";
import { SiSnapchat } from "react-icons/si";
import {
  AreaChart, Area, BarChart, Bar, PieChart as RePieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

/* ─── Brand colours ──────────────────────────────────────────────────── */
const SNAP_YELLOW = "#FFFC00";
const SNAP_DARK   = "#0a0a0a";

/* ─── Sandbox / demo data ─────────────────────────────────────────────── */
const DEMO_ORG = {
  id: "org_demo_001",
  name: "Urban Culture Connect B.V.",
  email: "admin@urbancultureconnect.nl",
  country: "NL",
  currency: "EUR",
  ad_accounts: 2,
};

const DEMO_CAMPAIGNS = [
  { id: "cmp_001", name: "BTTS Amsterdam Finals – Awareness", status: "ACTIVE",   objective: "BRAND_AWARENESS", budget: 350, spend: 218.40, impressions: 142_000, swipes: 3_840, swipe_rate: 2.70, cpm: 1.54, start: "2026-04-28", end: "2026-05-14" },
  { id: "cmp_002", name: "Shelter Ticket Sales – Conversions", status: "ACTIVE",   objective: "CONVERSIONS",     budget: 500, spend: 382.20, impressions: 98_000,  swipes: 6_100, swipe_rate: 6.22, cpm: 3.90, start: "2026-04-20", end: "2026-05-20" },
  { id: "cmp_003", name: "Graffiti Wall Launch – Reach",       status: "PAUSED",   objective: "REACH",           budget: 200, spend: 200.00, impressions: 210_000, swipes: 2_100, swipe_rate: 1.00, cpm: 0.95, start: "2026-03-01", end: "2026-03-31" },
  { id: "cmp_004", name: "Style DNA Feature – App Installs",   status: "SCHEDULED",objective: "APP_INSTALLS",    budget: 400, spend: 0,      impressions: 0,       swipes: 0,     swipe_rate: 0,    cpm: 0,    start: "2026-05-20", end: "2026-06-10" },
];

const DEMO_DAILY_STATS = [
  { date: "May 6",  impressions: 11200, swipes: 320, spend: 23.40, reach: 9800  },
  { date: "May 7",  impressions: 13800, swipes: 415, spend: 31.20, reach: 11200 },
  { date: "May 8",  impressions: 9400,  swipes: 260, spend: 19.80, reach: 8100  },
  { date: "May 9",  impressions: 15600, swipes: 540, spend: 38.00, reach: 13200 },
  { date: "May 10", impressions: 18200, swipes: 690, spend: 44.50, reach: 15800 },
  { date: "May 11", impressions: 21400, swipes: 810, spend: 52.10, reach: 18400 },
  { date: "May 12", impressions: 19800, swipes: 760, spend: 48.90, reach: 17200 },
];

const DEMO_AUDIENCE = [
  { name: "13–17", value: 12 }, { name: "18–24", value: 38 }, { name: "25–34", value: 31 },
  { name: "35–44", value: 13 }, { name: "45+",   value: 6  },
];

const PIE_COLORS = ["#FFFC00","#FFD700","#FFA500","#FF8C00","#ffd54f"];

const REVENUE_MODELS = [
  {
    icon: <Megaphone size={18} />,
    title: "Snap Ads Agency",
    color: "from-yellow-400/20 to-yellow-600/10 border-yellow-500/30",
    badge: "Most Popular",
    desc: "Manage Snap Ad campaigns for Dutch urban brands, venues & events. You handle strategy, creative and budget — they pay you.",
    howItWorks: [
      "Onboard 3–5 local brands/venues as ad clients",
      "Charge 15–20% management fee on top of ad spend",
      "€500 avg monthly ad spend per client × 20% = €100/client/month",
      "10 clients = €1,000–€2,000/month recurring",
    ],
    potential: "€1K–€5K/mo",
    effort: "Medium",
  },
  {
    icon: <Star size={18} />,
    title: "Spotlight Creator Revenue",
    color: "from-purple-400/20 to-purple-600/10 border-purple-500/30",
    badge: "Passive",
    desc: "Snap pays creators whose Spotlight videos get views. Publish content from Urban Culture Connect events & culture moments.",
    howItWorks: [
      "Post 5–10 Spotlight videos per week from events",
      "Snap's Creator Monetization pays per 1 million views",
      "Urban culture content gets high organic reach (dance, music, street art)",
      "Stack with brand deals for sponsored Spotlight posts",
    ],
    potential: "€200–€2K/mo",
    effort: "Low",
  },
  {
    icon: <Layers size={18} />,
    title: "Branded AR Lenses",
    color: "from-cyan-400/20 to-cyan-600/10 border-cyan-500/30",
    badge: "Premium",
    desc: "Design custom AR lenses for urban culture events using Snap Lens Studio. Sell licenses to event organisers & brands.",
    howItWorks: [
      "Build a branded lens for a BBoy battle or street art festival",
      "Charge €500–€2,000 per lens license",
      "Add a Snap Ads campaign to boost the lens = extra agency fee",
      "Exclusive lenses for premium clients at higher rates",
    ],
    potential: "€2K–€10K/project",
    effort: "High",
  },
  {
    icon: <Users size={18} />,
    title: "Audience Data Reports",
    color: "from-green-400/20 to-green-600/10 border-green-500/30",
    badge: "B2B",
    desc: "Use Snap's audience insights to create paid trend reports for brands targeting 18–34 urban youth in the Netherlands.",
    howItWorks: [
      "Aggregate anonymised Snap audience data from campaigns",
      "Bundle into quarterly Dutch Urban Youth Trend Reports",
      "Sell to brands, municipalities & cultural organisations",
      "€299–€799 per report or €99/month subscription",
    ],
    potential: "€500–€3K/mo",
    effort: "Low",
  },
];

const SETUP_STEPS = [
  { step: 1, title: "Create Snap Business account", desc: "Go to business.snapchat.com and create a free Business account for Urban Culture Connect.", link: "https://business.snapchat.com", done: false },
  { step: 2, title: "Create developer app", desc: "Go to kit.snapchat.com → My Apps → New App. Select 'Marketing API' as the product. Note your Client ID and Client Secret.", link: "https://kit.snapchat.com", done: false },
  { step: 3, title: "Set redirect URI", desc: "In your app settings, add the redirect URI shown below to the list of allowed redirect URIs.", link: "", done: false },
  { step: 4, title: "Add credentials here", desc: "Paste your Client ID and Client Secret in the Credentials section below and save them as secrets.", link: "", done: false },
  { step: 5, title: "Connect your account", desc: "Click 'Connect Snapchat Business' below to authorise Urban Culture Connect to manage your Snap Ads.", link: "", done: false },
];

function fmt(n: number) {
  if (!n && n !== 0) return "–";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1)     + "K";
  return String(n);
}
function eur(n: number) { return "€" + n.toFixed(2).replace(".", ","); }

/* ─── Stat card ───────────────────────────────────────────────────────── */
function StatCard({ icon, label, value, sub, trend, color = "text-yellow-400" }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; trend?: number; color?: string;
}) {
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className={cn("p-2 rounded-lg bg-zinc-800", color)}>{icon}</div>
          {trend !== undefined && (
            <span className={cn("text-xs font-semibold flex items-center gap-0.5", trend >= 0 ? "text-green-400" : "text-red-400")}>
              {trend >= 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}{Math.abs(trend)}%
            </span>
          )}
        </div>
        <p className="mt-3 text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-zinc-400">{label}</p>
        {sub && <p className="text-xs text-zinc-600 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

/* ─── Campaign status badge ───────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: "bg-green-500/20 text-green-400 border-green-500/30",
    PAUSED: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    SCHEDULED: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    ENDED: "bg-zinc-700 text-zinc-400 border-zinc-600",
  };
  return (
    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", map[status] || map.ENDED)}>
      {status}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
export default function AdminSnapchatPage() {
  const [, navigate] = useLocation();
  const { toast }   = useToast();
  const [tab, setTab]           = useState("overview");
  const [copied, setCopied]     = useState(false);
  const [useDemoData, setUseDemoData] = useState(true);
  const [revenueAdSpend, setRevenueAdSpend] = useState(500);
  const [revenueClients, setRevenueClients] = useState(5);
  const [revenueFee, setRevenueFee]         = useState(18);

  /* OAuth status */
  const { data: statusData, isLoading: statusLoading } = useQuery<{ connected: boolean }>({
    queryKey: ["/api/snapchat/status"],
  });
  const connected = statusData?.connected ?? false;

  /* Disconnect mutation */
  const disconnectMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/snapchat/disconnect"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/snapchat/status"] });
      toast({ title: "Disconnected from Snapchat" });
    },
  });

  /* Handle URL params on return from OAuth */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      toast({ title: "Snapchat connected!", description: "Your Snap Business account is now linked." });
      setUseDemoData(false);
      navigate("/admin/snapchat", { replace: true });
    }
    if (params.get("error")) {
      toast({ title: "Connection failed", description: decodeURIComponent(params.get("error")!), variant: "destructive" });
      navigate("/admin/snapchat", { replace: true });
    }
  }, []);

  const redirectUri = `${window.location.origin}/api/snapchat/callback`;
  const copyRedirectUri = () => {
    navigator.clipboard.writeText(redirectUri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* Derived revenue calculator */
  const monthlyRevenue  = revenueClients * revenueAdSpend * (revenueFee / 100);
  const annualRevenue   = monthlyRevenue * 12;
  const totalAdSpend    = revenueClients * revenueAdSpend;

  /* Summary stats from demo or real */
  const totalImpressions = DEMO_DAILY_STATS.reduce((a, d) => a + d.impressions, 0);
  const totalSwipes      = DEMO_DAILY_STATS.reduce((a, d) => a + d.swipes,      0);
  const totalSpend       = DEMO_DAILY_STATS.reduce((a, d) => a + d.spend,       0);
  const activeCampaigns  = DEMO_CAMPAIGNS.filter(c => c.status === "ACTIVE").length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">

      {/* ── Header ── */}
      <div className="border-b border-zinc-800 bg-zinc-900/60 sticky top-0 z-30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: SNAP_YELLOW }}>
              <SiSnapchat size={20} className="text-black" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-none">Snapchat Business Hub</h1>
              <p className="text-xs text-zinc-400 mt-0.5">Ads management, analytics &amp; monetisation</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {useDemoData && (
              <Badge className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-[10px]">
                Demo data
              </Badge>
            )}
            {connected ? (
              <div className="flex items-center gap-2">
                <Badge className="bg-green-500/20 text-green-400 border border-green-500/30 text-[10px]">
                  <CheckCircle2 size={10} className="mr-1" /> Connected
                </Badge>
                <Button size="sm" variant="ghost" className="text-xs text-zinc-400 hover:text-white h-7"
                  onClick={() => disconnectMutation.mutate()}>
                  Disconnect
                </Button>
              </div>
            ) : (
              <a href="/api/snapchat/auth">
                <Button size="sm" className="h-7 text-xs font-semibold text-black" style={{ background: SNAP_YELLOW }}>
                  <LogIn size={12} className="mr-1.5" /> Connect Snapchat
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* ── Not-connected banner ── */}
        {!connected && (
          <Card className="border border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center" style={{ background: SNAP_YELLOW }}>
                <SiSnapchat size={20} className="text-black" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-yellow-300 text-sm">Connect your Snapchat Business account</p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Live data, real campaign management and revenue tracking will activate once you connect.
                  The <strong className="text-white">Revenue Model</strong> and <strong className="text-white">Setup Guide</strong> tabs work now.
                </p>
              </div>
              <a href="/api/snapchat/auth" className="flex-shrink-0">
                <Button size="sm" className="text-black font-bold text-xs" style={{ background: SNAP_YELLOW }}>
                  Connect now <ChevronRight size={12} className="ml-1" />
                </Button>
              </a>
            </CardContent>
          </Card>
        )}

        {/* ── Tabs ── */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-zinc-900 border border-zinc-800 h-9 p-0.5 flex-wrap gap-0.5">
            {[
              { id: "overview",  label: "Overview",    icon: <BarChart3 size={12} /> },
              { id: "campaigns", label: "Campaigns",   icon: <Megaphone size={12} /> },
              { id: "analytics", label: "Analytics",   icon: <TrendingUp size={12} /> },
              { id: "audience",  label: "Audience",    icon: <Users size={12} /> },
              { id: "revenue",   label: "Revenue",     icon: <DollarSign size={12} /> },
              { id: "setup",     label: "Setup Guide", icon: <Key size={12} /> },
            ].map(t => (
              <TabsTrigger key={t.id} value={t.id}
                className="h-8 px-3 text-xs data-[state=active]:bg-yellow-500 data-[state=active]:text-black flex items-center gap-1.5">
                {t.icon}{t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ════════════════════════════════════════════════════ OVERVIEW ═══ */}
          <TabsContent value="overview" className="mt-4 space-y-4">

            {/* Stat cards row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard icon={<Eye size={16} />}         label="Impressions (7d)"  value={fmt(totalImpressions)} trend={14}  color="text-yellow-400" />
              <StatCard icon={<MousePointer size={16} />} label="Swipes (7d)"      value={fmt(totalSwipes)}      trend={8}   color="text-blue-400" />
              <StatCard icon={<DollarSign size={16} />}  label="Ad Spend (7d)"     value={eur(totalSpend)}       trend={-3}  color="text-green-400" />
              <StatCard icon={<Megaphone size={16} />}   label="Active Campaigns"  value={String(activeCampaigns)} sub="2 scheduled" color="text-purple-400" />
            </div>

            {/* Impressions chart */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Impressions &amp; Swipes — Last 7 days</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={DEMO_DAILY_STATS} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradImp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={SNAP_YELLOW} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={SNAP_YELLOW} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradSwp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#60a5fa" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717a" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#71717a" }} />
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="impressions" stroke={SNAP_YELLOW} fill="url(#gradImp)" strokeWidth={2} name="Impressions" />
                    <Area type="monotone" dataKey="swipes"      stroke="#60a5fa"    fill="url(#gradSwp)" strokeWidth={2} name="Swipes" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Active campaigns mini-list */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">Active Campaigns</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs text-yellow-400 h-7"
                  onClick={() => setTab("campaigns")}>
                  View all <ChevronRight size={12} />
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {DEMO_CAMPAIGNS.filter(c => c.status === "ACTIVE").map(c => (
                  <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg bg-zinc-800/60">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{c.name}</p>
                      <p className="text-[10px] text-zinc-500">{c.objective.replace(/_/g," ")}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-semibold text-white">{eur(c.spend)}</p>
                      <p className="text-[10px] text-zinc-500">of {eur(c.budget)}</p>
                    </div>
                    <div className="w-20 flex-shrink-0">
                      <Progress value={(c.spend / c.budget) * 100} className="h-1.5" />
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Quick revenue teaser */}
            <Card className="border border-yellow-500/20 bg-gradient-to-r from-yellow-500/10 to-transparent">
              <CardContent className="p-4 flex items-center gap-4">
                <DollarSign size={32} className="text-yellow-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-white text-sm">Monetise your Snap integration</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Managing ads for just 5 clients at €500/month each = <strong className="text-yellow-300">€450–€900/month</strong> revenue for Urban Culture Connect.
                  </p>
                </div>
                <Button size="sm" className="flex-shrink-0 text-black font-bold text-xs h-8"
                  style={{ background: SNAP_YELLOW }} onClick={() => setTab("revenue")}>
                  See models <ChevronRight size={12} />
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════════════════════════════════════════════════ CAMPAIGNS ═══ */}
          <TabsContent value="campaigns" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">All Campaigns</h2>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs border-zinc-700">
                  <RefreshCw size={11} className="mr-1.5" /> Refresh
                </Button>
                <a href="https://ads.snapchat.com" target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="h-7 text-xs text-black font-bold" style={{ background: SNAP_YELLOW }}>
                    <ExternalLink size={11} className="mr-1.5" /> Open Snap Ads
                  </Button>
                </a>
              </div>
            </div>

            <div className="space-y-3">
              {DEMO_CAMPAIGNS.map(c => (
                <Card key={c.id} className="bg-zinc-900 border-zinc-800 hover:border-zinc-600 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-white">{c.name}</p>
                          <StatusBadge status={c.status} />
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          {c.objective.replace(/_/g, " ")} · {c.start} → {c.end}
                        </p>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-center">
                        <div>
                          <p className="text-xs font-bold text-white">{fmt(c.impressions)}</p>
                          <p className="text-[9px] text-zinc-500">Impressions</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">{fmt(c.swipes)}</p>
                          <p className="text-[9px] text-zinc-500">Swipes</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">{c.swipe_rate.toFixed(2)}%</p>
                          <p className="text-[9px] text-zinc-500">Swipe rate</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">{eur(c.spend)}</p>
                          <p className="text-[9px] text-zinc-500">Spent</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Progress value={c.budget > 0 ? (c.spend / c.budget) * 100 : 0} className="flex-1 h-1.5" />
                      <span className="text-[10px] text-zinc-500 flex-shrink-0">
                        {eur(c.spend)} / {eur(c.budget)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="bg-zinc-800/50 border-zinc-700">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-zinc-400">
                  Create and edit campaigns directly in{" "}
                  <a href="https://ads.snapchat.com" target="_blank" rel="noopener noreferrer"
                    className="text-yellow-400 hover:underline">Snap Ads Manager</a>.
                  Campaign data syncs here for monitoring and reporting.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════════════════════════════════════════════════ ANALYTICS ═══ */}
          <TabsContent value="analytics" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard icon={<BarChart2 size={16} />}    label="CPM"              value="€1.82"   sub="Cost per 1000 impressions" color="text-yellow-400" />
              <StatCard icon={<MousePointer size={16} />} label="Avg Swipe Rate"   value="3.31%"   sub="Industry avg 1.5%"         trend={12} color="text-blue-400" />
              <StatCard icon={<Clock size={16} />}        label="Avg Screen Time"  value="4.2 sec" sub="Per impression"             color="text-purple-400" />
              <StatCard icon={<TrendingUp size={16} />}   label="Total Reach"      value={fmt(84_000)} sub="Unique accounts"       trend={22} color="text-green-400" />
            </div>

            {/* Spend vs Impressions bar chart */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Daily Spend (EUR)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={DEMO_DAILY_STATS} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717a" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#71717a" }} />
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [`€${Number(v).toFixed(2)}`, "Spend"]} />
                    <Bar dataKey="spend" fill={SNAP_YELLOW} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Performance table */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Campaign Performance Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-500">
                        <th className="text-left py-2 pr-3 font-medium">Campaign</th>
                        <th className="text-right py-2 px-2 font-medium">Impressions</th>
                        <th className="text-right py-2 px-2 font-medium">Swipes</th>
                        <th className="text-right py-2 px-2 font-medium">Swipe%</th>
                        <th className="text-right py-2 px-2 font-medium">CPM</th>
                        <th className="text-right py-2 pl-2 font-medium">Spend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {DEMO_CAMPAIGNS.filter(c => c.impressions > 0).map(c => (
                        <tr key={c.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                          <td className="py-2 pr-3 font-medium text-white max-w-[200px] truncate">{c.name}</td>
                          <td className="text-right py-2 px-2 text-zinc-300">{fmt(c.impressions)}</td>
                          <td className="text-right py-2 px-2 text-zinc-300">{fmt(c.swipes)}</td>
                          <td className="text-right py-2 px-2">
                            <span className={cn("font-semibold", c.swipe_rate > 3 ? "text-green-400" : "text-zinc-300")}>
                              {c.swipe_rate.toFixed(2)}%
                            </span>
                          </td>
                          <td className="text-right py-2 px-2 text-zinc-300">€{c.cpm.toFixed(2)}</td>
                          <td className="text-right py-2 pl-2 font-semibold text-white">{eur(c.spend)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-zinc-700">
                        <td className="py-2 pr-3 font-bold text-white">Total</td>
                        <td className="text-right py-2 px-2 font-bold text-white">{fmt(DEMO_CAMPAIGNS.reduce((a,c) => a+c.impressions,0))}</td>
                        <td className="text-right py-2 px-2 font-bold text-white">{fmt(DEMO_CAMPAIGNS.reduce((a,c) => a+c.swipes,0))}</td>
                        <td className="text-right py-2 px-2 font-bold text-yellow-400">
                          {(DEMO_CAMPAIGNS.filter(c=>c.impressions>0).reduce((a,c)=>a+c.swipe_rate,0)/DEMO_CAMPAIGNS.filter(c=>c.impressions>0).length).toFixed(2)}%
                        </td>
                        <td className="text-right py-2 px-2 font-bold text-white">—</td>
                        <td className="text-right py-2 pl-2 font-bold text-yellow-400">{eur(DEMO_CAMPAIGNS.reduce((a,c)=>a+c.spend,0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════════════════════════════════════════════ AUDIENCE ═══ */}
          <TabsContent value="audience" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Age pie */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Age Distribution</CardTitle>
                  <CardDescription className="text-xs">Based on ad delivery audience</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <RePieChart>
                      <Pie data={DEMO_AUDIENCE} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                        paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}%`}
                        labelLine={false} fontSize={11}>
                        {DEMO_AUDIENCE.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }}
                        formatter={(v: any) => [`${v}%`, "Share"]} />
                    </RePieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Audience insights */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Audience Insights</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: "Primary age group",  value: "18–24 years",    pct: 38, color: "bg-yellow-500" },
                    { label: "Secondary age group", value: "25–34 years",    pct: 31, color: "bg-yellow-600" },
                    { label: "Top location",        value: "Amsterdam",      pct: 44, color: "bg-blue-500" },
                    { label: "Second location",     value: "Rotterdam",      pct: 22, color: "bg-blue-600" },
                    { label: "Top interest",        value: "Music & Events", pct: 61, color: "bg-purple-500" },
                    { label: "Device",              value: "iOS (54%)",      pct: 54, color: "bg-green-500" },
                  ].map(row => (
                    <div key={row.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-400">{row.label}</span>
                        <span className="text-white font-medium">{row.value}</span>
                      </div>
                      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", row.color)} style={{ width: `${row.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Why this matters */}
            <Card className="border border-blue-500/20 bg-blue-500/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Info size={18} className="text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-white">Why Snapchat for urban culture?</p>
                    <p className="text-xs text-zinc-400 mt-1">
                      Snapchat's core users are <strong className="text-white">13–34 year olds</strong> — the exact demographic for your
                      BBoy battles, street art, music events and skate culture. The Netherlands has over
                      <strong className="text-white"> 4 million active Snapchat users</strong>, with the highest concentration in
                      Amsterdam, Rotterdam and Utrecht. Your campaigns reach them at a lower cost than Instagram or TikTok.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ════════════════════════════════════════════════════ REVENUE ═══ */}
          <TabsContent value="revenue" className="mt-4 space-y-6">

            <div>
              <h2 className="text-base font-bold text-white">How to make money with Snapchat API</h2>
              <p className="text-sm text-zinc-400 mt-1">
                Snap's API isn't just for analytics — it's a business tool. Here are four proven models for Urban Culture Connect.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {REVENUE_MODELS.map(model => (
                <Card key={model.title}
                  className={cn("border bg-gradient-to-br", model.color)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-white/10 text-white">{model.icon}</div>
                        <div>
                          <p className="font-bold text-white text-sm">{model.title}</p>
                          <p className="text-[10px] text-zinc-400">{model.potential} potential</p>
                        </div>
                      </div>
                      <Badge className="text-[9px] bg-white/10 text-white border-white/20">{model.badge}</Badge>
                    </div>
                    <p className="text-xs text-zinc-300 mb-3">{model.desc}</p>
                    <div className="space-y-1.5">
                      {model.howItWorks.map((step, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-[9px] font-bold text-zinc-500 mt-0.5 flex-shrink-0 w-3">{i + 1}.</span>
                          <p className="text-[11px] text-zinc-300">{step}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between pt-3 border-t border-white/10">
                      <span className="text-[10px] text-zinc-500">Effort: <span className="text-zinc-300">{model.effort}</span></span>
                      <span className="text-xs font-bold text-white">{model.potential}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Revenue calculator */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Wallet size={16} className="text-yellow-400" /> Revenue Calculator — Snap Ads Agency
                </CardTitle>
                <CardDescription className="text-xs">
                  Calculate your monthly earnings from managing Snap Ads for clients.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-400 font-medium">Number of clients</label>
                    <Input type="number" min={1} max={50} value={revenueClients}
                      onChange={e => setRevenueClients(Number(e.target.value))}
                      className="bg-zinc-800 border-zinc-700 h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-400 font-medium">Avg monthly ad spend per client (€)</label>
                    <Input type="number" min={100} value={revenueAdSpend}
                      onChange={e => setRevenueAdSpend(Number(e.target.value))}
                      className="bg-zinc-800 border-zinc-700 h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-400 font-medium">Management fee (%)</label>
                    <Input type="number" min={5} max={30} value={revenueFee}
                      onChange={e => setRevenueFee(Number(e.target.value))}
                      className="bg-zinc-800 border-zinc-700 h-9 text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="text-center p-3 rounded-lg bg-zinc-800">
                    <p className="text-xl font-bold text-yellow-400">€{totalAdSpend.toLocaleString()}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">Total ad spend managed/mo</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-yellow-500/20 border border-yellow-500/30">
                    <p className="text-xl font-bold text-yellow-300">€{monthlyRevenue.toLocaleString("nl-NL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Your monthly revenue</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-zinc-800">
                    <p className="text-xl font-bold text-green-400">€{annualRevenue.toLocaleString("nl-NL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">Annual revenue potential</p>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-zinc-800/60 border border-zinc-700/50">
                  <p className="text-xs text-zinc-300">
                    <Lightbulb size={12} className="inline mr-1 text-yellow-400" />
                    <strong>Tip:</strong> Start with 3 local urban culture clients — a BBoy event organiser, a venue like Shelter Amsterdam,
                    and a graffiti art brand. Once you show results, scale to 10+ clients. The Snap API gives you all campaign control,
                    analytics and reporting you need to run a professional ad agency.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════════════════════════════════════════════════ SETUP GUIDE ═ */}
          <TabsContent value="setup" className="mt-4 space-y-4">

            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Step-by-step setup</CardTitle>
                <CardDescription className="text-xs">Follow these steps to connect your Snapchat Business account and activate the Marketing API.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {SETUP_STEPS.map((s, i) => (
                  <div key={s.step} className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border",
                    s.done ? "bg-green-500/10 border-green-500/30" : "bg-zinc-800/50 border-zinc-700/50"
                  )}>
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5",
                      s.done ? "bg-green-500 text-white" : "bg-zinc-700 text-zinc-300"
                    )}>
                      {s.done ? <CheckCircle2 size={14} /> : s.step}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{s.title}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">{s.desc}</p>
                      {s.step === 3 && (
                        <div className="mt-2 flex items-center gap-2">
                          <code className="text-[11px] bg-zinc-950 text-yellow-300 px-2 py-1 rounded flex-1 truncate">
                            {redirectUri}
                          </code>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={copyRedirectUri}>
                            {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                          </Button>
                        </div>
                      )}
                      {s.link && (
                        <a href={s.link} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-yellow-400 hover:text-yellow-300 mt-1.5">
                          Open {s.link.replace("https://","")} <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Credentials section */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Key size={14} className="text-yellow-400" /> API Credentials
                </CardTitle>
                <CardDescription className="text-xs">
                  Add these as Replit Secrets (Environment Variables). Go to the Replit Secrets panel and add them.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { key: "SNAP_CLIENT_ID",     desc: "From kit.snapchat.com → My Apps → your app → Client ID" },
                  { key: "SNAP_CLIENT_SECRET", desc: "From kit.snapchat.com → My Apps → your app → Client Secret" },
                ].map(cred => (
                  <div key={cred.key} className="p-3 rounded-lg bg-zinc-800 border border-zinc-700">
                    <div className="flex items-center justify-between">
                      <code className="text-xs text-yellow-300 font-mono">{cred.key}</code>
                      <Badge className="text-[9px] bg-zinc-700 text-zinc-300 border-zinc-600">Replit Secret</Badge>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1">{cred.desc}</p>
                  </div>
                ))}

                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-xs text-zinc-300">
                    <Info size={12} className="inline mr-1 text-blue-400" />
                    <strong>Optional:</strong> Set <code className="text-yellow-300 text-[10px]">SNAP_REDIRECT_URI</code> only if your domain
                    changes. By default the redirect URI auto-detects from your Replit domain.
                  </p>
                </div>

                <Separator className="bg-zinc-800" />

                <div className="flex flex-col sm:flex-row gap-3">
                  <a href="/api/snapchat/auth" className="flex-1">
                    <Button className="w-full text-black font-bold text-sm h-10" style={{ background: SNAP_YELLOW }}
                      data-testid="button-snapchat-connect">
                      <SiSnapchat size={16} className="mr-2" /> Connect Snapchat Business
                    </Button>
                  </a>
                  <a href="https://kit.snapchat.com" target="_blank" rel="noopener noreferrer" className="flex-1">
                    <Button variant="outline" className="w-full border-zinc-700 text-zinc-300 h-10 text-sm">
                      <ExternalLink size={14} className="mr-2" /> Snap Developer Portal
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>

            {/* API scopes */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Requested API Permissions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { scope: "snapchat-marketing-api",               desc: "Full access to Snap Ads Manager: campaigns, ad sets, ads, audience, stats" },
                  { scope: "snapchat-marketing-api.campaigns.read",  desc: "Read campaign list and performance data" },
                  { scope: "snapchat-marketing-api.campaigns.write", desc: "Create and manage campaigns (for future agency features)" },
                  { scope: "snapchat-marketing-api.stats.read",      desc: "Access performance metrics: impressions, swipes, spend, reach" },
                ].map(s => (
                  <div key={s.scope} className="flex items-start gap-2 p-2 rounded bg-zinc-800/50">
                    <Shield size={12} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <code className="text-[11px] text-yellow-300">{s.scope}</code>
                      <p className="text-[10px] text-zinc-400">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
