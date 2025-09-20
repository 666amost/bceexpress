"use client"

import type React from "react"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { SearchIcon, QrCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import Image from "next/image"
import { gsap } from 'gsap'

type HeroProps = {
  onScanClickAction?: () => void
}

export function Hero({ onScanClickAction }: HeroProps) {
  const [awbNumber, setAwbNumber] = useState("")
  const router = useRouter()
  const heroRef = useRef<HTMLDivElement>(null)

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault()
    if (awbNumber.trim()) {
      if (heroRef.current) {
        gsap.to(heroRef.current, {
          opacity: 0,
          scale: 0.95,
          duration: 0.5,
          onComplete: () => {
            router.push(`/track/${awbNumber}`)
          }
        })
      }
    }
  }

  return (
    <div ref={heroRef} className="bg-background text-foreground">
      <div className="container mx-auto px-4 text-center">
        <div className="mb-8 flex justify-center">
          {/* Logo hitam untuk light mode */}
          <Image
            src="/images/bce-logo.png"
            alt="BCE EXPRESS - Better Cargo Experience"
            width={400}
            height={120}
            className="h-auto block dark:hidden"
            priority
          />
          {/* Logo putih untuk dark mode */}
          <Image
            src="/images/bce-logo-white.png"
            alt="BCE EXPRESS - Better Cargo Experience"
            width={400}
            height={120}
            className="h-auto hidden dark:block"
            priority
          />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Your Reliable Logistics Partner</h1>
        <p className="text-xl mb-8 max-w-2xl mx-auto text-muted-foreground">
          Solusi pengiriman ekspres dengan notifikasi real-time
        </p>
        <Card className="max-w-md mx-auto shadow-xl border-0">
          <CardHeader className="bg-primary text-white p-4 rounded-t-lg">
            <h2 className="text-xl font-semibold">Lacak Kiriman Anda</h2>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {/* Mobile: stacked; Desktop: inline */}
            <form onSubmit={handleTrack} className="flex flex-col sm:flex-row sm:items-stretch gap-2">
              <Input
                type="text"
                placeholder="Masukkan Nomor Resi"
                value={awbNumber}
                onChange={(e) => setAwbNumber(e.target.value)}
                className="w-full h-11 sm:flex-1 sm:min-w-0 sm:rounded-r-none focus:ring-primary"
              />
              <div className="flex items-stretch gap-2">
                <Button type="submit" className="h-11 sm:rounded-l-none px-4 whitespace-nowrap">
                  <SearchIcon className="h-4 w-4 mr-2" /> Track
                </Button>
                <Button
                  type="button"
                  aria-label="Scan QR Code"
                  className="h-11 w-11 p-0 flex items-center justify-center"
                  onClick={() => onScanClickAction?.()}
                  title="Scan QR Code"
                >
                  <QrCode className="h-5 w-5" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
