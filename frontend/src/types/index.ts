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
  fecha_inicio?: string;
  fecha_fin?: string;
  horizonte_horas?: number;
  precision_historica?: number;
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

// ==========================================
// TIPOS DE UI
// ==========================================

export type UserRole = 'ciudadano' | 'autoridad' | 'tecnico';

export interface User {
  id: number;
  nombre: string;
  email: string;
  rol: UserRole;
  comuna_id?: number;
}

export interface FilterState {
  comunaId: number | null;
  tipoDelito: string | null;
  fechaDesde: string | null;
  fechaHasta: string | null;
  periodo: '1m' | '3m' | '6m' | '12m' | '24m';
}
