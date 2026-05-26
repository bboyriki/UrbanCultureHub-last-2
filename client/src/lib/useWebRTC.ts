/**
 * useWebRTC — real-time voice & video calling via WebRTC + WebSocket signaling
 *
 * Call flow:
 *  Caller:  startCall()  → CALL_OFFER  → waits for CALL_ANSWER → ICE exchange → connected
 *  Callee:  receives CALL_OFFER → answerCall() → CALL_ANSWER → ICE exchange → connected
 *
 * Cold-start resilience (iOS WebView wrapper):
 *  • Caller re-sends CALL_OFFER every 5 s while ringing (keep-alive).
 *  • Callee saves CALL_OFFER to sessionStorage on receipt.
 *  • On reconnect, callee sends CALL_PICKUP → server re-delivers stored offer.
 *  • If same caller re-sends a fresh offer while already ringing, we update
 *    the offer in-place (no BUSY sent, no duplicate ring).
 */

import { useRef, useState, useCallback, useEffect } from "react";

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

let cachedIceServers: RTCIceServer[] | null = null;
let iceFetchInFlight: Promise<RTCIceServer[]> | null = null;

async function fetchIceServers(): Promise<RTCIceServer[]> {
  if (cachedIceServers) return cachedIceServers;
  if (iceFetchInFlight) return iceFetchInFlight;
  iceFetchInFlight = (async () => {
    try {
      const r = await fetch("/api/webrtc/ice-servers", { credentials: "include" });
      if (r.ok) {
        const data = await r.json();
        if (Array.isArray(data?.iceServers) && data.iceServers.length) {
          cachedIceServers = data.iceServers as RTCIceServer[];
          return cachedIceServers;
        }
      }
    } catch {}
    cachedIceServers = DEFAULT_ICE_SERVERS;
    return cachedIceServers;
  })();
  try {
    return await iceFetchInFlight;
  } finally {
    iceFetchInFlight = null;
  }
}

export type CallType = "voice" | "video";
export type CallState = "idle" | "calling" | "ringing" | "connected" | "ended";

export interface IncomingCallInfo {
  fromUserId: number;
  fromDisplayName: string;
  fromAvatar?: string;
  callType: CallType;
  offer: RTCSessionDescriptionInit;
}

interface UseWebRTCOptions {
  myUserId: number | null;
  sendWsMessage: (type: string, payload: any) => void;
  subscribeToWs: (handler: (msg: any) => void) => () => void;
}

export type CallEndReason = "hangup" | "declined" | "busy" | "unknown";

// sessionStorage key for pending incoming call (survives WebView cold-start)
const PENDING_CALL_KEY = "__pendingCall";

function savePendingCall(info: IncomingCallInfo) {
  try {
    sessionStorage.setItem(PENDING_CALL_KEY, JSON.stringify({ ...info, timestamp: Date.now() }));
  } catch {}
}

function clearPendingCall() {
  try { sessionStorage.removeItem(PENDING_CALL_KEY); } catch {}
}

export function useWebRTC({ myUserId, sendWsMessage, subscribeToWs }: UseWebRTCOptions) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [callType, setCallType] = useState<CallType>("voice");
  const [remoteUserId, setRemoteUserId] = useState<number | null>(null);
  const [remoteDisplayName, setRemoteDisplayName] = useState<string>("");
  const [remoteAvatar, setRemoteAvatar] = useState<string | undefined>();
  const [incomingCall, setIncomingCall] = useState<IncomingCallInfo | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [endReason, setEndReason] = useState<CallEndReason>("unknown");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidate[]>([]);
  const remoteUserIdRef = useRef<number | null>(null);

  // ── Refs for stale-closure safety ────────────────────────────────────────────
  // These shadow the corresponding state values but are always up-to-date inside
  // async WS callbacks and timers that capture their initial closure.
  const callStateRef = useRef<CallState>("idle");
  const incomingCallRef = useRef<IncomingCallInfo | null>(null);

  useEffect(() => { callStateRef.current = callState; }, [callState]);
  useEffect(() => { incomingCallRef.current = incomingCall; }, [incomingCall]);

  // ── Caller keep-alive refs ────────────────────────────────────────────────────
  // Re-sends the offer every 5 s so the callee can recover after a cold start.
  const reofferTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Auto-cancels the call after 90 s of ringing with no answer.
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cached outgoing call info for CALL_PICKUP response and keep-alive re-offers
  const lastOutgoingCallRef = useRef<{
    toUserId: number;
    offer: RTCSessionDescriptionInit;
    callType: CallType;
    fromDisplayName: string;
    fromAvatar?: string;
  } | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { remoteUserIdRef.current = remoteUserId; }, [remoteUserId]);

  // ── Cleanup helper ───────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (durationTimerRef.current) { clearInterval(durationTimerRef.current); durationTimerRef.current = null; }
    if (reofferTimerRef.current) { clearInterval(reofferTimerRef.current); reofferTimerRef.current = null; }
    if (ringTimeoutRef.current) { clearTimeout(ringTimeoutRef.current); ringTimeoutRef.current = null; }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => { try { t.stop(); } catch {} });
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      try { pcRef.current.onicecandidate = null; } catch {}
      try { pcRef.current.ontrack = null; } catch {}
      try { pcRef.current.onconnectionstatechange = null; } catch {}
      try { pcRef.current.oniceconnectionstatechange = null; } catch {}
      try {
        pcRef.current.getSenders().forEach(s => { try { pcRef.current!.removeTrack(s); } catch {} });
      } catch {}
      try { pcRef.current.close(); } catch {}
      pcRef.current = null;
    }
    if (remoteAudioRef.current) { remoteAudioRef.current.srcObject = null; }
    if (remoteVideoRef.current) { remoteVideoRef.current.srcObject = null; }
    pendingCandidatesRef.current = [];
    // Clear call state
    setCallState("idle");
    setRemoteUserId(null);
    setCallDuration(0);
    setIsMuted(false);
    setIsCameraOff(false);
    setIncomingCall(null);
    // Clear persisted pending call
    clearPendingCall();
  }, []);

  const startTimer = useCallback(() => {
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    durationTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
  }, []);

  const attachRemoteStream = useCallback((stream: MediaStream) => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = stream;
      remoteAudioRef.current.play().catch(() => {});
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;
    }
  }, []);

  const createPC = useCallback(async (toUserId: number) => {
    const iceServers = await fetchIceServers();
    const pc = new RTCPeerConnection({
      iceServers,
      iceTransportPolicy: "all",
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    });

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) sendWsMessage("CALL_ICE", { toUserId, candidate: candidate.toJSON() });
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (stream) attachRemoteStream(stream);
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "connected") {
        setCallState("connected");
        startTimer();
      } else if (state === "disconnected" || state === "failed" || state === "closed") {
        const rid = remoteUserIdRef.current;
        if (rid) sendWsMessage("CALL_HANG_UP", { toUserId: rid });
        cleanup();
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        setCallState("connected");
        if (!durationTimerRef.current) startTimer();
      }
    };

    return pc;
  }, [sendWsMessage, cleanup, startTimer, attachRemoteStream]);

  const getLocalStream = useCallback(async (type: CallType): Promise<MediaStream> => {
    const audio: MediaTrackConstraints = {
      echoCancellation: true, noiseSuppression: true,
      autoGainControl: true, channelCount: { ideal: 1 },
    };
    const constraints: MediaStreamConstraints =
      type === "video"
        ? { audio, video: { width: { ideal: 1280, max: 1280 }, height: { ideal: 720, max: 720 }, frameRate: { ideal: 24, max: 30 }, facingMode: "user" } }
        : { audio, video: false };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStreamRef.current = stream;
    if (localVideoRef.current && type === "video") localVideoRef.current.srcObject = stream;
    return stream;
  }, []);

  const flushPendingCandidates = useCallback(async (pc: RTCPeerConnection) => {
    for (const c of pendingCandidatesRef.current) {
      await pc.addIceCandidate(c).catch(() => {});
    }
    pendingCandidatesRef.current = [];
  }, []);

  // ── Initiate a call ───────────────────────────────────────────────────────────
  const startCall = useCallback(async (
    toUserId: number, displayName: string, avatar: string | undefined, type: CallType = "voice"
  ) => {
    if (!myUserId || callState !== "idle") return;
    try {
      setCallState("calling");
      setCallType(type);
      setCallDuration(0);
      setRemoteUserId(toUserId);
      setRemoteDisplayName(displayName);
      setRemoteAvatar(avatar);

      const stream = await getLocalStream(type);
      const pc = await createPC(toUserId);
      pcRef.current = pc;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: type === "video" });
      await pc.setLocalDescription(offer);
      const offerInit = pc.localDescription!.toJSON();

      lastOutgoingCallRef.current = { toUserId, offer: offerInit, callType: type, fromDisplayName: displayName, fromAvatar: avatar };

      const sendOffer = () => sendWsMessage("CALL_OFFER", {
        toUserId, offer: offerInit, callType: type, fromDisplayName: displayName, fromAvatar: avatar,
      });

      sendOffer();

      // ── Caller keep-alive: re-send offer every 5 s ────────────────────────
      // Ensures the callee receives a fresh offer even if their app cold-started
      // and the original offer was lost before their WS was open.
      if (reofferTimerRef.current) clearInterval(reofferTimerRef.current);
      reofferTimerRef.current = setInterval(() => {
        if (callStateRef.current !== "calling") {
          clearInterval(reofferTimerRef.current!);
          reofferTimerRef.current = null;
          return;
        }
        sendOffer();
      }, 5000);

      // ── Auto-cancel after 90 s with no answer ─────────────────────────────
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = setTimeout(() => {
        ringTimeoutRef.current = null;
        if (callStateRef.current === "calling") {
          setEndReason("unknown");
          cleanup();
          setCallState("ended");
          setTimeout(() => setCallState("idle"), 2500);
        }
      }, 90_000);

    } catch (err: any) {
      cleanup();
      throw err;
    }
  }, [myUserId, callState, getLocalStream, createPC, sendWsMessage, cleanup]);

  // ── Answer an incoming call ───────────────────────────────────────────────────
  const answerCall = useCallback(async (info: IncomingCallInfo) => {
    if (!myUserId) return;
    clearPendingCall(); // Call answered — no longer pending
    try {
      setCallType(info.callType);
      setRemoteUserId(info.fromUserId);
      setRemoteDisplayName(info.fromDisplayName);
      setRemoteAvatar(info.fromAvatar);
      setIncomingCall(null);
      setCallDuration(0);
      setCallState("connected");

      const stream = await getLocalStream(info.callType);
      const pc = await createPC(info.fromUserId);
      pcRef.current = pc;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(info.offer));
      await flushPendingCandidates(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendWsMessage("CALL_ANSWER", { toUserId: info.fromUserId, answer: pc.localDescription });
      startTimer();
    } catch (err) {
      cleanup();
    }
  }, [myUserId, getLocalStream, createPC, sendWsMessage, cleanup, flushPendingCandidates, startTimer]);

  // ── Restore an incoming call from sessionStorage (cold-start UX) ─────────────
  // Immediately shows the incoming call UI while WS is still reconnecting.
  // CallContext sends CALL_PICKUP once WS is ready to get a fresh offer.
  const restoreIncomingCall = useCallback((info: IncomingCallInfo) => {
    if (callStateRef.current !== "idle") return;
    setIncomingCall(info);
    setCallState("ringing");
    // Keep in sessionStorage so if user navigates before answering, it persists
  }, []);

  // ── Request the caller to (re-)send their offer ────────────────────────────
  const requestCallPickup = useCallback((fromUserId: number) => {
    if (!fromUserId) return;
    sendWsMessage("CALL_PICKUP", { toUserId: fromUserId });
  }, [sendWsMessage]);

  // ── Reject an incoming call ───────────────────────────────────────────────────
  const rejectCall = useCallback((info: IncomingCallInfo) => {
    clearPendingCall();
    sendWsMessage("CALL_REJECT", { toUserId: info.fromUserId });
    setIncomingCall(null);
    setCallState("idle");
  }, [sendWsMessage]);

  // ── Hang up ───────────────────────────────────────────────────────────────────
  const hangUp = useCallback(() => {
    const rid = remoteUserIdRef.current;
    if (rid) sendWsMessage("CALL_HANG_UP", { toUserId: rid });
    if (incomingCall) {
      sendWsMessage("CALL_REJECT", { toUserId: incomingCall.fromUserId });
      setIncomingCall(null);
    }
    cleanup();
  }, [incomingCall, sendWsMessage, cleanup]);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsMuted(m => !m);
  }, []);

  const toggleCamera = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsCameraOff(c => !c);
  }, []);

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerOn(s => {
      const next = !s;
      if (remoteAudioRef.current) {
        const el = remoteAudioRef.current as any;
        if (typeof el.setSinkId === "function") el.setSinkId(next ? "default" : "").catch(() => {});
      }
      return next;
    });
  }, []);

  // ── Handle incoming WebSocket call messages ───────────────────────────────────
  useEffect(() => {
    const unsubscribe = subscribeToWs(async (msg: any) => {
      const { type, payload } = msg;

      if (type === "CALL_OFFER") {
        const currentState = callStateRef.current;
        const currentIncoming = incomingCallRef.current;

        // ── Same-caller refresh: update offer in-place ───────────────────────
        // When the server re-delivers a fresh offer via CALL_PICKUP (or caller's
        // keep-alive fires), don't show BUSY — just update the stored offer.
        if (currentState === "ringing" && currentIncoming?.fromUserId === payload.fromUserId) {
          const updated = { ...currentIncoming, offer: payload.offer };
          setIncomingCall(updated);
          savePendingCall(updated); // Refresh timestamp too
          return;
        }

        if (currentState !== "idle") {
          sendWsMessage("CALL_BUSY", { toUserId: payload.fromUserId });
          return;
        }

        const info: IncomingCallInfo = {
          fromUserId: payload.fromUserId,
          fromDisplayName: payload.fromDisplayName || `User ${payload.fromUserId}`,
          fromAvatar: payload.fromAvatar,
          callType: payload.callType || "voice",
          offer: payload.offer,
        };
        savePendingCall(info); // Persist for WebView cold-start recovery
        setIncomingCall(info);
        setCallState("ringing");
      }

      else if (type === "CALL_ANSWER" && pcRef.current) {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
          await flushPendingCandidates(pcRef.current);
        } catch {}
      }

      else if (type === "CALL_ICE") {
        try {
          const candidate = new RTCIceCandidate(payload.candidate);
          const pc = pcRef.current;
          if (pc && pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(candidate).catch(() => {});
          } else {
            pendingCandidatesRef.current.push(candidate);
          }
        } catch {}
      }

      else if (type === "CALL_REJECT") {
        setEndReason("declined");
        cleanup();
        setCallState("ended");
        setTimeout(() => setCallState("idle"), 2500);
      }

      else if (type === "CALL_HANG_UP") {
        setEndReason("hangup");
        cleanup();
        setCallState("ended");
        setTimeout(() => setCallState("idle"), 2500);
      }

      else if (type === "CALL_PICKUP") {
        // Callee asks us to re-send the offer. Use ref to avoid stale closure.
        const cached = lastOutgoingCallRef.current;
        if (cached && callStateRef.current === "calling" && cached.toUserId === payload.fromUserId) {
          sendWsMessage("CALL_OFFER", {
            toUserId: cached.toUserId, offer: cached.offer,
            callType: cached.callType, fromDisplayName: cached.fromDisplayName,
            fromAvatar: cached.fromAvatar,
          });
        }
      }

      else if (type === "CALL_BUSY") {
        setEndReason("busy");
        cleanup();
        setCallState("ended");
        setTimeout(() => setCallState("idle"), 2500);
      }
    });

    return unsubscribe;
  // subscribeToWs is stable; no other deps needed since we use refs for state
  }, [subscribeToWs, sendWsMessage, cleanup, flushPendingCandidates]);

  return {
    callState, callType, endReason, incomingCall,
    remoteDisplayName, remoteAvatar, callDuration,
    isMuted, isCameraOff, isSpeakerOn,
    localVideoRef, remoteVideoRef, remoteAudioRef,
    startCall, answerCall, rejectCall, hangUp,
    toggleMute, toggleCamera, toggleSpeaker,
    requestCallPickup, restoreIncomingCall,
  };
}

export function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
