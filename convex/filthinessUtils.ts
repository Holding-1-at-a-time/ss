// Filthiness assessment and pricing impact utilities
export interface FilthinessMetrics {
  overallScore: number // 0-100 percentage
  zoneBreakdown: {
    exterior: number
    interior: number
    engine: number
    undercarriage: number
  }
  severityLevel: "light" | "moderate" | "heavy" | "extreme"
  estimatedCleaningTime: number // in hours
  laborMultiplier: number // pricing multiplier
}

export interface WeatherConditions {
  temperature: number // Fahrenheit
  humidity: number // percentage
  precipitation: boolean
  windSpeed: number // mph
  uvIndex: number
}

export interface SurgeFactors {
  demandLevel: "low" | "normal" | "high" | "peak"
  timeOfDay: "morning" | "afternoon" | "evening" | "night"
  dayOfWeek: "weekday" | "weekend"
  seasonalFactor: number
  holidayMultiplier: number
}

// Filthiness scoring constants
export const FILTHINESS_THRESHOLDS = {
  LIGHT: { min: 0, max: 25, multiplier: 1.0, baseHours: 0.5 },
  MODERATE: { min: 26, max: 50, multiplier: 1.5, baseHours: 1.5 },
  HEAVY: { min: 51, max: 75, multiplier: 2.0, baseHours: 3.0 },
  EXTREME: { min: 76, max: 100, multiplier: 3.0, baseHours: 5.0 },
} as const

// Weather impact on cleaning difficulty
export const WEATHER_IMPACT = {
  HIGH_TEMP: { threshold: 85, multiplier: 1.2 }, // Hot weather makes cleaning harder
  LOW_TEMP: { threshold: 40, multiplier: 1.1 }, // Cold weather slows work
  HIGH_HUMIDITY: { threshold: 70, multiplier: 1.15 }, // Humidity affects drying
  PRECIPITATION: { multiplier: 1.3 }, // Rain/snow increases difficulty
  HIGH_WIND: { threshold: 15, multiplier: 1.1 }, // Wind affects outdoor work
  HIGH_UV: { threshold: 7, multiplier: 1.1 }, // UV protection needed
} as const

// Surge pricing factors
export const SURGE_MULTIPLIERS = {
  DEMAND: {
    low: 0.9,
    normal: 1.0,
    high: 1.3,
    peak: 1.8,
  },
  TIME_OF_DAY: {
    morning: 1.0,
    afternoon: 1.1,
    evening: 1.2,
    night: 0.8,
  },
  DAY_OF_WEEK: {
    weekday: 1.0,
    weekend: 1.3,
  },
} as const

export function calculateFilthinessMetrics(
  overallScore: number,
  zoneScores?: Partial<FilthinessMetrics["zoneBreakdown"]>,
): FilthinessMetrics {
  // Validate score range
  const normalizedScore = Math.max(0, Math.min(100, overallScore))

  // Determine severity level
  let severityLevel: FilthinessMetrics["severityLevel"] = "light"
  let config = FILTHINESS_THRESHOLDS.LIGHT

  if (normalizedScore >= FILTHINESS_THRESHOLDS.EXTREME.min) {
    severityLevel = "extreme"
    config = FILTHINESS_THRESHOLDS.EXTREME
  } else if (normalizedScore >= FILTHINESS_THRESHOLDS.HEAVY.min) {
    severityLevel = "heavy"
    config = FILTHINESS_THRESHOLDS.HEAVY
  } else if (normalizedScore >= FILTHINESS_THRESHOLDS.MODERATE.min) {
    severityLevel = "moderate"
    config = FILTHINESS_THRESHOLDS.MODERATE
  }

  // Calculate zone breakdown (use provided or estimate from overall)
  const zoneBreakdown = {
    exterior: zoneScores?.exterior ?? normalizedScore * 0.4, // Exterior typically most dirty
    interior: zoneScores?.interior ?? normalizedScore * 0.3, // Interior moderate
    engine: zoneScores?.engine ?? normalizedScore * 0.2, // Engine bay less visible
    undercarriage: zoneScores?.undercarriage ?? normalizedScore * 0.1, // Undercarriage least priority
  }

  return {
    overallScore: normalizedScore,
    zoneBreakdown,
    severityLevel,
    estimatedCleaningTime: config.baseHours,
    laborMultiplier: config.multiplier,
  }
}

export function calculateWeatherImpact(weather: WeatherConditions): number {
  let multiplier = 1.0

  // Temperature impacts
  if (weather.temperature > WEATHER_IMPACT.HIGH_TEMP.threshold) {
    multiplier *= WEATHER_IMPACT.HIGH_TEMP.multiplier
  } else if (weather.temperature < WEATHER_IMPACT.LOW_TEMP.threshold) {
    multiplier *= WEATHER_IMPACT.LOW_TEMP.multiplier
  }

  // Humidity impact
  if (weather.humidity > WEATHER_IMPACT.HIGH_HUMIDITY.threshold) {
    multiplier *= WEATHER_IMPACT.HIGH_HUMIDITY.multiplier
  }

  // Precipitation impact
  if (weather.precipitation) {
    multiplier *= WEATHER_IMPACT.PRECIPITATION.multiplier
  }

  // Wind impact
  if (weather.windSpeed > WEATHER_IMPACT.HIGH_WIND.threshold) {
    multiplier *= WEATHER_IMPACT.HIGH_WIND.multiplier
  }

  // UV impact
  if (weather.uvIndex > WEATHER_IMPACT.HIGH_UV.threshold) {
    multiplier *= WEATHER_IMPACT.HIGH_UV.multiplier
  }

  return multiplier
}

export function calculateSurgeMultiplier(factors: SurgeFactors): number {
  let multiplier = 1.0

  // Demand-based surge
  multiplier *= SURGE_MULTIPLIERS.DEMAND[factors.demandLevel]

  // Time of day impact
  multiplier *= SURGE_MULTIPLIERS.TIME_OF_DAY[factors.timeOfDay]

  // Day of week impact
  multiplier *= SURGE_MULTIPLIERS.DAY_OF_WEEK[factors.dayOfWeek]

  // Seasonal factor (already a multiplier)
  multiplier *= factors.seasonalFactor

  // Holiday multiplier
  multiplier *= factors.holidayMultiplier

  return multiplier
}

// Get current time-based factors
export function getCurrentTimeFactors(): Pick<SurgeFactors, "timeOfDay" | "dayOfWeek"> {
  const now = new Date()
  const hour = now.getHours()
  const dayOfWeek = now.getDay()

  let timeOfDay: SurgeFactors["timeOfDay"] = "morning"
  if (hour >= 6 && hour < 12) timeOfDay = "morning"
  else if (hour >= 12 && hour < 17) timeOfDay = "afternoon"
  else if (hour >= 17 && hour < 22) timeOfDay = "evening"
  else timeOfDay = "night"

  const dayType: SurgeFactors["dayOfWeek"] = dayOfWeek === 0 || dayOfWeek === 6 ? "weekend" : "weekday"

  return { timeOfDay, dayOfWeek: dayType }
}

// Estimate seasonal factor based on month
export function getSeasonalFactor(month: number): number {
  // Spring/Summer higher demand (March-August)
  if (month >= 2 && month <= 7) return 1.2
  // Fall moderate demand (September-November)
  if (month >= 8 && month <= 10) return 1.1
  // Winter lower demand (December-February)
  return 0.9
}

// Calculate comprehensive pricing adjustments
export function calculatePricingAdjustments(
  basePrice: number,
  filthiness: FilthinessMetrics,
  weather?: WeatherConditions,
  surge?: SurgeFactors,
): {
  adjustedPrice: number
  breakdown: {
    basePrice: number
    filthinessAdjustment: number
    weatherAdjustment: number
    surgeAdjustment: number
    finalPrice: number
  }
} {
  let currentPrice = basePrice

  // Apply filthiness multiplier
  const filthinessAdjustment = currentPrice * (filthiness.laborMultiplier - 1)
  currentPrice *= filthiness.laborMultiplier

  // Apply weather impact
  let weatherAdjustment = 0
  if (weather) {
    const weatherMultiplier = calculateWeatherImpact(weather)
    weatherAdjustment = currentPrice * (weatherMultiplier - 1)
    currentPrice *= weatherMultiplier
  }

  // Apply surge pricing
  let surgeAdjustment = 0
  if (surge) {
    const surgeMultiplier = calculateSurgeMultiplier(surge)
    surgeAdjustment = currentPrice * (surgeMultiplier - 1)
    currentPrice *= surgeMultiplier
  }

  return {
    adjustedPrice: Math.round(currentPrice),
    breakdown: {
      basePrice,
      filthinessAdjustment: Math.round(filthinessAdjustment),
      weatherAdjustment: Math.round(weatherAdjustment),
      surgeAdjustment: Math.round(surgeAdjustment),
      finalPrice: Math.round(currentPrice),
    },
  }
}
