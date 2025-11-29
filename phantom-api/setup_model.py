# setup_model.py
"""
Setup script to train and save your phantom load detection model
Run this once before starting the Flask API

Usage:
    python setup_model.py
"""

import numpy as np
import pandas as pd
import sys
import os

# Import your phantom detector functions
try:
    from phantom_detector import train_and_evaluate_model, build_cnn_model
    print("✓ Successfully imported phantom_detector module")
except ImportError as e:
    print("✗ Error: Could not import phantom_detector.py")
    print("  Make sure phantom_detector.py is in the same folder as this script")
    sys.exit(1)

def generate_training_data(num_samples=5000):
    """
    Generate synthetic training data for demonstration
    
    This simulates realistic appliance behavior:
    - Phantom loads: 5-15W (devices in standby)
    - Low active usage: 20-50W (LED lights, chargers)
    - Medium usage: 50-150W (laptops, monitors)
    - High usage: 150-300W (appliances in full use)
    
    Args:
        num_samples: Number of power readings to generate
    
    Returns:
        power_series: Pandas Series with power consumption values
        label_series: Pandas Series with binary labels (1=phantom, 0=active)
    """
    print(f"\n📊 Generating {num_samples} training samples...")
    
    datetime_index = pd.date_range(
        start='2023-01-01 00:00:00', 
        periods=num_samples, 
        freq='1min'
    )
    
    power_values = []
    labels = []
    
    for i in range(num_samples):
        rand = np.random.random()
        
        if rand < 0.2:  # 20% phantom load (standby power)
            power = np.random.uniform(5, 15)
            label = 1
        elif rand < 0.5:  # 30% low active usage
            power = np.random.uniform(20, 50)
            label = 0
        elif rand < 0.8:  # 30% medium usage
            power = np.random.uniform(50, 150)
            label = 0
        else:  # 20% high usage
            power = np.random.uniform(150, 300)
            label = 0
        
        power_values.append(power)
        labels.append(label)
    
    power_series = pd.Series(power_values, index=datetime_index, name='power')
    label_series = pd.Series(labels, index=datetime_index, name='labels')
    
    phantom_count = sum(labels)
    phantom_percentage = (phantom_count / len(labels)) * 100
    
    print(f"  ✓ Generated {num_samples:,} samples")
    print(f"  ✓ Phantom load samples: {phantom_count:,} ({phantom_percentage:.1f}%)")
    print(f"  ✓ Active usage samples: {len(labels) - phantom_count:,} ({100-phantom_percentage:.1f}%)")
    
    return power_series, label_series

def load_real_data(file_path, power_column, label_column):
    """
    Load real training data from CSV file
    
    Args:
        file_path: Path to CSV file
        power_column: Name of column containing power values
        label_column: Name of column containing labels (0 or 1)
    
    Returns:
        power_series: Pandas Series with power consumption values
        label_series: Pandas Series with binary labels
    """
    print(f"\n📁 Loading data from {file_path}...")
    
    try:
        df = pd.read_csv(file_path)
        print(f"  ✓ Loaded {len(df):,} rows")
        
        # Check if columns exist
        if power_column not in df.columns:
            raise ValueError(f"Column '{power_column}' not found. Available: {list(df.columns)}")
        if label_column not in df.columns:
            raise ValueError(f"Column '{label_column}' not found. Available: {list(df.columns)}")
        
        power_series = df[power_column]
        label_series = df[label_column]
        
        phantom_count = sum(label_series)
        phantom_percentage = (phantom_count / len(label_series)) * 100
        
        print(f"  ✓ Power column: '{power_column}'")
        print(f"  ✓ Label column: '{label_column}'")
        print(f"  ✓ Phantom load samples: {phantom_count:,} ({phantom_percentage:.1f}%)")
        print(f"  ✓ Active usage samples: {len(label_series) - phantom_count:,} ({100-phantom_percentage:.1f}%)")
        
        return power_series, label_series
        
    except FileNotFoundError:
        print(f"  ✗ Error: File '{file_path}' not found")
        sys.exit(1)
    except Exception as e:
        print(f"  ✗ Error loading data: {e}")
        sys.exit(1)

def main():
    """Main setup function"""
    print("=" * 70)
    print(" 🔌 PHANTOM LOAD DETECTION MODEL SETUP")
    print("=" * 70)
    
    # Configuration
    USE_REAL_DATA = False  # Set to True if you have real data
    
    # If using real data, configure these:
    DATA_FILE = 'your_data.csv'
    POWER_COLUMN = 'power'
    LABEL_COLUMN = 'labels'
    
    # Training parameters
    SEGMENT_LENGTH = 50
    EPOCHS = 20
    BATCH_SIZE = 32
    MODEL_OUTPUT_PATH = 'phantom_model.h5'
    
    # Load or generate data
    if USE_REAL_DATA:
        power_series, label_series = load_real_data(
            DATA_FILE, 
            POWER_COLUMN, 
            LABEL_COLUMN
        )
    else:
        print("\n💡 Using synthetic data (set USE_REAL_DATA=True to use your own data)")
        power_series, label_series = generate_training_data(num_samples=5000)
    
    # Train the model
    print("\n" + "=" * 70)
    print(" 🧠 TRAINING MODEL")
    print("=" * 70)
    print(f"  Segment length: {SEGMENT_LENGTH}")
    print(f"  Epochs: {EPOCHS}")
    print(f"  Batch size: {BATCH_SIZE}")
    print()
    
    try:
        trained_model, eval_results = train_and_evaluate_model(
            power_series=power_series,
            phantom_labels=label_series,
            segment_length=SEGMENT_LENGTH,
            epochs=EPOCHS,
            batch_size=BATCH_SIZE
        )
    except Exception as e:
        print(f"\n✗ Training failed: {e}")
        sys.exit(1)
    
    # Save the model
    print(f"\n💾 Saving model to '{MODEL_OUTPUT_PATH}'...")
    try:
        trained_model.save(MODEL_OUTPUT_PATH)
        file_size = os.path.getsize(MODEL_OUTPUT_PATH) / 1024  # KB
        print(f"  ✓ Model saved successfully ({file_size:.1f} KB)")
    except Exception as e:
        print(f"  ✗ Error saving model: {e}")
        sys.exit(1)
    
    # Print summary
    print("\n" + "=" * 70)
    print(" ✅ TRAINING COMPLETE!")
    print("=" * 70)
    print(f"  📊 Test Accuracy: {eval_results['accuracy']:.2%}")
    print(f"  📁 Model saved: {MODEL_OUTPUT_PATH}")
    print(f"  📏 Input shape: ({SEGMENT_LENGTH}, 1)")
    print()
    print("  Next steps:")
    print("  1. Install Flask: pip install flask flask-cors")
    print("  2. Start API server: python flask_api.py")
    print("  3. Configure Next.js: NEXT_PUBLIC_API_URL=http://localhost:5000")
    print("  4. Run your Next.js app: npm run dev")
    print()
    print("=" * 70)
    print("\n🎉 Setup complete! You're ready to detect phantom loads!")

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Setup interrupted by user")
        sys.exit(0)
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)