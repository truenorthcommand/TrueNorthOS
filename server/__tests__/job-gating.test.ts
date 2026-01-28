import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

vi.mock("../storage", () => ({
  storage: {
    getUser: vi.fn(),
    getJob: vi.fn(),
    updateJob: vi.fn(),
    signOffJob: vi.fn(),
    getExceptions: vi.fn(),
    getException: vi.fn(),
    updateException: vi.fn(),
  },
}));

vi.mock("../events", () => ({
  emitEvent: vi.fn(),
}));

vi.mock("../notifications", () => ({
  notifyUser: vi.fn(),
  notifyAdmins: vi.fn(),
}));

import { storage } from "../storage";
import { emitEvent } from "../events";

function createTestApp() {
  const app = express();
  app.use(express.json());
  
  app.use((req, res, next) => {
    (req as any).session = {
      userId: "test-engineer-id",
      userRole: "engineer",
    };
    next();
  });
  
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    next();
  };
  
  app.post("/api/jobs/:id/sign-off", requireAuth, async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      const blockingExceptions = await storage.getExceptions({
        entityType: "job",
        entityId: req.params.id,
        type: "job_blocked",
        status: "open",
      });
      
      if (blockingExceptions.length > 0) {
        return res.status(400).json({
          error: "Cannot sign off job with blocking exceptions",
          blockingReasons: blockingExceptions.map((e: any) => e.message || e.title),
        });
      }
      
      const photos = (job.photos as any[]) || [];
      if (photos.length === 0) {
        return res.status(400).json({ error: "At least one evidence photo is required before sign-off" });
      }
      
      const signatures = (job.signatures as any[]) || [];
      const hasEngineerSig = signatures.some((s: any) => s.type === "engineer");
      const hasCustomerSig = signatures.some((s: any) => s.type === "customer");
      
      if (!hasEngineerSig || !hasCustomerSig) {
        return res.status(400).json({
          error: "Both engineer and customer signatures are required before sign-off",
        });
      }
      
      const signedOffJob = await storage.signOffJob(req.params.id);
      
      await emitEvent("JobSignedOff", {
        jobId: job.id,
        jobNo: job.jobNo,
        signedOffAt: new Date().toISOString(),
      });
      
      res.json(signedOffJob);
    } catch (error) {
      res.status(500).json({ error: "Failed to sign off job" });
    }
  });
  
  app.get("/api/jobs/:id/blocking-exceptions", requireAuth, async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      const blockingExceptions = await storage.getExceptions({
        entityType: "job",
        entityId: req.params.id,
        type: "job_blocked",
        status: "open",
      });
      
      res.json(blockingExceptions);
    } catch (error) {
      res.status(500).json({ error: "Failed to get blocking exceptions" });
    }
  });
  
  app.get("/api/exceptions", requireAuth, async (req, res) => {
    try {
      const { entityType, entityId, type, status, severity } = req.query;
      const filters: any = {};
      
      if (entityType) filters.entityType = entityType;
      if (entityId) filters.entityId = entityId;
      if (type) filters.type = type;
      if (status) filters.status = status;
      if (severity) filters.severity = severity;
      
      const exceptions = await storage.getExceptions(filters);
      res.json(exceptions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch exceptions" });
    }
  });
  
  app.post("/api/exceptions/:id/resolve", requireAuth, async (req, res) => {
    try {
      const { resolutionNotes } = req.body;
      
      const updated = await storage.updateException(req.params.id, {
        status: "resolved",
        resolvedById: (req as any).session.userId,
        resolvedAt: new Date(),
        resolutionNotes,
      });
      
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to resolve exception" });
    }
  });
  
  return app;
}

describe("Job Gating - Blocking Exceptions", () => {
  let app: Express;
  
  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
    
    (storage.getUser as any).mockResolvedValue({
      id: "test-engineer-id",
      username: "engineer",
      name: "Test Engineer",
      role: "engineer",
      roles: ["engineer"],
    });
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe("POST /api/jobs/:id/sign-off", () => {
    const validJob = {
      id: "job-123",
      jobNo: "JOB-001",
      customerName: "Test Customer",
      status: "In Progress",
      photos: [{ id: "photo-1", url: "/photos/1.jpg", source: "engineer" }],
      signatures: [
        { id: "sig-1", type: "engineer", name: "Engineer", url: "/sigs/1.png" },
        { id: "sig-2", type: "customer", name: "Customer", url: "/sigs/2.png" },
      ],
    };
    
    it("should prevent sign-off when blocking exceptions exist", async () => {
      (storage.getJob as any).mockResolvedValue(validJob);
      
      const blockingExceptions = [
        {
          id: "exc-1",
          type: "job_blocked",
          severity: "warning",
          title: "Job closure blocked",
          message: "Missing safety documentation",
          entityType: "job",
          entityId: "job-123",
          status: "open",
        },
        {
          id: "exc-2",
          type: "job_blocked",
          severity: "warning",
          title: "Job closure blocked",
          message: "Awaiting supervisor approval",
          entityType: "job",
          entityId: "job-123",
          status: "open",
        },
      ];
      
      (storage.getExceptions as any).mockResolvedValue(blockingExceptions);
      
      const response = await request(app)
        .post("/api/jobs/job-123/sign-off")
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Cannot sign off job with blocking exceptions");
      expect(response.body.blockingReasons).toHaveLength(2);
      expect(response.body.blockingReasons).toContain("Missing safety documentation");
      expect(response.body.blockingReasons).toContain("Awaiting supervisor approval");
      expect(storage.signOffJob).not.toHaveBeenCalled();
    });
    
    it("should succeed when no blocking exceptions exist", async () => {
      (storage.getJob as any).mockResolvedValue(validJob);
      (storage.getExceptions as any).mockResolvedValue([]);
      (storage.signOffJob as any).mockResolvedValue({
        ...validJob,
        status: "Signed Off",
        signOffTimestamp: new Date(),
      });
      
      const response = await request(app)
        .post("/api/jobs/job-123/sign-off")
        .send({});
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe("Signed Off");
      expect(storage.signOffJob).toHaveBeenCalledWith("job-123");
      expect(emitEvent).toHaveBeenCalledWith("JobSignedOff", expect.any(Object));
    });
    
    it("should succeed when exceptions exist but are resolved", async () => {
      (storage.getJob as any).mockResolvedValue(validJob);
      (storage.getExceptions as any).mockResolvedValue([]);
      (storage.signOffJob as any).mockResolvedValue({
        ...validJob,
        status: "Signed Off",
      });
      
      const response = await request(app)
        .post("/api/jobs/job-123/sign-off")
        .send({});
      
      expect(response.status).toBe(200);
      expect(storage.signOffJob).toHaveBeenCalled();
    });
    
    it("should return 404 for non-existent job", async () => {
      (storage.getJob as any).mockResolvedValue(null);
      
      const response = await request(app)
        .post("/api/jobs/non-existent/sign-off")
        .send({});
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Job not found");
    });
    
    it("should require photos before sign-off", async () => {
      const jobWithoutPhotos = { ...validJob, photos: [] };
      (storage.getJob as any).mockResolvedValue(jobWithoutPhotos);
      (storage.getExceptions as any).mockResolvedValue([]);
      
      const response = await request(app)
        .post("/api/jobs/job-123/sign-off")
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain("photo");
    });
    
    it("should require both signatures before sign-off", async () => {
      const jobWithoutSignatures = { ...validJob, signatures: [] };
      (storage.getJob as any).mockResolvedValue(jobWithoutSignatures);
      (storage.getExceptions as any).mockResolvedValue([]);
      
      const response = await request(app)
        .post("/api/jobs/job-123/sign-off")
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain("signature");
    });
  });
  
  describe("GET /api/jobs/:id/blocking-exceptions", () => {
    it("should return blocking exceptions for a job", async () => {
      const job = { id: "job-123", jobNo: "JOB-001" };
      const blockingExceptions = [
        {
          id: "exc-1",
          type: "job_blocked",
          severity: "warning",
          title: "Job closure blocked",
          message: "Missing documentation",
          entityType: "job",
          entityId: "job-123",
          status: "open",
        },
      ];
      
      (storage.getJob as any).mockResolvedValue(job);
      (storage.getExceptions as any).mockResolvedValue(blockingExceptions);
      
      const response = await request(app).get("/api/jobs/job-123/blocking-exceptions");
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].type).toBe("job_blocked");
      expect(response.body[0].message).toBe("Missing documentation");
      expect(storage.getExceptions).toHaveBeenCalledWith({
        entityType: "job",
        entityId: "job-123",
        type: "job_blocked",
        status: "open",
      });
    });
    
    it("should return empty array when no blocking exceptions", async () => {
      const job = { id: "job-123", jobNo: "JOB-001" };
      
      (storage.getJob as any).mockResolvedValue(job);
      (storage.getExceptions as any).mockResolvedValue([]);
      
      const response = await request(app).get("/api/jobs/job-123/blocking-exceptions");
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
    
    it("should return 404 for non-existent job", async () => {
      (storage.getJob as any).mockResolvedValue(null);
      
      const response = await request(app).get("/api/jobs/non-existent/blocking-exceptions");
      
      expect(response.status).toBe(404);
    });
  });
  
  describe("Exception Resolution", () => {
    it("should resolve blocking exception allowing sign-off", async () => {
      const resolvedAt = new Date();
      const resolutionNotes = "Documentation uploaded and verified";
      
      (storage.updateException as any).mockResolvedValue({
        id: "exc-1",
        type: "job_blocked",
        status: "resolved",
        resolvedById: "test-engineer-id",
        resolvedAt,
        resolutionNotes,
      });
      
      const response = await request(app)
        .post("/api/exceptions/exc-1/resolve")
        .send({ resolutionNotes });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe("resolved");
      expect(response.body.resolutionNotes).toBe(resolutionNotes);
      expect(storage.updateException).toHaveBeenCalledWith("exc-1", expect.objectContaining({
        status: "resolved",
        resolvedById: "test-engineer-id",
        resolutionNotes,
      }));
    });
  });
});

describe("Exception API", () => {
  let app: Express;
  
  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
    
    (storage.getUser as any).mockResolvedValue({
      id: "test-user-id",
      role: "admin",
      roles: ["admin"],
    });
  });
  
  describe("GET /api/exceptions", () => {
    it("should return all exceptions with no filters", async () => {
      const mockExceptions = [
        {
          id: "exc-1",
          type: "job_blocked",
          severity: "warning",
          title: "Test Exception 1",
          status: "open",
        },
        {
          id: "exc-2",
          type: "workflow_failed",
          severity: "error",
          title: "Test Exception 2",
          status: "resolved",
        },
      ];
      
      (storage.getExceptions as any).mockResolvedValue(mockExceptions);
      
      const response = await request(app).get("/api/exceptions");
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });
    
    it("should filter exceptions by type", async () => {
      const blockingExceptions = [
        {
          id: "exc-1",
          type: "job_blocked",
          severity: "warning",
          title: "Blocked Exception",
          status: "open",
        },
      ];
      
      (storage.getExceptions as any).mockResolvedValue(blockingExceptions);
      
      const response = await request(app).get("/api/exceptions?type=job_blocked");
      
      expect(response.status).toBe(200);
      expect(storage.getExceptions).toHaveBeenCalledWith(expect.objectContaining({
        type: "job_blocked",
      }));
    });
    
    it("should filter exceptions by status", async () => {
      (storage.getExceptions as any).mockResolvedValue([]);
      
      const response = await request(app).get("/api/exceptions?status=open");
      
      expect(response.status).toBe(200);
      expect(storage.getExceptions).toHaveBeenCalledWith(expect.objectContaining({
        status: "open",
      }));
    });
    
    it("should filter exceptions by entity", async () => {
      (storage.getExceptions as any).mockResolvedValue([]);
      
      const response = await request(app).get("/api/exceptions?entityType=job&entityId=job-123");
      
      expect(response.status).toBe(200);
      expect(storage.getExceptions).toHaveBeenCalledWith(expect.objectContaining({
        entityType: "job",
        entityId: "job-123",
      }));
    });
    
    it("should filter exceptions by severity", async () => {
      (storage.getExceptions as any).mockResolvedValue([]);
      
      const response = await request(app).get("/api/exceptions?severity=error");
      
      expect(response.status).toBe(200);
      expect(storage.getExceptions).toHaveBeenCalledWith(expect.objectContaining({
        severity: "error",
      }));
    });
  });
});

describe("Job Gating Integration Flow", () => {
  let app: Express;
  
  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
    
    (storage.getUser as any).mockResolvedValue({
      id: "test-engineer-id",
      role: "engineer",
      roles: ["engineer"],
    });
  });
  
  it("should complete full gating flow: block -> resolve -> sign-off", async () => {
    const job = {
      id: "job-123",
      jobNo: "JOB-001",
      customerName: "Test Customer",
      status: "In Progress",
      photos: [{ id: "photo-1", url: "/photos/1.jpg", source: "engineer" }],
      signatures: [
        { id: "sig-1", type: "engineer", name: "Engineer", url: "/sigs/1.png" },
        { id: "sig-2", type: "customer", name: "Customer", url: "/sigs/2.png" },
      ],
    };
    
    (storage.getJob as any).mockResolvedValue(job);
    
    (storage.getExceptions as any).mockResolvedValueOnce([
      {
        id: "exc-1",
        type: "job_blocked",
        severity: "warning",
        title: "Job closure blocked",
        message: "Safety checklist incomplete",
        entityType: "job",
        entityId: "job-123",
        status: "open",
      },
    ]);
    
    const blockedResponse = await request(app)
      .post("/api/jobs/job-123/sign-off")
      .send({});
    
    expect(blockedResponse.status).toBe(400);
    expect(blockedResponse.body.error).toBe("Cannot sign off job with blocking exceptions");
    
    (storage.updateException as any).mockResolvedValue({
      id: "exc-1",
      status: "resolved",
      resolvedById: "test-engineer-id",
      resolutionNotes: "Checklist completed",
    });
    
    const resolveResponse = await request(app)
      .post("/api/exceptions/exc-1/resolve")
      .send({ resolutionNotes: "Checklist completed" });
    
    expect(resolveResponse.status).toBe(200);
    expect(resolveResponse.body.status).toBe("resolved");
    
    (storage.getExceptions as any).mockResolvedValueOnce([]);
    (storage.signOffJob as any).mockResolvedValue({
      ...job,
      status: "Signed Off",
      signOffTimestamp: new Date(),
    });
    
    const signOffResponse = await request(app)
      .post("/api/jobs/job-123/sign-off")
      .send({});
    
    expect(signOffResponse.status).toBe(200);
    expect(signOffResponse.body.status).toBe("Signed Off");
    expect(storage.signOffJob).toHaveBeenCalledWith("job-123");
  });
});
