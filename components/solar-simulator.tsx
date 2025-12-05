"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { MALAYSIAN_LOCATIONS, NEM_RATES, type LocationName } from "@/constants/solar-data";
import { Sun, Battery, MapPin, TrendingUp, DollarSign, Info, Zap, LayoutGrid } from "lucide-react";
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

// Standard Residential Solar Panel Specifications
const PANEL_SPECS = {
    wattage: 400, // Watts per panel
    width: 1.13, // meters
    height: 1.72, // meters
    area: 2, // square meters (approx)
    thickness: 30, // mm
};

export function SolarSimulator({ currentMonthlyBill, currentMonthlyKWh, profileBill, profileKWh }: SolarSimulatorProps) {
    const [numberOfPanels, setNumberOfPanels] = useState(10); // Default 10 panels = 4kWp
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<LocationName>("Selangor");

    // Data Source Mode
    const [sourceMode, setSourceMode] = useState<"simulator" | "manual">("simulator");
    const [manualBill, setManualBill] = useState(200);
    const [manualKWh, setManualKWh] = useState(500);

    // Calculate system size from number of panels
    const systemSize = (numberOfPanels * PANEL_SPECS.wattage) / 1000; // kWp
    const totalPanelArea = numberOfPanels * PANEL_SPECS.area; // m²

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
    const hasBattery = true; // Battery is always included

    // Get location-specific data
    const locationData = MALAYSIAN_LOCATIONS.find(loc => loc.name === selectedLocation)
        || MALAYSIAN_LOCATIONS.find(loc => loc.name === "Selangor")!;
    const peakSunHours = locationData.peakSunHours;

    // Use actual usage from props instead of estimating
    const estimatedMonthlyUsageKWh = effectiveKWh;

    // Recommend panel count: cover ~80-100% of usage
    const recommendedPanels = estimatedMonthlyUsageKWh > 0
        ? Math.ceil((estimatedMonthlyUsageKWh / 30) / peakSunHours / (PANEL_SPECS.wattage / 1000))
        : 10;

    // --- Solar Generation Calculations ---
    const dailyGenerationKWh = systemSize * peakSunHours;
    const monthlyGenerationKWh = dailyGenerationKWh * 30;

    // --- Self-Consumption vs Export Breakdown ---
    const DAYTIME_USAGE_RATIO = 0.50;
    const BATTERY_CAPACITY_KWH = 10;
    const BATTERY_CYCLES_PER_DAY = 0.9;

    const monthlyDaytimeDemandKWh = estimatedMonthlyUsageKWh * DAYTIME_USAGE_RATIO;
    const monthlyBatteryCapacityKWh = hasBattery
        ? BATTERY_CAPACITY_KWH * BATTERY_CYCLES_PER_DAY * 30
        : 0;

    const maxSolarAbsorptionKWh = Math.min(
        estimatedMonthlyUsageKWh,
        monthlyDaytimeDemandKWh + monthlyBatteryCapacityKWh
    );

    const monthlySelfConsumptionKWh = Math.min(monthlyGenerationKWh, maxSolarAbsorptionKWh);
    const monthlyExportKWh = Math.max(0, monthlyGenerationKWh - monthlySelfConsumptionKWh);

    // --- Determine applicable rates ---
    const isHighUsage = estimatedMonthlyUsageKWh > 1500;
    const retailPeakRate = isHighUsage ? NEM_RATES.RETAIL_HIGH_PEAK : NEM_RATES.RETAIL_LOW_PEAK;
    const nemExportRate = isHighUsage ? NEM_RATES.ENERGY_EXPORT_HIGH : NEM_RATES.ENERGY_EXPORT_LOW;

    // --- Savings Calculation ---
    const selfConsumptionSavings = monthlySelfConsumptionKWh * retailPeakRate;
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
                    <div className="bg-white p-4 rounded-xl border shadow-sm">
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
                    </div>

                    {/* === NEW LAYOUT === */}
                    {/* Top Section: System Configuration (contains nested Generation & Usage cards) */}
                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Sun className="h-5 w-5 text-orange-500" />
                                System Configuration
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Panel Count Slider */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-medium flex items-center gap-2">
                                            <LayoutGrid className="h-4 w-4 text-orange-500" />
                                            Number of Panels
                                        </Label>
                                        <p className="text-xs text-muted-foreground">
                                            Recommended: <span className="font-medium text-orange-600">{recommendedPanels} panels</span>
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-bold text-lg">{numberOfPanels} panels</span>
                                        <p className="text-xs text-muted-foreground">{systemSize.toFixed(1)} kWp</p>
                                    </div>
                                </div>
                                <Slider
                                    value={[numberOfPanels]}
                                    onValueChange={(vals) => setNumberOfPanels(vals[0])}
                                    min={2}
                                    max={36}
                                    step={1}
                                    className="py-2"
                                />
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>2 panels</span>
                                    <span>18 panels</span>
                                    <span>36 panels</span>
                                </div>
                            </div>

                            {/* Panel Specifications Info */}
                            <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600 border">
                                <p className="font-medium text-slate-700 mb-1">Standard Residential Panel Specs:</p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <div>
                                        <span className="text-muted-foreground">Per Panel:</span>
                                        <span className="font-medium ml-1">{PANEL_SPECS.wattage}W</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Size:</span>
                                        <span className="font-medium ml-1">{PANEL_SPECS.height}m × {PANEL_SPECS.width}m</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Total Area:</span>
                                        <span className="font-medium ml-1">{totalPanelArea} m²</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Thickness:</span>
                                        <span className="font-medium ml-1">{PANEL_SPECS.thickness}mm</span>
                                    </div>
                                </div>
                            </div>


                            {/* Generation & Energy Usage Info - No wrappers */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
                                {/* Estimated Monthly Generation */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                                            <Zap className="h-5 w-5 text-orange-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Estimated Monthly Generation</p>
                                            <p className="text-2xl font-bold text-orange-700">{monthlyGenerationKWh.toFixed(0)} <span className="text-sm font-normal text-orange-600">kWh</span></p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Based on {peakSunHours} peak sun hours/day
                                    </p>
                                </div>

                                {/* Energy Usage Consumption */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                            <TrendingUp className="h-4 w-4 text-blue-600" />
                                        </div>
                                        <p className="text-sm font-medium text-muted-foreground">Energy Usage Consumption</p>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Self-Consumed</span>
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
                                                <span className="text-muted-foreground">Exported to Grid</span>
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
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Bottom Section: Estimated Monthly Savings */}
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

                            {/* Nested: System Cost & Payback Period */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4 border-t border-green-200">
                                <Card className="bg-white border-slate-200">
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-muted-foreground mb-1">Estimated System Cost</p>
                                            <p className="text-xl font-bold text-slate-900">RM {totalSystemCost.toLocaleString()}</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {hasBattery ? "Includes 10kWh Battery" : "Solar PV System Only"}
                                            </p>
                                        </div>
                                        <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center">
                                            <DollarSign className="h-5 w-5 text-slate-600" />
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="bg-slate-900 text-white border-slate-800">
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-slate-400 mb-1">Estimated Payback Period</p>
                                            <p className="text-xl font-bold">{paybackYears.toFixed(1)} <span className="text-base font-normal text-slate-400">Years</span></p>
                                            <p className="text-xs text-slate-500 mt-1">Return on Investment</p>
                                        </div>
                                        <div className="h-10 w-10 bg-slate-800 rounded-full flex items-center justify-center">
                                            <TrendingUp className="h-5 w-5 text-green-400" />
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </CardContent>
                    </Card>
                </CardContent>
            )}
        </Card>
    );
}
