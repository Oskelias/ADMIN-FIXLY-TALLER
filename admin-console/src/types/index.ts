// ============ USER & AUTH TYPES ============
export type UserRole = 'superadmin' | 'admin' | 'operator' | 'viewer';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string | null;
  avatar?: string;
  active: boolean;
  emailVerified: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  expiresAt: string;
}

// ============ TENANT TYPES ============
export type TenantStatus = 'active' | 'inactive' | 'suspended' | 'trial';
export type TenantPlan = 'free' | 'starter' | 'professional' | 'enterprise';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone?: string;
  status: TenantStatus;
  plan: TenantPlan;
  trialEndsAt?: string;
  subscriptionEndsAt?: string;
  maxUsers: number;
  maxLocations: number;
  settings: TenantSettings;
  mercadoPagoEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TenantSettings {
  branding: {
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
  notifications: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    whatsappEnabled: boolean;
  };
  features: {
    inventoryEnabled: boolean;
    reportsEnabled: boolean;
    multiLocationEnabled: boolean;
  };
}

export interface TenantStats {
  totalUsers: number;
  activeUsers: number;
  totalLocations: number;
  totalRevenue: number;
  totalOrders: number;
}

// ============ LOCATION TYPES ============
export interface Location {
  id: string;
  tenantId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  zipCode?: string;
  phone?: string;
  email?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============ PAYMENT TYPES ============
export type PaymentStatus = 'approved' | 'pending' | 'rejected' | 'refunded' | 'cancelled';
export type PaymentMethod = 'credit_card' | 'debit_card' | 'bank_transfer' | 'cash' | 'mercadopago';

export interface Payment {
  id: string;
  tenantId: string;
  orderId?: string;
  externalId?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  payerName?: string;
  payerEmail?: string;
  payerDocument?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  processedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  tenantId: string;
  plan: TenantPlan;
  status: 'active' | 'cancelled' | 'paused' | 'past_due';
  amount: number;
  currency: string;
  billingCycle: 'monthly' | 'yearly';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MercadoPagoConfig {
  tenantId: string;
  enabled: boolean;
  accessToken?: string;
  publicKey?: string;
  webhookSecret?: string;
  webhookUrl: string;
  status: 'configured' | 'pending' | 'error';
  lastSyncAt?: string;
}

// ============ OPERATION TYPES ============
export type OrderStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'delivered';

export interface Order {
  id: string;
  tenantId: string;
  locationId: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  vehicleInfo?: string;
  description: string;
  status: OrderStatus;
  totalAmount: number;
  paidAmount: number;
  items: OrderItem[];
  notes?: string;
  estimatedCompletionAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

// ============ AUDIT TYPES ============
export type AuditAction =
  | 'user.created' | 'user.updated' | 'user.deleted' | 'user.login' | 'user.logout'
  | 'tenant.created' | 'tenant.updated' | 'tenant.deleted'
  | 'payment.created' | 'payment.updated' | 'payment.refunded'
  | 'order.created' | 'order.updated' | 'order.completed'
  | 'settings.updated' | 'config.updated';

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  tenantId?: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// ============ SESSION TYPES ============
export interface Session {
  id: string;
  userId: string;
  userEmail: string;
  ipAddress: string;
  userAgent: string;
  lastActivityAt: string;
  expiresAt: string;
  createdAt: string;
}

// ============ API TYPES ============
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
  tenantId?: string;
  tenantName?: string;
}

export interface DashboardStats {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  activeUsers: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalPayments: number;
  pendingPayments: number;
  approvedPayments: number;
  rejectedPayments: number;
  revenueByMonth: { month: string; revenue: number }[];
  paymentsByStatus: { status: string; count: number; amount: number }[];
  tenantsByPlan: { plan: string; count: number }[];
  recentActivity: AuditLog[];
}

// ============ FILTER TYPES ============
export interface BaseFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface UserFilters extends BaseFilters {
  role?: UserRole;
  status?: 'active' | 'inactive';
  tenantId?: string;
}

export interface TenantFilters extends BaseFilters {
  status?: TenantStatus;
  plan?: TenantPlan;
}

export interface PaymentFilters extends BaseFilters {
  status?: PaymentStatus;
  tenantId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface AuditFilters extends BaseFilters {
  action?: AuditAction;
  userId?: string;
  tenantId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface OperationFilters extends BaseFilters {
  status?: OrderStatus;
  tenantId?: string;
  locationId?: string;
  dateFrom?: string;
  dateTo?: string;
}
