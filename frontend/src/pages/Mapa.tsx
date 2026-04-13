import { useState, useCallback, useRef, useEffect } from 'react';
import Map, { Source, Layer, Popup } from 'react-map-gl';
import { Layers, Filter, Info } from 'lucide-react';
import { useAppStore } from '@/store';
import { useHeatmapData, useZonasRiesgo } from '@/hooks/useApi';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

const NIVEL_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  critico:  { label: 'Crítico',  color: '#ef4444', bg: 'bg-red-500/20',    border: 'border-red-500/40' },
  alto:     { label: 'Alto',     color: '#f97316', bg: 'bg-orange-500/20', border: 'border-orange-500/40' },
  medio:    { label: 'Medio',    color: '#eab308', bg: 'bg-yellow-500/20', border: 'border-yellow-500/40' },
  bajo:     { label: 'Bajo',     color: '#84cc16', bg: 'bg-lime-500/20',   border: 'border-lime-500/40' },
  muy_bajo: { label: 'Muy bajo', color: '#22c55e', bg: 'bg-green-500/20',  border: 'border-green-500/40' },
};

export function MapaPage() {
  const { selectedComuna } = useAppStore();
  const mapRef = useRef<any>(null);

  const [viewState, setViewState] = useState({
    longitude: -70.633,
    latitude: -33.545,
    zoom: 13,
  });

  const [capas, setCapas] = useState({ heatmap: true, predicciones: true });
  const [diasFiltro, setDiasFiltro] = useState(1400);
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [popup, setPopup] = useState<{ lon: number; lat: number; zona: any } | null>(null);

  const { data: heatmapData, isLoading: loadingHeat } = useHeatmapData(
    selectedComuna?.id || null, diasFiltro
  );
  const { data: zonasRiesgo } = useZonasRiesgo(selectedComuna?.id || null, 72);

  // Auto-centrar al cambiar de comuna
  useEffect(() => {
    if (!selectedComuna) return;
    const c = selectedComuna as any;
    if (c.bbox) {
      const [minLon, minLat, maxLon, maxLat] = Array.isArray(c.bbox)
        ? c.bbox
        : [c.bbox.min_lon, c.bbox.min_lat, c.bbox.max_lon, c.bbox.max_lat];
      setViewState(v => ({ ...v, longitude: (minLon + maxLon) / 2, latitude: (minLat + maxLat) / 2, zoom: 13 }));
    } else if (c.centroid_lat) {
      setViewState(v => ({ ...v, latitude: c.centroid_lat, longitude: c.centroid_lon, zoom: 13 }));
    }
    setPopup(null);
  }, [selectedComuna?.id]);

  const onMove = useCallback((evt: any) => setViewState(evt.viewState), []);

  // Filtrar por tipo
  const puntosFiltrados = (heatmapData?.puntos || []).filter((p: any) =>
    tipoFiltro ? p.tipo === tipoFiltro : true
  );

  // GeoJSON heatmap
  const heatmapGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: puntosFiltrados.map((p: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      properties: { weight: p.intensity || 1, tipo: p.tipo },
    })),
  };

  // GeoJSON zonas de riesgo
  const zonasGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: (zonasRiesgo?.zonas || []).map((z: any) => ({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [z.coordinates] },
      properties: {
        nivel: z.nivel,
        probabilidad: z.probabilidad,
        modelo: z.modelo,
        horizonte: z.horizonte,
        color: NIVEL_CONFIG[z.nivel]?.color || '#666',
      },
    })),
  };

  const tiposPresentes = [...new Set((heatmapData?.puntos || []).map((p: any) => p.tipo))].sort() as string[];

  // Click en zonas de riesgo
  const handleMapClick = useCallback((e: any) => {
    if (!capas.predicciones || !zonasRiesgo?.zonas?.length) return;
    const features = e.features || [];
    const zonaFeature = features.find((f: any) => f.layer?.id === 'zonas-fill');
    if (zonaFeature) {
      setPopup({
        lon: e.lngLat.lng,
        lat: e.lngLat.lat,
        zona: zonaFeature.properties,
      });
    } else {
      setPopup(null);
    }
  }, [capas.predicciones, zonasRiesgo]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Configure VITE_MAPBOX_TOKEN para ver el mapa</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      {/* ── Panel lateral ── */}
      <div className="w-72 bg-card border border-border rounded-xl p-4 space-y-4 overflow-y-auto flex-shrink-0">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Capas
          </h2>
          <p className="text-sm text-muted-foreground">{selectedComuna?.nombre || 'Sin comuna'}</p>
        </div>

        {/* Toggles de capas */}
        <div className="space-y-2">
          <label className="flex items-center justify-between p-3 bg-muted rounded-lg cursor-pointer hover:bg-muted/80">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-400 via-yellow-400 to-red-500" />
              <span className="text-sm">Mapa de Calor</span>
            </div>
            <input type="checkbox" checked={capas.heatmap}
              onChange={e => setCapas({ ...capas, heatmap: e.target.checked })}
              className="rounded accent-blue-500"
            />
          </label>
          <label className="flex items-center justify-between p-3 bg-muted rounded-lg cursor-pointer hover:bg-muted/80">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-orange-500 opacity-70" />
              <span className="text-sm">Zonas de Riesgo</span>
            </div>
            <input type="checkbox" checked={capas.predicciones}
              onChange={e => setCapas({ ...capas, predicciones: e.target.checked })}
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
            <select value={diasFiltro} onChange={e => setDiasFiltro(Number(e.target.value))}
              className="w-full mt-1 p-2 text-sm bg-muted border border-border rounded-lg">
              <option value={1400}>Todo el período</option>
              <option value={730}>Últimos 2 años</option>
              <option value={365}>Último año</option>
              <option value={180}>Últimos 6 meses</option>
              <option value={90}>Últimos 3 meses</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Tipo de incidente</label>
            <select value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)}
              className="w-full mt-1 p-2 text-sm bg-muted border border-border rounded-lg">
              <option value="">Todos</option>
              {tiposPresentes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="border-t border-border pt-4 space-y-1.5 text-sm">
          <h3 className="font-semibold text-sm mb-2">Estadísticas</h3>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Puntos en mapa:</span>
            <span className="font-medium">{loadingHeat ? '...' : puntosFiltrados.length.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Zonas de riesgo:</span>
            <span className="font-medium">{zonasRiesgo?.total_zonas || 0}</span>
          </div>
          {heatmapData?.periodo_desde && (
            <p className="text-xs text-muted-foreground pt-2 border-t border-border">
              Datos: {heatmapData.periodo_desde} → {heatmapData.periodo_hasta}
            </p>
          )}
        </div>

        {/* Leyenda mapa de calor */}
        {capas.heatmap && (
          <div className="border-t border-border pt-4">
            <h3 className="text-xs font-semibold text-muted-foreground mb-2">DENSIDAD DE INCIDENTES</h3>
            <div className="h-3 rounded-full w-full" style={{
              background: 'linear-gradient(to right, rgba(0,0,255,0.3), cyan, lime, yellow, orange, red)'
            }} />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Baja</span><span>Alta</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Los puntos más graves (delitos, VIF) tienen mayor peso en el mapa.</p>
          </div>
        )}

        {/* Leyenda zonas de riesgo */}
        {capas.predicciones && (zonasRiesgo?.total_zonas || 0) > 0 && (
          <div className="border-t border-border pt-4">
            <h3 className="text-xs font-semibold text-muted-foreground mb-2">NIVEL DE RIESGO PREDICHO</h3>
            <div className="space-y-1.5">
              {Object.entries(NIVEL_CONFIG).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded flex-shrink-0" style={{ backgroundColor: cfg.color, opacity: 0.8 }} />
                  <span className="text-muted-foreground">{cfg.label}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-start gap-1">
              <Info className="h-3 w-3 flex-shrink-0 mt-0.5" />
              Haz clic en una zona para ver su detalle
            </p>
          </div>
        )}
      </div>

      {/* ── Mapa ── */}
      <div className="flex-1 relative rounded-xl overflow-hidden border border-border">
        <Map
          ref={mapRef}
          {...viewState}
          onMove={onMove}
          onClick={handleMapClick}
          interactiveLayerIds={['zonas-fill']}
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          style={{ width: '100%', height: '100%' }}
          cursor={popup ? 'pointer' : 'grab'}
        >
          {/* ── HEATMAP (incidentes reales) ── */}
          {capas.heatmap && heatmapGeoJSON.features.length > 0 && (
            <Source id="heatmap-src" type="geojson" data={heatmapGeoJSON}>
              {/* Capa difuminada de calor */}
              <Layer
                id="heat-layer"
                type="heatmap"
                paint={{
                  // Peso por intensidad del punto
                  'heatmap-weight': [
                    'interpolate', ['linear'], ['get', 'weight'],
                    0, 0,   1, 0.5,   3, 1,
                  ],
                  // Intensidad global según zoom
                  'heatmap-intensity': [
                    'interpolate', ['linear'], ['zoom'],
                    8, 0.6,   11, 1.5,   14, 3,
                  ],
                  // Radio del punto (mucho más grande a zoom bajo)
                  'heatmap-radius': [
                    'interpolate', ['linear'], ['zoom'],
                    8, 25,   11, 35,   14, 50,
                  ],
                  // Paleta de colores
                  'heatmap-color': [
                    'interpolate', ['linear'], ['heatmap-density'],
                    0,   'rgba(33,102,172,0)',
                    0.15,'rgba(103,169,207,0.6)',
                    0.3, 'rgba(209,229,240,0.7)',
                    0.5, 'rgba(253,219,199,0.8)',
                    0.7, 'rgba(239,138,98,0.9)',
                    0.85,'rgba(214,96,77,0.95)',
                    1,   'rgba(178,24,43,1)',
                  ],
                  'heatmap-opacity': 0.85,
                }}
              />
              {/* Puntos individuales al hacer zoom */}
              <Layer
                id="heat-points"
                type="circle"
                minzoom={14}
                paint={{
                  'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 4, 17, 8],
                  'circle-color': '#ef4444',
                  'circle-opacity': 0.85,
                  'circle-stroke-width': 1,
                  'circle-stroke-color': '#fff',
                }}
              />
            </Source>
          )}

          {/* ── ZONAS DE RIESGO (predicciones) ── */}
          {capas.predicciones && zonasGeoJSON.features.length > 0 && (
            <Source id="zonas-src" type="geojson" data={zonasGeoJSON}>
              {/* Relleno */}
              <Layer
                id="zonas-fill"
                type="fill"
                paint={{
                  'fill-color': ['get', 'color'],
                  'fill-opacity': ['case',
                    ['boolean', ['feature-state', 'hover'], false], 0.55, 0.30
                  ],
                }}
              />
              {/* Borde */}
              <Layer
                id="zonas-border"
                type="line"
                paint={{
                  'line-color': ['get', 'color'],
                  'line-width': 2.5,
                  'line-opacity': 0.9,
                  'line-dasharray': [3, 1],
                }}
              />
              {/* Etiqueta de nivel en el centro */}
              <Layer
                id="zonas-label"
                type="symbol"
                layout={{
                  'text-field': ['concat',
                    ['upcase', ['get', 'nivel']],
                    '\n',
                    ['concat', ['to-string', ['round', ['*', ['get', 'probabilidad'], 100]]], '%'],
                  ],
                  'text-size': 11,
                  'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
                  'text-anchor': 'center',
                  'text-justify': 'center',
                  'text-allow-overlap': true,
                }}
                paint={{
                  'text-color': '#ffffff',
                  'text-halo-color': ['get', 'color'],
                  'text-halo-width': 1.5,
                  'text-opacity': 0.95,
                }}
              />
            </Source>
          )}

          {/* ── POPUP al hacer clic en zona ── */}
          {popup && (
            <Popup
              longitude={popup.lon}
              latitude={popup.lat}
              onClose={() => setPopup(null)}
              closeButton
              closeOnClick={false}
              anchor="bottom"
              style={{ zIndex: 10 }}
            >
              <div className="p-2 min-w-[160px]">
                {(() => {
                  const cfg = NIVEL_CONFIG[popup.zona.nivel] || { label: popup.zona.nivel, color: '#666', bg: '', border: '' };
                  return (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
                        <span className="font-bold text-sm" style={{ color: cfg.color }}>
                          Riesgo {cfg.label}
                        </span>
                      </div>
                      <div className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
                        <div className="flex justify-between gap-4">
                          <span>Probabilidad</span>
                          <strong>{((popup.zona.probabilidad || 0) * 100).toFixed(1)}%</strong>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span>Modelo</span>
                          <strong>{popup.zona.modelo}</strong>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span>Horizonte</span>
                          <strong>{popup.zona.horizonte}h</strong>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                        Zona generada por IA sobre hotspot real
                      </p>
                    </>
                  );
                })()}
              </div>
            </Popup>
          )}
        </Map>

        {/* Cargando */}
        {loadingHeat && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg px-4 py-2 text-sm shadow-lg">
            Cargando datos...
          </div>
        )}

        {/* Sin datos */}
        {!loadingHeat && puntosFiltrados.length === 0 && capas.heatmap && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg px-4 py-2 text-sm shadow-lg flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            Sin datos para este filtro
          </div>
        )}
      </div>
    </div>
  );
}
