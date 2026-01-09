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
  users, jobs, engineerLocations, aiAdvisors, timeLogs, quotes, invoices, companySettings, clients, jobUpdates,
  conversations, conversationMembers, messages,
  vehicles, walkaroundChecks, checkItems, defects, defectUpdates,
  timesheets, expenses, payments
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, or, sql, isNull, and, ne, inArray, gt, asc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  deleteUser(id: string): Promise<void>;
  updateUser(id: string, updates: Partial<{ name: string; email: string | null; phone: string | null; username: string; password: string; role: string; superAdmin: boolean; twoFactorSecret: string | null; twoFactorEnabled: boolean; gdprConsentDate: Date | null; gdprConsentVersion: string | null; deletionRequestedAt: Date | null; status: string }>): Promise<User | undefined>;
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
  getAllClients(): Promise<Client[]>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, updates: Partial<Client>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<void>;
  findOrCreateClient(data: { name: string; email?: string | null; phone?: string | null; address?: string | null; postcode?: string | null; contactName?: string | null }): Promise<Client>;
  
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
  getPaymentsByInvoice(invoiceId: string): Promise<Payment[]>;
  getAllPayments(): Promise<PaymentWithInvoice[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, updates: Partial<Payment>): Promise<Payment | undefined>;
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

  async updateUser(id: string, updates: Partial<{ name: string; email: string | null; phone: string | null; username: string; password: string; role: string; superAdmin: boolean; twoFactorSecret: string | null; twoFactorEnabled: boolean; gdprConsentDate: Date | null; gdprConsentVersion: string | null; deletionRequestedAt: Date | null; status: string }>): Promise<User | undefined> {
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
      and(
        or(
          eq(jobs.assignedToId, engineerId),
          sql`${jobs.assignedToIds}::jsonb @> ${JSON.stringify([engineerId])}::jsonb`
        ),
        ne(jobs.status, "Draft")
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
}

export const storage = new DatabaseStorage();
