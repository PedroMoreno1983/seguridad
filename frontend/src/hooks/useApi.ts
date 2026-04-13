import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type { 
  Comuna, Delito, Prediccion, IndiceSeguridad, 
  DashboardResumen, ModeloInfo, FilterState 
} from '@/types';

// Configuración base de axios
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 5000, // 5 segundos máximo de espera
});

// ==========================================
// QUERIES
// ==========================================

// Comunas
export const useComunas = (region?: string, buscar?: string) => {
  return useQuery({
    queryKey: ['comunas', region, buscar],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (region) params.append('region', region);
      if (buscar) params.append('buscar', buscar);
      
      const { data } = await api.get<Comuna[]>(`/comunas?${params}`);
      return data;
    },
  });
};

export const useComuna = (id: number | null) => {
  return useQuery({
    queryKey: ['comuna', id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await api.get<Comuna>(`/comunas/${id}?incluir_bbox=true`);
      return data;
    },
    enabled: !!id,
  });
};

export const useRegiones = () => {
  return useQuery({
    queryKey: ['regiones'],
    queryFn: async () => {
      const { data } = await api.get('/regiones');
      return data;
    },
  });
};

// Dashboard
export const useDashboardResumen = (comunaId: number | null) => {
  return useQuery({
    queryKey: ['dashboard', comunaId],
    queryFn: async () => {
      if (!comunaId) return null;
      const { data } = await api.get<DashboardResumen>(`/dashboard/resumen?comuna_id=${comunaId}`);
      return data;
    },
    enabled: !!comunaId,
    staleTime: 1000 * 60 * 2, // 2 minutos
  });
};

// Delitos
export const useDelitos = (filters: FilterState) => {
  return useQuery({
    queryKey: ['delitos', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.comunaId) params.append('comuna_id', filters.comunaId.toString());
      if (filters.tipoDelito) params.append('tipo', filters.tipoDelito);
      if (filters.fechaDesde) params.append('fecha_desde', filters.fechaDesde);
      if (filters.fechaHasta) params.append('fecha_hasta', filters.fechaHasta);
      params.append('limit', '1000');
      
      const { data } = await api.get<Delito[]>(`/delitos?${params}`);
      return data;
    },
    enabled: !!filters.comunaId,
  });
};

export const useHeatmapData = (comunaId: number | null, dias: number = 730) => {
  return useQuery({
    queryKey: ['heatmap', comunaId, dias],
    queryFn: async () => {
      if (!comunaId) return null;
      const { data } = await api.get(`/delitos/heatmap?comuna_id=${comunaId}&dias=${dias}`);
      return data;
    },
    enabled: !!comunaId,
  });
};

export const useTiposDelito = () => {
  return useQuery({
    queryKey: ['tipos-delito'],
    queryFn: async () => {
      const { data } = await api.get('/delitos/tipos');
      return data.tipos as string[];
    },
  });
};

// Predicciones
export const usePredicciones = (comunaId: number | null, activas: boolean = true) => {
  return useQuery({
    queryKey: ['predicciones', comunaId, activas],
    queryFn: async () => {
      if (!comunaId) return [];
      const { data } = await api.get<Prediccion[]>(`/predicciones?comuna_id=${comunaId}&activas=${activas}`);
      return data;
    },
    enabled: !!comunaId,
  });
};

export const useZonasRiesgo = (comunaId: number | null, horas: number = 72) => {
  return useQuery({
    queryKey: ['zonas-riesgo', comunaId, horas],
    queryFn: async () => {
      if (!comunaId) return null;
      const { data } = await api.get(`/predicciones/zonas-riesgo?comuna_id=${comunaId}&horas=${horas}`);
      return data;
    },
    enabled: !!comunaId,
  });
};

export const useModelosDisponibles = () => {
  return useQuery({
    queryKey: ['modelos'],
    queryFn: async () => {
      const { data } = await api.get('/predicciones/modelos-disponibles');
      return data.modelos as ModeloInfo[];
    },
  });
};

// Índices
export const useIndices = (comunaId: number | null) => {
  return useQuery({
    queryKey: ['indices', comunaId],
    queryFn: async () => {
      if (!comunaId) return null;
      const { data } = await api.get<IndiceSeguridad>(`/indices?comuna_id=${comunaId}`);
      return data;
    },
    enabled: !!comunaId,
  });
};

export const useRanking = (region?: string) => {
  return useQuery({
    queryKey: ['ranking', region],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (region) params.append('region', region);
      params.append('limite', '50');
      
      const { data } = await api.get(`/indices/ranking?${params}`);
      return data;
    },
  });
};

// ==========================================
// MUTACIONES
// ==========================================

export const useGenerarPrediccion = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ comunaId, modelo, horizonte }: { 
      comunaId: number; 
      modelo: string; 
      horizonte: number;
    }) => {
      const { data } = await api.post('/predicciones/generar', {
        comuna_id: comunaId,
        modelo,
        horizonte_horas: horizonte,
      });
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['predicciones', variables.comunaId] });
      queryClient.invalidateQueries({ queryKey: ['zonas-riesgo', variables.comunaId] });
    },
  });
};
