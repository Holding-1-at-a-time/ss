import { v } from "convex/values"
import { query, action } from "./_generated/server"
import { getCurrentUser } from "./auth"
import { api } from "./_generated/api"
import {
  DEFAULT_SEARCH_WEIGHTS,
  calculateTimeDecay,
  calculateKeywordMatch,
  calculateDamageRelevance,
  createSearchableText,
  matchesFilters,
  generateInspectionSummary,
  generateRelevanceFactors,
  type SearchFilters,
  type SearchWeights,
  type SearchResult,
} from "./hybridSearchUtils"

// Main hybrid search query with semantic + structured filtering
export const searchInspectionsWithScore = action({
  args: {
    queryText: v.string(),
    filters: v.optional(
      v.object({
        severity: v.optional(
          v.array(v.union(v.literal("minor"), v.literal("moderate"), v.literal("major"), v.literal("severe"))),
        ),
        dateStart: v.optional(v.number()),
        dateEnd: v.optional(v.number()),
        vehicleMake: v.optional(v.array(v.string())),
        inspectionType: v.optional(
          v.array(
            v.union(v.literal("intake"), v.literal("pre_detail"), v.literal("post_detail"), v.literal("quality_check")),
          ),
        ),
        overallCondition: v.optional(
          v.array(v.union(v.literal("excellent"), v.literal("good"), v.literal("fair"), v.literal("poor"))),
        ),
        filthinessLevel: v.optional(
          v.array(v.union(v.literal("light"), v.literal("moderate"), v.literal("heavy"), v.literal("extreme"))),
        ),
        minDamageCount: v.optional(v.number()),
        maxDamageCount: v.optional(v.number()),
      }),
    ),
    weights: v.optional(
      v.object({
        vectorSimilarity: v.number(),
        keywordMatch: v.number(),
        timeDecay: v.number(),
        exactMatch: v.number(),
        damageRelevance: v.number(),
      }),
    ),
    limit: v.optional(v.number()),
    similarityThreshold: v.optional(v.number()),
    includeEmbeddings: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    try {
      const searchFilters: SearchFilters = args.filters || {}
      const searchWeights: SearchWeights = { ...DEFAULT_SEARCH_WEIGHTS, ...args.weights }
      const limit = args.limit || 20
      const similarityThreshold = args.similarityThreshold || 0.1

      // Step 1: Generate query embedding for semantic search
      const queryEmbedding = await ctx.runAction(api.vectorSearchIntegration.generateQueryEmbedding, {
        queryText: args.queryText,
        model: "mxbai-embed-large",
      })

      // Step 2: Perform vector similarity search
      const vectorResults = await ctx.runAction(api.vectorSearchIntegration.vectorSearchInspections, {
        queryEmbedding: queryEmbedding.embedding,
        limit: limit * 2, // Get more results for filtering
        similarityThreshold,
        contentType: "full_inspection", // Search comprehensive inspection embeddings
      })

      // Step 3: Perform traditional text search for keyword matching
      const textSearchResults = await ctx.runQuery(api.inspections.searchInspections, {
        searchTerm: args.queryText,
      })

      // Step 4: Combine and deduplicate results
      const inspectionIds = new Set<string>()

      // Add vector search results
      vectorResults.forEach((result) => {
        inspectionIds.add(result.inspectionId)
      })

      // Add text search results
      textSearchResults.forEach((inspection) => {
        inspectionIds.add(inspection._id)
      })

      // Step 5: Fetch full inspection and damage data
      const searchResults: SearchResult[] = []

      for (const inspectionId of inspectionIds) {
        try {
          // Get inspection data
          const inspection = await ctx.runQuery(api.inspections.getInspectionById, {
            id: inspectionId as any,
          })

          if (!inspection) continue

          // Get related damages
          const damages = await ctx.runQuery(api.damages.getDamagesByInspection, {
            inspectionId: inspectionId as any,
          })

          // Step 6: Apply structured filters
          if (!matchesFilters(inspection, damages, searchFilters)) {
            continue
          }

          // Step 7: Calculate hybrid score
          const searchableText = createSearchableText(inspection, damages)

          // Get vector similarity score
          const vectorResult = vectorResults.find((vr) => vr.inspectionId === inspectionId)
          const vectorSimilarity = vectorResult ? vectorResult.similarity : 0

          // Calculate keyword match score
          const keywordResult = calculateKeywordMatch(args.queryText, searchableText)

          // Calculate time decay score
          const timeDecay = calculateTimeDecay(inspection.updatedAt)

          // Calculate damage relevance score
          const damageRelevance = calculateDamageRelevance(args.queryText, damages)

          // Calculate exact match bonus
          const exactMatch = keywordResult.exactMatches > 0 ? 1.0 : 0

          // Step 8: Compute weighted total score
          const scoreBreakdown = {
            vectorSimilarity: vectorSimilarity * searchWeights.vectorSimilarity,
            keywordMatch: keywordResult.score * searchWeights.keywordMatch,
            timeDecay: timeDecay * searchWeights.timeDecay,
            exactMatch: exactMatch * searchWeights.exactMatch,
            damageRelevance: damageRelevance * searchWeights.damageRelevance,
            totalScore: 0, // Will be calculated below
          }

          scoreBreakdown.totalScore =
            scoreBreakdown.vectorSimilarity +
            scoreBreakdown.keywordMatch +
            scoreBreakdown.timeDecay +
            scoreBreakdown.exactMatch +
            scoreBreakdown.damageRelevance

          // Step 9: Generate result metadata
          const summary = generateInspectionSummary(inspection, damages)
          const relevanceFactors = generateRelevanceFactors(
            scoreBreakdown,
            keywordResult.matchedTerms,
            inspection,
            damages,
          )

          searchResults.push({
            inspection,
            damages,
            score: scoreBreakdown.totalScore,
            scoreBreakdown,
            matchedTerms: keywordResult.matchedTerms,
            summary,
            relevanceFactors,
          })
        } catch (error) {
          console.error(`Error processing inspection ${inspectionId}:`, error)
          continue
        }
      }

      // Step 10: Sort by score and return top results
      searchResults.sort((a, b) => b.score - a.score)
      const topResults = searchResults.slice(0, limit)

      return {
        results: topResults,
        totalFound: searchResults.length,
        searchMetadata: {
          queryText: args.queryText,
          queryEmbedding: args.includeEmbeddings ? queryEmbedding.embedding : undefined,
          filters: searchFilters,
          weights: searchWeights,
          vectorResultsCount: vectorResults.length,
          textResultsCount: textSearchResults.length,
          combinedResultsCount: inspectionIds.size,
          filteredResultsCount: searchResults.length,
          executionTime: Date.now(),
        },
        scoringBreakdown: {
          averageVectorSimilarity:
            topResults.length > 0
              ? topResults.reduce((sum, r) => sum + r.scoreBreakdown.vectorSimilarity, 0) / topResults.length
              : 0,
          averageKeywordMatch:
            topResults.length > 0
              ? topResults.reduce((sum, r) => sum + r.scoreBreakdown.keywordMatch, 0) / topResults.length
              : 0,
          averageTimeDecay:
            topResults.length > 0
              ? topResults.reduce((sum, r) => sum + r.scoreBreakdown.timeDecay, 0) / topResults.length
              : 0,
          topScore: topResults.length > 0 ? topResults[0].score : 0,
          scoreRange: topResults.length > 1 ? topResults[0].score - topResults[topResults.length - 1].score : 0,
        },
      }
    } catch (error) {
      console.error("Hybrid search failed:", error)
      throw new Error(error instanceof Error ? error.message : "Hybrid search failed")
    }
  },
})

// Optimized search for specific use cases
export const searchInspectionsByDamage = action({
  args: {
    damageType: v.string(),
    severity: v.optional(v.string()),
    queryText: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    // Use damage-specific vector search
    const queryEmbedding = args.queryText
      ? await ctx.runAction(api.vectorSearchIntegration.generateQueryEmbedding, {
          queryText: `${args.damageType} ${args.severity || ""} ${args.queryText}`.trim(),
        })
      : null

    let vectorResults = []
    if (queryEmbedding) {
      vectorResults = await ctx.runAction(api.vectorSearchIntegration.vectorSearchDamages, {
        queryEmbedding: queryEmbedding.embedding,
        damageType: args.damageType,
        severity: args.severity,
        limit: args.limit || 20,
      })
    }

    // Get inspections with matching damage types using structured query
    const inspectionsWithDamages = await ctx.runQuery(api.damages.getDamagesBySeverity, {
      severity: (args.severity as any) || "moderate",
    })

    // Filter by damage type and combine with vector results
    const relevantInspections = inspectionsWithDamages
      .filter((damage) => damage.type === args.damageType)
      .map((damage) => damage.inspectionId)

    // Combine with vector search results
    const combinedInspectionIds = new Set([...relevantInspections, ...vectorResults.map((vr) => vr.inspectionId)])

    const results = []
    for (const inspectionId of combinedInspectionIds) {
      const inspection = await ctx.runQuery(api.inspections.getInspectionById, {
        id: inspectionId as any,
      })

      if (inspection) {
        const damages = await ctx.runQuery(api.damages.getDamagesByInspection, {
          inspectionId: inspectionId as any,
        })

        const relevantDamages = damages.filter(
          (d) => d.type === args.damageType && (!args.severity || d.severity === args.severity),
        )

        if (relevantDamages.length > 0) {
          results.push({
            inspection,
            damages: relevantDamages,
            allDamages: damages,
            matchCount: relevantDamages.length,
          })
        }
      }
    }

    return {
      results: results.slice(0, args.limit || 20),
      searchCriteria: {
        damageType: args.damageType,
        severity: args.severity,
        queryText: args.queryText,
      },
      totalFound: results.length,
    }
  },
})

// Search suggestions based on query analysis
export const getSearchSuggestions = query({
  args: {
    partialQuery: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const suggestions = []
    const query = args.partialQuery.toLowerCase()

    // Vehicle make suggestions
    const inspections = await ctx.db
      .query("inspections")
      .withIndex("by_tenant", (q) => q.eq("tenantId", user.tenantId))
      .collect()

    const vehicleMakes = new Set(
      inspections.map((i) => i.vehicleMake).filter((make) => make.toLowerCase().includes(query)),
    )

    vehicleMakes.forEach((make) => {
      suggestions.push({
        type: "vehicle_make",
        text: make,
        category: "Vehicle",
        count: inspections.filter((i) => i.vehicleMake === make).length,
      })
    })

    // Damage type suggestions
    const damageTypes = ["scratch", "dent", "chip", "crack", "stain", "burn", "tear"]
    damageTypes
      .filter((type) => type.includes(query))
      .forEach((type) => {
        suggestions.push({
          type: "damage_type",
          text: type,
          category: "Damage",
          count: 0, // Could be calculated from damages table
        })
      })

    // Severity suggestions
    const severities = ["minor", "moderate", "major", "severe"]
    severities
      .filter((severity) => severity.includes(query))
      .forEach((severity) => {
        suggestions.push({
          type: "severity",
          text: severity,
          category: "Severity",
          count: 0,
        })
      })

    return suggestions.slice(0, args.limit || 10)
  },
})
