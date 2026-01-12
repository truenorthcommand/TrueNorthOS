import { useEffect } from 'react';

const VERSION_KEY = 'truenorth_app_version';

export function useVersionCheck() {
  useEffect(() => {
    checkVersionAndClearCache();
  }, []);
}

async function checkVersionAndClearCache() {
  try {
    const res = await fetch('/api/version', { 
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    
    if (!res.ok) return;
    
    const data = await res.json();
    const serverVersion = data.version;
    const storedVersion = localStorage.getItem(VERSION_KEY);
    
    if (storedVersion && storedVersion !== serverVersion) {
      console.log(`New version detected: ${serverVersion} (was: ${storedVersion}). Clearing cache...`);
      
      await clearAllCaches();
      
      localStorage.setItem(VERSION_KEY, serverVersion);
      
      window.location.reload();
    } else if (!storedVersion) {
      localStorage.setItem(VERSION_KEY, serverVersion);
    }
  } catch (error) {
    console.log('Version check skipped (offline or error)');
  }
}

async function clearAllCaches() {
  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const messageChannel = new MessageChannel();
      const promise = new Promise<void>((resolve) => {
        messageChannel.port1.onmessage = () => resolve();
        setTimeout(resolve, 2000);
      });
      navigator.serviceWorker.controller.postMessage(
        { type: 'CLEAR_ALL_CACHES' },
        [messageChannel.port2]
      );
      await promise;
    }
    
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
  } catch (error) {
    console.error('Error clearing caches:', error);
  }
}
