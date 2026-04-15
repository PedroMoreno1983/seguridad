import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Map, Brain, Trophy, Menu, X,
  Shield, ChevronDown, Bell, Settings, LogOut,
  AlertTriangle, TrendingDown, MapPin, Info,
  Users, Target
} from 'lucide-react';
import { useAppStore } from '@/store';
import type { Comuna } from '@/types';

interface LayoutProps {
  children: React.ReactNode;
  comunas: Comuna[];
}

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ciudadano', 'autoridad', 'tecnico'] },
  { path: '/mapa', label: 'Mapa de Calor', icon: Map, roles: ['ciudadano', 'autoridad', 'tecnico'] },
  { path: '/predicciones', label: 'Predicciones', icon: Brain, roles: ['autoridad', 'tecnico'] },
  { path: '/participacion', label: 'Participación', icon: Users, roles: ['ciudadano', 'autoridad', 'tecnico'] },
  { path: '/evaluaciones', label: 'Evaluaciones', icon: Target, roles: ['autoridad', 'tecnico'] },
  { path: '/ranking', label: 'Ranking', icon: Trophy, roles: ['ciudadano', 'autoridad', 'tecnico'] },
];

const ROL_COLORS: Record<string, string> = {
  ciudadano: 'bg-green-500/15 text-green-400',
  autoridad: 'bg-blue-500/15 text-blue-400',
  tecnico: 'bg-purple-500/15 text-purple-400',
};

// Notificaciones simuladas por rol
function getNotificaciones(rol: string, comuna: string) {
  const base = [
    { id: 1, icon: TrendingDown, color: 'text-green-400', titulo: 'Tendencia a la baja', desc: `Los incidentes en ${comuna} bajaron un 9.7% este mes`, tiempo: 'Hace 2h', leida: false },
    { id: 2, icon: AlertTriangle, color: 'text-orange-400', titulo: 'Zona de riesgo detectada', desc: `Se identificó una nueva zona de riesgo alto en ${comuna}`, tiempo: 'Hace 5h', leida: false },
    { id: 3, icon: MapPin, color: 'text-blue-400', titulo: 'Datos actualizados', desc: 'Se cargaron nuevos registros del sistema 1461', tiempo: 'Ayer', leida: true },
  ];
  if (rol === 'tecnico') {
    base.push({ id: 4, icon: Info, color: 'text-purple-400', titulo: 'Modelo reentrenado', desc: 'SEPP ha sido reentrenado con datos recientes', tiempo: 'Hace 1d', leida: true });
  }
  if (rol === 'autoridad' || rol === 'tecnico') {
    base.push({ id: 5, icon: Brain, color: 'text-cyan-400', titulo: 'Nueva predicción lista', desc: `Predicción a 72h generada para ${comuna}`, tiempo: 'Hace 3h', leida: false });
  }
  return base;
}

export function Layout({ children, comunas }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [comunaDropdownOpen, setComunaDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [leidas, setLeidas] = useState<Set<number>>(new Set());
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedComuna, setSelectedComuna, user, logout } = useAppStore();

  const userRol = user?.rol || 'ciudadano';
  const notificaciones = getNotificaciones(userRol, selectedComuna?.nombre || 'la comuna');
  const noLeidas = notificaciones.filter(n => !n.leida && !leidas.has(n.id)).length;

  const handleLogout = () => {
    logout();
  };

  const marcarLeidas = () => {
    setLeidas(new Set(notificaciones.map(n => n.id)));
  };

  const visibleNav = navItems.filter((item) => item.roles.includes(userRol));

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-300 lg:relative lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-border">
          <Link to="/" className="flex items-center gap-3">
            <div className="p-2 bg-primary rounded-lg">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">SafeCity</h1>
              <p className="text-xs text-muted-foreground">Analytics</p>
            </div>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 hover:bg-muted rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 border-b border-border">
          <label className="text-xs text-muted-foreground uppercase font-semibold">Comuna seleccionada</label>
          <div className="relative mt-2">
            <button
              onClick={() => setComunaDropdownOpen(!comunaDropdownOpen)}
              className="w-full flex items-center justify-between p-3 bg-muted hover:bg-muted/80 rounded-lg transition-colors"
            >
              <span className="font-medium truncate">{selectedComuna?.nombre || 'Seleccionar...'}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${comunaDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {comunaDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-popover border border-border rounded-lg shadow-lg z-50">
                {comunas.map((comuna) => (
                  <button
                    key={comuna.id}
                    onClick={() => { setSelectedComuna(comuna); setComunaDropdownOpen(false); }}
                    className={`w-full px-4 py-2 text-left hover:bg-muted transition-colors ${selectedComuna?.id === comuna.id ? 'bg-muted font-medium' : ''}`}
                  >
                    <div className="text-sm">{comuna.nombre}</div>
                    <div className="text-xs text-muted-foreground">{comuna.region}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <nav className="p-4 space-y-1">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
          <div className="relative">
            {userMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-popover border border-border rounded-xl shadow-xl overflow-hidden z-50">
                <div className="p-3 border-b border-border">
                  <p className="text-sm font-medium">{user?.nombre}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                  <span className={`inline-block mt-1.5 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${ROL_COLORS[userRol]}`}>
                    {userRol}
                  </span>
                </div>
                <button
                  onClick={() => { navigate('/configuracion'); setUserMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Settings className="h-4 w-4" />
                  Configuración
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar sesión
                </button>
              </div>
            )}
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                {user?.nombre?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium truncate">{user?.nombre}</p>
                <span className={`inline-block text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full ${ROL_COLORS[userRol]}`}>
                  {userRol}
                </span>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-4 lg:px-8">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-muted rounded-lg lg:hidden">
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-4 ml-auto">
            {/* Campana de notificaciones */}
            <div className="relative">
              <button
                onClick={() => { setBellOpen(!bellOpen); if (!bellOpen) marcarLeidas(); }}
                className="relative p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <Bell className="h-5 w-5 text-muted-foreground" />
                {noLeidas > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
                    {noLeidas}
                  </span>
                )}
              </button>

              {bellOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setBellOpen(false)} />
                  <div className="absolute right-0 sm:-right-2 top-full mt-2 w-72 sm:w-80 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden" style={{ backgroundColor: 'hsl(var(--card))' }}>
                    <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Notificaciones</h3>
                      <span className="text-xs text-muted-foreground">{notificaciones.length} total</span>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notificaciones.map((n) => {
                        const NIcon = n.icon;
                        const esLeida = n.leida || leidas.has(n.id);
                        return (
                          <div key={n.id} className={`px-4 py-3 border-b border-border/50 hover:bg-muted/50 transition-colors ${esLeida ? 'opacity-60' : ''}`}>
                            <div className="flex gap-3">
                              <NIcon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${n.color}`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{n.titulo}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{n.desc}</p>
                                <p className="text-[10px] text-muted-foreground mt-1">{n.tiempo}</p>
                              </div>
                              {!esLeida && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-8">
          {children}
        </main>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
}
