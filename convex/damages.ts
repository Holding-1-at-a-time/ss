import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { getCurrentUser } from "./auth"

// Vehicle damage zones for consistent annotation
export const DAMAGE_ZONES = {
  FRONT: ["front_bumper", "front_grille", "headlights", "hood", "windshield"],
  REAR: ["rear_bumper", "taillights", "trunk", "rear_windshield"],
  SIDES: [
    "driver_door",
    "passenger_door",
    "driver_rear_door",
    "passenger_rear_door",
    "driver_side_panel",
    "passenger_side_panel",
  ],
  TOP: ["roof", "sunroof"],
  INTERIOR: ["dashboard", "seats", "door_panels", "console", "carpet", "headliner"],
  WHEELS: ["front_left_wheel", "front_right_wheel", "rear_left_wheel", "rear_right_wheel"],
  UNDERCARRIAGE: ["frame", "exhaust", "suspension"],
} as const

export type DamageZone = (typeof DAMAGE_ZONES)[keyof typeof DAMAGE_ZONES][number]

// Damage severity levels with repair cost implications
export const SEVERITY_LEVELS = {
  MINOR: { level: "minor", repairTimeHours: 0.5, costMultiplier: 1.0 },
  MODERATE: { level: "moderate", repairTimeHours: 2.0, costMultiplier: 2.5 },
  MAJOR: { level: "major", repairTimeHours: 6.0, costMultiplier: 5.0 },
  SEVERE: { level: "severe", repairTimeHours: 12.0, costMultiplier: 10.0 },
} as const

// Queries
export const getDamagesByInspection = query({
  args: { inspectionId: v.id("inspections") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    // Verify inspection belongs to tenant
    const inspection = await ctx.db.get(args.inspectionId)
    if (!inspection || inspection.tenantId !== user.tenantId) {
      throw new Error("Inspection not found or access denied")
    }

    const damages = await ctx.db
      .query("damages")
      .withIndex("by_tenant_inspection", (q) => q.eq("tenantId", user.tenantId).eq("inspectionId", args.inspectionId))
      .collect()

    return damages
  },
})

export const getDamagesBySeverity = query({
  args: {
    severity: v.union(v.literal("minor"), v.literal("moderate"), v.literal("major"), v.literal("severe")),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const damages = await ctx.db
      .query("damages")
      .withIndex("by_tenant_severity", (q) => q.eq("tenantId", user.tenantId).eq("severity", args.severity))
      .collect()

    return damages
  },
})

export const getDamageById = query({
  args: { id: v.id("damages") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const damage = await ctx.db.get(args.id)
    if (!damage || damage.tenantId !== user.tenantId) {
      throw new Error("Damage not found or access denied")
    }

    return damage
  },
})

export const getDamagesByZone = query({
  args: {
    inspectionId: v.id("inspections"),
    zone: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    // Verify inspection belongs to tenant
    const inspection = await ctx.db.get(args.inspectionId)
    if (!inspection || inspection.tenantId !== user.tenantId) {
      throw new Error("Inspection not found or access denied")
    }

    const damages = await ctx.db
      .query("damages")
      .withIndex("by_tenant_inspection", (q) => q.eq("tenantId", user.tenantId).eq("inspectionId", args.inspectionId))
      .filter((q) => q.eq(q.field("location"), args.zone))
      .collect()

    return damages
  },
})

// Mutations
export const createDamage = mutation({
  args: {
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
    location: v.string(),
    description: v.string(),
    dimensions: v.optional(
      v.object({
        length: v.number(),
        width: v.number(),
        depth: v.optional(v.number()),
      }),
    ),
    repairEstimate: v.optional(v.number()),
    photos: v.optional(v.array(v.string())),
    boundingBox: v.optional(
      v.object({
        x: v.number(),
        y: v.number(),
        width: v.number(),
        height: v.number(),
      }),
    ),
    aiConfidence: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    // Verify inspection belongs to tenant
    const inspection = await ctx.db.get(args.inspectionId)
    if (!inspection || inspection.tenantId !== user.tenantId) {
      throw new Error("Inspection not found or access denied")
    }

    const now = Date.now()
    const damageId = await ctx.db.insert("damages", {
      tenantId: user.tenantId,
      inspectionId: args.inspectionId,
      type: args.type,
      severity: args.severity,
      location: args.location,
      description: args.description,
      dimensions: args.dimensions,
      repairEstimate: args.repairEstimate,
      photos: args.photos ?? [],
      boundingBox: args.boundingBox,
      aiConfidence: args.aiConfidence,
      createdAt: now,
      updatedAt: now,
    })

    return damageId
  },
})

// Main damage annotation mutation with media linking
export const addDamageAnnotation = mutation({
  args: {
    inspectionId: v.id("inspections"),
    zoneId: v.string(), // Vehicle zone identifier (e.g., "front_bumper", "driver_door")
    damageType: v.union(
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
    notes: v.string(),
    boundingBox: v.object({
      x: v.number(), // X coordinate (0-1 normalized)
      y: v.number(), // Y coordinate (0-1 normalized)
      width: v.number(), // Width (0-1 normalized)
      height: v.number(), // Height (0-1 normalized)
    }),
    photoFileId: v.string(), // Convex file storage ID
    dimensions: v.optional(
      v.object({
        length: v.number(), // in inches
        width: v.number(), // in inches
        depth: v.optional(v.number()), // in inches
      }),
    ),
    repairEstimate: v.optional(v.number()), // estimated repair cost in cents
    aiConfidence: v.optional(v.number()), // AI detection confidence (0-1)
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    // Step 1: Verify inspection exists and belongs to tenant
    const inspection = await ctx.db.get(args.inspectionId)
    if (!inspection || inspection.tenantId !== user.tenantId) {
      throw new Error("Inspection not found or access denied")
    }

    // Step 2: Validate damage zone
    const validZones = Object.values(DAMAGE_ZONES).flat()
    if (!validZones.includes(args.zoneId as DamageZone)) {
      throw new Error(`Invalid damage zone: ${args.zoneId}. Valid zones: ${validZones.join(", ")}`)
    }

    // Step 3: Validate bounding box coordinates
    if (
      isNaN(args.boundingBox.x) ||
      isNaN(args.boundingBox.y) ||
      isNaN(args.boundingBox.width) ||
      isNaN(args.boundingBox.height) ||
      args.boundingBox.x < 0 ||
      args.boundingBox.x > 1 ||
      args.boundingBox.y < 0 ||
      args.boundingBox.y > 1 ||
      args.boundingBox.width <= 0 ||
      args.boundingBox.width > 1 ||
      args.boundingBox.height <= 0 ||
      args.boundingBox.height > 1 ||
      args.boundingBox.x + args.boundingBox.width > 1 ||
      args.boundingBox.y + args.boundingBox.height > 1
    ) {
      throw new Error(
        "Invalid bounding box coordinates. All values must be between 0 and 1, and box must fit within image bounds.",
      )
    }

    // Step 4: Verify photo file exists (basic validation)
    if (!args.photoFileId || args.photoFileId.length === 0) {
      throw new Error("Photo file ID is required for damage annotation")
    }

    // Step 5: Calculate automatic repair estimate if not provided
    let calculatedRepairEstimate = args.repairEstimate
    if (!calculatedRepairEstimate) {
      const severityConfig = SEVERITY_LEVELS[args.severity.toUpperCase() as keyof typeof SEVERITY_LEVELS]
      const baseCost = 5000 // $50.00 in cents
      calculatedRepairEstimate = Math.round(baseCost * severityConfig.costMultiplier)
    }

    const now = Date.now()

    // Step 6: Create damage record with media linking
    const damageId = await ctx.db.insert("damages", {
      tenantId: user.tenantId,
      inspectionId: args.inspectionId,
      type: args.damageType,
      severity: args.severity,
      location: args.zoneId,
      description: args.notes,
      dimensions: args.dimensions,
      repairEstimate: calculatedRepairEstimate,
      photos: [args.photoFileId], // Link to photo file
      boundingBox: args.boundingBox,
      aiConfidence: args.aiConfidence,
      createdAt: now,
      updatedAt: now,
    })

    // Step 7: Update inspection's photo array if not already included
    const updatedPhotos = inspection.photos.includes(args.photoFileId)
      ? inspection.photos
      : [...inspection.photos, args.photoFileId]

    await ctx.db.patch(args.inspectionId, {
      photos: updatedPhotos,
      updatedAt: now,
    })

    // Step 8: Get updated inspection data with all damages
    const updatedInspection = await ctx.db.get(args.inspectionId)
    const allDamages = await ctx.db
      .query("damages")
      .withIndex("by_tenant_inspection", (q) => q.eq("tenantId", user.tenantId).eq("inspectionId", args.inspectionId))
      .collect()

    // Step 9: Calculate inspection summary statistics
    const damageStats = {
      totalDamages: allDamages.length,
      severityBreakdown: {
        minor: allDamages.filter((d) => d.severity === "minor").length,
        moderate: allDamages.filter((d) => d.severity === "moderate").length,
        major: allDamages.filter((d) => d.severity === "major").length,
        severe: allDamages.filter((d) => d.severity === "severe").length,
      },
      totalRepairEstimate: allDamages.reduce((sum, d) => sum + (d.repairEstimate || 0), 0),
      affectedZones: [...new Set(allDamages.map((d) => d.location))],
    }

    return {
      damageId,
      inspection: updatedInspection,
      damages: allDamages,
      damageStats,
      newDamage: {
        id: damageId,
        type: args.damageType,
        severity: args.severity,
        location: args.zoneId,
        description: args.notes,
        boundingBox: args.boundingBox,
        photoFileId: args.photoFileId,
        repairEstimate: calculatedRepairEstimate,
        createdAt: now,
      },
    }
  },
})

// Batch damage annotation for multiple damages on same photo
export const addBatchDamageAnnotations = mutation({
  args: {
    inspectionId: v.id("inspections"),
    photoFileId: v.string(),
    damages: v.array(
      v.object({
        zoneId: v.string(),
        damageType: v.union(
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
        notes: v.string(),
        boundingBox: v.object({
          x: v.number(),
          y: v.number(),
          width: v.number(),
          height: v.number(),
        }),
        dimensions: v.optional(
          v.object({
            length: v.number(),
            width: v.number(),
            depth: v.optional(v.number()),
          }),
        ),
        aiConfidence: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    // Verify inspection belongs to tenant
    const inspection = await ctx.db.get(args.inspectionId)
    if (!inspection || inspection.tenantId !== user.tenantId) {
      throw new Error("Inspection not found or access denied")
    }

    const createdDamages = []
    const now = Date.now()

    // Process each damage annotation
    for (const damageData of args.damages) {
      // Validate zone
      const validZones = Object.values(DAMAGE_ZONES).flat()
      if (!validZones.includes(damageData.zoneId as DamageZone)) {
        throw new Error(`Invalid damage zone: ${damageData.zoneId}`)
      }

      // Calculate repair estimate
      const severityConfig = SEVERITY_LEVELS[damageData.severity.toUpperCase() as keyof typeof SEVERITY_LEVELS]
      const baseCost = 5000 // $50.00 in cents
      const repairEstimate = Math.round(baseCost * severityConfig.costMultiplier)

      // Create damage record
      const damageId = await ctx.db.insert("damages", {
        tenantId: user.tenantId,
        inspectionId: args.inspectionId,
        type: damageData.damageType,
        severity: damageData.severity,
        location: damageData.zoneId,
        description: damageData.notes,
        dimensions: damageData.dimensions,
        repairEstimate,
        photos: [args.photoFileId],
        boundingBox: damageData.boundingBox,
        aiConfidence: damageData.aiConfidence,
        createdAt: now,
        updatedAt: now,
      })

      createdDamages.push({
        id: damageId,
        ...damageData,
        repairEstimate,
      })
    }

    // Update inspection photos
    const updatedPhotos = inspection.photos.includes(args.photoFileId)
      ? inspection.photos
      : [...inspection.photos, args.photoFileId]

    await ctx.db.patch(args.inspectionId, {
      photos: updatedPhotos,
      updatedAt: now,
    })

    // Get updated inspection data
    const updatedInspection = await ctx.db.get(args.inspectionId)
    const allDamages = await ctx.db
      .query("damages")
      .withIndex("by_tenant_inspection", (q) => q.eq("tenantId", user.tenantId).eq("inspectionId", args.inspectionId))
      .collect()

    return {
      createdDamages,
      inspection: updatedInspection,
      totalDamages: allDamages.length,
      totalRepairEstimate: allDamages.reduce((sum, d) => sum + (d.repairEstimate || 0), 0),
    }
  },
})

export const updateDamage = mutation({
  args: {
    id: v.id("damages"),
    type: v.optional(
      v.union(
        v.literal("scratch"),
        v.literal("dent"),
        v.literal("chip"),
        v.literal("crack"),
        v.literal("stain"),
        v.literal("burn"),
        v.literal("tear"),
        v.literal("other"),
      ),
    ),
    severity: v.optional(v.union(v.literal("minor"), v.literal("moderate"), v.literal("major"), v.literal("severe"))),
    location: v.optional(v.string()),
    description: v.optional(v.string()),
    repairEstimate: v.optional(v.number()),
    photos: v.optional(v.array(v.string())),
    boundingBox: v.optional(
      v.object({
        x: v.number(),
        y: v.number(),
        width: v.number(),
        height: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const damage = await ctx.db.get(args.id)
    if (!damage || damage.tenantId !== user.tenantId) {
      throw new Error("Damage not found or access denied")
    }

    const updateData: any = {
      updatedAt: Date.now(),
    }

    if (args.type !== undefined) updateData.type = args.type
    if (args.severity !== undefined) updateData.severity = args.severity
    if (args.location !== undefined) updateData.location = args.location
    if (args.description !== undefined) updateData.description = args.description
    if (args.repairEstimate !== undefined) updateData.repairEstimate = args.repairEstimate
    if (args.photos !== undefined) updateData.photos = args.photos
    if (args.boundingBox !== undefined) updateData.boundingBox = args.boundingBox

    await ctx.db.patch(args.id, updateData)
    return args.id
  },
})

export const deleteDamage = mutation({
  args: { id: v.id("damages") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const damage = await ctx.db.get(args.id)
    if (!damage || damage.tenantId !== user.tenantId) {
      throw new Error("Damage not found or access denied")
    }

    await ctx.db.delete(args.id)
    return args.id
  },
})

// Remove damage annotation and update inspection
export const removeDamageAnnotation = mutation({
  args: {
    damageId: v.id("damages"),
    removePhotoFromInspection: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    // Get damage record
    const damage = await ctx.db.get(args.damageId)
    if (!damage || damage.tenantId !== user.tenantId) {
      throw new Error("Damage not found or access denied")
    }

    // Get inspection
    const inspection = await ctx.db.get(damage.inspectionId)
    if (!inspection || inspection.tenantId !== user.tenantId) {
      throw new Error("Inspection not found or access denied")
    }

    // Delete damage record
    await ctx.db.delete(args.damageId)

    // Optionally remove photo from inspection if no other damages reference it
    if (args.removePhotoFromInspection && damage.photos.length > 0) {
      const photoFileId = damage.photos[0]

      // Check if any other damages reference this photo
      const otherDamagesWithPhoto = await ctx.db
        .query("damages")
        .withIndex("by_tenant_inspection", (q) =>
          q.eq("tenantId", user.tenantId).eq("inspectionId", damage.inspectionId),
        )
        .filter((q) => q.neq(q.field("_id"), args.damageId))
        .collect()

      const photoStillReferenced = otherDamagesWithPhoto.some((d) => d.photos.includes(photoFileId))

      if (!photoStillReferenced) {
        const updatedPhotos = inspection.photos.filter((p) => p !== photoFileId)
        await ctx.db.patch(damage.inspectionId, {
          photos: updatedPhotos,
          updatedAt: Date.now(),
        })
      }
    }

    // Get updated inspection data
    const updatedInspection = await ctx.db.get(damage.inspectionId)
    const remainingDamages = await ctx.db
      .query("damages")
      .withIndex("by_tenant_inspection", (q) => q.eq("tenantId", user.tenantId).eq("inspectionId", damage.inspectionId))
      .collect()

    return {
      deletedDamageId: args.damageId,
      inspection: updatedInspection,
      remainingDamages,
      totalDamages: remainingDamages.length,
      totalRepairEstimate: remainingDamages.reduce((sum, d) => sum + (d.repairEstimate || 0), 0),
    }
  },
})
