import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import UserManagement from "./UserManagement";
import EventManagement from "./EventManagement";
import ContentModeration from "./ContentModeration";
import DashboardStats from "./DashboardStats";
import ActivityLog from "./ActivityLog";
import AdminNotifications from "./AdminNotifications";
import TicketScanner from "./TicketScanner";
import TicketManagement from "./TicketManagement";
import ApiMonitoring from "./ApiMonitoring";
import BookingManagement from "./BookingManagement";
import { BusinessVerificationManager } from "./BusinessVerificationManager";
import { KvkApiTest } from "./KvkApiTest";
import { EmailTesting } from "./EmailTesting";
import { AdminAiAssistant } from "./AdminAiAssistant";
import AdminSpotlightPanel from "./AdminSpotlightPanel";
import AdminDealFinder from "./AdminDealFinder";
import LocationManagement from "./LocationManagement";
import AdminAnalyticsPanel from "./AdminAnalyticsPanel";
import AdminSafetyMonitor from "./AdminSafetyMonitor";
import AdminOutreach from "./AdminOutreach";
import AdminEmailInbox from "./AdminEmailInbox";
import AdminLinkedIn from "./AdminLinkedIn";
import AdminMarketing from "./AdminMarketing";
import AdminFunding from "./AdminFunding";
import AdminEventSources from "./AdminEventSources";
import EventAiAssistant from "./EventAiAssistant";
import AdminEventValidator from "./AdminEventValidator";
import AdminPushNotifications from "./AdminPushNotifications";
import PerformanceMonitor from "./PerformanceMonitor";
import AppHealthCheck from "./AppHealthCheck";
import AIFinderAdminPanel from "./AIFinderAdminPanel";
import AdminGroupsPanel from "./AdminGroupsPanel";
import SecurityCenter from "./SecurityCenter";
import {
  LayoutDashboard, Users, Calendar, MapPin, Bookmark, Shield,
  Bell, Activity, QrCode, Ticket, Server, Building2, FileKey,
  Mail, Bot, Monitor, Star, ShoppingCart, BarChart3, ChevronRight,
  CheckCircle, Zap, ShieldAlert, SendHorizonal, Megaphone, TrendingUp,
  Gauge, Radio, ShieldCheck, Inbox, Wand2, Volume2, Sparkles,
} from "lucide-react";
import { FaLinkedin } from "react-icons/fa";

type SectionId =
  | "dashboard" | "analytics"
  | "users" | "events" | "event_ai" | "spots" | "bookings" | "content" | "groups"
  | "notifications" | "push_notifications" | "activity" | "scanner" | "tickets"
  | "ai_assistant" | "spotlight" | "deal_finder" | "ai_finder" | "live"
  | "api_monitoring" | "business" | "kvk" | "email"
  | "safety" | "outreach" | "inbox" | "linkedin" | "marketing" | "funding" | "event_sources" | "event_validator" | "performance"
  | "app_health" | "security_center";

interface NavItem { id: SectionId; label: string; icon: any; badge?: number; highlight?: string; }
interface NavGroup { title: string; emoji: string; items: NavItem[]; }

const pageTitle: Record<SectionId, string> = {
  dashboard: "Dashboard", analytics: "Analytics & Tracking",
  users: "Users", events: "Events", event_ai: "Events AI Assistant",
  spots: "Spots", bookings: "Bookings", content: "Content Moderation",
  groups: "Community Groups", notifications: "Notifications",
  push_notifications: "Push Notifications", activity: "Activity Log",
  scanner: "Ticket Scanner", tickets: "Ticket Management",
  ai_assistant: "AI Assistant", spotlight: "City Spotlight",
  deal_finder: "Deal Finder", ai_finder: "AI Finder Promotions",
  live: "Live Viewers", api_monitoring: "API Status",
  business: "Business Verification", kvk: "KVK API",
  email: "Email Testing", safety: "Safety Monitor",
  outreach: "Municipal Outreach", inbox: "Email Inbox",
  linkedin: "LinkedIn", marketing: "Marketing Console",
  funding: "Funding Intelligence", event_sources: "Event Sources",
  performance: "Performance Monitor", app_health: "App Health Check",
  event_validator: "Event Validator", security_center: "Security Center",
};

export default function AdminView() {
  const [active, setActive] = useState<SectionId>("dashboard");
  const [activeGroup, setActiveGroup] = useState("Overview");
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const hasShownToast = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("section") === "linkedin") setActive("linkedin");
  }, []);

  const isAdminUser = (role?: string) => ["admin", "super_admin", "moderator"].includes(role ?? "");

  useEffect(() => {
    if (isAdminUser(user?.role) && !hasShownToast.current) {
      hasShownToast.current = true;
      toast({ title: "Admin Access", description: `Welcome back, ${user?.displayName}.` });
    }
  }, [user, toast]);

  const { data: unreadNotifications = [] } = useQuery({
    queryKey: ["/api/admin/notifications/unread"],
    queryFn: async () => {
      if (!user || !isAdminUser(user.role)) return [];
      try { const r = await apiRequest(`/api/admin/notifications?userId=${user.id}&unreadOnly=true&adminId=${user.id}`, "GET"); return r.json(); }
      catch { return []; }
    },
    refetchInterval: 120000,
    enabled: !!user && isAdminUser(user.role),
  });

  const { data: pendingEvents = [] } = useQuery({
    queryKey: ["/api/events/pending"],
    queryFn: async () => {
      try { const r = await fetch("/api/events"); const events = await r.json(); return events.filter((e: any) => e.status === "pending" || !e.status); }
      catch { return []; }
    },
    enabled: !!user && isAdminUser(user.role),
  });

  const { data: pendingLocations = [] } = useQuery({
    queryKey: ["/api/locations/pending"],
    queryFn: async () => {
      try { const r = await apiRequest("/api/locations?showAll=true", "GET"); const locs = await r.json(); return locs.filter((l: any) => l.approvalStatus === "pending" || !l.approvalStatus); }
      catch { return []; }
    },
    enabled: !!user && isAdminUser(user.role),
  });

  const { data: pendingGroupsList = [] } = useQuery<any[]>({
    queryKey: ["/api/groups/pending"],
    queryFn: async () => {
      try { const r = await apiRequest("/api/groups/pending", "GET"); return r.json(); }
      catch { return []; }
    },
    enabled: !!user && isAdminUser(user.role),
  });

  const navGroups: NavGroup[] = [
    {
      title: "Overview", emoji: "📊",
      items: [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        { id: "analytics", label: "Analytics", icon: BarChart3, highlight: "text-blue-500" },
      ],
    },
    {
      title: "Manage", emoji: "⚙️",
      items: [
        { id: "users", label: "Users", icon: Users },
        { id: "events", label: "Events", icon: Calendar, badge: pendingEvents.length },
        { id: "event_ai", label: "Events AI", icon: Sparkles, highlight: "text-blue-500" },
        { id: "spots", label: "Spots", icon: MapPin, badge: pendingLocations.length },
        { id: "groups", label: "Groups", icon: Users, badge: pendingGroupsList.length, highlight: "text-violet-500" },
        { id: "bookings", label: "Bookings", icon: Bookmark },
        { id: "content", label: "Content", icon: Shield },
      ],
    },
    {
      title: "Operations", emoji: "🔔",
      items: [
        { id: "notifications", label: "Notifications", icon: Bell, badge: unreadNotifications.length },
        { id: "push_notifications", label: "Push Notifs", icon: Zap, highlight: "text-orange-500" },
        { id: "activity", label: "Activity Log", icon: Activity },
        { id: "scanner", label: "Scanner", icon: QrCode },
        { id: "tickets", label: "Tickets", icon: Ticket },
      ],
    },
    {
      title: "Tools", emoji: "🛠️",
      items: [
        { id: "ai_assistant", label: "AI Assistant", icon: Bot, highlight: "text-cyan-500" },
        { id: "ai_finder", label: "AI Finder", icon: Sparkles, highlight: "text-violet-500" },
        { id: "spotlight", label: "Spotlight", icon: Star, highlight: "text-amber-500" },
        { id: "deal_finder", label: "Deal Finder", icon: ShoppingCart, highlight: "text-amber-500" },
        { id: "live", label: "Live Viewers", icon: Monitor, highlight: "text-cyan-500" },
      ],
    },
    {
      title: "System", emoji: "🖥️",
      items: [
        { id: "app_health", label: "App Health", icon: ShieldCheck, highlight: "text-emerald-500" },
        { id: "security_center", label: "Security", icon: Shield, highlight: "text-purple-500" },
        { id: "performance", label: "Performance", icon: Gauge, highlight: "text-green-500" },
        { id: "safety", label: "Safety", icon: ShieldAlert, highlight: "text-red-500" },
        { id: "api_monitoring", label: "API Status", icon: Server },
        { id: "business", label: "Business", icon: Building2 },
        { id: "kvk", label: "KVK API", icon: FileKey },
        { id: "email", label: "Email", icon: Mail },
      ],
    },
    {
      title: "Growth", emoji: "📈",
      items: [
        { id: "marketing", label: "Marketing", icon: Megaphone, highlight: "text-orange-500" },
        { id: "outreach", label: "Outreach", icon: SendHorizonal, highlight: "text-emerald-500" },
        { id: "inbox", label: "Email Inbox", icon: Inbox, highlight: "text-blue-500" },
        { id: "linkedin", label: "LinkedIn", icon: FaLinkedin, highlight: "text-[#0A66C2]" },
        { id: "funding", label: "Funding", icon: TrendingUp, highlight: "text-emerald-500" },
        { id: "event_sources", label: "Event Sources", icon: Radio, highlight: "text-violet-500" },
        { id: "event_validator", label: "Quality Check", icon: CheckCircle, highlight: "text-emerald-500" },
      ],
    },
  ];

  const go = (id: SectionId) => {
    setActive(id);
    const group = navGroups.find(g => g.items.some(i => i.id === id));
    if (group) setActiveGroup(group.title);
  };

  const currentNavGroup = navGroups.find(g => g.title === activeGroup) ?? navGroups[0];

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center flex-col gap-4 p-8">
        <h1 className="text-2xl font-bold">Authentication Required</h1>
        <p className="text-muted-foreground text-center max-w-sm">You need to be logged in to access the admin dashboard.</p>
        <Button onClick={() => setLocation("/auth")} data-testid="button-sign-in">Sign In</Button>
      </div>
    );
  }

  if (!["admin", "moderator", "super_admin"].includes(user.role)) {
    return (
      <div className="flex-1 flex items-center justify-center flex-col gap-4 p-8">
        <h1 className="text-2xl font-bold">Admin Access Required</h1>
        <p className="text-muted-foreground text-center max-w-sm">Your role <strong>{user.role}</strong> does not have admin privileges.</p>
        <Button onClick={() => setLocation("/map")} data-testid="button-return-map">Return to Map</Button>
      </div>
    );
  }

  const totalPending = pendingEvents.length + pendingLocations.length + unreadNotifications.length + pendingGroupsList.length;

  return (
    <div className="flex flex-col min-h-full">

      {/* ── Section navigator ── */}
      <div className="bg-background/95 backdrop-blur-sm border-b border-border/60 sticky top-14 z-20">

        {/* Row 1: Group tabs */}
        <div className="flex overflow-x-auto [&::-webkit-scrollbar]:hidden border-b border-border/40">
          <div className="flex min-w-max px-2 sm:px-4">
            {navGroups.map(group => {
              const isGroupActive = activeGroup === group.title;
              const groupBadge = group.items.reduce((s, i) => s + ((i.badge ?? 0) as number), 0);
              return (
                <button
                  key={group.title}
                  onClick={() => { setActiveGroup(group.title); go(navGroups.find(g => g.title === group.title)!.items[0].id); }}
                  data-testid={`nav-group-${group.title.toLowerCase()}`}
                  className={`relative flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-all duration-150 ${
                    isGroupActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  <span className="hidden sm:inline">{group.emoji}</span>
                  {group.title}
                  {groupBadge > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 2: Section pills */}
        <div className="flex overflow-x-auto [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-1 px-2 sm:px-4 py-2">
            {currentNavGroup.items.map(item => {
              const isItemActive = active === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => go(item.id)}
                  data-testid={`nav-${item.id}`}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150 ${
                    isItemActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <item.icon className={`w-3.5 h-3.5 shrink-0 ${!isItemActive && item.highlight ? item.highlight : ""}`} />
                  {item.label}
                  {item.badge != null && (item.badge as number) > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none ${isItemActive ? "bg-white/25 text-white" : "bg-destructive text-white"}`}>
                      {(item.badge as number) > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Page header ── */}
      <div className="flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-border/40 bg-card/30">
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-base leading-tight">{pageTitle[active]}</h1>
          <p className="text-xs text-muted-foreground hidden sm:block">Admin Panel · {user.displayName || user.email}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {totalPending > 0 && (
            <Badge variant="destructive" className="animate-pulse text-xs">{totalPending} pending</Badge>
          )}
          <div className="hidden sm:flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-full px-2.5 py-1">
            <CheckCircle className="h-3 w-3" />
            <span>Online</span>
          </div>
        </div>
      </div>

      {/* ── Content area ── */}
      <div className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.12 }}
            className="p-3 sm:p-5 pb-24"
          >
            {active === "dashboard" && (
              <DashboardOverview
                pendingEvents={pendingEvents.length}
                pendingSpots={pendingLocations.length}
                unreadAlerts={unreadNotifications.length}
                navigate={go}
              />
            )}
            {active === "analytics" && <AdminAnalyticsPanel />}
            {active === "users" && <UserManagement />}
            {active === "events" && <EventManagement />}
            {active === "event_ai" && (
              <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-violet-500/5">
                <CardContent className="pt-5"><EventAiAssistant /></CardContent>
              </Card>
            )}
            {active === "spots" && <LocationManagement />}
            {active === "bookings" && <BookingManagement />}
            {active === "content" && <ContentModeration />}
            {active === "notifications" && <AdminNotifications />}
            {active === "push_notifications" && <AdminPushNotifications />}
            {active === "activity" && <ActivityLog />}
            {active === "scanner" && <TicketScanner />}
            {active === "tickets" && <TicketManagement />}
            {active === "ai_assistant" && <AdminAiAssistant />}
            {active === "ai_finder" && (
              <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-transparent">
                <CardContent className="pt-5"><AIFinderAdminPanel /></CardContent>
              </Card>
            )}
            {active === "spotlight" && (
              <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
                <CardContent className="pt-5"><AdminSpotlightPanel /></CardContent>
              </Card>
            )}
            {active === "deal_finder" && (
              <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
                <CardContent className="pt-5"><AdminDealFinder /></CardContent>
              </Card>
            )}
            {active === "live" && (
              <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-transparent">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 text-base">
                    <Monitor className="h-5 w-5" /> Live Results Viewer
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4 text-sm">Grant users access to display live battle results on projector screens.</p>
                  <Button onClick={() => setLocation("/admin/live-viewers")} className="bg-cyan-600 hover:bg-cyan-700 text-white" data-testid="button-open-live-viewers">
                    <Monitor className="h-4 w-4 mr-2" /> Open Live Viewers <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            )}
            {active === "app_health" && <AppHealthCheck />}
            {active === "security_center" && <SecurityCenter />}
            {active === "performance" && <PerformanceMonitor />}
            {active === "safety" && <AdminSafetyMonitor onNavigate={(section) => go(section as SectionId)} />}
            {active === "api_monitoring" && <ApiMonitoring />}
            {active === "business" && <BusinessVerificationManager />}
            {active === "kvk" && <KvkApiTest />}
            {active === "email" && <EmailTesting />}
            {active === "outreach" && <AdminOutreach />}
            {active === "inbox" && <AdminEmailInbox />}
            {active === "linkedin" && <AdminLinkedIn />}
            {active === "marketing" && <AdminMarketing />}
            {active === "funding" && <AdminFunding />}
            {active === "event_sources" && <AdminEventSources />}
            {active === "event_validator" && <AdminEventValidator />}
            {active === "groups" && <AdminGroupsPanel />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

interface DashboardOverviewProps {
  pendingEvents: number;
  pendingSpots: number;
  unreadAlerts: number;
  navigate: (id: SectionId) => void;
}

function DashboardOverview({ pendingEvents, pendingSpots, unreadAlerts, navigate }: DashboardOverviewProps) {
  const [, setLocation] = useLocation();
  const { data: stats } = useQuery({
    queryKey: ["/api/admin/stats/current"],
    queryFn: async () => {
      try { const r = await apiRequest("/api/admin/stats", "GET"); return r.json(); }
      catch { return null; }
    },
    refetchInterval: 60000,
  });

  const kpis = [
    { label: "Total Users", value: stats?.totalUsers ?? "—", sub: stats?.newUsers ? `+${stats.newUsers} today` : "Members", icon: Users, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/30", section: "users" as SectionId },
    { label: "Active Events", value: stats?.activeEvents ?? "—", sub: `${pendingEvents} pending`, icon: Calendar, color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/30", section: "events" as SectionId, alert: pendingEvents > 0 },
    { label: "Pending Spots", value: pendingSpots, sub: "Awaiting review", icon: MapPin, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/30", section: "spots" as SectionId, alert: pendingSpots > 0 },
    { label: "Unread Alerts", value: unreadAlerts, sub: "Notifications", icon: Bell, color: "text-red-600", bg: "bg-red-50 dark:bg-red-900/30", section: "notifications" as SectionId, alert: unreadAlerts > 0 },
    { label: "Total Posts", value: stats?.totalPosts ?? "—", sub: `${stats?.flaggedContent ?? 0} flagged`, icon: Shield, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/30", section: "content" as SectionId, alert: (stats?.flaggedContent ?? 0) > 0 },
    { label: "Revenue", value: stats?.totalRevenue != null ? `€${stats.totalRevenue}` : "—", sub: `${stats?.ticketsSold ?? 0} tickets sold`, icon: Ticket, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/30", section: "tickets" as SectionId },
  ] as const;

  const quickTools = [
    { label: "AI Assistant", icon: Bot, section: "ai_assistant" as SectionId, color: "text-cyan-500 bg-cyan-50 dark:bg-cyan-900/20" },
    { label: "Spotlight", icon: Star, section: "spotlight" as SectionId, color: "text-amber-500 bg-amber-50 dark:bg-amber-900/20" },
    { label: "Deal Finder", icon: ShoppingCart, section: "deal_finder" as SectionId, color: "text-amber-500 bg-amber-50 dark:bg-amber-900/20" },
    { label: "Analytics", icon: BarChart3, section: "analytics" as SectionId, color: "text-blue-500 bg-blue-50 dark:bg-blue-900/20" },
    { label: "Activity", icon: Activity, section: "activity" as SectionId, color: "text-green-500 bg-green-50 dark:bg-green-900/20" },
    { label: "Performance", icon: Gauge, section: "performance" as SectionId, color: "text-green-500 bg-green-50 dark:bg-green-900/20" },
  ];

  const aiTools = [
    { icon: Wand2, label: "AI Studio", desc: "Content, images & captions", path: "/admin/ai-studio", gradient: "from-violet-600 to-purple-700" },
    { icon: Volume2, label: "ElevenLabs", desc: "Text-to-speech & voice", path: "/admin/elevenlabs", gradient: "from-indigo-600 to-violet-700" },
    { icon: Sparkles, label: "AI Access", desc: "Premium AI for users", path: "/admin/ai-access", gradient: "from-purple-600 to-pink-700" },
  ];

  const newTools = [
    { icon: Zap, label: "Command Center", desc: "Live stats & activity", path: "/admin/overview", color: "text-blue-500", bg: "bg-blue-500/10" },
    { icon: SendHorizonal, label: "Broadcast", desc: "Notify all users", path: "/admin/broadcast", color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { icon: Shield, label: "Moderation", desc: "Review reports", path: "/admin/moderation", color: "text-red-500", bg: "bg-red-500/10" },
    { icon: Radio, label: "Reels", desc: "Manage all reels", path: "/admin/reels", color: "text-purple-500", bg: "bg-purple-500/10" },
  ];

  return (
    <div className="space-y-5">

      {/* KPI grid — 2 cols on mobile, 3 on sm, 6 on lg */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        {kpis.map((kpi) => (
          <Card
            key={kpi.label}
            className={`cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${kpi.alert ? "border-destructive/30 bg-destructive/5" : "border-border/60"}`}
            onClick={() => navigate(kpi.section)}
            data-testid={`card-kpi-${kpi.label.toLowerCase().replace(/\s/g, "-")}`}
          >
            <CardContent className="p-3 sm:p-4">
              <div className={`w-8 h-8 rounded-lg ${kpi.bg} flex items-center justify-center mb-2`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
              <p className={`text-xl sm:text-2xl font-bold ${kpi.alert ? "text-destructive" : ""}`}>{kpi.value}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 leading-tight">{kpi.label}</p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5 leading-tight hidden sm:block">{kpi.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick tools — 3 cols on mobile, 6 on sm */}
      <div>
        <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Quick Access</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {quickTools.map((tool) => (
            <button
              key={tool.label}
              onClick={() => navigate(tool.section)}
              data-testid={`quick-${tool.label.toLowerCase().replace(/\s/g, "-")}`}
              className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border/60 bg-card hover:bg-muted hover:border-primary/20 transition-all duration-150 group"
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tool.color}`}>
                <tool.icon className="h-4.5 w-4.5" />
              </div>
              <span className="text-[10px] sm:text-[11px] font-medium text-center leading-tight">{tool.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* AI Tools strip */}
      <div className="rounded-2xl overflow-hidden border border-purple-500/25 bg-gradient-to-br from-purple-950/60 via-indigo-950/40 to-[#0d0820]/80 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
          <span className="text-sm font-bold text-white">AI Tools</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-600/30 text-purple-300 border border-purple-600/30 font-medium ml-1">Quick Access</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          {aiTools.map(t => (
            <button
              key={t.path}
              onClick={() => setLocation(t.path)}
              data-testid={`aitools-${t.label.toLowerCase().replace(/\s/g, "-")}`}
              className="flex items-center gap-3 p-3 sm:p-4 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/50 hover:bg-white/10 transition-all text-left group"
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${t.gradient} flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform`}>
                <t.icon className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white leading-tight">{t.label}</p>
                <p className="text-[11px] text-purple-300/80 mt-0.5 leading-tight">{t.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* New admin tools */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-bold text-foreground">New Admin Tools</span>
          <Badge variant="outline" className="text-[10px] border-primary/30 text-primary ml-1">New</Badge>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {newTools.map(t => (
            <button
              key={t.path}
              onClick={() => setLocation(t.path)}
              data-testid={`newtools-${t.label.toLowerCase().replace(/\s/g, "-")}`}
              className="flex items-start gap-2.5 p-3 rounded-xl bg-background border border-border hover:border-primary/30 hover:bg-accent transition-all text-left"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${t.color} ${t.bg}`}>
                <t.icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground leading-tight">{t.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{t.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main stats charts */}
      <DashboardStats />
    </div>
  );
}
