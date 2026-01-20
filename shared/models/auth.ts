import { index, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

// Session storage table for Replit Auth OIDC.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const oauthSessions = pgTable(
  "oauth_sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_oauth_session_expire").on(table.expire)]
);

// Re-export types that the auth module expects
// The actual users table is defined in shared/schema.ts
export type UpsertUser = {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
};

export type User = {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
};
