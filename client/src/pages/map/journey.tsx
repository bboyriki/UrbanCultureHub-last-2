import { useState, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Polyline, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Play, Pause, SkipForward, SkipBack, ChevronLeft,
  Layers, Navigation, X, Route, Music, Palette,
  ChevronRight, Info, MapPin, Disc3, Flame, Sparkles,
  Map, Lock, Star, Zap, ChevronDown, Share2, Stamp, CheckCircle2, Circle,
} from "lucide-react";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const WAYPOINTS = [
  {
    id: 1, name: "Amsterdam", spot: "Vondelpark Dance Circle",
    lat: 52.3580, lng: 4.8686, emoji: "🏙️", type: "Dance", color: "#FF4D00",
    description: "The birthplace of Dutch urban culture. Every weekend breakers, poppers, and street performers fill the park with the raw energy that has powered the scene since the 80s.",
    highlights: ["Breakdance", "Hip-Hop", "Street Art", "Cyphers"],
    distance: 0, icon: Music,
  },
  {
    id: 2, name: "Utrecht", spot: "TivoliVredenburg · Domplein",
    lat: 52.0907, lng: 5.1215, emoji: "🎵", type: "Music", color: "#7C3AED",
    description: "Under the iconic Dom Tower, Utrecht's underground hip-hop and open mic culture thrives. TivoliVredenburg hosts the biggest urban acts in the country night after night.",
    highlights: ["Open Mic", "Rap Battles", "Live Music", "DJ Sets"],
    distance: 48, icon: Disc3,
  },
  {
    id: 3, name: "Rotterdam", spot: "Schieblock · Skate District",
    lat: 51.9244, lng: 4.4777, emoji: "🛹", type: "Skate", color: "#16A34A",
    description: "Rotterdam's architectural daring mirrors its street culture. The Schieblock district is Europe's urban creativity nucleus — skate, graffiti walls, and pop-up art in every corner.",
    highlights: ["Skate Park", "Graffiti Walls", "BMX", "Street Art"],
    distance: 78, icon: Flame,
  },
  {
    id: 4, name: "Den Haag", spot: "Laakkwartier Urban Arts",
    lat: 52.0705, lng: 4.3007, emoji: "💃", type: "Dance", color: "#E8500A",
    description: "The Hague's multicultural heartbeat beats hardest in Laakkwartier. Hip-hop dance studios, battle events, and community jams define this creative district.",
    highlights: ["Breaking", "Dance Battles", "Workshops", "Community Jams"],
    distance: 105, icon: Music,
  },
  {
    id: 5, name: "Eindhoven", spot: "Strijp-S Culture Campus",
    lat: 51.4416, lng: 5.4697, emoji: "✨", type: "Festival", color: "#F59E0B",
    description: "Built on the old Philips factory grounds, Strijp-S is Eindhoven's creative powerhouse. STRP Festival, street art installations, and DJ culture make this the future of urban creativity.",
    highlights: ["STRP Festival", "Street Art", "DJ Culture", "Tech Art"],
    distance: 155, icon: Palette,
  },
];

const TOTAL_KM = WAYPOINTS[WAYPOINTS.length - 1].distance;

const MAP_LAYERS = [
  {
    id: "dark", label: "Dark", emoji: "🌑",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "© OpenStreetMap contributors © CARTO",
    subdomains: "abcd",
  },
  {
    id: "street", label: "Street", emoji: "🗺️",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors",
    subdomains: "abc",
  },
  {
    id: "satellite", label: "Satellite", emoji: "🛰️",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "© Esri",
    subdomains: "",
  },
  {
    id: "terrain", label: "Terrain", emoji: "⛰️",
    url: "https://tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "© OpenTopoMap",
    subdomains: "",
  },
];

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function interpolateRoute(progress: number, density = 60): [number, number][] {
  if (progress <= 0) return [[WAYPOINTS[0].lat, WAYPOINTS[0].lng]];
  const totalSegments = WAYPOINTS.length - 1;
  const totalSteps = Math.max(2, Math.ceil(progress * totalSegments * density));
  const points: [number, number][] = [];
  for (let i = 0; i < totalSteps; i++) {
    const t = (i / Math.max(totalSteps - 1, 1)) * progress * totalSegments;
    const segIdx = Math.min(Math.floor(t), totalSegments - 1);
    const segT = t - segIdx;
    const from = WAYPOINTS[segIdx];
    const to = WAYPOINTS[Math.min(segIdx + 1, WAYPOINTS.length - 1)];
    points.push([lerp(from.lat, to.lat, segT), lerp(from.lng, to.lng, segT)]);
  }
  return points;
}

function getKmFromProgress(progress: number): number {
  const totalSegs = WAYPOINTS.length - 1;
  const segP = progress * totalSegs;
  const segIdx = Math.min(Math.floor(segP), totalSegs - 1);
  const segT = segP - segIdx;
  const from = WAYPOINTS[segIdx];
  const to = WAYPOINTS[Math.min(segIdx + 1, WAYPOINTS.length - 1)];
  return Math.round(lerp(from.distance, to.distance, segT));
}

function getSegmentProgress(progress: number, idx: number): number {
  const totalSegs = WAYPOINTS.length - 1;
  const segStart = idx / totalSegs;
  const segEnd = (idx + 1) / totalSegs;
  return Math.max(0, Math.min(1, (progress - segStart) / (segEnd - segStart)));
}

function CameraController({ target, zoom, playing }: { target: [number, number]; zoom: number; playing: boolean }) {
  const map = useMap();
  const prevRef = useRef<string>("");
  useEffect(() => {
    const key = `${target[0]}_${target[1]}`;
    if (prevRef.current === key) return;
    prevRef.current = key;
    map.flyTo(target, zoom, { duration: playing ? 2.8 : 2.2, easeLinearity: 0.2 });
  }, [target, zoom, playing, map]);
  return null;
}

function createWaypointIcon(color: string, emoji: string, isActive: boolean, isVisited: boolean, isLocked: boolean, unlocking: boolean) {
  const size = isActive ? 52 : 38;
  const anchor = size / 2;
  const pulseHtml = isActive ? `
    <div style="position:absolute;inset:-10px;border-radius:50%;border:2px solid ${color};opacity:0.45;animation:wpPulse 1.6s ease infinite;"></div>
    <div style="position:absolute;inset:-20px;border-radius:50%;border:1px solid ${color};opacity:0.2;animation:wpPulse 1.6s ease 0.4s infinite;"></div>
    <div style="position:absolute;inset:-30px;border-radius:50%;border:1px solid ${color};opacity:0.08;animation:wpPulse 1.6s ease 0.8s infinite;"></div>
  ` : "";
  const unlockHtml = unlocking ? `
    <div style="position:absolute;inset:-16px;border-radius:50%;border:3px solid ${color};opacity:0.8;animation:wpUnlockRing1 1.2s cubic-bezier(0.34,1.56,0.64,1) forwards;"></div>
    <div style="position:absolute;inset:-28px;border-radius:50%;border:2px solid ${color};opacity:0.5;animation:wpUnlockRing2 1.2s cubic-bezier(0.34,1.56,0.64,1) 0.15s forwards;"></div>
    <div style="position:absolute;inset:-40px;border-radius:50%;border:1px solid ${color};opacity:0.3;animation:wpUnlockRing3 1.2s cubic-bezier(0.34,1.56,0.64,1) 0.3s forwards;"></div>
  ` : "";
  const bgColor = isLocked ? "#1f2937" : isActive || isVisited ? color : "#374151";
  const borderColor = isLocked ? "#374151" : isActive || isVisited ? color : "#6B7280";
  const opacity = isLocked ? 0.4 : 1;
  const bounceStyle = unlocking ? `animation:wpUnlockBounce 1.2s cubic-bezier(0.34,1.56,0.64,1);` : "";
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [anchor, anchor],
    html: `<div style="position:relative;width:${size}px;height:${size}px;opacity:${opacity};">
      ${pulseHtml}
      ${unlockHtml}
      <div style="width:100%;height:100%;border-radius:50%;background:${bgColor};border:2.5px solid ${borderColor};display:flex;align-items:center;justify-content:center;font-size:${isActive ? 22 : 16}px;box-shadow:0 4px 20px rgba(0,0,0,0.5),${isActive ? `0 0 0 0 ${color}40` : ""};transition:all 0.3s ease;${bounceStyle}">
        ${emoji}
      </div>
    </div>`,
  });
}

function createPlaneIcon(color: string) {
  return L.divIcon({
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    html: `<div style="width:36px;height:36px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 0 0 4px ${color}40,0 4px 24px ${color}80;animation:planeGlow 2s ease infinite;">✈️</div>`,
  });
}

function createMinimapPlaneIcon() {
  return L.divIcon({
    className: "",
    iconSize: [10, 10],
    iconAnchor: [5, 5],
    html: `<div style="width:10px;height:10px;border-radius:50%;background:#fff;animation:minimapBlink 1s ease infinite;box-shadow:0 0 4px #fff;"></div>`,
  });
}

function createMinimapWpIcon(color: string, visited: boolean) {
  return L.divIcon({
    className: "",
    iconSize: [8, 8],
    iconAnchor: [4, 4],
    html: `<div style="width:8px;height:8px;border-radius:50%;background:${visited ? color : "transparent"};border:1.5px solid ${color};opacity:${visited ? 1 : 0.5};"></div>`,
  });
}

function SegmentProgressRing({ progress, color, size = 40 }: { progress: number; color: string; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(1, progress)));
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={3} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={3}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.4s ease-out" }}
      />
    </svg>
  );
}

export default function JourneyMapPage() {
  const { toast } = useToast();
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);
  const [drawnPoints, setDrawnPoints] = useState<[number, number][]>([[WAYPOINTS[0].lat, WAYPOINTS[0].lng]]);
  const [planePos, setPlanePos] = useState<[number, number]>([WAYPOINTS[0].lat, WAYPOINTS[0].lng]);
  const [layer, setLayer] = useState("dark");
  const [showCard, setShowCard] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [visited, setVisited] = useState<Set<number>>(new Set([0]));
  const [cardKey, setCardKey] = useState(0);
  const [unlockingIdx, setUnlockingIdx] = useState<number | null>(null);
  const [showMinimap, setShowMinimap] = useState(true);
  const [showLayerPicker, setShowLayerPicker] = useState(false);
  const [swipeIndicator, setSwipeIndicator] = useState<null | "left" | "right">(null);
  const [stampDates, setStampDates] = useState<Record<number, string>>({});
  const [sidebarTab, setSidebarTab] = useState<"route" | "passport">("route");
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const swipeHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wpParam = params.get("waypoint");
    if (wpParam !== null) {
      const idx = Math.max(0, Math.min(WAYPOINTS.length - 1, parseInt(wpParam, 10)));
      if (!Number.isNaN(idx)) {
        const p = idx / (WAYPOINTS.length - 1);
        const pts = interpolateRoute(p);
        setProgress(p);
        setDrawnPoints(pts);
        setActiveIdx(idx);
        setPlanePos([WAYPOINTS[idx].lat, WAYPOINTS[idx].lng]);
        setVisited(() => { const n = new Set<number>(); for (let i = 0; i <= idx; i++) n.add(i); return n; });
        setShowCard(true);
      }
    }
  }, []);

  const swipeStartXRef = useRef<number | null>(null);
  const swipeStartYRef = useRef<number | null>(null);
  const swipePointerIdRef = useRef<number | null>(null);
  const swipeIndicatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stampDatesRef = useRef<Record<number, string>>({});

  const mapSwipeStartXRef = useRef<number | null>(null);
  const mapSwipeStartYRef = useRef<number | null>(null);
  const mapSwipeStartTimeRef = useRef<number | null>(null);

  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const startProgressRef = useRef<number>(0);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const progressBarRef = useRef<HTMLDivElement>(null);
  const scrubbingRef = useRef(false);
  const layerPickerRef = useRef<HTMLDivElement>(null);

  const FULL_DURATION = 24000;

  const persistStamp = useCallback((waypointId: number) => {
    if (stampDatesRef.current[waypointId]) return;
    const now = new Date().toISOString();
    const next = { ...stampDatesRef.current, [waypointId]: now };
    stampDatesRef.current = next;
    setStampDates(next);
    fetch("/api/journey/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waypointId }),
    }).then(res => {
      if (!res.ok) localStorage.setItem("journey_stamps", JSON.stringify(next));
    }).catch(() => {
      localStorage.setItem("journey_stamps", JSON.stringify(next));
    });
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/journey/progress");
        if (res.ok) {
          const data: Array<{ waypointId: number; visitedAt: string }> = await res.json();
          if (data.length > 0) {
            const map: Record<number, string> = {};
            data.forEach(s => { map[s.waypointId] = s.visitedAt; });
            stampDatesRef.current = map;
            setStampDates(map);
            const visitedSet = new Set<number>([0]);
            data.forEach(s => visitedSet.add(s.waypointId - 1));
            setVisited(visitedSet);
          }
        } else {
          const saved = localStorage.getItem("journey_stamps");
          if (saved) {
            const map = JSON.parse(saved) as Record<number, string>;
            stampDatesRef.current = map;
            setStampDates(map);
            const visitedSet = new Set<number>([0]);
            Object.keys(map).forEach(k => visitedSet.add(parseInt(k) - 1));
            setVisited(visitedSet);
          }
        }
      } catch { /* ignore */ }
    };
    load();
  }, []);

  const animate = useCallback((ts: number) => {
    const elapsed = ts - startTimeRef.current;
    const dur = FULL_DURATION / speedRef.current;
    const p = Math.min(startProgressRef.current + elapsed / dur, 1);

    const points = interpolateRoute(p);
    setDrawnPoints(points);
    setProgress(p);

    const totalSegs = WAYPOINTS.length - 1;
    const segP = p * totalSegs;
    const newIdx = p >= 1 ? WAYPOINTS.length - 1 : Math.min(Math.floor(segP), totalSegs - 1);

    setActiveIdx(prev => {
      if (newIdx !== prev) {
        setVisited(v => { const n = new Set(v); n.add(newIdx); return n; });
        setShowCard(true);
        setCardKey(k => k + 1);
        setUnlockingIdx(newIdx);
        setTimeout(() => setUnlockingIdx(null), 1200);
        persistStamp(WAYPOINTS[newIdx].id);
      }
      return newIdx;
    });

    if (points.length > 0) setPlanePos(points[points.length - 1]);

    if (p < 1) rafRef.current = requestAnimationFrame(animate);
    else setPlaying(false);
  }, []);

  useEffect(() => {
    if (playing) {
      startTimeRef.current = performance.now();
      startProgressRef.current = progress;
      rafRef.current = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(rafRef.current);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, animate]);

  const togglePlay = () => {
    if (progress >= 1) {
      setProgress(0);
      setDrawnPoints([[WAYPOINTS[0].lat, WAYPOINTS[0].lng]]);
      setPlanePos([WAYPOINTS[0].lat, WAYPOINTS[0].lng]);
      setActiveIdx(0);
      setVisited(new Set([0]));
      setTimeout(() => setPlaying(true), 50);
    } else {
      setPlaying(p => !p);
    }
  };

  const jumpTo = useCallback((idx: number) => {
    cancelAnimationFrame(rafRef.current);
    setPlaying(false);
    const p = idx / (WAYPOINTS.length - 1);
    setProgress(p);
    const pts = interpolateRoute(p);
    setDrawnPoints(pts);
    setActiveIdx(idx);
    setPlanePos([WAYPOINTS[idx].lat, WAYPOINTS[idx].lng]);
    setVisited(prev => { const n = new Set(prev); for (let i = 0; i <= idx; i++) n.add(i); return n; });
    for (let i = 0; i <= idx; i++) persistStamp(WAYPOINTS[i].id);
    setShowCard(true);
    setCardKey(k => k + 1);
  }, []);

  const showSwipeIndicator = useCallback((dir: "left" | "right") => {
    setSwipeIndicator(dir);
    if (swipeIndicatorTimerRef.current) clearTimeout(swipeIndicatorTimerRef.current);
    swipeIndicatorTimerRef.current = setTimeout(() => setSwipeIndicator(null), 600);
  }, []);

  const handleCardPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch") return;
    swipeStartXRef.current = e.clientX;
    swipeStartYRef.current = e.clientY;
    swipePointerIdRef.current = e.pointerId;
  }, []);

  const dismissSwipeHint = useCallback(() => {
    if (showSwipeHint) {
      if (swipeHintTimerRef.current) clearTimeout(swipeHintTimerRef.current);
      setShowSwipeHint(false);
    }
  }, [showSwipeHint]);

  const handleCardPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch") return;
    if (swipePointerIdRef.current !== e.pointerId) return;
    if (swipeStartXRef.current === null || swipeStartYRef.current === null) return;
    const dx = e.clientX - swipeStartXRef.current;
    const dy = e.clientY - swipeStartYRef.current;
    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
    swipePointerIdRef.current = null;
    if (Math.abs(dx) < 48 || Math.abs(dy) > Math.abs(dx) * 0.8) return;
    dismissSwipeHint();
    if (dx < 0) {
      const next = Math.min(WAYPOINTS.length - 1, activeIdx + 1);
      if (next !== activeIdx) { showSwipeIndicator("left"); jumpTo(next); }
    } else {
      const prev = Math.max(0, activeIdx - 1);
      if (prev !== activeIdx) { showSwipeIndicator("right"); jumpTo(prev); }
    }
  }, [activeIdx, showSwipeIndicator, jumpTo, dismissSwipeHint]);

  const clearMapSwipeRefs = useCallback(() => {
    mapSwipeStartXRef.current = null;
    mapSwipeStartYRef.current = null;
    mapSwipeStartTimeRef.current = null;
  }, []);

  const handleMapTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) { clearMapSwipeRefs(); return; }
    const target = e.target as HTMLElement;
    if (target.closest("[data-no-swipe]")) return;
    const touch = e.touches[0];
    mapSwipeStartXRef.current = touch.clientX;
    mapSwipeStartYRef.current = touch.clientY;
    mapSwipeStartTimeRef.current = performance.now();
  }, [clearMapSwipeRefs]);

  const handleMapTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (
      mapSwipeStartXRef.current === null ||
      mapSwipeStartYRef.current === null ||
      mapSwipeStartTimeRef.current === null
    ) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - mapSwipeStartXRef.current;
    const dy = touch.clientY - mapSwipeStartYRef.current;
    const dt = performance.now() - mapSwipeStartTimeRef.current;
    clearMapSwipeRefs();
    if (dt > 380) return;
    if (Math.abs(dx) < 55) return;
    if (Math.abs(dy) > Math.abs(dx) * 0.75) return;
    if (dx < 0) {
      const next = Math.min(WAYPOINTS.length - 1, activeIdx + 1);
      if (next !== activeIdx) { showSwipeIndicator("left"); jumpTo(next); }
    } else {
      const prev = Math.max(0, activeIdx - 1);
      if (prev !== activeIdx) { showSwipeIndicator("right"); jumpTo(prev); }
    }
  }, [activeIdx, showSwipeIndicator, jumpTo, clearMapSwipeRefs]);

  const prevScrubIdxRef = useRef<number>(0);

  const seekToProgress = useCallback((frac: number) => {
    const p = Math.max(0, Math.min(1, frac));
    cancelAnimationFrame(rafRef.current);
    setPlaying(false);
    const pts = interpolateRoute(p);
    setDrawnPoints(pts);
    setProgress(p);
    const totalSegs = WAYPOINTS.length - 1;
    const newIdx = p >= 1 ? WAYPOINTS.length - 1 : Math.min(Math.floor(p * totalSegs), totalSegs - 1);
    setActiveIdx(newIdx);
    setVisited(prev => { const n = new Set(prev); for (let i = 0; i <= newIdx; i++) n.add(i); return n; });
    if (pts.length > 0) setPlanePos(pts[pts.length - 1]);
    setShowCard(true);
    if (newIdx !== prevScrubIdxRef.current) {
      prevScrubIdxRef.current = newIdx;
      setCardKey(k => k + 1);
    }
  }, []);

  const getProgressFromEvent = useCallback((e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
    if (!progressBarRef.current) return null;
    const rect = progressBarRef.current.getBoundingClientRect();
    let clientX: number | undefined;
    if ("touches" in e) {
      clientX = e.touches[0]?.clientX ?? (e as TouchEvent).changedTouches[0]?.clientX;
    } else {
      clientX = (e as React.MouseEvent | MouseEvent).clientX;
    }
    if (clientX === undefined) return null;
    return (clientX - rect.left) / rect.width;
  }, []);

  const handleScrubStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    scrubbingRef.current = true;
    const frac = getProgressFromEvent(e);
    if (frac !== null) seekToProgress(frac);
  }, [getProgressFromEvent, seekToProgress]);

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!scrubbingRef.current) return;
      const frac = getProgressFromEvent(e);
      if (frac !== null) seekToProgress(frac);
    };
    const onUp = () => { scrubbingRef.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [getProgressFromEvent, seekToProgress]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (layerPickerRef.current && !layerPickerRef.current.contains(e.target as Node)) {
        setShowLayerPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    const isTouchDevice = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
    const seen = localStorage.getItem("journey_swipe_hint_seen");
    if (isTouchDevice && !seen) {
      localStorage.setItem("journey_swipe_hint_seen", "1");
      setShowSwipeHint(true);
      swipeHintTimerRef.current = setTimeout(() => {
        setShowSwipeHint(false);
      }, 2500);
    }
    return () => {
      if (swipeHintTimerRef.current) clearTimeout(swipeHintTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const s = document.createElement("style");
    s.id = "journey-kf";
    s.textContent = `
      @keyframes wpPulse {
        0%,100%{transform:scale(1);opacity:0.45}
        50%{transform:scale(1.5);opacity:0.1}
      }
      @keyframes planeGlow {
        0%,100%{box-shadow:0 0 0 4px rgba(255,107,43,0.4),0 4px 24px rgba(255,107,43,0.7)}
        50%{box-shadow:0 0 0 8px rgba(255,107,43,0.2),0 4px 36px rgba(255,107,43,1)}
      }
      @keyframes cardSlideUp {
        from{opacity:0;transform:translateY(18px)}
        to{opacity:1;transform:translateY(0)}
      }
      @keyframes routeFlowReverse {
        0%{stroke-dashoffset:0}
        100%{stroke-dashoffset:-300}
      }
      @keyframes wpUnlockRing1 {
        0%{transform:scale(0.5);opacity:0.9}
        100%{transform:scale(1.8);opacity:0}
      }
      @keyframes wpUnlockRing2 {
        0%{transform:scale(0.3);opacity:0.7}
        100%{transform:scale(2.2);opacity:0}
      }
      @keyframes wpUnlockRing3 {
        0%{transform:scale(0.1);opacity:0.5}
        100%{transform:scale(2.8);opacity:0}
      }
      @keyframes wpUnlockBounce {
        0%{transform:scale(0.6)}
        60%{transform:scale(1.25)}
        80%{transform:scale(0.93)}
        100%{transform:scale(1)}
      }
      @keyframes minimapBlink {
        0%,100%{opacity:1;box-shadow:0 0 6px #fff}
        50%{opacity:0.3;box-shadow:0 0 2px #fff}
      }
      .journey-card-enter{animation:cardSlideUp 0.4s cubic-bezier(0.34,1.56,0.64,1)}
      .flow-shimmer path{
        stroke-dasharray: 18 12;
        animation: routeFlowReverse 1.2s linear infinite;
      }
      .scrub-track{cursor:pointer;user-select:none;}
      .scrub-track:hover .scrub-thumb{transform:scale(1.5);}
      @keyframes swipeArrowFade {
        0%{opacity:0;transform:scale(0.7)}
        20%{opacity:1;transform:scale(1.1)}
        70%{opacity:1;transform:scale(1)}
        100%{opacity:0;transform:scale(0.85)}
      }
      .swipe-indicator{animation:swipeArrowFade 0.6s ease forwards;pointer-events:none;}
      @keyframes swipeHintSlide {
        0%{transform:translateX(10px);opacity:0.2}
        40%{transform:translateX(-14px);opacity:1}
        70%{transform:translateX(8px);opacity:0.8}
        100%{transform:translateX(10px);opacity:0.2}
      }
      @keyframes swipeHintFadeIn {
        0%{opacity:0}
        15%{opacity:1}
        75%{opacity:1}
        100%{opacity:0}
      }
      .swipe-hint-overlay{animation:swipeHintFadeIn 2.5s ease forwards;pointer-events:none;}
      .swipe-hint-hand{animation:swipeHintSlide 1.1s ease-in-out infinite;display:inline-block;}
    `;
    document.head.appendChild(s);
    return () => document.getElementById("journey-kf")?.remove();
  }, []);

  const shareSnapshot = useCallback(async () => {
    const W = 1080, H = 1080;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, "#06060a");
    bgGrad.addColorStop(1, "#111118");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalAlpha = 0.18;
    const radial = ctx.createRadialGradient(W * 0.72, H * 0.28, 0, W * 0.72, H * 0.28, W * 0.65);
    radial.addColorStop(0, WAYPOINTS[activeIdx].color);
    radial.addColorStop(1, "transparent");
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.06;
    const radial2 = ctx.createRadialGradient(W * 0.2, H * 0.75, 0, W * 0.2, H * 0.75, W * 0.55);
    radial2.addColorStop(0, "#FF4D00");
    radial2.addColorStop(1, "transparent");
    ctx.fillStyle = radial2;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "bold 30px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("URBAN CULTURE CONNECT", 80, 88);

    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.font = "24px system-ui, -apple-system, sans-serif";
    ctx.fillText("🇳🇱  Netherlands Urban Journey", 80, 132);

    const lineY = 166;
    ctx.strokeStyle = `${WAYPOINTS[activeIdx].color}50`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(80, lineY);
    ctx.lineTo(W - 80, lineY);
    ctx.stroke();

    ctx.font = "220px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(WAYPOINTS[activeIdx].emoji, W / 2, H / 2 - 40);

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold 100px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(WAYPOINTS[activeIdx].name, W / 2, H / 2 + 170);

    ctx.fillStyle = WAYPOINTS[activeIdx].color;
    ctx.font = "bold 34px system-ui, -apple-system, sans-serif";
    ctx.fillText(WAYPOINTS[activeIdx].spot, W / 2, H / 2 + 240);

    const badgeX = W / 2 - 200, badgeY = H / 2 + 310, badgeW = 400, badgeH = 84;
    const badgeR = 20;
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = WAYPOINTS[activeIdx].color;
    ctx.beginPath();
    ctx.moveTo(badgeX + badgeR, badgeY);
    ctx.lineTo(badgeX + badgeW - badgeR, badgeY);
    ctx.arcTo(badgeX + badgeW, badgeY, badgeX + badgeW, badgeY + badgeR, badgeR);
    ctx.lineTo(badgeX + badgeW, badgeY + badgeH - badgeR);
    ctx.arcTo(badgeX + badgeW, badgeY + badgeH, badgeX + badgeW - badgeR, badgeY + badgeH, badgeR);
    ctx.lineTo(badgeX + badgeR, badgeY + badgeH);
    ctx.arcTo(badgeX, badgeY + badgeH, badgeX, badgeY + badgeH - badgeR, badgeR);
    ctx.lineTo(badgeX, badgeY + badgeR);
    ctx.arcTo(badgeX, badgeY, badgeX + badgeR, badgeY, badgeR);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "bold 68px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${currentKm} km`, W / 2, H / 2 + 382);

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "28px system-ui, -apple-system, sans-serif";
    ctx.fillText(`${visited.size} of ${WAYPOINTS.length} spots unlocked`, W / 2, H / 2 + 440);

    WAYPOINTS.forEach((w, i) => {
      const dotX = W / 2 - ((WAYPOINTS.length - 1) * 28) / 2 + i * 28;
      const dotY = H / 2 + 500;
      const reached = visited.has(i);
      ctx.beginPath();
      ctx.arc(dotX, dotY, 7, 0, Math.PI * 2);
      ctx.fillStyle = reached ? w.color : "rgba(255,255,255,0.12)";
      ctx.fill();
      if (i < WAYPOINTS.length - 1) {
        const nextDotX = dotX + 28;
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(dotX + 7, dotY);
        ctx.lineTo(nextDotX - 7, dotY);
        ctx.stroke();
      }
    });

    const bottomLineY = H - 100;
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(80, bottomLineY);
    ctx.lineTo(W - 80, bottomLineY);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.font = "26px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("urbancultureconnect.com", 80, H - 52);

    ctx.fillStyle = WAYPOINTS[activeIdx].color;
    ctx.font = "bold 26px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("#UrbanCultureJourney", W - 80, H - 52);

    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, "image/png"));
    if (!blob) return;

    const file = new File([blob], "journey-snapshot.png", { type: "image/png" });
    const deepLink = new URL(window.location.href);
    deepLink.searchParams.set("waypoint", String(activeIdx));
    const shareUrl = deepLink.toString();
    const shareText = `I'm on the Urban Culture Journey! 🏙️ Currently at ${WAYPOINTS[activeIdx].name} ${WAYPOINTS[activeIdx].emoji} — ${currentKm} km traveled, ${visited.size} of ${WAYPOINTS.length} spots unlocked. 🔥`;

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: "My Urban Culture Journey",
          text: shareText,
          files: [file],
          url: shareUrl,
        });
        toast({
          title: "Shared!",
          description: "Your journey snapshot is on its way.",
        });
        return;
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
      toast({
        title: "Copied to clipboard!",
        description: "Journey snapshot text and link copied. Open your social app to paste and share.",
      });
    } catch {
      toast({
        title: "Share not supported",
        description: "Try screenshotting the journey manually.",
        variant: "destructive",
      });
    }
  }, [activeIdx, currentKm, visited, toast]);

  const wp = WAYPOINTS[activeIdx];
  const currentLayer = MAP_LAYERS.find(l => l.id === layer) ?? MAP_LAYERS[0];
  const cameraTarget: [number, number] = [wp.lat, wp.lng];
  const cameraZoom = playing ? 10 : 11;
  const ghostRoute = WAYPOINTS.map(w => [w.lat, w.lng] as [number, number]);
  const currentKm = getKmFromProgress(progress);

  const nextWp = activeIdx < WAYPOINTS.length - 1 ? WAYPOINTS[activeIdx + 1] : null;
  const segmentProg = activeIdx < WAYPOINTS.length - 1 ? getSegmentProgress(progress, activeIdx) : 1;
  const kmToNext = nextWp ? nextWp.distance - wp.distance : 0;
  const kmIntoSeg = nextWp ? Math.round(segmentProg * kmToNext) : kmToNext;

  const ambientColor = wp.color;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black overflow-hidden"
      data-testid="journey-map-page"
      onTouchStart={handleMapTouchStart}
      onTouchEnd={handleMapTouchEnd}
      onTouchCancel={clearMapSwipeRefs}
    >

      {/* Full-screen swipe indicator (map-level swipes when card is hidden) */}
      {swipeIndicator && !showCard && (
        <div
          className="swipe-indicator absolute inset-0 z-[1500] flex items-center justify-center pointer-events-none"
          style={{ background: `${wp.color}0a` }}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: `${wp.color}25`, border: `2px solid ${wp.color}50` }}
          >
            {swipeIndicator === "left"
              ? <ChevronRight size={32} style={{ color: wp.color }} />
              : <ChevronLeft size={32} style={{ color: wp.color }} />
            }
          </div>
        </div>
      )}

      {/* ── TOP BAR ─────────────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-[2000] flex items-center justify-between px-3 sm:px-5 pt-safe-top py-3 bg-gradient-to-b from-black/90 via-black/60 to-transparent pointer-events-none" data-no-swipe>

        <div className="flex items-center gap-2.5 pointer-events-auto">
          <Link href="/map">
            <button
              className="w-9 h-9 rounded-full bg-black/70 backdrop-blur-md border border-white/15 flex items-center justify-center text-white hover:bg-white/10 transition-all shadow-lg"
              data-testid="button-journey-back"
            >
              <ChevronLeft size={15} />
            </button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Route size={13} className="text-orange-400" />
              <h1 className="text-white font-bold text-sm sm:text-base tracking-tight">Urban Culture Journey</h1>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] bg-orange-500/15 text-orange-400 px-2 py-0.5 rounded-full border border-orange-500/25 font-semibold">
                🇳🇱 Netherlands
              </span>
            </div>
            <p className="text-white/40 text-[10px] mt-0.5">
              {WAYPOINTS.length} cities · {TOTAL_KM} km · {WAYPOINTS.length} urban culture spots
            </p>
          </div>
        </div>

        {/* Compact layer switcher + sidebar button */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* Compact layer picker */}
          <div className="relative" ref={layerPickerRef}>
            <button
              onClick={() => setShowLayerPicker(v => !v)}
              data-testid="button-layer-picker"
              className={cn(
                "h-8 px-2.5 rounded-lg text-[10px] font-semibold border transition-all backdrop-blur-sm flex items-center gap-1.5",
                showLayerPicker
                  ? "bg-white/20 border-white/40 text-white shadow-lg"
                  : "bg-black/50 border-white/10 text-white/60 hover:text-white hover:border-white/25"
              )}
            >
              <Map size={12} />
              <span className="hidden sm:inline">{currentLayer.emoji} {currentLayer.label}</span>
              <span className="sm:hidden">{currentLayer.emoji}</span>
              <ChevronDown size={10} className={cn("transition-transform", showLayerPicker && "rotate-180")} />
            </button>
            {showLayerPicker && (
              <div
                className="absolute top-full right-0 mt-1.5 rounded-xl border border-white/10 overflow-hidden z-[3000] min-w-[120px]"
                style={{ background: "rgba(6,6,10,0.96)", backdropFilter: "blur(24px)" }}
                data-testid="layer-picker-dropdown"
              >
                {MAP_LAYERS.map(l => (
                  <button
                    key={l.id}
                    onClick={() => { setLayer(l.id); setShowLayerPicker(false); }}
                    data-testid={`button-layer-${l.id}`}
                    className={cn(
                      "w-full flex items-center gap-2 px-3.5 py-2.5 text-[11px] font-medium transition-colors text-left",
                      layer === l.id
                        ? "text-white bg-white/12"
                        : "text-white/50 hover:text-white hover:bg-white/6"
                    )}
                  >
                    <span>{l.emoji}</span>
                    <span>{l.label}</span>
                    {layer === l.id && <span className="ml-auto text-white/40">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowSidebar(s => !s)}
            data-testid="button-journey-sidebar"
            className={cn(
              "w-8 h-8 rounded-lg backdrop-blur-sm border flex items-center justify-center transition-all",
              showSidebar ? "bg-white/20 border-white/30 text-white" : "bg-black/50 border-white/10 text-white/60 hover:text-white"
            )}
          >
            <Layers size={13} />
          </button>
        </div>
      </div>

      {/* ── MAP ─────────────────────────────────────────────────────────────── */}
      <MapContainer
        center={[52.15, 4.82]}
        zoom={8}
        zoomControl={false}
        attributionControl={false}
        style={{ width: "100%", height: "100%" }}
      >
        <CameraController target={cameraTarget} zoom={cameraZoom} playing={playing} />

        <TileLayer
          url={currentLayer.url}
          attribution={currentLayer.attribution}
          subdomains={currentLayer.subdomains || "abc"}
          maxZoom={19}
        />

        {/* Ghost full route */}
        <Polyline
          positions={ghostRoute}
          pathOptions={{ color: "#ffffff", weight: 1.5, opacity: 0.06, dashArray: "5 10" }}
        />

        {/* Route glow shadow */}
        {drawnPoints.length > 1 && (
          <Polyline positions={drawnPoints} pathOptions={{ color: "#FF5500", weight: 22, opacity: 0.07 }} />
        )}
        {drawnPoints.length > 1 && (
          <Polyline positions={drawnPoints} pathOptions={{ color: "#FF6B2B", weight: 9, opacity: 0.2 }} />
        )}
        {drawnPoints.length > 1 && (
          <Polyline positions={drawnPoints} pathOptions={{ color: "#FF6B2B", weight: 3.5, opacity: 0.95 }} />
        )}
        {drawnPoints.length > 1 && (
          <Polyline positions={drawnPoints} pathOptions={{ color: "#FFAA80", weight: 1.2, opacity: 0.75 }} />
        )}

        {/* Animated flowing shimmer overlay — flows forward like neon light */}
        {drawnPoints.length > 1 && (
          <Polyline
            className="flow-shimmer"
            positions={drawnPoints}
            pathOptions={{ color: "#ffffff", weight: 2.5, opacity: 0.55, dashArray: "18 12" }}
          />
        )}

        {/* Waypoint markers */}
        {WAYPOINTS.map((w, idx) => {
          const isLocked = !visited.has(idx) && idx !== 0;
          return (
            <Marker
              key={w.id}
              position={[w.lat, w.lng]}
              icon={createWaypointIcon(w.color, w.emoji, idx === activeIdx, visited.has(idx), isLocked, unlockingIdx === idx)}
              zIndexOffset={idx === activeIdx ? 500 : 100}
              eventHandlers={{ click: () => jumpTo(idx) }}
            />
          );
        })}

        {/* Moving plane */}
        <Marker position={planePos} icon={createPlaneIcon(wp.color)} zIndexOffset={1000} />
      </MapContainer>

      {/* ── MINIMAP OVERLAY (bottom-right, collapsible) ──────────────────── */}
      <div
        className="absolute bottom-36 sm:bottom-40 right-3 sm:right-5 z-[2000] flex flex-col items-end gap-1"
        data-testid="minimap-container"
        data-no-swipe
      >
        <button
          onClick={() => setShowMinimap(v => !v)}
          data-testid="button-toggle-minimap"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border border-white/10 text-white/50 hover:text-white transition-all"
          style={{ background: "rgba(6,6,10,0.85)", backdropFilter: "blur(16px)" }}
        >
          <Map size={10} />
          {showMinimap ? "Hide" : "Map"}
        </button>
        {showMinimap && (
          <div
            className="rounded-xl overflow-hidden border border-white/15 shadow-2xl"
            style={{ width: 148, height: 148, background: "#0a0a10" }}
          >
            <MapContainer
              center={[52.1, 4.95]}
              zoom={7}
              zoomControl={false}
              attributionControl={false}
              dragging={false}
              scrollWheelZoom={false}
              doubleClickZoom={false}
              touchZoom={false}
              keyboard={false}
              style={{ width: "100%", height: "100%", pointerEvents: "none" }}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                subdomains="abcd"
                maxZoom={19}
              />
              <Polyline
                positions={ghostRoute}
                pathOptions={{ color: "#ffffff", weight: 1, opacity: 0.12, dashArray: "4 6" }}
              />
              {drawnPoints.length > 1 && (
                <Polyline positions={drawnPoints} pathOptions={{ color: "#FF6B2B", weight: 2, opacity: 0.9 }} />
              )}
              {WAYPOINTS.map((w, idx) => (
                <Marker
                  key={w.id}
                  position={[w.lat, w.lng]}
                  icon={createMinimapWpIcon(w.color, visited.has(idx))}
                  zIndexOffset={100}
                />
              ))}
              <Marker position={planePos} icon={createMinimapPlaneIcon()} zIndexOffset={500} />
            </MapContainer>
          </div>
        )}
      </div>

      {/* ── WAYPOINT INFO CARD ─────────────────────────────────────────────── */}
      {showCard && (
        <div
          key={cardKey}
          className="journey-card-enter absolute left-3 sm:left-5 bottom-36 sm:bottom-40 z-[2000] w-[min(92vw,340px)]"
          onPointerDown={handleCardPointerDown}
          onPointerUp={handleCardPointerUp}
          data-testid="swipeable-info-card"
          data-no-swipe
        >
          <div
            className="rounded-2xl overflow-hidden shadow-2xl border border-white/10 relative"
            style={{
              background: "rgba(8,8,12,0.92)",
              backdropFilter: "blur(24px)",
              borderLeft: `3px solid ${wp.color}`,
            }}
          >
            {swipeIndicator && (
              <div
                className="swipe-indicator absolute inset-0 z-10 flex items-center justify-center rounded-2xl"
                style={{ background: `${wp.color}18` }}
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: `${wp.color}30`, border: `2px solid ${wp.color}60` }}
                >
                  {swipeIndicator === "left"
                    ? <ChevronRight size={28} style={{ color: wp.color }} />
                    : <ChevronLeft size={28} style={{ color: wp.color }} />
                  }
                </div>
              </div>
            )}
            {showSwipeHint && (
              <div
                className="swipe-hint-overlay absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl"
                style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
                data-testid="swipe-hint-overlay"
              >
                <div className="flex items-center gap-1">
                  <ChevronLeft size={18} className="text-white/50" />
                  <span className="swipe-hint-hand text-2xl select-none">👆</span>
                  <ChevronRight size={18} className="text-white/50" />
                </div>
                <p className="text-white/80 text-[11px] font-semibold tracking-wide">Swipe to explore cities</p>
              </div>
            )}
            {/* Color band */}
            <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${wp.color}, ${wp.color}00)` }} />

            {/* ── Section A: Identity ── */}
            <div className="px-4 pt-3.5 pb-2.5 flex items-start gap-3">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                style={{ backgroundColor: `${wp.color}20`, border: `2px solid ${wp.color}50`, boxShadow: `0 0 18px ${wp.color}30` }}
              >
                {wp.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-bold text-[15px]">{wp.name}</span>
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: `${wp.color}30`, color: wp.color, border: `1px solid ${wp.color}40` }}
                  >
                    STOP {activeIdx + 1}/{WAYPOINTS.length}
                  </span>
                  <span
                    className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full border flex-shrink-0"
                    style={{ backgroundColor: `${wp.color}15`, color: `${wp.color}cc`, borderColor: `${wp.color}30` }}
                    data-testid={`badge-type-${wp.type}`}
                  >
                    {wp.type}
                  </span>
                </div>
                <p className="text-white/45 text-[11px] mt-0.5 truncate">{wp.spot}</p>
              </div>
              <button
                onClick={() => setShowCard(false)}
                className="text-white/30 hover:text-white/70 transition-colors mt-0.5 flex-shrink-0"
                data-testid="button-close-info-card"
              >
                <X size={14} />
              </button>
            </div>

            {/* ── Section B: Distance data ── */}
            <div
              className="mx-4 mb-3 rounded-xl px-3 py-2.5 flex items-center gap-3"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="relative flex-shrink-0">
                <SegmentProgressRing progress={segmentProg} color={wp.color} size={42} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Navigation size={12} style={{ color: wp.color }} />
                </div>
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-white/35 text-[9px] uppercase tracking-wider">From start</span>
                  <span className="text-white font-bold text-[12px] font-mono" data-testid="text-km-from-start">
                    {currentKm} km
                  </span>
                </div>
                {nextWp && (
                  <div className="flex items-center justify-between">
                    <span className="text-white/35 text-[9px] uppercase tracking-wider">To next</span>
                    <span className="font-mono text-[11px]" style={{ color: `${wp.color}cc` }} data-testid="text-km-to-next">
                      {kmToNext - kmIntoSeg} km
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-white/35 text-[9px] uppercase tracking-wider">Leg progress</span>
                  <span className="text-white/60 text-[10px] font-mono">{Math.round(segmentProg * 100)}%</span>
                </div>
              </div>
            </div>

            {/* ── Section C: Loot ── */}
            <div className="px-4 pb-1.5">
              <div className="flex items-center gap-1.5 mb-2">
                <Star size={9} style={{ color: wp.color }} />
                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: `${wp.color}99` }}>Loot</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {wp.highlights.map((h, i) => (
                  <span
                    key={h}
                    className="text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1"
                    style={{
                      backgroundColor: `${wp.color}18`,
                      color: `${wp.color}dd`,
                      border: `1px solid ${wp.color}30`,
                    }}
                    data-testid={`chip-highlight-${i}`}
                  >
                    <Zap size={8} /> {h}
                  </span>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 pb-4 pt-2.5 flex items-center justify-end">
              <Link href={`/map?lat=${wp.lat}&lng=${wp.lng}`}>
                <button
                  className="flex items-center gap-1.5 text-[11px] font-bold px-3.5 py-1.5 rounded-xl text-white shadow-lg hover:opacity-90 transition-all"
                  style={{ background: wp.color, boxShadow: `0 4px 14px ${wp.color}50` }}
                  data-testid="button-explore-spot"
                >
                  <MapPin size={10} /> Explore <ChevronRight size={9} />
                </button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Collapsed card tab */}
      {!showCard && (
        <button
          onClick={() => setShowCard(true)}
          className="absolute left-3 sm:left-5 bottom-36 sm:bottom-40 z-[2000] flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/10 text-white/70 hover:text-white text-xs font-semibold transition-all"
          style={{ background: "rgba(8,8,12,0.80)", backdropFilter: "blur(16px)" }}
          data-testid="button-show-info-card"
          data-no-swipe
        >
          <span style={{ color: wp.color }}>{wp.emoji}</span>
          <Info size={11} />
          {wp.name}
        </button>
      )}

      {/* ── SIDEBAR — Vertical Timeline ─────────────────────────────────────── */}
      {showSidebar && (
        <div
          className="journey-card-enter absolute top-0 right-0 bottom-0 z-[2000] w-72 flex flex-col border-l border-white/10 overflow-hidden"
          style={{ background: "rgba(6,6,10,0.93)", backdropFilter: "blur(24px)" }}
          data-no-swipe
        >
          {/* Sidebar header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-white/10 shrink-0">
            <div>
              <p className="text-white font-bold text-sm">
                {sidebarTab === "route" ? "Route Overview" : "City Passport"}
              </p>
              <p className="text-white/35 text-[10px] mt-0.5">
                {sidebarTab === "route" ? "Tap any city to jump there" : `${Object.keys(stampDates).length}/${WAYPOINTS.length} stamps collected`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Tab switcher */}
              <div className="flex rounded-lg overflow-hidden border border-white/10">
                <button
                  onClick={() => setSidebarTab("route")}
                  data-testid="button-tab-route"
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold transition-colors",
                    sidebarTab === "route" ? "bg-white/15 text-white" : "text-white/35 hover:text-white/60"
                  )}
                >
                  <Route size={10} /> Route
                </button>
                <button
                  onClick={() => setSidebarTab("passport")}
                  data-testid="button-tab-passport"
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold transition-colors border-l border-white/10",
                    sidebarTab === "passport" ? "bg-white/15 text-white" : "text-white/35 hover:text-white/60"
                  )}
                >
                  <Stamp size={10} /> Passport
                </button>
              </div>
              <button
                onClick={() => setShowSidebar(false)}
                className="text-white/35 hover:text-white transition-colors"
                data-testid="button-close-sidebar"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Stat row */}
          <div className="grid grid-cols-3 border-b border-white/10 shrink-0">
            {[
              { label: "Cities", value: `${WAYPOINTS.length}` },
              { label: "Total km", value: `${TOTAL_KM}` },
              { label: "Visited", value: `${visited.size}` },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col items-center py-3.5 border-r last:border-r-0 border-white/10">
                <span className="text-white font-extrabold text-lg">{value}</span>
                <span className="text-white/30 text-[9px] mt-0.5 uppercase tracking-wider">{label}</span>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="px-4 py-2.5 border-b border-white/10 shrink-0">
            <div className="flex items-center justify-between text-[9px] mb-1.5">
              <span className="text-white/40 uppercase tracking-widest">Journey Progress</span>
              <span className="text-white/60 font-bold">{Math.round(progress * 100)}%</span>
            </div>
            <div className="h-1 bg-white/8 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-none"
                style={{ width: `${progress * 100}%`, background: `linear-gradient(90deg, #FF4D00, ${wp.color})` }}
              />
            </div>
          </div>

          {sidebarTab === "route" ? (
            /* Vertical timeline */
            <div className="flex-1 overflow-y-auto py-4">
              <div className="relative pl-12 pr-4">
                {/* Vertical connector line */}
                <div
                  className="absolute left-[2.35rem] top-5 bottom-5 w-px"
                  style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.08) 100%)" }}
                />

                {WAYPOINTS.map((w, idx) => {
                  const isActive = idx === activeIdx;
                  const isVisited = visited.has(idx);
                  const isLocked = !isVisited && !isActive;
                  const prevDist = idx > 0 ? w.distance - WAYPOINTS[idx - 1].distance : 0;
                  return (
                    <div key={w.id} className="relative mb-0">
                      {/* Km label between nodes */}
                      {idx > 0 && (
                        <div
                          className="absolute -top-4 left-[-1.15rem] text-[8px] font-bold px-1.5 py-0.5 rounded-full z-10"
                          style={{
                            color: isVisited ? WAYPOINTS[idx - 1].color : "rgba(255,255,255,0.2)",
                            background: "rgba(6,6,10,0.9)",
                            border: `1px solid ${isVisited ? `${WAYPOINTS[idx - 1].color}30` : "rgba(255,255,255,0.06)"}`,
                          }}
                          data-testid={`sidebar-km-label-${idx}`}
                        >
                          +{prevDist}km
                        </div>
                      )}

                      <button
                        onClick={() => jumpTo(idx)}
                        data-testid={`sidebar-waypoint-${idx}`}
                        className={cn(
                          "w-full flex items-center gap-3 py-3 text-left transition-all rounded-xl px-2 mb-1",
                          isActive ? "bg-white/6" : "hover:bg-white/3"
                        )}
                      >
                        {/* Node dot on the line */}
                        <div className="absolute left-[1.85rem] z-10 flex-shrink-0">
                          {isVisited || isActive ? (
                            <div
                              className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                              style={{
                                backgroundColor: w.color,
                                borderColor: w.color,
                                boxShadow: isActive ? `0 0 10px ${w.color}80` : `0 0 4px ${w.color}40`,
                              }}
                            >
                              {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                          ) : (
                            <div
                              className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                              style={{ borderColor: "rgba(255,255,255,0.15)", backgroundColor: "transparent" }}
                            >
                              <Lock size={7} className="text-white/25" />
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className={cn("text-sm font-semibold flex items-center gap-1.5", isActive ? "text-white" : isVisited ? "text-white/65" : "text-white/25")}>
                              <span>{w.emoji}</span>
                              {w.name}
                            </span>
                            {isActive && (
                              <span
                                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: `${w.color}30`, color: w.color }}
                              >NOW</span>
                            )}
                            {isVisited && !isActive && (
                              <span className="text-[10px] text-green-400/60">✓</span>
                            )}
                          </div>
                          <p className={cn("text-[10px] truncate mt-0.5", isActive ? "text-white/50" : "text-white/20")}>{w.spot}</p>
                          <p className="text-[9px] mt-0.5" style={{ color: isVisited ? `${w.color}80` : "rgba(255,255,255,0.15)" }}>
                            {w.distance} km from start
                          </p>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ── PASSPORT PANEL ── */
            <div className="flex-1 overflow-y-auto py-4 px-4" data-testid="passport-panel">
              {/* Passport header badge */}
              <div
                className="mb-4 rounded-xl px-3 py-2.5 flex items-center gap-3"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(255,107,43,0.15)", border: "1.5px solid rgba(255,107,43,0.35)" }}
                >
                  <Stamp size={16} className="text-orange-400" />
                </div>
                <div>
                  <p className="text-white text-[11px] font-bold">🇳🇱 Netherlands Urban Passport</p>
                  <p className="text-white/35 text-[9px] mt-0.5">
                    {Object.keys(stampDates).length === WAYPOINTS.length
                      ? "All cities stamped — journey complete!"
                      : `${Object.keys(stampDates).length} of ${WAYPOINTS.length} cities stamped`}
                  </p>
                </div>
              </div>

              {/* Stamp cards */}
              <div className="flex flex-col gap-3">
                {WAYPOINTS.map((w) => {
                  const dateStr = stampDates[w.id];
                  const isStamped = !!dateStr;
                  const date = dateStr ? new Date(dateStr) : null;
                  const formattedDate = date
                    ? date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                    : null;

                  return (
                    <div
                      key={w.id}
                      data-testid={`passport-stamp-${w.id}`}
                      className="relative rounded-xl overflow-hidden border transition-all"
                      style={{
                        borderColor: isStamped ? `${w.color}40` : "rgba(255,255,255,0.06)",
                        background: isStamped
                          ? `linear-gradient(135deg, ${w.color}10 0%, rgba(6,6,10,0.9) 60%)`
                          : "rgba(255,255,255,0.025)",
                        opacity: isStamped ? 1 : 0.55,
                      }}
                    >
                      {/* Stamp body */}
                      <div className="flex items-center gap-3 px-3 py-3">
                        {/* Emoji circle */}
                        <div
                          className="w-11 h-11 rounded-full flex items-center justify-center text-xl flex-shrink-0 relative"
                          style={{
                            backgroundColor: isStamped ? `${w.color}20` : "rgba(255,255,255,0.05)",
                            border: `2px solid ${isStamped ? `${w.color}50` : "rgba(255,255,255,0.1)"}`,
                            boxShadow: isStamped ? `0 0 16px ${w.color}25` : "none",
                          }}
                        >
                          <span style={{ filter: isStamped ? "none" : "grayscale(1) opacity(0.4)" }}>
                            {w.emoji}
                          </span>
                          {isStamped && (
                            <div
                              className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                              style={{ background: w.color, border: "1.5px solid rgba(6,6,10,0.8)" }}
                            >
                              <CheckCircle2 size={9} className="text-white" />
                            </div>
                          )}
                          {!isStamped && (
                            <div
                              className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                              style={{ background: "rgba(30,30,40,0.95)", border: "1.5px solid rgba(255,255,255,0.1)" }}
                            >
                              <Lock size={7} className="text-white/30" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="text-[13px] font-bold"
                              style={{ color: isStamped ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)" }}
                            >
                              {w.name}
                            </span>
                            <span
                              className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{
                                backgroundColor: isStamped ? `${w.color}25` : "rgba(255,255,255,0.05)",
                                color: isStamped ? w.color : "rgba(255,255,255,0.25)",
                                border: `1px solid ${isStamped ? `${w.color}35` : "rgba(255,255,255,0.08)"}`,
                              }}
                            >
                              {w.type.toUpperCase()}
                            </span>
                          </div>
                          <p
                            className="text-[10px] truncate mt-0.5"
                            style={{ color: isStamped ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.15)" }}
                          >
                            {w.spot}
                          </p>
                          <p className="text-[9px] mt-1 font-semibold" style={{ color: isStamped ? `${w.color}90` : "rgba(255,255,255,0.15)" }}>
                            {isStamped ? `Stamped ${formattedDate}` : "Not yet visited"}
                          </p>
                        </div>

                        {/* Right side stamp icon */}
                        <div className="flex-shrink-0">
                          {isStamped ? (
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center"
                              style={{ background: `${w.color}20`, border: `1.5px solid ${w.color}40` }}
                            >
                              <CheckCircle2 size={14} style={{ color: w.color }} />
                            </div>
                          ) : (
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center border border-white/8"
                              style={{ background: "rgba(255,255,255,0.03)" }}
                            >
                              <Circle size={14} className="text-white/15" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Stamp watermark when collected */}
                      {isStamped && (
                        <div
                          className="absolute top-1.5 right-12 text-[9px] font-black uppercase tracking-widest rotate-[-18deg] pointer-events-none select-none opacity-[0.12]"
                          style={{ color: w.color }}
                        >
                          STAMPED
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Footer note for guests */}
              <p className="text-white/20 text-[9px] text-center mt-4 leading-relaxed">
                Stamps are saved automatically.{"\n"}Log in to sync across devices.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── BOTTOM CONTROLS ──────────────────────────────────────────────────── */}
      {/* data-no-swipe is on the wrapper below to prevent map swipe from firing on controls */}
      <div className="absolute bottom-0 left-0 right-0 z-[2000]" data-no-swipe>

        {/* City progress ruler */}
        <div className="px-4 sm:px-8 pb-2 flex items-center">
          {WAYPOINTS.map((w, idx) => {
            const segFrac = idx / (WAYPOINTS.length - 1);
            const reached = progress >= segFrac - 0.01;
            const segProgress = idx < WAYPOINTS.length - 1
              ? Math.max(0, Math.min(1, (progress - segFrac) * (WAYPOINTS.length - 1)))
              : 1;
            return (
              <div key={w.id} className="flex items-center" style={{ flex: idx < WAYPOINTS.length - 1 ? "1" : "0" }}>
                <button
                  onClick={() => jumpTo(idx)}
                  className="flex flex-col items-center gap-1 -mx-2.5 z-10 group"
                  data-testid={`ruler-waypoint-${idx}`}
                >
                  <span
                    className="text-[9px] font-bold transition-all group-hover:opacity-100"
                    style={{ color: reached ? w.color : "rgba(255,255,255,0.2)", opacity: reached ? 1 : 0.6 }}
                  >
                    {w.name}
                  </span>
                  <div
                    className="w-3 h-3 rounded-full border-2 transition-all duration-300"
                    style={{
                      backgroundColor: reached ? w.color : "transparent",
                      borderColor: reached ? w.color : "rgba(255,255,255,0.15)",
                      boxShadow: reached && idx === activeIdx ? `0 0 8px ${w.color}` : "none",
                    }}
                  />
                </button>
                {idx < WAYPOINTS.length - 1 && (
                  <div className="flex-1 h-0.5 mx-1 rounded-full overflow-hidden bg-white/8">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${segProgress * 100}%`,
                        background: `linear-gradient(90deg, ${w.color}, ${WAYPOINTS[idx + 1].color})`,
                        transition: playing ? "none" : "width 0.3s ease-out",
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Main control bar with ambient color */}
        <div
          className="flex items-center gap-3 px-4 sm:px-6 py-3.5 border-t transition-all duration-700"
          style={{
            background: `linear-gradient(135deg, rgba(6,6,10,0.96) 60%, ${ambientColor}12 100%)`,
            backdropFilter: "blur(32px)",
            borderColor: `${ambientColor}20`,
            boxShadow: `inset 0 1px 0 ${ambientColor}15, 0 -4px 24px ${ambientColor}08`,
          }}
          data-testid="bottom-control-bar"
        >
          {/* Prev */}
          <button
            onClick={() => jumpTo(Math.max(0, activeIdx - 1))}
            className="w-9 h-9 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center text-white/70 hover:text-white transition-all"
            data-testid="button-prev-waypoint"
          >
            <SkipBack size={14} />
          </button>

          {/* Play / Pause */}
          <button
            onClick={togglePlay}
            className="rounded-full flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-all"
            style={{
              width: 52, height: 52,
              background: wp.color,
              boxShadow: `0 0 0 3px ${wp.color}30, 0 6px 24px ${wp.color}60`,
            }}
            data-testid="button-play-pause"
          >
            {playing ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
          </button>

          {/* Next */}
          <button
            onClick={() => jumpTo(Math.min(WAYPOINTS.length - 1, activeIdx + 1))}
            className="w-9 h-9 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center text-white/70 hover:text-white transition-all"
            data-testid="button-next-waypoint"
          >
            <SkipForward size={14} />
          </button>

          {/* Info + scrubbable progress + odometer */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <p className="text-white text-[13px] font-bold truncate leading-none">{wp.name}</p>
              {/* Live km odometer */}
              <div
                className="flex items-center gap-1 flex-shrink-0 ml-2 px-2 py-0.5 rounded-lg"
                style={{ background: `${wp.color}15`, border: `1px solid ${wp.color}25` }}
                data-testid="odometer-display"
              >
                <Navigation size={8} style={{ color: wp.color }} />
                <span
                  className="font-mono font-bold text-[11px]"
                  style={{ color: wp.color }}
                  data-testid="text-odometer-km"
                >
                  {currentKm} km
                </span>
              </div>
            </div>
            <p className="text-white/40 text-[10px] truncate mb-1.5 leading-none">{wp.spot}</p>

            {/* Scrubbable progress track */}
            <div
              ref={progressBarRef}
              className="scrub-track h-5 flex items-center relative"
              onMouseDown={handleScrubStart}
              onTouchStart={handleScrubStart}
              data-testid="scrub-track"
            >
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-visible relative">
                {/* Filled */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${progress * 100}%`,
                    background: `linear-gradient(90deg, #FF4D00, ${wp.color})`,
                    transition: playing ? "none" : "width 0.2s ease-out",
                  }}
                />
                {/* Thumb */}
                <div
                  className="scrub-thumb absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full shadow-md transition-transform duration-150"
                  style={{
                    left: `calc(${progress * 100}% - 6px)`,
                    background: wp.color,
                    boxShadow: `0 0 6px ${wp.color}80`,
                  }}
                  data-testid="scrub-thumb"
                />
              </div>
            </div>
          </div>

          {/* Speed selector */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {[1, 2, 3].map(s => (
              <button
                key={s}
                onClick={() => {
                  setSpeed(s);
                  if (playing) {
                    startTimeRef.current = performance.now();
                    startProgressRef.current = progress;
                  }
                }}
                data-testid={`button-speed-${s}`}
                className={cn(
                  "w-8 h-7 rounded-lg text-[11px] font-bold border transition-all",
                  speed === s
                    ? "bg-white text-black border-white"
                    : "bg-white/8 text-white/50 border-white/10 hover:border-white/30 hover:text-white/80"
                )}
              >
                {s}×
              </button>
            ))}
          </div>

          {/* Share snapshot */}
          <button
            onClick={shareSnapshot}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-all flex-shrink-0 border"
            style={{
              background: `${wp.color}18`,
              borderColor: `${wp.color}35`,
            }}
            data-testid="button-share-journey"
            title="Share my journey"
          >
            <Share2 size={14} />
          </button>

          {/* Sidebar toggle (mobile) */}
          <button
            onClick={() => setShowSidebar(s => !s)}
            className="w-9 h-9 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center text-white/60 hover:text-white transition-all flex-shrink-0 sm:hidden"
            data-testid="button-mobile-sidebar"
          >
            <Sparkles size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
