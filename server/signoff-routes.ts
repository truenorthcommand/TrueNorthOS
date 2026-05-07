import { Router, Request, Response } from "express";
import { pool } from "./db";

const router = Router();

// === ACCESS CONTROL ===
function requireAuth(req: Request, res: Response, next: any) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

function requireManagerOrAdmin(req: Request, res: Response, next: any) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const allowedRoles = ['admin', 'super_admin', 'works_manager'];
  if (!allowedRoles.includes(user.role)) {
    return res.status(403).json({ error: 'Works Manager or Admin access required' });
  }
  next();
}

// ==============================
// SNAG LIST ENDPOINTS
// ==============================

// Get snag items for a job
router.get('/:jobId/snags', requireAuth, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const result = await pool.query(`
      SELECT si.*,
        u1.name as assigned_to_name,
        u2.name as reported_by_name
      FROM snag_items si
      LEFT JOIN users u1 ON si.assigned_to = u1.id
      LEFT JOIN users u2 ON si.reported_by = u2.id
      WHERE si.job_id = $1
      ORDER BY si.created_at DESC
    `, [jobId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching snags:', error);
    res.status(500).json({ error: 'Failed to fetch snag items' });
  }
});

// Create snag item
router.post('/:jobId/snags', requireAuth, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const user = (req as any).user;
    const { description, location, severity, assigned_to, photo_url } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }

    const result = await pool.query(`
      INSERT INTO snag_items (job_id, description, location, severity, assigned_to, photo_url, reported_by, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'open')
      RETURNING *
    `, [
      jobId, description, location || null, severity || 'minor',
      assigned_to || null, photo_url || null, user.id
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating snag:', error);
    res.status(500).json({ error: 'Failed to create snag item' });
  }
});

// Update snag item (resolve, reassign, etc.)
router.patch('/:jobId/snags/:snagId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { jobId, snagId } = req.params;
    const { status, resolution_notes, assigned_to, severity } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (status !== undefined) {
      updates.push(`status = $${idx++}`);
      values.push(status);
      if (status === 'resolved') {
        updates.push(`resolved_at = NOW()`);
      }
    }
    if (resolution_notes !== undefined) {
      updates.push(`resolution_notes = $${idx++}`);
      values.push(resolution_notes);
    }
    if (assigned_to !== undefined) {
      updates.push(`assigned_to = $${idx++}`);
      values.push(assigned_to);
    }
    if (severity !== undefined) {
      updates.push(`severity = $${idx++}`);
      values.push(severity);
    }

    updates.push(`updated_at = NOW()`);

    values.push(snagId, jobId);
    const result = await pool.query(
      `UPDATE snag_items SET ${updates.join(', ')} WHERE id = $${idx} AND job_id = $${idx + 1} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Snag item not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating snag:', error);
    res.status(500).json({ error: 'Failed to update snag item' });
  }
});

// Delete snag item
router.delete('/:jobId/snags/:snagId', requireManagerOrAdmin, async (req: Request, res: Response) => {
  try {
    const { jobId, snagId } = req.params;
    const result = await pool.query(
      'DELETE FROM snag_items WHERE id = $1 AND job_id = $2 RETURNING id',
      [snagId, jobId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Snag item not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting snag:', error);
    res.status(500).json({ error: 'Failed to delete snag item' });
  }
});

// ==============================
// SIGN-OFF ENDPOINTS
// ==============================

// Get sign-offs for a job
router.get('/:jobId/signoffs', requireAuth, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const result = await pool.query(`
      SELECT js.*, u.name as signed_off_by_name
      FROM job_signoffs js
      LEFT JOIN users u ON js.signed_off_by = u.id
      WHERE js.job_id = $1
      ORDER BY js.created_at DESC
    `, [jobId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching signoffs:', error);
    res.status(500).json({ error: 'Failed to fetch sign-offs' });
  }
});

// Create final sign-off (Works Manager approves the completed job)
router.post('/:jobId/signoffs', requireManagerOrAdmin, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const user = (req as any).user;
    const { sign_off_type, notes, customer_satisfied, quality_rating } = req.body;

    // Check all snags are resolved before final sign-off
    if (sign_off_type === 'final') {
      const openSnags = await pool.query(
        `SELECT COUNT(*)::integer as count FROM snag_items WHERE job_id = $1 AND status NOT IN ('resolved', 'accepted')`,
        [jobId]
      );
      if (openSnags.rows[0].count > 0) {
        return res.status(400).json({
          error: 'Cannot sign off with open snag items',
          open_snags: openSnags.rows[0].count
        });
      }
    }

    const result = await pool.query(`
      INSERT INTO job_signoffs (job_id, signed_off_by, sign_off_type, status, notes, customer_satisfied, quality_rating, approved_at)
      VALUES ($1, $2, $3, 'approved', $4, $5, $6, NOW())
      RETURNING *
    `, [
      jobId, user.id, sign_off_type || 'final',
      notes || null, customer_satisfied ?? null, quality_rating || null
    ]);

    // === TRIGGER: Final sign-off → Update job status + Create invoice ===
    if (sign_off_type === 'final') {
      // Update job status to 'Signed Off'
      await pool.query(
        `UPDATE jobs SET status = 'Signed Off' WHERE id = $1`,
        [jobId]
      );

      // === AUTO-CREATE INVOICE ===
      try {
        // Get job details for invoice
        const jobResult = await pool.query(
          `SELECT j.*, q.total as quote_total, q."lineItems" as quote_line_items, q."customerName", q."customerEmail", q."siteAddress"
           FROM jobs j
           LEFT JOIN quotes q ON j.quote_id = q.id
           WHERE j.id = $1`,
          [jobId]
        );

        const job = jobResult.rows[0];
        if (job) {
          // Check for variation orders to add to total
          const variations = await pool.query(
            `SELECT COALESCE(SUM(additional_cost), 0)::numeric as total FROM variation_orders WHERE job_id = $1 AND status = 'approved'`,
            [jobId]
          );

          const variationTotal = parseFloat(variations.rows[0].total) || 0;
          const quoteTotal = parseFloat(job.quote_total) || 0;
          const invoiceTotal = quoteTotal + variationTotal;

          // Create invoice
          const invoiceCount = await pool.query('SELECT COUNT(*)::integer as count FROM invoices');
          const invoiceNum = (invoiceCount.rows[0].count || 0) + 1;
          const invoiceNo = `INV-${new Date().getFullYear()}-${String(invoiceNum).padStart(4, '0')}`;

          await pool.query(`
            INSERT INTO invoices (invoice_no, job_id, customer_name, customer_email, site_address, subtotal, vat, total, status, line_items, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9, NOW())
          `, [
            invoiceNo,
            jobId,
            job.customerName || job.customer_name || 'Customer',
            job.customerEmail || job.customer_email || null,
            job.siteAddress || job.site_address || job.address || null,
            invoiceTotal,
            invoiceTotal * 0.2, // VAT at 20%
            invoiceTotal * 1.2, // Total with VAT
            job.quote_line_items || '[]'
          ]);
        }
      } catch (invoiceErr) {
        console.error('Failed to auto-create invoice:', invoiceErr);
        // Don't fail the sign-off if invoice creation fails
      }
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating signoff:', error);
    res.status(500).json({ error: 'Failed to create sign-off' });
  }
});

// Reject sign-off (send back for more work)
router.post('/:jobId/signoffs/reject', requireManagerOrAdmin, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const user = (req as any).user;
    const { rejection_reason, notes } = req.body;

    if (!rejection_reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    // Create rejected sign-off record
    const result = await pool.query(`
      INSERT INTO job_signoffs (job_id, signed_off_by, sign_off_type, status, notes, rejection_reason)
      VALUES ($1, $2, 'final', 'rejected', $3, $4)
      RETURNING *
    `, [jobId, user.id, notes || null, rejection_reason]);

    // Revert job status to 'In Progress' for rework
    await pool.query(
      `UPDATE jobs SET status = 'In Progress' WHERE id = $1`,
      [jobId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error rejecting signoff:', error);
    res.status(500).json({ error: 'Failed to reject sign-off' });
  }
});

// Get sign-off readiness status
router.get('/:jobId/signoff-status', requireAuth, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    // Check job status
    const jobResult = await pool.query('SELECT status, is_complex FROM jobs WHERE id = $1', [jobId]);
    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    const job = jobResult.rows[0];

    // Check phases (for complex jobs)
    const phasesResult = await pool.query(`
      SELECT COUNT(*)::integer as total,
        COUNT(*) FILTER (WHERE status = 'complete' OR status = 'skipped')::integer as completed
      FROM job_phases WHERE job_id = $1
    `, [jobId]);
    const phases = phasesResult.rows[0];

    // Check snags
    const snagsResult = await pool.query(`
      SELECT COUNT(*)::integer as total,
        COUNT(*) FILTER (WHERE status = 'open')::integer as open,
        COUNT(*) FILTER (WHERE status = 'resolved' OR status = 'accepted')::integer as resolved
      FROM snag_items WHERE job_id = $1
    `, [jobId]);
    const snags = snagsResult.rows[0];

    // Check existing sign-offs
    const signoffResult = await pool.query(`
      SELECT * FROM job_signoffs WHERE job_id = $1 AND status = 'approved' AND sign_off_type = 'final' LIMIT 1
    `, [jobId]);

    const isReadyForSignoff = (
      (job.status === 'Completed' || job.status === 'Awaiting Signatures') &&
      (phases.total === 0 || phases.total === phases.completed) &&
      snags.open === 0
    );

    res.json({
      job_status: job.status,
      is_complex: job.is_complex,
      phases: { total: phases.total, completed: phases.completed, all_done: phases.total === 0 || phases.total === phases.completed },
      snags: { total: snags.total, open: snags.open, resolved: snags.resolved, all_clear: snags.open === 0 },
      has_final_signoff: signoffResult.rows.length > 0,
      is_ready_for_signoff: isReadyForSignoff,
    });
  } catch (error) {
    console.error('Error checking signoff status:', error);
    res.status(500).json({ error: 'Failed to check sign-off status' });
  }
});

export default router;
