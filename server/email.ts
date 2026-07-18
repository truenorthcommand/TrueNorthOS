import * as nodemailer from 'nodemailer';

// Gmail SMTP transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

const FROM_NAME = process.env.COMPANY_NAME || 'React PMS';
const FROM_EMAIL = process.env.GMAIL_USER || 'noreply@reactpms.com';

/**
 * Send a generic email via Gmail SMTP
 */
export async function sendEmail(to: string, subject: string, htmlBody: string): Promise<boolean> {
  try {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.warn('[email.ts] GMAIL_USER or GMAIL_APP_PASSWORD not configured. Email not sent.');
      return false;
    }

    const info = await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to,
      subject,
      html: htmlBody
    });

    console.log(`[email.ts] Email sent successfully to ${to}. MessageId: ${info.messageId}`);
    return true;
  } catch (error: any) {
    console.error(`[email.ts] Failed to send email - Recipient: ${to}, Subject: "${subject}", Error:`, error.message || error);
    return false;
  }
}

/**
 * Send a quote email with Accept/Reject buttons
 */
export async function sendQuoteEmail(
  to: string,
  customerName: string,
  quoteNo: string,
  total: string,
  acceptUrl: string,
  rejectUrl: string
): Promise<boolean> {
  const subject = `Quote ${quoteNo} - Ready for Your Review`;

  const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f7fa;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);padding:32px 40px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">${FROM_NAME}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="color:#1e293b;margin:0 0 16px;font-size:20px;">Hello ${customerName},</h2>
              <p style="color:#475569;font-size:16px;line-height:1.6;margin:0 0 24px;">
                Your quote is ready for review. Please find the details below.
              </p>
              
              <!-- Quote Summary Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin:0 0 32px;">
                <tr>
                  <td style="padding:24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color:#64748b;font-size:14px;padding:4px 0;">Quote Number</td>
                        <td style="color:#1e293b;font-size:14px;font-weight:600;text-align:right;padding:4px 0;">${quoteNo}</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="border-bottom:1px solid #e2e8f0;padding:8px 0;"></td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;font-size:14px;padding:12px 0 4px;">Total Amount</td>
                        <td style="color:#1e293b;font-size:22px;font-weight:700;text-align:right;padding:12px 0 4px;">£${total}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 32px;">
                Click the button below to view the full quote details and accept or request changes.
              </p>

              <!-- Action Buttons -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:0 0 16px;">
                    <a href="${acceptUrl}" style="display:inline-block;background:linear-gradient(135deg,#16a34a 0%,#22c55e 100%);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:16px;font-weight:600;box-shadow:0 2px 4px rgba(22,163,74,0.3);">
                      ✓ View &amp; Accept Quote
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <a href="${rejectUrl}" style="display:inline-block;background:#ffffff;color:#dc2626;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:500;border:2px solid #fecaca;">
                      Request Changes
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center;">
              <p style="color:#94a3b8;font-size:13px;margin:0;line-height:1.5;">
                This quote is valid for 30 days from the date of issue.<br>
                If you have any questions, please reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return sendEmail(to, subject, htmlBody);
}

/**
 * Send a portal invitation email
 */
export async function sendPortalInvitation(
  clientEmail: string,
  clientName: string,
  portalUrl: string,
  companyName: string
): Promise<boolean> {
  const subject = `You've been invited to ${companyName}'s Client Portal`;
  const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f7fa;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">
        <tr><td style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);padding:32px 40px;text-align:center;"><h1 style="color:#ffffff;margin:0;font-size:24px;">${companyName}</h1></td></tr>
        <tr><td style="padding:40px;">
          <h2 style="color:#1e293b;margin:0 0 16px;">Hello ${clientName},</h2>
          <p style="color:#475569;font-size:16px;line-height:1.6;">You've been invited to access the client portal where you can view your jobs, quotes, and invoices.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0;"><tr><td align="center">
            <a href="${portalUrl}" style="display:inline-block;background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:16px;font-weight:600;">Access Your Portal</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center;"><p style="color:#94a3b8;font-size:13px;margin:0;">This link is unique to you. Do not share it with others.</p></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return sendEmail(clientEmail, subject, htmlBody);
}

/**
 * Send a password reset email
 */
export async function sendPasswordResetEmail(
  clientEmail: string,
  clientName: string,
  resetUrl: string,
  companyName: string
): Promise<boolean> {
  const subject = `Password Reset - ${companyName}`;
  const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f7fa;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">
        <tr><td style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);padding:32px 40px;text-align:center;"><h1 style="color:#ffffff;margin:0;font-size:24px;">${companyName}</h1></td></tr>
        <tr><td style="padding:40px;">
          <h2 style="color:#1e293b;margin:0 0 16px;">Hello ${clientName},</h2>
          <p style="color:#475569;font-size:16px;line-height:1.6;">We received a request to reset your password. Click the button below to set a new password.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0;"><tr><td align="center">
            <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:16px;font-weight:600;">Reset Password</a>
          </td></tr></table>
          <p style="color:#94a3b8;font-size:14px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
        </td></tr>
        <tr><td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center;"><p style="color:#94a3b8;font-size:13px;margin:0;">If you didn't request a password reset, no action is needed.</p></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return sendEmail(clientEmail, subject, htmlBody);
}
