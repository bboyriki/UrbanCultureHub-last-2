import { useState, useMemo, useEffect } from "react";
import SpotScheduleModal from "./SpotScheduleModal";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LocationType } from "@shared/schema";
import type { SpotlightedPlace } from "@shared/schema";
import { MapPin, Eye, Plus, EyeOff, Check, X, Clock, Shield, Edit, Trash2, MoreVertical, Loader2, Search, ExternalLink, ArrowUpDown, SlidersHorizontal, CalendarDays } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { AddSpotDialog } from "./AddSpotDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const editSpotSchema = z.object({
  name: z.string().min(3, 'Spot name must be at least 3 characters'),
  description: z.string().optional(),
  address: z.string().optional(),
  type: z.string().optional(),
  skillLevel: z.string().optional(),
  surfaceType: z.string().optional(),
  openingHours: z.string().optional(),
  isFree: z.boolean().optional(),
  website: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  contactInfo: z.string().optional(),
});

type EditSpotFormData = z.infer<typeof editSpotSchema>;

const SPOT_TYPES = [
  { value: 'graffiti', label: 'Graffiti Spot' },
  { value: 'dance', label: 'Dance Spot' },
  { value: 'music', label: 'Music Spot' },
  { value: 'rap', label: 'Rap/MC Spot' },
  { value: 'training', label: 'Training Spot' },
  { value: 'performance', label: 'Performance Venue' },
  { value: 'skate', label: 'Skating Spot' },
  { value: 'parkour', label: 'Parkour Spot' },
  { value: 'bmx', label: 'BMX Spot' },
  { value: 'workshop', label: 'Workshop Space' },
  { value: 'cultural_hub', label: 'Cultural Hub' },
  { value: 'open_mic', label: 'Open Mic Venue' },
];

interface SpotLocation {
  id: number | string;
  name: string;
  description: string | null;
  type: string;
  images: string[] | null;
  address?: string | null;
  latitude: string;
  longitude: string;
  isVisible?: boolean;
  approvalStatus?: string;
  createdBy?: number;
  skillLevel?: string;
  surfaceType?: string;
  openingHours?: string;
  isFree?: boolean;
  website?: string | null;
  contactInfo?: string;
  isFeatured?: boolean;
  source?: "user" | "city" | "osm";
  originalCategory?: string;
  createdAt?: string | null;
  linkedLocationId?: number | null;
  spotlightNumericId?: number;
  osmNumericId?: number;
}

interface SpotCardProps {
  location: SpotLocation;
  isAdmin: boolean;
  currentUserId?: number;
  onApprove?: (id: number) => void;
  onReject?: (id: number) => void;
  onToggleVisibility?: (id: number, isVisible: boolean) => void;
  onEdit?: (location: SpotLocation) => void;
  onDelete?: (location: SpotLocation) => void;
  onSchedule?: (location: SpotLocation) => void;
  horizontal?: boolean;
}

const CITY_CATEGORY_TO_TYPE: Record<string, string> = {
  art: LocationType.GRAFFITI,
  graffiti: LocationType.GRAFFITI,
  dance: LocationType.DANCE,
  music: LocationType.MUSIC,
  nightlife: LocationType.NIGHTLIFE,
  skate: LocationType.SKATE,
  sport: LocationType.TRAINING,
  fitness: LocationType.FITNESS,
  training: LocationType.TRAINING,
  community: LocationType.CULTURAL_HUB,
  cafe: LocationType.CAFE,
  food: LocationType.RESTAURANT,
  restaurant: LocationType.RESTAURANT,
  parkour: LocationType.PARKOUR,
  bouldering: LocationType.BOULDERING,
  padel: LocationType.PADEL,
  basketball: LocationType.BASKETBALL,
  museum: LocationType.CULTURAL_HUB,
  cinema: LocationType.PERFORMANCE,
  comedy: LocationType.PERFORMANCE,
  bmx: LocationType.BMX,
  table_tennis: LocationType.TABLE_TENNIS,
  wellness: LocationType.WELLNESS,
  beatbox: LocationType.BEATBOX,
  rap: LocationType.RAP,
  open_mic: LocationType.OPEN_MIC,
  workshop: LocationType.WORKSHOP,
};

const CATEGORY_CONFIG: Record<string, { emoji: string; label: string; gradient: string }> = {
  [LocationType.GRAFFITI]:    { emoji: "🎨", label: "Art / Graffiti",  gradient: "from-purple-500 to-pink-500" },
  [LocationType.DANCE]:       { emoji: "💃", label: "Dance",            gradient: "from-pink-500 to-rose-500" },
  [LocationType.MUSIC]:       { emoji: "🎵", label: "Music",            gradient: "from-indigo-500 to-purple-500" },
  [LocationType.RAP]:         { emoji: "🎤", label: "Rap / MC",         gradient: "from-rose-500 to-red-500" },
  [LocationType.BEATBOX]:     { emoji: "🎤", label: "Beatbox",          gradient: "from-red-500 to-orange-500" },
  [LocationType.PERFORMANCE]: { emoji: "🎭", label: "Performance",      gradient: "from-teal-500 to-cyan-500" },
  [LocationType.SKATE]:       { emoji: "🛹", label: "Skate",            gradient: "from-green-500 to-emerald-500" },
  [LocationType.PARKOUR]:     { emoji: "🤸", label: "Parkour",          gradient: "from-yellow-500 to-amber-500" },
  [LocationType.TRAINING]:    { emoji: "💪", label: "Training",         gradient: "from-orange-500 to-amber-500" },
  [LocationType.FITNESS]:     { emoji: "💪", label: "Fitness",          gradient: "from-blue-500 to-cyan-500" },
  [LocationType.BMX]:         { emoji: "🚲", label: "BMX",              gradient: "from-sky-500 to-blue-500" },
  [LocationType.TABLE_TENNIS]:{ emoji: "🏓", label: "Table Tennis",     gradient: "from-green-600 to-teal-500" },
  [LocationType.BASKETBALL]:  { emoji: "🏀", label: "Basketball",       gradient: "from-orange-500 to-red-500" },
  [LocationType.STREET_SPORTS]:{ emoji: "⚽", label: "Street Sports",  gradient: "from-emerald-500 to-green-600" },
  [LocationType.BOULDERING]:  { emoji: "🧗", label: "Bouldering",       gradient: "from-violet-500 to-purple-600" },
  [LocationType.PADEL]:       { emoji: "🎾", label: "Padel",            gradient: "from-lime-500 to-green-500" },
  [LocationType.CULTURAL_HUB]:{ emoji: "🏛️", label: "Cultural Hub",    gradient: "from-amber-500 to-yellow-600" },
  [LocationType.OPEN_MIC]:    { emoji: "🎙️", label: "Open Mic",        gradient: "from-fuchsia-500 to-pink-500" },
  [LocationType.WORKSHOP]:    { emoji: "🔧", label: "Workshop",         gradient: "from-blue-600 to-indigo-600" },
  [LocationType.CAFE]:        { emoji: "☕", label: "Café",             gradient: "from-amber-600 to-yellow-500" },
  [LocationType.RESTAURANT]:  { emoji: "🍽️", label: "Restaurant",      gradient: "from-orange-500 to-red-400" },
  [LocationType.WELLNESS]:    { emoji: "🧖", label: "Wellness / Spa",   gradient: "from-pink-400 to-rose-400" },
  [LocationType.NIGHTLIFE]:   { emoji: "🌙", label: "Nightlife",        gradient: "from-violet-600 to-indigo-700" },
  [LocationType.OTHER]:       { emoji: "📍", label: "Other",            gradient: "from-gray-500 to-slate-500" },
};

const CITY_SPOT_EMOJI: Record<string, string> = {
  cafe: "☕", food: "🍽️", restaurant: "🍽️", sport: "🏋️", training: "🏋️",
  skate: "🛹", dance: "💃", music: "🎵", nightlife: "🌙", comedy: "😄",
  cinema: "🎬", art: "🎨", community: "🤝", fitness: "💪", basketball: "🏀",
  parkour: "🤸", padel: "🎾", bouldering: "🧗", museum: "🏛️", bmx: "🚲",
  table_tennis: "🏓", wellness: "🧖", beatbox: "🎤", rap: "🎤",
  open_mic: "🎙️", workshop: "🔧",
};

const FILTER_TABS = [
  { value: "all",                    label: "All",           emoji: "🌍" },
  { value: LocationType.GRAFFITI,    label: "Art",           emoji: "🎨" },
  { value: LocationType.DANCE,       label: "Dance",         emoji: "💃" },
  { value: LocationType.MUSIC,       label: "Music",         emoji: "🎵" },
  { value: LocationType.RAP,         label: "Rap / MC",      emoji: "🎤" },
  { value: LocationType.OPEN_MIC,    label: "Open Mic",      emoji: "🎙️" },
  { value: LocationType.SKATE,       label: "Skate",         emoji: "🛹" },
  { value: LocationType.BMX,         label: "BMX",           emoji: "🚲" },
  { value: LocationType.PARKOUR,     label: "Parkour",       emoji: "🤸" },
  { value: LocationType.TABLE_TENNIS,label: "Table Tennis",  emoji: "🏓" },
  { value: LocationType.BASKETBALL,  label: "Basketball",    emoji: "🏀" },
  { value: LocationType.PADEL,       label: "Padel",         emoji: "🎾" },
  { value: LocationType.BOULDERING,  label: "Bouldering",    emoji: "🧗" },
  { value: LocationType.TRAINING,    label: "Training",      emoji: "💪" },
  { value: LocationType.FITNESS,     label: "Fitness",       emoji: "🏋️" },
  { value: LocationType.CULTURAL_HUB,label: "Cultural Hub",  emoji: "🏛️" },
  { value: LocationType.WORKSHOP,    label: "Workshop",      emoji: "🔧" },
  { value: LocationType.CAFE,        label: "Café",          emoji: "☕" },
  { value: LocationType.RESTAURANT,  label: "Restaurant",    emoji: "🍽️" },
  { value: LocationType.WELLNESS,    label: "Wellness",      emoji: "🧖" },
  { value: LocationType.NIGHTLIFE,   label: "Nightlife",     emoji: "🌙" },
  { value: LocationType.BEATBOX,     label: "Beatbox",       emoji: "🎤" },
  { value: LocationType.PERFORMANCE, label: "Performance",   emoji: "🎭" },
];

const extractCity = (address?: string | null): string | null => {
  if (!address) return null;
  const parts = address.split(",").map(p => p.trim());
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const secondLast = parts[parts.length - 2];
    if (/\d{4}/.test(last)) return secondLast;
    return last;
  }
  return parts[0];
};

const getStatusBadge = (status?: string, isVisible?: boolean) => {
  if (status === 'pending') {
    return (
      <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300">
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    );
  }
  if (status === 'rejected') {
    return (
      <Badge variant="outline" className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300">
        <X className="h-3 w-3 mr-1" />
        Rejected
      </Badge>
    );
  }
  if (isVisible === false) {
    return (
      <Badge variant="outline" className="bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 border-gray-300">
        <EyeOff className="h-3 w-3 mr-1" />
        Hidden
      </Badge>
    );
  }
  return null;
};

const SpotCardMenu = ({ location, isAdmin, isOwner, onApprove, onReject, onToggleVisibility, onEdit, onDelete, dark }: {
  location: SpotLocation; isAdmin: boolean; isOwner: boolean | number | null | undefined; dark?: boolean;
  onApprove?: (id: number) => void; onReject?: (id: number) => void;
  onToggleVisibility?: (id: number, isVisible: boolean) => void;
  onEdit?: (l: SpotLocation) => void; onDelete?: (l: SpotLocation) => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button size="icon" variant="ghost"
        className={cn("h-7 w-7 rounded-full shrink-0 border-0", dark ? "bg-black/40 hover:bg-black/60 text-white" : "bg-muted hover:bg-muted/80 text-muted-foreground")}
        data-testid={`button-spot-menu-${location.id}`}>
        {isAdmin ? <Shield className="h-3 w-3" /> : <MoreVertical className="h-3 w-3" />}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      {isOwner && (
        <>
          <DropdownMenuItem onClick={() => onEdit?.(location)} data-testid={`button-edit-spot-${location.id}`}>
            <Edit className="h-4 w-4 mr-2" />Edit Spot
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDelete?.(location)} className="text-destructive focus:text-destructive" data-testid={`button-delete-spot-${location.id}`}>
            <Trash2 className="h-4 w-4 mr-2" />Delete Spot
          </DropdownMenuItem>
        </>
      )}
      {isAdmin && isOwner && <DropdownMenuSeparator />}
      {isAdmin && (
        <>
          {location.approvalStatus === 'pending' && (
            <>
              <DropdownMenuItem onClick={() => onApprove?.(location.id as number)}>
                <Check className="h-4 w-4 mr-2 text-green-600" />Approve Spot
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onReject?.(location.id as number)}>
                <X className="h-4 w-4 mr-2 text-red-600" />Reject Spot
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem onClick={() => onToggleVisibility?.(location.id as number, !location.isVisible)}>
            {location.isVisible ? <><EyeOff className="h-4 w-4 mr-2" />Hide Spot</> : <><Eye className="h-4 w-4 mr-2" />Show Spot</>}
          </DropdownMenuItem>
        </>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
);

const SpotCard = ({ location, isAdmin, currentUserId, onApprove, onReject, onToggleVisibility, onEdit, onDelete, onSchedule, horizontal }: SpotCardProps) => {
  const config = CATEGORY_CONFIG[location.type] || CATEGORY_CONFIG[LocationType.OTHER];
  const citySpotEmoji = location.source === "city" ? (CITY_SPOT_EMOJI[location.originalCategory || ""] || config.emoji) : config.emoji;
  const isOwner = currentUserId && location.createdBy === currentUserId;
  const showMenu = location.source === "user" && (isAdmin || isOwner);
  const city = extractCity(location.address);
  const hasImage = location.images && location.images.length > 0;
  const menuProps = { location, isAdmin, isOwner, onApprove, onReject, onToggleVisibility, onEdit, onDelete };

  /* ── HORIZONTAL card (mobile list) ── */
  if (horizontal) {
    return (
      <div
        className={cn("group flex items-stretch rounded-2xl overflow-hidden border border-border/40 bg-card shadow-sm transition-all duration-200 active:scale-[0.98]", location.isVisible === false && "opacity-60")}
        data-testid={`card-spot-${location.id}`}
      >
        <div className={cn("relative w-24 shrink-0 overflow-hidden", !hasImage && `bg-gradient-to-br ${config.gradient}`)}>
          {hasImage
            ? <img src={location.images![0]} alt={location.name} className="w-full h-full object-cover" />
            : <div className="flex items-center justify-center h-full"><span className="text-3xl select-none">{citySpotEmoji}</span></div>
          }
          {location.isFeatured && <div className="absolute top-1 left-1"><span className="text-[9px] bg-amber-500 text-white rounded px-1 leading-4 font-bold">⭐</span></div>}
          {location.approvalStatus === 'pending' && <div className="absolute bottom-1 left-0 right-0 text-center"><span className="text-[8px] bg-amber-500/90 text-white px-1 leading-4">Pending</span></div>}
        </div>
        <div className="flex-1 min-w-0 px-3 py-2.5 flex flex-col justify-between gap-1">
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground line-clamp-1 leading-tight">{location.name}</h3>
              <div className="flex items-center gap-1 mt-0.5">
                <MapPin className="h-2.5 w-2.5 text-muted-foreground/60 shrink-0" />
                <span className="text-[11px] text-muted-foreground truncate">{city || location.address || 'Netherlands'}</span>
              </div>
            </div>
            {showMenu && <SpotCardMenu {...menuProps} />}
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 flex-wrap min-w-0">
              <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5 shrink-0">{citySpotEmoji} {config.label}</span>
              {location.isFree !== undefined && (
                <span className={cn("text-[10px] font-medium rounded-full px-2 py-0.5 shrink-0", location.isFree ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400")}>
                  {location.isFree ? "Free" : "Paid"}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {location.source === "user" ? (
                <Link to={`/locations/${location.id}`}>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-600 bg-violet-100 dark:bg-violet-900/20 hover:bg-violet-200 rounded-full px-2.5 py-1 transition-colors" data-testid={`button-view-${location.id}`}>
                    <Eye className="h-2.5 w-2.5" />View
                  </span>
                </Link>
              ) : location.source === "city" && location.spotlightNumericId ? (
                <Link to={`/spots/spotlight/${location.spotlightNumericId}`}>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-600 bg-violet-100 dark:bg-violet-900/20 hover:bg-violet-200 rounded-full px-2.5 py-1 transition-colors" data-testid={`button-view-${location.id}`}>
                    <Eye className="h-2.5 w-2.5" />View
                  </span>
                </Link>
              ) : location.source === "osm" && location.osmNumericId ? (
                <Link to={`/spots/city/${location.osmNumericId}`}>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-600 bg-violet-100 dark:bg-violet-900/20 hover:bg-violet-200 rounded-full px-2.5 py-1 transition-colors" data-testid={`button-view-${location.id}`}>
                    <Eye className="h-2.5 w-2.5" />View
                  </span>
                </Link>
              ) : null}
              <button
                onClick={() => onSchedule?.(location)}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100 dark:bg-emerald-900/20 hover:bg-emerald-200 dark:hover:bg-emerald-900/40 rounded-full px-2.5 py-1 transition-colors"
                data-testid={`button-schedule-${location.id}`}
              >
                <CalendarDays className="h-2.5 w-2.5" />Schedule
              </button>
              <Link to={`/map?lat=${location.latitude}&lng=${location.longitude}${location.source === "user" ? `&id=${location.id}` : ''}`}>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-full px-2.5 py-1 transition-colors" data-testid={`button-map-${location.id}`}>
                  <MapPin className="h-2.5 w-2.5" />Map
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── VERTICAL card (grid) ── */
  return (
    <Card
      className={cn(
        "group transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden border border-border/40 shadow-sm bg-card rounded-2xl",
        location.isVisible === false && "opacity-60"
      )}
      data-testid={`card-spot-${location.id}`}
    >
      {/* Image / gradient hero */}
      <div className={cn("relative h-40 w-full overflow-hidden", !hasImage && `bg-gradient-to-br ${config.gradient}`)}>
        {hasImage ? (
          <>
            <img
              src={location.images![0]}
              alt={location.name}
              className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            <div className="flex items-center justify-center h-full">
              <span className="text-6xl opacity-90 drop-shadow-lg select-none" aria-hidden="true">{citySpotEmoji}</span>
            </div>
          </>
        )}

        {/* Top controls */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
          {location.isFeatured && (
            <Badge className="bg-amber-500/95 text-white border-0 text-[10px] px-1.5 py-0.5 shadow" data-testid={`badge-featured-${location.id}`}>⭐ Featured</Badge>
          )}
          {showMenu && <SpotCardMenu {...menuProps} dark />}
        </div>
        {(location.approvalStatus === 'pending' || location.approvalStatus === 'rejected' || location.isVisible === false) && (
          <div className="absolute top-2.5 left-2.5">
            {location.approvalStatus === 'pending' && <Badge variant="outline" className="bg-amber-100/90 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 border-amber-300 text-[10px] backdrop-blur-sm"><Clock className="h-2.5 w-2.5 mr-1" />Pending</Badge>}
            {location.approvalStatus === 'rejected' && <Badge variant="outline" className="bg-red-100/90 dark:bg-red-900/60 text-red-700 dark:text-red-300 border-red-300 text-[10px] backdrop-blur-sm"><X className="h-2.5 w-2.5 mr-1" />Rejected</Badge>}
            {location.isVisible === false && location.approvalStatus !== 'pending' && location.approvalStatus !== 'rejected' && <Badge variant="outline" className="bg-gray-100/90 dark:bg-gray-900/60 text-gray-600 border-gray-300 text-[10px] backdrop-blur-sm"><EyeOff className="h-2.5 w-2.5 mr-1" />Hidden</Badge>}
          </div>
        )}

        {/* Bottom info overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-8 bg-gradient-to-t from-black/80 to-transparent">
          <h3 className="text-white font-bold text-sm leading-snug line-clamp-1 drop-shadow">{location.name}</h3>
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin className="h-2.5 w-2.5 text-white/60 shrink-0" />
            <span className="text-white/60 text-[10px] truncate">{city || location.address || 'Netherlands'}</span>
            <span className="ml-auto shrink-0 text-[10px] bg-black/40 text-white/90 backdrop-blur-sm rounded px-1.5 py-0.5">{citySpotEmoji} {config.label}</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <CardContent className="px-3 pt-3 pb-2 space-y-2">
        {location.description
          ? <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{location.description}</p>
          : <p className="text-xs text-muted-foreground/40 italic">No description yet</p>
        }
        <div className="flex flex-wrap gap-1">
          <span className={cn("text-[10px] font-medium rounded-full px-2 py-0.5", location.source === "city" ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" : "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400")}>
            {location.source === "city" ? "🏙️ City" : "👤 Community"}
          </span>
          {location.isFree !== undefined && (
            <span className={cn("text-[10px] font-medium rounded-full px-2 py-0.5", location.isFree ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400")}>
              {location.isFree ? "✓ Free" : "€ Paid"}
            </span>
          )}
          {location.skillLevel && (
            <span className="text-[10px] font-medium rounded-full px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              {location.skillLevel.charAt(0).toUpperCase() + location.skillLevel.slice(1)}
            </span>
          )}
        </div>
      </CardContent>

      <CardFooter className="px-3 pt-0 pb-3 flex items-center gap-1.5">
        {location.website && (
          <a href={location.website} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
            data-testid={`link-website-${location.id}`}>
            <ExternalLink className="h-3 w-3" />Site
          </a>
        )}
        <div className="flex-1" />
        {location.source === "user" ? (
          <Button asChild variant="outline" size="sm" className="h-7 text-[11px] px-3 rounded-full border-border/50" data-testid={`button-view-${location.id}`}>
            <Link to={`/locations/${location.id}`}><Eye className="h-3 w-3 mr-1" />View</Link>
          </Button>
        ) : location.source === "city" && location.spotlightNumericId ? (
          <Button asChild variant="outline" size="sm" className="h-7 text-[11px] px-3 rounded-full border-border/50" data-testid={`button-view-${location.id}`}>
            <Link to={`/spots/spotlight/${location.spotlightNumericId}`}><Eye className="h-3 w-3 mr-1" />View</Link>
          </Button>
        ) : location.source === "osm" && location.osmNumericId ? (
          <Button asChild variant="outline" size="sm" className="h-7 text-[11px] px-3 rounded-full border-border/50" data-testid={`button-view-${location.id}`}>
            <Link to={`/spots/city/${location.osmNumericId}`}><Eye className="h-3 w-3 mr-1" />View</Link>
          </Button>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[11px] px-3 rounded-full border-emerald-300 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
          onClick={() => onSchedule?.(location)}
          data-testid={`button-schedule-${location.id}`}
        >
          <CalendarDays className="h-3 w-3 mr-1" />Schedule
        </Button>
        <Button asChild size="sm" className="h-7 text-[11px] px-3 rounded-full" data-testid={`button-map-${location.id}`}>
          <Link to={`/map?lat=${location.latitude}&lng=${location.longitude}${location.source === "user" ? `&id=${location.id}` : ''}`}>
            <MapPin className="h-3 w-3 mr-1" />Map
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
};

type SortMode = "newest" | "az" | "category";

const WEEK_DAYS = [
  { key: "Mo", label: "Mon" },
  { key: "Tu", label: "Tue" },
  { key: "We", label: "Wed" },
  { key: "Th", label: "Thu" },
  { key: "Fr", label: "Fri" },
  { key: "Sa", label: "Sat" },
  { key: "Su", label: "Sun" },
];

interface DaySchedule { enabled: boolean; open: string; close: string; }
type WeekSchedule = Record<string, DaySchedule>;

function buildHoursString(schedule: WeekSchedule): string {
  const enabled = WEEK_DAYS.filter(d => schedule[d.key]?.enabled);
  if (enabled.length === 0) return "";
  const groups: string[] = [];
  let i = 0;
  while (i < enabled.length) {
    const start = enabled[i];
    const { open, close } = schedule[start.key];
    let j = i + 1;
    while (j < enabled.length) {
      const next = enabled[j];
      const sched = schedule[next.key];
      if (sched.open === open && sched.close === close && WEEK_DAYS.findIndex(d => d.key === next.key) === WEEK_DAYS.findIndex(d => d.key === enabled[j - 1].key) + 1) {
        j++;
      } else break;
    }
    const endDay = enabled[j - 1];
    const range = start.key === endDay.key ? start.key : `${start.key}-${endDay.key}`;
    groups.push(`${range} ${open}-${close}`);
    i = j;
  }
  return groups.join("; ");
}

function ScheduleEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const initSchedule = (): WeekSchedule => {
    const s: WeekSchedule = {};
    WEEK_DAYS.forEach(d => { s[d.key] = { enabled: false, open: "09:00", close: "18:00" }; });
    return s;
  };
  const [schedule, setSchedule] = useState<WeekSchedule>(initSchedule);
  const [mode, setMode] = useState<"structured" | "text">("structured");

  const updateDay = (key: string, patch: Partial<DaySchedule>) => {
    setSchedule(prev => {
      const next = { ...prev, [key]: { ...prev[key], ...patch } };
      onChange(buildHoursString(next));
      return next;
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Opening Hours</span>
        <button
          type="button"
          onClick={() => setMode(m => m === "structured" ? "text" : "structured")}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          {mode === "structured" ? "Enter manually" : "Use schedule picker"}
        </button>
      </div>
      {mode === "text" ? (
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="e.g. Mo-Fr 09:00-18:00; Sa 10:00-17:00"
          data-testid="input-edit-hours"
        />
      ) : (
        <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
          {WEEK_DAYS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-3">
              <Switch
                checked={schedule[key].enabled}
                onCheckedChange={v => updateDay(key, { enabled: v })}
                data-testid={`switch-day-${key}`}
              />
              <span className={cn("text-sm w-8 shrink-0", schedule[key].enabled ? "text-foreground font-medium" : "text-muted-foreground")}>{label}</span>
              {schedule[key].enabled ? (
                <div className="flex items-center gap-1.5 flex-1">
                  <Input
                    type="time"
                    value={schedule[key].open}
                    onChange={e => updateDay(key, { open: e.target.value })}
                    className="h-8 text-xs px-2 flex-1"
                    data-testid={`input-open-${key}`}
                  />
                  <span className="text-xs text-muted-foreground shrink-0">to</span>
                  <Input
                    type="time"
                    value={schedule[key].close}
                    onChange={e => updateDay(key, { close: e.target.value })}
                    className="h-8 text-xs px-2 flex-1"
                    data-testid={`input-close-${key}`}
                  />
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Closed</span>
              )}
            </div>
          ))}
          {value && (
            <p className="text-[10px] text-muted-foreground pt-1 font-mono truncate">→ {value}</p>
          )}
        </div>
      )}
    </div>
  );
}

const SpotsView = () => {
  const [currentFilter, setCurrentFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [addSpotDialogOpen, setAddSpotDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSpot, setSelectedSpot] = useState<SpotLocation | null>(null);
  const [displayLimit, setDisplayLimit] = useState(60);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const canAddSpots = isAdmin || !!(user as any)?.canAddSpots;

  // ── Schedule modal state ──────────────────────────────────────────────
  const [scheduleSpot, setScheduleSpot] = useState<SpotLocation | null>(null);

  const editForm = useForm<EditSpotFormData>({
    resolver: zodResolver(editSpotSchema),
    defaultValues: {
      name: '',
      description: '',
      address: '',
      type: '',
      skillLevel: '',
      surfaceType: '',
      openingHours: '',
      isFree: true,
      website: '',
      contactInfo: '',
    },
  });

  const invalidateAllLocationQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
    queryClient.invalidateQueries({ queryKey: ["/api/locations", { showAll: true }] });
    queryClient.invalidateQueries({ queryKey: ["/api/locations/pending"] });
    queryClient.invalidateQueries({ queryKey: ["/api/users/saved-locations"] });
    queryClient.invalidateQueries({ queryKey: ["/api/spots/owner"] });
    queryClient.invalidateQueries({ queryKey: ["/api/users/my-locations"] });
  };

  const { data: locations, isLoading: locationsLoading } = useQuery<any[]>({
    queryKey: ["/api/locations"],
  });

  const { data: myLocations = [], isLoading: myLocationsLoading } = useQuery<any[]>({
    queryKey: ["/api/users/my-locations"],
    enabled: !!user && canAddSpots,
  });

  const { data: citySpots, isLoading: citySpotsLoading } = useQuery<SpotlightedPlace[]>({
    queryKey: ["/api/city-spots/spotlights"],
  });

  const { data: osmCitySpots } = useQuery<any[]>({
    queryKey: ["/api/city-spots"],
  });

  const isLoading = locationsLoading || citySpotsLoading;

  const allSpots = useMemo((): SpotLocation[] => {
    const result: SpotLocation[] = [];

    if (Array.isArray(citySpots)) {
      for (const cs of citySpots) {
        const mappedType = CITY_CATEGORY_TO_TYPE[cs.category] || LocationType.OTHER;
        result.push({
          id: `city-${cs.id}`,
          name: cs.name,
          description: cs.adminNote || null,
          type: mappedType,
          images: null,
          address: cs.address || null,
          latitude: String(cs.lat),
          longitude: String(cs.lon),
          isFree: undefined,
          website: cs.website || null,
          isFeatured: cs.active === true,
          source: "city",
          originalCategory: cs.category,
          createdAt: cs.createdAt ? String(cs.createdAt) : null,
          linkedLocationId: (cs as any).linkedLocationId || null,
          spotlightNumericId: cs.id,
        });
      }
    }

    // Add OSM city spots not already in spotlights (dedupe by name)
    if (Array.isArray(osmCitySpots)) {
      const spotlightNameSet = new Set(
        (citySpots || []).map(cs => cs.name.toLowerCase().trim())
      );
      for (const osm of osmCitySpots) {
        if (!osm.id || spotlightNameSet.has((osm.name || "").toLowerCase().trim())) continue;
        const mappedType = CITY_CATEGORY_TO_TYPE[osm.category] || LocationType.OTHER;
        result.push({
          id: `osm-${osm.id}`,
          name: osm.name,
          description: null,
          type: mappedType,
          images: null,
          address: osm.address || null,
          latitude: String(osm.lat),
          longitude: String(osm.lon),
          isFree: undefined,
          website: osm.website || null,
          isFeatured: false,
          source: "osm",
          originalCategory: osm.category,
          createdAt: null,
          osmNumericId: typeof osm.id === "number" ? osm.id : undefined,
        });
      }
    }

    if (Array.isArray(locations)) {
      for (const loc of locations) {
        result.push({
          ...loc,
          source: "user" as const,
          isFeatured: false,
          createdAt: loc.createdAt || null,
        });
      }
    }

    return result;
  }, [locations, citySpots, osmCitySpots]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const spot of allSpots) {
      const t = spot.type || LocationType.OTHER;
      counts[t] = (counts[t] || 0) + 1;
    }
    return counts;
  }, [allSpots]);

  const filteredAndSortedSpots = useMemo(() => {
    // "mine" filter shows user's own submitted spots (including pending)
    let filtered = currentFilter === "mine"
      ? myLocations.map(loc => ({ ...loc, source: "user" as const }))
      : allSpots;

    if (currentFilter === "pending") {
      filtered = filtered.filter(s => s.approvalStatus === 'pending');
    } else if (currentFilter !== "all" && currentFilter !== "mine") {
      filtered = filtered.filter(s => s.type === currentFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.address && s.address.toLowerCase().includes(q))
      );
    }

    const sorted = [...filtered];
    switch (sortMode) {
      case "az":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "category":
        sorted.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
        break;
      case "newest":
      default:
        sorted.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        break;
    }

    return sorted;
  }, [allSpots, currentFilter, searchQuery, sortMode]);

  const pendingCount = useMemo(() =>
    allSpots.filter(s => s.approvalStatus === 'pending').length
  , [allSpots]);

  useEffect(() => {
    setDisplayLimit(60);
  }, [currentFilter, searchQuery, sortMode]);

  const visibleSpots = useMemo(() =>
    filteredAndSortedSpots.slice(0, displayLimit)
  , [filteredAndSortedSpots, displayLimit]);

  const remainingCount = filteredAndSortedSpots.length - visibleSpots.length;

  const topCategories = useMemo(() => {
    return Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([type, count]) => ({
        type,
        count,
        config: CATEGORY_CONFIG[type] || CATEGORY_CONFIG[LocationType.OTHER],
      }));
  }, [categoryCounts]);

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/locations/${id}/approve`, "POST");
    },
    onSuccess: () => {
      invalidateAllLocationQueries();
      toast({ title: "Spot approved", description: "The spot is now visible to all users" });
    },
    onError: () => {
      toast({ title: "Failed to approve", description: "Could not approve the spot", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/locations/${id}/reject`, "POST", { reason: "Rejected by admin" });
    },
    onSuccess: () => {
      invalidateAllLocationQueries();
      toast({ title: "Spot rejected", description: "The spot has been rejected" });
    },
    onError: () => {
      toast({ title: "Failed to reject", description: "Could not reject the spot", variant: "destructive" });
    },
  });

  const visibilityMutation = useMutation({
    mutationFn: async ({ id, isVisible }: { id: number; isVisible: boolean }) => {
      return apiRequest(`/api/locations/${id}/visibility`, "POST", { isVisible });
    },
    onSuccess: (_, variables) => {
      invalidateAllLocationQueries();
      toast({
        title: variables.isVisible ? "Spot shown" : "Spot hidden",
        description: variables.isVisible ? "The spot is now visible to users" : "The spot is now hidden from users",
      });
    },
    onError: () => {
      toast({ title: "Failed to update visibility", description: "Could not update spot visibility", variant: "destructive" });
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: EditSpotFormData }) => {
      return apiRequest(`/api/locations/${id}`, "PUT", data);
    },
    onSuccess: () => {
      invalidateAllLocationQueries();
      setEditDialogOpen(false);
      setSelectedSpot(null);
      editForm.reset();
      toast({ title: "Spot updated", description: "Your spot has been updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update", description: "Could not update the spot. Please try again.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/locations/${id}`, "DELETE");
    },
    onSuccess: () => {
      invalidateAllLocationQueries();
      setDeleteDialogOpen(false);
      setSelectedSpot(null);
      toast({ title: "Spot deleted", description: "Your spot has been permanently deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete", description: "Could not delete the spot. Please try again.", variant: "destructive" });
    },
  });

  const handleEditSpot = (spot: SpotLocation) => {
    setSelectedSpot(spot);
    editForm.reset({
      name: spot.name,
      description: spot.description || '',
      address: spot.address || '',
      type: spot.type || '',
      skillLevel: spot.skillLevel || '',
      surfaceType: spot.surfaceType || '',
      openingHours: spot.openingHours || '',
      isFree: spot.isFree ?? true,
      website: spot.website || '',
      contactInfo: spot.contactInfo || '',
    });
    setEditDialogOpen(true);
  };

  const handleDeleteSpot = (spot: SpotLocation) => {
    setSelectedSpot(spot);
    setDeleteDialogOpen(true);
  };

  const onEditSubmit = (data: EditSpotFormData) => {
    if (!selectedSpot) return;
    editMutation.mutate({ id: selectedSpot.id as number, data });
  };

  const confirmDelete = () => {
    if (!selectedSpot) return;
    deleteMutation.mutate(selectedSpot.id as number);
  };

  const clearFilters = () => {
    setCurrentFilter("all");
    setSearchQuery("");
  };

  return (
    <div className="space-y-4">

      {/* ── Hero stats banner ── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 p-4 sm:p-5" data-testid="stats-bar">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white" data-testid="text-total-spots">{allSpots.length}</span>
              <span className="text-white/80 font-medium text-sm">Culture Spots</span>
            </div>
            <p className="text-white/60 text-xs mt-0.5">across the Netherlands</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {topCategories.map(({ type, count, config: cfg }) => (
              <button
                key={type}
                onClick={() => setCurrentFilter(type)}
                className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
              >
                <span>{cfg.emoji}</span>
                <span className="font-bold">{count}</span>
                <span className="opacity-80 hidden sm:inline">{cfg.label}</span>
              </button>
            ))}
            {canAddSpots && (
              <Button
                onClick={() => setAddSpotDialogOpen(true)}
                className="h-8 bg-white text-violet-700 hover:bg-white/90 font-semibold text-xs rounded-full gap-1.5 shadow-lg"
                data-testid="button-add-spot"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Spot
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Search + Sort row ── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search spots…"
            className="pl-9 pr-8 h-10 rounded-xl border-border/60 bg-muted/40 focus:bg-background text-sm"
            data-testid="input-search-spots"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 hover:bg-transparent"
              onClick={() => setSearchQuery("")}
              data-testid="button-clear-search"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          )}
        </div>
        <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
          <SelectTrigger className="h-10 w-[110px] rounded-xl border-border/60 bg-muted/40 text-xs shrink-0" data-testid="select-sort">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1 opacity-60" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="az">A – Z</SelectItem>
            <SelectItem value="category">Category</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Pill filter strip ── */}
      <div className="relative">
        <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden pb-0.5 -mx-1 px-1">
          <div className="flex items-center gap-1.5 min-w-max">
            {FILTER_TABS.map(tab => {
              const count = tab.value === "all" ? allSpots.length : (categoryCounts[tab.value] || 0);
              const isActive = currentFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setCurrentFilter(tab.value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full whitespace-nowrap shrink-0 transition-all duration-200 border",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-sm scale-105"
                      : "bg-background text-muted-foreground border-border/50 hover:border-primary/40 hover:text-foreground hover:bg-muted/60"
                  )}
                  data-testid={`filter-${tab.value}`}
                >
                  <span className="text-base leading-none">{tab.emoji}</span>
                  <span>{tab.label}</span>
                  {count > 0 && (
                    <span className={cn(
                      "text-[9px] font-bold rounded-full px-1 min-w-[16px] text-center leading-4",
                      isActive ? "bg-white/25 text-white" : "bg-muted text-muted-foreground"
                    )}>{count}</span>
                  )}
                </button>
              );
            })}
            {isAdmin && (
              <button
                onClick={() => setCurrentFilter("pending")}
                className={cn(
                  "inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full whitespace-nowrap shrink-0 transition-all duration-200 border",
                  currentFilter === "pending"
                    ? "bg-amber-500 text-white border-amber-500 shadow-sm scale-105"
                    : "bg-background text-muted-foreground border-border/50 hover:border-amber-400 hover:text-amber-600"
                )}
                data-testid="filter-pending"
              >
                <span className="text-base leading-none">⏳</span>
                <span>Pending</span>
                {pendingCount > 0 && (
                  <span className="bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] px-1 text-center leading-4">
                    {pendingCount}
                  </span>
                )}
              </button>
            )}
            {canAddSpots && (
              <button
                onClick={() => setCurrentFilter("mine")}
                className={cn(
                  "inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full whitespace-nowrap shrink-0 transition-all duration-200 border",
                  currentFilter === "mine"
                    ? "bg-violet-600 text-white border-violet-600 shadow-sm scale-105"
                    : "bg-background text-muted-foreground border-border/50 hover:border-violet-400 hover:text-violet-600"
                )}
                data-testid="filter-mine"
              >
                <span className="text-base leading-none">📍</span>
                <span>My Spots</span>
                {myLocations.length > 0 && (
                  <span className="bg-violet-600 text-white text-[9px] font-bold rounded-full min-w-[16px] px-1 text-center leading-4">
                    {myLocations.length}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Results label ── */}
      {!isLoading && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {filteredAndSortedSpots.length > 0
              ? <><span className="font-semibold text-foreground">{filteredAndSortedSpots.length}</span> spot{filteredAndSortedSpots.length !== 1 ? 's' : ''}{currentFilter !== 'all' ? ` in ${CATEGORY_CONFIG[currentFilter]?.label || currentFilter}` : ''}</>
              : 'No results'
            }
          </p>
          {(searchQuery || currentFilter !== "all") && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 text-xs text-muted-foreground hover:text-foreground px-2" data-testid="button-clear-filters">
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </div>
      )}

      {/* ── Cards grid (split: Community vs Organization) ── */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-2xl bg-muted/50 animate-pulse h-24 sm:h-28" />
          ))}
        </div>
      ) : filteredAndSortedSpots.length > 0 ? (
        (() => {
          const communitySpots = visibleSpots.filter(s => s.source === "user");
          const orgSpots = visibleSpots.filter(s => s.source === "city" || s.source === "osm");

          const renderSpotGrid = (spots: SpotLocation[]) => (
            <>
              <div className="flex flex-col gap-3 sm:hidden">
                {spots.map((location) => (
                  <SpotCard
                    key={location.id}
                    location={location}
                    isAdmin={isAdmin}
                    currentUserId={user?.id}
                    onApprove={(id) => approveMutation.mutate(id)}
                    onReject={(id) => rejectMutation.mutate(id)}
                    onToggleVisibility={(id, isVisible) => visibilityMutation.mutate({ id, isVisible })}
                    onEdit={handleEditSpot}
                    onDelete={handleDeleteSpot}
                    onSchedule={setScheduleSpot}
                    horizontal
                  />
                ))}
              </div>
              <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {spots.map((location) => (
                  <SpotCard
                    key={location.id}
                    location={location}
                    isAdmin={isAdmin}
                    currentUserId={user?.id}
                    onApprove={(id) => approveMutation.mutate(id)}
                    onReject={(id) => rejectMutation.mutate(id)}
                    onToggleVisibility={(id, isVisible) => visibilityMutation.mutate({ id, isVisible })}
                    onEdit={handleEditSpot}
                    onDelete={handleDeleteSpot}
                    onSchedule={setScheduleSpot}
                  />
                ))}
              </div>
            </>
          );

          const loadMoreButton = remainingCount > 0 && (
            <div className="flex flex-col items-center gap-2 pt-2" data-testid="load-more-spots">
              <Button
                variant="outline"
                onClick={() => setDisplayLimit(l => l + 60)}
                className="rounded-full px-6 h-10 text-sm font-medium gap-2"
                data-testid="button-load-more"
              >
                <ArrowUpDown className="h-4 w-4" />
                Load {Math.min(remainingCount, 60)} more spots
              </Button>
              <p className="text-xs text-muted-foreground">
                Showing {visibleSpots.length} of {filteredAndSortedSpots.length} spots
              </p>
            </div>
          );

          if (currentFilter !== "all" && currentFilter !== "mine" && currentFilter !== "pending") {
            return (
              <div className="space-y-4">
                {renderSpotGrid(visibleSpots)}
                {loadMoreButton}
              </div>
            );
          }

          return (
            <div className="space-y-6">
              {communitySpots.length > 0 && (
                <section data-testid="section-community-spots">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-base font-bold flex items-center gap-2">
                      <span className="text-lg">👤</span>
                      Community Spots
                    </span>
                    <span className="text-[11px] font-semibold bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded-full px-2 py-0.5">
                      {filteredAndSortedSpots.filter(s => s.source === "user").length}
                    </span>
                  </div>
                  {renderSpotGrid(communitySpots)}
                </section>
              )}
              {orgSpots.length > 0 && (
                <section data-testid="section-org-spots">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-base font-bold flex items-center gap-2">
                      <span className="text-lg">🏙️</span>
                      City &amp; Organization Spots
                    </span>
                    <span className="text-[11px] font-semibold bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 rounded-full px-2 py-0.5">
                      {filteredAndSortedSpots.filter(s => s.source === "city" || s.source === "osm").length}
                    </span>
                  </div>
                  {renderSpotGrid(orgSpots)}
                </section>
              )}
              {loadMoreButton}
            </div>
          );
        })()
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center" data-testid="empty-state">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4 text-3xl">🔍</div>
          <h3 className="text-base font-semibold text-foreground mb-1">No spots found</h3>
          <p className="text-sm text-muted-foreground mb-5 max-w-xs">
            {searchQuery
              ? `Nothing matched "${searchQuery}". Try a different term or clear filters.`
              : currentFilter !== "all"
                ? `No spots in ${CATEGORY_CONFIG[currentFilter]?.label || currentFilter} yet.`
                : "No spots yet — be the first to add one!"
            }
          </p>
          {(searchQuery || currentFilter !== "all") && (
            <Button variant="outline" onClick={clearFilters} className="rounded-full" data-testid="button-clear-filters">
              <X className="h-4 w-4 mr-2" />
              Clear filters
            </Button>
          )}
        </div>
      )}

      <AddSpotDialog
        open={addSpotDialogOpen}
        onOpenChange={setAddSpotDialogOpen}
      />

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md max-h-[85vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-lg">Edit Spot</DialogTitle>
            <DialogDescription className="text-sm">
              Make changes to your spot details.
            </DialogDescription>
          </DialogHeader>

          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Spot Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter spot name" data-testid="input-edit-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Spot Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SPOT_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Describe this spot"
                        rows={3}
                        data-testid="input-edit-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Street address" data-testid="input-edit-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="openingHours"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <ScheduleEditor value={field.value || ""} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="https://example.com" data-testid="input-edit-website" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="isFree"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Free Access</FormLabel>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-edit-free"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                  className="w-full sm:w-auto"
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={editMutation.isPending}
                  className="w-full sm:w-auto"
                  data-testid="button-save-edit"
                >
                  {editMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="w-[95vw] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Spot</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Are you sure you want to delete "{selectedSpot?.name}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto" data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Spot
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* ── Schedule Modal ── */}
      {scheduleSpot && (() => {
        const src = scheduleSpot.source;
        const spotRef = src === "city" && scheduleSpot.spotlightNumericId
          ? `city-${scheduleSpot.spotlightNumericId}`
          : src === "osm" && scheduleSpot.osmNumericId
          ? `osm-${scheduleSpot.osmNumericId}`
          : `user-${scheduleSpot.id}`;
        return (
          <SpotScheduleModal
            open={!!scheduleSpot}
            onClose={() => setScheduleSpot(null)}
            spotRef={spotRef}
            spotName={scheduleSpot.name}
            spotType={scheduleSpot.type}
            spotAddress={scheduleSpot.address || "Netherlands"}
          />
        );
      })()}
    </div>
  );
};

export default SpotsView;
