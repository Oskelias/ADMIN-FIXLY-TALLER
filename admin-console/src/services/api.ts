import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/auth';
import type { ApiError } from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.fixlytaller.com';

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
          // Token expired or invalid - logout
          useAuthStore.getState().logout();
          window.location.href = '/login';
        }

        if (error.response?.status === 403) {
          const errorCode = error.response?.data?.code;

          // Handle tenant suspended (for app usage)
          if (errorCode === 'TENANT_SUSPENDED') {
            // Store suspension info for UI to handle
            window.dispatchEvent(new CustomEvent('tenant-suspended', {
              detail: {
                tenantId: error.response.data.tenantId,
                tenantName: error.response.data.tenantName,
                message: error.response.data.message,
              }
            }));
          }

          // Forbidden - no permission
          console.error('Access denied:', error.response.data);
        }

        // Transform error for consistent handling
        const apiError: ApiError = {
          code: error.response?.data?.code || 'UNKNOWN_ERROR',
          message: error.response?.data?.message || error.message || 'An error occurred',
          details: error.response?.data?.details,
        };

        return Promise.reject(apiError);
      }
    );
  }

  // Generic request methods
  async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.client.get<T>(url, { params });
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
  login: (username: string, password: string) =>
    api.post<{ user: import('@/types').User; token: string }>('/auth/login', { username, password }),

  logout: () => api.post('/auth/logout'),

  me: () => api.get<import('@/types').User>('/auth/me'),

  refreshToken: () => api.post<{ token: string }>('/auth/refresh'),

  resetPassword: (email: string) =>
    api.post('/auth/reset-password', { email }),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),

  // Public signup - creates new tenant + user
  signup: (data: { email: string; password: string; businessName: string; phone?: string }) =>
    api.post<{
      success: boolean;
      token: string;
      tenantId: string;
      user: import('@/types').User;
      tenant: {
        id: string;
        name: string;
        slug: string;
        status: string;
        plan: string;
        trialEndsAt: string;
      };
      message: string;
    }>('/auth/public/signup', data),
};

// ============ DASHBOARD ENDPOINTS ============
export const dashboardApi = {
  getStats: () => api.get<import('@/types').DashboardStats>('/admin/dashboard/stats'),

  getRecentActivity: (limit = 10) =>
    api.get<import('@/types').AuditLog[]>('/admin/dashboard/activity', { limit }),
};

// ============ TENANT ENDPOINTS ============
export const tenantsApi = {
  list: (filters?: import('@/types').TenantFilters) =>
    api.get<import('@/types').PaginatedResponse<import('@/types').Tenant>>('/admin/tenants', filters),

  get: (id: string) => api.get<import('@/types').Tenant>(`/admin/tenants/${id}`),

  create: (data: Partial<import('@/types').Tenant>) =>
    api.post<import('@/types').Tenant>('/admin/tenants', data),

  update: (id: string, data: Partial<import('@/types').Tenant>) =>
    api.put<import('@/types').Tenant>(`/admin/tenants/${id}`, data),

  delete: (id: string) => api.delete(`/admin/tenants/${id}`),

  getStats: (id: string) => api.get<import('@/types').TenantStats>(`/admin/tenants/${id}/stats`),

  suspend: (id: string, reason: string) =>
    api.post(`/admin/tenants/${id}/suspend`, { reason }),

  activate: (id: string) => api.post(`/admin/tenants/${id}/activate`),
};

// ============ USER ENDPOINTS ============
export const usersApi = {
  list: (filters?: import('@/types').UserFilters) =>
    api.get<import('@/types').PaginatedResponse<import('@/types').User>>('/admin/users', filters),

  get: (id: string) => api.get<import('@/types').User>(`/admin/users/${id}`),

  create: (data: Partial<import('@/types').User> & { password?: string }) =>
    api.post<import('@/types').User>('/admin/users', data),

  update: (id: string, data: Partial<import('@/types').User>) =>
    api.put<import('@/types').User>(`/admin/users/${id}`, data),

  delete: (id: string) => api.delete(`/admin/users/${id}`),

  resetPassword: (id: string) => api.post(`/admin/users/${id}/reset-password`),

  block: (id: string, reason: string) =>
    api.post(`/admin/users/${id}/block`, { reason }),

  unblock: (id: string) => api.post(`/admin/users/${id}/unblock`),

  getSessions: (id: string) =>
    api.get<import('@/types').Session[]>(`/admin/users/${id}/sessions`),

  terminateSession: (userId: string, sessionId: string) =>
    api.delete(`/admin/users/${userId}/sessions/${sessionId}`),

  invite: (data: { email: string; role: string; tenantId?: string }) =>
    api.post('/admin/users/invite', data),
};

// ============ LOCATION ENDPOINTS ============
export const locationsApi = {
  list: (tenantId?: string) =>
    api.get<import('@/types').PaginatedResponse<import('@/types').Location>>('/admin/locations', { tenantId }),

  get: (id: string) => api.get<import('@/types').Location>(`/admin/locations/${id}`),

  create: (data: Partial<import('@/types').Location>) =>
    api.post<import('@/types').Location>('/admin/locations', data),

  update: (id: string, data: Partial<import('@/types').Location>) =>
    api.put<import('@/types').Location>(`/admin/locations/${id}`, data),

  delete: (id: string) => api.delete(`/admin/locations/${id}`),
};

// ============ PAYMENT ENDPOINTS ============
export const paymentsApi = {
  list: (filters?: import('@/types').PaymentFilters) =>
    api.get<import('@/types').PaginatedResponse<import('@/types').Payment>>('/admin/payments', filters),

  get: (id: string) => api.get<import('@/types').Payment>(`/admin/payments/${id}`),

  refund: (id: string, reason: string) =>
    api.post(`/admin/payments/${id}/refund`, { reason }),

  export: (filters?: import('@/types').PaymentFilters) =>
    api.get<{ url: string }>('/admin/payments/export', filters),
};

// ============ SUBSCRIPTION ENDPOINTS ============
export const subscriptionsApi = {
  list: (tenantId?: string) =>
    api.get<import('@/types').PaginatedResponse<import('@/types').Subscription>>('/admin/subscriptions', { tenantId }),

  get: (id: string) => api.get<import('@/types').Subscription>(`/admin/subscriptions/${id}`),

  cancel: (id: string, reason: string) =>
    api.post(`/admin/subscriptions/${id}/cancel`, { reason }),
};

// ============ MERCADOPAGO ENDPOINTS ============
export const mercadoPagoApi = {
  getConfig: (tenantId: string) =>
    api.get<import('@/types').MercadoPagoConfig>(`/admin/mercadopago/${tenantId}/config`),

  updateConfig: (tenantId: string, data: Partial<import('@/types').MercadoPagoConfig>) =>
    api.put(`/admin/mercadopago/${tenantId}/config`, data),

  testConnection: (tenantId: string) =>
    api.post<{ success: boolean; message: string }>(`/admin/mercadopago/${tenantId}/test`),

  getTransactions: (tenantId: string, filters?: import('@/types').PaymentFilters) =>
    api.get<import('@/types').PaginatedResponse<import('@/types').Payment>>(`/admin/mercadopago/${tenantId}/transactions`, filters),
};

// ============ OPERATIONS ENDPOINTS ============
export const operationsApi = {
  listOrders: (filters?: import('@/types').OperationFilters) =>
    api.get<import('@/types').PaginatedResponse<import('@/types').Order>>('/admin/operations/orders', filters),

  getOrder: (id: string) => api.get<import('@/types').Order>(`/admin/operations/orders/${id}`),

  exportOrders: (filters?: import('@/types').OperationFilters) =>
    api.get<{ url: string }>('/admin/operations/orders/export', filters),
};

// ============ AUDIT ENDPOINTS ============
export const auditApi = {
  list: (filters?: import('@/types').AuditFilters) =>
    api.get<import('@/types').PaginatedResponse<import('@/types').AuditLog>>('/admin/audit', filters),

  export: (filters?: import('@/types').AuditFilters) =>
    api.get<{ url: string }>('/admin/audit/export', filters),
};

// ============ CONFIG ENDPOINTS ============
export const configApi = {
  getTenantSettings: (tenantId: string) =>
    api.get<import('@/types').TenantSettings>(`/admin/config/${tenantId}`),

  updateTenantSettings: (tenantId: string, data: Partial<import('@/types').TenantSettings>) =>
    api.put(`/admin/config/${tenantId}`, data),

  getSystemHealth: () =>
    api.get<{ status: string; services: Record<string, { status: string; latency: number }> }>('/admin/config/health'),
};
