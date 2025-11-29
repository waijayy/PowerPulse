// Smart plan calculator based on target bill
// Implements algorithm to calculate peak/off-peak hours that meet target

export type ApplianceInput = {
  name: string;
  quantity: number;
  watt: number;
  peak_usage_hours: number;
  off_peak_usage_hours: number;
};

export type PlannedAppliance = {
  name: string;
  quantity: number;
  watt: number;
  kWh: number;
  last_month_peak_hours: number;
  last_month_offpeak_hours: number;
  planned_peak_hours_weekday: number;
  planned_offpeak_hours_weekday: number;
  planned_peak_hours_weekend: number;
  planned_offpeak_hours_weekend: number;
  monthly_savings: number;
};

export type PlanResult = {
  plan: PlannedAppliance[];
  projected_bill: number;
  total_savings: number;
  explanation: string;
};

// Electricity rates (RM/kWh)
const PEAK_RATE = 0.2583;
const OFF_PEAK_RATE = 0.2443;

// Get minimum usage constraints for each appliance type
function getMinConstraints(name: string, currentPeak: number, currentOff: number) {
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes('refrigerator') || lowerName.includes('fridge')) {
    // Refrigerator must stay on 24h, but can shift to off-peak
    return { minPeak: 0, minOff: 24 };
  } else if (lowerName.includes('air condition') || lowerName.includes('ac')) {
    return { minPeak: 2, minOff: 0 };
  } else if (lowerName.includes('television') || lowerName.includes('tv')) {
    return { minPeak: 1, minOff: 0 };
  } else if (lowerName.includes('light')) {
    return { minPeak: 1, minOff: 0 };
  } else if (lowerName.includes('washing') || lowerName.includes('washer')) {
    return { minPeak: 0, minOff: 0 };
  } else {
    // Default: can reduce to 0
    return { minPeak: 0, minOff: 0 };
  }
}

// Calculate monthly cost from daily hours (weekday + weekend average)
function calculateMonthlyCost(
  quantity: number,
  kWh: number,
  peakHoursWeekday: number,
  offPeakHoursWeekday: number,
  peakHoursWeekend: number,
  offPeakHoursWeekend: number
): number {
  // Average daily hours (5 weekdays + 2 weekends)
  const avgPeakHours = (peakHoursWeekday * 5 + peakHoursWeekend * 2) / 7;
  const avgOffPeakHours = (offPeakHoursWeekday * 5 + offPeakHoursWeekend * 2) / 7;
  
  // Daily cost
  const dailyPeakCost = quantity * kWh * avgPeakHours * PEAK_RATE;
  const dailyOffPeakCost = quantity * kWh * avgOffPeakHours * OFF_PEAK_RATE;
  const dailyCost = dailyPeakCost + dailyOffPeakCost;
  
  // Monthly cost (30 days)
  return dailyCost * 30;
}

export function calculatePersonalizedPlan(
  appliances: ApplianceInput[],
  lastMonthBill: number,
  targetBill: number
): PlanResult {
  // Step 1: Convert to working format with kWh
  const df = appliances.map((app) => ({
    name: app.name,
    quantity: app.quantity,
    watt: app.watt,
    kWh: app.watt / 1000,
    last_month_peak_hours: app.peak_usage_hours,
    last_month_offpeak_hours: app.off_peak_usage_hours,
    planned_peak_hours_weekday: app.peak_usage_hours,
    planned_offpeak_hours_weekday: app.off_peak_usage_hours,
    planned_peak_hours_weekend: app.peak_usage_hours,
    planned_offpeak_hours_weekend: app.off_peak_usage_hours,
  }));

  // Step 2: Calculate last month bill from appliances
  let calculatedLastMonthBill = 0;
  df.forEach((row) => {
    const avgPeak = (row.last_month_peak_hours * 5 + row.last_month_peak_hours * 2) / 7;
    const avgOffPeak = (row.last_month_offpeak_hours * 5 + row.last_month_offpeak_hours * 2) / 7;
    const dailyCost =
      row.quantity * row.kWh * (avgPeak * PEAK_RATE + avgOffPeak * OFF_PEAK_RATE);
    calculatedLastMonthBill += dailyCost * 30;
  });

  // Use the higher of actual bill or calculated bill as baseline
  const baselineBill = Math.max(lastMonthBill, calculatedLastMonthBill);

  // Step 3: Determine required savings
  const requiredSavings = Math.max(0, baselineBill - targetBill);

  // Step 4: Generate personalized plan (weekday)
  let remainingSavings = requiredSavings;

  // Sort appliances by kWh descending (high-cost first)
  const sortedIndices = df
    .map((_, idx) => idx)
    .sort((a, b) => df[b].kWh - df[a].kWh);

  for (const idx of sortedIndices) {
    if (remainingSavings <= 0) break;

    const row = df[idx];
    const constraints = getMinConstraints(
      row.name,
      row.planned_peak_hours_weekday,
      row.planned_offpeak_hours_weekday
    );

    // Maximum reducible hours
    const reduciblePeak = Math.max(
      row.planned_peak_hours_weekday - constraints.minPeak,
      0
    );
    const reducibleOff = Math.max(
      row.planned_offpeak_hours_weekday - constraints.minOff,
      0
    );

    // Calculate potential savings from reducing weekday hours
    // We need to account for both weekday and weekend impact
    const weekdayDailyCostPeak = row.quantity * row.kWh * reduciblePeak * PEAK_RATE;
    const weekdayDailyCostOff = row.quantity * row.kWh * reducibleOff * OFF_PEAK_RATE;
    const weekdayDailySavings = weekdayDailyCostPeak + weekdayDailyCostOff;
    
    // Weekend will be 1.2x, so savings are also 1.2x
    const weekendDailySavings = weekdayDailySavings * 1.2;
    
    // Total monthly savings (5 weekdays + 2 weekends)
    const totalPotentialSavings = weekdayDailySavings * 5 + weekendDailySavings * 2;

    if (totalPotentialSavings >= remainingSavings) {
      // Reduce proportionally to meet target
      const reductionRatio = remainingSavings / totalPotentialSavings;
      row.planned_peak_hours_weekday -= reduciblePeak * reductionRatio;
      row.planned_offpeak_hours_weekday -= reducibleOff * reductionRatio;
      remainingSavings = 0;
      break;
    } else {
      // Reduce all possible
      row.planned_peak_hours_weekday -= reduciblePeak;
      row.planned_offpeak_hours_weekday -= reducibleOff;
      remainingSavings -= totalPotentialSavings;
    }
  }

  // Step 5: Weekend usage (20% more than weekday)
  df.forEach((row) => {
    row.planned_peak_hours_weekend = row.planned_peak_hours_weekday * 1.2;
    row.planned_offpeak_hours_weekend = row.planned_offpeak_hours_weekday * 1.2;
  });

  // Step 6: Calculate projected bill and savings
  let projectedBill = 0;
  const planWithSavings: PlannedAppliance[] = df.map((row) => {
    const lastMonthCost = calculateMonthlyCost(
      row.quantity,
      row.kWh,
      row.last_month_peak_hours,
      row.last_month_offpeak_hours,
      row.last_month_peak_hours,
      row.last_month_offpeak_hours
    );

    const plannedCost = calculateMonthlyCost(
      row.quantity,
      row.kWh,
      row.planned_peak_hours_weekday,
      row.planned_offpeak_hours_weekday,
      row.planned_peak_hours_weekend,
      row.planned_offpeak_hours_weekend
    );

    projectedBill += plannedCost;
    const monthlySavings = lastMonthCost - plannedCost;

    return {
      name: row.name,
      quantity: row.quantity,
      watt: row.watt,
      kWh: row.kWh,
      last_month_peak_hours: row.last_month_peak_hours,
      last_month_offpeak_hours: row.last_month_offpeak_hours,
      planned_peak_hours_weekday: Math.round(row.planned_peak_hours_weekday * 10) / 10,
      planned_offpeak_hours_weekday: Math.round(row.planned_offpeak_hours_weekday * 10) / 10,
      planned_peak_hours_weekend: Math.round(row.planned_peak_hours_weekend * 10) / 10,
      planned_offpeak_hours_weekend: Math.round(row.planned_offpeak_hours_weekend * 10) / 10,
      monthly_savings: Math.round(monthlySavings * 100) / 100,
    };
  });

  const totalSavings = baselineBill - projectedBill;

  // Generate explanation
  const explanation = `Optimized your energy plan to meet the target of RM ${targetBill.toFixed(
    2
  )}. Adjusted peak and off-peak hours for each appliance based on their power consumption. High-watt appliances were prioritized for reduction. Your projected monthly bill is RM ${projectedBill.toFixed(
    2
  )}, saving you RM ${totalSavings.toFixed(2)}.`;

  return {
    plan: planWithSavings,
    projected_bill: Math.round(projectedBill * 100) / 100,
    total_savings: Math.round(totalSavings * 100) / 100,
    explanation,
  };
}


