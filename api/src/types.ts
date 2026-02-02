export interface Env {
  DB: D1Database;
  RATE_LIMIT_KV?: KVNamespace;
  JWT_SECRET: string;
  MP_ACCESS_TOKEN: string;
  MP_PUBLIC_KEY: string;
  MP_WEBHOOK_SECRET?: string;
  ADMIN_URL: string;
  ENVIRONMENT: 'development' | 'staging' | 'production';
}

export type UserRole = 'superadmin' | 'admin' | 'operator' | 'viewer';

export interface User {
  id: string;
  email: string;
  username?: string;
  name: string;
  password_hash: string;
  avatar?: string;
  role: UserRole;
  tenant_id: string | null;
  active: boolean;
  email_verified: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone?: string;
  logo_url?: string;
  plan: 'free' | 'starter' | 'professional' | 'enterprise';
  status: 'trial' | 'active' | 'suspended' | 'cancelled';
  trial_ends_at?: string;
  subscription_ends_at?: string;
  max_users: number;
  max_locations: number;
  mp_enabled: boolean;
  mp_access_token?: string;
  mp_public_key?: string;
  mp_webhook_configured: boolean;
  settings: string;
  branding: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  tenant_id: string;
  user_id?: string;
  external_id?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'refunded';
  payment_method?: string;
  installments: number;
  payer_name?: string;
  payer_email?: string;
  payer_document?: string;
  description?: string;
  metadata: string;
  processed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  tenant_id?: string;
  user_id: string;
  user_name: string;
  user_email: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  old_value?: string;
  new_value?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  user_email: string;
  token_hash: string;
  ip_address?: string;
  user_agent?: string;
  last_activity_at: string;
  expires_at: string;
  created_at: string;
}

// Permissions by role
export const rolePermissions: Record<UserRole, string[]> = {
  superadmin: [
    'tenants:read', 'tenants:write', 'tenants:delete',
    'users:read', 'users:write', 'users:delete', 'users:invite',
    'payments:read', 'payments:refund',
    'operations:read', 'operations:export',
    'audit:read', 'audit:export',
    'config:read', 'config:write',
    'mercadopago:read', 'mercadopago:write',
  ],
  admin: [
    'users:read', 'users:write', 'users:invite',
    'payments:read',
    'operations:read', 'operations:export',
    'audit:read',
    'config:read', 'config:write',
    'mercadopago:read', 'mercadopago:write',
  ],
  operator: [
    'users:read',
    'payments:read',
    'operations:read',
    'audit:read',
  ],
  viewer: [
    'users:read',
    'payments:read',
    'operations:read',
  ],
};
