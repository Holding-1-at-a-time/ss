"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { useTenant } from "@/lib/tenant-context"

interface TenantTheme {
  primaryColor: string
  secondaryColor: string
  accentColor: string
  backgroundColor: string
  textColor: string
  borderColor: string
  logoUrl: string
  faviconUrl: string
  fontFamily: string
}

interface TenantThemeContextType {
  theme: TenantTheme | null
  isLoading: boolean
  applyTheme: (theme: TenantTheme) => void
  resetTheme: () => void
}

const TenantThemeContext = createContext<TenantThemeContextType | undefined>(undefined)

export function useTenantTheme() {
  const context = useContext(TenantThemeContext)
  if (context === undefined) {
    throw new Error("useTenantTheme must be used within a TenantThemeProvider")
  }
  return context
}

const defaultTheme: TenantTheme = {
  primaryColor: "#3b82f6", // blue-500
  secondaryColor: "#64748b", // slate-500
  accentColor: "#10b981", // emerald-500
  backgroundColor: "#ffffff",
  textColor: "#1f2937", // gray-800
  borderColor: "#e5e7eb", // gray-200
  logoUrl: "/default-logo.svg",
  faviconUrl: "/favicon.ico",
  fontFamily: "Inter, system-ui, sans-serif",
}

interface TenantThemeProviderProps {
  children: React.ReactNode
}

export function TenantThemeProvider({ children }: TenantThemeProviderProps) {
  const { tenant, isLoading: tenantLoading } = useTenant()
  const [theme, setTheme] = useState<TenantTheme | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (tenantLoading) return

    if (tenant?.branding) {
      const tenantTheme: TenantTheme = {
        primaryColor: tenant.branding.primaryColor || defaultTheme.primaryColor,
        secondaryColor: tenant.branding.secondaryColor || defaultTheme.secondaryColor,
        accentColor: tenant.branding.accentColor || defaultTheme.accentColor,
        backgroundColor: tenant.branding.backgroundColor || defaultTheme.backgroundColor,
        textColor: tenant.branding.textColor || defaultTheme.textColor,
        borderColor: tenant.branding.borderColor || defaultTheme.borderColor,
        logoUrl: tenant.branding.logoUrl || defaultTheme.logoUrl,
        faviconUrl: tenant.branding.faviconUrl || defaultTheme.faviconUrl,
        fontFamily: tenant.branding.fontFamily || defaultTheme.fontFamily,
      }
      applyTheme(tenantTheme)
    } else {
      applyTheme(defaultTheme)
    }

    setIsLoading(false)
  }, [tenant, tenantLoading])

  const applyTheme = (newTheme: TenantTheme) => {
    setTheme(newTheme)

    // Apply CSS custom properties to document root
    const root = document.documentElement
    root.style.setProperty("--color-primary", newTheme.primaryColor)
    root.style.setProperty("--color-secondary", newTheme.secondaryColor)
    root.style.setProperty("--color-accent", newTheme.accentColor)
    root.style.setProperty("--color-background", newTheme.backgroundColor)
    root.style.setProperty("--color-text", newTheme.textColor)
    root.style.setProperty("--color-border", newTheme.borderColor)
    root.style.setProperty("--font-family", newTheme.fontFamily)

    // Apply Tailwind CSS variables
    root.style.setProperty("--tw-color-primary-50", lightenColor(newTheme.primaryColor, 0.95))
    root.style.setProperty("--tw-color-primary-100", lightenColor(newTheme.primaryColor, 0.9))
    root.style.setProperty("--tw-color-primary-200", lightenColor(newTheme.primaryColor, 0.8))
    root.style.setProperty("--tw-color-primary-300", lightenColor(newTheme.primaryColor, 0.6))
    root.style.setProperty("--tw-color-primary-400", lightenColor(newTheme.primaryColor, 0.4))
    root.style.setProperty("--tw-color-primary-500", newTheme.primaryColor)
    root.style.setProperty("--tw-color-primary-600", darkenColor(newTheme.primaryColor, 0.1))
    root.style.setProperty("--tw-color-primary-700", darkenColor(newTheme.primaryColor, 0.2))
    root.style.setProperty("--tw-color-primary-800", darkenColor(newTheme.primaryColor, 0.3))
    root.style.setProperty("--tw-color-primary-900", darkenColor(newTheme.primaryColor, 0.4))

    // Update favicon
    const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement
    if (favicon && newTheme.faviconUrl) {
      favicon.href = newTheme.faviconUrl
    }

    // Update document title with tenant name
    if (tenant?.name) {
      document.title = `${tenant.name} - Slick Solutions`
    }

    // Add tenant-specific CSS classes to body
    document.body.className = document.body.className.replace(/tenant-\w+/g, "")
    if (tenant?.subdomain) {
      document.body.classList.add(`tenant-${tenant.subdomain}`)
    }

    // Store theme preference in localStorage for persistence
    try {
      localStorage.setItem("tenant-theme", JSON.stringify(newTheme))
    } catch (error) {
      console.warn("Failed to persist theme preference:", error)
    }
  }

  const resetTheme = () => {
    applyTheme(defaultTheme)
    try {
      localStorage.removeItem("tenant-theme")
    } catch (error) {
      console.warn("Failed to clear theme preference:", error)
    }
  }

  // Load persisted theme on initial render (SSR-safe)
  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const persistedTheme = localStorage.getItem("tenant-theme")
      if (persistedTheme && !tenant) {
        const theme = JSON.parse(persistedTheme) as TenantTheme
        applyTheme(theme)
      }
    } catch (error) {
      console.warn("Failed to load persisted theme:", error)
    }
  }, [])

  return (
    <TenantThemeContext.Provider value={{ theme, isLoading, applyTheme, resetTheme }}>
      {children}
    </TenantThemeContext.Provider>
  )
}

// Utility functions for color manipulation
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: Number.parseInt(result[1], 16),
        g: Number.parseInt(result[2], 16),
        b: Number.parseInt(result[3], 16),
      }
    : null
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
}

function lightenColor(hex: string, factor: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex

  const r = Math.round(rgb.r + (255 - rgb.r) * factor)
  const g = Math.round(rgb.g + (255 - rgb.g) * factor)
  const b = Math.round(rgb.b + (255 - rgb.b) * factor)

  return rgbToHex(Math.min(255, r), Math.min(255, g), Math.min(255, b))
}

function darkenColor(hex: string, factor: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex

  const r = Math.round(rgb.r * (1 - factor))
  const g = Math.round(rgb.g * (1 - factor))
  const b = Math.round(rgb.b * (1 - factor))

  return rgbToHex(Math.max(0, r), Math.max(0, g), Math.max(0, b))
}
