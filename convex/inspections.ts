import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { getCurrentUser } from "./auth"

// Queries
export const getInspections = query({
  args: {
    status: v.optional(
      v.union(v.literal("pending"), v.literal("in_progress"), v.literal("completed"), v.literal("cancelled")),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    let query = ctx.db.query("inspections").withIndex("by_tenant", (q) => q.eq("tenantId", user.tenantId))

    if (args.status) {
      query = ctx.db
        .query("inspections")
        .withIndex("by_tenant_status", (q) => q.eq("tenantId", user.tenantId).eq("status", args.status))
    }

    const inspections = await query.order("desc").take(args.limit ?? 50)

    return inspections
  },
})

export const getInspectionById = query({
  args: { id: v.id("inspections") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const inspection = await ctx.db.get(args.id)
    if (!inspection || inspection.tenantId !== user.tenantId) {
      throw new Error("Inspection not found or access denied")
    }

    return inspection
  },
})

export const searchInspections = query({
  args: {
    searchTerm: v.string(),
    status: v.optional(
      v.union(v.literal("pending"), v.literal("in_progress"), v.literal("completed"), v.literal("cancelled")),
    ),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const results = await ctx.db
      .query("inspections")
      .withSearchIndex("search_by_tenant", (q) =>
        q
          .search("vehicleVin", args.searchTerm)
          .eq("tenantId", user.tenantId)
          .eq("status", args.status ?? "pending"),
      )
      .take(20)

    return results
  },
})

// Mutations
export const createInspection = mutation({
  args: {
    vehicleVin: v.string(),
    vehicleMake: v.string(),
    vehicleModel: v.string(),
    vehicleYear: v.number(),
    customerName: v.string(),
    customerEmail: v.string(),
    customerPhone: v.string(),
    inspectionType: v.union(
      v.literal("intake"),
      v.literal("pre_detail"),
      v.literal("post_detail"),
      v.literal("quality_check"),
    ),
    scheduledAt: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const now = Date.now()
    const inspectionId = await ctx.db.insert("inspections", {
      tenantId: user.tenantId,
      vehicleVin: args.vehicleVin,
      vehicleMake: args.vehicleMake,
      vehicleModel: args.vehicleModel,
      vehicleYear: args.vehicleYear,
      customerName: args.customerName,
      customerEmail: args.customerEmail,
      customerPhone: args.customerPhone,
      status: "pending",
      inspectionType: args.inspectionType,
      scheduledAt: args.scheduledAt,
      notes: args.notes,
      photos: [],
      createdAt: now,
      updatedAt: now,
    })

    return inspectionId
  },
})

export const updateInspection = mutation({
  args: {
    id: v.id("inspections"),
    status: v.optional(
      v.union(v.literal("pending"), v.literal("in_progress"), v.literal("completed"), v.literal("cancelled")),
    ),
    completedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    overallCondition: v.optional(
      v.union(v.literal("excellent"), v.literal("good"), v.literal("fair"), v.literal("poor")),
    ),
    photos: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const inspection = await ctx.db.get(args.id)
    if (!inspection || inspection.tenantId !== user.tenantId) {
      throw new Error("Inspection not found or access denied")
    }

    const updateData: any = {
      updatedAt: Date.now(),
    }

    if (args.status !== undefined) updateData.status = args.status
    if (args.completedAt !== undefined) updateData.completedAt = args.completedAt
    if (args.notes !== undefined) updateData.notes = args.notes
    if (args.overallCondition !== undefined) updateData.overallCondition = args.overallCondition
    if (args.photos !== undefined) updateData.photos = args.photos

    await ctx.db.patch(args.id, updateData)
    return args.id
  },
})

export const deleteInspection = mutation({
  args: { id: v.id("inspections") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const inspection = await ctx.db.get(args.id)
    if (!inspection || inspection.tenantId !== user.tenantId) {
      throw new Error("Inspection not found or access denied")
    }

    // Check for related damages and estimates
    const damages = await ctx.db
      .query("damages")
      .withIndex("by_tenant_inspection", (q) => q.eq("tenantId", user.tenantId).eq("inspectionId", args.id))
      .collect()

    const estimates = await ctx.db
      .query("estimates")
      .withIndex("by_tenant_inspection", (q) => q.eq("tenantId", user.tenantId).eq("inspectionId", args.id))
      .collect()

    if (damages.length > 0 || estimates.length > 0) {
      throw new Error("Cannot delete inspection with related damages or estimates")
    }

    await ctx.db.delete(args.id)
    return args.id
  },
})
