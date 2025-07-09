import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  inspections: defineTable({
    tenantId: v.string(),
    vehicleVin: v.string(),
    vehicleMake: v.string(),
    vehicleModel: v.string(),
    vehicleYear: v.number(),
    vehicleBodyClass: v.optional(v.string()),
    vehicleEngineSize: v.optional(v.string()),
    vehicleFuelType: v.optional(v.string()),
    vehicleDriveType: v.optional(v.string()),
    vehicleTrim: v.optional(v.string()),
    customerName: v.string(),
    customerEmail: v.string(),
    customerPhone: v.string(),
    status: v.union(v.literal("pending"), v.literal("in_progress"), v.literal("completed"), v.literal("cancelled")),
    inspectionType: v.union(
      v.literal("intake"),
      v.literal("pre_detail"),
      v.literal("post_detail"),
      v.literal("quality_check"),
    ),
    scheduledAt: v.number(),
    completedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    photos: v.array(v.string()), // File storage IDs
    overallCondition: v.optional(
      v.union(v.literal("excellent"), v.literal("good"), v.literal("fair"), v.literal("poor")),
    ),
    // Filthiness scoring fields
    filthinessScore: v.optional(v.number()), // 0-100 percentage
    filthinessZoneScores: v.optional(
      v.object({
        exterior: v.number(),
        interior: v.number(),
        engine: v.number(),
        undercarriage: v.number(),
      }),
    ),
    filthinessSeverity: v.optional(
      v.union(v.literal("light"), v.literal("moderate"), v.literal("heavy"), v.literal("extreme")),
    ),
    estimatedCleaningTime: v.optional(v.number()), // in hours
    filthinessAssessedAt: v.optional(v.number()),
    filthinessAssessedBy: v.optional(v.string()),
    filthinessNotes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.optional(v.string()),
    embeddingId: v.optional(v.id("inspectionEmbeddings")),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_status", ["tenantId", "status"])
    .index("by_tenant_scheduled", ["tenantId", "scheduledAt"])
    .index("by_tenant_vin", ["tenantId", "vehicleVin"])
    .index("by_tenant_vehicle", ["tenantId", "vehicleMake", "vehicleModel"])
    .index("by_tenant_filthiness", ["tenantId", "filthinessSeverity"])
    .index("by_tenant_cleaning_time", ["tenantId", "estimatedCleaningTime"])
    .searchIndex("search_by_tenant", {
      searchField: "vehicleVin",
      filterFields: ["tenantId", "status"],
    })
    .index("by_embedding", ["embeddingId"]),

  damages: defineTable({
    tenantId: v.string(),
    inspectionId: v.id("inspections"),
    type: v.union(
      v.literal("scratch"),
      v.literal("dent"),
      v.literal("chip"),
      v.literal("crack"),
      v.literal("stain"),
      v.literal("burn"),
      v.literal("tear"),
      v.literal("other"),
    ),
    severity: v.union(v.literal("minor"), v.literal("moderate"), v.literal("major"), v.literal("severe")),
    location: v.string(), // e.g., "front_bumper", "driver_door", etc.
    description: v.string(),
    dimensions: v.optional(
      v.object({
        length: v.number(),
        width: v.number(),
        depth: v.optional(v.number()),
      }),
    ),
    repairEstimate: v.optional(v.number()),
    photos: v.array(v.string()), // File storage IDs
    boundingBox: v.optional(
      v.object({
        x: v.number(),
        y: v.number(),
        width: v.number(),
        height: v.number(),
      }),
    ),
    aiConfidence: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    zoneCategory: v.optional(v.union(v.literal("exterior"), v.literal("interior"), v.literal("mechanical"))),
    repairComplexity: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
    estimatedRepairTime: v.optional(v.number()), // in hours
    annotatedBy: v.optional(v.string()), // user ID who created the annotation
    reviewedBy: v.optional(v.string()), // user ID who reviewed the annotation
    reviewStatus: v.optional(v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"))),
    embeddingId: v.optional(v.id("damageEmbeddings")),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_inspection", ["tenantId", "inspectionId"])
    .index("by_tenant_severity", ["tenantId", "severity"])
    .index("by_tenant_type", ["tenantId", "type"])
    .index("by_embedding", ["embeddingId"])
    .index("by_tenant_zone", ["tenantId", "location"])
    .index("by_tenant_review_status", ["tenantId", "reviewStatus"])
    .index("by_tenant_annotated_by", ["tenantId", "annotatedBy"]),

  estimates: defineTable({
    tenantId: v.string(),
    inspectionId: v.id("inspections"),
    estimateNumber: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("expired"),
    ),
    serviceType: v.union(
      v.literal("basic_wash"),
      v.literal("detail"),
      v.literal("premium_detail"),
      v.literal("repair"),
      v.literal("custom"),
    ),
    laborHours: v.number(),
    laborRate: v.number(),
    materialsCost: v.number(),
    subtotal: v.number(),
    taxRate: v.number(),
    taxAmount: v.number(),
    total: v.number(),
    validUntil: v.number(),
    lineItems: v.array(
      v.object({
        description: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
        total: v.number(),
      }),
    ),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    embeddingId: v.optional(v.id("estimateEmbeddings")),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_status", ["tenantId", "status"])
    .index("by_tenant_inspection", ["tenantId", "inspectionId"])
    .searchIndex("search_by_tenant", {
      searchField: "estimateNumber",
      filterFields: ["tenantId", "status"],
    })
    .index("by_embedding", ["embeddingId"]),

  bookings: defineTable({
    tenantId: v.string(),
    inspectionId: v.optional(v.id("inspections")),
    estimateId: v.optional(v.id("estimates")),
    bookingNumber: v.string(),
    customerName: v.string(),
    customerEmail: v.string(),
    customerPhone: v.string(),
    vehicleInfo: v.object({
      vin: v.string(),
      make: v.string(),
      model: v.string(),
      year: v.number(),
      color: v.string(),
    }),
    serviceType: v.union(
      v.literal("basic_wash"),
      v.literal("detail"),
      v.literal("premium_detail"),
      v.literal("repair"),
      v.literal("custom"),
    ),
    status: v.union(
      v.literal("scheduled"),
      v.literal("confirmed"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("cancelled"),
      v.literal("no_show"),
    ),
    scheduledStart: v.number(),
    scheduledEnd: v.number(),
    actualStart: v.optional(v.number()),
    actualEnd: v.optional(v.number()),
    assignedTechnician: v.optional(v.string()),
    location: v.string(),
    specialInstructions: v.optional(v.string()),
    totalAmount: v.number(),
    paidAmount: v.number(),
    paymentStatus: v.union(v.literal("pending"), v.literal("partial"), v.literal("paid"), v.literal("refunded")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_status", ["tenantId", "status"])
    .index("by_tenant_scheduled", ["tenantId", "scheduledStart"])
    .index("by_tenant_technician", ["tenantId", "assignedTechnician"])
    .searchIndex("search_by_tenant", {
      searchField: "bookingNumber",
      filterFields: ["tenantId", "status"],
    }),

  inspectionEmbeddings: defineTable({
    tenantId: v.string(),
    inspectionId: v.id("inspections"),
    embedding: v.array(v.float64()),
    contentType: v.union(
      v.literal("vehicle_description"),
      v.literal("damage_summary"),
      v.literal("customer_notes"),
      v.literal("full_inspection"),
    ),
    metadata: v.object({
      vehicleMake: v.string(),
      vehicleModel: v.string(),
      vehicleYear: v.number(),
      inspectionType: v.string(),
      overallCondition: v.optional(v.string()),
    }),
    createdAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_inspection", ["tenantId", "inspectionId"])
    .index("by_tenant_content_type", ["tenantId", "contentType"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["tenantId", "contentType", "metadata.vehicleMake", "metadata.inspectionType"],
    }),

  damageEmbeddings: defineTable({
    tenantId: v.string(),
    damageId: v.id("damages"),
    inspectionId: v.id("inspections"),
    embedding: v.array(v.float64()),
    contentType: v.union(v.literal("damage_description"), v.literal("visual_features"), v.literal("repair_context")),
    metadata: v.object({
      damageType: v.string(),
      severity: v.string(),
      location: v.string(),
      vehicleMake: v.string(),
      vehicleModel: v.string(),
      repairEstimate: v.optional(v.number()),
    }),
    createdAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_damage", ["tenantId", "damageId"])
    .index("by_tenant_inspection", ["tenantId", "inspectionId"])
    .index("by_tenant_content_type", ["tenantId", "contentType"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: [
        "tenantId",
        "contentType",
        "metadata.damageType",
        "metadata.severity",
        "metadata.location",
        "metadata.vehicleMake",
      ],
    }),

  estimateEmbeddings: defineTable({
    tenantId: v.string(),
    estimateId: v.id("estimates"),
    inspectionId: v.id("inspections"),
    embedding: v.array(v.float64()),
    contentType: v.union(v.literal("service_description"), v.literal("pricing_context"), v.literal("line_items")),
    metadata: v.object({
      serviceType: v.string(),
      totalAmount: v.number(),
      laborHours: v.number(),
      vehicleMake: v.string(),
      vehicleModel: v.string(),
      damageCount: v.number(),
    }),
    createdAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_estimate", ["tenantId", "estimateId"])
    .index("by_tenant_inspection", ["tenantId", "inspectionId"])
    .index("by_tenant_content_type", ["tenantId", "contentType"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["tenantId", "contentType", "metadata.serviceType", "metadata.vehicleMake"],
    }),

  knowledgeBaseEmbeddings: defineTable({
    tenantId: v.string(),
    documentId: v.string(), // Reference to external document or internal ID
    embedding: v.array(v.float64()),
    contentType: v.union(
      v.literal("repair_procedure"),
      v.literal("damage_guide"),
      v.literal("pricing_rule"),
      v.literal("customer_faq"),
      v.literal("training_material"),
    ),
    title: v.string(),
    content: v.string(), // The actual text content that was embedded
    metadata: v.object({
      category: v.string(),
      tags: v.array(v.string()),
      difficulty: v.optional(v.union(v.literal("beginner"), v.literal("intermediate"), v.literal("advanced"))),
      vehicleTypes: v.optional(v.array(v.string())), // ["sedan", "suv", "truck"]
      damageTypes: v.optional(v.array(v.string())), // ["scratch", "dent", "stain"]
    }),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_active", ["tenantId", "isActive"])
    .index("by_tenant_content_type", ["tenantId", "contentType"])
    .index("by_tenant_category", ["tenantId", "metadata.category"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["tenantId", "contentType", "metadata.category", "isActive"],
    }),

  notificationLogs: defineTable({
    tenantId: v.string(),
    bookingId: v.id("bookings"),
    type: v.string(), // "reminder_24h", "reminder_2h", "reminder_30m", etc.
    recipient: v.string(), // email or phone
    message: v.string(),
    status: v.union(v.literal("sent"), v.literal("failed"), v.literal("pending")),
    error: v.optional(v.string()),
    sentAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_booking", ["tenantId", "bookingId"])
    .index("by_tenant_status", ["tenantId", "status"])
    .index("by_tenant_type", ["tenantId", "type"]),

  searchLogs: defineTable({
    tenantId: v.string(),
    userId: v.string(),
    queryText: v.string(),
    filters: v.optional(v.any()),
    resultCount: v.number(),
    executionTime: v.number(), // milliseconds
    userAction: v.optional(v.string()), // "clicked", "refined", "abandoned"
    timestamp: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_user", ["tenantId", "userId"])
    .index("by_tenant_timestamp", ["tenantId", "timestamp"])
    .searchIndex("search_by_tenant", {
      searchField: "queryText",
      filterFields: ["tenantId"],
    }),

  tenantSettings: defineTable({
    tenantId: v.string(),
    settings: v.any(), // TenantSettingsSchema
    version: v.number(),
    lastUpdatedBy: v.string(),
    lastUpdatedAt: v.number(),
    createdAt: v.number(),
    updateReason: v.optional(v.string()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_version", ["tenantId", "version"]),

  tenantSettingsHistory: defineTable({
    tenantId: v.string(),
    version: v.number(),
    settings: v.any(),
    updatedBy: v.string(),
    updatedAt: v.number(),
    archivedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_version", ["tenantId", "version"]),

  adminUsers: defineTable({
    tenantId: v.string(),
    userId: v.string(),
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    role: v.union(
      v.literal("super_admin"),
      v.literal("tenant_admin"),
      v.literal("manager"),
      v.literal("technician"),
      v.literal("viewer"),
    ),
    isActive: v.boolean(),
    lastLoginAt: v.optional(v.number()),
    createdBy: v.string(),
    lastUpdatedBy: v.string(),
    deactivatedBy: v.optional(v.string()),
    deactivatedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_user", ["tenantId", "userId"])
    .index("by_tenant_email", ["tenantId", "email"])
    .index("by_tenant_role", ["tenantId", "role"])
    .index("by_tenant_active", ["tenantId", "isActive"]),

  pricingRules: defineTable({
    tenantId: v.string(),
    name: v.string(),
    description: v.string(),
    serviceTypes: v.array(v.string()),
    conditions: v.any(), // Flexible rule conditions
    adjustments: v.object({
      type: v.union(v.literal("percentage"), v.literal("fixed")),
      value: v.number(),
    }),
    enabled: v.boolean(),
    priority: v.number(),
    createdBy: v.string(),
    lastUpdatedBy: v.string(),
    createdAt: v.number(),
    lastUpdatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_enabled", ["tenantId", "enabled"])
    .index("by_tenant_priority", ["tenantId", "priority"]),

  auditLogs: defineTable({
    tenantId: v.string(),
    userId: v.string(),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    changes: v.optional(v.any()),
    metadata: v.optional(v.any()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    timestamp: v.number(),
    createdAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_user", ["tenantId", "userId"])
    .index("by_tenant_action", ["tenantId", "action"])
    .index("by_tenant_entity", ["tenantId", "entityType", "entityId"])
    .index("by_tenant_timestamp", ["tenantId", "timestamp"])
    .index("by_timestamp", ["timestamp"]),

  securityAlerts: defineTable({
    tenantId: v.string(),
    auditLogId: v.id("auditLogs"),
    alertType: v.string(),
    severity: v.union(v.literal("LOW"), v.literal("MEDIUM"), v.literal("HIGH"), v.literal("CRITICAL")),
    description: v.string(),
    resolved: v.boolean(),
    resolvedBy: v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_severity", ["tenantId", "severity"])
    .index("by_tenant_resolved", ["tenantId", "resolved"])
    .index("by_audit_log", ["auditLogId"]),
})
