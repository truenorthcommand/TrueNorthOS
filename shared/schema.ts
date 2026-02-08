import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, doublePrecision, boolean, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  tabletNumber: text("tablet_number"),
  role: text("role").notNull().default("engineer"),
  roles: jsonb("roles").default(["engineer"]),
  superAdmin: boolean("super_admin").notNull().default(false),
  hasDirectorsSuite: boolean("has_directors_suite").notNull().default(false),
  status: text("status").notNull().default("active"),
  managerId: varchar("manager_id"),
  addressLine1: text("address_line_1"),
  addressLine2: text("address_line_2"),
  city: text("city"),
  county: text("county"),
  homePostcode: text("home_postcode"),
  dayRate: doublePrecision("day_rate"),
  homeLat: doublePrecision("home_lat"),
  homeLng: doublePrecision("home_lng"),
  currentLat: doublePrecision("current_lat"),
  currentLng: doublePrecision("current_lng"),
  lastLocationUpdate: timestamp("last_location_update"),
  licencePhotoUrl: text("licence_photo_url"),
  licenceUploadedAt: timestamp("licence_uploaded_at"),
  twoFactorSecret: text("two_factor_secret"),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  gdprConsentDate: timestamp("gdpr_consent_date"),
  gdprConsentVersion: text("gdpr_consent_version"),
  deletionRequestedAt: timestamp("deletion_requested_at"),
  workingAtHeight: boolean("working_at_height").notNull().default(false),
  negativeSkillIds: jsonb("negative_skill_ids").default([]),
  googleId: text("google_id"),
  profileImageUrl: text("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const skills = pgTable("skills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  category: text("category").notNull().default("trade"),
  icon: text("icon"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const subSkills = pgTable("sub_skills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  skillId: varchar("skill_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userSkills = pgTable("user_skills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  skillId: varchar("skill_id").notNull(),
  subSkillIds: jsonb("sub_skill_ids").default([]),
  proficiencyLevel: text("proficiency_level").default("standard"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobNo: text("job_no").notNull(),
  nickname: text("nickname"),
  client: text("client"),
  customerName: text("customer_name").notNull(),
  propertyId: varchar("property_id"),
  propertyName: text("property_name"),
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
  orderIndex: integer("order_index").default(0),
  isLongRunning: boolean("is_long_running").default(false),
  requiredSkills: jsonb("required_skills").default([]),
  urgency: text("urgency").default("normal"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedByUserId: varchar("updated_by_user_id"),
  qualityGateStatus: text("quality_gate_status").notNull().default("pending"),
  completionBlockedReason: text("completion_blocked_reason"),
  qualityOverrideBy: varchar("quality_override_by"),
  qualityOverrideReason: text("quality_override_reason"),
});

// Job updates for long-running jobs (2 updates per day max)
export const jobUpdates = pgTable("job_updates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull(),
  workDate: timestamp("work_date").notNull(),
  sequence: integer("sequence").notNull(), // 1 or 2
  notes: text("notes"),
  photos: jsonb("photos").default([]),
  engineerId: varchar("engineer_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  postcode: text("postcode"),
  contactName: text("contact_name"),
  notes: text("notes"),
  portalToken: text("portal_token"),
  portalEnabled: boolean("portal_enabled").default(false),
  portalPassword: text("portal_password"),
  portalPasswordSetAt: timestamp("portal_password_set_at"),
  passwordResetToken: text("password_reset_token"),
  passwordResetExpires: timestamp("password_reset_expires"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedByUserId: varchar("updated_by_user_id"),
});

// Client contacts - multiple contact persons per client
export const clientContacts = pgTable("client_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  role: text("role"), // e.g., "Site Manager", "Accounts", "Director"
  isPrimary: boolean("is_primary").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Client properties - multiple work sites/properties per client
export const clientProperties = pgTable("client_properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  name: text("name").notNull(), // e.g., "Head Office", "Warehouse", "Site A"
  address: text("address").notNull(),
  postcode: text("postcode"),
  contactName: text("contact_name"), // Site-specific contact
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  notes: text("notes"),
  isDefault: boolean("is_default").default(false),
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

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

export const insertClientContactSchema = createInsertSchema(clientContacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertClientContact = z.infer<typeof insertClientContactSchema>;
export type ClientContact = typeof clientContacts.$inferSelect;

export const insertClientPropertySchema = createInsertSchema(clientProperties).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertClientProperty = z.infer<typeof insertClientPropertySchema>;
export type ClientProperty = typeof clientProperties.$inferSelect;

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

export const insertJobUpdateSchema = createInsertSchema(jobUpdates, {
  workDate: z.coerce.date(),
}).omit({
  id: true,
  createdAt: true,
});

export type InsertJobUpdate = z.infer<typeof insertJobUpdateSchema>;
export type JobUpdate = typeof jobUpdates.$inferSelect;

export const insertSkillSchema = createInsertSchema(skills).omit({
  id: true,
  createdAt: true,
});

export const insertSubSkillSchema = createInsertSchema(subSkills).omit({
  id: true,
  createdAt: true,
});

export const insertUserSkillSchema = createInsertSchema(userSkills).omit({
  id: true,
  createdAt: true,
});

export type InsertSkill = z.infer<typeof insertSkillSchema>;
export type Skill = typeof skills.$inferSelect;

export type InsertSubSkill = z.infer<typeof insertSubSkillSchema>;
export type SubSkill = typeof subSkills.$inferSelect;

export type InsertUserSkill = z.infer<typeof insertUserSkillSchema>;
export type UserSkill = typeof userSkills.$inferSelect;

export type UserRole = 'admin' | 'engineer' | 'surveyor' | 'fleet_manager';

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
  gptId: text("gpt_id"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAiAdvisorSchema = createInsertSchema(aiAdvisors).omit({
  id: true,
  createdAt: true,
});

export type InsertAiAdvisor = z.infer<typeof insertAiAdvisorSchema>;
export type AiAdvisor = typeof aiAdvisors.$inferSelect;

export const timeLogs = pgTable("time_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  engineerId: varchar("engineer_id").notNull(),
  clockInTime: timestamp("clock_in_time").notNull(),
  clockOutTime: timestamp("clock_out_time"),
  clockInLat: doublePrecision("clock_in_lat"),
  clockInLng: doublePrecision("clock_in_lng"),
  clockInAddress: text("clock_in_address"),
  clockOutLat: doublePrecision("clock_out_lat"),
  clockOutLng: doublePrecision("clock_out_lng"),
  clockOutAddress: text("clock_out_address"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTimeLogSchema = createInsertSchema(timeLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertTimeLog = z.infer<typeof insertTimeLogSchema>;
export type TimeLog = typeof timeLogs.$inferSelect;

// Quote line item type
export type QuoteLineItem = {
  id: string;
  itemCode?: string;
  description: string;
  quantity: number;
  unitCost: number;
  discount: number;
  amount: number;
};

export type QuoteStatus = 'Draft' | 'Sent' | 'Accepted' | 'Declined' | 'Expired' | 'Converted';

export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteNo: text("quote_no").notNull(),
  customerId: varchar("customer_id"),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  siteAddress: text("site_address"),
  sitePostcode: text("site_postcode"),
  reference: text("reference"),
  quoteDate: timestamp("quote_date").defaultNow(),
  expiryDate: timestamp("expiry_date"),
  description: text("description"),
  lineItems: jsonb("line_items").default([]),
  subtotal: doublePrecision("subtotal").default(0),
  discountTotal: doublePrecision("discount_total").default(0),
  vatRate: doublePrecision("vat_rate").default(20),
  vatAmount: doublePrecision("vat_amount").default(0),
  total: doublePrecision("total").default(0),
  terms: text("terms"),
  notes: text("notes"),
  status: text("status").notNull().default("Draft"),
  declineReason: text("decline_reason"),
  acceptedAt: timestamp("accepted_at"),
  declinedAt: timestamp("declined_at"),
  sentAt: timestamp("sent_at"),
  accessToken: text("access_token"),
  convertedJobId: varchar("converted_job_id"),
  createdById: varchar("created_by_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertQuoteSchema = createInsertSchema(quotes, {
  quoteDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
  acceptedAt: z.coerce.date().optional(),
  declinedAt: z.coerce.date().optional(),
  sentAt: z.coerce.date().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotes.$inferSelect;

export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue' | 'Cancelled';

export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNo: text("invoice_no").notNull(),
  jobId: varchar("job_id"),
  quoteId: varchar("quote_id"),
  customerId: varchar("customer_id"),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  siteAddress: text("site_address"),
  sitePostcode: text("site_postcode"),
  invoiceDate: timestamp("invoice_date").defaultNow(),
  dueDate: timestamp("due_date"),
  lineItems: jsonb("line_items").default([]),
  subtotal: doublePrecision("subtotal").default(0),
  vatRate: doublePrecision("vat_rate").default(20),
  vatAmount: doublePrecision("vat_amount").default(0),
  total: doublePrecision("total").default(0),
  notes: text("notes"),
  status: text("status").notNull().default("Draft"),
  paidAt: timestamp("paid_at"),
  sentAt: timestamp("sent_at"),
  accessToken: text("access_token"),
  createdById: varchar("created_by_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertInvoiceSchema = createInsertSchema(invoices, {
  invoiceDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  paidAt: z.coerce.date().optional(),
  sentAt: z.coerce.date().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

export const companySettings = pgTable("company_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name"),
  companyAddress: text("company_address"),
  companyPhone: text("company_phone"),
  companyEmail: text("company_email"),
  bankName: text("bank_name"),
  bankAccountName: text("bank_account_name"),
  bankSortCode: text("bank_sort_code"),
  bankAccountNumber: text("bank_account_number"),
  vatNumber: text("vat_number"),
  defaultVatRate: doublePrecision("default_vat_rate").default(20),
  defaultPaymentTerms: integer("default_payment_terms").default(30),
  quoteTerms: text("quote_terms"),
  invoiceTerms: text("invoice_terms"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCompanySettingsSchema = createInsertSchema(companySettings).omit({
  id: true,
  updatedAt: true,
});

export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;
export type CompanySettings = typeof companySettings.$inferSelect;

// Team Messaging - Conversations
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name"), // null for direct messages, name for group chats
  isGroup: boolean("is_group").notNull().default(false),
  createdById: varchar("created_by_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

// Team Messaging - Conversation Members
export const conversationMembers = pgTable("conversation_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(),
  userId: varchar("user_id").notNull(),
  lastReadAt: timestamp("last_read_at"),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const insertConversationMemberSchema = createInsertSchema(conversationMembers).omit({
  id: true,
  joinedAt: true,
});

export type InsertConversationMember = z.infer<typeof insertConversationMemberSchema>;
export type ConversationMember = typeof conversationMembers.$inferSelect;

// Team Messaging - Messages
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(),
  senderId: varchar("sender_id").notNull(),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// Extended types for UI
export type ConversationWithDetails = Conversation & {
  members: (ConversationMember & { user: Pick<User, 'id' | 'name' | 'role'> })[];
  lastMessage?: Message & { sender: Pick<User, 'id' | 'name'> };
  unreadCount: number;
};

export type MessageWithSender = Message & {
  sender: Pick<User, 'id' | 'name' | 'role'>;
};

// Fleet Maintenance - Vehicles
export const vehicles = pgTable("vehicles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  registration: text("registration").notNull().unique(),
  make: text("make"),
  model: text("model"),
  year: integer("year"),
  type: text("type"), // Van, Truck, Car, etc.
  status: text("status").notNull().default("active"), // active, off-road, maintenance
  assignedUserId: varchar("assigned_user_id"), // Staff member assigned to this vehicle
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertVehicleSchema = createInsertSchema(vehicles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehicles.$inferSelect;

// Fleet Maintenance - Walkaround Checks
export const walkaroundChecks = pgTable("walkaround_checks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vehicleId: varchar("vehicle_id").notNull(),
  checkType: text("check_type").notNull(), // pre, post
  odometer: integer("odometer"),
  inspectorId: varchar("inspector_id").notNull(),
  overallStatus: text("overall_status").notNull().default("pass"), // pass, fail
  vehicleSafeToOperate: boolean("vehicle_safe_to_operate").default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWalkaroundCheckSchema = createInsertSchema(walkaroundChecks, {
  createdAt: z.coerce.date().optional(),
}).omit({
  id: true,
});

export type InsertWalkaroundCheck = z.infer<typeof insertWalkaroundCheckSchema>;
export type WalkaroundCheck = typeof walkaroundChecks.$inferSelect;

// Fleet Maintenance - Check Items (individual items in a walkaround check)
export const checkItems = pgTable("check_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  checkId: varchar("check_id").notNull(),
  itemName: text("item_name").notNull(), // tyres, lights, mirrors, etc.
  status: text("status").notNull(), // pass, fail, na
  note: text("note"),
  photoUrl: text("photo_url"),
  severity: text("severity"), // critical, major, minor - only if fail
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCheckItemSchema = createInsertSchema(checkItems).omit({
  id: true,
  createdAt: true,
});

export type InsertCheckItem = z.infer<typeof insertCheckItemSchema>;
export type CheckItem = typeof checkItems.$inferSelect;

// Fleet Maintenance - Defects
export const defects = pgTable("defects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vehicleId: varchar("vehicle_id").notNull(),
  checkId: varchar("check_id"), // null if standalone, linked if from walkaround
  checkItemId: varchar("check_item_id"), // which check item caused this defect
  category: text("category").notNull(), // tyres, lights, brakes, etc.
  severity: text("severity").notNull(), // critical, major, minor
  description: text("description").notNull(),
  photos: jsonb("photos").default([]),
  vehicleOffRoad: boolean("vehicle_off_road").notNull().default(false),
  status: text("status").notNull().default("open"), // open, in_progress, resolved, closed
  reportedById: varchar("reported_by_id").notNull(),
  assignedToId: varchar("assigned_to_id"),
  resolvedAt: timestamp("resolved_at"),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDefectSchema = createInsertSchema(defects, {
  resolvedAt: z.coerce.date().optional(),
  closedAt: z.coerce.date().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDefect = z.infer<typeof insertDefectSchema>;
export type Defect = typeof defects.$inferSelect;

// Fleet Maintenance - Defect Updates (comment/update history)
export const defectUpdates = pgTable("defect_updates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  defectId: varchar("defect_id").notNull(),
  userId: varchar("user_id").notNull(),
  comment: text("comment"),
  statusChange: text("status_change"), // what status it changed to
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDefectUpdateSchema = createInsertSchema(defectUpdates).omit({
  id: true,
  createdAt: true,
});

export type InsertDefectUpdate = z.infer<typeof insertDefectUpdateSchema>;
export type DefectUpdate = typeof defectUpdates.$inferSelect;

// Extended types for Fleet Maintenance UI
export type WalkaroundCheckWithDetails = WalkaroundCheck & {
  vehicle: Vehicle;
  inspector: Pick<User, 'id' | 'name'>;
  items: CheckItem[];
};

export type DefectWithDetails = Defect & {
  vehicle: Vehicle;
  reportedBy: Pick<User, 'id' | 'name'>;
  assignedTo?: Pick<User, 'id' | 'name'> | null;
  check?: WalkaroundCheck | null;
};

export type VehicleWithStats = Vehicle & {
  lastCheckDate: Date | null;
  openDefectsCount: number;
};

// ==================== TIMESHEETS ====================

export const timesheets = pgTable("timesheets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  date: timestamp("date").notNull(),
  clockIn: timestamp("clock_in"),
  clockOut: timestamp("clock_out"),
  clockInLatitude: doublePrecision("clock_in_latitude"),
  clockInLongitude: doublePrecision("clock_in_longitude"),
  clockInAddress: text("clock_in_address"),
  clockOutLatitude: doublePrecision("clock_out_latitude"),
  clockOutLongitude: doublePrecision("clock_out_longitude"),
  clockOutAddress: text("clock_out_address"),
  breakMinutes: integer("break_minutes").default(0),
  totalHours: doublePrecision("total_hours"),
  jobId: varchar("job_id"), // optional link to job
  notes: text("notes"),
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  approvedById: varchar("approved_by_id"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTimesheetSchema = createInsertSchema(timesheets, {
  date: z.coerce.date(),
  clockIn: z.coerce.date().optional(),
  clockOut: z.coerce.date().optional(),
  approvedAt: z.coerce.date().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTimesheet = z.infer<typeof insertTimesheetSchema>;
export type Timesheet = typeof timesheets.$inferSelect;

// ==================== EXPENSES ====================

export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  date: timestamp("date").notNull(),
  category: text("category").notNull(), // mileage, materials, tools, fuel, subsistence, other
  description: text("description").notNull(),
  amount: doublePrecision("amount").notNull(),
  vatAmount: doublePrecision("vat_amount").default(0),
  receiptUrl: text("receipt_url"),
  mileage: doublePrecision("mileage"), // for mileage claims
  mileageRate: doublePrecision("mileage_rate"), // pence per mile
  jobId: varchar("job_id"), // optional link to job
  clientId: varchar("client_id"), // optional link to client
  status: text("status").notNull().default("pending"), // pending, approved, rejected, paid
  approvedById: varchar("approved_by_id"),
  approvedAt: timestamp("approved_at"),
  paidAt: timestamp("paid_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertExpenseSchema = createInsertSchema(expenses, {
  date: z.coerce.date(),
  approvedAt: z.coerce.date().optional(),
  paidAt: z.coerce.date().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

// ==================== PAYMENTS ====================

export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull(),
  amount: doublePrecision("amount").notNull(),
  method: text("method").notNull(), // card, bank_transfer, cash, cheque
  status: text("status").notNull().default("pending"), // pending, completed, failed, refunded
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeChargeId: text("stripe_charge_id"),
  cardLast4: text("card_last4"),
  cardBrand: text("card_brand"),
  reference: text("reference"), // bank transfer ref, cheque number, etc.
  notes: text("notes"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPaymentSchema = createInsertSchema(payments, {
  paidAt: z.coerce.date().optional(),
}).omit({
  id: true,
  createdAt: true,
});

export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

// Extended types for Finance UI
export type TimesheetWithUser = Timesheet & {
  user: Pick<User, 'id' | 'name'>;
  approvedBy?: Pick<User, 'id' | 'name'> | null;
};

export type ExpenseWithDetails = Expense & {
  user: Pick<User, 'id' | 'name'>;
  approvedBy?: Pick<User, 'id' | 'name'> | null;
  job?: Pick<Job, 'id' | 'jobNo' | 'customerName'> | null;
};

export type PaymentWithInvoice = Payment & {
  invoice: Invoice;
};

// ==================== SITE INSPECTIONS ====================

export const inspections = pgTable("inspections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  inspectionNo: text("inspection_no").notNull(),
  jobId: varchar("job_id"),
  clientId: varchar("client_id"),
  siteAddress: text("site_address").notNull(),
  postcode: text("postcode"),
  inspectionType: text("inspection_type").notNull(), // pre_start, progress, final, handover
  inspectorId: varchar("inspector_id").notNull(),
  inspectionDate: timestamp("inspection_date").defaultNow(),
  status: text("status").notNull().default("draft"), // draft, in_progress, completed, signed_off
  overallResult: text("overall_result"), // pass, pass_with_conditions, fail
  notes: text("notes"),
  weatherConditions: text("weather_conditions"),
  photos: jsonb("photos").default([]),
  signature: jsonb("signature"), // inspector signature
  clientSignature: jsonb("client_signature"),
  signOffLat: doublePrecision("sign_off_lat"),
  signOffLng: doublePrecision("sign_off_lng"),
  signOffAddress: text("sign_off_address"),
  signOffTimestamp: timestamp("sign_off_timestamp"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const inspectionItems = pgTable("inspection_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  inspectionId: varchar("inspection_id").notNull(),
  category: text("category").notNull(), // structure, electrical, plumbing, safety, finish, etc.
  itemName: text("item_name").notNull(),
  description: text("description"),
  result: text("result").notNull().default("not_checked"), // not_checked, pass, fail, na
  severity: text("severity"), // minor, major, critical (for failures)
  notes: text("notes"),
  photos: jsonb("photos").default([]),
  orderIndex: integer("order_index").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertInspectionSchema = createInsertSchema(inspections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertInspection = z.infer<typeof insertInspectionSchema>;
export type Inspection = typeof inspections.$inferSelect;

export const insertInspectionItemSchema = createInsertSchema(inspectionItems).omit({
  id: true,
  createdAt: true,
});

export type InsertInspectionItem = z.infer<typeof insertInspectionItemSchema>;
export type InspectionItem = typeof inspectionItems.$inferSelect;

// ==================== SNAGGING SHEETS ====================

export const snaggingSheets = pgTable("snagging_sheets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sheetNo: text("sheet_no").notNull(),
  jobId: varchar("job_id"),
  clientId: varchar("client_id"),
  inspectionId: varchar("inspection_id"), // optional link to inspection
  siteAddress: text("site_address").notNull(),
  postcode: text("postcode"),
  createdById: varchar("created_by_id").notNull(),
  status: text("status").notNull().default("open"), // open, in_progress, completed, signed_off
  totalSnags: integer("total_snags").default(0),
  resolvedSnags: integer("resolved_snags").default(0),
  notes: text("notes"),
  clientSignature: jsonb("client_signature"),
  signOffLat: doublePrecision("sign_off_lat"),
  signOffLng: doublePrecision("sign_off_lng"),
  signOffAddress: text("sign_off_address"),
  signOffTimestamp: timestamp("sign_off_timestamp"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const snagItems = pgTable("snag_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  snaggingSheetId: varchar("snagging_sheet_id").notNull(),
  location: text("location").notNull(), // room, area, floor
  category: text("category").notNull(), // decoration, joinery, plumbing, electrical, etc.
  description: text("description").notNull(),
  priority: text("priority").notNull().default("medium"), // low, medium, high, critical
  status: text("status").notNull().default("open"), // open, in_progress, resolved, verified
  assignedToId: varchar("assigned_to_id"),
  photos: jsonb("photos").default([]),
  completionPhotos: jsonb("completion_photos").default([]),
  notes: text("notes"),
  resolvedAt: timestamp("resolved_at"),
  resolvedById: varchar("resolved_by_id"),
  verifiedAt: timestamp("verified_at"),
  verifiedById: varchar("verified_by_id"),
  orderIndex: integer("order_index").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSnaggingSheetSchema = createInsertSchema(snaggingSheets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSnaggingSheet = z.infer<typeof insertSnaggingSheetSchema>;
export type SnaggingSheet = typeof snaggingSheets.$inferSelect;

export const insertSnagItemSchema = createInsertSchema(snagItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSnagItem = z.infer<typeof insertSnagItemSchema>;
export type SnagItem = typeof snagItems.$inferSelect;

// Extended types
export type InspectionWithDetails = Inspection & {
  inspector: Pick<User, 'id' | 'name'>;
  items: InspectionItem[];
  job?: Pick<Job, 'id' | 'jobNo' | 'customerName'> | null;
  client?: Pick<Client, 'id' | 'name'> | null;
};

export type SnaggingSheetWithDetails = SnaggingSheet & {
  createdBy: Pick<User, 'id' | 'name'>;
  snags: SnagItem[];
  job?: Pick<Job, 'id' | 'jobNo' | 'customerName'> | null;
  client?: Pick<Client, 'id' | 'name'> | null;
};

// ==================== ACCOUNTS PORTAL ====================

export const accountsReceipts = pgTable("accounts_receipts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  expenseId: varchar("expense_id"),
  uploadedById: varchar("uploaded_by_id").notNull(),
  imageUrl: text("image_url").notNull(),
  ocrVendor: text("ocr_vendor"),
  ocrAmount: doublePrecision("ocr_amount"),
  ocrDate: timestamp("ocr_date"),
  ocrCategory: text("ocr_category"),
  ocrRawData: jsonb("ocr_raw_data"),
  isProcessed: boolean("is_processed").notNull().default(false),
  isVerified: boolean("is_verified").notNull().default(false),
  verifiedById: varchar("verified_by_id"),
  verifiedAt: timestamp("verified_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAccountsReceiptSchema = createInsertSchema(accountsReceipts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAccountsReceipt = z.infer<typeof insertAccountsReceiptSchema>;
export type AccountsReceipt = typeof accountsReceipts.$inferSelect;

export const invoiceChaseLogs = pgTable("invoice_chase_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull(),
  chaseNumber: integer("chase_number").notNull().default(1),
  method: text("method").notNull().default("email"),
  message: text("message").notNull(),
  sentAt: timestamp("sent_at"),
  sentById: varchar("sent_by_id"),
  response: text("response"),
  respondedAt: timestamp("responded_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertInvoiceChaseLogSchema = createInsertSchema(invoiceChaseLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertInvoiceChaseLog = z.infer<typeof insertInvoiceChaseLogSchema>;
export type InvoiceChaseLog = typeof invoiceChaseLogs.$inferSelect;

export const fixedCosts = pgTable("fixed_costs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(),
  amount: doublePrecision("amount").notNull(),
  frequency: text("frequency").notNull().default("monthly"),
  startDate: timestamp("start_date").defaultNow(),
  endDate: timestamp("end_date"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdById: varchar("created_by_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFixedCostSchema = createInsertSchema(fixedCosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFixedCost = z.infer<typeof insertFixedCostSchema>;
export type FixedCost = typeof fixedCosts.$inferSelect;

export type InvoiceWithChaseInfo = Invoice & {
  client?: Pick<Client, 'id' | 'name' | 'email' | 'phone'> | null;
  daysOverdue?: number;
  lastChaseDate?: Date | null;
  chaseCount?: number;
};

export type FinancialSummary = {
  totalRevenue: number;
  paidInvoices: number;
  pendingInvoices: number;
  overdueInvoices: number;
  totalCosts: number;
  staffCosts: number;
  vehicleCosts: number;
  materialsCosts: number;
  fixedCosts: number;
  netProfit: number;
  period: string;
};

export const snippets = pgTable("snippets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull().default("general"),
  shortcut: text("shortcut"),
  isGlobal: boolean("is_global").notNull().default(false),
  createdById: varchar("created_by_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSnippetSchema = createInsertSchema(snippets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSnippet = z.infer<typeof insertSnippetSchema>;
export type Snippet = typeof snippets.$inferSelect;

export const outlookSettings = pgTable("outlook_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  defaultUserEmail: text("default_user_email"),
  syncEnabled: boolean("sync_enabled").notNull().default(false),
  autoExtract: boolean("auto_extract").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertOutlookSettingsSchema = createInsertSchema(outlookSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOutlookSettings = z.infer<typeof insertOutlookSettingsSchema>;
export type OutlookSettings = typeof outlookSettings.$inferSelect;

// Files - Uploaded files with optional assignment to clients, jobs, or expenses
export const files = pgTable("files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  objectPath: text("object_path").notNull(),
  mimeType: text("mime_type"),
  size: integer("size"),
  clientId: varchar("client_id"),
  jobId: varchar("job_id"),
  expenseId: varchar("expense_id"),
  category: text("category"),
  tags: jsonb("tags").default([]),
  notes: text("notes"),
  aiSuggestion: jsonb("ai_suggestion"),
  uploadedById: varchar("uploaded_by_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFileSchema = createInsertSchema(files).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFile = z.infer<typeof insertFileSchema>;
export type FileRecord = typeof files.$inferSelect;

export type FileWithRelations = FileRecord & {
  client?: Pick<Client, 'id' | 'name'> | null;
  job?: Pick<Job, 'id' | 'jobNo' | 'customerName'> | null;
  expense?: Pick<Expense, 'id' | 'description' | 'category'> | null;
  uploadedBy?: Pick<User, 'id' | 'name'> | null;
};

export type AiFileSuggestion = {
  clientId?: string;
  jobId?: string;
  expenseId?: string;
  category?: string;
  confidence: number;
  reasoning: string;
};

// AI Conversations - Store chat history for continuing past conversations
export const aiConversations = pgTable("ai_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull().default("New Conversation"),
  messages: jsonb("messages").notNull().default([]),
  context: text("context"), // Page context when conversation started
  isArchived: boolean("is_archived").notNull().default(false),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAiConversationSchema = createInsertSchema(aiConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAiConversation = z.infer<typeof insertAiConversationSchema>;
export type AiConversation = typeof aiConversations.$inferSelect;

export type AiMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

// AI Business Patterns - Learn from business operations
export const aiBusinessPatterns = pgTable("ai_business_patterns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  patternType: text("pattern_type").notNull(), // pricing, materials, suppliers, job_duration, engineer_assignment
  category: text("category"), // e.g., "plumbing", "electrical", "HVAC"
  data: jsonb("data").notNull(), // Pattern-specific data
  frequency: integer("frequency").notNull().default(1), // How often this pattern occurs
  lastOccurrence: timestamp("last_occurrence").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAiBusinessPatternSchema = createInsertSchema(aiBusinessPatterns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAiBusinessPattern = z.infer<typeof insertAiBusinessPatternSchema>;
export type AiBusinessPattern = typeof aiBusinessPatterns.$inferSelect;

export type PricingPattern = {
  jobType: string;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  sampleSize: number;
};

export type MaterialPattern = {
  materialName: string;
  jobTypes: string[];
  avgQuantity: number;
  preferredSupplier?: string;
};

export type SupplierPattern = {
  supplierName: string;
  materials: string[];
  useCount: number;
};

export type JobDurationPattern = {
  jobType: string;
  avgDurationHours: number;
  complexity: string;
};

export type EngineerAssignmentPattern = {
  engineerId: string;
  engineerName: string;
  jobTypes: string[];
  successRate: number;
  avgJobsPerWeek: number;
};

// AI User Preferences - Remember individual team member preferences
export const aiUserPreferences = pgTable("ai_user_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  communicationStyle: text("communication_style").default("professional"), // professional, casual, brief
  preferredActions: jsonb("preferred_actions").default([]), // Common tasks they perform
  shortcuts: jsonb("shortcuts").default([]), // Custom shortcuts they've created
  dashboardPreferences: jsonb("dashboard_preferences").default({}), // What they like to see first
  notificationPreferences: jsonb("notification_preferences").default({}),
  lastLearnedAt: timestamp("last_learned_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAiUserPreferenceSchema = createInsertSchema(aiUserPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAiUserPreference = z.infer<typeof insertAiUserPreferenceSchema>;
export type AiUserPreference = typeof aiUserPreferences.$inferSelect;

export type UserAction = {
  action: string;
  count: number;
  lastUsed: string;
};

export type UserShortcut = {
  trigger: string;
  action: string;
  description: string;
};

// ==================== SUBSCRIPTION BILLING ====================

export const subscriptionPlans = pgTable("subscription_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  monthlyPrice: doublePrecision("monthly_price").notNull(),
  yearlyPrice: doublePrecision("yearly_price"),
  features: jsonb("features").default([]),
  limits: jsonb("limits").default({}),
  isActive: boolean("is_active").notNull().default(true),
  stripePriceIdMonthly: text("stripe_price_id_monthly"),
  stripePriceIdYearly: text("stripe_price_id_yearly"),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;

export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").notNull(),
  status: text("status").notNull().default("trial"),
  billingCycle: text("billing_cycle").default("monthly"),
  trialStartDate: timestamp("trial_start_date"),
  trialEndDate: timestamp("trial_end_date"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  cancelledAt: timestamp("cancelled_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;

export const usageRecords = pgTable("usage_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subscriptionId: varchar("subscription_id").notNull(),
  metricType: text("metric_type").notNull(),
  count: integer("count").notNull().default(0),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUsageRecordSchema = createInsertSchema(usageRecords).omit({
  id: true,
  createdAt: true,
});

export type InsertUsageRecord = z.infer<typeof insertUsageRecordSchema>;
export type UsageRecord = typeof usageRecords.$inferSelect;

export type PlanLimits = {
  maxUsers: number;
  maxJobs: number;
  maxClients: number;
  maxStorageGb: number;
  aiAssistantEnabled: boolean;
  apiAccess: boolean;
  customBranding: boolean;
  prioritySupport: boolean;
};

// ==================== WORKFLOW AUTOMATION ====================

export const workflowRules = pgTable("workflow_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  triggerType: text("trigger_type").notNull(),
  triggerConditions: jsonb("trigger_conditions").default({}),
  actions: jsonb("actions").default([]),
  isActive: boolean("is_active").notNull().default(true),
  priority: integer("priority").default(0),
  createdById: varchar("created_by_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertWorkflowRuleSchema = createInsertSchema(workflowRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWorkflowRule = z.infer<typeof insertWorkflowRuleSchema>;
export type WorkflowRule = typeof workflowRules.$inferSelect;

export const workflowExecutions = pgTable("workflow_executions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleId: varchar("rule_id").notNull(),
  triggeredById: varchar("triggered_by_id"),
  triggerData: jsonb("trigger_data").default({}),
  status: text("status").notNull().default("pending"),
  result: jsonb("result").default({}),
  errorMessage: text("error_message"),
  executedAt: timestamp("executed_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertWorkflowExecutionSchema = createInsertSchema(workflowExecutions).omit({
  id: true,
  executedAt: true,
});

export type InsertWorkflowExecution = z.infer<typeof insertWorkflowExecutionSchema>;
export type WorkflowExecution = typeof workflowExecutions.$inferSelect;

export type TriggerType = 
  | "job_created"
  | "job_status_changed"
  | "job_completed"
  | "invoice_created"
  | "invoice_overdue"
  | "quote_created"
  | "quote_accepted"
  | "payment_received"
  | "client_created"
  | "scheduled";

export type ActionType = 
  | "send_email"
  | "send_sms"
  | "create_task"
  | "update_status"
  | "assign_user"
  | "create_invoice"
  | "notify_admin"
  | "webhook";

// ==================== MODULAR PRICING - ADD-ONS ====================

export const addOns = pgTable("add_ons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  monthlyPrice: doublePrecision("monthly_price").notNull(),
  icon: text("icon"),
  category: text("category").default("feature"),
  features: jsonb("features").default([]),
  isActive: boolean("is_active").notNull().default(true),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAddOnSchema = createInsertSchema(addOns).omit({
  id: true,
  createdAt: true,
});

export type InsertAddOn = z.infer<typeof insertAddOnSchema>;
export type AddOn = typeof addOns.$inferSelect;

export const subscriptionAddOns = pgTable("subscription_add_ons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subscriptionId: varchar("subscription_id"),
  addOnId: varchar("add_on_id").notNull(),
  status: text("status").notNull().default("active"),
  startDate: timestamp("start_date").defaultNow(),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSubscriptionAddOnSchema = createInsertSchema(subscriptionAddOns).omit({
  id: true,
  createdAt: true,
});

export type InsertSubscriptionAddOn = z.infer<typeof insertSubscriptionAddOnSchema>;
export type SubscriptionAddOn = typeof subscriptionAddOns.$inferSelect;

// ==================== REFERRAL SYSTEM ====================

export const referralCodes = pgTable("referral_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  ownerId: varchar("owner_id"),
  companyName: text("company_name"),
  qrCodeUrl: text("qr_code_url"),
  isActive: boolean("is_active").notNull().default(true),
  totalReferrals: integer("total_referrals").default(0),
  successfulReferrals: integer("successful_referrals").default(0),
  totalEarnings: doublePrecision("total_earnings").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertReferralCodeSchema = createInsertSchema(referralCodes).omit({
  id: true,
  createdAt: true,
});

export type InsertReferralCode = z.infer<typeof insertReferralCodeSchema>;
export type ReferralCode = typeof referralCodes.$inferSelect;

export const referrals = pgTable("referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referralCodeId: varchar("referral_code_id").notNull(),
  referrerId: varchar("referrer_id"),
  referredEmail: text("referred_email"),
  referredUserId: varchar("referred_user_id"),
  status: text("status").notNull().default("pending"),
  convertedAt: timestamp("converted_at"),
  subscriptionValue: doublePrecision("subscription_value"),
  commissionEarned: doublePrecision("commission_earned"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertReferralSchema = createInsertSchema(referrals).omit({
  id: true,
  createdAt: true,
});

export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type Referral = typeof referrals.$inferSelect;

export const referralRewards = pgTable("referral_rewards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referralCodeId: varchar("referral_code_id").notNull(),
  rewardType: text("reward_type").notNull(),
  rewardValue: doublePrecision("reward_value"),
  description: text("description"),
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at"),
  claimedAt: timestamp("claimed_at"),
  appliedToSubscriptionId: varchar("applied_to_subscription_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertReferralRewardSchema = createInsertSchema(referralRewards).omit({
  id: true,
  createdAt: true,
});

export type InsertReferralReward = z.infer<typeof insertReferralRewardSchema>;
export type ReferralReward = typeof referralRewards.$inferSelect;

export const referralTiers = pgTable("referral_tiers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  requiredReferrals: integer("required_referrals").notNull(),
  rewardType: text("reward_type").notNull(),
  rewardValue: doublePrecision("reward_value").notNull(),
  rewardDescription: text("reward_description"),
  isActive: boolean("is_active").notNull().default(true),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertReferralTierSchema = createInsertSchema(referralTiers).omit({
  id: true,
  createdAt: true,
});

export type InsertReferralTier = z.infer<typeof insertReferralTierSchema>;
export type ReferralTier = typeof referralTiers.$inferSelect;

export type RewardType = 
  | "percentage_discount"
  | "fixed_discount"
  | "free_month"
  | "free_addon"
  | "tier_upgrade"
  | "commission";

// Export OAuth sessions table from auth module
export * from "./models/auth";

// ===== FORMS SYSTEM =====

export const formTemplates = pgTable("form_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull().default("job_sheet"), // job_sheet | client_form | quote_sheet | signoff
  status: text("status").notNull().default("draft"), // draft | published | archived
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFormTemplateSchema = createInsertSchema(formTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFormTemplate = z.infer<typeof insertFormTemplateSchema>;
export type FormTemplate = typeof formTemplates.$inferSelect;

export const formTemplateVersions = pgTable("form_template_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull(),
  version: integer("version").notNull().default(1),
  schema: jsonb("schema").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  publishedAt: timestamp("published_at"),
});

export const insertFormTemplateVersionSchema = createInsertSchema(formTemplateVersions).omit({
  id: true,
  createdAt: true,
});

export type InsertFormTemplateVersion = z.infer<typeof insertFormTemplateVersionSchema>;
export type FormTemplateVersion = typeof formTemplateVersions.$inferSelect;

export const formSubmissions = pgTable("form_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateVersionId: varchar("template_version_id").notNull(),
  entityType: text("entity_type").notNull(), // job | client | quote
  entityId: varchar("entity_id").notNull(),
  submittedBy: varchar("submitted_by"),
  status: text("status").notNull().default("draft"), // draft | submitted
  data: jsonb("data").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  submittedAt: timestamp("submitted_at"),
});

export const insertFormSubmissionSchema = createInsertSchema(formSubmissions).omit({
  id: true,
  createdAt: true,
});

export type InsertFormSubmission = z.infer<typeof insertFormSubmissionSchema>;
export type FormSubmission = typeof formSubmissions.$inferSelect;

export const formAssets = pgTable("form_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id").notNull(),
  fieldKey: text("field_key").notNull(),
  assetType: text("asset_type").notNull(), // photo | signature
  filePath: text("file_path").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFormAssetSchema = createInsertSchema(formAssets).omit({
  id: true,
  createdAt: true,
});

export type InsertFormAsset = z.infer<typeof insertFormAssetSchema>;
export type FormAsset = typeof formAssets.$inferSelect;

// Condition types for conditional logic
export interface FieldCondition {
  field: string; // Key of the field to compare
  operator: "equals" | "not_equals" | "contains" | "not_contains" | "greater_than" | "less_than" | "is_empty" | "is_not_empty";
  value?: string | number | boolean;
}

export interface ConditionalLogic {
  action: "show" | "hide" | "require" | "not_require" | "set_value";
  conditions: FieldCondition[];
  logic: "and" | "or"; // How to combine conditions
  setValue?: string; // For set_value action
}

// Form field schema for template builder
export interface FormField {
  type: "text" | "textarea" | "number" | "date" | "select" | "multiselect" | "checkbox" | "yesno" | "photo" | "signature" | "repeatable_group" | "calculated";
  key: string;
  label: string;
  required?: boolean;
  prefill?: string;
  multiple?: boolean;
  options?: { label: string; value: string }[];
  fields?: FormField[]; // For repeatable_group
  // Phase 2: Conditional logic
  conditionalLogic?: ConditionalLogic[];
  // Phase 2: Calculated fields
  formula?: string; // e.g., "{field1} + {field2} * 0.2"
  // UI hints
  placeholder?: string;
  helpText?: string;
  minValue?: number;
  maxValue?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string; // Regex pattern for validation
}

export const fieldConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(["equals", "not_equals", "contains", "not_contains", "greater_than", "less_than", "is_empty", "is_not_empty"]),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

export const conditionalLogicSchema = z.object({
  action: z.enum(["show", "hide", "require", "not_require", "set_value"]),
  conditions: z.array(fieldConditionSchema),
  logic: z.enum(["and", "or"]),
  setValue: z.string().optional(),
});

export const formFieldSchema: z.ZodType<FormField> = z.object({
  type: z.enum([
    "text", "textarea", "number", "date", "select", "multiselect",
    "checkbox", "yesno", "photo", "signature", "repeatable_group", "calculated"
  ]),
  key: z.string(),
  label: z.string(),
  required: z.boolean().optional().default(false),
  prefill: z.string().optional(),
  multiple: z.boolean().optional(),
  options: z.array(z.object({
    label: z.string(),
    value: z.string(),
  })).optional(),
  fields: z.lazy(() => z.array(formFieldSchema)).optional(),
  conditionalLogic: z.array(conditionalLogicSchema).optional(),
  formula: z.string().optional(),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  pattern: z.string().optional(),
});

export const formSchemaDefinition = z.object({
  name: z.string(),
  style: z.string().optional().default("clean"),
  fields: z.array(formFieldSchema),
});

export type FormSchemaDefinition = z.infer<typeof formSchemaDefinition>;

// ==================== PHASE 0: FOUNDATION TABLES ====================

// Feature flags for tenant-level feature toggles
export const featureFlags = pgTable("feature_flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  isEnabled: boolean("is_enabled").notNull().default(false),
  enabledForTenants: jsonb("enabled_for_tenants").default([]), // Array of tenant IDs
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFeatureFlagSchema = createInsertSchema(featureFlags).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFeatureFlag = z.infer<typeof insertFeatureFlagSchema>;
export type FeatureFlag = typeof featureFlags.$inferSelect;

// Domain events for event-driven architecture
export const domainEvents = pgTable("domain_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").notNull().default({}),
  dedupeKey: text("dedupe_key"), // For idempotency
  aggregateType: text("aggregate_type"), // e.g., "job", "invoice", "form"
  aggregateId: varchar("aggregate_id"),
  version: integer("version").default(1),
  causedById: varchar("caused_by_id"), // User who caused the event
  correlationId: varchar("correlation_id"), // For tracing related events
  metadata: jsonb("metadata").default({}),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDomainEventSchema = createInsertSchema(domainEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertDomainEvent = z.infer<typeof insertDomainEventSchema>;
export type DomainEvent = typeof domainEvents.$inferSelect;

// Job queue for background processing
export const jobQueue = pgTable("job_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobType: text("job_type").notNull(), // e.g., "workflow_run", "webhook_delivery", "pdf_render"
  payload: jsonb("payload").notNull().default({}),
  priority: integer("priority").notNull().default(0), // Higher = more important
  status: text("status").notNull().default("pending"), // pending | processing | completed | failed | dead_letter
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  lastError: text("last_error"),
  scheduledFor: timestamp("scheduled_for").defaultNow(),
  lockedAt: timestamp("locked_at"),
  lockedBy: text("locked_by"), // Worker ID
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertJobQueueSchema = createInsertSchema(jobQueue).omit({
  id: true,
  createdAt: true,
});

export type InsertJobQueue = z.infer<typeof insertJobQueueSchema>;
export type JobQueueItem = typeof jobQueue.$inferSelect;

// Workflow execution logs for detailed step tracking
export const workflowLogs = pgTable("workflow_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  executionId: varchar("execution_id").notNull(),
  stepIndex: integer("step_index").notNull(),
  actionType: text("action_type").notNull(),
  input: jsonb("input").default({}),
  output: jsonb("output").default({}),
  status: text("status").notNull().default("pending"), // pending | success | failed | skipped
  errorMessage: text("error_message"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWorkflowLogSchema = createInsertSchema(workflowLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertWorkflowLog = z.infer<typeof insertWorkflowLogSchema>;
export type WorkflowLog = typeof workflowLogs.$inferSelect;

// Webhook subscriptions for external integrations
export const webhookSubscriptions = pgTable("webhook_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  url: text("url").notNull(),
  secret: text("secret").notNull(), // For HMAC signing
  eventTypes: jsonb("event_types").notNull().default([]), // Array of event types to subscribe to
  isActive: boolean("is_active").notNull().default(true),
  headers: jsonb("headers").default({}), // Custom headers to send
  retryPolicy: jsonb("retry_policy").default({ maxAttempts: 3, backoffMs: 1000 }),
  createdById: varchar("created_by_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertWebhookSubscriptionSchema = createInsertSchema(webhookSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWebhookSubscription = z.infer<typeof insertWebhookSubscriptionSchema>;
export type WebhookSubscription = typeof webhookSubscriptions.$inferSelect;

// Webhook delivery logs
export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subscriptionId: varchar("subscription_id").notNull(),
  eventId: varchar("event_id").notNull(), // Reference to domain_events
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").notNull().default({}),
  status: text("status").notNull().default("pending"), // pending | success | failed
  attempts: integer("attempts").notNull().default(0),
  lastAttemptAt: timestamp("last_attempt_at"),
  responseStatus: integer("response_status"),
  responseBody: text("response_body"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertWebhookDeliverySchema = createInsertSchema(webhookDeliveries).omit({
  id: true,
  createdAt: true,
});

export type InsertWebhookDelivery = z.infer<typeof insertWebhookDeliverySchema>;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;

// AI request logs for tracking and auditing
export const aiRequests = pgTable("ai_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: text("provider").notNull(), // openai | gemini | etc
  model: text("model").notNull(),
  endpoint: text("endpoint").notNull(), // e.g., "/api/ai/job-notes"
  promptVersion: text("prompt_version"),
  inputRefsJson: jsonb("input_refs_json").default({}), // References to entities used as input
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  totalTokens: integer("total_tokens"),
  outputJson: jsonb("output_json").default({}),
  confidence: doublePrecision("confidence"),
  sourcesUsed: jsonb("sources_used").default([]),
  approvalStatus: text("approval_status").default("pending"), // pending | approved | rejected
  approvedById: varchar("approved_by_id"),
  approvedAt: timestamp("approved_at"),
  requestedById: varchar("requested_by_id"),
  durationMs: integer("duration_ms"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAiRequestSchema = createInsertSchema(aiRequests).omit({
  id: true,
  createdAt: true,
});

export type InsertAiRequest = z.infer<typeof insertAiRequestSchema>;
export type AiRequest = typeof aiRequests.$inferSelect;

// Exceptions for error tracking and resolution
export const exceptions = pgTable("exceptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // workflow_failed | webhook_failed | ai_failed | job_blocked | validation_error
  severity: text("severity").notNull().default("warning"), // info | warning | error | critical
  title: text("title").notNull(),
  message: text("message"),
  context: jsonb("context").default({}), // Additional context data
  entityType: text("entity_type"), // job | invoice | form | workflow
  entityId: varchar("entity_id"),
  stackTrace: text("stack_trace"),
  status: text("status").notNull().default("open"), // open | acknowledged | resolved | ignored
  resolvedById: varchar("resolved_by_id"),
  resolvedAt: timestamp("resolved_at"),
  resolutionNotes: text("resolution_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertExceptionSchema = createInsertSchema(exceptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertException = z.infer<typeof insertExceptionSchema>;
export type Exception = typeof exceptions.$inferSelect;

// Assets - Equipment, parts, and items tracked with barcodes/QR codes
export const assets = pgTable("assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  serialNumber: text("serial_number"),
  barcode: text("barcode"),
  manufacturer: text("manufacturer"),
  model: text("model"),
  description: text("description"),
  categoryType: text("category_type").default("equipment"), // equipment, tool, part, vehicle, other
  condition: text("condition").default("good"), // new, good, fair, needs_repair, decommissioned
  location: text("location"),
  purchaseDate: timestamp("purchase_date"),
  purchasePrice: doublePrecision("purchase_price"),
  warrantyExpiry: timestamp("warranty_expiry"),
  warrantyNotes: text("warranty_notes"),
  warrantyProvider: text("warranty_provider"),
  assignedJobId: varchar("assigned_job_id"),
  assignedClientId: varchar("assigned_client_id"),
  assignedUserId: varchar("assigned_user_id"),
  photos: jsonb("photos").default([]),
  documents: jsonb("documents").default([]),
  notes: text("notes"),
  lastServiceDate: timestamp("last_service_date"),
  nextServiceDue: timestamp("next_service_due"),
  productUrl: text("product_url"),
  manualUrl: text("manual_url"),
  qrCodeData: text("qr_code_data"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAssetSchema = createInsertSchema(assets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Asset = typeof assets.$inferSelect;

// Asset History - Audit log for asset changes
export const assetHistory = pgTable("asset_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").notNull(),
  action: text("action").notNull(), // created, updated, assigned, condition_changed, service_completed
  description: text("description"),
  previousValue: jsonb("previous_value"),
  newValue: jsonb("new_value"),
  performedBy: varchar("performed_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAssetHistorySchema = createInsertSchema(assetHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertAssetHistory = z.infer<typeof insertAssetHistorySchema>;
export type AssetHistory = typeof assetHistory.$inferSelect;

// AI Cache for storing cached AI responses
export const aiCache = pgTable("ai_cache", {
  key: varchar("key").primaryKey(),
  value: jsonb("value").notNull(),
  orgId: varchar("org_id"),
  updatedAt: timestamp("updated_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  version: integer("version").default(1),
});

export const insertAiCacheSchema = createInsertSchema(aiCache).omit({
  updatedAt: true,
});

export type InsertAiCache = z.infer<typeof insertAiCacheSchema>;
export type AiCache = typeof aiCache.$inferSelect;

// Event type definitions
export type DomainEventType =
  | "JobCreated"
  | "JobStatusChanged"
  | "JobCompleted"
  | "JobClosed"
  | "FormSubmitted"
  | "InvoiceCreated"
  | "InvoicePaid"
  | "QuoteCreated"
  | "QuoteAccepted"
  | "ClientCreated"
  | "WorkflowTriggered"
  | "WorkflowCompleted"
  | "WebhookDelivered"
  | "AiRequestCompleted";

// Job queue type definitions
export type JobQueueType =
  | "workflow_run"
  | "webhook_delivery"
  | "pdf_render"
  | "email_send"
  | "sms_send"
  | "ai_request";

// ==================== AUDIT LOGGING SYSTEM ====================

// Main audit log table
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // When & Where
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  pageRoute: text("page_route"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  sessionId: text("session_id"),
  
  // Who
  userId: varchar("user_id").notNull(),
  userName: text("user_name").notNull(),
  userEmail: text("user_email"),
  userRole: text("user_role").notNull(),
  
  // What
  actionType: text("action_type").notNull(), // create, update, delete, login, export, etc.
  actionCategory: text("action_category"), // auth, client, job, finance, settings, etc.
  entityType: text("entity_type").notNull(), // client, job, quote, invoice, user, etc.
  entityId: text("entity_id"),
  
  // Details
  actionDescription: text("action_description"),
  changesJson: jsonb("changes_json"), // Full before/after data
  metadataJson: jsonb("metadata_json"), // Additional context
  
  // Severity & Classification
  severity: text("severity").default("info"), // info, warning, critical
  isSensitive: boolean("is_sensitive").default(false),
  requiresReview: boolean("requires_review").default(false),
  
  // Audit trail integrity
  previousLogId: varchar("previous_log_id"),
  checksum: text("checksum"), // SHA-256 hash
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  timestamp: true,
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// User sessions table
export const userSessions = pgTable("user_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: text("session_id").unique().notNull(),
  userId: varchar("user_id").notNull(),
  loginTimestamp: timestamp("login_timestamp").notNull(),
  logoutTimestamp: timestamp("logout_timestamp"),
  lastActivity: timestamp("last_activity"),
  ipAddress: text("ip_address"),
  deviceInfo: text("device_info"),
  isActive: boolean("is_active").default(true),
});

export const insertUserSessionSchema = createInsertSchema(userSessions).omit({
  id: true,
});

export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;
export type UserSession = typeof userSessions.$inferSelect;

// Failed actions log table
export const failedActionsLog = pgTable("failed_actions_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  userId: varchar("user_id"),
  attemptedEmail: text("attempted_email"),
  actionAttempted: text("action_attempted").notNull(),
  failureReason: text("failure_reason"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
});

export const insertFailedActionSchema = createInsertSchema(failedActionsLog).omit({
  id: true,
  timestamp: true,
});

export type InsertFailedAction = z.infer<typeof insertFailedActionSchema>;
export type FailedAction = typeof failedActionsLog.$inferSelect;

// Audit log access table - logs who viewed the audit logs
export const auditLogAccess = pgTable("audit_log_access", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  accessedByUserId: varchar("accessed_by_user_id").notNull(),
  accessedByUserName: text("accessed_by_user_name"),
  accessType: text("access_type"), // view, export, search
  filtersApplied: jsonb("filters_applied"),
  recordsAccessed: integer("records_accessed"),
  exportFormat: text("export_format"), // csv, pdf, json
});

export const insertAuditLogAccessSchema = createInsertSchema(auditLogAccess).omit({
  id: true,
  timestamp: true,
});

export type InsertAuditLogAccess = z.infer<typeof insertAuditLogAccessSchema>;
export type AuditLogAccess = typeof auditLogAccess.$inferSelect;

// Action type values
export type AuditActionType =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "logout"
  | "failed_login"
  | "password_reset"
  | "password_change"
  | "export"
  | "import"
  | "bulk_update"
  | "bulk_delete"
  | "approve"
  | "reject"
  | "cancel"
  | "send_email"
  | "send_sms"
  | "download"
  | "upload"
  | "share"
  | "transfer"
  | "assign"
  | "enable"
  | "disable"
  | "archive"
  | "restore"
  | "view";

// Action category values
export type AuditActionCategory =
  | "auth"
  | "client"
  | "job"
  | "quote"
  | "invoice"
  | "finance"
  | "team"
  | "schedule"
  | "fleet"
  | "settings"
  | "report"
  | "document"
  | "asset";

export const integrationTokens = pgTable("integration_tokens", {
  provider: text("provider").primaryKey(),
  tokens: jsonb("tokens").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const chatThreads = pgTable("chat_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  threadId: text("thread_id").notNull().unique(),
  title: text("title").default("New conversation"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: text("thread_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const securityEvents = pgTable("security_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  eventType: text("event_type").notNull(),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertChatThreadSchema = createInsertSchema(chatThreads).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertChatThread = z.infer<typeof insertChatThreadSchema>;
export type ChatThread = typeof chatThreads.$inferSelect;

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

export const insertSecurityEventSchema = createInsertSchema(securityEvents).omit({ id: true, createdAt: true });
export type InsertSecurityEvent = z.infer<typeof insertSecurityEventSchema>;
export type SecurityEvent = typeof securityEvents.$inferSelect;
