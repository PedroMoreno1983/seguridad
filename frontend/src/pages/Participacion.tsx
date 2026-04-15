import { useState } from 'react';
import { Users, AlertTriangle, MessageSquare, PlusCircle } from 'lucide-react';
import { useAppStore } from '@/store';
import { useParticipacion, useCrearReporteCiudadano } from '@/hooks/useApi';

export function ParticipacionPage() {
  const { selectedComuna } = useAppStore();
  const { data: reportes, isLoading } = useParticipacion(selectedComuna?.id || null);
  const crearMutation = useCrearReporteCiudadano();

  const [formOpen, setFormOpen] = useState(false);
  const [tipo, setTipo] = useState('percepcion_inseguridad');
  const [desc, setDesc] = useState('');
  const [grav, setGrav] = useState('medio');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComuna) return;
    crearMutation.mutate({
      comuna_id: selectedComuna.id,
      tipo_reporte: tipo,
      descripcion: desc,
      nivel_gravedad: grav,
      latitud: selectedComuna.centroid_lat, // Placeholder centrado
      longitud: selectedComuna.centroid_lon
    }, {
      onSuccess: () => {
        setFormOpen(false);
        setDesc('');
      }
    });
  };

  const getSeverityColor = (s: string) => {
    if (s === 'alto') return 'bg-red-500/10 text-red-500 border-red-500/20';
    if (s === 'medio') return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    return 'bg-green-500/10 text-green-500 border-green-500/20';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            Participación Ciudadana
          </h1>
          <p className="text-muted-foreground mt-2">
            Aportes y percepciones de la comunidad para integrar factores cualitativos en la analítica de inteligencia urbana.
          </p>
        </div>
        <button
          onClick={() => setFormOpen(!formOpen)}
          className="flex-shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2"
        >
          {formOpen ? 'Cancelar' : <><PlusCircle className="h-4 w-4" /> Ingresar Reporte</>}
        </button>
      </div>

      {formOpen && (
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Nuevo Reporte Comunitario</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Tipo de reporte</label>
                <select value={tipo} onChange={e => setTipo(e.target.value)} className="w-full mt-1 p-2.5 bg-muted border border-border rounded-lg text-sm">
                  <option value="percepcion_inseguridad">Percepción de Inseguridad (General)</option>
                  <option value="iluminacion_defectuosa">Problemas de Iluminación o Infraestructura</option>
                  <option value="vandalismo">Vandalismo y Daños</option>
                  <option value="actividad_sospechosa">Puntos de Tráfico / Actividad Sospechosa</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Nivel de Preocupación</label>
                <select value={grav} onChange={e => setGrav(e.target.value)} className="w-full mt-1 p-2.5 bg-muted border border-border rounded-lg text-sm">
                  <option value="bajo">Bajo (Informativo)</option>
                  <option value="medio">Medio (Atención Requerida)</option>
                  <option value="alto">Alto (Urgente / Constante)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Descripción cualitativa breve</label>
              <textarea 
                required
                value={desc} 
                onChange={e => setDesc(e.target.value)} 
                className="w-full mt-1 p-3 bg-muted border border-border rounded-lg text-sm" 
                rows={3} 
                placeholder="Ej: Vecinos reportan personas bebiendo y molestando en la plaza principal durante la tarde." 
              />
            </div>
            <div className="flex justify-end">
              <button disabled={crearMutation.isPending} type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 rounded-lg text-sm font-medium">
                {crearMutation.isPending ? 'Ingresando...' : 'Guardar en Bitácora'}
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">Cargando bitácora ciudadana...</div>
      ) : reportes && reportes.length > 0 ? (
        <div className="space-y-3">
          {reportes.map((reporte: any) => (
             <div key={reporte.id} className="bg-card border border-border rounded-xl p-5 hover:border-muted-foreground/30 transition-colors">
               <div className="flex gap-4">
                 <div className={`mt-1 p-2 rounded-full border flex-shrink-0 ${getSeverityColor(reporte.nivel_gravedad)}`}>
                   <AlertTriangle className="h-5 w-5" />
                 </div>
                 <div className="flex-1">
                   <div className="flex justify-between items-start">
                     <h4 className="font-semibold">{reporte.tipo_reporte.replace(/_/g, ' ').toUpperCase()}</h4>
                     <span className="text-xs text-muted-foreground">{new Date(reporte.fecha).toLocaleDateString()}</span>
                   </div>
                   <p className="text-sm text-foreground/80 mt-1">{reporte.descripcion}</p>
                   <div className="mt-3 flex gap-2">
                     <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-sm border ${getSeverityColor(reporte.nivel_gravedad)}`}>
                       Gravedad: {reporte.nivel_gravedad}
                     </span>
                     <span className="text-[10px] flex items-center gap-1 text-muted-foreground uppercase px-2 py-1 rounded-sm border border-border">
                       <MessageSquare className="h-3 w-3" /> Auditado Comunitario
                     </span>
                   </div>
                 </div>
               </div>
             </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          No hay reportes comunitarios integrados aún.
        </div>
      )}
    </div>
  );
}
