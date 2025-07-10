import { v } from "convex/values"
import { mutation, query, action } from "./_generated/server"
import { getCurrentUser } from "./auth"
import { requireAdminRole, validateTenantAccess } from "./adminAuth"

// Audit event types for comprehensive tracking
export const AUDIT_ACTIONS = {
  // Authentication & Authorization
  USER_LOGIN: "USER_LOGIN",
  USER_LOGOUT: "USER_LOGOUT",
  USER_ROLE_CHANGED: "USER_ROLE_CHANGED",
  USER_ROLE_ASSIGNED: "USER_ROLE_ASSIGNED",
  TEAM_MEMBER_CREATED: "TEAM_MEMBER_CREATED",
  TEAM_MEMBER_DEACTIVATED: "TEAM_MEMBER_DEACTIVATED",

  // Inspection Operations
  INSPECTION_CREATED: "INSPECTION_CREATED",
  INSPECTION_UPDATED: "INSPECTION_UPDATED",
  INSPECTION_DELETED: "INSPECTION_DELETED",
  INSPECTION_STATUS_CHANGED: "INSPECTION_STATUS_CHANGED",

  // Damage Operations
  DAMAGE_CREATED: "DAMAGE_CREATED",
  DAMAGE_UPDATED: "DAMAGE_UPDATED",
  DAMAGE_DELETED: "DAMAGE_DELETED",
  DAMAGE_ANNOTATION_ADDED: "DAMAGE_ANNOTATION_ADDED",

  // Estimate Operations
  ESTIMATE_CREATED: "ESTIMATE_CREATED",
  ESTIMATE_UPDATED: "ESTIMATE_UPDATED",
  ESTIMATE_APPROVED: "ESTIMATE_APPROVED",
  ESTIMATE_REJECTED: "ESTIMATE_REJECTED",
  ESTIMATE_DELETED: "ESTIMATE_DELETED",

  // Booking Operations
  BOOKING_CREATED: "BOOKING_CREATED",
  BOOKING_UPDATED: "BOOKING_UPDATED",
  BOOKING_CANCELLED: "BOOKING_CANCELLED",
  BOOKING_RESCHEDULED: "BOOKING_RESCHEDULED",
  BOOKING_COMPLETED: "BOOKING_COMPLETED",

  // Settings & Configuration
  SETTINGS_UPDATED: "SETTINGS_UPDATED",
  PRICING_RULE_CREATED: "PRICING_RULE_CREATED",
  PRICING_RULE_UPDATED: "PRICING_RULE_UPDATED",
  PRICING_RULE_DELETED: "PRICING_RULE_DELETED",

  // Data Operations
  DATA_EXPORTED: "DATA_EXPORTED",
  DATA_IMPORTED: "DATA_IMPORTED",
  DATA_DELETED: "DATA_DELETED",

  // Security Events
  UNAUTHORIZED_ACCESS_ATTEMPT: "UNAUTHORIZED_ACCESS_ATTEMPT",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  SUSPICIOUS_ACTIVITY: "SUSPICIOUS_ACTIVITY",
} as const

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]

// Main audit logging mutation
export const logAuditEvent = mutation({
  args: {
    tenantId: v.string(),
    userId: v.string(),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    changes: v.optional(v.any()),
    metadata: v.optional(v.any()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    // Create audit log entry
    const auditLogId = await ctx.db.insert("auditLogs", {
      tenantId: args.tenantId,
      userId: args.userId,
      action: args.action as AuditAction,
      entityType: args.entityType,
      entityId: args.entityId,
      changes: args.changes,
      metadata: args.metadata,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      sessionId: args.sessionId,
      timestamp: now,
      createdAt: now,
    })

    // Check for security-sensitive events
    const securityEvents = [
      AUDIT_ACTIONS.UNAUTHORIZED_ACCESS_ATTEMPT,
      AUDIT_ACTIONS.PERMISSION_DENIED,
      AUDIT_ACTIONS.SUSPICIOUS_ACTIVITY,
      AUDIT_ACTIONS.USER_ROLE_CHANGED,
    ]

    if (securityEvents.includes(args.action as AuditAction)) {
      // Create security alert
      await ctx.db.insert("securityAlerts", {
        tenantId: args.tenantId,
        auditLogId,
        alertType: "SECURITY_EVENT",
        severity: getSeverityForAction(args.action as AuditAction),
        description: `Security event: ${args.action} by user ${args.userId}`,
        resolved: false,
        createdAt: now,
      })
    }

    return auditLogId
  },
})

// Get audit logs with admin validation
export const getAuditLogs = query({
  args: {
    tenantId: v.string(),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    userId: v.optional(v.string()),
    action: v.optional(v.string()),
    entityType: v.optional(v.string()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdminRole(ctx, "VIEW_AUDIT_LOGS")
    await validateTenantAccess(ctx, args.tenantId)

    let query = ctx.db.query("auditLogs").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))

    // Apply filters
    if (args.startDate) {
      query = query.filter((q) => q.gte(q.field("timestamp"), args.startDate!))
    }

    if (args.endDate) {
      query = query.filter((q) => q.lte(q.field("timestamp"), args.endDate!))
    }

    if (args.userId) {
      query = query.filter((q) => q.eq(q.field("userId"), args.userId))
    }

    if (args.action) {
      query = query.filter((q) => q.eq(q.field("action"), args.action))
    }

    if (args.entityType) {
      query = query.filter((q) => q.eq(q.field("entityType"), args.entityType))
    }

    // Get results with pagination
    const results = await query.order("desc").take(args.limit || 100)

    // Apply offset if specified
    const offsetResults = args.offset ? results.slice(args.offset) : results

    return offsetResults.map((log) => ({
      id: log._id,
      tenantId: log.tenantId,
      userId: log.userId,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      changes: log.changes,
      metadata: log.metadata,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      sessionId: log.sessionId,
      timestamp: log.timestamp,
      formattedTimestamp: new Date(log.timestamp).toISOString(),
    }))
  },
})

// Get audit statistics
export const getAuditStatistics = query({
  args: {
    tenantId: v.string(),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdminRole(ctx, "VIEW_AUDIT_LOGS")
    await validateTenantAccess(ctx, args.tenantId)

    let query = ctx.db.query("auditLogs").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))

    if (args.startDate) {
      query = query.filter((q) => q.gte(q.field("timestamp"), args.startDate!))
    }

    if (args.endDate) {
      query = query.filter((q) => q.lte(q.field("timestamp"), args.endDate!))
    }

    const logs = await query.collect()

    // Calculate statistics
    const totalEvents = logs.length
    const uniqueUsers = new Set(logs.map((log) => log.userId)).size

    // Action frequency
    const actionCounts = new Map<string, number>()
    logs.forEach((log) => {
      const count = actionCounts.get(log.action) || 0
      actionCounts.set(log.action, count + 1)
    })

    const topActions = Array.from(actionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([action, count]) => ({ action, count }))

    // Daily activity
    const dailyActivity = new Map<string, number>()
    logs.forEach((log) => {
      const date = new Date(log.timestamp).toISOString().split("T")[0]
      const count = dailyActivity.get(date) || 0
      dailyActivity.set(date, count + 1)
    })

    const dailyActivityArray = Array.from(dailyActivity.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }))

    // Security events
    const securityEvents = logs.filter((log) =>
      [
        AUDIT_ACTIONS.UNAUTHORIZED_ACCESS_ATTEMPT,
        AUDIT_ACTIONS.PERMISSION_DENIED,
        AUDIT_ACTIONS.SUSPICIOUS_ACTIVITY,
      ].includes(log.action),
    ).length

    return {
      totalEvents,
      uniqueUsers,
      securityEvents,
      topActions,
      dailyActivity: dailyActivityArray,
      dateRange: {
        start: args.startDate ? new Date(args.startDate).toISOString() : null,
        end: args.endDate ? new Date(args.endDate).toISOString() : null,
      },
    }
  },
})

// Audit middleware for automatic logging
export const auditMiddleware = action({
  args: {
    operation: v.string(),
    tenantId: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    beforeData: v.optional(v.any()),
    afterData: v.optional(v.any()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.userId) {
      return // Skip audit for unauthenticated operations
    }

    // Calculate changes diff
    const changes = calculateChanges(args.beforeData, args.afterData)

    // Map operation to audit action
    const action = mapOperationToAuditAction(args.operation, args.entityType)

    if (action) {
      await ctx.runMutation("auditLogger:logAuditEvent", {
        tenantId: args.tenantId,
        userId: user.userId,
        action,
        entityType: args.entityType,
        entityId: args.entityId,
        changes,
        metadata: args.metadata,
      })
    }
  },
})

// Helper functions
function getSeverityForAction(action: AuditAction): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  const severityMap: Record<string, "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"> = {
    [AUDIT_ACTIONS.UNAUTHORIZED_ACCESS_ATTEMPT]: "HIGH",
    [AUDIT_ACTIONS.PERMISSION_DENIED]: "MEDIUM",
    [AUDIT_ACTIONS.SUSPICIOUS_ACTIVITY]: "HIGH",
    [AUDIT_ACTIONS.USER_ROLE_CHANGED]: "MEDIUM",
    [AUDIT_ACTIONS.SETTINGS_UPDATED]: "MEDIUM",
    [AUDIT_ACTIONS.DATA_DELETED]: "HIGH",
  }

  return severityMap[action] || "LOW"
}

function calculateChanges(beforeData: any, afterData: any): any {
  if (!beforeData || !afterData) {
    return afterData || beforeData
  }

  const changes: any = {}

  // Simple diff calculation
  for (const key in afterData) {
    if (beforeData[key] !== afterData[key]) {
      changes[key] = {
        before: beforeData[key],
        after: afterData[key],
      }
    }
  }

  return changes
}

function mapOperationToAuditAction(operation: string, entityType: string): AuditAction | null {
  const operationMap: Record<string, Record<string, AuditAction>> = {
    CREATE: {
      inspection: AUDIT_ACTIONS.INSPECTION_CREATED,
      damage: AUDIT_ACTIONS.DAMAGE_CREATED,
      estimate: AUDIT_ACTIONS.ESTIMATE_CREATED,
      booking: AUDIT_ACTIONS.BOOKING_CREATED,
    },
    UPDATE: {
      inspection: AUDIT_ACTIONS.INSPECTION_UPDATED,
      damage: AUDIT_ACTIONS.DAMAGE_UPDATED,
      estimate: AUDIT_ACTIONS.ESTIMATE_UPDATED,
      booking: AUDIT_ACTIONS.BOOKING_UPDATED,
    },
    DELETE: {
      inspection: AUDIT_ACTIONS.INSPECTION_DELETED,
      damage: AUDIT_ACTIONS.DAMAGE_DELETED,
      estimate: AUDIT_ACTIONS.ESTIMATE_DELETED,
    },
  }

  return operationMap[operation]?.[entityType] || null
}
