"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { useMutation } from "convex/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import {
  Upload,
  Camera,
  Car,
  Scan,
  CheckCircle,
  AlertTriangle,
  DollarSign,
  Clock,
  FileImage,
  Loader2,
  Download,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { api } from "@/convex/_generated/api"
import { VINScanner } from "@/components/vin-scanner"
import { DamageAnnotation } from "@/components/damage-annotation"
import { PricingEstimate } from "@/components/pricing-estimate"
import { Calendar } from "lucide-react"

const assessmentSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email("Invalid email address"),
  customerPhone: z.string().min(10, "Phone number is required"),
  vehicleVin: z.string().optional(),
  vehicleMake: z.string().min(1, "Vehicle make is required"),
  vehicleModel: z.string().min(1, "Vehicle model is required"),
  vehicleYear: z
    .number()
    .min(1900)
    .max(new Date().getFullYear() + 1),
})

type AssessmentFormData = z.infer<typeof assessmentSchema>

interface UploadedImage {
  id: string
  file: File
  preview: string
  status: "uploading" | "processing" | "completed" | "error"
  analysis?: {
    damages: Array<{
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
    }>
    overallCondition: string
    estimatedTotal: number
  }
}

export default function VehicleAssessmentPage() {
  const [images, setImages] = useState<UploadedImage[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [assessmentId, setAssessmentId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const createAssessment = useMutation(api.vehicleAssessment.createAssessment)
  const uploadImage = useMutation(api.vehicleAssessment.uploadAssessmentImage)
  const processImages = useMutation(api.vehicleAssessment.processImagesWithAI)

  const form = useForm<AssessmentFormData>({
    resolver: zodResolver(assessmentSchema),
    defaultValues: {
      vehicleYear: new Date().getFullYear(),
    },
  })

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const newImages: UploadedImage[] = acceptedFiles.map((file) => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        preview: URL.createObjectURL(file),
        status: "uploading",
      }))

      setImages((prev) => [...prev, ...newImages])

      // Upload images to Convex
      for (const image of newImages) {
        try {
          const uploadResult = await uploadImage({
            file: image.file,
            assessmentId: assessmentId || undefined,
          })

          setImages((prev) =>
            prev.map((img) => (img.id === image.id ? { ...img, status: "processing", id: uploadResult.fileId } : img)),
          )
        } catch (error) {
          console.error("Upload failed:", error)
          setImages((prev) => prev.map((img) => (img.id === image.id ? { ...img, status: "error" } : img)))
          toast({
            title: "Upload Failed",
            description: "Failed to upload image. Please try again.",
            variant: "destructive",
          })
        }
      }
    },
    [uploadImage, assessmentId],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpeg", ".jpg", ".png", ".webp"],
    },
    maxFiles: 10,
    maxSize: 10 * 1024 * 1024, // 10MB
  })

  const handleVINDetected = (vinData: any) => {
    form.setValue("vehicleVin", vinData.vin)
    form.setValue("vehicleMake", vinData.make)
    form.setValue("vehicleModel", vinData.model)
    form.setValue("vehicleYear", vinData.year)
    toast({
      title: "VIN Detected",
      description: `Vehicle information auto-filled: ${vinData.year} ${vinData.make} ${vinData.model}`,
    })
  }

  const onSubmit = async (data: AssessmentFormData) => {
    try {
      setIsProcessing(true)

      // Create assessment record
      const assessment = await createAssessment({
        customerInfo: {
          name: data.customerName,
          email: data.customerEmail,
          phone: data.customerPhone,
        },
        vehicleInfo: {
          vin: data.vehicleVin,
          make: data.vehicleMake,
          model: data.vehicleModel,
          year: data.vehicleYear,
        },
        imageIds: images.filter((img) => img.status === "processing").map((img) => img.id),
      })

      setAssessmentId(assessment.assessmentId)

      // Process images with AI
      const analysisResult = await processImages({
        assessmentId: assessment.assessmentId,
        imageIds: images.filter((img) => img.status === "processing").map((img) => img.id),
      })

      // Update images with analysis results
      setImages((prev) =>
        prev.map((img) => {
          const analysis = analysisResult.imageAnalyses.find((a) => a.imageId === img.id)
          return analysis ? { ...img, status: "completed", analysis: analysis.analysis } : img
        }),
      )

      setCurrentStep(2) // Move to results step

      toast({
        title: "Assessment Complete",
        description: `Found ${analysisResult.totalDamages} damages with estimated cost of $${(analysisResult.totalEstimate / 100).toFixed(2)}`,
      })
    } catch (error) {
      console.error("Assessment failed:", error)
      toast({
        title: "Assessment Failed",
        description: "Failed to process vehicle assessment. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const steps = [
    { id: 0, title: "Vehicle Info", icon: Car },
    { id: 1, title: "Photo Upload", icon: Camera },
    { id: 2, title: "AI Analysis", icon: Scan },
    { id: 3, title: "Results", icon: CheckCircle },
  ]

  const totalEstimate = images
    .filter((img) => img.analysis)
    .reduce((sum, img) => sum + (img.analysis?.estimatedTotal || 0), 0)

  const totalDamages = images
    .filter((img) => img.analysis)
    .reduce((sum, img) => sum + (img.analysis?.damages.length || 0), 0)

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">Vehicle Self-Assessment</h1>
        <p className="text-xl text-muted-foreground">
          Upload photos of your vehicle for AI-powered damage detection and instant pricing
        </p>
      </div>

      {/* Progress Steps */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium">
              Step {currentStep + 1} of {steps.length}
            </span>
            <span className="text-sm text-muted-foreground">
              {Math.round(((currentStep + 1) / steps.length) * 100)}% Complete
            </span>
          </div>
          <Progress value={((currentStep + 1) / steps.length) * 100} className="mb-4" />
          <div className="flex justify-between">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-center gap-2 ${index <= currentStep ? "text-primary" : "text-muted-foreground"}`}
              >
                <step.icon className="h-4 w-4" />
                <span className="text-sm font-medium hidden sm:inline">{step.title}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      {currentStep === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5" />
              Vehicle Information
            </CardTitle>
            <CardDescription>Enter your vehicle details or scan your VIN for automatic detection</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <VINScanner onVINDetected={handleVINDetected} />

            <Separator />

            <Form {...form}>
              <form onSubmit={form.handleSubmit(() => setCurrentStep(1))} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="customerEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="customerPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input {...field} type="tel" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="vehicleVin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>VIN (Optional)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="17-character VIN" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="vehicleMake"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Make</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="vehicleModel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="vehicleYear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Year</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            onChange={(e) => field.onChange(Number.parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="submit" className="w-full">
                  Continue to Photo Upload
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Upload Vehicle Photos
            </CardTitle>
            <CardDescription>
              Upload clear photos of your vehicle from multiple angles for accurate damage detection
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Upload Area */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Upload Vehicle Photos</h3>
                <p className="text-muted-foreground">Drag and drop photos here, or click to select files</p>
                <p className="text-sm text-muted-foreground">
                  Supports JPEG, PNG, WebP up to 10MB each (max 10 photos)
                </p>
              </div>
            </div>

            {/* Photo Guidelines */}
            <Alert>
              <Camera className="h-4 w-4" />
              <AlertDescription>
                <strong>Photo Tips:</strong> Take clear photos from front, back, sides, and any damaged areas. Good
                lighting and multiple angles help our AI provide more accurate assessments.
              </AlertDescription>
            </Alert>

            {/* Uploaded Images */}
            {images.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Uploaded Photos ({images.length})</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {images.map((image) => (
                    <div key={image.id} className="relative">
                      <img
                        src={image.preview || "/placeholder.svg"}
                        alt="Vehicle"
                        className="w-full h-32 object-cover rounded-lg border"
                      />
                      <div className="absolute top-2 right-2">
                        {image.status === "uploading" && (
                          <Badge variant="secondary" className="text-xs">
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Uploading
                          </Badge>
                        )}
                        {image.status === "processing" && (
                          <Badge variant="secondary" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            Processing
                          </Badge>
                        )}
                        {image.status === "completed" && (
                          <Badge variant="default" className="text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Complete
                          </Badge>
                        )}
                        {image.status === "error" && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Error
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {images.length > 0 && (
              <Button
                onClick={form.handleSubmit(onSubmit)}
                disabled={isProcessing || images.some((img) => img.status === "uploading")}
                className="w-full"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing with AI...
                  </>
                ) : (
                  <>
                    <Scan className="h-4 w-4 mr-2" />
                    Start AI Analysis
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scan className="h-5 w-5" />
              AI Analysis Results
            </CardTitle>
            <CardDescription>Our AI has analyzed your vehicle photos and detected the following</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-orange-500" />
                  <div className="text-2xl font-bold">{totalDamages}</div>
                  <div className="text-sm text-muted-foreground">Damages Found</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <DollarSign className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <div className="text-2xl font-bold">${(totalEstimate / 100).toFixed(2)}</div>
                  <div className="text-sm text-muted-foreground">Estimated Cost</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <FileImage className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                  <div className="text-2xl font-bold">{images.length}</div>
                  <div className="text-sm text-muted-foreground">Photos Analyzed</div>
                </CardContent>
              </Card>
            </div>

            {/* Damage Analysis */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Detected Damages</h3>
              {images
                .filter((img) => img.analysis && img.analysis.damages.length > 0)
                .map((image, index) => (
                  <DamageAnnotation
                    key={image.id}
                    imageUrl={image.preview}
                    damages={image.analysis!.damages}
                    title={`Photo ${index + 1}`}
                  />
                ))}
            </div>

            {/* Pricing Breakdown */}
            <PricingEstimate
              damages={images.flatMap((img) => img.analysis?.damages || [])}
              totalEstimate={totalEstimate}
              vehicleInfo={form.getValues()}
            />

            <div className="flex gap-4">
              <Button onClick={() => setCurrentStep(3)} className="flex-1">
                View Full Report
              </Button>
              <Button variant="outline" onClick={() => setCurrentStep(1)} className="flex-1">
                Upload More Photos
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 3 && assessmentId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Assessment Complete
            </CardTitle>
            <CardDescription>
              Your vehicle assessment is ready. Schedule a service or download your report.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Assessment ID: <strong>{assessmentId}</strong> - Save this for your records
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Button size="lg" className="h-16">
                <Calendar className="h-5 w-5 mr-2" />
                Schedule Service Appointment
              </Button>
              <Button variant="outline" size="lg" className="h-16 bg-transparent">
                <Download className="h-5 w-5 mr-2" />
                Download Assessment Report
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
