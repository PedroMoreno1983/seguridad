import { useState } from 'react';
import { RIESGO_TERRITORIAL, STATIC_SEDES } from '@/data/realDataActivos';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Info,
  MapPin,
  Minus,
  ShieldAlert,
} from 'lucide-react';

const NIVEL_CONFIG = {
  alto:  { label: 'RIESGO ALTO',  bg: 'bg-red-50',     border: 'border-red-200',    badge: 'bg-red-100 text-red-800',    dot: 'bg-red-500',    bar: 'bg-red-500'    },
  medio: { label: 'RIESGO MEDIO', bg: 'bg-amber-50',   border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500',  bar: 'bg-amber-500'  },
  bajo:  { label: 'RIESGO BAJO',  bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500', bar: 'bg-emerald-500' },
};

const ALERTA_CONFIG = {
  alto:  'bg-red-50 border-red-200 text-red-800',
  medio: 'bg-amber-50 border-amber-200 text-amber-800',
  bajo:  'bg-emerald-50 border-emerald-200 text-emerald-800',
};

function TendenciaIcon({ tendencia, cambio }: { tendencia: string; cambio: number }) {
  if (tendencia === 'subiendo') return (
    <span className="inline-flex items-center gap-1 text-red-600 text-sm font-medium">
      <ArrowUpRight className="h-4 w-4" />
      +{Math.abs(cambio).toFixed(1)}% este mes
    </span>
  );
  if (tendencia === 'bajando') return (
    <span className="inline-flex items-center gap-1 text-emerald-600 text-sm font-medium">
      <ArrowDownRight className="h-4 w-4" />
      -{Math.abs(cambio).toFixed(1)}% este mes
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground text-sm">
      <Minus className="h-4 w-4" />
      {Math.abs(cambio).toFixed(1)}% este mes
    </span>
  );
}

function ScoreBar({ score, nivel }: { score: number; nivel: keyof typeof NIVEL_CONFIG }) {
  const cfg = NIVEL_CONFIG[nivel];
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="atalaya-mono text-[10px] uppercase text-muted-foreground">Índice de riesgo</span>
        <span className="atalaya-mono text-lg font-bold">{score}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${cfg.bar}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>0</span><span>50</span><span>100</span>
      </div>
    </div>
  );
}

function SedeCard({ riesgo }: { riesgo: typeof RIESGO_TERRITORIAL[number] }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = NIVEL_CONFIG[riesgo.nivel_riesgo];
  const sede = STATIC_SEDES.find((s) => s.id === riesgo.sede_id);

  return (
    <div className={`rounded-sm border ${cfg.border} ${cfg.bg} overflow-hidden`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wider ${cfg.badge}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </span>
              <TendenciaIcon tendencia={riesgo.tendencia} cambio={riesgo.cambio_mensual} />
            </div>

            <h3 className="atalaya-serif mt-2 text-xl font-semibold leading-tight">{riesgo.sede_nombre}</h3>
            <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span>{riesgo.sede_direccion}</span>
              <span className="text-border">·</span>
              <span>{riesgo.comuna}</span>
            </div>

            {sede?.tipo && (
              <div className="atalaya-mono mt-1 text-[10px] uppercase text-muted-foreground">{sede.tipo}</div>
            )}
          </div>

          <div className="hidden w-48 shrink-0 md:block">
            <ScoreBar score={riesgo.score} nivel={riesgo.nivel_riesgo} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-sm border border-border bg-background/60 px-3 py-2">
            <div className="atalaya-mono text-[10px] uppercase text-muted-foreground">Incidentes 12m (comuna)</div>
            <div className="atalaya-mono mt-0.5 text-lg font-bold">{riesgo.total_incidentes_12m.toLocaleString('es-CL')}</div>
          </div>
          <div className="rounded-sm border border-border bg-background/60 px-3 py-2">
            <div className="atalaya-mono text-[10px] uppercase text-muted-foreground">Tasa / 100k hab.</div>
            <div className="atalaya-mono mt-0.5 text-lg font-bold">{riesgo.tasa_100k.toLocaleString('es-CL')}</div>
          </div>
          <div className="rounded-sm border border-border bg-background/60 px-3 py-2">
            <div className="atalaya-mono text-[10px] uppercase text-muted-foreground">Tipo más frecuente</div>
            <div className="mt-0.5 text-sm font-medium leading-tight">{riesgo.top_tipos[0]?.tipo}</div>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-sm border border-border bg-background/60 p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground leading-relaxed">{riesgo.recomendacion}</p>
        </div>
      </div>

      <div className="border-t border-border/60 bg-background/30">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between px-5 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="atalaya-mono text-[10px] uppercase tracking-wider">Ver análisis detallado</span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {expanded && (
          <div className="grid grid-cols-1 gap-4 px-5 pb-5 sm:grid-cols-3">
            <div>
              <div className="atalaya-kicker mb-2 flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5" />
                Tipos de delito
              </div>
              <div className="space-y-2">
                {riesgo.top_tipos.map((t) => (
                  <div key={t.tipo}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="text-muted-foreground">{t.tipo}</span>
                      <span className="font-medium">{t.pct}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full ${cfg.bar} opacity-70`} style={{ width: `${t.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="atalaya-kicker mb-2 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Horas críticas
              </div>
              <div className="space-y-1.5">
                {riesgo.horas_criticas.map((h) => (
                  <div key={h} className="flex items-center gap-2 rounded-sm border border-border bg-background/60 px-2.5 py-1.5 text-sm">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    {h}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="atalaya-kicker mb-2 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Días críticos
              </div>
              <div className="space-y-1.5">
                {riesgo.dias_criticos.map((d) => (
                  <div key={d} className="flex items-center gap-2 rounded-sm border border-border bg-background/60 px-2.5 py-1.5 text-sm">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    {d}
                  </div>
                ))}
              </div>
              {riesgo.alertas.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {riesgo.alertas.map((a, i) => (
                    <div key={i} className={`flex items-start gap-2 rounded-sm border px-2.5 py-1.5 text-xs ${ALERTA_CONFIG[a.nivel as keyof typeof ALERTA_CONFIG]}`}>
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      {a.tipo}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function RiesgoTerritorialPage() {
  const altoCount  = RIESGO_TERRITORIAL.filter((r) => r.nivel_riesgo === 'alto').length;
  const medioCount = RIESGO_TERRITORIAL.filter((r) => r.nivel_riesgo === 'medio').length;
  const bajoCount  = RIESGO_TERRITORIAL.filter((r) => r.nivel_riesgo === 'bajo').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="atalaya-serif text-2xl font-semibold">Riesgo Territorial</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cruce de datos delictuales comunales con ubicaciones de sus sedes. Fuente: CEAD/CIPER — últimos 12 meses.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-sm border border-red-200 bg-red-50 p-4 text-center">
          <div className="atalaya-mono text-2xl font-bold text-red-700">{altoCount}</div>
          <div className="atalaya-mono mt-1 text-[10px] uppercase text-red-600">Riesgo alto</div>
        </div>
        <div className="rounded-sm border border-amber-200 bg-amber-50 p-4 text-center">
          <div className="atalaya-mono text-2xl font-bold text-amber-700">{medioCount}</div>
          <div className="atalaya-mono mt-1 text-[10px] uppercase text-amber-600">Riesgo medio</div>
        </div>
        <div className="rounded-sm border border-emerald-200 bg-emerald-50 p-4 text-center">
          <div className="atalaya-mono text-2xl font-bold text-emerald-700">{bajoCount}</div>
          <div className="atalaya-mono mt-1 text-[10px] uppercase text-emerald-600">Riesgo bajo</div>
        </div>
      </div>

      <div className="space-y-4">
        {RIESGO_TERRITORIAL.sort((a, b) => b.score - a.score).map((r) => (
          <SedeCard key={r.sede_id} riesgo={r} />
        ))}
      </div>

      <div className="rounded-sm border border-border bg-muted/40 p-4">
        <div className="atalaya-kicker mb-1">Metodología</div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          El índice de riesgo (0–100) combina la tasa de delitos por 100.000 habitantes de la comuna,
          la tendencia mensual y la tipología delictual relevante para el tipo de instalación.
          Los datos comunales provienen de registros policiales procesados por el CEAD.
          Este módulo no reemplaza un análisis de amenaza personalizado.
        </p>
      </div>
    </div>
  );
}
