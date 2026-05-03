import { useState } from 'react';
import { Shield, Mail, Lock, User, ChevronDown, Eye, EyeOff, Loader2, AlertCircle, Map, Building2 } from 'lucide-react';

interface LoginPageProps {
  onLogin: (token: string, user: any) => void;
}

type Tab = 'login' | 'register';
type Rol = 'ciudadano' | 'autoridad' | 'tecnico';
type Producto = 'territorio' | 'activos';

const ROLES: { value: Rol; label: string; desc: string }[] = [
  { value: 'ciudadano', label: 'Ciudadano', desc: 'Consulta de datos y mapas' },
  { value: 'autoridad', label: 'Autoridad', desc: 'Acceso completo + predicciones' },
  { value: 'tecnico', label: 'Técnico', desc: 'Administración y modelos ML' },
];

const PRODUCTOS: { value: Producto; label: string; desc: string; icon: any }[] = [
  { value: 'territorio', label: 'Atalaya Territorio', desc: 'Municipalidades, comunas, mapas y prediccion publica', icon: Map },
  { value: 'activos', label: 'Atalaya Activos', desc: 'Empresas, sedes, activos criticos y seguridad privada', icon: Building2 },
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

function productPath(producto?: string) {
  return producto === 'activos' ? '/activos' : '/territorio';
}

function inferDemoProduct(email: string) {
  return email.toLowerCase() === 'pedro@safecity.cl' ? 'activos' : 'territorio';
}

async function attemptRegister(nombre: string, email: string, password: string, rol: string, producto: Producto): Promise<{ access_token: string; user: any }> {
  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, email, password, rol, producto_preferido: producto }),
    });
    if (res.status === 404) throw new Error('__FALLBACK__');
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Error al registrar');
    return data;
  } catch (err: any) {
    if (err.message === '__FALLBACK__' || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
      // Fallback: crear usuario local
      const newUser = { id: Date.now(), nombre, email, rol, comuna_id: 22, producto_preferido: producto };
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
  const [regProducto, setRegProducto] = useState<Producto>('territorio');
  const [rolOpen, setRolOpen] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await attemptLogin(email, password);
      const user = { ...data.user, producto_preferido: data.user?.producto_preferido || inferDemoProduct(email) };
      onLogin(data.access_token, user);
      window.location.assign(productPath(user.producto_preferido));
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
      const data = await attemptRegister(regNombre, regEmail, regPassword, regRol, regProducto);
      const user = { ...data.user, producto_preferido: data.user?.producto_preferido || regProducto };
      onLogin(data.access_token, user);
      window.location.assign(productPath(user.producto_preferido));
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
      const user = { ...data.user, producto_preferido: data.user?.producto_preferido || inferDemoProduct(demoEmail) };
      onLogin(data.access_token, user);
      window.location.assign(productPath(user.producto_preferido));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Panel izquierdo - branding */}
      <div className="relative hidden border-r border-border bg-card lg:flex lg:w-1/2">
        <div className="flex flex-col justify-center px-16">
          <div className="mb-8 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-foreground">
              <Shield className="h-7 w-7 text-background" />
            </div>
            <div>
              <div className="atalaya-kicker">Sistema de seguridad publica</div>
              <h1 className="atalaya-serif text-5xl font-semibold">Atalaya</h1>
            </div>
          </div>

          <p className="mb-12 max-w-md text-lg leading-8 text-muted-foreground">
            Plataforma de analítica criminal y predicción delictual para ciudades más seguras.
          </p>

          <div className="atalaya-panel-soft max-w-md divide-y divide-border">
            {[
              { label: 'Dashboard en tiempo real', code: '01' },
              { label: 'Mapas de calor interactivos', code: '02' },
              { label: 'Predicciones con IA', code: '03' },
              { label: 'Ranking de seguridad comunal', code: '04' },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-4 px-4 py-3">
                <span className="atalaya-mono text-xs text-primary">{f.code}</span>
                <span className="text-sm text-muted-foreground">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Panel derecho - formulario */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Logo mobile */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-foreground">
              <Shield className="h-6 w-6 text-background" />
            </div>
            <div>
              <h1 className="atalaya-serif text-3xl font-semibold">Atalaya</h1>
              <p className="atalaya-kicker">Analytics</p>
            </div>
          </div>

          {/* Tab selector */}
          <div className="mb-6 flex rounded-sm border border-border bg-muted p-1">
            <button
              onClick={() => { setTab('login'); setError(''); }}
              className={`flex-1 rounded-sm py-2.5 text-sm font-medium transition-all ${
                tab === 'login' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
              }`}
            >
              Iniciar sesión
            </button>
            <button
              onClick={() => { setTab('register'); setError(''); }}
              className={`flex-1 rounded-sm py-2.5 text-sm font-medium transition-all ${
                tab === 'register' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
              }`}
            >
              Crear cuenta
            </button>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-sm border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700">
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
                    className="w-full rounded-sm border border-border bg-muted py-3 pl-10 pr-4 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
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
                    className="w-full rounded-sm border border-border bg-muted py-3 pl-10 pr-12 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
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
                className="flex w-full items-center justify-center gap-2 rounded-sm bg-primary py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? 'Ingresando...' : 'Iniciar sesión'}
              </button>

              {/* Demo accounts */}
              <div className="pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground text-center mb-3">Acceso rápido con cuentas demo</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                      className={`rounded-sm border px-3 py-2 text-xs font-medium transition-colors hover:opacity-80 ${d.color}`}
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
                    className="w-full rounded-sm border border-border bg-muted py-3 pl-10 pr-4 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
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
                    className="w-full rounded-sm border border-border bg-muted py-3 pl-10 pr-4 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
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
                    className="w-full rounded-sm border border-border bg-muted py-3 pl-10 pr-12 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
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

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Producto inicial</label>
                <div className="grid grid-cols-2 gap-2">
                  {PRODUCTOS.map((producto) => {
                    const Icon = producto.icon;
                    const selected = regProducto === producto.value;
                    return (
                      <button
                        key={producto.value}
                        type="button"
                        onClick={() => setRegProducto(producto.value)}
                        className={`rounded-sm border p-3 text-left transition-colors ${
                          selected ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-muted text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span className="text-sm font-medium">{producto.label}</span>
                        </div>
                        <p className="text-xs leading-5">{producto.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Rol selector */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Tipo de perfil</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setRolOpen(!rolOpen)}
                    className="flex w-full items-center justify-between rounded-sm border border-border bg-muted px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <span className="capitalize">{ROLES.find(r => r.value === regRol)?.label}</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${rolOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {rolOpen && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-sm border border-border bg-popover shadow-lg">
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
                className="flex w-full items-center justify-center gap-2 rounded-sm bg-primary py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
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
