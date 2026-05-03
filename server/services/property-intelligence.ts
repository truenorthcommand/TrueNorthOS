import OpenAI from "openai";
import { db } from "../db";
import { knowledgeChunks, intelligenceConversations, clients, clientProperties, jobs, quotes, invoices } from "@shared/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";

// OpenRouter configuration (same as ai-service.ts)
const openai = process.env.OPENROUTER_API_KEY ? new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": process.env.OPENROUTER_REFERER || "https://adaptservicesgroup.app",
    "X-Title": "ASG Property Intelligence"
  }
}) : null;

// Embedding model
const EMBEDDING_MODEL = "openai/text-embedding-3-large";
const CHAT_MODEL = "openai/gpt-4o";
const EMBEDDING_DIMENSIONS = 1536;

// ============================================================
// SYSTEM PROMPTS
// ============================================================

const FACTUAL_SYSTEM_PROMPT = `You are an internal AI assistant for Adapt Services Group, a field service management company.
You provide factual information about clients, properties, jobs, quotes, invoices, and maintenance history.

RULES:
1. ONLY state information present in the provided data
2. NEVER make predictions unless the user explicitly requests one using words like "predict", "forecast", "recommend"
3. Use phrases like "According to the records...", "The data shows..."
4. If information is missing, say "I don't have that information in the current records"
5. Always cite the source (Job #, Invoice #, Date) where applicable
6. Format responses with clear sections, bullet points, and status indicators
7. Use emoji indicators: ✅ complete, 🔄 in progress, ⏳ pending, ⚠️ attention needed, 🔴 overdue

ALLOWED:
✓ Summarizing existing data
✓ Calculating totals, averages, counts
✓ Comparing historical data
✓ Identifying patterns in past events
✓ Financial summaries (invoices, quotes, costs)

NOT ALLOWED (unless explicitly requested):
✗ Future predictions
✗ Recommendations or advice
✗ "You should..." statements
✗ Estimates beyond the data provided`;

const PREDICTIVE_SYSTEM_PROMPT = `You are an internal AI assistant for Adapt Services Group providing predictive analysis.
The user has EXPLICITLY requested a prediction or recommendation.

RULES:
1. Begin predictions with: "Based on historical patterns..."
2. Include confidence percentage (e.g., "85% confidence")
3. Explain the data basis for your prediction
4. List assumptions made
5. Add disclaimer: "⚠️ This is a predictive analysis based on historical data, not a guarantee."
6. Still cite relevant source data

FORMAT:
- Clear section headers
- Confidence levels for each prediction
- Supporting evidence from the data
- Recommended actions (since user requested)`;

// ============================================================
// PREDICTIVE TRIGGER DETECTION
// ============================================================

const PREDICTIVE_TRIGGERS = [
  'predict', 'prediction', 'forecast', 'recommend', 'recommendation',
  'advise', 'suggest', 'suggestion', 'what would you do',
  'what do you think will', 'likely to', 'predictive mode',
  'give me a prediction', 'what do you predict'
];

function isPredictiveQuery(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  return PREDICTIVE_TRIGGERS.some(trigger => lowerQuery.includes(trigger));
}

// ============================================================
// EMBEDDING FUNCTIONS
// ============================================================

async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!openai) {
    console.warn('[PropertyIntelligence] No OpenRouter API key - embeddings disabled');
    return null;
  }

  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    } as any);

    return response.data[0].embedding;
  } catch (error: any) {
    console.error('[PropertyIntelligence] Embedding error:', error.message);
    return null;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ============================================================
// DATA CHUNKING SERVICE
// ============================================================

interface ChunkData {
  clientId: string;
  propertyId?: string;
  sourceType: string;
  sourceId: string;
  content: string;
  metadata: Record<string, any>;
  gdprClassification?: string;
}

async function createChunk(data: ChunkData, userId?: string): Promise<string | null> {
  try {
    const embedding = await generateEmbedding(data.content);
    
    const [chunk] = await db.insert(knowledgeChunks).values({
      clientId: data.clientId,
      propertyId: data.propertyId || null,
      sourceType: data.sourceType,
      sourceId: data.sourceId,
      content: data.content,
      metadata: data.metadata,
      embedding: embedding,
      gdprClassification: data.gdprClassification || 'operation',
      createdBy: userId || null,
    }).returning();

    return chunk.id;
  } catch (error: any) {
    console.error('[PropertyIntelligence] Create chunk error:', error.message);
    return null;
  }
}

// ============================================================
// DATA INGESTION - Convert existing data to knowledge chunks
// ============================================================

export async function ingestClientData(clientId: string, userId?: string): Promise<number> {
  let chunksCreated = 0;

  try {
    // 1. Ingest client profile
    const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
    if (!client) return 0;

    const clientContent = `Client: ${client.name}\nContact: ${client.contactName || 'N/A'}\nEmail: ${client.email || 'N/A'}\nPhone: ${client.phone || 'N/A'}\nAddress: ${client.address || 'N/A'}\nNotes: ${client.notes || 'None'}`;
    
    await createChunk({
      clientId,
      sourceType: 'client_profile',
      sourceId: clientId,
      content: clientContent,
      metadata: { name: client.name, type: 'profile' },
    }, userId);
    chunksCreated++;

    // 2. Ingest properties
    const properties = await db.select().from(clientProperties).where(eq(clientProperties.clientId, clientId));
    for (const prop of properties) {
      const propContent = `Property: ${prop.name}\nAddress: ${prop.address}\nPostcode: ${prop.postcode || 'N/A'}\nContact: ${prop.contactName || 'N/A'}\nPhone: ${prop.contactPhone || 'N/A'}\nNotes: ${prop.notes || 'None'}`;
      
      await createChunk({
        clientId,
        propertyId: prop.id,
        sourceType: 'property_profile',
        sourceId: prop.id,
        content: propContent,
        metadata: { name: prop.name, address: prop.address },
      }, userId);
      chunksCreated++;
    }

    // 3. Ingest jobs
    const clientJobs = await db.select().from(jobs).where(eq(jobs.client, clientId));
    for (const job of clientJobs) {
      const jobContent = `Job ${job.jobNo}: ${job.customerName}\nStatus: ${job.status}\nProperty: ${job.propertyName || job.address || 'N/A'}\nDate: ${job.date ? new Date(job.date).toLocaleDateString('en-GB') : 'N/A'}\nDescription: ${job.description || 'N/A'}\nWorks Completed: ${job.worksCompleted || 'Not yet completed'}\nNotes: ${job.notes || 'None'}`;
      
      await createChunk({
        clientId,
        propertyId: job.propertyId || undefined,
        sourceType: 'job',
        sourceId: job.id,
        content: jobContent,
        metadata: {
          jobNo: job.jobNo,
          status: job.status,
          date: job.date,
          propertyName: job.propertyName,
        },
      }, userId);
      chunksCreated++;
    }

    // 4. Ingest quotes
    const clientQuotes = await db.select().from(quotes).where(eq(quotes.clientId, clientId));
    for (const quote of clientQuotes) {
      const quoteContent = `Quote ${quote.quoteNumber || quote.id}: ${quote.title || 'Untitled'}\nStatus: ${quote.status}\nTotal: £${quote.total || 0}\nDescription: ${quote.description || 'N/A'}\nCreated: ${quote.createdAt ? new Date(quote.createdAt).toLocaleDateString('en-GB') : 'N/A'}`;
      
      await createChunk({
        clientId,
        propertyId: (quote as any).propertyId || undefined,
        sourceType: 'quote',
        sourceId: quote.id,
        content: quoteContent,
        metadata: {
          quoteNumber: quote.quoteNumber,
          status: quote.status,
          total: quote.total,
        },
        gdprClassification: 'financial',
      }, userId);
      chunksCreated++;
    }

    // 5. Ingest invoices
    const clientInvoices = await db.select().from(invoices).where(eq(invoices.clientId, clientId));
    for (const invoice of clientInvoices) {
      const invoiceContent = `Invoice ${invoice.invoiceNumber || invoice.id}\nStatus: ${invoice.status}\nTotal: £${invoice.total || 0}\nDue Date: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-GB') : 'N/A'}\nIssued: ${invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString('en-GB') : 'N/A'}`;
      
      await createChunk({
        clientId,
        propertyId: (invoice as any).propertyId || undefined,
        sourceType: 'invoice',
        sourceId: invoice.id,
        content: invoiceContent,
        metadata: {
          invoiceNumber: invoice.invoiceNumber,
          status: invoice.status,
          total: invoice.total,
        },
        gdprClassification: 'financial',
      }, userId);
      chunksCreated++;
    }

    console.log(`[PropertyIntelligence] Ingested ${chunksCreated} chunks for client ${client.name}`);
    return chunksCreated;
  } catch (error: any) {
    console.error('[PropertyIntelligence] Ingestion error:', error.message);
    return chunksCreated;
  }
}

// Ingest ALL clients
export async function ingestAllClients(userId?: string): Promise<{ total: number; clients: number }> {
  const allClients = await db.select().from(clients);
  let totalChunks = 0;

  for (const client of allClients) {
    const chunks = await ingestClientData(client.id, userId);
    totalChunks += chunks;
  }

  return { total: totalChunks, clients: allClients.length };
}

// ============================================================
// QUERY SERVICE
// ============================================================

interface QueryOptions {
  clientId?: string;
  propertyId?: string;
  scope: 'organization' | 'client' | 'property';
  userId: string;
  conversationId?: string;
  ipAddress?: string;
  sessionId?: string;
}

interface QueryResult {
  response: string;
  responseType: 'factual' | 'predictive' | 'analytical';
  confidenceScore: number;
  retrievedChunkIds: string[];
  tokensUsed: number;
  responseTimeMs: number;
  conversationId: string;
}

export async function queryIntelligence(query: string, options: QueryOptions): Promise<QueryResult> {
  const startTime = Date.now();
  const conversationId = options.conversationId || crypto.randomUUID();
  const isPredictive = isPredictiveQuery(query);

  try {
    // 1. Generate query embedding
    const queryEmbedding = await generateEmbedding(query);

    // 2. Retrieve relevant chunks
    let chunks: any[] = [];
    
    // Build filter conditions
    const conditions: any[] = [isNull(knowledgeChunks.deletedAt)];
    
    if (options.scope === 'property' && options.propertyId) {
      conditions.push(eq(knowledgeChunks.propertyId, options.propertyId));
    } else if (options.scope === 'client' && options.clientId) {
      conditions.push(eq(knowledgeChunks.clientId, options.clientId));
    }
    // organization scope = no filter (all chunks)

    const allChunks = await db.select()
      .from(knowledgeChunks)
      .where(and(...conditions))
      .limit(500);

    // 3. Rank by similarity
    if (queryEmbedding && allChunks.length > 0) {
      const ranked = allChunks
        .map(chunk => ({
          ...chunk,
          similarity: chunk.embedding ? cosineSimilarity(queryEmbedding, chunk.embedding as number[]) : 0,
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 15); // Top 15 relevant chunks

      chunks = ranked.filter(c => c.similarity > 0.3); // Minimum threshold
    } else {
      // Fallback: keyword search if no embeddings
      const lowerQuery = query.toLowerCase();
      chunks = allChunks
        .filter(chunk => chunk.content.toLowerCase().includes(lowerQuery.split(' ')[0]))
        .slice(0, 15);
    }

    // 4. Build context from chunks
    const contextText = chunks.length > 0
      ? chunks.map(c => `[${c.sourceType.toUpperCase()} | ID: ${c.sourceId}]\n${c.content}`).join('\n\n---\n\n')
      : 'No specific data found for this query. The client/property may not have been ingested yet.';

    // 5. Call GPT-4o
    const systemPrompt = isPredictive ? PREDICTIVE_SYSTEM_PROMPT : FACTUAL_SYSTEM_PROMPT;
    const userPrompt = `Context Data:\n\n${contextText}\n\n---\n\nUser Question: ${query}\n\nScope: ${options.scope}${options.clientId ? ` | Client ID: ${options.clientId}` : ''}${options.propertyId ? ` | Property ID: ${options.propertyId}` : ''}`;

    let aiResponse = 'Unable to generate response. Please check API configuration.';
    let tokensUsed = 0;

    if (openai) {
      const completion = await openai.chat.completions.create({
        model: CHAT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3, // Lower for factual accuracy
        max_tokens: 2000,
      });

      aiResponse = completion.choices[0]?.message?.content || 'No response generated.';
      tokensUsed = completion.usage?.total_tokens || 0;
    }

    const responseTimeMs = Date.now() - startTime;
    const retrievedChunkIds = chunks.map(c => c.id);

    // 6. Log conversation (audit trail)
    await db.insert(intelligenceConversations).values({
      conversationId,
      userId: options.userId,
      clientId: options.clientId || null,
      propertyId: options.propertyId || null,
      queryScope: options.scope,
      userQuery: query,
      aiResponse,
      responseType: isPredictive ? 'predictive' : 'factual',
      confidenceScore: chunks.length > 0 ? 0.85 : 0.4,
      retrievedChunkIds,
      tokensUsed,
      costEstimate: tokensUsed * 0.000005, // Approximate GPT-4o cost
      responseTimeMs,
      ipAddress: options.ipAddress || null,
      sessionId: options.sessionId || null,
    });

    return {
      response: aiResponse,
      responseType: isPredictive ? 'predictive' : 'factual',
      confidenceScore: chunks.length > 0 ? 0.85 : 0.4,
      retrievedChunkIds,
      tokensUsed,
      responseTimeMs,
      conversationId,
    };
  } catch (error: any) {
    console.error('[PropertyIntelligence] Query error:', error.message);
    
    const responseTimeMs = Date.now() - startTime;
    
    return {
      response: `Error processing query: ${error.message}. Please try again.`,
      responseType: 'factual',
      confidenceScore: 0,
      retrievedChunkIds: [],
      tokensUsed: 0,
      responseTimeMs,
      conversationId,
    };
  }
}

// ============================================================
// CONVERSATION HISTORY
// ============================================================

export async function getConversationHistory(
  conversationId: string,
): Promise<any[]> {
  return db.select()
    .from(intelligenceConversations)
    .where(eq(intelligenceConversations.conversationId, conversationId))
    .orderBy(intelligenceConversations.createdAt);
}

export async function getUserConversations(
  userId: string,
  limit = 20,
): Promise<any[]> {
  return db.select()
    .from(intelligenceConversations)
    .where(eq(intelligenceConversations.userId, userId))
    .orderBy(desc(intelligenceConversations.createdAt))
    .limit(limit);
}

// ============================================================
// KNOWLEDGE BASE STATUS
// ============================================================

export async function getKnowledgeBaseStats(clientId?: string): Promise<any> {
  const conditions: any[] = [isNull(knowledgeChunks.deletedAt)];
  if (clientId) {
    conditions.push(eq(knowledgeChunks.clientId, clientId));
  }

  const chunks = await db.select({
    sourceType: knowledgeChunks.sourceType,
    count: sql<number>`count(*)::int`,
  })
    .from(knowledgeChunks)
    .where(and(...conditions))
    .groupBy(knowledgeChunks.sourceType);

  const totalChunks = chunks.reduce((sum, c) => sum + c.count, 0);
  const hasEmbeddings = await db.select({ count: sql<number>`count(*)::int` })
    .from(knowledgeChunks)
    .where(and(...conditions, sql`embedding IS NOT NULL`));

  return {
    totalChunks,
    bySourceType: chunks,
    embeddedChunks: hasEmbeddings[0]?.count || 0,
    percentEmbedded: totalChunks > 0 ? Math.round((hasEmbeddings[0]?.count || 0) / totalChunks * 100) : 0,
  };
}

// ============================================================
// GDPR - Delete/Redact
// ============================================================

export async function redactClientData(clientId: string, userId: string, reason: string): Promise<number> {
  const result = await db.update(knowledgeChunks)
    .set({
      content: '[REDACTED - GDPR Request]',
      embedding: null,
      metadata: { redacted: true, reason },
      deletedAt: new Date(),
      deletedBy: userId,
      deletionReason: reason,
    })
    .where(eq(knowledgeChunks.clientId, clientId))
    .returning();

  return result.length;
}
