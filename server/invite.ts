/**
 * TrueNorthOS — Invite Token System
 *
 * Enables admin-controlled onboarding for Google OAuth users.
 *
 * Flow:
 *   1. Admin creates a user record (name, email, role) via POST /api/users
 *      → An invite token is generated and stored on the user record
 *      → Admin sends the invite link to the user
 *   2. User clicks the invite link: GET /invite/:token
 *      → Token is validated and stored in the session
 *      → User is redirected to /api/oauth/google
 *   3. After Google OAuth callback, if a pending invite token exists in the session:
 *      → The Google account is linked to the pre-created user record
 *      → The invite token is consumed (cleared)
 *
 * This means a Google account can ONLY be used to log in if:
 *   a) The email already exists in the users table (linked on first login), OR
 *   b) A valid invite token was used to pre-authorise the account
 */

import crypto from "crypto";
import type { Express } from "express";
import { pool } from "./db";
import { storage } from "./storage";

/** Generate a secure, URL-safe invite token */
export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Attach invite routes to the Express app.
 * Call this from registerRoutes() after session middleware is set up.
 */
export function registerInviteRoutes(app: Express): void {

  /**
   * GET /invite/:token
   * Validates the invite token, stores it in the session, and redirects
   * the user to Google OAuth to complete their account setup.
   */
  app.get("/invite/:token", async (req: any, res) => {
    const { token } = req.params;

    try {
      // Find the user with this invite token
      const result = await pool.query(
        `SELECT id, name, email, status FROM users WHERE invite_token = $1 AND status = 'pending' LIMIT 1`,
        [token]
      );

      if (result.rows.length === 0) {
        return res.redirect("/login?error=invalid_invite");
      }

      const user = result.rows[0];

      // Store the invite context in the session so the OAuth callback can use it
      req.session.pendingInviteToken = token;
      req.session.pendingInviteUserId = user.id;
      req.session.save((err: any) => {
        if (err) {
          console.error("[Invite] Session save error:", err);
          return res.redirect("/login?error=invite_session_failed");
        }
        // Redirect to Google OAuth
        return res.redirect("/api/oauth/google");
      });
    } catch (err) {
      console.error("[Invite] Token validation error:", err);
      return res.redirect("/login?error=invite_error");
    }
  });

  /**
   * POST /api/users/invite
   * Admin-only: Creates a user record and returns an invite link.
   * The user account is created in 'pending' status until they complete Google OAuth.
   */
  app.post("/api/users/invite", async (req: any, res) => {
    // Require super admin
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const admin = await storage.getUser(req.session.userId);
    if (!admin || (!admin.superAdmin && admin.role !== "admin")) {
      return res.status(403).json({ error: "Super admin access required" });
    }

    try {
      const { name, email, role } = req.body;

      if (!name || !email || !role) {
        return res.status(400).json({ error: "name, email, and role are required" });
      }

      // Check if email already exists
      const existing = await pool.query(
        `SELECT id FROM users WHERE email = $1 LIMIT 1`,
        [email]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: "A user with this email already exists." });
      }

      const inviteToken = generateInviteToken();
      const username = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + Date.now().toString(36);

      // Create user in 'pending' state — no password required
      await pool.query(
        `INSERT INTO users (id, username, password, name, email, role, roles, status, invite_token, created_at)
         VALUES (gen_random_uuid(), $1, '', $2, $3, $4, $5, 'pending', $6, NOW())`,
        [username, name, email, role, JSON.stringify([role]), inviteToken]
      );

      const appUrl = process.env.APP_URL || `https://${req.hostname}`;
      const inviteLink = `${appUrl}/invite/${inviteToken}`;

      console.log(`[Invite] Created invite for ${email} (${role}) — link: ${inviteLink}`);

      return res.status(201).json({
        success: true,
        inviteLink,
        message: `Invite created for ${name}. Send them this link to complete setup.`,
      });
    } catch (err) {
      console.error("[Invite] Create error:", err);
      return res.status(500).json({ error: "Failed to create invite" });
    }
  });
}

/**
 * Called from the OAuth callback after Google authentication succeeds.
 * If a pending invite exists in the session, links the Google account
 * to the pre-created user record and activates the account.
 *
 * Returns the resolved userId to set on the session.
 */
export async function resolveInviteOrLink(
  req: any,
  googleId: string,
  email: string | null
): Promise<string | null> {
  // Case 1: Pending invite in session — link Google account to pre-created user
  if (req.session?.pendingInviteToken && req.session?.pendingInviteUserId) {
    const { pendingInviteToken, pendingInviteUserId } = req.session;

    const result = await pool.query(
      `UPDATE users
       SET google_id = $1,
           email = COALESCE(email, $2),
           status = 'active',
           invite_token = NULL
       WHERE id = $3 AND invite_token = $4 AND status = 'pending'
       RETURNING id`,
      [googleId, email, pendingInviteUserId, pendingInviteToken]
    );

    // Clear invite session data
    delete req.session.pendingInviteToken;
    delete req.session.pendingInviteUserId;

    if (result.rows.length > 0) {
      console.log(`[Invite] Google account linked to user ${pendingInviteUserId}`);
      return result.rows[0].id;
    }
  }

  // Case 2: Existing user — match by googleId or email
  if (email) {
    const result = await pool.query(
      `SELECT id FROM users WHERE google_id = $1 OR email = $2 LIMIT 1`,
      [googleId, email]
    );
    if (result.rows.length > 0) {
      // Ensure googleId is linked
      await pool.query(
        `UPDATE users SET google_id = $1 WHERE id = $2 AND google_id IS NULL`,
        [googleId, result.rows[0].id]
      );
      return result.rows[0].id;
    }
  }

  // No match — this Google account is not authorised
  return null;
}
