"use client"

import { useState, useEffect } from "react"
import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Zap, Search, Loader2 } from "lucide-react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { cn } from "@/lib/utils"
import { predictPhantomLoad, getUsageStats, type PhantomDetectionResult, type UsageStatsResult } from "@/lib/ml-api"
import { getAppliances } from "../appliances/actions"
import { createClient } from "@/utils/supabase/client"
import { ApplianceEfficientMax } from "@/constants/efficiency_threshold"

const APPLIANCE_TYPE_MAP: Record<string, string> = {
  "Air Conditioner": "Air Conditioner",
  "Refrigerator": "Fridge",
  "Washing Machine": "Washing Machine",
  "Television": "Television",
  "Computer/PC": "Computer/PC",
  "LED Lights": "LED Lights",
  "Microwave": "Microwave",
  "Ceiling Fan": "Ceiling Fan",
}

export default function InsightsPage() {
  const [currentUsage, setCurrentUsage] = useState(85)
  const [budgetTarget, setBudgetTarget] = useState(150)
  const [meterReading, setMeterReading] = useState([5])
  const [isScanning, setIsScanning] = useState(false)
  const [detectionResult, setDetectionResult] = useState<PhantomDetectionResult | null>(null)
  const [usageStats, setUsageStats] = useState<UsageStatsResult | null>(null)
  const [userAppliances, setUserAppliances] = useState<Array<{ type: string; rated_watts: number }>>([])
  const [totalMonthlyKwh, setTotalMonthlyKwh] = useState<number>(300) // Default fallback
  const [wasteData, setWasteData] = useState<Array<{ name: string; value: number; color: string }>>([])

  useEffect(() => {
    if (typeof window !== "undefined") {
      const setup = localStorage.getItem("powerPulseSetup")
      if (setup) {
        const data = JSON.parse(setup)
        setBudgetTarget(data.budgetTarget || 150)
      }
    }

    async function loadAppliances() {
      try {
        const appliances = await getAppliances()
        const mapped = appliances.map((app: { name: string; watt: number }) => ({
          type: APPLIANCE_TYPE_MAP[app.name] || app.name,
          rated_watts: app.watt || 0,
        }))
        setUserAppliances(mapped)
      } catch (err) {
        console.error("Failed to load appliances:", err)
      }
    }

    async function loadStats() {
      try {
        const stats = await getUsageStats()
        setUsageStats(stats)
        // Don't set default wasteData - only show chart after phantom load detection
      } catch (err) {
        console.error("ML service not available")
      }
    }

    async function loadProfileData() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('total_kwh_usage')
            .eq('id', user.id)
            .single()

          if (profile?.total_kwh_usage) {
            setTotalMonthlyKwh(profile.total_kwh_usage)
          }
        }
      } catch (err) {
        console.error("Failed to load profile data:", err)
      }
    }

    loadAppliances()
    loadStats()
    loadProfileData()
  }, [])

  const updateWasteChart = (detectedPhantomWatts: number) => {
    // Calculate phantom load as percentage of meter reading
    const meterReadingWatts = meterReading[0]
    const phantomPercent = meterReadingWatts > 0
      ? Math.min(100, (detectedPhantomWatts / meterReadingWatts) * 100)
      : 0

    // Calculate active usage as the remainder to maintain 100% total
    const activePercent = Math.max(0, 100 - phantomPercent)

    // Update the chart data (keep decimals, don't round)
    setWasteData([
      { name: "Active Usage", value: activePercent, color: "rgb(37 99 235)" },
      { name: "Phantom Load", value: phantomPercent, color: "rgb(234 179 8)" },
    ])
  }

  const handleScan = async () => {
    if (userAppliances.length === 0) return
    setIsScanning(true)
    try {
      const result = await predictPhantomLoad(meterReading[0], userAppliances)
      setDetectionResult(result)

      // Update the waste chart with detected phantom load
      if (result.is_valid_detection && result.total_phantom_watts > 0) {
        updateWasteChart(result.total_phantom_watts)
      }
    } catch (err) {
      console.error("ML service not available")
      setDetectionResult({
        input_reading_watts: meterReading[0],
        detected_appliances: [],
        total_phantom_watts: 0,
        error_margin: 0,
        is_valid_detection: false
      })
    } finally {
      setIsScanning(false)
    }
  }

  const budgetProgress = (currentUsage / budgetTarget) * 100
  const daysInMonth = 30
  const currentDay = new Date().getDate()
  const expectedUsage = (budgetTarget / daysInMonth) * currentDay
  const isOnTrack = currentUsage <= expectedUsage

  return (
    <AppShell>
      <div className="container max-w-6xl mx-auto px-4 py-6 md:py-8 space-y-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Energy Insights</h1>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Phantom Load Detector</CardTitle>
              <CardDescription>Simulate a smart meter reading to detect standby power waste</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Simulated Meter Reading</Label>
                    <span className="text-2xl font-bold text-primary">{meterReading[0]} W</span>
                  </div>
                  <Slider
                    value={meterReading}
                    onValueChange={setMeterReading}
                    min={0}
                    max={15}
                    step={0.5}
                    className="[&_[role=slider]]:bg-primary"
                  />
                  <p className="text-xs text-muted-foreground">
                    Simulate standby power reading (typical range: 1-10W)
                  </p>
                </div>
                <Button
                  onClick={handleScan}
                  disabled={isScanning || userAppliances.length === 0}
                  className="w-full"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Detect Phantom Load
                    </>
                  )}
                </Button>
              </div>

              {detectionResult && (
                <div className="space-y-3 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Detection Status</span>
                    <Badge variant={detectionResult.is_valid_detection ? "default" : "secondary"}>
                      {detectionResult.is_valid_detection ? "Match Found" : "No Match"}
                    </Badge>
                  </div>
                  {detectionResult.is_valid_detection && detectionResult.detected_appliances.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Devices in Standby:</p>
                      <div className="flex flex-wrap gap-2">
                        {detectionResult.detected_appliances.map((app) => (
                          <Badge key={app} variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                            <Zap className="h-3 w-3 mr-1" />
                            {app}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Estimated phantom load: <span className="font-semibold">{detectionResult.total_phantom_watts}W</span>
                      </p>
                    </div>
                  )}
                  {!detectionResult.is_valid_detection && (
                    <p className="text-sm text-muted-foreground">
                      Reading too high for phantom load detection. Typical standby power is under 10W total.
                      Try a lower value (1-10W range).
                    </p>
                  )}
                </div>
              )}

              {userAppliances.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No appliances configured. Complete setup first.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Energy Waste Analysis</CardTitle>
              <CardDescription>Where your energy is going (based on REFIT data)</CardDescription>
            </CardHeader>
            <CardContent>
              {wasteData.length > 0 ? (
                <>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={wasteData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ percent }) => `${((percent ?? 0) * 100).toFixed(2)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {wasteData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {wasteData.map((item, index) => (
                      <div key={index} className="flex flex-col items-center text-center">
                        <div className="w-3 h-3 rounded-full mb-1" style={{ backgroundColor: item.color }} />
                        <p className="text-xs font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.value.toFixed(2)}%</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  <p className="text-sm">Detect phantom load to see energy waste analysis</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Electric Appliance Efficiency</CardTitle>
            <CardDescription>Efficiency score based on your appliance wattage compared to efficient standards</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {userAppliances.map((app, index) => {
                // Map appliance names to efficiency constants keys
                let efficiencyKey: keyof typeof ApplianceEfficientMax | undefined;

                // Simple mapping based on string inclusion or exact match
                const nameLower = app.type.toLowerCase();
                if (nameLower.includes("air conditioner")) efficiencyKey = "air_conditioner";
                else if (nameLower.includes("fridge") || nameLower.includes("refrigerator")) efficiencyKey = "refrigerator";
                else if (nameLower.includes("washing machine")) efficiencyKey = "washing_machine";
                else if (nameLower.includes("television") || nameLower.includes("tv")) efficiencyKey = "television";
                else if (nameLower.includes("computer") || nameLower.includes("pc") || nameLower.includes("desktop")) efficiencyKey = "desktop_pc";
                else if (nameLower.includes("led light") || nameLower.includes("bulb")) efficiencyKey = "led_light";
                else if (nameLower.includes("fan")) efficiencyKey = "ceiling_fan";
                else if (nameLower.includes("charger")) efficiencyKey = "phone_charger";

                if (!efficiencyKey) return null;

                const efficientMax = ApplianceEfficientMax[efficiencyKey];
                // Formula:
                // If userWattage <= efficientMax -> 100
                // If userWattage > efficientMax -> (efficientMax / userWattage) * 100

                let score = 0;
                if (app.rated_watts <= efficientMax) {
                  score = 100;
                } else {
                  score = Math.max(0, (efficientMax / app.rated_watts) * 100);
                }

                let colorClass = "text-green-500";
                let progressClass = "[&>div]:bg-green-500";
                let statusText = "Excellent";

                if (score < 50) {
                  colorClass = "text-red-500";
                  progressClass = "[&>div]:bg-red-500";
                  statusText = "Inefficient";
                } else if (score < 75) {
                  colorClass = "text-yellow-500";
                  progressClass = "[&>div]:bg-yellow-500";
                  statusText = "Fair";
                }

                return (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className={cn("h-4 w-4", colorClass)} />
                        <span className="font-medium">{app.type}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-sm font-bold", colorClass)}>{score.toFixed(0)}/100</span>
                        <Badge variant="outline" className={cn("text-xs", colorClass.replace("text-", "border-").replace("500", "200"), "bg-transparent")}>
                          {statusText}
                        </Badge>
                      </div>
                    </div>
                    <Progress value={score} className={cn("h-2", progressClass)} />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Your: {app.rated_watts}W</span>
                      <span>Efficient Goal: &lt;{efficientMax}W</span>
                    </div>
                  </div>
                );
              })}
              {userAppliances.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No appliances found to analyze.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upgrade Recommendations for Inefficient Appliances */}
        {(() => {
          // Malaysian electricity rate (RM per kWh) - average domestic rate
          const electricityRate = 0.57;
          // Estimated average daily usage hours per appliance type
          const avgDailyHours: Record<string, number> = {
            air_conditioner: 6,
            refrigerator: 24,
            washing_machine: 1.5,
            television: 5,
            desktop_pc: 6,
            led_light: 8,
            ceiling_fan: 10,
            phone_charger: 3,
          };

          const inefficientAppliances = userAppliances
            .map((app) => {
              let efficiencyKey: keyof typeof ApplianceEfficientMax | undefined;
              const nameLower = app.type.toLowerCase();
              if (nameLower.includes("air conditioner")) efficiencyKey = "air_conditioner";
              else if (nameLower.includes("fridge") || nameLower.includes("refrigerator")) efficiencyKey = "refrigerator";
              else if (nameLower.includes("washing machine")) efficiencyKey = "washing_machine";
              else if (nameLower.includes("television") || nameLower.includes("tv")) efficiencyKey = "television";
              else if (nameLower.includes("computer") || nameLower.includes("pc") || nameLower.includes("desktop")) efficiencyKey = "desktop_pc";
              else if (nameLower.includes("led light") || nameLower.includes("bulb")) efficiencyKey = "led_light";
              else if (nameLower.includes("fan")) efficiencyKey = "ceiling_fan";
              else if (nameLower.includes("charger")) efficiencyKey = "phone_charger";

              if (!efficiencyKey) return null;

              const efficientMax = ApplianceEfficientMax[efficiencyKey];
              const score = app.rated_watts <= efficientMax ? 100 : Math.max(0, (efficientMax / app.rated_watts) * 100);

              if (score >= 50) return null;

              // Calculate savings
              const dailyHours = avgDailyHours[efficiencyKey] || 4;
              const wattDifference = app.rated_watts - efficientMax;
              const dailyKwhSavings = (wattDifference * dailyHours) / 1000;
              const yearlyKwhSavings = dailyKwhSavings * 365;
              const yearlyCostSavings = yearlyKwhSavings * electricityRate;

              return {
                type: app.type,
                currentWatts: app.rated_watts,
                efficientWatts: efficientMax,
                score,
                yearlyKwhSavings,
                yearlyCostSavings,
                efficiencyKey,
              };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);

          if (inefficientAppliances.length === 0) return null;

          const totalYearlyKwhSavings = inefficientAppliances.reduce((sum, app) => sum + app.yearlyKwhSavings, 0);
          const totalYearlyCostSavings = inefficientAppliances.reduce((sum, app) => sum + app.yearlyCostSavings, 0);

          return (
            <Card className="border-red-200 bg-red-50/30 dark:border-red-900/50 dark:bg-red-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <Zap className="h-5 w-5" />
                  Upgrade Recommendations
                </CardTitle>
                <CardDescription>
                  These appliances have efficiency below 50%. Upgrading them can significantly reduce your energy bills.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Individual Appliance Recommendations */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">Appliances to Upgrade:</h4>
                  {inefficientAppliances.map((app, index) => (
                    <div
                      key={index}
                      className="rounded-lg border bg-card p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                            <Zap className="h-4 w-4 text-red-500" />
                          </div>
                          <div>
                            <p className="font-medium">{app.type}</p>
                            <p className="text-xs text-muted-foreground">
                              Efficiency Score: {app.score.toFixed(0)}%
                            </p>
                          </div>
                        </div>
                        <Badge variant="destructive" className="text-xs">
                          Needs Upgrade
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Current</p>
                          <p className="font-semibold text-red-600 dark:text-red-400">{app.currentWatts}W</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Recommended</p>
                          <p className="font-semibold text-green-600 dark:text-green-400">≤{app.efficientWatts}W</p>
                        </div>
                      </div>

                      <div className="pt-2 border-t">
                        <p className="text-sm text-muted-foreground mb-2">If you upgrade:</p>
                        <div className="flex gap-4">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-sm">
                              <span className="font-semibold text-green-600 dark:text-green-400">
                                {app.yearlyKwhSavings.toFixed(0)} kWh
                              </span>{" "}
                              saved/year
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-sm">
                              <span className="font-semibold text-green-600 dark:text-green-400">
                                RM {app.yearlyCostSavings.toFixed(2)}
                              </span>{" "}
                              saved/year
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-4 border border-blue-200 dark:border-blue-900/50">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    💡 <strong>Tip:</strong> Look for appliances with 5-star energy ratings when shopping for replacements.
                    Inverter technology in ACs and refrigerators can provide even greater savings.
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })()}
      </div>
    </AppShell>
  )
}