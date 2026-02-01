-- Fixly Admin Console - Database Schema Migration
-- D1 SQLite compatible

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- =============================================
-- TENANTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    logo_url TEXT,

    -- Plan & Billing
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'professional', 'enterprise')),
    status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'suspended', 'cancelled')),
    trial_ends_at DATETIME,
    subscription_ends_at DATETIME,
    max_users INTEGER NOT NULL DEFAULT 3,
    max_locations INTEGER NOT NULL DEFAULT 1,

    -- MercadoPago Integration
    mp_enabled INTEGER NOT NULL DEFAULT 0,
    mp_access_token TEXT,
    mp_public_key TEXT,
    mp_webhook_configured INTEGER NOT NULL DEFAULT 0,
    mp_last_webhook_at DATETIME,

    -- Settings (JSON)
    settings TEXT DEFAULT '{}',
    branding TEXT DEFAULT '{}',

    -- Metadata
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_plan ON tenants(plan);

-- =============================================
-- LOCATIONS TABLE (Multi-location support)
-- =============================================
CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    province TEXT,
    postal_code TEXT,
    phone TEXT,
    email TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    settings TEXT DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_locations_tenant ON locations(tenant_id);

-- =============================================
-- USERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    tenant_id TEXT REFERENCES tenants(id) ON DELETE SET NULL,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    avatar TEXT,

    -- Role & Permissions
    role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('superadmin', 'admin', 'operator', 'viewer')),

    -- Status
    active INTEGER NOT NULL DEFAULT 1,
    email_verified INTEGER NOT NULL DEFAULT 0,
    email_verified_at DATETIME,

    -- Security
    last_login_at DATETIME,
    last_login_ip TEXT,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until DATETIME,

    -- Metadata
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- =============================================
-- SESSIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- =============================================
-- PAYMENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,

    -- Payment details
    external_id TEXT, -- MercadoPago payment ID
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'ARS',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'refunded')),
    payment_method TEXT,
    installments INTEGER DEFAULT 1,

    -- Payer info
    payer_name TEXT,
    payer_email TEXT,
    payer_document TEXT,

    -- Additional info
    description TEXT,
    metadata TEXT DEFAULT '{}',

    -- Processing
    processed_at DATETIME,
    refunded_at DATETIME,
    refund_reason TEXT,

    -- Metadata
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_external ON payments(external_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at);

-- =============================================
-- SUBSCRIPTIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Subscription details
    external_id TEXT, -- MercadoPago subscription ID
    plan TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'cancelled', 'expired')),
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'ARS',
    billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),

    -- Dates
    starts_at DATETIME,
    ends_at DATETIME,
    next_billing_at DATETIME,
    cancelled_at DATETIME,

    -- Metadata
    metadata TEXT DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- =============================================
-- ORDERS TABLE (Workshop orders/work orders)
-- =============================================
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,

    -- Order info
    order_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'invoiced')),

    -- Customer
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT,

    -- Vehicle (for auto workshops)
    vehicle_plate TEXT,
    vehicle_brand TEXT,
    vehicle_model TEXT,
    vehicle_year INTEGER,
    vehicle_km INTEGER,

    -- Work details
    description TEXT,
    diagnosis TEXT,
    notes TEXT,

    -- Financials
    subtotal REAL NOT NULL DEFAULT 0,
    tax REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,

    -- Dates
    started_at DATETIME,
    completed_at DATETIME,

    -- Metadata
    metadata TEXT DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

-- =============================================
-- AUDIT LOGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT REFERENCES tenants(id) ON DELETE SET NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_email TEXT NOT NULL,

    -- Action details
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,

    -- Changes
    old_value TEXT, -- JSON
    new_value TEXT, -- JSON

    -- Request info
    ip_address TEXT,
    user_agent TEXT,

    -- Metadata
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- =============================================
-- CONFIG TABLE (Global and per-tenant settings)
-- =============================================
CREATE TABLE IF NOT EXISTS config (
    id TEXT PRIMARY KEY,
    tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'string' CHECK (type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, key)
);

CREATE INDEX IF NOT EXISTS idx_config_tenant ON config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_config_key ON config(key);

-- =============================================
-- ACTIVATION CODES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS activation_codes (
    id TEXT PRIMARY KEY,
    tenant_id TEXT REFERENCES tenants(id) ON DELETE SET NULL,
    code TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'used', 'expired')),
    type TEXT NOT NULL DEFAULT 'trial' CHECK (type IN ('trial', 'subscription', 'promo')),

    -- Usage
    trial_days INTEGER DEFAULT 15,
    discount_percent INTEGER DEFAULT 0,
    max_uses INTEGER DEFAULT 1,
    current_uses INTEGER DEFAULT 0,

    -- Expiration
    expires_at DATETIME,
    used_at DATETIME,
    used_by TEXT,

    -- Metadata
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_codes_code ON activation_codes(code);
CREATE INDEX IF NOT EXISTS idx_codes_status ON activation_codes(status);

-- =============================================
-- SEED DATA - Default SuperAdmin
-- =============================================
INSERT OR IGNORE INTO users (
    id, email, name, password_hash, role, active, email_verified, created_at, updated_at
) VALUES (
    'superadmin-001',
    'admin@fixly.com',
    'Super Admin',
    -- Default password: Admin123! (bcrypt hash)
    '$2a$10$rQnM1xZ5L5Z5Z5Z5Z5Z5ZeOKqYqYqYqYqYqYqYqYqYqYqYqYqYqYq',
    'superadmin',
    1,
    1,
    datetime('now'),
    datetime('now')
);

-- =============================================
-- SEED DATA - Global Config
-- =============================================
INSERT OR IGNORE INTO config (id, tenant_id, key, value, type, description) VALUES
    ('cfg-001', NULL, 'app.name', 'Fixly Taller', 'string', 'Application name'),
    ('cfg-002', NULL, 'app.version', '1.0.0', 'string', 'Application version'),
    ('cfg-003', NULL, 'app.timezone', 'America/Argentina/Buenos_Aires', 'string', 'Default timezone'),
    ('cfg-004', NULL, 'app.currency', 'ARS', 'string', 'Default currency'),
    ('cfg-005', NULL, 'app.locale', 'es-AR', 'string', 'Default locale'),
    ('cfg-006', NULL, 'trial.days', '15', 'number', 'Default trial period in days'),
    ('cfg-007', NULL, 'subscription.price', '19900', 'number', 'Monthly subscription price in cents'),
    ('cfg-008', NULL, 'mp.enabled', 'true', 'boolean', 'MercadoPago integration enabled');
