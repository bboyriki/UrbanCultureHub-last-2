import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Bell, Mic, Camera, CheckCircle, XCircle, Loader2, ChevronRight, Settings } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

type PermState = "unknown" | "granted" | "denied" | "prompt" | "loading";

async function registerFCMToken() {
  try {
    if (!("serviceWorker" in navigator)) return;
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
    if (!token) return;
    const ua = navigator.userAgent;
    const platform = /iPhone|iPad|iPod/.test(ua) ? "ios" : /Android/.test(ua) ? "android" : "web";
    await apiRequest("/api/push/register", "POST", { token, platform });
  } catch (err) {
    console.warn("[Push] FCM registration error:", err);
  }
}

export default function AppPermissionsPage() {
  const [location, setLocation] = useState<PermState>("unknown");
  const [notifications, setNotifications] = useState<PermState>("unknown");
  const [mic, setMic] = useState<PermState>("unknown");
  const [camera, setCamera] = useState<PermState>("unknown");

  useEffect(() => {
    checkPermissions();
  }, []);

  async function checkPermissions() {
    if (!("permissions" in navigator)) return;
    try {
      const loc = await navigator.permissions.query({ name: "geolocation" });
      setLocation(loc.state as PermState);
      loc.onchange = () => setLocation(loc.state as PermState);
    } catch {}
    try {
      const notif = await navigator.permissions.query({ name: "notifications" as PermissionName });
      setNotifications(notif.state as PermState);
      notif.onchange = () => setNotifications(notif.state as PermState);
    } catch {
      if ("Notification" in window) setNotifications(Notification.permission as PermState);
    }
    try {
      const m = await navigator.permissions.query({ name: "microphone" as PermissionName });
      setMic(m.state as PermState);
      m.onchange = () => setMic(m.state as PermState);
    } catch {}
    try {
      const c = await navigator.permissions.query({ name: "camera" as PermissionName });
      setCamera(c.state as PermState);
      c.onchange = () => setCamera(c.state as PermState);
    } catch {}
  }

  async function requestLocation() {
    setLocation("loading");
    return new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => { setLocation("granted"); resolve(); },
        () => { setLocation("denied"); resolve(); },
        { timeout: 10000, enableHighAccuracy: true }
      );
    });
  }

  async function requestNotifications() {
    setNotifications("loading");
    try {
      if (!("Notification" in window)) { setNotifications("denied"); return; }
      const perm = await Notification.requestPermission();
      setNotifications(perm as PermState);
      if (perm === "granted") await registerFCMToken();
    } catch {
      setNotifications("denied");
    }
  }

  async function requestMic() {
    setMic("loading");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMic("granted");
    } catch {
      setMic("denied");
    }
  }

  async function requestCamera() {
    setCamera("loading");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      setCamera("granted");
    } catch {
      setCamera("denied");
    }
  }

  interface PermRow {
    id: string;
    label: string;
    description: string;
    icon: React.ReactNode;
    colorClass: string;
    state: PermState;
    onRequest: () => Promise<void>;
  }

  const rows: PermRow[] = [
    {
      id: "location",
      label: "Location",
      description: "Required to show nearby spots, events, and community members around you.",
      icon: <MapPin className="h-5 w-5" />,
      colorClass: "text-blue-500 bg-blue-500/10",
      state: location,
      onRequest: requestLocation,
    },
    {
      id: "notifications",
      label: "Notifications",
      description: "Get alerts for messages, events, and community activity even when the app is closed.",
      icon: <Bell className="h-5 w-5" />,
      colorClass: "text-orange-500 bg-orange-500/10",
      state: notifications,
      onRequest: requestNotifications,
    },
    {
      id: "mic",
      label: "Microphone",
      description: "Used only when you record a voice message in chat.",
      icon: <Mic className="h-5 w-5" />,
      colorClass: "text-purple-500 bg-purple-500/10",
      state: mic,
      onRequest: requestMic,
    },
    {
      id: "camera",
      label: "Camera",
      description: "Optional — used if you want to take a photo directly in the app.",
      icon: <Camera className="h-5 w-5" />,
      colorClass: "text-pink-500 bg-pink-500/10",
      state: camera,
      onRequest: requestCamera,
    },
  ];

  function StatusBadge({ state }: { state: PermState }) {
    if (state === "granted")
      return <Badge variant="outline" className="border-green-500/40 text-green-500 bg-green-500/5 text-xs">Enabled</Badge>;
    if (state === "denied")
      return <Badge variant="outline" className="border-red-500/40 text-red-500 bg-red-500/5 text-xs">Blocked</Badge>;
    if (state === "loading")
      return <Badge variant="outline" className="text-xs"><Loader2 className="h-3 w-3 animate-spin mr-1 inline" />Requesting…</Badge>;
    return <Badge variant="outline" className="text-xs text-muted-foreground">Not set</Badge>;
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="heading-permissions">App Permissions</h1>
        <p className="text-muted-foreground text-sm">
          Manage what Urban Culture Connect can access on your device.
        </p>
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <Card key={row.id} data-testid={`card-permission-${row.id}`} className="border bg-card/50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${row.colorClass}`}>
                  {row.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-semibold text-sm">{row.label}</span>
                    <StatusBadge state={row.state} />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">{row.description}</p>

                  {row.state === "granted" ? (
                    <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-medium">
                      <CheckCircle className="h-3.5 w-3.5" /> Permission granted
                    </div>
                  ) : row.state === "denied" ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
                        <XCircle className="h-3.5 w-3.5" /> Blocked by browser
                      </div>
                      <p className="text-xs text-muted-foreground">
                        To re-enable, open your browser or phone settings and allow{" "}
                        <strong>{row.label.toLowerCase()}</strong> for this site.
                      </p>
                    </div>
                  ) : row.state === "loading" ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Waiting for your response…
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      className="h-8 text-xs gap-1.5"
                      data-testid={`btn-allow-${row.id}`}
                      onClick={row.onRequest}
                    >
                      Allow {row.label} <ChevronRight className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center pt-2">
        Your privacy matters. We only use these permissions for the features described above.{" "}
        <a href="/privacy-policy" className="underline">Privacy Policy</a>
      </p>
    </div>
  );
}
