// Email utility using Outlook integration
// Reference: Replit Outlook connection (conn_outlook_01KFNZ30YV9C8B9ETQSBSZXMBG)
import { Client } from '@microsoft/microsoft-graph-client';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings?.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  if (!hostname) {
    throw new Error('REPLIT_CONNECTORS_HOSTNAME not configured');
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
    throw new Error(`Connector API returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  connectionSettings = data.items?.[0];

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Outlook not connected - no valid access token found');
  }
  return accessToken;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
async function getUncachableOutlookClient() {
  const accessToken = await getAccessToken();

  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => accessToken
    }
  });
}

export async function sendEmail(to: string, subject: string, htmlBody: string): Promise<boolean> {
  try {
    const client = await getUncachableOutlookClient();
    
    await client.api('/me/sendMail').post({
      message: {
        subject,
        body: {
          contentType: 'HTML',
          content: htmlBody
        },
        toRecipients: [
          {
            emailAddress: {
              address: to
            }
          }
        ]
      }
    });
    
    console.log(`Email sent successfully to ${to}`);
    return true;
  } catch (error: any) {
    console.error('Failed to send email:', error?.message || error);
    if (error?.statusCode) {
      console.error('Status code:', error.statusCode);
    }
    if (error?.body) {
      console.error('Error body:', JSON.stringify(error.body));
    }
    return false;
  }
}

export async function sendPortalInvitation(
  clientEmail: string,
  clientName: string,
  portalUrl: string,
  companyName: string
): Promise<boolean> {
  const subject = `${companyName} - Your Customer Portal Access`;
  
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #0F2B4C; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background-color: #0F2B4C; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${companyName}</h1>
        </div>
        <div class="content">
          <h2>Welcome to Your Customer Portal</h2>
          <p>Dear ${clientName},</p>
          <p>You have been invited to access your customer portal where you can view your quotes, invoices, and job history.</p>
          <p><a href="${portalUrl}" class="button">Access Your Portal</a></p>
          <p>When you first access the portal, you'll be asked to create a password to secure your account.</p>
          <p>If you have any questions, please don't hesitate to contact us.</p>
          <p>Best regards,<br>${companyName} Team</p>
        </div>
        <div class="footer">
          <p>This email was sent by ${companyName}. If you received this email in error, please disregard it.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail(clientEmail, subject, htmlBody);
}

export async function sendPasswordResetEmail(
  clientEmail: string,
  clientName: string,
  resetUrl: string,
  companyName: string
): Promise<boolean> {
  const subject = `${companyName} - Password Reset Request`;
  
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #0F2B4C; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background-color: #0F2B4C; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .warning { color: #dc2626; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${companyName}</h1>
        </div>
        <div class="content">
          <h2>Password Reset Request</h2>
          <p>Dear ${clientName},</p>
          <p>We received a request to reset your customer portal password. Click the button below to set a new password:</p>
          <p><a href="${resetUrl}" class="button">Reset Password</a></p>
          <p class="warning">This link will expire in 1 hour.</p>
          <p>If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.</p>
          <p>Best regards,<br>${companyName} Team</p>
        </div>
        <div class="footer">
          <p>This email was sent by ${companyName}. If you received this email in error, please disregard it.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail(clientEmail, subject, htmlBody);
}
