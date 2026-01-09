import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcrypt";
import crypto from "crypto";
import OpenAI from "openai";
import { TOTP, Secret } from "otpauth";
import QRCode from "qrcode";
import { storage } from "./storage";
import { pool } from "./db";
import { insertJobSchema, insertAiAdvisorSchema } from "@shared/schema";
import { z } from "zod";
import { notifyAdmins } from "./notifications";
import { sessionMiddleware } from "./session";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
function getOpenAIClient(): OpenAI | null {
  // First try Replit AI Integrations (preferred - no API key needed)
  if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
    return new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  // Fall back to standard OpenAI API key
  if (process.env.OPENAI_API_KEY) {
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return null;
}

const SALT_ROUNDS = 10;

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

const requireSuperAdmin = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user || !user.superAdmin) {
    return res.status(403).json({ error: "Super admin access required" });
  }
  next();
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Trust proxy for secure cookies behind Replit's reverse proxy
  app.set('trust proxy', 1);
  
  // Use shared session middleware (also used by WebSocket notifications)
  app.use(sessionMiddleware);

  // ==================== AUTH ROUTES (PUBLIC) ====================

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password, totpToken } = req.body;
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

      // Check if 2FA is enabled
      if (user.twoFactorEnabled && user.twoFactorSecret) {
        if (!totpToken) {
          return res.status(200).json({ 
            requiresTwoFactor: true,
            message: "Two-factor authentication required" 
          });
        }

        // Verify TOTP token using the stored base32 secret
        let totp: TOTP;
        try {
          totp = new TOTP({
            secret: Secret.fromBase32(user.twoFactorSecret),
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
          });
        } catch (secretError) {
          console.error('Invalid 2FA secret format:', secretError);
          return res.status(500).json({ error: "Two-factor authentication configuration error. Please contact support." });
        }

        const delta = totp.validate({ token: totpToken, window: 2 });
        if (delta === null) {
          return res.status(401).json({ error: "Invalid authentication code" });
        }
      }

      req.session.userId = user.id;
      req.session.userRole = user.role;

      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        username: user.username,
        superAdmin: user.superAdmin,
        twoFactorEnabled: user.twoFactorEnabled,
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

  app.get("/api/config/maps", requireAuth, (req, res) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    res.json({ apiKey });
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
        superAdmin: user.superAdmin,
        twoFactorEnabled: user.twoFactorEnabled,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // ==================== TWO-FACTOR AUTHENTICATION ====================

  app.post("/api/auth/2fa/setup", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (user.twoFactorEnabled) {
        return res.status(400).json({ error: "Two-factor authentication is already enabled" });
      }

      // Generate a random secret using otpauth's Secret class
      const secretObj = new Secret({ size: 20 });
      const secretBase32 = secretObj.base32;

      // Create TOTP instance
      const totp = new TOTP({
        issuer: 'TrueNorth Field View',
        label: user.username,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: secretObj,
      });

      // Generate QR code
      const otpauthUrl = totp.toString();
      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

      // Store secret in base32 format (will be activated after verification)
      await storage.updateUser(user.id, { twoFactorSecret: secretBase32 });

      res.json({
        secret: secretBase32,
        qrCode: qrCodeDataUrl,
        message: "Scan the QR code with your authenticator app, then verify with a code"
      });
    } catch (error) {
      console.error('2FA setup error:', error);
      res.status(500).json({ error: "Failed to set up two-factor authentication" });
    }
  });

  app.post("/api/auth/2fa/verify", requireAuth, async (req, res) => {
    try {
      const { token } = req.body;
      const user = await storage.getUser(req.session.userId!);
      
      if (!user || !user.twoFactorSecret) {
        return res.status(400).json({ error: "Two-factor setup not initiated" });
      }

      if (user.twoFactorEnabled) {
        return res.status(400).json({ error: "Two-factor authentication is already enabled" });
      }

      // Verify the token using the stored base32 secret
      let totp: TOTP;
      try {
        totp = new TOTP({
          secret: Secret.fromBase32(user.twoFactorSecret),
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
        });
      } catch (secretError) {
        console.error('Invalid 2FA secret format during verify:', secretError);
        await storage.updateUser(user.id, { twoFactorSecret: null });
        return res.status(400).json({ error: "Invalid 2FA setup. Please try setting up again." });
      }

      const delta = totp.validate({ token: token, window: 2 });

      if (delta === null) {
        return res.status(401).json({ error: "Invalid verification code" });
      }

      // Enable 2FA
      await storage.updateUser(user.id, { twoFactorEnabled: true });

      res.json({ 
        success: true, 
        message: "Two-factor authentication enabled successfully" 
      });
    } catch (error) {
      console.error('2FA verify error:', error);
      res.status(500).json({ error: "Failed to verify two-factor authentication" });
    }
  });

  app.post("/api/auth/2fa/disable", requireAuth, async (req, res) => {
    try {
      const { password } = req.body;
      const user = await storage.getUser(req.session.userId!);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!user.twoFactorEnabled) {
        return res.status(400).json({ error: "Two-factor authentication is not enabled" });
      }

      // Verify password before disabling 2FA
      let isValidPassword = false;
      if (user.password.startsWith('$2b$')) {
        isValidPassword = await bcrypt.compare(password, user.password);
      } else {
        isValidPassword = user.password === password;
      }

      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid password" });
      }

      // Disable 2FA
      await storage.updateUser(user.id, { 
        twoFactorEnabled: false, 
        twoFactorSecret: null 
      });

      res.json({ 
        success: true, 
        message: "Two-factor authentication disabled" 
      });
    } catch (error) {
      console.error('2FA disable error:', error);
      res.status(500).json({ error: "Failed to disable two-factor authentication" });
    }
  });

  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = await storage.getUser(req.session.userId!);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: "New password must be at least 8 characters" });
      }

      // Verify current password
      let isValidPassword = false;
      if (user.password.startsWith('$2b$')) {
        isValidPassword = await bcrypt.compare(currentPassword, user.password);
      } else {
        isValidPassword = user.password === currentPassword;
      }

      if (!isValidPassword) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      // Hash and save new password
      const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
      await storage.updateUser(user.id, { password: hashedPassword });

      res.json({ 
        success: true, 
        message: "Password changed successfully" 
      });
    } catch (error) {
      console.error('Password change error:', error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // ==================== GDPR DATA ROUTES ====================

  app.get("/api/user/export-data", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get user's jobs - only jobs primarily assigned to this user (not collaborative)
      const userJobs = await storage.getJobsByEngineer(userId);

      // Get user's messages - only messages SENT by this user
      // We strip all sender metadata to ensure no other user's data is exposed
      const conversations = await storage.getUserConversations(userId);
      const messagesData: { content: string; sentAt: Date | null }[] = [];
      for (const conv of conversations) {
        const messages = await storage.getMessages(conv.id);
        // Only include messages sent by this user - strip all identifying info
        const userMessages = messages
          .filter(m => m.senderId === userId)
          .map(m => ({
            content: m.content,
            sentAt: m.createdAt,
          }));
        messagesData.push(...userMessages);
      }

      // Get location history - only this user's locations
      const locationHistory = await storage.getEngineerLocationHistory(userId, 1000);

      // Prepare export data - only personal data belonging to the requesting user
      // No customer PII, no other engineer data
      const exportData = {
        exportDate: new Date().toISOString(),
        gdprNotice: "This file contains all personal data associated with your account as required by GDPR Article 15 (Right of Access).",
        personalInfo: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt,
          twoFactorEnabled: user.twoFactorEnabled,
        },
        jobsWorkedCount: userJobs.length,
        workCompletedSummary: userJobs.map(job => ({
          date: job.date,
          worksCompleted: job.worksCompleted,
        })),
        messagesSentCount: messagesData.length,
        messagesSent: messagesData,
        locationHistory: locationHistory.map(loc => ({
          latitude: loc.latitude,
          longitude: loc.longitude,
          timestamp: loc.timestamp,
        })),
      };

      res.json(exportData);
    } catch (error) {
      console.error('Data export error:', error);
      res.status(500).json({ error: "Failed to export data" });
    }
  });

  app.post("/api/user/request-deletion", requireAuth, async (req, res) => {
    try {
      const { password } = req.body;
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Verify password
      let isValidPassword = false;
      if (user.password.startsWith('$2b$')) {
        isValidPassword = await bcrypt.compare(password, user.password);
      } else {
        isValidPassword = user.password === password;
      }

      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid password" });
      }

      // Mark account for deletion (admin will process)
      await storage.updateUser(userId, { 
        deletionRequestedAt: new Date(),
        status: 'deletion_requested'
      });

      res.json({ 
        success: true, 
        message: "Account deletion request submitted" 
      });
    } catch (error) {
      console.error('Deletion request error:', error);
      res.status(500).json({ error: "Failed to request account deletion" });
    }
  });

  app.post("/api/user/record-consent", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { version } = req.body;
      
      await storage.updateUser(userId, { 
        gdprConsentDate: new Date(),
        gdprConsentVersion: version || '1.0'
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Consent recording error:', error);
      res.status(500).json({ error: "Failed to record consent" });
    }
  });

  // ==================== FIRST-TIME SETUP (NO AUTH REQUIRED) ====================
  
  // One-time setup: Create first admin account when no admins exist
  app.post("/api/setup/first-admin", async (req, res) => {
    try {
      // Check if any admin users exist
      const allUsers = await storage.getAllUsers();
      const existingAdmins = allUsers.filter(u => u.role === 'admin');
      
      if (existingAdmins.length > 0) {
        return res.status(403).json({ error: "Setup already completed. Admin accounts exist." });
      }
      
      const { username, password, name, email, phone } = req.body;
      
      if (!username || !password || !name) {
        return res.status(400).json({ error: "Username, password, and name are required" });
      }
      
      if (!email && !phone) {
        return res.status(400).json({ error: "Either email or phone number is required" });
      }
      
      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }
      
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }
      
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
      
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        name,
        email: email || null,
        phone: phone || null,
        role: 'admin',
        superAdmin: true, // First admin is always super admin
      });
      
      // Auto-login the new admin
      req.session.userId = user.id;
      req.session.userRole = user.role;
      
      res.json({
        message: "First admin account created successfully",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          superAdmin: user.superAdmin,
          username: user.username,
        }
      });
    } catch (error) {
      console.error("Setup error:", error);
      res.status(500).json({ error: "Setup failed" });
    }
  });
  
  // Check if setup is needed
  app.get("/api/setup/status", async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const existingAdmins = allUsers.filter(u => u.role === 'admin');
      res.json({ 
        setupRequired: existingAdmins.length === 0,
        hasAdmins: existingAdmins.length > 0 
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to check status" });
    }
  });
  
  // Emergency password reset for admin - resets to default password
  app.post("/api/setup/reset-admin", async (req, res) => {
    try {
      const { username, newPassword, setupKey } = req.body;
      
      // Require a setup key for security - must be configured via environment variable
      const validSetupKey = process.env.SETUP_KEY;
      if (!validSetupKey) {
        return res.status(403).json({ error: "Setup endpoint disabled. Configure SETUP_KEY environment variable to enable." });
      }
      if (setupKey !== validSetupKey) {
        return res.status(403).json({ error: "Invalid setup key" });
      }
      
      if (!username || !newPassword) {
        return res.status(400).json({ error: "Username and new password required" });
      }
      
      if (newPassword.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }
      
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
      // Also grant super admin access when using setup key reset
      await storage.updateUser(user.id, { password: hashedPassword, superAdmin: true });
      
      // Auto-login
      req.session.userId = user.id;
      req.session.userRole = user.role;
      
      res.json({ 
        message: "Password reset successful",
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          username: user.username,
          superAdmin: true,
        }
      });
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(500).json({ error: "Password reset failed" });
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
        phone: e.phone,
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
  app.post("/api/auth/verify-password", requireSuperAdmin, async (req, res) => {
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

  app.post("/api/users", requireSuperAdmin, async (req, res) => {
    try {
      const { username, password, name, email, phone, role } = req.body;
      
      if (!username || !password || !name || !role) {
        return res.status(400).json({ error: "Username, password, name, and role are required" });
      }

      if (!email && !phone) {
        return res.status(400).json({ error: "Either email or phone number is required" });
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
        email: email || null,
        phone: phone || null,
        role,
        status: 'active',
      });

      res.status(201).json({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        username: user.username,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.delete("/api/users/:id", requireSuperAdmin, async (req, res) => {
    try {
      if (req.params.id === req.session.userId) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }

      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Protect super admins from being deleted
      if (user.superAdmin) {
        return res.status(403).json({ error: "Cannot delete a super admin account" });
      }

      await storage.deleteUser(req.params.id);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  app.patch("/api/users/:id", requireSuperAdmin, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Protect super admins from being demoted
      if (user.superAdmin && req.body.role && req.body.role !== 'admin') {
        return res.status(403).json({ error: "Cannot demote a super admin" });
      }

      const { name, email, phone, username, password, role } = req.body;
      const updates: Record<string, any> = {};

      if (name) updates.name = name;
      if (email !== undefined) updates.email = email || null;
      if (phone !== undefined) updates.phone = phone || null;
      if (username) {
        const existingUser = await storage.getUserByUsername(username);
        if (existingUser && existingUser.id !== req.params.id) {
          return res.status(400).json({ error: "Username already exists" });
        }
        updates.username = username;
      }
      if (password) {
        if (password.length < 6) {
          return res.status(400).json({ error: "Password must be at least 6 characters" });
        }
        updates.password = await bcrypt.hash(password, SALT_ROUNDS);
      }
      if (role && (role === 'admin' || role === 'engineer')) {
        updates.role = role;
      }

      const updatedUser = await storage.updateUser(req.params.id, updates);
      res.json({
        id: updatedUser!.id,
        name: updatedUser!.name,
        email: updatedUser!.email,
        phone: updatedUser!.phone,
        role: updatedUser!.role,
        username: updatedUser!.username,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update user" });
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

  // Reorder jobs - update orderIndex for multiple jobs at once
  // This must be defined BEFORE /api/jobs/:id to avoid :id matching "reorder"
  app.patch("/api/jobs/reorder", requireAdmin, async (req, res) => {
    try {
      const { jobOrders } = req.body;
      
      if (!Array.isArray(jobOrders)) {
        return res.status(400).json({ error: "jobOrders must be an array" });
      }
      
      // Update each job's orderIndex
      for (const { jobId, orderIndex } of jobOrders) {
        if (typeof jobId === 'string' && typeof orderIndex === 'number') {
          await storage.updateJob(jobId, { orderIndex });
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to reorder jobs" });
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

      let updates = req.body;
      
      if (req.session.userRole === 'engineer') {
        const engineerAllowedFields = ['worksCompleted', 'notes', 'materials', 'photos', 'signatures', 'furtherActions'];
        const requestedFields = Object.keys(updates);
        const disallowedFields = requestedFields.filter(key => !engineerAllowedFields.includes(key));
        
        if (disallowedFields.length > 0) {
          return res.status(403).json({ 
            error: "Engineers cannot modify admin fields", 
            disallowedFields 
          });
        }
      }

      // Convert date string to Date object for Drizzle
      if (updates.date !== undefined) {
        updates.date = updates.date ? new Date(updates.date) : null;
      }

      const job = await storage.updateJob(req.params.id, updates);
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
      const { signatures, signOffLat, signOffLng, signOffAddress } = req.body;

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
      const engineerPhotos = photos.filter((p: any) => !p.source || p.source === 'engineer');
      if (engineerPhotos.length === 0) {
        return res.status(400).json({ error: "At least one evidence photo is required before sign-off" });
      }

      const allSignatures = signatures || existingJob.signatures || [];
      const hasEngineerSig = allSignatures.some((s: any) => s.type === 'engineer');
      const hasCustomerSig = allSignatures.some((s: any) => s.type === 'customer');

      if (!hasEngineerSig || !hasCustomerSig) {
        return res.status(400).json({ 
          error: "Both engineer and customer signatures are required before sign-off" 
        });
      }

      const updates: any = {};
      if (signatures) {
        updates.signatures = signatures;
      }
      if (signOffLat !== undefined && signOffLng !== undefined) {
        updates.signOffLat = signOffLat;
        updates.signOffLng = signOffLng;
      }
      if (signOffAddress) {
        updates.signOffAddress = signOffAddress;
      }

      if (Object.keys(updates).length > 0) {
        await storage.updateJob(req.params.id, updates);
      }

      const job = await storage.signOffJob(req.params.id);

      res.json(job);
    } catch (error) {
      res.status(500).json({ error: "Failed to sign off job" });
    }
  });

  // ==================== JOB UPDATES (Long-running jobs) ====================

  app.get("/api/jobs/:id/updates", requireAuth, async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (req.session.userRole === 'engineer' && job.assignedToId !== req.session.userId) {
        const assignedIds = job.assignedToIds as string[] || [];
        if (!assignedIds.includes(req.session.userId!)) {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      const updates = await storage.getJobUpdates(req.params.id);
      res.json(updates);
    } catch (error) {
      res.status(500).json({ error: "Failed to get job updates" });
    }
  });

  app.get("/api/jobs/:id/updates/today", requireAuth, async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const today = new Date();
      const count = await storage.countJobUpdatesForDate(req.params.id, today);
      const updates = await storage.getJobUpdatesForDate(req.params.id, today);
      
      res.json({ count, remaining: 2 - count, updates });
    } catch (error) {
      res.status(500).json({ error: "Failed to get today's updates" });
    }
  });

  app.post("/api/jobs/:id/updates", requireAuth, async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (!job.isLongRunning) {
        return res.status(400).json({ error: "Job updates are only available for long-running jobs" });
      }

      if (req.session.userRole === 'engineer' && job.assignedToId !== req.session.userId) {
        const assignedIds = job.assignedToIds as string[] || [];
        if (!assignedIds.includes(req.session.userId!)) {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      const today = new Date();
      const todayCount = await storage.countJobUpdatesForDate(req.params.id, today);
      
      if (todayCount >= 2) {
        return res.status(400).json({ error: "Maximum 2 updates per day reached" });
      }

      const photoSchema = z.object({
        id: z.string(),
        url: z.string(),
        timestamp: z.string(),
        source: z.enum(['admin', 'engineer']).optional().default('engineer'),
      });
      
      const updateInput = z.object({
        notes: z.string().nullable().optional(),
        photos: z.array(photoSchema).optional().default([]),
      }).safeParse(req.body);
      
      if (!updateInput.success) {
        return res.status(400).json({ error: "Invalid request body" });
      }
      
      const { notes, photos } = updateInput.data;
      
      const update = await storage.createJobUpdate({
        jobId: req.params.id,
        workDate: today,
        sequence: todayCount + 1,
        notes: notes || null,
        photos: photos || [],
        engineerId: req.session.userId || null,
      });

      const engineer = req.session.userId ? await storage.getUser(req.session.userId) : null;
      notifyAdmins({
        type: 'job_update',
        title: 'New Job Update',
        message: `${engineer?.name || 'An engineer'} submitted an update for job ${job.jobNo}`,
        jobId: job.id,
        jobNo: job.jobNo,
        engineerName: engineer?.name || 'Unknown',
        timestamp: new Date().toISOString(),
      });

      res.status(201).json(update);
    } catch (error) {
      res.status(500).json({ error: "Failed to create job update" });
    }
  });

  // ==================== LOCATION TRACKING ====================

  app.post("/api/users/:id/location", requireAuth, async (req, res) => {
    try {
      const { latitude, longitude, accuracy } = req.body;
      const userId = req.params.id;

      if (req.session.userId !== userId && req.session.userRole !== 'admin') {
        return res.status(403).json({ error: "Access denied" });
      }

      await storage.updateEngineerLocation(userId, latitude, longitude);

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update location" });
    }
  });

  app.get("/api/engineers/locations", requireAdmin, async (req, res) => {
    try {
      const engineers = await storage.getEngineerLocations();
      res.json(engineers);
    } catch (error) {
      res.status(500).json({ error: "Failed to get engineer locations" });
    }
  });

  // ==================== TIME TRACKING ====================

  const clockRequestSchema = z.object({
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    address: z.string().nullable().optional(),
  });

  app.post("/api/time/clock-in", requireAuth, async (req, res) => {
    try {
      const parsed = clockRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request data" });
      }
      const { latitude, longitude, address } = parsed.data;
      const engineerId = req.session.userId!;

      const activeLog = await storage.getActiveTimeLog(engineerId);
      if (activeLog) {
        return res.status(400).json({ error: "Already clocked in" });
      }

      const timeLog = await storage.clockIn(engineerId, latitude ?? null, longitude ?? null, address ?? null);
      res.json(timeLog);
    } catch (error) {
      res.status(500).json({ error: "Failed to clock in" });
    }
  });

  app.post("/api/time/clock-out", requireAuth, async (req, res) => {
    try {
      const parsed = clockRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request data" });
      }
      const { latitude, longitude, address } = parsed.data;
      const engineerId = req.session.userId!;

      const timeLog = await storage.clockOut(engineerId, latitude ?? null, longitude ?? null, address ?? null);
      if (!timeLog) {
        return res.status(400).json({ error: "Not currently clocked in" });
      }
      res.json(timeLog);
    } catch (error) {
      res.status(500).json({ error: "Failed to clock out" });
    }
  });

  app.get("/api/time/status", requireAuth, async (req, res) => {
    try {
      const engineerId = req.session.userId!;
      const activeLog = await storage.getActiveTimeLog(engineerId);
      res.json({ clockedIn: !!activeLog, activeLog });
    } catch (error) {
      res.status(500).json({ error: "Failed to get clock status" });
    }
  });

  app.get("/api/time/logs", requireAuth, async (req, res) => {
    try {
      const engineerId = req.session.userId!;
      const logs = await storage.getTimeLogsByEngineer(engineerId);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to get time logs" });
    }
  });

  app.get("/api/time/logs/all", requireAdmin, async (req, res) => {
    try {
      const logs = await storage.getAllTimeLogs();
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to get all time logs" });
    }
  });

  // ==================== QUOTES ROUTES ====================

  // PUBLIC routes first (specific paths before :id parameter)
  app.get("/api/quotes/view/:token", async (req, res) => {
    try {
      const quote = await storage.getQuoteByToken(req.params.token);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      const settings = await storage.getCompanySettings();
      res.json({ quote, companySettings: settings });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quote" });
    }
  });

  app.post("/api/quotes/accept/:token", async (req, res) => {
    try {
      const quote = await storage.getQuoteByToken(req.params.token);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      if (quote.status !== "Sent") {
        return res.status(400).json({ error: "Quote cannot be accepted in current status" });
      }
      const updated = await storage.updateQuote(quote.id, {
        status: "Accepted",
        acceptedAt: new Date(),
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to accept quote" });
    }
  });

  app.post("/api/quotes/decline/:token", async (req, res) => {
    try {
      const quote = await storage.getQuoteByToken(req.params.token);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      if (quote.status !== "Sent") {
        return res.status(400).json({ error: "Quote cannot be declined in current status" });
      }
      const { reason } = req.body;
      const updated = await storage.updateQuote(quote.id, {
        status: "Declined",
        declinedAt: new Date(),
        declineReason: reason || null,
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to decline quote" });
    }
  });

  // AUTHENTICATED routes (admin only)
  app.get("/api/quotes", requireAdmin, async (req, res) => {
    try {
      const allQuotes = await storage.getAllQuotes();
      res.json(allQuotes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quotes" });
    }
  });

  app.post("/api/quotes", requireAdmin, async (req, res) => {
    try {
      console.log("Creating quote with body:", JSON.stringify(req.body, null, 2));
      const quoteNo = await storage.getNextQuoteNumber();
      const accessToken = crypto.randomUUID();
      
      // Sanitize line items to ensure numeric fields are numbers
      const lineItems = (req.body.lineItems || []).map((item: any) => ({
        ...item,
        quantity: Number(item.quantity) || 0,
        unitCost: Number(item.unitCost) || 0,
        discount: Number(item.discount) || 0,
        amount: Number(item.amount) || 0,
      }));
      
      // Create or update the client record
      const client = await storage.findOrCreateClient({
        name: req.body.customerName,
        email: req.body.customerEmail || null,
        phone: req.body.customerPhone || null,
        address: req.body.siteAddress || null,
        postcode: req.body.sitePostcode || null,
      });
      
      // Create a draft job for this quote
      const jobCount = (await storage.getAllJobs()).length + 1;
      const year = new Date().getFullYear();
      const jobNo = `J-${year}-${String(jobCount).padStart(3, '0')}`;
      
      const draftJob = await storage.createJob({
        jobNo,
        customerName: req.body.customerName,
        client: client.id,
        address: req.body.siteAddress || undefined,
        postcode: req.body.sitePostcode || undefined,
        contactEmail: req.body.customerEmail || undefined,
        contactPhone: req.body.customerPhone || undefined,
        description: req.body.description || `Quote ${quoteNo}`,
        status: "Draft",
      });
      
      const quote = await storage.createQuote({
        customerName: req.body.customerName,
        customerEmail: req.body.customerEmail || null,
        customerPhone: req.body.customerPhone || null,
        customerId: client.id,
        siteAddress: req.body.siteAddress || null,
        sitePostcode: req.body.sitePostcode || null,
        reference: req.body.reference || null,
        quoteDate: req.body.quoteDate ? new Date(req.body.quoteDate) : new Date(),
        expiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : undefined,
        description: req.body.description || null,
        lineItems,
        subtotal: Number(req.body.subtotal) || 0,
        discountTotal: Number(req.body.discountTotal) || 0,
        vatRate: Number(req.body.vatRate) || 20,
        vatAmount: Number(req.body.vatAmount) || 0,
        total: Number(req.body.total) || 0,
        terms: req.body.terms || null,
        notes: req.body.notes || null,
        status: req.body.status || "Draft",
        quoteNo,
        accessToken,
        createdById: req.session.userId,
        convertedJobId: draftJob.id,
      });
      console.log("Quote created successfully:", quote.id, "with client:", client.id, "and draft job:", draftJob.id);
      res.json({ ...quote, client, draftJob });
    } catch (error: any) {
      console.error("Failed to create quote:", error);
      console.error("Error stack:", error?.stack);
      res.status(500).json({ error: "Failed to create quote", details: error?.message });
    }
  });

  app.get("/api/quotes/:id", requireAdmin, async (req, res) => {
    try {
      const quote = await storage.getQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      res.json(quote);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quote" });
    }
  });

  app.put("/api/quotes/:id", requireAdmin, async (req, res) => {
    try {
      // Convert date strings to Date objects and sanitize numeric fields
      const updates: any = { ...req.body };
      if (updates.quoteDate) updates.quoteDate = new Date(updates.quoteDate);
      if (updates.expiryDate) updates.expiryDate = new Date(updates.expiryDate);
      if (updates.acceptedAt) updates.acceptedAt = new Date(updates.acceptedAt);
      if (updates.declinedAt) updates.declinedAt = new Date(updates.declinedAt);
      if (updates.sentAt) updates.sentAt = new Date(updates.sentAt);
      if (updates.lineItems) {
        updates.lineItems = updates.lineItems.map((item: any) => ({
          ...item,
          quantity: Number(item.quantity) || 0,
          unitCost: Number(item.unitCost) || 0,
          discount: Number(item.discount) || 0,
          amount: Number(item.amount) || 0,
        }));
      }
      if (updates.subtotal !== undefined) updates.subtotal = Number(updates.subtotal) || 0;
      if (updates.vatRate !== undefined) updates.vatRate = Number(updates.vatRate) || 20;
      if (updates.vatAmount !== undefined) updates.vatAmount = Number(updates.vatAmount) || 0;
      if (updates.total !== undefined) updates.total = Number(updates.total) || 0;
      
      const quote = await storage.updateQuote(req.params.id, updates);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      res.json(quote);
    } catch (error) {
      res.status(500).json({ error: "Failed to update quote" });
    }
  });

  app.delete("/api/quotes/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteQuote(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete quote" });
    }
  });

  app.post("/api/quotes/:id/convert-to-job", requireAdmin, async (req, res) => {
    try {
      const quote = await storage.getQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      if (quote.status !== "Accepted") {
        return res.status(400).json({ error: "Only accepted quotes can be converted to jobs" });
      }
      
      const jobCount = (await storage.getAllJobs()).length + 1;
      const year = new Date().getFullYear();
      const jobNo = `J-${year}-${String(jobCount).padStart(3, '0')}`;
      
      const job = await storage.createJob({
        jobNo,
        customerName: quote.customerName,
        address: quote.siteAddress || undefined,
        postcode: quote.sitePostcode || undefined,
        contactEmail: quote.customerEmail || undefined,
        contactPhone: quote.customerPhone || undefined,
        description: quote.description || undefined,
        status: "Draft",
      });
      
      await storage.updateQuote(quote.id, {
        status: "Converted",
        convertedJobId: job.id,
      });
      
      res.json({ job, quote: await storage.getQuote(quote.id) });
    } catch (error) {
      res.status(500).json({ error: "Failed to convert quote to job" });
    }
  });

  // ==================== CLIENTS ROUTES ====================
  
  app.get("/api/clients", requireAdmin, async (req, res) => {
    try {
      const allClients = await storage.getAllClients();
      res.json(allClients);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  app.get("/api/clients/:id", requireAdmin, async (req, res) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client" });
    }
  });

  app.post("/api/clients", requireAdmin, async (req, res) => {
    try {
      const client = await storage.createClient(req.body);
      res.json(client);
    } catch (error) {
      res.status(500).json({ error: "Failed to create client" });
    }
  });

  app.put("/api/clients/:id", requireAdmin, async (req, res) => {
    try {
      const client = await storage.updateClient(req.params.id, req.body);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      res.status(500).json({ error: "Failed to update client" });
    }
  });

  app.delete("/api/clients/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteClient(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete client" });
    }
  });

  // ==================== INVOICES ROUTES ====================

  // PUBLIC routes first (specific paths before :id parameter)
  app.get("/api/invoices/view/:token", async (req, res) => {
    try {
      const invoice = await storage.getInvoiceByToken(req.params.token);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      const settings = await storage.getCompanySettings();
      res.json({ invoice, companySettings: settings });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invoice" });
    }
  });

  // AUTHENTICATED routes (admin only)
  app.get("/api/invoices", requireAdmin, async (req, res) => {
    try {
      const allInvoices = await storage.getAllInvoices();
      res.json(allInvoices);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invoices" });
    }
  });

  app.post("/api/invoices", requireAdmin, async (req, res) => {
    try {
      const invoiceNo = await storage.getNextInvoiceNumber();
      const accessToken = crypto.randomUUID();
      const invoice = await storage.createInvoice({
        ...req.body,
        invoiceNo,
        accessToken,
        createdById: req.session.userId,
      });
      res.json(invoice);
    } catch (error) {
      console.error("Failed to create invoice:", error);
      res.status(500).json({ error: "Failed to create invoice" });
    }
  });

  app.get("/api/invoices/:id", requireAdmin, async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invoice" });
    }
  });

  app.put("/api/invoices/:id", requireAdmin, async (req, res) => {
    try {
      const invoice = await storage.updateInvoice(req.params.id, req.body);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: "Failed to update invoice" });
    }
  });

  app.delete("/api/invoices/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteInvoice(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete invoice" });
    }
  });

  // Create invoice from job
  app.post("/api/jobs/:id/create-invoice", requireAdmin, async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      const invoiceNo = await storage.getNextInvoiceNumber();
      const accessToken = crypto.randomUUID();
      const settings = await storage.getCompanySettings();
      
      const invoice = await storage.createInvoice({
        invoiceNo,
        jobId: job.id,
        customerName: job.customerName,
        customerEmail: job.contactEmail || undefined,
        customerPhone: job.contactPhone || undefined,
        siteAddress: job.address || undefined,
        sitePostcode: job.postcode || undefined,
        lineItems: req.body.lineItems || [],
        subtotal: req.body.subtotal || 0,
        vatRate: settings?.defaultVatRate || 20,
        vatAmount: req.body.vatAmount || 0,
        total: req.body.total || 0,
        notes: req.body.notes,
        accessToken,
        createdById: req.session.userId,
        dueDate: new Date(Date.now() + (settings?.defaultPaymentTerms || 30) * 24 * 60 * 60 * 1000),
      });
      
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: "Failed to create invoice from job" });
    }
  });

  // ==================== COMPANY SETTINGS ROUTES ====================

  app.get("/api/company-settings", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getCompanySettings();
      res.json(settings || {});
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch company settings" });
    }
  });

  app.put("/api/company-settings", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.upsertCompanySettings(req.body);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to update company settings" });
    }
  });

  // ==================== AI ADVISORS ROUTES ====================

  app.get("/api/ai-advisors", requireAuth, async (req, res) => {
    try {
      const advisors = await storage.getActiveAiAdvisors();
      res.json(advisors);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch advisors" });
    }
  });

  app.get("/api/ai-advisors/all", requireAdmin, async (req, res) => {
    try {
      const advisors = await storage.getAllAiAdvisors();
      res.json(advisors);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch advisors" });
    }
  });

  app.get("/api/ai-advisors/:id", requireAuth, async (req, res) => {
    try {
      const advisor = await storage.getAiAdvisor(req.params.id);
      if (!advisor) {
        return res.status(404).json({ error: "Advisor not found" });
      }
      res.json(advisor);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch advisor" });
    }
  });

  // Seed default AI advisors if none exist
  app.post("/api/ai-advisors/seed", requireAdmin, async (req, res) => {
    try {
      const existing = await storage.getAllAiAdvisors();
      if (existing.length > 0) {
        return res.status(400).json({ error: "AI advisors already exist", count: existing.length });
      }

      const defaultAdvisors = [
        {
          name: "Snagging Pro",
          description: "Professional UK refurbishment snagging agent. Assesses photos and videos of refurbishment works to identify snags and produce contractor-ready snag lists.",
          icon: "ClipboardCheck",
          category: "quality",
          systemPrompt: `You are Snagging Pro, a professional UK refurbishment snagging agent acting for Pro Main Solutions. You behave as an experienced UK Site Manager or Clerk of Works.

Your purpose is to assess uploaded photos and videos of refurbishment works, identify snags relating only to new works and their interfaces, and produce fair, evidence-based, contractor-ready snag lists that protect Pro Main Solutions' professional reputation.

You always assess all uploaded media and never refuse to review available photos or videos.

Videos are used to judge general workmanship, alignment, sequencing, and obvious defects. You explain when still photos are needed for close-detail confirmation and only request additional images when genuinely required to confirm a snag.

If it is unclear whether works shown are new works or existing fabric, you may ask one clarifying question. Otherwise, proceed using reasonable professional judgement.

You apply refurbishment logic:
- Only snag new works and interfaces.
- Existing fabric imperfections are acceptable unless demonstrably worsened by the works.
- Apply reasonable refurbishment tolerances rather than new-build perfection.

Your judgement focuses on issues affecting function, durability, safety, water resistance, or reasonable workmanship.

You do not assign blame, certify compliance, or replace Building Control or surveyors. You may flag visible risks without offering certification or legal conclusions.

You classify severity consistently:
- High: safety risks, water ingress, fire risk, functional failure
- Medium: durability or significant quality concerns
- Low: cosmetic or finish-related issues

Your default output is a structured snag list by area or location using a table with:
Ref | Snag Description | Assessment | Recommended Rectification | Priority

Each snag must clearly explain:
- what the issue is
- why it matters
- practical rectification guidance

Maintain momentum at all times. Never block progress where a reasonable professional assessment can be made.`,
          isActive: true,
        },
        {
          name: "Trade Parts Finder",
          description: "AI sourcing assistant for refurbishment and construction trades. Identifies parts from photos and finds best options from UK suppliers.",
          icon: "Search",
          category: "sourcing",
          systemPrompt: `Trade Parts Finder is an AI sourcing assistant for refurbishment and construction trades. It helps identify, locate, and compare parts, fittings, and materials across suppliers. It interprets photos, measurements, and text descriptions to determine what the user is looking for and guides them with clear, minimal follow-up questions to confirm the part. It then searches builder merchants, trade wholesalers, and specialist suppliers to collate the best available options with price, availability, and alternates.

When information is incomplete or unclear, it always begins by asking clarifying questions. It prioritises establishing the correct product category, dimensions, material, and application before sourcing. Once confident, it shows potential matches — starting with a shortlist of 3–5 best-fit options. If the user isn't satisfied, it expands results in batches of 3 more on request.

It focuses on real-world usefulness: extracting structured data from photos and text, recognising missing details, and prompting efficiently to fill gaps. It avoids redundant questions and always asks for confirmation before assuming a match is exact.

When sourcing, it favours UK trade and retail suppliers (e.g., Screwfix, Toolstation, Wickes, B&Q, Travis Perkins, City Plumbing, CEF, Wolseley, Howdens, UPVC Spares 4 Repairs, Duffels, Eurocell, SIG Roofing). Each result includes item name, supplier, SKU, link, price, delivery, and confidence level, with brief notes on alternates or substitutes.

Tone is practical, conversational, and precise — clear technical reasoning without jargon. It explains assumptions plainly and makes actionable recommendations. If a request lacks enough data, it guides the user to provide missing info (dimensions, clearer photos, or use context).

The assistant can:
- Identify hardware, fittings, and materials from photos or text
- Extract or calculate key dimensions or specs
- Ask smart clarifying questions before searching
- Search trade catalogues and merchants
- Present 3–5 initial best-fit results with the option to expand
- Recommend best-fit items or alternatives
- Help prevent wrong orders by highlighting uncertainty

If multiple interpretations exist, it states confidence levels and suggests practical next steps (measure again, take another photo, order two variants, etc.)`,
          isActive: true,
        },
        {
          name: "Gas & Heating Expert",
          description: "UK domestic gas and heating engineer assistant. Diagnoses boiler breakdowns, heating issues, and provides safety-first guidance.",
          icon: "Flame",
          category: "specialist",
          systemPrompt: `You are a UK domestic gas and heating engineer assistant operating at a professional plumber/heating engineer level. Your purpose is to diagnose and advise on boiler breakdowns, unvented and electric hot water cylinders, heating control systems (including smart controls), fault codes, heating/hot water issues, and remedies with no-nonsense, technically accurate explanations. Provide practical, efficient, safety-first guidance aligned with UK standards (Gas Safe, Building Regulations, and G3 unvented regulations). Cover major UK boiler, cylinder, and control brands/models from the last 15 years, detailing common fault codes, symptoms, likely causes, and step-by-step remedies.

Core capabilities:
- Parts lookup: When the make/model is known, propose likely OEM part names and common part codes. Always include estimated UK trade/retail prices and typical labour time.
- Image/video diagnosis: Analyse user-uploaded photos/videos to identify visible faults (leaks, corrosion, blocked condensate, wiring errors, component failure). Provide a short caption per highlight. If the media is unclear, request a clearer angle or lighting.
- Quick reference: Provide compact look-up tables for frequent fault codes and symptoms for brands like Vaillant, Worcester Bosch, Ideal, Baxi, Glow-worm, Viessmann, Vokera, Potterton, Alpha, Intergas, etc. Keep entries concise: code → meaning → first checks → likely parts.
- Interactive diagnostic trees: Guide users through step-by-step branching checks (Yes/No or readings) to logically isolate the fault across gas, ignition, combustion air, hydraulics, sensors, and controls.

Communication style:
- Speak like a working tradesperson: direct, clear, no fluff. Use plain English, bullets, and short paragraphs. Focus on what to test, what result means, and what to do next.
- Always separate: "You can safely check" vs "Gas Safe/G3 engineer only". Never instruct non-qualified users to perform gas work, sealed-combustion adjustments, or G3 safety valve operations.
- Include advice on system components (valves, sensors, pumps, PCBs, fans, electrodes, SIs, immersion heaters, thermostats, control modules), testing methods (multimeter, manometer, continuity, resistance, pressure), and logical fault finding.
- Always include estimated part lists, typical UK trade and retail costs, and indicative repair timeframes where relevant.

Safety defaults:
- If there are combustion smells, sooting, continuous lockouts, CO alarms, water from the tundish, or signs of overheating, stop, isolate power/gas/water as appropriate, and advise contacting a Gas Safe or G3-certified engineer. Never bypass safety devices.`,
          isActive: true,
        },
        {
          name: "Electrical Expert",
          description: "UK domestic electrician trained to BS 7671. Diagnoses electrical faults, analyzes test data, and provides compliant solutions.",
          icon: "Zap",
          category: "specialist",
          systemPrompt: `This is an expert UK domestic electrician trained to the highest standards under BS 7671 and UK Building Regulations. It diagnoses, fault-finds, and provides practical, compliant solutions for electrical issues in UK homes. It interprets user descriptions, photos, videos, and test data to identify faults and explain solutions clearly in plain English.

Capabilities:
- Diagnose electrical faults in UK domestic installations: lighting, ring finals, spurs, cookers, showers, consumer units, outdoor circuits, and EV chargers.
- Analyze insulation resistance, continuity, R1+R2, Zs, and RCD test data, comparing values to BS 7671 thresholds and providing plain-English verdicts.
- Each explanation includes protective device types and ratings (e.g., 6 A lighting, 32 A ring final, 40 A shower circuit, RCBO type, RCD trip rating).
- Smart Repair Estimator: provides realistic repair time estimates, materials lists, and skill level needed (DIY-capable, competent person, or qualified electrician required).
- Parts Identification: recognizes electrical accessories, protective devices, cable types, and fittings from photos or detailed descriptions, naming manufacturer, model, and specifications.
- Parts Cross-Referencing: recommends modern or compatible replacement parts for obsolete, damaged, or legacy devices.
- Test Value Validator: checks test readings against BS 7671 limits and colour-codes results (Pass / Borderline / Fail).
- Compliance & Upgrade Advisor: identifies where installations may not meet 18th Edition (e.g., lack of RCD, SPD, AFDD) and suggests upgrade options.
- Job Planning Mode: produces step-by-step workflows for tasks including preparation, isolation, installation, testing, and documentation.
- Reference BS 7671, IET Guidance Notes, and Part P while maintaining clear, practical language.
- Provide realistic, safe, and professional real-world solutions.

Style:
- Modern, clear, and professional presentation.
- Uses plain English with supporting tables and notes.
- Always embeds safety-first practices and competence disclaimers.
- Identifies and cross-references parts, with estimated repair times, skill requirements, and device ratings.

Always embeds safety disclaimers about competence, live work, and notifiable tasks under Part P.`,
          isActive: true,
        },
      ];

      const created = [];
      for (const advisor of defaultAdvisors) {
        const result = await storage.createAiAdvisor(advisor);
        created.push(result);
      }

      res.status(201).json({ 
        message: "Default AI advisors created successfully", 
        count: created.length,
        advisors: created.map(a => ({ id: a.id, name: a.name }))
      });
    } catch (error) {
      console.error("Error seeding AI advisors:", error);
      res.status(500).json({ error: "Failed to seed AI advisors" });
    }
  });

  app.post("/api/ai-advisors", requireAdmin, async (req, res) => {
    try {
      const data = insertAiAdvisorSchema.parse(req.body);
      const advisor = await storage.createAiAdvisor(data);
      res.status(201).json(advisor);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create advisor" });
    }
  });

  app.patch("/api/ai-advisors/:id", requireAdmin, async (req, res) => {
    try {
      const advisor = await storage.updateAiAdvisor(req.params.id, req.body);
      if (!advisor) {
        return res.status(404).json({ error: "Advisor not found" });
      }
      res.json(advisor);
    } catch (error) {
      res.status(500).json({ error: "Failed to update advisor" });
    }
  });

  app.delete("/api/ai-advisors/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteAiAdvisor(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete advisor" });
    }
  });

  app.post("/api/ai-advisors/:id/chat", requireAuth, async (req, res) => {
    try {
      const advisor = await storage.getAiAdvisor(req.params.id);
      if (!advisor) {
        return res.status(404).json({ error: "Advisor not found" });
      }

      const openai = getOpenAIClient();
      if (!openai) {
        return res.status(503).json({ error: "AI service not configured" });
      }

      const { messages } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Messages array required" });
      }

      const chatMessages: any[] = [
        { role: "system", content: advisor.systemPrompt },
      ];

      for (const msg of messages) {
        if (msg.role === "user" && msg.image) {
          chatMessages.push({
            role: "user",
            content: [
              { type: "text", text: msg.content || "Please analyze this image." },
              { type: "image_url", image_url: { url: msg.image } },
            ],
          });
        } else {
          chatMessages.push({ role: msg.role, content: msg.content });
        }
      }

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: chatMessages,
        max_completion_tokens: 4096,
      });

      res.json({
        message: response.choices[0].message.content,
      });
    } catch (error: any) {
      console.error("AI chat error:", error);
      res.status(500).json({ error: error.message || "AI request failed" });
    }
  });

  // ==================== AI WRITING ASSISTANT ====================
  
  // AI text assistance for accessibility - helps with spelling, grammar, simplification
  app.post("/api/ai/assist", requireAuth, async (req, res) => {
    try {
      const openai = getOpenAIClient();
      if (!openai) {
        return res.status(503).json({ error: "AI service not configured" });
      }

      const { text, mode, context } = req.body;
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: "Text is required" });
      }

      if (!mode || !['fix', 'simplify', 'expand', 'professional'].includes(mode)) {
        return res.status(400).json({ error: "Valid mode required: fix, simplify, expand, or professional" });
      }

      let systemPrompt = '';
      let userPrompt = '';

      switch (mode) {
        case 'fix':
          systemPrompt = `You are a helpful writing assistant. Your job is to fix spelling and grammar mistakes while keeping the original meaning and tone. Only output the corrected text, nothing else. If the text is already correct, return it unchanged. Keep it natural and conversational - don't make it overly formal.`;
          userPrompt = `Fix any spelling and grammar mistakes in this text:\n\n${text}`;
          break;
        case 'simplify':
          systemPrompt = `You are a helpful writing assistant. Your job is to simplify text to make it easier to read and understand. Use shorter sentences and simpler words. Only output the simplified text, nothing else.`;
          userPrompt = `Simplify this text to make it easier to read:\n\n${text}`;
          break;
        case 'expand':
          systemPrompt = `You are a helpful writing assistant. Your job is to expand brief notes into complete, clear sentences. Keep the same meaning but make it more detailed and professional. Only output the expanded text, nothing else.`;
          userPrompt = `Expand these brief notes into complete sentences:\n\n${text}${context ? `\n\nContext: ${context}` : ''}`;
          break;
        case 'professional':
          systemPrompt = `You are a helpful writing assistant for field service engineers. Your job is to rewrite text in a professional, clear manner suitable for job reports and client communication. Only output the rewritten text, nothing else.`;
          userPrompt = `Rewrite this in a professional, clear manner for a job report:\n\n${text}`;
          break;
      }

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_completion_tokens: 1024,
        temperature: 0.3,
      });

      const result = response.choices[0].message.content?.trim() || text;
      
      res.json({ 
        original: text,
        result,
        mode 
      });
    } catch (error: any) {
      console.error("AI assist error:", error);
      res.status(500).json({ error: error.message || "AI assistance failed" });
    }
  });

  // ==================== SEED ROUTE (DEV ONLY) ====================

  // Simple GET endpoint to reset passwords - requires secret key
  app.get("/api/reset-demo", async (req, res) => {
    const key = req.query.key;
    if (key !== "TrueNorth2024Reset") {
      return res.status(403).send("Access denied");
    }
    try {
      const allUsers = await storage.getAllUsers();
      const resetPasswords: string[] = [];
      for (const user of allUsers) {
        const newPassword = user.username + "123";
        await storage.updateUser(user.id, { password: newPassword });
        resetPasswords.push(`<b>${user.username}</b>: ${newPassword}`);
      }
      res.send(`<html><body style='font-family: system-ui; padding: 40px; text-align: center;'><h1>All Passwords Reset!</h1><p>All user passwords have been reset to username + "123":</p><p>${resetPasswords.join('<br>')}</p><p><a href='/'>Go to Login</a></p></body></html>`);
    } catch (error) {
      res.status(500).send("Reset failed");
    }
  });

  app.post("/api/seed", async (req, res) => {
    try {
      // Upsert demo admin - create or reset password
      const existingAdmin = await storage.getUserByUsername("admin");
      if (existingAdmin) {
        await storage.updateUser(existingAdmin.id, { 
          password: "admin123", 
          role: "admin",
          name: "Dispatcher Dave"
        });
      } else {
        await storage.createUser({
          username: "admin",
          password: "admin123",
          name: "Dispatcher Dave",
          email: "admin@promains.com",
          role: "admin",
          status: "active",
        });
      }

      // Upsert john
      const existingJohn = await storage.getUserByUsername("john");
      if (existingJohn) {
        await storage.updateUser(existingJohn.id, { 
          password: "john123", 
          role: "engineer" 
        });
      } else {
        await storage.createUser({
          username: "john",
          password: "john123",
          name: "John Smith",
          email: "john@promains.com",
          role: "engineer",
          status: "active",
        });
      }

      // Upsert sarah
      const existingSarah = await storage.getUserByUsername("sarah");
      if (existingSarah) {
        await storage.updateUser(existingSarah.id, { 
          password: "sarah123", 
          role: "engineer" 
        });
      } else {
        await storage.createUser({
          username: "sarah",
          password: "sarah123",
          name: "Sarah Jones",
          email: "sarah@promains.com",
          role: "engineer",
          status: "active",
        });
      }

      res.json({ message: "Demo accounts reset successfully! Login with admin/admin123" });
    } catch (error) {
      console.error("Seed error:", error);
      res.status(500).json({ error: "Failed to seed database: " + (error as Error).message });
    }
  });

  app.post("/api/seed-advisors", async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: "Seed not available in production" });
    }

    try {
      const existingAdvisors = await storage.getAllAiAdvisors();
      if (existingAdvisors.length > 0) {
        return res.json({ message: "Advisors already seeded" });
      }

      const advisors = [
        {
          name: "Snagging Pro",
          description: "Professional UK refurbishment snagging agent. Assesses photos and videos of refurbishment works to identify snags and produce contractor-ready snag lists.",
          icon: "ClipboardCheck",
          category: "quality",
          systemPrompt: `You are Snagging Pro, a professional UK refurbishment snagging agent acting for Pro Main Solutions. You behave as an experienced UK Site Manager or Clerk of Works.

Your purpose is to assess uploaded photos and videos of refurbishment works, identify snags relating only to new works and their interfaces, and produce fair, evidence-based, contractor-ready snag lists that protect Pro Main Solutions' professional reputation.

You always assess all uploaded media and never refuse to review available photos or videos.

Videos are used to judge general workmanship, alignment, sequencing, and obvious defects. You explain when still photos are needed for close-detail confirmation and only request additional images when genuinely required to confirm a snag.

If it is unclear whether works shown are new works or existing fabric, you may ask one clarifying question. Otherwise, proceed using reasonable professional judgement.

You apply refurbishment logic:
- Only snag new works and interfaces.
- Existing fabric imperfections are acceptable unless demonstrably worsened by the works.
- Apply reasonable refurbishment tolerances rather than new-build perfection.

Your judgement focuses on issues affecting function, durability, safety, water resistance, or reasonable workmanship.

You do not assign blame, certify compliance, or replace Building Control or surveyors. You may flag visible risks without offering certification or legal conclusions.

You classify severity consistently:
- High: safety risks, water ingress, fire risk, functional failure
- Medium: durability or significant quality concerns
- Low: cosmetic or finish-related issues

Your default output is a structured snag list by area or location using a table with:
Ref | Snag Description | Assessment | Recommended Rectification | Priority

Each snag must clearly explain:
- what the issue is
- why it matters
- practical rectification guidance

Maintain momentum at all times. Never block progress where a reasonable professional assessment can be made.`,
          isActive: true,
        },
        {
          name: "Trade Parts Finder",
          description: "AI sourcing assistant for refurbishment and construction trades. Identifies parts from photos and finds best options from UK suppliers.",
          icon: "Search",
          category: "sourcing",
          systemPrompt: `Trade Parts Finder is an AI sourcing assistant for refurbishment and construction trades. It helps identify, locate, and compare parts, fittings, and materials across suppliers. It interprets photos, measurements, and text descriptions to determine what the user is looking for and guides them with clear, minimal follow-up questions to confirm the part. It then searches builder merchants, trade wholesalers, and specialist suppliers to collate the best available options with price, availability, and alternates.

When information is incomplete or unclear, it always begins by asking clarifying questions. It prioritises establishing the correct product category, dimensions, material, and application before sourcing. Once confident, it shows potential matches — starting with a shortlist of 3–5 best-fit options. If the user isn't satisfied, it expands results in batches of 3 more on request.

It focuses on real-world usefulness: extracting structured data from photos and text, recognising missing details, and prompting efficiently to fill gaps. It avoids redundant questions and always asks for confirmation before assuming a match is exact.

When sourcing, it favours UK trade and retail suppliers (e.g., Screwfix, Toolstation, Wickes, B&Q, Travis Perkins, City Plumbing, CEF, Wolseley, Howdens, UPVC Spares 4 Repairs, Duffels, Eurocell, SIG Roofing). Each result includes item name, supplier, SKU, link, price, delivery, and confidence level, with brief notes on alternates or substitutes.

Tone is practical, conversational, and precise — clear technical reasoning without jargon. It explains assumptions plainly and makes actionable recommendations. If a request lacks enough data, it guides the user to provide missing info (dimensions, clearer photos, or use context).

The assistant can:
- Identify hardware, fittings, and materials from photos or text
- Extract or calculate key dimensions or specs
- Ask smart clarifying questions before searching
- Search trade catalogues and merchants
- Present 3–5 initial best-fit results with the option to expand
- Recommend best-fit items or alternatives
- Help prevent wrong orders by highlighting uncertainty

If multiple interpretations exist, it states confidence levels and suggests practical next steps (measure again, take another photo, order two variants, etc.)`,
          isActive: true,
        },
        {
          name: "Gas & Heating Expert",
          description: "UK domestic gas and heating engineer assistant. Diagnoses boiler breakdowns, heating issues, and provides safety-first guidance.",
          icon: "Flame",
          category: "specialist",
          systemPrompt: `You are a UK domestic gas and heating engineer assistant operating at a professional plumber/heating engineer level. Your purpose is to diagnose and advise on boiler breakdowns, unvented and electric hot water cylinders, heating control systems (including smart controls), fault codes, heating/hot water issues, and remedies with no-nonsense, technically accurate explanations. Provide practical, efficient, safety-first guidance aligned with UK standards (Gas Safe, Building Regulations, and G3 unvented regulations). Cover major UK boiler, cylinder, and control brands/models from the last 15 years, detailing common fault codes, symptoms, likely causes, and step-by-step remedies.

Core capabilities:
- Parts lookup: When the make/model is known, propose likely OEM part names and common part codes. Always include estimated UK trade/retail prices and typical labour time.
- Image/video diagnosis: Analyse user-uploaded photos/videos to identify visible faults (leaks, corrosion, blocked condensate, wiring errors, component failure). Provide a short caption per highlight. If the media is unclear, request a clearer angle or lighting.
- Quick reference: Provide compact look-up tables for frequent fault codes and symptoms for brands like Vaillant, Worcester Bosch, Ideal, Baxi, Glow-worm, Viessmann, Vokera, Potterton, Alpha, Intergas, etc. Keep entries concise: code → meaning → first checks → likely parts.
- Interactive diagnostic trees: Guide users through step-by-step branching checks (Yes/No or readings) to logically isolate the fault across gas, ignition, combustion air, hydraulics, sensors, and controls.

Communication style:
- Speak like a working tradesperson: direct, clear, no fluff. Use plain English, bullets, and short paragraphs. Focus on what to test, what result means, and what to do next.
- Always separate: "You can safely check" vs "Gas Safe/G3 engineer only". Never instruct non-qualified users to perform gas work, sealed-combustion adjustments, or G3 safety valve operations.
- Include advice on system components (valves, sensors, pumps, PCBs, fans, electrodes, SIs, immersion heaters, thermostats, control modules), testing methods (multimeter, manometer, continuity, resistance, pressure), and logical fault finding.
- Always include estimated part lists, typical UK trade and retail costs, and indicative repair timeframes where relevant.

Safety defaults:
- If there are combustion smells, sooting, continuous lockouts, CO alarms, water from the tundish, or signs of overheating, stop, isolate power/gas/water as appropriate, and advise contacting a Gas Safe or G3-certified engineer. Never bypass safety devices.`,
          isActive: true,
        },
        {
          name: "Electrical Expert",
          description: "UK domestic electrician trained to BS 7671. Diagnoses electrical faults, analyzes test data, and provides compliant solutions.",
          icon: "Zap",
          category: "specialist",
          systemPrompt: `This is an expert UK domestic electrician trained to the highest standards under BS 7671 and UK Building Regulations. It diagnoses, fault-finds, and provides practical, compliant solutions for electrical issues in UK homes. It interprets user descriptions, photos, videos, and test data to identify faults and explain solutions clearly in plain English.

Capabilities:
- Diagnose electrical faults in UK domestic installations: lighting, ring finals, spurs, cookers, showers, consumer units, outdoor circuits, and EV chargers.
- Analyze insulation resistance, continuity, R1+R2, Zs, and RCD test data, comparing values to BS 7671 thresholds and providing plain-English verdicts.
- Each explanation includes protective device types and ratings (e.g., 6 A lighting, 32 A ring final, 40 A shower circuit, RCBO type, RCD trip rating).
- Smart Repair Estimator: provides realistic repair time estimates, materials lists, and skill level needed (DIY-capable, competent person, or qualified electrician required).
- Parts Identification: recognizes electrical accessories, protective devices, cable types, and fittings from photos or detailed descriptions, naming manufacturer, model, and specifications.
- Parts Cross-Referencing: recommends modern or compatible replacement parts for obsolete, damaged, or legacy devices.
- Test Value Validator: checks test readings against BS 7671 limits and colour-codes results (Pass / Borderline / Fail).
- Compliance & Upgrade Advisor: identifies where installations may not meet 18th Edition (e.g., lack of RCD, SPD, AFDD) and suggests upgrade options.
- Job Planning Mode: produces step-by-step workflows for tasks including preparation, isolation, installation, testing, and documentation.
- Reference BS 7671, IET Guidance Notes, and Part P while maintaining clear, practical language.
- Provide realistic, safe, and professional real-world solutions.

Style:
- Modern, clear, and professional presentation.
- Uses plain English with supporting tables and notes.
- Always embeds safety-first practices and competence disclaimers.
- Identifies and cross-references parts, with estimated repair times, skill requirements, and device ratings.

Always embeds safety disclaimers about competence, live work, and notifiable tasks under Part P.`,
          isActive: true,
        },
      ];

      for (const advisor of advisors) {
        await storage.createAiAdvisor(advisor);
      }

      res.json({ message: "AI advisors seeded successfully" });
    } catch (error) {
      console.error("Seed advisors error:", error);
      res.status(500).json({ error: "Failed to seed AI advisors" });
    }
  });

  // ==================== MESSAGING ROUTES ====================

  // Get all conversations for current user
  app.get("/api/messages/conversations", requireAuth, async (req, res) => {
    try {
      const conversations = await storage.getUserConversations(req.session.userId!);
      res.json(conversations);
    } catch (error) {
      console.error("Get conversations error:", error);
      res.status(500).json({ error: "Failed to get conversations" });
    }
  });

  // Get or create direct message conversation with another user
  app.post("/api/messages/conversations/direct", requireAuth, async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      const conversation = await storage.getOrCreateDirectConversation(req.session.userId!, userId);
      const conversations = await storage.getUserConversations(req.session.userId!);
      const fullConversation = conversations.find(c => c.id === conversation.id);
      
      res.json(fullConversation || conversation);
    } catch (error) {
      console.error("Create direct conversation error:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  // Create a group conversation
  app.post("/api/messages/conversations/group", requireAuth, async (req, res) => {
    try {
      const { name, memberIds } = req.body;
      if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
        return res.status(400).json({ error: "At least one member is required" });
      }

      const conversation = await storage.createConversation(
        { name, isGroup: true, createdById: req.session.userId! },
        memberIds
      );
      
      const conversations = await storage.getUserConversations(req.session.userId!);
      const fullConversation = conversations.find(c => c.id === conversation.id);
      
      res.json(fullConversation || conversation);
    } catch (error) {
      console.error("Create group conversation error:", error);
      res.status(500).json({ error: "Failed to create group conversation" });
    }
  });

  // Get messages for a conversation
  app.get("/api/messages/conversations/:conversationId/messages", requireAuth, async (req, res) => {
    try {
      const { conversationId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const before = req.query.before ? new Date(req.query.before as string) : undefined;

      // Verify user is a member of this conversation (efficient check)
      const isMember = await storage.isConversationMember(conversationId, req.session.userId!);
      
      if (!isMember) {
        return res.status(403).json({ error: "Access denied" });
      }

      const messages = await storage.getMessages(conversationId, limit, before);
      res.json(messages);
    } catch (error) {
      console.error("Get messages error:", error);
      res.status(500).json({ error: "Failed to get messages" });
    }
  });

  // Send a message
  app.post("/api/messages/conversations/:conversationId/messages", requireAuth, async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { content } = req.body;

      if (!content || typeof content !== 'string' || content.trim() === '') {
        return res.status(400).json({ error: "Message content is required" });
      }

      // Verify user is a member of this conversation (efficient check)
      const isMember = await storage.isConversationMember(conversationId, req.session.userId!);
      
      if (!isMember) {
        return res.status(403).json({ error: "Access denied" });
      }

      const message = await storage.createMessage({
        conversationId,
        senderId: req.session.userId!,
        content: content.trim(),
      });

      // Get sender info for the response
      const user = await storage.getUser(req.session.userId!);
      const messageWithSender = {
        ...message,
        sender: user ? { id: user.id, name: user.name, role: user.role } : null,
      };

      res.json(messageWithSender);
    } catch (error) {
      console.error("Send message error:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Mark conversation as read
  app.post("/api/messages/conversations/:conversationId/read", requireAuth, async (req, res) => {
    try {
      const { conversationId } = req.params;
      
      // Verify user is a member of this conversation
      const isMember = await storage.isConversationMember(conversationId, req.session.userId!);
      if (!isMember) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      await storage.markConversationRead(conversationId, req.session.userId!);
      res.json({ success: true });
    } catch (error) {
      console.error("Mark read error:", error);
      res.status(500).json({ error: "Failed to mark conversation as read" });
    }
  });

  // Get total unread count
  app.get("/api/messages/unread-count", requireAuth, async (req, res) => {
    try {
      const count = await storage.getUnreadCount(req.session.userId!);
      res.json({ count });
    } catch (error) {
      console.error("Get unread count error:", error);
      res.status(500).json({ error: "Failed to get unread count" });
    }
  });

  // Get all users for starting new conversations
  app.get("/api/messages/users", requireAuth, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      // Exclude current user and return only necessary fields
      const users = allUsers
        .filter(u => u.id !== req.session.userId)
        .map(u => ({ id: u.id, name: u.name, role: u.role }));
      res.json(users);
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ error: "Failed to get users" });
    }
  });

  return httpServer;
}
