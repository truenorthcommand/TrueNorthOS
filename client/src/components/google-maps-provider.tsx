import { APIProvider } from '@vis.gl/react-google-maps';
import { useState, useEffect, createContext, useContext } from 'react';

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

  useEffect(() => {
    fetch('/api/config/maps', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.apiKey) {
          setApiKey(data.apiKey);
        } else {
          setError('No API key configured');
        }
      })
      .catch(err => setError(err.message));
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
