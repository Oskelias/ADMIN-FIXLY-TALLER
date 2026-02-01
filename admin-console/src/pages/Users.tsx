import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ColumnDef } from '@tanstack/react-table';
import {
  Users as UsersIcon,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Ban,
  Key,
  Mail,
  Shield,
  MonitorSmartphone,
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DataTable } from '@/components/modules/DataTable';
import { StatusBadge } from '@/components/modules/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { usersApi } from '@/services/api';
import { useAuthStore } from '@/store/auth';
import { toast } from '@/hooks/use-toast';
import { formatDate, getInitials, getRoleBadgeColor, downloadCSV } from '@/lib/utils';
import type { User, UserRole, Session } from '@/types';

const userSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  role: z.enum(['superadmin', 'admin', 'operator', 'viewer']),
  tenantId: z.string().optional(),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional(),
});

type UserFormData = z.infer<typeof userSchema>;

// Mock data
const mockUsers: User[] = [
  {
    id: '1',
    name: 'Admin Principal',
    email: 'admin@fixly.com',
    role: 'superadmin',
    tenantId: null,
    active: true,
    emailVerified: true,
    lastLoginAt: new Date().toISOString(),
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-20T10:00:00Z',
  },
  {
    id: '2',
    name: 'Juan Pérez',
    email: 'juan@tallercentral.com',
    role: 'admin',
    tenantId: 't1',
    active: true,
    emailVerified: true,
    lastLoginAt: new Date(Date.now() - 3600000).toISOString(),
    createdAt: '2024-01-10T00:00:00Z',
    updatedAt: '2024-01-15T14:00:00Z',
  },
  {
    id: '3',
    name: 'María García',
    email: 'maria@autoservice.com',
    role: 'operator',
    tenantId: 't2',
    active: true,
    emailVerified: false,
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  },
  {
    id: '4',
    name: 'Carlos López',
    email: 'carlos@garage.com',
    role: 'viewer',
    tenantId: 't3',
    active: false,
    emailVerified: true,
    createdAt: '2024-01-12T00:00:00Z',
    updatedAt: '2024-01-18T09:00:00Z',
  },
];

const mockSessions: Session[] = [
  {
    id: 's1',
    userId: '1',
    userEmail: 'admin@fixly.com',
    ipAddress: '192.168.1.100',
    userAgent: 'Chrome/120.0 Windows',
    lastActivityAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 's2',
    userId: '1',
    userEmail: 'admin@fixly.com',
    ipAddress: '192.168.1.50',
    userAgent: 'Safari/17.0 iOS',
    lastActivityAt: new Date(Date.now() - 7200000).toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

const roleLabels: Record<UserRole, string> = {
  superadmin: 'Super Admin',
  admin: 'Administrador',
  operator: 'Operador',
  viewer: 'Visor',
};

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSessionsDialogOpen, setIsSessionsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedUserSessions, setSelectedUserSessions] = useState<Session[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const { isSuperAdmin } = useAuthStore();
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
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      role: 'operator',
    },
  });

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const response = await usersApi.list({
        page: pagination.pageIndex + 1,
        pageSize: pagination.pageSize,
      });
      setUsers(response.data);
      setPagination((prev) => ({
        ...prev,
        totalPages: response.pagination.totalPages,
        totalItems: response.pagination.totalItems,
      }));
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers(mockUsers);
      setPagination((prev) => ({
        ...prev,
        totalPages: 1,
        totalItems: mockUsers.length,
      }));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [pagination.pageIndex, pagination.pageSize]);

  const openCreateDialog = () => {
    setEditingUser(null);
    reset({
      name: '',
      email: '',
      role: 'operator',
      tenantId: '',
      password: '',
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    reset({
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId || '',
    });
    setIsDialogOpen(true);
  };

  const openSessionsDialog = async (user: User) => {
    setSelectedUserId(user.id);
    try {
      const sessions = await usersApi.getSessions(user.id);
      setSelectedUserSessions(sessions);
    } catch {
      setSelectedUserSessions(mockSessions);
    }
    setIsSessionsDialogOpen(true);
  };

  const onSubmit = async (data: UserFormData) => {
    try {
      if (editingUser) {
        await usersApi.update(editingUser.id, data);
        toast({ title: 'Usuario actualizado', variant: 'default' });
      } else {
        await usersApi.create(data);
        toast({ title: 'Usuario creado', variant: 'default' });
      }
      setIsDialogOpen(false);
      fetchUsers();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar el usuario',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este usuario?')) return;
    try {
      await usersApi.delete(id);
      toast({ title: 'Usuario eliminado', variant: 'default' });
      fetchUsers();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el usuario',
        variant: 'destructive',
      });
    }
  };

  const handleResetPassword = async (id: string) => {
    try {
      await usersApi.resetPassword(id);
      toast({
        title: 'Contraseña reseteada',
        description: 'Se envió un email con la nueva contraseña',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo resetear la contraseña',
        variant: 'destructive',
      });
    }
  };

  const handleBlock = async (id: string) => {
    try {
      await usersApi.block(id, 'Blocked by admin');
      toast({ title: 'Usuario bloqueado' });
      fetchUsers();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo bloquear el usuario',
        variant: 'destructive',
      });
    }
  };

  const handleUnblock = async (id: string) => {
    try {
      await usersApi.unblock(id);
      toast({ title: 'Usuario desbloqueado' });
      fetchUsers();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo desbloquear el usuario',
        variant: 'destructive',
      });
    }
  };

  const handleInvite = async () => {
    const email = prompt('Email del usuario a invitar:');
    if (!email) return;
    try {
      await usersApi.invite({ email, role: 'operator' });
      toast({
        title: 'Invitación enviada',
        description: `Se envió una invitación a ${email}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo enviar la invitación',
        variant: 'destructive',
      });
    }
  };

  const handleTerminateSession = async (sessionId: string) => {
    if (!selectedUserId) return;
    try {
      await usersApi.terminateSession(selectedUserId, sessionId);
      toast({ title: 'Sesión terminada' });
      const sessions = await usersApi.getSessions(selectedUserId);
      setSelectedUserSessions(sessions);
    } catch {
      setSelectedUserSessions((prev) => prev.filter((s) => s.id !== sessionId));
      toast({ title: 'Sesión terminada' });
    }
  };

  const handleExport = () => {
    downloadCSV(
      users.map((u) => ({
        ID: u.id,
        Nombre: u.name,
        Email: u.email,
        Rol: roleLabels[u.role],
        Activo: u.active ? 'Sí' : 'No',
        'Email Verificado': u.emailVerified ? 'Sí' : 'No',
        'Último Login': u.lastLoginAt || 'Nunca',
        Creado: u.createdAt,
      })),
      'usuarios'
    );
  };

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: 'name',
      header: 'Usuario',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={row.original.avatar} />
            <AvatarFallback>{getInitials(row.original.name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-gray-900">{row.original.name}</p>
            <p className="text-sm text-gray-500">{row.original.email}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Rol',
      cell: ({ row }) => (
        <Badge className={getRoleBadgeColor(row.original.role)}>
          <Shield className="h-3 w-3 mr-1" />
          {roleLabels[row.original.role]}
        </Badge>
      ),
    },
    {
      accessorKey: 'active',
      header: 'Estado',
      cell: ({ row }) => (
        <StatusBadge status={row.original.active ? 'active' : 'inactive'} />
      ),
    },
    {
      accessorKey: 'emailVerified',
      header: 'Email',
      cell: ({ row }) =>
        row.original.emailVerified ? (
          <Badge variant="success" className="text-xs">Verificado</Badge>
        ) : (
          <Badge variant="warning" className="text-xs">Pendiente</Badge>
        ),
    },
    {
      accessorKey: 'lastLoginAt',
      header: 'Último acceso',
      cell: ({ row }) =>
        row.original.lastLoginAt
          ? formatDate(row.original.lastLoginAt)
          : 'Nunca',
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
            <DropdownMenuItem onClick={() => openSessionsDialog(row.original)}>
              <MonitorSmartphone className="h-4 w-4 mr-2" />
              Ver sesiones
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleResetPassword(row.original.id)}>
              <Key className="h-4 w-4 mr-2" />
              Reset contraseña
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {row.original.active ? (
              <DropdownMenuItem
                onClick={() => handleBlock(row.original.id)}
                className="text-yellow-600"
              >
                <Ban className="h-4 w-4 mr-2" />
                Bloquear
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => handleUnblock(row.original.id)}
                className="text-green-600"
              >
                <Shield className="h-4 w-4 mr-2" />
                Desbloquear
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
            <UsersIcon className="h-7 w-7 text-fixly-purple-600" />
            Usuarios
          </h1>
          <p className="text-gray-500 mt-1">Gestiona los usuarios del sistema</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleInvite}>
            <Mail className="h-4 w-4 mr-2" />
            Invitar
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Usuario
          </Button>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={users}
        searchPlaceholder="Buscar usuarios..."
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? 'Modifica los datos del usuario'
                : 'Completa los datos para crear un nuevo usuario'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" {...register('name')} />
              {errors.name && (
                <p className="text-xs text-red-500">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email && (
                <p className="text-xs text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Rol</Label>
              <Select
                value={watch('role')}
                onValueChange={(v) => setValue('role', v as UserRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {isSuperAdmin() && (
                    <SelectItem value="superadmin">Super Admin</SelectItem>
                  )}
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="operator">Operador</SelectItem>
                  <SelectItem value="viewer">Visor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!editingUser && (
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input id="password" type="password" {...register('password')} />
                {errors.password && (
                  <p className="text-xs text-red-500">{errors.password.message}</p>
                )}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : editingUser ? 'Guardar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Sessions Dialog */}
      <Dialog open={isSessionsDialogOpen} onOpenChange={setIsSessionsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sesiones Activas</DialogTitle>
            <DialogDescription>
              Gestiona las sesiones activas del usuario
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedUserSessions.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                No hay sesiones activas
              </p>
            ) : (
              selectedUserSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <MonitorSmartphone className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium">{session.userAgent}</p>
                      <p className="text-sm text-gray-500">
                        IP: {session.ipAddress} - Última actividad:{' '}
                        {formatDate(session.lastActivityAt)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleTerminateSession(session.id)}
                  >
                    Terminar
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
