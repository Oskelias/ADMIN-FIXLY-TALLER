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

/* =====================================================
   Helper → convierte filtros tipados a params de axios
===================================================== */
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
          // estos 2 campos solo existen si tu ApiError los declara (si no, arreglamos types)
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

// ============ AUTH ENDPOINTS ============
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ user: User; token: string }>('/auth/login', { email, password }),

  logout: () => api.post<void>('/auth/logout'),

  me: () => api.get<User>('/auth/me'),

  refreshToken: () => api.post<{ token: string }>('/auth/refresh'),

  resetPassword: (email: string) => api.post<void>('/auth/reset-password', { email }),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<void>('/auth/change-password', { currentPassword, newPassword }),

  // Public signup - creates new tenant + user
  signup: (data: { email: string; password: string; businessName: string; phone?: string }) =>
    api.post<{ user: User; token: string }>('/auth/public/signup', data),
};

// ============ DASHBOARD ENDPOINTS ============
export const dashboardApi = {
  getStats: () => api.get<DashboardStats>('/admin/dashboard/stats'),
  getRecentActivity: (limit = 10) =>
    api.get<AuditLog[]>('/admin/dashboard/activity', { limit }),
};

// ============ TENANT ENDPOINTS ============
export const tenantsApi = {
  list: (filters?: TenantFilters) => api.get<PaginatedResponse<Tenant>>('/admin/tenants', filters),
  get: (id: string) => api.get<Tenant>(`/admin/tenants/${id}`),
  create: (data: unknown) => api.post<Tenant>('/admin/tenants', data),
  update: (id: string, data: unknown) => api.put<Tenant>(`/admin/tenants/${id}`, data),
  delete: (id: string) => api.delete<void>(`/admin/tenants/${id}`),
  suspend: (id: string, reason: string) => api.post(`/admin/tenants/${id}/suspend`, { reason }),
  activate: (id: string) => api.post(`/admin/tenants/${id}/activate`),
};

// ============ USER ENDPOINTS ============
export const usersApi = {
  list: (filters?: UserFilters) => api.get<PaginatedResponse<User>>('/admin/users', filters),
  get: (id: string) => api.get<User>(`/admin/users/${id}`),
  create: (data: unknown) => api.post<User>('/admin/users', data),
  update: (id: string, data: unknown) => api.put<User>(`/admin/users/${id}`, data),
  delete: (id: string) => api.delete<void>(`/admin/users/${id}`),
  getSessions: (id: string) => api.get<Session[]>(`/admin/users/${id}/sessions`),
  terminateSession: (userId: string, sessionId: string) =>
    api.delete<void>(`/admin/users/${userId}/sessions/${sessionId}`),
  resetPassword: (id: string) => api.post<void>(`/admin/users/${id}/reset-password`),
  block: (id: string, reason: string) => api.post<void>(`/admin/users/${id}/block`, { reason }),
  unblock: (id: string) => api.post<void>(`/admin/users/${id}/unblock`),
  invite: (data: { email: string; role: UserRole }) => api.post<void>('/admin/users/invite', data),
};

// ============ LOCATION ENDPOINTS ============
export const locationsApi = {
  list: (tenantId?: string) =>
    api.get<PaginatedResponse<Location>>('/admin/locations', { tenantId }),

  get: (id: string) => api.get<Location>(`/admin/locations/${id}`),

  create: (data: Partial<Location>) =>
    api.post<Location>('/admin/locations', data),

  update: (id: string, data: Partial<Location>) =>
    api.put<Location>(`/admin/locations/${id}`, data),

  delete: (id: string) => api.delete<void>(`/admin/locations/${id}`),
};

// ============ PAYMENT ENDPOINTS ============
export const paymentsApi = {
  list: (filters?: PaymentFilters) => api.get<PaginatedResponse<Payment>>('/admin/payments', filters),
  get: (id: string) => api.get<Payment>(`/admin/payments/${id}`),
  refund: (id: string, reason: string) => api.post<void>(`/admin/payments/${id}/refund`, { reason }),
};

// ============ SUBSCRIPTION ENDPOINTS ============
export const subscriptionsApi = {
  list: (tenantId?: string) =>
    api.get<PaginatedResponse<Subscription>>('/admin/subscriptions', { tenantId }),

  get: (id: string) => api.get<Subscription>(`/admin/subscriptions/${id}`),

  cancel: (id: string, reason: string) =>
    api.post<void>(`/admin/subscriptions/${id}/cancel`, { reason }),
};

// ============ MERCADOPAGO ENDPOINTS ============
export const mercadoPagoApi = {
  getConfig: (tenantId: string) =>
    api.get<MercadoPagoConfig>(`/admin/mercadopago/${tenantId}/config`),

  updateConfig: (tenantId: string, data: Partial<MercadoPagoConfig>) =>
    api.put<void>(`/admin/mercadopago/${tenantId}/config`, data),

  testConnection: (tenantId: string) =>
    api.post<{ success: boolean; message: string }>(`/admin/mercadopago/${tenantId}/test`),

  getTransactions: (tenantId: string, filters?: PaymentFilters) =>
    api.get<PaginatedResponse<Payment>>(
      `/admin/mercadopago/${tenantId}/transactions`,
      filters
    ),
};

// ============ OPERATIONS ENDPOINTS ============
export const operationsApi = {
  listOrders: (filters?: OperationFilters) =>
    api.get<PaginatedResponse<Order>>('/admin/operations/orders', filters),
  getOrder: (id: string) => api.get<Order>(`/admin/operations/orders/${id}`),
};

// ============ AUDIT ENDPOINTS ============
export const auditApi = {
  list: (filters?: AuditFilters) => api.get<PaginatedResponse<AuditLog>>('/admin/audit', filters),
};

/* =====================================================
   CONFIG
  getSystemHealth: () =>
    api.get<{ status: string; services: Record<string, { status: string; latency: number }> }>(
      '/admin/config/health'
    ),
};

/* =====================================================
   MERCADO PAGO
};
