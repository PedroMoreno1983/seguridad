import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Database,
  FileText,
  Loader2,
  MapPinned,
  Play,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { useAgenticStatus, useAgentRuns, useApproveAgentAction, useCreateAgentRun } from '@/hooks/useApi';
import type { AgentRun, AgentSuggestedAction } from '@/types';

const DEFAULT_OBJECTIVE = 'Priorizar riesgo territorial, explicar marcas del mapa y proponer accion preventiva responsable';

const levelStyles: Record<string, string> = {
  bajo: 'border-green-200 bg-green-50 text-green-800',
  medio: 'border-yellow-200 bg-yellow-50 text-yellow-800',
  alto: 'border-orange-200 bg-orange-50 text-orange-800',
  critico: 'border-red-200 bg-red-50 text-red-800',
};

const actionIcons: Record<string, typeof MapPinned> = {
  generate_prediction: MapPinned,
  create_responsible_alert: ShieldCheck,
  audit_geocoding: Database,
  create_operational_briefing: FileText,
};

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function previewCount(action: AgentSuggestedAction): string | null {
  const count = asNumber(action.preview.zonas_estimadas);
  if (count !== null) return `${count} zonas`;
  const calidad = action.preview.calidad;
  if (calidad && typeof calidad === 'object' && 'score' in calidad) {
    const score = asNumber((calidad as { score?: unknown }).score);
    if (score !== null) return `${score.toFixed(1)}% geo`;
  }
  return null;
}

function latestRun(runs: AgentRun[]): AgentRun | null {
  return runs[0] ?? null;
}

export function AgenteGaasPage() {
  const { selectedComuna } = useAppStore();
  const [objective, setObjective] = useState(DEFAULT_OBJECTIVE);
  const comunaId = selectedComuna?.id ?? null;

  const { data: status, isLoading: loadingStatus } = useAgenticStatus(comunaId);
  const { data: runs = [], isLoading: loadingRuns } = useAgentRuns(comunaId);
  const createRun = useCreateAgentRun();
  const approveAction = useApproveAgentAction();

  const activeRun = useMemo(() => latestRun(runs), [runs]);
  const pendingActions = activeRun?.actions.filter((action) => action.status === 'pending') ?? [];
  const executedActions = activeRun?.actions.filter((action) => action.status === 'executed') ?? [];
  const quality = status?.metricas.calidad_georreferencial;
  const score = status?.score_operacional ?? 0;

  const handleCreateRun = () => {
    if (!comunaId) return;
    createRun.mutate({ comunaId, objective });
  };

  const handleApprove = (action: AgentSuggestedAction) => {
    if (!activeRun?.id || !action.id) return;
    approveAction.mutate({ runId: activeRun.id, actionId: action.id });
  };

  if (!selectedComuna) {
    return (
      <div className="atalaya-panel p-8 text-center text-muted-foreground">
        Selecciona una comuna para activar el agente.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <div className="border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="atalaya-kicker mb-2 flex items-center gap-2">
                <Bot className="h-4 w-4" />
                Agente GaaS territorial
              </div>
              <h1 className="atalaya-serif text-2xl font-semibold">Centro agentico de seguridad</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Diagnostica datos, explica por que marca zonas, prepara acciones y espera aprobacion humana antes de escribir.
              </p>
            </div>
            <div className={`rounded-sm border px-3 py-2 text-sm font-medium ${levelStyles[status?.estado_operacional === 'operativo' ? 'bajo' : 'medio']}`}>
              {status?.estado_operacional ?? (loadingStatus ? 'leyendo' : 'sin diagnostico')}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <Metric label="Score operativo" value={`${score.toFixed(1)}%`} />
            <Metric label="Registros utilizables" value={(quality?.usable ?? 0).toLocaleString('es-CL')} />
            <Metric label="Calidad geo" value={`${(quality?.score ?? 0).toFixed(1)}%`} />
            <Metric label="Hotspots" value={(status?.metricas.hotspots_detectados ?? 0).toString()} />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
            <label className="block">
              <span className="atalaya-kicker mb-2 block">Objetivo de la corrida</span>
              <textarea
                value={objective}
                onChange={(event) => setObjective(event.target.value)}
                className="h-24 w-full resize-none rounded-sm border border-border bg-background px-3 py-2 text-sm leading-6 outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
            <div className="flex items-end">
              <button
                onClick={handleCreateRun}
                disabled={createRun.isPending || !comunaId}
                className="inline-flex w-full items-center justify-center gap-2 rounded-sm bg-foreground px-4 py-3 text-sm font-semibold text-background transition-opacity disabled:opacity-50"
              >
                {createRun.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Planificar acciones
              </button>
            </div>
          </div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="atalaya-kicker mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Hallazgos
          </div>
          {loadingStatus ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Leyendo senales reales...
            </div>
          ) : (
            <div className="space-y-2">
              {(status?.hallazgos ?? []).map((item) => (
                <div key={item} className="rounded-sm border border-border bg-muted px-3 py-2 text-sm leading-5">
                  {item}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold">Acciones pendientes de aprobacion</h2>
              <p className="mt-1 text-xs text-muted-foreground">Cada accion muestra herramienta, criterio y efecto antes de escribir.</p>
            </div>
            <span className="atalaya-mono text-xs text-muted-foreground">
              {pendingActions.length} pendientes
            </span>
          </div>
          <div className="divide-y divide-border">
            {loadingRuns ? (
              <div className="p-5 text-sm text-muted-foreground">Cargando corridas...</div>
            ) : !activeRun ? (
              <div className="p-5 text-sm text-muted-foreground">Aun no hay corrida agentica para esta comuna.</div>
            ) : pendingActions.length === 0 ? (
              <div className="p-5 text-sm text-muted-foreground">No hay acciones pendientes en la ultima corrida.</div>
            ) : (
              pendingActions.map((action) => (
                <ActionRow
                  key={action.id ?? action.action_key}
                  action={action}
                  disabled={approveAction.isPending}
                  onApprove={() => handleApprove(action)}
                />
              ))
            )}
          </div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="atalaya-kicker mb-3">Ultima corrida</div>
          {activeRun ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-sm border border-border bg-muted p-3">
                <div className="text-xs text-muted-foreground">Estado</div>
                <div className="mt-1 font-semibold">{activeRun.status}</div>
              </div>
              <div className="rounded-sm border border-border bg-muted p-3">
                <div className="text-xs text-muted-foreground">Objetivo</div>
                <div className="mt-1 leading-5">{activeRun.objective}</div>
              </div>
              <div className="rounded-sm border border-border bg-muted p-3">
                <div className="text-xs text-muted-foreground">Ejecutadas</div>
                <div className="mt-1 font-semibold">{executedActions.length}</div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Planifica una corrida para abrir el ciclo intencion, herramienta, preview, aprobacion y auditoria.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border bg-muted p-3">
      <div className="atalaya-kicker text-[10px]">{label}</div>
      <div className="atalaya-serif mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function ActionRow({ action, disabled, onApprove }: { action: AgentSuggestedAction; disabled: boolean; onApprove: () => void }) {
  const Icon = actionIcons[action.action_key] ?? AlertTriangle;
  const badge = previewCount(action);

  return (
    <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_160px]">
      <div className="flex gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-muted">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{action.title}</h3>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${levelStyles[action.risk_level] ?? levelStyles.medio}`}>
              {action.risk_level}
            </span>
            {badge && <span className="atalaya-mono text-[10px] text-muted-foreground">{badge}</span>}
          </div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{action.description}</p>
          <div className="atalaya-mono mt-2 text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
            herramienta: {action.tool_name}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-start lg:justify-end">
        <button
          onClick={onApprove}
          disabled={disabled || !action.id}
          className="inline-flex items-center gap-2 rounded-sm border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
        >
          {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Aprobar
        </button>
      </div>
    </div>
  );
}
