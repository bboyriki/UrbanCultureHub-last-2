import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import {
  MapPin, Bell, Mic, CheckCircle, ChevronRight, Loader2,
  BellOff, Settings, ExternalLink, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const SESSION_SKIP_KEY = "ucConnect_perms_skipped_session";

type Status = "idle" | "loading" | "granted" | "denied";

function isWebToNative(): boolean {
  try { return typeof window !== "undefined" && !!(window as any).WTN?.Firebase?.Messaging; }
  catch { return false; }
}

async function registerFCMToken() {
  try {
    const ua = navigator.userAgent;
    const platform = /iPhone|iPad|iPod/.test(ua) ? "ios" : /Android/.test(ua) ? "android" : "web";

    if (isWebToNative()) {
      (window as any).WTN.Firebase.Messaging.getFCMToken({
        callback: async (data: { token: string }) => {
          if (!data?.token) return;
          await apiRequest("/api/push/register", "POST", { token: data.token, platform });
          console.log("[Push][WTN] Onboarding token registered");
        },
      });
      return;
    }

    if (!("serviceWorker" in navigator)) return;
    const { initializeApp, getApps, getApp } = await import("firebase/app");
    const { getMessaging, getToken, onMessage } = await import("firebase/messaging");
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
    await apiRequest("/api/push/register", "POST", { token, platform });
    onMessage(messaging, (payload) => {
      const { title, body } = payload.notification || {};
      const data = (payload.data || {}) as Record<string, string>;
      if (!title || Notification.permission !== "granted") return;
      const n = new Notification(title, { body, icon: "/logo.jpg", badge: "/logo.jpg", data });
      n.onclick = () => {
        window.focus();
        if (data.conversationId) window.location.href = `/chat?conversation=${data.conversationId}`;
      };
    });
  } catch (err) {
    console.warn("[Push] FCM registration error:", err);
  }
}

function getUnblockInstructions(): string {
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isChrome = /Chrome/.test(ua) && !/Edg/.test(ua);
  const isFirefox = /Firefox/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);

  if (isIOS && isSafari) {
    return "On iPhone: open the Settings app → scroll to Safari → tap 'Notifications' → find this site and set to Allow.";
  }
  if (isIOS && isChrome) {
    return "On iPhone: open the Settings app → scroll to Chrome → tap 'Notifications' → turn on notifications.";
  }
  if (isAndroid && isChrome) {
    return "Tap the lock icon 🔒 in the address bar above → tap 'Notifications' → choose 'Allow' → refresh the page.";
  }
  if (isFirefox) {
    return "Click the lock icon 🔒 in the address bar → tap 'Notifications' → set to 'Allow' → refresh the page.";
  }
  return "Click the lock icon 🔒 in your browser's address bar → tap 'Notifications' or 'Permissions' → set to 'Allow' → refresh the page.";
}

function shouldShow(): boolean {
  if (isWebToNative()) return false;
  // WKWebView: even if WTN bridge hasn't loaded yet, skip web-push onboarding
  // (push is handled natively by the WTN bridge, not via Service Worker)
  if (/iPhone|iPad|iPod/.test(navigator.userAgent) && !!(window as any).webkit) return false;
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return false;
  if (sessionStorage.getItem(SESSION_SKIP_KEY)) return false;
  return true;
}

const slideVariants = {
  enter: { x: 60, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -60, opacity: 0 },
};

export default function PermissionsOnboarding() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [notifStatus, setNotifStatus] = useState<Status>("idle");
  const [locationStatus, setLocationStatus] = useState<Status>("idle");
  const [micStatus, setMicStatus] = useState<Status>("idle");
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if (!user) return;
    if (!shouldShow()) return;
    if ("Notification" in window) {
      setNotifPermission(Notification.permission);
    }
    const t = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(t);
  }, [user?.id]);

  function skipForSession() {
    sessionStorage.setItem(SESSION_SKIP_KEY, "1");
    setVisible(false);
  }

  function dismiss() {
    setVisible(false);
  }

  async function handleAllowLocation() {
    setLocationStatus("loading");
    return new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => { setLocationStatus("granted"); setTimeout(resolve, 500); },
        () => { setLocationStatus("denied"); setTimeout(resolve, 300); },
        { timeout: 10000, enableHighAccuracy: true }
      );
    });
  }

  async function handleAllowNotifications(): Promise<NotificationPermission> {
    if (notifPermission === "denied") return "denied";
    setNotifStatus("loading");
    try {
      if (!("Notification" in window)) {
        setNotifStatus("denied");
        return "denied";
      }
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
      if (perm === "granted") {
        setNotifStatus("granted");
        await registerFCMToken();
        return "granted";
      } else {
        setNotifStatus("denied");
        return perm;
      }
    } catch {
      setNotifStatus("denied");
      return "denied";
    }
  }

  async function handleAllowMic() {
    setMicStatus("loading");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicStatus("granted");
    } catch {
      setMicStatus("denied");
    }
  }

  const isBlocked = notifPermission === "denied";
  const totalSteps = isBlocked ? 2 : 4;

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="onboarding-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
      >
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 280 }}
          className="w-full sm:max-w-sm bg-background rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 20px)" }}
        >
          {/* Step dots */}
          <div className="flex justify-center gap-1.5 pt-5 pb-1">
            {Array.from({ length: isBlocked ? 2 : 4 }).map((_, i) => (
              <motion.div
                key={i}
                animate={{ width: i === step ? 20 : 6, opacity: i <= step ? 1 : 0.25 }}
                transition={{ duration: 0.25 }}
                className="h-1.5 rounded-full bg-primary"
              />
            ))}
          </div>

          <div className="relative overflow-hidden" style={{ minHeight: 400 }}>
            <AnimatePresence mode="wait" initial={false}>

              {/* ── STEP 0: WELCOME ── */}
              {step === 0 && !isBlocked && (
                <motion.div key="welcome" variants={slideVariants} initial="enter" animate="center" exit="exit"
                  transition={{ duration: 0.25 }}
                  className="absolute inset-0 flex flex-col items-center text-center px-7 pt-5 pb-7 gap-4"
                >
                  <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-xl mt-1">
                    <img src="/logo.jpg" alt="Urban Culture" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">Urban Culture Connect</h2>
                    <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
                      To give you the full experience, we need a few permissions — location, notifications, and your mic for voice messages.
                    </p>
                  </div>
                  <div className="w-full mt-auto space-y-2">
                    <Button data-testid="btn-onboarding-start"
                      className="w-full rounded-2xl h-12 text-base font-semibold"
                      onClick={() => setStep(1)}>
                      Get Started <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                    <button className="w-full text-sm text-muted-foreground py-2" onClick={skipForSession}
                      data-testid="btn-skip-onboarding">
                      Remind me later
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── STEP 0 (BLOCKED): NOTIFICATIONS BLOCKED ── */}
              {step === 0 && isBlocked && (
                <motion.div key="blocked" variants={slideVariants} initial="enter" animate="center" exit="exit"
                  transition={{ duration: 0.25 }}
                  className="absolute inset-0 flex flex-col items-center text-center px-7 pt-5 pb-7 gap-4"
                >
                  <div className="w-20 h-20 rounded-3xl bg-red-500/10 flex items-center justify-center mt-1">
                    <BellOff className="h-9 w-9 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold mb-2">Notifications Blocked</h2>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Your browser is currently blocking notifications for this app. You are missing out on messages, event alerts, and battle updates.
                    </p>
                    <div className="mt-4 p-3 rounded-xl bg-muted/60 text-left text-xs text-muted-foreground leading-relaxed">
                      <p className="font-semibold text-foreground mb-1 flex items-center gap-1.5">
                        <Settings className="h-3.5 w-3.5" /> How to unblock:
                      </p>
                      <p>{getUnblockInstructions()}</p>
                    </div>
                  </div>
                  <div className="w-full mt-auto space-y-2">
                    <Button data-testid="btn-go-to-step2-blocked"
                      className="w-full rounded-2xl h-12 text-base font-semibold"
                      onClick={() => setStep(1)}>
                      <ExternalLink className="h-4 w-4 mr-2" /> Other permissions
                    </Button>
                    <button className="w-full text-sm text-muted-foreground py-2" onClick={skipForSession}>
                      Remind me next time
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── STEP 1: NOTIFICATIONS (normal flow) ── */}
              {step === 1 && !isBlocked && (
                <motion.div key="notifications" variants={slideVariants} initial="enter" animate="center" exit="exit"
                  transition={{ duration: 0.25 }}
                  className="absolute inset-0 flex flex-col items-center text-center px-7 pt-5 pb-7 gap-5"
                >
                  <div className="w-20 h-20 rounded-3xl bg-orange-500/10 flex items-center justify-center mt-1">
                    <Bell className="h-9 w-9 text-orange-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold mb-2">Stay in the Loop</h2>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Get notified about new messages, events near you, battle announcements, and community updates — even when the app is closed.
                    </p>
                  </div>
                  <div className="w-full mt-auto space-y-2">
                    <Button data-testid="btn-allow-notifications"
                      className="w-full rounded-2xl h-12 text-base font-semibold"
                      disabled={notifStatus === "loading"}
                      onClick={async () => {
                        const result = await handleAllowNotifications();
                        if (result !== "granted") setStep(2);
                      }}>
                      {notifStatus === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> :
                        notifStatus === "granted" ? <><CheckCircle className="h-4 w-4 mr-2 text-green-400" /> Notifications On</> :
                          <><Bell className="h-4 w-4 mr-2" /> Allow Notifications</>}
                    </Button>
                    <button data-testid="btn-skip-notifications"
                      className="w-full text-sm text-muted-foreground py-2"
                      onClick={() => setStep(2)}>
                      Not Now
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── STEP 1 (BLOCKED): LOCATION ── */}
              {step === 1 && isBlocked && (
                <motion.div key="location-blocked" variants={slideVariants} initial="enter" animate="center" exit="exit"
                  transition={{ duration: 0.25 }}
                  className="absolute inset-0 flex flex-col items-center text-center px-7 pt-5 pb-7 gap-5"
                >
                  <div className="w-20 h-20 rounded-3xl bg-blue-500/10 flex items-center justify-center mt-1">
                    <MapPin className="h-9 w-9 text-blue-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold mb-2">Your Location</h2>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      We use your location to show nearby spots, events, and people in the street culture community around you.
                    </p>
                  </div>
                  <div className="w-full mt-auto space-y-2">
                    <Button data-testid="btn-allow-location-b"
                      className="w-full rounded-2xl h-12 text-base font-semibold"
                      disabled={locationStatus === "loading"}
                      onClick={async () => { await handleAllowLocation(); skipForSession(); }}>
                      {locationStatus === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> :
                        locationStatus === "granted" ? <><CheckCircle className="h-4 w-4 mr-2 text-green-400" /> Location Enabled</> :
                          <><MapPin className="h-4 w-4 mr-2" /> Allow Location</>}
                    </Button>
                    <button className="w-full text-sm text-muted-foreground py-2" onClick={skipForSession}>
                      Not Now
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── STEP 2: LOCATION ── */}
              {step === 2 && !isBlocked && (
                <motion.div key="location" variants={slideVariants} initial="enter" animate="center" exit="exit"
                  transition={{ duration: 0.25 }}
                  className="absolute inset-0 flex flex-col items-center text-center px-7 pt-5 pb-7 gap-5"
                >
                  <div className="w-20 h-20 rounded-3xl bg-blue-500/10 flex items-center justify-center mt-1">
                    <MapPin className="h-9 w-9 text-blue-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold mb-2">Your Location</h2>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      We use your location to show nearby spots, events, and people in the Dutch hip-hop and street culture community around you.
                    </p>
                  </div>
                  <div className="w-full mt-auto space-y-2">
                    <Button data-testid="btn-allow-location"
                      className="w-full rounded-2xl h-12 text-base font-semibold"
                      disabled={locationStatus === "loading"}
                      onClick={async () => { await handleAllowLocation(); setStep(3); }}>
                      {locationStatus === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> :
                        locationStatus === "granted" ? <><CheckCircle className="h-4 w-4 mr-2 text-green-400" /> Location Enabled</> :
                          <><MapPin className="h-4 w-4 mr-2" /> Allow Location</>}
                    </Button>
                    <button data-testid="btn-skip-location" className="w-full text-sm text-muted-foreground py-2" onClick={() => setStep(3)}>Not Now</button>
                  </div>
                </motion.div>
              )}

              {/* ── STEP 3: MIC ── */}
              {step === 3 && !isBlocked && (
                <motion.div key="mic" variants={slideVariants} initial="enter" animate="center" exit="exit"
                  transition={{ duration: 0.25 }}
                  className="absolute inset-0 flex flex-col items-center text-center px-7 pt-5 pb-7 gap-5"
                >
                  <div className="w-20 h-20 rounded-3xl bg-purple-500/10 flex items-center justify-center mt-1">
                    <Mic className="h-9 w-9 text-purple-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold mb-2">Voice Messages</h2>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Send voice messages to your crew in chats. Your microphone is only activated when you choose to record — never in the background.
                    </p>
                  </div>
                  <div className="w-full mt-auto space-y-2">
                    <Button data-testid="btn-allow-mic"
                      className="w-full rounded-2xl h-12 text-base font-semibold"
                      disabled={micStatus === "loading"}
                      onClick={async () => { await handleAllowMic(); setStep(4); }}>
                      {micStatus === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> :
                        micStatus === "granted" ? <><CheckCircle className="h-4 w-4 mr-2 text-green-400" /> Mic Ready</> :
                          <><Mic className="h-4 w-4 mr-2" /> Allow Microphone</>}
                    </Button>
                    <button data-testid="btn-skip-mic" className="w-full text-sm text-muted-foreground py-2" onClick={() => setStep(4)}>Not Now</button>
                  </div>
                </motion.div>
              )}

              {/* ── STEP 4: DONE ── */}
              {step === 4 && !isBlocked && (
                <motion.div key="done" variants={slideVariants} initial="enter" animate="center" exit="exit"
                  transition={{ duration: 0.25 }}
                  className="absolute inset-0 flex flex-col items-center text-center px-7 pt-5 pb-7 gap-4"
                >
                  <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", damping: 14, delay: 0.1 }}
                    className="w-20 h-20 rounded-3xl bg-green-500/10 flex items-center justify-center mt-1"
                  >
                    <CheckCircle className="h-10 w-10 text-green-500" />
                  </motion.div>
                  <div>
                    <h2 className="text-xl font-bold mb-2">You're All Set!</h2>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Welcome to the community. Discover spots, connect with people, and stay on top of the scene.
                    </p>
                    <div className="flex flex-wrap justify-center gap-2 mt-4">
                      {[
                        { status: notifStatus !== "idle" ? notifStatus : (notifPermission === "granted" ? "granted" : "idle"), icon: <Bell className="h-3 w-3" />, label: "Notifications" },
                        { status: locationStatus, icon: <MapPin className="h-3 w-3" />, label: "Location" },
                        { status: micStatus, icon: <Mic className="h-3 w-3" />, label: "Mic" },
                      ].filter(x => x.status !== "idle").map(({ status, icon, label }) => (
                        <span key={label} className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${status === "granted" ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                          {icon} {status === "granted" ? `${label} on` : `${label} off`}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Button data-testid="btn-onboarding-done"
                    className="w-full mt-auto rounded-2xl h-12 text-base font-semibold"
                    onClick={dismiss}>
                    Start Exploring <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
