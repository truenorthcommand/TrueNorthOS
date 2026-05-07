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

    // Add site coordinates to jobs table for map display
    await client.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS site_lat double precision;`);
    await client.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS site_lng double precision;`);
    await client.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS site_address text;`);

    // === WORKFLOW STUDIO TABLES ===

    // Workflows master table
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflows (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        key text UNIQUE NOT NULL,
        name text NOT NULL,
        description text,
        module text NOT NULL DEFAULT 'general',
        enabled boolean DEFAULT false,
        current_version_id varchar,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);

    // Workflow versions (immutable snapshots)
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_versions (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id varchar NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
        version_number integer NOT NULL DEFAULT 1,
        definition jsonb NOT NULL,
        status text NOT NULL DEFAULT 'draft',
        created_by varchar,
        created_at timestamp DEFAULT now(),
        UNIQUE(workflow_id, version_number)
      );
    `);

    // Workflow runs (execution logs)
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_runs (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id varchar NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
        version_id varchar NOT NULL REFERENCES workflow_versions(id),
        trigger_event jsonb,
        status text NOT NULL DEFAULT 'pending',
        idempotency_key text,
        context jsonb DEFAULT '{}',
        error text,
        is_dry_run boolean DEFAULT false,
        started_at timestamp,
        completed_at timestamp,
        created_at timestamp DEFAULT now()
      );
    `);

    // Workflow step logs (per-action detail)
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_step_logs (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id varchar NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
        action_id text NOT NULL,
        action_type text NOT NULL,
        step_order integer NOT NULL DEFAULT 0,
        status text NOT NULL DEFAULT 'pending',
        input jsonb,
        output jsonb,
        error text,
        duration_ms integer,
        started_at timestamp,
        completed_at timestamp
      );
    `);

    // Workflow events outbox
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_events (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type text NOT NULL,
        module text NOT NULL,
        record_id varchar,
        payload jsonb NOT NULL DEFAULT '{}',
        processed boolean DEFAULT false,
        processed_at timestamp,
        created_at timestamp DEFAULT now()
      );
    `);

    // Index for fast outbox polling
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_workflow_events_unprocessed
      ON workflow_events(processed, created_at) WHERE processed = false;
    `);

    // Index for idempotency checks
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_workflow_runs_idempotency
      ON workflow_runs(idempotency_key) WHERE idempotency_key IS NOT NULL;
    `);


    console.log("Database migrations completed successfully");
  } catch (error) {
    console.error("Migration error (non-fatal):", error);
  } finally {
    client.release();
  }
}
