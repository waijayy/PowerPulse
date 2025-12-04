// Plan calculator based on percentage distribution and user usage patterns
// Distributes hours proportionally and optimizes for off-peak usage

export type ApplianceInput = {
  name: string;
  quantity: number;
  watt: number;
  peak_usage_hours: number;
  off_peak_usage_hours: number;
  usage_start_time?: string;
  usage_end_time?: string;
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
  suggested_time_weekday?: string;
  suggested_time_weekend?: string;
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

// Peak hours: 2pm-10pm (8 hours max)
// Off-peak hours: 10pm-2pm next day (16 hours max)
// Weekend: All off-peak (24 hours max)
const MAX_PEAK_HOURS = 8;
const MAX_OFF_PEAK_HOURS = 16;
const MAX_WEEKEND_HOURS = 24;

// Get minimum usage hours for essential appliances
function getMinimumHours(name: string): number {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('refrigerator') || lowerName.includes('fridge')) {
    return 24; // Always on
  } else if (lowerName.includes('air condition') || lowerName.includes('ac')) {
    return 2; // Minimum comfort
  } else if (lowerName.includes('light')) {
    return 1; // Basic lighting
  }
  return 0; // Can be turned off if needed
}

// Calculate how much to shift to off-peak based on wattage
function getOffPeakPriority(watt: number): number {
  // Returns percentage of hours that should be off-peak (0.0 to 1.0)
  if (watt >= 1500) return 0.95; // 95% off-peak for very high wattage
  if (watt >= 1000) return 0.85; // 85% off-peak for high wattage
  if (watt >= 500) return 0.7;  // 70% off-peak for medium-high
  if (watt >= 200) return 0.6;  // 60% off-peak for medium
  return 0.5; // 50/50 for low wattage
}

// Generate suggested time slot based on hours needed and user's usage pattern
function generateTimeSlot(
  peakHours: number,
  offPeakHours: number,
  usageStartTime?: string,
  usageEndTime?: string,
  isWeekend: boolean = false
): string {
  const totalHours = peakHours + offPeakHours;

  if (totalHours === 0) return "Not in use";

  // For weekend, all hours are off-peak
  if (isWeekend) {
    if (usageStartTime && usageEndTime) {
      // Use user's pattern as base
      const start = parseInt(usageStartTime.split(':')[0]);
      const duration = Math.round(totalHours * 10) / 10;
      const endHour = (start + Math.ceil(duration)) % 24;
      return `${formatTime(start)}-${formatTime(endHour)}`;
    }
    // Default: spread across day, prefer night hours
    if (totalHours >= 12) {
      return "8pm-8am + 2pm-6pm";
    } else if (totalHours >= 8) {
      return "10pm-6am";
    } else {
      const startHour = 22; // 10pm
      const endHour = (startHour + Math.ceil(totalHours)) % 24;
      return `${formatTime(startHour)}-${formatTime(endHour)}`;
    }
  }

  // Weekday: split between peak and off-peak
  const timeSlots: string[] = [];

  // Off-peak hours (prioritize)
  if (offPeakHours > 0) {
    if (usageStartTime && usageEndTime) {
      // Try to use user's pattern but shift to off-peak
      const start = parseInt(usageStartTime.split(':')[0]);

      // If user's time is mostly in peak (2pm-10pm), shift to off-peak
      if (start >= 14 && start < 22) {
        // Shift to night (10pm onwards)
        const nightStart = 22;
        const nightEnd = Math.min(24, nightStart + Math.ceil(offPeakHours));
        if (nightEnd > 24) {
          timeSlots.push(`${formatTime(nightStart)}-12am + 12am-${formatTime(nightEnd - 24)}`);
        } else {
          timeSlots.push(`${formatTime(nightStart)}-${formatTime(nightEnd)}`);
        }
      } else {
        // Use user's time if already in off-peak
        const endHour = (start + Math.ceil(offPeakHours)) % 24;
        timeSlots.push(`${formatTime(start)}-${formatTime(endHour)}`);
      }
    } else {
      // Default: night hours (10pm onwards)
      const nightStart = 22;
      const nightEnd = Math.min(24, nightStart + Math.ceil(offPeakHours));
      if (nightEnd > 24) {
        const morningEnd = (nightEnd % 24);
        timeSlots.push(`${formatTime(nightStart)}-12am + 12am-${formatTime(morningEnd)}`);
      } else {
        timeSlots.push(`${formatTime(nightStart)}-${formatTime(nightEnd)}`);
      }
    }
  }

  // Peak hours
  if (peakHours > 0) {
    if (usageStartTime && usageEndTime) {
      const start = parseInt(usageStartTime.split(':')[0]);
      // Use user's preferred time if in peak range
      if (start >= 14 && start < 22) {
        const endHour = Math.min(22, start + Math.ceil(peakHours));
        timeSlots.push(`${formatTime(start)}-${formatTime(endHour)}`);
      } else {
        // Default peak time
        timeSlots.push(`2pm-${formatTime(14 + Math.ceil(peakHours))}`);
      }
    } else {
      // Default: afternoon/evening
      const peakStart = 14; // 2pm
      const peakEnd = Math.min(22, peakStart + Math.ceil(peakHours));
      timeSlots.push(`${formatTime(peakStart)}-${formatTime(peakEnd)}`);
    }
  }

  return timeSlots.join(' + ');
}

// Format hour to 12-hour time
function formatTime(hour: number): string {
  if (hour === 0) return "12am";
  if (hour < 12) return `${hour}am`;
  if (hour === 12) return "12pm";
  return `${hour - 12}pm`;
}

export function calculatePersonalizedPlan(
  appliances: ApplianceInput[],
  lastMonthBill: number,
  targetBill: number
): PlanResult {
  // Step 1: Calculate total current usage hours and percentages
  let totalCurrentHours = 0;
  let currentMonthlyBill = 0;

  const applianceData = appliances.map((app) => {
    const kWh = app.watt / 1000;
    const dailyHours = app.peak_usage_hours + app.off_peak_usage_hours;
    totalCurrentHours += dailyHours;

    // Calculate current monthly cost
    const dailyPeakCost = kWh * app.quantity * app.peak_usage_hours * PEAK_RATE;
    const dailyOffPeakCost = kWh * app.quantity * app.off_peak_usage_hours * OFF_PEAK_RATE;
    const monthlyCost = (dailyPeakCost + dailyOffPeakCost) * 30;
    currentMonthlyBill += monthlyCost;

    return {
      name: app.name,
      quantity: app.quantity,
      watt: app.watt,
      kWh: kWh,
      current_peak_hours: app.peak_usage_hours,
      current_offpeak_hours: app.off_peak_usage_hours,
      current_daily_hours: dailyHours,
      current_monthly_cost: monthlyCost,
      usage_percentage: 0, // Will calculate below
      minimum_hours: getMinimumHours(app.name),
      offpeak_priority: getOffPeakPriority(app.watt),
      usage_start_time: app.usage_start_time,
      usage_end_time: app.usage_end_time,
    };
  });

  // Calculate usage percentage for each appliance
  applianceData.forEach(app => {
    app.usage_percentage = totalCurrentHours > 0 ? app.current_daily_hours / totalCurrentHours : 0;
  });

  // Step 2: Calculate affordable total hours based on target bill
  // Work backwards: target bill → affordable kWh → affordable hours

  // Estimate weighted average rate (assuming optimized off-peak usage)
  const totalWattage = applianceData.reduce((sum, app) => sum + (app.watt * app.quantity), 0);
  const weightedOffPeakRatio = applianceData.reduce((sum, app) => {
    const weight = (app.watt * app.quantity) / totalWattage;
    return sum + (weight * app.offpeak_priority);
  }, 0);

  const estimatedAvgRate = (weightedOffPeakRatio * OFF_PEAK_RATE) + ((1 - weightedOffPeakRatio) * PEAK_RATE);

  // Calculate affordable monthly kWh
  const affordableMonthlyKWh = targetBill / estimatedAvgRate;
  const affordableDailyKWh = affordableMonthlyKWh / 30;

  // Calculate total affordable daily hours (rough estimate)
  const avgKWhPerHour = applianceData.reduce((sum, app) =>
    sum + (app.kWh * app.quantity * app.usage_percentage), 0
  );
  const affordableTotalHours = avgKWhPerHour > 0 ? affordableDailyKWh / avgKWhPerHour : totalCurrentHours;

  // Step 3: Distribute hours to each appliance based on percentage
  let totalAllocatedHours = 0;

  const plannedAppliances = applianceData.map(app => {
    // Allocate hours based on usage percentage
    let allocatedHours = affordableTotalHours * app.usage_percentage;

    // Ensure minimum hours
    allocatedHours = Math.max(allocatedHours, app.minimum_hours);

    // Cap total daily hours at 24h for weekday
    allocatedHours = Math.min(allocatedHours, 24);

    totalAllocatedHours += allocatedHours;

    // Split into peak and off-peak based on priority
    let offPeakHours = allocatedHours * app.offpeak_priority;
    let peakHours = allocatedHours - offPeakHours;

    // Cap at maximum hours BEFORE rounding
    peakHours = Math.min(peakHours, MAX_PEAK_HOURS);
    offPeakHours = Math.min(offPeakHours, MAX_OFF_PEAK_HOURS);

    // If we had to cap, scale down to fit allocated hours
    const totalCapped = peakHours + offPeakHours;
    if (totalCapped > allocatedHours) {
      // Scale down proportionally
      const scale = allocatedHours / totalCapped;
      peakHours = peakHours * scale;
      offPeakHours = offPeakHours * scale;
    }

    // Round to 1 decimal place AFTER capping
    const weekdayPeakHours = Math.round(peakHours * 10) / 10;
    const weekdayOffPeakHours = Math.round(offPeakHours * 10) / 10;

    // Weekend: 20% more hours than weekday total, all off-peak, capped at 24h
    const weekdayTotal = weekdayPeakHours + weekdayOffPeakHours;
    let weekendTotalHours = weekdayTotal * 1.2;
    weekendTotalHours = Math.min(weekendTotalHours, MAX_WEEKEND_HOURS);
    weekendTotalHours = Math.round(weekendTotalHours * 10) / 10;

    // Generate suggested time slots
    const suggestedTimeWeekday = generateTimeSlot(
      weekdayPeakHours,
      weekdayOffPeakHours,
      app.usage_start_time,
      app.usage_end_time,
      false
    );

    const suggestedTimeWeekend = generateTimeSlot(
      0, // Weekend has no peak hours
      weekendTotalHours,
      app.usage_start_time,
      app.usage_end_time,
      true
    );

    return {
      ...app,
      planned_peak_hours_weekday: weekdayPeakHours,
      planned_offpeak_hours_weekday: weekdayOffPeakHours,
      planned_peak_hours_weekend: 0, // Weekend all off-peak
      planned_offpeak_hours_weekend: weekendTotalHours,
      suggested_time_weekday: suggestedTimeWeekday,
      suggested_time_weekend: suggestedTimeWeekend,
    };
  });

  // Step 4: If still over budget, reduce high-wattage appliances
  let projectedBill = 0;
  plannedAppliances.forEach(app => {
    const weekdayPeakCost = app.kWh * app.quantity * app.planned_peak_hours_weekday * PEAK_RATE;
    const weekdayOffPeakCost = app.kWh * app.quantity * app.planned_offpeak_hours_weekday * OFF_PEAK_RATE;
    const weekdayDailyCost = weekdayPeakCost + weekdayOffPeakCost;

    const weekendOffPeakCost = app.kWh * app.quantity * app.planned_offpeak_hours_weekend * OFF_PEAK_RATE;

    // Monthly cost: (5 weekdays + 2 weekends) per week * 30/7
    const monthlyCost = (weekdayDailyCost * 5 + weekendOffPeakCost * 2) * (30 / 7);
    projectedBill += monthlyCost;
  });

  // If over budget, reduce hours proportionally, prioritizing high-wattage appliances
  if (projectedBill > targetBill) {
    const reductionNeeded = projectedBill - targetBill;
    const reductionRatio = reductionNeeded / projectedBill;

    // Sort by wattage (high to low) for reduction priority
    const sortedByWattage = [...plannedAppliances].sort((a, b) => b.watt - a.watt);

    sortedByWattage.forEach(app => {
      if (projectedBill <= targetBill) return; // Stop if we've reached target

      const currentTotal = app.planned_peak_hours_weekday + app.planned_offpeak_hours_weekday;
      const reducibleHours = Math.max(0, currentTotal - app.minimum_hours);

      if (reducibleHours > 0) {
        // Reduce by ratio, but more aggressively for high-wattage
        const wattageMultiplier = app.watt >= 1000 ? 1.5 : 1.0;
        const reduction = reducibleHours * reductionRatio * wattageMultiplier;

        // Reduce from peak first, then off-peak
        const peakReduction = Math.min(reduction, app.planned_peak_hours_weekday);
        const offPeakReduction = reduction - peakReduction;

        app.planned_peak_hours_weekday = Math.max(0, app.planned_peak_hours_weekday - peakReduction);
        app.planned_offpeak_hours_weekday = Math.max(0, app.planned_offpeak_hours_weekday - offPeakReduction);

        // Adjust weekend proportionally
        const newWeekdayTotal = app.planned_peak_hours_weekday + app.planned_offpeak_hours_weekday;
        app.planned_offpeak_hours_weekend = Math.round(newWeekdayTotal * 1.2 * 10) / 10;

        // Recalculate projected bill
        projectedBill = 0;
        plannedAppliances.forEach(a => {
          const wdPeakCost = a.kWh * a.quantity * a.planned_peak_hours_weekday * PEAK_RATE;
          const wdOffPeakCost = a.kWh * a.quantity * a.planned_offpeak_hours_weekday * OFF_PEAK_RATE;
          const wdDailyCost = wdPeakCost + wdOffPeakCost;
          const weOffPeakCost = a.kWh * a.quantity * a.planned_offpeak_hours_weekend * OFF_PEAK_RATE;
          const mCost = (wdDailyCost * 5 + weOffPeakCost * 2) * (30 / 7);
          projectedBill += mCost;
        });
      }
    });
  }

  // Step 5: Calculate final bill and savings
  projectedBill = Math.round(projectedBill * 100) / 100;
  const totalSavings = Math.round((currentMonthlyBill - projectedBill) * 100) / 100;

  // Format final plan
  const finalPlan: PlannedAppliance[] = plannedAppliances.map(app => {
    const oldCost = app.current_monthly_cost;
    const weekdayPeakCost = app.kWh * app.quantity * app.planned_peak_hours_weekday * PEAK_RATE;
    const weekdayOffPeakCost = app.kWh * app.quantity * app.planned_offpeak_hours_weekday * OFF_PEAK_RATE;
    const weekdayDailyCost = weekdayPeakCost + weekdayOffPeakCost;
    const weekendOffPeakCost = app.kWh * app.quantity * app.planned_offpeak_hours_weekend * OFF_PEAK_RATE;
    const newCost = (weekdayDailyCost * 5 + weekendOffPeakCost * 2) * (30 / 7);
    const savings = oldCost - newCost;

    return {
      name: app.name,
      quantity: app.quantity,
      watt: app.watt,
      kWh: app.kWh,
      last_month_peak_hours: app.current_peak_hours,
      last_month_offpeak_hours: app.current_offpeak_hours,
      planned_peak_hours_weekday: app.planned_peak_hours_weekday,
      planned_offpeak_hours_weekday: app.planned_offpeak_hours_weekday,
      planned_peak_hours_weekend: app.planned_peak_hours_weekend,
      planned_offpeak_hours_weekend: app.planned_offpeak_hours_weekend,
      monthly_savings: Math.round(savings * 100) / 100,
    };
  });

  const explanation = `Optimized your energy plan to meet the target of RM ${targetBill.toFixed(2)}. ` +
    `Distributed hours based on your usage patterns (${Math.round(weightedOffPeakRatio * 100)}% off-peak priority). ` +
    `Your projected monthly bill is RM ${projectedBill.toFixed(2)}, saving you RM ${totalSavings.toFixed(2)}.`;

  return {
    plan: finalPlan,
    projected_bill: projectedBill,
    total_savings: totalSavings,
    explanation,
  };
}


