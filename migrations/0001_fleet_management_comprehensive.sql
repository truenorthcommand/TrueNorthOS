-- Fleet Management System Comprehensive Migration for TrueNorthOS
-- PostgreSQL version
-- Created: 2026-05-20
-- Description: Complete fleet management with vehicle tracking, equipment, MOT, insurance, tax, service records, and automated reminders

-- Enhance existing vehicles table with additional fields
-- Keep existing fields for backward compatibility
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vin TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vehicle_type TEXT DEFAULT 'van';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS current_mileage INTEGER DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS fuel_type TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS purchase_date TIMESTAMP;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS purchase_cost DOUBLE PRECISION;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Add unique constraint on registration if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_registration_unique') THEN
        ALTER TABLE vehicles ADD CONSTRAINT vehicles_registration_unique UNIQUE (registration);
    END IF;
END $$;

-- Create vehicle_equipment table for tracking roof racks, ladders, etc.
CREATE TABLE IF NOT EXISTS vehicle_equipment (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id VARCHAR NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    equipment_type TEXT NOT NULL, -- roof_rack, ladder, tool_box, other
    description TEXT NOT NULL,
    serial_number TEXT,
    condition TEXT NOT NULL DEFAULT 'good', -- excellent, good, fair, poor
    purchase_date TIMESTAMP,
    purchase_cost DOUBLE PRECISION,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_equipment_vehicle_id ON vehicle_equipment(vehicle_id);

-- Create vehicle_assignments table for complete assignment history
CREATE TABLE IF NOT EXISTS vehicle_assignments (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id VARCHAR NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    user_id VARCHAR NOT NULL REFERENCES users(id),
    assigned_date TIMESTAMP NOT NULL DEFAULT NOW(),
    returned_date TIMESTAMP,
    assigned_mileage INTEGER NOT NULL,
    returned_mileage INTEGER,
    purpose TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_assignments_vehicle_id ON vehicle_assignments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_assignments_user_id ON vehicle_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_assignments_assigned_date ON vehicle_assignments(assigned_date);

-- Create mot_records table for MOT tracking
CREATE TABLE IF NOT EXISTS mot_records (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id VARCHAR NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    test_date TIMESTAMP NOT NULL,
    expiry_date TIMESTAMP NOT NULL,
    test_center TEXT,
    result TEXT NOT NULL, -- pass, pass_with_advisory, fail
    mileage INTEGER NOT NULL,
    cost DOUBLE PRECISION,
    advisory_items TEXT,
    certificate_number TEXT,
    reminder_sent BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mot_records_vehicle_id ON mot_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_mot_records_expiry_date ON mot_records(expiry_date);

-- Create insurance_records table
CREATE TABLE IF NOT EXISTS insurance_records (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id VARCHAR NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    policy_number TEXT NOT NULL,
    start_date TIMESTAMP NOT NULL,
    expiry_date TIMESTAMP NOT NULL,
    coverage_type TEXT NOT NULL, -- comprehensive, third_party, third_party_fire_theft
    premium DOUBLE PRECISION NOT NULL,
    excess_amount DOUBLE PRECISION,
    named_drivers TEXT,
    reminder_sent BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_records_vehicle_id ON insurance_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_insurance_records_expiry_date ON insurance_records(expiry_date);

-- Create road_tax_records table
CREATE TABLE IF NOT EXISTS road_tax_records (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id VARCHAR NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    start_date TIMESTAMP NOT NULL,
    expiry_date TIMESTAMP NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    payment_reference TEXT,
    tax_band TEXT,
    reminder_sent BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_road_tax_records_vehicle_id ON road_tax_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_road_tax_records_expiry_date ON road_tax_records(expiry_date);

-- Create service_records table
CREATE TABLE IF NOT EXISTS service_records (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id VARCHAR NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    service_date TIMESTAMP NOT NULL,
    service_type TEXT NOT NULL, -- routine, major, repair, inspection
    mileage INTEGER NOT NULL,
    service_center TEXT,
    cost DOUBLE PRECISION NOT NULL,
    work_description TEXT NOT NULL,
    parts_replaced TEXT,
    next_service_due TIMESTAMP,
    next_service_mileage INTEGER,
    invoice_number TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_records_vehicle_id ON service_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_service_records_service_date ON service_records(service_date);

-- Create fuel_records table for cost tracking
CREATE TABLE IF NOT EXISTS fuel_records (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id VARCHAR NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    date TIMESTAMP NOT NULL DEFAULT NOW(),
    liters DOUBLE PRECISION NOT NULL,
    cost DOUBLE PRECISION NOT NULL,
    price_per_liter DOUBLE PRECISION NOT NULL,
    mileage INTEGER NOT NULL,
    fuel_station TEXT,
    receipt_photo TEXT,
    user_id VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fuel_records_vehicle_id ON fuel_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fuel_records_date ON fuel_records(date);

-- Create reminders table for automated notifications (4 weeks before expiry)
CREATE TABLE IF NOT EXISTS reminders (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id VARCHAR NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    reminder_type TEXT NOT NULL, -- mot, insurance, tax, service
    due_date TIMESTAMP NOT NULL,
    reminder_date TIMESTAMP NOT NULL, -- Calculated: due_date - 28 days
    status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, completed, overdue
    notified_users JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_vehicle_id ON reminders(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_reminders_reminder_date ON reminders(reminder_date);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);

-- Create trigger to update updated_at on reminders
CREATE OR REPLACE FUNCTION update_reminders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_reminders_updated_at ON reminders;
CREATE TRIGGER trigger_update_reminders_updated_at
BEFORE UPDATE ON reminders
FOR EACH ROW
EXECUTE FUNCTION update_reminders_updated_at();

-- Create function to automatically create reminder when adding MOT/Insurance/Tax records
CREATE OR REPLACE FUNCTION create_automatic_reminder()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'mot_records' THEN
        INSERT INTO reminders (vehicle_id, reminder_type, due_date, reminder_date, status)
        VALUES (
            NEW.vehicle_id,
            'mot',
            NEW.expiry_date,
            NEW.expiry_date - INTERVAL '28 days',
            'pending'
        );
    ELSIF TG_TABLE_NAME = 'insurance_records' THEN
        INSERT INTO reminders (vehicle_id, reminder_type, due_date, reminder_date, status)
        VALUES (
            NEW.vehicle_id,
            'insurance',
            NEW.expiry_date,
            NEW.expiry_date - INTERVAL '28 days',
            'pending'
        );
    ELSIF TG_TABLE_NAME = 'road_tax_records' THEN
        INSERT INTO reminders (vehicle_id, reminder_type, due_date, reminder_date, status)
        VALUES (
            NEW.vehicle_id,
            'tax',
            NEW.expiry_date,
            NEW.expiry_date - INTERVAL '28 days',
            'pending'
        );
    ELSIF TG_TABLE_NAME = 'service_records' AND NEW.next_service_due IS NOT NULL THEN
        INSERT INTO reminders (vehicle_id, reminder_type, due_date, reminder_date, status)
        VALUES (
            NEW.vehicle_id,
            'service',
            NEW.next_service_due,
            NEW.next_service_due - INTERVAL '28 days',
            'pending'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic reminder creation
DROP TRIGGER IF EXISTS trigger_mot_reminder ON mot_records;
CREATE TRIGGER trigger_mot_reminder
AFTER INSERT ON mot_records
FOR EACH ROW
EXECUTE FUNCTION create_automatic_reminder();

DROP TRIGGER IF EXISTS trigger_insurance_reminder ON insurance_records;
CREATE TRIGGER trigger_insurance_reminder
AFTER INSERT ON insurance_records
FOR EACH ROW
EXECUTE FUNCTION create_automatic_reminder();

DROP TRIGGER IF EXISTS trigger_tax_reminder ON road_tax_records;
CREATE TRIGGER trigger_tax_reminder
AFTER INSERT ON road_tax_records
FOR EACH ROW
EXECUTE FUNCTION create_automatic_reminder();

DROP TRIGGER IF EXISTS trigger_service_reminder ON service_records;
CREATE TRIGGER trigger_service_reminder
AFTER INSERT ON service_records
FOR EACH ROW
EXECUTE FUNCTION create_automatic_reminder();

-- Grant permissions (adjust as needed for your user/role setup)
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

-- Migration complete
COMMENT ON TABLE vehicle_equipment IS 'Tracks equipment attached to vehicles (roof racks, ladders, tool boxes)';
COMMENT ON TABLE vehicle_assignments IS 'Complete history of vehicle assignments to users';
COMMENT ON TABLE mot_records IS 'MOT test records and tracking with automated 4-week reminders';
COMMENT ON TABLE insurance_records IS 'Vehicle insurance tracking with automated 4-week reminders';
COMMENT ON TABLE road_tax_records IS 'Road tax tracking with automated 4-week reminders';
COMMENT ON TABLE service_records IS 'Vehicle service and maintenance history';
COMMENT ON TABLE fuel_records IS 'Fuel cost tracking and consumption history';
COMMENT ON TABLE reminders IS 'Automated reminder system for expiring documents (4 weeks notice)';
