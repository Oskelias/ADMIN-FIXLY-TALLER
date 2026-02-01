#!/usr/bin/env node
/**
 * Seed Superadmin Script
 *
 * Creates a superadmin user if it doesn't exist.
 * Reads from environment variables:
 *   - SUPERADMIN_EMAIL (required)
 *   - SUPERADMIN_PASSWORD (required)
 *
 * Usage: npm run seed:superadmin
 */

import { execSync } from 'child_process';
import crypto from 'crypto';

// Read environment variables
const email = process.env.SUPERADMIN_EMAIL;
const password = process.env.SUPERADMIN_PASSWORD;
const dbName = process.env.D1_DATABASE || 'fixly-admin-db';
const isProduction = process.env.NODE_ENV === 'production';

if (!email || !password) {
  console.error('❌ Error: SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD are required');
  console.error('');
  console.error('Usage:');
  console.error('  SUPERADMIN_EMAIL=admin@fixly.com SUPERADMIN_PASSWORD=secret123 npm run seed:superadmin');
  process.exit(1);
}

// Hash password using SHA-256 (same as backend)
function hashPassword(pwd) {
  return crypto.createHash('sha256').update(pwd).digest('hex');
}

const passwordHash = hashPassword(password);
const userId = crypto.randomUUID();
const now = new Date().toISOString();

// SQL to insert superadmin (or skip if exists)
const sql = `
-- Check if superadmin exists, if not create
INSERT OR IGNORE INTO users (
  id, email, name, password_hash, role, tenant_id,
  active, email_verified, created_at, updated_at
) VALUES (
  '${userId}',
  '${email.toLowerCase()}',
  'Super Admin',
  '${passwordHash}',
  'superadmin',
  NULL,
  1,
  1,
  '${now}',
  '${now}'
);
`;

// Write SQL to temp file
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const tempFile = join(tmpdir(), `seed-superadmin-${Date.now()}.sql`);
writeFileSync(tempFile, sql);

console.log('🔧 Seeding superadmin...');
console.log(`   Email: ${email}`);
console.log(`   Database: ${dbName}`);
console.log('');

try {
  // Check if user already exists
  const checkCmd = isProduction
    ? `wrangler d1 execute ${dbName} --env production --command "SELECT id FROM users WHERE email = '${email.toLowerCase()}' AND role = 'superadmin'"`
    : `wrangler d1 execute ${dbName} --command "SELECT id FROM users WHERE email = '${email.toLowerCase()}' AND role = 'superadmin'"`;

  const result = execSync(checkCmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });

  if (result.includes('"results":[{')) {
    console.log('ℹ️  Superadmin already exists, skipping creation');
  } else {
    // Execute seed SQL
    const seedCmd = isProduction
      ? `wrangler d1 execute ${dbName} --env production --file=${tempFile}`
      : `wrangler d1 execute ${dbName} --file=${tempFile}`;

    execSync(seedCmd, { stdio: 'inherit' });
    console.log('✅ Superadmin created successfully!');
  }
} catch (error) {
  // If check fails (table doesn't exist yet), try to create anyway
  try {
    const seedCmd = isProduction
      ? `wrangler d1 execute ${dbName} --env production --file=${tempFile}`
      : `wrangler d1 execute ${dbName} --file=${tempFile}`;

    execSync(seedCmd, { stdio: 'inherit' });
    console.log('✅ Superadmin created successfully!');
  } catch (seedError) {
    console.error('❌ Failed to seed superadmin:', seedError.message);
    process.exit(1);
  }
} finally {
  // Cleanup temp file
  try {
    unlinkSync(tempFile);
  } catch {}
}

console.log('');
console.log('📝 You can now login at admin.fixlytaller.com with these credentials');
