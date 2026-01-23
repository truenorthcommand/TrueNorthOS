import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Loader2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

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

interface LeafletMapProps {
  markers: MapMarker[];
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: string;
  onMarkerClick?: (marker: MapMarker) => void;
  showUserLocation?: boolean;
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

function createCustomIcon(type: MarkerType, status?: string): L.DivIcon {
  const color = status ? (statusColors[status] || markerColors[type]) : markerColors[type];
  const isEngineer = type === 'engineer';
  
  const svgIcon = isEngineer 
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
      </svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="32" viewBox="0 0 24 32" fill="${color}" stroke="white" stroke-width="2">
        <path d="M12 0C5.4 0 0 5.4 0 12c0 7.2 12 20 12 20s12-12.8 12-20c0-6.6-5.4-12-12-12zm0 18c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z"/>
      </svg>`;

  return L.divIcon({
    html: svgIcon,
    className: 'custom-marker',
    iconSize: isEngineer ? [24, 24] : [24, 32],
    iconAnchor: isEngineer ? [12, 12] : [12, 32],
    popupAnchor: [0, isEngineer ? -12 : -32],
  });
}

function createUserLocationIcon(): L.DivIcon {
  const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
    <circle cx="10" cy="10" r="8" fill="#ef4444" stroke="white" stroke-width="3"/>
  </svg>`;

  return L.divIcon({
    html: svgIcon,
    className: 'user-location-marker',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function MapBoundsUpdater({ markers, userLocation }: { markers: MapMarker[]; userLocation: { lat: number; lng: number } | null }) {
  const map = useMap();

  useEffect(() => {
    if (markers.length === 0 && !userLocation) return;

    const bounds = L.latLngBounds([]);
    
    markers.forEach(marker => {
      if (typeof marker.lat === 'number' && typeof marker.lng === 'number') {
        bounds.extend([marker.lat, marker.lng]);
      }
    });

    if (userLocation) {
      bounds.extend([userLocation.lat, userLocation.lng]);
    }

    if (bounds.isValid()) {
      if (markers.length === 1 && !userLocation) {
        map.setView([markers[0].lat, markers[0].lng], 14);
      } else {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [markers, userLocation, map]);

  return null;
}

export function LeafletMap({ 
  markers, 
  center, 
  zoom = 12, 
  height = '400px',
  onMarkerClick,
  showUserLocation = false
}: LeafletMapProps) {
  const [userLocation, setUserLocation] = useState<{lat: number; lng: number} | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
    setIsLoading(false);
  }, [showUserLocation]);

  const defaultCenter = center || userLocation || { lat: 51.5074, lng: -0.1278 };

  if (isLoading) {
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
      <style>{`
        .custom-marker, .user-location-marker {
          background: transparent;
          border: none;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 8px;
        }
        .leaflet-popup-content {
          margin: 8px 12px;
        }
      `}</style>
      <MapContainer
        center={[defaultCenter.lat, defaultCenter.lng]}
        zoom={zoom}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>'
          url={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${import.meta.env.VITE_MAPBOX_PUBLIC_KEY || ''}`}
          tileSize={512}
          zoomOffset={-1}
        />
        
        <MapBoundsUpdater markers={markers} userLocation={userLocation} />

        {markers.map((marker) => (
          typeof marker.lat === 'number' && typeof marker.lng === 'number' && (
            <Marker
              key={marker.id}
              position={[marker.lat, marker.lng]}
              icon={createCustomIcon(marker.type, marker.status)}
              eventHandlers={{
                click: () => onMarkerClick?.(marker),
              }}
            >
              <Popup>
                <div className="min-w-[150px]">
                  <strong className="text-sm">{marker.title}</strong>
                  {marker.subtitle && (
                    <p className="text-xs text-gray-600 mt-1">{marker.subtitle}</p>
                  )}
                  {marker.status && (
                    <span 
                      className="inline-block mt-2 px-2 py-0.5 rounded text-xs text-white"
                      style={{ backgroundColor: statusColors[marker.status] || markerColors[marker.type] }}
                    >
                      {marker.status}
                    </span>
                  )}
                </div>
              </Popup>
            </Marker>
          )
        ))}

        {userLocation && showUserLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={createUserLocationIcon()}
          >
            <Popup>
              <strong>Your Location</strong>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'TrueNorthFieldView/1.0'
        }
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  } catch {
    // Fall through to coordinates
  }
  
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

export type { MapMarker as LeafletMapMarker };
