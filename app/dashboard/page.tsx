"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useAuthContext } from "@/lib/auth-context"
import { useTenant } from "@/lib/tenant-context"
import { ProtectedLayout } from "@/components/protected-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Calendar,
  ClipboardList,
  DollarSign,
  TrendingUp,
  Users,
  Wrench,
  AlertTriangle,
  Clock,
  Plus,
} from "lucide-react"
import Link from "next/link"

interface DashboardStats {
  scheduledInspections: number
  pendingEstimates: number
  activeBookings: number
  monthlyRevenue: number
  completionRate: number
  averageRating: number
}

interface RecentActivity {
  id: string
  type: "inspection" | "estimate" | "booking"
  title: string
  status: "pending" | "completed" | "cancelled"
  timestamp: string
  customer: string
}

export default function DashboardPage() {
  const { user } = useAuthContext()
  const { tenant } = useTenant()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDashboardData()
  }, [user?.tenantId])

  const loadDashboardData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Simulate API calls - replace with actual API endpoints
      const [statsResponse, activityResponse] = await Promise.all([
        fetch("/api/dashboard/stats"),
        fetch("/api/dashboard/activity"),
      ])

      if (!statsResponse.ok || !activityResponse.ok) {
        throw new Error("Failed to load dashboard data")
      }

      const statsData = await statsResponse.json()
      const activityData = await activityResponse.json()

      setStats(statsData)
      setRecentActivity(activityData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard")
      // Fallback data for demo
      setStats({
        scheduledInspections: 12,
        pendingEstimates: 8,
        activeBookings: 5,
        monthlyRevenue: 15420,
        completionRate: 94,
        averageRating: 4.8,
      })
      setRecentActivity([
        {
          id: "1",
          type: "inspection",
          title: "Vehicle Inspection - Honda Civic",
          status: "completed",
          timestamp: "2 hours ago",
          customer: "John Smith",
        },
        {
          id: "2",
          type: "estimate",
          title: "Detailing Estimate - BMW X5",
          status: "pending",
          timestamp: "4 hours ago",
          customer: "Sarah Johnson",
        },
        {
          id: "3",
          type: "booking",
          title: "Full Service Booking",
          status: "pending",
          timestamp: "1 day ago",
          customer: "Mike Wilson",
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <ProtectedLayout>
        <DashboardSkeleton />
      </ProtectedLayout>
    )
  }

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user?.firstName}!</h1>
            <p className="text-muted-foreground">
              Here's what's happening with {tenant?.name || "your business"} today.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button asChild>
              <Link href="/inspections/new">
                <Plus className="h-4 w-4 mr-2" />
                New Inspection
              </Link>
            </Button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Scheduled Inspections"
            value={stats?.scheduledInspections || 0}
            icon={ClipboardList}
            description="This week"
            trend="+12%"
            href="/inspections"
          />
          <StatsCard
            title="Pending Estimates"
            value={stats?.pendingEstimates || 0}
            icon={DollarSign}
            description="Awaiting approval"
            trend="+8%"
            href="/estimates"
          />
          <StatsCard
            title="Active Bookings"
            value={stats?.activeBookings || 0}
            icon={Calendar}
            description="In progress"
            trend="+5%"
            href="/bookings"
          />
          <StatsCard
            title="Monthly Revenue"
            value={`$${stats?.monthlyRevenue?.toLocaleString() || "0"}`}
            icon={TrendingUp}
            description="This month"
            trend="+23%"
            href="/analytics"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Recent Activity */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest updates from your team and customers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center space-x-4 p-3 rounded-lg border">
                    <div className="flex-shrink-0">
                      {activity.type === "inspection" && <ClipboardList className="h-5 w-5 text-blue-500" />}
                      {activity.type === "estimate" && <DollarSign className="h-5 w-5 text-green-500" />}
                      {activity.type === "booking" && <Calendar className="h-5 w-5 text-purple-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{activity.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {activity.customer} • {activity.timestamp}
                      </p>
                    </div>
                    <Badge
                      variant={
                        activity.status === "completed"
                          ? "default"
                          : activity.status === "pending"
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {activity.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Quick Actions
              </CardTitle>
              <CardDescription>Common tasks and shortcuts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild className="w-full justify-start">
                <Link href="/inspections/new">
                  <ClipboardList className="h-4 w-4 mr-2" />
                  New Inspection
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start bg-transparent">
                <Link href="/estimates">
                  <DollarSign className="h-4 w-4 mr-2" />
                  View Estimates
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start bg-transparent">
                <Link href="/bookings/calendar">
                  <Calendar className="h-4 w-4 mr-2" />
                  Team Calendar
                </Link>
              </Button>
              {user?.isAdmin && (
                <Button asChild variant="outline" className="w-full justify-start bg-transparent">
                  <Link href="/team">
                    <Users className="h-4 w-4 mr-2" />
                    Manage Team
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Performance Metrics */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Completion Rate</CardTitle>
              <CardDescription>Percentage of completed jobs this month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <div className="flex-1 bg-secondary rounded-full h-2">
                  <div
                    className="bg-[var(--primary-color,#00ae98)] h-2 rounded-full transition-all"
                    style={{ width: `${stats?.completionRate || 0}%` }}
                  />
                </div>
                <span className="text-sm font-medium">{stats?.completionRate || 0}%</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Customer Rating</CardTitle>
              <CardDescription>Average rating from customer feedback</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold">{stats?.averageRating || 0}</span>
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span
                      key={i}
                      className={`text-lg ${
                        i < Math.floor(stats?.averageRating || 0) ? "text-yellow-400" : "text-gray-300"
                      }`}
                    >
                      ★
                    </span>
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">out of 5</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedLayout>
  )
}

interface StatsCardProps {
  title: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  description: string
  trend: string
  href: string
}

function StatsCard({ title, value, icon: Icon, description, trend, href }: StatsCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <Link href={href}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            <span>{description}</span>
            <Badge variant="secondary" className="text-xs">
              {trend}
            </Badge>
          </div>
        </CardContent>
      </Link>
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-4 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4 p-3 rounded-lg border">
                  <Skeleton className="h-5 w-5" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
