/**
 * Bootstrap API Routes
 * 
 * Provides a one-time, unauthenticated endpoint to create the initial admin account.
 * This runs in the deployed Railway environment where DATABASE_URL is available.
 * 
 * Security:
 * - Only works if ZERO users exist in database
 * - Cannot be used to recreate or modify existing accounts
 * - Logs all bootstrap attempts for audit trail
 */

import { Router, Request, Response } from "express";
import { db } from "./db";
import { users } from "@shared/schema";
import bcrypt from "bcrypt";
import { logAuditEvent } from "./audit";
import { eq } from "drizzle-orm";

const router = Router();
const SALT_ROUNDS = 12;

/**
 * POST /api/bootstrap-seed
 * 
 * Quick superadmin account creation ONLY (no clients, jobs, etc.)
 * Allows user to login immediately and then manually seed data via UI.
 * 
 * This bypasses CSP issues and provides a simpler bootstrap workflow.
 */
router.post("/seed", async (req: Request, res: Response) => {
  try {
    console.log("[Bootstrap-Seed] Received quick seed request from:", req.ip);

    // 1. Check if ANY users exist
    const existingUsers = await db.select().from(users).limit(1);
    
    if (existingUsers.length > 0) {
      console.log("[Bootstrap-Seed] REJECTED - Users already exist");
      return res.status(409).json({
        error: "Database already initialized",
        message: "Cannot bootstrap when users already exist."
      });
    }

    // 2. Get credentials from environment
    const username = process.env.APP_USERNAME;
    const password = process.env.APP_PASSWORD;

    if (!username || !password) {
      console.error("[Bootstrap-Seed] FAILED - Missing environment variables");
      return res.status(500).json({
        error: "Server misconfiguration",
        message: "APP_USERNAME and APP_PASSWORD must be set"
      });
    }

    console.log(`[Bootstrap-Seed] Creating quick superadmin account: ${username}`);

    // 3. Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // 4. Create ONLY superadmin (no seed data)
    const now = new Date();
    const passwordExpiry = new Date();
    passwordExpiry.setDate(passwordExpiry.getDate() + 90);

    const [admin] = await db.insert(users).values({
      username,
      password: hashedPassword,
      name: "System Administrator",
      email: process.env.ADMIN_EMAIL || null,
      phone: null,
      role: "admin",
      roles: ["admin", "director"],
      superAdmin: true,
      
      // Security fields
      twoFactorSecret: null,
      twoFactorEnabled: false,
      firstLoginCompleted: false,
      requirePasswordChange: true,
      passwordSetAt: now,
      passwordExpiresAt: passwordExpiry,
      accountCreatedBy: null,
      lastPasswordResetBy: null,
      lastPasswordResetAt: null,
      failedLoginAttempts: 0,
      accountLockedUntil: null,
      lastLoginAt: null,
      lastLoginIp: null,
      gdprConsentDate: null,
      gdprConsentVersion: null,
      deletionRequestedAt: null,
      status: "active",
    }).returning();

    console.log("[Bootstrap-Seed] ✅ Quick superadmin account created:", admin.id);

    // 5. Log audit event
    try {
      await logAuditEvent({
        userId: admin.id,
        action: "system.bootstrap.seed",
        resourceType: "user",
        resourceId: admin.id,
        details: {
          username: admin.username,
          requestIp: req.ip,
          timestamp: now.toISOString(),
        },
      });
    } catch (auditError) {
      console.error("[Bootstrap-Seed] Audit log failed (non-critical):", auditError);
    }

    return res.json({
      success: true,
      message: "superadmin account created - ready to login!",
      account: {
        username: admin.username,
        name: admin.name,
        superAdmin: admin.superAdmin,
        userId: admin.id,
      },
      loginInstructions: [
        "1. Go to: https://adaptservicesgroup.app/login",
        `2. Login with username: ${username}`,
        "3. You'll be prompted to:",
        "   - Change your password",
        "   - Set up 2FA (scan QR code)",
        "   - Save backup codes",
        "4. After onboarding, you can seed demo data via Settings > Database Seeding",
      ],
      security: {
        passwordChangeRequired: true,
        twoFactorRequired: true,
        firstLoginPending: true,
      },
    });

  } catch (error: any) {
    console.error("[Bootstrap-Seed] FATAL ERROR:", error);
    return res.status(500).json({
      error: "Bootstrap seed failed",
      message: error.message || "An unexpected error occurred",
    });
  }
});

/**
 * POST /api/bootstrap
 * 
 * Creates the initial superadmin account for TrueNorthOS.
 * Only works if the users table is completely empty.
 * 
 * No authentication required, but fails if any users exist.
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    console.log("[Bootstrap] Received bootstrap request from:", req.ip);

    // 1. Check if ANY users exist
    const existingUsers = await db.select().from(users).limit(1);
    
    if (existingUsers.length > 0) {
      console.log("[Bootstrap] REJECTED - Database already contains users");
      return res.status(409).json({
        error: "Database already initialized",
        message: "Cannot bootstrap when users already exist. This endpoint is for first-time setup only."
      });
    }

    // 2. Get credentials from environment
    const username = process.env.APP_USERNAME;
    const password = process.env.APP_PASSWORD;

    if (!username || !password) {
      console.error("[Bootstrap] FAILED - Missing environment variables");
      return res.status(500).json({
        error: "Server misconfiguration",
        message: "APP_USERNAME and APP_PASSWORD must be set in environment variables"
      });
    }

    console.log(`[Bootstrap] Creating superadmin account: ${username}`);

    // 3. Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // 4. Create superadmin with all security fields
    const now = new Date();
    const passwordExpiry = new Date();
    passwordExpiry.setDate(passwordExpiry.getDate() + 90); // 90 days

    const [admin] = await db.insert(users).values({
      username,
      password: hashedPassword,
      name: "System Administrator",
      email: process.env.ADMIN_EMAIL || null,
      phone: null,
      role: "admin",
      roles: ["admin", "director"],
      superAdmin: true,
      
      // Security fields for closed-loop auth
      twoFactorSecret: null,
      twoFactorEnabled: false, // Must enable during onboarding
      firstLoginCompleted: false, // Force onboarding flow
      requirePasswordChange: true, // Must change password on first login
      passwordSetAt: now,
      passwordExpiresAt: passwordExpiry,
      
      // Account creation tracking
      accountCreatedBy: null, // Self-bootstrapped
      lastPasswordResetBy: null,
      lastPasswordResetAt: null,
      
      // Login security
      failedLoginAttempts: 0,
      accountLockedUntil: null,
      lastLoginAt: null,
      lastLoginIp: null,
      
      // GDPR compliance
      gdprConsentDate: null, // Will be set during onboarding
      gdprConsentVersion: null,
      deletionRequestedAt: null,
      
      // Account status
      status: "active",
    }).returning();

    console.log("[Bootstrap] ✅ Success! Superadmin account created:", admin.id);

    // 5. Log audit event
    try {
      await logAuditEvent({
        userId: admin.id,
        action: "system.bootstrap",
        resourceType: "user",
        resourceId: admin.id,
        details: {
          username: admin.username,
          requestIp: req.ip,
          timestamp: now.toISOString(),
        },
      });
    } catch (auditError) {
      console.error("[Bootstrap] Audit log failed (non-critical):", auditError);
    }

    return res.json({
      success: true,
      message: "Initial admin account created successfully",
      account: {
        username: admin.username,
        name: admin.name,
        superAdmin: admin.superAdmin,
        userId: admin.id,
      },
      nextSteps: [
        "Navigate to the login page",
        `Login with username: ${username}`,
        "Complete the onboarding flow:",
        "  - Change password",
        "  - Set up two-factor authentication (2FA)",
        "  - Save backup codes securely",
        "Accept GDPR terms if required",
      ],
      security: {
        passwordChangeRequired: true,
        twoFactorRequired: true,
        firstLoginPending: true,
      },
    });

  } catch (error: any) {
    console.error("[Bootstrap] FATAL ERROR:", error);
    return res.status(500).json({
      error: "Bootstrap failed",
      message: error.message || "An unexpected error occurred during bootstrap",
    });
  }
});

/**
 * GET /api/bootstrap/status
 * 
 * Check if bootstrap is needed (no users exist)
 */
router.get("/status", async (req: Request, res: Response) => {
  try {
    const existingUsers = await db.select().from(users).limit(1);
    const needsBootstrap = existingUsers.length === 0;

    return res.json({
      needsBootstrap,
      initialized: !needsBootstrap,
      userCount: existingUsers.length,
    });
  } catch (error: any) {
    console.error("[Bootstrap] Status check failed:", error);
    return res.status(500).json({
      error: "Status check failed",
      message: error.message,
    });
  }
});

/**
 * POST /api/bootstrap/reset-password
 * 
 * Resets the APP_USERNAME user's password to match the current APP_PASSWORD env var.
 * Use when Railway env vars are changed after bootstrap.
 * Only works for the APP_USERNAME account.
 */
router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const appUsername = process.env.APP_USERNAME;
    const appPassword = process.env.APP_PASSWORD;

    if (!appUsername || !appPassword) {
      return res.status(400).json({
        error: "Missing environment variables",
        message: "APP_USERNAME and APP_PASSWORD must be set in Railway variables.",
      });
    }

    // Find the user
    const [user] = await db.select().from(users).where(
      eq(users.username, appUsername)
    ).limit(1);

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        message: "No user found with username: " + appUsername,
      });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(appPassword, SALT_ROUNDS);

    // Update the user's password and reset onboarding flags
    await db.update(users).set({
      password: hashedPassword,
      firstLoginCompleted: false,
      requirePasswordChange: false,
      passwordSetAt: new Date(),
      failedLoginAttempts: 0,
      accountLockedUntil: null,
    }).where(eq(users.id, user.id));

    console.log("[Bootstrap] Password reset for user: " + appUsername);

    return res.json({
      success: true,
      message: "Password reset successfully for " + appUsername + ". You can now login with the new password.",
      username: appUsername,
    });
  } catch (error: any) {
    console.error("[Bootstrap] Password reset failed:", error);
    return res.status(500).json({
      error: "Password reset failed",
      message: error.message,
    });
  }
});

export default router;
