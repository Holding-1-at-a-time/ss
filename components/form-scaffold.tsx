"use client"

import type React from "react"
import type { z } from "zod"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Calendar, Clock, Phone, Mail, DollarSign, Percent, Hash } from "lucide-react"

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
  icon?: React.ComponentType<{ className?: string }>
  grid?: {
    cols?: number
    span?: number
  }
}

// Form field renderer component
function FormFieldRenderer({ field, control }: { field: FormFieldConfig; control: any }) {
  const getFieldIcon = () => {
    if (field.icon) return <field.icon className="h-4 w-4" />
    
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
        return (
          <Textarea
            {...fieldProps}
            placeholder={field.placeholder}
            disabled={field.disabled}
            rows={4}
          />
        )

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
            <Switch
              checked={fieldProps.value}
              onCheckedChange={fieldProps.onChange}
              disabled={field.disabled}
            />
            <span className="text-sm text-muted-foreground">
              {fieldProps.value ? "Enabled" : "Disabled"}
            </span>
          </div>
        )

      default:
        return (\
