import { v } from "convex/values"
import { action } from "./_generated/server"
import type { WebhookEvent } from "@clerk/nextjs/server"

// Clerk user metadata structure
export interface ClerkUserMetadata {
  tenantId?: string
  role?: string
  permissions?: string[]
  organizationId?: string
  organizationRole?: string
  lastLoginAt?: number
  isActive?: boolean
}

// Enhanced user context with RBAC/ABAC support
export interface AuthContext {
  userId: string
  tenantId: string
  role: string
  permissions: string[]
  organizationId?: string
  organizationRole?: string
  sessionId?: string
  isAuthenticated: boolean
  isAdmin: boolean
  isSuperAdmin: boolean
  metadata: {
    email?: string
    firstName?: string
    lastName?: string
    imageUrl?: string
    lastLoginAt?: number
  }
}

// Role hierarchy and permissions matrix
export const ROLE_HIERARCHY = {
  SUPER_ADMIN: 100,
  TENANT_ADMIN: 80,
  MANAGER: 60,
  TECHNICIAN: 40,
  VIEWER: 20,
  GUEST: 10,
} as const

export const PERMISSIONS = {
  // User Management
  MANAGE_USERS: "manage_users",
  VIEW_USERS: "view_users",
  INVITE_USERS: "invite_users",
  DEACTIVATE_USERS: "deactivate_users",

  // Tenant Management
  MANAGE_TENANT: "manage_tenant",
  VIEW_TENANT_SETTINGS: "view_tenant_settings",
  UPDATE_TENANT_SETTINGS: "update_tenant_settings",

  // Inspection Operations
  CREATE_INSPECTIONS: "create_inspections",
  VIEW_INSPECTIONS: "view_inspections",
  UPDATE_INSPECTIONS: "update_inspections",
  DELETE_INSPECTIONS: "delete_inspections",
  APPROVE_INSPECTIONS: "approve_inspections",

  // Damage Management
  CREATE_DAMAGES: "create_damages",
  VIEW_DAMAGES: "view_damages",
  UPDATE_DAMAGES: "update_damages",
  DELETE_DAMAGES: "delete_damages",
  REVIEW_DAMAGES: "review_damages",

  // Estimate Operations
  CREATE_ESTIMATES: "create_estimates",
  VIEW_ESTIMATES: "view_estimates",
  UPDATE_ESTIMATES: "update_estimates",
  DELETE_ESTIMATES: "delete_estimates",
  APPROVE_ESTIMATES: "approve_estimates",

  // Booking Management
  CREATE_BOOKINGS: "create_bookings",
  VIEW_BOOKINGS: "view_bookings",
  UPDATE_BOOKINGS: "update_bookings",
  CANCEL_BOOKINGS: "cancel_bookings",
  MANAGE_SCHEDULE: "manage_schedule",

  // Financial Operations
  VIEW_PRICING: "view_pricing",
  MANAGE_PRICING: "manage_pricing",
  PROCESS_PAYMENTS: "process_payments",
  VIEW_REPORTS: "view_reports",

  // System Administration
  VIEW_AUDIT_LOGS: "view_audit_logs",
  MANAGE_INTEGRATIONS: "manage_integrations",
  EXPORT_DATA: "export_data",
  SYSTEM_ADMIN: "system_admin",
} as const

// Role-to-permissions mapping
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: Object.values(PERMISSIONS),
  TENANT_ADMIN: [
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.INVITE_USERS,
    PERMISSIONS.DEACTIVATE_USERS,
    PERMISSIONS.MANAGE_TENANT,
    PERMISSIONS.VIEW_TENANT_SETTINGS,
    PERMISSIONS.UPDATE_TENANT_SETTINGS,
    PERMISSIONS.CREATE_INSPECTIONS,
    PERMISSIONS.VIEW_INSPECTIONS,
    PERMISSIONS.UPDATE_INSPECTIONS,
    PERMISSIONS.DELETE_INSPECTIONS,
    PERMISSIONS.APPROVE_INSPECTIONS,
    PERMISSIONS.CREATE_DAMAGES,
    PERMISSIONS.VIEW_DAMAGES,
    PERMISSIONS.UPDATE_DAMAGES,
    PERMISSIONS.DELETE_DAMAGES,
    PERMISSIONS.REVIEW_DAMAGES,
    PERMISSIONS.CREATE_ESTIMATES,
    PERMISSIONS.VIEW_ESTIMATES,
    PERMISSIONS.UPDATE_ESTIMATES,
    PERMISSIONS.DELETE_ESTIMATES,
    PERMISSIONS.APPROVE_ESTIMATES,
    PERMISSIONS.CREATE_BOOKINGS,
    PERMISSIONS.VIEW_BOOKINGS,
    PERMISSIONS.UPDATE_BOOKINGS,
    PERMISSIONS.CANCEL_BOOKINGS,
    PERMISSIONS.MANAGE_SCHEDULE,
    PERMISSIONS.VIEW_PRICING,
    PERMISSIONS.MANAGE_PRICING,
    PERMISSIONS.PROCESS_PAYMENTS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.VIEW_AUDIT_LOGS,
    PERMISSIONS.MANAGE_INTEGRATIONS,
    PERMISSIONS.EXPORT_DATA,
  ],
  MANAGER: [
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.INVITE_USERS,
    PERMISSIONS.VIEW_TENANT_SETTINGS,
    PERMISSIONS.CREATE_INSPECTIONS,
    PERMISSIONS.VIEW_INSPECTIONS,
    PERMISSIONS.UPDATE_INSPECTIONS,
    PERMISSIONS.APPROVE_INSPECTIONS,
    PERMISSIONS.CREATE_DAMAGES,
    PERMISSIONS.VIEW_DAMAGES,
    PERMISSIONS.UPDATE_DAMAGES,
    PERMISSIONS.REVIEW_DAMAGES,
    PERMISSIONS.CREATE_ESTIMATES,
    PERMISSIONS.VIEW_ESTIMATES,
    PERMISSIONS.UPDATE_ESTIMATES,
    PERMISSIONS.APPROVE_ESTIMATES,
    PERMISSIONS.CREATE_BOOKINGS,
    PERMISSIONS.VIEW_BOOKINGS,
    PERMISSIONS.UPDATE_BOOKINGS,
    PERMISSIONS.CANCEL_BOOKINGS,
    PERMISSIONS.MANAGE_SCHEDULE,
    PERMISSIONS.VIEW_PRICING,
    PERMISSIONS.PROCESS_PAYMENTS,
    PERMISSIONS.VIEW_REPORTS,
  ],
  TECHNICIAN: [
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.CREATE_INSPECTIONS,
    PERMISSIONS.VIEW_INSPECTIONS,
    PERMISSIONS.UPDATE_INSPECTIONS,
    PERMISSIONS.CREATE_DAMAGES,
    PERMISSIONS.VIEW_DAMAGES,
    PERMISSIONS.UPDATE_DAMAGES,
    PERMISSIONS.VIEW_ESTIMATES,
    PERMISSIONS.VIEW_BOOKINGS,
    PERMISSIONS.UPDATE_BOOKINGS,
    PERMISSIONS.VIEW_PRICING,
  ],
  VIEWER: [
    PERMISSIONS.VIEW_INSPECTIONS,
    PERMISSIONS.VIEW_DAMAGES,
    PERMISSIONS.VIEW_ESTIMATES,
    PERMISSIONS.VIEW_BOOKINGS,
    PERMISSIONS.VIEW_PRICING,
  ],
  GUEST: [PERMISSIONS.VIEW_INSPECTIONS],
}

// Clerk webhook handler for user events
export const handleClerkWebhook = action({
  args: {
    event: v.any(),
    eventType: v.string(),
  },
  handler: async (ctx, args) => {
    const event = args.event as WebhookEvent

    try {
      switch (args.eventType) {
        case "user.created":
          await handleUserCreated(ctx, event)
          break
        case "user.updated":
          await handleUserUpdated(ctx, event)
          break
        case "user.deleted":
          await handleUserDeleted(ctx, event)
          break
        case "organizationMembership.created":
          await handleOrganizationMembershipCreated(ctx, event)
          break
        case "organizationMembership.updated":
          await handleOrganizationMembershipUpdated(ctx, event)
          break
        case "organizationMembership.deleted":
          await handleOrganizationMembershipDeleted(ctx, event)
          break
        case "session.created":
          await handleSessionCreated(ctx, event)
          break
        case "session.ended":
          await handleSessionEnded(ctx, event)
          break
        default:
          console.log(`Unhandled Clerk webhook event: ${args.eventType}`)
      }

      return { success: true, eventType: args.eventType }
    } catch (error) {
      console.error(`Error handling Clerk webhook ${args.eventType}:`, error)
      throw new Error(`Webhook processing failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  },
})

// Handle user creation from Clerk
async function handleUserCreated(ctx: any, event: WebhookEvent) {
  const userData = event.data
  const now = Date.now()

  // Extract user information
  const userId = userData.id
  const email = userData.email_addresses?.[0]?.email_address
  const firstName = userData.first_name
  const lastName = userData.last_name
  const imageUrl = userData.image_url

  // Create user record
  await ctx.runMutation("auth/userManagement:createUser", {
    userId,
    email,
    firstName,
    lastName,
    imageUrl,
    clerkData: userData,
  })

  // Log audit event
  await ctx.runMutation("auditLogger:logAuditEvent", {
    tenantId: "system",
    userId,
    action: "USER_CREATED",
    entityType: "user",
    entityId: userId,
    changes: {
      email,
      firstName,
      lastName,
      source: "clerk_webhook",
    },
  })
}

// Handle user updates from Clerk
async function handleUserUpdated(ctx: any, event: WebhookEvent) {
  const userData = event.data
  const userId = userData.id

  await ctx.runMutation("auth/userManagement:updateUser", {
    userId,
    email: userData.email_addresses?.[0]?.email_address,
    firstName: userData.first_name,
    lastName: userData.last_name,
    imageUrl: userData.image_url,
    clerkData: userData,
  })
}

// Handle user deletion from Clerk
async function handleUserDeleted(ctx: any, event: WebhookEvent) {
  const userData = event.data
  const userId = userData.id

  await ctx.runMutation("auth/userManagement:deactivateUser", {
    userId,
    reason: "User deleted in Clerk",
  })
}

// Handle organization membership creation
async function handleOrganizationMembershipCreated(ctx: any, event: WebhookEvent) {
  const membershipData = event.data
  const userId = membershipData.public_user_data?.user_id
  const organizationId = membershipData.organization?.id
  const role = membershipData.role

  if (userId && organizationId) {
    await ctx.runMutation("auth/userManagement:assignOrganizationRole", {
      userId,
      organizationId,
      role,
      tenantId: organizationId, // Map organization to tenant
    })
  }
}

// Handle organization membership updates
async function handleOrganizationMembershipUpdated(ctx: any, event: WebhookEvent) {
  const membershipData = event.data
  const userId = membershipData.public_user_data?.user_id
  const organizationId = membershipData.organization?.id
  const role = membershipData.role

  if (userId && organizationId) {
    await ctx.runMutation("auth/userManagement:updateOrganizationRole", {
      userId,
      organizationId,
      role,
    })
  }
}

// Handle organization membership deletion
async function handleOrganizationMembershipDeleted(ctx: any, event: WebhookEvent) {
  const membershipData = event.data
  const userId = membershipData.public_user_data?.user_id
  const organizationId = membershipData.organization?.id

  if (userId && organizationId) {
    await ctx.runMutation("auth/userManagement:removeOrganizationRole", {
      userId,
      organizationId,
    })
  }
}

// Handle session creation
async function handleSessionCreated(ctx: any, event: WebhookEvent) {
  const sessionData = event.data
  const userId = sessionData.user_id
  const sessionId = sessionData.id

  await ctx.runMutation("auth/sessionManagement:createSession", {
    userId,
    sessionId,
    createdAt: new Date(sessionData.created_at).getTime(),
    lastActiveAt: new Date(sessionData.last_active_at).getTime(),
  })
}

// Handle session end
async function handleSessionEnded(ctx: any, event: WebhookEvent) {
  const sessionData = event.data
  const sessionId = sessionData.id

  await ctx.runMutation("auth/sessionManagement:endSession", {
    sessionId,
    endedAt: new Date(sessionData.ended_at || Date.now()).getTime(),
  })
}

// Get permissions for role
export function getPermissionsForRole(role: string): string[] {
  return ROLE_PERMISSIONS[role] || []
}

// Check if role has permission
export function hasPermission(role: string, permission: string): boolean {
  const permissions = getPermissionsForRole(role)
  return permissions.includes(permission)
}

// Check role hierarchy
export function hasHigherRole(userRole: string, requiredRole: string): boolean {
  const userLevel = ROLE_HIERARCHY[userRole as keyof typeof ROLE_HIERARCHY] || 0
  const requiredLevel = ROLE_HIERARCHY[requiredRole as keyof typeof ROLE_HIERARCHY] || 0
  return userLevel >= requiredLevel
}
