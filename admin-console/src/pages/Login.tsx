import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Lock, Mail, AlertCircle, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/store/auth';
import { authApi } from '@/services/api';
import { toast } from '@/hooks/use-toast';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authApi.login(data.email, data.password);
      login(response.user, response.token);
      toast({
        title: 'Bienvenido',
        description: `Hola ${response.user.name}`,
        variant: 'default',
      });
      navigate('/dashboard');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al iniciar sesión';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // DEV mode login for testing
  const handleDevLogin = () => {
    const devUser = {
      id: 'dev-user-1',
      email: 'admin@fixly.com',
      name: 'Admin Dev',
      role: 'superadmin' as const,
      tenantId: null,
      active: true,
      emailVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    login(devUser, 'dev-token-12345');
    navigate('/dashboard');
  };

  // Demo login - uses demo credentials
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const handleDemoLogin = async () => {
    setIsDemoLoading(true);
    setError(null);

    try {
      // Demo credentials (from seed:demo)
      const demoEmail = 'demo@fixly.com';
      const demoPassword = 'demo123';

      const response = await authApi.login(demoEmail, demoPassword);
      login(response.user, response.token);
      toast({
        title: 'Modo Demo',
        description: 'Bienvenido al entorno de demostración',
        variant: 'default',
      });
      navigate('/dashboard');
    } catch (err) {
      setError('No se pudo acceder al modo demo. Verifica que el seed esté ejecutado.');
      toast({
        title: 'Error',
        description: 'No se pudo acceder al modo demo',
        variant: 'destructive',
      });
    } finally {
      setIsDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-fixly-purple-600 via-fixly-purple-500 to-indigo-500 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-4">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-10 h-10 text-white"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16" />
              <path d="M3 21h18" />
              <path d="M9 7h1" />
              <path d="M9 11h1" />
              <path d="M9 15h1" />
              <path d="M14 7h1" />
              <path d="M14 11h1" />
              <path d="M14 15h1" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">Fixly Admin</h1>
          <p className="text-white/70 mt-2">Sistema de Administración Multi-Tenant</p>
        </div>

        {/* Login Card */}
        <Card className="shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle>Iniciar Sesión</CardTitle>
            <CardDescription>
              Ingresa tus credenciales para acceder al panel
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 rounded-lg">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@example.com"
                    className="pl-9"
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-red-500">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="pl-9 pr-10"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-500">{errors.password.message}</p>
                )}
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-fixly-purple-600 focus:ring-fixly-purple-500"
                  />
                  <span className="text-gray-600">Recordarme</span>
                </label>
                <a href="#" className="text-fixly-purple-600 hover:underline">
                  ¿Olvidaste tu contraseña?
                </a>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Iniciando sesión...
                  </span>
                ) : (
                  'Iniciar Sesión'
                )}
              </Button>

              {/* Demo login button */}
              <div className="pt-4 border-t space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-fixly-purple-200 text-fixly-purple-600 hover:bg-fixly-purple-50"
                  onClick={handleDemoLogin}
                  disabled={isDemoLoading}
                >
                  {isDemoLoading ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-fixly-purple-300 border-t-fixly-purple-600 rounded-full animate-spin" />
                      Entrando...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Play className="h-4 w-4" />
                      Entrar como Demo
                    </span>
                  )}
                </Button>

                {/* Dev mode button - only show in development */}
                {import.meta.env.DEV && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-gray-500"
                    onClick={handleDevLogin}
                  >
                    Modo Desarrollo (Sin API)
                  </Button>
                )}
              </div>

              {/* Signup link */}
              <p className="text-center text-sm text-gray-500 pt-4">
                ¿No tienes cuenta?{' '}
                <Link to="/signup" className="text-fixly-purple-600 hover:underline font-medium">
                  Crear mi taller
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-white/60 text-sm mt-6">
          © {new Date().getFullYear()} Fixly. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}
