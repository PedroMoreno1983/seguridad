import { useState, useCallback, useRef, useEffect } from 'react';
import Map, { Source, Layer, Popup } from 'react-map-gl';
import { Layers, Filter, Info, ChevronLeft, Search, X, MapPin, Play, Pause } from 'lucide-react';
import { useAppStore } from '@/store';
import { useHeatmapData, useZonasRiesgo } from '@/hooks/useApi';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

const NIVEL_CONFIG: Record<string, { label: string; color: string }> = {
  critico:  { label: 'Crítico',  color: '#ef4444' },
  alto:     { label: 'Alto',     color: '#f97316' },
  medio:    { label: 'Medio',    color: '#eab308' },
  bajo:     { label: 'Bajo',     color: '#84cc16' },
  muy_bajo: { label: 'Muy bajo', color: '#22c55e' },
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
  const [diasFiltro, setDiasFiltro] = useState(730);
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [popup, setPopup] = useState<{ lon: number; lat: number; zona: any } | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchTimeout = useRef<any>(null);

  // Time Slider State
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeProgress, setTimeProgress] = useState(100);
  const progressInterval = useRef<any>(null);

  const geocode = useCallback(async (query: string) => {
    if (!query || query.length < 3 || !MAPBOX_TOKEN) {
      setSearchResults([]);
      return;
    }
    try {
      const bbox = selectedComuna?.bbox
        ? (Array.isArray(selectedComuna.bbox) ? selectedComuna.bbox.join(',') : '')
        : '-71.8,-34.2,-70.0,-33.0';
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&country=cl&limit=5&language=es${bbox ? `&bbox=${bbox}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      setSearchResults(data.features || []);
    } catch {
      setSearchResults([]);
    }
  }, [MAPBOX_TOKEN, selectedComuna?.bbox]);

  const handleSearchInput = useCallback((value: string) => {
    setSearchQuery(value);
    setSearchOpen(true);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => geocode(value), 300);
  }, [geocode]);

  const handleSearchSelect = useCallback((result: any) => {
    const [lon, lat] = result.center;
    setViewState(v => ({ ...v, longitude: lon, latitude: lat, zoom: 16 }));
    setSearchQuery(result.place_name_es || result.place_name || result.text);
    setSearchOpen(false);
    setSearchResults([]);
  }, []);

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

  // Cerrar panel en mobile por defecto
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (isMobile) setPanelOpen(false);
  }, []);

  const onMove = useCallback((evt: any) => setViewState(evt.viewState), []);

  // Filtrar por tipo
  const puntosFiltrados = (heatmapData?.puntos || []).filter((p: any) =>
    tipoFiltro ? p.tipo === tipoFiltro : true
  );

  // Subsample: con 50k+ puntos el heatmap se satura. Máximo ~3000 para que se vea el gradiente.
  const MAX_HEATMAP_POINTS = 3000;
  let puntosParaMapa = puntosFiltrados.length > MAX_HEATMAP_POINTS
    ? puntosFiltrados.filter((_: any, i: number) => i % Math.ceil(puntosFiltrados.length / MAX_HEATMAP_POINTS) === 0)
    : puntosFiltrados;

  // Aplicar filtro de animación temporal (TimeSlider)
  if (timeProgress < 100) {
    const visibleCount = Math.floor((timeProgress / 100) * puntosParaMapa.length);
    puntosParaMapa = puntosParaMapa.slice(0, visibleCount);
  }

  // Animation effect
  useEffect(() => {
    if (isPlaying) {
      if (timeProgress >= 100) setTimeProgress(0);
      progressInterval.current = setInterval(() => {
        setTimeProgress(prev => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 100;
          }
          return prev + 1; // 1% advance per tick
        });
      }, 50);
    } else {
      if (progressInterval.current) clearInterval(progressInterval.current);
    }
    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, [isPlaying]);

  // GeoJSON heatmap
  const heatmapGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: puntosParaMapa.map((p: any) => ({
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
      setPopup({ lon: e.lngLat.lng, lat: e.lngLat.lat, zona: zonaFeature.properties });
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
    <div className="h-[calc(100vh-8rem)] flex relative">
      {/* ── Panel lateral (responsive) ── */}
      <div
        className={`
          ${panelOpen ? 'w-72' : 'w-0'}
          transition-all duration-300 flex-shrink-0 overflow-hidden
          absolute md:relative z-20 h-full
        `}
      >
        <div className="w-72 h-full bg-card border border-border rounded-xl p-4 space-y-4 overflow-y-auto">
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
                <option value={730}>Todo el período</option>
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
            </div>
          )}

          {/* Leyenda zonas de riesgo */}
          {capas.predicciones && (zonasRiesgo?.total_zonas || 0) > 0 && (
            <div className="border-t border-border pt-4">
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">NIVEL DE RIESGO</h3>
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
                Clic en una zona para ver detalle
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Toggle panel button */}
      <button
        onClick={() => setPanelOpen(!panelOpen)}
        className="absolute top-3 left-3 z-30 md:hidden p-2 bg-card border border-border rounded-lg shadow-lg hover:bg-muted transition-colors"
      >
        {panelOpen ? <ChevronLeft className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
      </button>

      {/* ── Mapa ── */}
      <div className="flex-1 relative rounded-xl overflow-hidden border border-border ml-0 md:ml-4">
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
          {/* ── HEATMAP ── */}
          {capas.heatmap && heatmapGeoJSON.features.length > 0 && (
            <Source id="heatmap-src" type="geojson" data={heatmapGeoJSON}>
              <Layer
                id="heat-layer"
                type="heatmap"
                maxzoom={17}
                paint={{
                  'heatmap-weight': [
                    'interpolate', ['linear'], ['get', 'weight'],
                    0, 0, 1, 0.4, 3, 1,
                  ],
                  'heatmap-intensity': [
                    'interpolate', ['linear'], ['zoom'],
                    10, 0.15, 13, 0.5, 15, 1,
                  ],
                  'heatmap-radius': [
                    'interpolate', ['linear'], ['zoom'],
                    10, 6, 13, 15, 15, 25,
                  ],
                  'heatmap-color': [
                    'interpolate', ['linear'], ['heatmap-density'],
                    0,    'rgba(0,0,0,0)',
                    0.1,  'rgba(0,0,255,0.25)',
                    0.25, 'rgba(0,200,255,0.45)',
                    0.4,  'rgba(0,255,128,0.55)',
                    0.55, 'rgba(255,255,0,0.7)',
                    0.7,  'rgba(255,165,0,0.8)',
                    0.85, 'rgba(255,69,0,0.9)',
                    1,    'rgba(220,20,20,1)',
                  ],
                  'heatmap-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    10, 0.75, 15, 0.85, 17, 0.5,
                  ],
                }}
              />
              <Layer
                id="heat-points"
                type="circle"
                minzoom={15}
                paint={{
                  'circle-radius': ['interpolate', ['linear'], ['zoom'], 15, 3, 18, 7],
                  'circle-color': '#ef4444',
                  'circle-opacity': 0.7,
                  'circle-stroke-width': 0.5,
                  'circle-stroke-color': '#fff',
                }}
              />
            </Source>
          )}

          {/* ── ZONAS DE RIESGO ── */}
          {capas.predicciones && zonasGeoJSON.features.length > 0 && (
            <Source id="zonas-src" type="geojson" data={zonasGeoJSON}>
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
              <Layer
                id="zonas-label"
                type="symbol"
                layout={{
                  'text-field': ['concat',
                    ['upcase', ['get', 'nivel']], '\n',
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

          {/* ── POPUP ── */}
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
                  const cfg = NIVEL_CONFIG[popup.zona.nivel] || { label: popup.zona.nivel, color: '#666' };
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
                    </>
                  );
                })()}
              </div>
            </Popup>
          )}
        </Map>

        {/* ── BUSCADOR DE DIRECCIONES ── */}
        <div className="absolute top-3 right-3 z-20 w-64 sm:w-80">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
              placeholder="Buscar direccion..."
              className="w-full pl-9 pr-8 py-2.5 bg-card border border-border rounded-lg text-sm shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setSearchResults([]); setSearchOpen(false); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {searchOpen && searchResults.length > 0 && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setSearchOpen(false)} />
              <div className="absolute top-full mt-1 left-0 right-0 bg-card border border-border rounded-lg shadow-xl overflow-hidden z-20" style={{ backgroundColor: 'hsl(var(--card))' }}>
                {searchResults.map((r: any) => (
                  <button
                    key={r.id}
                    onClick={() => handleSearchSelect(r)}
                    className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-muted transition-colors border-b border-border/50 last:border-0"
                  >
                    <MapPin className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.text}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.place_name_es || r.place_name}</p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── TIME SLIDER TEMPORAL ── */}
        <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-[50%] md:translate-x-[50%] w-auto md:min-w-[400px] z-20 bg-card/90 backdrop-blur-md border border-border shadow-2xl rounded-xl p-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (timeProgress === 100) setTimeProgress(0);
                setIsPlaying(!isPlaying);
              }}
              className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-primary hover:bg-primary/90 text-primary-foreground rounded-full transition-colors shadow-lg"
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-1" />}
            </button>
            <div className="flex-1">
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-muted-foreground">Evolución Histórica</span>
                <span className="text-primary">{timeProgress === 100 ? 'Datos Actuales' : `Simulando...`}</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={timeProgress}
                onChange={e => {
                  setTimeProgress(Number(e.target.value));
                  setIsPlaying(false);
                }}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>
          </div>
        </div>

        {/* Loading */}
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

        {/* Stats badge en mobile cuando panel cerrado */}
        {!panelOpen && !loadingHeat && puntosFiltrados.length > 0 && (
          <div className="absolute bottom-4 left-4 md:hidden bg-card/90 border border-border rounded-lg px-3 py-2 text-xs shadow-lg backdrop-blur-sm">
            <span className="font-medium">{puntosFiltrados.length.toLocaleString()}</span>
            <span className="text-muted-foreground"> puntos</span>
          </div>
        )}
      </div>

      {/* Overlay mobile cuando panel abierto */}
      {panelOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-10 md:hidden"
          onClick={() => setPanelOpen(false)}
        />
      )}
    </div>
  );
}
