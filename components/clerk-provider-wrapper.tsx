"use client"

import { ClerkProvider } from "@clerk/nextjs"
import type { ReactNode } from "react"

interface ClerkProviderWrapperProps {
  children: ReactNode
}

export function ClerkProviderWrapper({ children }: ClerkProviderWrapperProps) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

  // If no Clerk key is provided, render children without Clerk
  if (!publishableKey) {
    console.warn("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY not found. Running without Clerk authentication.")
    return <>{children}</>
  }

  return <ClerkProvider publishableKey={publishableKey}>{children}</ClerkProvider>
}
