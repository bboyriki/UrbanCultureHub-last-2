import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LocateFixed, Loader2, MapPin, Search, X } from "lucide-react";

const SKIP_KEY = "ucc_location_setup_skipped";
const SKIP_DAYS = 7;

export function shouldShowLocationModal(user: any, presence: any): boolean {
  if (!user) return false;
  if (presence) return false;
  const skippedAt = localStorage.getItem(SKIP_KEY);
  if (skippedAt) {
    const diff = Date.now() - parseInt(skippedAt);
    if (diff < SKIP_DAYS * 24 * 60 * 60 * 1000) return false;
  }
  return true;
}

interface LocationSetupModalProps {
  open: boolean;
  onClose: () => void;
}

interface LocationData {
  lat: number;
  lng: number;
  street?: string;
  postcode?: string;
  city: string;
  country?: string;
}

export default function LocationSetupModal({ open, onClose }: LocationSetupModalProps) {
  const { toast } = useToast();
  const [street, setStreet] = useState("");
  const [postcode, setPostcode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isGettingGPS, setIsGettingGPS] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveMutation = useMutation({
    mutationFn: (data: LocationData) => apiRequest("/api/users/me/location", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proximity/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/proximity/my-presence"] });
      toast({ title: "Location saved!", description: "You're now set up for nearby discovery." });
      onClose();
    },
    onError: () => toast({ title: "Failed to save location", variant: "destructive" }),
  });

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    setLocationConfirmed(false);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setSuggestions([]); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=6&addressdetails=1`,
          { headers: { "Accept-Language": "en", "User-Agent": "UrbanCultureConnect/1.0" } }
        );
        const data = await res.json();
        setSuggestions(data);
        setShowSuggestions(true);
      } catch { setSuggestions([]); }
    }, 400);
  };

  const fillFromNominatim = (item: any) => {
    const addr = item.address || {};
    setStreet([addr.road || addr.street || "", addr.house_number || ""].filter(Boolean).join(" "));
    setPostcode(addr.postcode || "");
    setCity(addr.city || addr.town || addr.village || addr.county || item.display_name.split(",")[0]);
    setCountry(addr.country || "");
    setCoords({ lat: parseFloat(item.lat), lng: parseFloat(item.lon) });
    setSearchQuery(item.display_name.split(",").slice(0, 3).join(", "));
    setSuggestions([]);
    setShowSuggestions(false);
    setLocationConfirmed(true);
  };

  const handleGPS = () => {
    if (!navigator.geolocation) {
      toast({ title: "GPS not supported", variant: "destructive" });
      return;
    }
    setIsGettingGPS(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
            { headers: { "Accept-Language": "en", "User-Agent": "UrbanCultureConnect/1.0" } }
          );
          const data = await res.json();
          const addr = data.address || {};
          const detectedStreet = [addr.road || addr.street || "", addr.house_number || ""].filter(Boolean).join(" ");
          const detectedPostcode = addr.postcode || "";
          const detectedCity = addr.city || addr.town || addr.village || addr.county || "";
          const detectedCountry = addr.country || "";
          setStreet(detectedStreet);
          setPostcode(detectedPostcode);
          setCity(detectedCity);
          setCountry(detectedCountry);
          setCoords({ lat: latitude, lng: longitude });
          setSearchQuery([detectedCity, detectedCountry].filter(Boolean).join(", "));
          setLocationConfirmed(true);
          toast({ title: "Location detected", description: `Found: ${detectedCity}${detectedCountry ? `, ${detectedCountry}` : ""}` });
        } catch {
          setCoords({ lat: latitude, lng: longitude });
          setCity("My location");
          setLocationConfirmed(true);
          toast({ title: "GPS set", description: "Coordinates saved. Please fill in remaining details." });
        }
        setIsGettingGPS(false);
      },
      (err) => {
        setIsGettingGPS(false);
        toast({
          title: "Location denied",
          description: err.code === 1 ? "Please allow location access or type your address below." : "Could not get GPS. Please type your address.",
          variant: "destructive",
        });
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
    );
  };

  const handleSave = () => {
    if (!city.trim()) {
      toast({ title: "City required", description: "Please enter at least your city.", variant: "destructive" });
      return;
    }
    saveMutation.mutate({ street, postcode, city, country, lat: coords?.lat, lng: coords?.lng } as any);
  };

  const handleSkip = () => {
    localStorage.setItem(SKIP_KEY, Date.now().toString());
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleSkip(); }}>
      <DialogContent className="max-w-md w-full" data-testid="modal-location-setup">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg">Add your location</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Used for nearby discovery — only your approximate area is shared.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search address, postcode or city..."
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="pl-9"
                data-testid="input-address-search"
                disabled={isGettingGPS}
              />
              {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute z-50 left-0 right-0 top-11 bg-popover border border-border rounded-md shadow-lg max-h-52 overflow-y-auto">
                  {suggestions.map((item, i) => (
                    <li
                      key={i}
                      onMouseDown={() => fillFromNominatim(item)}
                      className="px-3 py-2 text-xs cursor-pointer hover:bg-muted flex items-start gap-2"
                    >
                      <MapPin className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
                      <span>{item.display_name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              onClick={handleGPS}
              disabled={isGettingGPS}
              data-testid="button-gps-detect"
              title="Detect my location automatically"
              className="h-10 w-10 shrink-0 flex items-center justify-center rounded-md border border-border bg-background hover:bg-primary/5 hover:border-primary hover:text-primary transition-colors text-muted-foreground"
            >
              {isGettingGPS ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
            </button>
          </div>

          {locationConfirmed && (
            <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 px-3 py-2 flex items-center gap-2 text-xs text-green-700 dark:text-green-400">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              Location detected — review and adjust the fields below if needed.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="loc-street" className="text-xs font-medium text-muted-foreground">Street name + number</Label>
              <Input
                id="loc-street"
                placeholder="Damrak 1"
                value={street}
                onChange={e => setStreet(e.target.value)}
                data-testid="input-street"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loc-postcode" className="text-xs font-medium text-muted-foreground">Postcode</Label>
              <Input
                id="loc-postcode"
                placeholder="1012 LG"
                value={postcode}
                onChange={e => setPostcode(e.target.value)}
                data-testid="input-postcode"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loc-city" className="text-xs font-medium text-muted-foreground">City <span className="text-destructive">*</span></Label>
              <Input
                id="loc-city"
                placeholder="Amsterdam"
                value={city}
                onChange={e => setCity(e.target.value)}
                data-testid="input-city"
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="loc-country" className="text-xs font-medium text-muted-foreground">Country</Label>
              <Input
                id="loc-country"
                placeholder="Netherlands"
                value={country}
                onChange={e => setCountry(e.target.value)}
                data-testid="input-country"
              />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 flex items-start gap-2 text-xs text-muted-foreground">
            <span className="mt-0.5 shrink-0">🔒</span>
            <span>Only your approximate area (±1 km) is shared with nearby members — your exact address is never visible to others.</span>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={saveMutation.isPending || !city.trim()}
              data-testid="button-save-location"
            >
              {saveMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
              ) : (
                <><MapPin className="w-4 h-4 mr-2" />Save my location</>
              )}
            </Button>
            <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground" data-testid="button-skip-location">
              Skip for now
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
