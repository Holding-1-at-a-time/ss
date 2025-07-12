"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Eye, EyeOff, DollarSign } from "lucide-react"

interface Damage {
  type: string
  severity: string
  location: string
  confidence: number
  boundingBox: {
    x: number
    y: number
    width: number
    height: number
  }
  estimatedCost: number
}

interface DamageAnnotationProps {
  imageUrl: string
  damages: Damage[]
  title: string
}

export function DamageAnnotation({ imageUrl, damages, title }: DamageAnnotationProps) {
  const [showAnnotations, setShowAnnotations] = useState(true)
  const [selectedDamage, setSelectedDamage] = useState<Damage | null>(null)

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "minor":
        return "bg-yellow-500"
      case "moderate":
        return "bg-orange-500"
      case "major":
        return "bg-red-500"
      case "severe":
        return "bg-red-700"
      default:
        return "bg-gray-500"
    }
  }

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "minor":
        return "secondary"
      case "moderate":
        return "default"
      case "major":
        return "destructive"
      case "severe":
        return "destructive"
      default:
        return "outline"
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            {title}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowAnnotations(!showAnnotations)}>
            {showAnnotations ? (
              <>
                <EyeOff className="h-4 w-4 mr-2" />
                Hide Annotations
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Show Annotations
              </>
            )}
          </Button>
        </div>
        <CardDescription>
          {damages.length} damage{damages.length !== 1 ? "s" : ""} detected with AI confidence
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Annotated Image */}
        <div className="relative">
          <img
            src={imageUrl || "/placeholder.svg"}
            alt="Vehicle damage analysis"
            className="w-full h-auto rounded-lg border"
          />

          {/* Damage Bounding Boxes */}
          {showAnnotations &&
            damages.map((damage, index) => (
              <div
                key={index}
                className={`absolute border-2 cursor-pointer transition-all ${
                  selectedDamage === damage ? "border-primary border-4 shadow-lg" : `border-white shadow-md`
                }`}
                style={{
                  left: `${damage.boundingBox.x * 100}%`,
                  top: `${damage.boundingBox.y * 100}%`,
                  width: `${damage.boundingBox.width * 100}%`,
                  height: `${damage.boundingBox.height * 100}%`,
                }}
                onClick={() => setSelectedDamage(selectedDamage === damage ? null : damage)}
              >
                {/* Damage Label */}
                <div
                  className={`absolute -top-6 left-0 px-2 py-1 rounded text-xs font-medium text-white ${getSeverityColor(damage.severity)}`}
                >
                  {index + 1}
                </div>

                {/* Damage Overlay */}
                <div className={`w-full h-full ${getSeverityColor(damage.severity)} opacity-20`} />
              </div>
            ))}
        </div>

        {/* Damage List */}
        <div className="space-y-3">
          <h4 className="font-semibold">Detected Damages</h4>
          {damages.map((damage, index) => (
            <div
              key={index}
              className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                selectedDamage === damage ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
              }`}
              onClick={() => setSelectedDamage(selectedDamage === damage ? null : damage)}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">#{index + 1}</span>
                    <Badge variant={getSeverityBadgeVariant(damage.severity)}>{damage.severity}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {(damage.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium capitalize">{damage.type}</span> on{" "}
                    <span className="capitalize">{damage.location.replace("_", " ")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-green-600 font-medium">
                  <DollarSign className="h-4 w-4" />
                  {(damage.estimatedCost / 100).toFixed(2)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Selected Damage Details */}
        {selectedDamage && (
          <Card className="border-primary">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Damage Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-medium">Type:</span> {selectedDamage.type}
                </div>
                <div>
                  <span className="font-medium">Severity:</span> {selectedDamage.severity}
                </div>
                <div>
                  <span className="font-medium">Location:</span> {selectedDamage.location.replace("_", " ")}
                </div>
                <div>
                  <span className="font-medium">Confidence:</span> {(selectedDamage.confidence * 100).toFixed(0)}%
                </div>
                <div>
                  <span className="font-medium">Estimated Cost:</span> $
                  {(selectedDamage.estimatedCost / 100).toFixed(2)}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  )
}
