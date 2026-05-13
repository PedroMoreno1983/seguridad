import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Plus,
  Scale,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { useActualizarAlertaResponsable, useCrearAlertaResponsable, useEducacionComunal, usePrevencionSocial } from '@/hooks/useApi';

const nivelStyles: Record<string, string> = {
  bajo: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  medio: 'bg-amber-50 text-amber-800 border-amber-200',
  alto: 'bg-orange-50 text-orange-800 border-orange-200',
  critico: 'bg-red-50 text-red-800 border-red-200',
};

function pct(value?: number) {
  if (value === undefined || value === null) return 'N/A';
  return `${value.toFixed(1)}%`;
}

function num(value?: number) {
  if (value === undefined || value === null) return 'N/A';
  return value.toLocaleString('es-CL');
}

function StatCard({ icon: Icon, label, value, detail, color }: any) {
  return (
    <div className="border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-sm ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 text-right">
          <div className="atalaya-mono text-[10px] uppercase text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-semibold leading-none">{value}</div>
          {detail && <div className="mt-1 text-xs text-muted-foreground">{detail}</div>}
        </div>
      </div>
    </div>
  );
}

export function PrevencionPage() {
  const { selectedComuna } = useAppStore();
  const { data, isLoading, isError } = usePrevencionSocial(selectedComuna?.id || null);
  const { data: historicoEducacion } = useEducacionComunal(selectedComuna?.id || null);
  const { mutate: crearAlerta, isPending } = useCrearAlertaResponsable();
  const { mutate: actualizarAlerta, isPending: actualizando } = useActualizarAlertaResponsable();
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    categoria: 'riesgo_social_preventivo',
    nivel_riesgo: 'medio',
    descripcion: '',
    confianza: 0.65,
    accion_sugerida: '',
    responsable: 'Equipo territorial',
    plazo_horas: 72,
  });

  const scoreWidth = useMemo(() => `${Math.min(100, data?.indice_prevencion_social?.score || 0)}%`, [data]);
  const historicoData = useMemo(() => {
    return [...(historicoEducacion || [])]
      .sort((a, b) => a.anio - b.anio)
      .map((item) => ({
        anio: item.anio,
        tasa: item.tasa_desvinculacion ?? 0,
        desvinculados: item.estudiantes_desvinculados ?? 0,
        matricula: item.matricula_total ?? 0,
      }));
  }, [historicoEducacion]);

  const handleCrear = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedComuna) return;
    crearAlerta(
      {
        comuna_id: selectedComuna.id,
        ...formData,
      },
      {
        onSuccess: () => {
          setModalOpen(false);
          setFormData({ ...formData, descripcion: '', accion_sugerida: '' });
        },
      },
    );
  };

  const resolverAlerta = (alertaId: number | null | undefined, estado: string) => {
    if (!alertaId || !selectedComuna) return;
    const decision = estado === 'derivada'
      ? 'Derivada a revision intersectorial con responsable humano.'
      : 'Descartada como alerta operativa; se conserva trazabilidad para auditoria.';
    actualizarAlerta({
      alertaId,
      comunaId: selectedComuna.id,
      estado,
      decision,
    });
  };

  if (!selectedComuna) {
    return (
      <div className="border border-border bg-card p-8 text-center text-muted-foreground">
        Selecciona una comuna para revisar prevencion social.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <div>
          <div className="atalaya-kicker mb-2">Prevención responsable</div>
          <h1 className="atalaya-serif text-2xl font-semibold">Riesgo social preventivo</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            No fue posible conectar con la API de prevencion.
          </p>
        </div>
        <div className="border border-border bg-card p-8">
          <div className="text-sm font-semibold">Servicio no disponible</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta vista requiere datos oficiales cargados en backend; no se muestran valores estimados.
          </p>
        </div>
      </div>
    );
  }

  const educacion = data.educacion;
  const indice = data.indice_prevencion_social;
  const hasOfficialEducation = Boolean(educacion && indice);
  const nivel = indice?.nivel || 'bajo';

  if (!hasOfficialEducation || !educacion || !indice) {
    return (
      <div className="space-y-6">
        <div>
          <div>
            <div className="atalaya-kicker mb-2">Prevención responsable</div>
            <h1 className="atalaya-serif text-2xl font-semibold">Riesgo social preventivo</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              No hay datos oficiales CEM/Mineduc cargados para {data.comuna.nombre}.
            </p>
          </div>
        </div>

        <div className="border border-border bg-card p-8">
          <div className="text-sm font-semibold">Fuente oficial pendiente</div>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Los indicadores de desvinculacion se habilitan solo con registros oficiales CEM/Mineduc validados para la comuna.
            Esta pantalla presenta solo series provenientes de fuentes oficiales cargadas.
          </p>
        </div>

        <section className="border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="font-semibold">Bitacora de alertas responsables</h2>
              <p className="mt-1 text-xs text-muted-foreground">Registro de señal, decisión humana y acción sugerida.</p>
            </div>
            <AlertTriangle className="h-5 w-5 text-amber-700" />
          </div>
          <div className="p-8 text-center text-sm text-muted-foreground">
            {data.alertas.length ? 'Hay alertas registradas sin indicador educativo asociado.' : 'No hay alertas registradas para esta comuna.'}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="atalaya-kicker mb-2">Prevención responsable</div>
          <h1 className="atalaya-serif text-2xl font-semibold">Riesgo social preventivo</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Cruce comunal de desvinculacion escolar, incidentes y alertas auditables para orientar acciones proporcionales.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Registrar alerta
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={ShieldCheck}
          label="Indice preventivo"
          value={indice.score.toFixed(1)}
          detail={nivel.toUpperCase()}
          color="bg-blue-50 text-blue-800"
        />
        <StatCard
          icon={BookOpen}
          label="Desvinculacion"
          value={pct(educacion.tasa_desvinculacion)}
          detail={`${num(educacion.estudiantes_desvinculados)} estudiantes`}
          color="bg-amber-50 text-amber-800"
        />
        <StatCard
          icon={Users}
          label="Inasistencia grave"
          value={pct(educacion.inasistencia_grave_pct)}
          detail={`${num(educacion.matricula_total)} matricula`}
          color="bg-purple-50 text-purple-800"
        />
        <StatCard
          icon={ClipboardList}
          label="Alertas pendientes"
          value={data.metricas.alertas_pendientes}
          detail={`${data.metricas.alertas_derivadas} derivadas`}
          color="bg-rose-50 text-rose-800"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <section className="border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">Lectura territorial</h2>
              <p className="mt-1 text-sm text-muted-foreground">{data.comuna.nombre} · {educacion.anio}</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase ${nivelStyles[nivel]}`}>
              {nivel}
            </span>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Riesgo social preventivo</span>
              <span>{indice.score.toFixed(1)} / 100</span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-sm bg-muted">
              <div className="h-full bg-blue-700" style={{ width: scoreWidth }} />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="border border-border p-4">
              <div className="atalaya-kicker">Revinculacion</div>
              <div className="mt-2 text-xl font-semibold">{pct(educacion.tasa_revinculacion)}</div>
              <div className="mt-1 text-sm text-muted-foreground">{num(educacion.estudiantes_revinculados)} estudiantes revinculados</div>
            </div>
            <div className="border border-border p-4">
              <div className="atalaya-kicker">Tasa delictual comunal</div>
              <div className="mt-2 text-xl font-semibold">{num(data.metricas.tasa_delictual_100k)}</div>
              <div className="mt-1 text-sm text-muted-foreground">casos por 100.000 habitantes</div>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold">Recomendaciones</h3>
            <div className="mt-3 space-y-3">
              {data.recomendaciones.map((rec) => (
                <div key={`${rec.tipo}-${rec.titulo}`} className="border-l-2 border-primary bg-muted/40 p-3">
                  <div className="text-sm font-medium">{rec.titulo}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{rec.detalle}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Criterios de uso</h2>
          </div>
          <div className="mt-4 space-y-3">
            {data.principios.map((principio) => (
              <div key={principio} className="flex gap-3 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                <span className="text-muted-foreground">{principio}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 border border-border p-4">
            <div className="atalaya-kicker">Fuente educativa</div>
            <div className="mt-2 text-sm font-medium">{educacion.fuente}</div>
            <div className="mt-1 text-xs text-muted-foreground">{educacion.metodologia}</div>
          </div>
        </section>
      </div>

      <section className="border border-border bg-card">
        <div className="flex flex-col gap-2 border-b border-border px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold">Desvinculacion por anio</h2>
            <p className="mt-1 text-xs text-muted-foreground">Serie comunal CEM/Mineduc: tasa de incidencia y estudiantes desvinculados.</p>
          </div>
          <div className="atalaya-mono text-[10px] uppercase text-muted-foreground">
            {historicoData[0]?.anio || 'N/A'} - {historicoData[historicoData.length - 1]?.anio || 'N/A'}
          </div>
        </div>
        {historicoData.length > 0 ? (
          <div className="grid grid-cols-1 gap-0 xl:grid-cols-2">
            <div className="border-b border-border p-5 xl:border-b-0 xl:border-r">
              <div className="mb-3 flex items-center justify-between">
                <div className="atalaya-kicker">Tasa de desvinculacion</div>
                <div className="text-sm font-medium">{pct(historicoData[historicoData.length - 1]?.tasa)}</div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historicoData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="anio" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      formatter={(value: number, name: string) => [name === 'tasa' ? `${Number(value).toFixed(2)}%` : value, 'Tasa']}
                      labelFormatter={(label) => `Anio ${label}`}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '4px', color: 'hsl(var(--foreground))' }}
                    />
                    <Line type="monotone" dataKey="tasa" stroke="#1d6f82" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="atalaya-kicker">Estudiantes desvinculados</div>
                <div className="text-sm font-medium">{num(historicoData[historicoData.length - 1]?.desvinculados)}</div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={historicoData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="anio" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                    <Tooltip
                      formatter={(value: number, name: string) => [Number(value).toLocaleString('es-CL'), name === 'desvinculados' ? 'Estudiantes' : name]}
                      labelFormatter={(label) => `Anio ${label}`}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '4px', color: 'hsl(var(--foreground))' }}
                    />
                    <Bar dataKey="desvinculados" fill="#b45309" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No hay historial educativo cargado para esta comuna.
          </div>
        )}
      </section>

      <section className="border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="font-semibold">Bitacora de alertas responsables</h2>
            <p className="mt-1 text-xs text-muted-foreground">Registro de señal, decisión humana y acción sugerida.</p>
          </div>
          <AlertTriangle className="h-5 w-5 text-amber-700" />
        </div>
        <div className="divide-y divide-border">
          {data.alertas.map((alerta, index) => (
            <div key={alerta.id ?? index} className="grid gap-4 p-5 lg:grid-cols-[180px_minmax(0,1fr)_220px]">
              <div>
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase ${nivelStyles[alerta.nivel_riesgo]}`}>
                  {alerta.nivel_riesgo}
                </span>
                <div className="atalaya-mono mt-2 text-[10px] uppercase text-muted-foreground">{alerta.estado}</div>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium">{alerta.categoria.replace(/_/g, ' ')}</div>
                <p className="mt-1 text-sm text-muted-foreground">{alerta.descripcion}</p>
                {alerta.accion_sugerida && (
                  <p className="mt-3 text-sm text-foreground">{alerta.accion_sugerida}</p>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                <div>Confianza: <span className="font-medium text-foreground">{Math.round((alerta.confianza || 0) * 100)}%</span></div>
                <div className="mt-1">Responsable: <span className="font-medium text-foreground">{alerta.responsable || 'Sin asignar'}</span></div>
                <div className="mt-1">Plazo: <span className="font-medium text-foreground">{alerta.plazo_horas || 72}h</span></div>
                {alerta.decision && <div className="mt-2 text-xs">{alerta.decision}</div>}
                {alerta.id && alerta.estado === 'pendiente' && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => resolverAlerta(alerta.id, 'derivada')}
                      disabled={actualizando}
                      className="rounded-sm border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                    >
                      Derivar
                    </button>
                    <button
                      onClick={() => resolverAlerta(alerta.id, 'descartada')}
                      disabled={actualizando}
                      className="rounded-sm border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
                    >
                      Descartar
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg border border-border bg-card shadow-2xl">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute right-4 top-4 rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
            <form onSubmit={handleCrear} className="p-6">
              <h2 className="text-lg font-semibold">Registrar alerta responsable</h2>
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="font-medium">Categoria</span>
                    <input
                      value={formData.categoria}
                      onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                      className="mt-1 w-full rounded-sm border border-border bg-background p-2"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="font-medium">Nivel</span>
                    <select
                      value={formData.nivel_riesgo}
                      onChange={(e) => setFormData({ ...formData, nivel_riesgo: e.target.value })}
                      className="mt-1 w-full rounded-sm border border-border bg-background p-2"
                    >
                      <option value="bajo">Bajo</option>
                      <option value="medio">Medio</option>
                      <option value="alto">Alto</option>
                      <option value="critico">Critico</option>
                    </select>
                  </label>
                </div>
                <label className="block text-sm">
                  <span className="font-medium">Descripcion</span>
                  <textarea
                    required
                    rows={3}
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    className="mt-1 w-full rounded-sm border border-border bg-background p-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">Accion sugerida</span>
                  <textarea
                    rows={2}
                    value={formData.accion_sugerida}
                    onChange={(e) => setFormData({ ...formData, accion_sugerida: e.target.value })}
                    className="mt-1 w-full rounded-sm border border-border bg-background p-2"
                  />
                </label>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <label className="text-sm">
                    <span className="font-medium">Confianza</span>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.05"
                      value={formData.confianza}
                      onChange={(e) => setFormData({ ...formData, confianza: Number(e.target.value) })}
                      className="mt-1 w-full rounded-sm border border-border bg-background p-2"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="font-medium">Plazo horas</span>
                    <input
                      type="number"
                      min="1"
                      max="720"
                      value={formData.plazo_horas}
                      onChange={(e) => setFormData({ ...formData, plazo_horas: Number(e.target.value) })}
                      className="mt-1 w-full rounded-sm border border-border bg-background p-2"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="font-medium">Responsable</span>
                    <input
                      value={formData.responsable}
                      onChange={(e) => setFormData({ ...formData, responsable: e.target.value })}
                      className="mt-1 w-full rounded-sm border border-border bg-background p-2"
                    />
                  </label>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3 border-t border-border pt-4">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-sm px-4 py-2 text-sm text-muted-foreground hover:bg-muted">
                  Cancelar
                </button>
                <button type="submit" disabled={isPending} className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {isPending ? 'Registrando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
