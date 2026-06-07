-- Migration: Add client address fields to quotes table
-- Created: 2026-06-07
-- Purpose: Separate client business address from site/work location address

ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS client_address TEXT,
ADD COLUMN IF NOT EXISTS client_postcode TEXT;

-- Add helpful comment
COMMENT ON COLUMN quotes.client_address IS 'Client business/billing address (distinct from site address where work is performed)';
COMMENT ON COLUMN quotes.client_postcode IS 'Client business address postcode';
