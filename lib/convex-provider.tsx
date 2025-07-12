"use client"

import { ConvexReactClient } from "convex/react"
import { ClerkProvider, useAuth } from "@clerk/nextjs"
import { ConvexProviderWithClerk } from "convex/react-clerk"
import type React from "react"

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL

// Check if convexUrl is defined. If not, provide a default or throw an error.
// For local development, it's common to have it undefined if `convex dev` isn't running.
// In production, it must be set.
if (!convexUrl && process.env.NODE_ENV === "development") {
  console.warn(
    "NEXT_PUBLIC_CONVEX_URL is not set. If you are running locally, ensure `convex dev` is running and your .env.local file is populated. The Convex client will not connect.",
  )
} else if (!convexUrl && process.env.NODE_ENV === "production") {
  throw new Error("NEXT_PUBLIC_CONVEX_URL must be set in production environment.")
}

// Initialize ConvexReactClient only if convexUrl is available, otherwise it will be null
// This allows the app to render even if Convex isn't connected, showing a warning instead of crashing.
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null

export default function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode
}) {
  if (!convex) {
    // Render children directly if Convex client couldn't be initialized (e.g., missing URL in dev)
    // This allows the app to run without a Convex connection, which is useful for UI development.
    return <>{children}</>
  }

  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  )
}
