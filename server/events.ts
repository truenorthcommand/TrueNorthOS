import { db } from "./db";
import { 
  domainEvents, jobQueue, webhookSubscriptions, webhookDeliveries, exceptions,
  type InsertDomainEvent, type InsertJobQueue, type InsertException,
  type DomainEvent, type JobQueueItem, type WebhookSubscription
} from "@shared/schema";
import { eq, and, sql, lte, isNull, or, inArray } from "drizzle-orm";
import crypto from "crypto";

// ==================== DOMAIN EVENTS ====================

interface EmitEventOptions {
  tenantId?: string;
  aggregateType?: string;
  aggregateId?: string;
  causedById?: string;
  correlationId?: string;
  dedupeKey?: string;
  metadata?: Record<string, any>;
}

export async function emitEvent(
  eventType: string,
  payload: Record<string, any>,
  options: EmitEventOptions = {}
): Promise<DomainEvent> {
  const { tenantId, aggregateType, aggregateId, causedById, correlationId, dedupeKey, metadata } = options;

  // Check for duplicate if dedupeKey is provided
  if (dedupeKey) {
    const existing = await db.select()
      .from(domainEvents)
      .where(eq(domainEvents.dedupeKey, dedupeKey))
      .limit(1);
    
    if (existing.length > 0) {
      console.log(`[Events] Duplicate event detected for dedupeKey: ${dedupeKey}`);
      return existing[0];
    }
  }

  // Insert domain event
  const [event] = await db.insert(domainEvents).values({
    tenantId,
    eventType,
    payload,
    dedupeKey,
    aggregateType,
    aggregateId,
    causedById,
    correlationId: correlationId || crypto.randomUUID(),
    metadata: metadata || {},
  }).returning();

  console.log(`[Events] Emitted event: ${eventType} (${event.id})`);

  // Enqueue jobs for workflow processing and webhook delivery
  await enqueueWorkflowJob(event);
  await enqueueWebhookJobs(event);

  return event;
}

async function enqueueWorkflowJob(event: DomainEvent): Promise<void> {
  await db.insert(jobQueue).values({
    jobType: "workflow_run",
    payload: { eventId: event.id, eventType: event.eventType },
    priority: 0,
    status: "pending",
  });
}

async function enqueueWebhookJobs(event: DomainEvent): Promise<void> {
  // Find all active webhook subscriptions that listen to this event type
  const subscriptions = await db.select()
    .from(webhookSubscriptions)
    .where(eq(webhookSubscriptions.isActive, true));

  for (const subscription of subscriptions) {
    const eventTypes = subscription.eventTypes as string[];
    if (eventTypes.includes(event.eventType) || eventTypes.includes("*")) {
      // Create webhook delivery record
      const [delivery] = await db.insert(webhookDeliveries).values({
        subscriptionId: subscription.id,
        eventId: event.id,
        eventType: event.eventType,
        payload: event.payload,
        status: "pending",
      }).returning();

      // Enqueue job for webhook delivery
      await db.insert(jobQueue).values({
        jobType: "webhook_delivery",
        payload: { deliveryId: delivery.id, subscriptionId: subscription.id },
        priority: 0,
        status: "pending",
      });
    }
  }
}

// ==================== JOB QUEUE WORKER ====================

const WORKER_ID = `worker-${process.pid}-${Date.now()}`;
const POLL_INTERVAL_MS = 1000;
const LOCK_TIMEOUT_MS = 60000; // 1 minute

let isWorkerRunning = false;

export async function startQueueWorker(): Promise<void> {
  if (isWorkerRunning) {
    console.log("[Queue Worker] Already running");
    return;
  }

  isWorkerRunning = true;
  console.log(`[Queue Worker] Starting worker: ${WORKER_ID}`);

  while (isWorkerRunning) {
    try {
      const job = await acquireJob();
      if (job) {
        await processJob(job);
      } else {
        await sleep(POLL_INTERVAL_MS);
      }
    } catch (error) {
      console.error("[Queue Worker] Error in worker loop:", error);
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

export function stopQueueWorker(): void {
  isWorkerRunning = false;
  console.log("[Queue Worker] Stopping worker");
}

async function acquireJob(): Promise<JobQueueItem | null> {
  const now = new Date();
  const lockTimeout = new Date(now.getTime() - LOCK_TIMEOUT_MS);

  // Use FOR UPDATE SKIP LOCKED to safely acquire a job
  const result = await db.execute(sql`
    UPDATE job_queue
    SET locked_at = ${now}, locked_by = ${WORKER_ID}, attempts = attempts + 1
    WHERE id = (
      SELECT id FROM job_queue
      WHERE status = 'pending'
        AND scheduled_for <= ${now}
        AND (locked_at IS NULL OR locked_at < ${lockTimeout})
      ORDER BY priority DESC, created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `);

  const rows = result.rows as JobQueueItem[];
  return rows.length > 0 ? rows[0] : null;
}

async function processJob(job: JobQueueItem): Promise<void> {
  console.log(`[Queue Worker] Processing job: ${job.id} (${job.jobType})`);

  try {
    switch (job.jobType) {
      case "workflow_run":
        await processWorkflowRun(job);
        break;
      case "webhook_delivery":
        await processWebhookDelivery(job);
        break;
      case "pdf_render":
        await processPdfRender(job);
        break;
      case "email_send":
        await processEmailSend(job);
        break;
      default:
        console.warn(`[Queue Worker] Unknown job type: ${job.jobType}`);
    }

    // Mark job as completed
    await db.update(jobQueue)
      .set({ status: "completed", completedAt: new Date(), lockedAt: null, lockedBy: null })
      .where(eq(jobQueue.id, job.id));

    console.log(`[Queue Worker] Job completed: ${job.id}`);
  } catch (error: any) {
    console.error(`[Queue Worker] Job failed: ${job.id}`, error);

    const maxAttempts = job.maxAttempts || 3;
    const newStatus = job.attempts >= maxAttempts ? "dead_letter" : "pending";

    await db.update(jobQueue)
      .set({ 
        status: newStatus, 
        lastError: error.message || String(error),
        lockedAt: null,
        lockedBy: null,
        scheduledFor: newStatus === "pending" 
          ? new Date(Date.now() + Math.pow(2, job.attempts) * 1000) // Exponential backoff
          : undefined
      })
      .where(eq(jobQueue.id, job.id));

    // Create exception if job went to dead letter
    if (newStatus === "dead_letter") {
      await createException({
        type: "job_failed",
        severity: "error",
        title: `Job failed after ${maxAttempts} attempts`,
        message: error.message || String(error),
        context: { jobId: job.id, jobType: job.jobType, payload: job.payload },
      });
    }
  }
}

// ==================== JOB HANDLERS ====================

async function processWorkflowRun(job: JobQueueItem): Promise<void> {
  const payload = job.payload as { eventId: string; eventType: string };
  console.log(`[Workflow] Processing workflow for event: ${payload.eventType}`);
  
  const { processWorkflowForEvent } = await import("./workflow-runner");
  await processWorkflowForEvent(payload.eventId, payload.eventType);
}

async function processWebhookDelivery(job: JobQueueItem): Promise<void> {
  const payload = job.payload as { deliveryId: string; subscriptionId: string };
  
  const [delivery] = await db.select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, payload.deliveryId));

  if (!delivery) {
    throw new Error(`Webhook delivery not found: ${payload.deliveryId}`);
  }

  const [subscription] = await db.select()
    .from(webhookSubscriptions)
    .where(eq(webhookSubscriptions.id, payload.subscriptionId));

  if (!subscription) {
    throw new Error(`Webhook subscription not found: ${payload.subscriptionId}`);
  }

  // Generate HMAC signature
  const timestamp = Math.floor(Date.now() / 1000);
  const payloadString = JSON.stringify(delivery.payload);
  const signaturePayload = `${timestamp}.${payloadString}`;
  const signature = crypto
    .createHmac("sha256", subscription.secret)
    .update(signaturePayload)
    .digest("hex");

  // Send webhook
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Webhook-Signature-256": `sha256=${signature}`,
    "X-Webhook-Event": delivery.eventType,
    "X-Webhook-Delivery-Id": delivery.id,
    ...(subscription.headers as Record<string, string> || {}),
  };

  const response = await fetch(subscription.url, {
    method: "POST",
    headers,
    body: payloadString,
  });

  const responseBody = await response.text();

  // Update delivery record
  await db.update(webhookDeliveries)
    .set({
      attempts: delivery.attempts + 1,
      lastAttemptAt: new Date(),
      responseStatus: response.status,
      responseBody: responseBody.slice(0, 10000), // Truncate large responses
      status: response.ok ? "success" : "failed",
      errorMessage: response.ok ? null : `HTTP ${response.status}`,
      completedAt: response.ok ? new Date() : null,
    })
    .where(eq(webhookDeliveries.id, delivery.id));

  if (!response.ok) {
    throw new Error(`Webhook delivery failed: HTTP ${response.status}`);
  }

  console.log(`[Webhook] Delivered webhook to ${subscription.url}`);
}

async function processPdfRender(job: JobQueueItem): Promise<void> {
  console.log(`[PDF] Rendering PDF for job: ${JSON.stringify(job.payload)}`);
  // TODO: Implement PDF rendering in Phase 2
}

async function processEmailSend(job: JobQueueItem): Promise<void> {
  console.log(`[Email] Sending email for job: ${JSON.stringify(job.payload)}`);
  // TODO: Implement email sending
}

// ==================== EXCEPTIONS ====================

export async function createException(data: {
  type: string;
  severity?: string;
  title: string;
  message?: string;
  context?: Record<string, any>;
  entityType?: string;
  entityId?: string;
  stackTrace?: string;
}): Promise<{ id: string }> {
  const [exception] = await db.insert(exceptions).values({
    type: data.type,
    severity: data.severity || "warning",
    title: data.title,
    message: data.message,
    context: data.context || {},
    entityType: data.entityType,
    entityId: data.entityId,
    stackTrace: data.stackTrace,
    status: "open",
  }).returning({ id: exceptions.id });

  console.log(`[Exception] Created: ${data.type} - ${data.title} (${exception.id})`);
  return exception;
}

// ==================== HELPERS ====================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== QUEUE HELPERS ====================

export async function enqueueJob(
  jobType: string,
  payload: Record<string, any>,
  options: { priority?: number; scheduledFor?: Date; maxAttempts?: number } = {}
): Promise<JobQueueItem> {
  const [job] = await db.insert(jobQueue).values({
    jobType,
    payload,
    priority: options.priority || 0,
    scheduledFor: options.scheduledFor || new Date(),
    maxAttempts: options.maxAttempts || 3,
    status: "pending",
  }).returning();

  return job;
}

export async function getQueueStats(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  deadLetter: number;
}> {
  const result = await db.execute(sql`
    SELECT status, COUNT(*) as count
    FROM job_queue
    GROUP BY status
  `);

  const stats = { pending: 0, processing: 0, completed: 0, failed: 0, deadLetter: 0 };
  for (const row of result.rows as any[]) {
    const status = row.status as string;
    const count = parseInt(row.count as string, 10);
    if (status === "pending") stats.pending = count;
    else if (status === "processing") stats.processing = count;
    else if (status === "completed") stats.completed = count;
    else if (status === "failed") stats.failed = count;
    else if (status === "dead_letter") stats.deadLetter = count;
  }
  return stats;
}
