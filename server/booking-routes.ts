import { Router, Request, Response } from "express";
import { pool } from "./db";
import { calculateDistance } from "./geocoding";

const router = Router();

// === ACCESS CONTROL ===
function requireBookingAccess(req: Request, res: Response, next: any) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

function requireAdmin(req: Request, res: Response, next: any) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const adminRoles = ['admin', 'super_admin', 'works_manager'];
  if (!adminRoles.includes(user.role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

router.use(requireBookingAccess);

// === HELPER: Estimate travel time between two points ===
function estimateTravelMins(
  fromLat: number | null, fromLng: number | null,
  toLat: number | null, toLng: number | null
): number {
  const DEFAULT_TRAVEL_MINS = 20;

  if (!fromLat || !fromLng || !toLat || !toLng) {
    return DEFAULT_TRAVEL_MINS;
  }

  // Calculate distance in metres using Haversine
  const distanceMetres = calculateDistance(fromLat, fromLng, toLat, toLng);
  const distanceMiles = distanceMetres / 1609.34;

  // Estimate at 30mph average (UK urban/suburban driving)
  const AVG_SPEED_MPH = 30;
  const travelMins = Math.round((distanceMiles / AVG_SPEED_MPH) * 60);

  // Minimum 5 mins, maximum 120 mins
  return Math.max(5, Math.min(120, travelMins));
}

// === GET / - List bookings with filters ===
router.get('/', async (req: Request, res: Response) => {
  try {
    const { date_from, date_to, assigned_to, status, booking_type, assigned_role } = req.query;

    let query = `
      SELECT b.*,
        u.name as assigned_to_name,
        u.email as assigned_to_email,
        c.name as client_name,
        c.phone as client_phone
      FROM bookings b
      LEFT JOIN users u ON b.assigned_to = u.id
      LEFT JOIN users c ON b.client_id = c.id
    `;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (date_from) {
      conditions.push(`b.scheduled_date >= $${paramIndex++}`);
      params.push(date_from);
    } else {
      // Default: upcoming bookings from today
      conditions.push(`b.scheduled_date >= CURRENT_DATE`);
    }

    if (date_to) {
      conditions.push(`b.scheduled_date <= $${paramIndex++}`);
      params.push(date_to);
    }

    if (assigned_to) {
      conditions.push(`b.assigned_to = $${paramIndex++}`);
      params.push(assigned_to);
    }

    if (status) {
      conditions.push(`b.status = $${paramIndex++}`);
      params.push(status);
    }

    if (booking_type) {
      conditions.push(`b.booking_type = $${paramIndex++}`);
      params.push(booking_type);
    }

    if (assigned_role) {
      conditions.push(`b.assigned_role = $${paramIndex++}`);
      params.push(assigned_role);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY b.scheduled_date ASC, b.scheduled_time_start ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// === GET /calendar - Calendar-optimized view ===
router.get('/calendar', async (req: Request, res: Response) => {
  try {
    const { start, end, user_id } = req.query;

    if (!start || !end) {
      return res.status(400).json({ error: 'start and end date parameters are required' });
    }

    let query = `
      SELECT
        b.id,
        b.booking_type,
        b.assigned_to,
        b.assigned_role,
        b.scheduled_date,
        b.scheduled_time_start,
        b.scheduled_time_end,
        b.estimated_duration_mins,
        b.travel_time_mins,
        b.status,
        b.priority,
        b.address,
        b.postcode,
        b.calendar_color,
        b.linked_entity_type,
        b.linked_entity_id,
        u.name as assigned_to_name,
        c.name as client_name
      FROM bookings b
      LEFT JOIN users u ON b.assigned_to = u.id
      LEFT JOIN users c ON b.client_id = c.id
      WHERE b.scheduled_date >= $1 AND b.scheduled_date <= $2
        AND b.status != 'cancelled'
    `;

    const params: any[] = [start, end];
    let paramIndex = 3;

    if (user_id) {
      query += ` AND b.assigned_to = $${paramIndex++}`;
      params.push(user_id);
    }

    query += ' ORDER BY b.assigned_to, b.scheduled_date ASC, b.scheduled_time_start ASC';

    const result = await pool.query(query, params);

    // Group by assigned_to for resource planner view
    const grouped: Record<string, any> = {};
    for (const row of result.rows) {
      const key = row.assigned_to || 'unassigned';
      if (!grouped[key]) {
        grouped[key] = {
          user_id: row.assigned_to,
          user_name: row.assigned_to_name || 'Unassigned',
          bookings: []
        };
      }
      grouped[key].bookings.push(row);
    }

    res.json({
      bookings: result.rows,
      by_resource: Object.values(grouped)
    });
  } catch (error) {
    console.error('Error fetching calendar bookings:', error);
    res.status(500).json({ error: 'Failed to fetch calendar data' });
  }
});

// === GET /user/:userId - Bookings for specific user ===
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { date_from, include_past } = req.query;

    let query = `
      SELECT b.*,
        u.name as assigned_to_name,
        c.name as client_name,
        c.phone as client_phone
      FROM bookings b
      LEFT JOIN users u ON b.assigned_to = u.id
      LEFT JOIN users c ON b.client_id = c.id
      WHERE b.assigned_to = $1
    `;

    const params: any[] = [userId];
    let paramIndex = 2;

    if (!include_past) {
      if (date_from) {
        query += ` AND b.scheduled_date >= $${paramIndex++}`;
        params.push(date_from);
      } else {
        query += ` AND b.scheduled_date >= CURRENT_DATE`;
      }
    }

    query += ' ORDER BY b.scheduled_date ASC, b.scheduled_time_start ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user bookings:', error);
    res.status(500).json({ error: 'Failed to fetch user bookings' });
  }
});

// === GET /:id - Single booking detail ===
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT b.*,
        u.name as assigned_to_name,
        u.email as assigned_to_email,
        u.phone as assigned_to_phone,
        c.name as client_name,
        c.email as client_email,
        c.phone as client_phone,
        creator.name as created_by_name
      FROM bookings b
      LEFT JOIN users u ON b.assigned_to = u.id
      LEFT JOIN users c ON b.client_id = c.id
      LEFT JOIN users creator ON b.created_by = creator.id
      WHERE b.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// === POST / - Create booking ===
router.post('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const {
      booking_type,
      assigned_to,
      assigned_role,
      client_id,
      property_id,
      scheduled_date,
      scheduled_time_start,
      scheduled_time_end,
      estimated_duration_mins,
      status,
      linked_entity_type,
      linked_entity_id,
      priority,
      notes,
      address,
      postcode,
      lat,
      lng,
      calendar_color
    } = req.body;

    // Validate required fields
    if (!booking_type || !assigned_to || !scheduled_date) {
      return res.status(400).json({
        error: 'booking_type, assigned_to, and scheduled_date are required'
      });
    }

    // Calculate travel time from previous booking on same day for same user
    let travel_time_mins = req.body.travel_time_mins || 0;
    if (!req.body.travel_time_mins && lat && lng) {
      const prevBooking = await pool.query(`
        SELECT lat, lng FROM bookings
        WHERE assigned_to = $1
          AND scheduled_date = $2
          AND status != 'cancelled'
        ORDER BY scheduled_time_start DESC
        LIMIT 1
      `, [assigned_to, scheduled_date]);

      if (prevBooking.rows.length > 0 && prevBooking.rows[0].lat && prevBooking.rows[0].lng) {
        travel_time_mins = estimateTravelMins(
          prevBooking.rows[0].lat, prevBooking.rows[0].lng,
          lat, lng
        );
      }
    }

    const result = await pool.query(`
      INSERT INTO bookings (
        booking_type, assigned_to, assigned_role, client_id, property_id,
        scheduled_date, scheduled_time_start, scheduled_time_end,
        estimated_duration_mins, travel_time_mins, status,
        linked_entity_type, linked_entity_id, priority,
        notes, address, postcode, lat, lng,
        calendar_color, created_by
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11,
        $12, $13, $14,
        $15, $16, $17, $18, $19,
        $20, $21
      ) RETURNING *
    `, [
      booking_type,
      assigned_to,
      assigned_role || 'engineer',
      client_id || null,
      property_id || null,
      scheduled_date,
      scheduled_time_start || null,
      scheduled_time_end || null,
      estimated_duration_mins || 60,
      travel_time_mins,
      status || 'scheduled',
      linked_entity_type || null,
      linked_entity_id || null,
      priority || 'normal',
      notes || null,
      address || null,
      postcode || null,
      lat || null,
      lng || null,
      calendar_color || null,
      user?.id || null
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// === PATCH /:id - Update booking ===
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Check booking exists
    const existing = await pool.query('SELECT * FROM bookings WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Track status transitions with timestamps
    if (updates.status) {
      const now = new Date().toISOString();
      switch (updates.status) {
        case 'confirmed':
          updates.confirmed_at = now;
          break;
        case 'in_progress':
          updates.started_at = now;
          break;
        case 'completed':
          updates.completed_at = now;
          break;
      }
    }

    // Always update updated_at
    updates.updated_at = new Date().toISOString();

    // Build dynamic UPDATE query
    const allowedFields = [
      'booking_type', 'assigned_to', 'assigned_role', 'client_id', 'property_id',
      'scheduled_date', 'scheduled_time_start', 'scheduled_time_end',
      'estimated_duration_mins', 'travel_time_mins', 'status',
      'linked_entity_type', 'linked_entity_id', 'priority',
      'notes', 'address', 'postcode', 'lat', 'lng',
      'calendar_color', 'confirmed_at', 'started_at', 'completed_at',
      'cancelled_reason', 'updated_at'
    ];

    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setClauses.push(`${field} = $${paramIndex++}`);
        params.push(updates[field]);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    params.push(id);
    const result = await pool.query(
      `UPDATE bookings SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating booking:', error);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

// === DELETE /:id - Cancel booking (soft cancel) ===
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const existing = await pool.query('SELECT * FROM bookings WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (existing.rows[0].status === 'cancelled') {
      return res.status(400).json({ error: 'Booking is already cancelled' });
    }

    const result = await pool.query(`
      UPDATE bookings
      SET status = 'cancelled',
          cancelled_reason = $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [reason || null, id]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// === POST /ai-suggest - AI scheduling suggestions ===
router.post('/ai-suggest', async (req: Request, res: Response) => {
  try {
    const {
      booking_type,
      client_id,
      property_id,
      estimated_duration_mins,
      priority
    } = req.body;

    if (!booking_type) {
      return res.status(400).json({ error: 'booking_type is required' });
    }

    const duration = estimated_duration_mins || 60;

    // Determine required role based on booking type
    const roleMap: Record<string, string> = {
      'job': 'engineer',
      'survey': 'surveyor',
      'inspection': 'works_manager',
      'signoff_visit': 'works_manager',
      'quote_visit': 'surveyor',
      'snag_check': 'works_manager'
    };
    const requiredRole = roleMap[booking_type] || 'engineer';

    // Get target property location if available
    let targetLat: number | null = null;
    let targetLng: number | null = null;
    let targetPostcode: string | null = null;
    if (property_id) {
      try {
        const propResult = await pool.query(
          'SELECT postcode FROM client_properties WHERE id = $1',
          [property_id]
        );
        if (propResult.rows.length > 0) {
          targetPostcode = propResult.rows[0].postcode;
        }
      } catch (propErr) {
        // Non-fatal - property lookup failed
      }
    }

    // Find staff with matching role (fallback to admin/super_admin for works_manager)
    const rolesToSearch = requiredRole === 'works_manager'
      ? ['works_manager', 'admin', 'super_admin']
      : [requiredRole];
    const staffResult = await pool.query(`
      SELECT id, name, role FROM users
      WHERE role = ANY($1::text[])
      ORDER BY name
    `, [rolesToSearch]);

    if (staffResult.rows.length === 0) {
      return res.json({
        suggestions: [],
        message: `No available ${requiredRole} staff found`
      });
    }

    // Look at next 14 days for available slots
    const suggestions: any[] = [];
    const today = new Date();

    for (let dayOffset = 1; dayOffset <= 14 && suggestions.length < 3; dayOffset++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() + dayOffset);

      // Skip weekends
      const dayOfWeek = checkDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      const dateStr = checkDate.toISOString().split('T')[0];

      for (const staff of staffResult.rows) {
        if (suggestions.length >= 3) break;

        // Get existing bookings for this staff on this date
        const existingBookings = await pool.query(`
          SELECT scheduled_time_start, scheduled_time_end,
                 estimated_duration_mins, travel_time_mins,
                 lat, lng, address
          FROM bookings
          WHERE assigned_to = $1
            AND scheduled_date = $2
            AND status != 'cancelled'
          ORDER BY scheduled_time_start ASC
        `, [staff.id, dateStr]);

        // Working hours: 08:00 - 17:00
        const workStart = 8 * 60; // minutes from midnight
        const workEnd = 17 * 60;

        // Find available slots
        const busySlots = existingBookings.rows.map((b: any) => {
          const startParts = b.scheduled_time_start ? b.scheduled_time_start.split(':') : null;
          const start = startParts ? parseInt(startParts[0]) * 60 + parseInt(startParts[1]) : 0;
          const slotDuration = (b.estimated_duration_mins || 60) + (b.travel_time_mins || 0);
          return { start, end: start + slotDuration, lat: b.lat, lng: b.lng };
        });

        // Find gaps in the schedule
        let currentTime = workStart;
        for (const slot of busySlots) {
          // Calculate travel time from last location to target
          let travelToTarget = 20; // default
          if (targetLat && targetLng && slot.lat && slot.lng) {
            travelToTarget = estimateTravelMins(slot.lat, slot.lng, targetLat, targetLng);
          }

          const requiredTime = duration + travelToTarget;

          if (slot.start - currentTime >= requiredTime) {
            // Found a slot before this booking
            const suggestedStart = currentTime;
            const hours = Math.floor(suggestedStart / 60);
            const mins = suggestedStart % 60;
            const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;

            suggestions.push({
              assigned_to: staff.id,
              assigned_to_name: staff.name,
              scheduled_date: dateStr,
              scheduled_time_start: timeStr,
              estimated_duration_mins: duration,
              travel_time_mins: travelToTarget,
              reasoning: `${staff.name} is available at ${timeStr} on ${dateStr} with ${travelToTarget} mins travel time`
            });
            break;
          }
          currentTime = slot.end;
        }

        // Check slot after all bookings
        if (suggestions.length < 3 && !suggestions.find(s => s.assigned_to === staff.id && s.scheduled_date === dateStr)) {
          let travelToTarget = 20;
          if (busySlots.length > 0 && targetLat && targetLng) {
            const lastSlot = busySlots[busySlots.length - 1];
            if (lastSlot.lat && lastSlot.lng) {
              travelToTarget = estimateTravelMins(lastSlot.lat, lastSlot.lng, targetLat, targetLng);
            }
          }

          const requiredTime = duration + travelToTarget;
          if (workEnd - currentTime >= requiredTime) {
            const suggestedStart = currentTime;
            const hours = Math.floor(suggestedStart / 60);
            const mins = suggestedStart % 60;
            const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;

            suggestions.push({
              assigned_to: staff.id,
              assigned_to_name: staff.name,
              scheduled_date: dateStr,
              scheduled_time_start: timeStr,
              estimated_duration_mins: duration,
              travel_time_mins: travelToTarget,
              reasoning: `${staff.name} is available at ${timeStr} on ${dateStr}` +
                (priority === 'urgent' ? ' (earliest available slot)' : '')
            });
          }
        }
      }
    }

    // Sort by priority preference
    if (priority === 'urgent' || priority === 'high') {
      suggestions.sort((a, b) => {
        const dateA = new Date(`${a.scheduled_date}T${a.scheduled_time_start}`);
        const dateB = new Date(`${b.scheduled_date}T${b.scheduled_time_start}`);
        return dateA.getTime() - dateB.getTime();
      });
    }

    res.json({
      suggestions: suggestions.slice(0, 3),
      parameters: {
        booking_type,
        required_role: requiredRole,
        estimated_duration_mins: duration,
        priority: priority || 'normal',
        search_days: 14
      }
    });
  } catch (error) {
    console.error('Error generating AI suggestions:', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: 'Failed to generate scheduling suggestions', detail: errMsg });
  }
});

export default router;
