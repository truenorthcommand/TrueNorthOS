import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';

const LOCATION_UPDATE_INTERVAL = 5 * 60 * 1000;

export function LocationTracker() {
  const { user } = useAuth();
  const watchIdRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

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
      if (now - lastUpdateRef.current < LOCATION_UPDATE_INTERVAL) {
        return;
      }
      
      lastUpdateRef.current = now;

      try {
        await fetch(`/api/users/${user.id}/location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
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
        { enableHighAccuracy: true, timeout: 10000 }
      );
    };

    sendInitialLocation();

    watchIdRef.current = navigator.geolocation.watchPosition(
      updateLocation,
      (error) => console.log('Watch location error:', error.message),
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 60000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [user]);

  return null;
}
