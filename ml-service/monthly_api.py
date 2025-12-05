# -*- coding: utf-8 -*-
"""
Monthly Usage Forecast API
Provides endpoints for predicting monthly energy usage trends using LSTM model.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
import numpy as np
import os
from sklearn.preprocessing import MinMaxScaler

# Try to import TensorFlow/Keras
try:
    from tensorflow.keras.models import Sequential, load_model
    from tensorflow.keras.layers import LSTM, Dense, Dropout
    TENSORFLOW_AVAILABLE = True
except ImportError:
    TENSORFLOW_AVAILABLE = False
    print("Warning: TensorFlow not available. Monthly predictions will use fallback.")

app = FastAPI(title="Monthly Forecast API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------
# CONFIG
# --------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REAL_DATA_PATH = os.path.join(BASE_DIR, 'House_4.csv')
SYNTHETIC_DATA_PATH = os.path.join(BASE_DIR, 'House_4_Demo (1).csv')
MODEL_PATH = os.path.join(BASE_DIR, 'models', 'monthly_lstm.h5')
FREQ = 'D'
LOOK_BACK_STEPS = 60
FORECAST_STEPS = 180

# Global variables for model and scaler
monthly_model = None
monthly_scaler = None
dataset_loaded = False

# --------------------------
# Response Models
# --------------------------
class MonthlyPrediction(BaseModel):
    month: str
    year: int
    month_label: str
    predicted_kwh: float

class MonthlyPredictionResponse(BaseModel):
    success: bool
    predictions: List[MonthlyPrediction]
    total_6_months_kwh: float
    data_source: str
    message: Optional[str] = None

# --------------------------
# DATA PROCESSING
# --------------------------
def load_and_resample(filepath, freq='D'):
    if not os.path.exists(filepath):
        # Try alternate filename
        alt_path = os.path.join(BASE_DIR, 'House_4_Demo.csv')
        if os.path.exists(alt_path):
            filepath = alt_path
        else:
            raise FileNotFoundError(f"Data file not found: {filepath}")

    print(f"Loading {filepath}...")
    df = pd.read_csv(filepath)
    df['Time'] = pd.to_datetime(df['Time'], errors='coerce')
    df.dropna(subset=['Time'], inplace=True)
    df.set_index('Time', inplace=True)

    # Resample
    df_resampled = df['Aggregate'].resample(freq).mean().to_frame()

    # Convert Units
    if freq == 'D':
        df_resampled['Aggregate'] = (df_resampled['Aggregate'] * 24) / 1000.0  # kWh/day
    elif freq == 'H':
        df_resampled['Aggregate'] = df_resampled['Aggregate'] / 1000.0  # kWh/hour

    df_resampled['Aggregate'] = df_resampled['Aggregate'].interpolate(method='linear', limit=2)
    df_resampled.dropna(inplace=True)

    # Feature Engineering
    df_resampled['month_sin'] = np.sin(2 * np.pi * df_resampled.index.month / 12)
    df_resampled['month_cos'] = np.cos(2 * np.pi * df_resampled.index.month / 12)

    return df_resampled

def create_sequences(data, look_back):
    X, y = [], []
    for i in range(len(data) - look_back):
        X.append(data[i:(i + look_back)])
        y.append(data[i + look_back, 0])
    return np.array(X), np.array(y)

# --------------------------
# MODEL BUILDING
# --------------------------
def build_model(input_shape):
    model = Sequential()
    model.add(LSTM(64, input_shape=input_shape, return_sequences=False))
    model.add(Dropout(0.2))
    model.add(Dense(1))
    model.compile(optimizer='adam', loss='mse')
    return model

# --------------------------
# FORECASTING LOOP
# --------------------------
def recursive_forecast(model, initial_sequence, steps, scaler, start_date):
    """
    Predicts recursively, UPDATING time features each step to capture seasonality.
    """
    forecast = []
    current_seq = initial_sequence.copy()
    current_date = start_date

    for i in range(steps):
        # 1. Predict next value
        input_seq = current_seq[np.newaxis, :, :]
        pred_value_normalized = model.predict(input_seq, verbose=0)[0, 0]
        forecast.append(pred_value_normalized)

        # 2. Advance time by 1 day
        current_date = current_date + pd.Timedelta(days=1)

        # 3. Create next input row with UPDATED time features
        next_row = current_seq[-1].copy()

        # Update Target (Aggregate Power) - Index 0
        next_row[0] = pred_value_normalized

        # Update Time Features - Indices 1 & 2
        next_row[1] = np.sin(2 * np.pi * current_date.month / 12)  # month_sin
        next_row[2] = np.cos(2 * np.pi * current_date.month / 12)  # month_cos

        # 4. Slide window
        current_seq = np.vstack([current_seq[1:], next_row])

    # Inverse transform
    dummy_array = np.zeros((len(forecast), current_seq.shape[1]))
    dummy_array[:, 0] = forecast
    inverse_forecast = scaler.inverse_transform(dummy_array)[:, 0]

    return inverse_forecast

# --------------------------
# MODEL LOADING
# --------------------------
def load_or_train_model():
    """Load existing model or train a new one."""
    global monthly_model, monthly_scaler, dataset_loaded
    
    if not TENSORFLOW_AVAILABLE:
        print("TensorFlow not available, using fallback predictions")
        dataset_loaded = True
        return
    
    try:
        # Load training data
        print("--- Loading Training Data ---")
        real_df = load_and_resample(REAL_DATA_PATH, freq=FREQ)
        
        monthly_scaler = MinMaxScaler(feature_range=(0, 1))
        scaled_train = monthly_scaler.fit_transform(real_df.values)
        
        X_train, y_train = create_sequences(scaled_train, LOOK_BACK_STEPS)
        
        # Check if model exists
        if os.path.exists(MODEL_PATH):
            print(f"Loading existing model from {MODEL_PATH}")
            monthly_model = load_model(MODEL_PATH)
        else:
            print("--- Training LSTM Model ---")
            monthly_model = build_model((X_train.shape[1], X_train.shape[2]))
            monthly_model.fit(X_train, y_train, epochs=30, batch_size=16, validation_split=0.1, verbose=1)
            
            # Save model
            os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
            monthly_model.save(MODEL_PATH)
            print(f"Model saved to {MODEL_PATH}")
        
        dataset_loaded = True
        print("Monthly forecast model ready!")
        
    except Exception as e:
        print(f"Error loading/training model: {e}")
        dataset_loaded = True  # Allow fallback predictions

def get_monthly_predictions():
    """Generate monthly predictions for the next 6 months."""
    global monthly_model, monthly_scaler
    
    if not TENSORFLOW_AVAILABLE or monthly_model is None:
        # Return fallback predictions
        return generate_fallback_predictions()
    
    try:
        # Load synthetic data for forecasting
        synth_df = load_and_resample(SYNTHETIC_DATA_PATH, freq=FREQ)
        scaled_synth = monthly_scaler.transform(synth_df.values)
        
        initial_seq = scaled_synth[-LOOK_BACK_STEPS:]
        last_date = synth_df.index[-1]
        
        # Get daily predictions
        daily_predictions = recursive_forecast(
            monthly_model, initial_seq, FORECAST_STEPS, monthly_scaler, start_date=last_date
        )
        
        # Create dates for the forecast
        future_dates = pd.date_range(start=last_date + pd.Timedelta(days=1), periods=FORECAST_STEPS, freq='D')
        
        # Create a DataFrame
        forecast_df = pd.DataFrame({'Date': future_dates, 'Daily_kWh': daily_predictions})
        
        # Group by Month and Sum the energy
        monthly_totals = forecast_df.resample('ME', on='Date')['Daily_kWh'].sum()
        
        # Get first 6 months
        monthly_totals = monthly_totals.iloc[:6]
        
        predictions = []
        for date, value in monthly_totals.items():
            predictions.append(MonthlyPrediction(
                month=date.strftime('%B'),
                year=date.year,
                month_label=date.strftime('%b %Y'),
                predicted_kwh=round(float(value), 2)
            ))
        
        return MonthlyPredictionResponse(
            success=True,
            predictions=predictions,
            total_6_months_kwh=round(float(monthly_totals.sum()), 2),
            data_source="LSTM Model + House_4 Dataset"
        )
        
    except Exception as e:
        print(f"Error generating predictions: {e}")
        return generate_fallback_predictions()

def generate_fallback_predictions():
    """Generate fallback predictions when model is not available."""
    from datetime import datetime
    
    current_date = datetime.now()
    predictions = []
    
    # Generate 6 months of predictions with seasonal variation
    base_usage = 450  # Base monthly kWh
    
    for i in range(6):
        month_offset = (current_date.month + i - 1) % 12 + 1
        year = current_date.year + ((current_date.month + i - 1) // 12)
        
        # Add seasonal variation (higher in hot months)
        if month_offset in [4, 5, 6, 7, 8]:  # Apr-Aug (hot season)
            seasonal_factor = 1.15
        elif month_offset in [11, 12, 1, 2]:  # Nov-Feb (monsoon)
            seasonal_factor = 0.95
        else:
            seasonal_factor = 1.0
        
        predicted_kwh = base_usage * seasonal_factor * (0.95 + np.random.random() * 0.1)
        
        month_date = pd.Timestamp(year=year, month=month_offset, day=1)
        predictions.append(MonthlyPrediction(
            month=month_date.strftime('%B'),
            year=year,
            month_label=month_date.strftime('%b %Y'),
            predicted_kwh=round(float(predicted_kwh), 2)
        ))
    
    total = sum(p.predicted_kwh for p in predictions)
    
    return MonthlyPredictionResponse(
        success=True,
        predictions=predictions,
        total_6_months_kwh=round(total, 2),
        data_source="Fallback (Seasonal Estimation)",
        message="Using estimated values. Model training may be in progress."
    )

# --------------------------
# API ENDPOINTS
# --------------------------
@app.get("/")
def root():
    return {"status": "ok", "service": "Monthly Forecast API"}

@app.get("/predict", response_model=MonthlyPredictionResponse)
def predict_monthly():
    """Get monthly energy usage predictions for the next 6 months."""
    if not dataset_loaded:
        raise HTTPException(status_code=503, detail="Model is still loading. Please try again later.")
    
    return get_monthly_predictions()

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "model_loaded": monthly_model is not None,
        "tensorflow_available": TENSORFLOW_AVAILABLE
    }

# For standalone testing
if __name__ == "__main__":
    import uvicorn
    load_or_train_model()
    uvicorn.run(app, host="0.0.0.0", port=8002)
