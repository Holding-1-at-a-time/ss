// Vehicle damage zone mapping and utilities
export interface VehicleZone {
  id: string
  name: string
  category: "exterior" | "interior" | "mechanical"
  repairComplexity: "low" | "medium" | "high"
  typicalDamageTypes: string[]
}

export const VEHICLE_ZONES: Record<string, VehicleZone> = {
  // Front exterior
  front_bumper: {
    id: "front_bumper",
    name: "Front Bumper",
    category: "exterior",
    repairComplexity: "medium",
    typicalDamageTypes: ["scratch", "dent", "crack"],
  },
  front_grille: {
    id: "front_grille",
    name: "Front Grille",
    category: "exterior",
    repairComplexity: "low",
    typicalDamageTypes: ["crack", "chip"],
  },
  headlights: {
    id: "headlights",
    name: "Headlights",
    category: "exterior",
    repairComplexity: "high",
    typicalDamageTypes: ["crack", "chip"],
  },
  hood: {
    id: "hood",
    name: "Hood",
    category: "exterior",
    repairComplexity: "high",
    typicalDamageTypes: ["dent", "scratch", "chip"],
  },
  windshield: {
    id: "windshield",
    name: "Windshield",
    category: "exterior",
    repairComplexity: "high",
    typicalDamageTypes: ["crack", "chip"],
  },

  // Rear exterior
  rear_bumper: {
    id: "rear_bumper",
    name: "Rear Bumper",
    category: "exterior",
    repairComplexity: "medium",
    typicalDamageTypes: ["scratch", "dent", "crack"],
  },
  taillights: {
    id: "taillights",
    name: "Taillights",
    category: "exterior",
    repairComplexity: "medium",
    typicalDamageTypes: ["crack", "chip"],
  },
  trunk: {
    id: "trunk",
    name: "Trunk",
    category: "exterior",
    repairComplexity: "high",
    typicalDamageTypes: ["dent", "scratch"],
  },
  rear_windshield: {
    id: "rear_windshield",
    name: "Rear Windshield",
    category: "exterior",
    repairComplexity: "high",
    typicalDamageTypes: ["crack", "chip"],
  },

  // Side exterior
  driver_door: {
    id: "driver_door",
    name: "Driver Door",
    category: "exterior",
    repairComplexity: "high",
    typicalDamageTypes: ["dent", "scratch"],
  },
  passenger_door: {
    id: "passenger_door",
    name: "Passenger Door",
    category: "exterior",
    repairComplexity: "high",
    typicalDamageTypes: ["dent", "scratch"],
  },
  driver_rear_door: {
    id: "driver_rear_door",
    name: "Driver Rear Door",
    category: "exterior",
    repairComplexity: "high",
    typicalDamageTypes: ["dent", "scratch"],
  },
  passenger_rear_door: {
    id: "passenger_rear_door",
    name: "Passenger Rear Door",
    category: "exterior",
    repairComplexity: "high",
    typicalDamageTypes: ["dent", "scratch"],
  },

  // Interior
  dashboard: {
    id: "dashboard",
    name: "Dashboard",
    category: "interior",
    repairComplexity: "high",
    typicalDamageTypes: ["crack", "stain", "tear"],
  },
  seats: {
    id: "seats",
    name: "Seats",
    category: "interior",
    repairComplexity: "medium",
    typicalDamageTypes: ["stain", "tear", "burn"],
  },
  door_panels: {
    id: "door_panels",
    name: "Door Panels",
    category: "interior",
    repairComplexity: "medium",
    typicalDamageTypes: ["stain", "tear", "scratch"],
  },
  console: {
    id: "console",
    name: "Center Console",
    category: "interior",
    repairComplexity: "medium",
    typicalDamageTypes: ["scratch", "stain"],
  },
  carpet: {
    id: "carpet",
    name: "Carpet",
    category: "interior",
    repairComplexity: "low",
    typicalDamageTypes: ["stain", "tear"],
  },
  headliner: {
    id: "headliner",
    name: "Headliner",
    category: "interior",
    repairComplexity: "high",
    typicalDamageTypes: ["stain", "tear"],
  },

  // Wheels and tires
  front_left_wheel: {
    id: "front_left_wheel",
    name: "Front Left Wheel",
    category: "exterior",
    repairComplexity: "medium",
    typicalDamageTypes: ["scratch", "dent"],
  },
  front_right_wheel: {
    id: "front_right_wheel",
    name: "Front Right Wheel",
    category: "exterior",
    repairComplexity: "medium",
    typicalDamageTypes: ["scratch", "dent"],
  },
  rear_left_wheel: {
    id: "rear_left_wheel",
    name: "Rear Left Wheel",
    category: "exterior",
    repairComplexity: "medium",
    typicalDamageTypes: ["scratch", "dent"],
  },
  rear_right_wheel: {
    id: "rear_right_wheel",
    name: "Rear Right Wheel",
    category: "exterior",
    repairComplexity: "medium",
    typicalDamageTypes: ["scratch", "dent"],
  },

  // Top
  roof: {
    id: "roof",
    name: "Roof",
    category: "exterior",
    repairComplexity: "high",
    typicalDamageTypes: ["dent", "scratch"],
  },
  sunroof: {
    id: "sunroof",
    name: "Sunroof",
    category: "exterior",
    repairComplexity: "high",
    typicalDamageTypes: ["crack", "chip"],
  },
}

// Validation functions
export function isValidDamageZone(zoneId: string): boolean {
  return zoneId in VEHICLE_ZONES
}

export function getZonesByCategory(category: "exterior" | "interior" | "mechanical"): VehicleZone[] {
  return Object.values(VEHICLE_ZONES).filter((zone) => zone.category === category)
}

export function getTypicalDamageTypes(zoneId: string): string[] {
  const zone = VEHICLE_ZONES[zoneId]
  return zone ? zone.typicalDamageTypes : []
}

export function getRepairComplexity(zoneId: string): "low" | "medium" | "high" | null {
  const zone = VEHICLE_ZONES[zoneId]
  return zone ? zone.repairComplexity : null
}

// Calculate repair time estimate based on zone and damage type
export function estimateRepairTime(zoneId: string, damageType: string, severity: string): number {
  const zone = VEHICLE_ZONES[zoneId]
  if (!zone) return 1 // Default 1 hour

  const baseTime = {
    low: 0.5,
    medium: 2,
    high: 4,
  }[zone.repairComplexity]

  const severityMultiplier =
    {
      minor: 1,
      moderate: 2,
      major: 4,
      severe: 8,
    }[severity as keyof typeof severityMultiplier] || 1

  const damageTypeMultiplier =
    {
      scratch: 1,
      dent: 1.5,
      chip: 0.5,
      crack: 2,
      stain: 0.8,
      burn: 3,
      tear: 1.2,
      other: 1,
    }[damageType as keyof typeof damageTypeMultiplier] || 1

  return baseTime * severityMultiplier * damageTypeMultiplier
}
