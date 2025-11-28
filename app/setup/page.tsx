"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
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
} from "lucide-react"
import { cn } from "@/lib/utils"

type ApplianceData = {
  id: string
  count: number
  kwh: number
  alwaysOn: boolean
}

const applianceTypes = [
  { id: "ac", name: "Air Conditioner", icon: AirVent, defaultKwh: 2.0 },
  { id: "fridge", name: "Refrigerator", icon: Refrigerator, defaultKwh: 0.15 },
  { id: "washer", name: "Washing Machine", icon: WashingMachine, defaultKwh: 0.5 },
  { id: "tv", name: "Television", icon: Tv, defaultKwh: 0.1 },
  { id: "pc", name: "Computer/PC", icon: Monitor, defaultKwh: 0.2 },
  { id: "lights", name: "LED Lights", icon: Lightbulb, defaultKwh: 0.06 },
  { id: "microwave", name: "Microwave", icon: Microwave, defaultKwh: 1.0 },
  { id: "fan", name: "Ceiling Fan", icon: Fan, defaultKwh: 0.075 },
]

export default function SetupPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [billFile, setBillFile] = useState<File | null>(null)
  const [budgetTarget, setBudgetTarget] = useState([150])
  const [appliances, setAppliances] = useState<Record<string, ApplianceData>>({})
  const [isTouPlan, setIsTouPlan] = useState(false)

  const toggleAppliance = (id: string, defaultKwh: number) => {
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
            kwh: defaultKwh,
            alwaysOn: false,
          },
        }
      }
    })
  }

  const updateApplianceData = (id: string, field: keyof ApplianceData, value: number | boolean) => {
    setAppliances((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }))
  }

  const handleBillUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setBillFile(e.target.files[0])
    }
  }

  const handleComplete = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "powerPulseSetup",
        JSON.stringify({
          username,
          budgetTarget: budgetTarget[0],
          appliances,
          touPlan: isTouPlan,
          billUploaded: !!billFile,
          completedAt: new Date().toISOString(),
        }),
      )
    }
    router.push("/dashboard")
  }

  const isComplete = username && password && Object.keys(appliances).length > 0

  return (
    <AppShell>
      <div className="container max-w-5xl mx-auto px-4 py-8 md:py-12">
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 animate-pulse-eco">
              <Zap className="h-8 w-8 text-primary fill-current" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Welcome to PowerPulse</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-balance">
            Create your account and set up your smart energy profile to start saving
          </p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Create Account</CardTitle>
              <CardDescription>Register to start monitoring your energy usage</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upload Previous Bill</CardTitle>
              <CardDescription>Upload your electricity bill from 3 months ago for better analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Input
                    id="bill-upload"
                    type="file"
                    onChange={handleBillUpload}
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                  />
                  <Label
                    htmlFor="bill-upload"
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md cursor-pointer hover:bg-primary/90 transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    Choose File
                  </Label>
                  {billFile && (
                    <span className="text-sm text-muted-foreground">
                      {billFile.name} ({(billFile.size / 1024).toFixed(1)} KB)
                    </span>
                  )}
                </div>
                {!billFile && <p className="text-xs text-muted-foreground">Accepts PDF, JPG, or PNG files</p>}
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
                        onClick={() => toggleAppliance(appliance.id, appliance.defaultKwh)}
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
                        <div className="ml-10 grid grid-cols-1 md:grid-cols-3 gap-4 pb-2">
                          <div className="space-y-2">
                            <Label htmlFor={`${appliance.id}-count`} className="text-sm">
                              Number of Units
                            </Label>
                            <Input
                              id={`${appliance.id}-count`}
                              type="number"
                              min="1"
                              value={data.count}
                              onChange={(e) =>
                                updateApplianceData(appliance.id, "count", Number.parseInt(e.target.value) || 1)
                              }
                              className="h-9"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`${appliance.id}-kwh`} className="text-sm">
                              Power (kWh)
                            </Label>
                            <Input
                              id={`${appliance.id}-kwh`}
                              type="number"
                              step="0.01"
                              min="0"
                              value={data.kwh}
                              onChange={(e) =>
                                updateApplianceData(appliance.id, "kwh", Number.parseFloat(e.target.value) || 0)
                              }
                              className="h-9"
                            />
                          </div>
                          {appliance.id === "ac" && (
                            <div className="flex items-end">
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id={`${appliance.id}-always-on`}
                                  checked={data.alwaysOn}
                                  onCheckedChange={(checked) =>
                                    updateApplianceData(appliance.id, "alwaysOn", checked as boolean)
                                  }
                                />
                                <Label htmlFor={`${appliance.id}-always-on`} className="text-sm cursor-pointer">
                                  Always On
                                </Label>
                              </div>
                            </div>
                          )}
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

          <Button size="lg" className="w-full" onClick={handleComplete} disabled={!isComplete}>
            Complete Setup & Go to Dashboard
          </Button>
        </div>
      </div>
    </AppShell>
  )
}
