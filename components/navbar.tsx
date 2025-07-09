"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useAuth, UserButton } from "@clerk/nextjs"
import { useTenant } from "@/lib/tenant-context"
import { useAuthContext } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Building2, ChevronDown, Settings, Users } from "lucide-react"

export function Navbar() {
  const { isSignedIn } = useAuth()
  const { tenant, isLoading: tenantLoading, switchTenant } = useTenant()
  const { user, isLoading: userLoading } = useAuthContext()
  const [isSwitching, setIsSwitching] = useState(false)

  if (tenantLoading || userLoading) {
    return <NavbarSkeleton />
  }

  const handleTenantSwitch = async (tenantId: string) => {
    setIsSwitching(true)
    try {
      await switchTenant(tenantId)
    } finally {
      setIsSwitching(false)
    }
  }

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo and Tenant Info */}
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="flex items-center space-x-2">
              {tenant?.branding.logoUrl ? (
                <Image
                  src={tenant.branding.logoUrl || "/placeholder.svg"}
                  alt={`${tenant.name} logo`}
                  width={32}
                  height={32}
                  className="rounded"
                />
              ) : (
                <Building2 className="h-8 w-8 text-[var(--primary-color,#00ae98)]" />
              )}
              <div className="flex flex-col">
                <span className="font-semibold text-foreground">{tenant?.name || "Slick Solutions"}</span>
                {tenant && <span className="text-xs text-muted-foreground">{tenant.subdomain}.slicksolutions.com</span>}
              </div>
            </Link>

            {user?.isSuperAdmin && (
              <Badge variant="secondary" className="text-xs">
                Super Admin
              </Badge>
            )}
          </div>

          {/* Navigation Links */}
          {isSignedIn && (
            <div className="hidden md:flex items-center space-x-6">
              <Link
                href="/dashboard"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/inspections"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Inspections
              </Link>
              <Link
                href="/estimates"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Estimates
              </Link>
              <Link
                href="/bookings"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Bookings
              </Link>
              {user?.isAdmin && (
                <Link
                  href="/admin"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Admin
                </Link>
              )}
            </div>
          )}

          {/* User Actions */}
          <div className="flex items-center space-x-4">
            {isSignedIn ? (
              <>
                {/* Tenant Selector for Super Admins */}
                {user?.isSuperAdmin && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" disabled={isSwitching}>
                        <Building2 className="h-4 w-4 mr-2" />
                        Switch Tenant
                        <ChevronDown className="h-4 w-4 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Available Tenants</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleTenantSwitch("demo")}>
                        <Building2 className="h-4 w-4 mr-2" />
                        Demo Tenant
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleTenantSwitch("acme")}>
                        <Building2 className="h-4 w-4 mr-2" />
                        Acme Corp
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Settings Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Settings</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/settings/profile">
                        <Users className="h-4 w-4 mr-2" />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    {user?.isAdmin && (
                      <DropdownMenuItem asChild>
                        <Link href="/settings/tenant">
                          <Building2 className="h-4 w-4 mr-2" />
                          Tenant Settings
                        </Link>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* User Button */}
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: "h-8 w-8",
                    },
                  }}
                />
              </>
            ) : (
              <div className="flex items-center space-x-2">
                <Button variant="ghost" asChild>
                  <Link href="/sign-in">Sign In</Link>
                </Button>
                <Button asChild>
                  <Link href="/sign-up">Sign Up</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

function NavbarSkeleton() {
  return (
    <nav className="border-b bg-background/95 backdrop-blur">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-8 w-8 rounded" />
            <div className="flex flex-col space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
      </div>
    </nav>
  )
}
