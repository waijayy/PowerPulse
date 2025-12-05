"""
LSTM Model Training Script for Energy Forecasting
This script trains two models:
1. Hourly Model - Predicts next hour's power usage (Watts)
2. Daily Model - Predicts next 7 days energy usage (kWh)

Dataset Requirements:
- CSV file with columns: 'timestamp' (datetime) and 'power' or 'watts' (numeric)
- OR at minimum: a numeric column with power readings
- Hourly data for at least 30 days recommended
"""

import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Input
from tensorflow.keras.callbacks import EarlyStopping
import joblib
import os

# --- Configuration ---
DATASET_PATH = 'House_4.csv'  # Change this to your dataset path
MODEL_DIR = 'models'

# Hourly model config
HOURLY_MODEL_PATH = os.path.join(MODEL_DIR, 'lstm_hourly.h5')
HOURLY_SCALER_PATH = os.path.join(MODEL_DIR, 'scaler_hourly.pkl')
HOURLY_LOOK_BACK = 24  # Use 24 hours of history

# Daily model config
DAILY_MODEL_PATH = os.path.join(MODEL_DIR, 'lstm_daily.h5')
DAILY_SCALER_PATH = os.path.join(MODEL_DIR, 'scaler_daily.pkl')
DAILY_LOOK_BACK = 30   # Use 30 days of history
DAILY_FORECAST_STEPS = 7  # Predict 7 days ahead

# --- Helper Functions ---

def create_sequences(data, look_back, forecast_steps=1):
    """Create sequences for LSTM training"""
    X, y = [], []
    for i in range(len(data) - look_back - forecast_steps + 1):
        X.append(data[i:(i + look_back), 0])
        if forecast_steps == 1:
            y.append(data[i + look_back, 0])
        else:
            y.append(data[(i + look_back):(i + look_back + forecast_steps), 0])
    return np.array(X), np.array(y)

def build_lstm_model(look_back, output_size=1):
    """Build LSTM model architecture"""
    model = Sequential([
        Input(shape=(look_back, 1)),
        LSTM(50, return_sequences=True),
        LSTM(50, return_sequences=False),
        Dense(25),
        Dense(output_size)
    ])
    model.compile(optimizer='adam', loss='mse', metrics=['mae'])
    return model

def load_and_prepare_data(filepath):
    """Load dataset and prepare for training"""
    print(f"Loading data from {filepath}...")
    
    if not os.path.exists(filepath):
        print(f"\n❌ ERROR: Dataset not found at '{filepath}'")
        print("\n📁 Please provide a CSV file with your energy data.")
        print("   Expected format:")
        print("   - Column 'timestamp' or 'datetime' (optional but recommended)")
        print("   - Column 'power', 'watts', 'energy', or 'kwh' (required)")
        print("\n   Example CSV structure:")
        print("   timestamp,power")
        print("   2024-01-01 00:00:00,150.5")
        print("   2024-01-01 01:00:00,142.3")
        print("   ...")
        return None
    
    df = pd.read_csv(filepath)
    print(f"Loaded {len(df)} rows")
    print(f"Columns: {list(df.columns)}")
    
    # Try to find the power/energy column
    power_col = None
    possible_names = ['power', 'watts', 'energy', 'kwh', 'usage', 'consumption', 'value']
    for col in df.columns:
        if col.lower() in possible_names:
            power_col = col
            break
    
    if power_col is None:
        # Use first numeric column
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        if len(numeric_cols) > 0:
            power_col = numeric_cols[0]
            print(f"Using column '{power_col}' as power data")
        else:
            print("❌ ERROR: No numeric column found in dataset")
            return None
    
    # Try to parse timestamp
    time_col = None
    for col in df.columns:
        if col.lower() in ['timestamp', 'datetime', 'date', 'time']:
            time_col = col
            break
    
    if time_col:
        df[time_col] = pd.to_datetime(df[time_col])
        df = df.sort_values(time_col)
    
    return df, power_col, time_col

def train_hourly_model(hourly_data):
    """Train the hourly prediction model"""
    print("\n" + "="*50)
    print("🔧 Training Hourly Model...")
    print("="*50)
    
    # Scale data
    scaler = MinMaxScaler(feature_range=(0, 1))
    scaled_data = scaler.fit_transform(hourly_data.reshape(-1, 1))
    
    # Create sequences
    X, y = create_sequences(scaled_data, HOURLY_LOOK_BACK, forecast_steps=1)
    X = X.reshape((X.shape[0], X.shape[1], 1))
    
    # Split train/test
    train_size = int(len(X) * 0.8)
    X_train, X_test = X[:train_size], X[train_size:]
    y_train, y_test = y[:train_size], y[train_size:]
    
    print(f"Training samples: {len(X_train)}, Test samples: {len(X_test)}")
    
    # Build and train model
    model = build_lstm_model(HOURLY_LOOK_BACK, output_size=1)
    
    early_stop = EarlyStopping(monitor='val_loss', patience=10, restore_best_weights=True)
    
    history = model.fit(
        X_train, y_train,
        epochs=50,
        batch_size=32,
        validation_data=(X_test, y_test),
        callbacks=[early_stop],
        verbose=1
    )
    
    # Evaluate
    loss, mae = model.evaluate(X_test, y_test, verbose=0)
    print(f"Test Loss (MSE): {loss:.6f}")
    print(f"Test MAE: {mae:.6f}")
    
    # Save model and scaler
    model.save(HOURLY_MODEL_PATH)
    joblib.dump(scaler, HOURLY_SCALER_PATH)
    print(f"✅ Hourly model saved to {HOURLY_MODEL_PATH}")
    print(f"✅ Hourly scaler saved to {HOURLY_SCALER_PATH}")
    
    return model, scaler

def train_daily_model(daily_data):
    """Train the daily/weekly prediction model"""
    print("\n" + "="*50)
    print("🔧 Training Daily Model (7-day forecast)...")
    print("="*50)
    
    # Scale data
    scaler = MinMaxScaler(feature_range=(0, 1))
    scaled_data = scaler.fit_transform(daily_data.reshape(-1, 1))
    
    # Create sequences for 7-day forecast
    X, y = create_sequences(scaled_data, DAILY_LOOK_BACK, forecast_steps=DAILY_FORECAST_STEPS)
    X = X.reshape((X.shape[0], X.shape[1], 1))
    
    if len(X) < 10:
        print("❌ ERROR: Not enough data for daily model training")
        print(f"   Need at least {DAILY_LOOK_BACK + DAILY_FORECAST_STEPS + 10} days of data")
        return None, None
    
    # Split train/test
    train_size = int(len(X) * 0.8)
    X_train, X_test = X[:train_size], X[train_size:]
    y_train, y_test = y[:train_size], y[train_size:]
    
    print(f"Training samples: {len(X_train)}, Test samples: {len(X_test)}")
    
    # Build and train model
    model = build_lstm_model(DAILY_LOOK_BACK, output_size=DAILY_FORECAST_STEPS)
    
    early_stop = EarlyStopping(monitor='val_loss', patience=10, restore_best_weights=True)
    
    history = model.fit(
        X_train, y_train,
        epochs=50,
        batch_size=32,
        validation_data=(X_test, y_test),
        callbacks=[early_stop],
        verbose=1
    )
    
    # Evaluate
    loss, mae = model.evaluate(X_test, y_test, verbose=0)
    print(f"Test Loss (MSE): {loss:.6f}")
    print(f"Test MAE: {mae:.6f}")
    
    # Save model and scaler
    model.save(DAILY_MODEL_PATH)
    joblib.dump(scaler, DAILY_SCALER_PATH)
    print(f"✅ Daily model saved to {DAILY_MODEL_PATH}")
    print(f"✅ Daily scaler saved to {DAILY_SCALER_PATH}")
    
    return model, scaler

def generate_sample_data():
    """Generate sample energy data for testing"""
    print("\n📊 Generating sample energy data for demonstration...")
    
    # Generate 90 days of hourly data
    np.random.seed(42)
    hours = 90 * 24  # 90 days
    
    timestamps = pd.date_range(start='2024-01-01', periods=hours, freq='h')
    
    # Simulate realistic power consumption patterns
    base_load = 200  # Base load in watts
    hourly_pattern = np.array([0.6, 0.5, 0.5, 0.5, 0.5, 0.6,  # 00:00-05:59
                               0.8, 1.0, 1.2, 1.0, 0.9, 0.9,  # 06:00-11:59
                               1.0, 0.9, 0.8, 0.9, 1.0, 1.3,  # 12:00-17:59
                               1.5, 1.4, 1.2, 1.0, 0.8, 0.7]) # 18:00-23:59
    
    power = []
    for i in range(hours):
        hour_of_day = i % 24
        day_of_week = (i // 24) % 7
        
        # Base pattern
        p = base_load * hourly_pattern[hour_of_day]
        
        # Weekend adjustment (higher usage)
        if day_of_week >= 5:
            p *= 1.2
        
        # Random variation
        p += np.random.normal(0, 20)
        p = max(50, p)  # Minimum 50 watts
        
        power.append(p)
    
    df = pd.DataFrame({
        'timestamp': timestamps,
        'power': power
    })
    
    sample_path = 'sample_energy_data.csv'
    df.to_csv(sample_path, index=False)
    print(f"✅ Sample data saved to {sample_path}")
    print(f"   {len(df)} hourly readings over 90 days")
    
    return sample_path

def main():
    """Main training pipeline"""
    print("="*60)
    print("  LSTM Energy Forecasting Model Training")
    print("="*60)
    
    # Create models directory
    os.makedirs(MODEL_DIR, exist_ok=True)
    
    # Try to load data, or generate sample
    result = load_and_prepare_data(DATASET_PATH)
    
    if result is None:
        print("\n" + "-"*50)
        response = input("Would you like to generate sample data for testing? (y/n): ").strip().lower()
        if response == 'y':
            sample_path = generate_sample_data()
            result = load_and_prepare_data(sample_path)
        else:
            print("\nPlease provide your energy dataset and update DATASET_PATH in this script.")
            return
    
    df, power_col, time_col = result
    
    # Prepare hourly data
    if time_col:
        df['hour'] = df[time_col].dt.floor('h')
        hourly_df = df.groupby('hour')[power_col].mean().reset_index()
        hourly_data = hourly_df[power_col].values
    else:
        hourly_data = df[power_col].values
    
    print(f"\n📈 Hourly data points: {len(hourly_data)}")
    
    # Train hourly model
    if len(hourly_data) >= HOURLY_LOOK_BACK + 50:
        train_hourly_model(hourly_data)
    else:
        print(f"❌ Not enough data for hourly model. Need at least {HOURLY_LOOK_BACK + 50} hourly readings.")
    
    # Prepare daily data (aggregate hourly to daily)
    if time_col:
        df['date'] = df[time_col].dt.date
        # Convert watts to kWh for daily (assuming 1-hour intervals)
        daily_df = df.groupby('date')[power_col].sum().reset_index()
        daily_df[power_col] = daily_df[power_col] / 1000  # Watts to kWh
        daily_data = daily_df[power_col].values
    else:
        # Assume hourly data, aggregate every 24 points
        daily_data = np.array([hourly_data[i:i+24].sum() / 1000 
                              for i in range(0, len(hourly_data) - 23, 24)])
    
    print(f"📅 Daily data points: {len(daily_data)}")
    
    # Train daily model
    if len(daily_data) >= DAILY_LOOK_BACK + DAILY_FORECAST_STEPS + 10:
        train_daily_model(daily_data)
    else:
        print(f"❌ Not enough data for daily model. Need at least {DAILY_LOOK_BACK + DAILY_FORECAST_STEPS + 10} days of data.")
    
    print("\n" + "="*60)
    print("  Training Complete!")
    print("="*60)
    print("\nNext steps:")
    print("1. Run the API server: uvicorn forecast_api:app --reload --port 8001")
    print("2. Test predictions using the /predict/hour and /predict/daily endpoints")

if __name__ == "__main__":
    main()