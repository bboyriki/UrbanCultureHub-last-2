import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { OutreachLead, OutreachEmail, OutreachEmailOpen } from "@shared/schema";
import {
  Mail, Phone, Globe, Building2, Plus, Trash2, Edit3, Send,
  Users, CheckCircle, MessageCircle, XCircle, Clock, Sparkles,
  Search, MailCheck, Zap, Bot, RefreshCw, Copy, Music, Landmark,
  Newspaper, MapPin, Filter, CheckSquare, Square, Trophy, Smartphone,
  ExternalLink, BarChart2, Eye, EyeOff, History, TrendingUp, Target,
  Activity, ChevronDown, ChevronUp, Info, ArrowUpRight, Calendar,
  Download, ArrowUpDown, ArrowUp, ArrowDown, Inbox, Reply,
  AlertCircle, Tag, SlidersHorizontal, Star, Linkedin,
} from "lucide-react";
import { SiLinkedin } from "react-icons/si";

// ── Types & config ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string; icon: any }> = {
  new:               { label: "New",           color: "bg-gray-100 text-gray-700",     icon: Clock },
  contacted:         { label: "Contacted",     color: "bg-blue-100 text-blue-700",     icon: Mail },
  replied:           { label: "Replied",       color: "bg-indigo-100 text-indigo-700", icon: MessageCircle },
  interested:        { label: "Interested",    color: "bg-green-100 text-green-700",   icon: CheckCircle },
  not_interested:    { label: "Not Interested",color: "bg-red-100 text-red-700",       icon: XCircle },
  meeting_scheduled: { label: "Meeting",       color: "bg-purple-100 text-purple-700", icon: CheckCircle },
};

const TYPE_CFG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  municipality: { label: "Municipality", color: "text-blue-700",   bg: "bg-blue-50 border-blue-200",    icon: Landmark },
  venue:        { label: "Venue",        color: "text-orange-700", bg: "bg-orange-50 border-orange-200", icon: Music },
  cultural_org: { label: "Cultural Org", color: "text-purple-700", bg: "bg-purple-50 border-purple-200", icon: Users },
  media:        { label: "Media",        color: "text-pink-700",   bg: "bg-pink-50 border-pink-200",     icon: Newspaper },
  sponsor:      { label: "Sponsor",      color: "text-amber-700",  bg: "bg-amber-50 border-amber-200",   icon: Trophy },
};

// ── AI quick prompts per type ─────────────────────────────────────────────────

const QUICK_PROMPTS: Record<string, { label: string; prompt: string }[]> = {
  municipality: [
    { label: "Intro email NL", prompt: "Schrijf een professionele Nederlandse introductie-email voor een gemeentelijke cultuurafdeling over Urban Culture Connect. Benadruk digitale innovatie, jeugdparticipatie en cultureel beleid." },
    { label: "Meeting request", prompt: "Schrijf een korte email om een kennismakingsgesprek aan te vragen met de cultuurafdeling van de gemeente. Maximaal 150 woorden." },
    { label: "Subsidie angle", prompt: "Schrijf een email gericht op subsidie- of partnerschap-mogelijkheden voor cultural policy officers. Verbind het platform aan gemeentelijke cultuurbeleidsdoelen." },
    { label: "English intro", prompt: "Write a professional English introduction email to a Dutch municipal cultural department about Urban Culture Connect." },
  ],
  venue: [
    { label: "Al op de kaart", prompt: "Schrijf een email aan een venue die al op onze kaart staat. Vertel hen dat ze featured zijn, en bied een partnership aan om meer bezoekers te trekken via de community." },
    { label: "Partnership pitch", prompt: "Schrijf een partnership email aan een Nederlandse muziekclub of culturele venue. Focus op hoe het platform hun bereik vergroot en nieuwe bezoekers aantrekt." },
    { label: "Events exposure", prompt: "Schrijf een email gericht op het promoten van hun events via Urban Culture Connect. Leg uit hoe de events functie werkt en wat de voordelen zijn." },
    { label: "Community value", prompt: "Schrijf een email die de community-waarde benadrukt voor venues: reviews, ratings, vaste bezoekers-community, word-of-mouth via de app." },
  ],
  cultural_org: [
    { label: "Platform partner", prompt: "Schrijf een email aan een urban culture organisatie (hiphop/breakdance/graffiti). Stel voor als platformpartner samen te werken voor community-building." },
    { label: "Evenement partner", prompt: "Schrijf een email over samenwerking bij events: battles, workshops, jams. Hoe het platform hun events kan promoten bij de hele urban community in Nederland." },
    { label: "Artiest exposure", prompt: "Schrijf een email over hoe de organisatie artiesten beter zichtbaar kan maken via de artiestenprofielen en community feed." },
    { label: "Jeugdwerk", prompt: "Schrijf een email voor een jongerenwerk-organisatie. Focus op de sociale waarde: veiligheidsfeatures, community, digitale deelname voor jongeren." },
  ],
  media: [
    { label: "Press pitch", prompt: "Schrijf een persberichtachtige email aan een hiphop media of magazine over Urban Culture Connect. Includef interessante statistieken en unique selling points." },
    { label: "Collaboration", prompt: "Schrijf een email over content samenwerking: featured articles, cross-promotie, co-branded content over de urban culture scene in Nederland." },
    { label: "Coverage verzoek", prompt: "Schrijf een korte, directe email die vraagt om coverage van het platform. Geef 2-3 haakjes voor een interessant artikel." },
  ],
  sponsor: [
    { label: "Sponsorship pitch", prompt: "Schrijf een professionele Nederlandse sponsorship email aan een merk zoals Nike, Adidas of Red Bull over Urban Culture Hub. Benadruk bereik, doelgroep (14-35 jaar, urban culture enthousiastelingen), events-samenwerking en brand alignment met street culture." },
    { label: "Event co-sponsor", prompt: "Schrijf een email over co-sponsoring van Urban Culture Hub events (battles, workshops, festivals). Focus op brand exposure, activatiekansen tijdens events en community bereik." },
    { label: "Product deal pitch", prompt: "Schrijf een email over een product-partnership: merchandise collab, product drops of giveaways via het Urban Culture Hub platform en community." },
    { label: "English brand pitch", prompt: "Write a professional English sponsorship email to a major brand about partnering with Urban Culture Hub. Include audience demographics, community reach, and event activation opportunities." },
  ],
};

// ── AI system prompt ──────────────────────────────────────────────────────────

const buildSystemPrompt = (type: string, orgName?: string, city?: string) => `
Je bent een professionele outreach-assistent voor Urban Culture Connect — het digitale platform voor hiphop en straatcultuur in Nederland.

## Over Urban Culture Connect

**Wat het is:** Een community-platform dat hip-hop en street culture communities verbindt in Nederland.

**Kernfuncties:**
- 🗺️ Interactieve kaart met 96 admin-gecureerde urban culture hotspots in 10 Nederlandse steden (Amsterdam, Den Haag, Rotterdam, Haarlem, Almere, Alkmaar, Baarn, Utrecht, Zaanstad, Zandvoort)
- 👥 Community feed: posts, reacties, likes — vergelijkbaar met Instagram maar exclusief voor urban culture
- 🎉 Events systeem: aanmaken, RSVP, ticketing met QR-codes en betaling via Stripe
- 🤝 Follow/connect systeem met vriendschapsverzoeken en DM's
- 📍 Friends Nearby: proximity-technologie om andere community-leden in de buurt te vinden
- ⚖️ Legal Hub: AVG/GDPR-compliant kennisbank specifiek voor Nederland
- ⭐ Venue reviews & ratings systeem
- 🤖 AI tools: Deal Finder, Place Finder, Safety Monitor
- 🔒 Veiligheidsfeatures: Safety panel, vertrouwde contacten, veiligheidsmeldingen

**Communities op het platform:** B-boys/B-girls, breakdancers, hiphop-dansers, graffiti artiesten, MCs, DJs, beatmakers, skaters, parkour-atleten, BMX-rijders, spoken word-artiesten

**Technologie:** Mobiel-vriendelijk, progressive web app, real-time WebSocket communicatie, Cloudinary media opslag, volledig in het Nederlands beschikbaar.

**Afzender:** Riki Almouti, Urban Culture Hub | riki@dancehealthy.net
**Website:** https://urbanculturehub.nl
**iOS App:** https://apps.apple.com/nl/app/urban-culture-hub/id6743952291

---

${type === 'municipality' ? `## Gemeenten benaderen

**Argumenten voor gemeenten:**
- 🏙️ **Digitale innovatie:** Het platform digitaliseert het culturele landschap van de stad
- 👶 **Jeugdparticipatie:** Bereikt jongeren (14-35 jaar) die traditionele culturele kanalen missen
- 🗺️ **Culturele kaartlaag:** Hun stad staat al op de interactieve kaart met gecureerde hotspots
- 📊 **Data en inzichten:** Helpt bij het meten van culturele participatie
- 🤝 **Inclusiviteit:** Verbindt diverse gemeenschappen — hiphop is meest multiculturele cultuurvorm
- 💡 **Nul kosten voor gemeente:** Geen investering vereist — gewoon samenwerking
- 🎯 **Cultuurbeleid doelen:** Ondersteunt doelen rondom participatie, zichtbaarheid en innovatie
` : ''}

${type === 'sponsor' ? `## Sponsors & Merken benaderen

**Urban Culture Hub – Doelgroep voor sponsors:**
- 👥 **Doelgroep:** 14–35 jaar, urban culture enthousiastelingen in Nederland
- 🎯 **Communities:** B-boys/B-girls, hiphop-dansers, MCs, DJs, beatmakers, graffiti-artiesten, skaters, parkour
- 📱 **Kanalen:** Web platform, iOS App, events, community feed, kaart

**Sponsoring mogelijkheden:**
- 🏆 **Events co-sponsorship:** Battles, workshops, jams, festivals — brandactivatie live
- 📲 **Platform branding:** Featured sponsor badge op events, community feed exposure
- 🎁 **Product partnerships:** Product drops, giveaways, merchandise collaboraties
` : ''}

---

**Schrijfinstructies:**
- Schrijf altijd in het Nederlands tenzij de gebruiker expliciet om Engels vraagt
- Wees authentiek en niet corporate — street culture is informeel maar respectvol
- Houdt emails beknopt (max 300 woorden) tenzij anders gevraagd
- Gebruik HTML-tags: <p>, <strong>, <ul>, <li>, <br>
- Eindig altijd met een duidelijke call-to-action
- Afzender is altijd: Riki Almouti | riki@dancehealthy.net${orgName ? `\n\n**De contactpersoon is bij: ${orgName}${city ? ` in ${city}` : ''}**` : ''}
`.trim();

// ── Helpers ───────────────────────────────────────────────────────────────────

const EMPTY_LEAD: Partial<OutreachLead & { type: string }> = {
  name: "", organization: "", department: "", email: "", phone: "",
  website: "", city: "", notes: "", status: "new", type: "municipality",
};

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}

function fmtTime(d: string | Date | null | undefined) {
  if (!d) return "–";
  return new Date(d).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function openRatePct(sent: number, opened: number) {
  if (!sent) return 0;
  return Math.round((opened / sent) * 100);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, icon: Icon }: { label: string; value: string | number; sub?: string; color?: string; icon?: any }) {
  return (
    <div className="bg-white rounded-xl border border-border/60 p-3.5 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        {Icon && <Icon className={`w-4 h-4 ${color || "text-muted-foreground"}`} />}
      </div>
      <p className={`text-2xl font-bold ${color || "text-foreground"}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function OpenBadge({ count }: { count: number | null | undefined }) {
  const n = count ?? 0;
  if (n === 0) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">
      <EyeOff className="w-2.5 h-2.5" /> Not opened
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700">
      <Eye className="w-2.5 h-2.5" /> {n}× opened
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminOutreach() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"leads" | "linkedin" | "history" | "analytics">("leads");

  // ── Leads tab state ──
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [extraFilter, setExtraFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"added" | "name" | "status" | "emails">("added");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [showBulkStatusMenu, setShowBulkStatusMenu] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLead, setEditingLead] = useState<(OutreachLead & { type: string }) | null>(null);
  const [formData, setFormData] = useState<Partial<OutreachLead & { type: string }>>(EMPTY_LEAD);

  const [showComposeModal, setShowComposeModal] = useState(false);
  const [composeLead, setComposeLead] = useState<(OutreachLead & { type: string }) | null>(null);
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);

  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiChat, setAiChat] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiThinking, setAiThinking] = useState(false);
  const [aiPanelType, setAiPanelType] = useState<string>("municipality");

  // ── LinkedIn Outreach tab state ──
  const [linkedinMsgTemplate, setLinkedinMsgTemplate] = useState(
    "Hoi {name},\n\nIk ben Riki, oprichter van Urban Culture Hub — het platform voor urban sports, dans en cultuur in Nederland 🇳🇱.\n\nZou je een keer willen kijken naar wat we bouwen? Ik denk dat er een mooie samenwerking mogelijk is.\n\nGroetjes,\nRiki"
  );
  const [linkedinCopiedId, setLinkedinCopiedId] = useState<number | null>(null);
  const [linkedinOpeningAll, setLinkedinOpeningAll] = useState(false);

  // ── AI Campaign Mode state ──
  const [campaignMode, setCampaignMode] = useState<"idle" | "setup" | "generating" | "review" | "running" | "done">("idle");
  const [campaignTone, setCampaignTone] = useState("vriendelijk en direct");
  const [campaignGoal, setCampaignGoal] = useState("kennismaken en samenwerking bespreken met Urban Culture Hub");
  const [campaignMessages, setCampaignMessages] = useState<{ id: number; message: string; edited?: boolean }[]>([]);
  const [campaignGenerating, setCampaignGenerating] = useState(false);
  const [campaignCurrentIdx, setCampaignCurrentIdx] = useState(0);
  const [campaignDoneIds, setCampaignDoneIds] = useState<Set<number>>(new Set());
  const [campaignSkippedIds, setCampaignSkippedIds] = useState<Set<number>>(new Set());
  const [campaignCopied, setCampaignCopied] = useState(false);
  const [campaignMarkingId, setCampaignMarkingId] = useState<number | null>(null);

  // ── History tab state ──
  const [historySearch, setHistorySearch] = useState("");
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: leads = [], isLoading } = useQuery<(OutreachLead & { type: string })[]>({
    queryKey: ["/api/admin/outreach/leads"],
    queryFn: async () => {
      const r = await fetch("/api/admin/outreach/leads", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch leads");
      return r.json();
    },
  });

  const { data: emailHistory = [], isLoading: historyLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/outreach/emails"],
    queryFn: async () => {
      const r = await fetch("/api/admin/outreach/emails", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch email history");
      return r.json();
    },
    enabled: activeTab === "history" || activeTab === "analytics",
    staleTime: 30_000,
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery<any>({
    queryKey: ["/api/admin/outreach/analytics"],
    queryFn: async () => {
      const r = await fetch("/api/admin/outreach/analytics", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch analytics");
      return r.json();
    },
    enabled: activeTab === "analytics",
    staleTime: 60_000,
  });

  const { data: emailOpens = [] } = useQuery<OutreachEmailOpen[]>({
    queryKey: ["/api/admin/outreach/emails", selectedEmailId, "opens"],
    queryFn: async () => {
      const r = await fetch(`/api/admin/outreach/emails/${selectedEmailId}/opens`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch opens");
      return r.json();
    },
    enabled: selectedEmailId !== null,
  });

  useEffect(() => {
    fetch("/api/admin/outreach/seed", { method: "POST", credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.new > 0) queryClient.invalidateQueries({ queryKey: ["/api/admin/outreach/leads"] }); })
      .catch(() => {});
  }, []);

  // ── Mutations ────────────────────────────────────────────────────────────────

  const addLeadMutation = useMutation({
    mutationFn: async (data: Partial<OutreachLead & { type: string }>) => {
      const r = await fetch("/api/admin/outreach/leads", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data), credentials: "include",
      });
      const json = await r.json();
      if (r.status === 409) throw new Error(json.message || "This organization is already in your CRM");
      if (!r.ok) throw new Error(json.message || "Failed to add lead");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/outreach/leads"] });
      toast({ title: "Lead added" });
      setShowAddModal(false);
      setFormData(EMPTY_LEAD);
    },
    onError: (e: any) => toast({ title: "Already exists", description: e.message, variant: "destructive" }),
  });

  const updateLeadMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<OutreachLead & { type: string }> }) => {
      const r = await fetch(`/api/admin/outreach/leads/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data), credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to update lead");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/outreach/leads"] });
      toast({ title: "Lead updated" });
      setEditingLead(null);
      setShowAddModal(false);
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/admin/outreach/leads/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error("Failed to delete lead");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/outreach/leads"] });
      toast({ title: "Lead removed" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const sendEmailMutation = useMutation({
    mutationFn: async ({ leadId, subject, html, text }: { leadId: number; subject: string; html: string; text: string }) => {
      const r = await fetch("/api/admin/outreach/send-email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, subject, html, text }), credentials: "include",
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "Failed to send email");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/outreach/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/outreach/emails"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/outreach/analytics"] });
      toast({ title: "Email sent!", description: `Sent to ${composeLead?.email}` });
      setShowComposeModal(false);
      setComposeBody(""); setComposeSubject("");
    },
    onError: (e: any) => toast({ title: "Failed to send", description: e.message, variant: "destructive" }),
  });

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ leadIds, status }: { leadIds: number[]; status: string }) => {
      const r = await fetch("/api/admin/outreach/leads/bulk-status", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds, status }), credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to update status");
      return r.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/outreach/leads"] });
      toast({ title: `${data.updated} leads updated` });
      setSelectedIds(new Set());
      setShowBulkStatusMenu(false);
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const exportCsv = () => {
    const a = document.createElement("a");
    a.href = "/api/admin/outreach/leads/export-csv";
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast({ title: "CSV download started" });
  };

  const sendBulkMutation = useMutation({
    mutationFn: async ({ leadIds, subject, html, text }: { leadIds: number[]; subject: string; html: string; text: string }) => {
      const r = await fetch("/api/admin/outreach/send-bulk", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds, subject, html, text }), credentials: "include",
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "Failed to send bulk emails");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/outreach/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/outreach/emails"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/outreach/analytics"] });
      toast({ title: `Bulk sent: ${data.sent} emails`, description: data.skipped ? `${data.skipped} skipped (no email)` : undefined });
      setShowComposeModal(false);
      setComposeBody(""); setComposeSubject("");
      setSelectedIds(new Set());
    },
    onError: (e: any) => toast({ title: "Bulk send failed", description: e.message, variant: "destructive" }),
  });

  // ── AI helpers ────────────────────────────────────────────────────────────────

  const askAi = async (prompt: string, type?: string, orgName?: string, city?: string) => {
    const r = await fetch("/api/admin/outreach/ai-assist", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, context: buildSystemPrompt(type || "municipality", orgName, city) }),
      credentials: "include",
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || "AI unavailable");
    return data.text as string;
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    const type = composeLead?.type || "municipality";
    setAiGenerating(true);
    try {
      const result = await askAi(aiPrompt, type, composeLead?.organization, composeLead?.city || undefined);
      setComposeBody(result);
      toast({ title: "AI email generated" });
    } catch (e: any) {
      toast({ title: "AI error", description: e.message, variant: "destructive" });
    } finally { setAiGenerating(false); }
  };

  const handleQuickPrompt = async (prompt: string) => {
    setAiPrompt(prompt);
    const type = composeLead?.type || aiPanelType;
    setAiGenerating(true);
    try {
      const result = await askAi(prompt, type, composeLead?.organization, composeLead?.city || undefined);
      setComposeBody(result);
      toast({ title: "AI email generated" });
    } catch (e: any) {
      toast({ title: "AI error", description: e.message, variant: "destructive" });
    } finally { setAiGenerating(false); }
  };

  const handleAiChat = async () => {
    if (!aiInput.trim()) return;
    const msg = aiInput.trim();
    setAiInput("");
    setAiChat(prev => [...prev, { role: "user", text: msg }]);
    setAiThinking(true);
    try {
      const result = await askAi(msg, aiPanelType);
      setAiChat(prev => [...prev, { role: "ai", text: result }]);
    } catch (e: any) {
      setAiChat(prev => [...prev, { role: "ai", text: `Error: ${e.message}` }]);
    } finally { setAiThinking(false); }
  };

  const handleSend = () => {
    if (!composeBody.trim() || !composeSubject.trim()) {
      toast({ title: "Fill in subject and body", variant: "destructive" }); return;
    }
    const htmlBody = composeBody.replace(/\n/g, "<br>");
    if (composeLead) {
      sendEmailMutation.mutate({ leadId: composeLead.id, subject: composeSubject, html: htmlBody, text: composeBody });
    } else {
      sendBulkMutation.mutate({ leadIds: Array.from(selectedIds), subject: composeSubject, html: htmlBody, text: composeBody });
    }
  };

  const openBulkCompose = () => {
    if (selectedIds.size === 0) { toast({ title: "Select at least one lead" }); return; }
    setComposeLead(null);
    setComposeBody(""); setComposeSubject(""); setAiPrompt("");
    setShowComposeModal(true);
  };

  const openIndividualCompose = (lead: OutreachLead & { type: string }) => {
    if (!lead.email) { toast({ title: "This contact has no email address", variant: "destructive" }); return; }
    setComposeLead(lead);
    setComposeBody(""); setAiPrompt("");
    setComposeSubject(`Samenwerking Urban Culture Connect – ${lead.city || lead.organization}`);
    setShowComposeModal(true);
  };

  const toggleSelect = (id: number) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(l => l.id)));
  };

  const selectUnsent = () => {
    const unsentIds = filtered
      .filter(l => l.status === "new" && !((l as any).emailSentCount > 0) && !!l.email)
      .map(l => l.id);
    if (unsentIds.length === 0) {
      toast({ title: "All contacts with email addresses have already been emailed" });
      return;
    }
    setSelectedIds(new Set(unsentIds));
  };

  const filtered = useMemo(() => {
    let result = leads.filter(l => {
      const matchSearch = !search || [l.name, l.organization, l.department, l.email, l.city, l.phone, l.notes]
        .some(v => v?.toLowerCase().includes(search.toLowerCase()));
      const matchStatus =
        statusFilter === "all" ? true :
        statusFilter === "not_sent" ? !((l as any).emailSentCount > 0) && !!l.email :
        l.status === statusFilter;
      const matchType = typeFilter === "all" || l.type === typeFilter;
      const matchCity = cityFilter === "all" || l.city === cityFilter;
      const matchExtra =
        extraFilter === "all" ? true :
        extraFilter === "never_emailed" ? l.status === "new" && !((l as any).emailSentCount > 0) && !!l.email :
        extraFilter === "has_linkedin" ? !!l.linkedinUrl :
        extraFilter === "has_inbox_reply" ? (l as any).inboxReplyCount > 0 :
        extraFilter === "no_email" ? !l.email :
        extraFilter === "needs_followup" ? (
          l.status === "contacted" &&
          !!l.lastEmailSentAt &&
          (Date.now() - new Date(l.lastEmailSentAt).getTime()) > 7 * 24 * 3600_000
        ) : true;
      return matchSearch && matchStatus && matchType && matchCity && matchExtra;
    });
    // Sort
    result = [...result].sort((a, b) => {
      let va: any, vb: any;
      if (sortBy === "name") { va = (a.organization || "").toLowerCase(); vb = (b.organization || "").toLowerCase(); }
      else if (sortBy === "status") { va = a.status; vb = b.status; }
      else if (sortBy === "emails") { va = (a as any).emailSentCount ?? 0; vb = (b as any).emailSentCount ?? 0; }
      else { va = new Date(a.createdAt || 0).getTime(); vb = new Date(b.createdAt || 0).getTime(); }
      return sortDir === "asc" ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0);
    });
    // Deduplicate by normalized org name (keep first/highest-priority occurrence)
    const seenOrgs = new Set<string>();
    result = result.filter(l => {
      const key = (l.organization || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();
      if (!key) return true;
      if (seenOrgs.has(key)) return false;
      seenOrgs.add(key);
      return true;
    });
    return result;
  }, [leads, search, statusFilter, typeFilter, cityFilter, extraFilter, sortBy, sortDir]);

  const filteredHistory = useMemo(() => {
    if (!historySearch) return emailHistory;
    const q = historySearch.toLowerCase();
    return emailHistory.filter((e: any) =>
      e.recipientEmail?.toLowerCase().includes(q) ||
      e.subject?.toLowerCase().includes(q) ||
      e.organization?.toLowerCase().includes(q) ||
      e.city?.toLowerCase().includes(q)
    );
  }, [emailHistory, historySearch]);

  const cities = useMemo(() => {
    const cs = Array.from(new Set(leads.map(l => l.city).filter(Boolean))).sort() as string[];
    return cs;
  }, [leads]);

  const stats = useMemo(() => {
    const typeCounts = { municipality: 0, venue: 0, cultural_org: 0, media: 0, sponsor: 0 };
    leads.forEach(l => { if (l.type in typeCounts) (typeCounts as any)[l.type]++; });
    return {
      total: leads.length,
      withEmail: leads.filter(l => !!l.email).length,
      noEmail: leads.filter(l => !l.email).length,
      notSent: leads.filter(l => l.status === "new" && !((l as any).emailSentCount > 0) && !!l.email).length,
      contacted: leads.filter(l => ["contacted", "replied", "interested", "meeting_scheduled"].includes(l.status)).length,
      interested: leads.filter(l => l.status === "interested").length,
      meetings: leads.filter(l => l.status === "meeting_scheduled").length,
      new: leads.filter(l => l.status === "new").length,
      withLinkedin: leads.filter(l => !!l.linkedinUrl).length,
      inboxReplied: leads.filter(l => (l as any).inboxReplyCount > 0).length,
      needsFollowup: leads.filter(l =>
        l.status === "contacted" && !!l.lastEmailSentAt &&
        (Date.now() - new Date(l.lastEmailSentAt).getTime()) > 7 * 24 * 3600_000
      ).length,
      ...typeCounts,
    };
  }, [leads]);

  const emailStats = useMemo(() => {
    const sent = emailHistory.length;
    const opened = emailHistory.filter((e: any) => (e.openCount ?? 0) > 0).length;
    const totalOpens = emailHistory.reduce((s: number, e: any) => s + (e.openCount ?? 0), 0);
    const bulk = emailHistory.filter((e: any) => e.isBulk).length;
    return { sent, opened, totalOpens, openRate: openRatePct(sent, opened), bulk, individual: sent - bulk };
  }, [emailHistory]);

  const StatusBadge = ({ status }: { status: string }) => {
    const cfg = STATUS_CFG[status] || STATUS_CFG.new;
    const Icon = cfg.icon;
    return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.color}`}><Icon className="w-3 h-3" />{cfg.label}</span>;
  };

  const TypeBadge = ({ type }: { type: string }) => {
    const cfg = TYPE_CFG[type] || TYPE_CFG.municipality;
    const Icon = cfg.icon;
    return <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${cfg.bg} ${cfg.color}`}><Icon className="w-2.5 h-2.5" />{cfg.label}</span>;
  };

  const currentType = composeLead?.type || aiPanelType;
  const quickPrompts = QUICK_PROMPTS[currentType] || QUICK_PROMPTS.municipality;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Municipal & Community Outreach</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gemeenten · Venues · Organisaties · Media — emails via riki@dancehealthy.net
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowAiPanel(p => !p)} className="text-purple-600 border-purple-200">
            <Bot className="w-4 h-4 mr-1.5" /> AI Assistant
          </Button>
          {activeTab === "leads" && (
            <>
              <Button variant="outline" size="sm" onClick={exportCsv} className="text-gray-600" title="Export all leads as CSV">
                <Download className="w-4 h-4 mr-1.5" /> Export
              </Button>
              <Button size="sm" onClick={() => { setFormData(EMPTY_LEAD); setEditingLead(null); setShowAddModal(true); }}>
                <Plus className="w-4 h-4 mr-1.5" /> Add Lead
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-border">
        {([
          { key: "leads", label: "Leads", icon: Users },
          { key: "linkedin", label: "LinkedIn Outreach", icon: Linkedin },
          { key: "history", label: "Email History", icon: History },
          { key: "analytics", label: "Analytics", icon: BarChart2 },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? tab.key === "linkedin" ? "border-[#0A66C2] text-[#0A66C2]" : "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
            {tab.key === "leads" && <span className="ml-1 text-[10px] bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">{leads.length}</span>}
            {tab.key === "linkedin" && stats.withLinkedin > 0 && (
              <span className={`ml-1 text-[10px] rounded-full px-1.5 py-0.5 ${activeTab === "linkedin" ? "bg-[#0A66C2] text-white" : "bg-[#0A66C2]/10 text-[#0A66C2]"}`}>
                {leads.filter(l => !!l.linkedinUrl && !l.email).length}
              </span>
            )}
            {tab.key === "history" && emailHistory.length > 0 && <span className="ml-1 text-[10px] bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">{emailHistory.length}</span>}
          </button>
        ))}
      </div>

      {/* AI Panel (shared across tabs) */}
      {showAiPanel && (
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Bot className="w-4 h-4 text-purple-600 shrink-0" />
            <span className="text-sm font-semibold text-purple-800">AI Outreach Assistant</span>
            <span className="text-xs text-purple-400 ml-auto">Weet alles over Urban Culture Connect</span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {Object.entries(TYPE_CFG).map(([k, v]) => (
              <button key={k} onClick={() => setAiPanelType(k)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                  aiPanelType === k ? "bg-purple-600 text-white border-purple-600" : "border-purple-200 text-purple-600 hover:bg-purple-100"
                }`}>
                {v.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {QUICK_PROMPTS[aiPanelType]?.map(qp => (
              <button key={qp.label} onClick={async () => {
                setAiChat(prev => [...prev, { role: "user", text: qp.prompt }]);
                setAiThinking(true);
                try {
                  const r = await askAi(qp.prompt, aiPanelType);
                  setAiChat(prev => [...prev, { role: "ai", text: r }]);
                } catch(e: any) {
                  setAiChat(prev => [...prev, { role: "ai", text: `Error: ${e.message}` }]);
                } finally { setAiThinking(false); }
              }} className="text-[10px] px-2 py-1 bg-white border border-purple-200 rounded-full hover:bg-purple-50 text-purple-700">
                {qp.label}
              </button>
            ))}
          </div>
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {aiChat.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">
                Kies een type, gebruik een quick prompt, of stel je eigen vraag.
              </p>
            )}
            {aiChat.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs whitespace-pre-wrap ${
                  m.role === "user" ? "bg-purple-600 text-white" : "bg-white border border-purple-100 text-gray-800"
                }`}>
                  {m.text}
                  {m.role === "ai" && (
                    <button onClick={() => { setComposeBody(m.text); toast({ title: "Copied to compose" }); }}
                      className="ml-2 text-purple-400 hover:text-purple-600 inline-flex items-center gap-0.5">
                      <Copy className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {aiThinking && (
              <div className="flex justify-start">
                <div className="bg-white border border-purple-100 rounded-xl px-3 py-2 text-xs text-muted-foreground flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Schrijven…
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Stel een vraag of geef een instructie…"
              value={aiInput} onChange={e => setAiInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleAiChat()}
              className="text-xs h-8"
            />
            <Button size="sm" className="h-8 bg-purple-600 hover:bg-purple-700" onClick={handleAiChat} disabled={aiThinking}>
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* ── LEADS TAB ─────────────────────────────────────────────────────────── */}
      {activeTab === "leads" && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-10 gap-2">
            {[
              { label: "Total",       value: stats.total,        color: "text-gray-600",   bg: "" },
              { label: "Not Sent",    value: stats.notSent,      color: "text-amber-600",  bg: "border-amber-200 bg-amber-50/60",
                onClick: () => { setStatusFilter("not_sent"); } },
              { label: "Contacted",   value: stats.contacted,    color: "text-blue-500",   bg: "" },
              { label: "Interested",  value: stats.interested,   color: "text-green-600",  bg: "" },
              { label: "🏛 Gemeente",  value: stats.municipality, color: "text-blue-600",   bg: "" },
              { label: "🎵 Venues",    value: stats.venue,        color: "text-orange-500", bg: "" },
              { label: "👥 Org",       value: stats.cultural_org, color: "text-purple-500", bg: "" },
              { label: "📰 Media",     value: stats.media,        color: "text-pink-500",   bg: "" },
              { label: "🏆 Sponsors",  value: stats.sponsor,      color: "text-amber-500",  bg: "" },
              { label: "Has Email",   value: stats.withEmail,    color: "text-gray-500",   bg: "" },
            ].map(s => (
              <div key={s.label}
                onClick={(s as any).onClick}
                className={`bg-white rounded-xl border border-border/60 p-2.5 text-center ${(s as any).onClick ? "cursor-pointer hover:opacity-80 transition-opacity" : ""} ${s.bg}`}>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Smart filter bar */}
          <div className="space-y-2">
            {/* Search + toggle + sort */}
            <div className="flex gap-2 flex-wrap items-center">
              <div className="relative flex-1 min-w-40">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Search leads, orgs, cities, email…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs" data-testid="input-lead-search" />
              </div>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setShowFilters(p => !p)} data-testid="btn-toggle-filters">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filters {(typeFilter !== "all" || statusFilter !== "all" || cityFilter !== "all" || extraFilter !== "all") && <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />}
              </Button>
              {/* Sort */}
              <div className="flex items-center gap-1 bg-muted/40 rounded-lg border border-border/60 px-1">
                {[
                  { key: "added", label: "Date" },
                  { key: "name", label: "Name" },
                  { key: "status", label: "Status" },
                  { key: "emails", label: "Emails" },
                ].map(s => (
                  <button key={s.key} onClick={() => {
                    if (sortBy === s.key) setSortDir(d => d === "asc" ? "desc" : "asc");
                    else { setSortBy(s.key as any); setSortDir("desc"); }
                  }} className={`flex items-center gap-0.5 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${sortBy === s.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    {s.label}
                    {sortBy === s.key && (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                  </button>
                ))}
              </div>
            </div>

            {/* Expandable filter drawer */}
            {showFilters && (
              <div className="bg-muted/30 border border-border/60 rounded-xl p-3 space-y-2.5">
                {/* Type filter */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground w-12">Type</span>
                  {[["all","🌐 All"], ["municipality","🏛 Gemeente"], ["venue","🎵 Venue"], ["cultural_org","👥 Org"], ["media","📰 Media"], ["sponsor","🏆 Sponsor"]].map(([k, l]) => (
                    <button key={k} onClick={() => setTypeFilter(k)} data-testid={`filter-type-${k}`}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                        typeFilter === k ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-foreground/40"
                      }`}>{l}</button>
                  ))}
                </div>

                {/* Status filter */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground w-12">Status</span>
                  {[
                    ["all","All"], ["new","New"], ["contacted","Contacted"], ["replied","Replied"],
                    ["interested","Interested"], ["meeting_scheduled","Meeting"], ["not_interested","Not Interested"], ["not_sent","Not Sent"],
                  ].map(([k, l]) => (
                    <button key={k} onClick={() => setStatusFilter(k)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                        statusFilter === k ? "bg-secondary text-secondary-foreground border-secondary" : "border-border text-muted-foreground hover:border-foreground/40"
                      }`}>{l}</button>
                  ))}
                </div>

                {/* City filter */}
                {cities.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground w-12">City</span>
                    <button onClick={() => setCityFilter("all")} className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${cityFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-foreground/40"}`}>All</button>
                    {cities.map(c => (
                      <button key={c} onClick={() => setCityFilter(c)} className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${cityFilter === c ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-foreground/40"}`}>{c}</button>
                    ))}
                  </div>
                )}

                {/* Smart extra filters */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground w-12">Smart</span>
                  {[
                    { key: "all", label: "All", cls: "" },
                    { key: "never_emailed", label: `📭 Never Emailed (${stats.notSent})`, cls: "border-amber-300 text-amber-700 hover:bg-amber-50" },
                    { key: "has_inbox_reply", label: `💬 Inbox Replied (${stats.inboxReplied})`, cls: "border-green-300 text-green-700 hover:bg-green-50" },
                    { key: "needs_followup", label: `🔔 Needs Follow-up (${stats.needsFollowup})`, cls: "border-red-300 text-red-700 hover:bg-red-50" },
                    { key: "has_linkedin", label: `🔗 Has LinkedIn (${stats.withLinkedin})`, cls: "border-blue-300 text-blue-700 hover:bg-blue-50" },
                    { key: "no_email", label: `⚠️ No Email (${stats.noEmail})`, cls: "border-gray-300 text-gray-600 hover:bg-gray-50" },
                  ].map(({ key, label, cls }) => (
                    <button key={key} onClick={() => setExtraFilter(key)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                        extraFilter === key ? "bg-primary text-primary-foreground border-primary" : cls || "border-border text-muted-foreground hover:border-foreground/40"
                      }`}>{label}</button>
                  ))}
                </div>

                <button onClick={() => { setTypeFilter("all"); setStatusFilter("all"); setCityFilter("all"); setExtraFilter("all"); setSearch(""); }}
                  className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2">
                  Clear all filters
                </button>
              </div>
            )}

            {/* Quick type chips always visible */}
            {!showFilters && (
              <div className="flex gap-1 flex-wrap">
                {[["all","All"], ["municipality","🏛 Gemeente"], ["venue","🎵 Venue"], ["cultural_org","👥 Org"], ["media","📰 Media"], ["sponsor","🏆 Sponsor"]].map(([k, l]) => (
                  <button key={k} onClick={() => setTypeFilter(k)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                      typeFilter === k ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-foreground/40"
                    }`}>{l}</button>
                ))}
                <div className="w-px bg-border mx-1" />
                {stats.notSent > 0 && (
                  <button onClick={() => setExtraFilter(extraFilter === "never_emailed" ? "all" : "never_emailed")}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${extraFilter === "never_emailed" ? "bg-amber-500 text-white border-amber-500" : "border-amber-300 text-amber-700 hover:bg-amber-50"}`}>
                    📭 Never Emailed ({stats.notSent})
                  </button>
                )}
                {stats.inboxReplied > 0 && (
                  <button onClick={() => setExtraFilter(extraFilter === "has_inbox_reply" ? "all" : "has_inbox_reply")}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${extraFilter === "has_inbox_reply" ? "bg-green-600 text-white border-green-600" : "border-green-300 text-green-700 hover:bg-green-50"}`}>
                    💬 Replied ({stats.inboxReplied})
                  </button>
                )}
                {stats.needsFollowup > 0 && (
                  <button onClick={() => setExtraFilter(extraFilter === "needs_followup" ? "all" : "needs_followup")}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${extraFilter === "needs_followup" ? "bg-red-500 text-white border-red-500" : "border-red-300 text-red-700 hover:bg-red-50"}`}>
                    🔔 Follow-up ({stats.needsFollowup})
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Priority attention banners */}
          {extraFilter === "all" && !search && statusFilter === "all" && typeFilter === "all" && (
            <div className="space-y-2">
              {stats.inboxReplied > 0 && (
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-green-50 border border-green-200">
                  <div className="flex items-center gap-2">
                    <Reply className="w-4 h-4 text-green-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-green-800">{stats.inboxReplied} lead{stats.inboxReplied !== 1 ? "s" : ""} replied via email inbox</p>
                      <p className="text-xs text-green-600">Check inbox — they wrote back! Update their status and follow up.</p>
                    </div>
                  </div>
                  <button onClick={() => setExtraFilter("has_inbox_reply")}
                    className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 shrink-0">
                    View Replies
                  </button>
                </div>
              )}
              {stats.needsFollowup > 0 && (
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-orange-50 border border-orange-200">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-orange-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-orange-800">{stats.needsFollowup} lead{stats.needsFollowup !== 1 ? "s" : ""} need a follow-up email</p>
                      <p className="text-xs text-orange-600">Contacted 7+ days ago with no reply yet.</p>
                    </div>
                  </div>
                  <button onClick={() => setExtraFilter("needs_followup")}
                    className="px-3 py-1.5 rounded-lg bg-orange-600 text-white text-xs font-medium hover:bg-orange-700 shrink-0">
                    View
                  </button>
                </div>
              )}
              {stats.notSent > 0 && (
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800">{stats.notSent} lead{stats.notSent !== 1 ? "s" : ""} never received an email</p>
                      <p className="text-xs text-amber-600">They have email addresses but haven't been contacted yet.</p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => setExtraFilter("never_emailed")}
                      className="px-3 py-1.5 rounded-lg border border-amber-400 text-amber-700 text-xs font-medium hover:bg-amber-100">
                      View
                    </button>
                    <button onClick={selectUnsent}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-medium hover:bg-amber-700">
                      Select All
                    </button>
                  </div>
                </div>
              )}
              {leads.filter(l => !!l.linkedinUrl && !l.email).length > 0 && (
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#0A66C2]/5 border border-[#0A66C2]/30">
                  <div className="flex items-center gap-2">
                    <SiLinkedin className="w-4 h-4 text-[#0A66C2] shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-[#0A66C2]">{leads.filter(l => !!l.linkedinUrl && !l.email).length} contact{leads.filter(l => !!l.linkedinUrl && !l.email).length !== 1 ? "s" : ""} only reachable via LinkedIn</p>
                      <p className="text-xs text-[#0A66C2]/70">No email — connect, follow, or send a personalized message on LinkedIn</p>
                    </div>
                  </div>
                  <button onClick={() => setActiveTab("linkedin")}
                    className="px-3 py-1.5 rounded-lg bg-[#0A66C2] text-white text-xs font-medium hover:bg-[#004182] shrink-0 flex items-center gap-1.5">
                    <SiLinkedin className="w-3 h-3" /> LinkedIn Outreach
                  </button>
                </div>
              )}
              {stats.noEmail > 0 && (
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="flex items-center gap-2 text-gray-600">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <p className="text-xs">{stats.noEmail} lead{stats.noEmail !== 1 ? "s" : ""} have no email address.</p>
                  </div>
                  <button onClick={() => setExtraFilter("no_email")}
                    className="px-2.5 py-1 rounded-lg border border-gray-300 text-gray-600 text-xs font-medium hover:bg-gray-100 shrink-0">
                    View
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Bulk actions bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 flex-wrap px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-200">
              <span className="text-xs font-semibold text-blue-800">{selectedIds.size} selected</span>
              <div className="flex gap-1.5 flex-wrap ml-auto">
                <Button size="sm" variant="outline" className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-100" onClick={() => setSelectedIds(new Set())}>
                  <XCircle className="w-3 h-3 mr-1" /> Clear
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-100" onClick={selectUnsent}>
                  <MailCheck className="w-3 h-3 mr-1" /> Select Unsent
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-100" onClick={toggleSelectAll}>
                  <CheckSquare className="w-3 h-3 mr-1" /> {selectedIds.size === filtered.length ? "Deselect All" : "Select All"}
                </Button>
                {/* Bulk status */}
                <div className="relative">
                  <Button size="sm" variant="outline" className="h-7 text-xs border-purple-300 text-purple-700 hover:bg-purple-100"
                    onClick={() => setShowBulkStatusMenu(p => !p)}>
                    <Tag className="w-3 h-3 mr-1" /> Set Status <ChevronDown className="w-3 h-3 ml-1" />
                  </Button>
                  {showBulkStatusMenu && (
                    <div className="absolute top-8 right-0 z-20 bg-white border border-border shadow-lg rounded-xl py-1 min-w-[160px]">
                      {Object.entries(STATUS_CFG).map(([k, v]) => {
                        const Icon = v.icon;
                        return (
                          <button key={k} onClick={() => bulkStatusMutation.mutate({ leadIds: Array.from(selectedIds), status: k })}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted text-left">
                            <Icon className="w-3.5 h-3.5" /> {v.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Open All LinkedIn Profiles */}
                {Array.from(selectedIds).some(id => {
                  const lead = leads.find(l => l.id === id);
                  return !!lead?.linkedinUrl;
                }) && (
                  <Button size="sm" className="h-7 text-xs bg-[#0A66C2] hover:bg-[#004182] text-white" onClick={() => {
                    const linkedinLeads = Array.from(selectedIds)
                      .map(id => leads.find(l => l.id === id))
                      .filter(l => l && !!l.linkedinUrl);
                    if (linkedinLeads.length === 0) return;
                    linkedinLeads.forEach((lead, i) => {
                      setTimeout(() => {
                        window.open(lead!.linkedinUrl!, "_blank", "noopener");
                      }, i * 300);
                    });
                    toast({ title: `Opening ${linkedinLeads.length} LinkedIn profile${linkedinLeads.length !== 1 ? "s" : ""}`, description: "Connect or follow each person from their profile page. Browser may ask to allow popups." });
                  }} data-testid="btn-open-all-linkedin">
                    <SiLinkedin className="w-3 h-3 mr-1" /> Open All LinkedIn ({Array.from(selectedIds).filter(id => !!leads.find(l => l.id === id)?.linkedinUrl).length})
                  </Button>
                )}
                <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={openBulkCompose}>
                  <Zap className="w-3 h-3 mr-1" /> Bulk Email ({selectedIds.size})
                </Button>
              </div>
            </div>
          )}

          {/* Result count */}
          {(search || typeFilter !== "all" || statusFilter !== "all" || cityFilter !== "all" || extraFilter !== "all") && (
            <p className="text-xs text-muted-foreground px-0.5">
              Showing <span className="font-semibold text-foreground">{filtered.length}</span> of {leads.length} leads
            </p>
          )}

          {/* Leads list */}
          {isLoading ? (
            <div className="text-center py-10">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" />
              <p className="text-xs text-muted-foreground mt-2">Loading leads…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-xl border border-border/60">
              <Building2 className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No leads found</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-border/60 overflow-hidden">
              <div className="hidden sm:grid grid-cols-[auto_1.6fr_1.2fr_auto_auto] gap-3 px-4 py-2 bg-gray-50 border-b border-border/60 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <div><input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} className="rounded" /></div>
                <div>Contact / Organisation</div>
                <div>Email &amp; Phone</div>
                <div>Status</div>
                <div>Actions</div>
              </div>
              {filtered.map(lead => (
                <div key={lead.id} className={`grid grid-cols-1 sm:grid-cols-[auto_1.6fr_1.2fr_auto_auto] gap-3 px-4 py-3.5 border-b border-border/40 last:border-b-0 hover:bg-gray-50/60 transition-colors ${selectedIds.has(lead.id) ? "bg-blue-50/40" : ""}`}>
                  <div className="hidden sm:flex items-center">
                    <input type="checkbox" checked={selectedIds.has(lead.id)} onChange={() => toggleSelect(lead.id)} className="rounded" />
                  </div>
                  <div className="flex items-start gap-2 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      lead.type === "venue" ? "bg-orange-100" : lead.type === "cultural_org" ? "bg-purple-100" : lead.type === "media" ? "bg-pink-100" : lead.type === "sponsor" ? "bg-amber-100" : "bg-blue-100"
                    }`}>
                      {(() => { const Icon = (TYPE_CFG[lead.type] || TYPE_CFG.municipality).icon; return <Icon className={`w-4 h-4 ${(TYPE_CFG[lead.type] || TYPE_CFG.municipality).color}`} />; })()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900 truncate">{lead.name || lead.organization}</p>
                        <TypeBadge type={lead.type} />
                        {/* Email sent badge */}
                        {(lead as any).emailSentCount > 0 ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                            <MailCheck className="w-2.5 h-2.5" /> {(lead as any).emailSentCount}× emailed
                          </span>
                        ) : lead.email && lead.status === "new" ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-amber-50 text-amber-600 border border-amber-200">
                            <Mail className="w-2.5 h-2.5" /> Never emailed
                          </span>
                        ) : !lead.email ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-gray-100 text-gray-500 border border-gray-200">
                            <AlertCircle className="w-2.5 h-2.5" /> No email
                          </span>
                        ) : null}
                        {/* Inbox reply badge */}
                        {(lead as any).inboxReplyCount > 0 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-green-100 text-green-700 border border-green-300">
                            <Reply className="w-2.5 h-2.5" /> {(lead as any).inboxReplyCount} inbox {(lead as any).inboxReplyCount === 1 ? "reply" : "replies"}
                          </span>
                        )}
                        {/* Needs follow-up badge */}
                        {lead.status === "contacted" && lead.lastEmailSentAt &&
                          (Date.now() - new Date(lead.lastEmailSentAt).getTime()) > 7 * 24 * 3600_000 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-orange-100 text-orange-700 border border-orange-300">
                            <AlertCircle className="w-2.5 h-2.5" /> Follow-up needed
                          </span>
                        )}
                        {/* LinkedIn badge */}
                        {lead.linkedinUrl && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#0A66C2]/10 text-[#0A66C2] border border-[#0A66C2]/30">
                            <SiLinkedin className="w-2.5 h-2.5" /> LinkedIn
                          </span>
                        )}
                      </div>
                      {lead.name && <p className="text-xs text-muted-foreground truncate">{lead.organization}</p>}
                      {lead.department && <p className="text-[11px] text-muted-foreground/70 truncate">{lead.department}</p>}
                      <div className="flex gap-1 flex-wrap mt-0.5">
                        {lead.city && <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500"><MapPin className="w-2 h-2 inline mr-0.5" />{lead.city}</span>}
                      </div>
                      <div className="sm:hidden mt-1"><StatusBadge status={lead.status} /></div>
                    </div>
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    {lead.email ? (
                      <a href={`mailto:${lead.email}`} className="flex items-center gap-1 text-xs text-blue-600 hover:underline truncate">
                        <Mail className="w-3 h-3 shrink-0" /><span className="truncate">{lead.email}</span>
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground/40 flex items-center gap-1"><Mail className="w-3 h-3" /> No email</span>
                    )}
                    {lead.phone && <a href={`tel:${lead.phone}`} className="flex items-center gap-1 text-xs text-gray-600"><Phone className="w-3 h-3 shrink-0" />{lead.phone}</a>}
                    {lead.website && (
                      <a href={lead.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                        <Globe className="w-3 h-3 shrink-0" /><span className="truncate">Website</span>
                      </a>
                    )}
                    {lead.linkedinUrl && (
                      <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-[#0A66C2] hover:text-[#004182]">
                        <SiLinkedin className="w-3 h-3 shrink-0" /><span className="truncate">LinkedIn Profile</span>
                      </a>
                    )}
                  </div>
                  <div className="hidden sm:flex items-start pt-0.5 flex-col gap-1">
                    <StatusBadge status={lead.status} />
                    {(lead as any).emailSentCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">
                        <Mail className="w-2.5 h-2.5" />{(lead as any).emailSentCount}× sent
                      </span>
                    )}
                    {(lead as any).inboxReplyCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 border border-green-300">
                        <Reply className="w-2.5 h-2.5" /> {(lead as any).inboxReplyCount} inbox reply
                      </span>
                    )}
                    {lead.lastEmailSentAt && <p className="text-[10px] text-muted-foreground">Last: {fmtDate(lead.lastEmailSentAt)}</p>}
                    {lead.lastEmailSubject && <p className="text-[10px] text-muted-foreground/60 max-w-[110px] truncate">"{lead.lastEmailSubject}"</p>}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                    {lead.email ? (
                      <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => openIndividualCompose(lead)} title="Send email" data-testid={`btn-email-lead-${lead.id}`}>
                        <Send className="w-3 h-3" />
                      </Button>
                    ) : null}
                    {lead.linkedinUrl ? (
                      <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border font-medium text-xs transition-colors ${
                          !lead.email
                            ? "bg-[#0A66C2] text-white border-[#0A66C2] hover:bg-[#004182]"
                            : "border-[#0A66C2]/40 text-[#0A66C2] hover:bg-[#0A66C2]/10"
                        }`}
                        title="Open LinkedIn profile" data-testid={`btn-linkedin-lead-${lead.id}`}>
                        <SiLinkedin className="w-3 h-3 shrink-0" />
                        {!lead.email ? "Contact on LinkedIn" : "LinkedIn"}
                      </a>
                    ) : null}
                    <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => { setFormData({ ...lead }); setEditingLead(lead); setShowAddModal(true); }} title="Edit" data-testid={`btn-edit-lead-${lead.id}`}>
                      <Edit3 className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-red-500 hover:text-red-700" onClick={() => deleteLeadMutation.mutate(lead.id)} title="Delete" data-testid={`btn-delete-lead-${lead.id}`}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                    <div className="sm:hidden"><input type="checkbox" checked={selectedIds.has(lead.id)} onChange={() => toggleSelect(lead.id)} className="rounded" /></div>
                  </div>
                  {lead.notes && (
                    <div className="col-span-full sm:col-start-2 sm:col-end-6 text-[11px] text-muted-foreground bg-gray-50 rounded-lg px-2.5 py-1.5 leading-relaxed">
                      {lead.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── LINKEDIN OUTREACH TAB ──────────────────────────────────────────────── */}
      {activeTab === "linkedin" && (() => {
        const linkedinOnlyLeads = leads.filter(l => !!l.linkedinUrl && !l.email);
        const linkedinWithEmail = leads.filter(l => !!l.linkedinUrl && !!l.email);
        const alreadyDmLeads = leads.filter(l => !!(l as any).linkedinDmSentAt);
        const pendingLeads = linkedinOnlyLeads.filter(l => !(l as any).linkedinDmSentAt);

        const generateAiMessages = async () => {
          if (pendingLeads.length === 0) return;
          setCampaignGenerating(true);
          setCampaignMode("generating");
          try {
            const r = await fetch("/api/admin/linkedin/dm-campaign/generate", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                leads: pendingLeads.map(l => ({ id: l.id, name: l.name, organization: l.organization, department: l.department, city: l.city, type: (l as any).type })),
                tone: campaignTone,
                goal: campaignGoal,
              }),
            });
            const data = await r.json();
            if (data.error) throw new Error(data.error);
            setCampaignMessages(data.messages || []);
            setCampaignMode("review");
          } catch (err: any) {
            toast({ title: "AI error", description: err.message, variant: "destructive" });
            setCampaignMode("setup");
          } finally {
            setCampaignGenerating(false);
          }
        };

        const startCampaign = () => {
          setCampaignCurrentIdx(0);
          setCampaignDoneIds(new Set());
          setCampaignSkippedIds(new Set());
          setCampaignMode("running");
        };

        const markDoneAndNext = async (lead: any, msg: string) => {
          setCampaignMarkingId(lead.id);
          try {
            await fetch("/api/admin/linkedin/dm-campaign/mark-sent", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ leadId: lead.id, message: msg }),
            });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/outreach/leads"] });
            setCampaignDoneIds(prev => new Set([...prev, lead.id]));
          } catch (_) {}
          setCampaignMarkingId(null);
          const nextIdx = campaignCurrentIdx + 1;
          if (nextIdx >= campaignMessages.length) { setCampaignMode("done"); }
          else { setCampaignCurrentIdx(nextIdx); setCampaignCopied(false); }
        };

        const skipAndNext = () => {
          setCampaignSkippedIds(prev => new Set([...prev, campaignMessages[campaignCurrentIdx]?.id]));
          const nextIdx = campaignCurrentIdx + 1;
          if (nextIdx >= campaignMessages.length) { setCampaignMode("done"); }
          else { setCampaignCurrentIdx(nextIdx); setCampaignCopied(false); }
        };

        const copyMsgAndOpen = async (lead: any, msg: string) => {
          try { await navigator.clipboard.writeText(msg); } catch (_) {}
          setCampaignCopied(true);
          window.open(lead.linkedinUrl, "_blank", "noopener");
        };

        const currentMsg = campaignMode === "running" ? campaignMessages[campaignCurrentIdx] : null;
        const currentLead = currentMsg ? pendingLeads.find(l => l.id === currentMsg.id) : null;

        return (
          <div className="space-y-5">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#0A66C2]/5 border border-[#0A66C2]/20 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-[#0A66C2]">{linkedinOnlyLeads.length}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">LinkedIn Only</p>
                <p className="text-[9px] text-muted-foreground/60">No email address</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{alreadyDmLeads.length}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">DM Sent</p>
                <p className="text-[9px] text-muted-foreground/60">Already messaged</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-amber-700">{pendingLeads.length}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Not Yet Contacted</p>
                <p className="text-[9px] text-muted-foreground/60">Ready for campaign</p>
              </div>
              <div className="bg-white border border-border/60 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-gray-700">{linkedinWithEmail.length}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">LinkedIn + Email</p>
                <p className="text-[9px] text-muted-foreground/60">Both available</p>
              </div>
            </div>

            {linkedinOnlyLeads.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-xl border border-border/60">
                <SiLinkedin className="w-10 h-10 text-[#0A66C2]/20 mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No LinkedIn-only contacts yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Add LinkedIn URLs to leads without email addresses — they'll appear here.</p>
              </div>
            ) : (
              <>
                {/* ── AI Campaign Mode ────────────────────────────────────────── */}
                {campaignMode === "idle" && (
                  <div className="bg-gradient-to-br from-[#0A66C2]/5 to-purple-50 border border-[#0A66C2]/20 rounded-xl p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#0A66C2] flex items-center justify-center shrink-0">
                        <Sparkles className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold">AI Campaign Mode</h3>
                        <p className="text-xs text-muted-foreground">AI writes personalized messages for all {pendingLeads.length} contacts — then guides you through each one, one by one.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      {[
                        { step: "1", icon: <Sparkles className="w-3.5 h-3.5" />, label: "AI writes messages", desc: `GPT-4o writes personalized DMs for all ${pendingLeads.length} contacts at once` },
                        { step: "2", icon: <CheckSquare className="w-3.5 h-3.5" />, label: "You review & edit", desc: "Check each message, edit if needed, then start the guided campaign" },
                        { step: "3", icon: <SiLinkedin className="w-3 h-3" />, label: "One by one campaign", desc: "Copy message → LinkedIn opens → you paste & send → next contact automatically" },
                      ].map(s => (
                        <div key={s.step} className="flex gap-2.5 bg-white/60 rounded-lg p-2.5 border border-white">
                          <div className="w-6 h-6 rounded-full bg-[#0A66C2] text-white text-[10px] font-bold flex items-center justify-center shrink-0">{s.step}</div>
                          <div>
                            <div className="flex items-center gap-1 font-medium text-gray-800">{s.icon} {s.label}</div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{s.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        data-testid="btn-start-ai-campaign"
                        className="bg-[#0A66C2] hover:bg-[#004182] text-white"
                        onClick={() => setCampaignMode("setup")}
                        disabled={pendingLeads.length === 0}
                      >
                        <Sparkles className="w-4 h-4 mr-1.5" /> Start AI Campaign ({pendingLeads.length} contacts)
                      </Button>
                      {pendingLeads.length === 0 && <p className="text-xs text-muted-foreground self-center">All contacts have already been messaged.</p>}
                    </div>
                  </div>
                )}

                {/* ── Setup ────────────────────────────────────────────────── */}
                {campaignMode === "setup" && (
                  <div className="bg-white border border-[#0A66C2]/30 rounded-xl p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#0A66C2]" />
                      <h3 className="text-sm font-semibold">Configure AI Campaign</h3>
                      <button onClick={() => setCampaignMode("idle")} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Tone</label>
                        <div className="flex flex-wrap gap-1.5">
                          {["vriendelijk en direct", "professioneel", "enthousiast", "informeel", "zakelijk"].map(t => (
                            <button key={t} onClick={() => setCampaignTone(t)}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${campaignTone === t ? "bg-[#0A66C2] text-white border-[#0A66C2]" : "border-border text-muted-foreground hover:border-[#0A66C2]/40"}`}>
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Goal of the message</label>
                        <div className="flex flex-wrap gap-1.5 mb-1">
                          {["kennismaken en samenwerking bespreken", "uitnodiging sturen voor demo", "partnerschap voorstellen", "sponsorship pitch", "gemeente partnership"].map(g => (
                            <button key={g} onClick={() => setCampaignGoal(g)}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${campaignGoal === g ? "bg-purple-600 text-white border-purple-600" : "border-border text-muted-foreground hover:border-purple-400"}`}>
                              {g}
                            </button>
                          ))}
                        </div>
                        <Input value={campaignGoal} onChange={e => setCampaignGoal(e.target.value)} placeholder="Or type a custom goal…" className="h-8 text-xs" data-testid="input-campaign-goal" />
                      </div>
                    </div>
                    <Button
                      data-testid="btn-generate-ai-messages"
                      className="w-full bg-[#0A66C2] hover:bg-[#004182] text-white"
                      onClick={generateAiMessages}
                      disabled={campaignGenerating}
                    >
                      <Sparkles className="w-4 h-4 mr-1.5" /> Generate AI Messages for All {pendingLeads.length} Contacts
                    </Button>
                  </div>
                )}

                {/* ── Generating ───────────────────────────────────────────── */}
                {campaignMode === "generating" && (
                  <div className="bg-white border border-[#0A66C2]/20 rounded-xl p-8 text-center space-y-3">
                    <RefreshCw className="w-8 h-8 text-[#0A66C2] animate-spin mx-auto" />
                    <p className="text-sm font-semibold">AI is writing {pendingLeads.length} personalized messages…</p>
                    <p className="text-xs text-muted-foreground">GPT-4o is crafting individual messages for each contact based on their name, organization, and type.</p>
                  </div>
                )}

                {/* ── Review ───────────────────────────────────────────────── */}
                {campaignMode === "review" && (
                  <div className="space-y-4">
                    <div className="bg-white border border-[#0A66C2]/20 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <h3 className="text-sm font-semibold">Review AI Messages — {campaignMessages.length} generated</h3>
                        <button onClick={() => setCampaignMode("setup")} className="ml-auto text-xs text-muted-foreground hover:text-foreground">← Re-configure</button>
                      </div>
                      <p className="text-xs text-muted-foreground">Edit any message below, then click "Start Campaign" to go through them one by one.</p>
                      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                        {campaignMessages.map((msg, i) => {
                          const lead = pendingLeads.find(l => l.id === msg.id);
                          if (!lead) return null;
                          return (
                            <div key={msg.id} className="bg-gray-50 rounded-lg border border-border/50 p-3 space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-muted-foreground w-5 shrink-0">{i + 1}</span>
                                <p className="text-xs font-semibold">{lead.name || lead.organization}</p>
                                {lead.organization && lead.name && <p className="text-[10px] text-muted-foreground">@ {lead.organization}</p>}
                                <TypeBadge type={(lead as any).type} />
                                {msg.edited && <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium ml-auto">Edited</span>}
                              </div>
                              <Textarea
                                value={msg.message}
                                onChange={e => setCampaignMessages(prev => prev.map(m => m.id === msg.id ? { ...m, message: e.target.value, edited: true } : m))}
                                rows={3}
                                className="text-xs resize-none bg-white"
                                data-testid={`textarea-campaign-msg-${msg.id}`}
                              />
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button
                          data-testid="btn-start-campaign-runner"
                          className="bg-[#0A66C2] hover:bg-[#004182] text-white flex-1"
                          onClick={startCampaign}
                        >
                          <SiLinkedin className="w-3.5 h-3.5 mr-1.5" /> Start Campaign — {campaignMessages.length} contacts
                        </Button>
                        <Button variant="outline" onClick={generateAiMessages} disabled={campaignGenerating}>
                          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Regenerate
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Campaign Runner ──────────────────────────────────────── */}
                {campaignMode === "running" && currentMsg && currentLead && (
                  <div className="space-y-3">
                    {/* Progress bar */}
                    <div className="bg-white border border-[#0A66C2]/20 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#0A66C2]">Campaign in progress</span>
                        <span className="text-muted-foreground">{campaignCurrentIdx + 1} / {campaignMessages.length}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#0A66C2] transition-all duration-500 rounded-full" style={{ width: `${((campaignCurrentIdx) / campaignMessages.length) * 100}%` }} />
                      </div>
                      <div className="flex gap-3 text-[10px] text-muted-foreground">
                        <span className="text-green-600 font-medium">✓ {campaignDoneIds.size} done</span>
                        <span className="text-gray-400">→ {campaignSkippedIds.size} skipped</span>
                        <span className="text-amber-600">{campaignMessages.length - campaignCurrentIdx} remaining</span>
                      </div>
                    </div>

                    {/* Current contact card */}
                    <div className="bg-gradient-to-br from-[#0A66C2]/5 to-white border-2 border-[#0A66C2]/40 rounded-xl p-5 space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-xl bg-[#0A66C2] flex items-center justify-center shrink-0">
                          <SiLinkedin className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-base">{currentLead.name || currentLead.organization}</p>
                          {currentLead.name && currentLead.organization && <p className="text-xs text-muted-foreground">{currentLead.organization}</p>}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <TypeBadge type={(currentLead as any).type} />
                            {currentLead.city && <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-500"><MapPin className="w-2.5 h-2.5 inline mr-0.5" />{currentLead.city}</span>}
                          </div>
                        </div>
                        <span className="text-2xl font-black text-[#0A66C2]/20">{campaignCurrentIdx + 1}</span>
                      </div>

                      {/* Editable message */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-600 flex items-center gap-1"><MessageCircle className="w-3 h-3" /> Your message to {currentLead.name?.split(" ")[0] || currentLead.organization}:</label>
                        <Textarea
                          value={currentMsg.message}
                          onChange={e => setCampaignMessages(prev => prev.map(m => m.id === currentMsg.id ? { ...m, message: e.target.value } : m))}
                          rows={5}
                          className="text-sm resize-none bg-white border-[#0A66C2]/30 focus:border-[#0A66C2]"
                          data-testid="textarea-campaign-current-msg"
                        />
                        <p className="text-[10px] text-muted-foreground">{currentMsg.message.length} characters · LinkedIn DM limit is ~300 characters</p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          data-testid="btn-copy-and-open-linkedin"
                          className={`flex-1 transition-colors ${campaignCopied ? "bg-green-600 hover:bg-green-700" : "bg-[#0A66C2] hover:bg-[#004182]"} text-white`}
                          onClick={() => copyMsgAndOpen(currentLead, currentMsg.message)}
                        >
                          {campaignCopied
                            ? <><CheckCircle className="w-4 h-4 mr-1.5" /> Copied! LinkedIn Opening…</>
                            : <><Copy className="w-4 h-4 mr-1.5" /> Copy Message + Open LinkedIn</>
                          }
                        </Button>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          data-testid="btn-campaign-done-next"
                          variant="outline"
                          className="flex-1 border-green-400 text-green-700 hover:bg-green-50 font-semibold"
                          onClick={() => markDoneAndNext(currentLead, currentMsg.message)}
                          disabled={!!campaignMarkingId}
                        >
                          {campaignMarkingId === currentLead.id
                            ? <><RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> Saving…</>
                            : <><CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Sent — Next Contact →</>
                          }
                        </Button>
                        <Button variant="outline" className="text-gray-500 border-gray-300 hover:bg-gray-50" onClick={skipAndNext} data-testid="btn-campaign-skip">
                          Skip →
                        </Button>
                        <Button variant="outline" className="text-red-500 border-red-200" onClick={() => setCampaignMode("review")} data-testid="btn-campaign-pause">
                          Pause
                        </Button>
                      </div>

                      {campaignCopied && (
                        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-800 font-medium flex items-center gap-2">
                          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                          Message copied! On LinkedIn: click <strong>"Message"</strong> on {currentLead.name || currentLead.organization}'s profile → paste → send → come back and click "Sent — Next Contact"
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Done ─────────────────────────────────────────────────── */}
                {campaignMode === "done" && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center space-y-3">
                    <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                      <CheckCircle className="w-7 h-7 text-green-600" />
                    </div>
                    <h3 className="font-bold text-green-800 text-base">Campaign Complete!</h3>
                    <p className="text-sm text-green-700">
                      {campaignDoneIds.size} messages sent · {campaignSkippedIds.size} skipped
                    </p>
                    <Button className="bg-[#0A66C2] hover:bg-[#004182] text-white" onClick={() => { setCampaignMode("idle"); setCampaignMessages([]); }}>
                      Start New Campaign
                    </Button>
                  </div>
                )}

                {/* ── Already messaged ─────────────────────────────────────── */}
                {alreadyDmLeads.length > 0 && campaignMode !== "running" && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-green-600" /> Already Messaged ({alreadyDmLeads.length})
                    </h3>
                    <div className="bg-white rounded-xl border border-border/60 divide-y divide-border/40 overflow-hidden">
                      {alreadyDmLeads.map(lead => (
                        <div key={lead.id} className="flex items-center gap-3 px-4 py-2.5">
                          <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                            <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-xs font-medium">{lead.name || lead.organization}</p>
                              {lead.organization && lead.name && <p className="text-[10px] text-muted-foreground">@ {lead.organization}</p>}
                              {(lead as any).linkedinDmSentAt && <span className="text-[9px] text-muted-foreground ml-1">DM sent {new Date((lead as any).linkedinDmSentAt).toLocaleDateString("nl-NL")}</span>}
                            </div>
                          </div>
                          <a href={lead.linkedinUrl!} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 h-6 px-2 rounded-md border border-[#0A66C2]/30 text-[#0A66C2] text-[10px] font-medium hover:bg-[#0A66C2]/5">
                            <SiLinkedin className="w-2.5 h-2.5" /> LinkedIn
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* LinkedIn + Email contacts */}
                {linkedinWithEmail.length > 0 && campaignMode !== "running" && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground">Also has Email — {linkedinWithEmail.length} contacts</h3>
                    <div className="bg-white rounded-xl border border-border/60 divide-y divide-border/40 overflow-hidden">
                      {linkedinWithEmail.map(lead => (
                        <div key={lead.id} className="flex items-center gap-3 px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium">{lead.name || lead.organization}</p>
                              <TypeBadge type={(lead as any).type} />
                            </div>
                            <a href={`mailto:${lead.email}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5"><Mail className="w-3 h-3" />{lead.email}</a>
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            <a href={lead.linkedinUrl!} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-[#0A66C2]/40 text-[#0A66C2] text-xs font-medium hover:bg-[#0A66C2]/5">
                              <SiLinkedin className="w-3 h-3" /> LinkedIn
                            </a>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openIndividualCompose(lead as any)}>
                              <Send className="w-3 h-3 mr-1" /> Email
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* ── EMAIL HISTORY TAB ──────────────────────────────────────────────────── */}
      {activeTab === "history" && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Emails Sent"   value={emailStats.sent}    icon={Send}       color="text-blue-600" sub="All time" />
            <StatCard label="Opened"        value={emailStats.opened}  icon={Eye}        color="text-emerald-600" sub={`${emailStats.openRate}% open rate`} />
            <StatCard label="Total Opens"   value={emailStats.totalOpens} icon={Activity} color="text-purple-600" sub="Incl. re-opens" />
            <StatCard label="Bulk / Direct" value={`${emailStats.bulk} / ${emailStats.individual}`} icon={Zap} color="text-orange-500" sub="Bulk vs individual" />
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Search by recipient, subject, organisation…" value={historySearch} onChange={e => setHistorySearch(e.target.value)} className="pl-8 h-8 text-xs" />
          </div>

          {historyLoading ? (
            <div className="text-center py-10">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" />
              <p className="text-xs text-muted-foreground mt-2">Loading history…</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-border/60">
              <History className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No emails sent yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Emails you send will appear here with open tracking.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-border/60 overflow-hidden">
              {/* Table header */}
              <div className="hidden sm:grid grid-cols-[2fr_1.5fr_1fr_auto_auto] gap-3 px-4 py-2 bg-gray-50 border-b border-border/60 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <div>Recipient &amp; Subject</div>
                <div>Organisation</div>
                <div>Sent</div>
                <div>Opens</div>
                <div></div>
              </div>
              {filteredHistory.map((email: any) => (
                <div key={email.id}>
                  <div className="grid grid-cols-1 sm:grid-cols-[2fr_1.5fr_1fr_auto_auto] gap-3 px-4 py-3 border-b border-border/40 last:border-b-0 hover:bg-gray-50/60 transition-colors">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <a href={`mailto:${email.recipientEmail}`} className="text-xs text-blue-600 hover:underline truncate">
                          {email.recipientEmail}
                        </a>
                        {email.isBulk && (
                          <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">BULK</span>
                        )}
                        {email.leadType && <TypeBadge type={email.leadType} />}
                        {email.leadStatus === "replied" && (
                          <span className="inline-flex items-center gap-1 text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-bold">
                            <MessageCircle className="w-2.5 h-2.5" /> REPLIED
                          </span>
                        )}
                        {email.leadStatus === "interested" && (
                          <span className="inline-flex items-center gap-1 text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">
                            <CheckCircle className="w-2.5 h-2.5" /> INTERESTED
                          </span>
                        )}
                        {email.leadStatus === "meeting_scheduled" && (
                          <span className="inline-flex items-center gap-1 text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-bold">
                            <Calendar className="w-2.5 h-2.5" /> MEETING
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-700 font-medium truncate mt-0.5">"{email.subject}"</p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <p className="font-medium text-gray-700 truncate">{email.organization || email.recipientName || "–"}</p>
                      {email.city && <p className="text-[10px]">{email.city}</p>}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      <p>{fmtDate(email.sentAt)}</p>
                      <p className="text-[10px]">{new Date(email.sentAt).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                    <div>
                      <OpenBadge count={email.openCount} />
                      {email.firstOpenedAt && (
                        <p className="text-[9px] text-muted-foreground mt-0.5">
                          First: {fmtTime(email.firstOpenedAt)}
                        </p>
                      )}
                      {email.openCount > 1 && email.lastOpenedAt && (
                        <p className="text-[9px] text-muted-foreground">
                          Last: {fmtTime(email.lastOpenedAt)}
                        </p>
                      )}
                    </div>
                    <div>
                      {(email.openCount ?? 0) > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs px-2 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"
                          onClick={() => setSelectedEmailId(selectedEmailId === email.id ? null : email.id)}
                          title="Who opened this email?"
                          data-testid={`btn-opens-${email.id}`}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Details
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Open events detail row */}
                  {selectedEmailId === email.id && (
                    <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-3">
                      <p className="text-[11px] font-semibold text-emerald-800 mb-2 flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" /> Open events for this email
                      </p>
                      {emailOpens.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground">No open events recorded yet.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {emailOpens.map((open, i) => (
                            <div key={open.id} className="flex items-start gap-3 text-[11px]">
                              <span className="text-emerald-600 font-bold w-4">#{i + 1}</span>
                              <div>
                                <span className="font-medium text-gray-800">{fmtTime(open.openedAt)}</span>
                                {open.ipAddress && <span className="text-muted-foreground ml-2">IP: {open.ipAddress}</span>}
                                {open.userAgent && (
                                  <p className="text-[10px] text-muted-foreground/70 truncate max-w-[400px]">{open.userAgent}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ANALYTICS TAB ─────────────────────────────────────────────────────── */}
      {activeTab === "analytics" && (
        <div className="space-y-5">
          {analyticsLoading ? (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
              <p className="text-xs text-muted-foreground mt-2">Loading analytics…</p>
            </div>
          ) : (
            <>
              {/* Email performance */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><Mail className="w-4 h-4 text-blue-500" /> Email Performance</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard label="Total Sent"     value={analytics?.emails?.total_sent ?? emailStats.sent}     icon={Send}      color="text-blue-600" />
                  <StatCard label="Opened"         value={analytics?.emails?.total_opened ?? emailStats.opened} icon={Eye}       color="text-emerald-600"
                    sub={`${openRatePct(analytics?.emails?.total_sent ?? emailStats.sent, analytics?.emails?.total_opened ?? emailStats.opened)}% open rate`} />
                  <StatCard label="Total Opens"    value={analytics?.emails?.total_opens ?? emailStats.totalOpens} icon={Activity} color="text-purple-600" sub="Incl. re-opens" />
                  <StatCard label="Last 7 Days"    value={analytics?.emails?.sent_last_7d ?? "–"}               icon={Calendar}  color="text-orange-500" sub="Emails sent" />
                </div>
              </div>

              {/* Open rate bar */}
              {(analytics?.emails?.total_sent ?? emailStats.sent) > 0 && (
                <div className="bg-white rounded-xl border border-border/60 p-4">
                  <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Open Rate</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-4 bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all"
                        style={{ width: `${openRatePct(analytics?.emails?.total_sent ?? emailStats.sent, analytics?.emails?.total_opened ?? emailStats.opened)}%` }}
                      />
                    </div>
                    <span className="text-lg font-bold text-emerald-600 w-14 text-right">
                      {openRatePct(analytics?.emails?.total_sent ?? emailStats.sent, analytics?.emails?.total_opened ?? emailStats.opened)}%
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    {analytics?.emails?.total_opened ?? emailStats.opened} out of {analytics?.emails?.total_sent ?? emailStats.sent} recipients opened the email.
                    Industry average is ~20% for cold outreach.
                  </p>
                </div>
              )}

              {/* Lead pipeline */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><Target className="w-4 h-4 text-purple-500" /> Lead Pipeline</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <StatCard label="Total Leads"    value={analytics?.leads?.total_leads ?? stats.total}        icon={Users}         color="text-gray-600" />
                  <StatCard label="New"            value={analytics?.leads?.new_leads ?? stats.new}            icon={Clock}         color="text-gray-400" />
                  <StatCard label="Contacted"      value={analytics?.leads?.contacted_leads ?? stats.contacted} icon={Mail}          color="text-blue-500" />
                  <StatCard label="Replied"        value={analytics?.leads?.replied_leads ?? leads.filter((l: any) => l.status === "replied").length} icon={MessageCircle} color="text-indigo-600" sub="Wrote back" />
                  <StatCard label="Interested"     value={analytics?.leads?.interested_leads ?? stats.interested} icon={CheckCircle} color="text-green-600" />
                  <StatCard label="Meetings"       value={analytics?.leads?.meetings ?? stats.meetings}        icon={Calendar}      color="text-purple-600" />
                </div>
              </div>

              {/* Conversion funnel */}
              <div className="bg-white rounded-xl border border-border/60 p-4">
                <p className="text-xs font-semibold mb-4 text-muted-foreground uppercase tracking-wide">Conversion Funnel</p>
                {(() => {
                  const total = analytics?.leads?.total_leads ?? stats.total;
                  const stages = [
                    { label: "Total Leads",   value: total, color: "bg-gray-300" },
                    { label: "Contacted",     value: analytics?.leads?.contacted_leads ?? stats.contacted, color: "bg-blue-400" },
                    { label: "Replied",       value: analytics?.leads?.replied_leads ?? leads.filter((l: any) => l.status === "replied").length, color: "bg-indigo-500" },
                    { label: "Interested",    value: analytics?.leads?.interested_leads ?? stats.interested, color: "bg-green-400" },
                    { label: "Meeting",       value: analytics?.leads?.meetings ?? stats.meetings, color: "bg-purple-500" },
                  ];
                  return (
                    <div className="space-y-2.5">
                      {stages.map(s => (
                        <div key={s.label} className="flex items-center gap-3">
                          <span className="text-[11px] text-muted-foreground w-20 shrink-0">{s.label}</span>
                          <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                            <div
                              className={`h-5 ${s.color} rounded transition-all flex items-center justify-end pr-2`}
                              style={{ width: total > 0 ? `${Math.max(4, (s.value / total) * 100)}%` : "4%" }}
                            >
                              <span className="text-[10px] text-white font-bold">{s.value}</span>
                            </div>
                          </div>
                          <span className="text-[11px] font-medium w-10 text-right">
                            {total > 0 ? Math.round((s.value / total) * 100) : 0}%
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Lead breakdown by type */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><BarChart2 className="w-4 h-4 text-orange-500" /> Leads by Type</h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { key: "municipality", label: "Municipality", color: "text-blue-600", icon: Landmark, val: analytics?.leads?.municipality ?? stats.municipality },
                    { key: "venue",        label: "Venue",        color: "text-orange-500", icon: Music,    val: analytics?.leads?.venue ?? stats.venue },
                    { key: "cultural_org", label: "Cultural Org", color: "text-purple-600", icon: Users,   val: analytics?.leads?.cultural_org ?? stats.cultural_org },
                    { key: "media",        label: "Media",        color: "text-pink-500", icon: Newspaper,  val: analytics?.leads?.media ?? stats.media },
                    { key: "sponsor",      label: "Sponsor",      color: "text-amber-500", icon: Trophy,    val: analytics?.leads?.sponsor ?? stats.sponsor },
                  ].map(t => (
                    <StatCard key={t.key} label={t.label} value={t.val} icon={t.icon} color={t.color} />
                  ))}
                </div>
              </div>

              {/* Daily sends chart (last 30 days) */}
              {analytics?.daily?.length > 0 && (
                <div className="bg-white rounded-xl border border-border/60 p-4">
                  <p className="text-xs font-semibold mb-4 text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" /> Daily Email Activity (Last 30 Days)
                  </p>
                  <div className="flex items-end gap-1 h-24">
                    {analytics.daily.map((d: any) => {
                      const maxVal = Math.max(...analytics.daily.map((x: any) => x.sent), 1);
                      const h = Math.max(4, Math.round((d.sent / maxVal) * 80));
                      const hOpen = Math.max(0, Math.round(((d.opened ?? 0) / maxVal) * 80));
                      return (
                        <div key={d.day} className="flex flex-col items-center gap-0.5 flex-1" title={`${d.day}: ${d.sent} sent, ${d.opened ?? 0} opened`}>
                          <div className="relative w-full flex flex-col justify-end" style={{ height: 80 }}>
                            <div className="w-full bg-blue-200 rounded-sm" style={{ height: h }} />
                            {hOpen > 0 && (
                              <div className="absolute bottom-0 w-full bg-emerald-400 rounded-sm" style={{ height: hOpen }} />
                            )}
                          </div>
                          <span className="text-[8px] text-muted-foreground" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
                            {new Date(d.day).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-4 mt-2">
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-3 h-2 bg-blue-200 rounded inline-block" /> Sent</span>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-3 h-2 bg-emerald-400 rounded inline-block" /> Opened</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Add/Edit Lead Modal ─────────────────────────────────────────────── */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg mx-auto rounded-xl">
          <DialogHeader>
            <DialogTitle>{editingLead ? "Edit Lead" : "Add New Lead"}</DialogTitle>
            <DialogDescription className="sr-only">Add or edit outreach lead</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 block mb-1">Type</label>
              <select value={(formData as any).type || "municipality"} onChange={e => setFormData(p => ({ ...p, type: e.target.value }))}
                className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-sm">
                <option value="municipality">🏛 Municipality (Gemeente)</option>
                <option value="venue">🎵 Venue (Locatie)</option>
                <option value="cultural_org">👥 Cultural Organisation</option>
                <option value="media">📰 Media / Press</option>
                <option value="sponsor">🏆 Sponsor / Brand</option>
              </select>
            </div>
            {[
              { key: "name", label: "Contact Name", placeholder: "Toine van Mourik" },
              { key: "organization", label: "Organisation *", placeholder: "Gemeente Amsterdam" },
              { key: "department", label: "Department", placeholder: "Afdeling Cultuur" },
              { key: "city", label: "City", placeholder: "Amsterdam" },
              { key: "email", label: "Email", placeholder: "info@example.nl", type: "email" },
              { key: "phone", label: "Phone", placeholder: "020-1234567" },
              { key: "website", label: "Website", placeholder: "https://website.nl" },
              { key: "linkedinUrl", label: "LinkedIn URL", placeholder: "https://linkedin.com/in/..." },
            ].map(f => (
              <div key={f.key} className={(f.key === "website" || f.key === "linkedinUrl") ? "col-span-2" : ""}>
                <label className="text-xs font-medium text-gray-600 block mb-1">{f.label}</label>
                <Input type={f.type || "text"} placeholder={f.placeholder} value={(formData as any)[f.key] || ""}
                  onChange={e => setFormData(p => ({ ...p, [f.key]: e.target.value }))} className="h-8 text-sm" />
              </div>
            ))}
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 block mb-1">Status</label>
              <select value={formData.status || "new"} onChange={e => setFormData(p => ({ ...p, status: e.target.value }))}
                className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-sm">
                {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 block mb-1">Notes</label>
              <Textarea placeholder="Extra info, tips, context…" value={formData.notes || ""}
                onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} rows={2} className="text-sm resize-none" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={() => {
              if (!formData.organization) { toast({ title: "Organisation is required", variant: "destructive" }); return; }
              if (editingLead) {
                updateLeadMutation.mutate({ id: editingLead.id, data: formData });
              } else {
                addLeadMutation.mutate(formData);
              }
            }} disabled={addLeadMutation.isPending || updateLeadMutation.isPending}>
              {editingLead ? "Save Changes" : "Add Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Compose Email Modal ─────────────────────────────────────────────── */}
      <Dialog open={showComposeModal} onOpenChange={setShowComposeModal}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl mx-auto rounded-xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-500" />
              {composeLead ? `Email to ${composeLead.name || composeLead.organization}` : `Bulk Email — ${selectedIds.size} recipients`}
            </DialogTitle>
            <DialogDescription className="sr-only">Compose outreach email</DialogDescription>
          </DialogHeader>

          {composeLead ? (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-700">
              <Mail className="w-3.5 h-3.5 shrink-0" />
              <span>To: <strong>{composeLead.email}</strong> · {composeLead.organization} · {composeLead.city}</span>
              {composeLead.type && <TypeBadge type={composeLead.type} />}
            </div>
          ) : (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-indigo-50 border border-indigo-100 text-xs text-indigo-700">
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>Sending to <strong>{selectedIds.size} leads</strong> — only leads with email address will receive it.</span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Subject</label>
              <Input placeholder="Samenwerking Urban Culture Connect" value={composeSubject} onChange={e => setComposeSubject(e.target.value)} className="text-sm" />
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span className="text-xs font-semibold text-purple-700">
                  AI Draft Generator
                  {composeLead?.type && <span className="ml-1.5 font-normal opacity-70">({TYPE_CFG[composeLead.type]?.label || composeLead.type})</span>}
                </span>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {quickPrompts.map(qp => (
                  <button key={qp.label} type="button" onClick={() => handleQuickPrompt(qp.prompt)} disabled={aiGenerating}
                    className="text-[10px] px-2 py-1 bg-white border border-purple-200 rounded-full hover:bg-purple-50 text-purple-700 disabled:opacity-50">
                    {qp.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder='Of schrijf je eigen instructie: "email in het Engels over partnership"'
                  value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAiGenerate()}
                  className="text-xs h-8 flex-1"
                />
                <Button size="sm" className="h-8 bg-purple-600 hover:bg-purple-700 shrink-0" onClick={handleAiGenerate} disabled={aiGenerating}>
                  {aiGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Email Body</label>
              <Textarea
                placeholder="Schrijf je bericht hier, of gebruik AI hierboven om een concept te genereren…"
                value={composeBody} onChange={e => setComposeBody(e.target.value)}
                rows={12} className="text-sm resize-none"
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-gray-50 border border-border/50 rounded-lg px-3 py-2">
              <MailCheck className="w-3.5 h-3.5 text-green-500 shrink-0" />
              <span>Verstuurd via Mailgun · Bevat UCH branding + iOS App link + <Eye className="w-3 h-3 inline" /> open tracking pixel</span>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowComposeModal(false)}>Cancel</Button>
            <Button onClick={handleSend} disabled={sendEmailMutation.isPending || sendBulkMutation.isPending || !composeSubject || !composeBody} className="bg-blue-600 hover:bg-blue-700">
              {(sendEmailMutation.isPending || sendBulkMutation.isPending) ? (
                <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Sending…</>
              ) : (
                <><Send className="w-3.5 h-3.5 mr-1.5" /> {composeLead ? "Send Email" : `Send to ${selectedIds.size} Leads`}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
