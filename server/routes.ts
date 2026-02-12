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
import { insertJobSchema, insertAiAdvisorSchema, insertVehicleSchema, insertWalkaroundCheckSchema, insertCheckItemSchema, insertDefectSchema, insertDefectUpdateSchema, insertTimesheetSchema, insertExpenseSchema, insertPaymentSchema, insertBlogPostSchema, insertFeedbackSchema } from "@shared/schema";
import { z } from "zod";
import { notifyAdmins, notifyUser } from "./notifications";
import { sessionMiddleware } from "./session";
import * as outlook from "./outlook";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { registerGlobalAssistantRoutes } from "./globalAssistant";
import { registerAiRoutes } from "./ai-service";
import { registerSupportChatRoutes } from "./support-chat";
import { registerPublicChatbotRoutes } from "./public-chatbot";
import { insertFileSchema } from "@shared/schema";
import { setupAuth } from "./replit_integrations/auth";
import { generateFormPdf } from "./form-pdf";
import { emitEvent } from "./events";
import { ObjectStorageService } from "./replit_integrations/object_storage/objectStorage";
import { sendPortalInvitation, sendPasswordResetEmail } from "./email";
import { logAuditEvent, logFailedAction, createUserSession, endUserSession, updateSessionActivity, logAuditLogAccess, getAuditLogs, getAuditLogById, getFailedActions, getActiveSessions, getAuditStats, getClientIp, getUserAgent, verifyAuditLogIntegrity } from "./audit";
import { ReferralService, FraudDetection, DiscountEngine } from "./referral-service";

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

const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
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
  if (userRoles.includes('admin')) {
    return next();
  }
  return res.status(403).json({ error: "Admin access required" });
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

const requireDirectorsSuite = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }
  if (user.superAdmin || user.hasDirectorsSuite) {
    return next();
  }
  return res.status(403).json({ error: "Directors Suite access required" });
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Trust proxy for secure cookies behind Replit's reverse proxy
  app.set('trust proxy', 1);
  
  // Use shared session middleware (also used by WebSocket notifications)
  app.use(sessionMiddleware);
  
  // Setup OAuth authentication (Google via Replit OIDC)
  await setupAuth(app);

  // Redirect /auth to homepage - prevents Replit deployment proxy from showing login
  app.get("/auth", (req, res) => {
    res.redirect(302, "/");
  });

  // ==================== VERSION ENDPOINT (PUBLIC) ====================
  // Used to verify which code version is running in production
  const BUILD_VERSION = new Date().toISOString();
  app.get("/api/version", (req, res) => {
    res.json({ 
      version: BUILD_VERSION,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  });

  // ==================== DIAGNOSTIC ENDPOINT (PUBLIC) ====================
  // Used to verify database connectivity and basic data in production
  app.get("/api/diagnostics", async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const allJobs = await storage.getAllJobs();
      
      res.json({
        status: "connected",
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        databaseConnected: true,
        counts: {
          users: allUsers.length,
          jobs: allJobs.length,
          engineers: allUsers.filter(u => {
            const roles = (u.roles as string[]) || [u.role];
            return roles.includes('engineer');
          }).length,
          admins: allUsers.filter(u => {
            const roles = (u.roles as string[]) || [u.role];
            return roles.includes('admin');
          }).length,
        },
        userNames: allUsers.map(u => u.name),
        sessionInfo: {
          hasUserId: !!req.session?.userId,
          userId: req.session?.userId || null,
        }
      });
    } catch (error: any) {
      res.status(500).json({
        status: "error",
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        databaseConnected: false,
        error: error.message,
      });
    }
  });

  // ==================== AUTH ROUTES (PUBLIC) ====================

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password, totpToken } = req.body;
      const user = await storage.getUserByUsername(username);
      const ipAddress = getClientIp(req);
      const userAgent = getUserAgent(req);
      
      if (!user) {
        await logFailedAction({
          attemptedEmail: username,
          actionAttempted: "login",
          failureReason: "User not found",
          ipAddress,
          userAgent,
        });
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
        await logFailedAction({
          userId: user.id,
          attemptedEmail: username,
          actionAttempted: "login",
          failureReason: "Invalid password",
          ipAddress,
          userAgent,
        });
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
          await logFailedAction({
            userId: user.id,
            attemptedEmail: username,
            actionAttempted: "login_2fa",
            failureReason: "Invalid 2FA code",
            ipAddress,
            userAgent,
          });
          return res.status(401).json({ error: "Invalid authentication code" });
        }
      }

      req.session.userId = user.id;
      req.session.userRole = user.role;

      const userRoles = (user.roles as string[]) || [user.role];
      
      // Log successful login
      const sessionId = req.sessionID;
      await createUserSession({
        sessionId,
        userId: user.id,
        ipAddress,
        deviceInfo: userAgent,
      });
      
      await logAuditEvent({
        userId: user.id,
        userName: user.name,
        userEmail: user.email || undefined,
        userRole: user.role,
        actionType: "login",
        actionCategory: "auth",
        entityType: "user",
        entityId: user.id,
        description: `User ${user.name} logged in successfully`,
        severity: "info",
        ipAddress,
        userAgent,
        sessionId,
      });
      
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Session save error:', saveErr);
          return res.status(500).json({ error: "Session save failed" });
        }
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
      });
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    const userId = req.session.userId;
    const sessionId = req.sessionID;
    
    if (userId) {
      const user = await storage.getUser(userId);
      if (user) {
        await endUserSession(sessionId);
        await logAuditEvent({
          userId: user.id,
          userName: user.name,
          userEmail: user.email || undefined,
          userRole: user.role,
          actionType: "logout",
          actionCategory: "auth",
          entityType: "user",
          entityId: user.id,
          description: `User ${user.name} logged out`,
          severity: "info",
          sessionId,
        });
      }
    }
    
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/config/maps", requireAuth, (req, res) => {
    const apiKey = process.env.PRO_MAIN_MAPS_API_KEY || '';
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
        hasDirectorsSuite: user.hasDirectorsSuite,
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
        tabletNumber: e.tabletNumber,
        role: e.role,
        roles: e.roles,
        username: e.username,
        currentLat: e.currentLat,
        currentLng: e.currentLng,
        lastLocationUpdate: e.lastLocationUpdate,
        addressLine1: e.addressLine1,
        addressLine2: e.addressLine2,
        city: e.city,
        county: e.county,
        homePostcode: e.homePostcode,
        managerId: e.managerId,
        dayRate: e.dayRate,
      })));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Fix user roles - adds missing role to user's roles array
  app.post("/api/admin/fix-user-role", requireSuperAdmin, async (req, res) => {
    try {
      const { userName, roleToAdd } = req.body;
      
      if (!userName || !roleToAdd) {
        return res.status(400).json({ error: "userName and roleToAdd are required" });
      }

      const validRoles = ['admin', 'engineer', 'surveyor', 'works_manager', 'fleet_manager', 'accounts'];
      if (!validRoles.includes(roleToAdd)) {
        return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
      }

      const allUsers = await storage.getAllUsers();
      const user = allUsers.find(u => u.name.toLowerCase().includes(userName.toLowerCase()));
      
      if (!user) {
        return res.status(404).json({ error: `No user found matching: ${userName}` });
      }

      const currentRoles = (user.roles as string[]) || [user.role];
      
      if (currentRoles.includes(roleToAdd)) {
        return res.json({ 
          message: `User ${user.name} already has role: ${roleToAdd}`,
          user: { id: user.id, name: user.name, roles: currentRoles }
        });
      }

      const newRoles = [...currentRoles, roleToAdd];
      await storage.updateUser(user.id, { roles: newRoles });

      res.json({ 
        success: true,
        message: `Added '${roleToAdd}' role to ${user.name}`,
        user: { id: user.id, name: user.name, roles: newRoles }
      });
    } catch (error) {
      console.error("Fix user role error:", error);
      res.status(500).json({ error: "Failed to fix user role" });
    }
  });

  // Get all engineers (users with engineer role) for calendar/planner
  app.get("/api/users/engineers", requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      // Filter users who have 'engineer' in their roles array or as their primary role
      const engineers = allUsers.filter(u => {
        const userRoles = (u.roles as string[]) || [u.role];
        return userRoles.includes('engineer');
      });
      res.json(engineers.map(e => ({
        id: e.id,
        name: e.name,
        email: e.email,
        phone: e.phone,
        role: e.role,
        roles: e.roles,
        username: e.username,
        currentLat: e.currentLat,
        currentLng: e.currentLng,
        lastLocationUpdate: e.lastLocationUpdate,
      })));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch engineers" });
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
      const { username, password, name, email, phone, tabletNumber, role, roles, addressLine1, addressLine2, city, county, homePostcode, dayRate } = req.body;
      
      if (!username || !password || !name || !role) {
        return res.status(400).json({ error: "Username, password, name, and role are required" });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
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
        tabletNumber: tabletNumber || null,
        role,
        roles: roles || [role],
        status: 'active',
        addressLine1: addressLine1 || null,
        addressLine2: addressLine2 || null,
        city: city || null,
        county: county || null,
        homePostcode: homePostcode || null,
        dayRate: dayRate || null,
      });

      // Audit log: User created
      const currentUser = await storage.getUser(req.session.userId!);
      if (currentUser) {
        await logAuditEvent({
          userId: currentUser.id,
          userName: currentUser.name,
          userEmail: currentUser.email || undefined,
          userRole: currentUser.role,
          actionType: "create",
          actionCategory: "team",
          entityType: "user",
          entityId: user.id,
          description: `Created new user: ${user.name} (${user.role})`,
          changesAfter: { name: user.name, username: user.username, role: user.role, email: user.email },
          severity: "info",
        });
      }

      res.status(201).json({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        tabletNumber: user.tabletNumber,
        role: user.role,
        roles: user.roles,
        username: user.username,
        dayRate: user.dayRate,
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
      
      // Audit log: User deleted
      const currentUser = await storage.getUser(req.session.userId!);
      if (currentUser) {
        await logAuditEvent({
          userId: currentUser.id,
          userName: currentUser.name,
          userEmail: currentUser.email || undefined,
          userRole: currentUser.role,
          actionType: "delete",
          actionCategory: "team",
          entityType: "user",
          entityId: req.params.id,
          description: `Deleted user: ${user.name}`,
          changesBefore: { name: user.name, username: user.username, role: user.role },
          severity: "warning",
        });
      }
      
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

      const { name, email, phone, tabletNumber, username, password, role, roles, addressLine1, addressLine2, city, county, homePostcode, dayRate, hasDirectorsSuite } = req.body;
      const updates: Record<string, any> = {};

      if (name) updates.name = name;
      if (email !== undefined) updates.email = email || null;
      if (phone !== undefined) updates.phone = phone || null;
      if (tabletNumber !== undefined) updates.tabletNumber = tabletNumber || null;
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
      if (dayRate !== undefined) updates.dayRate = dayRate || null;
      if (hasDirectorsSuite !== undefined) updates.hasDirectorsSuite = !!hasDirectorsSuite;

      const updatedUser = await storage.updateUser(req.params.id, updates);
      
      // Audit log: User updated
      const currentUser = await storage.getUser(req.session.userId!);
      if (currentUser) {
        await logAuditEvent({
          userId: currentUser.id,
          userName: currentUser.name,
          userEmail: currentUser.email || undefined,
          userRole: currentUser.role,
          actionType: "update",
          actionCategory: "team",
          entityType: "user",
          entityId: req.params.id,
          description: `Updated user: ${updatedUser!.name}`,
          changesBefore: { name: user.name, role: user.role, email: user.email, hasDirectorsSuite: user.hasDirectorsSuite },
          changesAfter: { name: updatedUser!.name, role: updatedUser!.role, email: updatedUser!.email, hasDirectorsSuite: updatedUser!.hasDirectorsSuite },
          severity: password ? "warning" : "info",
        });
      }
      
      res.json({
        id: updatedUser!.id,
        name: updatedUser!.name,
        email: updatedUser!.email,
        phone: updatedUser!.phone,
        tabletNumber: updatedUser!.tabletNumber,
        role: updatedUser!.role,
        roles: updatedUser!.roles,
        username: updatedUser!.username,
        dayRate: updatedUser!.dayRate,
        hasDirectorsSuite: updatedUser!.hasDirectorsSuite,
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

  // ==================== SUB-SKILLS ROUTES ====================

  // Get all sub-skills
  app.get("/api/sub-skills", requireAuth, async (req, res) => {
    try {
      const subSkillsList = await storage.getAllSubSkills();
      res.json(subSkillsList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sub-skills" });
    }
  });

  // Get sub-skills for a specific skill
  app.get("/api/skills/:skillId/sub-skills", requireAuth, async (req, res) => {
    try {
      const subSkillsList = await storage.getSubSkillsBySkill(req.params.skillId);
      res.json(subSkillsList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sub-skills" });
    }
  });

  // Create a sub-skill
  app.post("/api/skills/:skillId/sub-skills", requireAdmin, async (req, res) => {
    try {
      const { name, description } = req.body;
      if (!name) {
        return res.status(400).json({ error: "name is required" });
      }
      const subSkill = await storage.createSubSkill(req.params.skillId, name, description);
      res.status(201).json(subSkill);
    } catch (error) {
      res.status(500).json({ error: "Failed to create sub-skill" });
    }
  });

  // Update a sub-skill
  app.patch("/api/sub-skills/:id", requireAdmin, async (req, res) => {
    try {
      const updated = await storage.updateSubSkill(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Sub-skill not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update sub-skill" });
    }
  });

  // Delete a sub-skill
  app.delete("/api/sub-skills/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteSubSkill(req.params.id);
      res.json({ message: "Sub-skill deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete sub-skill" });
    }
  });

  // Get user's sub-skills for a specific skill
  app.get("/api/users/:userId/skills/:skillId/sub-skills", requireAuth, async (req, res) => {
    try {
      const subSkillIds = await storage.getUserSubSkills(req.params.userId, req.params.skillId);
      res.json(subSkillIds);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user sub-skills" });
    }
  });

  // Set user's sub-skills for a specific skill
  app.put("/api/users/:userId/skills/:skillId/sub-skills", requireAdmin, async (req, res) => {
    try {
      const { subSkillIds } = req.body;
      if (!Array.isArray(subSkillIds)) {
        return res.status(400).json({ error: "subSkillIds must be an array" });
      }
      await storage.setUserSubSkills(req.params.userId, req.params.skillId, subSkillIds);
      res.json({ message: "User sub-skills updated" });
    } catch (error) {
      res.status(500).json({ error: "Failed to update user sub-skills" });
    }
  });

  // Get user's negative skills (skills they should NOT be assigned to) - Super Admin only
  app.get("/api/users/:userId/negative-skills", requireRoles('super_admin'), async (req, res) => {
    try {
      const user = await storage.getUser(req.params.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const negativeSkillIds = (user.negativeSkillIds as string[]) || [];
      res.json({ negativeSkillIds });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch negative skills" });
    }
  });

  // Set user's negative skills (Super Admin only)
  app.put("/api/users/:userId/negative-skills", requireRoles('super_admin'), async (req, res) => {
    try {
      const { negativeSkillIds } = req.body;
      if (!Array.isArray(negativeSkillIds)) {
        return res.status(400).json({ error: "negativeSkillIds must be an array" });
      }
      const updated = await storage.updateUser(req.params.userId, { negativeSkillIds });
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ message: "Negative skills updated", negativeSkillIds });
    } catch (error) {
      res.status(500).json({ error: "Failed to update negative skills" });
    }
  });

  // Get user's working at height certification
  app.get("/api/users/:userId/working-at-height", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ workingAtHeight: user.workingAtHeight || false });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch working at height status" });
    }
  });

  // Set user's working at height certification (Admin only)
  app.put("/api/users/:userId/working-at-height", requireAdmin, async (req, res) => {
    try {
      const { workingAtHeight } = req.body;
      if (typeof workingAtHeight !== 'boolean') {
        return res.status(400).json({ error: "workingAtHeight must be a boolean" });
      }
      const updated = await storage.updateUser(req.params.userId, { workingAtHeight });
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ message: "Working at height status updated", workingAtHeight });
    } catch (error) {
      res.status(500).json({ error: "Failed to update working at height status" });
    }
  });

  // ==================== TODAY FEED (PROTECTED) ====================

  app.get("/api/today", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

      // Get user's jobs for today
      let allJobs;
      if (req.session.userRole === 'engineer') {
        allJobs = await storage.getJobsByEngineer(userId);
      } else {
        allJobs = await storage.getAllJobs();
      }

      // Filter jobs scheduled for today
      const todayJobs = allJobs.filter(job => {
        if (!job.date) return false;
        const jobDate = new Date(job.date);
        return jobDate >= today && jobDate < tomorrow;
      }).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

      // Calculate stats
      const stats = {
        totalJobs: todayJobs.length,
        completedJobs: todayJobs.filter(j => j.status === 'Completed').length,
        pendingJobs: todayJobs.filter(j => ['Draft', 'Scheduled'].includes(j.status)).length,
        inProgressJobs: todayJobs.filter(j => j.status === 'In Progress').length,
      };

      // Determine greeting based on time
      const hour = now.getHours();
      let greeting = 'Good morning';
      if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
      else if (hour >= 17) greeting = 'Good evening';
      greeting += `, ${user?.name?.split(' ')[0] || 'there'}`;

      // Determine next action
      let nextAction = undefined;
      const pendingJob = todayJobs.find(j => j.status !== 'Completed');
      if (pendingJob) {
        nextAction = {
          type: 'job',
          jobId: pendingJob.id,
          jobNo: pendingJob.jobNo,
          message: `Continue with ${pendingJob.nickname || pendingJob.jobNo} - ${pendingJob.customerName}`,
        };
      }

      res.json({
        greeting,
        date: now.toLocaleDateString('en-GB', { 
          weekday: 'long', 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
        }),
        jobs: todayJobs,
        stats,
        nextAction,
      });
    } catch (error) {
      console.error('[today] Error fetching today feed:', error);
      res.status(500).json({ error: 'Failed to fetch today feed' });
    }
  });

  // ==================== JOB ROUTES (PROTECTED) ====================

  app.get("/api/jobs", requireAuth, async (req, res) => {
    try {
      const engineerId = req.query.engineerId as string;
      let jobsList;
      
      console.log(`[jobs] Fetching jobs - userRole: ${req.session.userRole}, userId: ${req.session.userId}, engineerId param: ${engineerId}`);
      
      if (req.session.userRole === 'engineer') {
        jobsList = await storage.getJobsByEngineer(req.session.userId!);
        console.log(`[jobs] Engineer ${req.session.userId} - found ${jobsList.length} jobs`);
      } else if (engineerId) {
        jobsList = await storage.getJobsByEngineer(engineerId);
        console.log(`[jobs] Admin fetching for engineer ${engineerId} - found ${jobsList.length} jobs`);
      } else {
        jobsList = await storage.getAllJobs();
        console.log(`[jobs] Admin fetching all - found ${jobsList.length} jobs`);
      }
      
      res.json(jobsList);
    } catch (error) {
      console.error(`[jobs] Error fetching jobs:`, error);
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });

  app.get("/api/jobs/:id", requireAuth, async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      if (req.session.userRole === 'engineer') {
        const assignedIds = (job.assignedToIds as string[]) || [];
        const isAssigned = job.assignedToId === req.session.userId || assignedIds.includes(req.session.userId!);
        if (!isAssigned) {
          return res.status(403).json({ error: "Access denied" });
        }
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
      
      // Audit log: Job created
      const currentUser = await storage.getUser(req.session.userId!);
      if (currentUser && job) {
        await logAuditEvent({
          userId: currentUser.id,
          userName: currentUser.name,
          userEmail: currentUser.email || undefined,
          userRole: currentUser.role,
          actionType: "create",
          actionCategory: "job",
          entityType: "job",
          entityId: job.id,
          description: `Created job: ${job.jobNo} for ${job.customerName}`,
          changesAfter: { jobNo: job.jobNo, customerName: job.customerName, status: job.status, address: job.address },
          metadata: { clientName: job.client },
          severity: "info",
        });

        notifyAdmins({
          type: 'job_created',
          title: 'New Job Created',
          message: `${currentUser.name} created job ${job.jobNo || ''} for ${job.customerName || 'Unknown Customer'}`,
          category: 'jobs',
          jobId: job.id,
          jobNo: job.jobNo || undefined,
          timestamp: new Date().toISOString(),
          linkUrl: `/app/jobs/${job.id}`,
        });
      }
      
      // Check if job is scheduled for today and notify all assigned engineers
      if (job && job.date) {
        const jobDate = new Date(job.date);
        const today = new Date();
        const isToday = jobDate.toDateString() === today.toDateString();
        
        if (isToday) {
          const assignedIds = Array.isArray(job.assignedToIds) && job.assignedToIds.length > 0 
            ? job.assignedToIds as string[]
            : job.assignedToId ? [job.assignedToId] : [];
          for (const engineerId of assignedIds) {
            notifyUser(engineerId, {
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

      if (req.session.userRole === 'engineer') {
        const assignedIds = (existingJob.assignedToIds as string[]) || [];
        const isAssigned = existingJob.assignedToId === req.session.userId || assignedIds.includes(req.session.userId!);
        if (!isAssigned) {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      if (existingJob.status === 'Signed Off') {
        return res.status(409).json({ error: "Job is signed off and locked from editing" });
      }

      let updates = req.body;
      
      // Track who made the update
      updates.updatedByUserId = req.session.userId;
      
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

      // Track status and date changes
      const oldStatus = existingJob.status;
      const oldDate = existingJob.date;
      const newDate = updates.date;
      const isDateChanging = newDate !== undefined && newDate !== null;

      // Convert date string to Date object for Drizzle
      if (updates.date !== undefined) {
        updates.date = updates.date ? new Date(updates.date) : null;
      }

      const job = await storage.updateJob(req.params.id, updates);

      if (job && updates.status && updates.status !== oldStatus) {
        notifyAdmins({
          type: 'job_status_changed',
          title: 'Job Status Updated',
          message: `Job ${job.jobNo || ''} changed from ${oldStatus} to ${updates.status}`,
          category: 'jobs',
          jobId: job.id,
          jobNo: job.jobNo || undefined,
          timestamp: new Date().toISOString(),
          linkUrl: `/app/jobs/${job.id}`,
        });

        const assignedIds = Array.isArray(job.assignedToIds) && job.assignedToIds.length > 0
          ? job.assignedToIds as string[]
          : job.assignedToId ? [job.assignedToId] : [];
        for (const engineerId of assignedIds) {
          notifyUser(engineerId, {
            type: 'job_status_changed',
            title: 'Job Status Updated',
            message: `Job ${job.jobNo || ''} for ${job.customerName || 'Customer'} is now ${updates.status}`,
            category: 'jobs',
            jobId: job.id,
            jobNo: job.jobNo || undefined,
            timestamp: new Date().toISOString(),
            linkUrl: `/app/jobs/${job.id}`,
          });
        }
      }
      
      // Check if job was rescheduled to today and notify all assigned engineers
      if (job && isDateChanging) {
        const jobDate = new Date(newDate);
        const today = new Date();
        const isRescheduledToToday = jobDate.toDateString() === today.toDateString();
        const wasNotToday = !oldDate || new Date(oldDate).toDateString() !== today.toDateString();
        
        if (isRescheduledToToday && wasNotToday) {
          const assignedIds = Array.isArray(job.assignedToIds) && job.assignedToIds.length > 0 
            ? job.assignedToIds as string[]
            : job.assignedToId ? [job.assignedToId] : [];
          for (const engineerId of assignedIds) {
            notifyUser(engineerId, {
              type: 'job_rescheduled_today',
              title: 'Job Rescheduled to Today',
              message: `Job ${job.jobNo || ''} for ${job.customerName || 'Customer'} has been rescheduled to TODAY.`,
              jobId: job.id,
              jobNo: job.jobNo || undefined,
              timestamp: new Date().toISOString(),
            });
          }
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

      if (req.session.userRole === 'engineer') {
        const assignedIds = (existingJob.assignedToIds as string[]) || [];
        const isAssigned = existingJob.assignedToId === req.session.userId || assignedIds.includes(req.session.userId!);
        if (!isAssigned) {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      if (existingJob.status === 'Signed Off') {
        return res.status(400).json({ error: "Job is already signed off" });
      }
      
      // Check for blocking exceptions (workflow job gating)
      const blockingExceptions = await storage.getExceptions({
        entityType: 'job',
        entityId: req.params.id,
        type: 'job_blocked',
        status: 'open'
      });
      
      if (blockingExceptions.length > 0) {
        return res.status(400).json({ 
          error: "Job closure is blocked by workflow rules",
          blockingReasons: blockingExceptions.map(e => e.message || e.title)
        });
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

  // ==================== QUALITY GATE - JOB COMPLETION ====================

  app.post("/api/jobs/:id/complete", requireAuth, async (req, res) => {
    try {
      const jobId = req.params.id;
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: "JOB_NOT_FOUND" });
      }

      if (req.session.userRole === 'engineer') {
        const assignedIds = (job.assignedToIds as string[]) || [];
        const isAssigned = job.assignedToId === req.session.userId || assignedIds.includes(req.session.userId!);
        if (!isAssigned) {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      if (job.status === 'Signed Off' || job.status === 'Completed') {
        return res.status(400).json({ error: "Job is already completed" });
      }

      const missing: { photos: string[]; fields: string[]; forms: string[]; signatures: string[] } = {
        photos: [],
        fields: [],
        forms: [],
        signatures: [],
      };

      const photos = (job.photos as any[]) || [];
      const engineerPhotos = photos.filter((p: any) => !p.source || p.source === 'engineer');
      if (engineerPhotos.length < 1) {
        missing.photos.push("At least 1 evidence photo");
      }

      if (!job.description || job.description.trim().length < 10) {
        missing.fields.push("Job description (min 10 characters)");
      }
      if (!job.worksCompleted || job.worksCompleted.trim().length < 10) {
        missing.fields.push("Works completed (min 10 characters)");
      }

      const sigs = (job.signatures as any[]) || [];
      if (!sigs.some((s: any) => s.type === 'engineer')) {
        missing.signatures.push("Engineer signature");
      }
      if (!sigs.some((s: any) => s.type === 'customer')) {
        missing.signatures.push("Customer signature");
      }

      const allMissing = [
        ...missing.photos,
        ...missing.fields,
        ...missing.forms,
        ...missing.signatures,
      ];

      const isAdmin = req.session.userRole === 'admin' || req.session.userRole === 'super_admin';

      if (allMissing.length > 0) {
        await storage.updateJob(jobId, { completionBlockedReason: allMissing.join("; ") });

        if (!isAdmin) {
          return res.status(400).json({
            error: "QUALITY_GATE_FAILED",
            message: "Job failed Quality Gate checks",
            missing,
          });
        }

        if (!req.body.override) {
          return res.status(409).json({
            error: "QUALITY_GATE_CAN_OVERRIDE",
            message: "Job failed Quality Gate checks",
            missing,
          });
        }

        await storage.updateJob(jobId, {
          qualityGateStatus: "overridden",
          qualityOverrideBy: req.session.userId!,
          qualityOverrideReason: req.body.overrideReason ?? null,
        });
      } else {
        await storage.updateJob(jobId, { qualityGateStatus: "passed" });
      }

      const completed = await storage.updateJob(jobId, { status: "Completed" });

      const currentUser = await storage.getUser(req.session.userId!);
      if (currentUser) {
        await logAuditEvent({
          userId: currentUser.id,
          userName: currentUser.name,
          userEmail: currentUser.email || undefined,
          userRole: currentUser.role,
          actionType: "update",
          actionCategory: "job",
          entityType: "job",
          entityId: jobId,
          description: `Completed job ${job.jobNo} – quality gate: ${allMissing.length === 0 ? 'passed' : 'overridden'}`,
          changesBefore: { status: job.status, qualityGateStatus: job.qualityGateStatus },
          changesAfter: { status: "Completed", qualityGateStatus: allMissing.length === 0 ? "passed" : "overridden" },
        });
      }

      return res.json({ success: true, job: completed });
    } catch (error) {
      console.error("[quality-gate] Error completing job:", error);
      return res.status(500).json({ error: "Failed to complete job" });
    }
  });

  // ==================== JOB BLOCKING EXCEPTIONS ====================
  
  app.get("/api/jobs/:id/blocking-exceptions", requireAuth, async (req, res) => {
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

      const blockingExceptions = await storage.getExceptions({
        entityType: 'job',
        entityId: req.params.id,
        type: 'job_blocked',
        status: 'open'
      });
      
      res.json(blockingExceptions);
    } catch (error) {
      console.error("Failed to get blocking exceptions:", error);
      res.status(500).json({ error: "Failed to get blocking exceptions" });
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
      const userId = req.session.userId!;

      const activeLog = await storage.getActiveTimeLog(userId);
      if (activeLog) {
        return res.status(400).json({ error: "Already clocked in" });
      }

      const timeLog = await storage.clockIn(userId, latitude ?? null, longitude ?? null, address ?? null);
      
      // Check if there's already an active timesheet for today before creating a new one
      const existingTimesheet = await storage.getActiveClockIn(userId);
      if (!existingTimesheet) {
        // Only create a timesheet if one doesn't already exist for today
        const now = new Date();
        await storage.createTimesheet({
          userId,
          date: now,
          clockIn: now,
          clockInLatitude: latitude ?? null,
          clockInLongitude: longitude ?? null,
          clockInAddress: address ?? null,
          status: "pending",
        });
      }
      
      res.json(timeLog);
    } catch (error) {
      console.error("Clock in error:", error);
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
      const userId = req.session.userId!;

      // First get the active timesheet before clocking out
      const activeTimesheet = await storage.getActiveClockIn(userId);

      const timeLog = await storage.clockOut(userId, latitude ?? null, longitude ?? null, address ?? null);
      if (!timeLog) {
        return res.status(400).json({ error: "Not currently clocked in" });
      }
      
      // Update the timesheet record for finance tracking with clock out data and status
      if (activeTimesheet) {
        const clockOut = new Date();
        const clockIn = new Date(activeTimesheet.clockIn!);
        const breakMinutes = activeTimesheet.breakMinutes || 0;
        const diffMs = clockOut.getTime() - clockIn.getTime();
        const totalHours = (diffMs / (1000 * 60 * 60)) - (breakMinutes / 60);
        await storage.updateTimesheet(activeTimesheet.id, {
          clockOut,
          clockOutLatitude: latitude ?? null,
          clockOutLongitude: longitude ?? null,
          clockOutAddress: address ?? null,
          totalHours: Math.max(0, totalHours),
          status: "submitted",
        });
      }
      
      res.json(timeLog);
    } catch (error) {
      console.error("Clock out error:", error);
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

      notifyAdmins({
        type: 'quote_accepted',
        title: 'Quote Accepted',
        message: `Quote ${quote.quoteNo || ''} for ${quote.customerName || 'Customer'} (£${quote.total || 0}) has been accepted by the client`,
        category: 'jobs',
        timestamp: new Date().toISOString(),
        linkUrl: `/app/quotes`,
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

      notifyAdmins({
        type: 'quote_declined',
        title: 'Quote Declined',
        message: `Quote ${quote.quoteNo || ''} for ${quote.customerName || 'Customer'} has been declined${reason ? ': ' + reason : ''}`,
        category: 'jobs',
        timestamp: new Date().toISOString(),
        linkUrl: `/app/quotes`,
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
      
      // Audit log: Quote created
      const currentUser = await storage.getUser(req.session.userId!);
      if (currentUser) {
        await logAuditEvent({
          userId: currentUser.id,
          userName: currentUser.name,
          userEmail: currentUser.email || undefined,
          userRole: currentUser.role,
          actionType: "create",
          actionCategory: "quote",
          entityType: "quote",
          entityId: quote.id,
          description: `Created quote: ${quoteNo} for ${quote.customerName} - £${quote.total}`,
          changesAfter: { quoteNo, customerName: quote.customerName, total: quote.total, status: quote.status },
          metadata: { clientId: client.id, draftJobId: draftJob.id },
          severity: "info",
        });
      }
      
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
      // Prevent caching to ensure fresh data
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
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
      
      // Audit log: Client created
      const currentUser = await storage.getUser(req.session.userId!);
      if (currentUser && client) {
        await logAuditEvent({
          userId: currentUser.id,
          userName: currentUser.name,
          userEmail: currentUser.email || undefined,
          userRole: currentUser.role,
          actionType: "create",
          actionCategory: "client",
          entityType: "client",
          entityId: client.id,
          description: `Created client: ${client.name}`,
          changesAfter: { name: client.name, email: client.email, phone: client.phone, address: client.address },
          severity: "info",
        });

        notifyAdmins({
          type: 'client_created',
          title: 'New Client Added',
          message: `${currentUser.name} added a new client: ${client.name}`,
          category: 'system',
          timestamp: new Date().toISOString(),
          linkUrl: `/app/clients/${client.id}`,
        });
      }
      
      res.json(client);
    } catch (error) {
      res.status(500).json({ error: "Failed to create client" });
    }
  });

  app.put("/api/clients/:id", requireAdmin, async (req, res) => {
    try {
      const existingClient = await storage.getClient(req.params.id);
      
      // Whitelist allowed fields for client updates
      const allowedFields = ['name', 'email', 'phone', 'address', 'postcode', 'contactName', 'notes', 'portalEnabled'];
      const updates: Record<string, any> = {};
      
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }
      
      // Track who made the update
      updates.updatedByUserId = req.session.userId;
      
      const client = await storage.updateClient(req.params.id, updates);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      // Audit log: Client updated
      const currentUser = await storage.getUser(req.session.userId!);
      if (currentUser) {
        await logAuditEvent({
          userId: currentUser.id,
          userName: currentUser.name,
          userEmail: currentUser.email || undefined,
          userRole: currentUser.role,
          actionType: "update",
          actionCategory: "client",
          entityType: "client",
          entityId: req.params.id,
          description: `Updated client: ${client.name}`,
          changesBefore: existingClient ? { name: existingClient.name, email: existingClient.email, portalEnabled: existingClient.portalEnabled } : undefined,
          changesAfter: { name: client.name, email: client.email, portalEnabled: client.portalEnabled },
          severity: "info",
        });
      }
      
      res.json(client);
    } catch (error) {
      res.status(500).json({ error: "Failed to update client" });
    }
  });

  app.delete("/api/clients/:id", requireAdmin, async (req, res) => {
    try {
      const existingClient = await storage.getClient(req.params.id);
      
      await storage.deleteClient(req.params.id);
      
      // Audit log: Client deleted
      const currentUser = await storage.getUser(req.session.userId!);
      if (currentUser && existingClient) {
        await logAuditEvent({
          userId: currentUser.id,
          userName: currentUser.name,
          userEmail: currentUser.email || undefined,
          userRole: currentUser.role,
          actionType: "delete",
          actionCategory: "client",
          entityType: "client",
          entityId: req.params.id,
          description: `Deleted client: ${existingClient.name}`,
          changesBefore: { name: existingClient.name, email: existingClient.email },
          severity: "warning",
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete client" });
    }
  });

  // Client Contacts
  app.get("/api/clients/:id/contacts", requireAdmin, async (req, res) => {
    try {
      const contacts = await storage.getClientContacts(req.params.id);
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client contacts" });
    }
  });

  app.post("/api/clients/:id/contacts", requireAdmin, async (req, res) => {
    try {
      const contact = await storage.createClientContact({
        ...req.body,
        clientId: req.params.id,
      });
      res.json(contact);
    } catch (error) {
      res.status(500).json({ error: "Failed to create client contact" });
    }
  });

  app.patch("/api/clients/:id/contacts/:contactId", requireAdmin, async (req, res) => {
    try {
      const contact = await storage.updateClientContact(req.params.contactId, req.body);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      res.status(500).json({ error: "Failed to update client contact" });
    }
  });

  app.delete("/api/clients/:id/contacts/:contactId", requireAdmin, async (req, res) => {
    try {
      await storage.deleteClientContact(req.params.contactId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete client contact" });
    }
  });

  // Client Properties
  app.get("/api/clients/:id/properties", requireAuth, async (req, res) => {
    try {
      const properties = await storage.getClientProperties(req.params.id);
      res.json(properties);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client properties" });
    }
  });

  app.post("/api/clients/:id/properties", requireAdmin, async (req, res) => {
    try {
      const property = await storage.createClientProperty({ ...req.body, clientId: req.params.id });
      res.json(property);
    } catch (error) {
      res.status(500).json({ error: "Failed to create client property" });
    }
  });

  app.patch("/api/clients/:id/properties/:propertyId", requireAdmin, async (req, res) => {
    try {
      const property = await storage.updateClientProperty(req.params.propertyId, req.body);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }
      res.json(property);
    } catch (error) {
      res.status(500).json({ error: "Failed to update client property" });
    }
  });

  app.delete("/api/clients/:id/properties/:propertyId", requireAdmin, async (req, res) => {
    try {
      await storage.deleteClientProperty(req.params.propertyId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete client property" });
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
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
        invoiceDate: req.body.invoiceDate ? new Date(req.body.invoiceDate) : new Date(),
      });
      
      // Audit log: Invoice created
      const currentUser = await storage.getUser(req.session.userId!);
      if (currentUser && invoice) {
        await logAuditEvent({
          userId: currentUser.id,
          userName: currentUser.name,
          userEmail: currentUser.email || undefined,
          userRole: currentUser.role,
          actionType: "create",
          actionCategory: "invoice",
          entityType: "invoice",
          entityId: invoice.id,
          description: `Created invoice: ${invoiceNo} for ${invoice.customerName} - £${invoice.total}`,
          changesAfter: { invoiceNo, customerName: invoice.customerName, total: invoice.total, status: invoice.status },
          metadata: { jobId: invoice.jobId },
          severity: "info",
        });
      }
      
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
          name: "Snagging Pro (Julian)",
          description: "Professional UK refurbishment snagging agent. Assesses photos and videos of refurbishment works to identify snags and produce contractor-ready snag lists.",
          icon: "ClipboardCheck",
          category: "quality",
          systemPrompt: `You are Snagging Pro, a professional UK refurbishment snagging agent acting for TrueNorth OS. You behave as an experienced UK Site Manager or Clerk of Works.

Your purpose is to assess uploaded photos and videos of refurbishment works, identify snags relating only to new works and their interfaces, and produce fair, evidence-based, contractor-ready snag lists that protect TrueNorth OS' professional reputation.

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

  // Get AI-powered engineer suggestions for a job based on skills and availability
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

      // Get all jobs to calculate next availability
      const allJobs = await storage.getAllJobs();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Calculate next availability per engineer based on scheduled jobs
      const getNextAvailability = (engineerId: string): Date => {
        const engineerJobs = allJobs.filter(j => {
          const assignedIds = (j.assignedToIds as string[]) || (j.assignedToId ? [j.assignedToId] : []);
          return assignedIds.includes(engineerId) && j.status !== 'Signed Off' && j.status !== 'Completed';
        });

        // Get all scheduled dates for this engineer
        const scheduledDates = engineerJobs
          .filter(j => j.date)
          .map(j => new Date(j.date as Date))
          .filter(d => d >= today)
          .sort((a, b) => a.getTime() - b.getTime());

        if (scheduledDates.length === 0) {
          return today; // Available today
        }

        // Find the first gap in scheduled dates or return day after last scheduled job
        let checkDate = new Date(today);
        for (const scheduled of scheduledDates) {
          if (checkDate < scheduled) {
            return checkDate; // Found a gap
          }
          checkDate = new Date(scheduled);
          checkDate.setDate(checkDate.getDate() + 1);
        }
        return checkDate;
      };

      // Get skills and sub-skills for each engineer
      const engineerData = await Promise.all(engineers.map(async (eng) => {
        const skills = await storage.getUserSkills(eng.id);
        const userSkillRecords = await storage.getUserSkillRecords(eng.id);
        
        // Get sub-skills for each skill
        const skillsWithSubSkills = await Promise.all(skills.map(async (skill) => {
          const userSkillRecord = userSkillRecords.find(us => us.skillId === skill.id);
          const subSkillIds = (userSkillRecord?.subSkillIds as string[]) || [];
          const subSkills = subSkillIds.length > 0 ? await storage.getSubSkillsByIds(subSkillIds) : [];
          return {
            name: skill.name,
            subSkills: subSkills.map(ss => ss.name),
          };
        }));

        const nextAvailable = getNextAvailability(eng.id);
        
        return {
          id: eng.id,
          name: eng.name,
          skills: skillsWithSubSkills,
          skillNames: skills.map(s => s.name),
          nextAvailability: nextAvailable.toISOString().split('T')[0],
          isAvailableToday: nextAvailable.getTime() === today.getTime(),
        };
      }));

      // Get required skills for the job (if any)
      const requiredSkills = (job.requiredSkills as string[]) || [];

      // Build context for AI
      const jobContext = {
        description: job.description || 'No description',
        requiredSkills: requiredSkills,
      };

      // Try AI-powered suggestions if available
      const openai = getOpenAIClient();
      if (openai) {
        try {
          const systemPrompt = `You are an AI assistant helping assign field engineers to jobs. Your ONLY criteria for ranking is skills match.

IMPORTANT: Rank engineers SOLELY based on how well their skills (including sub-skills) match the job requirements.
Do NOT consider location, workload, or any other factors - only skills.

Return your response as a JSON object with a "suggestions" array of engineer suggestions, ordered by skills match (best first). Each suggestion should include:
- engineerId: the engineer's ID
- score: a skills match score from 0-100 (100 = perfect match)
- reason: a brief explanation of which skills match the job requirements
- matchedSkills: array of skill names that match the job`;

          const userPrompt = `Job Details:
${JSON.stringify(jobContext, null, 2)}

Available Engineers (with their skills and sub-skills):
${JSON.stringify(engineerData.map(e => ({ id: e.id, name: e.name, skills: e.skills })), null, 2)}

Please rank the engineers by skills match ONLY. Return valid JSON.`;

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
            
            // Enrich with engineer data
            const enrichedSuggestions = (Array.isArray(suggestions) ? suggestions : []).map((s: any) => {
              const eng = engineerData.find(e => e.id === s.engineerId);
              return {
                ...s,
                engineerName: eng?.name || 'Unknown',
                skills: eng?.skillNames || [],
                nextAvailability: eng?.nextAvailability || null,
                isAvailableToday: eng?.isAvailableToday || false,
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

      // Fallback: Simple skills-based suggestions
      const scoredEngineers = engineerData.map(eng => {
        let score = 0;
        let matchedSkills: string[] = [];

        // Skills match scoring - ONLY factor
        if (requiredSkills.length > 0) {
          for (const required of requiredSkills) {
            const reqLower = required.toLowerCase();
            // Check main skills
            const skillMatch = eng.skillNames.find(s => s.toLowerCase().includes(reqLower));
            if (skillMatch) {
              score += 100 / requiredSkills.length;
              matchedSkills.push(skillMatch);
            } else {
              // Check sub-skills
              for (const skill of eng.skills) {
                const subMatch = skill.subSkills.find(ss => ss.toLowerCase().includes(reqLower));
                if (subMatch) {
                  score += 80 / requiredSkills.length; // Slightly lower score for sub-skill match
                  matchedSkills.push(`${skill.name} (${subMatch})`);
                  break;
                }
              }
            }
          }
        } else {
          // No required skills specified - give base score based on total skills
          score = Math.min(50 + eng.skillNames.length * 10, 80);
        }

        return {
          engineerId: eng.id,
          engineerName: eng.name,
          score: Math.round(score),
          reason: matchedSkills.length > 0 
            ? `Matches: ${matchedSkills.join(', ')}`
            : `Has ${eng.skillNames.length} skills`,
          matchedSkills,
          skills: eng.skillNames,
          nextAvailability: eng.nextAvailability,
          isAvailableToday: eng.isAvailableToday,
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

  // POST endpoint for suggesting engineers for new job creation (no job ID required)
  app.post("/api/ai/suggest-engineers", requireRoles('admin'), async (req, res) => {
    try {
      const { description, requiredSkills = [] } = req.body;

      // Get all engineers (users with 'engineer' role)
      const allUsers = await storage.getAllUsers();
      const engineers = allUsers.filter(u => {
        const userRoles = (u.roles as string[]) || [u.role];
        return userRoles.includes('engineer');
      });

      if (engineers.length === 0) {
        return res.json({ suggestions: [], message: "No engineers available" });
      }

      // Get all jobs to calculate next availability
      const allJobs = await storage.getAllJobs();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Calculate next availability per engineer based on scheduled jobs
      const getNextAvailability = (engineerId: string): Date => {
        const engineerJobs = allJobs.filter(j => {
          const assignedIds = (j.assignedToIds as string[]) || (j.assignedToId ? [j.assignedToId] : []);
          return assignedIds.includes(engineerId) && j.status !== 'Signed Off' && j.status !== 'Completed';
        });

        // Get all scheduled dates for this engineer
        const scheduledDates = engineerJobs
          .filter(j => j.date)
          .map(j => new Date(j.date as Date))
          .filter(d => d >= today)
          .sort((a, b) => a.getTime() - b.getTime());

        if (scheduledDates.length === 0) {
          return today; // Available today
        }

        // Find the first gap in scheduled dates or return day after last scheduled job
        let checkDate = new Date(today);
        for (const scheduled of scheduledDates) {
          if (checkDate < scheduled) {
            return checkDate; // Found a gap
          }
          checkDate = new Date(scheduled);
          checkDate.setDate(checkDate.getDate() + 1);
        }
        return checkDate;
      };

      // Get skills and sub-skills for each engineer
      const engineerData = await Promise.all(engineers.map(async (eng) => {
        const skills = await storage.getUserSkills(eng.id);
        const userSkillRecords = await storage.getUserSkillRecords(eng.id);
        
        // Get sub-skills for each skill
        const skillsWithSubSkills = await Promise.all(skills.map(async (skill) => {
          const userSkillRecord = userSkillRecords.find(us => us.skillId === skill.id);
          const subSkillIds = (userSkillRecord?.subSkillIds as string[]) || [];
          const subSkills = subSkillIds.length > 0 ? await storage.getSubSkillsByIds(subSkillIds) : [];
          return {
            name: skill.name,
            subSkills: subSkills.map(ss => ss.name),
          };
        }));

        const nextAvailable = getNextAvailability(eng.id);
        
        return {
          id: eng.id,
          name: eng.name,
          skills: skillsWithSubSkills,
          skillNames: skills.map(s => s.name),
          nextAvailability: nextAvailable.toISOString().split('T')[0],
          isAvailableToday: nextAvailable.getTime() === today.getTime(),
        };
      }));

      // Build context for AI
      const jobContext = {
        description: description || 'No description',
        requiredSkills: requiredSkills,
      };

      // Try AI-powered suggestions if available
      const openai = getOpenAIClient();
      if (openai) {
        try {
          const systemPrompt = `You are an AI assistant helping assign field engineers to jobs. Your ONLY criteria for ranking is skills match.

IMPORTANT: Rank engineers SOLELY based on how well their skills (including sub-skills) match the job requirements.
Do NOT consider location, workload, or any other factors - only skills.

Return your response as a JSON object with a "suggestions" array of engineer suggestions, ordered by skills match (best first). Each suggestion should include:
- engineerId: the engineer's ID
- score: a skills match score from 0-100 (100 = perfect match)
- reason: a brief explanation of which skills match the job requirements
- matchedSkills: array of skill names that match the job`;

          const userPrompt = `Job Details:
${JSON.stringify(jobContext, null, 2)}

Available Engineers (with their skills and sub-skills):
${JSON.stringify(engineerData.map(e => ({ id: e.id, name: e.name, skills: e.skills })), null, 2)}

Please rank the engineers by skills match ONLY. Return valid JSON.`;

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
            
            // Enrich with engineer data
            const enrichedSuggestions = (Array.isArray(suggestions) ? suggestions : []).map((s: any) => {
              const eng = engineerData.find(e => e.id === s.engineerId);
              return {
                ...s,
                engineerName: eng?.name || 'Unknown',
                skills: eng?.skillNames || [],
                nextAvailability: eng?.nextAvailability || null,
                isAvailableToday: eng?.isAvailableToday || false,
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

      // Fallback: Simple skills-based suggestions
      const scoredEngineers = engineerData.map(eng => {
        let score = 0;
        let matchedSkills: string[] = [];

        // Skills match scoring - ONLY factor
        if (requiredSkills.length > 0) {
          for (const required of requiredSkills) {
            const reqLower = required.toLowerCase();
            // Check main skills
            const skillMatch = eng.skillNames.find(s => s.toLowerCase().includes(reqLower));
            if (skillMatch) {
              score += 100 / requiredSkills.length;
              matchedSkills.push(skillMatch);
            } else {
              // Check sub-skills
              for (const skill of eng.skills) {
                const subMatch = skill.subSkills.find(ss => ss.toLowerCase().includes(reqLower));
                if (subMatch) {
                  score += 80 / requiredSkills.length; // Slightly lower score for sub-skill match
                  matchedSkills.push(`${skill.name} (${subMatch})`);
                  break;
                }
              }
            }
          }
        } else {
          // No required skills specified - give base score based on total skills
          score = Math.min(50 + eng.skillNames.length * 10, 80);
        }

        return {
          engineerId: eng.id,
          engineerName: eng.name,
          score: Math.round(score),
          reason: matchedSkills.length > 0 
            ? `Matches: ${matchedSkills.join(', ')}`
            : `Has ${eng.skillNames.length} skills`,
          matchedSkills,
          skills: eng.skillNames,
          nextAvailability: eng.nextAvailability,
          isAvailableToday: eng.isAvailableToday,
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

  // ==================== AI-POWERED REPORT GENERATION ====================

  // Generate professional job completion report
  app.post("/api/jobs/:id/generate-report", requireAuth, async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Get company settings for branding
      const companySettings = await storage.getCompanySettings();

      // Get assigned engineers
      const allUsers = await storage.getAllUsers();
      const assignedIds = (job.assignedToIds as string[]) || (job.assignedToId ? [job.assignedToId] : []);
      const assignedEngineers = allUsers.filter(u => assignedIds.includes(u.id));

      // Get job updates if it's a long-running job
      let jobUpdates: any[] = [];
      if (job.isLongRunning) {
        jobUpdates = await storage.getJobUpdates(job.id);
      }

      // Prepare job data for report
      const photos = (job.photos as any[]) || [];
      const materials = (job.materials as any[]) || [];
      const signatures = (job.signatures as any[]) || [];
      const furtherActions = (job.furtherActions as any[]) || [];

      const openai = getOpenAIClient();
      
      let professionalSummary = "";
      let aiPowered = false;

      if (openai) {
        try {
          const systemPrompt = `You are a professional report writer for a UK field service company. Generate a concise, professional summary for a job completion report.

Write in formal British English. Be factual and professional. Focus on:
1. Work scope and what was accomplished
2. Key materials used (if any)
3. Any notable findings or actions taken
4. Overall job outcome

Keep the summary to 2-3 paragraphs maximum. Do not include signatures or photos - those are handled separately.`;

          const jobContext = `
Job Number: ${job.jobNo}
Customer: ${job.customerName}
Address: ${job.address || 'N/A'}, ${job.postcode || ''}
Date: ${job.date ? new Date(job.date).toLocaleDateString('en-GB') : 'N/A'}
Status: ${job.status}

Description:
${job.description || 'No description provided'}

Works Completed:
${job.worksCompleted || 'No completion notes'}

Engineer Notes:
${job.notes || 'No additional notes'}

Materials Used:
${materials.length > 0 ? materials.map((m: any) => `- ${m.quantity}x ${m.description}`).join('\n') : 'None recorded'}

Further Actions Required:
${furtherActions.length > 0 ? furtherActions.map((a: any) => `- [${a.priority}] ${a.description}`).join('\n') : 'None'}

${jobUpdates.length > 0 ? `
Daily Progress Updates:
${jobUpdates.map((u: any) => `- ${new Date(u.workDate).toLocaleDateString('en-GB')}: ${u.notes || 'No notes'}`).join('\n')}
` : ''}`;

          const response = await openai.chat.completions.create({
            model: "gpt-5",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `Generate a professional summary for this job:\n${jobContext}` }
            ],
            max_completion_tokens: 500,
          });

          professionalSummary = response.choices[0]?.message?.content || "";
          aiPowered = true;
        } catch (aiError) {
          console.error("AI report generation error:", aiError);
        }
      }

      // If AI failed, create a basic summary
      if (!professionalSummary) {
        professionalSummary = `This report documents the completion of Job ${job.jobNo} for ${job.customerName}${job.address ? ` at ${job.address}` : ''}. ${job.worksCompleted || job.description || 'Works have been completed as specified.'}`;
      }

      // Build the report
      const report = {
        generatedAt: new Date().toISOString(),
        aiPowered,
        company: {
          name: companySettings?.companyName || 'TrueNorth Field Services',
          address: companySettings?.companyAddress || '',
          phone: companySettings?.companyPhone || '',
          email: companySettings?.companyEmail || '',
        },
        job: {
          jobNo: job.jobNo,
          customerName: job.customerName,
          address: job.address,
          postcode: job.postcode,
          contactName: job.contactName,
          contactPhone: job.contactPhone,
          contactEmail: job.contactEmail,
          date: job.date,
          status: job.status,
          description: job.description,
          worksCompleted: job.worksCompleted,
          notes: job.notes,
        },
        engineers: assignedEngineers.map(e => ({
          name: e.name,
          role: e.role,
        })),
        materials: materials,
        photos: photos.filter((p: any) => p.isEvidence), // Only evidence photos
        adminPhotos: photos.filter((p: any) => !p.isEvidence), // Admin reference photos
        signatures: signatures,
        furtherActions: furtherActions,
        jobUpdates: jobUpdates.map((u: any) => ({
          date: u.workDate,
          notes: u.notes,
          photos: u.photos,
        })),
        professionalSummary,
        signOff: job.signOffTimestamp ? {
          timestamp: job.signOffTimestamp,
          address: job.signOffAddress,
          lat: job.signOffLat,
          lng: job.signOffLng,
        } : null,
      };

      res.json(report);
    } catch (error: any) {
      console.error("Report generation error:", error);
      res.status(500).json({ error: error.message || "Failed to generate report" });
    }
  });

  // ==================== AI-POWERED DOCUMENT SCANNER ====================

  // Scan document (invoice, certificate, contract) and extract data
  app.post("/api/ai/scan-document", requireAuth, async (req, res) => {
    try {
      const { image, documentType } = req.body;

      if (!image) {
        return res.status(400).json({ error: "Image is required" });
      }

      const validTypes = ['invoice', 'certificate', 'contract', 'receipt', 'other'];
      const docType = validTypes.includes(documentType) ? documentType : 'other';

      const openai = getOpenAIClient();
      if (!openai) {
        return res.status(503).json({ error: "AI service not available. Please configure OpenAI API key." });
      }

      let systemPrompt = "";
      let extractionSchema = {};

      switch (docType) {
        case 'invoice':
          systemPrompt = `You are a document scanner specialized in UK supplier invoices. Extract key information from the uploaded invoice image.

Extract and return as JSON:
- vendorName: The supplier/vendor company name
- vendorAddress: Full vendor address
- invoiceNumber: Invoice number/reference
- invoiceDate: Date in DD/MM/YYYY format
- dueDate: Payment due date in DD/MM/YYYY format (if visible)
- subtotal: Amount before VAT (as number)
- vatAmount: VAT amount (as number)
- vatRate: VAT percentage (as number, e.g., 20)
- total: Total amount including VAT (as number)
- currency: Currency code (default GBP)
- lineItems: Array of {description, quantity, unitPrice, total}
- paymentDetails: Bank details if visible
- purchaseOrderRef: PO reference if visible

Return ONLY valid JSON. Use null for fields not found.`;
          break;

        case 'certificate':
          systemPrompt = `You are a document scanner specialized in UK trade certificates (Gas Safe, NICEIC, etc.). Extract key information from the uploaded certificate image.

Extract and return as JSON:
- certificateType: Type of certificate (e.g., "Gas Safe", "NICEIC", "Part P", "F-Gas")
- certificateNumber: Certificate/registration number
- holderName: Name of certificate holder
- companyName: Company name if applicable
- issueDate: Issue date in DD/MM/YYYY format
- expiryDate: Expiry date in DD/MM/YYYY format
- issuingBody: Name of issuing organization
- categories: Array of work categories/scopes covered
- address: Registered address if visible

Return ONLY valid JSON. Use null for fields not found.`;
          break;

        case 'contract':
          systemPrompt = `You are a document scanner specialized in UK service contracts. Extract key information from the uploaded contract image.

Extract and return as JSON:
- contractTitle: Title or type of contract
- partyA: First party name (usually your company)
- partyB: Second party name (client)
- contractDate: Contract date in DD/MM/YYYY format
- startDate: Service start date in DD/MM/YYYY format
- endDate: Service end date in DD/MM/YYYY format
- contractValue: Total contract value (as number)
- paymentTerms: Payment terms description
- scope: Brief description of work scope
- keyTerms: Array of key terms or conditions

Return ONLY valid JSON. Use null for fields not found.`;
          break;

        case 'receipt':
          systemPrompt = `You are a document scanner specialized in UK purchase receipts. Extract key information from the uploaded receipt image.

Extract and return as JSON:
- vendorName: Shop/vendor name
- vendorAddress: Address if visible
- receiptDate: Date in DD/MM/YYYY format
- receiptNumber: Receipt number if visible
- items: Array of {description, quantity, price}
- subtotal: Amount before VAT (as number)
- vatAmount: VAT amount if shown (as number)
- total: Total amount (as number)
- paymentMethod: How it was paid (cash, card, etc.)
- currency: Currency code (default GBP)

Return ONLY valid JSON. Use null for fields not found.`;
          break;

        default:
          systemPrompt = `You are a document scanner. Extract any useful information from the uploaded document image.

Extract and return as JSON:
- documentType: Your best guess at the document type
- title: Document title if visible
- date: Any date found in DD/MM/YYYY format
- parties: Any company or person names mentioned
- keyValues: Object with any key-value pairs found
- summary: Brief summary of the document content

Return ONLY valid JSON.`;
      }

      // Build message content with image
      const messageContent: any[] = [
        { type: "text", text: `Please scan this ${docType} and extract the relevant information.` }
      ];

      // Handle base64 image
      if (image.startsWith('data:')) {
        messageContent.push({
          type: "image_url",
          image_url: { url: image }
        });
      } else {
        // Assume it's a URL
        messageContent.push({
          type: "image_url",
          image_url: { url: image }
        });
      }

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: messageContent }
        ],
        max_completion_tokens: 1024,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return res.status(500).json({ error: "No response from AI" });
      }

      const extractedData = JSON.parse(content);

      res.json({
        success: true,
        documentType: docType,
        extractedData,
        confidence: "high", // Could be enhanced with actual confidence scoring
        aiPowered: true,
      });
    } catch (error: any) {
      console.error("Document scan error:", error);
      if (error.message?.includes('JSON')) {
        return res.status(500).json({ error: "Failed to parse extracted data" });
      }
      res.status(500).json({ error: error.message || "Failed to scan document" });
    }
  });

  // Scan client document (business card, letterhead, etc.) and extract client details
  app.post("/api/ai/scan-client-document", requireAuth, async (req, res) => {
    try {
      const { image } = req.body;

      if (!image) {
        return res.status(400).json({ error: "Image is required" });
      }

      // Server-side validation for image
      if (typeof image !== 'string') {
        return res.status(400).json({ error: "Image must be a string" });
      }

      // Validate base64 data URL format and size
      if (image.startsWith('data:')) {
        const mimeMatch = image.match(/^data:(image\/(jpeg|jpg|png|gif|webp|bmp));base64,/i);
        if (!mimeMatch) {
          return res.status(400).json({ error: "Invalid image format. Supported formats: JPEG, PNG, GIF, WebP, BMP" });
        }
        
        // Check size (base64 encoded) - limit to ~10MB (base64 is ~33% larger than binary)
        const base64Data = image.split(',')[1] || '';
        const sizeInBytes = (base64Data.length * 3) / 4;
        const maxSizeBytes = 10 * 1024 * 1024; // 10MB
        if (sizeInBytes > maxSizeBytes) {
          return res.status(400).json({ error: "Image too large. Maximum size is 10MB" });
        }
      } else if (!image.startsWith('http://') && !image.startsWith('https://')) {
        return res.status(400).json({ error: "Invalid image. Must be a base64 data URL or HTTP/HTTPS URL" });
      }

      const openai = getOpenAIClient();
      if (!openai) {
        return res.status(503).json({ error: "AI service not available. Please configure OpenAI API key." });
      }

      const systemPrompt = `You are a document scanner specialized in extracting business contact information from images such as business cards, company letterheads, invoices, or any document containing client/company details.

Extract and return as JSON:
- name: Company/Business name (the main business or company name)
- contactName: Contact person's full name (individual person's name)
- email: Email address
- phone: Phone number (format as UK style if possible, e.g., 01onal 234 5678)
- address: Full street address (exclude postcode)
- postcode: UK postcode if visible

Important rules:
1. Return ONLY valid JSON with exactly these fields
2. Use null for any fields not found in the image
3. If you see both a company name and a person's name, put company in "name" and person in "contactName"
4. Clean up phone numbers to readable format
5. Separate the postcode from the address field
6. For UK addresses, ensure proper formatting

Return ONLY valid JSON, nothing else.`;

      // Build message content with image
      const messageContent: any[] = [
        { type: "text", text: "Please scan this document and extract the client/business contact information." }
      ];

      messageContent.push({
        type: "image_url",
        image_url: { url: image }
      });

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: messageContent }
        ],
        max_tokens: 1024,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return res.status(500).json({ error: "No response from AI" });
      }

      // Safely parse the AI response with fallback handling
      let extractedData: Record<string, any> = {};
      try {
        extractedData = JSON.parse(content);
      } catch (parseError) {
        console.error("Failed to parse AI response:", content);
        return res.status(500).json({ 
          error: "Could not extract data from this image. Please try a clearer image or enter details manually." 
        });
      }

      // Validate and sanitize extracted fields with type checking
      const safeString = (value: any): string => {
        if (value === null || value === undefined) return "";
        if (typeof value === 'string') return value.trim();
        if (typeof value === 'number') return String(value);
        return "";
      };

      res.json({
        success: true,
        extractedData: {
          name: safeString(extractedData.name),
          contactName: safeString(extractedData.contactName),
          email: safeString(extractedData.email),
          phone: safeString(extractedData.phone),
          address: safeString(extractedData.address),
          postcode: safeString(extractedData.postcode),
        },
        aiPowered: true,
      });
    } catch (error: any) {
      console.error("Client document scan error:", error);
      if (error.code === 'insufficient_quota') {
        return res.status(503).json({ error: "AI service quota exceeded. Please try again later." });
      }
      res.status(500).json({ error: error.message || "Failed to scan document" });
    }
  });

  // ==================== GEMINI AI FEATURES ====================

  // Import Gemini AI service functions
  const geminiAI = await import("./services/gemini-ai");

  // AI Receipt Scanner (Gemini-powered)
  app.post("/api/ai/gemini/scan-receipt", requireAuth, async (req, res) => {
    try {
      const { image } = req.body;
      if (!image) {
        return res.status(400).json({ error: "Image is required" });
      }
      const result = await geminiAI.scanReceipt(image);
      res.json({ success: true, data: result, aiPowered: true, model: "gemini" });
    } catch (error: any) {
      console.error("Gemini receipt scan error:", error);
      res.status(500).json({ error: error.message || "Failed to scan receipt" });
    }
  });

  // AI Site Photo Analysis (Gemini-powered)
  app.post("/api/ai/gemini/analyze-photo", requireAuth, async (req, res) => {
    try {
      const { image, jobContext } = req.body;
      if (!image) {
        return res.status(400).json({ error: "Image is required" });
      }
      const result = await geminiAI.analyzeSitePhoto(image, jobContext);
      res.json({ success: true, data: result, aiPowered: true, model: "gemini" });
    } catch (error: any) {
      console.error("Gemini photo analysis error:", error);
      res.status(500).json({ error: error.message || "Failed to analyze photo" });
    }
  });

  // AI Job Summary Generator (Gemini-powered)
  app.post("/api/ai/gemini/generate-job-summary", requireAuth, async (req, res) => {
    try {
      const { engineerNotes, jobDetails } = req.body;
      if (!engineerNotes) {
        return res.status(400).json({ error: "Engineer notes are required" });
      }
      const result = await geminiAI.generateJobSummary(engineerNotes, jobDetails || {});
      res.json({ success: true, data: result, aiPowered: true, model: "gemini" });
    } catch (error: any) {
      console.error("Gemini job summary error:", error);
      res.status(500).json({ error: error.message || "Failed to generate job summary" });
    }
  });

  // AI Quote Description Generator (Gemini-powered)
  app.post("/api/ai/gemini/generate-quote", requireAuth, async (req, res) => {
    try {
      const { jobDetails, services } = req.body;
      if (!services || !Array.isArray(services)) {
        return res.status(400).json({ error: "Services array is required" });
      }
      const result = await geminiAI.generateQuoteDescription(jobDetails || {}, services);
      res.json({ success: true, data: result, aiPowered: true, model: "gemini" });
    } catch (error: any) {
      console.error("Gemini quote generation error:", error);
      res.status(500).json({ error: error.message || "Failed to generate quote" });
    }
  });

  // AI Customer Message Generator (Gemini-powered)
  app.post("/api/ai/gemini/generate-message", requireAuth, async (req, res) => {
    try {
      const { messageType, customerName, details } = req.body;
      const validTypes = ["appointment_confirmation", "job_complete", "follow_up", "quote_sent", "invoice_reminder"];
      if (!validTypes.includes(messageType)) {
        return res.status(400).json({ error: "Invalid message type" });
      }
      if (!customerName) {
        return res.status(400).json({ error: "Customer name is required" });
      }
      const result = await geminiAI.generateCustomerMessage(messageType, customerName, details || {});
      res.json({ success: true, data: result, aiPowered: true, model: "gemini" });
    } catch (error: any) {
      console.error("Gemini message generation error:", error);
      res.status(500).json({ error: error.message || "Failed to generate message" });
    }
  });

  // AI Inspection Report Generator (Gemini-powered)
  app.post("/api/ai/gemini/generate-inspection-report", requireAuth, async (req, res) => {
    try {
      const { checklistData, inspectionType } = req.body;
      if (!checklistData || !Array.isArray(checklistData)) {
        return res.status(400).json({ error: "Checklist data is required" });
      }
      const result = await geminiAI.generateInspectionReport(checklistData, inspectionType || "General Inspection");
      res.json({ success: true, data: result, aiPowered: true, model: "gemini" });
    } catch (error: any) {
      console.error("Gemini inspection report error:", error);
      res.status(500).json({ error: error.message || "Failed to generate inspection report" });
    }
  });

  // AI Voice Transcription (Gemini-powered)
  app.post("/api/ai/gemini/transcribe-voice", requireAuth, async (req, res) => {
    try {
      const { audio, mimeType } = req.body;
      if (!audio) {
        return res.status(400).json({ error: "Audio data is required" });
      }
      const result = await geminiAI.transcribeVoiceNote(audio, mimeType || "audio/webm");
      res.json({ success: true, data: result, aiPowered: true, model: "gemini" });
    } catch (error: any) {
      console.error("Gemini transcription error:", error);
      res.status(500).json({ error: error.message || "Failed to transcribe audio" });
    }
  });

  // AI Image Generation (Gemini-powered)
  app.post("/api/ai/gemini/generate-image", requireAuth, async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }
      const imageDataUrl = await geminiAI.generateImage(prompt);
      res.json({ success: true, data: { image: imageDataUrl }, aiPowered: true, model: "gemini" });
    } catch (error: any) {
      console.error("Gemini image generation error:", error);
      res.status(500).json({ error: error.message || "Failed to generate image" });
    }
  });

  // ==================== EXCEPTIONS ====================

  app.get("/api/exceptions", requireAuth, async (req, res) => {
    try {
      const status = req.query.status as string;
      const type = req.query.type as string;
      const severity = req.query.severity as string;
      
      const filters: { status?: string; type?: string; severity?: string } = {};
      if (status && status !== 'all') filters.status = status;
      if (type && type !== 'all') filters.type = type;
      if (severity && severity !== 'all') filters.severity = severity;
      
      const exceptionsList = await storage.getExceptions(filters);
      res.json(exceptionsList);
    } catch (error) {
      console.error('[exceptions] Error fetching exceptions:', error);
      res.status(500).json({ error: 'Failed to fetch exceptions' });
    }
  });

  app.get("/api/exceptions/:id", requireAuth, async (req, res) => {
    try {
      const exception = await storage.getException(req.params.id);
      if (!exception) {
        return res.status(404).json({ error: 'Exception not found' });
      }
      res.json(exception);
    } catch (error) {
      console.error('[exceptions] Error fetching exception:', error);
      res.status(500).json({ error: 'Failed to fetch exception' });
    }
  });

  app.post("/api/exceptions/:id/resolve", requireAuth, async (req, res) => {
    try {
      const { notes } = req.body;
      const exception = await storage.resolveException(
        req.params.id, 
        req.session.userId!, 
        notes
      );
      if (!exception) {
        return res.status(404).json({ error: 'Exception not found' });
      }
      res.json(exception);
    } catch (error) {
      console.error('[exceptions] Error resolving exception:', error);
      res.status(500).json({ error: 'Failed to resolve exception' });
    }
  });

  app.patch("/api/exceptions/:id", requireAuth, async (req, res) => {
    try {
      const exception = await storage.updateException(req.params.id, req.body);
      if (!exception) {
        return res.status(404).json({ error: 'Exception not found' });
      }
      res.json(exception);
    } catch (error) {
      console.error('[exceptions] Error updating exception:', error);
      res.status(500).json({ error: 'Failed to update exception' });
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

  // Get available vehicles (unassigned)
  app.get("/api/fleet/vehicles-available", requireAuth, async (req, res) => {
    try {
      const vehicles = await storage.getAvailableVehicles();
      res.json(vehicles);
    } catch (error) {
      console.error("Get available vehicles error:", error);
      res.status(500).json({ error: "Failed to get available vehicles" });
    }
  });

  // Get vehicles assigned to a user
  app.get("/api/users/:userId/vehicles", requireAuth, async (req, res) => {
    try {
      const vehicles = await storage.getVehiclesByUserId(req.params.userId);
      res.json(vehicles);
    } catch (error) {
      console.error("Get user vehicles error:", error);
      res.status(500).json({ error: "Failed to get user vehicles" });
    }
  });

  // Assign vehicle to user
  app.post("/api/fleet/vehicles/:vehicleId/assign", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.body;
      const vehicle = await storage.assignVehicleToUser(req.params.vehicleId, userId || null);
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      res.json(vehicle);
    } catch (error) {
      console.error("Assign vehicle error:", error);
      res.status(500).json({ error: "Failed to assign vehicle" });
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

  // Simple GET endpoint to reset passwords - requires secret key (dev only)
  app.get("/api/reset-demo", async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).send("Not available in production");
    }
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
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: "Seed not available in production" });
    }
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
          name: "Snagging Pro (Julian)",
          description: "Professional UK refurbishment snagging agent. Assesses photos and videos of refurbishment works to identify snags and produce contractor-ready snag lists.",
          icon: "ClipboardCheck",
          category: "quality",
          systemPrompt: `You are Snagging Pro, a professional UK refurbishment snagging agent acting for TrueNorth OS. You behave as an experienced UK Site Manager or Clerk of Works.

Your purpose is to assess uploaded photos and videos of refurbishment works, identify snags relating only to new works and their interfaces, and produce fair, evidence-based, contractor-ready snag lists that protect TrueNorth OS' professional reputation.

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
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: "Seed not available in production" });
    }
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
      const MAX_RECEIPT_SIZE = 2 * 1024 * 1024;
      
      if (req.body.receiptUrl && req.body.receiptUrl.startsWith("data:image/")) {
        const base64Size = req.body.receiptUrl.length * 0.75;
        if (base64Size > MAX_RECEIPT_SIZE) {
          return res.status(400).json({ error: "Receipt image is too large. Please use a smaller image." });
        }
      }
      
      const data = insertExpenseSchema.parse({
        ...req.body,
        userId: req.body.userId || req.session.userId,
      });
      if (req.session.userRole !== "admin" && data.userId !== req.session.userId) {
        return res.status(403).json({ error: "Cannot create expense for another user" });
      }
      const expense = await storage.createExpense(data);
      
      if (data.receiptUrl && data.receiptUrl.startsWith("data:image/")) {
        try {
          await storage.createAccountsReceipt({
            expenseId: expense.id,
            uploadedById: req.session.userId!,
            imageUrl: data.receiptUrl,
            isProcessed: false,
          });
        } catch (receiptError) {
          console.error("Failed to create accounts receipt:", receiptError);
        }
      }
      
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

  // ==================== CUSTOMER PORTAL ROUTES ====================

  app.get("/api/portal/:token", async (req, res) => {
    try {
      const client = await storage.getClientByPortalToken(req.params.token);
      if (!client) {
        return res.status(404).json({ error: "Portal not found or has expired" });
      }
      
      // Check if portal access is enabled for this client
      if (!client.portalEnabled) {
        return res.status(403).json({ error: "Portal access is disabled for this account. Please contact support." });
      }
      
      // Check if client has password set and if authenticated
      if (client.portalPassword && req.session?.portalClientId !== client.id) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const [quotes, invoices, jobs, companySettings] = await Promise.all([
        storage.getClientQuotes(client.id),
        storage.getClientInvoices(client.id),
        storage.getClientJobs(client.id),
        storage.getCompanySettings(),
      ]);
      
      res.json({
        client: {
          id: client.id,
          name: client.name,
          email: client.email,
        },
        quotes: quotes.map(q => ({
          id: q.id,
          quoteNo: q.quoteNo,
          accessToken: q.accessToken,
          total: q.total,
          status: q.status,
          quoteDate: q.quoteDate,
          expiryDate: q.expiryDate,
          description: q.description,
        })),
        invoices: invoices.map(i => ({
          id: i.id,
          invoiceNo: i.invoiceNo,
          accessToken: i.accessToken,
          total: i.total,
          status: i.status,
          invoiceDate: i.invoiceDate,
          dueDate: i.dueDate,
        })),
        jobs: jobs.map(j => ({
          id: j.id,
          jobNo: j.jobNo,
          status: j.status,
          description: j.description,
          address: j.address,
          date: j.date,
        })),
        companySettings,
      });
    } catch (error) {
      console.error("Portal access error:", error);
      res.status(500).json({ error: "Failed to load portal" });
    }
  });

  // Portal status check (for login flow)
  app.get("/api/portal/:token/status", async (req, res) => {
    try {
      const client = await storage.getClientByPortalToken(req.params.token);
      if (!client) {
        return res.status(404).json({ error: "Portal not found" });
      }
      
      if (!client.portalEnabled) {
        return res.status(403).json({ error: "Portal access is disabled for this account" });
      }
      
      const companySettings = await storage.getCompanySettings();
      
      res.json({
        hasPassword: !!client.portalPassword,
        isAuthenticated: req.session?.portalClientId === client.id,
        companyName: companySettings?.companyName || null
      });
    } catch (error) {
      console.error("Portal status error:", error);
      res.status(500).json({ error: "Failed to check portal status" });
    }
  });

  // Portal password setup (first time)
  app.post("/api/portal/:token/setup", async (req, res) => {
    try {
      const client = await storage.getClientByPortalToken(req.params.token);
      if (!client) {
        return res.status(404).json({ error: "Portal not found" });
      }
      
      if (!client.portalEnabled) {
        return res.status(403).json({ error: "Portal access is disabled" });
      }
      
      if (client.portalPassword) {
        return res.status(400).json({ error: "Password already set. Please login instead." });
      }
      
      const { password } = req.body;
      if (!password || password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }
      
      // Hash password
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.hash(password, 10);
      
      await storage.updateClient(client.id, { 
        portalPassword: hashedPassword,
        portalPasswordSetAt: new Date()
      });
      
      // Set session
      req.session.portalClientId = client.id;
      
      res.json({ success: true });
    } catch (error) {
      console.error("Portal setup error:", error);
      res.status(500).json({ error: "Failed to set password" });
    }
  });

  // Portal login
  app.post("/api/portal/:token/login", async (req, res) => {
    try {
      const client = await storage.getClientByPortalToken(req.params.token);
      if (!client) {
        return res.status(404).json({ error: "Portal not found" });
      }
      
      if (!client.portalEnabled) {
        return res.status(403).json({ error: "Portal access is disabled" });
      }
      
      if (!client.portalPassword) {
        return res.status(400).json({ error: "Please set up your password first" });
      }
      
      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ error: "Password is required" });
      }
      
      // Verify password
      const bcrypt = await import('bcryptjs');
      const isValid = await bcrypt.compare(password, client.portalPassword);
      
      if (!isValid) {
        return res.status(401).json({ error: "Invalid password" });
      }
      
      // Set session
      req.session.portalClientId = client.id;
      
      res.json({ success: true });
    } catch (error) {
      console.error("Portal login error:", error);
      res.status(500).json({ error: "Failed to login" });
    }
  });

  // Portal forgot password
  app.post("/api/portal/:token/forgot-password", async (req, res) => {
    try {
      const client = await storage.getClientByPortalToken(req.params.token);
      if (!client) {
        return res.status(404).json({ error: "Portal not found" });
      }
      
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      
      // Check if email matches (case insensitive)
      if (client.email?.toLowerCase() !== email.toLowerCase()) {
        // Don't reveal if email matches for security
        return res.json({ success: true });
      }
      
      // Generate reset token
      const resetToken = crypto.randomUUID();
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      
      await storage.updateClient(client.id, {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires
      });
      
      // Send password reset email
      const companySettings = await storage.getCompanySettings();
      const baseUrl = process.env.REPLIT_DEPLOYMENT_URL
        || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : '')
        || `${req.protocol}://${req.get('host')}`;
      const resetUrl = `${baseUrl}/portal/${req.params.token}/reset/${resetToken}`;
      
      try {
        await sendPasswordResetEmail(
          client.email!,
          client.name,
          resetUrl,
          companySettings?.companyName || 'Your Service Provider'
        );
      } catch (emailError) {
        console.error("Failed to send password reset email:", emailError);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Portal forgot password error:", error);
      res.status(500).json({ error: "Failed to process request" });
    }
  });

  // Portal password reset
  app.post("/api/portal/:token/reset/:resetToken", async (req, res) => {
    try {
      const client = await storage.getClientByPortalToken(req.params.token);
      if (!client) {
        return res.status(404).json({ error: "Portal not found" });
      }
      
      if (!client.passwordResetToken || client.passwordResetToken !== req.params.resetToken) {
        return res.status(400).json({ error: "Invalid or expired reset link" });
      }
      
      if (client.passwordResetExpires && new Date(client.passwordResetExpires) < new Date()) {
        return res.status(400).json({ error: "Reset link has expired" });
      }
      
      const { password } = req.body;
      if (!password || password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }
      
      // Hash password
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.hash(password, 10);
      
      await storage.updateClient(client.id, { 
        portalPassword: hashedPassword,
        portalPasswordSetAt: new Date(),
        passwordResetToken: null,
        passwordResetExpires: null
      });
      
      // Set session
      req.session.portalClientId = client.id;
      
      res.json({ success: true });
    } catch (error) {
      console.error("Portal reset error:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  app.post("/api/clients/:id/generate-portal-token", requireAdmin, async (req, res) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      const portalToken = crypto.randomUUID();
      await storage.updateClient(req.params.id, { portalToken, portalEnabled: true });
      
      const baseUrl = process.env.REPLIT_DEPLOYMENT_URL
        || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : '')
        || `${req.protocol}://${req.get('host')}`;
      const portalUrl = `${baseUrl}/portal/${portalToken}`;
      
      let emailSent = false;
      let emailError = '';
      if (req.body.sendEmail && client.email) {
        try {
          const companySettings = await storage.getCompanySettings();
          emailSent = await sendPortalInvitation(
            client.email,
            client.name,
            portalUrl,
            companySettings?.companyName || 'Your Service Provider'
          );
          if (!emailSent) {
            emailError = 'Email service returned failure. Check Outlook integration connection.';
          }
        } catch (err: any) {
          console.error("Failed to send portal invitation email:", err);
          emailError = err?.message || 'Failed to send email';
        }
      } else if (req.body.sendEmail && !client.email) {
        emailError = 'Client has no email address on file';
      }
      
      res.json({ 
        portalToken,
        portalUrl: `/portal/${portalToken}`,
        fullUrl: portalUrl,
        emailSent,
        emailError
      });
    } catch (error) {
      console.error("Generate portal token error:", error);
      res.status(500).json({ error: "Failed to generate portal token" });
    }
  });

  // ==================== BLOG POSTS ROUTES ====================
  
  app.get("/api/blog-posts", async (req, res) => {
    try {
      const posts = await storage.getPublishedBlogPosts();
      res.json(posts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch blog posts" });
    }
  });
  
  app.get("/api/admin/blog-posts", requireAdmin, async (req, res) => {
    try {
      const posts = await storage.getAllBlogPosts();
      res.json(posts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch blog posts" });
    }
  });
  
  app.post("/api/admin/blog-posts", requireAdmin, async (req, res) => {
    try {
      const data = { ...req.body };
      if (data.publishedAt) {
        data.publishedAt = new Date(data.publishedAt);
      }
      const post = await storage.createBlogPost(data);
      res.json(post);
    } catch (error) {
      console.error("Create blog post error:", error);
      res.status(500).json({ error: "Failed to create blog post" });
    }
  });
  
  app.put("/api/admin/blog-posts/:id", requireAdmin, async (req, res) => {
    try {
      const updates = { ...req.body };
      if (updates.publishedAt !== undefined) {
        updates.publishedAt = updates.publishedAt ? new Date(updates.publishedAt) : null;
      }
      updates.updatedAt = new Date();
      const post = await storage.updateBlogPost(req.params.id, updates);
      if (!post) {
        return res.status(404).json({ error: "Blog post not found" });
      }
      res.json(post);
    } catch (error) {
      console.error("Update blog post error:", error);
      res.status(500).json({ error: "Failed to update blog post" });
    }
  });
  
  app.delete("/api/admin/blog-posts/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteBlogPost(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete blog post error:", error);
      res.status(500).json({ error: "Failed to delete blog post" });
    }
  });

  app.post("/api/admin/blog-posts/upload-image", requireAdmin, async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      res.json({ uploadURL, objectPath });
    } catch (error) {
      console.error("Blog image upload error:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // ==================== FEEDBACK ROUTES ====================

  app.post("/api/feedback", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      const bodySchema = z.object({
        category: z.enum(["bug", "improvement", "feature", "other"]).default("bug"),
        subject: z.string().min(1, "Subject is required").max(200),
        description: z.string().min(1, "Description is required").max(5000),
        page: z.string().nullable().optional(),
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
      }
      const data = {
        userId: String(user.id),
        userName: user.name || user.username || "Unknown",
        userRole: user.role || "user",
        status: "new" as const,
        ...parsed.data,
      };
      const item = await storage.createFeedback(data);
      res.json(item);
    } catch (error) {
      console.error("Create feedback error:", error);
      res.status(500).json({ error: "Failed to submit feedback" });
    }
  });

  app.get("/api/admin/feedback", requireSuperAdmin, async (req, res) => {
    try {
      const items = await storage.getAllFeedback();
      res.json(items);
    } catch (error) {
      console.error("Get feedback error:", error);
      res.status(500).json({ error: "Failed to fetch feedback" });
    }
  });

  app.put("/api/admin/feedback/:id", requireSuperAdmin, async (req, res) => {
    try {
      const updateSchema = z.object({
        status: z.enum(["new", "in_progress", "resolved", "dismissed"]).optional(),
        adminNotes: z.string().max(5000).optional(),
      });
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
      }
      const updates: Record<string, any> = {};
      if (parsed.data.status !== undefined) updates.status = parsed.data.status;
      if (parsed.data.adminNotes !== undefined) updates.adminNotes = parsed.data.adminNotes;
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }
      const updated = await storage.updateFeedback(req.params.id, updates);
      if (!updated) {
        return res.status(404).json({ error: "Feedback not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Update feedback error:", error);
      res.status(500).json({ error: "Failed to update feedback" });
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

          const paidInvoice = await storage.updateInvoice(invoiceId, {
            status: "Paid",
            paidAt: new Date(),
          });

          notifyAdmins({
            type: 'invoice_paid',
            title: 'Invoice Paid',
            message: `Invoice ${paidInvoice?.invoiceNo || invoiceId} for ${paidInvoice?.customerName || 'Customer'} (£${(paymentIntent.amount / 100).toFixed(2)}) has been paid via card`,
            category: 'expenses',
            timestamp: new Date().toISOString(),
            linkUrl: `/app/invoices`,
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

  // ==================== FILE STORAGE ROUTES ====================
  
  registerObjectStorageRoutes(app);
  registerGlobalAssistantRoutes(app);
  registerAiRoutes(app);
  registerSupportChatRoutes(app);
  registerPublicChatbotRoutes(app);

  app.get("/api/files", requireAuth, async (req, res) => {
    try {
      const files = await storage.getAllFiles();
      res.json(files);
    } catch (error) {
      console.error("Get files error:", error);
      res.status(500).json({ error: "Failed to get files" });
    }
  });

  app.get("/api/files/:id", requireAuth, async (req, res) => {
    try {
      const file = await storage.getFile(req.params.id);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      res.json(file);
    } catch (error) {
      console.error("Get file error:", error);
      res.status(500).json({ error: "Failed to get file" });
    }
  });

  app.get("/api/clients/:clientId/files", requireAuth, async (req, res) => {
    try {
      const files = await storage.getFilesByClient(req.params.clientId);
      res.json(files);
    } catch (error) {
      console.error("Get client files error:", error);
      res.status(500).json({ error: "Failed to get client files" });
    }
  });

  app.get("/api/jobs/:jobId/files", requireAuth, async (req, res) => {
    try {
      const files = await storage.getFilesByJob(req.params.jobId);
      res.json(files);
    } catch (error) {
      console.error("Get job files error:", error);
      res.status(500).json({ error: "Failed to get job files" });
    }
  });

  app.get("/api/expenses/:expenseId/files", requireAuth, async (req, res) => {
    try {
      const files = await storage.getFilesByExpense(req.params.expenseId);
      res.json(files);
    } catch (error) {
      console.error("Get expense files error:", error);
      res.status(500).json({ error: "Failed to get expense files" });
    }
  });

  app.post("/api/files", requireAuth, async (req, res) => {
    try {
      const data = insertFileSchema.parse({
        ...req.body,
        uploadedById: req.session.userId,
      });
      const file = await storage.createFile(data);
      res.status(201).json(file);
    } catch (error) {
      console.error("Create file error:", error);
      res.status(500).json({ error: "Failed to create file" });
    }
  });

  app.patch("/api/files/:id", requireAuth, async (req, res) => {
    try {
      const { clientId, jobId, expenseId, category, tags, notes } = req.body;
      const file = await storage.updateFile(req.params.id, {
        clientId,
        jobId,
        expenseId,
        category,
        tags,
        notes,
      });
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      res.json(file);
    } catch (error) {
      console.error("Update file error:", error);
      res.status(500).json({ error: "Failed to update file" });
    }
  });

  app.delete("/api/files/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteFile(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete file error:", error);
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  app.post("/api/files/analyze", requireAdmin, async (req, res) => {
    try {
      const { objectPath, fileName, mimeType } = req.body;
      
      if (!objectPath || typeof objectPath !== 'string') {
        return res.status(400).json({ error: "Valid object path is required" });
      }

      if (!objectPath.startsWith('/objects/')) {
        return res.status(400).json({ error: "Invalid object path format" });
      }

      const openai = getOpenAIClient();
      if (!openai) {
        return res.status(503).json({ error: "AI service not available" });
      }

      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers.host;
      const publicFileUrl = `${protocol}://${host}${objectPath}`;

      const clients = await storage.getAllClients();
      const jobs = await storage.getAllJobs();

      const clientList = clients.slice(0, 50).map(c => `- ${c.name} (ID: ${c.id})`).join("\n");
      const jobList = jobs.slice(0, 50).map(j => `- ${j.jobNo}: ${j.customerName || 'No customer'} - ${j.description || 'No description'}${j.address ? ` at ${j.address}` : ''} (ID: ${j.id})`).join("\n");

      const isImage = mimeType?.startsWith("image/");
      
      let messageContent: any[];
      if (isImage) {
        messageContent = [
          { 
            type: "text", 
            text: `Analyze this uploaded file named "${fileName || 'unnamed'}".
            
Based on any text, logos, names, addresses, or context visible in the image, suggest which client or job it might belong to.

Available Clients:
${clientList}

Available Jobs:
${jobList}

Return ONLY valid JSON with these fields:
{
  "suggestedClientId": "client_id_or_null",
  "suggestedJobId": "job_id_or_null",
  "suggestedCategory": "contract|invoice|receipt|photo|certificate|warranty|manual|other",
  "confidence": "high|medium|low",
  "reasoning": "Brief explanation of why you made this suggestion"
}

If you cannot determine a match, return nulls for IDs with low confidence.` 
          },
          { type: "image_url", image_url: { url: publicFileUrl } }
        ];
      } else {
        messageContent = [
          { 
            type: "text", 
            text: `Based on the filename "${fileName || 'unnamed'}" with type "${mimeType || 'unknown'}", suggest which client or job it might belong to.

Available Clients:
${clientList}

Available Jobs:
${jobList}

Return ONLY valid JSON with these fields:
{
  "suggestedClientId": "client_id_or_null",
  "suggestedJobId": "job_id_or_null", 
  "suggestedCategory": "contract|invoice|receipt|photo|certificate|warranty|manual|other",
  "confidence": "high|medium|low",
  "reasoning": "Brief explanation of why you made this suggestion"
}

If you cannot determine a match, return nulls for IDs with low confidence.`
          }
        ];
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a file classification assistant for a trade/field service business. Analyze files to determine which client or job they belong to."
          },
          {
            role: "user",
            content: messageContent
          }
        ],
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content || '{}';
      let suggestion;
      try {
        suggestion = JSON.parse(content.replace(/```json\n?|\n?```/g, '').trim());
      } catch {
        suggestion = { 
          suggestedClientId: null, 
          suggestedJobId: null, 
          suggestedCategory: "other",
          confidence: "low",
          reasoning: "Could not analyze file" 
        };
      }

      if (suggestion.suggestedClientId) {
        const client = clients.find(c => c.id === suggestion.suggestedClientId);
        suggestion.suggestedClientName = client?.name || null;
      }
      if (suggestion.suggestedJobId) {
        const job = jobs.find(j => j.id === suggestion.suggestedJobId);
        suggestion.suggestedJobNo = job?.jobNo || null;
      }

      res.json(suggestion);
    } catch (error) {
      console.error("File analysis error:", error);
      res.status(500).json({ error: "Failed to analyze file" });
    }
  });

  // ==================== OUTLOOK / EMAIL ROUTES ====================

  app.get("/api/outlook/test", requireRoles('admin'), async (req, res) => {
    try {
      const result = await outlook.testConnection();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/outlook/me", requireRoles('admin'), async (req, res) => {
    try {
      const user = await outlook.getCurrentUser();
      if (!user) {
        return res.status(404).json({ error: "Could not get current user" });
      }
      res.json(user);
    } catch (error: any) {
      console.error("Get current user error:", error);
      res.status(500).json({ error: error.message || "Failed to get current user" });
    }
  });

  app.post("/api/outlook/send", requireRoles('admin'), async (req, res) => {
    try {
      const { fromEmail, subject, body, toRecipients, ccRecipients, isHtml } = req.body;
      
      if (!fromEmail || !subject || !body || !toRecipients || !Array.isArray(toRecipients)) {
        return res.status(400).json({ error: "Missing required fields: fromEmail, subject, body, toRecipients" });
      }

      await outlook.sendEmail(fromEmail, {
        subject,
        body,
        toRecipients,
        ccRecipients,
        isHtml,
      });

      res.json({ success: true, message: "Email sent successfully" });
    } catch (error: any) {
      console.error("Send email error:", error);
      res.status(500).json({ error: error.message || "Failed to send email" });
    }
  });

  app.post("/api/outlook/send-email", requireRoles('admin'), async (req, res) => {
    try {
      const { to, subject, body, isHtml } = req.body;
      if (!to || !subject || !body) {
        return res.status(400).json({ error: "Missing required fields: to, subject, body" });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(to)) {
        return res.status(400).json({ error: "Invalid email address format" });
      }

      let currentUser;
      try {
        currentUser = await outlook.getCurrentUser();
      } catch (err: any) {
        console.error("Failed to get Outlook user:", err);
        return res.status(401).json({ 
          error: "Outlook not connected. Please reconnect your Outlook account.",
          code: "OUTLOOK_NOT_CONNECTED"
        });
      }

      if (!currentUser?.email) {
        return res.status(401).json({ 
          error: "Could not determine your Outlook email address. Please reconnect your Outlook account.",
          code: "OUTLOOK_NO_USER" 
        });
      }

      await outlook.sendEmail(currentUser.email, {
        subject,
        body,
        toRecipients: [to],
        isHtml: isHtml !== false,
      });

      res.json({ success: true, message: `Email sent successfully to ${to}` });
    } catch (error: any) {
      console.error("Send email error:", error);
      const statusCode = error?.statusCode;
      if (statusCode === 401 || statusCode === 403) {
        return res.status(401).json({ 
          error: "Outlook token expired or permissions insufficient. Please reconnect your Outlook account.",
          code: "OUTLOOK_AUTH_ERROR"
        });
      }
      if (statusCode === 429) {
        return res.status(429).json({ 
          error: "Too many emails sent. Please wait a moment and try again.",
          code: "RATE_LIMIT"
        });
      }
      res.status(500).json({ 
        error: error.message || "Failed to send email. Please check your Outlook connection.",
        code: "SEND_FAILED"
      });
    }
  });

  app.post("/api/ai/improve-email", requireRoles('admin'), async (req, res) => {
    try {
      const { content, style } = req.body;
      if (!content || !style) {
        return res.status(400).json({ error: "Missing required fields: content, style" });
      }

      const validStyles = ['improve', 'friendly', 'formal', 'grammar'];
      if (!validStyles.includes(style)) {
        return res.status(400).json({ error: `Invalid style. Must be one of: ${validStyles.join(', ')}` });
      }

      const OpenAI = (await import('openai')).default;
      const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
      const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
      if (!apiKey || !baseURL) {
        return res.status(503).json({ error: "AI integration not configured" });
      }

      const openai = new OpenAI({ apiKey, baseURL });

      const styleInstructions: Record<string, string> = {
        improve: "Improve the clarity, professionalism and readability of this email. Keep the same meaning and tone but make it more polished. Preserve any HTML formatting tags.",
        friendly: "Rewrite this email in a warmer, friendlier tone while keeping it professional. Make it feel more personal and approachable. Preserve any HTML formatting tags.",
        formal: "Rewrite this email in a formal business tone. Make it more corporate and professional. Preserve any HTML formatting tags.",
        grammar: "Fix any grammar, spelling, or punctuation errors in this email. Make minimal changes - only correct mistakes. Preserve any HTML formatting tags.",
      };

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: `You are a UK business email writing assistant. ${styleInstructions[style]} Return ONLY the improved email body text, no subject line, no explanations. Use UK English spelling (colour, organise, etc.).` },
          { role: "user", content: content }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const improved = response.choices[0]?.message?.content || content;
      res.json({ improved });
    } catch (error: any) {
      console.error("AI email improvement error:", error);
      res.status(500).json({ error: "Failed to improve email text. Please try again." });
    }
  });

  app.get("/api/outlook/emails/:userEmail", requireRoles('admin'), async (req, res) => {
    try {
      const { userEmail } = req.params;
      const top = parseInt(req.query.top as string) || 10;
      
      const emails = await outlook.getEmails(userEmail, top);
      res.json(emails);
    } catch (error: any) {
      console.error("Get emails error:", error);
      res.status(500).json({ error: error.message || "Failed to get emails" });
    }
  });

  app.get("/api/outlook/sent/:userEmail", requireRoles('admin'), async (req, res) => {
    try {
      const { userEmail } = req.params;
      const top = parseInt(req.query.top as string) || 10;
      
      const emails = await outlook.getSentEmails(userEmail, top);
      res.json(emails);
    } catch (error: any) {
      console.error("Get sent emails error:", error);
      res.status(500).json({ error: error.message || "Failed to get sent emails" });
    }
  });

  app.get("/api/outlook/calendar/:userEmail", requireRoles('admin'), async (req, res) => {
    try {
      const { userEmail } = req.params;
      const top = parseInt(req.query.top as string) || 10;
      
      const events = await outlook.getCalendarEvents(userEmail, top);
      res.json(events);
    } catch (error: any) {
      console.error("Get calendar events error:", error);
      res.status(500).json({ error: error.message || "Failed to get calendar events" });
    }
  });

  app.post("/api/outlook/calendar/:userEmail", requireRoles('admin'), async (req, res) => {
    try {
      const { userEmail } = req.params;
      const { subject, body, start, end, location, attendees } = req.body;
      
      if (!subject || !start || !end) {
        return res.status(400).json({ error: "Missing required fields: subject, start, end" });
      }

      const event = await outlook.createCalendarEvent(userEmail, {
        subject,
        body,
        start: new Date(start),
        end: new Date(end),
        location,
        attendees,
      });

      res.json(event);
    } catch (error: any) {
      console.error("Create calendar event error:", error);
      res.status(500).json({ error: error.message || "Failed to create calendar event" });
    }
  });

  app.get("/api/outlook/emails/:userEmail/:messageId", requireRoles('admin'), async (req, res) => {
    try {
      const { userEmail, messageId } = req.params;
      const email = await outlook.getEmailById(userEmail, messageId);
      res.json(email);
    } catch (error: any) {
      console.error("Get email by id error:", error);
      res.status(500).json({ error: error.message || "Failed to get email" });
    }
  });

  app.get("/api/outlook/emails/:userEmail/:messageId/attachments", requireRoles('admin'), async (req, res) => {
    try {
      const { userEmail, messageId } = req.params;
      const attachments = await outlook.getEmailAttachments(userEmail, messageId);
      res.json(attachments);
    } catch (error: any) {
      console.error("Get attachments error:", error);
      res.status(500).json({ error: error.message || "Failed to get attachments" });
    }
  });

  app.get("/api/outlook/emails/:userEmail/:messageId/attachments/:attachmentId", requireRoles('admin'), async (req, res) => {
    try {
      const { userEmail, messageId, attachmentId } = req.params;
      const attachment = await outlook.getAttachmentContent(userEmail, messageId, attachmentId);
      res.json(attachment);
    } catch (error: any) {
      console.error("Get attachment content error:", error);
      res.status(500).json({ error: error.message || "Failed to get attachment" });
    }
  });

  app.post("/api/outlook/emails/:userEmail/:messageId/reply", requireRoles('admin'), async (req, res) => {
    try {
      const { userEmail, messageId } = req.params;
      const { body, replyAll } = req.body;
      
      if (!body) {
        return res.status(400).json({ error: "Missing required field: body" });
      }

      await outlook.replyToEmail(userEmail, messageId, body, replyAll || false);
      res.json({ success: true, message: "Reply sent successfully" });
    } catch (error: any) {
      console.error("Reply to email error:", error);
      res.status(500).json({ error: error.message || "Failed to send reply" });
    }
  });

  app.get("/api/outlook/search/:userEmail", requireRoles('admin'), async (req, res) => {
    try {
      const { userEmail } = req.params;
      const query = req.query.q as string;
      const top = parseInt(req.query.top as string) || 20;
      
      if (!query) {
        return res.status(400).json({ error: "Missing required query parameter: q" });
      }

      const emails = await outlook.searchEmails(userEmail, query, top);
      res.json(emails);
    } catch (error: any) {
      console.error("Search emails error:", error);
      res.status(500).json({ error: error.message || "Failed to search emails" });
    }
  });

  app.patch("/api/outlook/emails/:userEmail/:messageId/read", requireRoles('admin'), async (req, res) => {
    try {
      const { userEmail, messageId } = req.params;
      const { isRead } = req.body;
      
      await outlook.markEmailAsRead(userEmail, messageId, isRead !== false);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Mark email as read error:", error);
      res.status(500).json({ error: error.message || "Failed to update email" });
    }
  });

  app.get("/api/outlook/users", requireRoles('admin'), async (req, res) => {
    try {
      const users = await outlook.getUsers();
      res.json(users);
    } catch (error: any) {
      console.error("Get outlook users error:", error);
      res.status(500).json({ error: error.message || "Failed to get users" });
    }
  });

  // AI Email Analysis - categorization, priority, sentiment, auto-linking
  app.post("/api/outlook/emails/:userEmail/:messageId/analyze", requireRoles('admin'), async (req, res) => {
    try {
      const { userEmail, messageId } = req.params;
      
      // Get the email content
      const email = await outlook.getEmailById(userEmail, messageId);
      if (!email) {
        return res.status(404).json({ error: "Email not found" });
      }

      // Get existing clients and jobs for matching
      const clients = await storage.getAllClients();
      const jobs = await storage.getAllJobs();

      const analysis = await outlook.analyzeEmailWithAI(
        email.body?.content || email.bodyPreview || '',
        email.from?.emailAddress?.address || '',
        email.from?.emailAddress?.name || '',
        email.subject || '',
        clients.map((c: any) => ({ id: c.id, name: c.name, email: c.email || undefined, phone: c.phone || undefined })),
        jobs.map((j: any) => ({ id: j.id, customerName: j.customerName, jobNo: j.jobNo, description: j.description || undefined }))
      );

      res.json(analysis);
    } catch (error: any) {
      console.error("Email analysis error:", error);
      res.status(500).json({ error: error.message || "Failed to analyze email" });
    }
  });

  // Generate smart reply for an email
  app.post("/api/outlook/emails/:userEmail/:messageId/smart-reply", requireRoles('admin'), async (req, res) => {
    try {
      const { userEmail, messageId } = req.params;
      const { replyType, customInstructions } = req.body;
      
      if (!replyType) {
        return res.status(400).json({ error: "replyType is required" });
      }

      // Get the email content
      const email = await outlook.getEmailById(userEmail, messageId);
      if (!email) {
        return res.status(404).json({ error: "Email not found" });
      }

      const reply = await outlook.generateSmartReply(
        email.body?.content || email.bodyPreview || '',
        email.from?.emailAddress?.name || email.from?.emailAddress?.address || 'Customer',
        email.subject || '',
        replyType,
        customInstructions
      );

      res.json({ reply });
    } catch (error: any) {
      console.error("Smart reply error:", error);
      res.status(500).json({ error: error.message || "Failed to generate reply" });
    }
  });

  // Save email attachment to a job
  app.post("/api/outlook/emails/:userEmail/:messageId/attachments/:attachmentId/save-to-job", requireRoles('admin'), async (req, res) => {
    try {
      const { userEmail, messageId, attachmentId } = req.params;
      const { jobId, photoType } = req.body;
      
      if (!jobId) {
        return res.status(400).json({ error: "jobId is required" });
      }

      // Get the attachment content
      const attachment = await outlook.getAttachmentContent(userEmail, messageId, attachmentId);
      
      if (!attachment.contentBytes) {
        return res.status(400).json({ error: "Attachment has no content" });
      }

      // Check if it's an image
      if (!attachment.contentType?.startsWith('image/')) {
        return res.status(400).json({ error: "Only image attachments can be saved to jobs" });
      }

      // Convert base64 to data URL
      const dataUrl = `data:${attachment.contentType};base64,${attachment.contentBytes}`;
      
      // Get the job and update its photos
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const photos = (job.photos as any[]) || [];
      photos.push({
        id: `email-${Date.now()}`,
        url: dataUrl,
        type: photoType || 'evidence',
        timestamp: new Date().toISOString(),
        source: 'email',
        filename: attachment.name,
      });

      await storage.updateJob(jobId, { photos });

      res.json({ success: true, message: "Attachment saved to job" });
    } catch (error: any) {
      console.error("Save attachment to job error:", error);
      res.status(500).json({ error: error.message || "Failed to save attachment" });
    }
  });

  // Auto-create client from email
  app.post("/api/outlook/emails/auto-create-client", requireRoles('admin'), async (req, res) => {
    try {
      const { name, email, phone, address, fromEmailId } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Client name is required" });
      }

      // Check if client already exists by email
      if (email) {
        const existingClients = await storage.getAllClients();
        const existing = existingClients.find((c: any) => c.email?.toLowerCase() === email.toLowerCase());
        if (existing) {
          return res.json({ client: existing, created: false, message: "Client already exists" });
        }
      }

      const client = await storage.createClient({
        name,
        email: email || null,
        phone: phone || null,
        address: address || null,
        postcode: null,
      });

      res.json({ client, created: true, message: "Client created successfully" });
    } catch (error: any) {
      console.error("Auto-create client error:", error);
      res.status(500).json({ error: error.message || "Failed to create client" });
    }
  });

  // ==================== AI EXTRACTION ROUTE ====================
  app.post("/api/ai/extract", requireRoles('admin'), async (req, res) => {
    try {
      const openai = getOpenAIClient();
      if (!openai) {
        return res.status(500).json({ error: "OpenAI not configured" });
      }

      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are an assistant that extracts structured information from text. Always respond with valid JSON only, no markdown formatting." },
          { role: "user", content: prompt }
        ],
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content || "{}";
      try {
        const parsed = JSON.parse(content);
        res.json({ result: parsed });
      } catch {
        res.json({ result: content });
      }
    } catch (error: any) {
      console.error("AI extraction error:", error);
      res.status(500).json({ error: error.message || "AI extraction failed" });
    }
  });

  // ==================== SNIPPET ROUTES ====================

  app.get("/api/snippets", requireAuth, async (req, res) => {
    try {
      const snippets = await storage.getSnippets(req.session.userId!);
      res.json(snippets);
    } catch (error: any) {
      console.error("Get snippets error:", error);
      res.status(500).json({ error: error.message || "Failed to get snippets" });
    }
  });

  app.post("/api/snippets", requireAuth, async (req, res) => {
    try {
      const { title, content, category, shortcut } = req.body;
      if (!title || !content) {
        return res.status(400).json({ error: "Title and content are required" });
      }
      const user = await storage.getUser(req.session.userId!);
      const isAdmin = user?.role === 'admin' || (user?.roles as string[] || []).includes('admin');
      const snippet = await storage.createSnippet({
        title,
        content,
        category: category || 'general',
        shortcut,
        isGlobal: isAdmin && req.body.isGlobal === true,
        createdById: req.session.userId,
      });
      res.json(snippet);
    } catch (error: any) {
      console.error("Create snippet error:", error);
      res.status(500).json({ error: error.message || "Failed to create snippet" });
    }
  });

  app.patch("/api/snippets/:id", requireAuth, async (req, res) => {
    try {
      const snippets = await storage.getSnippets(req.session.userId!);
      const existing = snippets.find(s => s.id === req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Snippet not found" });
      }
      const user = await storage.getUser(req.session.userId!);
      const isAdmin = user?.role === 'admin' || (user?.roles as string[] || []).includes('admin');
      if (existing.isGlobal && !isAdmin) {
        return res.status(403).json({ error: "Only admins can update global snippets" });
      }
      if (!existing.isGlobal && existing.createdById !== req.session.userId) {
        return res.status(403).json({ error: "Not authorized to update this snippet" });
      }
      const { title, content, category, shortcut } = req.body;
      const snippet = await storage.updateSnippet(req.params.id, {
        title,
        content,
        category,
        shortcut,
      });
      res.json(snippet);
    } catch (error: any) {
      console.error("Update snippet error:", error);
      res.status(500).json({ error: error.message || "Failed to update snippet" });
    }
  });

  app.delete("/api/snippets/:id", requireAuth, async (req, res) => {
    try {
      const snippets = await storage.getSnippets(req.session.userId!);
      const existing = snippets.find(s => s.id === req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Snippet not found" });
      }
      if (existing.createdById !== req.session.userId) {
        const user = await storage.getUser(req.session.userId!);
        const isAdmin = user?.role === 'admin' || (user?.roles as string[] || []).includes('admin');
        if (!isAdmin) {
          return res.status(403).json({ error: "Not authorized to delete this snippet" });
        }
      }
      await storage.deleteSnippet(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete snippet error:", error);
      res.status(500).json({ error: error.message || "Failed to delete snippet" });
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
      const { content, imageUrl } = req.body;

      if ((!content || typeof content !== 'string' || content.trim() === '') && !imageUrl) {
        return res.status(400).json({ error: "Message content or image is required" });
      }

      // Verify user is a member of this conversation (efficient check)
      const isMember = await storage.isConversationMember(conversationId, req.session.userId!);
      
      if (!isMember) {
        return res.status(403).json({ error: "Access denied" });
      }

      const message = await storage.createMessage({
        conversationId,
        senderId: req.session.userId!,
        content: content?.trim() || "",
        imageUrl: imageUrl || null,
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

  // ==================== DEMO MODE (PUBLIC) ====================
  
  // Public demo endpoint for Directors Suite - no authentication required
  app.get("/api/demo/directors/dashboard", async (req, res) => {
    try {
      // Return sample demonstration data
      const demoData = {
        summary: {
          totalRevenue: 487250,
          revenueGrowth: 12.5,
          totalProfit: 145320,
          profitMargin: 29.8,
          outstandingInvoices: 42680,
          overdueInvoices: 3,
          activeJobs: 24,
          completedJobsThisMonth: 47,
          totalClients: 156,
          newClientsThisMonth: 8,
          totalEngineers: 12,
          avgJobValue: 1850,
        },
        monthlyTrends: [
          { month: "Aug", revenue: 38500, expenses: 28200, profit: 10300 },
          { month: "Sep", revenue: 42100, expenses: 29800, profit: 12300 },
          { month: "Oct", revenue: 45200, expenses: 31500, profit: 13700 },
          { month: "Nov", revenue: 48900, expenses: 33200, profit: 15700 },
          { month: "Dec", revenue: 52400, expenses: 35100, profit: 17300 },
          { month: "Jan", revenue: 56800, expenses: 37600, profit: 19200 },
        ],
        jobMetrics: {
          completionRate: 94.2,
          avgCompletionTime: 2.4,
          jobsByStatus: [
            { status: "Signed Off", count: 47, color: "#22c55e" },
            { status: "In Progress", count: 18, color: "#3b82f6" },
            { status: "Ready", count: 6, color: "#f59e0b" },
            { status: "Draft", count: 4, color: "#6b7280" },
          ],
        },
        financialHealth: {
          cashFlow: 28450,
          receivables: 42680,
          payables: 18920,
          invoiceAgeing: [
            { range: "Current", amount: 28500, color: "#22c55e" },
            { range: "1-30 days", amount: 8200, color: "#f59e0b" },
            { range: "31-60 days", amount: 4100, color: "#f97316" },
            { range: "60+ days", amount: 1880, color: "#ef4444" },
          ],
        },
        topClients: [
          { id: "1", name: "BuildTech Solutions", revenue: 45600, jobCount: 24 },
          { id: "2", name: "Premier Properties Ltd", revenue: 38200, jobCount: 18 },
          { id: "3", name: "Westfield Developments", revenue: 32100, jobCount: 15 },
          { id: "4", name: "City Centre Estates", revenue: 28400, jobCount: 12 },
          { id: "5", name: "Northern Construction", revenue: 24800, jobCount: 11 },
        ],
        engineerPerformance: [
          { id: "1", name: "James Wilson", completedJobs: 52, revenue: 96400, rating: 4.9 },
          { id: "2", name: "Sarah Thompson", completedJobs: 48, revenue: 88200, rating: 4.8 },
          { id: "3", name: "Michael Brown", completedJobs: 45, revenue: 82500, rating: 4.7 },
          { id: "4", name: "Emma Davies", completedJobs: 42, revenue: 76800, rating: 4.8 },
          { id: "5", name: "David Taylor", completedJobs: 38, revenue: 69400, rating: 4.6 },
        ],
      };

      res.json(demoData);
    } catch (error: any) {
      console.error("Demo directors dashboard error:", error);
      res.status(500).json({ error: "Failed to fetch demo dashboard data" });
    }
  });

  // ==================== DIRECTORS SUITE ====================

  app.get("/api/directors/dashboard", requireDirectorsSuite, async (req, res) => {
    try {
      const now = new Date();
      const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      
      const allInvoices = await storage.getAllInvoices();
      const allJobs = await storage.getAllJobs();
      const allExpenses = await storage.getAllExpenses();
      const allEngineers = await storage.getAllEngineers();
      const allClients = await storage.getAllClients();
      const allQuotes = await storage.getAllQuotes();

      // Revenue calculations
      const paidInvoices = allInvoices.filter(inv => inv.status === 'Paid');
      const totalRevenue = paidInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
      
      const lastMonthRevenue = paidInvoices
        .filter(inv => {
          const paidDate = inv.paidAt ? new Date(inv.paidAt) : null;
          return paidDate && paidDate >= startOfLastMonth && paidDate < startOfCurrentMonth;
        })
        .reduce((sum, inv) => sum + (inv.total || 0), 0);
      
      const thisMonthRevenue = paidInvoices
        .filter(inv => {
          const paidDate = inv.paidAt ? new Date(inv.paidAt) : null;
          return paidDate && paidDate >= startOfCurrentMonth;
        })
        .reduce((sum, inv) => sum + (inv.total || 0), 0);
      
      const revenueGrowth = lastMonthRevenue > 0 
        ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
        : 0;

      // Expenses and profit
      const totalExpenses = allExpenses
        .filter(exp => exp.status === 'approved')
        .reduce((sum, exp) => sum + (exp.amount || 0), 0);
      const totalProfit = totalRevenue - totalExpenses;
      const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

      // Outstanding invoices
      const unpaidInvoices = allInvoices.filter(inv => inv.status !== 'Paid' && inv.status !== 'Draft');
      const outstandingInvoices = unpaidInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
      const overdueInvoices = unpaidInvoices.filter(inv => {
        if (!inv.dueDate) return false;
        return new Date(inv.dueDate) < now;
      }).length;

      // Jobs metrics
      const activeJobs = allJobs.filter(j => j.status !== 'Signed Off' && j.status !== 'Draft').length;
      const completedJobsThisMonth = allJobs.filter(j => {
        if (j.status !== 'Signed Off' || !j.signOffTimestamp) return false;
        return new Date(j.signOffTimestamp) >= startOfCurrentMonth;
      }).length;
      
      const completedJobs = allJobs.filter(j => j.status === 'Signed Off');
      const avgJobValue = completedJobs.length > 0 
        ? totalRevenue / completedJobs.length 
        : 0;

      // Clients
      const totalClients = allClients.length;
      const newClientsThisMonth = allClients.filter(c => {
        if (!c.createdAt) return false;
        return new Date(c.createdAt) >= startOfCurrentMonth;
      }).length;

      // Monthly trends (12 months)
      const monthlyTrends = [];
      for (let i = 11; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        const monthName = monthDate.toLocaleDateString('en-GB', { month: 'short' });
        
        const revenue = paidInvoices
          .filter(inv => {
            const paidDate = inv.paidAt ? new Date(inv.paidAt) : null;
            return paidDate && paidDate >= monthDate && paidDate <= monthEnd;
          })
          .reduce((sum, inv) => sum + (inv.total || 0), 0);
        
        const expenses = allExpenses
          .filter(exp => {
            const expDate = new Date(exp.date);
            return expDate >= monthDate && expDate <= monthEnd && exp.status === 'approved';
          })
          .reduce((sum, exp) => sum + (exp.amount || 0), 0);
        
        monthlyTrends.push({
          month: monthName,
          revenue,
          expenses,
          profit: revenue - expenses,
        });
      }

      // Job metrics
      const jobsByStatus = [
        { status: 'Draft', count: allJobs.filter(j => j.status === 'Draft').length, color: '#94a3b8' },
        { status: 'Ready', count: allJobs.filter(j => j.status === 'Ready').length, color: '#8b5cf6' },
        { status: 'In Progress', count: allJobs.filter(j => j.status === 'In Progress').length, color: '#3b82f6' },
        { status: 'Awaiting Sign-off', count: allJobs.filter(j => j.status === 'Awaiting Signatures').length, color: '#f59e0b' },
        { status: 'Completed', count: allJobs.filter(j => j.status === 'Signed Off').length, color: '#22c55e' },
      ];
      
      const totalJobsCount = allJobs.length;
      const completionRate = totalJobsCount > 0 
        ? Math.round((completedJobs.length / totalJobsCount) * 100) 
        : 0;

      // Financial health
      const receivables = outstandingInvoices;
      const payables = allExpenses
        .filter(exp => exp.status === 'pending')
        .reduce((sum, exp) => sum + (exp.amount || 0), 0);
      const cashFlow = totalRevenue - totalExpenses - payables;

      const invoiceAgeing = [
        { 
          range: '0-30 days', 
          amount: unpaidInvoices
            .filter(inv => {
              const daysPast = inv.invoiceDate ? Math.floor((now.getTime() - new Date(inv.invoiceDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
              return daysPast <= 30;
            })
            .reduce((sum, inv) => sum + (inv.total || 0), 0),
          color: '#22c55e'
        },
        { 
          range: '31-60 days', 
          amount: unpaidInvoices
            .filter(inv => {
              const daysPast = inv.invoiceDate ? Math.floor((now.getTime() - new Date(inv.invoiceDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
              return daysPast > 30 && daysPast <= 60;
            })
            .reduce((sum, inv) => sum + (inv.total || 0), 0),
          color: '#f59e0b'
        },
        { 
          range: '61-90 days', 
          amount: unpaidInvoices
            .filter(inv => {
              const daysPast = inv.invoiceDate ? Math.floor((now.getTime() - new Date(inv.invoiceDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
              return daysPast > 60 && daysPast <= 90;
            })
            .reduce((sum, inv) => sum + (inv.total || 0), 0),
          color: '#f97316'
        },
        { 
          range: '90+ days', 
          amount: unpaidInvoices
            .filter(inv => {
              const daysPast = inv.invoiceDate ? Math.floor((now.getTime() - new Date(inv.invoiceDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
              return daysPast > 90;
            })
            .reduce((sum, inv) => sum + (inv.total || 0), 0),
          color: '#ef4444'
        },
      ];

      // Top clients by revenue (from paid invoices)
      const clientRevenueMap = new Map<string, { name: string; revenue: number; jobCount: number }>();
      for (const invoice of paidInvoices) {
        if (invoice.customerId) {
          const client = allClients.find(c => c.id === invoice.customerId);
          const existing = clientRevenueMap.get(invoice.customerId) || { 
            name: client?.name || invoice.customerName || 'Unknown', 
            revenue: 0, 
            jobCount: 0 
          };
          existing.revenue += invoice.total || 0;
          clientRevenueMap.set(invoice.customerId, existing);
        }
      }
      for (const job of completedJobs) {
        const jobClientId = (job as any).client || (job as any).customerId;
        if (jobClientId && clientRevenueMap.has(jobClientId)) {
          const existing = clientRevenueMap.get(jobClientId)!;
          existing.jobCount++;
        }
      }
      const topClients = Array.from(clientRevenueMap.entries())
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Engineer performance
      const engineerPerformance = allEngineers
        .map(engineer => {
          const engineerJobs = completedJobs.filter(job => {
            if (job.assignedToId === engineer.id) return true;
            if (Array.isArray(job.assignedToIds) && job.assignedToIds.includes(engineer.id)) return true;
            return false;
          });
          
          // Calculate revenue from jobs (simplified - using avg job value)
          const revenue = engineerJobs.length * avgJobValue;
          
          return {
            id: engineer.id,
            name: engineer.name,
            completedJobs: engineerJobs.length,
            revenue,
            rating: Math.min(5, Math.max(1, Math.round(engineerJobs.length / 2))),
          };
        })
        .filter(e => e.completedJobs > 0)
        .sort((a, b) => b.completedJobs - a.completedJobs)
        .slice(0, 5);

      res.json({
        summary: {
          totalRevenue,
          revenueGrowth,
          totalProfit,
          profitMargin,
          outstandingInvoices,
          overdueInvoices,
          activeJobs,
          completedJobsThisMonth,
          totalClients,
          newClientsThisMonth,
          totalEngineers: allEngineers.length,
          avgJobValue,
        },
        monthlyTrends,
        jobMetrics: {
          completionRate,
          avgCompletionTime: 5, // Placeholder - would need job timestamps to calculate
          jobsByStatus,
        },
        financialHealth: {
          cashFlow,
          receivables,
          payables,
          invoiceAgeing,
        },
        topClients,
        engineerPerformance,
      });
    } catch (error) {
      console.error("Directors dashboard error:", error);
      res.status(500).json({ error: "Failed to fetch directors dashboard data" });
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

  // ==================== ACCOUNTS PORTAL ====================

  app.get("/api/accounts/receipts", requireRoles('admin', 'accounts'), async (req, res) => {
    try {
      const receipts = await storage.getAccountsReceipts();
      res.json(receipts);
    } catch (error) {
      console.error("Get receipts error:", error);
      res.status(500).json({ error: "Failed to fetch receipts" });
    }
  });

  app.post("/api/accounts/receipts", requireAuth, async (req, res) => {
    try {
      const receipt = await storage.createAccountsReceipt({
        ...req.body,
        uploadedById: req.session.userId!,
      });
      res.status(201).json(receipt);
    } catch (error) {
      console.error("Create receipt error:", error);
      res.status(500).json({ error: "Failed to create receipt" });
    }
  });

  app.post("/api/accounts/receipts/:id/ocr", requireRoles('admin', 'accounts'), async (req, res) => {
    try {
      const receipt = await storage.getAccountsReceipt(req.params.id);
      if (!receipt) {
        return res.status(404).json({ error: "Receipt not found" });
      }

      const openai = getOpenAIClient();
      if (!openai) {
        return res.status(503).json({ error: "AI service not available" });
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a receipt OCR specialist. Analyze the receipt image and extract:
- vendor: The business/shop name
- amount: The total amount paid (number only, no currency symbol)
- date: The date in YYYY-MM-DD format if visible
- category: One of: fuel, materials, parts, tools, equipment, meals, travel, other

Return ONLY valid JSON in this exact format:
{"vendor": "Shop Name", "amount": 45.99, "date": "2025-01-10", "category": "materials"}`
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Please analyze this receipt image and extract the details." },
              { type: "image_url", image_url: { url: receipt.imageUrl } }
            ]
          }
        ],
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content || '{}';
      let ocrData;
      try {
        ocrData = JSON.parse(content.replace(/```json\n?|\n?```/g, '').trim());
      } catch {
        ocrData = { error: "Could not parse OCR result" };
      }

      const updated = await storage.updateAccountsReceipt(req.params.id, {
        ocrVendor: ocrData.vendor || null,
        ocrAmount: ocrData.amount || null,
        ocrDate: ocrData.date ? new Date(ocrData.date) : null,
        ocrCategory: ocrData.category || null,
        ocrRawData: ocrData,
        isProcessed: true,
      });

      res.json(updated);
    } catch (error) {
      console.error("OCR receipt error:", error);
      res.status(500).json({ error: "Failed to process receipt OCR" });
    }
  });

  app.patch("/api/accounts/receipts/:id", requireRoles('admin', 'accounts'), async (req, res) => {
    try {
      const receipt = await storage.updateAccountsReceipt(req.params.id, req.body);
      if (!receipt) {
        return res.status(404).json({ error: "Receipt not found" });
      }
      res.json(receipt);
    } catch (error) {
      console.error("Update receipt error:", error);
      res.status(500).json({ error: "Failed to update receipt" });
    }
  });

  app.delete("/api/accounts/receipts/:id", requireRoles('admin', 'accounts'), async (req, res) => {
    try {
      await storage.deleteAccountsReceipt(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete receipt error:", error);
      res.status(500).json({ error: "Failed to delete receipt" });
    }
  });

  app.get("/api/accounts/invoices", requireRoles('admin', 'accounts'), async (req, res) => {
    try {
      const invoices = await storage.getInvoicesWithChaseInfo();
      res.json(invoices);
    } catch (error) {
      console.error("Get invoices with chase info error:", error);
      res.status(500).json({ error: "Failed to fetch invoices" });
    }
  });

  app.get("/api/accounts/invoices/overdue", requireRoles('admin', 'accounts'), async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 14;
      const overdueInvoices = await storage.getOverdueInvoices(days);
      res.json(overdueInvoices);
    } catch (error) {
      console.error("Get overdue invoices error:", error);
      res.status(500).json({ error: "Failed to fetch overdue invoices" });
    }
  });

  app.get("/api/accounts/invoices/:id/chase-logs", requireRoles('admin', 'accounts'), async (req, res) => {
    try {
      const logs = await storage.getInvoiceChaseLogs(req.params.id);
      res.json(logs);
    } catch (error) {
      console.error("Get chase logs error:", error);
      res.status(500).json({ error: "Failed to fetch chase logs" });
    }
  });

  app.post("/api/accounts/invoices/:id/generate-chase", requireRoles('admin', 'accounts'), async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      const chaseLogs = await storage.getInvoiceChaseLogs(req.params.id);
      const chaseNumber = chaseLogs.length + 1;
      const daysOverdue = invoice.dueDate 
        ? Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      const openai = getOpenAIClient();
      if (!openai) {
        const defaultMessage = `Dear ${invoice.customerName},

I hope this message finds you well. I wanted to follow up on Invoice ${invoice.invoiceNo} dated ${invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString('en-GB') : 'N/A'} for £${invoice.total?.toFixed(2)}.

According to our records, this invoice is now ${daysOverdue} days overdue. I would be grateful if you could arrange payment at your earliest convenience, or let me know if there are any issues I can help resolve.

Please feel free to contact me if you have any questions.

Kind regards`;
        return res.json({ message: defaultMessage, chaseNumber });
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a professional UK accounts assistant. Generate a polite but firm payment reminder for an overdue invoice. 
The tone should be:
- Chase 1: Very polite and understanding
- Chase 2: Firmer but still professional
- Chase 3+: More urgent, mentioning potential consequences

Keep the message concise, professional, and appropriate for UK business correspondence.
Include the invoice details and make it easy for the customer to pay.
Do not include subject lines or greetings like "Dear Sir/Madam" - start with "Dear [Customer Name]".`
          },
          {
            role: "user",
            content: `Generate chase message #${chaseNumber} for:
Customer: ${invoice.customerName}
Invoice No: ${invoice.invoiceNo}
Invoice Date: ${invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString('en-GB') : 'N/A'}
Amount Due: £${invoice.total?.toFixed(2)}
Days Overdue: ${daysOverdue}
${invoice.customerEmail ? `Email: ${invoice.customerEmail}` : ''}`
          }
        ],
        max_tokens: 500,
      });

      const message = response.choices[0]?.message?.content || '';
      res.json({ message, chaseNumber });
    } catch (error) {
      console.error("Generate chase message error:", error);
      res.status(500).json({ error: "Failed to generate chase message" });
    }
  });

  app.post("/api/accounts/invoices/:id/chase", requireRoles('admin', 'accounts'), async (req, res) => {
    try {
      const { message, method = 'email' } = req.body;
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      const chaseLogs = await storage.getInvoiceChaseLogs(req.params.id);
      
      const log = await storage.createInvoiceChaseLog({
        invoiceId: req.params.id,
        chaseNumber: chaseLogs.length + 1,
        method,
        message,
        sentAt: new Date(),
        sentById: req.session.userId,
      });

      res.status(201).json(log);
    } catch (error) {
      console.error("Create chase log error:", error);
      res.status(500).json({ error: "Failed to create chase log" });
    }
  });

  app.get("/api/accounts/fixed-costs", requireRoles('admin', 'accounts'), async (req, res) => {
    try {
      const costs = await storage.getFixedCosts();
      res.json(costs);
    } catch (error) {
      console.error("Get fixed costs error:", error);
      res.status(500).json({ error: "Failed to fetch fixed costs" });
    }
  });

  app.post("/api/accounts/fixed-costs", requireRoles('admin', 'accounts'), async (req, res) => {
    try {
      const cost = await storage.createFixedCost({
        ...req.body,
        createdById: req.session.userId,
      });
      res.status(201).json(cost);
    } catch (error) {
      console.error("Create fixed cost error:", error);
      res.status(500).json({ error: "Failed to create fixed cost" });
    }
  });

  app.patch("/api/accounts/fixed-costs/:id", requireRoles('admin', 'accounts'), async (req, res) => {
    try {
      const cost = await storage.updateFixedCost(req.params.id, req.body);
      if (!cost) {
        return res.status(404).json({ error: "Fixed cost not found" });
      }
      res.json(cost);
    } catch (error) {
      console.error("Update fixed cost error:", error);
      res.status(500).json({ error: "Failed to update fixed cost" });
    }
  });

  app.delete("/api/accounts/fixed-costs/:id", requireRoles('admin', 'accounts'), async (req, res) => {
    try {
      await storage.deleteFixedCost(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete fixed cost error:", error);
      res.status(500).json({ error: "Failed to delete fixed cost" });
    }
  });

  app.get("/api/accounts/financial-summary", requireRoles('admin', 'accounts'), async (req, res) => {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const summary = await storage.getFinancialSummary(startDate, endDate);
      res.json(summary);
    } catch (error) {
      console.error("Get financial summary error:", error);
      res.status(500).json({ error: "Failed to fetch financial summary" });
    }
  });

  // ==================== AI DATABASE ANALYST ====================

  app.get("/api/admin/database-stats", requireSuperAdmin, async (req, res) => {
    try {
      const stats = await pool.query(`
        SELECT 
          schemaname,
          relname as table_name,
          n_live_tup as row_count
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC
      `);

      const tableInfo = await pool.query(`
        SELECT 
          table_name,
          column_name,
          data_type,
          is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
      `);

      const schemaByTable: Record<string, any[]> = {};
      for (const col of tableInfo.rows) {
        if (!schemaByTable[col.table_name]) {
          schemaByTable[col.table_name] = [];
        }
        schemaByTable[col.table_name].push({
          column: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === 'YES'
        });
      }

      res.json({
        tables: stats.rows.map((t: any) => ({
          name: t.table_name,
          rowCount: parseInt(t.row_count) || 0,
          schema: schemaByTable[t.table_name] || []
        })),
        totalTables: stats.rows.length
      });
    } catch (error) {
      console.error("Database stats error:", error);
      res.status(500).json({ error: "Failed to fetch database stats" });
    }
  });

  app.post("/api/admin/database-analyze", requireSuperAdmin, async (req, res) => {
    try {
      const { question } = req.body;
      if (!question) {
        return res.status(400).json({ error: "Question is required" });
      }

      const openai = getOpenAIClient();
      if (!openai) {
        return res.status(503).json({ error: "AI service not available" });
      }

      const statsResult = await pool.query(`
        SELECT relname as table_name, n_live_tup as row_count
        FROM pg_stat_user_tables ORDER BY n_live_tup DESC
      `);

      const tableStats = statsResult.rows.map((t: any) => 
        `${t.table_name}: ${t.row_count} rows`
      ).join('\n');

      const sampleData: Record<string, any> = {};
      const keyTables = ['users', 'jobs', 'clients', 'quotes', 'invoices', 'timesheets', 'expenses', 'vehicles', 'defects'];
      
      for (const table of keyTables) {
        try {
          const result = await pool.query(`SELECT * FROM "${table}" LIMIT 3`);
          if (result.rows.length > 0) {
            sampleData[table] = result.rows;
          }
        } catch (e) {
          // Table might not exist, skip
        }
      }

      const systemPrompt = `You are a database analyst for TrueNorth Trade OS, a field service management application for UK trade businesses.

The application includes these core modules:
- Jobs: Work orders assigned to engineers
- Clients: Customer records
- Quotes: Price quotes for potential work
- Invoices: Bills sent to clients
- Timesheets: Employee time tracking
- Expenses: Employee expense claims
- Vehicles: Fleet management
- Defects: Vehicle defect reports
- Users: Staff accounts with roles (admin, engineer, surveyor, fleet_manager, works_manager)

Current Database Statistics:
${tableStats}

Sample Data (up to 3 records per table):
${JSON.stringify(sampleData, null, 2)}

When analyzing:
1. Look for data integrity issues (orphaned records, missing relationships)
2. Identify potential duplicates or inconsistencies
3. Suggest optimizations or data quality improvements
4. Explain findings in simple, non-technical language
5. If asked about specific issues, query patterns, or anomalies, provide actionable insights

Be concise and practical. Focus on real issues that affect the business.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question }
        ],
        max_tokens: 2000,
        temperature: 0.3
      });

      const answer = response.choices[0]?.message?.content || "No response generated";
      res.json({ answer, tableStats: statsResult.rows });
    } catch (error: any) {
      console.error("Database analyze error:", error);
      const errorMessage = error?.message?.includes('timeout') 
        ? "AI service timed out. Please try a simpler question."
        : error?.message?.includes('rate') 
        ? "AI service rate limited. Please wait a moment and try again."
        : "Failed to analyze database. The AI service may be temporarily unavailable.";
      res.status(500).json({ error: errorMessage });
    }
  });

  app.get("/api/admin/database-health", requireSuperAdmin, async (req, res) => {
    try {
      const issues: { type: string; severity: string; message: string; details?: any }[] = [];

      // Check for jobs without client name
      try {
        const jobsNoClient = await pool.query(`
          SELECT COUNT(*) as count FROM jobs WHERE client IS NULL OR client = ''
        `);
        const noClientCount = parseInt(jobsNoClient.rows[0]?.count) || 0;
        if (noClientCount > 0) {
          issues.push({
            type: 'missing_data',
            severity: 'warning',
            message: `${noClientCount} jobs have no client name assigned`,
          });
        }
      } catch (e) { /* table might not exist */ }

      // Check for duplicate client names
      try {
        const duplicateClients = await pool.query(`
          SELECT name, COUNT(*) as count 
          FROM clients 
          GROUP BY LOWER(name), name
          HAVING COUNT(*) > 1
        `);
        if (duplicateClients.rows.length > 0) {
          issues.push({
            type: 'duplicates',
            severity: 'info',
            message: `${duplicateClients.rows.length} client names appear multiple times`,
            details: duplicateClients.rows
          });
        }
      } catch (e) { /* table might not exist */ }

      // Check for invoices without payments
      try {
        const unpaidInvoices = await pool.query(`
          SELECT COUNT(*) as count 
          FROM invoices 
          WHERE status = 'sent' AND created_at < NOW() - INTERVAL '30 days'
        `);
        const unpaidCount = parseInt(unpaidInvoices.rows[0]?.count) || 0;
        if (unpaidCount > 0) {
          issues.push({
            type: 'business_alert',
            severity: 'warning',
            message: `${unpaidCount} invoices sent over 30 days ago are still unpaid`,
          });
        }
      } catch (e) { /* table might not exist */ }

      // Check for users without recent activity
      try {
        const inactiveUsers = await pool.query(`
          SELECT COUNT(*) as count 
          FROM users 
          WHERE status = 'active' 
          AND (last_login_at IS NULL OR last_login_at < NOW() - INTERVAL '90 days')
        `);
        const inactiveCount = parseInt(inactiveUsers.rows[0]?.count) || 0;
        if (inactiveCount > 0) {
          issues.push({
            type: 'user_activity',
            severity: 'info',
            message: `${inactiveCount} active users haven't logged in for 90+ days`,
          });
        }
      } catch (e) { /* table might not exist */ }

      // Check for jobs in draft status for too long
      try {
        const staleDrafts = await pool.query(`
          SELECT COUNT(*) as count 
          FROM jobs 
          WHERE status = 'Draft' AND created_at < NOW() - INTERVAL '7 days'
        `);
        const staleCount = parseInt(staleDrafts.rows[0]?.count) || 0;
        if (staleCount > 0) {
          issues.push({
            type: 'stale_data',
            severity: 'info',
            message: `${staleCount} jobs have been in draft status for over 7 days`,
          });
        }
      } catch (e) { /* table might not exist */ }

      res.json({ 
        healthy: issues.filter(i => i.severity === 'error').length === 0,
        issues,
        checkedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Database health check error:", error);
      res.status(500).json({ error: "Failed to check database health" });
    }
  });

  // ==================== INTEGRATIONS (XERO) ====================

  // Xero integration status
  app.get("/api/integrations/xero/status", requireAuth, async (req, res) => {
    try {
      // For now, return a mock status - would need Xero OAuth in production
      const config = {
        isConnected: false,
        syncInvoices: true,
        syncContacts: true,
        syncPayments: true,
        autoSync: false,
      };

      const syncStatuses = [
        { type: 'Invoices', lastSync: null, itemsSynced: 0, status: 'never' },
        { type: 'Contacts', lastSync: null, itemsSynced: 0, status: 'never' },
        { type: 'Payments', lastSync: null, itemsSynced: 0, status: 'never' },
      ];

      res.json({ config, syncStatuses });
    } catch (error) {
      console.error("Error fetching Xero status:", error);
      res.status(500).json({ error: "Failed to fetch Xero status" });
    }
  });

  // Update Xero config
  app.put("/api/integrations/xero/config", requireAdmin, async (req, res) => {
    try {
      const config = req.body;
      // In production, this would save to database
      res.json({ success: true, config });
    } catch (error) {
      console.error("Error saving Xero config:", error);
      res.status(500).json({ error: "Failed to save Xero config" });
    }
  });

  // Sync with Xero
  app.post("/api/integrations/xero/sync", requireAdmin, async (req, res) => {
    try {
      // In production, this would trigger actual Xero API sync
      res.json({ 
        success: true, 
        message: "Xero integration not yet configured. Please connect your Xero account first." 
      });
    } catch (error) {
      console.error("Error syncing with Xero:", error);
      res.status(500).json({ error: "Failed to sync with Xero" });
    }
  });

  // Disconnect Xero
  app.post("/api/integrations/xero/disconnect", requireAdmin, async (req, res) => {
    try {
      // In production, this would revoke OAuth tokens
      res.json({ success: true });
    } catch (error) {
      console.error("Error disconnecting Xero:", error);
      res.status(500).json({ error: "Failed to disconnect Xero" });
    }
  });

  // ==================== INTEGRATIONS (QUICKBOOKS) ====================

  app.get("/api/integrations/quickbooks/status", requireAuth, async (req, res) => {
    try {
      const { isQuickBooksConnected } = await import('./services/quickbooks');
      const connected = await isQuickBooksConnected();
      res.json({ connected });
    } catch (error) {
      console.error("Error checking QuickBooks status:", error);
      res.json({ connected: false });
    }
  });

  app.get("/api/integrations/quickbooks/connect", requireAdmin, async (req, res) => {
    try {
      const { getOAuthUri } = await import('./services/quickbooks');
      const uri = getOAuthUri();
      res.json({ uri });
    } catch (error) {
      console.error("Error generating QuickBooks OAuth URI:", error);
      res.status(500).json({ error: "Failed to generate QuickBooks connection link" });
    }
  });

  app.get("/api/integrations/quickbooks/callback", async (req, res) => {
    try {
      const { code, realmId, state } = req.query as { code: string; realmId: string; state: string };
      if (!code || !realmId) {
        return res.status(400).send("Missing code or realmId from QuickBooks");
      }
      const { exchangeCodeForTokens } = await import('./services/quickbooks');
      await exchangeCodeForTokens(code, realmId);
      res.redirect("/app/integrations?qb=connected");
    } catch (error) {
      console.error("Error in QuickBooks callback:", error);
      res.redirect("/app/integrations?qb=error");
    }
  });

  app.post("/api/integrations/quickbooks/disconnect", requireAdmin, async (req, res) => {
    try {
      const { disconnectQuickBooks } = await import('./services/quickbooks');
      await disconnectQuickBooks();
      res.json({ success: true });
    } catch (error) {
      console.error("Error disconnecting QuickBooks:", error);
      res.status(500).json({ error: "Failed to disconnect QuickBooks" });
    }
  });

  app.get("/api/integrations/quickbooks/company", requireAuth, async (req, res) => {
    try {
      const { getQuickBooksCompanyInfo } = await import('./services/quickbooks');
      const info = await getQuickBooksCompanyInfo();
      res.json(info);
    } catch (error: any) {
      console.error("Error fetching QuickBooks company info:", error);
      res.status(500).json({ error: error.message || "Failed to fetch company info" });
    }
  });

  app.post("/api/integrations/quickbooks/sync-invoice/:invoiceId", requireAdmin, async (req, res) => {
    try {
      const { syncInvoiceToQuickBooks } = await import('./services/quickbooks');
      const result = await syncInvoiceToQuickBooks(req.params.invoiceId);
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error("Error syncing invoice to QuickBooks:", error);
      res.status(500).json({ error: error.message || "Failed to sync invoice to QuickBooks" });
    }
  });

  app.post("/api/integrations/quickbooks/sync-payment/:invoiceId", requireAdmin, async (req, res) => {
    try {
      const { amount, paymentDate } = req.body;
      if (!amount) {
        return res.status(400).json({ error: "Payment amount is required" });
      }
      const { syncPaymentToQuickBooks } = await import('./services/quickbooks');
      const result = await syncPaymentToQuickBooks(
        req.params.invoiceId,
        amount,
        paymentDate ? new Date(paymentDate) : new Date()
      );
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error("Error syncing payment to QuickBooks:", error);
      res.status(500).json({ error: error.message || "Failed to sync payment to QuickBooks" });
    }
  });

  // ==================== SUBSCRIPTION BILLING ====================

  // Get all subscription plans
  app.get("/api/subscription/plans", async (req, res) => {
    try {
      const plans = await pool.query(`
        SELECT id, name, slug, description, monthly_price as "monthlyPrice", 
               yearly_price as "yearlyPrice", features, limits, display_order as "displayOrder"
        FROM subscription_plans
        WHERE is_active = true
        ORDER BY display_order ASC
      `);
      res.json(plans.rows);
    } catch (error) {
      console.error("Error fetching subscription plans:", error);
      res.status(500).json({ error: "Failed to fetch plans" });
    }
  });

  // Get current subscription
  app.get("/api/subscription/current", requireAuth, async (req, res) => {
    try {
      const subscription = await pool.query(`
        SELECT s.*, p.name as plan_name
        FROM subscriptions s
        LEFT JOIN subscription_plans p ON s.plan_id = p.id
        ORDER BY s.created_at DESC
        LIMIT 1
      `);

      if (subscription.rows.length === 0) {
        // Return default trial subscription
        const starterPlan = await pool.query(`SELECT id, name FROM subscription_plans WHERE slug = 'starter' LIMIT 1`);
        const now = new Date();
        const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days trial
        
        res.json({
          id: null,
          planId: starterPlan.rows[0]?.id || null,
          planName: starterPlan.rows[0]?.name || 'Starter',
          status: 'trial',
          billingCycle: 'monthly',
          trialEndDate: trialEnd.toISOString(),
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        });
      } else {
        const sub = subscription.rows[0];
        res.json({
          id: sub.id,
          planId: sub.plan_id,
          planName: sub.plan_name,
          status: sub.status,
          billingCycle: sub.billing_cycle,
          trialEndDate: sub.trial_end_date,
          currentPeriodEnd: sub.current_period_end,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        });
      }
    } catch (error) {
      console.error("Error fetching current subscription:", error);
      res.status(500).json({ error: "Failed to fetch subscription" });
    }
  });

  // Get usage stats
  app.get("/api/subscription/usage", requireAuth, async (req, res) => {
    try {
      // Get current counts
      const [usersResult, jobsResult, clientsResult] = await Promise.all([
        pool.query(`SELECT COUNT(*) as count FROM users WHERE status = 'active'`),
        pool.query(`SELECT COUNT(*) as count FROM jobs WHERE created_at >= date_trunc('month', CURRENT_DATE)`),
        pool.query(`SELECT COUNT(*) as count FROM clients`),
      ]);

      // Get current plan limits (default to starter limits)
      const limits = {
        maxUsers: 3,
        maxJobs: 100,
        maxClients: 50,
        maxStorageGb: 5,
      };

      res.json({
        users: { current: parseInt(usersResult.rows[0]?.count) || 0, limit: limits.maxUsers },
        jobs: { current: parseInt(jobsResult.rows[0]?.count) || 0, limit: limits.maxJobs },
        clients: { current: parseInt(clientsResult.rows[0]?.count) || 0, limit: limits.maxClients },
        storage: { current: 0.5, limit: limits.maxStorageGb },
      });
    } catch (error) {
      console.error("Error fetching usage stats:", error);
      res.status(500).json({ error: "Failed to fetch usage" });
    }
  });

  // Upgrade subscription
  app.post("/api/subscription/upgrade", requireAdmin, async (req, res) => {
    try {
      const { planId, billingCycle } = req.body;

      // Check if Stripe is configured
      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(400).json({ 
          error: "Stripe not configured. Add your Stripe API keys to enable billing." 
        });
      }

      // In production, this would create a Stripe checkout session
      res.json({ 
        success: true, 
        message: "Upgrade initiated. Please complete payment.",
        checkoutUrl: null, // Would be Stripe checkout URL
      });
    } catch (error) {
      console.error("Error upgrading subscription:", error);
      res.status(500).json({ error: "Failed to upgrade subscription" });
    }
  });

  // ==================== WORKFLOW AUTOMATION ====================

  // Get all workflow rules
  app.get("/api/workflows/rules", requireAuth, async (req, res) => {
    try {
      const rules = await pool.query(`
        SELECT id, name, description, trigger_type as "triggerType", 
               trigger_conditions as "triggerConditions", actions, 
               is_active as "isActive", priority, created_at as "createdAt"
        FROM workflow_rules
        ORDER BY priority DESC, created_at DESC
      `);
      res.json(rules.rows);
    } catch (error) {
      console.error("Error fetching workflow rules:", error);
      res.status(500).json({ error: "Failed to fetch workflow rules" });
    }
  });

  // Create workflow rule
  app.post("/api/workflows/rules", requireAdmin, async (req, res) => {
    try {
      const { name, description, triggerType, triggerConditions, actions, isActive, priority } = req.body;
      const userId = req.session?.userId;

      const result = await pool.query(`
        INSERT INTO workflow_rules (name, description, trigger_type, trigger_conditions, actions, is_active, priority, created_by_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, name, description, trigger_type as "triggerType", 
                  trigger_conditions as "triggerConditions", actions, 
                  is_active as "isActive", priority, created_at as "createdAt"
      `, [name, description, triggerType, JSON.stringify(triggerConditions), JSON.stringify(actions), isActive, priority || 0, userId]);

      res.json(result.rows[0]);
    } catch (error) {
      console.error("Error creating workflow rule:", error);
      res.status(500).json({ error: "Failed to create workflow rule" });
    }
  });

  // Update workflow rule
  app.put("/api/workflows/rules/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, triggerType, triggerConditions, actions, isActive, priority } = req.body;

      const result = await pool.query(`
        UPDATE workflow_rules
        SET name = $1, description = $2, trigger_type = $3, trigger_conditions = $4, 
            actions = $5, is_active = $6, priority = $7, updated_at = NOW()
        WHERE id = $8
        RETURNING id, name, description, trigger_type as "triggerType", 
                  trigger_conditions as "triggerConditions", actions, 
                  is_active as "isActive", priority, created_at as "createdAt"
      `, [name, description, triggerType, JSON.stringify(triggerConditions), JSON.stringify(actions), isActive, priority || 0, id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Rule not found" });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error("Error updating workflow rule:", error);
      res.status(500).json({ error: "Failed to update workflow rule" });
    }
  });

  // Delete workflow rule
  app.delete("/api/workflows/rules/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query(`DELETE FROM workflow_rules WHERE id = $1`, [id]);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting workflow rule:", error);
      res.status(500).json({ error: "Failed to delete workflow rule" });
    }
  });

  // Get workflow executions
  app.get("/api/workflows/executions", requireAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const executions = await pool.query(`
        SELECT e.id, e.rule_id as "ruleId", r.name as "ruleName", e.status, 
               e.executed_at as "executedAt", e.completed_at as "completedAt"
        FROM workflow_executions e
        LEFT JOIN workflow_rules r ON e.rule_id = r.id
        ORDER BY e.executed_at DESC
        LIMIT $1
      `, [limit]);
      res.json(executions.rows);
    } catch (error) {
      console.error("Error fetching workflow executions:", error);
      res.status(500).json({ error: "Failed to fetch executions" });
    }
  });

  // Test/evaluate a rule against a specific job
  app.post("/api/workflows/rules/:id/test", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { jobId } = req.body;

      if (!jobId) {
        return res.status(400).json({ error: "jobId is required" });
      }

      const { evaluateRuleAgainstJob } = await import("./workflow-runner");
      const result = await evaluateRuleAgainstJob(id, jobId);

      res.json(result);
    } catch (error: any) {
      console.error("Error testing workflow rule:", error);
      res.status(500).json({ error: error.message || "Failed to test rule" });
    }
  });

  // Get execution logs for a specific execution
  app.get("/api/workflows/executions/:id/logs", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const logs = await pool.query(`
        SELECT id, execution_id as "executionId", step_index as "stepIndex", 
               action_type as "actionType", input, output, status, 
               error_message as "errorMessage", duration_ms as "durationMs",
               created_at as "createdAt"
        FROM workflow_logs
        WHERE execution_id = $1
        ORDER BY step_index ASC
      `, [id]);
      res.json(logs.rows);
    } catch (error) {
      console.error("Error fetching execution logs:", error);
      res.status(500).json({ error: "Failed to fetch execution logs" });
    }
  });

  // Manually trigger a rule against a job (actually runs the actions)
  app.post("/api/workflows/rules/:id/trigger", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { jobId } = req.body;
      const userId = req.session?.userId;

      if (!jobId) {
        return res.status(400).json({ error: "jobId is required" });
      }

      const rule = await storage.getWorkflowRule(id);
      if (!rule) {
        return res.status(404).json({ error: "Rule not found" });
      }

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const { emitEvent } = await import("./events");
      const event = await emitEvent(rule.triggerType, {
        ...job,
        jobId: job.id,
        manualTrigger: true,
        triggeredBy: userId,
      }, {
        causedById: userId || undefined,
        aggregateType: "job",
        aggregateId: jobId,
      });

      res.json({ success: true, eventId: event.id, message: "Rule triggered and queued for processing" });
    } catch (error: any) {
      console.error("Error triggering workflow rule:", error);
      res.status(500).json({ error: error.message || "Failed to trigger rule" });
    }
  });

  // ==================== ADD-ONS (BOLT-ON FEATURES) ====================

  // Get all available add-ons
  app.get("/api/addons", async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT id, name, slug, description, monthly_price as "monthlyPrice", 
               icon, category, features, is_active as "isActive", display_order as "displayOrder"
        FROM add_ons
        WHERE is_active = true
        ORDER BY display_order ASC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching add-ons:", error);
      res.status(500).json({ error: "Failed to fetch add-ons" });
    }
  });

  // Get current subscription's active add-ons
  app.get("/api/addons/subscribed", requireAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT sa.id, a.name, a.slug, a.monthly_price as "monthlyPrice", 
               a.icon, sa.status, sa.start_date as "startDate"
        FROM subscription_add_ons sa
        JOIN add_ons a ON sa.add_on_id = a.id
        WHERE sa.status = 'active'
        ORDER BY sa.start_date DESC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching subscribed add-ons:", error);
      res.status(500).json({ error: "Failed to fetch subscribed add-ons" });
    }
  });

  // Subscribe to an add-on
  app.post("/api/addons/subscribe", requireAdmin, async (req, res) => {
    try {
      const { addOnId } = req.body;
      
      // Check if already subscribed
      const existing = await pool.query(
        `SELECT id FROM subscription_add_ons WHERE add_on_id = $1 AND status = 'active'`,
        [addOnId]
      );
      
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: "Already subscribed to this add-on" });
      }
      
      const result = await pool.query(`
        INSERT INTO subscription_add_ons (add_on_id, status, start_date)
        VALUES ($1, 'active', NOW())
        RETURNING id
      `, [addOnId]);
      
      res.json({ success: true, id: result.rows[0].id });
    } catch (error) {
      console.error("Error subscribing to add-on:", error);
      res.status(500).json({ error: "Failed to subscribe to add-on" });
    }
  });

  // Unsubscribe from an add-on
  app.post("/api/addons/unsubscribe", requireAdmin, async (req, res) => {
    try {
      const { addOnId } = req.body;
      
      await pool.query(`
        UPDATE subscription_add_ons 
        SET status = 'cancelled', end_date = NOW()
        WHERE add_on_id = $1 AND status = 'active'
      `, [addOnId]);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error unsubscribing from add-on:", error);
      res.status(500).json({ error: "Failed to unsubscribe from add-on" });
    }
  });

  // ==================== REFERRAL & MERCHANT SYSTEM ====================

  // Create or get referral code for current user
  app.post("/api/referrals/create", requireAuth, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const ownerType = (req.body?.ownerType ?? "customer") as "customer" | "merchant";
      const landingType = (req.body?.landingType ?? "customer") as "customer" | "merchant";
      if (!["customer", "merchant"].includes(ownerType) || !["customer", "merchant"].includes(landingType)) {
        return res.status(400).json({ error: "Invalid ownerType or landingType" });
      }
      const code = await ReferralService.createReferralCode(userId, ownerType, landingType);
      res.json(code);
    } catch (error) {
      console.error("Error creating referral code:", error);
      res.status(500).json({ error: "Failed to create referral code" });
    }
  });

  // Get current user's referral code
  app.get("/api/referrals/me", requireAuth, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const type = (req.query.type ?? "customer") as "customer" | "merchant";
      const code = await ReferralService.getUserReferralCode(userId, type);
      if (!code) return res.status(404).json({ error: "No referral code" });
      res.json(code);
    } catch (error) {
      console.error("Error fetching referral code:", error);
      res.status(500).json({ error: "Failed to fetch referral code" });
    }
  });

  // Get referral stats for dashboard
  app.get("/api/referrals/stats", requireAuth, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      let code = await ReferralService.getUserReferralCode(userId, "customer");
      if (!code) {
        code = await ReferralService.createReferralCode(userId, "customer", "customer");
      }

      const scanAgg = await pool.query(
        `SELECT COUNT(*) as count FROM referral_events WHERE referral_code_id = $1`,
        [code.id]
      );
      const convAgg = await pool.query(
        `SELECT COUNT(*) as total, SUM(CASE WHEN status = 'qualified' THEN 1 ELSE 0 END) as qualified FROM referral_conversions WHERE referral_code_id = $1`,
        [code.id]
      );

      const monthlyPrice = 60;
      const discount = await DiscountEngine.calculateUserDiscount(userId, monthlyPrice);

      res.json({
        code: code.code,
        totalScans: parseInt(scanAgg.rows[0]?.count || "0"),
        totalSignups: parseInt(convAgg.rows[0]?.total || "0"),
        qualifiedReferrals: parseInt(convAgg.rows[0]?.qualified || "0"),
        currentDiscount: discount.effectiveDiscount,
        monthlySavings: discount.monthlySavings,
        discount,
      });
    } catch (error) {
      console.error("Error fetching referral stats:", error);
      res.status(500).json({ error: "Failed to fetch referral stats" });
    }
  });

  // Public referral redirect (QR code landing)
  app.get("/r/:code", async (req, res) => {
    try {
      const { code } = req.params;
      const referralCode = await ReferralService.getReferralCodeByCode(code);
      if (!referralCode) return res.redirect("/register?error=invalid_referral");

      const ip = (req.headers["x-forwarded-for"] as string) || req.ip || "unknown";
      const ua = (req.headers["user-agent"] as string) || "unknown";
      const geoCountry = (req.headers["cf-ipcountry"] as string) || undefined;

      const fraud = await FraudDetection.checkSuspiciousActivity(referralCode.id, ip, ua);
      if (!fraud.suspicious) {
        await ReferralService.logReferralEvent(referralCode.id, ip, ua, geoCountry);
      }

      res.cookie("tn_referral", referralCode.code, {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });

      res.redirect(`/register?ref=${encodeURIComponent(referralCode.code)}`);
    } catch (error) {
      console.error("Error processing referral redirect:", error);
      res.redirect("/register");
    }
  });

  // Partner/merchant landing page redirect
  app.get("/partners/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const merchant = await pool.query(
        `SELECT * FROM merchants WHERE slug = $1 AND active = true LIMIT 1`,
        [slug]
      );
      if (merchant.rows.length === 0) return res.redirect("/register?error=invalid_merchant");

      const m = merchant.rows[0];
      const code = await ReferralService.getUserReferralCode(m.id, "merchant");
      if (!code) return res.redirect("/register?error=no_referral_code");

      const ip = (req.headers["x-forwarded-for"] as string) || req.ip || "unknown";
      const ua = (req.headers["user-agent"] as string) || "unknown";
      const geoCountry = (req.headers["cf-ipcountry"] as string) || undefined;

      const fraud = await FraudDetection.checkSuspiciousActivity(code.id, ip, ua);
      if (!fraud.suspicious) {
        await ReferralService.logReferralEvent(code.id, ip, ua, geoCountry);
      }

      res.cookie("tn_referral", code.code, {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });

      res.redirect(`/register?partner=${encodeURIComponent(slug)}`);
    } catch (error) {
      console.error("Error processing partner redirect:", error);
      res.redirect("/register");
    }
  });

  // Billing discount summary
  app.get("/api/billing/discount-summary", requireAuth, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const monthlyPrice = 60;
      const discount = await DiscountEngine.calculateUserDiscount(userId, monthlyPrice);

      res.json({
        monthlyPrice,
        discount,
        finalPrice: monthlyPrice - discount.monthlySavings,
      });
    } catch (error) {
      console.error("Error calculating discount:", error);
      res.status(500).json({ error: "Failed to calculate discount" });
    }
  });

  // ==================== MERCHANT PORTAL ====================

  // Merchant login (separate from user auth)
  app.post("/api/merchants/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: "Email and password required" });

      const result = await pool.query(
        `SELECT * FROM merchants WHERE email = $1 AND active = true LIMIT 1`,
        [email]
      );
      if (result.rows.length === 0) return res.status(401).json({ error: "Invalid credentials" });

      const merchant = result.rows[0];
      if (!merchant.password) return res.status(401).json({ error: "Account not set up" });

      const valid = await bcrypt.compare(password, merchant.password);
      if (!valid) return res.status(401).json({ error: "Invalid credentials" });

      (req.session as any).merchantId = merchant.id;
      res.json({ id: merchant.id, name: merchant.name, slug: merchant.slug, email: merchant.email, payout_method: merchant.payout_method, active: merchant.active, created_at: merchant.created_at });
    } catch (error) {
      console.error("Error during merchant login:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Merchant session check
  app.get("/api/merchants/me", async (req, res) => {
    try {
      const merchantId = (req.session as any)?.merchantId;
      if (!merchantId) return res.status(401).json({ error: "Not logged in" });

      const result = await pool.query(
        `SELECT id, name, slug, email, payout_method, active, created_at FROM merchants WHERE id = $1 AND active = true`,
        [merchantId]
      );
      if (result.rows.length === 0) {
        delete (req.session as any).merchantId;
        return res.status(401).json({ error: "Merchant account inactive or not found" });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Error fetching merchant:", error);
      res.status(500).json({ error: "Failed to fetch merchant" });
    }
  });

  // Merchant logout
  app.post("/api/merchants/logout", (req, res) => {
    delete (req.session as any).merchantId;
    res.json({ ok: true });
  });

  // Merchant stats
  app.get("/api/merchants/stats", async (req, res) => {
    try {
      const merchantId = (req.session as any)?.merchantId;
      if (!merchantId) return res.status(401).json({ error: "Not logged in" });

      const code = await ReferralService.getUserReferralCode(merchantId, "merchant");
      if (!code) return res.status(404).json({ error: "No merchant referral code" });

      const scansAgg = await pool.query(
        `SELECT COUNT(*) as count FROM referral_events WHERE referral_code_id = $1`,
        [code.id]
      );

      const conversionsAgg = await pool.query(
        `SELECT COUNT(*) as count FROM referral_conversions WHERE referral_code_id = $1 AND status = 'qualified'`,
        [code.id]
      );

      const earningsAgg = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) as total FROM merchant_earnings WHERE merchant_id = $1`,
        [merchantId]
      );

      const unpaidAgg = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) as total FROM merchant_earnings WHERE merchant_id = $1 AND paid = false`,
        [merchantId]
      );

      res.json({
        code: code.code,
        totalScans: parseInt(scansAgg.rows[0]?.count || "0"),
        activeCustomers: parseInt(conversionsAgg.rows[0]?.count || "0"),
        lifetimeEarnings: parseFloat(earningsAgg.rows[0]?.total || "0"),
        unpaidEarnings: parseFloat(unpaidAgg.rows[0]?.total || "0"),
      });
    } catch (error) {
      console.error("Error fetching merchant stats:", error);
      res.status(500).json({ error: "Failed to fetch merchant stats" });
    }
  });

  // Merchant request payout
  app.post("/api/merchants/request-payout", async (req, res) => {
    const merchantId = (req.session as any)?.merchantId;
    if (!merchantId) return res.status(401).json({ error: "Not logged in" });
    res.json({ ok: true, message: "Payout request submitted for admin review" });
  });

  // ==================== ADMIN MERCHANT MANAGEMENT ====================

  // List all merchants (super admin)
  app.get("/api/admin/merchants", requireAdmin, async (req, res) => {
    try {
      const user = await pool.query(`SELECT super_admin FROM users WHERE id = $1`, [req.session?.userId]);
      if (!user.rows[0]?.super_admin) return res.status(403).json({ error: "Super admin required" });

      const result = await pool.query(`SELECT id, name, slug, email, commission_rate, payout_method, active, created_at FROM merchants ORDER BY created_at DESC`);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching merchants:", error);
      res.status(500).json({ error: "Failed to fetch merchants" });
    }
  });

  // Create merchant (super admin)
  app.post("/api/admin/merchants", requireAdmin, async (req, res) => {
    try {
      const user = await pool.query(`SELECT super_admin FROM users WHERE id = $1`, [req.session?.userId]);
      if (!user.rows[0]?.super_admin) return res.status(403).json({ error: "Super admin required" });

      const { name, slug, email, password, payout_method, payoutMethod, commission_rate } = req.body;
      const payMethod = payout_method || payoutMethod || "bank";
      if (!name || !slug) return res.status(400).json({ error: "Name and slug required" });

      const rate = commission_rate !== undefined ? parseFloat(commission_rate) : 5;
      const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
      const result = await pool.query(
        `INSERT INTO merchants (name, slug, email, password, payout_method, commission_rate) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, slug, email, payout_method, commission_rate, active, created_at`,
        [name, slug.toLowerCase().replace(/[^a-z0-9-]/g, ""), email || null, hashedPassword, payMethod, rate]
      );

      const merchant = result.rows[0];
      await ReferralService.createReferralCode(merchant.id, "merchant", "customer");

      res.json(merchant);
    } catch (error: any) {
      if (error.code === "23505") return res.status(400).json({ error: "Slug already exists" });
      console.error("Error creating merchant:", error);
      res.status(500).json({ error: "Failed to create merchant" });
    }
  });

  // Update merchant (super admin)
  app.patch("/api/admin/merchants/:id", requireAdmin, async (req, res) => {
    try {
      const user = await pool.query(`SELECT super_admin FROM users WHERE id = $1`, [req.session?.userId]);
      if (!user.rows[0]?.super_admin) return res.status(403).json({ error: "Super admin required" });

      const { id } = req.params;
      const { name, slug, email, payout_method, payoutMethod, commission_rate, active, password } = req.body;

      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (name !== undefined) { updates.push(`name = $${idx++}`); values.push(name); }
      if (slug !== undefined) { updates.push(`slug = $${idx++}`); values.push(slug.toLowerCase().replace(/[^a-z0-9-]/g, "")); }
      if (email !== undefined) { updates.push(`email = $${idx++}`); values.push(email); }
      const payMethod = payout_method || payoutMethod;
      if (payMethod !== undefined) { updates.push(`payout_method = $${idx++}`); values.push(payMethod); }
      if (commission_rate !== undefined) { updates.push(`commission_rate = $${idx++}`); values.push(parseFloat(commission_rate)); }
      if (active !== undefined) { updates.push(`active = $${idx++}`); values.push(active); }
      if (password) { updates.push(`password = $${idx++}`); values.push(await bcrypt.hash(password, 10)); }

      if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });

      values.push(id);
      const result = await pool.query(
        `UPDATE merchants SET ${updates.join(", ")} WHERE id = $${idx} RETURNING id, name, slug, email, payout_method, commission_rate, active, created_at`,
        values
      );

      if (result.rows.length === 0) return res.status(404).json({ error: "Merchant not found" });
      res.json(result.rows[0]);
    } catch (error: any) {
      if (error.code === "23505") return res.status(400).json({ error: "Slug or email already exists" });
      console.error("Error updating merchant:", error);
      res.status(500).json({ error: "Failed to update merchant" });
    }
  });

  // Get merchant earnings (super admin)
  app.get("/api/admin/merchants/:id/earnings", requireAdmin, async (req, res) => {
    try {
      const user = await pool.query(`SELECT super_admin FROM users WHERE id = $1`, [req.session?.userId]);
      if (!user.rows[0]?.super_admin) return res.status(403).json({ error: "Super admin required" });

      const { id } = req.params;
      const result = await pool.query(
        `SELECT 
          COALESCE(SUM(amount), 0) as total,
          COALESCE(SUM(CASE WHEN paid = true THEN amount ELSE 0 END), 0) as paid,
          COALESCE(SUM(CASE WHEN paid = false OR paid IS NULL THEN amount ELSE 0 END), 0) as unpaid
        FROM merchant_earnings WHERE merchant_id = $1`,
        [id]
      );
      const row = result.rows[0] || { total: 0, paid: 0, unpaid: 0 };
      res.json({
        total: parseFloat(row.total),
        paid: parseFloat(row.paid),
        unpaid: parseFloat(row.unpaid),
      });
    } catch (error) {
      console.error("Error fetching merchant earnings:", error);
      res.status(500).json({ error: "Failed to fetch merchant earnings" });
    }
  });

  // ==================== REVIEW REWARDS ====================

  // Get user's review rewards
  app.get("/api/review-rewards", requireAuth, async (req, res) => {
    try {
      const userId = req.session?.userId;
      const result = await pool.query(
        `SELECT * FROM review_rewards WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching review rewards:", error);
      res.status(500).json({ error: "Failed to fetch review rewards" });
    }
  });

  // Admin: create review reward for a user
  app.post("/api/admin/review-rewards", requireAdmin, async (req, res) => {
    try {
      const user = await pool.query(`SELECT super_admin FROM users WHERE id = $1`, [req.session?.userId]);
      if (!user.rows[0]?.super_admin) return res.status(403).json({ error: "Super admin required" });

      const { userId, type, valueType, value } = req.body;
      if (!userId || !type || !valueType || value === undefined) {
        return res.status(400).json({ error: "userId, type, valueType, and value are required" });
      }

      const result = await pool.query(
        `INSERT INTO review_rewards (user_id, type, value_type, value, verified_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
        [userId, type, valueType, value]
      );
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Error creating review reward:", error);
      res.status(500).json({ error: "Failed to create review reward" });
    }
  });

  // ===== FORMS SYSTEM =====
  
  // Get all form templates
  app.get("/api/forms/templates", requireAdmin, async (req, res) => {
    try {
      const templates = await storage.getFormTemplates();
      // Include latest version for each template
      const templatesWithVersions = await Promise.all(
        templates.map(async (template) => {
          const latestVersion = await storage.getLatestPublishedVersion(template.id);
          return { ...template, latestVersion };
        })
      );
      res.json(templatesWithVersions);
    } catch (error) {
      console.error("Error fetching form templates:", error);
      res.status(500).json({ error: "Failed to fetch form templates" });
    }
  });

  // Get single form template
  app.get("/api/forms/templates/:id", requireAuth, async (req, res) => {
    try {
      const template = await storage.getFormTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error fetching form template:", error);
      res.status(500).json({ error: "Failed to fetch form template" });
    }
  });

  // Create form template
  app.post("/api/forms/templates", requireAdmin, async (req, res) => {
    try {
      const { name, type } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Template name is required" });
      }
      
      const template = await storage.createFormTemplate({
        name,
        type: type || 'job_sheet',
        status: 'draft',
        createdBy: req.session.userId || null,
      });
      
      // Create initial version with empty schema
      await storage.createFormTemplateVersion({
        templateId: template.id,
        version: 1,
        schema: { name, style: 'clean', fields: [] },
      });
      
      res.status(201).json(template);
    } catch (error) {
      console.error("Error creating form template:", error);
      res.status(500).json({ error: "Failed to create form template" });
    }
  });

  // Update form template
  app.patch("/api/forms/templates/:id", requireAdmin, async (req, res) => {
    try {
      const { name, type, status } = req.body;
      const template = await storage.updateFormTemplate(req.params.id, {
        ...(name && { name }),
        ...(type && { type }),
        ...(status && { status }),
      });
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error updating form template:", error);
      res.status(500).json({ error: "Failed to update form template" });
    }
  });

  // Delete form template
  app.delete("/api/forms/templates/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteFormTemplate(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting form template:", error);
      res.status(500).json({ error: "Failed to delete form template" });
    }
  });

  // Duplicate form template
  app.post("/api/forms/templates/:id/duplicate", requireAdmin, async (req, res) => {
    try {
      const original = await storage.getFormTemplate(req.params.id);
      if (!original) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      // Get the latest version schema
      const versions = await storage.getFormTemplateVersions(req.params.id);
      const latestVersion = versions[0];
      
      // Create duplicate
      const duplicate = await storage.createFormTemplate({
        name: `${original.name} (Copy)`,
        type: original.type,
        status: 'draft',
        createdBy: req.session.userId || null,
      });
      
      // Copy the schema from original
      if (latestVersion) {
        await storage.createFormTemplateVersion({
          templateId: duplicate.id,
          version: 1,
          schema: latestVersion.schema as Record<string, unknown>,
        });
      }
      
      res.status(201).json(duplicate);
    } catch (error) {
      console.error("Error duplicating form template:", error);
      res.status(500).json({ error: "Failed to duplicate form template" });
    }
  });

  // Get template versions
  app.get("/api/forms/templates/:id/versions", requireAuth, async (req, res) => {
    try {
      const versions = await storage.getFormTemplateVersions(req.params.id);
      res.json(versions);
    } catch (error) {
      console.error("Error fetching template versions:", error);
      res.status(500).json({ error: "Failed to fetch template versions" });
    }
  });

  // Get single version schema
  app.get("/api/forms/versions/:versionId/schema", requireAuth, async (req, res) => {
    try {
      const version = await storage.getFormTemplateVersion(req.params.versionId);
      if (!version) {
        return res.status(404).json({ error: "Version not found" });
      }
      res.json(version.schema);
    } catch (error) {
      console.error("Error fetching version schema:", error);
      res.status(500).json({ error: "Failed to fetch version schema" });
    }
  });

  // Update template schema (creates new draft version)
  app.put("/api/forms/templates/:id/schema", requireAdmin, async (req, res) => {
    try {
      const { schema } = req.body;
      const versions = await storage.getFormTemplateVersions(req.params.id);
      const latestVersion = versions[0];
      
      if (latestVersion && !latestVersion.publishedAt) {
        // Update existing draft version
        const result = await pool.query(
          `UPDATE form_template_versions SET schema = $1 WHERE id = $2 RETURNING *`,
          [JSON.stringify(schema), latestVersion.id]
        );
        res.json(result.rows[0]);
      } else {
        // Create new draft version
        const newVersion = latestVersion ? latestVersion.version + 1 : 1;
        const version = await storage.createFormTemplateVersion({
          templateId: req.params.id,
          version: newVersion,
          schema,
        });
        res.json(version);
      }
    } catch (error) {
      console.error("Error updating template schema:", error);
      res.status(500).json({ error: "Failed to update template schema" });
    }
  });

  // Publish template version
  app.post("/api/forms/templates/:id/publish", requireAdmin, async (req, res) => {
    try {
      const versions = await storage.getFormTemplateVersions(req.params.id);
      const latestVersion = versions[0];
      
      if (!latestVersion) {
        return res.status(400).json({ error: "No version to publish" });
      }
      
      if (latestVersion.publishedAt) {
        return res.status(400).json({ error: "Latest version is already published" });
      }
      
      const published = await storage.publishFormTemplateVersion(latestVersion.id);
      
      // Update template status to published
      await storage.updateFormTemplate(req.params.id, { status: 'published' });
      
      res.json(published);
    } catch (error) {
      console.error("Error publishing template:", error);
      res.status(500).json({ error: "Failed to publish template" });
    }
  });

  // Get form submissions
  app.get("/api/forms/submissions", requireAuth, async (req, res) => {
    try {
      const { entityType, entityId, templateVersionId } = req.query;
      const submissions = await storage.getFormSubmissions({
        entityType: entityType as string,
        entityId: entityId as string,
        templateVersionId: templateVersionId as string,
      });
      res.json(submissions);
    } catch (error) {
      console.error("Error fetching form submissions:", error);
      res.status(500).json({ error: "Failed to fetch form submissions" });
    }
  });

  // Get single submission
  app.get("/api/forms/submissions/:id", requireAuth, async (req, res) => {
    try {
      const submission = await storage.getFormSubmission(req.params.id);
      if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
      }
      res.json(submission);
    } catch (error) {
      console.error("Error fetching form submission:", error);
      res.status(500).json({ error: "Failed to fetch form submission" });
    }
  });

  // Create form submission
  app.post("/api/forms/submissions", requireAuth, async (req, res) => {
    try {
      const { templateVersionId, entityType, entityId, data } = req.body;
      
      if (!templateVersionId || !entityType || !entityId) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      const submission = await storage.createFormSubmission({
        templateVersionId,
        entityType,
        entityId,
        submittedBy: req.session.userId || null,
        status: 'draft',
        data: data || {},
      });
      
      res.status(201).json(submission);
    } catch (error) {
      console.error("Error creating form submission:", error);
      res.status(500).json({ error: "Failed to create form submission" });
    }
  });

  // Update form submission (save draft)
  app.patch("/api/forms/submissions/:id", requireAuth, async (req, res) => {
    try {
      const { data } = req.body;
      const submission = await storage.updateFormSubmission(req.params.id, { data });
      if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
      }
      res.json(submission);
    } catch (error) {
      console.error("Error updating form submission:", error);
      res.status(500).json({ error: "Failed to update form submission" });
    }
  });

  // Submit form (finalize with PDF generation and event emission)
  app.post("/api/forms/submissions/:id/submit", requireAuth, async (req, res) => {
    try {
      const submission = await storage.submitFormSubmission(req.params.id);
      if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
      }

      // Get version and template info for PDF generation
      const version = await storage.getFormTemplateVersion(submission.templateVersionId);
      if (version) {
        const template = await storage.getFormTemplate(version.templateId);
        const templateName = template?.name || "Form";
        
        // Get submitter info
        const submitter = submission.submittedBy ? await storage.getUser(submission.submittedBy) : null;
        
        // Get entity info
        let entityInfo: { type: string; name?: string } | undefined;
        if (submission.entityType === "job" && submission.entityId) {
          const job = await storage.getJob(submission.entityId);
          entityInfo = { type: "Job", name: job?.jobNo ?? undefined };
        } else if (submission.entityType === "client" && submission.entityId) {
          const client = await storage.getClient(submission.entityId);
          entityInfo = { type: "Client", name: client?.name || client?.contactName };
        } else if (submission.entityType === "quote" && submission.entityId) {
          entityInfo = { type: "Quote", name: `#${submission.entityId}` };
        }
        
        try {
          // Generate PDF
          const pdfBuffer = await generateFormPdf({
            templateName,
            version,
            submission,
            submittedBy: submitter ? submitter.name : undefined,
            entityInfo,
          });
          
          // Store PDF in object storage
          const objectStorageService = new ObjectStorageService();
          const sanitizedName = templateName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
          const fileName = `${sanitizedName}_${submission.id}.pdf`;
          
          const { objectPath } = await objectStorageService.writeBuffer({
            buffer: pdfBuffer,
            fileName,
            contentType: "application/pdf",
            subPath: "forms",
          });
          
          // Create file record if entity is a job
          if (submission.entityType === "job" && submission.entityId) {
            await storage.createFile({
              name: fileName,
              objectPath,
              mimeType: "application/pdf",
              jobId: submission.entityId,
              uploadedById: submission.submittedBy || undefined,
            });
          }
          
          console.log(`[Forms] PDF generated for submission ${submission.id}: ${objectPath}`);
        } catch (pdfError) {
          console.error("Error generating PDF (non-blocking):", pdfError);
          // PDF generation failure is non-blocking
        }
      }
      
      // Emit domain event for workflow processing
      try {
        await emitEvent("form.submitted", {
          submissionId: submission.id,
          templateVersionId: submission.templateVersionId,
          entityType: submission.entityType,
          entityId: submission.entityId,
          submittedBy: submission.submittedBy,
          data: submission.data,
        }, {
          aggregateType: "form_submission",
          aggregateId: submission.id,
          causedById: submission.submittedBy || undefined,
        });
      } catch (eventError) {
        console.error("Error emitting form.submitted event (non-blocking):", eventError);
      }
      
      res.json(submission);
    } catch (error) {
      console.error("Error submitting form:", error);
      res.status(500).json({ error: "Failed to submit form" });
    }
  });

  // Get submission assets
  app.get("/api/forms/submissions/:id/assets", requireAuth, async (req, res) => {
    try {
      const assets = await storage.getFormAssets(req.params.id);
      res.json(assets);
    } catch (error) {
      console.error("Error fetching form assets:", error);
      res.status(500).json({ error: "Failed to fetch form assets" });
    }
  });

  // Upload form asset
  app.post("/api/forms/assets/upload", requireAuth, async (req, res) => {
    try {
      const { submissionId, fieldKey, assetType, filePath } = req.body;
      
      if (!submissionId || !fieldKey || !assetType || !filePath) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      const asset = await storage.createFormAsset({
        submissionId,
        fieldKey,
        assetType,
        filePath,
      });
      
      res.status(201).json(asset);
    } catch (error) {
      console.error("Error uploading form asset:", error);
      res.status(500).json({ error: "Failed to upload form asset" });
    }
  });

  // Delete form asset
  app.delete("/api/forms/assets/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteFormAsset(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting form asset:", error);
      res.status(500).json({ error: "Failed to delete form asset" });
    }
  });

  // Seed default form templates
  app.post("/api/forms/seed-templates", requireAuth, async (req, res) => {
    try {
      const existingTemplates = await storage.getFormTemplates();
      if (existingTemplates.length > 0) {
        return res.json({ message: "Templates already exist", count: existingTemplates.length });
      }

      const defaultTemplates = [
        {
          name: "Job Sheet",
          type: "job_sheet" as const,
          schema: {
            name: "Job Sheet",
            style: "clean",
            fields: [
              { type: "text" as const, key: "job_ref", label: "Job Reference", required: true, prefill: "job.ref" },
              { type: "text" as const, key: "customer_name", label: "Customer Name", required: true, prefill: "client.name" },
              { type: "text" as const, key: "address", label: "Site Address", required: true, prefill: "job.address" },
              { type: "date" as const, key: "date", label: "Date", required: true },
              { type: "textarea" as const, key: "work_description", label: "Work Description", required: true },
              { type: "textarea" as const, key: "materials_used", label: "Materials Used", required: false },
              { type: "number" as const, key: "time_spent", label: "Time Spent (hours)", required: true },
              { type: "textarea" as const, key: "notes", label: "Additional Notes", required: false },
              { type: "photo" as const, key: "photos", label: "Site Photos", required: false, multiple: true },
            ]
          }
        },
        {
          name: "Client Creation Form",
          type: "client_form" as const,
          schema: {
            name: "Client Creation Form",
            style: "clean",
            fields: [
              { type: "text" as const, key: "company_name", label: "Company/Client Name", required: true },
              { type: "text" as const, key: "contact_name", label: "Primary Contact Name", required: true },
              { type: "text" as const, key: "email", label: "Email Address", required: true },
              { type: "text" as const, key: "phone", label: "Phone Number", required: true },
              { type: "textarea" as const, key: "address", label: "Address", required: true },
              { type: "text" as const, key: "postcode", label: "Postcode", required: true },
              { type: "select" as const, key: "client_type", label: "Client Type", required: true, options: [
                { label: "Domestic", value: "domestic" },
                { label: "Commercial", value: "commercial" },
                { label: "Industrial", value: "industrial" }
              ]},
              { type: "textarea" as const, key: "notes", label: "Notes", required: false },
            ]
          }
        },
        {
          name: "Quote Sheet",
          type: "quote_sheet" as const,
          schema: {
            name: "Quote Sheet",
            style: "clean",
            fields: [
              { type: "text" as const, key: "quote_ref", label: "Quote Reference", required: true, prefill: "quote.number" },
              { type: "text" as const, key: "client_name", label: "Client Name", required: true, prefill: "client.name" },
              { type: "date" as const, key: "date", label: "Quote Date", required: true },
              { type: "date" as const, key: "valid_until", label: "Valid Until", required: true },
              { type: "textarea" as const, key: "scope_of_work", label: "Scope of Work", required: true },
              { type: "number" as const, key: "labour_cost", label: "Labour Cost (£)", required: true },
              { type: "number" as const, key: "materials_cost", label: "Materials Cost (£)", required: true },
              { type: "number" as const, key: "total", label: "Total (£)", required: true },
              { type: "textarea" as const, key: "terms", label: "Terms & Conditions", required: false },
            ]
          }
        },
        {
          name: "Job Sign-off Form",
          type: "signoff" as const,
          schema: {
            name: "Job Sign-off Form",
            style: "clean",
            fields: [
              { type: "text" as const, key: "job_ref", label: "Job Reference", required: true, prefill: "job.ref" },
              { type: "text" as const, key: "customer_name", label: "Customer Name", required: true, prefill: "client.name" },
              { type: "date" as const, key: "completion_date", label: "Completion Date", required: true },
              { type: "yesno" as const, key: "work_completed", label: "All work completed satisfactorily?", required: true },
              { type: "yesno" as const, key: "site_clean", label: "Site left clean and tidy?", required: true },
              { type: "textarea" as const, key: "customer_comments", label: "Customer Comments", required: false },
              { type: "photo" as const, key: "completion_photos", label: "Completion Photos", required: true, multiple: true },
              { type: "signature" as const, key: "engineer_signature", label: "Engineer Signature", required: true },
              { type: "signature" as const, key: "customer_signature", label: "Customer Signature", required: true },
            ]
          }
        }
      ];

      const createdTemplates = [];
      for (const template of defaultTemplates) {
        const created = await storage.createFormTemplate({
          name: template.name,
          type: template.type,
          status: 'published',
          createdBy: req.session.userId || null,
        });
        
        await storage.createFormTemplateVersion({
          templateId: created.id,
          version: 1,
          schema: template.schema,
          publishedAt: new Date(),
        });
        
        createdTemplates.push(created);
      }

      res.status(201).json({ message: "Templates seeded", templates: createdTemplates });
    } catch (error) {
      console.error("Error seeding form templates:", error);
      res.status(500).json({ error: "Failed to seed form templates" });
    }
  });

  // Get published templates for filling (available to all authenticated users)
  app.get("/api/forms/published-templates", requireAuth, async (req, res) => {
    try {
      const templates = await storage.getFormTemplates();
      const publishedTemplates = templates.filter(t => t.status === 'published');
      
      // Get latest published version for each template
      const templatesWithVersions = await Promise.all(
        publishedTemplates.map(async (template) => {
          const version = await storage.getLatestPublishedVersion(template.id);
          return { ...template, latestVersion: version };
        })
      );
      
      res.json(templatesWithVersions.filter(t => t.latestVersion));
    } catch (error) {
      console.error("Error fetching published templates:", error);
      res.status(500).json({ error: "Failed to fetch published templates" });
    }
  });

  // ==================== WEBHOOK MANAGEMENT ROUTES ====================

  // List all webhook subscriptions (admin only)
  app.get("/api/webhooks", requireAdmin, async (req, res) => {
    try {
      const subscriptions = await storage.getWebhookSubscriptions();
      res.json(subscriptions);
    } catch (error) {
      console.error("Error fetching webhook subscriptions:", error);
      res.status(500).json({ error: "Failed to fetch webhook subscriptions" });
    }
  });

  // Create webhook subscription (admin only)
  app.post("/api/webhooks", requireAdmin, async (req, res) => {
    try {
      const { name, url, eventTypes, headers, retryPolicy } = req.body;
      
      if (!name || !url || !eventTypes) {
        return res.status(400).json({ error: "name, url, and eventTypes are required" });
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
        createdById: req.session.userId || null,
      });

      res.status(201).json(subscription);
    } catch (error) {
      console.error("Error creating webhook subscription:", error);
      res.status(500).json({ error: "Failed to create webhook subscription" });
    }
  });

  // Get webhook subscription details
  app.get("/api/webhooks/:id", requireAuth, async (req, res) => {
    try {
      const subscription = await storage.getWebhookSubscription(req.params.id);
      if (!subscription) {
        return res.status(404).json({ error: "Webhook subscription not found" });
      }
      res.json(subscription);
    } catch (error) {
      console.error("Error fetching webhook subscription:", error);
      res.status(500).json({ error: "Failed to fetch webhook subscription" });
    }
  });

  // Update webhook subscription
  app.patch("/api/webhooks/:id", requireAdmin, async (req, res) => {
    try {
      const { name, url, eventTypes, headers, retryPolicy, isActive } = req.body;
      
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (url !== undefined) updates.url = url;
      if (eventTypes !== undefined) updates.eventTypes = eventTypes;
      if (headers !== undefined) updates.headers = headers;
      if (retryPolicy !== undefined) updates.retryPolicy = retryPolicy;
      if (isActive !== undefined) updates.isActive = isActive;

      const subscription = await storage.updateWebhookSubscription(req.params.id, updates);
      if (!subscription) {
        return res.status(404).json({ error: "Webhook subscription not found" });
      }
      res.json(subscription);
    } catch (error) {
      console.error("Error updating webhook subscription:", error);
      res.status(500).json({ error: "Failed to update webhook subscription" });
    }
  });

  // Delete webhook subscription
  app.delete("/api/webhooks/:id", requireAdmin, async (req, res) => {
    try {
      const subscription = await storage.getWebhookSubscription(req.params.id);
      if (!subscription) {
        return res.status(404).json({ error: "Webhook subscription not found" });
      }
      await storage.deleteWebhookSubscription(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting webhook subscription:", error);
      res.status(500).json({ error: "Failed to delete webhook subscription" });
    }
  });

  // Get delivery logs for a subscription
  app.get("/api/webhooks/:id/deliveries", requireAuth, async (req, res) => {
    try {
      const subscription = await storage.getWebhookSubscription(req.params.id);
      if (!subscription) {
        return res.status(404).json({ error: "Webhook subscription not found" });
      }
      const deliveries = await storage.getWebhookDeliveries(req.params.id);
      res.json(deliveries);
    } catch (error) {
      console.error("Error fetching webhook deliveries:", error);
      res.status(500).json({ error: "Failed to fetch webhook deliveries" });
    }
  });

  // Send test webhook delivery
  app.post("/api/webhooks/:id/test", requireAdmin, async (req, res) => {
    try {
      const { sendTestWebhook } = await import("./webhook-service");
      const delivery = await sendTestWebhook(req.params.id);
      res.json(delivery);
    } catch (error: any) {
      console.error("Error sending test webhook:", error);
      res.status(500).json({ error: error.message || "Failed to send test webhook" });
    }
  });

  // ==================== ASSETS ====================
  
  // List all assets with optional filters
  app.get("/api/assets", requireAuth, async (req, res) => {
    try {
      const { condition, categoryType, assignedClientId, assignedJobId, isActive, search } = req.query;
      
      if (search && typeof search === 'string') {
        const assets = await storage.searchAssets(search);
        return res.json(assets);
      }
      
      const filters: any = {};
      if (condition) filters.condition = condition;
      if (categoryType) filters.categoryType = categoryType;
      if (assignedClientId) filters.assignedClientId = assignedClientId;
      if (assignedJobId) filters.assignedJobId = assignedJobId;
      if (isActive !== undefined) filters.isActive = isActive === 'true';
      
      const assets = await storage.getAssets(Object.keys(filters).length > 0 ? filters : undefined);
      res.json(assets);
    } catch (error) {
      console.error("Error fetching assets:", error);
      res.status(500).json({ error: "Failed to fetch assets" });
    }
  });

  // Get assets with expiring warranty
  app.get("/api/assets/warranty-expiring", requireAuth, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const assets = await storage.getAssetsExpiringWarranty(days);
      res.json(assets);
    } catch (error) {
      console.error("Error fetching expiring warranty assets:", error);
      res.status(500).json({ error: "Failed to fetch assets with expiring warranty" });
    }
  });

  // Lookup asset by barcode
  app.get("/api/assets/lookup/barcode/:barcode", requireAuth, async (req, res) => {
    try {
      const asset = await storage.getAssetByBarcode(req.params.barcode);
      if (!asset) {
        return res.status(404).json({ error: "Asset not found", barcode: req.params.barcode });
      }
      res.json(asset);
    } catch (error) {
      console.error("Error looking up asset by barcode:", error);
      res.status(500).json({ error: "Failed to lookup asset" });
    }
  });

  // Lookup asset by serial number
  app.get("/api/assets/lookup/serial/:serialNumber", requireAuth, async (req, res) => {
    try {
      const asset = await storage.getAssetBySerialNumber(req.params.serialNumber);
      if (!asset) {
        return res.status(404).json({ error: "Asset not found", serialNumber: req.params.serialNumber });
      }
      res.json(asset);
    } catch (error) {
      console.error("Error looking up asset by serial number:", error);
      res.status(500).json({ error: "Failed to lookup asset" });
    }
  });

  // Get single asset by ID
  app.get("/api/assets/:id", requireAuth, async (req, res) => {
    try {
      const asset = await storage.getAsset(req.params.id);
      if (!asset) {
        return res.status(404).json({ error: "Asset not found" });
      }
      res.json(asset);
    } catch (error) {
      console.error("Error fetching asset:", error);
      res.status(500).json({ error: "Failed to fetch asset" });
    }
  });

  // Create new asset
  app.post("/api/assets", requireAuth, async (req, res) => {
    try {
      const asset = await storage.createAsset(req.body);
      
      // Log history
      await storage.createAssetHistory({
        assetId: asset.id,
        action: 'created',
        description: `Asset created: ${asset.name}`,
        newValue: asset,
        performedBy: (req as any).user?.id,
      });
      
      res.status(201).json(asset);
    } catch (error) {
      console.error("Error creating asset:", error);
      res.status(500).json({ error: "Failed to create asset" });
    }
  });

  // Update asset
  app.put("/api/assets/:id", requireAuth, async (req, res) => {
    try {
      const existingAsset = await storage.getAsset(req.params.id);
      if (!existingAsset) {
        return res.status(404).json({ error: "Asset not found" });
      }
      
      const asset = await storage.updateAsset(req.params.id, req.body);
      
      // Log history
      await storage.createAssetHistory({
        assetId: req.params.id,
        action: 'updated',
        description: `Asset updated`,
        previousValue: existingAsset,
        newValue: asset,
        performedBy: (req as any).user?.id,
      });
      
      res.json(asset);
    } catch (error) {
      console.error("Error updating asset:", error);
      res.status(500).json({ error: "Failed to update asset" });
    }
  });

  // Delete asset (soft delete - set isActive to false)
  app.delete("/api/assets/:id", requireAdmin, async (req, res) => {
    try {
      const existingAsset = await storage.getAsset(req.params.id);
      if (!existingAsset) {
        return res.status(404).json({ error: "Asset not found" });
      }
      
      // Soft delete
      await storage.updateAsset(req.params.id, { isActive: false });
      
      // Log history
      await storage.createAssetHistory({
        assetId: req.params.id,
        action: 'deleted',
        description: `Asset deactivated: ${existingAsset.name}`,
        previousValue: existingAsset,
        performedBy: (req as any).user?.id,
      });
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting asset:", error);
      res.status(500).json({ error: "Failed to delete asset" });
    }
  });

  // Get asset history
  app.get("/api/assets/:id/history", requireAuth, async (req, res) => {
    try {
      const history = await storage.getAssetHistory(req.params.id);
      res.json(history);
    } catch (error) {
      console.error("Error fetching asset history:", error);
      res.status(500).json({ error: "Failed to fetch asset history" });
    }
  });

  // ==================== AUDIT LOG ROUTES ====================
  
  // Get audit logs - Directors Suite only
  app.get("/api/audit/logs", requireRoles('super_admin', 'admin'), async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || !user.hasDirectorsSuite) {
        return res.status(403).json({ error: "Director's Suite access required" });
      }
      
      const filters = {
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        userId: req.query.userId as string | undefined,
        actionType: req.query.actionType as string | undefined,
        actionCategory: req.query.actionCategory as string | undefined,
        entityType: req.query.entityType as string | undefined,
        severity: req.query.severity as string | undefined,
        search: req.query.search as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };
      
      const result = await getAuditLogs(filters);
      
      // Log this access
      await logAuditLogAccess({
        accessedByUserId: req.session.userId!,
        accessedByUserName: user.name,
        accessType: "view",
        filtersApplied: filters,
        recordsAccessed: result.logs.length,
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });
  
  // Get single audit log by ID
  app.get("/api/audit/logs/:id", requireRoles('super_admin', 'admin'), async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || !user.hasDirectorsSuite) {
        return res.status(403).json({ error: "Director's Suite access required" });
      }
      
      const log = await getAuditLogById(req.params.id);
      if (!log) {
        return res.status(404).json({ error: "Audit log not found" });
      }
      res.json(log);
    } catch (error) {
      console.error("Error fetching audit log:", error);
      res.status(500).json({ error: "Failed to fetch audit log" });
    }
  });
  
  // Get audit statistics
  app.get("/api/audit/stats", requireRoles('super_admin', 'admin'), async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || !user.hasDirectorsSuite) {
        return res.status(403).json({ error: "Director's Suite access required" });
      }
      
      const stats = await getAuditStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching audit stats:", error);
      res.status(500).json({ error: "Failed to fetch audit stats" });
    }
  });
  
  // Get failed login attempts
  app.get("/api/audit/failed-actions", requireRoles('super_admin', 'admin'), async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || !user.hasDirectorsSuite) {
        return res.status(403).json({ error: "Director's Suite access required" });
      }
      
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
      
      const failedActions = await getFailedActions({ limit, offset });
      res.json(failedActions);
    } catch (error) {
      console.error("Error fetching failed actions:", error);
      res.status(500).json({ error: "Failed to fetch failed actions" });
    }
  });
  
  // Get active sessions
  app.get("/api/audit/sessions", requireRoles('super_admin', 'admin'), async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || !user.hasDirectorsSuite) {
        return res.status(403).json({ error: "Director's Suite access required" });
      }
      
      const sessions = await getActiveSessions();
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching active sessions:", error);
      res.status(500).json({ error: "Failed to fetch active sessions" });
    }
  });
  
  // Export audit logs
  app.get("/api/audit/export", requireRoles('super_admin', 'admin'), async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || !user.hasDirectorsSuite) {
        return res.status(403).json({ error: "Director's Suite access required" });
      }
      
      const format = (req.query.format as string) || "json";
      
      const filters = {
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        userId: req.query.userId as string | undefined,
        actionType: req.query.actionType as string | undefined,
        actionCategory: req.query.actionCategory as string | undefined,
        entityType: req.query.entityType as string | undefined,
        severity: req.query.severity as string | undefined,
        limit: 10000, // Max export limit
        offset: 0,
      };
      
      const result = await getAuditLogs(filters);
      
      // Log this export
      await logAuditLogAccess({
        accessedByUserId: req.session.userId!,
        accessedByUserName: user.name,
        accessType: "export",
        filtersApplied: filters,
        recordsAccessed: result.logs.length,
        exportFormat: format,
      });
      
      if (format === "csv") {
        const csvHeaders = "ID,Timestamp,User,Role,Action Type,Category,Entity Type,Entity ID,Description,Severity\n";
        const csvRows = result.logs.map(log => 
          `"${log.id}","${log.timestamp}","${log.userName}","${log.userRole}","${log.actionType}","${log.actionCategory || ''}","${log.entityType}","${log.entityId || ''}","${(log.actionDescription || '').replace(/"/g, '""')}","${log.severity}"`
        ).join("\n");
        
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename=audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csvHeaders + csvRows);
      } else {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", `attachment; filename=audit_logs_${new Date().toISOString().split('T')[0]}.json`);
        res.json(result.logs);
      }
    } catch (error) {
      console.error("Error exporting audit logs:", error);
      res.status(500).json({ error: "Failed to export audit logs" });
    }
  });
  
  // Get distinct values for filters
  app.get("/api/audit/filter-options", requireRoles('super_admin', 'admin'), async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || !user.hasDirectorsSuite) {
        return res.status(403).json({ error: "Director's Suite access required" });
      }
      
      const allUsers = await storage.getAllUsers();
      
      res.json({
        actionTypes: ["create", "update", "delete", "login", "logout", "failed_login", "password_reset", "password_change", "export", "import", "bulk_update", "bulk_delete", "approve", "reject", "cancel", "send_email", "send_sms", "download", "upload", "share", "transfer", "assign", "enable", "disable", "archive", "restore", "view"],
        actionCategories: ["auth", "client", "job", "quote", "invoice", "finance", "team", "schedule", "fleet", "settings", "report", "document", "asset"],
        entityTypes: ["user", "client", "job", "quote", "invoice", "payment", "expense", "timesheet", "vehicle", "walkaround_check", "defect", "asset", "file", "settings", "form", "workflow"],
        severities: ["info", "warning", "critical"],
        users: allUsers.map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })),
      });
    } catch (error) {
      console.error("Error fetching filter options:", error);
      res.status(500).json({ error: "Failed to fetch filter options" });
    }
  });
  
  // Verify audit log integrity - Super Admin only
  app.get("/api/audit/verify-integrity", requireSuperAdmin, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || !user.hasDirectorsSuite) {
        return res.status(403).json({ error: "Director's Suite access required" });
      }
      
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const result = await verifyAuditLogIntegrity(limit);
      
      // Log this verification access
      await logAuditLogAccess({
        accessedByUserId: req.session.userId!,
        accessedByUserName: user.name,
        accessType: "verify",
        recordsAccessed: limit,
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error verifying audit log integrity:", error);
      res.status(500).json({ error: "Failed to verify audit log integrity" });
    }
  });

  // ============ NOTIFICATION API ROUTES ============

  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      const category = req.query.category as string;
      const readFilter = req.query.read as string;

      let query = `SELECT * FROM notifications WHERE user_id = $1`;
      const params: any[] = [userId];
      let paramIdx = 2;

      if (category) {
        query += ` AND category = $${paramIdx++}`;
        params.push(category);
      }
      if (readFilter === 'true') {
        query += ` AND read = true`;
      } else if (readFilter === 'false') {
        query += ` AND read = false`;
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      const countResult = await pool.query(
        `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE read = false) as unread FROM notifications WHERE user_id = $1`,
        [userId]
      );

      res.json({
        notifications: result.rows,
        total: parseInt(countResult.rows[0].total),
        unread: parseInt(countResult.rows[0].unread),
      });
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/unread-count", requireAuth, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read = false`,
        [req.session.userId!]
      );
      res.json({ count: parseInt(result.rows[0].count) });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch unread count" });
    }
  });

  app.patch("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const result = await pool.query(
        `UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2 RETURNING *`,
        [req.params.id, req.session.userId!]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: "Notification not found" });
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  app.post("/api/notifications/read-all", requireAuth, async (req, res) => {
    try {
      const result = await pool.query(
        `UPDATE notifications SET read = true WHERE user_id = $1 AND read = false`,
        [req.session.userId!]
      );
      res.json({ updated: result.rowCount });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark all as read" });
    }
  });

  app.delete("/api/notifications/:id", requireAuth, async (req, res) => {
    try {
      const result = await pool.query(
        `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
        [req.params.id, req.session.userId!]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: "Notification not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete notification" });
    }
  });

  app.delete("/api/notifications", requireAuth, async (req, res) => {
    try {
      const result = await pool.query(
        `DELETE FROM notifications WHERE user_id = $1 AND read = true`,
        [req.session.userId!]
      );
      res.json({ deleted: result.rowCount });
    } catch (error) {
      res.status(500).json({ error: "Failed to clear read notifications" });
    }
  });

  app.get("/api/notification-preferences", requireAuth, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT notification_preferences FROM users WHERE id = $1`,
        [req.session.userId!]
      );
      const prefs = result.rows[0]?.notification_preferences;
      const defaults = {
        jobs: { inApp: true, email: true, push: true },
        messages: { inApp: true, email: false, push: true },
        expenses: { inApp: true, email: true, push: false },
        fleet: { inApp: true, email: false, push: false },
        system: { inApp: true, email: false, push: false },
      };
      res.json(prefs && Object.keys(prefs).length > 0 ? { ...defaults, ...prefs } : defaults);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notification preferences" });
    }
  });

  app.put("/api/notification-preferences", requireAuth, async (req, res) => {
    try {
      const preferences = req.body;
      await pool.query(
        `UPDATE users SET notification_preferences = $1 WHERE id = $2`,
        [JSON.stringify(preferences), req.session.userId!]
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to save notification preferences" });
    }
  });

  return httpServer;
}
