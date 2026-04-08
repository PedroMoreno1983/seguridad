import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import Map, { Source, Layer, MapRef } from 'react-map-gl';
import { DeckGL } from '@deck.gl/react';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import { 
  Layers, Filter, Download, Eye, EyeOff,
  Flame, Map as MapIcon, Activity
} from 'lucide-react';
import { useAppStore } from '@/store';
import { useHeatmapData, useZonasRiesgo, usePredicciones } from '@/hooks/useApi';
import type { MapViewState } from 'react-map-gl';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

export function MapaPage() {
  const { selectedComuna, mapCenter, mapZoom, setMapView } = useAppStore();
  const mapRef = React.useRef<MapRef>(null);
  
  const [viewState, setViewState] = useState<MapViewState>({
    longitude: mapCenter.lng,
    latitude: mapCenter.lat,
    zoom: mapZoom,
  });
  
  const [capas, setCapas] = useState({
    delitos: true,
    predicciones: true,
    heatmap: true,
  });
  
  // Cargar datos
  const { data: heatmapData } = useHeatmapData(selectedComuna?.id || null, 365);
  const { data: zonasRiesgo } = useZonasRiesgo(selectedComuna?.id || null, 72);
  const { data: predicciones } = usePredicciones(selectedComuna?.id || null);
  
  // Preparar datos para Deck.gl
  const puntosDelitos = useMemo(() => {
    if (!heatmapData?.puntos) return [];
    return heatmapData.puntos.map((p: any) => ({
      position: [p.lon, p.lat],
      weight: 1,
    }));
  }, [heatmapData]);
  
  // Layers de Deck.gl
  const layers = useMemo(() => {
    if (!capas.heatmap || puntosDelitos.length === 0) return [];
    
    return [
      new HeatmapLayer({
        id: 'heatmap',
        data: puntosDelitos,
        getPosition: d => d.position,
        getWeight: d => d.weight,
        radiusPixels: 50,
        intensity: 1,
        threshold: 0.05,
        colorRange: [
          [0, 255, 0, 50],
          [255, 255, 0, 100],
          [255, 128, 0, 150],
          [255, 0, 0, 200],
        ],
      }),
    ];
  }, [puntosDelitos, capas.heatmap]);
  
  const onMove = useCallback((evt: { viewState: MapViewState }) => {
    setViewState(evt.viewState);
    setMapView(
      { lat: evt.viewState.latitude, lng: evt.viewState.longitude },
      evt.viewState.zoom
    );
  }, [setMapView]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <MapIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Configure VITE_MAPBOX_TOKEN para ver el mapa
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      {/* Sidebar de controles */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-80 bg-card border border-border rounded-xl p-4 space-y-4 overflow-y-auto"
      >
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Capas
          </h2>
          <p className="text-sm text-muted-foreground">
            {selectedComuna?.nombre}
          </p>
        </div>
        
        {/* Toggle capas */}
        <div className="space-y-2">
          <label className="flex items-center justify-between p-3 bg-muted rounded-lg cursor-pointer hover:bg-muted/80">
            <span className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-red-500" />
              Mapa de Calor
            </span>
            <input 
              type="checkbox" 
              checked={capas.heatmap}
              onChange={(e) => setCapas({...capas, heatmap: e.target.checked})}
              className="rounded"
            />
          </label>
          
          <label className="flex items-center justify-between p-3 bg-muted rounded-lg cursor-pointer hover:bg-muted/80">
            <span className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              Zonas de Riesgo
            </span>
            <input 
              type="checkbox" 
              checked={capas.predicciones}
              onChange={(e) => setCapas({...capas, predicciones: e.target.checked})}
              className="rounded"
            />
          </label>
        </div>
        
        {/* Leyenda */}
        <div className="border-t border-border pt-4">
          <h3 className="text-sm font-medium mb-2">Nivel de Riesgo</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500" />
              <span>Muy Bajo</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-lime-500" />
              <span>Bajo</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-yellow-500" />
              <span>Medio</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-orange-500" />
              <span>Alto</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-500" />
              <span>Crítico</span>
            </div>
          </div>
        </div>
        
        {/* Stats */}
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
            <div className="flex justify-between">
              <span className="text-muted-foreground">Período:</span>
              <span className="font-medium">{heatmapData?.dias || 365} días</span>
            </div>
          </div>
        </div>
      </motion.div>
      
      {/* Mapa */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex-1 relative rounded-xl overflow-hidden border border-border"
      >
        <DeckGL
          initialViewState={viewState}
          controller={true}
          layers={layers}
          onViewStateChange={onMove}
        >
          <Map
            ref={mapRef}
            mapboxAccessToken={MAPBOX_TOKEN}
            mapStyle="mapbox://styles/mapbox/dark-v11"
          >
            {/* Zonas de riesgo como source/layer */}
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
                <Layer
                  id="zonas-riesgo-outline"
                  type="line"
                  paint={{
                    'line-color': [
                      'match',
                      ['get', 'nivel'],
                      'muy_bajo', '#22c55e',
                      'bajo', '#84cc16',
                      'medio', '#eab308',
                      'alto', '#f97316',
                      'critico', '#ef4444',
                      '#666'
                    ],
                    'line-width': 2,
                  }}
                />
              </Source>
            )}
          </Map>
        </DeckGL>
        
        {/* Controles flotantes */}
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          <button className="p-2 bg-card border border-border rounded-lg shadow-lg hover:bg-muted">
            <Filter className="h-5 w-5" />
          </button>
          <button className="p-2 bg-card border border-border rounded-lg shadow-lg hover:bg-muted">
            <Download className="h-5 w-5" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

import * as React from 'react';
