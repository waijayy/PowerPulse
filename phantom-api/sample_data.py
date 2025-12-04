"""
Sample data generator and loader for phantom load detection

This module provides sample data with phantom loads that can be used
to test the phantom detector and display in the webapp.
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import json

def generate_sample_data(num_readings=200, include_phantom=True):
    """
    Generate sample power consumption data with phantom loads
    
    Args:
        num_readings: Number of power readings to generate (default: 200)
        include_phantom: Whether to include phantom load periods (default: True)
    
    Returns:
        pandas DataFrame with columns: timestamp, power, label
    """
    # Create timestamps (1 minute intervals)
    start_time = datetime.now() - timedelta(minutes=num_readings)
    timestamps = pd.date_range(start=start_time, periods=num_readings, freq='1min')
    
    power_values = []
    labels = []
    
    # Simulate realistic appliance behavior
    for i in range(num_readings):
        # Create patterns: some periods of active use, some phantom loads
        time_of_day = timestamps[i].hour
        
        # Simulate different scenarios
        if include_phantom:
            # Morning: some phantom load (standby devices)
            if 2 <= time_of_day < 6:
                if np.random.random() < 0.7:  # 70% phantom load during night
                    power = np.random.uniform(5, 15)  # Phantom load range
                    label = 1
                else:
                    power = np.random.uniform(20, 50)  # Low active
                    label = 0
            
            # Daytime: active usage with occasional phantom
            elif 6 <= time_of_day < 18:
                rand = np.random.random()
                if rand < 0.15:  # 15% phantom load
                    power = np.random.uniform(5, 15)
                    label = 1
                elif rand < 0.4:  # 25% low usage
                    power = np.random.uniform(20, 50)
                    label = 0
                elif rand < 0.7:  # 30% medium usage
                    power = np.random.uniform(50, 150)
                    label = 0
                else:  # 30% high usage
                    power = np.random.uniform(150, 300)
                    label = 0
            
            # Evening: mix of active and phantom
            elif 18 <= time_of_day < 22:
                rand = np.random.random()
                if rand < 0.25:  # 25% phantom load
                    power = np.random.uniform(5, 15)
                    label = 1
                elif rand < 0.5:  # 25% low usage
                    power = np.random.uniform(20, 50)
                    label = 0
                elif rand < 0.8:  # 30% medium usage
                    power = np.random.uniform(50, 150)
                    label = 0
                else:  # 20% high usage
                    power = np.random.uniform(150, 300)
                    label = 0
            
            # Late night: mostly phantom loads
            else:  # 22-2
                if np.random.random() < 0.8:  # 80% phantom load
                    power = np.random.uniform(5, 15)
                    label = 1
                else:
                    power = np.random.uniform(20, 50)
                    label = 0
        else:
            # No phantom loads - all active usage
            rand = np.random.random()
            if rand < 0.3:
                power = np.random.uniform(20, 50)
            elif rand < 0.6:
                power = np.random.uniform(50, 150)
            else:
                power = np.random.uniform(150, 300)
            label = 0
        
        power_values.append(round(power, 2))
        labels.append(label)
    
    df = pd.DataFrame({
        'timestamp': timestamps,
        'power': power_values,
        'label': labels
    })
    
    return df

def save_sample_data_to_csv(filename='sample_data.csv', num_readings=200, include_phantom=True):
    """
    Generate and save sample data to CSV file
    
    Args:
        filename: Output CSV filename
        num_readings: Number of readings to generate
        include_phantom: Whether to include phantom loads
    """
    df = generate_sample_data(num_readings, include_phantom)
    df.to_csv(filename, index=False)
    
    phantom_count = df['label'].sum()
    phantom_percentage = (phantom_count / len(df)) * 100
    
    print(f"✓ Sample data saved to '{filename}'")
    print(f"  Total readings: {len(df)}")
    print(f"  Phantom load readings: {phantom_count} ({phantom_percentage:.1f}%)")
    print(f"  Active usage readings: {len(df) - phantom_count} ({100-phantom_percentage:.1f}%)")
    print(f"  Date range: {df['timestamp'].min()} to {df['timestamp'].max()}")
    
    return df

def load_sample_data_from_csv(filename='sample_data.csv'):
    """
    Load sample data from CSV file
    
    Args:
        filename: CSV filename to load
    
    Returns:
        pandas DataFrame with columns: timestamp, power, label
    """
    df = pd.read_csv(filename)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    return df

def prepare_data_for_api(df):
    """
    Prepare sample data for sending to Flask API
    
    Args:
        df: DataFrame with timestamp and power columns
    
    Returns:
        dict: Formatted data ready for API requests
    """
    return {
        'power_values': df['power'].tolist(),
        'timestamps': df['timestamp'].dt.strftime('%Y-%m-%d %H:%M:%S').tolist()
    }

def get_sample_data_json(filename='sample_data.csv'):
    """
    Load sample data and return as JSON for API
    
    Args:
        filename: CSV filename to load
    
    Returns:
        dict: JSON-ready data with power_values and timestamps
    """
    df = load_sample_data_from_csv(filename)
    return prepare_data_for_api(df)

# Example usage
if __name__ == '__main__':
    print("=" * 70)
    print(" 📊 GENERATING SAMPLE DATA WITH PHANTOM LOADS")
    print("=" * 70)
    
    # Generate and save sample data
    df = save_sample_data_to_csv('sample_data.csv', num_readings=200, include_phantom=True)
    
    # Show preview
    print("\n📋 Data Preview:")
    print(df.head(10).to_string())
    
    print("\n📊 Statistics:")
    print(f"  Average power: {df['power'].mean():.2f} W")
    print(f"  Min power: {df['power'].min():.2f} W")
    print(f"  Max power: {df['power'].max():.2f} W")
    print(f"  Phantom load average: {df[df['label']==1]['power'].mean():.2f} W" if df['label'].sum() > 0 else "  No phantom loads")
    
    # Prepare for API
    api_data = prepare_data_for_api(df)
    print("\n✅ Data ready for API!")
    print(f"  Power values: {len(api_data['power_values'])} readings")
    print(f"  Timestamps: {len(api_data['timestamps'])} entries")
    
    # Save JSON version for easy API testing
    with open('sample_data.json', 'w') as f:
        json.dump(api_data, f, indent=2)
    print("\n💾 Also saved as 'sample_data.json' for API testing")




