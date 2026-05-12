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
