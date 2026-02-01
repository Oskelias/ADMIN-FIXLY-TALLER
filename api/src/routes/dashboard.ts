import { Hono } from 'hono';
import { Env } from '../types';
import { rowsToCamelCase } from '../utils/helpers';

const app = new Hono<{ Bindings: Env }>();

// Get dashboard stats
app.get('/stats', async (c) => {
  const user = c.get('user');
  const isSuperAdmin = user.role === 'superadmin';
  const tenantFilter = isSuperAdmin ? '' : `WHERE tenant_id = '${user.tenant_id}'`;

  // Get basic counts
  const [tenants, users, payments] = await Promise.all([
    isSuperAdmin
      ? c.env.DB.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN status = "active" THEN 1 ELSE 0 END) as active FROM tenants').first()
      : { total: 1, active: 1 },
    c.env.DB.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) as active FROM users ${tenantFilter}`).first(),
    c.env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as total_revenue,
        SUM(CASE WHEN status = 'approved' AND created_at >= date('now', '-30 days') THEN amount ELSE 0 END) as monthly_revenue
      FROM payments ${tenantFilter}
    `).first(),
  ]);

  // Get revenue by month (last 6 months)
  const revenueByMonth = await c.env.DB.prepare(`
    SELECT
      strftime('%Y-%m', created_at) as month,
      SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as revenue
    FROM payments
    ${tenantFilter}
    WHERE created_at >= date('now', '-6 months')
    GROUP BY strftime('%Y-%m', created_at)
    ORDER BY month
  `).all();

  // Get payments by status
  const paymentsByStatus = await c.env.DB.prepare(`
    SELECT
      status,
      COUNT(*) as count,
      SUM(amount) as amount
    FROM payments
    ${tenantFilter}
    GROUP BY status
  `).all();

  // Get tenants by plan (super admin only)
  const tenantsByPlan = isSuperAdmin
    ? await c.env.DB.prepare(`
        SELECT plan, COUNT(*) as count FROM tenants GROUP BY plan
      `).all()
    : { results: [] };

  // Get recent activity
  const recentActivity = await c.env.DB.prepare(`
    SELECT * FROM audit_logs
    ${isSuperAdmin ? '' : `WHERE tenant_id = '${user.tenant_id}' OR tenant_id IS NULL`}
    ORDER BY created_at DESC
    LIMIT 10
  `).all();

  return c.json({
    totalTenants: (tenants as any)?.total || 0,
    activeTenants: (tenants as any)?.active || 0,
    totalUsers: (users as any)?.total || 0,
    activeUsers: (users as any)?.active || 0,
    totalRevenue: (payments as any)?.total_revenue || 0,
    monthlyRevenue: (payments as any)?.monthly_revenue || 0,
    totalPayments: (payments as any)?.total || 0,
    pendingPayments: (payments as any)?.pending || 0,
    approvedPayments: (payments as any)?.approved || 0,
    rejectedPayments: (payments as any)?.rejected || 0,
    revenueByMonth: revenueByMonth.results.map((r: any) => ({
      month: r.month,
      revenue: r.revenue || 0,
    })),
    paymentsByStatus: paymentsByStatus.results.map((r: any) => ({
      status: r.status,
      count: r.count,
      amount: r.amount || 0,
    })),
    tenantsByPlan: tenantsByPlan.results.map((r: any) => ({
      plan: r.plan,
      count: r.count,
    })),
    recentActivity: rowsToCamelCase(recentActivity.results as Record<string, unknown>[]),
  });
});

// Get recent activity
app.get('/activity', async (c) => {
  const user = c.get('user');
  const limit = parseInt(c.req.query('limit') || '10');

  const results = await c.env.DB.prepare(`
    SELECT * FROM audit_logs
    ${user.role !== 'superadmin' ? `WHERE tenant_id = '${user.tenant_id}' OR tenant_id IS NULL` : ''}
    ORDER BY created_at DESC
    LIMIT ?
  `)
    .bind(limit)
    .all();

  return c.json(rowsToCamelCase(results.results as Record<string, unknown>[]));
});

export { app as dashboardRoutes };
