import { useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronDown,
  Database,
  Fingerprint,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Shield,
  Upload,
  X,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { usePrivadosOrganizaciones } from '@/hooks/useApi';

interface ActivosLayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/activos', label: 'Briefing', group: 'Operacion', icon: LayoutDashboard },
  { path: '/activos/perfilamiento', label: 'Perfilamiento', group: 'Configuracion', icon: Fingerprint },
  { path: '/activos/fuentes', label: 'Fuentes', group: 'Datos', icon: Database },
  { path: '/activos/carga', label: 'Carga CSV', group: 'Datos', icon: Upload },
];

export function ActivosLayout({ children }: ActivosLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [orgOpen, setOrgOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAppStore();
  const { data: organizaciones } = usePrivadosOrganizaciones();
  const orgs = organizaciones || [];
  const activeOrg = orgs[0];
  const activeRoute = navItems.find((item) => item.path === location.pathname) ?? navItems[0];
  const groupedNav = ['Operacion', 'Configuracion', 'Datos']
    .map((group) => ({ group, items: navItems.filter((item) => item.group === group) }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="relative flex h-screen bg-background">
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-border bg-card transition-transform duration-300 lg:relative lg:translate-x-0 ${
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
              <div className="atalaya-kicker text-[9px]">Activos · v2.4</div>
            </div>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="rounded-sm p-1 hover:bg-muted lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-border p-3">
          <div className="atalaya-kicker px-1">Organizacion activa</div>
          <div className="relative mt-2">
            <button
              onClick={() => setOrgOpen(!orgOpen)}
              className="flex w-full items-center justify-between rounded-sm border border-border bg-muted p-2.5 text-left transition-colors hover:bg-muted/80"
            >
              <div className="min-w-0">
                <div className="atalaya-serif truncate text-base font-medium">{activeOrg?.nombre || 'Sin organizacion'}</div>
                <div className="atalaya-mono text-[10px] text-muted-foreground">{activeOrg?.vertical || 'Perfilamiento pendiente'}</div>
              </div>
              <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${orgOpen ? 'rotate-180' : ''}`} />
            </button>
            {orgOpen && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-sm border border-border bg-popover shadow-lg">
                {orgs.length ? orgs.map((org: any) => (
                  <button key={org.id} className="w-full px-3 py-2 text-left transition-colors hover:bg-muted">
                    <div className="text-sm">{org.nombre}</div>
                    <div className="atalaya-mono text-[10px] text-muted-foreground">{org.vertical}</div>
                  </button>
                )) : (
                  <div className="px-3 py-3 text-sm text-muted-foreground">Carga una organizacion para activar cartera.</div>
                )}
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
          <div className="relative">
            {userMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-sm border border-border bg-popover shadow-xl">
                <button
                  onClick={() => {
                    navigate('/activos/configuracion');
                    setUserMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  Configuracion
                </button>
                <button onClick={logout} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-700 transition-colors hover:bg-red-50">
                  <LogOut className="h-4 w-4" />
                  Cerrar sesion
                </button>
              </div>
            )}
            <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="flex w-full items-center gap-3 rounded-sm p-2 text-left transition-colors hover:bg-muted">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                {user?.nombre?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{user?.nombre}</p>
                <span className="atalaya-mono text-[10px] uppercase text-muted-foreground">{user?.rol || 'usuario'}</span>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 lg:px-6">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="rounded-sm p-2 hover:bg-muted lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden items-center gap-4 md:flex">
            <div className="atalaya-mono text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
              ACTIVOS
              <span className="mx-2 text-border">/</span>
              {(activeRoute?.label || 'Briefing').toUpperCase()}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-accent px-2.5 py-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-600" />
              <span className="atalaya-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">Datos privados</span>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden h-8 w-72 items-center gap-2 rounded-sm border border-border bg-background px-2.5 text-muted-foreground lg:flex">
              <Search className="h-3.5 w-3.5" />
              <span className="text-sm">Buscar sede, incidente, activo...</span>
            </div>
            <button className="rounded-sm p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <Bell className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
}
