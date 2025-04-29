"use client"

import { useEffect, useRef, useState } from "react"
import { Html5QrcodeScanner } from "html5-qrcode"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Camera, Flashlight, FlashlightOff } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface QRScannerProps {
  onScan: (result: string) => void
  onClose: () => void
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
  const [isTorchOn, setIsTorchOn] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        showTorchButtonIfSupported: true,
      },
      false
    )

    scannerRef.current = scanner

    const onScanSuccess = (decodedText: string) => {
      if (!isScanning) {
        setIsScanning(true)
        onScan(decodedText)
        toast({
          title: "Scan Berhasil",
          description: `AWB ${decodedText} berhasil di-scan`,
          duration: 2000,
        })
        // Reset scanning state after a short delay to allow for next scan
        setTimeout(() => {
          setIsScanning(false)
        }, 1000)
      }
    }

    scanner.render(onScanSuccess)

    return () => {
      scanner.clear()
    }
  }, [onScan, toast, isScanning])

  const toggleTorch = async () => {
    if (scannerRef.current) {
      try {
        const isTorchEnabled = await scannerRef.current.getState().getTorchState()
        if (isTorchEnabled) {
          await scannerRef.current.getState().turnOffTorch()
          setIsTorchOn(false)
        } else {
          await scannerRef.current.getState().turnOnTorch()
          setIsTorchOn(true)
        }
      } catch (error) {
        console.error("Error toggling torch:", error)
      }
    }
  }

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div id="qr-reader" className="w-full" />
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={toggleTorch} size="icon">
            {isTorchOn ? <FlashlightOff className="h-4 w-4" /> : <Flashlight className="h-4 w-4" />}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Tutup Scanner
          </Button>
        </div>
      </div>
    </Card>
  )
} 