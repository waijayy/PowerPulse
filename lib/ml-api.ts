const ML_API_URL = process.env.NEXT_PUBLIC_ML_API_URL || "http://127.0.0.1:8000";
const FORECAST_API_URL = process.env.NEXT_PUBLIC_FORECAST_API_URL || "http://127.0.0.1:8000/forecast";

// --- Forecast API Types ---

export type ApplianceData = {
  id: number;
  name: string;
  quantity: number;
  watt: number;
  peak_usage_hours: number;
  off_peak_usage_hours: number;
  monthly_cost: number;
};

export type PlanItem = {
  name: string;
  current_hours: string;
  planned_hours: string;
  planned_peak_hours?: number;
  planned_off_peak_hours?: number;
  planned_peak_hours_weekday?: number;
  planned_off_peak_hours_weekday?: number;
  planned_peak_hours_weekend?: number;
  planned_offpeak_hours_weekend?: number;
  suggested_time_weekday?: string;
  suggested_time_weekend?: string;
  monthly_savings: number;
  change: string;
};

export type Plan = {
  plan: PlanItem[];
  projected_bill: number;
  total_savings: number;
  explanation: string;
};

export interface HourlyPredictionResult {
  success: boolean;
  type: "next_hour";
  predicted_usage_watts: number;
  unit: string;
  input_hours: number;
}

export interface WeeklyPredictionResult {
  success: boolean;
  type: "next_week" | "next_day";
  total_usage_kwh?: number;
  predicted_usage_kwh?: number;
  daily_breakdown_kwh?: number[];
  unit: string;
  input_days: number;
}

export interface ApplianceItem {
  type: string;
  rated_watts?: number;
  quantity?: number;
}

export interface PhantomDetectionResult {
  input_reading_watts: number;
  detected_appliances: string[];
  total_phantom_watts: number;
  error_margin: number;
  is_valid_detection: boolean;
}

export interface ApplianceStats {
  total_active_hours: number;
  peak_hours: number;
  off_peak_hours: number;
  phantom_load_hours: number;
  avg_power_watts: number;
  max_power_watts: number;
  wasted_kwh?: number;
}

export interface UsageStatsResult {
  appliances: Record<string, ApplianceStats>;
  summary: {
    total_active_hours: number;
    total_phantom_hours: number;
    active_usage_percent: number;
    phantom_usage_percent: number;
    total_wasted_kwh?: number;
  };
}

export interface DisaggregateItem {
  type: string;
  quantity: number;
  rated_watts: number;
  usage_hours_per_day: number;
  share_percent: number;
  estimated_kwh: number;
  estimated_cost_rm: number;
}

export interface DisaggregateResult {
  total_kwh: number;
  breakdown: DisaggregateItem[];
  summary: {
    top_consumer: string | null;
    top_consumer_percent: number;
    appliance_count: number;
  };
}

export async function trainModel(): Promise<{ status: string; profiles: Record<string, unknown> }> {
  const res = await fetch(`${ML_API_URL}/api/train`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to train model');
  return res.json();
}

export async function predictPhantomLoad(
  mainsReading: number,
  appliances: ApplianceItem[]
): Promise<PhantomDetectionResult> {
  const res = await fetch(`${ML_API_URL}/api/predict-phantom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mains_reading: mainsReading,
      inventory: appliances,
    }),
  });
  if (!res.ok) throw new Error('Failed to predict phantom load');
  return res.json();
}

export async function getUsageStats(appliances?: ApplianceItem[]): Promise<UsageStatsResult> {
  const res = await fetch(`${ML_API_URL}/api/stats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: appliances ? JSON.stringify(appliances) : JSON.stringify(null),
  });
  if (!res.ok) throw new Error('Failed to get usage stats');
  return res.json();
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${ML_API_URL}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function disaggregateEnergy(
  totalKwh: number,
  appliances: ApplianceItem[]
): Promise<DisaggregateResult> {
  const res = await fetch(`${ML_API_URL}/api/disaggregate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      total_kwh: totalKwh,
      appliances: appliances,
    }),
  });
  if (!res.ok) throw new Error('Failed to disaggregate energy');
  return res.json();
}

// --- Forecast API Functions ---

/**
 * Predict next hour's power usage using LSTM model
 * @param historyData - Array of 24 hourly power readings (in Watts)
 */
export async function predictHourlyUsage(historyData: number[]): Promise<HourlyPredictionResult> {
  const res = await fetch(`${FORECAST_API_URL}/predict/hour`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ history_data: historyData }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || 'Failed to predict hourly usage');
  }
  return res.json();
}

/**
 * Predict next day or week's energy usage using LSTM model
 * @param historyData - Array of 30 daily energy readings (in kWh)
 * @param mode - 'day' for next day, 'week' for next 7 days
 */
export async function predictDailyUsage(
  historyData: number[],
  mode: 'day' | 'week' = 'week'
): Promise<WeeklyPredictionResult> {
  const res = await fetch(`${FORECAST_API_URL}/predict/daily`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ history_data: historyData, mode }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || 'Failed to predict daily usage');
  }
  return res.json();
}

/**
 * Check if the forecast API is available
 */
export async function checkForecastHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${FORECAST_API_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

// --- NEW: Real Data Prediction ---

export interface RealDataPrediction {
  day: string;
  predicted_kwh: number;
}

export interface RealDataPredictionResult {
  success: boolean;
  type: "next_week";
  data_source: string;
  input_period: string;
  input_stats: {
    min_kwh: number;
    max_kwh: number;
    avg_kwh: number;
  };
  predictions: RealDataPrediction[];
  total_week_kwh: number;
  unit: string;
}

/**
 * Get weekly predictions using REAL data from House_4 dataset
 * This is the preferred method as it uses actual historical data
 */
export async function predictWeekFromRealData(): Promise<RealDataPredictionResult> {
  const res = await fetch(`${FORECAST_API_URL}/predict/week`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || 'Failed to get real data prediction');
  }
  return res.json();
}

// --- Monthly Forecast API ---

export interface MonthlyPrediction {
  month: string;
  year: number;
  month_label: string;
  predicted_kwh: number;
}

export interface MonthlyPredictionResult {
  success: boolean;
  predictions: MonthlyPrediction[];
  total_6_months_kwh: number;
  data_source: string;
  message?: string;
}

/**
 * Get monthly energy usage predictions for the next 6 months
 * Uses LSTM model trained on House_4 dataset
 */
export async function predictMonthlyUsage(): Promise<MonthlyPredictionResult> {
  const res = await fetch(`${ML_API_URL}/monthly/predict`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || 'Failed to get monthly prediction');
  }
  return res.json();
}

/**
 * Check if the monthly forecast API is available
 */
export async function checkMonthlyForecastHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${ML_API_URL}/monthly/health`);
    return res.ok;
  } catch {
    return false;
  }
}
