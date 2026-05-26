import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import LeafletMapView from "./LeafletMapView";
import PlaceFinderModal from "./PlaceFinderModal";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { AIPremiumGate } from "@/components/ui/ai-premium-gate";
import { useAIAccess } from "@/hooks/useAIAccess";
import { useAuth } from "@/contexts/AuthContext";
import { Location } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import type { MapFilters, MapUser, CitySpot } from "./types";

export type { MapFilters, MapUser, CitySpot };

// Default viewport around Amsterdam (zoom 13 ≈ ±0.07° lat, ±0.12° lng)
const AMSTERDAM_VIEWPORT = { south: 52.28, north: 52.46, west: 4.77, east: 5.05 };

const MapView = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const { user } = useAuth();
  const aiAccess = useAIAccess();
  const [placeFinderOpen, setPlaceFinderOpen] = useState(false);
  const [aiGateOpen, setAiGateOpen] = useState(false);

  const searchParams = new URLSearchParams(window.location.search);
  const initialLat = searchParams.get("lat") ? parseFloat(searchParams.get("lat")!) : undefined;
  const initialLng = searchParams.get("lng") ? parseFloat(searchParams.get("lng")!) : undefined;
  const initialSpotId = searchParams.get("id") ? parseInt(searchParams.get("id")!) : undefined;

  const defaultCenter = {
    lat: initialLat ?? 52.3676,
    lng: initialLng ?? 4.9041,
  };

  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(defaultCenter);

  const [filters, setFilters] = useState<MapFilters>({
    showEvents: true,
    showSpots: true,
    showPeople: false,
    showCitySpots: true,
    categories: [],
    peopleRoles: [],
    citySpotCategories: [],
    eventCategories: [],
    distanceSort: false,
    openNow: false,
  });

  const { data: events = [] } = useQuery({ queryKey: ["/api/events/map"], staleTime: 15 * 60 * 1000 });
  const { data: locations = [] } = useQuery<Location[]>({ queryKey: ["/api/locations"], staleTime: 5 * 60 * 1000 });

  const { data: mapUsers = [], refetch: refetchMapUsers } = useQuery<MapUser[]>({
    queryKey: ["/api/proximity/map-users", mapCenter.lat, mapCenter.lng],
    queryFn: async () => {
      const res = await apiRequest(
        `/api/proximity/map-users?lat=${mapCenter.lat}&lng=${mapCenter.lng}&radius=10`,
        "GET"
      );
      return res.json();
    },
    enabled: filters.showPeople && !!user,
    staleTime: 30000,
    refetchInterval: filters.showPeople && !!user ? 60000 : false,
  });

  // Phase 1: Instant viewport query — serves only spots near the initial view (<200KB vs 6MB)
  // Gives users immediate map data while the full dataset loads in the background.
  const vp = initialLat !== undefined && initialLng !== undefined
    ? { south: initialLat - 0.15, north: initialLat + 0.15, west: initialLng - 0.2, east: initialLng + 0.2 }
    : AMSTERDAM_VIEWPORT;
  const { data: viewportSpots = [] } = useQuery<CitySpot[]>({
    queryKey: ["/api/city-spots/viewport", "initial", vp.south, vp.north, vp.west, vp.east],
    queryFn: async () => {
      const r = await fetch(`/api/city-spots/viewport?south=${vp.south}&north=${vp.north}&west=${vp.west}&east=${vp.east}&buf=0.5`);
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
    enabled: filters.showCitySpots,
  });

  // Phase 2: Full dataset — loads in the background, replaces viewport spots once ready
  const { data: allSpots = [] } = useQuery<CitySpot[]>({
    queryKey: ["/api/city-spots"],
    staleTime: 3 * 60 * 60 * 1000,
    refetchInterval: (query) => (!query.state.data || (query.state.data as CitySpot[]).length === 0) ? 12000 : false,
    enabled: filters.showCitySpots,
  });

  // Use the full dataset when available, fall back to viewport spots
  const citySpots = allSpots.length > 0 ? allSpots : viewportSpots;

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const { data: spotlights = [] } = useQuery<any[]>({
    queryKey: isAdmin ? ["/api/admin/city-spots/spotlights"] : ["/api/city-spots/spotlights"],
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (filters.showPeople && user) refetchMapUsers();
  }, [mapCenter.lat, mapCenter.lng, filters.showPeople, user]);

  const approvedLocations = Array.isArray(locations)
    ? locations.filter((loc: Location) =>
        loc.approvalStatus === "approved" &&
        loc.isVisible !== false &&
        loc.latitude &&
        loc.longitude
      )
    : [];

  const handleFindMySpot = () => {
    if (!user) return;
    if (aiAccess.hasAccess) {
      setPlaceFinderOpen(true);
    } else {
      setAiGateOpen(true);
    }
  };

  return (
    <div className="flex-1 w-full h-[calc(100vh-56px)] relative">
      <LeafletMapView
        events={events as any[]}
        locations={approvedLocations}
        mapUsers={filters.showPeople && user ? (mapUsers as MapUser[]) : []}
        citySpots={filters.showCitySpots ? (citySpots as CitySpot[]) : []}
        spotlights={spotlights}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filters={filters}
        setFilters={setFilters}
        onMapCenterChange={setMapCenter}
        isAuthenticated={!!user}
        isAdmin={isAdmin}
        onFindMySpot={user ? handleFindMySpot : undefined}
        initialLat={initialLat}
        initialLng={initialLng}
        initialSpotId={initialSpotId}
      />

      <PlaceFinderModal
        open={placeFinderOpen}
        onClose={() => setPlaceFinderOpen(false)}
        mapCenter={mapCenter}
      />

      {/* AI Premium Gate sheet — shown when user doesn't have AI access */}
      <Sheet open={aiGateOpen} onOpenChange={v => { if (!v) setAiGateOpen(false); }}>
        <SheetContent side="bottom" className="max-h-[80vh] rounded-t-2xl pb-8">
          <div className="mx-auto w-10 h-1 rounded-full bg-muted mb-4 mt-1" />
          <AIPremiumGate feature="Find My Spot" />
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default MapView;
