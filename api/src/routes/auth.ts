import { Hono } from 'hono';
import { Env, User } from '../types';
import {
  generateId,
  hashPassword,
  verifyPassword,
  generateToken,
  createAuditLog,
  toCamelCase,
  slugify,
} from '../utils/helpers';

const app = new Hono<{ Bindings: Env }>();

// Login - accepts username or email
app.post('/login', async (c) => {
  const body = await c.req.json<{ username?: string; email?: string; password: string }>();
  const identifier = body.username || body.email;
  const password = body.password;

  if (!identifier || !password) {
    return c.json({ error: 'Username/email and password are required' }, 400);
  }

  // Check if identifier looks like email (contains @) or username
  const isEmail = identifier.includes('@');

  let user: User | null;
  if (isEmail) {
    user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ? AND active = 1'
    )
      .bind(identifier.toLowerCase())
      .first<User>();
  } else {
    // Search by username field or name field (as username fallback)
    user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE (username = ? OR name = ?) AND active = 1'
    )
      .bind(identifier, identifier)
      .first<User>();
  }

  if (!user) {
    return c.json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' }, 401);
  }

  const validPassword = await verifyPassword(password, user.password_hash);
  if (!validPassword) {
    return c.json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' }, 401);
  }

  // Update last login
  await c.env.DB.prepare(
    "UPDATE users SET last_login_at = datetime('now') WHERE id = ?"
  )
    .bind(user.id)
    .run();

  // Generate token
  const token = await generateToken(user.id, c.env.JWT_SECRET);

  // Create audit log
  c.set('user', user);
  await createAuditLog(c, 'user.login', 'user', user.id);

  // Return user without password
  const { password_hash, ...safeUser } = user;

  return c.json({
    user: toCamelCase(safeUser),
    token,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
});

// Logout
app.post('/logout', async (c) => {
  const user = c.get('user');
  if (user) {
    await createAuditLog(c, 'user.logout', 'user', user.id);
  }
  return c.json({ success: true });
});

// Get current user
app.get('/me', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { password_hash, ...safeUser } = user;
  return c.json(toCamelCase(safeUser));
});

// Refresh token
app.post('/refresh', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = await generateToken(user.id, c.env.JWT_SECRET);
  return c.json({
    token,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
});

// Request password reset
app.post('/reset-password', async (c) => {
  const { email } = await c.req.json<{ email: string }>();

  const user = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  )
    .bind(email.toLowerCase())
    .first();

  // Always return success to prevent email enumeration
  if (!user) {
    return c.json({ success: true, message: 'If the email exists, a reset link has been sent' });
  }

  // In production, send email with reset link
  // For now, just return success
  return c.json({ success: true, message: 'If the email exists, a reset link has been sent' });
});

// Change password
app.post('/change-password', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { currentPassword, newPassword } = await c.req.json<{
    currentPassword: string;
    newPassword: string;
  }>();

  const validPassword = await verifyPassword(currentPassword, user.password_hash);
  if (!validPassword) {
    return c.json({ error: 'Current password is incorrect' }, 400);
  }

  if (newPassword.length < 6) {
    return c.json({ error: 'New password must be at least 6 characters' }, 400);
  }

  const newHash = await hashPassword(newPassword);
  await c.env.DB.prepare(
    "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
  )
    .bind(newHash, user.id)
    .run();

  await createAuditLog(c, 'user.updated', 'user', user.id, null, { passwordChanged: true });

  return c.json({ success: true });
});

// ============================================
// PUBLIC SIGNUP - Create new tenant (onboarding)
// ============================================
app.post('/public/signup', async (c) => {
  const body = await c.req.json<{
    email: string;
    password: string;
    businessName: string;
    phone?: string;
  }>();

  const { email, password, businessName, phone } = body;

  // Validation
  if (!email || !password || !businessName) {
    return c.json({
      error: 'Email, password, and business name are required',
      code: 'VALIDATION_ERROR',
    }, 400);
  }

  if (password.length < 6) {
    return c.json({
      error: 'Password must be at least 6 characters',
      code: 'VALIDATION_ERROR',
    }, 400);
  }

  // Check if email already exists
  const existingUser = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  )
    .bind(email.toLowerCase())
    .first();

  if (existingUser) {
    return c.json({
      error: 'Email already registered',
      code: 'EMAIL_EXISTS',
    }, 400);
  }

  // Generate IDs
  const tenantId = generateId();
  const locationId = generateId();
  const userId = generateId();
  const subscriptionId = generateId();

  // Generate slug from business name
  let slug = slugify(businessName);

  // Check if slug exists and make unique if needed
  const existingSlug = await c.env.DB.prepare(
    'SELECT id FROM tenants WHERE slug = ?'
  )
    .bind(slug)
    .first();

  if (existingSlug) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Calculate trial end date (14 days)
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  try {
    // Create tenant
    await c.env.DB.prepare(`
      INSERT INTO tenants (
        id, name, slug, email, phone, plan, status,
        trial_ends_at, max_users, max_locations,
        mp_enabled, settings, branding, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'free', 'trial', ?, 3, 1, 0, '{}', '{}', datetime('now'), datetime('now'))
    `).bind(
      tenantId,
      businessName,
      slug,
      email.toLowerCase(),
      phone || null,
      trialEndsAt.toISOString()
    ).run();

    // Create default location
    await c.env.DB.prepare(`
      INSERT INTO locations (
        id, tenant_id, name, is_default, active, created_at, updated_at
      ) VALUES (?, ?, 'Sucursal Principal', 1, 1, datetime('now'), datetime('now'))
    `).bind(locationId, tenantId).run();

    // Create admin user for tenant
    await c.env.DB.prepare(`
      INSERT INTO users (
        id, tenant_id, email, name, password_hash, role,
        active, email_verified, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'admin', 1, 0, datetime('now'), datetime('now'))
    `).bind(
      userId,
      tenantId,
      email.toLowerCase(),
      businessName,
      passwordHash
    ).run();

    // Create trial subscription
    await c.env.DB.prepare(`
      INSERT INTO subscriptions (
        id, tenant_id, plan, status, amount, currency, billing_cycle,
        starts_at, ends_at, created_at, updated_at
      ) VALUES (?, ?, 'free', 'active', 0, 'ARS', 'monthly', datetime('now'), ?, datetime('now'), datetime('now'))
    `).bind(subscriptionId, tenantId, trialEndsAt.toISOString()).run();

    // Generate token
    const token = await generateToken(userId, c.env.JWT_SECRET);

    // Create audit log (without user context since we just created it)
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (
        id, tenant_id, user_id, user_name, user_email, action,
        resource_type, resource_id, new_value, ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, 'tenant.created', 'tenant', ?, ?, ?, ?, datetime('now'))
    `).bind(
      generateId(),
      tenantId,
      userId,
      businessName,
      email.toLowerCase(),
      tenantId,
      JSON.stringify({ businessName, email, plan: 'free', status: 'trial' }),
      c.req.header('CF-Connecting-IP') || null,
      c.req.header('User-Agent') || null
    ).run();

    return c.json({
      success: true,
      token,
      tenantId,
      user: {
        id: userId,
        email: email.toLowerCase(),
        name: businessName,
        role: 'admin',
        tenantId,
        active: true,
        emailVerified: false,
      },
      tenant: {
        id: tenantId,
        name: businessName,
        slug,
        status: 'trial',
        plan: 'free',
        trialEndsAt: trialEndsAt.toISOString(),
      },
      message: 'Account created successfully. Trial period: 14 days.',
    }, 201);
  } catch (error) {
    console.error('Signup error:', error);
    return c.json({
      error: 'Failed to create account',
      code: 'INTERNAL_ERROR',
    }, 500);
  }
});

export { app as authRoutes };
