
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import TicketPurchaseForm from "@/components/events/TicketPurchaseForm";
import RSVPForm from "@/components/events/RSVPForm";
import StripeWrapper from "@/components/events/StripeWrapper";
import { ShareWidget } from "@/components/sharing/ShareWidget";
import { useShareMetadata } from "@/hooks/use-share-metadata";
import { useAuth } from "@/contexts/AuthContext";
import { canManageEvent } from "@/lib/permissions";
import { EventEditDialog } from "@/components/events/EventEditDialog";
import { EventDeleteDialog } from "@/components/events/EventDeleteDialog";
import { EventCategoryManager } from "@/components/events/EventCategoryManager";
import { DancerRegistration } from "@/components/events/DancerRegistration";
import { BracketVisualization } from "@/components/events/BracketVisualization";
import { BattleAdminPanel } from "@/components/events/BattleAdminPanel";
import { EventPollSection, useEventPollCount } from "@/components/events/EventPollSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { nl, enUS } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Heart, Share2, MapPin, Calendar, Users, Star, Zap,
  ExternalLink, Navigation, CalendarPlus, Clock, Tag, Edit, Trash2,
  Check, Trophy, Baby, Ticket, Globe, Info, ChevronRight, CheckCircle2, Vote
} from "lucide-react";
import { EVENT_CATEGORY_LABELS, EVENT_CATEGORY_ICONS } from "@/types";
import EventCard from "@/components/events/EventCard";
import { useLanguage } from "@/contexts/LanguageContext";
import { localizeEvent } from "@/lib/localize";
import { getEventPriceInfo } from "@/lib/eventPrice";

interface EventCategory {
  id: number;
  name: string;
  description: string | null;
}

const FALLBACK_IMG = "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=1200&q=80";

export function EventDetails() {
  const [, params] = useRoute<{ id: string }>("/events/:id");
  const eventId = params?.id;
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [imgError, setImgError] = useState(false);
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { language, t } = useLanguage();
  const pollCounts = useEventPollCount(eventId ? parseInt(eventId) : 0);

  const { data: event, isLoading } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const { data } = await axios.get(`/api/events/${eventId}`);
      return data;
    },
    enabled: !!eventId,
  });

  const { data: userRsvp } = useQuery({
    queryKey: ["userRsvp", eventId, user?.id],
    queryFn: async () => {
      if (!user?.id || !eventId) return null;
      try {
        const { data } = await axios.get(`/api/events/${eventId}/rsvps`);
        return data.find((rsvp: any) => rsvp.userId === user.id) || null;
      } catch { return null; }
    },
    enabled: !!user?.id && !!eventId,
  });

  const { data: categories = [] } = useQuery<EventCategory[]>({
    queryKey: [`/api/events/${eventId}/categories`],
    enabled: !!eventId,
  });

  const { data: relatedEvents = [] } = useQuery<any[]>({
    queryKey: ["/api/events"],
    select: (events: any[]) => events
      .filter(e => e.id !== parseInt(eventId!) && e.category === event?.category)
      .slice(0, 4),
    enabled: !!event,
  });

  useEffect(() => {
    if (categories.length > 0) {
      const categoryExists = categories.some(cat => cat.id === selectedCategoryId);
      if (!categoryExists) setSelectedCategoryId(categories[0].id);
    } else if (selectedCategoryId) {
      setSelectedCategoryId(null);
    }
  }, [categories, selectedCategoryId]);

  const saveMutation = useMutation({
    mutationFn: () => apiRequest(`/api/events/${eventId}/save`, "POST"),
    onSuccess: () => {
      setIsSaved(s => !s);
      queryClient.invalidateQueries({ queryKey: ["/api/events/saved"] });
    },
    onError: () => {
      if (!user) { navigate("/auth"); return; }
      toast({ title: "Kon niet opslaan", variant: "destructive" });
    },
  });

  const shareMetadata = useShareMetadata(event, "event", {
    includeInsights: true,
    additionalHashtags: event?.category ? [event.category] : [],
  });

  const canManage = canManageEvent(user, event?.organizerId);
  const isExternalEvent = (event?.source && event.source !== "manual") || !!event?.externalTicketLink;
  const priceInfo = event ? getEventPriceInfo(event) : null;

  const handleDirections = () => {
    if (event?.latitude && event?.longitude) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`, "_blank");
    } else if (event?.location) {
      window.open(`https://www.google.com/maps/search/${encodeURIComponent(event.location)}`, "_blank");
    }
  };

  const loc = event ? localizeEvent(event, language) : null;

  const handleCalendar = () => {
    if (!event || !loc) return;
    const start = new Date(event.date).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(loc.title)}&dates=${start}/${start}&details=${encodeURIComponent(loc.description || "")}&location=${encodeURIComponent(event.location || "")}`;
    window.open(url, "_blank");
  };

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="min-h-screen">
        <div className="h-72 bg-muted animate-pulse" />
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          <div className="h-8 bg-muted rounded-xl w-2/3 animate-pulse" />
          <div className="h-4 bg-muted rounded w-1/3 animate-pulse" />
          <div className="h-24 bg-muted rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <div className="text-5xl mb-4">🎭</div>
        <h2 className="text-xl font-bold mb-2">Evenement niet gevonden</h2>
        <p className="text-muted-foreground text-center mb-6">Dit evenement bestaat niet of is verwijderd.</p>
        <Button onClick={() => navigate("/events")}>Terug naar evenementen</Button>
      </div>
    );
  }

  const eventDate = new Date(event.date);
  const isPast = eventDate < new Date();
  const imageUrl = imgError ? FALLBACK_IMG : (event.image || FALLBACK_IMG);
  const categoryLabel = EVENT_CATEGORY_LABELS[event.category] || event.category;
  const categoryIcon = EVENT_CATEGORY_ICONS[event.category] || "🎉";

  return (
    <div className="min-h-screen pb-24">

      {/* ── Hero Image ── */}
      <div className="relative h-64 sm:h-80 md:h-96 overflow-hidden">
        <img
          src={imageUrl}
          alt={event.title}
          onError={() => setImgError(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />

        {/* Back button */}
        <button
          data-testid="button-back"
          onClick={() => navigate("/events")}
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        {/* Top badges */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
          {event.isFeatured && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-yellow-400 text-yellow-900">
              <Star className="h-3.5 w-3.5 fill-yellow-900" /> Featured
            </span>
          )}
          {event.isTrending && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-orange-500 text-white">
              <Zap className="h-3.5 w-3.5 fill-white" /> Trending
            </span>
          )}
        </div>

        {/* Floating title overlay at bottom of hero */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-sm text-white border border-white/30 mb-2">
            {categoryIcon} {categoryLabel}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight drop-shadow-lg">{loc?.title ?? event.title}</h1>
          {event.isVerifiedOrganizer && (
            <div className="flex items-center gap-1.5 mt-1">
              <CheckCircle2 className="h-4 w-4 text-blue-300" />
              <span className="text-white/80 text-xs font-medium">{language === "en" ? "Verified organiser" : "Geverifieerde organisator"}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Glassmorphism Action Bar ── */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button
              data-testid="button-save-event"
              variant="outline"
              size="sm"
              className={cn("gap-1.5 text-xs", isSaved && "text-red-500 border-red-300")}
              onClick={() => { if (!user) { navigate("/auth"); return; } saveMutation.mutate(); }}
            >
              <Heart className={cn("h-3.5 w-3.5", isSaved && "fill-red-500")} />
              {isSaved ? "Opgeslagen" : "Opslaan"}
            </Button>
            <Button
              data-testid="button-directions"
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={handleDirections}
            >
              <Navigation className="h-3.5 w-3.5" /> Route
            </Button>
            <Button
              data-testid="button-calendar"
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs hidden sm:flex"
              onClick={handleCalendar}
            >
              <CalendarPlus className="h-3.5 w-3.5" /> Agenda
            </Button>
            <ShareWidget metadata={shareMetadata} size="sm" variant="outline" />
          </div>

          {canManage && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)} data-testid="button-edit-event">
                <Edit className="h-3.5 w-3.5" />
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)} data-testid="button-delete-event">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* ── Tags row ── */}
        {(event.tags?.length > 0 || event.vibeLabels?.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {[...(event.tags || []), ...(event.vibeLabels || [])].map((tag: string) => (
              <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
            ))}
          </div>
        )}

        {/* ── Info Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InfoCard icon={<Calendar className="h-5 w-5 text-primary" />} label={t("events.dateAndTime")} value={format(eventDate, language === "nl" ? "EEEE d MMMM yyyy 'om' HH:mm" : "EEEE d MMMM yyyy 'at' HH:mm", { locale: language === "nl" ? nl : enUS })} />
          <InfoCard icon={<MapPin className="h-5 w-5 text-primary" />} label={t("events.location")} value={[event.city, event.location].filter(Boolean).join(" · ")} />
          {event.capacity && (
            <InfoCard icon={<Users className="h-5 w-5 text-primary" />} label="Capaciteit" value={`${event.capacity} plaatsen`} />
          )}
          {event.crowdLevel && (
            <InfoCard icon={<Info className="h-5 w-5 text-primary" />} label="Drukte" value={event.crowdLevel === "low" ? "Rustig" : event.crowdLevel === "medium" ? "Normaal" : "Druk"} />
          )}
          {event.isIndoor !== null && event.isIndoor !== undefined && (
            <InfoCard icon={<Globe className="h-5 w-5 text-primary" />} label="Type" value={event.isIndoor ? "Binnen" : "Buiten"} />
          )}
        </div>

        {/* ── Kids / Family ── */}
        {(event.kidFriendly || event.familyFriendly) && (
          <div className="rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Baby className="h-5 w-5 text-green-600" />
              <span className="font-semibold text-sm text-green-800 dark:text-green-400">Geschikt voor gezinnen</span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-green-700 dark:text-green-400">
              {event.kidFriendly && <span className="flex items-center gap-1"><Check className="h-3 w-3" /> Kindvriendelijk</span>}
              {event.familyFriendly && <span className="flex items-center gap-1"><Check className="h-3 w-3" /> Gezinsvriendelijk</span>}
              {event.minAge && <span>Minimumleeftijd: {event.minAge} jaar</span>}
              {event.maxAge && <span>Maximumleeftijd: {event.maxAge} jaar</span>}
            </div>
          </div>
        )}

        {/* ── Pricing ── */}
        <div className={cn(
          "rounded-xl p-5 border",
          !priceInfo?.isPaid
            ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/30"
            : "bg-secondary/40 border-border"
        )}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-bold text-base mb-1">{t("events.ticketsSection")}</h3>
              {!priceInfo?.isPaid ? (
                <p className="text-2xl font-extrabold text-green-600">{t("events.free")}</p>
              ) : (event.priceModel === "from" || (event.adultPrice && (event.kidsPrice || event.familyPrice))) ? (
                <div className="space-y-1">
                  <p className="text-2xl font-extrabold">
                    Vanaf €{(Math.min(...[event.adultPrice, event.kidsPrice, event.familyPrice].filter((v): v is number => !!v)) / 100).toFixed(2)}
                  </p>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {event.adultPrice ? <div>Volwassene: €{(event.adultPrice / 100).toFixed(2)}</div> : null}
                    {event.kidsPrice  ? <div>Kind: €{(event.kidsPrice / 100).toFixed(2)}</div> : null}
                    {event.familyPrice ? <div>Familie (4p): €{(event.familyPrice / 100).toFixed(2)}</div> : null}
                  </div>
                </div>
              ) : (event.price ?? 0) > 0 ? (
                <p className="text-2xl font-extrabold">€{(event.price! / 100).toFixed(2)}</p>
              ) : (
                <p className="text-2xl font-extrabold">{priceInfo?.label ?? "—"}</p>
              )}

              {event.soldOut && (
                <Badge variant="destructive" className="mt-2">{t("events.soldOut")}</Badge>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {isExternalEvent ? (
                event.externalTicketLink ? (
                  <a
                    href={event.externalTicketLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="button-get-tickets"
                  >
                    <Button size="sm" className="font-bold gap-1.5">
                      <ExternalLink className="h-4 w-4" />
                      {priceInfo?.isPaid ? t("events.buyTickets") : t("events.moreInfo")}
                    </Button>
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Geen ticketlink beschikbaar</p>
                )
              ) : userRsvp ? (
                <>
                  <Badge variant="outline" className={cn("flex items-center gap-1 text-xs shrink-0", userRsvp.status === "going" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400")}>
                    <Check className="h-3 w-3" /> {userRsvp.status === "going" ? "Aangemeld" : "Niet aanwezig"}
                  </Badge>
                  <Button size="sm" variant="outline" onClick={() => setTicketDialogOpen(true)} data-testid="button-update-rsvp">Bijwerken</Button>
                </>
              ) : (
                <Button
                  data-testid="button-get-tickets"
                  size="sm"
                  disabled={!!event.soldOut || isPast}
                  onClick={() => {
                    if (!user && priceInfo?.isPaid) { navigate(`/auth?redirect=/events/${eventId}`); return; }
                    setTicketDialogOpen(true);
                  }}
                  className="font-bold"
                >
                  <Ticket className="h-4 w-4 mr-1.5" />
                  {event.soldOut ? t("events.soldOut") : isPast ? t("events.pastEvent") : (priceInfo?.ctaLabel ?? t("events.rsvp"))}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ── RSVP/Ticket forms — only for internal (user-created) events ── */}
        {!isExternalEvent && (
          priceInfo?.isPaid ? (
            <StripeWrapper>
              {user && <TicketPurchaseForm event={event} open={ticketDialogOpen} onClose={() => setTicketDialogOpen(false)} />}
            </StripeWrapper>
          ) : (
            <RSVPForm event={event} open={ticketDialogOpen} onClose={() => setTicketDialogOpen(false)} existingRsvp={userRsvp} />
          )
        )}

        {/* ── About ── */}
        <div>
          <h2 className="font-bold text-lg mb-3">{language === "en" ? "About this event" : "Over dit evenement"}</h2>
          <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{loc?.description ?? event.description}</p>
        </div>

        {/* ── Gallery ── */}
        {event.gallery?.length > 0 && (
          <div>
            <h2 className="font-bold text-lg mb-3">Galerij</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {event.gallery.map((img: string, i: number) => (
                <div key={i} className="aspect-square rounded-xl overflow-hidden">
                  <img src={img} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Battle / Dance Tabs — only shown for competition events ── */}
        {event.isCompetition && (
        <div className="border-t pt-6">
          <Tabs defaultValue="registration" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-auto">
              <TabsTrigger value="registration" data-testid="tab-registration" className="text-xs sm:text-sm py-2">Battle</TabsTrigger>
              <TabsTrigger value="brackets" data-testid="tab-brackets" className="text-xs sm:text-sm py-2">Brackets</TabsTrigger>
            </TabsList>

            <TabsContent value="registration" className="mt-6 space-y-6">
              {canManage && <EventCategoryManager eventId={parseInt(eventId!)} isOrganizer={canManage} />}
              <DancerRegistration
                eventId={parseInt(eventId!)}
                userId={user?.id || null}
                isAuthenticated={!!user}
                onCategorySelect={setSelectedCategoryId}
                selectedCategoryId={selectedCategoryId}
              />
              {canManage && selectedCategoryId && (
                <div className="mt-6 space-y-4">
                  <BattleAdminPanel eventId={parseInt(eventId!)} categoryId={selectedCategoryId} />
                  <BracketVisualization eventId={parseInt(eventId!)} categoryId={selectedCategoryId} isOrganizer={canManage} />
                </div>
              )}
            </TabsContent>

            <TabsContent value="brackets" className="mt-6 space-y-6">
              {categories.length > 0 ? (
                <>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-primary" />
                      <span className="font-medium text-sm">Categorie:</span>
                    </div>
                    <Select value={selectedCategoryId?.toString() || ""} onValueChange={val => setSelectedCategoryId(parseInt(val))}>
                      <SelectTrigger className="w-[200px]" data-testid="select-bracket-category">
                        <SelectValue placeholder="Selecteer categorie" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedCategoryId && (
                    <>
                      {canManage && <BattleAdminPanel eventId={parseInt(eventId!)} categoryId={selectedCategoryId} />}
                      <BracketVisualization eventId={parseInt(eventId!)} categoryId={selectedCategoryId} isOrganizer={canManage} />
                    </>
                  )}
                </>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">Geen battle-categorieën beschikbaar</CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
        )}

        {/* ── Polls / Voting ── */}
        <div className="border-t pt-6 space-y-4">
          {/* Active polls notification banner */}
          {pollCounts.active > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 border border-primary/30">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-ping flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-primary">
                  {pollCounts.active === 1 ? "1 live poll is open" : `${pollCounts.active} live polls are open`}
                </p>
                <p className="text-xs text-primary/70">Cast your vote below!</p>
              </div>
              <Zap className="h-4 w-4 text-primary flex-shrink-0" />
            </div>
          )}

          <div className="flex items-center gap-2">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Vote className="h-5 w-5 text-primary" />
              Polls & Voting
            </h2>
            {pollCounts.total > 0 && (
              <Badge variant="secondary" className="text-xs font-bold">
                {pollCounts.total}
              </Badge>
            )}
            {pollCounts.active > 0 && (
              <Badge className="text-xs font-bold bg-green-500 text-white border-0">
                {pollCounts.active} live
              </Badge>
            )}
          </div>

          <EventPollSection eventId={parseInt(eventId!)} />
        </div>

        {/* ── Related Events ── */}
        {relatedEvents.length > 0 && (
          <div>
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <ChevronRight className="h-5 w-5 text-primary" /> Gerelateerde evenementen
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {relatedEvents.map(e => (
                <EventCard key={e.id} event={e} variant="compact" />
              ))}
            </div>
          </div>
        )}

        {/* ── Organiser footer ── */}
        <div className="pt-4 border-t flex items-center justify-between text-sm text-muted-foreground">
          <span>Georganiseerd door {event.organizerId ? `Gebruiker #${event.organizerId}` : "Urban Culture Community"}</span>
          <ShareWidget metadata={shareMetadata} size="md" variant="ghost" />
        </div>
      </div>

      {/* ── Dialogs ── */}
      {showEditDialog && <EventEditDialog event={event} open={showEditDialog} onClose={() => setShowEditDialog(false)} />}
      {showDeleteDialog && <EventDeleteDialog event={event} open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)} />}
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-border/50">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground leading-snug mt-0.5 truncate">{value}</p>
      </div>
    </div>
  );
}
