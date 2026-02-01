import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export function Layout() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-fixly-purple-200 border-t-fixly-purple-600 rounded-full animate-spin" />
          <p className="text-gray-500">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <Sidebar />
      <main className="pl-64 pt-16">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
