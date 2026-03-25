/**
 * TrueNorthOS — Session Middleware
 *
 * Provider-agnostic Postgres-backed session store.
 * Works with both Google OAuth and username/password login flows.
 *
 * Required env vars:
 *   DATABASE_URL   — PostgreSQL connection string
 *   SESSION_SECRET — Long random string (generate with: openssl rand -hex 64)
 *
 * Cookie behaviour:
 *   Production (NODE_ENV=production): secure=true, sameSite=lax
 *   Development: secure=false, sameSite=lax
 */

import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    userRole?: string;
    portalClientId?: string;
  }
}

const PgSession = connectPgSimple(session);
const isProduction = process.env.NODE_ENV === "production";

export async function ensureSessionTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      );
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `);
    const check = await pool.query(
      `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'session' AND table_schema = 'public') as exists`,
    );
    if (!check.rows[0]?.exists) {
      throw new Error("Session table verification failed after creation attempt");
    }
    console.log("[Session] Session table verified/created successfully.");
  } catch (error) {
    console.error("[Session] FATAL: Failed to create session table:", error);
    process.exit(1);
  }
}

export const sessionMiddleware = session({
  store: new PgSession({
    pool: pool as any,
    tableName: "session",
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || "truenorthos-change-this-in-production",
  resave: false,
  saveUninitialized: false,
  proxy: isProduction, // Trust reverse proxy (Coolify/nginx) in production
  cookie: {
    secure: isProduction,   // HTTPS only in production
    httpOnly: true,
    sameSite: "lax",        // Safe for standard OAuth redirect flows
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
});
