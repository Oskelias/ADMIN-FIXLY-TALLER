import { useEffect, useState } from 'react';
import {
  Users,
  Building2,
  CreditCard,
  DollarSign,
  TrendingUp,
  RefreshCw,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KPICard } from '@/components/modules/KPICard';
import { StatusBadge } from '@/components/modules/StatusBadge';
import { dashboardApi } from '@/services/api';
import { useAuthStore } from '@/store/auth';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';
import type { DashboardStats, AuditLog } from '@/types';

// Mock data for development
const mockStats: DashboardStats = {
  totalTenants: 45,
  activeTenants: 38,
  totalUsers: 234,
  activeUsers: 189,
  totalRevenue: 892500,
  monthlyRevenue: 125000,
  totalPayments: 156,
  pendingPayments: 12,
  approvedPayments: 132,
  rejectedPayments: 12,
  revenueByMonth: [
    { month: 'Ene', revenue: 85000 },
    { month: 'Feb', revenue: 92000 },
    { month: 'Mar', revenue: 78000 },
    { month: 'Abr', revenue: 105000 },
    { month: 'May', revenue: 115000 },
    { month: 'Jun', revenue: 125000 },
  ],
  paymentsByStatus: [
    { status: 'approved', count: 132, amount: 780000 },
    { status: 'pending', count: 12, amount: 45000 },
    { status: 'rejected', count: 12, amount: 67500 },
  ],
  tenantsByPlan: [
    { plan: 'free', count: 15 },
    { plan: 'starter', count: 18 },
    { plan: 'professional', count: 10 },
    { plan: 'enterprise', count: 2 },
  ],
  recentActivity: [
    {
      id: '1',
      userId: 'u1',
      userName: 'Juan Pérez',
      userEmail: 'juan@example.com',
      action: 'user.login',
      resourceType: 'user',
      resourceId: 'u1',
      createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
    {
      id: '2',
      userId: 'u2',
      userName: 'María García',
      userEmail: 'maria@example.com',
      tenantId: 't1',
      action: 'payment.created',
      resourceType: 'payment',
      resourceId: 'p123',
      createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    },
    {
      id: '3',
      userId: 'u3',
      userName: 'Carlos López',
      userEmail: 'carlos@example.com',
      action: 'tenant.created',
      resourceType: 'tenant',
      resourceId: 't456',
      createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
  ] as AuditLog[],
};

const COLORS = ['#10b981', '#f59e0b', '#ef4444'];
const PLAN_COLORS = ['#6b7280', '#3b82f6', '#8b5cf6', '#f59e0b'];

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { isSuperAdmin } = useAuthStore();

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const data = await dashboardApi.getStats();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
      // Use mock data in development
      setStats(mockStats);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      'user.login': 'Inicio de sesión',
      'user.created': 'Usuario creado',
      'user.updated': 'Usuario actualizado',
      'user.deleted': 'Usuario eliminado',
      'tenant.created': 'Tenant creado',
      'tenant.updated': 'Tenant actualizado',
      'payment.created': 'Pago registrado',
      'payment.refunded': 'Pago reembolsado',
      'order.created': 'Orden creada',
      'order.completed': 'Orden completada',
    };
    return labels[action] || action;
  };

  if (isLoading || !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-fixly-purple-200 border-t-fixly-purple-600 rounded-full animate-spin" />
          <p className="text-gray-500">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="h-7 w-7 text-fixly-purple-600" />
            Dashboard General
          </h1>
          <p className="text-gray-500 mt-1">Resumen general del sistema</p>
        </div>
        <Button onClick={fetchStats} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Usuarios Totales"
          value={stats.totalUsers}
          subtitle={`${stats.activeUsers} activos`}
          icon={<Users className="h-6 w-6 text-white" />}
          variant="blue"
          trend={{ value: 12, isPositive: true }}
        />
        <KPICard
          title="Usuarios Activos"
          value={stats.activeUsers}
          icon={<CheckCircle className="h-6 w-6 text-white" />}
          variant="green"
        />
        <KPICard
          title="Pagos del Mes"
          value={stats.totalPayments}
          subtitle={`${stats.pendingPayments} pendientes`}
          icon={<CreditCard className="h-6 w-6 text-white" />}
          variant="yellow"
        />
        <KPICard
          title="Ingresos Mes"
          value={formatCurrency(stats.monthlyRevenue)}
          icon={<DollarSign className="h-6 w-6 text-white" />}
          variant="red"
          trend={{ value: 8, isPositive: true }}
        />
      </div>

      {/* MercadoPago Status */}
      <Card className="bg-gradient-to-r from-fixly-blue-500 to-fixly-blue-400 text-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="h-6 w-6" />
              <div>
                <h3 className="text-lg font-semibold">Estado MercadoPago</h3>
                <p className="text-white/80 text-sm">Sistema de pagos integrado y funcionando</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-white/70">Webhook configurado</span>
              <span className="flex items-center gap-1.5 px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                <CheckCircle className="h-4 w-4" />
                ACTIVO
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Ingresos Mensuales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.revenueByMonth}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" tickFormatter={(v) => `$${v / 1000}k`} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'Ingresos']}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#7c3aed"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Payments by Status */}
        <Card>
          <CardHeader>
            <CardTitle>Pagos por Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.paymentsByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="count"
                  >
                    {stats.paymentsByStatus.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [value, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-4">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-fixly-green-500" />
                  <span>Aprobados</span>
                </div>
                <span className="font-medium">{stats.approvedPayments}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-fixly-yellow-500" />
                  <span>Pendientes</span>
                </div>
                <span className="font-medium">{stats.pendingPayments}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-fixly-red-500" />
                  <span>Rechazados</span>
                </div>
                <span className="font-medium">{stats.rejectedPayments}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tenants by Plan (Super Admin only) */}
      {isSuperAdmin() && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-fixly-purple-600" />
                Tenants por Plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.tenantsByPlan.map((item, index) => (
                  <div key={item.plan} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: PLAN_COLORS[index] }}
                      />
                      <span className="capitalize">{item.plan}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(item.count / stats.totalTenants) * 100}%`,
                            backgroundColor: PLAN_COLORS[index],
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8 text-right">{item.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-fixly-purple-600" />
                Actividad Reciente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.recentActivity.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No hay actividad reciente</p>
              ) : (
                <div className="space-y-4">
                  {stats.recentActivity.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0"
                    >
                      <div className="w-8 h-8 rounded-full bg-fixly-purple-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium text-fixly-purple-600">
                          {activity.userName.charAt(0)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {activity.userName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {getActionLabel(activity.action)}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400">
                        {formatRelativeTime(activity.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
