import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Map, Brain, Trophy, Menu, X,
  Shield, ChevronDown, Bell, Settings, LogOut
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
  { path: '/ranking', label: 'Ranking', icon: Trophy, roles: ['ciudadano', 'autoridad', 'tecnico'] },
];

const ROL_COLORS: Record<string, string> = {
  ciudadano: 'bg-green-500/15 text-green-400',
  autoridad: 'bg-blue-500/15 text-blue-400',
  tecnico: 'bg-purple-500/15 text-purple-400',
};

export function Layout({ children, comunas }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [comunaDropdownOpen, setComunaDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedComuna, setSelectedComuna, user, logout } = useAppStore();

  const userRol = user?.rol || 'ciudadano';

  const handleLogout = () => {
    logout();
    // No need to navigate - App.tsx will show LoginPage when isAuthenticated is false
  };

  // Filter nav items by role
  const visibleNav = navItems.filter((item) => item.roles.includes(userRol));

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-300 lg:relative lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
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
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 hover:bg-muted rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Selector de Comuna */}
        <div className="p-4 border-b border-border">
          <label className="text-xs text-muted-foreground uppercase font-semibold">
            Comuna seleccionada
          </label>
          <div className="relative mt-2">
            <button
              onClick={() => setComunaDropdownOpen(!comunaDropdownOpen)}
              className="w-full flex items-center justify-between p-3 bg-muted hover:bg-muted/80 rounded-lg transition-colors"
            >
              <span className="font-medium truncate">
                {selectedComuna?.nombre || 'Seleccionar...'}
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${comunaDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {comunaDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-popover border border-border rounded-lg shadow-lg z-50">
                {comunas.map((comuna) => (
                  <button
                    key={comuna.id}
                    onClick={() => {
                      setSelectedComuna(comuna);
                      setComunaDropdownOpen(false);
                    }}
                    className={`w-full px-4 py-2 text-left hover:bg-muted transition-colors ${
                      selectedComuna?.id === comuna.id ? 'bg-muted font-medium' : ''
                    }`}
                  >
                    <div className="text-sm">{comuna.nombre}</div>
                    <div className="text-xs text-muted-foreground">{comuna.region}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer - User card */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
          <div className="relative">
            {/* User menu popup */}
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

            {/* User button */}
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
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-muted rounded-lg lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-4">
            <button className="relative p-2 hover:bg-muted rounded-lg">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 lg:p-8">
          {children}
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
