import { useState } from 'react';
import { useAppStore } from '@/store';
import { useDashboardResumen, useComunas } from '@/hooks/useApi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingDown, TrendingUp, Minus, Shield, AlertTriangle, Users, MapPin, Activity, Info, X } from 'lucide-react';

const DEMO_PENALOLEN = {
  comuna: { id: 22, nombre: 'Peñalolén', poblacion: 241599, superficie_km2: 54.3 },
  estadisticas_delitos: {
    total_ultimos_12m: 3847,
    tasa_100k: 1592,
    evolucion_mensual: [
      { mes: 1, anio: 2024, cantidad: 310 }, { mes: 2, anio: 2024, cantidad: 295 },
      { mes: 3, anio: 2024, cantidad: 328 }, { mes: 4, anio: 2024, cantidad: 312 },
      { mes: 5, anio: 2024, cantidad: 340 }, { mes: 6, anio: 2024, cantidad: 318 },
      { mes: 7, anio: 2024, cantidad: 298 }, { mes: 8, anio: 2024, cantidad: 325 },
      { mes: 9, anio: 2024, cantidad: 307 }, { mes: 10, anio: 2024, cantidad: 289 },
      { mes: 11, anio: 2024, cantidad: 276 }, { mes: 12, anio: 2024, cantidad: 249 },
    ],
    top_5_tipos: [
      { tipo: 'Robo con violencia', cantidad: 842 },
      { tipo: 'Hurto', cantidad: 1105 },
      { tipo: 'Robo en lugar habitado', cantidad: 634 },
      { tipo: 'Lesiones', cantidad: 521 },
      { tipo: 'Robo de vehículo', cantidad: 388 },
    ],
  },
  tendencias: { direccion: 'bajando', cambio_mensual_porcentaje: -9.7, delitos_mes_actual: 249, delitos_mes_anterior: 276 },
  kpi: { indice_global: 67.5, ranking_nacional: 85 },
};

const DEMO_LAGRANJA = {
  comuna: { id: 0, nombre: 'La Granja', poblacion: 132732, superficie_km2: 10.8 },
  estadisticas_delitos: {
    total_ultimos_12m: 1284,
    tasa_100k: 967,
    evolucion_mensual: [
      { mes: 1, anio: 2025, cantidad: 98 }, { mes: 2, anio: 2025, cantidad: 112 },
      { mes: 3, anio: 2025, cantidad: 125 }, { mes: 4, anio: 2025, cantidad: 108 },
      { mes: 5, anio: 2025, cantidad: 134 }, { mes: 6, anio: 2025, cantidad: 121 },
      { mes: 7, anio: 2025, cantidad: 99 }, { mes: 8, anio: 2025, cantidad: 117 },
      { mes: 9, anio: 2025, cantidad: 105 }, { mes: 10, anio: 2025, cantidad: 96 },
      { mes: 11, anio: 2025, cantidad: 88 }, { mes: 12, anio: 2025, cantidad: 81 },
    ],
    top_5_tipos: [
      { tipo: 'Infracción de Tránsito', cantidad: 2810 },
      { tipo: 'Incivilidad', cantidad: 1122 },
      { tipo: 'Intervención Policial', cantidad: 962 },
      { tipo: 'Delito', cantidad: 409 },
      { tipo: 'Fiscalización', cantidad: 402 },
    ],
  },
  tendencias: { direccion: 'bajando', cambio_mensual_porcentaje: -8.0, delitos_mes_actual: 81, delitos_mes_anterior: 88 },
  kpi: { indice_global: 61.0, ranking_nacional: 92 },
};

// Tooltip informativo reutilizable
function InfoTooltip({ texto }: { texto: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button
        onClick={() => setVisible(v => !v)}
        className="p-0.5 rounded-full text-muted-foreground hover:text-foreground transition-colors"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {visible && (
        <div className="absolute z-50 left-6 top-0 w-64 p-3 bg-popover border border-border rounded-xl shadow-xl text-xs text-muted-foreground leading-relaxed">
          <button onClick={() => setVisible(false)} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" />
          </button>
          {texto}
        </div>
      )}
    </span>
  );
}

export function DashboardPage() {
  const { selectedComuna, user } = useAppStore();
  const userRol = user?.rol || 'ciudadano';
  const { data: dashboard } = useDashboardResumen(selectedComuna?.id || null);
  const { data: comunas } = useComunas();

  // Seleccionar demo según la comuna activa
  const esLaGranja = selectedComuna?.nombre?.toLowerCase().includes('granja');
  const DEMO_DEFAULT = esLaGranja ? DEMO_LAGRANJA : DEMO_PENALOLEN;

  const apiHasDatos = dashboard && (dashboard as any)?.estadisticas_delitos?.total_ultimos_12m > 0;
  const data = apiHasDatos ? (dashboard as any) : DEMO_DEFAULT;

  const { comuna, estadisticas_delitos, tendencias, kpi } = data;

  const evolucionData = (estadisticas_delitos.evolucion_mensual || []).map((d: any) => ({
    mes: `${d.mes}/${d.anio}`,
    cantidad: d.cantidad,
  }));

  const topDelitosData = (estadisticas_delitos.top_5_tipos || []).map((d: any) => ({
    tipo: d.tipo.length > 22 ? d.tipo.slice(0, 22) + '…' : d.tipo,
    cantidad: d.cantidad,
  }));

  const getIndiceColor = (valor?: number) => {
    if (!valor) return 'text-muted-foreground';
    if (valor >= 70) return 'text-green-500';
    if (valor >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  const TendenciaIcon = tendencias.direccion === 'bajando' ? TrendingDown :
                        tendencias.direccion === 'subiendo' ? TrendingUp : Minus;

  const esDemoData = !apiHasDatos;

  return (
    <div className="space-y-6">
      {/* Aviso de datos demo */}
      {esDemoData && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-xs text-yellow-400">
          <Info className="h-3.5 w-3.5 flex-shrink-0" />
          <span>Mostrando datos de referencia mientras se cargan los datos reales de {selectedComuna?.nombre || 'la comuna'}.</span>
        </div>
      )}

      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Dashboard de Seguridad</h1>
        <p className="text-muted-foreground text-lg">
          {comuna.nombre} presenta un índice de seguridad de{' '}
          <span className={`font-semibold ${getIndiceColor(kpi.indice_global)}`}>
            {kpi.indice_global ? `${kpi.indice_global}/100` : 'N/A'}
          </span>
          . Los delitos han{' '}
          <span className={tendencias.direccion === 'bajando' ? 'text-green-500' : 'text-red-500'}>
            {tendencias.direccion === 'bajando' ? 'disminuido' : tendencias.direccion === 'subiendo' ? 'aumentado' : 'permanecido estable'}{' '}
            {tendencias.cambio_mensual_porcentaje !== 0 ? `un ${Math.abs(tendencias.cambio_mensual_porcentaje)}%` : ''}
          </span>
          {' '}en el último mes.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Índice de Seguridad"
          value={kpi.indice_global ? `${kpi.indice_global}` : 'N/A'}
          subtitle={`Ranking nacional: #${kpi.ranking_nacional || 'N/A'}`}
          icon={Shield}
          color={kpi.indice_global && kpi.indice_global >= 70 ? 'green' : kpi.indice_global && kpi.indice_global >= 50 ? 'yellow' : 'red'}
          tooltip="Escala 0–100 que combina 5 dimensiones: tasa delictual (30%), percepción ciudadana (25%), victimización (20%), índice de temor (15%) y capacidad de prevención (10%). A mayor puntaje, más segura es la comuna. Fuente: datos CEAD + INE."
        />
        <KPICard
          title="Total Incidentes (12m)"
          value={estadisticas_delitos.total_ultimos_12m.toLocaleString()}
          subtitle={`Tasa: ${estadisticas_delitos.tasa_100k?.toFixed(1) || 'N/A'} por 100k hab`}
          icon={AlertTriangle}
          color="orange"
          tooltip="Total de incidentes registrados en los últimos 12 meses de datos disponibles. La tasa por 100.000 habitantes permite comparar comunas de diferente tamaño. Incluye datos del sistema 1461 y registros de seguridad municipal."
        />
        <KPICard
          title="Tendencia Mensual"
          value={`${tendencias.cambio_mensual_porcentaje > 0 ? '+' : ''}${tendencias.cambio_mensual_porcentaje}%`}
          subtitle={`${tendencias.delitos_mes_actual} vs ${tendencias.delitos_mes_anterior} mes ant.`}
          icon={TendenciaIcon}
          color={tendencias.direccion === 'bajando' ? 'green' : tendencias.direccion === 'subiendo' ? 'red' : 'gray'}
          tooltip="Variación porcentual entre el mes más reciente con datos y el mes anterior. Verde significa reducción de incidentes. Se calcula comparando el conteo exacto del último mes versus el mes inmediatamente anterior."
        />
        <KPICard
          title="Población"
          value={comuna.poblacion?.toLocaleString() || 'N/A'}
          subtitle={`${comuna.superficie_km2?.toFixed(1) || 'N/A'} km²`}
          icon={Users}
          color="blue"
          tooltip="Población total de la comuna según el Censo más reciente del INE. Se usa para calcular las tasas por 100.000 habitantes y comparar el nivel de seguridad entre comunas de diferente tamaño."
        />
      </div>

      {/* ── Gráficos (autoridad + tecnico) ── */}
      {(userRol === 'autoridad' || userRol === 'tecnico') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Evolución de Incidentes</h3>
                <InfoTooltip texto="Cantidad de incidentes registrados mes a mes en los últimos 12 meses. Un gráfico descendente indica mejora en la seguridad." />
              </div>
              <Activity className="h-5 w-5 text-muted-foreground" />
            </div>
            {(estadisticas_delitos as any).periodo && (
              <p className="text-xs text-muted-foreground mb-3">
                {(estadisticas_delitos as any).periodo.desde} → {(estadisticas_delitos as any).periodo.hasta}
              </p>
            )}
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolucionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="mes" stroke="#666" fontSize={11} tickLine={false} />
                  <YAxis stroke="#666" fontSize={11} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="cantidad" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Principales Tipos</h3>
                <InfoTooltip texto="Los 5 tipos de incidente más frecuentes en la comuna, ordenados de mayor a menor." />
              </div>
              <MapPin className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topDelitosData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                  <XAxis type="number" stroke="#666" fontSize={11} />
                  <YAxis type="category" dataKey="tipo" stroke="#666" fontSize={10} width={130} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                  <Bar dataKey="cantidad" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ── Vista simplificada ciudadano: top tipos como lista ── */}
      {userRol === 'ciudadano' && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Incidentes más frecuentes</h3>
          <div className="space-y-3">
            {topDelitosData.map((d: any, i: number) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                  <span className="text-sm">{d.tipo}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 rounded-full bg-primary/30" style={{ width: `${Math.min(120, (d.cantidad / (topDelitosData[0]?.cantidad || 1)) * 120)}px` }}>
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(d.cantidad / (topDelitosData[0]?.cantidad || 1)) * 100}%` }} />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground w-14 text-right">{d.cantidad.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4 pt-3 border-t border-border">
            Para ver gráficos detallados y evolución temporal, solicite acceso de Autoridad.
          </p>
        </div>
      )}

      {/* ── Comparativa regional (autoridad + tecnico) ── */}
      {(userRol === 'autoridad' || userRol === 'tecnico') && (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-semibold">Comparativa Regional</h3>
            <InfoTooltip texto="Comunas disponibles en el sistema. Haz clic en una del panel izquierdo para cambiar el análisis." />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {comunas?.slice(0, 4).map((c: any) => (
              <div key={c.id} className={`p-4 rounded-lg border ${c.id === comuna.id ? 'border-primary bg-primary/10' : 'border-border'}`}>
                <div className="text-sm font-medium">{c.nombre}</div>
                <div className="text-xs text-muted-foreground mt-1">{c.poblacion?.toLocaleString()} hab.</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Panel técnico: métricas de datos ── */}
      {userRol === 'tecnico' && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Info className="h-5 w-5 text-purple-400" />
            Panel Técnico
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Fuente de datos</p>
              <p className="text-sm font-medium mt-0.5">Sistema 1461</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Tasa por 100k</p>
              <p className="text-sm font-medium mt-0.5">{estadisticas_delitos.tasa_100k?.toFixed(1) || 'N/A'}</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Ranking nacional</p>
              <p className="text-sm font-medium mt-0.5">#{kpi.ranking_nacional || 'N/A'} de 346</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Densidad pob.</p>
              <p className="text-sm font-medium mt-0.5">{comuna.poblacion && comuna.superficie_km2 ? `${Math.round(comuna.poblacion / comuna.superficie_km2)} hab/km²` : 'N/A'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface KPICardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  color: 'green' | 'yellow' | 'red' | 'orange' | 'gray' | 'blue';
  tooltip?: string;
}

function KPICard({ title, value, subtitle, icon: Icon, color, tooltip }: KPICardProps) {
  const colorClasses = {
    green:  'bg-green-500/10 text-green-500 border-green-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    red:    'bg-red-500/10 text-red-500 border-red-500/20',
    orange: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    gray:   'bg-gray-500/10 text-gray-500 border-gray-500/20',
    blue:   'bg-blue-500/10 text-blue-500 border-blue-500/20',
  };

  return (
    <div className={`p-6 rounded-xl border ${colorClasses[color]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-1">
            <p className="text-sm opacity-80">{title}</p>
            {tooltip && <InfoTooltip texto={tooltip} />}
          </div>
          <p className="text-3xl font-bold mt-1">{value}</p>
          <p className="text-xs opacity-70 mt-1">{subtitle}</p>
        </div>
        <Icon className="h-5 w-5 opacity-60 flex-shrink-0" />
      </div>
    </div>
  );
}
