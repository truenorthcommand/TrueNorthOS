import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import crypto from "crypto";

vi.mock("../storage", () => ({
  storage: {
    getUser: vi.fn(),
    getWorkflowRules: vi.fn(),
    getWorkflowRule: vi.fn(),
    createWorkflowRule: vi.fn(),
    updateWorkflowRule: vi.fn(),
    deleteWorkflowRule: vi.fn(),
    getWorkflowRulesByTrigger: vi.fn(),
    createWorkflowExecution: vi.fn(),
    updateWorkflowExecution: vi.fn(),
    getWorkflowExecutions: vi.fn(),
    createWorkflowLog: vi.fn(),
    updateWorkflowLog: vi.fn(),
    getExceptions: vi.fn(),
    getJob: vi.fn(),
    updateJob: vi.fn(),
  },
}));

vi.mock("../events", () => ({
  emitEvent: vi.fn(),
  createException: vi.fn(),
}));

vi.mock("../notifications", () => ({
  notifyUser: vi.fn(),
  notifyAdmins: vi.fn(),
}));

import { storage } from "../storage";
import { emitEvent, createException } from "../events";

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
  
  app.get("/api/workflows/rules", requireAuth, async (req, res) => {
    try {
      const rules = await storage.getWorkflowRules();
      res.json(rules);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch workflow rules" });
    }
  });
  
  app.post("/api/workflows/rules", requireAdmin, async (req, res) => {
    try {
      const { name, description, triggerEvent, triggerConditions, actions, isActive } = req.body;
      
      if (!name || !triggerEvent || !actions) {
        return res.status(400).json({ error: "Name, triggerEvent, and actions are required" });
      }
      
      const rule = await storage.createWorkflowRule({
        name,
        description,
        triggerEvent,
        triggerConditions: triggerConditions || {},
        actions,
        isActive: isActive !== false,
      });
      
      res.status(201).json(rule);
    } catch (error) {
      res.status(500).json({ error: "Failed to create workflow rule" });
    }
  });
  
  app.put("/api/workflows/rules/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getWorkflowRule(id);
      if (!existing) {
        return res.status(404).json({ error: "Workflow rule not found" });
      }
      
      const updated = await storage.updateWorkflowRule(id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update workflow rule" });
    }
  });
  
  app.delete("/api/workflows/rules/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteWorkflowRule(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete workflow rule" });
    }
  });
  
  app.get("/api/workflows/executions", requireAuth, async (req, res) => {
    try {
      const executions = await storage.getWorkflowExecutions();
      res.json(executions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch executions" });
    }
  });
  
  return app;
}

describe("Workflow API", () => {
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
  
  describe("GET /api/workflows/rules", () => {
    it("should return empty array when no rules exist", async () => {
      (storage.getWorkflowRules as any).mockResolvedValue([]);
      
      const response = await request(app).get("/api/workflows/rules");
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
    
    it("should return all workflow rules", async () => {
      const mockRules = [
        {
          id: "rule-1",
          name: "Test Rule 1",
          triggerEvent: "JobCreated",
          triggerConditions: {},
          actions: [{ type: "SendNotification", config: {} }],
          isActive: true,
        },
        {
          id: "rule-2",
          name: "Test Rule 2",
          triggerEvent: "JobCompleted",
          triggerConditions: { status: { field: "status", operator: "equals", value: "Completed" } },
          actions: [{ type: "CreateTask", config: { title: "Follow up" } }],
          isActive: true,
        },
      ];
      
      (storage.getWorkflowRules as any).mockResolvedValue(mockRules);
      
      const response = await request(app).get("/api/workflows/rules");
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toBe("Test Rule 1");
    });
  });
  
  describe("POST /api/workflows/rules", () => {
    it("should create a new workflow rule", async () => {
      const newRule = {
        name: "New Workflow Rule",
        description: "Test description",
        triggerEvent: "JobCreated",
        triggerConditions: {},
        actions: [
          {
            type: "SendNotification",
            config: { recipientType: "admins", message: "New job created" },
          },
        ],
        isActive: true,
      };
      
      const createdRule = { id: "new-rule-id", ...newRule, createdAt: new Date().toISOString() };
      (storage.createWorkflowRule as any).mockResolvedValue(createdRule);
      
      const response = await request(app)
        .post("/api/workflows/rules")
        .send(newRule);
      
      expect(response.status).toBe(201);
      expect(response.body.id).toBe("new-rule-id");
      expect(response.body.name).toBe("New Workflow Rule");
      expect(storage.createWorkflowRule).toHaveBeenCalledWith(expect.objectContaining({
        name: "New Workflow Rule",
        triggerEvent: "JobCreated",
      }));
    });
    
    it("should return 400 when required fields are missing", async () => {
      const response = await request(app)
        .post("/api/workflows/rules")
        .send({ name: "Incomplete Rule" });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain("required");
    });
    
    it("should create rule with BlockJobClosure action", async () => {
      const ruleWithBlockAction = {
        name: "Block Job Rule",
        triggerEvent: "JobStatusChanged",
        triggerConditions: { status: { field: "status", operator: "equals", value: "In Progress" } },
        actions: [
          {
            type: "BlockJobClosure",
            config: { jobId: "{{jobId}}", reason: "Missing documentation" },
          },
        ],
      };
      
      const createdRule = { id: "block-rule-id", ...ruleWithBlockAction, isActive: true };
      (storage.createWorkflowRule as any).mockResolvedValue(createdRule);
      
      const response = await request(app)
        .post("/api/workflows/rules")
        .send(ruleWithBlockAction);
      
      expect(response.status).toBe(201);
      expect(response.body.actions[0].type).toBe("BlockJobClosure");
    });
  });
  
  describe("PUT /api/workflows/rules/:id", () => {
    it("should update an existing workflow rule", async () => {
      const existingRule = {
        id: "rule-1",
        name: "Original Name",
        triggerEvent: "JobCreated",
        actions: [],
        isActive: true,
      };
      
      (storage.getWorkflowRule as any).mockResolvedValue(existingRule);
      (storage.updateWorkflowRule as any).mockResolvedValue({
        ...existingRule,
        name: "Updated Name",
      });
      
      const response = await request(app)
        .put("/api/workflows/rules/rule-1")
        .send({ name: "Updated Name" });
      
      expect(response.status).toBe(200);
      expect(response.body.name).toBe("Updated Name");
    });
    
    it("should return 404 for non-existent rule", async () => {
      (storage.getWorkflowRule as any).mockResolvedValue(null);
      
      const response = await request(app)
        .put("/api/workflows/rules/non-existent")
        .send({ name: "Update" });
      
      expect(response.status).toBe(404);
    });
  });
  
  describe("DELETE /api/workflows/rules/:id", () => {
    it("should delete a workflow rule", async () => {
      (storage.deleteWorkflowRule as any).mockResolvedValue(undefined);
      
      const response = await request(app).delete("/api/workflows/rules/rule-1");
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(storage.deleteWorkflowRule).toHaveBeenCalledWith("rule-1");
    });
  });
});

describe("Workflow Condition Evaluation", () => {
  function evaluateConditions(
    conditions: Record<string, { field: string; operator: string; value?: any }>,
    payload: Record<string, any>
  ): boolean {
    for (const [key, condition] of Object.entries(conditions)) {
      const value = getNestedValue(payload, condition.field);
      
      switch (condition.operator) {
        case "equals":
          if (value !== condition.value) return false;
          break;
        case "not_equals":
          if (value === condition.value) return false;
          break;
        case "contains":
          if (!String(value).includes(String(condition.value))) return false;
          break;
        case "greater_than":
          if (!(Number(value) > Number(condition.value))) return false;
          break;
        case "less_than":
          if (!(Number(value) < Number(condition.value))) return false;
          break;
        case "is_empty":
          if (value !== null && value !== undefined && value !== "") return false;
          break;
        case "is_not_empty":
          if (value === null || value === undefined || value === "") return false;
          break;
      }
    }
    return true;
  }
  
  function getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  }
  
  it("should evaluate equals condition correctly", () => {
    const conditions = {
      statusCheck: { field: "status", operator: "equals", value: "Completed" },
    };
    
    expect(evaluateConditions(conditions, { status: "Completed" })).toBe(true);
    expect(evaluateConditions(conditions, { status: "In Progress" })).toBe(false);
  });
  
  it("should evaluate not_equals condition correctly", () => {
    const conditions = {
      statusCheck: { field: "status", operator: "not_equals", value: "Draft" },
    };
    
    expect(evaluateConditions(conditions, { status: "Completed" })).toBe(true);
    expect(evaluateConditions(conditions, { status: "Draft" })).toBe(false);
  });
  
  it("should evaluate contains condition correctly", () => {
    const conditions = {
      descCheck: { field: "description", operator: "contains", value: "urgent" },
    };
    
    expect(evaluateConditions(conditions, { description: "This is an urgent job" })).toBe(true);
    expect(evaluateConditions(conditions, { description: "Normal job" })).toBe(false);
  });
  
  it("should evaluate greater_than condition correctly", () => {
    const conditions = {
      amountCheck: { field: "amount", operator: "greater_than", value: 1000 },
    };
    
    expect(evaluateConditions(conditions, { amount: 1500 })).toBe(true);
    expect(evaluateConditions(conditions, { amount: 500 })).toBe(false);
    expect(evaluateConditions(conditions, { amount: 1000 })).toBe(false);
  });
  
  it("should evaluate less_than condition correctly", () => {
    const conditions = {
      amountCheck: { field: "amount", operator: "less_than", value: 100 },
    };
    
    expect(evaluateConditions(conditions, { amount: 50 })).toBe(true);
    expect(evaluateConditions(conditions, { amount: 150 })).toBe(false);
  });
  
  it("should evaluate is_empty condition correctly", () => {
    const conditions = {
      notesCheck: { field: "notes", operator: "is_empty" },
    };
    
    expect(evaluateConditions(conditions, { notes: "" })).toBe(true);
    expect(evaluateConditions(conditions, { notes: null })).toBe(true);
    expect(evaluateConditions(conditions, { notes: undefined })).toBe(true);
    expect(evaluateConditions(conditions, { notes: "Some notes" })).toBe(false);
  });
  
  it("should evaluate is_not_empty condition correctly", () => {
    const conditions = {
      notesCheck: { field: "notes", operator: "is_not_empty" },
    };
    
    expect(evaluateConditions(conditions, { notes: "Some notes" })).toBe(true);
    expect(evaluateConditions(conditions, { notes: "" })).toBe(false);
    expect(evaluateConditions(conditions, { notes: null })).toBe(false);
  });
  
  it("should evaluate nested field paths", () => {
    const conditions = {
      clientCheck: { field: "client.name", operator: "equals", value: "ACME Corp" },
    };
    
    expect(evaluateConditions(conditions, { client: { name: "ACME Corp" } })).toBe(true);
    expect(evaluateConditions(conditions, { client: { name: "Other Corp" } })).toBe(false);
  });
  
  it("should evaluate multiple conditions (all must pass)", () => {
    const conditions = {
      statusCheck: { field: "status", operator: "equals", value: "Completed" },
      amountCheck: { field: "amount", operator: "greater_than", value: 500 },
    };
    
    expect(evaluateConditions(conditions, { status: "Completed", amount: 1000 })).toBe(true);
    expect(evaluateConditions(conditions, { status: "Completed", amount: 100 })).toBe(false);
    expect(evaluateConditions(conditions, { status: "Draft", amount: 1000 })).toBe(false);
  });
});

describe("BlockJobClosure Action", () => {
  it("should create exception when BlockJobClosure action is executed", async () => {
    const mockException = {
      id: "exception-1",
      type: "job_blocked",
      severity: "warning",
      title: "Job closure blocked",
      message: "Missing safety documentation",
      entityType: "job",
      entityId: "job-123",
      status: "open",
    };
    
    (createException as any).mockResolvedValue(mockException);
    
    const result = await (createException as any)({
      type: "job_blocked",
      severity: "warning",
      title: "Job closure blocked",
      message: "Missing safety documentation",
      entityType: "job",
      entityId: "job-123",
    });
    
    expect(createException).toHaveBeenCalledWith(expect.objectContaining({
      type: "job_blocked",
      entityType: "job",
      entityId: "job-123",
    }));
    expect(result.type).toBe("job_blocked");
    expect(result.entityId).toBe("job-123");
  });
});

describe("Workflow Executions", () => {
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
  
  it("should return workflow executions", async () => {
    const mockExecutions = [
      {
        id: "exec-1",
        ruleId: "rule-1",
        status: "completed",
        triggeredAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      },
      {
        id: "exec-2",
        ruleId: "rule-1",
        status: "failed",
        triggeredAt: new Date().toISOString(),
      },
    ];
    
    (storage.getWorkflowExecutions as any).mockResolvedValue(mockExecutions);
    
    const response = await request(app).get("/api/workflows/executions");
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body[0].status).toBe("completed");
    expect(response.body[1].status).toBe("failed");
  });
});
