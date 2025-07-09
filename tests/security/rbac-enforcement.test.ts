import { describe, it, expect, beforeEach } from "vitest"
import { ConvexTestingHelper } from "convex/testing"
import { api } from "../convex/_generated/api"

describe("RBAC Enforcement Tests", () => {
  let t: ConvexTestingHelper

  beforeEach(async () => {
    t = new ConvexTestingHelper()
    await t.run(async (ctx) => {
      // Setup test users with different roles
      const roles = [
        { userId: "admin", role: "tenant_admin" },
        { userId: "manager", role: "manager" },
        { userId: "tech", role: "technician" },
        { userId: "viewer", role: "viewer" },
      ]

      for (const { userId, role } of roles) {
        await ctx.db.insert("adminUsers", {
          tenantId: "test-tenant",
          userId,
          email: `${userId}@test.com`,
          firstName: userId,
          lastName: "User",
          role,
          isActive: true,
          createdBy: "system",
          lastUpdatedBy: "system",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
      }
    })
  })

  it("should enforce admin-only settings access", async () => {
    await t.run(async (ctx) => {
      // Admin should have access
      const adminSettings = await ctx.runQuery(api.adminSettings.getSettings, {
        tenantId: "test-tenant",
      })
      expect(adminSettings).toBeDefined()

      // Technician should be denied
      await expect(
        ctx.runQuery(api.adminSettings.getSettings, {
          tenantId: "test-tenant",
        }),
      ).rejects.toThrow("Unauthorized: MANAGE_SETTINGS permission required")
    })
  })

  it("should enforce role hierarchy in user management", async () => {
    await t.run(async (ctx) => {
      // Manager cannot assign tenant_admin role
      await expect(
        ctx.runMutation(api.adminUsers.assignUserRole, {
          tenantId: "test-tenant",
          userId: "tech",
          role: "tenant_admin",
        }),
      ).rejects.toThrow("Managers cannot assign tenant admin role")

      // Admin can assign any role except super_admin
      const result = await ctx.runMutation(api.adminUsers.assignUserRole, {
        tenantId: "test-tenant",
        userId: "tech",
        role: "manager",
      })
      expect(result.success).toBe(true)
    })
  })

  it("should prevent privilege escalation", async () => {
    await t.run(async (ctx) => {
      // User cannot assign themselves higher privileges
      await expect(
        ctx.runMutation(api.adminUsers.assignUserRole, {
          tenantId: "test-tenant",
          userId: "tech",
          role: "tenant_admin",
        }),
      ).rejects.toThrow("Unauthorized: MANAGE_USERS permission required")
    })
  })
})
