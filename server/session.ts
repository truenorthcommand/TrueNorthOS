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

export const sessionMiddleware = session({
  store: new PgSession({
    pool: pool as any,
    tableName: 'session',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'promains-field-view-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  }
});
