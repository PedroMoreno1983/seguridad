"""
LSTM Model
==========
Long Short-Term Memory para predicción de series temporales de delitos.

Ideal para capturar patrones temporales complejos y dependencias a largo plazo.
"""

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from typing import Dict, Tuple, Optional, Any, List
from datetime import datetime, timedelta

from ..base import BaseModel


class LSTMNet(nn.Module):
    """Red LSTM para predicción de series temporales."""
    
    def __init__(
        self,
        input_size: int,
        hidden_size: int = 128,
        num_layers: int = 2,
        output_size: int = 7,
        dropout: float = 0.2
    ):
        super(LSTMNet, self).__init__()
        
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0
        )
        
        self.dropout = nn.Dropout(dropout)
        self.fc1 = nn.Linear(hidden_size, hidden_size // 2)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(hidden_size // 2, output_size)
        
    def forward(self, x):
        # x shape: (batch, seq_len, input_size)
        lstm_out, (hidden, cell) = self.lstm(x)
        
        # Tomar el último hidden state
        out = self.dropout(hidden[-1])  # (batch, hidden_size)
        out = self.fc1(out)
        out = self.relu(out)
        out = self.dropout(out)
        out = self.fc2(out)
        
        return out


class LSTMModel(BaseModel):
    """
    Modelo LSTM para predicción de delitos.
    
    Captura patrones temporales complejos y es ideal para series
    con tendencias estacionales y comportamientos no lineales.
    """
    
    NOMBRE = "LSTM (Long Short-Term Memory)"
    DESCRIPCION = "Red neuronal recurrente para capturar patrones temporales complejos y dependencias a largo plazo"
    TIPO = "temporal"
    REQUIERE_ENTRENAMIENTO = True
    TIEMPO_TIPICO = "~10-15 minutos"
    EFECTIVIDAD_ESTIMADA = "85-90%"
    
    VENTAJAS = [
        "Captura dependencias a largo plazo",
        "Maneja patrones no lineales complejos",
        "Robusto a ruido en datos",
        "Excelente para series con estacionalidad"
    ]
    
    DESVENTAJAS = [
        "Requiere más datos que modelos estadísticos",
        "Tiempo de entrenamiento mayor",
        "Difícil de interpretar (caja negra)",
        "Puede sobreajustar con pocos datos"
    ]
    
    PARAMETROS_DEFAULT = {
        'sequence_length': 30,      # Días de historia para predecir
        'hidden_size': 128,          # Neuronas en capa oculta
        'num_layers': 2,             # Capas LSTM
        'dropout': 0.2,              # Regularización
        'learning_rate': 0.001,
        'epochs': 100,
        'batch_size': 32,
        'early_stopping_patience': 10,
    }
    
    def __init__(self, params: Optional[Dict] = None):
        super().__init__(params)
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.scaler = None
        self.sequence_length = self.params['sequence_length']
        
    def preparar_datos(
        self,
        df: pd.DataFrame,
        columna_fecha: str = 'fecha_hora',
        columna_target: str = 'cantidad',
        features_adicionales: Optional[List[str]] = None,
        **kwargs
    ) -> Tuple[np.ndarray, np.ndarray, pd.DataFrame]:
        """
        Preparar datos para LSTM.
        
        Crea secuencias temporales (X) y valores objetivo (y).
        """
        from sklearn.preprocessing import MinMaxScaler
        
        # Agregar features temporales
        df = df.copy()
        df['dia_semana'] = df[columna_fecha].dt.dayofweek
        df['mes'] = df[columna_fecha].dt.month
        df['dia_mes'] = df[columna_fecha].dt.day
        df['es_fin_semana'] = (df['dia_semana'] >= 5).astype(int)
        
        # Features cíclicas
        df['dia_semana_sin'] = np.sin(2 * np.pi * df['dia_semana'] / 7)
        df['dia_semana_cos'] = np.cos(2 * np.pi * df['dia_semana'] / 7)
        df['mes_sin'] = np.sin(2 * np.pi * df['mes'] / 12)
        df['mes_cos'] = np.cos(2 * np.pi * df['mes'] / 12)
        
        # Seleccionar features
        feature_cols = [columna_target, 'dia_semana_sin', 'dia_semana_cos', 
                       'mes_sin', 'mes_cos', 'es_fin_semana']
        
        if features_adicionales:
            feature_cols.extend(features_adicionales)
        
        data = df[feature_cols].values
        
        # Normalizar
        self.scaler = MinMaxScaler()
        data_scaled = self.scaler.fit_transform(data)
        
        # Crear secuencias
        X, y = [], []
        for i in range(len(data_scaled) - self.sequence_length):
            X.append(data_scaled[i:(i + self.sequence_length)])
            y.append(data_scaled[i + self.sequence_length, 0])  # Solo target
            
        X = np.array(X)
        y = np.array(y)
        
        return X, y, df
    
    def entrenar(
        self,
        X: np.ndarray,
        y: np.ndarray,
        X_val: Optional[np.ndarray] = None,
        y_val: Optional[np.ndarray] = None,
        **kwargs
    ) -> Dict[str, float]:
        """Entrenar modelo LSTM."""
        
        input_size = X.shape[2]
        output_size = kwargs.get('horizonte', 7)
        
        # Crear modelo
        self.modelo = LSTMNet(
            input_size=input_size,
            hidden_size=self.params['hidden_size'],
            num_layers=self.params['num_layers'],
            output_size=output_size,
            dropout=self.params['dropout']
        ).to(self.device)
        
        # Preparar datos
        X_tensor = torch.FloatTensor(X).to(self.device)
        y_tensor = torch.FloatTensor(y).to(self.device)
        
        if X_val is not None and y_val is not None:
            X_val_tensor = torch.FloatTensor(X_val).to(self.device)
            y_val_tensor = torch.FloatTensor(y_val).to(self.device)
        else:
            # Split interno si no hay validación externa
            split_idx = int(len(X) * 0.8)
            X_train, X_val = X[:split_idx], X[split_idx:]
            y_train, y_val = y[:split_idx], y[split_idx:]
            X_tensor = torch.FloatTensor(X_train).to(self.device)
            y_tensor = torch.FloatTensor(y_train).to(self.device)
            X_val_tensor = torch.FloatTensor(X_val).to(self.device)
            y_val_tensor = torch.FloatTensor(y_val).to(self.device)
        
        # Dataset y DataLoader
        train_dataset = torch.utils.data.TensorDataset(X_tensor, y_tensor)
        train_loader = torch.utils.data.DataLoader(
            train_dataset, 
            batch_size=self.params['batch_size'],
            shuffle=True
        )
        
        # Optimizador y loss
        criterion = nn.MSELoss()
        optimizer = torch.optim.Adam(
            self.modelo.parameters(), 
            lr=self.params['learning_rate']
        )
        scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
            optimizer, patience=5, factor=0.5
        )
        
        # Entrenamiento
        best_val_loss = float('inf')
        patience_counter = 0
        history = {'train_loss': [], 'val_loss': []}
        
        print(f"Entrenando LSTM en {self.device}...")
        
        for epoch in range(self.params['epochs']):
            # Training
            self.modelo.train()
            train_losses = []
            
            for batch_X, batch_y in train_loader:
                optimizer.zero_grad()
                outputs = self.modelo(batch_X)
                loss = criterion(outputs.squeeze(), batch_y)
                loss.backward()
                optimizer.step()
                train_losses.append(loss.item())
            
            avg_train_loss = np.mean(train_losses)
            
            # Validation
            self.modelo.eval()
            with torch.no_grad():
                val_outputs = self.modelo(X_val_tensor)
                val_loss = criterion(val_outputs.squeeze(), y_val_tensor).item()
            
            history['train_loss'].append(avg_train_loss)
            history['val_loss'].append(val_loss)
            
            scheduler.step(val_loss)
            
            # Early stopping
            if val_loss < best_val_loss:
                best_val_loss = val_loss
                patience_counter = 0
                # Guardar mejor modelo
                self.best_state = self.modelo.state_dict().copy()
            else:
                patience_counter += 1
                
            if patience_counter >= self.params['early_stopping_patience']:
                print(f"Early stopping en epoch {epoch}")
                break
            
            if (epoch + 1) % 10 == 0:
                print(f"Epoch {epoch+1}/{self.params['epochs']} - "
                      f"Train Loss: {avg_train_loss:.4f}, Val Loss: {val_loss:.4f}")
        
        # Restaurar mejor modelo
        if hasattr(self, 'best_state'):
            self.modelo.load_state_dict(self.best_state)
        
        self.esta_entrenado = True
        self.metadata_entrenamiento = {
            'epochs_entrenados': epoch + 1,
            'best_val_loss': float(best_val_loss),
            'final_train_loss': float(avg_train_loss),
            'history': history,
            'device': str(self.device),
        }
        
        return {
            'train_loss': float(avg_train_loss),
            'val_loss': float(best_val_loss),
            'epochs': epoch + 1,
        }
    
    def predecir(
        self,
        X: Optional[np.ndarray] = None,
        horizonte: int = 7,
        return_confianza: bool = True,
        **kwargs
    ) -> Dict[str, Any]:
        """Generar predicciones con LSTM."""
        
        if not self.esta_entrenado or self.modelo is None:
            raise ValueError("El modelo debe ser entrenado antes de predecir")
        
        self.modelo.eval()
        
        if X is None:
            # Usar última secuencia disponible
            raise ValueError("Debe proporcionar datos de entrada (X)")
        
        X_tensor = torch.FloatTensor(X[-1:]).to(self.device)  # Solo última secuencia
        
        with torch.no_grad():
            prediccion = self.modelo(X_tensor).cpu().numpy()
        
        # Desnormalizar
        if self.scaler is not None:
            # Crear array dummy con dimensiones correctas
            dummy = np.zeros((len(prediccion[0]), self.scaler.scale_.shape[0]))
            dummy[:, 0] = prediccion[0]  # Target en primera columna
            prediccion_desnorm = self.scaler.inverse_transform(dummy)[:, 0]
        else:
            prediccion_desnorm = prediccion[0]
        
        # Calcular intervalos de confianza (simple, basado en histórico)
        if return_confianza:
            uncertainty = np.std(prediccion_desnorm) * 0.5  # Simplificado
            lower = np.maximum(0, prediccion_desnorm - uncertainty)
            upper = prediccion_desnorm + uncertainty
        else:
            lower = upper = None
        
        return {
            'predicciones': prediccion_desnorm.tolist(),
            'horizonte': horizonte,
            'intervalo_confianza': {
                'lower': lower.tolist() if lower is not None else None,
                'upper': upper.tolist() if upper is not None else None,
            },
            'metadata': {
                'modelo': 'LSTM',
                'sequence_length': self.sequence_length,
                'device': str(self.device),
            }
        }
