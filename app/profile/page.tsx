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
import { completeSetup, updateProfile, updateBudget, updateProfileBill } from "./actions"
import { getAppliances } from "../appliances/actions"

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
}

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [appliances, setAppliances] = useState<Appliance[]>([])
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [savedMessage, setSavedMessage] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isEditingUsername, setIsEditingUsername] = useState(false)
  const [isEditingBudget, setIsEditingBudget] = useState(false)
  const [monthlyBudget, setMonthlyBudget] = useState(150)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  
  // Bill Details State
  const [billAmount, setBillAmount] = useState(0)
  const [billKwh, setBillKwh] = useState(0)
  const [isEditingBill, setIsEditingBill] = useState(false)
  
  // New Appliance Form State
  const [selectedType, setSelectedType] = useState("")
  const [newQuantity, setNewQuantity] = useState(1)
  const [newWatt, setNewWatt] = useState(0)

  const { toast } = useToast()

  useEffect(() => {
    // Fetch appliances on load
    getAppliances().then((data) => {
      setAppliances(data as any)
    })

    // Fetch user details
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser(user)
        setEmail(user.email || "")
        setLoading(false)
        
        // Fetch profile data
        supabase
          .from('profiles')
          .select('username, monthly_budget_target, total_bill_amount, total_kwh_usage')
          .eq('id', user.id)
          .single()
          .then(({ data: profile }) => {
            if (profile) {
              if (profile.username) setName(profile.username)
              if (profile.monthly_budget_target) setMonthlyBudget(profile.monthly_budget_target)
              if (profile.total_bill_amount) setBillAmount(profile.total_bill_amount)
              if (profile.total_kwh_usage) setBillKwh(profile.total_kwh_usage)
            }
          })
      } else {
        setLoading(false)
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
  }

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

  const handleSaveBudget = async () => {
    const result = await updateBudget(monthlyBudget)
    
    if (result.error) {
      setSavedMessage(result.error)
    } else {
      setSavedMessage("Budget updated successfully!")
      setIsEditingBudget(false)
    }
    setTimeout(() => setSavedMessage(""), 3000)
  }

  const handleSaveBill = async () => {
    const result = await updateProfileBill(billAmount, billKwh)
    
    if (result.error) {
      setSavedMessage(result.error)
    } else {
      setSavedMessage("Bill details updated successfully!")
      setIsEditingBill(false)
    }
    setTimeout(() => setSavedMessage(""), 3000)
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

  const handleAddAppliance = async () => {
    if (!selectedType) return

    const type = applianceTypes.find(t => t.id === selectedType)
    if (!type) return

    // For new appliances added in profile, use default usage hours
    // These will be recalculated when the user updates their bill or runs analysis
    const defaultUsageHours = 6 // Default fallback
    const PEAK_RATIO = 0.6
    const peakHours = defaultUsageHours * PEAK_RATIO
    const offPeakHours = defaultUsageHours * (1 - PEAK_RATIO)

    const newAppliance = {
      user_id: user.id,
      name: type.name,
      watt: newWatt,
      quantity: newQuantity,
      daily_usage_hours: defaultUsageHours,
      peak_usage_hours: peakHours,
      off_peak_usage_hours: offPeakHours
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

    setAppliances([...appliances, data])
    setIsAddDialogOpen(false)
    // Reset form
    setSelectedType("")
    setNewQuantity(1)
    setNewWatt(0)
    
    toast({
      title: "Appliance added",
      description: `${type.name} has been added to your profile. Usage hours will be calculated automatically.`,
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
          setAppliances(appliances.map(a => a.id === id ? data : a))
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
        return { ...app, [field]: value }
      }
      return app
    }))
  }

  const handleUpdateAppliance = async (id: string) => {
    const appliance = appliances.find(a => a.id === id)
    if (!appliance) return

    // Only allow updating quantity and watt - usage hours are calculated automatically
    const { error } = await supabase
      .from('appliances')
      .update({
        quantity: appliance.quantity,
        watt: appliance.watt,
        // Usage hours are read-only, calculated by ML service
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
                onChange={(e) => setMonthlyBudget(parseFloat(e.target.value) || 0)} 
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
                            <p className="text-xs text-muted-foreground">
                              Usage hours will be calculated automatically based on your energy consumption patterns.
                            </p>
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
                {appliances.map((appliance) => {
                  const Icon = getIcon(appliance.name)
                  const isEditing = editingId === appliance.id
                  
                  if (isEditing) {
                    return (
                      <div key={appliance.id} className="flex flex-col gap-4 p-4 border rounded-lg bg-muted/30">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-full">
                              <Icon className="h-5 w-5 text-primary" />
                            </div>
                            <span className="font-medium">{appliance.name}</span>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleUpdateAppliance(appliance.id)}>
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => toggleEdit(appliance.id)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Quantity</Label>
                            <Input 
                              type="number" 
                              min="1" 
                              value={appliance.quantity} 
                              onChange={(e) => updateLocalAppliance(appliance.id, 'quantity', parseInt(e.target.value) || 1)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Power (Watts)</Label>
                            <Input 
                              type="number" 
                              min="0" 
                              value={appliance.watt} 
                              onChange={(e) => updateLocalAppliance(appliance.id, 'watt', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                          <p>Usage Hours: {appliance.daily_usage_hours?.toFixed(1)}h/day (calculated automatically)</p>
                          <p>Peak: {appliance.peak_usage_hours?.toFixed(1)}h • Off-Peak: {appliance.off_peak_usage_hours?.toFixed(1)}h</p>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div key={appliance.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-primary/10 rounded-full">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{appliance.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {appliance.quantity} units • {appliance.watt}W • {appliance.daily_usage_hours?.toFixed(1)}h/day
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="icon" variant="ghost" onClick={() => toggleEdit(appliance.id)}>
                          <Zap className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleRemoveAppliance(appliance.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
