"use client"

import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock } from "lucide-react"

type LiveUsageChartProps = {
  data: Array<{
    time: string
    usage: number
    limit: number
  }>
}

export function LiveUsageChart({ data }: LiveUsageChartProps) {
  return (
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
            <AreaChart data={data}>
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
  )
}
