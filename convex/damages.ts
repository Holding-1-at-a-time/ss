import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { getCurrentUser } from "./auth"

// Queries
export const getDamagesByInspection = query({
  args: { inspectionId: v.id("inspections") },
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

    const damages = await ctx.db
      .query("damages")
      .withIndex("by_tenant_inspection", (q) => q.eq("tenantId", user.tenantId).eq("inspectionId", args.inspectionId))
      .collect()

    return damages
  },
})

export const getDamagesBySeverity = query({
  args: {
    severity: v.union(v.literal("minor"), v.literal("moderate"), v.literal("major"), v.literal("severe")),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const damages = await ctx.db
      .query("damages")
      .withIndex("by_tenant_severity", (q) => q.eq("tenantId", user.tenantId).eq("severity", args.severity))
      .collect()

    return damages
  },
})

export const getDamageById = query({
  args: { id: v.id("damages") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const damage = await ctx.db.get(args.id)
    if (!damage || damage.tenantId !== user.tenantId) {
      throw new Error("Damage not found or access denied")
    }

    return damage
  },
})

// Mutations
export const createDamage = mutation({
  args: {
    inspectionId: v.id("inspections"),
    type: v.union(
      v.literal("scratch"),
      v.literal("dent"),
      v.literal("chip"),
      v.literal("crack"),
      v.literal("stain"),
      v.literal("burn"),
      v.literal("tear"),
      v.literal("other"),
    ),
    severity: v.union(v.literal("minor"), v.literal("moderate"), v.literal("major"), v.literal("severe")),
    location: v.string(),
    description: v.string(),
    dimensions: v.optional(
      v.object({
        length: v.number(),
        width: v.number(),
        depth: v.optional(v.number()),
      }),
    ),
    repairEstimate: v.optional(v.number()),
    photos: v.optional(v.array(v.string())),
    boundingBox: v.optional(
      v.object({
        x: v.number(),
        y: v.number(),
        width: v.number(),
        height: v.number(),
      }),
    ),
    aiConfidence: v.optional(v.number()),
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

    const now = Date.now()
    const damageId = await ctx.db.insert("damages", {
      tenantId: user.tenantId,
      inspectionId: args.inspectionId,
      type: args.type,
      severity: args.severity,
      location: args.location,
      description: args.description,
      dimensions: args.dimensions,
      repairEstimate: args.repairEstimate,
      photos: args.photos ?? [],
      boundingBox: args.boundingBox,
      aiConfidence: args.aiConfidence,
      createdAt: now,
      updatedAt: now,
    })

    return damageId
  },
})

export const updateDamage = mutation({
  args: {
    id: v.id("damages"),
    type: v.optional(
      v.union(
        v.literal("scratch"),
        v.literal("dent"),
        v.literal("chip"),
        v.literal("crack"),
        v.literal("stain"),
        v.literal("burn"),
        v.literal("tear"),
        v.literal("other"),
      ),
    ),
    severity: v.optional(v.union(v.literal("minor"), v.literal("moderate"), v.literal("major"), v.literal("severe"))),
    location: v.optional(v.string()),
    description: v.optional(v.string()),
    repairEstimate: v.optional(v.number()),
    photos: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const damage = await ctx.db.get(args.id)
    if (!damage || damage.tenantId !== user.tenantId) {
      throw new Error("Damage not found or access denied")
    }

    const updateData: any = {
      updatedAt: Date.now(),
    }

    if (args.type !== undefined) updateData.type = args.type
    if (args.severity !== undefined) updateData.severity = args.severity
    if (args.location !== undefined) updateData.location = args.location
    if (args.description !== undefined) updateData.description = args.description
    if (args.repairEstimate !== undefined) updateData.repairEstimate = args.repairEstimate
    if (args.photos !== undefined) updateData.photos = args.photos

    await ctx.db.patch(args.id, updateData)
    return args.id
  },
})

export const deleteDamage = mutation({
  args: { id: v.id("damages") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const damage = await ctx.db.get(args.id)
    if (!damage || damage.tenantId !== user.tenantId) {
      throw new Error("Damage not found or access denied")
    }

    await ctx.db.delete(args.id)
    return args.id
  },
})
