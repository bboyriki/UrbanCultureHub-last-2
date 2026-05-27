import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Loader2, LayoutDashboard, UserCog, FileText, AlertTriangle,
  Calendar, Package, BarChart3, Database, LogOut, Monitor,
  Megaphone, Activity, Image, Wand2, Film, Menu, X, ChevronRight, ChevronDown,
  Zap, Radio, Shield, Send, Sparkles, CalendarDays, MapPin, Volume2, Vote, Key,
  ShieldCheck, User, ShoppingBag, Palette, Lock, Layout, Share2, Brain, Target,
  Briefcase, Download, Clapperboard, Scissors, CalendarCheck, Bot, Mail, Settings,
  Home, ArrowLeft, Layers, Terminal
} from "lucide-react";
import { SiTiktok, SiInstagram, SiSnapchat, SiLinkedin } from "react-icons/si";
import AiQuickAccess from "./AiQuickAccess";

type NavItem = { label: string; icon: React.ElementType; path: string; exact?: boolean };
type NavGroup = { title: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    title: "Main",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/admin/overview" },
      { label: "Control Center", icon: Terminal, path: "/admin/control-center" },
      { label: "All Tools", icon: Layers, path: "/admin/tools" },
      { label: "User Management", icon: UserCog, path: "/admin/users" },
    ],
  },
  {
    title: "AI Tools",
    items: [
      { label: "My Profile & AI", icon: User, path: "/admin/my-profile" },
      { label: "AI Studio", icon: Wand2, path: "/admin/ai-studio" },
      { label: "AI Control", icon: Brain, path: "/admin/ai-control" },
      { label: "AI App Content", icon: Sparkles, path: "/admin/ai-app-content" },
      { label: "Theme Control", icon: Palette, path: "/admin/theme-control" },
      { label: "Homepage Builder", icon: Layout, path: "/admin/homepage-builder" },
      { label: "ElevenLabs Studio", icon: Volume2, path: "/admin/elevenlabs" },
      { label: "AI Access", icon: Sparkles, path: "/admin/ai-access" },
      { label: "Security Center", icon: Lock, path: "/admin/security-center" },
    ],
  },
  {
    title: "Content",
    items: [
      { label: "Chat Control", icon: Radio, path: "/admin/chat-control" },
      { label: "Moderation Queue", icon: Shield, path: "/admin/moderation" },
      { label: "Broadcast", icon: Send, path: "/admin/broadcast" },
      { label: "Programme Planning", icon: CalendarDays, path: "/admin/programme" },
      { label: "Content Review", icon: FileText, path: "/admin/content" },
      { label: "Explore Images", icon: Image, path: "/admin/explore-images" },
      { label: "Reels", icon: Film, path: "/admin/reels" },
      { label: "Creator Studio", icon: Clapperboard, path: "/admin/creator-studio" },
      { label: "Legal Management", icon: ShieldCheck, path: "/admin/legal" },
      { label: "Legal Assistant", icon: Bot, path: "/admin/legal-assistant" },
      { label: "Email Writer", icon: Mail, path: "/admin/email-writer" },
      { label: "Memory Calendar", icon: CalendarCheck, path: "/admin/memory-calendar" },
      { label: "Data Deletion", icon: Database, path: "/admin/data-deletion-requests" },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Career Suite", icon: Briefcase, path: "/admin/career" },
      { label: "Outreach Intelligence", icon: Download, path: "/admin/lead-export" },
      { label: "Marketing", icon: Megaphone, path: "/admin/marketing" },
      { label: "Ads Hub", icon: Target, path: "/admin/ads-hub" },
      { label: "Service Bookings", icon: Calendar, path: "/admin/service-bookings" },
      { label: "Products", icon: Package, path: "/admin/products" },
      { label: "Events", icon: BarChart3, path: "/admin/events" },
      { label: "Analytics", icon: Activity, path: "/admin/analytics" },
      { label: "Marketplace Analytics", icon: ShoppingBag, path: "/admin/marketplace-analytics" },
      { label: "Live Viewers", icon: Monitor, path: "/admin/live-viewers" },
      { label: "Spot Creators", icon: MapPin, path: "/admin/spot-creators" },
      { label: "Spots Overview", icon: BarChart3, path: "/admin/spots-overview" },
      { label: "Spot Assignments", icon: MapPin, path: "/admin/spot-assignments" },
      { label: "Polls & Voting", icon: Vote, path: "/admin/polls" },
      { label: "Share Access", icon: Share2, path: "/admin/share-permissions" },
      { label: "Feature Settings", icon: Settings, path: "/admin/feature-settings" },
      { label: "API Keys", icon: Key, path: "/admin/api-keys" },
    ],
  },
  {
    title: "Social",
    items: [
      { label: "LinkedIn", icon: SiLinkedin, path: "/admin/linkedin" },
      { label: "TikTok Integration", icon: SiTiktok, path: "/admin/tiktok" },
      { label: "Instagram", icon: SiInstagram, path: "/admin/instagram" },
      { label: "Snapchat Business", icon: SiSnapchat, path: "/admin/snapchat" },
    ],
  },
  {
    title: "Other",
    items: [
      { label: "Testing Tools", icon: AlertTriangle, path: "/admin/test-notification" },
    ],
  },
];

const allItems = navGroups.flatMap(g => g.items);

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const [location, navigate] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(["Social", "Other"]));

  const { data: igStatus } = useQuery<any>({
    queryKey: ["/api/instagram/status"],
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    if (!loading && (!user || (user.role !== "admin" && user.role !== "super_admin"))) {
      navigate("/admin-login");
    }
  }, [user, loading, navigate]);

  useEffect(() => { setDrawerOpen(false); }, [location]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 text-base text-foreground font-medium">Loading admin panel…</span>
      </div>
    );
  }

  if (!user || (user.role !== "admin" && user.role !== "super_admin")) return null;

  const isActive = (path: string, exact = false) =>
    exact ? location === path : location.startsWith(path);

  const isCreatorStudio = location.startsWith("/admin/creator-studio");
  const isAdminRoot = location === "/admin";
  const currentPage = allItems.find(i => isActive(i.path, i.exact));

  const toggleGroup = (title: string) =>
    setCollapsed(prev => { const n = new Set(prev); n.has(title) ? n.delete(title) : n.add(title); return n; });

  const SidebarContent = () => (
    <nav className="py-2">
      {navGroups.map(group => {
        const isOpen = !collapsed.has(group.title);
        const hasActive = group.items.some(i => isActive(i.path, i.exact));
        return (
          <div key={group.title}>
            <button
              onClick={() => toggleGroup(group.title)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors",
                hasActive ? "text-primary" : "text-muted-foreground/60 hover:text-muted-foreground"
              )}
            >
              {group.title}
              <ChevronDown className={cn("w-3 h-3 transition-transform duration-200", isOpen ? "" : "-rotate-90")} />
            </button>
            {isOpen && group.items.map(({ label, icon: Icon, path, exact }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-100 mx-1 my-0.5 w-[calc(100%-8px)]",
                  isActive(path, exact)
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate text-xs">{label}</span>
                {isActive(path, exact) && <ChevronRight className="w-3 h-3 ml-auto opacity-60 shrink-0" />}
              </button>
            ))}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className={cn("bg-background", isCreatorStudio ? "h-screen flex flex-col overflow-hidden" : "min-h-screen")}>

      {/* ── Sticky top header ── */}
      <header className="bg-background/95 backdrop-blur border-b border-border sticky top-0 z-40 flex-shrink-0">
        <div className="flex items-center h-14 px-3 sm:px-4 gap-2">
          {/* Hamburger (all screen sizes — sidebar is collapsible) */}
          <button
            onClick={() => setDrawerOpen(v => !v)}
            className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-muted transition-colors shrink-0"
            aria-label="Toggle menu"
            data-testid="button-admin-hamburger"
          >
            {drawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Brand / current page */}
          <div className="flex-1 min-w-0">
            <span className="text-sm font-bold text-primary hidden lg:block">Urban Culture Admin</span>
            <div className="lg:hidden flex items-center gap-1.5 min-w-0">
              {currentPage && <currentPage.icon className="w-4 h-4 text-primary shrink-0" />}
              <span className="text-sm font-semibold text-foreground truncate">
                {currentPage?.label || "Admin Dashboard"}
              </span>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Back to main app */}
            <button
              onClick={() => navigate("/map")}
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-full border border-border text-xs font-semibold bg-background text-foreground hover:bg-muted transition-colors"
              title="Back to main app"
              data-testid="button-back-to-app"
            >
              <Home className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Back to App</span>
            </button>

            {!isCreatorStudio && (
              <button
                onClick={() => navigate("/admin/creator-studio")}
                className="flex items-center gap-1.5 h-8 px-2.5 rounded-full border text-xs font-semibold bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                data-testid="button-header-creator-studio"
              >
                <Scissors className="w-3.5 h-3.5 text-primary" />
                <span className="hidden sm:inline">Studio</span>
              </button>
            )}
            {igStatus?.connected && (
              <button
                onClick={() => navigate("/admin/instagram")}
                className={cn(
                  "flex items-center gap-1.5 h-8 px-2.5 rounded-full border text-xs font-semibold transition-colors",
                  location.startsWith("/admin/instagram")
                    ? "bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white border-transparent"
                    : "bg-gradient-to-r from-purple-50 via-pink-50 to-orange-50 dark:from-purple-950/30 dark:via-pink-950/30 dark:to-orange-950/30 border-pink-200 dark:border-pink-800/50 text-pink-700 dark:text-pink-300"
                )}
              >
                {igStatus.profilePictureUrl
                  ? <img src={`/api/instagram/proxy-image?url=${encodeURIComponent(igStatus.profilePictureUrl)}`} className="w-4 h-4 rounded-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  : <SiInstagram className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline max-w-[72px] truncate">@{igStatus.username}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
              </button>
            )}
            <span className="text-xs text-muted-foreground hidden md:block max-w-[100px] truncate">{user.displayName}</span>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => logout().then(() => navigate("/admin-login"))}>
              <LogOut className="w-3.5 h-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Drawer overlay (all screen sizes) ── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-64 max-w-[80vw] bg-background border-r border-border h-full shadow-2xl overflow-y-auto flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">Urban Culture Admin</p>
                <p className="text-xs text-muted-foreground truncate">{user.displayName}</p>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SidebarContent />
            </div>
          </div>
        </div>
      )}

      {/* ── Page body ── */}
      {isCreatorStudio ? (
        <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
      ) : isAdminRoot ? (
        /* Dashboard root — full width, AdminView controls its own layout */
        <div className="flex min-h-[calc(100vh-56px)]">
          {/* Desktop sidebar — visible only on lg+ */}
          <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-border/60 bg-card/30">
            <div className="flex-1 overflow-y-auto">
              <SidebarContent />
            </div>
          </aside>
          {/* Dashboard content — full width on mobile */}
          <div className="flex-1 min-w-0">
            {children}
          </div>
        </div>
      ) : (
        /* Other admin pages — sidebar + padded content */
        <div className="flex min-h-[calc(100vh-56px)]">
          {/* Desktop sidebar */}
          <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-border/60 bg-card/30">
            <div className="flex-1 overflow-y-auto">
              <SidebarContent />
            </div>
          </aside>
          {/* Page content */}
          <main className="flex-1 min-w-0 px-3 sm:px-6 py-4 sm:py-6 max-w-6xl">
            {children}
          </main>
        </div>
      )}

      {/* Floating AI Quick Access (⌘K / Ctrl+K) */}
      <AiQuickAccess />
    </div>
  );
}
