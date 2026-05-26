import { useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Palette, Sparkles, Calendar, Zap, Check, RotateCcw,
  Wand2, RefreshCw, Sliders, BookMarked, Lightbulb, Server, AlertTriangle,
  Copy, Shuffle, Star, Eye, Flame,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { applyTheme, clearTheme, type FullThemeConfig } from "@/lib/themeUtils";

/* ─── Types ──────────────────────────────────────────────────────────── */
export interface ThemeColorSet {
  primary: string;
  background?: string;
  card?: string;
  accent?: string;
  muted?: string;
  border?: string;
}

export interface ThemeConfig extends FullThemeConfig {
  name: string;
  emoji: string;
  description: string;
  preview: string;
  previewGradient: string;
}

/* ─── Built-in Presets ───────────────────────────────────────────────── */
export const THEME_PRESETS: ThemeConfig[] = [
  { id:"original",    name:"Original Blue",  emoji:"🔵", description:"Classic blue — the default",          preview:"#3b7be8", previewGradient:"from-blue-500 to-blue-700",   light:{primary:"221 83% 53%",background:"0 0% 99%",   card:"0 0% 100%",   accent:"220 14% 94%",muted:"220 14% 95%",border:"220 13% 91%"}, dark:{primary:"221 83% 60%",background:"222 17% 7%", card:"222 17% 10%",accent:"222 17% 16%",muted:"222 17% 14%",border:"222 17% 20%"} },
  { id:"neon_city",   name:"Neon City",       emoji:"🟣", description:"Purple neon underground vibes",       preview:"#8b22e0", previewGradient:"from-purple-600 to-violet-800",light:{primary:"268 90% 55%",background:"268 30% 99%",card:"268 20% 100%",accent:"268 25% 95%",muted:"268 20% 96%",border:"268 20% 90%"}, dark:{primary:"268 90% 68%",background:"268 25% 6%", card:"268 22% 10%",accent:"268 22% 16%",muted:"268 22% 13%",border:"268 22% 20%"} },
  { id:"graffiti",    name:"Graffiti Street", emoji:"🟠", description:"Orange fire — raw street energy",     preview:"#f04a0a", previewGradient:"from-orange-500 to-red-600",  light:{primary:"20 95% 52%", background:"20 30% 99%", card:"20 15% 100%", accent:"20 20% 95%", muted:"20 15% 96%", border:"20 15% 90%"}, dark:{primary:"20 95% 62%", background:"20 20% 7%",  card:"20 18% 10%", accent:"20 18% 16%", muted:"20 18% 13%",border:"20 18% 20%"} },
  { id:"golden_era",  name:"Golden Era",      emoji:"🟡", description:"Warm gold — 90s hip-hop nostalgia",  preview:"#e09b10", previewGradient:"from-yellow-500 to-amber-600", light:{primary:"38 92% 48%", background:"38 40% 99%", card:"38 25% 100%", accent:"38 30% 95%", muted:"38 25% 96%", border:"38 20% 90%"}, dark:{primary:"38 92% 58%", background:"30 20% 7%",  card:"30 18% 10%", accent:"30 18% 16%", muted:"30 18% 13%",border:"30 18% 20%"} },
  { id:"teal_wave",   name:"Teal Wave",       emoji:"🟢", description:"Electric teal — fresh energy",       preview:"#0ea57a", previewGradient:"from-teal-500 to-emerald-600", light:{primary:"172 85% 38%",background:"172 30% 99%",card:"172 15% 100%",accent:"172 20% 95%",muted:"172 15% 96%",border:"172 15% 90%"}, dark:{primary:"172 85% 50%",background:"172 20% 7%", card:"172 18% 10%",accent:"172 18% 16%",muted:"172 18% 13%",border:"172 18% 20%"} },
  { id:"red_flame",   name:"Red Flame",       emoji:"🔴", description:"Deep red — powerful and intense",    preview:"#e01a1a", previewGradient:"from-red-500 to-rose-700",   light:{primary:"0 85% 52%",  background:"0 30% 99%",  card:"0 15% 100%",  accent:"0 20% 95%",  muted:"0 15% 96%",  border:"0 15% 91%"},  dark:{primary:"0 85% 62%",  background:"0 20% 7%",   card:"0 18% 10%",  accent:"0 18% 16%",  muted:"0 18% 13%", border:"0 18% 20%"} },
  { id:"pink_future", name:"Pink Future",     emoji:"🩷", description:"Rose pink — creative and bold",      preview:"#e0218a", previewGradient:"from-pink-500 to-rose-600",  light:{primary:"330 85% 52%",background:"330 30% 99%",card:"330 15% 100%",accent:"330 20% 95%",muted:"330 15% 96%",border:"330 15% 91%"}, dark:{primary:"330 85% 65%",background:"330 20% 7%", card:"330 18% 10%",accent:"330 18% 16%",muted:"330 18% 13%",border:"330 18% 20%"} },
  { id:"cyber_green", name:"Cyber Green",     emoji:"🟩", description:"Matrix green — digital underground", preview:"#1a9e4a", previewGradient:"from-green-500 to-lime-600",  light:{primary:"142 71% 40%",background:"142 30% 99%",card:"142 15% 100%",accent:"142 20% 95%",muted:"142 15% 96%",border:"142 15% 91%"}, dark:{primary:"142 71% 52%",background:"142 20% 7%", card:"142 18% 10%",accent:"142 18% 16%",muted:"142 18% 13%",border:"142 18% 20%"} },
  { id:"midnight",    name:"Midnight Ice",    emoji:"🌙", description:"Cool midnight — deep and mysterious", preview:"#1e3a8a", previewGradient:"from-blue-900 to-indigo-900", light:{primary:"226 71% 40%",background:"226 30% 99%",card:"226 15% 100%",accent:"226 20% 95%",muted:"226 15% 96%",border:"226 15% 91%"}, dark:{primary:"226 80% 65%",background:"226 35% 5%", card:"226 30% 8%", accent:"226 25% 14%",muted:"226 25% 11%",border:"226 25% 18%"} },
  { id:"copper",      name:"Copper Grind",    emoji:"🟤", description:"Warm copper — gritty and authentic", preview:"#b87333", previewGradient:"from-amber-700 to-orange-800",light:{primary:"29 60% 45%", background:"29 25% 99%", card:"29 15% 100%", accent:"29 20% 95%", muted:"29 15% 96%", border:"29 15% 91%"}, dark:{primary:"29 65% 58%", background:"29 20% 7%",  card:"29 18% 10%", accent:"29 18% 16%", muted:"29 18% 13%",border:"29 18% 20%"} },
];

const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DAY_FULL  = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const STYLE_MODIFIERS = [
  { id:"dark",         label:"🌑 Dark" },       { id:"vibrant",      label:"⚡ Vibrant" },
  { id:"pastel",       label:"🌸 Pastel" },     { id:"neon",         label:"💡 Neon" },
  { id:"earthy",       label:"🌍 Earthy" },     { id:"moody",        label:"🌫️ Moody" },
  { id:"retro",        label:"📺 Retro" },      { id:"futuristic",   label:"🚀 Futuristic" },
  { id:"warm",         label:"🔥 Warm" },       { id:"cool",         label:"❄️ Cool" },
  { id:"gritty",       label:"🧱 Gritty" },    { id:"minimal",      label:"⬜ Minimal" },
  { id:"high_contrast",label:"🎭 Contrast" },  { id:"underground",  label:"🕳️ Underground" },
  { id:"holographic",  label:"🌈 Holographic" }, { id:"brutalist",  label:"💪 Brutalist" },
];

const REFINE_DIRECTIONS = [
  { id:"darker",         label:"🌑 Darker" },   { id:"lighter",        label:"☀️ Lighter" },
  { id:"more_saturated", label:"⚡ Boost" },     { id:"less_saturated", label:"🌫️ Mute" },
  { id:"warmer",         label:"🔥 Warmer" },    { id:"cooler",         label:"❄️ Cooler" },
  { id:"more_contrast",  label:"🎭 Contrast" }, { id:"complement",     label:"🔄 Flip Hue" },
];

const QUICK_PROMPTS = [
  "Vibrant Amsterdam street art at sunset",
  "Electric underground rave — 3AM neon",
  "Warm 90s hip-hop golden era nostalgia",
  "Cold midnight skating session",
  "Tropical breakdance beach festival",
  "Dark graffiti tunnel at 3AM",
  "Rotterdam port industrial energy",
  "Dutch techno warehouse rave",
  "Summer beach jam on Scheveningen",
  "Midnight blue bboy cypher",
  "Sunset rooftop DJ session Amsterdam",
  "Grunge skate park concrete vibes",
];

const CREATIVITY_LEVELS = [
  { value: 1, label: "Precise", desc: "Literal interpretation, safe palette" },
  { value: 2, label: "Balanced", desc: "Creative but cohesive" },
  { value: 3, label: "Bold", desc: "Unexpected takes, vivid colours" },
  { value: 4, label: "Wild", desc: "Maximum creativity, experimental" },
];

/* ─── Sub-components ────────────────────────────────────────────────── */
function ColorSwatchRow({ theme }: { theme: ThemeConfig }) {
  return (
    <div className="flex gap-1 mt-2">
      {[theme.light.primary, theme.light.background, theme.light.card, theme.light.accent, theme.dark.primary, theme.dark.background]
        .filter(Boolean)
        .map((hsl, i) => (
          <div key={i} className="flex-1 h-4 rounded" style={{ background: `hsl(${hsl})` }} title={hsl} />
        ))}
    </div>
  );
}

function PresetCard({ theme, isActive, onSelect }: { theme: ThemeConfig; isActive: boolean; onSelect: () => void }) {
  return (
    <motion.div whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}
      onClick={onSelect}
      className={`relative cursor-pointer rounded-xl border-2 p-3 select-none transition-all ${
        isActive ? "border-primary shadow-lg shadow-primary/20 bg-primary/5" : "border-border hover:border-primary/50"
      }`}
      data-testid={`theme-card-${theme.id}`}>
      {isActive && (
        <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
      <div className={`w-full h-12 rounded-lg bg-gradient-to-br ${theme.previewGradient} mb-2`} />
      <ColorSwatchRow theme={theme} />
      <p className="font-semibold text-xs mt-2 truncate">{theme.emoji} {theme.name}</p>
      <p className="text-[10px] text-muted-foreground truncate mt-0.5">{theme.description}</p>
    </motion.div>
  );
}

function MiniUIPreview({ theme }: { theme: ThemeConfig }) {
  const p  = theme.light.primary    || "221 83% 53%";
  const bg = theme.light.background || "0 0% 99%";
  const cd = theme.light.card       || "0 0% 100%";
  const ac = theme.light.accent     || "220 14% 94%";
  const bd = theme.light.border     || "220 13% 91%";
  return (
    <div className="rounded-lg overflow-hidden border text-[9px] select-none" style={{ background: `hsl(${bg})`, borderColor: `hsl(${bd})` }}>
      {/* Nav bar */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b" style={{ background: `hsl(${cd})`, borderColor: `hsl(${bd})` }}>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: `hsl(${p})` }} />
          <span className="font-bold" style={{ color: `hsl(${p})` }}>Urban Hub</span>
        </div>
        <div className="flex gap-1">
          <div className="w-4 h-1.5 rounded-full" style={{ background: `hsl(${ac})` }} />
          <div className="w-3 h-1.5 rounded-full" style={{ background: `hsl(${p})` }} />
        </div>
      </div>
      {/* Body */}
      <div className="p-2 space-y-1.5">
        <div className="rounded-md p-1.5" style={{ background: `hsl(${cd})`, border: `1px solid hsl(${bd})` }}>
          <div className="w-8 h-1 rounded-full mb-1" style={{ background: `hsl(${p})` }} />
          <div className="w-14 h-1 rounded-full mb-1" style={{ background: `hsl(${ac})` }} />
          <div className="w-10 h-1 rounded-full" style={{ background: `hsl(${ac})` }} />
        </div>
        <div className="flex gap-1">
          <div className="rounded px-2 py-0.5 text-[8px] font-medium" style={{ background: `hsl(${p})`, color: "#fff" }}>Button</div>
          <div className="rounded px-2 py-0.5 text-[8px]" style={{ background: `hsl(${ac})`, color: `hsl(${p})`, border: `1px solid hsl(${bd})` }}>Outline</div>
          <div className="rounded-full px-1.5 py-0.5 text-[7px]" style={{ background: `hsl(${p})22`, color: `hsl(${p})` }}>Badge</div>
        </div>
      </div>
    </div>
  );
}

function AiResultCard({ theme, isSelected, onSelect, onRefine, onSave, refining, genTime }: {
  theme: ThemeConfig; isSelected: boolean; onSelect: () => void;
  onRefine: (dir: string) => void; onSave: () => void; refining: boolean; genTime?: number;
}) {
  const { toast } = useToast();
  const [showPreview, setShowPreview] = useState(false);

  const copyCssVars = () => {
    const vars = [
      `/* ${theme.emoji} ${theme.name} — Light Mode */`,
      `--primary: ${theme.light.primary};`,
      `--background: ${theme.light.background || "0 0% 99%"};`,
      `--card: ${theme.light.card || "0 0% 100%"};`,
      `--accent: ${theme.light.accent || "220 14% 94%"};`,
      `--muted: ${theme.light.muted || "220 14% 95%"};`,
      `--border: ${theme.light.border || "220 13% 91%"};`,
      ``,
      `/* Dark Mode */`,
      `--primary: ${theme.dark.primary};`,
      `--background: ${theme.dark.background || "222 17% 7%"};`,
      `--card: ${theme.dark.card || "222 17% 10%"};`,
    ].join("\n");
    navigator.clipboard.writeText(vars).then(() => toast({ title: "CSS variables copied!" }));
  };

  return (
    <div className={`rounded-xl border-2 transition-all overflow-hidden ${isSelected ? "border-primary bg-primary/5 shadow-md shadow-primary/10" : "border-border hover:border-primary/40"}`}
         data-testid={`ai-result-${theme.id}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 p-3 pb-2">
        <div className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0" onClick={onSelect}>
          <div className="w-10 h-10 rounded-xl flex-shrink-0 border border-black/10 shadow-sm" style={{ background: theme.preview }} />
          <div className="min-w-0">
            <p className="font-bold text-sm">{theme.emoji} {theme.name}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{theme.description}</p>
            {genTime && <p className="text-[9px] text-muted-foreground/60 mt-0.5">Generated in {genTime}ms</p>}
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={() => setShowPreview(v => !v)}
            className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
            title="Preview UI" data-testid={`preview-ai-${theme.id}`}>
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button onClick={copyCssVars}
            className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
            title="Copy CSS variables" data-testid={`copy-ai-${theme.id}`}>
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button onClick={onSave}
            className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-amber-500 hover:border-amber-400 transition-colors"
            title="Save to library" data-testid={`save-ai-${theme.id}`}>
            <Star className="w-3.5 h-3.5" />
          </button>
          <button onClick={onSelect}
            className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
              isSelected ? "border-primary bg-primary text-white" : "border-border hover:border-primary"
            }`}>
            {isSelected && <Check className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Mini UI Preview */}
      <AnimatePresence>
        {showPreview && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="px-3 pb-2">
            <MiniUIPreview theme={theme} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full colour strip */}
      <div className="grid grid-cols-6 gap-1 px-3 pb-2">
        {[
          { l:"Light Primary",hsl:theme.light.primary },
          { l:"BG",hsl:theme.light.background },
          { l:"Card",hsl:theme.light.card },
          { l:"Accent",hsl:theme.light.accent },
          { l:"Dark Primary",hsl:theme.dark.primary },
          { l:"Dark BG",hsl:theme.dark.background },
        ].filter(s=>s.hsl).map(s=>(
          <div key={s.l} className="text-center">
            <div className="w-full h-5 rounded border border-black/10" style={{ background:`hsl(${s.hsl})` }} title={s.hsl} />
            <span className="text-[8px] text-muted-foreground">{s.l.split(" ").pop()}</span>
          </div>
        ))}
      </div>

      {/* Refine buttons — only for selected */}
      {isSelected && (
        <div className="px-3 pb-3 pt-2 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Refine direction:
          </p>
          <div className="grid grid-cols-4 gap-1">
            {REFINE_DIRECTIONS.map(d => (
              <button key={d.id} onClick={() => onRefine(d.id)} disabled={refining}
                className="text-[10px] py-1.5 px-1 rounded-lg border border-border bg-background hover:bg-primary/5 hover:border-primary/40 hover:text-primary transition-all text-center disabled:opacity-40"
                data-testid={`refine-${d.id}`}>
                {refining ? <RefreshCw className="w-2.5 h-2.5 mx-auto animate-spin" /> : d.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Live preview thumbnail ─────────────────────────────────────────── */
function ThemePreviewBadge({ theme }: { theme: ThemeConfig }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border bg-muted/30">
      <div className="w-10 h-10 rounded-xl flex-shrink-0" style={{ background: theme.preview }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{theme.emoji} {theme.name}</p>
        <p className="text-[11px] text-muted-foreground truncate">{theme.description}</p>
      </div>
      <ColorSwatchRow theme={theme} />
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────── */
export default function ThemeControlPage() {
  const { toast } = useToast();

  const [previewTheme, setPreviewTheme] = useState<ThemeConfig>(THEME_PRESETS[0]);
  const [activeTheme, setActiveTheme]   = useState<ThemeConfig>(THEME_PRESETS[0]);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [schedule, setSchedule] = useState<Record<string,string>>({
    "0":"original","1":"original","2":"original","3":"original",
    "4":"original","5":"neon_city","6":"golden_era",
  });
  const [lastSaved, setLastSaved] = useState<string|null>(null);

  // Color builder
  const [customH, setCustomH] = useState(221);
  const [customS, setCustomS] = useState(83);
  const [customL, setCustomL] = useState(53);

  // AI state
  const [aiMode, setAiMode]             = useState<"single"|"triple">("triple");
  const [aiPrompt, setAiPrompt]         = useState("");
  const [styleModifiers, setStyleMods]  = useState<string[]>([]);
  const [aiResults, setAiResults]       = useState<ThemeConfig[]>([]);
  const [selectedAiIdx, setSelectedAiIdx] = useState(0);
  const [aiLibrary, setAiLibrary]       = useState<ThemeConfig[]>([]);
  const [creativity, setCreativity]     = useState(2);
  const [aiError, setAiError]           = useState<string | null>(null);
  const [genTime, setGenTime]           = useState<number | null>(null);

  const [initDone, setInitDone] = useState(false);

  const { data: saved } = useQuery<{
    activeThemeId: string; activeThemeConfig: ThemeConfig | null;
    scheduleEnabled: boolean; schedule: Record<string,string>; customThemes: ThemeConfig[];
  }>({ queryKey: ["/api/admin/theme"], staleTime: 30000 });

  if (saved && !initDone) {
    const id = saved.activeThemeId || "original";
    const found = [...THEME_PRESETS, ...(saved.customThemes || []), ...(saved.activeThemeConfig ? [saved.activeThemeConfig] : [])]
      .find(t => t.id === id) || THEME_PRESETS[0];
    setActiveTheme(found);
    setPreviewTheme(found);
    if (saved.scheduleEnabled !== undefined) setScheduleEnabled(saved.scheduleEnabled);
    if (saved.schedule) setSchedule(saved.schedule);
    if (saved.customThemes?.length) setAiLibrary(saved.customThemes);
    setInitDone(true);
  }

  const allThemes = [...THEME_PRESETS, ...aiLibrary];

  // The theme that is ACTUALLY saved on the server right now
  const serverThemeId = saved?.activeThemeId || "original";
  const serverTheme = allThemes.find(t => t.id === serverThemeId) || THEME_PRESETS[0];
  const isOutOfSync = previewTheme.id !== serverThemeId;

  const handleSelect = useCallback((theme: ThemeConfig) => {
    setPreviewTheme(theme);
    applyTheme(theme); // inline-style injection — always works
  }, []);

  const handleReset = () => {
    setPreviewTheme(THEME_PRESETS[0]);
    setActiveTheme(THEME_PRESETS[0]);
    clearTheme();
  };

  /* Save */
  const saveMutation = useMutation({
    mutationFn: (d: any) => apiRequest("/api/admin/theme", "POST", d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/theme"] });
      setActiveTheme(previewTheme);
      applyTheme(previewTheme);
      setLastSaved(new Date().toLocaleTimeString());
      toast({ title: "✅ Theme applied globally!", description: "All users will see this on next page load." });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const handleSave = () => saveMutation.mutate({
    activeThemeId: previewTheme.id,
    activeThemeConfig: previewTheme,
    scheduleEnabled,
    schedule,
    customThemes: aiLibrary,
  });

  /* AI generate — FIX: parse Response → JSON */
  const aiMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest("/api/admin/theme/generate", "POST", body);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || json?.details || "Generation failed");
      return json;
    },
    onSuccess: (data: any) => {
      const themes: ThemeConfig[] = Array.isArray(data?.themes) ? data.themes
        : data?.theme ? [data.theme] : [];
      if (themes.length) {
        setAiResults(themes);
        setSelectedAiIdx(0);
        setAiError(null);
        handleSelect(themes[0]);
        if (genTime !== null) {
          toast({ title: `${themes.length === 1 ? "Theme" : `${themes.length} themes`} generated ✨` });
        }
      }
    },
    onError: (err: any) => {
      setAiError(err?.message || "AI generation failed. Check the server logs.");
      toast({ title: "AI generation failed", description: err?.message, variant: "destructive" });
    },
  });

  /* AI refine — FIX: parse Response → JSON */
  const refineMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest("/api/admin/theme/refine", "POST", body);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Refinement failed");
      return json;
    },
    onSuccess: (data: any) => {
      if (data?.theme) {
        setAiResults(prev => prev.map((t, i) => i === selectedAiIdx ? data.theme : t));
        handleSelect(data.theme);
        toast({ title: "Theme refined ✨" });
      }
    },
    onError: (err: any) => toast({ title: "Refinement failed", description: err?.message, variant: "destructive" }),
  });

  const toggleMod = (id: string) =>
    setStyleMods(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);

  const randomizePrompt = () => {
    const p = QUICK_PROMPTS[Math.floor(Math.random() * QUICK_PROMPTS.length)];
    setAiPrompt(p);
    const mods = STYLE_MODIFIERS.sort(() => Math.random() - 0.5).slice(0, Math.floor(Math.random() * 3));
    setStyleMods(mods.map(m => m.id));
  };

  const triggerGenerate = () => {
    if (!aiPrompt.trim() || aiMutation.isPending) return;
    setAiError(null);
    const t0 = Date.now();
    aiMutation.mutate(
      { prompt: aiPrompt, mode: aiMode, styleModifiers, creativity },
      { onSettled: () => setGenTime(Date.now() - t0) }
    );
  };

  const saveToLibrary = (theme: ThemeConfig) => {
    const t = { ...theme, id: `ai_${Date.now()}` };
    setAiLibrary(prev => [...prev.filter(x => x.name !== theme.name), t].slice(-8));
    toast({ title: `${theme.emoji} Saved to library` });
  };

  const customTheme: ThemeConfig = {
    id:"custom", name:"Custom", emoji:"🎨", description:"Your custom colour",
    preview:`hsl(${customH},${customS}%,${customL}%)`,
    previewGradient:"from-gray-500 to-gray-700",
    light:{ primary:`${customH} ${customS}% ${customL}%` },
    dark:{ primary:`${customH} ${customS}% ${Math.min(customL+10,75)}%` },
  };

  const selectedAiTheme = aiResults[selectedAiIdx] || null;
  const todayIdx = new Date().getDay();

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* ── Sticky Header ── */}
      <div className="border-b bg-card px-4 sm:px-6 py-3 sticky top-0 z-10">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: previewTheme.preview + "22" }}>
              <Palette className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: previewTheme.preview }} />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold leading-tight">Theme Control</h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Overrides theme for ALL users on the live server</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className="text-[10px] gap-1 px-2 py-0.5 border-green-500/50 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30">
              <Server className="w-2.5 h-2.5" />
              {serverTheme.emoji} {serverTheme.name}
            </Badge>
            <Button size="sm" variant="outline" onClick={handleReset} className="h-8 px-2.5 text-xs"
              data-testid="button-reset-theme">
              <RotateCcw className="w-3 h-3 sm:mr-1" />
              <span className="hidden sm:inline">Reset</span>
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}
              className={`h-8 px-3 text-xs font-semibold transition-all ${
                isOutOfSync
                  ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-500/20 animate-pulse"
                  : ""
              }`}
              data-testid="button-save-theme">
              {saveMutation.isPending
                ? <RefreshCw className="w-3 h-3 sm:mr-1.5 animate-spin" />
                : isOutOfSync
                  ? <AlertTriangle className="w-3 h-3 sm:mr-1.5" />
                  : <Zap className="w-3 h-3 sm:mr-1.5" />}
              <span className="hidden sm:inline">{isOutOfSync ? "Save to Server" : "Apply to All"}</span>
              <span className="sm:hidden">{isOutOfSync ? "Save!" : "Apply"}</span>
            </Button>
          </div>
        </div>

        {/* Out-of-sync warning banner */}
        {isOutOfSync && (
          <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              You selected <strong>{previewTheme.emoji} {previewTheme.name}</strong> but the server is still showing <strong>{serverTheme.emoji} {serverTheme.name}</strong> to all users. Click <strong>Save to Server</strong> to apply the change.
            </span>
          </div>
        )}
        {lastSaved && !isOutOfSync && (
          <p className="text-[10px] text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
            <Check className="w-3 h-3" /> Saved to live server at {lastSaved} — all users will see {activeTheme.emoji} {activeTheme.name}
          </p>
        )}
      </div>

      {/* ── Content ── */}
      <div className="px-4 sm:px-6 pt-4">
        {/* Active theme banner */}
        <div className="mb-4">
          <ThemePreviewBadge theme={previewTheme} />
        </div>

        <Tabs defaultValue="ai">
          {/* Scrollable tabs on mobile */}
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 mb-4">
            <TabsList className="flex w-max sm:w-full sm:grid sm:grid-cols-4 gap-0 min-w-full">
              <TabsTrigger value="presets" className="text-xs px-3 sm:px-4 whitespace-nowrap">
                <Palette className="w-3.5 h-3.5 mr-1.5" />Presets
              </TabsTrigger>
              <TabsTrigger value="ai" className="text-xs px-3 sm:px-4 whitespace-nowrap" data-testid="tab-ai">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />AI Studio
              </TabsTrigger>
              <TabsTrigger value="builder" className="text-xs px-3 sm:px-4 whitespace-nowrap">
                <Sliders className="w-3.5 h-3.5 mr-1.5" />Builder
              </TabsTrigger>
              <TabsTrigger value="schedule" className="text-xs px-3 sm:px-4 whitespace-nowrap">
                <Calendar className="w-3.5 h-3.5 mr-1.5" />Schedule
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ── PRESETS ── */}
          <TabsContent value="presets">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {[...THEME_PRESETS, ...aiLibrary].map(t => (
                <PresetCard key={t.id} theme={t} isActive={previewTheme.id === t.id}
                  onSelect={() => handleSelect(t)} />
              ))}
            </div>
          </TabsContent>

          {/* ── AI STUDIO ── */}
          <TabsContent value="ai" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" /> AI Theme Studio
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px] border-primary/40 text-primary bg-primary/5">
                    Powered by Claude
                  </Badge>
                </div>
                <CardDescription className="text-xs">Describe any vibe — AI generates a complete colour theme with light + dark modes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Prompt + randomize */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Vibe Prompt</Label>
                    <button onClick={randomizePrompt}
                      className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors"
                      data-testid="button-randomize-prompt">
                      <Shuffle className="w-3 h-3" /> Randomize
                    </button>
                  </div>
                  <Textarea
                    placeholder="Describe a mood, scene, or aesthetic… e.g. 'vibrant Amsterdam street art at sunset'"
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) triggerGenerate(); }}
                    className="min-h-[72px] resize-none text-sm"
                    data-testid="input-ai-prompt"
                  />
                  <p className="text-[10px] text-muted-foreground">Tip: Press Ctrl+Enter to generate quickly</p>
                </div>

                {/* Quick suggestions */}
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Quick vibes →</p>
                  <div className="grid grid-cols-2 gap-1">
                    {QUICK_PROMPTS.slice(0, 6).map(s => (
                      <button key={s} onClick={() => setAiPrompt(s)}
                        className="text-left text-[11px] px-2.5 py-1.5 rounded-lg bg-muted/60 hover:bg-primary/10 hover:text-primary text-muted-foreground transition-colors border border-transparent hover:border-primary/20 truncate"
                        data-testid={`quick-prompt-${s.slice(0,10)}`}>
                        ✨ {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Style modifiers */}
                <div>
                  <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                    Style Modifiers
                    {styleModifiers.length > 0 && (
                      <button onClick={() => setStyleMods([])} className="ml-auto text-[10px] text-muted-foreground hover:text-destructive transition-colors">
                        Clear {styleModifiers.length}
                      </button>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {STYLE_MODIFIERS.map(m => (
                      <button key={m.id} onClick={() => toggleMod(m.id)}
                        className={`text-[11px] px-2.5 py-1 rounded-full border transition-all select-none ${
                          styleModifiers.includes(m.id)
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-background border-border hover:border-primary/50 text-muted-foreground"
                        }`}
                        data-testid={`modifier-${m.id}`}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Creativity slider */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-orange-500" />
                      Creativity: <span className="text-primary font-bold">{CREATIVITY_LEVELS[creativity - 1]?.label}</span>
                    </p>
                    <span className="text-[10px] text-muted-foreground">{CREATIVITY_LEVELS[creativity - 1]?.desc}</span>
                  </div>
                  <Slider min={1} max={4} step={1} value={[creativity]}
                    onValueChange={([v]) => setCreativity(v)}
                    data-testid="slider-creativity" />
                  <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                    <span>Precise</span><span>Balanced</span><span>Bold</span><span>Wild</span>
                  </div>
                </div>

                {/* Mode + generate */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex items-center rounded-lg border p-0.5 gap-0.5 self-start">
                    {(["single","triple"] as const).map(mode => (
                      <button key={mode} onClick={() => setAiMode(mode)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                          aiMode === mode ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
                        }`}
                        data-testid={`mode-${mode}`}>
                        {mode === "single" ? "1 Theme" : "3 Variations"}
                      </button>
                    ))}
                  </div>
                  <Button className="flex-1 gap-2 font-semibold" onClick={triggerGenerate}
                    disabled={!aiPrompt.trim() || aiMutation.isPending}
                    data-testid="button-generate-ai-theme">
                    {aiMutation.isPending
                      ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating{aiMode === "triple" ? " 3 themes" : ""}…</>
                      : <><Wand2 className="w-4 h-4" /> Generate with AI</>}
                  </Button>
                  {aiResults.length > 0 && !aiMutation.isPending && (
                    <Button variant="outline" size="sm" onClick={triggerGenerate} className="gap-1 text-xs"
                      data-testid="button-generate-again">
                      <RefreshCw className="w-3.5 h-3.5" /> Again
                    </Button>
                  )}
                </div>

                {/* Error display */}
                {aiError && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">Generation failed</p>
                      <p className="text-destructive/80 mt-0.5">{aiError}</p>
                    </div>
                  </div>
                )}

                {/* Loading shimmer */}
                {aiMutation.isPending && (
                  <div className="space-y-2 animate-pulse">
                    {Array.from({ length: aiMode === "triple" ? 3 : 1 }).map((_, i) => (
                      <div key={i} className="h-20 rounded-xl bg-muted/60 border border-border" />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Results */}
            <AnimatePresence>
              {aiResults.length > 0 && !aiMutation.isPending && (
                <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      {aiResults.length > 1 ? `${aiResults.length} variations generated` : "Theme generated"}
                      {genTime && <span className="font-normal text-muted-foreground/60">in {(genTime/1000).toFixed(1)}s</span>}
                    </p>
                  </div>
                  <div className="space-y-3">
                    {aiResults.map((theme, idx) => (
                      <AiResultCard
                        key={theme.id + idx}
                        theme={theme}
                        isSelected={selectedAiIdx === idx}
                        onSelect={() => { setSelectedAiIdx(idx); handleSelect(theme); }}
                        onRefine={dir => refineMutation.mutate({ theme, direction: dir })}
                        onSave={() => saveToLibrary(theme)}
                        refining={refineMutation.isPending && selectedAiIdx === idx}
                        genTime={genTime || undefined}
                      />
                    ))}
                  </div>
                  {selectedAiTheme && (
                    <div className="flex gap-2 mt-3">
                      <Button className="flex-1" onClick={() => handleSelect(selectedAiTheme)}
                        data-testid="button-use-selected-ai">
                        <Check className="w-4 h-4 mr-2" /> Use This Theme
                      </Button>
                      <Button variant="outline" onClick={() => saveToLibrary(selectedAiTheme)}
                        data-testid="button-save-to-library">
                        <Star className="w-4 h-4 mr-2" /> Save to Library
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* AI Library */}
            {aiLibrary.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-amber-500" /> Saved Library ({aiLibrary.length})
                  </p>
                  <button onClick={() => setAiLibrary([])} className="text-[10px] text-muted-foreground hover:text-destructive transition-colors">
                    Clear all
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {aiLibrary.map(t => (
                    <button key={t.id} onClick={() => handleSelect(t)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                        previewTheme.id === t.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                      }`}
                      data-testid={`library-${t.id}`}>
                      <div className="w-8 h-8 rounded-xl flex-shrink-0 shadow-sm" style={{ background: t.preview }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{t.emoji} {t.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{t.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── BUILDER ── */}
          <TabsContent value="builder">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-primary" /> Custom Color Builder
                </CardTitle>
                <CardDescription className="text-xs">Fine-tune with HSL precision sliders</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl shadow-lg border-4 border-white/20 flex-shrink-0"
                       style={{ background: customTheme.preview }} />
                  <div className="flex-1 space-y-3">
                    {[
                      { label:"Hue", val:customH, min:0, max:359, unit:"°",
                        onChange:(v:number)=>{ setCustomH(v); handleSelect({...customTheme,light:{primary:`${v} ${customS}% ${customL}%`},dark:{primary:`${v} ${customS}% ${Math.min(customL+10,75)}%`},preview:`hsl(${v},${customS}%,${customL}%)`}); } },
                      { label:"Saturation", val:customS, min:10, max:100, unit:"%",
                        onChange:(v:number)=>{ setCustomS(v); handleSelect({...customTheme,light:{primary:`${customH} ${v}% ${customL}%`},dark:{primary:`${customH} ${v}% ${Math.min(customL+10,75)}%`},preview:`hsl(${customH},${v}%,${customL}%)`}); } },
                      { label:"Lightness", val:customL, min:20, max:70, unit:"%",
                        onChange:(v:number)=>{ setCustomL(v); handleSelect({...customTheme,light:{primary:`${customH} ${customS}% ${v}%`},dark:{primary:`${customH} ${customS}% ${Math.min(v+10,75)}%`},preview:`hsl(${customH},${customS}%,${v}%)`}); } },
                    ].map(({ label, val, min, max, unit, onChange }) => (
                      <div key={label} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <Label className="text-muted-foreground font-normal">{label}</Label>
                          <span className="font-mono text-muted-foreground">{val}{unit}</span>
                        </div>
                        <Slider min={min} max={max} step={1} value={[val]}
                          onValueChange={([v]) => onChange(v)}
                          data-testid={`slider-${label.toLowerCase()}`} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick colours */}
                <div className="grid grid-cols-4 gap-2">
                  {[0,30,60,120,172,210,268,330].map(h => (
                    <button key={h} className="h-10 rounded-xl border-2 border-white/10 hover:scale-105 transition-transform"
                      style={{ background:`hsl(${h},80%,52%)` }}
                      onClick={() => { setCustomH(h); setCustomS(80); setCustomL(52);
                        handleSelect({...customTheme,light:{primary:`${h} 80% 52%`},dark:{primary:`${h} 80% 62%`},preview:`hsl(${h},80%,52%)`}); }}
                      data-testid={`quick-color-${h}`} />
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── SCHEDULE ── */}
          <TabsContent value="schedule">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" /> Daily Auto-Switch
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">Different theme per day of the week</CardDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Switch id="sched-toggle" checked={scheduleEnabled} onCheckedChange={setScheduleEnabled}
                      data-testid="switch-schedule" />
                    <Label htmlFor="sched-toggle" className="text-sm">{scheduleEnabled ? "On" : "Off"}</Label>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Visual week strip */}
                <div className="grid grid-cols-7 gap-1 mb-3">
                  {DAY_NAMES.map((day, i) => {
                    const t = allThemes.find(th => th.id === schedule[i.toString()]) || THEME_PRESETS[0];
                    const isToday = i === todayIdx;
                    return (
                      <div key={i} className={`flex flex-col items-center gap-1 p-1.5 rounded-xl ${
                        isToday ? "bg-primary/10 ring-1 ring-primary/30" : ""
                      } ${!scheduleEnabled ? "opacity-40" : ""}`}>
                        <span className={`text-[10px] font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>{day}</span>
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg shadow-sm" style={{ background: t.preview }} />
                        <span className="text-[9px]">{t.emoji}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Day selects */}
                <div className={`space-y-2 ${!scheduleEnabled ? "opacity-40 pointer-events-none" : ""}`}>
                  {DAY_FULL.map((day, i) => {
                    const isToday = i === todayIdx;
                    const t = allThemes.find(th => th.id === schedule[i.toString()]) || THEME_PRESETS[0];
                    return (
                      <div key={i} className={`flex items-center gap-2 p-2 rounded-xl ${
                        isToday ? "bg-primary/5 ring-1 ring-primary/20" : "hover:bg-muted/30"
                      }`} data-testid={`schedule-day-${i}`}>
                        <div className="w-12 sm:w-16 flex items-center gap-1 flex-shrink-0">
                          {isToday && <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
                          <span className={`text-xs font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                            {day.slice(0,3)}
                          </span>
                        </div>
                        <Select value={schedule[i.toString()]}
                          onValueChange={v => setSchedule(prev => ({ ...prev, [i.toString()]: v }))}>
                          <SelectTrigger className="flex-1 h-8 text-xs" data-testid={`select-day-${i}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {allThemes.map(th => (
                              <SelectItem key={th.id} value={th.id}>{th.emoji} {th.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="w-5 h-5 rounded-full border-2 border-background shadow flex-shrink-0"
                             style={{ background: t.preview }} />
                      </div>
                    );
                  })}
                </div>

                {scheduleEnabled && (
                  <div className="mt-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400">
                    Schedule ON — today ({DAY_FULL[todayIdx]}) theme: <strong>{allThemes.find(t => t.id === schedule[todayIdx.toString()])?.name || "Original"}</strong>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ── Bottom save bar ── */}
        <div className="mt-6 pt-4 border-t space-y-3">
          {/* Live server status */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border">
            <Server className="w-4 h-4 text-green-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">Currently live on server for all users</p>
              <p className="text-xs text-muted-foreground">{serverTheme.emoji} {serverTheme.name} — {serverTheme.id === "original" ? "users can set their own theme" : "overriding all user themes"}</p>
            </div>
            <div className="w-8 h-8 rounded-lg flex-shrink-0" style={{ background: serverTheme.preview }} />
          </div>

          {isOutOfSync && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Your selection (<strong>{previewTheme.emoji} {previewTheme.name}</strong>) is only a preview — it hasn't been saved to the server yet. Other users still see <strong>{serverTheme.emoji} {serverTheme.name}</strong>.</span>
            </div>
          )}

          <Button onClick={handleSave} disabled={saveMutation.isPending}
            className={`w-full sm:w-auto ${isOutOfSync ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-500" : ""}`}
            data-testid="button-apply-bottom">
            {saveMutation.isPending
              ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Saving to server...</>
              : isOutOfSync
                ? <><AlertTriangle className="w-4 h-4 mr-2" /> Save {previewTheme.emoji} {previewTheme.name} to Server</>
                : <><Zap className="w-4 h-4 mr-2" /> Apply to All Users</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
