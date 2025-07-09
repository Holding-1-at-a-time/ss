import { v } from "convex/values"
import { mutation } from "./_generated/server"
import { getCurrentUser } from "./auth"
import { api } from "./_generated/api"

// Refresh pricing for inspection estimates
export const refreshInspectionPricing = mutation({
  args: {
    inspectionId: v.id("inspections"),
    reason: v.string(),
    weather: v.optional(
      v.object({
        temperature: v.number(),
        humidity: v.number(),
        precipitation: v.boolean(),
        windSpeed: v.number(),
        uvIndex: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    // Get all estimates for the inspection
    const estimates = await ctx.db
      .query("estimates")
      .withIndex("by_tenant_inspection", (q) => q.eq("tenantId", user.tenantId).eq("inspectionId", args.inspectionId))
      .filter((q) => q.or(q.eq(q.field("status"), "draft"), q.eq(q.field("status"), "pending")))
      .collect()

    const updatedEstimates = []

    // Refresh each estimate using the estimate action
    for (const estimate of estimates) {
      try {
        const refreshResult = await ctx.runAction(api.estimateActions.computeEstimateAndStoreVector, {
          inspectionId: args.inspectionId,
          serviceType: estimate.serviceType,
          weather: args.weather,
          forceRecalculate: true,
        })

        updatedEstimates.push({
          estimateId: estimate._id,
          serviceType: estimate.serviceType,
          success: true,
          previousTotal: estimate.total,
          newTotal: refreshResult.breakdown.total,
          change: refreshResult.breakdown.total - estimate.total,
        })
      } catch (error) {
        updatedEstimates.push({
          estimateId: estimate._id,
          serviceType: estimate.serviceType,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    return {
      inspectionId: args.inspectionId,
      reason: args.reason,
      updatedEstimates,
      totalUpdated: updatedEstimates.filter((e) => e.success).length,
      refreshedAt: Date.now(),
    }
  },
})
