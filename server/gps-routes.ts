import { Router, Request, Response } from "express";
import { pool } from "./db";

const router = Router();

/**
 * POST /api/gps/log
 * Log engineer GPS location (on job start/complete)
 */
router.post('/log', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { latitude, longitude, accuracy, jobId, action } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude required' });
    }

    const client = await pool.connect();
    try {
      // Update user's current location
      await client.query(
        `UPDATE users SET current_lat = $1, current_lng = $2, last_location_update = now() WHERE id = $3`,
        [latitude, longitude, (req.user as any).id]
      );

      // Log the GPS point for audit trail
      await client.query(
        `INSERT INTO gps_logs (user_id, latitude, longitude, accuracy, job_id, action, logged_at)
         VALUES ($1, $2, $3, $4, $5, $6, now())`,
        [(req.user as any).id, latitude, longitude, accuracy || null, jobId || null, action || 'check-in']
      );

      res.json({ success: true });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('GPS log error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/gps/history/:userId
 * Get GPS history for an engineer (admin only)
 */
router.get('/history/:userId', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { userId } = req.params;
    const { date } = req.query;

    const client = await pool.connect();
    try {
      let query = `SELECT * FROM gps_logs WHERE user_id = $1`;
      const params: any[] = [userId];

      if (date) {
        query += ` AND DATE(logged_at) = $2`;
        params.push(date);
      }

      query += ` ORDER BY logged_at DESC LIMIT 100`;

      const result = await client.query(query, params);
      res.json(result.rows);
    } finally {
      client.release();
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/gps/walkaround-status
 * Check if engineer has completed walkaround today
 */
router.get('/walkaround-status', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT id, completed_at FROM walkaround_checks 
         WHERE user_id = $1 AND DATE(completed_at) = CURRENT_DATE
         ORDER BY completed_at DESC LIMIT 1`,
        [(req.user as any).id]
      );

      res.json({
        completedToday: result.rows.length > 0,
        lastCheck: result.rows[0] || null,
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/gps/walkaround-complete
 * Record walkaround completion
 */
router.post('/walkaround-complete', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { checks, defects, vehicleSafe, latitude, longitude } = req.body;

    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO walkaround_checks (user_id, checks, defects, vehicle_safe, latitude, longitude, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, now())`,
        [(req.user as any).id, JSON.stringify(checks), JSON.stringify(defects || []), vehicleSafe, latitude || null, longitude || null]
      );

      res.json({ success: true });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Walkaround complete error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
