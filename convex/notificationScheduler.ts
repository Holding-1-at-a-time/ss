import { v } from "convex/values"
import { mutation, action } from "./_generated/server"
import { getCurrentUser } from "./auth"
import { generateNotificationSchedule } from "./schedulingUtils"

// Schedule booking notifications
export const scheduleBookingNotifications = mutation({
  args: {
    bookingId: v.id("bookings"),
    customerEmail: v.string(),
    customerPhone: v.string(),
    bookingStart: v.number(),
    serviceType: v.string(),
    vehicleInfo: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const notifications = generateNotificationSchedule(args.bookingStart)
    const scheduledJobs = []

    for (const notification of notifications) {
      // Schedule each notification
      const jobId = await ctx.scheduler.runAt(notification.scheduledFor, "notificationScheduler:sendBookingReminder", {
        tenantId: user.tenantId,
        bookingId: args.bookingId,
        customerEmail: args.customerEmail,
        customerPhone: args.customerPhone,
        notificationType: notification.type,
        serviceType: args.serviceType,
        vehicleInfo: args.vehicleInfo,
      })

      scheduledJobs.push({
        type: notification.type,
        scheduledFor: notification.scheduledFor,
        jobId,
      })
    }

    return {
      bookingId: args.bookingId,
      scheduledJobs,
      totalNotifications: scheduledJobs.length,
    }
  },
})

// Send booking reminder (scheduled function)
export const sendBookingReminder = action({
  args: {
    tenantId: v.string(),
    bookingId: v.id("bookings"),
    customerEmail: v.string(),
    customerPhone: v.string(),
    notificationType: v.string(),
    serviceType: v.string(),
    vehicleInfo: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Get current booking status
      const booking = await ctx.db.get(args.bookingId)

      if (!booking || booking.tenantId !== args.tenantId) {
        console.log(`Booking ${args.bookingId} not found or access denied`)
        return { success: false, reason: "Booking not found" }
      }

      // Don't send reminders for cancelled bookings
      if (booking.status === "cancelled" || booking.status === "no_show") {
        console.log(`Booking ${args.bookingId} is ${booking.status}, skipping reminder`)
        return { success: false, reason: `Booking is ${booking.status}` }
      }

      // Simulate sending email/SMS notification
      const message = generateReminderMessage(args.notificationType, {
        customerName: booking.customerName,
        serviceType: args.serviceType,
        vehicleInfo: args.vehicleInfo,
        scheduledTime: new Date(booking.scheduledStart).toLocaleString(),
        location: booking.location,
      })

      // In a real implementation, you would integrate with:
      // - Email service (SendGrid, AWS SES, etc.)
      // - SMS service (Twilio, AWS SNS, etc.)
      console.log(`Sending ${args.notificationType} reminder to ${args.customerEmail}:`, message)

      // Log the notification
      await ctx.db.insert("notificationLogs", {
        tenantId: args.tenantId,
        bookingId: args.bookingId,
        type: args.notificationType,
        recipient: args.customerEmail,
        message,
        status: "sent",
        sentAt: Date.now(),
      })

      return {
        success: true,
        notificationType: args.notificationType,
        recipient: args.customerEmail,
        sentAt: Date.now(),
      }
    } catch (error) {
      console.error("Failed to send booking reminder:", error)

      // Log the failure
      await ctx.db.insert("notificationLogs", {
        tenantId: args.tenantId,
        bookingId: args.bookingId,
        type: args.notificationType,
        recipient: args.customerEmail,
        message: "",
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        sentAt: Date.now(),
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  },
})

// Cancel scheduled notifications for a booking
export const cancelBookingNotifications = mutation({
  args: {
    bookingId: v.id("bookings"),
    jobIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const cancelledJobs = []

    for (const jobId of args.jobIds) {
      try {
        await ctx.scheduler.cancel(jobId)
        cancelledJobs.push(jobId)
      } catch (error) {
        console.error(`Failed to cancel job ${jobId}:`, error)
      }
    }

    return {
      bookingId: args.bookingId,
      cancelledJobs,
      totalCancelled: cancelledJobs.length,
    }
  },
})

// Generate reminder message based on type
function generateReminderMessage(
  type: string,
  details: {
    customerName: string
    serviceType: string
    vehicleInfo: string
    scheduledTime: string
    location: string
  },
): string {
  const { customerName, serviceType, vehicleInfo, scheduledTime, location } = details

  switch (type) {
    case "reminder_24h":
      return `Hi ${customerName}! This is a reminder that your ${serviceType} service for your ${vehicleInfo} is scheduled for tomorrow at ${scheduledTime} at ${location}. Please reply CONFIRM to confirm your appointment.`

    case "reminder_2h":
      return `Hi ${customerName}! Your ${serviceType} service for your ${vehicleInfo} is starting in 2 hours at ${scheduledTime}. Location: ${location}. We'll see you soon!`

    case "reminder_30m":
      return `Hi ${customerName}! Your ${serviceType} service is starting in 30 minutes. Our team is ready for your ${vehicleInfo} at ${location}.`

    default:
      return `Hi ${customerName}! This is a reminder about your upcoming ${serviceType} service for your ${vehicleInfo} scheduled for ${scheduledTime} at ${location}.`
  }
}
