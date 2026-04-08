import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingDown, TrendingUp, Minus, Shield, AlertTriangle,
  Users, MapPin, Activity, Calendar
} from 'lucide-react';
import { useAppStore } from '@/store';
import { useDashboardResumen, useComunas } from '@/hooks/useApi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export function DashboardPage() {
  const { selectedComuna } = useAppStore();
  const { data: dashboard, isLoading } = useDashboardResumen(selectedComuna?.id || null);
  const { data: comunas } = useComunas();
  
  if (isLoading || !dashboard) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Cargando datos...</div>
      </div>
    );
  }

  const { comuna, indice_seguridad, estadisticas_delitos, tendencias, kpi } = dashboard;
  
  // Preparar datos para gráficos
  const evolucionData = estadisticas_delitos.evolucion_mensual.map(d => ({
    mes: `${d.mes}/${d.anio}`,
    cantidad: d.cantidad,
  }));
  
  const topDelitosData = estadisticas_delitos.top_5_tipos.map(d => ({
    tipo: d.tipo.length > 20 ? d.tipo.slice(0, 20) + '...' : d.tipo,
    cantidad: d.cantidad,
  }));

  // Calcular color del indicador
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
      {/* Header con narrativa */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
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
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Índice de Seguridad"
          value={kpi.indice_global?.toString() || 'N/A'}
          subtitle={`Ranking nacional: #${kpi.ranking_nacional || 'N/A'}`}
          icon={Shield}
          color={kpi.indice_global && kpi.indice_global >= 70 ? 'green' : kpi.indice_global && kpi.indice_global >= 50 ? 'yellow' : 'red'}
        />
        <KPICard
          title="Total Delitos (12m)"
          value={estadisticas_delitos.total_ultimos_12m.toLocaleString()}
          subtitle={`Tasa: ${estadisticas_delitos.tasa_100k?.toFixed(1) || 'N/A'} por 100k hab`}
          icon={AlertTriangle}
          color="orange"
        />
        <KPICard
          title="Tendencia Mensual"
          value={`${tendencias.cambio_mensual_porcentaje > 0 ? '+' : ''}${tendencias.cambio_mensual_porcentaje}%`}
          subtitle={`${tendencias.delitos_mes_actual} vs ${tendencias.delitos_mes_anterior} mes ant.`}
          icon={TendenciaIcon}
          color={tendencias.direccion === 'bajando' ? 'green' : tendencias.direccion === 'subiendo' ? 'red' : 'gray'}
        />
        <KPICard
          title="Población"
          value={comuna.poblacion?.toLocaleString() || 'N/A'}
          subtitle={`${comuna.superficie_km2?.toFixed(1) || 'N/A'} km²`}
          icon={Users}
          color="blue"
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evolución temporal */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Evolución de Delitos</h3>
            <Activity className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis 
                  dataKey="mes" 
                  stroke="#666" 
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis 
                  stroke="#666" 
                  fontSize={12}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: '1px solid #334155',
                    borderRadius: '8px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="cantidad" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Top tipos de delito */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Principales Tipos de Delito</h3>
            <MapPin className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topDelitosData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                <XAxis type="number" stroke="#666" fontSize={12} />
                <YAxis 
                  type="category" 
                  dataKey="tipo" 
                  stroke="#666" 
                  fontSize={11}
                  width={120}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: '1px solid #334155',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="cantidad" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Comparativa rápida */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-card border border-border rounded-xl p-6"
      >
        <h3 className="text-lg font-semibold mb-4">Comparativa Regional</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {comunas?.slice(0, 4).map((c, i) => (
            <div 
              key={c.id} 
              className={`p-4 rounded-lg border ${c.id === comuna.id ? 'border-primary bg-primary/10' : 'border-border'}`}
            >
              <div className="text-sm font-medium">{c.nombre}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {c.poblacion?.toLocaleString()} hab.
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// Componente KPI Card
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
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`p-6 rounded-xl border ${colorClasses[color]}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm opacity-80">{title}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          <p className="text-xs opacity-70 mt-1">{subtitle}</p>
        </div>
        <Icon className="h-5 w-5 opacity-60" />
      </div>
    </motion.div>
  );
}
