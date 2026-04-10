import { useAppStore } from '@/store';
import { useDashboardResumen, useComunas } from '@/hooks/useApi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingDown, TrendingUp, Minus, Shield, AlertTriangle, Users, MapPin, Activity } from 'lucide-react';

const DEMO_DASHBOARD = {
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
  kpi: { indice_global: 62, ranking_nacional: 187 },
};

export function DashboardPage() {
  const { selectedComuna } = useAppStore();
  const { data: dashboard } = useDashboardResumen(selectedComuna?.id || null);
  const { data: comunas } = useComunas();

  // Usar datos reales si están disponibles y tienen datos, si no datos demo
  const apiHasDatos = dashboard && (dashboard as any)?.estadisticas_delitos?.total_ultimos_12m > 0;
  const data = apiHasDatos ? dashboard : DEMO_DASHBOARD;

  const { comuna, estadisticas_delitos, tendencias, kpi } = data as typeof DEMO_DASHBOARD;

  const evolucionData = estadisticas_delitos.evolucion_mensual.map(d => ({
    mes: `${d.mes}/${d.anio}`,
    cantidad: d.cantidad,
  }));

  const topDelitosData = estadisticas_delitos.top_5_tipos.map(d => ({
    tipo: d.tipo.length > 20 ? d.tipo.slice(0, 20) + '...' : d.tipo,
    cantidad: d.cantidad,
  }));

  // Período de datos mostrado
  const periodo = (dashboard as any)?.estadisticas_delitos?.periodo;
  const periodoLabel = periodo ? `${periodo.desde} → ${periodo.hasta}` : 'Últimos 12 meses';

  const getIndiceColor = (valor?: number) => {
    if (!valor) return 'text-muted-foreground';
    if (valor >= 70) return 'text-green-500';
    if (valor >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  const TendenciaIcon = tendencias.direccion === 'bajando' ? TrendingDown : 
                       tendencias.direccion === 'subiendo' ? TrendingUp : Minus;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Dashboard de Seguridad</h1>
        <p className="text-muted-foreground text-lg">
          {comuna.nombre} presenta un índice de seguridad de {' '}
          <span className={`font-semibold ${getIndiceColor(kpi.indice_global?.valueOf())}`}>
            {kpi.indice_global || 'N/A'}/100
          </span>
          . Los delitos han {' '}
          <span className={tendencias.direccion === 'bajando' ? 'text-green-500' : 'text-red-500'}>
            {tendencias.direccion === 'bajando' ? 'disminuido' : 'aumentado'} un {Math.abs(tendencias.cambio_mensual_porcentaje)}%
          </span>
          {' '}en el último mes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Índice de Seguridad" value={kpi.indice_global?.toString() || 'N/A'} subtitle={`Ranking nacional: #${kpi.ranking_nacional || 'N/A'}`} icon={Shield} color={kpi.indice_global && kpi.indice_global >= 70 ? 'green' : kpi.indice_global && kpi.indice_global >= 50 ? 'yellow' : 'red'} />
        <KPICard title="Total Delitos (12m)" value={estadisticas_delitos.total_ultimos_12m.toLocaleString()} subtitle={`Tasa: ${estadisticas_delitos.tasa_100k?.toFixed(1) || 'N/A'} por 100k hab`} icon={AlertTriangle} color="orange" />
        <KPICard title="Tendencia Mensual" value={`${tendencias.cambio_mensual_porcentaje > 0 ? '+' : ''}${tendencias.cambio_mensual_porcentaje}%`} subtitle={`${tendencias.delitos_mes_actual} vs ${tendencias.delitos_mes_anterior} mes ant.`} icon={TendenciaIcon} color={tendencias.direccion === 'bajando' ? 'green' : tendencias.direccion === 'subiendo' ? 'red' : 'gray'} />
        <KPICard title="Población" value={comuna.poblacion?.toLocaleString() || 'N/A'} subtitle={`${comuna.superficie_km2?.toFixed(1) || 'N/A'} km²`} icon={Users} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Evolución de Delitos</h3>
              <p className="text-xs text-muted-foreground">{periodoLabel}</p>
            </div>
            <Activity className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="mes" stroke="#666" fontSize={12} tickLine={false} />
                <YAxis stroke="#666" fontSize={12} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="cantidad" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Principales Tipos de Delito</h3>
            <MapPin className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topDelitosData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                <XAxis type="number" stroke="#666" fontSize={12} />
                <YAxis type="category" dataKey="tipo" stroke="#666" fontSize={11} width={120} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                <Bar dataKey="cantidad" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Comparativa Regional</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {comunas?.slice(0, 4).map((c) => (
            <div key={c.id} className={`p-4 rounded-lg border ${c.id === comuna.id ? 'border-primary bg-primary/10' : 'border-border'}`}>
              <div className="text-sm font-medium">{c.nombre}</div>
              <div className="text-xs text-muted-foreground mt-1">{c.poblacion?.toLocaleString()} hab.</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface KPICardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  color: 'green' | 'yellow' | 'red' | 'orange' | 'gray' | 'blue';
}

function KPICard({ title, value, subtitle, icon: Icon, color }: KPICardProps) {
  const colorClasses = {
    green: 'bg-green-500/10 text-green-500 border-green-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    red: 'bg-red-500/10 text-red-500 border-red-500/20',
    orange: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    gray: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
    blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  };

  return (
    <div className={`p-6 rounded-xl border ${colorClasses[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm opacity-80">{title}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          <p className="text-xs opacity-70 mt-1">{subtitle}</p>
        </div>
        <Icon className="h-5 w-5 opacity-60" />
      </div>
    </div>
  );
}
