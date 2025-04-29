"use client"

import { useEffect, useRef, useState } from "react"
import { Html5Qrcode, Html5QrcodeResult } from "html5-qrcode"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Camera } from "lucide-react"
import browserBeep from "browser-beep"
import { toast } from "sonner"

interface QRScannerProps {
  onScan: (result: string) => void
  onClose: () => void
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const beepRef = useRef<ReturnType<typeof browserBeep> | null>(null)
  const lastScannedRef = useRef<string>("")
  const beepTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Initialize beep sound with 100% volume
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    beepRef.current = browserBeep({ 
      frequency: 800,
      context: audioContext
    })
    
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop()
      }
      if (audioContext) {
        audioContext.close()
      }
      if (beepTimeoutRef.current) {
        clearTimeout(beepTimeoutRef.current)
      }
    }
  }, [])

  const playBeep = () => {
    if (beepRef.current && !beepTimeoutRef.current) {
      beepRef.current(1) // Play beep once at full volume
      
      // Set timeout to prevent multiple beeps
      beepTimeoutRef.current = setTimeout(() => {
        beepTimeoutRef.current = null
      }, 1000) // Prevent beep for 1 second
    }
  }

  const startScanning = async () => {
    try {
      const devices = await Html5Qrcode.getCameras()
      const backCamera = devices.find(device => device.label.toLowerCase().includes('back'))
      const deviceId = backCamera ? backCamera.id : devices[0].id

      scannerRef.current = new Html5Qrcode("qr-reader")
      
      await scannerRef.current.start(
        deviceId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        async (decodedText: string, result: Html5QrcodeResult) => {
          // Prevent duplicate scans of the same code
          if (decodedText === lastScannedRef.current) {
            return
          }
          
          lastScannedRef.current = decodedText
          
          // Play success beep
          playBeep()
          
          // Show success notification
          toast.success("QR Code berhasil di-scan!", {
            description: decodedText,
            duration: 2000,
          })
          
          // Handle the scanned code
          onScan(decodedText)
          
          // Reset last scanned after a short delay to allow rescanning the same code
          setTimeout(() => {
            lastScannedRef.current = ""
          }, 2000)
        },
        (errorMessage: string) => {
          // Ignore errors - they're usually just "No QR code found" messages
        }
      )
      
      setIsScanning(true)
    } catch (err) {
      console.error("Error starting scanner:", err)
      toast.error("Gagal memulai kamera. Silakan coba lagi.")
    }
  }

  const stopScanning = async () => {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop()
      setIsScanning(false)
    }
  }

  useEffect(() => {
    // Auto-start scanning when component mounts
    startScanning()
    
    return () => {
      stopScanning()
    }
  }, [])

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div id="qr-reader" className="w-full max-w-sm mx-auto" />
        <div className="flex justify-center space-x-2">
          {!isScanning ? (
            <Button onClick={startScanning} className="flex items-center gap-2">
              <Camera className="w-4 h-4" />
              Start Camera
            </Button>
          ) : (
            <Button onClick={stopScanning} variant="destructive">
              Stop Camera
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Card>
  )
} 