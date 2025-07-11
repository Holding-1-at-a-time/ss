"use client"

import type React from "react"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthContext } from "@/lib/auth-context"
import { useTenant } from "@/lib/tenant-context"
import { ProtectedLayout } from "@/components/protected-layout"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Shield, AlertTriangle } from "lucide-react"

interface AdminLayoutProps {
  children: React.ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, isLoading: authLoading } = useAuthContext()
  const { tenant, isLoading: tenantLoading } = useTenant()
  const router = useRouter()

  // Check if user has admin role
  const isAdmin = user?.publicMetadata?.role === "admin" || user?.publicMetadata?.roles?.includes("admin")

  useEffect(() => {
    if (!authLoading && !tenantLoading) {
      if (!user) {
        router.push("/sign-in")
        return
      }

      if (!isAdmin) {
        router.push("/dashboard")
        return
      }
    }
  }, [user, isAdmin, authLoading, tenantLoading, router])

  if (authLoading || tenantLoading) {
    return (
      <ProtectedLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6" />
            <Skeleton className="h-8 w-48" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </ProtectedLayout>
    )
  }

  if (!user || !isAdmin) {
    return (
      <ProtectedLayout>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Access denied. You don't have permission to view this page.</AlertDescription>
        </Alert>
      </ProtectedLayout>
    )
  }

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        {/* Admin Header */}
        <div className="flex items-center gap-2 pb-4 border-b">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Admin Panel</h1>
            <p className="text-muted-foreground">
              Manage {tenant?.name || "your organization"} settings and configuration
            </p>
          </div>
        </div>

        {/* Admin Content */}
        {children}
      </div>
    </ProtectedLayout>
  )
}
