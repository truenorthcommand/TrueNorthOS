import { ConfidentialClientApplication, Configuration } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";

function getMsalClient(): ConfidentialClientApplication {
  const clientId = process.env.AZURE_CLIENT_ID;
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!clientId || !tenantId || !clientSecret) {
    throw new Error("Azure credentials not configured. Please set AZURE_CLIENT_ID, AZURE_TENANT_ID, and AZURE_CLIENT_SECRET environment variables.");
  }

  const msalConfig: Configuration = {
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      clientSecret,
    },
  };

  return new ConfidentialClientApplication(msalConfig);
}

async function getAccessToken(): Promise<string> {
  const cca = getMsalClient();
  const tokenRequest = {
    scopes: ["https://graph.microsoft.com/.default"],
  };

  const response = await cca.acquireTokenByClientCredential(tokenRequest);
  if (!response || !response.accessToken) {
    throw new Error("Failed to acquire access token");
  }
  return response.accessToken;
}

function getGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

export interface EmailMessage {
  subject: string;
  body: string;
  toRecipients: string[];
  ccRecipients?: string[];
  isHtml?: boolean;
}

export interface CalendarEvent {
  subject: string;
  body?: string;
  start: Date;
  end: Date;
  location?: string;
  attendees?: string[];
}

export async function sendEmail(fromEmail: string, message: EmailMessage): Promise<void> {
  const accessToken = await getAccessToken();
  const client = getGraphClient(accessToken);

  const mail = {
    message: {
      subject: message.subject,
      body: {
        contentType: message.isHtml ? "HTML" : "Text",
        content: message.body,
      },
      toRecipients: message.toRecipients.map((email) => ({
        emailAddress: { address: email },
      })),
      ccRecipients: message.ccRecipients?.map((email) => ({
        emailAddress: { address: email },
      })),
    },
    saveToSentItems: true,
  };

  await client.api(`/users/${fromEmail}/sendMail`).post(mail);
}

export async function getEmails(userEmail: string, top: number = 10): Promise<any[]> {
  const accessToken = await getAccessToken();
  const client = getGraphClient(accessToken);

  const messages = await client
    .api(`/users/${userEmail}/messages`)
    .top(top)
    .select("id,subject,from,receivedDateTime,bodyPreview,isRead")
    .orderby("receivedDateTime DESC")
    .get();

  return messages.value;
}

export async function getCalendarEvents(userEmail: string, top: number = 10): Promise<any[]> {
  const accessToken = await getAccessToken();
  const client = getGraphClient(accessToken);

  const events = await client
    .api(`/users/${userEmail}/calendar/events`)
    .top(top)
    .select("id,subject,start,end,location,bodyPreview,attendees")
    .orderby("start/dateTime DESC")
    .get();

  return events.value;
}

export async function createCalendarEvent(userEmail: string, event: CalendarEvent): Promise<any> {
  const accessToken = await getAccessToken();
  const client = getGraphClient(accessToken);

  const graphEvent = {
    subject: event.subject,
    body: {
      contentType: "Text",
      content: event.body || "",
    },
    start: {
      dateTime: event.start.toISOString(),
      timeZone: "UTC",
    },
    end: {
      dateTime: event.end.toISOString(),
      timeZone: "UTC",
    },
    location: event.location ? { displayName: event.location } : undefined,
    attendees: event.attendees?.map((email) => ({
      emailAddress: { address: email },
      type: "required",
    })),
  };

  return await client.api(`/users/${userEmail}/calendar/events`).post(graphEvent);
}

export async function testConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const accessToken = await getAccessToken();
    if (accessToken) {
      return { success: true, message: "Successfully connected to Microsoft Graph API" };
    }
    return { success: false, message: "Failed to get access token" };
  } catch (error: any) {
    return { success: false, message: error.message || "Connection failed" };
  }
}

export async function getEmailById(userEmail: string, messageId: string): Promise<any> {
  const accessToken = await getAccessToken();
  const client = getGraphClient(accessToken);

  const message = await client
    .api(`/users/${userEmail}/messages/${messageId}`)
    .select("id,subject,from,toRecipients,ccRecipients,receivedDateTime,body,bodyPreview,isRead,hasAttachments,importance,conversationId")
    .get();

  return message;
}

export async function getEmailAttachments(userEmail: string, messageId: string): Promise<any[]> {
  const accessToken = await getAccessToken();
  const client = getGraphClient(accessToken);

  const attachments = await client
    .api(`/users/${userEmail}/messages/${messageId}/attachments`)
    .get();

  return attachments.value;
}

export async function getAttachmentContent(userEmail: string, messageId: string, attachmentId: string): Promise<any> {
  const accessToken = await getAccessToken();
  const client = getGraphClient(accessToken);

  const attachment = await client
    .api(`/users/${userEmail}/messages/${messageId}/attachments/${attachmentId}`)
    .get();

  return attachment;
}

export async function replyToEmail(userEmail: string, messageId: string, replyBody: string, replyAll: boolean = false): Promise<void> {
  const accessToken = await getAccessToken();
  const client = getGraphClient(accessToken);

  const reply = {
    message: {
      body: {
        contentType: "HTML",
        content: replyBody,
      },
    },
  };

  const endpoint = replyAll ? "replyAll" : "reply";
  await client.api(`/users/${userEmail}/messages/${messageId}/${endpoint}`).post(reply);
}

export async function searchEmails(userEmail: string, query: string, top: number = 20): Promise<any[]> {
  const accessToken = await getAccessToken();
  const client = getGraphClient(accessToken);

  const sanitizedQuery = query.replace(/'/g, "''").replace(/[\\"%&]/g, "");

  const messages = await client
    .api(`/users/${userEmail}/messages`)
    .filter(`contains(subject,'${sanitizedQuery}') or contains(from/emailAddress/address,'${sanitizedQuery}')`)
    .top(top)
    .select("id,subject,from,receivedDateTime,bodyPreview,isRead,hasAttachments")
    .orderby("receivedDateTime DESC")
    .get();

  return messages.value;
}

export async function markEmailAsRead(userEmail: string, messageId: string, isRead: boolean = true): Promise<void> {
  const accessToken = await getAccessToken();
  const client = getGraphClient(accessToken);

  await client
    .api(`/users/${userEmail}/messages/${messageId}`)
    .patch({ isRead });
}

export async function getUsers(): Promise<any[]> {
  const accessToken = await getAccessToken();
  const client = getGraphClient(accessToken);

  const users = await client
    .api('/users')
    .select('id,displayName,mail,userPrincipalName')
    .top(50)
    .get();

  return users.value;
}
