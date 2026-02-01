import { Hono } from 'hono';
import { Env } from '../types';
import { requirePermission } from '../middleware/auth';
import {
  parsePagination,
  paginatedResponse,
  rowsToCamelCase,
} from '../utils/helpers';

const app = new Hono<{ Bindings: Env }>();

// List audit logs
app.get('/', requirePermission('audit:read'), async (c) => {
  const user = c.get('user');
  const params = parsePagination(new URL(c.req.url).searchParams);
  const action = c.req.query('action');
  const userId = c.req.query('userId');
  const tenantId = c.req.query('tenantId');
  const dateFrom = c.req.query('dateFrom');
  const dateTo = c.req.query('dateTo');
  const search = c.req.query('search');

  let whereClause = '1=1';
  const bindings: (string | number)[] = [];

  // Non-superadmins can only see audit logs from their tenant or global
  if (user.role !== 'superadmin') {
    whereClause += ' AND (tenant_id = ? OR tenant_id IS NULL)';
    bindings.push(user.tenant_id!);
  } else if (tenantId) {
    whereClause += ' AND tenant_id = ?';
    bindings.push(tenantId);
  }

  if (action) {
    whereClause += ' AND action = ?';
    bindings.push(action);
  }

  if (userId) {
    whereClause += ' AND user_id = ?';
    bindings.push(userId);
  }

  if (dateFrom) {
    whereClause += ' AND created_at >= ?';
    bindings.push(dateFrom);
  }

  if (dateTo) {
    whereClause += ' AND created_at <= ?';
    bindings.push(dateTo);
  }

  if (search) {
    whereClause += ' AND (user_name LIKE ? OR user_email LIKE ? OR resource_id LIKE ?)';
    bindings.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const offset = ((params.page || 1) - 1) * (params.pageSize || 20);

  const [countResult, dataResult] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) as count FROM audit_logs WHERE ${whereClause}`)
      .bind(...bindings)
      .first(),
    c.env.DB.prepare(`
      SELECT * FROM audit_logs
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `)
      .bind(...bindings, params.pageSize || 20, offset)
      .all(),
  ]);

  const total = (countResult as any)?.count || 0;
  const logs = rowsToCamelCase(dataResult.results as Record<string, unknown>[]);

  // Parse JSON fields
  const logsWithParsedValues = logs.map((log: any) => ({
    ...log,
    oldValue: log.oldValue ? JSON.parse(log.oldValue) : null,
    newValue: log.newValue ? JSON.parse(log.newValue) : null,
  }));

  return c.json(paginatedResponse(logsWithParsedValues, total, params));
});

// Export audit logs
app.get('/export', requirePermission('audit:export'), async (c) => {
  const user = c.get('user');
  const action = c.req.query('action');
  const dateFrom = c.req.query('dateFrom');
  const dateTo = c.req.query('dateTo');

  let whereClause = '1=1';
  const bindings: (string | number)[] = [];

  if (user.role !== 'superadmin') {
    whereClause += ' AND (tenant_id = ? OR tenant_id IS NULL)';
    bindings.push(user.tenant_id!);
  }

  if (action) {
    whereClause += ' AND action = ?';
    bindings.push(action);
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
    SELECT * FROM audit_logs WHERE ${whereClause} ORDER BY created_at DESC LIMIT 50000
  `)
    .bind(...bindings)
    .all();

  return c.json({
    data: rowsToCamelCase(results.results as Record<string, unknown>[]),
    exportedAt: new Date().toISOString(),
  });
});

export { app as auditRoutes };
