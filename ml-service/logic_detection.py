import json
import itertools
import os

PROFILE_FILE = os.path.join(os.path.dirname(__file__), 'appliance_profiles.json')

def load_profiles():
    try:
        with open(PROFILE_FILE, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print("Error: Profile file not found. Run logic_training.py first.")
        return {}

def detect_phantom_sources(current_mains_reading: float, user_inventory: list):
    profiles = load_profiles()
    
    if not profiles:
        return {
            "input_reading_watts": current_mains_reading,
            "detected_appliances": [],
            "total_phantom_watts": 0,
            "error_margin": 0,
            "is_valid_detection": False
        }
    
    candidate_powers = []
    
    for item in user_inventory:
        app_type = item.get('type', item.get('name', ''))
        if app_type in profiles:
            p_val = profiles[app_type]['phantom_power_watts']
            if p_val > 0.5:
                candidate_powers.append((app_type, p_val))
    
    if not candidate_powers:
        return {
            "input_reading_watts": current_mains_reading,
            "detected_appliances": [],
            "total_phantom_watts": 0,
            "error_margin": current_mains_reading,
            "is_valid_detection": False
        }
    
    best_diff = float('inf')
    best_combination = []
    best_combo_details = []
    
    for r in range(1, len(candidate_powers) + 1):
        for combo in itertools.combinations(candidate_powers, r):
            current_sum = sum(device[1] for device in combo)
            diff = abs(current_mains_reading - current_sum)
            
            if diff < best_diff:
                best_diff = diff
                best_combination = [device[0] for device in combo]
                best_combo_details = list(combo)
    
    if best_diff == float('inf'):
        best_diff = current_mains_reading
    
    total_phantom = sum(p[1] for p in best_combo_details) if best_combo_details else 0
    
    error_percent = (best_diff / current_mains_reading * 100) if current_mains_reading > 0 else 100
    valid_detection = error_percent <= 30 and len(best_combination) > 0

    return {
        "input_reading_watts": current_mains_reading,
        "detected_appliances": best_combination,
        "total_phantom_watts": round(total_phantom, 2),
        "error_margin": round(best_diff, 2),
        "is_valid_detection": valid_detection
    }

if __name__ == "__main__":
    my_inventory = [
        {'type': 'Television', 'rated_watts': 150},
        {'type': 'Computer/PC', 'rated_watts': 500},
        {'type': 'Air Conditioner', 'rated_watts': 2000},
        {'type': 'Fridge', 'rated_watts': 150}
    ]
    meter_reading = 15.0
    
    print(f"Meter Reading: {meter_reading} W")
    print(f"Inventory: {[i['type'] for i in my_inventory]}")
    
    result = detect_phantom_sources(meter_reading, my_inventory)
    print(f"Result: {result}")
