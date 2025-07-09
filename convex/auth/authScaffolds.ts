import { v } from "convex/values"
import { query, mutation } from "./_generated/server"
import {
  getAuthContext,
  requireAuth,
  requirePermission,
  requireAdmin,
  requireTenantMembership,
  hasHigherRole,
  getPermissionsForRole,
} from "./authContext"

// User login/session initialization
export const initializeUserSession = mutation({
  args: {
    sessionId: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authContext = await requireAuth(ctx)

    // Update session activity if sessionId provided
    if (args.sessionId) {
      await ctx.runMutation("auth/sessionManagement:updateSessionActivity", {
        sessionId: args.sessionId,
        lastActiveAt: Date.now(),
      })
    }

    // Log login event
    await ctx.runMutation("auditLogger:logAuditEvent", {
      tenantId: authContext.tenantId || "system",
      userId: authContext.userId,
      action: "USER_LOGIN",
      entityType: "session",
      entityId: args.sessionId || "unknown",
      metadata: {
        ipAddress: args.ipAddress,
        userAgent: args.userAgent,
      },
    })

    return {
      success: true,
      user: {
        userId: authContext.userId,
        tenantId: authContext.tenantId,
        role: authContext.role,
        permissions: authContext.permissions,
        isAdmin: authContext.isAdmin,
        isSuperAdmin: authContext.isSuperAdmin,
        metadata: authContext.metadata,
      },
    }
  },
})

// Get current user context
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const authContext = await getAuthContext(ctx)
    if (!authContext) {
      return null
    }

    return {
      userId: authContext.userId,
      tenantId: authContext.tenantId,
      role: authContext.role,
      permissions: authContext.permissions,
      isAdmin: authContext.isAdmin,
      isSuperAdmin: authContext.isSuperAdmin,
      metadata: authContext.metadata,
    }
  },
})

// Get user roles and permissions
export const getUserRolesAndPermissions = query({
  args: {
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authContext = await requireAuth(ctx)

    // If userId is provided and different from current user, require admin access
    const targetUserId = args.userId || authContext.userId
    if (targetUserId !== authContext.userId) {
      await requirePermission(ctx, "view_users")
    }

    // Get user's memberships
    const memberships = await ctx.db
      .query("tenantMemberships")
      .withIndex("by_user_id", (q) => q.eq("userId", targetUserId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect()

    return memberships.map((membership) => ({
      tenantId: membership.tenantId,
      organizationId: membership.organizationId,
      role: membership.role,
      permissions: membership.permissions,
      joinedAt: membership.joinedAt,
    }))
  },
})

// Admin-only: Get all users in tenant
export const getTenantUsers = query({
  args: {
    tenantId: v.string(),
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.tenantId)

    const members = await ctx.runQuery("auth/userManagement:getTenantMembers", {
      tenantId: args.tenantId,
      includeInactive: args.includeInactive,
    })

    return members.map(({ membership, user }) => ({
      userId: user.userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      imageUrl: user.imageUrl,
      role: membership.role,
      permissions: membership.permissions,
      isActive: membership.isActive,
      joinedAt: membership.joinedAt,
      lastLoginAt: user.lastLoginAt,
    }))
  },
})

// Admin-only: Update user role in tenant
export const updateUserRole = mutation({
  args: {
    tenantId: v.string(),
    userId: v.string(),
    newRole: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authContext = await requireAdmin(ctx, args.tenantId)

    // Get current membership
    const membership = await ctx.db
      .query("tenantMemberships")
      .withIndex("by_user_tenant", (q) => q.eq("userId", args.userId).eq("tenantId", args.tenantId))
      .first()

    if (!membership) {
      throw new Error("User is not a member of this tenant")
    }

    // Prevent self-role changes to lower privilege
    if (args.userId === authContext.userId && !hasHigherRole(args.newRole, authContext.role)) {
      throw new Error("Cannot reduce your own role privileges")
    }

    const previousRole = membership.role

    // Update membership
    await ctx.db.patch(membership._id, {
      role: args.newRole,
      permissions: getPermissionsForRole(args.newRole),
      updatedAt: Date.now(),
    })

    // Log audit event
    await ctx.runMutation("auditLogger:logAuditEvent", {
      tenantId: args.tenantId,
      userId: authContext.userId,
      action: "USER_ROLE_CHANGED",
      entityType: "tenant_membership",
      entityId: membership._id,
      changes: {
        previousRole,
        newRole: args.newRole,
        reason: args.reason,
        targetUserId: args.userId,
      },
    })

    return {
      success: true,
      userId: args.userId,
      previousRole,
      newRole: args.newRole,
      permissions: getPermissionsForRole(args.newRole),
    }
  },
})

// Admin-only: Remove user from tenant
export const removeUserFromTenant = mutation({
  args: {
    tenantId: v.string(),
    userId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authContext = await requireAdmin(ctx, args.tenantId)

    // Prevent self-removal
    if (args.userId === authContext.userId) {
      throw new Error("Cannot remove yourself from the tenant")
    }

    // Get membership
    const membership = await ctx.db
      .query("tenantMemberships")
      .withIndex("by_user_tenant", (q) => q.eq("userId", args.userId).eq("tenantId", args.tenantId))
      .first()

    if (!membership) {
      throw new Error("User is not a member of this tenant")
    }

    // Deactivate membership
    await ctx.db.patch(membership._id, {
      isActive: false,
      leftAt: Date.now(),
      updatedAt: Date.now(),
    })

    // Log audit event
    await ctx.runMutation("auditLogger:logAuditEvent", {
      tenantId: args.tenantId,
      userId: authContext.userId,
      action: "USER_REMOVED_FROM_TENANT",
      entityType: "tenant_membership",
      entityId: membership._id,
      changes: {
        removedUserId: args.userId,
        reason: args.reason,
      },
    })

    return {
      success: true,
      userId: args.userId,
      removedAt: Date.now(),
    }
  },
})

// Tenant-scoped resource access example
export const getInspectionWithAuth = query({
  args: {
    inspectionId: v.id("inspections"),
  },
  handler: async (ctx, args) => {
    const authContext = await requirePermission(ctx, "view_inspections")

    // Get inspection
    const inspection = await ctx.db.get(args.inspectionId)
    if (!inspection) {
      throw new Error("Inspection not found")
    }

    // Ensure tenant access
    await requireTenantMembership(ctx, inspection.tenantId)

    return inspection
  },
})

// Admin-only mutation example
export const deleteInspectionWithAuth = mutation({
  args: {
    inspectionId: v.id("inspections"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authContext = await requirePermission(ctx, "delete_inspections")

    // Get inspection
    const inspection = await ctx.db.get(args.inspectionId)
    if (!inspection) {
      throw new Error("Inspection not found")
    }

    // Ensure tenant access and admin privileges
    await requireAdmin(ctx, inspection.tenantId)

    // Check for dependencies
    const damages = await ctx.db
      .query("damages")
      .withIndex("by_tenant_inspection", (q) =>
        q.eq("tenantId", inspection.tenantId).eq("inspectionId", args.inspectionId),
      )
      .collect()

    if (damages.length > 0) {
      throw new Error("Cannot delete inspection with associated damages")
    }

    // Delete inspection
    await ctx.db.delete(args.inspectionId)

    // Log audit event
    await ctx.runMutation("auditLogger:logAuditEvent", {
      tenantId: inspection.tenantId,
      userId: authContext.userId,
      action: "INSPECTION_DELETED",
      entityType: "inspection",
      entityId: args.inspectionId,
      changes: {
        reason: args.reason,
        deletedInspection: {
          vehicleVin: inspection.vehicleVin,
          customerName: inspection.customerName,
        },
      },
    })

    return {
      success: true,
      inspectionId: args.inspectionId,
      deletedAt: Date.now(),
    }
  },
})
