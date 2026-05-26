import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Home, Users, MessageCircle, User, Film, Sparkles, MapPin } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUnreadMessages } from "@/hooks/use-unread-messages";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

export default function BottomNav() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { unreadMessages } = useUnreadMessages();
  const { unreadCount } = useNotifications();
  const { t } = useLanguage();

  const unreadMsgCount = unreadMessages?.length ?? 0;

  const [bouncingTab, setBouncingTab]  = useState<string | null>(null);
  const [tappingTab,  setTappingTab]   = useState<string | null>(null);
  const [ripplingTab, setRipplingTab]  = useState<string | null>(null);

  const isActive = (path: string) =>
    path === "/" ? location === "/" : location.startsWith(path);

  const tabs = useMemo(() => [
    { href: "/",              icon: Home,          label: t("nav.home") },
    { href: "/map",           icon: MapPin,         label: "Map" },
    { href: "/reels",         icon: Film,           label: t("nav.reels") },
    { href: "/community",     icon: Users,          label: t("nav.community") },
    { href: "/ai-assistant",  icon: Sparkles,       label: "AI", isAI: true },
    { href: "/chat",          icon: MessageCircle,  label: t("nav.chat"), badge: unreadMsgCount },
    {
      href:  user ? `/profile/${user.id}` : "/auth",
      icon:  User,
      label: user ? t("nav.profile") : t("nav.signIn"),
    },
  ], [user, unreadMsgCount, t]);

  /* Active tab index — drives the sliding pill */
  const activeIndex = useMemo(
    () => tabs.findIndex(tab => isActive(tab.href)),
    [location, tabs]
  );

  /* Bounce icon on every route change */
  useEffect(() => {
    const active = tabs[activeIndex];
    if (!active) return;
    setBouncingTab(active.href);
    const tid = setTimeout(() => setBouncingTab(null), 520);
    return () => clearTimeout(tid);
  }, [location]);

  /* Tap handler */
  const handleTap = useCallback((href: string) => {
    setTappingTab(href);
    setRipplingTab(href);
    const t1 = setTimeout(() => setTappingTab(null),  400);
    const t2 = setTimeout(() => setRipplingTab(null), 520);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const tabCount = tabs.length;

  return (
    <nav
      className="bottom-nav-enter fixed bottom-0 inset-x-0 z-50 md:hidden bg-background/95 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* Prismatic top line — matches header */}
      <div className="header-prism-line" style={{ bottom: "auto", top: 0 }} aria-hidden="true" />

      <div className="relative flex items-center justify-around h-[60px] px-0.5">

        {/* ── Sliding active pill (absolute, slides with CSS transition) ── */}
        {activeIndex >= 0 && (
          <div
            className="bottom-nav-sliding-pill"
            aria-hidden="true"
            style={{
              left:  `calc(${activeIndex} / ${tabCount} * 100% + 2px)`,
              width: `calc(100% / ${tabCount} - 4px)`,
            }}
          />
        )}

        {tabs.map(({ href, icon: Icon, label, badge, isAI }, index) => {
          const active      = isActive(href);
          const isBouncing  = bouncingTab === href;
          const isTapping   = tappingTab  === href;
          const isRippling  = ripplingTab === href;
          const showCommunityBadge = label === "Community" && unreadCount > 0;

          return (
            <Link key={href} href={href}>
              <div
                data-testid={`bottomnav-${label.toLowerCase().replace(/\s/g, "-")}`}
                onClick={() => handleTap(href)}
                className="bottom-nav-item-in relative flex flex-col items-center justify-center gap-[2px] w-full h-[52px] select-none cursor-pointer z-10"
                style={{
                  width: `calc(100vw / ${tabCount})`,
                  animationDelay: `${0.1 + index * 0.06}s`,
                }}
              >
                {/* Icon container with ripple on tap */}
                <div
                  className={cn(
                    "relative flex items-center justify-center w-8 h-6 rounded-full transition-all duration-200",
                    isRippling && "tap-ripple"
                  )}
                >
                  <Icon
                    size={active ? 19 : 17}
                    strokeWidth={active ? 2.3 : 1.7}
                    className={cn(
                      "transition-all duration-200",
                      isAI
                        ? "ai-sparkle-icon"
                        : active
                        ? "text-primary icon-active-glow"
                        : "text-muted-foreground",
                      isBouncing && !isAI && "icon-active-bounce",
                      isTapping  && !isAI && "tap-spring"
                    )}
                  />

                  {/* Message badge */}
                  {badge != null && badge > 0 && (
                    <span className="absolute -top-1 -right-0.5 flex h-[13px] min-w-[13px] items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white px-[2px] leading-none">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}

                  {/* Community badge */}
                  {showCommunityBadge && (
                    <span className="absolute -top-1 -right-0.5 flex h-[13px] min-w-[13px] items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white px-[2px] leading-none">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </div>

                {/* Label */}
                <span
                  className={cn(
                    "text-[9px] leading-none font-medium transition-all duration-200",
                    active ? "label-active-in font-semibold" : "text-muted-foreground"
                  )}
                >
                  {label}
                </span>

                {/* Active indicator dot — spins in then pulses */}
                {active && (
                  <span
                    key={location}
                    className="active-dot-in active-dot-pulse absolute top-0.5 left-1/2 w-1 h-1 rounded-full bg-primary"
                  />
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
