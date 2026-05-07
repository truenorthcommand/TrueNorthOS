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

    // === SURVEYOR PORTAL TABLES ===

    // Surveys master table
    await client.query(`
      CREATE TABLE IF NOT EXISTS surveys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id INTEGER REFERENCES users(id),
        property_id INTEGER,
        surveyor_id INTEGER REFERENCES users(id),
        status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'complete', 'converted')),
        survey_type TEXT DEFAULT 'custom',
        general_notes TEXT,
        condition_rating TEXT,
        access_notes TEXT,
        safety_notes TEXT,
        client_preferences TEXT,
        timeline TEXT,
        gps_lat DOUBLE PRECISION,
        gps_lng DOUBLE PRECISION,
        arrived_at TIMESTAMP,
        departed_at TIMESTAMP,
        quote_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Survey rooms
    await client.query(`
      CREATE TABLE IF NOT EXISTS survey_rooms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
        room_name TEXT NOT NULL,
        room_type TEXT DEFAULT 'custom',
        notes TEXT,
        voice_notes TEXT,
        condition TEXT,
        order_index INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Survey work items
    await client.query(`
      CREATE TABLE IF NOT EXISTS survey_work_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        survey_room_id UUID REFERENCES survey_rooms(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        type TEXT DEFAULT 'both' CHECK (type IN ('material', 'labour', 'both')),
        priority TEXT DEFAULT 'essential' CHECK (priority IN ('essential', 'recommended', 'optional')),
        quantity NUMERIC DEFAULT 1,
        unit TEXT DEFAULT 'each',
        measurements TEXT,
        estimated_cost NUMERIC,
        ai_suggested_price NUMERIC,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Survey media
    await client.query(`
      CREATE TABLE IF NOT EXISTS survey_media (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
        survey_room_id UUID REFERENCES survey_rooms(id) ON DELETE SET NULL,
        media_type TEXT NOT NULL CHECK (media_type IN ('photo', 'video', 'file')),
        url TEXT NOT NULL,
        filename TEXT,
        caption TEXT,
        uploaded_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Survey indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_surveys_client ON surveys(client_id);
      CREATE INDEX IF NOT EXISTS idx_surveys_surveyor ON surveys(surveyor_id);
      CREATE INDEX IF NOT EXISTS idx_surveys_status ON surveys(status);
      CREATE INDEX IF NOT EXISTS idx_survey_rooms_survey ON survey_rooms(survey_id);
      CREATE INDEX IF NOT EXISTS idx_survey_work_items_room ON survey_work_items(survey_room_id);
      CREATE INDEX IF NOT EXISTS idx_survey_media_survey ON survey_media(survey_id);
    `);

    // === ENQUIRIES TABLE ===
    await client.query(`
      CREATE TABLE IF NOT EXISTS enquiries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id INTEGER REFERENCES users(id),
        property_id VARCHAR REFERENCES client_properties(id),
        source TEXT NOT NULL DEFAULT 'phone' CHECK (source IN ('phone', 'email', 'website', 'referral', 'repeat_customer', 'client_portal')),
        description TEXT NOT NULL,
        client_requirements TEXT,
        budget_indication TEXT,
        urgency TEXT NOT NULL DEFAULT 'standard' CHECK (urgency IN ('emergency', 'urgent', 'standard', 'flexible')),
        preferred_dates TEXT,
        assigned_to INTEGER REFERENCES users(id),
        status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'survey_booked', 'survey_complete', 'quote_sent', 'won', 'lost', 'cancelled')),
        lost_reason TEXT,
        survey_id UUID,
        quote_id UUID,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_enquiries_client ON enquiries(client_id);
      CREATE INDEX IF NOT EXISTS idx_enquiries_status ON enquiries(status);
      CREATE INDEX IF NOT EXISTS idx_enquiries_assigned ON enquiries(assigned_to);
      CREATE INDEX IF NOT EXISTS idx_enquiries_created ON enquiries(created_at DESC);
    `);

    // === ADD MEASUREMENT COLUMNS TO SURVEY TABLES ===
    await client.query(`
      ALTER TABLE survey_rooms ADD COLUMN IF NOT EXISTS length_m DECIMAL;
      ALTER TABLE survey_rooms ADD COLUMN IF NOT EXISTS width_m DECIMAL;
      ALTER TABLE survey_rooms ADD COLUMN IF NOT EXISTS height_m DECIMAL;
      ALTER TABLE survey_rooms ADD COLUMN IF NOT EXISTS condition TEXT;
      ALTER TABLE survey_rooms ADD COLUMN IF NOT EXISTS checklist_ref JSONB;
    `);

    await client.query(`
      ALTER TABLE survey_work_items ADD COLUMN IF NOT EXISTS length_m DECIMAL;
      ALTER TABLE survey_work_items ADD COLUMN IF NOT EXISTS width_m DECIMAL;
      ALTER TABLE survey_work_items ADD COLUMN IF NOT EXISTS height_m DECIMAL;
      ALTER TABLE survey_work_items ADD COLUMN IF NOT EXISTS notes TEXT;
    `);

    await client.query(`
      ALTER TABLE surveys ADD COLUMN IF NOT EXISTS enquiry_id UUID;
    `);

    // === JOB PHASES TABLE ===
    await client.query(`
      CREATE TABLE IF NOT EXISTS job_phases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
        phase_number INTEGER NOT NULL DEFAULT 1,
        title TEXT NOT NULL,
        description TEXT,
        trade_type TEXT,
        assigned_to INTEGER REFERENCES users(id),
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'in_progress', 'complete', 'skipped')),
        estimated_duration TEXT,
        depends_on UUID REFERENCES job_phases(id),
        scheduled_date DATE,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        sign_off_notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_job_phases_job ON job_phases(job_id);
      CREATE INDEX IF NOT EXISTS idx_job_phases_status ON job_phases(status);
      CREATE INDEX IF NOT EXISTS idx_job_phases_assigned ON job_phases(assigned_to);
    `);

    // === VARIATION ORDERS TABLE ===
    await client.query(`
      CREATE TABLE IF NOT EXISTS variation_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        reason TEXT,
        additional_cost DECIMAL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'rejected')),
        approved_by TEXT,
        approved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_variation_orders_job ON variation_orders(job_id);
    `);

    // === SNAG LIST TABLE ===
    await client.query(`
      CREATE TABLE IF NOT EXISTS snag_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        location TEXT,
        severity TEXT DEFAULT 'minor' CHECK (severity IN ('minor', 'major', 'critical')),
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'accepted')),
        assigned_to INTEGER REFERENCES users(id),
        photo_url TEXT,
        resolution_notes TEXT,
        reported_by INTEGER REFERENCES users(id),
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_snag_items_job ON snag_items(job_id);
      CREATE INDEX IF NOT EXISTS idx_snag_items_status ON snag_items(status);
    `);

    // === SIGN-OFF TABLE ===
    await client.query(`
      CREATE TABLE IF NOT EXISTS job_signoffs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
        signed_off_by INTEGER REFERENCES users(id),
        sign_off_type TEXT DEFAULT 'final' CHECK (sign_off_type IN ('phase', 'snag', 'final')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        notes TEXT,
        rejection_reason TEXT,
        customer_satisfied BOOLEAN,
        quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
        created_at TIMESTAMP DEFAULT NOW(),
        approved_at TIMESTAMP
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_job_signoffs_job ON job_signoffs(job_id);
    `);

    // === ADD QUOTE/ENQUIRY LINKING TO JOBS ===
    await client.query(`
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS quote_id INTEGER;
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS enquiry_id UUID;
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_complex BOOLEAN DEFAULT FALSE;
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP;
    `);

    console.log("Database migrations completed successfully");
  } catch (error) {
    console.error("Migration error (non-fatal):", error);
  } finally {
    client.release();
  }
}
