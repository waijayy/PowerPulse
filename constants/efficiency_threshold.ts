// appliance-benchmarks.ts
// Efficient wattage thresholds for Malaysian household appliances.
// If user wattage > efficientMax → considered Not Efficient.

export const ApplianceEfficientMax = {
    led_light: 10,          // Efficient LED bulb ~7–10 W
    ceiling_fan: 75,        // Efficient ceiling fan ~50–75 W
    air_conditioner: 1200,  // Efficient 1.0 HP inverter AC ~900–1200 W
    television: 90,         // Efficient LED TV (32–45") ~60–90 W
    refrigerator: 200,      // Efficient fridge compressor draw ~100–200 W
    washing_machine: 500,   // Efficient front-load washer ~400–500 W
    desktop_pc: 200,        // Efficient office PC ~150–200 W
    phone_charger: 7        // Efficient charger ~4–7 W
  } as const;
  