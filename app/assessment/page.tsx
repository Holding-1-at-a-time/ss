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
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import { ProtectedLayout } from "@/components/protected-layout"
import { VINScanner } from "@/components/vin-scanner"
import { DamageVisualization } from "@/components/damage-visualization"
import { EstimateDisplay } from "@/components/estimate-display"
import { Upload, Camera, Scan, CheckCircle, Loader2, Car, DollarSign } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { api } from "../../../convex/_generated/api"

const assessmentSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email("Valid email is required"),
  customerPhone: z.string().min(10, "Phone number is required"),
  vehicleVin: z.string().min(17, "VIN must be 17 characters").max(17),
  vehicleMake: z.string().min(1, "Vehicle make is required"),
  vehicleModel: z.string().min(1, "Vehicle model is required"),
  vehicleYear: z
    .number()
    .min(1900)
    .max(new Date().getFullYear() + 1),
  notes: z.string().optional(),
})

type AssessmentFormData = z.infer<typeof assessmentSchema>

interface UploadedImage {
  file: File
  preview: string
  storageId?: string
}

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

interface AssessmentResult {
  inspectionId: string
  damages: DamageResult[]
  overallCondition: string
  filthinessScore: number
  estimatedRepairCost: number
  estimatedCleaningCost: number
  totalEstimate: number
  recommendedServices: string[]
}

export default function VehicleAssessmentPage() {
  const [images, setImages] = useState<UploadedImage[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [assessmentResult, setAssessmentResult] = useState<AssessmentResult | null>(null)
  const [vinScannerOpen, setVinScannerOpen] = useState(false)
  const [processingStep, setProcessingStep] = useState("")
  const [progress, setProgress] = useState(0)

  const generateFileUrl = useMutation(api.files.generateUploadUrl)
  const startAssessment = useMutation(api.aiAgent.startVehicleAssessment)

  const form = useForm<AssessmentFormData>({
    resolver: zodResolver(assessmentSchema),
    defaultValues: {
      vehicleYear: new Date().getFullYear(),
    },
  })

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setIsUploading(true)

      try {
        const newImages: UploadedImage[] = []

        for (const file of acceptedFiles) {
          // Generate upload URL
          const uploadUrl = await generateFileUrl()

          // Upload file to Convex
          const result = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": file.type },
            body: file,
          })

          const { storageId } = await result.json()

          newImages.push({
            file,
            preview: URL.createObjectURL(file),
            storageId,
          })
        }

        setImages((prev) => [...prev, ...newImages])
        toast({
          title: "Images uploaded successfully",
          description: `${newImages.length} image(s) ready for assessment`,
        })
      } catch (error) {
        toast({
          title: "Upload failed",
          description: "Failed to upload images. Please try again.",
          variant: "destructive",
        })
      } finally {
        setIsUploading(false)
      }
    },
    [generateFileUrl],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpeg", ".jpg", ".png", ".webp"],
    },
    maxFiles: 10,
  })

  const handleVinScanned = (vinData: any) => {
    form.setValue("vehicleVin", vinData.vin)
    form.setValue("vehicleMake", vinData.make)
    form.setValue("vehicleModel", vinData.model)
    form.setValue("vehicleYear", vinData.year)
    setVinScannerOpen(false)

    toast({
      title: "VIN scanned successfully",
      description: `${vinData.year} ${vinData.make} ${vinData.model}`,
    })
  }

  const onSubmit = async (data: AssessmentFormData) => {
    if (images.length === 0) {
      toast({
        title: "Images required",
        description: "Please upload at least one image for assessment",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)
    setProgress(0)

    try {
      setProcessingStep("Creating inspection record...")
      setProgress(20)

      const imageStorageIds = images.map((img) => img.storageId).filter(Boolean) as string[]

      setProcessingStep("Analyzing images with AI...")
      setProgress(40)

      const result = await startAssessment({
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
        imageStorageIds,
        notes: data.notes,
      })

      setProcessingStep("Generating estimates...")
      setProgress(80)

      // Wait for processing to complete
      await new Promise((resolve) => setTimeout(resolve, 2000))

      setProcessingStep("Assessment complete!")
      setProgress(100)

      setAssessmentResult(result as AssessmentResult)

      toast({
        title: "Assessment completed",
        description: "Vehicle assessment has been processed successfully",
      })
    } catch (error) {
      toast({
        title: "Assessment failed",
        description: error instanceof Error ? error.message : "Failed to process assessment",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
      setProcessingStep("")
      setProgress(0)
    }
  }

  const removeImage = (index: number) => {
    setImages((prev) => {
      const newImages = [...prev]
      URL.revokeObjectURL(newImages[index].preview)
      newImages.splice(index, 1)
      return newImages
    })
  }

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Vehicle Assessment</h1>
            <p className="text-muted-foreground">AI-powered damage detection and pricing estimation</p>
          </div>
          <Button variant="outline" onClick={() => setVinScannerOpen(true)} className="flex items-center gap-2">
            <Scan className="h-4 w-4" />
            Scan VIN
          </Button>
        </div>

        {/* Processing Status */}
        {isProcessing && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm font-medium">{processingStep}</span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Assessment Result */}
        {assessmentResult && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DamageVisualization damages={assessmentResult.damages} images={images} />
            <EstimateDisplay
              result={assessmentResult}
              onScheduleService={() => {
                // Navigate to scheduling
                window.location.href = `/bookings?inspectionId=${assessmentResult.inspectionId}`
              }}
            />
          </div>
        )}

        {/* Assessment Form */}
        {!assessmentResult && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Image Upload */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Vehicle Images
                </CardTitle>
                <CardDescription>Upload clear images of your vehicle from multiple angles</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Dropzone */}
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
                  {isDragActive ? (
                    <p>Drop the images here...</p>
                  ) : (
                    <div>
                      <p className="text-sm font-medium">Click to upload or drag and drop</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        PNG, JPG, WEBP up to 10MB each (max 10 files)
                      </p>
                    </div>
                  )}
                </div>

                {/* Loading State */}
                {isUploading && (
                  <div className="flex items-center gap-2 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading images...
                  </div>
                )}

                {/* Image Previews */}
                {images.length > 0 && (
                  <div className="grid grid-cols-2 gap-4">
                    {images.map((image, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={image.preview || "/placeholder.svg"}
                          alt={`Upload ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeImage(index)}
                        >
                          ×
                        </Button>
                        {image.storageId && (
                          <Badge variant="secondary" className="absolute bottom-2 left-2">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Uploaded
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Vehicle & Customer Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Car className="h-5 w-5" />
                  Vehicle & Customer Information
                </CardTitle>
                <CardDescription>Enter vehicle and customer details for the assessment</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    {/* Customer Info */}
                    <div className="space-y-4">
                      <h4 className="font-medium">Customer Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="customerName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Name</FormLabel>
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
                      </div>
                      <FormField
                        control={form.control}
                        name="customerPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone</FormLabel>
                            <FormControl>
                              <Input {...field} type="tel" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Vehicle Info */}
                    <div className="space-y-4">
                      <h4 className="font-medium">Vehicle Information</h4>
                      <FormField
                        control={form.control}
                        name="vehicleVin"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>VIN</FormLabel>
                            <FormControl>
                              <Input {...field} maxLength={17} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    </div>

                    {/* Notes */}
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Additional Notes</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              rows={3}
                              placeholder="Any additional information about the vehicle condition..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Submit Button */}
                    <Button type="submit" className="w-full" disabled={isProcessing || images.length === 0}>
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing Assessment...
                        </>
                      ) : (
                        <>
                          <DollarSign className="h-4 w-4 mr-2" />
                          Start AI Assessment
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* VIN Scanner Modal */}
        <VINScanner isOpen={vinScannerOpen} onClose={() => setVinScannerOpen(false)} onVinScanned={handleVinScanned} />
      </div>
    </ProtectedLayout>
  )
}
