import { Router, Request, Response } from "express";
import {
  queryIntelligence,
  ingestClientData,
  ingestAllClients,
  getKnowledgeBaseStats,
  getUserConversations,
  getConversationHistory,
  redactClientData,
} from "./services/property-intelligence";

const router = Router();

// ============================================================
// MIDDLEWARE: Admin-only access
// ============================================================
function requireAdmin(req: Request, res: Response, next: any) {
  const user = (req as any).user;
  console.log('[Intelligence] Auth check - user:', user ? `${user.name} (${user.role}, superAdmin: ${user.superAdmin})` : 'NO USER');
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (!user.superAdmin && user.role !== 'admin') {
    return res.status(403).json({ error: "Admin access required for Property Intelligence" });
  }
  next();
}

// ============================================================
// QUERY ENDPOINT
// ============================================================

// POST /api/intelligence/query
router.post("/query", requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { query, clientId, propertyId, scope, conversationId } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: "Query is required" });
    }

    const result = await queryIntelligence(query, {
      clientId,
      propertyId,
      scope: scope || 'client',
      userId: user.id,
      conversationId,
      ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
      sessionId: (req as any).sessionID,
    });

    res.json(result);
  } catch (error: any) {
    console.error('[Intelligence Route] Query error:', error.message);
    // Handle missing table gracefully
    if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
      return res.json({
        response: "The Property Intelligence database is being set up. Please wait a moment and try again. If this persists, the database tables may need to be synced.",
        responseType: 'factual',
        confidenceScore: 0,
        retrievedChunkIds: [],
        tokensUsed: 0,
        responseTimeMs: 0,
        conversationId: conversationId || 'setup-pending',
      });
    }
    res.json({
      response: `I encountered an issue processing your query: ${error.message}. This may be because the knowledge base hasn't been set up yet. Try clicking 'Sync All' first, or ensure the system has client data to query.`,
      responseType: 'factual',
      confidenceScore: 0,
      retrievedChunkIds: [],
      tokensUsed: 0,
      responseTimeMs: 0,
      conversationId: conversationId || 'error',
    });
  }
});

// ============================================================
// INGESTION ENDPOINTS
// ============================================================

// POST /api/intelligence/ingest/:clientId
router.post("/ingest/:clientId", requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { clientId } = req.params;

    const chunksCreated = await ingestClientData(clientId, user.id);

    res.json({
      success: true,
      message: `Ingested ${chunksCreated} knowledge chunks for client`,
      chunksCreated,
    });
  } catch (error: any) {
    console.error('[Intelligence Route] Ingest error:', error.message);
    res.status(500).json({ error: "Failed to ingest client data" });
  }
});

// POST /api/intelligence/ingest-all
router.post("/ingest-all", requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const result = await ingestAllClients(user.id);

    res.json({
      success: true,
      message: `Ingested ${result.total} chunks across ${result.clients} clients`,
      ...result,
    });
  } catch (error: any) {
    console.error('[Intelligence Route] Ingest-all error:', error.message);
    res.status(500).json({ error: "Failed to ingest all clients" });
  }
});

// ============================================================
// KNOWLEDGE BASE STATS
// ============================================================

// GET /api/intelligence/stats
router.get("/stats", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { clientId } = req.query;
    const stats = await getKnowledgeBaseStats(clientId as string | undefined);
    res.json(stats);
  } catch (error: any) {
    console.error('[Intelligence Route] Stats error:', error.message);
    // Return empty stats if tables don't exist yet
    res.json({
      totalChunks: 0,
      bySourceType: [],
      embeddedChunks: 0,
      percentEmbedded: 0,
      status: 'setup_pending',
      message: 'Knowledge base tables are being set up. Please try syncing data.',
    });
  }
});

// ============================================================
// CONVERSATION HISTORY
// ============================================================

// GET /api/intelligence/conversations
router.get("/conversations", requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { limit } = req.query;
    const conversations = await getUserConversations(user.id, Number(limit) || 20);
    res.json(conversations);
  } catch (error: any) {
    console.error('[Intelligence Route] Conversations error:', error.message);
    res.status(500).json({ error: "Failed to get conversations" });
  }
});

// GET /api/intelligence/conversations/:conversationId
router.get("/conversations/:conversationId", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const history = await getConversationHistory(conversationId);
    res.json(history);
  } catch (error: any) {
    console.error('[Intelligence Route] History error:', error.message);
    res.status(500).json({ error: "Failed to get conversation history" });
  }
});

// ============================================================
// GDPR ENDPOINTS
// ============================================================

// DELETE /api/intelligence/gdpr/:clientId
router.delete("/gdpr/:clientId", requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { clientId } = req.params;
    const { reason } = req.body;

    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ error: "Deletion reason is required for GDPR compliance" });
    }

    const redactedCount = await redactClientData(clientId, user.id, reason);

    res.json({
      success: true,
      message: `Redacted ${redactedCount} knowledge chunks for GDPR compliance`,
      redactedCount,
      auditNote: `GDPR deletion by ${user.name} (${user.id}) at ${new Date().toISOString()}`,
    });
  } catch (error: any) {
    console.error('[Intelligence Route] GDPR error:', error.message);
    res.status(500).json({ error: "Failed to process GDPR request" });
  }
});

export default router;
