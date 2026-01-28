import express, { type Express, type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { vi } from "vitest";

let testApp: Express;

export function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  
  let mockSession: Record<string, any> = {};
  
  app.use((req: Request, res: Response, next: NextFunction) => {
    (req as any).session = {
      ...mockSession,
      destroy: (callback: (err?: any) => void) => {
        mockSession = {};
        callback();
      },
      save: (callback: (err?: any) => void) => {
        if (callback) callback();
      },
    };
    next();
  });
  
  return app;
}

export function getTestApp(): Express {
  if (!testApp) {
    testApp = createTestApp();
  }
  return testApp;
}

export interface MockUser {
  id: string;
  username: string;
  name: string;
  role: string;
  roles: string[];
  superAdmin?: boolean;
  hasDirectorsSuite?: boolean;
}

export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "test-user-id",
    username: "testuser",
    name: "Test User",
    role: "admin",
    roles: ["admin"],
    superAdmin: false,
    hasDirectorsSuite: false,
    ...overrides,
  };
}

export function createAuthMiddleware(user: MockUser) {
  return (req: Request, res: Response, next: NextFunction) => {
    (req as any).session = {
      userId: user.id,
      userRole: user.role,
      destroy: (callback: (err?: any) => void) => callback(),
      save: (callback: (err?: any) => void) => callback && callback(),
    };
    next();
  };
}

export function createTestRequest(app: Express) {
  return request(app);
}

export const mockStorage = {
  getUser: vi.fn(),
  getUserByUsername: vi.fn(),
  createUser: vi.fn(),
  getAllUsers: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  
  getJob: vi.fn(),
  getAllJobs: vi.fn(),
  getJobsByEngineer: vi.fn(),
  createJob: vi.fn(),
  updateJob: vi.fn(),
  deleteJob: vi.fn(),
  signOffJob: vi.fn(),
  
  getWorkflowRulesByTrigger: vi.fn(),
  getWorkflowRule: vi.fn(),
  getAllWorkflowRules: vi.fn(),
  createWorkflowRule: vi.fn(),
  updateWorkflowRule: vi.fn(),
  deleteWorkflowRule: vi.fn(),
  
  createWorkflowExecution: vi.fn(),
  updateWorkflowExecution: vi.fn(),
  getWorkflowExecutions: vi.fn(),
  
  createWorkflowLog: vi.fn(),
  updateWorkflowLog: vi.fn(),
  
  getWebhookSubscriptions: vi.fn(),
  getWebhookSubscription: vi.fn(),
  createWebhookSubscription: vi.fn(),
  updateWebhookSubscription: vi.fn(),
  deleteWebhookSubscription: vi.fn(),
  getWebhookDeliveries: vi.fn(),
  
  getExceptions: vi.fn(),
  getException: vi.fn(),
  createException: vi.fn(),
  updateException: vi.fn(),
  
  getClient: vi.fn(),
  getQuote: vi.fn(),
  createInvoice: vi.fn(),
  updateQuote: vi.fn(),
  getNextInvoiceNumber: vi.fn(),
};

export function resetMocks() {
  Object.values(mockStorage).forEach((mock) => {
    if (typeof mock.mockReset === "function") {
      mock.mockReset();
    }
  });
}

export function setupDefaultMocks() {
  const adminUser = createMockUser({ 
    id: "admin-1", 
    role: "admin", 
    roles: ["admin"],
    superAdmin: true 
  });
  
  mockStorage.getUser.mockResolvedValue(adminUser);
  mockStorage.getAllUsers.mockResolvedValue([adminUser]);
  mockStorage.getAllJobs.mockResolvedValue([]);
  mockStorage.getAllWorkflowRules.mockResolvedValue([]);
  mockStorage.getWorkflowExecutions.mockResolvedValue([]);
  mockStorage.getWebhookSubscriptions.mockResolvedValue([]);
  mockStorage.getExceptions.mockResolvedValue([]);
}

export { vi, request };
