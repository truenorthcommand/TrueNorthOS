import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';
import { sessionMiddleware } from './session';
import { storage } from './storage';

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

      const client: NotificationClient = { 
        ws, 
        userId: session.userId, 
        userRole: session.userRole 
      };
      clients.push(client);

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'chat_message') {
            const { conversationId, content } = message;
            
            if (!conversationId || !content) {
              ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
              return;
            }

            const createdMessage = await storage.createMessage({
              conversationId,
              senderId: session.userId,
              content: content.trim(),
            });

            const user = await storage.getUser(session.userId);
            const messageWithSender = {
              ...createdMessage,
              sender: user ? { id: user.id, name: user.name, role: user.role } : null,
            };

            const conversations = await storage.getUserConversations(session.userId);
            const convo = conversations.find(c => c.id === conversationId);
            
            if (convo) {
              const memberIds = convo.members.map(m => m.userId);
              sendToUsers(memberIds, {
                type: 'new_message',
                conversationId,
                message: messageWithSender,
              });
            }
          } else if (message.type === 'typing') {
            const { conversationId, isTyping } = message;
            
            const conversations = await storage.getUserConversations(session.userId);
            const convo = conversations.find(c => c.id === conversationId);
            
            if (convo) {
              const memberIds = convo.members.filter(m => m.userId !== session.userId).map(m => m.userId);
              const user = await storage.getUser(session.userId);
              
              sendToUsers(memberIds, {
                type: 'user_typing',
                conversationId,
                userId: session.userId,
                userName: user?.name || 'Unknown',
                isTyping,
              });
            }
          } else if (message.type === 'mark_read') {
            const { conversationId } = message;
            await storage.markConversationRead(conversationId, session.userId);
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });

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

export function sendToUsers(userIds: string[], payload: any) {
  const message = JSON.stringify(payload);
  
  clients.forEach(client => {
    if (userIds.includes(client.userId) && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  });
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
