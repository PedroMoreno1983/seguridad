import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Loader2,
  MapPinned,
  Play,
  ShieldCheck,
  Sparkles,
  XCircle,
  Zap,
} from 'lucide-react';
import { useAppStore } from '@/store';
import {
  useAgenticStatus,
  useAgentRuns,
  useAskAgenticSecurity,
  useApproveAgentAction,
  useCreateAgentRun,
  useRejectAgentAction,
  useRunAgenticAutopilot,
  useRunAgenticMonitor,
} from '@/hooks/useApi';
import type { AgentRun, AgentSuggestedAction } from '@/types';

const DEFAULT_OBJECTIVE = 'Priorizar riesgo territorial, explicar marcas del mapa y proponer accion preventiva responsable';

const stateLabels: Record<string, string> = {
  operativo: 'Operativo',
  requiere_datos: 'Requiere datos',
  sin_datos: 'Sin datos',
  planned: 'Planificada',
  in_progress: 'En ejecucion',
  waiting_approval: 'Espera aprobacion',
  completed: 'Completada',
  pending: 'Pendiente',
  executed: 'Ejecutada',
  failed: 'Fallida',
  rejected: 'Descartada',
};

const levelClass: Record<string, string> = {
  bajo: 'border-green-200 bg-green-50 text-green-800',
  medio: 'border-amber-200 bg-amber-50 text-amber-800',
  alto: 'border-orange-200 bg-orange-50 text-orange-800',
  critico: 'border-red-200 bg-red-50 text-red-800',
};

function compactDate(value?: string) {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function previewLabel(action: AgentSuggestedAction) {
  const preview = action.preview;
  if (typeof preview.zonas_estimadas === 'number') {
    return `${preview.zonas_estimadas} zonas estimadas`;
  }
  if (typeof preview.confianza === 'number') {
    return `${Math.round(preview.confianza * 100)}% confianza`;
  }
  if (preview.calidad && typeof preview.calidad === 'object') {
    const quality = preview.calidad as { score?: number; usable?: number };
    return `${quality.score ?? 0}% calidad, ${quality.usable ?? 0} usables`;
  }
  const hallazgos = preview.hallazgos;
  if (Array.isArray(hallazgos)) return `${hallazgos.length} hallazgos`;
  return action.tool_name;
}

function pendingActions(run?: AgentRun | null) {
  return (run?.actions || []).filter((action) => action.status === 'pending');
}

export function AgentCenterPage() {
  const { selectedComuna } = useAppStore();
  const comunaId = selectedComuna?.id || null;
  const [objective, setObjective] = useState(DEFAULT_OBJECTIVE);
  const [question, setQuestion] = useState('Que zona debo priorizar y por que?');

  const { data: status, isLoading: loadingStatus } = useAgenticStatus(comunaId);
  const { data: runs = [], isLoading: loadingRuns } = useAgentRuns(comunaId);
  const createRun = useCreateAgentRun();
  const runAutopilot = useRunAgenticAutopilot();
  const runMonitor = useRunAgenticMonitor();
  const approveAction = useApproveAgentAction();
  const rejectAction = useRejectAgentAction();
  const askAgent = useAskAgenticSecurity();

  const latestRun = runs[0] || null;
  const openActions = useMemo(() => pendingActions(latestRun), [latestRun]);
  const quality = status?.metricas.calidad_georreferencial;
  const autonomy = status?.autonomy;
  const memoryRuns = status?.agent_memory?.recent_runs || [];
  const reasoning = status?.reasoning_trace || [];
  const readiness = status?.metricas.readiness_comercial;
  const fuentes = status?.metricas.fuentes_comunales;

  const handleCreateRun = () => {
    if (!comunaId) return;
    createRun.mutate({ comunaId, objective });
  };

  const handleAutopilot = () => {
    if (!comunaId) return;
    runAutopilot.mutate({ comunaId, objective, executeSafeActions: true });
  };

  const handleMonitor = () => {
    runMonitor.mutate({ executeSafeActions: true, limit: 10 });
  };

  const handleApprove = (runId: number, actionId?: number) => {
    if (!actionId) return;
    approveAction.mutate({ runId, actionId });
  };

  const handleReject = (runId: number, actionId?: number) => {
    if (!actionId) return;
    rejectAction.mutate({
      runId,
      actionId,
      reason: 'Descartada por operador desde el centro agentico.',
    });
  };

  const handleAsk = () => {
    if (!comunaId || !question.trim()) return;
    askAgent.mutate({ comunaId, question: question.trim() });
  };

  if (!selectedComuna) {
    return (
      <div className="atalaya-panel p-8 text-center text-sm text-muted-foreground">
        Selecciona una comuna para activar el agente.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <div className="border border-border bg-card p-5">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="atalaya-kicker mb-2 flex items-center gap-2">
                <Bot className="h-4 w-4" />
                Centro agentico
              </div>
              <h1 className="atalaya-serif text-3xl font-semibold tracking-normal">Agente GaaS territorial</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Diagnostica datos reales, explica por que marca zonas y ejecuta acciones solo con aprobacion humana.
              </p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${levelClass[status?.estado_operacional || 'medio'] || levelClass.medio}`}>
              {stateLabels[status?.estado_operacional || ''] || 'Evaluando'}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-6">
            <Metric label="Score operativo" value={loadingStatus ? '...' : `${status?.score_operacional ?? 0}%`} icon={Activity} />
            <Metric label="Registros usables" value={loadingStatus ? '...' : String(quality?.usable ?? 0)} icon={ShieldCheck} />
            <Metric label="Hotspots" value={loadingStatus ? '...' : String(status?.metricas.hotspots_detectados ?? 0)} icon={MapPinned} />
            <Metric label="Predicciones activas" value={loadingStatus ? '...' : String(status?.metricas.predicciones_activas ?? 0)} icon={Sparkles} />
            <Metric label="Auto seguras" value={loadingStatus ? '...' : String(autonomy?.auto_executable_actions ?? 0)} icon={Zap} />
            <Metric label="Bases comuna" value={loadingStatus ? '...' : String(fuentes?.total_files ?? 0)} icon={Database} />
          </div>

          <div className="mt-5 border border-border bg-muted p-4">
            <label className="atalaya-kicker mb-2 block">Objetivo del agente</label>
            <textarea
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
              rows={3}
              className="w-full resize-none rounded-sm border border-border bg-card px-3 py-2 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                El autopiloto ejecuta tareas seguras y deja predicciones o alertas sensibles pendientes de aprobacion.
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleCreateRun}
                  disabled={createRun.isPending || !comunaId}
                  className="inline-flex items-center gap-2 rounded-sm border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
                >
                  {createRun.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Plan supervisado
                </button>
                <button
                  onClick={handleAutopilot}
                  disabled={runAutopilot.isPending || !comunaId}
                  className="inline-flex items-center gap-2 rounded-sm bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
                >
                  {runAutopilot.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  Autopiloto seguro
                </button>
                <button
                  onClick={handleMonitor}
                  disabled={runMonitor.isPending}
                  className="inline-flex items-center gap-2 rounded-sm border border-cyan-700/30 bg-cyan-50 px-4 py-2 text-sm font-medium text-cyan-950 hover:bg-cyan-100 disabled:opacity-50"
                >
                  {runMonitor.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                  Monitor comunas
                </button>
              </div>
            </div>
          </div>

          {fuentes?.available && (
            <div className="mt-4 rounded-sm border border-border bg-background px-4 py-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <div className="atalaya-kicker">Bases comunales detectadas</div>
                <span className="atalaya-mono text-[10px] text-muted-foreground">
                  {readiness?.archivos_absorbidos ?? 0}/{readiness?.archivos_disponibles ?? fuentes.total_files} absorbidas
                </span>
              </div>
              <div className="grid gap-3 text-xs text-muted-foreground md:grid-cols-3">
                <MiniMetric label="Excel" value={fuentes.excel_files?.length ?? 0} />
                <MiniMetric label="Documentos" value={fuentes.document_files?.length ?? 0} />
                <MiniMetric label="Incidentes" value={readiness?.incidentes_total ?? 0} />
              </div>
              {readiness?.brechas?.length ? (
                <div className="mt-3 space-y-1 border-t border-border pt-2">
                  {readiness.brechas.slice(0, 3).map((gap) => (
                    <div key={gap} className="text-xs leading-5 text-muted-foreground">{gap}</div>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {reasoning.length > 0 && (
            <div className="mt-4 grid gap-2 md:grid-cols-4">
              {reasoning.map((item) => (
                <div key={item.step} className="rounded-sm border border-border bg-background px-3 py-2">
                  <div className="atalaya-kicker text-[9px]">{item.step}</div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 border border-border bg-background p-4">
            <label className="atalaya-kicker mb-2 block">Consulta analitica</label>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_170px]">
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                className="rounded-sm border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="Preguntale por una zona, tendencia o accion prioritaria"
              />
              <button
                onClick={handleAsk}
                disabled={askAgent.isPending || !question.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-sm border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                {askAgent.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Preguntar
              </button>
            </div>
            {askAgent.data && (
              <div className="mt-3 rounded-sm border border-cyan-700/25 bg-cyan-50 p-3 text-sm leading-6 text-cyan-950">
                <p className="font-semibold">{askAgent.data.answer}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {askAgent.data.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <div className="mt-3 border-t border-cyan-700/20 pt-2 text-xs text-cyan-900">
                  {askAgent.data.guardrail}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="atalaya-kicker mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Hallazgos
          </div>
          {loadingStatus ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Revisando comuna...
            </div>
          ) : (
            <div className="space-y-3">
              {(status?.hallazgos || []).map((finding) => (
                <div key={finding} className="border-l-2 border-primary bg-muted px-3 py-2 text-sm leading-6">
                  {finding}
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                <MiniMetric label="Exacta" value={quality?.exacta ?? 0} />
                <MiniMetric label="Sector" value={quality?.sector ?? 0} />
                <MiniMetric label="Comuna" value={quality?.comuna ?? 0} />
                <MiniMetric label="Sin senal" value={quality?.sin_senal ?? 0} />
              </div>
              {memoryRuns.length > 0 && (
                <div className="border-t border-border pt-3">
                  <div className="atalaya-kicker mb-2">Memoria operativa</div>
                  <div className="space-y-2">
                    {memoryRuns.slice(0, 3).map((run) => (
                      <div key={run.id} className="rounded-sm border border-border bg-background px-3 py-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">Run #{run.id}</span>
                          <span className="atalaya-mono text-[10px] text-muted-foreground">
                            {stateLabels[run.status] || run.status}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                          <span>{run.autonomy_level}</span>
                          <span>{run.executed_actions}/{run.total_actions} ejecutadas</span>
                          <span>{run.pending_sensitive_actions} sensibles</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="font-semibold">Acciones confirmables</h2>
              <p className="mt-1 text-xs text-muted-foreground">Preview antes de escritura, ejecucion auditada despues de aprobar.</p>
            </div>
            <span className="atalaya-mono text-xs text-muted-foreground">{openActions.length} pendientes</span>
          </div>

          {!latestRun && !loadingRuns ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Ejecuta un diagnostico para que el agente proponga acciones.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {(latestRun?.actions || []).map((action) => (
                <div key={action.id || action.action_key} className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_180px]">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${levelClass[action.risk_level] || levelClass.medio}`}>
                        {action.risk_level}
                      </span>
                      <span className="atalaya-mono text-[10px] uppercase text-muted-foreground">{action.tool_name}</span>
                    </div>
                    <h3 className="font-semibold">{action.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{action.description}</p>
                    <div className="mt-3 rounded-sm border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                      {previewLabel(action)}
                    </div>
                  </div>
                  <div className="flex flex-col justify-between gap-3">
                    <span className="atalaya-mono text-xs text-muted-foreground">
                      {stateLabels[action.status || ''] || action.status || 'Pendiente'}
                    </span>
                    {action.status === 'pending' ? (
                      <div className="grid gap-2">
                        <button
                          onClick={() => handleApprove(latestRun?.id || 0, action.id)}
                          disabled={approveAction.isPending}
                          className="inline-flex items-center justify-center gap-2 rounded-sm bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                        >
                          {approveAction.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                          {action.requires_approval ? 'Aprobar' : 'Ejecutar'}
                        </button>
                        {action.requires_approval && (
                          <button
                            onClick={() => handleReject(latestRun?.id || 0, action.id)}
                            disabled={rejectAction.isPending}
                            className="inline-flex items-center justify-center gap-2 rounded-sm border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
                          >
                            {rejectAction.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                            Descartar
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="inline-flex items-center justify-center gap-2 rounded-sm border border-border px-3 py-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4" />
                        {stateLabels[action.status || ''] || action.status || 'Procesada'}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-semibold">Bitacora agentica</h2>
            <p className="mt-1 text-xs text-muted-foreground">Ultimas corridas por comuna.</p>
          </div>
          <div className="max-h-[560px] divide-y divide-border overflow-y-auto">
            {loadingRuns ? (
              <div className="p-5 text-sm text-muted-foreground">Cargando bitacora...</div>
            ) : runs.length === 0 ? (
              <div className="p-5 text-sm text-muted-foreground">Sin corridas registradas.</div>
            ) : (
              runs.map((run) => (
                <div key={run.id} className="p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="font-medium">Run #{run.id}</span>
                    <span className="atalaya-mono text-[10px] text-muted-foreground">{compactDate(run.created_at)}</span>
                  </div>
                  <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{run.objective}</p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="rounded-full border border-border px-2 py-0.5 text-[11px]">
                      {stateLabels[run.status] || run.status}
                    </span>
                    <span className="atalaya-mono text-[10px] text-muted-foreground">
                      {(run.autonomy_level || 'supervised')} - {run.actions.filter((action) => action.status === 'executed').length}/{run.actions.length} acciones
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Activity }) {
  return (
    <div className="border border-border bg-background p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="atalaya-kicker text-[9px]">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="atalaya-serif text-2xl font-semibold">{value}</div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-sm border border-border bg-card px-2 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="atalaya-mono">{Number(value).toLocaleString('es-CL')}</span>
    </div>
  );
}
