import { v } from "convex/values"
import { action } from "./_generated/server"
import { api } from "./_generated/api"

// AI Agent for vehicle image analysis
export const analyzeVehicleImages = action({
  args: {
    assessmentId: v.string(),
    imageIds: v.array(v.string()),
    vehicleInfo: v.object({
      make: v.string(),
      model: v.string(),
      year: v.number(),
      vin: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    try {
      // Simulate AI processing delay
      await new Promise((resolve) => setTimeout(resolve, 3000))

      // Mock AI analysis results
      const damages = [
        {
          id: "damage-1",
          type: "scratch",
          severity: "moderate" as const,
          location: "front_bumper",
          description: "Surface scratch on front bumper, approximately 6 inches long",
          repairCost: 350,
          confidence: 92,
          boundingBox: { x: 120, y: 80, width: 150, height: 40 },
        },
        {
          id: "damage-2",
          type: "dent",
          severity: "minor" as const,
          location: "driver_door",
          description: "Small dent on driver side door panel",
          repairCost: 180,
          confidence: 87,
          boundingBox: { x: 200, y: 150, width: 80, height: 60 },
        },
      ]

      const estimates = [
        {
          id: "estimate-basic",
          title: "Basic Repair",
          description: "Essential repairs to restore functionality",
          serviceType: "basic" as const,
          totalCost: 530,
          laborHours: 3,
          parts: [
            { name: "Touch-up paint", cost: 45 },
            { name: "Body filler", cost: 25 },
          ],
          timeline: "1-2 days",
          warranty: "6 months",
          recommended: false,
        },
        {
          id: "estimate-standard",
          title: "Standard Repair",
          description: "Complete repair with color matching and finishing",
          serviceType: "standard" as const,
          totalCost: 750,
          laborHours: 5,
          parts: [
            { name: "Premium paint", cost: 85 },
            { name: "Body filler", cost: 25 },
            { name: "Clear coat", cost: 40 },
          ],
          timeline: "2-3 days",
          warranty: "12 months",
          recommended: true,
        },
        {
          id: "estimate-premium",
          title: "Premium Restoration",
          description: "Full restoration with OEM parts and premium finish",
          serviceType: "premium" as const,
          totalCost: 1200,
          laborHours: 8,
          parts: [
            { name: "OEM paint system", cost: 150 },
            { name: "Professional body filler", cost: 45 },
            { name: "Premium clear coat", cost: 65 },
            { name: "Protective coating", cost: 80 },
          ],
          timeline: "3-5 days",
          warranty: "24 months",
          recommended: false,
        },
      ]

      const analyzedImages = args.imageIds.map((imageId, index) => ({
        id: imageId,
        url: `/api/files/${imageId}`, // This would be the actual file URL
        damages: index < 2 ? [damages[index]] : [], // First two images have damage
        confidence: 90 + Math.random() * 10,
      }))

      // Update assessment with results
      await ctx.runMutation(api.selfAssessment.updateAssessmentResults, {
        assessmentId: args.assessmentId,
        damages,
        estimates,
        overallCondition: "good",
        confidence: 89,
        analyzedImages,
      })

      // Log the analysis for audit trail
      await ctx.runMutation(api.auditLogger.logEvent, {
        tenantId: "demo-tenant",
        userId: "ai-agent",
        action: "vehicle_analysis_completed",
        resourceType: "assessment",
        resourceId: args.assessmentId,
        details: {
          damageCount: damages.length,
          estimateCount: estimates.length,
          processingTime: "3.2s",
        },
      })

      return { success: true, damageCount: damages.length }
    } catch (error) {
      console.error("AI analysis failed:", error)

      // Update assessment status to failed
      await ctx.runMutation(api.selfAssessment.updateAssessmentResults, {
        assessmentId: args.assessmentId,
        damages: [],
        estimates: [],
        overallCondition: "unknown",
        confidence: 0,
        analyzedImages: [],
      })

      throw error
    }
  },
})

// Classify damage from image using AI
export const classifyDamage = action({
  args: {
    imageId: v.string(),
    vehicleInfo: v.object({
      make: v.string(),
      model: v.string(),
      year: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    // Mock damage classification
    const damageTypes = ["scratch", "dent", "rust", "crack", "paint_damage"]
    const severities = ["minor", "moderate", "major", "severe"]
    const locations = ["front_bumper", "rear_bumper", "driver_door", "passenger_door", "hood", "trunk"]

    return {
      type: damageTypes[Math.floor(Math.random() * damageTypes.length)],
      severity: severities[Math.floor(Math.random() * severities.length)],
      location: locations[Math.floor(Math.random() * locations.length)],
      confidence: 85 + Math.random() * 15,
      boundingBox: {
        x: Math.floor(Math.random() * 300),
        y: Math.floor(Math.random() * 200),
        width: 50 + Math.floor(Math.random() * 100),
        height: 30 + Math.floor(Math.random() * 80),
      },
    }
  },
})

// Generate repair estimate using AI
export const generateEstimate = action({
  args: {
    damages: v.array(v.any()),
    vehicleInfo: v.object({
      make: v.string(),
      model: v.string(),
      year: v.number(),
    }),
    serviceLevel: v.union(v.literal("basic"), v.literal("standard"), v.literal("premium")),
  },
  handler: async (ctx, args) => {
    // Mock estimate generation based on damages and service level
    const baseCost = args.damages.reduce((sum: number, damage: any) => {
      const severityMultiplier =
        {
          minor: 1,
          moderate: 1.5,
          major: 2.5,
          severe: 4,
        }[damage.severity] || 1

      return sum + 100 * severityMultiplier
    }, 0)

    const serviceLevelMultiplier = {
      basic: 1,
      standard: 1.4,
      premium: 2.2,
    }[args.serviceLevel]

    const totalCost = Math.round(baseCost * serviceLevelMultiplier)
    const laborHours = Math.ceil(totalCost / 150) // $150/hour labor rate

    return {
      totalCost,
      laborHours,
      parts: [
        { name: "Paint and materials", cost: Math.round(totalCost * 0.3) },
        { name: "Labor", cost: Math.round(totalCost * 0.7) },
      ],
      timeline: laborHours <= 4 ? "1-2 days" : laborHours <= 8 ? "2-3 days" : "3-5 days",
      warranty:
        args.serviceLevel === "premium" ? "24 months" : args.serviceLevel === "standard" ? "12 months" : "6 months",
    }
  },
})
