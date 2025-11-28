"use client"

import { useState, useEffect } from "react"
import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertTriangle, TrendingUp, Activity, Clock } from "lucide-react"
import { Area, AreaChart, Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts"
import { cn } from "@/lib/utils"

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

// Generate weekly data (last 7 days)
const generateWeeklyData = () => {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  return days.map((day, index) => ({
    label: day,
    usage: Math.random() * 6 + 16, // 16-22 kWh
    target: 20,
  }))
}

// Generate monthly data (last 30 days)
const generateMonthlyData = () => {
  const data = []
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    data.push({
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      usage: Math.random() * 6 + 16, // 16-22 kWh
      target: 20,
    })
  }
  return data
}

type GridStatus = "healthy" | "warning" | "critical"

const getGridStatus = (): GridStatus => {
  const hour = new Date().getHours()
  if (hour >= 18 && hour <= 22) {
    return Math.random() > 0.5 ? "critical" : "warning"
  } else if (hour >= 8 && hour <= 18) {
    return Math.random() > 0.7 ? "warning" : "healthy"
  }
  return "healthy"
}

export default function DashboardPage() {
  const [usageData, setUsageData] = useState(generateUsageData())
  const [gridStatus, setGridStatus] = useState<GridStatus>(getGridStatus())
  const [currentUsage, setCurrentUsage] = useState(85)
  const [budgetTarget, setBudgetTarget] = useState(150)
  const [viewMode, setViewMode] = useState<"week" | "month">("week")
  const [trendData, setTrendData] = useState(generateWeeklyData())

  useEffect(() => {
    const interval = setInterval(() => {
      setUsageData(generateUsageData())
      setGridStatus(getGridStatus())
      setCurrentUsage((prev) => Math.min(prev + Math.random() * 2 - 0.5, 100))
    }, 5000)

    if (typeof window !== "undefined") {
      const setup = localStorage.getItem("powerPulseSetup")
      if (setup) {
        const data = JSON.parse(setup)
        setBudgetTarget(data.budgetTarget || 150)
      }
    }

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    // Update trend data when view mode changes
    if (viewMode === "week") {
      setTrendData(generateWeeklyData())
    } else {
      setTrendData(generateMonthlyData())
    }
  }, [viewMode])

  const budgetProgress = (currentUsage / budgetTarget) * 100
  const isNearLimit = budgetProgress > 75

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
          <Card className={cn("border-2", currentGridConfig.borderColor)}>
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

        {gridStatus === "critical" && (
          <Alert variant="destructive">
            <AlertTriangle className="h-5 w-5" />
            <AlertTitle>Peak Hour Alert</AlertTitle>
            <AlertDescription>
              Grid stress detected. Consider delaying high-energy tasks like laundry to save costs and reduce carbon
              emissions.
            </AlertDescription>
          </Alert>
        )}

        {/* Live Usage Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Live Energy Consumption</CardTitle>
                <CardDescription>Real-time usage vs. your budget limit</CardDescription>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Last 2 hours</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={usageData}>
                  <defs>
                    <linearGradient id="usageGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="rgb(37 99 235)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="rgb(37 99 235)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(148 163 184 / 0.2)" />
                  <XAxis dataKey="time" stroke="rgb(100 116 139)" fontSize={12} tickLine={false} />
                  <YAxis
                    stroke="rgb(100 116 139)"
                    fontSize={12}
                    tickLine={false}
                    label={{ value: "kW", angle: -90, position: "insideLeft", style: { fontSize: 12 } }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgb(255 255 255)",
                      border: "1px solid rgb(226 232 240)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <ReferenceLine
                    y={4.5}
                    stroke="rgb(239 68 68)"
                    strokeDasharray="5 5"
                    label={{ value: "Budget Limit", position: "right", fill: "rgb(239 68 68)", fontSize: 12 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="usage"
                    stroke="rgb(37 99 235)"
                    strokeWidth={2}
                    fill="url(#usageGradient)"
                    name="Current Usage (kW)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Usage Trend Line Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{viewMode === "week" ? "Weekly" : "Monthly"} Usage Trend</CardTitle>
                <CardDescription>
                  Your daily consumption over the past {viewMode === "week" ? "week" : "month"}
                </CardDescription>
              </div>
              <Select value={viewMode} onValueChange={(value: "week" | "month") => setViewMode(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <defs>
                    <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="rgb(16 185 129)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="rgb(16 185 129)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(148 163 184 / 0.2)" />
                  <XAxis 
                    dataKey="label" 
                    stroke="rgb(100 116 139)" 
                    fontSize={12} 
                    tickLine={false}
                    interval={viewMode === "month" ? 4 : 0}
                  />
                  <YAxis
                    stroke="rgb(100 116 139)"
                    fontSize={12}
                    tickLine={false}
                    label={{ value: "kWh", angle: -90, position: "insideLeft", style: { fontSize: 12 } }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgb(255 255 255)",
                      border: "1px solid rgb(226 232 240)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <ReferenceLine
                    y={20}
                    stroke="rgb(239 68 68)"
                    strokeDasharray="5 5"
                    label={{ value: "Target", position: "right", fill: "rgb(239 68 68)", fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="usage"
                    stroke="rgb(16 185 129)"
                    strokeWidth={2}
                    dot={{ fill: "rgb(16 185 129)", r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Usage (kWh)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
