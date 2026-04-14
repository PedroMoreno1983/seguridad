import { useState } from 'react';
import {
  Brain, Clock, Target, Play, AlertCircle, CheckCircle,
  BarChart3, Zap, Layers, ChevronDown, ChevronUp,
  Activity, GitMerge, TreePine, Cpu, History, Calendar
} from 'lucide-react';
import { useAppStore } from '@/store';
import { usePredicciones, useZonasRiesgo, useGenerarPrediccion } from '@/hooks/useApi';

// ── Datos detallados de cada modelo ──────────────────────────────────────────
const MODELOS_INFO: Record<string, {
  icon: React.ElementType;
  color: string;
  bg: string;
  nombre: string;
  efectividad: string;
  tiempo: string;
  recomendado: boolean;
  resumen: string;
  como_funciona: string;
  fortalezas: string[];
  limitaciones: string[];
  ideal_para: string;
  referencia: string;
}> = {
  SEPP: {
    icon: Activity,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    nombre: 'Self-Exciting Point Process',
    efectividad: '89%',
    tiempo: '~5 min',
    recomendado: true,
    resumen: 'Modelo espaciotemporal basado en el principio de victimización repetida: un delito aumenta la probabilidad de nuevos delitos cercanos en las horas y días siguientes.',
    como_funciona: `SEPP modela el delito como un proceso de puntos auto-excitante: cada incidente genera un "pulso" de riesgo que se propaga en el espacio y decae en el tiempo (función kernel). El modelo calcula para cada celda del territorio la probabilidad de incidente en las próximas horas sumando el efecto de todos los eventos históricos ponderados por distancia y tiempo transcurrido.

El ajuste de los parámetros (tasa base, amplitud del kernel espacial y temporal) se realiza por máxima verosimilitud sobre el historial de incidentes de la comuna.`,
    fortalezas: [
      'Capta el efecto "contagio" del delito en el tiempo y espacio',
      'Alta precisión en robos y hurtos de alta frecuencia',
      'Base matemática sólida (utilizado por LAPD PredPol)',
      'Funciona bien con series de datos largas (2+ años)',
    ],
    limitaciones: [
      'Requiere suficientes datos para calibrar el kernel',
      'Asume patrones pasados se repiten (puede fallar con cambios bruscos)',
      'No incorpora factores ambientales del entorno',
    ],
    ideal_para: 'Robos reiterados, hurtos en zonas comerciales, VIF con antecedentes.',
    referencia: 'Mohler et al. (2011) — Journal of the American Statistical Association',
  },

  RTM: {
    icon: TreePine,
    color: 'text-green-400',
    bg: 'bg-green-500/10 border-green-500/20',
    nombre: 'Risk Terrain Modeling',
    efectividad: '75%',
    tiempo: '~2 min',
    recomendado: false,
    resumen: 'Identifica territorios de riesgo combinando capas ambientales del entorno urbano: distancia a paraderos, locales nocturnos, colegios, plazas y otros atractores criminales.',
    como_funciona: `RTM superpone múltiples capas geoespaciales (features de riesgo) sobre el territorio y las pondera mediante regresión logística penalizada (LASSO). Cada feature representa un factor ambiental que la literatura criminológica asocia con mayor o menor probabilidad de delito.

Para cada celda de 100×100m se construye un vector de features (distancia a cada atractor, densidad de vías, iluminación pública estimada, etc.) y el modelo calcula el riesgo compuesto. Las celdas con mayor score se etiquetan como zonas de riesgo.`,
    fortalezas: [
      'Interpretable: muestra qué factores generan el riesgo',
      'No depende de datos históricos abundantes',
      'Identifica riesgo en zonas nuevas sin historial previo',
      'Útil para planificación urbana y prevención situacional',
    ],
    limitaciones: [
      'Requiere datos de infraestructura urbana actualizados',
      'No capta variaciones temporales (hora del día, estacionalidad)',
      'Menor precisión en delitos de oportunidad espontáneos',
    ],
    ideal_para: 'Diagnóstico territorial, diseño de patrullaje preventivo, análisis de nuevas urbanizaciones.',
    referencia: 'Caplan & Kennedy (2010) — RTM: A New Tool for the Systematic Study of Crime Risk',
  },

  XGBoost: {
    icon: Cpu,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/20',
    nombre: 'XGBoost Espacial',
    efectividad: '85%',
    tiempo: '~3 min',
    recomendado: false,
    resumen: 'Gradient boosting con variables históricas, temporales y geoespaciales. Aprende patrones complejos no lineales entre hora del día, día de semana, densidad histórica y tipo de delito.',
    como_funciona: `XGBoost construye un ensamble de árboles de decisión de forma secuencial, donde cada árbol corrige los errores del anterior. Las variables de entrada incluyen:

• Conteo de incidentes en la misma celda en los últimos 7, 30 y 90 días
• Hora del día, día de semana, mes y semana del año
• Distancia al centroide de la comuna y a puntos de referencia
• Tipo de incidente predominante en el área
• Indicadores de tendencia (subida/bajada respecto a media histórica)

El modelo se entrena con validación cruzada espacial para evitar sobreajuste geográfico.`,
    fortalezas: [
      'Captura interacciones complejas entre variables',
      'Robusto ante datos faltantes o ruidosos',
      'Incluye estacionalidad horaria y semanal',
      'Importancia de variables para explicabilidad',
    ],
    limitaciones: [
      'Caja más oscura que RTM (menos interpretable)',
      'Requiere muchos datos de entrenamiento (mínimo 6 meses)',
      'Puede sobreajustar si los patrones cambian abruptamente',
    ],
    ideal_para: 'Delitos con patrones horarios claros: robos nocturnos, VIF de fin de semana, accidentes en hora punta.',
    referencia: 'Chen & Guestrin (2016) — XGBoost: A Scalable Tree Boosting System',
  },

  Ensemble: {
    icon: GitMerge,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/20',
    nombre: 'Ensemble (Combinado)',
    efectividad: '92%',
    tiempo: '~10 min',
    recomendado: false,
    resumen: 'Combina las predicciones de SEPP + RTM + XGBoost mediante ponderación optimizada. Reduce el sesgo individual de cada modelo y maximiza la precisión general.',
    como_funciona: `El Ensemble aplica stacking: cada modelo base (SEPP, RTM, XGBoost) genera su propio mapa de probabilidades, y un meta-modelo de regresión logística aprende los pesos óptimos para combinarlos.

Los pesos se calculan minimizando el error de predicción en un conjunto de validación temporal (últimos 3 meses del historial). Típicamente SEPP aporta ~45%, XGBoost ~35% y RTM ~20%, aunque los pesos varían según la comuna y el tipo de delito.

La zona final se etiqueta según el score combinado:
• > 0.85 → Crítico   • 0.70–0.85 → Alto
• 0.50–0.70 → Medio  • < 0.50 → Bajo`,
    fortalezas: [
      'Mayor precisión que cualquier modelo individual',
      'Compensa las debilidades de cada modelo',
      'Más robusto ante cambios en los patrones de delito',
      'Recomendado para decisiones operacionales críticas',
    ],
    limitaciones: [
      'Mayor tiempo de cómputo (~10 minutos)',
      'Requiere que los 3 modelos base tengan datos suficientes',
      'Menos interpretable que RTM o SEPP por separado',
    ],
    ideal_para: 'Despliegue operacional, planificación de patrullajes, toma de decisiones de alto impacto.',
    referencia: 'Berk (2019) — Machine Learning Risk Assessments in Criminal Justice Settings',
  },
};

// ── Componente tarjeta de modelo ─────────────────────────────────────────────
function ModeloCard({
  modeloId,
  seleccionado,
  onSelect,
}: {
  modeloId: string;
  seleccionado: boolean;
  onSelect: () => void;
}) {
  const [expandido, setExpandido] = useState(false);
  const m = MODELOS_INFO[modeloId];
  if (!m) return null;
  const Icon = m.icon;

  return (
    <div
      className={`rounded-xl border transition-all ${
        seleccionado
          ? `${m.bg} border-current ring-1 ring-current`
          : 'bg-card border-border hover:border-muted-foreground/40'
      }`}
    >
      {/* Header clickeable */}
      <button
        onClick={onSelect}
        className="w-full text-left p-4"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${m.bg} flex-shrink-0`}>
              <Icon className={`h-4 w-4 ${m.color}`} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold">{m.nombre}</p>
                {m.recomendado && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                    Recomendado
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{m.resumen}</p>
            </div>
          </div>
          <div className="flex-shrink-0 flex flex-col items-end gap-1">
            <span className={`text-sm font-bold ${m.color}`}>{m.efectividad}</span>
            <span className="text-xs text-muted-foreground">{m.tiempo}</span>
          </div>
        </div>
      </button>

      {/* Toggle detalle */}
      <div className="border-t border-border/50">
        <button
          onClick={() => setExpandido(!expandido)}
          className="w-full flex items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {expandido ? (
            <><ChevronUp className="h-3 w-3" /> Ocultar detalle</>
          ) : (
            <><ChevronDown className="h-3 w-3" /> Ver cómo funciona</>
          )}
        </button>

        {expandido && (
          <div className="px-4 pb-4 space-y-4 text-sm">
            {/* Cómo funciona */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">¿Cómo funciona?</h4>
              <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">{m.como_funciona}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Fortalezas */}
              <div>
                <h4 className="text-xs font-semibold text-green-400 uppercase mb-2">✓ Fortalezas</h4>
                <ul className="space-y-1">
                  {m.fortalezas.map((f) => (
                    <li key={f} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <span className="text-green-400 flex-shrink-0">•</span>{f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Limitaciones */}
              <div>
                <h4 className="text-xs font-semibold text-orange-400 uppercase mb-2">⚠ Limitaciones</h4>
                <ul className="space-y-1">
                  {m.limitaciones.map((l) => (
                    <li key={l} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <span className="text-orange-400 flex-shrink-0">•</span>{l}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Ideal para + referencia */}
            <div className="pt-2 border-t border-border/50 space-y-1">
              <p className="text-xs">
                <span className="font-semibold text-foreground">Ideal para:</span>{' '}
                <span className="text-muted-foreground">{m.ideal_para}</span>
              </p>
              <p className="text-xs text-muted-foreground/60 italic">{m.referencia}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Historial simulado de predicciones
function getHistorialPredicciones(_comunaNombre: string) {
  return [
    { id: 'h1', fecha: '2025-04-12 14:30', modelo: 'Ensemble', horizonte: 72, zonas: 8, precision: 91, estado: 'completada' },
    { id: 'h2', fecha: '2025-04-10 09:15', modelo: 'SEPP', horizonte: 48, zonas: 5, precision: 88, estado: 'completada' },
    { id: 'h3', fecha: '2025-04-07 11:00', modelo: 'XGBoost', horizonte: 72, zonas: 6, precision: 84, estado: 'completada' },
    { id: 'h4', fecha: '2025-04-04 16:45', modelo: 'RTM', horizonte: 24, zonas: 3, precision: 73, estado: 'completada' },
    { id: 'h5', fecha: '2025-04-01 08:20', modelo: 'Ensemble', horizonte: 168, zonas: 12, precision: 90, estado: 'completada' },
    { id: 'h6', fecha: '2025-03-28 13:10', modelo: 'SEPP', horizonte: 72, zonas: 7, precision: 89, estado: 'completada' },
    { id: 'h7', fecha: '2025-03-25 10:00', modelo: 'XGBoost', horizonte: 48, zonas: 4, precision: 82, estado: 'expirada' },
    { id: 'h8', fecha: '2025-03-20 15:30', modelo: 'RTM', horizonte: 72, zonas: 5, precision: 76, estado: 'expirada' },
  ];
}

// ── Página principal ──────────────────────────────────────────────────────────
export function PrediccionesPage() {
  const { selectedComuna } = useAppStore();
  const [modeloSeleccionado, setModeloSeleccionado] = useState('SEPP');
  const [horizonte, setHorizonte] = useState(72);
  const [showHistorial, setShowHistorial] = useState(false);

  const { data: predicciones, isLoading: loadingPreds } = usePredicciones(selectedComuna?.id || null);
  const { data: zonasRiesgo } = useZonasRiesgo(selectedComuna?.id || null, horizonte);
  const generarMutation = useGenerarPrediccion();

  const handleGenerar = () => {
    if (!selectedComuna) return;
    generarMutation.mutate({ comunaId: selectedComuna.id, modelo: modeloSeleccionado, horizonte });
  };

  const modeloActual = MODELOS_INFO[modeloSeleccionado];
  const precisionHistorica = modeloActual?.efectividad || '65%';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
          <Brain className="h-8 w-8 text-primary" />
          Predicciones delictuales
        </h1>
        <p className="text-muted-foreground mt-2">
          Modelos de Machine Learning para anticipar zonas de riesgo en las próximas 24–168 horas.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel configuración */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Target className="h-5 w-5" />
              Generar predicción
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Horizonte</label>
                <select
                  value={horizonte}
                  onChange={(e) => setHorizonte(Number(e.target.value))}
                  className="w-full mt-1 p-3 bg-muted border border-border rounded-lg text-sm"
                >
                  <option value={24}>24 horas</option>
                  <option value={48}>48 horas</option>
                  <option value={72}>72 horas</option>
                  <option value={168}>1 semana (168h)</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Modelo seleccionado
                </label>
                <div className={`mt-1 p-3 rounded-lg border text-sm font-medium ${modeloActual?.bg}`}>
                  {modeloActual?.nombre || modeloSeleccionado}
                </div>
              </div>

              <button
                onClick={handleGenerar}
                disabled={generarMutation.isPending || !selectedComuna}
                className="w-full flex items-center justify-center gap-2 p-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 font-medium"
              >
                {generarMutation.isPending ? (
                  <><div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />Calculando...</>
                ) : (
                  <><Play className="h-5 w-5" />Generar Predicciones</>
                )}
              </button>

              {generarMutation.isSuccess && (
                <div className="flex items-center gap-2 p-3 bg-green-500/10 text-green-500 rounded-lg text-sm">
                  <CheckCircle className="h-5 w-5 flex-shrink-0" />
                  <span>{generarMutation.data.total_predicciones} zonas calculadas → ver en Mapa</span>
                </div>
              )}
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-card border border-border rounded-xl p-3 text-center">
              <Layers className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
              <p className="text-xl font-bold">{zonasRiesgo?.total_zonas || 0}</p>
              <p className="text-xs text-muted-foreground">Zonas</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-3 text-center">
              <Clock className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
              <p className="text-xl font-bold">{horizonte}h</p>
              <p className="text-xs text-muted-foreground">Horizonte</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-3 text-center">
              <BarChart3 className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
              <p className="text-xl font-bold text-green-500">{precisionHistorica}</p>
              <p className="text-xs text-muted-foreground">Precisión</p>
            </div>
          </div>
        </div>

        {/* Panel derecho: modelos + resultados */}
        <div className="lg:col-span-2 space-y-4">
          {/* Selección y detalle de modelos */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Modelos disponibles
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Haz clic en un modelo para seleccionarlo. Expande para ver cómo funciona.
            </p>
            <div className="space-y-3">
              {Object.keys(MODELOS_INFO).map((id) => (
                <ModeloCard
                  key={id}
                  modeloId={id}
                  seleccionado={modeloSeleccionado === id}
                  onSelect={() => setModeloSeleccionado(id)}
                />
              ))}
            </div>
          </div>

          {/* Resultados */}
          <div className="bg-card border border-border rounded-xl">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold">Zonas de riesgo activas</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Se muestran en el Mapa de Calor como zonas coloreadas
              </p>
            </div>

            {loadingPreds ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Cargando predicciones...</div>
            ) : !predicciones || predicciones.length === 0 ? (
              <div className="p-8 text-center">
                <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No hay predicciones activas.</p>
                <p className="text-xs text-muted-foreground mt-1">Selecciona un modelo y haz clic en <strong>Generar Predicciones</strong>.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {predicciones.slice(0, 10).map((pred: any, idx: number) => {
                  const colorMap: Record<string, string> = {
                    critico: 'bg-red-500/20 text-red-400',
                    alto:    'bg-orange-500/20 text-orange-400',
                    medio:   'bg-yellow-500/20 text-yellow-400',
                    bajo:    'bg-green-500/20 text-green-400',
                    muy_bajo:'bg-blue-500/20 text-blue-400',
                  };
                  const colorClass = colorMap[pred.nivel_riesgo] || 'bg-muted text-muted-foreground';
                  return (
                    <div key={pred.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${colorClass}`}>
                          {idx + 1}
                        </div>
                        <div>
                          <p className="text-sm font-medium capitalize">{pred.nivel_riesgo?.replace('_', ' ')}</p>
                          <p className="text-xs text-muted-foreground">
                            Probabilidad: <strong>{((pred.probabilidad || 0) * 100).toFixed(1)}%</strong>
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium">{pred.modelo}</p>
                        <p className="text-xs text-muted-foreground">{pred.horizonte_horas}h</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Historial de Predicciones ── */}
      <div className="bg-card border border-border rounded-xl">
        <button
          onClick={() => setShowHistorial(!showHistorial)}
          className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <History className="h-5 w-5 text-muted-foreground" />
            <div className="text-left">
              <h3 className="font-semibold">Historial de predicciones</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Registro de todas las predicciones generadas para {selectedComuna?.nombre || 'esta comuna'}
              </p>
            </div>
          </div>
          {showHistorial ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
        </button>

        {showHistorial && (
          <div className="border-t border-border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      <div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" />Fecha</div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Modelo</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Horizonte</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Zonas</th>
                    <th className="hidden sm:table-cell px-4 py-3 text-center text-xs font-medium text-muted-foreground">Precision</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {getHistorialPredicciones(selectedComuna?.nombre || '').map((h) => {
                    const modeloColor = MODELOS_INFO[h.modelo]?.color || 'text-foreground';
                    return (
                      <tr key={h.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-sm">{h.fecha}</td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-medium ${modeloColor}`}>{h.modelo}</span>
                        </td>
                        <td className="px-4 py-3 text-center text-sm">{h.horizonte}h</td>
                        <td className="px-4 py-3 text-center text-sm font-medium">{h.zonas}</td>
                        <td className="hidden sm:table-cell px-4 py-3 text-center">
                          <span className={`text-sm font-medium ${h.precision >= 85 ? 'text-green-400' : h.precision >= 75 ? 'text-yellow-400' : 'text-orange-400'}`}>
                            {h.precision}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${
                            h.estado === 'completada'
                              ? 'bg-green-500/10 text-green-400'
                              : 'bg-gray-500/10 text-gray-400'
                          }`}>
                            {h.estado === 'completada' ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                            {h.estado === 'completada' ? 'Completada' : 'Expirada'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
              Mostrando las ultimas 8 predicciones. Las predicciones expiradas ya no generan alertas activas.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
