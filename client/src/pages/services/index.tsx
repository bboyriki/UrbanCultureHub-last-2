import { useQuery, useMutation } from "@tanstack/react-query";
import { Service, ServiceCategory, ServiceType, SkillLevel } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Loader2, Plus, MapPin, Calendar, Star, ChevronRight,
  Search, SlidersHorizontal, Sparkles, Lock, X, Pencil,
  MoreVertical, Clock, Users, Wifi, WifiOff, CheckCircle,
  Zap, TrendingUp, Award, Filter, ArrowUpDown,
} from "lucide-react";
import { useLocation } from "wouter";
import { useState, useMemo } from "react";
import { formatPrice } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useServicesAccess } from "@/components/services/ServicesGate";
import { apiRequest } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";

// ── Category icon map ──────────────────────────────────────────────────────
const CATEGORY_EMOJI: Record<string, string> = {
  dance: "💃", graffiti: "🎨", beatbox: "🎤", rap: "🎙️", dj: "🎧",
  music: "🎵", theater: "🎭", circus: "🤹", skateboarding: "🛹",
  parkour: "🏃", bmx: "🚲", rollerblading: "⛸️", basketball: "🏀",
  football: "⚽", boxing: "🥊", mma: "🥋", capoeira: "🤸",
  gymnastics: "🤼", fitness: "💪", lighting: "💡", sound: "🔊",
  stage_design: "🏗️", projection: "📽️", photography: "📸",
  videography: "🎬", event_management: "📋", other: "✨",
};

const SKILL_COLOR: Record<string, string> = {
  beginner:     "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  intermediate: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  advanced:     "bg-violet-500/15 text-violet-400 border-violet-500/25",
  professional: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  all_levels:   "bg-zinc-500/15 text-zinc-400 border-zinc-500/25",
};

const TYPE_LABEL: Record<string, string> = {
  workshop:       "Workshop",
  private_lesson: "Private Lesson",
  performance:    "Performance",
  event_service:  "Event Service",
  technical:      "Technical",
  creative_service: "Creative",
};

// ── Coming Soon lock screen ────────────────────────────────────────────────
function LockedScreen() {
  const { user } = useAuth();
  return (
    <div className="min-h-[80svh] flex flex-col items-center justify-center px-6 text-center">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/30 to-violet-600/30 flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/10">
          <Lock className="w-9 h-9 text-primary" />
        </div>
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
          <span className="text-[9px] font-black text-black">!</span>
        </div>
      </div>
      <Badge className="mb-4 px-3 py-1 text-[11px] font-semibold tracking-widest uppercase bg-primary/10 text-primary border border-primary/20">
        Coming Soon
      </Badge>
      <h1 className="text-3xl sm:text-4xl font-black mb-3 tracking-tight">
        Talent Marketplace
      </h1>
      <p className="text-muted-foreground max-w-sm text-base leading-relaxed mb-8">
        The professional talent & service marketplace is being prepared. Artists, coaches, and production crews will be bookable here very soon.
      </p>
      <div className="grid grid-cols-3 gap-4 max-w-xs w-full mb-8">
        {[
          { icon: "💃", label: "Artists" },
          { icon: "🛹", label: "Athletes" },
          { icon: "🎬", label: "Production" },
        ].map(({ icon, label }) => (
          <div key={label} className="rounded-2xl border border-border/40 bg-card/50 py-4 flex flex-col items-center gap-1.5">
            <span className="text-2xl">{icon}</span>
            <span className="text-[11px] text-muted-foreground font-semibold">{label}</span>
          </div>
        ))}
      </div>
      {user?.role === "admin" || user?.role === "super_admin" ? (
        <p className="text-xs text-muted-foreground/60">
          Admins can unlock this in Feature Settings → Talent Marketplace
        </p>
      ) : (
        <p className="text-xs text-muted-foreground/60">
          Follow Urban Culture Hub for launch updates
        </p>
      )}
    </div>
  );
}

// ── Service Card ───────────────────────────────────────────────────────────
interface AiMatch { id: number; reason: string; score: number }

function ServiceCard({ service, aiMatch }: { service: Service; aiMatch?: AiMatch }) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const canManage = user && (user.role === "admin" || user.role === "super_admin" || user.id === service.providerId);
  const emoji = CATEGORY_EMOJI[service.category?.toLowerCase()] || "✨";
  const skillClass = SKILL_COLOR[service.skillLevel?.toLowerCase()] || SKILL_COLOR.all_levels;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className={`group relative rounded-2xl overflow-hidden border bg-card cursor-pointer transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 flex flex-col h-full ${aiMatch ? "border-primary/30 ring-1 ring-primary/20" : "border-border/50"}`}
        onClick={() => navigate(`/services/${service.id}`)}
        data-testid={`card-service-${service.id}`}
      >
        {/* AI match ribbon */}
        {aiMatch && (
          <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-primary/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-[10px] font-bold text-white shadow">
            <Sparkles className="w-3 h-3" />
            AI Match · {aiMatch.score}/10
          </div>
        )}

        {/* Admin menu */}
        {canManage && (
          <div className="absolute top-3 right-3 z-10" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/70 text-white">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/services/edit/${service.id}`)}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate(`/services/${service.id}/manage`)}>
                  <Calendar className="mr-2 h-4 w-4" /> Manage Bookings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Image / gradient header */}
        <div className="relative h-44 overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-800 flex items-center justify-center shrink-0">
          {service.images && service.images.length > 0 ? (
            <img src={service.images[0]} alt={service.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
          ) : (
            <span className="text-5xl opacity-60">{emoji}</span>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          {/* Bottom pill */}
          <div className="absolute bottom-3 left-3 flex gap-1.5 flex-wrap">
            <Badge className="bg-black/60 backdrop-blur-sm text-white border-0 text-[10px] px-2 py-0.5">
              {TYPE_LABEL[service.type?.toLowerCase()] || service.type}
            </Badge>
            {service.isVerified && (
              <Badge className="bg-primary/80 backdrop-blur-sm text-white border-0 text-[10px] px-2 py-0.5 flex items-center gap-1">
                <CheckCircle className="w-2.5 h-2.5" /> Verified
              </Badge>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col flex-1 p-4">
          <div className="mb-2">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-bold text-sm leading-snug line-clamp-2 flex-1">{service.name}</h3>
              <div className="text-right shrink-0">
                <div className="font-black text-base text-primary">{formatPrice(parseFloat(service.price))}</div>
                <div className="text-[10px] text-muted-foreground">/ session</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              <span className="text-[10px] font-medium">{emoji} {service.category}</span>
              {service.skillLevel && (
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${skillClass}`}>
                  {service.skillLevel.replace("_", " ")}
                </Badge>
              )}
            </div>
          </div>

          {aiMatch && (
            <p className="text-[11px] text-primary/80 italic mb-2 leading-relaxed">"{ aiMatch.reason}"</p>
          )}

          <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2 mb-3 flex-1">
            {service.description}
          </p>

          <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-auto pt-2 border-t border-border/30">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{service.duration}m</span>
            {service.maxParticipants && (
              <span className="flex items-center gap-1"><Users className="w-3 h-3" />Max {service.maxParticipants}</span>
            )}
            {service.isRemote ? (
              <span className="flex items-center gap-1 text-emerald-500"><Wifi className="w-3 h-3" />Online</span>
            ) : service.location ? (
              <span className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3 shrink-0" />{service.location.split(",")[0]}</span>
            ) : null}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── AI Match Panel ─────────────────────────────────────────────────────────
function AiMatchPanel({
  open, onClose, services, onResults,
}: {
  open: boolean;
  onClose: () => void;
  services: Service[];
  onResults: (matches: AiMatch[]) => void;
}) {
  const [query, setQuery] = useState("");

  const matchMutation = useMutation({
    mutationFn: async (q: string) => {
      const res = await apiRequest("/api/services/ai/match", "POST", { query: q, services });
      const data = await res.json();
      return data.matches as AiMatch[];
    },
    onSuccess: (matches) => {
      onResults(matches);
      onClose();
    },
  });

  const examples = [
    "A b-boy instructor for my crew training",
    "Photographer for a graffiti event",
    "DJ for a hip-hop block party in Amsterdam",
    "Capoeira workshop for beginners",
  ];

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-auto max-h-[80svh] rounded-t-3xl px-6 pb-8">
        <SheetHeader className="mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/15 flex items-center justify-center border border-primary/20">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <SheetTitle className="text-lg font-black">AI Talent Finder</SheetTitle>
              <SheetDescription className="text-xs">Describe what you need — Claude finds the best match</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <Textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. I need a professional breaking coach for a youth workshop in Rotterdam..."
          className="min-h-[100px] mb-3 resize-none bg-muted/30 text-sm"
          data-testid="input-ai-match-query"
        />

        <div className="flex flex-wrap gap-2 mb-5">
          {examples.map((ex) => (
            <button
              key={ex}
              onClick={() => setQuery(ex)}
              className="text-[11px] px-2.5 py-1 rounded-full border border-border/50 bg-muted/30 text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>

        <Button
          className="w-full gap-2 font-bold"
          disabled={!query.trim() || matchMutation.isPending || services.length === 0}
          onClick={() => matchMutation.mutate(query)}
          data-testid="button-ai-match-submit"
        >
          {matchMutation.isPending ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Finding matches…</>
          ) : (
            <><Sparkles className="w-4 h-4" /> Find My Talent</>
          )}
        </Button>

        {matchMutation.isError && (
          <p className="text-xs text-destructive text-center mt-3">
            AI service unavailable. Please try again shortly.
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Sort & Filter utils ────────────────────────────────────────────────────
type SortKey = "default" | "price_asc" | "price_desc" | "newest";
const SORT_LABELS: Record<SortKey, string> = {
  default:    "Relevance",
  price_asc:  "Price: Low → High",
  price_desc: "Price: High → Low",
  newest:     "Newest first",
};

// ── Main Page ──────────────────────────────────────────────────────────────
export default function ServicesPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // Filters
  const [search, setSearch]               = useState("");
  const [selectedCategory, setCategory]   = useState<string | null>(null);
  const [selectedType, setType]           = useState<string | null>(null);
  const [selectedSkill, setSkill]         = useState<string | null>(null);
  const [sortKey, setSortKey]             = useState<SortKey>("default");
  const [aiPanelOpen, setAiPanelOpen]     = useState(false);
  const [aiMatches, setAiMatches]         = useState<AiMatch[] | null>(null);

  // ── Feature lock check ────────────────────────────────────────────────
  // Single source of truth: useServicesAccess() handles both array and
  // object shapes for /api/app-settings, defaults to locked when missing,
  // and grants admins/super_admins automatic pass-through. The page is
  // already wrapped in <ServicesGate /> at the route level — this in-page
  // check is kept as a defensive fallback and to expose isLocked for the
  // admin badge below.
  const { isAdmin, isLocked, canAccess } = useServicesAccess();

  if (!canAccess) {
    return <LockedScreen />;
  }

  // ── Data fetch ────────────────────────────────────────────────────────
  const { data: allServices = [], isLoading } = useQuery<Service[]>({
    queryKey: ["/api/services"],
    queryFn: async () => {
      const r = await fetch("/api/services");
      if (!r.ok) throw new Error("Failed to fetch services");
      return r.json();
    },
  });

  // ── Client-side filtering & sorting ──────────────────────────────────
  const artistCats = [
    ServiceCategory.DANCE, ServiceCategory.GRAFFITI, ServiceCategory.BEATBOX,
    ServiceCategory.RAP, ServiceCategory.DJ, ServiceCategory.MUSIC,
    ServiceCategory.THEATER, ServiceCategory.CIRCUS,
  ];
  const athleteCats = [
    ServiceCategory.SKATEBOARDING, ServiceCategory.PARKOUR, ServiceCategory.BMX,
    ServiceCategory.ROLLERBLADING, ServiceCategory.BASKETBALL, ServiceCategory.FOOTBALL,
    ServiceCategory.BOXING, ServiceCategory.MMA, ServiceCategory.CAPOEIRA,
    ServiceCategory.GYMNASTICS, ServiceCategory.FITNESS,
  ];
  const productionCats = [
    ServiceCategory.LIGHTING, ServiceCategory.SOUND, ServiceCategory.STAGE_DESIGN,
    ServiceCategory.PROJECTION, ServiceCategory.PHOTOGRAPHY, ServiceCategory.VIDEOGRAPHY,
    ServiceCategory.EVENT_MANAGEMENT,
  ];

  const filtered = useMemo(() => {
    let list = allServices;

    // AI match filter (show only matched IDs when active)
    if (aiMatches) {
      const ids = new Set(aiMatches.map((m) => m.id));
      list = list.filter((s) => ids.has(s.id));
    }

    // Category group
    if (selectedCategory === "artists")    list = list.filter((s) => artistCats.includes(s.category as any));
    else if (selectedCategory === "athletes") list = list.filter((s) => athleteCats.includes(s.category as any));
    else if (selectedCategory === "production") list = list.filter((s) => productionCats.includes(s.category as any));

    // Type
    if (selectedType) list = list.filter((s) => s.type === selectedType);

    // Skill level
    if (selectedSkill) list = list.filter((s) => s.skillLevel === selectedSkill);

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.category?.toLowerCase().includes(q)
      );
    }

    // Sort
    if (sortKey === "price_asc")  list = [...list].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    if (sortKey === "price_desc") list = [...list].sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    if (sortKey === "newest")     list = [...list].sort((a, b) => b.id - a.id);

    // Sort AI matches by score
    if (aiMatches) {
      const scoreMap = Object.fromEntries(aiMatches.map((m) => [m.id, m.score]));
      list = [...list].sort((a, b) => (scoreMap[b.id] ?? 0) - (scoreMap[a.id] ?? 0));
    }

    return list;
  }, [allServices, selectedCategory, selectedType, selectedSkill, search, sortKey, aiMatches]);

  const matchMap = useMemo(() => {
    if (!aiMatches) return {};
    return Object.fromEntries(aiMatches.map((m) => [m.id, m]));
  }, [aiMatches]);

  const hasFilters = selectedCategory || selectedType || selectedSkill || search || aiMatches;

  const clearAll = () => {
    setCategory(null); setType(null); setSkill(null); setSearch(""); setAiMatches(null);
  };

  // Category tabs
  const cats = [
    { key: null, label: "All" },
    { key: "artists", label: "Artists", emoji: "🎭" },
    { key: "athletes", label: "Athletes", emoji: "🛹" },
    { key: "production", label: "Production", emoji: "🎬" },
  ];

  const types = [
    { key: null, label: "All Types" },
    { key: ServiceType.WORKSHOP, label: "Workshops" },
    { key: ServiceType.PRIVATE_LESSON, label: "Private Lessons" },
    { key: ServiceType.PERFORMANCE, label: "Performances" },
    { key: ServiceType.EVENT_SERVICE, label: "Event Services" },
    { key: ServiceType.TECHNICAL, label: "Technical" },
    { key: ServiceType.CREATIVE_SERVICE, label: "Creative" },
  ];

  const skills = [
    { key: null, label: "All Levels" },
    { key: SkillLevel.BEGINNER, label: "Beginner" },
    { key: SkillLevel.INTERMEDIATE, label: "Intermediate" },
    { key: SkillLevel.ADVANCED, label: "Advanced" },
    { key: SkillLevel.PROFESSIONAL, label: "Professional" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* ── Hero header ──────────────────────────────────────────── */}
      <div className="bg-gradient-to-b from-zinc-900/80 to-background border-b border-border/40 px-4 pt-6 pb-5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Talent Marketplace</h1>
              <p className="text-muted-foreground text-sm mt-1">Book artists, coaches & production crews</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAiPanelOpen(true)}
                className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10 hidden sm:flex"
                data-testid="button-open-ai-match"
              >
                <Sparkles className="w-3.5 h-3.5" /> AI Finder
              </Button>
              {user && (
                <Button size="sm" onClick={() => navigate("/services/create")} className="gap-1.5" data-testid="button-offer-service">
                  <Plus className="w-3.5 h-3.5" /> Offer Service
                </Button>
              )}
            </div>
          </div>

          {/* Stats strip */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
            <span className="flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5 text-primary" />{allServices.length} services listed</span>
            <span className="flex items-center gap-1"><Award className="w-3.5 h-3.5 text-amber-400" />{allServices.filter((s) => s.isVerified).length} verified</span>
            <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-emerald-400" />AI-powered matching</span>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, category, skill…"
              className="pl-9 pr-10 bg-muted/30 border-border/50 h-10"
              data-testid="input-service-search"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-5">
        {/* ── Category tabs ─────────────────────────────────────── */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 mb-4">
          {cats.map(({ key, label, emoji }) => (
            <button
              key={String(key)}
              onClick={() => setCategory(key)}
              className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                selectedCategory === key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
              data-testid={`tab-category-${key ?? "all"}`}
            >
              {emoji && <span>{emoji}</span>} {label}
            </button>
          ))}
        </div>

        {/* ── Filter row ────────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap mb-5">
          {/* Service types */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
            {types.map(({ key, label }) => (
              <Badge
                key={String(key)}
                variant={selectedType === key ? "default" : "outline"}
                className="cursor-pointer shrink-0 text-xs"
                onClick={() => setType(key)}
                data-testid={`badge-type-${key ?? "all"}`}
              >
                {label}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-5">
          {/* Skill levels */}
          {skills.map(({ key, label }) => (
            <Badge
              key={String(key)}
              variant={selectedSkill === key ? "default" : "outline"}
              className="cursor-pointer text-xs"
              onClick={() => setSkill(key)}
              data-testid={`badge-skill-${key ?? "all"}`}
            >
              {label}
            </Badge>
          ))}
        </div>

        {/* ── Toolbar ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {aiMatches ? (
                <span className="flex items-center gap-1 text-primary font-semibold">
                  <Sparkles className="w-3.5 h-3.5" /> {filtered.length} AI match{filtered.length !== 1 ? "es" : ""} found
                </span>
              ) : (
                <>{filtered.length} service{filtered.length !== 1 ? "s" : ""}</>
              )}
            </span>
            {hasFilters && (
              <button onClick={clearAll} className="text-xs text-primary hover:underline flex items-center gap-1">
                <X className="w-3 h-3" /> Clear all
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* AI Finder (mobile) */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAiPanelOpen(true)}
              className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10 sm:hidden"
              data-testid="button-open-ai-match-mobile"
            >
              <Sparkles className="w-3.5 h-3.5" /> AI
            </Button>
            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" data-testid="button-sort">
                  <ArrowUpDown className="w-3 h-3" /> {SORT_LABELS[sortKey]}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                  <DropdownMenuItem key={k} onClick={() => setSortKey(k)} className={sortKey === k ? "text-primary font-semibold" : ""}>
                    {SORT_LABELS[k]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ── Grid ─────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-4">{aiMatches ? "🤖" : "🔍"}</div>
            <h3 className="font-bold mb-2">{aiMatches ? "No AI matches found" : "No services found"}</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
              {aiMatches
                ? "Try a different description or browse all services."
                : "Try adjusting filters or search for something else."}
            </p>
            <Button variant="outline" onClick={clearAll} className="gap-2">
              <Filter className="w-4 h-4" /> Clear filters
            </Button>
          </div>
        ) : (
          <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {filtered.map((service) => (
                <ServiceCard key={service.id} service={service} aiMatch={matchMap[service.id]} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Admin unlock hint */}
        {isAdmin && isLocked && (
          <div className="mt-10 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 flex items-center gap-3">
            <Lock className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="text-sm">
              <span className="font-semibold text-amber-400">Admin view</span>
              <span className="text-muted-foreground"> — Regular users see a "Coming Soon" page. </span>
              <button
                onClick={() => navigate("/admin/feature-settings")}
                className="text-primary hover:underline font-semibold"
                data-testid="link-unlock-marketplace"
              >
                Unlock in Feature Settings →
              </button>
            </div>
          </div>
        )}

        {/* Bottom spacing for mobile nav */}
        <div className="h-[calc(60px+env(safe-area-inset-bottom,0px)+8px)] md:h-6" />
      </div>

      {/* ── AI match panel ──────────────────────────────────────── */}
      <AiMatchPanel
        open={aiPanelOpen}
        onClose={() => setAiPanelOpen(false)}
        services={allServices}
        onResults={(matches) => { setAiMatches(matches); }}
      />
    </div>
  );
}
