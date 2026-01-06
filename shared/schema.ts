import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, doublePrecision, boolean, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("engineer"),
  status: text("status").notNull().default("active"),
  currentLat: doublePrecision("current_lat"),
  currentLng: doublePrecision("current_lng"),
  lastLocationUpdate: timestamp("last_location_update"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobNo: text("job_no").notNull(),
  client: text("client"),
  customerName: text("customer_name").notNull(),
  address: text("address"),
  postcode: text("postcode"),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  date: timestamp("date").defaultNow(),
  session: text("session").default("AM"),
  orderNumber: integer("order_number"),
  description: text("description"),
  worksCompleted: text("works_completed"),
  notes: text("notes"),
  status: text("status").notNull().default("Draft"),
  assignedToId: varchar("assigned_to_id"),
  assignedToIds: jsonb("assigned_to_ids").default([]),
  materials: jsonb("materials").default([]),
  photos: jsonb("photos").default([]),
  signatures: jsonb("signatures").default([]),
  furtherActions: jsonb("further_actions").default([]),
  signOffLat: doublePrecision("sign_off_lat"),
  signOffLng: doublePrecision("sign_off_lng"),
  signOffAddress: text("sign_off_address"),
  signOffTimestamp: timestamp("sign_off_timestamp"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const engineerLocations = pgTable("engineer_locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  engineerId: varchar("engineer_id").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  accuracy: doublePrecision("accuracy"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertJobSchema = createInsertSchema(jobs, {
  date: z.coerce.date().optional(),
  signOffTimestamp: z.coerce.date().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEngineerLocationSchema = createInsertSchema(engineerLocations).omit({
  id: true,
  timestamp: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

export type InsertEngineerLocation = z.infer<typeof insertEngineerLocationSchema>;
export type EngineerLocation = typeof engineerLocations.$inferSelect;

export type Material = {
  id: string;
  name: string;
  quantity: string;
};

export type Photo = {
  id: string;
  url: string;
  timestamp: string;
  source: 'admin' | 'engineer';
};

export type Signature = {
  id: string;
  type: 'engineer' | 'customer';
  name: string;
  url: string;
  timestamp: string;
};

export type ActionPriority = 'low' | 'medium' | 'high' | 'urgent';

export type FurtherAction = {
  id: string;
  description: string;
  priority: ActionPriority;
  timestamp: string;
};

export type JobStatus = 'Draft' | 'In Progress' | 'Awaiting Signatures' | 'Signed Off';

export const aiAdvisors = pgTable("ai_advisors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull().default("Bot"),
  category: text("category").notNull().default("general"),
  systemPrompt: text("system_prompt").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAiAdvisorSchema = createInsertSchema(aiAdvisors).omit({
  id: true,
  createdAt: true,
});

export type InsertAiAdvisor = z.infer<typeof insertAiAdvisorSchema>;
export type AiAdvisor = typeof aiAdvisors.$inferSelect;
