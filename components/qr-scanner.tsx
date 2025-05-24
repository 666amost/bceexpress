"use client"

import { useEffect, useRef, useState } from "react"
import { Html5Qrcode, Html5QrcodeResult } from "html5-qrcode"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Camera } from "lucide-react"
import browserBeep from "browser-beep"
import { toast } from "sonner"
import { supabaseClient } from "@/lib/auth"

interface QRScannerProps {
  onScan: (result: string) => void
  onClose: () => void
  hideCloseButton?: boolean
  disableAutoUpdate?: boolean
}

export function QRScanner({ onScan, onClose, hideCloseButton = false, disableAutoUpdate = false }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const lastScannedRef = useRef<string>("")
  const beepTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)

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
          
          if (!disableAutoUpdate) {
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
          } else {
            // Just handle the scanned code without updating
            onScan(decodedText)
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

      // Automatically turn on flash if supported
      try {
        const capabilities = scannerRef.current.getRunningTrackCapabilities();
        if (capabilities.torch) {
          setTorchSupported(true);
          await scannerRef.current.applyVideoConstraints({
            advanced: [{ torch: true }]
          });
          setTorchOn(true);
          console.log("Flash turned on automatically.");
        } else {
          setTorchSupported(false);
          console.log("Flash (torch) not supported on this device/browser.");
        }
      } catch (err) {
        console.error("Failed to access torch capabilities or turn on flash:", err);
        setTorchSupported(false);
        setTorchOn(false);
      }

    } catch (err) {
      console.error("Error starting scanner:", err)
      toast.error("Gagal memulai kamera. Silakan coba lagi.")
      setIsScanning(false) // Ensure scanning state is false on error
    }
  }

  const stopScanning = async () => {
    if (scannerRef.current?.isScanning) {
      // Turn off flash before stopping
      if (torchOn) {
        try {
          await scannerRef.current.applyVideoConstraints({
            advanced: [{ torch: false }]
          });
          setTorchOn(false);
          console.log("Flash turned off.");
        } catch (err) {
          console.error("Failed to turn off flash:", err);
        }
      }

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
          {!hideCloseButton && (
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
        {isScanning && torchSupported && (
          <Button onClick={() => toggleTorch(scannerRef.current, !torchOn, setTorchOn)} variant="outline" size="sm">
            {torchOn ? 'Turn Flash Off' : 'Turn Flash On'}
          </Button>
        )}
      </div>
    </Card>
  )
}

const toggleTorch = async (html5QrcodeInstance: Html5Qrcode | null, turnOn: boolean, setTorchOn: (on: boolean) => void) => {
  if (html5QrcodeInstance && html5QrcodeInstance.isScanning) {
    try {
      const capabilities = html5QrcodeInstance.getRunningTrackCapabilities();
      if (capabilities.torch) {
        await html5QrcodeInstance.applyVideoConstraints({
          advanced: [{ torch: turnOn }]
        });
        setTorchOn(turnOn);
        console.log(`Flash turned ${turnOn ? 'on' : 'off'.`);
      } else {
        console.warn("Flash (torch) not supported on this device/browser.");
      }
    } catch (err) {
      console.error("Failed to toggle flash:", err);
    }
  }
}; 