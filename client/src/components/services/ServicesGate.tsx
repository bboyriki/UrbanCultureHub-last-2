import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Lock, Sparkles, ArrowLeft, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type AppSetting = { key: string; value: string };

const SETTING_KEY = "talent_marketplace_locked";

export function useServicesAccess() {
  const { user } = useAuth();
  const { data: appSettings, isLoading } = useQuery<AppSetting[] | Record<string, string>>({
    queryKey: ["/api/app-settings"],
    staleTime: 5 * 60 * 1000,
  });

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  let lockedValue: string | undefined;
  if (Array.isArray(appSettings)) {
    lockedValue = appSettings.find(s => s.key === SETTING_KEY)?.value;
  } else if (appSettings && typeof appSettings === "object") {
    lockedValue = (appSettings as Record<string, string>)[SETTING_KEY];
  }
  // Default to LOCKED if the setting hasn't been created yet — fail safe.
  const isLocked = (lockedValue ?? "true") === "true";

  return {
    isLoading,
    isAdmin,
    isLocked,
    canAccess: isAdmin || !isLocked,
  };
}

interface ServicesGateProps {
  children: ReactNode;
  /** Optional override for the lock screen title. */
  title?: string;
  /** Optional override for the lock screen subtitle. */
  subtitle?: string;
}

/**
 * Gates any service / booking surface behind the talent_marketplace_locked
 * setting. Admins always pass through. Everyone else sees a polished
 * "Coming Soon" screen instead of a broken page.
 */
export default function ServicesGate({ children, title, subtitle }: ServicesGateProps) {
  const { isLoading, canAccess, isAdmin } = useServicesAccess();

  if (isLoading) {
    return (
      <div className="min-h-[60svh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (canAccess) {
    return (
      <>
        {isAdmin && (
          <div
            className="bg-amber-500/10 border-b border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs py-1.5 px-4 text-center"
            data-testid="services-admin-banner"
          >
            <Sparkles className="w-3 h-3 inline-block mr-1.5 -mt-0.5" />
            Admin preview — the Talent Marketplace is currently hidden from regular users.
          </div>
        )}
        {children}
      </>
    );
  }

  return (
    <div
      className="min-h-[80svh] flex flex-col items-center justify-center px-6 text-center"
      data-testid="services-gate-locked"
    >
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/30 to-violet-600/30 flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/10">
          <Lock className="w-9 h-9 text-primary" />
        </div>
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
          <span className="text-[9px] font-black text-black">!</span>
        </div>
      </div>
      <Badge className="mb-4 px-3 py-1 text-[11px] font-semibold tracking-widest uppercase bg-primary/10 text-primary border border-primary/20">
        Coming Soon
      </Badge>
      <h1 className="text-3xl sm:text-4xl font-black mb-3 tracking-tight">
        {title ?? "Talent Marketplace"}
      </h1>
      <p className="text-muted-foreground max-w-md text-base leading-relaxed mb-8">
        {subtitle ??
          "Bookings and service tools are still being prepared. We'll open this up to the community very soon — keep an eye on the announcements."}
      </p>
      <Button asChild variant="outline" data-testid="services-gate-back">
        <Link href="/">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to the app
        </Link>
      </Button>
    </div>
  );
}
