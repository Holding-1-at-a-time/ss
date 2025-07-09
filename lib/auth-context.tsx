"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"

export type UserRole = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "TECHNICIAN" | "CUSTOMER" | "GUEST"

export interface AuthUser {
  id: string
  email: string
  firstName: string
  lastName: string
  imageUrl?: string
  role: UserRole
  tenantId: string
  permissions: string[]
  isAdmin: boolean
  isSuperAdmin: boolean
}

interface AuthContextType {
  user: AuthUser | null
  isLoading: boolean
  hasPermission: (permission: string) => boolean
  hasRole: (role: UserRole) => boolean
  canAccess: (resource: string, action: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider")
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { isLoaded, userId } = useAuth()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!isLoaded) return

    if (!userId) {
      setUser(null)
      setIsLoading(false)
      return
    }

    loadUserProfile()
  }, [isLoaded, userId])

  const loadUserProfile = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/auth/profile")
      if (!response.ok) {
        throw new Error("Failed to load user profile")
      }

      const userData = await response.json()
      setUser(userData)
    } catch (error) {
      console.error("Failed to load user profile:", error)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  const hasPermission = (permission: string): boolean => {
    if (!user) return false
    if (user.isSuperAdmin) return true
    return user.permissions.includes(permission)
  }

  const hasRole = (role: UserRole): boolean => {
    if (!user) return false
    if (user.isSuperAdmin) return true
    return user.role === role
  }

  const canAccess = (resource: string, action: string): boolean => {
    if (!user) return false
    if (user.isSuperAdmin) return true

    const permission = `${action}_${resource}`
    return hasPermission(permission)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, hasPermission, hasRole, canAccess }}>
      {children}
    </AuthContext.Provider>
  )
}
