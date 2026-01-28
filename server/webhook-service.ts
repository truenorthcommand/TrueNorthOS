import crypto from "crypto";
import { db } from "./db";
import { webhookSubscriptions, webhookDeliveries, type WebhookSubscription, type WebhookDelivery } from "@shared/schema";
import { eq } from "drizzle-orm";

interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
}

const DEFAULT_RETRY_POLICY: RetryPolicy = { maxAttempts: 3, backoffMs: 1000 };

export function generateWebhookSignature(payload: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
}

export function generateWebhookHeaders(
  deliveryId: string,
  eventType: string,
  payloadString: string,
  secret: string,
  customHeaders: Record<string, string> = {}
): Record<string, string> {
  const signature = generateWebhookSignature(payloadString, secret);
  
  return {
    "Content-Type": "application/json",
    "X-Webhook-Signature-256": `sha256=${signature}`,
    "X-Webhook-Event": eventType,
    "X-Webhook-Delivery-Id": deliveryId,
    ...customHeaders,
  };
}

export async function deliverWebhook(
  eventId: string,
  eventType: string,
  payload: any
): Promise<void> {
  const subscriptions = await db.select()
    .from(webhookSubscriptions)
    .where(eq(webhookSubscriptions.isActive, true));

  for (const subscription of subscriptions) {
    const eventTypes = subscription.eventTypes as string[];
    if (!eventTypes.includes(eventType) && !eventTypes.includes("*")) {
      continue;
    }

    const [delivery] = await db.insert(webhookDeliveries).values({
      subscriptionId: subscription.id,
      eventId,
      eventType,
      payload,
      status: "pending",
      attempts: 0,
    }).returning();

    await attemptWebhookDelivery(delivery, subscription);
  }
}

async function attemptWebhookDelivery(
  delivery: WebhookDelivery,
  subscription: WebhookSubscription
): Promise<void> {
  const retryPolicy = (subscription.retryPolicy as RetryPolicy) || DEFAULT_RETRY_POLICY;
  const maxAttempts = retryPolicy.maxAttempts;
  const baseBackoffMs = retryPolicy.backoffMs;

  let attempt = 0;
  let lastError: string | null = null;

  while (attempt < maxAttempts) {
    attempt++;
    
    if (attempt > 1) {
      const backoffMs = baseBackoffMs * Math.pow(2, attempt - 1);
      await sleep(backoffMs);
    }

    try {
      const payloadString = JSON.stringify(delivery.payload);
      const headers = generateWebhookHeaders(
        delivery.id,
        delivery.eventType,
        payloadString,
        subscription.secret,
        (subscription.headers as Record<string, string>) || {}
      );

      const response = await fetch(subscription.url, {
        method: "POST",
        headers,
        body: payloadString,
      });

      const responseBody = await response.text();

      await db.update(webhookDeliveries)
        .set({
          attempts: attempt,
          lastAttemptAt: new Date(),
          responseStatus: response.status,
          responseBody: responseBody.slice(0, 10000),
          status: response.ok ? "success" : "failed",
          errorMessage: response.ok ? null : `HTTP ${response.status}`,
          completedAt: response.ok ? new Date() : null,
        })
        .where(eq(webhookDeliveries.id, delivery.id));

      if (response.ok) {
        console.log(`[Webhook] Successfully delivered to ${subscription.url} (attempt ${attempt})`);
        return;
      }

      lastError = `HTTP ${response.status}: ${responseBody.slice(0, 200)}`;
      console.log(`[Webhook] Delivery failed to ${subscription.url} (attempt ${attempt}): ${lastError}`);

    } catch (error: any) {
      lastError = error.message || String(error);
      console.error(`[Webhook] Delivery error to ${subscription.url} (attempt ${attempt}):`, lastError);

      await db.update(webhookDeliveries)
        .set({
          attempts: attempt,
          lastAttemptAt: new Date(),
          status: "failed",
          errorMessage: lastError,
        })
        .where(eq(webhookDeliveries.id, delivery.id));
    }
  }

  console.error(`[Webhook] Exhausted all ${maxAttempts} attempts for delivery ${delivery.id}`);
}

export async function sendTestWebhook(subscriptionId: string): Promise<WebhookDelivery> {
  const [subscription] = await db.select()
    .from(webhookSubscriptions)
    .where(eq(webhookSubscriptions.id, subscriptionId));

  if (!subscription) {
    throw new Error("Webhook subscription not found");
  }

  const testPayload = {
    test: true,
    eventType: "test.webhook",
    message: "This is a test webhook delivery",
    timestamp: new Date().toISOString(),
    subscriptionId: subscription.id,
    subscriptionName: subscription.name,
  };

  const [delivery] = await db.insert(webhookDeliveries).values({
    subscriptionId: subscription.id,
    eventId: `test-${Date.now()}`,
    eventType: "test.webhook",
    payload: testPayload,
    status: "pending",
    attempts: 0,
  }).returning();

  await attemptWebhookDelivery(delivery, subscription);

  const [updatedDelivery] = await db.select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, delivery.id));

  return updatedDelivery;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
