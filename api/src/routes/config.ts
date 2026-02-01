import { Hono } from 'hono';
import { Env } from '../types';
import { requirePermission, requireSuperAdmin } from '../middleware/auth';
import { createAuditLog, toCamelCase } from '../utils/helpers';

const app = new Hono<{ Bindings: Env }>();

// Get tenant settings
app.get('/:tenantId', requirePermission('config:read'), async (c) => {
  const tenantId = c.req.param('tenantId');
  const user = c.get('user');

  // Non-superadmins can only access their own tenant settings
  if (user.role !== 'superadmin' && tenantId !== user.tenant_id && tenantId !== 'global') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  if (tenantId === 'global') {
    // Return global settings (superadmin only)
    if (user.role !== 'superadmin') {
      return c.json({ error: 'Forbidden' }, 403);
    }
    return c.json({
      branding: {
        primaryColor: '#7c3aed',
        secondaryColor: '#6366f1',
      },
      notifications: {
        emailEnabled: true,
        smsEnabled: false,
        whatsappEnabled: true,
      },
      features: {
        inventoryEnabled: true,
        reportsEnabled: true,
        multiLocationEnabled: true,
      },
    });
  }

  const tenant = await c.env.DB.prepare('SELECT settings FROM tenants WHERE id = ?')
    .bind(tenantId)
    .first();

  if (!tenant) {
    return c.json({ error: 'Tenant not found' }, 404);
  }

  return c.json(JSON.parse((tenant as any).settings || '{}'));
});

// Update tenant settings
app.put('/:tenantId', requirePermission('config:write'), async (c) => {
  const tenantId = c.req.param('tenantId');
  const user = c.get('user');
  const body = await c.req.json();

  // Non-superadmins can only update their own tenant settings
  if (user.role !== 'superadmin' && tenantId !== user.tenant_id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const tenant = await c.env.DB.prepare('SELECT settings FROM tenants WHERE id = ?')
    .bind(tenantId)
    .first();

  if (!tenant) {
    return c.json({ error: 'Tenant not found' }, 404);
  }

  const currentSettings = JSON.parse((tenant as any).settings || '{}');
  const newSettings = {
    ...currentSettings,
    ...body,
    branding: { ...currentSettings.branding, ...body.branding },
    notifications: { ...currentSettings.notifications, ...body.notifications },
    features: { ...currentSettings.features, ...body.features },
  };

  await c.env.DB.prepare(
    "UPDATE tenants SET settings = ?, updated_at = datetime('now') WHERE id = ?"
  )
    .bind(JSON.stringify(newSettings), tenantId)
    .run();

  await createAuditLog(c, 'config.updated', 'config', tenantId, currentSettings, newSettings);

  return c.json(newSettings);
});

// Get system health (super admin only)
app.get('/health', requireSuperAdmin, async (c) => {
  // Check database
  let dbStatus = 'healthy';
  let dbLatency = 0;
  try {
    const start = Date.now();
    await c.env.DB.prepare('SELECT 1').first();
    dbLatency = Date.now() - start;
  } catch {
    dbStatus = 'unhealthy';
  }

  // Check MercadoPago
  let mpStatus = 'healthy';
  let mpLatency = 0;
  try {
    const start = Date.now();
    const response = await fetch('https://api.mercadopago.com/v1/payment_methods', {
      headers: {
        Authorization: `Bearer ${c.env.MP_ACCESS_TOKEN}`,
      },
    });
    mpLatency = Date.now() - start;
    if (!response.ok) mpStatus = 'unhealthy';
  } catch {
    mpStatus = 'unhealthy';
    mpLatency = 0;
  }

  return c.json({
    status: dbStatus === 'healthy' ? 'healthy' : 'degraded',
    services: {
      api: { status: 'healthy', latency: 1 },
      database: { status: dbStatus, latency: dbLatency },
      cache: { status: 'healthy', latency: 1 },
      mercadopago: { status: mpStatus, latency: mpLatency },
    },
  });
});

// MercadoPago configuration endpoints
app.get('/mercadopago/:tenantId', requirePermission('mercadopago:read'), async (c) => {
  const tenantId = c.req.param('tenantId');

  const tenant = await c.env.DB.prepare(
    'SELECT mercadopago_enabled, settings FROM tenants WHERE id = ?'
  )
    .bind(tenantId)
    .first();

  if (!tenant) {
    return c.json({ error: 'Tenant not found' }, 404);
  }

  const settings = JSON.parse((tenant as any).settings || '{}');

  return c.json({
    tenantId,
    enabled: (tenant as any).mercadopago_enabled,
    webhookUrl: `https://api.fixlytaller.com/webhooks/mercadopago`,
    status: (tenant as any).mercadopago_enabled ? 'configured' : 'pending',
    lastSyncAt: settings.mercadopagoLastSync || null,
  });
});

app.put('/mercadopago/:tenantId', requirePermission('mercadopago:write'), async (c) => {
  const tenantId = c.req.param('tenantId');
  const { enabled } = await c.req.json<{ enabled: boolean }>();

  await c.env.DB.prepare(
    "UPDATE tenants SET mercadopago_enabled = ?, updated_at = datetime('now') WHERE id = ?"
  )
    .bind(enabled ? 1 : 0, tenantId)
    .run();

  await createAuditLog(c, 'config.updated', 'mercadopago', tenantId, null, { enabled });

  return c.json({ success: true });
});

app.post('/mercadopago/:tenantId/test', requirePermission('mercadopago:write'), async (c) => {
  // Test MercadoPago connection
  try {
    const response = await fetch('https://api.mercadopago.com/v1/payment_methods', {
      headers: {
        Authorization: `Bearer ${c.env.MP_ACCESS_TOKEN}`,
      },
    });

    if (response.ok) {
      return c.json({ success: true, message: 'Connection successful' });
    } else {
      return c.json({ success: false, message: 'Invalid credentials' }, 400);
    }
  } catch (error) {
    return c.json({ success: false, message: 'Connection failed' }, 500);
  }
});

export { app as configRoutes };
