"use client"

import { useEffect, useRef, useState } from "react"
import { Html5Qrcode, Html5QrcodeResult } from "html5-qrcode"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Camera, Flashlight } from "lucide-react"
import browserBeep from "browser-beep"
import { toast } from "sonner"
import { supabaseClient } from "@/lib/auth"

interface QRScannerProps {
  onScan: (result: string) => void
  onClose: () => void
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [isFlashOn, setIsFlashOn] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const beepRef = useRef<ReturnType<typeof browserBeep> | null>(null)
  const lastScannedRef = useRef<string>("")
  const beepTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [currentUser, setCurrentUser] = useState<string | null>(null)

  useEffect(() => {
    // Get current user
    async function getCurrentUser() {
      const { data } = await supabaseClient.auth.getSession()
      if (data.session) {
        const { data: userData } = await supabaseClient
          .from("users")
          .select("*")
          .eq("id", data.session.user.id)
          .single()

        if (userData) {
          setCurrentUser(userData.name || userData.email?.split("@")[0])
        } else {
          setCurrentUser(data.session.user.email?.split("@")[0] || "courier")
        }
      }
    }
    getCurrentUser()
  }, [])

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

  const updateShipmentStatus = async (awbNumber: string) => {
    try {
      const currentDate = new Date().toISOString()
      const status = "out_for_delivery"
      const location = "Sorting Center"

      // Get current user session
      const { data: session } = await supabaseClient.auth.getSession()
      const userName = currentUser || session?.session?.user?.email?.split("@")[0] || "courier"

      // Check if shipment exists
      const { data: existingShipment } = await supabaseClient
        .from("shipments")
        .select("awb_number")
        .eq("awb_number", awbNumber)
        .single()

      // If shipment doesn't exist, create it
      if (!existingShipment) {
        await supabaseClient.from("shipments").insert([
          {
            awb_number: awbNumber,
            sender_name: "Auto Generated",
            sender_address: "Auto Generated",
            sender_phone: "Auto Generated",
            receiver_name: "Auto Generated",
            receiver_address: "Auto Generated",
            receiver_phone: "Auto Generated",
            weight: 1,
            dimensions: "10x10x10",
            service_type: "Standard",
            current_status: status,
            created_at: currentDate,
            updated_at: currentDate,
            updated_by: userName,
          },
        ])
      } else {
        // Update existing shipment
        await supabaseClient
          .from("shipments")
          .update({
            current_status: status,
            updated_at: currentDate,
            updated_by: userName,
          })
          .eq("awb_number", awbNumber)
      }

      // Add shipment history entry
      await supabaseClient.from("shipment_history").insert([
        {
          awb_number: awbNumber,
          status,
          location,
          notes: `Bulk update - Out for Delivery by ${userName}`,
          created_at: currentDate,
          updated_by: userName,
        },
      ])

      return true
    } catch (error) {
      console.error("Error updating shipment:", error)
      return false
    }
  }

  const toggleFlash = async () => {
    try {
      const scanner = scannerRef.current
      if (scanner) {
        // @ts-ignore - We know this method exists even if TypeScript doesn't
        const stream = scanner.getVideoElement()?.srcObject as MediaStream
        if (stream) {
          const videoTrack = stream.getVideoTracks()[0]
          const capabilities = videoTrack.getCapabilities()
          if (capabilities.torch) {
            await videoTrack.applyConstraints({
              advanced: [{ torch: !isFlashOn }]
            })
            setIsFlashOn(!isFlashOn)
            console.log('Flash toggled:', !isFlashOn)
          } else {
            console.log('Torch/flash not supported on this device')
            toast.error("Flash tidak didukung pada perangkat ini")
          }
        }
      }
    } catch (flashError) {
      console.error('Error toggling flash:', flashError)
      toast.error("Gagal mengaktifkan flash")
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
          aspectRatio: 1,
        },
        async (decodedText: string, result: Html5QrcodeResult) => {
          // Prevent duplicate scans of the same code
          if (decodedText === lastScannedRef.current) {
            return
          }
          
          lastScannedRef.current = decodedText
          
          // Play success beep
          playBeep()
          
          // Update shipment status
          const success = await updateShipmentStatus(decodedText)
          
          if (success) {
            // Show success notification
            toast.success("AWB berhasil di-scan!", {
              description: `${decodedText} telah diupdate ke Out for Delivery`,
              duration: 2000,
            })
            
            // Handle the scanned code
            onScan(decodedText)
          } else {
            toast.error("Gagal mengupdate status AWB", {
              description: "Silakan coba lagi",
              duration: 2000,
            })
          }
          
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
            <>
              <Button onClick={startScanning} className="flex items-center gap-2">
                <Camera className="w-4 h-4" />
                Start Camera
              </Button>
              <Button 
                onClick={toggleFlash} 
                variant="outline" 
                className="flex items-center gap-2"
                disabled={!isScanning}
              >
                <Flashlight className={`w-4 h-4 ${isFlashOn ? 'text-yellow-500' : ''}`} />
                Flash
              </Button>
            </>
          ) : (
            <>
              <Button onClick={stopScanning} variant="destructive">
                Stop Camera
              </Button>
              <Button 
                onClick={toggleFlash} 
                variant="outline" 
                className="flex items-center gap-2"
              >
                <Flashlight className={`w-4 h-4 ${isFlashOn ? 'text-yellow-500' : ''}`} />
                Flash
              </Button>
            </>
          )}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Card>
  )
} 