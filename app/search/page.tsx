"use client"

import type React from "react"

import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Search, Filter, Calendar, Car, FileText, AlertTriangle, X, Loader2, SortAsc, SortDesc } from "lucide-react"
import { useTenant } from "@/lib/tenant-context"
import { useAuth } from "@/lib/auth-context"
import { format } from "date-fns"
import { useDebounce } from "@/hooks/use-debounce"

interface SearchFilters {
  severity?: Array<"minor" | "moderate" | "major" | "severe">
  dateStart?: number
  dateEnd?: number
  vehicleMake?: string[]
  inspectionType?: Array<"intake" | "pre_detail" | "post_detail" | "quality_check">
  overallCondition?: Array<"excellent" | "good" | "fair" | "poor">
  filthinessLevel?: Array<"light" | "moderate" | "heavy" | "extreme">
  minDamageCount?: number
  maxDamageCount?: number
}

interface SearchResult {
  inspection: any
  damages: any[]
  score: number
  scoreBreakdown: {
    vectorSimilarity: number
    keywordMatch: number
    timeDecay: number
    exactMatch: number
    damageRelevance: number
    totalScore: number
  }
  matchedTerms: string[]
  summary: {
    vehicleInfo: string
    damageCount: number
    totalRepairCost: number
    condition: string
    lastUpdated: string
  }
  relevanceFactors: string[]
}

type SortOption = "relevance" | "date" | "damage_count" | "repair_cost"
type SortDirection = "asc" | "desc"

const SEVERITY_OPTIONS = [
  { value: "minor", label: "Minor", color: "bg-green-100 text-green-800" },
  { value: "moderate", label: "Moderate", color: "bg-yellow-100 text-yellow-800" },
  { value: "major", label: "Major", color: "bg-orange-100 text-orange-800" },
  { value: "severe", label: "Severe", color: "bg-red-100 text-red-800" },
]

const INSPECTION_TYPES = [
  { value: "intake", label: "Intake" },
  { value: "pre_detail", label: "Pre-Detail" },
  { value: "post_detail", label: "Post-Detail" },
  { value: "quality_check", label: "Quality Check" },
]

const CONDITION_OPTIONS = [
  { value: "excellent", label: "Excellent" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
]

const FILTHINESS_LEVELS = [
  { value: "light", label: "Light" },
  { value: "moderate", label: "Moderate" },
  { value: "heavy", label: "Heavy" },
  { value: "extreme", label: "Extreme" },
]

function FilterChip({
  label,
  onRemove,
  color = "bg-blue-100 text-blue-800",
}: {
  label: string
  onRemove: () => void
  color?: string
}) {
  return (
    <Badge variant="secondary" className={`${color} flex items-center gap-1`}>
      {label}
      <button
        onClick={onRemove}
        className="ml-1 hover:bg-black/10 rounded-full p-0.5"
        aria-label={`Remove ${label} filter`}
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  )
}

function SearchResultCard({ result }: { result: SearchResult }) {
  const { inspection, damages, score, scoreBreakdown, matchedTerms, summary, relevanceFactors } = result

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <Car className="h-5 w-5" />
              {summary.vehicleInfo}
            </CardTitle>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {summary.lastUpdated}
              </span>
              <span className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                {inspection.inspectionType}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium">Score: {(score * 100).toFixed(1)}%</div>
            <Badge
              variant={
                summary.condition === "excellent"
                  ? "default"
                  : summary.condition === "good"
                    ? "secondary"
                    : summary.condition === "fair"
                      ? "outline"
                      : "destructive"
              }
            >
              {summary.condition}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Damage Summary */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <span className="text-sm">
              {summary.damageCount} damage{summary.damageCount !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="text-sm font-medium">Est. Repair: ${(summary.totalRepairCost / 100).toFixed(2)}</div>
        </div>

        {/* Matched Terms */}
        {matchedTerms.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Matched Terms:</div>
            <div className="flex flex-wrap gap-1">
              {matchedTerms.map((term, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {term}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Relevance Factors */}
        {relevanceFactors.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Why this result:</div>
            <ul className="text-xs text-muted-foreground space-y-1">
              {relevanceFactors.slice(0, 3).map((factor, index) => (
                <li key={index} className="flex items-center gap-1">
                  <div className="w-1 h-1 bg-current rounded-full" />
                  {factor}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Score Breakdown (expandable) */}
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Score breakdown</summary>
          <div className="mt-2 space-y-1 pl-4">
            <div>Semantic similarity: {(scoreBreakdown.vectorSimilarity * 100).toFixed(1)}%</div>
            <div>Keyword match: {(scoreBreakdown.keywordMatch * 100).toFixed(1)}%</div>
            <div>Recency: {(scoreBreakdown.timeDecay * 100).toFixed(1)}%</div>
            <div>Exact match: {(scoreBreakdown.exactMatch * 100).toFixed(1)}%</div>
            <div>Damage relevance: {(scoreBreakdown.damageRelevance * 100).toFixed(1)}%</div>
          </div>
        </details>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" asChild>
            <a href={`/inspections/${inspection._id}`}>View Details</a>
          </Button>
          {damages.length > 0 && (
            <Button variant="outline" size="sm" asChild>
              <a href={`/inspections/${inspection._id}/damages`}>View Damages</a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function SearchPage() {
  const { tenant } = useTenant()
  const { user } = useAuth()

  const [searchQuery, setSearchQuery] = useState("")
  const [filters, setFilters] = useState<SearchFilters>({})
  const [sortBy, setSortBy] = useState<SortOption>("relevance")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [showFilters, setShowFilters] = useState(false)

  const debouncedQuery = useDebounce(searchQuery, 300)

  // Search results query
  const {
    data: searchResults,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["search", tenant?.id, debouncedQuery, filters, sortBy, sortDirection],
    queryFn: async () => {
      if (!tenant?.id || !debouncedQuery.trim()) return null

      // Mock search results - in real app would call Convex action
      const mockResults: SearchResult[] = [
        {
          inspection: {
            _id: "insp_1",
            vehicleYear: 2020,
            vehicleMake: "Honda",
            vehicleModel: "Civic",
            vehicleVin: "1HGBH41JXMN109186",
            customerName: "John Doe",
            customerEmail: "john@example.com",
            inspectionType: "intake",
            overallCondition: "good",
            filthinessSeverity: "moderate",
            notes: "Minor scratches on passenger door",
            createdAt: Date.now() - 86400000, // 1 day ago
            updatedAt: Date.now() - 86400000,
          },
          damages: [
            {
              type: "scratch",
              severity: "minor",
              location: "passenger_door",
              description: "Light surface scratch",
              repairEstimate: 15000, // $150
            },
          ],
          score: 0.85,
          scoreBreakdown: {
            vectorSimilarity: 0.7,
            keywordMatch: 0.8,
            timeDecay: 0.9,
            exactMatch: 0.5,
            damageRelevance: 0.6,
            totalScore: 0.85,
          },
          matchedTerms: ["scratch", "door", "honda"],
          summary: {
            vehicleInfo: "2020 Honda Civic",
            damageCount: 1,
            totalRepairCost: 15000,
            condition: "good",
            lastUpdated: format(Date.now() - 86400000, "MMM d, yyyy"),
          },
          relevanceFactors: [
            "High semantic similarity to query",
            "Matched keywords: scratch, door, honda",
            "Recent inspection",
            "1 damage documented",
          ],
        },
        // Add more mock results...
      ]

      // Filter results based on current filters
      let filteredResults = mockResults

      if (filters.severity?.length) {
        filteredResults = filteredResults.filter((result) =>
          result.damages.some((damage) => filters.severity!.includes(damage.severity)),
        )
      }

      if (filters.inspectionType?.length) {
        filteredResults = filteredResults.filter((result) =>
          filters.inspectionType!.includes(result.inspection.inspectionType),
        )
      }

      if (filters.overallCondition?.length) {
        filteredResults = filteredResults.filter((result) =>
          filters.overallCondition!.includes(result.inspection.overallCondition),
        )
      }

      // Sort results
      filteredResults.sort((a, b) => {
        let comparison = 0

        switch (sortBy) {
          case "relevance":
            comparison = b.score - a.score
            break
          case "date":
            comparison = b.inspection.updatedAt - a.inspection.updatedAt
            break
          case "damage_count":
            comparison = b.damages.length - a.damages.length
            break
          case "repair_cost":
            comparison = b.summary.totalRepairCost - a.summary.totalRepairCost
            break
        }

        return sortDirection === "desc" ? comparison : -comparison
      })

      return {
        results: filteredResults,
        totalFound: filteredResults.length,
        searchMetadata: {
          queryText: debouncedQuery,
          filters,
          executionTime: Date.now(),
        },
      }
    },
    enabled: !!tenant?.id && !!debouncedQuery.trim(),
  })

  // Active filter chips
  const activeFilters = useMemo(() => {
    const chips: Array<{ label: string; onRemove: () => void; color?: string }> = []

    filters.severity?.forEach((severity) => {
      const option = SEVERITY_OPTIONS.find((opt) => opt.value === severity)
      if (option) {
        chips.push({
          label: `Severity: ${option.label}`,
          color: option.color,
          onRemove: () =>
            setFilters((prev) => ({
              ...prev,
              severity: prev.severity?.filter((s) => s !== severity),
            })),
        })
      }
    })

    filters.inspectionType?.forEach((type) => {
      const option = INSPECTION_TYPES.find((opt) => opt.value === type)
      if (option) {
        chips.push({
          label: `Type: ${option.label}`,
          onRemove: () =>
            setFilters((prev) => ({
              ...prev,
              inspectionType: prev.inspectionType?.filter((t) => t !== type),
            })),
        })
      }
    })

    filters.overallCondition?.forEach((condition) => {
      const option = CONDITION_OPTIONS.find((opt) => opt.value === condition)
      if (option) {
        chips.push({
          label: `Condition: ${option.label}`,
          onRemove: () =>
            setFilters((prev) => ({
              ...prev,
              overallCondition: prev.overallCondition?.filter((c) => c !== condition),
            })),
        })
      }
    })

    return chips
  }, [filters])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // Search is triggered automatically by the debounced query
  }

  const clearAllFilters = () => {
    setFilters({})
  }

  if (!tenant) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin" />
          <p className="mt-2 text-sm text-muted-foreground">Loading tenant context...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Search Inspections</h1>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search inspections, damages, vehicles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
            </Button>
          </div>

          {/* Active Filter Chips */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Active filters:</span>
              {activeFilters.map((filter, index) => (
                <FilterChip key={index} label={filter.label} onRemove={filter.onRemove} color={filter.color} />
              ))}
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs">
                Clear all
              </Button>
            </div>
          )}
        </form>

        {/* Filters Panel */}
        {showFilters && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Search Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Severity Filter */}
                <div className="space-y-3">
                  <h4 className="font-medium">Severity</h4>
                  {SEVERITY_OPTIONS.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`severity-${option.value}`}
                        checked={filters.severity?.includes(option.value as any) || false}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFilters((prev) => ({
                              ...prev,
                              severity: [...(prev.severity || []), option.value as any],
                            }))
                          } else {
                            setFilters((prev) => ({
                              ...prev,
                              severity: prev.severity?.filter((s) => s !== option.value),
                            }))
                          }
                        }}
                      />
                      <label
                        htmlFor={`severity-${option.value}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {option.label}
                      </label>
                    </div>
                  ))}
                </div>

                {/* Inspection Type Filter */}
                <div className="space-y-3">
                  <h4 className="font-medium">Inspection Type</h4>
                  {INSPECTION_TYPES.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`type-${option.value}`}
                        checked={filters.inspectionType?.includes(option.value as any) || false}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFilters((prev) => ({
                              ...prev,
                              inspectionType: [...(prev.inspectionType || []), option.value as any],
                            }))
                          } else {
                            setFilters((prev) => ({
                              ...prev,
                              inspectionType: prev.inspectionType?.filter((t) => t !== option.value),
                            }))
                          }
                        }}
                      />
                      <label
                        htmlFor={`type-${option.value}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {option.label}
                      </label>
                    </div>
                  ))}
                </div>

                {/* Condition Filter */}
                <div className="space-y-3">
                  <h4 className="font-medium">Overall Condition</h4>
                  {CONDITION_OPTIONS.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`condition-${option.value}`}
                        checked={filters.overallCondition?.includes(option.value as any) || false}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFilters((prev) => ({
                              ...prev,
                              overallCondition: [...(prev.overallCondition || []), option.value as any],
                            }))
                          } else {
                            setFilters((prev) => ({
                              ...prev,
                              overallCondition: prev.overallCondition?.filter((c) => c !== option.value),
                            }))
                          }
                        }}
                      />
                      <label
                        htmlFor={`condition-${option.value}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {option.label}
                      </label>
                    </div>
                  ))}
                </div>

                {/* Filthiness Filter */}
                <div className="space-y-3">
                  <h4 className="font-medium">Filthiness Level</h4>
                  {FILTHINESS_LEVELS.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`filthiness-${option.value}`}
                        checked={filters.filthinessLevel?.includes(option.value as any) || false}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFilters((prev) => ({
                              ...prev,
                              filthinessLevel: [...(prev.filthinessLevel || []), option.value as any],
                            }))
                          } else {
                            setFilters((prev) => ({
                              ...prev,
                              filthinessLevel: prev.filthinessLevel?.filter((f) => f !== option.value),
                            }))
                          }
                        }}
                      />
                      <label
                        htmlFor={`filthiness-${option.value}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {option.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Results Section */}
      {debouncedQuery && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold">
                Search Results
                {searchResults && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({searchResults.totalFound} found)
                  </span>
                )}
              </h2>
            </div>

            {/* Sort Controls */}
            <div className="flex items-center gap-2">
              <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">Relevance</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="damage_count">Damage Count</SelectItem>
                  <SelectItem value="repair_cost">Repair Cost</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
                aria-label={`Sort ${sortDirection === "asc" ? "descending" : "ascending"}`}
              >
                {sortDirection === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                <p className="mt-2 text-sm text-muted-foreground">Searching...</p>
              </div>
            </div>
          ) : error ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>Search failed. Please try again.</AlertDescription>
            </Alert>
          ) : searchResults?.results.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64">
                <Search className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No results found</h3>
                <p className="text-sm text-muted-foreground text-center">Try adjusting your search terms or filters</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {searchResults?.results.map((result, index) => (
                <SearchResultCard key={`${result.inspection._id}-${index}`} result={result} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!debouncedQuery && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Search Inspections</h3>
            <p className="text-sm text-muted-foreground text-center">
              Enter search terms to find inspections, damages, and vehicle records
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
