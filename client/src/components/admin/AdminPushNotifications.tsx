import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  Bell, BellOff, Smartphone, Monitor, Send, Trash2, RefreshCw,
  Users, CheckCircle, XCircle, Clock, Search, Zap,
  Globe, ChevronRight, AlertCircle, Loader2, ShieldCheck,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useLocation } from "wouter";
import NativeCheck from "@/pages/native-check";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface DeviceStat { total: number; ios: number; android: number; web: number; recentWeek: number; }
interface Device { id: number; userId: number; token: string; platform: string; createdAt: string; updatedAt: string; user: { displayName: string; email: string; profilePicture: string | null }; }
interface PushLog { id: number; sentBy: number | null; title: string; body: string; targetType: string; targetValue: string | null; sentCount: number; failedCount: number; iconUrl: string | null; actionUrl: string | null; createdAt: string; }
interface UserResult { id: number; displayName: string; email: string; profilePicture: string | null; }

type RegStatus = "idle" | "loading" | "success" | "error" | "blocked";

const platformIcon = (p: string) => {
  if (p === 'ios') return <Smartphone className="h-3.5 w-3.5 text-blue-400" />;
  if (p === 'android') return <Smartphone className="h-3.5 w-3.5 text-green-400" />;
  return <Monitor className="h-3.5 w-3.5 text-muted-foreground" />;
};

const platformLabel = (p: string) => {
  if (p === 'ios') return <Badge variant="outline" className="text-xs border-blue-500/40 text-blue-400 bg-blue-500/5">iOS</Badge>;
  if (p === 'android') return <Badge variant="outline" className="text-xs border-green-500/40 text-green-400 bg-green-500/5">Android</Badge>;
  return <Badge variant="outline" className="text-xs border-muted text-muted-foreground">Web</Badge>;
};

async function getFCMToken(): Promise<string> {
  const { initializeApp, getApps, getApp } = await import("firebase/app");
  const { getMessaging, getToken } = await import("firebase/messaging");
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const messaging = getMessaging(app);
  const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  const token = await getToken(messaging, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: swReg,
  });
  if (!token) throw new Error("FCM returned empty token — check VAPID key and Firebase project config");
  return token;
}

export default function AdminPushNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [targetType, setTargetType] = useState<'all' | 'segment' | 'user'>('all');
  const [segment, setSegment] = useState('all');
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [actionUrl, setActionUrl] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [deviceFilter, setDeviceFilter] = useState<'all' | 'ios' | 'android' | 'web'>('all');

  const [regStatus, setRegStatus] = useState<RegStatus>("idle");
  const [regError, setRegError] = useState<string>("");
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | "unknown">("unknown");
  const [diagnoseOpen, setDiagnoseOpen] = useState(false);
  const [, setLocation] = useLocation();

  function detectWTN(): boolean {
    try { return !!(window as any).WTN?.Firebase?.Messaging; }
    catch { return false; }
  }
  const [isWTN, setIsWTN] = useState<boolean>(detectWTN);
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  useEffect(() => {
    // Check immediately
    if ("Notification" in window) setNotifPerm(Notification.permission);
    // Re-check WTN after bridge has had time to inject
    const t = setTimeout(() => {
      const wtn = detectWTN();
      setIsWTN(wtn);
      if (wtn) setNotifPerm("granted");
      else if ("Notification" in window) setNotifPerm(Notification.permission);
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  const handleRegisterDevice = useCallback(async () => {
    setRegError("");
    setRegStatus("loading");

    const ua = navigator.userAgent;
    const platform = /iPhone|iPad|iPod/.test(ua) ? "ios" : /Android/.test(ua) ? "android" : "web";

    try {
      // ── WTN (iOS native) path ─────────────────────────────────────
      if (detectWTN()) {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("WTN getFCMToken timed out — check iOS bridge config")), 10000);
          (window as any).WTN.Firebase.Messaging.getFCMToken({
            callback: async (data: { token?: string }) => {
              clearTimeout(timeout);
              if (!data?.token) {
                reject(new Error("WTN bridge returned empty token — push permission may have been denied or APNs key missing in Firebase"));
                return;
              }
              try {
                const res = await apiRequest("/api/push/register", "POST", { token: data.token, platform });
                if (!res.ok) {
                  const text = await res.text();
                  reject(new Error(`Server rejected token (${res.status}): ${text}`));
                  return;
                }
                resolve();
              } catch (err) {
                reject(err);
              }
            },
          });
        });
        setRegStatus("success");
        setNotifPerm("granted");
        queryClient.invalidateQueries({ queryKey: ['/api/admin/push/stats'] });
        queryClient.invalidateQueries({ queryKey: ['/api/admin/push/devices'] });
        toast({ title: "iOS device registered!", description: "This iPhone is now set up to receive push notifications." });
        return;
      }

      // ── Web / browser path ────────────────────────────────────────
      if (!("Notification" in window)) {
        setRegStatus("error");
        setRegError("Push notifications are not supported in this browser. Use the iOS app or a desktop browser.");
        return;
      }
      if (Notification.permission === "denied") {
        setRegStatus("blocked");
        return;
      }
      if (Notification.permission !== "granted") {
        const perm = await Notification.requestPermission();
        setNotifPerm(perm);
        if (perm !== "granted") {
          setRegStatus(perm === "denied" ? "blocked" : "error");
          setRegError("Permission not granted.");
          return;
        }
      }
      const token = await getFCMToken();
      const res = await apiRequest("/api/push/register", "POST", { token, platform });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server rejected token (${res.status}): ${text}`);
      }
      setRegStatus("success");
      setNotifPerm("granted");
      queryClient.invalidateQueries({ queryKey: ['/api/admin/push/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/push/devices'] });
      toast({ title: "Device registered!", description: "This browser is now set up to receive push notifications." });
    } catch (err: any) {
      setRegStatus("error");
      const msg = err?.message || String(err);
      setRegError(msg);
      console.error("[Push Admin] Registration error:", err);
    }
  }, [queryClient, toast]);

  const statsQuery = useQuery<DeviceStat>({
    queryKey: ['/api/admin/push/stats'],
    queryFn: () => apiRequest('/api/admin/push/stats', 'GET').then(r => r.json()),
    refetchInterval: 30000,
  });

  const devicesQuery = useQuery<Device[]>({
    queryKey: ['/api/admin/push/devices'],
    queryFn: () => apiRequest('/api/admin/push/devices', 'GET').then(r => r.json()),
  });

  const historyQuery = useQuery<PushLog[]>({
    queryKey: ['/api/admin/push/history'],
    queryFn: () => apiRequest('/api/admin/push/history', 'GET').then(r => r.json()),
  });

  const userSearchQuery = useQuery<UserResult[]>({
    queryKey: ['/api/admin/push/users/search', userSearch],
    queryFn: () => apiRequest(`/api/admin/push/users/search?q=${encodeURIComponent(userSearch)}`, 'GET').then(r => r.json()),
    enabled: userSearch.length >= 2 && targetType === 'user' && !selectedUser,
    staleTime: 10000,
  });

  const [testPushStatus, setTestPushStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const handleTestPushSelf = useCallback(async () => {
    setTestPushStatus("loading");
    try {
      const res = await apiRequest("/api/admin/push/test-self", "POST");
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(err.message);
      }
      setTestPushStatus("ok");
      toast({ title: "Test push sent!", description: "Check your device for the notification." });
      setTimeout(() => setTestPushStatus("idle"), 4000);
    } catch (err: any) {
      setTestPushStatus("error");
      toast({ title: "Test push failed", description: err?.message || String(err), variant: "destructive" });
      setTimeout(() => setTestPushStatus("idle"), 4000);
    }
  }, [toast]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { title, body, targetType, actionUrl: actionUrl || undefined };
      if (targetType === 'segment') payload.targetValue = segment;
      if (targetType === 'user' && selectedUser) payload.targetValue = String(selectedUser.id);
      const res = await apiRequest('/api/admin/push/send', 'POST', payload);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Notification sent!',
        description: `Delivered to ${data.sentCount} device${data.sentCount !== 1 ? 's' : ''}${data.failedCount > 0 ? `, ${data.failedCount} failed` : ''}.`,
      });
      setTitle('');
      setBody('');
      setActionUrl('');
      setSelectedUser(null);
      setUserSearch('');
      setShowPreview(false);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/push/history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/push/stats'] });
    },
    onError: () => {
      toast({ title: 'Send failed', description: 'Could not send the notification. Try again.', variant: 'destructive' });
    },
  });

  const deleteDeviceMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/admin/push/devices/${id}`, 'DELETE').then(r => r.json()),
    onSuccess: () => {
      toast({ title: 'Device removed' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/push/devices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/push/stats'] });
    },
  });

  const stats = statsQuery.data;
  const devices = devicesQuery.data || [];
  const logs = historyQuery.data || [];
  const filteredDevices = deviceFilter === 'all' ? devices : devices.filter(d => d.platform === deviceFilter);

  const targetDescription = () => {
    if (targetType === 'all') return `All ${stats?.total ?? 0} registered devices`;
    if (targetType === 'segment') return `Segment: ${segment}`;
    if (targetType === 'user' && selectedUser) return `${selectedUser.displayName} (${selectedUser.email})`;
    return 'Select a user';
  };

  const canSend = title.trim() && body.trim() && (targetType !== 'user' || !!selectedUser) && !sendMutation.isPending;

  const isCurrentDeviceRegistered =
    regStatus === "success" ||
    (notifPerm === "granted" && (devicesQuery.data?.some(d => d.userId === user?.id) ?? false)) ||
    (isWTN && (devicesQuery.data?.some(d => d.userId === user?.id) ?? false));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-orange-500" />
            Push Notifications
          </h2>
          <p className="text-muted-foreground text-sm mt-0.5">Send and manage push notifications across all devices</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDiagnoseOpen(true)}
            data-testid="link-push-diagnostic"
          >
            <ShieldCheck className="h-4 w-4 mr-1.5 text-purple-500" /> iOS Diagnose
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/native-check")}
            data-testid="link-push-diagnostic-fullpage"
            title="Open diagnostics in full page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/admin/push/stats'] });
            queryClient.invalidateQueries({ queryKey: ['/api/admin/push/devices'] });
            queryClient.invalidateQueries({ queryKey: ['/api/admin/push/history'] });
          }} data-testid="button-refresh-push">
            <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* ── Register This Device Banner ── */}
      <Card className={`border-2 ${
        regStatus === "success" || isCurrentDeviceRegistered
          ? "border-green-500/30 bg-green-500/5"
          : notifPerm === "denied" || regStatus === "blocked"
            ? "border-red-500/30 bg-red-500/5"
            : "border-orange-500/30 bg-orange-500/5"
      }`}>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                regStatus === "success" || isCurrentDeviceRegistered ? "bg-green-500/15" :
                notifPerm === "denied" || regStatus === "blocked" ? "bg-red-500/15" : "bg-orange-500/15"
              }`}>
                {regStatus === "success" || isCurrentDeviceRegistered
                  ? <ShieldCheck className="h-5 w-5 text-green-500" />
                  : notifPerm === "denied" || regStatus === "blocked"
                    ? <BellOff className="h-5 w-5 text-red-500" />
                    : <Bell className="h-5 w-5 text-orange-500" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">
                  {regStatus === "success" || isCurrentDeviceRegistered
                    ? "This device is registered ✓"
                    : notifPerm === "denied" || regStatus === "blocked"
                      ? isIOS ? "Notifications blocked — open iPhone Settings → Urban Culture Hub → Notifications → Allow" : "Notifications blocked in this browser"
                      : isWTN ? "Register this iPhone to receive push notifications"
                        : isIOS ? "Register this device — iOS WTN bridge not detected yet"
                        : "Register this device to receive push notifications"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {regStatus === "success" || isCurrentDeviceRegistered
                    ? "You can now receive test pushes on this device."
                    : notifPerm === "denied" || regStatus === "blocked"
                      ? isIOS ? "iPhone Settings → Urban Culture Hub → Notifications → Allow." : "Go to browser settings → site permissions → Notifications → Allow."
                      : isWTN ? "Tap the button — this will show the iOS permission dialog if not yet granted."
                        : isIOS ? "The WTN bridge is loading… try tapping Register in a moment."
                        : "Click the button to register this browser. You'll see a permission prompt."}
                </p>
                {regStatus === "error" && regError && (
                  <div className="mt-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-xs font-mono text-red-400 break-all">{regError}</p>
                  </div>
                )}
              </div>
            </div>
            {(regStatus === "success" || isCurrentDeviceRegistered) && (
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 border-green-500/40 text-green-400 hover:bg-green-500/10"
                onClick={handleTestPushSelf}
                disabled={testPushStatus === "loading"}
                data-testid="button-test-push-self"
              >
                {testPushStatus === "loading"
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…</>
                  : testPushStatus === "ok"
                    ? <><CheckCircle className="h-4 w-4 mr-2" /> Sent!</>
                    : <><Send className="h-4 w-4 mr-2" /> Send Test Push</>
                }
              </Button>
            )}
            {regStatus !== "success" && !isCurrentDeviceRegistered && notifPerm !== "denied" && regStatus !== "blocked" && (
              <Button
                size="sm"
                className="shrink-0 bg-orange-500 hover:bg-orange-600 text-white"
                onClick={handleRegisterDevice}
                disabled={regStatus === "loading"}
                data-testid="button-register-device"
              >
                {regStatus === "loading"
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Registering…</>
                  : <><Bell className="h-4 w-4 mr-2" /> Register This Device</>
                }
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Devices', value: stats?.total ?? '—', icon: Bell, color: 'text-orange-500', bg: 'bg-orange-500/10' },
          { label: 'iOS', value: stats?.ios ?? '—', icon: Smartphone, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Android', value: stats?.android ?? '—', icon: Smartphone, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: 'Web', value: stats?.web ?? '—', icon: Monitor, color: 'text-muted-foreground', bg: 'bg-muted/30' },
          { label: 'Active (7d)', value: stats?.recentWeek ?? '—', icon: Zap, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="border-border/60">
            <CardContent className="p-3 flex items-center gap-2.5">
              <div className={`h-8 w-8 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <div>
                <p className="text-lg font-bold leading-tight">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="compose" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 h-10">
          <TabsTrigger value="compose" data-testid="tab-compose">
            <Send className="h-3.5 w-3.5 mr-1.5" /> Compose
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <Clock className="h-3.5 w-3.5 mr-1.5" /> History
            {logs.length > 0 && <Badge className="ml-1.5 h-4 px-1 text-[10px]">{logs.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="devices" data-testid="tab-devices">
            <Smartphone className="h-3.5 w-3.5 mr-1.5" /> Devices
            {devices.length > 0 && <Badge className="ml-1.5 h-4 px-1 text-[10px]">{devices.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* COMPOSE TAB */}
        <TabsContent value="compose" className="space-y-4 mt-0">

          {stats && stats.total === 0 && (
            <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/8">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">No registered devices yet</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Use the <strong>"Register This Device"</strong> panel above to register your browser first.
                  Users are asked to allow notifications when they log in.
                </p>
              </div>
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Form */}
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Compose Notification</CardTitle>
                <CardDescription>Write your message and choose who receives it</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Send To</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['all', 'segment', 'user'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => { setTargetType(t); setSelectedUser(null); setUserSearch(''); }}
                        className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${targetType === t ? 'border-orange-500 bg-orange-500/10 text-orange-500' : 'border-border hover:border-orange-500/50 text-muted-foreground'}`}
                        data-testid={`button-target-${t}`}
                      >
                        {t === 'all' ? '🌍 All' : t === 'segment' ? '👥 Group' : '👤 User'}
                      </button>
                    ))}
                  </div>
                </div>

                {targetType === 'segment' && (
                  <div className="space-y-2">
                    <Label>User Segment</Label>
                    <Select value={segment} onValueChange={setSegment}>
                      <SelectTrigger data-testid="select-segment">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All users with devices</SelectItem>
                        <SelectItem value="premium">Premium subscribers only</SelectItem>
                        <SelectItem value="admin">Admins only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {targetType === 'user' && (
                  <div className="space-y-2">
                    <Label>Search User</Label>
                    {selectedUser ? (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg border border-orange-500/30 bg-orange-500/5">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={selectedUser.profilePicture || undefined} />
                          <AvatarFallback className="text-xs">{selectedUser.displayName[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{selectedUser.displayName}</p>
                          <p className="text-xs text-muted-foreground truncate">{selectedUser.email}</p>
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setSelectedUser(null); setUserSearch(''); }} data-testid="button-clear-user">
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-8"
                          placeholder="Search by name or email..."
                          value={userSearch}
                          onChange={e => setUserSearch(e.target.value)}
                          data-testid="input-user-search"
                        />
                        {userSearchQuery.data && userSearchQuery.data.length > 0 && (
                          <div className="absolute z-10 top-full left-0 right-0 mt-1 border bg-popover rounded-lg shadow-lg overflow-hidden">
                            {userSearchQuery.data.map(u => (
                              <button
                                key={u.id}
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted transition-colors text-left"
                                onClick={() => { setSelectedUser(u); setUserSearch(''); }}
                                data-testid={`button-select-user-${u.id}`}
                              >
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={u.profilePicture || undefined} />
                                  <AvatarFallback className="text-xs">{u.displayName[0]}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{u.displayName}</p>
                                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                              </button>
                            ))}
                          </div>
                        )}
                        {userSearch.length >= 2 && userSearchQuery.data?.length === 0 && !userSearchQuery.isLoading && (
                          <p className="text-xs text-muted-foreground mt-1.5 px-1">No users found</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="push-title">Title <span className="text-red-400">*</span></Label>
                  <Input
                    id="push-title"
                    placeholder="e.g. New event in Amsterdam 🎤"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    maxLength={100}
                    data-testid="input-push-title"
                  />
                  <p className="text-xs text-muted-foreground text-right">{title.length}/100</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="push-body">Message <span className="text-red-400">*</span></Label>
                  <Textarea
                    id="push-body"
                    placeholder="Write your notification message here..."
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    maxLength={200}
                    rows={3}
                    className="resize-none"
                    data-testid="input-push-body"
                  />
                  <p className="text-xs text-muted-foreground text-right">{body.length}/200</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="push-url">Action URL <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <div className="relative">
                    <Globe className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="push-url"
                      className="pl-8"
                      placeholder="/events  or  /chat?conversation=5"
                      value={actionUrl}
                      onChange={e => setActionUrl(e.target.value)}
                      data-testid="input-push-url"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowPreview(p => !p)}
                    disabled={!title && !body}
                    data-testid="button-preview"
                  >
                    {showPreview ? 'Hide Preview' : 'Preview'}
                  </Button>
                  <Button
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                    onClick={() => sendMutation.mutate()}
                    disabled={!canSend}
                    data-testid="button-send-push"
                  >
                    {sendMutation.isPending ? (
                      <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Sending...</>
                    ) : (
                      <><Send className="h-4 w-4 mr-2" /> Send Now</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Preview panel */}
            <div className="space-y-4">
              <Card className="border-orange-500/20 bg-orange-500/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-orange-500 mb-1">
                    <Users className="h-4 w-4" />
                    Sending To
                  </div>
                  <p className="text-sm text-foreground">{targetDescription()}</p>
                </CardContent>
              </Card>

              <AnimatePresence>
                {showPreview && (title || body) && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                    <Card className="border-border/60">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Notification Preview</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="bg-black rounded-2xl p-4 mx-auto max-w-sm">
                          <div className="bg-zinc-800/80 backdrop-blur rounded-2xl p-3 space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-lg overflow-hidden bg-zinc-700 flex items-center justify-center">
                                <img src="/logo.jpg" alt="icon" className="h-full w-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                              </div>
                              <span className="text-white/60 text-xs uppercase tracking-wide font-medium">Urban Culture</span>
                              <span className="text-white/40 text-xs ml-auto">now</span>
                            </div>
                            <p className="text-white font-semibold text-sm leading-tight">{title || 'Notification title'}</p>
                            <p className="text-white/70 text-xs leading-relaxed">{body || 'Your message will appear here...'}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              {!showPreview && (
                <Card className="border-border/60 bg-muted/20">
                  <CardContent className="p-4 space-y-2">
                    <p className="text-sm font-medium flex items-center gap-1.5"><AlertCircle className="h-4 w-4 text-amber-500" /> Tips</p>
                    <ul className="text-xs text-muted-foreground space-y-1.5">
                      <li>• Keep titles under 50 characters for best display</li>
                      <li>• Use emoji to grab attention 🔥🎤</li>
                      <li>• Include a deep link URL to send users directly to the right page</li>
                      <li>• Notifications only reach users who have granted permission</li>
                      <li>• iOS requires the app to be opened at least once after install</li>
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* HISTORY TAB */}
        <TabsContent value="history" className="mt-0">
          <Card className="border-border/60">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Sent Notifications</CardTitle>
                <CardDescription>History of all push notifications sent by admins</CardDescription>
              </div>
              {historyQuery.isFetching && <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />}
            </CardHeader>
            <CardContent className="p-0">
              {logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Bell className="h-10 w-10 mb-3 opacity-30" />
                  <p className="font-medium">No notifications sent yet</p>
                  <p className="text-sm">Go to Compose to send your first push notification.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {logs.map(log => (
                    <div key={log.id} className="px-4 py-3 hover:bg-muted/30 transition-colors" data-testid={`row-push-log-${log.id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm truncate">{log.title}</p>
                            <Badge variant="outline" className="text-xs shrink-0">
                              {log.targetType === 'all' ? '🌍 All' : log.targetType === 'segment' ? `👥 ${log.targetValue}` : '👤 User'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{log.body}</p>
                          {log.actionUrl && (
                            <p className="text-xs text-blue-400 mt-0.5 truncate">↗ {log.actionUrl}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0 space-y-1">
                          <div className="flex items-center gap-1.5 justify-end">
                            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                            <span className="text-xs font-medium text-green-500">{log.sentCount}</span>
                            {log.failedCount > 0 && (
                              <>
                                <XCircle className="h-3.5 w-3.5 text-red-400 ml-1" />
                                <span className="text-xs font-medium text-red-400">{log.failedCount}</span>
                              </>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DEVICES TAB */}
        <TabsContent value="devices" className="mt-0 space-y-4">
          <Card className="border-border/60">
            <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3 flex-wrap">
              <div>
                <CardTitle className="text-base">Registered Devices</CardTitle>
                <CardDescription>{devices.length} device{devices.length !== 1 ? 's' : ''} registered</CardDescription>
              </div>
              <div className="flex gap-2">
                {(['all', 'ios', 'android', 'web'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setDeviceFilter(f)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${deviceFilter === f ? 'border-orange-500 bg-orange-500/10 text-orange-500' : 'border-border text-muted-foreground hover:border-orange-500/50'}`}
                    data-testid={`button-filter-${f}`}
                  >
                    {f === 'all' ? 'All' : f === 'ios' ? '🍎 iOS' : f === 'android' ? '🤖 Android' : '🌐 Web'}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredDevices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Smartphone className="h-10 w-10 mb-3 opacity-30" />
                  <p className="font-medium">No devices found</p>
                  <p className="text-sm">Use "Register This Device" above to add your browser.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {filteredDevices.map(device => (
                    <div key={device.id} className="px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors" data-testid={`row-device-${device.id}`}>
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={device.user.profilePicture || undefined} />
                        <AvatarFallback className="text-xs">{device.user.displayName?.[0] ?? '?'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{device.user.displayName}</p>
                          {platformLabel(device.platform || 'web')}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{device.user.email}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">
                          {device.updatedAt ? formatDistanceToNow(new Date(device.updatedAt), { addSuffix: true }) : 'Unknown'}
                        </p>
                        <p className="text-xs text-muted-foreground/50 font-mono truncate max-w-[80px]">{device.token.slice(0, 8)}…</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500 shrink-0"
                        onClick={() => deleteDeviceMutation.mutate(device.id)}
                        disabled={deleteDeviceMutation.isPending}
                        data-testid={`button-delete-device-${device.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={diagnoseOpen} onOpenChange={setDiagnoseOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 bg-zinc-950 border-zinc-800">
          <DialogHeader className="sr-only">
            <DialogTitle>iOS Push Notification Diagnostics</DialogTitle>
          </DialogHeader>
          <div data-testid="container-native-check-inline">
            <NativeCheck />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
