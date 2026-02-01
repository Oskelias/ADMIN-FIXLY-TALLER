import { AlertTriangle, Mail, Phone, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface TenantSuspendedProps {
  tenantName?: string;
  supportEmail?: string;
  supportPhone?: string;
  onLogout?: () => void;
}

/**
 * Full-page component to display when a tenant's account is suspended.
 * Use this in the app (app.fixlytaller.com) when receiving a 403 TENANT_SUSPENDED error.
 *
 * Example usage in app:
 * ```tsx
 * // In your API interceptor or error boundary:
 * if (error.code === 'TENANT_SUSPENDED') {
 *   return <TenantSuspended tenantName={error.tenantName} />;
 * }
 * ```
 */
export function TenantSuspended({
  tenantName,
  supportEmail = 'soporte@fixlytaller.com',
  supportPhone = '+54 9 11 1234-5678',
  onLogout,
}: TenantSuspendedProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-xl">
        <CardContent className="pt-8 pb-8 text-center">
          {/* Warning Icon */}
          <div className="mx-auto w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mb-6">
            <AlertTriangle className="h-10 w-10 text-yellow-600" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Cuenta Suspendida
          </h1>

          {tenantName && (
            <p className="text-gray-600 mb-4">
              {tenantName}
            </p>
          )}

          {/* Message */}
          <p className="text-gray-600 mb-6">
            Tu cuenta ha sido suspendida debido a un problema con el pago.
            Para reactivar tu acceso, por favor contacta a nuestro equipo de soporte.
          </p>

          {/* Contact Options */}
          <div className="space-y-3 mb-6">
            <a
              href={`mailto:${supportEmail}`}
              className="flex items-center justify-center gap-2 p-3 bg-fixly-purple-50 hover:bg-fixly-purple-100 rounded-lg text-fixly-purple-700 transition-colors"
            >
              <Mail className="h-5 w-5" />
              <span className="font-medium">{supportEmail}</span>
            </a>

            <a
              href={`tel:${supportPhone.replace(/\s/g, '')}`}
              className="flex items-center justify-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-700 transition-colors"
            >
              <Phone className="h-5 w-5" />
              <span className="font-medium">{supportPhone}</span>
            </a>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Button
              className="w-full"
              onClick={() => window.open('https://fixlytaller.com/planes', '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Ver Planes y Precios
            </Button>

            {onLogout && (
              <Button
                variant="ghost"
                className="w-full text-gray-500"
                onClick={onLogout}
              >
                Cerrar Sesión
              </Button>
            )}
          </div>

          {/* Footer Note */}
          <p className="text-xs text-gray-400 mt-6">
            Si crees que esto es un error, no dudes en contactarnos.
            Estamos aquí para ayudarte.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default TenantSuspended;
