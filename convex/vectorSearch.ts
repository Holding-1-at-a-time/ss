import { v } from "convex/values"
import { action } from "./_generated/server"
import { api } from "./_generated/api"
import { getCurrentUser } from "./auth"

// Inspection similarity search
export const searchSimilarInspections = action({
  args: {
    queryEmbedding: v.array(v.float64()),
    contentType: v.optional(
      v.union(
        v.literal("vehicle_description"),
        v.literal("damage_summary"),
        v.literal("customer_notes"),
        v.literal("full_inspection"),
      ),
    ),
    vehicleMake: v.optional(v.string()),
    inspectionType: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    // Build filter object
    const filter: any = {
      tenantId: user.tenantId,
    }

    if (args.contentType) {
      filter.contentType = args.contentType
    }

    if (args.vehicleMake) {
      filter["metadata.vehicleMake"] = args.vehicleMake
    }

    if (args.inspectionType) {
      filter["metadata.inspectionType"] = args.inspectionType
    }

    // Perform vector search
    const results = await ctx.vectorSearch("inspectionEmbeddings", "by_embedding", {
      vector: args.queryEmbedding,
      limit: args.limit ?? 10,
      filter,
    })

    // Load the actual inspection documents
    const inspectionIds = results.map((r) => r.metadata.inspectionId)
    const inspections = await ctx.runQuery(api.inspections.getInspectionsByIds, {
      ids: inspectionIds,
    })

    // Combine results with similarity scores
    return results.map((result, index) => ({
      inspection: inspections[index],
      similarity: result._score,
      embedding: result,
    }))
  },
})

// Damage pattern similarity search
export const searchSimilarDamages = action({
  args: {
    queryEmbedding: v.array(v.float64()),
    contentType: v.optional(
      v.union(v.literal("damage_description"), v.literal("visual_features"), v.literal("repair_context")),
    ),
    damageType: v.optional(v.string()),
    severity: v.optional(v.string()),
    location: v.optional(v.string()),
    vehicleMake: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    // Build filter object
    const filter: any = {
      tenantId: user.tenantId,
    }

    if (args.contentType) filter.contentType = args.contentType
    if (args.damageType) filter["metadata.damageType"] = args.damageType
    if (args.severity) filter["metadata.severity"] = args.severity
    if (args.location) filter["metadata.location"] = args.location
    if (args.vehicleMake) filter["metadata.vehicleMake"] = args.vehicleMake

    // Perform vector search
    const results = await ctx.vectorSearch("damageEmbeddings", "by_embedding", {
      vector: args.queryEmbedding,
      limit: args.limit ?? 10,
      filter,
    })

    // Load the actual damage documents
    const damageIds = results.map((r) => r.metadata.damageId)
    const damages = await ctx.runQuery(api.damages.getDamagesByIds, {
      ids: damageIds,
    })

    return results.map((result, index) => ({
      damage: damages[index],
      similarity: result._score,
      embedding: result,
    }))
  },
})

// Estimate pricing similarity search
export const searchSimilarEstimates = action({
  args: {
    queryEmbedding: v.array(v.float64()),
    contentType: v.optional(
      v.union(v.literal("service_description"), v.literal("pricing_context"), v.literal("line_items")),
    ),
    serviceType: v.optional(v.string()),
    vehicleMake: v.optional(v.string()),
    priceRange: v.optional(
      v.object({
        min: v.number(),
        max: v.number(),
      }),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    // Build filter object
    const filter: any = {
      tenantId: user.tenantId,
    }

    if (args.contentType) filter.contentType = args.contentType
    if (args.serviceType) filter["metadata.serviceType"] = args.serviceType
    if (args.vehicleMake) filter["metadata.vehicleMake"] = args.vehicleMake

    // Perform vector search
    let results = await ctx.vectorSearch("estimateEmbeddings", "by_embedding", {
      vector: args.queryEmbedding,
      limit: args.limit ?? 10,
      filter,
    })

    // Additional filtering by price range (post-search filter)
    if (args.priceRange) {
      results = results.filter(
        (r) => r.metadata.totalAmount >= args.priceRange!.min && r.metadata.totalAmount <= args.priceRange!.max,
      )
    }

    // Load the actual estimate documents
    const estimateIds = results.map((r) => r.metadata.estimateId)
    const estimates = await ctx.runQuery(api.estimates.getEstimatesByIds, {
      ids: estimateIds,
    })

    return results.map((result, index) => ({
      estimate: estimates[index],
      similarity: result._score,
      embedding: result,
    }))
  },
})

// Knowledge base search for AI assistance
export const searchKnowledgeBase = action({
  args: {
    queryEmbedding: v.array(v.float64()),
    contentType: v.optional(
      v.union(
        v.literal("repair_procedure"),
        v.literal("damage_guide"),
        v.literal("pricing_rule"),
        v.literal("customer_faq"),
        v.literal("training_material"),
      ),
    ),
    category: v.optional(v.string()),
    vehicleTypes: v.optional(v.array(v.string())),
    damageTypes: v.optional(v.array(v.string())),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    // Build filter object
    const filter: any = {
      tenantId: user.tenantId,
      isActive: true,
    }

    if (args.contentType) filter.contentType = args.contentType
    if (args.category) filter["metadata.category"] = args.category

    // Perform vector search
    let results = await ctx.vectorSearch("knowledgeBaseEmbeddings", "by_embedding", {
      vector: args.queryEmbedding,
      limit: args.limit ?? 5,
      filter,
    })

    // Additional filtering by vehicle/damage types (post-search filter)
    if (args.vehicleTypes || args.damageTypes) {
      results = results.filter((r) => {
        if (args.vehicleTypes && r.metadata.vehicleTypes) {
          const hasVehicleMatch = args.vehicleTypes.some((vt) => r.metadata.vehicleTypes!.includes(vt))
          if (!hasVehicleMatch) return false
        }

        if (args.damageTypes && r.metadata.damageTypes) {
          const hasDamageMatch = args.damageTypes.some((dt) => r.metadata.damageTypes!.includes(dt))
          if (!hasDamageMatch) return false
        }

        return true
      })
    }

    return results.map((result) => ({
      title: result.title,
      content: result.content,
      metadata: result.metadata,
      similarity: result._score,
      documentId: result.documentId,
    }))
  },
})

// Hybrid search combining vector and text search
export const hybridSearchInspections = action({
  args: {
    queryEmbedding: v.array(v.float64()),
    textQuery: v.optional(v.string()),
    contentType: v.optional(v.string()),
    vehicleMake: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    // Perform vector search
    const vectorResults = await ctx.runAction(api.vectorSearch.searchSimilarInspections, {
      queryEmbedding: args.queryEmbedding,
      contentType: args.contentType as any,
      vehicleMake: args.vehicleMake,
      limit: args.limit ?? 10,
    })

    // Perform text search if query provided
    let textResults: any[] = []
    if (args.textQuery) {
      textResults = await ctx.runQuery(api.inspections.searchInspections, {
        searchTerm: args.textQuery,
      })
    }

    // Combine and rank results
    const combinedResults = new Map()

    // Add vector results with weighted score
    vectorResults.forEach((result) => {
      const id = result.inspection._id
      combinedResults.set(id, {
        ...result,
        combinedScore: result.similarity * 0.7, // 70% weight for semantic similarity
      })
    })

    // Add text results with weighted score
    textResults.forEach((inspection, index) => {
      const id = inspection._id
      const textScore = 1 - index / textResults.length // Higher rank = higher score

      if (combinedResults.has(id)) {
        // Boost existing result
        const existing = combinedResults.get(id)
        existing.combinedScore += textScore * 0.3 // 30% weight for text match
      } else {
        // Add new result
        combinedResults.set(id, {
          inspection,
          similarity: 0,
          combinedScore: textScore * 0.3,
        })
      }
    })

    // Sort by combined score and return top results
    return Array.from(combinedResults.values())
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, args.limit ?? 10)
  },
})
