import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  // Existing tables...
  users: defineTable({
    tenantId: v.string(),
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal("admin"), v.literal("manager"), v.literal("technician"), v.literal("customer")),
    permissions: v.array(v.string()),
    isActive: v.boolean(),
    lastLoginAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"]),

  // Vehicle self-assessment tables
  vehicleAssessments: defineTable({
    tenantId: v.string(),
    vehicleInfo: v.object({
      vin: v.optional(v.string()),
      make: v.string(),
      model: v.string(),
      year: v.number(),
      color: v.optional(v.string()),
      mileage: v.optional(v.number()),
    }),
    customerInfo: v.object({
      name: v.string(),
      email: v.string(),
      phone: v.string(),
    }),
    imageIds: v.array(v.string()),
    status: v.union(v.literal("processing"), v.literal("completed"), v.literal("failed")),
    overallCondition: v.optional(v.string()),
    confidence: v.optional(v.number()),
    analyzedImages: v.optional(v.array(v.any())),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_status", ["status"])
    .index("by_customer_email", ["customerInfo.email"]),

  detectedDamages: defineTable({
    assessmentId: v.string(),
    type: v.string(), // scratch, dent, rust, crack, etc.
    severity: v.union(v.literal("minor"), v.literal("moderate"), v.literal("major"), v.literal("severe")),
    location: v.string(), // front_bumper, driver_door, etc.
    description: v.string(),
    repairCost: v.number(),
    confidence: v.number(), // AI confidence percentage
    boundingBox: v.optional(
      v.object({
        x: v.number(),
        y: v.number(),
        width: v.number(),
        height: v.number(),
      }),
    ),
    createdAt: v.number(),
  })
    .index("by_assessment", ["assessmentId"])
    .index("by_severity", ["severity"]),

  generatedEstimates: defineTable({
    assessmentId: v.string(),
    title: v.string(),
    description: v.string(),
    serviceType: v.union(v.literal("basic"), v.literal("standard"), v.literal("premium")),
    totalCost: v.number(),
    laborHours: v.number(),
    parts: v.array(
      v.object({
        name: v.string(),
        cost: v.number(),
      }),
    ),
    timeline: v.string(),
    warranty: v.string(),
    recommended: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_assessment", ["assessmentId"])
    .index("by_service_type", ["serviceType"]),

  // File storage for images
  uploadedFiles: defineTable({
    storageId: v.string(),
    filename: v.string(),
    contentType: v.string(),
    size: v.number(),
    vehicleInfo: v.optional(v.any()),
    uploadedBy: v.optional(v.string()),
    uploadedAt: v.number(),
  }).index("by_storage_id", ["storageId"]),

  // Existing tables continue...
  tenants: defineTable({
    name: v.string(),
    subdomain: v.string(),
    settings: v.object({
      theme: v.object({
        primaryColor: v.string(),
        secondaryColor: v.string(),
        logo: v.optional(v.string()),
      }),
      features: v.object({
        aiAssessment: v.boolean(),
        scheduling: v.boolean(),
        payments: v.boolean(),
        analytics: v.boolean(),
      }),
      subscription: v.object({
        plan: v.union(v.literal("basic"), v.literal("pro"), v.literal("enterprise")),
        status: v.union(v.literal("active"), v.literal("cancelled"), v.literal("past_due")),
        currentPeriodEnd: v.number(),
      }),
    }),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_subdomain", ["subdomain"]),

  bookings: defineTable({
    tenantId: v.string(),
    customerId: v.string(),
    serviceType: v.string(),
    scheduledAt: v.number(),
    duration: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("cancelled"),
    ),
    vehicleInfo: v.object({
      make: v.string(),
      model: v.string(),
      year: v.number(),
      vin: v.optional(v.string()),
      licensePlate: v.optional(v.string()),
    }),
    serviceDetails: v.object({
      description: v.string(),
      estimatedCost: v.number(),
      actualCost: v.optional(v.number()),
    }),
    assignedTechnician: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_customer", ["customerId"])
    .index("by_status", ["status"])
    .index("by_scheduled_date", ["scheduledAt"]),

  auditLogs: defineTable({
    tenantId: v.string(),
    userId: v.string(),
    action: v.string(),
    resourceType: v.string(),
    resourceId: v.string(),
    details: v.any(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_user", ["userId"])
    .index("by_resource", ["resourceType", "resourceId"])
    .index("by_timestamp", ["timestamp"]),
})
