"use client"

import { useState, useEffect } from "react"
import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { TrendingUp, TrendingDown, Zap, Clock, Battery, AlertCircle, Loader2, Activity, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { cn } from "@/lib/utils"

const scheduleItems = [
  {
    time: "Always",
    appliance: "Smart Plugs",
    icon: Zap,
    reason: "Use smart plugs to cut power to devices in standby mode",
    status: "optimal",
  },
  {
    time: "Night",
    appliance: "Entertainment Center",
    icon: Activity,
    reason: "Turn off power strips for TV/Gaming consoles overnight",
    status: "optimal",
  },
  {
    time: "When Charged",
    appliance: "Chargers",
    icon: Battery,
    reason: "Unplug phone/laptop chargers when devices are fully charged",
    status: "good",
  },
  {
    time: "Daily",
    appliance: "Old Appliances",
    icon: AlertCircle,
    reason: "Consider upgrading older appliances with high standby power",
    status: "warning",
  },
]

export default function InsightsPage() {
  const [currentUsage, setCurrentUsage] = useState(85)
  const [budgetTarget, setBudgetTarget] = useState(150)
  const [phantomPercentage, setPhantomPercentage] = useState<number | null>(null)
  const [phantomDetected, setPhantomDetected] = useState(false)
  const [isLoadingPhantom, setIsLoadingPhantom] = useState(true)
  const [phantomCount, setPhantomCount] = useState<number>(0)
  const [totalReadings, setTotalReadings] = useState<number>(0)
  const [isReanalyzing, setIsReanalyzing] = useState(false)
  const [isSimulationMode, setIsSimulationMode] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const setup = localStorage.getItem("powerPulseSetup")
      if (setup) {
        const data = JSON.parse(setup)
        setBudgetTarget(data.budgetTarget || 150)
      }
    }
  }, [])

  const fetchPhantomData = async (useSimulation: boolean = false, targetPhantom: number = 20) => {
    setIsLoadingPhantom(true)
    try {
      // Build URL with optional simulation parameters
      const url = useSimulation 
        ? `/api/phantom?simulate=true&phantom=${targetPhantom}`
        : "/api/phantom"
      
      const response = await fetch(url)
      
      // Check if response is ok before parsing JSON
      if (!response.ok) {
        // If not authenticated or other error, try to get error message
        let errorData
        try {
          errorData = await response.json()
        } catch {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` }
        }
        console.error("Phantom API error:", errorData)
        
        // Use fallback simulation data if API fails
        // This ensures the page still works even if the API is down
        setPhantomPercentage(null)
        setPhantomDetected(false)
        setPhantomCount(0)
        setTotalReadings(0)
        setIsSimulationMode(false)
        return
      }
      
      const data = await response.json()
      
      if (data.phantom_percentage !== undefined) {
        setPhantomPercentage(data.phantom_percentage)
        setPhantomDetected(data.phantom_detected || false)
        setPhantomCount(data.phantom_count || 0)
        setTotalReadings(data.total_readings || 0)
        setIsSimulationMode(data.simulated === true || data.fallback === true)
      } else {
        // If response doesn't have expected format, use defaults
        console.warn("Unexpected response format from phantom API:", data)
        setPhantomPercentage(null)
        setPhantomDetected(false)
        setPhantomCount(0)
        setTotalReadings(0)
        setIsSimulationMode(false)
      }
    } catch (error) {
      console.error("Failed to fetch phantom data:", error)
      // Use default values on error - this allows the page to still render
      setPhantomPercentage(null)
      setPhantomDetected(false)
      setPhantomCount(0)
      setTotalReadings(0)
      setIsSimulationMode(false)
    } finally {
      setIsLoadingPhantom(false)
    }
  }

  useEffect(() => {
    // Check URL parameters for simulation mode (for testing)
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const useSimulation = params.get('simulate') === 'true'
      const targetPhantom = parseFloat(params.get('phantom') || '20')
      
      fetchPhantomData(useSimulation, targetPhantom)
    } else {
      fetchPhantomData()
    }
  }, [])

  const handleReanalyze = async () => {
    setIsReanalyzing(true)
    // Check if simulation mode is enabled via URL parameter
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const useSimulation = params.get('simulate') === 'true'
      const targetPhantom = parseFloat(params.get('phantom') || '20')
      await fetchPhantomData(useSimulation, targetPhantom)
    } else {
      await fetchPhantomData()
    }
    setIsReanalyzing(false)
  }

  const budgetProgress = (currentUsage / budgetTarget) * 100
  const daysInMonth = 30
  const currentDay = new Date().getDate()
  const expectedUsage = (budgetTarget / daysInMonth) * currentDay
  const isOnTrack = currentUsage <= expectedUsage

  // Calculate waste data with real phantom load percentage
  const phantomValue = phantomPercentage !== null ? Math.round(phantomPercentage) : 20
  const activeUsageValue = Math.max(0, 100 - phantomValue - 15) // Reserve 15% for inefficient appliances
  const inefficientValue = 100 - activeUsageValue - phantomValue

  const wasteData = [
    { name: "Active Usage", value: activeUsageValue, color: "rgb(37 99 235)" },
    { name: "Phantom Load", value: phantomValue, color: "rgb(234 179 8)" },
    { name: "Inefficient Appliances", value: inefficientValue, color: "rgb(239 68 68)" },
  ]

  return (
    <AppShell>
      <div className="container max-w-6xl mx-auto px-4 py-6 md:py-8 space-y-6">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight">Energy Insights & Plan</h1>
            {isSimulationMode && (
              <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800">
                Simulation Mode
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">Track your progress and optimize your energy usage schedule</p>
        </div>

        {/* Phantom Load Detection Alert Card */}
        {!isLoadingPhantom && phantomDetected && phantomPercentage !== null && phantomPercentage > 0 && (
          <Card className="border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/50 shrink-0">
                  <Activity className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100 mb-2">
                    Phantom Load Detected
                  </h3>
                  <p className="text-sm text-amber-800 dark:text-amber-200 mb-4">
                    Our AI detected {phantomPercentage.toFixed(1)}% phantom load in your recent energy usage. 
                    {totalReadings > 0 && (
                      <> This represents {phantomCount} out of {totalReadings} readings showing standby power consumption.</>
                    )}
                  </p>
                  {totalReadings > 0 && (
                    <div className="mb-4 space-y-2">
                      <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-300">
                        <span className="font-medium">Phantom Load Readings</span>
                        <span className="font-semibold">{phantomCount} / {totalReadings}</span>
                      </div>
                      <Progress 
                        value={(phantomCount / totalReadings) * 100} 
                        className="h-2 bg-amber-200 dark:bg-amber-900/30 [&>div]:bg-amber-500 dark:[&>div]:bg-amber-400"
                      />
                      <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400">
                        <span>Phantom Load</span>
                        <span>Normal Load</span>
                      </div>
                    </div>
                  )}
                  <Button
                    onClick={handleReanalyze}
                    disabled={isReanalyzing}
                    variant="outline"
                    className="border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                  >
                    {isReanalyzing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Re-analyze Now
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Budget Progress</CardTitle>
              <CardDescription>Your monthly spending vs. target</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Current Spending</p>
                    <p className="text-3xl font-bold">RM {currentUsage.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Target</p>
                    <p className="text-2xl font-semibold text-muted-foreground">RM {budgetTarget}</p>
                  </div>
                </div>
                <Progress
                  value={budgetProgress}
                  className={cn(
                    "h-3",
                    budgetProgress > 90
                      ? "[&>div]:bg-chart-3"
                      : budgetProgress > 75
                        ? "[&>div]:bg-chart-4"
                        : "[&>div]:bg-chart-1",
                  )}
                />
                <p className="text-sm text-muted-foreground">{budgetProgress.toFixed(1)}% of budget used</p>
              </div>

              <div
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg",
                  isOnTrack ? "bg-chart-1/10 text-chart-1" : "bg-chart-3/10 text-chart-3",
                )}
              >
                {isOnTrack ? (
                  <>
                    <TrendingDown className="h-5 w-5" />
                    <div>
                      <p className="font-semibold text-sm">On Track</p>
                      <p className="text-xs opacity-90">You're using less than expected for day {currentDay}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-5 w-5" />
                    <div>
                      <p className="font-semibold text-sm">Above Target</p>
                      <p className="text-xs opacity-90">Consider reducing usage to stay within budget</p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Energy Waste Analysis</CardTitle>
              <CardDescription>Where your energy is going</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingPhantom ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Analyzing phantom load...</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={wasteData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
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
                        <p className="text-xs text-muted-foreground">{item.value}%</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recommendation to reduce phantom load</CardTitle>
            <CardDescription>Simple steps to reduce your standby power consumption</CardDescription>
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
