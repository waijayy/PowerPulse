"use client"

import { useState, useEffect } from "react"
import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { TrendingUp, TrendingDown, Zap, Clock, Battery, AlertCircle, Search, Loader2 } from "lucide-react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { cn } from "@/lib/utils"
import { predictPhantomLoad, getUsageStats, type PhantomDetectionResult, type UsageStatsResult } from "@/lib/ml-api"
import { getAppliances } from "../appliances/actions"

const scheduleItems = [
  {
    time: "02:00 AM",
    appliance: "Electric Vehicle",
    icon: Battery,
    reason: "Lowest rates + Clean energy",
    status: "optimal",
  },
  {
    time: "10:30 PM",
    appliance: "Washing Machine",
    icon: Zap,
    reason: "Off-peak rates begin",
    status: "optimal",
  },
  {
    time: "11:00 AM - 2:00 PM",
    appliance: "Pool Pump",
    icon: Zap,
    reason: "Solar peak hours",
    status: "good",
  },
  {
    time: "Avoid 8:00 PM",
    appliance: "High-Power Appliances",
    icon: AlertCircle,
    reason: "Peak demand period",
    status: "warning",
  },
]

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
  const [wasteData, setWasteData] = useState([
    { name: "Active Usage", value: 65, color: "rgb(37 99 235)" },
    { name: "Phantom Load", value: 20, color: "rgb(234 179 8)" },
    { name: "Inefficient Appliances", value: 15, color: "rgb(239 68 68)" },
  ])

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
        if (stats.summary) {
          const activePercent = stats.summary.active_usage_percent || 65
          const phantomPercent = stats.summary.phantom_usage_percent || 20
          const inefficientPercent = Math.max(0, 100 - activePercent - phantomPercent)
          setWasteData([
            { name: "Active Usage", value: activePercent, color: "rgb(37 99 235)" },
            { name: "Phantom Load", value: phantomPercent, color: "rgb(234 179 8)" },
            { name: "Inefficient Appliances", value: inefficientPercent, color: "rgb(239 68 68)" },
          ])
        }
      } catch (err) {
        console.error("ML service not available, using default data")
      }
    }

    loadAppliances()
    loadStats()
  }, [])

  const handleScan = async () => {
    if (userAppliances.length === 0) return
    setIsScanning(true)
    try {
      const result = await predictPhantomLoad(meterReading[0], userAppliances)
      setDetectionResult(result)
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
          <h1 className="text-3xl font-bold tracking-tight mb-2">Energy Insights & Plan</h1>
          <p className="text-muted-foreground">Track your progress and optimize your energy usage schedule</p>
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
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={wasteData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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
              <div className="grid grid-cols-3 gap-2 mt-4">
                {wasteData.map((item, index) => (
                  <div key={index} className="flex flex-col items-center text-center">
                    <div className="w-3 h-3 rounded-full mb-1" style={{ backgroundColor: item.color }} />
                    <p className="text-xs font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.value.toFixed(1)}%</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Optimized Daily Schedule</CardTitle>
            <CardDescription>Recommended times to run appliances based on grid health and rates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {scheduleItems.map((item, index) => {
                const Icon = item.icon
                return (
                  <div
                    key={index}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-lg border-2 transition-colors",
                      item.status === "optimal" && "border-chart-1/20 bg-chart-1/5",
                      item.status === "good" && "border-chart-2/20 bg-chart-2/5",
                      item.status === "warning" && "border-chart-3/20 bg-chart-3/5",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-lg shrink-0",
                        item.status === "optimal" && "bg-chart-1/20 text-chart-1",
                        item.status === "good" && "bg-chart-2/20 text-chart-2",
                        item.status === "warning" && "bg-chart-3/20 text-chart-3",
                      )}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold">{item.appliance}</p>
                        {item.status === "optimal" && (
                          <Badge variant="outline" className="bg-chart-1/10 text-chart-1 border-chart-1/20">
                            Optimal
                          </Badge>
                        )}
                        {item.status === "warning" && (
                          <Badge variant="outline" className="bg-chart-3/10 text-chart-3 border-chart-3/20">
                            Avoid
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{item.reason}</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-medium shrink-0">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{item.time}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
