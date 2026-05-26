// ─────────────────────────────────────────────────────────────────────────────
// Admin · Memory Calendar — ADHD-friendly, voice-enabled
//
// Features:
//   • Hero "Next Up" card so the most important thing is always visible
//   • Quick Capture: type or 🎤 dictate (English or Dutch via Whisper) →
//     Claude turns it into a structured event with one tap
//   • Big touch targets, color-coded categories, gentle gradients,
//     focus-friendly empty states, no clutter
//   • Month grid + upcoming list + AI assistant + access control tabs
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { enablePushOnThisDevice } from "@/hooks/use-push-notifications";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import {
  CalendarDays, Plus, Brain, Sparkles, Bell, Mail, MapPin, Tag, Users,
  ChevronLeft, ChevronRight, CheckCircle2, Trash2, Edit3, Loader2, Clock,
  Megaphone, Zap, Heart, Briefcase, AlertTriangle, Mic, MicOff, Wand2, BellRing, BellPlus,
  Square, Languages, ArrowRight, Search, Volume2, VolumeX, Download, Filter, AlarmClock,
  X as XIcon, MoreHorizontal, Settings as SettingsIcon, Repeat, Moon,
  RefreshCw, Link2, Unlink, ToggleLeft, ToggleRight, ExternalLink, ThumbsUp, ThumbsDown,
  Mail as MailIcon, CalendarCheck, Inbox, ScanSearch, ChevronDown, ChevronUp, Eye, Bot,
  History, Archive, Layers, ShoppingBag, Rss, Receipt, Share2, UserCheck,
  CheckSquare, PackageCheck, TriangleAlert,
  XCircle, Activity,
  FileText, Pin, PinOff, BarChart3, Globe, TrendingUp, ListChecks, MessageSquare,
  BookOpen, Lightbulb, SortAsc, Copy, PenLine,
} from "lucide-react";

// ── types ────────────────────────────────────────────────────────────────────

type MemoryEvent = {
  id: number;
  ownerUserId: number;
  title: string;
  description: string | null;
  category: string;
  project: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  tags: string[] | null;
  eventDate: string;
  endDate: string | null;
  allDay: boolean;
  location: string | null;
  repeatRule: "none" | "daily" | "weekly" | "monthly" | "yearly";
  reminderOffsets: number[] | null;
  reminderTone: "professional" | "motivational" | "urgent" | "friendly" | "business";
  notifyPush: boolean;
  notifyEmail: boolean;
  isPrivate: boolean;
  isShared: boolean;
  aiContext: string | null;
  aiPreparation: string | null;
  aiFollowUp: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const CATEGORIES = [
  { value: "general",   label: "General",        icon: CalendarDays,    tint: "bg-slate-500"   },
  { value: "meeting",   label: "Meeting",        icon: Users,           tint: "bg-blue-500"    },
  { value: "deadline",  label: "Deadline",       icon: AlertTriangle,   tint: "bg-rose-500"    },
  { value: "subsidy",   label: "Subsidy / Grant",icon: Megaphone,       tint: "bg-emerald-500" },
  { value: "event",     label: "Event",          icon: Sparkles,        tint: "bg-fuchsia-500" },
  { value: "follow_up", label: "Follow-up",      icon: Bell,            tint: "bg-amber-500"   },
  { value: "birthday",  label: "Birthday",       icon: Heart,           tint: "bg-pink-500"    },
  { value: "business",  label: "Business",       icon: Briefcase,       tint: "bg-indigo-500"  },
  { value: "personal",  label: "Personal",       icon: Heart,           tint: "bg-teal-500"    },
  { value: "task",      label: "Task",           icon: CheckCircle2,    tint: "bg-violet-500"  },
];
const catMeta = (v: string) => CATEGORIES.find((c) => c.value === v) || CATEGORIES[0];

const TONES = [
  { value: "professional", label: "Professional" },
  { value: "motivational", label: "Motivational" },
  { value: "urgent",       label: "Urgent" },
  { value: "friendly",     label: "Friendly" },
  { value: "business",     label: "Business" },
];

const PRIORITIES = [
  { value: "low",    label: "Low",    color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  { value: "normal", label: "Normal", color: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" },
  { value: "high",   label: "High",   color: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  { value: "urgent", label: "Urgent", color: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" },
];

const REMINDER_PRESETS = [
  { value: 0,       label: "At time" },
  { value: 15,      label: "15 min" },
  { value: 60,      label: "1 hour" },
  { value: 60 * 3,  label: "3 hours" },
  { value: 60 * 24, label: "1 day" },
  { value: 60 * 24 * 3, label: "3 days" },
  { value: 60 * 24 * 7, label: "1 week" },
];

function fmtTime(iso: string): string {
  try { return new Date(iso).toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short" }); }
  catch { return iso; }
}

function timeUntil(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms < 0) return "overdue";
  const m = Math.round(ms / 60000);
  if (m < 60) return `in ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `in ${h}h`;
  const d = Math.round(h / 24);
  if (d < 30) return `in ${d}d`;
  return new Date(iso).toLocaleDateString("nl-NL", { month: "short", day: "numeric" });
}

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Snooze presets — bumps the event's start time forward by N minutes ──────
const SNOOZE_PRESETS: { label: string; minutes: number }[] = [
  { label: "15 min",            minutes: 15 },
  { label: "1 hour",            minutes: 60 },
  { label: "3 hours",           minutes: 180 },
  { label: "Tonight (19:00)",   minutes: -1 },   // special: jump to today 19:00
  { label: "Tomorrow morning",  minutes: -2 },   // special: tomorrow 09:00
  { label: "Next week",         minutes: 60 * 24 * 7 },
];

// ── Quick date chips for capture ────────────────────────────────────────────
const QUICK_DATES: { label: string; build: () => Date }[] = [
  { label: "In 1h",     build: () => new Date(Date.now() + 60 * 60 * 1000) },
  { label: "Tonight",   build: () => { const d = new Date(); d.setHours(19,0,0,0); return d; } },
  { label: "Tomorrow",  build: () => { const d = new Date(); d.setDate(d.getDate()+1); d.setHours(9,0,0,0); return d; } },
  { label: "Mon 9am",   build: () => { const d = new Date(); const day = d.getDay() || 7; d.setDate(d.getDate() + (8 - day)); d.setHours(9,0,0,0); return d; } },
  { label: "Next week", build: () => { const d = new Date(); d.setDate(d.getDate()+7); d.setHours(9,0,0,0); return d; } },
];

function snoozeDateFor(preset: { label: string; minutes: number }, base: Date): Date {
  if (preset.minutes === -1) {
    // "Tonight 19:00" — but if it's already past 7pm, roll to tomorrow 19:00.
    const d = new Date();
    d.setHours(19, 0, 0, 0);
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
    return d;
  }
  if (preset.minutes === -2) {
    // "Tomorrow morning 09:00" — if it's already past 9am tomorrow somehow, just take tomorrow 9am anyway.
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d;
  }
  return new Date(Math.max(Date.now(), base.getTime()) + preset.minutes * 60_000);
}

// ── ICS export — generate an Apple/Google/Outlook-importable file ───────────
function buildIcs(events: MemoryEvent[]): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
  };
  const esc = (s: string) => (s || "").replace(/[\\,;]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Urban Culture Hub//Memory Calendar//EN",
    "CALSCALE:GREGORIAN",
  ];
  for (const e of events) {
    const start = fmt(e.eventDate);
    const endIso = e.endDate || new Date(new Date(e.eventDate).getTime() + 60 * 60 * 1000).toISOString();
    lines.push(
      "BEGIN:VEVENT",
      `UID:memory-${e.id}@urbanculturehub`,
      `DTSTAMP:${fmt(new Date().toISOString())}`,
      `DTSTART:${start}`,
      `DTEND:${fmt(endIso)}`,
      `SUMMARY:${esc(e.title)}`,
      e.description ? `DESCRIPTION:${esc(e.description)}` : "",
      e.location ? `LOCATION:${esc(e.location)}` : "",
      `CATEGORIES:${esc(e.category)}`,
      `PRIORITY:${e.priority === "urgent" ? 1 : e.priority === "high" ? 3 : e.priority === "low" ? 9 : 5}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.filter(Boolean).join("\r\n");
}

function downloadIcs(events: MemoryEvent[], filename = "memory-calendar.ics") {
  const blob = new Blob([buildIcs(events)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ── Text-to-speech for today's agenda (ADHD-friendly audio brief) ───────────
function speakAgenda(events: MemoryEvent[], lang: "en" | "nl" = "en"): SpeechSynthesisUtterance | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  window.speechSynthesis.cancel();
  if (events.length === 0) {
    const u = new SpeechSynthesisUtterance(lang === "nl" ? "Geen afspraken vandaag. Ontspan." : "No events today. Take it easy.");
    u.lang = lang === "nl" ? "nl-NL" : "en-US";
    window.speechSynthesis.speak(u);
    return u;
  }
  const intro = lang === "nl"
    ? `Je hebt ${events.length} ${events.length === 1 ? "afspraak" : "afspraken"} vandaag. `
    : `You have ${events.length} ${events.length === 1 ? "item" : "items"} today. `;
  const body = events.map((e, i) => {
    const t = new Date(e.eventDate).toLocaleTimeString(lang === "nl" ? "nl-NL" : "en-US", { hour: "2-digit", minute: "2-digit" });
    return `${i + 1}. ${e.title} ${lang === "nl" ? "om" : "at"} ${t}.`;
  }).join(" ");
  const u = new SpeechSynthesisUtterance(intro + body);
  u.lang = lang === "nl" ? "nl-NL" : "en-US";
  u.rate = 1.0;
  window.speechSynthesis.speak(u);
  return u;
}

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date)   { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59); }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function sameDay(a: Date, b: Date) { return a.toDateString() === b.toDateString(); }
function isToday(d: Date) { return sameDay(d, new Date()); }
function isThisWeek(d: Date) {
  const now = new Date();
  const end = new Date(now.getTime() + 7 * 86400000);
  return d.getTime() >= now.getTime() - 86400000 && d.getTime() <= end.getTime();
}

const blankForm = () => ({
  title: "",
  description: "",
  category: "general",
  project: "",
  priority: "normal" as MemoryEvent["priority"],
  eventDate: toLocalInputValue(new Date()),
  location: "",
  repeatRule: "none" as MemoryEvent["repeatRule"],
  reminderOffsets: [60, 60 * 24] as number[],
  reminderTone: "professional" as MemoryEvent["reminderTone"],
  notifyPush: true,
  notifyEmail: false,
  isPrivate: true,
});

// ─────────────────────────────────────────────────────────────────────────────
// Voice recorder hook — uses MediaRecorder, returns a Blob for upload
// ─────────────────────────────────────────────────────────────────────────────
function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (tickRef.current) clearInterval(tickRef.current);
    mediaRef.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone not available in this browser");
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus"
               : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
               : "";
    const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    chunksRef.current = [];
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.start();
    mediaRef.current = rec;
    setRecording(true);
    setElapsed(0);
    tickRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
  }

  async function stop(): Promise<Blob | null> {
    const rec = mediaRef.current;
    if (!rec) return null;
    return new Promise((resolve) => {
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        rec.stream.getTracks().forEach((t) => t.stop());
        if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
        setRecording(false);
        resolve(blob);
      };
      rec.stop();
    });
  }

  return { recording, elapsed, start, stop };
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminMemoryCalendarPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "admin" || user?.role === "super_admin";
  const { toast } = useToast();
  const qc = useQueryClient();

  const [tab, setTab] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("tab") || "today";
  });

  // Handle Google OAuth callback params
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const connected = p.get("google_connected");
    const err       = p.get("google_error");
    if (connected === "1") {
      toast({ title: "Google account connected ✓", description: "First sync will run shortly." });
      qc.invalidateQueries({ queryKey: ["/api/google-sync/connections"] });
      qc.invalidateQueries({ queryKey: ["/api/google-sync/status"] });
    }
    if (err) {
      toast({ title: "Google connection failed", description: decodeURIComponent(err), variant: "destructive" });
    }
    if (connected || err) {
      // Clean the URL params without reloading
      const next = new URL(window.location.href);
      next.searchParams.delete("google_connected");
      next.searchParams.delete("google_error");
      next.searchParams.delete("tab");
      window.history.replaceState({}, "", next.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(blankForm());

  // Filter / search state — applies to Today + Upcoming lists.
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQ, setSearchQ] = useState<string>("");

  // Text-to-speech state for "Read today aloud"
  const [speaking, setSpeaking] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quietForm, setQuietForm] = useState<{ start: string; end: string; enabled: boolean }>({
    start: "23:00",
    end: "07:00",
    enabled: false,
  });

  // ── Settings (quiet hours) ──────────────────────────────────────────────
  const settingsQ = useQuery<{ quietHoursStart: string | null; quietHoursEnd: string | null }>({
    queryKey: ["/api/memory-calendar/settings"],
  });
  useEffect(() => {
    if (!settingsQ.data) return;
    const s = settingsQ.data.quietHoursStart;
    const e = settingsQ.data.quietHoursEnd;
    setQuietForm({
      start: s || "23:00",
      end:   e || "07:00",
      enabled: !!(s && e),
    });
  }, [settingsQ.data]);

  const settingsMut = useMutation({
    mutationFn: async (payload: { quietHoursStart: string | null; quietHoursEnd: string | null }) => {
      const r = await apiRequest("/api/memory-calendar/settings", "PUT", payload);
      return await r.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Quiet hours saved ✓",
        description: data?.regenerated
          ? `Updated ${data.regenerated} upcoming reminder${data.regenerated === 1 ? "" : "s"}.`
          : "No upcoming reminders to shift.",
      });
      qc.invalidateQueries({ queryKey: ["/api/memory-calendar/settings"] });
      qc.invalidateQueries({ queryKey: ["/api/memory-calendar/events"] });
      setSettingsOpen(false);
    },
    onError: (e: any) => toast({ title: "Could not save settings", description: e?.message, variant: "destructive" }),
  });
  useEffect(() => {
    return () => { if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); };
  }, []);

  const monthStart = startOfMonth(cursor);
  const monthEnd   = endOfMonth(cursor);

  // ── queries ────────────────────────────────────────────────────────────────
  const eventsQ = useQuery<MemoryEvent[]>({
    queryKey: ["/api/memory-calendar/events", monthStart.toISOString(), monthEnd.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({ from: monthStart.toISOString(), to: monthEnd.toISOString() });
      const res = await fetch(`/api/memory-calendar/events?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const upcomingQ = useQuery<MemoryEvent[]>({
    queryKey: ["/api/memory-calendar/events", "upcoming"],
    queryFn: async () => {
      const from = new Date();
      const to   = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
      const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
      const res = await fetch(`/api/memory-calendar/events?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const statsQ = useQuery<{ pending: number; delivered: number; failed: number }>({
    queryKey: ["/api/memory-calendar/stats"],
  });

  // ── mutations ──────────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: async (payload: any) => apiRequest("/api/memory-calendar/events", "POST", payload),
    onSuccess: () => {
      toast({ title: "Saved", description: "Calendar entry created." });
      qc.invalidateQueries({ queryKey: ["/api/memory-calendar/events"] });
      setDialogOpen(false);
      setForm(blankForm());
    },
    onError: (e: any) => toast({ title: "Could not save", description: e?.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) =>
      apiRequest(`/api/memory-calendar/events/${id}`, "PATCH", payload),
    onSuccess: () => {
      toast({ title: "Updated" });
      qc.invalidateQueries({ queryKey: ["/api/memory-calendar/events"] });
      setDialogOpen(false);
      setEditingId(null);
    },
    onError: (e: any) => toast({ title: "Could not update", description: e?.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => apiRequest(`/api/memory-calendar/events/${id}`, "DELETE"),
    onSuccess: () => {
      toast({ title: "Deleted" });
      qc.invalidateQueries({ queryKey: ["/api/memory-calendar/events"] });
    },
  });

  const completeMut = useMutation({
    mutationFn: async (id: number) => apiRequest(`/api/memory-calendar/events/${id}/complete`, "POST"),
    onSuccess: () => {
      toast({ title: "Done ✓", description: "Marked complete" });
      qc.invalidateQueries({ queryKey: ["/api/memory-calendar/events"] });
    },
  });

  // Snooze — bumps event start time forward, server regenerates reminders.
  // If the event has an endDate, we preserve its original duration by shifting
  // both start and end by the same delta so we never end up with end < start.
  const snoozeMut = useMutation({
    mutationFn: async ({ id, newDate, event }: { id: number; newDate: Date; event: MemoryEvent }) => {
      const payload: any = { eventDate: newDate.toISOString() };
      if (event.endDate) {
        const originalStart = new Date(event.eventDate).getTime();
        const originalEnd   = new Date(event.endDate).getTime();
        const duration      = Math.max(0, originalEnd - originalStart);
        payload.endDate = new Date(newDate.getTime() + duration).toISOString();
      }
      return apiRequest(`/api/memory-calendar/events/${id}`, "PATCH", payload);
    },
    onSuccess: (_d, vars) => {
      toast({
        title: "Snoozed 💤",
        description: `Moved to ${vars.newDate.toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short" })}`,
      });
      qc.invalidateQueries({ queryKey: ["/api/memory-calendar/events"] });
    },
    onError: (e: any) => toast({ title: "Snooze failed", description: e?.message, variant: "destructive" }),
  });

  // Push diagnostic state
  const [pushDiag, setPushDiag]             = useState<string>("");
  const [pushDiagOk, setPushDiagOk]         = useState<boolean | null>(null);
  const [pushPanelOpen, setPushPanelOpen]   = useState(false);
  const [pushDiagDetail, setPushDiagDetail] = useState<any>(null);

  const enablePushMut = useMutation({
    mutationFn: async () => enablePushOnThisDevice(),
    onSuccess: (res: any) => {
      if (res?.ok) {
        setPushDiagOk(true);
        setPushDiag(`Push enabled on this device (${res.platform}) — token ...${String(res.token || "").slice(-8)}. Tap "Test reminder" to verify.`);
        toast({ title: "Push enabled on this device", description: "Tap 'Test reminder' to verify delivery.", duration: 8000 });
      } else {
        const reason = res?.reason || "Unknown error";
        setPushDiagOk(false);
        setPushDiag(reason);
        setPushPanelOpen(true);
        toast({ title: "Couldn\'t enable push", description: reason, variant: "destructive", duration: 15000 });
      }
    },
    onError: (e: any) => {
      setPushDiagOk(false);
      setPushDiag(e?.message || "Unknown error");
      toast({ title: "Enable push failed", description: e?.message, variant: "destructive", duration: 15000 });
    },
  });

  // Full server-side FCM diagnostic
  const pushServerDiagMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("/api/admin/push/diagnostic", "POST", {});
      return await r.json();
    },
    onSuccess: (data: any) => {
      setPushDiagDetail(data);
      setPushPanelOpen(true);
    },
    onError: (e: any) => toast({ title: "Diagnostic failed", description: e?.message, variant: "destructive" }),
  });

  // Send a test reminder
  const testReminderMut = useMutation({
    mutationFn: async (channel: "push" | "email" | "both" = "both") => {
      const r = await apiRequest("/api/memory-calendar/test-reminder", "POST", { channel });
      return await r.json();
    },
    onSuccess: (data: any) => {
      const r = data?.results || {};
      const pushOk  = r.push?.ok;
      const emailOk = r.email?.ok;
      const parts: string[] = [];
      if (pushOk)              parts.push("push ok");
      if (emailOk)             parts.push("email ok");
      if (r.push  && !pushOk)  parts.push(`push failed: ${r.push.error || "unknown"}`);
      if (r.email && !emailOk) parts.push(`email failed: ${r.email.error || "unknown"}`);
      const allOk = (pushOk || !r.push) && (emailOk || !r.email);
      setPushDiagOk(allOk);
      setPushDiag(parts.join(" | ") || "No channels tested");
      if (r.push && !pushOk) { setPushDiagDetail(r.push); setPushPanelOpen(true); }
      toast({
        title: allOk ? "Test delivered" : parts.some(p => p.includes("ok")) ? "Partly delivered" : "Delivery failed",
        description: parts.join(" | "),
        variant: allOk || parts.some(p => p.includes("ok")) ? "default" : "destructive",
      });
      qc.invalidateQueries({ queryKey: ["/api/memory-calendar/stats"] });
    },
    onError: (e: any) =>
      toast({ title: "Test reminder failed", description: e?.message, variant: "destructive" }),
  });

  // ── AI panel ───────────────────────────────────────────────────────────────
  const [aiHorizon, setAiHorizon] = useState(14);
  const [aiSummary, setAiSummary] = useState<string>("");
  const [aiPrep, setAiPrep] = useState<string>("");

  const summarizeMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("/api/memory-calendar/ai/summarize", "POST", { days: aiHorizon });
      return await r.json();
    },
    onSuccess: (data: any) => setAiSummary(data.summary || ""),
    onError: (e: any) => toast({ title: "AI summarize failed", description: e?.message, variant: "destructive" }),
  });

  const prepareMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest(`/api/memory-calendar/ai/prepare/${id}`, "POST", {});
      return await r.json();
    },
    onSuccess: (data: any) => {
      setAiPrep(data.reply || "");
      qc.invalidateQueries({ queryKey: ["/api/memory-calendar/events"] });
      setTab("ai");
    },
    onError: (e: any) => toast({ title: "AI prepare failed", description: e?.message, variant: "destructive" }),
  });

  // ── Quick Capture (text + voice + AI parse) ───────────────────────────────
  const [capture, setCapture] = useState("");
  const [voiceLang, setVoiceLang] = useState<"en" | "nl">("en");
  const recorder = useVoiceRecorder();
  const [transcribing, setTranscribing] = useState(false);

  async function handleVoiceToggle() {
    try {
      if (recorder.recording) {
        const blob = await recorder.stop();
        if (!blob || blob.size < 200) { toast({ title: "No audio captured", variant: "destructive" }); return; }
        setTranscribing(true);
        const fd = new FormData();
        fd.append("audio", blob, `voice.webm`);
        fd.append("lang", voiceLang);
        const res = await fetch("/api/memory-calendar/transcribe", {
          method: "POST", credentials: "include", body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Transcription failed");
        const text = (data.text || "").trim();
        if (!text) { toast({ title: "Couldn't hear that — try again", variant: "destructive" }); }
        else {
          setCapture((c) => (c ? c.trim() + " " : "") + text);
          toast({ title: voiceLang === "nl" ? "Opgenomen" : "Captured", description: text.slice(0, 80) });
        }
      } else {
        await recorder.start();
        toast({ title: voiceLang === "nl" ? "Spreek nu…" : "Listening…", description: "Tap stop when done." });
      }
    } catch (e: any) {
      toast({ title: "Mic error", description: e?.message || "Could not access microphone", variant: "destructive" });
    } finally {
      setTranscribing(false);
    }
  }

  const parseMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("/api/memory-calendar/parse", "POST", {
        text: capture.trim(), lang: voiceLang,
      });
      return await r.json();
    },
    onSuccess: (data: any) => {
      const p = data?.parsed || {};
      if (!p.title) {
        toast({ title: "AI couldn't parse that — try rephrasing", variant: "destructive" });
        return;
      }
      const dt = p.eventDate ? new Date(p.eventDate) : new Date();
      setEditingId(null);
      setForm({
        ...blankForm(),
        title: p.title || capture.slice(0, 80),
        description: p.description || p.notes || capture,
        category: p.category || "general",
        priority: p.priority || "normal",
        project: p.project || "",
        location: p.location || "",
        eventDate: toLocalInputValue(isNaN(dt.getTime()) ? new Date() : dt),
        reminderOffsets: Array.isArray(p.reminderOffsets) && p.reminderOffsets.length ? p.reminderOffsets : [60, 60 * 24],
      });
      setDialogOpen(true);
    },
    onError: (e: any) => toast({ title: "AI parse failed", description: e?.message, variant: "destructive" }),
  });

  // ── grid ───────────────────────────────────────────────────────────────────
  const grid = useMemo(() => {
    const first = startOfMonth(cursor);
    const firstWeekday = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, MemoryEvent[]>();
    (eventsQ.data || []).forEach((e) => {
      const k = new Date(e.eventDate).toDateString();
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    });
    return map;
  }, [eventsQ.data]);

  const dayEvents = selectedDay ? eventsByDay.get(selectedDay.toDateString()) || [] : [];

  const upcoming = upcomingQ.data || [];
  const nextUp = upcoming.find((e) => !e.completedAt && new Date(e.eventDate).getTime() >= Date.now() - 5 * 60000);
  const todayEvents = upcoming.filter((e) => isToday(new Date(e.eventDate)));
  const weekEvents  = upcoming.filter((e) => isThisWeek(new Date(e.eventDate)));

  // Apply category + text filter to a list (used for Today + Upcoming tabs)
  const matchesFilter = (e: MemoryEvent) => {
    if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      const blob = `${e.title} ${e.description || ""} ${e.project || ""} ${e.location || ""}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  };
  const filteredToday    = todayEvents.filter(matchesFilter);
  const filteredUpcoming = upcoming.filter(matchesFilter);
  const filtersActive    = categoryFilter !== "all" || searchQ.trim().length > 0;

  function toggleSpeak() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast({ title: "Voice not supported", description: "Your browser can't read aloud.", variant: "destructive" });
      return;
    }
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const u = speakAgenda(filteredToday.length ? filteredToday : todayEvents, voiceLang);
    if (u) {
      setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
    }
  }

  // ── Day navigation (calendar tab) ─────────────────────────────────────────
  function navDay(delta: -1 | 1) {
    if (!selectedDay) return;
    const next = new Date(selectedDay);
    next.setDate(next.getDate() + delta);
    setSelectedDay(next);
    if (next.getMonth() !== cursor.getMonth() || next.getFullYear() !== cursor.getFullYear()) {
      setCursor(new Date(next.getFullYear(), next.getMonth(), 1));
    }
  }

  function exportIcs(scope: "today" | "upcoming" | "all") {
    const list =
      scope === "today"    ? todayEvents :
      scope === "upcoming" ? upcoming :
                             [...(eventsQ.data || []), ...upcoming.filter((e) => !(eventsQ.data || []).some((m) => m.id === e.id))];
    if (list.length === 0) {
      toast({ title: "Nothing to export", description: "This list is empty.", variant: "destructive" });
      return;
    }
    downloadIcs(list, `memory-${scope}-${new Date().toISOString().slice(0,10)}.ics`);
    toast({ title: "Calendar exported ✓", description: `${list.length} ${list.length === 1 ? "entry" : "entries"} downloaded as .ics — open it in Apple/Google/Outlook.` });
  }

  // ── form helpers ──────────────────────────────────────────────────────────
  function openCreate(d?: Date) {
    setEditingId(null);
    const f = blankForm();
    if (d) {
      const dt = new Date(d); dt.setHours(9, 0, 0, 0);
      f.eventDate = toLocalInputValue(dt);
    }
    setForm(f);
    setDialogOpen(true);
  }

  function openEdit(e: MemoryEvent) {
    setEditingId(e.id);
    setForm({
      title: e.title,
      description: e.description || "",
      category: e.category,
      project: e.project || "",
      priority: e.priority,
      eventDate: toLocalInputValue(new Date(e.eventDate)),
      location: e.location || "",
      repeatRule: e.repeatRule,
      reminderOffsets: e.reminderOffsets || [60],
      reminderTone: e.reminderTone,
      notifyPush: e.notifyPush,
      notifyEmail: e.notifyEmail,
      isPrivate: e.isPrivate,
    });
    setDialogOpen(true);
  }

  function submitForm() {
    if (!form.title.trim()) { toast({ title: "Title required", variant: "destructive" }); return; }
    const payload: any = {
      ...form,
      eventDate: new Date(form.eventDate).toISOString(),
      project: form.project || null,
      location: form.location || null,
      description: form.description || null,
    };
    if (editingId) updateMut.mutate({ id: editingId, payload });
    else           createMut.mutate(payload);
  }

  function toggleOffset(min: number) {
    setForm((f) => ({
      ...f,
      reminderOffsets: f.reminderOffsets.includes(min)
        ? f.reminderOffsets.filter((x) => x !== min)
        : [...f.reminderOffsets, min].sort((a, b) => a - b),
    }));
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl space-y-4 sm:space-y-5 pb-24 sm:pb-6" data-testid="page-memory-calendar">
      {/* ── Hero Header ───────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-fuchsia-500 p-5 md:p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
              <Brain className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold leading-tight" data-testid="text-page-title">
                Memory Calendar
              </h1>
              <p className="text-sm text-white/80 mt-0.5">
                Speak it. Type it. Done. Reminders fire by push + email — Claude helps you prepare.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:flex md:flex-wrap md:justify-end gap-2 w-full md:w-auto">
            <Button
              size="default"
              variant="outline"
              onClick={() => enablePushMut.mutate()}
              disabled={enablePushMut.isPending}
              className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white font-medium backdrop-blur min-h-[44px] px-2 sm:px-3"
              data-testid="button-enable-push"
              title="Allow this device to receive push notifications (one-time setup)"
            >
              {enablePushMut.isPending
                ? <Loader2 className="w-4 h-4 sm:mr-1.5 animate-spin" />
                : <BellPlus className="w-4 h-4 sm:mr-1.5" />}
              <span className="hidden sm:inline">Enable push</span>
              <span className="sm:hidden text-xs">Push</span>
            </Button>
            <Button
              size="default"
              variant="outline"
              onClick={() => testReminderMut.mutate("both")}
              disabled={testReminderMut.isPending}
              className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white font-medium backdrop-blur min-h-[44px] px-2 sm:px-3"
              data-testid="button-test-reminder"
              title="Send a test push + email to yourself right now"
            >
              {testReminderMut.isPending
                ? <Loader2 className="w-4 h-4 sm:mr-1.5 animate-spin" />
                : <BellRing className="w-4 h-4 sm:mr-1.5" />}
              <span className="hidden sm:inline">Test reminder</span>
              <span className="sm:hidden text-xs">Test</span>
            </Button>
            <Button
              size="default"
              variant="outline"
              onClick={() => setSettingsOpen(true)}
              className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white font-medium backdrop-blur min-h-[44px] px-2 sm:px-3"
              data-testid="button-open-settings"
              title="Quiet hours, preferences"
            >
              <SettingsIcon className="w-4 h-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Settings</span>
              <span className="sm:hidden text-xs">Settings</span>
            </Button>
            <Button
              size="default"
              onClick={() => openCreate()}
              className="bg-white text-indigo-700 hover:bg-white/90 font-semibold shadow min-h-[44px] px-2 sm:px-3 col-span-2 sm:col-span-1"
              data-testid="button-add-event"
            >
              <Plus className="w-5 h-5 sm:mr-1.5" />
              <span className="hidden sm:inline">New entry</span>
              <span className="sm:hidden text-xs">New entry</span>
            </Button>
          </div>
        </div>
        {pushDiag && (
          <div
            className={cn(
              "mt-4 rounded-lg border px-3 sm:px-4 py-2.5 text-sm text-white/95 backdrop-blur flex flex-col sm:flex-row sm:items-center gap-2",
              pushDiagOk === true  ? "bg-emerald-600/30 border-emerald-400/40" :
              pushDiagOk === false ? "bg-rose-600/30 border-rose-400/40" :
                                     "bg-black/30 border-white/20",
            )}
            data-testid="text-push-diag"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {pushDiagOk === true  && <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />}
              {pushDiagOk === false && <XCircle className="w-4 h-4 text-rose-300 shrink-0" />}
              {pushDiagOk === null  && <Bell className="w-4 h-4 text-white/60 shrink-0" />}
              <span className="font-medium shrink-0">Push:</span>
              <span className="truncate">{pushDiag}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline"
                className="h-7 text-xs bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white"
                onClick={() => pushServerDiagMut.mutate()}
                disabled={pushServerDiagMut.isPending}
                data-testid="button-push-server-diag"
                title="Run server-side FCM diagnostic"
              >
                {pushServerDiagMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                <span className="ml-1 hidden sm:inline">Diagnose</span>
              </Button>
              <Button size="sm" variant="ghost"
                className="h-7 w-7 p-0 text-white/60 hover:text-white hover:bg-white/10"
                onClick={() => { setPushDiag(""); setPushDiagOk(null); }}
                data-testid="button-push-diag-close"
              >
                <XIcon className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Push diagnostic detail sheet */}
        {pushPanelOpen && pushDiagDetail && (
          <div
            className="mt-2 rounded-xl border border-white/20 bg-black/40 backdrop-blur p-4 text-xs text-white/90 space-y-2 animate-in slide-in-from-top-2 duration-200"
            data-testid="card-push-diag-detail"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm">FCM Diagnostic Detail</span>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-white/60 hover:text-white"
                onClick={() => setPushPanelOpen(false)}>
                <XIcon className="w-3.5 h-3.5" />
              </Button>
            </div>
            <pre className="whitespace-pre-wrap break-all text-[11px] text-white/80 max-h-48 overflow-y-auto rounded bg-black/30 p-2">
              {JSON.stringify(pushDiagDetail, null, 2)}
            </pre>
            <p className="text-white/50 text-[10px]">
              Check <code>tokenCount</code> (must be &gt; 0), <code>perToken[].error</code> for FCM codes.
              Common causes: APNs not configured (iOS), stale tokens, missing VAPID key (web).
            </p>
          </div>
        )}
      </div>

      {/* ── Quick Capture ─────────────────────────────────────────────────── */}
      <Card className="border-2 border-indigo-200 dark:border-indigo-900/50" data-testid="card-quick-capture">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wand2 className="w-5 h-5 text-indigo-600" />
            Quick capture
            <Badge variant="outline" className="ml-2 text-[10px] font-normal">AI</Badge>
          </CardTitle>
          <CardDescription>
            Just dump what's on your mind. Click 🎤 to dictate (English or Dutch). Then tap "Smart add" — AI fills out the calendar entry for you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Textarea
              value={capture}
              onChange={(e) => setCapture(e.target.value)}
              placeholder={voiceLang === "nl"
                ? "Bijv. Subsidie deadline volgende vrijdag om 17:00 voor BTTS"
                : "e.g. Subsidy deadline next Friday 5pm for BTTS — push & email reminder 1 day before"
              }
              rows={3}
              className="resize-none pr-14 text-base"
              data-testid="textarea-quick-capture"
            />
            {/* Floating mic button */}
            <button
              type="button"
              onClick={handleVoiceToggle}
              disabled={transcribing}
              className={cn(
                "absolute right-2 bottom-2 w-11 h-11 rounded-full flex items-center justify-center shadow-md transition-all",
                recorder.recording
                  ? "bg-rose-500 hover:bg-rose-600 text-white animate-pulse"
                  : transcribing
                  ? "bg-amber-500 text-white"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white",
              )}
              title={recorder.recording ? "Stop recording" : "Start voice dictation"}
              data-testid="button-voice-toggle"
            >
              {transcribing ? <Loader2 className="w-5 h-5 animate-spin" />
                : recorder.recording ? <Square className="w-5 h-5 fill-white" />
                : <Mic className="w-5 h-5" />}
            </button>
          </div>

          {/* Quick date presets — tap to append a natural-language hint */}
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground self-center mr-1">When:</span>
            {QUICK_DATES.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => {
                  const d = q.build();
                  const hint = ` (${d.toLocaleString(voiceLang === "nl" ? "nl-NL" : "en-US", { weekday: "short", hour: "2-digit", minute: "2-digit" })})`;
                  setCapture((c) => (c.trim() ? c.trim() + " " + q.label.toLowerCase() + hint : q.label + hint));
                }}
                className="text-xs px-2.5 py-1 rounded-full border bg-muted/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                data-testid={`chip-when-${q.label.toLowerCase().replace(/\s+/g, "-")}`}
              >{q.label}</button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Languages className="w-4 h-4 text-muted-foreground" />
              <div className="flex rounded-lg border overflow-hidden text-xs font-medium">
                <button
                  onClick={() => setVoiceLang("en")}
                  className={cn("px-3 py-1.5 transition-colors", voiceLang === "en"
                    ? "bg-indigo-600 text-white"
                    : "bg-muted/40 hover:bg-muted text-muted-foreground")}
                  data-testid="button-lang-en"
                >🇬🇧 English</button>
                <button
                  onClick={() => setVoiceLang("nl")}
                  className={cn("px-3 py-1.5 transition-colors", voiceLang === "nl"
                    ? "bg-orange-500 text-white"
                    : "bg-muted/40 hover:bg-muted text-muted-foreground")}
                  data-testid="button-lang-nl"
                >🇳🇱 Nederlands</button>
              </div>
              {recorder.recording && (
                <span className="text-xs font-mono text-rose-600 dark:text-rose-400">
                  ● REC {String(Math.floor(recorder.elapsed / 60)).padStart(2, "0")}:{String(recorder.elapsed % 60).padStart(2, "0")}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setCapture("")}
                disabled={!capture}
                data-testid="button-clear-capture"
              >Clear</Button>
              <Button
                onClick={() => parseMut.mutate()}
                disabled={!capture.trim() || parseMut.isPending}
                className="bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-700 hover:to-fuchsia-700 text-white"
                data-testid="button-smart-add"
              >
                {parseMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Smart add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Next Up + Stats row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Next Up — spans 2 cols */}
        <Card className="lg:col-span-2 overflow-hidden" data-testid="card-next-up">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Next up</CardTitle>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {nextUp ? (
              <div className="flex items-start gap-4">
                <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center shrink-0", catMeta(nextUp.category).tint)}>
                  {(() => { const I = catMeta(nextUp.category).icon; return <I className="w-7 h-7 text-white" />; })()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold truncate" data-testid="text-next-up-title">{nextUp.title}</h2>
                    <Badge className="bg-indigo-600 text-white">{timeUntil(nextUp.eventDate)}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{fmtTime(nextUp.eventDate)}</span>
                    {nextUp.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{nextUp.location}</span>}
                    {nextUp.project && <span className="flex items-center gap-1"><Tag className="w-3.5 h-3.5" />{nextUp.project}</span>}
                  </div>
                  {nextUp.description && <p className="text-sm mt-2 line-clamp-2">{nextUp.description}</p>}
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="default" onClick={() => prepareMut.mutate(nextUp.id)} data-testid="button-next-up-prep">
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Prep with AI
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEdit(nextUp)} data-testid="button-next-up-edit">
                      <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => completeMut.mutate(nextUp.id)} data-testid="button-next-up-done">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Done
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nothing on the horizon. Take a breath, or capture something above. ✨</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats stack */}
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
          <MiniStat label="Today"    value={todayEvents.length}                  icon={Clock}     accent="from-amber-500 to-orange-500" />
          <MiniStat label="This week" value={weekEvents.length}                  icon={CalendarDays} accent="from-indigo-500 to-purple-500" />
          <MiniStat label="Reminders queued" value={Number(statsQ.data?.pending ?? 0)} icon={Bell}      accent="from-sky-500 to-cyan-500" />
          <MiniStat label="Delivered" value={Number(statsQ.data?.delivered ?? 0)} icon={CheckCircle2} accent="from-emerald-500 to-teal-500" />
        </div>
      </div>

      {/* ── Filter + Search bar ───────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-3 space-y-3" data-testid="bar-filters">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search by title, project, location…"
              className="pl-8 pr-8 h-10"
              data-testid="input-search"
            />
            {searchQ && (
              <button
                onClick={() => setSearchQ("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full hover:bg-muted flex items-center justify-center"
                data-testid="button-clear-search"
                aria-label="Clear search"
                title="Clear search"
              ><XIcon className="w-3.5 h-3.5" /></button>
            )}
          </div>
          {filtersActive && (
            <Button
              size="sm" variant="ghost"
              onClick={() => { setSearchQ(""); setCategoryFilter("all"); }}
              data-testid="button-clear-filters"
              className="shrink-0"
            ><XIcon className="w-3.5 h-3.5 mr-1" /> Clear</Button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setCategoryFilter("all")}
            aria-pressed={categoryFilter === "all"}
            aria-label="Show all categories"
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1.5 min-h-[32px]",
              categoryFilter === "all"
                ? "bg-foreground text-background border-foreground"
                : "bg-muted/40 hover:bg-muted text-muted-foreground"
            )}
            data-testid="chip-cat-all"
          ><Filter className="w-3 h-3" /> All</button>
          {CATEGORIES.map((c) => {
            const active = categoryFilter === c.value;
            const Icon = c.icon;
            return (
              <button
                key={c.value}
                onClick={() => setCategoryFilter(active ? "all" : c.value)}
                aria-pressed={active}
                aria-label={`Filter by ${c.label}`}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1.5 min-h-[32px]",
                  active
                    ? cn(c.tint, "text-white border-transparent")
                    : "bg-muted/40 hover:bg-muted"
                )}
                data-testid={`chip-cat-${c.value}`}
              ><Icon className="w-3 h-3" /> {c.label}</button>
            );
          })}
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList
          className={cn(
            "grid w-full md:w-auto md:inline-grid h-11",
            isSuperAdmin ? "grid-cols-7" : "grid-cols-6",
          )}
          data-testid="tabs-memory"
        >
          <TabsTrigger value="today"    data-testid="tab-today" className="text-xs sm:text-sm">Today</TabsTrigger>
          <TabsTrigger value="upcoming" data-testid="tab-upcoming" className="text-xs sm:text-sm">Upcoming</TabsTrigger>
          <TabsTrigger value="calendar" data-testid="tab-calendar" className="text-xs sm:text-sm">Calendar</TabsTrigger>
          <TabsTrigger value="ai"       data-testid="tab-ai" className="text-xs sm:text-sm">AI</TabsTrigger>
          <TabsTrigger value="notes"    data-testid="tab-notes" className="text-xs sm:text-sm flex items-center gap-1">
            <FileText className="w-3 h-3" />Notes
          </TabsTrigger>
          <TabsTrigger value="google"   data-testid="tab-google" className="text-xs sm:text-sm flex items-center gap-1">
            <img src="https://www.google.com/favicon.ico" className="w-3 h-3" alt="" />
            Google
          </TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="access" data-testid="tab-access" className="text-xs sm:text-sm">Access</TabsTrigger>}
        </TabsList>

        {/* ── Today ──────────────────────────────────────────────────────── */}
        <TabsContent value="today" className="space-y-3">
          {/* Today toolbar — speak aloud + export ICS */}
          {todayEvents.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="toolbar-today">
              <Button
                size="sm"
                variant={speaking ? "default" : "outline"}
                onClick={toggleSpeak}
                className={speaking ? "bg-rose-500 hover:bg-rose-600 text-white" : ""}
                data-testid="button-speak-today"
              >
                {speaking ? <VolumeX className="w-4 h-4 mr-1.5" /> : <Volume2 className="w-4 h-4 mr-1.5" />}
                {speaking ? "Stop" : "Read aloud"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportIcs("today")} data-testid="button-export-today">
                <Download className="w-4 h-4 mr-1.5" /> Export today (.ics)
              </Button>
              <span className="ml-auto text-xs text-muted-foreground">
                {filtersActive
                  ? `${filteredToday.length} of ${todayEvents.length} shown`
                  : `${todayEvents.length} ${todayEvents.length === 1 ? "entry" : "entries"} today`}
              </span>
            </div>
          )}
          {todayEvents.length === 0 ? (
            <EmptyState
              title="No entries for today"
              hint="Use Quick capture above or hit ‘New entry’ to add one."
            />
          ) : filteredToday.length === 0 ? (
            <EmptyState title="No matches" hint="Try clearing your filter or search above." />
          ) : (
            filteredToday.map((e) => (
              <EventRow key={e.id} event={e}
                onEdit={openEdit}
                onDelete={(id) => deleteMut.mutate(id)}
                onComplete={(id) => completeMut.mutate(id)}
                onPrep={(id) => prepareMut.mutate(id)}
                onSnooze={(event, when) => snoozeMut.mutate({ id: event.id, newDate: when, event })} />
            ))
          )}
        </TabsContent>

        {/* ── Upcoming list ─────────────────────────────────────────────── */}
        <TabsContent value="upcoming" className="space-y-3">
          {upcoming.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="toolbar-upcoming">
              <Button size="sm" variant="outline" onClick={() => exportIcs("upcoming")} data-testid="button-export-upcoming">
                <Download className="w-4 h-4 mr-1.5" /> Export next 60d (.ics)
              </Button>
              <span className="ml-auto text-xs text-muted-foreground">
                {filtersActive
                  ? `${filteredUpcoming.length} of ${upcoming.length} shown`
                  : `${upcoming.length} ${upcoming.length === 1 ? "entry" : "entries"}`}
              </span>
            </div>
          )}
          {upcomingQ.isLoading && <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin inline" /></div>}
          {upcoming.length === 0 && !upcomingQ.isLoading && (
            <EmptyState title="Nothing scheduled in the next 60 days" hint="Quiet stretch. Plan ahead with Quick capture." />
          )}
          {upcoming.length > 0 && filteredUpcoming.length === 0 && (
            <EmptyState title="No matches" hint="Try clearing your filter or search above." />
          )}
          {filteredUpcoming.map((e) => (
            <EventRow key={e.id} event={e}
              onEdit={openEdit}
              onDelete={(id) => deleteMut.mutate(id)}
              onComplete={(id) => completeMut.mutate(id)}
              onPrep={(id) => prepareMut.mutate(id)}
              onSnooze={(event, when) => snoozeMut.mutate({ id: event.id, newDate: when, event })} />
          ))}
        </TabsContent>

        {/* ── Calendar ──────────────────────────────────────────────────── */}
        <TabsContent value="calendar" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 px-3 sm:px-6">
              <div className="flex items-center gap-1 sm:gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 shrink-0" onClick={() => setCursor((c) => addMonths(c, -1))} data-testid="button-prev-month">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <CardTitle className="flex-1 text-center text-sm sm:text-base capitalize" data-testid="text-month-label">
                  {cursor.toLocaleString("nl-NL", { month: "long", year: "numeric" })}
                </CardTitle>
                <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 shrink-0" onClick={() => setCursor((c) => addMonths(c, 1))} data-testid="button-next-month">
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" className="shrink-0 h-8 text-xs sm:text-sm px-2 sm:px-3" onClick={() => { setCursor(new Date()); setSelectedDay(new Date()); }} data-testid="button-today">
                  Today
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              <div className="grid grid-cols-7 gap-0.5 sm:gap-1 text-[10px] sm:text-xs font-medium text-muted-foreground mb-1 sm:mb-2">
                {(["Mo","Di","Wo","Do","Vr","Za","Zo"] as const).map((d, i) => (
                  <div key={d} className={cn("text-center py-1", i >= 5 && "text-muted-foreground/60")}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
                {grid.map((d, i) => {
                  if (!d) return <div key={i} className="h-[48px] sm:h-[72px] rounded-md bg-muted/30" />;
                  const events = eventsByDay.get(d.toDateString()) || [];
                  const today = isToday(d);
                  const isSelected = selectedDay && sameDay(d, selectedDay);
                  const isWeekend = i % 7 >= 5;
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDay(sameDay(d, selectedDay || new Date(-1)) ? null : d)}
                      onDoubleClick={() => openCreate(d)}
                      data-testid={`cell-day-${d.getDate()}`}
                      className={cn(
                        "h-[48px] sm:h-[72px] rounded-lg p-1 sm:p-1.5 text-left flex flex-col gap-0.5 transition-all border-2 active:scale-95",
                        isSelected ? "border-indigo-500 ring-2 ring-indigo-500/30 bg-indigo-50 dark:bg-indigo-950/40" :
                        today      ? "border-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/20" :
                        events.length ? "border-border bg-card hover:border-indigo-300" :
                                        "border-transparent hover:border-border hover:bg-muted/50",
                        isWeekend && !isSelected && !today && "bg-muted/20",
                      )}
                    >
                      <span className={cn(
                        "text-[11px] sm:text-xs font-bold leading-none",
                        today ? "text-indigo-600 dark:text-indigo-400" :
                        isWeekend ? "text-muted-foreground" : "text-foreground",
                      )}>
                        {d.getDate()}
                      </span>
                      <div className="flex-1 flex flex-col gap-px overflow-hidden">
                        {events.slice(0, 1).map((e) => (
                          <div
                            key={e.id}
                            title={e.title}
                            className={cn(
                              "text-[9px] sm:text-[10px] leading-tight px-0.5 sm:px-1 py-px rounded truncate text-white",
                              e.priority === "urgent" ? "bg-rose-500" :
                              e.priority === "high"   ? "bg-amber-500" :
                              catMeta(e.category).tint,
                            )}
                          >
                            <span className="hidden sm:inline">{e.title}</span>
                            <span className="sm:hidden">●</span>
                          </div>
                        ))}
                        {events.length > 1 && (
                          <div className="text-[9px] sm:text-[10px] text-muted-foreground leading-none">
                            <span className="hidden sm:inline">+{events.length - 1} more</span>
                            <span className="sm:hidden text-indigo-500 font-bold">{events.length}</span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {selectedDay && (
            <DayDetailPanel
              day={selectedDay}
              events={dayEvents}
              onPrevDay={() => navDay(-1)}
              onNextDay={() => navDay(1)}
              onClose={() => setSelectedDay(null)}
              onEdit={openEdit}
              onDelete={(id) => deleteMut.mutate(id)}
              onComplete={(id) => completeMut.mutate(id)}
              onPrep={(id) => prepareMut.mutate(id)}
              onSnooze={(event, when) => snoozeMut.mutate({ id: event.id, newDate: when, event })}
              onAddEvent={openCreate}
            />
          )}
        </TabsContent>

        {/* ── AI Assistant ───────────────────────────────────────────────── */}
        <TabsContent value="ai" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                Summarize my upcoming days
              </CardTitle>
              <CardDescription>Claude groups your entries by week, surfaces priorities, ends with a 1-line plan.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 items-center flex-wrap">
                <Label className="text-sm">Horizon:</Label>
                <Select value={String(aiHorizon)} onValueChange={(v) => setAiHorizon(Number(v))}>
                  <SelectTrigger className="w-40" data-testid="select-ai-horizon"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Next 7 days</SelectItem>
                    <SelectItem value="14">Next 14 days</SelectItem>
                    <SelectItem value="30">Next 30 days</SelectItem>
                    <SelectItem value="60">Next 60 days</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={() => summarizeMut.mutate()} disabled={summarizeMut.isPending} data-testid="button-ai-summarize">
                  {summarizeMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Brain className="w-4 h-4 mr-2" />}
                  Generate summary
                </Button>
              </div>
              {aiSummary && (
                <div className="rounded-lg border bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 p-4 whitespace-pre-wrap text-sm leading-relaxed" data-testid="text-ai-summary">
                  {aiSummary}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                Latest preparation brief
              </CardTitle>
              <CardDescription>Click "Prep with AI" on any entry to generate a brief here.</CardDescription>
            </CardHeader>
            <CardContent>
              {prepareMut.isPending && <div className="text-center py-6"><Loader2 className="w-5 h-5 animate-spin inline" /></div>}
              {!prepareMut.isPending && aiPrep && (
                <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/30 p-4 whitespace-pre-wrap text-sm leading-relaxed" data-testid="text-ai-prep">
                  {aiPrep}
                </div>
              )}
              {!prepareMut.isPending && !aiPrep && (
                <p className="text-sm text-muted-foreground text-center py-6">No brief yet — try "Prep with AI" on any entry above.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Notes ──────────────────────────────────────────────────── */}
        <TabsContent value="notes" className="space-y-4">
          <NotesTab />
        </TabsContent>

        {/* ── Google Connect ───────────────────────────────────────────── */}
        <TabsContent value="google" className="space-y-4">
          <GoogleSyncTab />
        </TabsContent>

        {/* ── Access Control ───────────────────────────────────────────── */}
        {isSuperAdmin && (
          <TabsContent value="access" className="space-y-4">
            <AccessTab />
          </TabsContent>
        )}
      </Tabs>

      {/* ── Settings Dialog (quiet hours) ─────────────────────────────── */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Moon className="w-5 h-5 text-indigo-600" /> Quiet hours
            </DialogTitle>
            <DialogDescription>
              Reminders that would fire inside this window are pushed to its end. Perfect for sleep.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div>
                <div className="font-medium">Enable quiet hours</div>
                <div className="text-xs text-muted-foreground">Disabled = no shifting; reminders fire on time.</div>
              </div>
              <Switch
                checked={quietForm.enabled}
                onCheckedChange={(v) => setQuietForm({ ...quietForm, enabled: v })}
                data-testid="switch-quiet-hours"
              />
            </label>
            <div className={cn("grid grid-cols-2 gap-3", !quietForm.enabled && "opacity-50 pointer-events-none")}>
              <div>
                <Label htmlFor="qh-start">From</Label>
                <Input id="qh-start" type="time" value={quietForm.start}
                  onChange={(e) => setQuietForm({ ...quietForm, start: e.target.value })}
                  data-testid="input-qh-start" />
              </div>
              <div>
                <Label htmlFor="qh-end">Until</Label>
                <Input id="qh-end" type="time" value={quietForm.end}
                  onChange={(e) => setQuietForm({ ...quietForm, end: e.target.value })}
                  data-testid="input-qh-end" />
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Window may cross midnight (e.g. 23:00 → 07:00). Updating shifts every pending reminder for upcoming events.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)} data-testid="button-settings-cancel">
              Cancel
            </Button>
            <Button
              onClick={() => settingsMut.mutate({
                quietHoursStart: quietForm.enabled ? quietForm.start : null,
                quietHoursEnd:   quietForm.enabled ? quietForm.end   : null,
              })}
              disabled={settingsMut.isPending}
              data-testid="button-settings-save"
            >
              {settingsMut.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
              Save quiet hours
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add / Edit Dialog ─────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit entry" : "New calendar entry"}</DialogTitle>
            <DialogDescription>Reminders fire by push and/or email at the offsets you choose, in the tone you pick.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Subsidy deadline, partnership call, …" data-testid="input-title" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="date">Date & time</Label>
                <Input id="date" type="datetime-local" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} data-testid="input-event-date" />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger data-testid="select-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as any })}>
                  <SelectTrigger data-testid="select-priority"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Project</Label>
                <Input value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} placeholder="Back to the Street, Coffee & Dance, …" data-testid="input-project" />
              </div>
            </div>

            <div>
              <Label>Location</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Optional" data-testid="input-location" />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Notes, agenda, why this matters…" data-testid="textarea-description" />
            </div>

            <Separator />

            <div>
              <Label className="flex items-center gap-2"><Bell className="w-4 h-4" /> Reminders</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {REMINDER_PRESETS.map((p) => {
                  const active = form.reminderOffsets.includes(p.value);
                  return (
                    <Button key={p.value} type="button" size="sm" variant={active ? "default" : "outline"} onClick={() => toggleOffset(p.value)} data-testid={`button-offset-${p.value}`}>
                      {p.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Reminder tone</Label>
                <Select value={form.reminderTone} onValueChange={(v) => setForm({ ...form, reminderTone: v as any })}>
                  <SelectTrigger data-testid="select-tone"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TONES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Repeat</Label>
                <Select value={form.repeatRule} onValueChange={(v) => setForm({ ...form, repeatRule: v as any })}>
                  <SelectTrigger data-testid="select-repeat"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No repeat</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 pt-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Switch checked={form.notifyPush} onCheckedChange={(v) => setForm({ ...form, notifyPush: v })} data-testid="switch-push" />
                <Bell className="w-4 h-4 text-indigo-600" /> Push
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Switch checked={form.notifyEmail} onCheckedChange={(v) => setForm({ ...form, notifyEmail: v })} data-testid="switch-email" />
                <Mail className="w-4 h-4 text-sky-600" /> Email
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Switch checked={form.isPrivate} onCheckedChange={(v) => setForm({ ...form, isPrivate: v })} data-testid="switch-private" />
                Private
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel">Cancel</Button>
            <Button onClick={submitForm} disabled={createMut.isPending || updateMut.isPending} data-testid="button-save">
              {(createMut.isPending || updateMut.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editingId ? "Save changes" : "Create entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Mobile sticky FAB — always-reachable "New entry" ──────────────── */}
      <button
        onClick={() => openCreate()}
        className="sm:hidden fixed bottom-4 right-4 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-600 to-fuchsia-600 text-white shadow-2xl flex items-center justify-center active:scale-95 transition-transform"
        data-testid="button-fab-add"
        aria-label="New entry"
      >
        <Plus className="w-7 h-7" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small components
// ─────────────────────────────────────────────────────────────────────────────

function MiniStat({ label, value, icon: Icon, accent }: { label: string; value: number; icon: any; accent: string }) {
  return (
    <Card data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="p-3 flex items-center gap-3">
        <div className={cn("w-9 h-9 rounded-lg bg-gradient-to-br flex items-center justify-center text-white shrink-0", accent)}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wide truncate">{label}</div>
          <div className="text-xl font-bold leading-tight">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <div className="w-14 h-14 mx-auto rounded-full bg-indigo-100 dark:bg-indigo-950/50 flex items-center justify-center mb-3">
          <Sparkles className="w-6 h-6 text-indigo-600" />
        </div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground mt-1">{hint}</p>
      </CardContent>
    </Card>
  );
}

function EventRow({
  event, onEdit, onDelete, onComplete, onPrep, onSnooze,
}: {
  event: MemoryEvent;
  onEdit: (e: MemoryEvent) => void;
  onDelete: (id: number) => void;
  onComplete: (id: number) => void;
  onPrep: (id: number) => void;
  onSnooze?: (event: MemoryEvent, newDate: Date) => void;
}) {
  const prio = PRIORITIES.find((p) => p.value === event.priority);
  const cat  = catMeta(event.category);
  const Icon = cat.icon;
  const overdue = !event.completedAt && new Date(event.eventDate).getTime() < Date.now();

  return (
    <div
      className={cn(
        "rounded-xl border p-3 flex flex-col sm:flex-row sm:items-start gap-3 hover-elevate transition-all",
        event.completedAt && "opacity-60",
        event.priority === "urgent" && "border-rose-300 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/10",
        overdue && "ring-1 ring-amber-400/40",
      )}
      data-testid={`row-event-${event.id}`}
    >
      <div className={cn("flex-shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center", cat.tint)}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold truncate" data-testid={`text-event-title-${event.id}`}>{event.title}</h3>
          {prio && <Badge variant="outline" className={cn(prio.color, "text-[10px]")}>{prio.label}</Badge>}
          {event.project && <Badge variant="outline" className="text-[10px]"><Tag className="w-3 h-3 mr-1" />{event.project}</Badge>}
          <Badge variant="outline" className={cn("text-[10px]", overdue && "border-amber-500 text-amber-700 dark:text-amber-300")}>
            {timeUntil(event.eventDate)}
          </Badge>
          {event.repeatRule && event.repeatRule !== "none" && (
            <Badge
              variant="outline"
              className="text-[10px] border-violet-300 dark:border-violet-800 text-violet-700 dark:text-violet-300"
              data-testid={`badge-repeat-${event.id}`}
              title={`Repeats ${event.repeatRule}`}
            >
              <Repeat className="w-3 h-3 mr-1" />{event.repeatRule}
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtTime(event.eventDate)}</span>
          {event.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{event.location}</span>}
          {event.notifyPush  && <span className="flex items-center gap-1"><Bell className="w-3 h-3" />push</span>}
          {event.notifyEmail && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />email</span>}
        </div>
        {event.description && <p className="text-sm mt-2 line-clamp-2">{event.description}</p>}
        {event.aiPreparation && (
          <div className="mt-2 rounded bg-indigo-50 dark:bg-indigo-950/40 p-2 text-xs text-indigo-900 dark:text-indigo-200">
            <Sparkles className="w-3 h-3 inline mr-1" /> {event.aiPreparation.slice(0, 200)}
          </div>
        )}
      </div>
      {/* Actions — wraps to its own row on mobile, column on tablet+ */}
      <div className="flex sm:flex-col gap-1 flex-wrap sm:flex-nowrap sm:w-auto w-full">
        <Button size="sm" variant="outline" onClick={() => onPrep(event.id)} data-testid={`button-prep-${event.id}`} className="min-h-[36px]">
          <Sparkles className="w-3.5 h-3.5 sm:mr-1" /> <span className="sm:inline">Prep</span>
        </Button>
        {!event.completedAt && onSnooze && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" data-testid={`button-snooze-${event.id}`} className="min-h-[36px]" title="Snooze">
                <AlarmClock className="w-3.5 h-3.5 sm:mr-1" /> <span className="sm:inline">Snooze</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-xs">Push reminder to…</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {SNOOZE_PRESETS.map((p) => {
                const target = snoozeDateFor(p, new Date(event.eventDate));
                return (
                  <DropdownMenuItem
                    key={p.label}
                    onClick={() => onSnooze(event, target)}
                    data-testid={`menu-snooze-${event.id}-${p.label.toLowerCase().replace(/\s+/g, "-")}`}
                    className="flex items-center justify-between gap-3"
                  >
                    <span>{p.label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {target.toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button size="sm" variant="outline" onClick={() => onEdit(event)} data-testid={`button-edit-${event.id}`} className="min-h-[36px]">
          <Edit3 className="w-3.5 h-3.5" />
        </Button>
        {!event.completedAt && (
          <Button size="sm" variant="outline" onClick={() => onComplete(event.id)} data-testid={`button-complete-${event.id}`} className="min-h-[36px]">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => onDelete(event.id)} data-testid={`button-delete-${event.id}`} className="min-h-[36px]">
          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DayEventCard — compact timeline-style card used inside DayDetailPanel
// ─────────────────────────────────────────────────────────────────────────────
function DayEventCard({
  event, onEdit, onDelete, onComplete, onPrep, onSnooze,
}: {
  event: MemoryEvent;
  onEdit: (e: MemoryEvent) => void;
  onDelete: (id: number) => void;
  onComplete: (id: number) => void;
  onPrep: (id: number) => void;
  onSnooze?: (event: MemoryEvent, newDate: Date) => void;
}) {
  const cat   = catMeta(event.category);
  const CatIcon = cat.icon;
  const prio  = PRIORITIES.find((p) => p.value === event.priority);
  const overdue = !event.completedAt && new Date(event.eventDate).getTime() < Date.now();
  const time  = event.allDay
    ? "All day"
    : new Date(event.eventDate).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      className={cn(
        "relative flex gap-0 rounded-xl border bg-card overflow-hidden group transition-all hover:shadow-sm",
        event.completedAt && "opacity-55",
        event.priority === "urgent" && "border-rose-300 dark:border-rose-900/50",
        overdue && !event.completedAt && "border-amber-300 dark:border-amber-800/50",
      )}
      data-testid={`day-card-event-${event.id}`}
    >
      {/* colored left stripe */}
      <div className={cn("w-1 shrink-0", cat.tint)} />

      {/* time + icon column */}
      <div className="px-2 pt-3 pb-3 w-[60px] shrink-0 flex flex-col items-center gap-1.5">
        <span className="text-xs font-bold tabular-nums leading-tight text-center">{time}</span>
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", cat.tint)}>
          <CatIcon className="w-3.5 h-3.5 text-white" />
        </div>
      </div>

      {/* content */}
      <div className="flex-1 min-w-0 py-2.5 pr-1">
        <div className="flex items-start gap-1.5 flex-wrap">
          <span className={cn("font-semibold text-sm leading-snug", event.completedAt && "line-through text-muted-foreground")}>
            {event.title}
          </span>
          {prio && prio.value !== "normal" && (
            <Badge variant="outline" className={cn("text-[10px] shrink-0 h-4", prio.color)}>{prio.label}</Badge>
          )}
          {overdue && !event.completedAt && (
            <Badge variant="outline" className="text-[10px] h-4 border-amber-400 text-amber-700 dark:text-amber-400">overdue</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
          {event.location && (
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{event.location}</span>
          )}
          {event.project && (
            <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{event.project}</span>
          )}
          {event.repeatRule && event.repeatRule !== "none" && (
            <span className="flex items-center gap-1"><Repeat className="w-3 h-3" />{event.repeatRule}</span>
          )}
        </div>
        {event.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{event.description}</p>
        )}
        {event.aiPreparation && (
          <div className="mt-1 flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400">
            <Sparkles className="w-3 h-3 shrink-0" />
            <span className="line-clamp-1 text-[11px]">{event.aiPreparation.slice(0, 120)}</span>
          </div>
        )}
      </div>

      {/* actions — always visible on mobile, appear on hover on desktop */}
      <div className="flex flex-col gap-px py-1.5 pr-1.5 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onPrep(event.id)}
          title="Prep with AI" data-testid={`day-btn-prep-${event.id}`}>
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(event)}
          title="Edit" data-testid={`day-btn-edit-${event.id}`}>
          <Edit3 className="w-3.5 h-3.5" />
        </Button>
        {!event.completedAt && (
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onComplete(event.id)}
            title="Mark done" data-testid={`day-btn-complete-${event.id}`}>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </Button>
        )}
        {!event.completedAt && onSnooze && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7" title="Snooze"
                data-testid={`day-btn-snooze-${event.id}`}>
                <AlarmClock className="w-3.5 h-3.5 text-amber-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-xs">Push reminder to…</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {SNOOZE_PRESETS.map((p) => {
                const target = snoozeDateFor(p, new Date(event.eventDate));
                return (
                  <DropdownMenuItem key={p.label} onClick={() => onSnooze(event, target)}
                    data-testid={`day-snooze-${event.id}-${p.label.toLowerCase().replace(/\s+/g, "-")}`}
                    className="flex items-center justify-between gap-3">
                    <span>{p.label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {target.toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDelete(event.id)}
          title="Delete" data-testid={`day-btn-delete-${event.id}`}>
          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DayDetailPanel — rich day view with time-grouped events and navigation
// ─────────────────────────────────────────────────────────────────────────────
function DayDetailPanel({
  day, events, onPrevDay, onNextDay, onClose,
  onEdit, onDelete, onComplete, onPrep, onSnooze, onAddEvent,
}: {
  day: Date;
  events: MemoryEvent[];
  onPrevDay: () => void;
  onNextDay: () => void;
  onClose: () => void;
  onEdit: (e: MemoryEvent) => void;
  onDelete: (id: number) => void;
  onComplete: (id: number) => void;
  onPrep: (id: number) => void;
  onSnooze: (event: MemoryEvent, newDate: Date) => void;
  onAddEvent: (d: Date) => void;
}) {
  const todayFlag = isToday(day);

  const sorted = [...events].sort(
    (a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
  );
  const allDayEvts  = sorted.filter((e) => e.allDay);
  const timedEvts   = sorted.filter((e) => !e.allDay);
  const getHour     = (e: MemoryEvent) => new Date(e.eventDate).getHours();
  const morning     = timedEvts.filter((e) => getHour(e) < 12);
  const afternoon   = timedEvts.filter((e) => getHour(e) >= 12 && getHour(e) < 17);
  const evening     = timedEvts.filter((e) => getHour(e) >= 17);

  type Group = { label: string; icon: any; events: MemoryEvent[] };
  const groups: Group[] = [
    ...(allDayEvts.length ? [{ label: "All day",   icon: CalendarDays, events: allDayEvts }] : []),
    ...(morning.length    ? [{ label: "Morning",   icon: Clock,        events: morning    }] : []),
    ...(afternoon.length  ? [{ label: "Afternoon", icon: Clock,        events: afternoon  }] : []),
    ...(evening.length    ? [{ label: "Evening",   icon: Clock,        events: evening    }] : []),
  ];

  return (
    <Card
      className="border-2 border-indigo-200 dark:border-indigo-800/60 shadow-lg animate-in slide-in-from-bottom-2 duration-200"
      data-testid="card-day-detail"
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <CardHeader className="pb-2 px-3 sm:px-6">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onPrevDay}
            data-testid="button-day-prev" title="Previous day">
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="flex-1 min-w-0 px-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm sm:text-base capitalize truncate">
                {day.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}
              </span>
              {todayFlag && (
                <Badge className="bg-indigo-600 text-white text-[10px] shrink-0 h-4 px-1.5">Vandaag</Badge>
              )}
              <Badge variant="outline" className="text-[10px] shrink-0 h-4 px-1.5">
                {events.length} {events.length === 1 ? "entry" : "entries"}
              </Badge>
              <span className="text-xs text-muted-foreground">{day.getFullYear()}</span>
            </div>
          </div>

          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onNextDay}
            data-testid="button-day-next" title="Next day">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button size="sm"
            className="hidden sm:flex bg-indigo-600 hover:bg-indigo-700 text-white h-8 shrink-0"
            onClick={() => onAddEvent(day)} data-testid="button-day-add">
            <Plus className="w-3.5 h-3.5 mr-1" /> Add
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}
            data-testid="button-day-close" title="Close panel">
            <XIcon className="w-4 h-4" />
          </Button>
        </div>

        {/* Mobile add button */}
        <Button size="sm"
          className="sm:hidden mt-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white"
          onClick={() => onAddEvent(day)} data-testid="button-day-add-mobile">
          <Plus className="w-4 h-4 mr-1.5" /> Add event on this day
        </Button>
      </CardHeader>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <CardContent className="px-3 sm:px-6 pb-4 space-y-4">
        {events.length === 0 ? (
          /* Empty state */
          <div className="py-10 text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-950/60 dark:to-purple-950/60 flex items-center justify-center">
              <CalendarDays className="w-7 h-7 text-indigo-400" />
            </div>
            <div>
              <p className="font-semibold text-sm">Nothing scheduled</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {todayFlag ? "Your day is wide open." : "Nothing planned for this day yet."}
              </p>
            </div>
            <Button variant="outline" size="sm" className="border-indigo-300 text-indigo-600 dark:border-indigo-700 dark:text-indigo-400"
              onClick={() => onAddEvent(day)} data-testid="button-day-empty-add">
              <Plus className="w-4 h-4 mr-1" /> Create entry
            </Button>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label}>
              {/* Group heading */}
              <div className="flex items-center gap-2 mb-2">
                <group.icon className="w-3 h-3 text-muted-foreground" />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {group.label}
                </span>
                <div className="flex-1 h-px bg-border" />
                <span className="text-[11px] text-muted-foreground">{group.events.length}</span>
              </div>
              {/* Event cards */}
              <div className="space-y-2">
                {group.events.map((e) => (
                  <DayEventCard
                    key={e.id}
                    event={e}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onComplete={onComplete}
                    onPrep={onPrep}
                    onSnooze={onSnooze}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inbox Browser — shows real Gmail emails for a connection
// ─────────────────────────────────────────────────────────────────────────────
// Category config
// ─────────────────────────────────────────────────────────────────────────────
const CAT_META: Record<string, { label: string; color: string; icon: any }> = {
  marketing:    { label: "Marketing",    color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",       icon: ShoppingBag },
  newsletter:   { label: "Newsletter",   color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300", icon: Rss },
  notification: { label: "Notification", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300", icon: Bell },
  receipt:      { label: "Receipt",      color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",   icon: Receipt },
  social:       { label: "Social",       color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300", icon: Share2 },
  appointment:  { label: "Appointment",  color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", icon: CalendarCheck },
  personal:     { label: "Personal",     color: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",   icon: UserCheck },
  work:         { label: "Work",         color: "bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300", icon: Briefcase },
  spam:         { label: "Spam",         color: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",   icon: TriangleAlert },
  other:        { label: "Other",        color: "bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400",   icon: Archive },
};

const JUNK_CATS = new Set(["marketing", "newsletter", "spam", "social", "notification"]);

// ─────────────────────────────────────────────────────────────────────────────
// GmailOrganizer component
// ─────────────────────────────────────────────────────────────────────────────
type OrganizerProvider = "openai" | "anthropic";

const PROVIDER_META: Record<OrganizerProvider, { label: string; model: string; color: string }> = {
  openai:    { label: "OpenAI",    model: "gpt-4o-mini",       color: "text-emerald-600 dark:text-emerald-400" },
  anthropic: { label: "Anthropic", model: "claude-haiku-4-5",  color: "text-violet-600 dark:text-violet-400"   },
};

function GmailOrganizer({ connId, email }: { connId: number; email: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [catFilter, setCatFilter]   = useState<string>("all");
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [trashing, setTrashing]     = useState(false);
  const [provider, setProvider]     = useState<OrganizerProvider>("openai");

  const organizeQ = useQuery<any>({
    queryKey: ["/api/google-sync/organize", connId],
    queryFn: async () => {
      const r = await fetch(`/api/google-sync/organize/${connId}`, { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    refetchInterval: (data) => data?.status === "running" ? 2000 : false,
    staleTime: 0,
  });

  const scanMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest(`/api/google-sync/organize/${connId}/scan`, "POST", { provider });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      const pm = PROVIDER_META[provider];
      toast({
        title: "Scan started",
        description: `${pm.label} (${pm.model}) is categorising your emails in parallel — much faster now.`,
      });
      setTimeout(() => qc.invalidateQueries({ queryKey: ["/api/google-sync/organize", connId] }), 800);
    },
    onError: (e: any) => toast({ title: "Scan failed", description: e.message, variant: "destructive" }),
  });

  const trashSingleMut = useMutation({
    mutationFn: async (msgId: string) => {
      const r = await apiRequest(`/api/google-sync/email/${connId}/${msgId}/trash`, "POST");
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Trash failed");
      return data;
    },
    onSuccess: (_d, msgId) => {
      toast({ title: "Moved to trash ✓" });
      setSelected(prev => { const s = new Set(prev); s.delete(msgId); return s; });
      qc.invalidateQueries({ queryKey: ["/api/google-sync/organize", connId] });
      qc.setQueryData(["/api/google-sync/organize", connId], (old: any) =>
        old ? { ...old, emails: old.emails?.filter((e: any) => e.id !== msgId) } : old
      );
    },
    onError: (e: any) => {
      if ((e.message || "").includes("reconnect")) {
        toast({ title: "Permission needed", description: "Please reconnect your Google account to enable trash.", variant: "destructive" });
      } else {
        toast({ title: "Failed", description: e.message, variant: "destructive" });
      }
    },
  });

  const trashSelected = async () => {
    if (!selected.size) return;
    setTrashing(true);
    try {
      const r = await apiRequest(`/api/google-sync/inbox/${connId}/batch-trash`, "POST", { ids: Array.from(selected) });
      const data = await r.json();
      if (data.needsReconnect) {
        toast({ title: "Permission needed", description: "Please reconnect your Google account.", variant: "destructive" });
        return;
      }
      toast({ title: `Moved ${data.trashed} email${data.trashed !== 1 ? "s" : ""} to trash ✓` });
      const trashed = new Set(selected);
      setSelected(new Set());
      qc.setQueryData(["/api/google-sync/organize", connId], (old: any) =>
        old ? { ...old, emails: old.emails?.filter((e: any) => !trashed.has(e.id)) } : old
      );
    } catch (e: any) {
      toast({ title: "Batch trash failed", description: e.message, variant: "destructive" });
    } finally {
      setTrashing(false);
    }
  };

  const data = organizeQ.data;
  const allEmails: any[] = data?.emails || [];
  const isRunning = data?.status === "running";
  const isDone    = data?.status === "done";
  const isIdle    = !data || data.status === "idle";

  // Build category counts
  const catCounts: Record<string, number> = {};
  for (const em of allEmails) catCounts[em.category] = (catCounts[em.category] || 0) + 1;
  const junkCount = allEmails.filter(em => JUNK_CATS.has(em.category)).length;

  const filtered = catFilter === "all" ? allEmails
    : catFilter === "junk" ? allEmails.filter(em => JUNK_CATS.has(em.category))
    : allEmails.filter(em => em.category === catFilter);

  const toggleSelect = (id: string) => setSelected(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  const selectAllVisible = () => {
    const allIds = filtered.map((e: any) => e.id);
    const allSelected = allIds.every(id => selected.has(id));
    if (allSelected) setSelected(prev => { const s = new Set(prev); allIds.forEach(id => s.delete(id)); return s; });
    else setSelected(prev => { const s = new Set(prev); allIds.forEach(id => s.add(id)); return s; });
  };

  return (
    <div className="space-y-3">
      {/* Header + provider switcher + scan button */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <div className="text-sm font-medium flex items-center gap-2">
            <Layers className="w-4 h-4 text-violet-500" />
            AI Email Organizer
            {isDone && <span className="text-xs text-muted-foreground">— {allEmails.length} emails scanned</span>}
          </div>
          {/* Provider switcher */}
          {!isRunning && (
            <div className="flex items-center gap-1 mt-1" data-testid="organizer-provider-switcher">
              <span className="text-[10px] text-muted-foreground mr-0.5">AI engine:</span>
              {(["openai", "anthropic"] as OrganizerProvider[]).map(p => {
                const pm = PROVIDER_META[p];
                const isActive = provider === p;
                return (
                  <button
                    key={p}
                    onClick={() => setProvider(p)}
                    data-testid={`btn-provider-${p}`}
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full border transition-colors font-medium",
                      isActive
                        ? cn("bg-foreground text-background border-foreground", pm.color.replace("text-", "border-").replace(" dark:text-", " dark:border-"))
                        : "border-border text-muted-foreground hover:border-foreground/40 bg-transparent"
                    )}
                    title={`${pm.label} — ${pm.model}`}
                  >
                    {pm.label}
                    {isActive && <span className="ml-1 opacity-60">({pm.model})</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {selected.size > 0 && (
            <Button size="sm" variant="destructive" className="text-xs gap-1.5 h-7"
              onClick={trashSelected} disabled={trashing} data-testid="button-batch-trash">
              {trashing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              Trash {selected.size} selected
            </Button>
          )}
          <Button size="sm" variant="outline"
            className={cn("text-xs gap-1.5 h-7", isRunning && "border-violet-400 text-violet-600")}
            onClick={() => scanMut.mutate()}
            disabled={isRunning || scanMut.isPending}
            data-testid="button-organizer-scan">
            {isRunning
              ? <><Loader2 className="w-3 h-3 animate-spin" /> Scanning…</>
              : <><ScanSearch className="w-3 h-3" /> {isDone ? "Re-scan" : "Scan inbox"}</>}
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      {isRunning && (
        <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-violet-600 font-medium flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              {PROVIDER_META[provider].label} ({PROVIDER_META[provider].model}) categorising in parallel…
            </span>
            <span className="text-muted-foreground tabular-nums">{data?.scanned ?? 0} / {data?.total || "?"}</span>
          </div>
          {(data?.total ?? 0) > 0 && (
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-violet-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.round(((data?.scanned ?? 0) / data.total) * 100))}%` }} />
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">
            Processing 25 emails per call across 4 parallel requests — much faster than before.
          </p>
        </div>
      )}

      {/* Idle / empty state */}
      {isIdle && !isRunning && (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground space-y-2">
          <Layers className="w-8 h-8 mx-auto opacity-30" />
          <p>Click <strong>Scan inbox</strong> to let AI categorise your emails and find marketing, newsletters, spam, and junk you can clean up with one click.</p>
        </div>
      )}

      {/* Results */}
      {isDone && allEmails.length > 0 && (
        <>
          {/* Junk summary banner */}
          {junkCount > 0 && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 flex items-center justify-between gap-3">
              <div className="text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <TriangleAlert className="w-4 h-4 shrink-0" />
                <span><strong>{junkCount} junk emails</strong> found (marketing, newsletters, spam, social, notifications).</span>
              </div>
              <Button size="sm" variant="outline"
                className="text-xs shrink-0 border-amber-300 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 h-7"
                onClick={() => { setCatFilter("junk"); selectAllVisible(); }}
                data-testid="button-select-all-junk">
                Select all junk
              </Button>
            </div>
          )}

          {/* Category filter pills */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { key: "all",  label: `All (${allEmails.length})` },
              { key: "junk", label: `Junk (${junkCount})` },
              ...Object.entries(catCounts).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({
                key: k, label: `${CAT_META[k]?.label || k} (${n})`
              })),
            ].map(pill => (
              <button key={pill.key}
                onClick={() => setCatFilter(pill.key)}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-full border transition-colors",
                  catFilter === pill.key
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-muted-foreground border-border hover:border-foreground/40"
                )}
                data-testid={`pill-cat-${pill.key}`}>
                {pill.label}
              </button>
            ))}
          </div>

          {/* Select all visible */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <button onClick={selectAllVisible} className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                data-testid="button-select-visible">
                <CheckSquare className="w-3.5 h-3.5" />
                {filtered.every(e => selected.has(e.id)) ? "Deselect all" : `Select all ${filtered.length}`}
              </button>
              {selected.size > 0 && (
                <span className="text-violet-600 font-medium">{selected.size} selected</span>
              )}
            </div>
          )}

          {/* Email list */}
          <div className="space-y-1 max-h-96 overflow-y-auto rounded-lg border">
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No emails in this category.</p>
            )}
            {filtered.map((em: any) => {
              const cat  = CAT_META[em.category] || CAT_META.other;
              const Icon = cat.icon;
              const isSel = selected.has(em.id);
              return (
                <div key={em.id}
                  className={cn("flex items-center gap-2 px-3 py-2 border-b last:border-0 text-xs group transition-colors",
                    isSel ? "bg-violet-50 dark:bg-violet-950/20" : "hover:bg-muted/40")}
                  data-testid={`row-email-${em.id}`}>
                  {/* checkbox */}
                  <button onClick={() => toggleSelect(em.id)} className="shrink-0 w-4 h-4 flex items-center justify-center"
                    data-testid={`checkbox-email-${em.id}`}>
                    {isSel
                      ? <CheckSquare className="w-4 h-4 text-violet-600" />
                      : <Square className="w-4 h-4 text-muted-foreground/50 group-hover:text-muted-foreground" />}
                  </button>
                  {/* category badge */}
                  <span className={cn("shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium", cat.color)}>
                    <Icon className="w-2.5 h-2.5" />{cat.label}
                  </span>
                  {/* email info */}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate text-foreground">{em.subject}</div>
                    <div className="text-muted-foreground truncate">{em.from}</div>
                  </div>
                  {/* date */}
                  <div className="shrink-0 text-muted-foreground text-[10px] hidden sm:block">
                    {em.date ? new Date(em.date).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }) : ""}
                  </div>
                  {/* trash button */}
                  <button
                    onClick={() => trashSingleMut.mutate(em.id)}
                    disabled={trashSingleMut.isPending}
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-500"
                    title="Move to trash"
                    data-testid={`button-trash-${em.id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function InboxBrowser({ connId, email }: { connId: number; email: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [pageToken, setPageToken] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "appointments">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [emailBody, setEmailBody] = useState<Record<string, any>>({});
  const [detecting, setDetecting] = useState<Record<string, boolean>>({});

  const inboxQ = useQuery<{ emails: any[]; nextPageToken: string | null; debug?: any }>({
    queryKey: ["/api/google-sync/inbox", connId, filter, pageToken],
    queryFn: async () => {
      const params = new URLSearchParams({ filter });
      if (pageToken) params.set("pageToken", pageToken);
      const r = await fetch(`/api/google-sync/inbox/${connId}?${params}`, { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    staleTime: 0,        // always fetch fresh — Gmail inbox changes frequently
    gcTime: 30_000,
  });

  async function loadEmailBody(msgId: string) {
    if (emailBody[msgId]) return;
    try {
      const r = await fetch(`/api/google-sync/email/${connId}/${msgId}`, { credentials: "include" });
      const data = await r.json();
      setEmailBody(prev => ({ ...prev, [msgId]: data }));
    } catch { /* ignore */ }
  }

  async function runDetect(email: any) {
    setDetecting(prev => ({ ...prev, [email.id]: true }));
    try {
      const r = await fetch(`/api/google-sync/email/${connId}/${email.id}/detect`, {
        method: "POST", credentials: "include",
      });
      const data = await r.json();
      if (data.isAppointment) {
        toast({ title: "Appointment found!", description: `"${data.title}" added to review queue.` });
        qc.invalidateQueries({ queryKey: ["/api/google-sync/pending"] });
        qc.invalidateQueries({ queryKey: ["/api/google-sync/status"] });
        qc.invalidateQueries({ queryKey: ["/api/google-sync/inbox", connId] });
      } else {
        toast({ title: "Not an appointment", description: "AI did not detect an appointment in this email." });
      }
    } catch (e: any) {
      toast({ title: "Detection failed", description: e.message, variant: "destructive" });
    } finally {
      setDetecting(prev => ({ ...prev, [email.id]: false }));
    }
  }

  const emails = inboxQ.data?.emails || [];

  return (
    <div className="space-y-3">
      {/* filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => { setFilter("all"); setPageToken(null); }}
          className={cn("text-xs px-3 py-1.5 rounded-full border transition-colors", filter === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted")}
          data-testid="filter-inbox-all"
        >All emails</button>
        <button
          onClick={() => { setFilter("appointments"); setPageToken(null); }}
          className={cn("text-xs px-3 py-1.5 rounded-full border transition-colors", filter === "appointments" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted")}
          data-testid="filter-inbox-appointments"
        >Appointment-related</button>
        <button
          onClick={() => { setPageToken(null); inboxQ.refetch(); }}
          className="ml-auto text-xs px-2 py-1.5 rounded-full border border-border hover:bg-muted transition-colors flex items-center gap-1"
          data-testid="button-refresh-inbox"
        >
          <RefreshCw className={cn("w-3 h-3", inboxQ.isFetching && "animate-spin")} />
          {inboxQ.isFetching ? "Loading…" : "Refresh"}
        </button>
      </div>

      {inboxQ.isLoading && (
        <div className="flex items-center gap-2 py-6 text-muted-foreground text-sm justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading emails…
        </div>
      )}
      {inboxQ.isError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-700 dark:text-rose-400">
          Error loading inbox: {(inboxQ.error as any)?.message}
        </div>
      )}
      {!inboxQ.isLoading && !inboxQ.isError && emails.length === 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground text-center py-4">No emails found.</p>
          {inboxQ.data?.debug && (
            <details className="text-xs">
              <summary className="text-muted-foreground cursor-pointer hover:text-foreground">Debug info</summary>
              <pre className="mt-1 p-2 bg-muted rounded text-[10px] overflow-x-auto">
                {JSON.stringify(inboxQ.data.debug, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      {emails.map((em: any) => {
        const isExpanded = expandedId === em.id;
        const body = emailBody[em.id];
        const statusColor = em.detectionStatus === "approved" ? "text-emerald-600"
          : em.detectionStatus === "pending" ? "text-amber-600"
          : em.detectionStatus === "rejected" ? "text-muted-foreground line-through"
          : "";

        return (
          <div key={em.id} className="rounded-lg border bg-card overflow-hidden" data-testid={`row-email-${em.id}`}>
            <button
              className="w-full text-left p-3 flex items-start gap-3 hover:bg-muted/40 transition-colors"
              onClick={() => {
                setExpandedId(isExpanded ? null : em.id);
                if (!isExpanded) loadEmailBody(em.id);
              }}
            >
              <MailIcon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("text-sm font-medium truncate", statusColor)}>{em.subject}</span>
                  {em.detectionStatus === "pending" && (
                    <Badge className="text-[9px] h-4 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-0 shrink-0">Pending review</Badge>
                  )}
                  {em.detectionStatus === "approved" && (
                    <Badge className="text-[9px] h-4 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-0 shrink-0">Added to calendar</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">{em.from}</div>
                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{em.snippet}</div>
              </div>
              <div className="text-[10px] text-muted-foreground shrink-0 mt-0.5 ml-2">
                {em.date ? new Date(em.date).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }) : ""}
              </div>
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5 shrink-0 mt-0.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0 mt-0.5 text-muted-foreground" />}
            </button>

            {isExpanded && (
              <div className="border-t p-3 space-y-3 bg-muted/20">
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div><span className="font-medium">From:</span> {em.from}</div>
                  <div><span className="font-medium">Date:</span> {em.date}</div>
                </div>
                {body ? (
                  <div className="text-xs bg-background rounded-md p-3 border max-h-48 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed">
                    {body.body || body.snippet || "(empty)"}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading full email…
                  </div>
                )}
                {em.detectionStatus === null && (
                  <Button
                    size="sm" variant="outline"
                    className="text-xs gap-1.5 h-7"
                    onClick={() => runDetect(em)}
                    disabled={detecting[em.id]}
                    data-testid={`button-detect-${em.id}`}
                  >
                    {detecting[em.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
                    {detecting[em.id] ? "Analysing…" : "Check for appointment"}
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* pagination */}
      {inboxQ.data?.nextPageToken && (
        <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setPageToken(inboxQ.data!.nextPageToken)}>
          Load more emails
        </Button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Google Sync Tab — connect Gmail + Google Calendar accounts
// ─────────────────────────────────────────────────────────────────────────────
function GoogleSyncTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [openInbox, setOpenInbox] = useState<number | null>(null);
  const [openOrganizer, setOpenOrganizer] = useState<number | null>(null);

  // ── data ──
  const connectionsQ = useQuery<any[]>({
    queryKey: ["/api/google-sync/connections"],
    queryFn: async () => {
      const r = await fetch("/api/google-sync/connections", { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });

  const statusQ = useQuery<{ pendingCount: number; connections: number; configured: boolean }>({
    queryKey: ["/api/google-sync/status"],
    queryFn: async () => {
      const r = await fetch("/api/google-sync/status", { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const pendingQ = useQuery<any[]>({
    queryKey: ["/api/google-sync/pending"],
    queryFn: async () => {
      const r = await fetch("/api/google-sync/pending?status=pending", { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    refetchInterval: 15_000,
  });

  // Deep scan progress — poll when any scan is running
  const deepScanQ = useQuery<Record<string, any>>({
    queryKey: ["/api/google-sync/deep-scan-status"],
    queryFn: async () => {
      const r = await fetch("/api/google-sync/deep-scan-status", { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    refetchInterval: (data) => {
      if (!data) return 5000;
      const anyRunning = Object.values(data).some((p: any) => p.status === "running");
      return anyRunning ? 2000 : 10_000;
    },
  });

  // ── connect ──
  const connectMut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/google-sync/auth-url", { credentials: "include" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed to get auth URL");
      return data.url as string;
    },
    onSuccess: (url) => { window.open(url, "_blank"); },
    onError: (e: any) => toast({ title: "Connect failed", description: e.message, variant: "destructive" }),
  });

  // ── disconnect ──
  const disconnectMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest(`/api/google-sync/connections/${id}`, "DELETE");
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      toast({ title: "Account disconnected" });
      qc.invalidateQueries({ queryKey: ["/api/google-sync/connections"] });
      qc.invalidateQueries({ queryKey: ["/api/google-sync/status"] });
    },
    onError: (e: any) => toast({ title: "Disconnect failed", description: e.message, variant: "destructive" }),
  });

  // ── toggle settings ──
  const patchMut = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: any }) => {
      const r = await apiRequest(`/api/google-sync/connections/${id}`, "PATCH", patch);
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/google-sync/connections"] }),
    onError: (e: any) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  // ── quick sync (7 days) ──
  const syncMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest(`/api/google-sync/sync/${id}`, "POST");
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Sync failed");
      return data;
    },
    onSuccess: (data: any) => {
      toast({ title: "Sync complete ✓", description: `Found ${data.gmailNew} Gmail + ${data.calendarNew} Calendar appointments.` });
      qc.invalidateQueries({ queryKey: ["/api/google-sync/pending"] });
      qc.invalidateQueries({ queryKey: ["/api/google-sync/status"] });
    },
    onError: (e: any) => toast({ title: "Sync failed", description: e.message, variant: "destructive" }),
  });

  // ── deep scan (all history) ──
  const deepScanMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest(`/api/google-sync/deep-scan/${id}`, "POST");
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Scan failed");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Full scan started", description: "Scanning all your emails for past & future appointments. This runs in the background." });
      qc.invalidateQueries({ queryKey: ["/api/google-sync/deep-scan-status"] });
    },
    onError: (e: any) => toast({ title: "Scan failed", description: e.message, variant: "destructive" }),
  });

  // ── approve pending item ──
  const approveMut = useMutation({
    mutationFn: async (item: any) => {
      const r = await apiRequest(`/api/google-sync/pending/${item.id}/approve`, "POST", {
        title: item.title, eventDate: item.suggestedDate, location: item.location, description: item.description,
      });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      toast({ title: "Added to calendar ✓" });
      qc.invalidateQueries({ queryKey: ["/api/google-sync/pending"] });
      qc.invalidateQueries({ queryKey: ["/api/google-sync/status"] });
      qc.invalidateQueries({ queryKey: ["/api/memory-calendar/events"] });
    },
    onError: (e: any) => toast({ title: "Could not add", description: e.message, variant: "destructive" }),
  });

  // ── reject pending item ──
  const rejectMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest(`/api/google-sync/pending/${id}/reject`, "POST");
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      toast({ title: "Dismissed" });
      qc.invalidateQueries({ queryKey: ["/api/google-sync/pending"] });
      qc.invalidateQueries({ queryKey: ["/api/google-sync/status"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const connections   = connectionsQ.data || [];
  const pending       = pendingQ.data || [];
  const scanProgress  = deepScanQ.data || {};
  const isConfigured  = statusQ.data?.configured !== false;

  return (
    <div className="space-y-5">

      {/* ── header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Gmail &amp; Calendar
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Connect your Gmail accounts. AI scans all your emails — past and future — and finds every appointment, booking, and meeting automatically.
          </p>
        </div>
        <Button
          onClick={() => connectMut.mutate()}
          disabled={connectMut.isPending || !isConfigured}
          className="shrink-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
          data-testid="button-connect-google"
        >
          {connectMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Link2 className="w-4 h-4 mr-2" />}
          Connect account
        </Button>
      </div>

      {!isConfigured && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Google OAuth not configured. Set <code className="font-mono bg-amber-100 dark:bg-amber-900 px-1 rounded">GOOGLE_OAUTH_CLIENT_ID</code> and <code className="font-mono bg-amber-100 dark:bg-amber-900 px-1 rounded">GOOGLE_OAUTH_CLIENT_SECRET</code>.
        </div>
      )}

      {/* ── Reconnect notice for new gmail.modify scope ── */}
      {isConfigured && connections.length > 0 && (
        <div className="rounded-lg border border-violet-200 bg-violet-50 dark:bg-violet-950/30 dark:border-violet-800 p-3 text-sm text-violet-800 dark:text-violet-300 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Layers className="w-4 h-4 shrink-0" />
            <span><strong>New feature: Gmail Organizer.</strong> To enable moving emails to trash, please reconnect your account with updated permissions.</span>
          </div>
          <Button size="sm" variant="outline"
            className="shrink-0 border-violet-300 text-violet-700 hover:bg-violet-100 dark:hover:bg-violet-900/40 text-xs"
            onClick={() => connectMut.mutate()}
            disabled={connectMut.isPending}
            data-testid="button-reconnect-google">
            {connectMut.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
            Reconnect
          </Button>
        </div>
      )}

      {/* ── connected accounts ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="w-4 h-4 text-indigo-500" /> Connected accounts
            {connections.length > 0 && <Badge variant="secondary" className="ml-auto">{connections.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {connectionsQ.isLoading && (
            <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          )}
          {!connectionsQ.isLoading && connections.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No Google accounts connected yet. Click "Connect account" above.</p>
          )}

          {connections.map((conn) => {
            const prog = scanProgress[conn.id] as any;
            const isScanning     = prog?.status === "running";
            const scanDone       = prog?.status === "done";
            const scanError      = prog?.status === "error";
            const inboxOpen      = openInbox === conn.id;
            const organizerOpen  = openOrganizer === conn.id;

            return (
              <div key={conn.id} className="rounded-xl border bg-card overflow-hidden" data-testid={`card-google-conn-${conn.id}`}>
                {/* account header */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {conn.email?.[0]?.toUpperCase() || "G"}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{conn.email}</div>
                        <div className="text-xs text-muted-foreground">
                          Synced: {conn.lastGmailSyncAt ? new Date(conn.lastGmailSyncAt).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" }) : "never"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => syncMut.mutate(conn.id)}
                        disabled={syncMut.isPending} data-testid={`button-sync-${conn.id}`} title="Quick sync (7 days)">
                        <RefreshCw className={cn("w-3.5 h-3.5", syncMut.isPending && "animate-spin")} />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => disconnectMut.mutate(conn.id)}
                        disabled={disconnectMut.isPending} data-testid={`button-disconnect-${conn.id}`}
                        className="text-rose-600 hover:text-rose-700" title="Disconnect">
                        <Unlink className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* toggles */}
                  <div className="flex flex-wrap gap-4 pt-1 border-t">
                    <label className="flex items-center gap-2 text-sm cursor-pointer select-none" data-testid={`toggle-gmail-${conn.id}`}>
                      <Switch checked={!!conn.syncGmail} onCheckedChange={(v) => patchMut.mutate({ id: conn.id, patch: { syncGmail: v } })} />
                      <MailIcon className="w-4 h-4 text-red-500" /> Gmail scan
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer select-none" data-testid={`toggle-calendar-${conn.id}`}>
                      <Switch checked={!!conn.syncCalendar} onCheckedChange={(v) => patchMut.mutate({ id: conn.id, patch: { syncCalendar: v } })} />
                      <CalendarCheck className="w-4 h-4 text-blue-500" /> Calendar import
                    </label>
                  </div>

                  {/* action buttons row */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {/* Deep scan button */}
                    <Button
                      size="sm" variant="outline"
                      className={cn("text-xs gap-1.5 h-8", isScanning && "border-indigo-400 text-indigo-600")}
                      onClick={() => deepScanMut.mutate(conn.id)}
                      disabled={isScanning || deepScanMut.isPending}
                      data-testid={`button-deep-scan-${conn.id}`}
                    >
                      {isScanning
                        ? <><Loader2 className="w-3 h-3 animate-spin" /> Scanning history…</>
                        : <><History className="w-3 h-3" /> Scan all history</>
                      }
                    </Button>

                    {/* Inbox viewer toggle */}
                    <Button
                      size="sm" variant="outline"
                      className={cn("text-xs gap-1.5 h-8", inboxOpen && "bg-muted")}
                      onClick={() => { setOpenInbox(inboxOpen ? null : conn.id); if (!inboxOpen) setOpenOrganizer(null); }}
                      data-testid={`button-inbox-${conn.id}`}
                    >
                      <Inbox className="w-3 h-3" />
                      {inboxOpen ? "Hide inbox" : "Browse inbox"}
                    </Button>

                    {/* Gmail Organizer toggle */}
                    <Button
                      size="sm" variant="outline"
                      className={cn("text-xs gap-1.5 h-8", organizerOpen && "bg-violet-50 dark:bg-violet-950/30 border-violet-300 text-violet-700")}
                      onClick={() => { setOpenOrganizer(organizerOpen ? null : conn.id); if (!organizerOpen) setOpenInbox(null); }}
                      data-testid={`button-organizer-${conn.id}`}
                    >
                      <Layers className="w-3 h-3" />
                      {organizerOpen ? "Hide organizer" : "Organize inbox"}
                    </Button>
                  </div>

                  {/* Scan progress bar */}
                  {(isScanning || scanDone || scanError) && (
                    <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className={cn("font-medium flex items-center gap-1.5",
                          isScanning ? "text-indigo-600" : scanDone ? "text-emerald-600" : "text-rose-600")}>
                          {isScanning && <Loader2 className="w-3 h-3 animate-spin" />}
                          {isScanning ? "Scanning email history…" : scanDone ? "Scan complete ✓" : `Error: ${prog?.error}`}
                        </span>
                        <span className="text-muted-foreground">
                          {prog?.scanned} emails scanned · {prog?.found} appointments found
                        </span>
                      </div>
                      {isScanning && prog?.total > 0 && (
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.round((prog.scanned / prog.total) * 100))}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Inbox panel */}
                {inboxOpen && (
                  <div className="border-t p-4 bg-muted/10">
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Inbox className="w-4 h-4 text-indigo-500" /> Inbox — {conn.email}
                    </h4>
                    <InboxBrowser connId={conn.id} email={conn.email} />
                  </div>
                )}

                {/* Gmail Organizer panel */}
                {organizerOpen && (
                  <div className="border-t p-4 bg-violet-50/30 dark:bg-violet-950/10">
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-violet-500" /> Gmail Organizer — {conn.email}
                    </h4>
                    <p className="text-xs text-muted-foreground mb-3">
                      AI scans your inbox and categorises every email. Select junk in bulk and move it to trash in one click. Emails go to Gmail Trash (recoverable for 30 days).
                    </p>
                    <GmailOrganizer connId={conn.id} email={conn.email} />
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ── pending items ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            AI-detected appointments
            {pending.length > 0 && <Badge className="ml-auto bg-indigo-600 text-white">{pending.length} new</Badge>}
          </CardTitle>
          <CardDescription>
            Found in Gmail and Calendar (past &amp; future). Tap <strong>Add</strong> to import or <strong>Dismiss</strong> to ignore.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingQ.isLoading && (
            <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Checking…
            </div>
          )}
          {!pendingQ.isLoading && pending.length === 0 && (
            <div className="text-center py-8 text-muted-foreground space-y-1">
              <CalendarCheck className="w-10 h-10 mx-auto opacity-20 mb-2" />
              <p className="text-sm font-medium">No pending appointments</p>
              <p className="text-xs">Connect an account and run "Scan all history" to import past appointments too.</p>
            </div>
          )}
          {pending.map((item) => {
            const isPast = item.suggestedDate && new Date(item.suggestedDate) < new Date();
            return (
              <div key={item.id} className="rounded-xl border bg-card p-4 space-y-2" data-testid={`card-pending-${item.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.source === "gmail"
                        ? <MailIcon className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        : <CalendarCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      }
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{item.source}</span>
                      {isPast && (
                        <Badge variant="outline" className="text-[9px] h-4 text-muted-foreground shrink-0">
                          <Archive className="w-2.5 h-2.5 mr-0.5" /> Past event
                        </Badge>
                      )}
                    </div>
                    <p className="font-semibold text-sm leading-tight">{item.title}</p>
                    {item.suggestedDate && (
                      <p className={cn("text-xs flex items-center gap-1", isPast ? "text-muted-foreground" : "text-foreground")}>
                        <Clock className="w-3 h-3" />
                        {new Date(item.suggestedDate).toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short" })}
                        {isPast && <span className="text-muted-foreground">(past)</span>}
                      </p>
                    )}
                    {item.location && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {item.location}
                      </p>
                    )}
                    {item.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{item.description}</p>
                    )}
                    {item.rawSnippet && (
                      <details className="mt-1">
                        <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground select-none">Show source</summary>
                        <pre className="text-[10px] mt-1 text-muted-foreground whitespace-pre-wrap bg-muted rounded p-2 max-h-32 overflow-y-auto">{item.rawSnippet}</pre>
                      </details>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                      onClick={() => approveMut.mutate(item)} disabled={approveMut.isPending}
                      data-testid={`button-approve-${item.id}`}>
                      {approveMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ThumbsUp className="w-3 h-3 mr-1" />}
                      Add
                    </Button>
                    <Button size="sm" variant="outline" className="text-rose-600 hover:text-rose-700 text-xs"
                      onClick={() => rejectMut.mutate(item.id)} disabled={rejectMut.isPending}
                      data-testid={`button-reject-${item.id}`}>
                      <ThumbsDown className="w-3 h-3 mr-1" /> Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ── how it works ── */}
      <Card className="border-dashed">
        <CardContent className="pt-5 pb-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Brain className="w-4 h-4 text-indigo-500" /> How it works
          </h3>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>Connect one or more Gmail accounts above.</li>
            <li>Every 15 minutes: automatically scans the last 7 days of emails for new appointments.</li>
            <li>Click <strong>"Scan all history"</strong> once per account to go through all your old emails — past appointments, old bookings, everything.</li>
            <li>Click <strong>"Browse inbox"</strong> to see your actual emails and manually trigger AI detection on any email.</li>
            <li>Google Calendar is also scanned — 1 year back and 1 year forward — so past events are included too.</li>
            <li>AI reads the full email body (not just the subject) for more accurate detection.</li>
            <li>Tap <strong>Add</strong> on any detected item to add it to your Memory Calendar with automatic reminders.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NotesTab — multilingual professional note-taking with Claude AI analysis
// ─────────────────────────────────────────────────────────────────────────────

type MemoryNote = {
  id: number;
  ownerUserId: number;
  title: string;
  content: string;
  language: string;
  category: string;
  tags: string[];
  priority: string;
  isPinned: boolean;
  isPrivate: boolean;
  isArchived: boolean;
  wordCount: number;
  charCount: number;
  readTimeMinutes: number;
  aiSummary: string | null;
  aiKeyPoints: string[];
  aiActionItems: string[];
  aiSentiment: string | null;
  aiSuggestedTags: string[];
  aiLanguageDetected: string | null;
  aiTranslationEn: string | null;
  aiInsight: string | null;
  lastAnalyzedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type NoteStats = {
  total: number;
  totalWords: number;
  pinned: number;
  byLang: Record<string, number>;
  byCat: Record<string, number>;
  bySent: Record<string, number>;
};

const NOTE_CATEGORIES = [
  { value: "general",   label: "General",   color: "bg-slate-500" },
  { value: "idea",      label: "Idea",       color: "bg-amber-500" },
  { value: "meeting",   label: "Meeting",    color: "bg-blue-500"  },
  { value: "research",  label: "Research",   color: "bg-indigo-500"},
  { value: "personal",  label: "Personal",   color: "bg-pink-500"  },
  { value: "business",  label: "Business",   color: "bg-emerald-500"},
  { value: "task",      label: "Task",       color: "bg-violet-500"},
  { value: "draft",     label: "Draft",      color: "bg-orange-500"},
  { value: "reference", label: "Reference",  color: "bg-teal-500"  },
];

const NOTE_LANGS = [
  { value: "en", label: "English",  flag: "🇬🇧" },
  { value: "ar", label: "Arabic",   flag: "🇸🇦" },
  { value: "nl", label: "Dutch",    flag: "🇳🇱" },
];

const SENTIMENT_META: Record<string, { label: string; color: string }> = {
  positive: { label: "Positive", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  neutral:  { label: "Neutral",  color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  negative: { label: "Negative", color: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300" },
  mixed:    { label: "Mixed",    color: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
};

const PRIORITY_META: Record<string, { label: string; color: string }> = {
  low:    { label: "Low",    color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  normal: { label: "Normal", color: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" },
  high:   { label: "High",   color: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  urgent: { label: "Urgent", color: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300" },
};

const blankNote = () => ({
  title: "",
  content: "",
  language: "en",
  category: "general",
  tags: [] as string[],
  priority: "normal",
  isPinned: false,
  isPrivate: true,
});

function noteCatMeta(v: string) {
  return NOTE_CATEGORIES.find(c => c.value === v) || NOTE_CATEGORIES[0];
}

function NotesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [searchQ, setSearchQ] = useState("");
  const [filterLang, setFilterLang] = useState("all");
  const [filterCat, setFilterCat] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [sortBy, setSortBy] = useState("updated");
  const [showArchived, setShowArchived] = useState(false);
  const [view, setView] = useState<"list" | "stats">("list");

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<typeof blankNote extends () => infer T ? T : never>(blankNote());
  const [tagInput, setTagInput] = useState("");
  const [translateTarget, setTranslateTarget] = useState("en");
  const [translationResult, setTranslationResult] = useState("");
  const [showTranslation, setShowTranslation] = useState(false);

  const buildQuery = () => {
    const p = new URLSearchParams();
    if (searchQ)             p.set("q", searchQ);
    if (filterLang !== "all") p.set("language", filterLang);
    if (filterCat  !== "all") p.set("category", filterCat);
    if (filterPriority !== "all") p.set("priority", filterPriority);
    if (showArchived)        p.set("archived", "1");
    p.set("sort", sortBy);
    return p.toString();
  };

  const notesQ = useQuery<MemoryNote[]>({
    queryKey: ["/api/memory-calendar/notes", searchQ, filterLang, filterCat, filterPriority, sortBy, showArchived],
    queryFn: async () => {
      const r = await fetch(`/api/memory-calendar/notes?${buildQuery()}`, { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });

  const statsQ = useQuery<NoteStats>({
    queryKey: ["/api/memory-calendar/notes/stats"],
    queryFn: async () => {
      const r = await fetch(`/api/memory-calendar/notes/stats`, { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    enabled: view === "stats",
  });

  const selectedNote = (notesQ.data || []).find(n => n.id === selectedId) ?? null;

  const createMut = useMutation({
    mutationFn: async (body: any) => {
      const r = await apiRequest("/api/memory-calendar/notes", "POST", body);
      return r.json();
    },
    onSuccess: (note: MemoryNote) => {
      qc.invalidateQueries({ queryKey: ["/api/memory-calendar/notes"] });
      qc.invalidateQueries({ queryKey: ["/api/memory-calendar/notes/stats"] });
      toast({ title: "Note saved" });
      setEditorOpen(false);
      setSelectedId(note.id);
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: any }) => {
      const r = await apiRequest(`/api/memory-calendar/notes/${id}`, "PATCH", body);
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/memory-calendar/notes"] });
      qc.invalidateQueries({ queryKey: ["/api/memory-calendar/notes/stats"] });
      toast({ title: "Note updated" });
      setEditorOpen(false);
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => apiRequest(`/api/memory-calendar/notes/${id}`, "DELETE"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/memory-calendar/notes"] });
      qc.invalidateQueries({ queryKey: ["/api/memory-calendar/notes/stats"] });
      toast({ title: "Note deleted" });
      setSelectedId(null);
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const analyzeMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest(`/api/memory-calendar/notes/${id}/analyze`, "POST");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/memory-calendar/notes"] });
      toast({ title: "AI analysis complete", description: "Claude has analyzed your note." });
    },
    onError: (e: any) => toast({ title: "Analysis failed", description: e?.message, variant: "destructive" }),
  });

  const translateMut = useMutation({
    mutationFn: async ({ id, targetLang }: { id: number; targetLang: string }) => {
      const r = await apiRequest(`/api/memory-calendar/notes/${id}/translate`, "POST", { targetLang });
      return r.json();
    },
    onSuccess: (data: any) => {
      setTranslationResult(data.translation);
      setShowTranslation(true);
      toast({ title: "Translation ready" });
    },
    onError: (e: any) => toast({ title: "Translation failed", description: e?.message, variant: "destructive" }),
  });

  const pinMut = useMutation({
    mutationFn: async ({ id, pinned }: { id: number; pinned: boolean }) => {
      const r = await apiRequest(`/api/memory-calendar/notes/${id}`, "PATCH", { isPinned: pinned });
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/memory-calendar/notes"] }),
  });

  const archiveMut = useMutation({
    mutationFn: async ({ id, archived }: { id: number; archived: boolean }) => {
      const r = await apiRequest(`/api/memory-calendar/notes/${id}`, "PATCH", { isArchived: archived });
      return r.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/memory-calendar/notes"] });
      qc.invalidateQueries({ queryKey: ["/api/memory-calendar/notes/stats"] });
      setSelectedId(null);
      toast({ title: vars.archived ? "Note archived" : "Note restored" });
    },
  });

  function openNew() {
    setEditingNote(blankNote());
    setTagInput("");
    setEditorOpen(true);
  }

  function openEdit(note: MemoryNote) {
    setEditingNote({
      title: note.title,
      content: note.content,
      language: note.language || "en",
      category: note.category || "general",
      tags: note.tags || [],
      priority: note.priority || "normal",
      isPinned: note.isPinned || false,
      isPrivate: note.isPrivate !== false,
    });
    setTagInput((note.tags || []).join(", "));
    setSelectedId(note.id);
    setEditorOpen(true);
  }

  function saveNote() {
    const tags = tagInput.split(",").map(t => t.trim()).filter(Boolean);
    const body = { ...editingNote, tags };
    if (selectedId && editorOpen && (notesQ.data || []).find(n => n.id === selectedId)) {
      updateMut.mutate({ id: selectedId, body });
    } else {
      createMut.mutate(body);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => toast({ title: "Copied to clipboard" }));
  }

  const isRtl = editingNote.language === "ar";

  const notes = notesQ.data || [];
  const stats = statsQ.data;

  return (
    <div className="space-y-4">
      {/* ── Header toolbar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search notes…"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              className="pl-8"
              data-testid="input-notes-search"
            />
          </div>
          <Select value={filterLang} onValueChange={setFilterLang}>
            <SelectTrigger className="w-32" data-testid="select-notes-lang">
              <Globe className="w-3.5 h-3.5 mr-1" /><SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All langs</SelectItem>
              {NOTE_LANGS.map(l => <SelectItem key={l.value} value={l.value}>{l.flag} {l.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-32" data-testid="select-notes-cat">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cats</SelectItem>
              {NOTE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-28" data-testid="select-notes-sort">
              <SortAsc className="w-3.5 h-3.5 mr-1" /><SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated">Latest</SelectItem>
              <SelectItem value="created">Created</SelectItem>
              <SelectItem value="title">A–Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={view === "stats" ? "default" : "outline"}
            onClick={() => setView(v => v === "stats" ? "list" : "stats")}
            data-testid="button-notes-stats"
          >
            <BarChart3 className="w-4 h-4 mr-1" /> Analytics
          </Button>
          <Button
            size="sm"
            variant={showArchived ? "default" : "outline"}
            onClick={() => setShowArchived(v => !v)}
            data-testid="button-notes-archived"
          >
            <Archive className="w-4 h-4 mr-1" /> {showArchived ? "Active" : "Archive"}
          </Button>
          <Button onClick={openNew} data-testid="button-note-new">
            <Plus className="w-4 h-4 mr-1" /> New note
          </Button>
        </div>
      </div>

      {/* ── Analytics view ─────────────────────────────────────────────── */}
      {view === "stats" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {statsQ.isLoading && <div className="col-span-3 text-center py-8"><Loader2 className="w-5 h-5 animate-spin inline" /></div>}
          {stats && (<>
            <Card>
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <FileText className="w-4 h-4" /> Overview
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/40">
                    <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{stats.total}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Total notes</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
                    <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{stats.totalWords.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Total words</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40">
                    <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{stats.pinned}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Pinned</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-sky-50 dark:bg-sky-950/40">
                    <div className="text-2xl font-bold text-sky-700 dark:text-sky-300">
                      {stats.total > 0 ? Math.round(stats.totalWords / stats.total) : 0}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">Avg words</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
                  <Globe className="w-4 h-4" /> By language
                </div>
                {Object.entries(stats.byLang).sort((a, b) => b[1] - a[1]).map(([lang, count]) => {
                  const meta = NOTE_LANGS.find(l => l.value === lang);
                  const pct = stats.total > 0 ? Math.round(count / stats.total * 100) : 0;
                  return (
                    <div key={lang} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>{meta?.flag} {meta?.label || lang}</span>
                        <span className="text-muted-foreground">{count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                {Object.keys(stats.byLang).length === 0 && <p className="text-xs text-muted-foreground">No data yet</p>}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
                  <Brain className="w-4 h-4" /> AI sentiment
                </div>
                {Object.entries(stats.bySent).sort((a, b) => b[1] - a[1]).map(([sent, count]) => {
                  const meta = SENTIMENT_META[sent] || SENTIMENT_META.neutral;
                  const pct = stats.total > 0 ? Math.round(count / stats.total * 100) : 0;
                  return (
                    <div key={sent} className="flex items-center gap-2">
                      <Badge className={cn("text-xs", meta.color)}>{meta.label}</Badge>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-slate-400" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
                    </div>
                  );
                })}
                <Separator className="my-2" />
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mt-3 mb-2">
                  <Layers className="w-4 h-4" /> By category
                </div>
                {Object.entries(stats.byCat).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cat, count]) => {
                  const meta = noteCatMeta(cat);
                  return (
                    <div key={cat} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("w-2 h-2 rounded-full inline-block", meta.color)} />
                        {meta.label}
                      </div>
                      <span className="text-muted-foreground">{count}</span>
                    </div>
                  );
                })}
                {Object.keys(stats.byCat).length === 0 && <p className="text-xs text-muted-foreground">No data yet</p>}
              </CardContent>
            </Card>
          </>)}
        </div>
      )}

      {/* ── Main split layout ──────────────────────────────────────────── */}
      <div className={cn("grid gap-4", selectedNote && !editorOpen ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>

        {/* ── Notes list ─────────────────────────────────────────────── */}
        <div className="space-y-2">
          {notesQ.isLoading && (
            <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin inline text-muted-foreground" /></div>
          )}
          {!notesQ.isLoading && notes.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">No notes yet</p>
                <p className="text-xs text-muted-foreground mt-1">Hit "New note" to get started</p>
              </CardContent>
            </Card>
          )}
          {notes.map(note => {
            const langMeta  = NOTE_LANGS.find(l => l.value === note.language);
            const catMeta   = noteCatMeta(note.category);
            const priMeta   = PRIORITY_META[note.priority] || PRIORITY_META.normal;
            const sentMeta  = note.aiSentiment ? SENTIMENT_META[note.aiSentiment] : null;
            const isSelected = note.id === selectedId && !editorOpen;
            return (
              <Card
                key={note.id}
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md border",
                  isSelected && "ring-2 ring-indigo-500 border-indigo-300",
                  note.isPinned && "border-l-4 border-l-amber-400",
                )}
                onClick={() => { setSelectedId(note.id); setEditorOpen(false); setShowTranslation(false); }}
                data-testid={`card-note-${note.id}`}
              >
                <CardContent className="py-3 px-4 space-y-1.5">
                  <div className="flex items-start gap-2 justify-between">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      {note.isPinned && <Pin className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                      <span className="font-medium text-sm truncate" data-testid={`text-note-title-${note.id}`}>{note.title}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Badge variant="outline" className="text-xs h-5">{langMeta?.flag} {langMeta?.label}</Badge>
                      {note.aiSentiment && sentMeta && (
                        <Badge className={cn("text-xs h-5", sentMeta.color)}>{sentMeta.label}</Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2"
                    dir={note.language === "ar" ? "rtl" : "ltr"}
                  >{note.content}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={cn("text-xs h-4.5", catMeta.color, "text-white")}>{catMeta.label}</Badge>
                    <Badge className={cn("text-xs h-4.5", priMeta.color)}>{priMeta.label}</Badge>
                    {(note.tags || []).slice(0, 2).map(t => (
                      <Badge key={t} variant="secondary" className="text-xs h-4.5">#{t}</Badge>
                    ))}
                    {(note.tags || []).length > 2 && <span className="text-xs text-muted-foreground">+{note.tags.length - 2}</span>}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {note.wordCount}w · {new Date(note.updatedAt).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* ── Note detail + AI analysis (shown when a note is selected) ── */}
        {selectedNote && !editorOpen && (
          <div className="space-y-3">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base flex items-center gap-2 flex-wrap" data-testid="text-note-detail-title">
                      {selectedNote.isPinned && <Pin className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                      {selectedNote.title}
                      <Badge variant="outline" className="text-xs">
                        {NOTE_LANGS.find(l => l.value === selectedNote.language)?.flag}{" "}
                        {NOTE_LANGS.find(l => l.value === selectedNote.language)?.label}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {noteCatMeta(selectedNote.category).label} · {PRIORITY_META[selectedNote.priority]?.label} priority ·{" "}
                      {selectedNote.wordCount} words · ~{selectedNote.readTimeMinutes} min read ·{" "}
                      Updated {new Date(selectedNote.updatedAt).toLocaleDateString("nl-NL")}
                    </CardDescription>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="icon" variant="ghost" title="Pin / unpin"
                      onClick={() => pinMut.mutate({ id: selectedNote.id, pinned: !selectedNote.isPinned })}
                      data-testid="button-note-pin"
                    >
                      {selectedNote.isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" title="Edit note"
                      onClick={() => openEdit(selectedNote)}
                      data-testid="button-note-edit"
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" title="Copy content"
                      onClick={() => copyToClipboard(selectedNote.content)}
                      data-testid="button-note-copy"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" data-testid="button-note-more"><MoreHorizontal className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Note actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => archiveMut.mutate({ id: selectedNote.id, archived: !selectedNote.isArchived })}>
                          <Archive className="w-4 h-4 mr-2" />{selectedNote.isArchived ? "Restore" : "Archive"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-rose-500"
                          onClick={() => { if (confirm("Delete this note?")) deleteMut.mutate(selectedNote.id); }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div
                  className="rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap min-h-[80px]"
                  dir={selectedNote.language === "ar" ? "rtl" : "ltr"}
                  data-testid="text-note-content"
                >
                  {selectedNote.content || <span className="text-muted-foreground italic">Empty note</span>}
                </div>
                {(selectedNote.tags || []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedNote.tags.map(t => <Badge key={t} variant="secondary" className="text-xs">#{t}</Badge>)}
                  </div>
                )}

                {/* AI action bar */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => analyzeMut.mutate(selectedNote.id)}
                    disabled={analyzeMut.isPending}
                    data-testid="button-note-analyze"
                  >
                    {analyzeMut.isPending
                      ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                      : <Brain className="w-4 h-4 mr-1.5" />}
                    Analyze with Claude
                  </Button>
                  <div className="flex items-center gap-1">
                    <Select value={translateTarget} onValueChange={setTranslateTarget}>
                      <SelectTrigger className="h-8 w-28 text-xs" data-testid="select-translate-target">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {NOTE_LANGS.map(l => <SelectItem key={l.value} value={l.value}>{l.flag} {l.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline"
                      onClick={() => translateMut.mutate({ id: selectedNote.id, targetLang: translateTarget })}
                      disabled={translateMut.isPending}
                      data-testid="button-note-translate"
                    >
                      {translateMut.isPending
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                        : <Languages className="w-3.5 h-3.5 mr-1" />}
                      Translate
                    </Button>
                  </div>
                </div>

                {/* Translation result */}
                {showTranslation && translationResult && (
                  <div className="rounded-lg border bg-sky-50 dark:bg-sky-950/30 p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-sky-700 dark:text-sky-300 flex items-center gap-1">
                        <Languages className="w-3.5 h-3.5" /> Translation
                      </span>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(translationResult)}>
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setShowTranslation(false)}>
                          <XIcon className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="text-translation-result">{translationResult}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── AI Analysis panel ─────────────────────────────────── */}
            {selectedNote.aiSummary && (
              <Card className="border-indigo-200 dark:border-indigo-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    Claude AI Analysis
                    {selectedNote.lastAnalyzedAt && (
                      <span className="text-xs text-muted-foreground font-normal ml-auto">
                        {new Date(selectedNote.lastAnalyzedAt).toLocaleDateString("nl-NL")}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Sentiment + language */}
                  <div className="flex gap-2 flex-wrap">
                    {selectedNote.aiSentiment && (
                      <Badge className={cn("text-xs", SENTIMENT_META[selectedNote.aiSentiment]?.color)}>
                        {SENTIMENT_META[selectedNote.aiSentiment]?.label} sentiment
                      </Badge>
                    )}
                    {selectedNote.aiLanguageDetected && (
                      <Badge variant="outline" className="text-xs">
                        {NOTE_LANGS.find(l => l.value === selectedNote.aiLanguageDetected)?.flag || "🌐"}{" "}
                        Detected: {NOTE_LANGS.find(l => l.value === selectedNote.aiLanguageDetected)?.label || selectedNote.aiLanguageDetected}
                      </Badge>
                    )}
                  </div>

                  {/* Summary */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <BookOpen className="w-3.5 h-3.5" /> Summary
                    </div>
                    <p className="text-sm leading-relaxed bg-indigo-50 dark:bg-indigo-950/40 rounded-lg p-3" data-testid="text-ai-summary-note">
                      {selectedNote.aiSummary}
                    </p>
                  </div>

                  {/* Key points */}
                  {(selectedNote.aiKeyPoints || []).length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Lightbulb className="w-3.5 h-3.5" /> Key points
                      </div>
                      <ul className="space-y-1" data-testid="list-ai-key-points">
                        {selectedNote.aiKeyPoints.map((pt, i) => (
                          <li key={i} className="flex gap-2 text-sm">
                            <span className="text-indigo-500 flex-shrink-0">•</span>
                            <span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Action items */}
                  {(selectedNote.aiActionItems || []).length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <ListChecks className="w-3.5 h-3.5" /> Action items
                      </div>
                      <ul className="space-y-1.5" data-testid="list-ai-action-items">
                        {selectedNote.aiActionItems.map((item, i) => (
                          <li key={i} className="flex gap-2 text-sm items-start">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* AI Insight */}
                  {selectedNote.aiInsight && (
                    <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 flex gap-2">
                      <Zap className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm" data-testid="text-ai-insight">{selectedNote.aiInsight}</p>
                    </div>
                  )}

                  {/* AI Suggested tags */}
                  {(selectedNote.aiSuggestedTags || []).length > 0 && (
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground">Suggested tags</div>
                      <div className="flex flex-wrap gap-1">
                        {selectedNote.aiSuggestedTags.map(t => (
                          <Badge key={t} variant="outline" className="text-xs cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                            onClick={() => {
                              const existing = selectedNote.tags || [];
                              if (!existing.includes(t)) {
                                updateMut.mutate({ id: selectedNote.id, body: { tags: [...existing, t] } });
                              }
                            }}
                            title="Click to add"
                          >
                            + #{t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* English translation (from AI analysis) */}
                  {selectedNote.aiTranslationEn && selectedNote.language !== "en" && (
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Languages className="w-3.5 h-3.5" /> English translation (from analysis)
                      </div>
                      <div className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {selectedNote.aiTranslationEn}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {!selectedNote.aiSummary && (
              <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                <Brain className="w-5 h-5 mx-auto mb-1.5 opacity-40" />
                Click <strong>Analyze with Claude</strong> to get AI summary, key points, action items and sentiment.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Editor Dialog ──────────────────────────────────────────────── */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenLine className="w-5 h-5 text-indigo-500" />
              {selectedId && (notesQ.data || []).find(n => n.id === selectedId) ? "Edit note" : "New note"}
            </DialogTitle>
            <DialogDescription>Write in English, Arabic, or Dutch. Claude will analyze it when ready.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="note-title">Title</Label>
              <Input
                id="note-title"
                placeholder="Note title…"
                value={editingNote.title}
                onChange={e => setEditingNote(n => ({ ...n, title: e.target.value }))}
                dir={isRtl ? "rtl" : "ltr"}
                data-testid="input-note-title"
              />
            </div>

            {/* Language selector */}
            <div className="flex gap-3 flex-wrap">
              <div className="space-y-1.5 flex-1 min-w-[130px]">
                <Label>Language</Label>
                <Select value={editingNote.language} onValueChange={v => setEditingNote(n => ({ ...n, language: v }))}>
                  <SelectTrigger data-testid="select-note-language"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NOTE_LANGS.map(l => <SelectItem key={l.value} value={l.value}>{l.flag} {l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 flex-1 min-w-[130px]">
                <Label>Category</Label>
                <Select value={editingNote.category} onValueChange={v => setEditingNote(n => ({ ...n, category: v }))}>
                  <SelectTrigger data-testid="select-note-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NOTE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 flex-1 min-w-[130px]">
                <Label>Priority</Label>
                <Select value={editingNote.priority} onValueChange={v => setEditingNote(n => ({ ...n, priority: v }))}>
                  <SelectTrigger data-testid="select-note-priority"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Content */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="note-content">Content</Label>
                <span className="text-xs text-muted-foreground">
                  {editingNote.content.trim().split(/\s+/).filter(Boolean).length} words
                </span>
              </div>
              <Textarea
                id="note-content"
                placeholder={
                  editingNote.language === "ar"
                    ? "اكتب ملاحظتك هنا…"
                    : editingNote.language === "nl"
                    ? "Schrijf je notitie hier…"
                    : "Write your note here…"
                }
                value={editingNote.content}
                onChange={e => setEditingNote(n => ({ ...n, content: e.target.value }))}
                dir={isRtl ? "rtl" : "ltr"}
                className={cn("min-h-[200px] font-mono text-sm resize-y", isRtl && "text-right")}
                data-testid="textarea-note-content"
              />
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <Label htmlFor="note-tags">Tags <span className="text-muted-foreground text-xs">(comma-separated)</span></Label>
              <Input
                id="note-tags"
                placeholder="urban, culture, idea…"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                data-testid="input-note-tags"
              />
            </div>

            {/* Toggles */}
            <div className="flex gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <Switch
                  id="note-pinned"
                  checked={editingNote.isPinned}
                  onCheckedChange={v => setEditingNote(n => ({ ...n, isPinned: v }))}
                  data-testid="switch-note-pinned"
                />
                <Label htmlFor="note-pinned" className="flex items-center gap-1.5 cursor-pointer">
                  <Pin className="w-3.5 h-3.5 text-amber-500" /> Pinned
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="note-private"
                  checked={editingNote.isPrivate}
                  onCheckedChange={v => setEditingNote(n => ({ ...n, isPrivate: v }))}
                  data-testid="switch-note-private"
                />
                <Label htmlFor="note-private" className="cursor-pointer">Private</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button
              onClick={saveNote}
              disabled={!editingNote.title.trim() || createMut.isPending || updateMut.isPending}
              data-testid="button-note-save"
            >
              {(createMut.isPending || updateMut.isPending)
                ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Save note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccessTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [userId, setUserId] = useState("");
  const accessQ = useQuery<any[]>({ queryKey: ["/api/memory-calendar/access"] });

  const grantMut = useMutation({
    mutationFn: async (uid: number) => apiRequest("/api/memory-calendar/access", "POST", { userId: uid, canUse: true }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/memory-calendar/access"] }); toast({ title: "Access granted" }); setUserId(""); },
    onError:   (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const revokeMut = useMutation({
    mutationFn: async (uid: number) => apiRequest(`/api/memory-calendar/access/${uid}`, "DELETE"),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/memory-calendar/access"] }); toast({ title: "Access revoked" }); },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> Memory Calendar access</CardTitle>
        <CardDescription>Admins always have access. Grant additional users below.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input type="number" placeholder="User ID" value={userId} onChange={(e) => setUserId(e.target.value)} className="max-w-[200px]" data-testid="input-grant-user-id" />
          <Button onClick={() => userId && grantMut.mutate(Number(userId))} disabled={!userId || grantMut.isPending} data-testid="button-grant-access">
            {grantMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />} Grant access
          </Button>
        </div>
        <Separator />
        <div className="space-y-2">
          {(accessQ.data || []).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No additional users granted access yet.</p>
          )}
          {(accessQ.data || []).map((row: any) => (
            <div key={row.id} className="flex items-center justify-between p-3 rounded-lg border" data-testid={`row-access-${row.userId}`}>
              <div>
                <div className="font-medium">{row.displayName || `User #${row.userId}`}</div>
                <div className="text-xs text-muted-foreground">{row.email || "—"} · granted {row.grantedAt ? new Date(row.grantedAt).toLocaleDateString() : ""}</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => revokeMut.mutate(row.userId)} data-testid={`button-revoke-${row.userId}`}>
                <Trash2 className="w-4 h-4 text-rose-500" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
