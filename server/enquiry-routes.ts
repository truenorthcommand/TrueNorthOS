import { Router, Request, Response } from "express";
import { pool } from "./db";

const router = Router();

// === ACCESS CONTROL ===
function requireEnquiryAccess(req: Request, res: Response, next: any) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const allowedRoles = ['admin', 'surveyor', 'super_admin', 'works_manager'];
  if (!allowedRoles.includes(user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
}

router.use(requireEnquiryAccess);

// === GET ALL ENQUIRIES ===
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { status, urgency, assigned_to, search } = req.query;

    let query = `
      SELECT e.*,
        c.name as client_name,
        c.email as client_email,
        c.phone as client_phone,
        cp.name as property_name,
        cp.address as property_address,
        cp.postcode as property_postcode,
        u.name as assigned_to_name
      FROM enquiries e
      LEFT JOIN users c ON e.client_id = c.id
      LEFT JOIN client_properties cp ON e.property_id = cp.id
      LEFT JOIN users u ON e.assigned_to = u.id
    `;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`e.status = $${paramIndex++}`);
      params.push(status);
    }

    if (urgency) {
      conditions.push(`e.urgency = $${paramIndex++}`);
      params.push(urgency);
    }

    if (assigned_to) {
      conditions.push(`e.assigned_to = $${paramIndex++}`);
      params.push(Number(assigned_to));
    }

    if (search) {
      conditions.push(`(
        e.description ILIKE $${paramIndex} OR
        c.name ILIKE $${paramIndex} OR
        cp.address ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY e.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching enquiries:', error);
    res.status(500).json({ error: 'Failed to fetch enquiries' });
  }
});

// === GET SINGLE ENQUIRY ===
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT e.*,
        c.name as client_name,
        c.email as client_email,
        c.phone as client_phone,
        cp.name as property_name,
        cp.address as property_address,
        cp.postcode as property_postcode,
        u.name as assigned_to_name
      FROM enquiries e
      LEFT JOIN users c ON e.client_id = c.id
      LEFT JOIN client_properties cp ON e.property_id = cp.id
      LEFT JOIN users u ON e.assigned_to = u.id
      WHERE e.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Enquiry not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching enquiry:', error);
    res.status(500).json({ error: 'Failed to fetch enquiry' });
  }
});

// === CREATE ENQUIRY ===
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const {
      client_id,
      property_id,
      source,
      description,
      client_requirements,
      budget_indication,
      urgency,
      preferred_dates,
      assigned_to,
    } = req.body;

    if (!client_id || !description) {
      return res.status(400).json({ error: 'Client and description are required' });
    }

    const result = await pool.query(`
      INSERT INTO enquiries (
        client_id, property_id, source, description,
        client_requirements, budget_indication, urgency,
        preferred_dates, assigned_to, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'new')
      RETURNING *
    `, [
      client_id,
      property_id || null,
      source || 'phone',
      description,
      client_requirements || null,
      budget_indication || null,
      urgency || 'standard',
      preferred_dates || null,
      assigned_to || user.id,
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating enquiry:', error);
    res.status(500).json({ error: 'Failed to create enquiry' });
  }
});

// === UPDATE ENQUIRY ===
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const allowedFields = [
      'client_id', 'property_id', 'source', 'description',
      'client_requirements', 'budget_indication', 'urgency',
      'preferred_dates', 'assigned_to', 'status', 'lost_reason',
      'survey_id', 'quote_id'
    ];

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        values.push(req.body[field]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(`
      UPDATE enquiries SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Enquiry not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating enquiry:', error);
    res.status(500).json({ error: 'Failed to update enquiry' });
  }
});

// === DELETE ENQUIRY ===
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM enquiries WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Enquiry not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting enquiry:', error);
    res.status(500).json({ error: 'Failed to delete enquiry' });
  }
});

// === STATUS TRANSITIONS ===

// Book Survey — creates survey linked to this enquiry
router.post('/:id/book-survey', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { surveyor_id, survey_type, scheduled_date } = req.body;

    // Get enquiry details
    const enquiryResult = await pool.query('SELECT * FROM enquiries WHERE id = $1', [id]);
    if (enquiryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Enquiry not found' });
    }

    const enquiry = enquiryResult.rows[0];

    if (!['new', 'survey_complete'].includes(enquiry.status)) {
      return res.status(400).json({ error: `Cannot book survey from status: ${enquiry.status}` });
    }

    // Create the survey
    const surveyResult = await pool.query(`
      INSERT INTO surveys (
        client_id, property_id, surveyor_id, survey_type, status, enquiry_id
      ) VALUES ($1, $2, $3, $4, 'draft', $5)
      RETURNING *
    `, [
      enquiry.client_id,
      enquiry.property_id,
      surveyor_id || (req as any).user.id,
      survey_type || 'custom',
      id, // link back to enquiry
    ]);

    const survey = surveyResult.rows[0];

    // Update enquiry status and link survey
    await pool.query(`
      UPDATE enquiries SET status = 'survey_booked', survey_id = $1, updated_at = NOW() WHERE id = $2
    `, [survey.id, id]);

    res.json({
      success: true,
      enquiry_status: 'survey_booked',
      survey_id: survey.id,
      message: 'Survey booked successfully',
    });
  } catch (error) {
    console.error('Error booking survey:', error);
    res.status(500).json({ error: 'Failed to book survey' });
  }
});

// Send to Quote — skip survey, go straight to quote
router.post('/:id/create-quote', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const enquiryResult = await pool.query('SELECT * FROM enquiries WHERE id = $1', [id]);
    if (enquiryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Enquiry not found' });
    }

    const enquiry = enquiryResult.rows[0];

    if (!['new', 'survey_complete'].includes(enquiry.status)) {
      return res.status(400).json({ error: `Cannot create quote from status: ${enquiry.status}` });
    }

    // Update enquiry status
    await pool.query(`
      UPDATE enquiries SET status = 'quote_sent', updated_at = NOW() WHERE id = $1
    `, [id]);

    // Return enquiry data for the quote wizard to pre-fill
    res.json({
      success: true,
      enquiry_status: 'quote_sent',
      prefill_data: {
        client_id: enquiry.client_id,
        property_id: enquiry.property_id,
        description: enquiry.description,
        client_requirements: enquiry.client_requirements,
        budget_indication: enquiry.budget_indication,
      },
      message: 'Ready to create quote',
    });
  } catch (error) {
    console.error('Error creating quote from enquiry:', error);
    res.status(500).json({ error: 'Failed to initiate quote' });
  }
});

// Mark as Won
router.post('/:id/mark-won', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      UPDATE enquiries SET status = 'won', updated_at = NOW() WHERE id = $1 RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Enquiry not found' });
    }

    res.json({ success: true, enquiry: result.rows[0] });
  } catch (error) {
    console.error('Error marking enquiry won:', error);
    res.status(500).json({ error: 'Failed to update enquiry' });
  }
});

// Mark as Lost
router.post('/:id/mark-lost', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const result = await pool.query(`
      UPDATE enquiries SET status = 'lost', lost_reason = $1, updated_at = NOW() WHERE id = $2 RETURNING *
    `, [reason || null, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Enquiry not found' });
    }

    res.json({ success: true, enquiry: result.rows[0] });
  } catch (error) {
    console.error('Error marking enquiry lost:', error);
    res.status(500).json({ error: 'Failed to update enquiry' });
  }
});

// Cancel enquiry
router.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      UPDATE enquiries SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Enquiry not found' });
    }

    res.json({ success: true, enquiry: result.rows[0] });
  } catch (error) {
    console.error('Error cancelling enquiry:', error);
    res.status(500).json({ error: 'Failed to cancel enquiry' });
  }
});

// === PIPELINE STATS ===
router.get('/stats/pipeline', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        status,
        COUNT(*)::integer as count,
        COUNT(*) FILTER (WHERE urgency = 'emergency')::integer as emergency_count,
        COUNT(*) FILTER (WHERE urgency = 'urgent')::integer as urgent_count
      FROM enquiries
      GROUP BY status
      ORDER BY
        CASE status
          WHEN 'new' THEN 1
          WHEN 'survey_booked' THEN 2
          WHEN 'survey_complete' THEN 3
          WHEN 'quote_sent' THEN 4
          WHEN 'won' THEN 5
          WHEN 'lost' THEN 6
          WHEN 'cancelled' THEN 7
        END
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching pipeline stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
