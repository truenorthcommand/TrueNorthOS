import { Router, Request, Response } from "express";
import { seedDatabase } from "./seed-data";

const router = Router();

// ============================================================
// MIDDLEWARE: SuperAdmin-only access
// ============================================================
function requireSuperAdmin(req: Request, res: Response, next: any) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (!user.superAdmin) {
    return res.status(403).json({ error: "Super admin access required to seed database" });
  }
  next();
}

/**
 * POST /api/seed/run
 * Seeds the database with test data (superAdmin only)
 */
router.post("/run", requireSuperAdmin, async (req, res) => {
  try {
    console.log("[Seed] Starting database seed...");
    const result = await seedDatabase();
    console.log("[Seed] Success:", result.message);

    res.json(result);
  } catch (error: any) {
    console.error("[Seed] Error:", error.message);
    res.status(500).json({ error: error.message || "Failed to seed database" });
  }
});

export default router;
