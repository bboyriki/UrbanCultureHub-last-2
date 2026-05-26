import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  User, Menu, X, LogOut, Shield, Gavel,
  MessageCircle, Home, CalendarDays, Users, Users2, MapPin,
  Sun, Moon, Ticket, Flame, CalendarCheck, ShoppingBag,
  Star, Sparkles, Paintbrush, Music, Zap, Crown, ChevronDown,
  Brain, Scale, Mail,
} from "lucide-react";
import { SiInstagram } from "react-icons/si";
import logoImage from "@assets/u9932826292_A_modern_dynamic_logo_for_Urban_Culture_-_a_creat__1773277819543.png";
import NotificationCenter from "@/components/NotificationCenter";
import { useUnreadMessages } from "@/hooks/use-unread-messages";
import { useQuery } from "@tanstack/react-query";
import NotificationBadgeWrapper from "@/components/badges/NotificationBadgeWrapper";
import { LanguageSelector } from "@/components/LanguageSelector";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/* Split a string into individual animated character spans */
function AnimatedWord({
  text,
  baseDelay,
  className,
}: {
  text: string;
  baseDelay: number;
  className?: string;
}) {
  return (
    <span className={className}>
      {text.split("").map((char, i) => (
        <span
          key={i}
          className="brand-char"
          style={{ animationDelay: `${baseDelay + i * 0.04}s` }}
        >
          {char}
        </span>
      ))}
    </span>
  );
}

export default function AppHeader() {
  const [location, navigate] = useLocation();
  const { isDarkMode, setTheme } = useTheme();
  const toggleDarkMode = () => setTheme(isDarkMode ? "light" : "dark");
  const { user, logout } = useAuth();
  const { unreadMessages } = useUnreadMessages();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [menuRef, setMenuRef] = useState<HTMLElement | null>(null);

  const { data: judgeAssignments = [] } = useQuery({
    queryKey: [`/api/users/${user?.id}/judge-assignments`],
    enabled: !!user?.id,
  });
  const isJudge = (judgeAssignments as any[]).length > 0;

  const { data: followRequests = [] } = useQuery<any[]>({
    queryKey: ["/api/follow-requests"],
    enabled: !!user,
    refetchInterval: 60000,
  });
  const pendingRequestCount = (followRequests as any[]).length;
  const unreadCount = unreadMessages?.length ?? 0;

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const { data: igStatus } = useQuery<any>({
    queryKey: ["/api/instagram/status"],
    enabled: isAdmin,
    staleTime: 3 * 60 * 1000,
    retry: false,
  });

  /* Scroll listener — elevates header on scroll */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Close mobile menu on outside click */
  useEffect(() => {
    if (!mobileMenuOpen || !menuRef) return;
    const handler = (e: MouseEvent) => {
      if (!menuRef.contains(e.target as Node)) setMobileMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mobileMenuOpen, menuRef]);

  /* Close mobile menu on route change */
  useEffect(() => { setMobileMenuOpen(false); }, [location]);

  const handleSignOut = async () => {
    try {
      await logout();
      navigate("/auth");
    } catch (error: any) {
      toast({ title: "Logout failed", description: error.message || "Could not log out", variant: "destructive" });
    }
  };

  const navigationLinks = [
    { href: "/", label: t("nav.home"), icon: Home },
    { href: "/map", label: "Map", icon: MapPin },
    { href: "/trending", label: "Trending", icon: Flame },
    { href: "/events", label: t("nav.events"), icon: CalendarDays },
    { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
    { href: "/community", label: t("nav.community"), icon: Users },
  ];
  if (isJudge) navigationLinks.push({ href: "/judge-panel", label: t("nav.judgePanel"), icon: Gavel });
  if (user?.role === "admin" || user?.role === "super_admin")
    navigationLinks.push({ href: "/admin", label: t("nav.admin"), icon: Shield });

  const isActive = (path: string) =>
    path === "/" ? location === path : location.startsWith(path);

  return (
    <header
      ref={(el) => setMenuRef(el)}
      className={cn(
        "header-slide-in sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur-xl transition-[box-shadow,border-color] duration-300",
        scrolled && "header-elevated"
      )}
    >
      {/* Glass shimmer sweep overlay */}
      <div className="header-shimmer-wrap" aria-hidden="true" />

      {/* Animated prismatic bottom accent line */}
      <div className="header-prism-line" aria-hidden="true" />

      <div className="flex h-14 items-center justify-between px-4 gap-4">

        {/* ── Left: hamburger + logo ─────────────────────── */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            onClick={() => setMobileMenuOpen(prev => !prev)}
            data-testid="button-mobile-menu"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              {/* Logo with orbital rotating ring */}
              <div className="logo-orbit-wrap">
                <img
                  src={logoImage}
                  alt="Urban Culture"
                  className="logo-pop logo-img relative z-10 w-8 h-8 rounded-lg object-cover shadow-sm shrink-0"
                />
              </div>

              {/* Brand name: character-by-character reveal */}
              <div className="font-bold text-sm tracking-tight whitespace-nowrap" style={{ perspective: "400px" }}>
                <AnimatedWord
                  text="Urban"
                  baseDelay={0.25}
                  className="text-foreground"
                />
                <span className="ml-1">
                  <AnimatedWord
                    text="Culture"
                    baseDelay={0.52}
                    className="brand-culture"
                  />
                </span>
              </div>
            </div>
          </Link>
        </div>

        {/* ── Desktop navigation ─────────────────────────── */}
        <nav className="hidden md:flex items-center gap-0.5 bg-muted/40 rounded-xl p-1">
          {navigationLinks.map((link, index) => {
            const Icon = link.icon;
            const active = isActive(link.href);
            return (
              <Link key={link.href} href={link.href}>
                <button
                  className={cn(
                    "nav-item-in nav-hover-bloom relative flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium transition-all duration-200 overflow-hidden",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                  style={{ animationDelay: `${0.22 + index * 0.06}s` }}
                >
                  {/* Sliding active pill background */}
                  {active && <span className="nav-active-pill" />}

                  <Icon
                    size={14}
                    strokeWidth={active ? 2.5 : 1.8}
                    className="relative z-10"
                  />
                  <span className="relative z-10">{link.label}</span>

                  {link.href === "/community" && (
                    <NotificationBadgeWrapper section="social" className="absolute -top-1 -right-1 z-20" />
                  )}
                  {link.href === "/nearby" && pendingRequestCount > 0 && (
                    <span className="absolute -top-1 -right-1 z-20 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground px-1">
                      {pendingRequestCount > 9 ? "9+" : pendingRequestCount}
                    </span>
                  )}
                </button>
              </Link>
            );
          })}

          {/* Memory Calendar — admin shortcut (always visible for admins) */}
          {isAdmin && (
            <Link href="/admin/memory-calendar">
              <button
                className={cn(
                  "nav-item-in relative flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-bold transition-all duration-200 ml-1 border",
                  isActive("/admin/memory-calendar")
                    ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 text-white border-transparent shadow-md"
                    : "bg-gradient-to-r from-indigo-500/10 via-purple-500/8 to-fuchsia-500/10 border-indigo-400/30 text-indigo-600 dark:text-indigo-300 hover:border-indigo-400/60 hover:shadow-sm"
                )}
                style={{ animationDelay: `${0.22 + navigationLinks.length * 0.06}s` }}
                title="Memory Calendar — your AI-assisted reminders"
                data-testid="link-header-memory-calendar"
              >
                <Brain size={13} strokeWidth={2} className="shrink-0" />
                <span className="relative z-10">Memory</span>
              </button>
            </Link>
          )}

          {/* Instagram Studio — admin only, shown when IG is connected */}
          {isAdmin && igStatus?.connected && (
            <Link href="/admin/instagram">
              <button
                className={cn(
                  "nav-item-in relative flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-bold transition-all duration-200 ml-1 border",
                  isActive("/admin/instagram")
                    ? "bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white border-transparent shadow-md"
                    : "bg-gradient-to-r from-purple-500/10 via-pink-500/8 to-orange-400/10 border-pink-400/30 text-pink-600 dark:text-pink-400 hover:border-pink-400/60 hover:shadow-sm"
                )}
                style={{ animationDelay: `${0.22 + navigationLinks.length * 0.06}s` }}
                title={`Instagram Studio — @${igStatus.username}`}
              >
                {igStatus.profilePictureUrl ? (
                  <img
                    src={`/api/instagram/proxy-image?url=${encodeURIComponent(igStatus.profilePictureUrl)}`}
                    className="w-4 h-4 rounded-full object-cover shrink-0"
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <SiInstagram size={12} className="shrink-0" />
                )}
                <span className="relative z-10">Instagram</span>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
              </button>
            </Link>
          )}

          {/* Culture Hub dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "nav-item-in relative flex items-center gap-1 px-3 h-8 rounded-lg text-xs font-medium transition-all duration-200",
                  ["/cred","/crews","/challenges","/cyphers","/graffiti","/beat-lab","/hall-of-fame","/culture-tools"].some(p => location.startsWith(p))
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Crown size={13} strokeWidth={1.8} className="relative z-10" />
                <span className="relative z-10">Culture</span>
                <ChevronDown size={11} className="relative z-10" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuItem asChild>
                <Link href="/cred"><div className="flex items-center gap-2 w-full cursor-pointer"><Star size={14} className="text-yellow-400" /><span>Street Cred</span></div></Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/community/groups"><div className="flex items-center gap-2 w-full cursor-pointer"><Users2 size={14} className="text-primary" /><span>Groups</span></div></Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/crews"><div className="flex items-center gap-2 w-full cursor-pointer"><Users size={14} className="text-purple-400" /><span>Crews</span></div></Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/challenges"><div className="flex items-center gap-2 w-full cursor-pointer"><Zap size={14} className="text-yellow-500" /><span>Challenges</span></div></Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/cyphers"><div className="flex items-center gap-2 w-full cursor-pointer"><Flame size={14} className="text-orange-500" /><span>Cyphers</span></div></Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/graffiti"><div className="flex items-center gap-2 w-full cursor-pointer"><Paintbrush size={14} className="text-cyan-400" /><span>Graffiti Wall</span></div></Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/beat-lab"><div className="flex items-center gap-2 w-full cursor-pointer"><Music size={14} className="text-green-400" /><span>Beat Lab & Radio</span></div></Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/hall-of-fame"><div className="flex items-center gap-2 w-full cursor-pointer"><Crown size={14} className="text-yellow-400" /><span>Hall of Fame</span></div></Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/culture-tools"><div className="flex items-center gap-2 w-full cursor-pointer"><Sparkles size={14} className="text-violet-400" /><span>Culture Tools (AI)</span></div></Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* BTTS — flagship event link */}
          <Link href="/back-to-the-street">
            <button
              className={cn(
                "nav-item-in btts-btn-glow relative flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-bold transition-all duration-200 ml-1 border",
                isActive("/back-to-the-street")
                  ? "bg-gradient-to-r from-orange-500/25 to-red-500/20 border-orange-500/40 shadow-sm"
                  : "bg-orange-500/8 hover:bg-orange-500/15 border-orange-500/25"
              )}
              style={{ animationDelay: `${0.22 + navigationLinks.length * 0.06}s` }}
            >
              <Flame size={13} strokeWidth={2} className="btts-flame-icon text-orange-400 shrink-0" />
              <span className="btts-fire-text font-black tracking-wide relative z-10">BTTS</span>
            </button>
          </Link>
        </nav>

        {/* ── Right side controls ────────────────────────── */}
        <div className="controls-slide-in flex items-center gap-1 ml-auto shrink-0">
          {user && (
            <>
              <NotificationCenter />
              <Link href="/chat">
                <button
                  className="relative flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  data-testid="icon-messages"
                  aria-label="Messages"
                >
                  <MessageCircle size={18} strokeWidth={1.8} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground px-0.5">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
              </Link>
            </>
          )}

          <LanguageSelector variant="ghost" size="sm" showText={false} />

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full overflow-hidden h-8 w-8 ring-1 ring-border/50 hover:ring-primary/40 transition-all ml-0.5"
                  data-testid="button-user-menu"
                >
                  {user.profilePicture ? (
                    <img src={user.profilePicture} alt="User" className="w-8 h-8 object-cover rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User size={16} className="text-primary" />
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={6} className="w-56 shadow-lg">
                <div className="px-3 py-2.5 bg-primary/5">
                  <div className="font-semibold text-sm">{user.displayName || "Profile"}</div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">{user.email}</div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer h-9 gap-2">
                  <Link href={`/profile/${user.id}`} className="flex items-center w-full relative">
                    <User size={14} className="mr-2 text-primary" />
                    <span className="flex-1">{t("nav.profile")}</span>
                    <NotificationBadgeWrapper section="user" className="absolute top-1 right-2 z-10" />
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer h-9 gap-2">
                  <Link href="/profile/tickets" className="flex items-center w-full">
                    <Ticket size={14} className="mr-2 text-primary" />
                    <span className="flex-1">{t("tickets.title")}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer h-9 gap-2">
                  <Link href="/marketplace" className="flex items-center w-full" data-testid="link-marketplace-nav">
                    <ShoppingBag size={14} className="mr-2 text-primary" />
                    <span className="flex-1">Marketplace</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer h-9 gap-2">
                  <Link href="/marketplace/seller" className="flex items-center w-full" data-testid="link-seller-dashboard-nav">
                    <ShoppingBag size={14} className="mr-2 text-muted-foreground" />
                    <span className="flex-1 text-muted-foreground">My listings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer h-9 gap-2">
                  <Link href="/programme/events" className="flex items-center w-full" data-testid="link-programme-events">
                    <CalendarCheck size={14} className="mr-2 text-primary" />
                    <span className="flex-1">Programme Events</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer h-9 gap-2">
                  <Link href="/programme/my-reservations" className="flex items-center w-full" data-testid="link-my-reservations-nav">
                    <CalendarDays size={14} className="mr-2 text-primary" />
                    <span className="flex-1">My Reservations</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer h-9 gap-2">
                  <Link href="/chat" className="flex items-center w-full relative">
                    <MessageCircle size={14} className="mr-2 text-primary" />
                    <span className="flex-1">{t("nav.messages")}</span>
                    <NotificationBadgeWrapper section="chat" className="absolute top-1 right-2 z-10" />
                  </Link>
                </DropdownMenuItem>
                {(user.role === "admin" || user.role === "super_admin") && (
                  <>
                    <DropdownMenuItem asChild className="cursor-pointer h-9 gap-2">
                      <Link href="/admin" className="flex items-center w-full">
                        <Shield size={14} className="mr-2 text-primary" />
                        <span className="flex-1">{t("admin.title")}</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer h-9 gap-2" data-testid="menu-item-memory-calendar">
                      <Link href="/admin/memory-calendar" className="flex items-center w-full">
                        <Brain size={14} className="mr-2 text-indigo-500" />
                        <span className="flex-1">Memory Calendar</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer h-9 gap-2" data-testid="menu-item-legal-assistant">
                      <Link href="/admin/legal-assistant" className="flex items-center w-full">
                        <Scale size={14} className="mr-2 text-amber-600" />
                        <span className="flex-1">Legal Assistant</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer h-9 gap-2" data-testid="menu-item-email-writer">
                      <Link href="/admin/email-writer" className="flex items-center w-full">
                        <Mail size={14} className="mr-2 text-emerald-600" />
                        <span className="flex-1">Email Writer</span>
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer h-9 gap-2">
                  <Link href="/legal-hub" className="flex items-center w-full">
                    <Shield size={14} className="mr-2 text-muted-foreground" />
                    <span className="flex-1 text-muted-foreground">{t("legal.terms")}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleDarkMode} className="cursor-pointer h-9 gap-2">
                  {isDarkMode ? <Sun size={14} className="mr-2" /> : <Moon size={14} className="mr-2" />}
                  <span>{isDarkMode ? t("nav.lightMode") : t("nav.darkMode")}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-red-500 focus:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer h-9"
                  data-testid="button-sign-out"
                >
                  <LogOut size={14} className="mr-2" />
                  <span>{t("nav.signOut")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={toggleDarkMode}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Toggle theme"
              >
                {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <Button size="sm" asChild className="h-8 text-xs px-3">
                <Link href="/auth" className="flex items-center gap-1.5" data-testid="button-sign-in">
                  <User size={14} />
                  <span>{t("nav.signIn")}</span>
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile menu ────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div
          className="mobile-menu-animate absolute top-full left-0 right-0 z-50 md:hidden border-b border-border shadow-2xl"
          style={{
            background: "hsl(var(--background))",
            maxHeight: "calc(100dvh - 3.5rem - 60px - env(safe-area-inset-bottom, 0px))",
            overflowY: "auto",
            overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {/* Prismatic bottom accent line */}
          <div className="header-prism-line" aria-hidden="true" style={{ top: "auto", bottom: 0 }} />

          <nav className="flex flex-col py-2">
            {navigationLinks.map((link, index) => {
              const Icon = link.icon;
              const active = isActive(link.href);
              return (
                <Link key={link.href} href={link.href}>
                  <button
                    className={cn(
                      "mobile-menu-item flex items-center gap-3 w-full px-5 py-3.5 text-sm font-medium transition-colors relative",
                      active
                        ? "text-primary bg-primary/8 font-semibold"
                        : "text-foreground hover:bg-muted hover:text-foreground"
                    )}
                    style={{ animationDelay: `${index * 0.045}s` }}
                  >
                    <Icon size={19} strokeWidth={active ? 2.4 : 1.8} className={active ? "text-primary" : "text-muted-foreground"} />
                    <span className="flex-1 text-left">{link.label}</span>
                    {active && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    )}
                  </button>
                </Link>
              );
            })}


            {/* Culture Hub — mobile */}
            <div className="h-px mx-4 my-1" style={{ background: "hsl(var(--border))" }} />
            <div className="px-5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Culture Hub</div>
            {[
              { href: "/cred", label: "Street Cred", Icon: Star, color: "text-yellow-400" },
              { href: "/community/groups", label: "Groups", Icon: Users2, color: "text-primary" },
              { href: "/crews", label: "Crews", Icon: Users, color: "text-purple-400" },
              { href: "/challenges", label: "Challenges", Icon: Zap, color: "text-yellow-500" },
              { href: "/cyphers", label: "Cyphers", Icon: Flame, color: "text-orange-500" },
              { href: "/graffiti", label: "Graffiti Wall", Icon: Paintbrush, color: "text-cyan-400" },
              { href: "/beat-lab", label: "Beat Lab & Radio", Icon: Music, color: "text-green-400" },
              { href: "/hall-of-fame", label: "Hall of Fame", Icon: Crown, color: "text-yellow-400" },
              { href: "/culture-tools", label: "Culture Tools (AI)", Icon: Sparkles, color: "text-violet-400" },
            ].map(({ href, label, Icon, color }) => (
              <Link key={href} href={href} onClick={() => setMobileMenuOpen(false)}>
                <button className={cn("mobile-menu-item flex items-center gap-3 w-full px-5 py-3 text-sm font-medium transition-colors relative", isActive(href) ? "text-primary bg-primary/8 font-semibold" : "text-foreground hover:bg-muted")}>
                  <Icon size={17} className={cn("shrink-0", color)} />
                  <span className="flex-1 text-left">{label}</span>
                </button>
              </Link>
            ))}
            <div className="h-px mx-4 my-1" style={{ background: "hsl(var(--border))" }} />

            {/* BTTS — mobile */}
            <Link href="/back-to-the-street">
              <button
                className={cn(
                  "mobile-menu-item flex items-center gap-3 w-full px-5 py-3.5 text-sm font-bold transition-colors relative border-y",
                  isActive("/back-to-the-street")
                    ? "border-orange-500/40 bg-gradient-to-r from-orange-500/20 to-red-500/15"
                    : "border-orange-500/20 bg-gradient-to-r from-orange-500/6 to-red-500/4 hover:from-orange-500/12 hover:to-red-500/8"
                )}
                style={{ animationDelay: `${navigationLinks.length * 0.045}s` }}
              >
                <Flame size={19} className="text-orange-400 shrink-0" />
                <span className="flex-1 text-left font-black tracking-wide text-orange-400">
                  Back to the Street
                </span>
              </button>
            </Link>

            {/* Instagram Studio — mobile, admin only */}
            {isAdmin && igStatus?.connected && (
              <Link href="/admin/instagram">
                <button
                  className={cn(
                    "mobile-menu-item flex items-center gap-3 w-full px-5 py-3.5 text-sm font-bold transition-colors relative border-y",
                    isActive("/admin/instagram")
                      ? "border-pink-400/40 bg-gradient-to-r from-purple-500/15 via-pink-500/12 to-orange-400/10"
                      : "border-pink-400/20 bg-gradient-to-r from-purple-500/6 via-pink-500/5 to-orange-400/5 hover:from-purple-500/12 hover:via-pink-500/10 hover:to-orange-400/8"
                  )}
                  style={{ animationDelay: `${(navigationLinks.length + 1) * 0.045}s` }}
                >
                  {igStatus.profilePictureUrl ? (
                    <img
                      src={`/api/instagram/proxy-image?url=${encodeURIComponent(igStatus.profilePictureUrl)}`}
                      className="w-5 h-5 rounded-full object-cover shrink-0"
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <SiInstagram size={19} className="text-pink-500 shrink-0" />
                  )}
                  <span className="flex-1 text-left bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 bg-clip-text text-transparent">
                    Instagram Studio
                  </span>
                  <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                </button>
              </Link>
            )}

            {user && (
              <>
                <div className="h-px mx-4 my-1" style={{ background: "hsl(var(--border))" }} />
                <Link href={`/profile/${user.id}`}>
                  <button className="mobile-menu-item flex items-center gap-3 w-full px-5 py-3.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">
                    <User size={19} className="text-primary shrink-0" />
                    <span className="flex-1 text-left">{t("nav.profile")}</span>
                  </button>
                </Link>
                <Link href="/chat">
                  <button className="mobile-menu-item flex items-center gap-3 w-full px-5 py-3.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">
                    <MessageCircle size={19} className="text-primary shrink-0" />
                    <span className="flex-1 text-left">{t("nav.messages")}</span>
                    {unreadCount > 0 && (
                      <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground px-1">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                </Link>
                <div className="h-px mx-4 my-1" style={{ background: "hsl(var(--border))" }} />
                <button
                  onClick={() => { toggleDarkMode(); setMobileMenuOpen(false); }}
                  className="mobile-menu-item flex items-center gap-3 w-full px-5 py-3.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  {isDarkMode ? <Sun size={19} className="text-muted-foreground shrink-0" /> : <Moon size={19} className="text-muted-foreground shrink-0" />}
                  <span className="flex-1 text-left">{isDarkMode ? t("nav.lightMode") : t("nav.darkMode")}</span>
                </button>
                <button
                  onClick={() => { handleSignOut(); setMobileMenuOpen(false); }}
                  className="mobile-menu-item flex items-center gap-3 w-full px-5 py-3.5 text-sm font-medium text-red-500 hover:bg-red-500/8 transition-colors"
                >
                  <LogOut size={19} className="shrink-0" />
                  <span className="flex-1 text-left">{t("nav.signOut")}</span>
                </button>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
