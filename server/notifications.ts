import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';
import { sessionMiddleware } from './session';

interface NotificationClient {
  ws: WebSocket;
  userId: string;
  userRole: string;
}

const clients: NotificationClient[] = [];

export function setupNotifications(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws/notifications' });

  wss.on('connection', (ws, req: IncomingMessage) => {
    const mockRes = {
      setHeader: () => {},
      getHeader: () => undefined,
      on: () => {},
      once: () => {},
      emit: () => false,
      end: () => {},
    } as any;

    sessionMiddleware(req as any, mockRes, (err?: any) => {
      if (err) {
        ws.close(4000, 'Session error');
        return;
      }

      const session = (req as any).session;

      if (!session?.userId || !session?.userRole) {
        ws.close(4001, 'Authentication required');
        return;
      }

      if (session.userRole !== 'admin') {
        ws.close(4003, 'Admin access required');
        return;
      }

      const client: NotificationClient = { 
        ws, 
        userId: session.userId, 
        userRole: session.userRole 
      };
      clients.push(client);

      ws.on('close', () => {
        const index = clients.indexOf(client);
        if (index > -1) {
          clients.splice(index, 1);
        }
      });

      ws.on('error', () => {
        const index = clients.indexOf(client);
        if (index > -1) {
          clients.splice(index, 1);
        }
      });
    });
  });

  return wss;
}

export function notifyAdmins(notification: {
  type: string;
  title: string;
  message: string;
  jobId?: string;
  jobNo?: string;
  engineerName?: string;
  timestamp: string;
}) {
  const adminClients = clients.filter(c => c.userRole === 'admin');
  const payload = JSON.stringify(notification);

  adminClients.forEach(client => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  });

  return adminClients.length;
}
