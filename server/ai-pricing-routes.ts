import { Router, Request, Response } from "express";
import { calculatePricing, learnFromQuoteLineItems } from "./services/ai-pricing";

const router = Router();

/**
 * POST /api/ai/pricing-wizard
 * Main AI pricing calculation endpoint
 */
router.post('/pricing-wizard', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { trade, jobDescription, measurements, materialPreferences, qualityLevel, urgency } = req.body;

    if (!trade || !jobDescription) {
      return res.status(400).json({ error: 'Trade and job description are required' });
    }

    const result = await calculatePricing({
      trade,
      jobDescription,
      measurements,
      materialPreferences,
      qualityLevel,
      urgency,
    });

    res.json(result);
  } catch (error: any) {
    console.error('AI Pricing Wizard error:', error);
    res.status(500).json({ error: error.message || 'AI pricing calculation failed' });
  }
});

/**
 * POST /api/ai/learn-pricing
 * Store pricing data from completed quotes for learning
 */
router.post('/learn-pricing', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { trade, lineItems } = req.body;

    if (!trade || !lineItems || !Array.isArray(lineItems)) {
      return res.status(400).json({ error: 'Trade and lineItems array are required' });
    }

    await learnFromQuoteLineItems(trade, lineItems);
    res.json({ success: true, message: 'Pricing data stored for future reference' });
  } catch (error: any) {
    console.error('Learn pricing error:', error);
    res.status(500).json({ error: error.message || 'Failed to store pricing data' });
  }
});

/**
 * GET /api/ai/pricing-data/:trade
 * Get learned pricing data for a specific trade
 */
router.get('/pricing-data/:trade', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { pool } = await import('./db');
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM material_prices WHERE trade = $1 ORDER BY data_points DESC, item_name ASC`,
        [req.params.trade.toLowerCase()]
      );
      res.json(result.rows);
    } finally {
      client.release();
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ai/trades
 * Get list of all trades with pricing data
 */
router.get('/trades', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { pool } = await import('./db');
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT trade, COUNT(*) as item_count, SUM(data_points) as total_data_points 
         FROM material_prices 
         GROUP BY trade 
         ORDER BY total_data_points DESC`
      );
      res.json(result.rows);
    } finally {
      client.release();
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
