"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useAuthContext } from "@/lib/auth-context"
import { ProtectedLayout } from "@/components/protected-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import {
  Car,
  Camera,
  MapPin,
  AlertTriangle,
  CheckCircle,
  Upload,
  Save,
  Send,
  ArrowLeft,
  ArrowRight,
  Eye,
  Trash2,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"

// Validation schemas
const vehicleInfoSchema = z.object({
  vehicleVin: z.string().min(17, "VIN must be 17 characters").max(17),
  vehicleMake: z.string().min(1, "Make is required"),
  vehicleModel: z.string().min(1, "Model is required"),
  vehicleYear: z
    .number()
    .min(1900)
    .max(new Date().getFullYear() + 1),
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email("Invalid email address"),
  customerPhone: z.string().min(10, "Phone number is required"),
  notes: z.string().optional(),
})

const damageAnnotationSchema = z.object({
  damages: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["scratch", "dent", "chip", "crack", "stain", "burn", "tear", "other"]),
      severity: z.enum(["minor", "moderate", "major", "severe"]),
      location: z.string(),
      description: z.string(),
      boundingBox: z.object({
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        width: z.number().min(0).max(1),
        height: z.number().min(0).max(1),
      }),
      photoFileId: z.string(),
    }),
  ),
})

const filthinessSchema = z.object({
  filthinessScore: z.number().min(0).max(100),
  filthinessZoneScores: z.object({
    exterior: z.number().min(0).max(100),
    interior: z.number().min(0).max(100),
    engine: z.number().min(0).max(100),
    undercarriage: z.number().min(0).max(100),
  }),
  filthinessNotes: z.string().optional(),
})

const photoSchema = z.object({
  photos: z.array(z.string()),
})

const reviewSchema = z.object({
  overallCondition: z.enum(["excellent", "good", "fair", "poor"]),
  finalNotes: z.string().optional(),
})

type InspectionFormData = z.infer<typeof vehicleInfoSchema> &
  z.infer<typeof damageAnnotationSchema> &
  z.infer<typeof filthinessSchema> &
  z.infer<typeof photoSchema> &
  z.infer<typeof reviewSchema>

interface Damage {
  id: string
  type: string
  severity: string
  location: string
  description: string
  boundingBox: {
    x: number
    y: number
    width: number
    height: number
  }
  photoFileId: string
}

const steps = [
  { id: "vehicle", title: "Vehicle Info", icon: Car },
  { id: "damage", title: "Damage Annotation", icon: MapPin },
  { id: "filthiness", title: "Filthiness Scoring", icon: AlertTriangle },
  { id: "photos", title: "Photo Capture", icon: Camera },
  { id: "review", title: "Review & Submit", icon: CheckCircle },
]

export default function InspectionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuthContext()
  const queryClient = useQueryClient()
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [annotationMode, setAnnotationMode] = useState(false)

  const methods = useForm<InspectionFormData>({
    resolver: zodResolver(
      vehicleInfoSchema.merge(damageAnnotationSchema).merge(filthinessSchema).merge(photoSchema).merge(reviewSchema),
    ),
    defaultValues: {
      damages: [],
      photos: [],
      filthinessZoneScores: {
        exterior: 0,
        interior: 0,
        engine: 0,
        undercarriage: 0,
      },
    },
  })

  // Fetch inspection data
  const {
    data: inspection,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["inspection", params.id],
    queryFn: async () => {
      const response = await fetch(`/api/inspections/${params.id}`)
      if (!response.ok) throw new Error("Failed to fetch inspection")
      return response.json()
    },
    enabled: !!params.id,
  })

  // Update inspection mutation
  const updateInspectionMutation = useMutation({
    mutationFn: async (data: Partial<InspectionFormData>) => {
      const response = await fetch(`/api/inspections/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error("Failed to update inspection")
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inspection", params.id] })
      toast({
        title: "Success",
        description: "Inspection updated successfully",
      })
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  // File upload mutation
  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("inspectionId", params.id as string)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })
      if (!response.ok) throw new Error("Failed to upload file")
      return response.json()
    },
    onSuccess: (data) => {
      const currentPhotos = methods.getValues("photos")
      methods.setValue("photos", [...currentPhotos, data.fileId])
      toast({
        title: "Success",
        description: "Photo uploaded successfully",
      })
    },
  })

  // Initialize form with inspection data
  useEffect(() => {
    if (inspection) {
      methods.reset({
        vehicleVin: inspection.vehicleVin,
        vehicleMake: inspection.vehicleMake,
        vehicleModel: inspection.vehicleModel,
        vehicleYear: inspection.vehicleYear,
        customerName: inspection.customerName,
        customerEmail: inspection.customerEmail,
        customerPhone: inspection.customerPhone,
        notes: inspection.notes,
        damages: inspection.damages || [],
        filthinessScore: inspection.filthinessScore || 0,
        filthinessZoneScores: inspection.filthinessZoneScores || {
          exterior: 0,
          interior: 0,
          engine: 0,
          undercarriage: 0,
        },
        filthinessNotes: inspection.filthinessNotes,
        photos: inspection.photos || [],
        overallCondition: inspection.overallCondition,
        finalNotes: inspection.finalNotes,
      })
    }
  }, [inspection, methods])

  const onSubmit = async (data: InspectionFormData) => {
    await updateInspectionMutation.mutateAsync(data)
  }

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      uploadFileMutation.mutate(file)
    }
  }

  const addDamageAnnotation = (boundingBox: { x: number; y: number; width: number; height: number }) => {
    if (!selectedPhoto) return

    const newDamage: Damage = {
      id: `damage-${Date.now()}`,
      type: "scratch",
      severity: "minor",
      location: "unknown",
      description: "",
      boundingBox,
      photoFileId: selectedPhoto,
    }

    const currentDamages = methods.getValues("damages")
    methods.setValue("damages", [...currentDamages, newDamage])
    setAnnotationMode(false)
  }

  const removeDamage = (damageId: string) => {
    const currentDamages = methods.getValues("damages")
    methods.setValue(
      "damages",
      currentDamages.filter((d) => d.id !== damageId),
    )
  }

  if (isLoading) {
    return (
      <ProtectedLayout>
        <InspectionDetailSkeleton />
      </ProtectedLayout>
    )
  }

  if (error) {
    return (
      <ProtectedLayout>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Failed to load inspection details. Please try again.</AlertDescription>
        </Alert>
      </ProtectedLayout>
    )
  }

  return (
    <ProtectedLayout>
      <FormProvider {...methods}>
        <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button type="button" variant="ghost" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Inspection Details</h1>
                <p className="text-muted-foreground">
                  {inspection?.vehicleYear} {inspection?.vehicleMake} {inspection?.vehicleModel}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{inspection?.status?.replace("_", " ").toUpperCase()}</Badge>
              <Button type="submit" disabled={updateInspectionMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>

          {/* Progress */}
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
                    className={`flex items-center gap-2 ${
                      index <= currentStep ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <step.icon className="h-4 w-4" />
                    <span className="text-sm font-medium hidden sm:inline">{step.title}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Step Content */}
          <Tabs value={steps[currentStep].id} className="space-y-6">
            {/* Vehicle Info Step */}
            <TabsContent value="vehicle">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Car className="h-5 w-5" />
                    Vehicle Information
                  </CardTitle>
                  <CardDescription>Enter or verify the vehicle and customer details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={methods.control}
                      name="vehicleVin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>VIN</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="17-character VIN" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={methods.control}
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
                    <FormField
                      control={methods.control}
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
                      control={methods.control}
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
                      control={methods.control}
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
                      control={methods.control}
                      name="customerEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Customer Email</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={methods.control}
                      name="customerPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Customer Phone</FormLabel>
                          <FormControl>
                            <Input {...field} type="tel" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={methods.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={3} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Damage Annotation Step */}
            <TabsContent value="damage">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Damage Annotation
                  </CardTitle>
                  <CardDescription>Mark damage locations on vehicle photos</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Photo Selection */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {methods.watch("photos").map((photoId) => (
                      <div
                        key={photoId}
                        className={`relative aspect-square border-2 rounded-lg cursor-pointer ${
                          selectedPhoto === photoId ? "border-primary" : "border-muted"
                        }`}
                        onClick={() => setSelectedPhoto(photoId)}
                      >
                        <img
                          src={`/api/files/${photoId}`}
                          alt="Vehicle"
                          className="w-full h-full object-cover rounded-lg"
                        />
                        {selectedPhoto === photoId && (
                          <div className="absolute inset-0 bg-primary/20 rounded-lg flex items-center justify-center">
                            <Eye className="h-6 w-6 text-primary" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Annotation Interface */}
                  {selectedPhoto && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Annotate Damage</h3>
                        <Button
                          type="button"
                          variant={annotationMode ? "destructive" : "default"}
                          onClick={() => setAnnotationMode(!annotationMode)}
                        >
                          {annotationMode ? "Cancel" : "Add Damage"}
                        </Button>
                      </div>

                      {/* Interactive Photo with Bounding Boxes */}
                      <div className="relative">
                        <img
                          src={`/api/files/${selectedPhoto}`}
                          alt="Vehicle for annotation"
                          className="w-full max-w-2xl mx-auto border rounded-lg"
                          onClick={(e) => {
                            if (annotationMode) {
                              const rect = e.currentTarget.getBoundingClientRect()
                              const x = (e.clientX - rect.left) / rect.width
                              const y = (e.clientY - rect.top) / rect.height
                              addDamageAnnotation({
                                x: x - 0.05,
                                y: y - 0.05,
                                width: 0.1,
                                height: 0.1,
                              })
                            }
                          }}
                        />

                        {/* Render existing damage annotations */}
                        {methods
                          .watch("damages")
                          .filter((damage) => damage.photoFileId === selectedPhoto)
                          .map((damage) => (
                            <div
                              key={damage.id}
                              className="absolute border-2 border-red-500 bg-red-500/20"
                              style={{
                                left: `${damage.boundingBox.x * 100}%`,
                                top: `${damage.boundingBox.y * 100}%`,
                                width: `${damage.boundingBox.width * 100}%`,
                                height: `${damage.boundingBox.height * 100}%`,
                              }}
                            >
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="absolute -top-2 -right-2 h-6 w-6 p-0"
                                onClick={() => removeDamage(damage.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                      </div>

                      {/* Damage List */}
                      <div className="space-y-2">
                        <h4 className="font-medium">Detected Damages</h4>
                        {methods
                          .watch("damages")
                          .filter((damage) => damage.photoFileId === selectedPhoto)
                          .map((damage, index) => (
                            <div key={damage.id} className="flex items-center gap-4 p-3 border rounded-lg">
                              <span className="text-sm font-medium">#{index + 1}</span>
                              <Select
                                value={damage.type}
                                onValueChange={(value) => {
                                  const damages = methods.getValues("damages")
                                  const updatedDamages = damages.map((d) =>
                                    d.id === damage.id ? { ...d, type: value } : d,
                                  )
                                  methods.setValue("damages", updatedDamages)
                                }}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="scratch">Scratch</SelectItem>
                                  <SelectItem value="dent">Dent</SelectItem>
                                  <SelectItem value="chip">Chip</SelectItem>
                                  <SelectItem value="crack">Crack</SelectItem>
                                  <SelectItem value="stain">Stain</SelectItem>
                                  <SelectItem value="burn">Burn</SelectItem>
                                  <SelectItem value="tear">Tear</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                              <Select
                                value={damage.severity}
                                onValueChange={(value) => {
                                  const damages = methods.getValues("damages")
                                  const updatedDamages = damages.map((d) =>
                                    d.id === damage.id ? { ...d, severity: value } : d,
                                  )
                                  methods.setValue("damages", updatedDamages)
                                }}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="minor">Minor</SelectItem>
                                  <SelectItem value="moderate">Moderate</SelectItem>
                                  <SelectItem value="major">Major</SelectItem>
                                  <SelectItem value="severe">Severe</SelectItem>
                                </SelectContent>
                              </Select>
                              <Input
                                placeholder="Description"
                                value={damage.description}
                                onChange={(e) => {
                                  const damages = methods.getValues("damages")
                                  const updatedDamages = damages.map((d) =>
                                    d.id === damage.id ? { ...d, description: e.target.value } : d,
                                  )
                                  methods.setValue("damages", updatedDamages)
                                }}
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => removeDamage(damage.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Filthiness Scoring Step */}
            <TabsContent value="filthiness">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Filthiness Assessment
                  </CardTitle>
                  <CardDescription>Rate the cleanliness of different vehicle zones</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={methods.control}
                    name="filthinessScore"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Overall Filthiness Score</FormLabel>
                        <FormControl>
                          <div className="space-y-2">
                            <Slider
                              value={[field.value]}
                              onValueChange={(value) => field.onChange(value[0])}
                              max={100}
                              step={5}
                              className="w-full"
                            />
                            <div className="flex justify-between text-sm text-muted-foreground">
                              <span>Clean (0%)</span>
                              <span className="font-medium">{field.value}%</span>
                              <span>Very Dirty (100%)</span>
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={methods.control}
                      name="filthinessZoneScores.exterior"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Exterior</FormLabel>
                          <FormControl>
                            <div className="space-y-2">
                              <Slider
                                value={[field.value]}
                                onValueChange={(value) => field.onChange(value[0])}
                                max={100}
                                step={5}
                                className="w-full"
                              />
                              <div className="text-center text-sm font-medium">{field.value}%</div>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={methods.control}
                      name="filthinessZoneScores.interior"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Interior</FormLabel>
                          <FormControl>
                            <div className="space-y-2">
                              <Slider
                                value={[field.value]}
                                onValueChange={(value) => field.onChange(value[0])}
                                max={100}
                                step={5}
                                className="w-full"
                              />
                              <div className="text-center text-sm font-medium">{field.value}%</div>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={methods.control}
                      name="filthinessZoneScores.engine"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Engine Bay</FormLabel>
                          <FormControl>
                            <div className="space-y-2">
                              <Slider
                                value={[field.value]}
                                onValueChange={(value) => field.onChange(value[0])}
                                max={100}
                                step={5}
                                className="w-full"
                              />
                              <div className="text-center text-sm font-medium">{field.value}%</div>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={methods.control}
                      name="filthinessZoneScores.undercarriage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Undercarriage</FormLabel>
                          <FormControl>
                            <div className="space-y-2">
                              <Slider
                                value={[field.value]}
                                onValueChange={(value) => field.onChange(value[0])}
                                max={100}
                                step={5}
                                className="w-full"
                              />
                              <div className="text-center text-sm font-medium">{field.value}%</div>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={methods.control}
                    name="filthinessNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assessment Notes</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={3} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Photo Capture Step */}
            <TabsContent value="photos">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Camera className="h-5 w-5" />
                    Photo Documentation
                  </CardTitle>
                  <CardDescription>Upload photos of the vehicle for documentation</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">Upload Photos</h3>
                      <p className="text-muted-foreground">Drag and drop photos here, or click to select files</p>
                      <Input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileUpload}
                        className="max-w-xs mx-auto"
                      />
                    </div>
                  </div>

                  {/* Photo Grid */}
                  {methods.watch("photos").length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {methods.watch("photos").map((photoId, index) => (
                        <div key={photoId} className="relative aspect-square">
                          <img
                            src={`/api/files/${photoId}`}
                            alt={`Vehicle photo ${index + 1}`}
                            className="w-full h-full object-cover rounded-lg border"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2 h-6 w-6 p-0"
                            onClick={() => {
                              const photos = methods.getValues("photos")
                              methods.setValue(
                                "photos",
                                photos.filter((p) => p !== photoId),
                              )
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Review Step */}
            <TabsContent value="review">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Review & Submit
                  </CardTitle>
                  <CardDescription>Review all information before submitting the inspection</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={methods.control}
                    name="overallCondition"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Overall Vehicle Condition</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select condition" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="excellent">Excellent</SelectItem>
                            <SelectItem value="good">Good</SelectItem>
                            <SelectItem value="fair">Fair</SelectItem>
                            <SelectItem value="poor">Poor</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={methods.control}
                    name="finalNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Final Notes</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={4} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Summary */}
                  <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                    <h3 className="font-semibold">Inspection Summary</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Vehicle:</span>
                        <div className="font-medium">
                          {methods.watch("vehicleYear")} {methods.watch("vehicleMake")} {methods.watch("vehicleModel")}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Customer:</span>
                        <div className="font-medium">{methods.watch("customerName")}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Damages Found:</span>
                        <div className="font-medium">{methods.watch("damages").length}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Photos Taken:</span>
                        <div className="font-medium">{methods.watch("photos").length}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Filthiness Score:</span>
                        <div className="font-medium">{methods.watch("filthinessScore")}%</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Overall Condition:</span>
                        <div className="font-medium capitalize">{methods.watch("overallCondition") || "Not set"}</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={prevStep} disabled={currentStep === 0}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            <div className="flex gap-2">
              {currentStep === steps.length - 1 ? (
                <Button type="submit" disabled={updateInspectionMutation.isPending}>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Inspection
                </Button>
              ) : (
                <Button type="button" onClick={nextStep}>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </form>
      </FormProvider>
    </ProtectedLayout>
  )
}

function InspectionDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-20" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-2 w-full mb-4" />
          <div className="flex justify-between">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
