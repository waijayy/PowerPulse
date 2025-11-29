"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AirVent,
  Refrigerator,
  WashingMachine,
  Tv,
  Monitor,
  Lightbulb,
  Microwave,
  Fan,
  Trash2,
  Plus,
  Save,
  LogOut,
  Eye,
  EyeOff,
  Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { updatePassword, updateProfile, updateBudget, updateProfileBill } from "./actions"
import { getAppliances, addAppliance, deleteAppliance, updateAppliance } from "../appliances/actions"
import { signout } from "../auth/actions"
import { createClient } from "@/utils/supabase/client"
import { calculateUsageBreakdown } from "@/utils/usage-calculations"
import { AlertDialog } from "@/components/alert-dialog"

type ApplianceData = {
  id: number
  name: string
  quantity: number
  watt: number
  usage_start_time?: string
  usage_end_time?: string
  daily_usage_hours?: number
  peak_usage_hours?: number
  off_peak_usage_hours?: number
  created_at?: string
  user_id?: string
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

export default function ProfilePage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [appliances, setAppliances] = useState<ApplianceData[]>([])
  const [savedMessage, setSavedMessage] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isEditingUsername, setIsEditingUsername] = useState(false)
  const [isEditingBudget, setIsEditingBudget] = useState(false)
  const [monthlyBudget, setMonthlyBudget] = useState("150")
  
  // Bill Details State
  const [billAmount, setBillAmount] = useState("0")
  const [billKwh, setBillKwh] = useState("0")
  const [isEditingBill, setIsEditingBill] = useState(false)
  
  // New Appliance Form State
  const [selectedType, setSelectedType] = useState("")
  const [newQuantity, setNewQuantity] = useState(1)
  const [newWatt, setNewWatt] = useState(0)
  const [newStartTime, setNewStartTime] = useState("18:00")
  const [newEndTime, setNewEndTime] = useState("22:00")
  const [alertConfig, setAlertConfig] = useState({ isOpen: false, title: "", message: "" })

  useEffect(() => {
    // Fetch appliances on load
    getAppliances().then((data) => {
      setAppliances(data as any)
    })

    // Fetch user details
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setEmail(user.email || "")
        
        // Fetch profile data
        supabase
          .from('profiles')
          .select('username, monthly_budget_target, total_bill_amount, total_kwh_usage')
          .eq('id', user.id)
          .single()
          .then(({ data: profile }) => {
            if (profile) {
              if (profile.username) setName(profile.username)
            if (profile.monthly_budget_target) setMonthlyBudget(profile.monthly_budget_target.toString())
            if (profile.total_bill_amount) setBillAmount(profile.total_bill_amount.toString())
            if (profile.total_kwh_usage) setBillKwh(profile.total_kwh_usage.toString())
            }
          })
      }
    })
  }, [])

  const handleSaveProfile = async () => {
    const formData = new FormData()
    formData.append("username", name)
    
    const result = await updateProfile(formData)
    
    if (result.error) {
      setSavedMessage(result.error)
    } else {
      setSavedMessage("Profile saved successfully!")
      setIsEditingUsername(false)
    }
    setTimeout(() => setSavedMessage(""), 3000)
  }

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      setSavedMessage("Please fill in all password fields")
      setTimeout(() => setSavedMessage(""), 3000)
      return
    }

    if (newPassword !== confirmPassword) {
      setSavedMessage("New passwords do not match")
      setTimeout(() => setSavedMessage(""), 3000)
      return
    }

    const formData = new FormData()
    formData.append("password", newPassword)
    formData.append("confirmPassword", confirmPassword)

    const result = await updatePassword(formData)

    if (result.error) {
      setSavedMessage(result.error)
    } else {
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setSavedMessage("Password changed successfully!")
    }
    setTimeout(() => setSavedMessage(""), 3000)
  }

  const handleSaveBudget = async () => {
    const amount = parseFloat(monthlyBudget || "0") || 0
    const result = await updateBudget(amount)
    
    if (result.error) {
      setSavedMessage(result.error)
    } else {
      setSavedMessage("Budget updated successfully!")
      setIsEditingBudget(false)
    }
    setTimeout(() => setSavedMessage(""), 3000)
  }


  const handleSaveBill = async () => {
    const amount = parseFloat(billAmount || "0") || 0
    const kwh = parseFloat(billKwh || "0") || 0
    const result = await updateProfileBill(amount, kwh)
    
    if (result.error) {
      setSavedMessage(result.error)
    } else {
      setSavedMessage("Bill details updated successfully!")
      setIsEditingBill(false)
    }
    setTimeout(() => setSavedMessage(""), 3000)
  }

  const handleLogout = async () => {
    await signout()
  }

  const isValueInvalid = (applianceName: string, field: 'quantity' | 'watt', value: number) => {
    if (field === 'quantity') {
      const maxUnits = applianceName.toLowerCase().includes("light") ? 200 : 50
      return value > maxUnits || value < 1
    }
    if (field === 'watt') {
      return value > 99999 || value < 1
    }
    return false
  }

  const handleAddAppliance = async () => {
    if (!selectedType) return

    const type = applianceTypes.find(t => t.id === selectedType)
    const typeName = type?.name || "Appliance"
    
    // Check for duplicates
    const isDuplicate = appliances.some(app => 
      app.name.toLowerCase().includes(type?.name.toLowerCase() || "") ||
      app.name.toLowerCase().includes(selectedType)
    )
    
    if (isDuplicate) {
      setAlertConfig({
        isOpen: true,
        title: "Duplicate Appliance",
        message: `You have already added ${typeName}. Please edit the existing one instead.`
      })
      return
    }

    // Validate inputs
    const maxUnits = selectedType === "lights" ? 200 : 50
    if (newQuantity < 1 || newQuantity > maxUnits) {
      setAlertConfig({
        isOpen: true,
        title: "Invalid Input Values",
        message: `Please input reasonable values:\n\nUnits must be between 1 and ${maxUnits}`
      })
      return
    }
    if (newWatt < 1 || newWatt > 99999) {
      setAlertConfig({
        isOpen: true,
        title: "Invalid Input Values",
        message: `Please input reasonable values:\n\nWattage must be between 1 and 99999`
      })
      return
    }

    const formData = new FormData()
    formData.append("name", typeName)
    formData.append("quantity", newQuantity.toString())
    formData.append("watt", newWatt.toString())
    formData.append("usage_start_time", newStartTime)
    formData.append("usage_end_time", newEndTime)
    
    const result = await addAppliance(formData)
    if (result.success) {
      const data = await getAppliances()
      setAppliances(data as any)
      setIsAddDialogOpen(false)
      // Reset form
      setSelectedType("")
      setNewQuantity(1)
      setNewWatt(0)
      setNewStartTime("18:00")
      setNewEndTime("22:00")
    }
  }

  const handleRemoveAppliance = async (id: number) => {
    const result = await deleteAppliance(id)
    if (result.success) {
      setAppliances(appliances.filter((app) => app.id !== id))
    }
  }

  const handleUpdateAppliance = async (id: number) => {
    const app = appliances.find(a => a.id === id)
    if (app) {
        // Validate inputs before saving
        const maxUnits = app.name.toLowerCase().includes("light") ? 200 : 50
        if (app.quantity < 1 || app.quantity > maxUnits) {
          setAlertConfig({
            isOpen: true,
            title: "Invalid Input Values",
            message: `Please input reasonable values:\n\nUnits must be between 1 and ${maxUnits}`
          })
          return
        }
        if (app.watt < 1 || app.watt > 99999) {
          setAlertConfig({
            isOpen: true,
            title: "Invalid Input Values",
            message: `Please input reasonable values:\n\nWattage must be between 1 and 99999`
          })
          return
        }

        const formData = new FormData()
        formData.append("name", app.name)
        formData.append("quantity", app.quantity.toString())
        formData.append("watt", (app.watt || 0).toString())
        if (app.usage_start_time) formData.append("usage_start_time", app.usage_start_time)
        if (app.usage_end_time) formData.append("usage_end_time", app.usage_end_time)
        
        const result = await updateAppliance(id, formData)
        if (result.success) {
            setEditingId(null)
            setSavedMessage("Appliance updated successfully")
            // Refresh list to get calculated values
            getAppliances().then((data) => setAppliances(data as any))
            setTimeout(() => setSavedMessage(""), 3000)
        }
    }
  }

  const toggleEdit = (id: number) => {
    if (editingId === id) {
        // Cancel edit
        setEditingId(null)
        // Re-fetch to reset changes
        getAppliances().then((data) => setAppliances(data as any))
    } else {
        setEditingId(id)
    }
  }

  const updateLocalAppliance = (id: number, field: keyof ApplianceData, value: any) => {
      setAppliances(appliances.map(app => {
          if (app.id === id) {
              const updatedApp = { ...app, [field]: value }
              // Recalculate breakdown if time changes
              if (field === 'usage_start_time' || field === 'usage_end_time') {
                  const start = field === 'usage_start_time' ? value : app.usage_start_time
                  const end = field === 'usage_end_time' ? value : app.usage_end_time
                  if (start && end) {
                      const breakdown = calculateUsageBreakdown(start, end)
                      updatedApp.daily_usage_hours = breakdown.dailyUsage
                      updatedApp.peak_usage_hours = breakdown.peakUsage
                      updatedApp.off_peak_usage_hours = breakdown.offPeakUsage
                  }
              }
              return updatedApp
          }
          return app
      }))
  }

  const getIcon = (name: string) => {
    const type = applianceTypes.find((t) => name.toLowerCase().includes(t.name.toLowerCase()) || name.toLowerCase().includes(t.id))
    return type?.icon || Lightbulb
  }

  return (
    <AppShell>
      <AlertDialog
        isOpen={alertConfig.isOpen}
        onClose={() => setAlertConfig({ isOpen: false, title: "", message: "" })}
        title={alertConfig.title}
        message={alertConfig.message}
        type="error"
      />
      <div className="container max-w-4xl mx-auto px-4 py-6 md:py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
        </div>

        {savedMessage && (
          <div
            className={cn(
              "p-4 rounded-lg border",
              savedMessage.includes("success")
                ? "bg-chart-1/10 border-chart-1/20 text-chart-1"
                : "bg-chart-3/10 border-chart-3/20 text-chart-3",
            )}
          >
            {savedMessage}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Update your name and basic profile details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Username</Label>
              <Input 
                id="name" 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                disabled={!isEditingUsername}
                className={!isEditingUsername ? "bg-muted" : ""}
              />
            </div>
            <div className="flex gap-2">
              {isEditingUsername ? (
                <>
                  <Button onClick={async () => {
                    await handleSaveProfile()
                    setIsEditingUsername(false)
                  }} className="w-full sm:w-auto">
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => {
                      setIsEditingUsername(false)
                      // Reset to original value by re-fetching
                      const supabase = createClient()
                      supabase.auth.getUser().then(({ data: { user } }) => {
                        if (user) {
                          supabase
                            .from('profiles')
                            .select('username')
                            .eq('id', user.id)
                            .single()
                            .then(({ data: profile }) => {
                              if (profile?.username) {
                                setName(profile.username)
                              }
                            })
                        }
                      })
                    }}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditingUsername(true)}
                  className="w-full sm:w-auto"
                >
                  Edit
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Budget Target</CardTitle>
            <CardDescription>Set your target monthly electricity bill</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="budget">Target Amount (RM)</Label>
              <Input 
                id="budget" 
                type="number" 
                min="50"
                max="1000"
                step="10"
                value={monthlyBudget} 
                onChange={(e) => setMonthlyBudget(e.target.value)} 
                disabled={!isEditingBudget}
                className={!isEditingBudget ? "bg-muted" : ""}
              />
              <p className="text-xs text-muted-foreground">
                Your current target: RM {monthlyBudget || "0"}
              </p>
            </div>
            <div className="flex gap-2">
              {isEditingBudget ? (
                <>
                  <Button onClick={handleSaveBudget} className="w-full sm:w-auto">
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => {
                      setIsEditingBudget(false)
                      // Reset to original value by re-fetching
                      const supabase = createClient()
                      supabase.auth.getUser().then(({ data: { user } }) => {
                        if (user) {
                          supabase
                            .from('profiles')
                            .select('monthly_budget_target')
                            .eq('id', user.id)
                            .single()
                            .then(({ data: profile }) => {
                              if (profile?.monthly_budget_target) {
                                setMonthlyBudget(profile.monthly_budget_target)
                              }
                            })
                        }
                      })
                    }}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditingBudget(true)}
                  className="w-full sm:w-auto"
                >
                  Edit
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bill Details</CardTitle>
            <CardDescription>Update your latest electricity bill information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="billAmount">Total Bill Amount (RM)</Label>
                <Input 
                  id="billAmount" 
                  type="number" 
                  min="0"
                  step="0.01"
                  value={billAmount} 
                  onChange={(e) => setBillAmount(e.target.value)} 
                  disabled={!isEditingBill}
                  className={!isEditingBill ? "bg-muted" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billKwh">Total Usage (kWh)</Label>
                <Input 
                  id="billKwh" 
                  type="number" 
                  min="0"
                  value={billKwh} 
                  onChange={(e) => setBillKwh(e.target.value)} 
                  disabled={!isEditingBill}
                  className={!isEditingBill ? "bg-muted" : ""}
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              {isEditingBill ? (
                <>
                  <Button onClick={handleSaveBill} className="w-full sm:w-auto">
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => {
                      setIsEditingBill(false)
                      // Reset to original value by re-fetching
                      const supabase = createClient()
                      supabase.auth.getUser().then(({ data: { user } }) => {
                        if (user) {
                          supabase
                            .from('profiles')
                            .select('total_bill_amount, total_kwh_usage')
                            .eq('id', user.id)
                            .single()
                            .then(({ data: profile }) => {
                              if (profile) {
                                setBillAmount(profile.total_bill_amount || 0)
                                setBillKwh(profile.total_kwh_usage || 0)
                              }
                            })
                        }
                      })
                    }}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditingBill(true)}
                  className="w-full sm:w-auto"
                >
                  Edit
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Electrical Appliances</CardTitle>
                <CardDescription>Manage your registered appliances</CardDescription>
              </div>
              <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
                setIsAddDialogOpen(open)
                if (!open) {
                  // Reset form when dialog closes
                  setSelectedType("")
                  setNewQuantity(1)
                  setNewWatt(0)
                  setNewStartTime("18:00")
                  setNewEndTime("22:00")
                }
              }}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Appliance
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[60%] w-full">
                  <DialogHeader>
                    <DialogTitle>Add Appliance</DialogTitle>
                    <DialogDescription>
                      Select an appliance type and configure details.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    {!selectedType ? (
                        <div className="grid grid-cols-2 gap-4">
                            {applianceTypes.map((type) => {
                              const isAlreadyAdded = appliances.some(app => 
                                app.name.toLowerCase().includes(type.name.toLowerCase()) ||
                                app.name.toLowerCase().includes(type.id)
                              )
                              return (
                                <Button
                                    key={type.id}
                                    variant="outline"
                                    disabled={isAlreadyAdded}
                                    className={cn(
                                      "h-32 flex flex-col items-center justify-center gap-3",
                                      isAlreadyAdded 
                                        ? "opacity-50 cursor-not-allowed bg-muted" 
                                        : "hover:border-primary hover:bg-primary/5"
                                    )}
                                    onClick={() => {
                                        if (!isAlreadyAdded) {
                                          setSelectedType(type.id)
                                          setNewWatt(type.defaultWatt)
                                        }
                                    }}
                                >
                                    <type.icon className={cn("h-12 w-12", isAlreadyAdded ? "text-muted-foreground" : "text-primary")} />
                                    <span className="text-sm font-medium text-center">
                                      {type.name}
                                      {isAlreadyAdded && <div className="text-xs text-muted-foreground">(Already Added)</div>}
                                    </span>
                                </Button>
                              )
                            })}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="mb-4">
                                <span className="font-semibold text-lg">{applianceTypes.find(t => t.id === selectedType)?.name}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Quantity</Label>
                                    <Input 
                                      type="number" 
                                      min="1" 
                                      value={newQuantity} 
                                      onChange={(e) => setNewQuantity(parseInt(e.target.value) || 1)}
                                      className={cn(
                                        isValueInvalid(selectedType, 'quantity', newQuantity) && "border-red-500 ring-2 ring-red-500/20"
                                      )}
                                    />
                                    {isValueInvalid(selectedType, 'quantity', newQuantity) && (
                                      <p className="text-xs text-red-600 dark:text-red-400">
                                        Must be between 1 and {selectedType === "lights" ? 200 : 50}
                                      </p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label>Power (Watts)</Label>
                                    <Input 
                                      type="number" 
                                      min="0" 
                                      value={newWatt} 
                                      onChange={(e) => setNewWatt(parseFloat(e.target.value) || 0)}
                                      className={cn(
                                        isValueInvalid(selectedType, 'watt', newWatt) && "border-red-500 ring-2 ring-red-500/20"
                                      )}
                                    />
                                    {isValueInvalid(selectedType, 'watt', newWatt) && (
                                      <p className="text-xs text-red-600 dark:text-red-400">
                                        Must be between 1 and 99999
                                      </p>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Start Time</Label>
                                    <Input type="time" value={newStartTime} onChange={(e) => setNewStartTime(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>End Time</Label>
                                    <Input type="time" value={newEndTime} onChange={(e) => setNewEndTime(e.target.value)} />
                                </div>
                            </div>
                            <Button className="w-full" onClick={handleAddAppliance}>Add Appliance</Button>
                        </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {appliances.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No appliances added yet. Click "Add Appliance" to register your first appliance.
              </p>
            ) : (
              <div className="space-y-4">
                {appliances.map((appliance, index) => {
                  const Icon = getIcon(appliance.name)
                  const isEditing = editingId === appliance.id
                  return (
                    <div key={appliance.id}>
                      {index > 0 && <Separator className="mb-4" />}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                              <Icon className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{appliance.name}</p>
                              <p className="text-xs text-muted-foreground">ID: {appliance.id}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                              {isEditing ? (
                                  <>
                                    <Button size="sm" onClick={() => handleUpdateAppliance(appliance.id)}>Save</Button>
                                    <Button size="sm" variant="ghost" onClick={() => toggleEdit(appliance.id)}>Cancel</Button>
                                  </>
                              ) : (
                                  <Button size="sm" variant="outline" onClick={() => toggleEdit(appliance.id)}>Edit</Button>
                              )}
                              <Button variant="ghost" size="icon" onClick={() => handleRemoveAppliance(appliance.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 ml-13">
                          <div className="space-y-2">
                            <Label htmlFor={`${appliance.id}-count`} className="text-sm">
                              Units
                            </Label>
                            <Input
                              id={`${appliance.id}-count`}
                              type="number"
                              min="1"
                              value={appliance.quantity}
                              disabled={!isEditing}
                              onChange={(e) => {
                                const value = Number.parseInt(e.target.value) || 1
                                updateLocalAppliance(appliance.id, "quantity", value)
                              }}
                              className={cn(
                                isEditing && isValueInvalid(appliance.name, 'quantity', appliance.quantity) && "border-red-500 ring-2 ring-red-500/20"
                              )}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`${appliance.id}-watt`} className="text-sm">
                              Power (Watts)
                            </Label>
                            <Input
                              id={`${appliance.id}-watt`}
                              type="number"
                              min="0"
                              value={appliance.watt}
                              disabled={!isEditing}
                              onChange={(e) => {
                                const value = Number.parseFloat(e.target.value) || 0
                                updateLocalAppliance(appliance.id, "watt", value)
                              }}
                              className={cn(
                                isEditing && isValueInvalid(appliance.name, 'watt', appliance.watt) && "border-red-500 ring-2 ring-red-500/20"
                              )}
                            />
                          </div>
                        </div>
                        
                        {/* Time Range Inputs */}
                        <div className="grid grid-cols-2 gap-4 ml-13 mt-2">
                          <div className="space-y-2">
                            <Label htmlFor={`${appliance.id}-start`} className="text-sm">
                              Start Time
                            </Label>
                            <Input
                              id={`${appliance.id}-start`}
                              type="time"
                              value={appliance.usage_start_time || ""}
                              disabled={!isEditing}
                              onChange={(e) =>
                                updateLocalAppliance(appliance.id, "usage_start_time", e.target.value)
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`${appliance.id}-end`} className="text-sm">
                              End Time
                            </Label>
                            <Input
                              id={`${appliance.id}-end`}
                              type="time"
                              value={appliance.usage_end_time || ""}
                              disabled={!isEditing}
                              onChange={(e) =>
                                updateLocalAppliance(appliance.id, "usage_end_time", e.target.value)
                              }
                            />
                          </div>
                        </div>
                        
                        {/* Calculated Breakdown Display */}
                        <div className="ml-13 mt-2 p-2 bg-muted/30 rounded text-xs flex gap-4">
                            <div>
                                <span className="text-muted-foreground">Daily: </span>
                                <span className="font-medium">{appliance.daily_usage_hours?.toFixed(2) || 0}h</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Peak: </span>
                                <span className="font-medium text-chart-3">{appliance.peak_usage_hours?.toFixed(2) || 0}h</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Off-Peak: </span>
                                <span className="font-medium text-chart-1">{appliance.off_peak_usage_hours?.toFixed(2) || 0}h</span>
                            </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Update your password to keep your account secure</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button onClick={handleChangePassword} variant="outline" className="w-full sm:w-auto bg-transparent">
              Update Password
            </Button>
          </CardContent>
        </Card>

        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>Logout from your account</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={handleLogout} className="w-full sm:w-auto">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
