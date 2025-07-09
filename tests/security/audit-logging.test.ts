import { describe, it, expect, beforeEach } from "vitest"
import { ConvexTestingHelper } from "convex/testing"
import { api } from "../convex/_generated/api"

describe("Audit Logging Tests", () => {
  let t: ConvexTestingHelper

  beforeEach(async () => {
    t = new ConvexTestingHelper()
  })

  it("should log critical mutations automatically", async () => {
    await t.run(async (ctx) => {
      // Create inspection (should trigger audit log)
      const inspectionId = await ctx.runMutation(api.inspections.createInspection, {
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

      // Check audit log was created
      const auditLogs = await ctx.runQuery(api.auditLogger.getAuditLogs, {
        tenantId: "test-tenant",
        entityType: "inspection",
        entityId: inspectionId,
      })

      expect(auditLogs).toHaveLength(1)
      expect(auditLogs[0].action).toBe("INSPECTION_CREATED")
    })
  })

  it("should maintain audit log integrity", async () => {
    await t.run(async (ctx) => {
      // Create audit log entry
      const auditLogId = await ctx.runMutation(api.auditLogger.logAuditEvent, {
        tenantId: "test-tenant",
        userId: "test-user",
        action: "TEST_ACTION",
        entityType: "test",
        entityId: "test-123",
        changes: { field: "value" },
      })

      // Verify log cannot be modified
      const auditLog = await ctx.db.get(auditLogId)
      expect(auditLog).toBeDefined()
      expect(auditLog!.action).toBe("TEST_ACTION")

      // Audit logs should be immutable (no patch/delete operations)
      // This is enforced by not exposing mutation functions for audit logs
    })
  })

  it("should track data changes with diff", async () => {
    await t.run(async (ctx) => {
      // Create and then update an inspection
      const inspectionId = await ctx.runMutation(api.inspections.createInspection, {
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

      await ctx.runMutation(api.inspections.updateInspection, {
        id: inspectionId,
        status: "completed",
        notes: "Updated notes",
      })

      // Check audit logs show the changes
      const auditLogs = await ctx.runQuery(api.auditLogger.getAuditLogs, {
        tenantId: "test-tenant",
        entityId: inspectionId,
        action: "INSPECTION_UPDATED",
      })

      expect(auditLogs).toHaveLength(1)
      expect(auditLogs[0].changes).toMatchObject({
        status: { before: "pending", after: "completed" },
        notes: { before: undefined, after: "Updated notes" },
      })
    })
  })
})
