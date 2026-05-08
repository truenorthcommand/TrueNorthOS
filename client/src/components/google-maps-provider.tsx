import { APIProvider } from '@vis.gl/react-google-maps';
import { useState, useEffect, useRef, createContext, useContext } from 'react';

interface GoogleMapsContextType {
  apiKey: string | null;
  isLoaded: boolean;
  error: string | null;
}

const GoogleMapsContext = createContext<GoogleMapsContextType>({
  apiKey: null,
  isLoaded: false,
  error: null
});

export function useGoogleMapsApi() {
  return useContext(GoogleMapsContext);
}

export function GoogleMapsProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const retryCount = useRef(0);

  useEffect(() => {
    const fetchKey = () => {
      fetch('/api/config/maps', { credentials: 'include' })
        .then(res => {
          if (!res.ok) {
            // Might not be authenticated yet - retry
            if (retryCount.current < 5) {
              retryCount.current++;
              setTimeout(fetchKey, 2000 * retryCount.current);
              return null;
            }
            throw new Error(`Maps config failed: ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          if (!data) return;
          if (data.apiKey) {
            setApiKey(data.apiKey);
            setError(null);
          } else {
            setError('Google Maps API key not configured on server');
          }
        })
        .catch(err => {
          console.error('[GoogleMapsProvider] Failed to load API key:', err);
          setError(err.message);
        });
    };
    fetchKey();
  }, []);

  const contextValue = {
    apiKey,
    isLoaded: !!apiKey,
    error
  };

  // If no key yet, still render children (non-map content works fine)
  // Maps will show loading state until key arrives
  if (!apiKey) {
    return (
      <GoogleMapsContext.Provider value={contextValue}>
        {children}
      </GoogleMapsContext.Provider>
    );
  }

  return (
    <GoogleMapsContext.Provider value={contextValue}>
      <APIProvider apiKey={apiKey} libraries={['places']}>
        {children}
      </APIProvider>
    </GoogleMapsContext.Provider>
  );
}
