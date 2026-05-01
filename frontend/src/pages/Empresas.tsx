import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Building2,
  Database,
  FileDown,
  Gauge,
  MapPin,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import {
  useFuentesPrivadasCatalogo,
  usePrivadosIncidentes,
  usePrivadosOrganizaciones,
  usePrivadosResumenOperativo,
  usePrivadosSedes,
} from '@/hooks/useApi';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '');

const VERTICALES = [
  { value: 'retail', label: 'Retail' },
  { value: 'logistica', label: 'Logistica' },
  { value: 'mall', label: 'Mall' },
  { value: 'colegio', label: 'Colegios' },
  { value: 'condominio', label: 'Condominios' },
  { value: 'industria', label: 'Industria' },
  { value: 'clinica', label: 'Clinicas' },
];

const IMPORTADORES = [
  { tipo: 'organizaciones', label: 'Organizaciones' },
  { tipo: 'sedes', label: 'Sedes' },
  { tipo: 'incidentes', label: 'Incidentes' },
];

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

export function EmpresasPage() {
  const queryClient = useQueryClient();
  const [vertical, setVertical] = useState('retail');
  const [uploadingTipo, setUploadingTipo] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const { data: resumenOperativo } = usePrivadosResumenOperativo(365);
  const { data: organizaciones } = usePrivadosOrganizaciones();
  const { data: sedes } = usePrivadosSedes();
  const { data: incidentes } = usePrivadosIncidentes(30);
  const { data: catalogo } = useFuentesPrivadasCatalogo(vertical, 2);

  const orgs = organizaciones || [];
  const sedesPrivadas = sedes || [];
  const incidentesPrivados = incidentes || [];
  const fuentes = catalogo?.fuentes || [];
  const op = resumenOperativo?.resumen || {};
  const sedesGeo = sedesPrivadas.filter((sede: any) => sede.latitud && sede.longitud).length;
  const incidentesGeo = Number(op.incidentes_geocodificados || 0);
  const geocodificacion = percent(incidentesGeo, Number(op.incidentes || 0));
  const severidadPromedio = useMemo(() => {
    if (!incidentesPrivados.length) return 0;
    const total = incidentesPrivados.reduce((acc: number, item: any) => acc + Number(item.severidad || 0), 0);
    return Math.round((total / incidentesPrivados.length) * 10) / 10;
  }, [incidentesPrivados]);

  const plantillaUrl = (tipo: string) => `${API_BASE}/privados/plantillas/${tipo}`;
  const importUrl = (tipo: string) => `${API_BASE}/privados/importar/${tipo}`;

  async function uploadPrivateCsv(tipo: string, file?: File) {
    if (!file) return;

    setUploadingTipo(tipo);
    setImportStatus(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(importUrl(tipo), { method: 'POST', body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || 'No se pudo importar el CSV');
      }

      const errores = data.errores?.length ? `, ${data.errores.length} con error` : '';
      setImportStatus(`${data.insertadas || 0} insertadas, ${data.actualizadas || 0} actualizadas${errores}`);
      queryClient.invalidateQueries({ queryKey: ['privados-resumen-operativo'] });
      queryClient.invalidateQueries({ queryKey: ['privados-organizaciones'] });
      queryClient.invalidateQueries({ queryKey: ['privados-sedes'] });
      queryClient.invalidateQueries({ queryKey: ['privados-incidentes'] });
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : 'No se pudo importar el CSV');
    } finally {
      setUploadingTipo(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="atalaya-kicker mb-2 flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            Modo empresas
          </div>
          <h1 className="atalaya-serif text-2xl font-semibold">Operación privada</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={vertical}
            onChange={(event) => setVertical(event.target.value)}
            className="h-9 rounded-sm border border-border bg-card px-3 text-sm focus:outline-none"
          >
            {VERTICALES.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
          <div className="inline-flex h-9 items-center gap-2 rounded-full bg-accent px-3">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-600" />
            <span className="atalaya-mono text-[10px] uppercase text-muted-foreground">Datos privados</span>
          </div>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-5">
        {[
          ['Organizaciones', orgs.length, Building2],
          ['Sedes', op.sedes ?? 0, MapPin],
          ['Incidentes', Number(op.incidentes || 0).toLocaleString('es-CL'), Activity],
          ['Perdidas', `$${Number(op.perdidas_estimadas || 0).toLocaleString('es-CL')}`, Database],
          ['Severidad prom.', severidadPromedio || '0', Gauge],
        ].map(([label, value, Icon]: any) => (
          <div key={label} className="border border-border bg-card p-4">
            <div className="atalaya-kicker mb-3 flex items-center gap-2">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </div>
            <div className="atalaya-serif text-2xl font-semibold">{value}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <div className="atalaya-kicker">Incidentes recientes</div>
              <div className="text-sm text-muted-foreground">{geocodificacion}% geocodificado en la operación</div>
            </div>
            <div className="atalaya-mono text-xs text-muted-foreground">ultimos 30</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fecha</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tipo</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Zona</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Sev.</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Perdida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {incidentesPrivados.map((incidente: any) => (
                  <tr key={incidente.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground">
                      {incidente.fecha_hora ? new Date(incidente.fecha_hora).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : 'Sin fecha'}
                    </td>
                    <td className="px-4 py-3 font-medium">{incidente.tipo}</td>
                    <td className="px-4 py-3 text-muted-foreground">{incidente.zona || 'Sin zona'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">{incidente.severidad}</span>
                    </td>
                    <td className="px-4 py-3 text-right atalaya-mono">${Number(incidente.monto_estimado || 0).toLocaleString('es-CL')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!incidentesPrivados.length && (
              <div className="p-10 text-center text-sm text-muted-foreground">Carga organizaciones, sedes e incidentes para activar la operación privada.</div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="atalaya-kicker">Carga operacional</div>
              {importStatus && <div className="atalaya-mono text-[10px] text-muted-foreground">{importStatus}</div>}
            </div>
            <div className="space-y-2">
              {IMPORTADORES.map((item) => (
                <div key={item.tipo} className="flex items-center justify-between gap-2 border border-border px-3 py-2">
                  <span className="text-sm font-medium">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <a href={plantillaUrl(item.tipo)} download className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-border px-2 text-xs font-medium hover:bg-muted">
                      <FileDown className="h-3.5 w-3.5" />
                      Plantilla
                    </a>
                    <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-sm bg-foreground px-2 text-xs font-medium text-background hover:opacity-90">
                      <Upload className="h-3.5 w-3.5" />
                      {uploadingTipo === item.tipo ? 'Subiendo' : 'Importar'}
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        disabled={Boolean(uploadingTipo)}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          uploadPrivateCsv(item.tipo, file);
                          event.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-border bg-card p-4">
            <div className="atalaya-kicker mb-3">Calidad de datos</div>
            {[
              ['Sedes geocodificadas', percent(sedesGeo, sedesPrivadas.length)],
              ['Incidentes geocodificados', geocodificacion],
              ['Fuentes priorizadas', fuentes.length ? 100 : 0],
            ].map(([label, value]: any) => (
              <div key={label} className="mb-3 last:mb-0">
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="atalaya-mono">{value}%</span>
                </div>
                <div className="h-1.5 bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <div className="atalaya-kicker">Sedes privadas</div>
            <div className="text-sm text-muted-foreground">{sedesGeo}/{sedesPrivadas.length || 0} con coordenadas</div>
          </div>
          <div className="max-h-[360px] overflow-y-auto divide-y divide-border">
            {sedesPrivadas.slice(0, 16).map((sede: any) => (
              <div key={sede.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <div className="font-medium">{sede.nombre}</div>
                  <div className="text-muted-foreground">{[sede.comuna, sede.region].filter(Boolean).join(', ') || sede.direccion || 'Sin ubicacion'}</div>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${sede.latitud && sede.longitud ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                  {sede.latitud && sede.longitud ? 'Geo' : 'Pendiente'}
                </span>
              </div>
            ))}
            {!sedesPrivadas.length && <div className="px-4 py-8 text-center text-sm text-muted-foreground">Sin sedes cargadas.</div>}
          </div>
        </div>

        <div className="border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <div className="atalaya-kicker">Fuentes prioritarias para {VERTICALES.find((item) => item.value === vertical)?.label}</div>
              <div className="text-sm text-muted-foreground">Datos que conviene pedir al cliente privado</div>
            </div>
            <div className="atalaya-mono text-xs text-muted-foreground">{fuentes.length} fuentes</div>
          </div>
          <div className="divide-y divide-border">
            {fuentes.slice(0, 6).map((fuente: any) => (
              <div key={fuente.id} className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[1fr_90px_80px]">
                <div>
                  <div className="font-medium">{fuente.nombre}</div>
                  <div className="mt-1 text-muted-foreground">{fuente.primer_paso}</div>
                </div>
                <div className="atalaya-mono text-muted-foreground">P{fuente.prioridad}</div>
                <div className="text-right font-semibold">{fuente.valor_predictivo}/100</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
