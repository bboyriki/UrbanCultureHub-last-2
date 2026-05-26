import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserRole } from "@shared/schema";
import {
  Palette, Music, Mic, Award, Eye, EyeOff,
  Shield, MapPin, Star, Zap, Wind, Headphones, Camera,
} from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ArtistUser {
  id: number;
  displayName: string;
  artType?: string | null;
  profilePicture?: string | null;
  bio?: string | null;
  role: string;
  isHiddenInCommunity?: boolean;
  city?: string | null;
}

// These values MUST match the signup system exactly (SignupForm.tsx ARTIST_TYPES)
const ART_TYPE_CONFIG: Record<string, {
  icon: React.ReactNode;
  label: string;
  gradient: string;
  pill: string;
  filterLabel: string;
  filterIcon: React.ReactNode;
}> = {
  "B-Boy / B-Girl": {
    icon: <Zap className="w-3.5 h-3.5" />,
    label: "B-Boy / B-Girl",
    gradient: "from-yellow-400 via-orange-500 to-red-500",
    pill: "bg-yellow-100 text-yellow-800 border-yellow-200",
    filterLabel: "B-Boy / B-Girl",
    filterIcon: <Zap className="w-3 h-3" />,
  },
  "Graffiti Artist": {
    icon: <Palette className="w-3.5 h-3.5" />,
    label: "Graffiti Artist",
    gradient: "from-orange-500 via-red-500 to-pink-600",
    pill: "bg-orange-100 text-orange-800 border-orange-200",
    filterLabel: "Graffiti",
    filterIcon: <Palette className="w-3 h-3" />,
  },
  "Street Artist / Muralist": {
    icon: <Palette className="w-3.5 h-3.5" />,
    label: "Street Art / Mural",
    gradient: "from-pink-500 via-rose-500 to-red-400",
    pill: "bg-rose-100 text-rose-800 border-rose-200",
    filterLabel: "Street Art",
    filterIcon: <Palette className="w-3 h-3" />,
  },
  "Dancer": {
    icon: <Wind className="w-3.5 h-3.5" />,
    label: "Danser",
    gradient: "from-purple-500 via-fuchsia-500 to-pink-500",
    pill: "bg-purple-100 text-purple-800 border-purple-200",
    filterLabel: "Dancer",
    filterIcon: <Wind className="w-3 h-3" />,
  },
  "DJ / Producer": {
    icon: <Headphones className="w-3.5 h-3.5" />,
    label: "DJ / Producer",
    gradient: "from-blue-500 via-indigo-500 to-violet-600",
    pill: "bg-blue-100 text-blue-800 border-blue-200",
    filterLabel: "DJ / Producer",
    filterIcon: <Headphones className="w-3 h-3" />,
  },
  "Rapper / MC": {
    icon: <Mic className="w-3.5 h-3.5" />,
    label: "Rapper / MC",
    gradient: "from-gray-700 via-gray-600 to-zinc-500",
    pill: "bg-gray-100 text-gray-800 border-gray-200",
    filterLabel: "Rapper / MC",
    filterIcon: <Mic className="w-3 h-3" />,
  },
  "Beatboxer": {
    icon: <Music className="w-3.5 h-3.5" />,
    label: "Beatboxer",
    gradient: "from-teal-500 via-cyan-500 to-blue-400",
    pill: "bg-teal-100 text-teal-800 border-teal-200",
    filterLabel: "Beatboxer",
    filterIcon: <Music className="w-3 h-3" />,
  },
  "Photographer / Videographer": {
    icon: <Camera className="w-3.5 h-3.5" />,
    label: "Fotografie / Film",
    gradient: "from-slate-600 via-slate-500 to-gray-400",
    pill: "bg-slate-100 text-slate-800 border-slate-200",
    filterLabel: "Foto / Film",
    filterIcon: <Camera className="w-3 h-3" />,
  },
};

const DEFAULT_CONFIG = {
  icon: <Star className="w-3.5 h-3.5" />,
  label: "Artist",
  gradient: "from-slate-400 via-gray-400 to-zinc-400",
  pill: "bg-gray-100 text-gray-700 border-gray-200",
};

const getConfig = (artType: string | null | undefined) =>
  (artType && ART_TYPE_CONFIG[artType]) || DEFAULT_CONFIG;

const getInitials = (name: string) =>
  name.split(" ").slice(0, 2).map(n => n[0]?.toUpperCase()).join("");

// ── Artist Card ─────────────────────────────────────────────────────────────
interface ArtistCardProps {
  user: ArtistUser & { tags?: string[]; stats?: { label: string; value: string }[] };
  isAdmin: boolean;
  onToggleVisibility?: (id: number, isHidden: boolean) => void;
}

const ArtistCard = ({ user, isAdmin, onToggleVisibility }: ArtistCardProps) => {
  const isSample = user.id < 0;
  const isHidden = user.isHiddenInCommunity === true;
  const cfg = getConfig(user.artType);
  const initials = getInitials(user.displayName);
  const tags = (user as any).tags as string[] | undefined;
  const stats = (user as any).stats as { label: string; value: string }[] | undefined;

  return (
    <div
      data-testid={`card-artist-${user.id}`}
      className={`group relative bg-white dark:bg-gray-900 rounded-2xl border border-border/60 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col ${isHidden ? "opacity-50" : ""}`}
    >
      {/* Gradient cover */}
      <div className={`h-20 bg-gradient-to-r ${cfg.gradient} relative shrink-0`}>
        {isSample && (
          <span className="absolute top-2 right-2 text-[9px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full backdrop-blur-sm tracking-wide">VOORBEELD</span>
        )}
        {isHidden && (
          <span className="absolute top-2 left-2 text-[9px] font-bold bg-black/30 text-white px-2 py-0.5 rounded-full backdrop-blur-sm flex items-center gap-1">
            <EyeOff className="w-2.5 h-2.5" /> Verborgen
          </span>
        )}
        {isAdmin && !isSample && (
          <div className="absolute top-2 right-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-6 w-6 bg-white/20 hover:bg-white/40 text-white backdrop-blur-sm">
                  <Shield className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onToggleVisibility?.(user.id, !isHidden)}>
                  {isHidden ? <><Eye className="h-4 w-4 mr-2" /> Toon artiest</> : <><EyeOff className="h-4 w-4 mr-2" /> Verberg artiest</>}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Avatar overlapping cover */}
      <div className="px-4 -mt-7 flex items-end justify-between mb-2">
        <Avatar className="h-14 w-14 border-[3px] border-white dark:border-gray-900 shadow-md">
          <AvatarImage src={user.profilePicture || ""} alt={user.displayName} />
          <AvatarFallback className={`bg-gradient-to-br ${cfg.gradient} text-white font-bold text-base`}>
            {initials}
          </AvatarFallback>
        </Avatar>
        {user.role === UserRole.ARTIST && !isSample && (
          <Badge className="mb-1 text-[10px] bg-amber-400 hover:bg-amber-400 text-amber-900 border-0 font-semibold flex items-center gap-0.5 shadow-sm">
            <Award className="w-3 h-3" /> Geverifieerd
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="px-4 pb-4 flex flex-col flex-1 gap-2">
        <div>
          <h3 className="font-bold text-[15px] leading-tight">{user.displayName}</h3>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {user.artType && (
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium border rounded-full px-2 py-0.5 ${cfg.pill}`}>
                {cfg.icon} {cfg.label}
              </span>
            )}
            {user.city && (
              <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
                <MapPin className="w-3 h-3" /> {user.city}
              </span>
            )}
          </div>
        </div>

        <p className="text-[12.5px] text-muted-foreground leading-relaxed line-clamp-2 flex-1">
          {user.bio || "Geen bio beschikbaar."}
        </p>

        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map(tag => (
              <span key={tag} className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full border border-border/60">
                {tag}
              </span>
            ))}
          </div>
        )}

        {stats && stats.length > 0 && (
          <div className="flex gap-4 pt-1 border-t border-border/40">
            {stats.map(s => (
              <div key={s.label}>
                <p className="text-[13px] font-bold leading-none">{s.value}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5 uppercase tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {isSample ? (
          <Button variant="outline" size="sm" className="w-full h-8 text-xs mt-1" disabled>
            Voorbeeldprofiel
          </Button>
        ) : (
          <Link href={`/profile/${user.id}`}>
            <Button
              data-testid={`btn-view-profile-${user.id}`}
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs mt-1 hover:bg-primary/5 hover:border-primary/40"
            >
              Bekijk profiel
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
};

// ── Filter tabs — match signup ARTIST_TYPES 1:1 ─────────────────────────────
const FILTER_TABS = [
  { value: "all", label: "Alle", icon: <Star className="w-3 h-3" /> },
  ...Object.entries(ART_TYPE_CONFIG).map(([value, cfg]) => ({
    value,
    label: cfg.filterLabel,
    icon: cfg.filterIcon,
  })),
];

// ── Sample artists — artType values match signup EXACTLY ────────────────────
const SAMPLE_ARTISTS = [
  {
    id: -1,
    displayName: "Jayden 'Kross' Martina",
    artType: "Graffiti Artist",
    profilePicture: "",
    city: "Amsterdam Noord",
    bio: "Muralist en graffiti-writer met roots in de Amsterdamse underground scene. Bekend van grote publieke werken bij NDSM en de Spaarndammerbuurt.",
    role: UserRole.ARTIST,
    tags: ["Murals", "Legal Walls", "NDSM", "Spray Art"],
    stats: [{ label: "Projecten", value: "34" }, { label: "Steden", value: "8" }],
  },
  {
    id: -2,
    displayName: "Layla Oussama",
    artType: "Dancer",
    profilePicture: "",
    city: "Amsterdam West",
    bio: "House & waacking danseres met een achtergrond in klassiek ballet. Geeft workshops bij Dance Healthy en is vaste act bij urban culture events.",
    role: UserRole.ARTIST,
    tags: ["House Dance", "Waacking", "Workshops", "Choreografie"],
    stats: [{ label: "Events", value: "60+" }, { label: "Volgers", value: "4.2K" }],
  },
  {
    id: -3,
    displayName: "Renzo 'Smoke' van Dijk",
    artType: "B-Boy / B-Girl",
    profilePicture: "",
    city: "Rotterdam",
    bio: "Top 8 finalist op meerdere nationale breakdance battles. Traint jonge breakers via de community. Lid van crew 'Foundation NL'.",
    role: UserRole.ARTIST,
    tags: ["Breaking", "Battles", "Foundation NL", "Coaching"],
    stats: [{ label: "Battle wins", value: "12" }, { label: "Crew", value: "FNL" }],
  },
  {
    id: -4,
    displayName: "DJ Khalil Benali",
    artType: "DJ / Producer",
    profilePicture: "",
    city: "Amsterdam Zuidoost",
    bio: "Producer en DJ gespecialiseerd in Afrobeats, hip-hop en UK garage. Residentie bij Shelter AMS. Produceerde tracks voor artiesten in Nederland en het VK.",
    role: UserRole.ARTIST,
    tags: ["Afrobeats", "Hip-Hop", "UK Garage", "Shelter AMS"],
    stats: [{ label: "Releases", value: "28" }, { label: "Shows/jaar", value: "80+" }],
  },
  {
    id: -5,
    displayName: "Yasmine Aziz",
    artType: "Rapper / MC",
    profilePicture: "",
    city: "Den Haag",
    bio: "Nederlandstalige rapper met scherpe lyrics over identiteit en stedelijk leven. Drie EP's uitgebracht, genomineerd voor de 3FM Award 2024.",
    role: UserRole.ARTIST,
    tags: ["NL Rap", "Spoken Word", "Battles", "3FM Nominated"],
    stats: [{ label: "EP's", value: "3" }, { label: "Streams", value: "250K" }],
  },
  {
    id: -6,
    displayName: "Kevin 'Sketch' Boateng",
    artType: "Street Artist / Muralist",
    profilePicture: "",
    city: "Amsterdam Oost",
    bio: "Gespecialiseerd in portret-murals en typografische straatkunst. Werkte samen met Nike, Red Bull en de gemeente Amsterdam voor publieke kunst-installaties.",
    role: UserRole.ARTIST,
    tags: ["Portret Murals", "Typografie", "Brand Collabs", "Installaties"],
    stats: [{ label: "Murals", value: "47" }, { label: "Collabs", value: "Nike, Red Bull" }],
  },
  {
    id: -7,
    displayName: "Moussa 'Beatmouth' Diallo",
    artType: "Beatboxer",
    profilePicture: "",
    city: "Utrecht",
    bio: "Professioneel beatboxer met optredens op festivals door heel Europa. Workshopleider op middelbare scholen en jongerencentra. Finalist Nederlandse Beatbox Kampioenschap.",
    role: UserRole.ARTIST,
    tags: ["Live Loops", "Freestyle", "Workshops", "Kampioenschap"],
    stats: [{ label: "Optredens", value: "120+" }, { label: "Landen", value: "9" }],
  },
  {
    id: -8,
    displayName: "Nadia Verhagen",
    artType: "Photographer / Videographer",
    profilePicture: "",
    city: "Amsterdam",
    bio: "Documentaire fotografe en videograaf gespecialiseerd in urban culture. Haar werk verscheen in Vice, NRC en op meerdere tentoonstellingen over straatcultuur in Nederland.",
    role: UserRole.ARTIST,
    tags: ["Documentaire", "Urban Culture", "Vice", "Tentoonstellingen"],
    stats: [{ label: "Publicaties", value: "40+" }, { label: "Expo's", value: "6" }],
  },
];

// ── Main component ────────────────────────────────────────────────────────────
const ArtistsView = () => {
  const [currentFilter, setCurrentFilter] = useState("all");
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const { data: artists, isLoading } = useQuery<ArtistUser[]>({
    queryKey: ["/api/users", "artist", isAdmin ? "includeHidden" : ""],
    queryFn: async () => {
      const url = isAdmin ? "/api/users?role=artist&includeHidden=true" : "/api/users?role=artist";
      const r = await fetch(url);
      if (!r.ok) throw new Error("Failed to load artists");
      return r.json();
    },
  });

  const visibilityMutation = useMutation({
    mutationFn: async ({ id, isHidden }: { id: number; isHidden: boolean }) =>
      apiRequest(`/api/users/${id}/visibility`, "POST", { isHidden }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: vars.isHidden ? "Artiest verborgen" : "Artiest zichtbaar",
        description: vars.isHidden ? "Niet zichtbaar in de community" : "Zichtbaar in de community",
      });
    },
    onError: () => toast({ title: "Mislukt", description: "Kon zichtbaarheid niet aanpassen", variant: "destructive" }),
  });

  const realArtists: ArtistUser[] = artists || [];
  const showSamples = realArtists.length === 0;

  const applyFilter = <T extends { artType?: string | null }>(list: T[]): T[] => {
    if (currentFilter === "all") return list;
    return list.filter(a => a.artType === currentFilter);
  };

  const displayList = applyFilter(showSamples ? SAMPLE_ARTISTS as unknown as ArtistUser[] : realArtists);

  // Count per type for real artists badge
  const countByType = (artType: string) =>
    realArtists.filter(a => a.artType === artType).length;

  return (
    <div className="space-y-4">
      {/* Filter pills — one per signup category */}
      <div className="flex gap-1.5 flex-wrap">
        {FILTER_TABS.map(tab => {
          const count = tab.value === "all" ? realArtists.length : countByType(tab.value);
          const active = currentFilter === tab.value;
          return (
            <button
              key={tab.value}
              data-testid={`filter-artists-${tab.value}`}
              onClick={() => setCurrentFilter(tab.value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all ${
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-white dark:bg-gray-900 text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
              {!showSamples && count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Result count */}
      {!isLoading && (
        <p className="text-[12px] text-muted-foreground">
          {showSamples
            ? `${displayList.length} voorbeeldprofielen — echte artiesten verschijnen hier zodra ze zich aanmelden`
            : `${displayList.length} ${displayList.length === 1 ? "artiest" : "artiesten"}${currentFilter !== "all" ? ` in categorie "${ART_TYPE_CONFIG[currentFilter]?.filterLabel || currentFilter}"` : ""}`}
        </p>
      )}

      {/* Cards grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/40 bg-white dark:bg-gray-900 overflow-hidden animate-pulse">
              <div className="h-20 bg-gray-200 dark:bg-gray-700" />
              <div className="p-4 space-y-3 mt-5">
                <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-3 w-full bg-gray-100 dark:bg-gray-800 rounded" />
                <div className="h-3 w-3/4 bg-gray-100 dark:bg-gray-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : displayList.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-2xl border border-border/60">
          <Palette className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Geen artiesten gevonden</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Probeer een ander filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayList.map(artist => (
            <ArtistCard
              key={artist.id}
              user={artist as any}
              isAdmin={isAdmin}
              onToggleVisibility={(id, isHidden) => visibilityMutation.mutate({ id, isHidden })}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ArtistsView;
