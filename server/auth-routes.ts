/**
 * TrueNorthOS — Closed-Loop Authentication System
 * 
 * Admin-provisioned accounts with mandatory 2FA and backup codes.
 * No third-party OAuth dependencies.
 * GDPR-compliant, high-security authentication for sensitive business data.
 */

import bcrypt from "bcrypt";
import crypto from "crypto";
import { TOTP } from "otpauth";
import QRCode from "qrcode";
import type { Request, Response } from "express";
import { storage } from "./storage";
import { logAuditEvent, logFailedAction } from "./audit";

const SALT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const PASSWORD_EXPIRY_DAYS = 90;

// ============================================================================
// Admin: Create User Account
// ============================================================================

export async function adminCreateAccount(req: Request, res: Response) {
  const { username, name, email, phone, role, temporaryPassword } = req.body;
  const adminUserId = req.session.userId;
  
  if (!adminUserId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  // Validate admin has permission
  const admin = await storage.getUser(adminUserId);
  if (!admin?.superAdmin && !(admin?.roles as string[])?.includes('admin')) {
    return res.status(403).json({ error: "Admin access required" });
  }
  
  // Generate secure temporary password if not provided
  const tempPassword = temporaryPassword || generateSecurePassword();
  const hashedPassword = await bcrypt.hash(tempPassword, SALT_ROUNDS);
  
  try {
    // Create user account
    const user = await storage.createUser({
      username,
      password: hashedPassword,
      name,
      email,
      phone,
      role,
      requirePasswordChange: true,
      firstLoginCompleted: false,
      accountCreatedBy: adminUserId,
      passwordSetAt: new Date(),
    });
    
    await logAuditEvent({
      userId: adminUserId,
      action: "user.create",
      resourceType: "user",
      resourceId: user.id,
      details: { username, role },
    });
    
    return res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
      },
      temporaryPassword: tempPassword, // ONLY return this once!
    });
  } catch (error: any) {
    console.error("[Auth] User creation error:", error);
    
    if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
      return res.status(409).json({ error: "Username already exists" });
    }
    
    return res.status(500).json({ error: "Failed to create user account" });
  }
}

// ============================================================================
// User Login
// ============================================================================

export async function login(req: Request, res: Response) {
  const { username, password, totpCode } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }
  
  const user = await storage.getUserByUsername(username);
  
  if (!user) {
    await logFailedAction({
      action: "login.failed",
      reason: "user_not_found",
      details: { username },
    });
    return res.status(401).json({ error: "Invalid credentials" });
  }
  
  // Check account lockout
  if (user.accountLockedUntil && new Date() < user.accountLockedUntil) {
    const remainingMinutes = Math.ceil(
      (user.accountLockedUntil.getTime() - Date.now()) / 60000
    );
    await logFailedAction({
      userId: user.id,
      action: "login.failed",
      reason: "account_locked",
      details: { username, remainingMinutes },
    });
    return res.status(423).json({
      error: "Account locked",
      remainingMinutes,
    });
  }
  
  // Verify password
  const passwordValid = await bcrypt.compare(password, user.password);
  
  if (!passwordValid) {
    const failedAttempts = (user.failedLoginAttempts || 0) + 1;
    const lockAccount = failedAttempts >= MAX_FAILED_ATTEMPTS;
    
    await storage.updateUser(user.id, {
      failedLoginAttempts: failedAttempts,
      accountLockedUntil: lockAccount
        ? new Date(Date.now() + LOCKOUT_DURATION_MS)
        : user.accountLockedUntil,
    });
    
    await logFailedAction({
      userId: user.id,
      action: "login.failed",
      reason: "invalid_password",
      details: { username, failedAttempts, lockAccount },
    });
    
    return res.status(401).json({
      error: "Invalid credentials",
      remainingAttempts: lockAccount ? 0 : MAX_FAILED_ATTEMPTS - failedAttempts,
    });
  }
  
  // Check if 2FA is enabled
  if (user.twoFactorEnabled) {
    if (!totpCode) {
      return res.status(200).json({
        requiresTwoFactor: true,
        userId: user.id, // Temporary - for 2FA submission
      });
    }
    
    // Verify TOTP code
    if (!user.twoFactorSecret) {
      return res.status(500).json({ error: "2FA configuration error" });
    }
    
    const totp = new TOTP({
      secret: user.twoFactorSecret,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
    });
    
    const delta = totp.validate({ token: totpCode, window: 1 });
    
    if (delta === null) {
      await logFailedAction({
        userId: user.id,
        action: "login.failed",
        reason: "invalid_totp",
        details: { username },
      });
      return res.status(401).json({ error: "Invalid 2FA code" });
    }
  }
  
  // Reset failed login attempts
  await storage.updateUser(user.id, {
    failedLoginAttempts: 0,
    accountLockedUntil: null,
    lastLoginAt: new Date(),
    lastLoginIp: req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown',
  });
  
  // Check if first login onboarding required
  // Also force onboarding if 2FA is not set up (e.g., migration marked firstLoginCompleted=true
  // but user never completed security setup)
  if (!user.firstLoginCompleted || !user.twoFactorEnabled) {
    req.session.userId = user.id;
    req.session.requiresOnboarding = true;
    
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('[Auth] Session save error (onboarding):', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
    
    return res.json({
      requiresOnboarding: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
      },
    });
  }
  
  // Check if password change required
  if (user.requirePasswordChange) {
    req.session.userId = user.id;
    req.session.requiresPasswordChange = true;
    
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('[Auth] Session save error (password change):', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
    
    return res.json({
      requiresPasswordChange: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
      },
    });
  }
  
  // Check if password expired
  if (user.passwordExpiresAt && new Date() > user.passwordExpiresAt) {
    req.session.userId = user.id;
    req.session.requiresPasswordChange = true;
    
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('[Auth] Session save error (password expired):', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
    
    return res.json({
      requiresPasswordChange: true,
      reason: "password_expired",
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
      },
    });
  }
  
  // Successful login - create session
  req.session.userId = user.id;
  
  // Save session before sending response
  await new Promise<void>((resolve, reject) => {
    req.session.save((err) => {
      if (err) {
        console.error('[Auth] Session save error (login success):', err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
  
  await logAuditEvent({
    userId: user.id,
    action: "login.success",
    resourceType: "session",
    details: { username },
  });
  
  return res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      roles: user.roles,
      superAdmin: user.superAdmin,
    },
  });
}

// ============================================================================
// Login with Backup Code
// ============================================================================

export async function loginWithBackupCode(req: Request, res: Response) {
  const { username, password, backupCode } = req.body;
  
  if (!username || !password || !backupCode) {
    return res.status(400).json({ error: "Username, password, and backup code are required" });
  }
  
  const user = await storage.getUserByUsername(username);
  
  if (!user) {
    await logFailedAction({
      action: "login.failed",
      reason: "user_not_found",
      details: { username },
    });
    return res.status(401).json({ error: "Invalid credentials" });
  }
  
  // Check account lockout
  if (user.accountLockedUntil && new Date() < user.accountLockedUntil) {
    return res.status(423).json({ error: "Account locked" });
  }
  
  // Verify password
  const passwordValid = await bcrypt.compare(password, user.password);
  if (!passwordValid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  
  // Verify backup code
  const backupCodes = await storage.getBackupCodes(user.id);
  let validCode = false;
  let usedCodeId: string | null = null;
  
  for (const storedCode of backupCodes) {
    if (storedCode.used) continue; // Skip already-used codes
    
    const matches = await bcrypt.compare(
      backupCode.toUpperCase().replace(/-/g, ""), 
      storedCode.codeHash
    );
    if (matches) {
      validCode = true;
      usedCodeId = storedCode.id;
      break;
    }
  }
  
  if (!validCode) {
    await logFailedAction({
      userId: user.id,
      action: "login.failed",
      reason: "invalid_backup_code",
      details: { username },
    });
    return res.status(401).json({ error: "Invalid backup code" });
  }
  
  // Mark backup code as used
  await storage.markBackupCodeUsed(usedCodeId!, {
    usedAt: new Date(),
    usedFromIp: req.ip || 'unknown',
  });
  
  // Reset failed login attempts
  await storage.updateUser(user.id, {
    failedLoginAttempts: 0,
    accountLockedUntil: null,
    lastLoginAt: new Date(),
    lastLoginIp: req.ip || 'unknown',
  });
  
  // Create session
  req.session.userId = user.id;
  
  // Get remaining backup code count
  const remainingCodes = await storage.getUnusedBackupCodeCount(user.id);
  
  await logAuditEvent({
    userId: user.id,
    action: "login.success_with_backup_code",
    resourceType: "session",
    details: { username, remainingBackupCodes: remainingCodes },
  });
  
  return res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      roles: user.roles,
      superAdmin: user.superAdmin,
    },
    warning: remainingCodes <= 3 ? `Only ${remainingCodes} backup codes remaining` : null,
  });
}

// ============================================================================
// Complete Onboarding: Change Password + Setup 2FA
// ============================================================================

export async function completeOnboarding(req: Request, res: Response) {
  const { newPassword } = req.body;
  const userId = req.session.userId;
  
  if (!userId || !req.session.requiresOnboarding) {
    return res.status(403).json({ error: "Onboarding not required" });
  }
  
  const user = await storage.getUser(userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  
  // Validate password strength
  const passwordValidation = validatePasswordStrength(newPassword);
  if (!passwordValidation.valid) {
    return res.status(400).json({ error: passwordValidation.error });
  }
  
  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
  
  // Generate 2FA secret
  const secret = new TOTP({
    issuer: "TrueNorthOS",
    label: user.username,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });
  
  // Generate QR code
  const qrCodeDataUrl = await QRCode.toDataURL(secret.toString());
  
  // Update user
  await storage.updateUser(userId, {
    password: hashedPassword,
    twoFactorSecret: secret.secret.base32,
    requirePasswordChange: false,
    passwordSetAt: new Date(),
    passwordExpiresAt: new Date(Date.now() + PASSWORD_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
  });
  
  await logAuditEvent({
    userId,
    action: "onboarding.password_changed",
    resourceType: "user",
    resourceId: userId,
  });
  
  return res.json({
    success: true,
    qrCodeDataUrl,
    secret: secret.secret.base32, // For manual entry
  });
}

// ============================================================================
// Verify 2FA Setup During Onboarding
// ============================================================================

export async function verify2FASetup(req: Request, res: Response) {
  const { totpCode } = req.body;
  const userId = req.session.userId;
  
  if (!userId || !req.session.requiresOnboarding) {
    return res.status(403).json({ error: "Onboarding not required" });
  }
  
  const user = await storage.getUser(userId);
  if (!user || !user.twoFactorSecret) {
    return res.status(400).json({ error: "2FA not initialized" });
  }
  
  const totp = new TOTP({
    secret: user.twoFactorSecret,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });
  
  const delta = totp.validate({ token: totpCode, window: 1 });
  
  if (delta === null) {
    return res.status(401).json({ error: "Invalid 2FA code" });
  }
  
  // Mark 2FA as enabled (but don't mark onboarding complete yet - backup codes come next)
  await storage.updateUser(userId, {
    twoFactorEnabled: true,
  });
  
  await logAuditEvent({
    userId,
    action: "onboarding.2fa_verified",
    resourceType: "user",
    resourceId: userId,
  });
  
  return res.json({
    success: true,
    message: "2FA verified successfully",
  });
}

// ============================================================================
// Generate Backup Codes During Onboarding
// ============================================================================

export async function generateBackupCodes(req: Request, res: Response) {
  const userId = req.session.userId;
  
  if (!userId || !req.session.requiresOnboarding) {
    return res.status(403).json({ error: "Onboarding not in progress" });
  }
  
  const user = await storage.getUser(userId);
  if (!user || !user.twoFactorEnabled) {
    return res.status(400).json({ error: "2FA must be enabled first" });
  }
  
  // Generate 10 random backup codes
  const codes: string[] = [];
  const codeHashes: string[] = [];
  
  for (let i = 0; i < 10; i++) {
    const code = generateReadableCode(8);
    const hash = await bcrypt.hash(code, 12);
    
    codes.push(code);
    codeHashes.push(hash);
  }
  
  // Delete any existing backup codes for this user
  await storage.deleteBackupCodes(userId);
  
  // Store hashed codes in database
  for (const hash of codeHashes) {
    await storage.createBackupCode({
      userId,
      codeHash: hash,
      used: false,
    });
  }
  
  await logAuditEvent({
    userId,
    action: "backup_codes.generated",
    resourceType: "user",
    resourceId: userId,
    details: { codeCount: codes.length },
  });
  
  return res.json({
    success: true,
    backupCodes: codes, // ONLY returned once!
  });
}

// ============================================================================
// Complete Onboarding (after backup codes are saved)
// ============================================================================

export async function completeOnboardingFinal(req: Request, res: Response) {
  const userId = req.session.userId;
  
  if (!userId || !req.session.requiresOnboarding) {
    return res.status(403).json({ error: "Onboarding not in progress" });
  }
  
  const user = await storage.getUser(userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  
  // Verify user has backup codes
  const backupCodeCount = await storage.getUnusedBackupCodeCount(userId);
  if (backupCodeCount === 0) {
    return res.status(400).json({ error: "Backup codes must be generated first" });
  }
  
  // Mark onboarding as complete
  await storage.updateUser(userId, {
    firstLoginCompleted: true,
  });
  
  // Clear onboarding flag from session
  delete req.session.requiresOnboarding;
  
  await logAuditEvent({
    userId,
    action: "onboarding.completed",
    resourceType: "user",
    resourceId: userId,
  });
  
  return res.json({
    success: true,
    message: "Onboarding completed successfully",
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      roles: user.roles,
      superAdmin: user.superAdmin,
    },
  });
}

// ============================================================================
// Admin: Reset User Password
// ============================================================================

export async function adminResetPassword(req: Request, res: Response) {
  const { targetUserId } = req.body;
  const adminUserId = req.session.userId;
  
  if (!adminUserId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  const admin = await storage.getUser(adminUserId);
  if (!admin?.superAdmin && !(admin?.roles as string[])?.includes('admin')) {
    return res.status(403).json({ error: "Admin access required" });
  }
  
  const temporaryPassword = generateSecurePassword();
  const hashedPassword = await bcrypt.hash(temporaryPassword, SALT_ROUNDS);
  
  await storage.updateUser(targetUserId, {
    password: hashedPassword,
    requirePasswordChange: true,
    lastPasswordResetBy: adminUserId,
    lastPasswordResetAt: new Date(),
    failedLoginAttempts: 0,
    accountLockedUntil: null,
  });
  
  await logAuditEvent({
    userId: adminUserId,
    action: "user.password_reset",
    resourceType: "user",
    resourceId: targetUserId,
  });
  
  return res.json({
    success: true,
    temporaryPassword, // ONLY return this once!
  });
}

// ============================================================================
// Regenerate Backup Codes (user-initiated or admin-initiated)
// ============================================================================

export async function regenerateBackupCodes(req: Request, res: Response) {
  const userId = req.session.userId;
  const targetUserId = req.body.targetUserId || userId;
  
  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  const user = await storage.getUser(userId);
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }
  
  // Check if user is regenerating their own codes or if admin is doing it for someone
  const isAdmin = user.superAdmin || (user.roles as string[])?.includes('admin');
  if (targetUserId !== userId && !isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  
  // Generate new codes
  const codes: string[] = [];
  const codeHashes: string[] = [];
  
  for (let i = 0; i < 10; i++) {
    const code = generateReadableCode(8);
    const hash = await bcrypt.hash(code, 12);
    codes.push(code);
    codeHashes.push(hash);
  }
  
  // Delete old codes
  await storage.deleteBackupCodes(targetUserId);
  
  // Store new codes
  for (const hash of codeHashes) {
    await storage.createBackupCode({
      userId: targetUserId,
      codeHash: hash,
      used: false,
    });
  }
  
  await logAuditEvent({
    userId: userId,
    action: "backup_codes.regenerated",
    resourceType: "user",
    resourceId: targetUserId,
    details: { initiatedBy: userId === targetUserId ? 'self' : 'admin' },
  });
  
  return res.json({
    success: true,
    backupCodes: codes,
  });
}

// ============================================================================
// Logout
// ============================================================================

export async function logout(req: Request, res: Response) {
  const userId = req.session.userId;
  
  if (userId) {
    await logAuditEvent({
      userId,
      action: "logout",
      resourceType: "session",
    });
  }
  
  req.session.destroy((err) => {
    if (err) {
      console.error("[Auth] Session destruction error:", err);
      return res.status(500).json({ error: "Failed to logout" });
    }
    return res.json({ success: true });
  });
}

// ============================================================================
// Session Management
// ============================================================================

export function checkSessionTimeout(req: Request, res: Response) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  
  const sessionAge = Date.now() - (req.session.createdAt || Date.now());
  const ABSOLUTE_TIMEOUT = 8 * 60 * 60 * 1000; // 8 hours
  const IDLE_TIMEOUT = 20 * 60 * 1000; // 20 minutes
  const remainingTime = ABSOLUTE_TIMEOUT - sessionAge;
  
  return res.json({
    authenticated: true,
    remainingTime: Math.max(0, remainingTime),
    idleTimeout: IDLE_TIMEOUT,
    warningTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function extendSession(req: Request, res: Response) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  
  // Touch session to reset idle timer
  req.session.touch();
  
  return res.json({ success: true });
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateSecurePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*";
  const length = 16;
  let password = "";
  
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, chars.length);
    password += chars[randomIndex];
  }
  
  return password;
}

function generateReadableCode(length: number): string {
  // Exclude ambiguous characters: 0, O, I, l, 1
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, chars.length);
    code += chars[randomIndex];
    
    // Add hyphen after 4 characters for readability
    if (i === 3) code += "-";
  }
  
  return code; // Example: "A3K9-7M2P"
}

function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  if (password.length < 12) {
    return { valid: false, error: "Password must be at least 12 characters" };
  }
  
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one uppercase letter" };
  }
  
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one lowercase letter" };
  }
  
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Password must contain at least one number" };
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, error: "Password must contain at least one special character" };
  }
  
  return { valid: true };
}
