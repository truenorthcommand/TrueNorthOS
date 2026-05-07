import { Router, Request, Response } from "express";
import { pool } from "./db";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const router = Router();

// === MULTER SETUP ===
const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'surveys');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = crypto.randomUUID() + ext;
    cb(null, name);
  },
});

const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// === ACCESS CONTROL ===
function requireSurveyAccess(req: Request, res: Response, next: any) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const allowedRoles = ['admin', 'surveyor', 'super_admin'];
  if (!allowedRoles.includes(user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
}

router.use(requireSurveyAccess);

// === SURVEY TEMPLATES ===
const SURVEY_TEMPLATES = [
  {
    id: 'bathroom',
    name: 'Bathroom Renovation',
    survey_type: 'bathroom',
    rooms: [
      {
        room_name: 'Bathroom',
        room_type: 'bathroom',
        checklist: ['Plumbing condition', 'Tile condition', 'Ventilation', 'Lighting', 'Water pressure', 'Drainage', 'Fixtures condition']
      }
    ]
  },
  {
    id: 'kitchen',
    name: 'Kitchen Renovation',
    survey_type: 'kitchen',
    rooms: [
      {
        room_name: 'Kitchen',
        room_type: 'kitchen',
        checklist: ['Plumbing condition', 'Electrical points', 'Ventilation', 'Flooring', 'Wall condition', 'Worktop measurements', 'Appliance spaces']
      }
    ]
  },
  {
    id: 'full',
    name: 'Full Property Survey',
    survey_type: 'full',
    rooms: [
      { room_name: 'Living Room', room_type: 'living', checklist: ['Walls', 'Ceiling', 'Flooring', 'Windows', 'Electrical', 'Heating'] },
      { room_name: 'Kitchen', room_type: 'kitchen', checklist: ['Plumbing', 'Electrical', 'Ventilation', 'Flooring', 'Walls'] },
      { room_name: 'Bathroom', room_type: 'bathroom', checklist: ['Plumbing', 'Tiles', 'Ventilation', 'Fixtures'] },
      { room_name: 'Bedroom 1', room_type: 'bedroom', checklist: ['Walls', 'Ceiling', 'Flooring', 'Windows', 'Electrical'] },
      { room_name: 'Hallway', room_type: 'hallway', checklist: ['Walls', 'Flooring', 'Lighting', 'Doors'] },
      { room_name: 'Exterior', room_type: 'exterior', checklist: ['Roof', 'Guttering', 'Walls', 'Windows', 'Doors', 'Drainage'] }
    ]
  },
  {
    id: 'electrical',
    name: 'Electrical Survey',
    survey_type: 'electrical',
    rooms: [
      {
        room_name: 'Consumer Unit',
        room_type: 'utility',
        checklist: ['Board condition', 'RCD protection', 'Circuit labelling', 'Earthing', 'Bonding']
      },
      {
        room_name: 'General Circuits',
        room_type: 'general',
        checklist: ['Socket condition', 'Lighting circuits', 'Switches', 'Wiring age', 'Overloading signs']
      }
    ]
  },
  {
    id: 'roofing',
    name: 'Roofing Survey',
    survey_type: 'roofing',
    rooms: [
      {
        room_name: 'Roof Exterior',
        room_type: 'roof',
        checklist: ['Tiles/slates condition', 'Ridge tiles', 'Flashing', 'Chimney', 'Guttering', 'Fascia/soffit', 'Moss/algae']
      },
      {
        room_name: 'Loft Space',
        room_type: 'loft',
        checklist: ['Insulation', 'Ventilation', 'Timbers condition', 'Water staining', 'Felt condition']
      }
    ]
  },
  {
    id: 'external',
    name: 'External Works Survey',
    survey_type: 'external',
    rooms: [
      {
        room_name: 'Front Elevation',
        room_type: 'exterior',
        checklist: ['Walls', 'Windows', 'Door', 'Driveway', 'Boundary walls/fences']
      },
      {
        room_name: 'Rear Elevation',
        room_type: 'exterior',
        checklist: ['Walls', 'Windows', 'Doors', 'Patio/decking', 'Garden', 'Outbuildings']
      }
    ]
  },
  {
    id: 'custom',
    name: 'Custom Survey',
    survey_type: 'custom',
    rooms: []
  }
];

// === ROUTES ===

// GET /templates - Survey templates
router.get('/templates', (_req: Request, res: Response) => {
  res.json(SURVEY_TEMPLATES);
});

// GET / - List all surveys
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT s.*,
        u.name as client_name,
        u.email as client_email,
        sv.name as surveyor_name,
        (SELECT COUNT(*) FROM survey_rooms sr WHERE sr.survey_id = s.id) as room_count,
        (SELECT COUNT(*) FROM survey_media sm WHERE sm.survey_id = s.id) as media_count
      FROM surveys s
      LEFT JOIN users u ON s.client_id = u.id
      LEFT JOIN users sv ON s.surveyor_id = sv.id
      ORDER BY s.created_at DESC
    `);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Survey list error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /:id - Get survey with rooms, work items, and media
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get survey
    const surveyResult = await pool.query(`
      SELECT s.*,
        u.name as client_name,
        u.email as client_email,
        sv.name as surveyor_name
      FROM surveys s
      LEFT JOIN users u ON s.client_id = u.id
      LEFT JOIN users sv ON s.surveyor_id = sv.id
      WHERE s.id = $1
    `, [id]);

    if (surveyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    const survey = surveyResult.rows[0];

    // Get rooms with work items
    const roomsResult = await pool.query(`
      SELECT * FROM survey_rooms WHERE survey_id = $1 ORDER BY order_index ASC, created_at ASC
    `, [id]);

    const rooms = [];
    for (const room of roomsResult.rows) {
      const workItemsResult = await pool.query(`
        SELECT * FROM survey_work_items WHERE survey_room_id = $1 ORDER BY created_at ASC
      `, [room.id]);
      rooms.push({ ...room, work_items: workItemsResult.rows });
    }

    // Get media
    const mediaResult = await pool.query(`
      SELECT * FROM survey_media WHERE survey_id = $1 ORDER BY uploaded_at DESC
    `, [id]);

    res.json({ ...survey, rooms, media: mediaResult.rows });
  } catch (error: any) {
    console.error('Survey detail error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST / - Create new survey
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { client_id, property_id, survey_type, enquiry_id } = req.body;

    if (!client_id) {
      return res.status(400).json({ error: 'client_id is required' });
    }

    const result = await pool.query(`
      INSERT INTO surveys (client_id, property_id, surveyor_id, survey_type, status, enquiry_id)
      VALUES ($1, $2, $3, $4, 'draft', $5)
      RETURNING *
    `, [client_id, property_id || null, user.id, survey_type || 'custom', enquiry_id || null]);

    const survey = result.rows[0];

    // If using a template, auto-create rooms
    const template = SURVEY_TEMPLATES.find(t => t.survey_type === survey_type);
    if (template && template.rooms.length > 0) {
      for (let i = 0; i < template.rooms.length; i++) {
        const room = template.rooms[i];
        await pool.query(`
          INSERT INTO survey_rooms (survey_id, room_name, room_type, order_index)
          VALUES ($1, $2, $3, $4)
        `, [survey.id, room.room_name, room.room_type, i]);
      }
    }

    // Return full survey with rooms
    const fullSurvey = await pool.query(`
      SELECT s.*, u.name as client_name FROM surveys s
      LEFT JOIN users u ON s.client_id = u.id
      WHERE s.id = $1
    `, [survey.id]);

    const roomsResult = await pool.query(`
      SELECT * FROM survey_rooms WHERE survey_id = $1 ORDER BY order_index ASC
    `, [survey.id]);

    res.status(201).json({ ...fullSurvey.rows[0], rooms: roomsResult.rows, media: [] });
  } catch (error: any) {
    console.error('Survey create error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /:id - Update survey
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const allowedFields = [
      'status', 'general_notes', 'condition_rating', 'access_notes',
      'safety_notes', 'client_preferences', 'timeline', 'gps_lat',
      'gps_lng', 'arrived_at', 'departed_at', 'survey_type'
    ];

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(req.body[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(`
      UPDATE surveys SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    // === AUTOMATION: Update linked enquiry when survey completes ===
    if (req.body.status === 'complete') {
      const survey = result.rows[0];
      if (survey.enquiry_id) {
        await pool.query(
          `UPDATE enquiries SET status = 'survey_complete', updated_at = NOW() WHERE id = $1`,
          [survey.enquiry_id]
        );
      }
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Survey update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /:id - Delete survey
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM surveys WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Survey not found' });
    }
    res.json({ success: true, id });
  } catch (error: any) {
    console.error('Survey delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// === ROOM ROUTES ===

// POST /:id/rooms - Add room to survey
router.post('/:id/rooms', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { room_name, room_type, order_index, notes, length_m, width_m, height_m, condition, checklist_ref } = req.body;

    if (!room_name) {
      return res.status(400).json({ error: 'room_name is required' });
    }

    // Verify survey exists
    const surveyCheck = await pool.query('SELECT id FROM surveys WHERE id = $1', [id]);
    if (surveyCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    const result = await pool.query(`
      INSERT INTO survey_rooms (survey_id, room_name, room_type, order_index, notes, length_m, width_m, height_m, condition, checklist_ref)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [id, room_name, room_type || 'custom', order_index || 0, notes || null, length_m || null, width_m || null, height_m || null, condition || null, checklist_ref ? JSON.stringify(checklist_ref) : null]);

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Room create error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /:id/rooms/:roomId - Update room
router.patch('/:id/rooms/:roomId', async (req: Request, res: Response) => {
  try {
    const { id, roomId } = req.params;
    const allowedFields = ['room_name', 'room_type', 'notes', 'voice_notes', 'condition', 'order_index', 'length_m', 'width_m', 'height_m', 'checklist_ref'];

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(req.body[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(roomId, id);
    const result = await pool.query(`
      UPDATE survey_rooms SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND survey_id = $${paramIndex + 1}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Room update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /:id/rooms/:roomId - Delete room
router.delete('/:id/rooms/:roomId', async (req: Request, res: Response) => {
  try {
    const { id, roomId } = req.params;
    const result = await pool.query(
      'DELETE FROM survey_rooms WHERE id = $1 AND survey_id = $2 RETURNING id',
      [roomId, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json({ success: true, id: roomId });
  } catch (error: any) {
    console.error('Room delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// === WORK ITEM ROUTES ===

// POST /:id/rooms/:roomId/work-items - Add work item
router.post('/:id/rooms/:roomId/work-items', async (req: Request, res: Response) => {
  try {
    const { id, roomId } = req.params;
    const { description, type, priority, quantity, unit, measurements, estimated_cost, ai_suggested_price, length_m, width_m, height_m, notes } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'description is required' });
    }

    // Verify room belongs to survey
    const roomCheck = await pool.query(
      'SELECT id FROM survey_rooms WHERE id = $1 AND survey_id = $2',
      [roomId, id]
    );
    if (roomCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found in this survey' });
    }

    const result = await pool.query(`
      INSERT INTO survey_work_items (survey_room_id, description, type, priority, quantity, unit, measurements, estimated_cost, ai_suggested_price, length_m, width_m, height_m, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [roomId, description, type || 'both', priority || 'essential', quantity || 1, unit || 'each', measurements || null, estimated_cost || null, ai_suggested_price || null, length_m || null, width_m || null, height_m || null, notes || null]);

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Work item create error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /:id/rooms/:roomId/work-items/:itemId - Update work item
router.patch('/:id/rooms/:roomId/work-items/:itemId', async (req: Request, res: Response) => {
  try {
    const { id, roomId, itemId } = req.params;
    const allowedFields = ['description', 'type', 'priority', 'quantity', 'unit', 'measurements', 'estimated_cost', 'ai_suggested_price', 'length_m', 'width_m', 'height_m', 'notes'];

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(req.body[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Verify ownership chain
    const roomCheck = await pool.query(
      'SELECT id FROM survey_rooms WHERE id = $1 AND survey_id = $2',
      [roomId, id]
    );
    if (roomCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found in this survey' });
    }

    values.push(itemId, roomId);
    const result = await pool.query(`
      UPDATE survey_work_items SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND survey_room_id = $${paramIndex + 1}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Work item not found' });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Work item update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /:id/rooms/:roomId/work-items/:itemId - Delete work item
router.delete('/:id/rooms/:roomId/work-items/:itemId', async (req: Request, res: Response) => {
  try {
    const { id, roomId, itemId } = req.params;

    // Verify ownership chain
    const roomCheck = await pool.query(
      'SELECT id FROM survey_rooms WHERE id = $1 AND survey_id = $2',
      [roomId, id]
    );
    if (roomCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found in this survey' });
    }

    const result = await pool.query(
      'DELETE FROM survey_work_items WHERE id = $1 AND survey_room_id = $2 RETURNING id',
      [itemId, roomId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Work item not found' });
    }

    res.json({ success: true, id: itemId });
  } catch (error: any) {
    console.error('Work item delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// === MEDIA ROUTES ===

// POST /:id/media - Upload media
router.post('/:id/media', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'File is required' });
    }

    // Verify survey exists
    const surveyCheck = await pool.query('SELECT id FROM surveys WHERE id = $1', [id]);
    if (surveyCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    const { survey_room_id, caption, media_type } = req.body;
    const url = `/uploads/surveys/${file.filename}`;

    // Determine media type from file if not provided
    let resolvedMediaType = media_type;
    if (!resolvedMediaType) {
      const ext = path.extname(file.originalname).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic'].includes(ext)) {
        resolvedMediaType = 'photo';
      } else if (['.mp4', '.mov', '.avi', '.webm'].includes(ext)) {
        resolvedMediaType = 'video';
      } else {
        resolvedMediaType = 'file';
      }
    }

    const result = await pool.query(`
      INSERT INTO survey_media (survey_id, survey_room_id, media_type, url, filename, caption)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [id, survey_room_id || null, resolvedMediaType, url, file.originalname, caption || null]);

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Media upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /:id/media/:mediaId - Delete media
router.delete('/:id/media/:mediaId', async (req: Request, res: Response) => {
  try {
    const { id, mediaId } = req.params;

    // Get media to delete file
    const mediaResult = await pool.query(
      'SELECT * FROM survey_media WHERE id = $1 AND survey_id = $2',
      [mediaId, id]
    );

    if (mediaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Media not found' });
    }

    const media = mediaResult.rows[0];

    // Delete file from disk
    const filePath = path.join(process.cwd(), 'public', media.url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await pool.query('DELETE FROM survey_media WHERE id = $1', [mediaId]);
    res.json({ success: true, id: mediaId });
  } catch (error: any) {
    console.error('Media delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// === GENERATE QUOTE ===

// POST /:id/generate-quote - Generate quote from survey data
router.post('/:id/generate-quote', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    // Get survey with client info
    const surveyResult = await pool.query(`
      SELECT s.*, u.name as client_name, u.email as client_email, u.phone as client_phone
      FROM surveys s
      LEFT JOIN users u ON s.client_id = u.id
      WHERE s.id = $1
    `, [id]);

    if (surveyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    const survey = surveyResult.rows[0];

    // Get all work items from all rooms
    const workItemsResult = await pool.query(`
      SELECT wi.*, sr.room_name
      FROM survey_work_items wi
      JOIN survey_rooms sr ON wi.survey_room_id = sr.id
      WHERE sr.survey_id = $1
      ORDER BY sr.order_index ASC, wi.created_at ASC
    `, [id]);

    if (workItemsResult.rows.length === 0) {
      return res.status(400).json({ error: 'No work items found to generate quote' });
    }

    // Build line items for quote
    const lineItems = workItemsResult.rows.map((item, index) => ({
      id: index + 1,
      description: `[${item.room_name}] ${item.description}`,
      type: item.type,
      quantity: parseFloat(item.quantity) || 1,
      unit: item.unit || 'each',
      unitCost: parseFloat(item.estimated_cost) || 0,
      total: (parseFloat(item.quantity) || 1) * (parseFloat(item.estimated_cost) || 0),
      priority: item.priority,
    }));

    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const vatRate = 20;
    const vatAmount = subtotal * (vatRate / 100);
    const total = subtotal + vatAmount;

    // Generate quote number
    const quoteCountResult = await pool.query('SELECT COUNT(*) as count FROM quotes');
    const quoteNo = `QTE-${String(parseInt(quoteCountResult.rows[0].count) + 1).padStart(4, '0')}`;

    // Create quote
    const quoteResult = await pool.query(`
      INSERT INTO quotes (quote_no, customer_id, customer_name, customer_email, customer_phone, description, line_items, subtotal, vat_rate, vat_amount, total, status, created_by_id, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Draft', $12, $13)
      RETURNING id
    `, [
      quoteNo,
      survey.client_id ? String(survey.client_id) : null,
      survey.client_name || 'Unknown Client',
      survey.client_email || null,
      survey.client_phone || null,
      `Generated from survey - ${survey.survey_type || 'custom'}`,
      JSON.stringify(lineItems),
      subtotal,
      vatRate,
      vatAmount,
      total,
      String(user.id),
      survey.general_notes || null
    ]);

    const quoteId = quoteResult.rows[0].id;

    // Update survey status and link quote
    await pool.query(`
      UPDATE surveys SET status = 'converted', quote_id = $1, updated_at = NOW() WHERE id = $2
    `, [quoteId, id]);

    res.json({ success: true, quote_id: quoteId, quote_no: quoteNo });
  } catch (error: any) {
    console.error('Generate quote error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
