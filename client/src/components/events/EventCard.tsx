import { useState, memo } from "react";
import { Link, useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLocalizedEvent } from "@/lib/localize";
import { getEventPriceInfo } from "@/lib/eventPrice";
import { format, differenceInMinutes, differenceInHours } from "date-fns";
import { nl, enUS } from "date-fns/locale";
import {
  Heart, MapPin, Calendar, ExternalLink, Zap, Star,
  Edit, Trash2, MoreVertical, Ticket, Clock, Navigation
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Event } from "@shared/schema";
import { EVENT_CATEGORY_LABELS, EVENT_CATEGORY_ICONS } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { canManageEvent } from "@/lib/permissions";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import TicketPurchaseForm from "./TicketPurchaseForm";
import RSVPForm from "./RSVPForm";
import StripeWrapper from "./StripeWrapper";
import { EventDeleteDialog } from "./EventDeleteDialog";
import { EventEditDialog } from "./EventEditDialog";

/* ─── Fallback images per category ─── */
const FALLBACK_IMAGES: Record<string, string> = {
  dance:     "https://images.unsplash.com/photo-1547153760-18fc86324498?w=800&q=80",
  festival:  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80",
  kids:      "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800&q=80",
  family:    "https://images.unsplash.com/photo-1511895426328-dc8714191011?w=800&q=80",
  music:     "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80",
  sports:    "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&q=80",
  workshop:  "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80",
  cultural:  "https://images.unsplash.com/photo-1578926288207-a90a5366759d?w=800&q=80",
  food:      "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80",
  community: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80",
  nightlife: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&q=80",
  art:       "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&q=80",
  skate:     "https://images.unsplash.com/photo-1547447134-cd3f5c716030?w=800&q=80",
  parkour:   "https://images.unsplash.com/photo-1531502387041-4ad9bc59aae0?w=800&q=80",
  default:   "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800&q=80",
};

/* ─── Category accent gradients ─── */
const CAT_GRADIENT: Record<string, [string, string]> = {
  dance:       ["#EC4899", "#8B5CF6"],
  music:       ["#E8500A", "#F59E0B"],
  festival:    ["#F59E0B", "#EF4444"],
  family:      ["#16A34A", "#14B8A6"],
  cultural:    ["#7C3AED", "#4F46E5"],
  sports:      ["#2563EB", "#0EA5E9"],
  art:         ["#A78BFA", "#EC4899"],
  nightlife:   ["#6D28D9", "#1E1B4B"],
  workshop:    ["#4F46E5", "#6366F1"],
  community:   ["#14B8A6", "#0EA5E9"],
  food:        ["#F97316", "#EF4444"],
  skate:       ["#84CC16", "#14B8A6"],
  parkour:     ["#EAB308", "#F97316"],
  competition: ["#DC2626", "#7C3AED"],
  kids:        ["#0EA5E9", "#14B8A6"],
  free:        ["#10B981", "#059669"],
};

function getGradient(category: string): [string, string] {
  return CAT_GRADIENT[category] ?? ["#6D28D9", "#4F46E5"];
}

function getEventImage(event: Event): string {
  if (event.image) return event.image;
  return FALLBACK_IMAGES[event.category] || FALLBACK_IMAGES.default;
}

/* ─── Countdown badge ─── */
function getCountdown(eventDate: Date, labels: { today: string; tomorrow: string }): { label: string; cls: string } | null {
  const now = new Date();
  const mins = differenceInMinutes(eventDate, now);
  if (mins < 0) return null;
  if (mins < 60) return {
    label: `${mins}m`,
    cls: "bg-red-500 text-white",
  };
  const hrs = differenceInHours(eventDate, now);
  if (hrs < 8) return {
    label: `${hrs}h ${mins % 60}m`,
    cls: "bg-orange-500 text-white",
  };
  if (hrs < 24) return { label: labels.today, cls: "bg-amber-400 text-amber-950" };
  if (hrs < 48) return { label: labels.tomorrow, cls: "bg-emerald-500 text-white" };
  return null;
}

interface EventCardProps {
  event: Event;
  variant?: "default" | "featured" | "compact";
  savedIds?: Set<number>;
  onSaveToggle?: (id: number) => void;
}

const EventCard = ({ event, variant = "default", savedIds, onSaveToggle }: EventCardProps) => {
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [showEditDialog, setShowEditDialog]     = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [imgError, setImgError]                 = useState(false);

  const { t, language } = useLanguage();
  const localizeEvent  = useLocalizedEvent();
  const loc            = localizeEvent(event);
  const { user }       = useAuth();
  const { toast }      = useToast();
  const queryClient    = useQueryClient();
  const canManage      = canManageEvent(user, event.organizerId);
  const [, navigate]   = useLocation();

  const isSaved = savedIds?.has(event.id) ?? false;

  const saveMutation = useMutation({
    mutationFn: () => apiRequest(`/api/events/${event.id}/save`, "POST"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events/saved"] });
      if (onSaveToggle) onSaveToggle(event.id);
    },
    onError: () => {
      if (!user) { navigate("/auth"); return; }
      toast({ title: "Could not save event", variant: "destructive" });
    },
  });

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!user) { navigate("/auth"); return; }
    saveMutation.mutate();
  };

  const isExternalEvent = (event.source && event.source !== "manual") || !!event.externalTicketLink;

  const priceInfo = getEventPriceInfo(event);

  const handleTicketClick = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (isExternalEvent) {
      if (event.externalTicketLink) window.open(event.externalTicketLink, "_blank", "noopener,noreferrer");
      return;
    }
    if (!user && priceInfo.isPaid) { navigate(`/auth?redirect=/events/${event.id}`); return; }
    setShowPurchaseForm(true);
  };

  const eventDate     = new Date(event.date);
  const isPast        = eventDate < new Date();
  const imageUrl      = imgError ? (FALLBACK_IMAGES[event.category] || FALLBACK_IMAGES.default) : getEventImage(event);
  const categoryLabel = EVENT_CATEGORY_LABELS[event.category] || event.category;
  const categoryIcon  = EVENT_CATEGORY_ICONS[event.category] || "🎉";
  const [gradFrom, gradTo] = getGradient(event.category);
  const countdown     = !isPast ? getCountdown(eventDate, { today: t("events.today"), tomorrow: t("events.tomorrow") }) : null;

  const priceLabel = priceInfo.shortLabel;

  /* ── COMPACT variant ─────────────────────────────────────────── */
  if (variant === "compact") {
    return (
      <Link href={`/events/${event.id}`}>
        <div
          data-testid={`card-event-${event.id}`}
          className="group flex gap-3 p-3 rounded-2xl hover:bg-muted/60 transition-all duration-200 cursor-pointer border border-transparent hover:border-border/50"
        >
          <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0">
            <img
              src={imageUrl}
              alt={loc.title}
              loading="lazy"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ background: `linear-gradient(135deg, ${gradFrom}33, ${gradTo}33)` }}
            />
          </div>
          <div className="flex-1 min-w-0 py-0.5">
            <p className="font-bold text-sm line-clamp-1 group-hover:text-primary transition-colors">{loc.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> {format(eventDate, "EEE d MMM", { locale: language === "nl" ? nl : enUS })}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" /> {event.city || event.location}
            </p>
            <span className={cn(
              "inline-block mt-1 text-[10px] font-black px-2 py-0.5 rounded-full",
              !priceInfo.isPaid ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-muted text-muted-foreground"
            )}>
              {priceLabel}
            </span>
          </div>
        </div>
      </Link>
    );
  }

  /* ── DEFAULT / FEATURED variant ──────────────────────────────── */
  return (
    <>
      <div
        data-testid={`card-event-${event.id}`}
        className={cn(
          "group relative rounded-2xl overflow-hidden cursor-pointer flex flex-col",
          "transition-all duration-300 ease-out",
          "hover:-translate-y-1.5 hover:shadow-2xl",
          variant === "featured" ? "h-96" : "h-80",
          isPast && "opacity-60"
        )}
        style={{
          boxShadow: "0 4px 24px 0 rgba(0,0,0,0.10)",
        }}
      >
        {/* ── Full-bleed image ── */}
        <Link href={`/events/${event.id}`} className="absolute inset-0 z-0">
          <img
            src={imageUrl}
            alt={loc.title}
            loading="lazy"
            onError={() => setImgError(true)}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
          {/* Deep gradient scrim */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/5" />
          {/* Category accent stripe at bottom */}
          <div
            className="absolute bottom-0 left-0 right-0 h-0.5"
            style={{ background: `linear-gradient(to right, ${gradFrom}, ${gradTo})` }}
          />
          {/* Hover shine */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            style={{ background: `linear-gradient(135deg, ${gradFrom}1A 0%, transparent 60%)` }}
          />
        </Link>

        {/* ── Top badges row ── */}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between z-10">
          <div className="flex flex-col gap-1.5">
            {countdown && (
              <span className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black backdrop-blur-md",
                countdown.cls,
                countdown.cls.includes("red") && "animate-pulse"
              )}>
                <Clock className="h-3 w-3" /> {countdown.label}
              </span>
            )}
            {event.isFeatured && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-yellow-400/95 text-yellow-950 backdrop-blur-md">
                <Star className="h-3 w-3 fill-yellow-950" /> Featured
              </span>
            )}
            {event.isTrending && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-orange-500/95 text-white backdrop-blur-md">
                <Zap className="h-3 w-3 fill-white" /> Trending
              </span>
            )}
            {event.soldOut && (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-red-600 text-white backdrop-blur-md">
                {t("events.soldOut")}
              </span>
            )}
          </div>

          {/* Save button */}
          <button
            data-testid={`button-save-event-${event.id}`}
            onClick={handleSave}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 backdrop-blur-md border",
              isSaved
                ? "bg-red-500 border-red-400 shadow-lg shadow-red-500/40"
                : "bg-black/40 border-white/20 hover:bg-black/70"
            )}
          >
            <Heart className={cn("h-4 w-4 transition-all duration-200", isSaved ? "fill-white text-white scale-110" : "text-white")} />
          </button>
        </div>

        {/* ── Bottom info panel ── */}
        <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
          {/* Category + Price */}
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <span
              className="text-[10px] font-black px-2.5 py-1 rounded-full text-white backdrop-blur-md border border-white/10"
              style={{ background: `${gradFrom}CC` }}
            >
              {categoryIcon} {categoryLabel}
            </span>
            <span className={cn(
              "px-2.5 py-1 rounded-full text-[10px] font-black backdrop-blur-sm",
              !priceInfo.isPaid
                ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30"
                : "bg-white/90 text-gray-900"
            )}>
              {priceLabel}
            </span>
          </div>

          {/* Source badges */}
          {(event.source === "eventbrite" || event.source === "ticketmaster" || event.source === "meetup") && (
            <div className="mb-1.5">
              <span className="text-[9px] font-bold text-white/50 uppercase tracking-widest">
                {event.source === "ticketmaster" ? "🎫 Ticketmaster" : event.source === "eventbrite" ? "🎟 Eventbrite" : "📍 Meetup"}
              </span>
            </div>
          )}

          {/* Title */}
          <Link href={`/events/${event.id}`}>
            <h3 className="font-extrabold text-white text-base leading-snug line-clamp-2 mb-2.5 hover:opacity-80 transition-opacity">
              {loc.title}
            </h3>
          </Link>

          {/* Date + Location */}
          <div className="flex items-center gap-3 text-white/70 text-[11px] mb-3 flex-wrap">
            <span className="flex items-center gap-1 shrink-0">
              <Calendar className="h-3 w-3" />
              {format(eventDate, "EEE d MMM · HH:mm", { locale: language === "nl" ? nl : enUS })}
            </span>
            <span className="flex items-center gap-1 min-w-0">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{event.city || event.location}</span>
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Link href={`/events/${event.id}`} className="flex-1">
              <button
                data-testid={`button-view-event-${event.id}`}
                className="w-full py-2 rounded-xl text-xs font-black text-white transition-all duration-200 active:scale-95 hover:brightness-110"
                style={{ background: `linear-gradient(135deg, ${gradFrom}, ${gradTo})` }}
              >
                {t("events.viewEvent")}
              </button>
            </Link>

            {isExternalEvent ? (
              event.externalTicketLink ? (
                <button
                  data-testid={`button-ticket-event-${event.id}`}
                  onClick={handleTicketClick}
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 transition-all duration-200"
                  title="Buy tickets"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-white" />
                </button>
              ) : null
            ) : (
              <button
                data-testid={`button-ticket-event-${event.id}`}
                onClick={handleTicketClick}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 transition-all duration-200"
                title={event.isPaid ? t("events.buyTickets") : t("events.rsvp")}
              >
                <Ticket className="h-3.5 w-3.5 text-white" />
              </button>
            )}

            {event.latitude && event.longitude && (
              <Link href={`/map?lat=${event.latitude}&lng=${event.longitude}`}>
                <button
                  data-testid={`button-map-event-${event.id}`}
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 transition-all duration-200"
                  title="Bekijk op kaart"
                >
                  <Navigation className="h-3.5 w-3.5 text-white" />
                </button>
              </Link>
            )}

            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 transition-all duration-200">
                    <MoreVertical className="h-3.5 w-3.5 text-white" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                    <Edit className="mr-2 h-4 w-4" /> {t("edit")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" /> {t("delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {/* Modals — only for internal (user-created) events */}
      {!isExternalEvent && (
        priceInfo.isPaid ? (
          <StripeWrapper>
            <TicketPurchaseForm open={showPurchaseForm} onClose={() => setShowPurchaseForm(false)} event={event} />
          </StripeWrapper>
        ) : (
          <RSVPForm open={showPurchaseForm} onClose={() => setShowPurchaseForm(false)} event={event} />
        )
      )}
      {showEditDialog   && <EventEditDialog   event={event} open={showEditDialog}   onClose={() => setShowEditDialog(false)} />}
      {showDeleteDialog && <EventDeleteDialog event={event} open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)} />}
    </>
  );
};

export default memo(EventCard);
