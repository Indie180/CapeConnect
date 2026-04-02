-- Add security columns to users table
-- Migration: 2026-03-23_add_security_columns.sql

-- Add failed login attempt tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- Add session activity tracking
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ DEFAULT NOW();

-- Update existing sessions to have last_activity
UPDATE sessions SET last_activity = created_at WHERE last_activity IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_failed_attempts ON users(failed_attempts) WHERE failed_attempts > 0;
CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until) WHERE locked_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity);

-- Add comments for documentation
COMMENT ON COLUMN users.failed_attempts IS 'Number of consecutive failed login attempts';
COMMENT ON COLUMN users.locked_until IS 'Account locked until this timestamp due to failed attempts';
COMMENT ON COLUMN sessions.last_activity IS 'Last time this session was used for activity tracking';