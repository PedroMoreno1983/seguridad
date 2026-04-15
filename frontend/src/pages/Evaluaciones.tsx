import { useState, useMemo } from 'react';
import { Target, TrendingDown, ArrowRight, BarChart3, Clock, AlertCircle, Plus, X } from 'lucide-react';
import { useAppStore } from '@/store';
import { useEvaluaciones, useCrearEvaluacion } from '@/hooks/useApi';

export function EvaluacionesPage() {
  const { selectedComuna } = useAppStore();
  const { data: evaluaciones, isLoading } = useEvaluaciones(selectedComuna?.id || null);

  const stats = useMemo(() => {
    if (!evaluaciones || evaluaciones.length === 0) return { total: 0, promedioReduccion: 0 };
    const conImpacto = evaluaciones.filter((e: any) => e.impacto_estimado?.reduccion_delitos_ratio);
    const avg = conImpacto.reduce((acc: number, e: any) => acc + e.impacto_estimado.reduccion_delitos_ratio, 0) / (conImpacto.length || 1);
    return {
      total: evaluaciones.length,
      promedioReduccion: (avg * 100).toFixed(1)
    };
  }, [evaluaciones]);

  const { mutate: crearEvaluacion, isPending: creando } = useCrearEvaluacion();
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    tipo: 'Plan Calles Sin Violencia',
    descripcion: '',
    reduccion_estimada: 15,
    desplazamiento: 'Bajo'
  });

  const handleCrear = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComuna) return;
    crearEvaluacion({
      comuna_id: selectedComuna.id,
      ...formData
    }, {
      onSuccess: () => {
        setModalOpen(false);
        setFormData({ ...formData, descripcion: '' });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <Target className="h-8 w-8 text-primary" />
            Evaluación de Estrategias
          </h1>
          <p className="text-muted-foreground mt-2">
            Mide el impacto de las intervenciones preventivas comparando la densidad delictual antes y después.
          </p>
        </div>
        <button 
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors shadow-lg font-medium text-sm whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          Nueva Estrategia
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent flex-shrink-0 rounded-full" /></div>
      ) : evaluaciones && evaluaciones.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Intervenciones evaluadas</p>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-500">-{stats.promedioReduccion}%</p>
                <p className="text-sm text-muted-foreground">Reducción promedio</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {evaluaciones.map((evaluacion: any) => {
              const reduccion = evaluacion.impacto_estimado?.reduccion_delitos_ratio 
                ? (evaluacion.impacto_estimado.reduccion_delitos_ratio * 100).toFixed(1) 
                : 0;
              return (
                <div key={evaluacion.id} className="bg-card border border-border rounded-xl p-6">
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold">{evaluacion.tipo}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{evaluacion.descripcion}</p>
                      <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> Inicio: {new Date(evaluacion.fecha_inicio).toLocaleDateString()}</span>
                        {evaluacion.fecha_fin && 
                          <span className="flex items-center gap-1"><ArrowRight className="h-4 w-4" /> Fin: {new Date(evaluacion.fecha_fin).toLocaleDateString()}</span>
                        }
                      </div>
                    </div>
                    <div className="md:text-right flex flex-col items-start md:items-end p-4 md:p-0 bg-muted/30 md:bg-transparent rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1 uppercase font-semibold">Impacto (Ratio Before/After)</p>
                      <p className="text-3xl font-black text-green-500">-{reduccion}%</p>
                      <p className="text-xs mt-1">Desplazamiento: <strong>{evaluacion.impacto_estimado?.desplazamiento_crimen || 'N/A'}</strong></p>
                    </div>
                  </div>
                  
                  {/* Pseudo graph bar to visualize reduction */}
                  <div className="mt-6 pt-6 border-t border-border">
                    <div className="flex flex-col gap-2">
                       <div className="flex items-center gap-4">
                         <span className="w-16 text-xs text-muted-foreground font-medium text-right">Antes</span>
                         <div className="h-3 bg-red-500/50 rounded-full w-full relative overflow-hidden">
                           <div className="absolute inset-0 bg-red-500 w-full" />
                         </div>
                       </div>
                       <div className="flex items-center gap-4">
                         <span className="w-16 text-xs text-muted-foreground font-medium text-right">Después</span>
                         <div className="h-3 bg-green-500/50 rounded-full w-full relative overflow-hidden">
                           <div className="absolute inset-0 bg-green-500" style={{ width: `${100 - Number(reduccion)}%` }} />
                         </div>
                       </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold">Sin intervenciones</h3>
            <p className="text-sm text-muted-foreground mt-2">No se han registrado estrategias para reportar su evolución numérica.</p>
        </div>
      )}

      {/* Modal Crear Estrategia */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md rounded-xl border border-border shadow-2xl relative">
            <button 
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="p-6">
              <h2 className="text-xl font-bold mb-1">Registrar Estrategia</h2>
              <p className="text-sm text-muted-foreground mb-6">Ingresa los datos para proyectar y medir su impacto en la zona.</p>
              
              <form onSubmit={handleCrear} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Tipo de Intervención</label>
                  <select 
                    value={formData.tipo}
                    onChange={e => setFormData({ ...formData, tipo: e.target.value })}
                    className="w-full bg-muted border border-border p-2.5 rounded-lg text-sm"
                  >
                    <option>Plan Calles Sin Violencia</option>
                    <option>Aumento de Patrullaje Preventivo</option>
                    <option>Instalación de Luminarias</option>
                    <option>Cámaras Térmicas en Perímetro</option>
                    <option>Recuperación de Espacio Público</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Descripción</label>
                  <textarea 
                    required
                    rows={3}
                    placeholder="Detalles tácticos de la intervención..."
                    value={formData.descripcion}
                    onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                    className="w-full bg-muted border border-border p-2.5 rounded-lg text-sm"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Reducción delictual (%)</label>
                    <input 
                      type="number"
                      min="0" max="100"
                      value={formData.reduccion_estimada}
                      onChange={e => setFormData({ ...formData, reduccion_estimada: Number(e.target.value) })}
                      className="w-full bg-muted border border-border p-2.5 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Desplazamiento</label>
                    <select 
                      value={formData.desplazamiento}
                      onChange={e => setFormData({ ...formData, desplazamiento: e.target.value })}
                      className="w-full bg-muted border border-border p-2.5 rounded-lg text-sm"
                    >
                      <option>Bajo</option>
                      <option>Medio</option>
                      <option>Alto</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 mt-2 border-t border-border flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={creando}
                    className="px-6 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-lg transition-colors shadow-lg disabled:opacity-50"
                  >
                    {creando ? 'Registrando...' : 'Registrar y Calcular Impacto'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
