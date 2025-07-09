import type { QueryCtx, MutationCtx } from "./_generated/server"
import { ConvexError } from "convex/values"
import { type AuthContext, getPermissionsForRole, hasPermission, hasHigherRole } from "./clerkIntegration"

// Get current authenticated user context
export async function getAuthContext(ctx: QueryCtx | MutationCtx): Promise<AuthContext | null> {
  // Get Clerk identity
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    return null
  }

  const userId = identity.subject

  // Get user record
  const user = await ctx.db
    .query("users")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .first()

  if (!user || !user.isActive) {
    return null
  }

  // Get user's tenant memberships
  const memberships = await ctx.db
    .query("tenantMemberships")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("isActive"), true))
    .collect()

  // For now, use the first active membership as primary tenant
  // In a real app, you might have logic to determine the current tenant context
  const primaryMembership = memberships[0]

  if (!primaryMembership) {
    // User exists but has no tenant memberships
    return {
      userId,
      tenantId: "",
      role: "GUEST",
      permissions: [],
      isAuthenticated: true,
      isAdmin: false,
      isSuperAdmin: false,
      metadata: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        imageUrl: user.imageUrl,
        lastLoginAt: user.lastLoginAt,
      },
    }
  }

  const permissions = getPermissionsForRole(primaryMembership.role)
  const isAdmin = hasHigherRole(primaryMembership.role, "MANAGER")
  const isSuperAdmin = primaryMembership.role === "SUPER_ADMIN"

  return {
    userId,
    tenantId: primaryMembership.tenantId,
    role: primaryMembership.role,
    permissions,
    organizationId: primaryMembership.organizationId,
    organizationRole: primaryMembership.role,
    isAuthenticated: true,
    isAdmin,
    isSuperAdmin,
    metadata: {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      imageUrl: user.imageUrl,
      lastLoginAt: user.lastLoginAt,
    },
  }
}

// Require authentication
export async function requireAuth(ctx: QueryCtx | MutationCtx): Promise<AuthContext> {
  const authContext = await getAuthContext(ctx)
  if (!authContext || !authContext.isAuthenticated) {
    throw new ConvexError("Authentication required")
  }
  return authContext
}

// Require specific permission
export async function requirePermission(
  ctx: QueryCtx | MutationCtx,
  permission: string,
  tenantId?: string,
): Promise<AuthContext> {
  const authContext = await requireAuth(ctx)

  // Super admins have all permissions
  if (authContext.isSuperAdmin) {
    return authContext
  }

  // Check if user has the required permission
  if (!hasPermission(authContext.role, permission)) {
    throw new ConvexError(`Permission denied: ${permission} required`)
  }

  // If tenantId is specified, ensure user belongs to that tenant
  if (tenantId && authContext.tenantId !== tenantId) {
    throw new ConvexError("Access denied: Invalid tenant context")
  }

  return authContext
}

// Require admin role
export async function requireAdmin(ctx: QueryCtx | MutationCtx, tenantId?: string): Promise<AuthContext> {
  const authContext = await requireAuth(ctx)

  if (!authContext.isAdmin && !authContext.isSuperAdmin) {
    throw new ConvexError("Admin access required")
  }

  // If tenantId is specified, ensure user belongs to that tenant (unless super admin)
  if (tenantId && !authContext.isSuperAdmin && authContext.tenantId !== tenantId) {
    throw new ConvexError("Access denied: Invalid tenant context")
  }

  return authContext
}

// Require super admin role
export async function requireSuperAdmin(ctx: QueryCtx | MutationCtx): Promise<AuthContext> {
  const authContext = await requireAuth(ctx)

  if (!authContext.isSuperAdmin) {
    throw new ConvexError("Super admin access required")
  }

  return authContext
}

// Require tenant membership
export async function requireTenantMembership(
  ctx: QueryCtx | MutationCtx,
  tenantId: string,
  minRole?: string,
): Promise<AuthContext> {
  const authContext = await requireAuth(ctx)

  // Super admins can access any tenant
  if (authContext.isSuperAdmin) {
    return authContext
  }

  // Check tenant membership
  if (authContext.tenantId !== tenantId) {
    throw new ConvexError("Access denied: Not a member of this tenant")
  }

  // Check minimum role if specified
  if (minRole && !hasHigherRole(authContext.role, minRole)) {
    throw new ConvexError(`Access denied: ${minRole} role or higher required`)
  }

  return authContext
}

// Check resource ownership or admin access
export async function requireResourceAccess(
  ctx: QueryCtx | MutationCtx,
  resourceOwnerId: string,
  tenantId: string,
): Promise<AuthContext> {
  const authContext = await requireAuth(ctx)

  // Super admins can access any resource
  if (authContext.isSuperAdmin) {
    return authContext
  }

  // Check if user owns the resource
  if (authContext.userId === resourceOwnerId) {
    return authContext
  }

  // Check if user is admin in the same tenant
  if (authContext.tenantId === tenantId && authContext.isAdmin) {
    return authContext
  }

  throw new ConvexError("Access denied: Insufficient permissions for this resource")
}

// Attribute-Based Access Control (ABAC) foundation
export interface AccessControlContext {
  subject: AuthContext
  resource: {
    type: string
    id: string
    tenantId: string
    ownerId?: string
    attributes?: Record<string, any>
  }
  action: string
  environment: {
    timestamp: number
    ipAddress?: string
    userAgent?: string
  }
}

// ABAC policy evaluation (foundation for future expansion)
export async function evaluateAccessPolicy(
  ctx: QueryCtx | MutationCtx,
  accessContext: AccessControlContext,
): Promise<boolean> {
  const { subject, resource, action } = accessContext

  // Super admins have access to everything
  if (subject.isSuperAdmin) {
    return true
  }

  // Basic RBAC check
  const requiredPermission = mapActionToPermission(action, resource.type)
  if (requiredPermission && !hasPermission(subject.role, requiredPermission)) {
    return false
  }

  // Tenant isolation check
  if (resource.tenantId !== subject.tenantId) {
    return false
  }

  // Resource ownership check
  if (resource.ownerId && resource.ownerId !== subject.userId && !subject.isAdmin) {
    return false
  }

  // Future ABAC rules can be added here
  // - Time-based access
  // - Location-based access
  // - Resource attribute-based rules
  // - Dynamic policy evaluation

  return true
}

// Map actions to permissions
function mapActionToPermission(action: string, resourceType: string): string | null {
  const actionMap: Record<string, Record<string, string>> = {
    CREATE: {
      inspection: "create_inspections",
      damage: "create_damages",
      estimate: "create_estimates",
      booking: "create_bookings",
    },
    READ: {
      inspection: "view_inspections",
      damage: "view_damages",
      estimate: "view_estimates",
      booking: "view_bookings",
    },
    UPDATE: {
      inspection: "update_inspections",
      damage: "update_damages",
      estimate: "update_estimates",
      booking: "update_bookings",
    },
    DELETE: {
      inspection: "delete_inspections",
      damage: "delete_damages",
      estimate: "delete_estimates",
      booking: "cancel_bookings",
    },
  }

  return actionMap[action]?.[resourceType] || null
}

// Audit access attempts
export async function auditAccessAttempt(
  ctx: QueryCtx | MutationCtx,
  accessContext: AccessControlContext,
  granted: boolean,
): Promise<void> {
  const { subject, resource, action, environment } = accessContext

  await ctx.runMutation("auditLogger:logAuditEvent", {
    tenantId: resource.tenantId || subject.tenantId,
    userId: subject.userId,
    action: granted ? "ACCESS_GRANTED" : "ACCESS_DENIED",
    entityType: resource.type,
    entityId: resource.id,
    metadata: {
      requestedAction: action,
      userRole: subject.role,
      userPermissions: subject.permissions,
      resourceAttributes: resource.attributes,
      ipAddress: environment.ipAddress,
      userAgent: environment.userAgent,
    },
  })
}
