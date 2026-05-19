import { Router, Request, Response } from "express";
import { pool } from "./db";
import multer from "multer";
import {
  uploadFile,
  getPresignedDownloadUrl,
  getFile,
  BUCKETS,
} from "./services/object-storage";
import crypto from "crypto";

const router = Router();

// ─── Multer config for image uploads ────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// ─── Access Control ─────────────────────────────────────────────────────
function requireAuth(req: Request, res: Response, next: any) {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: "Authentication required" });
  next();
}

function requireManagerOrAdmin(req: Request, res: Response, next: any) {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: "Authentication required" });
  const allowed = ["admin", "super_admin", "works_manager"];
  if (!allowed.includes(user.role)) {
    return res.status(403).json({ error: "Works Manager or Admin access required" });
  }
  next();
}

// ─── OpenRouter / OpenAI client ─────────────────────────────────────────
import OpenAI from "openai";

const openai = process.env.OPENROUTER_API_KEY
  ? new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        "HTTP-Referer": process.env.OPENROUTER_REFERER || "https://truenorthos.co.uk",
        "X-Title": "TrueNorthOS",
      },
    })
  : null;

// ─── Helper: Clean JSON from AI response ────────────────────────────────
function cleanupJsonResponse(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\n?([\s\S]*?)```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return jsonMatch ? jsonMatch[0] : text;
}

// ─── Helper: Generate MinIO object key ──────────────────────────────────
function generateSnagKey(jobId: string, originalName: string): string {
  const uuid = crypto.randomUUID();
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${jobId}/${uuid}-${safeName}`;
}

// ─── Helper: Calculate RAG status deterministically ─────────────────────
function calculateRagStatus(snags: { priority: string }[]): "Green" | "Amber" | "Red" {
  if (!snags || snags.length === 0) return "Green";
  const hasHigh = snags.some((s) => s.priority === "High");
  if (hasHigh || snags.length >= 4) return "Red";
  return "Amber";
}

// ======================================================================
// PHASE 2: Image Upload Endpoint
// ======================================================================

/**
 * POST /api/jobs/:jobId/snag-upload
 * Upload one or more snag photos to MinIO.
 * Returns array of { key, presignedUrl } for each uploaded image.
 */
router.post(
  "/:jobId/snag-upload",
  requireAuth,
  upload.array("photos", 10),
  async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No images provided" });
      }

      // Verify job exists
      const jobResult = await pool.query("SELECT id FROM jobs WHERE id = $1", [jobId]);
      if (jobResult.rows.length === 0) {
        return res.status(404).json({ error: "Job not found" });
      }

      const uploaded: { key: string; presignedUrl: string; originalName: string }[] = [];

      for (const file of files) {
        const key = generateSnagKey(jobId, file.originalname);

        await uploadFile(
          BUCKETS.SNAGS,
          key,
          file.buffer,
          file.mimetype
        );

        const presignedUrl = await getPresignedDownloadUrl(BUCKETS.SNAGS, key);

        uploaded.push({
          key,
          presignedUrl,
          originalName: file.originalname,
        });
      }

      res.json({
        success: true,
        images: uploaded,
      });
    } catch (error: any) {
      console.error("[SnagScanner] Upload error:", error);
      res.status(500).json({ error: "Failed to upload snag images" });
    }
  }
);

// ======================================================================
// PHASE 3: AI Vision Analysis Endpoint
// ======================================================================

/**
 * POST /api/jobs/:jobId/snag-analyze
 * Accepts image keys from Phase 2, fetches from MinIO, sends to AI as base64.
 * Returns RAG status + detected snags, saves to DB.
 */
router.post("/:jobId/snag-analyze", requireAuth, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const user = (req as any).user;
    const { imageKeys } = req.body as { imageKeys: string[] };

    if (!imageKeys || imageKeys.length === 0) {
      return res.status(400).json({ error: "No image keys provided" });
    }

    if (!openai) {
      return res.status(503).json({ error: "AI service not configured (OPENROUTER_API_KEY missing)" });
    }

    // Verify job exists and get details
    const jobResult = await pool.query(
      "SELECT id, job_no, description, customer_name, address FROM jobs WHERE id = $1",
      [jobId]
    );
    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: "Job not found" });
    }
    const job = jobResult.rows[0];

    // Fetch images from MinIO and convert to base64
    const imageContents: { type: "image_url"; image_url: { url: string } }[] = [];

    for (const key of imageKeys) {
      try {
        const fileData = await getFile(BUCKETS.SNAGS, key);
        const base64 = fileData.body.toString("base64");
        const dataUrl = `data:${fileData.contentType};base64,${base64}`;
        imageContents.push({
          type: "image_url" as const,
          image_url: { url: dataUrl },
        });
      } catch (err) {
        console.warn(`[SnagScanner] Failed to fetch image ${key}:`, err);
      }
    }

    if (imageContents.length === 0) {
      return res.status(400).json({ error: "No valid images could be loaded from storage" });
    }

    // ─── AI Vision Analysis ──────────────────────────────────────────
    const systemPrompt = `You are an expert UK building quality inspector performing a pre-sign-off snagging inspection. Analyze the provided site photos for quality defects, incomplete work, or issues that need rectification before client sign-off.

You MUST respond with ONLY valid JSON in this exact schema:
{
  "snags_detected": boolean,
  "snags": [
    {
      "description": "Clear description of the defect or issue",
      "priority": "High" | "Medium" | "Low",
      "trade_category": "Category of trade responsible (e.g., Painting, Plumbing, Electrical, Joinery, Plastering, Tiling, General)"
    }
  ]
}

Guidelines:
- HIGH priority: Safety hazards, structural issues, water damage, electrical defects, regulatory non-compliance
- MEDIUM priority: Visible cosmetic defects, poor finish, gaps, uneven surfaces, minor damage
- LOW priority: Minor touch-ups, cleaning needed, very small cosmetic issues
- Be thorough but fair — only flag genuine quality issues
- Consider UK building standards and typical client expectations
- If the work looks complete and satisfactory, set snags_detected to false
- Return ONLY the JSON object, no markdown, no explanation`;

    const userMessage = `Inspect these ${imageContents.length} photo(s) from job ${job.job_no} (${job.description || "General works"}) at ${job.address || "site"}. Identify any snagging issues that should be rectified before client sign-off.`;

    const response = await openai.chat.completions.create({
      model: "openai/gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userMessage },
            ...imageContents,
          ],
        },
      ],
      temperature: 0.2,
    });

    const rawText = response.choices[0]?.message?.content || "";
    const jsonStr = cleanupJsonResponse(rawText);

    let aiResult: {
      snags_detected: boolean;
      snags: { description: string; priority: string; trade_category: string }[];
    };

    try {
      aiResult = JSON.parse(jsonStr);
    } catch {
      console.error("[SnagScanner] Failed to parse AI response:", rawText);
      return res.status(500).json({ error: "AI returned invalid response", rawResponse: rawText });
    }

    // ─── Deterministic RAG Calculation (NOT by AI) ───────────────────
    const ragStatus = aiResult.snags_detected
      ? calculateRagStatus(aiResult.snags)
      : "Green";

    const signoffLocked = ragStatus !== "Green";

    // ─── Save to Database ────────────────────────────────────────────
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Create snag_scan record
      const scanResult = await client.query(
        `INSERT INTO snag_scans (job_id, scanned_by_id, rag_status, image_count, raw_ai_response)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [jobId, user.id, ragStatus, imageKeys.length, JSON.stringify(aiResult)]
      );
      const scan = scanResult.rows[0];

      // 2. Create individual ai_snag_items
      const savedSnags: any[] = [];
      if (aiResult.snags && aiResult.snags.length > 0) {
        for (const snag of aiResult.snags) {
          const snagResult = await client.query(
            `INSERT INTO ai_snag_items (scan_id, job_id, image_url, description, priority, trade_category, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'Open')
             RETURNING *`,
            [
              scan.id,
              jobId,
              imageKeys[0] || null, // Associate with first image
              snag.description,
              snag.priority,
              snag.trade_category,
            ]
          );
          savedSnags.push(snagResult.rows[0]);
        }
      }

      // 3. Update job's rag_status and signoff_locked
      await client.query(
        `UPDATE jobs SET rag_status = $1, signoff_locked = $2, updated_at = NOW()
         WHERE id = $3`,
        [ragStatus, signoffLocked, jobId]
      );

      // 4. If rescan clears all snags, also clear any previous override
      if (ragStatus === "Green") {
        await client.query(
          `UPDATE jobs SET snag_override_by = NULL, snag_override_reason = NULL, snag_override_at = NULL
           WHERE id = $1`,
          [jobId]
        );
      }

      await client.query("COMMIT");

      res.json({
        success: true,
        scan: {
          id: scan.id,
          ragStatus,
          signoffLocked,
          imageCount: imageKeys.length,
          createdAt: scan.created_at,
        },
        snags: savedSnags,
        aiResponse: aiResult,
      });
    } catch (dbError) {
      await client.query("ROLLBACK");
      throw dbError;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("[SnagScanner] Analyze error:", error);
    res.status(500).json({ error: "Failed to analyze snag images" });
  }
});

// ======================================================================
// SCAN HISTORY
// ======================================================================

/**
 * GET /api/jobs/:jobId/snag-scans
 * Returns all scan history for a job, newest first.
 */
router.get("/:jobId/snag-scans", requireAuth, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const scansResult = await pool.query(
      `SELECT ss.*, u.name as scanned_by_name
       FROM snag_scans ss
       LEFT JOIN users u ON ss.scanned_by_id = u.id
       WHERE ss.job_id = $1
       ORDER BY ss.created_at DESC`,
      [jobId]
    );

    // For each scan, get its snag items
    const scansWithItems = await Promise.all(
      scansResult.rows.map(async (scan: any) => {
        const itemsResult = await pool.query(
          `SELECT * FROM ai_snag_items WHERE scan_id = $1 ORDER BY priority DESC, created_at ASC`,
          [scan.id]
        );
        return { ...scan, items: itemsResult.rows };
      })
    );

    res.json(scansWithItems);
  } catch (error: any) {
    console.error("[SnagScanner] Fetch scans error:", error);
    res.status(500).json({ error: "Failed to fetch snag scans" });
  }
});

// ======================================================================
// AMBER OVERRIDE (Tradesman)
// ======================================================================

/**
 * POST /api/jobs/:jobId/snag-override
 * Tradesman overrides an Amber status with mandatory explanation.
 * Unlocks signoff but preserves the audit trail.
 */
router.post("/:jobId/snag-override", requireAuth, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const user = (req as any).user;
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: "Override reason is mandatory" });
    }

    // Verify job exists and is Amber
    const jobResult = await pool.query(
      "SELECT id, rag_status FROM jobs WHERE id = $1",
      [jobId]
    );
    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: "Job not found" });
    }
    if (jobResult.rows[0].rag_status !== "Amber") {
      return res.status(400).json({ error: "Override is only allowed for Amber status jobs" });
    }

    // Update job: unlock signoff, record override
    await pool.query(
      `UPDATE jobs
       SET signoff_locked = false,
           snag_override_by = $1,
           snag_override_reason = $2,
           snag_override_at = NOW(),
           updated_at = NOW()
       WHERE id = $3`,
      [user.id, reason.trim(), jobId]
    );

    // Mark all open AI snag items for this job as Overridden
    await pool.query(
      `UPDATE ai_snag_items SET status = 'Overridden' WHERE job_id = $1 AND status = 'Open'`,
      [jobId]
    );

    res.json({ success: true, message: "Snag check overridden — sign-off unlocked" });
  } catch (error: any) {
    console.error("[SnagScanner] Override error:", error);
    res.status(500).json({ error: "Failed to override snag check" });
  }
});

// ======================================================================
// RED: SEND TO MANAGER
// ======================================================================

/**
 * POST /api/jobs/:jobId/snag-escalate
 * Tradesman escalates a Red job to the Works Manager for review.
 * Job remains locked.
 */
router.post("/:jobId/snag-escalate", requireAuth, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    // Verify job exists and is Red
    const jobResult = await pool.query(
      "SELECT id, rag_status FROM jobs WHERE id = $1",
      [jobId]
    );
    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Nothing to change DB-wise — Red already keeps signoff_locked = true.
    // This endpoint is mainly for the frontend flow and could trigger notifications.
    // Future: Send notification to works manager

    res.json({ success: true, message: "Job escalated to manager for review" });
  } catch (error: any) {
    console.error("[SnagScanner] Escalate error:", error);
    res.status(500).json({ error: "Failed to escalate job" });
  }
});

// ======================================================================
// PHASE 5: WORKS MANAGER / ADMIN — Snag Review Queue
// ======================================================================

/**
 * GET /api/snag-review-queue
 * Returns all jobs that are Amber (Overridden) or Red (Locked)
 * for manager review.
 */
router.get("/snag-review-queue", requireManagerOrAdmin, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        j.id, j.job_no, j.customer_name, j.address, j.status,
        j.rag_status, j.signoff_locked,
        j.snag_override_by, j.snag_override_reason, j.snag_override_at,
        u_override.name as override_by_name,
        u_assigned.name as assigned_to_name,
        (
          SELECT json_agg(json_build_object(
            'id', ss.id, 'rag_status', ss.rag_status,
            'image_count', ss.image_count, 'created_at', ss.created_at,
            'scanned_by_name', u_scan.name
          ) ORDER BY ss.created_at DESC)
          FROM snag_scans ss
          LEFT JOIN users u_scan ON ss.scanned_by_id = u_scan.id
          WHERE ss.job_id = j.id
        ) as scans,
        (
          SELECT json_agg(json_build_object(
            'id', asi.id, 'description', asi.description,
            'priority', asi.priority, 'trade_category', asi.trade_category,
            'status', asi.status, 'image_url', asi.image_url
          ) ORDER BY
            CASE asi.priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END,
            asi.created_at ASC
          )
          FROM ai_snag_items asi
          WHERE asi.job_id = j.id
        ) as snag_items
      FROM jobs j
      LEFT JOIN users u_override ON j.snag_override_by = u_override.id
      LEFT JOIN users u_assigned ON j.assigned_to_id = u_assigned.id
      WHERE (
        (j.rag_status = 'Red' AND j.signoff_locked = true)
        OR (j.rag_status = 'Amber' AND j.snag_override_at IS NOT NULL)
      )
      ORDER BY
        CASE j.rag_status WHEN 'Red' THEN 1 ELSE 2 END,
        j.updated_at DESC
    `);

    res.json(result.rows);
  } catch (error: any) {
    console.error("[SnagScanner] Review queue error:", error);
    res.status(500).json({ error: "Failed to fetch snag review queue" });
  }
});

/**
 * POST /api/jobs/:jobId/snag-manager-unlock
 * Manager manually unlocks a Red job for sign-off.
 */
router.post(
  "/:jobId/snag-manager-unlock",
  requireManagerOrAdmin,
  async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const user = (req as any).user;
      const { reason } = req.body;

      await pool.query(
        `UPDATE jobs
         SET signoff_locked = false,
             snag_override_by = $1,
             snag_override_reason = $2,
             snag_override_at = NOW(),
             updated_at = NOW()
         WHERE id = $3`,
        [user.id, reason || "Manager approved for sign-off", jobId]
      );

      res.json({ success: true, message: "Job unlocked for sign-off by manager" });
    } catch (error: any) {
      console.error("[SnagScanner] Manager unlock error:", error);
      res.status(500).json({ error: "Failed to unlock job" });
    }
  }
);

/**
 * POST /api/jobs/:jobId/snag-return-to-tradesman
 * Manager returns a Red job to the tradesman for rectification.
 */
router.post(
  "/:jobId/snag-return-to-tradesman",
  requireManagerOrAdmin,
  async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const { notes } = req.body;

      // Reset job status to In Progress for rework
      await pool.query(
        `UPDATE jobs
         SET status = 'In Progress',
             rag_status = 'Red',
             signoff_locked = true,
             updated_at = NOW()
         WHERE id = $1`,
        [jobId]
      );

      res.json({ success: true, message: "Job returned to tradesman for rectification" });
    } catch (error: any) {
      console.error("[SnagScanner] Return to tradesman error:", error);
      res.status(500).json({ error: "Failed to return job" });
    }
  }
);

/**
 * GET /api/jobs/:jobId/snag-images/:key(*)
 * Proxy endpoint to get a fresh presigned URL for a snag image.  
 * Used by admin UI to display uploaded photos.
 */
router.get("/:jobId/snag-images/*", requireAuth, async (req: Request, res: Response) => {
  try {
    // Extract the key from the wildcard path (everything after /snag-images/)
    const key = req.params[0];
    const presignedUrl = await getPresignedDownloadUrl(BUCKETS.SNAGS, key);
    res.json({ presignedUrl });
  } catch (error: any) {
    console.error("[SnagScanner] Image URL error:", error);
    res.status(500).json({ error: "Failed to get image URL" });
  }
});

export default router;
