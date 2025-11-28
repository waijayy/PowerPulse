// TNB Electricity Tariff Rates (sen/kWh)
// Source: Tenaga Nasional Berhad (TNB) Tariff Schedule

export const ELECTRICITY_RATES = {
    // Category: Up to 1,500 kWh/month
    LOW_USAGE: {
        threshold: 1500, // kWh per month
        offPeak: 24.43, // sen/kWh
        peak: 28.52, // sen/kWh
    },
    // Category: Above 1,500 kWh/month
    HIGH_USAGE: {
        threshold: Infinity,
        offPeak: 34.43, // sen/kWh
        peak: 38.52, // sen/kWh
    },
} as const

// Helper function to get applicable rate based on monthly usage
export function getApplicableRate(monthlyUsageKWh: number) {
    if (monthlyUsageKWh <= ELECTRICITY_RATES.LOW_USAGE.threshold) {
        return ELECTRICITY_RATES.LOW_USAGE
    }
    return ELECTRICITY_RATES.HIGH_USAGE
}

// Convert sen to RM
export function senToRM(sen: number): number {
    return sen / 100
}
