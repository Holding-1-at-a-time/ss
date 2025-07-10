import { describe, it, expect, beforeEach } from "vitest"
import { ConvexTestingHelper } from "convex/testing"
import { api } from "../convex/_generated/api"

describe("Tenant Isolation Tests", () => {
  let t: ConvexTestingHelper

  beforeEach(async () => {
    t = new ConvexTestingHelper()
    await t.run(async (ctx) => {
      // Setup test tenants
      await ctx.db.insert("tenantSettings", {
        tenantId: "tenant-a",
        settings: {
          /* default settings */
        },
        version: 1,
        lastUpdatedBy: "system",
        lastUpdatedAt: Date.now(),
        createdAt: Date.now(),
      })

      await ctx.db.insert("tenantSettings", {
        tenantId: "tenant-b",
        settings: {
          /* default settings */
        },
        version: 1,
        lastUpdatedBy: "system",
        lastUpdatedAt: Date.now(),
        createdAt: Date.now(),
      })
    })
  })

  it("should prevent cross-tenant data access in inspections", async () => {
    await t.run(async (ctx) => {
      // Create inspection for tenant A
      const inspectionA = await ctx.runMutation(api.inspections.createInspection, {
        vehicleVin: "TEST123456789ABCD",
        vehicleMake: "Honda",
        vehicleModel: "Civic",
        vehicleYear: 2021,
        customerName: "John Doe",
        customerEmail: "john@example.com",
        customerPhone: "555-1234",
        inspectionType: "intake",
        scheduledAt: Date.now() + 86400000,
      })

      // Mock user context for tenant B
      const mockUserB = {
        tenantId: "tenant-b",
        userId: "user-b",
        role: "tenant_admin",
      }

      // Attempt to access tenant A's inspection from tenant B context
      await expect(
        ctx.runQuery(api.inspections.getInspectionById, {
          id: inspectionA,
        }),
      ).rejects.toThrow("Inspection not found or access denied")
    })
  })

  it("should prevent cross-tenant admin operations", async () => {
    await t.run(async (ctx) => {
      // Mock admin user for tenant A
      const mockAdminA = {
        tenantId: "tenant-a",
        userId: "admin-a",
        role: "tenant_admin",
      }

      // Attempt to access tenant B settings from tenant A admin
      await expect(
        ctx.runQuery(api.adminSettings.getSettings, {
          tenantId: "tenant-b",
        }),
      ).rejects.toThrow("Unauthorized: Cross-tenant access denied")
    })
  })

  it("should allow super admin cross-tenant access", async () => {
    await t.run(async (ctx) => {
      // Create super admin user
      await ctx.db.insert("adminUsers", {
        tenantId: "system",
        userId: "super-admin",
        email: "admin@slicksolutions.com",
        firstName: "Super",
        lastName: "Admin",
        role: "super_admin",
        isActive: true,
        createdBy: "system",
        lastUpdatedBy: "system",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      // Super admin should access any tenant
      const settingsA = await ctx.runQuery(api.adminSettings.getSettings, {
        tenantId: "tenant-a",
      })

      const settingsB = await ctx.runQuery(api.adminSettings.getSettings, {
        tenantId: "tenant-b",
      })

      expect(settingsA.tenantId).toBe("tenant-a")
      expect(settingsB.tenantId).toBe("tenant-b")
    })
  })
})
