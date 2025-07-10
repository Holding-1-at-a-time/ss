import { v } from "convex/values"
import { mutation } from "./_generated/server"
import { getCurrentUser } from "./auth"
import { validateTimeSlot, DEFAULT_TEAMS, formatTimeSlot } from "./schedulingUtils"
import { checkAvailability } from "./availabilityChecker"
import { api } from "./_generated/api"

// Main booking appointment mutation with surge pricing and scheduling
export const bookAppointment = mutation({
  args: {
    inspectionId: v.id("inspections"),
    timeSlotISO: v.string(),
    teamId: v.string(),
    estimateId: v.optional(v.id("estimates")),
    customerNotes: v.optional(v.string()),
    location: v.optional(v.string()),
    duration: v.optional(v.number()), // minutes, defaults to 120
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    try {
      // Step 1: Validate inspection exists and belongs to tenant
      const inspection = await ctx.db.get(args.inspectionId)
      if (!inspection || inspection.tenantId !== user.tenantId) {
        throw new Error("Inspection not found or access denied")
      }

      // Step 2: Validate inspection has approved estimate
      let approvedEstimate = null
      if (args.estimateId) {
        approvedEstimate = await ctx.db.get(args.estimateId)
        if (!approvedEstimate || approvedEstimate.tenantId !== user.tenantId) {
          throw new Error("Estimate not found or access denied")
        }
        if (approvedEstimate.status !== "approved") {
          throw new Error(`Estimate must be approved before booking. Current status: ${approvedEstimate.status}`)
        }
      } else {
        // Find any approved estimate for this inspection
        const estimates = await ctx.db
          .query("estimates")
          .withIndex("by_tenant_inspection", (q) =>
            q.eq("tenantId", user.tenantId).eq("inspectionId", args.inspectionId),
          )
          .filter((q) => q.eq(q.field("status"), "approved"))
          .collect()

        if (estimates.length === 0) {
          throw new Error("No approved estimate found for this inspection. Please approve an estimate before booking.")
        }

        approvedEstimate = estimates[0] // Use the first approved estimate
      }

      // Step 3: Validate time slot format and future time
      const timeSlot = validateTimeSlot(args.timeSlotISO, args.duration || 120)
      if (!timeSlot) {
        throw new Error("Invalid time slot. Must be a future time during business hours.")
      }

      // Step 4: Validate team exists and has required skills
      const team = DEFAULT_TEAMS[args.teamId]
      if (!team) {
        throw new Error(`Invalid team ID: ${args.teamId}`)
      }

      if (!team.skills.includes(approvedEstimate.serviceType)) {
        throw new Error(`Team ${team.teamName} is not qualified for ${approvedEstimate.serviceType} service`)
      }

      // Step 5: Check availability and get occupancy info
      const availability = await checkAvailability(ctx, timeSlot, args.teamId)
      if (!availability.isAvailable) {
        throw new Error(
          `Time slot not available. Current occupancy: ${availability.currentOccupancy}/${availability.maxCapacity}`,
        )
      }

      // Step 6: Calculate final pricing with surge if applicable
      let finalAmount = approvedEstimate.total
      let surgeAmount = 0
      let pricingNotes = ""

      if (availability.surgeRequired && availability.surgeMultiplier > 1.0) {
        surgeAmount = Math.round(approvedEstimate.total * (availability.surgeMultiplier - 1))
        finalAmount = approvedEstimate.total + surgeAmount
        pricingNotes = `Surge pricing applied (${Math.round((availability.surgeMultiplier - 1) * 100)}% increase) due to high demand (${Math.round(availability.occupancyRate * 100)}% occupancy)`
      }

      // Step 7: Generate booking number
      const bookingNumber = `BK-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`

      // Step 8: Create booking record (atomic operation)
      const bookingId = await ctx.db.insert("bookings", {
        tenantId: user.tenantId,
        inspectionId: args.inspectionId,
        estimateId: approvedEstimate._id,
        bookingNumber,
        customerName: inspection.customerName,
        customerEmail: inspection.customerEmail,
        customerPhone: inspection.customerPhone,
        vehicleInfo: {
          vin: inspection.vehicleVin,
          make: inspection.vehicleMake,
          model: inspection.vehicleModel,
          year: inspection.vehicleYear,
          color: "Unknown", // Could be added to inspection schema
        },
        serviceType: approvedEstimate.serviceType,
        status: "scheduled",
        scheduledStart: timeSlot.start,
        scheduledEnd: timeSlot.end,
        assignedTechnician: args.teamId,
        location: args.location || "Shop Location",
        specialInstructions: args.customerNotes,
        totalAmount: finalAmount,
        paidAmount: 0,
        paymentStatus: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      // Step 9: Update inspection status
      await ctx.db.patch(args.inspectionId, {
        status: "booked", // Inspection is now booked for service
        bookedAt: Date.now(),
        updatedAt: Date.now(),
      })

      // Step 10: Schedule notifications (fire-and-forget)
      const notificationResult = await ctx.runMutation(api.notificationScheduler.scheduleBookingNotifications, {
        bookingId,
        customerEmail: inspection.customerEmail,
        customerPhone: inspection.customerPhone,
        bookingStart: timeSlot.start,
        serviceType: approvedEstimate.serviceType,
        vehicleInfo: `${inspection.vehicleYear} ${inspection.vehicleMake} ${inspection.vehicleModel}`,
      })

      // Step 11: Get final booking data
      const finalBooking = await ctx.db.get(bookingId)

      return {
        success: true,
        bookingId,
        booking: finalBooking,
        pricingDetails: {
          originalAmount: approvedEstimate.total,
          surgeAmount,
          finalAmount,
          surgeMultiplier: availability.surgeMultiplier,
          occupancyRate: availability.occupancyRate,
          pricingNotes,
        },
        timeSlotDetails: {
          formatted: formatTimeSlot(timeSlot),
          start: timeSlot.start,
          end: timeSlot.end,
          duration: timeSlot.duration,
        },
        teamDetails: {
          teamId: args.teamId,
          teamName: team.teamName,
          skills: team.skills,
        },
        notifications: {
          scheduled: notificationResult.totalNotifications,
          jobs: notificationResult.scheduledJobs,
        },
        bookedAt: Date.now(),
      }
    } catch (error) {
      console.error("Booking appointment failed:", error)
      throw new Error(error instanceof Error ? error.message : "Failed to book appointment")
    }
  },
})

// Reschedule existing booking
export const rescheduleAppointment = mutation({
  args: {
    bookingId: v.id("bookings"),
    newTimeSlotISO: v.string(),
    newTeamId: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    // Get existing booking
    const booking = await ctx.db.get(args.bookingId)
    if (!booking || booking.tenantId !== user.tenantId) {
      throw new Error("Booking not found or access denied")
    }

    if (booking.status === "completed" || booking.status === "cancelled") {
      throw new Error(`Cannot reschedule ${booking.status} booking`)
    }

    // Validate new time slot
    const newTimeSlot = validateTimeSlot(args.newTimeSlotISO, 120)
    if (!newTimeSlot) {
      throw new Error("Invalid new time slot")
    }

    const teamId = args.newTeamId || booking.assignedTechnician
    const availability = await checkAvailability(ctx, newTimeSlot, teamId)
    if (!availability.isAvailable) {
      throw new Error("New time slot is not available")
    }

    // Calculate new pricing with surge
    const originalEstimate = await ctx.db.get(booking.estimateId!)
    let newAmount = originalEstimate?.total || booking.totalAmount
    let surgeAmount = 0

    if (availability.surgeRequired && availability.surgeMultiplier > 1.0) {
      surgeAmount = Math.round(newAmount * (availability.surgeMultiplier - 1))
      newAmount += surgeAmount
    }

    // Update booking
    await ctx.db.patch(args.bookingId, {
      scheduledStart: newTimeSlot.start,
      scheduledEnd: newTimeSlot.end,
      assignedTechnician: teamId,
      totalAmount: newAmount,
      updatedAt: Date.now(),
    })

    // Cancel old notifications and schedule new ones
    // Note: In a real implementation, you'd track the job IDs from the original booking
    const notificationResult = await ctx.runMutation(api.notificationScheduler.scheduleBookingNotifications, {
      bookingId: args.bookingId,
      customerEmail: booking.customerEmail,
      customerPhone: booking.customerPhone,
      bookingStart: newTimeSlot.start,
      serviceType: booking.serviceType,
      vehicleInfo: `${booking.vehicleInfo.year} ${booking.vehicleInfo.make} ${booking.vehicleInfo.model}`,
    })

    return {
      success: true,
      bookingId: args.bookingId,
      oldTimeSlot: {
        start: booking.scheduledStart,
        end: booking.scheduledEnd,
      },
      newTimeSlot: {
        start: newTimeSlot.start,
        end: newTimeSlot.end,
        formatted: formatTimeSlot(newTimeSlot),
      },
      pricingChange: {
        oldAmount: booking.totalAmount,
        newAmount,
        surgeAmount,
        difference: newAmount - booking.totalAmount,
      },
      reason: args.reason,
      rescheduledAt: Date.now(),
      notifications: notificationResult,
    }
  },
})

// Cancel booking appointment
export const cancelAppointment = mutation({
  args: {
    bookingId: v.id("bookings"),
    reason: v.string(),
    refundAmount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const booking = await ctx.db.get(args.bookingId)
    if (!booking || booking.tenantId !== user.tenantId) {
      throw new Error("Booking not found or access denied")
    }

    if (booking.status === "completed" || booking.status === "cancelled") {
      throw new Error(`Cannot cancel ${booking.status} booking`)
    }

    // Update booking status
    await ctx.db.patch(args.bookingId, {
      status: "cancelled",
      updatedAt: Date.now(),
    })

    // Process refund if applicable
    if (args.refundAmount && args.refundAmount > 0) {
      await ctx.db.patch(args.bookingId, {
        paidAmount: booking.paidAmount - args.refundAmount,
        paymentStatus: booking.paidAmount - args.refundAmount <= 0 ? "refunded" : "partial",
      })
    }

    // Cancel scheduled notifications
    // Note: In a real implementation, you'd track and cancel the specific job IDs

    return {
      success: true,
      bookingId: args.bookingId,
      previousStatus: booking.status,
      reason: args.reason,
      refundAmount: args.refundAmount || 0,
      cancelledAt: Date.now(),
    }
  },
})
