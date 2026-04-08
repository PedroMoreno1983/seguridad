"""
GRU Model
=========
Gated Recurrent Unit - Alternativa más ligera a LSTM.

Similar a LSTM pero con menos parámetros, más rápido de entrenar.
"""

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from typing import Dict, Tuple, Optional, Any, List

from ..base import BaseModel


class GRUNet(nn.Module):
    """Red GRU para predicción de series temporales."""
    
    def __init__(
        self,
        input_size: int,
        hidden_size: int = 128,
        num_layers: int = 2,
        output_size: int = 7,
        dropout: float = 0.2
    ):
        super(GRUNet, self).__init__()
        
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        
        self.gru = nn.GRU(
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
        gru_out, hidden = self.gru(x)
        out = self.dropout(hidden[-1])
        out = self.fc1(out)
        out = self.relu(out)
        out = self.dropout(out)
        out = self.fc2(out)
        return out


class GRUModel(BaseModel):
    """
    Modelo GRU para predicción de delitos.
    
    Versión más ligera y rápida de LSTM, ideal cuando se necesita
    entrenamiento rápido sin sacrificar mucha precisión.
    """
    
    NOMBRE = "GRU (Gated Recurrent Unit)"
    DESCRIPCION = "Alternativa ligera a LSTM, más rápida de entrenar con rendimiento similar"
    TIPO = "temporal"
    REQUIERE_ENTRENAMIENTO = True
    TIEMPO_TIPICO = "~7-10 minutos"
    EFECTIVIDAD_ESTIMADA = "83-88%"
    
    VENTAJAS = [
        "Más rápido que LSTM",
        "Menos parámetros (menor overfitting)",
        "Bueno para datasets medianos",
        "Entrenamiento eficiente"
    ]
    
    DESVENTAJAS = [
        "Ligeramente menos preciso que LSTM",
        "También es caja negra",
        "Requiere tuning de hiperparámetros"
    ]
    
    PARAMETROS_DEFAULT = {
        'sequence_length': 30,
        'hidden_size': 128,
        'num_layers': 2,
        'dropout': 0.2,
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
        """Preparar datos (mismo que LSTM)."""
        from sklearn.preprocessing import MinMaxScaler
        
        df = df.copy()
        df['dia_semana'] = df[columna_fecha].dt.dayofweek
        df['mes'] = df[columna_fecha].dt.month
        df['es_fin_semana'] = (df['dia_semana'] >= 5).astype(int)
        
        df['dia_semana_sin'] = np.sin(2 * np.pi * df['dia_semana'] / 7)
        df['dia_semana_cos'] = np.cos(2 * np.pi * df['dia_semana'] / 7)
        df['mes_sin'] = np.sin(2 * np.pi * df['mes'] / 12)
        df['mes_cos'] = np.cos(2 * np.pi * df['mes'] / 12)
        
        feature_cols = [columna_target, 'dia_semana_sin', 'dia_semana_cos',
                       'mes_sin', 'mes_cos', 'es_fin_semana']
        
        if features_adicionales:
            feature_cols.extend(features_adicionales)
        
        data = df[feature_cols].values
        self.scaler = MinMaxScaler()
        data_scaled = self.scaler.fit_transform(data)
        
        X, y = [], []
        for i in range(len(data_scaled) - self.sequence_length):
            X.append(data_scaled[i:(i + self.sequence_length)])
            y.append(data_scaled[i + self.sequence_length, 0])
            
        return np.array(X), np.array(y), df
    
    def entrenar(self, X, y, X_val=None, y_val=None, **kwargs):
        """Entrenar modelo GRU."""
        input_size = X.shape[2]
        output_size = kwargs.get('horizonte', 7)
        
        self.modelo = GRUNet(
            input_size=input_size,
            hidden_size=self.params['hidden_size'],
            num_layers=self.params['num_layers'],
            output_size=output_size,
            dropout=self.params['dropout']
        ).to(self.device)
        
        # Mismo código de entrenamiento que LSTM
        X_tensor = torch.FloatTensor(X).to(self.device)
        y_tensor = torch.FloatTensor(y).to(self.device)
        
        if X_val is not None and y_val is not None:
            X_val_tensor = torch.FloatTensor(X_val).to(self.device)
            y_val_tensor = torch.FloatTensor(y_val).to(self.device)
        else:
            split_idx = int(len(X) * 0.8)
            X_train, X_val = X[:split_idx], X[split_idx:]
            y_train, y_val = y[:split_idx], y[split_idx:]
            X_tensor = torch.FloatTensor(X_train).to(self.device)
            y_tensor = torch.FloatTensor(y_train).to(self.device)
            X_val_tensor = torch.FloatTensor(X_val).to(self.device)
            y_val_tensor = torch.FloatTensor(y_val).to(self.device)
        
        train_dataset = torch.utils.data.TensorDataset(X_tensor, y_tensor)
        train_loader = torch.utils.data.DataLoader(
            train_dataset,
            batch_size=self.params['batch_size'],
            shuffle=True
        )
        
        criterion = nn.MSELoss()
        optimizer = torch.optim.Adam(self.modelo.parameters(), lr=self.params['learning_rate'])
        scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=5, factor=0.5)
        
        best_val_loss = float('inf')
        patience_counter = 0
        history = {'train_loss': [], 'val_loss': []}
        
        print(f"Entrenando GRU en {self.device}...")
        
        for epoch in range(self.params['epochs']):
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
            
            self.modelo.eval()
            with torch.no_grad():
                val_outputs = self.modelo(X_val_tensor)
                val_loss = criterion(val_outputs.squeeze(), y_val_tensor).item()
            
            history['train_loss'].append(avg_train_loss)
            history['val_loss'].append(val_loss)
            scheduler.step(val_loss)
            
            if val_loss < best_val_loss:
                best_val_loss = val_loss
                patience_counter = 0
                self.best_state = self.modelo.state_dict().copy()
            else:
                patience_counter += 1
                
            if patience_counter >= self.params['early_stopping_patience']:
                print(f"Early stopping en epoch {epoch}")
                break
            
            if (epoch + 1) % 10 == 0:
                print(f"Epoch {epoch+1} - Train: {avg_train_loss:.4f}, Val: {val_loss:.4f}")
        
        if hasattr(self, 'best_state'):
            self.modelo.load_state_dict(self.best_state)
        
        self.esta_entrenado = True
        self.metadata_entrenamiento = {
            'epochs_entrenados': epoch + 1,
            'best_val_loss': float(best_val_loss),
            'device': str(self.device),
            'history': history,
        }
        
        return {
            'train_loss': float(avg_train_loss),
            'val_loss': float(best_val_loss),
            'epochs': epoch + 1,
        }
    
    def predecir(self, X=None, horizonte=7, **kwargs):
        """Generar predicciones con GRU."""
        if not self.esta_entrenado:
            raise ValueError("Modelo no entrenado")
        
        self.modelo.eval()
        X_tensor = torch.FloatTensor(X[-1:]).to(self.device)
        
        with torch.no_grad():
            prediccion = self.modelo(X_tensor).cpu().numpy()
        
        if self.scaler is not None:
            dummy = np.zeros((len(prediccion[0]), self.scaler.scale_.shape[0]))
            dummy[:, 0] = prediccion[0]
            prediccion_desnorm = self.scaler.inverse_transform(dummy)[:, 0]
        else:
            prediccion_desnorm = prediccion[0]
        
        return {
            'predicciones': prediccion_desnorm.tolist(),
            'horizonte': horizonte,
            'modelo': 'GRU',
        }
