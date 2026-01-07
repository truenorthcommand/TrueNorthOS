import { 
  type User, type InsertUser, 
  type Job, type InsertJob,
  type EngineerLocation, type InsertEngineerLocation,
  type AiAdvisor, type InsertAiAdvisor,
  users, jobs, engineerLocations, aiAdvisors
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, or, sql } from "drizzle-orm";

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
}

export const storage = new DatabaseStorage();
