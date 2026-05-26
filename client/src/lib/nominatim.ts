const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const HEADERS = {
  'Accept-Language': 'en',
  'User-Agent': 'UrbanCultureConnect/1.0 (contact@urbancultureconnect.com)',
};

export interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    country?: string;
    postcode?: string;
  };
}

export async function searchAddress(query: string, limit = 5): Promise<NominatimResult[]> {
  if (!query || query.trim().length < 2) return [];
  try {
    const url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(query)}&format=json&limit=${limit}&addressdetails=1`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lng}&format=json`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error('Reverse geocode failed');
    const data = await res.json();
    return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const results = await searchAddress(address, 1);
  if (!results.length) return null;
  return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
}

export function getCurrentLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}
