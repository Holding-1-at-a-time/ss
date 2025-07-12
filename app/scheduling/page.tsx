"use client"
import { useQuery, useMutation } from "convex/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format, addDays, startOfWeek, endOfWeek, isSameDay } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form } from "@/components/ui/form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Calendar, Clock, Users, TrendingUp, Cloud, ChevronLeft, ChevronRight } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { api } from "@/convex/_generated/api"

const bookingSchema = z.object({
  assessmentId: z.string().min(1, "Assessment is required"),
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email("Invalid email address"),
  customerPhone: z.string().min(10, "Phone number is required"),
  serviceType: z.enum(["basic_wash", "detail", "premium_detail", "repair", "custom"]),
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

interface SchedulingCalendarProps {
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
  basic_wash: { label: "Basic Wash", duration: 1, color: "bg-blue-500" },
  detail: { label: "Detail Service", duration: 3, color: "bg-green-500" },
  premium_detail: { label: "Premium Detail", duration: 6, color: "bg-purple-500" },
  repair: { label: "Damage Repair", duration: 4, color: "bg-orange-500" },
  custom: { label: "Custom Service", duration: 2, color: "bg-gray-500" },
}

function SchedulingCalendar({ selectedDate, onDateSelect, onSlotSelect, selectedSlot }: SchedulingCalendarProps) {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const { data: availability, isLoading } = useQuery(api.scheduling.getAvailability, {
    startDate: format(weekStart, "yyyy-MM-dd"),
    endDate: format(endOfWeek(selectedDate), "yyyy-MM-dd"),
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
  const createBooking = useMutation(api.scheduling.createBooking)
  const { data: assessments } = useQuery(api.vehicleAssessment.getRecentAssessments, {})

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      serviceType: "detail",
      estimatedDuration: 3,
      priority: "normal",
    },
  })

  const onSubmit = async (data: BookingFormData) => {
    if (!selectedSlot) return

    try {
      const booking = await createBooking({
        ...data,
        slotId: selectedSlot.id,
        scheduledDate: format(selectedDate, "yyyy-MM-dd"),
        scheduledTime: selectedSlot.startTime,
      })

      toast({
        title: "Booking Created",
        description: `Appointment scheduled for ${format(selectedDate, "MMM d, yyyy")} at ${selectedSlot.startTime}`,
      })

      onClose()
      form.reset()
    } catch (error) {
      toast({
        title: "Booking Failed",
        description: "Failed to create booking. Please try again.",
        variant: "destructive",
      })
    }
  }

  if (!selectedSlot) return null

  const surgeInfo = selectedSlot.surgeMultiplier > 1.1
    ? { color: "text-orange-600", label: `+${((selectedSlot.surgeMultiplier - 1) * 100).toFixed(0)}% surge` }
    : null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Schedule Service Appointment
          </DialogTitle>
          <DialogDescription>
            Book appointment for {format(selectedDate, "EEEE, MMMM d, yyyy")} at {selectedSlot.startTime}
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
                    <span>{selectedSlot.startTime} - {selectedSlot.endTime}</span>
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
                    <AlertDescription className="text-blue-600">\
                      Weather conditions may affect service - additional{"
