import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    userRole?: string;
  }
}

const PgSession = connectPgSimple(session);

// Detect if running on Replit (always HTTPS in production)
const isProduction = process.env.NODE_ENV === 'production';
const isReplit = !!process.env.REPL_ID;

export const sessionMiddleware = session({
  store: new PgSession({
    pool: pool as any,
    tableName: 'session',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'promains-field-view-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  proxy: isReplit, // Trust Replit's proxy for secure cookies
  cookie: {
    secure: isReplit || isProduction, // Always secure on Replit
    httpOnly: true,
    sameSite: isReplit ? 'none' : 'lax', // 'none' required for cross-site cookies on mobile PWA
    maxAge: 7 * 24 * 60 * 60 * 1000,
  }
});
