import { v } from "convex/values"
import { action } from "./_generated/server"
import { api } from "./_generated/api"
import { getCurrentUser } from "./auth"
import { generateEmbedding, createEstimateEmbeddingText } from "./embeddingService"
import { calculateComprehensiveEstimate, type EstimateCalculationInput } from "./estimateCalculator"

// Main Action for comprehensive estimate generation with embedding storage
export const computeEstimateAndStoreVector = action({
  args: {
    inspectionId: v.id("inspections"),
    serviceType: v.union(
      v.literal("basic_wash"),
      v.literal("detail"),
      v.literal("premium_detail"),
      v.literal("repair"),
      v.literal("custom"),
    ),
    baseRates: v.optional(
      v.object({
        laborRate: v.number(), // per hour in cents
        materialRate: v.number(), // percentage (0.0-1.0)
        taxRate: v.number(), // percentage (0.0-1.0)
      }),
    ),
    shopSettings: v.optional(
      v.object({
        surgeEnabled: v.boolean(),
        weatherAdjustments: v.boolean(),
        minimumCharge: v.number(), // in cents
        maximumSurge: v.number(), // multiplier cap
      }),
    ),
    weather: v.optional(
      v.object({
        temperature: v.number(), // Fahrenheit
        humidity: v.number(), // percentage
        precipitation: v.boolean(),
        windSpeed: v.number(), // mph
        uvIndex: v.number(),
      }),
    ),
    customSurgeFactors: v.optional(
      v.object({
        demandLevel: v.optional(v.union(v.literal("low"), v.literal("normal"), v.literal("high"), v.literal("peak"))),
        holidayMultiplier: v.optional(v.number()),
      }),
    ),
    forceRecalculate: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    try {
      // Step 1: Retrieve inspection with tenant validation
      const inspection = await ctx.runQuery(api.inspections.getInspectionById, {
        id: args.inspectionId,
      })

      if (!inspection) {
        throw new Error("Inspection not found or access denied")
      }

      // Step 2: Retrieve related damages
      const damages = await ctx.runQuery(api.damages.getDamagesByInspection, {
        inspectionId: args.inspectionId,
      })

      // Step 3: Set default rates and settings if not provided
      const baseRates = args.baseRates || {
        laborRate: 7500, // $75.00 per hour in cents
        materialRate: 0.2, // 20% of labor
        taxRate: 0.0875, // 8.75% tax
      }

      const shopSettings = args.shopSettings || {
        surgeEnabled: true,
        weatherAdjustments: true,
        minimumCharge: 2500, // $25.00 minimum
        maximumSurge: 2.0, // 2x max surge
      }

      // Step 4: Calculate comprehensive estimate
      const calculationInput: EstimateCalculationInput = {
        inspection,
        damages,
        serviceType: args.serviceType,
        baseRates,
        shopSettings,
        weather: args.weather,
        customSurgeFactors: args.customSurgeFactors,
      }

      const estimateBreakdown = calculateComprehensiveEstimate(calculationInput)

      // Step 5: Generate embedding text for the estimate
      const embeddingText = createEstimateEmbeddingText(
        inspection,
        damages,
        args.serviceType,
        estimateBreakdown.baseLabor.hours +
          estimateBreakdown.damageAdjustments.repairHours +
          estimateBreakdown.filthinessAdjustment.cleaningHours,
        estimateBreakdown.total,
      )

      // Step 6: Generate embedding using mxbai-embed-large model
      const embeddingResponse = await generateEmbedding({
        text: embeddingText,
        model: "mxbai-embed-large",
      })

      // Step 7: Check for existing estimate
      const existingEstimates = await ctx.runQuery(api.estimates.getEstimatesByInspection, {
        inspectionId: args.inspectionId,
      })

      const existingEstimate = existingEstimates.find(
        (est) => est.serviceType === args.serviceType && est.status !== "expired",
      )

      let estimateId: string
      let isUpdate = false

      if (existingEstimate && !args.forceRecalculate) {
        // Step 8a: Update existing estimate
        estimateId = existingEstimate._id
        isUpdate = true

        await ctx.runMutation(api.estimates.updateEstimate, {
          id: existingEstimate._id,
          laborHours:
            estimateBreakdown.baseLabor.hours +
            estimateBreakdown.damageAdjustments.repairHours +
            estimateBreakdown.filthinessAdjustment.cleaningHours,
          laborRate: baseRates.laborRate,
          materialsCost: estimateBreakdown.materials.cost,
          lineItems: estimateBreakdown.lineItems,
          notes: `Updated estimate - ${new Date().toISOString()}`,
        })
      } else {
        // Step 8b: Create new estimate
        const estimateNumber = `EST-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`

        estimateId = await ctx.runMutation(api.estimates.createEstimate, {
          inspectionId: args.inspectionId,
          estimateNumber,
          serviceType: args.serviceType,
          laborHours:
            estimateBreakdown.baseLabor.hours +
            estimateBreakdown.damageAdjustments.repairHours +
            estimateBreakdown.filthinessAdjustment.cleaningHours,
          laborRate: baseRates.laborRate,
          materialsCost: estimateBreakdown.materials.cost,
          taxRate: baseRates.taxRate,
          validUntil: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
          lineItems: estimateBreakdown.lineItems,
          notes: `Generated estimate with comprehensive pricing analysis`,
        })
      }

      // Step 9: Store embedding in tenant-scoped namespace
      const embeddingId = await ctx.runMutation(api.embeddings.createEstimateEmbedding, {
        estimateId,
        inspectionId: args.inspectionId,
        embedding: embeddingResponse.embedding,
        contentType: "pricing_context",
        metadata: {
          serviceType: args.serviceType,
          totalAmount: estimateBreakdown.total,
          laborHours:
            estimateBreakdown.baseLabor.hours +
            estimateBreakdown.damageAdjustments.repairHours +
            estimateBreakdown.filthinessAdjustment.cleaningHours,
          vehicleMake: inspection.vehicleMake,
          vehicleModel: inspection.vehicleModel,
          damageCount: damages.length,
        },
      })

      // Step 10: Get final estimate data
      const finalEstimate = await ctx.runQuery(api.estimates.getEstimateById, {
        id: estimateId,
      })

      return {
        success: true,
        estimateId,
        embeddingId,
        isUpdate,
        estimate: finalEstimate,
        breakdown: estimateBreakdown,
        embeddingInfo: {
          model: embeddingResponse.model,
          dimensions: embeddingResponse.embedding.length,
          usage: embeddingResponse.usage,
          text: embeddingText,
        },
        calculationFactors: {
          baseRates,
          shopSettings,
          weather: args.weather,
          damageCount: damages.length,
          filthinessScore: inspection.filthinessScore,
          totalHours:
            estimateBreakdown.baseLabor.hours +
            estimateBreakdown.damageAdjustments.repairHours +
            estimateBreakdown.filthinessAdjustment.cleaningHours,
        },
        processedAt: Date.now(),
      }
    } catch (error) {
      console.error("Estimate computation failed:", error)
      throw new Error(error instanceof Error ? error.message : "Failed to compute estimate")
    }
  },
})

// Batch estimate generation for multiple service types
export const batchComputeEstimates = action({
  args: {
    inspectionId: v.id("inspections"),
    serviceTypes: v.array(
      v.union(
        v.literal("basic_wash"),
        v.literal("detail"),
        v.literal("premium_detail"),
        v.literal("repair"),
        v.literal("custom"),
      ),
    ),
    baseRates: v.optional(
      v.object({
        laborRate: v.number(),
        materialRate: v.number(),
        taxRate: v.number(),
      }),
    ),
    shopSettings: v.optional(
      v.object({
        surgeEnabled: v.boolean(),
        weatherAdjustments: v.boolean(),
        minimumCharge: v.number(),
        maximumSurge: v.number(),
      }),
    ),
    weather: v.optional(
      v.object({
        temperature: v.number(),
        humidity: v.number(),
        precipitation: v.boolean(),
        windSpeed: v.number(),
        uvIndex: v.number(),
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

    // Process each service type sequentially to avoid overwhelming the system
    for (const serviceType of args.serviceTypes) {
      try {
        const result = await ctx.runAction(api.estimateActions.computeEstimateAndStoreVector, {
          inspectionId: args.inspectionId,
          serviceType,
          baseRates: args.baseRates,
          shopSettings: args.shopSettings,
          weather: args.weather,
        })

        results.push({
          serviceType,
          success: true,
          estimateId: result.estimateId,
          total: result.breakdown.total,
        })
      } catch (error) {
        errors.push({
          serviceType,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    return {
      processed: args.serviceTypes.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors,
      batchCompletedAt: Date.now(),
    }
  },
})

// Refresh estimates when inspection data changes
export const refreshEstimatesForInspection = action({
  args: {
    inspectionId: v.id("inspections"),
    reason: v.string(),
    weather: v.optional(
      v.object({
        temperature: v.number(),
        humidity: v.number(),
        precipitation: v.boolean(),
        windSpeed: v.number(),
        uvIndex: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    // Get all existing estimates for the inspection
    const existingEstimates = await ctx.runQuery(api.estimates.getEstimatesByInspection, {
      inspectionId: args.inspectionId,
    })

    const activeEstimates = existingEstimates.filter((est) => est.status === "draft" || est.status === "pending")

    const refreshResults = []

    // Refresh each active estimate
    for (const estimate of activeEstimates) {
      try {
        const result = await ctx.runAction(api.estimateActions.computeEstimateAndStoreVector, {
          inspectionId: args.inspectionId,
          serviceType: estimate.serviceType,
          weather: args.weather,
          forceRecalculate: true,
        })

        refreshResults.push({
          estimateId: estimate._id,
          serviceType: estimate.serviceType,
          success: true,
          previousTotal: estimate.total,
          newTotal: result.breakdown.total,
          change: result.breakdown.total - estimate.total,
        })
      } catch (error) {
        refreshResults.push({
          estimateId: estimate._id,
          serviceType: estimate.serviceType,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    return {
      reason: args.reason,
      estimatesRefreshed: refreshResults.length,
      results: refreshResults,
      refreshedAt: Date.now(),
    }
  },
})
