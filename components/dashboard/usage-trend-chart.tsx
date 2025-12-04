"use client"

import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Brain, TrendingUp } from "lucide-react"

type UsageTrendChartProps = {
  data: Array<{
    label: string
    predicted: number
  }>
  budgetTarget?: number
  isLoading?: boolean
}

export function UsageTrendChart({
  data,
  budgetTarget = 150,
  isLoading = false
}: UsageTrendChartProps) {
  // Calculate average daily usage based on budget target
  // Assuming average electricity rate of RM 0.30/kWh
  const avgRatePerKwh = 0.30
  const avgDailyBudget = budgetTarget / 30 // Daily budget in RM
  const avgDailyUsageKwh = avgDailyBudget / avgRatePerKwh // Convert to kWh

  const hasData = data && data.length > 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Weekly Usage Forecast
              <span className="flex items-center gap-1 text-xs font-normal text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
                <Brain className="h-3 w-3" />
                AI Powered
              </span>
            </CardTitle>
            <CardDescription>
              Predicted daily consumption for the next 7 days
            </CardDescription>
          </div>
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
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground border-t pt-3">
          <TrendingUp className="h-4 w-4 text-blue-500" />
          <span>Predictions generated by LSTM neural network based on historical usage patterns</span>
        </div>
      </CardContent>
    </Card>
  )
}
