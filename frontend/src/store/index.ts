import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Comuna, User, FilterState, UserRole } from '@/types';

interface AppState {
  // Usuario y autenticación
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  login: (user: User) => void;
  logout: () => void;
  
  // Comuna seleccionada
  selectedComuna: Comuna | null;
  setSelectedComuna: (comuna: Comuna | null) => void;
  
  // Filtros globales
  filters: FilterState;
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  
  // UI State
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  
  // Map State
  mapCenter: { lat: number; lng: number };
  mapZoom: number;
  setMapView: (center: { lat: number; lng: number }, zoom: number) => void;
  
  // Theme
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

const defaultFilters: FilterState = {
  comunaId: null,
  tipoDelito: null,
  fechaDesde: null,
  fechaHasta: null,
  periodo: '12m',
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Auth
      user: {
        id: 1,
        nombre: 'Usuario Demo',
        email: 'demo@safecity.cl',
        rol: 'autoridad' as UserRole,
        comuna_id: 22, // Peñalolén
      },
      isAuthenticated: true,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      login: (user) => set({ user, isAuthenticated: true }),
      logout: () => set({ user: null, isAuthenticated: false, selectedComuna: null }),
      
      // Comuna
      selectedComuna: null,
      setSelectedComuna: (comuna) => set({ selectedComuna: comuna }),
      
      // Filtros
      filters: defaultFilters,
      setFilters: (newFilters) => set((state) => ({
        filters: { ...state.filters, ...newFilters }
      })),
      resetFilters: () => set({ filters: defaultFilters }),
      
      // UI
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      
      // Map
      mapCenter: { lat: -33.45, lng: -70.65 }, // Santiago centro
      mapZoom: 11,
      setMapView: (center, zoom) => set({ mapCenter: center, mapZoom: zoom }),
      
      // Theme
      theme: 'dark',
      toggleTheme: () => set((state) => ({ 
        theme: state.theme === 'dark' ? 'light' : 'dark' 
      })),
    }),
    {
      name: 'safecity-storage',
      partialize: (state) => ({
        user: state.user,
        theme: state.theme,
        selectedComuna: state.selectedComuna,
      }),
    }
  )
);
