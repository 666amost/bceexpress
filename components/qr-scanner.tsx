"use client"

import { useEffect, useRef, useState } from "react"
import { Html5Qrcode, Html5QrcodeResult } from "html5-qrcode"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Camera } from "lucide-react"
import browserBeep from "browser-beep"

interface QRScannerProps {
  onScan: (result: string) => void
  onClose: () => void
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const beepRef = useRef<ReturnType<typeof browserBeep> | null>(null)

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
    }
  }, [])

  const playBeep = () => {
    if (beepRef.current) {
      beepRef.current(1) // Play beep once at full volume
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
          // Play success beep at full volume
          playBeep()
          
          // Handle the scanned code
          onScan(decodedText)
          
          // Don't stop scanning - continue for next code
          setIsScanning(true)
        },
        (errorMessage: string) => {
          // Ignore errors - they're usually just "No QR code found" messages
        }
      )
      
      setIsScanning(true)
    } catch (err) {
      console.error("Error starting scanner:", err)
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