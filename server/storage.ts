import { 
  type User, type InsertUser, 
  type Job, type InsertJob,
  type EngineerLocation, type InsertEngineerLocation,
  type AiAdvisor, type InsertAiAdvisor,
  type TimeLog, type InsertTimeLog,
  type Quote, type InsertQuote,
  type Invoice, type InsertInvoice,
  type CompanySettings, type InsertCompanySettings,
  type Client, type InsertClient,
  type ClientContact, type InsertClientContact,
  type ClientProperty, type InsertClientProperty,
  type JobUpdate, type InsertJobUpdate,
  type Conversation, type InsertConversation,
  type ConversationMember, type InsertConversationMember,
  type Message, type InsertMessage,
  type ConversationWithDetails, type MessageWithSender,
  type Vehicle, type InsertVehicle,
  type WalkaroundCheck, type InsertWalkaroundCheck,
  type CheckItem, type InsertCheckItem,
  type Defect, type InsertDefect,
  type DefectUpdate, type InsertDefectUpdate,
  type WalkaroundCheckWithDetails, type DefectWithDetails, type VehicleWithStats,
  type Timesheet, type InsertTimesheet, type TimesheetWithUser,
  type Expense, type InsertExpense, type ExpenseWithDetails,
  type Payment, type InsertPayment, type PaymentWithInvoice,
  type Skill, type SubSkill, type UserSkill,
  type Inspection, type InsertInspection, type InspectionWithDetails,
  type InspectionItem, type InsertInspectionItem,
  type SnaggingSheet, type InsertSnaggingSheet, type SnaggingSheetWithDetails,
  type SnagItem, type InsertSnagItem,
  type AccountsReceipt, type InsertAccountsReceipt,
  type InvoiceChaseLog, type InsertInvoiceChaseLog,
  type FixedCost, type InsertFixedCost,
  type InvoiceWithChaseInfo, type FinancialSummary,
  type Snippet, type InsertSnippet,
  type FileRecord, type InsertFile, type FileWithRelations,
  type AiConversation, type InsertAiConversation, type AiMessage,
  type AiBusinessPattern, type InsertAiBusinessPattern,
  type AiUserPreference, type InsertAiUserPreference,
  type FormTemplate, type InsertFormTemplate,
  type FormTemplateVersion, type InsertFormTemplateVersion,
  type FormSubmission, type InsertFormSubmission,
  type FormAsset, type InsertFormAsset,
  users, jobs, engineerLocations, aiAdvisors, timeLogs, quotes, invoices, companySettings, clients, clientContacts, clientProperties, jobUpdates,
  conversations, conversationMembers, messages,
  vehicles, walkaroundChecks, checkItems, defects, defectUpdates,
  timesheets, expenses, payments,
  skills, subSkills, userSkills,
  inspections, inspectionItems, snaggingSheets, snagItems,
  accountsReceipts, invoiceChaseLogs, fixedCosts, snippets, files,
  aiConversations, aiBusinessPatterns, aiUserPreferences,
  formTemplates, formTemplateVersions, formSubmissions, formAssets
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, or, sql, isNull, and, ne, inArray, gt, asc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  deleteUser(id: string): Promise<void>;
  updateUser(id: string, updates: Partial<{ name: string; email: string | null; phone: string | null; tabletNumber: string | null; username: string; password: string; role: string; roles: string[]; superAdmin: boolean; twoFactorSecret: string | null; twoFactorEnabled: boolean; gdprConsentDate: Date | null; gdprConsentVersion: string | null; deletionRequestedAt: Date | null; status: string; workingAtHeight: boolean; negativeSkillIds: string[] }>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getAllEngineers(): Promise<User[]>;
  updateEngineerLocation(id: string, lat: number, lng: number): Promise<User | undefined>;
  
  getJob(id: string): Promise<Job | undefined>;
  getAllJobs(): Promise<Job[]>;
  getJobsByEngineer(engineerId: string): Promise<Job[]>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: string, updates: Partial<Job>): Promise<Job | undefined>;
  deleteJob(id: string): Promise<void>;
  signOffJob(id: string): Promise<Job | undefined>;
  
  addEngineerLocation(location: InsertEngineerLocation): Promise<EngineerLocation>;
  getEngineerLocationHistory(engineerId: string, limit?: number): Promise<EngineerLocation[]>;
  getEngineerLocations(): Promise<{ id: string; name: string; lat: number; lng: number; lastUpdate: Date | null }[]>;
  
  getAllAiAdvisors(): Promise<AiAdvisor[]>;
  getActiveAiAdvisors(): Promise<AiAdvisor[]>;
  getAiAdvisor(id: string): Promise<AiAdvisor | undefined>;
  createAiAdvisor(advisor: InsertAiAdvisor): Promise<AiAdvisor>;
  updateAiAdvisor(id: string, updates: Partial<AiAdvisor>): Promise<AiAdvisor | undefined>;
  deleteAiAdvisor(id: string): Promise<void>;
  
  clockIn(engineerId: string, lat: number | null, lng: number | null, address: string | null): Promise<TimeLog>;
  clockOut(engineerId: string, lat: number | null, lng: number | null, address: string | null): Promise<TimeLog | undefined>;
  getActiveTimeLog(engineerId: string): Promise<TimeLog | undefined>;
  getTimeLogsByEngineer(engineerId: string, limit?: number): Promise<TimeLog[]>;
  getAllTimeLogs(limit?: number): Promise<TimeLog[]>;
  
  getQuote(id: string): Promise<Quote | undefined>;
  getQuoteByToken(token: string): Promise<Quote | undefined>;
  getAllQuotes(): Promise<Quote[]>;
  createQuote(quote: InsertQuote): Promise<Quote>;
  updateQuote(id: string, updates: Partial<Quote>): Promise<Quote | undefined>;
  deleteQuote(id: string): Promise<void>;
  getNextQuoteNumber(): Promise<string>;
  
  getInvoice(id: string): Promise<Invoice | undefined>;
  getInvoiceByToken(token: string): Promise<Invoice | undefined>;
  getAllInvoices(): Promise<Invoice[]>;
  getInvoicesByJob(jobId: string): Promise<Invoice[]>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, updates: Partial<Invoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: string): Promise<void>;
  getNextInvoiceNumber(): Promise<string>;
  
  getCompanySettings(): Promise<CompanySettings | undefined>;
  upsertCompanySettings(settings: InsertCompanySettings): Promise<CompanySettings>;
  
  getClient(id: string): Promise<Client | undefined>;
  getClientByEmail(email: string): Promise<Client | undefined>;
  getClientByPortalToken(token: string): Promise<Client | undefined>;
  getClientQuotes(clientId: string): Promise<Quote[]>;
  getClientInvoices(clientId: string): Promise<Invoice[]>;
  getClientJobs(clientId: string): Promise<Job[]>;
  getAllClients(): Promise<Client[]>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, updates: Partial<Client>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<void>;
  findOrCreateClient(data: { name: string; email?: string | null; phone?: string | null; address?: string | null; postcode?: string | null; contactName?: string | null }): Promise<Client>;
  
  // Client Contacts
  getClientContacts(clientId: string): Promise<ClientContact[]>;
  createClientContact(contact: InsertClientContact): Promise<ClientContact>;
  updateClientContact(id: string, updates: Partial<ClientContact>): Promise<ClientContact | undefined>;
  deleteClientContact(id: string): Promise<void>;
  
  createJobUpdate(update: InsertJobUpdate): Promise<JobUpdate>;
  getJobUpdates(jobId: string): Promise<JobUpdate[]>;
  getJobUpdatesForDate(jobId: string, workDate: Date): Promise<JobUpdate[]>;
  countJobUpdatesForDate(jobId: string, workDate: Date): Promise<number>;
  
  // Messaging
  createConversation(conversation: InsertConversation, memberIds: string[]): Promise<Conversation>;
  getConversation(id: string): Promise<Conversation | undefined>;
  getUserConversations(userId: string): Promise<ConversationWithDetails[]>;
  getOrCreateDirectConversation(userId1: string, userId2: string): Promise<Conversation>;
  addConversationMember(conversationId: string, userId: string): Promise<ConversationMember>;
  removeConversationMember(conversationId: string, userId: string): Promise<void>;
  isConversationMember(conversationId: string, userId: string): Promise<boolean>;
  
  createMessage(message: InsertMessage): Promise<Message>;
  getMessages(conversationId: string, limit?: number, before?: Date): Promise<MessageWithSender[]>;
  markConversationRead(conversationId: string, userId: string): Promise<void>;
  getUnreadCount(userId: string): Promise<number>;
  
  // Fleet Maintenance
  getVehicle(id: string): Promise<Vehicle | undefined>;
  getAllVehicles(): Promise<Vehicle[]>;
  getVehiclesWithStats(): Promise<VehicleWithStats[]>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: string, updates: Partial<Vehicle>): Promise<Vehicle | undefined>;
  deleteVehicle(id: string): Promise<void>;
  getVehiclesByUserId(userId: string): Promise<Vehicle[]>;
  getAvailableVehicles(): Promise<Vehicle[]>;
  assignVehicleToUser(vehicleId: string, userId: string | null): Promise<Vehicle | undefined>;
  
  getWalkaroundCheck(id: string): Promise<WalkaroundCheck | undefined>;
  getWalkaroundCheckWithDetails(id: string): Promise<WalkaroundCheckWithDetails | undefined>;
  getWalkaroundChecksByVehicle(vehicleId: string): Promise<WalkaroundCheckWithDetails[]>;
  getAllWalkaroundChecks(): Promise<WalkaroundCheckWithDetails[]>;
  getTodayChecks(): Promise<WalkaroundCheckWithDetails[]>;
  createWalkaroundCheck(check: InsertWalkaroundCheck, items: InsertCheckItem[]): Promise<WalkaroundCheck>;
  
  getDefect(id: string): Promise<Defect | undefined>;
  getDefectWithDetails(id: string): Promise<DefectWithDetails | undefined>;
  getDefectsByVehicle(vehicleId: string): Promise<DefectWithDetails[]>;
  getAllDefects(): Promise<DefectWithDetails[]>;
  getOpenDefects(): Promise<DefectWithDetails[]>;
  createDefect(defect: InsertDefect): Promise<Defect>;
  updateDefect(id: string, updates: Partial<Defect>): Promise<Defect | undefined>;
  
  createDefectUpdate(update: InsertDefectUpdate): Promise<DefectUpdate>;
  getDefectUpdates(defectId: string): Promise<(DefectUpdate & { user: Pick<User, 'id' | 'name'> })[]>;
  
  getFleetDashboardStats(): Promise<{
    checksCompletedToday: number;
    checksDueToday: number;
    openDefectsBySeverity: { critical: number; major: number; minor: number };
  }>;
  
  // Timesheets
  getTimesheet(id: string): Promise<Timesheet | undefined>;
  getTimesheetsByUser(userId: string): Promise<TimesheetWithUser[]>;
  getAllTimesheets(): Promise<TimesheetWithUser[]>;
  createTimesheet(timesheet: InsertTimesheet): Promise<Timesheet>;
  updateTimesheet(id: string, updates: Partial<Timesheet>): Promise<Timesheet | undefined>;
  deleteTimesheet(id: string): Promise<void>;
  getActiveClockIn(userId: string): Promise<Timesheet | undefined>;
  
  // Expenses
  getExpense(id: string): Promise<Expense | undefined>;
  getExpensesByUser(userId: string): Promise<ExpenseWithDetails[]>;
  getAllExpenses(): Promise<ExpenseWithDetails[]>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: string, updates: Partial<Expense>): Promise<Expense | undefined>;
  deleteExpense(id: string): Promise<void>;
  
  // Payments
  getPayment(id: string): Promise<Payment | undefined>;
  getPaymentByStripeIntentId(intentId: string): Promise<Payment | undefined>;
  getPaymentsByInvoice(invoiceId: string): Promise<Payment[]>;
  getAllPayments(): Promise<PaymentWithInvoice[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, updates: Partial<Payment>): Promise<Payment | undefined>;
  
  // Skills
  getAllSkills(): Promise<Skill[]>;
  getSkillsCount(): Promise<number>;
  getSkillByName(name: string): Promise<Skill | undefined>;
  createSkill(name: string, category: string, icon: string): Promise<Skill>;
  upsertSkill(name: string, category: string, icon: string): Promise<Skill>;
  getUserSkills(userId: string): Promise<Skill[]>;
  addUserSkill(userId: string, skillId: string): Promise<void>;
  removeUserSkill(userId: string, skillId: string): Promise<void>;
  
  // Sub-Skills
  getSubSkillsBySkill(skillId: string): Promise<SubSkill[]>;
  getSubSkillsByIds(ids: string[]): Promise<SubSkill[]>;
  getAllSubSkills(): Promise<SubSkill[]>;
  createSubSkill(skillId: string, name: string, description?: string): Promise<SubSkill>;
  upsertSubSkill(skillId: string, name: string, description?: string): Promise<SubSkill>;
  updateSubSkill(id: string, updates: Partial<SubSkill>): Promise<SubSkill | undefined>;
  deleteSubSkill(id: string): Promise<void>;
  getUserSubSkills(userId: string, skillId: string): Promise<string[]>;
  setUserSubSkills(userId: string, skillId: string, subSkillIds: string[]): Promise<void>;
  getUserSkillRecords(userId: string): Promise<UserSkill[]>;
  
  // Works Manager
  getTeamMembers(managerId: string): Promise<User[]>;
  getTeamJobs(managerId: string): Promise<Job[]>;
  updateUserManager(userId: string, managerId: string | null): Promise<User | undefined>;
  getTeamTimesheets(managerId: string): Promise<TimesheetWithUser[]>;
  getTeamExpenses(managerId: string): Promise<ExpenseWithDetails[]>;
  
  // Inspections
  getInspections(): Promise<Inspection[]>;
  getInspection(id: string): Promise<InspectionWithDetails | undefined>;
  createInspection(data: InsertInspection): Promise<Inspection>;
  updateInspection(id: string, data: Partial<Inspection>): Promise<Inspection | undefined>;
  deleteInspection(id: string): Promise<void>;
  getInspectionItems(inspectionId: string): Promise<InspectionItem[]>;
  createInspectionItem(data: InsertInspectionItem): Promise<InspectionItem>;
  updateInspectionItem(id: string, data: Partial<InspectionItem>): Promise<InspectionItem | undefined>;
  deleteInspectionItem(id: string): Promise<void>;
  getNextInspectionNo(): Promise<string>;
  
  // Snagging Sheets
  getSnaggingSheets(): Promise<SnaggingSheet[]>;
  getSnaggingSheet(id: string): Promise<SnaggingSheetWithDetails | undefined>;
  createSnaggingSheet(data: InsertSnaggingSheet): Promise<SnaggingSheet>;
  updateSnaggingSheet(id: string, data: Partial<SnaggingSheet>): Promise<SnaggingSheet | undefined>;
  deleteSnaggingSheet(id: string): Promise<void>;
  getSnagItems(sheetId: string): Promise<SnagItem[]>;
  createSnagItem(data: InsertSnagItem): Promise<SnagItem>;
  updateSnagItem(id: string, data: Partial<SnagItem>): Promise<SnagItem | undefined>;
  deleteSnagItem(id: string): Promise<void>;
  getNextSnaggingSheetNo(): Promise<string>;
  
  // Accounts Portal
  getAccountsReceipts(): Promise<AccountsReceipt[]>;
  getAccountsReceipt(id: string): Promise<AccountsReceipt | undefined>;
  createAccountsReceipt(data: InsertAccountsReceipt): Promise<AccountsReceipt>;
  updateAccountsReceipt(id: string, data: Partial<AccountsReceipt>): Promise<AccountsReceipt | undefined>;
  deleteAccountsReceipt(id: string): Promise<void>;
  
  getInvoiceChaseLogs(invoiceId: string): Promise<InvoiceChaseLog[]>;
  createInvoiceChaseLog(data: InsertInvoiceChaseLog): Promise<InvoiceChaseLog>;
  
  getFixedCosts(): Promise<FixedCost[]>;
  getFixedCost(id: string): Promise<FixedCost | undefined>;
  createFixedCost(data: InsertFixedCost): Promise<FixedCost>;
  updateFixedCost(id: string, data: Partial<FixedCost>): Promise<FixedCost | undefined>;
  deleteFixedCost(id: string): Promise<void>;
  
  getInvoicesWithChaseInfo(): Promise<InvoiceWithChaseInfo[]>;
  getOverdueInvoices(daysOverdue?: number): Promise<InvoiceWithChaseInfo[]>;
  getFinancialSummary(startDate?: Date, endDate?: Date): Promise<FinancialSummary>;
  
  // Snippets
  getSnippets(userId: string): Promise<Snippet[]>;
  createSnippet(data: InsertSnippet): Promise<Snippet>;
  updateSnippet(id: string, data: Partial<Snippet>): Promise<Snippet | undefined>;
  deleteSnippet(id: string): Promise<void>;
  
  // Files
  getFile(id: string): Promise<FileRecord | undefined>;
  getAllFiles(): Promise<FileWithRelations[]>;
  getFilesByClient(clientId: string): Promise<FileWithRelations[]>;
  getFilesByJob(jobId: string): Promise<FileWithRelations[]>;
  getFilesByExpense(expenseId: string): Promise<FileWithRelations[]>;
  createFile(data: InsertFile): Promise<FileRecord>;
  updateFile(id: string, data: Partial<FileRecord>): Promise<FileRecord | undefined>;
  deleteFile(id: string): Promise<void>;
  
  // AI Conversations
  getAiConversation(id: string): Promise<AiConversation | undefined>;
  getAiConversationsByUser(userId: string): Promise<AiConversation[]>;
  createAiConversation(data: InsertAiConversation): Promise<AiConversation>;
  updateAiConversation(id: string, data: Partial<AiConversation>): Promise<AiConversation | undefined>;
  deleteAiConversation(id: string): Promise<void>;
  addMessageToConversation(conversationId: string, message: AiMessage): Promise<AiConversation | undefined>;
  
  // AI Business Patterns
  getAiBusinessPatterns(): Promise<AiBusinessPattern[]>;
  getAiBusinessPatternsByType(patternType: string): Promise<AiBusinessPattern[]>;
  createAiBusinessPattern(data: InsertAiBusinessPattern): Promise<AiBusinessPattern>;
  updateAiBusinessPattern(id: string, data: Partial<AiBusinessPattern>): Promise<AiBusinessPattern | undefined>;
  incrementPatternFrequency(id: string): Promise<AiBusinessPattern | undefined>;
  learnFromJob(job: Job): Promise<void>;
  learnFromQuote(quote: Quote): Promise<void>;
  
  // AI User Preferences
  getAiUserPreference(userId: string): Promise<AiUserPreference | undefined>;
  upsertAiUserPreference(userId: string, data: Partial<AiUserPreference>): Promise<AiUserPreference>;
  trackUserAction(userId: string, action: string): Promise<void>;
  
  // Form Templates
  getFormTemplates(): Promise<FormTemplate[]>;
  getFormTemplate(id: string): Promise<FormTemplate | undefined>;
  createFormTemplate(data: InsertFormTemplate): Promise<FormTemplate>;
  updateFormTemplate(id: string, data: Partial<FormTemplate>): Promise<FormTemplate | undefined>;
  deleteFormTemplate(id: string): Promise<void>;
  
  // Form Template Versions
  getFormTemplateVersions(templateId: string): Promise<FormTemplateVersion[]>;
  getFormTemplateVersion(id: string): Promise<FormTemplateVersion | undefined>;
  getLatestPublishedVersion(templateId: string): Promise<FormTemplateVersion | undefined>;
  createFormTemplateVersion(data: InsertFormTemplateVersion): Promise<FormTemplateVersion>;
  publishFormTemplateVersion(id: string): Promise<FormTemplateVersion | undefined>;
  
  // Form Submissions
  getFormSubmissions(filters?: { entityType?: string; entityId?: string; templateVersionId?: string }): Promise<FormSubmission[]>;
  getFormSubmission(id: string): Promise<FormSubmission | undefined>;
  createFormSubmission(data: InsertFormSubmission): Promise<FormSubmission>;
  updateFormSubmission(id: string, data: Partial<FormSubmission>): Promise<FormSubmission | undefined>;
  submitFormSubmission(id: string): Promise<FormSubmission | undefined>;
  
  // Form Assets
  getFormAssets(submissionId: string): Promise<FormAsset[]>;
  createFormAsset(data: InsertFormAsset): Promise<FormAsset>;
  deleteFormAsset(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async updateUser(id: string, updates: Partial<{ name: string; email: string | null; phone: string | null; tabletNumber: string | null; username: string; password: string; role: string; roles: string[]; superAdmin: boolean; twoFactorSecret: string | null; twoFactorEnabled: boolean; gdprConsentDate: Date | null; gdprConsentVersion: string | null; deletionRequestedAt: Date | null; status: string; workingAtHeight: boolean; negativeSkillIds: string[] }>): Promise<User | undefined> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async getAllEngineers(): Promise<User[]> {
    return db.select().from(users).where(eq(users.role, "engineer"));
  }

  async updateEngineerLocation(id: string, lat: number, lng: number): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ 
        currentLat: lat, 
        currentLng: lng, 
        lastLocationUpdate: new Date() 
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getJob(id: string): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job;
  }

  async getAllJobs(): Promise<Job[]> {
    return db.select().from(jobs).orderBy(desc(jobs.createdAt));
  }

  async getJobsByEngineer(engineerId: string): Promise<Job[]> {
    return db.select().from(jobs).where(
      or(
        eq(jobs.assignedToId, engineerId),
        sql`${jobs.assignedToIds}::jsonb @> ${JSON.stringify([engineerId])}::jsonb`
      )
    ).orderBy(desc(jobs.createdAt));
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const [job] = await db.insert(jobs).values(insertJob).returning();
    return job;
  }

  async updateJob(id: string, updates: Partial<Job>): Promise<Job | undefined> {
    const [job] = await db
      .update(jobs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(jobs.id, id))
      .returning();
    return job;
  }

  async deleteJob(id: string): Promise<void> {
    await db.delete(jobs).where(eq(jobs.id, id));
  }

  async signOffJob(id: string): Promise<Job | undefined> {
    const [job] = await db
      .update(jobs)
      .set({
        status: "Signed Off",
        signOffTimestamp: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, id))
      .returning();
    return job;
  }

  async addEngineerLocation(location: InsertEngineerLocation): Promise<EngineerLocation> {
    const [loc] = await db.insert(engineerLocations).values(location).returning();
    return loc;
  }

  async getEngineerLocationHistory(engineerId: string, limit = 50): Promise<EngineerLocation[]> {
    return db
      .select()
      .from(engineerLocations)
      .where(eq(engineerLocations.engineerId, engineerId))
      .orderBy(desc(engineerLocations.timestamp))
      .limit(limit);
  }

  async getEngineerLocations(): Promise<{ id: string; name: string; lat: number; lng: number; lastUpdate: Date | null }[]> {
    const engineers = await db
      .select()
      .from(users)
      .where(eq(users.role, "engineer"));
    
    return engineers
      .filter(e => e.currentLat !== null && e.currentLng !== null)
      .map(e => ({
        id: e.id,
        name: e.name,
        lat: e.currentLat!,
        lng: e.currentLng!,
        lastUpdate: e.lastLocationUpdate,
      }));
  }

  async getAllAiAdvisors(): Promise<AiAdvisor[]> {
    return db.select().from(aiAdvisors).orderBy(aiAdvisors.name);
  }

  async getActiveAiAdvisors(): Promise<AiAdvisor[]> {
    return db.select().from(aiAdvisors).where(eq(aiAdvisors.isActive, true)).orderBy(aiAdvisors.name);
  }

  async getAiAdvisor(id: string): Promise<AiAdvisor | undefined> {
    const [advisor] = await db.select().from(aiAdvisors).where(eq(aiAdvisors.id, id));
    return advisor;
  }

  async createAiAdvisor(advisor: InsertAiAdvisor): Promise<AiAdvisor> {
    const [created] = await db.insert(aiAdvisors).values(advisor).returning();
    return created;
  }

  async updateAiAdvisor(id: string, updates: Partial<AiAdvisor>): Promise<AiAdvisor | undefined> {
    const [updated] = await db.update(aiAdvisors).set(updates).where(eq(aiAdvisors.id, id)).returning();
    return updated;
  }

  async deleteAiAdvisor(id: string): Promise<void> {
    await db.delete(aiAdvisors).where(eq(aiAdvisors.id, id));
  }

  async clockIn(engineerId: string, lat: number | null, lng: number | null, address: string | null): Promise<TimeLog> {
    const [timeLog] = await db.insert(timeLogs).values({
      engineerId,
      clockInTime: new Date(),
      clockInLat: lat,
      clockInLng: lng,
      clockInAddress: address,
    }).returning();
    return timeLog;
  }

  async clockOut(engineerId: string, lat: number | null, lng: number | null, address: string | null): Promise<TimeLog | undefined> {
    const activeLog = await this.getActiveTimeLog(engineerId);
    if (!activeLog) return undefined;
    
    const [updated] = await db.update(timeLogs).set({
      clockOutTime: new Date(),
      clockOutLat: lat,
      clockOutLng: lng,
      clockOutAddress: address,
    }).where(eq(timeLogs.id, activeLog.id)).returning();
    return updated;
  }

  async getActiveTimeLog(engineerId: string): Promise<TimeLog | undefined> {
    const [log] = await db.select().from(timeLogs).where(
      and(
        eq(timeLogs.engineerId, engineerId),
        isNull(timeLogs.clockOutTime)
      )
    ).orderBy(desc(timeLogs.clockInTime)).limit(1);
    return log;
  }

  async getTimeLogsByEngineer(engineerId: string, limit = 50): Promise<TimeLog[]> {
    return db.select().from(timeLogs)
      .where(eq(timeLogs.engineerId, engineerId))
      .orderBy(desc(timeLogs.clockInTime))
      .limit(limit);
  }

  async getAllTimeLogs(limit = 100): Promise<TimeLog[]> {
    return db.select().from(timeLogs)
      .orderBy(desc(timeLogs.clockInTime))
      .limit(limit);
  }

  async getQuote(id: string): Promise<Quote | undefined> {
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, id));
    return quote;
  }

  async getQuoteByToken(token: string): Promise<Quote | undefined> {
    const [quote] = await db.select().from(quotes).where(eq(quotes.accessToken, token));
    return quote;
  }

  async getAllQuotes(): Promise<Quote[]> {
    return db.select().from(quotes).orderBy(desc(quotes.createdAt));
  }

  async createQuote(quote: InsertQuote): Promise<Quote> {
    const [created] = await db.insert(quotes).values(quote).returning();
    return created;
  }

  async updateQuote(id: string, updates: Partial<Quote>): Promise<Quote | undefined> {
    const [updated] = await db.update(quotes).set({ ...updates, updatedAt: new Date() }).where(eq(quotes.id, id)).returning();
    return updated;
  }

  async deleteQuote(id: string): Promise<void> {
    await db.delete(quotes).where(eq(quotes.id, id));
  }

  async getNextQuoteNumber(): Promise<string> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(quotes);
    const count = Number(result[0]?.count || 0) + 1;
    const year = new Date().getFullYear();
    return `Q-${year}-${String(count).padStart(4, '0')}`;
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice;
  }

  async getInvoiceByToken(token: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.accessToken, token));
    return invoice;
  }

  async getAllInvoices(): Promise<Invoice[]> {
    return db.select().from(invoices).orderBy(desc(invoices.createdAt));
  }

  async getInvoicesByJob(jobId: string): Promise<Invoice[]> {
    return db.select().from(invoices).where(eq(invoices.jobId, jobId)).orderBy(desc(invoices.createdAt));
  }

  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    const [created] = await db.insert(invoices).values(invoice).returning();
    return created;
  }

  async updateInvoice(id: string, updates: Partial<Invoice>): Promise<Invoice | undefined> {
    const [updated] = await db.update(invoices).set({ ...updates, updatedAt: new Date() }).where(eq(invoices.id, id)).returning();
    return updated;
  }

  async deleteInvoice(id: string): Promise<void> {
    await db.delete(invoices).where(eq(invoices.id, id));
  }

  async getNextInvoiceNumber(): Promise<string> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(invoices);
    const count = Number(result[0]?.count || 0) + 1;
    const year = new Date().getFullYear();
    return `INV-${year}-${String(count).padStart(4, '0')}`;
  }

  async getCompanySettings(): Promise<CompanySettings | undefined> {
    const [settings] = await db.select().from(companySettings).limit(1);
    return settings;
  }

  async upsertCompanySettings(settings: InsertCompanySettings): Promise<CompanySettings> {
    const existing = await this.getCompanySettings();
    if (existing) {
      const [updated] = await db.update(companySettings).set({ ...settings, updatedAt: new Date() }).where(eq(companySettings.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(companySettings).values(settings).returning();
    return created;
  }

  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async getClientByEmail(email: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.email, email));
    return client;
  }

  async getClientByPortalToken(token: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.portalToken, token));
    return client;
  }

  async getClientQuotes(clientId: string): Promise<Quote[]> {
    return db.select().from(quotes).where(eq(quotes.customerId, clientId)).orderBy(desc(quotes.createdAt));
  }

  async getClientInvoices(clientId: string): Promise<Invoice[]> {
    return db.select().from(invoices).where(eq(invoices.customerId, clientId)).orderBy(desc(invoices.createdAt));
  }

  async getClientJobs(clientId: string): Promise<Job[]> {
    return db.select().from(jobs).where(eq(jobs.client, clientId)).orderBy(desc(jobs.createdAt));
  }

  async getAllClients(): Promise<Client[]> {
    return db.select().from(clients).orderBy(desc(clients.name));
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [created] = await db.insert(clients).values(client).returning();
    return created;
  }

  async updateClient(id: string, updates: Partial<Client>): Promise<Client | undefined> {
    const [updated] = await db.update(clients).set({ ...updates, updatedAt: new Date() }).where(eq(clients.id, id)).returning();
    return updated;
  }

  async deleteClient(id: string): Promise<void> {
    await db.delete(clients).where(eq(clients.id, id));
  }

  async findOrCreateClient(data: { name: string; email?: string | null; phone?: string | null; address?: string | null; postcode?: string | null; contactName?: string | null }): Promise<Client> {
    if (data.email) {
      const existing = await this.getClientByEmail(data.email);
      if (existing) {
        const [updated] = await db.update(clients).set({ 
          name: data.name,
          phone: data.phone ?? existing.phone,
          address: data.address ?? existing.address,
          postcode: data.postcode ?? existing.postcode,
          contactName: data.contactName ?? existing.contactName,
          updatedAt: new Date()
        }).where(eq(clients.id, existing.id)).returning();
        return updated;
      }
    }
    return this.createClient({
      name: data.name,
      email: data.email,
      phone: data.phone,
      address: data.address,
      postcode: data.postcode,
      contactName: data.contactName,
    });
  }

  // Client Contacts
  async getClientContacts(clientId: string): Promise<ClientContact[]> {
    return db.select().from(clientContacts).where(eq(clientContacts.clientId, clientId)).orderBy(desc(clientContacts.isPrimary), asc(clientContacts.name));
  }

  async createClientContact(contact: InsertClientContact): Promise<ClientContact> {
    const [created] = await db.insert(clientContacts).values(contact).returning();
    return created;
  }

  async updateClientContact(id: string, updates: Partial<ClientContact>): Promise<ClientContact | undefined> {
    // Only allow updating these specific fields
    const { name, email, phone, role, isPrimary } = updates;
    const safeUpdates: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) safeUpdates.name = name;
    if (email !== undefined) safeUpdates.email = email;
    if (phone !== undefined) safeUpdates.phone = phone;
    if (role !== undefined) safeUpdates.role = role;
    if (isPrimary !== undefined) safeUpdates.isPrimary = isPrimary;
    
    const [updated] = await db.update(clientContacts).set(safeUpdates).where(eq(clientContacts.id, id)).returning();
    return updated;
  }

  async deleteClientContact(id: string): Promise<void> {
    await db.delete(clientContacts).where(eq(clientContacts.id, id));
  }

  // Client Properties
  async getClientProperties(clientId: string): Promise<ClientProperty[]> {
    return db.select().from(clientProperties).where(eq(clientProperties.clientId, clientId)).orderBy(desc(clientProperties.isDefault), asc(clientProperties.name));
  }

  async createClientProperty(property: InsertClientProperty): Promise<ClientProperty> {
    const [created] = await db.insert(clientProperties).values(property).returning();
    return created;
  }

  async updateClientProperty(id: string, updates: Partial<ClientProperty>): Promise<ClientProperty | undefined> {
    const { name, address, postcode, contactName, contactPhone, contactEmail, notes, isDefault } = updates;
    const safeUpdates: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) safeUpdates.name = name;
    if (address !== undefined) safeUpdates.address = address;
    if (postcode !== undefined) safeUpdates.postcode = postcode;
    if (contactName !== undefined) safeUpdates.contactName = contactName;
    if (contactPhone !== undefined) safeUpdates.contactPhone = contactPhone;
    if (contactEmail !== undefined) safeUpdates.contactEmail = contactEmail;
    if (notes !== undefined) safeUpdates.notes = notes;
    if (isDefault !== undefined) safeUpdates.isDefault = isDefault;
    
    const [updated] = await db.update(clientProperties).set(safeUpdates).where(eq(clientProperties.id, id)).returning();
    return updated;
  }

  async deleteClientProperty(id: string): Promise<void> {
    await db.delete(clientProperties).where(eq(clientProperties.id, id));
  }

  async createJobUpdate(update: InsertJobUpdate): Promise<JobUpdate> {
    const [created] = await db.insert(jobUpdates).values(update).returning();
    return created;
  }

  async getJobUpdates(jobId: string): Promise<JobUpdate[]> {
    return db.select().from(jobUpdates)
      .where(eq(jobUpdates.jobId, jobId))
      .orderBy(desc(jobUpdates.workDate), desc(jobUpdates.sequence));
  }

  async getJobUpdatesForDate(jobId: string, workDate: Date): Promise<JobUpdate[]> {
    const startOfDay = new Date(workDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(workDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    return db.select().from(jobUpdates)
      .where(
        and(
          eq(jobUpdates.jobId, jobId),
          sql`${jobUpdates.workDate} >= ${startOfDay} AND ${jobUpdates.workDate} <= ${endOfDay}`
        )
      )
      .orderBy(jobUpdates.sequence);
  }

  async countJobUpdatesForDate(jobId: string, workDate: Date): Promise<number> {
    const startOfDay = new Date(workDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(workDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(jobUpdates)
      .where(
        and(
          eq(jobUpdates.jobId, jobId),
          sql`${jobUpdates.workDate} >= ${startOfDay} AND ${jobUpdates.workDate} <= ${endOfDay}`
        )
      );
    return Number(result[0]?.count || 0);
  }

  // Messaging implementation
  async createConversation(conversation: InsertConversation, memberIds: string[]): Promise<Conversation> {
    const [created] = await db.insert(conversations).values(conversation).returning();
    
    // Add all members including creator (deduplicated)
    const allMemberIds = Array.from(new Set([conversation.createdById, ...memberIds]));
    for (const memberId of allMemberIds) {
      await db.insert(conversationMembers).values({
        conversationId: created.id,
        userId: memberId,
      });
    }
    
    return created;
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation;
  }

  async getUserConversations(userId: string): Promise<ConversationWithDetails[]> {
    // Get all conversation IDs for this user
    const memberRecords = await db.select()
      .from(conversationMembers)
      .where(eq(conversationMembers.userId, userId));
    
    const conversationIds = memberRecords.map(m => m.conversationId);
    if (conversationIds.length === 0) return [];

    // Get conversations
    const convos = await db.select()
      .from(conversations)
      .where(inArray(conversations.id, conversationIds))
      .orderBy(desc(conversations.updatedAt));

    // Build detailed conversations
    const result: ConversationWithDetails[] = [];
    
    for (const convo of convos) {
      // Get members with user info
      const members = await db.select()
        .from(conversationMembers)
        .where(eq(conversationMembers.conversationId, convo.id));
      
      const membersWithUsers = await Promise.all(
        members.map(async (member) => {
          const [user] = await db.select({
            id: users.id,
            name: users.name,
            role: users.role,
          }).from(users).where(eq(users.id, member.userId));
          return { ...member, user };
        })
      );

      // Get last message
      const [lastMsg] = await db.select()
        .from(messages)
        .where(eq(messages.conversationId, convo.id))
        .orderBy(desc(messages.createdAt))
        .limit(1);
      
      let lastMessage;
      if (lastMsg) {
        const [sender] = await db.select({
          id: users.id,
          name: users.name,
        }).from(users).where(eq(users.id, lastMsg.senderId));
        lastMessage = { ...lastMsg, sender };
      }

      // Get unread count
      const userMember = members.find(m => m.userId === userId);
      let unreadCount = 0;
      if (userMember) {
        if (userMember.lastReadAt) {
          const unreadResult = await db.select({ count: sql<number>`count(*)` })
            .from(messages)
            .where(and(
              eq(messages.conversationId, convo.id),
              gt(messages.createdAt, userMember.lastReadAt),
              ne(messages.senderId, userId)
            ));
          unreadCount = Number(unreadResult[0]?.count || 0);
        } else {
          const unreadResult = await db.select({ count: sql<number>`count(*)` })
            .from(messages)
            .where(and(
              eq(messages.conversationId, convo.id),
              ne(messages.senderId, userId)
            ));
          unreadCount = Number(unreadResult[0]?.count || 0);
        }
      }

      result.push({
        ...convo,
        members: membersWithUsers,
        lastMessage,
        unreadCount,
      });
    }

    return result;
  }

  async getOrCreateDirectConversation(userId1: string, userId2: string): Promise<Conversation> {
    // Find existing direct conversation between these two users
    const user1Convos = await db.select()
      .from(conversationMembers)
      .where(eq(conversationMembers.userId, userId1));
    
    for (const member of user1Convos) {
      const [convo] = await db.select()
        .from(conversations)
        .where(and(
          eq(conversations.id, member.conversationId),
          eq(conversations.isGroup, false)
        ));
      
      if (convo) {
        const otherMember = await db.select()
          .from(conversationMembers)
          .where(and(
            eq(conversationMembers.conversationId, convo.id),
            eq(conversationMembers.userId, userId2)
          ));
        
        if (otherMember.length > 0) {
          return convo;
        }
      }
    }

    // Create new direct conversation
    return this.createConversation({ createdById: userId1, isGroup: false }, [userId2]);
  }

  async addConversationMember(conversationId: string, userId: string): Promise<ConversationMember> {
    const [member] = await db.insert(conversationMembers)
      .values({ conversationId, userId })
      .returning();
    return member;
  }

  async removeConversationMember(conversationId: string, userId: string): Promise<void> {
    await db.delete(conversationMembers)
      .where(and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId)
      ));
  }

  async isConversationMember(conversationId: string, userId: string): Promise<boolean> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(conversationMembers)
      .where(and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId)
      ));
    return Number(result[0]?.count || 0) > 0;
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [created] = await db.insert(messages).values(message).returning();
    
    // Update conversation's updatedAt
    await db.update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, message.conversationId));
    
    return created;
  }

  async getMessages(conversationId: string, limit = 50, before?: Date): Promise<MessageWithSender[]> {
    let query = db.select()
      .from(messages)
      .where(before 
        ? and(eq(messages.conversationId, conversationId), sql`${messages.createdAt} < ${before}`)
        : eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
    
    const msgs = await query;
    
    // Add sender info
    const result = await Promise.all(
      msgs.map(async (msg) => {
        const [sender] = await db.select({
          id: users.id,
          name: users.name,
          role: users.role,
        }).from(users).where(eq(users.id, msg.senderId));
        return { ...msg, sender };
      })
    );
    
    // Return in chronological order
    return result.reverse();
  }

  async markConversationRead(conversationId: string, userId: string): Promise<void> {
    await db.update(conversationMembers)
      .set({ lastReadAt: new Date() })
      .where(and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId)
      ));
  }

  async getUnreadCount(userId: string): Promise<number> {
    const memberRecords = await db.select()
      .from(conversationMembers)
      .where(eq(conversationMembers.userId, userId));
    
    let totalUnread = 0;
    for (const member of memberRecords) {
      if (member.lastReadAt) {
        const result = await db.select({ count: sql<number>`count(*)` })
          .from(messages)
          .where(and(
            eq(messages.conversationId, member.conversationId),
            gt(messages.createdAt, member.lastReadAt),
            ne(messages.senderId, userId)
          ));
        totalUnread += Number(result[0]?.count || 0);
      } else {
        const result = await db.select({ count: sql<number>`count(*)` })
          .from(messages)
          .where(and(
            eq(messages.conversationId, member.conversationId),
            ne(messages.senderId, userId)
          ));
        totalUnread += Number(result[0]?.count || 0);
      }
    }
    
    return totalUnread;
  }

  // Fleet Maintenance Methods
  async getVehicle(id: string): Promise<Vehicle | undefined> {
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id));
    return vehicle;
  }

  async getAllVehicles(): Promise<Vehicle[]> {
    return db.select().from(vehicles).orderBy(asc(vehicles.registration));
  }

  async getVehiclesWithStats(): Promise<VehicleWithStats[]> {
    const allVehicles = await this.getAllVehicles();
    return Promise.all(allVehicles.map(async (vehicle) => {
      const [lastCheck] = await db.select()
        .from(walkaroundChecks)
        .where(eq(walkaroundChecks.vehicleId, vehicle.id))
        .orderBy(desc(walkaroundChecks.createdAt))
        .limit(1);
      
      const openDefectsResult = await db.select({ count: sql<number>`count(*)` })
        .from(defects)
        .where(and(
          eq(defects.vehicleId, vehicle.id),
          inArray(defects.status, ['open', 'in_progress'])
        ));
      
      return {
        ...vehicle,
        lastCheckDate: lastCheck?.createdAt || null,
        openDefectsCount: Number(openDefectsResult[0]?.count || 0),
      };
    }));
  }

  async createVehicle(vehicle: InsertVehicle): Promise<Vehicle> {
    const [created] = await db.insert(vehicles).values(vehicle).returning();
    return created;
  }

  async updateVehicle(id: string, updates: Partial<Vehicle>): Promise<Vehicle | undefined> {
    const [updated] = await db.update(vehicles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(vehicles.id, id))
      .returning();
    return updated;
  }

  async deleteVehicle(id: string): Promise<void> {
    await db.delete(vehicles).where(eq(vehicles.id, id));
  }

  async getVehiclesByUserId(userId: string): Promise<Vehicle[]> {
    return db.select().from(vehicles).where(eq(vehicles.assignedUserId, userId));
  }

  async getAvailableVehicles(): Promise<Vehicle[]> {
    return db.select().from(vehicles).where(isNull(vehicles.assignedUserId));
  }

  async assignVehicleToUser(vehicleId: string, userId: string | null): Promise<Vehicle | undefined> {
    const [updated] = await db.update(vehicles)
      .set({ assignedUserId: userId, updatedAt: new Date() })
      .where(eq(vehicles.id, vehicleId))
      .returning();
    return updated;
  }

  async getWalkaroundCheck(id: string): Promise<WalkaroundCheck | undefined> {
    const [check] = await db.select().from(walkaroundChecks).where(eq(walkaroundChecks.id, id));
    return check;
  }

  async getWalkaroundCheckWithDetails(id: string): Promise<WalkaroundCheckWithDetails | undefined> {
    const check = await this.getWalkaroundCheck(id);
    if (!check) return undefined;
    
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, check.vehicleId));
    const [inspector] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, check.inspectorId));
    const items = await db.select().from(checkItems).where(eq(checkItems.checkId, check.id));
    
    return { ...check, vehicle, inspector, items };
  }

  async getWalkaroundChecksByVehicle(vehicleId: string): Promise<WalkaroundCheckWithDetails[]> {
    const checks = await db.select()
      .from(walkaroundChecks)
      .where(eq(walkaroundChecks.vehicleId, vehicleId))
      .orderBy(desc(walkaroundChecks.createdAt));
    
    return Promise.all(checks.map(async (check) => {
      const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, check.vehicleId));
      const [inspector] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, check.inspectorId));
      const items = await db.select().from(checkItems).where(eq(checkItems.checkId, check.id));
      return { ...check, vehicle, inspector, items };
    }));
  }

  async getAllWalkaroundChecks(): Promise<WalkaroundCheckWithDetails[]> {
    const checks = await db.select()
      .from(walkaroundChecks)
      .orderBy(desc(walkaroundChecks.createdAt))
      .limit(100);
    
    return Promise.all(checks.map(async (check) => {
      const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, check.vehicleId));
      const [inspector] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, check.inspectorId));
      const items = await db.select().from(checkItems).where(eq(checkItems.checkId, check.id));
      return { ...check, vehicle, inspector, items };
    }));
  }

  async getTodayChecks(): Promise<WalkaroundCheckWithDetails[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const checks = await db.select()
      .from(walkaroundChecks)
      .where(gt(walkaroundChecks.createdAt, today))
      .orderBy(desc(walkaroundChecks.createdAt));
    
    return Promise.all(checks.map(async (check) => {
      const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, check.vehicleId));
      const [inspector] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, check.inspectorId));
      const items = await db.select().from(checkItems).where(eq(checkItems.checkId, check.id));
      return { ...check, vehicle, inspector, items };
    }));
  }

  async createWalkaroundCheck(check: InsertWalkaroundCheck, items: InsertCheckItem[]): Promise<WalkaroundCheck> {
    const [created] = await db.insert(walkaroundChecks).values(check).returning();
    
    if (items.length > 0) {
      const itemsWithCheckId = items.map(item => ({ ...item, checkId: created.id }));
      await db.insert(checkItems).values(itemsWithCheckId);
    }
    
    return created;
  }

  async getDefect(id: string): Promise<Defect | undefined> {
    const [defect] = await db.select().from(defects).where(eq(defects.id, id));
    return defect;
  }

  async getDefectWithDetails(id: string): Promise<DefectWithDetails | undefined> {
    const defect = await this.getDefect(id);
    if (!defect) return undefined;
    
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, defect.vehicleId));
    const [reportedBy] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, defect.reportedById));
    
    let assignedTo = null;
    if (defect.assignedToId) {
      const [assigned] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, defect.assignedToId));
      assignedTo = assigned;
    }
    
    let check = null;
    if (defect.checkId) {
      const [c] = await db.select().from(walkaroundChecks).where(eq(walkaroundChecks.id, defect.checkId));
      check = c;
    }
    
    return { ...defect, vehicle, reportedBy, assignedTo, check };
  }

  async getDefectsByVehicle(vehicleId: string): Promise<DefectWithDetails[]> {
    const allDefects = await db.select()
      .from(defects)
      .where(eq(defects.vehicleId, vehicleId))
      .orderBy(desc(defects.createdAt));
    
    return Promise.all(allDefects.map(async (defect) => {
      const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, defect.vehicleId));
      const [reportedBy] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, defect.reportedById));
      let assignedTo = null;
      if (defect.assignedToId) {
        const [assigned] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, defect.assignedToId));
        assignedTo = assigned;
      }
      return { ...defect, vehicle, reportedBy, assignedTo };
    }));
  }

  async getAllDefects(): Promise<DefectWithDetails[]> {
    const allDefects = await db.select()
      .from(defects)
      .orderBy(desc(defects.createdAt))
      .limit(100);
    
    return Promise.all(allDefects.map(async (defect) => {
      const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, defect.vehicleId));
      const [reportedBy] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, defect.reportedById));
      let assignedTo = null;
      if (defect.assignedToId) {
        const [assigned] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, defect.assignedToId));
        assignedTo = assigned;
      }
      return { ...defect, vehicle, reportedBy, assignedTo };
    }));
  }

  async getOpenDefects(): Promise<DefectWithDetails[]> {
    const openDefects = await db.select()
      .from(defects)
      .where(inArray(defects.status, ['open', 'in_progress']))
      .orderBy(desc(defects.createdAt));
    
    return Promise.all(openDefects.map(async (defect) => {
      const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, defect.vehicleId));
      const [reportedBy] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, defect.reportedById));
      let assignedTo = null;
      if (defect.assignedToId) {
        const [assigned] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, defect.assignedToId));
        assignedTo = assigned;
      }
      return { ...defect, vehicle, reportedBy, assignedTo };
    }));
  }

  async createDefect(defect: InsertDefect): Promise<Defect> {
    const [created] = await db.insert(defects).values(defect).returning();
    return created;
  }

  async updateDefect(id: string, updates: Partial<Defect>): Promise<Defect | undefined> {
    const [updated] = await db.update(defects)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(defects.id, id))
      .returning();
    return updated;
  }

  async createDefectUpdate(update: InsertDefectUpdate): Promise<DefectUpdate> {
    const [created] = await db.insert(defectUpdates).values(update).returning();
    return created;
  }

  async getDefectUpdates(defectId: string): Promise<(DefectUpdate & { user: Pick<User, 'id' | 'name'> })[]> {
    const updates = await db.select()
      .from(defectUpdates)
      .where(eq(defectUpdates.defectId, defectId))
      .orderBy(asc(defectUpdates.createdAt));
    
    return Promise.all(updates.map(async (update) => {
      const [user] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, update.userId));
      return { ...update, user };
    }));
  }

  async getFleetDashboardStats(): Promise<{
    checksCompletedToday: number;
    checksDueToday: number;
    openDefectsBySeverity: { critical: number; major: number; minor: number };
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const checksResult = await db.select({ count: sql<number>`count(*)` })
      .from(walkaroundChecks)
      .where(gt(walkaroundChecks.createdAt, today));
    
    const vehicleCount = await db.select({ count: sql<number>`count(*)` })
      .from(vehicles)
      .where(eq(vehicles.status, 'active'));
    
    const criticalResult = await db.select({ count: sql<number>`count(*)` })
      .from(defects)
      .where(and(
        eq(defects.severity, 'critical'),
        inArray(defects.status, ['open', 'in_progress'])
      ));
    
    const majorResult = await db.select({ count: sql<number>`count(*)` })
      .from(defects)
      .where(and(
        eq(defects.severity, 'major'),
        inArray(defects.status, ['open', 'in_progress'])
      ));
    
    const minorResult = await db.select({ count: sql<number>`count(*)` })
      .from(defects)
      .where(and(
        eq(defects.severity, 'minor'),
        inArray(defects.status, ['open', 'in_progress'])
      ));
    
    return {
      checksCompletedToday: Number(checksResult[0]?.count || 0),
      checksDueToday: Number(vehicleCount[0]?.count || 0),
      openDefectsBySeverity: {
        critical: Number(criticalResult[0]?.count || 0),
        major: Number(majorResult[0]?.count || 0),
        minor: Number(minorResult[0]?.count || 0),
      }
    };
  }

  // ==================== TIMESHEETS ====================

  async getTimesheet(id: string): Promise<Timesheet | undefined> {
    const [timesheet] = await db.select().from(timesheets).where(eq(timesheets.id, id));
    return timesheet;
  }

  async getTimesheetsByUser(userId: string): Promise<TimesheetWithUser[]> {
    const results = await db.select().from(timesheets)
      .where(eq(timesheets.userId, userId))
      .orderBy(desc(timesheets.date));
    
    return Promise.all(results.map(async (timesheet) => {
      const [user] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, timesheet.userId));
      let approvedBy = null;
      if (timesheet.approvedById) {
        const [approver] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, timesheet.approvedById));
        approvedBy = approver || null;
      }
      return { ...timesheet, user, approvedBy };
    }));
  }

  async getAllTimesheets(): Promise<TimesheetWithUser[]> {
    const results = await db.select().from(timesheets).orderBy(desc(timesheets.date));
    
    return Promise.all(results.map(async (timesheet) => {
      const [user] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, timesheet.userId));
      let approvedBy = null;
      if (timesheet.approvedById) {
        const [approver] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, timesheet.approvedById));
        approvedBy = approver || null;
      }
      return { ...timesheet, user, approvedBy };
    }));
  }

  async createTimesheet(timesheet: InsertTimesheet): Promise<Timesheet> {
    const [created] = await db.insert(timesheets).values(timesheet).returning();
    return created;
  }

  async updateTimesheet(id: string, updates: Partial<Timesheet>): Promise<Timesheet | undefined> {
    const [updated] = await db.update(timesheets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(timesheets.id, id))
      .returning();
    return updated;
  }

  async deleteTimesheet(id: string): Promise<void> {
    await db.delete(timesheets).where(eq(timesheets.id, id));
  }

  async getActiveClockIn(userId: string): Promise<Timesheet | undefined> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const [activeTimesheet] = await db.select().from(timesheets)
      .where(and(
        eq(timesheets.userId, userId),
        gt(timesheets.date, today),
        sql`${timesheets.date} < ${tomorrow}`,
        sql`${timesheets.clockIn} IS NOT NULL`,
        isNull(timesheets.clockOut)
      ))
      .orderBy(desc(timesheets.clockIn))
      .limit(1);
    
    return activeTimesheet;
  }

  // ==================== EXPENSES ====================

  async getExpense(id: string): Promise<Expense | undefined> {
    const [expense] = await db.select().from(expenses).where(eq(expenses.id, id));
    return expense;
  }

  async getExpensesByUser(userId: string): Promise<ExpenseWithDetails[]> {
    const results = await db.select().from(expenses)
      .where(eq(expenses.userId, userId))
      .orderBy(desc(expenses.date));
    
    return Promise.all(results.map(async (expense) => {
      const [user] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, expense.userId));
      let approvedBy = null;
      if (expense.approvedById) {
        const [approver] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, expense.approvedById));
        approvedBy = approver || null;
      }
      let job = null;
      if (expense.jobId) {
        const [jobRecord] = await db.select({ id: jobs.id, jobNo: jobs.jobNo, customerName: jobs.customerName }).from(jobs).where(eq(jobs.id, expense.jobId));
        job = jobRecord || null;
      }
      return { ...expense, user, approvedBy, job };
    }));
  }

  async getAllExpenses(): Promise<ExpenseWithDetails[]> {
    const results = await db.select().from(expenses).orderBy(desc(expenses.date));
    
    return Promise.all(results.map(async (expense) => {
      const [user] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, expense.userId));
      let approvedBy = null;
      if (expense.approvedById) {
        const [approver] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, expense.approvedById));
        approvedBy = approver || null;
      }
      let job = null;
      if (expense.jobId) {
        const [jobRecord] = await db.select({ id: jobs.id, jobNo: jobs.jobNo, customerName: jobs.customerName }).from(jobs).where(eq(jobs.id, expense.jobId));
        job = jobRecord || null;
      }
      return { ...expense, user, approvedBy, job };
    }));
  }

  async createExpense(expense: InsertExpense): Promise<Expense> {
    const [created] = await db.insert(expenses).values(expense).returning();
    return created;
  }

  async updateExpense(id: string, updates: Partial<Expense>): Promise<Expense | undefined> {
    const [updated] = await db.update(expenses)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(expenses.id, id))
      .returning();
    return updated;
  }

  async deleteExpense(id: string): Promise<void> {
    await db.delete(expenses).where(eq(expenses.id, id));
  }

  // ==================== PAYMENTS ====================

  async getPayment(id: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    return payment;
  }

  async getPaymentByStripeIntentId(intentId: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.stripePaymentIntentId, intentId));
    return payment;
  }

  async getPaymentsByInvoice(invoiceId: string): Promise<Payment[]> {
    return db.select().from(payments)
      .where(eq(payments.invoiceId, invoiceId))
      .orderBy(desc(payments.createdAt));
  }

  async getAllPayments(): Promise<PaymentWithInvoice[]> {
    const results = await db.select().from(payments).orderBy(desc(payments.createdAt));
    
    return Promise.all(results.map(async (payment) => {
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, payment.invoiceId));
      return { ...payment, invoice };
    }));
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [created] = await db.insert(payments).values(payment).returning();
    return created;
  }

  async updatePayment(id: string, updates: Partial<Payment>): Promise<Payment | undefined> {
    const [updated] = await db.update(payments)
      .set(updates)
      .where(eq(payments.id, id))
      .returning();
    return updated;
  }

  async getAllSkills(): Promise<Skill[]> {
    return db.select().from(skills).where(eq(skills.isActive, true));
  }

  async getSkillsCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(skills);
    return result[0]?.count || 0;
  }

  async getSkillByName(name: string): Promise<Skill | undefined> {
    const result = await db.select().from(skills).where(eq(skills.name, name)).limit(1);
    return result[0];
  }

  async createSkill(name: string, category: string, icon: string): Promise<Skill> {
    const [skill] = await db.insert(skills).values({ name, category, icon, isActive: true }).returning();
    return skill;
  }

  async upsertSkill(name: string, category: string, icon: string): Promise<Skill> {
    // Insert if not exists, or return existing
    const existing = await db.select().from(skills).where(eq(skills.name, name)).limit(1);
    if (existing.length > 0) {
      return existing[0];
    }
    const [skill] = await db.insert(skills).values({ name, category, icon, isActive: true }).returning();
    return skill;
  }

  async getUserSkills(userId: string): Promise<Skill[]> {
    const userSkillRows = await db.select()
      .from(userSkills)
      .where(eq(userSkills.userId, userId));
    
    if (userSkillRows.length === 0) {
      return [];
    }
    
    const skillIds = userSkillRows.map(us => us.skillId);
    return db.select().from(skills).where(inArray(skills.id, skillIds));
  }

  async addUserSkill(userId: string, skillId: string): Promise<void> {
    await db.insert(userSkills).values({ userId, skillId }).onConflictDoNothing();
  }

  async removeUserSkill(userId: string, skillId: string): Promise<void> {
    await db.delete(userSkills)
      .where(and(eq(userSkills.userId, userId), eq(userSkills.skillId, skillId)));
  }

  // ==================== SUB-SKILLS ====================

  async getSubSkillsBySkill(skillId: string): Promise<SubSkill[]> {
    return db.select().from(subSkills).where(
      and(eq(subSkills.skillId, skillId), eq(subSkills.isActive, true))
    );
  }

  async getAllSubSkills(): Promise<SubSkill[]> {
    return db.select().from(subSkills).where(eq(subSkills.isActive, true));
  }

  async createSubSkill(skillId: string, name: string, description?: string): Promise<SubSkill> {
    const [created] = await db.insert(subSkills).values({
      skillId,
      name,
      description: description || null,
      isActive: true,
    }).returning();
    return created;
  }

  async upsertSubSkill(skillId: string, name: string, description?: string): Promise<SubSkill> {
    // Check if sub-skill already exists for this skill
    const existing = await db.select().from(subSkills)
      .where(and(eq(subSkills.skillId, skillId), eq(subSkills.name, name)))
      .limit(1);
    if (existing.length > 0) {
      return existing[0];
    }
    return this.createSubSkill(skillId, name, description);
  }

  async updateSubSkill(id: string, updates: Partial<SubSkill>): Promise<SubSkill | undefined> {
    const [updated] = await db.update(subSkills)
      .set(updates)
      .where(eq(subSkills.id, id))
      .returning();
    return updated;
  }

  async deleteSubSkill(id: string): Promise<void> {
    await db.update(subSkills).set({ isActive: false }).where(eq(subSkills.id, id));
  }

  async getUserSubSkills(userId: string, skillId: string): Promise<string[]> {
    const [userSkill] = await db.select()
      .from(userSkills)
      .where(and(eq(userSkills.userId, userId), eq(userSkills.skillId, skillId)));
    
    if (!userSkill) return [];
    return (userSkill.subSkillIds as string[]) || [];
  }

  async setUserSubSkills(userId: string, skillId: string, subSkillIds: string[]): Promise<void> {
    await db.update(userSkills)
      .set({ subSkillIds })
      .where(and(eq(userSkills.userId, userId), eq(userSkills.skillId, skillId)));
  }

  async getSubSkillsByIds(ids: string[]): Promise<SubSkill[]> {
    if (ids.length === 0) return [];
    return db.select().from(subSkills).where(inArray(subSkills.id, ids));
  }

  async getUserSkillRecords(userId: string): Promise<UserSkill[]> {
    return db.select().from(userSkills).where(eq(userSkills.userId, userId));
  }

  // ==================== WORKS MANAGER ====================

  async getTeamMembers(managerId: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.managerId, managerId));
  }

  async getTeamJobs(managerId: string): Promise<Job[]> {
    const teamMembers = await this.getTeamMembers(managerId);
    if (teamMembers.length === 0) {
      return [];
    }
    const teamMemberIds = teamMembers.map(m => m.id);
    
    return db.select().from(jobs).where(
      or(
        inArray(jobs.assignedToId, teamMemberIds),
        sql`EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(${jobs.assignedToIds}::jsonb) AS elem
          WHERE elem::text = ANY(ARRAY[${sql.join(teamMemberIds.map(id => sql`${id}`), sql`, `)}]::text[])
        )`
      )
    ).orderBy(desc(jobs.date));
  }

  async updateUserManager(userId: string, managerId: string | null): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ managerId })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async getTeamTimesheets(managerId: string): Promise<TimesheetWithUser[]> {
    const teamMembers = await this.getTeamMembers(managerId);
    if (teamMembers.length === 0) {
      return [];
    }
    const teamMemberIds = teamMembers.map(m => m.id);
    
    const results = await db.select().from(timesheets)
      .where(inArray(timesheets.userId, teamMemberIds))
      .orderBy(desc(timesheets.date));
    
    return Promise.all(results.map(async (timesheet) => {
      const [user] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, timesheet.userId));
      let approvedBy = null;
      if (timesheet.approvedById) {
        const [approver] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, timesheet.approvedById));
        approvedBy = approver || null;
      }
      return { ...timesheet, user, approvedBy };
    }));
  }

  async getTeamExpenses(managerId: string): Promise<ExpenseWithDetails[]> {
    const teamMembers = await this.getTeamMembers(managerId);
    if (teamMembers.length === 0) {
      return [];
    }
    const teamMemberIds = teamMembers.map(m => m.id);
    
    const results = await db.select().from(expenses)
      .where(inArray(expenses.userId, teamMemberIds))
      .orderBy(desc(expenses.date));
    
    return Promise.all(results.map(async (expense) => {
      const [user] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, expense.userId));
      let approvedBy = null;
      if (expense.approvedById) {
        const [approver] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, expense.approvedById));
        approvedBy = approver || null;
      }
      let job = null;
      if (expense.jobId) {
        const [jobRecord] = await db.select({ id: jobs.id, jobNo: jobs.jobNo, customerName: jobs.customerName }).from(jobs).where(eq(jobs.id, expense.jobId));
        job = jobRecord || null;
      }
      return { ...expense, user, approvedBy, job };
    }));
  }

  // ==================== INSPECTIONS ====================

  async getInspections(): Promise<Inspection[]> {
    return db.select().from(inspections).orderBy(desc(inspections.createdAt));
  }

  async getInspection(id: string): Promise<InspectionWithDetails | undefined> {
    const [inspection] = await db.select().from(inspections).where(eq(inspections.id, id));
    if (!inspection) return undefined;

    const [inspector] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, inspection.inspectorId));
    const items = await db.select().from(inspectionItems).where(eq(inspectionItems.inspectionId, id)).orderBy(inspectionItems.category, inspectionItems.orderIndex);

    let job = null;
    if (inspection.jobId) {
      const [jobRecord] = await db.select({ id: jobs.id, jobNo: jobs.jobNo, customerName: jobs.customerName }).from(jobs).where(eq(jobs.id, inspection.jobId));
      job = jobRecord || null;
    }

    let client = null;
    if (inspection.clientId) {
      const [clientRecord] = await db.select({ id: clients.id, name: clients.name }).from(clients).where(eq(clients.id, inspection.clientId));
      client = clientRecord || null;
    }

    return { ...inspection, inspector, items, job, client };
  }

  async createInspection(data: InsertInspection): Promise<Inspection> {
    const [created] = await db.insert(inspections).values(data).returning();
    return created;
  }

  async updateInspection(id: string, data: Partial<Inspection>): Promise<Inspection | undefined> {
    const [updated] = await db.update(inspections)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(inspections.id, id))
      .returning();
    return updated;
  }

  async deleteInspection(id: string): Promise<void> {
    await db.delete(inspectionItems).where(eq(inspectionItems.inspectionId, id));
    await db.delete(inspections).where(eq(inspections.id, id));
  }

  async getInspectionItems(inspectionId: string): Promise<InspectionItem[]> {
    return db.select().from(inspectionItems)
      .where(eq(inspectionItems.inspectionId, inspectionId))
      .orderBy(inspectionItems.category, inspectionItems.orderIndex);
  }

  async createInspectionItem(data: InsertInspectionItem): Promise<InspectionItem> {
    const [created] = await db.insert(inspectionItems).values(data).returning();
    return created;
  }

  async updateInspectionItem(id: string, data: Partial<InspectionItem>): Promise<InspectionItem | undefined> {
    const [updated] = await db.update(inspectionItems)
      .set(data)
      .where(eq(inspectionItems.id, id))
      .returning();
    return updated;
  }

  async deleteInspectionItem(id: string): Promise<void> {
    await db.delete(inspectionItems).where(eq(inspectionItems.id, id));
  }

  async getNextInspectionNo(): Promise<string> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(inspections);
    const count = Number(result[0]?.count || 0) + 1;
    const year = new Date().getFullYear();
    return `INS-${year}-${String(count).padStart(4, '0')}`;
  }

  // ==================== SNAGGING SHEETS ====================

  async getSnaggingSheets(): Promise<SnaggingSheet[]> {
    return db.select().from(snaggingSheets).orderBy(desc(snaggingSheets.createdAt));
  }

  async getSnaggingSheet(id: string): Promise<SnaggingSheetWithDetails | undefined> {
    const [sheet] = await db.select().from(snaggingSheets).where(eq(snaggingSheets.id, id));
    if (!sheet) return undefined;

    const [createdBy] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, sheet.createdById));
    const snags = await db.select().from(snagItems)
      .where(eq(snagItems.snaggingSheetId, id))
      .orderBy(snagItems.location, snagItems.orderIndex);

    let job = null;
    if (sheet.jobId) {
      const [jobRecord] = await db.select({ id: jobs.id, jobNo: jobs.jobNo, customerName: jobs.customerName }).from(jobs).where(eq(jobs.id, sheet.jobId));
      job = jobRecord || null;
    }

    let client = null;
    if (sheet.clientId) {
      const [clientRecord] = await db.select({ id: clients.id, name: clients.name }).from(clients).where(eq(clients.id, sheet.clientId));
      client = clientRecord || null;
    }

    return { ...sheet, createdBy, snags, job, client };
  }

  async createSnaggingSheet(data: InsertSnaggingSheet): Promise<SnaggingSheet> {
    const [created] = await db.insert(snaggingSheets).values(data).returning();
    return created;
  }

  async updateSnaggingSheet(id: string, data: Partial<SnaggingSheet>): Promise<SnaggingSheet | undefined> {
    const [updated] = await db.update(snaggingSheets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(snaggingSheets.id, id))
      .returning();
    return updated;
  }

  async deleteSnaggingSheet(id: string): Promise<void> {
    await db.delete(snagItems).where(eq(snagItems.snaggingSheetId, id));
    await db.delete(snaggingSheets).where(eq(snaggingSheets.id, id));
  }

  async getSnagItems(sheetId: string): Promise<SnagItem[]> {
    return db.select().from(snagItems)
      .where(eq(snagItems.snaggingSheetId, sheetId))
      .orderBy(snagItems.location, snagItems.orderIndex);
  }

  async createSnagItem(data: InsertSnagItem): Promise<SnagItem> {
    const [created] = await db.insert(snagItems).values(data).returning();
    const sheet = await db.select().from(snaggingSheets).where(eq(snaggingSheets.id, data.snaggingSheetId));
    if (sheet[0]) {
      const totalSnags = (sheet[0].totalSnags || 0) + 1;
      await db.update(snaggingSheets).set({ totalSnags, updatedAt: new Date() }).where(eq(snaggingSheets.id, data.snaggingSheetId));
    }
    return created;
  }

  async updateSnagItem(id: string, data: Partial<SnagItem>): Promise<SnagItem | undefined> {
    const [existing] = await db.select().from(snagItems).where(eq(snagItems.id, id));
    const [updated] = await db.update(snagItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(snagItems.id, id))
      .returning();
    
    if (updated && existing) {
      const wasResolved = existing.status === 'resolved' || existing.status === 'verified';
      const isNowResolved = updated.status === 'resolved' || updated.status === 'verified';
      
      if (!wasResolved && isNowResolved) {
        const sheet = await db.select().from(snaggingSheets).where(eq(snaggingSheets.id, updated.snaggingSheetId));
        if (sheet[0]) {
          const resolvedSnags = (sheet[0].resolvedSnags || 0) + 1;
          await db.update(snaggingSheets).set({ resolvedSnags, updatedAt: new Date() }).where(eq(snaggingSheets.id, updated.snaggingSheetId));
        }
      } else if (wasResolved && !isNowResolved) {
        const sheet = await db.select().from(snaggingSheets).where(eq(snaggingSheets.id, updated.snaggingSheetId));
        if (sheet[0]) {
          const resolvedSnags = Math.max(0, (sheet[0].resolvedSnags || 0) - 1);
          await db.update(snaggingSheets).set({ resolvedSnags, updatedAt: new Date() }).where(eq(snaggingSheets.id, updated.snaggingSheetId));
        }
      }
    }
    
    return updated;
  }

  async deleteSnagItem(id: string): Promise<void> {
    const [snag] = await db.select().from(snagItems).where(eq(snagItems.id, id));
    if (snag) {
      await db.delete(snagItems).where(eq(snagItems.id, id));
      const sheet = await db.select().from(snaggingSheets).where(eq(snaggingSheets.id, snag.snaggingSheetId));
      if (sheet[0]) {
        const totalSnags = Math.max(0, (sheet[0].totalSnags || 0) - 1);
        const wasResolved = snag.status === 'resolved' || snag.status === 'verified';
        const resolvedSnags = wasResolved ? Math.max(0, (sheet[0].resolvedSnags || 0) - 1) : sheet[0].resolvedSnags;
        await db.update(snaggingSheets).set({ totalSnags, resolvedSnags, updatedAt: new Date() }).where(eq(snaggingSheets.id, snag.snaggingSheetId));
      }
    }
  }

  async getNextSnaggingSheetNo(): Promise<string> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(snaggingSheets);
    const count = Number(result[0]?.count || 0) + 1;
    const year = new Date().getFullYear();
    return `SNG-${year}-${String(count).padStart(4, '0')}`;
  }

  // ==================== ACCOUNTS PORTAL ====================

  async getAccountsReceipts(): Promise<AccountsReceipt[]> {
    return db.select().from(accountsReceipts).orderBy(desc(accountsReceipts.createdAt));
  }

  async getAccountsReceipt(id: string): Promise<AccountsReceipt | undefined> {
    const [receipt] = await db.select().from(accountsReceipts).where(eq(accountsReceipts.id, id));
    return receipt;
  }

  async createAccountsReceipt(data: InsertAccountsReceipt): Promise<AccountsReceipt> {
    const [created] = await db.insert(accountsReceipts).values(data).returning();
    return created;
  }

  async updateAccountsReceipt(id: string, data: Partial<AccountsReceipt>): Promise<AccountsReceipt | undefined> {
    const [updated] = await db.update(accountsReceipts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(accountsReceipts.id, id))
      .returning();
    return updated;
  }

  async deleteAccountsReceipt(id: string): Promise<void> {
    await db.delete(accountsReceipts).where(eq(accountsReceipts.id, id));
  }

  async getInvoiceChaseLogs(invoiceId: string): Promise<InvoiceChaseLog[]> {
    return db.select().from(invoiceChaseLogs)
      .where(eq(invoiceChaseLogs.invoiceId, invoiceId))
      .orderBy(desc(invoiceChaseLogs.createdAt));
  }

  async createInvoiceChaseLog(data: InsertInvoiceChaseLog): Promise<InvoiceChaseLog> {
    const [created] = await db.insert(invoiceChaseLogs).values(data).returning();
    return created;
  }

  async getFixedCosts(): Promise<FixedCost[]> {
    return db.select().from(fixedCosts).orderBy(asc(fixedCosts.category), asc(fixedCosts.name));
  }

  async getFixedCost(id: string): Promise<FixedCost | undefined> {
    const [cost] = await db.select().from(fixedCosts).where(eq(fixedCosts.id, id));
    return cost;
  }

  async createFixedCost(data: InsertFixedCost): Promise<FixedCost> {
    const [created] = await db.insert(fixedCosts).values(data).returning();
    return created;
  }

  async updateFixedCost(id: string, data: Partial<FixedCost>): Promise<FixedCost | undefined> {
    const [updated] = await db.update(fixedCosts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(fixedCosts.id, id))
      .returning();
    return updated;
  }

  async deleteFixedCost(id: string): Promise<void> {
    await db.delete(fixedCosts).where(eq(fixedCosts.id, id));
  }

  async getInvoicesWithChaseInfo(): Promise<InvoiceWithChaseInfo[]> {
    const allInvoices = await db.select().from(invoices).orderBy(desc(invoices.createdAt));
    const allClients = await db.select().from(clients);
    const allChaseLogs = await db.select().from(invoiceChaseLogs);
    
    const clientMap = new Map(allClients.map(c => [c.id, c]));
    
    return allInvoices.map(inv => {
      const invChaseLogs = allChaseLogs.filter(cl => cl.invoiceId === inv.id);
      const daysOverdue = inv.dueDate && inv.status !== 'Paid' 
        ? Math.max(0, Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)))
        : 0;
      const lastChase = invChaseLogs.sort((a, b) => 
        new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
      )[0];
      
      return {
        ...inv,
        client: inv.customerId ? clientMap.get(inv.customerId) || null : null,
        daysOverdue,
        lastChaseDate: lastChase?.sentAt || null,
        chaseCount: invChaseLogs.length,
      };
    });
  }

  async getOverdueInvoices(daysOverdue: number = 14): Promise<InvoiceWithChaseInfo[]> {
    const allInvoicesWithInfo = await this.getInvoicesWithChaseInfo();
    return allInvoicesWithInfo.filter(inv => 
      inv.status !== 'Paid' && 
      inv.status !== 'Cancelled' && 
      (inv.daysOverdue || 0) >= daysOverdue
    );
  }

  async getFinancialSummary(startDate?: Date, endDate?: Date): Promise<FinancialSummary> {
    const start = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate || new Date();
    const period = `${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}`;

    // Get all invoices
    const allInvoices = await db.select().from(invoices);
    const filteredInvoices = allInvoices.filter(inv => {
      const invDate = inv.invoiceDate ? new Date(inv.invoiceDate) : null;
      return invDate && invDate >= start && invDate <= end;
    });

    const paidInvoices = filteredInvoices.filter(inv => inv.status === 'Paid');
    const pendingInvoices = filteredInvoices.filter(inv => inv.status === 'Sent' || inv.status === 'Draft');
    const overdueInvoices = filteredInvoices.filter(inv => {
      if (inv.status === 'Paid' || inv.status === 'Cancelled') return false;
      if (!inv.dueDate) return false;
      return new Date(inv.dueDate) < new Date();
    });

    const totalRevenue = paidInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

    // Get timesheets for staff costs
    const allTimesheets = await db.select().from(timesheets);
    const filteredTimesheets = allTimesheets.filter(ts => {
      const tsDate = ts.date ? new Date(ts.date) : null;
      return tsDate && tsDate >= start && tsDate <= end;
    });
    const staffCosts = filteredTimesheets.reduce((sum, ts) => {
      const hours = ts.totalHours || 0;
      const rate = 15; // Default hourly rate
      return sum + (hours * rate);
    }, 0);

    // Get expenses including vehicle costs
    const allExpenses = await db.select().from(expenses);
    const filteredExpenses = allExpenses.filter(exp => {
      const expDate = exp.date ? new Date(exp.date) : null;
      return expDate && expDate >= start && expDate <= end && exp.status === 'approved';
    });
    
    const vehicleCosts = filteredExpenses
      .filter(exp => exp.mileage || exp.category === 'fuel' || exp.category === 'vehicle')
      .reduce((sum, exp) => sum + (exp.amount || 0), 0);

    const materialsCosts = filteredExpenses
      .filter(exp => exp.category === 'materials' || exp.category === 'parts')
      .reduce((sum, exp) => sum + (exp.amount || 0), 0);

    // Get fixed costs
    const allFixedCosts = await db.select().from(fixedCosts).where(eq(fixedCosts.isActive, true));
    const monthlyFixedCosts = allFixedCosts.reduce((sum, fc) => {
      if (fc.frequency === 'monthly') return sum + (fc.amount || 0);
      if (fc.frequency === 'weekly') return sum + ((fc.amount || 0) * 4.33);
      if (fc.frequency === 'yearly') return sum + ((fc.amount || 0) / 12);
      return sum + (fc.amount || 0);
    }, 0);

    const totalCosts = staffCosts + vehicleCosts + materialsCosts + monthlyFixedCosts;

    return {
      totalRevenue,
      paidInvoices: paidInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0),
      pendingInvoices: pendingInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0),
      overdueInvoices: overdueInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0),
      totalCosts,
      staffCosts,
      vehicleCosts,
      materialsCosts,
      fixedCosts: monthlyFixedCosts,
      netProfit: totalRevenue - totalCosts,
      period,
    };
  }

  async getSnippets(userId: string): Promise<Snippet[]> {
    return db.select().from(snippets)
      .where(or(eq(snippets.createdById, userId), eq(snippets.isGlobal, true)))
      .orderBy(snippets.category, snippets.title);
  }

  async createSnippet(data: InsertSnippet): Promise<Snippet> {
    const [snippet] = await db.insert(snippets).values(data).returning();
    return snippet;
  }

  async updateSnippet(id: string, data: Partial<Snippet>): Promise<Snippet | undefined> {
    const [snippet] = await db.update(snippets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(snippets.id, id))
      .returning();
    return snippet;
  }

  async deleteSnippet(id: string): Promise<void> {
    await db.delete(snippets).where(eq(snippets.id, id));
  }

  async getFile(id: string): Promise<FileRecord | undefined> {
    const [file] = await db.select().from(files).where(eq(files.id, id));
    return file;
  }

  async getAllFiles(): Promise<FileWithRelations[]> {
    const allFiles = await db.select().from(files).orderBy(desc(files.createdAt));
    
    const result: FileWithRelations[] = [];
    for (const file of allFiles) {
      const fileWithRelations: FileWithRelations = { ...file };
      
      if (file.clientId) {
        const [client] = await db.select({ id: clients.id, name: clients.name })
          .from(clients).where(eq(clients.id, file.clientId));
        fileWithRelations.client = client || null;
      }
      if (file.jobId) {
        const [job] = await db.select({ id: jobs.id, jobNo: jobs.jobNo, customerName: jobs.customerName })
          .from(jobs).where(eq(jobs.id, file.jobId));
        fileWithRelations.job = job || null;
      }
      if (file.expenseId) {
        const [expense] = await db.select({ id: expenses.id, description: expenses.description, category: expenses.category })
          .from(expenses).where(eq(expenses.id, file.expenseId));
        fileWithRelations.expense = expense || null;
      }
      if (file.uploadedById) {
        const [uploader] = await db.select({ id: users.id, name: users.name })
          .from(users).where(eq(users.id, file.uploadedById));
        fileWithRelations.uploadedBy = uploader || null;
      }
      
      result.push(fileWithRelations);
    }
    
    return result;
  }

  async getFilesByClient(clientId: string): Promise<FileWithRelations[]> {
    const clientFiles = await db.select().from(files)
      .where(eq(files.clientId, clientId))
      .orderBy(desc(files.createdAt));
    
    const result: FileWithRelations[] = [];
    for (const file of clientFiles) {
      const fileWithRelations: FileWithRelations = { ...file };
      
      if (file.uploadedById) {
        const [uploader] = await db.select({ id: users.id, name: users.name })
          .from(users).where(eq(users.id, file.uploadedById));
        fileWithRelations.uploadedBy = uploader || null;
      }
      
      result.push(fileWithRelations);
    }
    
    return result;
  }

  async getFilesByJob(jobId: string): Promise<FileWithRelations[]> {
    const jobFiles = await db.select().from(files)
      .where(eq(files.jobId, jobId))
      .orderBy(desc(files.createdAt));
    
    const result: FileWithRelations[] = [];
    for (const file of jobFiles) {
      const fileWithRelations: FileWithRelations = { ...file };
      
      if (file.uploadedById) {
        const [uploader] = await db.select({ id: users.id, name: users.name })
          .from(users).where(eq(users.id, file.uploadedById));
        fileWithRelations.uploadedBy = uploader || null;
      }
      
      result.push(fileWithRelations);
    }
    
    return result;
  }

  async getFilesByExpense(expenseId: string): Promise<FileWithRelations[]> {
    const expenseFiles = await db.select().from(files)
      .where(eq(files.expenseId, expenseId))
      .orderBy(desc(files.createdAt));
    
    const result: FileWithRelations[] = [];
    for (const file of expenseFiles) {
      const fileWithRelations: FileWithRelations = { ...file };
      
      if (file.uploadedById) {
        const [uploader] = await db.select({ id: users.id, name: users.name })
          .from(users).where(eq(users.id, file.uploadedById));
        fileWithRelations.uploadedBy = uploader || null;
      }
      
      result.push(fileWithRelations);
    }
    
    return result;
  }

  async createFile(data: InsertFile): Promise<FileRecord> {
    const [file] = await db.insert(files).values(data).returning();
    return file;
  }

  async updateFile(id: string, data: Partial<FileRecord>): Promise<FileRecord | undefined> {
    const [file] = await db.update(files)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(files.id, id))
      .returning();
    return file;
  }

  async deleteFile(id: string): Promise<void> {
    await db.delete(files).where(eq(files.id, id));
  }

  // AI Conversations
  async getAiConversation(id: string): Promise<AiConversation | undefined> {
    const [conversation] = await db.select().from(aiConversations).where(eq(aiConversations.id, id));
    return conversation;
  }

  async getAiConversationsByUser(userId: string): Promise<AiConversation[]> {
    return db.select().from(aiConversations)
      .where(and(eq(aiConversations.userId, userId), eq(aiConversations.isArchived, false)))
      .orderBy(desc(aiConversations.lastMessageAt));
  }

  async createAiConversation(data: InsertAiConversation): Promise<AiConversation> {
    const [conversation] = await db.insert(aiConversations).values(data).returning();
    return conversation;
  }

  async updateAiConversation(id: string, data: Partial<AiConversation>): Promise<AiConversation | undefined> {
    const [conversation] = await db.update(aiConversations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(aiConversations.id, id))
      .returning();
    return conversation;
  }

  async deleteAiConversation(id: string): Promise<void> {
    await db.delete(aiConversations).where(eq(aiConversations.id, id));
  }

  async addMessageToConversation(conversationId: string, message: AiMessage): Promise<AiConversation | undefined> {
    const conversation = await this.getAiConversation(conversationId);
    if (!conversation) return undefined;
    
    const currentMessages = (conversation.messages as AiMessage[]) || [];
    const updatedMessages = [...currentMessages, message];
    
    // Generate title from first user message if still default
    let title = conversation.title;
    if (title === 'New Conversation' && message.role === 'user') {
      title = message.content.substring(0, 50) + (message.content.length > 50 ? '...' : '');
    }
    
    const [updated] = await db.update(aiConversations)
      .set({ 
        messages: updatedMessages,
        title,
        lastMessageAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(aiConversations.id, conversationId))
      .returning();
    return updated;
  }

  // AI Business Patterns
  async getAiBusinessPatterns(): Promise<AiBusinessPattern[]> {
    return db.select().from(aiBusinessPatterns).orderBy(desc(aiBusinessPatterns.frequency));
  }

  async getAiBusinessPatternsByType(patternType: string): Promise<AiBusinessPattern[]> {
    return db.select().from(aiBusinessPatterns)
      .where(eq(aiBusinessPatterns.patternType, patternType))
      .orderBy(desc(aiBusinessPatterns.frequency));
  }

  async createAiBusinessPattern(data: InsertAiBusinessPattern): Promise<AiBusinessPattern> {
    const [pattern] = await db.insert(aiBusinessPatterns).values(data).returning();
    return pattern;
  }

  async updateAiBusinessPattern(id: string, data: Partial<AiBusinessPattern>): Promise<AiBusinessPattern | undefined> {
    const [pattern] = await db.update(aiBusinessPatterns)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(aiBusinessPatterns.id, id))
      .returning();
    return pattern;
  }

  async incrementPatternFrequency(id: string): Promise<AiBusinessPattern | undefined> {
    const [pattern] = await db.update(aiBusinessPatterns)
      .set({ 
        frequency: sql`${aiBusinessPatterns.frequency} + 1`,
        lastOccurrence: new Date(),
        updatedAt: new Date()
      })
      .where(eq(aiBusinessPatterns.id, id))
      .returning();
    return pattern;
  }

  async learnFromJob(job: Job): Promise<void> {
    // Learn from job completion - track materials used, duration, skills needed
    if (job.status === 'Completed' && job.materials) {
      const materials = job.materials as { description?: string; quantity?: number }[];
      for (const material of materials) {
        if (material.description) {
          // Find or create material pattern
          const existing = await db.select().from(aiBusinessPatterns)
            .where(and(
              eq(aiBusinessPatterns.patternType, 'materials'),
              sql`${aiBusinessPatterns.data}->>'materialName' = ${material.description}`
            ));
          
          if (existing.length > 0) {
            await this.incrementPatternFrequency(existing[0].id);
          } else {
            await this.createAiBusinessPattern({
              patternType: 'materials',
              category: null,
              data: {
                materialName: material.description,
                jobTypes: [],
                avgQuantity: material.quantity || 1
              }
            });
          }
        }
      }
    }
    
    // Learn engineer assignments
    if (job.assignedToId) {
      const existing = await db.select().from(aiBusinessPatterns)
        .where(and(
          eq(aiBusinessPatterns.patternType, 'engineer_assignment'),
          sql`${aiBusinessPatterns.data}->>'engineerId' = ${job.assignedToId}`
        ));
      
      if (existing.length > 0) {
        await this.incrementPatternFrequency(existing[0].id);
      } else {
        const engineer = await this.getUser(job.assignedToId);
        if (engineer) {
          await this.createAiBusinessPattern({
            patternType: 'engineer_assignment',
            category: null,
            data: {
              engineerId: engineer.id,
              engineerName: engineer.name,
              jobTypes: [],
              successRate: 100,
              avgJobsPerWeek: 1
            }
          });
        }
      }
    }
  }

  async learnFromQuote(quote: Quote): Promise<void> {
    // Learn pricing patterns from accepted quotes
    if (quote.status === 'accepted' && quote.total) {
      const existing = await db.select().from(aiBusinessPatterns)
        .where(eq(aiBusinessPatterns.patternType, 'pricing'));
      
      // Simple averaging - in production you'd want more sophisticated analysis
      if (existing.length === 0) {
        await this.createAiBusinessPattern({
          patternType: 'pricing',
          category: 'general',
          data: {
            jobType: 'general',
            avgPrice: Number(quote.total),
            minPrice: Number(quote.total),
            maxPrice: Number(quote.total),
            sampleSize: 1
          }
        });
      } else {
        const pattern = existing[0];
        const data = pattern.data as { avgPrice: number; minPrice: number; maxPrice: number; sampleSize: number };
        const newSampleSize = data.sampleSize + 1;
        const newAvg = (data.avgPrice * data.sampleSize + Number(quote.total)) / newSampleSize;
        
        await this.updateAiBusinessPattern(pattern.id, {
          data: {
            ...data,
            avgPrice: newAvg,
            minPrice: Math.min(data.minPrice, Number(quote.total)),
            maxPrice: Math.max(data.maxPrice, Number(quote.total)),
            sampleSize: newSampleSize
          }
        });
      }
    }
  }

  // AI User Preferences
  async getAiUserPreference(userId: string): Promise<AiUserPreference | undefined> {
    const [pref] = await db.select().from(aiUserPreferences).where(eq(aiUserPreferences.userId, userId));
    return pref;
  }

  async upsertAiUserPreference(userId: string, data: Partial<AiUserPreference>): Promise<AiUserPreference> {
    const existing = await this.getAiUserPreference(userId);
    
    if (existing) {
      const [updated] = await db.update(aiUserPreferences)
        .set({ ...data, lastLearnedAt: new Date(), updatedAt: new Date() })
        .where(eq(aiUserPreferences.userId, userId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(aiUserPreferences)
        .values({ userId, ...data })
        .returning();
      return created;
    }
  }

  async trackUserAction(userId: string, action: string): Promise<void> {
    const pref = await this.getAiUserPreference(userId);
    const actions = (pref?.preferredActions as { action: string; count: number; lastUsed: string }[]) || [];
    
    const existingIndex = actions.findIndex(a => a.action === action);
    if (existingIndex >= 0) {
      actions[existingIndex].count += 1;
      actions[existingIndex].lastUsed = new Date().toISOString();
    } else {
      actions.push({ action, count: 1, lastUsed: new Date().toISOString() });
    }
    
    // Sort by count and keep top 20
    actions.sort((a, b) => b.count - a.count);
    const topActions = actions.slice(0, 20);
    
    await this.upsertAiUserPreference(userId, { preferredActions: topActions });
  }

  // Form Templates
  async getFormTemplates(): Promise<FormTemplate[]> {
    return db.select().from(formTemplates).orderBy(desc(formTemplates.createdAt));
  }

  async getFormTemplate(id: string): Promise<FormTemplate | undefined> {
    const [template] = await db.select().from(formTemplates).where(eq(formTemplates.id, id));
    return template;
  }

  async createFormTemplate(data: InsertFormTemplate): Promise<FormTemplate> {
    const [template] = await db.insert(formTemplates).values(data).returning();
    return template;
  }

  async updateFormTemplate(id: string, data: Partial<FormTemplate>): Promise<FormTemplate | undefined> {
    const [template] = await db.update(formTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(formTemplates.id, id))
      .returning();
    return template;
  }

  async deleteFormTemplate(id: string): Promise<void> {
    await db.delete(formTemplates).where(eq(formTemplates.id, id));
  }

  // Form Template Versions
  async getFormTemplateVersions(templateId: string): Promise<FormTemplateVersion[]> {
    return db.select().from(formTemplateVersions)
      .where(eq(formTemplateVersions.templateId, templateId))
      .orderBy(desc(formTemplateVersions.version));
  }

  async getFormTemplateVersion(id: string): Promise<FormTemplateVersion | undefined> {
    const [version] = await db.select().from(formTemplateVersions)
      .where(eq(formTemplateVersions.id, id));
    return version;
  }

  async getLatestPublishedVersion(templateId: string): Promise<FormTemplateVersion | undefined> {
    const versions = await db.select().from(formTemplateVersions)
      .where(and(
        eq(formTemplateVersions.templateId, templateId),
        sql`${formTemplateVersions.publishedAt} IS NOT NULL`
      ))
      .orderBy(desc(formTemplateVersions.version))
      .limit(1);
    return versions[0];
  }

  async createFormTemplateVersion(data: InsertFormTemplateVersion): Promise<FormTemplateVersion> {
    const [version] = await db.insert(formTemplateVersions).values(data).returning();
    return version;
  }

  async publishFormTemplateVersion(id: string): Promise<FormTemplateVersion | undefined> {
    const [version] = await db.update(formTemplateVersions)
      .set({ publishedAt: new Date() })
      .where(eq(formTemplateVersions.id, id))
      .returning();
    return version;
  }

  // Form Submissions
  async getFormSubmissions(filters?: { entityType?: string; entityId?: string; templateVersionId?: string }): Promise<FormSubmission[]> {
    let query = db.select().from(formSubmissions);
    
    if (filters?.entityType) {
      query = query.where(eq(formSubmissions.entityType, filters.entityType)) as typeof query;
    }
    if (filters?.entityId) {
      query = query.where(eq(formSubmissions.entityId, filters.entityId)) as typeof query;
    }
    if (filters?.templateVersionId) {
      query = query.where(eq(formSubmissions.templateVersionId, filters.templateVersionId)) as typeof query;
    }
    
    return query.orderBy(desc(formSubmissions.createdAt));
  }

  async getFormSubmission(id: string): Promise<FormSubmission | undefined> {
    const [submission] = await db.select().from(formSubmissions)
      .where(eq(formSubmissions.id, id));
    return submission;
  }

  async createFormSubmission(data: InsertFormSubmission): Promise<FormSubmission> {
    const [submission] = await db.insert(formSubmissions).values(data).returning();
    return submission;
  }

  async updateFormSubmission(id: string, data: Partial<FormSubmission>): Promise<FormSubmission | undefined> {
    const [submission] = await db.update(formSubmissions)
      .set(data)
      .where(eq(formSubmissions.id, id))
      .returning();
    return submission;
  }

  async submitFormSubmission(id: string): Promise<FormSubmission | undefined> {
    const [submission] = await db.update(formSubmissions)
      .set({ status: 'submitted', submittedAt: new Date() })
      .where(eq(formSubmissions.id, id))
      .returning();
    return submission;
  }

  // Form Assets
  async getFormAssets(submissionId: string): Promise<FormAsset[]> {
    return db.select().from(formAssets)
      .where(eq(formAssets.submissionId, submissionId))
      .orderBy(formAssets.createdAt);
  }

  async createFormAsset(data: InsertFormAsset): Promise<FormAsset> {
    const [asset] = await db.insert(formAssets).values(data).returning();
    return asset;
  }

  async deleteFormAsset(id: string): Promise<void> {
    await db.delete(formAssets).where(eq(formAssets.id, id));
  }
}

export const storage = new DatabaseStorage();
