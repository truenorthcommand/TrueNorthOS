-- Migration: Add security fields and backup codes table
-- Remove Google OAuth dependency
-- Enable closed-loop authentication system

-- Add new security columns to users table
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS first_login_completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS password_expires_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS require_password_change BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS account_created_by VARCHAR,
  ADD COLUMN IF NOT EXISTS last_password_reset_by VARCHAR,
  ADD COLUMN IF NOT EXISTS last_password_reset_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS account_locked_until TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_login_ip TEXT;

-- Mark existing users as having completed first login
-- This prevents forcing existing users through the onboarding flow
UPDATE users 
SET first_login_completed = true, 
    require_password_change = false,
    password_set_at = NOW()
WHERE password IS NOT NULL;

-- Remove Google OAuth column (no longer needed)
ALTER TABLE users DROP COLUMN IF EXISTS google_id;

-- Create backup codes table for 2FA recovery
CREATE TABLE IF NOT EXISTS backup_codes (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMP,
  used_from_ip TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_failed_login_attempts ON users(failed_login_attempts);
CREATE INDEX IF NOT EXISTS idx_users_account_locked_until ON users(account_locked_until);
CREATE INDEX IF NOT EXISTS idx_users_first_login_completed ON users(first_login_completed);
CREATE INDEX IF NOT EXISTS idx_backup_codes_user_id ON backup_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_backup_codes_used ON backup_codes(used) WHERE used = false;

-- Add foreign key constraints for audit trail
ALTER TABLE users 
  ADD CONSTRAINT fk_account_created_by FOREIGN KEY (account_created_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_last_password_reset_by FOREIGN KEY (last_password_reset_by) REFERENCES users(id) ON DELETE SET NULL;
