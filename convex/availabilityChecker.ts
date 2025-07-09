import type { QueryCtx } from "./_generated/server"
import { getCurrentUser } from "./auth"
import {
  DEFAULT_TEAMS,
  calculateSurgeMultiplier,
  isTeamAvailable,
  type AvailabilityCheck,
  type TimeSlot,
} from "./schedulingUtils"

// Check availability for a specific time slot and team
export async function checkAvailability(ctx: QueryCtx, timeSlot: TimeSlot, teamId: string): Promise<AvailabilityCheck> {
  const user = await getCurrentUser(ctx)
  if (!user?.tenantId) {
    throw new Error("Unauthorized: No tenant context")
  }

  const team = DEFAULT_TEAMS[teamId]
  if (!team) {
    throw new Error(`Invalid team ID: ${teamId}`)
  }

  // Check if team is available during this time slot
  if (!isTeamAvailable(team, timeSlot)) {
    return {
      isAvailable: false,
      currentOccupancy: 0,
      maxCapacity: team.maxConcurrentJobs,
      occupancyRate: 0,
      conflictingBookings: [],
      surgeRequired: false,
      surgeMultiplier: 1.0,
    }
  }

  // Get existing bookings that overlap with the requested time slot
  const overlappingBookings = await ctx.db
    .query("bookings")
    .withIndex("by_tenant_scheduled", (q) => q.eq("tenantId", user.tenantId))
    .filter((q) =>
      q.and(
        // Booking is assigned to the same team
        q.eq(q.field("assignedTechnician"), teamId),
        // Booking is not cancelled
        q.neq(q.field("status"), "cancelled"),
        q.neq(q.field("status"), "no_show"),
        // Time overlap check: booking starts before our slot ends AND booking ends after our slot starts
        q.and(q.lt(q.field("scheduledStart"), timeSlot.end), q.gt(q.field("scheduledEnd"), timeSlot.start)),
      ),
    )
    .collect()

  const currentOccupancy = overlappingBookings.length
  const maxCapacity = team.maxConcurrentJobs
  const occupancyRate = currentOccupancy / maxCapacity

  const isAvailable = currentOccupancy < maxCapacity
  const surgeRequired = occupancyRate >= 0.8 // 80% threshold
  const surgeMultiplier = calculateSurgeMultiplier(occupancyRate)

  return {
    isAvailable,
    currentOccupancy,
    maxCapacity,
    occupancyRate,
    conflictingBookings: overlappingBookings.map((b) => b._id),
    surgeRequired,
    surgeMultiplier,
  }
}

// Get team availability for a date range
export async function getTeamAvailability(
  ctx: QueryCtx,
  teamId: string,
  startDate: number,
  endDate: number,
): Promise<Array<{ timeSlot: TimeSlot; availability: AvailabilityCheck }>> {
  const user = await getCurrentUser(ctx)
  if (!user?.tenantId) {
    throw new Error("Unauthorized: No tenant context")
  }

  const team = DEFAULT_TEAMS[teamId]
  if (!team) {
    throw new Error(`Invalid team ID: ${teamId}`)
  }

  const availability = []
  const slotDuration = 120 // 2 hours
  const current = new Date(startDate)
  const end = new Date(endDate)

  // Generate time slots every 2 hours during business hours
  while (current < end) {
    const timeSlot: TimeSlot = {
      start: current.getTime(),
      end: current.getTime() + slotDuration * 60 * 1000,
      duration: slotDuration,
      teamId,
      capacity: team.maxConcurrentJobs,
    }

    if (isTeamAvailable(team, timeSlot)) {
      const availabilityCheck = await checkAvailability(ctx, timeSlot, teamId)
      availability.push({
        timeSlot,
        availability: availabilityCheck,
      })
    }

    // Move to next slot (2 hours)
    current.setTime(current.getTime() + slotDuration * 60 * 1000)
  }

  return availability
}

// Find best available time slot for a service
export async function findBestTimeSlot(
  ctx: QueryCtx,
  serviceType: string,
  preferredDate?: number,
  teamPreference?: string,
): Promise<{ timeSlot: TimeSlot; teamId: string; availability: AvailabilityCheck } | null> {
  const user = await getCurrentUser(ctx)
  if (!user?.tenantId) {
    throw new Error("Unauthorized: No tenant context")
  }

  // Filter teams by service capability
  const capableTeams = Object.values(DEFAULT_TEAMS).filter((team) => team.skills.includes(serviceType))

  if (capableTeams.length === 0) {
    return null
  }

  const searchStart = preferredDate || Date.now() + 60 * 60 * 1000 // 1 hour from now
  const searchEnd = searchStart + 7 * 24 * 60 * 60 * 1000 // 7 days ahead

  // Prioritize preferred team if specified and capable
  const teamsToCheck =
    teamPreference && capableTeams.find((t) => t.teamId === teamPreference)
      ? [
          capableTeams.find((t) => t.teamId === teamPreference)!,
          ...capableTeams.filter((t) => t.teamId !== teamPreference),
        ]
      : capableTeams

  for (const team of teamsToCheck) {
    const availability = await getTeamAvailability(ctx, team.teamId, searchStart, searchEnd)

    // Find first available slot with lowest occupancy
    const availableSlots = availability.filter((slot) => slot.availability.isAvailable)

    if (availableSlots.length > 0) {
      // Sort by occupancy rate (prefer less busy times)
      availableSlots.sort((a, b) => a.availability.occupancyRate - b.availability.occupancyRate)

      return {
        timeSlot: availableSlots[0].timeSlot,
        teamId: team.teamId,
        availability: availableSlots[0].availability,
      }
    }
  }

  return null
}
