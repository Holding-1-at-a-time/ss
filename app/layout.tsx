import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ClerkProviderWrapper } from "@/components/clerk-provider-wrapper"
import { ThemeProvider } from "@/components/theme-provider"
import { TenantThemeProvider } from "@/components/tenant-theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { ConvexClientProvider } from "@/lib/convex-provider"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Slick Solutions - AI-Powered Vehicle Inspection & Auto Detailing",
  description: "Multi-tenant SaaS platform for modern auto detailing and automotive inspection workflows",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ClerkProviderWrapper>
          <ConvexClientProvider>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
              <TenantThemeProvider>
                {children}
                <Toaster />
              </TenantThemeProvider>
            </ThemeProvider>
          </ConvexClientProvider>
        </ClerkProviderWrapper>
      </body>
    </html>
  )
}
