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
import { Checkbox } from "@/components/ui/checkbox"
import { LoadingOverlay } from "@/components/loading-overlay"
import { AlertDialog } from "@/components/alert-dialog"
import {
  AirVent,
  Refrigerator,
  WashingMachine,
  Tv,
  Monitor,
  Lightbulb,
  Microwave,
  Fan,
  Zap,
  Upload,
  Clock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { addAppliance } from "../appliances/actions"
import { completeSetup } from "../profile/actions"
import { calculateUsageBreakdown } from "@/utils/usage-calculations"

type ApplianceData = {
  id: string
  count: number
  watt: number
  alwaysOn: boolean
  startTime: string
  endTime: string
}

const applianceTypes = [
  { id: "ac", name: "Air Conditioner", icon: AirVent, defaultWatt: 2000 },
  { id: "fridge", name: "Refrigerator", icon: Refrigerator, defaultWatt: 150 },
  { id: "washer", name: "Washing Machine", icon: WashingMachine, defaultWatt: 500 },
  { id: "tv", name: "Television", icon: Tv, defaultWatt: 100 },
  { id: "pc", name: "Computer/PC", icon: Monitor, defaultWatt: 200 },
  { id: "lights", name: "LED Lights", icon: Lightbulb, defaultWatt: 10 },
  { id: "microwave", name: "Microwave", icon: Microwave, defaultWatt: 1000 },
  { id: "fan", name: "Ceiling Fan", icon: Fan, defaultWatt: 75 },
]

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
            alwaysOn: false,
            startTime: "18:00",
            endTime: "22:00",
          },
        }
      }
    })
  }

  const updateApplianceData = (id: string, field: string, value: number | boolean | string) => {
    setAppliances((prev) => {
      const updatedApp = {
        ...prev[id],
        [field]: value,
      }

      // Handle Always On logic
      if (field === "alwaysOn") {
        if (value === true) {
          updatedApp.startTime = "00:00"
          updatedApp.endTime = "23:59" // Effectively 24h
        } else {
          // Reset to default evening hours if unchecked
          updatedApp.startTime = "18:00"
          updatedApp.endTime = "22:00"
        }
      }

      return {
        ...prev,
        [id]: updatedApp,
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
      // Save appliances to Supabase
      const promises = Object.values(appliances).map(async (app) => {
        const formData = new FormData()
        const type = applianceTypes.find(t => t.id === app.id)
        formData.append("name", type?.name || app.id)
        formData.append("quantity", app.count.toString())
        formData.append("watt", app.watt.toString())
        formData.append("usage_start_time", app.startTime)
        formData.append("usage_end_time", app.endTime)
        
        // Calculate usage
        let breakdown;
        if (app.alwaysOn) {
           breakdown = {
             dailyUsage: 24,
             peakUsage: 14, // 8am - 10pm is 14 hours
             offPeakUsage: 10 // Rest is 10 hours
           }
        } else {
           breakdown = calculateUsageBreakdown(app.startTime, app.endTime)
        }
        
        formData.append("daily_usage_hours", breakdown.dailyUsage.toString())
        formData.append("peak_usage_hours", breakdown.peakUsage.toString())
        formData.append("off_peak_usage_hours", breakdown.offPeakUsage.toString())
        
        return addAppliance(formData)
      })

      await Promise.all(promises)

      // Save profile details to database
      const result = await completeSetup(
        parseFloat(billAmount),
        parseFloat(billKwh),
        budgetTarget[0]
      )

      if (result.error) {
        throw new Error(result.error)
      }
      
      router.push("/dashboard")
    } catch (error) {
      console.error("Error saving setup:", error)
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
                  
                  // Calculate breakdown for display
                  let breakdown;
                  if (data && data.alwaysOn) {
                    breakdown = { dailyUsage: 24, peakUsage: 14, offPeakUsage: 10 }
                  } else {
                    breakdown = isSelected 
                      ? calculateUsageBreakdown(data.startTime, data.endTime)
                      : { dailyUsage: 0, peakUsage: 0, offPeakUsage: 0 }
                  }

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
                                value={data.count}
                                onChange={(e) => {
                                  const value = Number.parseInt(e.target.value) || 1
                                  updateApplianceData(appliance.id, "count", value)
                                }}
                                className={cn(
                                  "h-9",
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
                                value={data.watt}
                                onChange={(e) => {
                                  const value = Number.parseFloat(e.target.value) || 0
                                  updateApplianceData(appliance.id, "watt", value)
                                }}
                                className={cn(
                                  "h-9",
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
                          
                          <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <Clock className="h-4 w-4 text-primary" />
                              Usage Schedule
                            </div>
                            <div className={cn("grid grid-cols-2 gap-4", data.alwaysOn && "opacity-50 pointer-events-none")}>
                              <div className="space-y-2">
                                <Label htmlFor={`${appliance.id}-start`} className="text-xs text-muted-foreground">
                                  Start Time
                                </Label>
                                <Input
                                  id={`${appliance.id}-start`}
                                  type="time"
                                  value={data.startTime}
                                  onChange={(e) => updateApplianceData(appliance.id, "startTime", e.target.value)}
                                  className="h-8"
                                  disabled={data.alwaysOn}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`${appliance.id}-end`} className="text-xs text-muted-foreground">
                                  End Time
                                </Label>
                                <Input
                                  id={`${appliance.id}-end`}
                                  type="time"
                                  value={data.endTime}
                                  onChange={(e) => updateApplianceData(appliance.id, "endTime", e.target.value)}
                                  className="h-8"
                                  disabled={data.alwaysOn}
                                />
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between text-xs pt-2 border-t">
                              <span className="text-muted-foreground">Est. Daily Usage:</span>
                              <span className="font-medium">{breakdown.dailyUsage} hours</span>
                            </div>
                            <div className="flex gap-4 text-xs">
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-chart-3" />
                                <span className="text-muted-foreground">Peak: {breakdown.peakUsage}h</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-chart-1" />
                                <span className="text-muted-foreground">Off-Peak: {breakdown.offPeakUsage}h</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-end pt-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`${appliance.id}-always-on`}
                                checked={data.alwaysOn}
                                onCheckedChange={(checked) =>
                                  updateApplianceData(appliance.id, "alwaysOn", checked as boolean)
                                }
                              />
                              <Label htmlFor={`${appliance.id}-always-on`} className="text-sm cursor-pointer">
                                Always On (24 Hours)
                              </Label>
                            </div>
                          </div>
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

