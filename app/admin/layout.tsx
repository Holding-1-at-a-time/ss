import type React from "react"
import type { Metadata } from "next"
import AdminLayoutClient from "./AdminLayoutClient"

interface AdminLayoutProps {
  children: React.ReactNode
}

export const metadata: Metadata = {
  title: "Admin Dashboard - Slick Solutions",
  description: "Manage tenant settings, pricing rules, and team members",
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>
}
