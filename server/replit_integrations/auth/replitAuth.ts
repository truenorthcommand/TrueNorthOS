import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import { authStorage } from "./storage";
import { pool } from "../../db";

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  return await authStorage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

// Find user by Google ID or email
async function findUserByGoogleOrEmail(googleId: string, email: string | null) {
  // First try by googleId
  const byGoogle = await pool.query(
    `SELECT * FROM users WHERE google_id = $1`,
    [googleId]
  );
  if (byGoogle.rows.length > 0) {
    return byGoogle.rows[0];
  }
  
  // Then try by email
  if (email) {
    const byEmail = await pool.query(
      `SELECT * FROM users WHERE email = $1`,
      [email]
    );
    if (byEmail.rows.length > 0) {
      // Link Google account to existing user
      await pool.query(
        `UPDATE users SET google_id = $1 WHERE id = $2`,
        [googleId, byEmail.rows[0].id]
      );
      return byEmail.rows[0];
    }
  }
  
  return null;
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  
  // Initialize passport without its own session (we use TrueNorth's session)
  app.use(passport.initialize());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const claims = tokens.claims();
    const user = { claims };
    updateUserSession(user, tokens);
    
    // Upsert user and get their ID for TrueNorth session
    const tnUser = await upsertUser(claims);
    (user as any).tnUserId = tnUser.id;
    
    verified(null, user);
  };

  // Keep track of registered strategies
  const registeredStrategies = new Set<string>();

  // Helper function to ensure strategy exists for a domain
  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/oauth/callback`,
        },
        verify
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  // Google OAuth login - redirects to Replit OIDC
  app.get("/api/oauth/google", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  // OAuth callback - logs user into TrueNorth session
  app.get("/api/oauth/callback", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      session: false, // Don't use passport session
      failureRedirect: "/?error=oauth_failed",
    }, async (err: any, user: any) => {
      if (err || !user) {
        console.error("OAuth error:", err);
        return res.redirect("/?error=oauth_failed");
      }
      
      try {
        // Log user into TrueNorth's session system
        if (user.tnUserId && req.session) {
          req.session.userId = user.tnUserId;
          req.session.save((saveErr) => {
            if (saveErr) {
              console.error("Session save error:", saveErr);
              return res.redirect("/?error=session_failed");
            }
            return res.redirect("/");
          });
        } else {
          return res.redirect("/?error=user_not_found");
        }
      } catch (error) {
        console.error("OAuth callback error:", error);
        return res.redirect("/?error=oauth_failed");
      }
    })(req, res, next);
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // Check TrueNorth session first
  if (req.session?.userId) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};

// Re-export getSession for other uses (not needed for this integration)
export function getSession() {
  return (req: any, res: any, next: any) => next();
}
