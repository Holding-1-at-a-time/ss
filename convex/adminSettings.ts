import { v } from "convex/values"
import { query, mutation } from "./_generated/server"
import { requireAdminRole, validateTenantAccess } from "./adminAuth"

// Tenant settings schema with validation
export const TenantSettingsSchema = v.object({
  general: v.object({
    companyName: v.string(),
    timezone: v.string(),
    currency: v.string(),
    dateFormat: v.string(),
    businessHours: v.object({
      start: v.string(), // "09:00"
      end: v.string(), // "17:00"
      workingDays: v.array(v.number()), // [1,2,3,4,5] for Mon-Fri
    }),
    contactInfo: v.object({
      email: v.string(),
      phone: v.string(),
      address: v.string(),
    }),
  }),
  pricing: v.object({
    defaultLaborRate: v.number(), // cents per hour
    defaultMaterialRate: v.number(), // percentage (0.0-1.0)
    defaultTaxRate: v.number(), // percentage (0.0-1.0)
    minimumCharge: v.number(), // cents
    surgeEnabled: v.boolean(),
    maxSurgeMultiplier: v.number(),
    weatherAdjustments: v.boolean(),
  }),
  notifications: v.object({
    emailEnabled: v.boolean(),
    smsEnabled: v.boolean(),
    reminderTiming: v.object({
      hours24: v.boolean(),
      hours2: v.boolean(),
      minutes30: v.boolean(),
    }),
    adminNotifications: v.object({
      newBookings: v.boolean(),
      cancellations: v.boolean(),
      paymentIssues: v.boolean(),
    }),
  }),
  integrations: v.object({
    paymentProcessor: v.optional(
      v.object({
        provider: v.string(), // "stripe", "square", etc.
        enabled: v.boolean(),
        testMode: v.boolean(),
      }),
    ),
    weatherApi: v.optional(
      v.object({
        provider: v.string(),
        enabled: v.boolean(),
      }),
    ),
    emailService: v.optional(
      v.object({
        provider: v.string(), // "sendgrid", "ses", etc.
        enabled: v.boolean(),
      }),
    ),
  }),
  security: v.object({
    sessionTimeout: v.number(), // minutes
    passwordPolicy: v.object({
      minLength: v.number(),
      requireUppercase: v.boolean(),
      requireNumbers: v.boolean(),
      requireSymbols: v.boolean(),
    }),
    auditLogRetention: v.number(), // days
    dataRetention: v.number(), // days
  }),
})

// Get tenant settings with admin validation
export const getSettings = query({
  args: {
    tenantId: v.string(),
  },
  handler: async (ctx, args) => {
    // Enforce admin role and validate tenant access
    await requireAdminRole(ctx, "MANAGE_SETTINGS")
    await validateTenantAccess(ctx, args.tenantId)

    const settings = await ctx.db
      .query("tenantSettings")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .first()

    if (!settings) {
      // Return default settings if none exist
      return getDefaultSettings(args.tenantId)
    }

    return {
      tenantId: settings.tenantId,
      settings: settings.settings,
      version: settings.version,
      lastUpdatedBy: settings.lastUpdatedBy,
      lastUpdatedAt: settings.lastUpdatedAt,
      createdAt: settings.createdAt,
    }
  },
})

// Update tenant settings with validation and versioning
export const updateSettings = mutation({
  args: {
    tenantId: v.string(),
    settings: TenantSettingsSchema,
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Enforce admin role and validate tenant access
    const adminUser = await requireAdminRole(ctx, "MANAGE_SETTINGS")
    await validateTenantAccess(ctx, args.tenantId)

    const now = Date.now()

    // Get existing settings for versioning
    const existingSettings = await ctx.db
      .query("tenantSettings")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .first()

    let newVersion = 1
    if (existingSettings) {
      newVersion = existingSettings.version + 1

      // Archive old settings
      await ctx.db.insert("tenantSettingsHistory", {
        tenantId: args.tenantId,
        version: existingSettings.version,
        settings: existingSettings.settings,
        updatedBy: existingSettings.lastUpdatedBy,
        updatedAt: existingSettings.lastUpdatedAt,
        archivedAt: now,
      })

      // Update existing record
      await ctx.db.patch(existingSettings._id, {
        settings: args.settings,
        version: newVersion,
        lastUpdatedBy: adminUser.userId,
        lastUpdatedAt: now,
        updateReason: args.reason,
      })
    } else {
      // Create new settings record
      await ctx.db.insert("tenantSettings", {
        tenantId: args.tenantId,
        settings: args.settings,
        version: newVersion,
        lastUpdatedBy: adminUser.userId,
        lastUpdatedAt: now,
        createdAt: now,
        updateReason: args.reason,
      })
    }

    // Log audit event
    await ctx.runMutation("auditLogger:logAuditEvent", {
      tenantId: args.tenantId,
      userId: adminUser.userId,
      action: "SETTINGS_UPDATED",
      entityType: "tenant_settings",
      entityId: args.tenantId,
      changes: {
        version: newVersion,
        reason: args.reason,
      },
    })

    return {
      success: true,
      tenantId: args.tenantId,
      version: newVersion,
      updatedAt: now,
    }
  },
})

// Get pricing rules for tenant
export const getPricingRules = query({
  args: {
    tenantId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdminRole(ctx, "MANAGE_PRICING")
    await validateTenantAccess(ctx, args.tenantId)

    const rules = await ctx.db
      .query("pricingRules")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect()

    return rules
  },
})

// Update pricing rule
export const updatePricingRule = mutation({
  args: {
    tenantId: v.string(),
    ruleId: v.id("pricingRules"),
    updates: v.object({
      name: v.optional(v.string()),
      description: v.optional(v.string()),
      serviceTypes: v.optional(v.array(v.string())),
      conditions: v.optional(v.any()), // Flexible rule conditions
      adjustments: v.optional(
        v.object({
          type: v.union(v.literal("percentage"), v.literal("fixed")),
          value: v.number(),
        }),
      ),
      enabled: v.optional(v.boolean()),
      priority: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const adminUser = await requireAdminRole(ctx, "MANAGE_PRICING")
    await validateTenantAccess(ctx, args.tenantId)

    // Get existing rule
    const existingRule = await ctx.db.get(args.ruleId)
    if (!existingRule || existingRule.tenantId !== args.tenantId) {
      throw new Error("Pricing rule not found or access denied")
    }

    const now = Date.now()

    // Update the rule
    await ctx.db.patch(args.ruleId, {
      ...args.updates,
      lastUpdatedBy: adminUser.userId,
      lastUpdatedAt: now,
    })

    // Log audit event
    await ctx.runMutation("auditLogger:logAuditEvent", {
      tenantId: args.tenantId,
      userId: adminUser.userId,
      action: "PRICING_RULE_UPDATED",
      entityType: "pricing_rule",
      entityId: args.ruleId,
      changes: args.updates,
    })

    return {
      success: true,
      ruleId: args.ruleId,
      updatedAt: now,
    }
  },
})

// Default settings factory
function getDefaultSettings(tenantId: string) {
  return {
    tenantId,
    settings: {
      general: {
        companyName: "Auto Detail Shop",
        timezone: "America/New_York",
        currency: "USD",
        dateFormat: "MM/DD/YYYY",
        businessHours: {
          start: "09:00",
          end: "17:00",
          workingDays: [1, 2, 3, 4, 5], // Mon-Fri
        },
        contactInfo: {
          email: "contact@example.com",
          phone: "(555) 123-4567",
          address: "123 Main St, City, State 12345",
        },
      },
      pricing: {
        defaultLaborRate: 7500, // $75.00/hour
        defaultMaterialRate: 0.2, // 20%
        defaultTaxRate: 0.0875, // 8.75%
        minimumCharge: 2500, // $25.00
        surgeEnabled: true,
        maxSurgeMultiplier: 2.0,
        weatherAdjustments: true,
      },
      notifications: {
        emailEnabled: true,
        smsEnabled: false,
        reminderTiming: {
          hours24: true,
          hours2: true,
          minutes30: true,
        },
        adminNotifications: {
          newBookings: true,
          cancellations: true,
          paymentIssues: true,
        },
      },
      integrations: {
        paymentProcessor: {
          provider: "stripe",
          enabled: false,
          testMode: true,
        },
        weatherApi: {
          provider: "openweather",
          enabled: false,
        },
        emailService: {
          provider: "sendgrid",
          enabled: false,
        },
      },
      security: {
        sessionTimeout: 480, // 8 hours
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireNumbers: true,
          requireSymbols: false,
        },
        auditLogRetention: 2555, // 7 years
        dataRetention: 2555, // 7 years
      },
    },
    version: 1,
    lastUpdatedBy: "system",
    lastUpdatedAt: Date.now(),
    createdAt: Date.now(),
  }
}
