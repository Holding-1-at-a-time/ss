"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { DollarSign, Calendar, CheckCircle, Clock, Wrench, Sparkles, AlertTriangle, TrendingUp } from "lucide-react"

interface AssessmentResult {
  inspectionId: string
  damages: Array<{
    id: string
    type: string
    severity: string
    location: string
    repairEstimate: number
  }>
  overallCondition: string
  filthinessScore: number
  estimatedRepairCost: number
  estimatedCleaningCost: number
  totalEstimate: number
  recommendedServices: string[]
}

interface EstimateDisplayProps {
  result: AssessmentResult
  onScheduleService: () => void
}

const conditionColors = {
  excellent: "text-green-600",
  good: "text-blue-600",
  fair: "text-yellow-600",
  poor: "text-red-600",
}

const conditionVariants = {
  excellent: "default" as const,
  good: "secondary" as const,
  fair: "secondary" as const,
  poor: "destructive" as const,
}

export function EstimateDisplay({ result, onScheduleService }: EstimateDisplayProps) {
  const [selectedService, setSelectedService] = useState<string | null>(null)

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100)
  }

  const getFilthinessSeverity = (score: number) => {
    if (score <= 25) return { label: "Light", color: "text-green-600" }
    if (score <= 50) return { label: "Moderate", color: "text-yellow-600" }
    if (score <= 75) return { label: "Heavy", color: "text-orange-600" }
    return { label: "Extreme", color: "text-red-600" }
  }

  const filthiness = getFilthinessSeverity(result.filthinessScore)

  return (
    <div className="space-y-6">
      {/* Overall Assessment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Assessment Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Overall Condition</p>
              <Badge
                variant={conditionVariants[result.overallCondition as keyof typeof conditionVariants]}
                className="capitalize"
              >
                {result.overallCondition}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Filthiness Level</p>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={filthiness.color}>
                  {filthiness.label}
                </Badge>
                <span className="text-sm">({result.filthinessScore}%)</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            <div className="text-center">
              <Wrench className="h-8 w-8 mx-auto mb-2 text-orange-500" />
              <p className="text-sm text-muted-foreground">Repair Cost</p>
              <p className="text-lg font-semibold">{formatCurrency(result.estimatedRepairCost)}</p>
            </div>
            <div className="text-center">
              <Sparkles className="h-8 w-8 mx-auto mb-2 text-blue-500" />
              <p className="text-sm text-muted-foreground">Cleaning Cost</p>
              <p className="text-lg font-semibold">{formatCurrency(result.estimatedCleaningCost)}</p>
            </div>
            <div className="text-center">
              <DollarSign className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="text-sm text-muted-foreground">Total Estimate</p>
              <p className="text-xl font-bold text-primary">{formatCurrency(result.totalEstimate)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Damage Breakdown */}
      {result.damages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Damage Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {result.damages.map((damage, index) => (
                <div key={damage.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-semibold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium capitalize">{damage.type}</p>
                      <p className="text-sm text-muted-foreground">
                        {damage.location} • {damage.severity} severity
                      </p>
                    </div>
                  </div>
                  <p className="font-semibold">{formatCurrency(damage.repairEstimate)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommended Services */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Recommended Services
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3">
            {result.recommendedServices.map((service, index) => (
              <div
                key={index}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedService === service
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50"
                }`}
                onClick={() => setSelectedService(selectedService === service ? null : service)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{service}</p>
                    <p className="text-sm text-muted-foreground">
                      {service.includes("Premium")
                        ? "Comprehensive service with protection"
                        : service.includes("Basic")
                          ? "Essential cleaning and inspection"
                          : "Professional repair and restoration"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {service.includes("Premium")
                        ? formatCurrency(45000)
                        : service.includes("Basic")
                          ? formatCurrency(15000)
                          : formatCurrency(result.estimatedRepairCost)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {service.includes("Premium")
                        ? "4-6 hours"
                        : service.includes("Basic")
                          ? "1-2 hours"
                          : "2-4 hours"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pricing Transparency */}
      <Alert>
        <TrendingUp className="h-4 w-4" />
        <AlertDescription>
          Our AI-powered pricing considers damage severity, vehicle condition, market rates, and service complexity.
          Final pricing may vary based on actual inspection and additional services.
        </AlertDescription>
      </Alert>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={onScheduleService} className="flex-1">
          <Calendar className="h-4 w-4 mr-2" />
          Schedule Service
        </Button>
        <Button variant="outline" className="flex-1 bg-transparent">
          <Clock className="h-4 w-4 mr-2" />
          Get Quote Later
        </Button>
      </div>
    </div>
  )
}
