import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertJobSchema, insertUserSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // ==================== USER / ENGINEER ROUTES ====================
  
  app.get("/api/users", async (req, res) => {
    try {
      const engineers = await storage.getAllEngineers();
      res.json(engineers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      const user = await storage.createUser(data);
      res.status(201).json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  // Update engineer location
  app.post("/api/users/:id/location", async (req, res) => {
    try {
      const { latitude, longitude, accuracy } = req.body;
      
      if (typeof latitude !== "number" || typeof longitude !== "number") {
        return res.status(400).json({ error: "Invalid coordinates" });
      }

      // Update current location on user record
      const user = await storage.updateEngineerLocation(req.params.id, latitude, longitude);
      
      // Also log to location history
      await storage.addEngineerLocation({
        engineerId: req.params.id,
        latitude,
        longitude,
        accuracy,
      });

      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to update location" });
    }
  });

  app.get("/api/users/:id/location-history", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const history = await storage.getEngineerLocationHistory(req.params.id, limit);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch location history" });
    }
  });

  // ==================== JOB ROUTES ====================

  app.get("/api/jobs", async (req, res) => {
    try {
      const engineerId = req.query.engineerId as string;
      let jobsList;
      
      if (engineerId) {
        jobsList = await storage.getJobsByEngineer(engineerId);
      } else {
        jobsList = await storage.getAllJobs();
      }
      
      res.json(jobsList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });

  app.get("/api/jobs/:id", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch job" });
    }
  });

  app.post("/api/jobs", async (req, res) => {
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

  app.patch("/api/jobs/:id", async (req, res) => {
    try {
      const job = await storage.updateJob(req.params.id, req.body);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      res.status(500).json({ error: "Failed to update job" });
    }
  });

  app.delete("/api/jobs/:id", async (req, res) => {
    try {
      await storage.deleteJob(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete job" });
    }
  });

  // Sign off job with GPS location
  app.post("/api/jobs/:id/sign-off", async (req, res) => {
    try {
      const { latitude, longitude, address, signatures } = req.body;

      if (typeof latitude !== "number" || typeof longitude !== "number") {
        return res.status(400).json({ error: "GPS coordinates are required for sign-off" });
      }

      // First update signatures if provided
      if (signatures) {
        await storage.updateJob(req.params.id, { signatures });
      }

      // Then sign off with location
      const job = await storage.signOffJob(
        req.params.id,
        latitude,
        longitude,
        address || ""
      );

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      res.json(job);
    } catch (error) {
      res.status(500).json({ error: "Failed to sign off job" });
    }
  });

  // ==================== AUTH ROUTES ====================

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await storage.getUserByUsername(username);
      
      if (!user || user.password !== password) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

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

  // Seed initial users for testing
  app.post("/api/seed", async (req, res) => {
    try {
      // Check if users already exist
      const existingAdmin = await storage.getUserByUsername("admin");
      if (existingAdmin) {
        return res.json({ message: "Database already seeded" });
      }

      // Create admin
      await storage.createUser({
        username: "admin",
        password: "admin123",
        name: "Dispatcher Dave",
        email: "admin@promains.com",
        role: "admin",
        status: "active",
      });

      // Create engineers
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
