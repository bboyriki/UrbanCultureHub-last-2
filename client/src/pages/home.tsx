import type { CSSProperties } from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  MapPin, Calendar, Users, Sparkles, ChevronDown, ChevronUp,
  Mail, Shield, FileText, ArrowRight, Quote,
  Zap, Globe, Heart, Music, Star, Play, X, Info, AlertTriangle, CheckCircle,
  Landmark, Utensils, Moon, Palette, Dumbbell, Coffee, Building2, Pin,
  GripVertical, Eye, EyeOff, Save, Layers, RotateCcw, Pencil,
  Wand2, Send, Bot, User as UserIcon, ChevronRight, Layout, BarChart2,
  Loader2, Settings2, ExternalLink
} from "lucide-react";

// ── Homepage config types ──────────────────────────────────────────────────
interface HomepageSection { id: string; visible: boolean; order: number; }
interface HomepageContent {
  hero?: { badge?: string; tagline?: string; ctaPrimary?: string; ctaSecondary?: string; };
  stats?: Array<{ value: string; label: string }>;
  announcement?: { visible: boolean; text: string; type: string; };
  founder?: { name?: string; role?: string; quote?: string; email?: string; };
  contact?: { title?: string; desc?: string; email?: string; };
  about?: { title?: string; subtitle?: string; description?: string; };
  mapSpots?: { title?: string; subtitle?: string; };
  trust?: { title?: string; };
}
interface HomepageConfig {
  sections: HomepageSection[];
  content: HomepageContent;
}

// ── EditableText — click-to-edit inline when editMode is true ─────────────
function EditableText({
  value,
  onSave,
  editMode,
  as: Tag = "span",
  className = "",
  style,
  multiline = false,
  placeholder = "Click to edit…",
}: {
  value: string;
  onSave: (v: string) => void;
  editMode?: boolean;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  style?: CSSProperties;
  multiline?: boolean;
  placeholder?: string;
}) {
  const ref = useRef<any>(null);
  const isActive = useRef(false);

  useEffect(() => {
    if (ref.current && !isActive.current) {
      if (ref.current.innerText !== value) ref.current.innerText = value || "";
    }
  }, [value]);

  const save = useCallback(() => {
    isActive.current = false;
    const v = (ref.current?.innerText ?? "").trim();
    if (v !== value) onSave(v);
  }, [value, onSave]);

  if (!editMode) {
    return <Tag className={className} style={style}>{value || <span style={{ opacity: 0.35 }}>{placeholder}</span>}</Tag>;
  }

  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className={className}
      style={{
        ...style,
        cursor: "text",
        caretColor: "#a78bfa",
        outline: "none",
        minWidth: 20,
        borderRadius: 4,
        transition: "box-shadow 0.12s",
        boxShadow: "0 0 0 1.5px rgba(124,58,237,0.45)",
        padding: "1px 3px",
        margin: "-1px -3px",
      }}
      onFocus={() => { isActive.current = true; }}
      onBlur={save}
      onKeyDown={(e: any) => {
        if (!multiline && e.key === "Enter") { e.preventDefault(); ref.current?.blur(); }
        if (e.key === "Escape") { if (ref.current) ref.current.innerText = value; ref.current?.blur(); }
      }}
    >
      {value}
    </Tag>
  );
}

// ── Announcement banner ────────────────────────────────────────────────────
function AnnouncementBanner({ announcement }: { announcement: HomepageContent["announcement"] }) {
  if (!announcement?.visible || !announcement.text) return null;
  const colors: Record<string, { bg: string; icon: any }> = {
    info:    { bg: "bg-blue-600",    icon: Info },
    success: { bg: "bg-emerald-600", icon: CheckCircle },
    warning: { bg: "bg-amber-500",   icon: AlertTriangle },
    promo:   { bg: "bg-violet-600",  icon: Sparkles },
  };
  const style = colors[announcement.type] || colors.info;
  const Icon = style.icon;
  return (
    <div className={`${style.bg} text-white text-center py-2.5 px-4 text-sm font-semibold flex items-center justify-center gap-2 sticky top-0 z-50`}>
      <Icon className="w-4 h-4 shrink-0" />
      <span>{announcement.text}</span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   HERO — letter explosion + rich word cloud
   ────────────────────────────────────────────────────────────── */

/* Each letter of URBAN / CULTURE / HUB with its scatter origin */
type LS = { x: string; y: string; r: string; d: number };

const URBAN_SCATTER: LS[] = [
  { x: "-700px", y: "-300px", r: "-35deg", d: 0.00 },
  { x: "550px",  y: "-500px", r: "22deg",  d: 0.06 },
  { x: "-400px", y: "550px",  r: "-48deg", d: 0.12 },
  { x: "750px",  y: "200px",  r: "38deg",  d: 0.08 },
  { x: "-120px", y: "-700px", r: "-18deg", d: 0.16 },
];

const CULTURE_SCATTER: LS[] = [
  { x: "750px",  y: "-350px", r: "32deg",  d: 0.10 },
  { x: "-600px", y: "550px",  r: "-42deg", d: 0.18 },
  { x: "300px",  y: "-650px", r: "15deg",  d: 0.24 },
  { x: "-800px", y: "250px",  r: "-24deg", d: 0.20 },
  { x: "650px",  y: "480px",  r: "50deg",  d: 0.28 },
  { x: "-450px", y: "-480px", r: "-35deg", d: 0.22 },
  { x: "900px",  y: "130px",  r: "26deg",  d: 0.26 },
];
const CULTURE_COLORS = ["#3b82f6","#4c76f4","#5c6bf2","#6d73f3","#7e88f7","#919efa","#a5b4fc"];

const HUB_SCATTER: LS[] = [
  { x: "-700px", y: "380px",  r: "-32deg", d: 0.20 },
  { x: "550px",  y: "-320px", r: "18deg",  d: 0.30 },
  { x: "-220px", y: "700px",  r: "-50deg", d: 0.38 },
];

function SplitWord({
  letters,
  scatter,
  colors,
  className,
}: {
  letters: string[];
  scatter: LS[];
  colors?: string[];
  className?: string;
}) {
  return (
    <span className={`block leading-[0.92] ${className ?? ""}`} style={{ display: "block" }}>
      {letters.map((ch, i) => {
        const s = scatter[i];
        const col = colors?.[i];
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              fontSize: "1em",
              letterSpacing: 0,
              "--lx": s.x,
              "--ly": s.y,
              "--lr": s.r,
              animation: `letter-assemble 1.1s cubic-bezier(0.22,1,0.36,1) ${s.d}s both`,
              color: col ?? undefined,
            } as CSSProperties}
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
}

/* ── Word cloud data ── */
type WW = {
  w: string; top?: string; bottom?: string; left?: string; right?: string;
  size: number; op: number; anim: string; dur: string; delay: string; rot: string;
};

const FLOAT_WORDS: WW[] = [
  /* upper zone */
  { w:"Breakdance",  top:"8%",   left:"4%",   size:22, op:.38, anim:"word-float-a", dur:"9s",  delay:"0s",    rot:"-12deg" },
  { w:"Graffiti",    top:"7%",   right:"7%",  size:18, op:.30, anim:"word-float-b", dur:"11s", delay:"-3s",   rot:"9deg"   },
  { w:"Nightclub",   top:"14%",  left:"2%",   size:16, op:.26, anim:"word-float-c", dur:"13s", delay:"-5s",   rot:"-7deg"  },
  { w:"DJing",       top:"12%",  right:"5%",  size:20, op:.34, anim:"word-float-d", dur:"8s",  delay:"-2s",   rot:"14deg"  },
  { w:"B-Boy",       top:"21%",  left:"4%",   size:18, op:.30, anim:"word-float-e", dur:"10s", delay:"-1s",   rot:"-5deg"  },
  { w:"Hip-Hop",     top:"20%",  right:"3%",  size:20, op:.34, anim:"word-float-a", dur:"12s", delay:"-4s",   rot:"11deg"  },
  { w:"Museum",      top:"9%",   left:"40%",  size:14, op:.20, anim:"word-float-b", dur:"14s", delay:"-6s",   rot:"4deg"   },
  { w:"Vinyl",       top:"16%",  right:"37%", size:13, op:.17, anim:"word-float-c", dur:"16s", delay:"-8s",   rot:"-3deg"  },
  /* mid-left */
  { w:"Bouldering",  top:"32%",  left:"1%",   size:16, op:.26, anim:"word-float-d", dur:"11s", delay:"-7s",   rot:"-9deg"  },
  { w:"Freestyle",   top:"42%",  left:"2%",   size:18, op:.30, anim:"word-float-e", dur:"9s",  delay:"-3s",   rot:"-5deg"  },
  { w:"Waacking",    top:"52%",  left:"1%",   size:16, op:.26, anim:"word-float-a", dur:"13s", delay:"-2s",   rot:"6deg"   },
  { w:"Session",     top:"62%",  left:"3%",   size:14, op:.22, anim:"word-float-b", dur:"10s", delay:"-5s",   rot:"-8deg"  },
  /* mid-right */
  { w:"Parkour",     top:"30%",  right:"2%",  size:18, op:.30, anim:"word-float-c", dur:"12s", delay:"-1s",   rot:"16deg"  },
  { w:"Cypher",      top:"40%",  right:"1%",  size:16, op:.26, anim:"word-float-d", dur:"8s",  delay:"-6s",   rot:"-12deg" },
  { w:"Battle",      top:"50%",  right:"2%",  size:20, op:.34, anim:"word-float-e", dur:"11s", delay:"-4s",   rot:"8deg"   },
  { w:"Flow",        top:"60%",  right:"3%",  size:14, op:.22, anim:"word-float-a", dur:"7s",  delay:"-9s",   rot:"90deg"  },
  /* lower zone */
  { w:"Skate",       top:"70%",  left:"6%",   size:22, op:.38, anim:"word-float-b", dur:"10s", delay:"-2s",   rot:"-5deg"  },
  { w:"Street Art",  top:"68%",  right:"7%",  size:18, op:.30, anim:"word-float-c", dur:"9s",  delay:"-7s",   rot:"10deg"  },
  { w:"Popping",     top:"74%",  left:"20%",  size:16, op:.26, anim:"word-float-d", dur:"12s", delay:"-4s",   rot:"-8deg"  },
  { w:"Locking",     top:"72%",  right:"22%", size:18, op:.30, anim:"word-float-e", dur:"11s", delay:"-1s",   rot:"12deg"  },
  { w:"Rooftop",     top:"79%",  left:"8%",   size:16, op:.26, anim:"word-float-a", dur:"8s",  delay:"-6s",   rot:"-4deg"  },
  { w:"Murals",      top:"78%",  right:"9%",  size:20, op:.34, anim:"word-float-b", dur:"14s", delay:"-3s",   rot:"7deg"   },
  { w:"Krump",       top:"82%",  left:"22%",  size:18, op:.30, anim:"word-float-c", dur:"10s", delay:"-5s",   rot:"-14deg" },
  { w:"Throw-up",    top:"80%",  right:"24%", size:14, op:.22, anim:"word-float-d", dur:"13s", delay:"-2s",   rot:"9deg"   },
  /* bottom zone */
  { w:"Footwork",    bottom:"12%",left:"9%",  size:16, op:.26, anim:"word-float-e", dur:"11s", delay:"-8s",   rot:"3deg"   },
  { w:"Restaurant",  bottom:"10%",right:"11%",size:14, op:.22, anim:"word-float-a", dur:"12s", delay:"-4s",   rot:"-6deg"  },
  { w:"Underground", bottom:"16%",left:"35%", size:14, op:.20, anim:"word-float-b", dur:"15s", delay:"-3s",   rot:"5deg"   },
  { w:"Gallery",     bottom:"8%", left:"42%", size:13, op:.17, anim:"word-float-c", dur:"13s", delay:"-6s",   rot:"-2deg"  },
  { w:"Crew",        bottom:"18%",right:"32%",size:16, op:.22, anim:"word-float-d", dur:"9s",  delay:"-7s",   rot:"-10deg" },
  /* far edges */
  { w:"BMX",         top:"36%",  left:"0%",   size:14, op:.20, anim:"word-float-e", dur:"14s", delay:"-5s",   rot:"-20deg" },
  { w:"Voguing",     top:"46%",  right:"0%",  size:14, op:.20, anim:"word-float-a", dur:"12s", delay:"-3s",   rot:"22deg"  },
  { w:"Streetball",  bottom:"28%",left:"1%",  size:16, op:.22, anim:"word-float-b", dur:"10s", delay:"-9s",   rot:"-8deg"  },
  { w:"Warehouse",   bottom:"22%",right:"1%", size:14, op:.20, anim:"word-float-c", dur:"13s", delay:"-2s",   rot:"14deg"  },
  { w:"Beats",       top:"27%",  left:"16%",  size:16, op:.22, anim:"word-float-d", dur:"9s",  delay:"-4s",   rot:"8deg"   },
  { w:"B-Girl",      top:"26%",  right:"16%", size:18, op:.26, anim:"word-float-e", dur:"11s", delay:"-7s",   rot:"-9deg"  },
  { w:"Beatbox",     bottom:"24%",left:"18%", size:16, op:.22, anim:"word-float-a", dur:"12s", delay:"-1s",   rot:"-13deg" },
  { w:"Community",   bottom:"6%", right:"35%",size:13, op:.17, anim:"word-float-b", dur:"16s", delay:"-5s",   rot:"4deg"   },
];

function HeroSection({ content, editMode, onEdit }: { content?: HomepageContent["hero"]; editMode?: boolean; onEdit?: (field: string, val: string) => void }) {
  const { t } = useLanguage();
  const badge      = content?.badge      || t("home.badge");
  const tagline    = content?.tagline    || t("home.tagline");
  const ctaPrimary = content?.ctaPrimary || t("home.cta.map");
  const ctaSecondary = content?.ctaSecondary || t("home.cta.community");
  return (
    <section className="relative min-h-[100svh] flex flex-col items-center justify-center overflow-hidden bg-[#060812]">

      {/* ── Background layers ── */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-10%,_#1d3a7a55_0%,_transparent_65%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_110%,_#0d1a4080_0%,_transparent_70%)]" />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* ── Floating accent glows ── */}
      <div className="absolute top-[18%] left-[8%] w-48 h-48 rounded-full bg-blue-600/10 blur-3xl animate-pulse" style={{ animationDuration: "4s" }} />
      <div className="absolute bottom-[20%] right-[6%] w-64 h-64 rounded-full bg-primary/8 blur-3xl animate-pulse" style={{ animationDuration: "6s" }} />
      <div className="absolute top-[60%] left-[3%] w-32 h-32 rounded-full bg-violet-500/8 blur-2xl animate-pulse" style={{ animationDuration: "5s" }} />
      <div className="absolute top-[40%] right-[10%] w-40 h-40 rounded-full bg-indigo-500/6 blur-3xl animate-pulse" style={{ animationDuration: "7s" }} />

      {/* ── Rich floating word cloud ── */}
      {FLOAT_WORDS.map((fw) => (
        <span
          key={fw.w}
          className="absolute font-black tracking-widest uppercase select-none pointer-events-none"
          style={{
            top: fw.top, bottom: fw.bottom, left: fw.left, right: fw.right,
            fontSize: `${fw.size}px`,
            color: `rgba(255,255,255,${fw.op})`,
            animation: `${fw.anim} ${fw.dur} ease-in-out infinite, word-pulse 7s ease-in-out infinite`,
            animationDelay: `${fw.delay}, ${fw.delay}`,
            "--rot": fw.rot,
          } as CSSProperties}
        >
          {fw.w}
        </span>
      ))}

      {/* ── Content ── */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-5xl mx-auto">

        {/* Country badge — fades in after title assembles */}
        <div
          className="mb-8 flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm"
          style={{ animation: "fade-up-in 0.7s cubic-bezier(0.16,1,0.3,1) 0.85s both" }}
        >
          <span className="text-base leading-none">🇳🇱</span>
          <EditableText
            value={badge}
            onSave={v => onEdit?.("badge", v)}
            editMode={editMode}
            className="text-[11px] font-semibold tracking-widest text-white/50 uppercase"
          />
        </div>

        {/* Main heading — letters explode in */}
        <h1 className="font-black uppercase leading-none tracking-tight" aria-label="Urban Culture Hub">
          {/* URBAN */}
          <SplitWord
            letters={["U","R","B","A","N"]}
            scatter={URBAN_SCATTER}
            className="text-[clamp(3.5rem,12vw,8rem)] text-white/95"
          />
          {/* CULTURE — gradient per letter */}
          <SplitWord
            letters={["C","U","L","T","U","R","E"]}
            scatter={CULTURE_SCATTER}
            colors={CULTURE_COLORS}
            className="text-[clamp(3.5rem,12vw,8rem)]"
          />
          {/* HUB */}
          <SplitWord
            letters={["H","U","B"]}
            scatter={HUB_SCATTER}
            className="text-[clamp(3.5rem,12vw,8rem)] text-white/95"
          />
        </h1>

        {/* Tagline */}
        <EditableText
          value={tagline}
          onSave={v => onEdit?.("tagline", v)}
          editMode={editMode}
          as="p"
          className="mt-7 text-white/50 text-base sm:text-lg font-medium max-w-md tracking-wide text-center"
          style={{ animation: "fade-up-in 0.7s cubic-bezier(0.16,1,0.3,1) 1.0s both" }}
        />

        {/* Inline stats */}
        <div
          className="mt-8 flex items-center gap-4 sm:gap-6 text-white/30 text-xs font-medium"
          style={{ animation: "fade-up-in 0.7s cubic-bezier(0.16,1,0.3,1) 1.1s both" }}
        >
          <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-primary/60" />{t("home.stat.spots")}</span>
          <span className="w-px h-3 bg-white/10" />
          <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-primary/60" />{t("home.stat.events")}</span>
          <span className="w-px h-3 bg-white/10" />
          <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-primary/60" />{t("home.stat.community")}</span>
        </div>

        {/* CTAs */}
        <div
          className="mt-10 flex flex-col sm:flex-row items-center gap-3"
          style={{ animation: "fade-up-in 0.7s cubic-bezier(0.16,1,0.3,1) 1.2s both" }}
        >
          <Button
            asChild={!editMode}
            size="lg"
            className="relative gap-2.5 px-8 py-6 text-base font-bold shadow-[0_0_40px_#3b82f640] hover:shadow-[0_0_60px_#3b82f660] transition-all"
            data-testid="button-explore-map"
          >
            {editMode ? (
              <span className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 shrink-0" />
                <EditableText value={ctaPrimary} onSave={v => onEdit?.("ctaPrimary", v)} editMode={editMode} />
              </span>
            ) : (
              <Link href="/map">
                <MapPin className="w-4 h-4" />
                {ctaPrimary}
              </Link>
            )}
          </Button>
          <Button
            asChild={!editMode}
            variant="outline"
            size="lg"
            className="gap-2.5 px-8 py-6 text-base font-semibold border-white/[0.12] text-white/80 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/20 hover:text-white backdrop-blur-sm"
            data-testid="button-join-community"
          >
            {editMode ? (
              <span className="flex items-center gap-2.5">
                <Users className="w-4 h-4 shrink-0" />
                <EditableText value={ctaSecondary} onSave={v => onEdit?.("ctaSecondary", v)} editMode={editMode} />
              </span>
            ) : (
              <Link href="/auth">
                <Users className="w-4 h-4" />
                {ctaSecondary}
              </Link>
            )}
          </Button>
        </div>

        {/* iOS app link */}
        <a
          href="https://apps.apple.com/nl/app/urban-culture-hub/id6743952291"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 flex items-center gap-1.5 text-white/25 hover:text-white/50 transition-colors text-xs font-medium"
          style={{ animation: "fade-up-in 0.7s cubic-bezier(0.16,1,0.3,1) 1.3s both" }}
        >
          <Play className="w-3 h-3" />
          {t("home.appStore")}
        </a>
      </div>

      {/* ── Scroll hint ── */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-white/25"
        style={{ animation: "fade-up-in 0.7s cubic-bezier(0.16,1,0.3,1) 1.5s both" }}>
        <span className="text-[10px] tracking-widest uppercase font-medium">{t("home.scroll")}</span>
        <ChevronDown className="w-4 h-4 animate-bounce" />
      </div>

      {/* Bottom fade into background */}
      <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────
   ABOUT — 4 pillars
   ────────────────────────────────────────────────────────────── */
function AboutSection({ content, editMode, onEdit }: { content?: HomepageContent["about"]; editMode?: boolean; onEdit?: (field: string, val: string) => void }) {
  const { t } = useLanguage();
  const PILLARS = [
    { icon: MapPin,     labelKey: "home.about.p1.label", descKey: "home.about.p1.desc", color: "from-blue-500/20 to-blue-600/5",    ring: "border-blue-500/20"   },
    { icon: Calendar,  labelKey: "home.about.p2.label", descKey: "home.about.p2.desc", color: "from-violet-500/20 to-violet-600/5", ring: "border-violet-500/20" },
    { icon: Users,     labelKey: "home.about.p3.label", descKey: "home.about.p3.desc", color: "from-indigo-500/20 to-indigo-600/5", ring: "border-indigo-500/20" },
    { icon: Sparkles,  labelKey: "home.about.p4.label", descKey: "home.about.p4.desc", color: "from-sky-500/20 to-sky-600/5",       ring: "border-sky-500/20"    },
  ];
  return (
    <section className="py-24 sm:py-32">
      <div className="max-w-5xl mx-auto px-6 sm:px-8">

        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-5 px-3.5 py-1.5 text-[10px] font-semibold tracking-widest uppercase border-primary/25 text-primary">
            <EditableText value={content?.subtitle || t("home.about.badge")} onSave={v => onEdit?.("subtitle", v)} editMode={editMode} />
          </Badge>
          <EditableText
            value={content?.title || t("home.about.title")}
            onSave={v => onEdit?.("title", v)}
            editMode={editMode}
            as="h2"
            className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-5 block"
          />
          <EditableText
            value={content?.description || t("home.about.desc")}
            onSave={v => onEdit?.("description", v)}
            editMode={editMode}
            as="p"
            multiline
            className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto leading-relaxed block"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PILLARS.map(({ icon: Icon, labelKey, descKey, color, ring }) => (
            <div
              key={labelKey}
              className={`group relative rounded-2xl border ${ring} bg-gradient-to-b ${color} hover:scale-[1.02] hover:shadow-xl transition-all duration-300 p-6`}
            >
              <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center mb-5 group-hover:bg-primary/25 transition-colors">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-bold text-sm mb-2">{t(labelKey)}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{t(descKey)}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button asChild size="lg" className="gap-2 px-8">
            <Link href="/map">
              <MapPin className="w-4 h-4" /> {t("home.about.cta.map")}
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="gap-2 px-8">
            <Link href="/explore">
              {t("home.about.cta.explore")} <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────
   MAP SPOT TYPES — what's actually on the map
   ────────────────────────────────────────────────────────────── */
function MapSpotsSection({ content }: { content?: HomepageContent["mapSpots"] }) {
  const { t } = useLanguage();
  const MAP_SPOT_TYPES = [
    { icon: Landmark, k: "s1", color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20"     },
    { icon: Utensils, k: "s2", color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/20" },
    { icon: Moon,     k: "s3", color: "text-violet-400",  bg: "bg-violet-500/10 border-violet-500/20" },
    { icon: Building2,k: "s4", color: "text-indigo-400",  bg: "bg-indigo-500/10 border-indigo-500/20" },
    { icon: Pin,      k: "s5", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20"},
    { icon: Coffee,   k: "s6", color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20"   },
    { icon: Dumbbell, k: "s7", color: "text-sky-400",     bg: "bg-sky-500/10 border-sky-500/20"       },
    { icon: Palette,  k: "s8", color: "text-pink-400",    bg: "bg-pink-500/10 border-pink-500/20"     },
  ];
  return (
    <section className="py-20 sm:py-28 bg-[#060812]">
      <div className="max-w-6xl mx-auto px-6 sm:px-8">

        <div className="text-center mb-14">
          <Badge variant="outline" className="mb-5 px-3.5 py-1.5 text-[10px] font-semibold tracking-widest uppercase border-primary/30 text-primary bg-primary/5">
            {content?.subtitle || t("home.map.badge")}
          </Badge>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-5 text-white">
            {content?.title ? (
              content.title
            ) : (
              <>
                {t("home.map.title")}{" "}
                <span style={{ background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #a5b4fc 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  {t("home.map.titleGradient")}
                </span>
              </>
            )}
          </h2>
          <p className="text-white/50 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            {t("home.map.desc")}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {MAP_SPOT_TYPES.map(({ icon: Icon, k, color, bg }) => (
            <div
              key={k}
              className={`group relative rounded-2xl border ${bg} p-5 hover:scale-[1.03] transition-all duration-300 cursor-default`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${bg}`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <h3 className="font-bold text-sm text-white mb-2 leading-snug">{t(`home.map.${k}.label`)}</h3>
              <p className="text-xs text-white/45 leading-relaxed mb-3">{t(`home.map.${k}.desc`)}</p>
              <span className={`text-[10px] font-semibold tracking-wide ${color} opacity-70`}>
                {t(`home.map.${k}.ex`)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Button asChild size="lg" className="gap-2.5 px-10 shadow-[0_0_40px_#3b82f630] hover:shadow-[0_0_60px_#3b82f650] transition-all">
            <Link href="/map">
              <MapPin className="w-4 h-4" /> {t("home.map.cta")}
            </Link>
          </Button>
        </div>

      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────
   STATS STRIP
   ────────────────────────────────────────────────────────────── */
function StatsStrip({ statsConfig, editMode, onEditStat }: { statsConfig?: Array<{ value: string; label: string }>; editMode?: boolean; onEditStat?: (i: number, field: string, val: string) => void }) {
  const { t } = useLanguage();
  const stats = statsConfig && statsConfig.length > 0 ? statsConfig : [
    { value: "6,000+", label: t("home.stats.spots")  },
    { value: "🇳🇱",   label: t("home.stats.based")  },
    { value: t("events.free"), label: t("home.stats.free") },
    { value: "Live",  label: t("home.stats.live")   },
  ];
  return (
    <div className="border-y border-border/40 bg-muted/20">
      <div className="max-w-5xl mx-auto px-6 sm:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border/40">
          {stats.map(({ value, label }, i) => (
            <div key={i} className="flex flex-col items-center justify-center py-10 px-4 text-center gap-1.5">
              <EditableText value={value} onSave={v => onEditStat?.(i, "value", v)} editMode={editMode} className="text-2xl font-black block" />
              <EditableText value={label} onSave={v => onEditStat?.(i, "label", v)} editMode={editMode} className="text-xs text-muted-foreground font-medium block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   FOUNDER STORY
   ────────────────────────────────────────────────────────────── */
function FounderSection({ content, editMode, onEdit }: { content?: HomepageContent["founder"]; editMode?: boolean; onEdit?: (field: string, val: string) => void }) {
  const { t } = useLanguage();
  const founderName  = content?.name  || "Riki Almouti";
  const founderRole  = content?.role  || t("home.founder.role");
  const founderEmail = content?.email || "riki@coffeeanddance.nl";
  const founderQuote = content?.quote || null;
  return (
    <section className="py-24 sm:py-32">
      <div className="max-w-5xl mx-auto px-6 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* Identity card */}
          <div className="relative order-2 lg:order-1">
            <div className="absolute -inset-4 rounded-[2.5rem] bg-primary/5 blur-2xl" />
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-[#0d1a35] to-slate-900 border border-slate-700/40 p-8 shadow-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_#1d4ed840_0%,_transparent_60%)]" />
              <div className="relative">
                {/* Avatar */}
                <div className="relative w-20 h-20 mb-6">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-blue-700 flex items-center justify-center text-3xl font-black text-white shadow-xl ring-4 ring-primary/20">
                    R
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-500 border-2 border-slate-900 flex items-center justify-center">
                    <Star className="w-3 h-3 text-white fill-white" />
                  </div>
                </div>

                <EditableText value={founderName} onSave={v => onEdit?.("name", v)} editMode={editMode} as="h3" className="text-2xl font-black text-white mb-1 block" />
                <EditableText value={founderRole} onSave={v => onEdit?.("role", v)} editMode={editMode} as="p" className="text-primary/70 text-sm font-semibold mb-5 block" />

                <div className="flex flex-wrap gap-2 mb-6">
                  {["B-Boy", "Event Organiser", "Community Builder"].map(tag => (
                    <span key={tag} className="px-2.5 py-1 rounded-full bg-white/[0.08] text-white/70 text-xs font-medium border border-white/[0.08]">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="pt-5 border-t border-white/[0.08] space-y-2">
                  <div className="flex items-center gap-2 text-white/40 text-xs">
                    <Globe className="w-3.5 h-3.5" />
                    🇳🇱 Netherlands · Nederland
                  </div>
                  <div className="flex items-center gap-2 text-white/40 text-xs">
                    <Mail className="w-3.5 h-3.5" />
                    <EditableText value={founderEmail} onSave={v => onEdit?.("email", v)} editMode={editMode} className="text-white/40 text-xs" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Story */}
          <div className="order-1 lg:order-2">
            <Badge variant="outline" className="mb-5 px-3.5 py-1.5 text-[10px] font-semibold tracking-widest uppercase border-primary/25 text-primary">
              {t("home.founder.badge")}
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-7 leading-tight">
              {t("home.founder.title")}
            </h2>

            <div className="relative pl-5 border-l-2 border-primary/30 mb-6">
              <Quote className="absolute -left-3 -top-1 w-5 h-5 text-primary/40" />
              <EditableText
                value={founderQuote || t("home.founder.quote")}
                onSave={v => onEdit?.("quote", v)}
                editMode={editMode}
                as="p"
                multiline
                className="text-muted-foreground leading-relaxed text-sm sm:text-base italic block"
              />
            </div>

            <p className="text-muted-foreground leading-relaxed text-sm sm:text-base mb-5">
              {t("home.founder.mission")}
            </p>

            <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">
              {t("home.founder.movement")}
            </p>

            <Button asChild variant="outline" size="lg" className="mt-8 gap-2">
              <Link href="/contact">
                <Mail className="w-4 h-4" /> {t("home.founder.cta")}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────
   CONTACT CTA
   ────────────────────────────────────────────────────────────── */
function ContactSection({ content, editMode, onEdit }: { content?: HomepageContent["contact"]; editMode?: boolean; onEdit?: (field: string, val: string) => void }) {
  const { t } = useLanguage();
  const contactTitle = content?.title || t("home.contact.title");
  const contactDesc  = content?.desc  || t("home.contact.desc");
  const contactEmail = content?.email || "riki@coffeeanddance.nl";
  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-5xl mx-auto px-6 sm:px-8">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-primary via-blue-600 to-indigo-600 p-10 sm:p-14 text-white shadow-2xl shadow-primary/20">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_#ffffff18_0%,_transparent_60%)]" />
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
              backgroundSize: "40px 40px",
            }}
          />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">
            <div className="max-w-lg">
              <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-3">{t("home.contact.badge")}</p>
              <EditableText
                value={contactTitle}
                onSave={v => onEdit?.("title", v)}
                editMode={editMode}
                as="h2"
                className="text-2xl sm:text-3xl font-black mb-3 leading-tight block"
              />
              <EditableText
                value={contactDesc}
                onSave={v => onEdit?.("desc", v)}
                editMode={editMode}
                as="p"
                multiline
                className="text-white/75 leading-relaxed text-sm sm:text-base mb-4 block"
              />
              <div className="inline-flex items-center gap-1.5 text-white/60 text-sm font-medium">
                <Mail className="w-4 h-4 shrink-0" />
                <EditableText value={contactEmail} onSave={v => onEdit?.("email", v)} editMode={editMode} className="text-white/60 text-sm" />
              </div>
            </div>
            <div className="flex flex-col gap-3 shrink-0">
              <Button
                asChild
                size="lg"
                className="bg-white text-primary hover:bg-white/90 font-bold px-8 shadow-lg gap-2"
                data-testid="button-contact"
              >
                <Link href="/contact">
                  <Mail className="w-4 h-4" /> {t("home.contact.cta1")}
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-white/25 text-white hover:bg-white/10 hover:border-white/40 px-8 gap-2"
              >
                <a href={`mailto:${contactEmail}`}>{t("home.contact.cta2")}</a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────
   TRUST + LEGAL
   ────────────────────────────────────────────────────────────── */
function TrustSection() {
  const { t } = useLanguage();
  const badges = [
    { icon: Shield,   labelKey: "home.trust.b1.label", subKey: "home.trust.b1.sub" },
    { icon: Globe,    labelKey: "home.trust.b2.label", subKey: "home.trust.b2.sub" },
    { icon: Sparkles, labelKey: "home.trust.b3.label", subKey: "home.trust.b3.sub" },
    { icon: Heart,    labelKey: "home.trust.b4.label", subKey: "home.trust.b4.sub" },
  ];
  return (
    <section className="py-16 sm:py-20 border-t border-border/40">
      <div className="max-w-5xl mx-auto px-6 sm:px-8">
        <div className="flex flex-col items-center text-center mb-10">
          <Shield className="w-7 h-7 text-primary mb-3" />
          <h2 className="text-xl font-black mb-2">{t("home.trust.title")}</h2>
          <p className="text-muted-foreground text-sm max-w-md">
            {t("home.trust.desc")}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {badges.map(({ icon: Icon, labelKey, subKey }) => (
            <div key={labelKey} className="rounded-xl border border-border/60 bg-card p-5 text-center flex flex-col items-center gap-2 hover:border-primary/30 transition-colors">
              <Icon className="w-5 h-5 text-primary" />
              <span className="text-xs font-bold">{t(labelKey)}</span>
              <span className="text-[10px] text-muted-foreground leading-snug">{t(subKey)}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/privacy-policy"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border/60 bg-card hover:border-primary/40 hover:bg-muted/50 transition-all text-sm font-semibold"
            data-testid="link-privacy-policy-footer"
          >
            <Shield className="w-4 h-4 text-primary" /> {t("home.trust.privacy")}
          </Link>
          <Link
            href="/terms-of-service"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border/60 bg-card hover:border-primary/40 hover:bg-muted/50 transition-all text-sm font-semibold"
            data-testid="link-tos-footer"
          >
            <FileText className="w-4 h-4 text-primary" /> {t("home.trust.terms")}
          </Link>
          <Link
            href="/legal-hub"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border/60 bg-card hover:border-primary/40 hover:bg-muted/50 transition-all text-sm font-semibold"
            data-testid="link-legal-hub-footer"
          >
            <Sparkles className="w-4 h-4 text-primary" /> {t("home.trust.legal")}
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────
   ADMIN EDITOR — inline on homepage for admins
   ────────────────────────────────────────────────────────────── */

interface SectionConfig { id: string; label: string; visible: boolean; order: number; locked?: boolean; }
interface AdminConfig {
  sections: SectionConfig[];
  template: string;
  content: HomepageContent;
}

const SECTION_META: Record<string, { label: string; emoji: string; hint: string }> = {
  hero:    { label: "Hero Section",    emoji: "⚡", hint: "Main headline, tagline, and CTA buttons" },
  about:   { label: "About / Pillars", emoji: "ℹ️", hint: "Platform description and 4 culture pillars" },
  map:     { label: "Map Spot Types",  emoji: "📍", hint: "Spot category showcase (skate, dance, etc.)" },
  stats:   { label: "Stats Strip",     emoji: "📊", hint: "4 key numbers displayed in a strip" },
  founder: { label: "Founder Story",   emoji: "👤", hint: "Founder name, role, quote, and email" },
  contact: { label: "Contact CTA",     emoji: "✉️", hint: "Call-to-action with contact details" },
  trust:   { label: "Trust & Legal",   emoji: "🛡️", hint: "Trust badges and legal links" },
};

const ADMIN_TEMPLATES = [
  { id: "standard", name: "Standard",    emoji: "🏠", desc: "Full layout — all sections",           color: "#3B82F6", sections: ["hero","about","map","stats","founder","contact","trust"] },
  { id: "minimal",  name: "Minimal",     emoji: "✨", desc: "Clean — Hero, Stats, Contact only",    color: "#6B7280", sections: ["hero","stats","contact"] },
  { id: "bold",     name: "Bold Launch", emoji: "🚀", desc: "Max impact — announcement + all",      color: "#F97316", sections: ["hero","about","map","stats","founder","contact","trust"], announcement: true },
  { id: "showcase", name: "Showcase",    emoji: "🎯", desc: "For visitors — Hero, About, Map, CTA", color: "#10B981", sections: ["hero","about","map","contact"] },
];

const ANNOUNCE_TYPES = [
  { id: "info",    label: "Info",    color: "#3B82F6", emoji: "💬" },
  { id: "success", label: "Success", color: "#10B981", emoji: "✅" },
  { id: "warning", label: "Warning", color: "#F59E0B", emoji: "⚠️" },
  { id: "promo",   label: "Promo",   color: "#7C3AED", emoji: "🎉" },
];

const DEFAULT_ADMIN_CONFIG: AdminConfig = {
  sections: [
    { id: "hero",    label: "Hero Section",    visible: true,  order: 0, locked: true },
    { id: "about",   label: "About / Pillars", visible: true,  order: 1 },
    { id: "map",     label: "Map Spot Types",  visible: true,  order: 2 },
    { id: "stats",   label: "Stats Strip",     visible: true,  order: 3 },
    { id: "founder", label: "Founder Story",   visible: true,  order: 4 },
    { id: "contact", label: "Contact CTA",     visible: true,  order: 5 },
    { id: "trust",   label: "Trust & Legal",   visible: true,  order: 6 },
  ],
  template: "standard",
  content: {
    hero: { badge: "🇳🇱 Netherlands Platform", tagline: "The digital home for Dutch urban culture.", ctaPrimary: "Explore the Map", ctaSecondary: "Join Community" },
    stats: [{ value: "6,000+", label: "Spots on the Map" }, { value: "🇳🇱", label: "Made in Netherlands" }, { value: "Gratis", label: "Free to Browse" }, { value: "Live", label: "Real-time Updates" }],
    announcement: { visible: false, text: "", type: "info" },
    founder: { name: "Riki Almouti", role: "Founder & B-Boy", quote: "", email: "riki@coffeeanddance.nl" },
    contact: { title: "Let's Build Together", desc: "Reach out for collaborations, venue listings, or community partnerships.", email: "riki@coffeeanddance.nl" },
  },
};

// ── Admin AI Panel ────────────────────────────────────────────────────────
interface AiMsg { role: "user" | "assistant"; content: string; applied?: boolean; }
function AdminAiPanel({ open, onClose, config, onPatch }: { open: boolean; onClose: () => void; config: AdminConfig; onPatch?: (patch: any) => void }) {
  const [msgs, setMsgs] = useState<AiMsg[]>([{ role: "assistant", content: "👋 Hi! I'm your AI homepage assistant. I can chat about ideas, write copy, OR directly apply changes to your page — just ask!\n\nTry: \"Make the tagline more energetic\" or \"Show me the stats section\" or \"Write a better about description\"." }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMsgs(m => [...m, { role: "user", content: userMsg }]);
    setLoading(true);
    try {
      const res = await apiRequest("/api/admin/homepage-builder/ai", "POST", {
        message: userMsg,
        context: {
          currentTemplate: config.template,
          visibleSections: config.sections.filter(s => s.visible).map(s => s.label),
          heroTagline: config.content.hero?.tagline,
          currentContent: config.content,
        },
      });
      const data = await res.json();
      if (data.configPatch && onPatch) {
        onPatch(data.configPatch);
        setMsgs(m => [...m, { role: "assistant", content: (data.reply || "Done!") + "\n\n✅ Changes applied to your page.", applied: true }]);
      } else {
        setMsgs(m => [...m, { role: "assistant", content: data.reply || "Done." }]);
      }
    } catch {
      setMsgs(m => [...m, { role: "assistant", content: "Sorry, couldn't connect. Please try again." }]);
    } finally { setLoading(false); }
  };

  if (!open) return null;
  return (
    <div
      className="fixed bottom-20 right-4 z-[2000] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
      style={{ width: 340, height: 460, background: "rgba(10,10,20,0.97)", border: "1px solid rgba(124,58,237,0.4)", backdropFilter: "blur(20px)" }}
    >
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "rgba(124,58,237,0.3)" }}>
            <Sparkles className="w-3.5 h-3.5" style={{ color: "#A78BFA" }} />
          </div>
          <span className="font-bold text-sm text-white">AI Assistant</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: "rgba(124,58,237,0.2)", color: "#C4B5FD" }}>Claude</span>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white/70 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          {msgs.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: m.role === "assistant" ? "rgba(124,58,237,0.3)" : "rgba(255,255,255,0.1)" }}>
                {m.role === "assistant" ? <Bot className="w-3 h-3" style={{ color: "#A78BFA" }} /> : <UserIcon className="w-3 h-3 text-white/70" />}
              </div>
              <div className="max-w-[240px] px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap" style={{ background: m.role === "assistant" ? (m.applied ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.06)") : "rgba(124,58,237,0.25)", color: "rgba(255,255,255,0.85)", border: m.applied ? "1px solid rgba(16,185,129,0.3)" : "none" }}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "rgba(124,58,237,0.3)" }}>
                <Bot className="w-3 h-3" style={{ color: "#A78BFA" }} />
              </div>
              <div className="px-3 py-2 rounded-xl text-xs" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
                <Loader2 className="w-3 h-3 animate-spin inline-block" /> Thinking…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      <div className="p-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask AI about your homepage…"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/30 outline-none focus:border-purple-500/50"
            data-testid="input-admin-ai-chat"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
            style={{ background: "rgba(124,58,237,0.4)", color: "#C4B5FD" }}
            data-testid="button-admin-ai-send"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Section content editor panel ────────────────────────────────────────
function SectionEditorPanel({ sectionId, config, setConfig, onClose }: {
  sectionId: string;
  config: AdminConfig;
  setConfig: (fn: (c: AdminConfig) => AdminConfig) => void;
  onClose: () => void;
}) {
  const meta = SECTION_META[sectionId] || { label: sectionId, emoji: "📄", hint: "" };
  const c = config.content;
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState("");

  const setHero = (key: string, val: string) => setConfig(cfg => ({ ...cfg, content: { ...cfg.content, hero: { ...cfg.content.hero, [key]: val } } }));
  const setStat = (idx: number, key: string, val: string) => setConfig(cfg => ({ ...cfg, content: { ...cfg.content, stats: cfg.content.stats?.map((s, i) => i === idx ? { ...s, [key]: val } : s) } }));
  const setAnn = (key: string, val: any) => setConfig(cfg => ({ ...cfg, content: { ...cfg.content, announcement: { ...cfg.content.announcement!, [key]: val } } }));
  const setFounder = (key: string, val: string) => setConfig(cfg => ({ ...cfg, content: { ...cfg.content, founder: { ...cfg.content.founder, [key]: val } } }));
  const setContact = (key: string, val: string) => setConfig(cfg => ({ ...cfg, content: { ...cfg.content, contact: { ...cfg.content.contact, [key]: val } } }));
  const setAbout = (key: string, val: string) => setConfig(cfg => ({ ...cfg, content: { ...cfg.content, about: { ...cfg.content.about, [key]: val } } }));
  const setMapSpots = (key: string, val: string) => setConfig(cfg => ({ ...cfg, content: { ...cfg.content, mapSpots: { ...cfg.content.mapSpots, [key]: val } } }));

  const generateWithAi = async () => {
    setAiLoading(true);
    setAiSuggestion("");
    try {
      const res = await apiRequest("/api/admin/homepage-builder/ai", "POST", {
        message: `Generate compelling content for the "${meta.label}" section of Urban Culture Hub — a Dutch platform for Breaking, Graffiti, Skateboarding, and Hip-Hop culture. Give me a JSON with keys: title, subtitle, description. Be concise and inspiring.`,
        context: { section: sectionId, currentTemplate: config.template },
      });
      const data = await res.json();
      setAiSuggestion(data.reply || "");
    } catch {
      setAiSuggestion("AI unavailable — please try again.");
    } finally { setAiLoading(false); }
  };

  return (
    <div
      className="fixed top-0 right-0 bottom-0 z-[2100] flex flex-col shadow-2xl"
      style={{ width: 360, background: "rgba(10,10,20,0.98)", borderLeft: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{meta.emoji}</span>
          <div>
            <p className="font-bold text-sm text-white">{meta.label}</p>
            <p className="text-[10px] text-white/40">{meta.hint}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white/70 transition-colors w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/5">
          <X className="w-4 h-4" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-5 space-y-4">

          {/* HERO */}
          {sectionId === "hero" && (
            <>
              {[
                { key: "badge", label: "Badge text", placeholder: "e.g. 🇳🇱 Netherlands Platform" },
                { key: "tagline", label: "Tagline", placeholder: "Main headline…" },
                { key: "ctaPrimary", label: "Primary CTA button", placeholder: "e.g. Explore the Map" },
                { key: "ctaSecondary", label: "Secondary CTA button", placeholder: "e.g. Join Community" },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider block mb-1">{f.label}</label>
                  <input
                    value={(c.hero as any)?.[f.key] || ""}
                    onChange={e => setHero(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/25 outline-none focus:border-purple-500/50 transition-colors"
                    data-testid={`input-admin-hero-${f.key}`}
                  />
                </div>
              ))}
            </>
          )}

          {/* ANNOUNCEMENT */}
          {sectionId === "hero" && (
            <div className="pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Announcement Banner</p>
                <Switch
                  checked={c.announcement?.visible ?? false}
                  onCheckedChange={v => setAnn("visible", v)}
                  data-testid="switch-admin-announcement"
                />
              </div>
              {c.announcement?.visible && (
                <div className="space-y-2">
                  <textarea
                    value={c.announcement?.text || ""}
                    onChange={e => setAnn("text", e.target.value)}
                    placeholder="Announcement text…"
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/25 outline-none focus:border-purple-500/50 resize-none"
                    data-testid="textarea-admin-announcement"
                  />
                  <div className="flex gap-1.5">
                    {ANNOUNCE_TYPES.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setAnn("type", t.id)}
                        className="flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all"
                        style={{
                          background: c.announcement?.type === t.id ? t.color + "40" : "rgba(255,255,255,0.05)",
                          border: `1px solid ${c.announcement?.type === t.id ? t.color : "rgba(255,255,255,0.08)"}`,
                          color: c.announcement?.type === t.id ? "white" : "rgba(255,255,255,0.4)",
                        }}
                        data-testid={`button-admin-ann-${t.id}`}
                      >
                        {t.emoji} {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STATS */}
          {sectionId === "stats" && (
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider">4 Stats</p>
              {(c.stats || []).map((stat, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={stat.value}
                    onChange={e => setStat(i, "value", e.target.value)}
                    placeholder="Value"
                    className="w-20 bg-white/5 border border-white/10 rounded-xl px-2 py-1.5 text-xs text-white placeholder:text-white/25 outline-none focus:border-purple-500/50 text-center font-bold"
                    data-testid={`input-admin-stat-value-${i}`}
                  />
                  <input
                    value={stat.label}
                    onChange={e => setStat(i, "label", e.target.value)}
                    placeholder="Label"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-2 py-1.5 text-xs text-white placeholder:text-white/25 outline-none focus:border-purple-500/50"
                    data-testid={`input-admin-stat-label-${i}`}
                  />
                </div>
              ))}
            </div>
          )}

          {/* FOUNDER */}
          {sectionId === "founder" && (
            <>
              {[
                { key: "name", label: "Name", placeholder: "Riki Almouti" },
                { key: "role", label: "Role", placeholder: "Founder & B-Boy" },
                { key: "email", label: "Email", placeholder: "riki@coffeeanddance.nl" },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider block mb-1">{f.label}</label>
                  <input
                    value={(c.founder as any)?.[f.key] || ""}
                    onChange={e => setFounder(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/25 outline-none focus:border-purple-500/50"
                    data-testid={`input-admin-founder-${f.key}`}
                  />
                </div>
              ))}
              <div>
                <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider block mb-1">Quote</label>
                <textarea
                  value={c.founder?.quote || ""}
                  onChange={e => setFounder("quote", e.target.value)}
                  placeholder="Founder's personal message…"
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/25 outline-none focus:border-purple-500/50 resize-none"
                  data-testid="textarea-admin-founder-quote"
                />
              </div>
            </>
          )}

          {/* CONTACT */}
          {sectionId === "contact" && (
            <>
              {[
                { key: "title", label: "Title", placeholder: "Let's Build Together" },
                { key: "email", label: "Email", placeholder: "riki@coffeeanddance.nl" },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider block mb-1">{f.label}</label>
                  <input
                    value={(c.contact as any)?.[f.key] || ""}
                    onChange={e => setContact(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/25 outline-none focus:border-purple-500/50"
                    data-testid={`input-admin-contact-${f.key}`}
                  />
                </div>
              ))}
              <div>
                <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider block mb-1">Description</label>
                <textarea
                  value={c.contact?.desc || ""}
                  onChange={e => setContact("desc", e.target.value)}
                  placeholder="Contact section description…"
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/25 outline-none focus:border-purple-500/50 resize-none"
                  data-testid="textarea-admin-contact-desc"
                />
              </div>
            </>
          )}

          {/* ABOUT */}
          {sectionId === "about" && (
            <>
              {[
                { key: "title",       label: "Section title",   placeholder: "About Urban Culture Hub" },
                { key: "subtitle",    label: "Badge / subtitle", placeholder: "e.g. Our Mission" },
                { key: "description", label: "Description",     placeholder: "What makes this platform special…" },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider block mb-1">{f.label}</label>
                  {f.key === "description" ? (
                    <textarea
                      value={(c.about as any)?.[f.key] || ""}
                      onChange={e => setAbout(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      rows={3}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/25 outline-none focus:border-purple-500/50 resize-none"
                      data-testid={`textarea-admin-about-${f.key}`}
                    />
                  ) : (
                    <input
                      value={(c.about as any)?.[f.key] || ""}
                      onChange={e => setAbout(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/25 outline-none focus:border-purple-500/50"
                      data-testid={`input-admin-about-${f.key}`}
                    />
                  )}
                </div>
              ))}
            </>
          )}

          {/* MAP SPOTS */}
          {sectionId === "map" && (
            <>
              {[
                { key: "title",    label: "Section title",   placeholder: "Spots on the Map" },
                { key: "subtitle", label: "Badge / subtitle", placeholder: "e.g. Explore Spots" },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider block mb-1">{f.label}</label>
                  <input
                    value={(c.mapSpots as any)?.[f.key] || ""}
                    onChange={e => setMapSpots(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/25 outline-none focus:border-purple-500/50"
                    data-testid={`input-admin-map-${f.key}`}
                  />
                </div>
              ))}
            </>
          )}

          {/* TRUST */}
          {sectionId === "trust" && (
            <div className="p-3 rounded-xl text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="text-2xl block mb-2">🛡️</span>
              <p className="text-xs text-white/50 leading-relaxed">The Trust & Legal section displays fixed compliance content.<br />Use the AI assistant to get copy suggestions.</p>
            </div>
          )}

          {/* ── AI Generate button (shown for all sections) ── */}
          <div className="pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <button
              onClick={generateWithAi}
              disabled={aiLoading}
              className="w-full flex items-center justify-center gap-2 h-9 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.35)", color: "#C4B5FD" }}
              data-testid={`button-admin-ai-generate-${sectionId}`}
            >
              {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              {aiLoading ? "Generating…" : "Generate with AI"}
            </button>
            {aiSuggestion && (
              <div className="mt-3 p-3 rounded-xl text-xs leading-relaxed" style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)", color: "rgba(255,255,255,0.75)", whiteSpace: "pre-wrap" }}>
                {aiSuggestion}
              </div>
            )}
          </div>

        </div>
      </ScrollArea>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   PAGE ROOT — config-driven section ordering
   ────────────────────────────────────────────────────────────── */
const DEFAULT_SECTIONS: HomepageSection[] = [
  { id: "hero",    visible: true, order: 0 },
  { id: "about",   visible: true, order: 1 },
  { id: "map",     visible: true, order: 2 },
  { id: "stats",   visible: true, order: 3 },
  { id: "founder", visible: true, order: 4 },
  { id: "contact", visible: true, order: 5 },
  { id: "trust",   visible: true, order: 6 },
];

export default function HomePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: homepageConfig } = useQuery<HomepageConfig>({
    queryKey: ["/api/homepage-config"],
    staleTime: 5 * 60 * 1000,
  });

  // ── Admin editor state ────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [adminConfig, setAdminConfig] = useState<AdminConfig>(DEFAULT_ADMIN_CONFIG);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);
  const [aiCmd, setAiCmd] = useState("");
  const [aiCmdLoading, setAiCmdLoading] = useState(false);

  // Deep-merge a patch object into adminConfig
  const patchConfig = useCallback((patch: Partial<{ content: Partial<HomepageContent>; sections: any[] }>) => {
    setAdminConfig(c => ({
      ...c,
      ...(patch.sections ? { sections: patch.sections } : {}),
      content: patch.content
        ? Object.entries(patch.content).reduce((acc, [k, v]) => ({
            ...acc,
            [k]: typeof v === "object" && !Array.isArray(v) ? { ...(acc as any)[k], ...(v as any) } : v,
          }), c.content as any)
        : c.content,
    }));
  }, []);

  const runAiCommand = useCallback(async (cmd: string) => {
    if (!cmd.trim() || aiCmdLoading) return;
    setAiCmdLoading(true);
    try {
      const res = await apiRequest("/api/admin/homepage-builder/ai", "POST", {
        message: cmd,
        context: {
          currentTemplate: adminConfig.template,
          visibleSections: adminConfig.sections.filter(s => s.visible).map(s => s.label),
          heroTagline: adminConfig.content.hero?.tagline,
          currentContent: adminConfig.content,
        },
      });
      const data = await res.json();
      if (data.configPatch) {
        patchConfig(data.configPatch);
        toast({ title: "✨ AI applied changes", description: data.reply?.slice(0, 80) || "Page updated." });
      } else {
        toast({ title: "AI says:", description: data.reply?.slice(0, 140) || "Done." });
      }
    } catch {
      toast({ title: "AI command failed", variant: "destructive" });
    } finally {
      setAiCmdLoading(false);
      setAiCmd("");
    }
  }, [adminConfig, aiCmdLoading, patchConfig, toast]);

  // Sync server config → local admin config
  useEffect(() => {
    if (homepageConfig) {
      setAdminConfig(prev => ({
        ...DEFAULT_ADMIN_CONFIG,
        ...homepageConfig,
        sections: DEFAULT_ADMIN_CONFIG.sections.map(ds => {
          const srv = (homepageConfig.sections || []).find((s: any) => s.id === ds.id);
          return srv ? { ...ds, ...srv } : ds;
        }),
        content: { ...DEFAULT_ADMIN_CONFIG.content, ...homepageConfig.content },
      }));
    }
  }, [homepageConfig]);

  // Save mutation
  const saveMut = useMutation({
    mutationFn: () => apiRequest("/api/admin/homepage-config", "PUT", adminConfig),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/homepage-config"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      toast({ title: "✅ Homepage saved!", description: "Your changes are now live." });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  // Drag-and-drop handlers
  const handleDragStart = useCallback((id: string) => { dragId.current = id; }, []);
  const handleDragOver  = useCallback((e: React.DragEvent, id: string) => { e.preventDefault(); setDragOver(id); }, []);
  const handleDrop      = useCallback((e: React.DragEvent, toId: string) => {
    e.preventDefault();
    const fromId = dragId.current;
    if (!fromId || fromId === toId) { setDragOver(null); return; }
    setAdminConfig(c => {
      const sorted = [...c.sections].sort((a, b) => a.order - b.order);
      const fromIdx = sorted.findIndex(s => s.id === fromId);
      const toIdx   = sorted.findIndex(s => s.id === toId);
      if (fromIdx < 0 || toIdx < 0) return c;
      const reordered = [...sorted];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, moved);
      return { ...c, sections: reordered.map((s, i) => ({ ...s, order: i })) };
    });
    dragId.current = null;
    setDragOver(null);
  }, []);

  const toggleVisible = useCallback((id: string) => {
    setAdminConfig(c => ({
      ...c,
      sections: c.sections.map(s => s.id === id && !s.locked ? { ...s, visible: !s.visible } : s),
    }));
  }, []);

  const applyTemplate = useCallback((tpl: typeof ADMIN_TEMPLATES[0]) => {
    setAdminConfig(c => ({
      ...c,
      template: tpl.id,
      sections: DEFAULT_ADMIN_CONFIG.sections.map(s => ({
        ...s,
        visible: tpl.sections.includes(s.id),
        order: tpl.sections.includes(s.id) ? tpl.sections.indexOf(s.id) : s.order,
      })).sort((a, b) => a.order - b.order).map((s, i) => ({ ...s, order: i })),
      content: {
        ...c.content,
        announcement: {
          ...(c.content.announcement || { text: "", type: "info" }),
          visible: !!(tpl as any).announcement,
          text: (tpl as any).announcement && !c.content.announcement?.text
            ? "🎉 Welcome to Urban Culture Hub — the home of Dutch urban culture!"
            : c.content.announcement?.text || "",
        },
      },
    }));
    setTemplateOpen(false);
    toast({ title: `Template "${tpl.name}" applied`, description: "Click Save & Publish to go live." });
  }, [toast]);

  // ── Resolve which config to render ───────────────────────────────────
  const renderConfig: HomepageConfig = editMode
    ? { sections: adminConfig.sections, content: adminConfig.content }
    : { sections: homepageConfig?.sections ?? DEFAULT_SECTIONS, content: homepageConfig?.content ?? {} };

  const sorted = [...renderConfig.sections].sort((a, b) => a.order - b.order);
  const content = renderConfig.content;

  // ── Inline-edit helpers ────────────────────────────────────────────
  const setHero    = (key: string, val: string) => setAdminConfig(c => ({ ...c, content: { ...c.content, hero:    { ...c.content.hero,    [key]: val } } }));
  const setAbout   = (key: string, val: string) => setAdminConfig(c => ({ ...c, content: { ...c.content, about:   { ...c.content.about,   [key]: val } } }));
  const setFounder = (key: string, val: string) => setAdminConfig(c => ({ ...c, content: { ...c.content, founder: { ...c.content.founder, [key]: val } } }));
  const setContact = (key: string, val: string) => setAdminConfig(c => ({ ...c, content: { ...c.content, contact: { ...c.content.contact, [key]: val } } }));
  const setStat    = (i: number, field: string, val: string) => setAdminConfig(c => ({ ...c, content: { ...c.content, stats: c.content.stats?.map((s, idx) => idx === i ? { ...s, [field]: val } : s) } }));

  const sectionMap: Record<string, React.ReactNode> = {
    hero:    <HeroSection    content={content.hero}      editMode={editMode} onEdit={setHero}    />,
    about:   <AboutSection   content={content.about}     editMode={editMode} onEdit={setAbout}   />,
    map:     <MapSpotsSection content={content.mapSpots} />,
    stats:   <StatsStrip     statsConfig={content.stats} editMode={editMode} onEditStat={setStat} />,
    founder: <FounderSection content={content.founder}   editMode={editMode} onEdit={setFounder} />,
    contact: <ContactSection content={content.contact}   editMode={editMode} onEdit={setContact} />,
    trust:   <TrustSection   />,
  };

  return (
    <div className="flex flex-col w-full">

      {/* ── Admin persistent hint bar (always visible to admins, even before edit mode) ── */}
      {isAdmin && !editMode && (
        <div
          className="sticky top-0 z-[1500] w-full flex items-center justify-between px-4 py-2"
          style={{ background: "rgba(15,6,35,0.95)", borderBottom: "1px solid rgba(124,58,237,0.25)", backdropFilter: "blur(12px)" }}
        >
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: "rgba(124,58,237,0.3)" }}>
              <Layout className="w-3 h-3" style={{ color: "#A78BFA" }} />
            </div>
            <span className="text-xs font-semibold" style={{ color: "rgba(196,181,253,0.8)" }}>Admin view</span>
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>— make changes to the homepage below</span>
          </div>
          <button
            onClick={() => setEditMode(true)}
            className="flex items-center gap-1.5 px-3 h-7 rounded-xl text-xs font-bold transition-all active:scale-95"
            style={{ background: "linear-gradient(135deg,#7C3AED,#5B21B6)", color: "white", boxShadow: "0 2px 12px rgba(124,58,237,0.4)" }}
            data-testid="button-admin-enter-edit-mode-top"
          >
            <Pencil className="w-3 h-3" />
            Edit Page
          </button>
        </div>
      )}

      {/* ── Admin edit toolbar (full, only in edit mode) ── */}
      {isAdmin && editMode && (
        <div
          className="sticky top-0 z-[1500] w-full"
          style={{ background: "rgba(10,8,25,0.97)", borderBottom: "1px solid rgba(124,58,237,0.3)", backdropFilter: "blur(16px)" }}
        >
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
            {/* Logo */}
            <div className="flex items-center gap-2 mr-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(124,58,237,0.3)" }}>
                <Layout className="w-3.5 h-3.5" style={{ color: "#A78BFA" }} />
              </div>
              <span className="font-black text-sm text-white hidden sm:block">Homepage Editor</span>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full hidden sm:block"
                style={{ background: "rgba(124,58,237,0.2)", color: "#C4B5FD" }}
              >
                LIVE EDIT
              </span>
            </div>

            {/* Template picker */}
            <div className="relative">
              <button
                onClick={() => setTemplateOpen(v => !v)}
                className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs font-semibold transition-all"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}
                data-testid="button-admin-template-picker"
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Template:</span> <span className="capitalize">{adminConfig.template}</span>
              </button>
              {templateOpen && (
                <div
                  className="absolute top-10 left-0 rounded-2xl overflow-hidden shadow-2xl z-[2200]"
                  style={{ background: "rgba(10,8,25,0.99)", border: "1px solid rgba(255,255,255,0.1)", width: 280 }}
                >
                  {ADMIN_TEMPLATES.map(tpl => (
                    <button
                      key={tpl.id}
                      onClick={() => applyTemplate(tpl)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                      data-testid={`button-admin-template-${tpl.id}`}
                    >
                      <span className="text-xl">{tpl.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white">{tpl.name}</p>
                        <p className="text-[10px] text-white/40 truncate">{tpl.desc}</p>
                      </div>
                      {adminConfig.template === tpl.id && (
                        <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: tpl.color }} />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* AI toggle */}
            <button
              onClick={() => setAiOpen(v => !v)}
              className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: aiOpen ? "rgba(124,58,237,0.3)" : "rgba(255,255,255,0.07)",
                border: aiOpen ? "1px solid rgba(124,58,237,0.6)" : "1px solid rgba(255,255,255,0.1)",
                color: aiOpen ? "#C4B5FD" : "rgba(255,255,255,0.7)",
              }}
              data-testid="button-admin-ai-toggle"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">AI</span>
            </button>

            {/* Reset */}
            <button
              onClick={() => { setAdminConfig(DEFAULT_ADMIN_CONFIG); toast({ title: "Reset to defaults" }); }}
              className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs font-semibold transition-all"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}
              data-testid="button-admin-reset"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>

            <div className="flex-1" />

            {/* Exit edit mode */}
            <button
              onClick={() => { setEditMode(false); setActiveSection(null); setAiOpen(false); setTemplateOpen(false); }}
              className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs font-semibold transition-all"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.6)" }}
              data-testid="button-admin-exit-edit"
            >
              <X className="w-3.5 h-3.5" /> Exit
            </button>

            {/* Save */}
            <button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
              className="flex items-center gap-1.5 px-4 h-8 rounded-xl text-xs font-bold transition-all"
              style={{
                background: saved ? "#059669" : "linear-gradient(135deg,#7C3AED,#5B21B6)",
                color: "white",
                boxShadow: saved ? "0 4px 12px rgba(5,150,105,0.4)" : "0 4px 12px rgba(124,58,237,0.35)",
              }}
              data-testid="button-admin-save-publish"
            >
              {saveMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <CheckCircle className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              {saved ? "Saved!" : "Save & Publish"}
            </button>
          </div>

          {/* ── AI Command bar ── */}
          <div
            className="flex items-center gap-2 px-4 py-2"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(124,58,237,0.25)" }}>
              <Sparkles className="w-3 h-3" style={{ color: "#A78BFA" }} />
            </div>
            <input
              value={aiCmd}
              onChange={e => setAiCmd(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") runAiCommand(aiCmd); }}
              placeholder='Tell AI what to change… e.g. "make the tagline more energetic" or "hide the stats section"'
              className="flex-1 text-xs outline-none bg-transparent placeholder:text-white/25"
              style={{ color: "rgba(255,255,255,0.8)", caretColor: "#a78bfa" }}
              disabled={aiCmdLoading}
              data-testid="input-admin-ai-command"
            />
            <button
              onClick={() => runAiCommand(aiCmd)}
              disabled={!aiCmd.trim() || aiCmdLoading}
              className="flex items-center gap-1.5 px-3 h-7 rounded-xl text-[11px] font-bold transition-all disabled:opacity-40"
              style={{ background: "rgba(124,58,237,0.35)", border: "1px solid rgba(124,58,237,0.5)", color: "#C4B5FD" }}
              data-testid="button-admin-ai-run"
            >
              {aiCmdLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              {aiCmdLoading ? "Applying…" : "Apply"}
            </button>
          </div>

          {/* Section order strip */}
          <div className="border-t flex overflow-x-auto gap-0.5 px-4 py-1.5 hide-scrollbar" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            {[...adminConfig.sections].sort((a, b) => a.order - b.order).map((s, i) => {
              const m = SECTION_META[s.id] || { emoji: "📄", label: s.id };
              return (
                <div
                  key={s.id}
                  draggable
                  onDragStart={() => handleDragStart(s.id)}
                  onDragOver={e => handleDragOver(e, s.id)}
                  onDrop={e => handleDrop(e, s.id)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg cursor-grab active:cursor-grabbing transition-all flex-shrink-0"
                  style={{
                    background: dragOver === s.id ? "rgba(124,58,237,0.3)" : activeSection === s.id ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.04)",
                    border: activeSection === s.id ? "1px solid rgba(124,58,237,0.4)" : "1px solid rgba(255,255,255,0.06)",
                    opacity: !s.visible ? 0.4 : 1,
                  }}
                  onClick={() => setActiveSection(activeSection === s.id ? null : s.id)}
                  data-testid={`button-admin-section-strip-${s.id}`}
                >
                  <GripVertical className="w-3 h-3 text-white/25" />
                  <span className="text-xs">{m.emoji}</span>
                  <span className="text-[10px] font-semibold text-white/60 whitespace-nowrap">{m.label}</span>
                  <button
                    onClick={e => { e.stopPropagation(); toggleVisible(s.id); }}
                    className="ml-1 text-white/30 hover:text-white/70 transition-colors"
                    disabled={!!(s as any).locked}
                    title={s.visible ? "Hide" : "Show"}
                    data-testid={`button-admin-visibility-${s.id}`}
                  >
                    {s.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Floating edit toggle (always visible for admins) ── */}
      {isAdmin && !editMode && (
        <button
          onClick={() => setEditMode(true)}
          className="fixed bottom-24 right-4 z-[1400] flex items-center gap-2 px-4 h-11 rounded-2xl font-bold text-sm shadow-xl transition-all active:scale-95"
          style={{
            background: "linear-gradient(135deg,#7C3AED,#5B21B6)",
            color: "white",
            boxShadow: "0 4px 20px rgba(124,58,237,0.45)",
          }}
          data-testid="button-admin-enter-edit-mode"
        >
          <Pencil className="w-4 h-4" />
          Edit Page
        </button>
      )}

      {/* ── Announcement banner ── */}
      <AnnouncementBanner announcement={content.announcement} />

      {/* ── Sections ── */}
      {sorted
        .filter(s => s.visible || (isAdmin && editMode))
        .map(s => {
          const node = sectionMap[s.id];
          if (!node) return null;

          // Non-admin: plain render
          if (!isAdmin) return <div key={s.id}>{node}</div>;

          const meta = SECTION_META[s.id] || { emoji: "📄", label: s.id };
          const isActive = activeSection === s.id;
          const isDragTarget = dragOver === s.id;

          // Admin — click-to-edit always available (edit mode or not)
          const sectionIdx = sorted.findIndex(x => x.id === s.id);
          const canMoveUp = editMode && sectionIdx > 0 && !s.locked;
          const canMoveDown = editMode && sectionIdx < sorted.length - 1 && !s.locked;

          const moveSection = (dir: "up" | "down") => {
            setAdminConfig(c => {
              const reordered = [...c.sections].sort((a, b) => a.order - b.order);
              const thisIdx = reordered.findIndex(x => x.id === s.id);
              const swapIdx = dir === "up" ? thisIdx - 1 : thisIdx + 1;
              if (swapIdx < 0 || swapIdx >= reordered.length) return c;
              const tmp = reordered[thisIdx].order;
              reordered[thisIdx] = { ...reordered[thisIdx], order: reordered[swapIdx].order };
              reordered[swapIdx] = { ...reordered[swapIdx], order: tmp };
              return { ...c, sections: reordered };
            });
          };

          return (
            <div
              key={s.id}
              draggable={editMode}
              onDragStart={editMode ? () => handleDragStart(s.id) : undefined}
              onDragOver={editMode ? (e => handleDragOver(e, s.id)) : undefined}
              onDrop={editMode ? (e => handleDrop(e, s.id)) : undefined}
              style={{
                position: "relative",
                isolation: "isolate",
                outline: isDragTarget
                  ? "3px dashed rgba(124,58,237,0.8)"
                  : isActive
                  ? "3px solid rgba(124,58,237,0.6)"
                  : "3px solid transparent",
                outlineOffset: -2,
                opacity: !s.visible ? 0.4 : 1,
                transition: "outline 0.15s, opacity 0.2s",
              }}
              data-testid={`admin-section-wrapper-${s.id}`}
            >
              {/* Section content FIRST (so overlay renders on top) */}
              {node}

              {/* ── Admin overlay — renders after node so it's always on top ── */}
              <div
                style={{
                  position: "absolute",
                  top: 0, left: 0, right: 0, bottom: 0,
                  zIndex: 9999,
                  pointerEvents: "none",
                }}
              >
                {/* Top-right toolbar — always clickable */}
                <div
                  style={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    pointerEvents: "auto",
                    zIndex: 10000,
                  }}
                >
                  {/* Drag handle (edit mode only) */}
                  {editMode && (
                    <div
                      style={{
                        display: "flex", alignItems: "center", gap: 4, padding: "0 8px",
                        height: 28, borderRadius: 12, cursor: "grab", userSelect: "none",
                        background: "rgba(10,8,25,0.95)", border: "1px solid rgba(255,255,255,0.18)",
                        color: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)",
                        boxShadow: "0 2px 10px rgba(0,0,0,0.6)", fontSize: 10, fontWeight: 700,
                      }}
                    >
                      <GripVertical style={{ width: 14, height: 14 }} />
                      <span>{meta.emoji} {meta.label}</span>
                    </div>
                  )}

                  {/* Move Up */}
                  {canMoveUp && (
                    <button
                      onClick={() => moveSection("up")}
                      title="Move section up"
                      style={{
                        width: 28, height: 28, borderRadius: 10, cursor: "pointer",
                        background: "rgba(10,8,25,0.95)", border: "1px solid rgba(255,255,255,0.15)",
                        color: "rgba(255,255,255,0.65)", backdropFilter: "blur(12px)",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                      data-testid={`button-admin-section-up-${s.id}`}
                    >
                      <ChevronUp style={{ width: 14, height: 14 }} />
                    </button>
                  )}

                  {/* Move Down */}
                  {canMoveDown && (
                    <button
                      onClick={() => moveSection("down")}
                      title="Move section down"
                      style={{
                        width: 28, height: 28, borderRadius: 10, cursor: "pointer",
                        background: "rgba(10,8,25,0.95)", border: "1px solid rgba(255,255,255,0.15)",
                        color: "rgba(255,255,255,0.65)", backdropFilter: "blur(12px)",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                      data-testid={`button-admin-section-down-${s.id}`}
                    >
                      <ChevronDown style={{ width: 14, height: 14 }} />
                    </button>
                  )}

                  {/* Visibility toggle (edit mode only) */}
                  {editMode && !(s as any).locked && (
                    <button
                      onClick={() => toggleVisible(s.id)}
                      title={s.visible ? "Hide section" : "Show section"}
                      style={{
                        width: 28, height: 28, borderRadius: 10, cursor: "pointer",
                        background: "rgba(10,8,25,0.95)",
                        border: s.visible ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(239,68,68,0.5)",
                        color: s.visible ? "rgba(255,255,255,0.65)" : "#EF4444",
                        backdropFilter: "blur(12px)", boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                      data-testid={`button-admin-section-toggle-${s.id}`}
                    >
                      {s.visible ? <Eye style={{ width: 14, height: 14 }} /> : <EyeOff style={{ width: 14, height: 14 }} />}
                    </button>
                  )}

                  {/* EDIT button — always visible for admins */}
                  <button
                    onClick={() => {
                      if (!editMode) setEditMode(true);
                      setActiveSection(isActive ? null : s.id);
                    }}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "0 12px",
                      height: 28, borderRadius: 12, cursor: "pointer",
                      background: isActive ? "rgba(124,58,237,0.7)" : "rgba(10,8,25,0.95)",
                      border: isActive ? "1.5px solid rgba(124,58,237,0.8)" : "1.5px solid rgba(124,58,237,0.5)",
                      color: isActive ? "#EDE9FE" : "#C4B5FD",
                      backdropFilter: "blur(12px)",
                      boxShadow: isActive ? "0 2px 14px rgba(124,58,237,0.5)" : "0 2px 10px rgba(0,0,0,0.5)",
                      fontSize: 11, fontWeight: 700,
                    }}
                    data-testid={`button-admin-section-edit-${s.id}`}
                  >
                    <Pencil style={{ width: 12, height: 12 }} />
                    {isActive ? "✓ Editing" : "Edit"}
                  </button>
                </div>

                {/* Bottom-left section label (only in edit mode, not for active) */}
                {editMode && !isActive && (
                  <div
                    style={{
                      position: "absolute", bottom: 12, left: 12,
                      background: "rgba(10,8,25,0.85)", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8, padding: "2px 8px", fontSize: 10, fontWeight: 600,
                      color: "rgba(255,255,255,0.45)", backdropFilter: "blur(8px)",
                      pointerEvents: "none",
                    }}
                  >
                    {meta.emoji} {meta.label}
                  </div>
                )}
              </div>
            </div>
          );
        })
      }

      {/* ── Section editor panel (right slide-in) ── */}
      {isAdmin && editMode && activeSection && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[2000] bg-black/40 backdrop-blur-sm"
            onClick={() => setActiveSection(null)}
          />
          <SectionEditorPanel
            sectionId={activeSection}
            config={adminConfig}
            setConfig={setAdminConfig}
            onClose={() => setActiveSection(null)}
          />
        </>
      )}

      {/* ── AI panel ── */}
      {isAdmin && editMode && (
        <AdminAiPanel open={aiOpen} onClose={() => setAiOpen(false)} config={adminConfig} onPatch={patchConfig} />
      )}

      {/* ── Template overlay backdrop ── */}
      {templateOpen && (
        <div className="fixed inset-0 z-[2100]" onClick={() => setTemplateOpen(false)} />
      )}

      {/* Bottom nav spacing on mobile */}
      <div className="h-[calc(60px+env(safe-area-inset-bottom,0px)+8px)] md:h-6" />
    </div>
  );
}
