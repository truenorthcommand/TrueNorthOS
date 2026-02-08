/// <reference path="./types.d.ts" />
import QuickBooks from 'node-quickbooks';
import { db } from '../../db';
import { sql } from 'drizzle-orm';

export interface QuickBooksTokens {
  accessToken: string;
  refreshToken: string;
  realmId: string;
  expiresAt: number;
}

function getQBOInstance(tokens: QuickBooksTokens): any {
  return new QuickBooks(
    process.env.QUICKBOOKS_CLIENT_ID!,
    process.env.QUICKBOOKS_CLIENT_SECRET!,
    tokens.accessToken,
    false,
    tokens.realmId,
    process.env.QUICKBOOKS_SANDBOX === 'true',
    false,
    null,
    '2.0',
    tokens.refreshToken
  );
}

export function getOAuthUri(): string {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI;
  const scope = 'com.intuit.quickbooks.accounting';
  return (
    `https://appcenter.intuit.com/connect/oauth2?` +
    `client_id=${clientId}&response_type=code&scope=${scope}` +
    `&redirect_uri=${encodeURIComponent(redirectUri!)}&state=truenorth`
  );
}

export async function exchangeCodeForTokens(code: string, realmId: string): Promise<QuickBooksTokens> {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID!;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET!;
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI!;

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`QuickBooks token exchange failed: ${err}`);
  }

  const data = await res.json();
  const tokens: QuickBooksTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    realmId,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  await storeTokens(tokens);
  return tokens;
}

async function refreshAccessToken(tokens: QuickBooksTokens): Promise<QuickBooksTokens> {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID!;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET!;
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`QuickBooks token refresh failed: ${err}`);
  }

  const data = await res.json();
  const refreshed: QuickBooksTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    realmId: tokens.realmId,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  await storeTokens(refreshed);
  return refreshed;
}

async function storeTokens(tokens: QuickBooksTokens): Promise<void> {
  await db.execute(sql`
    INSERT INTO integration_tokens (provider, tokens, updated_at)
    VALUES ('quickbooks', ${JSON.stringify(tokens)}::jsonb, NOW())
    ON CONFLICT (provider) DO UPDATE SET tokens = EXCLUDED.tokens, updated_at = NOW()
  `);
}

async function loadTokens(): Promise<QuickBooksTokens | null> {
  const result = await db.execute(sql`
    SELECT tokens FROM integration_tokens WHERE provider = 'quickbooks' LIMIT 1
  `);
  if (!result.rows?.length) return null;
  try {
    const row = result.rows[0] as any;
    return typeof row.tokens === 'string' ? JSON.parse(row.tokens) : row.tokens;
  } catch {
    return null;
  }
}

export async function getQBO(): Promise<any> {
  let tokens = await loadTokens();
  if (!tokens) throw new Error('QuickBooks not connected. Please connect via Settings → Integrations.');

  if (Date.now() >= tokens.expiresAt - 60_000) {
    tokens = await refreshAccessToken(tokens);
  }

  return getQBOInstance(tokens);
}

export async function isQuickBooksConnected(): Promise<boolean> {
  const tokens = await loadTokens();
  return tokens !== null;
}

export async function disconnectQuickBooks(): Promise<void> {
  await db.execute(sql`DELETE FROM integration_tokens WHERE provider = 'quickbooks'`);
}
