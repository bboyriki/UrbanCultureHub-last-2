import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Location, LocationType } from "@shared/schema";
import type { MapFilters, MapUser, CitySpot } from "./types";
import AdminSchedulePanel from "./AdminSchedulePanel";
import AdminMapOverlay from "./AdminMapOverlay";
import { searchAddress, NominatimResult } from "@/lib/nominatim";
import {
  MapPin, Calendar, Filter, X, Navigation, Tag, Search,
  Users, Plus, RefreshCw, Locate, ChevronDown, ChevronUp, Layers, Sparkles,
  SlidersHorizontal, Clock, Compass, Shield, Bot, Route,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import AddLocationModal from "./AddLocationModal";
import PlaceDetailSheet from "./PlaceDetailSheet";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function sanitizeImgUrl(url: string): string {
  if (!url) return "";
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith("javascript:") || trimmed.startsWith("data:text") || trimmed.startsWith("vbscript:")) return "";
  return url;
}

const DEFAULT_CENTER: [number, number] = [52.3676, 4.9041];
const DEFAULT_ZOOM = 13;

const PIN_ORANGE = "#FF4D00";
const USER_PURPLE = "#7C3AED";

const categoryConfig: Record<string, { color: string; icon: string; label: string; emoji: string }> = {
  [LocationType.GRAFFITI]: { color: PIN_ORANGE, icon: "palette", label: "Graffiti", emoji: "🎨" },
  [LocationType.DANCE]: { color: PIN_ORANGE, icon: "dance", label: "Dance", emoji: "💃" },
  [LocationType.MUSIC]: { color: PIN_ORANGE, icon: "music", label: "Music", emoji: "🎵" },
  [LocationType.RAP]: { color: PIN_ORANGE, icon: "mic", label: "Rap", emoji: "🎤" },
  [LocationType.PERFORMANCE]: { color: PIN_ORANGE, icon: "drama", label: "Performance", emoji: "🎭" },
  [LocationType.SKATE]: { color: PIN_ORANGE, icon: "skate", label: "Skate", emoji: "🛹" },
  [LocationType.PARKOUR]: { color: PIN_ORANGE, icon: "parkour", label: "Parkour", emoji: "🤸" },
  [LocationType.TRAINING]: { color: PIN_ORANGE, icon: "training", label: "Training", emoji: "💪" },
  [LocationType.BMX]: { color: PIN_ORANGE, icon: "bmx", label: "BMX", emoji: "🚲" },
  [LocationType.STREET_SPORTS]: { color: PIN_ORANGE, icon: "sports", label: "Street Sports", emoji: "⚽" },
  [LocationType.CULTURAL_HUB]: { color: PIN_ORANGE, icon: "hub", label: "Cultural Hub", emoji: "🏛️" },
  [LocationType.OPEN_MIC]: { color: PIN_ORANGE, icon: "mic", label: "Open Mic", emoji: "🎙️" },
  [LocationType.WORKSHOP]: { color: PIN_ORANGE, icon: "workshop", label: "Workshop", emoji: "🔧" },
};

const eventCategoryConfig: Record<string, { emoji: string; color: string; label: string }> = {
  music:    { emoji: "🎵", color: "#E8500A", label: "Music" },
  family:   { emoji: "👨‍👩‍👧", color: "#16A34A", label: "Family" },
  cultural: { emoji: "🎭", color: "#7C3AED", label: "Cultural" },
  sports:   { emoji: "🏆", color: "#2563EB", label: "Sports" },
  default:  { emoji: "📅", color: "#6B7280", label: "Event" },
};

const roleConfig: Record<string, { color: string; label: string }> = {
  artist: { color: USER_PURPLE, label: "Artist" },
  athlete: { color: USER_PURPLE, label: "Athlete" },
  dj: { color: USER_PURPLE, label: "DJ" },
  mc: { color: USER_PURPLE, label: "MC" },
  dancer: { color: USER_PURPLE, label: "Dancer" },
  musician: { color: USER_PURPLE, label: "Musician" },
  photographer: { color: USER_PURPLE, label: "Photographer" },
  videographer: { color: USER_PURPLE, label: "Videographer" },
  producer: { color: USER_PURPLE, label: "Producer" },
  promoter: { color: USER_PURPLE, label: "Promoter" },
  organizer: { color: USER_PURPLE, label: "Organizer" },
  fan: { color: USER_PURPLE, label: "Fan" },
};

const CITY_TEAL = "#0D9488";

// ── Unified Category Model ──────────────────────────────────────────────────
// Single source of truth for the filter UI. Each user-facing category maps to
// the underlying values used by the three data sources (community spots,
// city/OSM spots, events). Selecting "Cafe" in the filter applies the SAME
// intent across every layer — no more mixed/irrelevant results.
type UnifiedGroupId = "food" | "sports" | "arts" | "community";
type UnifiedCategoryDef = {
  emoji: string;
  color: string;
  label: string;
  group: UnifiedGroupId;
  locationTypes?: string[];
  cityCategories?: string[];
  eventCategories?: string[];
};

const UNIFIED_CATEGORIES: Record<string, UnifiedCategoryDef> = {
  // Food & Drink
  cafe:         { emoji: "☕", color: "#D97706", label: "Café",        group: "food",      locationTypes: ["cafe"],        cityCategories: ["cafe"] },
  restaurant:   { emoji: "🍽️", color: "#EA580C", label: "Restaurant",  group: "food",      locationTypes: ["restaurant"],  cityCategories: ["restaurant", "food"] },
  nightlife:    { emoji: "🌙", color: "#8B5CF6", label: "Nightlife",   group: "food",      locationTypes: ["nightlife"],   cityCategories: ["nightlife"] },
  // Sports & Training
  skate:        { emoji: "🛹", color: "#84CC16", label: "Skate",        group: "sports",   locationTypes: ["skate"],        cityCategories: ["skate"], eventCategories: ["sports"] },
  parkour:      { emoji: "🤸", color: "#EAB308", label: "Parkour",      group: "sports",   locationTypes: ["parkour"],      cityCategories: ["parkour"] },
  bmx:          { emoji: "🚲", color: "#0EA5E9", label: "BMX",          group: "sports",   locationTypes: ["bmx"],          cityCategories: ["bmx"] },
  basketball:   { emoji: "🏀", color: "#EA580C", label: "Basketball",   group: "sports",   locationTypes: ["basketball"],   cityCategories: ["basketball"] },
  street_sports:{ emoji: "⚽", color: "#16A34A", label: "Street Sports",group: "sports",   locationTypes: ["street_sports"], eventCategories: ["sports"] },
  training:     { emoji: "🥊", color: "#16A34A", label: "Training",     group: "sports",   locationTypes: ["training"],     cityCategories: ["training"] },
  fitness:      { emoji: "💪", color: "#3B82F6", label: "Fitness",      group: "sports",   locationTypes: ["fitness"],      cityCategories: ["fitness"] },
  bouldering:   { emoji: "🧗", color: "#7C3AED", label: "Bouldering",   group: "sports",   cityCategories: ["bouldering"] },
  padel:        { emoji: "🎾", color: "#22C55E", label: "Padel",        group: "sports",   cityCategories: ["padel"] },
  table_tennis: { emoji: "🏓", color: "#16A34A", label: "Table Tennis", group: "sports",   cityCategories: ["table_tennis"] },
  sport:        { emoji: "🏋️", color: "#10B981", label: "Sport",        group: "sports",   cityCategories: ["sport"], eventCategories: ["sports"] },
  // Arts & Culture
  graffiti:     { emoji: "🎨", color: "#F97316", label: "Graffiti",     group: "arts",     locationTypes: ["graffiti"],    cityCategories: ["graffiti"] },
  dance:        { emoji: "💃", color: "#EC4899", label: "Dance",        group: "arts",     locationTypes: ["dance"],       cityCategories: ["dance"] },
  music:        { emoji: "🎵", color: "#6366F1", label: "Music",        group: "arts",     locationTypes: ["music"],       cityCategories: ["music"], eventCategories: ["music"] },
  rap:          { emoji: "🎤", color: "#DC2626", label: "Rap / MC",     group: "arts",     locationTypes: ["rap"],         cityCategories: ["rap"] },
  beatbox:      { emoji: "🎙️", color: "#B91C1C", label: "Beatbox",      group: "arts",     locationTypes: ["beatbox"],     cityCategories: ["beatbox"] },
  open_mic:     { emoji: "🎙️", color: "#9333EA", label: "Open Mic",     group: "arts",     locationTypes: ["open_mic"],    cityCategories: ["open_mic"] },
  performance:  { emoji: "🎭", color: "#7C3AED", label: "Performance",  group: "arts",     locationTypes: ["performance"], eventCategories: ["cultural"] },
  art:          { emoji: "🖼️", color: "#A78BFA", label: "Art",          group: "arts",     cityCategories: ["art"], eventCategories: ["cultural"] },
  museum:       { emoji: "🏛️", color: "#92400E", label: "Museum",       group: "arts",     cityCategories: ["museum"], eventCategories: ["cultural"] },
  cinema:       { emoji: "🎬", color: "#0EA5E9", label: "Cinema",       group: "arts",     cityCategories: ["cinema"] },
  comedy:       { emoji: "😄", color: "#F59E0B", label: "Comedy",       group: "arts",     cityCategories: ["comedy"] },
  culture:      { emoji: "🏛️", color: "#7C3AED", label: "Culture",      group: "arts",     cityCategories: ["culture"], eventCategories: ["cultural"] },
  // Community
  cultural_hub: { emoji: "🏛️", color: "#6D28D9", label: "Cultural Hub", group: "community", locationTypes: ["cultural_hub"], eventCategories: ["cultural", "family"] },
  community:    { emoji: "🤝", color: "#14B8A6", label: "Community",    group: "community", cityCategories: ["community"], eventCategories: ["family"] },
  workshop:     { emoji: "🔧", color: "#4F46E5", label: "Workshop",     group: "community", locationTypes: ["workshop"], cityCategories: ["workshop"] },
  wellness:     { emoji: "🧖", color: "#DB2777", label: "Wellness",     group: "community", locationTypes: ["wellness"], cityCategories: ["wellness"] },
  other:        { emoji: "📍", color: CITY_TEAL, label: "Other",        group: "community", locationTypes: ["other"], cityCategories: ["other"] },
};

const UNIFIED_GROUPS: Array<{ id: UnifiedGroupId; label: string; emoji: string }> = [
  { id: "food",      label: "Food & Drink",      emoji: "🍽️" },
  { id: "sports",    label: "Sports & Training", emoji: "🏃" },
  { id: "arts",      label: "Arts & Culture",    emoji: "🎨" },
  { id: "community", label: "Community",         emoji: "🤝" },
];

type SelectedSets = { locTypes: Set<string>; cityCats: Set<string>; eventCats: Set<string> };
const buildSelectedSets = (selected: string[]): SelectedSets => {
  const locTypes = new Set<string>();
  const cityCats = new Set<string>();
  const eventCats = new Set<string>();
  for (const key of selected) {
    const def = UNIFIED_CATEGORIES[key];
    if (!def) continue;
    def.locationTypes?.forEach(t => locTypes.add(t));
    def.cityCategories?.forEach(t => cityCats.add(t));
    def.eventCategories?.forEach(t => eventCats.add(t));
  }
  return { locTypes, cityCats, eventCats };
};

// ── Distance & Opening Hours helpers ────────────────────────────────────────
const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDistance = (km: number): string => {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
};

const isOpenNow = (opening_hours: string | null): boolean => {
  if (!opening_hours) return false;
  const s = opening_hours.trim();
  if (s === "24/7") return true;
  if (/^closed$/i.test(s)) return false;
  const now = new Date();
  const dayIdx = now.getDay();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const dayMap: Record<string, number> = { mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6, su: 0 };
  const rules = s.split(";").map(r => r.trim()).filter(Boolean);
  for (const rule of rules) {
    const spaceIdx = rule.search(/\s+\d/);
    if (spaceIdx === -1) continue;
    const dayPart = rule.slice(0, spaceIdx).trim();
    const timePart = rule.slice(spaceIdx).trim();
    let appliesToday = false;
    for (const seg of dayPart.split(",").map(d => d.trim())) {
      if (seg.includes("-")) {
        const parts = seg.split("-");
        const a = dayMap[parts[0]?.toLowerCase().slice(0, 2) ?? ""];
        const b = dayMap[parts[1]?.toLowerCase().slice(0, 2) ?? ""];
        if (a !== undefined && b !== undefined) {
          if (a <= b ? (dayIdx >= a && dayIdx <= b) : (dayIdx >= a || dayIdx <= b)) appliesToday = true;
        }
      } else {
        const d = dayMap[seg.toLowerCase().slice(0, 2)];
        if (d !== undefined && d === dayIdx) appliesToday = true;
      }
    }
    if (!appliesToday) continue;
    for (const tr of timePart.split(",").map(t => t.trim())) {
      const dash = tr.indexOf("-", 1);
      if (dash === -1) continue;
      const parseT = (t: string) => { const [h, m] = t.trim().split(":").map(Number); return (h || 0) * 60 + (m || 0); };
      const start = parseT(tr.slice(0, dash));
      const end = parseT(tr.slice(dash + 1));
      if (end > start ? (nowMins >= start && nowMins < end) : (nowMins >= start || nowMins < end)) return true;
    }
  }
  return false;
};

const categoryDescriptions: Record<string, string> = {
  culture:     "Cultural venue — theatre, arts centre, community hall.",
  graffiti:    "Graffiti wall or street art spot — legal walls & murals.",
  cafe:        "Local café — great spot to connect with the community.",
  food:        "Food spot popular in the neighbourhood.",
  restaurant:  "Restaurant popular with the urban community.",
  sport:       "Sports facility — training ground for athletes.",
  skate:       "Skate spot — rails, ledges and open concrete.",
  dance:       "Dance studio — hip-hop, street dance and breaking classes.",
  music:       "Live music venue — events, concerts and urban nights.",
  nightlife:   "Nightlife venue — DJ sets, parties and urban culture nights.",
  comedy:      "Theatre and entertainment venue.",
  cinema:      "Cinema — film screenings and events.",
  art:         "Art and street art space — exhibitions and creative culture.",
  community:   "Community and cultural space — events and gatherings.",
  fitness:     "Fitness centre — gym, calisthenics and training.",
  basketball:  "Basketball court — open play and competitions.",
  parkour:     "Parkour spot — freerunning and urban movement.",
  padel:       "Padel court — book a game or watch.",
  bouldering:  "Bouldering & climbing gym — no ropes needed.",
  museum:      "Museum — art, culture and urban exhibitions.",
  bmx:         "BMX spot — dirt jumps, race tracks and freestyle.",
  table_tennis:"Table tennis club or outdoor ping-pong tables.",
  wellness:    "Wellness, spa and recovery space.",
  beatbox:     "Beatbox sessions, battles and workshops.",
  rap:         "Rap, freestyle and MC performance space.",
  open_mic:    "Open mic venue — spoken word, live music and freestyle.",
  workshop:    "Creative workshop and training space for artists.",
  training:    "Training and sports facility.",
  other:       "Urban culture spot.",
};

const citySpotConfig: Record<string, { emoji: string; color: string; label: string }> = {
  // ── Core urban culture categories ──────────────────────────────────────
  culture:      { emoji: "🏛️", color: "#7C3AED", label: "Culture" },
  graffiti:     { emoji: "🎨", color: "#F97316", label: "Graffiti" },
  // ── Food & drink ───────────────────────────────────────────────────────
  cafe:         { emoji: "☕", color: "#D97706", label: "Café" },
  food:         { emoji: "🍽️", color: "#EA580C", label: "Restaurant" },
  restaurant:   { emoji: "🍽️", color: "#EA580C", label: "Restaurant" },
  // ── Sports & training ──────────────────────────────────────────────────
  sport:        { emoji: "🏋️", color: "#10B981", label: "Sport" },
  training:     { emoji: "🥊", color: "#16A34A", label: "Training" },
  fitness:      { emoji: "💪", color: "#3B82F6", label: "Fitness" },
  skate:        { emoji: "🛹", color: "#84CC16", label: "Skate" },
  dance:        { emoji: "💃", color: "#EC4899", label: "Dance" },
  basketball:   { emoji: "🏀", color: "#EA580C", label: "Basketball" },
  parkour:      { emoji: "🤸", color: "#EAB308", label: "Parkour" },
  padel:        { emoji: "🎾", color: "#22C55E", label: "Padel" },
  bouldering:   { emoji: "🧗", color: "#7C3AED", label: "Bouldering" },
  bmx:          { emoji: "🚲", color: "#0EA5E9", label: "BMX" },
  table_tennis: { emoji: "🏓", color: "#16A34A", label: "Table Tennis" },
  // ── Arts & entertainment ────────────────────────────────────────────────
  music:        { emoji: "🎵", color: "#6366F1", label: "Music" },
  nightlife:    { emoji: "🌙", color: "#8B5CF6", label: "Nightlife" },
  comedy:       { emoji: "😄", color: "#F59E0B", label: "Theatre" },
  cinema:       { emoji: "🎬", color: "#0EA5E9", label: "Cinema" },
  art:          { emoji: "🖼️", color: "#A78BFA", label: "Art" },
  museum:       { emoji: "🏛️", color: "#92400E", label: "Museum" },
  beatbox:      { emoji: "🎤", color: "#DC2626", label: "Beatbox" },
  rap:          { emoji: "🎤", color: "#DC2626", label: "Rap / MC" },
  open_mic:     { emoji: "🎙️", color: "#9333EA", label: "Open Mic" },
  // ── Community ──────────────────────────────────────────────────────────
  community:    { emoji: "🤝", color: "#14B8A6", label: "Community" },
  workshop:     { emoji: "🔧", color: "#4F46E5", label: "Workshop" },
  wellness:     { emoji: "🧖", color: "#DB2777", label: "Wellness" },
  other:        { emoji: "📍", color: CITY_TEAL,  label: "Place" },
};

// ── Icon cache to avoid recreating SVG strings on every render ──────────────
const _iconCache = new Map<string, L.DivIcon>();

const makeCitySpotIcon = (category: string, spotlighted = false): L.DivIcon => {
  const cacheKey = `${category}_${spotlighted}`;
  if (_iconCache.has(cacheKey)) return _iconCache.get(cacheKey)!;

  const cfg = citySpotConfig[category] || citySpotConfig.other;

  if (spotlighted) {
    // Large featured spot — bigger, animated, always outside cluster group
    const size = 88;
    const half = size / 2;
    const pad = 28;
    const totalW = size + pad;
    const totalH = Math.round(size * 1.22) + pad;
    const icon = L.divIcon({
      className: "",
      html: `<div class="spotlight-marker-host" style="width:${totalW}px;height:${totalH}px;position:relative">
        <div class="spotlight-pulse-ring"></div>
        <div class="spotlight-pulse-ring2"></div>
        <svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}" style="position:relative;z-index:2">
          <defs>
            <filter id="sglow_${category}" x="-60%" y="-50%" width="220%" height="220%">
              <feDropShadow dx="0" dy="2" stdDeviation="8" flood-color="rgba(245,158,11,0.85)"/>
            </filter>
            <linearGradient id="sgrd_${category}" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#FCD34D"/>
              <stop offset="100%" style="stop-color:#D97706"/>
            </linearGradient>
          </defs>
          <g filter="url(#sglow_${category})" transform="translate(${pad/2},${pad/2})">
            <path d="M${half} 2C${Math.round(half*0.4)} 2 ${Math.round(half*0.06)} ${Math.round(half*0.55)} ${Math.round(half*0.06)} ${half} c0 ${Math.round(half*0.75)} ${Math.round(half*0.94)} ${Math.round(size*0.56)} ${Math.round(half*0.94)} ${Math.round(size*0.56)} s${Math.round(half*0.94)}-${Math.round(size*0.2)} ${Math.round(half*0.94)}-${Math.round(size*0.56)} C${Math.round(size*0.935)} ${Math.round(half*0.55)} ${Math.round(half*1.6)} 2 ${half} 2z"
              fill="url(#sgrd_${category})" stroke="white" stroke-width="3"/>
            <circle cx="${half}" cy="${half}" r="${Math.round(half*0.56)}" fill="white" opacity="0.97"/>
            <text x="${half}" y="${Math.round(half*1.18)}" text-anchor="middle" font-size="${Math.round(half*0.72)}" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${cfg.emoji}</text>
          </g>
          <text x="${totalW - 12}" y="22" text-anchor="middle" font-size="18" font-family="Apple Color Emoji,Segoe UI Emoji,sans-serif">⭐</text>
        </svg>
      </div>`,
      iconSize: [totalW, totalH],
      iconAnchor: [totalW / 2, totalH - pad / 2],
      popupAnchor: [0, -(totalH - pad / 2)],
    });
    _iconCache.set(cacheKey, icon);
    return icon;
  }

  // Regular city spot
  const size = 36;
  const half = size / 2;
  const icon = L.divIcon({
    className: "",
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${Math.round(size*1.2)}" viewBox="0 0 ${size} ${Math.round(size*1.2)}">
      <defs><filter id="csd_${category}" x="-40%" y="-30%" width="180%" height="180%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.26)"/>
      </filter></defs>
      <g filter="url(#csd_${category})">
        <path d="M${half} 2C${Math.round(half*0.4)} 2 ${Math.round(half*0.06)} ${Math.round(half*0.55)} ${Math.round(half*0.06)} ${half} c0 ${Math.round(half*0.75)} ${Math.round(half*0.94)} ${Math.round(size*0.56)} ${Math.round(half*0.94)} ${Math.round(size*0.56)} s${Math.round(half*0.94)}-${Math.round(size*0.2)} ${Math.round(half*0.94)}-${Math.round(size*0.56)} C${Math.round(size*0.935)} ${Math.round(half*0.55)} ${Math.round(half*1.6)} 2 ${half} 2z"
          fill="${cfg.color}" stroke="white" stroke-width="1.5"/>
        <circle cx="${half}" cy="${half}" r="${Math.round(half*0.58)}" fill="white" opacity="0.9"/>
        <text x="${half}" y="${Math.round(half*1.18)}" text-anchor="middle" font-size="${Math.round(half*0.68)}" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${cfg.emoji}</text>
      </g>
    </svg>`,
    iconSize: [size, Math.round(size * 1.2)],
    iconAnchor: [half, Math.round(size * 1.2)],
    popupAnchor: [0, -Math.round(size * 1.2)],
  });
  _iconCache.set(cacheKey, icon);
  return icon;
};

const _superIconCache = new Map<string, L.DivIcon>();
const makeSuperFeaturedIcon = (category: string): L.DivIcon => {
  if (_superIconCache.has(category)) return _superIconCache.get(category)!;
  const cfg = citySpotConfig[category] || citySpotConfig.other;
  const size = 98;
  const half = size / 2;
  const pad = 30;
  const totalW = size + pad;
  const totalH = Math.round(size * 1.22) + pad;
  const icon = L.divIcon({
    className: "",
    html: `<div class="super-featured-marker-host" style="width:${totalW}px;height:${totalH}px;position:relative">
        <div class="super-pulse-ring"></div>
        <div class="super-pulse-ring2"></div>
      <svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}" style="position:relative;z-index:3">
        <defs>
          <filter id="sfglow_${category}" x="-60%" y="-50%" width="220%" height="220%">
            <feDropShadow dx="0" dy="2" stdDeviation="10" flood-color="rgba(139,92,246,0.9)"/>
          </filter>
          <linearGradient id="sfgrd_${category}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#A78BFA"/>
            <stop offset="100%" style="stop-color:#7C3AED"/>
          </linearGradient>
        </defs>
        <g filter="url(#sfglow_${category})" transform="translate(${pad/2},${pad/2})">
          <path d="M${half} 2C${Math.round(half*0.4)} 2 ${Math.round(half*0.06)} ${Math.round(half*0.55)} ${Math.round(half*0.06)} ${half} c0 ${Math.round(half*0.75)} ${Math.round(half*0.94)} ${Math.round(size*0.56)} ${Math.round(half*0.94)} ${Math.round(size*0.56)} s${Math.round(half*0.94)}-${Math.round(size*0.2)} ${Math.round(half*0.94)}-${Math.round(size*0.56)} C${Math.round(size*0.935)} ${Math.round(half*0.55)} ${Math.round(half*1.6)} 2 ${half} 2z"
            fill="url(#sfgrd_${category})" stroke="white" stroke-width="3"/>
          <circle cx="${half}" cy="${half}" r="${Math.round(half*0.56)}" fill="white" opacity="0.97"/>
          <text x="${half}" y="${Math.round(half*1.18)}" text-anchor="middle" font-size="${Math.round(half*0.72)}" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${cfg.emoji}</text>
        </g>
        <text x="${totalW - 10}" y="22" text-anchor="middle" font-size="20" font-family="Apple Color Emoji,Segoe UI Emoji,sans-serif">👑</text>
      </svg>
    </div>`,
    iconSize: [totalW, totalH],
    iconAnchor: [totalW / 2, totalH - pad / 2],
    popupAnchor: [0, -(totalH - pad / 2)],
  });
  _superIconCache.set(category, icon);
  return icon;
};

const _tearDropCache = new Map<string, L.DivIcon>();
const makeTearDropIcon = (emoji: string, size = 48, color = PIN_ORANGE) => {
  const cacheKey = `${emoji}_${size}_${color}`;
  if (_tearDropCache.has(cacheKey)) return _tearDropCache.get(cacheKey)!;
  const half = size / 2;
  const icon = L.divIcon({
    className: "",
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${Math.round(size * 1.2)}" viewBox="0 0 ${size} ${Math.round(size * 1.2)}">
      <defs>
        <filter id="pds" x="-40%" y="-30%" width="180%" height="180%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,0.32)"/>
        </filter>
      </defs>
      <g filter="url(#pds)">
        <path d="M${half} 2C${Math.round(half * 0.4)} 2 ${Math.round(half * 0.06)} ${Math.round(half * 0.55)} ${Math.round(half * 0.06)} ${Math.round(half)} c0 ${Math.round(half * 0.75)} ${Math.round(half * 0.94)} ${Math.round(size * 0.56)} ${Math.round(half * 0.94)} ${Math.round(size * 0.56)} s${Math.round(half * 0.94)}-${Math.round(size * 0.2)} ${Math.round(half * 0.94)}-${Math.round(size * 0.56)} C${Math.round(size * 0.935)} ${Math.round(half * 0.55)} ${Math.round(half * 1.6)} 2 ${half} 2z"
          fill="${color}"/>
        <circle cx="${half}" cy="${half}" r="${Math.round(half * 0.58)}" fill="white"/>
        <text x="${half}" y="${Math.round(half * 1.18)}" text-anchor="middle" font-size="${Math.round(half * 0.68)}" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${emoji}</text>
      </g>
    </svg>`,
    iconSize: [size, Math.round(size * 1.2)],
    iconAnchor: [half, Math.round(size * 1.2)],
    popupAnchor: [0, -Math.round(size * 1.2)],
  });
  _tearDropCache.set(cacheKey, icon);
  return icon;
};

const makeSpotIcon = (type: string, _color: string) => {
  const emoji = categoryConfig[type]?.emoji || "📍";
  return makeTearDropIcon(emoji, 46);
};

const makeEventIcon = (category: string) => {
  const cfg = eventCategoryConfig[category?.toLowerCase()] || eventCategoryConfig.default;
  return makeTearDropIcon(cfg.emoji, 46, cfg.color);
};

const _userIconCache = new Map<string, L.DivIcon>();
const makeUserIcon = (displayName: string, _role: string | null, profilePicture?: string) => {
  const initial = (displayName || "?").charAt(0).toUpperCase();
  const cacheKey = profilePicture ? `pic_${profilePicture}` : `init_${initial}`;
  if (_userIconCache.has(cacheKey)) return _userIconCache.get(cacheKey)!;
  const size = 44;
  const half = size / 2;
  if (profilePicture) {
    const icon = L.divIcon({
      className: "",
      html: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <defs>
          <clipPath id="cp-${initial}"><circle cx="${half}" cy="${half}" r="${half - 2}"/></clipPath>
          <filter id="uds" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="3" stdDeviation="3.5" flood-color="rgba(124,58,237,0.45)"/>
          </filter>
        </defs>
        <g filter="url(#uds)">
          <circle cx="${half}" cy="${half}" r="${half - 1}" fill="${USER_PURPLE}" stroke="white" stroke-width="3"/>
          <image href="${sanitizeImgUrl(profilePicture)}" x="3" y="3" width="${size - 6}" height="${size - 6}" clip-path="url(#cp-${initial})" preserveAspectRatio="xMidYMid slice"/>
        </g>
      </svg>`,
      iconSize: [size, size],
      iconAnchor: [half, half],
      popupAnchor: [0, -half - 4],
    });
    _userIconCache.set(cacheKey, icon);
    return icon;
  }
  const icon = L.divIcon({
    className: "",
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs>
        <filter id="uds2" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="3.5" flood-color="rgba(124,58,237,0.45)"/>
        </filter>
      </defs>
      <g filter="url(#uds2)">
        <circle cx="${half}" cy="${half}" r="${half - 1}" fill="${USER_PURPLE}" stroke="white" stroke-width="3"/>
        <text x="${half}" y="${Math.round(half + 7)}" text-anchor="middle" font-size="18" font-weight="700" fill="white" font-family="-apple-system,BlinkMacSystemFont,Arial,sans-serif">${initial}</text>
      </g>
    </svg>`,
    iconSize: [size, size],
    iconAnchor: [half, half],
    popupAnchor: [0, -half - 4],
  });
  _userIconCache.set(cacheKey, icon);
  return icon;
};

const makeUserLocationIcon = () =>
  L.divIcon({
    className: "",
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="54" height="54" viewBox="0 0 54 54">
      <defs>
        <filter id="hds" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="rgba(255,77,0,0.45)"/>
        </filter>
      </defs>
      <g filter="url(#hds)">
        <path d="M27 46 C27 46 8 33 8 20 C8 13 14 9 20 11.5 C22.5 12.5 25 15 27 18 C29 15 31.5 12.5 34 11.5 C40 9 46 13 46 20 C46 33 27 46 27 46Z" fill="${PIN_ORANGE}" stroke="white" stroke-width="2.5"/>
      </g>
    </svg>`,
    iconSize: [54, 54],
    iconAnchor: [27, 46],
    popupAnchor: [0, -46],
  });

function MapCenterController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  const prevRef = useRef<{ center: [number, number]; zoom: number } | null>(null);
  useEffect(() => {
    const prev = prevRef.current;
    if (prev && prev.center[0] === center[0] && prev.center[1] === center[1] && prev.zoom === zoom) return;
    prevRef.current = { center, zoom };
    try {
      map.setView(center, zoom, { animate: true, duration: 0.4 });
    } catch {
      // Map was unmounted during animation — ignore
    }
  }, [center, zoom]);
  return null;
}

function FlyToController({ target }: { target: { lat: number; lng: number; zoom: number } | null }) {
  const map = useMap();
  const prevRef = useRef<{ lat: number; lng: number; zoom: number } | null>(null);
  useEffect(() => {
    if (!target) return;
    const prev = prevRef.current;
    if (prev && prev.lat === target.lat && prev.lng === target.lng) return;
    prevRef.current = target;
    try {
      map.flyTo([target.lat, target.lng], target.zoom, { animate: true, duration: 1.0 });
    } catch {
      // ignore unmount
    }
  }, [target, map]);
  return null;
}

function MapMoveHandler({ onMove }: { onMove: (center: { lat: number; lng: number }) => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useMapEvents({
    moveend(e) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        try {
          const c = e.target.getCenter();
          onMove({ lat: c.lat, lng: c.lng });
        } catch {
          // Map was unmounted before the timer fired — ignore
        }
      }, 600);
    },
  });
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
  return null;
}

function MapZoomTracker({ onZoom }: { onZoom: (z: number) => void }) {
  useMapEvents({
    zoomend(e) {
      try {
        onZoom(e.target.getZoom());
      } catch {
        // Map was unmounted — ignore
      }
    },
  });
  return null;
}

// Tracks visible map bounds and reports them back — debounced to avoid thrashing React on every pan frame
function BoundsTracker({ onBounds }: { onBounds: (b: L.LatLngBounds) => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emit = useCallback((map: L.Map) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try { onBounds(map.getBounds()); } catch { /* unmounted */ }
    }, 120);
  }, [onBounds]);

  const map = useMapEvents({
    moveend: (e) => emit(e.target),
    zoomend: (e) => emit(e.target),
    resize:  (e) => emit(e.target),
  });
  useEffect(() => {
    onBounds(map.getBounds());
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);
  return null;
}

const createClusterCustomIcon = (cluster: any) => {
  const count = cluster.getChildCount();
  const isLarge = count >= 20;
  return L.divIcon({
    html: `<div class="city-cluster-inner${isLarge ? " large" : ""}">${count}</div>`,
    className: "city-cluster",
    iconSize: L.point(isLarge ? 46 : 38, isLarge ? 46 : 38, true),
  });
};

interface LeafletMapViewProps {
  events: any[];
  locations: Location[];
  mapUsers?: MapUser[];
  citySpots?: CitySpot[];
  spotlights?: any[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filters: MapFilters;
  setFilters: (f: MapFilters) => void;
  onMapCenterChange?: (center: { lat: number; lng: number }) => void;
  isAuthenticated?: boolean;
  isAdmin?: boolean;
  onFindMySpot?: () => void;
  initialLat?: number;
  initialLng?: number;
  initialSpotId?: number;
}

type SearchResultType = "address" | "spot" | "event" | "category";
interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  lat?: number;
  lng?: number;
  category?: string;
  color?: string;
}

export default function LeafletMapView({
  events, locations, mapUsers = [], citySpots = [], spotlights = [],
  searchQuery, setSearchQuery,
  filters, setFilters,
  onMapCenterChange,
  isAuthenticated = false,
  isAdmin = false,
  onFindMySpot,
  initialLat,
  initialLng,
  initialSpotId,
}: LeafletMapViewProps) {
  const { toast } = useToast();
  const { language } = useLanguage();
  const [, navigate] = useLocation();
  const [selectedReviewPlace, setSelectedReviewPlace] = useState<any | null>(null);
  // Fetch user's saved OSM spots
  const { data: savedLocationsData } = useQuery<any[]>({
    queryKey: ["/api/users/saved-locations"],
    enabled: isAuthenticated,
  });

  const savedOsmIds = useMemo(() => {
    return new Set<number>((savedLocationsData || []).filter((d: any) => d.osmId != null).map((d: any) => Number(d.osmId)));
  }, [savedLocationsData]);

  const saveOsmSpotMutation = useMutation({
    mutationFn: ({ osmId, name, category, lat, lon, address }: { osmId: number; name: string; category: string; lat: number; lon: number; address?: string }) =>
      apiRequest(`/api/city-spots/${osmId}/save`, "POST", { name, category, lat, lon, address }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/saved-locations"] });
      toast({ title: "Spot saved!", description: "Added to your saved spots" });
    },
    onError: () => toast({ title: "Error", description: "Failed to save spot", variant: "destructive" }),
  });

  const unsaveOsmSpotMutation = useMutation({
    mutationFn: (osmId: number) => apiRequest(`/api/city-spots/${osmId}/save`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/saved-locations"] });
      toast({ title: "Removed", description: "Spot removed from saved" });
    },
    onError: () => toast({ title: "Error", description: "Failed to unsave spot", variant: "destructive" }),
  });

  // If deep-linked from community/spots, start at that location
  const startCenter: [number, number] =
    initialLat !== undefined && initialLng !== undefined && !isNaN(initialLat) && !isNaN(initialLng)
      ? [initialLat, initialLng]
      : DEFAULT_CENTER;
  const startZoom = initialLat !== undefined && initialLng !== undefined ? 17 : DEFAULT_ZOOM;

  const [mapCenter, setMapCenter] = useState<[number, number]>(startCenter);
  const [mapZoom, setMapZoom] = useState(startZoom);
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM);
  // Bounds start covering all of the Netherlands so no spots are hidden on first render.
  // The BoundsTracker will narrow this to the actual viewport immediately after mount.
  const [mapBounds, setMapBounds] = useState<{ south: number; north: number; west: number; east: number }>({
    south: 50.7, north: 53.6, west: 3.3, east: 7.3, // full Netherlands bbox
  });
  const boundsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boundsInitialized = useRef(false);
  const handleBoundsChange = useCallback((bounds: L.LatLngBounds) => {
    const b = { south: bounds.getSouth(), north: bounds.getNorth(), west: bounds.getWest(), east: bounds.getEast() };
    if (!boundsInitialized.current) {
      // First call: set immediately (no delay) so the correct viewport applies fast
      boundsInitialized.current = true;
      setMapBounds(b);
      return;
    }
    if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
    boundsTimerRef.current = setTimeout(() => setMapBounds(b), 250);
  }, []);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [mapOverlayOpen, setMapOverlayOpen] = useState(false);
  const [adminMapDefaultTab, setAdminMapDefaultTab] = useState<"stats" | "actions" | "spots" | "ai">("stats");
  const [showAdminNotes, setShowAdminNotes] = useState(false);
  const [clusterColor, setClusterColor] = useState<string>(() => {
    return localStorage.getItem("mapClusterColor") || "#0D9488";
  });
  const [filterTab, setFilterTab] = useState<"layers" | "categories" | "events" | "people">("categories");
  const [categorySearch, setCategorySearch] = useState("");
  const [flyToTarget, setFlyToTarget] = useState<{ lat: number; lng: number; zoom: number } | null>(null);

  const [inputValue, setInputValue] = useState(searchQuery);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [addressResults, setAddressResults] = useState<NominatimResult[]>([]);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const addressSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unfeatureMutation = useMutation({
    mutationFn: (spotlightId: number) => apiRequest(`/api/admin/city-spots/spotlights/${spotlightId}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/city-spots/spotlights"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/city-spots/spotlights"] });
      toast({ title: "Place unfeatured", description: "The gold star was removed. The spot stays on the map as a regular place." });
    },
    onError: () => toast({ title: "Failed to unfeature", variant: "destructive" }),
  });

  const featureMutation = useMutation({
    mutationFn: (spot: { name: string; lat: number; lon: number; category: string; address?: string; osmId?: number | null }) =>
      apiRequest("/api/admin/city-spots/spotlights", "POST", spot),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/city-spots/spotlights"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/city-spots/spotlights"] });
      toast({ title: "Place featured!", description: "A gold marker has been added to the map." });
    },
    onError: () => toast({ title: "Failed to feature place", variant: "destructive" }),
  });

  const refeatureMutation = useMutation({
    mutationFn: (spotlightId: number) =>
      apiRequest(`/api/admin/city-spots/spotlights/${spotlightId}`, "PATCH", { active: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/city-spots/spotlights"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/city-spots/spotlights"] });
      toast({ title: "Place featured!", description: "A gold marker has been added to the map." });
    },
    onError: () => toast({ title: "Failed to feature place", variant: "destructive" }),
  });

  const createScheduleMutation = useMutation({
    mutationFn: async (spotlightId: number) => {
      const res = await apiRequest(`/api/admin/spot-assignments/${spotlightId}/link`, "POST", {});
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/city-spots/spotlights"] });
      toast({ title: "Schedule page created!", description: "You can now add sessions to this spot." });
      if (data?.locationId) navigate(`/locations/${data.locationId}`);
    },
    onError: () => toast({ title: "Failed to create schedule", variant: "destructive" }),
  });

  const superFeatureMutation = useMutation({
    mutationFn: async ({ spotlightId, enable }: { spotlightId: number; enable: boolean }) => {
      const res = await apiRequest(`/api/admin/city-spots/spotlights/${spotlightId}`, "PATCH", { isSuperFeatured: enable });
      return { data: await res.json(), enable };
    },
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/city-spots/spotlights"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/city-spots/spotlights"] });
      toast({ title: vars.enable ? "👑 Super Featured!" : "Super feature removed", description: vars.enable ? "This spot now has a crown marker." : "Back to regular featured status." });
    },
    onError: () => toast({ title: "Failed to update super feature status", variant: "destructive" }),
  });

  const featureThenScheduleMutation = useMutation({
    mutationFn: async (spot: { name: string; lat: number; lon: number; category: string; address?: string; osmId?: number | null }) => {
      const spotlightRes = await apiRequest("/api/admin/city-spots/spotlights", "POST", spot);
      const spotlight: any = await spotlightRes.json();
      const scheduleRes = await apiRequest(`/api/admin/spot-assignments/${spotlight.id}/link`, "POST", {});
      const schedule: any = await scheduleRes.json();
      return { ...schedule, spotlightId: spotlight.id };
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/city-spots/spotlights"] });
      toast({ title: "✅ Spot featured & schedule created!", description: "You can now add sessions." });
      if (data?.locationId) navigate(`/locations/${data.locationId}`);
    },
    onError: () => toast({ title: "Failed to feature & create schedule", variant: "destructive" }),
  });

  const featureThenAssignMutation = useMutation({
    mutationFn: async (spot: { name: string; lat: number; lon: number; category: string; address?: string; osmId?: number | null }) => {
      const res = await apiRequest("/api/admin/city-spots/spotlights", "POST", spot);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/city-spots/spotlights"] });
      toast({ title: "✅ Spot featured!", description: "Now you can assign an owner in Spot Assignments." });
      navigate("/admin/spot-assignments");
    },
    onError: () => toast({ title: "Failed to feature place", variant: "destructive" }),
  });

  const featureThenSuperMutation = useMutation({
    mutationFn: async (spot: { name: string; lat: number; lon: number; category: string; address?: string; osmId?: number | null }) => {
      const spotlightRes = await apiRequest("/api/admin/city-spots/spotlights", "POST", spot);
      const spotlight: any = await spotlightRes.json();
      await apiRequest(`/api/admin/city-spots/spotlights/${spotlight.id}`, "PATCH", { isSuperFeatured: true });
      return spotlight;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/city-spots/spotlights"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/city-spots/spotlights"] });
      toast({ title: "👑 Super Featured!", description: "This spot now has a crown marker on the map." });
    },
    onError: () => toast({ title: "Failed to super feature place", variant: "destructive" }),
  });

  const spotlightLocationMutation = useMutation({
    mutationFn: async (locationId: number) => {
      const res = await apiRequest(`/api/admin/locations/${locationId}/spotlight`, "POST", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/city-spots/spotlights"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/city-spots/spotlights"] });
      toast({ title: "⭐ Spotlighted!", description: "Location is now featured on the map." });
    },
    onError: (e: any) => toast({ title: "Failed to spotlight", description: e?.message || "Spot may not be approved yet", variant: "destructive" }),
  });

  const deleteLocationMutation = useMutation({
    mutationFn: async (locationId: number) => {
      await apiRequest(`/api/locations/${locationId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      toast({ title: "🗑️ Deleted", description: "Location removed from the map." });
    },
    onError: () => toast({ title: "Failed to delete location", variant: "destructive" }),
  });

  const parseCoord = (v: any) => (typeof v === "number" ? v : parseFloat(String(v || "")));
  const validCoord = (lat: any, lng: any) => {
    const la = parseCoord(lat), lo = parseCoord(lng);
    return !isNaN(la) && !isNaN(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180;
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Load cluster color from server settings on mount
  const { data: appSettings } = useQuery<Record<string, string>>({
    queryKey: ["/api/app-settings"],
    staleTime: 5 * 60 * 1000,
  });

  // All admin-created custom spots (osmId=null) — active ones shown as featured outside cluster,
  // inactive ones shown as regular clustered markers so they're always visible on the map
  const { data: customMapSpots } = useQuery<any[]>({
    queryKey: ["/api/city-spots/map-custom"],
    staleTime: 10 * 60 * 1000,
  });
  useEffect(() => {
    if (appSettings?.mapClusterColor) {
      setClusterColor(appSettings.mapClusterColor);
    }
  }, [appSettings]);

  // Sync cluster color to CSS variable so clusters render with admin-chosen color
  useEffect(() => {
    // Convert hex to rgba for the background
    const hex = (clusterColor || "#0D9488").replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16) || 13;
    const g = parseInt(hex.slice(2, 4), 16) || 148;
    const b = parseInt(hex.slice(4, 6), 16) || 136;
    document.documentElement.style.setProperty("--cluster-color", `rgba(${r},${g},${b},0.92)`);
    document.documentElement.style.setProperty("--cluster-ring", `rgba(${r},${g},${b},0.18)`);
    localStorage.setItem("mapClusterColor", clusterColor);
  }, [clusterColor]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    setSearchQuery(val);
    setShowSearchResults(true);
    if (addressSearchTimer.current) clearTimeout(addressSearchTimer.current);
    if (val.length >= 3) {
      addressSearchTimer.current = setTimeout(async () => {
        const results = await searchAddress(val, 5);
        setAddressResults(results);
      }, 400);
    } else {
      setAddressResults([]);
    }
  };

  const handleClearSearch = () => {
    setInputValue("");
    setSearchQuery("");
    setAddressResults([]);
    setShowSearchResults(false);
  };

  const localResults = useMemo((): SearchResult[] => {
    if (!inputValue || inputValue.length < 2) return [];
    const term = inputValue.toLowerCase();
    const results: SearchResult[] = [];
    Object.entries(categoryConfig)
      .filter(([k, c]) => c.label.toLowerCase().includes(term) || k.includes(term))
      .slice(0, 3)
      .forEach(([key, c]) => results.push({ id: `cat-${key}`, type: "category", title: c.label, subtitle: "Filter by category", category: key, color: c.color }));
    (locations || [])
      .filter(s => s.name?.toLowerCase().includes(term) || s.address?.toLowerCase().includes(term))
      .slice(0, 5)
      .forEach(s => results.push({
        id: `spot-${s.id}`, type: "spot",
        title: s.name || "Spot",
        subtitle: s.address || categoryConfig[s.type as string]?.label || "Spot",
        lat: parseCoord(s.latitude), lng: parseCoord(s.longitude),
        category: s.type as string,
        color: categoryConfig[s.type as string]?.color,
      }));
    (events || [])
      .filter(e => e.title?.toLowerCase().includes(term) || e.location?.toLowerCase().includes(term))
      .slice(0, 4)
      .forEach(e => results.push({
        id: `event-${e.id}`, type: "event",
        title: e.title || "Event",
        subtitle: e.location || "",
        lat: parseCoord(e.latitude), lng: parseCoord(e.longitude),
      }));
    return results;
  }, [inputValue, locations, events]);

  const handleLocalResultSelect = (result: SearchResult) => {
    if (result.type === "category") {
      setFilters({ ...filters, showSpots: true, showEvents: true, categories: [result.category!] });
      toast({ title: `Showing ${result.title} spots` });
    } else if (result.lat !== undefined && result.lng !== undefined && validCoord(result.lat, result.lng)) {
      setMapCenter([result.lat, result.lng]);
      setMapZoom(16);
    }
    setInputValue(result.title);
    setSearchQuery(result.title);
    setShowSearchResults(false);
    setAddressResults([]);
  };

  const handleAddressSelect = (r: NominatimResult) => {
    setMapCenter([parseFloat(r.lat), parseFloat(r.lon)]);
    setMapZoom(16);
    setInputValue(r.display_name.split(",").slice(0, 2).join(", "));
    setSearchQuery(r.display_name);
    setShowSearchResults(false);
    setAddressResults([]);
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Not supported", description: "Your browser doesn't support geolocation", variant: "destructive" });
      return;
    }
    toast({ title: "Getting location..." });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const ll: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(ll);
        setMapCenter(ll);
        setMapZoom(16);
        toast({ title: "Location found" });
      },
      () => toast({ title: "Location error", description: "Could not get your location", variant: "destructive" }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const toggleCategory = (cat: string) => {
    const isOn = filters.categories.includes(cat);
    const cats = isOn
      ? filters.categories.filter(c => c !== cat)
      : [...filters.categories, cat];
    // Auto-enable any layer this category targets so the user actually sees results.
    const def = UNIFIED_CATEGORIES[cat];
    const targetsLoc   = !!def?.locationTypes?.length;
    const targetsCity  = !!def?.cityCategories?.length;
    const targetsEvent = !!def?.eventCategories?.length;
    setFilters({
      ...filters,
      categories: cats,
      // Clear any legacy parallel selections so they can't desync the filter intent.
      citySpotCategories: [],
      showSpots:     filters.showSpots     || (!isOn && targetsLoc),
      showCitySpots: filters.showCitySpots || (!isOn && targetsCity),
      showEvents:    filters.showEvents    || (!isOn && targetsEvent),
    });
  };

  const toggleRole = (role: string) => {
    const roles = filters.peopleRoles.includes(role)
      ? filters.peopleRoles.filter(r => r !== role)
      : [...filters.peopleRoles, role];
    setFilters({ ...filters, peopleRoles: roles });
  };

  // Unified category selection — drives filtering across ALL layers so picking
  // "Cafe" hides music events, picking "Music" hides cafés, etc. This is the
  // accuracy guarantee: if any category is selected, every layer is narrowed.
  const selectedSets = useMemo(() => buildSelectedSets(filters.categories), [filters.categories]);
  const hasUnifiedFilter = filters.categories.length > 0;

  const filteredLocations = useMemo(() => {
    if (!filters.showSpots) return [];
    return (locations || []).filter(s => {
      if (!validCoord(s.latitude, s.longitude)) return false;
      if (hasUnifiedFilter && !selectedSets.locTypes.has(String(s.type))) return false;
      return true;
    });
  }, [locations, filters.showSpots, hasUnifiedFilter, selectedSets]);

  const filteredEvents = useMemo(() => {
    if (!filters.showEvents) return [];
    const raw = (events || []).filter((e: any) => {
      if (!validCoord(e.latitude, e.longitude)) return false;
      const ec = e.category?.toLowerCase() || "";
      if (filters.eventCategories.length > 0 && !filters.eventCategories.includes(ec)) return false;
      // Unified category selection narrows events too (e.g. "Music" → music events only).
      if (hasUnifiedFilter && !selectedSets.eventCats.has(ec)) return false;
      return true;
    });
    // Events arrive sorted by date asc — deduplicate by title+location so recurring events
    // (same venue, multiple dates) show as ONE pin with the earliest upcoming date.
    const seen = new Map<string, { event: any; count: number }>();
    for (const e of raw) {
      const key = `${e.title}__${e.latitude}__${e.longitude}`;
      if (!seen.has(key)) {
        seen.set(key, { event: e, count: 1 });
      } else {
        seen.get(key)!.count++;
      }
    }
    return Array.from(seen.values());
  }, [events, filters.showEvents, filters.eventCategories, hasUnifiedFilter, selectedSets]);

  const filteredUsers = useMemo(() => {
    if (!filters.showPeople) return [];
    return (mapUsers || []).filter(u => {
      if (!validCoord(u.coarseLat, u.coarseLng)) return false;
      if (filters.peopleRoles.length > 0 && !filters.peopleRoles.includes(u.role?.toLowerCase() || "")) return false;
      return true;
    });
  }, [mapUsers, filters.showPeople, filters.peopleRoles]);

  const activeSpotlights = useMemo(() => (spotlights || []).filter((s: any) => s.active !== false), [spotlights]);
  const spotlightSet = useMemo(() => new Set(activeSpotlights.map((s: any) => s.osmId)), [activeSpotlights]);
  const superFeaturedSet = useMemo(() => new Set(activeSpotlights.filter((s: any) => s.isSuperFeatured).map((s: any) => s.osmId)), [activeSpotlights]);
  // O(1) lookup map for featured OSM spots only
  const spotlightByOsmId = useMemo(() => {
    const m = new Map<number, any>();
    activeSpotlights.filter((s: any) => s.osmId != null).forEach((s: any) => m.set(s.osmId, s));
    return m;
  }, [activeSpotlights]);

  const filteredCitySpots = useMemo(() => {
    if (!filters.showCitySpots) return [];
    // Skip distanceSort here — it will be applied post-viewport-cull for efficiency
    return (citySpots || []).filter(s => {
      if (!s.lat || !s.lon) return false;
      // Super-featured (👑) spots bypass the openNow filter so they always anchor
      // the map — but they STILL respect explicit category selections so the user's
      // intent ("show me only cafés") is never violated by editorial promotion.
      const isSuperFeatured = superFeaturedSet.has(s.id);
      if (hasUnifiedFilter && !selectedSets.cityCats.has(s.category)) return false;
      if (!isSuperFeatured && filters.openNow && !isOpenNow(s.opening_hours)) return false;
      return true;
    });
  }, [citySpots, filters.showCitySpots, hasUnifiedFilter, selectedSets, filters.openNow, superFeaturedSet]);

  // ── Viewport-culled spots: only render markers visible in the current map viewport + 30% buffer
  // This is the PRIMARY performance improvement — reduces 6,000+ markers to ~80-400 in the DOM.
  // Default rule: ALL spots cluster normally. Only super-featured (👑) spots break out below.
  const viewportNonFeatured = useMemo(() => {
    if (!filters.showCitySpots || currentZoom < 10) return [];
    const buf = 0.25;
    const dLat = (mapBounds.north - mapBounds.south) * buf;
    const dLng = (mapBounds.east - mapBounds.west) * buf;
    const minLat = mapBounds.south - dLat, maxLat = mapBounds.north + dLat;
    const minLng = mapBounds.west - dLng, maxLng = mapBounds.east + dLng;
    let visible = filteredCitySpots.filter(s =>
      !superFeaturedSet.has(s.id) &&
      s.lat >= minLat && s.lat <= maxLat &&
      s.lon >= minLng && s.lon <= maxLng
    );
    // Apply distanceSort AFTER viewport cull — much cheaper than sorting 6000+ items
    if (filters.distanceSort && userLocation) {
      const [ulat, ulng] = userLocation;
      visible = [...visible].sort((a, b) => haversineKm(ulat, ulng, a.lat, a.lon) - haversineKm(ulat, ulng, b.lat, b.lon));
    }
    // Zoom-aware cap: at lower zoom show fewer spots (clustering covers density), more at higher zoom.
    const cap = currentZoom >= 15 ? 600 : currentZoom >= 14 ? 500 : currentZoom >= 12 ? 400 : currentZoom >= 11 ? 200 : 80;
    return visible.length > cap ? visible.slice(0, cap) : visible;
  }, [filteredCitySpots, mapBounds, currentZoom, filters.showCitySpots, superFeaturedSet, filters.distanceSort, userLocation]);

  // Only super-featured (👑) spots break out of the cluster.
  // Plain "featured" (⭐) spots cluster like any other spot — admin must explicitly
  // upgrade to Super Featured to make a spot break out.
  const viewportFeatured = useMemo(() => {
    if (!filters.showCitySpots) return [];
    const buf = 0.4;
    const dLat = (mapBounds.north - mapBounds.south) * buf;
    const dLng = (mapBounds.east - mapBounds.west) * buf;
    const minLat = mapBounds.south - dLat, maxLat = mapBounds.north + dLat;
    const minLng = mapBounds.west - dLng, maxLng = mapBounds.east + dLng;
    return filteredCitySpots.filter(s =>
      superFeaturedSet.has(s.id) &&
      s.lat >= minLat && s.lat <= maxLat &&
      s.lon >= minLng && s.lon <= maxLng
    );
  }, [filteredCitySpots, mapBounds, filters.showCitySpots, superFeaturedSet]);

  const hasActiveFilters = filters.categories.length > 0 || filters.peopleRoles.length > 0 || filters.eventCategories.length > 0 || !filters.showEvents || !filters.showSpots || filters.showPeople || filters.showCitySpots || filters.distanceSort || filters.openNow;
  const activeFilterCount = [
    ...filters.categories, ...filters.eventCategories, ...filters.peopleRoles,
    filters.distanceSort && 'ds', filters.openNow && 'on',
    !filters.showEvents && 'ne', !filters.showSpots && 'ns',
    filters.showPeople && 'sp',
  ].filter(Boolean).length;

  return (
    <div className="relative w-full h-full" style={{ willChange: "transform" }}>
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        className="w-full h-full z-0"
        zoomControl={true}
        preferCanvas={true}
        zoomSnap={0.5}
        zoomDelta={0.5}
        wheelPxPerZoomLevel={80}
        markerZoomAnimation={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
          keepBuffer={4}
          updateWhenIdle={true}
          updateWhenZooming={false}
        />

        <MapCenterController center={mapCenter} zoom={mapZoom} />
        <MapMoveHandler onMove={(c) => { onMapCenterChange?.(c); }} />
        <MapZoomTracker onZoom={setCurrentZoom} />
        <FlyToController target={flyToTarget} />
        <BoundsTracker onBounds={handleBoundsChange} />

        <MarkerClusterGroup
          chunkedLoading
          chunkInterval={50}
          chunkDelay={30}
          maxClusterRadius={160}
          disableClusteringAtZoom={17}
          iconCreateFunction={createClusterCustomIcon}
          animate={false}
          animateAddingMarkers={false}
          spiderfyOnMaxZoom={true}
          showCoverageOnHover={false}
          zoomToBoundsOnClick={true}
          removeOutsideVisibleBounds={true}
        >
          {filteredEvents.map(({ event, count }) => (
            <Marker
              key={`event-${event.id}`}
              position={[parseCoord(event.latitude), parseCoord(event.longitude)]}
              icon={makeEventIcon(event.category)}
            >
              <Popup maxWidth={280}>
                <div className="p-1">
                  <h3 className="font-semibold text-sm mb-1" style={{ color: "hsl(215,25%,12%)" }}>{event.titleEn && language === "en" ? event.titleEn : event.title}</h3>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {event.category && (() => {
                      const cfg = eventCategoryConfig[event.category?.toLowerCase()] || eventCategoryConfig.default;
                      return (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: cfg.color, color: "#fff" }}>
                          {cfg.emoji} {cfg.label}
                        </span>
                      );
                    })()}
                    {count > 1 && (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: "hsl(215,25%,90%)", color: "hsl(215,25%,35%)" }}>
                        🗓️ {count} dates
                      </span>
                    )}
                  </div>
                  {(event.description || event.descriptionEn) && <p className="text-xs mb-2 line-clamp-2" style={{ color: "hsl(215,25%,40%)" }}>{event.descriptionEn && language === "en" ? event.descriptionEn : event.description}</p>}
                  {event.date && (
                    <p className="text-xs mb-1" style={{ color: "hsl(215,25%,55%)" }}>📅 {count > 1 ? `Next: ${new Date(event.date).toLocaleDateString()}` : new Date(event.date).toLocaleDateString()}</p>
                  )}
                  {event.location && <p className="text-xs mb-2" style={{ color: "hsl(215,25%,55%)" }}>📍 {event.location}</p>}
                  <button
                    className="w-full text-xs font-medium text-white rounded-lg px-3 py-1.5 transition-colors"
                    style={{ backgroundColor: "hsl(221,83%,53%)" }}
                    onMouseOver={e => (e.currentTarget.style.backgroundColor = "hsl(221,83%,45%)")}
                    onMouseOut={e => (e.currentTarget.style.backgroundColor = "hsl(221,83%,53%)")}
                    onClick={() => navigate(`/events/${event.id}`)}
                  >
                    {count > 1 ? `View All ${count} Dates` : "View Event"}
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>

        {filteredUsers.map(user => (
          <Marker
            key={`user-${user.userId}`}
            position={[parseCoord(user.coarseLat), parseCoord(user.coarseLng)]}
            icon={makeUserIcon(user.displayName || "", user.role, user.profilePicture)}
          >
            <Popup maxWidth={240}>
              <div className="p-1">
                <div className="flex items-center gap-2 mb-2">
                  {user.profilePicture ? (
                    <img src={user.profilePicture} alt={user.displayName || ""} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                      style={{ backgroundColor: roleConfig[user.role?.toLowerCase() || ""]?.color || "#2196F3" }}
                    >
                      {(user.displayName || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-sm" style={{ color: "hsl(215,25%,12%)" }}>{user.displayName || "Anonymous"}</p>
                    {user.role && (
                      <span
                        className="inline-block px-1.5 py-0.5 rounded-full text-[10px] text-white"
                        style={{ backgroundColor: roleConfig[user.role.toLowerCase()]?.color || "#888" }}
                      >
                        {roleConfig[user.role.toLowerCase()]?.label || user.role}
                      </span>
                    )}
                  </div>
                </div>
                {user.city && <p className="text-xs mb-2" style={{ color: "hsl(215,25%,55%)" }}>📍 {user.city}</p>}
                <div className="flex gap-1.5">
                  <button
                    className="flex-1 text-xs font-medium text-white rounded-lg px-2 py-1.5 transition-colors"
                    style={{ backgroundColor: "hsl(221,83%,53%)" }}
                    onMouseOver={e => (e.currentTarget.style.backgroundColor = "hsl(221,83%,45%)")}
                    onMouseOut={e => (e.currentTarget.style.backgroundColor = "hsl(221,83%,53%)")}
                    onClick={() => navigate(`/profile/${user.userId}`)}
                  >
                    Profile
                  </button>
                  <button
                    className="flex-1 text-xs font-medium rounded-lg px-2 py-1.5 transition-colors"
                    style={{ border: "1px solid hsl(220,13%,91%)", color: "hsl(215,25%,30%)", backgroundColor: "white" }}
                    onMouseOver={e => (e.currentTarget.style.backgroundColor = "hsl(220,13%,96%)")}
                    onMouseOut={e => (e.currentTarget.style.backgroundColor = "white")}
                    onClick={() => navigate(`/chat?userId=${user.userId}`)}
                  >
                    Message
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        <MarkerClusterGroup
          chunkedLoading
          chunkInterval={60}
          chunkDelay={50}
          maxClusterRadius={160}
          disableClusteringAtZoom={17}
          iconCreateFunction={createClusterCustomIcon}
          animate={false}
          animateAddingMarkers={false}
          spiderfyOnMaxZoom={true}
          showCoverageOnHover={false}
          zoomToBoundsOnClick={true}
          removeOutsideVisibleBounds={true}
        >
          {/* ── Community-added user spots — cluster with city spots ── */}
          {filteredLocations.map(spot => (
            <Marker
              key={`spot-${spot.id}`}
              position={[parseCoord(spot.latitude), parseCoord(spot.longitude)]}
              icon={makeSpotIcon(spot.type as string, categoryConfig[spot.type as string]?.color || "#888")}
              zIndexOffset={500}
            >
              <Popup maxWidth={290}>
                <div style={{ fontFamily: "system-ui, sans-serif" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "6px" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `${categoryConfig[spot.type as string]?.color || "#888"}20`, border: `1.5px solid ${categoryConfig[spot.type as string]?.color || "#888"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{categoryConfig[spot.type as string]?.emoji || "📍"}</div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "hsl(215,25%,12%)", lineHeight: 1.3 }}>{spot.name}</h3>
                      <span style={{ display: "inline-block", padding: "1px 8px", borderRadius: 20, fontSize: "10px", fontWeight: 600, color: "white", background: categoryConfig[spot.type as string]?.color || "#888", marginTop: 3 }}>{categoryConfig[spot.type as string]?.label || spot.type}</span>
                    </div>
                  </div>
                  {spot.description && <p style={{ margin: "0 0 8px", fontSize: "11.5px", color: "hsl(215,25%,35%)", lineHeight: 1.5, background: "hsl(215,25%,97%)", borderRadius: 6, padding: "5px 8px" }}>{spot.description}</p>}
                  {spot.address && <p style={{ margin: "0 0 6px", fontSize: "11px", color: "hsl(215,25%,55%)" }}>📍 {spot.address}</p>}
                  <div style={{ display: "flex", gap: 5, marginTop: 8, borderTop: "1px solid hsl(215,25%,90%)", paddingTop: 8 }}>
                    <button
                      onClick={() => navigate(`/locations/${spot.id}`)}
                      style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "5px 8px", borderRadius: 6, fontSize: "11px", fontWeight: 600, background: "hsl(221,83%,53%)", color: "white", border: "none", cursor: "pointer" }}
                      data-testid={`button-view-spot-${spot.id}`}
                    >
                      📋 View Spot
                    </button>
                  </div>
                  {isAdmin && (
                    <div style={{ marginTop: 6, borderTop: "1px dashed hsl(38,80%,75%)", paddingTop: 6 }}>
                      <p style={{ margin: "0 0 5px", fontSize: "10px", fontWeight: 700, color: "hsl(38,60%,38%)", textTransform: "uppercase", letterSpacing: "0.05em" }}>⚙️ Admin Controls</p>
                      <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                        <button
                          onClick={() => navigate(`/locations/${spot.id}`)}
                          style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3, padding: "4px 6px", borderRadius: 5, fontSize: "10px", fontWeight: 600, background: "hsl(221,83%,53%)", color: "white", border: "none", cursor: "pointer" }}
                          data-testid={`button-admin-edit-spot-${spot.id}`}
                        >
                          ✏️ Edit Spot
                        </button>
                        <button
                          onClick={() => spotlightLocationMutation.mutate(spot.id)}
                          disabled={spotlightLocationMutation.isPending}
                          style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3, padding: "4px 6px", borderRadius: 5, fontSize: "10px", fontWeight: 600, background: "hsl(38,92%,50%)", color: "white", border: "none", cursor: "pointer" }}
                          data-testid={`button-admin-feature-spot-${spot.id}`}
                        >
                          ⭐ Feature
                        </button>
                      </div>
                      <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                        <button
                          onClick={() => featureThenScheduleMutation.mutate({ name: spot.name, lat: parseCoord(spot.latitude), lon: parseCoord(spot.longitude), category: spot.type as string, address: spot.address ?? undefined })}
                          disabled={featureThenScheduleMutation.isPending}
                          style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3, padding: "4px 6px", borderRadius: 5, fontSize: "10px", fontWeight: 600, background: "hsl(158,64%,42%)", color: "white", border: "none", cursor: "pointer" }}
                          data-testid={`button-admin-schedule-spot-${spot.id}`}
                        >
                          📅 Create Schedule
                        </button>
                        <a
                          href="/admin/spot-assignments"
                          style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3, padding: "4px 6px", borderRadius: 5, fontSize: "10px", fontWeight: 600, background: "hsl(270,70%,60%)", color: "white", textDecoration: "none", cursor: "pointer" }}
                          data-testid={`link-admin-assign-spot-${spot.id}`}
                        >
                          👤 Assign Owner
                        </a>
                      </div>
                      <button
                        onClick={() => { if (window.confirm(`Delete "${spot.name}"? This cannot be undone.`)) deleteLocationMutation.mutate(spot.id); }}
                        disabled={deleteLocationMutation.isPending}
                        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3, padding: "4px 10px", borderRadius: 5, fontSize: "10px", fontWeight: 600, background: "hsl(0,84%,96%)", color: "hsl(0,72%,50%)", border: "1px solid hsl(0,84%,88%)", cursor: "pointer", width: "100%", boxSizing: "border-box" }}
                        data-testid={`button-admin-delete-spot-${spot.id}`}
                      >
                        🗑️ Delete Spot
                      </button>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}

          {viewportNonFeatured.map(spot => {
            const cfg = citySpotConfig[spot.category] || citySpotConfig.other;
            const description = categoryDescriptions[spot.category] || categoryDescriptions.other;
            return (
              <Marker
                key={`city-${spot.id}`}
                position={[spot.lat, spot.lon]}
                icon={makeCitySpotIcon(spot.category, false)}
              >
                <Popup maxWidth={290}>
                  <div style={{ fontFamily: "system-ui, sans-serif" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "6px" }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${cfg.color}20`, border: `1.5px solid ${cfg.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{cfg.emoji}</div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "hsl(215,25%,12%)", lineHeight: 1.3 }}>{spot.name}</h3>
                        <span style={{ display: "inline-block", padding: "1px 8px", borderRadius: 20, fontSize: "10px", fontWeight: 600, color: "white", background: cfg.color, marginTop: 3 }}>{cfg.label}</span>
                      </div>
                    </div>
                    <p style={{ margin: "0 0 8px", fontSize: "11.5px", color: "hsl(215,25%,35%)", lineHeight: 1.5, background: "hsl(215,25%,97%)", borderRadius: 6, padding: "5px 8px" }}>{description}</p>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 5 }}>
                      {userLocation && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 20, fontSize: "10px", fontWeight: 600, background: "#0EA51A15", color: "#0EA51A", border: "1px solid #0EA51A40" }}>
                          📍 {formatDistance(haversineKm(userLocation[0], userLocation[1], spot.lat, spot.lon))}
                        </span>
                      )}
                      {spot.opening_hours && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 20, fontSize: "10px", fontWeight: 600, background: isOpenNow(spot.opening_hours) ? "#16A34A15" : "#DC262615", color: isOpenNow(spot.opening_hours) ? "#16A34A" : "#DC2626", border: `1px solid ${isOpenNow(spot.opening_hours) ? "#16A34A40" : "#DC262640"}` }}>
                          {isOpenNow(spot.opening_hours) ? "🟢 Open now" : "🔴 Closed"}
                        </span>
                      )}
                    </div>
                    {spot.address && <p style={{ margin: "0 0 3px", fontSize: "11px", color: "hsl(215,25%,55%)" }}>📍 {spot.address}</p>}
                    {spot.opening_hours && <p style={{ margin: "0 0 3px", fontSize: "11px", color: "hsl(215,25%,55%)" }}>🕐 {spot.opening_hours}</p>}
                    {spot.phone && <p style={{ margin: "0 0 3px", fontSize: "11px", color: "hsl(215,25%,55%)" }}>📞 {spot.phone}</p>}
                    {spot.website && (
                      <button
                        onClick={(e) => { e.stopPropagation(); window.open(spot.website, '_blank', 'noopener,noreferrer'); }}
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "11px", color: "hsl(221,83%,53%)", marginTop: 4, background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}
                      >
                        🌐 Visit website ↗
                      </button>
                    )}
                    <div style={{ marginTop: 8, borderTop: "1px solid hsl(215,25%,90%)", paddingTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", gap: 5 }}>
                        <button
                          onClick={() => setSelectedReviewPlace({ osmId: spot.id, name: spot.name, lat: spot.lat, lon: spot.lon, category: spot.category, address: spot.address, opening_hours: spot.opening_hours, website: spot.website })}
                          style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "5px 8px", borderRadius: 6, fontSize: "11px", fontWeight: 600, background: "hsl(221,83%,53%)", color: "white", border: "none", cursor: "pointer" }}
                          data-testid={`button-view-reviews-osm-${spot.id}`}
                        >
                          ★ Details
                        </button>
                        <a
                          href={`/spots/city/${spot.id}`}
                          style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "5px 8px", borderRadius: 6, fontSize: "11px", fontWeight: 600, background: "hsl(158,64%,42%)", color: "white", border: "none", cursor: "pointer", textDecoration: "none" }}
                          data-testid={`link-view-osm-${spot.id}`}
                        >
                          📅 Schedule
                        </a>
                      </div>
                      <button
                        onClick={() => {
                          if (!isAuthenticated) { navigate("/auth"); return; }
                          savedOsmIds.has(spot.id)
                            ? unsaveOsmSpotMutation.mutate(spot.id)
                            : saveOsmSpotMutation.mutate({ osmId: spot.id, name: spot.name, category: spot.category, lat: spot.lat, lon: spot.lon, address: spot.address });
                        }}
                        disabled={saveOsmSpotMutation.isPending || unsaveOsmSpotMutation.isPending}
                        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "5px 10px", borderRadius: 6, fontSize: "11px", fontWeight: 600, background: savedOsmIds.has(spot.id) ? "hsl(142,64%,42%)" : "hsl(215,25%,97%)", color: savedOsmIds.has(spot.id) ? "white" : "hsl(215,25%,40%)", border: `1px solid ${savedOsmIds.has(spot.id) ? "hsl(142,64%,42%)" : "hsl(215,25%,80%)"}`, cursor: "pointer", width: "100%" }}
                        data-testid={`button-save-osm-${spot.id}`}
                      >
                        {savedOsmIds.has(spot.id) ? "✓ Saved" : "🔖 Save Spot"}
                      </button>
                      {isAdmin && (
                        <div style={{ marginTop: 2, borderTop: "1px dashed hsl(38,80%,75%)", paddingTop: 6 }}>
                          <p style={{ margin: "0 0 5px", fontSize: "10px", fontWeight: 700, color: "hsl(38,60%,38%)", textTransform: "uppercase", letterSpacing: "0.05em" }}>⚙️ Admin Controls</p>
                          <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                            <button
                              onClick={() => featureThenScheduleMutation.mutate({ name: spot.name, lat: spot.lat, lon: spot.lon, category: spot.category, address: spot.address, osmId: spot.id })}
                              disabled={featureThenScheduleMutation.isPending}
                              style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3, padding: "4px 6px", borderRadius: 5, fontSize: "10px", fontWeight: 600, background: "hsl(221,83%,53%)", color: "white", border: "none", cursor: "pointer" }}
                              data-testid={`button-create-schedule-osm-${spot.id}`}
                            >
                              📅 Create Schedule
                            </button>
                            <button
                              onClick={() => featureThenAssignMutation.mutate({ name: spot.name, lat: spot.lat, lon: spot.lon, category: spot.category, address: spot.address, osmId: spot.id })}
                              disabled={featureThenAssignMutation.isPending}
                              style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3, padding: "4px 6px", borderRadius: 5, fontSize: "10px", fontWeight: 600, background: "hsl(38,92%,50%)", color: "white", border: "none", cursor: "pointer" }}
                              data-testid={`button-assign-owner-osm-${spot.id}`}
                            >
                              👤 Assign Owner
                            </button>
                          </div>
                          <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                            <button
                              onClick={() => featureMutation.mutate({ name: spot.name, lat: spot.lat, lon: spot.lon, category: spot.category, address: spot.address, osmId: spot.id })}
                              disabled={featureMutation.isPending}
                              style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3, padding: "4px 6px", borderRadius: 5, fontSize: "10px", fontWeight: 600, background: "hsl(38,92%,96%)", color: "hsl(38,60%,40%)", border: "1px solid hsl(38,92%,80%)", cursor: "pointer" }}
                              data-testid={`button-feature-osm-${spot.id}`}
                            >
                              ⭐ Feature
                            </button>
                            <button
                              onClick={() => featureThenSuperMutation.mutate({ name: spot.name, lat: spot.lat, lon: spot.lon, category: spot.category, address: spot.address, osmId: spot.id })}
                              disabled={featureThenSuperMutation.isPending}
                              style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3, padding: "4px 6px", borderRadius: 5, fontSize: "10px", fontWeight: 600, background: "hsl(270,70%,96%)", color: "hsl(270,60%,40%)", border: "1px solid hsl(270,70%,80%)", cursor: "pointer" }}
                              data-testid={`button-super-feature-osm-${spot.id}`}
                            >
                              👑 Super Feature
                            </button>
                          </div>
                          <a
                            href="/admin/analytics"
                            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3, padding: "4px 10px", borderRadius: 5, fontSize: "10px", fontWeight: 600, background: "hsl(215,25%,95%)", color: "hsl(215,25%,40%)", textDecoration: "none", width: "100%", boxSizing: "border-box" }}
                            data-testid={`link-analytics-osm-${spot.id}`}
                          >
                            📊 Analytics
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Admin-created custom spots — clustered by default. Only super-featured (👑) ones
              render outside the cluster (below). Inactive spots are also kept in the cluster
              so they remain findable on the map. */}
          {filters.showCitySpots && (customMapSpots || [])
            .filter((s: any) => !s.isSuperFeatured)
            .filter((s: any) => !hasUnifiedFilter || selectedSets.cityCats.has(s.category))
            .map((s: any) => {
              const cfg = citySpotConfig[s.category] || citySpotConfig.other;
              return (
                <Marker
                  key={`custom-inactive-${s.id}`}
                  position={[s.lat, s.lon]}
                  icon={makeCitySpotIcon(s.category || "other", false)}
                >
                  <Popup maxWidth={280}>
                    <div style={{ fontFamily: "system-ui, sans-serif" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "6px" }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${cfg.color}20`, border: `1.5px solid ${cfg.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{cfg.emoji}</div>
                        <div>
                          <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "hsl(215,25%,12%)", lineHeight: 1.3 }}>{s.name}</h3>
                          <span style={{ display: "inline-block", padding: "1px 8px", borderRadius: 20, fontSize: "10px", fontWeight: 600, color: "white", background: cfg.color, marginTop: 3 }}>{cfg.label}</span>
                        </div>
                      </div>
                      {s.adminNote && <p style={{ margin: "0 0 8px", fontSize: "11.5px", color: "hsl(215,25%,35%)", lineHeight: 1.5, background: "hsl(215,25%,97%)", borderRadius: 6, padding: "5px 8px" }}>{s.adminNote}</p>}
                      {s.address && <p style={{ margin: "0 0 3px", fontSize: "11px", color: "hsl(215,25%,55%)" }}>📍 {s.address}</p>}
                      <div style={{ marginTop: 8, borderTop: "1px solid hsl(215,25%,90%)", paddingTop: 8 }}>
                        <a href={`/spots/spotlight/${s.id}`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "5px 12px", borderRadius: 6, fontSize: "11px", fontWeight: 600, background: "hsl(221,83%,53%)", color: "white", textDecoration: "none" }}>
                          ★ View Details
                        </a>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
        </MarkerClusterGroup>

        {/* ── Spotlight markers — rendered OUTSIDE any cluster group so they always break free ── */}
        {viewportFeatured.map(spot => {
          const cfg = citySpotConfig[spot.category] || citySpotConfig.other;
          const adminSpotlight = spotlightByOsmId.get(spot.id);
          const description = adminSpotlight?.adminNote || categoryDescriptions[spot.category] || categoryDescriptions.other;
          const isSuper = superFeaturedSet.has(spot.id);
          return (
            <Marker
              key={`city-featured-${spot.id}`}
              position={[spot.lat, spot.lon]}
              icon={isSuper ? makeSuperFeaturedIcon(spot.category) : makeCitySpotIcon(spot.category, true)}
              zIndexOffset={isSuper ? 3000 : 2000}
            >
              <Popup maxWidth={300}>
                <div style={{ fontFamily: "system-ui, sans-serif" }}>
                  <div style={{ background: isSuper ? "linear-gradient(135deg,#7C3AED,#A78BFA)" : "linear-gradient(135deg,#F59E0B,#D97706)", borderRadius: "8px 8px 0 0", padding: "6px 10px", margin: "-4px -4px 8px -4px", display: "flex", alignItems: "center", gap: "5px" }}>
                    <span style={{ fontSize: "13px" }}>{isSuper ? "👑" : "⭐"}</span>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "white", letterSpacing: "0.02em" }}>{isSuper ? "Super Featured" : "Featured Spot"}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "6px" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `${cfg.color}20`, border: `1.5px solid ${cfg.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{cfg.emoji}</div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "hsl(215,25%,12%)", lineHeight: 1.3 }}>{spot.name}</h3>
                      <span style={{ display: "inline-block", padding: "1px 8px", borderRadius: 20, fontSize: "10px", fontWeight: 600, color: "white", background: cfg.color, marginTop: 3 }}>{cfg.label}</span>
                    </div>
                  </div>
                  <p style={{ margin: "0 0 8px", fontSize: "11.5px", color: "hsl(215,25%,35%)", lineHeight: 1.5, background: "hsl(215,25%,97%)", borderRadius: 6, padding: "5px 8px" }}>{description}</p>
                  {spot.address && <p style={{ margin: "0 0 3px", fontSize: "11px", color: "hsl(215,25%,55%)" }}>📍 {spot.address}</p>}
                  {spot.opening_hours && <p style={{ margin: "0 0 3px", fontSize: "11px", color: "hsl(215,25%,55%)" }}>🕐 {spot.opening_hours}</p>}
                  {spot.website && (
                    <button
                      onClick={(e) => { e.stopPropagation(); window.open(spot.website, '_blank', 'noopener,noreferrer'); }}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "11px", color: "hsl(221,83%,53%)", marginTop: 4, background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}
                    >
                      🌐 Visit website ↗
                    </button>
                  )}
                  <div style={{ marginTop: 8, borderTop: "1px solid hsl(215,25%,90%)", paddingTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", gap: 5 }}>
                      <button
                        onClick={() => setSelectedReviewPlace({ id: adminSpotlight?.id, name: spot.name, category: spot.category, address: spot.address, opening_hours: spot.opening_hours, website: spot.website, adminNote: description })}
                        style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "5px 8px", borderRadius: 6, fontSize: "11px", fontWeight: 600, background: "hsl(221,83%,53%)", color: "white", border: "none", cursor: "pointer" }}
                        data-testid={`button-view-reviews-osfeatured-${spot.id}`}
                      >
                        ★ Details
                      </button>
                      <a
                        href={adminSpotlight?.linkedLocationId ? `/locations/${adminSpotlight.linkedLocationId}` : `/spots/city/${spot.id}`}
                        style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "5px 8px", borderRadius: 6, fontSize: "11px", fontWeight: 600, background: "hsl(158,64%,42%)", color: "white", border: "none", cursor: "pointer", textDecoration: "none" }}
                        data-testid={`link-view-featured-${spot.id}`}
                      >
                        📅 Schedule
                      </a>
                    </div>
                    <button
                      onClick={() => {
                        if (!isAuthenticated) { navigate("/auth"); return; }
                        savedOsmIds.has(spot.id)
                          ? unsaveOsmSpotMutation.mutate(spot.id)
                          : saveOsmSpotMutation.mutate({ osmId: spot.id, name: spot.name, category: spot.category, lat: spot.lat, lon: spot.lon, address: spot.address });
                      }}
                      disabled={saveOsmSpotMutation.isPending || unsaveOsmSpotMutation.isPending}
                      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "5px 10px", borderRadius: 6, fontSize: "11px", fontWeight: 600, background: savedOsmIds.has(spot.id) ? "hsl(142,64%,42%)" : "hsl(215,25%,97%)", color: savedOsmIds.has(spot.id) ? "white" : "hsl(215,25%,40%)", border: `1px solid ${savedOsmIds.has(spot.id) ? "hsl(142,64%,42%)" : "hsl(215,25%,80%)"}`, cursor: "pointer", width: "100%" }}
                      data-testid={`button-save-featured-osm-${spot.id}`}
                    >
                      {savedOsmIds.has(spot.id) ? "✓ Saved" : "🔖 Save Spot"}
                    </button>
                    {isAdmin && adminSpotlight && (
                      <div style={{ marginTop: 2, borderTop: "1px dashed hsl(38,80%,75%)", paddingTop: 6 }}>
                        <p style={{ margin: "0 0 4px", fontSize: "10px", fontWeight: 700, color: "hsl(38,60%,38%)", textTransform: "uppercase", letterSpacing: "0.05em" }}>⚙️ Admin Controls</p>
                        <p style={{ margin: "0 0 5px", fontSize: "10px", color: adminSpotlight.ownedByUserId ? "hsl(142,64%,38%)" : "hsl(215,25%,55%)" }}>
                          {adminSpotlight.ownedByUserId ? "👤 Owner assigned" : "○ No owner assigned"}
                        </p>
                        <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                          {adminSpotlight.linkedLocationId ? (
                            <a
                              href={`/locations/${adminSpotlight.linkedLocationId}`}
                              style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3, padding: "4px 6px", borderRadius: 5, fontSize: "10px", fontWeight: 600, background: "hsl(221,83%,53%)", color: "white", textDecoration: "none", cursor: "pointer" }}
                              data-testid={`link-manage-schedule-${spot.id}`}
                            >
                              📋 Manage Schedule
                            </a>
                          ) : (
                            <button
                              onClick={() => createScheduleMutation.mutate(adminSpotlight.id)}
                              disabled={createScheduleMutation.isPending}
                              style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3, padding: "4px 6px", borderRadius: 5, fontSize: "10px", fontWeight: 600, background: "hsl(215,25%,97%)", color: "hsl(215,25%,40%)", border: "1px solid hsl(215,25%,80%)", cursor: "pointer" }}
                              data-testid={`button-create-schedule-${spot.id}`}
                            >
                              📅 Create Schedule
                            </button>
                          )}
                          <a
                            href="/admin/spot-assignments"
                            style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3, padding: "4px 6px", borderRadius: 5, fontSize: "10px", fontWeight: 600, background: "hsl(38,92%,50%)", color: "white", textDecoration: "none", cursor: "pointer" }}
                            data-testid={`link-assign-owner-${spot.id}`}
                          >
                            👤 Assign Owner
                          </a>
                        </div>
                        <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                          <button
                            onClick={() => unfeatureMutation.mutate(adminSpotlight.id)}
                            disabled={unfeatureMutation.isPending}
                            style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3, padding: "4px 6px", borderRadius: 5, fontSize: "10px", fontWeight: 600, background: "hsl(0,84%,96%)", color: "hsl(0,72%,50%)", border: "1px solid hsl(0,84%,88%)", cursor: "pointer" }}
                            data-testid={`button-unfeature-osm-${spot.id}`}
                          >
                            ✕ Unfeature
                          </button>
                          <button
                            onClick={() => superFeatureMutation.mutate({ spotlightId: adminSpotlight.id, enable: !adminSpotlight.isSuperFeatured })}
                            disabled={superFeatureMutation.isPending}
                            style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3, padding: "4px 6px", borderRadius: 5, fontSize: "10px", fontWeight: 600, background: adminSpotlight.isSuperFeatured ? "hsl(270,70%,90%)" : "hsl(270,70%,96%)", color: "hsl(270,60%,40%)", border: "1px solid hsl(270,70%,80%)", cursor: "pointer" }}
                            data-testid={`button-super-feature-${spot.id}`}
                          >
                            {adminSpotlight.isSuperFeatured ? "👑 Remove Crown" : "👑 Super Feature"}
                          </button>
                        </div>
                        <a
                          href="/admin/analytics"
                          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3, padding: "4px 10px", borderRadius: 5, fontSize: "10px", fontWeight: 600, background: "hsl(215,25%,95%)", color: "hsl(215,25%,40%)", textDecoration: "none", width: "100%", boxSizing: "border-box" }}
                          data-testid={`link-analytics-${spot.id}`}
                        >
                          📊 Analytics
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Custom admin-created spotlight spots (no OSM ID) — only super-featured (👑) break out
            of the cluster. All others render inside the cluster group above. */}
        {filters.showCitySpots && (spotlights || [])
          .filter((s: any) => s.osmId == null && s.active !== false && s.isSuperFeatured)
          .map((s: any) => {
          const cfg = citySpotConfig[s.category] || citySpotConfig.other;
          const isFeatured = true;
          const isSuper = true;
          return (
            <Marker
              key={`spotlight-${s.id}`}
              position={[s.lat, s.lon]}
              icon={makeSuperFeaturedIcon(s.category)}
              zIndexOffset={3000}
            >
              <Popup maxWidth={300}>
                <div style={{ fontFamily: "system-ui, sans-serif" }}>
                  {isFeatured && (
                    <div style={{ background: isSuper ? "linear-gradient(135deg,#7C3AED,#A78BFA)" : "linear-gradient(135deg,#F59E0B,#D97706)", borderRadius: "8px 8px 0 0", padding: "6px 10px", margin: "-4px -4px 8px -4px", display: "flex", alignItems: "center", gap: "5px" }}>
                      <span style={{ fontSize: "13px" }}>{isSuper ? "👑" : "⭐"}</span>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "white", letterSpacing: "0.02em" }}>{isSuper ? "Super Featured" : "Featured Spot"}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "6px" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `${cfg.color}20`, border: `1.5px solid ${cfg.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{cfg.emoji}</div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "hsl(215,25%,12%)", lineHeight: 1.3 }}>{s.name}</h3>
                      <span style={{ display: "inline-block", padding: "1px 8px", borderRadius: 20, fontSize: "10px", fontWeight: 600, color: "white", background: cfg.color, marginTop: 3 }}>{cfg.label}</span>
                    </div>
                  </div>
                  {s.adminNote && (
                    <p style={{ margin: "0 0 8px", fontSize: "11.5px", color: "hsl(215,25%,35%)", lineHeight: 1.5, background: "hsl(215,25%,97%)", borderRadius: 6, padding: "5px 8px" }}>{s.adminNote}</p>
                  )}
                  {s.address && <p style={{ margin: "0 0 3px", fontSize: "11px", color: "hsl(215,25%,55%)" }}>📍 {s.address}</p>}
                  {s.website && (
                    <button
                      onClick={(e) => { e.stopPropagation(); window.open(s.website, '_blank', 'noopener,noreferrer'); }}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "11px", color: "hsl(221,83%,53%)", marginTop: 4, background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}
                    >
                      🌐 Visit website ↗
                    </button>
                  )}
                  <div style={{ marginTop: 8, borderTop: "1px solid hsl(215,25%,90%)", paddingTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", gap: 5 }}>
                      <button
                        onClick={() => setSelectedReviewPlace({ id: s.id, name: s.name, category: s.category, address: s.address, opening_hours: s.opening_hours, website: s.website, adminNote: s.adminNote })}
                        style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "5px 8px", borderRadius: 6, fontSize: "11px", fontWeight: 600, background: "hsl(221,83%,53%)", color: "white", border: "none", cursor: "pointer" }}
                        data-testid={`button-view-reviews-${s.id}`}
                      >
                        ★ Details
                      </button>
                      <a
                        href={s.linkedLocationId ? `/locations/${s.linkedLocationId}` : `/spots/spotlight/${s.id}`}
                        style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "5px 8px", borderRadius: 6, fontSize: "11px", fontWeight: 600, background: "hsl(158,64%,42%)", color: "white", border: "none", cursor: "pointer", textDecoration: "none" }}
                        data-testid={`link-view-noos-${s.id}`}
                      >
                        📅 Schedule
                      </a>
                    </div>
                    <button
                      onClick={() => {
                        if (!isAuthenticated) { navigate("/auth"); return; }
                        const pseudoId = -(s.id);
                        if (savedOsmIds.has(pseudoId)) {
                          unsaveOsmSpotMutation.mutate(pseudoId);
                        } else {
                          saveOsmSpotMutation.mutate({ osmId: pseudoId, name: s.name, category: s.category, lat: s.lat, lon: s.lon, address: s.address });
                        }
                      }}
                      disabled={saveOsmSpotMutation.isPending || unsaveOsmSpotMutation.isPending}
                      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "5px 10px", borderRadius: 6, fontSize: "11px", fontWeight: 600, background: savedOsmIds.has(-(s.id)) ? "hsl(142,64%,42%)" : "hsl(215,25%,97%)", color: savedOsmIds.has(-(s.id)) ? "white" : "hsl(215,25%,40%)", border: `1px solid ${savedOsmIds.has(-(s.id)) ? "hsl(142,64%,42%)" : "hsl(215,25%,80%)"}`, cursor: "pointer", width: "100%" }}
                      data-testid={`button-save-noos-${s.id}`}
                    >
                      {savedOsmIds.has(-(s.id)) ? "✓ Saved" : "🔖 Save Spot"}
                    </button>
                    {isAdmin && (
                      <div style={{ marginTop: 2, borderTop: "1px dashed hsl(38,80%,75%)", paddingTop: 6 }}>
                        <p style={{ margin: "0 0 4px", fontSize: "10px", fontWeight: 700, color: "hsl(38,60%,38%)", textTransform: "uppercase", letterSpacing: "0.05em" }}>⚙️ Admin Controls</p>
                        <p style={{ margin: "0 0 5px", fontSize: "10px", color: s.ownedByUserId ? "hsl(142,64%,38%)" : "hsl(215,25%,55%)" }}>
                          {s.ownedByUserId ? "👤 Owner assigned" : "○ No owner assigned"}
                        </p>
                        <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                          {s.linkedLocationId ? (
                            <a
                              href={`/locations/${s.linkedLocationId}`}
                              style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3, padding: "4px 6px", borderRadius: 5, fontSize: "10px", fontWeight: 600, background: "hsl(221,83%,53%)", color: "white", textDecoration: "none", cursor: "pointer" }}
                              data-testid={`link-manage-schedule-noos-${s.id}`}
                            >
                              📋 Manage Schedule
                            </a>
                          ) : (
                            <button
                              onClick={() => createScheduleMutation.mutate(s.id)}
                              disabled={createScheduleMutation.isPending}
                              style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3, padding: "4px 6px", borderRadius: 5, fontSize: "10px", fontWeight: 600, background: "hsl(215,25%,97%)", color: "hsl(215,25%,40%)", border: "1px solid hsl(215,25%,80%)", cursor: "pointer" }}
                              data-testid={`button-create-schedule-noos-${s.id}`}
                            >
                              📅 Create Schedule
                            </button>
                          )}
                          <a
                            href="/admin/spot-assignments"
                            style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3, padding: "4px 6px", borderRadius: 5, fontSize: "10px", fontWeight: 600, background: "hsl(38,92%,50%)", color: "white", textDecoration: "none", cursor: "pointer" }}
                            data-testid={`link-assign-owner-noos-${s.id}`}
                          >
                            👤 Assign Owner
                          </a>
                        </div>
                        <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                          {isFeatured ? (
                            <button
                              onClick={() => unfeatureMutation.mutate(s.id)}
                              disabled={unfeatureMutation.isPending}
                              style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3, padding: "4px 6px", borderRadius: 5, fontSize: "10px", fontWeight: 600, background: "hsl(0,84%,96%)", color: "hsl(0,72%,50%)", border: "1px solid hsl(0,84%,88%)", cursor: "pointer" }}
                              data-testid={`button-unfeature-noos-${s.id}`}
                            >
                              ✕ Unfeature
                            </button>
                          ) : (
                            <button
                              onClick={() => refeatureMutation.mutate(s.id)}
                              disabled={refeatureMutation.isPending}
                              style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3, padding: "4px 6px", borderRadius: 5, fontSize: "10px", fontWeight: 600, background: "hsl(38,92%,96%)", color: "hsl(38,60%,40%)", border: "1px solid hsl(38,92%,80%)", cursor: "pointer" }}
                              data-testid={`button-refeature-noos-${s.id}`}
                            >
                              ⭐ Feature
                            </button>
                          )}
                          <button
                            onClick={() => superFeatureMutation.mutate({ spotlightId: s.id, enable: !s.isSuperFeatured })}
                            disabled={superFeatureMutation.isPending}
                            style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3, padding: "4px 6px", borderRadius: 5, fontSize: "10px", fontWeight: 600, background: s.isSuperFeatured ? "hsl(270,70%,90%)" : "hsl(270,70%,96%)", color: "hsl(270,60%,40%)", border: "1px solid hsl(270,70%,80%)", cursor: "pointer" }}
                            data-testid={`button-super-feature-noos-${s.id}`}
                          >
                            {s.isSuperFeatured ? "👑 Remove Crown" : "👑 Super Feature"}
                          </button>
                        </div>
                        <a
                          href="/admin/analytics"
                          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3, padding: "4px 10px", borderRadius: 5, fontSize: "10px", fontWeight: 600, background: "hsl(215,25%,95%)", color: "hsl(215,25%,40%)", textDecoration: "none", width: "100%", boxSizing: "border-box" }}
                          data-testid={`link-analytics-noos-${s.id}`}
                        >
                          📊 Analytics
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {userLocation && (
          <Marker position={userLocation} icon={makeUserLocationIcon()}>
            <Popup><p className="text-xs text-foreground p-1">Your location</p></Popup>
          </Marker>
        )}
      </MapContainer>

      {/* ── Admin Schedule Panel (admins only) ───────────────────────────────── */}
      {isAdmin && (
        <AdminSchedulePanel
          isOpen={adminPanelOpen}
          onToggle={() => setAdminPanelOpen(v => !v)}
          onFlyTo={(lat, lng, zoom = 15) => setFlyToTarget({ lat, lng, zoom })}
        />
      )}

      {/* ── Admin Map Overlay (admins only) ──────────────────────────────────── */}
      {isAdmin && (
        <AdminMapOverlay
          viewportNonFeatured={viewportNonFeatured}
          viewportFeatured={viewportFeatured}
          filteredLocations={filteredLocations}
          filteredEvents={filteredEvents.map(ev => ev.event)}
          currentZoom={currentZoom}
          mapBounds={mapBounds}
          spotlights={spotlights}
          onFlyTo={(lat, lng, zoom) => setFlyToTarget({ lat, lng, zoom: zoom ?? 15 })}
          showAdminNotes={showAdminNotes}
          onToggleAdminNotes={() => setShowAdminNotes(v => !v)}
          open={mapOverlayOpen}
          onToggle={() => setMapOverlayOpen(v => !v)}
          clusterColor={clusterColor}
          onClusterColorChange={setClusterColor}
          defaultTab={adminMapDefaultTab}
        />
      )}

      {/* ── Search + Filter overlay ──────────────────────────────────────────── */}
      <div className={`absolute top-2 left-2 sm:top-4 sm:left-4 z-[1000] ${adminPanelOpen && isAdmin ? "right-[350px]" : "right-2 sm:right-4"}`} ref={searchContainerRef}>

        {/* ── Row 1: Search bar ── */}
        <div className="flex items-center gap-2">
          {/* Search pill — glass morphism style */}
          <div className={`flex-1 flex items-center bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl rounded-2xl transition-all duration-200 overflow-hidden ${
            searchOpen
              ? "shadow-[0_4px_24px_rgba(0,0,0,0.12)] ring-2 ring-primary/20 border border-primary/30"
              : "shadow-[0_2px_16px_rgba(0,0,0,0.10)] border border-white/60 dark:border-white/10 hover:shadow-[0_4px_20px_rgba(0,0,0,0.14)]"
          }`}>
            <Search className={`w-4 h-4 ml-4 flex-shrink-0 transition-colors duration-200 ${searchOpen ? "text-primary" : "text-foreground/40"}`} />
            {searchOpen ? (
              <Input
                value={inputValue}
                onChange={handleInputChange}
                onFocus={() => setShowSearchResults(true)}
                placeholder="Search spots, events, addresses…"
                className="border-0 shadow-none px-3 h-12 text-sm font-medium focus-visible:ring-0 bg-transparent placeholder:text-foreground/30"
                data-testid="input-map-search"
                autoFocus
              />
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="flex-1 text-left px-3 h-12 text-sm text-foreground/40 font-medium"
                data-testid="button-open-search"
              >
                Search spots, events…
              </button>
            )}
            {inputValue && searchOpen && (
              <button onClick={handleClearSearch} className="px-3 text-foreground/30 hover:text-foreground transition-colors flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter button */}
          <button
            onClick={() => { if (!searchOpen) setSearchOpen(true); setShowFilters(f => !f); }}
            className={`relative flex items-center justify-center w-12 h-12 rounded-2xl flex-shrink-0 transition-all duration-200 active:scale-95 backdrop-blur-2xl ${
              showFilters
                ? "bg-primary text-primary-foreground shadow-[0_4px_16px_rgba(var(--primary),0.35)]"
                : "bg-white/95 dark:bg-zinc-900/95 border border-white/60 dark:border-white/10 text-foreground/50 shadow-[0_2px_16px_rgba(0,0,0,0.10)] hover:text-foreground"
            }`}
            data-testid="button-toggle-filters"
            aria-label="Filters"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1 leading-none shadow-md border-2 border-white dark:border-zinc-900">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Close button */}
          {searchOpen && (
            <button
              onClick={() => { setSearchOpen(false); setShowFilters(false); setShowSearchResults(false); handleClearSearch(); }}
              className="flex items-center justify-center w-12 h-12 rounded-2xl bg-white/95 dark:bg-zinc-900/95 border border-white/60 dark:border-white/10 shadow-[0_2px_16px_rgba(0,0,0,0.10)] text-foreground/50 hover:text-foreground flex-shrink-0 backdrop-blur-2xl active:scale-95 transition-all duration-200"
              data-testid="button-close-search"
              aria-label="Close search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ── Filter panel (tabbed) ── */}
        {showFilters && (
          <div className="mt-2 bg-background/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/70 overflow-hidden" style={{ minWidth: 300 }}>
            {/* Tab bar */}
            <div className="flex border-b border-border/50 bg-muted/20">
              {[
                { id: "categories", label: "Categories", emoji: "🏷️" },
                { id: "layers", label: "Layers", emoji: "🗺️" },
                { id: "events", label: "Events", emoji: "📅" },
                ...(isAuthenticated ? [{ id: "people", label: "People", emoji: "👤" }] : []),
              ].map(tab => {
                const isActive = filterTab === tab.id;
                const badgeCount =
                  tab.id === "categories" ? filters.categories.length :
                  tab.id === "events" ? filters.eventCategories.length :
                  tab.id === "people" ? filters.peopleRoles.length : 0;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setFilterTab(tab.id as any)}
                    className={`flex-1 py-2.5 flex flex-col items-center gap-0.5 text-[10px] font-bold transition-all relative ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    style={{ borderBottom: isActive ? "2px solid hsl(var(--primary))" : "2px solid transparent" }}
                    data-testid={`button-filter-tab-${tab.id}`}
                  >
                    <span className="text-sm leading-none">{tab.emoji}</span>
                    <span className="uppercase tracking-wide">{tab.label}</span>
                    {badgeCount > 0 && (
                      <span className="absolute top-1 right-1 min-w-[14px] h-3.5 rounded-full bg-primary text-primary-foreground text-[8px] font-black flex items-center justify-center px-0.5">{badgeCount}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Panel body */}
            <div className="p-3 space-y-3 overflow-y-auto overscroll-contain" style={{ maxHeight: "58vh" }}>

              {/* LAYERS TAB — Show on map + quick filters */}
              {filterTab === "layers" && (
                <>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Show on map</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: "spots", label: "My Spots", emoji: "📍", active: filters.showSpots,
                          onClick: () => setFilters({ ...filters, showSpots: !filters.showSpots }) },
                        { key: "events", label: "Events", emoji: "📅", active: filters.showEvents,
                          onClick: () => setFilters({ ...filters, showEvents: !filters.showEvents }) },
                        { key: "city", label: "City Places", emoji: "🏙️", active: filters.showCitySpots, teal: true,
                          onClick: () => setFilters({ ...filters, showCitySpots: !filters.showCitySpots, categories: [], citySpotCategories: [] }) },
                        ...(isAuthenticated ? [{ key: "people", label: "People", emoji: "👥", active: filters.showPeople,
                          onClick: () => setFilters({ ...filters, showPeople: !filters.showPeople }) }] : []),
                      ].map(item => (
                        <button
                          key={item.key}
                          onClick={item.onClick}
                          className={`flex items-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold border-2 transition-all active:scale-95 ${item.active ? (item.teal ? "text-white border-transparent" : "bg-primary text-primary-foreground border-primary shadow-sm") : "border-border/50 text-muted-foreground bg-muted/20 hover:border-primary/30"}`}
                          style={item.active && item.teal ? { backgroundColor: CITY_TEAL, borderColor: CITY_TEAL } : {}}
                          data-testid={`button-filter-layer-${item.key}`}
                        >
                          <span className="text-base leading-none">{item.emoji}</span>
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="h-px bg-border/40" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                      <Compass className="w-3 h-3" /> Quick Filters
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => { if (!filters.distanceSort && !userLocation) handleGetCurrentLocation(); setFilters({ ...filters, distanceSort: !filters.distanceSort, showCitySpots: true }); }}
                        className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all active:scale-95 ${filters.distanceSort ? "text-white border-transparent shadow-md" : "border-border/50 text-muted-foreground bg-background/80"}`}
                        style={filters.distanceSort ? { backgroundColor: "#0EA5E9", borderColor: "#0EA5E9" } : {}}
                        data-testid="button-filter-distance-sort"
                      >
                        <Locate className="w-3.5 h-3.5" /> Nearest first
                      </button>
                      <button
                        onClick={() => setFilters({ ...filters, openNow: !filters.openNow, showCitySpots: true })}
                        className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all active:scale-95 ${filters.openNow ? "text-white border-transparent shadow-md" : "border-border/50 text-muted-foreground bg-background/80"}`}
                        style={filters.openNow ? { backgroundColor: "#16A34A", borderColor: "#16A34A" } : {}}
                        data-testid="button-filter-open-now"
                      >
                        <Clock className="w-3.5 h-3.5" /> Open now
                      </button>
                    </div>
                    {filters.distanceSort && !userLocation && (
                      <p className="text-[10px] text-amber-600 mt-2 text-center">Tap the location button (bottom right) to enable</p>
                    )}
                  </div>
                </>
              )}

              {/* CATEGORIES TAB — unified filter across community spots, city places & events */}
              {filterTab === "categories" && (() => {
                const q = categorySearch.trim().toLowerCase();
                const matches = (def: UnifiedCategoryDef, key: string) =>
                  !q || def.label.toLowerCase().includes(q) || key.toLowerCase().includes(q);
                const totalSelected = filters.categories.length;
                return (
                  <div className="space-y-3">
                    {/* Header + search */}
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Categories {totalSelected > 0 && <span className="text-primary">· {totalSelected}</span>}
                      </p>
                      {totalSelected > 0 && (
                        <button
                          className="text-[10px] text-primary hover:underline font-semibold"
                          onClick={() => setFilters({ ...filters, categories: [], citySpotCategories: [] })}
                          data-testid="button-categories-clear"
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/70" />
                      <input
                        type="text"
                        value={categorySearch}
                        onChange={e => setCategorySearch(e.target.value)}
                        placeholder="Search categories…"
                        className="w-full h-9 pl-8 pr-8 rounded-xl bg-muted/40 dark:bg-zinc-800/60 border border-border/40 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
                        data-testid="input-category-search"
                      />
                      {categorySearch && (
                        <button
                          onClick={() => setCategorySearch("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          aria-label="Clear search"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {/* Grouped chips */}
                    {UNIFIED_GROUPS.map(group => {
                      const items = Object.entries(UNIFIED_CATEGORIES)
                        .filter(([key, def]) => def.group === group.id && matches(def, key));
                      if (items.length === 0) return null;
                      const groupActive = items.filter(([k]) => filters.categories.includes(k)).length;
                      return (
                        <div key={group.id} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/90 flex items-center gap-1.5">
                              <span className="text-sm leading-none">{group.emoji}</span>
                              {group.label}
                              {groupActive > 0 && (
                                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[9px] font-black">{groupActive}</span>
                              )}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {items.map(([key, def]) => {
                              const active = filters.categories.includes(key);
                              return (
                                <button
                                  key={key}
                                  onClick={() => toggleCategory(key)}
                                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 active:scale-95 ${
                                    active
                                      ? "text-white shadow-md ring-1 ring-white/20"
                                      : "bg-muted/50 dark:bg-zinc-800/50 text-foreground/70 hover:bg-muted dark:hover:bg-zinc-700/70 hover:text-foreground"
                                  }`}
                                  style={active ? { backgroundColor: def.color } : {}}
                                  data-testid={`button-filter-category-${key}`}
                                >
                                  <span className="leading-none">{def.emoji}</span>
                                  <span>{def.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    {q && Object.entries(UNIFIED_CATEGORIES).filter(([k, d]) => matches(d, k)).length === 0 && (
                      <div className="text-center py-6 text-xs text-muted-foreground">
                        No categories match "{categorySearch}"
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground/70 leading-relaxed pt-1">
                      Selecting a category narrows every layer on the map — spots, city places and events — so results match exactly what you asked for.
                    </p>
                  </div>
                );
              })()}

              {/* EVENTS TAB */}
              {filterTab === "events" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Event Types</p>
                    {filters.eventCategories.length > 0 && (
                      <button className="text-[10px] text-primary underline font-semibold" onClick={() => setFilters({ ...filters, eventCategories: [] })}>
                        Clear all
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(eventCategoryConfig).filter(([k]) => k !== "default").map(([key, c]) => {
                      const active = filters.eventCategories.includes(key);
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            const next = active ? filters.eventCategories.filter(k => k !== key) : [...filters.eventCategories, key];
                            setFilters({ ...filters, eventCategories: next, showEvents: true });
                          }}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all active:scale-95 ${active ? "text-white shadow-sm" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
                          style={active ? { backgroundColor: c.color } : {}}
                          data-testid={`button-filter-event-${key}`}
                        >
                          {c.emoji} {c.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* PEOPLE TAB */}
              {filterTab === "people" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Roles</p>
                    {filters.peopleRoles.length > 0 && (
                      <button className="text-[10px] text-primary underline font-semibold" onClick={() => setFilters({ ...filters, peopleRoles: [] })}>
                        Clear all
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(roleConfig).map(([key, c]) => (
                      <button
                        key={key}
                        onClick={() => toggleRole(key)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all active:scale-95 ${filters.peopleRoles.includes(key) ? "text-white shadow-sm" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
                        style={filters.peopleRoles.includes(key) ? { backgroundColor: c.color } : {}}
                        data-testid={`button-filter-role-${key}`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-border/50 px-4 py-2.5 bg-muted/10">
              <span className="text-[11px] text-muted-foreground">
                {activeFilterCount > 0 ? `${activeFilterCount} filter${activeFilterCount !== 1 ? "s" : ""} active` : "No filters active"}
              </span>
              {hasActiveFilters && (
                <button
                  className="text-[11px] font-semibold text-destructive hover:opacity-70 transition-opacity"
                  onClick={() => setFilters({ showEvents: true, showSpots: true, showPeople: false, showCitySpots: true, categories: [], peopleRoles: [], citySpotCategories: [], eventCategories: [], distanceSort: false, openNow: false })}
                  data-testid="button-filter-clear-all"
                >
                  Reset all
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Search results dropdown ── */}
        {searchOpen && showSearchResults && (localResults.length > 0 || addressResults.length > 0) && (
          <div className="mt-2 bg-background/97 backdrop-blur-xl rounded-2xl shadow-xl border border-border/70 overflow-hidden">
            <ScrollArea className="max-h-64">
              {localResults.filter(r => r.type === "category").length > 0 && (
                <>
                  <div className="px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/40 flex items-center gap-1.5">
                    <Tag className="h-3 w-3" /> Categories
                  </div>
                  {localResults.filter(r => r.type === "category").map(r => (
                    <div key={r.id} onClick={() => handleLocalResultSelect(r)} className="px-3.5 py-2.5 cursor-pointer flex items-center gap-3 hover:bg-muted/60 transition-colors">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-2 ring-offset-1 ring-border" style={{ backgroundColor: r.color }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{r.title}</p>
                        <p className="text-xs text-muted-foreground">{r.subtitle}</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
              {localResults.filter(r => r.type === "spot").length > 0 && (
                <>
                  <div className="px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/40 flex items-center gap-1.5">
                    <MapPin className="h-3 w-3" /> Spots
                  </div>
                  {localResults.filter(r => r.type === "spot").map(r => (
                    <div key={r.id} onClick={() => handleLocalResultSelect(r)} className="px-3.5 py-2.5 cursor-pointer flex items-center gap-3 hover:bg-muted/60 transition-colors">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.color || "#4488FF" }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
              {localResults.filter(r => r.type === "event").length > 0 && (
                <>
                  <div className="px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/40 flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" /> Events
                  </div>
                  {localResults.filter(r => r.type === "event").map(r => (
                    <div key={r.id} onClick={() => handleLocalResultSelect(r)} className="px-3.5 py-2.5 cursor-pointer flex items-center gap-3 hover:bg-muted/60 transition-colors">
                      <Calendar className="h-4 w-4 flex-shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
              {addressResults.length > 0 && (
                <>
                  <div className="px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/40 flex items-center gap-1.5">
                    <Navigation className="h-3 w-3" /> Addresses
                  </div>
                  {addressResults.map((r, i) => (
                    <div key={i} onClick={() => handleAddressSelect(r)} className="px-3.5 py-2.5 cursor-pointer flex items-center gap-3 hover:bg-muted/60 transition-colors">
                      <Navigation className="h-4 w-4 flex-shrink-0 text-primary" />
                      <p className="text-sm text-foreground truncate">{r.display_name.split(",").slice(0, 3).join(", ")}</p>
                    </div>
                  ))}
                </>
              )}
            </ScrollArea>
          </div>
        )}

        {/* ── Quick filter strip — always visible ── */}
        {!showFilters && (
          <div className="mt-2">
            {/* Frosted glass chip container */}
            <div
              className="flex items-center gap-1.5 overflow-x-auto rounded-2xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl shadow-[0_2px_16px_rgba(0,0,0,0.10)] border border-white/60 dark:border-white/10 px-2.5 py-2"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {/* Open now */}
              <button
                onClick={() => setFilters({ ...filters, openNow: !filters.openNow, showCitySpots: filters.openNow ? filters.showCitySpots : true })}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 h-8 rounded-xl text-[11px] font-semibold transition-all duration-150 active:scale-95 whitespace-nowrap ${
                  filters.openNow ? "text-white shadow-sm" : "text-foreground/50 hover:text-foreground bg-transparent hover:bg-foreground/5"
                }`}
                style={filters.openNow ? { backgroundColor: "#16A34A", boxShadow: "0 2px 8px rgba(22,163,74,0.35)" } : {}}
                data-testid="button-quick-open-now"
              >
                <Clock className="w-3.5 h-3.5" /> Open now
              </button>

              <div className="w-px h-5 bg-border/40 flex-shrink-0" />

              {/* Nearest */}
              <button
                onClick={() => {
                  if (!filters.distanceSort && !userLocation) handleGetCurrentLocation();
                  setFilters({ ...filters, distanceSort: !filters.distanceSort, showCitySpots: filters.distanceSort ? filters.showCitySpots : true });
                }}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 h-8 rounded-xl text-[11px] font-semibold transition-all duration-150 active:scale-95 whitespace-nowrap ${
                  filters.distanceSort ? "text-white shadow-sm" : "text-foreground/50 hover:text-foreground bg-transparent hover:bg-foreground/5"
                }`}
                style={filters.distanceSort ? { backgroundColor: "#0EA5E9", boxShadow: "0 2px 8px rgba(14,165,233,0.35)" } : {}}
                data-testid="button-quick-distance"
              >
                <Locate className="w-3.5 h-3.5" /> Nearest
              </button>

              <div className="w-px h-5 bg-border/40 flex-shrink-0" />

              {/* Spots */}
              <button
                onClick={() => setFilters({ ...filters, showSpots: !filters.showSpots })}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 h-8 rounded-xl text-[11px] font-semibold transition-all duration-150 active:scale-95 whitespace-nowrap ${
                  filters.showSpots
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground/40 hover:text-foreground/70 bg-transparent hover:bg-foreground/5"
                }`}
                data-testid="button-quick-spots"
              >
                <MapPin className="w-3.5 h-3.5" /> Spots
              </button>

              {/* Events */}
              <button
                onClick={() => setFilters({ ...filters, showEvents: !filters.showEvents })}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 h-8 rounded-xl text-[11px] font-semibold transition-all duration-150 active:scale-95 whitespace-nowrap ${
                  filters.showEvents
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground/40 hover:text-foreground/70 bg-transparent hover:bg-foreground/5"
                }`}
                data-testid="button-quick-events"
              >
                <Calendar className="w-3.5 h-3.5" /> Events
              </button>

              {/* Places */}
              <button
                onClick={() => setFilters({ ...filters, showCitySpots: !filters.showCitySpots, categories: [], citySpotCategories: [] })}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 h-8 rounded-xl text-[11px] font-semibold transition-all duration-150 active:scale-95 whitespace-nowrap ${
                  filters.showCitySpots ? "text-white shadow-sm" : "text-foreground/40 hover:text-foreground/70 bg-transparent hover:bg-foreground/5"
                }`}
                style={filters.showCitySpots ? { backgroundColor: CITY_TEAL, boxShadow: "0 2px 8px rgba(13,148,136,0.35)" } : {}}
                data-testid="button-quick-city"
              >
                🏙️ Places
              </button>

              {/* Active sub-filter chips (category/event/role removable tags) */}
              {(filters.categories.length > 0 || filters.eventCategories.length > 0 || filters.peopleRoles.length > 0) && (
                <div className="w-px h-5 bg-border/40 flex-shrink-0" />
              )}

              {filters.categories.map(cat => {
                const def = UNIFIED_CATEGORIES[cat];
                return (
                  <button key={cat} onClick={() => toggleCategory(cat)}
                    className="flex-shrink-0 flex items-center gap-1 px-2.5 h-8 rounded-xl text-[11px] font-semibold text-white shadow-sm active:scale-95 whitespace-nowrap transition-transform hover:shadow-md"
                    style={{ backgroundColor: def?.color || PIN_ORANGE }}
                    data-testid={`chip-active-category-${cat}`}
                  >
                    <span className="leading-none">{def?.emoji || "📍"}</span>
                    <span>{def?.label || cat}</span>
                    <X className="w-3 h-3 ml-0.5 opacity-80" />
                  </button>
                );
              })}

              {filters.eventCategories.map(cat => {
                const cfg = eventCategoryConfig[cat];
                return (
                  <button key={`ev-${cat}`}
                    onClick={() => setFilters({ ...filters, eventCategories: filters.eventCategories.filter(c => c !== cat) })}
                    className="flex-shrink-0 flex items-center gap-1 px-2.5 h-8 rounded-xl text-[11px] font-semibold text-white shadow-sm active:scale-95 whitespace-nowrap"
                    style={{ backgroundColor: cfg?.color || "#6B7280" }}
                  >
                    {cfg?.emoji} {cfg?.label || cat}
                    <X className="w-3 h-3 ml-0.5 opacity-80" />
                  </button>
                );
              })}

              {filters.peopleRoles.map(role => (
                <button key={role} onClick={() => toggleRole(role)}
                  className="flex-shrink-0 flex items-center gap-1 px-2.5 h-8 rounded-xl text-[11px] font-semibold text-white shadow-sm active:scale-95 whitespace-nowrap"
                  style={{ backgroundColor: USER_PURPLE }}
                >
                  {roleConfig[role]?.label || role}
                  <X className="w-3 h-3 ml-0.5 opacity-80" />
                </button>
              ))}

              {/* Clear all */}
              {hasActiveFilters && (
                <>
                  <div className="w-px h-5 bg-border/40 flex-shrink-0" />
                  <button
                    onClick={() => setFilters({ showEvents: true, showSpots: true, showPeople: false, showCitySpots: true, categories: [], peopleRoles: [], citySpotCategories: [], eventCategories: [], distanceSort: false, openNow: false })}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 h-8 rounded-xl text-[11px] font-semibold text-destructive hover:bg-destructive/10 active:scale-95 whitespace-nowrap transition-all duration-150"
                  >
                    <X className="w-3.5 h-3.5" /> Clear
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Map legend ─────────────────────────────────────────────────────── */}
      {showLegend && (
        <div className="absolute bottom-20 left-3 z-[1000] bg-background/95 backdrop-blur-sm rounded-xl shadow-lg border border-border p-3 min-w-[190px]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Map Legend</p>
            <button className="text-muted-foreground hover:text-foreground" onClick={() => setShowLegend(false)}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-base leading-none">⭐</span>
              <span className="text-xs font-semibold text-amber-700">Featured Spots</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: "#0D9488" }}></div>
              <span className="text-xs text-muted-foreground">City Places (clustered)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: "#FF4D00" }}></div>
              <span className="text-xs text-muted-foreground">Spots & Events</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: "#7C3AED" }}></div>
              <span className="text-xs text-muted-foreground">Nearby people</span>
            </div>
          </div>
          {filters.showCitySpots && (
            <>
              <div className="border-t border-border mt-2 pt-2">
                <p className="text-[9px] font-semibold uppercase text-muted-foreground mb-1.5">City Place Types</p>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                  {Object.entries(citySpotConfig).filter(([k]) => k !== "other").map(([, c]) => (
                    <div key={c.label} className="flex items-center gap-1">
                      <span className="text-xs leading-none">{c.emoji}</span>
                      <span className="text-[10px] text-muted-foreground">{c.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground mt-2 italic">Tap a cluster to zoom in</p>
            </>
          )}
        </div>
      )}

      {/* ── Spot status badges ─────────────────────────────────────────────── */}
      {filters.showCitySpots && currentZoom < 12 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-[1000] bg-black/70 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm pointer-events-none">
          🔍 Zoom in to see all {filteredCitySpots.length.toLocaleString()} city places
        </div>
      )}
      {filters.showCitySpots && currentZoom >= 12 && viewportNonFeatured.length > 0 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-[1000] bg-teal-700/80 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm pointer-events-none flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse inline-block" />
          {viewportNonFeatured.length.toLocaleString()} spots in view
          {filteredCitySpots.length > viewportNonFeatured.length && (
            <span className="opacity-70">· {filteredCitySpots.length.toLocaleString()} total</span>
          )}
        </div>
      )}

      <TooltipProvider>
        <div className="absolute bottom-20 sm:bottom-6 right-3 z-[1000] flex flex-col gap-2">
          {onFindMySpot && isAuthenticated && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="default"
                  className="rounded-full shadow-md bg-primary text-primary-foreground hover:bg-primary/90 w-11 h-11 min-w-[44px] min-h-[44px]"
                  onClick={onFindMySpot}
                  data-testid="button-find-my-spot"
                >
                  <Sparkles className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Find My Spot</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="outline" className="rounded-full shadow-md bg-background w-11 h-11 min-w-[44px] min-h-[44px]" onClick={handleGetCurrentLocation} data-testid="button-my-location">
                <Locate className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">My location</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={showLegend ? "default" : "outline"}
                className="rounded-full shadow-md bg-background"
                onClick={() => setShowLegend(l => !l)}
                data-testid="button-map-legend"
              >
                <Layers className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Map legend</TooltipContent>
          </Tooltip>

          {isAuthenticated && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="outline" className="rounded-full shadow-md bg-background" onClick={() => navigate("/nearby")} data-testid="button-nearby-users">
                  <Users className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Nearby users</TooltipContent>
            </Tooltip>
          )}

          {isAdmin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant={mapOverlayOpen && adminMapDefaultTab !== "ai" ? "default" : "outline"}
                  className="rounded-full shadow-md bg-background"
                  style={mapOverlayOpen && adminMapDefaultTab !== "ai" ? { background: "linear-gradient(135deg,#7C3AED,#5B21B6)", color: "white", boxShadow: "0 4px 16px rgba(124,58,237,0.45)" } : undefined}
                  onClick={() => {
                    setAdminMapDefaultTab("stats");
                    setMapOverlayOpen(v => !v);
                  }}
                  data-testid="button-admin-map-overlay-toggle"
                >
                  <Shield className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Admin tools</TooltipContent>
            </Tooltip>
          )}

          {isAdmin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant={mapOverlayOpen && adminMapDefaultTab === "ai" ? "default" : "outline"}
                  className="rounded-full shadow-md relative bg-background"
                  style={mapOverlayOpen && adminMapDefaultTab === "ai" ? {
                    background: "linear-gradient(135deg,#6D28D9,#4C1D95)",
                    color: "white",
                    boxShadow: "0 4px 16px rgba(109,40,217,0.5)",
                  } : undefined}
                  onClick={() => {
                    if (mapOverlayOpen && adminMapDefaultTab === "ai") {
                      setMapOverlayOpen(false);
                    } else {
                      setAdminMapDefaultTab("ai");
                      setMapOverlayOpen(true);
                    }
                  }}
                  data-testid="button-admin-map-ai-toggle"
                >
                  <Bot className="h-4 w-4" />
                  {!mapOverlayOpen && (
                    <span
                      className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full animate-pulse"
                      style={{ background: "#7C3AED", boxShadow: "0 0 6px rgba(124,58,237,0.8)" }}
                    />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Map AI Assistant</TooltipContent>
            </Tooltip>
          )}

          {isAuthenticated && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" className="rounded-full shadow-md" onClick={() => setShowAddLocation(true)} data-testid="button-add-spot">
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Add spot</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                className="rounded-full shadow-md bg-background"
                onClick={() => { window.location.assign("/map/journey"); }}
                data-testid="button-journey-mode"
              >
                <Route className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Journey Route Map</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                className="rounded-full shadow-md bg-background"
                onClick={() => {
                  queryClient.refetchQueries({ queryKey: ["/api/events"] });
                  queryClient.refetchQueries({ queryKey: ["/api/locations"] });
                  queryClient.refetchQueries({ queryKey: ["/api/city-spots/spotlights"] });
                  toast({ title: "Map refreshed" });
                }}
                data-testid="button-refresh-map"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Refresh map</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      <AddLocationModal
        open={showAddLocation}
        onClose={() => setShowAddLocation(false)}
        prefilledCoordinates={mapCenter ? { latitude: String(mapCenter[0]), longitude: String(mapCenter[1]) } : undefined}
      />

      {filters.distanceSort && userLocation && filters.showCitySpots && (
        <div className="absolute bottom-20 left-3 z-[1000] w-[min(72vw,280px)] sm:w-72 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.13)] border border-white/60 dark:border-white/10 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3.5 pt-3 pb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <span>📍</span> Nearest Spots
            </p>
            <button
              className="text-muted-foreground/50 hover:text-foreground transition-colors p-0.5 rounded"
              onClick={() => setFilters({ ...filters, distanceSort: false })}
              data-testid="button-close-nearby-panel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Spot list */}
          <div className="px-2 pb-2 space-y-0.5">
            {filteredCitySpots.slice(0, 6).map((spot, idx) => {
              const cfg = citySpotConfig[spot.category] || citySpotConfig.other;
              const dist = haversineKm(userLocation[0], userLocation[1], spot.lat, spot.lon);
              const open = isOpenNow(spot.opening_hours);
              return (
                <div
                  key={`nearby-${spot.id}`}
                  className={`flex items-center gap-2.5 cursor-pointer rounded-xl px-2.5 py-2 transition-colors ${idx === 0 ? "bg-foreground/5" : "hover:bg-foreground/5"}`}
                  onClick={() => { setMapCenter([spot.lat, spot.lon]); setMapZoom(17); }}
                  data-testid={`nearby-spot-${spot.id}`}
                >
                  {/* Icon circle */}
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm" style={{ backgroundColor: `${cfg.color}22` }}>
                    <span className="leading-none">{cfg.emoji}</span>
                  </div>
                  {/* Name + meta */}
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-foreground leading-snug break-words">{spot.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <span>{formatDistance(dist)}</span>
                      {spot.opening_hours && (
                        <>
                          <span className="text-muted-foreground/40">·</span>
                          <span className={open ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>{open ? "Open" : "Closed"}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredCitySpots.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4 px-3">No spots found nearby</p>
          )}
        </div>
      )}

      <PlaceDetailSheet
        place={selectedReviewPlace}
        open={!!selectedReviewPlace}
        onClose={() => setSelectedReviewPlace(null)}
      />
    </div>
  );
}
