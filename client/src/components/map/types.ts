export type MapFilters = {
  showEvents: boolean;
  showSpots: boolean;
  showPeople: boolean;
  showCitySpots: boolean;
  categories: string[];
  peopleRoles: string[];
  citySpotCategories: string[];
  eventCategories: string[];
  distanceSort: boolean;
  openNow: boolean;
};

export interface MapUser {
  userId: number;
  displayName: string | null;
  role: string | null;
  artType: string | null;
  profilePicture: string | null;
  isVerified: boolean | null;
  city: string | null;
  coarseLat: string;
  coarseLng: string;
  visibilityMode: string | null;
}

export interface CitySpot {
  id: number;
  name: string;
  lat: number;
  lon: number;
  category: string;
  sport: string | null;
  leisure: string | null;
  amenity: string | null;
  address: string;
  website: string | null;
  opening_hours: string | null;
}
