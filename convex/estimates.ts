import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { getCurrentUser } from "./auth"

// Queries
export const getEstimates = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
        v.literal("expired"),
      ),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    let query = ctx.db.query("estimates").withIndex("by_tenant", (q) => q.eq("tenantId", user.tenantId))

    if (args.status) {
      query = ctx.db
        .query("estimates")
        .withIndex("by_tenant_status", (q) => q.eq("tenantId", user.tenantId).eq("status", args.status))
    }

    const estimates = await query.order("desc").take(args.limit ?? 50)

    return estimates
  },
})

export const getEstimateById = query({
  args: { id: v.id("estimates") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const estimate = await ctx.db.get(args.id)
    if (!estimate || estimate.tenantId !== user.tenantId) {
      throw new Error("Estimate not found or access denied")
    }

    return estimate
  },
})

export const getEstimatesByInspection = query({
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

    const estimates = await ctx.db
      .query("estimates")
      .withIndex("by_tenant_inspection", (q) => q.eq("tenantId", user.tenantId).eq("inspectionId", args.inspectionId))
      .collect()

    return estimates
  },
})

export const searchEstimates = query({
  args: {
    searchTerm: v.string(),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
        v.literal("expired"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const results = await ctx.db
      .query("estimates")
      .withSearchIndex("search_by_tenant", (q) =>
        q
          .search("estimateNumber", args.searchTerm)
          .eq("tenantId", user.tenantId)
          .eq("status", args.status ?? "pending"),
      )
      .take(20)

    return results
  },
})

// Mutations
export const createEstimate = mutation({
  args: {
    inspectionId: v.id("inspections"),
    estimateNumber: v.string(),
    serviceType: v.union(
      v.literal("basic_wash"),
      v.literal("detail"),
      v.literal("premium_detail"),
      v.literal("repair"),
      v.literal("custom"),
    ),
    laborHours: v.number(),
    laborRate: v.number(),
    materialsCost: v.number(),
    taxRate: v.number(),
    validUntil: v.number(),
    lineItems: v.array(
      v.object({
        description: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
        total: v.number(),
      }),
    ),
    notes: v.optional(v.string()),
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

    // Calculate totals
    const subtotal = args.laborHours * args.laborRate + args.materialsCost
    const taxAmount = subtotal * args.taxRate
    const total = subtotal + taxAmount

    const now = Date.now()
    const estimateId = await ctx.db.insert("estimates", {
      tenantId: user.tenantId,
      inspectionId: args.inspectionId,
      estimateNumber: args.estimateNumber,
      status: "draft",
      serviceType: args.serviceType,
      laborHours: args.laborHours,
      laborRate: args.laborRate,
      materialsCost: args.materialsCost,
      subtotal,
      taxRate: args.taxRate,
      taxAmount,
      total,
      validUntil: args.validUntil,
      lineItems: args.lineItems,
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    })

    return estimateId
  },
})

export const updateEstimate = mutation({
  args: {
    id: v.id("estimates"),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
        v.literal("expired"),
      ),
    ),
    laborHours: v.optional(v.number()),
    laborRate: v.optional(v.number()),
    materialsCost: v.optional(v.number()),
    taxRate: v.optional(v.number()),
    lineItems: v.optional(
      v.array(
        v.object({
          description: v.string(),
          quantity: v.number(),
          unitPrice: v.number(),
          total: v.number(),
        }),
      ),
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const estimate = await ctx.db.get(args.id)
    if (!estimate || estimate.tenantId !== user.tenantId) {
      throw new Error("Estimate not found or access denied")
    }

    const updateData: any = {
      updatedAt: Date.now(),
    }

    // Recalculate totals if pricing fields change
    const laborHours = args.laborHours ?? estimate.laborHours
    const laborRate = args.laborRate ?? estimate.laborRate
    const materialsCost = args.materialsCost ?? estimate.materialsCost
    const taxRate = args.taxRate ?? estimate.taxRate

    if (
      args.laborHours !== undefined ||
      args.laborRate !== undefined ||
      args.materialsCost !== undefined ||
      args.taxRate !== undefined
    ) {
      const subtotal = laborHours * laborRate + materialsCost
      const taxAmount = subtotal * taxRate
      const total = subtotal + taxAmount

      updateData.laborHours = laborHours
      updateData.laborRate = laborRate
      updateData.materialsCost = materialsCost
      updateData.subtotal = subtotal
      updateData.taxRate = taxRate
      updateData.taxAmount = taxAmount
      updateData.total = total
    }

    if (args.status !== undefined) updateData.status = args.status
    if (args.lineItems !== undefined) updateData.lineItems = args.lineItems
    if (args.notes !== undefined) updateData.notes = args.notes

    await ctx.db.patch(args.id, updateData)
    return args.id
  },
})

export const deleteEstimate = mutation({
  args: { id: v.id("estimates") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const estimate = await ctx.db.get(args.id)
    if (!estimate || estimate.tenantId !== user.tenantId) {
      throw new Error("Estimate not found or access denied")
    }

    // Check for related bookings
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_tenant", (q) => q.eq("tenantId", user.tenantId))
      .filter((q) => q.eq(q.field("estimateId"), args.id))
      .collect()

    if (bookings.length > 0) {
      throw new Error("Cannot delete estimate with related bookings")
    }

    await ctx.db.delete(args.id)
    return args.id
  },
})
