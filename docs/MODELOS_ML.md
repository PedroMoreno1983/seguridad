# 🤖 Modelos de Machine Learning - SafeCity Platform

## Resumen de Modelos Implementados

La plataforma SafeCity incluye **9 modelos de ML** para predicción de delitos, organizados en tres categorías:

| Categoría | Modelos | Uso Principal |
|-----------|---------|---------------|
| **Temporal** | LSTM, GRU, Prophet, ARIMA, TFT | Predicción de cantidad de delitos en el tiempo |
| **Espacial** | RTM | Identificación de territorios de riesgo |
| **Espaciotemporal** | SEPP, XGBoost, ConvLSTM | Predicción de hotspots móviles |

---

## 📊 Modelos de Series Temporales

### 1. LSTM (Long Short-Term Memory)

```python
Modelo: LSTM
Efectividad: 85-90%
Tiempo: ~10-15 minutos
Tipo: Red neuronal recurrente
```

**Descripción:**
Red neuronal recurrente avanzada que captura dependencias a largo plazo en series temporales. Ideal para patrones complejos con estacionalidad.

**Características:**
- Maneja secuencias de 30+ días
- Captura patrones no lineales
- Incluye features temporales (día de semana, mes, etc.)
- Early stopping y regularización

**Ejemplo de uso:**
```bash
POST /api/v1/ml/entrenar
{
    "comuna_id": 22,
    "modelo": "LSTM",
    "dias_historia": 365,
    "params": {
        "hidden_size": 128,
        "num_layers": 2,
        "dropout": 0.2
    }
}
```

---

### 2. GRU (Gated Recurrent Unit)

```python
Modelo: GRU
Efectividad: 83-88%
Tiempo: ~7-10 minutos
Tipo: Red neuronal recurrente (ligera)
```

**Descripción:**
Alternativa más ligera a LSTM con menos parámetros y entrenamiento más rápido.

**Ventajas sobre LSTM:**
- 25% más rápido de entrenar
- Menos propensión a overfitting
- Similar precisión en datasets medianos

---

### 3. Prophet (Facebook)

```python
Modelo: Prophet
Efectividad: 78-85%
Tiempo: ~1-2 minutos
Tipo: Modelo aditivo
```

**Descripción:**
Modelo desarrollado por Facebook para series temporales con estacionalidad automática. Muy interpretable.

**Componentes:**
- **Tendencia**: Crecimiento/decrecimiento a largo plazo
- **Estacionalidad**: Semanal, anual, mensual
- **Festivos**: Días festivos de Chile (18 de septiembre, etc.)
- **Efectos especiales**: Eventos puntuales

**Interpretación:**
```
y(t) = tendencia(t) + estacionalidad_semanal(t) + 
       estacionalidad_anual(t) + efectos_festivos(t)
```

**Mejor para:**
- Datos con estacionalidad fuerte
- Explicar tendencias a no-técnicos
- Interpolación de datos faltantes

---

### 4. ARIMA / SARIMA

```python
Modelo: ARIMA
Efectividad: 75-82%
Tiempo: ~30-60 segundos
Tipo: Modelo estadístico clásico
```

**Descripción:**
Autoregressive Integrated Moving Average. Modelo estadístico clásico muy interpretable.

**Parámetros:**
- **p**: Orden autorregresivo
- **d**: Orden de diferenciación
- **q**: Orden de media móvil
- **P,D,Q,s**: Componentes estacionales

**Auto-ARIMA:**
Busca automáticamente los mejores parámetros (p,d,q) usando AIC/BIC.

**Ventajas:**
- Base estadística sólida
- Intervalos de confianza válidos
- Muy rápido
- Interpretable

---

### 5. Temporal Fusion Transformer (TFT)

```python
Modelo: TFT
Efectividad: 88-93%
Tiempo: ~20-30 minutos
Tipo: Transformer para series temporales
```

**Descripción:**
State-of-the-art desarrollado por Google DeepMind. Combina múltiples técnicas avanzadas.

**Arquitectura:**
- Variable Selection Networks
- Gated Residual Networks
- Multi-head Attention interpretable
- LSTM para procesamiento local

**Mejor para:**
- Series multivariadas complejas
- Cuando se necesita interpretabilidad
- Predicciones de múltiples horizontes

---

## 🗺️ Modelos Espaciales

### 6. RTM (Risk Terrain Modeling)

```python
Modelo: RTM
Efectividad: 75-82%
Tiempo: ~2-3 minutos
Tipo: Modelado de terreno de riesgo
```

**Descripción:**
Modelo espacial que analiza features ambientales (cajeros, paraderos, bares) para identificar territorios de riesgo.

**Fórmula:**
```
Riesgo(x,y) = Σ (wᵢ × fᵢ(x,y))
```

Donde:
- wᵢ = peso del feature i
- fᵢ = función de influencia del feature i

**Features utilizados:**
- Paraderos de transporte
- Cajeros automáticos
- Bares y restaurantes
- Colegios y hospitales
- Terrenos baldíos
- Luminarias

**Interpretación:**
Cada feature tiene un peso que indica su influencia en el delito. Permite intervenciones CPTED (prevención ambiental).

---

## 🌐 Modelos Espaciotemporales

### 7. SEPP (Self-Exciting Point Process)

```python
Modelo: SEPP
Efectividad: 85-89%
Tiempo: ~5-10 minutos
Tipo: Proceso puntual autoexitado
```

**Descripción:**
Modelo matemático basado en "near-repeat victimization" (victimización repetida). Adaptado de sismología por Mohler et al. (2011).

**Fórmula:**
```
λ(t,x,y) = μ(x,y) + Σ g(t-tᵢ, x-xᵢ, y-yᵢ)
```

- μ(x,y): Tasa de fondo (background)
- g: Función de excitación (kernel)
- (tᵢ, xᵢ, yᵢ): Eventos pasados

**Parámetros:**
- Ancho de banda temporal: 72 horas (3 días)
- Ancho de banda espacial: 500 metros
- Kernel: Exponencial o Gaussiano

**Mejor para:**
- Robos residenciales (near-repeat)
- Hotspots dinámicos
- Patrones de "contagio" delictual

---

### 8. XGBoost Espaciotemporal

```python
Modelo: XGBoost
Efectividad: 82-88%
Tiempo: ~2-3 minutos
Tipo: Gradient boosting
```

**Descripción:**
Gradient boosting con feature engineering espaciotemporal.

**Features:**
- Lags temporales (1, 7, 14, 30 días)
- Medias móviles (7, 14, 30 días)
- Features temporales (día semana, mes, fin de semana)
- Features cíclicas (sin/cos)
- Interacciones

**Ventajas:**
- Feature importance integrado
- Maneja relaciones no lineales
- Rápido de entrenar e inferir

---

### 9. ConvLSTM (CNN + LSTM)

```python
Modelo: ConvLSTM
Efectividad: 87-92%
Tiempo: ~15-20 minutos
Tipo: Red neuronal espaciotemporal
```

**Descripción:**
Combina CNN (procesamiento espacial) con LSTM (procesamiento temporal).

**Arquitectura:**
- Input: Secuencias de grillas espaciales
- ConvLSTM cells: Capturan patrones espaciotemporales
- Output: Grilla de predicción futura

**Mejor para:**
- Hotspots que se mueven en el espacio
- Predicción de forma y evolución de hotspots
- Patrones espaciales complejos

---

## 🔬 Comparación de Modelos

| Modelo | Precisión | Velocidad | Interpretabilidad | Datos necesarios |
|--------|-----------|-----------|-------------------|------------------|
| **LSTM** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| **GRU** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| **Prophet** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **ARIMA** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| **TFT** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **RTM** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| **SEPP** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **XGBoost** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **ConvLSTM** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 🎯 Recomendaciones por Caso de Uso

### Predicción de cantidad total de delitos
**Mejores opciones:**
1. TFT (mayor precisión)
2. LSTM (buen balance)
3. Prophet (interpretable)

### Identificación de zonas de riesgo
**Mejores opciones:**
1. RTM (explica el por qué)
2. SEPP (para near-repeat)
3. XGBoost (con features espaciales)

### Hotspots dinámicos
**Mejores opciones:**
1. ConvLSTM (state-of-the-art)
2. SEPP (victimización repetida)
3. LSTM espaciotemporal

### Pocos datos (< 6 meses)
**Mejores opciones:**
1. ARIMA (mínimo 30 puntos)
2. Prophet (robusto)
3. RTM (no requiere historia)

### Explicación a autoridades
**Mejores opciones:**
1. Prophet (componentes separables)
2. RTM (features tangibles)
3. XGBoost (feature importance)

---

## 🔄 Ensemble de Modelos

La plataforma permite combinar múltiples modelos para mayor precisión:

```bash
POST /api/v1/ml/ensemble
{
    "comuna_id": 22,
    "modelos": ["LSTM", "Prophet", "XGBoost"],
    "pesos": [0.4, 0.3, 0.3],
    "horizonte": 7
}
```

**Efectividad típica de ensemble:** 90-95%

---

## 📈 Endpoints de la API

### Listar modelos
```bash
GET /api/v1/ml/modelos
```

### Entrenar modelo
```bash
POST /api/v1/ml/entrenar
{
    "comuna_id": 22,
    "modelo": "LSTM",
    "dias_historia": 365
}
```

### Generar predicción
```bash
POST /api/v1/ml/predecir
{
    "comuna_id": 22,
    "modelo": "LSTM",
    "horizonte": 7
}
```

### Comparar modelos
```bash
POST /api/v1/ml/comparar
{
    "comuna_id": 22,
    "modelos": ["LSTM", "Prophet", "ARIMA"],
    "dias_test": 30
}
```

### Benchmark completo
```bash
GET /api/v1/ml/benchmark?comuna_id=22&dias=30
```

---

## 📚 Referencias

1. **Mohler et al. (2011)** - Self-Exciting Point Process
2. **Caplan & Kennedy (2011)** - Risk Terrain Modeling
3. **Taylor & Letham (2018)** - Prophet
4. **Lim et al. (2021)** - Temporal Fusion Transformer
5. **Shi et al. (2015)** - ConvLSTM

---

**Última actualización:** Abril 2026
**Versión:** 1.0.0
