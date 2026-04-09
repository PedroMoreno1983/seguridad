import { useState, useCallback, useRef } from 'react';
import Map, { Source, Layer } from 'react-map-gl';
import { Layers, Filter, Download } from 'lucide-react';
import { useAppStore } from '@/store';
import { useHeatmapData, useZonasRiesgo } from '@/hooks/useApi';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

export function MapaPage() {
  const { selectedComuna } = useAppStore();
  const mapRef = useRef<any>(null);
  
  const [viewState, setViewState] = useState({
    longitude: -70.65,
    latitude: -33.45,
    zoom: 11,
  });
  
  const [capas, setCapas] = useState({
    delitos: true,
    predicciones: true,
    heatmap: true,
  });
  
  const { data: heatmapData } = useHeatmapData(selectedComuna?.id || null, 365);
  const { data: zonasRiesgo } = useZonasRiesgo(selectedComuna?.id || null, 72);

  const onMove = useCallback((evt: any) => {
    setViewState(evt.viewState);
  }, []);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-muted-foreground">
            Configure VITE_MAPBOX_TOKEN para ver el mapa
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      <div className="w-80 bg-card border border-border rounded-xl p-4 space-y-4 overflow-y-auto">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Capas
          </h2>
          <p className="text-sm text-muted-foreground">{selectedComuna?.nombre}</p>
        </div>
        
        <div className="space-y-2">
          <label className="flex items-center justify-between p-3 bg-muted rounded-lg cursor-pointer hover:bg-muted/80">
            <span className="flex items-center gap-2">Mapa de Calor</span>
            <input 
              type="checkbox" 
              checked={capas.heatmap}
              onChange={(e) => setCapas({...capas, heatmap: e.target.checked})}
              className="rounded"
            />
          </label>
          
          <label className="flex items-center justify-between p-3 bg-muted rounded-lg cursor-pointer hover:bg-muted/80">
            <span className="flex items-center gap-2">Zonas de Riesgo</span>
            <input 
              type="checkbox" 
              checked={capas.predicciones}
              onChange={(e) => setCapas({...capas, predicciones: e.target.checked})}
              className="rounded"
            />
          </label>
        </div>
        
        <div className="border-t border-border pt-4">
          <h3 className="text-sm font-medium mb-2">Estadísticas</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Puntos en mapa:</span>
              <span className="font-medium">{heatmapData?.total_puntos || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Zonas de riesgo:</span>
              <span className="font-medium">{zonasRiesgo?.total_zonas || 0}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex-1 relative rounded-xl overflow-hidden border border-border">
        <Map
          ref={mapRef}
          {...viewState}
          onMove={onMove}
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          style={{ width: '100%', height: '100%' }}
        >
          {capas.predicciones && zonasRiesgo?.zonas && (
            <Source
              type="geojson"
              data={{
                type: 'FeatureCollection',
                features: zonasRiesgo.zonas.map((z: any) => ({
                  type: 'Feature',
                  geometry: {
                    type: 'Polygon',
                    coordinates: [z.coordinates],
                  },
                  properties: {
                    nivel: z.nivel,
                    probabilidad: z.probabilidad,
                  },
                })),
              }}
            >
              <Layer
                id="zonas-riesgo"
                type="fill"
                paint={{
                  'fill-color': [
                    'match',
                    ['get', 'nivel'],
                    'muy_bajo', '#22c55e',
                    'bajo', '#84cc16',
                    'medio', '#eab308',
                    'alto', '#f97316',
                    'critico', '#ef4444',
                    '#666'
                  ],
                  'fill-opacity': 0.4,
                }}
              />
            </Source>
          )}
        </Map>
        
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          <button className="p-2 bg-card border border-border rounded-lg shadow-lg hover:bg-muted">
            <Filter className="h-5 w-5" />
          </button>
          <button className="p-2 bg-card border border-border rounded-lg shadow-lg hover:bg-muted">
            <Download className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
