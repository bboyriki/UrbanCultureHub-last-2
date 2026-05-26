import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Sparkles, Lock, Unlock, Users, Settings, Crown, Mail,
  CreditCard, Search, Loader2, Shield, CheckCircle, XCircle,
  ToggleLeft, ToggleRight, Euro, Info
} from "lucide-react";

interface AIUser {
  id: number;
  displayName: string;
  email: string;
  role: string;
  isAiPremium: boolean;
  profilePicture?: string;
  createdAt: string;
}

interface AISettings {
  mode: "contact_admin" | "subscription";
  subscriptionEnabled: boolean;
  monthlyPriceEur: string;
}

export default function AdminAIAccessPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [priceInput, setPriceInput] = useState<string | null>(null);
  const [pendingToggle, setPendingToggle] = useState<number | null>(null);

  const { data: settings, isLoading: settingsLoading } = useQuery<AISettings>({
    queryKey: ["/api/admin/ai-access/settings"],
    queryFn: async () => {
      const res = await apiRequest("/api/admin/ai-access/settings", "GET");
      return res.json();
    },
  });

  const { data: userList = [], isLoading: usersLoading } = useQuery<AIUser[]>({
    queryKey: ["/api/admin/ai-access/users"],
    queryFn: async () => {
      const res = await apiRequest("/api/admin/ai-access/users", "GET");
      return res.json();
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (patch: Partial<AISettings & { monthlyPriceEur: string }>) => {
      const res = await apiRequest("/api/admin/ai-access/settings", "POST", patch);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/ai-access/settings"] });
      toast({ title: "Settings updated" });
    },
    onError: () => toast({ title: "Failed to update settings", variant: "destructive" }),
  });

  const grantAccess = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest(`/api/admin/ai-access/grant/${userId}`, "POST", {});
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/ai-access/users"] });
      setPendingToggle(null);
    },
    onError: () => { toast({ title: "Failed to grant access", variant: "destructive" }); setPendingToggle(null); },
  });

  const revokeAccess = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest(`/api/admin/ai-access/revoke/${userId}`, "POST", {});
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/ai-access/users"] });
      setPendingToggle(null);
    },
    onError: () => { toast({ title: "Failed to revoke access", variant: "destructive" }); setPendingToggle(null); },
  });

  const handleToggleUser = (user: AIUser) => {
    setPendingToggle(user.id);
    if (user.isAiPremium) revokeAccess.mutate(user.id);
    else grantAccess.mutate(user.id);
  };

  const handleModeToggle = (newMode: "contact_admin" | "subscription") => {
    updateSettings.mutate({ mode: newMode });
  };

  const handleSubEnabledToggle = (enabled: boolean) => {
    updateSettings.mutate({ subscriptionEnabled: enabled });
  };

  const handlePriceSave = () => {
    if (!priceInput) return;
    const val = parseFloat(priceInput);
    if (isNaN(val) || val <= 0) {
      toast({ title: "Invalid price", description: "Enter a positive number", variant: "destructive" });
      return;
    }
    updateSettings.mutate({ monthlyPriceEur: priceInput });
    setPriceInput(null);
  };

  const filteredUsers = userList.filter(u =>
    u.displayName.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const premiumCount = userList.filter(u => u.isAiPremium || u.role === "admin").length;
  const isSubscriptionMode = settings?.mode === "subscription";

  if (settingsLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">AI Premium Access</h1>
            <p className="text-sm text-muted-foreground">Control who can use AI features and how they get access</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-background border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-primary">{premiumCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Premium users</p>
          </div>
          <div className="bg-background border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold">{userList.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total users</p>
          </div>
          <div className="bg-background border border-border rounded-xl p-4 text-center col-span-2 sm:col-span-1">
            <Badge className={`text-sm px-3 py-1 ${isSubscriptionMode ? "bg-green-500/10 text-green-600 border-green-500/20" : "bg-blue-500/10 text-blue-600 border-blue-500/20"}`}>
              {isSubscriptionMode ? "Self-Service Mode" : "Contact Admin Mode"}
            </Badge>
          </div>
        </div>

        {/* ── Access Mode Toggle ──────────────────────────────────────── */}
        <div className="bg-background border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
            <Settings className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">Access Mode</h2>
            <span className="text-xs text-muted-foreground ml-auto">Switch between the two modes below</span>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 p-4">
            {/* Mode A: Contact Admin */}
            <button
              onClick={() => handleModeToggle("contact_admin")}
              disabled={updateSettings.isPending}
              className={`text-left rounded-xl border-2 p-4 transition-all ${!isSubscriptionMode ? "border-primary bg-primary/5" : "border-border bg-muted/20 hover:border-primary/40"}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Mail className={`w-5 h-5 ${!isSubscriptionMode ? "text-primary" : "text-muted-foreground"}`} />
                <span className="font-semibold text-sm">Contact Admin</span>
                {!isSubscriptionMode && <Badge className="ml-auto text-xs bg-primary text-primary-foreground">Active</Badge>}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Users see a locked state with a "Contact admin" message. You manually grant access one-by-one from the user list below.
              </p>
            </button>

            {/* Mode B: Paid Subscription */}
            <button
              onClick={() => handleModeToggle("subscription")}
              disabled={updateSettings.isPending}
              className={`text-left rounded-xl border-2 p-4 transition-all ${isSubscriptionMode ? "border-primary bg-primary/5" : "border-border bg-muted/20 hover:border-primary/40"}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className={`w-5 h-5 ${isSubscriptionMode ? "text-primary" : "text-muted-foreground"}`} />
                <span className="font-semibold text-sm">Paid Subscription</span>
                {isSubscriptionMode && <Badge className="ml-auto text-xs bg-primary text-primary-foreground">Active</Badge>}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Users can buy AI access themselves via Stripe. You can still manually grant or revoke access from the list below.
              </p>
            </button>
          </div>

          {/* Subscription sub-settings */}
          {isSubscriptionMode && (
            <div className="border-t border-border p-4 space-y-4 bg-muted/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Enable subscription purchases</p>
                  <p className="text-xs text-muted-foreground">When OFF, the "Buy" button is hidden even in subscription mode</p>
                </div>
                <Switch
                  checked={settings?.subscriptionEnabled ?? false}
                  onCheckedChange={handleSubEnabledToggle}
                  disabled={updateSettings.isPending}
                  data-testid="switch-subscription-enabled"
                />
              </div>

              {settings?.subscriptionEnabled && (
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Monthly price (EUR)</label>
                    <div className="relative">
                      <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        type="number"
                        step="0.01"
                        min="0.50"
                        value={priceInput ?? settings?.monthlyPriceEur ?? "9.99"}
                        onChange={e => setPriceInput(e.target.value)}
                        className="pl-8"
                        data-testid="input-subscription-price"
                      />
                    </div>
                  </div>
                  <Button size="sm" onClick={handlePriceSave} disabled={!priceInput || updateSettings.isPending}>
                    Save price
                  </Button>
                </div>
              )}

              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30">
                <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Subscription uses Stripe. Make sure your Stripe secret key and webhook are configured. Users are billed monthly and can cancel anytime.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── User List ────────────────────────────────────────────────── */}
        <div className="bg-background border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-wrap gap-y-2">
            <Users className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">Users</h2>
            <div className="ml-auto relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search users…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm w-48"
                data-testid="input-search-users"
              />
            </div>
          </div>

          {usersLoading ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredUsers.length === 0 ? (
                <p className="text-center py-8 text-sm text-muted-foreground">No users found</p>
              ) : (
                filteredUsers.map(u => {
                  const isAdmin = u.role === "admin";
                  const hasPremium = isAdmin || u.isAiPremium;
                  const isPending = pendingToggle === u.id;
                  return (
                    <div key={u.id} className="flex items-center gap-3 px-5 py-3" data-testid={`row-ai-user-${u.id}`}>
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground shrink-0 overflow-hidden">
                        {u.profilePicture
                          ? <img src={u.profilePicture} alt="" className="w-full h-full object-cover" />
                          : u.displayName.charAt(0).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-medium truncate">{u.displayName}</span>
                          {isAdmin && (
                            <Badge variant="outline" className="text-xs px-1.5 border-purple-400/40 text-purple-600 dark:text-purple-400">
                              <Shield className="w-2.5 h-2.5 mr-1" /> Admin
                            </Badge>
                          )}
                          {u.isAiPremium && !isAdmin && (
                            <Badge variant="outline" className="text-xs px-1.5 border-amber-400/40 text-amber-600 dark:text-amber-400">
                              <Crown className="w-2.5 h-2.5 mr-1" /> AI Premium
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>

                      {/* Toggle */}
                      {isAdmin ? (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5 text-green-500" /> Always on
                        </span>
                      ) : (
                        <button
                          onClick={() => handleToggleUser(u)}
                          disabled={isPending}
                          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${hasPremium
                            ? "bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-600"
                            : "bg-muted/50 border-border text-muted-foreground hover:bg-primary/10 hover:border-primary/30 hover:text-primary"
                          }`}
                          data-testid={`button-toggle-ai-${u.id}`}
                        >
                          {isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : hasPremium ? (
                            <><Unlock className="w-3.5 h-3.5" /> Revoke</>
                          ) : (
                            <><Lock className="w-3.5 h-3.5" /> Grant</>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
