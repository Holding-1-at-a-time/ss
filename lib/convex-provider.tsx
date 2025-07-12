"use client"

import { useMemo, type ReactNode } from "react"
import { ConvexReactClient } from "convex/react"
import { useAuth } from "@clerk/nextjs"
import { ConvexProviderWithClerk } from "convex/react-clerk"

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const convex = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL
    if (!url) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("⚠️  NEXT_PUBLIC_CONVEX_URL is not set — Convex features are disabled for this preview.")
      }
      return null
    }
    return new ConvexReactClient(url)
  }, [])

  if (!convex) {
    // Render the app without Convex; queries/mutations will be no-ops.
    return <>{children}</>
  }

  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  )
}
