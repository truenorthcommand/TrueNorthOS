/// <reference types="@types/google.maps" />
import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

declare global {
  interface Window {
    google: typeof google;
    initGoogleMaps: () => void;
  }
}

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

interface GoogleMapProps {
  markers: MapMarker[];
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: string;
  onMarkerClick?: (marker: MapMarker) => void;
  showUserLocation?: boolean;
}

let cachedApiKey: string | null = null;

async function getGoogleMapsApiKey(): Promise<string> {
  if (cachedApiKey !== null) return cachedApiKey;
  
  try {
    const response = await fetch('/api/config/maps', { credentials: 'include' });
    if (response.ok) {
      const data = await response.json();
      cachedApiKey = data.apiKey || '';
    } else {
      cachedApiKey = '';
    }
  } catch {
    cachedApiKey = '';
  }
  return cachedApiKey as string;
}

const markerColors: Record<MarkerType, string> = {
  engineer: '#3b82f6',
  job: '#10b981', 
  signoff: '#f59e0b',
};

const statusColors: Record<string, string> = {
  'Draft': '#64748b',
  'In Progress': '#3b82f6',
  'Awaiting Signatures': '#f59e0b',
  'Signed Off': '#10b981',
};

let isScriptLoading = false;
let isScriptLoaded = false;

async function loadGoogleMapsScript(): Promise<void> {
  if (isScriptLoaded && window.google?.maps) {
    return;
  }

  if (isScriptLoading) {
    return new Promise((resolve) => {
      const checkLoaded = setInterval(() => {
        if (isScriptLoaded && window.google?.maps) {
          clearInterval(checkLoaded);
          resolve();
        }
      }, 100);
    });
  }

  const apiKey = await getGoogleMapsApiKey();
  if (!apiKey) {
    throw new Error('Google Maps API key not configured');
  }

  isScriptLoading = true;

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      isScriptLoaded = true;
      isScriptLoading = false;
      resolve();
    };
    
    script.onerror = () => {
      isScriptLoading = false;
      reject(new Error('Failed to load Google Maps script'));
    };

    document.head.appendChild(script);
  });
}

export function GoogleMap({ 
  markers, 
  center, 
  zoom = 12, 
  height = '400px',
  onMarkerClick,
  showUserLocation = false
}: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number; lng: number} | null>(null);

  useEffect(() => {
    if (showUserLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        () => {}
      );
    }
  }, [showUserLocation]);

  useEffect(() => {
    let mounted = true;

    async function initMap() {
      try {
        await loadGoogleMapsScript();
        
        if (!mounted || !mapRef.current) return;

        const defaultCenter = center || userLocation || { lat: 51.5074, lng: -0.1278 };

        const map = new google.maps.Map(mapRef.current, {
          center: defaultCenter,
          zoom,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }]
            }
          ]
        });

        mapInstanceRef.current = map;
        setIsLoading(false);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load map');
          setIsLoading(false);
        }
      }
    }

    initMap();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return;

    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    let hasValidMarkers = false;

    markers.forEach(markerData => {
      if (!markerData.lat || !markerData.lng) return;

      const position = { lat: markerData.lat, lng: markerData.lng };
      bounds.extend(position);
      hasValidMarkers = true;

      const color = markerData.status ? (statusColors[markerData.status] || markerColors[markerData.type]) : markerColors[markerData.type];
      
      const markerIcon = {
        path: markerData.type === 'engineer' 
          ? google.maps.SymbolPath.CIRCLE 
          : google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
        fillColor: color,
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
        scale: markerData.type === 'engineer' ? 12 : 8,
      };

      const marker = new google.maps.Marker({
        position,
        map: mapInstanceRef.current!,
        icon: markerIcon,
        title: markerData.title,
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; max-width: 200px;">
            <strong style="font-size: 14px;">${markerData.title}</strong>
            ${markerData.subtitle ? `<p style="margin: 4px 0 0; color: #666; font-size: 12px;">${markerData.subtitle}</p>` : ''}
            ${markerData.status ? `<span style="display: inline-block; margin-top: 4px; padding: 2px 6px; border-radius: 4px; font-size: 11px; background: ${color}; color: white;">${markerData.status}</span>` : ''}
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(mapInstanceRef.current!, marker);
        if (onMarkerClick) {
          onMarkerClick(markerData);
        }
      });

      markersRef.current.push(marker);
    });

    if (userLocation && showUserLocation) {
      const userMarker = new google.maps.Marker({
        position: userLocation,
        map: mapInstanceRef.current,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: '#ef4444',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
          scale: 10,
        },
        title: 'Your Location',
      });
      markersRef.current.push(userMarker);
      bounds.extend(userLocation);
      hasValidMarkers = true;
    }

    if (hasValidMarkers && markers.length > 1) {
      mapInstanceRef.current.fitBounds(bounds, 50);
    } else if (hasValidMarkers && markers.length === 1) {
      mapInstanceRef.current.setCenter({ lat: markers[0].lat, lng: markers[0].lng });
      mapInstanceRef.current.setZoom(14);
    }
  }, [markers, userLocation, showUserLocation, onMarkerClick]);

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

  return (
    <div className="relative rounded-lg overflow-hidden border" style={{ height }}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800 z-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const apiKey = await getGoogleMapsApiKey();
  if (!apiKey) {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }

  try {
    await loadGoogleMapsScript();
    const geocoder = new google.maps.Geocoder();
    
    return new Promise((resolve) => {
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          resolve(results[0].formatted_address);
        } else {
          resolve(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        }
      });
    });
  } catch {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
}
