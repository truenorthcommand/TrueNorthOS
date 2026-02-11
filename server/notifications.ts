import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';
import { sessionMiddleware } from './session';
import { storage } from './storage';
import { pool } from './db';
import { sendEmail } from './email';

interface NotificationClient {
  ws: WebSocket;
  userId: string;
  userRole: string;
}

const clients: NotificationClient[] = [];

const DEFAULT_NOTIFICATION_PREFERENCES = {
  jobs: { inApp: true, email: true, push: true },
  messages: { inApp: true, email: false, push: true },
  expenses: { inApp: true, email: true, push: false },
  fleet: { inApp: true, email: false, push: false },
  system: { inApp: true, email: false, push: false },
};

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

async function getUserPreferences(userId: string): Promise<Record<string, { inApp: boolean; email: boolean; push: boolean }>> {
  try {
    const result = await pool.query(
      `SELECT notification_preferences FROM users WHERE id = $1`,
      [userId]
    );
    const prefs = result.rows[0]?.notification_preferences;
    if (prefs && Object.keys(prefs).length > 0) {
      return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...prefs };
    }
    return DEFAULT_NOTIFICATION_PREFERENCES;
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

async function persistNotification(params: {
  userId: string;
  type: string;
  category: string;
  title: string;
  message: string;
  metadata?: any;
  linkUrl?: string;
  emailSent?: boolean;
}): Promise<string | null> {
  try {
    const result = await pool.query(
      `INSERT INTO notifications (user_id, type, category, title, message, metadata, link_url, email_sent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [params.userId, params.type, params.category, params.title, params.message, 
       JSON.stringify(params.metadata || {}), params.linkUrl || null, params.emailSent || false]
    );
    return result.rows[0]?.id || null;
  } catch (error) {
    console.error('Failed to persist notification:', error);
    return null;
  }
}

async function sendNotificationEmail(userId: string, title: string, message: string, linkUrl?: string) {
  try {
    const user = await storage.getUser(userId);
    if (!user?.email) return false;

    const companyResult = await pool.query(`SELECT company_name FROM company_settings LIMIT 1`);
    const companyName = companyResult.rows[0]?.company_name || 'TrueNorth OS';

    const linkHtml = linkUrl 
      ? `<p><a href="${linkUrl}" style="display: inline-block; background-color: #0F2B4C; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin: 10px 0;">View Details</a></p>`
      : '';

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #0F2B4C; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${companyName}</h1>
          </div>
          <div class="content">
            <h2>${title}</h2>
            <p>${message}</p>
            ${linkHtml}
          </div>
          <div class="footer">
            <p>You received this because you have email notifications enabled. You can change your notification preferences in Settings.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmail(user.email, `${companyName} — ${title}`, htmlBody);
  } catch (error) {
    console.error('Failed to send notification email:', error);
    return false;
  }
}

function isUserOnline(userId: string): boolean {
  return clients.some(c => c.userId === userId && c.ws.readyState === WebSocket.OPEN);
}

export async function createNotification(params: {
  userId: string;
  type: string;
  category?: string;
  title: string;
  message: string;
  metadata?: any;
  linkUrl?: string;
  urgent?: boolean;
}) {
  const category = params.category || 'system';
  const prefs = await getUserPreferences(params.userId);
  const categoryPrefs = prefs[category] || prefs.system;

  let emailSent = false;

  if (categoryPrefs.email) {
    const online = isUserOnline(params.userId);
    if (!online || params.urgent) {
      emailSent = await sendNotificationEmail(params.userId, params.title, params.message, params.linkUrl) || false;
    }
  }

  if (categoryPrefs.inApp) {
    const notifId = await persistNotification({
      userId: params.userId,
      type: params.type,
      category,
      title: params.title,
      message: params.message,
      metadata: params.metadata,
      linkUrl: params.linkUrl,
      emailSent,
    });

    sendToUsers([params.userId], {
      type: params.type,
      notificationId: notifId,
      title: params.title,
      message: params.message,
      category,
      linkUrl: params.linkUrl,
      metadata: params.metadata,
      urgent: params.urgent,
      timestamp: new Date().toISOString(),
    });
  }
}

export async function notifyAdmins(notification: {
  type: string;
  title: string;
  message: string;
  category?: string;
  jobId?: string;
  jobNo?: string;
  engineerName?: string;
  timestamp: string;
  urgent?: boolean;
  linkUrl?: string;
}) {
  try {
    const result = await pool.query(`SELECT id FROM users WHERE (role = 'admin' OR super_admin = true) AND status = 'active'`);
    const adminIds = result.rows.map(r => r.id);

    for (const adminId of adminIds) {
      await createNotification({
        userId: adminId,
        type: notification.type,
        category: notification.category || 'system',
        title: notification.title,
        message: notification.message,
        metadata: { jobId: notification.jobId, jobNo: notification.jobNo, engineerName: notification.engineerName },
        linkUrl: notification.linkUrl || (notification.jobId ? `/app/jobs/${notification.jobId}` : undefined),
        urgent: notification.urgent,
      });
    }

    return adminIds.length;
  } catch (error) {
    console.error('Failed to notify admins:', error);
    const adminClients = clients.filter(c => c.userRole === 'admin');
    const payload = JSON.stringify(notification);
    adminClients.forEach(client => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    });
    return adminClients.length;
  }
}

export async function notifyUser(userId: string, notification: {
  type: string;
  title: string;
  message: string;
  category?: string;
  urgent?: boolean;
  jobId?: string;
  jobNo?: string;
  expenseId?: string;
  defectId?: string;
  timestamp: string;
  linkUrl?: string;
}) {
  await createNotification({
    userId,
    type: notification.type,
    category: notification.category || 'system',
    title: notification.title,
    message: notification.message,
    metadata: { 
      jobId: notification.jobId, 
      jobNo: notification.jobNo, 
      expenseId: notification.expenseId, 
      defectId: notification.defectId 
    },
    linkUrl: notification.linkUrl || (notification.jobId ? `/app/jobs/${notification.jobId}` : undefined),
    urgent: notification.urgent,
  });
}

export async function notifyEngineers(notification: {
  type: string;
  title: string;
  message: string;
  category?: string;
  urgent?: boolean;
  jobId?: string;
  jobNo?: string;
  timestamp: string;
  linkUrl?: string;
}) {
  try {
    const result = await pool.query(`SELECT id FROM users WHERE role = 'engineer' AND status = 'active'`);
    const engineerIds = result.rows.map(r => r.id);

    for (const engineerId of engineerIds) {
      await createNotification({
        userId: engineerId,
        type: notification.type,
        category: notification.category || 'jobs',
        title: notification.title,
        message: notification.message,
        metadata: { jobId: notification.jobId, jobNo: notification.jobNo },
        linkUrl: notification.linkUrl || (notification.jobId ? `/app/jobs/${notification.jobId}` : undefined),
        urgent: notification.urgent,
      });
    }

    return engineerIds.length;
  } catch (error) {
    console.error('Failed to notify engineers:', error);
    const engineerClients = clients.filter(c => c.userRole === 'engineer');
    const payload = JSON.stringify(notification);
    engineerClients.forEach(client => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    });
    return engineerClients.length;
  }
}
