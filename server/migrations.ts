import { pool } from "./db";

/**
 * Run pending database migrations.
 * Uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS for idempotent execution.
 * Each section is wrapped in its own try/catch for resilience.
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
        category text DEFAULT 'general',
        line_items jsonb DEFAULT '[]'::jsonb,
        terms_and_conditions text,
        notes text,
        is_active boolean DEFAULT true,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);

    // Create material_prices table
    await client.query(`
      CREATE TABLE IF NOT EXISTS material_prices (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        category text DEFAULT 'general',
        unit text DEFAULT 'each',
        unit_price numeric NOT NULL,
        supplier text,
        last_updated timestamp DEFAULT now(),
        is_active boolean DEFAULT true,
        notes text,
        created_at timestamp DEFAULT now()
      );
    `);

    // Create gps_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS gps_logs (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar REFERENCES users(id),
        latitude double precision NOT NULL,
        longitude double precision NOT NULL,
        accuracy double precision,
        speed double precision,
        heading double precision,
        altitude double precision,
        timestamp timestamp DEFAULT now(),
        session_id text
      );
    `);

    // Create walkaround_checks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS walkaround_checks (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar REFERENCES users(id),
        vehicle_id varchar,
        fleet_number text,
        registration text,
        mileage integer,
        status text DEFAULT 'pending',
        checks jsonb DEFAULT '[]'::jsonb,
        photos jsonb DEFAULT '[]'::jsonb,
        signature text,
        notes text,
        submitted_at timestamp,
        created_at timestamp DEFAULT now()
      );
    `);

    // Create workflows table
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflows (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        description text,
        trigger_type text NOT NULL DEFAULT 'manual',
        trigger_config jsonb DEFAULT '{}'::jsonb,
        is_active boolean DEFAULT true,
        created_by varchar REFERENCES users(id),
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);

    // Create workflow_versions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_versions (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id varchar REFERENCES workflows(id) ON DELETE CASCADE,
        version integer NOT NULL DEFAULT 1,
        steps jsonb NOT NULL DEFAULT '[]'::jsonb,
        is_published boolean DEFAULT false,
        published_at timestamp,
        created_at timestamp DEFAULT now()
      );
    `);

    // Create workflow_runs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_runs (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id varchar REFERENCES workflows(id) ON DELETE CASCADE,
        version_id varchar REFERENCES workflow_versions(id),
        status text NOT NULL DEFAULT 'running',
        trigger_data jsonb DEFAULT '{}'::jsonb,
        context jsonb DEFAULT '{}'::jsonb,
        current_step integer DEFAULT 0,
        started_at timestamp DEFAULT now(),
        completed_at timestamp,
        error text,
        created_by varchar REFERENCES users(id)
      );
    `);

    // Create workflow_step_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_step_logs (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id varchar REFERENCES workflow_runs(id) ON DELETE CASCADE,
        step_index integer NOT NULL,
        step_type text NOT NULL,
        step_config jsonb DEFAULT '{}'::jsonb,
        status text NOT NULL DEFAULT 'pending',
        input jsonb DEFAULT '{}'::jsonb,
        output jsonb DEFAULT '{}'::jsonb,
        error text,
        started_at timestamp,
        completed_at timestamp
      );
    `);

    // Create workflow_events table
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_events (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id varchar REFERENCES workflows(id) ON DELETE CASCADE,
        run_id varchar REFERENCES workflow_runs(id) ON DELETE CASCADE,
        event_type text NOT NULL,
        event_data jsonb DEFAULT '{}'::jsonb,
        created_at timestamp DEFAULT now()
      );
    `);

  } catch (error) {
    console.error("Migration error (base tables - non-fatal):", error);
  }

  // === SURVEYOR PORTAL TABLES (isolated try/catch) ===
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS surveys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id VARCHAR REFERENCES users(id),
        property_id VARCHAR REFERENCES client_properties(id),
        surveyor_id VARCHAR REFERENCES users(id),
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
        quote_id VARCHAR,
        enquiry_id UUID,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("[Migration] surveys table OK");
  } catch (e: any) {
    console.error("[Migration] surveys table error:", e.message);
  }

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS survey_rooms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
        room_name TEXT NOT NULL,
        room_type TEXT DEFAULT 'custom',
        notes TEXT,
        voice_notes TEXT,
        condition TEXT,
        length_m DECIMAL,
        width_m DECIMAL,
        height_m DECIMAL,
        checklist_ref JSONB,
        order_index INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("[Migration] survey_rooms table OK");
  } catch (e: any) {
    console.error("[Migration] survey_rooms table error:", e.message);
  }

  try {
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
        length_m DECIMAL,
        width_m DECIMAL,
        height_m DECIMAL,
        notes TEXT,
        estimated_cost NUMERIC,
        ai_suggested_price NUMERIC,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("[Migration] survey_work_items table OK");
  } catch (e: any) {
    console.error("[Migration] survey_work_items table error:", e.message);
  }

  try {
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
    console.log("[Migration] survey_media table OK");
  } catch (e: any) {
    console.error("[Migration] survey_media table error:", e.message);
  }

  try {
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_surveys_client ON surveys(client_id);
      CREATE INDEX IF NOT EXISTS idx_surveys_surveyor ON surveys(surveyor_id);
      CREATE INDEX IF NOT EXISTS idx_surveys_status ON surveys(status);
      CREATE INDEX IF NOT EXISTS idx_survey_rooms_survey ON survey_rooms(survey_id);
      CREATE INDEX IF NOT EXISTS idx_survey_work_items_room ON survey_work_items(survey_room_id);
      CREATE INDEX IF NOT EXISTS idx_survey_media_survey ON survey_media(survey_id);
    `);
    console.log("[Migration] survey indexes OK");
  } catch (e: any) {
    console.error("[Migration] survey indexes error:", e.message);
  }

  // === ENQUIRIES TABLE ===
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS enquiries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id VARCHAR REFERENCES users(id),
        property_id VARCHAR REFERENCES client_properties(id),
        source TEXT NOT NULL DEFAULT 'phone' CHECK (source IN ('phone', 'email', 'website', 'referral', 'repeat_customer', 'client_portal')),
        description TEXT NOT NULL,
        client_requirements TEXT,
        budget_indication TEXT,
        urgency TEXT NOT NULL DEFAULT 'standard' CHECK (urgency IN ('emergency', 'urgent', 'standard', 'flexible')),
        preferred_dates TEXT,
        assigned_to VARCHAR REFERENCES users(id),
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
    console.log("[Migration] enquiries table + indexes OK");
  } catch (e: any) {
    console.error("[Migration] enquiries error:", e.message);
  }

  // === FIX: Drop incorrect FK constraints (client_id should reference clients, not users) ===
  try {
    await client.query(`
      ALTER TABLE enquiries DROP CONSTRAINT IF EXISTS enquiries_client_id_fkey;
      ALTER TABLE enquiries DROP CONSTRAINT IF EXISTS enquiries_client_id_users_fkey;
      ALTER TABLE surveys DROP CONSTRAINT IF EXISTS surveys_client_id_fkey;
      ALTER TABLE surveys DROP CONSTRAINT IF EXISTS surveys_client_id_users_fkey;
    `);
    console.log("[Migration] FK constraint fixes OK");
  } catch (e: any) {
    console.error("[Migration] FK constraint fixes error:", e.message);
  }

  // === ADD MEASUREMENT COLUMNS TO SURVEY TABLES (safe even if columns exist) ===
  try {
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
    console.log("[Migration] survey measurement columns OK");
  } catch (e: any) {
    console.error("[Migration] survey columns error:", e.message);
  }

  // === JOB-CENTRIC SURVEY ENHANCEMENTS ===
  try {
    await client.query(`
      ALTER TABLE surveys ADD COLUMN IF NOT EXISTS job_id VARCHAR;
      CREATE INDEX IF NOT EXISTS idx_surveys_job_id ON surveys(job_id);
      -- Fix type if previously created as UUID
      ALTER TABLE surveys ALTER COLUMN job_id TYPE VARCHAR USING job_id::VARCHAR;
      ALTER TABLE surveys ADD COLUMN IF NOT EXISTS surveyor_notes TEXT;
      ALTER TABLE surveys ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
      ALTER TABLE surveys ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP;
      ALTER TABLE surveys ADD COLUMN IF NOT EXISTS submitted_by VARCHAR;
      ALTER TABLE surveys ADD COLUMN IF NOT EXISTS last_auto_save_at TIMESTAMP;
    `);
    console.log("[Migration] job-centric survey columns OK");
  } catch (e: any) {
    console.error("[Migration] job-centric survey columns error:", e.message);
  }

  // === SURVEY PHOTOS TABLE ===
  try {
    // Fix: drop table if it exists with wrong column type (UUID vs VARCHAR for job_id)
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'survey_photos' AND column_name = 'job_id' AND data_type = 'uuid') THEN
          DROP TABLE survey_photos CASCADE;
        END IF;
      END $$;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS survey_photos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
        job_id VARCHAR REFERENCES jobs(id) ON DELETE CASCADE,
        file_url TEXT NOT NULL,
        caption TEXT,
        uploaded_by VARCHAR NOT NULL,
        uploaded_at TIMESTAMP DEFAULT NOW(),
        file_size INT
      );
      CREATE INDEX IF NOT EXISTS idx_survey_photos_job ON survey_photos(job_id);
      CREATE INDEX IF NOT EXISTS idx_survey_photos_survey ON survey_photos(survey_id);
    `);
    console.log("[Migration] survey_photos table OK");
  } catch (e: any) {
    console.error("[Migration] survey_photos table error:", e.message);
  }

  // === JOB PHASES TABLE ===
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS job_phases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id VARCHAR REFERENCES jobs(id) ON DELETE CASCADE,
        phase_number INTEGER NOT NULL DEFAULT 1,
        title TEXT NOT NULL,
        description TEXT,
        trade_type TEXT,
        assigned_to VARCHAR REFERENCES users(id),
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'in_progress', 'complete', 'skipped')),
        estimated_duration TEXT,
        depends_on UUID,
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
    console.log("[Migration] job_phases table + indexes OK");
  } catch (e: any) {
    console.error("[Migration] job_phases error:", e.message);
  }

  // === VARIATION ORDERS TABLE ===
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS variation_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id VARCHAR REFERENCES jobs(id) ON DELETE CASCADE,
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
    console.log("[Migration] variation_orders table + indexes OK");
  } catch (e: any) {
    console.error("[Migration] variation_orders error:", e.message);
  }

  // === SNAG LIST TABLE ===
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS snag_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id VARCHAR,
        description TEXT NOT NULL DEFAULT '',
        location TEXT,
        severity TEXT DEFAULT 'minor',
        status TEXT NOT NULL DEFAULT 'open',
        assigned_to VARCHAR,
        photo_url TEXT,
        resolution_notes TEXT,
        reported_by VARCHAR,
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    // Ensure columns exist if table was created by older migration
    await client.query(`
      ALTER TABLE snag_items ADD COLUMN IF NOT EXISTS job_id VARCHAR;
      ALTER TABLE snag_items ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
      ALTER TABLE snag_items ADD COLUMN IF NOT EXISTS location TEXT;
      ALTER TABLE snag_items ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'minor';
      ALTER TABLE snag_items ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';
      ALTER TABLE snag_items ADD COLUMN IF NOT EXISTS assigned_to VARCHAR;
      ALTER TABLE snag_items ADD COLUMN IF NOT EXISTS photo_url TEXT;
      ALTER TABLE snag_items ADD COLUMN IF NOT EXISTS resolution_notes TEXT;
      ALTER TABLE snag_items ADD COLUMN IF NOT EXISTS reported_by VARCHAR;
      ALTER TABLE snag_items ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;
      ALTER TABLE snag_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
      ALTER TABLE snag_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
    `);
    // Make snagging_sheet_id nullable (was NOT NULL from Drizzle schema - conflicts with job-linked snags)
    await client.query(`
      ALTER TABLE snag_items ALTER COLUMN snagging_sheet_id DROP NOT NULL;
      ALTER TABLE snag_items ALTER COLUMN category DROP NOT NULL;
      ALTER TABLE snag_items ALTER COLUMN location DROP NOT NULL;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_snag_items_job ON snag_items(job_id);
      CREATE INDEX IF NOT EXISTS idx_snag_items_status ON snag_items(status);
    `);
    console.log("[Migration] snag_items table + indexes OK");
  } catch (e: any) {
    console.error("[Migration] snag_items error:", e.message);
  }

  // === SIGN-OFF TABLE ===
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS job_signoffs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id VARCHAR REFERENCES jobs(id) ON DELETE CASCADE,
        signed_off_by VARCHAR REFERENCES users(id),
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
    console.log("[Migration] job_signoffs table + indexes OK");
  } catch (e: any) {
    console.error("[Migration] job_signoffs error:", e.message);
  }

  // === ADD QUOTE/ENQUIRY LINKING TO JOBS ===
  try {
    await client.query(`
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS quote_id VARCHAR;
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS enquiry_id UUID;
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_complex BOOLEAN DEFAULT FALSE;
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP;
    `);
    console.log("[Migration] jobs columns OK");
  } catch (e: any) {
    console.error("[Migration] jobs columns error:", e.message);
  }

  // === BOOKINGS TABLE ===
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_type TEXT NOT NULL DEFAULT 'job' CHECK (booking_type IN ('job', 'survey', 'inspection', 'signoff_visit', 'quote_visit', 'snag_check')),
        assigned_to VARCHAR REFERENCES users(id),
        assigned_role TEXT NOT NULL DEFAULT 'engineer' CHECK (assigned_role IN ('engineer', 'surveyor', 'works_manager')),
        client_id VARCHAR,
        property_id VARCHAR,
        scheduled_date DATE NOT NULL,
        scheduled_time_start TIME,
        scheduled_time_end TIME,
        estimated_duration_mins INTEGER DEFAULT 60,
        travel_time_mins INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'en_route', 'in_progress', 'completed', 'cancelled', 'rescheduled')),
        linked_entity_type TEXT CHECK (linked_entity_type IN ('job', 'survey', 'enquiry', 'quote', 'signoff')),
        linked_entity_id VARCHAR,
        priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
        notes TEXT,
        address TEXT,
        postcode TEXT,
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION,
        created_by VARCHAR REFERENCES users(id),
        confirmed_at TIMESTAMP,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        cancelled_reason TEXT,
        calendar_color TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_bookings_assigned ON bookings(assigned_to);
      CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(scheduled_date);
      CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
      CREATE INDEX IF NOT EXISTS idx_bookings_type ON bookings(booking_type);
      CREATE INDEX IF NOT EXISTS idx_bookings_linked ON bookings(linked_entity_type, linked_entity_id);
    `);
    console.log("[Migration] bookings table + indexes OK");
  } catch (e: any) {
    console.error("[Migration] bookings error:", e.message);
  }

  // === FEEDBACK TABLE ===
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR REFERENCES users(id),
        user_name TEXT,
        user_email TEXT,
        user_role TEXT,
        category TEXT NOT NULL DEFAULT 'bug' CHECK (category IN ('bug', 'improvement', 'feature', 'other')),
        priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
        subject TEXT NOT NULL,
        description TEXT NOT NULL,
        page_url TEXT,
        screenshot_url TEXT,
        status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'in_progress', 'resolved', 'closed', 'wont_fix')),
        admin_notes TEXT,
        resolved_at TIMESTAMP,
        resolved_by VARCHAR REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
      CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id);
      CREATE INDEX IF NOT EXISTS idx_feedback_category ON feedback(category);
      CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at DESC);
    `);
    console.log("[Migration] feedback table + indexes OK");
  } catch (e: any) {
    console.error("[Migration] feedback table error:", e.message);
  }

  // Feedback table - add missing columns (table may have been created by Drizzle without these)
  try {
    await client.query(`
      ALTER TABLE feedback ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';
      ALTER TABLE feedback ADD COLUMN IF NOT EXISTS page_url TEXT;
      ALTER TABLE feedback ADD COLUMN IF NOT EXISTS screenshot_url TEXT;
      ALTER TABLE feedback ADD COLUMN IF NOT EXISTS user_email TEXT;
      ALTER TABLE feedback ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;
      ALTER TABLE feedback ADD COLUMN IF NOT EXISTS resolved_by VARCHAR;
    `);
    console.log("[Migration] feedback columns OK");
  } catch (e: any) {
    console.error("[Migration] feedback columns error:", e.message);
  }

  // === QUOTE TOKENS TABLE (for email accept/reject workflow) ===
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS quote_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        quote_id VARCHAR NOT NULL,
        token VARCHAR(64) UNIQUE NOT NULL,
        action VARCHAR(20) NOT NULL DEFAULT 'pending',
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        customer_name VARCHAR,
        customer_email VARCHAR,
        feedback TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_quote_tokens_token ON quote_tokens(token);
      CREATE INDEX IF NOT EXISTS idx_quote_tokens_quote_id ON quote_tokens(quote_id);
    `);
    console.log("[Migration] quote_tokens table OK");
  } catch (e: any) {
    console.error("[Migration] quote_tokens table error:", e.message);
  }

  console.log("[Migration] All migrations completed");
  client.release();
}
