import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { GoogleMap, InfoWindow, Marker } from "@react-google-maps/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import usePlacesAutocomplete, { getGeocode, getLatLng } from "use-places-autocomplete";
import { queryClient } from "@/lib/queryClient";
import { Location, LocationType } from "@shared/schema";
import { MapFilters, MapUser } from "./MapView";
import { 
  MapPin, 
  Calendar, 
  Music, 
  Mic2, 
  Palette, 
  Drama, 
  Dumbbell,
  Filter,
  X,
  ChevronUp,
  ChevronDown,
  Navigation,
  Tag,
  Search,
  Users,
  User,
  MessageCircle,
  Eye,
  Plus,
  Compass,
  RefreshCw,
  Locate
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import AddLocationModal from "./AddLocationModal";
const breakdancerIcon = "/breakdancer-icon.webp";

const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

const defaultCenter = {
  lat: 52.3676,
  lng: 4.9041,
};

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: true,
  fullscreenControl: true,
};


const categoryConfig: Record<string, { color: string; icon: string; label: string }> = {
  [LocationType.GRAFFITI]: { color: "#FF4444", icon: "palette", label: "Graffiti" },
  [LocationType.DANCE]: { color: "#4488FF", icon: "dance", label: "Dance" },
  [LocationType.MUSIC]: { color: "#AA44FF", icon: "music", label: "Music" },
  [LocationType.RAP]: { color: "#FF44AA", icon: "mic", label: "Rap" },
  [LocationType.PERFORMANCE]: { color: "#44FFDD", icon: "drama", label: "Performance" },
  [LocationType.SKATE]: { color: "#44FF44", icon: "skate", label: "Skate" },
  [LocationType.PARKOUR]: { color: "#FFDD00", icon: "parkour", label: "Parkour" },
  [LocationType.TRAINING]: { color: "#FF8844", icon: "training", label: "Training" },
  [LocationType.BMX]: { color: "#44DDFF", icon: "bmx", label: "BMX" },
  [LocationType.STREET_SPORTS]: { color: "#228B22", icon: "sports", label: "Street Sports" },
  [LocationType.CULTURAL_HUB]: { color: "#FF6B6B", icon: "hub", label: "Cultural Hub" },
  [LocationType.OPEN_MIC]: { color: "#9B59B6", icon: "mic", label: "Open Mic" },
  [LocationType.WORKSHOP]: { color: "#E67E22", icon: "workshop", label: "Workshop" },
};

const getSpotIconSvg = (type: string, color: string): string => {
  const iconPaths: Record<string, string> = {
    palette: `<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.1 0 2-.9 2-2 0-.52-.2-1-.52-1.36-.32-.38-.5-.82-.5-1.3 0-1.1.9-2 2-2h2.36c3.08 0 5.64-2.56 5.64-5.64 0-4.9-4.48-8.7-9.98-8.7zM6.5 13c-.83 0-1.5-.67-1.5-1.5S5.67 10 6.5 10s1.5.67 1.5 1.5S7.33 13 6.5 13zm3-4c-.83 0-1.5-.67-1.5-1.5S8.67 6 9.5 6s1.5.67 1.5 1.5S10.33 9 9.5 9zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 6 14.5 6s1.5.67 1.5 1.5S15.33 9 14.5 9zm3 4c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" fill="white"/>`,
    dance: `<circle cx="12" cy="4" r="2" fill="white"/><path d="M15.89 8.11C15.5 7.72 14.83 7 13.53 7c-.21 0-1.42 0-2.53 1-.44-.22-.89-.42-1.35-.58C10.18 6.5 11 5.15 11 4c0-.36-.07-.71-.18-1.04L9.06 3.5C9.34 3.82 9.5 4.19 9.5 4.5c0 .52-.26.97-.65 1.24-.34-.05-.69-.1-1.04-.1-.56 0-1.11.08-1.64.2.25-.49.39-1.04.39-1.59 0-1.93-1.57-3.5-3.5-3.5S.56 2.32.56 4.25.63 6 1.06 6.25c-.61.61-1 1.45-1 2.38C.06 10.05 1.38 11 2.56 11c.27 0 .53-.05.79-.13L4 12.86l4.97-2.29c-.03.01-.03.02-.03.03L7 12l1.5 4.5 1.5.5.5-3 2-1V9l-1.39-.61c.9.04 1.39.61 1.39.61l3-3z" fill="white"/>`,
    music: `<path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" fill="white"/>`,
    mic: `<path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15a.998.998 0 00-.98-.85c-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V21c0 .55.45 1 1 1s1-.45 1-1v-3.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" fill="white"/>`,
    drama: `<path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM8.5 8c.83 0 1.5.67 1.5 1.5S9.33 11 8.5 11 7 10.33 7 9.5 7.67 8 8.5 8zm8 7.5c0 1.9-2.5 3.5-4.5 3.5s-4.5-1.6-4.5-3.5h9zm-.5-4c-.83 0-1.5-.67-1.5-1.5S15.17 8 16 8s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" fill="white"/>`,
    skate: `<path d="M19 7c0-1.1-.9-2-2-2h-3v2h3v2.65L13.52 14H10V9H6c-1.1 0-2 .9-2 2v3c0 1.1.9 2 2 2h1c0 1.66 1.34 3 3 3s3-1.34 3-3h1.52c.61 0 1.18-.28 1.56-.73l4.15-4.94c.05-.06.77-1 .77-1.83V7zM10 17c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm8-4.54l-2.62 3.11H13v-2.65l4-4.65V12.46z" fill="white"/>`,
    parkour: `<circle cx="12" cy="4" r="2" fill="white"/><path d="M5 22v-5l2.5-4.5L9 15l3-3-2-7h3l1 5 4-5 1.5 1.5L14 12l2 5-3 3v2h-2v-3l2.5-2.5-2-5L7 16l-1 6H5z" fill="white"/>`,
    training: `<path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z" fill="white"/>`,
    bmx: `<path d="M18.18 10l-1.7-4.68C16.19 4.53 15.44 4 14.6 4H12v2h2.6l1.46 4h-4.81l-.36-1H12V7H7v2h1.75l1.82 5H9.9c-.44-2.23-2.31-3.88-4.65-3.99C2.45 9.87 0 12.2 0 15c0 2.8 2.2 5 5 5 2.46 0 4.45-1.69 4.9-4h4.2c.44 2.23 2.31 3.88 4.65 3.99 2.8.13 5.25-2.19 5.25-5C24 12.2 21.8 10 19 10h-.82zM7.82 16c-.4 1.17-1.49 2-2.82 2-1.68 0-3-1.32-3-3s1.32-3 3-3c1.33 0 2.42.83 2.82 2H5v2h2.82zm6.28-2h-1.4l-.73-2H15c-.44.58-.76 1.25-.9 2zm4.9 4c-1.68 0-3-1.32-3-3 0-.93.41-1.73 1.05-2.28l.96 2.64 1.88-.68-.97-2.67c.03 0 .06-.01.08-.01 1.68 0 3 1.32 3 3s-1.32 3-3 3z" fill="white"/>`,
    sports: `<circle cx="12" cy="12" r="10" fill="none" stroke="white" stroke-width="2"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.38 0 2.5 1.12 2.5 2.5 0 .74-.33 1.39-.83 1.85l3.63 3.62c.19-.45.7-.97.7-1.97 0-1.38-1.12-2.5-2.5-2.5-.42 0-.8.11-1.15.29L12.5 7.5 9.71 10.29c-.63-.18-1.22-.29-1.71-.29-1.38 0-2.5 1.12-2.5 2.5 0 1 .51 1.52.7 1.97l3.63-3.62c-.5-.46-.83-1.11-.83-1.85 0-1.38 1.12-2.5 2.5-2.5z" fill="white"/>`,
    hub: `<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" fill="none" stroke="white" stroke-width="2"/>`,
    workshop: `<path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" fill="white"/>`,
  };

  const iconPath = iconPaths[categoryConfig[type]?.icon] || iconPaths.palette;
  
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="56" viewBox="0 0 48 56">
      <path d="M24 0C10.75 0 0 10.75 0 24c0 18 24 32 24 32s24-14 24-32C48 10.75 37.25 0 24 0z" 
            fill="${color}" stroke="white" stroke-width="2"/>
      <g transform="translate(12, 12) scale(1)">
        ${iconPath}
      </g>
    </svg>
  `;
};

const getEventIconSvg = (category: string): string => {
  const categoryColors: Record<string, string> = {
    battle: "#FFD800",
    competition: "#FF4444",
    workshop: "#44FF88",
    jam: "#FF88FF",
    showcase: "#44DDFF",
    cypher: "#FF8844",
    default: "#FFD800",
  };
  
  const color = categoryColors[category?.toLowerCase()] || categoryColors.default;
  
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="56" viewBox="0 0 48 56">
      <path d="M24 0C10.75 0 0 10.75 0 24c0 18 24 32 24 32s24-14 24-32C48 10.75 37.25 0 24 0z" 
            fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="24" cy="20" r="12" fill="white" opacity="0.25"/>
      <g transform="translate(12, 10)">
        <circle cx="9" cy="4" r="2" fill="white"/>
        <path d="M16.5 17.5c-1.38 0-2.5 1.12-2.5 2.5s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5-1.12-2.5-2.5-2.5zm-9 0C6.12 17.5 5 18.62 5 20s1.12 2.5 2.5 2.5S10 21.38 10 20s-1.12-2.5-2.5-2.5zM6 8l2.5 4 3-1.5L13 15l2-1.5-1.5-4.5L17 7l-1.5-1.5L12 7 10 5.5 6 8z" fill="white"/>
      </g>
    </svg>
  `;
};

interface GoogleMapViewProps {
  events: any[];
  locations: Location[];
  mapUsers?: MapUser[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filters: MapFilters;
  setFilters: (filters: MapFilters) => void;
  onMapCenterChange?: (center: { lat: number; lng: number }) => void;
  isAuthenticated?: boolean;
}

type SearchResultType = 'address' | 'spot' | 'event' | 'category';

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

const roleConfig: Record<string, { color: string; label: string }> = {
  artist: { color: "#E91E63", label: "Artist" },
  athlete: { color: "#4CAF50", label: "Athlete" },
  dj: { color: "#9C27B0", label: "DJ" },
  mc: { color: "#FF9800", label: "MC" },
  dancer: { color: "#2196F3", label: "Dancer" },
  musician: { color: "#673AB7", label: "Musician" },
  photographer: { color: "#00BCD4", label: "Photographer" },
  videographer: { color: "#795548", label: "Videographer" },
  producer: { color: "#607D8B", label: "Producer" },
  promoter: { color: "#F44336", label: "Promoter" },
  organizer: { color: "#3F51B5", label: "Organizer" },
  fan: { color: "#8BC34A", label: "Fan" },
};

const getUserMarkerSvg = (displayName: string, role: string | null): string => {
  const color = roleConfig[role?.toLowerCase() || '']?.color || '#2196F3';
  const initial = (displayName || '?').charAt(0).toUpperCase();
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48">
      <path d="M20 0C8.95 0 0 8.95 0 20c0 15 20 28 20 28s20-13 20-28C40 8.95 31.05 0 20 0z" 
            fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="20" cy="18" r="11" fill="white"/>
      <text x="20" y="23" text-anchor="middle" font-size="14" font-weight="bold" fill="${color}" font-family="Arial, sans-serif">${initial}</text>
    </svg>
  `;
};

const GoogleMapView = ({ 
  events,
  locations,
  mapUsers = [],
  searchQuery, 
  setSearchQuery,
  filters,
  setFilters,
  onMapCenterChange,
  isAuthenticated = false,
}: GoogleMapViewProps) => {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [selectedBattle, setSelectedBattle] = useState<any | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<Location | null>(null);
  const [selectedMapUser, setSelectedMapUser] = useState<MapUser | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [mapZoom, setMapZoom] = useState(13);
  const mapRef = useRef<google.maps.Map | null>(null);

  const {
    ready,
    value,
    suggestions: { status, data },
    setValue,
    clearSuggestions,
  } = usePlacesAutocomplete({
    requestOptions: {
      componentRestrictions: { country: 'nl' },
    },
    debounce: 300,
  });

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    setMapLoaded(true);
  }, []);

  const handleSelect = async (description: string) => {
    setValue(description, false);
    clearSuggestions();
    setSearchQuery(description);

    try {
      const results = await getGeocode({ address: description });
      const { lat, lng } = await getLatLng(results[0]);
      setMapCenter({ lat, lng });
      setMapZoom(15);
    } catch (error) {
      console.error("Error: ", error);
    }
  };

  const handleGetCurrentLocation = () => {
    console.log("Get current location button clicked");
    
    if (!navigator.geolocation) {
      console.log("Geolocation not supported");
      toast({
        title: "Geolocation not supported",
        description: "Your browser does not support geolocation",
        variant: "destructive",
      });
      return;
    }
    
    console.log("Requesting geolocation...");
    toast({
      title: "Getting location...",
      description: "Please allow location access when prompted.",
    });
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("Geolocation success:", position.coords);
        const currentPosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(currentPosition);
        setMapCenter(currentPosition);
        setMapZoom(16);
        
        toast({
          title: "Location found",
          description: "Your current location has been set on the map.",
        });
      },
      (error) => {
        console.log("Geolocation error:", error.code, error.message);
        let errorMessage = "Unable to get your current location";
        
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location access was denied. Please enable location permissions in your browser.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable.";
            break;
          case error.TIMEOUT:
            errorMessage = "The request to get your location timed out.";
            break;
        }
        
        toast({
          title: "Location error",
          description: errorMessage,
          variant: "destructive",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const toggleCategory = (category: string) => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter(c => c !== category)
      : [...filters.categories, category];
    setFilters({ ...filters, categories: newCategories });
  };

  const parseCoordinate = useCallback((value: any): number => {
    if (typeof value === 'number') return value;
    return parseFloat(String(value || ''));
  }, []);

  const isValidCoordinate = useCallback((lat: any, lng: any): boolean => {
    const parsedLat = typeof lat === 'number' ? lat : parseFloat(lat);
    const parsedLng = typeof lng === 'number' ? lng : parseFloat(lng);
    return !isNaN(parsedLat) && !isNaN(parsedLng) && 
           Math.abs(parsedLat) <= 90 && Math.abs(parsedLng) <= 180;
  }, []);

  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const localSearchResults = useMemo((): SearchResult[] => {
    if (!value || value.length < 2) return [];
    
    const searchTerm = value.toLowerCase().trim();
    const results: SearchResult[] = [];
    
    const matchingCategories = Object.entries(categoryConfig)
      .filter(([key, config]) => 
        config.label.toLowerCase().includes(searchTerm) ||
        key.toLowerCase().includes(searchTerm)
      )
      .slice(0, 3)
      .map(([key, config]) => ({
        id: `cat-${key}`,
        type: 'category' as SearchResultType,
        title: config.label,
        subtitle: 'Filter by category',
        category: key,
        color: config.color
      }));
    results.push(...matchingCategories);
    
    const matchingSpots = (locations || [])
      .filter(spot => 
        spot.name?.toLowerCase().includes(searchTerm) ||
        spot.address?.toLowerCase().includes(searchTerm) ||
        spot.description?.toLowerCase().includes(searchTerm)
      )
      .slice(0, 5)
      .map(spot => ({
        id: `spot-${spot.id}`,
        type: 'spot' as SearchResultType,
        title: spot.name || 'Unknown Spot',
        subtitle: spot.address || categoryConfig[spot.type as string]?.label || 'Spot',
        lat: parseFloat(String(spot.latitude)),
        lng: parseFloat(String(spot.longitude)),
        category: spot.type as string,
        color: categoryConfig[spot.type as string]?.color
      }));
    results.push(...matchingSpots);
    
    const matchingEvents = (events || [])
      .filter(event => 
        event.title?.toLowerCase().includes(searchTerm) ||
        event.location?.toLowerCase().includes(searchTerm) ||
        event.description?.toLowerCase().includes(searchTerm)
      )
      .slice(0, 5)
      .map(event => ({
        id: `event-${event.id}`,
        type: 'event' as SearchResultType,
        title: event.title || 'Unknown Event',
        subtitle: event.location || event.date || 'Event',
        lat: parseFloat(String(event.latitude)),
        lng: parseFloat(String(event.longitude)),
        category: event.category
      }));
    results.push(...matchingEvents);
    
    return results;
  }, [value, locations, events]);

  const handleSearchResultSelect = (result: SearchResult) => {
    if (result.type === 'category') {
      setFilters({ 
        showEvents: true, 
        showSpots: true,
        showPeople: filters.showPeople,
        categories: [result.category!],
        peopleRoles: filters.peopleRoles,
      });
      toast({
        title: `Filter applied`,
        description: `Showing ${result.title} locations`,
      });
    } else {
      const lat = parseCoordinate(result.lat);
      const lng = parseCoordinate(result.lng);
      
      if (isValidCoordinate(lat, lng)) {
        setMapCenter({ lat, lng });
        setMapZoom(16);
        
        if (result.type === 'spot') {
          const spot = locations.find(l => `spot-${l.id}` === result.id);
          if (spot) {
            setSelectedSpot(spot);
            setSelectedBattle(null);
          }
        } else if (result.type === 'event') {
          const event = events.find(e => `event-${e.id}` === result.id);
          if (event) {
            setSelectedBattle(event);
            setSelectedSpot(null);
          }
        }
      }
    }
    
    setValue(result.title, false);
    setSearchQuery(result.title);
    setShowSearchResults(false);
    clearSuggestions();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    setSearchQuery(e.target.value);
    setShowSearchResults(true);
  };

  const handleClearSearch = () => {
    setValue('');
    setSearchQuery('');
    clearSuggestions();
    setShowSearchResults(false);
  };

  const createUserLocationMarker = useCallback(() => {
    if (!userLocation || !window.google?.maps?.marker?.AdvancedMarkerElement || !mapRef.current) {
      return null;
    }
    
    try {
      const userDot = document.createElement('div');
      userDot.className = 'user-location-marker';
      userDot.style.cssText = `
        width: 20px;
        height: 20px;
        background-color: #3B82F6;
        border-radius: 50%;
        box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.25);
        animation: pulse 2s infinite;
        position: relative;
        border: 3px solid white;
      `;
      
      if (!document.getElementById('user-marker-animation')) {
        const style = document.createElement('style');
        style.id = 'user-marker-animation';
        style.textContent = `
          @keyframes pulse {
            0% {
              box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
            }
            70% {
              box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
            }
            100% {
              box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
            }
          }
        `;
        document.head.appendChild(style);
      }
      
      const advancedUserMarker = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position: userLocation,
        content: userDot,
        title: 'Your Location',
        zIndex: 1000,
      });
      
      return advancedUserMarker;
    } catch (error) {
      console.error("Error creating user location marker:", error);
      return null;
    }
  }, [userLocation, mapRef]);
  
  const [userLocationMarker, setUserLocationMarker] = useState<any>(null);
  
  useEffect(() => {
    if (userLocationMarker) {
      userLocationMarker.map = null;
    }
    
    const newUserMarker = createUserLocationMarker();
    setUserLocationMarker(newUserMarker);
    
    return () => {
      if (newUserMarker) {
        newUserMarker.map = null;
      }
    };
  }, [createUserLocationMarker]);

  const createBattleMarker = useCallback((battle: any) => {
    if (!window.google?.maps?.marker?.AdvancedMarkerElement || !mapRef.current) return null;
    
    try {
      const position = {
        lat: parseFloat(battle.latitude),
        lng: parseFloat(battle.longitude),
      };
      
      const markerContainer = document.createElement('div');
      markerContainer.className = 'battle-marker-container';
      markerContainer.style.cssText = `
        position: relative;
        cursor: pointer;
        transform-origin: center bottom;
      `;
      
      const breakdancerImg = document.createElement('img');
      breakdancerImg.src = breakdancerIcon;
      breakdancerImg.alt = 'Event';
      breakdancerImg.className = 'battle-breakdancer';
      breakdancerImg.style.cssText = `
        width: 50px;
        height: 50px;
        object-fit: contain;
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
        transition: transform 0.2s ease;
        position: relative;
        z-index: 2;
      `;
      
      if (!document.getElementById('battle-marker-animations')) {
        const style = document.createElement('style');
        style.id = 'battle-marker-animations';
        style.textContent = `
          @keyframes spotPulse {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.05);
            }
          }
        `;
        document.head.appendChild(style);
      }
      
      markerContainer.appendChild(breakdancerImg);
      
      markerContainer.addEventListener('mouseenter', () => {
        breakdancerImg.style.transform = 'scale(1.1)';
      });
      
      markerContainer.addEventListener('mouseleave', () => {
        breakdancerImg.style.transform = 'scale(1)';
      });
      
      const advancedMarker = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position: position,
        content: markerContainer,
        title: battle.title || 'Battle Event',
        zIndex: 500,
      });
      
      markerContainer.addEventListener('click', () => {
        setSelectedBattle(battle);
        setSelectedSpot(null);
      });
      
      return advancedMarker;
    } catch (error) {
      console.error("Error creating battle marker:", error);
      return null;
    }
  }, [mapRef]);

  const createSpotMarker = useCallback((spot: Location) => {
    if (!window.google?.maps?.marker?.AdvancedMarkerElement || !mapRef.current) return null;
    
    try {
      const position = {
        lat: parseFloat(spot.latitude as any),
        lng: parseFloat(spot.longitude as any),
      };
      
      const config = categoryConfig[spot.type as string] || { color: "#888888", icon: "palette", label: "Other" };
      
      const markerContainer = document.createElement('div');
      markerContainer.className = 'spot-marker-container';
      markerContainer.style.cssText = `
        cursor: pointer;
        transition: transform 0.3s ease;
      `;
      
      const svgString = getSpotIconSvg(spot.type as string, config.color);
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
      markerContainer.appendChild(svgDoc.documentElement);
      
      markerContainer.addEventListener('mouseenter', () => {
        markerContainer.style.transform = 'scale(1.1) translateY(-3px)';
      });
      
      markerContainer.addEventListener('mouseleave', () => {
        markerContainer.style.transform = 'scale(1)';
      });
      
      const advancedMarker = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position: position,
        content: markerContainer,
        title: spot.name || 'Spot',
        zIndex: 400,
      });
      
      markerContainer.addEventListener('click', () => {
        setSelectedSpot(spot);
        setSelectedBattle(null);
      });
      
      return advancedMarker;
    } catch (error) {
      console.error("Error creating spot marker:", error);
      return null;
    }
  }, [mapRef]);

  const [advancedMarkers, setAdvancedMarkers] = useState<any[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  const getEventCategories = useCallback((event: any): string[] => {
    if (!event.category) return [];
    if (Array.isArray(event.category)) return event.category.map((c: string) => c?.toLowerCase() || '');
    return [String(event.category).toLowerCase()];
  }, []);

  const filteredEvents = useMemo(() => {
    if (!filters.showEvents || !Array.isArray(events)) return [];
    return events.filter(event => {
      if (!isValidCoordinate(event.latitude, event.longitude)) return false;
      if (filters.categories.length === 0) return true;
      const eventCategories = getEventCategories(event);
      return filters.categories.some(cat => 
        eventCategories.some(ec => ec.includes(cat.toLowerCase()))
      );
    });
  }, [events, filters.showEvents, filters.categories, isValidCoordinate, getEventCategories]);

  const filteredLocations = useMemo(() => {
    if (!filters.showSpots || !Array.isArray(locations)) return [];
    return locations.filter(spot => {
      if (!isValidCoordinate(spot.latitude, spot.longitude)) return false;
      if (filters.categories.length === 0) return true;
      const spotType = String(spot.type || '').toLowerCase();
      return filters.categories.some(cat => spotType === cat.toLowerCase());
    });
  }, [locations, filters.showSpots, filters.categories, isValidCoordinate]);

  const filteredMapUsers = useMemo(() => {
    if (!filters.showPeople || !Array.isArray(mapUsers)) return [];
    return mapUsers.filter(u => {
      if (filters.peopleRoles.length === 0) return true;
      const userRole = (u.role || '').toLowerCase();
      return filters.peopleRoles.some(r => r.toLowerCase() === userRole);
    });
  }, [mapUsers, filters.showPeople, filters.peopleRoles]);

  const togglePeopleRole = (role: string) => {
    const newRoles = filters.peopleRoles.includes(role)
      ? filters.peopleRoles.filter(r => r !== role)
      : [...filters.peopleRoles, role];
    setFilters({ ...filters, peopleRoles: newRoles });
  };

  const handleMapIdle = useCallback(() => {
    if (mapRef.current && onMapCenterChange) {
      const center = mapRef.current.getCenter();
      if (center) {
        onMapCenterChange({ lat: center.lat(), lng: center.lng() });
      }
    }
  }, [onMapCenterChange]);

  const hasAdvancedMarkers = useMemo(() => {
    return false;
  }, [mapLoaded]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    if (!hasAdvancedMarkers) return;
    
    advancedMarkers.forEach(marker => {
      if (marker && marker.map) {
        marker.map = null;
      }
    });
    
    let allMarkers: any[] = [];
    
    const battleMarkers = filteredEvents
      .map(event => createBattleMarker(event))
      .filter(Boolean);
    allMarkers = [...allMarkers, ...battleMarkers];
    
    const spotMarkers = filteredLocations
      .map(spot => createSpotMarker(spot))
      .filter(Boolean);
    allMarkers = [...allMarkers, ...spotMarkers];
    
    setAdvancedMarkers(allMarkers);
    
    return () => {
      allMarkers.forEach(marker => {
        if (marker && marker.map) {
          marker.map = null;
        }
      });
    };
  }, [filteredEvents, filteredLocations, createBattleMarker, createSpotMarker, mapLoaded, hasAdvancedMarkers]);

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    
    const allItems = [
      ...filteredEvents.map(e => ({ 
        lat: parseCoordinate(e.latitude), 
        lng: parseCoordinate(e.longitude) 
      })),
      ...filteredLocations.map(s => ({ 
        lat: parseCoordinate(s.latitude), 
        lng: parseCoordinate(s.longitude) 
      }))
    ].filter(item => !isNaN(item.lat) && !isNaN(item.lng) && 
                      Math.abs(item.lat) <= 90 && Math.abs(item.lng) <= 180);

    if (allItems.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      allItems.forEach(item => {
        bounds.extend(item);
      });

      mapRef.current.fitBounds(bounds);
      
      setTimeout(() => {
        if (mapRef.current) {
          const zoom = mapRef.current.getZoom();
          if (zoom !== undefined && zoom > 16) {
            mapRef.current.setZoom(16);
          }
        }
      }, 100);
    } else {
      mapRef.current.setCenter({ lat: 52.3676, lng: 4.9041 });
      mapRef.current.setZoom(13);
    }
  }, [filteredEvents, filteredLocations, mapLoaded]);

  const allCategories = Object.entries(categoryConfig).map(([key, value]) => ({
    id: key,
    ...value
  }));

  return (
    <div className="relative h-full">
      <div ref={searchContainerRef} className="absolute top-2 sm:top-4 left-2 sm:left-4 right-2 sm:right-4 px-2 sm:px-0 z-10">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative flex items-center gap-1 sm:gap-2 rounded-lg overflow-hidden shadow-md border border-border bg-background max-w-3xl mx-auto"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 sm:h-5 w-4 sm:w-5 text-muted-foreground ml-2 sm:ml-3 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          
          <Input
            value={value}
            onChange={handleInputChange}
            onFocus={() => setShowSearchResults(true)}
            disabled={!ready}
            placeholder="Search spots, events, addresses..."
            className="hidden sm:block w-full bg-transparent border-none focus:outline-none focus-visible:ring-0 px-1 sm:px-2 py-2 sm:py-3 text-sm"
            data-testid="input-map-search"
          />
          <Input
            value={value}
            onChange={handleInputChange}
            onFocus={() => setShowSearchResults(true)}
            disabled={!ready}
            placeholder="Search..."
            className="sm:hidden w-full bg-transparent border-none focus:outline-none focus-visible:ring-0 px-1 py-2 text-sm"
            data-testid="input-map-search-mobile"
          />
          
          {value && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClearSearch}
              className="shrink-0 z-10"
              data-testid="button-clear-search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 mr-1 text-muted-foreground hover:text-primary"
            onClick={handleGetCurrentLocation}
            aria-label="Get current location"
            data-testid="button-get-location"
          >
            <MapPin className="h-4 w-4" />
          </Button>
        </motion.div>
        
        {showSearchResults && (
          <div 
            className="mt-2 rounded-lg shadow-lg overflow-hidden border border-border bg-background z-20 max-w-3xl mx-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b border-border">
              <div className="flex items-center gap-2 mb-2">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  Show on map
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setFilters({ ...filters, showEvents: !filters.showEvents });
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                    filters.showEvents
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                  }`}
                  data-testid="button-filter-events"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  Events
                </button>
                
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setFilters({ ...filters, showSpots: !filters.showSpots });
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                    filters.showSpots
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                  }`}
                  data-testid="button-filter-spots"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Spots
                </button>

                {isAuthenticated && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setFilters({ ...filters, showPeople: !filters.showPeople });
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      filters.showPeople
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                    }`}
                    data-testid="button-filter-people"
                  >
                    <Users className="h-3.5 w-3.5" />
                    People
                  </button>
                )}
              </div>
              
              <div className="mt-2.5">
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  Categories
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {allCategories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        toggleCategory(cat.id);
                      }}
                      className={`px-2 py-0.5 rounded text-xs font-medium border transition-all ${
                        filters.categories.includes(cat.id)
                          ? 'text-white shadow-sm border-transparent'
                          : 'bg-muted text-muted-foreground border-transparent hover:bg-muted/80'
                      }`}
                      style={filters.categories.includes(cat.id) ? { backgroundColor: cat.color } : {}}
                      data-testid={`button-filter-category-${cat.id}`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {filters.showPeople && (
                <div className="mt-2.5">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    People Roles
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {Object.entries(roleConfig).map(([key, config]) => (
                      <button
                        key={key}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          togglePeopleRole(key);
                        }}
                        className={`px-2 py-0.5 rounded text-xs font-medium border transition-all ${
                          filters.peopleRoles.includes(key)
                            ? 'text-white shadow-sm border-transparent'
                            : 'bg-muted text-muted-foreground border-transparent hover:bg-muted/80'
                        }`}
                        style={filters.peopleRoles.includes(key) ? { backgroundColor: config.color } : {}}
                        data-testid={`button-filter-role-${key}`}
                      >
                        {config.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {(localSearchResults.length > 0 || status === "OK") && (
            <ScrollArea className="max-h-56">
              {localSearchResults.length > 0 && (
                <div className="border-b border-border">
                  {localSearchResults.filter(r => r.type === 'category').length > 0 && (
                    <>
                      <div className="px-3 py-1.5 text-xs font-semibold uppercase text-muted-foreground bg-muted/50">
                        <Tag className="h-3 w-3 inline mr-1.5" />
                        Categories
                      </div>
                      {localSearchResults.filter(r => r.type === 'category').map((result) => (
                        <div
                          key={result.id}
                          onClick={() => handleSearchResultSelect(result)}
                          className="p-2.5 sm:p-3 cursor-pointer flex items-center gap-2 transition-colors hover:bg-muted"
                          data-testid={`search-result-${result.id}`}
                        >
                          <div 
                            className="w-3 h-3 rounded-full shrink-0" 
                            style={{ backgroundColor: result.color }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate text-foreground">{result.title}</p>
                            <p className="text-xs truncate text-muted-foreground">{result.subtitle}</p>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                  
                  {localSearchResults.filter(r => r.type === 'spot').length > 0 && (
                    <>
                      <div className="px-3 py-1.5 text-xs font-semibold uppercase text-muted-foreground bg-muted/50">
                        <MapPin className="h-3 w-3 inline mr-1.5" />
                        Spots
                      </div>
                      {localSearchResults.filter(r => r.type === 'spot').map((result) => (
                        <div
                          key={result.id}
                          onClick={() => handleSearchResultSelect(result)}
                          className="p-2.5 sm:p-3 cursor-pointer flex items-center gap-2 transition-colors hover:bg-muted"
                          data-testid={`search-result-${result.id}`}
                        >
                          <div 
                            className="w-3 h-3 rounded-full shrink-0" 
                            style={{ backgroundColor: result.color || '#4488FF' }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate text-foreground">{result.title}</p>
                            <p className="text-xs truncate text-muted-foreground">{result.subtitle}</p>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                  
                  {localSearchResults.filter(r => r.type === 'event').length > 0 && (
                    <>
                      <div className="px-3 py-1.5 text-xs font-semibold uppercase text-muted-foreground bg-muted/50">
                        <Calendar className="h-3 w-3 inline mr-1.5" />
                        Events
                      </div>
                      {localSearchResults.filter(r => r.type === 'event').map((result) => (
                        <div
                          key={result.id}
                          onClick={() => handleSearchResultSelect(result)}
                          className="p-2.5 sm:p-3 cursor-pointer flex items-center gap-2 transition-colors hover:bg-muted"
                          data-testid={`search-result-${result.id}`}
                        >
                          <Calendar className="h-4 w-4 shrink-0 text-primary" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate text-foreground">{result.title}</p>
                            <p className="text-xs truncate text-muted-foreground">{result.subtitle}</p>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
              
              {status === "OK" && data.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold uppercase text-muted-foreground bg-muted/50">
                    <Navigation className="h-3 w-3 inline mr-1.5" />
                    Addresses
                  </div>
                  {data.map(({ description, place_id }) => (
                    <div
                      key={place_id}
                      onClick={() => {
                        handleSelect(description);
                        setShowSearchResults(false);
                      }}
                      className="p-2.5 sm:p-3 cursor-pointer flex items-center gap-2 transition-colors hover:bg-muted"
                      data-testid={`search-result-address-${place_id}`}
                    >
                      <Navigation className="h-4 w-4 shrink-0 text-primary" />
                      <p className="text-sm truncate text-foreground">{description}</p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            )}
          </div>
        )}
      </div>

      {(filters.categories.length > 0 || filters.peopleRoles.length > 0 || !filters.showEvents || !filters.showSpots || filters.showPeople) && (
        <div className="absolute top-16 sm:top-20 left-2 sm:left-4 right-2 sm:right-4 z-10">
          <div className="max-w-3xl mx-auto flex flex-wrap items-center gap-1.5 sm:gap-2">
            {!filters.showEvents && (
              <Badge 
                variant="outline" 
                className="text-xs cursor-pointer bg-white/90 border-gray-300"
                onClick={() => setFilters({ ...filters, showEvents: true })}
                data-testid="badge-filter-events-off"
              >
                <Calendar className="h-3 w-3 mr-1 opacity-50" />
                <span className="line-through opacity-50">Events</span>
                <X className="h-3 w-3 ml-1" />
              </Badge>
            )}
            {!filters.showSpots && (
              <Badge 
                variant="outline" 
                className="text-xs cursor-pointer bg-white/90 border-gray-300"
                onClick={() => setFilters({ ...filters, showSpots: true })}
                data-testid="badge-filter-spots-off"
              >
                <MapPin className="h-3 w-3 mr-1 opacity-50" />
                <span className="line-through opacity-50">Spots</span>
                <X className="h-3 w-3 ml-1" />
              </Badge>
            )}
            {filters.showPeople && (
              <Badge 
                variant="outline" 
                className={`text-xs cursor-pointer bg-white/90 border-gray-300`}
                onClick={() => setFilters({ ...filters, showPeople: false, peopleRoles: [] })}
                data-testid="badge-filter-people-on"
              >
                <Users className="h-3 w-3 mr-1" />
                People
                <X className="h-3 w-3 ml-1" />
              </Badge>
            )}
            {filters.categories.map(cat => {
              const config = categoryConfig[cat];
              return (
                <Badge 
                  key={cat}
                  className="text-xs cursor-pointer text-white"
                  style={{ backgroundColor: config?.color || '#888' }}
                  onClick={() => toggleCategory(cat)}
                  data-testid={`badge-active-category-${cat}`}
                >
                  {config?.label || cat}
                  <X className="h-3 w-3 ml-1" />
                </Badge>
              );
            })}
            {filters.peopleRoles.map(role => {
              const config = roleConfig[role];
              return (
                <Badge 
                  key={`role-${role}`}
                  className="text-xs cursor-pointer text-white"
                  style={{ backgroundColor: config?.color || '#888' }}
                  onClick={() => togglePeopleRole(role)}
                  data-testid={`badge-active-role-${role}`}
                >
                  {config?.label || role}
                  <X className="h-3 w-3 ml-1" />
                </Badge>
              );
            })}
            {(filters.categories.length > 0 || filters.peopleRoles.length > 0 || !filters.showEvents || !filters.showSpots) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-red-600"
                onClick={() => setFilters({ showEvents: true, showSpots: true, showPeople: false, categories: [], peopleRoles: [] })}
                data-testid="button-clear-all-filters"
              >
                Clear all
              </Button>
            )}
          </div>
        </div>
      )}

      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={mapCenter}
        zoom={mapZoom}
        options={mapOptions}
        onLoad={onMapLoad}
        onIdle={handleMapIdle}
      >
        {!hasAdvancedMarkers && filteredEvents.map((event: any) => {
          const lat = parseCoordinate(event.latitude);
          const lng = parseCoordinate(event.longitude);
          if (isNaN(lat) || isNaN(lng)) return null;
          return (
            <Marker
              key={`battle-${event.id}`}
              position={{ lat, lng }}
              onClick={() => {
                setSelectedBattle(event);
                setSelectedSpot(null);
              }}
              icon={{
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(getEventIconSvg(event.category)),
                scaledSize: new google.maps.Size(48, 56),
                anchor: new google.maps.Point(24, 56),
              }}
              animation={google.maps.Animation.DROP}
            />
          );
        })}

        {!hasAdvancedMarkers && filteredLocations.map((spot) => {
          const lat = parseCoordinate(spot.latitude);
          const lng = parseCoordinate(spot.longitude);
          if (isNaN(lat) || isNaN(lng)) return null;
          const config = categoryConfig[spot.type as string] || { color: "#888888" };
          return (
            <Marker
              key={`spot-${spot.id}`}
              position={{ lat, lng }}
              onClick={() => {
                setSelectedSpot(spot);
                setSelectedBattle(null);
              }}
              icon={{
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(getSpotIconSvg(spot.type as string, config.color)),
                scaledSize: new google.maps.Size(48, 56),
                anchor: new google.maps.Point(24, 56),
              }}
            />
          );
        })}

        {userLocation && !hasAdvancedMarkers && (
          <Marker
            position={userLocation}
            icon={{
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="8" fill="#3B82F6" stroke="white" stroke-width="3"/>
                  <circle cx="12" cy="12" r="11" fill="none" stroke="#3B82F6" stroke-width="1" opacity="0.3"/>
                </svg>
              `),
              scaledSize: new google.maps.Size(24, 24),
              anchor: new google.maps.Point(12, 12),
            }}
          />
        )}

        {selectedBattle && isValidCoordinate(selectedBattle.latitude, selectedBattle.longitude) && (
          <InfoWindow
            position={{
              lat: parseCoordinate(selectedBattle.latitude),
              lng: parseCoordinate(selectedBattle.longitude),
            }}
            onCloseClick={() => setSelectedBattle(null)}
          >
            <div className="p-3 max-w-sm">
              <h3 className="font-bold text-gray-900 text-lg mb-1">{selectedBattle.title}</h3>
              <Badge className="mb-2">
                {selectedBattle.category || 'Battle Event'}
              </Badge>
              
              <div className="space-y-2 text-sm">
                <p className="text-gray-600">{selectedBattle.description}</p>
                <div className="flex items-center text-gray-700">
                  <Calendar className="h-4 w-4 mr-2 text-primary" />
                  {new Date(selectedBattle.date).toLocaleDateString()}
                </div>
                <div className="flex items-center text-gray-700">
                  <MapPin className="h-4 w-4 mr-2 text-primary" />
                  {selectedBattle.location}
                </div>
              </div>
              
              <Button 
                size="sm" 
                className="w-full mt-3 font-semibold" 
                onClick={() => navigate(`/events/${selectedBattle.id}`)}
                data-testid="button-view-event-details"
              >
                View Event Details
              </Button>
            </div>
          </InfoWindow>
        )}

        {selectedSpot && isValidCoordinate(selectedSpot.latitude, selectedSpot.longitude) && (
          <InfoWindow
            position={{
              lat: parseCoordinate(selectedSpot.latitude),
              lng: parseCoordinate(selectedSpot.longitude),
            }}
            onCloseClick={() => setSelectedSpot(null)}
          >
            <div className="p-3 max-w-sm">
              <h3 className="font-bold text-gray-900 text-lg mb-1">{selectedSpot.name}</h3>
              <Badge 
                className="mb-2 text-white"
                style={{ backgroundColor: categoryConfig[selectedSpot.type as string]?.color || "#888" }}
              >
                {categoryConfig[selectedSpot.type as string]?.label || selectedSpot.type}
              </Badge>
              
              <div className="space-y-2 text-sm">
                {selectedSpot.description && (
                  <p className="text-gray-600">{selectedSpot.description}</p>
                )}
                {selectedSpot.address && (
                  <div className="flex items-center text-gray-700">
                    <MapPin className="h-4 w-4 mr-2 text-primary" />
                    {selectedSpot.address}
                  </div>
                )}
              </div>
              
              <Button 
                size="sm" 
                className="w-full mt-3 font-semibold" 
                onClick={() => navigate(`/locations/${selectedSpot.id}`)}
                data-testid="button-view-spot-details"
              >
                View Spot Details
              </Button>
            </div>
          </InfoWindow>
        )}

        {!hasAdvancedMarkers && filteredMapUsers.map((mapUser) => {
          const lat = parseFloat(mapUser.coarseLat);
          const lng = parseFloat(mapUser.coarseLng);
          if (isNaN(lat) || isNaN(lng)) return null;
          return (
            <Marker
              key={`user-${mapUser.userId}`}
              position={{ lat, lng }}
              onClick={() => {
                setSelectedMapUser(mapUser);
                setSelectedBattle(null);
                setSelectedSpot(null);
              }}
              icon={{
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(getUserMarkerSvg(mapUser.displayName || '', mapUser.role)),
                scaledSize: new google.maps.Size(40, 48),
                anchor: new google.maps.Point(20, 48),
              }}
            />
          );
        })}

        {selectedMapUser && (
          <InfoWindow
            position={{
              lat: parseFloat(selectedMapUser.coarseLat),
              lng: parseFloat(selectedMapUser.coarseLng),
            }}
            onCloseClick={() => setSelectedMapUser(null)}
          >
            <div className="p-3 max-w-sm">
              <div className="flex items-center gap-2 mb-2">
                {selectedMapUser.profilePicture ? (
                  <img 
                    src={selectedMapUser.profilePicture} 
                    alt={selectedMapUser.displayName || 'User'}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: roleConfig[selectedMapUser.role?.toLowerCase() || '']?.color || '#2196F3' }}
                  >
                    {(selectedMapUser.displayName || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-gray-900 text-base" data-testid={`text-map-user-name-${selectedMapUser.userId}`}>
                    {selectedMapUser.displayName || 'Anonymous'}
                  </h3>
                  {selectedMapUser.role && (
                    <Badge 
                      className="text-white text-xs"
                      style={{ backgroundColor: roleConfig[selectedMapUser.role.toLowerCase()]?.color || '#888' }}
                    >
                      {roleConfig[selectedMapUser.role.toLowerCase()]?.label || selectedMapUser.role}
                    </Badge>
                  )}
                </div>
              </div>
              
              {selectedMapUser.city && (
                <p className="text-xs text-gray-500 mb-2">
                  <MapPin className="h-3 w-3 inline mr-1" />
                  {selectedMapUser.city}
                </p>
              )}

              <div className="flex gap-2 mt-2">
                <Button 
                  size="sm" 
                  className="flex-1 font-semibold"
                  onClick={() => navigate(`/profile/${selectedMapUser.userId}`)}
                  data-testid={`button-view-user-profile-${selectedMapUser.userId}`}
                >
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  Profile
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  className="flex-1 font-semibold"
                  onClick={() => navigate(`/chat?userId=${selectedMapUser.userId}`)}
                  data-testid={`button-message-user-${selectedMapUser.userId}`}
                >
                  <MessageCircle className="h-3.5 w-3.5 mr-1" />
                  Message
                </Button>
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
      
      <TooltipProvider>
      <div className="absolute bottom-4 sm:bottom-6 right-2 sm:right-4 z-10 flex flex-col gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="outline"
              className="rounded-full shadow-md bg-background"
              onClick={handleGetCurrentLocation}
              aria-label="My location"
              data-testid="button-my-location"
            >
              <Locate className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">My location</TooltipContent>
        </Tooltip>

        {isAuthenticated && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                className="rounded-full shadow-md bg-background"
                onClick={() => navigate('/nearby')}
                aria-label="Nearby users"
                data-testid="button-nearby-users"
              >
                <Users className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Nearby users</TooltipContent>
          </Tooltip>
        )}

        {isAuthenticated && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                className="rounded-full shadow-md"
                onClick={() => setShowAddLocation(true)}
                aria-label="Add spot"
                data-testid="button-add-spot"
              >
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
              onClick={() => {
                Promise.all([
                  queryClient.refetchQueries({ queryKey: ['/api/events'] }),
                  queryClient.refetchQueries({ queryKey: ['/api/locations'] })
                ]).then(() => {
                  toast({ title: "Map refreshed", description: "Latest events and spots loaded" });
                }).catch(() => {
                  toast({ title: "Refresh failed", description: "Could not reload data.", variant: "destructive" });
                });
              }}
              aria-label="Refresh map data"
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
        prefilledCoordinates={
          mapCenter ? { latitude: String(mapCenter.lat), longitude: String(mapCenter.lng) } : undefined
        }
      />
    </div>
  );
};

export default GoogleMapView;
