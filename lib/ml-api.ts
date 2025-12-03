const ML_API_URL = process.env.NEXT_PUBLIC_ML_API_URL || "http://127.0.0.1:8000";

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
