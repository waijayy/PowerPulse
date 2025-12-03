import pandas as pd
import json
import os

DATASET_PATH = os.path.join(os.path.dirname(__file__), '..', 'House_4.csv')
PROFILE_FILE = os.path.join(os.path.dirname(__file__), 'appliance_profiles.json')

PEAK_START_HOUR = 8
PEAK_END_HOUR = 22
SAMPLE_INTERVAL_SECONDS = 8

APPLIANCE_MAPPING = {
    'Fridge': 'Appliance1',
    'Washing Machine': 'Appliance4',
    'Computer/PC': 'Appliance6',
    'Television': 'Appliance7',
    'Microwave': 'Appliance8',
    'Air Conditioner': 'Appliance5',
    'Ceiling Fan': 'Appliance2',
}

def load_profiles():
    try:
        with open(PROFILE_FILE, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

def generate_usage_report(user_inventory: list = None):
    print("Loading data for analytics...")
    df = pd.read_csv(DATASET_PATH, nrows=500000)
    
    df['Time'] = pd.to_datetime(df['Time'], format='mixed', dayfirst=True)
    df['Hour'] = df['Time'].dt.hour
    
    profiles = load_profiles()
    report = {}

    appliances_to_analyze = APPLIANCE_MAPPING.keys()
    if user_inventory:
        appliances_to_analyze = [item.get('type', item.get('name', '')) for item in user_inventory]

    for user_label in appliances_to_analyze:
        csv_column = APPLIANCE_MAPPING.get(user_label)
        if not csv_column or csv_column not in df.columns:
            continue
        if user_label not in profiles:
            continue
            
        phantom_power = profiles[user_label]['phantom_power_watts']
        active_thresh = profiles[user_label]['active_threshold_watts']
        
        off_rows = df[df[csv_column] <= 0.5]
        active_rows = df[df[csv_column] > active_thresh]
        phantom_rows = df[(df[csv_column] > 0.5) & (df[csv_column] <= active_thresh)]

        total_off_hours = len(off_rows) * SAMPLE_INTERVAL_SECONDS / 3600
        total_active_hours = len(active_rows) * SAMPLE_INTERVAL_SECONDS / 3600
        total_phantom_hours = len(phantom_rows) * SAMPLE_INTERVAL_SECONDS / 3600
        
        peak_rows = active_rows[(active_rows['Hour'] >= PEAK_START_HOUR) & (active_rows['Hour'] < PEAK_END_HOUR)]
        off_peak_rows = active_rows[(active_rows['Hour'] < PEAK_START_HOUR) | (active_rows['Hour'] >= PEAK_END_HOUR)]
        
        peak_hours = len(peak_rows) * SAMPLE_INTERVAL_SECONDS / 3600
        off_peak_hours = len(off_peak_rows) * SAMPLE_INTERVAL_SECONDS / 3600

        avg_power = df[df[csv_column] > 0][csv_column].mean() if len(df[df[csv_column] > 0]) > 0 else 0
        max_power = df[csv_column].max()
        
        wasted_kwh = (total_phantom_hours * phantom_power) / 1000

        report[user_label] = {
            "total_active_hours": round(total_active_hours, 2),
            "peak_hours": round(peak_hours, 2),
            "off_peak_hours": round(off_peak_hours, 2),
            "phantom_load_hours": round(total_phantom_hours, 2),
            "avg_power_watts": round(float(avg_power), 2),
            "max_power_watts": round(float(max_power), 2),
            "phantom_power_watts": round(phantom_power, 2),
            "wasted_kwh": round(wasted_kwh, 3)
        }

    total_active = sum(r['total_active_hours'] for r in report.values())
    total_phantom = sum(r['phantom_load_hours'] for r in report.values())
    total_wasted_kwh = sum(r['wasted_kwh'] for r in report.values())
    
    total_active_kwh = sum(r['total_active_hours'] * r['avg_power_watts'] / 1000 for r in report.values())
    total_energy = total_active_kwh + total_wasted_kwh if (total_active_kwh + total_wasted_kwh) > 0 else 1

    summary = {
        "appliances": report,
        "summary": {
            "total_active_hours": round(total_active, 2),
            "total_phantom_hours": round(total_phantom, 2),
            "total_wasted_kwh": round(total_wasted_kwh, 3),
            "active_usage_percent": round((total_active_kwh / total_energy) * 100, 1),
            "phantom_usage_percent": round((total_wasted_kwh / total_energy) * 100, 1)
        }
    }

    return summary


def calculate_ml_patterns_from_data():
    """Learn usage patterns from REFIT data (when appliances are used)"""
    df = pd.read_csv(DATASET_PATH, nrows=500000)
    df['Time'] = pd.to_datetime(df['Time'], format='mixed', dayfirst=True)
    df['Hour'] = df['Time'].dt.hour
    
    total_time_hours = len(df) * SAMPLE_INTERVAL_SECONDS / 3600
    
    min_active_thresholds = {
        'Fridge': 20,
        'Washing Machine': 50,
        'Computer/PC': 10,
        'Television': 20,
        'Microwave': 100,
        'Air Conditioner': 100,
        'Ceiling Fan': 10,
    }
    
    patterns = {}
    for app_name, col_name in APPLIANCE_MAPPING.items():
        if col_name not in df.columns:
            continue
            
        threshold = min_active_thresholds.get(app_name, 10)
        active_df = df[df[col_name] > threshold]
        active_rows = len(active_df)
        active_hours = active_rows * SAMPLE_INTERVAL_SECONDS / 3600
        
        ml_factor = active_hours / total_time_hours if total_time_hours > 0 else 0
        ml_factor = min(ml_factor, 1.0)
        
        peak_active = len(active_df[(active_df['Hour'] >= 12) & (active_df['Hour'] <= 18)])
        peak_ratio = peak_active / active_rows if active_rows > 0 else 0.5
        
        avg_power = active_df[col_name].mean() if len(active_df) > 0 else 0
        
        patterns[app_name] = {
            'ml_factor': round(ml_factor, 4),
            'peak_ratio': round(peak_ratio, 3),
            'avg_power': round(float(avg_power), 1)
        }
    
    return patterns


CLIMATE_ADJUSTMENTS = {
    'Air Conditioner': {
        'malaysia_factor': 0.35,
        'reason': 'Tropical climate - AC used ~8h/day average'
    },
    'Ceiling Fan': {
        'malaysia_factor': 0.50,
        'reason': 'Tropical climate - fans used frequently'
    },
    'Fridge': {
        'malaysia_factor': 0.95,
        'reason': 'Runs continuously in hot climate'
    },
    'Refrigerator': {
        'malaysia_factor': 0.95,
        'reason': 'Runs continuously in hot climate'
    },
}

TYPICAL_USAGE_HOURS = {
    'Air Conditioner': 8.0,
    'Ceiling Fan': 12.0,
    'Television': 6.0,
    'Computer/PC': 6.0,
    'Fridge': 24.0,
    'Refrigerator': 24.0,
    'Washing Machine': 1.0,
    'Microwave': 0.5,
    'LED Lights': 6.0,
    'Water Heater': 2.0,
    'Rice Cooker': 1.0,
}


_cached_ml_patterns = None

def get_hybrid_usage_factor(app_type: str, rated_watts: float = None) -> dict:
    """
    Hybrid approach combining:
    1. ML patterns from REFIT data
    2. Climate adjustments for Malaysia
    3. Physics-based calculations
    """
    global _cached_ml_patterns
    
    if _cached_ml_patterns is None:
        try:
            _cached_ml_patterns = calculate_ml_patterns_from_data()
            print(f"Learned ML patterns from REFIT: {_cached_ml_patterns}")
        except Exception as e:
            print(f"Failed to calculate ML patterns: {e}")
            _cached_ml_patterns = {}
    
    ml_pattern = _cached_ml_patterns.get(app_type, {})
    ml_factor = ml_pattern.get('ml_factor', 0.2)
    
    climate_adj = CLIMATE_ADJUSTMENTS.get(app_type, {})
    climate_factor = climate_adj.get('malaysia_factor', None)
    
    typical_hours = TYPICAL_USAGE_HOURS.get(app_type, 4.0)
    physics_factor = typical_hours / 24.0
    
    if climate_factor is not None:
        final_factor = climate_factor * 0.6 + ml_factor * 0.2 + physics_factor * 0.2
        source = 'climate_adjusted'
    elif ml_factor > 0.01:
        final_factor = ml_factor * 0.7 + physics_factor * 0.3
        source = 'ml_dominant'
    else:
        final_factor = physics_factor
        source = 'physics_only'
    
    final_factor = max(0.01, min(final_factor, 1.0))
    
    return {
        'final_factor': round(final_factor, 4),
        'ml_factor': round(ml_factor, 4),
        'climate_factor': climate_factor,
        'physics_factor': round(physics_factor, 4),
        'source': source,
        'usage_hours_day': round(final_factor * 24, 1)
    }


def disaggregate_energy(total_kwh: float, user_appliances: list):
    """
    Hybrid energy disaggregation combining:
    - ML patterns (learned from REFIT data)
    - Climate adjustments (for Malaysia tropical climate)
    - Physics calculations (rated watts)
    """
    appliance_estimates = []
    total_weighted_power = 0
    
    for appliance in user_appliances:
        app_type = appliance.get('type', appliance.get('name', ''))
        quantity = appliance.get('quantity', 1)
        rated_watts = appliance.get('rated_watts', appliance.get('watt', 0))
        
        hybrid = get_hybrid_usage_factor(app_type, rated_watts)
        usage_factor = hybrid['final_factor']
        effective_power = rated_watts * quantity * usage_factor
        
        appliance_estimates.append({
            "type": app_type,
            "quantity": quantity,
            "rated_watts": rated_watts,
            "usage_factor": usage_factor,
            "effective_power": effective_power,
            "factor_details": hybrid
        })
        total_weighted_power += effective_power
    
    if total_weighted_power == 0:
        total_weighted_power = 1
    
    result = []
    for est in appliance_estimates:
        share_percent = (est['effective_power'] / total_weighted_power) * 100
        estimated_kwh = total_kwh * (share_percent / 100)
        
        result.append({
            "type": est['type'],
            "quantity": est['quantity'],
            "rated_watts": est['rated_watts'],
            "usage_hours_per_day": est['factor_details']['usage_hours_day'],
            "share_percent": round(share_percent, 1),
            "estimated_kwh": round(estimated_kwh, 2),
            "estimated_cost_rm": round(estimated_kwh * 0.218, 2),
            "calculation_method": est['factor_details']['source'],
            "factor_breakdown": {
                "ml_learned": est['factor_details']['ml_factor'],
                "climate_adjusted": est['factor_details']['climate_factor'],
                "physics_based": est['factor_details']['physics_factor']
            }
        })
    
    result.sort(key=lambda x: x['estimated_kwh'], reverse=True)
    
    return {
        "total_kwh": total_kwh,
        "breakdown": result,
        "summary": {
            "top_consumer": result[0]['type'] if result else None,
            "top_consumer_percent": result[0]['share_percent'] if result else 0,
            "appliance_count": len(result)
        },
        "methodology": "Hybrid model combining ML patterns from REFIT data + Malaysia climate adjustments + physics calculations"
    }


if __name__ == "__main__":
    stats = generate_usage_report()
    print(json.dumps(stats, indent=4))
