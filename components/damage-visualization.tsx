"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Eye, ZoomIn, ZoomOut } from "lucide-react"

interface DamageResult {
  id: string
  type: string
  severity: string
  location: string
  boundingBox: {
    x: number
    y: number
    width: number
    height: number
  }
  confidence: number
  repairEstimate: number
  description: string
}

interface UploadedImage {
  file: File
  preview: string
  storageId?: string
}

interface DamageVisualizationProps {
  damages: DamageResult[]
  images: UploadedImage[]
}

const severityColors = {
  minor: "bg-green-500/20 border-green-500",
  moderate: "bg-yellow-500/20 border-yellow-500",
  major: "bg-orange-500/20 border-orange-500",
  severe: "bg-red-500/20 border-red-500",
}

const severityVariants = {
  minor: "default" as const,
  moderate: "secondary" as const,
  major: "destructive" as const,
  severe: "destructive" as const,
}

export function DamageVisualization({ damages, images }: DamageVisualizationProps) {
  const [selectedImage, setSelectedImage] = useState(0)
  const [selectedDamage, setSelectedDamage] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)

  const currentImage = images[selectedImage]
  const imageDamages = damages.filter(
    (d) =>
      // In a real implementation, you'd associate damages with specific images
      true,
  )

  return (
    <div className="space-y-4">
      {/* Image Viewer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Damage Analysis
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm font-mono">{(zoom * 100).toFixed(0)}%</span>
              <Button size="sm" variant="outline" onClick={() => setZoom(Math.min(3, zoom + 0.25))}>
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentImage && (
            <div className="relative overflow-auto max-h-96 border rounded-lg">
              <div
                className="relative inline-block"
                style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
              >
                <img
                  src={currentImage.preview || "/placeholder.svg"}
                  alt="Vehicle damage analysis"
                  className="max-w-full h-auto"
                />

                {/* Damage Bounding Boxes */}
                {imageDamages.map((damage) => (
                  <div
                    key={damage.id}
                    className={`absolute border-2 cursor-pointer transition-all ${
                      severityColors[damage.severity as keyof typeof severityColors]
                    } ${selectedDamage === damage.id ? "border-4 shadow-lg" : "hover:border-4"}`}
                    style={{
                      left: `${damage.boundingBox.x}%`,
                      top: `${damage.boundingBox.y}%`,
                      width: `${damage.boundingBox.width}%`,
                      height: `${damage.boundingBox.height}%`,
                    }}
                    onClick={() => setSelectedDamage(selectedDamage === damage.id ? null : damage.id)}
                  >
                    {/* Damage Label */}
                    <div className="absolute -top-6 left-0 bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                      {damage.type} ({damage.confidence.toFixed(0)}%)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Image Navigation */}
          {images.length > 1 && (
            <div className="flex gap-2 mt-4 overflow-x-auto">
              {images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImage(index)}
                  className={`flex-shrink-0 border-2 rounded-lg overflow-hidden ${
                    index === selectedImage ? "border-primary" : "border-muted-foreground/25"
                  }`}
                >
                  <img
                    src={image.preview || "/placeholder.svg"}
                    alt={`View ${index + 1}`}
                    className="w-16 h-16 object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Damage Details */}
      {selectedDamage && (
        <Card>
          <CardContent className="pt-6">
            {(() => {
              const damage = damages.find((d) => d.id === selectedDamage)
              if (!damage) return null

              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium capitalize">{damage.type} Damage</h3>
                    <Badge variant={severityVariants[damage.severity as keyof typeof severityVariants]}>
                      {damage.severity}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Location</p>
                      <p className="font-medium capitalize">{damage.location}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Confidence</p>
                      <p className="font-medium">{damage.confidence.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Repair Estimate</p>
                      <p className="font-medium">${(damage.repairEstimate / 100).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Severity</p>
                      <p className="font-medium capitalize">{damage.severity}</p>
                    </div>
                  </div>

                  {damage.description && (
                    <div>
                      <p className="text-muted-foreground text-sm">Description</p>
                      <p className="text-sm">{damage.description}</p>
                    </div>
                  )}
                </div>
              )
            })()}
          </CardContent>
        </Card>
      )}

      {/* Damage Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Damage Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {damages.map((damage) => (
              <div
                key={damage.id}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedDamage === damage.id ? "bg-muted" : "hover:bg-muted/50"
                }`}
                onClick={() => setSelectedDamage(selectedDamage === damage.id ? null : damage.id)}
              >
                <div className="flex items-center gap-3">
                  <Badge variant={severityVariants[damage.severity as keyof typeof severityVariants]}>
                    {damage.severity}
                  </Badge>
                  <div>
                    <p className="font-medium capitalize">{damage.type}</p>
                    <p className="text-sm text-muted-foreground capitalize">{damage.location}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">${(damage.repairEstimate / 100).toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">{damage.confidence.toFixed(0)}% confidence</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
