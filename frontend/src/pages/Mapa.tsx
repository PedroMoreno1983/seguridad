import { useState, useCallback, useRef, useEffect } from 'react';
import Map, { Source, Layer, Popup } from 'react-map-gl';
import {
  Clock,
  Filter,
  Info,
  Layers,
  MapPin,
  Navigation,
  Pause,
  Play,
  Radio,
  Route,
  Search,
  Target,
  X,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { useHeatmapData, useZonasRiesgo } from '@/hooks/useApi';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

const NIVEL_CONFIG: Record<string, { label: string; color: string; code: string }> = {
  critico: { label: 'Critico', color: '#9d4638', code: 'R5' },
  alto: { label: 'Alto', color: '#c9833c', code: 'R4' },
  medio: { label: 'Medio', color: '#d8b64a', code: 'R3' },
  bajo: { label: 'Bajo', color: '#a1c760', code: 'R2' },
  muy_bajo: { label: 'Muy bajo', color: '#58b882', code: 'R1' },
};

const LAYER_ROWS = [
  { key: 'incidentes', label: 'Incidentes (90d)', color: 'bg-foreground' },
  { key: 'heatmap', label: 'Hotspots KDE', color: 'bg-[var(--risk-4)]' },
  { key: 'rtm', label: 'Risk Terrain', color: 'bg-amber-500' },
  { key: 'predicciones', label: 'Prediccion 72h', color: 'bg-primary' },
  { key: 'patrullaje', label: 'Patrullaje activo', color: 'bg-green-600' },
  { key: 'luminarias', label: 'Luminarias', color: 'bg-muted-foreground' },
] as const;

type CapasState = Record<(typeof LAYER_ROWS)[number]['key'], boolean>;

const DEFAULT_CAPAS: CapasState = {
  incidentes: true,
  heatmap: true,
  rtm: false,
  predicciones: true,
  patrullaje: true,
  luminarias: false,
};

export function MapaPage() {
  const { selectedComuna } = useAppStore();
  const mapRef = useRef<any>(null);

  const [viewState, setViewState] = useState({
    longitude: -70.633,
    latitude: -33.545,
    zoom: 13,
  });

  const [capas, setCapas] = useState<CapasState>(DEFAULT_CAPAS);
  const [diasFiltro, setDiasFiltro] = useState(730);
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [popup, setPopup] = useState<{ lon: number; lat: number; zona: any } | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [mapMode, setMapMode] = useState<'vista' | 'satelite' | 'calor' | 'cuadrantes'>('vista');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchTimeout = useRef<any>(null);

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
  }, [selectedComuna?.bbox]);

  const handleSearchInput = useCallback((value: string) => {
    setSearchQuery(value);
    setSearchOpen(true);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => geocode(value), 300);
  }, [geocode]);

  const handleSearchSelect = useCallback((result: any) => {
    const [lon, lat] = result.center;
    setViewState((v) => ({ ...v, longitude: lon, latitude: lat, zoom: 16 }));
    setSearchQuery(result.place_name_es || result.place_name || result.text);
    setSearchOpen(false);
    setSearchResults([]);
  }, []);

  const { data: heatmapData, isLoading: loadingHeat } = useHeatmapData(
    selectedComuna?.id || null,
    diasFiltro
  );
  const { data: zonasRiesgo } = useZonasRiesgo(selectedComuna?.id || null, 72);

  useEffect(() => {
    if (!selectedComuna) return;
    const c = selectedComuna as any;
    if (c.bbox) {
      const [minLon, minLat, maxLon, maxLat] = Array.isArray(c.bbox)
        ? c.bbox
        : [c.bbox.min_lon, c.bbox.min_lat, c.bbox.max_lon, c.bbox.max_lat];
      setViewState((v) => ({ ...v, longitude: (minLon + maxLon) / 2, latitude: (minLat + maxLat) / 2, zoom: 13 }));
    } else if (c.centroid_lat) {
      setViewState((v) => ({ ...v, latitude: c.centroid_lat, longitude: c.centroid_lon, zoom: 13 }));
    }
    setPopup(null);
  }, [selectedComuna?.id]);

  useEffect(() => {
    if (window.innerWidth < 1024) setPanelOpen(false);
  }, []);

  const onMove = useCallback((evt: any) => setViewState(evt.viewState), []);

  const puntosFiltrados = (heatmapData?.puntos || []).filter((p: any) =>
    tipoFiltro ? p.tipo === tipoFiltro : true
  );

  const MAX_HEATMAP_POINTS = 3000;
  let puntosParaMapa = puntosFiltrados.length > MAX_HEATMAP_POINTS
    ? puntosFiltrados.filter((_: any, i: number) => i % Math.ceil(puntosFiltrados.length / MAX_HEATMAP_POINTS) === 0)
    : puntosFiltrados;

  if (timeProgress < 100) {
    const visibleCount = Math.floor((timeProgress / 100) * puntosParaMapa.length);
    puntosParaMapa = puntosParaMapa.slice(0, visibleCount);
  }

  useEffect(() => {
    if (isPlaying) {
      if (timeProgress >= 100) setTimeProgress(0);
      progressInterval.current = setInterval(() => {
        setTimeProgress((prev) => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 100;
          }
          return prev + 1;
        });
      }, 50);
    } else if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }

    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, [isPlaying, timeProgress]);

  const heatmapGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: puntosParaMapa.map((p: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      properties: { weight: p.intensity || 1, tipo: p.tipo },
    })),
  };

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
  const heatmapMetadata = heatmapData?.metadata || {};

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

  const selectedZone = popup?.zona || (zonasGeoJSON.features[0]?.properties as any) || null;
  const selectedNivel = String(selectedZone?.nivel || 'critico');
  const selectedConfig = NIVEL_CONFIG[selectedNivel] || NIVEL_CONFIG.critico;
  const selectedProb = selectedZone ? Number(selectedZone?.probabilidad || 0) : null;
  const totalZonas = zonasRiesgo?.total_zonas || zonasGeoJSON.features.length || 0;
  const incidentCount = loadingHeat ? '...' : puntosFiltrados.length.toLocaleString('es-CL');
  const visibleIncidentCount = puntosParaMapa.length.toLocaleString('es-CL');
  const mapStyle = mapMode === 'satelite'
    ? 'mapbox://styles/mapbox/satellite-streets-v12'
    : 'mapbox://styles/mapbox/light-v11';

  const timeline = Array.from({ length: 8 }, (_, i) => {
    const p = puntosFiltrados[i];
    return {
      hour: `${String(7 + i).padStart(2, '0')}:00`,
      risk: Math.min(5, Math.max(1, Math.round(Number(p?.intensity || i % 5 || 2)))),
    };
  });

  const recentIncidents = puntosFiltrados.slice(0, 4).map((p: any, i: number) => ({
    hour: p?.fecha ? p.fecha.slice(5) : `${String(10 + i).padStart(2, '0')}:${i % 2 ? '35' : '10'}`,
    type: p?.tipo || 'Incidente',
    sector: p?.sector || selectedComuna?.nombre || 'Sector monitoreado',
    risk: Math.min(5, Math.max(1, Math.round(Number(p?.intensity || 1)))),
    precision: p?.precision,
    count: p?.count,
  }));

  if (!MAPBOX_TOKEN) {
    return (
      <div className="atalaya-panel flex h-96 items-center justify-center">
        <p className="text-muted-foreground">Configure VITE_MAPBOX_TOKEN para ver el mapa</p>
      </div>
    );
  }

  return (
    <div className="grid h-[calc(100vh-8rem)] min-h-[640px] overflow-hidden border border-border bg-card lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_320px]">
      <aside
        className={`absolute inset-y-0 left-0 z-30 w-[260px] border-r border-border bg-card transition-transform lg:relative lg:translate-x-0 ${
          panelOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full overflow-y-auto px-4 py-5">
          <div className="atalaya-kicker mb-3 flex items-center gap-2">
            <Layers className="h-3.5 w-3.5" />
            Capas
          </div>
          <div className="border-t border-border">
            {LAYER_ROWS.map((layer) => {
              const count = layer.key === 'heatmap'
                ? visibleIncidentCount
                : layer.key === 'predicciones'
                  ? totalZonas.toLocaleString('es-CL')
                  : layer.key === 'patrullaje'
                    ? '4'
                    : layer.key === 'luminarias'
                      ? '2.418'
                      : incidentCount;

              return (
                <label key={layer.key} className="flex cursor-pointer items-center gap-2.5 border-b border-border py-2.5">
                  <input
                    type="checkbox"
                    checked={capas[layer.key]}
                    onChange={(e) => setCapas({ ...capas, [layer.key]: e.target.checked })}
                    className="h-3.5 w-3.5 accent-foreground"
                  />
                  <span className={`h-2 w-2 rounded-[1px] ${layer.color}`} />
                  <span className="flex-1 text-sm">{layer.label}</span>
                  <span className="atalaya-mono text-[10px] text-muted-foreground">{count}</span>
                </label>
              );
            })}
          </div>

          <div className="atalaya-kicker mb-3 mt-6 flex items-center gap-2">
            <Filter className="h-3.5 w-3.5" />
            Filtros temporales
          </div>
          <div className="atalaya-panel-soft p-3">
            <div className="atalaya-mono mb-1 text-[10px] text-muted-foreground">Rango</div>
            <select
              value={diasFiltro}
              onChange={(e) => setDiasFiltro(Number(e.target.value))}
              className="w-full rounded-sm border border-border bg-card px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value={730}>Todo el periodo</option>
              <option value={365}>Ultimo ano</option>
              <option value={180}>Ultimos 6 meses</option>
              <option value={90}>Ultimos 3 meses</option>
            </select>
            <div className="mt-3 h-1 rounded-full bg-border">
              <div className="ml-auto h-full w-2/5 rounded-full bg-foreground" />
            </div>
          </div>

          <div className="atalaya-kicker mb-3 mt-6">Tipo de incidente</div>
          <select
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value)}
            className="w-full rounded-sm border border-border bg-muted px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">Todos</option>
            {tiposPresentes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <div className="mt-6 border-t border-border pt-4">
            <div className="atalaya-kicker mb-3">Estadisticas</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Puntos en mapa</span>
                <span className="atalaya-mono">{incidentCount}</span>
              </div>
              {heatmapMetadata?.total_registros !== undefined && (
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Registros cargados</span>
                  <span className="atalaya-mono">{Number(heatmapMetadata.total_registros || 0).toLocaleString('es-CL')}</span>
                </div>
              )}
              {heatmapMetadata?.modo && heatmapMetadata.modo !== 'exacto' && (
                <div className="rounded-sm border border-border bg-muted px-2 py-2 text-xs text-muted-foreground">
                  {heatmapMetadata.modo === 'sectorizado'
                    ? 'Mapa agregado por sector; no representa direcciones exactas.'
                    : heatmapMetadata.modo === 'comunal'
                      ? 'Mapa agregado a nivel comunal; falta detalle territorial.'
                    : heatmapMetadata.modo === 'sin_georreferenciacion'
                      ? 'Hay registros, pero falta sector o coordenada para mapearlos.'
                      : heatmapMetadata.nota}
                </div>
              )}
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Zonas de riesgo</span>
                <span className="atalaya-mono">{totalZonas}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Ventana predictiva</span>
                <span className="atalaya-mono">72h</span>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-border pt-4">
            <div className="atalaya-kicker mb-3">Nivel de riesgo</div>
            <div className="space-y-2">
              {Object.entries(NIVEL_CONFIG).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 rounded-[1px]" style={{ backgroundColor: cfg.color }} />
                  <span className="text-muted-foreground">{cfg.code}</span>
                  <span>{cfg.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <section className="relative min-h-0 bg-muted">
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          className="absolute left-3 top-3 z-30 rounded-sm border border-border bg-card px-3 py-2 text-xs font-medium shadow-lg lg:hidden"
        >
          Capas
        </button>

        <Map
          ref={mapRef}
          {...viewState}
          onMove={onMove}
          onClick={handleMapClick}
          interactiveLayerIds={['zonas-fill']}
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle={mapStyle}
          style={{ width: '100%', height: '100%' }}
          cursor={popup ? 'pointer' : 'grab'}
        >
          {capas.heatmap && heatmapGeoJSON.features.length > 0 && (
            <Source id="heatmap-src" type="geojson" data={heatmapGeoJSON}>
              <Layer
                id="heat-layer"
                type="heatmap"
                maxzoom={17}
                paint={{
                  'heatmap-weight': ['interpolate', ['linear'], ['get', 'weight'], 0, 0, 1, 0.35, 3, 1],
                  'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 0.12, 13, 0.45, 15, 0.9],
                  'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 7, 13, 18, 15, 28],
                  'heatmap-color': [
                    'interpolate', ['linear'], ['heatmap-density'],
                    0, 'rgba(0,0,0,0)',
                    0.15, 'rgba(88,184,130,0.25)',
                    0.35, 'rgba(216,182,74,0.5)',
                    0.58, 'rgba(201,131,60,0.7)',
                    0.8, 'rgba(157,70,56,0.82)',
                    1, 'rgba(125,42,34,0.95)',
                  ],
                  'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.62, 15, 0.78, 17, 0.45],
                }}
              />
              {capas.incidentes && (
                <Layer
                  id="heat-points"
                  type="circle"
                  minzoom={15}
                  paint={{
                    'circle-radius': ['interpolate', ['linear'], ['zoom'], 15, 2.5, 18, 6],
                    'circle-color': '#16313b',
                    'circle-opacity': 0.68,
                    'circle-stroke-width': 0.75,
                    'circle-stroke-color': '#f7f9f8',
                  }}
                />
              )}
            </Source>
          )}

          {capas.predicciones && zonasGeoJSON.features.length > 0 && (
            <Source id="zonas-src" type="geojson" data={zonasGeoJSON}>
              <Layer
                id="zonas-fill"
                type="fill"
                paint={{
                  'fill-color': ['get', 'color'],
                  'fill-opacity': 0.22,
                }}
              />
              <Layer
                id="zonas-border"
                type="line"
                paint={{
                  'line-color': '#2d7182',
                  'line-width': 2,
                  'line-opacity': 0.9,
                  'line-dasharray': [4, 3],
                }}
              />
              <Layer
                id="zonas-label"
                type="symbol"
                layout={{
                  'text-field': ['concat', ['upcase', ['get', 'nivel']], '\n', ['concat', ['to-string', ['round', ['*', ['get', 'probabilidad'], 100]]], '%']],
                  'text-size': 11,
                  'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
                  'text-anchor': 'center',
                  'text-justify': 'center',
                  'text-allow-overlap': true,
                }}
                paint={{
                  'text-color': '#16313b',
                  'text-halo-color': '#f7f9f8',
                  'text-halo-width': 1.5,
                  'text-opacity': 0.95,
                }}
              />
            </Source>
          )}

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
              <div className="min-w-[170px] p-2">
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: selectedConfig.color }} />
                  <span className="text-sm font-semibold text-foreground">{selectedConfig.code} {selectedConfig.label}</span>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between gap-4">
                    <span>Probabilidad</span>
                    <strong className="text-foreground">{selectedProb !== null ? `${(selectedProb * 100).toFixed(1)}%` : 'N/A'}</strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Modelo</span>
                    <strong className="text-foreground">{selectedZone?.modelo || 'SEPP + RTM'}</strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Horizonte</span>
                    <strong className="text-foreground">{selectedZone?.horizonte || 72}h</strong>
                  </div>
                </div>
              </div>
            </Popup>
          )}
        </Map>

        <div className="absolute left-4 top-4 z-20 hidden items-center gap-1 rounded-sm border border-border bg-card p-1 shadow-lg md:flex">
          {[
            { key: 'vista', label: 'Vista' },
            { key: 'satelite', label: 'Satelite' },
            { key: 'calor', label: 'Calor' },
            { key: 'cuadrantes', label: 'Cuadrantes' },
          ].map((mode) => (
            <button
              key={mode.key}
              onClick={() => {
                setMapMode(mode.key as typeof mapMode);
                if (mode.key === 'calor') setCapas({ ...capas, heatmap: true });
              }}
              className={`rounded-sm px-3 py-1.5 text-xs font-medium ${mapMode === mode.key ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div className="absolute right-4 top-4 z-20 w-[min(360px,calc(100%-2rem))]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
              placeholder="Buscar direccion, hito o cuadrante..."
              className="w-full rounded-sm border border-border bg-card py-2.5 pl-9 pr-8 text-sm shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setSearchOpen(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {searchOpen && searchResults.length > 0 && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setSearchOpen(false)} />
              <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-sm border border-border bg-card shadow-xl">
                {searchResults.map((r: any) => (
                  <button
                    key={r.id}
                    onClick={() => handleSearchSelect(r)}
                    className="flex w-full items-start gap-2 border-b border-border/60 px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-muted"
                  >
                    <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.text}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.place_name_es || r.place_name}</p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="atalaya-mono absolute bottom-24 right-4 z-20 rounded-sm border border-border bg-card px-2 py-1 text-[10px] text-muted-foreground shadow-lg">
          {viewState.latitude.toFixed(4)}, {viewState.longitude.toFixed(4)} · z{viewState.zoom.toFixed(1)}
        </div>

        <div className="absolute bottom-4 left-4 right-4 z-20 rounded-sm border border-border bg-card px-4 py-3 shadow-2xl">
          <div className="mb-2 flex items-center gap-3">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-600" />
            <span className="atalaya-kicker">Reloj 14:32 · incidentes en vivo</span>
            <span className="atalaya-mono ml-auto text-[10px] text-muted-foreground">8 ultimos</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (timeProgress === 100) setTimeProgress(0);
                setIsPlaying(!isPlaying);
              }}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-sm bg-foreground text-background transition-colors hover:bg-foreground/90"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
            </button>
            <div className="hidden flex-1 items-end gap-2 md:flex">
              {timeline.map((t, i) => (
                <div key={`${t.hour}-${i}`} className="flex-1">
                  <div className="h-4 rounded-[1px]" style={{ backgroundColor: `var(--risk-${t.risk})`, opacity: 0.72 }} />
                  <div className="atalaya-mono mt-1 text-center text-[9px] text-muted-foreground">{t.hour}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-1 items-center gap-3 md:hidden">
              <input
                type="range"
                min="0"
                max="100"
                value={timeProgress}
                onChange={(e) => {
                  setTimeProgress(Number(e.target.value));
                  setIsPlaying(false);
                }}
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
              />
            </div>
          </div>
        </div>

        {loadingHeat && (
          <div className="absolute left-1/2 top-20 z-20 -translate-x-1/2 rounded-sm border border-border bg-card px-4 py-2 text-sm shadow-lg">
            Cargando datos...
          </div>
        )}

        {!loadingHeat && puntosFiltrados.length === 0 && capas.heatmap && (
          <div className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 rounded-sm border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-lg">
            <Info className="h-6 w-6" />
            <p>
              {Number(heatmapMetadata?.total_registros || 0) > 0
                ? 'Registros cargados sin georreferenciación suficiente para este filtro'
                : 'Sin datos geolocalizados para este filtro'}
            </p>
          </div>
        )}
      </section>

      <aside className="hidden min-h-0 overflow-y-auto border-l border-border bg-card px-4 py-5 xl:block">
        <div className="atalaya-kicker mb-3">Zona seleccionada</div>
        <div className="atalaya-serif text-xl font-semibold">
          {selectedZone ? 'Zona operacional activa' : 'Sin zona operacional'}
        </div>
        <div className="atalaya-mono mt-1 text-[10px] text-muted-foreground">
          Z-014 · Cuadrante 22 · {selectedComuna?.nombre || 'Comuna'}
        </div>

        <div className="my-5 grid grid-cols-2 border-y border-border">
          <div className="border-r border-border py-3 pr-3">
            <div className="atalaya-kicker">Riesgo 72h</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="atalaya-numeral text-3xl font-semibold" style={{ color: selectedConfig.color }}>
                {selectedZone ? selectedConfig.code : '--'}
              </span>
              <span className="text-xs text-muted-foreground">{selectedZone ? selectedConfig.label : 'Sin predicción'}</span>
            </div>
          </div>
          <div className="py-3 pl-3">
            <div className="atalaya-kicker">Probabilidad</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="atalaya-numeral text-3xl font-semibold">{selectedProb !== null ? (selectedProb * 100).toFixed(0) : '--'}</span>
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </div>
        </div>

        <div className="atalaya-kicker mb-2">Incidentes recientes</div>
        <div className="border-t border-border">
          {recentIncidents.length === 0 && (
            <div className="border-b border-border py-3 text-sm text-muted-foreground">
              Sin incidentes georreferenciados para el filtro activo.
            </div>
          )}
          {recentIncidents.map((f: any, i: number) => (
            <div key={`${f.hour}-${i}`} className="flex items-start gap-2 border-b border-border py-2">
              <span className="atalaya-mono w-10 pt-0.5 text-[10px] text-muted-foreground">{f.hour}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{f.type}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {f.sector}{['sector', 'comuna'].includes(f.precision) && f.count ? ` · ${f.count.toLocaleString('es-CL')} casos agregados` : ''}
                </div>
              </div>
              <span className="risk-pill" style={{ borderColor: `var(--risk-${f.risk})`, color: `var(--risk-${f.risk})` }}>
                R{f.risk}
              </span>
            </div>
          ))}
        </div>

        <div className="atalaya-kicker mb-2 mt-5">Features de riesgo (RTM)</div>
        {[
          { icon: Target, feature: 'Cajero automatico', detail: '< 200m', weight: 0.32 },
          { icon: Navigation, feature: 'Parada transporte', detail: '< 150m', weight: 0.28 },
          { icon: Radio, feature: 'Iluminacion baja', detail: 'sector', weight: 0.21 },
          { icon: Clock, feature: 'Comercio horario ext.', detail: '< 300m', weight: 0.14 },
        ].map((x) => {
          const Icon = x.icon;
          return (
            <div key={x.feature} className="border-b border-border py-2">
              <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate">{x.feature}</span>
                </span>
                <span className="atalaya-mono text-[10px] text-muted-foreground">{x.detail}</span>
              </div>
              <div className="h-1 rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${x.weight * 100}%` }} />
              </div>
            </div>
          );
        })}

        <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-sm bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Route className="h-4 w-4" />
          Crear caso desde zona
        </button>
        <button className="mt-2 w-full rounded-sm border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted">
          Asignar patrullaje
        </button>
      </aside>

      {panelOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/35 lg:hidden"
          onClick={() => setPanelOpen(false)}
        />
      )}
    </div>
  );
}
