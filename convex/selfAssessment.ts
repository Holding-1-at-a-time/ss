import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { getCurrentUser } from "./auth"
import { api } from "./_generated/api"

// Start vehicle self-assessment
export const startAssessment = mutation({
  args: {
    vehicleInfo: v.object({
      vin: v.optional(v.string()),
      make: v.string(),
      model: v.string(),
      year: v.number(),
      color: v.optional(v.string()),
      mileage: v.optional(v.number()),
    }),
    imageIds: v.array(v.string()),
    customerInfo: v.object({
      name: v.string(),
      email: v.string(),
      phone: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    const tenantId = user?.tenantId || "demo-tenant"

    const now = Date.now()

    // Create assessment record
    const assessmentId = await ctx.db.insert("vehicleAssessments", {
      tenantId,
      vehicleInfo: args.vehicleInfo,
      customerInfo: args.customerInfo,
      imageIds: args.imageIds,
      status: "processing",
      createdAt: now,
      updatedAt: now,
    })

    // Trigger AI analysis workflow
    await ctx.scheduler.runAfter(0, api.aiAgent.analyzeVehicleImages, {
      assessmentId,
      imageIds: args.imageIds,
      vehicleInfo: args.vehicleInfo,
    })

    return { assessmentId }
  },
})

// Get assessment results
export const getAssessmentResults = query({
  args: {
    assessmentId: v.string(),
  },
  handler: async (ctx, args) => {
    const assessment = await ctx.db
      .query("vehicleAssessments")
      .filter((q) => q.eq(q.field("_id"), args.assessmentId))
      .first()

    if (!assessment) {
      return null
    }

    // Get related damages
    const damages = await ctx.db
      .query("detectedDamages")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
      .collect()

    // Get generated estimates
    const estimates = await ctx.db
      .query("generatedEstimates")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
      .collect()

    return {
      ...assessment,
      damages,
      estimates,
      analyzedImages: assessment.analyzedImages || [],
    }
  },
})

// Update assessment with AI results
export const updateAssessmentResults = mutation({
  args: {
    assessmentId: v.string(),
    damages: v.array(v.any()),
    estimates: v.array(v.any()),
    overallCondition: v.string(),
    confidence: v.number(),
    analyzedImages: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    // Update assessment
    await ctx.db.patch(args.assessmentId, {
      status: "completed",
      overallCondition: args.overallCondition,
      confidence: args.confidence,
      analyzedImages: args.analyzedImages,
      completedAt: now,
      updatedAt: now,
    })

    // Store detected damages
    for (const damage of args.damages) {
      await ctx.db.insert("detectedDamages", {
        assessmentId: args.assessmentId,
        type: damage.type,
        severity: damage.severity,
        location: damage.location,
        description: damage.description,
        repairCost: damage.repairCost,
        confidence: damage.confidence,
        boundingBox: damage.boundingBox,
        createdAt: now,
      })
    }

    // Store generated estimates
    for (const estimate of args.estimates) {
      await ctx.db.insert("generatedEstimates", {
        assessmentId: args.assessmentId,
        title: estimate.title,
        description: estimate.description,
        serviceType: estimate.serviceType,
        totalCost: estimate.totalCost,
        laborHours: estimate.laborHours,
        parts: estimate.parts,
        timeline: estimate.timeline,
        warranty: estimate.warranty,
        recommended: estimate.recommended || false,
        createdAt: now,
      })
    }

    return { success: true }
  },
})
