import { v } from "convex/values"
import { action } from "./_generated/server"
import { getCurrentUser } from "./auth"
import { api } from "./_generated/api"

// AI Agent orchestration with Ollama and Vercel AI SDK
export const startVehicleAssessment = action({
  args: {
    customerInfo: v.object({
      name: v.string(),
      email: v.string(),
      phone: v.string(),
    }),
    vehicleInfo: v.object({
      vin: v.string(),
      make: v.string(),
      model: v.string(),
      year: v.number(),
    }),
    imageStorageIds: v.array(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    try {
      // Step 1: Create inspection record
      const inspectionId = await ctx.runMutation(api.inspections.createInspection, {
        vehicleVin: args.vehicleInfo.vin,
        vehicleMake: args.vehicleInfo.make,
        vehicleModel: args.vehicleInfo.model,
        vehicleYear: args.vehicleInfo.year,
        customerName: args.customerInfo.name,
        customerEmail: args.customerInfo.email,
        customerPhone: args.customerInfo.phone,
        inspectionType: "intake",
        scheduledAt: Date.now(),
        notes: args.notes,
      })

      // Step 2: Process images with AI agent
      const damages = []
      let filthinessScore = 0

      for (const storageId of args.imageStorageIds) {
        // Get image URL
        const imageUrl = await ctx.storage.getUrl(storageId)

        // Classify damage using AI
        const damageResults = await classifyDamage(imageUrl, {
          vehicleMake: args.vehicleInfo.make,
          vehicleModel: args.vehicleInfo.model,
          vehicleYear: args.vehicleInfo.year,
        })

        // Store damage records
        for (const damageData of damageResults.damages) {
          const damageId = await ctx.runMutation(api.damages.createDamage, {
            inspectionId,
            type: damageData.type,
            severity: damageData.severity,
            location: damageData.location,
            description: damageData.description,
            boundingBox: damageData.boundingBox,
            aiConfidence: damageData.confidence,
            repairEstimate: damageData.repairEstimate,
            photos: [storageId],
          })

          damages.push({
            id: damageId,
            ...damageData,
          })
        }

        // Update filthiness score (take highest)
        filthinessScore = Math.max(filthinessScore, damageResults.filthinessScore)
      }

      // Step 3: Update inspection with AI results
      await ctx.runMutation(api.inspections.updateFilthinessScore, {
        inspectionId,
        filthinessPercent: filthinessScore,
        assessedBy: "AI_AGENT",
      })

      // Step 4: Generate pricing estimates
      const pricingResult = await predictPrice({
        damages,
        filthinessScore,
        vehicleInfo: args.vehicleInfo,
        tenantId: user.tenantId,
      })

      // Step 5: Create estimate record
      const estimateId = await ctx.runMutation(api.estimates.createEstimate, {
        inspectionId,
        estimateNumber: `EST-${Date.now()}-AI`,
        serviceType: "custom",
        laborHours: pricingResult.laborHours,
        laborRate: 7500, // $75/hour
        materialsCost: pricingResult.materialsCost,
        taxRate: 0.0875,
        validUntil: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
        lineItems: pricingResult.lineItems,
        notes: "AI-generated estimate based on image analysis",
      })

      // Step 6: Store embeddings for RAG
      await generateEstimateEmbedding(ctx, {
        inspectionId,
        estimateId,
        damages,
        vehicleInfo: args.vehicleInfo,
        pricingResult,
      })

      // Step 7: Generate response with log
      const response = await respondWithLog({
        action: "vehicle_assessment_completed",
        inspectionId,
        estimateId,
        damages,
        pricingResult,
        tenantId: user.tenantId,
      })

      return {
        inspectionId,
        damages,
        overallCondition: getOverallCondition(damages, filthinessScore),
        filthinessScore,
        estimatedRepairCost: pricingResult.repairCost,
        estimatedCleaningCost: pricingResult.cleaningCost,
        totalEstimate: pricingResult.totalCost,
        recommendedServices: pricingResult.recommendedServices,
        aiResponse: response,
      }
    } catch (error) {
      console.error("Vehicle assessment failed:", error)
      throw new Error(error instanceof Error ? error.message : "Assessment failed")
    }
  },
})

// AI Tool: Classify damage from image
async function classifyDamage(imageUrl: string, vehicleContext: any) {
  // Simulate AI image analysis - integrate with actual Ollama vision model
  await new Promise((resolve) => setTimeout(resolve, 3000))

  // Mock damage detection results
  const mockDamages = [
    {
      type: "scratch",
      severity: "moderate",
      location: "front_bumper",
      description: "Linear scratch approximately 6 inches long",
      boundingBox: { x: 25, y: 40, width: 15, height: 8 },
      confidence: 0.92,
      repairEstimate: 15000, // $150
    },
    {
      type: "dent",
      severity: "minor",
      location: "driver_door",
      description: "Small dent from parking lot incident",
      boundingBox: { x: 60, y: 35, width: 8, height: 12 },
      confidence: 0.87,
      repairEstimate: 25000, // $250
    },
  ]

  const filthinessScore = Math.floor(Math.random() * 60) + 20 // 20-80%

  return {
    damages: mockDamages,
    filthinessScore,
    processingTime: 3000,
  }
}

// AI Tool: Predict repair pricing
async function predictPrice({ damages, filthinessScore, vehicleInfo, tenantId }: any) {
  // Simulate pricing AI - integrate with actual pricing model
  await new Promise(resolve => setTimeout(resolve, 1500))

  const repairCost = damages.reduce((sum: number, d: any) => sum + d.repairEstimate, 0)
  const cleaningCost = Math.round(filthinessScore * 200) // $2 per filthiness point
  const laborHours = Math.ceil((repairCost + cleaningCost) / 7500) // At $75/hour
  const materialsCost = Math.round(repairCost * 0.3) // 30% materials

  const totalCost = repairCost + cleaningCost + materialsCost

  return {
    repairCost,
    cleaningCost,
    materialsCost,
    laborHours,
    \
