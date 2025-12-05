import {
    AirVent,
    Refrigerator,
    WashingMachine,
    Tv,
    Monitor,
    Lightbulb,
    Microwave,
    Fan,
    LucideIcon,
} from "lucide-react"

export type ApplianceType = {
    id: string
    name: string
    icon: LucideIcon
    defaultWatt: number
}

export const applianceTypes: ApplianceType[] = [
    { id: "ac", name: "Air Conditioner", icon: AirVent, defaultWatt: 1500 },
    { id: "fridge", name: "Refrigerator", icon: Refrigerator, defaultWatt: 300 },
    { id: "washer", name: "Washing Machine", icon: WashingMachine, defaultWatt: 650 },
    { id: "tv", name: "Television", icon: Tv, defaultWatt: 100 },
    { id: "pc", name: "Computer/PC", icon: Monitor, defaultWatt: 300 },
    { id: "lights", name: "LED Lights", icon: Lightbulb, defaultWatt: 12 },
    { id: "microwave", name: "Microwave", icon: Microwave, defaultWatt: 1000 },
    { id: "fan", name: "Ceiling Fan", icon: Fan, defaultWatt: 90 },
]

// Map frontend appliance names to ML service names
export const ML_SERVICE_NAME_MAP: Record<string, string> = {
    "Refrigerator": "Fridge",
    "Air Conditioner": "Air Conditioner",
    "Washing Machine": "Washing Machine",
    "Television": "Television",
    "Computer/PC": "Computer/PC",
    "LED Lights": "LED Lights", // May not be in ML service, but will use fallback
    "Microwave": "Microwave",
    "Ceiling Fan": "Ceiling Fan",
}
