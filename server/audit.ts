import { db } from "./db";
import { auditLogs, userSessions, failedActionsLog, auditLogAccess, InsertAuditLog, InsertUserSession, InsertFailedAction, InsertAuditLogAccess } from "@shared/schema";
import { desc, eq, and, gte, lte, ilike, or, sql } from "drizzle-orm";
import crypto from "crypto";

interface AuditEventParams {
  userId: string;
  userName: string;
  userEmail?: string;
  userRole: string;
  actionType: string;
  actionCategory?: string;
  entityType: string;
  entityId?: string;
  changesBefore?: any;
  changesAfter?: any;
  description?: string;
  metadata?: any;
  severity?: "info" | "warning" | "critical";
  isSensitive?: boolean;
  requiresReview?: boolean;
  pageRoute?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

interface AuditLogFilters {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  actionType?: string;
  actionCategory?: string;
  entityType?: string;
  severity?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

let lastLogId: string | null = null;

function generateChecksum(previousLogId: string | null, timestamp: Date, userId: string, actionType: string, changes: any): string {
  const data = `${previousLogId || ""}|${timestamp.toISOString()}|${userId}|${actionType}|${JSON.stringify(changes || {})}`;
  return crypto.createHash("sha256").update(data).digest("hex");
}

export async function logAuditEvent(params: AuditEventParams): Promise<string | null> {
  try {
    const timestamp = new Date();
    
    const changesJson = params.changesBefore || params.changesAfter ? {
      before: params.changesBefore || null,
      after: params.changesAfter || null,
      changed_fields: params.changesBefore && params.changesAfter 
        ? Object.keys(params.changesAfter).filter(key => 
            JSON.stringify(params.changesBefore[key]) !== JSON.stringify(params.changesAfter[key])
          )
        : null
    } : null;
    
    const checksum = generateChecksum(lastLogId, timestamp, params.userId, params.actionType, changesJson);
    
    const logEntry: InsertAuditLog = {
      userId: params.userId,
      userName: params.userName,
      userEmail: params.userEmail,
      userRole: params.userRole,
      actionType: params.actionType,
      actionCategory: params.actionCategory,
      entityType: params.entityType,
      entityId: params.entityId,
      actionDescription: params.description,
      changesJson,
      metadataJson: params.metadata || null,
      severity: params.severity || "info",
      isSensitive: params.isSensitive || false,
      requiresReview: params.requiresReview || false,
      pageRoute: params.pageRoute,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      sessionId: params.sessionId,
      previousLogId: lastLogId,
      checksum,
    };
    
    const [result] = await db.insert(auditLogs).values(logEntry).returning({ id: auditLogs.id });
    lastLogId = result.id;
    
    return result.id;
  } catch (error) {
    console.error("[Audit] Failed to log audit event:", error);
    return null;
  }
}

export async function logFailedAction(params: {
  userId?: string;
  attemptedEmail?: string;
  actionAttempted: string;
  failureReason?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    await db.insert(failedActionsLog).values({
      userId: params.userId,
      attemptedEmail: params.attemptedEmail,
      actionAttempted: params.actionAttempted,
      failureReason: params.failureReason,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  } catch (error) {
    console.error("[Audit] Failed to log failed action:", error);
  }
}

export async function createUserSession(params: {
  sessionId: string;
  userId: string;
  ipAddress?: string;
  deviceInfo?: string;
}): Promise<void> {
  try {
    await db.insert(userSessions).values({
      sessionId: params.sessionId,
      userId: params.userId,
      loginTimestamp: new Date(),
      lastActivity: new Date(),
      ipAddress: params.ipAddress,
      deviceInfo: params.deviceInfo,
      isActive: true,
    });
  } catch (error) {
    console.error("[Audit] Failed to create user session:", error);
  }
}

export async function updateSessionActivity(sessionId: string): Promise<void> {
  try {
    await db.update(userSessions)
      .set({ lastActivity: new Date() })
      .where(eq(userSessions.sessionId, sessionId));
  } catch (error) {
    console.error("[Audit] Failed to update session activity:", error);
  }
}

export async function endUserSession(sessionId: string): Promise<void> {
  try {
    await db.update(userSessions)
      .set({ 
        logoutTimestamp: new Date(),
        isActive: false
      })
      .where(eq(userSessions.sessionId, sessionId));
  } catch (error) {
    console.error("[Audit] Failed to end user session:", error);
  }
}

export async function logAuditLogAccess(params: {
  accessedByUserId: string;
  accessedByUserName?: string;
  accessType: string;
  filtersApplied?: any;
  recordsAccessed?: number;
  exportFormat?: string;
}): Promise<void> {
  try {
    await db.insert(auditLogAccess).values({
      accessedByUserId: params.accessedByUserId,
      accessedByUserName: params.accessedByUserName,
      accessType: params.accessType,
      filtersApplied: params.filtersApplied || null,
      recordsAccessed: params.recordsAccessed,
      exportFormat: params.exportFormat,
    });
  } catch (error) {
    console.error("[Audit] Failed to log audit log access:", error);
  }
}

export async function getAuditLogs(filters: AuditLogFilters): Promise<{ logs: any[]; total: number }> {
  try {
    const conditions = [];
    
    if (filters.startDate) {
      conditions.push(gte(auditLogs.timestamp, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(lte(auditLogs.timestamp, filters.endDate));
    }
    if (filters.userId) {
      conditions.push(eq(auditLogs.userId, filters.userId));
    }
    if (filters.actionType) {
      conditions.push(eq(auditLogs.actionType, filters.actionType));
    }
    if (filters.actionCategory) {
      conditions.push(eq(auditLogs.actionCategory, filters.actionCategory));
    }
    if (filters.entityType) {
      conditions.push(eq(auditLogs.entityType, filters.entityType));
    }
    if (filters.severity) {
      conditions.push(eq(auditLogs.severity, filters.severity));
    }
    if (filters.search) {
      conditions.push(
        or(
          ilike(auditLogs.userName, `%${filters.search}%`),
          ilike(auditLogs.actionDescription, `%${filters.search}%`),
          ilike(auditLogs.entityId, `%${filters.search}%`),
          ilike(auditLogs.entityType, `%${filters.search}%`)
        )
      );
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(whereClause);
    
    const logs = await db.select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.timestamp))
      .limit(filters.limit || 50)
      .offset(filters.offset || 0);
    
    return {
      logs,
      total: Number(countResult?.count || 0)
    };
  } catch (error) {
    console.error("[Audit] Failed to get audit logs:", error);
    return { logs: [], total: 0 };
  }
}

export async function getAuditLogById(id: string): Promise<any | null> {
  try {
    const [log] = await db.select().from(auditLogs).where(eq(auditLogs.id, id));
    return log || null;
  } catch (error) {
    console.error("[Audit] Failed to get audit log by id:", error);
    return null;
  }
}

export async function getFailedActions(filters: { limit?: number; offset?: number }): Promise<any[]> {
  try {
    return await db.select()
      .from(failedActionsLog)
      .orderBy(desc(failedActionsLog.timestamp))
      .limit(filters.limit || 50)
      .offset(filters.offset || 0);
  } catch (error) {
    console.error("[Audit] Failed to get failed actions:", error);
    return [];
  }
}

export async function getActiveSessions(): Promise<any[]> {
  try {
    return await db.select()
      .from(userSessions)
      .where(eq(userSessions.isActive, true))
      .orderBy(desc(userSessions.lastActivity));
  } catch (error) {
    console.error("[Audit] Failed to get active sessions:", error);
    return [];
  }
}

export async function getAuditStats(): Promise<{
  totalLogs: number;
  todayLogs: number;
  criticalLogs: number;
  warningLogs: number;
  failedLogins: number;
  activeSessions: number;
}> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(auditLogs);
    const [todayResult] = await db.select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(gte(auditLogs.timestamp, today));
    const [criticalResult] = await db.select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(eq(auditLogs.severity, "critical"));
    const [warningResult] = await db.select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(eq(auditLogs.severity, "warning"));
    const [failedResult] = await db.select({ count: sql<number>`count(*)` })
      .from(failedActionsLog);
    const [sessionsResult] = await db.select({ count: sql<number>`count(*)` })
      .from(userSessions)
      .where(eq(userSessions.isActive, true));
    
    return {
      totalLogs: Number(totalResult?.count || 0),
      todayLogs: Number(todayResult?.count || 0),
      criticalLogs: Number(criticalResult?.count || 0),
      warningLogs: Number(warningResult?.count || 0),
      failedLogins: Number(failedResult?.count || 0),
      activeSessions: Number(sessionsResult?.count || 0),
    };
  } catch (error) {
    console.error("[Audit] Failed to get audit stats:", error);
    return {
      totalLogs: 0,
      todayLogs: 0,
      criticalLogs: 0,
      warningLogs: 0,
      failedLogins: 0,
      activeSessions: 0,
    };
  }
}

export function getClientIp(req: any): string {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() 
    || req.headers["x-real-ip"] 
    || req.socket?.remoteAddress 
    || "unknown";
}

export function getUserAgent(req: any): string {
  return req.headers["user-agent"] || "unknown";
}
