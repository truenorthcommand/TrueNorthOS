import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcrypt";
import crypto from "crypto";
import OpenAI from "openai";
import { TOTP, Secret } from "otpauth";
import QRCode from "qrcode";
import Stripe from "stripe";
import { storage } from "./storage";
import { pool } from "./db";
import { insertJobSchema, insertAiAdvisorSchema, insertVehicleSchema, insertWalkaroundCheckSchema, insertCheckItemSchema, insertDefectSchema, insertDefectUpdateSchema, insertTimesheetSchema, insertExpenseSchema, insertPaymentSchema } from "@shared/schema";
import { z } from "zod";
import { notifyAdmins, notifyUser } from "./notifications";
import { sessionMiddleware } from "./session";

function getStripeClient(): Stripe | null {
  if (process.env.STRIPE_SECRET_KEY) {
    return new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-12-15.clover",
    });
  }
  return null;
}

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

const hasRole = (userRoles: string[] | null | undefined, requiredRoles: string[]): boolean => {
  if (!userRoles || !Array.isArray(userRoles)) return false;
  return requiredRoles.some(role => userRoles.includes(role));
};

const requireRoles = (...allowedRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }
    if (user.superAdmin) {
      return next();
    }
    const userRoles = (user.roles as string[]) || [user.role];
    if (hasRole(userRoles, allowedRoles)) {
      return next();
    }
    return res.status(403).json({ error: `Access denied. Requires one of: ${allowedRoles.join(', ')}` });
  };
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

      const userRoles = (user.roles as string[]) || [user.role];
      
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        roles: userRoles,
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
      const userRoles = (user.roles as string[]) || [user.role];
      const userSkills = await storage.getUserSkills(user.id);
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        roles: userRoles,
        skills: userSkills,
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

      const { name, email, phone, username, password, role, roles, addressLine1, addressLine2, city, county, homePostcode } = req.body;
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
      if (roles && Array.isArray(roles)) {
        updates.roles = roles;
      }
      if (addressLine1 !== undefined) updates.addressLine1 = addressLine1 || null;
      if (addressLine2 !== undefined) updates.addressLine2 = addressLine2 || null;
      if (city !== undefined) updates.city = city || null;
      if (county !== undefined) updates.county = county || null;
      if (homePostcode !== undefined) updates.homePostcode = homePostcode || null;

      const updatedUser = await storage.updateUser(req.params.id, updates);
      res.json({
        id: updatedUser!.id,
        name: updatedUser!.name,
        email: updatedUser!.email,
        phone: updatedUser!.phone,
        role: updatedUser!.role,
        roles: updatedUser!.roles,
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

  // ==================== SKILLS ROUTES (PROTECTED) ====================

  app.get("/api/skills", requireAuth, async (req, res) => {
    try {
      const skillsList = await storage.getAllSkills();
      res.json(skillsList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch skills" });
    }
  });

  app.get("/api/users/:id/skills", requireAuth, async (req, res) => {
    try {
      const userSkills = await storage.getUserSkills(req.params.id);
      res.json(userSkills);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user skills" });
    }
  });

  app.post("/api/users/:id/skills", requireAdmin, async (req, res) => {
    try {
      const { skillId } = req.body;
      if (!skillId) {
        return res.status(400).json({ error: "skillId is required" });
      }
      await storage.addUserSkill(req.params.id, skillId);
      res.status(201).json({ message: "Skill added to user" });
    } catch (error) {
      res.status(500).json({ error: "Failed to add skill to user" });
    }
  });

  app.delete("/api/users/:id/skills/:skillId", requireAdmin, async (req, res) => {
    try {
      await storage.removeUserSkill(req.params.id, req.params.skillId);
      res.json({ message: "Skill removed from user" });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove skill from user" });
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
      
      // Check if job is scheduled for today and notify assigned engineer
      if (job && job.date && job.assignedToId) {
        const jobDate = new Date(job.date);
        const today = new Date();
        const isToday = jobDate.toDateString() === today.toDateString();
        
        if (isToday) {
          notifyUser(job.assignedToId, {
            type: 'urgent_job_assigned',
            title: 'URGENT: New Job Today',
            message: `You have been assigned a new job for TODAY: ${job.customerName || 'Customer'} at ${job.address || 'Site address'}`,
            urgent: true,
            jobId: job.id,
            jobNo: job.jobNo || undefined,
            timestamp: new Date().toISOString(),
          });
        }
      }
      
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

      // Track if date is being changed
      const oldDate = existingJob.date;
      const newDate = updates.date;
      const isDateChanging = newDate !== undefined && newDate !== null;

      // Convert date string to Date object for Drizzle
      if (updates.date !== undefined) {
        updates.date = updates.date ? new Date(updates.date) : null;
      }

      const job = await storage.updateJob(req.params.id, updates);
      
      // Check if job was rescheduled to today and notify assigned engineer
      if (job && isDateChanging && job.assignedToId) {
        const jobDate = new Date(newDate);
        const today = new Date();
        const isRescheduledToToday = jobDate.toDateString() === today.toDateString();
        const wasNotToday = !oldDate || new Date(oldDate).toDateString() !== today.toDateString();
        
        if (isRescheduledToToday && wasNotToday) {
          notifyUser(job.assignedToId, {
            type: 'job_rescheduled_today',
            title: 'Job Rescheduled to Today',
            message: `Job ${job.jobNo || ''} for ${job.customerName || 'Customer'} has been rescheduled to TODAY.`,
            jobId: job.id,
            jobNo: job.jobNo || undefined,
            timestamp: new Date().toISOString(),
          });
        }
      }
      
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

  // Voice notes summarization for field engineers
  app.post("/api/ai/summarize-notes", requireAuth, async (req, res) => {
    try {
      const openai = getOpenAIClient();
      if (!openai) {
        return res.status(503).json({ error: "AI service not configured" });
      }

      const { transcript, jobContext } = req.body;
      
      if (!transcript || typeof transcript !== 'string') {
        return res.status(400).json({ error: "Transcript is required" });
      }

      // Require minimum content to avoid empty/too-short transcripts
      const trimmedTranscript = transcript.trim();
      if (trimmedTranscript.length < 10) {
        return res.status(400).json({ error: "Transcript is too short. Please record more content." });
      }

      const systemPrompt = `You are a professional assistant for field service engineers. Your job is to process spoken voice notes and convert them into professional documentation.

Given a raw voice transcript from an engineer on-site, you must:
1. Clean up the text - fix any transcription errors, remove filler words (um, uh, like, you know), and correct grammar
2. Create a professional summary suitable for client-facing job updates
3. Extract any action items or follow-up tasks mentioned

Keep the engineer's meaning intact but make it clear and professional. The output should be suitable for formal job documentation and client communication.

${jobContext ? `Job Context: ${jobContext}` : ''}

Respond in JSON format with the following structure:
{
  "cleanedNotes": "The cleaned up version of the transcript",
  "clientSummary": "A professional, client-friendly summary suitable for job updates",
  "actionItems": ["Array of action items if any were mentioned"]
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Process this voice note transcript:\n\n${transcript}` }
        ],
        max_completion_tokens: 2048,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("No response from AI");
      }

      const result = JSON.parse(content);
      
      res.json({
        original: transcript,
        cleanedNotes: result.cleanedNotes || transcript,
        clientSummary: result.clientSummary || result.cleanedNotes || transcript,
        actionItems: result.actionItems || []
      });
    } catch (error: any) {
      console.error("Voice notes summarize error:", error);
      res.status(500).json({ error: error.message || "Failed to summarize voice notes" });
    }
  });

  // ==================== QUOTE PRICING ADVISOR ====================

  // Get AI-powered quote suggestions based on job description
  app.get("/api/ai/quote-suggestions", requireAdmin, async (req, res) => {
    try {
      const openai = getOpenAIClient();
      if (!openai) {
        return res.status(503).json({ error: "AI service not configured" });
      }

      const { description } = req.query;
      if (!description || typeof description !== 'string') {
        return res.status(400).json({ error: "Job description is required" });
      }

      // Fetch historical data from quotes and invoices
      const [allQuotes, allInvoices] = await Promise.all([
        storage.getAllQuotes(),
        storage.getAllInvoices()
      ]);

      // Extract relevant pricing data from historical records
      const historicalData: { description: string; lineItems: any[]; total: number; status: string }[] = [];

      for (const quote of allQuotes) {
        if (quote.status === 'Accepted' || quote.status === 'Converted') {
          historicalData.push({
            description: quote.description || '',
            lineItems: (quote.lineItems as any[]) || [],
            total: quote.total || 0,
            status: quote.status
          });
        }
      }

      for (const invoice of allInvoices) {
        if (invoice.status === 'Paid') {
          historicalData.push({
            description: invoice.notes || '',
            lineItems: (invoice.lineItems as any[]) || [],
            total: invoice.total || 0,
            status: invoice.status
          });
        }
      }

      // Calculate average prices for common line item types
      const priceStats: Record<string, { prices: number[]; avg: number; min: number; max: number }> = {};
      for (const record of historicalData) {
        for (const item of record.lineItems) {
          if (item.description && item.unitCost > 0) {
            const key = item.description.toLowerCase().trim();
            if (!priceStats[key]) {
              priceStats[key] = { prices: [], avg: 0, min: 0, max: 0 };
            }
            priceStats[key].prices.push(item.unitCost);
          }
        }
      }

      // Calculate statistics
      for (const key in priceStats) {
        const prices = priceStats[key].prices;
        priceStats[key].avg = prices.reduce((a, b) => a + b, 0) / prices.length;
        priceStats[key].min = Math.min(...prices);
        priceStats[key].max = Math.max(...prices);
      }

      const systemPrompt = `You are a pricing advisor for a field service business. Based on historical quote and invoice data, suggest appropriate line items and pricing for new quotes.

Historical Pricing Data Summary:
${Object.entries(priceStats).slice(0, 50).map(([desc, stats]) => 
  `- "${desc}": avg £${stats.avg.toFixed(2)}, range £${stats.min.toFixed(2)}-£${stats.max.toFixed(2)} (${stats.prices.length} records)`
).join('\n')}

Recent Successful Jobs (last 10):
${historicalData.slice(0, 10).map(job => 
  `- Description: "${job.description?.substring(0, 100) || 'N/A'}", Total: £${job.total.toFixed(2)}, Items: ${job.lineItems.length}`
).join('\n')}

Respond with a JSON object containing:
{
  "suggestedLineItems": [
    {
      "description": "Item description",
      "quantity": 1,
      "unitCost": 100.00,
      "confidence": "high|medium|low",
      "reasoning": "Why this price was suggested"
    }
  ],
  "estimatedTotal": 500.00,
  "similarJobs": [
    {
      "description": "Similar job brief description",
      "total": 450.00
    }
  ],
  "notes": "Any additional pricing notes or recommendations"
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate suggested line items and pricing for this job:\n\n${description}` }
        ],
        max_completion_tokens: 2048,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("No response from AI");
      }

      const result = JSON.parse(content);
      
      res.json({
        suggestions: result.suggestedLineItems || [],
        estimatedTotal: result.estimatedTotal || 0,
        similarJobs: result.similarJobs || [],
        notes: result.notes || '',
        historicalDataCount: historicalData.length
      });
    } catch (error: any) {
      console.error("Quote suggestions error:", error);
      res.status(500).json({ error: error.message || "Failed to generate quote suggestions" });
    }
  });

  // Analyze a draft quote against historical data
  app.post("/api/ai/analyze-quote", requireAdmin, async (req, res) => {
    try {
      const openai = getOpenAIClient();
      if (!openai) {
        return res.status(503).json({ error: "AI service not configured" });
      }

      const { lineItems, subtotal, total, description } = req.body;
      
      if (!lineItems || !Array.isArray(lineItems)) {
        return res.status(400).json({ error: "Line items array is required" });
      }

      // Fetch historical data
      const [allQuotes, allInvoices] = await Promise.all([
        storage.getAllQuotes(),
        storage.getAllInvoices()
      ]);

      // Build price statistics from historical data
      const priceStats: Record<string, { prices: number[]; avg: number; min: number; max: number; count: number }> = {};
      
      const processLineItems = (items: any[]) => {
        for (const item of items) {
          if (item.description && item.unitCost > 0) {
            const key = item.description.toLowerCase().trim();
            if (!priceStats[key]) {
              priceStats[key] = { prices: [], avg: 0, min: 0, max: 0, count: 0 };
            }
            priceStats[key].prices.push(item.unitCost);
          }
        }
      };

      for (const quote of allQuotes) {
        if (quote.status === 'Accepted' || quote.status === 'Converted') {
          processLineItems((quote.lineItems as any[]) || []);
        }
      }

      for (const invoice of allInvoices) {
        if (invoice.status === 'Paid') {
          processLineItems((invoice.lineItems as any[]) || []);
        }
      }

      // Calculate statistics
      for (const key in priceStats) {
        const prices = priceStats[key].prices;
        priceStats[key].avg = prices.reduce((a, b) => a + b, 0) / prices.length;
        priceStats[key].min = Math.min(...prices);
        priceStats[key].max = Math.max(...prices);
        priceStats[key].count = prices.length;
      }

      // Check for underpriced items
      const warnings: { itemDescription: string; currentPrice: number; avgPrice: number; percentBelow: number; severity: string }[] = [];
      
      for (const item of lineItems) {
        if (item.description && item.unitCost > 0) {
          const key = item.description.toLowerCase().trim();
          const stats = priceStats[key];
          
          if (stats && stats.count >= 2) {
            const percentBelow = ((stats.avg - item.unitCost) / stats.avg) * 100;
            if (percentBelow > 15) {
              warnings.push({
                itemDescription: item.description,
                currentPrice: item.unitCost,
                avgPrice: stats.avg,
                percentBelow: Math.round(percentBelow),
                severity: percentBelow > 30 ? 'high' : 'medium'
              });
            }
          }
        }
      }

      const systemPrompt = `You are a pricing advisor for a field service business. Analyze this quote against historical pricing data and provide recommendations.

Historical Pricing Statistics (from successful quotes/invoices):
${Object.entries(priceStats).slice(0, 40).map(([desc, stats]) => 
  `- "${desc}": avg £${stats.avg.toFixed(2)}, range £${stats.min.toFixed(2)}-£${stats.max.toFixed(2)} (${stats.count} records)`
).join('\n')}

Quote Being Analyzed:
${lineItems.map((item: any) => 
  `- "${item.description}": Qty ${item.quantity}, Unit £${item.unitCost?.toFixed(2) || '0.00'}, Total £${item.amount?.toFixed(2) || '0.00'}`
).join('\n')}

Subtotal: £${(subtotal || 0).toFixed(2)}
Total (inc VAT): £${(total || 0).toFixed(2)}
${description ? `Job Description: ${description}` : ''}

Pre-identified potential underpricing warnings:
${warnings.length > 0 ? warnings.map(w => 
  `- "${w.itemDescription}": £${w.currentPrice.toFixed(2)} vs avg £${w.avgPrice.toFixed(2)} (${w.percentBelow}% below)`
).join('\n') : 'None detected'}

Respond with a JSON object:
{
  "overallAssessment": "good|caution|warning",
  "assessmentSummary": "Brief overall assessment of the quote pricing",
  "underpricedItems": [
    {
      "description": "Item name",
      "currentPrice": 50.00,
      "suggestedPrice": 75.00,
      "historicalAverage": 72.50,
      "reasoning": "Why this appears underpriced"
    }
  ],
  "recommendations": [
    "Specific recommendation 1",
    "Specific recommendation 2"
  ],
  "similarJobsComparison": {
    "averageTotal": 500.00,
    "thisQuoteVsAverage": "-10%",
    "assessment": "Brief comparison assessment"
  }
}`;

      const historicalDataCount = Object.keys(priceStats).length;
      
      // If no historical data, provide a basic response without AI
      if (historicalDataCount === 0) {
        return res.json({
          overallAssessment: 'good',
          assessmentSummary: 'No historical pricing data available yet. As you complete more jobs, the system will learn your typical pricing and provide better recommendations.',
          underpricedItems: [],
          recommendations: [
            'Continue using the system to build up pricing history.',
            'Once you have accepted quotes and paid invoices, this tool will compare against your historical data.',
            'Consider reviewing market rates for similar services in your area.'
          ],
          similarJobsComparison: null,
          warnings: [],
          historicalDataCount: 0
        });
      }

      // Try AI analysis with retry, gracefully falling back on any failure
      let result = null;
      let aiError = null;
      
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(`Analyze quote: attempt ${attempt}`);
          const response = await openai.chat.completions.create({
            model: "gpt-5",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: "Analyze this quote and provide pricing recommendations. Return valid JSON." }
            ],
            max_completion_tokens: 2048,
            response_format: { type: "json_object" }
          });

          const content = response.choices[0]?.message?.content;
          if (!content) {
            console.log(`Analyze quote: attempt ${attempt} returned empty content`);
            if (attempt < 2) continue;
            aiError = "Empty response from AI";
          } else {
            result = JSON.parse(content);
            console.log(`Analyze quote: attempt ${attempt} succeeded`);
            break;
          }
        } catch (err: any) {
          console.log(`Analyze quote: attempt ${attempt} failed - ${err.message}`);
          aiError = err.message;
          if (attempt < 2) continue;
        }
      }
      
      // Use fallback if AI failed - don't throw, just provide computed analysis
      if (!result) {
        console.log(`Analyze quote: using fallback due to: ${aiError}`);
        result = {
          overallAssessment: warnings.length > 0 ? 'caution' : 'good',
          assessmentSummary: warnings.length > 0 
            ? 'Some items may be priced below your historical averages. Review the warnings below.'
            : 'Pricing appears consistent with your historical data.',
          underpricedItems: [],
          recommendations: warnings.length > 0 
            ? ['Consider reviewing highlighted items before sending this quote.']
            : ['Quote pricing looks appropriate based on your history.'],
          similarJobsComparison: null
        };
      }
      
      res.json({
        overallAssessment: result.overallAssessment || 'good',
        assessmentSummary: result.assessmentSummary || '',
        underpricedItems: result.underpricedItems || [],
        recommendations: result.recommendations || [],
        similarJobsComparison: result.similarJobsComparison || null,
        warnings,
        historicalDataCount
      });
    } catch (error: any) {
      console.error("Analyze quote error:", error);
      res.status(500).json({ error: error.message || "Failed to analyze quote" });
    }
  });

  // Interactive User Guide AI Assistant
  app.post("/api/ai/user-guide", requireAuth, async (req, res) => {
    try {
      const openai = getOpenAIClient();
      if (!openai) {
        return res.status(503).json({ error: "AI service not configured" });
      }

      const { question, history } = req.body;
      
      if (!question || typeof question !== 'string') {
        return res.status(400).json({ error: "Question is required" });
      }

      const systemPrompt = `You are the official User Guide Assistant for TrueNorth Field View - a Field Service ERP Suite for UK field engineers and tradespeople. You ONLY answer questions about this application. If asked about anything unrelated to TrueNorth Field View, politely redirect the user to ask about the app.

## About TrueNorth Field View

TrueNorth Field View is a "business in a box" platform that enables field service companies to manage all aspects of their operation digitally. It includes six integrated modules:

### 1. Operations Module
- **Job Management**: Create, assign, and track jobs through their full lifecycle (Pending → In Progress → Completed → Signed Off)
- **Quoting**: Create professional quotes with line items, UK VAT calculations (0%, 5%, 20%), and send to clients via email with a unique link
- **Invoicing**: Generate invoices from completed jobs, track payments, and manage bank transfer details
- **Client CRM**: Manage client records with automatic creation from jobs, store contact details and addresses
- **Quote-to-Job Workflow**: Accept quotes through client portal to automatically create jobs
- **Photo Evidence**: Upload admin reference photos and engineer evidence photos
- **Digital Signatures**: Capture engineer and customer signatures for sign-off
- **Long-running Jobs**: Track multi-day jobs with daily progress updates

### 2. Finance Module
- **Timesheets**: Clock in/out with automatic time tracking, approval workflow for admins
- **Expense Tracking**: Submit expenses with receipt uploads, approval workflow
- **Mileage Calculator**: Uses HMRC rates (45p/mile for first 10,000, 25p/mile thereafter)
- **Payment Collection**: Track payments against invoices, record payment methods
- **Financial Analytics**: View revenue, expenses, and profit/loss reports

### 3. Fleet Module
- **Vehicle Registry**: Add and manage company vehicles with registration, make, model, year
- **Walkaround Checks**: Daily pre-use and post-use vehicle inspections
- **Check Items**: Tyres, lights, brakes, oil, water, windscreen, mirrors, fuel, cleanliness
- **Defect Reporting**: Report vehicle defects with severity levels (Low/Medium/High/Critical)
- **Defect Workflow**: Open → In Progress → Resolved → Closed with update history
- **Vehicle Status**: Active / Off Road / In Maintenance tracking

### 4. Workforce Module
- **Team Messaging**: WhatsApp-style chat with direct messages and group conversations
- **Live GPS Tracking**: Real-time engineer locations on map with history
- **Role-based Access**: Admin (full access), Engineer (assigned jobs only), Super Admin
- **Weekly Planner**: View and plan engineer schedules
- **Engineer Assignment**: Assign engineers to jobs and manage workloads

### 5. Compliance Module
- **Two-Factor Authentication (2FA)**: TOTP-based 2FA using authenticator apps
- **GDPR Compliance**: Consent tracking, data export requests, deletion requests
- **Geo-verified Sign-offs**: Location capture with reverse geocoding for job sign-offs
- **Audit Trails**: Full history of changes and actions

### 6. Intelligence Module (AI-Powered)
- **Technical Advisors**: Snagging Pro (quality assessment), Trade Parts Finder (UK parts), Gas & Heating Expert (boilers, Gas Safe), Electrical Expert (BS 7671 wiring regulations)
- **AI Writing Assistant**: Spelling/grammar correction, voice-to-text transcription
- **Voice Notes**: Speech-to-text with AI summarization for job updates
- **Quote Pricing Advisor**: AI-powered pricing suggestions based on historical data

## User Roles
- **Admin**: Full access to all features including settings, staff management, all jobs
- **Engineer**: Access to assigned jobs, timesheets, expenses, fleet checks, messaging
- **Super Admin**: All admin features plus system-wide configuration

## Key Features
- PWA Support: Install as mobile app with offline caching
- UK-Focused: HMRC mileage rates, UK VAT, Gas Safe references, BS 7671

## How to Use Key Features

### Creating a Job
1. Go to Jobs List
2. Click "Create Job"
3. Fill in client, customer, address, description
4. Assign an engineer
5. Save the job

### Creating and Sending a Quote
1. Go to Quotes
2. Click "New Quote"
3. Add line items with descriptions and prices
4. Set VAT rate
5. Use "Check Pricing" to validate against historical data
6. Send to client via their unique link

### Tracking Expenses
1. Go to Finance → Expenses
2. Click "Add Expense"
3. Enter amount, category, description
4. Upload receipt photo
5. Submit for approval (Admin approves)

### Vehicle Walkaround Check
1. Go to Fleet → Walkaround Check
2. Select your vehicle
3. Choose Pre-Use or Post-Use check
4. Go through each item (Tyres, Lights, etc.)
5. Mark Pass, Fail, or N/A for each
6. Report any defects found
7. Submit the check

### Using AI Advisors
1. Go to Tools → Technical Advisor
2. Select an advisor (e.g., Gas & Heating Expert)
3. Type your question or describe your problem
4. Attach photos if relevant
5. Get expert guidance and recommendations

## Important Rules
1. ONLY answer questions about TrueNorth Field View
2. If asked about general trade advice, coding, weather, or anything unrelated, politely say: "I can only help with questions about TrueNorth Field View. Is there something about the app I can help you with?"
3. Be helpful, concise, and practical
4. Reference specific features and navigation paths
5. If you don't know something about the app, say so rather than making it up`;

      const messages: any[] = [
        { role: "system", content: systemPrompt }
      ];

      // Add sanitized conversation history for context
      // SECURITY: Only allow "user" and "assistant" roles to prevent prompt injection
      if (history && Array.isArray(history)) {
        const allowedRoles = new Set(["user", "assistant"]);
        for (const msg of history.slice(-6)) {
          if (msg && typeof msg.role === 'string' && typeof msg.content === 'string' && allowedRoles.has(msg.role)) {
            // Truncate content to prevent excessively long history
            const sanitizedContent = msg.content.slice(0, 2000);
            messages.push({ role: msg.role, content: sanitizedContent });
          }
        }
      }

      messages.push({ role: "user", content: question.slice(0, 2000) });

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages,
        max_completion_tokens: 1024,
      });

      const answer = response.choices[0]?.message?.content?.trim();
      if (!answer) {
        throw new Error("No response from AI");
      }

      res.json({ answer });
    } catch (error: any) {
      console.error("User guide AI error:", error);
      res.status(500).json({ error: error.message || "Failed to get guidance" });
    }
  });

  // ==================== AI-POWERED ENGINEER ASSIGNMENT ====================

  // Get AI-powered engineer suggestions for a job based on skills, location, and workload
  app.get("/api/ai/suggest-engineers/:jobId", requireRoles('admin'), async (req, res) => {
    try {
      const job = await storage.getJob(req.params.jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Get all engineers (users with 'engineer' role)
      const allUsers = await storage.getAllUsers();
      const engineers = allUsers.filter(u => {
        const userRoles = (u.roles as string[]) || [u.role];
        return userRoles.includes('engineer');
      });

      if (engineers.length === 0) {
        return res.json({ suggestions: [], message: "No engineers available" });
      }

      // Get all jobs to calculate workload
      const allJobs = await storage.getAllJobs();
      const activeJobs = allJobs.filter(j => j.status !== 'Signed Off');

      // Calculate workload per engineer
      const workloadMap: Record<string, number> = {};
      for (const j of activeJobs) {
        const assignedIds = (j.assignedToIds as string[]) || (j.assignedToId ? [j.assignedToId] : []);
        for (const id of assignedIds) {
          workloadMap[id] = (workloadMap[id] || 0) + 1;
        }
      }

      // Get skills for each engineer
      const engineerData = await Promise.all(engineers.map(async (eng) => {
        const skills = await storage.getUserSkills(eng.id);
        return {
          id: eng.id,
          name: eng.name,
          skills: skills.map(s => s.name),
          currentWorkload: workloadMap[eng.id] || 0,
          homePostcode: eng.homePostcode || null,
          homeLat: eng.homeLat as number | null,
          homeLng: eng.homeLng as number | null,
          currentLat: eng.currentLat as number | null,
          currentLng: eng.currentLng as number | null,
        };
      }));

      // Get required skills for the job (if any)
      const requiredSkills = (job.requiredSkills as string[]) || [];

      // Build context for AI
      const jobContext = {
        description: job.description || 'No description',
        address: job.address || 'No address specified',
        postcode: job.postcode || null,
        requiredSkills: requiredSkills,
        urgency: job.urgency || 'normal',
      };

      // Try AI-powered suggestions if available
      const openai = getOpenAIClient();
      if (openai) {
        try {
          const systemPrompt = `You are an AI assistant helping assign field engineers to jobs. Analyze the job requirements and engineer profiles to suggest the best matches.

Consider these factors in order of importance:
1. **Skills Match**: Engineers with relevant skills for the job type
2. **Current Workload**: Prefer engineers with fewer active jobs
3. **Location Proximity**: Engineers closer to the job site (use postcodes/coordinates if available)
4. **Availability**: Balance workload across the team

Return your response as a JSON array of engineer suggestions, ordered by suitability (best first). Each suggestion should include:
- engineerId: the engineer's ID
- score: a suitability score from 0-100
- reason: a brief explanation of why this engineer is suitable
- factors: { skills: number, workload: number, proximity: number } - individual factor scores 0-100`;

          const userPrompt = `Job Details:
${JSON.stringify(jobContext, null, 2)}

Available Engineers:
${JSON.stringify(engineerData, null, 2)}

Please analyze and rank the engineers for this job. Return only valid JSON array.`;

          const response = await openai.chat.completions.create({
            model: "gpt-5",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            max_completion_tokens: 1024,
            response_format: { type: "json_object" },
          });

          const content = response.choices[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            const suggestions = parsed.suggestions || parsed;
            
            // Enrich with engineer names
            const enrichedSuggestions = (Array.isArray(suggestions) ? suggestions : []).map((s: any) => {
              const eng = engineerData.find(e => e.id === s.engineerId);
              return {
                ...s,
                engineerName: eng?.name || 'Unknown',
                currentWorkload: eng?.currentWorkload || 0,
                skills: eng?.skills || [],
              };
            });

            return res.json({ 
              suggestions: enrichedSuggestions.slice(0, 5),
              aiPowered: true 
            });
          }
        } catch (aiError) {
          console.error("AI suggestion error, falling back to heuristic:", aiError);
        }
      }

      // Fallback: Simple heuristic-based suggestions
      const scoredEngineers = engineerData.map(eng => {
        let score = 50; // Base score

        // Skills match bonus
        if (requiredSkills.length > 0) {
          const matchCount = requiredSkills.filter(rs => 
            eng.skills.some(s => s.toLowerCase().includes(rs.toLowerCase()))
          ).length;
          score += (matchCount / requiredSkills.length) * 30;
        }

        // Workload penalty (fewer jobs = better)
        const maxWorkload = Math.max(...engineerData.map(e => e.currentWorkload), 1);
        score += ((maxWorkload - eng.currentWorkload) / maxWorkload) * 20;

        return {
          engineerId: eng.id,
          engineerName: eng.name,
          score: Math.round(score),
          reason: `${eng.currentWorkload} active jobs, ${eng.skills.length} skills`,
          currentWorkload: eng.currentWorkload,
          skills: eng.skills,
          factors: {
            skills: requiredSkills.length > 0 ? Math.round((eng.skills.length / 5) * 100) : 50,
            workload: Math.round(((maxWorkload - eng.currentWorkload) / maxWorkload) * 100),
            proximity: 50, // Unknown without geocoding
          }
        };
      });

      // Sort by score descending
      scoredEngineers.sort((a, b) => b.score - a.score);

      res.json({ 
        suggestions: scoredEngineers.slice(0, 5),
        aiPowered: false 
      });
    } catch (error: any) {
      console.error("Engineer suggestion error:", error);
      res.status(500).json({ error: error.message || "Failed to get suggestions" });
    }
  });

  // ==================== FLEET MAINTENANCE ====================

  // Get fleet dashboard stats
  app.get("/api/fleet/stats", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getFleetDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Fleet stats error:", error);
      res.status(500).json({ error: "Failed to get fleet stats" });
    }
  });

  // Get all vehicles
  app.get("/api/fleet/vehicles", requireAuth, async (req, res) => {
    try {
      const vehiclesWithStats = await storage.getVehiclesWithStats();
      res.json(vehiclesWithStats);
    } catch (error) {
      console.error("Get vehicles error:", error);
      res.status(500).json({ error: "Failed to get vehicles" });
    }
  });

  // Get single vehicle
  app.get("/api/fleet/vehicles/:id", requireAuth, async (req, res) => {
    try {
      const vehicle = await storage.getVehicle(req.params.id);
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      res.json(vehicle);
    } catch (error) {
      console.error("Get vehicle error:", error);
      res.status(500).json({ error: "Failed to get vehicle" });
    }
  });

  // Create vehicle
  app.post("/api/fleet/vehicles", requireAdmin, async (req, res) => {
    try {
      const parsed = insertVehicleSchema.parse(req.body);
      const vehicle = await storage.createVehicle(parsed);
      res.status(201).json(vehicle);
    } catch (error: any) {
      console.error("Create vehicle error:", error);
      res.status(400).json({ error: error.message || "Failed to create vehicle" });
    }
  });

  // Update vehicle
  app.patch("/api/fleet/vehicles/:id", requireAdmin, async (req, res) => {
    try {
      const vehicle = await storage.updateVehicle(req.params.id, req.body);
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      res.json(vehicle);
    } catch (error) {
      console.error("Update vehicle error:", error);
      res.status(500).json({ error: "Failed to update vehicle" });
    }
  });

  // Delete vehicle
  app.delete("/api/fleet/vehicles/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteVehicle(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete vehicle error:", error);
      res.status(500).json({ error: "Failed to delete vehicle" });
    }
  });

  // Get all walkaround checks
  app.get("/api/fleet/checks", requireAuth, async (req, res) => {
    try {
      const checks = await storage.getAllWalkaroundChecks();
      res.json(checks);
    } catch (error) {
      console.error("Get checks error:", error);
      res.status(500).json({ error: "Failed to get checks" });
    }
  });

  // Get checks for a specific vehicle
  app.get("/api/fleet/vehicles/:vehicleId/checks", requireAuth, async (req, res) => {
    try {
      const checks = await storage.getWalkaroundChecksByVehicle(req.params.vehicleId);
      res.json(checks);
    } catch (error) {
      console.error("Get vehicle checks error:", error);
      res.status(500).json({ error: "Failed to get vehicle checks" });
    }
  });

  // Get single check with details
  app.get("/api/fleet/checks/:id", requireAuth, async (req, res) => {
    try {
      const check = await storage.getWalkaroundCheckWithDetails(req.params.id);
      if (!check) {
        return res.status(404).json({ error: "Check not found" });
      }
      res.json(check);
    } catch (error) {
      console.error("Get check error:", error);
      res.status(500).json({ error: "Failed to get check" });
    }
  });

  // Create walkaround check
  app.post("/api/fleet/checks", requireAuth, async (req, res) => {
    try {
      const { items, ...checkData } = req.body;
      const parsedCheck = insertWalkaroundCheckSchema.parse({
        ...checkData,
        inspectorId: req.session.userId,
      });
      
      // Validate items
      const parsedItems = (items || []).map((item: any) => insertCheckItemSchema.parse({ ...item, checkId: '' }));
      
      // Determine overall status
      const hasFailure = parsedItems.some((item: any) => item.status === 'fail');
      parsedCheck.overallStatus = hasFailure ? 'fail' : 'pass';
      
      const check = await storage.createWalkaroundCheck(parsedCheck, parsedItems);
      
      // Auto-create defects for failed items
      if (hasFailure) {
        const failedItems = parsedItems.filter((item: any) => item.status === 'fail');
        for (const failedItem of failedItems) {
          await storage.createDefect({
            vehicleId: parsedCheck.vehicleId,
            checkId: check.id,
            category: failedItem.itemName,
            severity: failedItem.severity || 'minor',
            description: failedItem.note || `Failed ${failedItem.itemName} check`,
            photos: failedItem.photoUrl ? [failedItem.photoUrl] : [],
            vehicleOffRoad: !parsedCheck.vehicleSafeToOperate,
            reportedById: req.session.userId!,
          });
        }
        
        // Update vehicle status if not safe to operate
        if (!parsedCheck.vehicleSafeToOperate) {
          await storage.updateVehicle(parsedCheck.vehicleId, { status: 'off-road' });
        }
      }
      
      res.status(201).json(check);
    } catch (error: any) {
      console.error("Create check error:", error);
      res.status(400).json({ error: error.message || "Failed to create check" });
    }
  });

  // Get all defects
  app.get("/api/fleet/defects", requireAuth, async (req, res) => {
    try {
      const { status, severity, vehicleId } = req.query;
      let defectsData = await storage.getAllDefects();
      
      if (status) {
        defectsData = defectsData.filter(d => d.status === status);
      }
      if (severity) {
        defectsData = defectsData.filter(d => d.severity === severity);
      }
      if (vehicleId) {
        defectsData = defectsData.filter(d => d.vehicleId === vehicleId);
      }
      
      res.json(defectsData);
    } catch (error) {
      console.error("Get defects error:", error);
      res.status(500).json({ error: "Failed to get defects" });
    }
  });

  // Get open defects only
  app.get("/api/fleet/defects/open", requireAuth, async (req, res) => {
    try {
      const openDefects = await storage.getOpenDefects();
      res.json(openDefects);
    } catch (error) {
      console.error("Get open defects error:", error);
      res.status(500).json({ error: "Failed to get open defects" });
    }
  });

  // Get defects for a specific vehicle
  app.get("/api/fleet/vehicles/:vehicleId/defects", requireAuth, async (req, res) => {
    try {
      const vehicleDefects = await storage.getDefectsByVehicle(req.params.vehicleId);
      res.json(vehicleDefects);
    } catch (error) {
      console.error("Get vehicle defects error:", error);
      res.status(500).json({ error: "Failed to get vehicle defects" });
    }
  });

  // Get single defect with details
  app.get("/api/fleet/defects/:id", requireAuth, async (req, res) => {
    try {
      const defect = await storage.getDefectWithDetails(req.params.id);
      if (!defect) {
        return res.status(404).json({ error: "Defect not found" });
      }
      res.json(defect);
    } catch (error) {
      console.error("Get defect error:", error);
      res.status(500).json({ error: "Failed to get defect" });
    }
  });

  // Create defect (standalone reporting)
  app.post("/api/fleet/defects", requireAuth, async (req, res) => {
    try {
      const parsed = insertDefectSchema.parse({
        ...req.body,
        reportedById: req.session.userId,
      });
      const defect = await storage.createDefect(parsed);
      
      // If vehicle is marked off-road, update vehicle status
      if (parsed.vehicleOffRoad) {
        await storage.updateVehicle(parsed.vehicleId, { status: 'off-road' });
      }
      
      // Notify admins about the new defect
      const vehicle = await storage.getVehicle(parsed.vehicleId);
      const reporter = await storage.getUser(req.session.userId!);
      const severityLabel = parsed.severity === 'critical' ? 'CRITICAL' : 
                           parsed.severity === 'major' ? 'Major' : 'Minor';
      
      notifyAdmins({
        type: 'defect_reported',
        title: `${severityLabel} Defect Reported`,
        message: `${reporter?.name || 'An engineer'} reported a ${parsed.severity} defect on ${vehicle?.registration || 'a vehicle'}: ${parsed.description?.substring(0, 50) || 'No description'}`,
        timestamp: new Date().toISOString(),
        urgent: parsed.severity === 'critical',
      });
      
      res.status(201).json(defect);
    } catch (error: any) {
      console.error("Create defect error:", error);
      res.status(400).json({ error: error.message || "Failed to create defect" });
    }
  });

  // Update defect
  app.patch("/api/fleet/defects/:id", requireAuth, async (req, res) => {
    try {
      const oldDefect = await storage.getDefect(req.params.id);
      if (!oldDefect) {
        return res.status(404).json({ error: "Defect not found" });
      }
      
      const updates = req.body;
      const defect = await storage.updateDefect(req.params.id, updates);
      
      // Create update entry if status changed
      if (updates.status && updates.status !== oldDefect.status) {
        await storage.createDefectUpdate({
          defectId: req.params.id,
          userId: req.session.userId!,
          statusChange: updates.status,
          comment: updates.comment || `Status changed to ${updates.status}`,
        });
        
        // Update timestamps
        if (updates.status === 'resolved') {
          await storage.updateDefect(req.params.id, { resolvedAt: new Date() });
        } else if (updates.status === 'closed') {
          await storage.updateDefect(req.params.id, { closedAt: new Date() });
        }
      }
      
      res.json(defect);
    } catch (error) {
      console.error("Update defect error:", error);
      res.status(500).json({ error: "Failed to update defect" });
    }
  });

  // Add comment to defect
  app.post("/api/fleet/defects/:id/comments", requireAuth, async (req, res) => {
    try {
      const { comment } = req.body;
      if (!comment) {
        return res.status(400).json({ error: "Comment required" });
      }
      
      const update = await storage.createDefectUpdate({
        defectId: req.params.id,
        userId: req.session.userId!,
        comment,
      });
      
      res.status(201).json(update);
    } catch (error) {
      console.error("Add comment error:", error);
      res.status(500).json({ error: "Failed to add comment" });
    }
  });

  // Get defect update history
  app.get("/api/fleet/defects/:id/history", requireAuth, async (req, res) => {
    try {
      const history = await storage.getDefectUpdates(req.params.id);
      res.json(history);
    } catch (error) {
      console.error("Get defect history error:", error);
      res.status(500).json({ error: "Failed to get defect history" });
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

      // Upsert works manager demo user
      const existingWorksManager = await storage.getUserByUsername("worksmanager");
      if (existingWorksManager) {
        await storage.updateUser(existingWorksManager.id, { 
          password: "worksmanager123", 
          role: "engineer",
          roles: ["works_manager"]
        });
      } else {
        await storage.createUser({
          username: "worksmanager",
          password: "worksmanager123",
          name: "Mike Wilson",
          email: "mike@promains.com",
          role: "engineer",
          roles: ["works_manager"],
          status: "active",
        });
      }

      // Upsert fleet manager demo user
      const existingFleetManager = await storage.getUserByUsername("fleetmanager");
      if (existingFleetManager) {
        await storage.updateUser(existingFleetManager.id, { 
          password: "fleetmanager123", 
          role: "engineer",
          roles: ["fleet_manager"]
        });
      } else {
        await storage.createUser({
          username: "fleetmanager",
          password: "fleetmanager123",
          name: "Tom Driver",
          email: "tom@promains.com",
          role: "engineer",
          roles: ["fleet_manager"],
          status: "active",
        });
      }

      // Upsert surveyor demo user
      const existingSurveyor = await storage.getUserByUsername("surveyor");
      if (existingSurveyor) {
        await storage.updateUser(existingSurveyor.id, { 
          password: "surveyor123", 
          role: "engineer",
          roles: ["surveyor"]
        });
      } else {
        await storage.createUser({
          username: "surveyor",
          password: "surveyor123",
          name: "Emma Survey",
          email: "emma@promains.com",
          role: "engineer",
          roles: ["surveyor"],
          status: "active",
        });
      }

      res.json({ message: "Demo accounts reset successfully! Login with admin/admin123, worksmanager/worksmanager123, fleetmanager/fleetmanager123, surveyor/surveyor123" });
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

  // Seed fleet data
  app.post("/api/seed-fleet", async (req, res) => {
    try {
      const existingVehicles = await storage.getAllVehicles();
      if (existingVehicles.length > 0) {
        return res.json({ message: "Fleet data already seeded" });
      }

      // Get admin user for defect reporting
      const admin = await storage.getUserByUsername("admin");
      const john = await storage.getUserByUsername("john");
      if (!admin || !john) {
        return res.status(400).json({ error: "Seed users first with POST /api/seed" });
      }

      // Create sample vehicles
      const van1 = await storage.createVehicle({
        registration: "AB12 CDE",
        make: "Ford",
        model: "Transit Custom",
        year: 2022,
        type: "Van",
        status: "active",
      });

      const van2 = await storage.createVehicle({
        registration: "CD34 EFG",
        make: "Mercedes",
        model: "Sprinter",
        year: 2021,
        type: "Van",
        status: "active",
      });

      const truck = await storage.createVehicle({
        registration: "EF56 GHI",
        make: "Iveco",
        model: "Daily",
        year: 2020,
        type: "Truck",
        status: "off-road",
      });

      // Create a completed walkaround check for van1
      const check = await storage.createWalkaroundCheck({
        vehicleId: van1.id,
        checkType: "pre",
        odometer: 45230,
        inspectorId: john.id,
        overallStatus: "pass",
        vehicleSafeToOperate: true,
        notes: "Vehicle in good condition, ready for use",
      }, [
        { checkId: "", itemName: "tyres", status: "pass", note: null },
        { checkId: "", itemName: "lights", status: "pass", note: null },
        { checkId: "", itemName: "mirrors_windows", status: "pass", note: null },
        { checkId: "", itemName: "brakes", status: "pass", note: null },
        { checkId: "", itemName: "steering", status: "pass", note: null },
        { checkId: "", itemName: "fluids", status: "pass", note: null },
        { checkId: "", itemName: "leaks", status: "pass", note: null },
        { checkId: "", itemName: "wipers", status: "pass", note: null },
        { checkId: "", itemName: "body_damage", status: "pass", note: null },
        { checkId: "", itemName: "dash_warnings", status: "pass", note: null },
        { checkId: "", itemName: "doors_security", status: "pass", note: null },
      ]);

      // Create sample defects
      const defect1 = await storage.createDefect({
        vehicleId: truck.id,
        category: "brakes",
        severity: "critical",
        description: "Brake pads worn below minimum thickness. Vehicle unsafe to operate until replaced.",
        vehicleOffRoad: true,
        reportedById: john.id,
        photos: [],
      });

      const defect2 = await storage.createDefect({
        vehicleId: van2.id,
        category: "lights",
        severity: "major",
        description: "Rear left brake light not working. Bulb replacement required.",
        vehicleOffRoad: false,
        reportedById: admin.id,
        assignedToId: john.id,
        photos: [],
      });

      const defect3 = await storage.createDefect({
        vehicleId: van1.id,
        category: "body_damage",
        severity: "minor",
        description: "Small scratch on passenger door. Cosmetic only, no safety concern.",
        vehicleOffRoad: false,
        reportedById: john.id,
        photos: [],
      });

      // Add comment to defect2
      await storage.createDefectUpdate({
        defectId: defect2.id,
        userId: admin.id,
        comment: "Assigned to John for repair. Bulb ordered.",
      });

      res.json({ 
        message: "Fleet data seeded successfully",
        vehicles: 3,
        checks: 1,
        defects: 3
      });
    } catch (error) {
      console.error("Seed fleet error:", error);
      res.status(500).json({ error: "Failed to seed fleet data: " + (error as Error).message });
    }
  });

  // ==================== TIMESHEETS ROUTES ====================

  app.get("/api/timesheets", requireAuth, async (req, res) => {
    try {
      let timesheets;
      if (req.session.userRole === "admin") {
        timesheets = await storage.getAllTimesheets();
      } else {
        timesheets = await storage.getTimesheetsByUser(req.session.userId!);
      }
      res.json(timesheets);
    } catch (error) {
      console.error("Get timesheets error:", error);
      res.status(500).json({ error: "Failed to get timesheets" });
    }
  });

  app.get("/api/timesheets/active", requireAuth, async (req, res) => {
    try {
      const activeTimesheet = await storage.getActiveClockIn(req.session.userId!);
      res.json(activeTimesheet || null);
    } catch (error) {
      console.error("Get active clock-in error:", error);
      res.status(500).json({ error: "Failed to get active clock-in" });
    }
  });

  app.get("/api/timesheets/:id", requireAuth, async (req, res) => {
    try {
      const timesheet = await storage.getTimesheet(req.params.id);
      if (!timesheet) {
        return res.status(404).json({ error: "Timesheet not found" });
      }
      if (req.session.userRole !== "admin" && timesheet.userId !== req.session.userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(timesheet);
    } catch (error) {
      console.error("Get timesheet error:", error);
      res.status(500).json({ error: "Failed to get timesheet" });
    }
  });

  app.post("/api/timesheets", requireAuth, async (req, res) => {
    try {
      const data = insertTimesheetSchema.parse({
        ...req.body,
        userId: req.body.userId || req.session.userId,
      });
      if (req.session.userRole !== "admin" && data.userId !== req.session.userId) {
        return res.status(403).json({ error: "Cannot create timesheet for another user" });
      }
      const timesheet = await storage.createTimesheet(data);
      res.status(201).json(timesheet);
    } catch (error) {
      console.error("Create timesheet error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create timesheet" });
    }
  });

  app.post("/api/timesheets/clock-in", requireAuth, async (req, res) => {
    try {
      const existingActive = await storage.getActiveClockIn(req.session.userId!);
      if (existingActive) {
        return res.status(400).json({ error: "Already clocked in. Please clock out first." });
      }
      const now = new Date();
      const timesheet = await storage.createTimesheet({
        userId: req.session.userId!,
        date: now,
        clockIn: now,
        status: "pending",
      });
      res.status(201).json(timesheet);
    } catch (error) {
      console.error("Clock in error:", error);
      res.status(500).json({ error: "Failed to clock in" });
    }
  });

  app.post("/api/timesheets/clock-out", requireAuth, async (req, res) => {
    try {
      const activeTimesheet = await storage.getActiveClockIn(req.session.userId!);
      if (!activeTimesheet) {
        return res.status(400).json({ error: "No active clock-in found" });
      }
      const clockOut = new Date();
      const clockIn = new Date(activeTimesheet.clockIn!);
      const breakMinutes = activeTimesheet.breakMinutes || 0;
      const diffMs = clockOut.getTime() - clockIn.getTime();
      const totalHours = (diffMs / (1000 * 60 * 60)) - (breakMinutes / 60);
      const updated = await storage.updateTimesheet(activeTimesheet.id, {
        clockOut,
        totalHours: Math.max(0, totalHours),
      });
      res.json(updated);
    } catch (error) {
      console.error("Clock out error:", error);
      res.status(500).json({ error: "Failed to clock out" });
    }
  });

  app.put("/api/timesheets/:id", requireAuth, async (req, res) => {
    try {
      const timesheet = await storage.getTimesheet(req.params.id);
      if (!timesheet) {
        return res.status(404).json({ error: "Timesheet not found" });
      }
      if (req.session.userRole !== "admin" && timesheet.userId !== req.session.userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const updated = await storage.updateTimesheet(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Update timesheet error:", error);
      res.status(500).json({ error: "Failed to update timesheet" });
    }
  });

  app.delete("/api/timesheets/:id", requireAdmin, async (req, res) => {
    try {
      const timesheet = await storage.getTimesheet(req.params.id);
      if (!timesheet) {
        return res.status(404).json({ error: "Timesheet not found" });
      }
      await storage.deleteTimesheet(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete timesheet error:", error);
      res.status(500).json({ error: "Failed to delete timesheet" });
    }
  });

  app.put("/api/timesheets/:id/approve", requireAdmin, async (req, res) => {
    try {
      const timesheet = await storage.getTimesheet(req.params.id);
      if (!timesheet) {
        return res.status(404).json({ error: "Timesheet not found" });
      }
      const updated = await storage.updateTimesheet(req.params.id, {
        status: "approved",
        approvedById: req.session.userId,
        approvedAt: new Date(),
      });
      res.json(updated);
    } catch (error) {
      console.error("Approve timesheet error:", error);
      res.status(500).json({ error: "Failed to approve timesheet" });
    }
  });

  app.put("/api/timesheets/:id/reject", requireAdmin, async (req, res) => {
    try {
      const timesheet = await storage.getTimesheet(req.params.id);
      if (!timesheet) {
        return res.status(404).json({ error: "Timesheet not found" });
      }
      const updated = await storage.updateTimesheet(req.params.id, {
        status: "rejected",
        approvedById: req.session.userId,
        approvedAt: new Date(),
      });
      res.json(updated);
    } catch (error) {
      console.error("Reject timesheet error:", error);
      res.status(500).json({ error: "Failed to reject timesheet" });
    }
  });

  // ==================== EXPENSES ROUTES ====================

  app.get("/api/expenses", requireAuth, async (req, res) => {
    try {
      let expenses;
      if (req.session.userRole === "admin") {
        expenses = await storage.getAllExpenses();
      } else {
        expenses = await storage.getExpensesByUser(req.session.userId!);
      }
      res.json(expenses);
    } catch (error) {
      console.error("Get expenses error:", error);
      res.status(500).json({ error: "Failed to get expenses" });
    }
  });

  app.get("/api/expenses/:id", requireAuth, async (req, res) => {
    try {
      const expense = await storage.getExpense(req.params.id);
      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }
      if (req.session.userRole !== "admin" && expense.userId !== req.session.userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(expense);
    } catch (error) {
      console.error("Get expense error:", error);
      res.status(500).json({ error: "Failed to get expense" });
    }
  });

  app.post("/api/expenses", requireAuth, async (req, res) => {
    try {
      const data = insertExpenseSchema.parse({
        ...req.body,
        userId: req.body.userId || req.session.userId,
      });
      if (req.session.userRole !== "admin" && data.userId !== req.session.userId) {
        return res.status(403).json({ error: "Cannot create expense for another user" });
      }
      const expense = await storage.createExpense(data);
      res.status(201).json(expense);
    } catch (error) {
      console.error("Create expense error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create expense" });
    }
  });

  app.put("/api/expenses/:id", requireAuth, async (req, res) => {
    try {
      const expense = await storage.getExpense(req.params.id);
      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }
      if (req.session.userRole !== "admin" && expense.userId !== req.session.userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const updated = await storage.updateExpense(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Update expense error:", error);
      res.status(500).json({ error: "Failed to update expense" });
    }
  });

  app.delete("/api/expenses/:id", requireAuth, async (req, res) => {
    try {
      const expense = await storage.getExpense(req.params.id);
      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }
      if (req.session.userRole !== "admin" && expense.userId !== req.session.userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      await storage.deleteExpense(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete expense error:", error);
      res.status(500).json({ error: "Failed to delete expense" });
    }
  });

  app.put("/api/expenses/:id/approve", requireAdmin, async (req, res) => {
    try {
      const expense = await storage.getExpense(req.params.id);
      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }
      const updated = await storage.updateExpense(req.params.id, {
        status: "approved",
        approvedById: req.session.userId,
        approvedAt: new Date(),
      });
      
      // Notify the engineer who submitted the expense
      if (expense.userId) {
        notifyUser(expense.userId, {
          type: 'expense_approved',
          title: 'Expense Approved',
          message: `Your expense claim for £${expense.amount?.toFixed(2) || '0.00'} has been approved.`,
          expenseId: expense.id,
          timestamp: new Date().toISOString(),
        });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Approve expense error:", error);
      res.status(500).json({ error: "Failed to approve expense" });
    }
  });

  app.put("/api/expenses/:id/reject", requireAdmin, async (req, res) => {
    try {
      const expense = await storage.getExpense(req.params.id);
      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }
      const updated = await storage.updateExpense(req.params.id, {
        status: "rejected",
        approvedById: req.session.userId,
        approvedAt: new Date(),
      });
      
      // Notify the engineer who submitted the expense
      if (expense.userId) {
        notifyUser(expense.userId, {
          type: 'expense_rejected',
          title: 'Expense Rejected',
          message: `Your expense claim for £${expense.amount?.toFixed(2) || '0.00'} has been rejected.`,
          expenseId: expense.id,
          timestamp: new Date().toISOString(),
        });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Reject expense error:", error);
      res.status(500).json({ error: "Failed to reject expense" });
    }
  });

  app.put("/api/expenses/:id/mark-paid", requireAdmin, async (req, res) => {
    try {
      const expense = await storage.getExpense(req.params.id);
      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }
      const updated = await storage.updateExpense(req.params.id, {
        status: "paid",
        paidAt: new Date(),
      });
      res.json(updated);
    } catch (error) {
      console.error("Mark expense paid error:", error);
      res.status(500).json({ error: "Failed to mark expense as paid" });
    }
  });

  app.post("/api/expenses/bulk-approve", requireAdmin, async (req, res) => {
    try {
      const { expenseIds } = req.body;
      if (!Array.isArray(expenseIds) || expenseIds.length === 0) {
        return res.status(400).json({ error: "expenseIds array is required" });
      }
      
      let approvedCount = 0;
      for (const id of expenseIds) {
        const expense = await storage.getExpense(id);
        if (expense && expense.status === "pending") {
          await storage.updateExpense(id, {
            status: "approved",
            approvedById: req.session.userId,
            approvedAt: new Date(),
          });
          
          if (expense.userId) {
            notifyUser(expense.userId, {
              type: 'expense_approved',
              title: 'Expense Approved',
              message: `Your expense claim for £${expense.amount?.toFixed(2) || '0.00'} has been approved.`,
              expenseId: expense.id,
              timestamp: new Date().toISOString(),
            });
          }
          approvedCount++;
        }
      }
      
      res.json({ success: true, count: approvedCount });
    } catch (error) {
      console.error("Bulk approve expenses error:", error);
      res.status(500).json({ error: "Failed to bulk approve expenses" });
    }
  });

  app.post("/api/expenses/bulk-reject", requireAdmin, async (req, res) => {
    try {
      const { expenseIds } = req.body;
      if (!Array.isArray(expenseIds) || expenseIds.length === 0) {
        return res.status(400).json({ error: "expenseIds array is required" });
      }
      
      let rejectedCount = 0;
      for (const id of expenseIds) {
        const expense = await storage.getExpense(id);
        if (expense && expense.status === "pending") {
          await storage.updateExpense(id, {
            status: "rejected",
            approvedById: req.session.userId,
            approvedAt: new Date(),
          });
          
          if (expense.userId) {
            notifyUser(expense.userId, {
              type: 'expense_rejected',
              title: 'Expense Rejected',
              message: `Your expense claim for £${expense.amount?.toFixed(2) || '0.00'} has been rejected.`,
              expenseId: expense.id,
              timestamp: new Date().toISOString(),
            });
          }
          rejectedCount++;
        }
      }
      
      res.json({ success: true, count: rejectedCount });
    } catch (error) {
      console.error("Bulk reject expenses error:", error);
      res.status(500).json({ error: "Failed to bulk reject expenses" });
    }
  });

  app.post("/api/jobs/bulk-assign", requireAdmin, async (req, res) => {
    try {
      const { jobIds, assignedToId } = req.body;
      if (!Array.isArray(jobIds) || jobIds.length === 0) {
        return res.status(400).json({ error: "jobIds array is required" });
      }
      if (!assignedToId) {
        return res.status(400).json({ error: "assignedToId is required" });
      }
      
      const assignedUser = await storage.getUser(assignedToId);
      if (!assignedUser) {
        return res.status(404).json({ error: "Assigned user not found" });
      }
      
      let updatedCount = 0;
      for (const id of jobIds) {
        const job = await storage.getJob(id);
        if (job) {
          await storage.updateJob(id, { assignedToId });
          updatedCount++;
        }
      }
      
      res.json({ success: true, count: updatedCount });
    } catch (error) {
      console.error("Bulk assign jobs error:", error);
      res.status(500).json({ error: "Failed to bulk assign jobs" });
    }
  });

  // ==================== PAYMENTS ROUTES ====================

  app.get("/api/payments", requireAuth, async (req, res) => {
    try {
      const payments = await storage.getAllPayments();
      res.json(payments);
    } catch (error) {
      console.error("Get payments error:", error);
      res.status(500).json({ error: "Failed to get payments" });
    }
  });

  app.get("/api/payments/:id", requireAuth, async (req, res) => {
    try {
      const payment = await storage.getPayment(req.params.id);
      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }
      res.json(payment);
    } catch (error) {
      console.error("Get payment error:", error);
      res.status(500).json({ error: "Failed to get payment" });
    }
  });

  app.get("/api/invoices/:id/payments", requireAuth, async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      const payments = await storage.getPaymentsByInvoice(req.params.id);
      res.json(payments);
    } catch (error) {
      console.error("Get invoice payments error:", error);
      res.status(500).json({ error: "Failed to get invoice payments" });
    }
  });

  app.post("/api/payments", requireAuth, async (req, res) => {
    try {
      const data = insertPaymentSchema.parse(req.body);
      const invoice = await storage.getInvoice(data.invoiceId);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      const payment = await storage.createPayment(data);
      res.status(201).json(payment);
    } catch (error) {
      console.error("Create payment error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create payment" });
    }
  });

  app.put("/api/payments/:id", requireAuth, async (req, res) => {
    try {
      const payment = await storage.getPayment(req.params.id);
      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }
      const updated = await storage.updatePayment(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Update payment error:", error);
      res.status(500).json({ error: "Failed to update payment" });
    }
  });

  // ==================== STRIPE PAYMENT ROUTES ====================

  app.post("/api/stripe/create-payment-intent", async (req, res) => {
    try {
      const stripe = getStripeClient();
      if (!stripe) {
        return res.status(500).json({ error: "Stripe is not configured" });
      }

      const { invoiceId, accessToken } = req.body;
      if (!invoiceId) {
        return res.status(400).json({ error: "Invoice ID is required" });
      }

      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      const isAuthenticated = req.session?.userId;
      const isValidToken = accessToken && invoice.accessToken === accessToken;
      
      if (!isAuthenticated && !isValidToken) {
        return res.status(401).json({ error: "Unauthorized access to invoice" });
      }

      if (invoice.status?.toLowerCase() === "paid") {
        return res.status(400).json({ error: "Invoice is already paid" });
      }

      const amountInPence = Math.round((invoice.total || 0) * 100);
      if (amountInPence < 30) {
        return res.status(400).json({ error: "Amount must be at least £0.30" });
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInPence,
        currency: "gbp",
        metadata: {
          invoiceId: invoice.id,
          invoiceNo: invoice.invoiceNo,
          customerName: invoice.customerName,
        },
        description: `Payment for Invoice ${invoice.invoiceNo}`,
        receipt_email: invoice.customerEmail || undefined,
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      });
    } catch (error: any) {
      console.error("Create payment intent error:", error);
      res.status(500).json({ error: error.message || "Failed to create payment intent" });
    }
  });

  app.post("/api/stripe/webhook", async (req, res) => {
    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(500).json({ error: "Stripe is not configured" });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.warn("Stripe webhook secret not configured");
      return res.status(400).json({ error: "Webhook secret not configured" });
    }

    const signature = req.headers["stripe-signature"] as string | undefined;
    if (!signature) {
      return res.status(400).json({ error: "Missing Stripe signature header" });
    }

    const rawBody = (req as Request & { rawBody?: unknown }).rawBody;
    if (!rawBody || !(rawBody instanceof Buffer)) {
      return res.status(400).json({ error: "Raw request body is required for signature verification" });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("Stripe webhook signature verification failed:", message);
      return res.status(400).json({ error: `Webhook Error: ${message}` });
    }

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const invoiceId = paymentIntent.metadata.invoiceId;

      if (invoiceId) {
        try {
          const existingPayment = await storage.getPaymentByStripeIntentId(paymentIntent.id);
          if (existingPayment) {
            console.log(`Payment for intent ${paymentIntent.id} already recorded, skipping`);
            return res.json({ received: true });
          }

          await storage.createPayment({
            invoiceId,
            amount: paymentIntent.amount / 100,
            method: "card",
            status: "completed",
            reference: paymentIntent.id,
            stripePaymentIntentId: paymentIntent.id,
            paidAt: new Date(),
          });

          await storage.updateInvoice(invoiceId, {
            status: "Paid",
            paidAt: new Date(),
          });

          console.log(`Payment recorded for invoice ${invoiceId}`);
        } catch (error) {
          console.error("Error recording payment:", error);
        }
      }
    }

    res.json({ received: true });
  });

  app.get("/api/stripe/config", async (req, res) => {
    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      return res.status(500).json({ error: "Stripe is not configured" });
    }
    res.json({ publishableKey });
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

  // ==================== WORKS MANAGER ROUTES ====================

  app.get("/api/works-manager/team", requireRoles('works_manager', 'admin'), async (req, res) => {
    try {
      const teamMembers = await storage.getTeamMembers(req.session.userId!);
      res.json(teamMembers.map(m => ({
        id: m.id,
        name: m.name,
        email: m.email,
        phone: m.phone,
        role: m.role,
        roles: m.roles,
        currentLat: m.currentLat,
        currentLng: m.currentLng,
        lastLocationUpdate: m.lastLocationUpdate,
        status: m.status,
      })));
    } catch (error) {
      console.error("Get team members error:", error);
      res.status(500).json({ error: "Failed to fetch team members" });
    }
  });

  app.get("/api/works-manager/jobs", requireRoles('works_manager', 'admin'), async (req, res) => {
    try {
      const teamJobs = await storage.getTeamJobs(req.session.userId!);
      res.json(teamJobs);
    } catch (error) {
      console.error("Get team jobs error:", error);
      res.status(500).json({ error: "Failed to fetch team jobs" });
    }
  });

  app.get("/api/works-manager/stats", requireRoles('works_manager', 'admin'), async (req, res) => {
    try {
      const managerId = req.session.userId!;
      const teamMembers = await storage.getTeamMembers(managerId);
      const teamJobs = await storage.getTeamJobs(managerId);
      const teamTimesheets = await storage.getTeamTimesheets(managerId);
      const teamExpenses = await storage.getTeamExpenses(managerId);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const jobsToday = teamJobs.filter(job => {
        if (!job.date) return false;
        const jobDate = new Date(job.date);
        return jobDate >= today && jobDate < tomorrow;
      });
      
      const completedThisWeek = teamJobs.filter(job => {
        if (job.status !== 'Signed Off' || !job.signOffTimestamp) return false;
        const signOffDate = new Date(job.signOffTimestamp);
        return signOffDate >= weekAgo && signOffDate < tomorrow;
      });
      
      const pendingSignatures = teamJobs.filter(job => job.status === 'Awaiting Signatures');
      const inProgress = teamJobs.filter(job => job.status === 'In Progress');
      
      const overdueJobs = teamJobs.filter(job => {
        if (job.status === 'Signed Off') return false;
        if (!job.date) return false;
        const jobDate = new Date(job.date);
        return jobDate < today;
      });
      
      const pendingTimesheets = teamTimesheets.filter(ts => ts.status === 'pending');
      const pendingExpenses = teamExpenses.filter(exp => exp.status === 'pending');
      
      const onlineEngineers = teamMembers.filter(m => {
        if (!m.lastLocationUpdate) return false;
        const lastUpdate = new Date(m.lastLocationUpdate);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        return lastUpdate > fiveMinutesAgo;
      });
      
      res.json({
        teamSize: teamMembers.length,
        onlineCount: onlineEngineers.length,
        jobsToday: jobsToday.length,
        inProgressCount: inProgress.length,
        pendingSignatures: pendingSignatures.length,
        completedThisWeek: completedThisWeek.length,
        overdueJobs: overdueJobs.length,
        pendingTimesheets: pendingTimesheets.length,
        pendingExpenses: pendingExpenses.length,
        totalPendingApprovals: pendingTimesheets.length + pendingExpenses.length,
      });
    } catch (error) {
      console.error("Get works manager stats error:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get("/api/works-manager/timesheets", requireRoles('works_manager', 'admin'), async (req, res) => {
    try {
      const timesheets = await storage.getTeamTimesheets(req.session.userId!);
      res.json(timesheets);
    } catch (error) {
      console.error("Get team timesheets error:", error);
      res.status(500).json({ error: "Failed to fetch team timesheets" });
    }
  });

  app.get("/api/works-manager/expenses", requireRoles('works_manager', 'admin'), async (req, res) => {
    try {
      const expenses = await storage.getTeamExpenses(req.session.userId!);
      res.json(expenses);
    } catch (error) {
      console.error("Get team expenses error:", error);
      res.status(500).json({ error: "Failed to fetch team expenses" });
    }
  });

  app.patch("/api/users/:id/manager", requireAdmin, async (req, res) => {
    try {
      const { managerId } = req.body;
      const updated = await storage.updateUserManager(req.params.id, managerId || null);
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Update user manager error:", error);
      res.status(500).json({ error: "Failed to update user manager" });
    }
  });

  app.get("/api/works-managers", requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const worksManagers = allUsers.filter(u => {
        const roles = (u.roles as string[]) || [u.role];
        return roles.includes('works_manager');
      });
      res.json(worksManagers.map(m => ({
        id: m.id,
        name: m.name,
        email: m.email,
      })));
    } catch (error) {
      console.error("Get works managers error:", error);
      res.status(500).json({ error: "Failed to fetch works managers" });
    }
  });

  // ==================== ANALYTICS ====================

  app.get("/api/analytics", requireAdmin, async (req, res) => {
    try {
      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

      // Get all invoices, jobs, expenses, and engineers
      const allInvoices = await storage.getAllInvoices();
      const allJobs = await storage.getAllJobs();
      const allExpenses = await storage.getAllExpenses();
      const allEngineers = await storage.getAllEngineers();

      // Revenue data - monthly revenue from paid invoices over last 6 months
      const monthlyRevenue: { month: string; revenue: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        const monthName = monthDate.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
        
        const monthRevenue = allInvoices
          .filter(inv => {
            if (inv.status !== 'Paid' || !inv.paidAt) return false;
            const paidDate = new Date(inv.paidAt);
            return paidDate >= monthDate && paidDate <= monthEnd;
          })
          .reduce((sum, inv) => sum + (inv.total || 0), 0);
        
        monthlyRevenue.push({ month: monthName, revenue: monthRevenue });
      }

      // Jobs data - jobs completed per month
      const jobsByMonth: { month: string; completed: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        const monthName = monthDate.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
        
        const completed = allJobs.filter(job => {
          if (job.status !== 'Signed Off' || !job.signOffTimestamp) return false;
          const signOffDate = new Date(job.signOffTimestamp);
          return signOffDate >= monthDate && signOffDate <= monthEnd;
        }).length;
        
        jobsByMonth.push({ month: monthName, completed });
      }

      // Jobs by status
      const jobsByStatus = [
        { name: 'Draft', value: allJobs.filter(j => j.status === 'Draft').length, fill: '#94a3b8' },
        { name: 'In Progress', value: allJobs.filter(j => j.status === 'In Progress').length, fill: '#3b82f6' },
        { name: 'Awaiting Signatures', value: allJobs.filter(j => j.status === 'Awaiting Signatures').length, fill: '#f59e0b' },
        { name: 'Signed Off', value: allJobs.filter(j => j.status === 'Signed Off').length, fill: '#22c55e' },
      ];

      // Expenses data - monthly expenses
      const monthlyExpenses: { month: string; amount: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        const monthName = monthDate.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
        
        const monthAmount = allExpenses
          .filter(exp => {
            const expDate = new Date(exp.date);
            return expDate >= monthDate && expDate <= monthEnd;
          })
          .reduce((sum, exp) => sum + (exp.amount || 0), 0);
        
        monthlyExpenses.push({ month: monthName, amount: monthAmount });
      }

      // Expenses by category
      const expenseCategories = ['mileage', 'materials', 'tools', 'fuel', 'subsistence', 'other'];
      const expensesByCategory = expenseCategories.map(category => ({
        category: category.charAt(0).toUpperCase() + category.slice(1),
        amount: allExpenses
          .filter(exp => exp.category === category)
          .reduce((sum, exp) => sum + (exp.amount || 0), 0)
      })).filter(item => item.amount > 0);

      // Team performance - jobs completed per engineer
      const teamPerformance = allEngineers.map(engineer => {
        const engineerJobs = allJobs.filter(job => {
          if (job.assignedToId === engineer.id) return true;
          if (Array.isArray(job.assignedToIds) && job.assignedToIds.includes(engineer.id)) return true;
          return false;
        });
        
        const completedJobs = engineerJobs.filter(j => j.status === 'Signed Off').length;
        const inProgressJobs = engineerJobs.filter(j => j.status === 'In Progress').length;
        
        return {
          id: engineer.id,
          name: engineer.name,
          completedJobs,
          inProgressJobs,
          totalJobs: engineerJobs.length,
        };
      }).sort((a, b) => b.completedJobs - a.completedJobs);

      // Summary KPIs
      const totalRevenue = allInvoices
        .filter(inv => inv.status === 'Paid')
        .reduce((sum, inv) => sum + (inv.total || 0), 0);
      
      const totalCompletedJobs = allJobs.filter(j => j.status === 'Signed Off').length;
      
      const pendingExpenses = allExpenses
        .filter(exp => exp.status === 'pending')
        .reduce((sum, exp) => sum + (exp.amount || 0), 0);
      
      const activeEngineers = allEngineers.filter(e => e.status === 'active').length;

      res.json({
        summary: {
          totalRevenue,
          totalCompletedJobs,
          pendingExpenses,
          activeEngineers,
        },
        monthlyRevenue,
        jobsByMonth,
        jobsByStatus,
        monthlyExpenses,
        expensesByCategory,
        teamPerformance,
      });
    } catch (error) {
      console.error("Analytics error:", error);
      res.status(500).json({ error: "Failed to fetch analytics data" });
    }
  });

  // ==================== INSPECTIONS ====================

  app.get("/api/inspections", requireRoles('admin', 'surveyor', 'works_manager'), async (req, res) => {
    try {
      const allInspections = await storage.getInspections();
      res.json(allInspections);
    } catch (error) {
      console.error("Get inspections error:", error);
      res.status(500).json({ error: "Failed to fetch inspections" });
    }
  });

  app.get("/api/inspections/:id", requireRoles('admin', 'surveyor', 'works_manager'), async (req, res) => {
    try {
      const inspection = await storage.getInspection(req.params.id);
      if (!inspection) {
        return res.status(404).json({ error: "Inspection not found" });
      }
      res.json(inspection);
    } catch (error) {
      console.error("Get inspection error:", error);
      res.status(500).json({ error: "Failed to fetch inspection" });
    }
  });

  app.post("/api/inspections", requireRoles('admin', 'surveyor', 'works_manager'), async (req, res) => {
    try {
      const inspectionNo = await storage.getNextInspectionNo();
      const inspection = await storage.createInspection({
        ...req.body,
        inspectionNo,
        inspectorId: req.body.inspectorId || req.session.userId,
      });
      res.status(201).json(inspection);
    } catch (error) {
      console.error("Create inspection error:", error);
      res.status(500).json({ error: "Failed to create inspection" });
    }
  });

  app.patch("/api/inspections/:id", requireRoles('admin', 'surveyor', 'works_manager'), async (req, res) => {
    try {
      const inspection = await storage.updateInspection(req.params.id, req.body);
      if (!inspection) {
        return res.status(404).json({ error: "Inspection not found" });
      }
      res.json(inspection);
    } catch (error) {
      console.error("Update inspection error:", error);
      res.status(500).json({ error: "Failed to update inspection" });
    }
  });

  app.delete("/api/inspections/:id", requireRoles('admin', 'surveyor'), async (req, res) => {
    try {
      await storage.deleteInspection(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete inspection error:", error);
      res.status(500).json({ error: "Failed to delete inspection" });
    }
  });

  app.post("/api/inspections/:id/items", requireRoles('admin', 'surveyor', 'works_manager'), async (req, res) => {
    try {
      const item = await storage.createInspectionItem({
        ...req.body,
        inspectionId: req.params.id,
      });
      res.status(201).json(item);
    } catch (error) {
      console.error("Create inspection item error:", error);
      res.status(500).json({ error: "Failed to create inspection item" });
    }
  });

  app.patch("/api/inspection-items/:id", requireRoles('admin', 'surveyor', 'works_manager'), async (req, res) => {
    try {
      const item = await storage.updateInspectionItem(req.params.id, req.body);
      if (!item) {
        return res.status(404).json({ error: "Inspection item not found" });
      }
      res.json(item);
    } catch (error) {
      console.error("Update inspection item error:", error);
      res.status(500).json({ error: "Failed to update inspection item" });
    }
  });

  app.delete("/api/inspection-items/:id", requireRoles('admin', 'surveyor'), async (req, res) => {
    try {
      await storage.deleteInspectionItem(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete inspection item error:", error);
      res.status(500).json({ error: "Failed to delete inspection item" });
    }
  });

  // ==================== SNAGGING SHEETS ====================

  app.get("/api/snagging", requireRoles('admin', 'surveyor', 'works_manager'), async (req, res) => {
    try {
      const sheets = await storage.getSnaggingSheets();
      res.json(sheets);
    } catch (error) {
      console.error("Get snagging sheets error:", error);
      res.status(500).json({ error: "Failed to fetch snagging sheets" });
    }
  });

  app.get("/api/snagging/:id", requireRoles('admin', 'surveyor', 'works_manager'), async (req, res) => {
    try {
      const sheet = await storage.getSnaggingSheet(req.params.id);
      if (!sheet) {
        return res.status(404).json({ error: "Snagging sheet not found" });
      }
      res.json(sheet);
    } catch (error) {
      console.error("Get snagging sheet error:", error);
      res.status(500).json({ error: "Failed to fetch snagging sheet" });
    }
  });

  app.post("/api/snagging", requireRoles('admin', 'surveyor', 'works_manager'), async (req, res) => {
    try {
      const sheetNo = await storage.getNextSnaggingSheetNo();
      const sheet = await storage.createSnaggingSheet({
        ...req.body,
        sheetNo,
        createdById: req.session.userId!,
      });
      res.status(201).json(sheet);
    } catch (error) {
      console.error("Create snagging sheet error:", error);
      res.status(500).json({ error: "Failed to create snagging sheet" });
    }
  });

  app.patch("/api/snagging/:id", requireRoles('admin', 'surveyor', 'works_manager'), async (req, res) => {
    try {
      const sheet = await storage.updateSnaggingSheet(req.params.id, req.body);
      if (!sheet) {
        return res.status(404).json({ error: "Snagging sheet not found" });
      }
      res.json(sheet);
    } catch (error) {
      console.error("Update snagging sheet error:", error);
      res.status(500).json({ error: "Failed to update snagging sheet" });
    }
  });

  app.delete("/api/snagging/:id", requireRoles('admin', 'surveyor'), async (req, res) => {
    try {
      await storage.deleteSnaggingSheet(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete snagging sheet error:", error);
      res.status(500).json({ error: "Failed to delete snagging sheet" });
    }
  });

  app.post("/api/snagging/:id/snags", requireRoles('admin', 'surveyor', 'works_manager'), async (req, res) => {
    try {
      const snag = await storage.createSnagItem({
        ...req.body,
        snaggingSheetId: req.params.id,
      });
      res.status(201).json(snag);
    } catch (error) {
      console.error("Create snag error:", error);
      res.status(500).json({ error: "Failed to create snag" });
    }
  });

  app.patch("/api/snags/:id", requireRoles('admin', 'surveyor', 'works_manager'), async (req, res) => {
    try {
      const snag = await storage.updateSnagItem(req.params.id, req.body);
      if (!snag) {
        return res.status(404).json({ error: "Snag not found" });
      }
      res.json(snag);
    } catch (error) {
      console.error("Update snag error:", error);
      res.status(500).json({ error: "Failed to update snag" });
    }
  });

  app.delete("/api/snags/:id", requireRoles('admin', 'surveyor'), async (req, res) => {
    try {
      await storage.deleteSnagItem(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete snag error:", error);
      res.status(500).json({ error: "Failed to delete snag" });
    }
  });

  app.patch("/api/snags/:id/resolve", requireRoles('admin', 'surveyor', 'works_manager', 'engineer'), async (req, res) => {
    try {
      const { completionPhotos, notes } = req.body;
      const snag = await storage.updateSnagItem(req.params.id, {
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedById: req.session.userId,
        completionPhotos: completionPhotos || [],
        notes: notes || undefined,
      });
      if (!snag) {
        return res.status(404).json({ error: "Snag not found" });
      }
      res.json(snag);
    } catch (error) {
      console.error("Resolve snag error:", error);
      res.status(500).json({ error: "Failed to resolve snag" });
    }
  });

  return httpServer;
}
