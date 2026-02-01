import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  FileBarChart,
  ClipboardList,
  Settings,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  permission?: string;
  superadminOnly?: boolean;
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Tenants',
    path: '/tenants',
    icon: Building2,
    superadminOnly: true,
  },
  {
    label: 'Usuarios',
    path: '/users',
    icon: Users,
    permission: 'users:read',
  },
  {
    label: 'Pagos MP',
    path: '/payments',
    icon: CreditCard,
    permission: 'payments:read',
  },
  {
    label: 'Operaciones',
    path: '/operations',
    icon: FileBarChart,
    permission: 'operations:read',
  },
  {
    label: 'Auditoría',
    path: '/audit',
    icon: ClipboardList,
    permission: 'audit:read',
  },
  {
    label: 'Configuración',
    path: '/config',
    icon: Settings,
    permission: 'config:read',
  },
];

export function Sidebar() {
  const { isSuperAdmin, hasPermission } = useAuthStore();

  const visibleItems = navItems.filter((item) => {
    if (item.superadminOnly && !isSuperAdmin()) return false;
    if (item.permission && !hasPermission(item.permission)) return false;
    return true;
  });

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-white border-r border-gray-100 pt-20">
      <div className="flex flex-col h-full px-4 py-6">
        <nav className="flex-1 space-y-1">
          {visibleItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'sidebar-item',
                  isActive && 'sidebar-item-active'
                )
              }
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer info */}
        <div className="border-t border-gray-100 pt-4 mt-4">
          <div className="flex items-center gap-2 text-xs text-gray-400 px-4">
            <Shield className="h-4 w-4" />
            <span>Admin Console v1.0.0</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
