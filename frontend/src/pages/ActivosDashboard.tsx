import {
  Activity,
  Building2,
  Database,
  Fingerprint,
  Gauge,
  MapPin,
} from 'lucide-react';
import {
  usePrivadosIncidentes,
  usePrivadosOrganizaciones,
  usePrivadosResumenOperativo,
  usePrivadosSedes,
} from '@/hooks/useApi';

export function ActivosDashboardPage() {
  const { data: resumenOperativo } = usePrivadosResumenOperativo(365);
  const { data: organizaciones } = usePrivadosOrganizaciones();
  const { data: sedes } = usePrivadosSedes();
  const { data: incidentes } = usePrivadosIncidentes(20);
  const op = resumenOperativo?.resumen || {};
  const orgs = organizaciones || [];
  const sedesPrivadas = sedes || [];
  const incidentesPrivados = incidentes || [];
  const sedesGeo = sedesPrivadas.filter((sede: any) => sede.latitud && sede.longitud).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="atalaya-kicker mb-2 flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5" />
            Atalaya Activos
          </div>
          <h1 className="atalaya-serif text-2xl font-semibold">Briefing de seguridad privada</h1>
        </div>
        <div className="inline-flex h-9 items-center gap-2 rounded-full bg-accent px-3">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-600" />
          <span className="atalaya-mono text-[10px] uppercase text-muted-foreground">Operacion patrimonial</span>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-5">
        {[
          ['Organizaciones', orgs.length, Building2],
          ['Sedes', op.sedes ?? 0, MapPin],
          ['Incidentes 365d', Number(op.incidentes || 0).toLocaleString('es-CL'), Activity],
          ['Perdidas', `$${Number(op.perdidas_estimadas || 0).toLocaleString('es-CL')}`, Database],
          ['Geo sedes', `${sedesGeo}/${sedesPrivadas.length || 0}`, Gauge],
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
              <div className="text-sm text-muted-foreground">Operacion privada cargada por CSV o integraciones.</div>
            </div>
            <div className="atalaya-mono text-xs text-muted-foreground">ultimos 20</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
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
                    <td className="px-4 py-3 text-center">{incidente.severidad}</td>
                    <td className="px-4 py-3 text-right atalaya-mono">${Number(incidente.monto_estimado || 0).toLocaleString('es-CL')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!incidentesPrivados.length && (
              <div className="p-10 text-center text-sm text-muted-foreground">Usa Perfilamiento para definir la operacion y Carga CSV para activar datos.</div>
            )}
          </div>
        </div>

        <div className="border border-border bg-card p-4">
          <div className="atalaya-kicker mb-3 flex items-center gap-2">
            <Fingerprint className="h-3.5 w-3.5" />
            Siguiente accion
          </div>
          <div className="atalaya-serif text-xl font-semibold">Perfilar la operacion</div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Selecciona el tipo de organizacion, identifica activos criticos y define las fuentes
            minimas antes de pedir integraciones.
          </p>
        </div>
      </section>
    </div>
  );
}
