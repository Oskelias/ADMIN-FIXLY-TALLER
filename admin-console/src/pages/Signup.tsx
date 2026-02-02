import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Lock, Mail, AlertCircle, Building2, Phone, ArrowLeft, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/store/auth';
import { authApi } from '@/services/api';
import { toast } from '@/hooks/use-toast';

const signupSchema = z.object({
  businessName: z.string().min(2, 'El nombre del taller debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  confirmPassword: z.string(),
  phone: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type SignupFormData = z.infer<typeof signupSchema>;

export function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      businessName: '',
      email: '',
      password: '',
      confirmPassword: '',
      phone: '',
    },
  });

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authApi.signup({
        email: data.email,
        password: data.password,
        businessName: data.businessName,
        phone: data.phone,
      });

      login(response.user, response.token);

      toast({
        title: '¡Cuenta creada!',
        description: `Bienvenido a Fixly. Tu período de prueba de 14 días ha comenzado.`,
        variant: 'default',
      });

      // Redirect to app (the actual workshop app)
      const appUrl = import.meta.env.VITE_APP_URL || 'https://app.fixlytaller.com';
      window.location.href = `${appUrl}?token=${response.token}`;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al crear la cuenta';
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
          <h1 className="text-3xl font-bold text-white">Crear Mi Taller</h1>
          <p className="text-white/70 mt-2">Comienza tu prueba gratis de 14 días</p>
        </div>

        {/* Signup Card */}
        <Card className="shadow-2xl">
          <CardHeader className="text-center pb-2">
            <CardTitle>Registro</CardTitle>
            <CardDescription>
              Crea tu cuenta para gestionar tu taller
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
                <Label htmlFor="businessName">Nombre del Taller</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="businessName"
                    type="text"
                    placeholder="Mi Taller Mecánico"
                    className="pl-9"
                    {...register('businessName')}
                  />
                </div>
                {errors.businessName && (
                  <p className="text-xs text-red-500">{errors.businessName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="contacto@mitaller.com"
                    className="pl-9"
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-red-500">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono (opcional)</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+54 9 11 1234-5678"
                    className="pl-9"
                    {...register('phone')}
                  />
                </div>
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

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="pl-9"
                    {...register('confirmPassword')}
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs text-red-500">{errors.confirmPassword.message}</p>
                )}
              </div>

              {/* Trial benefits */}
              <div className="bg-fixly-purple-50 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium text-fixly-purple-700">Tu prueba incluye:</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-fixly-purple-600">
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    <span>14 días gratis</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    <span>Sin tarjeta</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    <span>Soporte incluido</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    <span>Cancela cuando quieras</span>
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creando cuenta...
                  </span>
                ) : (
                  'Crear Mi Taller'
                )}
              </Button>

              {/* Back to login */}
              <p className="text-center text-sm text-gray-500 pt-2">
                ¿Ya tienes cuenta?{' '}
                <Link to="/login" className="text-fixly-purple-600 hover:underline font-medium inline-flex items-center gap-1">
                  <ArrowLeft className="h-3 w-3" />
                  Iniciar sesión
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-white/60 text-sm mt-6">
          Al crear tu cuenta, aceptas nuestros{' '}
          <a href="#" className="underline hover:text-white">Términos de Servicio</a>
          {' '}y{' '}
          <a href="#" className="underline hover:text-white">Política de Privacidad</a>
        </p>
      </div>
    </div>
  );
}
