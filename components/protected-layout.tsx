"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import { useAuthContext } from "@/lib/auth-context"
import { Navbar } from "@/components/navbar"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { BarChart3, Calendar, ClipboardList, DollarSign, FileText, Home, Settings, Users } from "lucide-react"
import Link from "next/link"

interface ProtectedLayoutProps {
  children: React.ReactNode
}

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  permission?: string
  badge?: string
  adminOnly?: boolean
}

const navigationItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: Home,
  },
  {
    title: "Inspections",
    href: "/inspections",
    icon: ClipboardList,
    permission: "view_inspections",
  },
  {
    title: "Estimates",
    href: "/estimates",
    icon: FileText,
    permission: "view_estimates",
  },
  {
    title: "Bookings",
    href: "/bookings",
    icon: Calendar,
    permission: "view_bookings",
  },
  {
    title: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    permission: "view_analytics",
    adminOnly: true,
  },
  {
    title: "Team",
    href: "/team",
    icon: Users,
    permission: "manage_users",
    adminOnly: true,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    adminOnly: true,
  },
]

export function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const { isLoaded, isSignedIn } = useAuth()
  const { user, isLoading: userLoading, hasPermission } = useAuthContext()
  const router = useRouter()
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    if (!isLoaded || userLoading) return

    if (!isSignedIn) {
      router.push("/sign-in")
      return
    }

    if (!user) {
      router.push("/onboarding")
      return
    }

    setIsInitialized(true)
  }, [isLoaded, isSignedIn, user, userLoading, router])

  if (!isLoaded || userLoading || !isInitialized) {
    return <ProtectedLayoutSkeleton />
  }

  if (!isSignedIn || !user) {
    return null
  }

  const filteredNavItems = navigationItems.filter((item) => {
    // Always show dashboard
    if (item.href === "/dashboard") return true

    // Check admin-only items
    if (item.adminOnly && !user.isAdmin && !user.isSuperAdmin) return false

    // Check permissions
    if (item.permission && !hasPermission(item.permission)) return false

    return true
  })

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar items={filteredNavItems} user={user} />
        <SidebarInset className="flex-1">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <div className="flex-1">
              <Navbar />
            </div>
          </header>
          <main className="flex-1 p-6">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}

interface AppSidebarProps {
  items: NavItem[]
  user: any
}

function AppSidebar({ items, user }: AppSidebarProps) {
  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between">
            Navigation
            {user.role && (
              <Badge variant="outline" className="text-xs">
                {user.role.toLowerCase().replace("_", " ")}
              </Badge>
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild>
                    <Link href={item.href} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      {item.badge && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {item.badge}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Quick Actions */}
        <SidebarGroup>
          <SidebarGroupLabel>Quick Actions</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/inspections/new" className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    <span>New Inspection</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/estimates/new" className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    <span>Create Estimate</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/bookings/schedule" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Schedule Service</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}

function ProtectedLayoutSkeleton() {
  return (
    <div className="flex min-h-screen">
      <div className="w-64 border-r bg-muted/40 p-4">
        <div className="space-y-4">
          <Skeleton className="h-8 w-32" />
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </div>
      </div>
      <div className="flex-1">
        <div className="border-b p-4">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="p-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
