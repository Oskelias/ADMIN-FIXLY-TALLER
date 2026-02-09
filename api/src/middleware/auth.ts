import { Context, Next } from 'hono';
import { Env, User, rolePermissions } from '../types';

// Extend Hono context to include user
declare module 'hono' {
  interface ContextVariableMap {
    user: User;
  }
}

// Simple JWT verification (for production, use a proper JWT library)
async function verifyToken(token: string, secret: string): Promise<{ userId: string } | null> {
  try {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) return null;

    const payloadData = JSON.parse(atob(payload));
    
    // Check expiration
    if (payloadData.exp && Date.now() >= payloadData.exp * 1000) {
      return null;
    }

    // In production, verify signature using WebCrypto
    // For now, we trust the payload
    return { userId: payloadData.sub };
  } catch {
    return null;
  }
}

export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload) {
    return c.json({ error: 'Invalid token' }, 401);
  }

  // Fetch user from database
  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE id = ? AND active = 1'
  )
    .bind(payload.userId)
    .first<User>();

  if (!user) {
    return c.json({ error: 'User not found or inactive' }, 401);
  }

  // Update last activity
  await c.env.DB.prepare(
    "UPDATE sessions SET last_activity_at = datetime('now') WHERE user_id = ?"
  )
    .bind(user.id)
    .run();

  c.set('user', user);
  await next();
}

export function requirePermission(permission: string) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const user = c.get('user');

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userPermissions = rolePermissions[user.role] || [];
    
    if (!userPermissions.includes(permission)) {
      return c.json({ error: 'Forbidden', required: permission }, 403);
    }

    await next();
  };
}

export function requireSuperAdmin() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const user = c.get('user');

    if (!user || user.role !== 'superadmin') {
      return c.json({ error: 'Superadmin access required' }, 403);
    }

    await next();
  };
}

/**
 * Middleware to require admin or superadmin role
 * Also supports ADMIN_BOOTSTRAP_EMAIL env var for initial setup
 */
export function requireAdmin() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const user = c.get('user');

    if (!user) {
      return c.json({ ok: false, error: 'forbidden' }, 403);
    }

    // Allow superadmin or admin roles
    if (user.role === 'superadmin' || user.role === 'admin') {
      await next();
      return;
    }

    // Bootstrap: allow if email matches ADMIN_BOOTSTRAP_EMAIL
    const bootstrapEmail = c.env.ADMIN_BOOTSTRAP_EMAIL;
    if (bootstrapEmail && user.email?.toLowerCase() === bootstrapEmail.toLowerCase()) {
      await next();
      return;
    }

    return c.json({ ok: false, error: 'forbidden' }, 403);
  };
}

/**
 * Middleware to check tenant status
 * Used by the app (not admin) to enforce suspension
 * Returns 403 with code TENANT_SUSPENDED if tenant is suspended
 */
export function requireActiveTenant() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const user = c.get('user');

    // Superadmins bypass tenant check (they have no tenant)
    if (!user || user.role === 'superadmin') {
      await next();
      return;
    }

    // If user has no tenant, allow (edge case)
    if (!user.tenant_id) {
      await next();
      return;
    }

    // Check tenant status
    const tenant = await c.env.DB.prepare(
      'SELECT id, status, name FROM tenants WHERE id = ?'
    )
      .bind(user.tenant_id)
      .first<{ id: string; status: string; name: string }>();

    if (!tenant) {
      return c.json({
        error: 'Tenant not found',
        code: 'TENANT_NOT_FOUND',
      }, 404);
    }

    if (tenant.status === 'suspended') {
      return c.json({
        error: 'Account suspended',
        code: 'TENANT_SUSPENDED',
        message: 'Your account has been suspended due to non-payment. Please contact support.',
        tenantId: tenant.id,
        tenantName: tenant.name,
      }, 403);
    }

    if (tenant.status === 'cancelled') {
      return c.json({
        error: 'Account cancelled',
        code: 'TENANT_CANCELLED',
        message: 'This account has been cancelled.',
        tenantId: tenant.id,
      }, 403);
    }

    await next();
  };
}
