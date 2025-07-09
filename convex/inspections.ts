import { v } from "convex/values"
import { mutation, query, action } from "./_generated/server"
import { getCurrentUser } from "./auth"
import { isValidVIN, decodeVINFromAPI } from "./vin_utils"
import { calculateFilthinessMetrics } from "./filthinessUtils"
import { api } from "./_generated/api"

// Queries
export const getInspections = query({
  args: {
    status: v.optional(
      v.union(v.literal("pending"), v.literal("in_progress"), v.literal("completed"), v.literal("cancelled")),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    let query = ctx.db.query("inspections").withIndex("by_tenant", (q) => q.eq("tenantId", user.tenantId))

    if (args.status) {
      query = ctx.db
        .query("inspections")
        .withIndex("by_tenant_status", (q) => q.eq("tenantId", user.tenantId).eq("status", args.status))
    }

    const inspections = await query.order("desc").take(args.limit ?? 50)

    return inspections
  },
})

export const getInspectionById = query({
  args: { id: v.id("inspections") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const inspection = await ctx.db.get(args.id)
    if (!inspection || inspection.tenantId !== user.tenantId) {
      throw new Error("Inspection not found or access denied")
    }

    return inspection
  },
})

export const searchInspections = query({
  args: {
    searchTerm: v.string(),
    status: v.optional(
      v.union(v.literal("pending"), v.literal("in_progress"), v.literal("completed"), v.literal("cancelled")),
    ),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const results = await ctx.db
      .query("inspections")
      .withSearchIndex("search_by_tenant", (q) =>
        q
          .search("vehicleVin", args.searchTerm)
          .eq("tenantId", user.tenantId)
          .eq("status", args.status ?? "pending"),
      )
      .take(20)

    return results
  },
})

// Mutations
export const createInspection = mutation({
  args: {
    vehicleVin: v.string(),
    vehicleMake: v.string(),
    vehicleModel: v.string(),
    vehicleYear: v.number(),
    customerName: v.string(),
    customerEmail: v.string(),
    customerPhone: v.string(),
    inspectionType: v.union(
      v.literal("intake"),
      v.literal("pre_detail"),
      v.literal("post_detail"),
      v.literal("quality_check"),
    ),
    scheduledAt: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const now = Date.now()
    const inspectionId = await ctx.db.insert("inspections", {
      tenantId: user.tenantId,
      vehicleVin: args.vehicleVin,
      vehicleMake: args.vehicleMake,
      vehicleModel: args.vehicleModel,
      vehicleYear: args.vehicleYear,
      customerName: args.customerName,
      customerEmail: args.customerEmail,
      customerPhone: args.customerPhone,
      status: "pending",
      inspectionType: args.inspectionType,
      scheduledAt: args.scheduledAt,
      notes: args.notes,
      photos: [],
      createdAt: now,
      updatedAt: now,
    })

    return inspectionId
  },
})

export const updateInspection = mutation({
  args: {
    id: v.id("inspections"),
    status: v.optional(
      v.union(v.literal("pending"), v.literal("in_progress"), v.literal("completed"), v.literal("cancelled")),
    ),
    completedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    overallCondition: v.optional(
      v.union(v.literal("excellent"), v.literal("good"), v.literal("fair"), v.literal("poor")),
    ),
    photos: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const inspection = await ctx.db.get(args.id)
    if (!inspection || inspection.tenantId !== user.tenantId) {
      throw new Error("Inspection not found or access denied")
    }

    const updateData: any = {
      updatedAt: Date.now(),
    }

    if (args.status !== undefined) updateData.status = args.status
    if (args.completedAt !== undefined) updateData.completedAt = args.completedAt
    if (args.notes !== undefined) updateData.notes = args.notes
    if (args.overallCondition !== undefined) updateData.overallCondition = args.overallCondition
    if (args.photos !== undefined) updateData.photos = args.photos

    await ctx.db.patch(args.id, updateData)
    return args.id
  },
})

export const deleteInspection = mutation({
  args: { id: v.id("inspections") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const inspection = await ctx.db.get(args.id)
    if (!inspection || inspection.tenantId !== user.tenantId) {
      throw new Error("Inspection not found or access denied")
    }

    // Check for related damages and estimates
    const damages = await ctx.db
      .query("damages")
      .withIndex("by_tenant_inspection", (q) => q.eq("tenantId", user.tenantId).eq("inspectionId", args.id))
      .collect()

    const estimates = await ctx.db
      .query("estimates")
      .withIndex("by_tenant_inspection", (q) => q.eq("tenantId", user.tenantId).eq("inspectionId", args.id))
      .collect()

    if (damages.length > 0 || estimates.length > 0) {
      throw new Error("Cannot delete inspection with related damages or estimates")
    }

    await ctx.db.delete(args.id)
    return args.id
  },
})

// Filthiness scoring and pricing trigger update
export const updateFilthinessScore = mutation({
  args: {
    inspectionId: v.id("inspections"),
    filthinessPercent: v.number(),
    zoneScores: v.optional(
      v.object({
        exterior: v.optional(v.number()),
        interior: v.optional(v.number()),
        engine: v.optional(v.number()),
        undercarriage: v.optional(v.number()),
      }),
    ),
    notes: v.optional(v.string()),
    assessedBy: v.optional(v.string()),
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

    // Step 2: Validate filthiness percentage
    if (args.filthinessPercent < 0 || args.filthinessPercent > 100) {
      throw new Error("Filthiness percentage must be between 0 and 100")
    }

    // Step 3: Calculate comprehensive filthiness metrics
    const filthinessMetrics = calculateFilthinessMetrics(args.filthinessPercent, args.zoneScores)

    const now = Date.now()

    // Step 4: Update inspection record with filthiness data (atomic update)
    await ctx.db.patch(args.inspectionId, {
      filthinessScore: args.filthinessPercent,
      filthinessZoneScores: filthinessMetrics.zoneBreakdown,
      filthinessSeverity: filthinessMetrics.severityLevel,
      estimatedCleaningTime: filthinessMetrics.estimatedCleaningTime,
      filthinessAssessedAt: now,
      filthinessAssessedBy: args.assessedBy || user.userId,
      filthinessNotes: args.notes,
      updatedAt: now,
    })

    // Step 5: Trigger pricing refresh for all related estimates
    const pricingRefreshResult = await ctx.runMutation(api.pricingEngine.refreshInspectionPricing, {
      inspectionId: args.inspectionId,
      reason: `Filthiness score updated to ${args.filthinessPercent}% (${filthinessMetrics.severityLevel})`,
    })

    // Step 6: Get updated inspection data
    const updatedInspection = await ctx.db.get(args.inspectionId)

    return {
      inspectionId: args.inspectionId,
      inspection: updatedInspection,
      filthinessMetrics,
      pricingUpdate: pricingRefreshResult,
      updatedAt: now,
      summary: {
        previousScore: inspection.filthinessScore,
        newScore: args.filthinessPercent,
        severityLevel: filthinessMetrics.severityLevel,
        laborMultiplier: filthinessMetrics.laborMultiplier,
        estimatedCleaningTime: filthinessMetrics.estimatedCleaningTime,
        estimatesUpdated: pricingRefreshResult.updatedEstimates.length,
      },
    }
  },
})

// Batch update filthiness scores for multiple inspections
export const batchUpdateFilthinessScores = mutation({
  args: {
    updates: v.array(
      v.object({
        inspectionId: v.id("inspections"),
        filthinessPercent: v.number(),
        zoneScores: v.optional(
          v.object({
            exterior: v.optional(v.number()),
            interior: v.optional(v.number()),
            engine: v.optional(v.number()),
            undercarriage: v.optional(v.number()),
          }),
        ),
        notes: v.optional(v.string()),
      }),
    ),
    assessedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const results = []
    const errors = []

    // Process each update sequentially to maintain data consistency
    for (const update of args.updates) {
      try {
        const result = await ctx.runMutation(api.inspections.updateFilthinessScore, {
          inspectionId: update.inspectionId,
          filthinessPercent: update.filthinessPercent,
          zoneScores: update.zoneScores,
          notes: update.notes,
          assessedBy: args.assessedBy,
        })

        results.push({
          inspectionId: update.inspectionId,
          success: true,
          result,
        })
      } catch (error) {
        errors.push({
          inspectionId: update.inspectionId,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    return {
      processed: args.updates.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors,
      batchCompletedAt: Date.now(),
    }
  },
})

// VIN-based inspection creation workflow
export const createInspectionFromVIN = mutation({
  args: {
    vin: v.string(),
    customerName: v.string(),
    customerEmail: v.string(),
    customerPhone: v.string(),
    inspectionType: v.union(
      v.literal("intake"),
      v.literal("pre_detail"),
      v.literal("post_detail"),
      v.literal("quality_check"),
    ),
    scheduledAt: v.number(),
    notes: v.optional(v.string()),
    vehicleMetadata: v.object({
      make: v.string(),
      model: v.string(),
      year: v.number(),
      bodyClass: v.optional(v.string()),
      engineSize: v.optional(v.string()),
      fuelType: v.optional(v.string()),
      driveType: v.optional(v.string()),
      trim: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    // Validate VIN format (17 characters, alphanumeric except I, O, Q)
    if (!isValidVIN(args.vin)) {
      throw new Error("Invalid VIN format")
    }

    // Check for duplicate VIN within tenant
    const existingInspection = await ctx.db
      .query("inspections")
      .withIndex("by_tenant_vin", (q) => q.eq("tenantId", user.tenantId).eq("vehicleVin", args.vin.toUpperCase()))
      .first()

    if (existingInspection) {
      throw new Error("Inspection already exists for this VIN")
    }

    const now = Date.now()

    // Create inspection with enriched vehicle metadata
    const inspectionId = await ctx.db.insert("inspections", {
      tenantId: user.tenantId,
      vehicleVin: args.vin.toUpperCase(),
      vehicleMake: args.vehicleMetadata.make,
      vehicleModel: args.vehicleMetadata.model,
      vehicleYear: args.vehicleMetadata.year,
      vehicleBodyClass: args.vehicleMetadata.bodyClass,
      vehicleEngineSize: args.vehicleMetadata.engineSize,
      vehicleFuelType: args.vehicleMetadata.fuelType,
      vehicleDriveType: args.vehicleMetadata.driveType,
      vehicleTrim: args.vehicleMetadata.trim,
      customerName: args.customerName,
      customerEmail: args.customerEmail,
      customerPhone: args.customerPhone,
      status: "pending",
      inspectionType: args.inspectionType,
      scheduledAt: args.scheduledAt,
      notes: args.notes,
      photos: [],
      createdAt: now,
      updatedAt: now,
      createdBy: user.userId,
    })

    return {
      inspectionId,
      vehicleInfo: {
        vin: args.vin.toUpperCase(),
        make: args.vehicleMetadata.make,
        model: args.vehicleMetadata.model,
        year: args.vehicleMetadata.year,
        bodyClass: args.vehicleMetadata.bodyClass,
        engineSize: args.vehicleMetadata.engineSize,
        fuelType: args.vehicleMetadata.fuelType,
        driveType: args.vehicleMetadata.driveType,
        trim: args.vehicleMetadata.trim,
      },
    }
  },
})

// Action to decode VIN and create inspection atomically
export const decodeVINAndCreateInspection = action({
  args: {
    vin: v.string(),
    customerName: v.string(),
    customerEmail: v.string(),
    customerPhone: v.string(),
    inspectionType: v.union(
      v.literal("intake"),
      v.literal("pre_detail"),
      v.literal("post_detail"),
      v.literal("quality_check"),
    ),
    scheduledAt: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    try {
      // Step 1: Decode VIN using vPIC API
      const vehicleMetadata = await decodeVINFromAPI(args.vin)

      if (!vehicleMetadata) {
        throw new Error("Unable to decode VIN - invalid or not found")
      }

      // Step 2: Create inspection with decoded metadata atomically
      const result = await ctx.runMutation(api.inspections.createInspectionFromVIN, {
        vin: args.vin,
        customerName: args.customerName,
        customerEmail: args.customerEmail,
        customerPhone: args.customerPhone,
        inspectionType: args.inspectionType,
        scheduledAt: args.scheduledAt,
        notes: args.notes,
        vehicleMetadata,
      })

      return {
        success: true,
        ...result,
        decodedAt: Date.now(),
      }
    } catch (error) {
      console.error("VIN decode and inspection creation failed:", error)
      throw new Error(error instanceof Error ? error.message : "Failed to create inspection from VIN")
    }
  },
})

// Batch VIN processing for multiple vehicles
export const batchCreateInspectionsFromVINs = action({
  args: {
    inspections: v.array(
      v.object({
        vin: v.string(),
        customerName: v.string(),
        customerEmail: v.string(),
        customerPhone: v.string(),
        inspectionType: v.union(
          v.literal("intake"),
          v.literal("pre_detail"),
          v.literal("post_detail"),
          v.literal("quality_check"),
        ),
        scheduledAt: v.number(),
        notes: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const results = []
    const errors = []

    // Process each VIN sequentially to avoid API rate limits
    for (const inspectionData of args.inspections) {
      try {
        const result = await ctx.runAction(api.inspections.decodeVINAndCreateInspection, inspectionData)
        results.push({
          vin: inspectionData.vin,
          success: true,
          inspectionId: result.inspectionId,
        })
      } catch (error) {
        errors.push({
          vin: inspectionData.vin,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    return {
      processed: args.inspections.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors,
    }
  },
})
