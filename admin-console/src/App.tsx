import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from '@/components/layout';
import { Toaster } from '@/components/ui/toaster';
import {
  LoginPage,
  SignupPage,
  DashboardPage,
  TenantsPage,
  UsersPage,
  PaymentsPage,
  OperationsPage,
  AuditPage,
  ConfigPage,
} from '@/pages';
import { useAuthStore } from '@/store/auth';
import { useEffect } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

// Route guard for super admin only routes
function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isSuperAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// Route guard for authenticated routes
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  const { setLoading, isAuthenticated } = useAuthStore();

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      // The auth state is persisted in localStorage via zustand
      // Just mark loading as complete
      setLoading(false);
    };

    checkAuth();
  }, [setLoading]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route
            path="/login"
            element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />
            }
          />
          <Route
            path="/signup"
            element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <SignupPage />
            }
          />

          {/* Protected routes */}
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />

            <Route
              path="dashboard"
              element={
                <PrivateRoute>
                  <DashboardPage />
                </PrivateRoute>
              }
            />

            <Route
              path="tenants"
              element={
                <SuperAdminRoute>
                  <TenantsPage />
                </SuperAdminRoute>
              }
            />

            <Route
              path="users"
              element={
                <PrivateRoute>
                  <UsersPage />
                </PrivateRoute>
              }
            />

            <Route
              path="payments"
              element={
                <PrivateRoute>
                  <PaymentsPage />
                </PrivateRoute>
              }
            />

            <Route
              path="operations"
              element={
                <PrivateRoute>
                  <OperationsPage />
                </PrivateRoute>
              }
            />

            <Route
              path="audit"
              element={
                <PrivateRoute>
                  <AuditPage />
                </PrivateRoute>
              }
            />

            <Route
              path="config"
              element={
                <PrivateRoute>
                  <ConfigPage />
                </PrivateRoute>
              }
            />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
