import { Router, Request, Response } from "express";
import { pool } from "./db";
import { geocodeAddress, getDistanceMatrix } from "./geocoding";

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



/**
 * GET /api/gps/live-positions
 * Get all engineers' latest GPS positions (admin only)
 */
router.get('/live-positions', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT DISTINCT ON (g.user_id)
          g.user_id,
          g.latitude,
          g.longitude,
          g.accuracy,
          g.action,
          g.job_id,
          g.logged_at,
          u.username as name,
          u.full_name,
          CASE
            WHEN g.logged_at > now() - interval '5 minutes' THEN 'active'
            WHEN g.logged_at > now() - interval '30 minutes' THEN 'idle'
            ELSE 'offline'
          END as status
        FROM gps_logs g
        JOIN users u ON u.id = g.user_id
        WHERE u.role = 'engineer'
        ORDER BY g.user_id, g.logged_at DESC
      `);
      res.json(result.rows);
    } finally {
      client.release();
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/gps/trail/:userId
 * Get GPS trail for an engineer today (route visualization)
 */
router.get('/trail/:userId', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { userId } = req.params;

    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT latitude, longitude, action, job_id, logged_at
        FROM gps_logs
        WHERE user_id = $1 AND DATE(logged_at) = CURRENT_DATE
        ORDER BY logged_at ASC
      `, [userId]);
      res.json(result.rows);
    } finally {
      client.release();
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/gps/stats
 * Live map dashboard stats
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const client = await pool.connect();
    try {
      // Engineers with GPS today
      const activeEngineers = await client.query(`
        SELECT COUNT(DISTINCT user_id) as count
        FROM gps_logs
        WHERE DATE(logged_at) = CURRENT_DATE
        AND logged_at > now() - interval '30 minutes'
      `);

      // Total engineers
      const totalEngineers = await client.query(`
        SELECT COUNT(*) as count FROM users WHERE role = 'engineer'
      `);

      // Jobs completed today
      const jobsCompleted = await client.query(`
        SELECT COUNT(*) as count FROM jobs
        WHERE status IN ('Signed Off', 'Awaiting Signatures')
        AND DATE(COALESCE(completed_at, updated_at)) = CURRENT_DATE
      `);

      // Total jobs today
      const jobsToday = await client.query(`
        SELECT COUNT(*) as count FROM jobs
        WHERE DATE(scheduled_date) = CURRENT_DATE
      `);

      // Walkarounds completed today
      const walkarounds = await client.query(`
        SELECT COUNT(*) as count FROM walkaround_checks
        WHERE DATE(completed_at) = CURRENT_DATE
      `);

      res.json({
        engineersActive: parseInt(activeEngineers.rows[0]?.count || '0'),
        engineersTotal: parseInt(totalEngineers.rows[0]?.count || '0'),
        jobsCompleted: parseInt(jobsCompleted.rows[0]?.count || '0'),
        jobsToday: parseInt(jobsToday.rows[0]?.count || '0'),
        walkaroundsCompleted: parseInt(walkarounds.rows[0]?.count || '0'),
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/gps/geofence-check
 * Check if engineer is within geofence radius of job site
 */
router.post('/geofence-check', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { latitude, longitude, jobId, radiusMetres = 100 } = req.body;

    const client = await pool.connect();
    try {
      // Get job location (if it has coordinates)
      const jobResult = await client.query(
        `SELECT site_lat, site_lng, site_address FROM jobs WHERE id = $1`,
        [jobId]
      );

      if (!jobResult.rows[0]?.site_lat) {
        return res.json({ withinGeofence: null, message: 'Job has no coordinates' });
      }

      const jobLat = jobResult.rows[0].site_lat;
      const jobLng = jobResult.rows[0].site_lng;

      // Haversine distance calculation
      const R = 6371e3; // Earth radius in metres
      const lat1 = latitude * Math.PI / 180;
      const lat2 = jobLat * Math.PI / 180;
      const dLat = (jobLat - latitude) * Math.PI / 180;
      const dLng = (jobLng - longitude) * Math.PI / 180;

      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1) * Math.cos(lat2) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;

      res.json({
        withinGeofence: distance <= radiusMetres,
        distanceMetres: Math.round(distance),
        radiusMetres,
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});



/**
 * POST /api/gps/geocode-job
 * Geocode a single job address and store coordinates
 */
router.post('/geocode-job', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { jobId } = req.body;
    const client = await pool.connect();
    try {
      const jobResult = await client.query(
        `SELECT id, site_address, address FROM jobs WHERE id = $1`, [jobId]
      );
      if (!jobResult.rows[0]) {
        return res.status(404).json({ error: 'Job not found' });
      }

      const address = jobResult.rows[0].site_address || jobResult.rows[0].address;
      if (!address) {
        return res.json({ success: false, message: 'No address to geocode' });
      }

      const result = await geocodeAddress(address);
      if (result) {
        await client.query(
          `UPDATE jobs SET site_lat = $1, site_lng = $2 WHERE id = $3`,
          [result.lat, result.lng, jobId]
        );
        return res.json({ success: true, lat: result.lat, lng: result.lng, formattedAddress: result.formattedAddress });
      }

      res.json({ success: false, message: 'Geocoding returned no results' });
    } finally {
      client.release();
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/gps/geocode-all-jobs
 * Batch geocode all jobs without coordinates (admin only)
 */
router.post('/geocode-all-jobs', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const client = await pool.connect();
    try {
      // Find jobs without coordinates that have addresses
      const jobsResult = await client.query(`
        SELECT id, site_address, address FROM jobs
        WHERE site_lat IS NULL
        AND (site_address IS NOT NULL AND site_address != '' OR address IS NOT NULL AND address != '')
        LIMIT 50
      `);

      let geocoded = 0;
      let failed = 0;

      for (const job of jobsResult.rows) {
        const address = job.site_address || job.address;
        if (!address) { failed++; continue; }

        const result = await geocodeAddress(address);
        if (result) {
          await client.query(
            `UPDATE jobs SET site_lat = $1, site_lng = $2 WHERE id = $3`,
            [result.lat, result.lng, job.id]
          );
          geocoded++;
        } else {
          failed++;
        }

        // Rate limit: 50ms between requests
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      res.json({
        success: true,
        total: jobsResult.rows.length,
        geocoded,
        failed,
        message: `Geocoded ${geocoded}/${jobsResult.rows.length} jobs`,
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/gps/distance
 * Get distance/ETA from engineer to job site
 */
router.post('/distance', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { engineerLat, engineerLng, destinations } = req.body;

    if (!engineerLat || !engineerLng || !destinations?.length) {
      return res.status(400).json({ error: 'Missing origin or destinations' });
    }

    const result = await getDistanceMatrix(
      { lat: engineerLat, lng: engineerLng },
      destinations
    );

    if (result) {
      res.json({ success: true, distances: result });
    } else {
      res.json({ success: false, message: 'Distance calculation failed' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
