// Scheduling and availability management utilities
export interface TimeSlot {
  start: number // ISO timestamp
  end: number // ISO timestamp
  duration: number // minutes
  teamId: string
  capacity: number // max concurrent bookings
}

export interface AvailabilityCheck {
  isAvailable: boolean
  currentOccupancy: number
  maxCapacity: number
  occupancyRate: number
  conflictingBookings: string[]
  surgeRequired: boolean
  surgeMultiplier: number
}

export interface TeamSchedule {
  teamId: string
  teamName: string
  maxConcurrentJobs: number
  workingHours: {
    start: string // "09:00"
    end: string // "17:00"
    timezone: string
  }
  workingDays: number[] // [1,2,3,4,5] for Mon-Fri
  skills: string[]
  hourlyRate: number
}

// Default team configurations
export const DEFAULT_TEAMS: Record<string, TeamSchedule> = {
  team_alpha: {
    teamId: "team_alpha",
    teamName: "Alpha Team",
    maxConcurrentJobs: 3,
    workingHours: {
      start: "08:00",
      end: "18:00",
      timezone: "America/New_York",
    },
    workingDays: [1, 2, 3, 4, 5], // Monday to Friday
    skills: ["basic_wash", "detail", "premium_detail"],
    hourlyRate: 7500, // $75/hour in cents
  },
  team_bravo: {
    teamId: "team_bravo",
    teamName: "Bravo Team",
    workingHours: {
      start: "09:00",
      end: "17:00",
      timezone: "America/New_York",
    },
    maxConcurrentJobs: 2,
    workingDays: [1, 2, 3, 4, 5, 6], // Monday to Saturday
    skills: ["repair", "premium_detail", "custom"],
    hourlyRate: 9000, // $90/hour in cents
  },
  team_charlie: {
    teamId: "team_charlie",
    teamName: "Charlie Team (Weekend)",
    maxConcurrentJobs: 2,
    workingHours: {
      start: "10:00",
      end: "16:00",
      timezone: "America/New_York",
    },
    workingDays: [0, 6], // Sunday and Saturday
    skills: ["basic_wash", "detail"],
    hourlyRate: 8500, // $85/hour in cents (weekend premium)
  },
}

// Surge pricing thresholds
export const SURGE_THRESHOLDS = {
  LOW_OCCUPANCY: 0.5, // 50%
  NORMAL_OCCUPANCY: 0.8, // 80%
  HIGH_OCCUPANCY: 0.9, // 90%
  CRITICAL_OCCUPANCY: 0.95, // 95%
} as const

export const SURGE_MULTIPLIERS = {
  NORMAL: 1.0,
  MODERATE: 1.3, // 30% increase
  HIGH: 1.6, // 60% increase
  PEAK: 2.0, // 100% increase
} as const

// Time slot validation
export function validateTimeSlot(timeSlotISO: string, duration = 120): TimeSlot | null {
  try {
    const startTime = new Date(timeSlotISO)
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000)

    // Validate future time
    if (startTime.getTime() <= Date.now()) {
      return null
    }

    // Validate business hours (basic check)
    const hour = startTime.getHours()
    if (hour < 8 || hour > 18) {
      return null
    }

    return {
      start: startTime.getTime(),
      end: endTime.getTime(),
      duration,
      teamId: "", // Will be set later
      capacity: 1,
    }
  } catch (error) {
    return null
  }
}

// Check if team is available during time slot
export function isTeamAvailable(team: TeamSchedule, timeSlot: TimeSlot): boolean {
  const startDate = new Date(timeSlot.start)
  const dayOfWeek = startDate.getDay()

  // Check working days
  if (!team.workingDays.includes(dayOfWeek)) {
    return false
  }

  // Check working hours
  const startHour = startDate.getHours()
  const startMinute = startDate.getMinutes()
  const timeString = `${startHour.toString().padStart(2, "0")}:${startMinute.toString().padStart(2, "0")}`

  const endDate = new Date(timeSlot.end)
  const endHour = endDate.getHours()
  const endMinute = endDate.getMinutes()
  const endTimeString = `${endHour.toString().padStart(2, "0")}:${endMinute.toString().padStart(2, "0")}`

  return timeString >= team.workingHours.start && endTimeString <= team.workingHours.end
}

// Calculate surge multiplier based on occupancy
export function calculateSurgeMultiplier(occupancyRate: number): number {
  if (occupancyRate >= SURGE_THRESHOLDS.CRITICAL_OCCUPANCY) {
    return SURGE_MULTIPLIERS.PEAK
  } else if (occupancyRate >= SURGE_THRESHOLDS.HIGH_OCCUPANCY) {
    return SURGE_MULTIPLIERS.HIGH
  } else if (occupancyRate >= SURGE_THRESHOLDS.NORMAL_OCCUPANCY) {
    return SURGE_MULTIPLIERS.MODERATE
  }
  return SURGE_MULTIPLIERS.NORMAL
}

// Generate notification schedule
export function generateNotificationSchedule(bookingStart: number): Array<{ type: string; scheduledFor: number }> {
  const notifications = []
  const bookingTime = new Date(bookingStart)

  // 24 hours before
  const oneDayBefore = new Date(bookingTime.getTime() - 24 * 60 * 60 * 1000)
  if (oneDayBefore.getTime() > Date.now()) {
    notifications.push({
      type: "reminder_24h",
      scheduledFor: oneDayBefore.getTime(),
    })
  }

  // 2 hours before
  const twoHoursBefore = new Date(bookingTime.getTime() - 2 * 60 * 60 * 1000)
  if (twoHoursBefore.getTime() > Date.now()) {
    notifications.push({
      type: "reminder_2h",
      scheduledFor: twoHoursBefore.getTime(),
    })
  }

  // 30 minutes before
  const thirtyMinutesBefore = new Date(bookingTime.getTime() - 30 * 60 * 1000)
  if (thirtyMinutesBefore.getTime() > Date.now()) {
    notifications.push({
      type: "reminder_30m",
      scheduledFor: thirtyMinutesBefore.getTime(),
    })
  }

  return notifications
}

// Format time slot for display
export function formatTimeSlot(timeSlot: TimeSlot): string {
  const start = new Date(timeSlot.start)
  const end = new Date(timeSlot.end)

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  return `${formatDate(start)} from ${formatTime(start)} to ${formatTime(end)}`
}
