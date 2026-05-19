/**
 * Bootstrap Script: Create Initial Admin Account
 * 
 * Creates the first superadmin account for TrueNorthOS closed-loop authentication.
 * Run this ONCE after deploying the application with no existing users.
 * 
 * Usage:
 *   npx tsx server/bootstrap-admin.ts
 * 
 * Security:
 * - Only runs if NO users exist in database
 * - Creates account with credentials from environment variables
 * - Requires password change on first login
 * - 2FA must be configured during onboarding
 */

import { db } from "./db";
import { users } from "@shared/schema";
import bcrypt from "bcrypt";
import { sql } from "drizzle-orm";

const SALT_ROUNDS = 12;

async function bootstrapAdmin() {
  console.log("\n🔐 TrueNorthOS Admin Bootstrap\n");
  console.log("═══════════════════════════════════════════════════════\n");

  try {
    // 1. Check if any users already exist
    const existingUsers = await db.select().from(users).limit(1);
    
    if (existingUsers.length > 0) {
      console.log("❌ Database already contains users.");
      console.log("   Bootstrap can only run on an empty user table.");
      console.log("   If you need to reset, manually delete all users first.\n");
      process.exit(1);
    }

    // 2. Get credentials from environment
    const username = process.env.APP_USERNAME;
    const password = process.env.APP_PASSWORD;

    if (!username || !password) {
      console.log("❌ Missing required environment variables:");
      console.log("   - APP_USERNAME");
      console.log("   - APP_PASSWORD");
      console.log("\n   Set these in your .env file or environment.\n");
      process.exit(1);
    }

    console.log(`📝 Creating superadmin account: ${username}`);

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

    console.log("\n✅ Superadmin account created successfully!\n");
    console.log("Account Details:");
    console.log(`  Username:    ${admin.username}`);
    console.log(`  Name:        ${admin.name}`);
    console.log(`  Super Admin: ${admin.superAdmin}`);
    console.log(`  User ID:     ${admin.id}`);
    console.log("\n⚠️  Security Requirements:");
    console.log(`  1. Password must be changed on first login`);
    console.log(`  2. Two-factor authentication must be configured`);
    console.log(`  3. Backup codes will be generated during onboarding`);
    console.log("\n🔑 Next Steps:");
    console.log(`  1. Navigate to your application login page`);
    console.log(`  2. Login with username: ${username}`);
    console.log(`  3. Complete the onboarding flow:`);
    console.log(`     - Change password`);
    console.log(`     - Set up 2FA (scan QR code with authenticator app)`);
    console.log(`     - Save backup codes securely`);
    console.log(`  4. Accept GDPR terms if required`);
    console.log("\n═══════════════════════════════════════════════════════\n");

  } catch (error: any) {
    console.error("\n❌ Bootstrap failed:", error.message);
    console.error("\nError details:", error);
    process.exit(1);
  }
}

// Run bootstrap
bootstrapAdmin()
  .then(() => {
    console.log("Bootstrap complete. Exiting.\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
