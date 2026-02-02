-- Migration: Add username field and create admin user
-- This migration adds username support and creates the default admin user

-- Add username column to users table (SQLite doesn't support IF NOT EXISTS for columns)
-- Using a try-catch approach by ignoring errors
ALTER TABLE users ADD COLUMN username TEXT;

-- Create unique index for username (allows NULL values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL;

-- Update existing users to have username = name (as fallback)
UPDATE users SET username = LOWER(REPLACE(name, ' ', '')) WHERE username IS NULL;

-- Create or update admin user with username 'admin' and password 'admin628'
-- Password hash for 'admin628' using SHA-256
INSERT OR REPLACE INTO users (
    id,
    email,
    name,
    username,
    password_hash,
    role,
    active,
    email_verified,
    created_at,
    updated_at
) VALUES (
    'admin-main-001',
    'admin@fixlytaller.com',
    'Administrador',
    'admin',
    -- SHA-256 hash for 'admin628'
    '52d7931d84146a194b84fe5b6ce12b2c82e0a23475970544a8c231cc23c08cbb',
    'superadmin',
    1,
    1,
    datetime('now'),
    datetime('now')
);
