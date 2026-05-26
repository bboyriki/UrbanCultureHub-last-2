import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MapPin, Users, Shield, Eye, EyeOff, Phone, Radio, CheckCircle,
  Lock, Info, UserCheck, Zap, X, Sparkles, RefreshCw, Search,
  UserPlus, MessageCircle, ExternalLink, Bell, Settings,
  SlidersHorizontal, Navigation, UserX, Check,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import SafetyPanel from "@/components/safety/SafetyPanel";
import { FollowButton } from "@/components/follow/FollowButton";
import { useWebSocket } from "@/hooks/use-websocket";
import { cn } from "@/lib/utils";
import AISpotGuide from "@/components/ai/AISpotGuide";

interface NearbyUser {
  userId: number;
  displayName: string;
  role: string;
  artType?: string;
  profilePicture?: string;
  isVerified: boolean;
  city?: string;
  visibilityMode: string;
  bio?: string;
}

interface SwipeCardSuggestion {
  userId: number;
  displayName: string;
  role: string;
  artType?: string;
  bio?: string;
  profilePicture?: string;
  isVerified: boolean;
  city?: string;
  visibilityMode: string;
}

interface SearchUser {
  id: number;
  displayName: string;
  role: string;
  artType?: string;
  bio?: string;
  profilePicture?: string;
  isVerified?: boolean;
  city?: string;
}

interface SuggestedUser {
  userId: number;
  displayName: string;
  role: string;
  artType?: string;
  bio?: string;
  profilePicture?: string;
  isVerified?: boolean;
  city?: string;
  reason?: string;
}

interface ProfilePreview {
  userId: number;
  displayName: string;
  role: string;
  artType?: string;
  bio?: string;
  profilePicture?: string;
  isVerified?: boolean;
  city?: string;
}

interface ProximitySettings {
  discoveryEnabled: boolean;
  visibilityMode: string;
  radiusKm: number;
  liveLocationEnabled: boolean;
  consentGiven: boolean;
}

const VISIBILITY_OPTIONS = [
  { value: "everyone", label: "Everyone", icon: Eye },
  { value: "friends_only", label: "Followers only", icon: UserCheck },
  { value: "events_only", label: "At events only", icon: Radio },
  { value: "ghost", label: "Ghost mode", icon: EyeOff },
];

const AVATAR_COLORS = [
  "from-violet-500 to-purple-600",
  "from-blue-500 to-cyan-600",
  "from-emerald-500 to-teal-600",
  "from-orange-500 to-amber-600",
  "from-rose-500 to-pink-600",
  "from-indigo-500 to-blue-600",
];

function getAvatarColor(name: string) {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

type MainTab = "search" | "discover" | "nearby" | "suggested" | "requests";

export default function NearbyPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showSafetyPanel, setShowSafetyPanel] = useState(false);
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [mainTab, setMainTab] = useState<MainTab>("discover");
  const [profileSheetUser, setProfileSheetUser] = useState<ProfilePreview | null>(null);

  const { subscribe } = useWebSocket(["NEARBY_PRESENCE_UPDATE"]);
  const hasRefreshedPresenceOnMount = useRef(false);

  const { data: settings, isLoading: settingsLoading } = useQuery<ProximitySettings>({
    queryKey: ["/api/proximity/settings"],
    enabled: !!user,
  });

  const { data: storedPresence } = useQuery<{ lat: number; lng: number; city?: string } | null>({
    queryKey: ["/api/proximity/my-presence"],
    enabled: !!user && !!settings?.discoveryEnabled && !!settings?.consentGiven,
  });

  useEffect(() => {
    if (storedPresence && !userLocation) {
      setUserLocation({ lat: storedPresence.lat, lng: storedPresence.lng });
    }
  }, [storedPresence, userLocation]);

  const { data: nearbyUsers = [], isLoading: nearbyLoading, refetch: refetchNearby } = useQuery<NearbyUser[]>({
    queryKey: ["/api/proximity/nearby", userLocation?.lat, userLocation?.lng],
    enabled: !!user && !!settings?.discoveryEnabled && !!settings?.consentGiven && !!userLocation,
    queryFn: async () => {
      if (!userLocation) return [];
      const res = await fetch(
        `/api/proximity/nearby?lat=${userLocation.lat}&lng=${userLocation.lng}`,
        { credentials: "include" }
      );
      if (!res.ok) return [];
      return res.json();
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (data: Partial<ProximitySettings>) =>
      apiRequest("/api/proximity/settings", "PUT", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proximity/settings"] });
    },
  });

  const updatePresenceMutation = useMutation({
    mutationFn: (data: { lat: number; lng: number; city?: string }) =>
      apiRequest("/api/proximity/presence", "POST", data),
  });

  const clearPresenceMutation = useMutation({
    mutationFn: () => apiRequest("/api/proximity/presence", "DELETE"),
  });

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Your browser does not support location access.");
      return;
    }
    setIsGettingLocation(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setIsGettingLocation(false);
        if (settings?.discoveryEnabled && settings?.consentGiven && settings?.visibilityMode !== "ghost") {
          updatePresenceMutation.mutate({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      },
      () => {
        setLocationError("Could not access your location. Please allow location access in your browser.");
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  }, [settings]);

  const handleEnableDiscovery = () => {
    if (!settings?.consentGiven) {
      setShowConsentModal(true);
    } else {
      updateSettingsMutation.mutate({ discoveryEnabled: !settings?.discoveryEnabled });
    }
  };

  const handleGiveConsent = async () => {
    await updateSettingsMutation.mutateAsync({
      discoveryEnabled: true,
      visibilityMode: "everyone",
      radiusKm: 2,
      consentGiven: true,
    });
    setShowConsentModal(false);
    requestLocation();
    toast({ title: "Discovery enabled", description: "You can now discover nearby urban culture members." });
  };

  const handleVisibilityChange = (value: string) => {
    updateSettingsMutation.mutate({ visibilityMode: value });
    if (value === "ghost") {
      clearPresenceMutation.mutate();
    } else if (userLocation) {
      updatePresenceMutation.mutate({ lat: userLocation.lat, lng: userLocation.lng });
    }
  };

  const handleRadiusChange = (values: number[]) => {
    updateSettingsMutation.mutate({ radiusKm: values[0] });
  };

  useEffect(() => {
    if (settings?.discoveryEnabled && settings?.consentGiven && !userLocation) {
      requestLocation();
    }
  }, [settings?.discoveryEnabled, settings?.consentGiven]);

  useEffect(() => {
    if (hasRefreshedPresenceOnMount.current) return;
    if (!settings) return;
    if (settings.discoveryEnabled && settings.consentGiven && settings.visibilityMode !== "ghost") {
      hasRefreshedPresenceOnMount.current = true;
      requestLocation();
    }
  }, [settings]);

  useEffect(() => {
    if (!settings?.discoveryEnabled || !settings?.consentGiven || settings?.visibilityMode === "ghost") return;
    const interval = setInterval(() => {
      if (userLocation) {
        updatePresenceMutation.mutate({ lat: userLocation.lat, lng: userLocation.lng });
      } else {
        requestLocation();
      }
    }, 90 * 60 * 1000);
    return () => clearInterval(interval);
  }, [settings?.discoveryEnabled, settings?.consentGiven, settings?.visibilityMode, userLocation]);

  useEffect(() => {
    if (!settings?.discoveryEnabled || !settings?.consentGiven) return;
    const unsubscribe = subscribe((msg) => {
      if (msg.type === "NEARBY_PRESENCE_UPDATE") {
        queryClient.invalidateQueries({ queryKey: ["/api/proximity/nearby"] });
        queryClient.invalidateQueries({ queryKey: ["/api/discovery/suggestions"] });
      }
    });
    return unsubscribe;
  }, [subscribe, settings?.discoveryEnabled, settings?.consentGiven, queryClient]);

  if (!user) {
    return (
      <MainLayout>
        <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 text-center">
          <div className="relative mb-8">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-1 ring-primary/20">
              <Users className="w-10 h-10 text-primary" />
            </div>
            <span className="absolute -bottom-1 -right-1 text-2xl">🌍</span>
          </div>
          <h2 className="text-2xl font-bold mb-2">Discover Your Community</h2>
          <p className="text-muted-foreground text-sm max-w-xs leading-relaxed mb-8">
            Find nearby artists, athletes and culture creators. Connect with the urban culture scene around you.
          </p>
          <Link href="/auth">
            <Button size="lg" className="rounded-full px-8 gap-2">
              <Zap className="w-4 h-4" />
              Get Started
            </Button>
          </Link>
        </div>
      </MainLayout>
    );
  }

  const { data: pendingRequests = [] } = useQuery<any[]>({
    queryKey: ["/api/follow-requests"],
    enabled: !!user,
    refetchInterval: 30000,
  });

  const { data: friendsNearby = [] } = useQuery<any[]>({
    queryKey: ["/api/proximity/friends-nearby"],
    enabled: !!user && !!userLocation && !!settings?.discoveryEnabled && !!settings?.consentGiven,
    refetchInterval: 60000,
  });

  const tabItems: { id: MainTab; label: string; icon: any; badge?: number }[] = [
    { id: "discover", label: "Discover", icon: Sparkles },
    { id: "nearby", label: "Nearby", icon: MapPin },
    { id: "suggested", label: "Suggested", icon: UserPlus },
    { id: "search", label: "Search", icon: Search },
    { id: "requests", label: "Requests", icon: Bell, badge: pendingRequests.length },
  ];

  const isDiscoveryActive = !!settings?.discoveryEnabled && !!settings?.consentGiven;
  const visibilityOpt = VISIBILITY_OPTIONS.find(o => o.value === (settings?.visibilityMode ?? "ghost"));

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto px-4 pb-10">

        {/* ── Header ── */}
        <div className="flex items-center justify-between py-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">People</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Urban culture community</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSafetyPanel(true)}
              data-testid="button-open-safety"
              className="w-9 h-9 rounded-full border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 flex items-center justify-center text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
            >
              <Phone className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowSettingsSheet(true)}
              data-testid="button-open-settings"
              className="w-9 h-9 rounded-full border border-border bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors relative"
            >
              <SlidersHorizontal className="w-4 h-4" />
              {isDiscoveryActive && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-background" />
              )}
            </button>
          </div>
        </div>

        {/* ── Discovery status pill ── */}
        {settings && (
          <button
            onClick={() => setShowSettingsSheet(true)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-2xl border mb-4 text-left transition-all hover:shadow-sm",
              isDiscoveryActive
                ? "border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20 dark:border-emerald-800"
                : "border-dashed border-muted-foreground/30 bg-muted/30"
            )}
            data-testid="button-discovery-status"
          >
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
              isDiscoveryActive ? "bg-emerald-500" : "bg-muted"
            )}>
              {isDiscoveryActive ? (
                <Navigation className="w-4 h-4 text-white" />
              ) : (
                <EyeOff className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn("text-sm font-semibold", isDiscoveryActive ? "text-emerald-800 dark:text-emerald-200" : "text-muted-foreground")}>
                {isDiscoveryActive ? "Discovery is on" : "Discovery is off"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {isDiscoveryActive
                  ? `Visible as: ${visibilityOpt?.label ?? settings.visibilityMode} · ${settings.radiusKm} km radius`
                  : "Tap to enable and find nearby members"}
              </p>
            </div>
            <Settings className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        )}

        {/* ── AI Spot Gids ── */}
        <AISpotGuide city={user?.city || undefined} />

        {/* ── Friends nearby strip ── */}
        {friendsNearby.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 mb-4 overflow-x-auto" data-testid="section-friends-nearby">
            <div className="shrink-0">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="shrink-0">
              <p className="text-xs font-semibold text-blue-800 dark:text-blue-200 whitespace-nowrap">
                {friendsNearby.length === 1 ? "1 friend nearby" : `${friendsNearby.length} friends nearby`}
              </p>
              <p className="text-[10px] text-blue-500">People you follow are in your area</p>
            </div>
            <div className="flex gap-1.5 ml-1">
              {friendsNearby.map((friend: any) => (
                <button
                  key={friend.userId}
                  onClick={() => setProfileSheetUser(friend)}
                  data-testid={`button-friend-nearby-${friend.userId}`}
                  className="flex items-center gap-1.5 bg-white dark:bg-blue-900/60 rounded-full pl-1 pr-2.5 py-1 border border-blue-200 dark:border-blue-700 hover:border-blue-400 transition-colors whitespace-nowrap"
                >
                  {friend.profilePicture ? (
                    <img src={friend.profilePicture} alt={friend.displayName} className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${getAvatarColor(friend.displayName || "?")} flex items-center justify-center text-white text-[8px] font-bold`}>
                      {(friend.displayName || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-xs font-medium text-blue-800 dark:text-blue-200">{friend.displayName}</span>
                  <span className="text-[10px] text-blue-400">{friend.distanceKm}km</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab bar ── */}
        <div className="flex gap-1 bg-muted/50 rounded-2xl p-1 mb-5 border border-border" data-testid="tab-navigation">
          {tabItems.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMainTab(tab.id)}
              data-testid={`button-tab-${tab.id}`}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-xl text-xs font-semibold transition-all relative",
                mainTab === tab.id
                  ? "bg-background shadow-sm text-foreground ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              <tab.icon className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.badge && tab.badge > 0 ? (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground px-0.5">
                  {tab.badge > 9 ? "9+" : tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        {mainTab === "search" && (
          <PeopleSearchView onSelectUser={setProfileSheetUser} />
        )}
        {mainTab === "discover" && (
          <SwipeDiscovery
            userLocation={userLocation}
            settings={settings}
            onEnableDiscovery={handleEnableDiscovery}
            onRequestLocation={requestLocation}
            isGettingLocation={isGettingLocation}
          />
        )}
        {mainTab === "nearby" && (
          <NearbyListView
            users={nearbyUsers}
            isLoading={nearbyLoading}
            discoveryEnabled={settings?.discoveryEnabled ?? false}
            userLocation={userLocation}
            radiusKm={settings?.radiusKm ?? 2}
            onEnableDiscovery={handleEnableDiscovery}
            onRequestLocation={requestLocation}
            isGettingLocation={isGettingLocation}
            onRefresh={() => refetchNearby()}
            onSelectUser={setProfileSheetUser}
          />
        )}
        {mainTab === "suggested" && (
          <SuggestedPeopleView onSelectUser={setProfileSheetUser} />
        )}
        {mainTab === "requests" && (
          <ConnectRequestsView onSelectUser={setProfileSheetUser} />
        )}
      </div>

      {/* ── Settings Sheet ── */}
      <Sheet open={showSettingsSheet} onOpenChange={setShowSettingsSheet}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-10 max-h-[90vh] overflow-y-auto">
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Discovery & Privacy
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-6">
            {/* Discovery toggle */}
            <div className="flex items-center justify-between py-3 border-b border-border">
              <div>
                <p className="font-semibold text-sm">Discovery mode</p>
                <p className="text-xs text-muted-foreground mt-0.5">Let others find you nearby</p>
              </div>
              <Switch
                id="switch-discovery"
                data-testid="switch-discovery-enabled"
                checked={settings?.discoveryEnabled ?? false}
                onCheckedChange={handleEnableDiscovery}
                disabled={settingsLoading || updateSettingsMutation.isPending}
              />
            </div>

            {/* Visibility */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Who can see you</Label>
              <div className="grid grid-cols-2 gap-2">
                {VISIBILITY_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = (settings?.visibilityMode ?? "ghost") === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => settings?.discoveryEnabled && handleVisibilityChange(opt.value)}
                      disabled={!settings?.discoveryEnabled}
                      data-testid={`option-visibility-${opt.value}`}
                      className={cn(
                        "flex items-center gap-2 p-3 rounded-xl border text-left transition-all text-sm",
                        isSelected
                          ? "border-primary bg-primary/5 text-primary font-medium"
                          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                        !settings?.discoveryEnabled && "opacity-40 cursor-not-allowed"
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="text-xs">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Radius */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Search radius</Label>
                <span className="text-sm font-bold text-primary">{settings?.radiusKm ?? 2} km</span>
              </div>
              <Slider
                data-testid="slider-radius"
                min={1} max={10} step={1}
                value={[settings?.radiusKm ?? 2]}
                onValueCommit={handleRadiusChange}
                disabled={!settings?.discoveryEnabled}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 km</span><span>5 km</span><span>10 km</span>
              </div>
            </div>

            {/* Location refresh */}
            {settings?.discoveryEnabled && (
              <Button
                variant="outline"
                className="w-full gap-2 rounded-xl"
                onClick={() => { requestLocation(); setShowSettingsSheet(false); }}
                disabled={isGettingLocation}
                data-testid="button-refresh-location"
              >
                <MapPin className="w-4 h-4" />
                {isGettingLocation ? "Getting location…" : "Refresh my location"}
              </Button>
            )}

            {locationError && (
              <p className="text-xs text-destructive flex items-center gap-1.5">
                <X className="w-3.5 h-3.5 shrink-0" />
                {locationError}
              </p>
            )}

            {/* Ghost notice */}
            {settings?.visibilityMode === "ghost" && settings?.discoveryEnabled && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300">
                <EyeOff className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>Ghost mode: you can browse others but you won't appear in their search.</span>
              </div>
            )}

            {/* Privacy notice */}
            <div className="flex items-start gap-2 text-xs text-muted-foreground pt-2 border-t border-border">
              <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-500" />
              <span>Only your approximate area (~1–3 km) is ever shared — no exact coordinates stored. Processed under GDPR Art. 6(1)(a).</span>
            </div>

            {/* Emergency */}
            <button
              onClick={() => { setShowSettingsSheet(false); setShowSafetyPanel(true); }}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 text-left hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
            >
              <Phone className="w-4 h-4 text-red-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-700 dark:text-red-300">Emergency: call 112</p>
                <p className="text-xs text-muted-foreground">Open safety panel for trusted contacts</p>
              </div>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <ConsentModal
        open={showConsentModal}
        onAccept={handleGiveConsent}
        onCancel={() => setShowConsentModal(false)}
        isPending={updateSettingsMutation.isPending}
      />

      {showSafetyPanel && (
        <SafetyPanel userLocation={userLocation} onClose={() => setShowSafetyPanel(false)} />
      )}

      <ProfileSheet
        user={profileSheetUser}
        onClose={() => setProfileSheetUser(null)}
      />
    </MainLayout>
  );
}

/* ═══════════════════════════════════════
   SEARCH VIEW
═══════════════════════════════════════ */
function PeopleSearchView({ onSelectUser }: { onSelectUser: (u: ProfilePreview) => void }) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(val), 350);
  };

  const { data: results = [], isLoading } = useQuery<SearchUser[]>({
    queryKey: ["/api/users/search", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return [];
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(debouncedQuery)}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: debouncedQuery.length >= 2,
  });

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, role, or city…"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          className="pl-10 h-11 rounded-xl border-border bg-muted/30 focus-visible:bg-background"
          data-testid="input-people-search"
        />
        {query && (
          <button onClick={() => { setQuery(""); setDebouncedQuery(""); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40 animate-pulse">
              <div className="w-12 h-12 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 bg-muted rounded" />
                <div className="h-2.5 w-20 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && debouncedQuery.length >= 2 && results.length === 0 && (
        <div className="text-center py-12">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
            <Search className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="font-semibold text-sm">No results for "{debouncedQuery}"</p>
          <p className="text-xs text-muted-foreground mt-1">Try a different name or city</p>
        </div>
      )}

      {!isLoading && debouncedQuery.length < 2 && (
        <div className="text-center py-12">
          <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
            <Search className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Type at least 2 characters to search</p>
        </div>
      )}

      <div className="space-y-2">
        {results.map((u) => (
          <PersonCard
            key={u.id}
            userId={u.id}
            displayName={u.displayName}
            role={u.role}
            artType={u.artType}
            bio={u.bio}
            profilePicture={u.profilePicture}
            isVerified={u.isVerified}
            city={u.city}
            onOpen={() => onSelectUser({
              userId: u.id,
              displayName: u.displayName,
              role: u.role,
              artType: u.artType,
              bio: u.bio,
              profilePicture: u.profilePicture,
              isVerified: u.isVerified,
              city: u.city,
            })}
            data-testid={`card-search-user-${u.id}`}
          />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   NEARBY LIST VIEW
═══════════════════════════════════════ */
function NearbyListView({
  users, isLoading, discoveryEnabled, userLocation, radiusKm,
  onEnableDiscovery, onRequestLocation, isGettingLocation, onRefresh, onSelectUser,
}: {
  users: NearbyUser[];
  isLoading: boolean;
  discoveryEnabled: boolean;
  userLocation: { lat: number; lng: number } | null;
  radiusKm: number;
  onEnableDiscovery: () => void;
  onRequestLocation: () => void;
  isGettingLocation: boolean;
  onRefresh: () => void;
  onSelectUser: (u: ProfilePreview) => void;
}) {
  if (!discoveryEnabled) {
    return <EnableDiscoveryPrompt onEnable={onEnableDiscovery} />;
  }

  if (!userLocation) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center mx-auto mb-4 ring-1 ring-blue-200 dark:ring-blue-800">
          <MapPin className="w-7 h-7 text-blue-500" />
        </div>
        <h3 className="font-bold text-lg mb-1.5">Share your location</h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-6">Allow location access to see who's nearby in the urban culture scene.</p>
        <Button onClick={onRequestLocation} disabled={isGettingLocation} className="rounded-full px-6" data-testid="button-share-location">
          <MapPin className="w-4 h-4 mr-2" />
          {isGettingLocation ? "Getting location…" : "Share Location"}
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 p-4 rounded-2xl bg-muted/40 animate-pulse">
            <div className="w-12 h-12 rounded-full bg-muted shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-36 bg-muted rounded" />
              <div className="h-2.5 w-24 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{users.length}</span> people within {radiusKm} km
        </p>
        <button onClick={onRefresh} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors" data-testid="button-refresh-nearby">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {users.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <Users className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="font-bold text-base mb-1">No one nearby yet</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            No discoverable members within {radiusKm} km. Try increasing your search radius in settings.
          </p>
        </div>
      ) : (
        users.map((u) => (
          <PersonCard
            key={u.userId}
            userId={u.userId}
            displayName={u.displayName}
            role={u.role}
            artType={u.artType}
            bio={u.bio}
            profilePicture={u.profilePicture}
            isVerified={u.isVerified}
            city={u.city}
            onOpen={() => onSelectUser({
              userId: u.userId,
              displayName: u.displayName,
              role: u.role,
              artType: u.artType,
              bio: u.bio,
              profilePicture: u.profilePicture,
              isVerified: u.isVerified,
              city: u.city,
            })}
            data-testid={`card-nearby-user-${u.userId}`}
          />
        ))
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   SUGGESTED PEOPLE VIEW
═══════════════════════════════════════ */
function SuggestedPeopleView({ onSelectUser }: { onSelectUser: (u: ProfilePreview) => void }) {
  const { data: suggestions = [], isLoading } = useQuery<SuggestedUser[]>({
    queryKey: ["/api/users/suggestions"],
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 p-4 rounded-2xl bg-muted/40 animate-pulse">
            <div className="w-12 h-12 rounded-full bg-muted shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-36 bg-muted rounded" />
              <div className="h-2.5 w-24 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
          <UserPlus className="w-7 h-7 text-muted-foreground" />
        </div>
        <h3 className="font-bold text-base mb-1">No suggestions yet</h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          As you connect with more people, we'll suggest others you might know.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground mb-3">People you might know</p>
      {suggestions.map((u) => (
        <PersonCard
          key={u.userId}
          userId={u.userId}
          displayName={u.displayName}
          role={u.role}
          artType={u.artType}
          bio={u.bio}
          profilePicture={u.profilePicture}
          isVerified={u.isVerified}
          city={u.city}
          reason={u.reason}
          onOpen={() => onSelectUser({
            userId: u.userId,
            displayName: u.displayName,
            role: u.role,
            artType: u.artType,
            bio: u.bio,
            profilePicture: u.profilePicture,
            isVerified: u.isVerified,
            city: u.city,
          })}
          data-testid={`card-suggested-user-${u.userId}`}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════
   CONNECT REQUESTS VIEW
═══════════════════════════════════════ */
function ConnectRequestsView({ onSelectUser }: { onSelectUser: (u: ProfilePreview) => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: requests = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/follow-requests"],
  });

  const acceptMutation = useMutation({
    mutationFn: (requestId: number) => apiRequest(`/api/follow-requests/${requestId}/accept`, "POST"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/follow-requests"] });
      toast({ title: "Request accepted" });
    },
  });

  const declineMutation = useMutation({
    mutationFn: (requestId: number) => apiRequest(`/api/follow-requests/${requestId}/decline`, "POST"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/follow-requests"] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 p-4 rounded-2xl bg-muted/40 animate-pulse">
            <div className="w-12 h-12 rounded-full bg-muted shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-32 bg-muted rounded" />
              <div className="h-2.5 w-20 bg-muted rounded" />
            </div>
            <div className="flex gap-2">
              <div className="w-8 h-8 rounded-full bg-muted" />
              <div className="w-8 h-8 rounded-full bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
          <Bell className="w-7 h-7 text-muted-foreground" />
        </div>
        <h3 className="font-bold text-base mb-1">No pending requests</h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          When someone sends you a follow request, it will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground mb-3">{requests.length} pending {requests.length === 1 ? "request" : "requests"}</p>
      {requests.map((req: any) => {
        const fromUser = req.fromUser || req;
        const initials = (fromUser.displayName || "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
        return (
          <div
            key={req.id}
            className="flex items-center gap-3 p-3 rounded-2xl border border-border bg-card hover:shadow-sm transition-shadow"
            data-testid={`card-request-${req.id}`}
          >
            <button
              onClick={() => onSelectUser({
                userId: fromUser.id,
                displayName: fromUser.displayName,
                role: fromUser.role,
                artType: fromUser.artType,
                bio: fromUser.bio,
                profilePicture: fromUser.profilePicture,
                isVerified: fromUser.isVerified,
                city: fromUser.city,
              })}
              className="shrink-0"
            >
              <div className="relative">
                {fromUser.profilePicture ? (
                  <img src={fromUser.profilePicture} alt={fromUser.displayName} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getAvatarColor(fromUser.displayName || "?")} flex items-center justify-center text-white font-bold text-sm`}>
                    {initials}
                  </div>
                )}
              </div>
            </button>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{fromUser.displayName}</p>
              <p className="text-xs text-muted-foreground capitalize">{fromUser.role}{fromUser.city ? ` · ${fromUser.city}` : ""}</p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button
                onClick={() => acceptMutation.mutate(req.id)}
                disabled={acceptMutation.isPending}
                data-testid={`button-accept-request-${req.id}`}
                className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => declineMutation.mutate(req.id)}
                disabled={declineMutation.isPending}
                data-testid={`button-decline-request-${req.id}`}
                className="w-9 h-9 rounded-full border border-border text-muted-foreground flex items-center justify-center hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════
   PERSON CARD
═══════════════════════════════════════ */
function PersonCard({
  userId, displayName, role, artType, bio, profilePicture, isVerified, city, reason, onOpen,
  "data-testid": testId,
}: {
  userId: number;
  displayName: string;
  role: string;
  artType?: string;
  bio?: string;
  profilePicture?: string;
  isVerified?: boolean;
  city?: string;
  reason?: string;
  onOpen: () => void;
  "data-testid"?: string;
}) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const initials = (displayName || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-2xl border border-border bg-card hover:shadow-sm transition-all hover:border-primary/20 cursor-pointer group"
      data-testid={testId}
    >
      <button onClick={onOpen} className="shrink-0 focus:outline-none" data-testid={`button-open-profile-${userId}`}>
        {profilePicture ? (
          <img src={profilePicture} alt={displayName} className="w-12 h-12 rounded-full object-cover ring-2 ring-transparent group-hover:ring-primary/20 transition-all" />
        ) : (
          <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getAvatarColor(displayName || "?")} flex items-center justify-center text-white font-bold text-sm ring-2 ring-transparent group-hover:ring-primary/20 transition-all`}>
            {initials}
          </div>
        )}
      </button>

      <div className="flex-1 min-w-0" onClick={onOpen}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-sm" data-testid={`text-person-name-${userId}`}>{displayName}</span>
          {isVerified && <CheckCircle className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
        </div>
        <div className="flex items-center gap-1 flex-wrap mt-0.5">
          <span className="text-xs text-muted-foreground capitalize font-medium">{role}</span>
          {artType && <><span className="text-muted-foreground/40 text-xs">·</span><span className="text-xs text-muted-foreground capitalize">{artType}</span></>}
          {city && <><span className="text-muted-foreground/40 text-xs">·</span><MapPin className="w-2.5 h-2.5 text-muted-foreground" /><span className="text-xs text-muted-foreground">{city}</span></>}
        </div>
        {bio && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{bio}</p>}
        {reason && <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{reason}</p>}
      </div>

      {user && user.id !== userId && (
        <div className="flex items-center gap-1.5 shrink-0">
          <FollowButton userId={userId} size="sm" />
          <button
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
            onClick={(e) => { e.stopPropagation(); navigate(`/chat?userId=${userId}`); }}
            data-testid={`button-message-user-${userId}`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   PROFILE SHEET (bottom drawer)
═══════════════════════════════════════ */
function ProfileSheet({ user: profileUser, onClose }: { user: ProfilePreview | null; onClose: () => void }) {
  const [, navigate] = useLocation();
  const { user: currentUser } = useAuth();
  const initials = profileUser
    ? (profileUser.displayName || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "";

  return (
    <Sheet open={!!profileUser} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto pb-10">
        <SheetHeader className="pb-2">
          <SheetTitle className="sr-only">Profile</SheetTitle>
        </SheetHeader>

        {profileUser && (
          <div className="flex flex-col items-center text-center gap-5 pt-2">
            {/* Avatar */}
            <div className="relative">
              {profileUser.profilePicture ? (
                <img src={profileUser.profilePicture} alt={profileUser.displayName} className="w-24 h-24 rounded-full object-cover ring-4 ring-border shadow-lg" />
              ) : (
                <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${getAvatarColor(profileUser.displayName || "?")} flex items-center justify-center text-white font-black text-3xl ring-4 ring-border shadow-lg`}>
                  {initials}
                </div>
              )}
              {profileUser.isVerified && (
                <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center ring-2 ring-background">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
              )}
            </div>

            {/* Info */}
            <div>
              <h2 className="text-xl font-bold" data-testid="text-sheet-name">{profileUser.displayName}</h2>
              <div className="flex items-center justify-center gap-1.5 mt-1.5 flex-wrap">
                <Badge variant="secondary" className="capitalize rounded-full">{profileUser.role}</Badge>
                {profileUser.artType && (
                  <Badge variant="outline" className="capitalize rounded-full">{profileUser.artType}</Badge>
                )}
              </div>
              {profileUser.city && (
                <p className="text-sm text-muted-foreground mt-2 flex items-center justify-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />{profileUser.city}
                </p>
              )}
            </div>

            {profileUser.bio && (
              <p className="text-sm text-muted-foreground max-w-xs text-center leading-relaxed border-t border-border pt-4 w-full">
                {profileUser.bio}
              </p>
            )}

            {currentUser && currentUser.id !== profileUser.userId && (
              <div className="flex gap-3 w-full max-w-xs">
                <div className="flex-1">
                  <FollowButton userId={profileUser.userId} size="default" />
                </div>
                <Button
                  variant="outline"
                  className="flex-1 gap-2 rounded-xl"
                  onClick={() => { navigate(`/chat?userId=${profileUser.userId}`); onClose(); }}
                  data-testid={`button-sheet-message-${profileUser.userId}`}
                >
                  <MessageCircle className="w-4 h-4" />Message
                </Button>
              </div>
            )}

            <button
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
              onClick={() => { navigate(`/profile/${profileUser.userId}`); onClose(); }}
              data-testid={`button-sheet-view-profile-${profileUser.userId}`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View full profile
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ═══════════════════════════════════════
   SWIPE DISCOVERY
═══════════════════════════════════════ */
function SwipeDiscovery({
  userLocation, settings, onEnableDiscovery, onRequestLocation, isGettingLocation,
}: {
  userLocation: { lat: number; lng: number } | null;
  settings?: ProximitySettings;
  onEnableDiscovery: () => void;
  onRequestLocation: () => void;
  isGettingLocation: boolean;
}) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const isActive = !!settings?.discoveryEnabled && !!settings?.consentGiven && !!userLocation;

  const { data: suggestions = [], isLoading, refetch, isFetching } = useQuery<SwipeCardSuggestion[]>({
    queryKey: ["/api/discovery/suggestions", userLocation?.lat, userLocation?.lng],
    queryFn: async () => {
      if (!userLocation) return [];
      const res = await fetch(
        `/api/discovery/suggestions?lat=${userLocation.lat}&lng=${userLocation.lng}`,
        { credentials: "include" }
      );
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isActive,
  });

  const actionMutation = useMutation({
    mutationFn: (data: { discoveredUserId: number; action: string }) =>
      apiRequest("/api/discovery/action", "POST", data),
    onSuccess: (_, variables) => {
      if (variables.action === "connect") {
        toast({ title: "Connected!", description: "You are now following this person." });
      }
    },
  });

  const handleSwipe = useCallback(
    (direction: "left" | "right" | "up") => {
      const current = suggestions[currentIndex];
      if (!current) return;
      if (direction === "up") { navigate(`/profile/${current.userId}`); return; }
      const action = direction === "right" ? "connect" : "skip";
      actionMutation.mutate({ discoveredUserId: current.userId, action });
      setCurrentIndex((prev) => prev + 1);
    },
    [suggestions, currentIndex, actionMutation, navigate]
  );

  const handleRefresh = useCallback(() => { setCurrentIndex(0); refetch(); }, [refetch]);

  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handleSwipe("left");
      else if (e.key === "ArrowRight") handleSwipe("right");
      else if (e.key === "ArrowUp") handleSwipe("up");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isActive, handleSwipe]);

  if (!settings?.discoveryEnabled) {
    return <EnableDiscoveryPrompt onEnable={onEnableDiscovery} />;
  }

  if (!userLocation) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center mx-auto mb-4 ring-1 ring-blue-200 dark:ring-blue-800">
          <MapPin className="w-7 h-7 text-blue-500" />
        </div>
        <h3 className="font-bold text-lg mb-1.5">Share your location</h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-6">Allow location access to discover nearby members.</p>
        <Button onClick={onRequestLocation} disabled={isGettingLocation} className="rounded-full px-6" data-testid="button-share-location">
          <MapPin className="w-4 h-4 mr-2" />
          {isGettingLocation ? "Getting location…" : "Share Location"}
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center py-6 gap-4">
        <div className="w-full max-w-sm h-[28rem] bg-muted rounded-3xl animate-pulse" />
        <div className="flex gap-5">
          <div className="w-14 h-14 rounded-full bg-muted animate-pulse" />
          <div className="w-10 h-10 rounded-full bg-muted animate-pulse self-center" />
          <div className="w-14 h-14 rounded-full bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  const remaining = suggestions.slice(currentIndex);

  if (remaining.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-7 h-7 text-muted-foreground" />
        </div>
        <h3 className="font-bold text-lg mb-1.5">All caught up!</h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-6">
          No more suggestions nearby. Try increasing your radius or check back later.
        </p>
        <Button variant="outline" onClick={handleRefresh} disabled={isFetching} className="rounded-full px-6" data-testid="button-reset-discover">
          <RefreshCw className={cn("w-4 h-4 mr-2", isFetching && "animate-spin")} />
          Refresh suggestions
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Card stack */}
      <div className="relative w-full max-w-sm" style={{ height: "28rem" }} data-testid="swipe-card-container">
        {remaining.slice(0, 3).map((suggestion, idx) => (
          <SwipeCard
            key={suggestion.userId}
            user={suggestion}
            isTop={idx === 0}
            stackIndex={idx}
            onSwipe={handleSwipe}
          />
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-5">
        <button
          className="w-14 h-14 rounded-full border-2 border-rose-200 dark:border-rose-800 bg-background flex items-center justify-center shadow-sm hover:shadow-md hover:border-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all text-rose-400 hover:text-rose-500 disabled:opacity-40"
          onClick={() => handleSwipe("left")}
          disabled={actionMutation.isPending}
          data-testid="button-swipe-skip"
          title="Skip"
        >
          <X className="w-6 h-6" />
        </button>
        <button
          className="w-10 h-10 rounded-full border-2 border-border bg-background flex items-center justify-center shadow-sm hover:shadow-md hover:border-primary/40 hover:text-primary transition-all text-muted-foreground"
          onClick={() => handleSwipe("up")}
          data-testid="button-swipe-view"
          title="View profile"
        >
          <ExternalLink className="w-4 h-4" />
        </button>
        <button
          className="w-14 h-14 rounded-full border-2 border-primary/20 bg-background flex items-center justify-center shadow-sm hover:shadow-md hover:border-primary hover:bg-primary/5 transition-all text-primary/50 hover:text-primary disabled:opacity-40"
          onClick={() => handleSwipe("right")}
          disabled={actionMutation.isPending}
          data-testid="button-swipe-connect"
          title="Connect"
        >
          <UserPlus className="w-6 h-6" />
        </button>
      </div>

      {/* Hint */}
      <div className="flex items-center gap-5 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><X className="w-3 h-3 text-rose-400" />Skip</span>
        <span className="flex items-center gap-1"><ExternalLink className="w-3 h-3" />View</span>
        <span className="flex items-center gap-1"><UserPlus className="w-3 h-3 text-primary/60" />Connect</span>
      </div>

      <p className="text-xs text-muted-foreground">{remaining.length} profile{remaining.length !== 1 ? "s" : ""} nearby</p>
    </div>
  );
}

/* ═══════════════════════════════════════
   SWIPE CARD
═══════════════════════════════════════ */
function SwipeCard({
  user, isTop, stackIndex, onSwipe,
}: {
  user: SwipeCardSuggestion;
  isTop: boolean;
  stackIndex: number;
  onSwipe: (direction: "left" | "right" | "up") => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<{
    startX: number; startY: number; currentX: number; currentY: number; isDragging: boolean;
  } | null>(null);

  const deltaX = dragState ? dragState.currentX - dragState.startX : 0;
  const deltaY = dragState ? dragState.currentY - dragState.startY : 0;
  const rotation = deltaX * 0.06;

  const absDeltaX = Math.abs(deltaX);
  const absDeltaY = Math.abs(deltaY);
  const swipeDirection =
    absDeltaX > 40 ? (deltaX > 0 ? "right" : "left")
    : absDeltaY > 60 && deltaY < 0 ? "up" : null;

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isTop) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragState({ startX: e.clientX, startY: e.clientY, currentX: e.clientX, currentY: e.clientY, isDragging: true });
  }, [isTop]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState?.isDragging) return;
    setDragState((prev) => prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null);
  }, [dragState?.isDragging]);

  const handlePointerUp = useCallback(() => {
    if (!dragState?.isDragging) return;
    const dx = dragState.currentX - dragState.startX;
    const dy = dragState.currentY - dragState.startY;
    if (Math.abs(dx) > 100) onSwipe(dx > 0 ? "right" : "left");
    else if (dy < -100) onSwipe("up");
    setDragState(null);
  }, [dragState, onSwipe]);

  const scale = 1 - stackIndex * 0.05;
  const translateY = stackIndex * 10;

  const style: React.CSSProperties = isTop
    ? {
        transform: `translate(${deltaX}px, ${Math.min(deltaY, 0) * 0.3}px) rotate(${rotation}deg)`,
        zIndex: 10 - stackIndex,
        cursor: dragState?.isDragging ? "grabbing" : "grab",
        transition: dragState?.isDragging ? "none" : "transform 0.3s cubic-bezier(0.34,1.56,0.64,1)",
      }
    : {
        transform: `scale(${scale}) translateY(${translateY}px)`,
        zIndex: 10 - stackIndex,
        pointerEvents: "none" as const,
        transition: "transform 0.3s ease",
      };

  const skipOpacity = swipeDirection === "left" ? Math.min(absDeltaX / 80, 1) : 0;
  const connectOpacity = swipeDirection === "right" ? Math.min(absDeltaX / 80, 1) : 0;
  const viewOpacity = swipeDirection === "up" ? Math.min(absDeltaY / 80, 1) : 0;

  const initials = (user.displayName || "?")
    .split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div
      ref={cardRef}
      className="absolute inset-0 select-none touch-none rounded-3xl overflow-hidden shadow-xl"
      style={style}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      data-testid={`swipe-card-${user.userId}`}
    >
      {user.profilePicture ? (
        <img src={user.profilePicture} alt={user.displayName} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${getAvatarColor(user.displayName || "?")} flex items-center justify-center`}>
          <span className="text-8xl font-black text-white/20 select-none">{initials}</span>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

      {isTop && (
        <>
          <div className="absolute top-5 left-5 border-[3px] border-emerald-400 text-emerald-400 rounded-2xl px-4 py-2 text-base font-black -rotate-12 backdrop-blur-sm pointer-events-none" style={{ opacity: connectOpacity }}>
            CONNECT ✓
          </div>
          <div className="absolute top-5 right-5 border-[3px] border-rose-400 text-rose-400 rounded-2xl px-4 py-2 text-base font-black rotate-12 backdrop-blur-sm pointer-events-none" style={{ opacity: skipOpacity }}>
            SKIP ✕
          </div>
          <div className="absolute top-5 left-1/2 -translate-x-1/2 border-[3px] border-blue-400 text-blue-400 rounded-2xl px-4 py-2 text-base font-black backdrop-blur-sm pointer-events-none" style={{ opacity: viewOpacity }}>
            VIEW →
          </div>
        </>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
        <div className="flex items-end justify-between mb-1">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-2xl font-bold leading-tight" data-testid={`text-swipe-name-${user.userId}`}>
                {user.displayName}
              </h3>
              {user.isVerified && <CheckCircle className="w-5 h-5 text-blue-400 shrink-0" />}
            </div>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              <span className="text-xs font-semibold bg-white/20 backdrop-blur-sm rounded-full px-2.5 py-0.5 capitalize" data-testid={`badge-swipe-role-${user.userId}`}>
                {user.role}
              </span>
              {user.artType && (
                <span className="text-xs bg-white/15 backdrop-blur-sm rounded-full px-2.5 py-0.5 capitalize">
                  {user.artType}
                </span>
              )}
            </div>
            {user.bio && (
              <p className="text-sm text-white/80 line-clamp-2 leading-snug">{user.bio}</p>
            )}
            {user.city && (
              <p className="text-xs text-white/55 flex items-center gap-1 mt-1.5">
                <MapPin className="w-3 h-3" />Near {user.city}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   ENABLE DISCOVERY PROMPT
═══════════════════════════════════════ */
function EnableDiscoveryPrompt({ onEnable }: { onEnable: () => void }) {
  return (
    <div className="text-center py-14">
      <div className="relative inline-flex mb-6">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-1 ring-primary/20">
          <Sparkles className="w-9 h-9 text-primary" />
        </div>
        <span className="absolute -bottom-1 -right-1 text-xl">📍</span>
      </div>
      <h3 className="text-xl font-bold mb-2">Discover nearby people</h3>
      <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-7 leading-relaxed">
        Find artists, athletes, and urban culture enthusiasts in your area. Enable discovery to get started.
      </p>
      <Button onClick={onEnable} size="lg" className="rounded-full px-8 gap-2" data-testid="button-enable-discovery">
        <Zap className="w-4 h-4" />
        Enable Discovery
      </Button>
    </div>
  );
}

/* ═══════════════════════════════════════
   CONSENT MODAL
═══════════════════════════════════════ */
function ConsentModal({
  open, onAccept, onCancel, isPending,
}: {
  open: boolean;
  onAccept: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)] rounded-3xl p-0 gap-0" data-testid="modal-consent">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            Enable Nearby Discovery
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-2">
          <DialogDescription asChild>
            <div className="text-sm text-muted-foreground space-y-4 text-left">
              <p>Before enabling discovery, please understand how your location is used:</p>
              <div className="space-y-3">
                {[
                  "Only your approximate area (~1–3 km) is ever shared — never your exact location.",
                  "Your presence expires automatically after 2 hours with no location history stored.",
                  "You can go Ghost mode anytime to browse without being visible.",
                  "This consent can be withdrawn anytime from your settings.",
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle className="w-3 h-3 text-emerald-600" />
                    </div>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-start gap-2 p-3 rounded-xl bg-muted text-xs">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>Processed under GDPR Art. 6(1)(a) — your explicit consent. Withdraw anytime via Settings.</span>
              </div>
            </div>
          </DialogDescription>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onCancel} data-testid="button-consent-cancel" className="w-full sm:w-auto rounded-xl">
            Cancel
          </Button>
          <Button onClick={onAccept} disabled={isPending} data-testid="button-consent-accept" className="w-full sm:w-auto rounded-xl gap-2">
            <CheckCircle className="w-4 h-4" />
            I understand, enable
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
