import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ColumnDef } from '@tanstack/react-table';
import {
  Building2,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Ban,
  CheckCircle,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { StatusBadge } from '@/components/modules/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { tenantsApi } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { formatDate, getPlanBadgeColor, downloadCSV } from '@/lib/utils';
import type { Tenant, TenantStatus, TenantPlan } from '@/types';

const tenantSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  slug: z.string().min(2, 'El slug debe tener al menos 2 caracteres').regex(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones'),
  phone: z.string().optional(),
  plan: z.enum(['free', 'starter', 'professional', 'enterprise']),
  status: z.enum(['active', 'inactive', 'suspended', 'trial']),
  maxUsers: z.number().min(1).max(1000),
  maxLocations: z.number().min(1).max(100),
});

type TenantFormData = z.infer<typeof tenantSchema>;

// Mock data
const mockTenants: Tenant[] = [
  {
    id: '1',
    name: 'Taller Mecánico Central',
    slug: 'taller-central',
    email: 'admin@tallercentral.com',
    phone: '+54 11 1234-5678',
    status: 'active',
    plan: 'professional',
    maxUsers: 10,
    maxLocations: 3,
    mercadoPagoEnabled: true,
    settings: {
      branding: {},
      notifications: { emailEnabled: true, smsEnabled: false, whatsappEnabled: true },
      features: { inventoryEnabled: true, reportsEnabled: true, multiLocationEnabled: true },
    },
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-20T15:30:00Z',
  },
  {
    id: '2',
    name: 'AutoService Express',
    slug: 'autoservice-express',
    email: 'info@autoservice.com',
    status: 'trial',
    plan: 'starter',
    trialEndsAt: '2024-02-15T00:00:00Z',
    maxUsers: 5,
    maxLocations: 1,
    mercadoPagoEnabled: false,
    settings: {
      branding: {},
      notifications: { emailEnabled: true, smsEnabled: false, whatsappEnabled: false },
      features: { inventoryEnabled: false, reportsEnabled: true, multiLocationEnabled: false },
    },
    createdAt: '2024-01-20T08:00:00Z',
    updatedAt: '2024-01-20T08:00:00Z',
  },
  {
    id: '3',
    name: 'Garage Premium',
    slug: 'garage-premium',
    email: 'contacto@garagepremium.com',
    phone: '+54 11 9876-5432',
    status: 'suspended',
    plan: 'enterprise',
    maxUsers: 50,
    maxLocations: 10,
    mercadoPagoEnabled: true,
    settings: {
      branding: {},
      notifications: { emailEnabled: true, smsEnabled: true, whatsappEnabled: true },
      features: { inventoryEnabled: true, reportsEnabled: true, multiLocationEnabled: true },
    },
    createdAt: '2023-11-01T12:00:00Z',
    updatedAt: '2024-01-10T09:00:00Z',
  },
];

export function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
    totalPages: 1,
    totalItems: 0,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TenantFormData>({
    resolver: zodResolver(tenantSchema),
    defaultValues: {
      plan: 'starter',
      status: 'active',
      maxUsers: 5,
      maxLocations: 1,
    },
  });

  const fetchTenants = async () => {
    setIsLoading(true);
    try {
      const response = await tenantsApi.list({
        page: pagination.pageIndex + 1,
        pageSize: pagination.pageSize,
      });
      setTenants(response.data);
      setPagination((prev) => ({
        ...prev,
        totalPages: response.pagination.totalPages,
        totalItems: response.pagination.totalItems,
      }));
    } catch (error) {
      console.error('Error fetching tenants:', error);
      // Use mock data
      setTenants(mockTenants);
      setPagination((prev) => ({
        ...prev,
        totalPages: 1,
        totalItems: mockTenants.length,
      }));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, [pagination.pageIndex, pagination.pageSize]);

  const openCreateDialog = () => {
    setEditingTenant(null);
    reset({
      name: '',
      email: '',
      slug: '',
      phone: '',
      plan: 'starter',
      status: 'active',
      maxUsers: 5,
      maxLocations: 1,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (tenant: Tenant) => {
    setEditingTenant(tenant);
    reset({
      name: tenant.name,
      email: tenant.email,
      slug: tenant.slug,
      phone: tenant.phone || '',
      plan: tenant.plan,
      status: tenant.status,
      maxUsers: tenant.maxUsers,
      maxLocations: tenant.maxLocations,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: TenantFormData) => {
    try {
      if (editingTenant) {
        await tenantsApi.update(editingTenant.id, data);
        toast({ title: 'Tenant actualizado', variant: 'default' });
      } else {
        await tenantsApi.create(data);
        toast({ title: 'Tenant creado', variant: 'default' });
      }
      setIsDialogOpen(false);
      fetchTenants();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar el tenant',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este tenant?')) return;
    try {
      await tenantsApi.delete(id);
      toast({ title: 'Tenant eliminado', variant: 'default' });
      fetchTenants();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el tenant',
        variant: 'destructive',
      });
    }
  };

  const handleSuspend = async (id: string) => {
    try {
      await tenantsApi.suspend(id, 'Suspended by admin');
      toast({ title: 'Tenant suspendido', variant: 'default' });
      fetchTenants();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo suspender el tenant',
        variant: 'destructive',
      });
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await tenantsApi.activate(id);
      toast({ title: 'Tenant activado', variant: 'default' });
      fetchTenants();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo activar el tenant',
        variant: 'destructive',
      });
    }
  };

  const handleExport = () => {
    downloadCSV(
      tenants.map((t) => ({
        ID: t.id,
        Nombre: t.name,
        Email: t.email,
        Plan: t.plan,
        Estado: t.status,
        'Usuarios Max': t.maxUsers,
        'Ubicaciones Max': t.maxLocations,
        'Creado': t.createdAt,
      })),
      'tenants'
    );
  };

  const columns: ColumnDef<Tenant>[] = [
    {
      accessorKey: 'name',
      header: 'Tenant',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-gray-900">{row.original.name}</p>
          <p className="text-sm text-gray-500">{row.original.slug}</p>
        </div>
      ),
    },
    {
      accessorKey: 'email',
      header: 'Email',
    },
    {
      accessorKey: 'plan',
      header: 'Plan',
      cell: ({ row }) => (
        <Badge className={getPlanBadgeColor(row.original.plan)}>
          {row.original.plan.toUpperCase()}
        </Badge>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Estado',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'maxUsers',
      header: 'Usuarios',
      cell: ({ row }) => <span>{row.original.maxUsers} max</span>,
    },
    {
      accessorKey: 'mercadoPagoEnabled',
      header: 'MercadoPago',
      cell: ({ row }) =>
        row.original.mercadoPagoEnabled ? (
          <Badge variant="success">Activo</Badge>
        ) : (
          <Badge variant="secondary">Inactivo</Badge>
        ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Creado',
      cell: ({ row }) => formatDate(row.original.createdAt, { dateStyle: 'medium' }),
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
            <DropdownMenuItem onClick={() => openEditDialog(row.original)}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Eye className="h-4 w-4 mr-2" />
              Ver detalles
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {row.original.status === 'suspended' ? (
              <DropdownMenuItem onClick={() => handleActivate(row.original.id)}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Activar
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => handleSuspend(row.original.id)}
                className="text-yellow-600"
              >
                <Ban className="h-4 w-4 mr-2" />
                Suspender
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => handleDelete(row.original.id)}
              className="text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
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
            <Building2 className="h-7 w-7 text-fixly-purple-600" />
            Tenants
          </h1>
          <p className="text-gray-500 mt-1">Gestiona los tenants de la plataforma</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Tenant
        </Button>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={tenants}
        searchPlaceholder="Buscar tenants..."
        searchColumn="name"
        onExport={handleExport}
        isLoading={isLoading}
        pagination={{
          pageIndex: pagination.pageIndex,
          pageSize: pagination.pageSize,
          totalPages: pagination.totalPages,
          totalItems: pagination.totalItems,
          onPageChange: (page) => setPagination((p) => ({ ...p, pageIndex: page })),
          onPageSizeChange: (size) => setPagination((p) => ({ ...p, pageSize: size, pageIndex: 0 })),
        }}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTenant ? 'Editar Tenant' : 'Nuevo Tenant'}
            </DialogTitle>
            <DialogDescription>
              {editingTenant
                ? 'Modifica los datos del tenant'
                : 'Completa los datos para crear un nuevo tenant'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input id="name" {...register('name')} />
                {errors.name && (
                  <p className="text-xs text-red-500">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input id="slug" {...register('slug')} placeholder="mi-taller" />
                {errors.slug && (
                  <p className="text-xs text-red-500">{errors.slug.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register('email')} />
                {errors.email && (
                  <p className="text-xs text-red-500">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input id="phone" {...register('phone')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select
                  value={watch('plan')}
                  onValueChange={(v) => setValue('plan', v as TenantPlan)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  value={watch('status')}
                  onValueChange={(v) => setValue('status', v as TenantStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="inactive">Inactivo</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="suspended">Suspendido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxUsers">Máx. Usuarios</Label>
                <Input
                  id="maxUsers"
                  type="number"
                  {...register('maxUsers', { valueAsNumber: true })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxLocations">Máx. Ubicaciones</Label>
                <Input
                  id="maxLocations"
                  type="number"
                  {...register('maxLocations', { valueAsNumber: true })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : editingTenant ? 'Guardar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
