"use client"

import React, { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"
import { useTenant } from "@/lib/tenant-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Settings,
  DollarSign,
  Users,
  FileText,
  Save,
  Plus,
  Edit,
  Trash2,
  Eye,
  Shield,
  Clock,
  MapPin,
  Phone,
  Mail,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"

// Validation schemas
const shopSettingsSchema = z.object({
  businessName: z.string().min(1, "Business name is required"),
  address: z.object({
    street: z.string().min(1, "Street address is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
    zipCode: z.string().min(5, "ZIP code is required"),
    country: z.string().min(1, "Country is required"),
  }),
  contact: z.object({
    phone: z.string().min(10, "Phone number is required"),
    email: z.string().email("Invalid email address"),
    website: z.string().url("Invalid website URL").optional().or(z.literal("")),
  }),
  businessHours: z.object({
    monday: z.object({ open: z.string(), close: z.string(), closed: z.boolean() }),
    tuesday: z.object({ open: z.string(), close: z.string(), closed: z.boolean() }),
    wednesday: z.object({ open: z.string(), close: z.string(), closed: z.boolean() }),
    thursday: z.object({ open: z.string(), close: z.string(), closed: z.boolean() }),
    friday: z.object({ open: z.string(), close: z.string(), closed: z.boolean() }),
    saturday: z.object({ open: z.string(), close: z.string(), closed: z.boolean() }),
    sunday: z.object({ open: z.string(), close: z.string(), closed: z.boolean() }),
  }),
  timezone: z.string().min(1, "Timezone is required"),
  currency: z.string().min(1, "Currency is required"),
})

const pricingRuleSchema = z.object({
  name: z.string().min(1, "Rule name is required"),
  description: z.string().optional(),
  serviceType: z.enum(["inspection", "detail", "repair", "custom", "all"]),
  conditions: z.array(
    z.object({
      field: z.string(),
      operator: z.enum(["equals", "greater_than", "less_than", "contains"]),
      value: z.string(),
    }),
  ),
  adjustmentType: z.enum(["percentage", "fixed", "multiplier"]),
  adjustmentValue: z.number(),
  priority: z.number().min(1).max(100),
  enabled: z.boolean(),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
})

const teamMemberSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  role: z.enum(["admin", "manager", "technician", "inspector"]),
  phone: z.string().min(10, "Phone number is required"),
  specializations: z.array(z.string()),
  hourlyRate: z.number().min(0, "Hourly rate must be positive"),
  maxConcurrentBookings: z.number().min(1, "Must allow at least 1 concurrent booking"),
  workingHours: z.object({
    monday: z.object({ start: z.string(), end: z.string(), available: z.boolean() }),
    tuesday: z.object({ start: z.string(), end: z.string(), available: z.boolean() }),
    wednesday: z.object({ start: z.string(), end: z.string(), available: z.boolean() }),
    thursday: z.object({ start: z.string(), end: z.string(), available: z.boolean() }),
    friday: z.object({ start: z.string(), end: z.string(), available: z.boolean() }),
    saturday: z.object({ start: z.string(), end: z.string(), available: z.boolean() }),
    sunday: z.object({ start: z.string(), end: z.string(), available: z.boolean() }),
  }),
  active: z.boolean(),
})

type ShopSettingsFormData = z.infer<typeof shopSettingsSchema>
type PricingRuleFormData = z.infer<typeof pricingRuleSchema>
type TeamMemberFormData = z.infer<typeof teamMemberSchema>

const defaultBusinessHours = {
  monday: { open: "08:00", close: "17:00", closed: false },
  tuesday: { open: "08:00", close: "17:00", closed: false },
  wednesday: { open: "08:00", close: "17:00", closed: false },
  thursday: { open: "08:00", close: "17:00", closed: false },
  friday: { open: "08:00", close: "17:00", closed: false },
  saturday: { open: "09:00", close: "15:00", closed: false },
  sunday: { open: "10:00", close: "14:00", closed: true },
}

const defaultWorkingHours = {
  monday: { start: "08:00", end: "17:00", available: true },
  tuesday: { start: "08:00", end: "17:00", available: true },
  wednesday: { start: "08:00", end: "17:00", available: true },
  thursday: { start: "08:00", end: "17:00", available: true },
  friday: { start: "08:00", end: "17:00", available: true },
  saturday: { start: "09:00", end: "15:00", available: true },
  sunday: { start: "10:00", end: "14:00", available: false },
}

// Shop Settings Tab
function ShopSettingsTab() {
  const { tenant } = useTenant()
  const queryClient = useQueryClient()

  const form = useForm<ShopSettingsFormData>({
    resolver: zodResolver(shopSettingsSchema),
    defaultValues: {
      businessHours: defaultBusinessHours,
      timezone: "America/New_York",
      currency: "USD",
    },
  })

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-settings", tenant?.id],
    queryFn: async () => {
      const response = await fetch(`/api/admin/settings?tenantId=${tenant?.id}`)
      if (!response.ok) throw new Error("Failed to fetch settings")
      return response.json()
    },
    enabled: !!tenant?.id,
  })

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: ShopSettingsFormData) => {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, tenantId: tenant?.id }),
      })
      if (!response.ok) throw new Error("Failed to update settings")
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] })
      toast({
        title: "Settings Updated",
        description: "Shop settings have been successfully updated.",
      })
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  // Initialize form with fetched data
  React.useEffect(() => {
    if (settings) {
      form.reset(settings)
    }
  }, [settings, form])

  const onSubmit = (data: ShopSettingsFormData) => {
    updateSettingsMutation.mutate(data)
  }

  if (isLoading) {
    return <ShopSettingsSkeleton />
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Business Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Business Information
            </CardTitle>
            <CardDescription>Basic information about your business</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="businessName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contact.phone"
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
                name="contact.email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
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
              name="contact.website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website (Optional)</FormLabel>
                  <FormControl>
                    <Input {...field} type="url" placeholder="https://example.com" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Business Address
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="address.street"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Street Address</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="address.city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address.state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address.zipCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ZIP Code</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address.country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || "US"}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="US">United States</SelectItem>
                      <SelectItem value="CA">Canada</SelectItem>
                      <SelectItem value="MX">Mexico</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Business Hours */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Business Hours
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(defaultBusinessHours).map(([day, _]) => (
              <div key={day} className="flex items-center gap-4">
                <div className="w-24 text-sm font-medium capitalize">{day}</div>
                <FormField
                  control={form.control}
                  name={`businessHours.${day as keyof typeof defaultBusinessHours}.closed`}
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Switch checked={!field.value} onCheckedChange={(checked) => field.onChange(!checked)} />
                      </FormControl>
                      <FormLabel className="text-sm">{field.value ? "Closed" : "Open"}</FormLabel>
                    </FormItem>
                  )}
                />
                {!form.watch(`businessHours.${day as keyof typeof defaultBusinessHours}.closed`) && (
                  <>
                    <FormField
                      control={form.control}
                      name={`businessHours.${day as keyof typeof defaultBusinessHours}.open`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input {...field} type="time" className="w-32" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <span className="text-sm text-muted-foreground">to</span>
                    <FormField
                      control={form.control}
                      name={`businessHours.${day as keyof typeof defaultBusinessHours}.close`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input {...field} type="time" className="w-32" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Regional Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Regional Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "America/New_York"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="America/New_York">Eastern Time</SelectItem>
                        <SelectItem value="America/Chicago">Central Time</SelectItem>
                        <SelectItem value="America/Denver">Mountain Time</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "USD"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                        <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button type="submit" disabled={updateSettingsMutation.isPending} className="min-w-[120px]">
            {updateSettingsMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  )
}

// Pricing Rules Tab
function PricingRulesTab() {
  const { tenant } = useTenant()
  const queryClient = useQueryClient()
  const [selectedRule, setSelectedRule] = useState<any>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const { data: pricingRules, isLoading } = useQuery({
    queryKey: ["pricing-rules", tenant?.id],
    queryFn: async () => {
      const response = await fetch(`/api/admin/pricing-rules?tenantId=${tenant?.id}`)
      if (!response.ok) throw new Error("Failed to fetch pricing rules")
      return response.json()
    },
    enabled: !!tenant?.id,
  })

  const deletePricingRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      const response = await fetch(`/api/admin/pricing-rules/${ruleId}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Failed to delete pricing rule")
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing-rules"] })
      toast({
        title: "Rule Deleted",
        description: "Pricing rule has been successfully deleted.",
      })
    },
  })

  const toggleRuleMutation = useMutation({
    mutationFn: async ({ ruleId, enabled }: { ruleId: string; enabled: boolean }) => {
      const response = await fetch(`/api/admin/pricing-rules/${ruleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      })
      if (!response.ok) throw new Error("Failed to update pricing rule")
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing-rules"] })
    },
  })

  if (isLoading) {
    return <PricingRulesSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Pricing Rules</h3>
          <p className="text-sm text-muted-foreground">Configure dynamic pricing rules based on conditions</p>
        </div>
        <Button
          onClick={() => {
            setSelectedRule(null)
            setIsDialogOpen(true)
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Rule
        </Button>
      </div>

      {/* Rules Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Service Type</TableHead>
                <TableHead>Adjustment</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pricingRules?.map((rule: any) => (
                <TableRow key={rule._id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{rule.name}</div>
                      {rule.description && <div className="text-sm text-muted-foreground">{rule.description}</div>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {rule.serviceType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {rule.adjustmentType === "percentage" && `${rule.adjustmentValue}%`}
                      {rule.adjustmentType === "fixed" && `$${rule.adjustmentValue}`}
                      {rule.adjustmentType === "multiplier" && `${rule.adjustmentValue}x`}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{rule.priority}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={(enabled) => toggleRuleMutation.mutate({ ruleId: rule._id, enabled })}
                      />
                      <span className="text-sm">{rule.enabled ? "Active" : "Inactive"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedRule(rule)
                          setIsDialogOpen(true)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deletePricingRuleMutation.mutate(rule._id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pricing Rule Dialog */}
      <PricingRuleDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} rule={selectedRule} />
    </div>
  )
}

// Team Management Tab
function TeamManagementTab() {
  const { tenant } = useTenant()
  const queryClient = useQueryClient()
  const [selectedMember, setSelectedMember] = useState<any>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const { data: teamMembers, isLoading } = useQuery({
    queryKey: ["team-members", tenant?.id],
    queryFn: async () => {
      const response = await fetch(`/api/admin/team-members?tenantId=${tenant?.id}`)
      if (!response.ok) throw new Error("Failed to fetch team members")
      return response.json()
    },
    enabled: !!tenant?.id,
  })

  const deleteTeamMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const response = await fetch(`/api/admin/team-members/${memberId}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Failed to delete team member")
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] })
      toast({
        title: "Team Member Removed",
        description: "Team member has been successfully removed.",
      })
    },
  })

  const toggleMemberMutation = useMutation({
    mutationFn: async ({ memberId, active }: { memberId: string; active: boolean }) => {
      const response = await fetch(`/api/admin/team-members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      })
      if (!response.ok) throw new Error("Failed to update team member")
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] })
    },
  })

  if (isLoading) {
    return <TeamManagementSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Team Management</h3>
          <p className="text-sm text-muted-foreground">Manage team members, roles, and schedules</p>
        </div>
        <Button
          onClick={() => {
            setSelectedMember(null)
            setIsDialogOpen(true)
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Team Member
        </Button>
      </div>

      {/* Team Members Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teamMembers?.map((member: any) => (
          <Card key={member._id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base">{member.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {member.role}
                    </Badge>
                    <Badge variant={member.active ? "default" : "secondary"}>
                      {member.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedMember(member)
                      setIsDialogOpen(true)
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteTeamMemberMutation.mutate(member._id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{member.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{member.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span>${member.hourlyRate}/hour</span>
                </div>
              </div>

              {member.specializations && member.specializations.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground">Specializations:</span>
                  <div className="flex flex-wrap gap-1">
                    {member.specializations.map((spec: string, index: number) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {spec}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-muted-foreground">Status</span>
                <Switch
                  checked={member.active}
                  onCheckedChange={(active) => toggleMemberMutation.mutate({ memberId: member._id, active })}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Team Member Dialog */}
      <TeamMemberDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} member={selectedMember} />
    </div>
  )
}

// Audit Logs Tab
function AuditLogsTab() {
  const { tenant } = useTenant()
  const [filters, setFilters] = useState({
    action: "",
    user: "",
    dateRange: { start: "", end: "" },
  })

  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ["audit-logs", tenant?.id, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        tenantId: tenant?.id || "",
        ...filters,
      })
      const response = await fetch(`/api/admin/audit-logs?${params.toString()}`)
      if (!response.ok) throw new Error("Failed to fetch audit logs")
      return response.json()
    },
    enabled: !!tenant?.id,
  })

  const getActionIcon = (action: string) => {
    switch (action) {
      case "create":
        return <Plus className="h-4 w-4 text-green-600" />
      case "update":
        return <Edit className="h-4 w-4 text-blue-600" />
      case "delete":
        return <Trash2 className="h-4 w-4 text-red-600" />
      case "login":
        return <Shield className="h-4 w-4 text-purple-600" />
      default:
        return <FileText className="h-4 w-4 text-gray-600" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "bg-red-100 text-red-800"
      case "medium":
        return "bg-yellow-100 text-yellow-800"
      case "low":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  if (isLoading) {
    return <AuditLogsSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">Audit Logs</h3>
        <p className="text-sm text-muted-foreground">Track all system activities and changes</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Action Type</Label>
              <Select
                value={filters.action}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, action: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Actions</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="login">Login</SelectItem>
                  <SelectItem value="logout">Logout</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>User</Label>
              <Input
                placeholder="Filter by user"
                value={filters.user}
                onChange={(e) => setFilters((prev) => ({ ...prev, user: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={filters.dateRange.start}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    dateRange: { ...prev.dateRange, start: e.target.value },
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={filters.dateRange.end}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    dateRange: { ...prev.dateRange, end: e.target.value },
                  }))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLogs?.logs?.map((log: any) => (
                <TableRow key={log._id}>
                  <TableCell>
                    <div className="text-sm">
                      {format(new Date(log.timestamp), "MMM d, yyyy")}
                      <div className="text-xs text-muted-foreground">{format(new Date(log.timestamp), "HH:mm:ss")}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getActionIcon(log.action)}
                      <span className="capitalize">{log.action}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{log.user.name}</div>
                      <div className="text-xs text-muted-foreground">{log.user.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{log.resource.type}</div>
                      <div className="text-xs text-muted-foreground">{log.resource.id}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs truncate text-sm">{log.details}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={getSeverityColor(log.severity)}>
                      {log.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// Skeleton Components
function ShopSettingsSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function PricingRulesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-10 w-24" />
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Service Type</TableHead>
                <TableHead>Adjustment</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-12" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function TeamManagementSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function AuditLogsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-6 w-32" />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-48" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-8" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// Dialog Components (simplified for brevity)
function PricingRuleDialog({ isOpen, onClose, rule }: { isOpen: boolean; onClose: () => void; rule: any }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit Pricing Rule" : "Create Pricing Rule"}</DialogTitle>
          <DialogDescription>Configure dynamic pricing based on conditions and service types.</DialogDescription>
        </DialogHeader>
        {/* Form implementation would go here */}
        <div className="p-4 text-center text-muted-foreground">Pricing rule form implementation</div>
      </DialogContent>
    </Dialog>
  )
}

function TeamMemberDialog({ isOpen, onClose, member }: { isOpen: boolean; onClose: () => void; member: any }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{member ? "Edit Team Member" : "Add Team Member"}</DialogTitle>
          <DialogDescription>Manage team member information, roles, and schedules.</DialogDescription>
        </DialogHeader>
        {/* Form implementation would go here */}
        <div className="p-4 text-center text-muted-foreground">Team member form implementation</div>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminPage() {
  return (
    <Tabs defaultValue="shop" className="space-y-6">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="shop" className="flex items-center gap-2">
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

      <TabsContent value="shop">
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
