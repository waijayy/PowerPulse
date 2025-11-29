# Phantom Data Configuration Guide

This guide shows you where to change phantom load values in your PowerPulse application.

## 📍 Main Configuration Files

### 1. `app/api/phantom/route.ts` (TypeScript - Next.js API Route)

This is the **main file** where most phantom data values are configured.

#### Base Load (Line 164)
```typescript
const baseLoad = 30 // Change this to adjust base household load (routers, modems, etc.)
```

#### Common Phantom Loads at Night (Lines 234-240)
```typescript
const commonPhantomLoads = [
  { power: 8, probability: 0.7 },   // TV on standby - power in watts, probability 0-1
  { power: 3, probability: 0.9 },   // Phone chargers
  { power: 5, probability: 0.6 },   // Gaming console standby
  { power: 2, probability: 0.8 },   // Router/modem
  { power: 4, probability: 0.5 },   // Microwave clock/display
]
```
**To change:** Modify the `power` (watts) or `probability` (0.0 to 1.0) values.

#### Phantom Power by Appliance Type (Lines 260-294)
```typescript
function getPhantomPowerForAppliance(name: string, watt: number): number {
  // TV example:
  if (nameLower.includes('tv') || nameLower.includes('television')) {
    return 8 + Math.random() * 4 // Returns 8-12W range
    // Change to: return 10 + Math.random() * 5 // for 10-15W range
  }
  
  // Computer example:
  if (nameLower.includes('computer') || nameLower.includes('pc')) {
    return 5 + Math.random() * 5 // Returns 5-10W range
  }
  
  // Default based on appliance size:
  if (watt > 500) {
    return 5 + Math.random() * 5 // 5-10W for large appliances
  } else if (watt > 100) {
    return 3 + Math.random() * 4 // 3-7W for medium appliances
  } else {
    return 2 + Math.random() * 3 // 2-5W for small appliances
  }
}
```

#### Phantom Probability by Appliance Type (Lines 299-330)
```typescript
function getPhantomProbabilityForAppliance(name: string): number {
  // TV example:
  if (nameLower.includes('tv') || nameLower.includes('television')) {
    return 0.85 // 85% chance of phantom load when off
    // Change to 0.9 for 90% chance, or 0.5 for 50% chance
  }
  
  // Charger example:
  if (nameLower.includes('charger') || nameLower.includes('phone')) {
    return 0.95 // 95% chance (almost always plugged in)
  }
  
  // Default:
  return 0.50 // 50% chance for unknown appliances
}
```

#### Night-Time Phantom Load Multiplier (Line 219)
```typescript
const phantomChance = isNightTime 
  ? appliance.phantomProbability * 1.5 // 50% more phantom load at night
  : appliance.phantomProbability
// Change 1.5 to 2.0 for 100% more, or 1.2 for 20% more
```

#### Detection Thresholds (Lines 423-424)
```typescript
const isVeryLowPower = power >= 5 && power <= 25  // Very likely phantom
const isLowPower = power >= 25 && power <= 60      // Likely some phantom
// Change these ranges to adjust what power levels are considered "phantom"
```

#### Detection Confidence Levels (Lines 428-436)
```typescript
if (isVeryLowPower) {
  probability = 0.80 + Math.random() * 0.15 // 80-95% confidence
} else if (isLowPower) {
  probability = 0.50 + Math.random() * 0.25 // 50-75% confidence
} else if (power > 60 && power < 100) {
  probability = 0.20 + Math.random() * 0.20 // 20-40% confidence
} else {
  probability = Math.random() * 0.10 // 0-10% confidence
}
// Adjust these ranges to change detection sensitivity
```

---

### 2. `phantom-api/sample_data.py` (Python - Sample Data Generator)

This file generates sample data for testing the Flask API.

#### Phantom Load Power Range (Line 41)
```python
power = np.random.uniform(5, 15)  # Phantom load range in watts
# Change to: np.random.uniform(3, 12) for 3-12W range
```

#### Phantom Load Probabilities by Time of Day

**Night (2 AM - 6 AM) - Line 40:**
```python
if np.random.random() < 0.7:  # 70% phantom load during night
  power = np.random.uniform(5, 15)
# Change 0.7 to 0.8 for 80% phantom load
```

**Daytime (6 AM - 6 PM) - Line 50:**
```python
if rand < 0.15:  # 15% phantom load during day
  power = np.random.uniform(5, 15)
# Change 0.15 to 0.25 for 25% phantom load
```

**Evening (6 PM - 10 PM) - Line 66:**
```python
if rand < 0.25:  # 25% phantom load in evening
  power = np.random.uniform(5, 15)
# Change 0.25 to 0.35 for 35% phantom load
```

**Late Night (10 PM - 2 AM) - Line 81:**
```python
if np.random.random() < 0.8:  # 80% phantom load late night
  power = np.random.uniform(5, 15)
# Change 0.8 to 0.9 for 90% phantom load
```

---

## 🔧 Quick Reference: Common Changes

### Increase Overall Phantom Load
1. **Increase base load** (route.ts line 164): `const baseLoad = 40`
2. **Increase night multiplier** (route.ts line 219): `* 1.8` instead of `* 1.5`
3. **Increase probabilities** in `getPhantomProbabilityForAppliance()` (route.ts lines 299-330)
4. **Add more common phantom loads** (route.ts lines 234-240)

### Decrease Overall Phantom Load
1. **Decrease base load** (route.ts line 164): `const baseLoad = 20`
2. **Decrease night multiplier** (route.ts line 219): `* 1.2` instead of `* 1.5`
3. **Decrease probabilities** in `getPhantomProbabilityForAppliance()`
4. **Remove or reduce common phantom loads**

### Change Phantom Power Ranges
- **Appliance-specific**: Modify `getPhantomPowerForAppliance()` (route.ts lines 260-294)
- **Common loads**: Modify `commonPhantomLoads` array (route.ts lines 234-240)
- **Sample data**: Modify `sample_data.py` line 41

### Change Detection Sensitivity
- **Lower thresholds** (route.ts lines 423-424): Make ranges smaller to detect less phantom
- **Higher thresholds**: Make ranges larger to detect more phantom
- **Confidence levels** (route.ts lines 428-436): Adjust probability ranges

---

## 📝 Example: Making TVs Have More Phantom Load

In `app/api/phantom/route.ts`:

```typescript
// Line 265 - Increase TV phantom power
if (nameLower.includes('tv') || nameLower.includes('television')) {
  return 12 + Math.random() * 6 // Changed from 8-12W to 12-18W
}

// Line 304 - Increase TV phantom probability
if (nameLower.includes('tv') || nameLower.includes('television')) {
  return 0.95 // Changed from 0.85 (85%) to 0.95 (95%)
}
```

---

## ⚠️ Important Notes

1. **After making changes**, restart your Next.js dev server: `npm run dev`
2. **For Python changes**, restart your Flask API: `python flask_api.py`
3. **Detection thresholds** affect how the algorithm classifies power readings as phantom vs active
4. **Probabilities** are values between 0.0 (0%) and 1.0 (100%)
5. **Power values** are in watts (W)

---

## 🧪 Testing Your Changes

1. Make your changes to the configuration
2. Restart the servers
3. Go to the Insights page in your app
4. Click "Re-analyze Now" to see updated phantom load percentages
5. Check the browser console for any errors

