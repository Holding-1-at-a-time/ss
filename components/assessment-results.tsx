"use client"

import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { useRouter } from "next/navigation"
import { api } from "@/convex/_generated/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  CheckCircle,
  AlertTriangle,
  DollarSign,
  Clock,
  Calendar,
  MapPin,
  Star,
  TrendingUp,
  FileText,
  Camera,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface AssessmentResultsProps {
  assessmentId: string
  vehicleInfo: any
}

interface DamageItem {
  id: string
  type: string
  severity: "minor" | "moderate" | "major" | "severe"
  location: string
  description: string
  repairCost: number
  confidence: number
  boundingBox?: {
    x: number
    y: number
    width: number
    height: number
  }
}

interface EstimateOption {
  id: string
  title: string
  description: string
  serviceType: "basic" | "standard" | "premium"
  totalCost: number
  laborHours: number
  parts: Array<{
    name: string
    cost: number
  }>
  timeline: string
  warranty: string
  recommended?: boolean
}

export function AssessmentResults({ assessmentId, vehicleInfo }: AssessmentResultsProps) {
  const router = useRouter()
  const [selectedEstimate, setSelectedEstimate] = useState<string | null>(null)

  const assessment = useQuery(api.selfAssessment.getAssessmentResults, {
    assessmentId,
  })

  const createBookingFromEstimate = useMutation(api.bookingWorkflow.createBookingFromEstimate)

  const handleBookService = async (estimateId: string) => {
    try {
      const result = await createBookingFromEstimate({
        assessmentId,
        estimateId,
        customerInfo: {
          name: "Demo User", // Would come from auth context
          email: "demo@example.com",
          phone: "(555) 123-4567",
        },
      })

      toast({
        title: "Booking Created",
        description: "Your service has been scheduled successfully!",
      })

      router.push(`/booking-confirmation/${result.bookingId}`)
    } catch (error) {
      console.error("Booking failed:", error)
      toast({
        title: "Booking Failed",
        description: "There was an error creating your booking. Please try again.",
        variant: "destructive",
      })
    }
  }

  if (!assessment) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    )
  }

  const { damages, estimates, overallCondition, confidence } = assessment

  const severityColors = {
    minor: "bg-green-100 text-green-800",
    moderate: "bg-yellow-100 text-yellow-800",
    major: "bg-orange-100 text-orange-800",
    severe: "bg-red-100 text-red-800",
  }

  const totalDamageCost = damages.reduce((sum: number, damage: DamageItem) => sum + damage.repairCost, 0)

  return (
    <div className="space-y-6">
      {/* Assessment Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                Assessment Complete
              </CardTitle>
              <CardDescription>
                AI analysis of your {vehicleInfo.year} {vehicleInfo.make} {vehicleInfo.model}
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-lg px-3 py-1">
              {confidence}% Confidence
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <AlertTriangle className="w-8 h-8 text-blue-500" />
              </div>
              <div className="text-2xl font-bold">{damages.length}</div>
              <div className="text-sm text-gray-600">Issues Detected</div>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Star className="w-8 h-8 text-green-500" />
              </div>
              <div className="text-2xl font-bold capitalize">{overallCondition}</div>
              <div className="text-sm text-gray-600">Overall Condition</div>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <DollarSign className="w-8 h-8 text-purple-500" />
              </div>
              <div className="text-2xl font-bold">${totalDamageCost.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Est. Repair Cost</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="damages" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="damages">Damage Analysis</TabsTrigger>
          <TabsTrigger value="estimates">Service Estimates</TabsTrigger>
          <TabsTrigger value="images">Analyzed Images</TabsTrigger>
        </TabsList>

        <TabsContent value="damages" className="space-y-4">
          {damages.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Damage Detected</h3>
                <p className="text-gray-600">
                  Great news! Our AI analysis didn't detect any significant damage to your vehicle.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {damages.map((damage: DamageItem) => (
                <Card key={damage.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="text-lg font-semibold capitalize">{damage.type}</h4>
                          <Badge className={severityColors[damage.severity]}>{damage.severity}</Badge>
                          <Badge variant="outline">{damage.confidence}% confidence</Badge>
                        </div>
                        <p className="text-gray-600 mb-2">{damage.description}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {damage.location}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-600">${damage.repairCost.toLocaleString()}</div>
                        <div className="text-sm text-gray-500">Est. Repair</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="estimates" className="space-y-4">
          <div className="grid gap-6">
            {estimates.map((estimate: EstimateOption) => (
              <Card key={estimate.id} className={`relative ${estimate.recommended ? "ring-2 ring-blue-500" : ""}`}>
                {estimate.recommended && (
                  <div className="absolute -top-3 left-6">
                    <Badge className="bg-blue-500">
                      <Star className="w-3 h-3 mr-1" />
                      Recommended
                    </Badge>
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {estimate.title}
                        <Badge variant="outline" className="capitalize">
                          {estimate.serviceType}
                        </Badge>
                      </CardTitle>
                      <CardDescription>{estimate.description}</CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-green-600">${estimate.totalCost.toLocaleString()}</div>
                      <div className="text-sm text-gray-500">Total Cost</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span className="text-sm">
                        {estimate.laborHours} hours • {estimate.timeline}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-gray-500" />
                      <span className="text-sm">{estimate.warranty} warranty</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-gray-500" />
                      <span className="text-sm">Professional service</span>
                    </div>
                  </div>

                  {estimate.parts.length > 0 && (
                    <div className="mb-6">
                      <h5 className="font-semibold mb-2">Parts & Materials:</h5>
                      <div className="space-y-1">
                        {estimate.parts.map((part, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span>{part.name}</span>
                            <span>${part.cost.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={() => handleBookService(estimate.id)}
                    className="w-full"
                    size="lg"
                    variant={estimate.recommended ? "default" : "outline"}
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Book This Service
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="images" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assessment.analyzedImages?.map((image: any, index: number) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="aspect-square relative mb-3">
                    <img
                      src={image.url || "/placeholder.svg"}
                      alt={`Analysis ${index + 1}`}
                      className="w-full h-full object-cover rounded"
                    />
                    {image.damages?.length > 0 && (
                      <div className="absolute top-2 right-2">
                        <Badge variant="destructive">
                          {image.damages.length} issue{image.damages.length !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium">Analysis {index + 1}</span>
                    </div>
                    {image.damages?.map((damage: any, damageIndex: number) => (
                      <div key={damageIndex} className="text-xs text-gray-600">
                        • {damage.type} ({damage.severity}) - ${damage.cost}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Next Steps */}
      <Alert>
        <FileText className="h-4 w-4" />
        <AlertDescription>
          <strong>Next Steps:</strong> Select a service estimate above to schedule your appointment. Our team will
          contact you within 24 hours to confirm details and answer any questions.
        </AlertDescription>
      </Alert>
    </div>
  )
}
