import * as jose from 'jose';
import { Context } from 'hono';
import { Env, PaginationParams, PaginatedResponse, User } from '../types';

// Generate UUID
export function generateId(): string {
  return crypto.randomUUID();
}

// Hash password using Web Crypto API
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

// Generate JWT token
export async function generateToken(
  userId: string,
  jwtSecret: string,
  expiresIn: string = '24h'
): Promise<string> {
  const secret = new TextEncoder().encode(jwtSecret);
  const alg = 'HS256';

  const token = await new jose.SignJWT({ sub: userId })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);

  return token;
}

// Parse pagination params
export function parsePagination(params: URLSearchParams): PaginationParams {
  return {
    page: parseInt(params.get('page') || '1'),
    pageSize: Math.min(parseInt(params.get('pageSize') || '10'), 100),
    sortBy: params.get('sortBy') || 'created_at',
    sortOrder: (params.get('sortOrder') || 'desc') as 'asc' | 'desc',
  };
}

// Create paginated response
export function paginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResponse<T> {
  const page = params.page || 1;
  const pageSize = params.pageSize || 10;
  return {
    data,
    pagination: {
      page,
      pageSize,
      totalItems: total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

// Create audit log
export async function createAuditLog(
  c: Context<{ Bindings: Env }>,
  action: string,
  resourceType: string,
  resourceId: string,
  oldValue?: unknown,
  newValue?: unknown
): Promise<void> {
  const user = c.get('user');
  if (!user) return;

  const id = generateId();
  const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || null;
  const userAgent = c.req.header('User-Agent') || null;

  await c.env.DB.prepare(`
    INSERT INTO audit_logs (
      id, user_id, user_name, user_email, tenant_id, action,
      resource_type, resource_id, old_value, new_value,
      ip_address, user_agent, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(
    id,
    user.id,
    user.name,
    user.email,
    user.tenant_id,
    action,
    resourceType,
    resourceId,
    oldValue ? JSON.stringify(oldValue) : null,
    newValue ? JSON.stringify(newValue) : null,
    ipAddress,
    userAgent
  ).run();
}

// Transform database row to camelCase
export function toCamelCase<T>(obj: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = obj[key];
  }
  return result as T;
}

// Transform array of rows to camelCase
export function rowsToCamelCase<T>(rows: Record<string, unknown>[]): T[] {
  return rows.map(row => toCamelCase<T>(row));
}

// Slugify text
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}
