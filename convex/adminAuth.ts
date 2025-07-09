import type { QueryCtx, MutationCtx } from "./_generated/server"
import { getCurrentUser } from "./auth"

// Admin role definitions and permissions
export const ADMIN_ROLES = {
  SUPER_ADMIN: "super_admin", // Cross-tenant admin (Slick Solutions staff)
  TENANT_ADMIN: "tenant_admin", // Full tenant administration
  MANAGER: "manager", // Limited admin functions
  TECHNICIAN: "technician", // Operational access only
  VIEWER: "viewer", // Read-only access
} as const

export type AdminRole = (typeof ADMIN_ROLES)[keyof typeof ADMIN_ROLES]

// Permission matrix for different admin operations
export const ADMIN_PERMISSIONS = {
  MANAGE_SETTINGS: [ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.TENANT_ADMIN],
  MANAGE_USERS: [ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.TENANT_ADMIN, ADMIN_ROLES.MANAGER],
  MANAGE_PRICING: [ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.TENANT_ADMIN],
  VIEW_AUDIT_LOGS: [ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.TENANT_ADMIN],
  MANAGE_TEAMS: [ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.TENANT_ADMIN, ADMIN_ROLES.MANAGER],
  EXPORT_DATA: [ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.TENANT_ADMIN],
  MANAGE_INTEGRATIONS: [ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.TENANT_ADMIN],
} as const

export type Permission = keyof typeof ADMIN_PERMISSIONS

// Enhanced user interface with admin capabilities
export interface AdminUser {
  tenantId: string
  userId: string
  role: AdminRole
  permissions: Permission[]
  isSuperAdmin: boolean
  lastLoginAt?: number
  createdAt: number
  updatedAt: number
}

// Enforce admin role requirement
export async function requireAdminRole(
  ctx: QueryCtx | MutationCtx,
  requiredPermission: Permission,
): Promise<AdminUser> {
  const user = await getCurrentUser(ctx)
  if (!user?.tenantId || !user?.userId) {
    throw new Error("Unauthorized: Authentication required")
  }

  // Get user's admin profile
  const adminUser = await ctx.db
    .query("adminUsers")
    .withIndex("by_tenant_user", (q) => q.eq("tenantId", user.tenantId).eq("userId", user.userId))
    .first()

  if (!adminUser) {
    throw new Error("Unauthorized: Admin access required")
  }

  // Check if user has required permission
  const allowedRoles = ADMIN_PERMISSIONS[requiredPermission]
  if (!allowedRoles.includes(adminUser.role)) {
    throw new Error(`Unauthorized: ${requiredPermission} permission required. Current role: ${adminUser.role}`)
  }

  return {
    tenantId: adminUser.tenantId,
    userId: adminUser.userId,
    role: adminUser.role,
    permissions: getPermissionsForRole(adminUser.role),
    isSuperAdmin: adminUser.role === ADMIN_ROLES.SUPER_ADMIN,
    lastLoginAt: adminUser.lastLoginAt,
    createdAt: adminUser.createdAt,
    updatedAt: adminUser.updatedAt,
  }
}

// Get all permissions for a role
export function getPermissionsForRole(role: AdminRole): Permission[] {
  const permissions: Permission[] = []

  for (const [permission, allowedRoles] of Object.entries(ADMIN_PERMISSIONS)) {
    if (allowedRoles.includes(role)) {
      permissions.push(permission as Permission)
    }
  }

  return permissions
}

// Validate tenant access for super admins
export async function validateTenantAccess(ctx: QueryCtx | MutationCtx, targetTenantId: string): Promise<void> {
  const user = await getCurrentUser(ctx)
  if (!user?.tenantId || !user?.userId) {
    throw new Error("Unauthorized: Authentication required")
  }

  // Super admins can access any tenant
  const adminUser = await ctx.db
    .query("adminUsers")
    .withIndex("by_tenant_user", (q) => q.eq("tenantId", user.tenantId).eq("userId", user.userId))
    .first()

  if (adminUser?.role === ADMIN_ROLES.SUPER_ADMIN) {
    return // Super admin can access any tenant
  }

  // Regular admins can only access their own tenant
  if (user.tenantId !== targetTenantId) {
    throw new Error("Unauthorized: Cross-tenant access denied")
  }
}
