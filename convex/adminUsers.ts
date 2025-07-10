import { v } from "convex/values"
import { query, mutation } from "./_generated/server"
import { requireAdminRole, validateTenantAccess, ADMIN_ROLES, getPermissionsForRole } from "./adminAuth"

// Get team members for tenant
export const getTeamMembers = query({
  args: {
    tenantId: v.string(),
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdminRole(ctx, "MANAGE_USERS")
    await validateTenantAccess(ctx, args.tenantId)

    let query = ctx.db.query("adminUsers").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))

    if (!args.includeInactive) {
      query = query.filter((q) => q.eq(q.field("isActive"), true))
    }

    const teamMembers = await query.collect()

    return teamMembers.map((member) => ({
      userId: member.userId,
      email: member.email,
      firstName: member.firstName,
      lastName: member.lastName,
      role: member.role,
      permissions: getPermissionsForRole(member.role),
      isActive: member.isActive,
      lastLoginAt: member.lastLoginAt,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    }))
  },
})

// Assign user role with validation
export const assignUserRole = mutation({
  args: {
    tenantId: v.string(),
    userId: v.string(),
    role: v.union(
      v.literal("super_admin"),
      v.literal("tenant_admin"),
      v.literal("manager"),
      v.literal("technician"),
      v.literal("viewer"),
    ),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminUser = await requireAdminRole(ctx, "MANAGE_USERS")
    await validateTenantAccess(ctx, args.tenantId)

    // Validate role assignment permissions
    if (args.role === ADMIN_ROLES.SUPER_ADMIN && adminUser.role !== ADMIN_ROLES.SUPER_ADMIN) {
      throw new Error("Only super admins can assign super admin role")
    }

    if (args.role === ADMIN_ROLES.TENANT_ADMIN && adminUser.role === ADMIN_ROLES.MANAGER) {
      throw new Error("Managers cannot assign tenant admin role")
    }

    const now = Date.now()

    // Get existing user record
    const existingUser = await ctx.db
      .query("adminUsers")
      .withIndex("by_tenant_user", (q) => q.eq("tenantId", args.tenantId).eq("userId", args.userId))
      .first()

    if (existingUser) {
      const previousRole = existingUser.role

      // Update existing user
      await ctx.db.patch(existingUser._id, {
        role: args.role,
        lastUpdatedBy: adminUser.userId,
        updatedAt: now,
      })

      // Log audit event
      await ctx.runMutation("auditLogger:logAuditEvent", {
        tenantId: args.tenantId,
        userId: adminUser.userId,
        action: "USER_ROLE_CHANGED",
        entityType: "admin_user",
        entityId: args.userId,
        changes: {
          previousRole,
          newRole: args.role,
          reason: args.reason,
        },
      })
    } else {
      // Create new admin user record
      await ctx.db.insert("adminUsers", {
        tenantId: args.tenantId,
        userId: args.userId,
        role: args.role,
        isActive: true,
        createdBy: adminUser.userId,
        lastUpdatedBy: adminUser.userId,
        createdAt: now,
        updatedAt: now,
      })

      // Log audit event
      await ctx.runMutation("auditLogger:logAuditEvent", {
        tenantId: args.tenantId,
        userId: adminUser.userId,
        action: "USER_ROLE_ASSIGNED",
        entityType: "admin_user",
        entityId: args.userId,
        changes: {
          role: args.role,
          reason: args.reason,
        },
      })
    }

    return {
      success: true,
      userId: args.userId,
      role: args.role,
      permissions: getPermissionsForRole(args.role),
      updatedAt: now,
    }
  },
})

// Create new team member
export const createTeamMember = mutation({
  args: {
    tenantId: v.string(),
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    role: v.union(v.literal("tenant_admin"), v.literal("manager"), v.literal("technician"), v.literal("viewer")),
    sendInvitation: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const adminUser = await requireAdminRole(ctx, "MANAGE_USERS")
    await validateTenantAccess(ctx, args.tenantId)

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(args.email)) {
      throw new Error("Invalid email format")
    }

    // Check if user already exists
    const existingUser = await ctx.db
      .query("adminUsers")
      .withIndex("by_tenant_email", (q) => q.eq("tenantId", args.tenantId).eq("email", args.email))
      .first()

    if (existingUser) {
      throw new Error("User with this email already exists")
    }

    const now = Date.now()
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Create admin user record
    const adminUserId = await ctx.db.insert("adminUsers", {
      tenantId: args.tenantId,
      userId,
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      role: args.role,
      isActive: true,
      createdBy: adminUser.userId,
      lastUpdatedBy: adminUser.userId,
      createdAt: now,
      updatedAt: now,
    })

    // Send invitation if requested
    if (args.sendInvitation) {
      // In a real implementation, this would send an email invitation
      console.log(`Sending invitation to ${args.email} for tenant ${args.tenantId}`)
    }

    // Log audit event
    await ctx.runMutation("auditLogger:logAuditEvent", {
      tenantId: args.tenantId,
      userId: adminUser.userId,
      action: "TEAM_MEMBER_CREATED",
      entityType: "admin_user",
      entityId: userId,
      changes: {
        email: args.email,
        firstName: args.firstName,
        lastName: args.lastName,
        role: args.role,
      },
    })

    return {
      success: true,
      userId,
      adminUserId,
      email: args.email,
      role: args.role,
      permissions: getPermissionsForRole(args.role),
      createdAt: now,
    }
  },
})

// Deactivate team member
export const deactivateTeamMember = mutation({
  args: {
    tenantId: v.string(),
    userId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminUser = await requireAdminRole(ctx, "MANAGE_USERS")
    await validateTenantAccess(ctx, args.tenantId)

    // Get user record
    const userRecord = await ctx.db
      .query("adminUsers")
      .withIndex("by_tenant_user", (q) => q.eq("tenantId", args.tenantId).eq("userId", args.userId))
      .first()

    if (!userRecord) {
      throw new Error("User not found")
    }

    // Prevent self-deactivation
    if (args.userId === adminUser.userId) {
      throw new Error("Cannot deactivate your own account")
    }

    const now = Date.now()

    // Deactivate user
    await ctx.db.patch(userRecord._id, {
      isActive: false,
      deactivatedBy: adminUser.userId,
      deactivatedAt: now,
      lastUpdatedBy: adminUser.userId,
      updatedAt: now,
    })

    // Log audit event
    await ctx.runMutation("auditLogger:logAuditEvent", {
      tenantId: args.tenantId,
      userId: adminUser.userId,
      action: "TEAM_MEMBER_DEACTIVATED",
      entityType: "admin_user",
      entityId: args.userId,
      changes: {
        reason: args.reason,
        deactivatedAt: now,
      },
    })

    return {
      success: true,
      userId: args.userId,
      deactivatedAt: now,
    }
  },
})
