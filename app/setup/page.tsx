"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { LoadingOverlay } from "@/components/loading-overlay"
import { AlertDialog } from "@/components/alert-dialog"
import {
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { addAppliance } from "../appliances/actions"
import { completeSetup } from "../profile/actions"
import { disaggregateEnergy } from "@/lib/ml-api"
import { applianceTypes, ML_SERVICE_NAME_MAP } from "@/constants/appliances"

type ApplianceData = {
  id: string
  count: number
  watt: number
}

export default function SetupPage() {
  const router = useRouter()
  const [billAmount, setBillAmount] = useState("")
  const [billKwh, setBillKwh] = useState("")
  const [budgetTarget, setBudgetTarget] = useState([150])
  const [appliances, setAppliances] = useState<Record<string, ApplianceData>>({})
  const [isTouPlan, setIsTouPlan] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [alertConfig, setAlertConfig] = useState({ isOpen: false, title: "", message: "" })

  const toggleAppliance = (id: string, defaultWatt: number) => {
    setAppliances((prev) => {
      if (prev[id]) {
        const newState = { ...prev }
        delete newState[id]
        return newState
      } else {
        return {
          ...prev,
          [id]: {
            id,
            count: 1,
            watt: defaultWatt,
          },
        }
      }
    })
  }

  const updateApplianceData = (id: string, field: string, value: number) => {
    setAppliances((prev) => {
      return {
        ...prev,
        [id]: {
          ...prev[id],
          [field]: value,
        },
      }
    })
  }

  const isValueInvalid = (applianceId: string, field: 'count' | 'watt', value: number) => {
    if (field === 'count') {
      const maxUnits = applianceId === "lights" ? 200 : 50
      return value > maxUnits || value < 1
    }
    if (field === 'watt') {
      return value > 99999 || value < 1
    }
    return false
  }

  const validateAllInputs = () => {
    const errors: string[] = []
    
    Object.values(appliances).forEach((app) => {
      const type = applianceTypes.find(t => t.id === app.id)
      const maxUnits = app.id === "lights" ? 200 : 50
      
      if (app.count < 1 || app.count > maxUnits) {
        errors.push(`${type?.name}: Units must be between 1 and ${maxUnits}`)
      }
      if (app.watt < 1 || app.watt > 99999) {
        errors.push(`${type?.name}: Wattage must be between 1 and 99999`)
      }
    })
    
    return errors
  }

  const handleComplete = async () => {
    const validationErrors = validateAllInputs()
    
    if (validationErrors.length > 0) {
      setAlertConfig({
        isOpen: true,
        title: "Invalid Input Values",
        message: "Please input reasonable values:\n\n" + validationErrors.join("\n")
      })
      return
    }

    setIsSubmitting(true)
    try {
      const totalKwh = parseFloat(billKwh)
      
      // Prepare appliances for ML service
      const applianceList = Object.values(appliances).map((app) => {
        const type = applianceTypes.find(t => t.id === app.id)
        const frontendName = type?.name || app.id
        // Map to ML service name (e.g., "Refrigerator" -> "Fridge")
        const mlServiceName = ML_SERVICE_NAME_MAP[frontendName] || frontendName
        return {
          type: mlServiceName,
          quantity: app.count,
          rated_watts: app.watt,
        }
      })

      // Call ML service to calculate usage hours
      let disaggregateResult
      try {
        disaggregateResult = await disaggregateEnergy(totalKwh, applianceList)
      } catch (error) {
        console.error("Error calling ML service:", error)
        // Fallback: use default usage hours if ML service fails
        disaggregateResult = {
          breakdown: Object.values(appliances).map((app) => {
            const type = applianceTypes.find(t => t.id === app.id)
            return {
              type: type?.name || app.id,
              usage_hours_per_day: 6, // Default fallback
            }
          }),
        }
      }

      // Create a map of appliance type to usage hours
      // Map ML service names back to frontend names
      const usageHoursMap = new Map<string, number>()
      const reverseNameMap = Object.fromEntries(
        Object.entries(ML_SERVICE_NAME_MAP).map(([frontend, ml]) => [ml, frontend])
      )
      
      disaggregateResult.breakdown.forEach((item: any) => {
        // Convert ML service name back to frontend name
        const frontendName = reverseNameMap[item.type] || item.type
        usageHoursMap.set(frontendName, item.usage_hours_per_day)
      })

      // Calculate peak/off-peak distribution
      // Peak hours: 14:00-22:00 (8 hours), Off-peak: rest (16 hours)
      // Assume usage is distributed proportionally, but slightly more during peak hours
      const PEAK_HOURS = 8
      const OFF_PEAK_HOURS = 16
      const TOTAL_HOURS = 24
      // Use 60% peak, 40% off-peak distribution for typical usage
      const PEAK_RATIO = 0.6

      // Save appliances to Supabase with calculated usage hours
      const promises = Object.values(appliances).map(async (app) => {
        const formData = new FormData()
        const type = applianceTypes.find(t => t.id === app.id)
        const applianceName = type?.name || app.id
        const dailyUsageHours = usageHoursMap.get(applianceName) || 6
        
        // Calculate peak and off-peak hours
        // If usage is 24 hours, distribute evenly
        // Otherwise, distribute based on peak ratio
        let peakUsageHours, offPeakUsageHours
        if (dailyUsageHours >= 24) {
          peakUsageHours = PEAK_HOURS
          offPeakUsageHours = OFF_PEAK_HOURS
        } else {
          peakUsageHours = Math.min(dailyUsageHours * PEAK_RATIO, PEAK_HOURS)
          offPeakUsageHours = Math.max(0, dailyUsageHours - peakUsageHours)
        }

        formData.append("name", applianceName)
        formData.append("quantity", app.count.toString())
        formData.append("watt", app.watt.toString())
        formData.append("daily_usage_hours", dailyUsageHours.toString())
        formData.append("peak_usage_hours", peakUsageHours.toString())
        formData.append("off_peak_usage_hours", offPeakUsageHours.toString())
        
        return addAppliance(formData)
      })

      await Promise.all(promises)

      // Save profile details to database
      const result = await completeSetup(
        parseFloat(billAmount),
        totalKwh,
        budgetTarget[0]
      )

      if (result.error) {
        throw new Error(result.error)
      }
      
      router.push("/dashboard")
    } catch (error) {
      console.error("Error saving setup:", error)
      setAlertConfig({
        isOpen: true,
        title: "Setup Error",
        message: "Failed to complete setup. Please try again."
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const isComplete = Object.keys(appliances).length > 0 && billAmount !== "" && billKwh !== ""

  return (
    <AppShell>
      {isSubmitting && <LoadingOverlay message="Setting up your profile..." />}
      <AlertDialog
        isOpen={alertConfig.isOpen}
        onClose={() => setAlertConfig({ isOpen: false, title: "", message: "" })}
        title={alertConfig.title}
        message={alertConfig.message}
        type="error"
      />
      <div className="container max-w-5xl mx-auto px-4 py-8 md:py-12">
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 animate-pulse-eco">
              <Zap className="h-8 w-8 text-primary fill-current" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Welcome to PowerPulse</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-balance">
            Set up your smart energy profile to start saving
          </p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Previous Bill Details</CardTitle>
              <CardDescription>Enter details from your latest electricity bill for accurate analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="bill-amount">Total Bill Amount (RM)</Label>
                  <Input
                    id="bill-amount"
                    type="number"
                    placeholder="e.g. 150.50"
                    value={billAmount}
                    onChange={(e) => setBillAmount(e.target.value)}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bill-kwh">Total Usage (kWh)</Label>
                  <Input
                    id="bill-kwh"
                    type="number"
                    placeholder="e.g. 450"
                    value={billKwh}
                    onChange={(e) => setBillKwh(e.target.value)}
                    min="0"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Budget Target Card */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Budget Goal</CardTitle>
              <CardDescription>Set your target monthly electricity bill</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="budget" className="text-base">
                    Target Monthly Bill
                  </Label>
                  <span className="text-3xl font-bold text-primary">RM {budgetTarget[0]}</span>
                </div>
                <Slider
                  id="budget"
                  min={50}
                  max={500}
                  step={10}
                  value={budgetTarget}
                  onValueChange={setBudgetTarget}
                  className="[&_[role=slider]]:bg-primary [&_[role=slider]]:border-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>RM 50</span>
                  <span>RM 500</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Appliances</CardTitle>
              <CardDescription>Select appliances and provide details for accurate monitoring</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {applianceTypes.map((appliance) => {
                  const isSelected = !!appliances[appliance.id]
                  const Icon = appliance.icon
                  const data = appliances[appliance.id]

                  return (
                    <div key={appliance.id} className="space-y-3">
                      <button
                        onClick={() => toggleAppliance(appliance.id, appliance.defaultWatt)}
                        className={cn(
                          "w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left",
                          isSelected
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border hover:border-muted-foreground/30",
                        )}
                      >
                        <Icon
                          className={cn("h-6 w-6 shrink-0", isSelected ? "text-primary" : "text-muted-foreground")}
                        />
                        <span
                          className={cn("font-medium flex-1", isSelected ? "text-foreground" : "text-muted-foreground")}
                        >
                          {appliance.name}
                        </span>
                        {isSelected && (
                          <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                            <Zap className="h-3 w-3 text-primary-foreground fill-current" />
                          </div>
                        )}
                      </button>

                      {isSelected && (
                        <div className="ml-10 space-y-4 pb-2">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor={`${appliance.id}-count`} className="text-sm">
                                Number of Units
                              </Label>
                              <Input
                                id={`${appliance.id}-count`}
                                type="number"
                                min="1"
                                placeholder="0"
                                value={data.count === 0 ? "" : data.count}
                                onChange={(e) => {
                                  const value = e.target.value === "" ? 0 : Number.parseInt(e.target.value)
                                  updateApplianceData(appliance.id, "count", value)
                                }}
                                className={cn(
                                  "h-9",
                                  data.count === 0 && "text-muted-foreground",
                                  isValueInvalid(appliance.id, 'count', data.count) && "border-red-500 ring-2 ring-red-500/20"
                                )}
                              />
                              {isValueInvalid(appliance.id, 'count', data.count) && (
                                <p className="text-xs text-red-600 dark:text-red-400">
                                  Must be between 1 and {appliance.id === "lights" ? 200 : 50}
                                </p>
                              )}
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`${appliance.id}-watt`} className="text-sm">
                                Power (Watts)
                              </Label>
                              <Input
                                id={`${appliance.id}-watt`}
                                type="number"
                                min="1"
                                placeholder="0"
                                value={data.watt === 0 ? "" : data.watt}
                                onChange={(e) => {
                                  const value = e.target.value === "" ? 0 : Number.parseFloat(e.target.value)
                                  updateApplianceData(appliance.id, "watt", value)
                                }}
                                className={cn(
                                  "h-9",
                                  data.watt === 0 && "text-muted-foreground",
                                  isValueInvalid(appliance.id, 'watt', data.watt) && "border-red-500 ring-2 ring-red-500/20"
                                )}
                              />
                              {isValueInvalid(appliance.id, 'watt', data.watt) && (
                                <p className="text-xs text-red-600 dark:text-red-400">
                                  Must be between 1 and 99999
                                </p>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Usage hours will be calculated automatically based on your energy consumption patterns.
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {Object.keys(appliances).length > 0 && (
                <p className="mt-4 text-sm text-muted-foreground">
                  {Object.keys(appliances).length} appliance{Object.keys(appliances).length !== 1 ? "s" : ""} configured
                </p>
              )}
            </CardContent>
          </Card>

          {/* TNB Tariff Card */}
          <Card>
            <CardHeader>
              <CardTitle>TNB Tariff Plan</CardTitle>
              <CardDescription>Are you on the Time-of-Use (ToU) electricity plan?</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="tou-plan" className="text-base">
                    Time-of-Use Plan
                  </Label>
                  <p className="text-sm text-muted-foreground">Lower rates during off-peak hours</p>
                </div>
                <Switch id="tou-plan" checked={isTouPlan} onCheckedChange={setIsTouPlan} />
              </div>
            </CardContent>
          </Card>

          <Button size="lg" className="w-full" onClick={handleComplete} disabled={!isComplete || isSubmitting}>
            {isSubmitting ? "Saving..." : "Complete Setup & Go to Dashboard"}
          </Button>
        </div>
      </div>
    </AppShell>
  )
}

