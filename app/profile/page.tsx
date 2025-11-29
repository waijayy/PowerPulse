"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { 
  LogOut, 
  User, 
  Mail, 
  Shield, 
  Zap, 
  Plus, 
  Trash2, 
  Save, 
  Lightbulb, 
  Tv, 
  Fan, 
  Refrigerator, 
  WashingMachine, 
  Monitor, 
  Smartphone,
  Eye,
  EyeOff
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { completeSetup } from "./actions"

type ApplianceType = {
  id: string
  name: string
  icon: any
  defaultWatt: number
}

const applianceTypes: ApplianceType[] = [
  { id: "lights", name: "Lights (LED)", icon: Lightbulb, defaultWatt: 10 },
  { id: "fan", name: "Ceiling Fan", icon: Fan, defaultWatt: 75 },
  { id: "ac", name: "Air Conditioner", icon: Zap, defaultWatt: 1000 },
  { id: "tv", name: "Television", icon: Tv, defaultWatt: 100 },
  { id: "fridge", name: "Refrigerator", icon: Refrigerator, defaultWatt: 150 },
  { id: "washer", name: "Washing Machine", icon: WashingMachine, defaultWatt: 500 },
  { id: "pc", name: "Desktop PC", icon: Monitor, defaultWatt: 200 },
  { id: "phone", name: "Phone Charger", icon: Smartphone, defaultWatt: 20 },
]

type Appliance = {
  id: string
  name: string
  watt: number
  quantity: number
  daily_usage_hours: number
  peak_usage_hours: number
  off_peak_usage_hours: number
  // UI state fields
  startTime?: string
  endTime?: string
  alwaysOn?: boolean
}

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [appliances, setAppliances] = useState<Appliance[]>([])
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  // Bill Details State
  const [billAmount, setBillAmount] = useState<number>(0)
  const [billKwh, setBillKwh] = useState<number>(0)
  const [isEditingBill, setIsEditingBill] = useState(false)

  // Budget Target State
  const [monthlyBudget, setMonthlyBudget] = useState<number>(150)
  const [isEditingBudget, setIsEditingBudget] = useState(false)

  // Add Appliance Dialog State
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<string>("")
  const [newQuantity, setNewQuantity] = useState<number>(1)
  const [newWatt, setNewWatt] = useState<number>(0)
  const [newStartTime, setNewStartTime] = useState<string>("18:00")
  const [newEndTime, setNewEndTime] = useState<string>("22:00")
  const [newAlwaysOn, setNewAlwaysOn] = useState<boolean>(false)

  // Edit Appliance State
  const [editingId, setEditingId] = useState<string | null>(null)

  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login")
        return
      }
      setUser(user)
      
      // Fetch profile data
      const { data: profile } = await supabase
        .from('profiles')
        .select('total_bill_amount, total_kwh_usage, monthly_budget_target')
        .eq('id', user.id)
        .single()
      
      if (profile) {
        setBillAmount(profile.total_bill_amount || 0)
        setBillKwh(profile.total_kwh_usage || 0)
        if (profile.monthly_budget_target) {
          setMonthlyBudget(profile.monthly_budget_target)
        }
      }

      // Fetch appliances
      const { data: appliancesData } = await supabase
        .from('appliances')
        .select('*')
        .eq('user_id', user.id)
      
      if (appliancesData) {
        // Initialize UI state fields
        const formattedAppliances = appliancesData.map((app: any) => ({
          ...app,
          alwaysOn: app.daily_usage_hours === 24,
          startTime: "18:00", // Default since we don't store it
          endTime: "22:00"    // Default since we don't store it
        }))
        setAppliances(formattedAppliances)
      }
      
      setLoading(false)
    }
    getUser()
  }, [router, supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Please ensure both passwords are the same.",
        variant: "destructive",
      })
      return
    }

    if (newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      })
      return
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (error) {
      toast({
        title: "Error updating password",
        description: error.message,
        variant: "destructive",
      })
    } else {
      toast({
        title: "Password updated",
        description: "Your password has been successfully changed.",
      })
      setNewPassword("")
      setConfirmPassword("")
    }
  }

  const handleSaveBill = async () => {
    try {
      // Use the server action to save bill details
      await completeSetup(billAmount, billKwh, monthlyBudget)

      setIsEditingBill(false)
      toast({
        title: "Bill details updated",
        description: "Your electricity bill information has been saved.",
      })
    } catch (error) {
      console.error('Error updating bill details:', error)
      toast({
        title: "Error",
        description: "Failed to update bill details. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleSaveBudget = async () => {
    try {
      // Use the server action to save budget target
      await completeSetup(billAmount, billKwh, monthlyBudget)

      setIsEditingBudget(false)
      toast({
        title: "Budget target updated",
        description: "Your monthly budget target has been saved.",
      })
    } catch (error) {
      console.error('Error updating budget:', error)
      toast({
        title: "Error",
        description: "Failed to update budget target. Please try again.",
        variant: "destructive",
      })
    }
  }

  const calculateUsageHours = (start: string, end: string, isAlwaysOn: boolean) => {
    if (isAlwaysOn) {
      return {
        daily: 24,
        peak: 14, // Assuming 8am-10pm peak (14 hours)
        offPeak: 10
      }
    }

    const [startHour, startMinute] = start.split(':').map(Number)
    const [endHour, endMinute] = end.split(':').map(Number)
    
    // Check if it's effectively 24 hours (00:00 to 23:59)
    if (start === "00:00" && end === "23:59") {
      return {
        daily: 24,
        peak: 14,
        offPeak: 10
      }
    }
    
    let daily = (endHour + endMinute/60) - (startHour + startMinute/60)
    if (daily < 0) daily += 24 // Handle overnight usage
    
    // Simple peak calculation (8am - 10pm is peak)
    // This is a simplified logic, a more robust one would intersect time ranges
    let peak = 0
    let offPeak = 0
    
    // For simplicity in this demo, we'll just use a ratio based on the hours
    // In a real app, we'd calculate exact overlap with peak windows
    const peakStart = 8
    const peakEnd = 22
    
    // Very basic approximation for the demo
    if (startHour >= peakStart && endHour <= peakEnd && startHour < endHour) {
      peak = daily
    } else if ((startHour >= peakEnd || endHour <= peakStart) && startHour < endHour) {
      offPeak = daily
    } else {
      // Mixed usage, split 70/30 for demo purposes if crossing boundaries
      peak = daily * 0.7
      offPeak = daily * 0.3
    }

    return { daily, peak, offPeak }
  }

  const handleAddAppliance = async () => {
    if (!selectedType) return

    const type = applianceTypes.find(t => t.id === selectedType)
    if (!type) return

    const usage = calculateUsageHours(newStartTime, newEndTime, newAlwaysOn)

    const newAppliance = {
      user_id: user.id,
      name: type.name,
      watt: newWatt,
      quantity: newQuantity,
      daily_usage_hours: usage.daily,
      peak_usage_hours: usage.peak,
      off_peak_usage_hours: usage.offPeak
    }

    const { data, error } = await supabase
      .from('appliances')
      .insert(newAppliance)
      .select()
      .single()

    if (error) {
      toast({
        title: "Error adding appliance",
        description: error.message,
        variant: "destructive",
      })
      return
    }

    const formattedAppliance = {
      ...data,
      alwaysOn: data.daily_usage_hours === 24,
      startTime: "18:00",
      endTime: "22:00"
    }

    setAppliances([...appliances, formattedAppliance])
    setIsAddDialogOpen(false)
    // Reset form
    setSelectedType("")
    setNewQuantity(1)
    setNewWatt(0)
    setNewStartTime("18:00")
    setNewEndTime("22:00")
    setNewAlwaysOn(false)
    
    toast({
      title: "Appliance added",
      description: `${type.name} has been added to your profile.`,
    })
  }

  const handleRemoveAppliance = async (id: string) => {
    const { error } = await supabase
      .from('appliances')
      .delete()
      .eq('id', id)

    if (error) {
      toast({
        title: "Error removing appliance",
        description: error.message,
        variant: "destructive",
      })
      return
    }

    setAppliances(appliances.filter(a => a.id !== id))
    toast({
      title: "Appliance removed",
      description: "The appliance has been removed from your profile.",
    })
  }

  const toggleEdit = (id: string) => {
    if (editingId === id) {
      // Cancel edit
      setEditingId(null)
      // Re-fetch to reset local state
      const fetchAppliance = async () => {
        const { data } = await supabase
          .from('appliances')
          .select('*')
          .eq('id', id)
          .single()
        
        if (data) {
          const formattedAppliance = {
            ...data,
            alwaysOn: data.daily_usage_hours === 24,
            startTime: "18:00",
            endTime: "22:00"
          }
          setAppliances(appliances.map(a => a.id === id ? formattedAppliance : a))
        }
      }
      fetchAppliance()
    } else {
      setEditingId(id)
    }
  }

  const updateLocalAppliance = (id: string, field: string, value: any) => {
    setAppliances(appliances.map(app => {
      if (app.id === id) {
        const updatedApp = { ...app, [field]: value }
        
        // Handle Always On logic
        if (field === 'alwaysOn') {
          if (value === true) {
            updatedApp.startTime = "00:00"
            updatedApp.endTime = "23:59"
          } else {
            updatedApp.startTime = "18:00"
            updatedApp.endTime = "22:00"
          }
        }

        // Recalculate usage hours if time or alwaysOn changes
        if (field === 'startTime' || field === 'endTime' || field === 'alwaysOn') {
          const usage = calculateUsageHours(
            updatedApp.startTime || "18:00", 
            updatedApp.endTime || "22:00", 
            updatedApp.alwaysOn || false
          )
          updatedApp.daily_usage_hours = usage.daily
          updatedApp.peak_usage_hours = usage.peak
          updatedApp.off_peak_usage_hours = usage.offPeak
        }
        
        return updatedApp
      }
      return app
    }))
  }

  const handleUpdateAppliance = async (id: string) => {
    const appliance = appliances.find(a => a.id === id)
    if (!appliance) return

    const { error } = await supabase
      .from('appliances')
      .update({
        quantity: appliance.quantity,
        watt: appliance.watt,
        daily_usage_hours: appliance.daily_usage_hours,
        peak_usage_hours: appliance.peak_usage_hours,
        off_peak_usage_hours: appliance.off_peak_usage_hours
      })
      .eq('id', id)

    if (error) {
      toast({
        title: "Error updating appliance",
        description: error.message,
        variant: "destructive",
      })
      return
    }

    setEditingId(null)
    toast({
      title: "Appliance updated",
      description: "The appliance details have been updated.",
    })
  }

  const getIcon = (name: string) => {
    const type = applianceTypes.find(t => name.toLowerCase().includes(t.name.toLowerCase()) || name.toLowerCase().includes(t.id))
    return type ? type.icon : Zap
  }

  const isValueInvalid = (typeId: string, field: 'quantity' | 'watt', value: number) => {
    if (value < 0) return true
    if (field === 'quantity') {
      if (value === 0) return false // Allow 0 during typing, but validate on submit
      if (typeId === 'lights' && value > 200) return true
      if (typeId !== 'lights' && value > 50) return true
    }
    if (field === 'watt') {
      if (value > 99999) return true
    }
    return false
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-[calc(100vh-100px)]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto pb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Profile & Settings</h1>
          <p className="text-muted-foreground">Manage your account settings and preferences.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input id="email" value={user?.email} disabled className="pl-9" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <div className="relative">
                  <Shield className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input id="role" value={user?.role || "User"} disabled className="pl-9" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Budget Settings</CardTitle>
            <CardDescription>Set your monthly electricity budget goal</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="budget">Monthly Budget Target (RM)</Label>
              <Input 
                id="budget" 
                type="number" 
                min="50"
                max="1000"
                step="10"
                value={monthlyBudget} 
                onChange={(e) => setMonthlyBudget(parseFloat(e.target.value) || 150)} 
                disabled={!isEditingBudget}
                className={!isEditingBudget ? "bg-muted" : ""}
              />
              <p className="text-xs text-muted-foreground">
                Your current target: RM {monthlyBudget}
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
                  onChange={(e) => setBillAmount(parseFloat(e.target.value) || 0)} 
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
                  onChange={(e) => setBillKwh(parseFloat(e.target.value) || 0)} 
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
                  setNewAlwaysOn(false)
                }
              }}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Appliance
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
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
                            <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="new-always-on"
                                  checked={newAlwaysOn}
                                  onChange={(e) => {
                                      setNewAlwaysOn(e.target.checked)
                                      if (e.target.checked) {
                                          setNewStartTime("00:00")
                                          setNewEndTime("23:59")
                                      } else {
                                          setNewStartTime("18:00")
                                          setNewEndTime("22:00")
                                      }
                                  }}
                                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <Label htmlFor="new-always-on" className="text-sm cursor-pointer">Always On (24 Hours)</Label>
                            </div>
                            <div className={cn("grid grid-cols-2 gap-4", newAlwaysOn && "opacity-50 pointer-events-none")}>
                                <div className="space-y-2">
                                    <Label>Start Time</Label>
                                    <Input type="time" value={newStartTime} onChange={(e) => setNewStartTime(e.target.value)} disabled={newAlwaysOn} />
                                </div>
                                <div className="space-y-2">
                                    <Label>End Time</Label>
                                    <Input type="time" value={newEndTime} onChange={(e) => setNewEndTime(e.target.value)} disabled={newAlwaysOn} />
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
                        
                        {isEditing && (
                          <div className="ml-13 space-y-3 border rounded-lg p-3 bg-muted/30 mt-4">
                            <div className="flex items-center space-x-2 mb-3">
                                <input
                                  type="checkbox"
                                  id={`${appliance.id}-always-on`}
                                  checked={appliance.alwaysOn}
                                  onChange={(e) => updateLocalAppliance(appliance.id, "alwaysOn", e.target.checked)}
                                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <Label htmlFor={`${appliance.id}-always-on`} className="text-sm cursor-pointer">Always On (24 Hours)</Label>
                            </div>
                            <div className={cn("grid grid-cols-2 gap-4", appliance.alwaysOn && "opacity-50 pointer-events-none")}>
                                <div className="space-y-2">
                                    <Label className="text-xs">Start Time</Label>
                                    <Input 
                                      type="time" 
                                      value={appliance.startTime} 
                                      onChange={(e) => updateLocalAppliance(appliance.id, "startTime", e.target.value)} 
                                      disabled={appliance.alwaysOn}
                                      className="h-8"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">End Time</Label>
                                    <Input 
                                      type="time" 
                                      value={appliance.endTime} 
                                      onChange={(e) => updateLocalAppliance(appliance.id, "endTime", e.target.value)} 
                                      disabled={appliance.alwaysOn}
                                      className="h-8"
                                    />
                                </div>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-3 gap-4 mt-2 text-sm ml-13">
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
