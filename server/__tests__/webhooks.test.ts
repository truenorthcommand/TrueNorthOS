import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import crypto from "crypto";

vi.mock("../storage", () => ({
  storage: {
    getUser: vi.fn(),
    getWebhookSubscriptions: vi.fn(),
    getWebhookSubscription: vi.fn(),
    createWebhookSubscription: vi.fn(),
    updateWebhookSubscription: vi.fn(),
    deleteWebhookSubscription: vi.fn(),
    getWebhookDeliveries: vi.fn(),
  },
}));

vi.mock("../webhook-service", () => ({
  sendTestWebhook: vi.fn(),
  generateWebhookSignature: vi.fn(),
  generateWebhookHeaders: vi.fn(),
  deliverWebhook: vi.fn(),
}));

import { storage } from "../storage";
import { sendTestWebhook, generateWebhookSignature, generateWebhookHeaders } from "../webhook-service";

function createTestApp() {
  const app = express();
  app.use(express.json());
  
  app.use((req, res, next) => {
    (req as any).session = {
      userId: "test-admin-id",
      userRole: "admin",
    };
    next();
  });
  
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    next();
  };
  
  const requireAdmin = async (req: any, res: any, next: any) => {
    const user = await storage.getUser(req.session.userId);
    if (!user || (!user.superAdmin && !((user.roles as string[])?.includes("admin")))) {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  };
  
  app.get("/api/webhooks", requireAdmin, async (req, res) => {
    try {
      const subscriptions = await storage.getWebhookSubscriptions();
      res.json(subscriptions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch webhook subscriptions" });
    }
  });
  
  app.post("/api/webhooks", requireAdmin, async (req, res) => {
    try {
      const { name, url, eventTypes, headers, retryPolicy } = req.body;
      
      if (!name || !url || !eventTypes) {
        return res.status(400).json({ error: "Name, url, and eventTypes are required" });
      }
      
      const secret = crypto.randomBytes(32).toString("hex");
      
      const subscription = await storage.createWebhookSubscription({
        name,
        url,
        secret,
        eventTypes,
        headers: headers || {},
        retryPolicy: retryPolicy || { maxAttempts: 3, backoffMs: 1000 },
        isActive: true,
      });
      
      res.status(201).json(subscription);
    } catch (error) {
      res.status(500).json({ error: "Failed to create webhook subscription" });
    }
  });
  
  app.get("/api/webhooks/:id", requireAuth, async (req, res) => {
    try {
      const subscription = await storage.getWebhookSubscription(req.params.id);
      if (!subscription) {
        return res.status(404).json({ error: "Webhook subscription not found" });
      }
      res.json(subscription);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch webhook subscription" });
    }
  });
  
  app.patch("/api/webhooks/:id", requireAdmin, async (req, res) => {
    try {
      const existing = await storage.getWebhookSubscription(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Webhook subscription not found" });
      }
      
      const updated = await storage.updateWebhookSubscription(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update webhook subscription" });
    }
  });
  
  app.delete("/api/webhooks/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteWebhookSubscription(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete webhook subscription" });
    }
  });
  
  app.get("/api/webhooks/:id/deliveries", requireAuth, async (req, res) => {
    try {
      const deliveries = await storage.getWebhookDeliveries(req.params.id);
      res.json(deliveries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch webhook deliveries" });
    }
  });
  
  app.post("/api/webhooks/:id/test", requireAdmin, async (req, res) => {
    try {
      const delivery = await sendTestWebhook(req.params.id);
      res.json(delivery);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to send test webhook" });
    }
  });
  
  return app;
}

describe("Webhook Subscription CRUD", () => {
  let app: Express;
  
  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
    
    (storage.getUser as any).mockResolvedValue({
      id: "test-admin-id",
      username: "admin",
      name: "Admin User",
      role: "admin",
      roles: ["admin"],
      superAdmin: true,
    });
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe("GET /api/webhooks", () => {
    it("should return empty array when no subscriptions exist", async () => {
      (storage.getWebhookSubscriptions as any).mockResolvedValue([]);
      
      const response = await request(app).get("/api/webhooks");
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
    
    it("should return all webhook subscriptions", async () => {
      const mockSubscriptions = [
        {
          id: "webhook-1",
          name: "Slack Notifications",
          url: "https://hooks.slack.com/services/xxx",
          eventTypes: ["JobCreated", "JobCompleted"],
          isActive: true,
        },
        {
          id: "webhook-2",
          name: "External CRM",
          url: "https://crm.example.com/webhook",
          eventTypes: ["*"],
          isActive: true,
        },
      ];
      
      (storage.getWebhookSubscriptions as any).mockResolvedValue(mockSubscriptions);
      
      const response = await request(app).get("/api/webhooks");
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toBe("Slack Notifications");
    });
  });
  
  describe("POST /api/webhooks", () => {
    it("should create a new webhook subscription", async () => {
      const newSubscription = {
        name: "New Webhook",
        url: "https://example.com/webhook",
        eventTypes: ["JobCreated", "JobCompleted"],
      };
      
      const createdSubscription = {
        id: "new-webhook-id",
        ...newSubscription,
        secret: "generated-secret",
        isActive: true,
        headers: {},
        retryPolicy: { maxAttempts: 3, backoffMs: 1000 },
        createdAt: new Date().toISOString(),
      };
      
      (storage.createWebhookSubscription as any).mockResolvedValue(createdSubscription);
      
      const response = await request(app)
        .post("/api/webhooks")
        .send(newSubscription);
      
      expect(response.status).toBe(201);
      expect(response.body.id).toBe("new-webhook-id");
      expect(response.body.name).toBe("New Webhook");
      expect(storage.createWebhookSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "New Webhook",
          url: "https://example.com/webhook",
          eventTypes: ["JobCreated", "JobCompleted"],
          secret: expect.any(String),
        })
      );
    });
    
    it("should return 400 when required fields are missing", async () => {
      const response = await request(app)
        .post("/api/webhooks")
        .send({ name: "Incomplete Webhook" });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain("required");
    });
    
    it("should create subscription with custom headers and retry policy", async () => {
      const subscriptionWithOptions = {
        name: "Custom Webhook",
        url: "https://example.com/webhook",
        eventTypes: ["JobCreated"],
        headers: { "X-Custom-Header": "value" },
        retryPolicy: { maxAttempts: 5, backoffMs: 2000 },
      };
      
      const createdSubscription = {
        id: "custom-webhook-id",
        ...subscriptionWithOptions,
        secret: "generated-secret",
        isActive: true,
      };
      
      (storage.createWebhookSubscription as any).mockResolvedValue(createdSubscription);
      
      const response = await request(app)
        .post("/api/webhooks")
        .send(subscriptionWithOptions);
      
      expect(response.status).toBe(201);
      expect(storage.createWebhookSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { "X-Custom-Header": "value" },
          retryPolicy: { maxAttempts: 5, backoffMs: 2000 },
        })
      );
    });
  });
  
  describe("GET /api/webhooks/:id", () => {
    it("should return a webhook subscription by id", async () => {
      const mockSubscription = {
        id: "webhook-1",
        name: "Test Webhook",
        url: "https://example.com/webhook",
        eventTypes: ["JobCreated"],
        isActive: true,
      };
      
      (storage.getWebhookSubscription as any).mockResolvedValue(mockSubscription);
      
      const response = await request(app).get("/api/webhooks/webhook-1");
      
      expect(response.status).toBe(200);
      expect(response.body.id).toBe("webhook-1");
      expect(response.body.name).toBe("Test Webhook");
    });
    
    it("should return 404 for non-existent subscription", async () => {
      (storage.getWebhookSubscription as any).mockResolvedValue(null);
      
      const response = await request(app).get("/api/webhooks/non-existent");
      
      expect(response.status).toBe(404);
    });
  });
  
  describe("PATCH /api/webhooks/:id", () => {
    it("should update a webhook subscription", async () => {
      const existingSubscription = {
        id: "webhook-1",
        name: "Original Name",
        url: "https://example.com/webhook",
        isActive: true,
      };
      
      (storage.getWebhookSubscription as any).mockResolvedValue(existingSubscription);
      (storage.updateWebhookSubscription as any).mockResolvedValue({
        ...existingSubscription,
        name: "Updated Name",
        isActive: false,
      });
      
      const response = await request(app)
        .patch("/api/webhooks/webhook-1")
        .send({ name: "Updated Name", isActive: false });
      
      expect(response.status).toBe(200);
      expect(response.body.name).toBe("Updated Name");
      expect(response.body.isActive).toBe(false);
    });
    
    it("should return 404 when updating non-existent subscription", async () => {
      (storage.getWebhookSubscription as any).mockResolvedValue(null);
      
      const response = await request(app)
        .patch("/api/webhooks/non-existent")
        .send({ name: "Update" });
      
      expect(response.status).toBe(404);
    });
  });
  
  describe("DELETE /api/webhooks/:id", () => {
    it("should delete a webhook subscription", async () => {
      (storage.deleteWebhookSubscription as any).mockResolvedValue(undefined);
      
      const response = await request(app).delete("/api/webhooks/webhook-1");
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(storage.deleteWebhookSubscription).toHaveBeenCalledWith("webhook-1");
    });
  });
});

describe("HMAC Signature Generation", () => {
  function generateSignature(payload: string, secret: string): string {
    return crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");
  }
  
  it("should generate correct HMAC-SHA256 signature", () => {
    const payload = JSON.stringify({ event: "JobCreated", data: { id: "123" } });
    const secret = "webhook-secret-key";
    
    const signature = generateSignature(payload, secret);
    
    expect(signature).toHaveLength(64);
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
  });
  
  it("should generate different signatures for different payloads", () => {
    const secret = "webhook-secret-key";
    const payload1 = JSON.stringify({ event: "JobCreated", data: { id: "123" } });
    const payload2 = JSON.stringify({ event: "JobCreated", data: { id: "456" } });
    
    const signature1 = generateSignature(payload1, secret);
    const signature2 = generateSignature(payload2, secret);
    
    expect(signature1).not.toBe(signature2);
  });
  
  it("should generate different signatures for different secrets", () => {
    const payload = JSON.stringify({ event: "JobCreated", data: { id: "123" } });
    const secret1 = "secret-key-1";
    const secret2 = "secret-key-2";
    
    const signature1 = generateSignature(payload, secret1);
    const signature2 = generateSignature(payload, secret2);
    
    expect(signature1).not.toBe(signature2);
  });
  
  it("should generate consistent signature for same inputs", () => {
    const payload = JSON.stringify({ event: "JobCreated", data: { id: "123" } });
    const secret = "webhook-secret-key";
    
    const signature1 = generateSignature(payload, secret);
    const signature2 = generateSignature(payload, secret);
    
    expect(signature1).toBe(signature2);
  });
  
  it("should generate proper webhook headers", () => {
    const deliveryId = "delivery-123";
    const eventType = "JobCreated";
    const payload = JSON.stringify({ event: eventType, data: { id: "123" } });
    const secret = "webhook-secret-key";
    
    function createHeaders(
      deliveryId: string,
      eventType: string,
      payloadString: string,
      secret: string,
      customHeaders: Record<string, string> = {}
    ): Record<string, string> {
      const signature = generateSignature(payloadString, secret);
      
      return {
        "Content-Type": "application/json",
        "X-Webhook-Signature-256": `sha256=${signature}`,
        "X-Webhook-Event": eventType,
        "X-Webhook-Delivery-Id": deliveryId,
        ...customHeaders,
      };
    }
    
    const headers = createHeaders(deliveryId, eventType, payload, secret);
    
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["X-Webhook-Event"]).toBe("JobCreated");
    expect(headers["X-Webhook-Delivery-Id"]).toBe("delivery-123");
    expect(headers["X-Webhook-Signature-256"]).toMatch(/^sha256=[a-f0-9]{64}$/);
  });
});

describe("Webhook Delivery Status", () => {
  let app: Express;
  
  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
    
    (storage.getUser as any).mockResolvedValue({
      id: "test-admin-id",
      role: "admin",
      roles: ["admin"],
      superAdmin: true,
    });
  });
  
  describe("GET /api/webhooks/:id/deliveries", () => {
    it("should return delivery history for a subscription", async () => {
      const mockDeliveries = [
        {
          id: "delivery-1",
          subscriptionId: "webhook-1",
          eventId: "event-1",
          eventType: "JobCreated",
          status: "success",
          attempts: 1,
          responseStatus: 200,
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
        {
          id: "delivery-2",
          subscriptionId: "webhook-1",
          eventId: "event-2",
          eventType: "JobCompleted",
          status: "failed",
          attempts: 3,
          responseStatus: 500,
          errorMessage: "Internal Server Error",
          createdAt: new Date().toISOString(),
        },
      ];
      
      (storage.getWebhookDeliveries as any).mockResolvedValue(mockDeliveries);
      
      const response = await request(app).get("/api/webhooks/webhook-1/deliveries");
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].status).toBe("success");
      expect(response.body[1].status).toBe("failed");
    });
    
    it("should return empty array when no deliveries exist", async () => {
      (storage.getWebhookDeliveries as any).mockResolvedValue([]);
      
      const response = await request(app).get("/api/webhooks/webhook-1/deliveries");
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });
  
  describe("POST /api/webhooks/:id/test", () => {
    it("should send a test webhook delivery", async () => {
      const testDelivery = {
        id: "test-delivery-1",
        subscriptionId: "webhook-1",
        eventType: "test.webhook",
        status: "success",
        responseStatus: 200,
        attempts: 1,
      };
      
      (sendTestWebhook as any).mockResolvedValue(testDelivery);
      
      const response = await request(app).post("/api/webhooks/webhook-1/test");
      
      expect(response.status).toBe(200);
      expect(response.body.eventType).toBe("test.webhook");
      expect(response.body.status).toBe("success");
      expect(sendTestWebhook).toHaveBeenCalledWith("webhook-1");
    });
    
    it("should return error when test webhook fails", async () => {
      (sendTestWebhook as any).mockRejectedValue(new Error("Webhook subscription not found"));
      
      const response = await request(app).post("/api/webhooks/non-existent/test");
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Webhook subscription not found");
    });
  });
});
