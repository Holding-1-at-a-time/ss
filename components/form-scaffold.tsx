"use client"

import React from "react"

import type { ReactNode } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuthContext } from "@/lib/auth-context"
import { useTenant } from "@/lib/tenant-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Save,
  Send,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Eye,
  EyeOff,
  Calendar,
  Clock,
  Phone,
  Mail,
  Car,
  DollarSign,
  Percent,
  Hash,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"

// Base form configuration interface
interface FormConfig<T = any> {
  schema: z.ZodSchema<T>
  defaultValues: Partial<T>
  onSubmit: (data: T) => Promise<void>
  onSave?: (data: T) => Promise<void>
  submitLabel?: string
  saveLabel?: string
  title?: string
  description?: string
  sections?: FormSection[]
  validation?: {
    mode?: "onChange" | "onBlur" | "onSubmit"
    reValidateMode?: "onChange" | "onBlur"
  }
  accessibility?: {
    ariaLabel?: string
    ariaDescribedBy?: string
  }
}

interface FormSection {
  id: string
  title: string
  description?: string
  fields: FormFieldConfig[]
  conditional?: (values: any) => boolean
  collapsible?: boolean
  defaultExpanded?: boolean
}

interface FormFieldConfig {
  name: string
  type:
    | "text"
    | "email"
    | "tel"
    | "password"
    | "number"
    | "textarea"
    | "select"
    | "switch"
    | "date"
    | "time"
    | "currency"
    | "percentage"
  label: string
  description?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  options?: { value: string; label: string }[]
  validation?: {
    min?: number
    max?: number
    pattern?: RegExp
    custom?: (value: any) => string | boolean
  }
  conditional?: (values: any) => boolean
  icon?: ReactNode
  grid?: {
    cols?: number
    span?: number
  }
}

// Form field renderer component
function FormFieldRenderer({ field, control }: { field: FormFieldConfig; control: any }) {
  const getFieldIcon = () => {
    if (field.icon) return field.icon

    switch (field.type) {
      case "email":
        return <Mail className="h-4 w-4" />
      case "tel":
        return <Phone className="h-4 w-4" />
      case "date":
        return <Calendar className="h-4 w-4" />
      case "time":
        return <Clock className="h-4 w-4" />
      case "currency":
        return <DollarSign className="h-4 w-4" />
      case "percentage":
        return <Percent className="h-4 w-4" />
      case "number":
        return <Hash className="h-4 w-4" />
      default:
        return null
    }
  }

  const renderField = (fieldProps: any) => {
    switch (field.type) {
      case "text":
      case "email":
      case "tel":
      case "number":
      case "date":
      case "time":
        return (
          <div className="relative">
            {getFieldIcon() && (
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                {getFieldIcon()}
              </div>
            )}
            <Input
              {...fieldProps}
              type={field.type}
              placeholder={field.placeholder}
              disabled={field.disabled}
              className={getFieldIcon() ? "pl-10" : ""}
              min={field.validation?.min}
              max={field.validation?.max}
              pattern={field.validation?.pattern?.source}
            />
          </div>
        )

      case "password":
        return <PasswordField {...fieldProps} placeholder={field.placeholder} disabled={field.disabled} />

      case "currency":
        return (
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              {...fieldProps}
              type="number"
              step="0.01"
              min="0"
              placeholder={field.placeholder || "0.00"}
              disabled={field.disabled}
              className="pl-10"
              onChange={(e) => fieldProps.onChange(Number.parseFloat(e.target.value) || 0)}
            />
          </div>
        )

      case "percentage":
        return (
          <div className="relative">
            <Input
              {...fieldProps}
              type="number"
              min="0"
              max="100"
              step="0.1"
              placeholder={field.placeholder || "0"}
              disabled={field.disabled}
              className="pr-8"
              onChange={(e) => fieldProps.onChange(Number.parseFloat(e.target.value) || 0)}
            />
            <Percent className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
        )

      case "textarea":
        return <Textarea {...fieldProps} placeholder={field.placeholder} disabled={field.disabled} rows={4} />

      case "select":
        return (
          <Select onValueChange={fieldProps.onChange} value={fieldProps.value} disabled={field.disabled}>
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder || `Select ${field.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      case "switch":
        return (
          <div className="flex items-center space-x-2">
            <Switch checked={fieldProps.value} onCheckedChange={fieldProps.onChange} disabled={field.disabled} />
            <span className="text-sm text-muted-foreground">{fieldProps.value ? "Enabled" : "Disabled"}</span>
          </div>
        )

      default:
        return <Input {...fieldProps} placeholder={field.placeholder} disabled={field.disabled} />
    }
  }

  return (
    <FormField
      control={control}
      name={field.name}
      render={({ field: fieldProps }) => (
        <FormItem className={field.grid ? `col-span-${field.grid.span || 1}` : ""}>
          <FormLabel className="flex items-center gap-2">
            {field.label}
            {field.required && <span className="text-red-500">*</span>}
          </FormLabel>
          <FormControl>{renderField(fieldProps)}</FormControl>
          {field.description && <FormDescription>{field.description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

// Password field with show/hide toggle
function PasswordField({ value, onChange, placeholder, disabled }: any) {
  const [showPassword, setShowPassword] = React.useState(false)

  return (
    <div className="relative">
      <Input
        type={showPassword ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className="pr-10"
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
        onClick={() => setShowPassword(!showPassword)}
        disabled={disabled}
      >
        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        <span className="sr-only">{showPassword ? "Hide password" : "Show password"}</span>
      </Button>
    </div>
  )
}

// Form section component
function FormSectionRenderer({
  section,
  control,
  values,
}: {
  section: FormSection
  control: any
  values: any
}) {
  const [isExpanded, setIsExpanded] = React.useState(section.defaultExpanded ?? true)

  // Check if section should be shown based on conditional logic
  if (section.conditional && !section.conditional(values)) {
    return null
  }

  const visibleFields = section.fields.filter((field) => !field.conditional || field.conditional(values))

  if (visibleFields.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader
        className={section.collapsible ? "cursor-pointer" : ""}
        onClick={section.collapsible ? () => setIsExpanded(!isExpanded) : undefined}
      >
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{section.title}</CardTitle>
            {section.description && <CardDescription>{section.description}</CardDescription>}
          </div>
          {section.collapsible && (
            <Button variant="ghost" size="sm">
              {isExpanded ? "Collapse" : "Expand"}
            </Button>
          )}
        </div>
      </CardHeader>

      {(!section.collapsible || isExpanded) && (
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {visibleFields.map((field) => (
              <FormFieldRenderer key={field.name} field={field} control={control} />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

// Main form scaffold component
export function FormScaffold<T = any>({
  config,
  children,
  className = "",
}: {
  config: FormConfig<T>
  children?: ReactNode
  className?: string
}) {
  const { user } = useAuthContext()
  const { tenant } = useTenant()
  const queryClient = useQueryClient()

  const form = useForm<T>({
    resolver: zodResolver(config.schema),
    defaultValues: config.defaultValues,
    mode: config.validation?.mode || "onChange",
    reValidateMode: config.validation?.reValidateMode || "onChange",
  })

  const [isSaving, setIsSaving] = React.useState(false)
  const [saveProgress, setSaveProgress] = React.useState(0)

  // Auto-save functionality
  const autoSaveMutation = useMutation({
    mutationFn: async (data: T) => {
      if (config.onSave) {
        await config.onSave(data)
      }
    },
    onSuccess: () => {
      toast({
        title: "Auto-saved",
        description: "Your changes have been automatically saved.",
        duration: 2000,
      })
    },
  })

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: config.onSubmit,
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Form submitted successfully.",
      })
      form.reset()
    },
    onError: (error: any) => {
      toast({
        title: "Submission Failed",
        description: error.message || "An error occurred while submitting the form.",
        variant: "destructive",
      })
    },
  })

  // Auto-save on form changes
  React.useEffect(() => {
    if (!config.onSave) return

    const subscription = form.watch((data) => {
      if (form.formState.isDirty && !form.formState.isSubmitting) {
        setIsSaving(true)
        setSaveProgress(0)

        const timer = setInterval(() => {
          setSaveProgress((prev) => {
            if (prev >= 100) {
              clearInterval(timer)
              autoSaveMutation.mutate(data as T)
              setIsSaving(false)
              return 0
            }
            return prev + 10
          })
        }, 100)

        return () => clearInterval(timer)
      }
    })

    return () => subscription.unsubscribe()
  }, [form, config.onSave, autoSaveMutation])

  const onSubmit = (data: T) => {
    submitMutation.mutate(data)
  }

  const formValues = form.watch()

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Form Header */}
      {(config.title || config.description) && (
        <div className="space-y-2">
          {config.title && <h2 className="text-2xl font-bold tracking-tight">{config.title}</h2>}
          {config.description && <p className="text-muted-foreground">{config.description}</p>}
        </div>
      )}

      {/* Auto-save indicator */}
      {isSaving && config.onSave && (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription className="flex items-center gap-2">
            <span>Auto-saving...</span>
            <Progress value={saveProgress} className="w-24 h-2" />
          </AlertDescription>
        </Alert>
      )}

      {/* Form */}
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6"
          aria-label={config.accessibility?.ariaLabel}
          aria-describedby={config.accessibility?.ariaDescribedBy}
        >
          {/* Form Sections */}
          {config.sections
            ? config.sections.map((section) => (
                <FormSectionRenderer key={section.id} section={section} control={form.control} values={formValues} />
              ))
            : children}

          {/* Form Actions */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {form.formState.errors && Object.keys(form.formState.errors).length > 0 && (
                    <Alert variant="destructive" className="flex-1">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>Please fix the errors above before submitting.</AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {/* Form Status Indicators */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {form.formState.isDirty && (
                      <Badge variant="outline" className="text-orange-600">
                        Unsaved Changes
                      </Badge>
                    )}
                    {form.formState.isValid && (
                      <Badge variant="outline" className="text-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Valid
                      </Badge>
                    )}
                  </div>

                  {/* Action Buttons */}
                  {config.onSave && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => config.onSave!(formValues)}
                      disabled={!form.formState.isDirty || autoSaveMutation.isPending}
                    >
                      {autoSaveMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          {config.saveLabel || "Save Draft"}
                        </>
                      )}
                    </Button>
                  )}

                  <Button type="submit" disabled={!form.formState.isValid || submitMutation.isPending}>
                    {submitMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        {config.submitLabel || "Submit"}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  )
}

// Preset form configurations for common use cases
export const inspectionFormConfig = {
  schema: z.object({
    vehicleInfo: z.object({
      make: z.string().min(1, "Make is required"),
      model: z.string().min(1, "Model is required"),
      year: z
        .number()
        .min(1900)
        .max(new Date().getFullYear() + 1),
      vin: z.string().length(17, "VIN must be 17 characters").optional().or(z.literal("")),
      mileage: z.number().min(0, "Mileage must be positive"),
    }),
    customerInfo: z.object({
      name: z.string().min(1, "Customer name is required"),
      email: z.string().email("Invalid email address"),
      phone: z.string().min(10, "Phone number is required"),
    }),
    inspectionDetails: z.object({
      type: z.enum(["basic", "detailed", "pre_purchase", "insurance"]),
      priority: z.enum(["low", "normal", "high", "urgent"]),
      notes: z.string().optional(),
      scheduledDate: z.string().min(1, "Scheduled date is required"),
      estimatedDuration: z.number().min(0.5).max(8),
    }),
  }),
  sections: [
    {
      id: "vehicle",
      title: "Vehicle Information",
      description: "Basic vehicle details for the inspection",
      fields: [
        { name: "vehicleInfo.make", type: "text", label: "Make", required: true, icon: Car },
        { name: "vehicleInfo.model", type: "text", label: "Model", required: true },
        { name: "vehicleInfo.year", type: "number", label: "Year", required: true },
        { name: "vehicleInfo.vin", type: "text", label: "VIN", placeholder: "17-character VIN" },
        { name: "vehicleInfo.mileage", type: "number", label: "Mileage", required: true },
      ],
    },
    {
      id: "customer",
      title: "Customer Information",
      fields: [
        { name: "customerInfo.name", type: "text", label: "Customer Name", required: true },
        { name: "customerInfo.email", type: "email", label: "Email Address", required: true },
        { name: "customerInfo.phone", type: "tel", label: "Phone Number", required: true },
      ],
    },
    {
      id: "inspection",
      title: "Inspection Details",
      fields: [
        {
          name: "inspectionDetails.type",
          type: "select",
          label: "Inspection Type",
          required: true,
          options: [
            { value: "basic", label: "Basic Inspection" },
            { value: "detailed", label: "Detailed Inspection" },
            { value: "pre_purchase", label: "Pre-Purchase Inspection" },
            { value: "insurance", label: "Insurance Inspection" },
          ],
        },
        {
          name: "inspectionDetails.priority",
          type: "select",
          label: "Priority",
          required: true,
          options: [
            { value: "low", label: "Low" },
            { value: "normal", label: "Normal" },
            { value: "high", label: "High" },
            { value: "urgent", label: "Urgent" },
          ],
        },
        { name: "inspectionDetails.scheduledDate", type: "date", label: "Scheduled Date", required: true },
        {
          name: "inspectionDetails.estimatedDuration",
          type: "number",
          label: "Estimated Duration (hours)",
          required: true,
        },
        { name: "inspectionDetails.notes", type: "textarea", label: "Additional Notes" },
      ],
    },
  ],
} as const

export const estimateFormConfig = {
  schema: z.object({
    serviceDetails: z.object({
      type: z.enum(["inspection", "detail", "repair", "custom"]),
      description: z.string().min(1, "Service description is required"),
      laborHours: z.number().min(0, "Labor hours must be positive"),
      laborRate: z.number().min(0, "Labor rate must be positive"),
    }),
    parts: z.array(
      z.object({
        name: z.string().min(1, "Part name is required"),
        quantity: z.number().min(1, "Quantity must be at least 1"),
        unitPrice: z.number().min(0, "Unit price must be positive"),
        markup: z.number().min(0).max(100, "Markup must be between 0-100%"),
      }),
    ),
    pricing: z.object({
      subtotal: z.number().min(0),
      tax: z.number().min(0),
      discount: z.number().min(0).max(100),
      total: z.number().min(0),
    }),
  }),
  sections: [
    {
      id: "service",
      title: "Service Details",
      fields: [
        {
          name: "serviceDetails.type",
          type: "select",
          label: "Service Type",
          required: true,
          options: [
            { value: "inspection", label: "Vehicle Inspection" },
            { value: "detail", label: "Detail Service" },
            { value: "repair", label: "Damage Repair" },
            { value: "custom", label: "Custom Service" },
          ],
        },
        { name: "serviceDetails.description", type: "textarea", label: "Service Description", required: true },
        { name: "serviceDetails.laborHours", type: "number", label: "Labor Hours", required: true },
        { name: "serviceDetails.laborRate", type: "currency", label: "Labor Rate (per hour)", required: true },
      ],
    },
    {
      id: "pricing",
      title: "Pricing",
      fields: [
        { name: "pricing.subtotal", type: "currency", label: "Subtotal", disabled: true },
        { name: "pricing.discount", type: "percentage", label: "Discount" },
        { name: "pricing.tax", type: "percentage", label: "Tax Rate" },
        { name: "pricing.total", type: "currency", label: "Total", disabled: true },
      ],
    },
  ],
} as const
