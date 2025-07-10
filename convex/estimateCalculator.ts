import {
  calculateFilthinessMetrics,
  calculateWeatherImpact,
  calculateSurgeMultiplier,
  getCurrentTimeFactors,
  getSeasonalFactor,
  type WeatherConditions,
  type SurgeFactors,
} from "./filthinessUtils"

export interface EstimateCalculationInput {
  inspection: any
  damages: any[]
  serviceType: "basic_wash" | "detail" | "premium_detail" | "repair" | "custom"
  baseRates: {
    laborRate: number // per hour in cents
    materialRate: number // percentage of labor
    taxRate: number // percentage
  }
  shopSettings: {
    surgeEnabled: boolean
    weatherAdjustments: boolean
    minimumCharge: number // in cents
    maximumSurge: number // multiplier cap
  }
  weather?: WeatherConditions
  customSurgeFactors?: Partial<SurgeFactors>
}

export interface EstimateBreakdown {
  baseLabor: {
    hours: number
    rate: number // per hour
    subtotal: number
  }
  damageAdjustments: {
    repairHours: number
    repairCost: number
    complexityMultiplier: number
  }
  filthinessAdjustment: {
    cleaningHours: number
    severityMultiplier: number
    additionalCost: number
  }
  weatherAdjustment: {
    multiplier: number
    additionalCost: number
    factors: string[]
  }
  surgeAdjustment: {
    multiplier: number
    additionalCost: number
    factors: string[]
  }
  materials: {
    percentage: number
    cost: number
  }
  subtotal: number
  tax: {
    rate: number
    amount: number
  }
  total: number
  lineItems: Array<{
    description: string
    quantity: number
    unitPrice: number
    total: number
  }>
}

// Service type base configurations
const SERVICE_CONFIGS = {
  basic_wash: {
    baseHours: 1.0,
    materialMultiplier: 0.1,
    description: "Basic Wash & Vacuum",
  },
  detail: {
    baseHours: 3.0,
    materialMultiplier: 0.2,
    description: "Interior & Exterior Detail",
  },
  premium_detail: {
    baseHours: 6.0,
    materialMultiplier: 0.3,
    description: "Premium Full Detail Service",
  },
  repair: {
    baseHours: 2.0,
    materialMultiplier: 0.4,
    description: "Damage Repair Service",
  },
  custom: {
    baseHours: 2.0,
    materialMultiplier: 0.25,
    description: "Custom Service Package",
  },
} as const

export function calculateComprehensiveEstimate(input: EstimateCalculationInput): EstimateBreakdown {
  const serviceConfig = SERVICE_CONFIGS[input.serviceType]

  // Step 1: Calculate base labor
  let totalHours = serviceConfig.baseHours
  const baseLabor = {
    hours: serviceConfig.baseHours,
    rate: input.baseRates.laborRate,
    subtotal: Math.round(serviceConfig.baseHours * input.baseRates.laborRate),
  }

  // Step 2: Calculate damage adjustments
  const damageAdjustments = calculateDamageAdjustments(input.damages, input.baseRates.laborRate)
  totalHours += damageAdjustments.repairHours

  // Step 3: Calculate filthiness adjustments
  const filthinessAdjustment = calculateFilthinessAdjustments(input.inspection, input.baseRates.laborRate)
  totalHours += filthinessAdjustment.cleaningHours

  // Step 4: Calculate subtotal before multipliers
  let runningSubtotal = baseLabor.subtotal + damageAdjustments.repairCost + filthinessAdjustment.additionalCost

  // Step 5: Calculate weather adjustments
  const weatherAdjustment =
    input.weather && input.shopSettings.weatherAdjustments
      ? calculateWeatherAdjustments(runningSubtotal, input.weather)
      : { multiplier: 1.0, additionalCost: 0, factors: [] }

  runningSubtotal += weatherAdjustment.additionalCost

  // Step 6: Calculate surge adjustments
  const surgeAdjustment = input.shopSettings.surgeEnabled
    ? calculateSurgeAdjustments(runningSubtotal, input.customSurgeFactors, input.shopSettings.maximumSurge)
    : { multiplier: 1.0, additionalCost: 0, factors: [] }

  runningSubtotal += surgeAdjustment.additionalCost

  // Step 7: Calculate materials
  const materials = {
    percentage: input.baseRates.materialRate,
    cost: Math.round(runningSubtotal * input.baseRates.materialRate),
  }

  // Step 8: Calculate final subtotal and tax
  const subtotal = runningSubtotal + materials.cost
  const tax = {
    rate: input.baseRates.taxRate,
    amount: Math.round(subtotal * input.baseRates.taxRate),
  }

  const total = Math.max(subtotal + tax.amount, input.shopSettings.minimumCharge)

  // Step 9: Generate line items
  const lineItems = generateLineItems({
    serviceConfig,
    baseLabor,
    damageAdjustments,
    filthinessAdjustment,
    weatherAdjustment,
    surgeAdjustment,
    materials,
    tax,
  })

  return {
    baseLabor,
    damageAdjustments,
    filthinessAdjustment,
    weatherAdjustment,
    surgeAdjustment,
    materials,
    subtotal,
    tax,
    total,
    lineItems,
  }
}

function calculateDamageAdjustments(damages: any[], laborRate: number) {
  if (!damages || damages.length === 0) {
    return {
      repairHours: 0,
      repairCost: 0,
      complexityMultiplier: 1.0,
    }
  }

  // Calculate total repair time and cost
  let totalRepairHours = 0
  let totalRepairCost = 0
  let maxComplexity = 1.0

  for (const damage of damages) {
    const repairTime = damage.estimatedRepairTime || getDefaultRepairTime(damage.type, damage.severity)
    const repairCost = damage.repairEstimate || Math.round(repairTime * laborRate)

    totalRepairHours += repairTime
    totalRepairCost += repairCost

    // Track highest complexity for overall multiplier
    const complexity = getComplexityMultiplier(damage.type, damage.severity)
    maxComplexity = Math.max(maxComplexity, complexity)
  }

  return {
    repairHours: totalRepairHours,
    repairCost: totalRepairCost,
    complexityMultiplier: maxComplexity,
  }
}

function calculateFilthinessAdjustments(inspection: any, laborRate: number) {
  if (!inspection.filthinessScore) {
    return {
      cleaningHours: 0,
      severityMultiplier: 1.0,
      additionalCost: 0,
    }
  }

  const filthinessMetrics = calculateFilthinessMetrics(inspection.filthinessScore, inspection.filthinessZoneScores)
  const additionalCost = Math.round(filthinessMetrics.estimatedCleaningTime * laborRate)

  return {
    cleaningHours: filthinessMetrics.estimatedCleaningTime,
    severityMultiplier: filthinessMetrics.laborMultiplier,
    additionalCost,
  }
}

function calculateWeatherAdjustments(subtotal: number, weather: WeatherConditions) {
  const multiplier = calculateWeatherImpact(weather)
  const additionalCost = Math.round(subtotal * (multiplier - 1))

  const factors = []
  if (weather.temperature > 85) factors.push("High temperature")
  if (weather.temperature < 40) factors.push("Low temperature")
  if (weather.humidity > 70) factors.push("High humidity")
  if (weather.precipitation) factors.push("Precipitation")
  if (weather.windSpeed > 15) factors.push("High wind")
  if (weather.uvIndex > 7) factors.push("High UV index")

  return {
    multiplier,
    additionalCost,
    factors,
  }
}

function calculateSurgeAdjustments(subtotal: number, customFactors?: Partial<SurgeFactors>, maxSurge = 2.0) {
  const timeFactors = getCurrentTimeFactors()
  const currentMonth = new Date().getMonth()

  const surgeFactors: SurgeFactors = {
    demandLevel: customFactors?.demandLevel || "normal",
    timeOfDay: timeFactors.timeOfDay,
    dayOfWeek: timeFactors.dayOfWeek,
    seasonalFactor: getSeasonalFactor(currentMonth),
    holidayMultiplier: customFactors?.holidayMultiplier || 1.0,
  }

  const multiplier = Math.min(calculateSurgeMultiplier(surgeFactors), maxSurge)
  const additionalCost = Math.round(subtotal * (multiplier - 1))

  const factors = []
  if (surgeFactors.demandLevel !== "normal") factors.push(`${surgeFactors.demandLevel} demand`)
  if (surgeFactors.timeOfDay === "evening") factors.push("Evening hours")
  if (surgeFactors.dayOfWeek === "weekend") factors.push("Weekend")
  if (surgeFactors.seasonalFactor > 1.0) factors.push("Peak season")
  if (surgeFactors.holidayMultiplier > 1.0) factors.push("Holiday period")

  return {
    multiplier,
    additionalCost,
    factors,
  }
}

function generateLineItems(components: any) {
  const lineItems = []

  // Base service
  lineItems.push({
    description: components.serviceConfig.description,
    quantity: components.baseLabor.hours,
    unitPrice: components.baseLabor.rate,
    total: components.baseLabor.subtotal,
  })

  // Damage repairs
  if (components.damageAdjustments.repairCost > 0) {
    lineItems.push({
      description: "Damage Repair",
      quantity: components.damageAdjustments.repairHours,
      unitPrice: Math.round(components.damageAdjustments.repairCost / components.damageAdjustments.repairHours),
      total: components.damageAdjustments.repairCost,
    })
  }

  // Filthiness cleaning
  if (components.filthinessAdjustment.additionalCost > 0) {
    lineItems.push({
      description: "Additional Cleaning",
      quantity: components.filthinessAdjustment.cleaningHours,
      unitPrice: Math.round(
        components.filthinessAdjustment.additionalCost / components.filthinessAdjustment.cleaningHours,
      ),
      total: components.filthinessAdjustment.additionalCost,
    })
  }

  // Weather adjustment
  if (components.weatherAdjustment.additionalCost > 0) {
    lineItems.push({
      description: `Weather Adjustment (${components.weatherAdjustment.factors.join(", ")})`,
      quantity: 1,
      unitPrice: components.weatherAdjustment.additionalCost,
      total: components.weatherAdjustment.additionalCost,
    })
  }

  // Surge adjustment
  if (components.surgeAdjustment.additionalCost > 0) {
    lineItems.push({
      description: `Surge Pricing (${components.surgeAdjustment.factors.join(", ")})`,
      quantity: 1,
      unitPrice: components.surgeAdjustment.additionalCost,
      total: components.surgeAdjustment.additionalCost,
    })
  }

  // Materials
  if (components.materials.cost > 0) {
    lineItems.push({
      description: "Materials & Supplies",
      quantity: 1,
      unitPrice: components.materials.cost,
      total: components.materials.cost,
    })
  }

  return lineItems
}

function getDefaultRepairTime(damageType: string, severity: string): number {
  const baseTime =
    {
      scratch: 0.5,
      dent: 2.0,
      chip: 0.25,
      crack: 1.5,
      stain: 0.75,
      burn: 2.5,
      tear: 1.0,
      other: 1.0,
    }[damageType] || 1.0

  const severityMultiplier =
    {
      minor: 1.0,
      moderate: 2.0,
      major: 4.0,
      severe: 8.0,
    }[severity] || 1.0

  return baseTime * severityMultiplier
}

function getComplexityMultiplier(damageType: string, severity: string): number {
  const baseComplexity =
    {
      scratch: 1.1,
      dent: 1.3,
      chip: 1.0,
      crack: 1.4,
      stain: 1.2,
      burn: 1.8,
      tear: 1.5,
      other: 1.2,
    }[damageType] || 1.0

  const severityBonus =
    {
      minor: 0,
      moderate: 0.1,
      major: 0.3,
      severe: 0.5,
    }[severity] || 0

  return baseComplexity + severityBonus
}
