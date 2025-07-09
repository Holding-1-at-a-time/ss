import { v } from "convex/values"
import { query } from "./_generated/server"
import { getCurrentUser } from "./auth"

export const getInspectionsByIds = query({
  args: { ids: v.array(v.id("inspections")) },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const results = []
    for (const id of args.ids) {
      const inspection = await ctx.db.get(id)
      if (inspection && inspection.tenantId === user.tenantId) {
        results.push(inspection)
      } else {
        results.push(null) // Maintain array order
      }
    }
    return results
  },
})

export const getDamagesByIds = query({
  args: { ids: v.array(v.id("damages")) },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const results = []
    for (const id of args.ids) {
      const damage = await ctx.db.get(id)
      if (damage && damage.tenantId === user.tenantId) {
        results.push(damage)
      } else {
        results.push(null)
      }
    }
    return results
  },
})

export const getEstimatesByIds = query({
  args: { ids: v.array(v.id("estimates")) },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const results = []
    for (const id of args.ids) {
      const estimate = await ctx.db.get(id)
      if (estimate && estimate.tenantId === user.tenantId) {
        results.push(estimate)
      } else {
        results.push(null)
      }
    }
    return results
  },
})
