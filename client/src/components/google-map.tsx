import { useState, useEffect, useCallback, useMemo } from 'react';
import { Map, AdvancedMarker, InfoWindow, useMap, Pin } from '@vis.gl/react-google-maps';
import { useGoogleMapsApi } from './google-maps-provider';
import { Loader2 } from 'lucide-react';

type MarkerType = 'engineer' | 'job' | 'signoff';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  type: MarkerType;
  title: string;
  subtitle?: string;
  status?: string;
}

export interface GoogleMapProps {
  markers: MapMarker[];
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: string;
  onMarkerClick?: (marker: MapMarker) => void;
  showUserLocation?: boolean;
}

const markerColors: Record<MarkerType, { background: string; glyph: string; border: string }> = {
  engineer: { background: '#3b82f6', glyph: '#ffffff', border: '#2563eb' },
  job: { background: '#f97316', glyph: '#ffffff', border: '#ea580c' },
  signoff: { background: '#a855f7', glyph: '#ffffff', border: '#9333ea' },
};

const statusColors: Record<string, string> = {
  'Draft': '#64748b',
  'In Progress': '#3b82f6',
  'Awaiting Signatures': '#f59e0b',
  'Signed Off': '#10b981',
};

function getMarkerColor(type: MarkerType, status?: string) {
  if (status && statusColors[status]) {
    return { background: statusColors[status], glyph: '#ffffff', border: statusColors[status] };
  }
  return markerColors[type];
}

// Component to auto-fit bounds when markers change
function MapBoundsUpdater({ markers, userLocation }: { markers: MapMarker[]; userLocation: { lat: number; lng: number } | null }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    if (markers.length === 0 && !userLocation) return;

    const bounds = new google.maps.LatLngBounds();
    let hasValidMarkers = false;

    markers.forEach(marker => {
      if (typeof marker.lat === 'number' && typeof marker.lng === 'number') {
        bounds.extend({ lat: marker.lat, lng: marker.lng });
        hasValidMarkers = true;
      }
    });

    if (userLocation) {
      bounds.extend(userLocation);
      hasValidMarkers = true;
    }

    if (hasValidMarkers) {
      if (markers.length === 1 && !userLocation) {
        map.setCenter({ lat: markers[0].lat, lng: markers[0].lng });
        map.setZoom(14);
      } else {
        map.fitBounds(bounds, 50);
      }
    }
  }, [map, markers, userLocation]);

  return null;
}

export function GoogleMap({
  markers,
  center,
  zoom = 12,
  height = '400px',
  onMarkerClick,
  showUserLocation = false,
}: GoogleMapProps) {
  const { isLoaded, error } = useGoogleMapsApi();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [activeMarker, setActiveMarker] = useState<MapMarker | null>(null);

  useEffect(() => {
    if (showUserLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {}
      );
    }
  }, [showUserLocation]);

  const defaultCenter = useMemo(() => {
    return center || userLocation || { lat: 51.5074, lng: -0.1278 };
  }, [center, userLocation]);

  const handleMarkerClick = useCallback(
    (marker: MapMarker) => {
      setActiveMarker(marker);
      onMarkerClick?.(marker);
    },
    [onMarkerClick]
  );

  if (error) {
    return (
      <div
        className="flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-lg border"
        style={{ height }}
      >
        <div className="text-center text-muted-foreground p-4">
          <p className="font-medium">Map unavailable</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div
        className="flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-lg border"
        style={{ height }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative rounded-lg overflow-hidden border" style={{ height }}>
      <Map
        defaultCenter={defaultCenter}
        defaultZoom={zoom}
        gestureHandling="greedy"
        disableDefaultUI={false}
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={true}
        zoomControl={true}
        mapId="reactpms-main-map"
        style={{ width: '100%', height: '100%' }}
      >
        <MapBoundsUpdater markers={markers} userLocation={showUserLocation ? userLocation : null} />

        {markers.map((marker) => {
          if (typeof marker.lat !== 'number' || typeof marker.lng !== 'number') return null;
          const colors = getMarkerColor(marker.type, marker.status);

          return (
            <AdvancedMarker
              key={marker.id}
              position={{ lat: marker.lat, lng: marker.lng }}
              title={marker.title}
              onClick={() => handleMarkerClick(marker)}
            >
              <Pin
                background={colors.background}
                glyphColor={colors.glyph}
                borderColor={colors.border}
                scale={marker.type === 'engineer' ? 1.2 : 1.0}
              />
            </AdvancedMarker>
          );
        })}

        {userLocation && showUserLocation && (
          <AdvancedMarker
            position={userLocation}
            title="Your Location"
          >
            <div className="relative">
              <div className="w-4 h-4 bg-red-500 border-2 border-white rounded-full shadow-lg" />
              <div className="absolute inset-0 w-4 h-4 bg-red-400 rounded-full animate-ping opacity-75" />
            </div>
          </AdvancedMarker>
        )}

        {activeMarker && (
          <InfoWindow
            position={{ lat: activeMarker.lat, lng: activeMarker.lng }}
            onCloseClick={() => setActiveMarker(null)}
            pixelOffset={[0, -40]}
          >
            <div className="p-2 max-w-[200px]">
              <strong className="text-sm block">{activeMarker.title}</strong>
              {activeMarker.subtitle && (
                <p className="text-xs text-gray-600 mt-1">{activeMarker.subtitle}</p>
              )}
              {activeMarker.status && (
                <span
                  className="inline-block mt-2 px-2 py-0.5 rounded text-xs text-white"
                  style={{ backgroundColor: getMarkerColor(activeMarker.type, activeMarker.status).background }}
                >
                  {activeMarker.status}
                </span>
              )}
            </div>
          </InfoWindow>
        )}
      </Map>
    </div>
  );
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    // Use the Google Maps Geocoder if available
    if (window.google?.maps?.Geocoder) {
      const geocoder = new google.maps.Geocoder();
      const result = await geocoder.geocode({ location: { lat, lng } });
      if (result.results && result.results[0]) {
        return result.results[0].formatted_address;
      }
    }
  } catch {
    // Fall through to coordinates
  }
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

export default GoogleMap;
