"use client"

import type React from "react"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield, Settings, Users, DollarSign, FileText, Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useTenant } from "@/lib/tenant-context"
import { useQuery } from "@tanstack/react-query"

interface AdminLayoutProps {
  children: React.ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user } = useAuth()
  const { tenant } = useTenant()
  const router = useRouter()

  // Check admin permissions
  const {
    data: adminUser,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["admin-user", tenant?.id, user?.id],
    queryFn: async () => {
      if (!tenant?.id || !user?.id) throw new Error("No tenant or user context")

      // Mock admin user check - in real app would call Convex query
      const mockAdminUser = {
        tenantId: tenant.id,
        userId: user.id,
        role: "tenant_admin", // or 'manager', 'super_admin'
        permissions: ["MANAGE_SETTINGS", "MANAGE_USERS", "MANAGE_PRICING", "VIEW_AUDIT_LOGS"],
        isSuperAdmin: false,
      }

      return mockAdminUser
    },
    enabled: !!tenant?.id && !!user?.id,
  })

  useEffect(() => {
    if (!isLoading && !adminUser) {
      router.push("/dashboard")
    }
  }, [adminUser, isLoading, router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin" />
          <p className="mt-2 text-sm text-muted-foreground">Checking admin permissions...</p>
        </div>
      </div>
    )
  }

  if (error || !adminUser) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>You don't have permission to access the admin panel.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <p className="text-muted-foreground">
            Role: {adminUser.role} | Tenant: {tenant?.name || tenant?.id}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          <span className="text-sm font-medium">Admin Access</span>
        </div>
      </div>

      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Shop Settings
          </TabsTrigger>
          <TabsTrigger value="pricing" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Pricing Rules
          </TabsTrigger>
          <TabsTrigger value="team" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Team Management
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Audit Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <ShopSettingsTab adminUser={adminUser} />
        </TabsContent>

        <TabsContent value="pricing">
          <PricingRulesTab adminUser={adminUser} />
        </TabsContent>

        <TabsContent value="team">
          <TeamManagementTab adminUser={adminUser} />
        </TabsContent>

        <TabsContent value="audit">
          <AuditLogsTab adminUser={adminUser} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ShopSettingsTab({ adminUser }: { adminUser: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Shop Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Shop settings content will be rendered here</p>
      </CardContent>
    </Card>
  )
}

function PricingRulesTab({ adminUser }: { adminUser: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pricing Rules</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Pricing rules content will be rendered here</p>
      </CardContent>
    </Card>
  )
}

function TeamManagementTab({ adminUser }: { adminUser: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Management</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Team management content will be rendered here</p>
      </CardContent>
    </Card>
  )
}

function AuditLogsTab({ adminUser }: { adminUser: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Logs</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Audit logs content will be rendered here</p>
      </CardContent>
    </Card>
  )
}
