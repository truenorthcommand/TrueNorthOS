import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { insertJobSchema } from "@shared/schema";
import { z } from "zod";

const SALT_ROUNDS = 10;

declare module "express-session" {
  interface SessionData {
    userId?: string;
    userRole?: string;
  }
}

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
};

const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (req.session.userRole !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.use(session({
    secret: process.env.SESSION_SECRET || 'promains-field-view-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    }
  }));

  // ==================== AUTH ROUTES (PUBLIC) ====================

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Check if password is hashed (starts with $2b$) or plain text (legacy)
      let isValidPassword = false;
      if (user.password.startsWith('$2b$')) {
        isValidPassword = await bcrypt.compare(password, user.password);
      } else {
        // Legacy plain-text password - for demo accounts
        isValidPassword = user.password === password;
      }

      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      req.session.userId = user.id;
      req.session.userRole = user.role;

      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        username: user.username,
      });
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        username: user.username,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // ==================== USER / ENGINEER ROUTES (PROTECTED) ====================
  
  app.get("/api/users", requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      res.json(allUsers.map(e => ({
        id: e.id,
        name: e.name,
        email: e.email,
        role: e.role,
        username: e.username,
        currentLat: e.currentLat,
        currentLng: e.currentLng,
        lastLocationUpdate: e.lastLocationUpdate,
      })));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Verify password for sensitive operations (staff page access)
  app.post("/api/auth/verify-password", requireAdmin, async (req, res) => {
    try {
      const { password } = req.body;
      const user = await storage.getUser(req.session.userId!);
      
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      let isValidPassword = false;
      if (user.password.startsWith('$2b$')) {
        isValidPassword = await bcrypt.compare(password, user.password);
      } else {
        isValidPassword = user.password === password;
      }

      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid password" });
      }

      res.json({ verified: true });
    } catch (error) {
      res.status(500).json({ error: "Verification failed" });
    }
  });

  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const { username, password, name, email, role } = req.body;
      
      if (!username || !password || !name || !email || !role) {
        return res.status(400).json({ error: "All fields are required" });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      if (!['admin', 'engineer'].includes(role)) {
        return res.status(400).json({ error: "Role must be 'admin' or 'engineer'" });
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }

      // Hash the password before storing
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

      const user = await storage.createUser({
        username,
        password: hashedPassword,
        name,
        email,
        role,
        status: 'active',
      });

      res.status(201).json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        username: user.username,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      if (req.params.id === req.session.userId) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }

      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      await storage.deleteUser(req.params.id);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  app.get("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        currentLat: user.currentLat,
        currentLng: user.currentLng,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.post("/api/users/:id/location", requireAuth, async (req, res) => {
    try {
      if (req.session.userId !== req.params.id && req.session.userRole !== 'admin') {
        return res.status(403).json({ error: "Cannot update another user's location" });
      }

      const { latitude, longitude, accuracy } = req.body;
      
      if (typeof latitude !== "number" || typeof longitude !== "number") {
        return res.status(400).json({ error: "Invalid coordinates" });
      }

      const user = await storage.updateEngineerLocation(req.params.id, latitude, longitude);
      
      await storage.addEngineerLocation({
        engineerId: req.params.id,
        latitude,
        longitude,
        accuracy,
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update location" });
    }
  });

  app.get("/api/users/:id/location-history", requireAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const history = await storage.getEngineerLocationHistory(req.params.id, limit);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch location history" });
    }
  });

  // ==================== JOB ROUTES (PROTECTED) ====================

  app.get("/api/jobs", requireAuth, async (req, res) => {
    try {
      const engineerId = req.query.engineerId as string;
      let jobsList;
      
      if (req.session.userRole === 'engineer') {
        jobsList = await storage.getJobsByEngineer(req.session.userId!);
      } else if (engineerId) {
        jobsList = await storage.getJobsByEngineer(engineerId);
      } else {
        jobsList = await storage.getAllJobs();
      }
      
      res.json(jobsList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });

  app.get("/api/jobs/:id", requireAuth, async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      if (req.session.userRole === 'engineer' && job.assignedToId !== req.session.userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      res.json(job);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch job" });
    }
  });

  app.post("/api/jobs", requireAuth, async (req, res) => {
    try {
      const data = insertJobSchema.parse(req.body);
      const job = await storage.createJob(data);
      res.status(201).json(job);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create job" });
    }
  });

  app.patch("/api/jobs/:id", requireAuth, async (req, res) => {
    try {
      const existingJob = await storage.getJob(req.params.id);
      if (!existingJob) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (req.session.userRole === 'engineer' && existingJob.assignedToId !== req.session.userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (existingJob.status === 'Signed Off') {
        return res.status(400).json({ error: "Cannot modify a signed-off job" });
      }

      const job = await storage.updateJob(req.params.id, req.body);
      res.json(job);
    } catch (error) {
      res.status(500).json({ error: "Failed to update job" });
    }
  });

  app.delete("/api/jobs/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteJob(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete job" });
    }
  });

  app.post("/api/jobs/:id/sign-off", requireAuth, async (req, res) => {
    try {
      const { signatures } = req.body;

      const existingJob = await storage.getJob(req.params.id);
      if (!existingJob) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (req.session.userRole === 'engineer' && existingJob.assignedToId !== req.session.userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (existingJob.status === 'Signed Off') {
        return res.status(400).json({ error: "Job is already signed off" });
      }

      const photos = existingJob.photos as any[] || [];
      if (photos.length === 0) {
        return res.status(400).json({ error: "At least one photo is required before sign-off" });
      }

      const allSignatures = signatures || existingJob.signatures || [];
      const hasEngineerSig = allSignatures.some((s: any) => s.type === 'engineer');
      const hasCustomerSig = allSignatures.some((s: any) => s.type === 'customer');

      if (!hasEngineerSig || !hasCustomerSig) {
        return res.status(400).json({ 
          error: "Both engineer and customer signatures are required before sign-off" 
        });
      }

      if (signatures) {
        await storage.updateJob(req.params.id, { signatures });
      }

      const job = await storage.signOffJob(req.params.id);

      res.json(job);
    } catch (error) {
      res.status(500).json({ error: "Failed to sign off job" });
    }
  });

  // ==================== SEED ROUTE (DEV ONLY) ====================

  app.post("/api/seed", async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: "Seed not available in production" });
    }

    try {
      const existingAdmin = await storage.getUserByUsername("admin");
      if (existingAdmin) {
        return res.json({ message: "Database already seeded" });
      }

      await storage.createUser({
        username: "admin",
        password: "admin123",
        name: "Dispatcher Dave",
        email: "admin@promains.com",
        role: "admin",
        status: "active",
      });

      await storage.createUser({
        username: "john",
        password: "john123",
        name: "John Smith",
        email: "john@promains.com",
        role: "engineer",
        status: "active",
      });

      await storage.createUser({
        username: "sarah",
        password: "sarah123",
        name: "Sarah Jones",
        email: "sarah@promains.com",
        role: "engineer",
        status: "active",
      });

      res.json({ message: "Database seeded successfully" });
    } catch (error) {
      console.error("Seed error:", error);
      res.status(500).json({ error: "Failed to seed database" });
    }
  });

  return httpServer;
}
