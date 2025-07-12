"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { DollarSign, Calculator, TrendingUp, Clock } from "lucide-react"

interface Damage {
  type: string
  severity: string
  location: string
  estimatedCost: number
}

interface PricingEstimateProps {
  damages: Damage[]
  totalEstimate: number
  vehicleInfo: {
    vehicleMake: string
    vehicleModel: string
    vehicleYear: number
  }
}

export function PricingEstimate({ damages, totalEstimate, vehicleInfo }: PricingEstimateProps) {
  // Group damages by type for better organization
  const damagesByType = damages.reduce(
    (acc, damage) => {
      if (!acc[damage.type]) {
        acc[damage.type] = []
      }
      acc[damage.type].push(damage)
      return acc
    },
    {} as Record<string, Damage[]>,
  )

  // Calculate labor and parts breakdown
  const laborCost = Math.round(totalEstimate * 0.6) // 60% labor
  const partsCost = Math.round(totalEstimate * 0.3) // 30% parts
  const materialsCost = Math.round(totalEstimate * 0.1) // 10% materials

  // Estimate time based on damage complexity
  const estimatedHours = damages.reduce((total, damage) => {
    const baseHours =
      {
        scratch: 1,
        dent: 2,
        chip: 0.5,
        crack: 3,
        stain: 1.5,
        burn: 4,
        tear: 2.5,
      }[damage.type] || 2

    const severityMultiplier =
      {
        minor: 1,
        moderate: 1.5,
        major: 2.5,
        severe: 4,
      }[damage.severity] || 1

    return total + baseHours * severityMultiplier
  }, 0)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Pricing Estimate
          </CardTitle>
          <CardDescription>
            AI-generated estimate for {vehicleInfo.vehicleYear} {vehicleInfo.vehicleMake} {vehicleInfo.vehicleModel}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <DollarSign className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <div className="text-2xl font-bold">${(totalEstimate / 100).toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">Total Estimate</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Clock className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                <div className="text-2xl font-bold">{estimatedHours.toFixed(1)}h</div>
                <div className="text-sm text-muted-foreground">Estimated Time</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 text-orange-500" />
                <div className="text-2xl font-bold">{damages.length}</div>
                <div className="text-sm text-muted-foreground">Repair Items</div>
              </CardContent>
            </Card>
          </div>

          {/* Cost Breakdown */}
          <div className="space-y-4">
            <h4 className="font-semibold">Cost Breakdown</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span>Labor ({estimatedHours.toFixed(1)} hours @ $75/hr)</span>
                <span className="font-medium">${(laborCost / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Parts & Components</span>
                <span className="font-medium">${(partsCost / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Materials & Supplies</span>
                <span className="font-medium">${(materialsCost / 100).toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center text-lg font-semibold">
                <span>Total Estimate</span>
                <span>${(totalEstimate / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Damage-by-Type Breakdown */}
          <div className="space-y-4">
            <h4 className="font-semibold">Repair Items by Type</h4>
            {Object.entries(damagesByType).map(([type, typeDamages]) => {
              const typeCost = typeDamages.reduce((sum, damage) => sum + damage.estimatedCost, 0)
              return (
                <div key={type} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <h5 className="font-medium capitalize">{type} Repairs</h5>
                      <Badge variant="outline">
                        {typeDamages.length} item{typeDamages.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <span className="font-medium text-green-600">${(typeCost / 100).toFixed(2)}</span>
                  </div>
                  <div className="space-y-2">
                    {typeDamages.map((damage, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              damage.severity === "severe" || damage.severity === "major" ? "destructive" : "secondary"
                            }
                            className="text-xs"
                          >
                            {damage.severity}
                          </Badge>
                          <span className="capitalize">{damage.location.replace("_", " ")}</span>
                        </div>
                        <span>${(damage.estimatedCost / 100).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Disclaimer */}
          <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg">
            <strong>Disclaimer:</strong> This is an AI-generated estimate based on image analysis. Final pricing may
            vary based on actual inspection, parts availability, and labor requirements. This estimate is valid for 30
            days and does not include taxes or additional services.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
