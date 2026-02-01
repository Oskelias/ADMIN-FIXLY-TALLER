import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type KPIVariant = 'blue' | 'green' | 'yellow' | 'red' | 'purple';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  variant?: KPIVariant;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

const variantClasses: Record<KPIVariant, string> = {
  blue: 'kpi-card-blue',
  green: 'kpi-card-green',
  yellow: 'kpi-card-yellow',
  red: 'kpi-card-red',
  purple: 'bg-gradient-to-br from-fixly-purple-600 to-fixly-purple-400',
};

export function KPICard({
  title,
  value,
  icon,
  variant = 'blue',
  subtitle,
  trend,
}: KPICardProps) {
  return (
    <div className={cn('kpi-card', variantClasses[variant])}>
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-white/80">{title}</p>
          <p className="text-3xl font-bold">{value}</p>
          {subtitle && <p className="text-xs text-white/70">{subtitle}</p>}
          {trend && (
            <div className="flex items-center gap-1 text-xs mt-1">
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded text-xs font-medium',
                  trend.isPositive
                    ? 'bg-white/20 text-white'
                    : 'bg-red-500/30 text-white'
                )}
              >
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
              <span className="text-white/70">vs mes anterior</span>
            </div>
          )}
        </div>
        <div className="p-3 bg-white/20 rounded-lg">{icon}</div>
      </div>
    </div>
  );
}
