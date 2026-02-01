import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, XCircle, AlertCircle, Pause, Ban } from 'lucide-react';

type StatusType =
  | 'active' | 'inactive' | 'pending' | 'approved' | 'rejected'
  | 'completed' | 'cancelled' | 'suspended' | 'trial' | 'error'
  | 'configured' | 'in_progress' | 'refunded' | 'past_due'| 'delivered' |  'paused';

interface StatusBadgeProps {
  status: StatusType;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

const statusConfig: Record<StatusType, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' | 'default'; icon: typeof CheckCircle }> = {
  active: { label: 'Activo', variant: 'success', icon: CheckCircle },
  approved: { label: 'Aprobado', variant: 'success', icon: CheckCircle },
  completed: { label: 'Completado', variant: 'success', icon: CheckCircle },
  configured: { label: 'Configurado', variant: 'success', icon: CheckCircle },
  inactive: { label: 'Inactivo', variant: 'secondary', icon: Pause },
  pending: { label: 'Pendiente', variant: 'warning', icon: Clock },
  in_progress: { label: 'En Progreso', variant: 'warning', icon: Clock },
  trial: { label: 'Trial', variant: 'warning', icon: Clock },
  past_due: { label: 'Vencido', variant: 'warning', icon: AlertCircle },
  rejected: { label: 'Rechazado', variant: 'destructive', icon: XCircle },
  delivered: { label: 'Entregado', variant: 'success', icon: CheckCircle },
  cancelled: { label: 'Cancelado', variant: 'destructive', icon: Ban },
  suspended: { label: 'Suspendido', variant: 'destructive', icon: Ban },
  error: { label: 'Error', variant: 'destructive', icon: XCircle },
  refunded: { label: 'Reembolsado', variant: 'secondary', icon: AlertCircle },
  paused: { label: 'Pausado', variant: 'secondary', icon: Pause },
};

export function StatusBadge({ status, showIcon = true, size = 'md' }: StatusBadgeProps)
{
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={size === 'sm' ? 'text-xs px-2 py-0.5' : ''}
    >
      {showIcon && <Icon className={`${size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} mr-1`} />}
      {config.label}
    </Badge>
  );
}
