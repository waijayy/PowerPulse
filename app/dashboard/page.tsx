"use client"

import { useState, useEffect } from "react"
import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle, TrendingUp, Activity, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { LiveUsageChart } from "@/components/dashboard/live-usage-chart"
import { UsageTrendChart } from "@/components/dashboard/usage-trend-chart"
import { createClient } from "@/utils/supabase/client"
import { getUsageStats, type UsageStatsResult } from "@/lib/ml-api"

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

const generateWeeklyDataFromStats = (stats: UsageStatsResult | null) => {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  if (!stats || !stats.appliances) {
    return days.map((day) => ({
      label: day,
      usage: Math.random() * 6 + 16,
      target: 20,
    }))
  }
  
  const totalActiveHours = stats.summary?.total_active_hours || 100
  const avgDailyUsage = totalActiveHours / 7
  
  return days.map((day, index) => ({
    label: day,
    usage: avgDailyUsage * (0.8 + Math.random() * 0.4),
    target: 20,
  }))
}

const generateMonthlyDataFromStats = (stats: UsageStatsResult | null) => {
  const data = []
  const now = new Date()
  
  const baseUsage = stats?.summary?.total_active_hours 
    ? stats.summary.total_active_hours / 30 
    : 18
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    data.push({
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      usage: baseUsage * (0.7 + Math.random() * 0.6),
      target: 20,
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
  const [viewMode, setViewMode] = useState<"week" | "month">("week")
  const [trendData, setTrendData] = useState<Array<{ label: string; usage: number; target: number }>>([])
  const [mlStats, setMlStats] = useState<UsageStatsResult | null>(null)
  const [phantomHours, setPhantomHours] = useState(0)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    setUsageData(generateUsageData())
    setGridStatus(getGridStatus())
    
    const interval = setInterval(() => {
      setUsageData(generateUsageData())
      setGridStatus(getGridStatus())
      setCurrentUsage((prev) => Math.min(prev + Math.random() * 2 - 0.5, 100))
    }, 5000)

    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from('profiles')
          .select('monthly_budget_target')
          .eq('id', user.id)
          .single()
          .then(({ data: profile }) => {
            if (profile?.monthly_budget_target) {
              setBudgetTarget(profile.monthly_budget_target)
            }
          })
      }
    })

    async function loadMLStats() {
      try {
        const stats = await getUsageStats()
        setMlStats(stats)
        if (stats.summary) {
          setPhantomHours(stats.summary.total_phantom_hours || 0)
        }
        setTrendData(generateWeeklyDataFromStats(stats))
      } catch (err) {
        console.error("ML service not available, using fallback data")
        setTrendData(generateWeeklyDataFromStats(null))
      }
    }
    loadMLStats()

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (viewMode === "week") {
      setTrendData(generateWeeklyDataFromStats(mlStats))
    } else {
      setTrendData(generateMonthlyDataFromStats(mlStats))
    }
  }, [viewMode, mlStats])

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

          <Card className="border-2 border-yellow-500/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium">Phantom Load Sources</CardTitle>
                <Zap className="h-5 w-5 text-yellow-500" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {mlStats?.appliances ? (
                <>
                  <div className="space-y-2">
                    {Object.entries(mlStats.appliances)
                      .filter(([_, data]: [string, any]) => data.wasted_kwh > 0.1)
                      .sort((a: any, b: any) => b[1].wasted_kwh - a[1].wasted_kwh)
                      .slice(0, 3)
                      .map(([name, data]: [string, any]) => (
                        <div key={name} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{name}</span>
                          <Badge variant="outline" className="text-yellow-600 bg-yellow-500/10">
                            {data.wasted_kwh.toFixed(2)} kWh wasted
                          </Badge>
                        </div>
                      ))}
                  </div>
                  <p className="text-xs text-muted-foreground pt-2 border-t">
                    Appliances wasting energy in standby mode
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Loading ML data...</p>
              )}
            </CardContent>
          </Card>
        </div>

        <LiveUsageChart data={usageData} />

        <UsageTrendChart 
          data={trendData} 
          viewMode={viewMode} 
          onViewModeChange={setViewMode}
          budgetTarget={budgetTarget}
        />
      </div>
    </AppShell>
  )
}
