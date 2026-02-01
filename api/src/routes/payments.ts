import { Hono } from 'hono';
import { Env, Payment } from '../types';
import { requirePermission } from '../middleware/auth';
import {
  parsePagination,
  paginatedResponse,
  createAuditLog,
  toCamelCase,
  rowsToCamelCase,
} from '../utils/helpers';

const app = new Hono<{ Bindings: Env }>();

// List payments
app.get('/', requirePermission('payments:read'), async (c) => {
  const user = c.get('user');
  const params = parsePagination(new URL(c.req.url).searchParams);
  const status = c.req.query('status');
  const tenantId = c.req.query('tenantId');
  const dateFrom = c.req.query('dateFrom');
  const dateTo = c.req.query('dateTo');

  let whereClause = '1=1';
  const bindings: (string | number)[] = [];

  // Non-superadmins can only see payments from their tenant
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
    c.env.DB.prepare(`SELECT COUNT(*) as count FROM payments WHERE ${whereClause}`)
      .bind(...bindings)
      .first(),
    c.env.DB.prepare(`
      SELECT * FROM payments
      WHERE ${whereClause}
      ORDER BY ${params.sortBy} ${params.sortOrder}
      LIMIT ? OFFSET ?
    `)
      .bind(...bindings, params.pageSize || 10, offset)
      .all(),
  ]);

  const total = (countResult as any)?.count || 0;
  const payments = rowsToCamelCase<Payment>(dataResult.results as Record<string, unknown>[]);

  return c.json(paginatedResponse(payments, total, params));
});

// Get single payment
app.get('/:id', requirePermission('payments:read'), async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');

  let query = 'SELECT * FROM payments WHERE id = ?';
  if (user.role !== 'superadmin') {
    query += ' AND tenant_id = ?';
  }

  const stmt = c.env.DB.prepare(query);
  const payment = user.role !== 'superadmin'
    ? await stmt.bind(id, user.tenant_id).first()
    : await stmt.bind(id).first();

  if (!payment) {
    return c.json({ error: 'Payment not found' }, 404);
  }

  return c.json(toCamelCase(payment as Record<string, unknown>));
});

// Refund payment
app.post('/:id/refund', requirePermission('payments:refund'), async (c) => {
  const id = c.req.param('id');
  const { reason } = await c.req.json<{ reason: string }>();

  const payment = await c.env.DB.prepare('SELECT * FROM payments WHERE id = ?')
    .bind(id)
    .first<Payment>();

  if (!payment) {
    return c.json({ error: 'Payment not found' }, 404);
  }

  if (payment.status !== 'approved') {
    return c.json({ error: 'Only approved payments can be refunded' }, 400);
  }

  // In production, call MercadoPago refund API
  // For now, just update status

  await c.env.DB.prepare(
    "UPDATE payments SET status = 'refunded', updated_at = datetime('now') WHERE id = ?"
  )
    .bind(id)
    .run();

  await createAuditLog(c, 'payment.refunded', 'payment', id, { status: 'approved' }, { status: 'refunded', reason });

  return c.json({ success: true });
});

// Export payments (returns download URL or data)
app.get('/export', requirePermission('operations:export'), async (c) => {
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
    SELECT * FROM payments WHERE ${whereClause} ORDER BY created_at DESC LIMIT 10000
  `)
    .bind(...bindings)
    .all();

  // In production, generate CSV file and return URL
  // For now, return data that frontend can convert to CSV
  return c.json({
    data: rowsToCamelCase(results.results as Record<string, unknown>[]),
    exportedAt: new Date().toISOString(),
  });
});

export { app as paymentsRoutes };
