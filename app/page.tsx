"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import gsap from "gsap"
import { Navbar } from "@/components/navbar"
import { Hero } from "@/components/hero"
import CekOngkir from '@/components/cek-ongkir'
import { Footer } from "@/components/footer"
import { QRScanner } from "@/components/qr-scanner"

export default function Home() {
  const router = useRouter()
  const [showScanner, setShowScanner] = useState(false)
  const [count, setCount] = useState(0)
  const countRef = useRef<HTMLDivElement>(null)
  const hasAnimated = useRef(false)

  const handleScanSuccess = (scannedAWB: string) => {
    setShowScanner(false)

    if (scannedAWB) {
      router.push(`/track/${scannedAWB}`)
    }
  }

  const handleCloseScanner = () => {
    setShowScanner(false)
  }

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('id-ID').format(num)
  }

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated.current) {
            hasAnimated.current = true
            const targetCount = 1000000
            const duration = 2000
            const increment = targetCount / (duration / 16)
            
            let current = 0
            const timer = setInterval(() => {
              current += increment
              if (current >= targetCount) {
                setCount(targetCount)
                clearInterval(timer)
              } else {
                setCount(Math.floor(current))
              }
            }, 16)
          }
        })
      },
      { threshold: 0.3 }
    )

    if (countRef.current) {
      observer.observe(countRef.current)
    }

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (showScanner) {
      gsap.fromTo(
        ".qr-scanner-container",
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }
      )
    } else {
      gsap.to(
        ".qr-scanner-container",
        { opacity: 0, y: 20, duration: 0.4, ease: "power3.in" }
      )
    }
  }, [showScanner])

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-4 md:py-8 flex flex-col items-center">
        {!showScanner ? (
          <div className="w-full mx-auto bg-card rounded-2xl shadow-xl p-4 md:p-10 flex flex-col items-center gap-3 md:gap-6">
            <Hero onScanClickAction={() => setShowScanner(true)} />
          </div>
        ) : (
          <div className="qr-scanner-container w-full mx-auto bg-card p-8 rounded-2xl shadow-2xl mt-8">
            <QRScanner onScan={handleScanSuccess} onClose={handleCloseScanner} />
          </div>
        )}
      </main>

      <section className="py-6">
        <div className="container mx-auto px-4">
          <div className="w-full max-w-xl mx-auto">
            <CekOngkir />
          </div>
        </div>
      </section>

      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <div className="w-full mx-auto bg-card rounded-2xl shadow-xl p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">

              <div ref={countRef} className="text-center relative group">
                <div className="absolute inset-0 bg-white/30 dark:bg-white/10 rounded-xl blur-xl group-hover:bg-white/40 dark:group-hover:bg-white/20 transition-all duration-300" />
                <div className="relative">
                  <h2 className="text-xl md:text-2xl font-bold text-foreground mb-3">Total Pengiriman Sukses</h2>
                  <p className="text-3xl md:text-5xl font-extrabold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent mb-2">
                    +{formatNumber(count)}
                  </p>
                  <p className="text-sm text-muted-foreground">Paket telah kami antarkan dengan aman</p>
                </div>
              </div>

              <div className="text-center">
                <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4">Butuh Pickup Paket?</h2>
                <p className="text-base text-muted-foreground mb-6">Kami siap menjemput paket Anda. Hubungi kami sekarang melalui WhatsApp.</p>
                <a
                  href="https://wa.me/6282114097704?text=Halo%2C%20saya%20ingin%20request%20pickup%20paket."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-green-500 text-white font-bold py-2 px-6 rounded-lg shadow hover:bg-green-600 transition-colors"
                >
                  Hubungi via WhatsApp
                </a>
              </div>

              <div className="text-center">
                <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4">Siap Kirim Barang Anda?</h2>
                <p className="text-base text-muted-foreground mb-6">Jelajahi berbagai layanan pengiriman kami yang sesuai dengan kebutuhan bisnis atau pribadi Anda.</p>
                <Link 
                  href="/services" 
                  className="inline-block bg-secondary text-secondary-foreground font-bold py-2 px-6 rounded-lg shadow hover:bg-secondary/80 transition-colors"
                >
                  Lihat Layanan Kami
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
