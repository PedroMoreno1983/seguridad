import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type { 
  Comuna, Delito, Prediccion, IndiceSeguridad, 
  DashboardResumen, ModeloInfo, FilterState, PrevencionSocialResumen, EducacionComunal, User,
  AgenticStatus, AgentRun, AgentAnswer,
} from '@/types';

// Configuración base de axios
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 5000,
});

// Inyectar token JWT en cada request desde el store persistido en localStorage
api.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem('safecity-storage');
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: { token?: string } };
      const token = parsed?.state?.token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  } catch {
    // localStorage no disponible o JSON inválido — continuar sin token
  }
  return config;
});

// Redirigir al login si el backend devuelve 401 (token expirado o inválido)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      try {
        const raw = localStorage.getItem('safecity-storage');
        if (raw) {
          const parsed = JSON.parse(raw) as { state?: { token?: string } };
          if (parsed?.state?.token) {
            // Limpiar sesión y forzar re-login
            const cleared = { ...parsed, state: { ...parsed.state, token: null, user: null, isAuthenticated: false } };
            localStorage.setItem('safecity-storage', JSON.stringify(cleared));
            window.location.href = '/';
          }
        }
      } catch {
        // ignorar
      }
    }
    return Promise.reject(error);
  },
);

async function requireLiveData<T>(request: () => Promise<T>): Promise<T> {
  return request();
}

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
      
      return requireLiveData(
        async () => {
          params.append('incluir_bbox', 'true');
          const { data } = await api.get<Comuna[]>(`/comunas?${params}`);
          return data;
        }
      );
    },
  });
};

export const useComuna = (id: number | null) => {
  return useQuery({
    queryKey: ['comuna', id],
    queryFn: async () => {
      if (!id) return null;
      return requireLiveData(
        async () => {
          const { data } = await api.get<Comuna>(`/comunas/${id}?incluir_bbox=true`);
          return data;
        }
      );
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
      return requireLiveData(
        async () => {
          const { data } = await api.get<DashboardResumen>(`/dashboard/resumen?comuna_id=${comunaId}`);
          return data;
        }
      );
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
      
      return requireLiveData(
        async () => {
          const { data } = await api.get<Delito[]>(`/delitos?${params}`);
          return data;
        }
      );
    },
    enabled: !!filters.comunaId,
  });
};

export const useHeatmapData = (comunaId: number | null, dias: number = 730) => {
  return useQuery({
    queryKey: ['heatmap', comunaId, dias],
    queryFn: async () => {
      if (!comunaId) return null;
      return requireLiveData(
        async () => {
          const { data } = await api.get(`/delitos/heatmap?comuna_id=${comunaId}&dias=${dias}`);
          return data;
        }
      );
    },
    enabled: !!comunaId,
  });
};

export const useGeorefQuality = (comunaId: number | null, dias: number = 730) => {
  return useQuery({
    queryKey: ['georef-quality', comunaId, dias],
    queryFn: async () => {
      if (!comunaId) return null;
      return requireLiveData(
        async () => {
          const { data } = await api.get(`/delitos/georef-quality?comuna_id=${comunaId}&dias=${dias}`);
          return data;
        }
      );
    },
    enabled: !!comunaId,
    staleTime: 1000 * 60 * 5,
  });
};

export const useTiposDelito = () => {
  return useQuery({
    queryKey: ['tipos-delito'],
    queryFn: async () => {
      return requireLiveData(
        async () => {
          const { data } = await api.get('/delitos/tipos');
          return data.tipos as string[];
        }
      );
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
      
      return requireLiveData(
        async () => {
          const { data } = await api.get(`/indices/ranking?${params}`);
          return data;
        }
      );
    },
  });
};

export const usePrevencionSocial = (comunaId: number | null) => {
  return useQuery({
    queryKey: ['prevencion-social', comunaId],
    queryFn: async () => {
      if (!comunaId) return null;
      const { data } = await api.get<PrevencionSocialResumen>(`/prevencion/resumen?comuna_id=${comunaId}`);
      return data;
    },
    enabled: !!comunaId,
    staleTime: 1000 * 60 * 5,
  });
};

export const useEducacionComunal = (comunaId: number | null) => {
  return useQuery({
    queryKey: ['educacion-comunal', comunaId],
    queryFn: async () => {
      if (!comunaId) return [];
      const { data } = await api.get<EducacionComunal[]>(`/prevencion/educacion?comuna_id=${comunaId}`);
      return data;
    },
    enabled: !!comunaId,
    staleTime: 1000 * 60 * 10,
  });
};

export const useAgenticStatus = (comunaId: number | null, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['agentic-status', comunaId],
    queryFn: async () => {
      if (!comunaId) return null;
      const { data } = await api.get<AgenticStatus>(`/agentic/status?comuna_id=${comunaId}`);
      return data;
    },
    enabled: !!comunaId && enabled,
    staleTime: 1000 * 60,
  });
};

export const useAgentRuns = (comunaId: number | null, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['agent-runs', comunaId],
    queryFn: async () => {
      if (!comunaId) return [];
      const { data } = await api.get<AgentRun[]>(`/agentic/runs?comuna_id=${comunaId}`);
      return data;
    },
    enabled: !!comunaId && enabled,
  });
};

// ==========================================
// MUTACIONES
// ==========================================

export const useGenerarPrediccion = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ comunaId, modelo, horizonte, tipoDelito, franjaHoraria, factoresExogenos }: { 
      comunaId: number; 
      modelo: string; 
      horizonte: number;
      tipoDelito?: string;
      franjaHoraria?: string;
      factoresExogenos?: boolean;
    }) => {
      const { data } = await api.post('/predicciones/generar', {
        comuna_id: comunaId,
        modelo,
        horizonte_horas: horizonte,
        tipo_delito: tipoDelito,
        franja_horaria: franjaHoraria,
        factores_exogenos: factoresExogenos
      });
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['predicciones', variables.comunaId] });
      queryClient.invalidateQueries({ queryKey: ['zonas-riesgo', variables.comunaId] });
    },
  });
};

// ==========================================
// EVALUACIONES Y PARTICIPACIÓN
// ==========================================

export const useCreateAgentRun = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ comunaId, objective }: { comunaId: number; objective: string }) => {
      const { data } = await api.post<AgentRun>('/agentic/runs', {
        comuna_id: comunaId,
        objective,
      });
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['agent-runs', variables.comunaId] });
      queryClient.invalidateQueries({ queryKey: ['agentic-status', variables.comunaId] });
    },
  });
};

export const useRunAgenticAutopilot = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ comunaId, objective, executeSafeActions = true }: {
      comunaId: number;
      objective: string;
      executeSafeActions?: boolean;
    }) => {
      const { data } = await api.post<AgentRun>('/agentic/autopilot', {
        comuna_id: comunaId,
        objective,
        execute_safe_actions: executeSafeActions,
        autonomy_level: 'autopilot',
      });
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['agent-runs', variables.comunaId] });
      queryClient.invalidateQueries({ queryKey: ['agentic-status', variables.comunaId] });
      queryClient.invalidateQueries({ queryKey: ['predicciones', variables.comunaId] });
      queryClient.invalidateQueries({ queryKey: ['zonas-riesgo', variables.comunaId] });
      queryClient.invalidateQueries({ queryKey: ['prevencion-social', variables.comunaId] });
    },
  });
};

export const useRunAgenticMonitor = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ comunaIds, executeSafeActions = true, limit = 10 }: {
      comunaIds?: number[];
      executeSafeActions?: boolean;
      limit?: number;
    }) => {
      const { data } = await api.post('/agentic/monitor', {
        comuna_ids: comunaIds,
        execute_safe_actions: executeSafeActions,
        limit,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-runs'] });
      queryClient.invalidateQueries({ queryKey: ['agentic-status'] });
      queryClient.invalidateQueries({ queryKey: ['predicciones'] });
      queryClient.invalidateQueries({ queryKey: ['zonas-riesgo'] });
      queryClient.invalidateQueries({ queryKey: ['prevencion-social'] });
    },
  });
};

export const useApproveAgentAction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ runId, actionId }: { runId: number; actionId: number }) => {
      const { data } = await api.post<AgentRun>(`/agentic/runs/${runId}/actions/${actionId}/approve`);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['agent-runs', data.comuna_id] });
      queryClient.invalidateQueries({ queryKey: ['agentic-status', data.comuna_id] });
      queryClient.invalidateQueries({ queryKey: ['predicciones', data.comuna_id] });
      queryClient.invalidateQueries({ queryKey: ['zonas-riesgo', data.comuna_id] });
      queryClient.invalidateQueries({ queryKey: ['prevencion-social', data.comuna_id] });
      queryClient.invalidateQueries({ queryKey: ['evaluaciones', data.comuna_id] });
    },
  });
};

export const useRejectAgentAction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ runId, actionId, reason }: { runId: number; actionId: number; reason: string }) => {
      const { data } = await api.post<AgentRun>(`/agentic/runs/${runId}/actions/${actionId}/reject`, {
        reason,
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['agent-runs', data.comuna_id] });
      queryClient.invalidateQueries({ queryKey: ['agentic-status', data.comuna_id] });
    },
  });
};

export const useAskAgenticSecurity = () => {
  return useMutation({
    mutationFn: async ({ comunaId, question }: { comunaId: number; question: string }) => {
      const { data } = await api.post<AgentAnswer>('/agentic/ask', {
        comuna_id: comunaId,
        question,
      });
      return data;
    },
  });
};

export const useEvaluaciones = (comunaId: number | null) => {
  return useQuery({
    queryKey: ['evaluaciones', comunaId],
    queryFn: async () => {
      if (!comunaId) return [];
      const { data } = await api.get(`/evaluaciones?comuna_id=${comunaId}`);
      return data;
    },
    enabled: !!comunaId,
  });
};

export const useCrearEvaluacion = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (evaluacion: { comuna_id: number; tipo: string; descripcion: string; reduccion_estimada: number; desplazamiento: string }) => {
      const { data } = await api.post('/evaluaciones', evaluacion);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['evaluaciones', variables.comuna_id] });
    },
  });
};

export const useParticipacion = (comunaId: number | null) => {
  return useQuery({
    queryKey: ['participacion', comunaId],
    queryFn: async () => {
      if (!comunaId) return [];
      const { data } = await api.get(`/participacion?comuna_id=${comunaId}`);
      return data;
    },
    enabled: !!comunaId,
  });
};

export const useCrearReporteCiudadano = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (reporte: any) => {
      const { data } = await api.post('/participacion', reporte);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['participacion', variables.comuna_id] });
    },
  });
};

export const useCrearAlertaResponsable = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alerta: {
      comuna_id: number;
      categoria: string;
      nivel_riesgo: string;
      descripcion: string;
      confianza: number;
      accion_sugerida?: string;
      responsable?: string;
      plazo_horas?: number;
    }) => {
      const { data } = await api.post('/prevencion/alertas', alerta);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['prevencion-social', variables.comuna_id] });
    },
  });
};

export const useActualizarAlertaResponsable = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ alertaId, comunaId, estado, decision }: {
      alertaId: number;
      comunaId: number;
      estado: string;
      decision: string;
    }) => {
      const { data } = await api.patch(`/prevencion/alertas/${alertaId}`, {
        estado,
        decision,
      });
      return { data, comunaId };
    },
    onSuccess: ({ comunaId }) => {
      queryClient.invalidateQueries({ queryKey: ['prevencion-social', comunaId] });
    },
  });
};

// ==========================================
// REPORTES IA
// ==========================================

export const useReporteEjecutivo = (comunaId: number | null, modelo: string = 'SEPP') => {
  return useQuery({
    queryKey: ['reporte-ejecutivo', comunaId, modelo],
    queryFn: async () => {
      if (!comunaId) return null;
      const { data } = await api.get(`/reportes/ejecutivo?comuna_id=${comunaId}&modelo=${modelo}`);
      return data;
    },
    enabled: !!comunaId,
    staleTime: 1000 * 60 * 60, // 1 hora
  });
};

// ==========================================
// ADMINISTRACION DE USUARIOS
// ==========================================

export const useUsuariosAdmin = () => {
  return useQuery({
    queryKey: ['usuarios-admin'],
    queryFn: async () => {
      const { data } = await api.get<User[]>('/auth/users');
      return data;
    },
  });
};

export const useActualizarUsuarioAdmin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, payload }: { userId: number; payload: Partial<User> & { activo?: boolean } }) => {
      const { data } = await api.patch<User>(`/auth/users/${userId}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios-admin'] });
    },
  });
};

export const useResetPasswordAdmin = () => {
  return useMutation({
    mutationFn: async ({ userId, password }: { userId: number; password: string }) => {
      const { data } = await api.post(`/auth/users/${userId}/reset-password`, {
        password_nueva: password,
      });
      return data;
    },
  });
};

export const useActualizarPerfil = () => {
  return useMutation({
    mutationFn: async (payload: { nombre?: string; email?: string; comuna_id?: number }) => {
      const { data } = await api.put<User>('/auth/me', payload);
      return data;
    },
  });
};

export const useCambiarPassword = () => {
  return useMutation({
    mutationFn: async (payload: { password_actual: string; password_nueva: string }) => {
      const { data } = await api.put('/auth/me/password', payload);
      return data;
    },
  });
};

// ==========================================
// FUENTES PRIVADAS
// ==========================================

export const useFuentesPrivadasResumen = () => {
  return useQuery({
    queryKey: ['fuentes-privadas-resumen'],
    queryFn: async () => {
      const { data } = await api.get('/fuentes-privadas/resumen');
      return data;
    },
    staleTime: 1000 * 60 * 30,
  });
};

export const useFuentesPrivadasCatalogo = (vertical: string, prioridadMax: number) => {
  return useQuery({
    queryKey: ['fuentes-privadas-catalogo', vertical, prioridadMax],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (vertical) params.append('vertical', vertical);
      params.append('prioridad_max', String(prioridadMax));
      const { data } = await api.get(`/fuentes-privadas/catalogo?${params}`);
      return data;
    },
    staleTime: 1000 * 60 * 30,
  });
};

export const useFuentesPrivadasPlaybook = (vertical: string) => {
  return useQuery({
    queryKey: ['fuentes-privadas-playbook', vertical],
    queryFn: async () => {
      const { data } = await api.get(`/fuentes-privadas/playbook/${vertical || 'retail'}`);
      return data;
    },
    staleTime: 1000 * 60 * 30,
  });
};

export const usePrivadosResumenOperativo = (dias: number = 365) => {
  return useQuery({
    queryKey: ['privados-resumen-operativo', dias],
    queryFn: async () => {
      const { data } = await api.get(`/privados/resumen-operativo?dias=${dias}`);
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
};

export const usePrivadosOrganizaciones = () => {
  return useQuery({
    queryKey: ['privados-organizaciones'],
    queryFn: async () => {
      const { data } = await api.get('/privados/organizaciones');
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
};

export const usePrivadosSedes = () => {
  return useQuery({
    queryKey: ['privados-sedes'],
    queryFn: async () => {
      const { data } = await api.get('/privados/sedes');
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
};

export const usePrivadosIncidentes = (limit: number = 20) => {
  return useQuery({
    queryKey: ['privados-incidentes', limit],
    queryFn: async () => {
      const { data } = await api.get(`/privados/incidentes?limit=${limit}`);
      return data;
    },
    staleTime: 1000 * 60 * 2,
  });
};
