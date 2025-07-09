import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { getCurrentUser } from "./auth"

// Queries
export const getBookings = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("scheduled"),
        v.literal("confirmed"),
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("cancelled"),
        v.literal("no_show"),
      ),
    ),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    let query = ctx.db.query("bookings").withIndex("by_tenant", (q) => q.eq("tenantId", user.tenantId))

    if (args.status) {
      query = ctx.db
        .query("bookings")
        .withIndex("by_tenant_status", (q) => q.eq("tenantId", user.tenantId).eq("status", args.status))
    } else if (args.startDate) {
      query = ctx.db
        .query("bookings")
        .withIndex("by_tenant_scheduled", (q) => q.eq("tenantId", user.tenantId).gte("scheduledStart", args.startDate))
    }

    let bookings = await query.order("desc").take(args.limit ?? 50)

    // Additional filtering for date range if needed
    if (args.endDate) {
      bookings = bookings.filter((booking) => booking.scheduledStart <= args.endDate!)
    }

    return bookings
  },
})

export const getBookingById = query({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const booking = await ctx.db.get(args.id)
    if (!booking || booking.tenantId !== user.tenantId) {
      throw new Error("Booking not found or access denied")
    }

    return booking
  },
})

export const getBookingsByTechnician = query({
  args: {
    technician: v.string(),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    let bookings = await ctx.db
      .query("bookings")
      .withIndex("by_tenant_technician", (q) =>
        q.eq("tenantId", user.tenantId).eq("assignedTechnician", args.technician),
      )
      .collect()

    // Filter by date range if provided
    if (args.startDate || args.endDate) {
      bookings = bookings.filter((booking) => {
        if (args.startDate && booking.scheduledStart < args.startDate) return false
        if (args.endDate && booking.scheduledStart > args.endDate) return false
        return true
      })
    }

    return bookings
  },
})

export const searchBookings = query({
  args: {
    searchTerm: v.string(),
    status: v.optional(
      v.union(
        v.literal("scheduled"),
        v.literal("confirmed"),
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("cancelled"),
        v.literal("no_show"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const results = await ctx.db
      .query("bookings")
      .withSearchIndex("search_by_tenant", (q) =>
        q
          .search("bookingNumber", args.searchTerm)
          .eq("tenantId", user.tenantId)
          .eq("status", args.status ?? "scheduled"),
      )
      .take(20)

    return results
  },
})

// Mutations
export const createBooking = mutation({
  args: {
    inspectionId: v.optional(v.id("inspections")),
    estimateId: v.optional(v.id("estimates")),
    bookingNumber: v.string(),
    customerName: v.string(),
    customerEmail: v.string(),
    customerPhone: v.string(),
    vehicleInfo: v.object({
      vin: v.string(),
      make: v.string(),
      model: v.string(),
      year: v.number(),
      color: v.string(),
    }),
    serviceType: v.union(
      v.literal("basic_wash"),
      v.literal("detail"),
      v.literal("premium_detail"),
      v.literal("repair"),
      v.literal("custom"),
    ),
    scheduledStart: v.number(),
    scheduledEnd: v.number(),
    assignedTechnician: v.optional(v.string()),
    location: v.string(),
    specialInstructions: v.optional(v.string()),
    totalAmount: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    // Verify related entities belong to tenant
    if (args.inspectionId) {
      const inspection = await ctx.db.get(args.inspectionId)
      if (!inspection || inspection.tenantId !== user.tenantId) {
        throw new Error("Inspection not found or access denied")
      }
    }

    if (args.estimateId) {
      const estimate = await ctx.db.get(args.estimateId)
      if (!estimate || estimate.tenantId !== user.tenantId) {
        throw new Error("Estimate not found or access denied")
      }
    }

    const now = Date.now()
    const bookingId = await ctx.db.insert("bookings", {
      tenantId: user.tenantId,
      inspectionId: args.inspectionId,
      estimateId: args.estimateId,
      bookingNumber: args.bookingNumber,
      customerName: args.customerName,
      customerEmail: args.customerEmail,
      customerPhone: args.customerPhone,
      vehicleInfo: args.vehicleInfo,
      serviceType: args.serviceType,
      status: "scheduled",
      scheduledStart: args.scheduledStart,
      scheduledEnd: args.scheduledEnd,
      assignedTechnician: args.assignedTechnician,
      location: args.location,
      specialInstructions: args.specialInstructions,
      totalAmount: args.totalAmount,
      paidAmount: 0,
      paymentStatus: "pending",
      createdAt: now,
      updatedAt: now,
    })

    return bookingId
  },
})

export const updateBooking = mutation({
  args: {
    id: v.id("bookings"),
    status: v.optional(
      v.union(
        v.literal("scheduled"),
        v.literal("confirmed"),
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("cancelled"),
        v.literal("no_show"),
      ),
    ),
    scheduledStart: v.optional(v.number()),
    scheduledEnd: v.optional(v.number()),
    actualStart: v.optional(v.number()),
    actualEnd: v.optional(v.number()),
    assignedTechnician: v.optional(v.string()),
    specialInstructions: v.optional(v.string()),
    paidAmount: v.optional(v.number()),
    paymentStatus: v.optional(
      v.union(v.literal("pending"), v.literal("partial"), v.literal("paid"), v.literal("refunded")),
    ),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const booking = await ctx.db.get(args.id)
    if (!booking || booking.tenantId !== user.tenantId) {
      throw new Error("Booking not found or access denied")
    }

    const updateData: any = {
      updatedAt: Date.now(),
    }

    if (args.status !== undefined) updateData.status = args.status
    if (args.scheduledStart !== undefined) updateData.scheduledStart = args.scheduledStart
    if (args.scheduledEnd !== undefined) updateData.scheduledEnd = args.scheduledEnd
    if (args.actualStart !== undefined) updateData.actualStart = args.actualStart
    if (args.actualEnd !== undefined) updateData.actualEnd = args.actualEnd
    if (args.assignedTechnician !== undefined) updateData.assignedTechnician = args.assignedTechnician
    if (args.specialInstructions !== undefined) updateData.specialInstructions = args.specialInstructions
    if (args.paidAmount !== undefined) updateData.paidAmount = args.paidAmount
    if (args.paymentStatus !== undefined) updateData.paymentStatus = args.paymentStatus

    await ctx.db.patch(args.id, updateData)
    return args.id
  },
})

export const deleteBooking = mutation({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.tenantId) {
      throw new Error("Unauthorized: No tenant context")
    }

    const booking = await ctx.db.get(args.id)
    if (!booking || booking.tenantId !== user.tenantId) {
      throw new Error("Booking not found or access denied")
    }

    // Only allow deletion of cancelled or scheduled bookings
    if (!["cancelled", "scheduled"].includes(booking.status)) {
      throw new Error("Cannot delete booking in current status")
    }

    await ctx.db.delete(args.id)
    return args.id
  },
})
