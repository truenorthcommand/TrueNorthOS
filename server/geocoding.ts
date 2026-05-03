/**
 * Google Maps Geocoding Service
 * Converts addresses to lat/lng coordinates for map display
 */

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

/**
 * Geocode an address string to lat/lng coordinates
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  if (!GOOGLE_MAPS_API_KEY || !address || address.trim().length < 5) {
    return null;
  }

  try {
    const encodedAddress = encodeURIComponent(address.trim());
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}&region=gb`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const result = data.results[0];
      return {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formattedAddress: result.formatted_address,
      };
    }

    console.log(`Geocoding failed for "${address}": ${data.status}`);
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in metres
 */
export function calculateDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371e3; // Earth radius in metres
  const rad1 = lat1 * Math.PI / 180;
  const rad2 = lat2 * Math.PI / 180;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rad1) * Math.cos(rad2) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Get distance matrix between a point and multiple destinations
 * Uses Google Maps Distance Matrix API
 */
export async function getDistanceMatrix(
  origin: { lat: number; lng: number },
  destinations: Array<{ lat: number; lng: number; id: string }>
): Promise<Array<{ id: string; distance: number; duration: number }> | null> {
  if (!GOOGLE_MAPS_API_KEY || destinations.length === 0) {
    return null;
  }

  try {
    const originStr = `${origin.lat},${origin.lng}`;
    const destStr = destinations.map(d => `${d.lat},${d.lng}`).join('|');
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originStr}&destinations=${destStr}&key=${GOOGLE_MAPS_API_KEY}&units=imperial`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.rows || !data.rows[0]) {
      return null;
    }

    return data.rows[0].elements.map((element: any, index: number) => ({
      id: destinations[index].id,
      distance: element.status === 'OK' ? element.distance.value : 0, // metres
      duration: element.status === 'OK' ? element.duration.value : 0, // seconds
    }));
  } catch (error) {
    console.error('Distance matrix error:', error);
    return null;
  }
}
