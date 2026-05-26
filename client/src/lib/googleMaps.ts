// This script handles loading the Google Maps API dynamically
import { toast } from "@/hooks/use-toast";

let isLoaded = false;
let isLoading = false;
let loadAttemptCount = 0;
const MAX_LOAD_ATTEMPTS = 3;
let callbacks: Array<() => void> = [];
let errorCallbacks: Array<(error: Error) => void> = [];

/**
 * Initialize the Google Maps API with libraries and callbacks
 */
export function initGoogleMapsApi(
  callback?: () => void, 
  errorCallback?: (error: Error) => void
): void {
  if (callback) {
    callbacks.push(callback);
  }
  
  if (errorCallback) {
    errorCallbacks.push(errorCallback);
  }

  // If already loaded, call callbacks and return
  if (isLoaded && window.google?.maps) {
    callbacks.forEach(cb => cb());
    callbacks = [];
    return;
  }
  
  // If already loading, just add the callbacks and return
  if (isLoading) {
    return;
  }
  
  // Check if we've exceeded retry attempts
  if (loadAttemptCount >= MAX_LOAD_ATTEMPTS) {
    const error = new Error(`Failed to load Google Maps API after ${MAX_LOAD_ATTEMPTS} attempts`);
    console.error(error);
    errorCallbacks.forEach(cb => cb(error));
    errorCallbacks = [];
    
    toast({
      title: "Maps API Error",
      description: "Failed to load after multiple attempts. Please refresh the page.",
      variant: "destructive",
    });
    return;
  }

  // Verify API key exists
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    const error = new Error("Google Maps API key is missing");
    console.error(error);
    errorCallbacks.forEach(cb => cb(error));
    errorCallbacks = [];
    
    toast({
      title: "Maps API Error",
      description: "API key is missing. Please contact support.",
      variant: "destructive",
    });
    return;
  }
  
  // Remove any existing script elements to avoid duplicates
  const existingScript = document.getElementById('google-maps-script');
  if (existingScript) {
    existingScript.remove();
  }
  
  isLoading = true;
  loadAttemptCount++;
  
  const script = document.createElement('script');
  script.id = 'google-maps-script';
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initMap`;
  script.async = true;
  script.defer = true;

  // Define the callback that will be called when the script loads
  window.initMap = () => {
    if (window.google && window.google.maps && window.google.maps.Geocoder) {
      isLoaded = true;
      isLoading = false;
      loadAttemptCount = 0; // Reset on success
      callbacks.forEach(cb => cb());
      callbacks = [];
      console.log("Google Maps API loaded successfully");
    } else {
      // If API objects aren't properly defined, retry
      isLoading = false;
      console.error("Google Maps API callback executed but API not properly initialized");
      
      // Retry after a delay
      setTimeout(() => {
        initGoogleMapsApi();
      }, 1000);
    }
  };
  
  // Handle load errors with retry
  script.onerror = () => {
    isLoading = false;
    const error = new Error(`Failed to load Google Maps API (attempt ${loadAttemptCount}/${MAX_LOAD_ATTEMPTS})`);
    console.error(error);
    
    // Retry if we haven't exceeded max attempts
    if (loadAttemptCount < MAX_LOAD_ATTEMPTS) {
      console.log(`Retrying Google Maps API load (attempt ${loadAttemptCount + 1}/${MAX_LOAD_ATTEMPTS})...`);
      setTimeout(() => {
        initGoogleMapsApi();
      }, 1000); // Wait 1 second before retrying
    } else {
      errorCallbacks.forEach(cb => cb(error));
      errorCallbacks = [];
      
      toast({
        title: "Maps API Error",
        description: "Failed to load Google Maps. Please check your internet connection.",
        variant: "destructive",
      });
    }
  };

  // Add the script to the document
  document.head.appendChild(script);
}

/**
 * Checks if the Google Maps API is loaded and fully initialized
 */
export function isGoogleMapsLoaded(): boolean {
  return isLoaded && !!window.google?.maps?.Geocoder;
}

/**
 * Helper function to geocode an address using the Google Maps Geocoder API
 * This provides a more reliable way to get coordinates compared to the Places API
 */
export async function geocodeAddress(address: string): Promise<{lat: number, lng: number}> {
  // Initialize Maps API if not already loaded
  if (!isGoogleMapsLoaded()) {
    await new Promise<void>((resolve, reject) => {
      initGoogleMapsApi(resolve, reject);
    });
  }
  
  // Make sure the API is actually loaded
  if (!window.google?.maps?.Geocoder) {
    throw new Error("Google Maps Geocoder API not available");
  }
  
  return new Promise((resolve, reject) => {
    const geocoder = new window.google.maps.Geocoder();
    
    geocoder.geocode(
      { address: address },
      (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
        if (status === google.maps.GeocoderStatus.OK && results && results.length > 0) {
          const location = results[0].geometry.location;
          resolve({
            lat: location.lat(),
            lng: location.lng()
          });
        } else {
          reject(new Error(`Geocoding failed with status: ${status}`));
        }
      }
    );
  });
}

/**
 * Get the user's current location using browser geolocation API with a Promise interface
 */
export function getCurrentLocation(): Promise<{lat: number, lng: number}> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"));
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => {
        let errorMessage = "Failed to get current location";
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location permission denied. Please allow location access in your browser settings.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable. Please try again later.";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out. Please try again.";
            break;
        }
        
        reject(new Error(errorMessage));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
}

/**
 * Reverse geocode coordinates to get an address
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  // Initialize Maps API if not already loaded
  if (!isGoogleMapsLoaded()) {
    await new Promise<void>((resolve, reject) => {
      initGoogleMapsApi(resolve, reject);
    });
  }
  
  // Make sure the API is actually loaded
  if (!window.google?.maps?.Geocoder) {
    throw new Error("Google Maps Geocoder API not available");
  }
  
  return new Promise((resolve, reject) => {
    const geocoder = new window.google.maps.Geocoder();
    const latlng = { lat, lng };
    
    geocoder.geocode(
      { location: latlng },
      (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
        if (status === google.maps.GeocoderStatus.OK && results && results.length > 0) {
          // Prefer the formatted_address of the first result
          resolve(results[0].formatted_address);
        } else {
          reject(new Error(`Reverse geocoding failed with status: ${status}`));
        }
      }
    );
  });
}

// Extend the Window interface to include our callback
declare global {
  interface Window {
    initMap: () => void;
  }
}