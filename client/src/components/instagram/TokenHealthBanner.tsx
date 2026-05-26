import { useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, AlertTriangle, AlertOctagon, RefreshCw, Loader2,
  ShieldCheck, ShieldAlert, ShieldX, ChevronDown, ExternalLink, Trash2,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface CapabilityRow {
  label: string;
  ok: boolean;
  reason?: string;
}

interface HealthResponse {
  connected: boolean;
  account?: {
    username: string;
    accountType: string | null;
    followersCount: number | null;
    mediaCount: number | null;
  };
  token: {
    valid: boolean;
    expiresAt: string | null;
    daysRemaining: number | null;
    connectedAt?: string;
    updatedAt?: string;
    canRefresh?: boolean;
    invalidReason?: string | null;
    fbCode?: number | null;
    fbSubcode?: number | null;
  };
  capabilities: Record<string, CapabilityRow>;
}

/**
 * Top-of-page strip that surfaces the single most important fact about the
 * Instagram admin: is the token alive, and what can it actually do right
 * now. Replaces the old "feature looks alive but isn't" experience.
 */
export default function TokenHealthBanner() {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading, refetch } = useQuery<HealthResponse>({
    queryKey: ["/api/instagram/health"],
    // Pause auto-refetch once we know the token is dead — no point hammering
    // a known-bad token; the user must reconnect manually anyway.
    refetchInterval: (q) => {
      const d = q.state.data as HealthResponse | undefined;
      if (d && d.connected && !d.token.valid) return false;
      return 5 * 60 * 1000;
    },
    staleTime: 60 * 1000,
    retry: 1,
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("/api/instagram/disconnect", "POST");
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Disconnect failed");
      return j;
    },
    onSuccess: () => {
      toast({
        title: "Dead connection removed",
        description: "Now reconnect your Instagram account below.",
      });
      // Invalidate everything Instagram-related so stale 'connected' state
      // doesn't keep dependent queries firing.
      [
        "/api/instagram/health",
        "/api/instagram/status",
        "/api/instagram/account",
        "/api/instagram/accounts",
        "/api/instagram/media",
        "/api/instagram/insights",
        "/api/instagram/audience",
        "/api/instagram/analytics/media",
      ].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      // Scroll to the connect form (lives inside the profile zone)
      window.dispatchEvent(new CustomEvent("ig-go-zone", { detail: "profile" }));
      requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }));
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't remove the connection",
        description: err?.message || "Try again.",
        variant: "destructive",
      });
    },
  });

  const goReconnect = () => {
    window.dispatchEvent(new CustomEvent("ig-go-zone", { detail: "profile" }));
    requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }));
  };

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("/api/instagram/refresh-token", "POST");
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json?.error || "Refresh failed");
      return json;
    },
    onSuccess: (res: any) => {
      toast({
        title: "Token extended",
        description: `Valid for another ${res?.daysRemaining ?? 60} days.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/health"] });
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/account"] });
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/accounts"] });
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't extend the token",
        description: err?.message || "Reconnect the account instead.",
        variant: "destructive",
      });
    },
  });

  const status = useMemo(() => {
    if (!data || !data.connected) return "disconnected";
    if (!data.token.valid) return "invalid";
    const days = data.token.daysRemaining;
    if (days !== null && days <= 7) return "critical";
    if (days !== null && days <= 14) return "warning";
    return "healthy";
  }, [data]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-zinc-900/40 backdrop-blur-sm px-4 py-3 mb-4 flex items-center gap-3 text-sm text-white/60">
        <Loader2 className="w-4 h-4 animate-spin" />
        Checking Instagram connection…
      </div>
    );
  }
  if (!data) return null;

  const palette = {
    healthy: {
      ring: "ring-emerald-500/30",
      bg: "from-emerald-500/15 via-emerald-500/5 to-transparent",
      icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
      title: "Instagram is connected and healthy",
      tone: "text-emerald-300",
    },
    warning: {
      ring: "ring-amber-500/30",
      bg: "from-amber-500/15 via-amber-500/5 to-transparent",
      icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
      title: "Token expires soon — extend it now",
      tone: "text-amber-300",
    },
    critical: {
      ring: "ring-orange-500/40",
      bg: "from-orange-500/20 via-orange-500/5 to-transparent",
      icon: <AlertTriangle className="w-5 h-5 text-orange-400" />,
      title: "Token expires in less than a week",
      tone: "text-orange-300",
    },
    invalid: {
      ring: "ring-rose-500/40",
      bg: "from-rose-500/20 via-rose-500/5 to-transparent",
      icon: <ShieldX className="w-5 h-5 text-rose-400" />,
      title: "Token is invalid — reconnect the account",
      tone: "text-rose-300",
    },
    disconnected: {
      ring: "ring-zinc-500/30",
      bg: "from-zinc-500/15 via-zinc-500/5 to-transparent",
      icon: <ShieldAlert className="w-5 h-5 text-zinc-300" />,
      title: "No Instagram account connected",
      tone: "text-zinc-300",
    },
  }[status];

  const caps = Object.values(data.capabilities || {});
  const okCount = caps.filter(c => c.ok).length;
  const totalCount = caps.length;

  return (
    <div
      data-testid="ig-health-banner"
      className={cn(
        "relative rounded-2xl mb-4 ring-1 backdrop-blur-sm overflow-hidden",
        palette.ring,
      )}
      style={{
        background:
          "linear-gradient(180deg, rgba(24,24,27,0.85) 0%, rgba(24,24,27,0.6) 100%)",
      }}
    >
      <div
        className={cn("absolute inset-0 bg-gradient-to-br pointer-events-none", palette.bg)}
      />

      <div className="relative px-4 sm:px-5 py-3 sm:py-4">
        <div className="flex items-start sm:items-center gap-3 flex-wrap">
          <div className="shrink-0 w-9 h-9 rounded-xl bg-black/40 ring-1 ring-white/10 flex items-center justify-center">
            {palette.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={cn("font-semibold text-sm sm:text-base", palette.tone)}>
                {palette.title}
              </h3>
              {data.connected && data.token.daysRemaining !== null && (
                <Badge
                  variant="outline"
                  className="border-white/15 bg-black/30 text-white/70 text-[10px]"
                  data-testid="ig-token-days"
                >
                  {data.token.daysRemaining}d left
                </Badge>
              )}
              {data.connected && (
                <Badge
                  variant="outline"
                  className={cn(
                    "border-white/15 bg-black/30 text-[10px]",
                    okCount === totalCount ? "text-emerald-300" : "text-white/70",
                  )}
                  data-testid="ig-cap-summary"
                >
                  {okCount}/{totalCount} features available
                </Badge>
              )}
              {data.account?.username && (
                <span className="text-xs text-white/50">
                  @{data.account.username}
                </span>
              )}
            </div>
            <p className="text-xs text-white/55 mt-1 leading-relaxed">
              {status === "healthy" &&
                "All Graph API capabilities are responding. The marketplace below is using live data."}
              {status === "warning" &&
                "Long-lived tokens last 60 days. Extend now to stay connected — one click, no login required."}
              {status === "critical" &&
                "Extend the token now to avoid downtime. After expiry you'll need a full reconnect."}
              {status === "invalid" && (() => {
                const r = data?.token?.invalidReason;
                const fbCode = data?.token?.fbCode;
                const fbSub = data?.token?.fbSubcode;
                if (r === "password_changed")
                  return "Your Instagram/Facebook password was changed, which immediately invalidates all tokens. Generate a new access token to reconnect.";
                if (r === "token_expired")
                  return `Token expired (Facebook error 190/${fbSub ?? ""}). The stored expiry was approximate — generate a fresh long-lived token via Graph API Explorer.`;
                if (r === "revoked")
                  return "The token was revoked — you may have removed the app from your Instagram settings, or Facebook flagged the session. Reconnect to restore.";
                if (r === "rate_limited")
                  return "Facebook rate-limited the health check (error " + (fbCode ?? "") + "). Wait a few minutes and click Recheck — your token may still be valid.";
                if (r === "oauth_invalid")
                  return `Token rejected by Facebook (error 190/${fbSub ?? ""}). Generate a fresh long-lived token via the Graph API Explorer and reconnect.`;
                return "Facebook invalidated the session — usually because the password was changed or 2FA was reset. Remove the dead connection and reconnect to restore the feature.";
              })()}
              {status === "disconnected" &&
                "Connect an Instagram Business or Creator account to start using the studio, analytics and automation."}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => refetch()}
              className="text-white/70 hover:text-white hover:bg-white/10"
              data-testid="button-ig-recheck"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Recheck
            </Button>
            {(status === "warning" || status === "critical") && data.token.canRefresh && (
              <Button
                size="sm"
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending}
                className="bg-amber-500 hover:bg-amber-400 text-black font-semibold"
                data-testid="button-ig-extend"
              >
                {refreshMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                )}
                Extend 60 days
              </Button>
            )}
            {status === "invalid" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                className="border-rose-500/40 text-rose-300 hover:bg-rose-500/10"
                data-testid="button-ig-disconnect"
              >
                {disconnectMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                )}
                Remove dead
              </Button>
            )}
            {(status === "invalid" || status === "disconnected") && (
              <Button
                size="sm"
                onClick={goReconnect}
                className="bg-gradient-to-r from-pink-500 to-purple-500 hover:opacity-90 text-white"
                data-testid="button-ig-reconnect"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                {status === "invalid" ? "Reconnect" : "Connect account"}
              </Button>
            )}
            {data.connected && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setExpanded(v => !v)}
                className="text-white/60 hover:text-white hover:bg-white/10"
                data-testid="button-ig-cap-toggle"
              >
                <ChevronDown className={cn("w-4 h-4 transition-transform", expanded && "rotate-180")} />
              </Button>
            )}
          </div>
        </div>

        {expanded && data.connected && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {Object.entries(data.capabilities).map(([key, c]) => (
                <div
                  key={key}
                  data-testid={`ig-cap-${key}`}
                  className={cn(
                    "flex items-start gap-2 px-3 py-2 rounded-lg border text-xs",
                    c.ok
                      ? "border-emerald-500/20 bg-emerald-500/5"
                      : "border-white/10 bg-black/20",
                  )}
                >
                  {c.ok ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertOctagon className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <div className={cn("font-medium", c.ok ? "text-emerald-200" : "text-white/70")}>
                      {c.label}
                    </div>
                    {!c.ok && c.reason && (
                      <div className="text-[10px] text-white/45 mt-0.5 line-clamp-2">
                        {c.reason}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-white/40 mt-3">
              Capabilities are probed live with single-record sample calls — they reflect what the
              current token can actually do right now. Anything marked unavailable is gracefully
              hidden or replaced with derived data elsewhere in the dashboard.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
