import { Hono } from 'hono';
import { Env } from '../types';
import { requirePermission } from '../middleware/auth';
import {
  parsePagination,
  paginatedResponse,
  toCamelCase,
  rowsToCamelCase,
} from '../utils/helpers';

const app = new Hono<{ Bindings: Env }>();

// List orders
app.get('/orders', requirePermission('operations:read'), async (c) => {
  const user = c.get('user');
  const params = parsePagination(new URL(c.req.url).searchParams);
  const status = c.req.query('status');
  const tenantId = c.req.query('tenantId');
  const locationId = c.req.query('locationId');
  const dateFrom = c.req.query('dateFrom');
  const dateTo = c.req.query('dateTo');

  let whereClause = '1=1';
  const bindings: (string | number)[] = [];

  // Non-superadmins can only see orders from their tenant
  if (user.role !== 'superadmin') {
    whereClause += ' AND tenant_id = ?';
    bindings.push(user.tenant_id!);
  } else if (tenantId) {
    whereClause += ' AND tenant_id = ?';
    bindings.push(tenantId);
  }

  if (status) {
    whereClause += ' AND status = ?';
    bindings.push(status);
  }

  if (locationId) {
    whereClause += ' AND location_id = ?';
    bindings.push(locationId);
  }

  if (dateFrom) {
    whereClause += ' AND created_at >= ?';
    bindings.push(dateFrom);
  }

  if (dateTo) {
    whereClause += ' AND created_at <= ?';
    bindings.push(dateTo);
  }

  const offset = ((params.page || 1) - 1) * (params.pageSize || 10);

  const [countResult, dataResult] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) as count FROM orders WHERE ${whereClause}`)
      .bind(...bindings)
      .first(),
    c.env.DB.prepare(`
      SELECT * FROM orders
      WHERE ${whereClause}
      ORDER BY ${params.sortBy} ${params.sortOrder}
      LIMIT ? OFFSET ?
    `)
      .bind(...bindings, params.pageSize || 10, offset)
      .all(),
  ]);

  const total = (countResult as any)?.count || 0;
  const orders = rowsToCamelCase(dataResult.results as Record<string, unknown>[]);

  // Parse items JSON for each order
  const ordersWithItems = orders.map((order: any) => ({
    ...order,
    items: order.items ? JSON.parse(order.items) : [],
  }));

  return c.json(paginatedResponse(ordersWithItems, total, params));
});

// Get single order
app.get('/orders/:id', requirePermission('operations:read'), async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');

  let query = 'SELECT * FROM orders WHERE id = ?';
  if (user.role !== 'superadmin') {
    query += ' AND tenant_id = ?';
  }

  const stmt = c.env.DB.prepare(query);
  const order = user.role !== 'superadmin'
    ? await stmt.bind(id, user.tenant_id).first()
    : await stmt.bind(id).first();

  if (!order) {
    return c.json({ error: 'Order not found' }, 404);
  }

  const result = toCamelCase(order as Record<string, unknown>) as any;
  result.items = result.items ? JSON.parse(result.items) : [];

  return c.json(result);
});

// Export orders
app.get('/orders/export', requirePermission('operations:export'), async (c) => {
  const user = c.get('user');
  const status = c.req.query('status');
  const dateFrom = c.req.query('dateFrom');
  const dateTo = c.req.query('dateTo');

  let whereClause = '1=1';
  const bindings: (string | number)[] = [];

  if (user.role !== 'superadmin') {
    whereClause += ' AND tenant_id = ?';
    bindings.push(user.tenant_id!);
  }

  if (status) {
    whereClause += ' AND status = ?';
    bindings.push(status);
  }

  if (dateFrom) {
    whereClause += ' AND created_at >= ?';
    bindings.push(dateFrom);
  }

  if (dateTo) {
    whereClause += ' AND created_at <= ?';
    bindings.push(dateTo);
  }

  const results = await c.env.DB.prepare(`
    SELECT * FROM orders WHERE ${whereClause} ORDER BY created_at DESC LIMIT 10000
  `)
    .bind(...bindings)
    .all();

  return c.json({
    data: rowsToCamelCase(results.results as Record<string, unknown>[]),
    exportedAt: new Date().toISOString(),
  });
});

export { app as operationsRoutes };
