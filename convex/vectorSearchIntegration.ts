import { v } from "convex/values"
import { action } from "./_generated/server"
import { getCurrentUser } from "./auth"
import { generateEmbedding } from "./embeddingService"

// Generate query embedding for semantic search
export const generateQueryEmbedding = action({
  args: {
    queryText: v.string(),
    model: v.optional(v.union(v.literal("mxbai-embed-large"), v.literal("text-embedding-ada-002"))),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    try {
      const embeddingResponse = await generateEmbedding({
        text: args.queryText,
        model: args.model || "mxbai-embed-large",
      })

      return {
        embedding: embeddingResponse.embedding,
        model: embeddingResponse.model,
        queryText: args.queryText,
        dimensions: embeddingResponse.embedding.length,
        generatedAt: Date.now(),
      }
    } catch (error) {
      console.error("Failed to generate query embedding:", error)
      throw new Error("Failed to generate query embedding")
    }
  },
})

// Perform vector similarity search on inspections
export const vectorSearchInspections = action({
  args: {
    queryEmbedding: v.array(v.float64()),
    limit: v.optional(v.number()),
    similarityThreshold: v.optional(v.number()),
    contentType: v.optional(
      v.union(
        v.literal("vehicle_description"),
        v.literal("damage_summary"),
        v.literal("customer_notes"),
        v.literal("full_inspection"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    try {
      // Build filter for tenant and content type
      const filter: any = {
        tenantId: user.tenantId,
      }

      if (args.contentType) {
        filter.contentType = args.contentType
      }

      // Perform vector search
      const vectorResults = await ctx.vectorSearch("inspectionEmbeddings", "by_embedding", {
        vector: args.queryEmbedding,
        limit: args.limit || 20,
        filter,
      })

      // Filter by similarity threshold if specified
      const filteredResults = args.similarityThreshold
        ? vectorResults.filter((result) => result._score >= args.similarityThreshold!)
        : vectorResults

      return filteredResults.map((result) => ({
        inspectionId: result.inspectionId,
        similarity: result._score,
        contentType: result.contentType,
        metadata: result.metadata,
        embeddingId: result._id,
      }))
    } catch (error) {
      console.error("Vector search failed:", error)
      throw new Error("Vector search failed")
    }
  },
})

// Perform vector similarity search on damages
export const vectorSearchDamages = action({
  args: {
    queryEmbedding: v.array(v.float64()),
    limit: v.optional(v.number()),
    similarityThreshold: v.optional(v.number()),
    damageType: v.optional(v.string()),
    severity: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    try {
      const filter: any = {
        tenantId: user.tenantId,
      }

      if (args.damageType) {
        filter["metadata.damageType"] = args.damageType
      }

      if (args.severity) {
        filter["metadata.severity"] = args.severity
      }

      const vectorResults = await ctx.vectorSearch("damageEmbeddings", "by_embedding", {
        vector: args.queryEmbedding,
        limit: args.limit || 20,
        filter,
      })

      const filteredResults = args.similarityThreshold
        ? vectorResults.filter((result) => result._score >= args.similarityThreshold!)
        : vectorResults

      return filteredResults.map((result) => ({
        damageId: result.damageId,
        inspectionId: result.inspectionId,
        similarity: result._score,
        contentType: result.contentType,
        metadata: result.metadata,
      }))
    } catch (error) {
      console.error("Damage vector search failed:", error)
      throw new Error("Damage vector search failed")
    }
  },
})
