import { getOpenAIClient } from "../globalAssistant/openai";
import { pool } from "../db";

export interface PricingWizardInput {
  trade: string;
  jobDescription: string;
  measurements?: {
    length?: number;
    width?: number;
    height?: number;
    area?: number;
    unit?: string; // m, ft
    rooms?: number;
    notes?: string;
  };
  materialPreferences?: string;
  qualityLevel?: 'budget' | 'mid-range' | 'premium';
  urgency?: 'standard' | 'urgent';
}

export interface PricingWizardResult {
  lineItems: Array<{
    type: 'material' | 'labour' | 'custom';
    description: string;
    quantity: number;
    unit: string;
    unitCost: number;
    vatRate: number;
    notes?: string;
  }>;
  summary: {
    materialsCost: number;
    labourCost: number;
    totalBeforeVat: number;
    estimatedDuration: string;
    confidence: 'high' | 'medium' | 'low';
  };
  assumptions: string[];
  recommendations: string[];
}

/**
 * Fetch learned pricing data for a specific trade from the material_prices table
 */
async function getLearnedPrices(trade: string): Promise<string> {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT item_name, unit, avg_unit_cost, wastage_percent, data_points 
         FROM material_prices 
         WHERE trade = $1 
         ORDER BY data_points DESC 
         LIMIT 50`,
        [trade.toLowerCase()]
      );
      if (result.rows.length === 0) return '';
      
      const priceList = result.rows.map(r => 
        `- ${r.item_name}: £${r.avg_unit_cost}/${r.unit} (wastage: ${r.wastage_percent}%, based on ${r.data_points} quotes)`
      ).join('\n');
      
      return `\n\nREFERENCE PRICING DATA (from previous quotes):\n${priceList}\n\nUse these prices as a reference where applicable, but adjust based on current market rates if needed.`;
    } finally {
      client.release();
    }
  } catch {
    return '';
  }
}

/**
 * Store learned prices from completed quotes into the material_prices table
 */
export async function learnFromQuoteLineItems(
  trade: string,
  lineItems: Array<{ type: string; description: string; quantity: number; unit: string; unitCost: number }>
): Promise<void> {
  const client = await pool.connect();
  try {
    for (const item of lineItems) {
      if (!item.description || !item.unitCost || item.unitCost <= 0) continue;
      
      // Check if we have existing data for this item
      const existing = await client.query(
        `SELECT id, avg_unit_cost, min_unit_cost, max_unit_cost, data_points 
         FROM material_prices 
         WHERE trade = $1 AND item_name = $2 AND unit = $3`,
        [trade.toLowerCase(), item.description.toLowerCase(), item.unit || 'each']
      );
      
      if (existing.rows.length > 0) {
        const row = existing.rows[0];
        const newDataPoints = (row.data_points || 1) + 1;
        const newAvg = ((row.avg_unit_cost * row.data_points) + item.unitCost) / newDataPoints;
        const newMin = Math.min(row.min_unit_cost || item.unitCost, item.unitCost);
        const newMax = Math.max(row.max_unit_cost || item.unitCost, item.unitCost);
        
        await client.query(
          `UPDATE material_prices SET avg_unit_cost = $1, min_unit_cost = $2, max_unit_cost = $3, data_points = $4, last_updated = now() WHERE id = $5`,
          [newAvg, newMin, newMax, newDataPoints, row.id]
        );
      } else {
        await client.query(
          `INSERT INTO material_prices (trade, category, item_name, unit, avg_unit_cost, min_unit_cost, max_unit_cost, data_points) VALUES ($1, $2, $3, $4, $5, $5, $5, 1)`,
          [trade.toLowerCase(), item.type || 'material', item.description.toLowerCase(), item.unit || 'each', item.unitCost]
        );
      }
    }
  } catch (error) {
    console.error('Error learning from quote:', error);
  } finally {
    client.release();
  }
}

/**
 * Main AI Pricing Wizard function
 */
export async function calculatePricing(input: PricingWizardInput): Promise<PricingWizardResult> {
  const openai = getOpenAIClient();
  if (!openai) {
    throw new Error('AI service not configured. Please set OPENAI_API_KEY environment variable.');
  }

  // Get learned prices for this trade
  const learnedPrices = await getLearnedPrices(input.trade);

  // Build the measurement context
  let measurementContext = '';
  if (input.measurements) {
    const m = input.measurements;
    const parts: string[] = [];
    if (m.length) parts.push(`Length: ${m.length}${m.unit || 'm'}`);
    if (m.width) parts.push(`Width: ${m.width}${m.unit || 'm'}`);
    if (m.height) parts.push(`Height: ${m.height}${m.unit || 'm'}`);
    if (m.area) parts.push(`Area: ${m.area}${m.unit || 'm'}²`);
    if (m.rooms) parts.push(`Number of rooms/areas: ${m.rooms}`);
    if (m.notes) parts.push(`Notes: ${m.notes}`);
    measurementContext = `\n\nMEASUREMENTS:\n${parts.join('\n')}`;
  }

  const systemPrompt = `You are an expert UK trade pricing calculator for Adapt Services Group, a domestic trade services company covering ALL trades (plumbing, electrical, tiling, decorating, carpentry, roofing, gas, general maintenance, full refurbishments, grounds keeping, etc.).

Your job is to calculate accurate material quantities, costs, and labour estimates for UK trade jobs based on the provided information.

IMPORTANT RULES:
1. All prices in GBP (£)
2. Use current UK market rates (2024-2025 pricing)
3. Include wastage percentages (typically 10-15% for materials)
4. Be specific with material descriptions (include size, grade, brand level)
5. Labour rates: Standard UK trade rates (£180-350/day depending on trade and skill level)
6. VAT: Materials typically 20%, some items 5% (energy saving), labour 20%
7. Always round unit costs to 2 decimal places
8. Consider access, preparation, and finishing in labour estimates
9. Quality level: ${input.qualityLevel || 'mid-range'}
10. Include all sundries (fixings, adhesives, sealants, etc.)

Respond ONLY with valid JSON matching this exact structure:
{
  "lineItems": [
    {
      "type": "material" | "labour" | "custom",
      "description": "Specific item description",
      "quantity": number,
      "unit": "m²" | "metres" | "each" | "litres" | "kg" | "hours" | "days" | "packs" | "rolls" | "bags",
      "unitCost": number (in £),
      "vatRate": 20 | 5 | 0,
      "notes": "optional calculation notes"
    }
  ],
  "summary": {
    "materialsCost": number,
    "labourCost": number,
    "totalBeforeVat": number,
    "estimatedDuration": "e.g. 2-3 days",
    "confidence": "high" | "medium" | "low"
  },
  "assumptions": ["list of assumptions made"],
  "recommendations": ["helpful suggestions or notes"]
}`;

  const userPrompt = `TRADE: ${input.trade}

JOB DESCRIPTION: ${input.jobDescription}${measurementContext}

MATERIAL PREFERENCES: ${input.materialPreferences || 'Standard mid-range quality'}
QUALITY LEVEL: ${input.qualityLevel || 'mid-range'}
URGENCY: ${input.urgency || 'standard'}${learnedPrices}

Please calculate all required materials (with quantities including wastage), labour, and any other costs for this job. Be thorough and include all items needed to complete the job properly.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const result = JSON.parse(content) as PricingWizardResult;
    return result;
  } catch (error: any) {
    console.error('AI Pricing error:', error);
    throw new Error(`AI pricing calculation failed: ${error.message}`);
  }
}
