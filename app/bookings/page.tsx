"use client"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format, addDays, startOfWeek, endOfWeek, isSameDay } from "date-fns"
import { useAuthContext } from "@/lib/auth-context"
import { useTenant } from "@/lib/tenant-context"
import { ProtectedLayout } from "@/components/protected-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Calendar,
  Clock,
  Users,
  Car,
  TrendingUp,
  Cloud,
  ChevronLeft,
  ChevronRight,
  Plus,
  CheckCircle,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"

// Validation schema for booking form
const bookingSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email("Invalid email address"),
  customerPhone: z.string().min(10, "Phone number is required"),
  vehicleInfo: z.object({
    make: z.string().min(1, "Vehicle make is required"),
    model: z.string().min(1, "Vehicle model is required"),
    year: z
      .number()
      .min(1900)
      .max(new Date().getFullYear() + 1),
    vin: z.string().optional(),
  }),
  serviceType: z.enum(["inspection", "detail", "repair", "custom"]),
  estimatedDuration: z.number().min(0.5).max(8),
  teamMemberId: z.string().min(1, "Team member is required"),
  notes: z.string().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]),
})

type BookingFormData = z.infer<typeof bookingSchema>

interface TimeSlot {
  id: string
  startTime: string
  endTime: string
  isAvailable: boolean
  teamMember: {
    id: string
    name: string
    role: string
    avatar?: string
  }
  occupancyRate: number
  surgeMultiplier: number
  weatherImpact: number
  conflictReason?: string
}

interface BookingCalendarProps {
  selectedDate: Date
  onDateSelect: (date: Date) => void
  onSlotSelect: (slot: TimeSlot) => void
  selectedSlot: TimeSlot | null
}

const timeSlots = [
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
]

const serviceTypeConfig = {
  inspection: { label: "Vehicle Inspection", duration: 1, color: "bg-blue-500" },
  detail: { label: "Detail Service", duration: 3, color: "bg-green-500" },
  repair: { label: "Damage Repair", duration: 4, color: "bg-orange-500" },
  custom: { label: "Custom Service", duration: 2, color: "bg-purple-500" },
}

function BookingCalendar({ selectedDate, onDateSelect, onSlotSelect, selectedSlot }: BookingCalendarProps) {
  const { tenant } = useTenant()
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const { data: availability, isLoading } = useQuery({
    queryKey: ["availability", tenant?.id, format(weekStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const response = await fetch(
        `/api/availability?tenantId=${tenant?.id}&startDate=${format(weekStart, "yyyy-MM-dd")}&endDate=${format(endOfWeek(selectedDate), "yyyy-MM-dd")}`,
      )
      if (!response.ok) throw new Error("Failed to fetch availability")
      return response.json()
    },
    enabled: !!tenant?.id,
  })

  const getSlotForDateTime = (date: Date, time: string): TimeSlot | null => {
    if (!availability) return null

    const dateKey = format(date, "yyyy-MM-dd")
    const dayAvailability = availability[dateKey]

    return dayAvailability?.find((slot: TimeSlot) => slot.startTime === time) || null
  }

  const getSurgeIndicator = (multiplier: number) => {
    if (multiplier <= 1.1) return { color: "bg-green-100 text-green-800", label: "Normal" }
    if (multiplier <= 1.3) return { color: "bg-yellow-100 text-yellow-800", label: "Busy" }
    if (multiplier <= 1.5) return { color: "bg-orange-100 text-orange-800", label: "High Demand" }
    return { color: "bg-red-100 text-red-800", label: "Peak" }
  }

  if (isLoading) {
    return <CalendarSkeleton />
  }

  return (
    <div className="space-y-4">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => onDateSelect(addDays(selectedDate, -7))}>
          <ChevronLeft className="h-4 w-4" />
          Previous Week
        </Button>
        <h3 className="text-lg font-semibold">
          {format(weekStart, "MMM d")} - {format(endOfWeek(selectedDate), "MMM d, yyyy")}
        </h3>
        <Button variant="outline" size="sm" onClick={() => onDateSelect(addDays(selectedDate, 7))}>
          Next Week
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-8 bg-muted/50">
          <div className="p-3 text-sm font-medium border-r">Time</div>
          {weekDays.map((day) => (
            <div
              key={day.toISOString()}
              className={`p-3 text-sm font-medium text-center border-r last:border-r-0 ${
                isSameDay(day, selectedDate) ? "bg-primary/10" : ""
              }`}
            >
              <div>{format(day, "EEE")}</div>
              <div className="text-xs text-muted-foreground">{format(day, "MMM d")}</div>
            </div>
          ))}
        </div>

        {/* Time Slots */}
        <div className="max-h-96 overflow-y-auto">
          {timeSlots.map((time) => (
            <div key={time} className="grid grid-cols-8 border-b last:border-b-0">
              <div className="p-2 text-sm font-medium border-r bg-muted/25">{time}</div>
              {weekDays.map((day) => {
                const slot = getSlotForDateTime(day, time)
                const isSelected = selectedSlot?.id === slot?.id
                const surgeInfo = slot ? getSurgeIndicator(slot.surgeMultiplier) : null

                return (
                  <div
                    key={`${day.toISOString()}-${time}`}
                    className={`p-1 border-r last:border-r-0 min-h-[60px] ${
                      slot?.isAvailable ? "cursor-pointer hover:bg-muted/50" : "bg-muted/25"
                    } ${isSelected ? "bg-primary/20 ring-2 ring-primary" : ""}`}
                    onClick={() => slot?.isAvailable && onSlotSelect(slot)}
                  >
                    {slot && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${slot.isAvailable ? "bg-green-500" : "bg-red-500"}`} />
                          <span className="text-xs font-medium truncate">{slot.teamMember.name}</span>
                        </div>

                        {slot.isAvailable && surgeInfo && (
                          <Badge variant="secondary" className={`text-xs ${surgeInfo.color}`}>
                            {surgeInfo.label}
                          </Badge>
                        )}

                        {!slot.isAvailable && slot.conflictReason && (
                          <div className="text-xs text-red-600 truncate">{slot.conflictReason}</div>
                        )}

                        {slot.weatherImpact > 1 && (
                          <div className="flex items-center gap-1">
                            <Cloud className="h-3 w-3 text-blue-500" />
                            <span className="text-xs text-blue-600">
                              +{((slot.weatherImpact - 1) * 100).toFixed(0)}%
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>Unavailable</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            Normal
          </Badge>
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            Busy
          </Badge>
          <Badge variant="secondary" className="bg-orange-100 text-orange-800">
            High Demand
          </Badge>
          <Badge variant="secondary" className="bg-red-100 text-red-800">
            Peak
          </Badge>
        </div>
      </div>
    </div>
  )
}

function BookingModal({
  isOpen,
  onClose,
  selectedSlot,
  selectedDate,
}: {
  isOpen: boolean
  onClose: () => void
  selectedSlot: TimeSlot | null
  selectedDate: Date
}) {
  const { user } = useAuthContext()
  const { tenant } = useTenant()
  const queryClient = useQueryClient()

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      serviceType: "inspection",
      estimatedDuration: 1,
      priority: "normal",
      vehicleInfo: {
        year: new Date().getFullYear(),
      },
    },
  })

  const { data: customers } = useQuery({
    queryKey: ["customers", tenant?.id],
    queryFn: async () => {
      const response = await fetch(`/api/customers?tenantId=${tenant?.id}`)
      if (!response.ok) throw new Error("Failed to fetch customers")
      return response.json()
    },
    enabled: !!tenant?.id && isOpen,
  })

  const createBookingMutation = useMutation({
    mutationFn: async (data: BookingFormData) => {
      const bookingData = {
        ...data,
        tenantId: tenant?.id,
        slotId: selectedSlot?.id,
        scheduledDate: format(selectedDate, "yyyy-MM-dd"),
        scheduledTime: selectedSlot?.startTime,
        createdBy: user?.id,
      }

      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to create booking")
      }

      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["availability"] })
      queryClient.invalidateQueries({ queryKey: ["bookings"] })

      toast({
        title: "Booking Created",
        description: `Booking confirmed for ${data.customerName} on ${format(selectedDate, "MMM d, yyyy")} at ${selectedSlot?.startTime}`,
      })

      onClose()
      form.reset()
    },
    onError: (error) => {
      toast({
        title: "Booking Failed",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const calculateTotalPrice = () => {
    if (!selectedSlot) return 0

    const serviceConfig = serviceTypeConfig[form.watch("serviceType")]
    const basePrice = serviceConfig.duration * 7500 // $75/hour base rate
    const surgePrice = basePrice * selectedSlot.surgeMultiplier
    const weatherPrice = surgePrice * selectedSlot.weatherImpact

    return Math.round(weatherPrice)
  }

  const onSubmit = (data: BookingFormData) => {
    createBookingMutation.mutate(data)
  }

  if (!selectedSlot) return null

  const surgeInfo =
    selectedSlot.surgeMultiplier > 1.1
      ? { color: "text-orange-600", label: `+${((selectedSlot.surgeMultiplier - 1) * 100).toFixed(0)}% surge` }
      : null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Create Booking
          </DialogTitle>
          <DialogDescription>
            Schedule a service appointment for {format(selectedDate, "EEEE, MMMM d, yyyy")} at {selectedSlot.startTime}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Slot Information */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Appointment Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {selectedSlot.startTime} - {selectedSlot.endTime}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedSlot.teamMember.name}</span>
                  </div>
                </div>

                {surgeInfo && (
                  <Alert>
                    <TrendingUp className="h-4 w-4" />
                    <AlertDescription className={surgeInfo.color}>
                      High demand period - {surgeInfo.label} pricing applies
                    </AlertDescription>
                  </Alert>
                )}

                {selectedSlot.weatherImpact > 1 && (
                  <Alert>
                    <Cloud className="h-4 w-4" />
                    <AlertDescription className="text-blue-600">
                      Weather conditions may affect service - additional{" "}
                      {((selectedSlot.weatherImpact - 1) * 100).toFixed(0)}% charge
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Customer Information */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Customer Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Existing Customer</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value)
                          const customer = customers?.find((c: any) => c._id === value)
                          if (customer) {
                            form.setValue("customerName", customer.name)
                            form.setValue("customerEmail", customer.email)
                            form.setValue("customerPhone", customer.phone)
                          }
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select existing customer or create new" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="new">Create New Customer</SelectItem>
                          {customers?.map((customer: any) => (
                            <SelectItem key={customer._id} value={customer._id}>
                              {customer.name} - {customer.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </div>

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
              </CardContent>
            </Card>

            {/* Vehicle Information */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  Vehicle Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="vehicleInfo.make"
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
                    name="vehicleInfo.model"
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
                    name="vehicleInfo.year"
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

                <FormField
                  control={form.control}
                  name="vehicleInfo.vin"
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
              </CardContent>
            </Card>

            {/* Service Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Service Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="serviceType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(serviceTypeConfig).map(([key, config]) => (
                              <SelectItem key={key} value={key}>
                                {config.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="estimatedDuration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated Duration (hours)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          step="0.5"
                          min="0.5"
                          max="8"
                          onChange={(e) => field.onChange(Number.parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
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

            {/* Pricing Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Pricing Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Base Service</span>
                    <span>${(serviceTypeConfig[form.watch("serviceType")].duration * 75).toFixed(2)}</span>
                  </div>
                  {selectedSlot.surgeMultiplier > 1 && (
                    <div className="flex justify-between text-orange-600">
                      <span>Surge Pricing ({((selectedSlot.surgeMultiplier - 1) * 100).toFixed(0)}%)</span>
                      <span>
                        +$
                        {(
                          serviceTypeConfig[form.watch("serviceType")].duration *
                          75 *
                          (selectedSlot.surgeMultiplier - 1)
                        ).toFixed(2)}
                      </span>
                    </div>
                  )}
                  {selectedSlot.weatherImpact > 1 && (
                    <div className="flex justify-between text-blue-600">
                      <span>Weather Adjustment ({((selectedSlot.weatherImpact - 1) * 100).toFixed(0)}%)</span>
                      <span>
                        +$
                        {(
                          serviceTypeConfig[form.watch("serviceType")].duration *
                          75 *
                          selectedSlot.surgeMultiplier *
                          (selectedSlot.weatherImpact - 1)
                        ).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="border-t pt-2 flex justify-between font-semibold">
                    <span>Total Estimate</span>
                    <span>${(calculateTotalPrice() / 100).toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={createBookingMutation.isPending} className="min-w-[120px]">
                {createBookingMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Create Booking
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function CalendarSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-8 bg-muted/50">
          <Skeleton className="h-16 border-r" />
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-16 border-r last:border-r-0" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="grid grid-cols-8 border-b last:border-b-0">
            <Skeleton className="h-16 border-r" />
            {Array.from({ length: 7 }).map((_, j) => (
              <Skeleton key={j} className="h-16 border-r last:border-r-0" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function BookingsPage() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleSlotSelect = (slot: TimeSlot) => {
    setSelectedSlot(slot)
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setSelectedSlot(null)
  }

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Booking Calendar</h1>
            <p className="text-muted-foreground">Schedule and manage service appointments</p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Quick Book
          </Button>
        </div>

        {/* Calendar */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Schedule</CardTitle>
            <CardDescription>
              Click on available time slots to create bookings. Surge pricing and weather impacts are shown.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BookingCalendar
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
              onSlotSelect={handleSlotSelect}
              selectedSlot={selectedSlot}
            />
          </CardContent>
        </Card>

        {/* Booking Modal */}
        <BookingModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          selectedSlot={selectedSlot}
          selectedDate={selectedDate}
        />
      </div>
    </ProtectedLayout>
  )
}
