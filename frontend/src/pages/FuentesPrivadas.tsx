import { useMemo, useState } from 'react';
import {
  Activity,
  Briefcase,
  Database,
  FileDown,
  Filter,
  Gauge,
  Layers,
  Plug,
  ShieldCheck,
} from 'lucide-react';
import {
  useFuentesPrivadasCatalogo,
  useFuentesPrivadasPlaybook,
  useFuentesPrivadasResumen,
} from '@/hooks/useApi';

const VERTICALES = [
  { value: 'retail', label: 'Retail' },
  { value: 'logistica', label: 'Logistica' },
  { value: 'mall', label: 'Mall' },
  { value: 'colegio', label: 'Colegios' },
  { value: 'condominio', label: 'Condominios' },
  { value: 'industria', label: 'Industria' },
  { value: 'clinica', label: 'Clinicas' },
];

const dificultadClass: Record<string, string> = {
  baja: 'border-green-200 bg-green-50 text-green-800',
  media: 'border-amber-200 bg-amber-50 text-amber-800',
  alta: 'border-red-200 bg-red-50 text-red-800',
};

function exportCatalogCsv(fuentes: any[], vertical: string) {
  if (!fuentes.length) return;
  const rows = [
    ['Fuente', 'Tipo', 'Prioridad', 'Valor predictivo', 'Dificultad', 'Frecuencia', 'Primer paso'],
    ...fuentes.map((f) => [
      f.nombre,
      f.tipo,
      String(f.prioridad),
      String(f.valor_predictivo),
      f.dificultad,
      f.frecuencia_recomendada,
      f.primer_paso,
    ]),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `atalaya_fuentes_privadas_${vertical}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function FuentesPrivadasPage() {
  const [vertical, setVertical] = useState('retail');
  const [prioridadMax, setPrioridadMax] = useState(2);

  const { data: resumen, isLoading: loadingResumen } = useFuentesPrivadasResumen();
  const { data: catalogo, isLoading: loadingCatalogo } = useFuentesPrivadasCatalogo(vertical, prioridadMax);
  const { data: playbook } = useFuentesPrivadasPlaybook(vertical);

  const fuentes = catalogo?.fuentes || [];
  const avgPredictivo = useMemo(() => {
    if (!fuentes.length) return 0;
    return Math.round(fuentes.reduce((acc: number, f: any) => acc + Number(f.valor_predictivo || 0), 0) / fuentes.length);
  }, [fuentes]);

  const prioridadCounts = resumen?.por_prioridad || {};
  const tipoCounts = resumen?.por_tipo || {};

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="atalaya-kicker mb-2 flex items-center gap-2">
            <Briefcase className="h-3.5 w-3.5" />
            Seguridad privada
          </div>
          <h1 className="atalaya-serif text-2xl font-semibold">Fuentes privadas</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-sm border border-border bg-card px-3 py-2 text-sm">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={vertical}
              onChange={(event) => setVertical(event.target.value)}
              className="bg-transparent focus:outline-none"
            >
              {VERTICALES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-sm border border-border bg-card px-3 py-2 text-sm">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <select
              value={prioridadMax}
              onChange={(event) => setPrioridadMax(Number(event.target.value))}
              className="bg-transparent focus:outline-none"
            >
              <option value={1}>Prioridad 1</option>
              <option value={2}>Prioridad 1-2</option>
              <option value={3}>Prioridad 1-3</option>
            </select>
          </label>
          <button
            onClick={() => exportCatalogCsv(fuentes, vertical)}
            disabled={!fuentes.length}
            className="inline-flex items-center gap-2 rounded-sm border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <FileDown className="h-4 w-4" />
            CSV
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="border border-border bg-card p-4">
          <div className="atalaya-kicker mb-3 flex items-center gap-2">
            <Database className="h-3.5 w-3.5" />
            Total catalogo
          </div>
          <div className="atalaya-serif text-3xl font-semibold">{loadingResumen ? '...' : resumen?.total_fuentes || 0}</div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="atalaya-kicker mb-3 flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            Fuentes filtradas
          </div>
          <div className="atalaya-serif text-3xl font-semibold">{loadingCatalogo ? '...' : catalogo?.total || 0}</div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="atalaya-kicker mb-3 flex items-center gap-2">
            <Gauge className="h-3.5 w-3.5" />
            Valor promedio
          </div>
          <div className="atalaya-serif text-3xl font-semibold">{avgPredictivo}<span className="text-base text-muted-foreground">/100</span></div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="atalaya-kicker mb-3 flex items-center gap-2">
            <Activity className="h-3.5 w-3.5" />
            Prioridad 1
          </div>
          <div className="atalaya-serif text-3xl font-semibold">{prioridadCounts['1'] || 0}</div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="overflow-hidden border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <div className="atalaya-kicker">Matriz priorizada</div>
              <div className="text-sm text-muted-foreground">{VERTICALES.find((v) => v.value === vertical)?.label || vertical}</div>
            </div>
            <div className="atalaya-mono text-xs text-muted-foreground">{fuentes.length} fuentes</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fuente</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Datos clave</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Integracion</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Valor</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Prioridad</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Primer paso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {fuentes.map((fuente: any) => (
                  <tr key={fuente.id} className="align-top hover:bg-muted/30">
                    <td className="px-4 py-4">
                      <div className="font-medium">{fuente.nombre}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="atalaya-mono text-[10px] uppercase text-muted-foreground">{fuente.tipo}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${dificultadClass[fuente.dificultad] || dificultadClass.media}`}>
                          {fuente.dificultad}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">
                      <div className="flex max-w-[260px] flex-wrap gap-1">
                        {fuente.datos_clave.slice(0, 5).map((dato: string) => (
                          <span key={dato} className="rounded-sm bg-muted px-1.5 py-0.5 text-[11px]">{dato}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1">
                        {fuente.integracion.map((tipo: string) => (
                          <span key={tipo} className="rounded-sm border border-border px-1.5 py-0.5 text-[11px]">{tipo}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="atalaya-serif text-lg font-semibold">{fuente.valor_predictivo}</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                        {fuente.prioridad}
                      </span>
                    </td>
                    <td className="max-w-[320px] px-4 py-4 text-muted-foreground">{fuente.primer_paso}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!loadingCatalogo && fuentes.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">Sin fuentes para los filtros activos.</div>
          )}
        </div>

        <aside className="space-y-5">
          <div className="border border-border bg-card p-4">
            <div className="atalaya-kicker mb-3 flex items-center gap-2">
              <Plug className="h-3.5 w-3.5" />
              Playbook
            </div>
            <div className="space-y-3">
              {(playbook?.pasos || []).map((paso: string, index: number) => (
                <div key={paso} className="flex gap-3 text-sm">
                  <span className="atalaya-mono flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px]">
                    {index + 1}
                  </span>
                  <span>{paso}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-border bg-card p-4">
            <div className="atalaya-kicker mb-3">Tipos de fuente</div>
            <div className="space-y-2">
              {Object.entries(tipoCounts).map(([tipo, total]) => (
                <div key={tipo} className="flex items-center justify-between gap-3 text-sm">
                  <span className="capitalize text-muted-foreground">{tipo.replace('_', ' ')}</span>
                  <span className="atalaya-mono">{String(total)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-border bg-card p-4">
            <div className="atalaya-kicker mb-3">Fuentes prioritarias</div>
            <div className="space-y-3">
              {(playbook?.fuentes_prioritarias || []).slice(0, 4).map((fuente: any) => (
                <div key={fuente.id} className="border-t border-border pt-3 first:border-t-0 first:pt-0">
                  <div className="text-sm font-medium">{fuente.nombre}</div>
                  <div className="atalaya-mono mt-1 text-[10px] uppercase text-muted-foreground">
                    P{fuente.prioridad} · valor {fuente.valor_predictivo}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
