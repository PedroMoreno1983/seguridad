import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Map, Brain, Trophy, Menu, X, 
  Shield, ChevronDown, User, Bell, Settings 
} from 'lucide-react';
import { useAppStore } from '@/store';
import type { Comuna } from '@/types';

interface LayoutProps {
  children: React.ReactNode;
  comunas: Comuna[];
}

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/mapa', label: 'Mapa de Calor', icon: Map },
  { path: '/predicciones', label: 'Predicciones', icon: Brain },
  { path: '/ranking', label: 'Ranking', icon: Trophy },
];

export function Layout({ children, comunas }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [comunaDropdownOpen, setComunaDropdownOpen] = useState(false);
  const location = useLocation();
  const { selectedComuna, setSelectedComuna, user } = useAppStore();

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
          {navItems.map((item) => {
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

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <User className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.nombre}</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.rol}</p>
            </div>
            <button className="p-2 hover:bg-muted rounded-lg">
              <Settings className="h-4 w-4 text-muted-foreground" />
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
