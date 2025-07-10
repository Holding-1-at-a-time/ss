import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { getPermissionsForRole } from "./clerkIntegration"

// Create user from Clerk webhook
export const createUser = mutation({
  args: {
    userId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    clerkData: v.any(),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first()

    if (existingUser) {
      console.log(`User ${args.userId} already exists, skipping creation`)
      return existingUser._id
    }

    // Create user record
    const userId = await ctx.db.insert("users", {
      userId: args.userId,
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      imageUrl: args.imageUrl,
      isActive: true,
      clerkData: args.clerkData,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    })

    return userId
  },
})

// Update user from Clerk webhook
export const updateUser = mutation({
  args: {
    userId: v.string(),
    email: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    clerkData: v.any(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first()

    if (!user) {
      throw new Error(`User ${args.userId} not found`)
    }

    const updateData: any = {
      updatedAt: Date.now(),
      clerkData: args.clerkData,
    }

    if (args.email !== undefined) updateData.email = args.email
    if (args.firstName !== undefined) updateData.firstName = args.firstName
    if (args.lastName !== undefined) updateData.lastName = args.lastName
    if (args.imageUrl !== undefined) updateData.imageUrl = args.imageUrl

    await ctx.db.patch(user._id, updateData)
    return user._id
  },
})

// Deactivate user
export const deactivateUser = mutation({
  args: {
    userId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first()

    if (!user) {
      throw new Error(`User ${args.userId} not found`)
    }

    await ctx.db.patch(user._id, {
      isActive: false,
      deactivatedAt: Date.now(),
      deactivationReason: args.reason,
      updatedAt: Date.now(),
    })

    // Deactivate all user's tenant memberships
    const memberships = await ctx.db
      .query("tenantMemberships")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .collect()

    for (const membership of memberships) {
      await ctx.db.patch(membership._id, {
        isActive: false,
        updatedAt: Date.now(),
      })
    }

    return user._id
  },
})

// Assign organization/tenant role
export const assignOrganizationRole = mutation({
  args: {
    userId: v.string(),
    organizationId: v.string(),
    tenantId: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    // Validate user exists
    const user = await ctx.db
      .query("users")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first()

    if (!user) {
      throw new Error(`User ${args.userId} not found`)
    }

    // Check if membership already exists
    const existingMembership = await ctx.db
      .query("tenantMemberships")
      .withIndex("by_user_tenant", (q) => q.eq("userId", args.userId).eq("tenantId", args.tenantId))
      .first()

    if (existingMembership) {
      // Update existing membership
      await ctx.db.patch(existingMembership._id, {
        role: args.role,
        organizationId: args.organizationId,
        permissions: getPermissionsForRole(args.role),
        isActive: true,
        updatedAt: now,
      })
      return existingMembership._id
    }

    // Create new membership
    const membershipId = await ctx.db.insert("tenantMemberships", {
      userId: args.userId,
      tenantId: args.tenantId,
      organizationId: args.organizationId,
      role: args.role,
      permissions: getPermissionsForRole(args.role),
      isActive: true,
      joinedAt: now,
      createdAt: now,
      updatedAt: now,
    })

    return membershipId
  },
})

// Update organization role
export const updateOrganizationRole = mutation({
  args: {
    userId: v.string(),
    organizationId: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("tenantMemberships")
      .withIndex("by_user_organization", (q) => q.eq("userId", args.userId).eq("organizationId", args.organizationId))
      .first()

    if (!membership) {
      throw new Error(`Membership not found for user ${args.userId} in organization ${args.organizationId}`)
    }

    await ctx.db.patch(membership._id, {
      role: args.role,
      permissions: getPermissionsForRole(args.role),
      updatedAt: Date.now(),
    })

    return membership._id
  },
})

// Remove organization role
export const removeOrganizationRole = mutation({
  args: {
    userId: v.string(),
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("tenantMemberships")
      .withIndex("by_user_organization", (q) => q.eq("userId", args.userId).eq("organizationId", args.organizationId))
      .first()

    if (!membership) {
      throw new Error(`Membership not found for user ${args.userId} in organization ${args.organizationId}`)
    }

    await ctx.db.patch(membership._id, {
      isActive: false,
      leftAt: Date.now(),
      updatedAt: Date.now(),
    })

    return membership._id
  },
})

// Get user with tenant memberships
export const getUserWithMemberships = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first()

    if (!user) {
      return null
    }

    const memberships = await ctx.db
      .query("tenantMemberships")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect()

    return {
      user,
      memberships,
    }
  },
})

// Get tenant members
export const getTenantMembers = query({
  args: {
    tenantId: v.string(),
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("tenantMemberships").withIndex("by_tenant_id", (q) => q.eq("tenantId", args.tenantId))

    if (!args.includeInactive) {
      query = query.filter((q) => q.eq(q.field("isActive"), true))
    }

    const memberships = await query.collect()

    // Get user details for each membership
    const members = []
    for (const membership of memberships) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_user_id", (q) => q.eq("userId", membership.userId))
        .first()

      if (user) {
        members.push({
          membership,
          user,
        })
      }
    }

    return members
  },
})
