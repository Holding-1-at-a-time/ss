"use client"

import { ClerkProvider } from "@clerk/nextjs"
import type React from "react"

/**
 * Wraps ClerkProvider but gracefully degrades when
 * NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not set (e.g. local preview).
 */
export function ClerkProviderWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

  // If no key, skip Clerk entirely to avoid runtime error.
  if (!publishableKey) {
    return <>{children}</>
  }

  return <ClerkProvider publishableKey={publishableKey}>{children}</ClerkProvider>
}
