import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  GripVertical, Eye, EyeOff, Save, Sparkles, Send, Bot, User,
  ChevronDown, ChevronRight, Zap, MapPin, BarChart2, Info, Mail,
  Shield, X, ExternalLink, RotateCcw, Layers, Palette, Layout,
  CheckCircle, AlertCircle, RefreshCw, Plus, Minus, Settings2,
  Wand2, MessageSquare, Globe, Star, Loader2
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface SectionConfig {
  id: string;
  label: string;
  icon: string;
  visible: boolean;
  order: number;
  locked?: boolean;
}

interface HomepageContent {
  hero?: {
    badge?: string;
    tagline?: string;
    ctaPrimary?: string;
    ctaSecondary?: string;
  };
  stats?: Array<{ value: string; label: string }>;
  announcement?: {
    visible: boolean;
    text: string;
    type: "info" | "warning" | "success" | "promo";
    bgColor?: string;
  };
  founder?: {
    name?: string;
    role?: string;
    quote?: string;
    email?: string;
  };
  contact?: {
    title?: string;
    desc?: string;
    email?: string;
  };
}

interface HomepageConfig {
  sections: SectionConfig[];
  template: string;
  content: HomepageContent;
  updatedAt?: string;
}

interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Section icon map ────────────────────────────────────────────────────────
const SECTION_ICONS: Record<string, any> = {
  hero: Zap,
  about: Info,
  mapSpots: MapPin,
  stats: BarChart2,
  founder: User,
  contact: Mail,
  trust: Shield,
};

// ── Default config ──────────────────────────────────────────────────────────
const DEFAULT_CONFIG: HomepageConfig = {
  sections: [
    { id: "hero",      label: "Hero Section",      icon: "Zap",      visible: true, order: 0, locked: true },
    { id: "about",     label: "About / Pillars",   icon: "Info",     visible: true, order: 1 },
    { id: "mapSpots",  label: "Map Spot Types",     icon: "MapPin",   visible: true, order: 2 },
    { id: "stats",     label: "Stats Strip",        icon: "BarChart2",visible: true, order: 3 },
    { id: "founder",   label: "Founder Story",      icon: "User",     visible: true, order: 4 },
    { id: "contact",   label: "Contact CTA",        icon: "Mail",     visible: true, order: 5 },
    { id: "trust",     label: "Trust & Legal",      icon: "Shield",   visible: true, order: 6 },
  ],
  template: "standard",
  content: {
    hero: {
      badge: "🇳🇱 Netherlands Platform",
      tagline: "The digital home for Dutch urban culture.",
      ctaPrimary: "Explore the Map",
      ctaSecondary: "Join Community",
    },
    stats: [
      { value: "6,000+", label: "Spots on the Map" },
      { value: "🇳🇱",    label: "Made in Netherlands" },
      { value: "Gratis", label: "Free to Browse" },
      { value: "Live",   label: "Real-time Updates" },
    ],
    announcement: {
      visible: false,
      text: "",
      type: "info",
    },
    founder: {
      name: "Riki Almouti",
      role: "Founder & B-Boy",
      quote: "",
      email: "riki@coffeeanddance.nl",
    },
    contact: {
      title: "Let's Build Together",
      desc: "Reach out for collaborations, venue listings, or community partnerships.",
      email: "riki@coffeeanddance.nl",
    },
  },
};

// ── Template presets ────────────────────────────────────────────────────────
const TEMPLATES = [
  {
    id: "standard",
    name: "Standard",
    emoji: "🏠",
    desc: "Full layout — all sections visible, classic order",
    color: "from-blue-600 to-indigo-600",
    sections: ["hero","about","mapSpots","stats","founder","contact","trust"],
  },
  {
    id: "minimal",
    name: "Minimal",
    emoji: "✨",
    desc: "Clean & focused — Hero, Stats, Contact only",
    color: "from-slate-600 to-slate-800",
    sections: ["hero","stats","contact"],
  },
  {
    id: "bold",
    name: "Bold Launch",
    emoji: "🚀",
    desc: "Maximum impact — announcement banner + all sections",
    color: "from-orange-500 to-rose-600",
    sections: ["hero","about","mapSpots","stats","founder","contact","trust"],
    announcement: true,
  },
  {
    id: "showcase",
    name: "Showcase",
    emoji: "🎯",
    desc: "For new visitors — Hero, About, Map, Contact",
    color: "from-emerald-600 to-teal-600",
    sections: ["hero","about","mapSpots","contact"],
  },
];

// ── Announcement type colors ────────────────────────────────────────────────
const ANNOUNCE_TYPES = [
  { id: "info",    label: "Info",    color: "bg-blue-500",   icon: "💬" },
  { id: "success", label: "Success", color: "bg-emerald-500",icon: "✅" },
  { id: "warning", label: "Warning", color: "bg-amber-500",  icon: "⚠️" },
  { id: "promo",   label: "Promo",   color: "bg-violet-600", icon: "🎉" },
];

// ── Main component ─────────────────────────────────────────────────────────
export default function HomepageBuilder() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // State
  const [config, setConfig]             = useState<HomepageConfig>(DEFAULT_CONFIG);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [aiOpen, setAiOpen]             = useState(false);
  const [aiMessages, setAiMessages]     = useState<AiMessage[]>([
    { role: "assistant", content: "👋 Hi! I'm your AI homepage assistant powered by Claude. Tell me what you want to improve — I can suggest layouts, write copy, optimize sections, or help you pick the right template for your audience." }
  ]);
  const [aiInput, setAiInput]           = useState("");
  const [aiLoading, setAiLoading]       = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [saved, setSaved]               = useState(false);

  // Drag state
  const dragIdx    = useRef<number | null>(null);
  const dragOverIdx = useRef<number | null>(null);

  // Fetch config
  const { data: serverConfig, isLoading } = useQuery<HomepageConfig>({
    queryKey: ["/api/homepage-config"],
  });

  useEffect(() => {
    if (serverConfig) setConfig(serverConfig);
  }, [serverConfig]);

  // Save mutation
  const saveMut = useMutation({
    mutationFn: () => apiRequest("/api/admin/homepage-config", "PUT", config),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/homepage-config"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      toast({ title: "✅ Homepage saved!", description: "Changes are live on the homepage." });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  // ── Drag and drop ────────────────────────────────────────────────────────
  const sorted = [...config.sections].sort((a, b) => a.order - b.order);

  const handleDragStart = (idx: number) => { dragIdx.current = idx; };
  const handleDragOver  = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    dragOverIdx.current = idx;
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragIdx.current;
    const to   = dragOverIdx.current;
    if (from === null || to === null || from === to) return;
    const reordered = [...sorted];
    const [moved]   = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    const updated = reordered.map((s, i) => ({ ...s, order: i }));
    setConfig(c => ({
      ...c,
      sections: c.sections.map(s => {
        const u = updated.find(u => u.id === s.id);
        return u ? { ...s, order: u.order } : s;
      }),
    }));
    dragIdx.current    = null;
    dragOverIdx.current = null;
  };

  // ── Toggle visibility ────────────────────────────────────────────────────
  const toggleVisibility = (id: string) => {
    setConfig(c => ({
      ...c,
      sections: c.sections.map(s =>
        s.id === id && !s.locked ? { ...s, visible: !s.visible } : s
      ),
    }));
  };

  // ── Apply template ───────────────────────────────────────────────────────
  const applyTemplate = (tpl: typeof TEMPLATES[0]) => {
    const updatedSections = DEFAULT_CONFIG.sections.map(s => ({
      ...s,
      visible: tpl.sections.includes(s.id),
      order: tpl.sections.indexOf(s.id) >= 0 ? tpl.sections.indexOf(s.id) : s.order,
    })).sort((a, b) => a.order - b.order).map((s, i) => ({ ...s, order: i }));

    setConfig(c => ({
      ...c,
      template: tpl.id,
      sections: updatedSections,
      content: {
        ...c.content,
        announcement: tpl.announcement
          ? { ...c.content.announcement!, visible: true, text: c.content.announcement?.text || "🎉 Welcome to Urban Culture Hub — the home of Dutch urban culture!" }
          : { ...c.content.announcement!, visible: false },
      },
    }));
    setTemplateOpen(false);
    toast({ title: `Template "${tpl.name}" applied`, description: "Review and save to publish." });
  };

  // ── Content editing helpers ──────────────────────────────────────────────
  const setHero = (key: string, val: string) => setConfig(c => ({
    ...c, content: { ...c.content, hero: { ...c.content.hero, [key]: val } },
  }));
  const setStat = (idx: number, key: string, val: string) => setConfig(c => ({
    ...c, content: {
      ...c.content,
      stats: c.content.stats?.map((s, i) => i === idx ? { ...s, [key]: val } : s),
    },
  }));
  const setAnnouncement = (key: string, val: any) => setConfig(c => ({
    ...c, content: { ...c.content, announcement: { ...c.content.announcement!, [key]: val } },
  }));
  const setFounder = (key: string, val: string) => setConfig(c => ({
    ...c, content: { ...c.content, founder: { ...c.content.founder, [key]: val } },
  }));
  const setContact = (key: string, val: string) => setConfig(c => ({
    ...c, content: { ...c.content, contact: { ...c.content.contact, [key]: val } },
  }));

  // ── AI Chat ──────────────────────────────────────────────────────────────
  const sendAiMessage = async () => {
    if (!aiInput.trim() || aiLoading) return;
    const userMsg = aiInput.trim();
    setAiInput("");
    setAiMessages(m => [...m, { role: "user", content: userMsg }]);
    setAiLoading(true);
    try {
      const res = await apiRequest("/api/admin/homepage-builder/ai", "POST", {
        message: userMsg,
        context: {
          currentTemplate: config.template,
          visibleSections: sorted.filter(s => s.visible).map(s => s.label),
          sectionOrder: sorted.map(s => s.label),
          heroTagline: config.content.hero?.tagline,
          activeSection,
        },
      });
      const data = await res.json();
      setAiMessages(m => [...m, { role: "assistant", content: data.reply }]);
    } catch {
      setAiMessages(m => [...m, { role: "assistant", content: "Sorry, I couldn't connect. Please try again." }]);
    } finally {
      setAiLoading(false);
    }
  };

  // ── Reset to defaults ────────────────────────────────────────────────────
  const resetToDefaults = () => {
    setConfig(DEFAULT_CONFIG);
    toast({ title: "Reset to defaults", description: "Save to apply changes." });
  };

  // ── Active section editor ────────────────────────────────────────────────
  const activeSectionObj = activeSection ? sorted.find(s => s.id === activeSection) : null;

  // ── Render ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">

      {/* ── Top bar ── */}
      <div className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-blue-700 flex items-center justify-center">
              <Layout className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="font-black text-base leading-tight">Homepage Builder</h1>
              <p className="text-[10px] text-muted-foreground font-medium leading-none mt-0.5">Drag · Toggle · Edit · AI</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => window.open("/", "_blank")}
              data-testid="button-preview-homepage"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Preview
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={resetToDefaults}
              data-testid="button-reset-defaults"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </Button>
            <Button
              size="sm"
              className={cn("gap-1.5 text-xs font-bold transition-all", saved && "bg-emerald-600 hover:bg-emerald-700")}
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
              data-testid="button-save-homepage"
            >
              {saveMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <CheckCircle className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              {saved ? "Saved!" : "Save & Publish"}
            </Button>
            <Button
              size="sm"
              variant={aiOpen ? "default" : "outline"}
              className="gap-1.5 text-xs"
              onClick={() => setAiOpen(!aiOpen)}
              data-testid="button-ai-assistant"
            >
              <Sparkles className="w-3.5 h-3.5" /> AI
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className={cn("grid gap-6 transition-all", aiOpen ? "grid-cols-1 lg:grid-cols-[1fr_340px]" : "grid-cols-1")}>

          {/* ── Left: Main builder ── */}
          <div className="space-y-6">

            {/* Announcement Banner editor */}
            <div className="rounded-2xl border border-border/60 bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-violet-500" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">Announcement Banner</p>
                    <p className="text-[10px] text-muted-foreground">Shown at the very top of the homepage</p>
                  </div>
                </div>
                <Switch
                  checked={config.content.announcement?.visible ?? false}
                  onCheckedChange={v => setAnnouncement("visible", v)}
                  data-testid="switch-announcement"
                />
              </div>

              <AnimatePresence>
                {config.content.announcement?.visible && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 pt-1">
                      <Textarea
                        value={config.content.announcement?.text || ""}
                        onChange={e => setAnnouncement("text", e.target.value)}
                        placeholder="Announcement text… e.g. 🎉 New event added: Back to the Street 2026!"
                        className="text-sm resize-none"
                        rows={2}
                        data-testid="textarea-announcement"
                      />
                      <div className="flex gap-2">
                        {ANNOUNCE_TYPES.map(t => (
                          <button
                            key={t.id}
                            onClick={() => setAnnouncement("type", t.id)}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all",
                              config.content.announcement?.type === t.id
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border/60 hover:border-primary/40"
                            )}
                            data-testid={`button-announce-${t.id}`}
                          >
                            <span>{t.emoji}</span> {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Template picker */}
            <div className="rounded-2xl border border-border/60 bg-card p-5">
              <button
                className="w-full flex items-center justify-between"
                onClick={() => setTemplateOpen(!templateOpen)}
                data-testid="button-templates-toggle"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                    <Layers className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm">Layout Templates</p>
                    <p className="text-[10px] text-muted-foreground">Quick presets for different goals</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-semibold capitalize">{config.template}</Badge>
                  {templateOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              <AnimatePresence>
                {templateOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                      {TEMPLATES.map(tpl => (
                        <button
                          key={tpl.id}
                          onClick={() => applyTemplate(tpl)}
                          className={cn(
                            "group relative rounded-xl border p-4 text-left transition-all hover:scale-[1.02] hover:shadow-lg",
                            config.template === tpl.id
                              ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                              : "border-border/60 hover:border-primary/40"
                          )}
                          data-testid={`button-template-${tpl.id}`}
                        >
                          <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-xl mb-3", tpl.color)}>
                            {tpl.emoji}
                          </div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-bold text-sm">{tpl.name}</p>
                            {config.template === tpl.id && (
                              <Badge className="text-[9px] py-0 px-1.5">Active</Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">{tpl.desc}</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {tpl.sections.slice(0, 4).map(s => (
                              <span key={s} className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium capitalize">{s}</span>
                            ))}
                            {tpl.sections.length > 4 && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">+{tpl.sections.length - 4}</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Section order & visibility */}
            <div className="rounded-2xl border border-border/60 bg-card p-5">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center">
                  <GripVertical className="w-4 h-4 text-indigo-500" />
                </div>
                <div>
                  <p className="font-bold text-sm">Section Order & Visibility</p>
                  <p className="text-[10px] text-muted-foreground">Drag to reorder · Toggle to show/hide · Click to edit content</p>
                </div>
              </div>

              <div className="space-y-2">
                {sorted.map((section, idx) => {
                  const Icon = SECTION_ICONS[section.id] || Settings2;
                  const isActive = activeSection === section.id;
                  return (
                    <div
                      key={section.id}
                      draggable={!section.locked}
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={e => handleDragOver(e, idx)}
                      onDrop={handleDrop}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl border px-4 py-3.5 transition-all select-none",
                        isActive ? "border-primary bg-primary/5 shadow-sm" : "border-border/50 bg-card hover:border-primary/30 hover:bg-muted/30",
                        !section.visible && "opacity-50",
                        !section.locked && "cursor-grab active:cursor-grabbing"
                      )}
                      data-testid={`section-row-${section.id}`}
                    >
                      {/* Drag handle */}
                      <div className={cn("text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors", section.locked && "opacity-0")}>
                        <GripVertical className="w-4 h-4" />
                      </div>

                      {/* Order badge */}
                      <div className="w-6 h-6 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-black text-muted-foreground">{idx + 1}</span>
                      </div>

                      {/* Icon */}
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                        isActive ? "bg-primary/15" : "bg-muted/50 group-hover:bg-primary/10"
                      )}>
                        <Icon className={cn("w-4 h-4", isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary/70")} />
                      </div>

                      {/* Label */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn("font-semibold text-sm", !section.visible && "line-through")}>{section.label}</span>
                          {section.locked && <Badge variant="outline" className="text-[9px] py-0">Locked</Badge>}
                        </div>
                      </div>

                      {/* Edit + Toggle */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setActiveSection(isActive ? null : section.id)}
                          className={cn(
                            "flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all",
                            isActive
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border/50 hover:border-primary/40 hover:text-primary text-muted-foreground"
                          )}
                          data-testid={`button-edit-${section.id}`}
                        >
                          <Settings2 className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          onClick={() => toggleVisibility(section.id)}
                          disabled={!!section.locked}
                          className={cn("p-1.5 rounded-lg transition-all", section.locked ? "opacity-30 cursor-not-allowed" : "hover:bg-muted")}
                          data-testid={`button-toggle-${section.id}`}
                        >
                          {section.visible
                            ? <Eye className="w-4 h-4 text-emerald-500" />
                            : <EyeOff className="w-4 h-4 text-muted-foreground" />
                          }
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Content editor panel */}
            <AnimatePresence>
              {activeSectionObj && (
                <motion.div
                  key={activeSectionObj.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  className="rounded-2xl border border-primary/30 bg-primary/3 p-5 shadow-md shadow-primary/5"
                >
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                        <Wand2 className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">{activeSectionObj.label} — Content Editor</p>
                        <p className="text-[10px] text-muted-foreground">Edit text, CTAs, and values for this section</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveSection(null)}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                    >
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>

                  {/* Hero editor */}
                  {activeSectionObj.id === "hero" && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Country Badge Text</label>
                        <Input value={config.content.hero?.badge || ""} onChange={e => setHero("badge", e.target.value)} className="text-sm" placeholder="🇳🇱 Netherlands Platform" data-testid="input-hero-badge" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Hero Tagline</label>
                        <Textarea value={config.content.hero?.tagline || ""} onChange={e => setHero("tagline", e.target.value)} className="text-sm resize-none" rows={2} placeholder="The digital home for Dutch urban culture." data-testid="textarea-hero-tagline" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Primary CTA Button</label>
                          <Input value={config.content.hero?.ctaPrimary || ""} onChange={e => setHero("ctaPrimary", e.target.value)} className="text-sm" placeholder="Explore the Map" data-testid="input-hero-cta-primary" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Secondary CTA Button</label>
                          <Input value={config.content.hero?.ctaSecondary || ""} onChange={e => setHero("ctaSecondary", e.target.value)} className="text-sm" placeholder="Join Community" data-testid="input-hero-cta-secondary" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Stats editor */}
                  {activeSectionObj.id === "stats" && (
                    <div className="space-y-3">
                      <p className="text-[11px] text-muted-foreground">These 4 numbers appear in the stats strip between sections.</p>
                      {(config.content.stats || []).map((stat, i) => (
                        <div key={i} className="grid grid-cols-[120px_1fr] gap-3 items-center">
                          <div>
                            <label className="text-[10px] font-semibold text-muted-foreground mb-1 block">Value</label>
                            <Input value={stat.value} onChange={e => setStat(i, "value", e.target.value)} className="text-sm text-center font-black" data-testid={`input-stat-value-${i}`} />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-muted-foreground mb-1 block">Label</label>
                            <Input value={stat.label} onChange={e => setStat(i, "label", e.target.value)} className="text-sm" data-testid={`input-stat-label-${i}`} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Founder editor */}
                  {activeSectionObj.id === "founder" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Founder Name</label>
                          <Input value={config.content.founder?.name || ""} onChange={e => setFounder("name", e.target.value)} className="text-sm" data-testid="input-founder-name" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Role / Title</label>
                          <Input value={config.content.founder?.role || ""} onChange={e => setFounder("role", e.target.value)} className="text-sm" data-testid="input-founder-role" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Contact Email</label>
                        <Input type="email" value={config.content.founder?.email || ""} onChange={e => setFounder("email", e.target.value)} className="text-sm" data-testid="input-founder-email" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Featured Quote</label>
                        <Textarea value={config.content.founder?.quote || ""} onChange={e => setFounder("quote", e.target.value)} className="text-sm resize-none" rows={3} placeholder="An inspiring quote from the founder…" data-testid="textarea-founder-quote" />
                      </div>
                    </div>
                  )}

                  {/* Contact editor */}
                  {activeSectionObj.id === "contact" && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Section Title</label>
                        <Input value={config.content.contact?.title || ""} onChange={e => setContact("title", e.target.value)} className="text-sm" placeholder="Let's Build Together" data-testid="input-contact-title" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Description</label>
                        <Textarea value={config.content.contact?.desc || ""} onChange={e => setContact("desc", e.target.value)} className="text-sm resize-none" rows={2} data-testid="textarea-contact-desc" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Contact Email</label>
                        <Input type="email" value={config.content.contact?.email || ""} onChange={e => setContact("email", e.target.value)} className="text-sm" data-testid="input-contact-email" />
                      </div>
                    </div>
                  )}

                  {/* Read-only sections */}
                  {["about","mapSpots","trust"].includes(activeSectionObj.id) && (
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/40 border border-border/40">
                      <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold mb-1">Content managed via translations</p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          This section's text is controlled by the language system. You can control its visibility and position using the drag and toggle controls above. Use the AI assistant to get suggestions for improving this section.
                        </p>
                        <button
                          className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:underline"
                          onClick={() => setAiOpen(true)}
                        >
                          <Sparkles className="w-3 h-3" /> Ask AI for suggestions
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Save hint */}
                  <div className="flex items-center justify-between mt-5 pt-4 border-t border-border/40">
                    <p className="text-[11px] text-muted-foreground">Changes are saved when you click "Save & Publish"</p>
                    <Button size="sm" className="gap-1.5 text-xs" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                      <Save className="w-3.5 h-3.5" /> Save
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Live layout preview */}
            <div className="rounded-2xl border border-border/60 bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-sky-500/15 flex items-center justify-center">
                  <Globe className="w-4 h-4 text-sky-500" />
                </div>
                <div>
                  <p className="font-bold text-sm">Live Layout Preview</p>
                  <p className="text-[10px] text-muted-foreground">Real order of homepage sections</p>
                </div>
              </div>

              <div className="relative rounded-xl border border-border/40 overflow-hidden">
                {/* Fake browser chrome */}
                <div className="flex items-center gap-1.5 px-3 py-2.5 bg-muted/60 border-b border-border/30">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/60" />
                  <div className="flex-1 mx-3 h-5 rounded-md bg-background/60 border border-border/30 flex items-center px-2">
                    <span className="text-[9px] text-muted-foreground">urbanculturehub.nl</span>
                  </div>
                </div>
                <div className="bg-[#060812] p-4 space-y-2 max-h-[280px] overflow-hidden relative">
                  {sorted.map((s, i) => {
                    const Icon = SECTION_ICONS[s.id] || Settings2;
                    return (
                      <motion.div
                        key={s.id}
                        layout
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg border text-white/80 text-xs font-medium transition-opacity",
                          s.visible ? "border-white/10 bg-white/5" : "border-white/5 bg-white/[0.02] opacity-30"
                        )}
                      >
                        <div className="w-5 h-5 rounded-md bg-white/10 flex items-center justify-center shrink-0">
                          <Icon className="w-3 h-3 text-white/60" />
                        </div>
                        <span className={cn(!s.visible && "line-through text-white/30")}>{s.label}</span>
                        {!s.visible && <span className="ml-auto text-[9px] text-white/25">hidden</span>}
                      </motion.div>
                    );
                  })}
                  <div className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-[#060812] to-transparent" />
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground">
                  {sorted.filter(s => s.visible).length} of {sorted.length} sections visible
                </p>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={() => window.open("/", "_blank")}>
                  <ExternalLink className="w-3 h-3" /> Open Live
                </Button>
              </div>
            </div>

          </div>

          {/* ── Right: AI Assistant ── */}
          <AnimatePresence>
            {aiOpen && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex flex-col h-[calc(100vh-7rem)] sticky top-20 rounded-2xl border border-border/60 bg-card overflow-hidden shadow-xl"
              >
                {/* AI header */}
                <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/50 bg-gradient-to-r from-violet-500/10 to-primary/5 shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-primary flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-sm">AI Homepage Assistant</p>
                      <p className="text-[10px] text-muted-foreground">Powered by Claude</p>
                    </div>
                  </div>
                  <button onClick={() => setAiOpen(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                {/* Quick prompts */}
                <div className="px-3 py-2.5 border-b border-border/30 shrink-0">
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "Improve my hero tagline",
                      "Best template for events?",
                      "Write announcement text",
                      "Optimize section order",
                    ].map(p => (
                      <button
                        key={p}
                        onClick={() => { setAiInput(p); }}
                        className="px-2.5 py-1 rounded-xl bg-muted/60 border border-border/40 text-[10px] font-medium hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-all"
                        data-testid={`button-quick-prompt`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                  {aiMessages.map((msg, i) => (
                    <div key={i} className={cn("flex gap-2.5", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
                      <div className={cn(
                        "w-7 h-7 rounded-xl shrink-0 flex items-center justify-center",
                        msg.role === "user" ? "bg-primary/15" : "bg-gradient-to-br from-violet-500 to-primary"
                      )}>
                        {msg.role === "user"
                          ? <User className="w-3.5 h-3.5 text-primary" />
                          : <Sparkles className="w-3.5 h-3.5 text-white" />
                        }
                      </div>
                      <div className={cn(
                        "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed",
                        msg.role === "user"
                          ? "bg-primary/15 text-primary rounded-tr-sm"
                          : "bg-muted/60 border border-border/40 rounded-tl-sm"
                      )}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {aiLoading && (
                    <div className="flex gap-2.5">
                      <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-violet-500 to-primary flex items-center justify-center shrink-0">
                        <Sparkles className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="bg-muted/60 border border-border/40 rounded-2xl rounded-tl-sm px-3.5 py-2.5 flex items-center gap-1.5">
                        <div className="flex gap-1">
                          {[0,1,2].map(i => (
                            <div key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="px-3 py-3 border-t border-border/40 bg-card/80 shrink-0">
                  <div className="flex gap-2">
                    <Input
                      value={aiInput}
                      onChange={e => setAiInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendAiMessage()}
                      placeholder="Ask AI for layout advice…"
                      className="text-xs flex-1"
                      disabled={aiLoading}
                      data-testid="input-ai-message"
                    />
                    <Button
                      size="sm"
                      onClick={sendAiMessage}
                      disabled={aiLoading || !aiInput.trim()}
                      className="px-3"
                      data-testid="button-ai-send"
                    >
                      {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-1.5 text-center">AI has context of your current layout & active section</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </div>
  );
}
