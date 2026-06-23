import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Info,
  Loader2,
  MapPin,
  Minus,
  ShieldAlert,
} from 'lucide-react';
import { usePrivadosIncidentes, usePrivadosResumenOperativo, usePrivadosSedes } from '@/hooks/useApi';

const NIVEL_CONFIG = {
  alto: { label: 'RIESGO ALTO', bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-800', dot: 'bg-red-500', bar: 'bg-red-500' },
  medio: { label: 'RIESGO MEDIO', bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500', bar: 'bg-amber-500' },
  bajo: { label: 'RIESGO BAJO', bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500', bar: 'bg-emerald-500' },
};

const ALERTA_CONFIG = {
  alto: 'bg-red-50 border-red-200 text-red-800',
  medio: 'bg-amber-50 border-amber-200 text-amber-800',
  bajo: 'bg-emerald-50 border-emerald-200 text-emerald-800',
};

type NivelRiesgo = keyof typeof NIVEL_CONFIG;

interface RiesgoSede {
  sede_id: number;
  sede_nombre: string;
  sede_direccion: string;
  comuna: string;
  tipo?: string;
  score: number;
  nivel_riesgo: NivelRiesgo;
  tendencia: 'subiendo' | 'bajando' | 'estable';
  cambio_mensual: number;
  total_incidentes_12m: number;
  perdidas_estimadas: number;
  top_tipos: { tipo: string; pct: number }[];
  horas_criticas: string[];
  dias_criticos: string[];
  alertas: { nivel: NivelRiesgo; tipo: string }[];
}

function riskLevel(score: number): NivelRiesgo {
  if (score >= 70) return 'alto';
  if (score >= 35) return 'medio';
  return 'bajo';
}

function TendenciaIcon({ tendencia, cambio }: { tendencia: string; cambio: number }) {
  if (tendencia === 'subiendo') return (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-red-600">
      <ArrowUpRight className="h-4 w-4" />
      +{Math.abs(cambio).toFixed(1)}% este mes
    </span>
  );
  if (tendencia === 'bajando') return (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600">
      <ArrowDownRight className="h-4 w-4" />
      -{Math.abs(cambio).toFixed(1)}% este mes
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
      <Minus className="h-4 w-4" />
      {Math.abs(cambio).toFixed(1)}% este mes
    </span>
  );
}

function ScoreBar({ score, nivel }: { score: number; nivel: NivelRiesgo }) {
  const cfg = NIVEL_CONFIG[nivel];
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="atalaya-mono text-[10px] uppercase text-muted-foreground">Indice de riesgo</span>
        <span className="atalaya-mono text-lg font-bold">{score}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full transition-all ${cfg.bar}`} style={{ width: `${score}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>0</span><span>50</span><span>100</span>
      </div>
    </div>
  );
}

function topValues<T>(items: T[], key: (item: T) => string | null | undefined, limit: number) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const value = key(item) || 'Sin clasificar';
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function buildRiskRows(sedes: any[], incidentes: any[]): RiesgoSede[] {
  return sedes.map((sede) => {
    const ownIncidents = incidentes.filter((incidente) => incidente.sede_id === sede.id);
    const now = Date.now();
    const last30 = ownIncidents.filter((incidente) => {
      const time = new Date(incidente.fecha_hora).getTime();
      return Number.isFinite(time) && now - time <= 30 * 24 * 60 * 60 * 1000;
    }).length;
    const previous30 = ownIncidents.filter((incidente) => {
      const time = new Date(incidente.fecha_hora).getTime();
      return Number.isFinite(time) && now - time > 30 * 24 * 60 * 60 * 1000 && now - time <= 60 * 24 * 60 * 60 * 1000;
    }).length;
    const severidadPromedio = ownIncidents.length
      ? ownIncidents.reduce((sum, incidente) => sum + Number(incidente.severidad || 1), 0) / ownIncidents.length
      : 0;
    const perdidas = ownIncidents.reduce((sum, incidente) => sum + Number(incidente.monto_estimado || 0), 0);
    const score = Math.min(100, Math.round(
      Math.min(45, ownIncidents.length * 8) +
      Math.min(30, severidadPromedio * 6) +
      Math.min(25, perdidas / 120000),
    ));
    const nivel = riskLevel(score);
    const cambio = previous30 ? ((last30 - previous30) / previous30) * 100 : (last30 ? 100 : 0);
    const tendencia: RiesgoSede['tendencia'] = cambio >= 10 ? 'subiendo' : cambio <= -10 ? 'bajando' : 'estable';
    const topTipos = topValues(ownIncidents, (incidente) => incidente.tipo, 4)
      .map((item) => ({ tipo: item.value, pct: ownIncidents.length ? Math.round((item.count / ownIncidents.length) * 100) : 0 }));
    const horas = topValues(ownIncidents, (incidente) => {
      const date = new Date(incidente.fecha_hora);
      return Number.isNaN(date.getTime()) ? null : `${String(date.getHours()).padStart(2, '0')}:00`;
    }, 4).map((item) => item.value);
    const dias = topValues(ownIncidents, (incidente) => {
      const date = new Date(incidente.fecha_hora);
      return Number.isNaN(date.getTime())
        ? null
        : date.toLocaleDateString('es-CL', { weekday: 'long' });
    }, 4).map((item) => item.value);
    const alertas = [
      ...(ownIncidents.some((incidente) => Number(incidente.severidad || 0) >= 4)
        ? [{ nivel: 'alto' as NivelRiesgo, tipo: 'Incidentes severos recientes' }]
        : []),
      ...(perdidas > 0
        ? [{ nivel: nivel, tipo: `Perdidas estimadas ${perdidas.toLocaleString('es-CL')}` }]
        : []),
    ];

    return {
      sede_id: sede.id,
      sede_nombre: sede.nombre,
      sede_direccion: sede.direccion || 'Direccion no cargada',
      comuna: sede.comuna || 'Comuna no cargada',
      tipo: sede.tipo,
      score,
      nivel_riesgo: nivel,
      tendencia,
      cambio_mensual: cambio,
      total_incidentes_12m: ownIncidents.length,
      perdidas_estimadas: perdidas,
      top_tipos: topTipos,
      horas_criticas: horas,
      dias_criticos: dias,
      alertas,
    };
  }).sort((a, b) => b.score - a.score);
}

function SedeCard({ riesgo }: { riesgo: RiesgoSede }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = NIVEL_CONFIG[riesgo.nivel_riesgo];

  return (
    <div className={`overflow-hidden rounded-sm border ${cfg.border} ${cfg.bg}`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
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
              <span className="text-border">-</span>
              <span>{riesgo.comuna}</span>
            </div>

            {riesgo.tipo && (
              <div className="atalaya-mono mt-1 text-[10px] uppercase text-muted-foreground">{riesgo.tipo}</div>
            )}
          </div>

          <div className="hidden w-48 shrink-0 md:block">
            <ScoreBar score={riesgo.score} nivel={riesgo.nivel_riesgo} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-sm border border-border bg-background/60 px-3 py-2">
            <div className="atalaya-mono text-[10px] uppercase text-muted-foreground">Incidentes 12m sede</div>
            <div className="atalaya-mono mt-0.5 text-lg font-bold">{riesgo.total_incidentes_12m.toLocaleString('es-CL')}</div>
          </div>
          <div className="rounded-sm border border-border bg-background/60 px-3 py-2">
            <div className="atalaya-mono text-[10px] uppercase text-muted-foreground">Perdidas estimadas</div>
            <div className="atalaya-mono mt-0.5 text-lg font-bold">${riesgo.perdidas_estimadas.toLocaleString('es-CL')}</div>
          </div>
          <div className="rounded-sm border border-border bg-background/60 px-3 py-2">
            <div className="atalaya-mono text-[10px] uppercase text-muted-foreground">Tipo mas frecuente</div>
            <div className="mt-0.5 text-sm font-medium leading-tight">{riesgo.top_tipos[0]?.tipo || 'Sin incidentes'}</div>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-sm border border-border bg-background/60 p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            {riesgo.total_incidentes_12m
              ? 'Riesgo calculado desde incidentes privados reales, severidad, perdida estimada y recurrencia reciente.'
              : 'Sin incidentes cargados para esta sede; el score queda bajo hasta conectar fuentes operacionales.'}
          </p>
        </div>
      </div>

      <div className="border-t border-border/60 bg-background/30">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between px-5 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="atalaya-mono text-[10px] uppercase tracking-wider">Ver analisis detallado</span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {expanded && (
          <div className="grid grid-cols-1 gap-4 px-5 pb-5 sm:grid-cols-3">
            <div>
              <div className="atalaya-kicker mb-2 flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5" />
                Tipos de incidente
              </div>
              <div className="space-y-2">
                {riesgo.top_tipos.length === 0 && <div className="text-sm text-muted-foreground">Sin clasificacion cargada.</div>}
                {riesgo.top_tipos.map((t) => (
                  <div key={t.tipo}>
                    <div className="mb-0.5 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{t.tipo}</span>
                      <span className="font-medium">{t.pct}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className={`h-full rounded-full ${cfg.bar} opacity-70`} style={{ width: `${t.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="atalaya-kicker mb-2 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Horas criticas
              </div>
              <div className="space-y-1.5">
                {riesgo.horas_criticas.length === 0 && <div className="text-sm text-muted-foreground">Sin hora suficiente.</div>}
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
                Dias criticos
              </div>
              <div className="space-y-1.5">
                {riesgo.dias_criticos.length === 0 && <div className="text-sm text-muted-foreground">Sin patron semanal.</div>}
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
                    <div key={`${a.tipo}-${i}`} className={`flex items-start gap-2 rounded-sm border px-2.5 py-1.5 text-xs ${ALERTA_CONFIG[a.nivel]}`}>
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
  const { data: resumenOperativo, isLoading: loadingResumen, isError: resumenError } = usePrivadosResumenOperativo(365);
  const { data: sedes = [], isLoading: loadingSedes, isError: sedesError } = usePrivadosSedes();
  const { data: incidentes = [], isLoading: loadingIncidentes, isError: incidentesError } = usePrivadosIncidentes(1000);

  const riesgos = useMemo(() => buildRiskRows(sedes as any[], incidentes as any[]), [sedes, incidentes]);
  const altoCount = riesgos.filter((r) => r.nivel_riesgo === 'alto').length;
  const medioCount = riesgos.filter((r) => r.nivel_riesgo === 'medio').length;
  const bajoCount = riesgos.filter((r) => r.nivel_riesgo === 'bajo').length;
  const loading = loadingResumen || loadingSedes || loadingIncidentes;
  const hasError = resumenError || sedesError || incidentesError;
  const resumen = (resumenOperativo as any)?.resumen || {};

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Calculando riesgo territorial desde API...
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="rounded-sm border border-red-200 bg-red-50 p-5 text-sm text-red-800">
        No fue posible leer los datos privados desde la API. La vista no usa datos de respaldo.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="atalaya-serif text-2xl font-semibold">Riesgo Territorial</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Riesgo calculado desde sedes, incidentes privados, severidad y perdidas registradas en backend.
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

      <div className="grid gap-3 text-sm md:grid-cols-3">
        <div className="rounded-sm border border-border bg-card p-3">
          <div className="atalaya-kicker">Sedes</div>
          <div className="atalaya-serif mt-1 text-2xl font-semibold">{Number(resumen.sedes || sedes.length || 0).toLocaleString('es-CL')}</div>
        </div>
        <div className="rounded-sm border border-border bg-card p-3">
          <div className="atalaya-kicker">Incidentes 365d</div>
          <div className="atalaya-serif mt-1 text-2xl font-semibold">{Number(resumen.incidentes || incidentes.length || 0).toLocaleString('es-CL')}</div>
        </div>
        <div className="rounded-sm border border-border bg-card p-3">
          <div className="atalaya-kicker">Geo incidentes</div>
          <div className="atalaya-serif mt-1 text-2xl font-semibold">{Number(resumen.porcentaje_geocodificado || 0).toFixed(1)}%</div>
        </div>
      </div>

      <div className="space-y-4">
        {riesgos.map((riesgo) => (
          <SedeCard key={riesgo.sede_id} riesgo={riesgo} />
        ))}
        {!riesgos.length && (
          <div className="rounded-sm border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Sin sedes privadas cargadas. Importa sedes e incidentes para activar el calculo.
          </div>
        )}
      </div>

      <div className="rounded-sm border border-border bg-muted/40 p-4">
        <div className="atalaya-kicker mb-1">Metodologia</div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          El indice de riesgo combina volumen de incidentes por sede, severidad promedio, perdidas estimadas y cambio de los ultimos 30 dias. No usa datos estaticos ni supuestos de demo.
        </p>
      </div>
    </div>
  );
}
