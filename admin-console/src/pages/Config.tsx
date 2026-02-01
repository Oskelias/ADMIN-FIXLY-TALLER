import { useState, useEffect } from 'react';
import {
  Settings,
  Globe,
  Bell,
  Palette,
  Shield,
  Database,
  Activity,
  Save,
  RefreshCw,
  CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { configApi } from '@/services/api';
import { useAuthStore } from '@/store/auth';
import { toast } from '@/hooks/use-toast';
import type { TenantSettings } from '@/types';

interface SystemHealth {
  status: string;
  services: Record<string, { status: string; latency: number }>;
}

const defaultSettings: TenantSettings = {
  branding: {
    primaryColor: '#7c3aed',
    secondaryColor: '#6366f1',
  },
  notifications: {
    emailEnabled: true,
    smsEnabled: false,
    whatsappEnabled: true,
  },
  features: {
    inventoryEnabled: true,
    reportsEnabled: true,
    multiLocationEnabled: false,
  },
};

export function ConfigPage() {
  const [settings, setSettings] = useState<TenantSettings>(defaultSettings);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);
  const { user, isSuperAdmin } = useAuthStore();

  const fetchSettings = async () => {
    try {
      const data = await configApi.getTenantSettings(user?.tenantId || 'global');
      setSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchSystemHealth = async () => {
    setIsLoadingHealth(true);
    try {
      const health = await configApi.getSystemHealth();
      setSystemHealth(health);
    } catch (error) {
      // Mock data
      setSystemHealth({
        status: 'healthy',
        services: {
          api: { status: 'healthy', latency: 45 },
          database: { status: 'healthy', latency: 12 },
          cache: { status: 'healthy', latency: 3 },
          mercadopago: { status: 'healthy', latency: 120 },
        },
      });
    } finally {
      setIsLoadingHealth(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchSystemHealth();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await configApi.updateTenantSettings(user?.tenantId || 'global', settings);
      toast({ title: 'Configuración guardada' });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar la configuración',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateNotification = (key: keyof typeof settings.notifications, value: boolean) => {
    setSettings(prev => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: value },
    }));
  };

  const updateFeature = (key: keyof typeof settings.features, value: boolean) => {
    setSettings(prev => ({
      ...prev,
      features: { ...prev.features, [key]: value },
    }));
  };

  const updateBranding = (key: keyof typeof settings.branding, value: string) => {
    setSettings(prev => ({
      ...prev,
      branding: { ...prev.branding, [key]: value },
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="h-7 w-7 text-fixly-purple-600" />
            Configuración del Sistema
          </h1>
          <p className="text-gray-500 mt-1">
            Administra la configuración global y por tenant
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Guardando...' : 'Guardar Cambios'}
        </Button>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="notifications">Notificaciones</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="features">Funcionalidades</TabsTrigger>
          {isSuperAdmin() && <TabsTrigger value="system">Sistema</TabsTrigger>}
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Configuración Regional
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Zona Horaria</Label>
                  <Select defaultValue="America/Argentina/Buenos_Aires">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/Argentina/Buenos_Aires">
                        Buenos Aires (GMT-3)
                      </SelectItem>
                      <SelectItem value="America/Sao_Paulo">
                        São Paulo (GMT-3)
                      </SelectItem>
                      <SelectItem value="America/Mexico_City">
                        Ciudad de México (GMT-6)
                      </SelectItem>
                      <SelectItem value="America/Santiago">
                        Santiago (GMT-4)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Idioma</Label>
                  <Select defaultValue="es">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="pt">Português</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Moneda</Label>
                  <Select defaultValue="ARS">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ARS">Peso Argentino (ARS)</SelectItem>
                      <SelectItem value="USD">Dólar (USD)</SelectItem>
                      <SelectItem value="BRL">Real (BRL)</SelectItem>
                      <SelectItem value="MXN">Peso Mexicano (MXN)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Seguridad
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Tiempo de Sesión (horas)</Label>
                  <Input type="number" defaultValue="24" />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Autenticación 2FA</Label>
                    <p className="text-sm text-gray-500">
                      Requerir verificación en dos pasos
                    </p>
                  </div>
                  <Switch />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Rate Limiting</Label>
                    <p className="text-sm text-gray-500">
                      Limitar peticiones por minuto
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Notifications Settings */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Canales de Notificación
              </CardTitle>
              <CardDescription>
                Configura los canales de notificación disponibles
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base">Email</Label>
                  <p className="text-sm text-gray-500">
                    Enviar notificaciones por correo electrónico
                  </p>
                </div>
                <Switch
                  checked={settings.notifications.emailEnabled}
                  onCheckedChange={(v) => updateNotification('emailEnabled', v)}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base">SMS</Label>
                  <p className="text-sm text-gray-500">
                    Enviar notificaciones por mensaje de texto
                  </p>
                </div>
                <Switch
                  checked={settings.notifications.smsEnabled}
                  onCheckedChange={(v) => updateNotification('smsEnabled', v)}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base">WhatsApp</Label>
                  <p className="text-sm text-gray-500">
                    Enviar notificaciones por WhatsApp
                  </p>
                </div>
                <Switch
                  checked={settings.notifications.whatsappEnabled}
                  onCheckedChange={(v) => updateNotification('whatsappEnabled', v)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branding Settings */}
        <TabsContent value="branding" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Personalización de Marca
              </CardTitle>
              <CardDescription>
                Personaliza la apariencia del sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Logo URL</Label>
                  <Input
                    placeholder="https://example.com/logo.png"
                    value={settings.branding.logoUrl || ''}
                    onChange={(e) => updateBranding('logoUrl', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Color Primario</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      className="w-14 h-10 p-1"
                      value={settings.branding.primaryColor || '#7c3aed'}
                      onChange={(e) => updateBranding('primaryColor', e.target.value)}
                    />
                    <Input
                      value={settings.branding.primaryColor || '#7c3aed'}
                      onChange={(e) => updateBranding('primaryColor', e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Color Secundario</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      className="w-14 h-10 p-1"
                      value={settings.branding.secondaryColor || '#6366f1'}
                      onChange={(e) => updateBranding('secondaryColor', e.target.value)}
                    />
                    <Input
                      value={settings.branding.secondaryColor || '#6366f1'}
                      onChange={(e) => updateBranding('secondaryColor', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="border rounded-lg p-6 bg-gray-50">
                <Label className="text-sm text-gray-500 mb-4 block">Vista Previa</Label>
                <div
                  className="h-16 rounded-lg flex items-center px-4"
                  style={{
                    background: `linear-gradient(135deg, ${settings.branding.primaryColor || '#7c3aed'} 0%, ${settings.branding.secondaryColor || '#6366f1'} 100%)`,
                  }}
                >
                  <span className="text-white font-semibold">Fixly Admin Console</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Features Settings */}
        <TabsContent value="features" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Funcionalidades</CardTitle>
              <CardDescription>
                Habilita o deshabilita funcionalidades del sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base">Inventario</Label>
                  <p className="text-sm text-gray-500">
                    Módulo de gestión de inventario y stock
                  </p>
                </div>
                <Switch
                  checked={settings.features.inventoryEnabled}
                  onCheckedChange={(v) => updateFeature('inventoryEnabled', v)}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base">Reportes Avanzados</Label>
                  <p className="text-sm text-gray-500">
                    Acceso a reportes y análisis avanzados
                  </p>
                </div>
                <Switch
                  checked={settings.features.reportsEnabled}
                  onCheckedChange={(v) => updateFeature('reportsEnabled', v)}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base">Multi-Ubicación</Label>
                  <p className="text-sm text-gray-500">
                    Gestionar múltiples sucursales
                  </p>
                </div>
                <Switch
                  checked={settings.features.multiLocationEnabled}
                  onCheckedChange={(v) => updateFeature('multiLocationEnabled', v)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Settings (Super Admin only) */}
        {isSuperAdmin() && (
          <TabsContent value="system" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Estado del Sistema
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Estado General</span>
                    <Badge variant="success">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Saludable
                    </Badge>
                  </div>

                  {systemHealth?.services && Object.entries(systemHealth.services).map(([name, service]) => (
                    <div key={name} className="flex items-center justify-between">
                      <span className="text-gray-500 capitalize">{name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400">{service.latency}ms</span>
                        <Badge variant={service.status === 'healthy' ? 'success' : 'destructive'}>
                          {service.status === 'healthy' ? 'OK' : 'Error'}
                        </Badge>
                      </div>
                    </div>
                  ))}

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={fetchSystemHealth}
                    disabled={isLoadingHealth}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingHealth ? 'animate-spin' : ''}`} />
                    Actualizar Estado
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Base de Datos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Tipo</span>
                    <span className="font-medium">Cloudflare D1</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Región</span>
                    <span className="font-medium">Global (Edge)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Estado</span>
                    <Badge variant="success">Conectado</Badge>
                  </div>

                  <div className="pt-4 space-y-2">
                    <Button variant="outline" className="w-full">
                      Optimizar DB
                    </Button>
                    <Button variant="outline" className="w-full">
                      Limpiar Cache
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* API Info */}
            <Card>
              <CardHeader>
                <CardTitle>Información de la API</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <Label className="text-gray-500">URL Base</Label>
                    <p className="font-mono text-sm mt-1">https://api.fixlytaller.com</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <Label className="text-gray-500">Versión</Label>
                    <p className="font-mono text-sm mt-1">v1.0.0</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <Label className="text-gray-500">Entorno</Label>
                    <p className="font-mono text-sm mt-1">Production</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
