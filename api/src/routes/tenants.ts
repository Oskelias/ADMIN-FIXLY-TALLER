import { Hono } from 'hono';
import { Env, Tenant } from '../types';
import { requireSuperAdmin } from '../middleware/auth';
import {
  generateId,
  parsePagination,
  paginatedResponse,
  createAuditLog,
  toCamelCase,
  rowsToCamelCase,
  slugify,
} from '../utils/helpers';

const app = new Hono<{ Bindings: Env }>();

// Apply super admin check to all tenant routes
app.use('*', requireSuperAdmin);

// List tenants
app.get('/', async (c) => {
  const params = parsePagination(new URL(c.req.url).searchParams);
  const search = c.req.query('search') || '';
  const status = c.req.query('status');
  const plan = c.req.query('plan');

  let whereClause = '1=1';
  const bindings: (string | number)[] = [];

  if (search) {
    whereClause += ' AND (name LIKE ? OR email LIKE ? OR slug LIKE ?)';
    bindings.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (status) {
    whereClause += ' AND status = ?';
    bindings.push(status);
  }

  if (plan) {
    whereClause += ' AND plan = ?';
    bindings.push(plan);
  }

  const offset = ((params.page || 1) - 1) * (params.pageSize || 10);

  const [countResult, dataResult] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) as count FROM tenants WHERE ${whereClause}`)
      .bind(...bindings)
      .first(),
    c.env.DB.prepare(`
      SELECT * FROM tenants
      WHERE ${whereClause}
      ORDER BY ${params.sortBy} ${params.sortOrder}
      LIMIT ? OFFSET ?
    `)
      .bind(...bindings, params.pageSize || 10, offset)
      .all(),
  ]);

  const total = (countResult as any)?.count || 0;
  const tenants = rowsToCamelCase<Tenant>(dataResult.results as Record<string, unknown>[]);

  return c.json(paginatedResponse(tenants, total, params));
});

// Get single tenant
app.get('/:id', async (c) => {
  const id = c.req.param('id');

  const tenant = await c.env.DB.prepare('SELECT * FROM tenants WHERE id = ?')
    .bind(id)
    .first();

  if (!tenant) {
    return c.json({ error: 'Tenant not found' }, 404);
  }

  return c.json(toCamelCase(tenant as Record<string, unknown>));
});

// Create tenant
app.post('/', async (c) => {
  const body = await c.req.json<Partial<Tenant>>();

  if (!body.name || !body.email) {
    return c.json({ error: 'Name and email are required' }, 400);
  }

  const id = generateId();
  const slug = body.slug || slugify(body.name);

  // Check if slug exists
  const existing = await c.env.DB.prepare('SELECT id FROM tenants WHERE slug = ?')
    .bind(slug)
    .first();

  if (existing) {
    return c.json({ error: 'Slug already exists' }, 400);
  }

  const defaultSettings = JSON.stringify({
    branding: {},
    notifications: { emailEnabled: true, smsEnabled: false, whatsappEnabled: false },
    features: { inventoryEnabled: false, reportsEnabled: true, multiLocationEnabled: false },
  });

  await c.env.DB.prepare(`
    INSERT INTO tenants (
      id, name, slug, email, phone, status, plan,
      trial_ends_at, max_users, max_locations, settings,
      mercadopago_enabled, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(
    id,
    body.name,
    slug,
    body.email.toLowerCase(),
    body.phone || null,
    body.status || 'trial',
    body.plan || 'starter',
    body.status === 'trial' ? new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString() : null,
    body.max_users || 5,
    body.max_locations || 1,
    defaultSettings,
    false
  ).run();

  await createAuditLog(c, 'tenant.created', 'tenant', id, null, { name: body.name, plan: body.plan });

  const tenant = await c.env.DB.prepare('SELECT * FROM tenants WHERE id = ?')
    .bind(id)
    .first();

  return c.json(toCamelCase(tenant as Record<string, unknown>), 201);
});

// Update tenant
app.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<Partial<Tenant>>();

  const existing = await c.env.DB.prepare('SELECT * FROM tenants WHERE id = ?')
    .bind(id)
    .first<Tenant>();

  if (!existing) {
    return c.json({ error: 'Tenant not found' }, 404);
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
  if (body.phone !== undefined) {
    updates.push('phone = ?');
    bindings.push(body.phone);
  }
  if (body.status !== undefined) {
    updates.push('status = ?');
    bindings.push(body.status);
  }
  if (body.plan !== undefined) {
    updates.push('plan = ?');
    bindings.push(body.plan);
  }
  if (body.max_users !== undefined) {
    updates.push('max_users = ?');
    bindings.push(body.max_users);
  }
  if (body.max_locations !== undefined) {
    updates.push('max_locations = ?');
    bindings.push(body.max_locations);
  }

  if (updates.length === 0) {
    return c.json({ error: 'No fields to update' }, 400);
  }

  updates.push("updated_at = datetime('now')");
  bindings.push(id);

  await c.env.DB.prepare(`UPDATE tenants SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...bindings)
    .run();

  await createAuditLog(c, 'tenant.updated', 'tenant', id, existing, body);

  const tenant = await c.env.DB.prepare('SELECT * FROM tenants WHERE id = ?')
    .bind(id)
    .first();

  return c.json(toCamelCase(tenant as Record<string, unknown>));
});

// Delete tenant
app.delete('/:id', async (c) => {
  const id = c.req.param('id');

  const existing = await c.env.DB.prepare('SELECT * FROM tenants WHERE id = ?')
    .bind(id)
    .first<Tenant>();

  if (!existing) {
    return c.json({ error: 'Tenant not found' }, 404);
  }

  await c.env.DB.prepare('DELETE FROM tenants WHERE id = ?').bind(id).run();

  await createAuditLog(c, 'tenant.deleted', 'tenant', id, existing, null);

  return c.json({ success: true });
});

// Suspend tenant
app.post('/:id/suspend', async (c) => {
  const id = c.req.param('id');
  const { reason } = await c.req.json<{ reason: string }>();

  await c.env.DB.prepare(
    "UPDATE tenants SET status = 'suspended', updated_at = datetime('now') WHERE id = ?"
  )
    .bind(id)
    .run();

  await createAuditLog(c, 'tenant.updated', 'tenant', id, null, { status: 'suspended', reason });

  return c.json({ success: true });
});

// Activate tenant
app.post('/:id/activate', async (c) => {
  const id = c.req.param('id');

  await c.env.DB.prepare(
    "UPDATE tenants SET status = 'active', updated_at = datetime('now') WHERE id = ?"
  )
    .bind(id)
    .run();

  await createAuditLog(c, 'tenant.updated', 'tenant', id, null, { status: 'active' });

  return c.json({ success: true });
});

// Get tenant stats
app.get('/:id/stats', async (c) => {
  const id = c.req.param('id');

  const [users, locations, revenue, orders] = await Promise.all([
    c.env.DB.prepare(
      'SELECT COUNT(*) as total, SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) as active FROM users WHERE tenant_id = ?'
    ).bind(id).first(),
    c.env.DB.prepare('SELECT COUNT(*) as total FROM locations WHERE tenant_id = ?').bind(id).first(),
    c.env.DB.prepare(
      "SELECT SUM(amount) as total FROM payments WHERE tenant_id = ? AND status = 'approved'"
    ).bind(id).first(),
    c.env.DB.prepare('SELECT COUNT(*) as total FROM orders WHERE tenant_id = ?').bind(id).first(),
  ]);

  return c.json({
    totalUsers: (users as any)?.total || 0,
    activeUsers: (users as any)?.active || 0,
    totalLocations: (locations as any)?.total || 0,
    totalRevenue: (revenue as any)?.total || 0,
    totalOrders: (orders as any)?.total || 0,
  });
});

export { app as tenantsRoutes };
