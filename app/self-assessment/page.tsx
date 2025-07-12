"use client"

import { useState } from "react"
import { useMutation } from "convex/react"
import { useRouter } from "next/navigation"
import { api } from "@/convex/_generated/api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Camera, Scan, Car, CheckCircle, AlertTriangle, DollarSign, Zap } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { VINScanner } from "@/components/vin-scanner"
import { ImageUploader } from "@/components/image-uploader"
import { AssessmentResults } from "@/components/assessment-results"

interface VehicleInfo {
  vin?: string
  make: string
  model: string
  year: number
  color?: string
  mileage?: number
}

interface AssessmentStep {
  id: string
  title: string
  description: string
  completed: boolean
  current: boolean
}

export default function SelfAssessmentPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo>({
    make: "",
    model: "",
    year: new Date().getFullYear(),
  })
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [assessmentId, setAssessmentId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)

  const startAssessment = useMutation(api.selfAssessment.startAssessment)
  const uploadVehicleImages = useMutation(api.selfAssessment.uploadVehicleImages)

  const steps: AssessmentStep[] = [
    {
      id: "vehicle-info",
      title: "Vehicle Information",
      description: "Enter your vehicle details or scan VIN",
      completed: vehicleInfo.make && vehicleInfo.model && vehicleInfo.year > 0,
      current: currentStep === 0,
    },
    {
      id: "image-upload",
      title: "Upload Images",
      description: "Take photos of your vehicle from all angles",
      completed: uploadedImages.length >= 4,
      current: currentStep === 1,
    },
    {
      id: "ai-analysis",
      title: "AI Analysis",
      description: "Our AI analyzes damage and calculates estimates",
      completed: assessmentId !== null,
      current: currentStep === 2,
    },
    {
      id: "results",
      title: "Results & Booking",
      description: "Review estimates and schedule service",
      completed: false,
      current: currentStep === 3,
    },
  ]

  const handleVehicleInfoSubmit = async () => {
    if (!vehicleInfo.make || !vehicleInfo.model || !vehicleInfo.year) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required vehicle details",
        variant: "destructive",
      })
      return
    }

    setCurrentStep(1)
  }

  const handleImagesUploaded = async (imageIds: string[]) => {
    setUploadedImages(imageIds)
    if (imageIds.length >= 4) {
      setCurrentStep(2)
      await processAssessment(imageIds)
    }
  }

  const processAssessment = async (imageIds: string[]) => {
    setIsProcessing(true)
    setProcessingProgress(0)

    try {
      // Simulate processing steps
      const progressSteps = [
        { progress: 20, message: "Analyzing vehicle images..." },
        { progress: 40, message: "Detecting damage areas..." },
        { progress: 60, message: "Calculating severity levels..." },
        { progress: 80, message: "Generating price estimates..." },
        { progress: 100, message: "Assessment complete!" },
      ]

      for (const step of progressSteps) {
        setProcessingProgress(step.progress)
        await new Promise((resolve) => setTimeout(resolve, 1500))
      }

      const result = await startAssessment({
        vehicleInfo,
        imageIds,
        customerInfo: {
          // This would come from auth context in real app
          name: "Demo User",
          email: "demo@example.com",
          phone: "(555) 123-4567",
        },
      })

      setAssessmentId(result.assessmentId)
      setCurrentStep(3)

      toast({
        title: "Assessment Complete",
        description: "Your vehicle assessment has been completed successfully!",
      })
    } catch (error) {
      console.error("Assessment failed:", error)
      toast({
        title: "Assessment Failed",
        description: "There was an error processing your assessment. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleVINScanned = (vinData: any) => {
    setVehicleInfo({
      ...vehicleInfo,
      vin: vinData.vin,
      make: vinData.make,
      model: vinData.model,
      year: vinData.year,
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Vehicle Self-Assessment</h1>
          <p className="text-lg text-gray-600">
            Get an instant AI-powered assessment of your vehicle's condition and repair estimates
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                    step.completed
                      ? "bg-green-500 text-white"
                      : step.current
                        ? "bg-blue-500 text-white"
                        : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {step.completed ? <CheckCircle className="w-5 h-5" /> : index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-16 h-1 mx-2 ${
                      steps[index + 1].completed || steps[index + 1].current ? "bg-blue-500" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900">{steps[currentStep]?.title}</h2>
            <p className="text-gray-600">{steps[currentStep]?.description}</p>
          </div>
        </div>

        {/* Step Content */}
        <Card className="mb-8">
          <CardContent className="p-6">
            {currentStep === 0 && (
              <div className="space-y-6">
                <div className="text-center">
                  <Car className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-semibold mb-2">Tell us about your vehicle</h3>
                  <p className="text-gray-600">Enter vehicle details manually or scan your VIN</p>
                </div>

                <Tabs defaultValue="manual" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="manual">Manual Entry</TabsTrigger>
                    <TabsTrigger value="vin-scan">VIN Scanner</TabsTrigger>
                  </TabsList>

                  <TabsContent value="manual" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="make">Make *</Label>
                        <Input
                          id="make"
                          value={vehicleInfo.make}
                          onChange={(e) => setVehicleInfo({ ...vehicleInfo, make: e.target.value })}
                          placeholder="e.g., Toyota"
                        />
                      </div>
                      <div>
                        <Label htmlFor="model">Model *</Label>
                        <Input
                          id="model"
                          value={vehicleInfo.model}
                          onChange={(e) => setVehicleInfo({ ...vehicleInfo, model: e.target.value })}
                          placeholder="e.g., Camry"
                        />
                      </div>
                      <div>
                        <Label htmlFor="year">Year *</Label>
                        <Input
                          id="year"
                          type="number"
                          value={vehicleInfo.year}
                          onChange={(e) => setVehicleInfo({ ...vehicleInfo, year: Number.parseInt(e.target.value) })}
                          min="1900"
                          max={new Date().getFullYear() + 1}
                        />
                      </div>
                      <div>
                        <Label htmlFor="color">Color</Label>
                        <Input
                          id="color"
                          value={vehicleInfo.color || ""}
                          onChange={(e) => setVehicleInfo({ ...vehicleInfo, color: e.target.value })}
                          placeholder="e.g., Silver"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="mileage">Mileage</Label>
                      <Input
                        id="mileage"
                        type="number"
                        value={vehicleInfo.mileage || ""}
                        onChange={(e) => setVehicleInfo({ ...vehicleInfo, mileage: Number.parseInt(e.target.value) })}
                        placeholder="Current mileage"
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="vin-scan">
                    <VINScanner onVINScanned={handleVINScanned} />
                  </TabsContent>
                </Tabs>

                <Button onClick={handleVehicleInfoSubmit} className="w-full" size="lg">
                  Continue to Image Upload
                </Button>
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="text-center">
                  <Camera className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-semibold mb-2">Upload Vehicle Images</h3>
                  <p className="text-gray-600">
                    Take clear photos from multiple angles. We need at least 4 images for accurate assessment.
                  </p>
                </div>

                <ImageUploader
                  onImagesUploaded={handleImagesUploaded}
                  minImages={4}
                  maxImages={12}
                  vehicleInfo={vehicleInfo}
                />

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                      <Car className="w-6 h-6 text-blue-500" />
                    </div>
                    <p>Front View</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                      <Car className="w-6 h-6 text-blue-500 transform rotate-90" />
                    </div>
                    <p>Side Views</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                      <Car className="w-6 h-6 text-blue-500 transform rotate-180" />
                    </div>
                    <p>Rear View</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                      <AlertTriangle className="w-6 h-6 text-blue-500" />
                    </div>
                    <p>Damage Areas</p>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="text-center">
                  <Zap className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-semibold mb-2">AI Analysis in Progress</h3>
                  <p className="text-gray-600">
                    Our advanced AI is analyzing your vehicle images to detect damage and calculate estimates
                  </p>
                </div>

                <div className="space-y-4">
                  <Progress value={processingProgress} className="w-full" />
                  <div className="text-center">
                    <p className="text-sm text-gray-600">
                      {processingProgress < 20 && "Analyzing vehicle images..."}
                      {processingProgress >= 20 && processingProgress < 40 && "Detecting damage areas..."}
                      {processingProgress >= 40 && processingProgress < 60 && "Calculating severity levels..."}
                      {processingProgress >= 60 && processingProgress < 80 && "Generating price estimates..."}
                      {processingProgress >= 80 && "Assessment complete!"}
                    </p>
                  </div>
                </div>

                {isProcessing && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <Scan className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                      <p className="font-medium">Image Analysis</p>
                      <p className="text-gray-600">Processing {uploadedImages.length} images</p>
                    </div>
                    <div className="text-center p-4 bg-orange-50 rounded-lg">
                      <AlertTriangle className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                      <p className="font-medium">Damage Detection</p>
                      <p className="text-gray-600">Identifying issues</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <DollarSign className="w-8 h-8 text-green-500 mx-auto mb-2" />
                      <p className="font-medium">Price Calculation</p>
                      <p className="text-gray-600">Generating estimates</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentStep === 3 && assessmentId && (
              <AssessmentResults assessmentId={assessmentId} vehicleInfo={vehicleInfo} />
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>Powered by AI • Secure & Private • Instant Results</p>
        </div>
      </div>
    </div>
  )
}
