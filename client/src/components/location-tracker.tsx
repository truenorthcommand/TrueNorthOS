import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';

// Update location every 1 minute for more accurate tracking
const LOCATION_UPDATE_INTERVAL = 60 * 1000;
// Minimum distance change (in meters) to trigger update
const MIN_DISTANCE_CHANGE = 10;

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function LocationTracker() {
  const { user } = useAuth();
  const watchIdRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!user || user.role !== 'engineer') {
      return;
    }

    if (!navigator.geolocation) {
      console.log('Geolocation not supported');
      return;
    }

    const updateLocation = async (position: GeolocationPosition) => {
      const now = Date.now();
      const newLat = position.coords.latitude;
      const newLng = position.coords.longitude;
      
      // Check if enough time has passed OR if position changed significantly
      const timePassed = now - lastUpdateRef.current >= LOCATION_UPDATE_INTERVAL;
      const positionChanged = !lastPositionRef.current || 
        calculateDistance(
          lastPositionRef.current.lat, 
          lastPositionRef.current.lng, 
          newLat, 
          newLng
        ) >= MIN_DISTANCE_CHANGE;
      
      // For first update, always send immediately
      const isFirstUpdate = lastUpdateRef.current === 0;
      
      if (!isFirstUpdate && !timePassed && !positionChanged) {
        return;
      }
      
      lastUpdateRef.current = now;
      lastPositionRef.current = { lat: newLat, lng: newLng };

      try {
        await fetch(`/api/users/${user.id}/location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            latitude: newLat,
            longitude: newLng,
            accuracy: position.coords.accuracy,
          }),
        });
      } catch (error) {
        console.error('Failed to update location:', error);
      }
    };

    const sendInitialLocation = () => {
      navigator.geolocation.getCurrentPosition(
        updateLocation,
        (error) => console.log('Location error:', error.message),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    };

    sendInitialLocation();

    watchIdRef.current = navigator.geolocation.watchPosition(
      updateLocation,
      (error) => console.log('Watch location error:', error.message),
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [user]);

  return null;
}
