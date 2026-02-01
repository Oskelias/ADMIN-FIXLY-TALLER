import { useState, useEffect } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import {
  FileBarChart,
  RefreshCw,
  Filter,
  MoreHorizontal,
  Eye,
  Package,
  Clock,
  CheckCircle,
  Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable } from '@/components/modules/DataTable';
import { KPICard } from '@/components/modules/KPICard';
import { StatusBadge } from '@/components/modules/StatusBadge';
import { operationsApi } from '@/services/api';
import { formatCurrency, formatDate, downloadCSV } from '@/lib/utils';
import type { Order, OrderStatus } from '@/types';

// Mock data
const mockOrders: Order[] = [
  {
    id: 'ORD-001',
    tenantId: 't1',
    locationId: 'l1',
    customerName: 'Juan Pérez',
    customerPhone: '+54 11 1234-5678',
    customerEmail: 'juan@email.com',
    vehicleInfo: 'Ford Focus 2020 - ABC123',
    description: 'Service completo + cambio de aceite',
    status: 'completed',
    totalAmount: 45000,
    paidAmount: 45000,
    items: [
      { id: '1', description: 'Cambio de aceite', quantity: 1, unitPrice: 15000, totalPrice: 15000 },
      { id: '2', description: 'Filtro de aceite', quantity: 1, unitPrice: 5000, totalPrice: 5000 },
      { id: '3', description: 'Service completo', quantity: 1, unitPrice: 25000, totalPrice: 25000 },
    ],
    completedAt: '2024-01-20T16:00:00Z',
    createdAt: '2024-01-20T10:00:00Z',
    updatedAt: '2024-01-20T16:00:00Z',
  },
  {
    id: 'ORD-002',
    tenantId: 't1',
    locationId: 'l1',
    customerName: 'María García',
    customerPhone: '+54 11 9876-5432',
    vehicleInfo: 'Toyota Corolla 2019 - XYZ789',
    description: 'Cambio de pastillas de freno',
    status: 'in_progress',
    totalAmount: 35000,
    paidAmount: 17500,
    items: [
      { id: '1', description: 'Pastillas de freno delanteras', quantity: 1, unitPrice: 20000, totalPrice: 20000 },
      { id: '2', description: 'Mano de obra', quantity: 1, unitPrice: 15000, totalPrice: 15000 },
    ],
    estimatedCompletionAt: '2024-01-21T12:00:00Z',
    createdAt: '2024-01-20T14:00:00Z',
    updatedAt: '2024-01-20T14:00:00Z',
  },
  {
    id: 'ORD-003',
    tenantId: 't2',
    locationId: 'l2',
    customerName: 'Carlos López',
    vehicleInfo: 'Chevrolet Cruze 2021 - DEF456',
    description: 'Diagnóstico electrónico',
    status: 'pending',
    totalAmount: 8000,
    paidAmount: 0,
    items: [
      { id: '1', description: 'Diagnóstico computarizado', quantity: 1, unitPrice: 8000, totalPrice: 8000 },
    ],
    createdAt: '2024-01-20T15:30:00Z',
    updatedAt: '2024-01-20T15:30:00Z',
  },
  {
    id: 'ORD-004',
    tenantId: 't1',
    locationId: 'l1',
    customerName: 'Ana Rodríguez',
    vehicleInfo: 'VW Golf 2018 - GHI321',
    description: 'Alineación y balanceo',
    status: 'delivered',
    totalAmount: 12000,
    paidAmount: 12000,
    items: [
      { id: '1', description: 'Alineación', quantity: 1, unitPrice: 6000, totalPrice: 6000 },
      { id: '2', description: 'Balanceo x4', quantity: 4, unitPrice: 1500, totalPrice: 6000 },
    ],
    completedAt: '2024-01-19T18:00:00Z',
    createdAt: '2024-01-19T14:00:00Z',
    updatedAt: '2024-01-19T18:00:00Z',
  },
];

const statusLabels: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En Progreso',
  completed: 'Completado',
  cancelled: 'Cancelado',
  delivered: 'Entregado',
};

export function OperationsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: 'all' as 'all' | OrderStatus,
    tenantId: '',
    dateFrom: '',
    dateTo: '',
  });
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
    totalPages: 1,
    totalItems: 0,
  });

  // Stats
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const inProgressOrders = orders.filter(o => o.status === 'in_progress').length;
  const completedOrders = orders.filter(o => ['completed', 'delivered'].includes(o.status)).length;

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const response = await operationsApi.listOrders({
        page: pagination.pageIndex + 1,
        pageSize: pagination.pageSize,
        status: filters.status !== 'all' ? filters.status : undefined,
        tenantId: filters.tenantId || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      });
      setOrders(response.data);
      setPagination(prev => ({
        ...prev,
        totalPages: response.pagination.totalPages,
        totalItems: response.pagination.totalItems,
      }));
    } catch (error) {
      console.error('Error fetching orders:', error);
      setOrders(mockOrders);
      setPagination(prev => ({
        ...prev,
        totalPages: 1,
        totalItems: mockOrders.length,
      }));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [pagination.pageIndex, pagination.pageSize, filters]);

  const handleExport = () => {
    downloadCSV(
      orders.map(o => ({
        ID: o.id,
        Cliente: o.customerName,
        Teléfono: o.customerPhone || '',
        Vehículo: o.vehicleInfo || '',
        Descripción: o.description,
        Estado: statusLabels[o.status],
        Total: o.totalAmount,
        Pagado: o.paidAmount,
        Fecha: o.createdAt,
      })),
      'operaciones'
    );
  };

  const columns: ColumnDef<Order>[] = [
    {
      accessorKey: 'id',
      header: 'Orden',
      cell: ({ row }) => (
        <div>
          <p className="font-mono font-medium">{row.original.id}</p>
          <p className="text-xs text-gray-500">
            {formatDate(row.original.createdAt, { dateStyle: 'short' })}
          </p>
        </div>
      ),
    },
    {
      accessorKey: 'customerName',
      header: 'Cliente',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.customerName}</p>
          <p className="text-sm text-gray-500">{row.original.vehicleInfo}</p>
        </div>
      ),
    },
    {
      accessorKey: 'description',
      header: 'Descripción',
      cell: ({ row }) => (
        <p className="max-w-xs truncate">{row.original.description}</p>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Estado',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'totalAmount',
      header: 'Total',
      cell: ({ row }) => (
        <div>
          <p className="font-semibold">{formatCurrency(row.original.totalAmount)}</p>
          {row.original.paidAmount < row.original.totalAmount && (
            <p className="text-xs text-yellow-600">
              Pendiente: {formatCurrency(row.original.totalAmount - row.original.paidAmount)}
            </p>
          )}
        </div>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Eye className="h-4 w-4 mr-2" />
              Ver detalles
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileBarChart className="h-7 w-7 text-fixly-purple-600" />
            Operaciones
          </h1>
          <p className="text-gray-500 mt-1">Visualiza las órdenes de trabajo de todos los tenants</p>
        </div>
        <Button variant="outline" onClick={fetchOrders}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          title="Total Órdenes"
          value={totalOrders}
          icon={<Package className="h-6 w-6 text-white" />}
          variant="blue"
        />
        <KPICard
          title="Pendientes"
          value={pendingOrders}
          icon={<Clock className="h-6 w-6 text-white" />}
          variant="yellow"
        />
        <KPICard
          title="En Progreso"
          value={inProgressOrders}
          icon={<FileBarChart className="h-6 w-6 text-white" />}
          variant="purple"
        />
        <KPICard
          title="Completados"
          value={completedOrders}
          icon={<Truck className="h-6 w-6 text-white" />}
          variant="green"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Filter className="h-5 w-5 text-gray-400" />
            <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4">
              <Select
                value={filters.status}
                onValueChange={(v) => setFilters(f => ({ ...f, status: v as typeof filters.status }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="in_progress">En Progreso</SelectItem>
                  <SelectItem value="completed">Completado</SelectItem>
                  <SelectItem value="delivered">Entregado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Tenant ID"
                value={filters.tenantId}
                onChange={(e) => setFilters(f => ({ ...f, tenantId: e.target.value }))}
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
                onClick={() => setFilters({ status: 'all', tenantId: '', dateFrom: '', dateTo: '' })}
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
        data={orders}
        searchPlaceholder="Buscar órdenes..."
        searchColumn="customerName"
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
