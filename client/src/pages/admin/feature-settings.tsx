import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, ArrowLeft, Settings2, Film, Eye, EyeOff, RefreshCw, Shield, Smartphone, ShoppingBag, Lock, Unlock } from "lucide-react";

type SettingRow = { id: number; key: string; value: string; label: string; description: string | null; updatedAt: string };

const DEFAULT_SETTINGS: Array<{
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
  defaultValue: string;
  badge?: { on: string; off: string };
  superAdminOnly?: boolean;
}> = [
  {
    key: "reels_guests_visible",
    label: "Reels visible to guests",
    description: "When OFF, non-logged-in visitors cannot access the Reels section. They will be prompted to sign in.",
    icon: Film,
    defaultValue: "false",
  },
  {
    key: "talent_marketplace_locked",
    label: "Talent Marketplace — User Access",
    description: "When ON (default), the Talent & Service Marketplace is locked to regular users — they see a 'Coming Soon' page. Admins always have full access. Turn OFF to open it publicly.",
    icon: ShoppingBag,
    defaultValue: "true",
    badge: { on: "Locked (users see Coming Soon)", off: "Open to all users" },
  },
  {
    key: "ios_tracking_enabled",
    label: "iOS App Analytics",
    description: "Controls whether anonymous analytics data (page views, session info) is silently collected from iOS app users. The cookie consent banner is NEVER shown on iOS — Apple App Store rules require that. When ON, analytics runs in the background with no prompt; when OFF, all tracking is blocked. Disclose any data collection in App Store Connect → App Privacy.",
    icon: Smartphone,
    defaultValue: "false",
    badge: { on: "Analytics ON (silent)", off: "Analytics OFF" },
    superAdminOnly: true,
  },
];

export default function FeatureSettingsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  if (!user || !["admin", "super_admin"].includes(user.role)) {
    navigate("/");
    return null;
  }

  const { data: rows = [], isLoading } = useQuery<SettingRow[]>({
    queryKey: ["/api/admin/app-settings"],
    queryFn: async () => {
      const res = await apiRequest("/api/admin/settings", "GET");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ key, value, label, description }: { key: string; value: string; label: string; description: string }) =>
      apiRequest("/api/admin/settings", "POST", { key, value, label, description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/app-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/app-settings"] });
      toast({ title: "Setting updated", description: "Changes are live immediately." });
    },
    onError: () => {
      toast({ title: "Update failed", description: "Please try again.", variant: "destructive" });
    },
  });

  function getValue(key: string, defaultValue: string): string {
    const row = rows.find((r) => r.key === key);
    return row ? row.value : defaultValue;
  }

  function getUpdatedAt(key: string): string | null {
    const row = rows.find((r) => r.key === key);
    return row ? row.updatedAt : null;
  }

  function handleToggle(key: string, label: string, description: string, newVal: boolean) {
    updateMutation.mutate({ key, value: String(newVal), label, description });
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 max-w-2xl mx-auto">
      {/* Back */}
      <button
        onClick={() => navigate("/admin")}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-6 transition-colors"
        data-testid="button-back-admin"
      >
        <ArrowLeft size={16} /> Back to Admin
      </button>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Settings2 size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Feature Settings</h1>
          <p className="text-muted-foreground text-sm">Control visibility and access to app sections</p>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 mb-6">
        <Shield size={16} className="text-blue-400 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-300 leading-relaxed">
          Changes apply immediately to all users. Guests (not signed in) are treated as viewers with no role.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {DEFAULT_SETTINGS
            .filter((s) => !s.superAdminOnly || user?.role === "super_admin")
            .map((setting) => {
            const currentValue = getValue(setting.key, setting.defaultValue);
            const isOn = currentValue === "true";
            const updatedAt = getUpdatedAt(setting.key);
            const Icon = setting.icon;
            const isPending = updateMutation.isPending && updateMutation.variables?.key === setting.key;
            const badgeOn = setting.badge?.on ?? "Visible";
            const badgeOff = setting.badge?.off ?? "Hidden";

            return (
              <Card key={setting.key} className="border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${isOn ? "bg-emerald-500/15" : "bg-zinc-500/15"}`}>
                        <Icon size={16} className={isOn ? "text-emerald-400" : "text-zinc-400"} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-base">{setting.label}</CardTitle>
                          {setting.superAdminOnly && (
                            <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-400 px-1.5 py-0">
                              Super Admin
                            </Badge>
                          )}
                          <Badge variant={isOn ? "default" : "secondary"} className={isOn ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : ""}>
                            {isOn ? badgeOn : badgeOff}
                          </Badge>
                        </div>
                        <CardDescription className="text-xs mt-0.5">{setting.description}</CardDescription>
                      </div>
                    </div>

                    {isPending
                      ? <Loader2 size={20} className="animate-spin text-muted-foreground shrink-0 mt-1" />
                      : <Switch
                          checked={isOn}
                          onCheckedChange={(val) => handleToggle(setting.key, setting.label, setting.description, val)}
                          data-testid={`toggle-${setting.key}`}
                        />
                    }
                  </div>
                </CardHeader>

                {updatedAt && (
                  <>
                    <Separator />
                    <CardContent className="pt-2 pb-3">
                      <p className="text-[11px] text-muted-foreground">
                        Last updated: {new Date(updatedAt).toLocaleString()}
                      </p>
                    </CardContent>
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
