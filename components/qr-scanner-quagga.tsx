"use client"

import { useEffect, useRef } from "react"
import Quagga from "@ericblade/quagga2"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

export function QRScannerQuagga({ onScan, onClose }: { onScan: (result: string) => void, onClose: () => void }) {
  const videoRef = useRef<HTMLDivElement>(null)
  const scannerActive = useRef(false)

  useEffect(() => {
    if (!videoRef.current) return
    scannerActive.current = true
    Quagga.init({
      inputStream: {
        type: "LiveStream",
        target: videoRef.current,
        constraints: {
          facingMode: "environment",
        },
        area: { // optional: scan area
          top: "0%",
          right: "0%",
          left: "0%",
          bottom: "0%"
        }
      },
      decoder: {
        readers: [
          "code_128_reader",
          "ean_reader",
          "ean_8_reader",
          "upc_reader",
          "upc_e_reader",
          "code_39_reader",
          "code_39_vin_reader",
          "codabar_reader",
          "i2of5_reader",
          "2of5_reader",
          "code_93_reader"
        ]
      },
      locate: true,
      numOfWorkers: 2,
      frequency: 10
    }, (err) => {
      if (err) {
        // eslint-disable-next-line no-console
        console.error(err)
        return
      }
      Quagga.start()
    })

    Quagga.onDetected(handleDetected)
    return () => {
      scannerActive.current = false
      Quagga.offDetected(handleDetected)
      Quagga.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDetected = (data: any) => {
    if (!scannerActive.current) return
    const code = data.codeResult.code
    if (code) {
      scannerActive.current = false
      Quagga.stop()
      onScan(code)
    }
  }

  return (
    <div className="qr-scanner-container bg-card p-4 rounded-lg shadow-md flex flex-col items-center w-full max-w-md mx-auto">
      <div className="flex justify-between items-center w-full mb-4">
        <h3 className="text-lg font-medium">Scan Barcode/QR</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div ref={videoRef} className="w-full flex justify-center min-h-[240px] max-w-xs aspect-video rounded-lg border border-muted shadow bg-black" />
      <p className="text-xs text-muted-foreground text-center mt-4">
        Arahkan barcode/QR ke kamera
      </p>
    </div>
  )
} 