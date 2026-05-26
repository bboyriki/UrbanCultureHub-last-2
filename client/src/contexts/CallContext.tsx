/**
 * CallContext — global WebRTC call state provider
 *
 * Mounts useWebRTC at the app root so:
 *  1. CALL_OFFER messages are handled on ANY page, not just /chat.
 *  2. GlobalIncomingCallOverlay appears on any page the user is on.
 *  3. The push-notification deep-link (call_from param) is processed globally.
 *  4. Remote <audio> is always in the DOM so audio plays before /chat loads.
 *
 * iOS WebView cold-start recovery:
 *  • On mount, checks sessionStorage for a pending call saved by useWebRTC.
 *  • Immediately restores the incoming call UI while WS is still connecting.
 *  • Once WS connects, sends CALL_PICKUP → server re-delivers the stored offer
 *    with fresh ICE candidates (no dependency on caller being still alive).
 *  • URL param (call_from) handled via CALL_PICKUP retry loop (up to 90 s).
 */

import { createContext, useContext, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, Video } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useWebSocket, ConnectionStatus } from "@/contexts/WebSocketSingletonContext";
import { useWebRTC } from "@/lib/useWebRTC";
import { useCallAudio } from "@/lib/useCallAudio";

type WebRTCReturn = ReturnType<typeof useWebRTC>;

const CallContext = createContext<WebRTCReturn | null>(null);

export function useCallContext(): WebRTCReturn {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCallContext must be used inside <CallProvider>");
  return ctx;
}

// sessionStorage key — must match the one in useWebRTC.ts
const PENDING_CALL_KEY = "__pendingCall";
// How long a stored call offer is considered still-valid (must match server TTL)
const CALL_SESSION_TTL_MS = 90_000;

// ── Global incoming-call overlay ─────────────────────────────────────────────
// Renders on top of any page EXCEPT /chat (which has its own embedded overlay).
function GlobalIncomingCallOverlay() {
  const webRTC = useContext(CallContext);
  const [location, navigate] = useLocation();
  const { playRingTone, stopAudio } = useCallAudio();

  // Ring/stop audio as call state changes.
  // Skip when on /chat — ChatPage has its own audio management there.
  const prevStateRef = useRef<string>("idle");
  useEffect(() => {
    if (!webRTC) return;
    if (location === "/chat") return;
    const prev = prevStateRef.current;
    const curr = webRTC.callState;
    prevStateRef.current = curr;
    if (curr === prev) return;

    if (curr === "ringing") {
      playRingTone("incoming");
    } else if (curr === "connected") {
      stopAudio();
      if (prev === "ringing") playRingTone("connected");
    } else if (curr === "ended") {
      stopAudio();
      if (prev !== "idle") {
        if (webRTC.endReason === "declined" || webRTC.endReason === "busy") {
          playRingTone("declined");
        } else {
          playRingTone("ended");
        }
      }
    } else if (curr === "idle") {
      stopAudio();
    }
  }, [webRTC?.callState, webRTC?.endReason, location, playRingTone, stopAudio]);

  // Don't show on /chat — ChatPage has its own embedded incoming-call UI
  if (!webRTC || !webRTC.incomingCall || webRTC.callState !== "ringing") return null;
  if (location === "/chat") return null;

  const info = webRTC.incomingCall;

  const handleAnswer = () => {
    navigate("/chat");
    webRTC.answerCall(info);
  };

  const handleDecline = () => {
    webRTC.rejectCall(info);
  };

  return (
    <AnimatePresence>
      <motion.div
        key="global-incoming-call"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.85 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      >
        <motion.div
          className="relative bg-gradient-to-b from-gray-900 to-gray-950 rounded-3xl p-8 w-80 text-center shadow-2xl border border-white/10"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Animated rings */}
          <div className="absolute inset-0 rounded-3xl overflow-hidden">
            {[1, 2, 3].map(i => (
              <motion.div key={i}
                className="absolute inset-0 rounded-3xl border-2 border-green-400/30"
                animate={{ scale: [1, 1.1 + i * 0.06], opacity: [0.6, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.4, ease: "easeOut" }}
              />
            ))}
          </div>

          <div className="relative">
            <div className="flex items-center justify-center mb-2">
              <div className="text-xs font-medium uppercase tracking-widest text-green-400 flex items-center gap-1.5">
                {info.callType === "video" ? <Video className="h-3 w-3" /> : <Phone className="h-3 w-3" />}
                Incoming {info.callType} call
              </div>
            </div>
            <Avatar className="h-20 w-20 mx-auto mb-4 ring-4 ring-green-500/40 ring-offset-2 ring-offset-gray-900">
              {info.fromAvatar ? <AvatarImage src={info.fromAvatar} /> : null}
              <AvatarFallback className="text-2xl bg-gray-700 text-white">
                {info.fromDisplayName[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <p className="text-white text-lg font-bold mb-1">{info.fromDisplayName}</p>
            <p className="text-gray-400 text-sm mb-8">is calling you</p>
            <div className="flex justify-center gap-8">
              <button
                onClick={handleDecline}
                className="flex flex-col items-center gap-2 group"
                data-testid="button-reject-call-global"
              >
                <div className="h-14 w-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors shadow-lg shadow-red-500/30">
                  <PhoneOff className="h-6 w-6 text-white" />
                </div>
                <span className="text-xs text-gray-400 group-hover:text-gray-200">Decline</span>
              </button>
              <button
                onClick={handleAnswer}
                className="flex flex-col items-center gap-2 group"
                data-testid="button-accept-call-global"
              >
                <div className="h-14 w-14 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-colors shadow-lg shadow-green-500/30">
                  <Phone className="h-6 w-6 text-white" />
                </div>
                <span className="text-xs text-gray-400 group-hover:text-gray-200">Answer</span>
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Provider ─────────────────────────────────────────────────────────────────
export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { sendMessage, subscribe, connectionStatus } = useWebSocket();

  const webRTC = useWebRTC({
    myUserId: user?.id ?? null,
    sendWsMessage: (type, payload) => { sendMessage(type, payload); },
    subscribeToWs: (handler) => {
      if (!subscribe) return () => {};
      return subscribe(handler);
    },
  });

  // ── sessionStorage cold-start restore ─────────────────────────────────────
  // On WebView cold-start (iOS wrapper killed + notification tap):
  //   1. Immediately restore the incoming call UI from sessionStorage.
  //   2. Schedule a CALL_PICKUP once WS connects to get a fresh offer from
  //      the server (which stored it in activeCalls for up to 90 s).
  const pickupAfterRestoreRef = useRef<number | null>(null);

  useEffect(() => {
    // Run once at mount — check for a persisted pending call
    try {
      const raw = sessionStorage.getItem(PENDING_CALL_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      const age = Date.now() - (saved.timestamp || 0);
      if (age > CALL_SESSION_TTL_MS || !saved.fromUserId || !saved.offer) {
        sessionStorage.removeItem(PENDING_CALL_KEY);
        return;
      }
      // Restore incoming call UI immediately (great UX while WS is connecting)
      webRTC.restoreIncomingCall({
        fromUserId: Number(saved.fromUserId),
        fromDisplayName: saved.fromDisplayName || `User ${saved.fromUserId}`,
        fromAvatar: saved.fromAvatar,
        callType: saved.callType || "voice",
        offer: saved.offer,
      });
      // Remember to send CALL_PICKUP for a fresh offer once WS connects
      pickupAfterRestoreRef.current = Number(saved.fromUserId);
    } catch {
      try { sessionStorage.removeItem(PENDING_CALL_KEY); } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount only

  // Once WS is connected after a restore, send a single CALL_PICKUP to get
  // a fresh offer from the server (in case ICE candidates have changed).
  useEffect(() => {
    const toPickup = pickupAfterRestoreRef.current;
    if (!toPickup || !user?.id) return;
    if (connectionStatus !== ConnectionStatus.CONNECTED) return;
    // Only pickup if we're still ringing (not answered/declined yet)
    if (webRTC.callState !== "ringing") {
      pickupAfterRestoreRef.current = null;
      return;
    }
    sendMessage("CALL_PICKUP", { toUserId: toPickup });
    pickupAfterRestoreRef.current = null; // Send only once
  }, [connectionStatus, user?.id, webRTC.callState, sendMessage]);

  // ── Push-notification deep-link handler ────────────────────────────────────
  // When the user taps a call notification, the app opens at
  // /chat?call_from=<callerUserId>. We ask the server (via CALL_PICKUP) to
  // re-deliver the stored CALL_OFFER — no dependency on the caller being alive.
  //
  //  • Works on ANY page (not just /chat)
  //  • Up to 90 retries (1 per second for 90 s)
  //  • Uses refs to avoid stale closures
  //  • Re-runs on connectionStatus change to fire immediately after WS auth
  const callFromRef = useRef<number | null>(null);
  const gotCallRef = useRef(false);

  // Read the URL param once at mount (before any navigation strips it)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("call_from");
    if (raw) {
      const id = parseInt(raw, 10);
      if (Number.isFinite(id) && id > 0) {
        callFromRef.current = id;
        gotCallRef.current = false;
        // If sessionStorage already shows this caller's pending call we still
        // want a fresh CALL_PICKUP, so don't pre-set gotCallRef = true here.
      }
    }
  }, []);

  // Stop retrying once we actually have an incoming call (or active call)
  useEffect(() => {
    if (webRTC.incomingCall || webRTC.callState !== "idle") {
      // Only clear callFromRef (and URL param) if it matches what we're waiting for
      if (callFromRef.current !== null) {
        callFromRef.current = null;
        gotCallRef.current = true;
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete("call_from");
          url.searchParams.delete("call_type");
          window.history.replaceState({}, "", url.toString());
        } catch {}
      }
    }
  }, [webRTC.incomingCall, webRTC.callState]);

  // CALL_PICKUP retry loop — fires immediately on WS connect, then every 1 s
  useEffect(() => {
    if (!user?.id) return;
    const callFromUserId = callFromRef.current;
    if (!callFromUserId) return;
    if (gotCallRef.current) return;

    let attempts = 0;

    const tick = () => {
      if (gotCallRef.current) { clearInterval(iv); return; }
      if (connectionStatus === ConnectionStatus.CONNECTED) {
        sendMessage("CALL_PICKUP", { toUserId: callFromUserId });
      }
      attempts++;
      if (attempts >= 90) {
        clearInterval(iv);
        callFromRef.current = null;
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete("call_from");
          url.searchParams.delete("call_type");
          window.history.replaceState({}, "", url.toString());
        } catch {}
      }
    };

    tick(); // fire immediately on first run / WS reconnect
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [user?.id, connectionStatus, sendMessage]);

  return (
    <CallContext.Provider value={webRTC}>
      {/* Always-mounted audio — remote audio plays on ANY page, not just /chat */}
      <audio ref={webRTC.remoteAudioRef} autoPlay playsInline style={{ display: "none" }} />
      {children}
      <GlobalIncomingCallOverlay />
    </CallContext.Provider>
  );
}
