/**
 * TrueNorthOS — Google OAuth 2.0 Authentication
 *
 * Standard, VPS-deployable Google OAuth flow using passport-google-oauth20.
 *
 * Required env vars:
 *   GOOGLE_CLIENT_ID      — from Google Cloud Console
 *   GOOGLE_CLIENT_SECRET  — from Google Cloud Console
 *   APP_URL               — public base URL e.g. https://erp.truenorthops.co.uk
 *
 * Flow:
 *   GET /api/oauth/google        → redirects to Google consent screen
 *   GET /api/oauth/callback      → Google redirects back here
 *   On success: session.userId is set, user redirected to /app
 *   On failure: redirected to /login?error=oauth_failed
 */

import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import type { Express, RequestHandler } from "express";
import { resolveInviteOrLink } from "./invite";

export async function setupGoogleAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(passport.initialize());

  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.APP_URL || "http://localhost:5000";

  if (!clientID || !clientSecret) {
    console.warn(
      "[Auth] WARNING: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not set. " +
      "Google OAuth will be unavailable. Username/password login will still work."
    );
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL: `${appUrl}/api/oauth/callback`,
        scope: ["openid", "email", "profile"],
        passReqToCallback: true,
      },
      async (req: any, _accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value ?? null;
          const googleId = profile.id;

          const userId = await resolveInviteOrLink(req, googleId, email);

          if (!userId) {
            console.warn(`[Auth] Unauthorised Google login attempt: ${email} (${googleId})`);
            return done(null, false);
          }

          return done(null, { id: userId });
        } catch (err) {
          console.error("[Auth] Google strategy error:", err);
          return done(err as Error);
        }
      }
    )
  );

  passport.serializeUser((user: any, cb) => cb(null, user));
  passport.deserializeUser((user: any, cb) => cb(null, user));

  // OAuth Routes
  app.get(
    "/api/oauth/google",
    passport.authenticate("google", {
      scope: ["openid", "email", "profile"],
      prompt: "select_account",
    })
  );

  app.get(
    "/api/oauth/callback",
    passport.authenticate("google", {
      session: false,
      failureRedirect: "/login?error=not_authorised",
    }),
    async (req: any, res) => {
      try {
        const user = req.user as { id: string } | undefined;

        if (!user?.id) {
          console.error("[Auth] OAuth callback: no user resolved.");
          return res.redirect("/login?error=not_authorised");
        }

        req.session.userId = user.id;
        req.session.save((err: any) => {
          if (err) {
            console.error("[Auth] Session save error:", err);
            return res.redirect("/login?error=session_failed");
          }
          return res.redirect("/app");
        });
      } catch (err) {
        console.error("[Auth] OAuth callback error:", err);
        return res.redirect("/login?error=oauth_failed");
      }
    }
  );
}

/**
 * requireAuth middleware — checks TrueNorthOS session.
 * Provider-agnostic: works for both Google OAuth and username/password logins.
 */
export const isAuthenticated: RequestHandler = (req, res, next) => {
  if ((req as any).session?.userId) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};
