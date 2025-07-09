import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

// Create session
export const createSession = mutation({
  args: {
    userId: v.string(),
    sessionId: v.string(),
    createdAt: v.number(),
    lastActiveAt: v.number(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if session already exists
    const existingSession = await ctx.db
      .query("userSessions")
      .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
      .first()

    if (existingSession) {
      // Update existing session
      await ctx.db.patch(existingSession._id, {
        lastActiveAt: args.lastActiveAt,
        updatedAt: Date.now(),
      })
      return existingSession._id
    }

    // Create new session
    const sessionDbId = await ctx.db.insert("userSessions", {
      userId: args.userId,
      sessionId: args.sessionId,
      isActive: true,
      createdAt: args.createdAt,
      lastActiveAt: args.lastActiveAt,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      updatedAt: Date.now(),
    })

    // Update user's last login
    const user = await ctx.db
      .query("users")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first()

    if (user) {
      await ctx.db.patch(user._id, {
        lastLoginAt: args.createdAt,
        updatedAt: Date.now(),
      })
    }

    return sessionDbId
  },
})

// End session
export const endSession = mutation({
  args: {
    sessionId: v.string(),
    endedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("userSessions")
      .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
      .first()

    if (!session) {
      throw new Error(`Session ${args.sessionId} not found`)
    }

    await ctx.db.patch(session._id, {
      isActive: false,
      endedAt: args.endedAt,
      updatedAt: Date.now(),
    })

    return session._id
  },
})

// Update session activity
export const updateSessionActivity = mutation({
  args: {
    sessionId: v.string(),
    lastActiveAt: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("userSessions")
      .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
      .first()

    if (!session) {
      throw new Error(`Session ${args.sessionId} not found`)
    }

    await ctx.db.patch(session._id, {
      lastActiveAt: args.lastActiveAt,
      updatedAt: Date.now(),
    })

    return session._id
  },
})

// Get active sessions for user
export const getActiveSessions = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("userSessions")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect()

    return sessions
  },
})

// Clean up expired sessions
export const cleanupExpiredSessions = mutation({
  args: {
    expirationThreshold: v.number(), // Timestamp before which sessions are considered expired
  },
  handler: async (ctx, args) => {
    const expiredSessions = await ctx.db
      .query("userSessions")
      .filter((q) => q.and(q.eq(q.field("isActive"), true), q.lt(q.field("lastActiveAt"), args.expirationThreshold)))
      .collect()

    let cleanedCount = 0
    for (const session of expiredSessions) {
      await ctx.db.patch(session._id, {
        isActive: false,
        endedAt: Date.now(),
        updatedAt: Date.now(),
      })
      cleanedCount++
    }

    return {
      cleanedCount,
      expiredSessions: expiredSessions.length,
    }
  },
})
