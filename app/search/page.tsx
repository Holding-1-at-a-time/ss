"use client"
import { useState, useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams, useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { useAuthContext } from "@/lib/auth-context"
import { useTenant } from "@/lib/tenant-context"
import { useDebounce } from "@/hooks/use-debounce"
import { ProtectedLayout } from "@/components/protected-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Search,
  Filter,
  Calendar,
  MapPin,
  AlertTriangle,
  Car,
  X,
  SortAsc,
  SortDesc,
  FileText,
  Star,
  TrendingUp,
} from "lucide-react"

interface SearchFilters {
  query: string
  severity: string[]
  dateRange: {
    start: string
    end: string
  }
  inspectionType: string[]
  condition: string[]
  sortBy: "relevance" | "date" | "severity" | "score"
  sortOrder: "asc" | "desc"
}

interface SearchResult {
  id: string
  type: "inspection" | "estimate" | "booking" | "damage"
  title: string
  description: string
  snippet: string
  relevanceScore: number
  semanticScore: number
  keywordScore: number
  metadata: {
    vehicleInfo?: {
      make: string
      model: string
      year: number
    }
    customerName?: string
    createdAt: string
    severity?: string
    condition?: string
    location?: string
    tags?: string[]
  }
  matchedTerms: string[]
  highlights: string[]
}

const severityOptions = [
  { value: "minor", label: "Minor", color: "bg-green-100 text-green-800" },
  { value: "moderate", label: "Moderate", color: "bg-yellow-100 text-yellow-800" },
  { value: "major", label: "Major", color: "bg-orange-100 text-orange-800" },
  { value: "severe", label: "Severe", color: "bg-red-100 text-red-800" },
]

const inspectionTypeOptions = [
  { value: "basic", label: "Basic Inspection" },
  { value: "detailed", label: "Detailed Inspection" },
  { value: "pre_purchase", label: "Pre-Purchase" },
  { value: "insurance", label: "Insurance Claim" },
  { value: "warranty", label: "Warranty Check" },
]

const conditionOptions = [
  { value: "excellent", label: "Excellent" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
]

function FilterChip({
  label,
  onRemove,
  color = "bg-primary/10 text-primary",
}: {
  label: string
  onRemove: () => void
  color?: string
}) {
  return (
    <Badge variant="secondary" className={`${color} gap-1`}>
      {label}
      <Button variant="ghost" size="sm" className="h-4 w-4 p-0 hover:bg-transparent" onClick={onRemove}>
        <X className="h-3 w-3" />
      </Button>
    </Badge>
  )
}

function SearchResultCard({ result }: { result: SearchResult }) {
  const router = useRouter()

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "inspection":
        return <Car className="h-4 w-4" />
      case "estimate":
        return <FileText className="h-4 w-4" />
      case "booking":
        return <Calendar className="h-4 w-4" />
      case "damage":
        return <AlertTriangle className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "inspection":
        return "bg-blue-100 text-blue-800"
      case "estimate":
        return "bg-green-100 text-green-800"
      case "booking":
        return "bg-purple-100 text-purple-800"
      case "damage":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const handleViewDetails = () => {
    const basePath =
      result.type === "inspection"
        ? "/inspections"
        : result.type === "estimate"
          ? "/estimates"
          : result.type === "booking"
            ? "/bookings"
            : "/damages"
    router.push(`${basePath}/${result.id}`)
  }

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={handleViewDetails}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className={getTypeColor(result.type)}>
                {getTypeIcon(result.type)}
                {result.type.charAt(0).toUpperCase() + result.type.slice(1)}
              </Badge>
              {result.metadata.severity && (
                <Badge
                  variant="secondary"
                  className={severityOptions.find((s) => s.value === result.metadata.severity)?.color}
                >
                  {result.metadata.severity}
                </Badge>
              )}
            </div>
            <CardTitle className="text-lg">{result.title}</CardTitle>
            <CardDescription>{result.description}</CardDescription>
          </div>
          <div className="text-right space-y-1">
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 text-yellow-500" />
              <span className="text-sm font-medium">{result.relevanceScore.toFixed(2)}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {format(parseISO(result.metadata.createdAt), "MMM d, yyyy")}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Snippet with highlights */}
        <div className="text-sm text-muted-foreground">
          <p dangerouslySetInnerHTML={{ __html: result.snippet }} />
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {result.metadata.vehicleInfo && (
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4 text-muted-foreground" />
              <span>
                {result.metadata.vehicleInfo.year} {result.metadata.vehicleInfo.make}{" "}
                {result.metadata.vehicleInfo.model}
              </span>
            </div>
          )}

          {result.metadata.customerName && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Customer:</span>
              <span>{result.metadata.customerName}</span>
            </div>
          )}

          {result.metadata.location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{result.metadata.location}</span>
            </div>
          )}

          {result.metadata.condition && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Condition:</span>
              <Badge variant="outline">{result.metadata.condition}</Badge>
            </div>
          )}
        </div>

        {/* Score Breakdown */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Relevance Breakdown</span>
            <Button variant="ghost" size="sm" className="h-auto p-0 text-xs">
              <TrendingUp className="h-3 w-3 mr-1" />
              Details
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span>Semantic:</span>
              <span className="font-medium">{result.semanticScore.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Keyword:</span>
              <span className="font-medium">{result.keywordScore.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Matched Terms */}
        {result.matchedTerms.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground">Matched Terms:</span>
            <div className="flex flex-wrap gap-1">
              {result.matchedTerms.map((term, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {term}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {result.metadata.tags && result.metadata.tags.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground">Tags:</span>
            <div className="flex flex-wrap gap-1">
              {result.metadata.tags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SearchResultsSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default function SearchPage() {
  const { user } = useAuthContext()
  const { tenant } = useTenant()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [filters, setFilters] = useState<SearchFilters>({
    query: searchParams.get("q") || "",
    severity: [],
    dateRange: {
      start: "",
      end: "",
    },
    inspectionType: [],
    condition: [],
    sortBy: "relevance",
    sortOrder: "desc",
  })

  const debouncedQuery = useDebounce(filters.query, 300)

  // Search query
  const {
    data: searchResults,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["search", tenant?.id, debouncedQuery, filters],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return { results: [], total: 0 }

      const params = new URLSearchParams({
        q: debouncedQuery,
        tenantId: tenant?.id || "",
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      })

      if (filters.severity.length > 0) {
        params.append("severity", filters.severity.join(","))
      }
      if (filters.inspectionType.length > 0) {
        params.append("inspectionType", filters.inspectionType.join(","))
      }
      if (filters.condition.length > 0) {
        params.append("condition", filters.condition.join(","))
      }
      if (filters.dateRange.start) {
        params.append("startDate", filters.dateRange.start)
      }
      if (filters.dateRange.end) {
        params.append("endDate", filters.dateRange.end)
      }

      const response = await fetch(`/api/search?${params.toString()}`)
      if (!response.ok) throw new Error("Search failed")
      return response.json()
    },
    enabled: !!tenant?.id && debouncedQuery.trim().length > 0,
  })

  // Update URL with search params
  useEffect(() => {
    const params = new URLSearchParams()
    if (filters.query) params.set("q", filters.query)
    if (filters.sortBy !== "relevance") params.set("sort", filters.sortBy)
    if (filters.sortOrder !== "desc") params.set("order", filters.sortOrder)

    const newUrl = `/search${params.toString() ? `?${params.toString()}` : ""}`
    router.replace(newUrl, { scroll: false })
  }, [filters.query, filters.sortBy, filters.sortOrder, router])

  const updateFilter = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const addArrayFilter = (key: "severity" | "inspectionType" | "condition", value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: [...prev[key], value],
    }))
  }

  const removeArrayFilter = (key: "severity" | "inspectionType" | "condition", value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key].filter((item) => item !== value),
    }))
  }

  const clearAllFilters = () => {
    setFilters((prev) => ({
      ...prev,
      severity: [],
      dateRange: { start: "", end: "" },
      inspectionType: [],
      condition: [],
    }))
  }

  const activeFilterCount = useMemo(() => {
    return (
      filters.severity.length +
      filters.inspectionType.length +
      filters.condition.length +
      (filters.dateRange.start ? 1 : 0) +
      (filters.dateRange.end ? 1 : 0)
    )
  }, [filters])

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Global Search</h1>
          <p className="text-muted-foreground">Search across inspections, estimates, bookings, and damage records</p>
        </div>

        {/* Search Input */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search for vehicles, customers, damage types, or any content..."
                value={filters.query}
                onChange={(e) => updateFilter("query", e.target.value)}
                className="pl-10 text-base"
              />
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 && <Badge variant="secondary">{activeFilterCount}</Badge>}
              </CardTitle>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                  Clear All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filter Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Severity</label>
                <Select onValueChange={(value) => addArrayFilter("severity", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Add severity filter" />
                  </SelectTrigger>
                  <SelectContent>
                    {severityOptions
                      .filter((option) => !filters.severity.includes(option.value))
                      .map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Inspection Type</label>
                <Select onValueChange={(value) => addArrayFilter("inspectionType", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Add type filter" />
                  </SelectTrigger>
                  <SelectContent>
                    {inspectionTypeOptions
                      .filter((option) => !filters.inspectionType.includes(option.value))
                      .map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Condition</label>
                <Select onValueChange={(value) => addArrayFilter("condition", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Add condition filter" />
                  </SelectTrigger>
                  <SelectContent>
                    {conditionOptions
                      .filter((option) => !filters.condition.includes(option.value))
                      .map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Sort By</label>
                <div className="flex gap-2">
                  <Select value={filters.sortBy} onValueChange={(value: any) => updateFilter("sortBy", value)}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relevance">Relevance</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="severity">Severity</SelectItem>
                      <SelectItem value="score">Score</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateFilter("sortOrder", filters.sortOrder === "asc" ? "desc" : "asc")}
                  >
                    {filters.sortOrder === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="date"
                  value={filters.dateRange.start}
                  onChange={(e) => updateFilter("dateRange", { ...filters.dateRange, start: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="date"
                  value={filters.dateRange.end}
                  onChange={(e) => updateFilter("dateRange", { ...filters.dateRange, end: e.target.value })}
                />
              </div>
            </div>

            {/* Active Filter Chips */}
            {activeFilterCount > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Active Filters</label>
                <div className="flex flex-wrap gap-2">
                  {filters.severity.map((severity) => (
                    <FilterChip
                      key={severity}
                      label={`Severity: ${severity}`}
                      onRemove={() => removeArrayFilter("severity", severity)}
                      color={severityOptions.find((s) => s.value === severity)?.color}
                    />
                  ))}
                  {filters.inspectionType.map((type) => (
                    <FilterChip
                      key={type}
                      label={`Type: ${inspectionTypeOptions.find((t) => t.value === type)?.label}`}
                      onRemove={() => removeArrayFilter("inspectionType", type)}
                    />
                  ))}
                  {filters.condition.map((condition) => (
                    <FilterChip
                      key={condition}
                      label={`Condition: ${condition}`}
                      onRemove={() => removeArrayFilter("condition", condition)}
                    />
                  ))}
                  {filters.dateRange.start && (
                    <FilterChip
                      label={`From: ${format(parseISO(filters.dateRange.start), "MMM d, yyyy")}`}
                      onRemove={() => updateFilter("dateRange", { ...filters.dateRange, start: "" })}
                    />
                  )}
                  {filters.dateRange.end && (
                    <FilterChip
                      label={`To: ${format(parseISO(filters.dateRange.end), "MMM d, yyyy")}`}
                      onRemove={() => updateFilter("dateRange", { ...filters.dateRange, end: "" })}
                    />
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Search Results */}
        <div className="space-y-4">
          {!filters.query.trim() ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Start Your Search</h3>
                <p className="text-muted-foreground">
                  Enter keywords to search across all your inspection data, estimates, and bookings.
                </p>
              </CardContent>
            </Card>
          ) : isLoading ? (
            <SearchResultsSkeleton />
          ) : error ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Search failed. Please try again or contact support if the problem persists.
              </AlertDescription>
            </Alert>
          ) : searchResults?.results?.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Results Found</h3>
                <p className="text-muted-foreground mb-4">
                  No results found for "{filters.query}". Try adjusting your search terms or filters.
                </p>
                <Button variant="outline" onClick={clearAllFilters}>
                  Clear Filters
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Results Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">Search Results</h2>
                  <Badge variant="secondary">{searchResults?.total || 0} results</Badge>
                </div>
                <div className="text-sm text-muted-foreground">Found in {searchResults?.searchTime || 0}ms</div>
              </div>

              {/* Results List */}
              <div className="space-y-4">
                {searchResults?.results?.map((result: SearchResult) => (
                  <SearchResultCard key={result.id} result={result} />
                ))}
              </div>

              {/* Load More */}
              {searchResults?.hasMore && (
                <div className="text-center">
                  <Button variant="outline">Load More Results</Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </ProtectedLayout>
  )
}
