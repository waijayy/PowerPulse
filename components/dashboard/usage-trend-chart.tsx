"use client"

import { Line, LineChart, Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Brain, TrendingUp, Calendar, CalendarDays } from "lucide-react"

type UsageTrendChartProps = {
  data: Array<{
    label: string
    predicted: number
  }>
  budgetTarget?: number
  isLoading?: boolean
  forecastView?: "weekly" | "monthly"
  onForecastViewChange?: (view: "weekly" | "monthly") => void
}

export function UsageTrendChart({
  data,
  budgetTarget = 150,
  isLoading = false,
  forecastView = "weekly",
  onForecastViewChange
}: UsageTrendChartProps) {
  // Calculate average daily usage based on budget target
  // Assuming average electricity rate of RM 0.30/kWh
  const avgRatePerKwh = 0.30
  const avgDailyBudget = budgetTarget / 30 // Daily budget in RM
  const avgDailyUsageKwh = avgDailyBudget / avgRatePerKwh // Convert to kWh

  const hasData = data && data.length > 0
  const isMonthly = forecastView === "monthly"

  const title = isMonthly ? "Monthly Usage Forecast" : "Weekly Usage Forecast"
  const description = isMonthly
    ? "Predicted energy consumption for the next 6 months"
    : "Predicted daily consumption for the next 7 days"

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {title}
              <span className="flex items-center gap-1 text-xs font-normal text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
                <Brain className="h-3 w-3" />
                AI Powered
              </span>
            </CardTitle>
            <CardDescription>
              {description}
            </CardDescription>
          </div>
          {onForecastViewChange && (
            <div className="flex rounded-lg border overflow-hidden">
              <Button
                variant={forecastView === "weekly" ? "default" : "ghost"}
                size="sm"
                onClick={() => onForecastViewChange("weekly")}
                className="rounded-none gap-1"
              >
                <CalendarDays className="h-4 w-4" />
                Weekly
              </Button>
              <Button
                variant={forecastView === "monthly" ? "default" : "ghost"}
                size="sm"
                onClick={() => onForecastViewChange("monthly")}
                className="rounded-none gap-1"
              >
                <Calendar className="h-4 w-4" />
                Monthly
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80 relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10 rounded-lg">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin h-8 w-8 border-3 border-blue-500 border-t-transparent rounded-full" />
                <span className="text-sm text-muted-foreground">Generating AI predictions...</span>
              </div>
            </div>
          )}
          {!hasData && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Brain className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Loading predictions...</p>
              </div>
            </div>
          )}
          <ResponsiveContainer width="100%" height="100%">
            {isMonthly ? (
              <LineChart data={data}>
                <defs>
                  <linearGradient id="monthlyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="rgb(34 197 94)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="rgb(34 197 94)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(148 163 184 / 0.2)" />
                <XAxis
                  dataKey="label"
                  stroke="rgb(100 116 139)"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis
                  stroke="rgb(100 116 139)"
                  fontSize={12}
                  tickLine={false}
                  label={{ value: "kWh", angle: -90, position: "insideLeft", style: { fontSize: 12 } }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const dataPoint = payload[0].payload
                      return (
                        <div style={{
                          backgroundColor: "rgb(255 255 255)",
                          border: "1px solid rgb(226 232 240)",
                          borderRadius: "8px",
                          padding: "10px 14px",
                          fontSize: "12px",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                        }}>
                          <p style={{ margin: 0, marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                            <strong>{dataPoint.label}</strong>
                            <span style={{
                              backgroundColor: "rgb(220 252 231)",
                              color: "rgb(34 197 94)",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              fontSize: "10px",
                              fontWeight: 500
                            }}>
                              AI Predicted
                            </span>
                          </p>
                          <p style={{ margin: 0, color: "rgb(34 197 94)", fontSize: "14px", fontWeight: 600 }}>
                            {dataPoint.predicted?.toFixed(0)} kWh
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Line
                  type="linear"
                  dataKey="predicted"
                  stroke="rgb(34 197 94)"
                  strokeWidth={3}
                  dot={{ fill: "rgb(34 197 94)", r: 5, strokeWidth: 2, stroke: "white" }}
                  activeDot={{ r: 7, fill: "rgb(34 197 94)", stroke: "white", strokeWidth: 2 }}
                  name="Predicted Usage (kWh)"
                />
              </LineChart>
            ) : (
              <LineChart data={data}>
                <defs>
                  <linearGradient id="predictionGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="rgb(59 130 246)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="rgb(59 130 246)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(148 163 184 / 0.2)" />
                <XAxis
                  dataKey="label"
                  stroke="rgb(100 116 139)"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis
                  stroke="rgb(100 116 139)"
                  fontSize={12}
                  tickLine={false}
                  label={{ value: "kWh", angle: -90, position: "insideLeft", style: { fontSize: 12 } }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const dataPoint = payload[0].payload
                      return (
                        <div style={{
                          backgroundColor: "rgb(255 255 255)",
                          border: "1px solid rgb(226 232 240)",
                          borderRadius: "8px",
                          padding: "10px 14px",
                          fontSize: "12px",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                        }}>
                          <p style={{ margin: 0, marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                            <strong>{dataPoint.label}</strong>
                            <span style={{
                              backgroundColor: "rgb(219 234 254)",
                              color: "rgb(59 130 246)",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              fontSize: "10px",
                              fontWeight: 500
                            }}>
                              AI Predicted
                            </span>
                          </p>
                          <p style={{ margin: 0, color: "rgb(59 130 246)", fontSize: "14px", fontWeight: 600 }}>
                            {dataPoint.predicted?.toFixed(1)} kWh
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                {/* Predicted usage line - Blue solid straight line */}
                <Line
                  type="linear"
                  dataKey="predicted"
                  stroke="rgb(59 130 246)"
                  strokeWidth={3}
                  dot={{ fill: "rgb(59 130 246)", r: 5, strokeWidth: 2, stroke: "white" }}
                  activeDot={{ r: 7, fill: "rgb(59 130 246)", stroke: "white", strokeWidth: 2 }}
                  name="Predicted Usage (kWh)"
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

