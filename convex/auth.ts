import type { QueryCtx, MutationCtx } from "./_generated/server"

export interface User {
  tenantId: string
  userId: string
  role: string
}

export async function getCurrentUser(ctx: QueryCtx | MutationCtx): Promise<User | null> {
  // This would integrate with your actual auth system (Clerk, Auth0, etc.)
  // For now, this is a placeholder that shows the expected structure
  const identity = await ctx.auth.getUserIdentity()

  if (!identity) {
    return null
  }

  // Extract tenant information from the auth token or user metadata
  // This implementation depends on your auth provider
  const tenantId = identity.tokenIdentifier.split("|")[0] // Example extraction

  return {
    tenantId,
    userId: identity.subject,
    role: identity.role || "user",
  }
}
