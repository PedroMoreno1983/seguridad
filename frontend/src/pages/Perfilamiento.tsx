import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Database,
  Fingerprint,
  Gauge,
  Layers,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import {
  useFuentesPrivadasCatalogo,
  usePrivadosIncidentes,
  usePrivadosOrganizaciones,
  usePrivadosResumenOperativo,
  usePrivadosSedes,
} from '@/hooks/useApi';

const PERFILES = [
  {
    id: 'municipal',
    nombre: 'Municipalidad',
    categoria: 'Publico',
    foco: 'Territorio, denuncias, patrullaje, factores urbanos y prevencion comunitaria.',
    activos: ['Cuadrantes', 'Espacios publicos', 'Luminarias', 'Equipamiento municipal', 'Ferias y barrios comerciales'],
    riesgos: ['Robo en lugar habitado', 'Violencia intrafamiliar', 'Incivilidades', 'Robo de vehiculo', 'Puntos sin luminaria'],
    datos: ['Delitos georreferenciados', 'Patrullajes', 'Luminarias', 'Denuncias vecinales', 'Camaras municipales'],
    playbook: ['Normalizar comunas y sectores', 'Medir cobertura georreferenciada', 'Cruzar delitos con entorno urbano', 'Priorizar cuadrantes de patrullaje'],
  },
  {
    id: 'retail',
    nombre: 'Retail',
    categoria: 'Privado',
    foco: 'Perdidas, hurto, seguridad de tiendas, cajas, bodegas y turnos criticos.',
    activos: ['Sala de ventas', 'Cajas', 'Bodega', 'Camaras CCTV', 'Alarmas', 'Guardias'],
    riesgos: ['Hurto hormiga', 'Robo violento', 'Merma interna', 'Aglomeracion', 'Puntos ciegos CCTV'],
    datos: ['POS', 'Merma', 'Bitacora guardias', 'CCTV', 'Control de acceso', 'Turnos'],
    playbook: ['Perfilar tiendas por perdida', 'Mapear zonas internas', 'Conectar POS y bitacoras', 'Comparar turnos con incidentes'],
  },
  {
    id: 'logistica',
    nombre: 'Logistica',
    categoria: 'Privado',
    foco: 'Rutas, centros de distribucion, patios, andenes y continuidad operacional.',
    activos: ['CD', 'Patio', 'Andenes', 'Rutas', 'Flota', 'GPS'],
    riesgos: ['Robo de carga', 'Intrusion', 'Desvio de ruta', 'Sustraccion interna', 'Detencion no programada'],
    datos: ['GPS flota', 'WMS/TMS', 'Control de acceso', 'Bitacoras', 'CCTV patio'],
    playbook: ['Perfilar rutas recurrentes', 'Cruzar detenciones con delitos', 'Priorizar patios y andenes', 'Crear alertas por desvio'],
  },
  {
    id: 'condominio',
    nombre: 'Condominio',
    categoria: 'Privado',
    foco: 'Accesos, visitas, espacios comunes, rondas y convivencia segura.',
    activos: ['Accesos', 'Conserjeria', 'Estacionamientos', 'Espacios comunes', 'Camaras'],
    riesgos: ['Intrusion', 'Robo en estacionamiento', 'Conflictos', 'Fallas de control de visitas', 'Puntos sin cobertura'],
    datos: ['Control visitas', 'Rondas', 'CCTV', 'Reclamos', 'Incidentes internos'],
    playbook: ['Mapear accesos y puntos ciegos', 'Registrar rondas', 'Clasificar incidentes internos', 'Priorizar horarios de intrusion'],
  },
  {
    id: 'colegio',
    nombre: 'Colegio',
    categoria: 'Privado',
    foco: 'Ingreso y salida, convivencia, entorno escolar y protocolos de respuesta.',
    activos: ['Accesos', 'Patios', 'Salas', 'Perimetro', 'Transporte escolar'],
    riesgos: ['Riñas', 'Intrusion', 'Acoso', 'Entorno inseguro', 'Emergencias medicas'],
    datos: ['Bitacora convivencia', 'Control acceso', 'CCTV', 'Asistencia', 'Reportes apoderados'],
    playbook: ['Perfilar horarios de entrada y salida', 'Cruzar entorno con incidentes', 'Medir recurrencia por zona', 'Definir protocolos de escalamiento'],
  },
  {
    id: 'industria',
    nombre: 'Industria',
    categoria: 'Privado',
    foco: 'Continuidad operacional, perimetro, turnos, activos criticos y seguridad patrimonial.',
    activos: ['Perimetro', 'Bodegas', 'Maquinaria', 'Accesos', 'Zonas restringidas'],
    riesgos: ['Intrusion', 'Robo de insumos', 'Sabotaje', 'Acceso no autorizado', 'Incidentes por turno'],
    datos: ['Control acceso', 'Sensores', 'CCTV', 'Turnos', 'Inventario critico'],
    playbook: ['Clasificar activos criticos', 'Perfilar accesos por turno', 'Cruzar sensores con rondas', 'Priorizar zonas restringidas'],
  },
];

const ESCALAS = [
  { value: 'baja', label: 'Baja', score: 18 },
  { value: 'media', label: 'Media', score: 28 },
  { value: 'alta', label: 'Alta', score: 38 },
];

const MADUREZ = [
  { value: 'inicial', label: 'Inicial', score: 16 },
  { value: 'operativa', label: 'Operativa', score: 30 },
  { value: 'integrada', label: 'Integrada', score: 42 },
];

function pct(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

export function PerfilamientoPage() {
  const [perfilId, setPerfilId] = useState('retail');
  const [escala, setEscala] = useState('media');
  const [madurez, setMadurez] = useState('inicial');
  const perfil = PERFILES.find((item) => item.id === perfilId) || PERFILES[0];

  const { data: catalogo } = useFuentesPrivadasCatalogo(perfil.id === 'municipal' ? 'retail' : perfil.id, 2);
  const { data: resumenOperativo } = usePrivadosResumenOperativo(365);
  const { data: organizaciones } = usePrivadosOrganizaciones();
  const { data: sedes } = usePrivadosSedes();
  const { data: incidentes } = usePrivadosIncidentes(20);

  const fuentes = perfil.id === 'municipal' ? [] : (catalogo?.fuentes || []);
  const orgs = organizaciones || [];
  const sedesPrivadas = sedes || [];
  const incidentesPrivados = incidentes || [];
  const op = resumenOperativo?.resumen || {};
  const sedesGeo = sedesPrivadas.filter((sede: any) => sede.latitud && sede.longitud).length;
  const escalaScore = ESCALAS.find((item) => item.value === escala)?.score || 28;
  const madurezScore = MADUREZ.find((item) => item.value === madurez)?.score || 16;
  const datosScore = Math.min(30, (orgs.length ? 8 : 0) + (sedesPrivadas.length ? 10 : 0) + (incidentesPrivados.length ? 12 : 0));
  const perfilScore = Math.min(100, escalaScore + madurezScore + datosScore);

  const recomendacion = useMemo(() => {
    if (perfilScore < 45) return 'Levantamiento base';
    if (perfilScore < 75) return 'Integracion priorizada';
    return 'Modelo predictivo';
  }, [perfilScore]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="atalaya-kicker mb-2 flex items-center gap-2">
            <Fingerprint className="h-3.5 w-3.5" />
            Perfilamiento operacional
          </div>
          <h1 className="atalaya-serif text-2xl font-semibold">Diseñar el perfil de seguridad</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={perfilId}
            onChange={(event) => setPerfilId(event.target.value)}
            className="h-9 rounded-sm border border-border bg-card px-3 text-sm focus:outline-none"
          >
            {PERFILES.map((item) => (
              <option key={item.id} value={item.id}>{item.nombre}</option>
            ))}
          </select>
          <select
            value={escala}
            onChange={(event) => setEscala(event.target.value)}
            className="h-9 rounded-sm border border-border bg-card px-3 text-sm focus:outline-none"
          >
            {ESCALAS.map((item) => (
              <option key={item.value} value={item.value}>Escala {item.label}</option>
            ))}
          </select>
          <select
            value={madurez}
            onChange={(event) => setMadurez(event.target.value)}
            className="h-9 rounded-sm border border-border bg-card px-3 text-sm focus:outline-none"
          >
            {MADUREZ.map((item) => (
              <option key={item.value} value={item.value}>Madurez {item.label}</option>
            ))}
          </select>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        {[
          ['Perfil', perfil.nombre, Building2],
          ['Nivel', `${perfilScore}/100`, Gauge],
          ['Ruta sugerida', recomendacion, ShieldCheck],
          ['Datos cargados', `${orgs.length + sedesPrivadas.length + incidentesPrivados.length}`, Database],
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
        <div className="border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <div className="atalaya-kicker">Perfil base</div>
            <div className="text-sm text-muted-foreground">{perfil.foco}</div>
          </div>
          <div className="grid gap-0 divide-y divide-border lg:grid-cols-3 lg:divide-x lg:divide-y-0">
            <div className="p-4">
              <div className="atalaya-kicker mb-3 flex items-center gap-2">
                <Layers className="h-3.5 w-3.5" />
                Activos
              </div>
              <div className="flex flex-wrap gap-1.5">
                {perfil.activos.map((item) => (
                  <span key={item} className="rounded-sm bg-muted px-2 py-1 text-xs">{item}</span>
                ))}
              </div>
            </div>
            <div className="p-4">
              <div className="atalaya-kicker mb-3 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                Riesgos
              </div>
              <div className="space-y-2">
                {perfil.riesgos.map((item) => (
                  <div key={item} className="text-sm text-muted-foreground">{item}</div>
                ))}
              </div>
            </div>
            <div className="p-4">
              <div className="atalaya-kicker mb-3 flex items-center gap-2">
                <Database className="h-3.5 w-3.5" />
                Datos necesarios
              </div>
              <div className="space-y-2">
                {perfil.datos.map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-700" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="border border-border bg-card p-4">
          <div className="atalaya-kicker mb-3">Calidad disponible</div>
          {[
            ['Organizaciones', orgs.length ? 100 : 0],
            ['Sedes geocodificadas', pct(sedesGeo, sedesPrivadas.length)],
            ['Incidentes geocodificados', Number(op.porcentaje_geocodificado || 0)],
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
      </section>

      <section className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <div className="atalaya-kicker">Playbook de perfilamiento</div>
          </div>
          <div className="divide-y divide-border">
            {perfil.playbook.map((paso, index) => (
              <div key={paso} className="flex gap-3 px-4 py-3 text-sm">
                <span className="atalaya-mono flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px]">
                  {index + 1}
                </span>
                <span>{paso}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <div className="atalaya-kicker">Fuentes priorizadas</div>
              <div className="text-sm text-muted-foreground">Insumos recomendados segun el perfil seleccionado</div>
            </div>
            <div className="atalaya-mono text-xs text-muted-foreground">{fuentes.length || perfil.datos.length} fuentes</div>
          </div>
          <div className="divide-y divide-border">
            {(fuentes.length ? fuentes.slice(0, 6) : perfil.datos.map((dato, index) => ({
              id: dato,
              nombre: dato,
              primer_paso: 'Levantar disponibilidad, formato, responsable y frecuencia de actualizacion.',
              prioridad: index + 1,
              valor_predictivo: 70 - index * 4,
            }))).map((fuente: any) => (
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

      <section className="grid gap-3 md:grid-cols-3">
        <div className="border border-border bg-card p-4">
          <div className="atalaya-kicker mb-2 flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5" />
            Siguiente carga
          </div>
          <div className="text-sm text-muted-foreground">Organizacion, sedes o zonas operativas, incidentes historicos y coordenadas.</div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="atalaya-kicker mb-2">Primer entregable</div>
          <div className="text-sm text-muted-foreground">Ficha de riesgo por zona, matriz de fuentes y plan de integracion por prioridad.</div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="atalaya-kicker mb-2">Decision comercial</div>
          <div className="text-sm text-muted-foreground">Determinar si el perfil requiere solo carga CSV, integracion API o modelo predictivo.</div>
        </div>
      </section>
    </div>
  );
}
