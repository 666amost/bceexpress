"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { X, Camera } from "lucide-react"
import { BrowserQRCodeReader } from '@zxing/browser'

interface QRScannerProps {
  onScanSuccess: (result: string) => void
  onClose: () => void
}

export function QRScanner({ onScanSuccess, onClose }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const codeReaderRef = useRef<BrowserQRCodeReader | null>(null)
  const controlsRef = useRef<{ stop: () => Promise<void> } | null>(null)

  useEffect(() => {
    const checkPermission = async () => {
      try {
        const result = await navigator.permissions.query({ name: 'camera' as PermissionName })
        setHasPermission(result.state === 'granted')
        
        result.addEventListener('change', () => {
          setHasPermission(result.state === 'granted')
        })
      } catch (err) {
        // Browser might not support permission query for camera
        setHasPermission(null)
      }
    }

    checkPermission()
  }, [])

  useEffect(() => {
    let mounted = true

    const startScanner = async () => {
      try {
        if (!videoRef.current) return

        const codeReader = new BrowserQRCodeReader()
        codeReaderRef.current = codeReader

        // Get available video devices
        const videoInputDevices = await BrowserQRCodeReader.listVideoInputDevices()
        
        // Prefer environment/back camera if available
        const selectedDeviceId = videoInputDevices.find(device => 
          device.label.toLowerCase().includes('back') || 
          device.label.toLowerCase().includes('environment')
        )?.deviceId || videoInputDevices[0]?.deviceId

        if (!selectedDeviceId) {
          throw new Error('No camera found')
        }

        setIsScanning(true)

        // Start scanning
        const controls = await codeReader.decodeFromVideoDevice(
          selectedDeviceId,
          videoRef.current,
          (result, error) => {
            if (mounted && result) {
              onScanSuccess(result.getText())
            }
            if (error && error?.message !== 'No MultiFormat Readers were able to detect the code.') {
              console.error('QR scanning error:', error)
            }
          }
        )
        
        controlsRef.current = controls
      } catch (err) {
        console.error('Error starting scanner:', err)
        setError(err instanceof Error ? err.message : 'Could not access camera')
      }
    }

    if (hasPermission !== false) {
      startScanner()
    }

    return () => {
      mounted = false
      if (controlsRef.current) {
        controlsRef.current.stop().catch(console.error)
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
        tracks.forEach(track => track.stop())
      }
    }
  }, [onScanSuccess, hasPermission])

  if (hasPermission === false) {
    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <Camera className="w-12 h-12 mx-auto text-muted-foreground" />
          <div className="space-y-2">
            <h3 className="font-semibold">Camera Access Required</h3>
            <p className="text-sm text-muted-foreground">
              Please allow camera access in your browser settings to scan QR codes.
            </p>
          </div>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="relative overflow-hidden">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 z-10"
        onClick={onClose}
      >
        <X className="h-4 w-4" />
      </Button>

      {error ? (
        <div className="p-6 text-center space-y-4">
          <Camera className="w-12 h-12 mx-auto text-muted-foreground" />
          <div className="space-y-2">
            <p className="text-destructive font-medium">{error}</p>
            <p className="text-sm text-muted-foreground">
              Make sure you have granted camera permissions and are using a supported browser.
            </p>
          </div>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : (
        <div className="aspect-square relative">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
          />
          <div className="absolute inset-0">
            <div className="absolute inset-0 border-2 border-primary/50 rounded-lg m-4" />
            <div className="absolute inset-0 m-4 flex items-center justify-center">
              <div className="w-48 h-48 border-2 border-primary animate-pulse rounded-lg" />
            </div>
          </div>
        </div>
      )}
    </Card>
  )
} 