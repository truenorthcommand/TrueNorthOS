import { Router, Request, Response } from "express";
import { pool } from "./db";
import { sendEmail } from "./email";

const router = Router();

// === ACCESS CONTROL ===
function requireAuth(req: Request, res: Response, next: any) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

function requireAdmin(req: Request, res: Response, next: any) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const isAdmin =
    user.role === "admin" ||
    user.role === "super_admin" ||
    user.roles?.includes("admin") ||
    user.roles?.includes("super_admin");
  if (!isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

router.use(requireAuth);

// === HELPERS ===
const CATEGORY_EMOJIS: Record<string, string> = {
  bug: "🐛",
  improvement: "💡",
  feature: "✨",
  other: "💬",
};

function buildFeedbackEmailHtml(feedback: any): string {
  const emoji = CATEGORY_EMOJIS[feedback.category] || "💬";
  const categoryLabel = feedback.category.charAt(0).toUpperCase() + feedback.category.slice(1);
  const timestamp = new Date(feedback.created_at).toLocaleString("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
  });

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>${emoji} ${categoryLabel} Feedback: ${feedback.subject}</h2>
      <p><strong>From:</strong> ${feedback.user_name || "Unknown"} (${feedback.user_role || "user"})</p>
      <p><strong>Email:</strong> ${feedback.user_email || "N/A"}</p>
      <p><strong>Priority:</strong> ${feedback.priority}</p>
      <p><strong>Page:</strong> ${feedback.page_url || "N/A"}</p>
      <hr/>
      <p>${feedback.description}</p>
      <hr/>
      <p><small>Submitted: ${timestamp} | Manage in admin panel</small></p>
    </div>
  `;
}

// === POST / — Submit feedback (any authenticated user) ===
router.post("/", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { category, subject, description, priority, page_url, screenshot_url } = req.body;

    // Validate required fields
    if (!category || !subject || !description) {
      return res.status(400).json({ error: "category, subject, and description are required" });
    }

    // Validate category
    const validCategories = ["bug", "improvement", "feature", "other"];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${validCategories.join(", ")}` });
    }

    // Validate priority if provided
    const validPriorities = ["low", "medium", "high", "critical"];
    if (priority && !validPriorities.includes(priority)) {
      return res.status(400).json({ error: `priority must be one of: ${validPriorities.join(", ")}` });
    }

    const result = await pool.query(
      `INSERT INTO feedback (user_id, user_name, user_email, user_role, category, priority, subject, description, page_url, screenshot_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        user.id,
        user.name || user.username || null,
        user.email || null,
        user.role || null,
        category,
        priority || "medium",
        subject,
        description,
        page_url || null,
        screenshot_url || null,
      ]
    );

    const feedback = result.rows[0];

    // Attempt to send notification email
    try {
      const emailHtml = buildFeedbackEmailHtml(feedback);
      const emailSubject = `[${CATEGORY_EMOJIS[category]} ${category.toUpperCase()}] ${subject}`;
      await sendEmail("info@adaptservicesgroup.co.uk", emailSubject, emailHtml);
    } catch (emailErr: any) {
      console.error("[Feedback] Email notification failed:", emailErr.message);
      // Don't fail the request if email fails
    }

    res.status(201).json(feedback);
  } catch (error: any) {
    console.error("[Feedback] Submit error:", error.message);
    res.status(500).json({ error: "Failed to submit feedback" });
  }
});

// === GET /stats — Feedback stats (admin only) ===
router.get("/stats", requireAdmin, async (req: Request, res: Response) => {
  try {
    const statusCounts = await pool.query(
      `SELECT status, COUNT(*)::int as count FROM feedback GROUP BY status`
    );
    const categoryCounts = await pool.query(
      `SELECT category, COUNT(*)::int as count FROM feedback GROUP BY category`
    );
    const priorityCounts = await pool.query(
      `SELECT priority, COUNT(*)::int as count FROM feedback GROUP BY priority`
    );
    const openCount = await pool.query(
      `SELECT COUNT(*)::int as count FROM feedback WHERE status NOT IN ('resolved', 'closed', 'wont_fix')`
    );
    const resolvedCount = await pool.query(
      `SELECT COUNT(*)::int as count FROM feedback WHERE status IN ('resolved', 'closed', 'wont_fix')`
    );

    res.json({
      by_status: statusCounts.rows,
      by_category: categoryCounts.rows,
      by_priority: priorityCounts.rows,
      open: openCount.rows[0]?.count || 0,
      resolved: resolvedCount.rows[0]?.count || 0,
    });
  } catch (error: any) {
    console.error("[Feedback] Stats error:", error.message);
    res.status(500).json({ error: "Failed to get feedback stats" });
  }
});

// === GET /my — Get current user's feedback ===
router.get("/my", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const result = await pool.query(
      `SELECT * FROM feedback WHERE user_id = $1 ORDER BY created_at DESC`,
      [user.id]
    );
    res.json(result.rows);
  } catch (error: any) {
    console.error("[Feedback] My feedback error:", error.message);
    res.status(500).json({ error: "Failed to get your feedback" });
  }
});

// === GET / — List all feedback (admin only) ===
router.get("/", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, category, priority, page } = req.query;
    const limit = 50;
    const offset = page ? (parseInt(page as string, 10) - 1) * limit : 0;

    let query = `SELECT * FROM feedback WHERE 1=1`;
    const params: any[] = [];
    let paramIdx = 1;

    if (status) {
      query += ` AND status = $${paramIdx++}`;
      params.push(status);
    }
    if (category) {
      query += ` AND category = $${paramIdx++}`;
      params.push(category);
    }
    if (priority) {
      query += ` AND priority = $${paramIdx++}`;
      params.push(priority);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count for pagination
    let countQuery = `SELECT COUNT(*)::int as total FROM feedback WHERE 1=1`;
    const countParams: any[] = [];
    let countIdx = 1;
    if (status) {
      countQuery += ` AND status = $${countIdx++}`;
      countParams.push(status);
    }
    if (category) {
      countQuery += ` AND category = $${countIdx++}`;
      countParams.push(category);
    }
    if (priority) {
      countQuery += ` AND priority = $${countIdx++}`;
      countParams.push(priority);
    }

    const countResult = await pool.query(countQuery, countParams);

    res.json({
      feedback: result.rows,
      total: countResult.rows[0]?.total || 0,
      page: page ? parseInt(page as string, 10) : 1,
      limit,
    });
  } catch (error: any) {
    console.error("[Feedback] List error:", error.message);
    res.status(500).json({ error: "Failed to list feedback" });
  }
});

// === GET /:id — Get single feedback detail (admin or owner) ===
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const result = await pool.query(`SELECT * FROM feedback WHERE id = $1`, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Feedback not found" });
    }

    const feedback = result.rows[0];

    // Check access: admin or owner
    const isAdmin =
      user.role === "admin" ||
      user.role === "super_admin" ||
      user.roles?.includes("admin") ||
      user.roles?.includes("super_admin");
    if (!isAdmin && feedback.user_id !== user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(feedback);
  } catch (error: any) {
    console.error("[Feedback] Get detail error:", error.message);
    res.status(500).json({ error: "Failed to get feedback" });
  }
});

// === PATCH /:id — Update feedback status (admin only) ===
router.patch("/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { status, admin_notes, priority } = req.body;

    // Validate status if provided
    const validStatuses = ["new", "reviewed", "in_progress", "resolved", "closed", "wont_fix"];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(", ")}` });
    }

    // Validate priority if provided
    const validPriorities = ["low", "medium", "high", "critical"];
    if (priority && !validPriorities.includes(priority)) {
      return res.status(400).json({ error: `priority must be one of: ${validPriorities.join(", ")}` });
    }

    // Check exists
    const existing = await pool.query(`SELECT * FROM feedback WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Feedback not found" });
    }

    // Build dynamic update
    const updates: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (status) {
      updates.push(`status = $${paramIdx++}`);
      params.push(status);

      // Auto-set resolved fields
      if (status === "resolved") {
        updates.push(`resolved_at = NOW()`);
        updates.push(`resolved_by = $${paramIdx++}`);
        params.push(user.id);
      }
    }
    if (admin_notes !== undefined) {
      updates.push(`admin_notes = $${paramIdx++}`);
      params.push(admin_notes);
    }
    if (priority) {
      updates.push(`priority = $${paramIdx++}`);
      params.push(priority);
    }

    updates.push(`updated_at = NOW()`);

    if (updates.length === 1) {
      // Only updated_at, nothing meaningful to update
      return res.status(400).json({ error: "No valid fields to update" });
    }

    params.push(id);
    const query = `UPDATE feedback SET ${updates.join(", ")} WHERE id = $${paramIdx} RETURNING *`;

    const result = await pool.query(query, params);
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("[Feedback] Update error:", error.message);
    res.status(500).json({ error: "Failed to update feedback" });
  }
});

// === DELETE /:id — Delete feedback (admin only) ===
router.delete("/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`DELETE FROM feedback WHERE id = $1 RETURNING id`, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Feedback not found" });
    }

    res.json({ success: true, deleted: id });
  } catch (error: any) {
    console.error("[Feedback] Delete error:", error.message);
    res.status(500).json({ error: "Failed to delete feedback" });
  }
});

export default router;
