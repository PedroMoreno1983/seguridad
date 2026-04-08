"""
RTM Model
=========
Risk Terrain Modeling - Modelado de Terreno de Riesgo.

Analiza features ambientales (cajeros, paraderos, bares, etc.)
para identificar territorios de riesgo.
"""

import numpy as np
import pandas as pd
from typing import Dict, Tuple, Optional, Any, List
from scipy.spatial.distance import cdist

from ..base import BaseModel


class RTMModel(BaseModel):
    """
    Risk Terrain Modeling para predicción espacial de delitos.
    
    Basado en la teoría de Caplan y Kennedy (2011).
    Cuantifica la influencia de features ambientales en el riesgo delictual.
    
    Fórmula: Riesgo = Σ (wᵢ × fᵢ)
    donde wᵢ es el peso del feature y fᵢ es la proximidad al feature.
    """
    
    NOMBRE = "RTM (Risk Terrain Modeling)"
    DESCRIPCION = "Modelo espacial basado en features ambientales y su influencia en el riesgo"
    TIPO = "espacial"
    REQUIERE_ENTRENAMIENTO = True
    TIEMPO_TIPICO = "~2-3 minutos"
    EFECTIVIDAD_ESTIMADA = "75-82%"
    
    VENTAJAS = [
        "Interpretable (explica el POR QUÉ)",
        "Habilita intervenciones CPTED",
        "No requiere datos históricos de delitos (prospectivo)",
        "Validado en múltiples estudios",
        "Gratuito y open-source (RTMDx)"
    ]
    
    DESVENTAJAS = [
        "Requiere features espaciales detallados",
        "No captura dinámica temporal",
        "Requiere validación de features",
        "Asume estacionariedad espacial"
    ]
    
    PARAMETROS_DEFAULT = {
        'grid_size': (50, 50),
        'influence_radius': 500,  # metros
        'decay_function': 'linear',  # linear, exponential, gaussian
        'feature_types': [
            'paradero', 'cajero', 'bar', 'restaurante',
            'colegio', 'hospital', 'baldio', 'luminaria'
        ],
    }
    
    def __init__(self, params: Optional[Dict] = None):
        super().__init__(params)
        self.features = None
        self.weights = None
        self.grid_coords = None
        
    def _decay_linear(self, distancias, max_dist):
        """Función de decaimiento lineal."""
        return np.maximum(0, 1 - distancias / max_dist)
    
    def _decay_exponential(self, distancias, max_dist):
        """Función de decaimiento exponencial."""
        return np.exp(-3 * distancias / max_dist)
    
    def _decay_gaussian(self, distancias, max_dist):
        """Función de decaimiento gaussiano."""
        return np.exp(-0.5 * (distancias / (max_dist / 2))**2)
    
    def preparar_datos(
        self,
        delitos: pd.DataFrame,
        features_espaciales: pd.DataFrame,
        bbox: Optional[Tuple] = None,
        **kwargs
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Preparar grillas de delitos y features.
        
        Args:
            delitos: DataFrame con columnas lat, lon
            features_espaciales: DataFrame con tipo_feature, lat, lon
            bbox: Bounding box (min_lon, min_lat, max_lon, max_lat)
        """
        if bbox is None:
            bbox = (
                delitos['longitud'].min(),
                delitos['latitud'].min(),
                delitos['longitud'].max(),
                delitos['latitud'].max()
            )
        
        self.bbox = bbox
        min_lon, min_lat, max_lon, max_lat = bbox
        
        grid_size = self.params['grid_size']
        
        # Crear grilla
        lons = np.linspace(min_lon, max_lon, grid_size[1])
        lats = np.linspace(min_lat, max_lat, grid_size[0])
        
        # Coordenadas de cada celda (centros)
        self.grid_coords = np.array([
            [(lon, lat) for lon in lons]
            for lat in lats
        ])
        
        # Grilla de delitos
        delitos_grid, _, _ = np.histogram2d(
            delitos['latitud'],
            delitos['longitud'],
            bins=[lats, lons]
        )
        
        # Features por tipo
        self.features = {}
        for tipo in self.params['feature_types']:
            feats_tipo = features_espaciales[
                features_espaciales['tipo_feature'] == tipo
            ]
            if len(feats_tipo) > 0:
                self.features[tipo] = feats_tipo[['longitud', 'latitud']].values
        
        return delitos_grid, self.grid_coords, self.features
    
    def entrenar(
        self,
        delitos_grid: np.ndarray,
        **kwargs
    ) -> Dict[str, float]:
        """
        Entrenar RTM estimando pesos de features.
        
        Simplificación: usamos correlación entre presencia de features
        y ocurrencia de delitos para estimar pesos.
        """
        print("Entrenando RTM...")
        
        decay_func = {
            'linear': self._decay_linear,
            'exponential': self._decay_exponential,
            'gaussian': self._decay_gaussian
        }[self.params['decay_function']]
        
        max_dist = self.params['influence_radius']
        
        # Calcular riesgo por cada feature
        riesgo_features = {}
        pesos = {}
        
        for tipo, coords in self.features.items():
            if len(coords) == 0:
                continue
            
            # Calcular distancia de cada celda al feature más cercano
            grid_flat = self.grid_coords.reshape(-1, 2)
            distancias = cdist(grid_flat, coords, metric='euclidean')
            dist_min = distancias.min(axis=1).reshape(self.params['grid_size'])
            
            # Convertir a influencia (0-1)
            influencia = decay_func(dist_min, max_dist)
            riesgo_features[tipo] = influencia
            
            # Peso = correlación con delitos observados
            correlacion = np.corrcoef(
                influencia.flatten(),
                delitos_grid.flatten()
            )[0, 1]
            
            pesos[tipo] = max(0, correlacion) if not np.isnan(correlacion) else 0.5
        
        self.weights = pesos
        self.riesgo_features = riesgo_features
        
        # Calcular riesgo total ponderado
        riesgo_total = np.zeros(self.params['grid_size'])
        total_peso = sum(pesos.values()) if pesos else 1
        
        for tipo, influencia in riesgo_features.items():
            riesgo_total += (pesos[tipo] / total_peso) * influencia
        
        self.riesgo_total = riesgo_total
        
        # Métricas
        correlacion_total = np.corrcoef(
            riesgo_total.flatten(),
            delitos_grid.flatten()
        )[0, 1]
        
        self.esta_entrenado = True
        self.metadata_entrenamiento = {
            'n_features_usados': len(self.features),
            'pesos': pesos,
            'correlacion': float(correlacion_total) if not np.isnan(correlacion_total) else 0,
        }
        
        return {
            'correlacion': float(correlacion_total) if not np.isnan(correlacion_total) else 0,
            'n_features': len(self.features),
            'pesos_promedio': np.mean(list(pesos.values())) if pesos else 0,
        }
    
    def predecir(
        self,
        nuevos_features: Optional[Dict] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Generar mapa de riesgo."""
        if not self.esta_entrenado:
            raise ValueError("Modelo no entrenado")
        
        # Usar features entrenados o nuevos
        if nuevos_features:
            # Recalcular con nuevos features
            pass  # Implementar si es necesario
        
        riesgo = self.riesgo_total
        
        # Clasificar en niveles
        percentiles = np.percentile(riesgo.flatten(), [20, 40, 60, 80])
        
        niveles = np.digitize(riesgo, percentiles)
        nombres_niveles = ['muy_bajo', 'bajo', 'medio', 'alto', 'critico']
        
        # Encontrar zonas de alto riesgo
        zonas_riesgo = []
        alto_riesgo = np.argwhere(niveles >= 3)  # alto o crítico
        
        for i, j in alto_riesgo[:20]:  # Top 20
            zonas_riesgo.append({
                'lat': float(self.grid_coords[i, j, 1]),
                'lon': float(self.grid_coords[i, j, 0]),
                'nivel': nombres_niveles[niveles[i, j]],
                'riesgo': float(riesgo[i, j]),
            })
        
        # Sort by riesgo
        zonas_riesgo.sort(key=lambda x: x['riesgo'], reverse=True)
        
        return {
            'riesgo_grid': riesgo.tolist(),
            'niveles': niveles.tolist(),
            'zonas_riesgo': zonas_riesgo,
            'pesos_features': self.weights,
            'bbox': list(self.bbox),
            'metadata': {
                'modelo': 'RTM',
                'influence_radius': self.params['influence_radius'],
                'decay_function': self.params['decay_function'],
            }
        }
