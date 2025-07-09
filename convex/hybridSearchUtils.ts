// Hybrid search scoring and ranking utilities
export interface SearchFilters {
  severity?: Array<"minor" | "moderate" | "major" | "severe">
  dateStart?: number
  dateEnd?: number
  vehicleMake?: string[]
  inspectionType?: Array<"intake" | "pre_detail" | "post_detail" | "quality_check">
  overallCondition?: Array<"excellent" | "good" | "fair" | "poor">
  filthinessLevel?: Array<"light" | "moderate" | "heavy" | "extreme">
  minDamageCount?: number
  maxDamageCount?: number
}

export interface SearchWeights {
  vectorSimilarity: number // α - semantic similarity weight
  keywordMatch: number // β - keyword matching weight
  timeDecay: number // γ - time decay weight
  exactMatch: number // δ - exact match bonus
  damageRelevance: number // ε - damage relevance weight
}

export interface SearchResult {
  inspection: any
  damages: any[]
  score: number
  scoreBreakdown: {
    vectorSimilarity: number
    keywordMatch: number
    timeDecay: number
    exactMatch: number
    damageRelevance: number
    totalScore: number
  }
  matchedTerms: string[]
  summary: {
    vehicleInfo: string
    damageCount: number
    totalRepairCost: number
    condition: string
    lastUpdated: string
  }
  relevanceFactors: string[]
}

// Default search weights optimized for automotive inspection relevance
export const DEFAULT_SEARCH_WEIGHTS: SearchWeights = {
  vectorSimilarity: 0.4, // 40% - semantic understanding
  keywordMatch: 0.3, // 30% - exact keyword matches
  timeDecay: 0.15, // 15% - recency factor
  exactMatch: 0.1, // 10% - exact phrase matches
  damageRelevance: 0.05, // 5% - damage-specific relevance
}

// Time decay calculation - more recent inspections get higher scores
export function calculateTimeDecay(timestamp: number, maxAge = 365 * 24 * 60 * 60 * 1000): number {
  const now = Date.now()
  const age = now - timestamp

  if (age < 0) return 1.0 // Future dates get max score
  if (age > maxAge) return 0.1 // Very old items get minimum score

  // Exponential decay: score = e^(-age/halfLife)
  const halfLife = maxAge / 4 // 25% of max age for 50% score
  return Math.exp(-age / halfLife)
}

// Keyword matching with fuzzy logic and automotive domain knowledge
export function calculateKeywordMatch(
  queryText: string,
  searchableText: string,
): {
  score: number
  matchedTerms: string[]
  exactMatches: number
} {
  if (!queryText || !searchableText) {
    return { score: 0, matchedTerms: [], exactMatches: 0 }
  }

  const query = queryText.toLowerCase()
  const text = searchableText.toLowerCase()

  // Extract meaningful terms (filter out common words)
  const stopWords = new Set(["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by"])
  const queryTerms = query.split(/\s+/).filter((term) => term.length > 2 && !stopWords.has(term))

  let totalMatches = 0
  let exactMatches = 0
  const matchedTerms: string[] = []

  // Check for exact phrase match
  if (text.includes(query)) {
    exactMatches += 1
    totalMatches += queryTerms.length * 2 // Bonus for exact phrase
  }

  // Check individual term matches
  for (const term of queryTerms) {
    if (text.includes(term)) {
      totalMatches += 1
      matchedTerms.push(term)

      // Bonus for automotive-specific terms
      if (isAutomotiveTerm(term)) {
        totalMatches += 0.5
      }
    }
  }

  // Calculate score based on match ratio
  const score = queryTerms.length > 0 ? totalMatches / queryTerms.length : 0

  return {
    score: Math.min(score, 1.0), // Cap at 1.0
    matchedTerms,
    exactMatches,
  }
}

// Check if term is automotive-specific for relevance boosting
function isAutomotiveTerm(term: string): boolean {
  const automotiveTerms = new Set([
    "scratch",
    "dent",
    "damage",
    "repair",
    "paint",
    "bumper",
    "door",
    "hood",
    "trunk",
    "windshield",
    "tire",
    "wheel",
    "engine",
    "transmission",
    "brake",
    "suspension",
    "honda",
    "toyota",
    "ford",
    "chevrolet",
    "bmw",
    "mercedes",
    "audi",
    "volkswagen",
    "sedan",
    "suv",
    "truck",
    "coupe",
    "hatchback",
    "convertible",
    "minor",
    "moderate",
    "major",
    "severe",
    "excellent",
    "good",
    "fair",
    "poor",
  ])

  return automotiveTerms.has(term.toLowerCase())
}

// Calculate damage relevance score based on query context
export function calculateDamageRelevance(queryText: string, damages: any[]): number {
  if (!damages || damages.length === 0) return 0

  const query = queryText.toLowerCase()
  let relevanceScore = 0

  for (const damage of damages) {
    // Check if query mentions specific damage types
    if (query.includes(damage.type.toLowerCase())) {
      relevanceScore += 0.3
    }

    // Check if query mentions severity levels
    if (query.includes(damage.severity.toLowerCase())) {
      relevanceScore += 0.2
    }

    // Check if query mentions locations
    if (query.includes(damage.location.toLowerCase().replace("_", " "))) {
      relevanceScore += 0.2
    }

    // Check description match
    if (
      damage.description &&
      query.split(" ").some((term: string) => damage.description.toLowerCase().includes(term))
    ) {
      relevanceScore += 0.1
    }
  }

  return Math.min(relevanceScore, 1.0)
}

// Create searchable text from inspection and damages
export function createSearchableText(inspection: any, damages: any[]): string {
  const parts = []

  // Vehicle information
  parts.push(`${inspection.vehicleYear} ${inspection.vehicleMake} ${inspection.vehicleModel}`)

  if (inspection.vehicleVin) {
    parts.push(inspection.vehicleVin)
  }

  // Customer information
  parts.push(inspection.customerName)
  parts.push(inspection.customerEmail)

  // Inspection details
  parts.push(inspection.inspectionType)
  if (inspection.overallCondition) {
    parts.push(inspection.overallCondition)
  }

  if (inspection.notes) {
    parts.push(inspection.notes)
  }

  // Filthiness information
  if (inspection.filthinessSeverity) {
    parts.push(`filthiness ${inspection.filthinessSeverity}`)
  }

  // Damage information
  for (const damage of damages) {
    parts.push(`${damage.severity} ${damage.type} ${damage.location}`)
    if (damage.description) {
      parts.push(damage.description)
    }
  }

  return parts.join(" ")
}

// Apply structured filters to inspection data
export function matchesFilters(inspection: any, damages: any[], filters: SearchFilters): boolean {
  // Date range filter
  if (filters.dateStart && inspection.createdAt < filters.dateStart) {
    return false
  }

  if (filters.dateEnd && inspection.createdAt > filters.dateEnd) {
    return false
  }

  // Vehicle make filter
  if (filters.vehicleMake && filters.vehicleMake.length > 0) {
    if (!filters.vehicleMake.includes(inspection.vehicleMake)) {
      return false
    }
  }

  // Inspection type filter
  if (filters.inspectionType && filters.inspectionType.length > 0) {
    if (!filters.inspectionType.includes(inspection.inspectionType)) {
      return false
    }
  }

  // Overall condition filter
  if (filters.overallCondition && filters.overallCondition.length > 0) {
    if (!inspection.overallCondition || !filters.overallCondition.includes(inspection.overallCondition)) {
      return false
    }
  }

  // Filthiness level filter
  if (filters.filthinessLevel && filters.filthinessLevel.length > 0) {
    if (!inspection.filthinessSeverity || !filters.filthinessLevel.includes(inspection.filthinessSeverity)) {
      return false
    }
  }

  // Damage count filters
  const damageCount = damages.length
  if (filters.minDamageCount !== undefined && damageCount < filters.minDamageCount) {
    return false
  }

  if (filters.maxDamageCount !== undefined && damageCount > filters.maxDamageCount) {
    return false
  }

  // Severity filter (check if any damage matches)
  if (filters.severity && filters.severity.length > 0) {
    const hasSeverityMatch = damages.some((damage) => filters.severity!.includes(damage.severity))
    if (!hasSeverityMatch) {
      return false
    }
  }

  return true
}

// Generate inspection summary for search results
export function generateInspectionSummary(
  inspection: any,
  damages: any[],
): {
  vehicleInfo: string
  damageCount: number
  totalRepairCost: number
  condition: string
  lastUpdated: string
} {
  const vehicleInfo = `${inspection.vehicleYear} ${inspection.vehicleMake} ${inspection.vehicleModel}`
  const damageCount = damages.length
  const totalRepairCost = damages.reduce((sum, damage) => sum + (damage.repairEstimate || 0), 0)
  const condition = inspection.overallCondition || "Not assessed"
  const lastUpdated = new Date(inspection.updatedAt).toLocaleDateString()

  return {
    vehicleInfo,
    damageCount,
    totalRepairCost,
    condition,
    lastUpdated,
  }
}

// Generate relevance factors explanation
export function generateRelevanceFactors(
  scoreBreakdown: SearchResult["scoreBreakdown"],
  matchedTerms: string[],
  inspection: any,
  damages: any[],
): string[] {
  const factors = []

  if (scoreBreakdown.vectorSimilarity > 0.7) {
    factors.push("High semantic similarity to query")
  }

  if (scoreBreakdown.keywordMatch > 0.5) {
    factors.push(`Matched keywords: ${matchedTerms.join(", ")}`)
  }

  if (scoreBreakdown.exactMatch > 0) {
    factors.push("Contains exact phrase match")
  }

  if (scoreBreakdown.timeDecay > 0.8) {
    factors.push("Recent inspection")
  }

  if (damages.length > 0) {
    factors.push(`${damages.length} damage${damages.length > 1 ? "s" : ""} documented`)
  }

  if (inspection.filthinessSeverity) {
    factors.push(`${inspection.filthinessSeverity} filthiness level`)
  }

  return factors
}
