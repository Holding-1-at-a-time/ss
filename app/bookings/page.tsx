"use client"

import type React from "react"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CalendarIcon, Clock, Users, AlertTriangle } from "lucide-react"
import { useTenant } from "@/lib/tenant-context"
import { useAuth } from "@/lib/auth-context"
import { format, addDays, startOfWeek, endOfWeek, isSameDay } from "date-fns"

interface TimeSlot {
  start: number
  end: number
  duration: number
  teamId: string
  capacity: number
}

interface AvailabilityCheck {
  isAvailable: boolean
  currentOccupancy: number
  maxCapacity: number
  occupancyRate: number
  conflictingBookings: string[]
  surgeRequired: boolean
  surgeMultiplier: number
}

interface BookingModalProps {
  timeSlot: TimeSlot | null
  availability: AvailabilityCheck | null
  onClose: () => void
  onConfirm: (bookingData: any) => void
}

const TEAMS = {
  team_basic: { name: "Basic Wash Team", color: "bg-blue-500" },
  team_detail: { name: "Detail Team", color: "bg-green-500" },
  team_premium: { name: "Premium Detail Team", color: "bg-purple-500" },
  team_repair: { name: "Repair Team", color: "bg-orange-500" },
}

function BookingModal({ timeSlot, availability, onClose, onConfirm }: BookingModalProps) {
  const [selectedTeam, setSelectedTeam] = useState<string>("")
  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [serviceType, setServiceType] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!timeSlot || !availability) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTeam || !customerName || !customerEmail || !serviceType) return

    setIsSubmitting(true)
    try {
      const bookingData = {
        scheduledStart: timeSlot.start,
        scheduledEnd: timeSlot.end,
        assignedTechnician: selectedTeam,
        customerName,
        customerEmail,
        customerPhone,
        serviceType,
        location: "Customer Location", // Would be dynamic in real app
        bookingNumber: `BK-${Date.now()}`,
        vehicleInfo: {
          vin: "TEMP-VIN",
          make: "TBD",
          model: "TBD",
          year: new Date().getFullYear(),
          color: "TBD",
        },
        totalAmount: calculatePrice(serviceType, availability.surgeMultiplier),
      }

      await onConfirm(bookingData)
      onClose()
    } catch (error) {
      console.error("Booking failed:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const calculatePrice = (service: string, surgeMultiplier: number): number => {
    const basePrices = {
      basic_wash: 2500, // $25.00
      detail: 7500, // $75.00
      premium_detail: 15000, // $150.00
      repair: 10000, // $100.00
    }
    return Math.round((basePrices[service as keyof typeof basePrices] || 5000) * surgeMultiplier)
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" aria-describedby="booking-modal-description">
        <DialogHeader>
          <DialogTitle>Book Appointment</DialogTitle>
        </DialogHeader>

        <div id="booking-modal-description" className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarIcon className="h-4 w-4" />
            {format(timeSlot.start, "EEEE, MMMM d, yyyy")}
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {format(timeSlot.start, "h:mm a")} - {format(timeSlot.end, "h:mm a")}
          </div>

          {availability.surgeRequired && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                High demand period - {Math.round((availability.surgeMultiplier - 1) * 100)}% surge pricing applies
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="team-select" className="block text-sm font-medium mb-1">
                Team Assignment
              </label>
              <Select value={selectedTeam} onValueChange={setSelectedTeam} required>
                <SelectTrigger id="team-select">
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TEAMS).map(([id, team]) => (
                    <SelectItem key={id} value={id}>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${team.color}`} />
                        {team.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label htmlFor="service-type" className="block text-sm font-medium mb-1">
                Service Type
              </label>
              <Select value={serviceType} onValueChange={setServiceType} required>
                <SelectTrigger id="service-type">
                  <SelectValue placeholder="Select service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic_wash">
                    Basic Wash - ${(calculatePrice("basic_wash", availability.surgeMultiplier) / 100).toFixed(2)}
                  </SelectItem>
                  <SelectItem value="detail">
                    Detail Service - ${(calculatePrice("detail", availability.surgeMultiplier) / 100).toFixed(2)}
                  </SelectItem>
                  <SelectItem value="premium_detail">
                    Premium Detail - $
                    {(calculatePrice("premium_detail", availability.surgeMultiplier) / 100).toFixed(2)}
                  </SelectItem>
                  <SelectItem value="repair">
                    Repair Service - ${(calculatePrice("repair", availability.surgeMultiplier) / 100).toFixed(2)}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label htmlFor="customer-name" className="block text-sm font-medium mb-1">
                  Customer Name *
                </label>
                <input
                  id="customer-name"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </div>

              <div>
                <label htmlFor="customer-email" className="block text-sm font-medium mb-1">
                  Email *
                </label>
                <input
                  id="customer-email"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </div>

              <div>
                <label htmlFor="customer-phone" className="block text-sm font-medium mb-1">
                  Phone
                </label>
                <input
                  id="customer-phone"
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4" />
              <span>
                Capacity: {availability.currentOccupancy}/{availability.maxCapacity}
              </span>
              <Badge variant={availability.occupancyRate > 0.8 ? "destructive" : "secondary"}>
                {Math.round(availability.occupancyRate * 100)}% full
              </Badge>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1 bg-transparent">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !selectedTeam || !customerName || !customerEmail || !serviceType}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Booking...
                  </>
                ) : (
                  "Confirm Booking"
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function BookingsPage() {
  const { tenant } = useTenant()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [selectedAvailability, setSelectedAvailability] = useState<AvailabilityCheck | null>(null)

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 })

  // Fetch team availability for the week
  const { data: availability, isLoading } = useQuery({
    queryKey: ["team-availability", tenant?.id, weekStart.getTime(), weekEnd.getTime()],
    queryFn: async () => {
      if (!tenant?.id) throw new Error("No tenant context")

      // Mock data - in real app would call Convex function
      const mockAvailability = []
      const teams = Object.keys(TEAMS)

      for (let day = 0; day < 7; day++) {
        const currentDay = addDays(weekStart, day)

        // Generate time slots for business hours (9 AM - 5 PM)
        for (let hour = 9; hour < 17; hour += 2) {
          const start = new Date(currentDay)
          start.setHours(hour, 0, 0, 0)
          const end = new Date(start)
          end.setHours(hour + 2, 0, 0, 0)

          for (const teamId of teams) {
            const occupancyRate = Math.random()
            const maxCapacity = 3
            const currentOccupancy = Math.floor(occupancyRate * maxCapacity)

            mockAvailability.push({
              timeSlot: {
                start: start.getTime(),
                end: end.getTime(),
                duration: 120,
                teamId,
                capacity: maxCapacity,
              },
              availability: {
                isAvailable: currentOccupancy < maxCapacity,
                currentOccupancy,
                maxCapacity,
                occupancyRate,
                conflictingBookings: [],
                surgeRequired: occupancyRate > 0.8,
                surgeMultiplier: occupancyRate > 0.8 ? 1 + (occupancyRate - 0.8) * 2 : 1.0,
              },
            })
          }
        }
      }

      return mockAvailability
    },
    enabled: !!tenant?.id,
  })

  // Create booking mutation
  const createBookingMutation = useMutation({
    mutationFn: async (bookingData: any) => {
      if (!tenant?.id) throw new Error("No tenant context")

      // Mock booking creation - in real app would call Convex mutation
      console.log("Creating booking:", bookingData)

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      return { id: `booking_${Date.now()}`, ...bookingData }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-availability"] })
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
    },
  })

  const handleSlotClick = (timeSlot: TimeSlot, availabilityCheck: AvailabilityCheck) => {
    if (!availabilityCheck.isAvailable) return

    setSelectedSlot(timeSlot)
    setSelectedAvailability(availabilityCheck)
  }

  const handleBookingConfirm = async (bookingData: any) => {
    await createBookingMutation.mutateAsync(bookingData)
  }

  const renderWeekView = () => {
    if (!availability) return null

    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    const hours = Array.from({ length: 4 }, (_, i) => 9 + i * 2) // 9 AM, 11 AM, 1 PM, 3 PM

    return (
      <div className="grid grid-cols-8 gap-1 text-sm">
        {/* Header row */}
        <div className="p-2 font-medium">Time</div>
        {days.map((day) => (
          <div key={day.toISOString()} className="p-2 font-medium text-center">
            <div>{format(day, "EEE")}</div>
            <div className="text-xs text-muted-foreground">{format(day, "M/d")}</div>
          </div>
        ))}

        {/* Time slots */}
        {hours.map((hour) => (
          <div key={hour} className="contents">
            <div className="p-2 text-xs text-muted-foreground border-r">
              {format(new Date().setHours(hour, 0, 0, 0), "h:mm a")}
            </div>
            {days.map((day) => {
              const daySlots = availability.filter((slot) => {
                const slotDate = new Date(slot.timeSlot.start)
                return isSameDay(slotDate, day) && slotDate.getHours() === hour
              })

              return (
                <div key={`${day.toISOString()}-${hour}`} className="p-1 min-h-[80px] border-r border-b">
                  <div className="space-y-1">
                    {Object.entries(TEAMS).map(([teamId, team]) => {
                      const slot = daySlots.find((s) => s.timeSlot.teamId === teamId)
                      if (!slot) return null

                      const { timeSlot, availability: avail } = slot
                      const isAvailable = avail.isAvailable
                      const isBusy = avail.occupancyRate > 0.5

                      return (
                        <button
                          key={teamId}
                          onClick={() => handleSlotClick(timeSlot, avail)}
                          disabled={!isAvailable}
                          className={`
                            w-full text-xs p-1 rounded transition-colors
                            ${isAvailable ? "hover:opacity-80 cursor-pointer" : "opacity-50 cursor-not-allowed"}
                            ${team.color} text-white
                            ${avail.surgeRequired ? "ring-2 ring-yellow-400" : ""}
                          `}
                          aria-label={`${team.name} at ${format(timeSlot.start, "h:mm a")} - ${isAvailable ? "Available" : "Unavailable"}`}
                        >
                          <div className="truncate">{team.name.split(" ")[0]}</div>
                          <div className="flex items-center justify-between">
                            <span>
                              {avail.currentOccupancy}/{avail.maxCapacity}
                            </span>
                            {avail.surgeRequired && <span>⚡</span>}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin" />
          <p className="mt-2 text-sm text-muted-foreground">Loading tenant context...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Booking Calendar</h1>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => setSelectedDate(addDays(selectedDate, -7))}
            aria-label="Previous week"
          >
            ← Previous Week
          </Button>
          <span className="font-medium">
            {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
          </span>
          <Button variant="outline" onClick={() => setSelectedDate(addDays(selectedDate, 7))} aria-label="Next week">
            Next Week →
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Legend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(TEAMS).map(([id, team]) => (
              <div key={id} className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded ${team.color}`} />
                <span className="text-sm">{team.name}</span>
              </div>
            ))}
            <div className="pt-2 border-t space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span>⚡</span>
                <span>Surge pricing</span>
              </div>
              <div className="text-xs text-muted-foreground">Click available slots to book</div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Weekly Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">{renderWeekView()}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedSlot && selectedAvailability && (
        <BookingModal
          timeSlot={selectedSlot}
          availability={selectedAvailability}
          onClose={() => {
            setSelectedSlot(null)
            setSelectedAvailability(null)
          }}
          onConfirm={handleBookingConfirm}
        />
      )}
    </div>
  )
}
