import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sparkles, MapPin, Clock, Globe, ChevronRight, ChevronLeft,
  Loader2, RotateCcw, Star, Navigation, Award, X, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PlaceFinderModalProps {
  open: boolean;
  onClose: () => void;
  onSelectPlace?: (place: Recommendation) => void;
  mapCenter?: { lat: number; lng: number };
}

interface Recommendation {
  id?: string;
  name: string;
  category: string;
  address?: string;
  reason: string;
  matchScore?: number;
  opening_hours?: string;
  website?: string;
  highlights?: string[];
  lat?: number;
  lon?: number;
  isFeatured?: boolean;
}

// ─── Category definitions ─────────────────────────────────────────────────────
interface CategoryDef {
  label: string;
  emoji: string;
  color: string;
  gradient: string;
  border: string;
  description: string;
}

const CATEGORIES: Record<string, CategoryDef> = {
  café:          { label: "Café",           emoji: "☕", color: "#D97706", gradient: "from-amber-500/20 to-yellow-500/10",   border: "border-amber-500/30",   description: "Koffie, werken, chill" },
  restaurant:    { label: "Restaurant",     emoji: "🍽️", color: "#EF4444", gradient: "from-red-500/20 to-orange-500/10",    border: "border-red-500/30",     description: "Eten & drinken" },
  bar:           { label: "Bar",            emoji: "🍺", color: "#6366F1", gradient: "from-indigo-500/20 to-purple-500/10", border: "border-indigo-500/30",  description: "Drank & gezelligheid" },
  club:          { label: "Club",           emoji: "🎉", color: "#EC4899", gradient: "from-pink-500/20 to-rose-500/10",     border: "border-pink-500/30",    description: "Nachtleven" },
  music_venue:   { label: "Music Venue",    emoji: "🎵", color: "#3B82F6", gradient: "from-blue-500/20 to-cyan-500/10",    border: "border-blue-500/30",    description: "Live muziek & events" },
  gallery:       { label: "Gallery / Art",  emoji: "🎨", color: "#8B5CF6", gradient: "from-violet-500/20 to-purple-500/10",border: "border-violet-500/30",  description: "Kunst & cultuur" },
  museum:        { label: "Museum",         emoji: "🏛️", color: "#A855F7", gradient: "from-purple-500/20 to-fuchsia-500/10",border: "border-purple-500/30", description: "Musea & exposities" },
  skate_spot:    { label: "Skate Spot",     emoji: "🛹", color: "#10B981", gradient: "from-emerald-500/20 to-green-500/10", border: "border-emerald-500/30", description: "Skaten & tricks" },
  dance_studio:  { label: "Dance Studio",   emoji: "💃", color: "#F43F5E", gradient: "from-rose-500/20 to-pink-500/10",    border: "border-rose-500/30",    description: "Dans & beweging" },
  community:     { label: "Community Space",emoji: "🤝", color: "#0EA5E9", gradient: "from-sky-500/20 to-cyan-500/10",     border: "border-sky-500/30",     description: "Gemeenschap & events" },
  outdoor:       { label: "Outdoor",        emoji: "🌳", color: "#22C55E", gradient: "from-green-500/20 to-lime-500/10",   border: "border-green-500/30",   description: "Buiten & natuur" },
  any:           { label: "Verrassing",     emoji: "✨", color: "#F59E0B", gradient: "from-yellow-500/20 to-amber-500/10", border: "border-yellow-500/30",  description: "Verras me!" },
};

const CATEGORY_LIST = Object.entries(CATEGORIES);

// ─── Step option type ─────────────────────────────────────────────────────────
interface StepOption { value: string; label: string; emoji: string; desc?: string }
interface StepConfig {
  key: string;
  title: string;
  subtitle: string;
  multi: boolean;
  options: StepOption[];
  layout?: "grid" | "list" | "time";
}

// ─── Time options (shared) ────────────────────────────────────────────────────
const TIME_OPTIONS: StepOption[] = [
  { value: "morning",    label: "Ochtend",    emoji: "🌅", desc: "8:00 – 12:00"  },
  { value: "afternoon",  label: "Middag",     emoji: "☀️", desc: "12:00 – 17:00" },
  { value: "evening",    label: "Avond",      emoji: "🌇", desc: "17:00 – 22:00" },
  { value: "late_night", label: "Nachtleven", emoji: "🌙", desc: "22:00+"         },
  { value: "anytime",    label: "Altijd",     emoji: "🕐", desc: "Flexibel"       },
];

// ─── Category-specific step flows ─────────────────────────────────────────────
const FLOWS: Record<string, StepConfig[]> = {
  café: [
    {
      key: "vibe", title: "Wat zoek je in een café?", subtitle: "Kies wat voor jou het meest telt", multi: true, layout: "grid",
      options: [
        { value: "specialty_coffee", label: "Specialty koffie",    emoji: "☕", desc: "Ambachtelijk" },
        { value: "work_wifi",        label: "Werken & WiFi",       emoji: "💻", desc: "Rustig & focusvriendelijk" },
        { value: "cozy_quiet",       label: "Gezellig & rustig",   emoji: "🕯️", desc: "Intiem en stil" },
        { value: "social_lively",    label: "Sociaal & levendig",  emoji: "🗣️", desc: "Druk en energiek" },
        { value: "brunch_food",      label: "Brunch & eten",       emoji: "🍳", desc: "Goed menu" },
        { value: "outdoor_terrace",  label: "Terras & buiten",     emoji: "🌿", desc: "Buitenlucht" },
        { value: "hidden_gem",       label: "Hidden gem",          emoji: "💎", desc: "Niet toeristisch" },
        { value: "budget_friendly",  label: "Budget-vriendelijk",  emoji: "💶", desc: "Voordelig" },
      ],
    },
    { key: "time", title: "Wanneer ga je?", subtitle: "Helpt ons de openingstijden matchen", multi: false, layout: "time", options: TIME_OPTIONS },
  ],

  restaurant: [
    {
      key: "cuisine", title: "Keuken & dieet?", subtitle: "Wat wil je eten?", multi: true, layout: "grid",
      options: [
        { value: "halal",           label: "Halal",             emoji: "🌙" },
        { value: "vegan",           label: "Vegan / vegetarisch",emoji: "🥗" },
        { value: "asian",           label: "Aziatisch",         emoji: "🍜" },
        { value: "mediterranean",   label: "Mediterraans",      emoji: "🫒" },
        { value: "dutch_local",     label: "Nederlands / lokaal",emoji: "🇳🇱" },
        { value: "pizza_italian",   label: "Pizza / Italiaans",  emoji: "🍕" },
        { value: "burger_american", label: "Burger / American",  emoji: "🍔" },
        { value: "anything",        label: "Maakt niet uit",     emoji: "✨" },
      ],
    },
    {
      key: "setting", title: "Setting & sfeer?", subtitle: "Wat voor gelegenheid is het?", multi: false, layout: "list",
      options: [
        { value: "casual",       label: "Casual & ontspannen",   emoji: "😌", desc: "Lekker informeel" },
        { value: "date_night",   label: "Romantisch (date)",     emoji: "💫", desc: "Sfeervol & intiem" },
        { value: "family",       label: "Familiediner",          emoji: "👨‍👩‍👧", desc: "Gezinsvriendelijk" },
        { value: "groups",       label: "Groep vrienden",        emoji: "🎉", desc: "Luid & gezellig" },
        { value: "quick_lunch",  label: "Snelle lunch",          emoji: "⏱️", desc: "Snel en lekker" },
        { value: "special_event",label: "Speciale gelegenheid",  emoji: "🥂", desc: "Iets bijzonders" },
      ],
    },
    { key: "time", title: "Wanneer ga je?", subtitle: "Lunch, diner of late night?", multi: false, layout: "time", options: TIME_OPTIONS },
  ],

  museum: [
    {
      key: "theme", title: "Type museum?", subtitle: "Wat trekt jou aan?", multi: true, layout: "grid",
      options: [
        { value: "modern_contemporary", label: "Moderne kunst",     emoji: "🖼️", desc: "Hedendaags" },
        { value: "history_culture",     label: "Geschiedenis",      emoji: "📜", desc: "Erfgoed & cultuur" },
        { value: "urban_street_art",    label: "Street art / Urban",emoji: "✍️", desc: "Graffiti & urban" },
        { value: "design_architecture", label: "Design & architectuur",emoji: "📐" },
        { value: "photography",         label: "Fotografie",        emoji: "📸" },
        { value: "science_tech",        label: "Wetenschap",        emoji: "🔬" },
        { value: "film_media",          label: "Film & media",      emoji: "🎬" },
        { value: "local_hidden",        label: "Lokale verborgen gem",emoji: "💎", desc: "Niet mainstream" },
      ],
    },
    {
      key: "experience", title: "Type bezoek?", subtitle: "Hoe wil je het beleven?", multi: true, layout: "grid",
      options: [
        { value: "quiet_solo",       label: "Rustig & solo",      emoji: "🧘", desc: "Contemplatie" },
        { value: "interactive",      label: "Interactief",        emoji: "✋", desc: "Hands-on" },
        { value: "guided_tour",      label: "Rondleiding",        emoji: "🎤", desc: "Met gids" },
        { value: "free_entry",       label: "Gratis entree",      emoji: "🎟️" },
        { value: "tourist_friendly", label: "Toerist-vriendelijk",emoji: "🗺️" },
        { value: "local_vibe",       label: "Lokale sfeer",       emoji: "🏘️", desc: "Zoals de locals" },
      ],
    },
    { key: "time", title: "Wanneer?", subtitle: "Openingstijden matchen", multi: false, layout: "time", options: TIME_OPTIONS },
  ],

  dance_studio: [
    {
      key: "style", title: "Dans stijl?", subtitle: "Wat ga je beoefenen?", multi: true, layout: "grid",
      options: [
        { value: "hiphop_breaking",  label: "Hip-hop / Breaking", emoji: "💥", desc: "Bboy / Bgirl" },
        { value: "house_footwork",   label: "House / Footwork",   emoji: "🕺" },
        { value: "popping_locking",  label: "Popping / Locking",  emoji: "🤖" },
        { value: "dancehall_afro",   label: "Dancehall / Afro",   emoji: "🌍" },
        { value: "all_styles",       label: "Alle stijlen",       emoji: "🌈", desc: "Open voor alles" },
        { value: "freestyle",        label: "Freestyle cipher",   emoji: "🔄" },
      ],
    },
    {
      key: "format", title: "Wat voor sessie?", subtitle: "Format & niveau", multi: false, layout: "list",
      options: [
        { value: "drop_in",     label: "Drop-in klas",        emoji: "🚪", desc: "Gewoon binnenwandelen" },
        { value: "open_jam",    label: "Open jam / cipher",   emoji: "🔄", desc: "Freestyle met anderen" },
        { value: "beginner",    label: "Beginnersles",        emoji: "🟢", desc: "Nieuw begin" },
        { value: "advanced",    label: "Gevorderd",           emoji: "🔴", desc: "Serieus niveau" },
        { value: "workshop",    label: "Workshop / intensief",emoji: "📚", desc: "Dieper leren" },
        { value: "training",    label: "Solo training",       emoji: "🏋️", desc: "Zelf trainen" },
      ],
    },
    { key: "time", title: "Wanneer?", subtitle: "Ochtend, middag of avond?", multi: false, layout: "time", options: TIME_OPTIONS },
  ],

  music_venue: [
    {
      key: "genre", title: "Genre & scene?", subtitle: "Welke muziek past bij jou?", multi: true, layout: "grid",
      options: [
        { value: "hiphop_rap",       label: "Hip-Hop / Rap",       emoji: "🎤" },
        { value: "techno_electronic",label: "Techno / Electronic",  emoji: "🎛️" },
        { value: "jazz_soul",        label: "Jazz / Soul",          emoji: "🎷" },
        { value: "rnb",              label: "R&B",                  emoji: "🎶" },
        { value: "live_bands",       label: "Live bands",           emoji: "🎸" },
        { value: "drum_bass",        label: "Drum & Bass",          emoji: "🥁" },
        { value: "afro_dancehall",   label: "Afro / Dancehall",     emoji: "🌍" },
        { value: "open_mic",         label: "Open mic / spoken",    emoji: "🎙️" },
      ],
    },
    {
      key: "format", title: "Type event?", subtitle: "Wat past bij je mood?", multi: false, layout: "list",
      options: [
        { value: "club_night",     label: "Club night",          emoji: "🎉", desc: "Dansen tot laat" },
        { value: "live_concert",   label: "Live concert",        emoji: "🎤", desc: "Performer op het podium" },
        { value: "open_mic_night", label: "Open mic avond",      emoji: "🎙️", desc: "Zelf optreden" },
        { value: "jam_session",    label: "Jam sessie",          emoji: "🎵", desc: "Muzikanten samen" },
        { value: "intimate_gig",   label: "Intiem optreden",     emoji: "🕯️", desc: "Klein & cozy" },
        { value: "daytime_event",  label: "Daytime event",       emoji: "☀️", desc: "Overdag genieten" },
      ],
    },
    { key: "time", title: "Wanneer ga je?", subtitle: "Avond of late night?", multi: false, layout: "time", options: TIME_OPTIONS },
  ],

  gallery: [
    {
      key: "art_type", title: "Type kunst?", subtitle: "Wat wil je zien?", multi: true, layout: "grid",
      options: [
        { value: "street_graffiti",  label: "Street art",         emoji: "🎨", desc: "Urban & graffiti" },
        { value: "contemporary",     label: "Hedendaags",         emoji: "🖼️" },
        { value: "photography",      label: "Fotografie",         emoji: "📸" },
        { value: "interactive_art",  label: "Interactief",        emoji: "✋" },
        { value: "local_artists",    label: "Lokale kunstenaars", emoji: "🏘️" },
        { value: "urban_culture",    label: "Urban cultuur",      emoji: "🏙️" },
        { value: "digital_art",      label: "Digitale kunst",     emoji: "💻" },
        { value: "free_entry",       label: "Gratis entree",      emoji: "🎟️" },
      ],
    },
    {
      key: "vibe", title: "Sfeer?", subtitle: "Hoe wil je de kunst beleven?", multi: false, layout: "list",
      options: [
        { value: "quiet_contemplative", label: "Rustig & contemplatief", emoji: "🧘", desc: "Diep kijken" },
        { value: "vibrant_social",      label: "Levendig & sociaal",     emoji: "🗣️", desc: "Opening night energie" },
        { value: "educational",         label: "Educatief",              emoji: "📚", desc: "Leren & begrijpen" },
        { value: "underground",         label: "Underground",            emoji: "🔥", desc: "Avant-garde & rauw" },
      ],
    },
    { key: "time", title: "Wanneer?", subtitle: "Openingstijden matchen", multi: false, layout: "time", options: TIME_OPTIONS },
  ],

  skate_spot: [
    {
      key: "setup", title: "Welk setup?", subtitle: "Wat past bij jouw sessie?", multi: true, layout: "grid",
      options: [
        { value: "street_ledges",  label: "Street / ledges",  emoji: "🏙️", desc: "Urban street" },
        { value: "park_bowl",      label: "Park / bowl",      emoji: "🏄", desc: "Skateboard park" },
        { value: "indoor",         label: "Indoor",           emoji: "🏛️", desc: "Overdekt" },
        { value: "smooth_ground",  label: "Glad oppervlak",   emoji: "🛹" },
        { value: "rails_gaps",     label: "Rails & gaps",     emoji: "⚡" },
        { value: "banks",          label: "Banks & embankments",emoji: "🌊" },
      ],
    },
    {
      key: "level", title: "Jouw niveau?", subtitle: "Zodat we de beste spot vinden", multi: false, layout: "list",
      options: [
        { value: "beginner",       label: "Beginner",         emoji: "🟢", desc: "Net begonnen" },
        { value: "intermediate",   label: "Intermediate",     emoji: "🟡", desc: "Groeiend" },
        { value: "advanced",       label: "Gevorderd",        emoji: "🔴", desc: "Serieuze tricks" },
        { value: "night_session",  label: "Night session",    emoji: "🌙", desc: "Late avond" },
        { value: "crew_session",   label: "Crew sessie",      emoji: "👥", desc: "Met een groep" },
      ],
    },
    { key: "time", title: "Wanneer?", subtitle: "Dag of nacht sessie?", multi: false, layout: "time", options: TIME_OPTIONS },
  ],

  bar: [
    {
      key: "vibe", title: "Bar vibe?", subtitle: "Wat voor sfeer zoek je?", multi: true, layout: "grid",
      options: [
        { value: "craft_beer",     label: "Craft beer",       emoji: "🍺", desc: "Bijzonder bier" },
        { value: "cocktail_bar",   label: "Cocktails",        emoji: "🍹" },
        { value: "wine_bar",       label: "Wijnbar",          emoji: "🍷" },
        { value: "sports_bar",     label: "Sports bar",       emoji: "⚽" },
        { value: "brown_cafe",     label: "Bruin café",       emoji: "☕", desc: "Typisch Nederlands" },
        { value: "rooftop",        label: "Rooftop bar",      emoji: "🌆" },
        { value: "underground",    label: "Underground / cool",emoji: "🔥" },
        { value: "chill_lounge",   label: "Chill lounge",     emoji: "😌" },
      ],
    },
    {
      key: "crowd", title: "Wat voor publiek?", subtitle: "Sfeer & mensen", multi: false, layout: "list",
      options: [
        { value: "local_regulars",   label: "Locals & vaste gasten", emoji: "🏘️", desc: "Authentiek" },
        { value: "young_creative",   label: "Jong & creatief",       emoji: "🎨", desc: "Kunstenaars & studenten" },
        { value: "mixed_crowd",      label: "Gemengd gezelschap",    emoji: "🌍", desc: "Iedereen welkom" },
        { value: "urban_hiphop",     label: "Urban / hip-hop crowd", emoji: "🎤" },
        { value: "intimate_small",   label: "Intiem & klein",        emoji: "🕯️", desc: "Rustig & gezellig" },
      ],
    },
    { key: "time", title: "Wanneer ga je?", subtitle: "", multi: false, layout: "time", options: TIME_OPTIONS },
  ],

  club: [
    {
      key: "music", title: "Muziek in de club?", subtitle: "Wat wil je horen?", multi: true, layout: "grid",
      options: [
        { value: "hiphop_rnb",      label: "Hip-Hop / R&B",    emoji: "🎤" },
        { value: "techno_house",    label: "Techno / House",   emoji: "🎛️" },
        { value: "afrobeats",       label: "Afrobeats",        emoji: "🌍" },
        { value: "drum_bass",       label: "Drum & Bass",      emoji: "🥁" },
        { value: "urban_mixed",     label: "Urban mixed",      emoji: "🎵" },
        { value: "anything_good",   label: "Alles goed",       emoji: "✨" },
      ],
    },
    {
      key: "vibe", title: "Club vibe?", subtitle: "Type nacht", multi: false, layout: "list",
      options: [
        { value: "underground",  label: "Underground",        emoji: "🔥", desc: "Raw & authentiek" },
        { value: "mainstream",   label: "Mainstream / pop",   emoji: "🎊", desc: "Bekend & feestelijk" },
        { value: "intimate",     label: "Intiem & klein",     emoji: "🕯️", desc: "Niet te druk" },
        { value: "big_energy",   label: "Groot & energiek",   emoji: "⚡", desc: "Max energie" },
        { value: "lgbtq_friendly",label: "LGBTQ+ friendly",   emoji: "🌈" },
      ],
    },
    { key: "time", title: "Wanneer?", subtitle: "Late night check", multi: false, layout: "time", options: TIME_OPTIONS },
  ],

  community: [
    {
      key: "activity", title: "Wat zoek je?", subtitle: "Type activiteit of ruimte", multi: true, layout: "grid",
      options: [
        { value: "events",         label: "Events & programma", emoji: "📅" },
        { value: "workspace",      label: "Werkruimte",         emoji: "💻" },
        { value: "workshops",      label: "Workshops",          emoji: "🛠️" },
        { value: "youth_space",    label: "Jongerenruimte",     emoji: "🧒" },
        { value: "cultural",       label: "Cultureel centrum",  emoji: "🌍" },
        { value: "urban_culture",  label: "Urban culture hub",  emoji: "🎤" },
        { value: "social_impact",  label: "Social impact",      emoji: "❤️" },
        { value: "free_access",    label: "Gratis toegang",     emoji: "🎟️" },
      ],
    },
    { key: "time", title: "Wanneer?", subtitle: "Dag of avond?", multi: false, layout: "time", options: TIME_OPTIONS },
  ],

  outdoor: [
    {
      key: "activity", title: "Wat wil je doen?", subtitle: "Type buitenactiviteit", multi: true, layout: "grid",
      options: [
        { value: "sport_courts",   label: "Sport courts",      emoji: "⚽", desc: "Basketbal, voetbal" },
        { value: "skateboarding",  label: "Skaten",            emoji: "🛹" },
        { value: "relaxing",       label: "Relaxen",           emoji: "🌿", desc: "Park & rust" },
        { value: "events",         label: "Outdoor events",    emoji: "🎪" },
        { value: "training",       label: "Outdoor training",  emoji: "🏃" },
        { value: "graffiti_wall",  label: "Graffiti wall",     emoji: "✍️", desc: "Legal wall" },
        { value: "urban_beach",    label: "Urban strand",      emoji: "🏖️" },
        { value: "nature_park",    label: "Park & natuur",     emoji: "🌳" },
      ],
    },
    { key: "time", title: "Wanneer?", subtitle: "Overdag of 's avonds?", multi: false, layout: "time", options: TIME_OPTIONS },
  ],

  any: [
    {
      key: "mood", title: "Je mood?", subtitle: "Wat zoek je vandaag?", multi: true, layout: "grid",
      options: [
        { value: "chill",       label: "Chill & relaxed",     emoji: "😌" },
        { value: "high_energy", label: "High energy",         emoji: "⚡" },
        { value: "underground", label: "Underground",         emoji: "🔥" },
        { value: "authentic",   label: "Authentiek & lokaal", emoji: "🏘️" },
        { value: "creative",    label: "Creatief",            emoji: "🎨" },
        { value: "hiphop",      label: "Hip-Hop cultuur",     emoji: "🎤" },
        { value: "cultural",    label: "Cultureel",           emoji: "🌍" },
        { value: "social",      label: "Sociaal",             emoji: "🤝" },
      ],
    },
    { key: "time", title: "Wanneer?", subtitle: "Helpt ons matchen", multi: false, layout: "time", options: TIME_OPTIONS },
  ],
};

const GENERIC_FLOW: StepConfig[] = [
  {
    key: "vibe", title: "Welke sfeer zoek je?", subtitle: "Kies alles wat past — voor alle typen", multi: true, layout: "grid",
    options: [
      { value: "chill",       label: "Chill & rustig",      emoji: "😌", desc: "Ontspannen sfeer" },
      { value: "high_energy", label: "High energy",         emoji: "⚡", desc: "Vol leven & actie" },
      { value: "underground", label: "Underground",         emoji: "🔥", desc: "Off the radar" },
      { value: "authentic",   label: "Authentiek & lokaal", emoji: "🏘️", desc: "Geen toeristenspoelen" },
      { value: "creative",    label: "Creatief",            emoji: "🎨", desc: "Kunst & expressie" },
      { value: "hiphop",      label: "Hip-Hop cultuur",     emoji: "🎤", desc: "Breaking, graffiti, rap" },
      { value: "social",      label: "Sociaal",             emoji: "🤝", desc: "Mensen & connectie" },
      { value: "hidden_gem",  label: "Hidden gem",         emoji: "💎", desc: "Niet bekend bij iedereen" },
    ],
  },
  {
    key: "crowd", title: "Wat voor scene?", subtitle: "Wie kom je er graag tegen?", multi: true, layout: "list",
    options: [
      { value: "local_scene",  label: "Lokale scene — mensen van de straat",  emoji: "🏙️", desc: "Underground, niet commercieel" },
      { value: "creative_crowd", label: "Creatieven & kunstenaars",           emoji: "🎨", desc: "Ateliers, galeries, makers" },
      { value: "mixed",        label: "Mix — iedereen welkom",                emoji: "🌈", desc: "Divers en open" },
      { value: "dontcare",     label: "Maakt me niet uit",                    emoji: "✌️", desc: "Gewoon een goeie plek" },
    ],
  },
  { key: "time", title: "Wanneer ga je?", subtitle: "Helpt ons de openingstijden matchen", multi: false, layout: "time", options: TIME_OPTIONS },
];

// ─── Category gradient lookup ─────────────────────────────────────────────────
const categoryGrad: Record<string, string> = {
  dance: "from-rose-500 to-pink-600", dance_studio: "from-rose-500 to-pink-600",
  music: "from-blue-500 to-indigo-600", music_venue: "from-blue-500 to-indigo-600",
  skate: "from-emerald-500 to-green-600", skate_spot: "from-emerald-500 to-green-600",
  art: "from-violet-500 to-purple-600", gallery: "from-violet-500 to-purple-600",
  museum: "from-purple-500 to-fuchsia-600",
  community: "from-sky-500 to-cyan-600",
  café: "from-amber-500 to-yellow-600", restaurant: "from-red-500 to-orange-500",
  bar: "from-indigo-500 to-purple-600", club: "from-pink-500 to-rose-600",
  outdoor: "from-green-500 to-lime-600",
};
const catEmoji: Record<string, string> = {
  dance: "💃", dance_studio: "💃", music: "🎵", music_venue: "🎵",
  skate: "🛹", skate_spot: "🛹", art: "🎨", gallery: "🎨",
  museum: "🏛️", community: "🤝", café: "☕", restaurant: "🍽️",
  bar: "🍺", club: "🎉", outdoor: "🌳", other: "📍",
};

// ─── Mini components ──────────────────────────────────────────────────────────
function CategoryCard({ def, catKey, selected, onClick }: { def: CategoryDef; catKey: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={cn(
        "relative flex flex-col items-center justify-center gap-1 p-2 rounded-xl border-2 transition-all duration-200 select-none overflow-hidden",
        selected
          ? `bg-gradient-to-br ${def.gradient} ${def.border} shadow-md scale-[1.04]`
          : "bg-muted/25 dark:bg-muted/10 border-border/40 active:scale-[0.97] active:bg-muted/50"
      )}
      style={{ minHeight: "68px" }}
    >
      {selected && (
        <div className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center"
          style={{ background: def.color }}>
          <Check className="w-2 h-2 text-white" strokeWidth={3.5} />
        </div>
      )}
      <span className="text-xl leading-none">{def.emoji}</span>
      <span className="text-[10px] font-bold text-center leading-tight mt-0.5" style={selected ? { color: def.color } : {}}>
        {def.label}
      </span>
    </button>
  );
}

function OptionGrid({ opt, selected, onClick }: { opt: StepOption; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={cn(
        "relative flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all duration-150 select-none",
        selected
          ? "bg-primary/15 border-primary shadow-sm scale-[1.03]"
          : "bg-muted/25 dark:bg-muted/10 border-border/40 active:scale-[0.97] active:bg-muted/50"
      )}
      style={{ minHeight: "64px" }}
    >
      {selected && (
        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
          <Check className="w-2 h-2 text-primary-foreground" strokeWidth={3.5} />
        </div>
      )}
      <span className="text-xl leading-none">{opt.emoji}</span>
      <span className={cn("text-[10px] font-bold text-center leading-tight mt-0.5", selected && "text-primary")}>{opt.label}</span>
    </button>
  );
}

function OptionList({ opt, selected, onClick }: { opt: StepOption; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={cn(
        "relative w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border-2 transition-all duration-150 select-none text-left",
        selected
          ? "bg-primary/12 border-primary shadow-sm"
          : "bg-muted/25 dark:bg-muted/10 border-border/40 hover:border-border hover:bg-muted/40"
      )}
    >
      {selected && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
          <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />
        </div>
      )}
      <span className="text-2xl shrink-0">{opt.emoji}</span>
      <div className="pr-6 min-w-0">
        <p className={cn("font-bold text-[13px]", selected && "text-primary")}>{opt.label}</p>
        {opt.desc && <p className="text-[11px] text-muted-foreground">{opt.desc}</p>}
      </div>
    </button>
  );
}

function TimeCard({ opt, selected, onClick }: { opt: StepOption; selected: boolean; onClick: () => void }) {
  const colors: Record<string, string> = {
    morning: "#F59E0B", afternoon: "#EF4444", evening: "#8B5CF6",
    late_night: "#1E40AF", anytime: "#6B7280",
  };
  const c = colors[opt.value] || "#6B7280";
  return (
    <button type="button" onClick={onClick}
      className={cn(
        "flex items-center gap-4 px-5 py-3.5 rounded-2xl border-2 transition-all duration-200 select-none text-left w-full",
        selected ? "shadow-sm scale-[1.01]" : "bg-muted/25 dark:bg-muted/10 border-border/40 hover:border-border hover:bg-muted/40"
      )}
      style={selected ? { borderColor: c, background: `${c}12` } : {}}
    >
      <span className="text-2xl shrink-0">{opt.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-[13px]" style={selected ? { color: c } : {}}>{opt.label}</p>
        {opt.desc && <p className="text-[11px] text-muted-foreground">{opt.desc}</p>}
      </div>
      {selected && (
        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: c }}>
          <Check className="w-3 h-3 text-white" strokeWidth={3} />
        </div>
      )}
    </button>
  );
}

function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex gap-2 items-center">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={cn("rounded-full transition-all duration-300",
          i === current ? "w-8 h-2 bg-primary" : i < current ? "w-2 h-2 bg-primary/50" : "w-2 h-2 bg-muted-foreground/20"
        )} />
      ))}
    </div>
  );
}

function AILoadingScreen({ city, categories }: { city?: string | null; categories?: string[] }) {
  const [step, setStep] = useState(0);
  const cityLabel = city ? `in ${city}` : "in Nederland";
  const isMulti = (categories?.length ?? 0) > 1;
  const catLabel = isMulti
    ? `${categories!.length} categorieën`
    : categories?.[0]
      ? (CATEGORIES[categories[0]]?.label ?? categories[0])
      : "spots";

  const steps = isMulti ? [
    { icon: "📡", text: `36.000+ spots ophalen ${cityLabel}…` },
    { icon: "🔀", text: `${catLabel} apart doorzoeken…` },
    { icon: "🔍", text: "Sfeer & scene-voorkeuren analyseren…" },
    { icon: "🤖", text: `AI matcht authentieke spots per categorie…` },
    { icon: "✨", text: "Beste mix rangschikken voor jou…" },
  ] : [
    { icon: "📡", text: `36.000+ spots ophalen ${cityLabel}…` },
    { icon: "🔍", text: `${catLabel}-spots selecteren & analyseren…` },
    { icon: "🗺️", text: `Dichtstbijzijnde candidates filteren…` },
    { icon: "🤖", text: "AI matcht jouw vibe & voorkeuren…" },
    { icon: "✨", text: "Resultaten rangschikken op match…" },
  ];

  useEffect(() => {
    const iv = setInterval(() => setStep(s => Math.min(s + 1, steps.length - 1)), 1800);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-10 space-y-6">
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-full border-4 border-primary/10" />
        <div className="absolute inset-0 rounded-full border-4 border-primary/30 border-t-primary animate-spin" style={{ animationDuration: "1.2s" }} />
        <div className="absolute inset-2 rounded-full border-4 border-primary/10 border-t-primary/50 animate-spin" style={{ animationDuration: "0.9s", animationDirection: "reverse" }} />
        <div className="absolute inset-0 flex items-center justify-center text-xl animate-pulse">{steps[step].icon}</div>
      </div>
      <div className="text-center space-y-1 px-4">
        <p className="font-black text-base">{isMulti ? `Zoeken in ${catLabel}` : "Perfecte spot zoeken"}</p>
        <p className="text-[11px] text-muted-foreground animate-pulse">{steps[step].text}</p>
        {isMulti && (
          <div className="flex flex-wrap gap-1 justify-center mt-2">
            {categories!.map(c => (
              <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {CATEGORIES[c]?.emoji} {CATEGORIES[c]?.label ?? c}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5 w-full max-w-xs">
        {steps.map((s, i) => (
          <div key={i} className={cn(
            "flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs transition-all duration-300",
            i < step  ? "bg-primary/10 border border-primary/20 text-primary" :
            i === step ? "bg-primary/15 border border-primary/30 text-primary font-bold shadow-sm scale-[1.01]" :
            "bg-muted/20 border border-border/30 text-muted-foreground/40"
          )}>
            <span className="shrink-0">{s.icon}</span>
            <span className="flex-1 leading-tight">{s.text.replace("…", "")}</span>
            {i < step  && <Check className="w-3 h-3 shrink-0" />}
            {i === step && <Loader2 className="w-3 h-3 animate-spin shrink-0" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultCard({ r, i, onShowOnMap }: { r: Recommendation; i: number; onShowOnMap: () => void }) {
  const grad = categoryGrad[r.category?.toLowerCase()] || "from-primary to-primary/60";
  const emoji = catEmoji[r.category?.toLowerCase()] || "📍";
  const isTop = i === 0;

  return (
    <div
      className={cn(
        "rounded-2xl border overflow-hidden transition-all duration-200",
        isTop
          ? "border-primary/35 shadow-md shadow-primary/8 ring-1 ring-primary/15"
          : "border-border/60 hover:border-border hover:shadow-sm"
      )}
      data-testid={`place-result-${i}`}
    >
      {/* Top gradient bar */}
      <div className={cn("h-1 w-full bg-gradient-to-r", grad)} />

      <div className="p-4">
        {/* Row 1: icon + name + map button */}
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={cn(
            "w-11 h-11 rounded-xl shrink-0 flex items-center justify-center text-xl shadow-sm bg-gradient-to-br",
            grad
          )}>
            {emoji}
          </div>

          {/* Name + address */}
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <h3 className="font-bold text-[14px] leading-snug">{r.name}</h3>
              {isTop && (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-0.5 shrink-0">
                  <Star className="w-2.5 h-2.5" fill="currentColor" /> Beste match
                </span>
              )}
              {r.isFeatured && !isTop && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200/60 shrink-0">
                  ⭐ Featured
                </span>
              )}
            </div>
            {/* Category badge — especially useful in multi-category results */}
            {r.category && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full mb-1"
                style={{ background: `${emoji === "📍" ? "#6b72801a" : "var(--primary-5, #8b5cf615)"}`, color: "var(--muted-foreground)" }}>
                {emoji} {r.category}
              </span>
            )}
            {r.address && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{r.address}</span>
              </p>
            )}
          </div>

          {/* Match score */}
          {r.matchScore && (
            <div className="shrink-0 flex flex-col items-center">
              <span className={cn(
                "text-[11px] font-black px-2 py-1 rounded-lg",
                r.matchScore >= 85
                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground"
              )}>
                {r.matchScore}%
              </span>
              <span className="text-[9px] text-muted-foreground mt-0.5">match</span>
            </div>
          )}
        </div>

        {/* Reason block */}
        <div className="mt-3 bg-muted/40 rounded-xl px-3.5 py-2.5 border border-border/40">
          <p className="text-[12px] text-foreground/85 leading-relaxed">{r.reason}</p>
        </div>

        {/* Highlights */}
        {r.highlights && r.highlights.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {r.highlights.map((h, j) => (
              <span key={j} className="text-[10px] px-2.5 py-1 rounded-full bg-primary/8 border border-primary/15 text-primary/90 font-semibold">
                {h}
              </span>
            ))}
          </div>
        )}

        {/* Meta row: hours + website */}
        {(r.opening_hours || r.website) && (
          <div className="flex items-center gap-3 mt-2.5 flex-wrap">
            {r.opening_hours && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3 shrink-0" />{r.opening_hours}
              </span>
            )}
            {r.website && (
              <a href={r.website} target="_blank" rel="noopener noreferrer"
                className="text-[11px] text-primary hover:underline flex items-center gap-1 font-semibold"
                data-testid={`link-website-${i}`}>
                <Globe className="w-3 h-3" /> Website
              </a>
            )}
          </div>
        )}

        {/* Action button */}
        {((r.lat && r.lon) || r.id) && (
          <button
            onClick={onShowOnMap}
            className={cn(
              "mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-150 active:scale-[0.98]",
              isTop
                ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                : "bg-muted/70 hover:bg-muted text-foreground border border-border/60"
            )}
            data-testid={`button-show-on-map-${i}`}
          >
            <Navigation className="w-4 h-4" />
            Toon op kaart
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function PlaceFinderModal({ open, onClose, onSelectPlace, mapCenter }: PlaceFinderModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const [step, setStep] = useState(0);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [specialRequest, setSpecialRequest] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Recommendation[]>([]);
  const [done, setDone] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [spotsSearched, setSpotsSearched] = useState<number | null>(null);
  const [searchCity, setSearchCity] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);

  const scrollBodyRef = useRef<HTMLDivElement>(null);

  // When multiple categories are selected, use the generic combined flow.
  // When a single category is selected, use its specific flow.
  const primaryCat = selectedCategories[0] || null;
  const isMultiCat = selectedCategories.length > 1;
  const activeFlow: StepConfig[] = useMemo(() => {
    if (!primaryCat) return [];
    if (isMultiCat) return GENERIC_FLOW;  // combined flow for multi-select
    return FLOWS[primaryCat] || GENERIC_FLOW;
  }, [primaryCat, isMultiCat]);

  // Total steps: category selection (0) + dynamic steps + final review
  const TOTAL_STEPS = 1 + activeFlow.length + 1;
  const CURRENT_STEP_CONFIG: StepConfig | null = step >= 1 && step <= activeFlow.length ? activeFlow[step - 1] : null;
  const IS_FINAL = step === TOTAL_STEPS - 1;
  const IS_CAT_SELECT = step === 0;

  const toggleAnswer = (key: string, value: string, multi: boolean) => {
    setAnswers(prev => {
      const cur = prev[key] || [];
      if (multi) {
        return { ...prev, [key]: cur.includes(value) ? cur.filter(x => x !== value) : [...cur, value] };
      }
      return { ...prev, [key]: [value] };
    });
  };

  const reset = () => {
    setStep(0); setSelectedCategories([]); setAnswers({});
    setSpecialRequest(""); setResults([]); setDone(false); setLoading(false);
    setSearchError(null); setSpotsSearched(null); setSearchCity(null); setUsedFallback(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const canNext = () => {
    if (IS_CAT_SELECT) return selectedCategories.length > 0;
    if (IS_FINAL) return true;
    if (CURRENT_STEP_CONFIG) {
      const stepAnswers = answers[CURRENT_STEP_CONFIG.key] || [];
      return stepAnswers.length > 0;
    }
    return false;
  };

  // Detect city from lat/lon for the loading screen
  const guessCity = (lat: number, lon: number): string | null => {
    const cities = [
      { name: "Amsterdam",  lat: 52.3676, lon: 4.9041,  r: 0.20 },
      { name: "Rotterdam",  lat: 51.9244, lon: 4.4777,  r: 0.18 },
      { name: "Utrecht",    lat: 52.0907, lon: 5.1214,  r: 0.14 },
      { name: "Den Haag",   lat: 52.0705, lon: 4.3007,  r: 0.16 },
      { name: "Eindhoven",  lat: 51.4416, lon: 5.4697,  r: 0.12 },
      { name: "Groningen",  lat: 53.2194, lon: 6.5665,  r: 0.12 },
      { name: "Tilburg",    lat: 51.5719, lon: 5.0672,  r: 0.11 },
    ];
    for (const c of cities) {
      if (Math.abs(lat - c.lat) <= c.r && Math.abs(lon - c.lon) <= c.r) return c.name;
    }
    return null;
  };

  const findMySpot = async () => {
    setLoading(true);
    setSearchError(null);
    // Pre-fill city from map center so loading screen shows it immediately
    if (mapCenter) setSearchCity(guessCity(mapCenter.lat, mapCenter.lng));
    try {
      const res = await apiRequest("/api/places/find-my-spot", "POST", {
        placeTypes: selectedCategories,
        categoryAnswers: answers,
        specialRequest: specialRequest.trim() || null,
        userId: user?.id,
        userLat: mapCenter?.lat ?? null,
        userLon: mapCenter?.lng ?? null,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Server error ${res.status}`);
      }
      const data = await res.json();
      setResults(data.recommendations || []);
      setSpotsSearched(data.spotsSearched ?? null);
      setSearchCity(data.city ?? null);
      setUsedFallback(data.usedFallback ?? false);
      setDone(true);
    } catch (err: any) {
      const msg = err?.message || "Onbekende fout";
      setSearchError(msg);
      setDone(true);
    } finally {
      setLoading(false);
    }
  };

  const handleShowOnMap = (r: Recommendation) => {
    if (r.lat && r.lon) { handleClose(); navigate(`/map?lat=${r.lat}&lng=${r.lon}`); }
    else if (onSelectPlace && r.id) { onSelectPlace(r); handleClose(); }
  };

  // Keyboard-aware scroll: when on the final step and keyboard opens, scroll so submit button stays visible
  useEffect(() => {
    if (!IS_FINAL || !open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const handleResize = () => {
      const el = scrollBodyRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    };
    vv.addEventListener("resize", handleResize);
    return () => vv.removeEventListener("resize", handleResize);
  }, [IS_FINAL, open]);

  if (!open) return null;

  const primaryCatDef = primaryCat ? CATEGORIES[primaryCat] : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center pb-[calc(52px+env(safe-area-inset-bottom,0px))] md:pb-0">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full sm:max-w-lg overflow-hidden flex flex-col rounded-t-2xl sm:rounded-3xl bg-background shadow-2xl border border-border/50 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300"
        style={{ maxHeight: "min(88dvh, calc(100dvh - 64px - env(safe-area-inset-bottom, 0px)))" }}>

        {/* Drag handle */}
        <div className="flex-shrink-0 pt-2.5 pb-0 flex justify-center sm:hidden">
          <div className="w-9 h-1 rounded-full bg-muted-foreground/25" />
        </div>

        {/* Colored accent line (changes to selected category color) */}
        <div className="h-0.5 w-full flex-shrink-0 mt-1.5 sm:mt-0"
          style={primaryCatDef
            ? { background: `linear-gradient(to right, ${primaryCatDef.color}cc, ${primaryCatDef.color}22)` }
            : { background: "linear-gradient(to right, hsl(var(--primary)/0.5), transparent)" }
          } />

        {/* Header */}
        <div className="flex-shrink-0 px-4 pt-2.5 pb-2.5 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0"
                style={primaryCatDef
                  ? { background: `${primaryCatDef.color}22`, border: `1.5px solid ${primaryCatDef.color}40` }
                  : { background: "hsl(var(--primary)/0.1)", border: "1.5px solid hsl(var(--primary)/0.2)" }
                }>
                <span className="text-base">{primaryCatDef ? primaryCatDef.emoji : "✨"}</span>
              </div>
              <div>
                <h2 className="font-black text-sm leading-tight">Find My Spot</h2>
                <p className="text-[10px] text-muted-foreground">
                  {done ? `${results.length} spot${results.length !== 1 ? "s" : ""} gevonden`
                    : loading ? "AI zoekt…"
                    : IS_CAT_SELECT ? "Kies een categorie"
                    : IS_FINAL ? "Klaar om te zoeken"
                    : `Stap ${step + 1} van ${TOTAL_STEPS}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {done && (
                <button onClick={reset}
                  className="text-[11px] text-muted-foreground flex items-center gap-1 px-2 py-1 rounded-full bg-muted/50 hover:bg-muted transition-colors">
                  <RotateCcw className="w-3 h-3" /> Opnieuw
                </button>
              )}
              <button onClick={handleClose}
                className="w-7 h-7 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {!done && !loading && selectedCategories.length > 0 && (
            <div className="mt-2">
              <StepDots total={TOTAL_STEPS} current={step} />
            </div>
          )}
        </div>

        {/* Scrollable body — flex-col wrapper so the inner flex-1 child gets a real height */}
        <div className="flex-1 min-h-0 flex flex-col relative">
          {/* Fade hint always pinned to the visible bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />
          <div
            ref={scrollBodyRef}
            className="flex-1 overflow-y-auto px-4 py-3"
            style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}
            onTouchMove={e => e.stopPropagation()}
          >
          {loading ? <AILoadingScreen city={searchCity} categories={selectedCategories} /> : !done ? (
            <div className="space-y-4 pb-4">

              {/* Step 0: Category selection */}
              {IS_CAT_SELECT && (
                <div>
                  <h3 className="font-black text-sm sm:text-base mb-0.5">Wat ben je op zoek naar?</h3>
                  <p className="text-[11px] text-muted-foreground mb-2.5">Kies een of meer soorten plek</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                    {CATEGORY_LIST.map(([key, def]) => (
                      <CategoryCard key={key} catKey={key} def={def}
                        selected={selectedCategories.includes(key)}
                        onClick={() => {
                          setSelectedCategories(prev =>
                            prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key]
                          );
                          setAnswers({});
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Dynamic steps */}
              {!IS_CAT_SELECT && !IS_FINAL && CURRENT_STEP_CONFIG && (
                <div>
                  <h3 className="font-black text-base mb-0.5">{CURRENT_STEP_CONFIG.title}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{CURRENT_STEP_CONFIG.subtitle}</p>

                  {CURRENT_STEP_CONFIG.layout === "grid" && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                      {CURRENT_STEP_CONFIG.options.map(opt => (
                        <OptionGrid key={opt.value} opt={opt}
                          selected={(answers[CURRENT_STEP_CONFIG.key] || []).includes(opt.value)}
                          onClick={() => toggleAnswer(CURRENT_STEP_CONFIG.key, opt.value, CURRENT_STEP_CONFIG.multi)} />
                      ))}
                    </div>
                  )}

                  {CURRENT_STEP_CONFIG.layout === "list" && (
                    <div className="flex flex-col gap-2">
                      {CURRENT_STEP_CONFIG.options.map(opt => (
                        <OptionList key={opt.value} opt={opt}
                          selected={(answers[CURRENT_STEP_CONFIG.key] || []).includes(opt.value)}
                          onClick={() => toggleAnswer(CURRENT_STEP_CONFIG.key, opt.value, CURRENT_STEP_CONFIG.multi)} />
                      ))}
                    </div>
                  )}

                  {CURRENT_STEP_CONFIG.layout === "time" && (
                    <div className="flex flex-col gap-2.5">
                      {CURRENT_STEP_CONFIG.options.map(opt => (
                        <TimeCard key={opt.value} opt={opt}
                          selected={(answers[CURRENT_STEP_CONFIG.key] || []).includes(opt.value)}
                          onClick={() => toggleAnswer(CURRENT_STEP_CONFIG.key, opt.value, false)} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Final step: review + special request */}
              {IS_FINAL && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-black text-base mb-0.5">Nog iets toe te voegen?</h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      Vertel ons precies wat je zoekt — sfeer, buurt, gezelschap, prijs
                    </p>
                    <Textarea
                      value={specialRequest}
                      onChange={e => setSpecialRequest(e.target.value)}
                      placeholder={`bv. "Liefst in Noord-Amsterdam, gratis entree, rustige sfeer"`}
                      rows={3}
                      className="resize-none text-sm rounded-2xl"
                      data-testid="textarea-special-request"
                    />
                    <p className="text-xs text-muted-foreground mt-2">Optioneel — de AI gebruikt dit voor betere matching</p>
                  </div>

                  {/* Summary */}
                  <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 space-y-3">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Jouw keuzes</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedCategories.map(c => (
                        <span key={c} className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full"
                          style={CATEGORIES[c] ? { background: `${CATEGORIES[c].color}18`, color: CATEGORIES[c].color, border: `1px solid ${CATEGORIES[c].color}30` } : {}}>
                          {CATEGORIES[c]?.emoji} {CATEGORIES[c]?.label || c}
                        </span>
                      ))}
                      {Object.entries(answers).flatMap(([, vals]) => vals).map((v, i) => (
                        <span key={i} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-muted/60 border border-border/50 text-muted-foreground">
                          {v.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Results (or error)
            <div className="space-y-3 pb-12">
              {/* Error state */}
              {searchError ? (
                <div className="text-center py-10">
                  <div className="text-5xl mb-4">⚠️</div>
                  <p className="font-bold text-sm mb-1.5">Zoekopdracht mislukt</p>
                  <p className="text-xs text-muted-foreground mb-5 max-w-xs mx-auto">Probeer het opnieuw of pas je voorkeuren aan.</p>
                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" onClick={reset} className="gap-1.5 rounded-full text-xs">
                      <RotateCcw className="w-3.5 h-3.5" /> Opnieuw
                    </Button>
                    <Button onClick={() => { setDone(false); setSearchError(null); findMySpot(); }}
                      className="gap-1.5 rounded-full text-xs">
                      <Sparkles className="w-3.5 h-3.5" /> Nog een keer
                    </Button>
                  </div>
                </div>
              ) : results.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">🗺️</div>
                  <p className="font-bold text-sm mb-2">Geen exacte matches</p>
                  <p className="text-xs text-muted-foreground mb-5 max-w-xs mx-auto">
                    {spotsSearched ? `${spotsSearched.toLocaleString()} spots doorzocht` : "Probeer andere voorkeuren"} — verfijn je keuze of bekijk de kaart zelf.
                  </p>
                  <Button variant="outline" onClick={reset} className="gap-1.5 rounded-full">
                    <RotateCcw className="w-3.5 h-3.5" /> Andere voorkeuren
                  </Button>
                </div>
              ) : (
                <>
                  {/* Results header — spots searched + city */}
                  <div className="flex items-center justify-between py-1">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-bold text-foreground">{results.length} plek{results.length !== 1 ? "ken" : ""}</span> gevonden
                        {searchCity ? ` in ${searchCity}` : ""}
                      </p>
                      {spotsSearched && (
                        <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
                          <span>📡</span> {spotsSearched.toLocaleString()} spots doorzocht
                        </p>
                      )}
                      {usedFallback && (
                        <p className="text-[10px] text-amber-500/80 flex items-center gap-1 mt-0.5">
                          <span>⚡</span> Smart match — AI tijdelijk bezet
                        </p>
                      )}
                    </div>
                    <button onClick={reset} className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 px-2.5 py-1 rounded-full hover:bg-muted/60 transition-colors border border-border/40">
                      <RotateCcw className="w-3 h-3" /> Opnieuw
                    </button>
                  </div>
                  {results.map((r, i) => <ResultCard key={i} r={r} i={i} onShowOnMap={() => handleShowOnMap(r)} />)}
                  <div className="pt-1 pb-2 text-center">
                    <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 mx-auto px-4 py-2.5 rounded-full hover:bg-muted/50 transition-colors border border-border/40">
                      <RotateCcw className="w-3 h-3" /> Andere voorkeuren
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        </div>{/* end flex-1 min-h-0 relative wrapper */}

        {/* Sticky footer nav — safe-area aware */}
        {!loading && !done && (
          <div className="flex-shrink-0 px-4 pt-3 border-t border-border/50 bg-background/80 backdrop-blur-sm flex gap-2"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(s => s - 1)}
                className="gap-1 rounded-full px-4 border-border/60 h-10 min-w-[44px]">
                <ChevronLeft className="w-4 h-4" /> Terug
              </Button>
            )}
            {!IS_FINAL ? (
              <Button onClick={() => setStep(s => s + 1)} disabled={!canNext()}
                className="flex-1 gap-1.5 rounded-full font-bold h-10"
                data-testid="button-next-step">
                Volgende <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={findMySpot} disabled={loading}
                className="flex-1 gap-2 rounded-full font-bold h-10 shadow-lg"
                style={primaryCatDef ? { background: `linear-gradient(135deg, ${primaryCatDef.color}ee, ${primaryCatDef.color}aa)` } : {}}
                data-testid="button-find-spot">
                <Sparkles className="w-4 h-4" /> Find My Spot
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
