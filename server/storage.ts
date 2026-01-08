import { 
  type User, type InsertUser, 
  type Job, type InsertJob,
  type EngineerLocation, type InsertEngineerLocation,
  type AiAdvisor, type InsertAiAdvisor,
  type TimeLog, type InsertTimeLog,
  type Quote, type InsertQuote,
  type Invoice, type InsertInvoice,
  type CompanySettings, type InsertCompanySettings,
  users, jobs, engineerLocations, aiAdvisors, timeLogs, quotes, invoices, companySettings
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, or, sql, isNull, and } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  deleteUser(id: string): Promise<void>;
  updateUser(id: string, updates: Partial<{ name: string; email: string | null; phone: string | null; username: string; password: string; role: string; superAdmin: boolean }>): Promise<User | undefined>;
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

  async updateUser(id: string, updates: Partial<{ name: string; email: string | null; phone: string | null; username: string; password: string; role: string; superAdmin: boolean }>): Promise<User | undefined> {
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
}

export const storage = new DatabaseStorage();
