"use client"

import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type UsageTrendChartProps = {
  data: Array<{
    label: string
    usage: number
    target: number
  }>
  viewMode: "week" | "month"
  onViewModeChange: (mode: "week" | "month") => void
  budgetTarget?: number
}

export function UsageTrendChart({ data, viewMode, onViewModeChange, budgetTarget = 150 }: UsageTrendChartProps) {
  // Calculate average daily usage based on budget target
  // Assuming average electricity rate of RM 0.30/kWh
  const avgRatePerKwh = 0.30
  const avgDailyBudget = budgetTarget / 30 // Daily budget in RM
  const avgDailyUsageKwh = avgDailyBudget / avgRatePerKwh // Convert to kWh

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{viewMode === "week" ? "Weekly" : "Monthly"} Usage Trend</CardTitle>
            <CardDescription>
              Your daily consumption over the past {viewMode === "week" ? "week" : "month"}
            </CardDescription>
          </div>
          <Select value={viewMode} onValueChange={(value: "week" | "month") => onViewModeChange(value)}>
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
            <LineChart data={data}>
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
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div style={{
                        backgroundColor: "rgb(255 255 255)",
                        border: "1px solid rgb(226 232 240)",
                        borderRadius: "8px",
                        padding: "8px 12px",
                        fontSize: "12px",
                      }}>
                        <p style={{ margin: 0, marginBottom: "4px" }}>
                          <strong>{payload[0].payload.label}</strong>
                        </p>
                        <p style={{ margin: 0, color: "rgb(16 185 129)" }}>
                          Usage: {payload[0].value} kWh
                        </p>
                        <p style={{ margin: 0, color: "rgb(239 68 68)", marginTop: "4px" }}>
                          Recommended: {avgDailyUsageKwh.toFixed(1)} kWh (RM{budgetTarget}/mo)
                        </p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              {/* Recommended daily usage based on budget */}
              <ReferenceLine
                y={avgDailyUsageKwh}
                stroke="rgb(239 68 68)"
                strokeDasharray="3 3"
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
  )
}
