"use client"

import { useState, useEffect } from "react"
import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Zap, Calculator, TrendingUp, Loader2 } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { disaggregateEnergy, type DisaggregateResult, type ApplianceItem } from "@/lib/ml-api"
import { getAppliances } from "../appliances/actions"

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(220, 70%, 50%)",
  "hsl(280, 65%, 60%)",
  "hsl(340, 75%, 55%)",
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

export default function BreakdownPage() {
  const [totalKwh, setTotalKwh] = useState<string>("300")
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<DisaggregateResult | null>(null)
  const [userAppliances, setUserAppliances] = useState<ApplianceItem[]>([])
  const [applianceDetails, setApplianceDetails] = useState<Array<{name: string, quantity: number, watt: number}>>([])

  useEffect(() => {
    async function loadAppliances() {
      try {
        const appliances = await getAppliances()
        setApplianceDetails(appliances)
        const mapped = appliances.map((app: { name: string; quantity: number; watt: number }) => ({
          type: APPLIANCE_TYPE_MAP[app.name] || app.name,
          quantity: app.quantity || 1,
          rated_watts: app.watt || 0,
        }))
        setUserAppliances(mapped)
      } catch (err) {
        console.error("Failed to load appliances:", err)
      }
    }
    loadAppliances()
  }, [])

  const handleAnalyze = async () => {
    if (userAppliances.length === 0) return
    const kwh = parseFloat(totalKwh)
    if (isNaN(kwh) || kwh <= 0) return

    setIsLoading(true)
    try {
      const data = await disaggregateEnergy(kwh, userAppliances)
      setResult(data)
    } catch (err) {
      console.error("Failed to analyze:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const chartData = result?.breakdown.map((item, index) => ({
    name: item.type,
    kwh: item.estimated_kwh,
    cost: item.estimated_cost_rm,
    fill: COLORS[index % COLORS.length],
  })) || []

  return (
    <AppShell>
      <div className="container max-w-6xl mx-auto px-4 py-6 md:py-8 space-y-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Energy Breakdown</h1>
          <p className="text-muted-foreground">Analyze how your total electricity consumption is distributed across appliances</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Input
              </CardTitle>
              <CardDescription>Enter your monthly electricity usage</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="total-kwh">Total Consumption (kWh)</Label>
                <Input
                  id="total-kwh"
                  type="number"
                  value={totalKwh}
                  onChange={(e) => setTotalKwh(e.target.value)}
                  placeholder="e.g., 300"
                />
                <p className="text-xs text-muted-foreground">
                  Check your TNB bill for monthly kWh
                </p>
              </div>

              <div className="space-y-2">
                <Label>Your Appliances ({userAppliances.length})</Label>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {applianceDetails.map((app, i) => (
                    <div key={i} className="text-sm flex justify-between text-muted-foreground">
                      <span>{app.name} x{app.quantity}</span>
                      <span>{app.watt}W</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button 
                onClick={handleAnalyze} 
                disabled={isLoading || userAppliances.length === 0}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Analyze Breakdown
                  </>
                )}
              </Button>

              {userAppliances.length === 0 && (
                <p className="text-sm text-destructive">
                  No appliances found. Complete setup first.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Consumption by Appliance</CardTitle>
              <CardDescription>Estimated energy usage breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              {result ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" unit=" kWh" />
                      <YAxis type="category" dataKey="name" width={75} tick={{ fontSize: 12 }} />
                      <Tooltip 
                        formatter={(value: number) => [`${value.toFixed(2)} kWh`, "Usage"]}
                      />
                      <Bar dataKey="kwh" radius={[0, 4, 4, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Enter your total kWh and click Analyze
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {result && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Detailed Breakdown
                </CardTitle>
                <CardDescription>
                  Based on {result.total_kwh} kWh total consumption
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {result.breakdown.map((item, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="font-medium">{item.type}</span>
                          {item.quantity > 1 && (
                            <Badge variant="outline">x{item.quantity}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">{item.rated_watts}W</span>
                          <span className="text-muted-foreground">{item.usage_hours_per_day}h/day</span>
                          <span className="font-semibold">{item.estimated_kwh} kWh</span>
                          <Badge variant="secondary">RM {item.estimated_cost_rm}</Badge>
                        </div>
                      </div>
                      <Progress 
                        value={item.share_percent} 
                        className="h-2"
                      />
                      <p className="text-xs text-muted-foreground text-right">
                        {item.share_percent}% of total
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Top Consumer</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{result.summary.top_consumer}</div>
                  <p className="text-sm text-muted-foreground">
                    {result.summary.top_consumer_percent}% of your bill
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Total Analyzed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{result.total_kwh} kWh</div>
                  <p className="text-sm text-muted-foreground">
                    Across {result.summary.appliance_count} appliances
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Estimated Bill</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    RM {(result.total_kwh * 0.218).toFixed(2)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Based on TNB tariff RM 0.218/kWh
                  </p>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
