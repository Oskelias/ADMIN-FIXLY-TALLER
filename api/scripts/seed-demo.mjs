#!/usr/bin/env node
/**
 * Seed Demo Script
 *
 * Creates a demo tenant with:
 *   - Demo tenant + location
 *   - Demo user (admin role)
 *   - 10 fake orders
 *   - 5 fake payments
 *   - 10 fake audit logs
 *
 * Environment variables:
 *   - DEMO_USER_EMAIL (default: demo@fixly.com)
 *   - DEMO_USER_PASSWORD (default: demo123)
 *
 * Usage: npm run seed:demo
 */

import { execSync } from 'child_process';
import crypto from 'crypto';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Configuration
const email = process.env.DEMO_USER_EMAIL || 'demo@fixly.com';
const username = process.env.DEMO_USER_USERNAME || 'demo';
const password = process.env.DEMO_USER_PASSWORD || 'demo123';
const dbName = process.env.D1_DATABASE || 'fixly-admin-db';
const isProduction = process.env.NODE_ENV === 'production';

// Hash password using SHA-256 (same as backend)
function hashPassword(pwd) {
  return crypto.createHash('sha256').update(pwd).digest('hex');
}

function uuid() {
  return crypto.randomUUID();
}

function randomDate(daysBack = 30) {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysBack));
  return date.toISOString();
}

function randomAmount() {
  return (Math.floor(Math.random() * 50000) + 5000);
}

const passwordHash = hashPassword(password);
const now = new Date().toISOString();

// Fixed IDs for demo (so we can check if exists)
const DEMO_TENANT_ID = 'demo-tenant-001';
const DEMO_LOCATION_ID = 'demo-location-001';
const DEMO_USER_ID = 'demo-user-001';

// Generate fake data
const orderStatuses = ['pending', 'in_progress', 'completed', 'invoiced'];
const paymentStatuses = ['approved', 'pending', 'rejected'];
const paymentMethods = ['credit_card', 'debit_card', 'account_money', 'cash'];
const customerNames = [
  'Juan Pérez', 'María García', 'Carlos López', 'Ana Martínez',
  'Roberto Sánchez', 'Laura Fernández', 'Diego Rodríguez', 'Sofía González'
];
const vehicleBrands = ['Ford', 'Chevrolet', 'Toyota', 'Volkswagen', 'Fiat', 'Renault'];
const vehicleModels = ['Focus', 'Cruze', 'Corolla', 'Golf', 'Cronos', 'Sandero'];
const auditActions = [
  'user.login', 'order.created', 'order.updated', 'payment.created', 'config.updated'
];

// Generate orders SQL
let ordersSQL = '';
for (let i = 1; i <= 10; i++) {
  const orderId = uuid();
  const status = orderStatuses[Math.floor(Math.random() * orderStatuses.length)];
  const customer = customerNames[Math.floor(Math.random() * customerNames.length)];
  const brand = vehicleBrands[Math.floor(Math.random() * vehicleBrands.length)];
  const model = vehicleModels[Math.floor(Math.random() * vehicleModels.length)];
  const total = randomAmount();
  const createdAt = randomDate(30);

  ordersSQL += `
INSERT INTO orders (
  id, tenant_id, location_id, user_id, order_number, status,
  customer_name, customer_email, customer_phone,
  vehicle_plate, vehicle_brand, vehicle_model, vehicle_year,
  description, subtotal, tax, total, created_at, updated_at
) VALUES (
  '${orderId}', '${DEMO_TENANT_ID}', '${DEMO_LOCATION_ID}', '${DEMO_USER_ID}',
  'ORD-${String(i).padStart(4, '0')}', '${status}',
  '${customer}', '${customer.toLowerCase().replace(' ', '.')}@email.com', '+54911${Math.floor(Math.random() * 90000000 + 10000000)}',
  'ABC${Math.floor(Math.random() * 900 + 100)}', '${brand}', '${model}', ${2018 + Math.floor(Math.random() * 6)},
  'Servicio de mantenimiento general', ${Math.floor(total * 0.79)}, ${Math.floor(total * 0.21)}, ${total},
  '${createdAt}', '${createdAt}'
);
`;
}

// Generate payments SQL
let paymentsSQL = '';
for (let i = 1; i <= 5; i++) {
  const paymentId = uuid();
  const status = paymentStatuses[Math.floor(Math.random() * paymentStatuses.length)];
  const method = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
  const customer = customerNames[Math.floor(Math.random() * customerNames.length)];
  const amount = randomAmount();
  const createdAt = randomDate(30);

  paymentsSQL += `
INSERT INTO payments (
  id, tenant_id, user_id, external_id, amount, currency, status,
  payment_method, payer_name, payer_email, description,
  processed_at, created_at, updated_at
) VALUES (
  '${paymentId}', '${DEMO_TENANT_ID}', '${DEMO_USER_ID}',
  'MP-${Math.floor(Math.random() * 900000000 + 100000000)}',
  ${amount}, 'ARS', '${status}', '${method}',
  '${customer}', '${customer.toLowerCase().replace(' ', '.')}@email.com',
  'Pago de servicio',
  ${status === 'approved' ? `'${createdAt}'` : 'NULL'},
  '${createdAt}', '${createdAt}'
);
`;
}

// Generate audit logs SQL
let auditSQL = '';
for (let i = 1; i <= 10; i++) {
  const auditId = uuid();
  const action = auditActions[Math.floor(Math.random() * auditActions.length)];
  const createdAt = randomDate(14);

  auditSQL += `
INSERT INTO audit_logs (
  id, tenant_id, user_id, user_name, user_email, action,
  resource_type, resource_id, ip_address, created_at
) VALUES (
  '${auditId}', '${DEMO_TENANT_ID}', '${DEMO_USER_ID}',
  'Demo User', '${email}', '${action}',
  '${action.split('.')[0]}', '${uuid()}',
  '192.168.1.${Math.floor(Math.random() * 255)}',
  '${createdAt}'
);
`;
}

// Full SQL
const sql = `
-- Demo Tenant
INSERT OR IGNORE INTO tenants (
  id, name, slug, email, phone, plan, status,
  trial_ends_at, max_users, max_locations,
  mp_enabled, settings, branding, created_at, updated_at
) VALUES (
  '${DEMO_TENANT_ID}',
  'Taller Demo',
  'taller-demo',
  '${email}',
  '+5491155551234',
  'professional',
  'active',
  NULL,
  10,
  3,
  1,
  '{"currency":"ARS","timezone":"America/Argentina/Buenos_Aires"}',
  '{"primaryColor":"#7c3aed","logo":null}',
  '${now}',
  '${now}'
);

-- Demo Location
INSERT OR IGNORE INTO locations (
  id, tenant_id, name, address, city, province, phone,
  is_default, active, created_at, updated_at
) VALUES (
  '${DEMO_LOCATION_ID}',
  '${DEMO_TENANT_ID}',
  'Sucursal Principal',
  'Av. Corrientes 1234',
  'Buenos Aires',
  'CABA',
  '+5491155551234',
  1,
  1,
  '${now}',
  '${now}'
);

-- Demo User (admin of the tenant)
INSERT OR IGNORE INTO users (
  id, tenant_id, email, username, name, password_hash, role,
  active, email_verified, created_at, updated_at
) VALUES (
  '${DEMO_USER_ID}',
  '${DEMO_TENANT_ID}',
  '${email.toLowerCase()}',
  '${username.toLowerCase()}',
  'Demo User',
  '${passwordHash}',
  'admin',
  1,
  1,
  '${now}',
  '${now}'
);

-- Demo Subscription
INSERT OR IGNORE INTO subscriptions (
  id, tenant_id, plan, status, amount, currency, billing_cycle,
  starts_at, ends_at, created_at, updated_at
) VALUES (
  'demo-subscription-001',
  '${DEMO_TENANT_ID}',
  'professional',
  'active',
  19900,
  'ARS',
  'monthly',
  '${now}',
  '${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()}',
  '${now}',
  '${now}'
);

-- Demo Orders (10)
${ordersSQL}

-- Demo Payments (5)
${paymentsSQL}

-- Demo Audit Logs (10)
${auditSQL}
`;

// Write SQL to temp file
const tempFile = join(tmpdir(), `seed-demo-${Date.now()}.sql`);
writeFileSync(tempFile, sql);

console.log('🔧 Seeding demo data...');
console.log(`   Tenant: Taller Demo`);
console.log(`   User: ${email}`);
console.log(`   Database: ${dbName}`);
console.log('');

try {
  // Execute seed SQL
  const seedCmd = isProduction
    ? `wrangler d1 execute ${dbName} --env production --file=${tempFile}`
    : `wrangler d1 execute ${dbName} --file=${tempFile}`;

  execSync(seedCmd, { stdio: 'inherit' });

  console.log('');
  console.log('✅ Demo data seeded successfully!');
  console.log('');
  console.log('📊 Created:');
  console.log('   - 1 Demo Tenant (Taller Demo)');
  console.log('   - 1 Demo Location');
  console.log('   - 1 Demo User (admin)');
  console.log('   - 1 Demo Subscription');
  console.log('   - 10 Demo Orders');
  console.log('   - 5 Demo Payments');
  console.log('   - 10 Demo Audit Logs');
  console.log('');
  console.log(`📝 Demo credentials:`);
  console.log(`   Username: ${username}`);
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${password}`);

} catch (error) {
  console.error('❌ Failed to seed demo data:', error.message);
  process.exit(1);
} finally {
  // Cleanup temp file
  try {
    unlinkSync(tempFile);
  } catch {}
}
