import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
import json
import os

DATASET_PATH = os.path.join(os.path.dirname(__file__), '..', 'House_4.csv')

APPLIANCE_MAPPING = {
    'Fridge': 'Appliance1',
    'Washing Machine': 'Appliance4',
    'Computer/PC': 'Appliance6',
    'Television': 'Appliance7',
    'Microwave': 'Appliance8',
    'Air Conditioner': 'Appliance5',
    'Ceiling Fan': 'Appliance2',
}

# Appliances that run 24/7 (always on)
ALWAYS_ON_APPLIANCES = {
    'Fridge',
    'Refrigerator',
}

def train_appliance_models():
    print("Loading dataset...")
    df = pd.read_csv(DATASET_PATH, nrows=100000)
    
    profiles = {}

    for user_label, csv_column in APPLIANCE_MAPPING.items():
        if csv_column not in df.columns:
            print(f"Warning: Column {csv_column} not found. Skipping {user_label}.")
            continue
            
        print(f"Training profile for: {user_label} (Source: {csv_column})...")
        
        X = df[csv_column].dropna().values.reshape(-1, 1)
        
        try:
            kmeans = KMeans(n_clusters=3, random_state=42, n_init=10).fit(X)
            centers = sorted(kmeans.cluster_centers_.flatten())
            
            off_power = centers[0]
            standby_power = centers[1]
            active_power = centers[2]
            
            phantom_power = standby_power - off_power
            if phantom_power < 0 or phantom_power > 50:
                phantom_power = max(1.0, off_power * 0.5)
            
            active_threshold = (standby_power + active_power) / 2
            
            if active_threshold < 5:
                active_threshold = 5.0

            profiles[user_label] = {
                'phantom_power_watts': round(float(phantom_power), 2),
                'active_threshold_watts': round(float(active_threshold), 2),
                'always_on': user_label in ALWAYS_ON_APPLIANCES
            }
            
        except Exception as e:
            print(f"Error training {user_label}: {e}")
            profiles[user_label] = {
                'phantom_power_watts': 1.0, 
                'active_threshold_watts': 10.0,
                'always_on': user_label in ALWAYS_ON_APPLIANCES
            }

    # Add Refrigerator as alias for Fridge (same profile)
    if 'Fridge' in profiles:
        profiles['Refrigerator'] = {
            **profiles['Fridge'],
            'always_on': True
        }

    profiles['LED Lights'] = {
        'phantom_power_watts': 0.0, 
        'active_threshold_watts': 5.0,
        'always_on': False
    }

    output_path = os.path.join(os.path.dirname(__file__), 'appliance_profiles.json')
    with open(output_path, 'w') as f:
        json.dump(profiles, f, indent=4)
    
    print(f"Training complete. Profiles saved to {output_path}")
    return profiles

if __name__ == "__main__":
    train_appliance_models()

