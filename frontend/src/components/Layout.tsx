import { useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  Brain,
  ChevronDown,
  Info,
  LayoutDashboard,
  LogOut,
  Map,
  MapPin,
  Menu,
  Minimize,
  MonitorPlay,
  Search,
  Settings,
  Shield,
  Target,
  TrendingDown,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { useAppStore } from '@/store';
import type { Comuna } from '@/types';

interface LayoutProps {
  children: ReactNode;
  comunas: Comuna[];
}

const navItems = [
  { path: '/dashboard', label: 'Briefing', group: 'Vistazo', icon: LayoutDashboard, roles: ['ciudadano', 'autoridad', 'tecnico'] },
  { path: '/mapa', label: 'Mapa', group: 'Analisis', icon: Map, roles: ['ciudadano', 'autoridad', 'tecnico'] },
  { path: '/predicciones', label: 'Predicciones', group: 'Analisis', icon: Brain, roles: ['autoridad', 'tecnico'] },
  { path: '/ranking', label: 'Comparativa', group: 'Analisis', icon: Trophy, roles: ['ciudadano', 'autoridad', 'tecnico'] },
  { path: '/evaluaciones', label: 'Evaluaciones', group: 'Accion', icon: Target, roles: ['autoridad', 'tecnico'] },
  { path: '/participacion', label: 'Participacion', group: 'Comunidad', icon: Users, roles: ['ciudadano', 'autoridad', 'tecnico'] },
];

const roleLabels: Record<string, string> = {
  ciudadano: 'Ciudadania',
  autoridad: 'Autoridad',
  tecnico: 'Tecnico',
};

const rolePills: Record<string, string> = {
  ciudadano: 'bg-green-50 text-green-700 border-green-200',
  autoridad: 'bg-blue-50 text-blue-700 border-blue-200',
  tecnico: 'bg-purple-50 text-purple-700 border-purple-200',
};

function getNotificaciones(rol: string, comuna: string) {
  const base = [
    { id: 1, icon: TrendingDown, color: 'text-green-700', titulo: 'Tendencia a la baja', desc: `Los incidentes en ${comuna} bajaron un 9.7% este mes`, tiempo: 'Hace 2h', leida: false },
    { id: 2, icon: AlertTriangle, color: 'text-orange-700', titulo: 'Zona de riesgo detectada', desc: `Se identifico una nueva zona de riesgo alto en ${comuna}`, tiempo: 'Hace 5h', leida: false },
    { id: 3, icon: MapPin, color: 'text-blue-700', titulo: 'Datos actualizados', desc: 'Se cargaron nuevos registros del sistema 1461', tiempo: 'Ayer', leida: true },
  ];
  if (rol === 'tecnico') {
    base.push({ id: 4, icon: Info, color: 'text-purple-700', titulo: 'Modelo reentrenado', desc: 'SEPP fue reentrenado con datos recientes', tiempo: 'Hace 1d', leida: true });
  }
  if (rol === 'autoridad' || rol === 'tecnico') {
    base.push({ id: 5, icon: Brain, color: 'text-cyan-700', titulo: 'Nueva prediccion lista', desc: `Prediccion a 72h generada para ${comuna}`, tiempo: 'Hace 3h', leida: false });
  }
  return base;
}

export function Layout({ children, comunas }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [comunaDropdownOpen, setComunaDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [leidas, setLeidas] = useState<Set<number>>(new Set());
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedComuna, setSelectedComuna, user, logout } = useAppStore();

  const userRol = user?.rol || 'ciudadano';
  const visibleNav = navItems.filter((item) => item.roles.includes(userRol));
  const activeRoute = visibleNav.find((item) => item.path === location.pathname) ?? visibleNav[0];
  const groupedNav = ['Vistazo', 'Analisis', 'Accion', 'Comunidad']
    .map((group) => ({ group, items: visibleNav.filter((item) => item.group === group) }))
    .filter((section) => section.items.length > 0);
  const notificaciones = getNotificaciones(userRol, selectedComuna?.nombre || 'la comuna');
  const noLeidas = notificaciones.filter((n) => !n.leida && !leidas.has(n.id)).length;

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
      setPresentationMode(true);
    } else {
      document.exitFullscreen?.();
      setPresentationMode(false);
    }
  };

  const marcarLeidas = () => {
    setLeidas(new Set(notificaciones.map((n) => n.id)));
  };

  return (
    <div className="relative flex h-screen bg-background">
      {!presentationMode && (
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-[232px] flex-col border-r border-border bg-card transition-transform duration-300 lg:relative lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-14 items-center justify-between border-b border-border px-4">
            <Link to="/" className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-foreground">
                <Shield className="h-4 w-4 text-background" />
              </div>
              <div>
                <div className="atalaya-serif text-lg font-semibold leading-none">Atalaya</div>
                <div className="atalaya-kicker text-[9px]">Plataforma · v2.4</div>
              </div>
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="rounded-sm p-1 hover:bg-muted lg:hidden">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="border-b border-border p-3">
            <div className="atalaya-kicker px-1">Comuna activa</div>
            <div className="relative mt-2">
              <button
                onClick={() => setComunaDropdownOpen(!comunaDropdownOpen)}
                className="flex w-full items-center justify-between rounded-sm border border-border bg-muted p-2.5 text-left transition-colors hover:bg-muted/80"
              >
                <div className="min-w-0">
                  <div className="atalaya-serif truncate text-base font-medium">{selectedComuna?.nombre || 'Seleccionar...'}</div>
                  <div className="atalaya-mono text-[10px] text-muted-foreground">{selectedComuna?.region || 'Region'}</div>
                </div>
                <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${comunaDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {comunaDropdownOpen && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-sm border border-border bg-popover shadow-lg">
                  {comunas.map((comuna) => (
                    <button
                      key={comuna.id}
                      onClick={() => {
                        setSelectedComuna(comuna);
                        setComunaDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left transition-colors hover:bg-muted ${selectedComuna?.id === comuna.id ? 'bg-muted font-medium' : ''}`}
                    >
                      <div className="text-sm">{comuna.nombre}</div>
                      <div className="atalaya-mono text-[10px] text-muted-foreground">{comuna.region}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto p-2">
            <div className="space-y-4">
              {groupedNav.map((section) => (
                <div key={section.group}>
                  <div className="atalaya-kicker px-2 pb-1 text-[9px]">{section.group}</div>
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = location.pathname === item.path;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={`flex items-center gap-2.5 rounded-sm border-l-2 px-3 py-2 text-sm transition-all ${
                            isActive
                              ? 'border-l-primary bg-muted font-medium text-foreground'
                              : 'border-l-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </nav>

          <div className="border-t border-border p-3">
            <div className="atalaya-kicker mb-2 px-1">Rol activo</div>
            <div className="relative">
              {userMenuOpen && (
                <div className="absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-sm border border-border bg-popover shadow-xl">
                  <div className="border-b border-border p-3">
                    <p className="text-sm font-medium">{user?.nombre}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                    <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${rolePills[userRol]}`}>
                      {roleLabels[userRol] ?? userRol}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      navigate('/configuracion');
                      setUserMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Settings className="h-4 w-4" />
                    Configuracion
                  </button>
                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-700 transition-colors hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Cerrar sesion
                  </button>
                </div>
              )}
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex w-full items-center gap-3 rounded-sm p-2 text-left transition-colors hover:bg-muted"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                  {user?.nombre?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{user?.nombre}</p>
                  <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${rolePills[userRol]}`}>
                    {roleLabels[userRol] ?? userRol}
                  </span>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
        </aside>
      )}

      <div className="relative flex min-w-0 flex-1 flex-col">
        {!presentationMode && (
          <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 lg:px-6">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="rounded-sm p-2 hover:bg-muted lg:hidden">
              <Menu className="h-5 w-5" />
            </button>

            <div className="hidden items-center gap-4 md:flex">
              <div className="atalaya-mono text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
                {(selectedComuna?.nombre || 'Comuna').toUpperCase()}
                <span className="mx-2 text-border">/</span>
                {(activeRoute?.label || 'Briefing').toUpperCase()}
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-accent px-2.5 py-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-600" />
                <span className="atalaya-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">Datos en vivo · 14:32</span>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <div className="hidden h-8 w-72 items-center gap-2 rounded-sm border border-border bg-background px-2.5 text-muted-foreground lg:flex">
                <Search className="h-3.5 w-3.5" />
                <span className="text-sm">Buscar incidente, caso, sector...</span>
                <span className="atalaya-mono ml-auto rounded border border-border px-1 text-[10px]">⌘K</span>
              </div>

              <div className="relative">
                <button
                  onClick={() => {
                    setBellOpen(!bellOpen);
                    if (!bellOpen) marcarLeidas();
                  }}
                  className="relative rounded-sm p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Bell className="h-5 w-5" />
                  {noLeidas > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                      {noLeidas}
                    </span>
                  )}
                </button>
                {bellOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setBellOpen(false)} />
                    <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-sm border border-border bg-card shadow-2xl">
                      <div className="flex items-center justify-between border-b border-border px-4 py-3">
                        <h3 className="text-sm font-semibold">Notificaciones</h3>
                        <span className="atalaya-mono text-[10px] text-muted-foreground">{notificaciones.length} total</span>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notificaciones.map((n) => {
                          const NIcon = n.icon;
                          const esLeida = n.leida || leidas.has(n.id);
                          return (
                            <div key={n.id} className={`border-b border-border/70 px-4 py-3 transition-colors hover:bg-muted ${esLeida ? 'opacity-60' : ''}`}>
                              <div className="flex gap-3">
                                <NIcon className={`mt-0.5 h-4 w-4 shrink-0 ${n.color}`} />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium">{n.titulo}</p>
                                  <p className="mt-0.5 text-xs text-muted-foreground">{n.desc}</p>
                                  <p className="atalaya-mono mt-1 text-[10px] text-muted-foreground">{n.tiempo}</p>
                                </div>
                                {!esLeida && <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {(userRol === 'autoridad' || userRol === 'tecnico') && (
                <button
                  onClick={toggleFullscreen}
                  title="Modo TV / Presentacion"
                  className="rounded-sm p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <MonitorPlay className="h-5 w-5" />
                </button>
              )}
            </div>
          </header>
        )}

        {presentationMode && (
          <button
            onClick={toggleFullscreen}
            className="fixed right-4 top-4 z-[9999] rounded-full bg-black/70 p-3 text-white shadow-2xl backdrop-blur-md transition-all hover:bg-black/90"
            title="Salir de modo presentacion"
          >
            <Minimize className="h-5 w-5" />
          </button>
        )}

        <main className={`flex-1 overflow-auto ${presentationMode ? 'p-0' : 'p-4 lg:p-6'}`}>
          {children}
        </main>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
}
