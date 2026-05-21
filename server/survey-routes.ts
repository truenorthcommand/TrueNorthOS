import { Router, Request, Response } from "express";
import { pool } from "./db";
import multer from "multer";
import {
  uploadFile,
  getPresignedDownloadUrl,
  BUCKETS,
} from "./services/object-storage";
import crypto from "crypto";

const router = Router();

// === MULTER SETUP ===
// Use memory storage for direct upload to object storage (MinIO/S3)
const storage = multer.memoryStorage();

const upload = multer({ 
  storage, 
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

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

// === ROUTES ===

// GET /job-surveys - List all job-centric surveys with job info
router.get('/job-surveys', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT s.id, s.job_id, s.status, s.surveyor_notes,
        s.submitted_at, s.last_auto_save_at, s.created_at, s.updated_at,
        j.job_no, j.description as job_description, j.status as job_status,
        j.address as job_address,
        j.customer_name,
        sv.name as surveyor_name,
        (SELECT COUNT(*) FROM survey_photos sp WHERE sp.job_id = s.job_id) as photo_count
      FROM surveys s
      INNER JOIN jobs j ON s.job_id = j.id
      LEFT JOIN users sv ON s.surveyor_id = sv.id
      WHERE s.job_id IS NOT NULL
      ORDER BY s.updated_at DESC
    `);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Job surveys list error:', error);
    res.status(500).json({ error: error.message });
  }
});

// === JOB-CENTRIC SURVEY ROUTES ===

// GET /api/jobs/:jobId/survey - Get survey for job
router.get('/jobs/:jobId/survey', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    
    const existing = await pool.query(`
      SELECT s.* 
      FROM surveys s 
      WHERE s.job_id = $1 
      ORDER BY s.created_at DESC 
      LIMIT 1
    `, [jobId]);
    
    if (existing.rows.length > 0) {
      return res.json(existing.rows[0]);
    }
    
    res.status(404).json({ error: 'No survey found', jobId });
    
  } catch (error: any) {
    console.error('Get job survey error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/jobs/:jobId/survey - Create or update survey
router.post('/jobs/:jobId/survey', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const { surveyorNotes, status } = req.body;
    const user = (req as any).user;
    
    const existing = await pool.query(
      'SELECT id FROM surveys WHERE job_id = $1 ORDER BY created_at DESC LIMIT 1',
      [jobId]
    );
    
    let survey;
    
    if (existing.rows.length > 0) {
      const result = await pool.query(`
        UPDATE surveys 
        SET surveyor_notes = $1, 
            status = COALESCE($2, status),
            last_auto_save_at = NOW(),
            updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `, [surveyorNotes, status, existing.rows[0].id]);
      survey = result.rows[0];
    } else {
      const jobResult = await pool.query(
        'SELECT description FROM jobs WHERE id = $1',
        [jobId]
      );
      
      let trade = 'general';
      const desc = (jobResult.rows[0]?.description || '').toLowerCase();
      if (desc.includes('bathroom')) trade = 'bathroom';
      else if (desc.includes('kitchen')) trade = 'kitchen';
      else if (desc.includes('electrical') || desc.includes('rewire')) trade = 'electrical';
      else if (desc.includes('plumber') || desc.includes('heating')) trade = 'plumbing';
      else if (desc.includes('roof')) trade = 'roofing';
      
      const result = await pool.query(`
        INSERT INTO surveys (job_id, surveyor_id, survey_type, surveyor_notes, status, last_auto_save_at)
        VALUES ($1, $2, $3, $4, COALESCE($5, 'draft'), NOW())
        RETURNING *
      `, [jobId, user?.id, trade, surveyorNotes, status]);
      survey = result.rows[0];
    }
    
    res.json(survey);
    
  } catch (error: any) {
    console.error('Save job survey error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/jobs/:jobId/survey/send - Send survey and generate quote
router.post('/jobs/:jobId/survey/send', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const user = (req as any).user;
    
    const surveyResult = await pool.query(`
      SELECT s.*, j.customer_name as customername, j.description, j.address, j.postcode, j.client
      FROM surveys s
      JOIN jobs j ON s.job_id = j.id
      WHERE s.job_id = $1 AND s.status = 'draft'
      ORDER BY s.created_at DESC
      LIMIT 1
    `, [jobId]);
    
    if (surveyResult.rows.length === 0) {
      return res.status(404).json({ error: 'No draft survey found for this job' });
    }
    
    const survey = surveyResult.rows[0];
    
    await pool.query(`
      UPDATE surveys SET status = 'submitting', updated_at = NOW() WHERE id = $1
    `, [survey.id]);
    
    const { calculatePricing, learnFromQuoteLineItems } = await import('../services/ai-pricing');
    
    const aiResult = await calculatePricing({
      trade: survey.survey_type,
      jobDescription: `${survey.description || ''}\n\nSurveyor Notes:\n${survey.surveyor_notes || ''}`,
      qualityLevel: 'mid-range'
    });
    
    const quoteCount = await pool.query('SELECT COUNT(*) as count FROM quotes');
    const quoteNo = `QTE-${String(parseInt(quoteCount.rows[0].count) + 1).padStart(4, '0')}`;
    
    const lineItems = aiResult.lineItems.map((item: any, idx: number) => ({
      id: String(idx + 1),
      type: item.type,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitCost: item.unitCost,
      markup: 0,
      discount: 0,
      vatRate: item.vatRate,
      amount: item.quantity * item.unitCost
    }));
    
    const subtotal = lineItems.reduce((sum: number, item: any) => sum + item.amount, 0);
    const vatRate = 20;
    const vatAmount = subtotal * (vatRate / 100);
    const total = subtotal + vatAmount;
    
    const quoteResult = await pool.query(`
      INSERT INTO quotes (
        quote_no, customer_id, customer_name, site_address, site_postcode,
        description, line_items, subtotal, vat_rate, vat_amount, total,
        status, created_by_id, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, 'Draft', $12, $13
      ) RETURNING id
    `, [
      quoteNo,
      survey.client || null,
      survey.customername || 'Unknown Customer',
      survey.address || survey.postcode || null,
      survey.postcode || null,
      `Survey for ${survey.survey_type}`,
      JSON.stringify(lineItems),
      subtotal,
      vatRate,
      vatAmount,
      total,
      user?.id,
      `Survey Notes:\n${survey.surveyor_notes || ''}`
    ]);
    
    const quoteId = quoteResult.rows[0].id;
    
    await pool.query(`
      UPDATE surveys 
      SET status = 'sent', submitted_at = NOW(), submitted_by = $1, quote_id = $2, updated_at = NOW()
      WHERE id = $3
    `, [user?.id, quoteId, survey.id]);
    
    await learnFromQuoteLineItems(survey.survey_type, aiResult.lineItems);
    
    res.json({
      success: true,
      quoteId,
      quoteNo,
      confidence: aiResult.summary.confidence,
      lineItemCount: lineItems.length,
      total
    });
    
  } catch (error: any) {
    console.error('Send survey error:', error);
    await pool.query(`
      UPDATE surveys SET status = 'draft' WHERE job_id = $1 AND status = 'submitting'
    `, [req.params.jobId]);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/jobs/:jobId/survey/photos
router.get('/jobs/:jobId/survey/photos', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    
    const survey = await pool.query(
      'SELECT id FROM surveys WHERE job_id = $1 ORDER BY created_at DESC LIMIT 1',
      [jobId]
    );
    
    if (survey.rows.length === 0) {
      return res.json([]);
    }
    
    const photos = await pool.query(
      'SELECT * FROM survey_photos WHERE survey_id = $1 ORDER BY uploaded_at DESC',
      [survey.rows[0].id]
    );
    
    res.json(photos.rows);
    
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/jobs/:jobId/survey/photos
router.post('/jobs/:jobId/survey/photos', upload.single('photo'), async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const user = (req as any).user;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded' });
    }
    
    const surveyCheck = await pool.query(
      'SELECT id FROM surveys WHERE job_id = $1 ORDER BY created_at DESC LIMIT 1',
      [jobId]
    );
    
    let surveyId;
    if (surveyCheck.rows.length === 0) {
      const newSurvey = await pool.query(`
        INSERT INTO surveys (job_id, surveyor_id, survey_type, status)
        VALUES ($1, $2, 'general', 'draft')
        RETURNING id
      `, [jobId, user?.id]);
      surveyId = newSurvey.rows[0].id;
    } else {
      surveyId = surveyCheck.rows[0].id;
    }
    
    // Generate unique object key for MinIO/S3 storage
    const ext = req.file.originalname.split('.').pop() || 'jpg';
    const safeFilename = `${crypto.randomUUID()}.${ext}`;
    const objectKey = `surveys/${jobId}/${safeFilename}`;
    
    // Upload to object storage (MinIO/S3)
    await uploadFile(
      BUCKETS.PHOTOS,
      objectKey,
      req.file.buffer,
      req.file.mimetype
    );
    
    // Generate presigned URL for client access
    const presignedUrl = await getPresignedDownloadUrl(BUCKETS.PHOTOS, objectKey);
    
    const result = await pool.query(`
      INSERT INTO survey_photos (survey_id, job_id, file_url, uploaded_by, file_size)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [surveyId, jobId, objectKey, user?.id, req.file.size]);
    
    res.json(result.rows[0]);
    
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/jobs/:jobId/survey/photos/:photoId
router.delete('/jobs/:jobId/survey/photos/:photoId', async (req: Request, res: Response) => {
  try {
    const { jobId, photoId } = req.params;
    
    const photo = await pool.query(
      'DELETE FROM survey_photos WHERE id = $1 AND job_id = $2 RETURNING *',
      [photoId, jobId]
    );
    
    if (photo.rows.length === 0) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    
    // Note: Photos are stored in object storage (MinIO/S3)
    // Database record deleted; object storage cleanup handled separately if needed
    
    res.json({ success: true });
    
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
