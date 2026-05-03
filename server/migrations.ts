import { pool } from "./db";

/**
 * Run pending database migrations.
 * Uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS for idempotent execution.
 */
export async function runMigrations() {
  const client = await pool.connect();
  try {
    // Add new columns to quotes table
    await client.query(`
      ALTER TABLE quotes ADD COLUMN IF NOT EXISTS payment_terms text DEFAULT 'Net 30';
      ALTER TABLE quotes ADD COLUMN IF NOT EXISTS custom_payment_terms text;
      ALTER TABLE quotes ADD COLUMN IF NOT EXISTS markup_percentage double precision DEFAULT 0;
    `);

    // Create quote_templates table
    await client.query(`
      CREATE TABLE IF NOT EXISTS quote_templates (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        description text,
        category text,
        line_items jsonb DEFAULT '[]'::jsonb,
        terms text,
        payment_terms text DEFAULT 'Net 30',
        notes text,
        is_default boolean DEFAULT false,
        created_by_id varchar,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);

    console.log("Database migrations completed successfully");
  } catch (error) {
    console.error("Migration error (non-fatal):", error);
  } finally {
    client.release();
  }
}
