import { Hono } from 'hono';
import { Env, User } from '../types';
import { requirePermission } from '../middleware/auth';
import {
  generateId,
  hashPassword,
  parsePagination,
  paginatedResponse,
  createAuditLog,
  toCamelCase,
  rowsToCamelCase,
} from '../utils/helpers';

const app = new Hono<{ Bindings: Env }>();

// List users
app.get('/', requirePermission('users:read'), async (c) => {
  const user = c.get('user');
  const params = parsePagination(new URL(c.req.url).searchParams);
  const search = c.req.query('search') || '';
  const role = c.req.query('role');
  const status = c.req.query('status');
  const tenantId = c.req.query('tenantId');

  let whereClause = '1=1';
  const bindings: (string | number)[] = [];

  // Non-superadmins can only see users from their tenant
  if (user.role !== 'superadmin') {
    whereClause += ' AND tenant_id = ?';
    bindings.push(user.tenant_id!);
  } else if (tenantId) {
    whereClause += ' AND tenant_id = ?';
    bindings.push(tenantId);
  }

  if (search) {
    whereClause += ' AND (name LIKE ? OR email LIKE ?)';
    bindings.push(`%${search}%`, `%${search}%`);
  }

  if (role) {
    whereClause += ' AND role = ?';
    bindings.push(role);
  }

  if (status) {
    whereClause += ' AND active = ?';
    bindings.push(status === 'active' ? 1 : 0);
  }

  const offset = ((params.page || 1) - 1) * (params.pageSize || 10);

  const [countResult, dataResult] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) as count FROM users WHERE ${whereClause}`)
      .bind(...bindings)
      .first(),
    c.env.DB.prepare(`
      SELECT id, email, name, role, tenant_id, active, email_verified, last_login_at, created_at, updated_at
      FROM users
      WHERE ${whereClause}
      ORDER BY ${params.sortBy} ${params.sortOrder}
      LIMIT ? OFFSET ?
    `)
      .bind(...bindings, params.pageSize || 10, offset)
      .all(),
  ]);

  const total = (countResult as any)?.count || 0;
  const users = rowsToCamelCase(dataResult.results as Record<string, unknown>[]);

  return c.json(paginatedResponse(users, total, params));
});

// Get single user
app.get('/:id', requirePermission('users:read'), async (c) => {
  const id = c.req.param('id');
  const currentUser = c.get('user');

  let query = 'SELECT id, email, name, role, tenant_id, active, email_verified, last_login_at, created_at, updated_at FROM users WHERE id = ?';

  // Non-superadmins can only see users from their tenant
  if (currentUser.role !== 'superadmin') {
    query += ' AND tenant_id = ?';
  }

  const stmt = c.env.DB.prepare(query);
  const user = currentUser.role !== 'superadmin'
    ? await stmt.bind(id, currentUser.tenant_id).first()
    : await stmt.bind(id).first();

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json(toCamelCase(user as Record<string, unknown>));
});

// Create user
app.post('/', requirePermission('users:write'), async (c) => {
  const currentUser = c.get('user');
  const body = await c.req.json<{
    name: string;
    email: string;
    password: string;
    role: string;
    tenantId?: string;
  }>();

  if (!body.name || !body.email || !body.password) {
    return c.json({ error: 'Name, email, and password are required' }, 400);
  }

  // Check if email exists
  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(body.email.toLowerCase())
    .first();

  if (existing) {
    return c.json({ error: 'Email already exists' }, 400);
  }

  // Non-superadmins can only create users for their tenant
  const tenantId = currentUser.role === 'superadmin'
    ? body.tenantId || null
    : currentUser.tenant_id;

  // Non-superadmins cannot create superadmin users
  const role = currentUser.role === 'superadmin'
    ? body.role || 'operator'
    : body.role !== 'superadmin' ? body.role || 'operator' : 'operator';

  const id = generateId();
  const passwordHash = await hashPassword(body.password);

  await c.env.DB.prepare(`
    INSERT INTO users (
      id, email, name, password_hash, role, tenant_id,
      active, email_verified, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, 0, datetime('now'), datetime('now'))
  `).bind(
    id,
    body.email.toLowerCase(),
    body.name,
    passwordHash,
    role,
    tenantId
  ).run();

  await createAuditLog(c, 'user.created', 'user', id, null, { email: body.email, role });

  const user = await c.env.DB.prepare(
    'SELECT id, email, name, role, tenant_id, active, email_verified, created_at, updated_at FROM users WHERE id = ?'
  )
    .bind(id)
    .first();

  return c.json(toCamelCase(user as Record<string, unknown>), 201);
});

// Update user
app.put('/:id', requirePermission('users:write'), async (c) => {
  const id = c.req.param('id');
  const currentUser = c.get('user');
  const body = await c.req.json<Partial<{ name: string; email: string; role: string; active: boolean }>>();

  const existing = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(id)
    .first<User>();

  if (!existing) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Non-superadmins can only update users from their tenant
  if (currentUser.role !== 'superadmin' && existing.tenant_id !== currentUser.tenant_id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const updates: string[] = [];
  const bindings: unknown[] = [];

  if (body.name !== undefined) {
    updates.push('name = ?');
    bindings.push(body.name);
  }
  if (body.email !== undefined) {
    updates.push('email = ?');
    bindings.push(body.email.toLowerCase());
  }
  if (body.role !== undefined && currentUser.role === 'superadmin') {
    updates.push('role = ?');
    bindings.push(body.role);
  }
  if (body.active !== undefined) {
    updates.push('active = ?');
    bindings.push(body.active ? 1 : 0);
  }

  if (updates.length === 0) {
    return c.json({ error: 'No fields to update' }, 400);
  }

  updates.push("updated_at = datetime('now')");
  bindings.push(id);

  await c.env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...bindings)
    .run();

  await createAuditLog(c, 'user.updated', 'user', id, existing, body);

  const user = await c.env.DB.prepare(
    'SELECT id, email, name, role, tenant_id, active, email_verified, created_at, updated_at FROM users WHERE id = ?'
  )
    .bind(id)
    .first();

  return c.json(toCamelCase(user as Record<string, unknown>));
});

// Delete user
app.delete('/:id', requirePermission('users:delete'), async (c) => {
  const id = c.req.param('id');
  const currentUser = c.get('user');

  const existing = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(id)
    .first<User>();

  if (!existing) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Non-superadmins can only delete users from their tenant
  if (currentUser.role !== 'superadmin' && existing.tenant_id !== currentUser.tenant_id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Cannot delete yourself
  if (id === currentUser.id) {
    return c.json({ error: 'Cannot delete yourself' }, 400);
  }

  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();

  await createAuditLog(c, 'user.deleted', 'user', id, existing, null);

  return c.json({ success: true });
});

// Reset password
app.post('/:id/reset-password', requirePermission('users:write'), async (c) => {
  const id = c.req.param('id');

  const user = await c.env.DB.prepare('SELECT email FROM users WHERE id = ?')
    .bind(id)
    .first();

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Generate temporary password
  const tempPassword = Math.random().toString(36).slice(-8);
  const passwordHash = await hashPassword(tempPassword);

  await c.env.DB.prepare(
    "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
  )
    .bind(passwordHash, id)
    .run();

  await createAuditLog(c, 'user.updated', 'user', id, null, { passwordReset: true });

  // In production, send email with temp password
  return c.json({
    success: true,
    message: 'Password reset email sent',
    // Only in development:
    tempPassword: c.env.ENVIRONMENT === 'development' ? tempPassword : undefined,
  });
});

// Block user
app.post('/:id/block', requirePermission('users:write'), async (c) => {
  const id = c.req.param('id');
  const { reason } = await c.req.json<{ reason: string }>();

  await c.env.DB.prepare(
    "UPDATE users SET active = 0, updated_at = datetime('now') WHERE id = ?"
  )
    .bind(id)
    .run();

  await createAuditLog(c, 'user.updated', 'user', id, null, { blocked: true, reason });

  return c.json({ success: true });
});

// Unblock user
app.post('/:id/unblock', requirePermission('users:write'), async (c) => {
  const id = c.req.param('id');

  await c.env.DB.prepare(
    "UPDATE users SET active = 1, updated_at = datetime('now') WHERE id = ?"
  )
    .bind(id)
    .run();

  await createAuditLog(c, 'user.updated', 'user', id, null, { blocked: false });

  return c.json({ success: true });
});

// Get user sessions
app.get('/:id/sessions', requirePermission('users:read'), async (c) => {
  const id = c.req.param('id');

  const sessions = await c.env.DB.prepare(`
    SELECT * FROM sessions WHERE user_id = ? AND expires_at > datetime('now') ORDER BY last_activity_at DESC
  `)
    .bind(id)
    .all();

  return c.json(rowsToCamelCase(sessions.results as Record<string, unknown>[]));
});

// Terminate session
app.delete('/:userId/sessions/:sessionId', requirePermission('users:write'), async (c) => {
  const userId = c.req.param('userId');
  const sessionId = c.req.param('sessionId');

  await c.env.DB.prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?')
    .bind(sessionId, userId)
    .run();

  return c.json({ success: true });
});

// Invite user
app.post('/invite', requirePermission('users:invite'), async (c) => {
  const currentUser = c.get('user');
  const { email, role, tenantId } = await c.req.json<{
    email: string;
    role: string;
    tenantId?: string;
  }>();

  if (!email) {
    return c.json({ error: 'Email is required' }, 400);
  }

  // Check if email exists
  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email.toLowerCase())
    .first();

  if (existing) {
    return c.json({ error: 'User already exists' }, 400);
  }

  // In production, send invitation email
  // For now, create user with temp password

  const id = generateId();
  const tempPassword = Math.random().toString(36).slice(-8);
  const passwordHash = await hashPassword(tempPassword);

  const finalTenantId = currentUser.role === 'superadmin'
    ? tenantId || null
    : currentUser.tenant_id;

  await c.env.DB.prepare(`
    INSERT INTO users (
      id, email, name, password_hash, role, tenant_id,
      active, email_verified, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, 0, datetime('now'), datetime('now'))
  `).bind(
    id,
    email.toLowerCase(),
    email.split('@')[0],
    passwordHash,
    role || 'operator',
    finalTenantId
  ).run();

  await createAuditLog(c, 'user.created', 'user', id, null, { email, role, invited: true });

  return c.json({
    success: true,
    message: 'Invitation sent',
    userId: id,
  });
});

export { app as usersRoutes };
