import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useParams, useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MapPin, Calendar, Share, ExternalLink, Bookmark, BookmarkCheck,
  ArrowLeft, Eye, EyeOff, Clock, User, Stars, PaintBucket, Music,
  Users, Mic, Dumbbell, Plus, Trash2, Loader2, Settings, CalendarPlus,
  CheckCircle, ChevronRight, X, Accessibility, Layers, ShieldCheck, ShieldX,
  Sparkles, Instagram, Home, Sun, Cloud, Waves
} from "lucide-react";
import { formatDistance, format, isFuture } from "date-fns";
import { LocationType } from "@shared/schema";
import { useAuth } from "@/contexts/AuthContext";
import { SpotInsights } from "@/components/ai/SpotInsights";

interface SpotLocation {
  id: number;
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
  openingHours?: string | null;
  website?: string | null;
  createdAt?: string | Date;
  addedBy?: string | null;
  skillLevel?: string | null;
  isFree?: boolean;
  accessibility?: string | null;
  surfaceType?: string | null;
  contactInfo?: string | null;
  // Extended rich fields
  indoorOutdoor?: string | null;
  lighting?: string | null;
  amenities?: string[] | null;
  crowdLevel?: string | null;
  floorMaterial?: string | null;
  capacity?: number | null;
  instagram?: string | null;
  rules?: string | null;
  bestFor?: string[] | null;
  tags?: string[] | null;
}

const SESSION_CATEGORIES = [
  { value: 'fitness_class', label: '🏋️ Fitness Class' },
  { value: 'yoga', label: '🧘 Yoga' },
  { value: 'pilates', label: '🤸 Pilates' },
  { value: 'boxing', label: '🥊 Boxing' },
  { value: 'martial_arts', label: '🥋 Martial Arts' },
  { value: 'crossfit', label: '💪 CrossFit' },
  { value: 'spinning', label: '🚴 Spinning' },
  { value: 'dance_class', label: '💃 Dance Class' },
  { value: 'dance_battle', label: '🕺 Dance Battle' },
  { value: 'open_floor', label: '🪩 Open Floor' },
  { value: 'open_training', label: '🏃 Open Training' },
  { value: 'personal_training', label: '👤 Personal Training' },
  { value: 'group_session', label: '👥 Group Session' },
  { value: 'sports_training', label: '⚽ Sports Training' },
  { value: 'workshop', label: '🔨 Workshop' },
  { value: 'dj_night', label: '🎛️ DJ Night' },
  { value: 'live_music', label: '🎵 Live Music' },
  { value: 'exhibition', label: '🖼️ Exhibition' },
  { value: 'open_mic', label: '🎤 Open Mic' },
  { value: 'event', label: '📅 Event' },
  { value: 'other', label: '📋 Other' },
];

const SESSION_EMOJIS: Record<string, string> = {
  fitness_class: '🏋️', yoga: '🧘', pilates: '🤸', boxing: '🥊',
  martial_arts: '🥋', crossfit: '💪', spinning: '🚴', dance_class: '💃',
  dance_battle: '🕺', open_floor: '🪩', open_training: '🏃', personal_training: '👤',
  group_session: '👥', sports_training: '⚽', workshop: '🔨', dj_night: '🎛️',
  live_music: '🎵', exhibition: '🖼️', open_mic: '🎤', event: '📅', other: '📋',
};

const getSpotIcon = (type: string) => {
  const t = type?.toLowerCase() || "";
  if (t.includes('graffiti') || t.includes('mural')) return <PaintBucket className="h-4 w-4" />;
  if (t.includes('dance') || t.includes('training')) return <Users className="h-4 w-4" />;
  if (t.includes('music') || t.includes('studio')) return <Music className="h-4 w-4" />;
  if (t.includes('rap') || t.includes('mic')) return <Mic className="h-4 w-4" />;
  if (t.includes('workout') || t.includes('gym')) return <Dumbbell className="h-4 w-4" />;
  return <Stars className="h-4 w-4" />;
};

const formatLocationType = (type: string): string => {
  switch (type) {
    case LocationType.GRAFFITI: return "Graffiti Spot";
    case LocationType.DANCE: return "Dance Spot";
    case LocationType.MUSIC: return "Music Spot";
    case LocationType.RAP: return "Rap/MC Spot";
    case LocationType.TRAINING: return "Training Spot";
    case LocationType.PERFORMANCE: return "Performance Spot";
    case LocationType.SKATE: return "Skating Spot";
    case LocationType.WORKSHOP: return "Workshop Space";
    case LocationType.CULTURAL_HUB: return "Cultural Hub";
    case LocationType.OPEN_MIC: return "Open Mic Venue";
    default: return type?.charAt(0).toUpperCase() + type?.slice(1).replace(/_/g, ' ') || "Spot";
  }
};

// ─── Inline Schedule Section (renders at the bottom of the spot page) ─────────
function SpotScheduleSection({
  spotId,
  spotName,
  isOwner,
  sessions,
  sessionsLoading,
  reservingId,
  onReserve,
  user,
}: {
  spotId: number;
  spotName: string;
  isOwner: boolean;
  sessions: any[];
  sessionsLoading: boolean;
  reservingId: number | null;
  onReserve: (id: number) => void;
  user: any;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const sessionsForDate = sessions
    .filter(s => format(new Date(s.startTime), 'yyyy-MM-dd') === dateStr)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const isToday = dateStr === format(today, 'yyyy-MM-dd');

  const [form, setForm] = useState({
    title: '', category: 'other', description: '',
    startTime: '10:00', endTime: '11:00',
    capacity: '', ticketPrice: '',
  });

  useEffect(() => {
    // Reset form date when date changes
  }, [selectedDate]);

  const deleteSession = async (sessionId: number) => {
    setDeletingId(sessionId);
    try {
      await apiRequest(`/api/spots/sessions/${sessionId}`, 'DELETE');
      queryClient.invalidateQueries({ queryKey: [`/api/spots/${spotId}/sessions`] });
      toast({ title: "Session removed" });
    } catch {
      toast({ title: "Failed to remove session", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const startTime = `${dateStr}T${form.startTime}:00`;
      const endTime = `${dateStr}T${form.endTime}:00`;
      const res = await apiRequest(`/api/spots/${spotId}/sessions`, 'POST', {
        title: form.title,
        category: form.category,
        description: form.description || null,
        startTime,
        endTime,
        capacity: form.capacity ? parseInt(form.capacity) : null,
        ticketPrice: form.ticketPrice || null,
        isPublic: true,
        isRecurring: false,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spots/${spotId}/sessions`] });
      queryClient.invalidateQueries({ queryKey: ['/api/owner/spot-analytics'] });
      setShowForm(false);
      setForm(f => ({ ...f, title: '', description: '', capacity: '', ticketPrice: '' }));
      toast({ title: "Session added!", description: "People can now reserve this session." });
    },
    onError: (err: any) => {
      toast({ title: "Failed to add session", description: err?.message || "Please try again.", variant: "destructive" });
    },
  });

  return (
    <Card className="mt-4">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            {isOwner ? 'Manage Schedule' : 'Schedule'}
          </h2>
          {isOwner && !showForm && (
            <Button
              size="sm"
              onClick={() => setShowForm(true)}
              className="gap-1.5 h-8 text-xs"
              data-testid="button-add-session-toggle"
            >
              <Plus className="h-3.5 w-3.5" /> Add Session
            </Button>
          )}
        </div>

        {/* 14-day date strip */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1">
          {days.map(d => {
            const ds = format(d, 'yyyy-MM-dd');
            const isSel = ds === dateStr;
            const isTod = ds === format(today, 'yyyy-MM-dd');
            const hasEvents = sessions.some(s => format(new Date(s.startTime), 'yyyy-MM-dd') === ds);
            return (
              <button
                key={d.toISOString()}
                type="button"
                onClick={() => { setSelectedDate(d); setShowForm(false); }}
                className={`flex flex-col items-center justify-center min-w-[52px] h-16 rounded-2xl border transition-all flex-shrink-0 relative ${
                  isSel
                    ? 'bg-primary text-primary-foreground border-primary shadow-md'
                    : isTod
                    ? 'border-primary/60 text-primary bg-primary/5'
                    : 'bg-card text-muted-foreground hover:bg-muted/60 border-border'
                }`}
              >
                <span className={`text-[10px] font-medium ${isSel ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                  {format(d, 'EEE')}
                </span>
                <span className="text-base font-bold leading-tight">{format(d, 'd')}</span>
                <span className={`text-[9px] ${isSel ? 'text-primary-foreground/60' : 'text-muted-foreground/60'}`}>
                  {format(d, 'MMM')}
                </span>
                {hasEvents && !isSel && (
                  <span className="absolute bottom-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>

        {/* Day label */}
        <div className="mt-4 mb-3 flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">{isToday ? 'Today' : format(selectedDate, 'EEEE, dd MMMM')}</p>
            {sessionsForDate.length > 0 && (
              <p className="text-xs text-muted-foreground">{sessionsForDate.length} session{sessionsForDate.length !== 1 ? 's' : ''}</p>
            )}
          </div>
        </div>

        {/* Add session form */}
        {isOwner && showForm && (
          <div className="mb-4 p-4 rounded-xl border border-primary/30 bg-primary/5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Add session — {format(selectedDate, 'dd MMMM')}</p>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Title *</Label>
                <Input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g., Morning Dance Class"
                  className="mt-1 h-9"
                  data-testid="input-session-title"
                />
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SESSION_CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Start time *</Label>
                  <Input
                    type="time"
                    value={form.startTime}
                    onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                    className="mt-1 h-9"
                    data-testid="input-session-start"
                  />
                </div>
                <div>
                  <Label className="text-xs">End time *</Label>
                  <Input
                    type="time"
                    value={form.endTime}
                    onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                    className="mt-1 h-9"
                    data-testid="input-session-end"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Capacity (optional)</Label>
                  <Input
                    type="number"
                    value={form.capacity}
                    onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))}
                    placeholder="Unlimited"
                    className="mt-1 h-9"
                    data-testid="input-session-capacity"
                  />
                </div>
                <div>
                  <Label className="text-xs">Price € (optional)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.ticketPrice}
                    onChange={e => setForm(f => ({ ...f, ticketPrice: e.target.value }))}
                    placeholder="Free"
                    className="mt-1 h-9"
                    data-testid="input-session-price"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Description (optional)</Label>
                <Input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Short description…"
                  className="mt-1 h-9"
                  data-testid="input-session-description"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => {
                    if (!form.title.trim()) {
                      toast({ title: "Please enter a title", variant: "destructive" });
                      return;
                    }
                    createMutation.mutate();
                  }}
                  disabled={createMutation.isPending}
                  data-testid="button-save-session"
                >
                  {createMutation.isPending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <CheckCircle className="h-3.5 w-3.5" />
                  }
                  Save Session
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        )}

        {/* Sessions for selected date */}
        {sessionsLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading sessions…
          </div>
        ) : sessionsForDate.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
            <Calendar className="h-10 w-10 text-muted-foreground opacity-20" />
            <p className="text-sm text-muted-foreground">
              {isToday ? 'No sessions today' : `No sessions on ${format(selectedDate, 'EEEE')}`}
            </p>
            {isOwner && !showForm && (
              <Button size="sm" variant="outline" className="mt-1 gap-1.5 text-xs" onClick={() => setShowForm(true)}>
                <Plus className="h-3.5 w-3.5" /> Add a session
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {sessionsForDate.map(session => (
              <div
                key={session.id}
                className="flex items-start gap-3 p-3 rounded-xl border bg-card hover:bg-muted/20 transition-colors"
                data-testid={`schedule-item-${session.id}`}
              >
                {/* Date chip */}
                <div className="flex flex-col items-center justify-center min-w-[48px] h-14 bg-primary/10 rounded-xl p-1.5 flex-shrink-0">
                  <span className="text-xl leading-none">{SESSION_EMOJIS[session.category] || '📋'}</span>
                  <span className="text-[10px] font-bold text-primary mt-0.5">{format(new Date(session.startTime), 'HH:mm')}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{session.title}</p>
                  {session.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{session.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(session.startTime), 'HH:mm')} – {format(new Date(session.endTime), 'HH:mm')}
                    </span>
                    {session.capacity && (
                      <span className="text-xs text-muted-foreground">
                        {session.registrationCount || 0}/{session.capacity} spots
                      </span>
                    )}
                    {session.ticketPrice && parseFloat(session.ticketPrice) > 0 ? (
                      <Badge variant="secondary" className="text-xs">€{session.ticketPrice}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-300">Free</Badge>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  {/* Reserve button for regular users */}
                  {!isOwner && (
                    session.isFull ? (
                      <Badge variant="secondary" className="text-xs">Full</Badge>
                    ) : user ? (
                      <Button
                        size="sm"
                        className="h-8 text-xs px-3"
                        onClick={() => onReserve(session.id)}
                        disabled={reservingId === session.id}
                        data-testid={`button-reserve-session-${session.id}`}
                      >
                        {reservingId === session.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Reserve'}
                      </Button>
                    ) : (
                      <Link to="/auth">
                        <Button size="sm" variant="outline" className="h-8 text-xs px-3">Log in</Button>
                      </Link>
                    )
                  )}

                  {/* Delete button for owners */}
                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteSession(session.id)}
                      disabled={deletingId === session.id}
                      data-testid={`button-delete-session-${session.id}`}
                    >
                      {deletingId === session.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Trash2 className="h-3 w-3" />
                      }
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Show total upcoming across all dates */}
        {sessions.filter(s => isFuture(new Date(s.startTime))).length > 0 && (
          <p className="text-xs text-muted-foreground text-center mt-4 pt-3 border-t">
            {sessions.filter(s => isFuture(new Date(s.startTime))).length} upcoming session{sessions.filter(s => isFuture(new Date(s.startTime))).length !== 1 ? 's' : ''} total
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main LocationDetails ─────────────────────────────────────────────────────
export const LocationDetails = () => {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { user, getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSaved, setIsSaved] = useState(false);
  const [reservingId, setReservingId] = useState<number | null>(null);

  const { data: location, isLoading, error } = useQuery<SpotLocation>({
    queryKey: [`/api/locations/${id}`],
  });

  const { data: spotSessions = [], isLoading: sessionsLoading } = useQuery<any[]>({
    queryKey: [`/api/spots/${id}/sessions`],
    enabled: !!id,
  });

  const reserveMutation = useMutation({
    mutationFn: async (sessionId: number) => {
      setReservingId(sessionId);
      const response = await apiRequest(`/api/programme/events/${sessionId}/register`, "POST", { occurrenceDate: null });
      return response.json();
    },
    onSuccess: () => {
      setReservingId(null);
      queryClient.invalidateQueries({ queryKey: [`/api/spots/${id}/sessions`] });
      queryClient.invalidateQueries({ queryKey: ['/api/programme/my-reservations'] });
      toast({ title: "Reserved!", description: "Your spot is confirmed. Check your profile schedule." });
    },
    onError: (err: any) => {
      setReservingId(null);
      toast({ title: "Could not reserve", description: err?.message || "Please try again.", variant: "destructive" });
    },
  });

  const { data: savedLocations } = useQuery({
    queryKey: ['/api/users/saved-locations'],
    enabled: !!user,
    queryFn: async ({ queryKey }) => {
      const token = await getToken();
      if (!token) return [];
      const response = await fetch(queryKey[0], { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Failed to fetch saved locations');
      return response.json();
    }
  });

  useEffect(() => {
    if (savedLocations && Array.isArray(savedLocations)) {
      setIsSaved(savedLocations.some((saved: any) => saved.locationId === Number(id)));
    }
  }, [savedLocations, id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !location) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" className="mb-4" onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
        </Button>
        <Card className="mx-auto max-w-3xl">
          <CardContent className="pt-6 text-center py-10">
            <h2 className="text-xl font-bold mb-2">Location Not Found</h2>
            <p className="text-muted-foreground mb-6">This spot couldn't be found or may have been removed.</p>
            <div className="flex justify-center gap-4">
              <Button onClick={() => navigate("/community")}>Return to Community</Button>
              <Button variant="outline" onClick={() => navigate("/map")}>Explore Map</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const imageUrl = location.images && location.images.length > 0
    ? location.images[0]
    : "https://images.unsplash.com/photo-1561059510-ee6d2a434031?auto=format&fit=crop&q=80&w=1200";

  const isAdmin = !!(user && ['admin', 'super_admin'].includes((user as any).role));
  const isOwner = !!(user && (user.id === location.createdBy || isAdmin));

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(`/api/locations/${id}/approve`, "POST", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/locations/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      toast({ title: "Spot approved!", description: "Now visible on the map." });
    },
    onError: () => toast({ title: "Failed to approve", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async (reason?: string) => {
      const res = await apiRequest(`/api/locations/${id}/reject`, "POST", { reason: reason || "Does not meet guidelines" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/locations/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      toast({ title: "Spot rejected" });
    },
    onError: () => toast({ title: "Failed to reject", variant: "destructive" }),
  });

  const visibilityMutation = useMutation({
    mutationFn: async (visible: boolean) => {
      const res = await apiRequest(`/api/locations/${id}/visibility`, "POST", { isVisible: visible });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/locations/${id}`] });
      toast({ title: data.isVisible ? "Spot visible" : "Spot hidden" });
    },
    onError: () => toast({ title: "Failed to toggle visibility", variant: "destructive" }),
  });

  const spotlightMutation = useMutation({
    mutationFn: async (active: boolean) => {
      const res = await apiRequest(`/api/admin/locations/${id}/spotlight`, "POST", { active });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/locations/${id}`] });
      toast({ title: "Spotlight updated" });
    },
    onError: () => toast({ title: "Failed to update spotlight", variant: "destructive" }),
  });

  const handleSave = async () => {
    if (!user) { navigate("/auth?returnTo=/locations/" + id); return; }
    if (isSaved) {
      toast({ title: "Already saved", description: "This spot is in your saved list." });
      return;
    }
    try {
      const token = await getToken();
      if (!token) throw new Error("Auth failed");
      const res = await fetch('/api/saved-locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: user.id, locationId: Number(id) }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setIsSaved(true);
      queryClient.invalidateQueries({ queryKey: ['/api/users/saved-locations'] });
      toast({ title: "Saved!", description: "Added to your saved spots." });
    } catch {
      toast({ title: "Error saving", variant: "destructive" });
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => navigate("/community")}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      {/* Hero image */}
      <div className="relative w-full h-56 md:h-80 rounded-2xl overflow-hidden mb-4">
        <img src={imageUrl} alt={location.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4">
          <Badge className="mb-2 bg-black/50 text-white border-0 backdrop-blur-sm flex items-center gap-1.5 w-fit">
            {getSpotIcon(location.type)}
            {formatLocationType(location.type)}
          </Badge>
          <h1 className="text-white text-2xl font-bold leading-tight drop-shadow">{location.name}</h1>
          {location.address && (
            <p className="text-white/80 text-sm flex items-center gap-1 mt-1">
              <MapPin className="h-3.5 w-3.5" /> {location.address}
            </p>
          )}
        </div>
      </div>

      {/* Quick action strip */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <Button variant="outline" size="sm" asChild className="gap-1.5">
          <Link to={`/map?lat=${location.latitude}&lng=${location.longitude}&id=${location.id}`}>
            <Eye className="h-4 w-4" /> Map
          </Link>
        </Button>
        <Button
          variant={isSaved ? "default" : "outline"}
          size="sm"
          className="gap-1.5"
          onClick={handleSave}
          data-testid="button-save-location"
        >
          {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
          {isSaved ? 'Saved' : 'Save'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => { navigator.clipboard?.writeText(window.location.href); toast({ title: "Link copied!" }); }}
        >
          <Share className="h-4 w-4" />
        </Button>
        {location.website && (
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <a href={location.website} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" /> Website
            </a>
          </Button>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Main column */}
        <div className="md:col-span-2 space-y-4">

          {/* Description */}
          <Card>
            <CardContent className="p-5">
              <h2 className="font-semibold mb-2">About</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {location.description || "No description available for this location."}
              </p>
            </CardContent>
          </Card>

          {/* AI Insights */}
          <SpotInsights
            spotName={location.name}
            spotType={location.type}
            address={location.address ?? undefined}
            description={location.description ?? undefined}
            cacheKey={`loc-${location.id}`}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="font-semibold text-sm">Details</h3>
              <div className="space-y-2 text-sm">
                {location.openingHours && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>{location.openingHours}</span>
                  </div>
                )}
                {location.contactInfo && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4 flex-shrink-0" />
                    <span>{location.contactInfo}</span>
                  </div>
                )}
                {location.isFree !== undefined && (
                  <Badge variant={location.isFree ? "outline" : "secondary"} className="text-xs">
                    {location.isFree ? '✓ Free to use' : 'Paid access'}
                  </Badge>
                )}
                {location.skillLevel && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Stars className="h-4 w-4 flex-shrink-0" />
                    <span className="capitalize">{
                      location.skillLevel === "all" ? "All skill levels" : location.skillLevel
                    }</span>
                  </div>
                )}
                {location.accessibility && location.accessibility !== "unknown" && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Accessibility className="h-4 w-4 flex-shrink-0" />
                    <span className="capitalize">{
                      location.accessibility === "wheelchair" ? "♿ Fully wheelchair accessible"
                      : location.accessibility === "limited" ? "🚶 Limited accessibility"
                      : location.accessibility === "not_accessible" ? "❌ Not wheelchair accessible"
                      : location.accessibility
                    }</span>
                  </div>
                )}
                {location.surfaceType && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Layers className="h-4 w-4 flex-shrink-0" />
                    <span className="capitalize">{
                      location.surfaceType === "concrete" ? "🪨 Concrete"
                      : location.surfaceType === "asphalt" ? "⬛ Asphalt / Tarmac"
                      : location.surfaceType === "wood" ? "🪵 Wood / Hardwood floor"
                      : location.surfaceType === "sprung_floor" ? "🎵 Sprung dance floor"
                      : location.surfaceType === "rubber" ? "🔵 Rubber / Foam mat"
                      : location.surfaceType === "grass" ? "🌿 Grass"
                      : location.surfaceType === "tiles" ? "🔲 Tiles"
                      : location.surfaceType === "sand" ? "🏖️ Sand"
                      : location.surfaceType === "mixed" ? "🔀 Mixed surfaces"
                      : location.surfaceType
                    }</span>
                  </div>
                )}
                {/* Extended rich fields */}
                {(location as any).indoorOutdoor && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Home className="h-4 w-4 flex-shrink-0" />
                    <span className="capitalize">{
                      (location as any).indoorOutdoor === 'outdoor' ? '🌳 Outdoor'
                      : (location as any).indoorOutdoor === 'indoor' ? '🏠 Indoor'
                      : (location as any).indoorOutdoor === 'covered' ? '⛺ Covered'
                      : (location as any).indoorOutdoor === 'both' ? '🔀 Indoor & Outdoor'
                      : (location as any).indoorOutdoor
                    }</span>
                  </div>
                )}
                {(location as any).lighting && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Sun className="h-4 w-4 flex-shrink-0" />
                    <span>{
                      (location as any).lighting === 'full' ? '💡 Full lighting'
                      : (location as any).lighting === 'partial' ? '🌗 Partial lighting'
                      : (location as any).lighting === 'none' ? '🌑 No lighting'
                      : (location as any).lighting
                    }</span>
                  </div>
                )}
                {(location as any).crowdLevel && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4 flex-shrink-0" />
                    <span>{
                      (location as any).crowdLevel === 'quiet' ? '🤫 Usually quiet'
                      : (location as any).crowdLevel === 'moderate' ? '👥 Moderate crowd'
                      : (location as any).crowdLevel === 'busy' ? '🔥 Usually busy'
                      : (location as any).crowdLevel === 'varies' ? '📊 Crowd varies'
                      : (location as any).crowdLevel
                    }</span>
                  </div>
                )}
                {(location as any).floorMaterial && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Waves className="h-4 w-4 flex-shrink-0" />
                    <span className="capitalize">{
                      ((location as any).floorMaterial || '').replace(/_/g, ' ')
                    }</span>
                  </div>
                )}
                {(location as any).capacity && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4 flex-shrink-0" />
                    <span>Capacity: {(location as any).capacity} people</span>
                  </div>
                )}
                {(location as any).instagram && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Instagram className="h-4 w-4 flex-shrink-0" />
                    <a
                      href={`https://instagram.com/${(location as any).instagram.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {(location as any).instagram.startsWith('@') ? (location as any).instagram : `@${(location as any).instagram}`}
                    </a>
                  </div>
                )}
                {(location as any).rules && (
                  <div className="pt-2 border-t">
                    <p className="text-xs font-medium mb-1">Spot Rules</p>
                    <p className="text-xs text-muted-foreground">{(location as any).rules}</p>
                  </div>
                )}
                {(location as any).tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(location as any).tags.map((tag: string) => (
                      <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                )}
                {location.createdAt && (
                  <p className="text-xs text-muted-foreground pt-1 border-t">
                    Added {formatDistance(new Date(location.createdAt), new Date(), { addSuffix: true })}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-3">Location</h3>
              <Button className="w-full" size="sm" asChild>
                <Link to={`/map?lat=${location.latitude}&lng=${location.longitude}&id=${location.id}`}>
                  <MapPin className="h-4 w-4 mr-2" /> View on Map
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* ── Admin Command Panel ── */}
          {isAdmin && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Settings className="h-4 w-4 text-primary" /> Admin Controls
                </h3>

                {/* Approval status */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Status</span>
                  <Badge
                    variant={location.approvalStatus === 'approved' ? 'default' : location.approvalStatus === 'rejected' ? 'destructive' : 'secondary'}
                    className="text-xs"
                    data-testid="badge-approval-status"
                  >
                    {location.approvalStatus || 'pending'}
                  </Badge>
                </div>

                {/* Visibility */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Visibility</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => visibilityMutation.mutate(!location.isVisible)}
                    disabled={visibilityMutation.isPending}
                    data-testid="button-toggle-visibility"
                  >
                    {location.isVisible !== false ? <><Eye className="h-3 w-3" />Visible</> : <><EyeOff className="h-3 w-3" />Hidden</>}
                  </Button>
                </div>

                {/* Approve / Reject */}
                {location.approvalStatus !== 'approved' && (
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      className="flex-1 h-8 text-xs gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => approveMutation.mutate()}
                      disabled={approveMutation.isPending}
                      data-testid="button-approve-spot"
                    >
                      {approveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1 h-8 text-xs gap-1.5"
                      onClick={() => rejectMutation.mutate(undefined)}
                      disabled={rejectMutation.isPending}
                      data-testid="button-reject-spot"
                    >
                      {rejectMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldX className="h-3 w-3" />}
                      Reject
                    </Button>
                  </div>
                )}
                {location.approvalStatus === 'approved' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-8 text-xs gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/5"
                    onClick={() => rejectMutation.mutate(undefined)}
                    disabled={rejectMutation.isPending}
                    data-testid="button-revoke-spot"
                  >
                    <ShieldX className="h-3 w-3" /> Revoke Approval
                  </Button>
                )}

                {/* Spotlight toggle */}
                <div className="pt-1 border-t">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-7 text-xs gap-1.5 border-yellow-500/40 text-yellow-700 hover:bg-yellow-500/10"
                      onClick={() => spotlightMutation.mutate(true)}
                      disabled={spotlightMutation.isPending}
                      data-testid="button-spotlight-on"
                    >
                      <Sparkles className="h-3 w-3" /> Spotlight On
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1 h-7 text-xs"
                      onClick={() => spotlightMutation.mutate(false)}
                      disabled={spotlightMutation.isPending}
                      data-testid="button-spotlight-off"
                    >
                      Off
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pending notice for non-admin owners */}
          {!isAdmin && isOwner && location.approvalStatus && location.approvalStatus !== 'approved' && (
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
              <CardContent className="p-4">
                <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
                  <Clock className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Pending approval</p>
                    <p className="text-xs mt-0.5">An admin will review your spot. You can already add sessions below.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── Schedule section — always at the bottom ── */}
      <SpotScheduleSection
        spotId={location.id}
        spotName={location.name}
        isOwner={isOwner}
        sessions={spotSessions}
        sessionsLoading={sessionsLoading}
        reservingId={reservingId}
        onReserve={(sessionId) => reserveMutation.mutate(sessionId)}
        user={user}
      />

      {/* Owner's note if no sessions and approved */}
      {isOwner && spotSessions.length === 0 && location.approvalStatus === 'approved' && (
        <p className="text-xs text-center text-muted-foreground mt-3">
          Your spot is approved! Use the schedule above to add sessions for visitors to reserve.
        </p>
      )}
    </div>
  );
};

export default LocationDetails;
