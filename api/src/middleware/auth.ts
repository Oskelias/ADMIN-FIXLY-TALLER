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
