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
import { useComunas } from '@/hooks/useApi';

interface LoginPageProps {
  onLogin: (token: string, user: any) => void;
}

type Pantalla = 'selector' | 'territorial_login' | 'territorial_register' | 'organizacion_login' | 'organizacion_register';
type RolTerritorial = 'ciudadano' | 'autoridad' | 'tecnico';

const ROLES_TERRITORIALES: { value: RolTerritorial; label: string; desc: string }[] = [
  { value: 'ciudadano', label: 'Ciudadano', desc: 'Consulta de datos y mapas públicos' },
  { value: 'autoridad', label: 'Autoridad', desc: 'Gestion territorial, predicciones y reportes' },
  { value: 'tecnico', label: 'Técnico', desc: 'Administración y modelos analíticos' },
];

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

async function apiLogin(email: string, password: string): Promise<{ access_token: string; user: any }> {
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
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Error al registrar');
    return data;
  } catch (err: any) {
    if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
      throw new Error('No se puede conectar al servidor');
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
  const [comunaId, setComunaId] = useState('');
  const { data: comunas, isLoading: loadingComunas, isError: comunasError } = useComunas();

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setNombre('');
    setRegPassword('');
    setRol('ciudadano');
    setComunaId('');
    setError('');
    setShowPassword(false);
  };

  const goTo = (p: Pantalla) => {
    resetForm();
    setPantalla(p);
  };

  const handleLogin = async (tipo: 'territorial' | 'organizacion', e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiLogin(email, password);
      const user = { ...data.user, tipo_usuario: data.user?.tipo_usuario ?? tipo };
      const destino = user.tipo_usuario === 'organizacion' ? '/activos' : '/territorio';
      onLogin(data.access_token, user);
      window.location.assign(destino);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterTerritorial = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (regPassword.length < 8) {
      setError('La contrasena debe tener al menos 8 caracteres');
      return;
    }
    const selectedComunaId = Number(comunaId);
    if (!selectedComunaId) {
      setError('Selecciona la comuna asociada a la cuenta');
      return;
    }
    setLoading(true);
    try {
      const data = await apiRegister({
        nombre,
        email,
        password: regPassword,
        tipo_usuario: 'territorial',
        rol,
        comuna_id: selectedComunaId,
      });
      onLogin(data.access_token, { ...data.user, tipo_usuario: 'territorial' });
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
    if (regPassword.length < 8) {
      setError('La contrasena debe tener al menos 8 caracteres');
      return;
    }
    setLoading(true);
    try {
      const data = await apiRegister({ nombre, email, password: regPassword, tipo_usuario: 'organizacion', rol: 'manager' });
      onLogin(data.access_token, { ...data.user, tipo_usuario: 'organizacion' });
      window.location.assign('/activos');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
            <h1 className="atalaya-serif text-4xl font-semibold">Que operacion gestionas</h1>
          </div>

          <div className="grid w-full max-w-2xl gap-4 md:grid-cols-2">
            <button
              onClick={() => goTo('territorial_login')}
              className="group flex flex-col gap-4 rounded-sm border border-border bg-card p-6 text-left transition-colors hover:border-primary hover:bg-muted/50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-primary">
                <Map className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <div className="atalaya-kicker mb-1 text-primary">Seguridad publica</div>
                <h2 className="atalaya-serif text-2xl font-semibold">Acceso Municipal</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Municipalidades, comunas, mapas delictuales, prediccion territorial y participacion ciudadana.
                </p>
              </div>
            </button>

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
                  Retail, logistica, salud, educacion y condominios. Gestion de sedes, incidentes y activos criticos.
                </p>
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

  return (
    <div className="flex min-h-screen bg-background">
      <div className="relative hidden border-r border-border md:flex md:w-[42%] xl:w-2/5">
        <div className={`absolute inset-0 ${esTerritorial ? 'bg-primary/5' : 'bg-foreground/5'}`} />
        <div className="relative flex flex-col justify-center px-8 xl:px-12">
          <div className="mb-8 flex items-center gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-sm ${esTerritorial ? 'bg-primary' : 'bg-foreground'}`}>
              {esTerritorial ? <Map className="h-7 w-7 text-primary-foreground" /> : <Building2 className="h-7 w-7 text-background" />}
            </div>
            <div>
              <div className="atalaya-kicker">{esTerritorial ? 'Seguridad publica' : 'Seguridad privada'}</div>
              <h1 className="atalaya-serif text-4xl font-semibold">{esTerritorial ? 'Atalaya Territorio' : 'Atalaya Activos'}</h1>
            </div>
          </div>

          <p className="mb-10 max-w-sm text-base leading-7 text-muted-foreground">
            {esTerritorial
              ? 'Analitica territorial para anticipar riesgos, priorizar recursos y respaldar decisiones publicas.'
              : 'Gestion de sedes, incidentes, activos criticos y continuidad operacional.'}
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-muted/20 p-4 sm:p-6">
        <div className="w-full max-w-[460px] rounded-sm border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <button onClick={() => goTo('selector')} className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Cambiar tipo
            </button>
            <div className="ml-auto flex items-center gap-2 md:hidden">
              <div className={`flex h-7 w-7 items-center justify-center rounded-sm ${esTerritorial ? 'bg-primary' : 'bg-foreground'}`}>
                {esTerritorial ? <Map className="h-4 w-4 text-primary-foreground" /> : <Building2 className="h-4 w-4 text-background" />}
              </div>
              <span className="atalaya-serif text-lg font-semibold">{esTerritorial ? 'Territorio' : 'Activos'}</span>
            </div>
          </div>

          <div className="mb-5">
            <div className={`atalaya-kicker mb-1 ${esTerritorial ? 'text-primary' : 'text-foreground'}`}>
              {esTerritorial ? 'Seguridad publica' : 'Seguridad privada'}
            </div>
            <h2 className="atalaya-serif text-3xl font-semibold tracking-normal">
              {esTerritorial ? 'Acceso municipal' : 'Acceso empresarial'}
            </h2>
          </div>

          <div className="mb-6 flex rounded-sm border border-border bg-muted p-1">
            <button
              onClick={() => goTo(esTerritorial ? 'territorial_login' : 'organizacion_login')}
              className={`flex-1 rounded-sm py-2.5 text-sm font-medium transition-all ${esLogin ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
            >
              Iniciar sesion
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
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {esLogin ? (
            <div className="space-y-4">
              <form onSubmit={(e) => handleLogin(tipo, e)} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Correo electronico</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@correo.cl"
                      required
                      className="w-full rounded-sm border border-border bg-background py-3 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Tu contrasena"
                      required
                      className="w-full rounded-sm border border-border bg-background py-3 pl-10 pr-12 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className={`flex w-full items-center justify-center gap-2 rounded-sm py-3 font-medium text-primary-foreground transition-colors disabled:opacity-50 ${esTerritorial ? 'bg-primary hover:bg-primary/90' : 'bg-foreground hover:bg-foreground/90'}`}
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? 'Ingresando...' : 'Iniciar sesion'}
                </button>
              </form>
            </div>
          ) : esTerritorial ? (
            <form onSubmit={handleRegisterTerritorial} className="space-y-4">
              <CommonRegisterFields
                nombre={nombre}
                setNombre={setNombre}
                email={email}
                setEmail={setEmail}
                password={regPassword}
                setPassword={setRegPassword}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
              />
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Comuna</label>
                <div className="relative">
                  <Map className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <select
                    value={comunaId}
                    onChange={(e) => setComunaId(e.target.value)}
                    required
                    disabled={loadingComunas || comunasError}
                    className="w-full appearance-none rounded-sm border border-border bg-muted py-3 pl-10 pr-10 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">
                      {loadingComunas
                        ? 'Cargando comunas...'
                        : comunasError
                          ? 'No fue posible cargar comunas'
                          : 'Selecciona una comuna'}
                    </option>
                    {(comunas || []).map((comuna) => (
                      <option key={comuna.id} value={comuna.id}>
                        {comuna.nombre}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Perfil de acceso</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setRolOpen(!rolOpen)}
                    className="flex w-full items-center justify-between rounded-sm border border-border bg-muted px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <span>{ROLES_TERRITORIALES.find((r) => r.value === rol)?.label}</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${rolOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {rolOpen && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-sm border border-border bg-popover shadow-lg">
                      {ROLES_TERRITORIALES.map((r) => (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => {
                            setRol(r.value);
                            setRolOpen(false);
                          }}
                          className={`w-full px-4 py-3 text-left transition-colors hover:bg-muted ${rol === r.value ? 'bg-muted' : ''}`}
                        >
                          <div className="text-sm font-medium">{r.label}</div>
                          <div className="text-xs text-muted-foreground">{r.desc}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <SubmitButton loading={loading || loadingComunas} label="Crear cuenta municipal" />
            </form>
          ) : (
            <form onSubmit={handleRegisterOrganizacion} className="space-y-4">
              <CommonRegisterFields
                nombre={nombre}
                setNombre={setNombre}
                email={email}
                setEmail={setEmail}
                password={regPassword}
                setPassword={setRegPassword}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
                org
              />
              <div className="rounded-sm border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
                La cuenta se crea con perfil Manager. Un administrador puede ajustar los permisos posteriormente.
              </div>
              <SubmitButton loading={loading} label="Crear cuenta empresarial" dark />
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function CommonRegisterFields({
  nombre,
  setNombre,
  email,
  setEmail,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  org = false,
}: {
  nombre: string;
  setNombre: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  org?: boolean;
}) {
  return (
    <>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{org ? 'Nombre / razon social' : 'Nombre completo'}</label>
        <div className="relative">
          {org ? <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /> : <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />}
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={org ? 'Empresa o contacto' : 'Tu nombre'}
            required
            className="w-full rounded-sm border border-border bg-muted py-3 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Correo electronico</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={org ? 'seguridad@empresa.cl' : 'tu@correo.cl'}
            required
            className="w-full rounded-sm border border-border bg-muted py-3 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Contraseña</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimo 8 caracteres"
            required
            minLength={8}
            className="w-full rounded-sm border border-border bg-muted py-3 pl-10 pr-12 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </>
  );
}

function SubmitButton({ loading, label, dark = false }: { loading: boolean; label: string; dark?: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className={`flex w-full items-center justify-center gap-2 rounded-sm py-3 font-medium transition-colors disabled:opacity-50 ${dark ? 'bg-foreground text-background hover:bg-foreground/90' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {loading ? 'Creando cuenta...' : label}
    </button>
  );
}
