import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

export interface Notification {
  type: string;
  title: string;
  message: string;
  jobId?: string;
  jobNo?: string;
  engineerName?: string;
  expenseId?: string;
  defectId?: string;
  urgent?: boolean;
  timestamp: string;
}

export function useNotifications(onNotification?: (notification: Notification) => void) {
  const { user } = useAuth();
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }, []);

  const showBrowserNotification = useCallback((notification: Notification) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const n = new Notification(notification.title, {
        body: notification.message,
        icon: '/logo.png',
        tag: notification.jobId || 'notification',
      });

      n.onclick = () => {
        window.focus();
        if (notification.jobId) {
          window.location.href = `/jobs/${notification.jobId}`;
        }
        n.close();
      };

      setTimeout(() => n.close(), 10000);
    }
  }, []);

  const connect = useCallback(() => {
    if (!user?.id) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/notifications`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const notification: Notification = JSON.parse(event.data);
        
        toast({
          title: notification.title,
          description: notification.message,
          variant: notification.urgent ? 'destructive' : 'default',
          duration: notification.urgent ? 10000 : 5000,
        });

        showBrowserNotification(notification);
        onNotification?.(notification);
      } catch (e) {
        console.error('Failed to parse notification:', e);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [user?.id, toast, showBrowserNotification, onNotification]);

  useEffect(() => {
    if (user?.id) {
      requestNotificationPermission();
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [user?.id, connect, requestNotificationPermission]);

  return { connected };
}
