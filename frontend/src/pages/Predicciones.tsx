import { useState } from 'react';
import { Brain, Clock, Target, Play, AlertCircle, CheckCircle, BarChart3, Zap, Layers } from 'lucide-react';
import { useAppStore } from '@/store';
import { usePredicciones, useZonasRiesgo, useModelosDisponibles, useGenerarPrediccion } from '@/hooks/useApi';

export function PrediccionesPage() {
  const { selectedComuna } = useAppStore();
  const [modeloSeleccionado, setModeloSeleccionado] = useState('SEPP');
  const [horizonte, setHorizonte] = useState(72);
  
  const { data: predicciones, isLoading: loadingPreds } = usePredicciones(selectedComuna?.id || null);
  const { data: zonasRiesgo } = useZonasRiesgo(selectedComuna?.id || null, horizonte);
  const { data: modelosApi } = useModelosDisponibles();
  const modelos = modelosApi ?? [
    { id: 'SEPP', nombre: 'Self-Exciting Point Process', descripcion: 'Modelo espaciotemporal basado en victimización repetida.', efectividad: '89%', tiempo_calculo: '~5 minutos', recomendado: true },
    { id: 'RTM', nombre: 'Risk Terrain Modeling', descripcion: 'Análisis de features ambientales para identificar territorios de riesgo.', efectividad: '75%', tiempo_calculo: '~2 minutos', recomendado: false },
    { id: 'XGBoost', nombre: 'XGBoost Espacial', descripcion: 'Gradient boosting con features geoespaciales y temporales.', efectividad: '85%', tiempo_calculo: '~3 minutos', recomendado: false },
    { id: 'Ensemble', nombre: 'Ensemble (Combinado)', descripcion: 'Combinación ponderada de SEPP + RTM + XGBoost.', efectividad: '92%', tiempo_calculo: '~10 minutos', recomendado: false },
  ];
  const generarMutation = useGenerarPrediccion();
  
  const handleGenerar = () => {
    if (!selectedComuna) return;
    generarMutation.mutate({
      comunaId: selectedComuna.id,
      modelo: modeloSeleccionado,
      horizonte,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Brain className="h-8 w-8 text-primary" />
            Predicciones delictuales
          </h1>
          <p className="text-muted-foreground mt-2">
            Modelos de Machine Learning para predecir zonas de riesgo en las próximas 24-168 horas.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Target className="h-5 w-5" />
              Configuración
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Modelo predictivo</label>
                <select 
                  value={modeloSeleccionado}
                  onChange={(e) => setModeloSeleccionado(e.target.value)}
                  className="w-full mt-1 p-3 bg-muted border border-border rounded-lg"
                >
                  {modelos?.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre} {m.recomendado ? '(Recomendado)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Horizonte de predicción</label>
                <select 
                  value={horizonte}
                  onChange={(e) => setHorizonte(Number(e.target.value))}
                  className="w-full mt-1 p-3 bg-muted border border-border rounded-lg"
                >
                  <option value={24}>24 horas</option>
                  <option value={48}>48 horas</option>
                  <option value={72}>72 horas</option>
                  <option value={168}>1 semana (168h)</option>
                </select>
              </div>
              
              <button
                onClick={handleGenerar}
                disabled={generarMutation.isPending || !selectedComuna}
                className="w-full flex items-center justify-center gap-2 p-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {generarMutation.isPending ? (
                  <><div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />Calculando...</>
                ) : (
                  <><Play className="h-5 w-5" />Generar Predicciones</>
                )}
              </button>
              
              {generarMutation.isSuccess && (
                <div className="flex items-center gap-2 p-3 bg-green-500/10 text-green-500 rounded-lg">
                  <CheckCircle className="h-5 w-5" />
                  <span className="text-sm">{generarMutation.data.total_predicciones} zonas calculadas</span>
                </div>
              )}
            </div>
          </div>
          
          {modelos && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Sobre el modelo
              </h3>
              
              {(() => {
                const modelo = modelos.find((m: any) => m.id === modeloSeleccionado);
                if (!modelo) return null;
                
                return (
                  <div className="space-y-3 text-sm">
                    <p>{modelo.descripcion}</p>
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
                      <div>
                        <span className="text-muted-foreground">Efectividad:</span>
                        <p className="font-semibold text-green-500">{modelo.efectividad}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Tiempo:</span>
                        <p className="font-semibold">{modelo.tiempo_calculo}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Layers className="h-4 w-4" />
                <span className="text-sm">Zonas de Riesgo</span>
              </div>
              <p className="text-2xl font-bold">{zonasRiesgo?.total_zonas || 0}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Clock className="h-4 w-4" />
                <span className="text-sm">Horizonte</span>
              </div>
              <p className="text-2xl font-bold">{horizonte}h</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <BarChart3 className="h-4 w-4" />
                <span className="text-sm">Precisión Hist.</span>
              </div>
              <p className="text-2xl font-bold text-green-500">65%</p>
            </div>
          </div>
          
          <div className="bg-card border border-border rounded-xl">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold">Zonas de riesgo identificadas</h3>
            </div>
            
            {loadingPreds ? (
              <div className="p-8 text-center text-muted-foreground">Cargando predicciones...</div>
            ) : !predicciones || predicciones.length === 0 ? (
              <div className="p-8 text-center">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No hay predicciones activas. Genere una nueva predicción.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {predicciones.slice(0, 10).map((pred: any, idx: number) => (
                  <div key={pred.id} className="p-4 flex items-center justify-between hover:bg-muted/50">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${pred.nivel_riesgo === 'critico' ? 'bg-red-500/20 text-red-500' : pred.nivel_riesgo === 'alto' ? 'bg-orange-500/20 text-orange-500' : pred.nivel_riesgo === 'medio' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-green-500/20 text-green-500'}`}>
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-medium capitalize">{pred.nivel_riesgo.replace('_', ' ')}</p>
                        <p className="text-sm text-muted-foreground">Probabilidad: {((pred.probabilidad || 0) * 100).toFixed(1)}%</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">{pred.modelo}</p>
                      <p className="text-xs text-muted-foreground">{pred.horizonte_horas}h</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
