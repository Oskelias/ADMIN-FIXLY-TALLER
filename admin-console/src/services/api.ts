import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/auth';
import type {
  ApiError,
  AuditFilters,
  AuditLog,
  DashboardStats,
  MercadoPagoConfig,
  OperationFilters,
  Order,
  PaginatedResponse,
  Payment,
  PaymentFilters,
  Session,
  Tenant,
  TenantFilters,
  TenantSettings,
  User,
  UserFilters,
  UserRole,
} from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.fixlytaller.com';

// =====================================================
// Helper → convierte filtros tipados a params de axios
// =====================================================
function toParams(filters?: unknown): Record<string, unknown> | undefined {
  if (!filters || typeof filters !== 'object') return undefined;
  return filters as Record<string, unknown>;
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = useAuthStore.getState().token;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiError>) => {
        if (error.response?.status === 401) {
          useAuthStore.getState().logout();
          window.location.href = '/login';
        }

        if (error.response?.status === 403) {
          const errorCode = error.response?.data?.code;

          // Handle tenant suspended (for app usage)
          if (errorCode === 'TENANT_SUSPENDED') {
            window.dispatchEvent(
              new CustomEvent('tenant-suspended', {
                detail: {
                  tenantId: (error.response?.data as any)?.tenantId,
                  tenantName: (error.response?.data as any)?.tenantName,
                  message: error.response?.data?.message,
                },
              })
            );
          }

          console.error('Access denied:', error.response?.data);
        }

        // Transform error for consistent handling
        const apiError: ApiError = {
          code: error.response?.data?.code || 'UNKNOWN_ERROR',
          message: error.response?.data?.message || error.message || 'An error occurred',
          details: error.response?.data?.details,
          ...(typeof (error.response?.data as any)?.tenantId !== 'undefined'
            ? { tenantId: (error.response?.data as any)?.tenantId }
            : {}),
          ...(typeof (error.response?.data as any)?.tenantName !== 'undefined'
            ? { tenantName: (error.response?.data as any)?.tenantName }
            : {}),
        } as ApiError;

        return Promise.reject(apiError);
      }
    );
  }

  // Generic request methods
  async get<T>(url: string, params?: unknown): Promise<T> {
    const response = await this.client.get<T>(url, { params: toParams(params) });
    return response.data;
  }

  async post<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.client.post<T>(url, data);
    return response.data;
  }

  async put<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.client.put<T>(url, data);
    return response.data;
  }

  async patch<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.client.patch<T>(url, data);
    return response.data;
  }

  async delete<T>(url: string): Promise<T> {
    const response = await this.client.delete<T>(url);
    return response.data;
  }
}

export const api = new ApiClient();

// =====================================================
// AUTH
// =====================================================
export const authApi = {
  // Backend ACTUAL (según tu captura): /auth/login (sin /api)
  login: (username: string, password: string) =>
    api.post<{ user: User; token: string }>('/auth/login', { username, password }),

  logout: () => api.post<void>('/auth/logout'),

  me: () => api.get<User>('/auth/me'),

  refreshToken: () => api.post<{ token: string }>('/auth/refresh'),

  resetPassword: (email: string) => api.post<void>('/auth/reset-password', { email }),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<void>('/auth/change-password', { currentPassword, newPassword }),

  // Public register - backend nuevo: /auth/public/register
  signup: (data: { email: string; password: string; businessName: string; phone?: string }) =>
    api.post<{ ok: boolean; message?: string; user?: User; token?: string }>(
      '/auth/public/register',
      data
    ),
};

// =====================================================
// DASHBOARD
// =====================================================
export const dashboardApi = {
  // Backend nuevo: GET /api/admin/stats
  getStats: () => api.get<DashboardStats>('/api/admin/stats'),

  // Este endpoint no lo vimos confirmado; lo dejo pero bajo /api para que no apunte a rutas viejas.
  // Si no existe, lo podés comentar hasta implementarlo.
  getRecentActivity: (limit = 10) =>
    api.get<AuditLog[]>('/api/admin/dashboard/activity', { limit }),
};

// =====================================================
// TENANTS
// =====================================================
export const tenantsApi = {
  list: (filters?: TenantFilters) => api.get<PaginatedResponse<Tenant>>('/api/admin/tenants', filters),
  get: (id: string) => api.get<Tenant>(`/api/admin/tenants/${id}`),
  create: (data: unknown) => api.post<Tenant>('/api/admin/tenants', data),
  update: (id: string, data: unknown) => api.put<Tenant>(`/api/admin/tenants/${id}`, data),
  delete: (id: string) => api.delete<void>(`/api/admin/tenants/${id}`),
  suspend: (id: string, reason: string) => api.post(`/api/admin/tenants/${id}/suspend`, { reason }),
  activate: (id: string) => api.post(`/api/admin/tenants/${id}/activate`),
};

// =====================================================
// USERS
// =====================================================
export const usersApi = {
  list: (filters?: UserFilters) => api.get<PaginatedResponse<User>>('/api/admin/users', filters),
  get: (id: string) => api.get<User>(`/api/admin/users/${id}`),
  create: (data: unknown) => api.post<User>('/api/admin/users', data),
  update: (id: string, data: unknown) => api.put<User>(`/api/admin/users/${id}`, data),
  delete: (id: string) => api.delete<void>(`/api/admin/users/${id}`),
  getSessions: (id: string) => api.get<Session[]>(`/api/admin/users/${id}/sessions`),
  terminateSession: (userId: string, sessionId: string) =>
    api.delete<void>(`/api/admin/users/${userId}/sessions/${sessionId}`),
  resetPassword: (id: string) => api.post<void>(`/api/admin/users/${id}/reset-password`),
  block: (id: string, reason: string) => api.post<void>(`/api/admin/users/${id}/block`, { reason }),
  unblock: (id: string) => api.post<void>(`/api/admin/users/${id}/unblock`),
  invite: (data: { email: string; role: UserRole }) => api.post<void>('/api/admin/users/invite', data),
};

// =====================================================
// PAYMENTS
// =====================================================
export const paymentsApi = {
  list: (filters?: PaymentFilters) =>
    api.get<PaginatedResponse<Payment>>('/api/admin/payments', filters),
  get: (id: string) => api.get<Payment>(`/api/admin/payments/${id}`),
  refund: (id: string, reason: string) =>
    api.post<void>(`/api/admin/payments/${id}/refund`, { reason }),
};

// =====================================================
// OPERATIONS
// =====================================================
export const operationsApi = {
  listOrders: (filters?: OperationFilters) =>
    api.get<PaginatedResponse<Order>>('/api/admin/operations/orders', filters),
  getOrder: (id: string) => api.get<Order>(`/api/admin/operations/orders/${id}`),
};

// =====================================================
// AUDIT
// =====================================================
export const auditApi = {
  list: (filters?: AuditFilters) => api.get<PaginatedResponse<AuditLog>>('/api/admin/audit', filters),
};

// =====================================================
// CONFIG
// =====================================================
export const configApi = {
  getTenantSettings: (tenantId: string) =>
    api.get<TenantSettings>(`/api/admin/config/${tenantId}/settings`),
  updateTenantSettings: (tenantId: string, settings: TenantSettings) =>
    api.put<TenantSettings>(`/api/admin/config/${tenantId}/settings`, settings),
  getSystemHealth: () =>
    api.get<{ status: string; services: Record<string, { status: string; latency: number }> }>(
      '/api/admin/config/health'
    ),
};

// =====================================================
// MERCADO PAGO
// =====================================================
export const mercadoPagoApi = {
  getConfig: (tenantId: string) =>
    api.get<MercadoPagoConfig>(`/api/admin/mercadopago/${tenantId}/config`),
  testConnection: (tenantId: string) =>
    api.post<{ success: boolean; message?: string }>(
      `/api/admin/mercadopago/${tenantId}/test-connection`
    ),
};
