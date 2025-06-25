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
  // Register service worker
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // Check version immediately when app opens
      fetch('/api/version', {
        headers: {
          'Cache-Control': 'no-cache'
        }
      }).then(response => response.json())
      .then(data => {
        // Force update check
        navigator.serviceWorker.getRegistration().then(registration => {
          if (registration) {
            registration.update();
          }
        });
      });

      navigator.serviceWorker.register('/sw.js').then(registration => {
        console.log('ServiceWorker registration successful');
        
        // Check for updates every 24 hours
        setInterval(() => {
          registration.update();
        }, 24 * 60 * 60 * 1000); // 24 jam = 1 hari
        
        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              if (confirm('Update tersedia! Klik OK untuk memperbarui aplikasi.')) {
                window.location.reload();
              }
            }
          });
        });
      }).catch(err => {
        console.log('ServiceWorker registration failed:', err);
      });
    });
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <div className="relative flex min-h-screen flex-col">
            {children}
          </div>
        </ThemeProvider>
        <AnalyticsWrapper />
      </body>
    </html>
  )
}
