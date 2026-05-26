import { User as FirebaseUser } from "firebase/auth";
import { User as AppUser } from "@shared/schema";

// Extend User type to include Firebase user data
export type AuthUser = AppUser & {
  firebaseUser?: FirebaseUser;
};

// Event categories
export const EventCategories = {
  DANCE: "dance",
  FESTIVAL: "festival",
  KIDS: "kids",
  FAMILY: "family",
  MUSIC: "music",
  SPORTS: "sports",
  WORKSHOP: "workshop",
  CULTURAL: "cultural",
  FOOD: "food",
  COMMUNITY: "community",
  NIGHTLIFE: "nightlife",
  ART: "art",
  SKATE: "skate",
  PARKOUR: "parkour",
  FREE: "free",
  PREMIUM: "premium",
  COMPETITION: "competition",
} as const;

export type EventCategory = typeof EventCategories[keyof typeof EventCategories];

export const EVENT_CATEGORY_LABELS: Record<string, string> = {
  dance: "Dance",
  festival: "Festival",
  kids: "Kids",
  family: "Family",
  music: "Music",
  sports: "Sports",
  workshop: "Workshop",
  cultural: "Cultural",
  food: "Food",
  community: "Community",
  nightlife: "Nightlife",
  art: "Art & Street Art",
  skate: "Skate",
  parkour: "Parkour",
  free: "Free Events",
  premium: "Premium",
  competition: "Competition",
};

export const EVENT_CATEGORY_ICONS: Record<string, string> = {
  dance: "🕺",
  festival: "🎪",
  kids: "🧒",
  family: "👨‍👩‍👧",
  music: "🎵",
  sports: "⚽",
  workshop: "🎨",
  cultural: "🌍",
  food: "🍕",
  community: "🤝",
  nightlife: "🌙",
  art: "🖼️",
  skate: "🛹",
  parkour: "🏃",
  free: "🎟️",
  premium: "⭐",
  competition: "🏆",
};

// Competition types grouped by discipline
export const COMPETITION_TYPES = {
  dance: [
    { value: "BREAKING", label: "Breaking" },
    { value: "POPPING", label: "Popping" },
    { value: "LOCKING", label: "Locking" },
    { value: "HIPHOP", label: "Hip-Hop" },
    { value: "ALL_STYLES", label: "All Styles" },
    { value: "WAACKING", label: "Waacking" },
    { value: "VOGUING", label: "Voguing" },
  ],
  music: [
    { value: "DJ_BATTLE", label: "DJ Battle" },
    { value: "BEATBOX", label: "Beatbox" },
    { value: "RAP_BATTLE", label: "Rap Battle" },
    { value: "LIVE_BAND", label: "Live Band Competition" },
    { value: "OPEN_MIC_COMP", label: "Open Mic Competition" },
  ],
  sports: [
    { value: "BASKETBALL_3V3", label: "Basketball 3v3" },
    { value: "TABLE_TENNIS", label: "Table Tennis" },
    { value: "FREESTYLE_FOOTBALL", label: "Freestyle Football" },
    { value: "PADEL", label: "Padel" },
    { value: "BOXING", label: "Boxing" },
    { value: "ARM_WRESTLING", label: "Arm Wrestling" },
    { value: "CHESS", label: "Chess" },
  ],
  custom: [
    { value: "CUSTOM", label: "Custom / Other" },
  ],
} as const;

export const COMPETITION_FORMATS = [
  { value: "1v1", label: "1 vs 1" },
  { value: "2v2", label: "2 vs 2" },
  { value: "crew", label: "Crew vs Crew" },
  { value: "solo", label: "Solo Performance" },
  { value: "team", label: "Team" },
  { value: "open", label: "Open Format" },
] as const;

// Categories that can have competitions
export const COMPETITION_CATEGORIES = ["competition", "dance", "music", "sports"] as const;

export const EVENT_MOOD_FILTERS = [
  { id: "energetic", label: "Energetic", icon: "⚡", color: "from-orange-500 to-red-500" },
  { id: "chill", label: "Chill", icon: "🌊", color: "from-blue-400 to-cyan-400" },
  { id: "family", label: "Family", icon: "👨‍👩‍👧", color: "from-green-400 to-emerald-500" },
  { id: "creative", label: "Creative", icon: "🎨", color: "from-purple-500 to-pink-500" },
  { id: "urban", label: "Urban", icon: "🏙️", color: "from-gray-700 to-gray-900" },
  { id: "luxury", label: "Luxury", icon: "✨", color: "from-yellow-400 to-amber-500" },
] as const;

export const MUSIC_GENRE_FILTERS = [
  { id: "electronic", label: "Electronic", icon: "⚡" },
  { id: "hiphop",     label: "Hip-Hop",    icon: "🎤" },
  { id: "rnb",        label: "R&B / Soul", icon: "🎸" },
  { id: "afrobeats",  label: "Afrobeats",  icon: "🌍" },
  { id: "jazz",       label: "Jazz",       icon: "🎺" },
  { id: "reggae",     label: "Reggae",     icon: "🌿" },
  { id: "latin",      label: "Latin",      icon: "💃" },
  { id: "pop",        label: "Pop",        icon: "🎵" },
  { id: "rock",       label: "Rock",       icon: "🤘" },
  { id: "classical",  label: "Classical",  icon: "🎹" },
  { id: "dance",      label: "Dance",      icon: "🕺" },
  { id: "world",      label: "World",      icon: "🌐" },
] as const;

export type MusicGenre = typeof MUSIC_GENRE_FILTERS[number]["id"];

export const EVENT_TAGS = [
  "Kid friendly", "Indoor", "Outdoor", "Free entry", "Paid",
  "Family friendly", "Wheelchair accessible", "Beginner friendly",
  "Popular", "Trending", "Verified organizer", "Last minute",
  "Sold out", "Early bird", "Hidden gem",
] as const;

// Location types
export const LocationTypes = {
  GRAFFITI: "graffiti",
  DANCE: "dance",
  TRAINING: "training",
  SKATE: "skate",
  OTHER: "other",
} as const;

export type LocationType = typeof LocationTypes[keyof typeof LocationTypes];

// RSVP status
export const RsvpStatus = {
  GOING: "going",
  MAYBE: "maybe",
  NOT_GOING: "not_going",
} as const;

export type RsvpStatusType = typeof RsvpStatus[keyof typeof RsvpStatus];

// Event interface for sharing functionality
export interface Event {
  id: number;
  title: string;
  description?: string;
  category?: string;
  date: string | Date;
  location?: string;
  image?: string;
  price?: number;
  organizerId?: number;
  status?: string;
}

// Location interface for sharing functionality
export interface Location {
  id: number;
  name: string;
  description?: string;
  locationType?: string;
  address?: string;
  image?: string;
  latitude?: number;
  longitude?: number;
}

// Post interface for sharing functionality
export interface Post {
  id: number;
  title?: string;
  content?: string;
  image?: string;
  createdAt?: string | Date;
  userId?: number;
  tags?: string[];
  artType?: string;
}

// Service interface for sharing functionality
export interface Service {
  id: number;
  name: string;
  description?: string;
  category?: string;
  type?: string;
  price?: string | number;
  images?: string[];
  providerId?: number;
}

// Product interface for sharing functionality
export interface Product {
  id: number;
  name: string;
  description?: string;
  category?: string;
  price?: string | number;
  images?: string[];
  sellerId?: number;
}
