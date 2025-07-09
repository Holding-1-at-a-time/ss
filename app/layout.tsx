import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"
import { TenantProvider } from "@/lib/tenant-context"
import { AuthProvider } from "@/lib/auth-context"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Slick Solutions - AI-Powered Vehicle Inspection",
  description: "Multi-tenant SaaS platform for vehicle inspection and auto detailing",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={inter.className}>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
            <TenantProvider>
              <AuthProvider>
                {children}
                <Toaster />
              </AuthProvider>
            </TenantProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
