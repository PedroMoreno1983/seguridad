import { useState, useCallback, useRef, useEffect } from 'react';
import Map, { Source, Layer } from 'react-map-gl';
import { Layers, Filter, Download, Info } from 'lucide-react';
import { useAppStore } from '@/store';
import { useHeatmapData, useZonasRiesgo, useTiposDelito } from '@/hooks/useApi';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

// Colores por tipo de delito para los círculos del heatmap
const COLOR_TIPO: Record<string, string> = {
  'Delito':                    '#ef4444',
  'Violencia Intrafamiliar':   '#dc2626',
  'Robo/Hurto':                '#f97316',
  'Infracción Tránsito Grave': '#eab308',
  'Intervención Policial':     '#a855f7',
  'Emergencia':                '#3b82f6',
  'Emergencia Médica':         '#06b6d4',
  'Ruidos/Desorden':           '#84cc16',
  'Fiscalización':             '#6b7280',
  'Infracción de Tránsito':    '#9ca3af',
  'Infracción Municipal':      '#d1d5db',
  'Persona en Situación Calle':'#fb923c',
};

export function MapaPage() {
  const { selectedComuna } = useAppStore();
  const mapRef = useRef<any>(null);

  const [viewState, setViewState] = useState({
    longitude: -70.633,
    latitude:  -33.545,
    zoom: 13,
  });

  const [capas, setCapas] = useState({ heatmap: true, predicciones: true });
  const [diasFiltro, setDiasFiltro] = useState(1400); // todo el período por defecto
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [mostrarInfo, setMostrarInfo] = useState<any>(null);

  const { data: heatmapData, isLoading: loadingHeat } = useHeatmapData(
    selectedComuna?.id || null,
    diasFiltro
  );
  const { data: zonasRiesgo } = useZonasRiesgo(selectedComuna?.id || null, 72);
  const { data: tipos } = useTiposDelito();

  // Auto-centrar en la comuna seleccionada
  useEffect(() => {
    if (!selectedComuna) return;
    const c = selectedComuna as any;

    // bbox puede ser lista [min_lon, min_lat, max_lon, max_lat] o dict {min_lon, min_lat, max_lon, max_lat}
    if (c.bbox) {
      let lon: number, lat: number;
      if (Array.isArray(c.bbox)) {
        lon = (c.bbox[0] + c.bbox[2]) / 2;
        lat = (c.bbox[1] + c.bbox[3]) / 2;
      } else {
        lon = (c.bbox.min_lon + c.bbox.max_lon) / 2;
        lat = (c.bbox.min_lat + c.bbox.max_lat) / 2;
      }
      setViewState((v) => ({ ...v, longitude: lon, latitude: lat, zoom: 13 }));
    } else if (c.centroid_lat) {
      setViewState((v) => ({
        ...v,
        latitude: c.centroid_lat,
        longitude: c.centroid_lon,
        zoom: 13,
      }));
    }
  }, [selectedComuna?.id]);

  const onMove = useCallback((evt: any) => setViewState(evt.viewState), []);

  // Filtrar puntos por tipo
  const puntosFiltrados = (heatmapData?.puntos || []).filter((p: any) =>
    tipoFiltro ? p.tipo === tipoFiltro : true
  );

  // Construir GeoJSON para el heatmap
  const heatmapGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: puntosFiltrados.map((p: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      properties: { intensity: p.intensity, tipo: p.tipo },
    })),
  };

  // GeoJSON zonas de riesgo
  const zonasGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: (zonasRiesgo?.zonas || []).map((z: any) => ({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [z.coordinates] },
      properties: { nivel: z.nivel, probabilidad: z.probabilidad, modelo: z.modelo },
    })),
  };

  // Tipos únicos presentes en los datos actuales
  const tiposPresentes = [...new Set((heatmapData?.puntos || []).map((p: any) => p.tipo))].sort();

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Configure VITE_MAPBOX_TOKEN para ver el mapa</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      {/* Panel lateral */}
      <div className="w-72 bg-card border border-border rounded-xl p-4 space-y-4 overflow-y-auto flex-shrink-0">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Capas
          </h2>
          <p className="text-sm text-muted-foreground">{selectedComuna?.nombre || 'Sin comuna'}</p>
        </div>

        {/* Capas */}
        <div className="space-y-2">
          <label className="flex items-center justify-between p-3 bg-muted rounded-lg cursor-pointer hover:bg-muted/80">
            <span className="text-sm">Mapa de Calor</span>
            <input type="checkbox" checked={capas.heatmap}
              onChange={(e) => setCapas({ ...capas, heatmap: e.target.checked })}
              className="rounded accent-blue-500"
            />
          </label>
          <label className="flex items-center justify-between p-3 bg-muted rounded-lg cursor-pointer hover:bg-muted/80">
            <span className="text-sm">Zonas de Riesgo (predicciones)</span>
            <input type="checkbox" checked={capas.predicciones}
              onChange={(e) => setCapas({ ...capas, predicciones: e.target.checked })}
              className="rounded accent-orange-500"
            />
          </label>
        </div>

        {/* Filtros */}
        <div className="border-t border-border pt-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filtros
          </h3>

          <div>
            <label className="text-xs text-muted-foreground">Período</label>
            <select
              value={diasFiltro}
              onChange={(e) => setDiasFiltro(Number(e.target.value))}
              className="w-full mt-1 p-2 text-sm bg-muted border border-border rounded-lg"
            >
              <option value={1400}>Todo el período</option>
              <option value={730}>Últimos 2 años</option>
              <option value={365}>Último año</option>
              <option value={180}>Últimos 6 meses</option>
              <option value={90}>Últimos 3 meses</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Tipo de incidente</label>
            <select
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value)}
              className="w-full mt-1 p-2 text-sm bg-muted border border-border rounded-lg"
            >
              <option value="">Todos</option>
              {tiposPresentes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="border-t border-border pt-4 space-y-2">
          <h3 className="text-sm font-semibold">Estadísticas</h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Puntos en mapa:</span>
              <span className="font-medium">{loadingHeat ? '...' : puntosFiltrados.length.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Zonas de riesgo:</span>
              <span className="font-medium">{zonasRiesgo?.total_zonas || 0}</span>
            </div>
            {heatmapData?.periodo_desde && (
              <div className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                Datos: {heatmapData.periodo_desde} → {heatmapData.periodo_hasta}
              </div>
            )}
          </div>
        </div>

        {/* Leyenda zonas */}
        {capas.predicciones && (zonasRiesgo?.total_zonas || 0) > 0 && (
          <div className="border-t border-border pt-4">
            <h3 className="text-xs font-semibold text-muted-foreground mb-2">NIVEL DE RIESGO</h3>
            <div className="space-y-1.5 text-xs">
              {[
                { nivel: 'Crítico',  color: '#ef4444' },
                { nivel: 'Alto',     color: '#f97316' },
                { nivel: 'Medio',    color: '#eab308' },
                { nivel: 'Bajo',     color: '#84cc16' },
                { nivel: 'Muy bajo', color: '#22c55e' },
              ].map(({ nivel, color }) => (
                <div key={nivel} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: color, opacity: 0.7 }} />
                  <span>{nivel}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Generadas desde Predicciones → basadas en hotspots reales
            </p>
          </div>
        )}
      </div>

      {/* Mapa */}
      <div className="flex-1 relative rounded-xl overflow-hidden border border-border">
        <Map
          ref={mapRef}
          {...viewState}
          onMove={onMove}
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          style={{ width: '100%', height: '100%' }}
        >
          {/* ── HEATMAP LAYER (datos reales) ── */}
          {capas.heatmap && heatmapGeoJSON.features.length > 0 && (
            <Source id="heatmap-source" type="geojson" data={heatmapGeoJSON}>
              {/* Capa de calor difuminada */}
              <Layer
                id="heatmap-heat"
                type="heatmap"
                paint={{
                  'heatmap-weight': ['interpolate', ['linear'], ['get', 'intensity'], 0, 0, 3, 1],
                  'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 1, 15, 3],
                  'heatmap-color': [
                    'interpolate', ['linear'], ['heatmap-density'],
                    0,   'rgba(0,0,255,0)',
                    0.2, 'rgba(0,255,255,0.5)',
                    0.4, 'rgba(0,255,0,0.7)',
                    0.6, 'rgba(255,255,0,0.8)',
                    0.8, 'rgba(255,128,0,0.9)',
                    1,   'rgba(255,0,0,1)',
                  ],
                  'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 15, 14, 30],
                  'heatmap-opacity': 0.75,
                }}
              />
              {/* Puntos individuales a zoom alto */}
              <Layer
                id="heatmap-points"
                type="circle"
                minzoom={14}
                paint={{
                  'circle-radius': 5,
                  'circle-color': '#ef4444',
                  'circle-opacity': 0.8,
                  'circle-stroke-width': 1,
                  'circle-stroke-color': '#fff',
                }}
              />
            </Source>
          )}

          {/* ── ZONAS DE RIESGO (predicciones) ── */}
          {capas.predicciones && zonasGeoJSON.features.length > 0 && (
            <Source id="zonas-source" type="geojson" data={zonasGeoJSON}>
              <Layer
                id="zonas-riesgo-fill"
                type="fill"
                paint={{
                  'fill-color': [
                    'match', ['get', 'nivel'],
                    'muy_bajo', '#22c55e',
                    'bajo',     '#84cc16',
                    'medio',    '#eab308',
                    'alto',     '#f97316',
                    'critico',  '#ef4444',
                    '#666',
                  ],
                  'fill-opacity': 0.35,
                }}
              />
              <Layer
                id="zonas-riesgo-border"
                type="line"
                paint={{
                  'line-color': [
                    'match', ['get', 'nivel'],
                    'muy_bajo', '#22c55e',
                    'bajo',     '#84cc16',
                    'medio',    '#eab308',
                    'alto',     '#f97316',
                    'critico',  '#ef4444',
                    '#666',
                  ],
                  'line-width': 2,
                  'line-opacity': 0.8,
                }}
              />
            </Source>
          )}
        </Map>

        {/* Tooltip de info */}
        {mostrarInfo && (
          <div className="absolute bottom-8 left-4 bg-card border border-border rounded-lg p-3 shadow-xl text-sm max-w-xs">
            <p className="font-medium">{mostrarInfo.tipo}</p>
            <p className="text-muted-foreground text-xs">{mostrarInfo.fecha}</p>
          </div>
        )}

        {/* Indicador de carga */}
        {loadingHeat && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg px-4 py-2 text-sm shadow-lg">
            Cargando datos...
          </div>
        )}

        {/* Sin datos */}
        {!loadingHeat && puntosFiltrados.length === 0 && capas.heatmap && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg px-4 py-2 text-sm shadow-lg flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            Sin datos para el período seleccionado
          </div>
        )}
      </div>
    </div>
  );
}
