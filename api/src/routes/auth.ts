import { Hono } from 'hono';
import { Env, User } from '../types';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  createAuditLog,
  toCamelCase,
} from '../utils/helpers';

const app = new Hono<{ Bindings: Env }>();

// Login
app.post('/login', async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>();

  if (!email || !password) {
    return c.json({ error: 'Email and password are required' }, 400);
  }

  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE email = ? AND active = 1'
  )
    .bind(email.toLowerCase())
    .first<User>();

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

export { app as authRoutes };
