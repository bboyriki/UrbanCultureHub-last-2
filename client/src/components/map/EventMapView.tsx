import { useState, useEffect, useRef, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CalendarDays, 
  MapPin, 
  Search, 
  Filter, 
  X, 
  SlidersHorizontal,
  PanelLeftClose,
  PanelLeftOpen 
} from "lucide-react";
import { format } from "date-fns";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { EventCategories } from "@/types";
import { Event } from "@shared/schema";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";

interface EventMapViewProps {
  events: Event[];
  onEventClick: (event: Event) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredEvents: Event[];
  activeFilters: string[];
  setActiveFilters: (filters: string[]) => void;
  eventsByCategory: Record<string, Event[]>;
}

const EventMapView: React.FC<EventMapViewProps> = ({
  events,
  onEventClick,
  searchQuery,
  setSearchQuery,
  filteredEvents,
  activeFilters,
  setActiveFilters,
  eventsByCategory
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const isMobile = useIsMobile();
  const { toast } = useToast();

  // Initialize the map
  useEffect(() => {
    if (mapRef.current && !map) {
      // Default to Amsterdam coordinates
      const defaultCenter = { lat: 52.3676, lng: 4.9041 };
      
      // Create the map instance
      const mapInstance = new google.maps.Map(mapRef.current, {
        center: defaultCenter,
        zoom: 13,
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }]
          }
        ],
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
      });
      
      setMap(mapInstance);
    }
  }, [mapRef, map]);

  // Add event markers to the map when events change
  useEffect(() => {
    if (map && filteredEvents.length > 0) {
      // Clear existing markers
      markers.forEach(marker => marker.setMap(null));

      // Create markers for filtered events
      const newMarkers = filteredEvents.map(event => {
        // Check if latitude and longitude exist as numbers or strings
        if (
          event.latitude === null || 
          event.latitude === undefined || 
          event.longitude === null || 
          event.longitude === undefined
        ) {
          console.log(`Event ${event.id} (${event.title}) is missing coordinates`, event);
          return null;
        }

        // Parse latitude and longitude - handle both string and number types
        let lat: number, lng: number;
        
        if (typeof event.latitude === 'string') {
          lat = parseFloat(event.latitude);
        } else {
          lat = event.latitude as number;
        }
        
        if (typeof event.longitude === 'string') {
          lng = parseFloat(event.longitude);
        } else {
          lng = event.longitude as number;
        }
        
        if (isNaN(lat) || isNaN(lng)) {
          console.log(`Event ${event.id} (${event.title}) has invalid coordinates: ${event.latitude}, ${event.longitude}`);
          return null;
        }

        // Create marker for the event
        const marker = new google.maps.Marker({
          position: { lat, lng },
          map,
          title: event.title,
          animation: google.maps.Animation.DROP,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: getCategoryColor(event.category),
            fillOpacity: 0.9,
            strokeWeight: 1,
            strokeColor: '#ffffff',
            scale: 10
          }
        });

        // Add click event to the marker
        marker.addListener("click", () => {
          onEventClick(event);

          // Center map on this marker
          map.panTo({ lat, lng });
          map.setZoom(14);
        });

        return marker;
      }).filter(Boolean) as google.maps.Marker[];

      setMarkers(newMarkers);

      // If we have markers, fit bounds to show all of them
      if (newMarkers.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        newMarkers.forEach(marker => {
          if (marker && marker.getPosition()) {
            bounds.extend(marker.getPosition()!);
          }
        });
        
        // Don't zoom in too far for single markers
        map.fitBounds(bounds);
        const zoom = map.getZoom();
        if (zoom !== undefined && zoom > 16) map.setZoom(16);
      } else {
        // If no events have valid coordinates, set default location
        map.setCenter({ lat: 52.3676, lng: 4.9041 }); // Amsterdam
        map.setZoom(13);
        console.log("No events with valid coordinates found, using default map center");
      }
    }
  }, [map, filteredEvents, onEventClick]);

  // Get color for category marker
  const getCategoryColor = (category: string): string => {
    const categoryColors: Record<string, string> = {
      'graffiti': '#FF5733',
      'dance': '#33A1FF',
      'music': '#FF33A8',
      'art': '#9433FF',
      'food': '#33FF57',
      'fashion': '#FF9933',
      'workshop': '#33FFC1',
      'market': '#FFF233',
      'other': '#AAAAAA'
    };

    return categoryColors[category.toLowerCase()] || '#33FF57';
  };

  // Handle clearing search
  const handleClearSearch = () => {
    setSearchQuery('');
  };

  // Toggle filter
  const handleToggleFilter = (category: string) => {
    if (activeFilters.includes(category)) {
      setActiveFilters(activeFilters.filter(filter => filter !== category));
    } else {
      setActiveFilters([...activeFilters, category]);
    }
  };

  // Clear all filters
  const handleClearFilters = () => {
    setActiveFilters([]);
    toast({
      title: "Filters cleared",
      description: "Showing all event categories",
      duration: 3000
    } as any);
  };

  // User's current location
  const handleGetCurrentLocation = () => {
    if (navigator.geolocation && map) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };

          map.setCenter(pos);
          map.setZoom(15);

          // Create a pulsing marker for current location
          new google.maps.Marker({
            position: pos,
            map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: '#4285F4',
              fillOpacity: 1,
              strokeWeight: 2,
              strokeColor: '#FFFFFF',
              scale: 8
            },
            title: "Your Location"
          });

          toast({
            title: "Location found",
            description: "Map centered on your current location",
            duration: 3000
          } as any);
        },
        () => {
          toast({
            title: "Error",
            description: "Unable to retrieve your location",
            variant: "destructive",
            duration: 3000
          } as any);
        }
      );
    } else {
      toast({
        title: "Error",
        description: "Geolocation is not supported by your browser",
        variant: "destructive",
        duration: 3000
      } as any);
    }
  };

  // Card component for listing events
  const EventCard = ({ event }: { event: Event }) => (
    <Card className="mb-3 cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => onEventClick(event)}>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          {event.image && (
            <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0">
              <img 
                src={event.image} 
                alt={event.title} 
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm line-clamp-1">{event.title}</h3>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <CalendarDays className="h-3 w-3" />
              <span>
                {event.date ? format(new Date(event.date), "MMM d, yyyy") : "Date TBA"}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{event.location}</span>
            </div>
            <Badge variant="outline" className="mt-2 text-xs">
              {event.category}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Sidebar component - shows categories and list of events
  const Sidebar = () => (
    <div className="h-full flex flex-col overflow-hidden bg-background border-r">
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-8"
          />
          {searchQuery && (
            <button 
              className="absolute right-2 top-1/2 transform -translate-y-1/2"
              onClick={handleClearSearch}
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      <Tabs defaultValue="categories" className="flex-1 overflow-hidden">
        <TabsList className="w-full justify-start px-3 pt-2">
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="list">List View</TabsTrigger>
        </TabsList>
        
        <TabsContent value="categories" className="h-full overflow-y-auto pt-2">
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-sm">Event Categories</h3>
              {activeFilters.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-7 text-xs"
                >
                  Clear filters
                </Button>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(EventCategories).map(([key, label]) => {
                const count = eventsByCategory[key]?.length || 0;
                const isActive = activeFilters.includes(key);
                
                return (
                  <Button
                    key={key}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    className={`justify-start ${!count ? 'opacity-50' : ''}`}
                    onClick={() => handleToggleFilter(key)}
                    disabled={!count}
                  >
                    <span className="truncate">{label}</span>
                    <span className="ml-auto text-xs">{count}</span>
                  </Button>
                );
              })}
            </div>
            
            <div className="pt-4">
              <h3 className="font-medium text-sm mb-3">Featured Events</h3>
              {filteredEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events match your filters.</p>
              ) : (
                <div>
                  {filteredEvents.slice(0, 3).map(event => (
                    <EventCard key={event.id} event={event} />
                  ))}
                  
                  {filteredEvents.length > 3 && (
                    <p className="text-sm text-center text-muted-foreground mt-3">
                      +{filteredEvents.length - 3} more events
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="list" className="h-full overflow-y-auto data-[state=active]:flex-1">
          <div className="p-3">
            <h3 className="font-medium mb-3">Events {filteredEvents.length > 0 && `(${filteredEvents.length})`}</h3>
            
            {filteredEvents.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-2">No events match your search criteria</p>
                <Button variant="outline" size="sm" onClick={() => {
                  setSearchQuery('');
                  setActiveFilters([]);
                }}>
                  Clear all filters
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredEvents.map(event => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );

  // For mobile, use Drawer for bottom sheet and Sheet for side panel
  const MobileFilters = () => (
    <div className="absolute bottom-4 left-4 right-4 z-10 flex gap-2">
      <Drawer>
        <DrawerTrigger asChild>
          <Button size="sm" className="flex-1">
            <Filter className="h-4 w-4 mr-2" />
            Filters {activeFilters.length > 0 && `(${activeFilters.length})`}
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <div className="p-4">
            <h3 className="font-medium mb-4">Filter By Category</h3>
            
            <div className="grid grid-cols-2 gap-2 mb-6">
              {Object.entries(EventCategories).map(([key, label]) => {
                const count = eventsByCategory[key]?.length || 0;
                const isActive = activeFilters.includes(key);
                
                return (
                  <Button
                    key={key}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    className={`justify-start ${!count ? 'opacity-50' : ''}`}
                    onClick={() => handleToggleFilter(key)}
                    disabled={!count}
                  >
                    <span className="truncate">{label}</span>
                    <span className="ml-auto text-xs">{count}</span>
                  </Button>
                );
              })}
            </div>
            
            {activeFilters.length > 0 && (
              <Button 
                variant="outline" 
                onClick={handleClearFilters}
                className="w-full"
              >
                Clear All Filters
              </Button>
            )}
          </div>
        </DrawerContent>
      </Drawer>
      
      <Sheet>
        <SheetTrigger asChild>
          <Button size="sm" className="flex-1">
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            Event List
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[85%] sm:w-[350px] p-0">
          <Sidebar />
        </SheetContent>
      </Sheet>
      
      <Button size="sm" className="rounded-full px-2 flex-none" onClick={handleGetCurrentLocation}>
        <MapPin className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <div className="relative h-full w-full flex overflow-hidden">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <>
          <div 
            className={`h-full transition-all duration-300 ${
              isSidebarOpen ? 'w-[350px]' : 'w-0 opacity-0'
            } overflow-hidden`}
          >
            {isSidebarOpen && <Sidebar />}
          </div>
          
          <div 
            className="absolute left-3 top-3 z-10 rounded-full bg-background shadow-md"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <Button variant="ghost" size="icon" className="h-8 w-8">
              {isSidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </Button>
          </div>
        </>
      )}
      
      {/* Map Container */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="h-full w-full" />
        
        {/* Desktop Location Button */}
        {!isMobile && (
          <Button 
            size="sm" 
            className="absolute right-3 top-3 z-10 shadow-md"
            onClick={handleGetCurrentLocation}
          >
            <MapPin className="h-4 w-4 mr-2" />
            My Location
          </Button>
        )}
        
        {/* Mobile Controls */}
        {isMobile && <MobileFilters />}
      </div>
    </div>
  );
};

export default EventMapView;