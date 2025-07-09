"use client"

import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useAuthContext } from "@/lib/auth-context"
import { ProtectedLayout } from "@/components/protected-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import {
  CalendarIcon,
  Filter,
  Plus,
  Search,
  Eye,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Car,
  User,
  ClipboardList,
} from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface Inspection {
  _id: string
  vehicleVin: string
  vehicleMake: string
  vehicleModel: string
  vehicleYear: number
  customerName: string
  customerEmail: string
  status: "pending" | "in_progress" | "completed" | "cancelled"
  inspectionType: "intake" | "pre_detail" | "post_detail" | "quality_check"
  scheduledAt: number
  completedAt?: number
  assignedInspector?: string
  filthinessScore?: number
  filthinessSeverity?: "light" | "moderate" | "heavy" | "extreme"
  damageCount?: number
  createdAt: number
  updatedAt: number
}

interface InspectionFilters {
  dateRange: {
    from?: Date
    to?: Date
  }
  status?: string
  inspector?: string
  severityRange: [number, number]
  searchTerm: string
}

const statusConfig = {
  pending: { label: "Pending", variant: "secondary" as const, icon: Clock },
  in_progress: { label: "In Progress", variant: "default" as const, icon: AlertTriangle },
  completed: { label: "Completed", variant: "default" as const, icon: CheckCircle },
  cancelled: { label: "Cancelled", variant: "destructive" as const, icon: XCircle },
}

const severityConfig = {
  light: { label: "Light", color: "text-green-600" },
  moderate: { label: "Moderate", color: "text-yellow-600" },
  heavy: { label: "Heavy", color: "text-orange-600" },
  extreme: { label: "Extreme", color: "text-red-600" },
}

export default function InspectionsPage() {
  const { user } = useAuthContext()
  const [filters, setFilters] = useState<InspectionFilters>({
    dateRange: {},
    severityRange: [0, 100],
    searchTerm: "",
  })
  const [showFilters, setShowFilters] = useState(false)

  // Fetch inspections with tenant context
  const {
    data: inspections,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["inspections", user?.tenantId, filters],
    queryFn: async () => {
      if (!user?.tenantId) throw new Error("No tenant context")

      const params = new URLSearchParams()
      if (filters.status) params.append("status", filters.status)
      if (filters.inspector) params.append("inspector", filters.inspector)
      if (filters.searchTerm) params.append("search", filters.searchTerm)
      if (filters.dateRange.from) params.append("from", filters.dateRange.from.toISOString())
      if (filters.dateRange.to) params.append("to", filters.dateRange.to.toISOString())

      const response = await fetch(`/api/inspections?${params}`)
      if (!response.ok) throw new Error("Failed to fetch inspections")
      return response.json() as Promise<Inspection[]>
    },
    enabled: !!user?.tenantId,
  })

  // Filter inspections client-side for severity range
  const filteredInspections = useMemo(() => {
    if (!inspections) return []

    return inspections.filter((inspection) => {
      const severity = inspection.filthinessScore || 0
      return severity >= filters.severityRange[0] && severity <= filters.severityRange[1]
    })
  }, [inspections, filters.severityRange])

  const updateFilters = (updates: Partial<InspectionFilters>) => {
    setFilters((prev) => ({ ...prev, ...updates }))
  }

  const clearFilters = () => {
    setFilters({
      dateRange: {},
      severityRange: [0, 100],
      searchTerm: "",
    })
  }

  if (isLoading) {
    return (
      <ProtectedLayout>
        <InspectionsPageSkeleton />
      </ProtectedLayout>
    )
  }

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Inspections</h1>
            <p className="text-muted-foreground">Manage vehicle inspections and track progress</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </Button>
            <Button asChild>
              <Link href="/inspections/new">
                <Plus className="h-4 w-4 mr-2" />
                New Inspection
              </Link>
            </Button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Failed to load inspections. Please try again.</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-6">
          {/* Sidebar Filters */}
          {showFilters && (
            <Card className="w-80 h-fit">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Filters
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Search */}
                <div className="space-y-2">
                  <Label>Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search VIN, customer..."
                      value={filters.searchTerm}
                      onChange={(e) => updateFilters({ searchTerm: e.target.value })}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Date Range */}
                <div className="space-y-2">
                  <Label>Date Range</Label>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "flex-1 justify-start text-left font-normal",
                            !filters.dateRange.from && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {filters.dateRange.from ? format(filters.dateRange.from, "MMM dd") : "From"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={filters.dateRange.from}
                          onSelect={(date) =>
                            updateFilters({
                              dateRange: { ...filters.dateRange, from: date },
                            })
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "flex-1 justify-start text-left font-normal",
                            !filters.dateRange.to && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {filters.dateRange.to ? format(filters.dateRange.to, "MMM dd") : "To"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={filters.dateRange.to}
                          onSelect={(date) =>
                            updateFilters({
                              dateRange: { ...filters.dateRange, to: date },
                            })
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Status Filter */}
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={filters.status || "all"}
                    onValueChange={(value) => updateFilters({ status: value === "all" ? undefined : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Inspector Filter */}
                <div className="space-y-2">
                  <Label>Inspector</Label>
                  <Select
                    value={filters.inspector || "all"}
                    onValueChange={(value) => updateFilters({ inspector: value === "all" ? undefined : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All inspectors" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All inspectors</SelectItem>
                      <SelectItem value="john-doe">John Doe</SelectItem>
                      <SelectItem value="jane-smith">Jane Smith</SelectItem>
                      <SelectItem value="mike-wilson">Mike Wilson</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Severity Range */}
                <div className="space-y-2">
                  <Label>Filthiness Severity Range</Label>
                  <div className="px-2">
                    <Slider
                      value={filters.severityRange}
                      onValueChange={(value) => updateFilters({ severityRange: value as [number, number] })}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>{filters.severityRange[0]}%</span>
                      <span>{filters.severityRange[1]}%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main Content */}
          <div className="flex-1">
            {/* Desktop Table View */}
            <div className="hidden md:block">
              <Card>
                <CardHeader>
                  <CardTitle>Inspections ({filteredInspections?.length || 0})</CardTitle>
                  <CardDescription>Click on any inspection to view details</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Scheduled</TableHead>
                        <TableHead>Inspector</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInspections?.map((inspection) => (
                        <TableRow
                          key={inspection._id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => (window.location.href = `/inspections/${inspection._id}`)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Car className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="font-medium">
                                  {inspection.vehicleYear} {inspection.vehicleMake} {inspection.vehicleModel}
                                </div>
                                <div className="text-sm text-muted-foreground">{inspection.vehicleVin}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="font-medium">{inspection.customerName}</div>
                                <div className="text-sm text-muted-foreground">{inspection.customerEmail}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusConfig[inspection.status].variant}>
                              {statusConfig[inspection.status].label}
                            </Badge>
                          </TableCell>
                          <TableCell className="capitalize">{inspection.inspectionType.replace("_", " ")}</TableCell>
                          <TableCell>{format(new Date(inspection.scheduledAt), "MMM dd, yyyy")}</TableCell>
                          <TableCell>{inspection.assignedInspector || "Unassigned"}</TableCell>
                          <TableCell>
                            {inspection.filthinessSeverity && (
                              <span className={severityConfig[inspection.filthinessSeverity].color}>
                                {severityConfig[inspection.filthinessSeverity].label}
                                {inspection.filthinessScore && ` (${inspection.filthinessScore}%)`}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                window.location.href = `/inspections/${inspection._id}`
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {filteredInspections?.map((inspection) => (
                <Card
                  key={inspection._id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => (window.location.href = `/inspections/${inspection._id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">
                            {inspection.vehicleYear} {inspection.vehicleMake} {inspection.vehicleModel}
                          </div>
                          <div className="text-sm text-muted-foreground">{inspection.vehicleVin}</div>
                        </div>
                      </div>
                      <Badge variant={statusConfig[inspection.status].variant}>
                        {statusConfig[inspection.status].label}
                      </Badge>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span>{inspection.customerName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                        <span>{format(new Date(inspection.scheduledAt), "MMM dd, yyyy")}</span>
                      </div>
                      {inspection.filthinessSeverity && (
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-3 w-3 text-muted-foreground" />
                          <span className={severityConfig[inspection.filthinessSeverity].color}>
                            {severityConfig[inspection.filthinessSeverity].label}
                            {inspection.filthinessScore && ` (${inspection.filthinessScore}%)`}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Empty State */}
            {filteredInspections?.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No inspections found</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    {filters.searchTerm || filters.status || filters.inspector
                      ? "Try adjusting your filters or search terms"
                      : "Get started by creating your first inspection"}
                  </p>
                  <Button asChild>
                    <Link href="/inspections/new">
                      <Plus className="h-4 w-4 mr-2" />
                      New Inspection
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </ProtectedLayout>
  )
}

function InspectionsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      <div className="flex gap-6">
        <Card className="w-80">
          <CardHeader>
            <Skeleton className="h-6 w-24" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="flex-1">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4 p-4 border rounded">
                  <Skeleton className="h-4 w-4" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
