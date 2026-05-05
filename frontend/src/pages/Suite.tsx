import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  Fingerprint,
  Lock,
  Map,
  RadioTower,
  Shield,
  Siren,
} from 'lucide-react';
import { useAppStore } from '@/store';
import type { TipoUsuario } from '@/types';

const products: { path: string; tipo: TipoUsuario; name: string; label: string; description: string; signal: string; accent: string; Icon: any; metrics: string[] }[] = [
  {
    path: '/territorio',
    tipo: 'territorial',
    name: 'Atalaya Territorio',
    label: 'Seguridad publica',
    description: 'Comunas, mapas delictuales, prediccion territorial, patrullaje y participacion ciudadana.',
    signal: 'Comuna activa',
    accent: 'bg-primary',
    Icon: Map,
    metrics: ['Mapas KDE', 'Prediccion 72h', 'Cuadrantes', 'Evaluaciones'],
  },
  {
    path: '/activos',
    tipo: 'organizacion',
    name: 'Atalaya Activos',
    label: 'Seguridad privada',
    description: 'Organizaciones, sedes, activos criticos, perdidas, continuidad operacional y perfilamiento.',
    signal: 'Organizacion activa',
    accent: 'bg-foreground',
    Icon: Building2,
    metrics: ['Sedes', 'Incidentes', 'Fuentes privadas', 'Perfilamiento'],
  },
];

export function SuitePage() {
  const navigate = useNavigate();
  const { user } = useAppStore();
  const tipoUsuario = user?.tipo_usuario ?? 'territorial';

  const handleSelect = (product: typeof products[number]) => {
    if (product.tipo !== tipoUsuario) return;
    navigate(product.path);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card px-5 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-foreground">
              <Shield className="h-5 w-5 text-background" />
            </div>
            <div>
              <div className="atalaya-serif text-xl font-semibold leading-none">Atalaya Suite</div>
              <div className="atalaya-kicker text-[9px]">Centro de mando</div>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full bg-accent px-3 py-1.5 md:inline-flex">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-600" />
            <span className="atalaya-mono text-[10px] uppercase text-muted-foreground">Dos lineas operativas</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8">
        <section className="grid gap-8 lg:grid-cols-[420px_minmax(0,1fr)]">
          <div className="flex flex-col justify-between border border-border bg-card p-6">
            <div>
              <div className="atalaya-kicker mb-4 flex items-center gap-2">
                <RadioTower className="h-3.5 w-3.5" />
                Seleccion de producto
              </div>
              <h1 className="atalaya-serif text-4xl font-semibold leading-tight">
                Una plataforma, dos operaciones separadas.
              </h1>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                Territorio trabaja seguridad publica y comunal. Activos trabaja seguridad privada,
                sedes, perdidas y continuidad operacional. Comparten inteligencia, pero no mezclan
                contexto ni navegacion.
              </p>
            </div>

            <div className="mt-8 grid gap-3 text-sm">
              <div className="flex items-center gap-3 border border-border bg-muted p-3">
                <Siren className="h-4 w-4 text-primary" />
                <span>El usuario entra primero por el tipo de operacion.</span>
              </div>
              <div className="flex items-center gap-3 border border-border bg-muted p-3">
                <Fingerprint className="h-4 w-4 text-primary" />
                <span>El perfilamiento vive dentro de Activos, como etapa de configuracion.</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {products.map((product) => {
              const Icon = product.Icon;
              const permitido = product.tipo === tipoUsuario;
              return (
                <button
                  key={product.path}
                  onClick={() => handleSelect(product)}
                  disabled={!permitido}
                  className={`group relative flex min-h-[520px] flex-col justify-between border border-border bg-card p-5 text-left transition-colors ${
                    permitido ? 'hover:bg-muted/50 cursor-pointer' : 'opacity-60 cursor-not-allowed'
                  }`}
                >
                  {!permitido && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-card/80 backdrop-blur-[2px]">
                      <Lock className="h-8 w-8 text-muted-foreground" />
                      <p className="atalaya-kicker text-center text-muted-foreground">
                        {product.tipo === 'organizacion' ? 'Solo para cuentas empresariales' : 'Solo para cuentas municipales'}
                      </p>
                    </div>
                  )}
                  <div>
                    <div className="mb-5 flex items-center justify-between">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-sm ${product.accent}`}>
                        <Icon className="h-6 w-6 text-background" />
                      </div>
                      {permitido && <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground" />}
                    </div>
                    <div className="atalaya-kicker mb-2">{product.label}</div>
                    <h2 className="atalaya-serif text-3xl font-semibold">{product.name}</h2>
                    <p className="mt-4 leading-7 text-muted-foreground">{product.description}</p>
                  </div>

                  <div>
                    <div className="mb-4 border border-border bg-background p-3">
                      <div className="atalaya-kicker mb-1">Contexto principal</div>
                      <div className="atalaya-serif text-lg font-medium">{product.signal}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {product.metrics.map((metric) => (
                        <div key={metric} className="border border-border bg-background px-3 py-2 text-sm">
                          {metric}
                        </div>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
