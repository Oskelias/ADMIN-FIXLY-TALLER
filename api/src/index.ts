import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Env } from './types';
import { authMiddleware } from './middleware/auth';
import { authRoutes } from './routes/auth';
import { tenantsRoutes } from './routes/tenants';
import { usersRoutes } from './routes/users';
import { paymentsRoutes } from './routes/payments';
import { operationsRoutes } from './routes/operations';
import { auditRoutes } from './routes/audit';
import { configRoutes } from './routes/config';
import { dashboardRoutes } from './routes/dashboard';
import { webhookRoutes } from './routes/webhooks';

const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use('*', logger());

// CORS - Allow admin frontend and app domains
app.use('*', async (c, next) => {
  const corsMiddleware = cors({
    origin: [
      c.env.ADMIN_URL,
      'https://admin.fixlytaller.com',
      'https://app.fixlytaller.com',
      'https://fixlytaller.com',
      'http://localhost:5173',
      'http://localhost:3000',
    ],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
  });
  return corsMiddleware(c, next);
});

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    version: '1.0.0',
    environment: c.env.ENVIRONMENT,
    timestamp: new Date().toISOString(),
  });
});

// Public routes
app.route('/auth', authRoutes);
app.route('/webhooks', webhookRoutes);

// Protected routes
app.use('/admin/*', authMiddleware);
app.route('/admin/dashboard', dashboardRoutes);
app.route('/admin/tenants', tenantsRoutes);
app.route('/admin/users', usersRoutes);
app.route('/admin/payments', paymentsRoutes);
app.route('/admin/operations', operationsRoutes);
app.route('/admin/audit', auditRoutes);
app.route('/admin/config', configRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json(
    {
      error: 'Internal server error',
      message: c.env.ENVIRONMENT === 'development' ? err.message : undefined,
    },
    500
  );
});

export default app;
