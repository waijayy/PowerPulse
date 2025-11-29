from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import pandas as pd
from tensorflow.keras.models import load_model
import os
from sample_data import load_sample_data_from_csv, prepare_data_for_api, generate_sample_data

app = Flask(__name__)
CORS(app)  # Enable CORS for Next.js frontend

# Global model variable
model = None
SEGMENT_LENGTH = 50

def load_trained_model():
    """Load the pre-trained model on startup"""
    global model
    model_path = 'phantom_model.h5'
    if os.path.exists(model_path):
        model = load_model(model_path)
        print("Model loaded successfully")
    else:
        print("Warning: Model file not found. Train and save model first.")

def prepare_sequence(power_values, segment_length=50):
    """
    Prepare a single sequence or multiple sequences for prediction
    
    Args:
        power_values: List or array of power consumption values
        segment_length: Length of input sequence
    
    Returns:
        numpy array ready for model prediction
    """
    power_array = np.array(power_values)
    
    # If we have exactly segment_length values, predict for that sequence
    if len(power_array) == segment_length:
        X = power_array.reshape(1, segment_length, 1)
        return X
    
    # If we have more, create sliding windows
    elif len(power_array) > segment_length:
        X = []
        for i in range(len(power_array) - segment_length + 1):
            X.append(power_array[i:(i + segment_length)])
        return np.array(X).reshape(len(X), segment_length, 1)
    
    else:
        raise ValueError(f"Need at least {segment_length} data points")

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None
    })

@app.route('/sample_data', methods=['GET'])
def get_sample_data():
    """
    Get sample data with phantom loads for testing/demo
    
    Query parameters:
        - num_readings: Number of readings to generate (default: 200)
        - include_phantom: Whether to include phantom loads (default: true)
        - use_file: Use existing sample_data.csv if available (default: true)
    
    Returns:
    {
        "power_values": [float, ...],
        "timestamps": ["2024-01-01 00:00:00", ...],
        "labels": [0, 1, ...],  // Ground truth labels (1=phantom, 0=active)
        "metadata": {
            "total_readings": int,
            "phantom_count": int,
            "phantom_percentage": float,
            "average_power": float
        }
    }
    """
    try:
        use_file = request.args.get('use_file', 'true').lower() == 'true'
        num_readings = int(request.args.get('num_readings', 200))
        include_phantom = request.args.get('include_phantom', 'true').lower() == 'true'
        
        # Try to load from file first if it exists
        if use_file and os.path.exists('sample_data.csv'):
            df = load_sample_data_from_csv('sample_data.csv')
        else:
            # Generate new data
            df = generate_sample_data(num_readings=num_readings, include_phantom=include_phantom)
        
        # Prepare response
        api_data = prepare_data_for_api(df)
        
        # Calculate metadata
        phantom_count = int(df['label'].sum())
        phantom_percentage = (phantom_count / len(df)) * 100
        
        return jsonify({
            'power_values': api_data['power_values'],
            'timestamps': api_data['timestamps'],
            'labels': df['label'].tolist(),
            'metadata': {
                'total_readings': len(df),
                'phantom_count': phantom_count,
                'phantom_percentage': round(phantom_percentage, 2),
                'average_power': round(df['power'].mean(), 2),
                'min_power': round(df['power'].min(), 2),
                'max_power': round(df['power'].max(), 2),
                'date_range': {
                    'start': df['timestamp'].min().isoformat(),
                    'end': df['timestamp'].max().isoformat()
                }
            }
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/predict', methods=['POST'])
def predict_phantom_load():
    """
    Predict phantom load from power consumption data
    
    Expected JSON body:
    {
        "power_values": [float, float, ...],  // Array of power readings
        "threshold": 0.5  // Optional, default 0.5
    }
    
    Returns:
    {
        "predictions": [0, 1, 0, ...],  // Binary predictions
        "probabilities": [0.23, 0.87, ...],  // Probability scores
        "phantom_detected": boolean,  // Overall detection flag
        "phantom_percentage": float  // % of readings classified as phantom
    }
    """
    try:
        if model is None:
            return jsonify({'error': 'Model not loaded'}), 500
        
        data = request.json
        power_values = data.get('power_values', [])
        threshold = data.get('threshold', 0.5)
        
        if not power_values:
            return jsonify({'error': 'No power values provided'}), 400
        
        if len(power_values) < SEGMENT_LENGTH:
            return jsonify({
                'error': f'Need at least {SEGMENT_LENGTH} data points for prediction'
            }), 400
        
        # Prepare sequences
        X = prepare_sequence(power_values, SEGMENT_LENGTH)
        
        # Make predictions
        predictions_proba = model.predict(X, verbose=0)
        predictions_binary = (predictions_proba > threshold).astype(int).flatten()
        
        # Calculate statistics
        phantom_count = np.sum(predictions_binary)
        total_predictions = len(predictions_binary)
        phantom_percentage = (phantom_count / total_predictions) * 100
        
        return jsonify({
            'predictions': predictions_binary.tolist(),
            'probabilities': predictions_proba.flatten().tolist(),
            'phantom_detected': bool(phantom_count > 0),
            'phantom_percentage': round(phantom_percentage, 2),
            'total_readings': total_predictions,
            'phantom_count': int(phantom_count)
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/analyze_appliance', methods=['POST'])
def analyze_appliance():
    """
    Analyze appliance data and return detailed insights
    
    Expected JSON body:
    {
        "appliance_name": "TV",
        "power_values": [float, ...],
        "timestamps": ["2024-01-01 00:00", ...]  // Optional
    }
    """
    try:
        if model is None:
            return jsonify({'error': 'Model not loaded'}), 500
        
        data = request.json
        appliance_name = data.get('appliance_name', 'Unknown Appliance')
        power_values = data.get('power_values', [])
        
        if len(power_values) < SEGMENT_LENGTH:
            return jsonify({
                'error': f'Need at least {SEGMENT_LENGTH} data points'
            }), 400
        
        # Prepare and predict
        X = prepare_sequence(power_values, SEGMENT_LENGTH)
        predictions_proba = model.predict(X, verbose=0)
        predictions_binary = (predictions_proba > 0.5).astype(int).flatten()
        
        # Calculate energy waste
        power_array = np.array(power_values)
        phantom_indices = np.where(predictions_binary == 1)[0]
        
        if len(phantom_indices) > 0:
            # Map predictions back to original power values
            # Account for the sliding window offset
            estimated_phantom_power = []
            for idx in phantom_indices:
                # Get the corresponding power value
                power_idx = idx + SEGMENT_LENGTH // 2
                if power_idx < len(power_values):
                    estimated_phantom_power.append(power_values[power_idx])
            
            avg_phantom_power = np.mean(estimated_phantom_power) if estimated_phantom_power else 0
            total_phantom_energy = avg_phantom_power * len(phantom_indices) / 60  # Wh (assuming minutes)
        else:
            avg_phantom_power = 0
            total_phantom_energy = 0
        
        return jsonify({
            'appliance_name': appliance_name,
            'phantom_detected': bool(len(phantom_indices) > 0),
            'phantom_percentage': round((len(phantom_indices) / len(predictions_binary)) * 100, 2),
            'average_phantom_power_w': round(avg_phantom_power, 2),
            'estimated_phantom_energy_wh': round(total_phantom_energy, 2),
            'total_readings_analyzed': len(predictions_binary),
            'recommendations': get_recommendations(len(phantom_indices), len(predictions_binary))
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def get_recommendations(phantom_count, total_count):
    """Generate recommendations based on phantom load detection"""
    phantom_percentage = (phantom_count / total_count) * 100
    
    if phantom_percentage > 50:
        return [
            "High phantom load detected! Consider using a smart plug with scheduling.",
            "This appliance may be drawing significant standby power.",
            "Unplug when not in use or use a power strip with an off switch."
        ]
    elif phantom_percentage > 20:
        return [
            "Moderate phantom load detected.",
            "Consider using a timer or smart plug to reduce standby power.",
            "Check if the appliance has an eco mode or power-saving settings."
        ]
    elif phantom_count > 0:
        return [
            "Low phantom load detected.",
            "Standby power is minimal but could still be optimized.",
            "Consider grouping appliances on a single controllable power strip."
        ]
    else:
        return [
            "No significant phantom load detected.",
            "This appliance appears to be energy efficient in standby mode."
        ]

if __name__ == '__main__':
    load_trained_model()
    app.run(host='0.0.0.0', port=5000, debug=True)