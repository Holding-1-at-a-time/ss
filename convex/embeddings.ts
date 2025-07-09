import { v } from "convex/values"
import { mutation, action } from "./_generated/server"
import { getCurrentUser } from "./auth"
import { api } from "./_generated/api"

// Create inspection embedding
export const createInspectionEmbedding = mutation({
  args: {
    inspectionId: v.id("inspections"),
    embedding: v.array(v.float64()),
    contentType: v.union(
      v.literal("vehicle_description"),
      v.literal("damage_summary"),
      v.literal("customer_notes"),
      v.literal("full_inspection"),
    ),
    metadata: v.object({
      vehicleMake: v.string(),
      vehicleModel: v.string(),
      vehicleYear: v.number(),
      inspectionType: v.string(),
      overallCondition: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    // Verify inspection belongs to tenant
    const inspection = await ctx.db.get(args.inspectionId)
    if (!inspection || inspection.tenantId !== user.tenantId) {
      throw new Error("Inspection not found or access denied")
    }

    const embeddingId = await ctx.db.insert("inspectionEmbeddings", {
      tenantId: user.tenantId,
      inspectionId: args.inspectionId,
      embedding: args.embedding,
      contentType: args.contentType,
      metadata: args.metadata,
      createdAt: Date.now(),
    })

    // Update inspection with embedding reference
    await ctx.db.patch(args.inspectionId, {
      embeddingId,
      updatedAt: Date.now(),
    })

    return embeddingId
  },
})

// Create damage embedding
export const createDamageEmbedding = mutation({
  args: {
    damageId: v.id("damages"),
    inspectionId: v.id("inspections"),
    embedding: v.array(v.float64()),
    contentType: v.union(v.literal("damage_description"), v.literal("visual_features"), v.literal("repair_context")),
    metadata: v.object({
      damageType: v.string(),
      severity: v.string(),
      location: v.string(),
      vehicleMake: v.string(),
      vehicleModel: v.string(),
      repairEstimate: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    // Verify damage belongs to tenant
    const damage = await ctx.db.get(args.damageId)
    if (!damage || damage.tenantId !== user.tenantId) {
      throw new Error("Damage not found or access denied")
    }

    const embeddingId = await ctx.db.insert("damageEmbeddings", {
      tenantId: user.tenantId,
      damageId: args.damageId,
      inspectionId: args.inspectionId,
      embedding: args.embedding,
      contentType: args.contentType,
      metadata: args.metadata,
      createdAt: Date.now(),
    })

    // Update damage with embedding reference
    await ctx.db.patch(args.damageId, {
      embeddingId,
      updatedAt: Date.now(),
    })

    return embeddingId
  },
})

// Create estimate embedding
export const createEstimateEmbedding = mutation({
  args: {
    estimateId: v.id("estimates"),
    inspectionId: v.id("inspections"),
    embedding: v.array(v.float64()),
    contentType: v.union(v.literal("service_description"), v.literal("pricing_context"), v.literal("line_items")),
    metadata: v.object({
      serviceType: v.string(),
      totalAmount: v.number(),
      laborHours: v.number(),
      vehicleMake: v.string(),
      vehicleModel: v.string(),
      damageCount: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    // Verify estimate belongs to tenant
    const estimate = await ctx.db.get(args.estimateId)
    if (!estimate || estimate.tenantId !== user.tenantId) {
      throw new Error("Estimate not found or access denied")
    }

    const embeddingId = await ctx.db.insert("estimateEmbeddings", {
      tenantId: user.tenantId,
      estimateId: args.estimateId,
      inspectionId: args.inspectionId,
      embedding: args.embedding,
      contentType: args.contentType,
      metadata: args.metadata,
      createdAt: Date.now(),
    })

    // Update estimate with embedding reference
    await ctx.db.patch(args.estimateId, {
      embeddingId,
      updatedAt: Date.now(),
    })

    return embeddingId
  },
})

// Create knowledge base entry
export const createKnowledgeBaseEntry = mutation({
  args: {
    documentId: v.string(),
    embedding: v.array(v.float64()),
    contentType: v.union(
      v.literal("repair_procedure"),
      v.literal("damage_guide"),
      v.literal("pricing_rule"),
      v.literal("customer_faq"),
      v.literal("training_material"),
    ),
    title: v.string(),
    content: v.string(),
    metadata: v.object({
      category: v.string(),
      tags: v.array(v.string()),
      difficulty: v.optional(v.union(v.literal("beginner"), v.literal("intermediate"), v.literal("advanced"))),
      vehicleTypes: v.optional(v.array(v.string())),
      damageTypes: v.optional(v.array(v.string())),
    }),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const now = Date.now()
    const entryId = await ctx.db.insert("knowledgeBaseEmbeddings", {
      tenantId: user.tenantId,
      documentId: args.documentId,
      embedding: args.embedding,
      contentType: args.contentType,
      title: args.title,
      content: args.content,
      metadata: args.metadata,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })

    return entryId
  },
})

// Batch embedding generation action
export const generateEmbeddingsForInspection = action({
  args: {
    inspectionId: v.id("inspections"),
    openaiApiKey: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    // Get inspection data
    const inspection = await ctx.runQuery(api.inspections.getInspectionById, {
      id: args.inspectionId,
    })

    if (!inspection) {
      throw new Error("Inspection not found")
    }

    // Get related damages
    const damages = await ctx.runQuery(api.damages.getDamagesByInspection, {
      inspectionId: args.inspectionId,
    })

    // Generate embeddings for different content types
    const embeddingPromises = []

    // Vehicle description embedding
    const vehicleDescription = `${inspection.vehicleMake} ${inspection.vehicleModel} ${inspection.vehicleYear}`
    embeddingPromises.push(
      generateEmbedding(vehicleDescription, args.openaiApiKey).then((embedding) =>
        ctx.runMutation(api.embeddings.createInspectionEmbedding, {
          inspectionId: args.inspectionId,
          embedding,
          contentType: "vehicle_description",
          metadata: {
            vehicleMake: inspection.vehicleMake,
            vehicleModel: inspection.vehicleModel,
            vehicleYear: inspection.vehicleYear,
            inspectionType: inspection.inspectionType,
            overallCondition: inspection.overallCondition,
          },
        }),
      ),
    )

    // Damage summary embedding
    if (damages.length > 0) {
      const damageSummary = damages
        .map((d) => `${d.type} ${d.severity} damage on ${d.location}: ${d.description}`)
        .join(". ")

      embeddingPromises.push(
        generateEmbedding(damageSummary, args.openaiApiKey).then((embedding) =>
          ctx.runMutation(api.embeddings.createInspectionEmbedding, {
            inspectionId: args.inspectionId,
            embedding,
            contentType: "damage_summary",
            metadata: {
              vehicleMake: inspection.vehicleMake,
              vehicleModel: inspection.vehicleModel,
              vehicleYear: inspection.vehicleYear,
              inspectionType: inspection.inspectionType,
              overallCondition: inspection.overallCondition,
            },
          }),
        ),
      )
    }

    // Customer notes embedding
    if (inspection.notes) {
      embeddingPromises.push(
        generateEmbedding(inspection.notes, args.openaiApiKey).then((embedding) =>
          ctx.runMutation(api.embeddings.createInspectionEmbedding, {
            inspectionId: args.inspectionId,
            embedding,
            contentType: "customer_notes",
            metadata: {
              vehicleMake: inspection.vehicleMake,
              vehicleModel: inspection.vehicleModel,
              vehicleYear: inspection.vehicleYear,
              inspectionType: inspection.inspectionType,
              overallCondition: inspection.overallCondition,
            },
          }),
        ),
      )
    }

    await Promise.all(embeddingPromises)
    return { success: true, embeddingsGenerated: embeddingPromises.length }
  },
})

// Helper function to generate embeddings using OpenAI
async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: text,
      model: "text-embedding-ada-002",
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`)
  }

  const data = await response.json()
  return data.data[0].embedding
}
