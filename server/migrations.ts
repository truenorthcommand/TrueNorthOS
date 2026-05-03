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

    // Create material_prices table (AI learning database)
    await client.query(`
      CREATE TABLE IF NOT EXISTS material_prices (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        trade text NOT NULL,
        category text NOT NULL,
        item_name text NOT NULL,
        unit text NOT NULL,
        avg_unit_cost double precision NOT NULL,
        min_unit_cost double precision,
        max_unit_cost double precision,
        wastage_percent double precision DEFAULT 10,
        data_points integer DEFAULT 1,
        last_updated timestamp DEFAULT now(),
        created_at timestamp DEFAULT now()
      );
    `);

    // Create gps_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS gps_logs (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL,
        latitude double precision NOT NULL,
        longitude double precision NOT NULL,
        accuracy double precision,
        job_id varchar,
        action text DEFAULT 'check-in',
        logged_at timestamp DEFAULT now()
      );
    `);

    // Create walkaround_checks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS walkaround_checks (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL,
        checks jsonb DEFAULT '{}',
        defects jsonb DEFAULT '[]',
        vehicle_safe boolean DEFAULT true,
        latitude double precision,
        longitude double precision,
        completed_at timestamp DEFAULT now()
      );
    `);

    console.log("Database migrations completed successfully");
  } catch (error) {
    console.error("Migration error (non-fatal):", error);
  } finally {
    client.release();
  }
}
