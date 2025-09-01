import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AnalyticsWrapper } from "@/components/analytics-wrapper"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "BCE EXPRESS - Better Cargo Experience",
  description: "Track your shipments in real-time with BCE EXPRESS's advanced tracking system",
  metadataBase: new URL('https://bcexp.id'),
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "BCE EXPRESS - Better Cargo Experience",
    description: "Track your shipments in real-time with BCE EXPRESS's advanced tracking system",
    siteName: "BCE EXPRESS",
    type: "website"
  },
  robots: {
    index: true,
    follow: true
  },
  verification: {
    google: "AQQg35yUc-gZbo5n28AgkWJUVUIvFVCYTfvaHcvGc6g" // Anda perlu mengganti ini dengan ID verifikasi Google Search Console
  },
  generator: 'amost-v0.1.0'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Service Worker sementara dinonaktifkan untuk debug 408 asset _next
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => r.unregister());
    });
    // Bersihkan cache custom agar fetch langsung ke network
    caches.keys().then(keys => {
      keys.filter(k => k.startsWith('bce-')).forEach(k => caches.delete(k));
    });
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <div className="relative flex min-h-screen flex-col">
            {children}
          </div>
        </ThemeProvider>
        <AnalyticsWrapper />
      </body>
    </html>
  )
}
