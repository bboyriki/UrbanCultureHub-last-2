import { useEffect, useState, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Brain, Sparkles, Wand2, Volume2, Lock, Layout, Palette, X, Search,
  Play, Loader2, Send, Camera, MessageSquare, Linkedin, MapPin, Calendar,
  ShieldCheck, Activity
} from "lucide-react";
import { SiInstagram } from "react-icons/si";
import { cn } from "@/lib/utils";

type Cmd = {
  id: string;
  label: string;
  hint: string;
  icon: any;
  group: "Navigate" | "Run" | "Test";
  action: () => void | Promise<void>;
};

export default function AiQuickAccess() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const isCreatorStudio = location.startsWith("/admin/creator-studio");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd+K / Ctrl+K to open, Esc to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(v => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else { setQ(""); setOutput(null); }
  }, [open]);

  const runRoleTest = useMutation({
    mutationFn: async ({ role, prompt }: { role: string; prompt: string }) => {
      const r = await apiRequest("POST", "/api/admin/ai/test", { role, prompt });
      return r.json();
    },
  });

  const quickAi = async (role: string, prompt: string, label: string) => {
    setBusy(label); setOutput(null);
    try {
      const r: any = await runRoleTest.mutateAsync({ role, prompt });
      if (r?.ok === false) throw new Error(r?.error || "Failed");
      setOutput(r.text || "(no response)");
    } catch (e: any) {
      toast({ title: `${label} failed`, description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const commands: Cmd[] = useMemo(() => [
    // Navigate
    { id: "nav-control", label: "AI Control Panel", hint: "Configure providers, models, cache, costs", icon: Brain, group: "Navigate", action: () => { navigate("/admin/ai-control"); setOpen(false); } },
    { id: "nav-studio", label: "AI Studio", hint: "Bulk AI tools & content generation", icon: Wand2, group: "Navigate", action: () => { navigate("/admin/ai-studio"); setOpen(false); } },
    { id: "nav-access", label: "AI Access", hint: "Per-user AI permissions & quotas", icon: Sparkles, group: "Navigate", action: () => { navigate("/admin/ai-access"); setOpen(false); } },
    { id: "nav-eleven", label: "ElevenLabs Studio", hint: "Voice & audio generation", icon: Volume2, group: "Navigate", action: () => { navigate("/admin/elevenlabs"); setOpen(false); } },
    { id: "nav-theme", label: "Theme Control (AI)", hint: "AI-assisted theme tuning", icon: Palette, group: "Navigate", action: () => { navigate("/admin/theme-control"); setOpen(false); } },
    { id: "nav-homepage", label: "Homepage Builder", hint: "AI-assisted homepage layout", icon: Layout, group: "Navigate", action: () => { navigate("/admin/homepage-builder"); setOpen(false); } },
    { id: "nav-security", label: "Security Center (AI)", hint: "AI security scan & insights", icon: Lock, group: "Navigate", action: () => { navigate("/admin/security-center"); setOpen(false); } },
    { id: "nav-instagram", label: "Instagram AI Agent", hint: "Comments, captions, automation", icon: SiInstagram, group: "Navigate", action: () => { navigate("/admin/instagram"); setOpen(false); } },
    { id: "nav-events", label: "Events AI", hint: "AI tool-driven event manager", icon: Calendar, group: "Navigate", action: () => { navigate("/admin/events"); setOpen(false); } },
    { id: "nav-spots", label: "Spots Overview (AI)", hint: "Auto-described spots", icon: MapPin, group: "Navigate", action: () => { navigate("/admin/spots-overview"); setOpen(false); } },

    // Quick run
    { id: "run-summary",  label: "Summarise today's activity", hint: "1-paragraph admin briefing", icon: Activity,      group: "Run", action: () => quickAi("admin_assistant", "Give a single-paragraph briefing of typical Urban Culture Hub admin priorities to monitor today (sign-ups, moderation queue, event approvals, IG mentions). Be punchy, max 80 words.", "Daily summary") },
    { id: "run-announce", label: "Draft community announcement", hint: "Friendly broadcast copy", icon: Send,            group: "Run", action: () => quickAi("content", "Write a warm, energetic community announcement (max 90 words) that thanks the Urban Culture Hub community and teases something new coming this week. Bilingual EN/NL not required — write in English.", "Announcement") },
    { id: "run-caption",  label: "Generate Instagram caption", hint: "Latest event vibe", icon: Camera,                  group: "Run", action: () => quickAi("instagram", "Write a fresh, authentic Instagram caption (max 220 chars) for an upcoming bboy battle in the Netherlands. Include 3-5 hashtags. Energetic, scene-aware tone.", "IG caption") },
    { id: "run-linkedin", label: "Draft LinkedIn post",        hint: "Professional, sponsor-friendly", icon: Linkedin,    group: "Run", action: () => quickAi("linkedin", "Write a LinkedIn post (under 1200 chars) introducing Urban Culture Hub to municipalities & sponsors. Warm, professional, end with 4 hashtags.", "LinkedIn post") },
    { id: "run-reply",    label: "Suggest 3 community replies", hint: "Tone-aware reply drafts", icon: MessageSquare,    group: "Run", action: () => quickAi("community", "Suggest 3 short, authentic, on-brand reply options to a positive community comment that says: 'Stoked for the next jam — keep it up!'. Number them 1-3.", "Replies") },
    { id: "run-spot",     label: "Describe a sample spot",      hint: "Auto-description preview",    icon: MapPin,        group: "Run", action: () => quickAi("spot_description", "Write a 2-sentence atmospheric description of a fictional outdoor breakdance plaza in Rotterdam. Punchy and scene-aware.", "Spot description") },

    // Test
    { id: "test-default", label: "Ping default role",   hint: "Verify basic chat works", icon: Play, group: "Test", action: () => quickAi("default",         "Say 'pong' and identify which model you are.", "Ping default") },
    { id: "test-finder",  label: "Ping AI Finder",       hint: "Check finder role wiring", icon: Play, group: "Test", action: () => quickAi("finder",          "Say 'pong' and identify which model you are.", "Ping finder") },
    { id: "test-admin",   label: "Ping Admin Assistant", hint: "Check admin assistant wiring", icon: ShieldCheck, group: "Test", action: () => quickAi("admin_assistant", "Say 'pong' and identify which model you are.", "Ping admin") },
  ], [navigate]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return commands;
    return commands.filter(c => c.label.toLowerCase().includes(term) || c.hint.toLowerCase().includes(term));
  }, [q, commands]);

  const grouped = useMemo(() => {
    const out: Record<string, Cmd[]> = { Navigate: [], Run: [], Test: [] };
    for (const c of filtered) out[c.group].push(c);
    return out;
  }, [filtered]);

  return (
    <>
      {/* Floating launcher — hidden on creator-studio (it has its own AI panel) */}
      {!isCreatorStudio && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white shadow-lg shadow-purple-500/30 flex items-center justify-center hover:scale-110 transition-transform"
          title="AI Quick Access (⌘K / Ctrl+K)"
          data-testid="button-ai-quick-access"
        >
          <Brain className="w-6 h-6" />
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] px-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          data-testid="overlay-ai-quick-access"
        >
          <div
            className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input
                ref={inputRef}
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search AI tools, run quick commands…"
                className="flex-1 bg-transparent outline-none text-sm"
                data-testid="input-ai-quick-search"
              />
              <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">esc</kbd>
              <button onClick={() => setOpen(false)} className="ml-1 p-1 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>

            <div className="max-h-[50vh] overflow-y-auto p-2">
              {(["Navigate", "Run", "Test"] as const).map(group => (
                grouped[group].length > 0 && (
                  <div key={group} className="mb-2">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1">{group}</div>
                    {grouped[group].map(c => (
                      <button
                        key={c.id}
                        onClick={() => c.action()}
                        disabled={!!busy}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm hover:bg-muted disabled:opacity-50 transition-colors",
                          busy === c.label && "bg-muted"
                        )}
                        data-testid={`button-quick-${c.id}`}
                      >
                        <c.icon className="w-4 h-4 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{c.label}</div>
                          <div className="text-xs text-muted-foreground truncate">{c.hint}</div>
                        </div>
                        {busy === c.label && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                      </button>
                    ))}
                  </div>
                )
              ))}
              {filtered.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">No commands match.</div>
              )}
            </div>

            {output && (
              <div className="border-t border-border p-3 max-h-[30vh] overflow-y-auto">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Output</div>
                <div className="text-sm whitespace-pre-wrap" data-testid="text-ai-quick-output">{output}</div>
              </div>
            )}

            <div className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground flex items-center justify-between">
              <span>Press ⌘K / Ctrl+K to toggle</span>
              <span>{filtered.length} command{filtered.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
