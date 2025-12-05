"use client"

import { useState, useEffect, useMemo } from "react"
import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertTriangle,
  TrendingUp,
  Activity,
  AirVent,
  Refrigerator,
  WashingMachine,
  Tv,
  Monitor,
  Lightbulb,
  Fan,
  Microwave,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { LiveUsageChart } from "@/components/dashboard/live-usage-chart"
import { UsageTrendChart } from "@/components/dashboard/usage-trend-chart"
import { createClient } from "@/utils/supabase/client"
import { getUsageStats, predictWeekFromRealData, type UsageStatsResult, type ApplianceData, type Plan, type PlanItem } from "@/lib/ml-api"

const applianceIcons: Record<string, React.ElementType> = {
  "Air Conditioner": AirVent,
  Refrigerator: Refrigerator,
  "Washing Machine": WashingMachine,
  Television: Tv,
  "Computer/PC": Monitor,
  "LED Lights": Lightbulb,
  "Ceiling Fan": Fan,
  Microwave: Microwave,
};

const getApplianceIcon = (name: string) => {
  for (const [key, Icon] of Object.entries(applianceIcons)) {
    if (name.toLowerCase().includes(key.toLowerCase())) {
      return Icon;
    }
  }
  return Activity;
};

const generateUsageData = () => {
  const now = new Date()
  const data = []
  for (let i = 23; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 5 * 60000)
    data.push({
      time: time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      usage: Math.random() * 3 + 1.5 + (i < 12 ? 1 : 0),
      limit: 4.5,
    })
  }
  return data
}

type GridStatus = "healthy" | "warning" | "critical"

const getGridStatus = (): GridStatus => {
  // Always return critical to alert users to reduce electric usage
  return "critical"
}

export default function DashboardPage() {
  const [usageData, setUsageData] = useState<Array<{ time: string; usage: number; limit: number }>>([])
  const [gridStatus, setGridStatus] = useState<GridStatus>("healthy")
  const [currentUsage, setCurrentUsage] = useState(85)
  const [budgetTarget, setBudgetTarget] = useState(150)
  const [trendData, setTrendData] = useState<Array<{ label: string; predicted: number }>>([])
  const [mlStats, setMlStats] = useState<UsageStatsResult | null>(null)
  const [appliances, setAppliances] = useState<ApplianceData[]>([])
  const [generatedPlan, setGeneratedPlan] = useState<Plan | null>(null)

  const [isClient, setIsClient] = useState(false)
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(true)
  const [isWeekend, setIsWeekend] = useState(false)

  useEffect(() => {
    setIsClient(true)
    setUsageData(generateUsageData())
    setGridStatus(getGridStatus())

    const interval = setInterval(() => {
      setUsageData(generateUsageData())
      setGridStatus(getGridStatus())
      setCurrentUsage((prev) => Math.min(prev + Math.random() * 2 - 0.5, 100))
    }, 5000)

    // Fetch data from the same API endpoint as Plan page
    async function fetchDashboardData() {
      try {
        const res = await fetch('/api/appliances')
        if (res.ok) {
          const data = await res.json()
          if (data.appliances) {
            setAppliances(data.appliances)
          }
          if (data.profile) {
            console.log('Dashboard profile fetch:', data.profile);
            if (data.profile.monthly_budget_target != null) {
              setBudgetTarget(data.profile.monthly_budget_target)
            }
          }
          if (data.planning) {
            setGeneratedPlan(data.planning)
          }
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      }
    }
    fetchDashboardData()

    async function loadMLStats() {
      try {
        const stats = await getUsageStats()
        setMlStats(stats)
      } catch (err) {
        // ML service is optional - silently fail if not available
        // The dashboard will work without ML stats
        console.debug("ML service not available - continuing without ML stats")
      }
    }

    async function loadPredictions() {
      setIsLoadingPredictions(true)
      try {
        // Use REAL data from House_4 dataset
        const prediction = await predictWeekFromRealData()

        if (prediction.success && prediction.predictions) {
          const predictionData = prediction.predictions.map(p => ({
            label: p.day,
            predicted: p.predicted_kwh
          }))

          setTrendData(predictionData)
          console.log("Real data prediction loaded:", {
            source: prediction.data_source,
            inputStats: prediction.input_stats,
            totalWeek: prediction.total_week_kwh
          })
        }
      } catch (err) {
        console.error("Forecast API not available:", err)
        // Set fallback prediction data
        const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        setTrendData(days.map(day => ({
          label: day,
          predicted: 16 + Math.random() * 8
        })))
      } finally {
        setIsLoadingPredictions(false)
      }
    }

    loadMLStats()
    loadPredictions()

    return () => clearInterval(interval)
  }, [])



  const budgetProgress = (currentUsage / budgetTarget) * 100
  const isNearLimit = budgetProgress > 75

  // Pre-compute simulated usage values so they don't change on every render
  const simulatedUsageData = useMemo(() => {
    return appliances.map((appliance) => {
      const applianceName = appliance.name.toLowerCase();

      // Find planned hours from generated plan (if exists)
      const planItem = generatedPlan?.plan?.find(
        (p: { name: string }) =>
          p.name.toLowerCase().includes(appliance.name.toLowerCase()) ||
          appliance.name.toLowerCase().includes(p.name.toLowerCase())
      );

      const plannedPeakWeekday = planItem?.planned_peak_hours_weekday ?? appliance.peak_usage_hours;
      const plannedOffPeakWeekday = planItem?.planned_off_peak_hours_weekday ?? appliance.off_peak_usage_hours;

      // Weekend: all hours are off-peak, so use weekend hours or combine weekday hours as fallback
      const plannedWeekendTotal = planItem?.planned_offpeak_hours_weekend ??
        (planItem?.planned_peak_hours_weekend ?? 0) + (planItem?.planned_offpeak_hours_weekend ?? (plannedPeakWeekday + plannedOffPeakWeekday));

      let simulatedPeakUsage: number;
      let simulatedOffPeakUsage: number;
      let simulatedWeekendUsage: number;

      // Peak usage simulation
      if (plannedPeakWeekday === 0) {
        simulatedPeakUsage = 0;
      } else if (applianceName.includes('air conditioner') || applianceName.includes('ac')) {
        simulatedPeakUsage = plannedPeakWeekday * 0.55;
      } else if (applianceName.includes('computer') || applianceName.includes('pc')) {
        simulatedPeakUsage = plannedPeakWeekday * 1.12;
      } else if (applianceName.includes('tv') || applianceName.includes('television')) {
        simulatedPeakUsage = plannedPeakWeekday * 1.15;
      } else if (applianceName.includes('washing machine')) {
        simulatedPeakUsage = plannedPeakWeekday * 0.85; // Orange (70-99%)
      } else if (applianceName.includes('refrigerator')) {
        simulatedPeakUsage = plannedPeakWeekday * 0.58;
      } else {
        simulatedPeakUsage = plannedPeakWeekday * 0.6;
      }

      // Off-peak usage simulation
      if (plannedOffPeakWeekday === 0) {
        simulatedOffPeakUsage = 0;
      } else if (applianceName.includes('air conditioner') || applianceName.includes('ac')) {
        simulatedOffPeakUsage = plannedOffPeakWeekday * 0.52;
      } else if (applianceName.includes('computer') || applianceName.includes('pc')) {
        simulatedOffPeakUsage = plannedOffPeakWeekday * 0.55;
      } else if (applianceName.includes('tv') || applianceName.includes('television')) {
        simulatedOffPeakUsage = plannedOffPeakWeekday * 0.58;
      } else if (applianceName.includes('washing machine')) {
        simulatedOffPeakUsage = plannedOffPeakWeekday * 0.6; // Green (<70%)
      } else if (applianceName.includes('refrigerator')) {
        simulatedOffPeakUsage = plannedOffPeakWeekday * 0.55;
      } else {
        simulatedOffPeakUsage = plannedOffPeakWeekday * 0.58;
      }

      // Weekend usage simulation (all off-peak rate)
      if (plannedWeekendTotal === 0) {
        simulatedWeekendUsage = 0;
      } else if (applianceName.includes('air conditioner') || applianceName.includes('ac')) {
        simulatedWeekendUsage = plannedWeekendTotal * 0.55;
      } else if (applianceName.includes('computer') || applianceName.includes('pc')) {
        simulatedWeekendUsage = plannedWeekendTotal * 0.65;
      } else if (applianceName.includes('tv') || applianceName.includes('television')) {
        simulatedWeekendUsage = plannedWeekendTotal * 0.70;
      } else if (applianceName.includes('washing machine')) {
        simulatedWeekendUsage = plannedWeekendTotal * 0.55;
      } else if (applianceName.includes('refrigerator')) {
        simulatedWeekendUsage = plannedWeekendTotal * 0.55;
      } else {
        simulatedWeekendUsage = plannedWeekendTotal * 0.58;
      }

      return {
        applianceId: appliance.id,
        plannedPeakWeekday,
        plannedOffPeakWeekday,
        plannedWeekendTotal,
        simulatedPeakUsage,
        simulatedOffPeakUsage,
        simulatedWeekendUsage,
      };
    });
  }, [appliances, generatedPlan]);


  const gridConfig = {
    healthy: {
      color: "text-chart-1",
      bgColor: "bg-chart-1/10",
      borderColor: "border-chart-1/20",
      status: "Optimal",
      description: "Clean energy sources active",
      badge: "Low Carbon",
    },
    warning: {
      color: "text-chart-4",
      bgColor: "bg-chart-4/10",
      borderColor: "border-chart-4/20",
      status: "Moderate",
      description: "Mixed energy sources",
      badge: "Medium Carbon",
    },
    critical: {
      color: "text-chart-3",
      bgColor: "bg-chart-3/10",
      borderColor: "border-chart-3/20",
      status: "Critical",
      description: "Coal peaker plants active",
      badge: "High Carbon",
    },
  }

  const currentGridConfig = gridConfig[gridStatus]

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-6 md:py-8 space-y-6">
        <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2">
          <Card className={cn(
            "border-2 relative",
            currentGridConfig.borderColor,
            gridStatus === "critical" && "animate-pulse-border shadow-[0_0_20px_rgba(239,68,68,0.5)]"
          )}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium">Grid Status</CardTitle>
                <Activity className={cn("h-5 w-5", currentGridConfig.color)} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-3xl font-bold">{currentGridConfig.status}</div>
                <p className="text-sm text-muted-foreground mt-1">{currentGridConfig.description}</p>
              </div>
              <Badge
                variant="outline"
                className={cn("font-semibold", currentGridConfig.color, currentGridConfig.bgColor)}
              >
                {currentGridConfig.badge}
              </Badge>

              {gridStatus === "critical" && (
                <div className="mt-3 pt-3 border-t border-chart-3/20">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-chart-3 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-chart-3">Critical Usage Alert</p>
                      <p className="text-xs text-muted-foreground">
                        Grid experiencing critically high usage! Please reduce electricity consumption immediately by turning off unnecessary appliances and unplugging devices.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={cn("border-2", isNearLimit && "border-chart-4/20")}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium">Budget Tracker</CardTitle>
                <TrendingUp className={cn("h-5 w-5", isNearLimit ? "text-chart-4" : "text-chart-2")} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-3xl font-bold">
                  RM {currentUsage.toFixed(2)}
                  <span className="text-base font-normal text-muted-foreground ml-2">/ RM {budgetTarget}</span>
                </div>
                <Progress
                  value={budgetProgress}
                  className={cn(
                    "mt-3 h-2",
                    budgetProgress > 90
                      ? "[&>div]:bg-chart-3"
                      : budgetProgress > 75
                        ? "[&>div]:bg-chart-4"
                        : "[&>div]:bg-chart-2",
                  )}
                />
              </div>
              <p className="text-sm text-muted-foreground">{budgetProgress.toFixed(0)}% of monthly target used</p>
            </CardContent>
          </Card>


        </div>

        {/* Real Time Tracker */}
        {appliances.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Real Time Tracker</CardTitle>
                <div className="flex rounded-lg border overflow-hidden">
                  <Button
                    variant={isWeekend ? "ghost" : "default"}
                    size="sm"
                    onClick={() => setIsWeekend(false)}
                    className="rounded-none"
                  >
                    Weekday
                  </Button>
                  <Button
                    variant={isWeekend ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setIsWeekend(true)}
                    className="rounded-none"
                  >
                    Weekend
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Track your daily usage against your personalized plan ({isWeekend ? "Weekend" : "Weekday"})
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {appliances.map((appliance, index) => {
                  const Icon = getApplianceIcon(appliance.name);

                  // Get pre-computed simulated data
                  const simData = simulatedUsageData.find(d => d.applianceId === appliance.id);
                  const plannedPeakWeekday = simData?.plannedPeakWeekday ?? appliance.peak_usage_hours;
                  const plannedOffPeakWeekday = simData?.plannedOffPeakWeekday ?? appliance.off_peak_usage_hours;
                  const plannedWeekendTotal = simData?.plannedWeekendTotal ?? (plannedPeakWeekday + plannedOffPeakWeekday);
                  const simulatedPeakUsage = simData?.simulatedPeakUsage ?? 0;
                  const simulatedOffPeakUsage = simData?.simulatedOffPeakUsage ?? 0;
                  const simulatedWeekendUsage = simData?.simulatedWeekendUsage ?? 0;

                  // Calculate percentages
                  const peakPercent = plannedPeakWeekday > 0 ? (simulatedPeakUsage / plannedPeakWeekday) * 100 : 0;
                  const offPeakPercent = plannedOffPeakWeekday > 0 ? (simulatedOffPeakUsage / plannedOffPeakWeekday) * 100 : 0;
                  const weekendPercent = plannedWeekendTotal > 0 ? (simulatedWeekendUsage / plannedWeekendTotal) * 100 : 0;

                  // Determine progress bar colors based on percentage
                  const getBarColor = (percent: number) => {
                    if (percent < 70) return "bg-green-500";
                    if (percent <= 100) return "bg-orange-500";
                    return "bg-red-500";
                  };

                  return (
                    <div key={appliance.id} className="space-y-4">
                      {/* Appliance Name */}
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <span className="font-semibold text-base">{appliance.name}</span>
                      </div>

                      {isWeekend ? (
                        /* Weekend: Total Hours Only */
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Total hours</span>
                            <span className="text-sm font-medium">
                              {simulatedWeekendUsage.toFixed(1)}h/{plannedWeekendTotal.toFixed(1)}h
                            </span>
                          </div>
                          <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${getBarColor(weekendPercent)}`}
                              style={{ width: `${Math.min(weekendPercent, 100)}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        /* Weekday: Peak & Off-Peak Hours */
                        <>
                          {/* Peak Hour Progress */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Peak hour</span>
                              <span className="text-sm font-medium">
                                {simulatedPeakUsage.toFixed(1)}h/{plannedPeakWeekday.toFixed(1)}h
                              </span>
                            </div>
                            <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${getBarColor(peakPercent)}`}
                                style={{ width: `${Math.min(peakPercent, 100)}%` }}
                              />
                            </div>
                          </div>

                          {/* Off-Peak Hour Progress */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Off-peak hour</span>
                              <span className="text-sm font-medium">
                                {simulatedOffPeakUsage.toFixed(1)}h/{plannedOffPeakWeekday.toFixed(1)}h
                              </span>
                            </div>
                            <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${getBarColor(offPeakPercent)}`}
                                style={{ width: `${Math.min(offPeakPercent, 100)}%` }}
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <LiveUsageChart data={usageData} />

        <UsageTrendChart
          data={trendData}
          budgetTarget={budgetTarget}
          isLoading={isLoadingPredictions}
        />


      </div>
    </AppShell>
  )
}
