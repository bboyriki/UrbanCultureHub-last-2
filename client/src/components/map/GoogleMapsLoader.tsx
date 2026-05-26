import { useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';

declare global {
  interface Window {
    initGoogleMapsApi?: () => void;
    gm_authFailure?: () => void;
    google?: any;
    googleMapsAlreadyInitialized?: boolean;
    googleMapsAuthFailed?: boolean;
  }
}

type GoogleMapsLoaderProps = {
  apiKey: string;
  children: React.ReactNode;
  libraries?: string[];
  onMapError?: (error: string) => void;
};

type LoadState = 'loading' | 'loaded' | 'auth_error' | 'load_error';

const GoogleMapsLoader = ({ apiKey, children, libraries = ['places', 'marker'], onMapError }: GoogleMapsLoaderProps) => {
  const [loadState, setLoadState] = useState<LoadState>(() => {
    if (window.googleMapsAuthFailed) return 'auth_error';
    if (window.google?.maps) return 'loaded';
    return 'loading';
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!document.getElementById('gm-error-suppress')) {
      const style = document.createElement('style');
      style.id = 'gm-error-suppress';
      style.textContent = [
        '.gm-err-message',
        '.gm-err-container',
        '.gm-err-content',
        '[class*="gm-err"]',
      ].join(', ') + ' { display: none !important; }';
      document.head.appendChild(style);
    }

    window.gm_authFailure = () => {
      window.googleMapsAuthFailed = true;
      setLoadState('auth_error');
      onMapError?.('auth_failed');
    };

    if (window.googleMapsAuthFailed) {
      setLoadState('auth_error');
      onMapError?.('auth_failed');
      return;
    }

    if (window.google?.maps) {
      setLoadState('loaded');
      return;
    }

    if (window.googleMapsAlreadyInitialized) {
      const interval = setInterval(() => {
        if (window.googleMapsAuthFailed) {
          setLoadState('auth_error');
          clearInterval(interval);
          return;
        }
        if (window.google?.maps) {
          setLoadState('loaded');
          clearInterval(interval);
        }
      }, 100);
      const timeout = setTimeout(() => {
        clearInterval(interval);
        if (loadState === 'loading') {
          setLoadState('load_error');
          setErrorMessage('Google Maps took too long to load.');
        }
      }, 12000);
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }

    window.googleMapsAlreadyInitialized = true;

    window.initGoogleMapsApi = () => {
      if (!window.googleMapsAuthFailed) {
        setLoadState('loaded');
      }
    };

    const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existing) return;

    try {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=${libraries.join(',')}&callback=initGoogleMapsApi&loading=async`;
      script.async = true;
      script.defer = true;
      script.id = 'google-maps-script';
      script.onerror = () => {
        setLoadState('load_error');
        setErrorMessage('Failed to load Google Maps. Check your API key.');
        window.googleMapsAlreadyInitialized = false;
      };
      document.head.appendChild(script);
    } catch (err) {
      setLoadState('load_error');
      setErrorMessage(`Error loading Google Maps: ${err}`);
      window.googleMapsAlreadyInitialized = false;
    }

    return () => {
      window.initGoogleMapsApi = undefined;
    };
  }, [apiKey]);

  if (loadState === 'auth_error') {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] bg-[hsl(0,0%,99%)] px-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7 text-amber-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Map Unavailable</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Google Maps requires billing to be enabled in your Google Cloud Console. Spots and events are still visible below.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a
              href="https://console.cloud.google.com/billing"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Enable Billing in Google Cloud
            </a>
          </Button>
        </div>
      </div>
    );
  }

  if (loadState === 'load_error') {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] bg-[hsl(0,0%,99%)] px-6">
        <div className="max-w-sm w-full text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto">
            <MapPin className="w-7 h-7 text-red-400" />
          </div>
          <h3 className="text-base font-semibold text-foreground">Map Failed to Load</h3>
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
        </div>
      </div>
    );
  }

  if (loadState === 'loading') {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] bg-[hsl(0,0%,99%)]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin h-8 w-8 border-[3px] border-primary border-t-transparent rounded-full" />
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default GoogleMapsLoader;
