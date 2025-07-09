// Embedding service for estimate generation and storage
export interface EmbeddingRequest {
  text: string
  model: "mxbai-embed-large" | "text-embedding-ada-002"
  dimensions?: number
}

export interface EmbeddingResponse {
  embedding: number[]
  model: string
  usage: {
    promptTokens: number
    totalTokens: number
  }
}

// Simulate mxbai-embed-large model (1024 dimensions)
export async function generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 300))

  const dimensions = request.model === "mxbai-embed-large" ? 1024 : 1536

  // Generate deterministic embedding based on text hash for consistency
  const textHash = simpleHash(request.text)
  const embedding = generateDeterministicEmbedding(textHash, dimensions)

  return {
    embedding,
    model: request.model,
    usage: {
      promptTokens: Math.ceil(request.text.length / 4), // Rough token estimation
      totalTokens: Math.ceil(request.text.length / 4),
    },
  }
}

// Generate deterministic embedding for consistent results
function generateDeterministicEmbedding(seed: number, dimensions: number): number[] {
  const embedding = []
  let currentSeed = seed

  for (let i = 0; i < dimensions; i++) {
    // Linear congruential generator for deterministic randomness
    currentSeed = (currentSeed * 1664525 + 1013904223) % Math.pow(2, 32)
    const normalized = (currentSeed / Math.pow(2, 32)) * 2 - 1 // Range [-1, 1]
    embedding.push(normalized)
  }

  // Normalize to unit vector
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
  return embedding.map((val) => val / magnitude)
}

// Simple hash function for text
function simpleHash(text: string): number {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

// Create embedding text from inspection data
export function createInspectionEmbeddingText(inspection: any, damages: any[]): string {
  const vehicleInfo = `${inspection.vehicleYear} ${inspection.vehicleMake} ${inspection.vehicleModel}`

  const conditionInfo = inspection.overallCondition ? `Overall condition: ${inspection.overallCondition}` : ""

  const filthinessInfo = inspection.filthinessScore
    ? `Filthiness: ${inspection.filthinessScore}% (${inspection.filthinessSeverity})`
    : ""

  const damageInfo =
    damages.length > 0
      ? `Damages: ${damages.map((d) => `${d.severity} ${d.type} on ${d.location}`).join(", ")}`
      : "No damages reported"

  const customerNotes = inspection.notes ? `Notes: ${inspection.notes}` : ""

  return [vehicleInfo, conditionInfo, filthinessInfo, damageInfo, customerNotes].filter(Boolean).join(". ")
}

// Create estimate-specific embedding text
export function createEstimateEmbeddingText(
  inspection: any,
  damages: any[],
  serviceType: string,
  laborHours: number,
  totalCost: number,
): string {
  const baseText = createInspectionEmbeddingText(inspection, damages)
  const serviceInfo = `Service: ${serviceType}, Labor: ${laborHours} hours, Total: $${(totalCost / 100).toFixed(2)}`

  return `${baseText}. ${serviceInfo}`
}
