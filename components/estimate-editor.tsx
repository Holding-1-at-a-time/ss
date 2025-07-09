"use client"

import { useState, useEffect, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Calculator,
  Plus,
  Minus,
  Save,
  Send,
  Calendar,
  AlertTriangle,
  TrendingUp,
  Cloud,
  Clock,
  Wrench,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"

// Validation schema for estimate editor
const estimateSchema = z.object({
  serviceType: z.enum(["basic_wash", "detail", "premium_detail", "repair", "custom"]),
  baseLabor: z.object({
    hours: z.number().min(0),
    rate: z.number().min(0),
  }),
  materials: z.object({
    percentage: z.number().min(0).max(1),
    customCost: z.number().min(0).optional(),
  }),
  adjustments: z.object({
    filthiness: z.number().min(1).max(3),
    complexity: z.number().min(1).max(2),
    urgency: z.number().min(1).max(1.5),
  }),
  weather: z.object({
    enabled: z.boolean(),
    multiplier: z.number().min(1).max(2),
  }),
  surge: z.object({
    enabled: z.boolean(),
    multiplier: z.number().min(1).max(3),
  }),
  discounts: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.enum(["percentage", "fixed"]),
      value: z.number(),
      enabled: z.boolean(),
    }),
  ),
  additionalServices: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      price: z.number(),
      enabled: z.boolean(),
    }),
  ),
  taxRate: z.number().min(0).max(1),
  notes: z.string().optional(),
})

type EstimateFormData = z.infer<typeof estimateSchema>

interface EstimateBreakdown {
  baseLabor: number
  materials: number
  adjustments: number
  weather: number
  surge: number
  additionalServices: number
  subtotal: number
  discounts: number
  taxableAmount: number
  tax: number
  total: number
}

interface EstimateEditorProps {
  inspectionId: string
  existingEstimate?: any
  onSave?: (estimate: any) => void
  onSend?: (estimate: any) => void
  onBook?: (estimate: any) => void
}

const serviceTypeConfig = {
  basic_wash: { label: "Basic Wash", baseHours: 1, baseMaterials: 0.1 },
  detail: { label: "Interior & Exterior Detail", baseHours: 3, baseMaterials: 0.2 },
  premium_detail: { label: "Premium Detail", baseHours: 6, baseMaterials: 0.3 },
  repair: { label: "Damage Repair", baseHours: 2, baseMaterials: 0.4 },
  custom: { label: "Custom Service", baseHours: 2, baseMaterials: 0.25 },
}

const defaultDiscounts = [
  { id: "loyalty", name: "Loyalty Discount", type: "percentage" as const, value: 10, enabled: false },
  { id: "first_time", name: "First Time Customer", type: "percentage" as const, value: 15, enabled: false },
  { id: "bulk", name: "Bulk Service", type: "fixed" as const, value: 5000, enabled: false },
]

const defaultServices = [
  { id: "wax", name: "Premium Wax", price: 2500, enabled: false },
  { id: "ceramic", name: "Ceramic Coating", price: 15000, enabled: false },
  { id: "interior_protection", name: "Interior Protection", price: 7500, enabled: false },
  { id: "engine_detail", name: "Engine Bay Detail", price: 5000, enabled: false },
]

export function EstimateEditor({ inspectionId, existingEstimate, onSave, onSend, onBook }: EstimateEditorProps) {
  const queryClient = useQueryClient()
  const [isOptimisticUpdate, setIsOptimisticUpdate] = useState(false)

  const form = useForm<EstimateFormData>({
    resolver: zodResolver(estimateSchema),
    defaultValues: {
      serviceType: "detail",
      baseLabor: {
        hours: 3,
        rate: 7500, // $75/hour in cents
      },
      materials: {
        percentage: 0.2,
      },
      adjustments: {
        filthiness: 1,
        complexity: 1,
        urgency: 1,
      },
      weather: {
        enabled: false,
        multiplier: 1,
      },
      surge: {
        enabled: false,
        multiplier: 1,
      },
      discounts: defaultDiscounts,
      additionalServices: defaultServices,
      taxRate: 0.0875, // 8.75%
      notes: "",
    },
  })

  // Fetch inspection data for context
  const { data: inspection } = useQuery({
    queryKey: ["inspection", inspectionId],
    queryFn: async () => {
      const response = await fetch(`/api/inspections/${inspectionId}`)
      if (!response.ok) throw new Error("Failed to fetch inspection")
      return response.json()
    },
  })

  // Watch form values for real-time calculations
  const formValues = form.watch()

  // Calculate estimate breakdown in real-time
  const breakdown = useMemo((): EstimateBreakdown => {
    const baseLabor = formValues.baseLabor.hours * formValues.baseLabor.rate

    const materials = formValues.materials.customCost || baseLabor * formValues.materials.percentage

    const adjustmentMultiplier =
      formValues.adjustments.filthiness * formValues.adjustments.complexity * formValues.adjustments.urgency

    const adjustments = baseLabor * (adjustmentMultiplier - 1)

    const weather = formValues.weather.enabled ? baseLabor * (formValues.weather.multiplier - 1) : 0

    const surge = formValues.surge.enabled ? baseLabor * (formValues.surge.multiplier - 1) : 0

    const additionalServices = formValues.additionalServices
      .filter((service) => service.enabled)
      .reduce((sum, service) => sum + service.price, 0)

    const subtotal = baseLabor + materials + adjustments + weather + surge + additionalServices

    const discounts = formValues.discounts
      .filter((discount) => discount.enabled)
      .reduce((sum, discount) => {
        if (discount.type === "percentage") {
          return sum + subtotal * (discount.value / 100)
        }
        return sum + discount.value
      }, 0)

    const taxableAmount = Math.max(0, subtotal - discounts)
    const tax = taxableAmount * formValues.taxRate
    const total = taxableAmount + tax

    return {
      baseLabor,
      materials,
      adjustments,
      weather,
      surge,
      additionalServices,
      subtotal,
      discounts,
      taxableAmount,
      tax,
      total,
    }
  }, [formValues])

  // Save estimate mutation
  const saveEstimateMutation = useMutation({
    mutationFn: async (data: EstimateFormData) => {
      const response = await fetch(`/api/estimates`, {
        method: existingEstimate ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          inspectionId,
          breakdown,
          estimateId: existingEstimate?._id,
        }),
      })
      if (!response.ok) throw new Error("Failed to save estimate")
      return response.json()
    },
    onMutate: async (newData) => {
      setIsOptimisticUpdate(true)
      // Optimistic update
      const previousData = queryClient.getQueryData(["estimate", existingEstimate?._id])
      queryClient.setQueryData(["estimate", existingEstimate?._id], {
        ...previousData,
        ...newData,
        breakdown,
        updatedAt: Date.now(),
      })
      return { previousData }
    },
    onError: (err, newData, context) => {
      // Rollback optimistic update
      if (context?.previousData) {
        queryClient.setQueryData(["estimate", existingEstimate?._id], context.previousData)
      }
      toast({
        title: "Error",
        description: "Failed to save estimate",
        variant: "destructive",
      })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] })
      onSave?.(data)
      toast({
        title: "Success",
        description: "Estimate saved successfully",
      })
    },
    onSettled: () => {
      setIsOptimisticUpdate(false)
    },
  })

  // Send estimate mutation
  const sendEstimateMutation = useMutation({
    mutationFn: async (data: EstimateFormData) => {
      const response = await fetch(`/api/estimates/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          inspectionId,
          breakdown,
          estimateId: existingEstimate?._id,
        }),
      })
      if (!response.ok) throw new Error("Failed to send estimate")
      return response.json()
    },
    onSuccess: (data) => {
      onSend?.(data)
      toast({
        title: "Success",
        description: "Estimate sent to customer",
      })
    },
  })

  // Book service mutation
  const bookServiceMutation = useMutation({
    mutationFn: async (data: EstimateFormData) => {
      const response = await fetch(`/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          inspectionId,
          breakdown,
          estimateId: existingEstimate?._id,
        }),
      })
      if (!response.ok) throw new Error("Failed to create booking")
      return response.json()
    },
    onSuccess: (data) => {
      onBook?.(data)
      toast({
        title: "Success",
        description: "Service booking created",
      })
    },
  })

  // Initialize form with existing estimate
  useEffect(() => {
    if (existingEstimate) {
      form.reset({
        serviceType: existingEstimate.serviceType,
        baseLabor: {
          hours: existingEstimate.laborHours,
          rate: existingEstimate.laborRate,
        },
        materials: {
          percentage: existingEstimate.materialRate || 0.2,
          customCost: existingEstimate.materialsCost,
        },
        adjustments: existingEstimate.adjustments || {
          filthiness: 1,
          complexity: 1,
          urgency: 1,
        },
        weather: existingEstimate.weather || { enabled: false, multiplier: 1 },
        surge: existingEstimate.surge || { enabled: false, multiplier: 1 },
        discounts: existingEstimate.discounts || defaultDiscounts,
        additionalServices: existingEstimate.additionalServices || defaultServices,
        taxRate: existingEstimate.taxRate || 0.0875,
        notes: existingEstimate.notes || "",
      })
    }
  }, [existingEstimate, form])

  const handleServiceTypeChange = (serviceType: string) => {
    const config = serviceTypeConfig[serviceType as keyof typeof serviceTypeConfig]
    form.setValue("serviceType", serviceType as any)
    form.setValue("baseLabor.hours", config.baseHours)
    form.setValue("materials.percentage", config.baseMaterials)
  }

  const toggleDiscount = (discountId: string) => {
    const discounts = form.getValues("discounts")
    const updatedDiscounts = discounts.map((discount) =>
      discount.id === discountId ? { ...discount, enabled: !discount.enabled } : discount,
    )
    form.setValue("discounts", updatedDiscounts)
  }

  const toggleService = (serviceId: string) => {
    const services = form.getValues("additionalServices")
    const updatedServices = services.map((service) =>
      service.id === serviceId ? { ...service, enabled: !service.enabled } : service,
    )
    form.setValue("additionalServices", updatedServices)
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Pane - Cost Breakdown */}
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Cost Breakdown
          </CardTitle>
          <CardDescription>Real-time estimate calculation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Base Labor */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              <span>Base Labor</span>
              <Badge variant="outline" className="text-xs">
                {formValues.baseLabor.hours}h × {formatCurrency(formValues.baseLabor.rate)}/h
              </Badge>
            </div>
            <span className="font-medium">{formatCurrency(breakdown.baseLabor)}</span>
          </div>

          {/* Materials */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span>Materials</span>
              <Badge variant="outline" className="text-xs">
                {(formValues.materials.percentage * 100).toFixed(0)}%
              </Badge>
            </div>
            <span className="font-medium">{formatCurrency(breakdown.materials)}</span>
          </div>

          {/* Adjustments */}
          {breakdown.adjustments > 0 && (
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-orange-500" />
                <span>Adjustments</span>
                <Badge variant="outline" className="text-xs">
                  {(
                    (formValues.adjustments.filthiness *
                      formValues.adjustments.complexity *
                      formValues.adjustments.urgency -
                      1) *
                    100
                  ).toFixed(0)}
                  %
                </Badge>
              </div>
              <span className="font-medium text-orange-600">+{formatCurrency(breakdown.adjustments)}</span>
            </div>
          )}

          {/* Weather */}
          {breakdown.weather > 0 && (
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-blue-500" />
                <span>Weather Adjustment</span>
                <Badge variant="outline" className="text-xs">
                  {((formValues.weather.multiplier - 1) * 100).toFixed(0)}%
                </Badge>
              </div>
              <span className="font-medium text-blue-600">+{formatCurrency(breakdown.weather)}</span>
            </div>
          )}

          {/* Surge */}
          {breakdown.surge > 0 && (
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-purple-500" />
                <span>Surge Pricing</span>
                <Badge variant="outline" className="text-xs">
                  {((formValues.surge.multiplier - 1) * 100).toFixed(0)}%
                </Badge>
              </div>
              <span className="font-medium text-purple-600">+{formatCurrency(breakdown.surge)}</span>
            </div>
          )}

          {/* Additional Services */}
          {breakdown.additionalServices > 0 && (
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-green-500" />
                <span>Additional Services</span>
              </div>
              <span className="font-medium text-green-600">+{formatCurrency(breakdown.additionalServices)}</span>
            </div>
          )}

          <Separator />

          {/* Subtotal */}
          <div className="flex justify-between items-center text-lg">
            <span className="font-semibold">Subtotal</span>
            <span className="font-semibold">{formatCurrency(breakdown.subtotal)}</span>
          </div>

          {/* Discounts */}
          {breakdown.discounts > 0 && (
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Minus className="h-4 w-4 text-red-500" />
                <span>Discounts</span>
              </div>
              <span className="font-medium text-red-600">-{formatCurrency(breakdown.discounts)}</span>
            </div>
          )}

          {/* Tax */}
          <div className="flex justify-between items-center">
            <span>Tax ({(formValues.taxRate * 100).toFixed(2)}%)</span>
            <span className="font-medium">{formatCurrency(breakdown.tax)}</span>
          </div>

          <Separator />

          {/* Total */}
          <div className="flex justify-between items-center text-xl">
            <span className="font-bold">Total</span>
            <span className="font-bold text-primary">{formatCurrency(breakdown.total)}</span>
          </div>

          {isOptimisticUpdate && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>Updating estimate...</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Right Pane - Controls */}
      <div className="space-y-6">
        {/* Service Type */}
        <Card>
          <CardHeader>
            <CardTitle>Service Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Service Type</Label>
              <Select value={formValues.serviceType} onValueChange={handleServiceTypeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(serviceTypeConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Labor Hours</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={formValues.baseLabor.hours}
                  onChange={(e) => form.setValue("baseLabor.hours", Number.parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Hourly Rate</Label>
                <Input
                  type="number"
                  value={formValues.baseLabor.rate / 100}
                  onChange={(e) => form.setValue("baseLabor.rate", (Number.parseFloat(e.target.value) || 0) * 100)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Materials ({(formValues.materials.percentage * 100).toFixed(0)}%)</Label>
              <Slider
                value={[formValues.materials.percentage * 100]}
                onValueChange={(value) => form.setValue("materials.percentage", value[0] / 100)}
                max={50}
                step={1}
                className="w-full"
              />
            </div>
          </CardContent>
        </Card>

        {/* Adjustments */}
        <Card>
          <CardHeader>
            <CardTitle>Pricing Adjustments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Filthiness Multiplier ({formValues.adjustments.filthiness.toFixed(1)}x)</Label>
              <Slider
                value={[formValues.adjustments.filthiness]}
                onValueChange={(value) => form.setValue("adjustments.filthiness", value[0])}
                min={1}
                max={3}
                step={0.1}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label>Complexity Multiplier ({formValues.adjustments.complexity.toFixed(1)}x)</Label>
              <Slider
                value={[formValues.adjustments.complexity]}
                onValueChange={(value) => form.setValue("adjustments.complexity", value[0])}
                min={1}
                max={2}
                step={0.1}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label>Urgency Multiplier ({formValues.adjustments.urgency.toFixed(1)}x)</Label>
              <Slider
                value={[formValues.adjustments.urgency]}
                onValueChange={(value) => form.setValue("adjustments.urgency", value[0])}
                min={1}
                max={1.5}
                step={0.1}
                className="w-full"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Weather Adjustment</Label>
                <p className="text-sm text-muted-foreground">Apply weather-based pricing</p>
              </div>
              <Switch
                checked={formValues.weather.enabled}
                onCheckedChange={(checked) => form.setValue("weather.enabled", checked)}
              />
            </div>

            {formValues.weather.enabled && (
              <div className="space-y-2">
                <Label>Weather Multiplier ({formValues.weather.multiplier.toFixed(1)}x)</Label>
                <Slider
                  value={[formValues.weather.multiplier]}
                  onValueChange={(value) => form.setValue("weather.multiplier", value[0])}
                  min={1}
                  max={2}
                  step={0.1}
                  className="w-full"
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Surge Pricing</Label>
                <p className="text-sm text-muted-foreground">Apply demand-based pricing</p>
              </div>
              <Switch
                checked={formValues.surge.enabled}
                onCheckedChange={(checked) => form.setValue("surge.enabled", checked)}
              />
            </div>

            {formValues.surge.enabled && (
              <div className="space-y-2">
                <Label>Surge Multiplier ({formValues.surge.multiplier.toFixed(1)}x)</Label>
                <Slider
                  value={[formValues.surge.multiplier]}
                  onValueChange={(value) => form.setValue("surge.multiplier", value[0])}
                  min={1}
                  max={3}
                  step={0.1}
                  className="w-full"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Discounts */}
        <Card>
          <CardHeader>
            <CardTitle>Discounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {formValues.discounts.map((discount) => (
              <div key={discount.id} className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm">{discount.name}</Label>
                  <p className="text-xs text-muted-foreground">
                    {discount.type === "percentage" ? `${discount.value}% off` : formatCurrency(discount.value)}
                  </p>
                </div>
                <Switch checked={discount.enabled} onCheckedChange={() => toggleDiscount(discount.id)} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Additional Services */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Services</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {formValues.additionalServices.map((service) => (
              <div key={service.id} className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm">{service.name}</Label>
                  <p className="text-xs text-muted-foreground">{formatCurrency(service.price)}</p>
                </div>
                <Switch checked={service.enabled} onCheckedChange={() => toggleService(service.id)} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Add any additional notes or special instructions..."
              value={formValues.notes}
              onChange={(e) => form.setValue("notes", e.target.value)}
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => saveEstimateMutation.mutate(formValues)}
                disabled={saveEstimateMutation.isPending}
                className="flex-1"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Draft
              </Button>
              <Button
                onClick={() => sendEstimateMutation.mutate(formValues)}
                disabled={sendEstimateMutation.isPending}
                className="flex-1"
              >
                <Send className="h-4 w-4 mr-2" />
                Send to Customer
              </Button>
              <Button
                variant="secondary"
                onClick={() => bookServiceMutation.mutate(formValues)}
                disabled={bookServiceMutation.isPending}
                className="flex-1"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Book Service
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
