import { ConfidentialClientApplication, Configuration } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";

// Replit Outlook Connector - connection:conn_outlook_01KF1GC1SRTJYFTZF7P2MXQ82W
let connectionSettings: any;

// Helper to extract access token from connection settings
function extractAccessToken(settings: any): string | null {
  if (!settings?.settings) return null;
  return settings.settings.access_token || 
         settings.settings.oauth?.credentials?.access_token || 
         null;
}

// Get access token via Replit Connector (preferred method)
async function getConnectorAccessToken(): Promise<string | null> {
  try {
    // Check if we have a cached token that's still valid
    if (connectionSettings?.settings?.expires_at && 
        new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
      const cachedToken = extractAccessToken(connectionSettings);
      if (cachedToken) {
        return cachedToken;
      }
      // Token missing from cache, reset and refetch
      connectionSettings = null;
    }

    const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
    if (!hostname) {
      return null; // Connector not available
    }

    const xReplitToken = process.env.REPL_IDENTITY 
      ? 'repl ' + process.env.REPL_IDENTITY 
      : process.env.WEB_REPL_RENEWAL 
      ? 'depl ' + process.env.WEB_REPL_RENEWAL 
      : null;

    if (!xReplitToken) {
      return null; // Token not available
    }

    const response = await fetch(
      'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=outlook',
      {
        headers: {
          'Accept': 'application/json',
          'X_REPLIT_TOKEN': xReplitToken
        }
      }
    );

    if (!response.ok) {
      console.error('Connector API error:', response.status, response.statusText);
      connectionSettings = null;
      return null;
    }

    const data = await response.json();
    connectionSettings = data.items?.[0];

    if (!connectionSettings) {
      console.error('No Outlook connection found in connector response');
      return null;
    }

    const accessToken = extractAccessToken(connectionSettings);

    if (!accessToken) {
      console.error('No access token found in connector settings');
      connectionSettings = null;
      return null;
    }

    return accessToken;
  } catch (error) {
    console.error('Connector auth error:', error);
    connectionSettings = null;
    return null;
  }
}

// Legacy Azure credentials authentication (fallback)
function getMsalClient(): ConfidentialClientApplication | null {
  const clientId = process.env.AZURE_CLIENT_ID;
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!clientId || !tenantId || !clientSecret) {
    return null;
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

async function getLegacyAccessToken(): Promise<string | null> {
  const cca = getMsalClient();
  if (!cca) return null;

  const tokenRequest = {
    scopes: ["https://graph.microsoft.com/.default"],
  };

  try {
    const response = await cca.acquireTokenByClientCredential(tokenRequest);
    return response?.accessToken || null;
  } catch (error) {
    console.error('Legacy auth error:', error);
    return null;
  }
}

// Track which auth method is being used (delegated = /me, application = /users/{email})
let isUsingDelegatedAuth = false;

// Get access token - tries Replit Connector first, then falls back to Azure credentials
async function getAccessToken(): Promise<string> {
  // Try Replit Connector first (preferred) - uses delegated permissions
  const connectorToken = await getConnectorAccessToken();
  if (connectorToken) {
    isUsingDelegatedAuth = true;
    return connectorToken;
  }

  // Fall back to legacy Azure credentials - uses application permissions
  const legacyToken = await getLegacyAccessToken();
  if (legacyToken) {
    isUsingDelegatedAuth = false;
    return legacyToken;
  }

  throw new Error("Outlook not connected. Please connect via the Outlook connector or configure Azure credentials.");
}

// Get the right API path for current auth mode
function getUserPath(userEmail: string): string {
  return isUsingDelegatedAuth ? "/me" : `/users/${userEmail}`;
}

function getGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

// Get a fresh Graph client (never cache - tokens expire)
export async function getOutlookClient(): Promise<Client> {
  const accessToken = await getAccessToken();
  return getGraphClient(accessToken);
}

// Get the current authenticated user's profile
export async function getCurrentUser(): Promise<{ email: string; displayName: string } | null> {
  try {
    const accessToken = await getAccessToken();
    const client = getGraphClient(accessToken);
    
    const user = await client
      .api('/me')
      .select('mail,displayName,userPrincipalName')
      .get();
    
    return {
      email: user.mail || user.userPrincipalName,
      displayName: user.displayName
    };
  } catch (error) {
    console.error('Failed to get current user:', error);
    return null;
  }
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

  await client.api(`${getUserPath(fromEmail)}/sendMail`).post(mail);
}

export async function getEmails(userEmail: string, top: number = 10): Promise<any[]> {
  const accessToken = await getAccessToken();
  const client = getGraphClient(accessToken);

  const messages = await client
    .api(`${getUserPath(userEmail)}/messages`)
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
    .api(`${getUserPath(userEmail)}/calendar/events`)
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

  return await client.api(`${getUserPath(userEmail)}/calendar/events`).post(graphEvent);
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
    .api(`${getUserPath(userEmail)}/messages/${messageId}`)
    .select("id,subject,from,toRecipients,ccRecipients,receivedDateTime,body,bodyPreview,isRead,hasAttachments,importance,conversationId")
    .get();

  return message;
}

export async function getEmailAttachments(userEmail: string, messageId: string): Promise<any[]> {
  const accessToken = await getAccessToken();
  const client = getGraphClient(accessToken);

  const attachments = await client
    .api(`${getUserPath(userEmail)}/messages/${messageId}/attachments`)
    .get();

  return attachments.value;
}

export async function getAttachmentContent(userEmail: string, messageId: string, attachmentId: string): Promise<any> {
  const accessToken = await getAccessToken();
  const client = getGraphClient(accessToken);

  const attachment = await client
    .api(`${getUserPath(userEmail)}/messages/${messageId}/attachments/${attachmentId}`)
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
  await client.api(`${getUserPath(userEmail)}/messages/${messageId}/${endpoint}`).post(reply);
}

export async function searchEmails(userEmail: string, query: string, top: number = 20): Promise<any[]> {
  const accessToken = await getAccessToken();
  const client = getGraphClient(accessToken);

  const sanitizedQuery = query.replace(/'/g, "''").replace(/[\\"%&]/g, "");

  const messages = await client
    .api(`${getUserPath(userEmail)}/messages`)
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
    .api(`${getUserPath(userEmail)}/messages/${messageId}`)
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

// AI Email Analysis Types
export interface EmailAnalysis {
  category: 'quote_request' | 'complaint' | 'job_update' | 'invoice_query' | 'general_enquiry' | 'booking_request' | 'cancellation' | 'feedback' | 'spam';
  priority: 'high' | 'medium' | 'low';
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
  summary: string;
  suggestedReply?: string;
  extractedData?: {
    clientName?: string;
    clientEmail?: string;
    clientPhone?: string;
    clientAddress?: string;
    jobDescription?: string;
    jobDate?: string;
    amount?: string;
  };
  matchedClientId?: number;
  matchedJobId?: number;
}

// Analyze email with AI - categorization, priority, sentiment, and data extraction
export async function analyzeEmailWithAI(
  emailContent: string, 
  fromEmail: string, 
  fromName: string,
  subject: string,
  existingClients: Array<{ id: number; name: string; email?: string; phone?: string }>,
  existingJobs: Array<{ id: number; customerName: string; jobNo: string; description?: string }>
): Promise<EmailAnalysis> {
  const OpenAI = (await import('openai')).default;
  
  // Use the Replit AI integrations credentials
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  
  if (!apiKey || !baseURL) {
    console.error('AI integration not configured: missing API key or base URL');
    return {
      category: 'general_enquiry',
      priority: 'medium',
      sentiment: 'neutral',
      summary: 'AI analysis unavailable - integration not configured',
    };
  }
  
  const openai = new OpenAI({ apiKey, baseURL });

  const clientList = existingClients.slice(0, 50).map(c => 
    `ID:${c.id} Name:"${c.name}" Email:${c.email || 'N/A'} Phone:${c.phone || 'N/A'}`
  ).join('\n');

  const jobList = existingJobs.slice(0, 30).map(j => 
    `ID:${j.id} JobNo:${j.jobNo} Customer:"${j.customerName}" Desc:${j.description?.substring(0, 50) || 'N/A'}`
  ).join('\n');

  const prompt = `Analyze this email from a UK trade business perspective. Return a JSON object with:

1. category: One of: quote_request, complaint, job_update, invoice_query, general_enquiry, booking_request, cancellation, feedback, spam
2. priority: high (urgent/time-sensitive/angry), medium (normal business), low (informational/marketing)
3. sentiment: positive, neutral, negative, or urgent (angry/frustrated customer)
4. summary: One sentence summary of what the email is about
5. suggestedReply: A professional, friendly reply draft (2-3 sentences, UK English)
6. extractedData: Object with clientName, clientEmail, clientPhone, clientAddress, jobDescription, jobDate, amount (if found)
7. matchedClientId: If the sender matches an existing client by email or name, return their ID (number), otherwise null
8. matchedJobId: If the email references an existing job, return its ID (number), otherwise null

EMAIL:
From: ${fromName} <${fromEmail}>
Subject: ${subject}
Body: ${emailContent.replace(/<[^>]*>/g, ' ').substring(0, 2000)}

EXISTING CLIENTS:
${clientList || 'None'}

EXISTING JOBS:
${jobList || 'None'}

Respond with ONLY valid JSON, no markdown or explanation.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content || '';
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleanContent);
  } catch (error) {
    console.error('AI email analysis error:', error);
    return {
      category: 'general_enquiry',
      priority: 'medium',
      sentiment: 'neutral',
      summary: 'Unable to analyze email',
    };
  }
}

// Generate smart reply for an email
export async function generateSmartReply(
  emailContent: string,
  fromName: string,
  subject: string,
  replyType: 'acknowledge' | 'quote' | 'schedule' | 'followup' | 'resolve' | 'custom',
  customInstructions?: string
): Promise<string> {
  const OpenAI = (await import('openai')).default;
  
  // Use the Replit AI integrations credentials
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  
  if (!apiKey || !baseURL) {
    console.error('AI integration not configured: missing API key or base URL');
    return `Dear ${fromName},\n\nThank you for your email. We will review your message and get back to you shortly.\n\nKind regards,\nThe Team`;
  }
  
  const openai = new OpenAI({ apiKey, baseURL });

  const replyInstructions = {
    acknowledge: 'Write a brief acknowledgment that we received their message and will respond soon.',
    quote: 'Write a reply offering to provide a quote, asking for any additional details needed.',
    schedule: 'Write a reply to schedule an appointment or site visit.',
    followup: 'Write a friendly follow-up checking if they need anything else.',
    resolve: 'Write a reply confirming the issue has been resolved and asking for feedback.',
    custom: customInstructions || 'Write a helpful reply.',
  };

  const prompt = `You are a professional UK trade business assistant. Write a reply email.

ORIGINAL EMAIL:
From: ${fromName}
Subject: ${subject}
Content: ${emailContent.replace(/<[^>]*>/g, ' ').substring(0, 1500)}

REPLY TYPE: ${replyInstructions[replyType]}

Requirements:
- Professional but friendly UK English
- Keep it concise (2-4 short paragraphs)
- Include appropriate greeting and sign-off
- Don't include subject line, just the body
- Sign off as "The Team" (they'll add their company name)

Write the reply email body only:`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 500,
    });

    return response.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('Smart reply generation error:', error);
    return `Dear ${fromName},\n\nThank you for your email. We will review your message and get back to you shortly.\n\nKind regards,\nThe Team`;
  }
}
