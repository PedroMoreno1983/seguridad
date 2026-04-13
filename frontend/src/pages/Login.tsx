import { useState } from 'react';
import { Shield, Mail, Lock, User, ChevronDown, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';

interface LoginPageProps {
  onLogin: (token: string, user: any) => void;
}

type Tab = 'login' | 'register';
type Rol = 'ciudadano' | 'autoridad' | 'tecnico';

const ROLES: { value: Rol; label: string; desc: string }[] = [
  { value: 'ciudadano', label: 'Ciudadano', desc: 'Consulta de datos y mapas' },
  { value: 'autoridad', label: 'Autoridad', desc: 'Acceso completo + predicciones' },
  { value: 'tecnico', label: 'Técnico', desc: 'Administración y modelos ML' },
];

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// Cuentas demo locales (fallback si el backend no tiene /auth todavía)
const DEMO_ACCOUNTS: Record<string, { password: string; user: any }> = {
  'admin@safecity.cl':      { password: 'admin123',      user: { id: 1, nombre: 'Admin Técnico',  email: 'admin@safecity.cl',      rol: 'tecnico',   comuna_id: 22 } },
  'autoridad@safecity.cl':  { password: 'autoridad123',  user: { id: 2, nombre: 'Jefe Seguridad', email: 'autoridad@safecity.cl',  rol: 'autoridad', comuna_id: 22 } },
  'ciudadano@safecity.cl':  { password: 'ciudadano123',  user: { id: 3, nombre: 'Ciudadano Demo', email: 'ciudadano@safecity.cl',  rol: 'ciudadano', comuna_id: 22 } },
  'pedro@safecity.cl':      { password: 'pedro123',      user: { id: 4, nombre: 'Pedro Moreno',   email: 'pedro@safecity.cl',      rol: 'tecnico',   comuna_id: 22 } },
};

// Intenta login contra el backend; si falla con 404 (endpoint no existe), usa fallback local
async function attemptLogin(email: string, password: string): Promise<{ access_token: string; user: any }> {
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res.status === 404) throw new Error('__FALLBACK__');
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Credenciales incorrectas');
    return data;
  } catch (err: any) {
    // Si el endpoint no existe, usar cuentas demo locales
    if (err.message === '__FALLBACK__' || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
      const demo = DEMO_ACCOUNTS[email.toLowerCase()];
      if (demo && demo.password === password) {
        return { access_token: 'local_' + Date.now(), user: demo.user };
      }
      throw new Error('Correo o contraseña incorrectos');
    }
    throw err;
  }
}

async function attemptRegister(nombre: string, email: string, password: string, rol: string): Promise<{ access_token: string; user: any }> {
  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, email, password, rol }),
    });
    if (res.status === 404) throw new Error('__FALLBACK__');
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Error al registrar');
    return data;
  } catch (err: any) {
    if (err.message === '__FALLBACK__' || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
      // Fallback: crear usuario local
      const newUser = { id: Date.now(), nombre, email, rol, comuna_id: 22 };
      return { access_token: 'local_' + Date.now(), user: newUser };
    }
    throw err;
  }
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [tab, setTab] = useState<Tab>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Register fields
  const [regNombre, setRegNombre] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRol, setRegRol] = useState<Rol>('ciudadano');
  const [rolOpen, setRolOpen] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await attemptLogin(email, password);
      onLogin(data.access_token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (regPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setLoading(true);
    try {
      const data = await attemptRegister(regNombre, regEmail, regPassword, regRol);
      onLogin(data.access_token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Quick login with demo accounts
  const quickLogin = async (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError('');
    setLoading(true);
    try {
      const data = await attemptLogin(demoEmail, demoPass);
      onLogin(data.access_token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Panel izquierdo - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/20 via-background to-blue-900/20 relative overflow-hidden">
        <div className="absolute inset-0">
          {/* Decorative circles */}
          <div className="absolute top-20 left-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-32 right-16 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-cyan-500/10 rounded-full blur-2xl" />
        </div>

        <div className="relative z-10 flex flex-col justify-center px-16">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-4 bg-primary rounded-2xl shadow-lg shadow-primary/25">
              <Shield className="h-10 w-10 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-4xl font-bold">SafeCity</h1>
              <p className="text-lg text-muted-foreground">Analytics Platform</p>
            </div>
          </div>

          <p className="text-xl text-muted-foreground leading-relaxed max-w-md mb-12">
            Plataforma de analítica criminal y predicción delictual para ciudades más seguras.
          </p>

          <div className="space-y-4">
            {[
              { label: 'Dashboard en tiempo real', color: 'bg-blue-500' },
              { label: 'Mapas de calor interactivos', color: 'bg-cyan-500' },
              { label: 'Predicciones con IA', color: 'bg-purple-500' },
              { label: 'Ranking de seguridad comunal', color: 'bg-green-500' },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${f.color}`} />
                <span className="text-sm text-muted-foreground">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Panel derecho - formulario */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Logo mobile */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="p-3 bg-primary rounded-xl">
              <Shield className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">SafeCity</h1>
              <p className="text-xs text-muted-foreground">Analytics</p>
            </div>
          </div>

          {/* Tab selector */}
          <div className="flex bg-muted rounded-xl p-1 mb-6">
            <button
              onClick={() => { setTab('login'); setError(''); }}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                tab === 'login' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
              }`}
            >
              Iniciar sesión
            </button>
            <button
              onClick={() => { setTab('register'); setError(''); }}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                tab === 'register' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
              }`}
            >
              Crear cuenta
            </button>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Login form */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Correo electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@correo.cl"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tu contraseña"
                    required
                    className="w-full pl-10 pr-12 py-3 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? 'Ingresando...' : 'Iniciar sesión'}
              </button>

              {/* Demo accounts */}
              <div className="pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground text-center mb-3">Acceso rápido con cuentas demo</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Técnico', email: 'admin@safecity.cl', pass: 'admin123', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
                    { label: 'Autoridad', email: 'autoridad@safecity.cl', pass: 'autoridad123', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
                    { label: 'Ciudadano', email: 'ciudadano@safecity.cl', pass: 'ciudadano123', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
                  ].map((d) => (
                    <button
                      key={d.label}
                      type="button"
                      onClick={() => quickLogin(d.email, d.pass)}
                      disabled={loading}
                      className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors hover:opacity-80 ${d.color}`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </form>
          )}

          {/* Register form */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Nombre completo</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={regNombre}
                    onChange={(e) => setRegNombre(e.target.value)}
                    placeholder="Tu nombre"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Correo electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="tu@correo.cl"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                    className="w-full pl-10 pr-12 py-3 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Rol selector */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Tipo de perfil</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setRolOpen(!rolOpen)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  >
                    <span className="capitalize">{ROLES.find(r => r.value === regRol)?.label}</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${rolOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {rolOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                      {ROLES.map((r) => (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => { setRegRol(r.value); setRolOpen(false); }}
                          className={`w-full px-4 py-3 text-left hover:bg-muted transition-colors ${regRol === r.value ? 'bg-muted' : ''}`}
                        >
                          <div className="text-sm font-medium capitalize">{r.label}</div>
                          <div className="text-xs text-muted-foreground">{r.desc}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? 'Creando cuenta...' : 'Crear cuenta'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
