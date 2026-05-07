import { Router, Request, Response } from "express";
import { pool } from "./db";
import { notifyAdmins } from "./notifications";

const router = Router();

// === ACCESS CONTROL ===
function requireJobAccess(req: Request, res: Response, next: any) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const allowedRoles = ['admin', 'super_admin', 'works_manager', 'engineer'];
  if (!allowedRoles.includes(user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
}

router.use(requireJobAccess);

// === GET PHASES FOR A JOB ===
router.get('/:jobId/phases', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const result = await pool.query(`
      SELECT jp.*,
        u.name as assigned_to_name,
        dep.title as depends_on_title,
        dep.status as depends_on_status
      FROM job_phases jp
      LEFT JOIN users u ON jp.assigned_to = u.id
      LEFT JOIN job_phases dep ON jp.depends_on = dep.id
      WHERE jp.job_id = $1
      ORDER BY jp.phase_number ASC
    `, [jobId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching phases:', error);
    res.status(500).json({ error: 'Failed to fetch phases' });
  }
});

// === CREATE PHASE ===
router.post('/:jobId/phases', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const { title, description, trade_type, assigned_to, estimated_duration, depends_on, scheduled_date, phase_number } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Get next phase number if not provided
    let phaseNum = phase_number;
    if (!phaseNum) {
      const countResult = await pool.query('SELECT COALESCE(MAX(phase_number), 0) + 1 as next FROM job_phases WHERE job_id = $1', [jobId]);
      phaseNum = countResult.rows[0].next;
    }

    const result = await pool.query(`
      INSERT INTO job_phases (job_id, phase_number, title, description, trade_type, assigned_to, estimated_duration, depends_on, scheduled_date, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      jobId, phaseNum, title, description || null, trade_type || null,
      assigned_to || null, estimated_duration || null, depends_on || null,
      scheduled_date || null, depends_on ? 'pending' : 'ready'
    ]);

    // Mark job as complex if it now has multiple phases
    const phaseCount = await pool.query('SELECT COUNT(*)::integer as count FROM job_phases WHERE job_id = $1', [jobId]);
    if (parseInt(phaseCount.rows[0].count) > 1) {
      await pool.query('UPDATE jobs SET is_complex = true WHERE id = $1', [jobId]);
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating phase:', error);
    res.status(500).json({ error: 'Failed to create phase' });
  }
});

// === UPDATE PHASE ===
router.patch('/:jobId/phases/:phaseId', async (req: Request, res: Response) => {
  try {
    const { jobId, phaseId } = req.params;
    const allowedFields = ['title', 'description', 'trade_type', 'assigned_to', 'status', 'estimated_duration', 'depends_on', 'scheduled_date', 'sign_off_notes', 'phase_number'];

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        values.push(req.body[field]);
      }
    }

    // Handle status transitions with timestamps
    if (req.body.status === 'in_progress' && !req.body.started_at) {
      updates.push(`started_at = NOW()`);
    }
    if (req.body.status === 'complete' && !req.body.completed_at) {
      updates.push(`completed_at = NOW()`);
    }

    updates.push(`updated_at = NOW()`);

    if (updates.length <= 1) { // only updated_at
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(phaseId, jobId);
    const result = await pool.query(`
      UPDATE job_phases SET ${updates.join(', ')} WHERE id = $${paramIndex} AND job_id = $${paramIndex + 1} RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Phase not found' });
    }

    const updatedPhase = result.rows[0];

    // === DEPENDENCY TRIGGER: If phase completed, trigger dependent phases ===
    if (req.body.status === 'complete') {
      // Find phases that depend on this one
      const dependentPhases = await pool.query(
        `SELECT id FROM job_phases WHERE depends_on = $1 AND status = 'pending'`,
        [phaseId]
      );

      // Set them to 'ready'
      for (const dep of dependentPhases.rows) {
        await pool.query(
          `UPDATE job_phases SET status = 'ready', updated_at = NOW() WHERE id = $1`,
          [dep.id]
        );
      }

      // Check if ALL phases are complete → update job status
      const allPhases = await pool.query(
        `SELECT COUNT(*)::integer as total, COUNT(*) FILTER (WHERE status = 'complete' OR status = 'skipped')::integer as done FROM job_phases WHERE job_id = $1`,
        [jobId]
      );

      if (allPhases.rows[0].total > 0 && allPhases.rows[0].total === allPhases.rows[0].done) {
        // All phases complete → job ready for sign-off
        await pool.query(
          `UPDATE jobs SET status = 'Completed' WHERE id = $1`,
          [jobId]
        );

        // Notify works manager for snag inspection
        notifyAdmins({
          type: 'job_phases_complete',
          title: 'Job Ready for Sign-Off',
          message: `All phases complete for job #${jobId}. Works Manager snag inspection required.`,
          category: 'jobs',
          timestamp: new Date().toISOString(),
          linkUrl: `/app/jobs/${jobId}`,
        });
      }
    }

    res.json(updatedPhase);
  } catch (error) {
    console.error('Error updating phase:', error);
    res.status(500).json({ error: 'Failed to update phase' });
  }
});

// === DELETE PHASE ===
router.delete('/:jobId/phases/:phaseId', async (req: Request, res: Response) => {
  try {
    const { jobId, phaseId } = req.params;

    // Check if other phases depend on this one
    const deps = await pool.query('SELECT id FROM job_phases WHERE depends_on = $1', [phaseId]);
    if (deps.rows.length > 0) {
      return res.status(400).json({ error: 'Cannot delete phase with dependencies. Remove dependent phases first.' });
    }

    const result = await pool.query('DELETE FROM job_phases WHERE id = $1 AND job_id = $2 RETURNING id', [phaseId, jobId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Phase not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting phase:', error);
    res.status(500).json({ error: 'Failed to delete phase' });
  }
});

// === VARIATION ORDERS ===

// Get variation orders for a job
router.get('/:jobId/variations', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const result = await pool.query(
      'SELECT * FROM variation_orders WHERE job_id = $1 ORDER BY created_at DESC',
      [jobId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching variations:', error);
    res.status(500).json({ error: 'Failed to fetch variation orders' });
  }
});

// Create variation order
router.post('/:jobId/variations', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const { description, reason, additional_cost } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }

    const result = await pool.query(`
      INSERT INTO variation_orders (job_id, description, reason, additional_cost, status)
      VALUES ($1, $2, $3, $4, 'proposed')
      RETURNING *
    `, [jobId, description, reason || null, additional_cost || 0]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating variation:', error);
    res.status(500).json({ error: 'Failed to create variation order' });
  }
});

// Approve/reject variation order
router.patch('/:jobId/variations/:variationId', async (req: Request, res: Response) => {
  try {
    const { jobId, variationId } = req.params;
    const { status, approved_by } = req.body;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved or rejected' });
    }

    const updates = status === 'approved'
      ? `status = 'approved', approved_by = $1, approved_at = NOW()`
      : `status = 'rejected'`;

    const values = status === 'approved'
      ? [approved_by || 'Customer', variationId, jobId]
      : [variationId, jobId];

    const query = status === 'approved'
      ? `UPDATE variation_orders SET ${updates} WHERE id = $2 AND job_id = $3 RETURNING *`
      : `UPDATE variation_orders SET ${updates} WHERE id = $1 AND job_id = $2 RETURNING *`;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Variation order not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating variation:', error);
    res.status(500).json({ error: 'Failed to update variation order' });
  }
});

export default router;
