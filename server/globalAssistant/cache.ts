import { db } from "../db";
import { aiCache } from "@shared/schema";
import { eq, sql, like } from "drizzle-orm";

export const CACHE_TTL = {
  BUSINESS_SUMMARY: 24 * 60 * 60, // 24 hours
  SMART_INSIGHTS: 6 * 60 * 60, // 6 hours
  SUGGESTIONS: 30 * 60, // 30 minutes
};

export function getCacheKey(type: 'insights' | 'suggestions' | 'summary', orgId: string): string {
  return `ai:${type}:${orgId}`;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const [cached] = await db.select().from(aiCache).where(eq(aiCache.key, key));
    if (!cached) {
      console.log(`[AI Cache] MISS: ${key}`);
      return null;
    }
    
    const now = new Date();
    if (cached.expiresAt < now) {
      console.log(`[AI Cache] EXPIRED: ${key}`);
      await db.delete(aiCache).where(eq(aiCache.key, key));
      return null;
    }
    
    console.log(`[AI Cache] HIT: ${key}`);
    return cached.value as T;
  } catch (error) {
    console.error("[AI Cache] Error getting cache:", error);
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number, orgId?: string): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    
    await db.insert(aiCache)
      .values({
        key,
        value: value as any,
        orgId: orgId || null,
        expiresAt,
        version: 1,
      })
      .onConflictDoUpdate({
        target: aiCache.key,
        set: {
          value: value as any,
          orgId: orgId || null,
          expiresAt,
          updatedAt: new Date(),
          version: sql`${aiCache.version} + 1`,
        },
      });
    
    console.log(`[AI Cache] SET: ${key} (expires in ${ttlSeconds}s)`);
  } catch (error) {
    console.error("[AI Cache] Error setting cache:", error);
  }
}

export async function cacheDelPrefix(prefix: string): Promise<void> {
  try {
    await db.delete(aiCache).where(like(aiCache.key, `${prefix}%`));
    console.log(`[AI Cache] DELETED prefix: ${prefix}`);
  } catch (error) {
    console.error("[AI Cache] Error deleting cache by prefix:", error);
  }
}

export async function cleanExpiredCache(): Promise<void> {
  try {
    const now = new Date();
    const result = await db.delete(aiCache).where(sql`${aiCache.expiresAt} < ${now}`);
    console.log("[AI Cache] Cleaned expired entries");
  } catch (error) {
    console.error("[AI Cache] Error cleaning expired cache:", error);
  }
}
