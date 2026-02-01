import { useState, useEffect } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import {
  ClipboardList,
  RefreshCw,
  Filter,
  User,
  Shield,
  CreditCard,
  Building2,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable } from '@/components/modules/DataTable';
import { auditApi } from '@/services/api';
import { formatDate, downloadCSV } from '@/lib/utils';
import type { AuditLog, AuditAction } from '@/types';

// Mock data
const mockAuditLogs: AuditLog[] = [
  {
    id: 'a1',
    userId: 'u1',
    userName: 'Admin Principal',
    userEmail: 'admin@fixly.com',
    action: 'user.login',
    resourceType: 'user',
    resourceId: 'u1',
    ipAddress: '192.168.1.100',
    userAgent: 'Chrome/120.0',
    createdAt: new Date(Date.now() - 300000).toISOString(),
  },
  {
    id: 'a2',
    userId: 'u1',
    userName: 'Admin Principal',
    userEmail: 'admin@fixly.com',
    tenantId: 't1',
    action: 'tenant.updated',
    resourceType: 'tenant',
    resourceId: 't1',
    oldValue: { status: 'trial' },
    newValue: { status: 'active' },
    ipAddress: '192.168.1.100',
    createdAt: new Date(Date.now() - 600000).toISOString(),
  },
  {
    id: 'a3',
    userId: 'u2',
    userName: 'Juan Pérez',
    userEmail: 'juan@tallercentral.com',
    tenantId: 't1',
    action: 'payment.created',
    resourceType: 'payment',
    resourceId: 'p123',
    newValue: { amount: 19900, status: 'approved' },
    ipAddress: '192.168.1.50',
    createdAt: new Date(Date.now() - 900000).toISOString(),
  },
  {
    id: 'a4',
    userId: 'u1',
    userName: 'Admin Principal',
    userEmail: 'admin@fixly.com',
    action: 'user.created',
    resourceType: 'user',
    resourceId: 'u4',
    newValue: { email: 'nuevo@email.com', role: 'operator' },
    ipAddress: '192.168.1.100',
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: 'a5',
    userId: 'u1',
    userName: 'Admin Principal',
    userEmail: 'admin@fixly.com',
    action: 'config.updated',
    resourceType: 'config',
    resourceId: 'global',
    oldValue: { mercadoPagoEnabled: false },
    newValue: { mercadoPagoEnabled: true },
    ipAddress: '192.168.1.100',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
];

const actionLabels: Record<string, { label: string; icon: typeof User; color: string }> = {
  'user.login': { label: 'Inicio de sesión', icon: User, color: 'bg-blue-100 text-blue-700' },
  'user.logout': { label: 'Cierre de sesión', icon: User, color: 'bg-gray-100 text-gray-700' },
  'user.created': { label: 'Usuario creado', icon: User, color: 'bg-green-100 text-green-700' },
  'user.updated': { label: 'Usuario actualizado', icon: User, color: 'bg-yellow-100 text-yellow-700' },
  'user.deleted': { label: 'Usuario eliminado', icon: User, color: 'bg-red-100 text-red-700' },
  'tenant.created': { label: 'Tenant creado', icon: Building2, color: 'bg-green-100 text-green-700' },
  'tenant.updated': { label: 'Tenant actualizado', icon: Building2, color: 'bg-yellow-100 text-yellow-700' },
  'tenant.deleted': { label: 'Tenant eliminado', icon: Building2, color: 'bg-red-100 text-red-700' },
  'payment.created': { label: 'Pago registrado', icon: CreditCard, color: 'bg-green-100 text-green-700' },
  'payment.updated': { label: 'Pago actualizado', icon: CreditCard, color: 'bg-yellow-100 text-yellow-700' },
  'payment.refunded': { label: 'Pago reembolsado', icon: CreditCard, color: 'bg-orange-100 text-orange-700' },
  'order.created': { label: 'Orden creada', icon: ClipboardList, color: 'bg-green-100 text-green-700' },
  'order.updated': { label: 'Orden actualizada', icon: ClipboardList, color: 'bg-yellow-100 text-yellow-700' },
  'order.completed': { label: 'Orden completada', icon: ClipboardList, color: 'bg-blue-100 text-blue-700' },
  'settings.updated': { label: 'Configuración actualizada', icon: Settings, color: 'bg-purple-100 text-purple-700' },
  'config.updated': { label: 'Config. actualizada', icon: Settings, color: 'bg-purple-100 text-purple-700' },
};

export function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: 'all',
    userId: '',
    dateFrom: '',
    dateTo: '',
  });
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 20,
    totalPages: 1,
    totalItems: 0,
  });

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const response = await auditApi.list({
        page: pagination.pageIndex + 1,
        pageSize: pagination.pageSize,
        action: filters.action !== 'all' ? (filters.action as AuditAction) : undefined,
        userId: filters.userId || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      });
      setLogs(response.data);
      setPagination(prev => ({
        ...prev,
        totalPages: response.pagination.totalPages,
        totalItems: response.pagination.totalItems,
      }));
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      setLogs(mockAuditLogs);
      setPagination(prev => ({
        ...prev,
        totalPages: 1,
        totalItems: mockAuditLogs.length,
      }));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [pagination.pageIndex, pagination.pageSize, filters]);

  const handleExport = () => {
    downloadCSV(
      logs.map(l => ({
        ID: l.id,
        Usuario: l.userName,
        Email: l.userEmail,
        Acción: actionLabels[l.action]?.label || l.action,
        Recurso: `${l.resourceType}:${l.resourceId}`,
        IP: l.ipAddress || '',
        Fecha: l.createdAt,
      })),
      'auditoria'
    );
  };

  const columns: ColumnDef<AuditLog>[] = [
    {
      accessorKey: 'createdAt',
      header: 'Fecha',
      cell: ({ row }) => (
        <span className="text-sm text-gray-600">
          {formatDate(row.original.createdAt)}
        </span>
      ),
    },
    {
      accessorKey: 'userName',
      header: 'Usuario',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-fixly-purple-100 flex items-center justify-center">
            <span className="text-xs font-medium text-fixly-purple-600">
              {row.original.userName.charAt(0)}
            </span>
          </div>
          <div>
            <p className="font-medium text-sm">{row.original.userName}</p>
            <p className="text-xs text-gray-500">{row.original.userEmail}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'action',
      header: 'Acción',
      cell: ({ row }) => {
        const config = actionLabels[row.original.action] || {
          label: row.original.action,
          icon: Shield,
          color: 'bg-gray-100 text-gray-700',
        };
        const Icon = config.icon;
        return (
          <Badge className={config.color}>
            <Icon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'resourceType',
      header: 'Recurso',
      cell: ({ row }) => (
        <div>
          <p className="font-mono text-sm">{row.original.resourceType}</p>
          <p className="text-xs text-gray-500">{row.original.resourceId}</p>
        </div>
      ),
    },
    {
      accessorKey: 'ipAddress',
      header: 'IP',
      cell: ({ row }) => (
        <span className="font-mono text-sm text-gray-600">
          {row.original.ipAddress || 'N/A'}
        </span>
      ),
    },
    {
      id: 'changes',
      header: 'Cambios',
      cell: ({ row }) => {
        if (!row.original.oldValue && !row.original.newValue) {
          return <span className="text-gray-400">-</span>;
        }
        return (
          <div className="text-xs">
            {row.original.oldValue && (
              <div className="text-red-600">
                - {JSON.stringify(row.original.oldValue).slice(0, 30)}...
              </div>
            )}
            {row.original.newValue && (
              <div className="text-green-600">
                + {JSON.stringify(row.original.newValue).slice(0, 30)}...
              </div>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-fixly-purple-600" />
            Auditoría
          </h1>
          <p className="text-gray-500 mt-1">
            Registro de todas las acciones realizadas en el sistema
          </p>
        </div>
        <Button variant="outline" onClick={fetchLogs}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Filter className="h-5 w-5 text-gray-400" />
            <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4">
              <Select
                value={filters.action}
                onValueChange={(v) => setFilters(f => ({ ...f, action: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Acción" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las acciones</SelectItem>
                  <SelectItem value="user.login">Inicio de sesión</SelectItem>
                  <SelectItem value="user.created">Usuario creado</SelectItem>
                  <SelectItem value="user.updated">Usuario actualizado</SelectItem>
                  <SelectItem value="user.deleted">Usuario eliminado</SelectItem>
                  <SelectItem value="tenant.created">Tenant creado</SelectItem>
                  <SelectItem value="tenant.updated">Tenant actualizado</SelectItem>
                  <SelectItem value="payment.created">Pago registrado</SelectItem>
                  <SelectItem value="payment.refunded">Pago reembolsado</SelectItem>
                  <SelectItem value="config.updated">Config. actualizada</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="ID Usuario"
                value={filters.userId}
                onChange={(e) => setFilters(f => ({ ...f, userId: e.target.value }))}
              />
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
              />
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters(f => ({ ...f, dateTo: e.target.value }))}
              />
              <Button
                variant="outline"
                onClick={() => setFilters({ action: 'all', userId: '', dateFrom: '', dateTo: '' })}
              >
                Limpiar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <DataTable
        columns={columns}
        data={logs}
        searchPlaceholder="Buscar en auditoría..."
        searchColumn="userName"
        onExport={handleExport}
        isLoading={isLoading}
        pagination={{
          pageIndex: pagination.pageIndex,
          pageSize: pagination.pageSize,
          totalPages: pagination.totalPages,
          totalItems: pagination.totalItems,
          onPageChange: (page) => setPagination(p => ({ ...p, pageIndex: page })),
          onPageSizeChange: (size) => setPagination(p => ({ ...p, pageSize: size, pageIndex: 0 })),
        }}
      />
    </div>
  );
}
