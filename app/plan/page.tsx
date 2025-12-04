"use client";

import { useState, useEffect, useRef } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Loader2,
  Sparkles,
  Calendar,
  TrendingDown,
  Target,
  AirVent,
  Refrigerator,
  WashingMachine,
  Tv,
  Monitor,
  Lightbulb,
  Fan,
  Microwave,
  Clock,
  User,
  ArrowRight,
  Zap,
  Bot,
  Pencil,
  Check,
  X,
  Banknote,
  Save,
} from "lucide-react";
import { updateBudget } from "../profile/actions";
import { useToast } from "@/components/ui/use-toast";

type ApplianceData = {
  id: number;
  name: string;
  quantity: number;
  watt: number;
  peak_usage_hours: number;
  off_peak_usage_hours: number;
  monthly_cost: number;
};

type PlanItem = {
  name: string;
  current_hours: string;
  planned_hours: string;
  planned_peak_hours?: number;
  planned_off_peak_hours?: number;
  planned_peak_hours_weekday?: number;
  planned_off_peak_hours_weekday?: number;
  planned_peak_hours_weekend?: number;
  planned_offpeak_hours_weekend?: number;
  suggested_time_weekday?: string;
  suggested_time_weekend?: string;
  monthly_savings: number;
  change: string;
};

type Plan = {
  plan: PlanItem[];
  projected_bill: number;
  total_savings: number;
  explanation: string;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  plan?: Plan;
};

const applianceIcons: Record<string, React.ElementType> = {
  "Air Conditioner": AirVent,
  Refrigerator: Refrigerator,
  "Washing Machine": WashingMachine,
  Television: Tv,
  "Computer/PC": Monitor,
  "LED Lights": Lightbulb,
  "Ceiling Fan": Fan,
  Microwave: Microwave,
};

export default function PlanPage() {
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [appliances, setAppliances] = useState<ApplianceData[]>([]);
  const [currentBill, setCurrentBill] = useState(0);
  const [targetBill, setTargetBill] = useState(120);
  const [tempTargetBill, setTempTargetBill] = useState("120");
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [lastMonthBill, setLastMonthBill] = useState(0);

  const [activeTab, setActiveTab] = useState<"weekday" | "weekend">("weekday");
  const [showPlanner, setShowPlanner] = useState(false);
  const [hasGeneratedPlan, setHasGeneratedPlan] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Chat state
  const [initialEstimatedCost, setInitialEstimatedCost] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Generated plan state
  const [generatedPlan, setGeneratedPlan] = useState<Plan | null>(null);

  // Auto-scroll chat only when there are messages
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Load appliances
  useEffect(() => {
    async function loadPlanData() {
      try {
        const [appliancesRes, billingRes] = await Promise.all([
          fetch("/api/appliances"),
          fetch("/api/billing"),
        ]);

        if (billingRes.ok) {
          const billingData = await billingRes.json();
          if (typeof billingData.lastMonthBill === "number") {
            setLastMonthBill(billingData.lastMonthBill);
          }
          if (typeof billingData.targetBill === "number") {
            setTargetBill(billingData.targetBill);
            setTempTargetBill(billingData.targetBill.toString());
          }
        }

        if (appliancesRes.ok) {
          const data = await appliancesRes.json();

          if (data.profile) {
            // Only override billing data if the dedicated fetch failed
            if (!billingRes.ok) {
              setLastMonthBill(data.profile.total_bill_amount || 0);
              setTargetBill(data.profile.monthly_budget_target || 150);
              setTempTargetBill(data.profile.monthly_budget_target || 150);
            }

          }

          // Load saved planning data if it exists
          if (data.planning) {
            setGeneratedPlan(data.planning);
            setHasGeneratedPlan(true);
            setShowPlanner(true);
          }

          if (data.appliances && data.appliances.length > 0) {
            const peakRate = 0.2583;
            const offPeakRate = 0.2443;

            const appliancesWithCosts = data.appliances.map(
              (app: ApplianceData) => {
                const kWh = app.watt / 1000;
                const dailyCost =
                  app.quantity *
                  kWh *
                  (app.peak_usage_hours * peakRate +
                    app.off_peak_usage_hours * offPeakRate);

                return {
                  ...app,
                  monthly_cost: dailyCost * 30,
                };
              }
            );

            setAppliances(appliancesWithCosts);
            const total = appliancesWithCosts.reduce(
              (sum: number, a: ApplianceData) => sum + a.monthly_cost,
              0
            );
            setCurrentBill(total);
          }
        }
      } catch (err) {
        console.error("Failed to load appliances:", err);
      } finally {
        setIsLoadingData(false);
      }
    }

    loadPlanData();
  }, []);

  // Calculate estimated bill from planning table data
  // Use the projected_bill from saved plan, otherwise fallback to current bill
  const calculateEstimatedBill = () => {
    // If we have a generated/saved plan, use its projected_bill directly
    if (generatedPlan?.projected_bill) {
      return generatedPlan.projected_bill;
    }

    // If no plan exists, use current bill as fallback
    return currentBill;
  };

  const displayedBill = calculateEstimatedBill();
  const progressPercent = Math.min((displayedBill / targetBill) * 100, 100);
  const isUnderBudget = displayedBill <= targetBill;

  async function handleChatSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    // Capture the initial estimated cost before the first AI interaction
    if (initialEstimatedCost === null) {
      setInitialEstimatedCost(displayedBill);
    }

    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          targetBill: targetBill,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.error },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.explanation || "Here's your optimized plan!",
            plan: data,
          },
        ]);
        // Update the main display with the generated plan
        if (data.plan) {
          setGeneratedPlan(data);
          setShowPlanner(true);

        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Failed to generate plan. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  const getApplianceIcon = (name: string) => {
    const Icon = applianceIcons[name] || Lightbulb;
    return Icon;
  };

  const handleEditTarget = () => {
    setTempTargetBill(targetBill.toString());
    setIsEditingTarget(true);
  };

  const handleCancelTarget = () => {
    setTempTargetBill(targetBill.toString());
    setIsEditingTarget(false);
  };

  const handleSaveTarget = async () => {
    const nextTarget = parseFloat(tempTargetBill || "0") || 0;
    const res = await updateBudget(nextTarget);
    if (res.success) {
      // Update target immediately so calculation updates right away
      setTargetBill(nextTarget);
      setIsEditingTarget(false);

      // Clear old plan immediately so displayedBill recalculates based on new target
      setGeneratedPlan(null);


      // Automatically generate a new plan when target changes
      if (appliances.length > 0) {
        setIsLoading(true);
        try {
          const planRes = await fetch("/api/plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: "", // Empty message to use existing plan as baseline
              targetBill: nextTarget,
            }),
          });

          const planData = await planRes.json();

          if (planData.error) {
            console.error("Failed to auto-generate plan:", planData.error);
            // Still clear old plan even if generation fails
            setShowPlanner(false);
            setHasGeneratedPlan(false);
            setGeneratedPlan(null);
            setMessages([]);
          } else {
            // Successfully generated new plan
            setGeneratedPlan(planData);
            setShowPlanner(true);


            // Don't add automatic message - let user interact with chatbot when ready
            // Clear any existing messages so chatbot starts fresh
            setMessages([]);
          }
        } catch (err) {
          console.error("Error auto-generating plan:", err);
          // Clear old plan on error
          setShowPlanner(false);
          setHasGeneratedPlan(false);
          setGeneratedPlan(null);
          setMessages([]);
        } finally {
          setIsLoading(false);
        }
      } else {
        // No appliances, just clear old plan
        setShowPlanner(false);
        setHasGeneratedPlan(false);
        setGeneratedPlan(null);
        setMessages([]);
      }
    } else {
      console.error("Failed to save budget");
    }
  };

  const handleSavePlan = async () => {
    if (!generatedPlan) return;
    
    setIsSaving(true);
    try {
      const res = await fetch("/api/plan/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planData: generatedPlan,
          targetBill: targetBill,
        }),
      });

      if (res.ok) {
        toast({
          title: "Success",
          description: "Plan saved successfully!",
        });
        setHasGeneratedPlan(true);
      } else {
        toast({
          title: "Error",
          description: "Failed to save plan",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Error saving plan:", err);
      toast({
        title: "Error",
        description: "An error occurred while saving",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const potentialSavings = Math.max(0, lastMonthBill - targetBill);



  // Get planned hours for an appliance (from plan or current)
  // Uses weekday/weekend specific hours if available, otherwise falls back to average
  const getPlannedHours = (appliance: ApplianceData) => {
    if (generatedPlan?.plan) {
      const planItem = generatedPlan.plan.find(
        (p) =>
          p.name.toLowerCase().includes(appliance.name.toLowerCase()) ||
          appliance.name.toLowerCase().includes(p.name.toLowerCase())
      );
      if (planItem) {
        // Check if plan has weekday/weekend specific hours
        if (
          typeof planItem.planned_peak_hours_weekday === "number" &&
          typeof planItem.planned_off_peak_hours_weekday === "number"
        ) {
          // Use weekday or weekend hours based on active tab
          if (activeTab === "weekend") {
            return {
              peak: 0, // Weekend has no peak hours
              offpeak: planItem.planned_offpeak_hours_weekend || 0,
              total: planItem.planned_offpeak_hours_weekend || 0,
              suggestedTime: planItem.suggested_time_weekend || "",
              change: planItem.change,
            };
          } else {
            return {
              peak: planItem.planned_peak_hours_weekday,
              offpeak: planItem.planned_off_peak_hours_weekday,
              total: planItem.planned_peak_hours_weekday + planItem.planned_off_peak_hours_weekday,
              suggestedTime: planItem.suggested_time_weekday || "",
              change: planItem.change,
            };
          }
        }

        // Fallback: try to parse from planned_hours string
        const peakMatch = planItem.planned_hours?.match(
          /(\d+\.?\d*)\s*h?\s*peak/i
        );
        const offpeakMatch = planItem.planned_hours?.match(
          /(\d+\.?\d*)\s*h?\s*off-?peak/i
        );
        const peak = peakMatch ? parseFloat(peakMatch[1]) : appliance.peak_usage_hours;
        const offpeak = offpeakMatch ? parseFloat(offpeakMatch[1]) : appliance.off_peak_usage_hours;
        return {
          peak,
          offpeak,
          total: peak + offpeak,
          suggestedTime: "",
          change: planItem.change,
        };
      }
    }
    return {
      peak: appliance.peak_usage_hours,
      offpeak: appliance.off_peak_usage_hours,
      total: appliance.peak_usage_hours + appliance.off_peak_usage_hours,
      suggestedTime: "",
      change: "",
    };
  };

  if (isLoadingData) {
    return (
      <AppShell>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">
              Loading your energy profile...
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Last Month's Bill */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-orange-100">
                  <Calendar className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Last Month&apos;s Bill
                  </p>
                  <p className="text-3xl font-bold mt-1">
                    RM {lastMonthBill.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Previous billing period
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Database record: RM {lastMonthBill.toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Target Next Month */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Target Next Month
                    </p>
                    {isEditingTarget ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={handleSaveTarget}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={handleCancelTarget}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-primary"
                        onClick={handleEditTarget}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                  </div>

                  {isEditingTarget ? (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-2xl font-bold">RM</span>
                      <Input
                        type="number"
                        value={tempTargetBill}
                        onChange={(e) => setTempTargetBill(e.target.value)}
                        className="w-24 h-9 text-lg font-bold"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <p className="text-3xl font-bold mt-1">
                      RM {targetBill.toFixed(2)}
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground mt-1">
                    Your savings goal
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Potential Savings */}
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <Banknote className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Potential Savings
                  </p>
                  <p className="text-3xl font-bold mt-1 text-green-600">
                    RM {potentialSavings.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Calculated: RM {lastMonthBill.toFixed(2)} - RM{" "}
                    {targetBill.toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Generate / Regenerate Plan Button */}
        {!showPlanner && (
          <div className="flex justify-center">
            <Button
              size="lg"
              className="mt-2 px-8"
              onClick={() => setShowPlanner(true)}
              disabled={appliances.length === 0}
            >
              {hasGeneratedPlan
                ? "Generate New Plan"
                : "Generate Personalized Plan"}
            </Button>
          </div>
        )}

        {/* Estimated Monthly Cost */}
        {showPlanner && (
          <Card>
            <CardContent className="py-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold">Your Estimated Monthly Cost</h3>
                  <p className="text-sm text-muted-foreground">
                    {generatedPlan
                      ? "Based on AI optimized usage plan"
                      : "Based on current usage plan"}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-3xl font-bold ${isUnderBudget ? "text-green-600" : "text-orange-500"
                      }`}
                  >
                    RM {displayedBill.toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {lastMonthBill > 0
                      ? Math.round((displayedBill / lastMonthBill) * 100)
                      : 100}
                    % of last month
                  </p>
                </div>
              </div>
              <Progress
                value={progressPercent}
                className={`h-3 ${isUnderBudget
                  ? "[&>div]:bg-green-500"
                  : "[&>div]:bg-orange-500"
                  }`}
              />
              <div className="flex justify-between mt-2 text-sm">
                <span className="text-muted-foreground">
                  Target: RM {targetBill}
                </span>
                <span
                  className={
                    isUnderBudget ? "text-green-600" : "text-orange-500"
                  }
                >
                  Current: RM {displayedBill.toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {showPlanner && (
          <>
            {/* Personalized Appliance Schedule */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      Personalized Appliance Schedule
                      {generatedPlan && (
                        <Badge className="bg-green-500 text-white">
                          AI Optimized
                        </Badge>
                      )}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Daily usage hours optimized for maximum savings
                    </p>
                  </div>
                  <Button 
                    onClick={handleSavePlan} 
                    disabled={isSaving}
                    className="gap-2"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Plan
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                  <Button
                    variant={activeTab === "weekday" ? "default" : "outline"}
                    onClick={() => setActiveTab("weekday")}
                    className="rounded-full"
                  >
                    Weekday
                  </Button>
                  <Button
                    variant={activeTab === "weekend" ? "default" : "outline"}
                    onClick={() => setActiveTab("weekend")}
                    className="rounded-full"
                  >
                    Weekend
                  </Button>
                </div>

                {/* Appliance Cards */}
                <div className="space-y-4">
                  {appliances.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No appliances found.</p>
                      <a href="/setup" className="text-primary underline">
                        Set up your appliances
                      </a>
                    </div>
                  ) : (
                    appliances.map((appliance) => {
                      const Icon = getApplianceIcon(appliance.name);
                      const hours = getPlannedHours(appliance);

                      // Check if appliance has been adjusted
                      const currentTotal = appliance.peak_usage_hours + appliance.off_peak_usage_hours;
                      const plannedTotal = hours.total;
                      // Check if total hours changed OR if peak/off-peak distribution changed
                      const isTotalChanged = Math.abs(currentTotal - plannedTotal) > 0.1;
                      const isPeakChanged = Math.abs(appliance.peak_usage_hours - (hours.peak || 0)) > 0.1;

                      const hasChanges = (isTotalChanged || isPeakChanged) &&
                        hours.change &&
                        !hours.change.toLowerCase().includes('no changes') &&
                        !hours.change.toLowerCase().includes('no change');

                      return (
                        <Card
                          key={appliance.id}
                          className={`bg-muted/30 ${hasChanges ? "border-2 border-green-500 shadow-sm" : ""}`}
                        >
                          <CardContent className="py-4">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <Icon className="h-5 w-5 text-primary" />
                              </div>
                              <span className="font-medium">
                                {appliance.name}
                              </span>
                              {hasChanges && (
                                <Badge variant="outline" className="ml-auto border-green-500 text-green-600 bg-green-50">
                                  Modified
                                </Badge>
                              )}
                            </div>
                            {activeTab === "weekend" ? (
                              // Weekend: Show only total hours (all off-peak)
                              <div className="bg-slate-100 rounded-lg p-4">
                                <div className="text-sm text-muted-foreground mb-1">
                                  <span className="text-primary font-medium">
                                    Total Hours <span className="text-xs">(All off-peak - Sat & Sun)</span>
                                  </span>
                                </div>
                                <p className="text-3xl font-bold text-primary">
                                  {hours.total?.toFixed(1) || hours.offpeak?.toFixed(1)}h
                                </p>
                              </div>
                            ) : (
                              // Weekday: Show peak and off-peak separately
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="bg-blue-50 rounded-lg p-4">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                      <Clock className="h-4 w-4" />
                                      <span>Peak Hours <span className="text-xs">(2pm-10pm)</span></span>
                                    </div>
                                    <p className="text-3xl font-bold text-primary">
                                      {hours.peak?.toFixed(1)}h
                                    </p>
                                  </div>
                                  <div className="bg-slate-100 rounded-lg p-4">
                                    <div className="text-sm text-muted-foreground mb-1">
                                      Off-Peak Hours <span className="text-xs">(10pm-2pm next day)</span>
                                    </div>
                                    <p className="text-3xl font-bold text-primary">
                                      {hours.offpeak?.toFixed(1)}h
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            {/* AI Chatbot Section */}
            <Card>
              <CardHeader className="border-b">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle>AI Energy Planner</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Tell me what you want and I&apos;ll optimize your schedule
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* Chat Messages */}
                <div className="h-[400px] overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 && (
                    <div className="h-full flex items-center justify-center text-center">
                      <div className="space-y-4">
                        <Bot className="h-12 w-12 text-purple-500 mx-auto opacity-50" />
                        <div>
                          <p className="font-medium">
                            What would you like to adjust?
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            I&apos;ll optimize your schedule to stay under
                            budget
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-center">
                          {[
                            "I want to use more AC",
                            "Help me save money",
                            "Reduce my TV usage",
                            "Shift laundry to night",
                          ].map((suggestion, i) => (
                            <Button
                              key={i}
                              variant="outline"
                              size="sm"
                              onClick={() => setInput(suggestion)}
                            >
                              {suggestion}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {messages.map((msg, i) => {
                    // 1. Calculate the Theoretical Current Bill (based on original appliance list)
                    const calculatedCurrentBill = appliances.reduce((total, app) => {
                      const kWh = app.watt / 1000;
                      const peakRate = 0.2583;
                      const offPeakRate = 0.2443;

                      // Weekday (5 days): Use the daily peak/off-peak from the appliance object
                      const dailyWeekdayCost = app.quantity * kWh * (app.peak_usage_hours * peakRate + app.off_peak_usage_hours * offPeakRate);

                      // Weekend (2 days): Use the daily peak/off-peak from the appliance object (or assume all off-peak if that's the rule)
                      // The user said "off-peak hour: 2pm-10pm and all day Sat n Sun". 
                      // So for Weekend, we should treat ALL hours as off-peak.
                      // Total daily hours = peak + off_peak
                      const totalDailyHours = app.peak_usage_hours + app.off_peak_usage_hours;
                      const dailyWeekendCost = app.quantity * kWh * (totalDailyHours * offPeakRate);

                      const monthlyCost = (dailyWeekdayCost * (30 * 5 / 7)) + (dailyWeekendCost * (30 * 2 / 7));
                      return total + monthlyCost;
                    }, 0);

                    // 2. Calculate Scaling Ratio
                    // This ratio aligns the "Theoretical" bill with the "Actual/Displayed" bill (which might be from the database)
                    const scalingRatio = calculatedCurrentBill > 0 ? displayedBill / calculatedCurrentBill : 1;

                    // 3. Calculate the Latest Bill based on the plan
                    let calculatedLatestBill = 0;
                    if (msg.plan && msg.plan.plan) {
                      calculatedLatestBill = msg.plan.plan.reduce((total, item) => {
                        const appliance = appliances.find(
                          (a) =>
                            a.name.toLowerCase().includes(item.name.toLowerCase()) ||
                            item.name.toLowerCase().includes(a.name.toLowerCase())
                        );

                        if (appliance) {
                          const kWh = appliance.watt / 1000;
                          const peakRate = 0.2583;
                          const offPeakRate = 0.2443;

                          // Weekday cost (approx 21.4 days)
                          const weekdayPeakHours = item.planned_peak_hours_weekday || 0;
                          const weekdayOffPeakHours = item.planned_off_peak_hours_weekday || 0;
                          const dailyWeekdayCost =
                            appliance.quantity *
                            kWh *
                            (weekdayPeakHours * peakRate + weekdayOffPeakHours * offPeakRate);

                          // Weekend cost (approx 8.6 days)
                          // Assuming weekend is all off-peak as per user instruction "all day Sat n Sun"
                          const weekendHours = item.planned_offpeak_hours_weekend || 0;
                          const dailyWeekendCost =
                            appliance.quantity *
                            kWh *
                            (weekendHours * offPeakRate);

                          const monthlyCost = (dailyWeekdayCost * (30 * 5 / 7)) + (dailyWeekendCost * (30 * 2 / 7));
                          return total + monthlyCost;
                        }
                        return total;
                      }, 0);
                    }

                    // 4. Apply Scaling Ratio to Latest Bill
                    const rawLatestBill = calculatedLatestBill > 0 ? calculatedLatestBill : (msg.plan?.projected_bill || 0);
                    const latestBill = rawLatestBill * scalingRatio;

                    return (
                      <div key={i} className="space-y-3">
                        <div
                          className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"
                            }`}
                        >
                          {msg.role === "assistant" && (
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shrink-0">
                              <Sparkles className="h-4 w-4 text-white" />
                            </div>
                          )}
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                              }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          </div>
                          {msg.role === "user" && (
                            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                              <User className="h-4 w-4 text-primary-foreground" />
                            </div>
                          )}
                        </div>

                        {/* Show plan details */}
                        {msg.plan && (
                          <div className="ml-11 space-y-3">
                            {/* Summary cards */}
                            <div className="grid grid-cols-3 gap-2">
                              <div className="bg-muted/50 rounded-lg p-3 text-center">
                                <div className="text-xs text-muted-foreground">
                                  Current
                                </div>
                                <div className="font-bold">
                                  RM {(() => {
                                    // Find the most recent previous assistant message with a plan
                                    for (let j = i - 1; j >= 0; j--) {
                                      const prevMsg = messages[j];
                                      if (prevMsg.role === 'assistant' && prevMsg.plan?.projected_bill) {
                                        return prevMsg.plan.projected_bill.toFixed(2);
                                      }
                                    }
                                    // If no previous assistant message with plan, use initialEstimatedCost (captured before first chat)
                                    return (initialEstimatedCost || displayedBill).toFixed(2);
                                  })()}
                                </div>
                              </div>
                              <div className="bg-green-500/10 rounded-lg p-3 text-center border border-green-500/30">
                                <div className="text-xs text-muted-foreground">
                                  Latest
                                </div>
                                <div className="font-bold text-green-600">
                                  RM {(msg.plan?.projected_bill || 0).toFixed(2)}
                                </div>
                              </div>
                              {(() => {
                                // Calculate current bill (from previous assistant message or initialEstimatedCost)
                                let currentValue = initialEstimatedCost || displayedBill;
                                // Find the most recent previous assistant message with a plan
                                for (let j = i - 1; j >= 0; j--) {
                                  const prevMsg = messages[j];
                                  if (prevMsg.role === 'assistant' && prevMsg.plan?.projected_bill) {
                                    currentValue = prevMsg.plan.projected_bill;
                                    break;
                                  }
                                }
                                const latestValue = msg.plan?.projected_bill || 0;
                                const difference = currentValue - latestValue;
                                
                                return difference >= 0 ? (
                                  <div className="bg-green-500/10 rounded-lg p-3 text-center border border-green-500/30">
                                    <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                                      <TrendingDown className="h-3 w-3" /> You Save
                                    </div>
                                    <div className="font-bold text-green-600">
                                      RM {difference.toFixed(2)}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="bg-red-500/10 rounded-lg p-3 text-center border border-red-500/30">
                                    <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                                      <TrendingDown className="h-3 w-3 rotate-180" /> Bill Increase
                                    </div>
                                    <div className="font-bold text-red-600">
                                      RM {Math.abs(difference).toFixed(2)}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>

                            {/* Plan details */}
                            {msg.plan.plan && msg.plan.plan.length > 0 && (
                              <div className="bg-muted/30 rounded-xl p-4 space-y-3">
                                <div className="text-sm font-medium flex items-center gap-2">
                                  <Zap className="h-4 w-4 text-yellow-500" />
                                  Changes Applied to Your Schedule
                                </div>
                                {msg.plan.plan.map((item, j) => (
                                  <div
                                    key={j}
                                    className={`bg-background rounded-lg p-3 space-y-1 ${item.change &&
                                      !item.change.toLowerCase().includes('no changes') &&
                                      !item.change.toLowerCase().includes('no change')
                                      ? 'border-2 border-green-500'
                                      : ''
                                      }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium">
                                        {item.name}
                                      </span>
                                    </div>
                                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                                      <span>{item.current_hours}</span>
                                      <ArrowRight className="h-3 w-3" />
                                      <span className="text-green-600 font-medium whitespace-pre-line">
                                        {item.planned_hours}
                                      </span>
                                    </div>

                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm text-green-700">
                              ✓ Schedule above has been updated with these changes
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {isLoading && (
                    <div className="flex gap-3">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shrink-0">
                        <Loader2 className="h-4 w-4 text-white animate-spin" />
                      </div>
                      <div className="bg-muted rounded-2xl px-4 py-3">
                        <span className="text-sm text-muted-foreground">
                          Creating your personalized plan...
                        </span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Chat Input */}
                <div className="border-t p-4">
                  <form onSubmit={handleChatSubmit} className="flex gap-2">
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="e.g. I want to use more AC but stay under budget..."
                      disabled={isLoading || appliances.length === 0}
                      className="flex-1"
                    />
                    <Button
                      type="submit"
                      disabled={
                        isLoading || !input.trim() || appliances.length === 0
                      }
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}