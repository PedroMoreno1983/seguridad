// ==========================================
// TIPOS DE LA API
// ==========================================

export interface Comuna {
  id: number;
  codigo_ine: string;
  nombre: string;
  region: string;
  provincia: string;
  poblacion?: number;
  superficie_km2?: number;
  densidad_poblacional?: number;
  bbox?: [number, number, number, number]; // [minx, miny, maxx, maxy]
  centroid_lat?: number;
  centroid_lon?: number;
}

export interface Delito {
  id: number;
  tipo_delito: string;
  subtipo?: string;
  latitud?: number;
  longitud?: number;
  geocode_precision?: 'exacta' | 'sector' | 'comuna' | 'sin_senal';
  geocode_source?: string;
  geocode_confidence?: number;
  barrio?: string;
  direccion?: string;
  fecha_hora?: string;
  fuente: string;
  confianza: number;
}

export interface Prediccion {
  id: number;
  modelo: string;
  nivel_riesgo: 'muy_bajo' | 'bajo' | 'medio' | 'alto' | 'critico';
  probabilidad?: number;
  centro: { lat: number; lon: number };
  bbox?: [number, number, number, number];
  fecha_prediccion?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  horizonte_horas?: number;
  precision_historica?: number;
  features_utilizados?: Record<string, unknown>;
}

export interface IndiceSeguridad {
  id: number;
  comuna_id: number;
  fecha: string;
  indices: {
    global?: number;
    percepcion?: number;
    victimizacion?: number;
    temor?: number;
    prevencion?: number;
  };
  tasas: {
    delictual?: number;
    homicidios?: number;
    robos?: number;
    hurtos?: number;
    resolucion?: number;
  };
  rankings: {
    nacional?: number;
    regional?: number;
  };
  tendencia?: 'subiendo' | 'estable' | 'bajando';
  cambio_porcentual?: number;
}

export interface DashboardResumen {
  comuna: {
    id: number;
    nombre: string;
    region: string;
    poblacion?: number;
    superficie_km2?: number;
  };
  indice_seguridad?: IndiceSeguridad;
  estadisticas_delitos: {
    total_ultimos_12m: number;
    tasa_100k?: number;
    top_5_tipos: { tipo: string; cantidad: number }[];
    evolucion_mensual: { anio: number; mes: number; cantidad: number }[];
    periodo?: {
      desde?: string;
      hasta?: string;
    };
  };
  tendencias: {
    cambio_mensual_porcentaje: number;
    direccion: 'subiendo' | 'estable' | 'bajando';
    delitos_mes_actual: number;
    delitos_mes_anterior: number;
  };
  kpi: {
    indice_global?: number;
    ranking_nacional?: number;
    tendencia_anual?: string;
  };
  calidad_datos?: {
    nivel_cobertura: 'alta' | 'media' | 'baja' | 'sin_eventos';
    total_registros: number;
    registros_geocodificados: number;
    registros_exactos?: number;
    registros_sectorizados?: number;
    registros_comunales?: number;
    porcentaje_geocodificado: number;
    tipos_raw_distintos: number;
    fuentes: { fuente: string; cantidad: number }[];
    periodo_disponible: {
      desde?: string;
      hasta?: string;
    };
    nota?: string;
  };
}

export interface ModeloInfo {
  id: string;
  nombre: string;
  descripcion: string;
  efectividad: string;
  tiempo_calculo: string;
  recomendado: boolean;
}

export interface EducacionComunal {
  id?: number | null;
  comuna_id: number;
  anio: number;
  matricula_total?: number;
  estudiantes_desvinculados?: number;
  tasa_desvinculacion?: number;
  estudiantes_revinculados?: number;
  tasa_revinculacion?: number;
  inasistencia_grave_pct?: number;
  retiro_basica_pct?: number;
  retiro_media_pct?: number;
  fuente?: string;
  metodologia?: string;
  fecha_actualizacion?: string;
  extra_data?: Record<string, unknown>;
}

export interface AlertaResponsable {
  id?: number | null;
  comuna_id: number;
  origen: string;
  categoria: string;
  nivel_riesgo: 'bajo' | 'medio' | 'alto' | 'critico';
  descripcion: string;
  confianza?: number;
  accion_sugerida?: string;
  estado: 'pendiente' | 'en_revision' | 'derivada' | 'descartada' | string;
  responsable?: string;
  plazo_horas?: number;
  decision?: string | null;
  criterios?: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PrevencionSocialResumen {
  comuna: {
    id: number;
    nombre: string;
    region: string;
    poblacion?: number;
  };
  educacion: EducacionComunal | null;
  indice_prevencion_social: {
    score: number;
    nivel: 'bajo' | 'medio' | 'alto' | 'critico';
  } | null;
  alertas: AlertaResponsable[];
  metricas: {
    alertas_pendientes: number;
    alertas_derivadas: number;
    tasa_delictual_100k?: number;
    total_incidentes_comunales: number;
  };
  recomendaciones: {
    tipo: string;
    titulo: string;
    detalle: string;
  }[];
  principios: string[];
}

export interface AgentMapZone {
  id: string;
  source: 'agente' | 'prediccion' | string;
  label: string;
  nivel: 'bajo' | 'medio' | 'alto' | 'critico' | string;
  confidence: number;
  bbox: [number, number, number, number];
  center?: { lat: number; lon: number };
  reason: string;
  metrics?: Record<string, unknown>;
}

export interface AgentMapPoint {
  lat: number;
  lon: number;
  count: number;
  recent_count?: number;
  previous_count?: number;
  trend?: string;
  trend_ratio?: number;
  dominant_type?: string;
  dominant_share?: number;
  intensity?: number;
  last_seen?: string | null;
  bbox: [number, number, number, number];
}

export interface AgentSuggestedAction {
  id?: number;
  action_key: string;
  tool_name: string;
  title: string;
  description: string;
  risk_level: 'bajo' | 'medio' | 'alto' | 'critico' | string;
  requires_approval: boolean;
  status?: 'pending' | 'executed' | 'failed' | string;
  preview: Record<string, unknown>;
  result?: Record<string, unknown> | null;
}

export interface AgenticStatus {
  comuna: { id: number; nombre: string; region: string };
  objective: string;
  estado_operacional: 'operativo' | 'requiere_datos' | 'sin_datos' | string;
  score_operacional: number;
  metricas: {
    calidad_georreferencial: {
      dias: number;
      total: number;
      exacta: number;
      sector: number;
      comuna: number;
      sin_senal: number;
      usable: number;
      score: number;
      periodo_desde?: string | null;
      periodo_hasta?: string | null;
    };
    hotspots_detectados: number;
    predicciones_activas: number;
    top_tipos?: { tipo: string; cantidad: number }[];
    tendencia_temporal?: {
      last_30: number;
      previous_30: number;
      trend: string;
      change_pct: number;
    };
    alertas_abiertas?: number;
    readiness_comercial?: {
      estado: string;
      incidentes_total: number;
      incidentes_usables: number;
      archivos_disponibles: number;
      archivos_absorbidos: number;
      brechas: string[];
    };
    fuentes_comunales?: {
      available: boolean;
      comuna_dir?: string | null;
      total_files: number;
      latest_file?: string | null;
      excel_files?: { name: string; relative_path: string; size: number; updated_at: string }[];
      document_files?: { name: string; relative_path: string; size: number; updated_at: string }[];
    };
  };
  hallazgos: string[];
  actions: AgentSuggestedAction[];
  map_overlays: {
    zonas: AgentMapZone[];
    puntos: AgentMapPoint[];
  };
  autonomy?: {
    level: 'supervised' | 'autopilot' | string;
    agent_version: string;
    safe_tools: string[];
    sensitive_tools: string[];
    auto_executable_actions: number;
    approval_required_actions: number;
  };
  agent_memory?: {
    recent_runs: {
      id: number;
      objective: string;
      status: string;
      autonomy_level: string;
      created_at?: string | null;
      total_actions: number;
      executed_actions: number;
      pending_sensitive_actions: number;
      failed_actions: number;
    }[];
    last_run?: Record<string, unknown> | null;
    learning?: string;
  };
  reasoning_trace?: {
    step: string;
    detail: string;
  }[];
}

export interface AgentRun {
  id: number;
  comuna_id: number;
  user_id?: number;
  objective: string;
  status: 'planned' | 'in_progress' | 'completed' | string;
  summary: Omit<AgenticStatus, 'actions'>;
  autonomy_level?: string;
  agent_version?: string;
  reasoning_trace?: AgenticStatus['reasoning_trace'];
  last_observation?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
  actions: AgentSuggestedAction[];
  autopilot?: {
    executed: { id: number; tool_name: string }[];
    failed: { id: number; tool_name: string; error?: string }[];
    pending_actions: number;
    run_status: string;
  };
}

export interface AgentAnswer {
  question: string;
  answer: string;
  bullets: string[];
  evidence: {
    quality?: AgenticStatus['metricas']['calidad_georreferencial'];
    temporal?: AgenticStatus['metricas']['tendencia_temporal'];
    top_types?: { tipo: string; cantidad: number }[];
    readiness?: AgenticStatus['metricas']['readiness_comercial'];
    sources?: AgenticStatus['metricas']['fuentes_comunales'];
    agent_memory?: AgenticStatus['agent_memory'];
    zones?: AgentMapZone[];
    points?: AgentMapPoint[];
  };
  map_focus?: AgentMapZone | null;
  recommended_actions: string[];
  guardrail: string;
  answer_source?: 'gemini' | 'rule_engine' | string;
  llm_status?: 'generated' | 'unavailable' | 'not_used' | string;
  llm_model?: string | null;
  llm_error?: string;
  confidence?: number | null;
  limitations?: string[];
  follow_up_questions?: string[];
}

// ==========================================
// TIPOS DE UI
// ==========================================

export type UserRole = 'ciudadano' | 'autoridad' | 'tecnico' | 'admin' | 'viewer' | 'manager';
export type TipoUsuario = 'territorial' | 'organizacion';

export interface User {
  id: number;
  nombre: string;
  email: string;
  rol: UserRole;
  tipo_usuario: TipoUsuario;
  comuna_id?: number;
  organizacion_id?: number;
  activo?: boolean;
  avatar_color?: string;
  created_at?: string;
}

export interface FilterState {
  comunaId: number | null;
  tipoDelito: string | null;
  fechaDesde: string | null;
  fechaHasta: string | null;
  periodo: '1m' | '3m' | '6m' | '12m' | '24m';
}
