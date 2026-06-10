import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  MapPinned,
  Play,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAppStore } from '@/store';
import {
  useAgenticStatus,
  useAgentRuns,
  useAskAgenticSecurity,
  useApproveAgentAction,
  useCreateAgentRun,
} from '@/hooks/useApi';
import type { AgentRun, AgentSuggestedAction } from '@/types';

const DEFAULT_OBJECTIVE = 'Priorizar riesgo territorial, explicar marcas del mapa y proponer accion preventiva responsable';

const stateLabels: Record<string, string> = {
  operativo: 'Operativo',
  requiere_datos: 'Requiere datos',
  sin_datos: 'Sin datos',
  planned: 'Planificada',
  in_progress: 'En ejecucion',
  completed: 'Completada',
  pending: 'Pendiente',
  executed: 'Ejecutada',
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
  const approveAction = useApproveAgentAction();
  const askAgent = useAskAgenticSecurity();

  const latestRun = runs[0] || null;
  const openActions = useMemo(() => pendingActions(latestRun), [latestRun]);
  const quality = status?.metricas.calidad_georreferencial;

  const handleCreateRun = () => {
    if (!comunaId) return;
    createRun.mutate({ comunaId, objective });
  };

  const handleApprove = (runId: number, actionId?: number) => {
    if (!actionId) return;
    approveAction.mutate({ runId, actionId });
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

          <div className="grid gap-3 sm:grid-cols-4">
            <Metric label="Score operativo" value={loadingStatus ? '...' : `${status?.score_operacional ?? 0}%`} icon={Activity} />
            <Metric label="Registros usables" value={loadingStatus ? '...' : String(quality?.usable ?? 0)} icon={ShieldCheck} />
            <Metric label="Hotspots" value={loadingStatus ? '...' : String(status?.metricas.hotspots_detectados ?? 0)} icon={MapPinned} />
            <Metric label="Predicciones activas" value={loadingStatus ? '...' : String(status?.metricas.predicciones_activas ?? 0)} icon={Sparkles} />
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
                Cada corrida genera plan, preview y auditoria antes de tocar datos operativos.
              </div>
              <button
                onClick={handleCreateRun}
                disabled={createRun.isPending || !comunaId}
                className="inline-flex items-center gap-2 rounded-sm bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
              >
                {createRun.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Ejecutar diagnostico
              </button>
            </div>
          </div>

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
                      <button
                        onClick={() => handleApprove(latestRun?.id || 0, action.id)}
                        disabled={approveAction.isPending}
                        className="inline-flex items-center justify-center gap-2 rounded-sm bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                      >
                        {approveAction.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                        Aprobar
                      </button>
                    ) : (
                      <div className="inline-flex items-center justify-center gap-2 rounded-sm border border-border px-3 py-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4" />
                        Ejecutada
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
                      {run.actions.filter((action) => action.status === 'executed').length}/{run.actions.length} acciones
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
