"use client"

import { useState, useEffect } from "react"
import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle, TrendingUp, Activity, Clock } from "lucide-react"
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts"
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

const weeklyTrend = [
  { day: "Mon", usage: 18.5, target: 20 },
  { day: "Tue", usage: 17.2, target: 20 },
  { day: "Wed", usage: 19.8, target: 20 },
  { day: "Thu", usage: 16.3, target: 20 },
  { day: "Fri", usage: 21.5, target: 20 },
  { day: "Sat", usage: 22.8, target: 20 },
  { day: "Sun", usage: 20.1, target: 20 },
]

export default function DashboardPage() {
  const [usageData, setUsageData] = useState(generateUsageData())
  const [gridStatus, setGridStatus] = useState<GridStatus>(getGridStatus())
  const [currentUsage, setCurrentUsage] = useState(85)
  const [budgetTarget, setBudgetTarget] = useState(150)

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

        <Card>
          <CardHeader>
            <CardTitle>Weekly Usage Trend</CardTitle>
            <CardDescription>Your daily consumption over the past week</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {weeklyTrend.map((day, index) => {
                const isOverTarget = day.usage > day.target
                const percentage = (day.usage / day.target) * 100
                return (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium w-12">{day.day}</span>
                      <span className={cn("font-semibold", isOverTarget ? "text-chart-3" : "text-chart-1")}>
                        {day.usage} kWh
                      </span>
                    </div>
                    <div className="relative">
                      <Progress
                        value={percentage}
                        className={cn("h-2", isOverTarget ? "[&>div]:bg-chart-3" : "[&>div]:bg-chart-1")}
                      />
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
