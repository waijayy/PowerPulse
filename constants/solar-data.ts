// Malaysian Solar Irradiation Data
// Source: Real solar radiation data for Malaysian states
// Peak sun hours represent equivalent full-power hours per day

export const MALAYSIAN_LOCATIONS = [
    { name: "Perlis", peakSunHours: 4.1, region: "Northern" },
    { name: "Kedah", peakSunHours: 3.9, region: "Northern" },
    { name: "Penang", peakSunHours: 3.8, region: "Northern" },
    { name: "Perak", peakSunHours: 3.7, region: "Northern" },
    { name: "Selangor", peakSunHours: 3.6, region: "Central" },
    { name: "Kuala Lumpur", peakSunHours: 3.6, region: "Central" },
    { name: "Putrajaya", peakSunHours: 3.6, region: "Central" },
    { name: "Negeri Sembilan", peakSunHours: 3.7, region: "Central" },
    { name: "Melaka", peakSunHours: 3.8, region: "Southern" },
    { name: "Johor", peakSunHours: 3.9, region: "Southern" },
    { name: "Pahang", peakSunHours: 3.8, region: "East Coast" },
    { name: "Terengganu", peakSunHours: 3.9, region: "East Coast" },
    { name: "Kelantan", peakSunHours: 3.8, region: "East Coast" },
    { name: "Sabah", peakSunHours: 4.2, region: "East Malaysia" },
    { name: "Sarawak", peakSunHours: 4.5, region: "East Malaysia" },
] as const;

// TNB NEM 3.0 Rates (2025 Tariff Structure)
// Under the new structure, only energy component is offset for exported energy
export const NEM_RATES = {
    // Energy component rates (what NEM credits offset)
    ENERGY_EXPORT_LOW: 0.2703, // RM/kWh for <1500 kWh monthly usage
    ENERGY_EXPORT_HIGH: 0.3703, // RM/kWh for >1500 kWh monthly usage

    // Full retail rates (for self-consumption savings)
    RETAIL_LOW_PEAK: 0.2852, // RM/kWh
    RETAIL_HIGH_PEAK: 0.3852, // RM/kWh
    RETAIL_LOW_OFFPEAK: 0.2443, // RM/kWh
    RETAIL_HIGH_OFFPEAK: 0.3443, // RM/kWh
} as const;

export type LocationName = typeof MALAYSIAN_LOCATIONS[number]["name"];
