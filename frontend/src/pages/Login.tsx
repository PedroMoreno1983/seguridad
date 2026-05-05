import { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Map,
  Shield,
  User,
} from 'lucide-react';

interface LoginPageProps {
  onLogin: (token: string, user: any) => void;
}

type Pantalla = 'selector' | 'territorial_login' | 'territorial_register' | 'organizacion_login' | 'organizacion_register';
type RolTerritorial = 'ciudadano' | 'autoridad' | 'tecnico';

const ROLES_TERRITORIALES: { value: RolTerritorial; label: string; desc: string }[] = [
  { value: 'ciudadano', label: 'Ciudadano', desc: 'Consulta de datos y mapas públicos' },
  { value: 'autoridad', label: 'Autoridad', desc: 'Acceso completo + predicciones' },
  { value: 'tecnico', label: 'Técnico', desc: 'Administración y modelos ML' },
];

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const DEMO_TERRITORIAL: Record<string, { password: string; user: any }> = {
  'admin@safecity.cl':     { password: 'admin123',     user: { id: 1, nombre: 'Admin Técnico',  email: 'admin@safecity.cl',     rol: 'tecnico',    tipo_usuario: 'territorial', comuna_id: 22 } },
  'autoridad@safecity.cl': { password: 'autoridad123', user: { id: 2, nombre: 'Jefe Seguridad', email: 'autoridad@safecity.cl', rol: 'autoridad',  tipo_usuario: 'territorial', comuna_id: 22 } },
  'ciudadano@safecity.cl': { password: 'ciudadano123', user: { id: 3, nombre: 'Ciudadano Demo', email: 'ciudadano@safecity.cl', rol: 'ciudadano',  tipo_usuario: 'territorial', comuna_id: 22 } },
};

const DEMO_ORGANIZACION: Record<string, { password: string; user: any }> = {
  'empresa@safecity.cl':   { password: 'empresa123',   user: { id: 10, nombre: 'Seguridad Retail', email: 'empresa@safecity.cl', rol: 'manager', tipo_usuario: 'organizacion', organizacion_id: 1 } },
};

async function apiLogin(email: string, password: string): Promise<{ access_token: string; user: any }> {
  const allDemos = { ...DEMO_TERRITORIAL, ...DEMO_ORGANIZACION };
  const demo = allDemos[email.toLowerCase()];

  // Cuentas demo: resuelven localmente siempre, sin tocar el backend
  if (demo) {
    if (demo.password === password) {
      return { access_token: 'local_' + Date.now(), user: demo.user };
    }
    throw new Error('Contraseña incorrecta para la cuenta demo');
  }

  // Cuentas reales: van al backend
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Credenciales incorrectas');
    return data;
  } catch (err: any) {
    if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
      throw new Error('No se puede conectar al servidor');
    }
    throw err;
  }
}

async function apiRegister(payload: object): Promise<{ access_token: string; user: any }> {
  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.status === 404) throw new Error('__FALLBACK__');
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Error al registrar');
    return data;
  } catch (err: any) {
    if (err.message === '__FALLBACK__' || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
      return { access_token: 'local_' + Date.now(), user: { id: Date.now(), ...payload, activo: true } };
    }
    throw err;
  }
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [pantalla, setPantalla] = useState<Pantalla>('selector');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [rol, setRol] = useState<RolTerritorial>('ciudadano');
  const [rolOpen, setRolOpen] = useState(false);

  const resetForm = () => {
    setEmail(''); setPassword(''); setNombre(''); setRegPassword('');
    setRol('ciudadano'); setError(''); setShowPassword(false);
  };

  const goTo = (p: Pantalla) => { resetForm(); setPantalla(p); };

  const handleLogin = async (tipo: 'territorial' | 'organizacion', e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await apiLogin(email, password);
      const user = { ...data.user, tipo_usuario: data.user?.tipo_usuario ?? tipo };
      onLogin(data.access_token, user);
      window.location.assign(tipo === 'organizacion' ? '/activos' : '/territorio');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterTerritorial = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (regPassword.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return; }
    setLoading(true);
    try {
      const data = await apiRegister({ nombre, email, password: regPassword, tipo_usuario: 'territorial', rol, comuna_id: 22 });
      const user = { ...data.user, tipo_usuario: 'territorial' };
      onLogin(data.access_token, user);
      window.location.assign('/territorio');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterOrganizacion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (regPassword.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return; }
    setLoading(true);
    try {
      const data = await apiRegister({ nombre, email, password: regPassword, tipo_usuario: 'organizacion', rol: 'manager' });
      const user = { ...data.user, tipo_usuario: 'organizacion' };
      onLogin(data.access_token, user);
      window.location.assign('/activos');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (demoEmail: string, demoPass: string) => {
    setError(''); setLoading(true);
    try {
      const data = await apiLogin(demoEmail, demoPass);
      const tipo = data.user?.tipo_usuario ?? 'territorial';
      onLogin(data.access_token, data.user);
      window.location.assign(tipo === 'organizacion' ? '/activos' : '/territorio');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Pantalla selector ──────────────────────────────────────
  if (pantalla === 'selector') {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <div className="flex h-14 items-center border-b border-border bg-card px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-foreground">
              <Shield className="h-4 w-4 text-background" />
            </div>
            <span className="atalaya-serif text-lg font-semibold">Atalaya</span>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
          <div className="mb-10 text-center">
            <p className="atalaya-kicker mb-2">Selecciona tu tipo de acceso</p>
            <h1 className="atalaya-serif text-4xl font-semibold">¿Qué operación gestionas?</h1>
          </div>

          <div className="grid w-full max-w-2xl gap-4 md:grid-cols-2">
            {/* Territorial */}
            <button
              onClick={() => goTo('territorial_login')}
              className="group flex flex-col gap-4 rounded-sm border border-border bg-card p-6 text-left transition-colors hover:border-primary hover:bg-muted/50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-primary">
                <Map className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <div className="atalaya-kicker mb-1 text-primary">Seguridad pública</div>
                <h2 className="atalaya-serif text-2xl font-semibold">Acceso Municipal</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Municipalidades, comunas, mapas delictuales, predicción territorial y participación ciudadana.
                </p>
              </div>
              <div className="mt-auto flex flex-wrap gap-2">
                {['Ciudadano', 'Autoridad', 'Técnico'].map((r) => (
                  <span key={r} className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">{r}</span>
                ))}
              </div>
            </button>

            {/* Organizacion */}
            <button
              onClick={() => goTo('organizacion_login')}
              className="group flex flex-col gap-4 rounded-sm border border-border bg-card p-6 text-left transition-colors hover:border-foreground hover:bg-muted/50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-foreground">
                <Building2 className="h-6 w-6 text-background" />
              </div>
              <div>
                <div className="atalaya-kicker mb-1">Seguridad privada</div>
                <h2 className="atalaya-serif text-2xl font-semibold">Acceso Empresarial</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Retail, logística, clínicas, colegios y condominios. Gestión de sedes, incidentes y activos críticos.
                </p>
              </div>
              <div className="mt-auto flex flex-wrap gap-2">
                {['Viewer', 'Manager', 'Admin'].map((r) => (
                  <span key={r} className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">{r}</span>
                ))}
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const esTerritorial = pantalla === 'territorial_login' || pantalla === 'territorial_register';
  const esLogin = pantalla === 'territorial_login' || pantalla === 'organizacion_login';
  const tipo = esTerritorial ? 'territorial' : 'organizacion';

  // ── Formulario login / registro ───────────────────────────
  return (
    <div className="flex min-h-screen bg-background">
      {/* Panel izquierdo - identidad */}
      <div className="relative hidden border-r border-border lg:flex lg:w-2/5">
        <div className={`absolute inset-0 ${esTerritorial ? 'bg-primary/5' : 'bg-foreground/5'}`} />
        <div className="relative flex flex-col justify-center px-12">
          <div className="mb-8 flex items-center gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-sm ${esTerritorial ? 'bg-primary' : 'bg-foreground'}`}>
              {esTerritorial
                ? <Map className="h-7 w-7 text-primary-foreground" />
                : <Building2 className="h-7 w-7 text-background" />}
            </div>
            <div>
              <div className="atalaya-kicker">{esTerritorial ? 'Seguridad pública' : 'Seguridad privada'}</div>
              <h1 className="atalaya-serif text-4xl font-semibold">{esTerritorial ? 'Atalaya Territorio' : 'Atalaya Activos'}</h1>
            </div>
          </div>

          <p className="mb-10 max-w-sm text-base leading-7 text-muted-foreground">
            {esTerritorial
              ? 'Analítica criminal y predicción delictual para ciudades más seguras.'
              : 'Gestión de sedes, incidentes, activos críticos y continuidad operacional.'}
          </p>

          <div className="atalaya-panel-soft max-w-sm divide-y divide-border">
            {(esTerritorial
              ? [
                  { label: 'Mapas de calor por cuadrante', code: '01' },
                  { label: 'Predicciones con SEPP + IA', code: '02' },
                  { label: 'Ranking de seguridad comunal', code: '03' },
                  { label: 'Evaluaciones de programas', code: '04' },
                ]
              : [
                  { label: 'Dashboard de sedes e incidentes', code: '01' },
                  { label: 'Fuentes privadas y perfilamiento', code: '02' },
                  { label: 'Riesgo territorial por sede', code: '03' },
                  { label: 'Carga masiva de datos CSV', code: '04' },
                ]
            ).map((f) => (
              <div key={f.label} className="flex items-center gap-4 px-4 py-3">
                <span className={`atalaya-mono text-xs ${esTerritorial ? 'text-primary' : 'text-foreground'}`}>{f.code}</span>
                <span className="text-sm text-muted-foreground">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Panel derecho - formulario */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Back + logo mobile */}
          <div className="mb-6 flex items-center gap-3">
            <button onClick={() => goTo('selector')} className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Cambiar tipo
            </button>
            <div className="ml-auto flex items-center gap-2 lg:hidden">
              <div className={`flex h-7 w-7 items-center justify-center rounded-sm ${esTerritorial ? 'bg-primary' : 'bg-foreground'}`}>
                {esTerritorial ? <Map className="h-4 w-4 text-primary-foreground" /> : <Building2 className="h-4 w-4 text-background" />}
              </div>
              <span className="atalaya-serif text-lg font-semibold">{esTerritorial ? 'Territorio' : 'Activos'}</span>
            </div>
          </div>

          {/* Tabs login / registro */}
          <div className="mb-6 flex rounded-sm border border-border bg-muted p-1">
            <button
              onClick={() => goTo(esTerritorial ? 'territorial_login' : 'organizacion_login')}
              className={`flex-1 rounded-sm py-2.5 text-sm font-medium transition-all ${esLogin ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
            >
              Iniciar sesión
            </button>
            <button
              onClick={() => goTo(esTerritorial ? 'territorial_register' : 'organizacion_register')}
              className={`flex-1 rounded-sm py-2.5 text-sm font-medium transition-all ${!esLogin ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
            >
              Crear cuenta
            </button>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-sm border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* LOGIN */}
          {esLogin && (
            <form onSubmit={(e) => handleLogin(tipo, e)} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Correo electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.cl" required
                    className="w-full rounded-sm border border-border bg-muted py-3 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tu contraseña" required
                    className="w-full rounded-sm border border-border bg-muted py-3 pl-10 pr-12 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading}
                className={`flex w-full items-center justify-center gap-2 rounded-sm py-3 font-medium text-primary-foreground transition-colors disabled:opacity-50 ${esTerritorial ? 'bg-primary hover:bg-primary/90' : 'bg-foreground hover:bg-foreground/90'}`}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? 'Ingresando...' : 'Iniciar sesión'}
              </button>

              <div className="border-t border-border pt-4">
                <p className="mb-3 text-center text-xs text-muted-foreground">Acceso rápido demo</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {(esTerritorial
                    ? [
                        { label: 'Técnico',    email: 'admin@safecity.cl',     pass: 'admin123',     color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
                        { label: 'Autoridad',  email: 'autoridad@safecity.cl', pass: 'autoridad123', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
                        { label: 'Ciudadano',  email: 'ciudadano@safecity.cl', pass: 'ciudadano123', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
                      ]
                    : [
                        { label: 'Empresa',    email: 'empresa@safecity.cl',   pass: 'empresa123',   color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                      ]
                  ).map((d) => (
                    <button key={d.label} type="button" onClick={() => quickLogin(d.email, d.pass)} disabled={loading}
                      className={`rounded-sm border px-3 py-2 text-xs font-medium transition-colors hover:opacity-80 ${d.color}`}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </form>
          )}

          {/* REGISTRO TERRITORIAL */}
          {!esLogin && esTerritorial && (
            <form onSubmit={handleRegisterTerritorial} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Nombre completo</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre" required
                    className="w-full rounded-sm border border-border bg-muted py-3 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Correo electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.cl" required
                    className="w-full rounded-sm border border-border bg-muted py-3 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input type={showPassword ? 'text' : 'password'} value={regPassword} onChange={(e) => setRegPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6}
                    className="w-full rounded-sm border border-border bg-muted py-3 pl-10 pr-12 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Perfil de acceso</label>
                <div className="relative">
                  <button type="button" onClick={() => setRolOpen(!rolOpen)}
                    className="flex w-full items-center justify-between rounded-sm border border-border bg-muted px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                    <span>{ROLES_TERRITORIALES.find((r) => r.value === rol)?.label}</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${rolOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {rolOpen && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-sm border border-border bg-popover shadow-lg">
                      {ROLES_TERRITORIALES.map((r) => (
                        <button key={r.value} type="button" onClick={() => { setRol(r.value); setRolOpen(false); }}
                          className={`w-full px-4 py-3 text-left transition-colors hover:bg-muted ${rol === r.value ? 'bg-muted' : ''}`}>
                          <div className="text-sm font-medium">{r.label}</div>
                          <div className="text-xs text-muted-foreground">{r.desc}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-sm bg-primary py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? 'Creando cuenta...' : 'Crear cuenta municipal'}
              </button>
            </form>
          )}

          {/* REGISTRO ORGANIZACION */}
          {!esLogin && !esTerritorial && (
            <form onSubmit={handleRegisterOrganizacion} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Nombre / Razón social</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Empresa o nombre de contacto" required
                    className="w-full rounded-sm border border-border bg-muted py-3 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Correo electrónico corporativo</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seguridad@empresa.cl" required
                    className="w-full rounded-sm border border-border bg-muted py-3 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input type={showPassword ? 'text' : 'password'} value={regPassword} onChange={(e) => setRegPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6}
                    className="w-full rounded-sm border border-border bg-muted py-3 pl-10 pr-12 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="rounded-sm border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
                La cuenta se crea con perfil <strong>Manager</strong>. Un administrador puede ajustar los permisos posteriormente.
              </div>
              <button type="submit" disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-sm bg-foreground py-3 font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? 'Creando cuenta...' : 'Crear cuenta empresarial'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
