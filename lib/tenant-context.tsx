"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"

interface TenantConfig {
  id: string
  name: string
  subdomain: string
  branding: {
    primaryColor: string
    secondaryColor: string
    logoUrl: string
    faviconUrl: string
  }
  settings: {
    timezone: string
    currency: string
    features: string[]
  }
}

interface TenantContextType {
  tenant: TenantConfig | null
  isLoading: boolean
  error: string | null
  switchTenant: (tenantId: string) => Promise<void>
}

const TenantContext = createContext<TenantContextType | undefined>(undefined)

export function useTenant() {
  const context = useContext(TenantContext)
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider")
  }
  return context
}

interface TenantProviderProps {
  children: React.ReactNode
}

export function TenantProvider({ children }: TenantProviderProps) {
  const { isLoaded, userId } = useAuth()
  const [tenant, setTenant] = useState<TenantConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoaded || !userId) {
      setIsLoading(false)
      return
    }

    loadTenantConfig()
  }, [isLoaded, userId])

  const loadTenantConfig = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Extract subdomain from hostname
      const hostname = window.location.hostname
      const subdomain = hostname.split(".")[0]

      // Fetch tenant config from API
      const response = await fetch(`/api/tenant/${subdomain}`)
      if (!response.ok) {
        throw new Error("Failed to load tenant configuration")
      }

      const tenantData = await response.json()
      setTenant(tenantData)

      // Apply dynamic theme
      applyTenantTheme(tenantData.branding)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setIsLoading(false)
    }
  }

  const applyTenantTheme = (branding: TenantConfig["branding"]) => {
    const root = document.documentElement
    root.style.setProperty("--primary-color", branding.primaryColor)
    root.style.setProperty("--secondary-color", branding.secondaryColor)

    // Update favicon
    const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement
    if (favicon && branding.faviconUrl) {
      favicon.href = branding.faviconUrl
    }
  }

  const switchTenant = async (tenantId: string) => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/tenant/switch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      })

      if (!response.ok) {
        throw new Error("Failed to switch tenant")
      }

      await loadTenantConfig()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to switch tenant")
    }
  }

  return <TenantContext.Provider value={{ tenant, isLoading, error, switchTenant }}>{children}</TenantContext.Provider>
}
