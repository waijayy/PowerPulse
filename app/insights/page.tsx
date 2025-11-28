"use client"

import { useState, useEffect } from "react"
import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { TrendingUp, TrendingDown, Zap, Clock, Battery, AlertCircle } from "lucide-react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { cn } from "@/lib/utils"

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

const wasteData = [
  { name: "Active Usage", value: 65, color: "rgb(37 99 235)" },
  { name: "Phantom Load", value: 20, color: "rgb(234 179 8)" },
  { name: "Inefficient Appliances", value: 15, color: "rgb(239 68 68)" },
]

export default function InsightsPage() {
  const [currentUsage, setCurrentUsage] = useState(85)
  const [budgetTarget, setBudgetTarget] = useState(150)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const setup = localStorage.getItem("powerPulseSetup")
      if (setup) {
        const data = JSON.parse(setup)
        setBudgetTarget(data.budgetTarget || 150)
      }
    }
  }, [])

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
                    <p className="text-xs text-muted-foreground">{item.value}%</p>
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
