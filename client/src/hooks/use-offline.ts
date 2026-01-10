import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export function useOffline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingActions, setPendingActions] = useState(0);
  const { toast } = useToast();

  const checkPendingActions = useCallback(async () => {
    if ('serviceWorker' in navigator) {
      const controller = navigator.serviceWorker.controller;
      if (controller) {
        const messageChannel = new MessageChannel();
        
        return new Promise<number>((resolve) => {
          messageChannel.port1.onmessage = (event) => {
            const count = event.data?.count || 0;
            setPendingActions(count);
            resolve(count);
          };
          
          controller.postMessage(
            { type: 'GET_OFFLINE_QUEUE_COUNT' },
            [messageChannel.port2]
          );
        });
      }
    }
    return 0;
  }, []);

  const syncOfflineQueue = useCallback(async () => {
    if ('serviceWorker' in navigator) {
      const controller = navigator.serviceWorker.controller;
      if (controller) {
        const messageChannel = new MessageChannel();
        
        return new Promise<{ success: boolean; error?: string }>((resolve) => {
          messageChannel.port1.onmessage = (event) => {
            resolve(event.data);
          };
          
          controller.postMessage(
            { type: 'PROCESS_OFFLINE_QUEUE' },
            [messageChannel.port2]
          );
        });
      }
    }
    return { success: false, error: 'Service worker not available' };
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: 'Back Online',
        description: 'Your connection has been restored. Syncing pending actions...',
      });
      
      syncOfflineQueue().then((result) => {
        if (result.success) {
          checkPendingActions();
        }
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: 'You are Offline',
        description: 'Changes will be saved and synced when you reconnect.',
        variant: 'destructive',
        duration: 10000,
      });
    };

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OFFLINE_QUEUE_SYNCED') {
        const { results } = event.data;
        checkPendingActions();
        
        if (results.success > 0) {
          toast({
            title: 'Actions Synced',
            description: `${results.success} pending action${results.success > 1 ? 's' : ''} synced successfully.`,
          });
        }
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    checkPendingActions();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
    };
  }, [toast, checkPendingActions, syncOfflineQueue]);

  return {
    isOnline,
    pendingActions,
    checkPendingActions,
    syncOfflineQueue,
  };
}
