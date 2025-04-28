"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import Image from "next/image"

export function Hero() {
  const [awbNumber, setAwbNumber] = useState("")
  const router = useRouter()

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault()
    if (awbNumber.trim()) {
      router.push(`/track/${awbNumber}`)
    }
  }

  return (
    <div className="w-full">
      <div className="flex flex-col items-center justify-center space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Your Reliable Logistics Partner
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-[42rem] mx-auto">
            Track your shipments in real-time with BCE EXPRESS&apos;s advanced tracking system
          </p>
        </div>

        <Card className="w-full max-w-md bg-white dark:bg-zinc-900 shadow-xl">
          <CardHeader className="space-y-1 bg-primary text-primary-foreground p-4 rounded-t-xl">
            <h2 className="text-xl font-semibold text-center">Track Your Shipment</h2>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleTrack} className="flex flex-col sm:flex-row gap-3">
              <Input
                type="text"
                placeholder="Enter AWB Number"
                value={awbNumber}
                onChange={(e) => setAwbNumber(e.target.value)}
                className="flex-1 h-11"
              />
              <Button 
                type="submit" 
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                <Search className="h-5 w-5 mr-2" /> 
                Track
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
