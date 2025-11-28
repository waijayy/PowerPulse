"use client"

import { useState, useEffect } from "react"
import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Lightbulb, TrendingDown, Clock, Info } from "lucide-react"

const PEAK_RATE = 0.57
const OFF_PEAK_RATE = 0.31

type ApplianceData = {
  id: string
  count: number
  kwh: number
  alwaysOn: boolean
}

type ApplianceUsage = {
  id: string
  dailyHours: number
  offPeakHours: number
}

export default function AuditPage() {
  const [appliances, setAppliances] = useState<ApplianceData[]>([])
  const [selectedAppliances, setSelectedAppliances] = useState<Set<string>>(new Set())
  const [usageData, setUsageData] = useState<Record<string, ApplianceUsage>>({})

  useEffect(() => {
    if (typeof window !== "undefined") {
      const setup = localStorage.getItem("powerPulseSetup")
      if (setup) {
        const data = JSON.parse(setup)
        if (data.appliances) {
          const applianceArray = Object.values(data.appliances) as ApplianceData[]
          setAppliances(applianceArray)
        }
      }
    }
  }, [])

  const getApplianceName = (id: string) => {
    const names: Record<string, string> = {
      ac: "Air Conditioner",
      fridge: "Refrigerator",
      washer: "Washing Machine",
      tv: "Television",
      pc: "Computer/PC",
      lights: "LED Lights",
      microwave: "Microwave",
      fan: "Ceiling Fan",
    }
    return names[id] || id.replace(/-/g, " ")
  }

  const toggleAppliance = (id: string) => {
    const newSelected = new Set(selectedAppliances)
    if (newSelected.has(id)) {
      newSelected.delete(id)
      const newUsageData = { ...usageData }
      delete newUsageData[id]
      setUsageData(newUsageData)
    } else {
      newSelected.add(id)
      setUsageData({
        ...usageData,
        [id]: { id, dailyHours: 0, offPeakHours: 0 },
      })
    }
    setSelectedAppliances(newSelected)
  }

  const updateUsage = (id: string, field: "dailyHours" | "offPeakHours", value: number) => {
    setUsageData({
      ...usageData,
      [id]: {
        ...usageData[id],
        [field]: value,
      },
    })
  }

  const calculateApplianceSubtotal = (applianceId: string) => {
    const appliance = appliances.find((a) => a.id === applianceId)
    const usage = usageData[applianceId]
    if (!appliance || !usage || usage.dailyHours === 0) return null

    const peakHours = Math.max(0, usage.dailyHours - usage.offPeakHours)
    const offPeakHours = usage.offPeakHours

    const dailyPeakKwh = appliance.kwh * peakHours * appliance.count
    const dailyOffPeakKwh = appliance.kwh * offPeakHours * appliance.count

    const monthlyPeakKwh = dailyPeakKwh * 30
    const monthlyOffPeakKwh = dailyOffPeakKwh * 30

    const peakCost = monthlyPeakKwh * PEAK_RATE
    const offPeakCost = monthlyOffPeakKwh * OFF_PEAK_RATE
    const totalCost = peakCost + offPeakCost

    // Calculate potential if all hours were peak
    const allPeakCost = appliance.kwh * usage.dailyHours * appliance.count * 30 * PEAK_RATE
    const potentialSavings = allPeakCost - totalCost

    return {
      name: getApplianceName(applianceId),
      totalCost: totalCost.toFixed(2),
      monthlyKwh: (monthlyPeakKwh + monthlyOffPeakKwh).toFixed(2),
      peakCost: peakCost.toFixed(2),
      offPeakCost: offPeakCost.toFixed(2),
      potentialSavings: potentialSavings.toFixed(2),
      savingsPercent: allPeakCost > 0 ? ((potentialSavings / allPeakCost) * 100).toFixed(0) : "0",
    }
  }

  const calculateTotalCosts = () => {
    let totalMonthly = 0
    let totalKwh = 0
    let totalPeakCost = 0
    let totalOffPeakCost = 0
    let totalPotentialSavings = 0

    Array.from(selectedAppliances).forEach((id) => {
      const subtotal = calculateApplianceSubtotal(id)
      if (subtotal) {
        totalMonthly += Number.parseFloat(subtotal.totalCost)
        totalKwh += Number.parseFloat(subtotal.monthlyKwh)
        totalPeakCost += Number.parseFloat(subtotal.peakCost)
        totalOffPeakCost += Number.parseFloat(subtotal.offPeakCost)
        totalPotentialSavings += Number.parseFloat(subtotal.potentialSavings)
      }
    })

    return {
      totalMonthly: totalMonthly.toFixed(2),
      totalKwh: totalKwh.toFixed(2),
      totalPeakCost: totalPeakCost.toFixed(2),
      totalOffPeakCost: totalOffPeakCost.toFixed(2),
      totalPotentialSavings: totalPotentialSavings.toFixed(2),
    }
  }

  const totals = calculateTotalCosts()
  const hasSignificantSavings = Number.parseFloat(totals.totalPotentialSavings) > 10

  if (appliances.length === 0) {
    return (
      <AppShell>
        <div className="container max-w-4xl mx-auto px-4 py-6 md:py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No appliances configured. Please complete the setup first.</p>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-6 md:py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Appliance Simulator</h1>
          <p className="text-muted-foreground">
            Select appliances and enter usage hours to calculate costs and discover savings
          </p>
        </div>

        <div className="flex gap-6 h-[calc(100vh-16rem)]">
          {/* Left Panel: Appliance Selection - 35% width */}
          <Card className="flex flex-col w-[35%]">
            <CardHeader className="flex-shrink-0">
              <CardTitle>Select Appliances</CardTitle>
              <CardDescription>Choose appliances and enter daily usage hours</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-4 pr-4">
              {appliances.map((appliance) => {
                const isSelected = selectedAppliances.has(appliance.id)
                const usage = usageData[appliance.id]

                return (
                  <div
                    key={appliance.id}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <Checkbox
                        id={appliance.id}
                        checked={isSelected}
                        onCheckedChange={() => toggleAppliance(appliance.id)}
                        className="mt-1"
                      />
                      <label htmlFor={appliance.id} className="flex-1 cursor-pointer">
                        <p className="font-semibold">{getApplianceName(appliance.id)}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {appliance.count} unit{appliance.count > 1 ? "s" : ""} • {appliance.kwh} kWh
                          {appliance.alwaysOn && " • Always On"}
                        </p>
                      </label>
                    </div>

                    {isSelected && (
                      <div className="space-y-3 mt-3 pt-3 border-t">
                        <div className="space-y-1.5">
                          <Label htmlFor={`${appliance.id}-daily`} className="text-xs font-medium">
                            Daily Hours (total)
                          </Label>
                          <Input
                            id={`${appliance.id}-daily`}
                            type="number"
                            value={usage?.dailyHours || ""}
                            onChange={(e) =>
                              updateUsage(appliance.id, "dailyHours", Number.parseFloat(e.target.value) || 0)
                            }
                            placeholder="0"
                            min="0"
                            max="24"
                            step="0.5"
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`${appliance.id}-offpeak`} className="text-xs font-medium">
                            Off-Peak Hours
                          </Label>
                          <Input
                            id={`${appliance.id}-offpeak`}
                            type="number"
                            value={usage?.offPeakHours || ""}
                            onChange={(e) =>
                              updateUsage(appliance.id, "offPeakHours", Number.parseFloat(e.target.value) || 0)
                            }
                            placeholder="0"
                            min="0"
                            max="24"
                            step="0.5"
                            className="h-9"
                          />
                          <div className="flex items-start gap-1.5 mt-1 text-xs text-muted-foreground">
                            <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            <p className="leading-tight">
                              ToU off-peak: 10am-2pm weekdays, all day Sat/Sun & public holidays
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Right Panel: Cost Analysis - 65% width */}
          <Card className="flex flex-col w-[65%]">
            <CardHeader className="flex-shrink-0">
              <CardTitle>Cost Analysis</CardTitle>
              <CardDescription>
                {selectedAppliances.size > 0
                  ? `Analyzing ${selectedAppliances.size} appliance${selectedAppliances.size > 1 ? "s" : ""}`
                  : "Select appliances to see analysis"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-4 pr-4">
              {selectedAppliances.size > 0 ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from(selectedAppliances).map((id) => {
                      const subtotal = calculateApplianceSubtotal(id)
                      return (
                        <Card key={id} className="bg-muted/30">
                          <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground mb-1">Subtotal</p>
                            <p className="font-semibold text-sm mb-1">{getApplianceName(id)}</p>
                            {subtotal ? (
                              <p className="text-lg font-bold text-primary">RM {subtotal.totalCost}</p>
                            ) : (
                              <p className="text-sm text-muted-foreground">Enter hours</p>
                            )}
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>

                  <Card className="bg-primary/5 border-primary">
                    <CardContent className="p-6 space-y-4">
                      <h3 className="text-lg font-semibold mb-3">Monthly Cost Summary</h3>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center pb-2 border-b border-primary/20">
                          <span className="text-sm text-muted-foreground">Total Energy</span>
                          <span className="font-semibold">{totals.totalKwh} kWh</span>
                        </div>
                        <div className="flex justify-between items-center pb-2 border-b border-primary/20">
                          <span className="text-sm text-muted-foreground">Peak Hours Cost</span>
                          <span className="font-semibold">RM {totals.totalPeakCost}</span>
                        </div>
                        <div className="flex justify-between items-center pb-2 border-b border-primary/20">
                          <span className="text-sm text-muted-foreground">Off-Peak Hours Cost</span>
                          <span className="font-semibold">RM {totals.totalOffPeakCost}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                          <span className="text-base font-medium">Total Monthly Cost</span>
                          <span className="text-2xl font-bold text-primary">RM {totals.totalMonthly}</span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-primary/20">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-chart-1">Savings from Off-Peak Usage</span>
                          <span className="font-bold text-chart-1">RM {totals.totalPotentialSavings}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {hasSignificantSavings && (
                    <Alert className="border-primary bg-primary/5">
                      <Lightbulb className="h-5 w-5 text-primary" />
                      <AlertTitle className="text-lg font-semibold mb-3">Smart Recommendations</AlertTitle>
                      <AlertDescription className="space-y-4">
                        <div className="flex items-start gap-3">
                          <Clock className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium mb-2">Maximize Off-Peak Hours (10 PM - 8 AM)</p>
                            <p className="text-sm text-muted-foreground mb-3">
                              You're currently saving RM {totals.totalPotentialSavings}/month by using off-peak hours.
                              Shift more usage to off-peak times to save even more!
                            </p>
                          </div>
                        </div>

                        <div className="bg-background rounded-lg p-4 space-y-3">
                          <p className="text-sm font-semibold">Rate Comparison:</p>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Peak Rate (8 AM - 10 PM)</span>
                              <span className="font-semibold">RM {PEAK_RATE}/kWh</span>
                            </div>
                            <div className="flex items-center justify-between text-sm text-chart-1">
                              <span className="flex items-center gap-1">
                                <TrendingDown className="h-4 w-4" />
                                Off-Peak Rate
                              </span>
                              <span className="font-semibold">RM {OFF_PEAK_RATE}/kWh</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-sm text-muted-foreground">
                          <p className="font-medium mb-1">Suggestions:</p>
                          <ul className="list-disc list-inside space-y-1 text-xs">
                            <li>Run washing machines and dishwashers after 10 PM</li>
                            <li>Charge electric vehicles overnight</li>
                            <li>Use programmable thermostats for off-peak cooling</li>
                            <li>Schedule water heaters to operate during off-peak hours</li>
                          </ul>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-center text-muted-foreground py-12">
                    Select appliances from the left panel to see cost analysis and recommendations
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}
