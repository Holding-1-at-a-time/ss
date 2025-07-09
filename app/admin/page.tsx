"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Settings,
  DollarSign,
  Users,
  FileText,
  Save,
  Plus,
  Edit,
  Trash2,
  Clock,
  Mail,
  Phone,
  MapPin,
  Loader2,
} from "lucide-react"
import { useTenant } from "@/lib/tenant-context"
import { format } from "date-fns"

// Zod schemas for form validation
const ShopSettingsSchema = z.object({
  general: z.object({
    companyName: z.string().min(1, "Company name is required"),
    timezone: z.string().min(1, "Timezone is required"),
    currency: z.string().min(1, "Currency is required"),
    dateFormat: z.string().min(1, "Date format is required"),
    businessHours: z.object({
      start: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
      end: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
      workingDays: z.array(z.number().min(0).max(6)),
    }),
    contactInfo: z.object({
      email: z.string().email("Invalid email address"),
      phone: z.string().min(1, "Phone number is required"),
      address: z.string().min(1, "Address is required"),
    }),
  }),
  pricing: z.object({
    defaultLaborRate: z.number().min(0, "Labor rate must be positive"),
    defaultMaterialRate: z.number().min(0).max(1, "Material rate must be between 0 and 1"),
    defaultTaxRate: z.number().min(0).max(1, "Tax rate must be between 0 and 1"),
    minimumCharge: z.number().min(0, "Minimum charge must be positive"),
    surgeEnabled: z.boolean(),
    maxSurgeMultiplier: z.number().min(1, "Surge multiplier must be at least 1"),
    weatherAdjustments: z.boolean(),
  }),
  notifications: z.object({
    emailEnabled: z.boolean(),
    smsEnabled: z.boolean(),
    reminderTiming: z.object({
      hours24: z.boolean(),
      hours2: z.boolean(),
      minutes30: z.boolean(),
    }),
    adminNotifications: z.object({
      newBookings: z.boolean(),
      cancellations: z.boolean(),
      paymentIssues: z.boolean(),
    }),
  }),
})

const PricingRuleSchema = z.object({
  name: z.string().min(1, "Rule name is required"),
  description: z.string().optional(),
  serviceTypes: z.array(z.string()).min(1, "At least one service type is required"),
  conditions: z.object({
    minDamageCount: z.number().optional(),
    maxDamageCount: z.number().optional(),
    severity: z.array(z.string()).optional(),
    weatherConditions: z.array(z.string()).optional(),
  }),
  adjustments: z.object({
    type: z.enum(["percentage", "fixed"]),
    value: z.number(),
  }),
  enabled: z.boolean(),
  priority: z.number().min(1, "Priority must be at least 1"),
})

const TeamMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["tenant_admin", "manager", "technician", "viewer"]),
})

type ShopSettings = z.infer<typeof ShopSettingsSchema>
type PricingRule = z.infer<typeof PricingRuleSchema>
type TeamMember = z.infer<typeof TeamMemberSchema>

function ShopSettingsTab() {
  const { tenant } = useTenant()
  const queryClient = useQueryClient()
  const [isSaving, setIsSaving] = useState(false)

  // Fetch current settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["shop-settings", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) throw new Error("No tenant context")

      // Mock settings data - in real app would call Convex query
      const mockSettings: ShopSettings = {
        general: {
          companyName: "Auto Detail Pro",
          timezone: "America/New_York",
          currency: "USD",
          dateFormat: "MM/DD/YYYY",
          businessHours: {
            start: "09:00",
            end: "17:00",
            workingDays: [1, 2, 3, 4, 5],
          },
          contactInfo: {
            email: "contact@autodetailpro.com",
            phone: "(555) 123-4567",
            address: "123 Main St, City, State 12345",
          },
        },
        pricing: {
          defaultLaborRate: 7500, // $75.00/hour in cents
          defaultMaterialRate: 0.2, // 20%
          defaultTaxRate: 0.0875, // 8.75%
          minimumCharge: 2500, // $25.00 in cents
          surgeEnabled: true,
          maxSurgeMultiplier: 2.0,
          weatherAdjustments: true,
        },
        notifications: {
          emailEnabled: true,
          smsEnabled: false,
          reminderTiming: {
            hours24: true,
            hours2: true,
            minutes30: true,
          },
          adminNotifications: {
            newBookings: true,
            cancellations: true,
            paymentIssues: true,
          },
        },
      }

      return mockSettings
    },
    enabled: !!tenant?.id,
  })

  const form = useForm<ShopSettings>({
    resolver: zodResolver(ShopSettingsSchema),
    values: settings,
  })

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: ShopSettings) => {
      if (!tenant?.id) throw new Error("No tenant context")

      // Mock update - in real app would call Convex mutation
      console.log("Updating settings:", data)
      await new Promise((resolve) => setTimeout(resolve, 1000))

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-settings"] })
    },
  })

  const onSubmit = async (data: ShopSettings) => {
    setIsSaving(true)
    try {
      await updateSettingsMutation.mutateAsync(data)
    } catch (error) {
      console.error("Failed to update settings:", error)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Shop Settings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* General Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">General Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  {...form.register("general.companyName")}
                  aria-describedby="companyName-error"
                />
                {form.formState.errors.general?.companyName && (
                  <p id="companyName-error" className="text-sm text-red-600">
                    {form.formState.errors.general.companyName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select
                  value={form.watch("general.timezone")}
                  onValueChange={(value) => form.setValue("general.timezone", value)}
                >
                  <SelectTrigger id="timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/New_York">Eastern Time</SelectItem>
                    <SelectItem value="America/Chicago">Central Time</SelectItem>
                    <SelectItem value="America/Denver">Mountain Time</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={form.watch("general.currency")}
                  onValueChange={(value) => form.setValue("general.currency", value)}
                >
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="CAD">CAD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateFormat">Date Format</Label>
                <Select
                  value={form.watch("general.dateFormat")}
                  onValueChange={(value) => form.setValue("general.dateFormat", value)}
                >
                  <SelectTrigger id="dateFormat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Business Hours */}
            <div className="space-y-4">
              <h4 className="font-medium">Business Hours</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input id="startTime" type="time" {...form.register("general.businessHours.start")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">End Time</Label>
                  <Input id="endTime" type="time" {...form.register("general.businessHours.end")} />
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h4 className="font-medium">Contact Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </Label>
                  <Input id="email" type="email" {...form.register("general.contactInfo.email")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Phone
                  </Label>
                  <Input id="phone" type="tel" {...form.register("general.contactInfo.phone")} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Address
                </Label>
                <Textarea id="address" {...form.register("general.contactInfo.address")} rows={2} />
              </div>
            </div>
          </div>

          {/* Pricing Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Pricing Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="laborRate">Default Labor Rate ($/hour)</Label>
                <Input
                  id="laborRate"
                  type="number"
                  step="0.01"
                  {...form.register("pricing.defaultLaborRate", {
                    valueAsNumber: true,
                    setValueAs: (value) => Math.round(value * 100), // Convert to cents
                  })}
                  value={form.watch("pricing.defaultLaborRate") / 100} // Display as dollars
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="materialRate">Material Rate (%)</Label>
                <Input
                  id="materialRate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  {...form.register("pricing.defaultMaterialRate", {
                    valueAsNumber: true,
                    setValueAs: (value) => value / 100, // Convert to decimal
                  })}
                  value={form.watch("pricing.defaultMaterialRate") * 100} // Display as percentage
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="taxRate">Tax Rate (%)</Label>
                <Input
                  id="taxRate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  {...form.register("pricing.defaultTaxRate", {
                    valueAsNumber: true,
                    setValueAs: (value) => value / 100, // Convert to decimal
                  })}
                  value={form.watch("pricing.defaultTaxRate") * 100} // Display as percentage
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="minimumCharge">Minimum Charge ($)</Label>
                <Input
                  id="minimumCharge"
                  type="number"
                  step="0.01"
                  {...form.register("pricing.minimumCharge", {
                    valueAsNumber: true,
                    setValueAs: (value) => Math.round(value * 100), // Convert to cents
                  })}
                  value={form.watch("pricing.minimumCharge") / 100} // Display as dollars
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="surgeEnabled">Enable Surge Pricing</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically adjust prices during high demand periods
                  </p>
                </div>
                <Switch
                  id="surgeEnabled"
                  checked={form.watch("pricing.surgeEnabled")}
                  onCheckedChange={(checked) => form.setValue("pricing.surgeEnabled", checked)}
                />
              </div>

              {form.watch("pricing.surgeEnabled") && (
                <div className="space-y-2">
                  <Label htmlFor="maxSurgeMultiplier">Maximum Surge Multiplier</Label>
                  <Input
                    id="maxSurgeMultiplier"
                    type="number"
                    step="0.1"
                    min="1"
                    max="5"
                    {...form.register("pricing.maxSurgeMultiplier", { valueAsNumber: true })}
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="weatherAdjustments">Weather Adjustments</Label>
                  <p className="text-sm text-muted-foreground">Adjust pricing based on weather conditions</p>
                </div>
                <Switch
                  id="weatherAdjustments"
                  checked={form.watch("pricing.weatherAdjustments")}
                  onCheckedChange={(checked) => form.setValue("pricing.weatherAdjustments", checked)}
                />
              </div>
            </div>
          </div>

          {/* Notification Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Notification Settings</h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="emailEnabled">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Send notifications via email</p>
                </div>
                <Switch
                  id="emailEnabled"
                  checked={form.watch("notifications.emailEnabled")}
                  onCheckedChange={(checked) => form.setValue("notifications.emailEnabled", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="smsEnabled">SMS Notifications</Label>
                  <p className="text-sm text-muted-foreground">Send notifications via SMS</p>
                </div>
                <Switch
                  id="smsEnabled"
                  checked={form.watch("notifications.smsEnabled")}
                  onCheckedChange={(checked) => form.setValue("notifications.smsEnabled", checked)}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Reminder Timing</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="reminder24h">24 hours before</Label>
                  <Switch
                    id="reminder24h"
                    checked={form.watch("notifications.reminderTiming.hours24")}
                    onCheckedChange={(checked) => form.setValue("notifications.reminderTiming.hours24", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="reminder2h">2 hours before</Label>
                  <Switch
                    id="reminder2h"
                    checked={form.watch("notifications.reminderTiming.hours2")}
                    onCheckedChange={(checked) => form.setValue("notifications.reminderTiming.hours2", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="reminder30m">30 minutes before</Label>
                  <Switch
                    id="reminder30m"
                    checked={form.watch("notifications.reminderTiming.minutes30")}
                    onCheckedChange={(checked) => form.setValue("notifications.reminderTiming.minutes30", checked)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving || !form.formState.isDirty} className="flex items-center gap-2">
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function PricingRulesTab() {
  const { tenant } = useTenant()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<any>(null)

  // Fetch pricing rules
  const { data: pricingRules, isLoading } = useQuery({
    queryKey: ["pricing-rules", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) throw new Error("No tenant context")

      // Mock pricing rules - in real app would call Convex query
      const mockRules = [
        {
          _id: "rule_1",
          name: "High Damage Surcharge",
          description: "Additional charge for vehicles with extensive damage",
          serviceTypes: ["detail", "premium_detail"],
          conditions: {
            minDamageCount: 5,
            severity: ["major", "severe"],
          },
          adjustments: {
            type: "percentage",
            value: 25, // 25% increase
          },
          enabled: true,
          priority: 1,
          createdAt: Date.now() - 86400000,
          updatedAt: Date.now() - 86400000,
        },
        {
          _id: "rule_2",
          name: "Weather Discount",
          description: "Discount for indoor services during bad weather",
          serviceTypes: ["basic_wash", "detail"],
          conditions: {
            weatherConditions: ["rain", "snow"],
          },
          adjustments: {
            type: "percentage",
            value: -10, // 10% discount
          },
          enabled: true,
          priority: 2,
          createdAt: Date.now() - 172800000,
          updatedAt: Date.now() - 172800000,
        },
      ]

      return mockRules
    },
    enabled: !!tenant?.id,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Pricing Rules
          </CardTitle>
          <Button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Rule
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {pricingRules?.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No pricing rules</h3>
              <p className="text-sm text-muted-foreground">
                Create your first pricing rule to customize service pricing
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule Name</TableHead>
                  <TableHead>Service Types</TableHead>
                  <TableHead>Adjustment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pricingRules?.map((rule) => (
                  <TableRow key={rule._id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{rule.name}</div>
                        {rule.description && <div className="text-sm text-muted-foreground">{rule.description}</div>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {rule.serviceTypes.map((type: string) => (
                          <Badge key={type} variant="outline" className="text-xs">
                            {type.replace("_", " ")}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={rule.adjustments.value > 0 ? "destructive" : "default"}>
                        {rule.adjustments.value > 0 ? "+" : ""}
                        {rule.adjustments.value}
                        {rule.adjustments.type === "percentage" ? "%" : "$"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={rule.enabled ? "default" : "secondary"}>
                        {rule.enabled ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>{rule.priority}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditingRule(rule)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function TeamManagementTab() {
  const { tenant } = useTenant()
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)

  // Fetch team members
  const { data: teamMembers, isLoading } = useQuery({
    queryKey: ["team-members", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) throw new Error("No tenant context")

      // Mock team members - in real app would call Convex query
      const mockMembers = [
        {
          userId: "user_1",
          email: "admin@autodetailpro.com",
          firstName: "John",
          lastName: "Admin",
          role: "tenant_admin",
          isActive: true,
          lastLoginAt: Date.now() - 3600000, // 1 hour ago
          createdAt: Date.now() - 2592000000, // 30 days ago
        },
        {
          userId: "user_2",
          email: "manager@autodetailpro.com",
          firstName: "Jane",
          lastName: "Manager",
          role: "manager",
          isActive: true,
          lastLoginAt: Date.now() - 7200000, // 2 hours ago
          createdAt: Date.now() - 1296000000, // 15 days ago
        },
        {
          userId: "user_3",
          email: "tech1@autodetailpro.com",
          firstName: "Mike",
          lastName: "Technician",
          role: "technician",
          isActive: true,
          lastLoginAt: Date.now() - 86400000, // 1 day ago
          createdAt: Date.now() - 604800000, // 7 days ago
        },
      ]

      return mockMembers
    },
    enabled: !!tenant?.id,
  })

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "tenant_admin":
        return "default"
      case "manager":
        return "secondary"
      case "technician":
        return "outline"
      case "viewer":
        return "outline"
      default:
        return "outline"
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Management
          </CardTitle>
          <Button onClick={() => setIsInviteModalOpen(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Invite Member
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {teamMembers?.length === 0 ? (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No team members</h3>
              <p className="text-sm text-muted-foreground">Invite your first team member to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamMembers?.map((member) => (
                  <TableRow key={member.userId}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {member.firstName} {member.lastName}
                        </div>
                        <div className="text-sm text-muted-foreground">{member.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(member.role)}>{member.role.replace("_", " ")}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${member.isActive ? "bg-green-500" : "bg-gray-400"}`} />
                        {member.isActive ? "Active" : "Inactive"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {member.lastLoginAt ? format(member.lastLoginAt, "MMM d, h:mm a") : "Never"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function AuditLogsTab() {
  const { tenant } = useTenant()

  // Fetch audit logs
  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ["audit-logs", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) throw new Error("No tenant context")

      // Mock audit logs - in real app would call Convex query
      const mockLogs = [
        {
          id: "log_1",
          userId: "user_1",
          action: "SETTINGS_UPDATED",
          entityType: "tenant_settings",
          entityId: tenant.id,
          timestamp: Date.now() - 3600000, // 1 hour ago
          ipAddress: "192.168.1.100",
          userAgent: "Mozilla/5.0...",
          changes: {
            pricing: {
              defaultLaborRate: { before: 7000, after: 7500 },
            },
          },
        },
        {
          id: "log_2",
          userId: "user_2",
          action: "TEAM_MEMBER_CREATED",
          entityType: "admin_user",
          entityId: "user_3",
          timestamp: Date.now() - 604800000, // 7 days ago
          ipAddress: "192.168.1.101",
          userAgent: "Mozilla/5.0...",
          changes: {
            email: "tech1@autodetailpro.com",
            role: "technician",
          },
        },
        {
          id: "log_3",
          userId: "user_1",
          action: "PRICING_RULE_CREATED",
          entityType: "pricing_rule",
          entityId: "rule_1",
          timestamp: Date.now() - 1209600000, // 14 days ago
          ipAddress: "192.168.1.100",
          userAgent: "Mozilla/5.0...",
          changes: {
            name: "High Damage Surcharge",
            adjustments: { type: "percentage", value: 25 },
          },
        },
      ]

      return mockLogs
    },
    enabled: !!tenant?.id,
  })

  const getActionIcon = (action: string) => {
    switch (action) {
      case "SETTINGS_UPDATED":
        return <Settings className="h-4 w-4" />
      case "TEAM_MEMBER_CREATED":
      case "TEAM_MEMBER_DEACTIVATED":
        return <Users className="h-4 w-4" />
      case "PRICING_RULE_CREATED":
      case "PRICING_RULE_UPDATED":
        return <DollarSign className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  const getActionColor = (action: string) => {
    if (action.includes("CREATED")) return "text-green-600"
    if (action.includes("UPDATED")) return "text-blue-600"
    if (action.includes("DELETED") || action.includes("DEACTIVATED")) return "text-red-600"
    return "text-gray-600"
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Audit Logs
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {auditLogs?.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No audit logs</h3>
              <p className="text-sm text-muted-foreground">Audit logs will appear here as actions are performed</p>
            </div>
          ) : (
            <div className="space-y-3">
              {auditLogs?.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-4 border rounded-lg hover:bg-muted/50">
                  <div className={`mt-0.5 ${getActionColor(log.action)}`}>{getActionIcon(log.action)}</div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{log.action.replace(/_/g, " ").toLowerCase()}</div>
                      <div className="text-sm text-muted-foreground">{format(log.timestamp, "MMM d, h:mm a")}</div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      User: {log.userId} • Entity: {log.entityType}
                    </div>
                    {log.changes && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          View changes
                        </summary>
                        <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                          {JSON.stringify(log.changes, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdminPage() {
  return (
    <Tabs defaultValue="settings" className="space-y-6">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="settings" className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Shop Settings
        </TabsTrigger>
        <TabsTrigger value="pricing" className="flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Pricing Rules
        </TabsTrigger>
        <TabsTrigger value="team" className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          Team Management
        </TabsTrigger>
        <TabsTrigger value="audit" className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Audit Logs
        </TabsTrigger>
      </TabsList>

      <TabsContent value="settings">
        <ShopSettingsTab />
      </TabsContent>

      <TabsContent value="pricing">
        <PricingRulesTab />
      </TabsContent>

      <TabsContent value="team">
        <TeamManagementTab />
      </TabsContent>

      <TabsContent value="audit">
        <AuditLogsTab />
      </TabsContent>
    </Tabs>
  )
}
