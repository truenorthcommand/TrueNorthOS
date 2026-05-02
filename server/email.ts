// Email utility stub - Outlook integration removed
// Email sending is currently disabled. Re-enable via SMTP or other provider.

export async function sendEmail(to: string, subject: string, htmlBody: string): Promise<boolean> {
  console.warn(`[email.ts] sendEmail called but email is disabled. Would send to: ${to}, subject: ${subject}`);
  return false;
}

export async function sendPortalInvitation(
  clientEmail: string,
  clientName: string,
  portalUrl: string,
  companyName: string
): Promise<boolean> {
  console.warn(`[email.ts] sendPortalInvitation called but email is disabled. Would send to: ${clientEmail}`);
  return false;
}

export async function sendPasswordResetEmail(
  clientEmail: string,
  clientName: string,
  resetUrl: string,
  companyName: string
): Promise<boolean> {
  console.warn(`[email.ts] sendPasswordResetEmail called but email is disabled. Would send to: ${clientEmail}`);
  return false;
}
