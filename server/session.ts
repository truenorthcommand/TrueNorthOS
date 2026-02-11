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

const isProduction = process.env.NODE_ENV === 'production';
const isReplit = !!process.env.REPL_ID;

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
    const check = await pool.query(`SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'session' AND table_schema = 'public') as exists`);
    if (!check.rows[0]?.exists) {
      throw new Error("Session table verification failed after creation attempt");
    }
    console.log("Session table verified/created successfully");
  } catch (error) {
    console.error("FATAL: Failed to create session table:", error);
    process.exit(1);
  }
}

export const sessionMiddleware = session({
  store: new PgSession({
    pool: pool as any,
    tableName: 'session',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'promains-field-view-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  proxy: isReplit,
  cookie: {
    secure: isReplit || isProduction,
    httpOnly: true,
    sameSite: isReplit ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  }
});
