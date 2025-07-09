import { v } from "convex/values"
import { query, mutation } from "./_generated/server"
import { getCurrentUser } from "./auth"

// Search analytics and optimization
export const logSearchQuery = mutation({
  args: {
    queryText: v.string(),
    filters: v.optional(v.any()),
    resultCount: v.number(),
    executionTime: v.number(),
    userAction: v.optional(v.string()), // "clicked", "refined", "abandoned"
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    await ctx.db.insert("searchLogs", {
      tenantId: user.tenantId,
      userId: user.userId,
      queryText: args.queryText,
      filters: args.filters,
      resultCount: args.resultCount,
      executionTime: args.executionTime,
      userAction: args.userAction,
      timestamp: Date.now(),
    })
  },
})

// Get search analytics
export const getSearchAnalytics = query({
  args: {
    dateStart: v.optional(v.number()),
    dateEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    let query = ctx.db.query("searchLogs").withIndex("by_tenant", (q) => q.eq("tenantId", user.tenantId))

    if (args.dateStart) {
      query = query.filter((q) => q.gte(q.field("timestamp"), args.dateStart!))
    }

    if (args.dateEnd) {
      query = query.filter((q) => q.lte(q.field("timestamp"), args.dateEnd!))
    }

    const logs = await query.collect()

    // Calculate analytics
    const totalSearches = logs.length
    const averageExecutionTime =
      logs.length > 0 ? logs.reduce((sum, log) => sum + log.executionTime, 0) / logs.length : 0

    const averageResultCount = logs.length > 0 ? logs.reduce((sum, log) => sum + log.resultCount, 0) / logs.length : 0

    // Popular queries
    const queryFrequency = new Map<string, number>()
    logs.forEach((log) => {
      const count = queryFrequency.get(log.queryText) || 0
      queryFrequency.set(log.queryText, count + 1)
    })

    const popularQueries = Array.from(queryFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }))

    // Zero result queries
    const zeroResultQueries = logs.filter((log) => log.resultCount === 0).map((log) => log.queryText)

    return {
      totalSearches,
      averageExecutionTime,
      averageResultCount,
      popularQueries,
      zeroResultQueries: [...new Set(zeroResultQueries)].slice(0, 10),
      searchTrends: {
        dailySearches: calculateDailySearches(logs),
        performanceMetrics: calculatePerformanceMetrics(logs),
      },
    }
  },
})

// Helper functions for analytics
function calculateDailySearches(logs: any[]): Array<{ date: string; count: number }> {
  const dailyCounts = new Map<string, number>()

  logs.forEach((log) => {
    const date = new Date(log.timestamp).toISOString().split("T")[0]
    const count = dailyCounts.get(date) || 0
    dailyCounts.set(date, count + 1)
  })

  return Array.from(dailyCounts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }))
}

function calculatePerformanceMetrics(logs: any[]): {
  fastQueries: number
  slowQueries: number
  averageByResultCount: Array<{ resultRange: string; avgTime: number }>
} {
  const fastQueries = logs.filter((log) => log.executionTime < 500).length
  const slowQueries = logs.filter((log) => log.executionTime > 2000).length

  // Group by result count ranges
  const resultRanges = [
    { min: 0, max: 0, label: "0 results" },
    { min: 1, max: 10, label: "1-10 results" },
    { min: 11, max: 50, label: "11-50 results" },
    { min: 51, max: Number.POSITIVE_INFINITY, label: "50+ results" },
  ]

  const averageByResultCount = resultRanges.map((range) => {
    const logsInRange = logs.filter((log) => log.resultCount >= range.min && log.resultCount <= range.max)

    const avgTime =
      logsInRange.length > 0 ? logsInRange.reduce((sum, log) => sum + log.executionTime, 0) / logsInRange.length : 0

    return {
      resultRange: range.label,
      avgTime: Math.round(avgTime),
    }
  })

  return {
    fastQueries,
    slowQueries,
    averageByResultCount,
  }
}
