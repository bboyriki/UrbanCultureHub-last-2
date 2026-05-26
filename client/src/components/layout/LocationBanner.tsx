import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "location_banner_dismissed_at";
const DISMISS_HOURS = 48;

export default function LocationBanner() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const ts = localStorage.getItem(DISMISS_KEY);
    if (ts && Date.now() - parseInt(ts) < DISMISS_HOURS * 3600 * 1000) {
      setDismissed(true);
    }
  }, []);

  const { data: settings } = useQuery<{ discoveryEnabled: boolean; consentGiven: boolean }>({
    queryKey: ["/api/proximity/settings"],
    enabled: !!user,
  });

  if (!user) return null;
  if (dismissed) return null;
  if (settings?.discoveryEnabled && settings?.consentGiven) return null;
  if (settings === undefined) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-2.5 flex items-center gap-3">
      <MapPin className="h-4 w-4 text-primary shrink-0" />
      <p className="text-sm flex-1 text-foreground">
        <span className="font-semibold">Enable location</span>
        <span className="text-muted-foreground"> to discover and connect with nearby urban culture members.</span>
      </p>
      <Button
        size="sm"
        variant="default"
        className="shrink-0 h-7 text-xs px-3"
        onClick={() => navigate("/nearby")}
        data-testid="button-location-banner-enable"
      >
        Enable Now
      </Button>
      <button
        className="text-muted-foreground hover:text-foreground shrink-0"
        onClick={handleDismiss}
        aria-label="Dismiss"
        data-testid="button-location-banner-dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
