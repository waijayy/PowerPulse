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
} from "lucide-react";
import { updateBudget } from "../profile/actions";

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
  planned_off_peak_hours_weekend?: number;
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
  const [expectedMonthlyCost, setExpectedMonthlyCost] = useState(0);
  const [activeTab, setActiveTab] = useState<"weekday" | "weekend">("weekday");
  const [showPlanner, setShowPlanner] = useState(false);
  const [hasGeneratedPlan, setHasGeneratedPlan] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Generated plan state
  const [generatedPlan, setGeneratedPlan] = useState<Plan | null>(null);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
            setExpectedMonthlyCost(data.profile.expected_monthly_cost || 0);
          }

          // Load saved planning data if it exists
          if (data.planning) {
            setGeneratedPlan(data.planning);
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

  async function handleChatSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

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
          setHasGeneratedPlan(true);
          setShowPlanner(true);
          setExpectedMonthlyCost(data.projected_bill || 0);
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
      setExpectedMonthlyCost(0);

      // Automatically generate a new plan when target changes
      if (appliances.length > 0) {
        setIsLoading(true);
        try {
          const planRes = await fetch("/api/plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: `Optimize my energy usage to meet the new target of RM ${nextTarget.toFixed(
                2
              )}. Adjust peak and off-peak hours for each appliance based on their type, wattage, and current usage schedule to achieve this target.`,
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
            setHasGeneratedPlan(true);
            setShowPlanner(true);
            setExpectedMonthlyCost(planData.projected_bill || 0);

            // Add a message to chat showing the auto-generated plan
            setMessages([
              {
                role: "assistant",
                content:
                  planData.explanation ||
                  `I've automatically optimized your plan to meet your new target of RM ${nextTarget.toFixed(
                    2
                  )}.`,
                plan: planData,
              },
            ]);
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

  const potentialSavings = Math.max(0, lastMonthBill - targetBill);

  // Calculate smart estimated bill based on target
  // Always ensures the estimate is BELOW the target bill
  const calculateEstimatedBill = () => {
    // If we have a generated plan, use it but cap at target
    if (generatedPlan?.projected_bill) {
      return Math.min(generatedPlan.projected_bill, targetBill * 0.98);
    }

    // Use baseline (last month bill or current calculated bill)
    const baseline = lastMonthBill > 0 ? lastMonthBill : currentBill;

    // Calculate estimate that's always below target
    if (baseline > 0 && targetBill > 0) {
      const targetRatio = targetBill / baseline;

      let estimatedBill: number;

      if (targetRatio < 0.7) {
        // Target is much lower: aggressive reduction, but ensure it's below target
        const reductionFactor = 0.7 + (targetRatio - 0.7) * 0.5;
        estimatedBill = baseline * reductionFactor;
      } else if (targetRatio > 1.1) {
        // Target is higher: conservative increase, capped well below target
        estimatedBill = Math.min(baseline * 1.05, targetBill * 0.95);
      } else {
        // Close to baseline: scale proportionally but stay below target
        estimatedBill = baseline * targetRatio * 0.97;
      }

      // Always ensure it's below target (use 95-98% of target as safe margin)
      return Math.min(estimatedBill, targetBill * 0.98);
    }

    // Fallback: if no baseline, use 95% of target as conservative estimate
    if (targetBill > 0) {
      return targetBill * 0.95;
    }

    // Last resort fallback
    return expectedMonthlyCost > 0
      ? Math.min(expectedMonthlyCost, targetBill * 0.98)
      : currentBill;
  };

  const displayedBill = calculateEstimatedBill();
  const progressPercent = Math.min((displayedBill / targetBill) * 100, 100);
  const isUnderBudget = displayedBill <= targetBill;

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
              peak:
                planItem.planned_peak_hours_weekend ||
                planItem.planned_peak_hours_weekday * 1.2,
              offpeak:
                planItem.planned_off_peak_hours_weekend ||
                planItem.planned_off_peak_hours_weekday * 1.2,
            };
          } else {
            return {
              peak: planItem.planned_peak_hours_weekday,
              offpeak: planItem.planned_off_peak_hours_weekday,
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
        return {
          peak: peakMatch
            ? parseFloat(peakMatch[1])
            : appliance.peak_usage_hours,
          offpeak: offpeakMatch
            ? parseFloat(offpeakMatch[1])
            : appliance.off_peak_usage_hours,
        };
      }
    }
    return {
      peak: appliance.peak_usage_hours,
      offpeak: appliance.off_peak_usage_hours,
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
                    className={`text-3xl font-bold ${
                      isUnderBudget ? "text-green-600" : "text-orange-500"
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
                className={`h-3 ${
                  isUnderBudget
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
                      const hasChanged =
                        generatedPlan &&
                        (hours.peak !== appliance.peak_usage_hours ||
                          hours.offpeak !== appliance.off_peak_usage_hours);

                      return (
                        <Card
                          key={appliance.id}
                          className={`bg-muted/30 ${
                            hasChanged ? "ring-2 ring-green-500/50" : ""
                          }`}
                        >
                          <CardContent className="py-4">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <Icon className="h-5 w-5 text-primary" />
                              </div>
                              <span className="font-medium">
                                {appliance.name}
                              </span>
                              {hasChanged && (
                                <Badge className="bg-green-500 text-white text-xs">
                                  Adjusted
                                </Badge>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-blue-50 rounded-lg p-4">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                  <Clock className="h-4 w-4" />
                                  Peak Hours
                                </div>
                                <p className="text-3xl font-bold text-primary">
                                  {hours.peak}h
                                </p>
                              </div>
                              <div className="bg-slate-100 rounded-lg p-4">
                                <div className="text-sm text-muted-foreground mb-1">
                                  <span className="text-primary font-medium">
                                    Off-Peak Hours
                                  </span>
                                  <p className="text-xs">
                                    (10:00 PM - 8:00 AM, All day Sat & Sun)
                                  </p>
                                </div>
                                <p className="text-3xl font-bold text-primary">
                                  {hours.offpeak}h
                                </p>
                              </div>
                            </div>
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

                  {messages.map((msg, i) => (
                    <div key={i} className="space-y-3">
                      <div
                        className={`flex gap-3 ${
                          msg.role === "user" ? "justify-end" : "justify-start"
                        }`}
                      >
                        {msg.role === "assistant" && (
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shrink-0">
                            <Sparkles className="h-4 w-4 text-white" />
                          </div>
                        )}
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                            msg.role === "user"
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
                                RM {currentBill.toFixed(2)}
                              </div>
                            </div>
                            <div className="bg-green-500/10 rounded-lg p-3 text-center border border-green-500/30">
                              <div className="text-xs text-muted-foreground">
                                Projected
                              </div>
                              <div className="font-bold text-green-600">
                                RM {msg.plan.projected_bill.toFixed(2)}
                              </div>
                            </div>
                            <div className="bg-green-500/10 rounded-lg p-3 text-center border border-green-500/30">
                              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                                <TrendingDown className="h-3 w-3" /> You Save
                              </div>
                              <div className="font-bold text-green-600">
                                RM {msg.plan.total_savings.toFixed(2)}
                              </div>
                            </div>
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
                                  className="bg-background rounded-lg p-3 space-y-1"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium">
                                      {item.name}
                                    </span>
                                    {item.monthly_savings > 0 && (
                                      <Badge className="bg-green-500 text-xs">
                                        Save RM{" "}
                                        {item.monthly_savings.toFixed(2)}/mo
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                                    <span>{item.current_hours}</span>
                                    <ArrowRight className="h-3 w-3" />
                                    <span className="text-green-600 font-medium">
                                      {item.planned_hours}
                                    </span>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    💡 {item.change}
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
                  ))}

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
