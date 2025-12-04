"use client";
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { MALAYSIAN_LOCATIONS, NEM_RATES, type LocationName } from "@/constants/solar-data";
import { Sun, Battery, MapPin, TrendingUp, DollarSign, Info, Zap } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SolarSimulatorProps {
    currentMonthlyBill: number;
    currentMonthlyKWh: number;
    profileBill?: number;
    profileKWh?: number;
}

export function SolarSimulator({ currentMonthlyBill, currentMonthlyKWh, profileBill, profileKWh }: SolarSimulatorProps) {
    const [hasBattery, setHasBattery] = useState(false);
    const [systemSize, setSystemSize] = useState(4); // kWp default
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<LocationName>("Selangor");

    // Data Source Mode
    const [sourceMode, setSourceMode] = useState<"simulator" | "manual">("simulator");
    const [manualBill, setManualBill] = useState(200);
    const [manualKWh, setManualKWh] = useState(500);

    // Initialize mode based on props
    useEffect(() => {
        if (currentMonthlyKWh === 0) {
            setSourceMode("manual");
        } else {
            setSourceMode("simulator");
        }
    }, [currentMonthlyKWh]);

    // Initialize manual values from profile
    useEffect(() => {
        if (profileBill !== undefined) setManualBill(profileBill);
        if (profileKWh !== undefined) setManualKWh(profileKWh);
    }, [profileBill, profileKWh]);

    // Determine effective values to use
    const effectiveBill = sourceMode === "simulator" ? currentMonthlyBill : manualBill;
    const effectiveKWh = sourceMode === "simulator" ? currentMonthlyKWh : manualKWh;

    // Constants
    const SYSTEM_COST_PER_KW = 4000; // RM per kW
    const BATTERY_COST = 12000; // RM for a standard home battery (~10kWh)
    const BATTERY_EFFICIENCY_BOOST = 0.30; // 30% more self-consumption with battery
    const BASE_SELF_CONSUMPTION = 0.60; // 60% self-consumption without battery (rest exported)

    // Get location-specific data
    const locationData = MALAYSIAN_LOCATIONS.find(loc => loc.name === selectedLocation)
        || MALAYSIAN_LOCATIONS.find(loc => loc.name === "Selangor")!;
    const peakSunHours = locationData.peakSunHours;

    // Use actual usage from props instead of estimating
    const estimatedMonthlyUsageKWh = effectiveKWh;

    // Recommend system size: cover ~80-100% of usage
    // If usage is 0, default to 4kW
    const recommendedSystemSize = estimatedMonthlyUsageKWh > 0
        ? Math.ceil((estimatedMonthlyUsageKWh / 30) / peakSunHours)
        : 4;

    // --- Solar Generation Calculations ---
    const dailyGenerationKWh = systemSize * peakSunHours;
    const monthlyGenerationKWh = dailyGenerationKWh * 30;

    // --- Self-Consumption vs Export Breakdown ---
    // Fix: Logic now compares Generation vs Daytime Demand instead of a fixed ratio.

    // Assumption: A typical home uses ~50% of energy during "solar hours" (8am-6pm) 
    // (including weekends, fridge, standby, etc.)
    const DAYTIME_USAGE_RATIO = 0.50;
    const BATTERY_CAPACITY_KWH = 10; // Standard 10kWh battery
    const BATTERY_CYCLES_PER_DAY = 0.9; // Usable capacity factor

    // 1. Calculate how much energy the house *needs* during the day
    const monthlyDaytimeDemandKWh = estimatedMonthlyUsageKWh * DAYTIME_USAGE_RATIO;

    // 2. Calculate how much extra energy the battery can shift from day to night
    const monthlyBatteryCapacityKWh = hasBattery
        ? BATTERY_CAPACITY_KWH * BATTERY_CYCLES_PER_DAY * 30
        : 0;

    // 3. Total capacity to absorb solar energy (Daytime usage + Battery charging)
    const maxSolarAbsorptionKWh = Math.min(
        estimatedMonthlyUsageKWh, // Can't consume more than total usage
        monthlyDaytimeDemandKWh + monthlyBatteryCapacityKWh
    );

    // 4. Actual Self-Consumption is the lesser of what we Generate vs what we can Absorb
    const monthlySelfConsumptionKWh = Math.min(monthlyGenerationKWh, maxSolarAbsorptionKWh);

    // 5. The rest is exported
    const monthlyExportKWh = Math.max(0, monthlyGenerationKWh - monthlySelfConsumptionKWh);

    // --- Determine applicable rates ---
    // Use HIGH tier rates if monthly usage exceeds 1500 kWh
    const isHighUsage = estimatedMonthlyUsageKWh > 1500;
    const retailPeakRate = isHighUsage ? NEM_RATES.RETAIL_HIGH_PEAK : NEM_RATES.RETAIL_LOW_PEAK;
    const nemExportRate = isHighUsage ? NEM_RATES.ENERGY_EXPORT_HIGH : NEM_RATES.ENERGY_EXPORT_LOW;

    // --- Savings Calculation ---
    // Self-consumption: Saves full retail rate (direct offset)
    const selfConsumptionSavings = monthlySelfConsumptionKWh * retailPeakRate;

    // Export: Only gets energy component credit (NEM 2025)
    const exportCredits = monthlyExportKWh * nemExportRate;

    const totalMonthlySavings = selfConsumptionSavings + exportCredits;

    // --- ROI Calculation ---
    const totalSystemCost = (systemSize * SYSTEM_COST_PER_KW) + (hasBattery ? BATTERY_COST : 0);
    const paybackMonths = totalMonthlySavings > 0 ? totalSystemCost / totalMonthlySavings : 0;
    const paybackYears = paybackMonths / 12;

    return (
        <Card className="border-orange-200 bg-orange-50/30">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
                            <Sun className="h-5 w-5" />
                        </div>
                        <div>
                            <CardTitle>Solar Potential Simulator</CardTitle>
                            <CardDescription>Estimate savings with TNB NEM 3.0 (2025)</CardDescription>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
                        {isExpanded ? "Hide Simulator" : "Simulate Solar"}
                    </Button>
                </div>
            </CardHeader>

            {isExpanded && (
                <CardContent className="space-y-6">
                    {/* Data Source Selection */}
                    <div className="bg-white p-4 rounded-xl border shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Comparison Source</Label>
                            <Tabs value={sourceMode} onValueChange={(v) => setSourceMode(v as "simulator" | "manual")} className="w-[400px]">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="simulator">Appliance Simulator</TabsTrigger>
                                    <TabsTrigger value="manual">Manual Input</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>

                        {sourceMode === "simulator" ? (
                            <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border text-sm">
                                <div className="grid gap-1">
                                    <span className="text-muted-foreground">Simulated Bill</span>
                                    <span className="font-semibold">RM {currentMonthlyBill.toFixed(2)}</span>
                                </div>
                                <div className="w-px h-8 bg-slate-200" />
                                <div className="grid gap-1">
                                    <span className="text-muted-foreground">Simulated Usage</span>
                                    <span className="font-semibold">{currentMonthlyKWh.toFixed(0)} kWh</span>
                                </div>
                                {currentMonthlyKWh === 0 && (
                                    <div className="ml-auto text-amber-600 flex items-center gap-2">
                                        <Info className="h-4 w-4" />
                                        <span>No data from simulator</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="manual-bill">Monthly Bill (RM)</Label>
                                    <div className="relative">
                                        <div className="absolute left-3 top-0 bottom-0 flex items-center pointer-events-none">
                                            <span className="text-sm text-muted-foreground">RM</span>
                                        </div>
                                        <Input
                                            id="manual-bill"
                                            type="number"
                                            value={manualBill}
                                            onChange={(e) => setManualBill(Number(e.target.value))}
                                            className="pl-9"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="manual-kwh">Monthly Usage (kWh)</Label>
                                    <div className="relative">
                                        <Input
                                            id="manual-kwh"
                                            type="number"
                                            value={manualKWh}
                                            onChange={(e) => setManualKWh(Number(e.target.value))}
                                            className="pr-12"
                                        />
                                        <div className="absolute right-3 top-0 bottom-0 flex items-center pointer-events-none">
                                            <span className="text-sm text-muted-foreground">kWh</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Location Selection - Full Width */}
                    <div className="bg-white p-4 rounded-xl border shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-blue-500" />
                                Location
                            </Label>
                            <div className="w-[400px]">
                                <Select value={selectedLocation} onValueChange={(val) => setSelectedLocation(val as LocationName)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select location" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {MALAYSIAN_LOCATIONS.map((loc) => (
                                            <SelectItem key={loc.name} value={loc.name}>
                                                {loc.name} ({loc.peakSunHours}h sun)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-slate-50 p-2 rounded border">
                            <Info className="h-3 w-3" />
                            <span>Peak sun hours in {selectedLocation}: <span className="font-semibold text-slate-700">{peakSunHours}h/day</span></span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        {/* Group 1: System Configuration & Generation */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card className="bg-white border-slate-200 shadow-sm">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Sun className="h-5 w-5 text-orange-500" />
                                        System Configuration
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* System Size Slider */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <Label className="text-sm font-medium">System Size</Label>
                                                <p className="text-xs text-muted-foreground">
                                                    Recommended: <span className="font-medium text-orange-600">{recommendedSystemSize} kWp</span>
                                                </p>
                                            </div>
                                            <span className="font-bold text-lg">{systemSize} kWp</span>
                                        </div>
                                        <Slider
                                            value={[systemSize]}
                                            onValueChange={(vals) => setSystemSize(vals[0])}
                                            min={1}
                                            max={20}
                                            step={0.5}
                                            className="py-2"
                                        />
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>1 kWp</span>
                                            <span>10 kWp</span>
                                            <span>20 kWp</span>
                                        </div>
                                    </div>

                                    {/* Battery Toggle */}
                                    <div className="flex items-center justify-between pt-4 border-t">
                                        <div className="space-y-0.5">
                                            <Label className="text-sm font-medium flex items-center gap-2">
                                                <Battery className={`h-4 w-4 ${hasBattery ? "text-green-500" : "text-muted-foreground"}`} />
                                                Add Battery Storage
                                            </Label>
                                            <p className="text-xs text-muted-foreground">Store energy for peak usage</p>
                                        </div>
                                        <Switch checked={hasBattery} onCheckedChange={setHasBattery} />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-orange-50 border-orange-200 shadow-sm flex flex-col justify-center">
                                <CardContent className="p-6 text-center space-y-2">
                                    <div className="mx-auto w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-2">
                                        <Zap className="h-6 w-6 text-orange-600" />
                                    </div>
                                    <p className="text-sm font-medium text-muted-foreground">Estimated Monthly Generation</p>
                                    <p className="text-4xl font-bold text-orange-700">{monthlyGenerationKWh.toFixed(0)} <span className="text-lg font-normal text-orange-600">kWh</span></p>
                                    <p className="text-xs text-muted-foreground">
                                        Based on {peakSunHours} peak sun hours/day in {selectedLocation}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Group 2: Energy Usage & Savings */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card className="bg-white border-slate-200 shadow-sm">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <TrendingUp className="h-5 w-5 text-blue-500" />
                                        Energy Usage Breakdown
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Self-Consumed (Solar)</span>
                                                <span className="font-medium text-green-700">{monthlySelfConsumptionKWh.toFixed(0)} kWh</span>
                                            </div>
                                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-green-500"
                                                    style={{ width: `${monthlyGenerationKWh > 0 ? (monthlySelfConsumptionKWh / monthlyGenerationKWh) * 100 : 0}%` }}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Exported to Grid (NEM)</span>
                                                <span className="font-medium text-blue-700">{monthlyExportKWh.toFixed(0)} kWh</span>
                                            </div>
                                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-blue-500"
                                                    style={{ width: `${monthlyGenerationKWh > 0 ? (monthlyExportKWh / monthlyGenerationKWh) * 100 : 0}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-800 flex gap-2">
                                        <Info className="h-4 w-4 shrink-0 mt-0.5" />
                                        <p>
                                            {hasBattery
                                                ? "Battery increases self-consumption to ~90%, reducing exports and maximizing savings."
                                                : "Without battery, ~60% is self-consumed. Excess is exported to TNB at NEM credit rates."}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-green-50 border-green-200 shadow-sm">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base flex items-center gap-2 text-green-800">
                                        <DollarSign className="h-5 w-5 text-green-600" />
                                        Estimated Monthly Savings
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground">Bill Reduction</span>
                                            <span className="font-medium text-green-700">RM {selfConsumptionSavings.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground">NEM Export Credits</span>
                                            <span className="font-medium text-blue-700">RM {exportCredits.toFixed(2)}</span>
                                        </div>
                                        <div className="border-t border-green-200 pt-2 flex justify-between items-center">
                                            <span className="font-bold text-green-900">Total Savings</span>
                                            <span className="text-2xl font-bold text-green-700">RM {totalMonthlySavings.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <div className="text-xs text-green-600 text-right">
                                        Reduces bill by {effectiveBill > 0 ? Math.min(100, (totalMonthlySavings / effectiveBill) * 100).toFixed(0) : 0}%
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Group 3: Investment & ROI */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card className="bg-white border-slate-200 shadow-sm">
                                <CardContent className="p-6 flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground mb-1">Estimated System Cost</p>
                                        <p className="text-2xl font-bold text-slate-900">RM {totalSystemCost.toLocaleString()}</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {hasBattery ? "Includes 10kWh Battery" : "Solar PV System Only"}
                                        </p>
                                    </div>
                                    <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center">
                                        <DollarSign className="h-5 w-5 text-slate-600" />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-slate-900 text-white border-slate-800 shadow-sm">
                                <CardContent className="p-6 flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-slate-400 mb-1">Estimated Payback Period</p>
                                        <p className="text-2xl font-bold">{paybackYears.toFixed(1)} <span className="text-lg font-normal text-slate-400">Years</span></p>
                                        <p className="text-xs text-slate-500 mt-1">Return on Investment</p>
                                    </div>
                                    <div className="h-10 w-10 bg-slate-800 rounded-full flex items-center justify-center">
                                        <TrendingUp className="h-5 w-5 text-green-400" />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </CardContent>
            )}
        </Card>
    );
}
