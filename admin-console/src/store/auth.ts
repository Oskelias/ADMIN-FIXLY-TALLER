import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, UserRole } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  login: (user: User, token: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;

  // Permission helpers
  isSuperAdmin: () => boolean;
  isAdmin: () => boolean;
  hasPermission: (permission: string) => boolean;
  canAccessTenant: (tenantId: string) => boolean;
}

// Define permissions for each role
const rolePermissions: Record<UserRole, string[]> = {
  superadmin: [
    'tenants:read', 'tenants:write', 'tenants:delete',
    'users:read', 'users:write', 'users:delete', 'users:invite',
    'payments:read', 'payments:refund',
    'operations:read', 'operations:export',
    'audit:read', 'audit:export',
    'config:read', 'config:write',
    'mercadopago:read', 'mercadopago:write',
  ],
  admin: [
    'users:read', 'users:write', 'users:invite',
    'payments:read',
    'operations:read', 'operations:export',
    'audit:read',
    'config:read', 'config:write',
    'mercadopago:read', 'mercadopago:write',
  ],
  operator: [
    'users:read',
    'payments:read',
    'operations:read',
    'audit:read',
  ],
  viewer: [
    'users:read',
    'payments:read',
    'operations:read',
  ],
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,

      setUser: (user: User) => set({ user }),

      setToken: (token: string) => set({ token }),

      login: (user: User, token: string) => set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      }),

      logout: () => set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      }),

      setLoading: (isLoading: boolean) => set({ isLoading }),

      isSuperAdmin: () => get().user?.role === 'superadmin',

      isAdmin: () => {
        const role = get().user?.role;
        return role === 'superadmin' || role === 'admin';
      },

      hasPermission: (permission: string) => {
        const user = get().user;
        if (!user) return false;
        return rolePermissions[user.role]?.includes(permission) ?? false;
      },

      canAccessTenant: (tenantId: string) => {
        const user = get().user;
        if (!user) return false;
        // Superadmin can access all tenants
        if (user.role === 'superadmin') return true;
        // Other users can only access their own tenant
        return user.tenantId === tenantId;
      },
    }),
    {
      name: 'fixly-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
