"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { X, Camera } from "lucide-react"
import { BrowserQRCodeReader } from '@zxing/browser'
import { IScannerControls } from '@zxing/browser/esm/common/IScannerControls'
import { BarcodeFormat, DecodeHintType, Result, Exception } from '@zxing/library'

interface VideoDevice {
  deviceId: string
  label: string
}

interface QRScannerProps {
  onScan: (result: string) => void
  onClose: () => void
}

export default function QRScanner({ onScan, onClose }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const codeReaderRef = useRef<BrowserQRCodeReader | null>(null)
  const controlsRef = useRef<IScannerControls | null>(null)

  // Check for camera permission first
  useEffect(() => {
    const checkPermission = async () => {
      try {
        // First check if the browser supports getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setError("Your browser doesn't support camera access")
          return
        }

        try {
          // Try to access the camera directly first
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: 'environment',
            } 
          })
          
          // If we get here, we have camera access
          stream.getTracks().forEach(track => track.stop()) // Clean up the test stream
          setHasPermission(true)
          setError(null)
          
        } catch (err) {
          console.error('Initial camera access error:', err)
          
          // Try to get the permission status as fallback
          try {
            const result = await navigator.permissions.query({ name: 'camera' as PermissionName })
            
            if (result.state === 'denied') {
              setError("Camera access is denied. Please allow camera access in your browser settings.")
              setHasPermission(false)
              return
            }
            
            if (result.state === 'prompt') {
              // Let the user know we're waiting for their permission
              setError("Please allow camera access when prompted.")
              
              try {
                await navigator.mediaDevices.getUserMedia({ 
                  video: { 
                    facingMode: 'environment',
                  } 
                })
                setHasPermission(true)
                setError(null)
              } catch (err) {
                console.error('Error requesting camera permission:', err)
                setError("Could not access camera. Please check your camera permissions.")
                setHasPermission(false)
              }
            }
            
            result.addEventListener('change', () => {
              setHasPermission(result.state === 'granted')
              if (result.state === 'granted') {
                setError(null)
              }
            })
            
          } catch (permErr) {
            console.error('Permission API not supported:', permErr)
            setError("Could not access camera. Please check your camera permissions and try again.")
            setHasPermission(false)
          }
        }
      } catch (err) {
        console.error('Camera permission check error:', err)
        setError("Could not access camera. Please make sure you have a camera connected and have granted camera permissions.")
        setHasPermission(false)
      }
    }

    checkPermission()
  }, [])

  // Start scanning once we have permission
  useEffect(() => {
    let mounted = true

    const startScanner = async () => {
      try {
        if (!videoRef.current) return

        // Configure format hints to support multiple barcode formats
        const hints = new Map<DecodeHintType, any>()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.QR_CODE,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
        ])
        hints.set(DecodeHintType.TRY_HARDER, true)

        const codeReader = new BrowserQRCodeReader(hints)
        codeReaderRef.current = codeReader

        // Get available video devices
        const videoInputDevices = await BrowserQRCodeReader.listVideoInputDevices()
        console.log('Available cameras:', videoInputDevices)
        
        if (!videoInputDevices || videoInputDevices.length === 0) {
          throw new Error("No cameras detected. Please make sure your camera is connected.")
        }

        // Prefer environment/back camera if available
        const selectedDeviceId = videoInputDevices.find((device: VideoDevice) => 
          device.label.toLowerCase().includes('back') || 
          device.label.toLowerCase().includes('environment')
        )?.deviceId || videoInputDevices[0]?.deviceId

        if (!selectedDeviceId) {
          throw new Error("Could not select a camera. Please make sure your camera is connected and accessible.")
        }

        setIsScanning(true)
        console.log('Starting scanner with device:', selectedDeviceId)

        try {
          const controls = await codeReader.decodeFromVideoDevice(
            selectedDeviceId,
            videoRef.current,
            (result: Result | null, error: Exception | undefined) => {
              if (mounted && result) {
                console.log('Code detected:', result.getText())
                // Play success sound
                if (audioRef.current) {
                  audioRef.current.play().catch(console.error)
                }
                onScan(result.getText())
              }
              if (error && error?.message !== 'No MultiFormat Readers were able to detect the code.') {
                console.error('Scanning error:', error)
              }
            }
          )
          
          controlsRef.current = controls
        } catch (err) {
          console.error('Error starting scanner:', err)
          throw new Error("Could not start the camera. Please try again or check your camera permissions.")
        }
      } catch (err) {
        console.error('Scanner initialization error:', err)
        setError(err instanceof Error ? err.message : 'Could not start the scanner')
        setIsScanning(false)
      }
    }

    if (hasPermission === true) {
      console.log('Starting scanner with permission granted')
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
  }, [onScan, hasPermission])

  if (hasPermission === false) {
    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <Camera className="w-12 h-12 mx-auto text-muted-foreground" />
          <div className="space-y-2">
            <h3 className="font-semibold">Camera Access Required</h3>
            <p className="text-sm text-muted-foreground">
              Please allow camera access in your browser settings to scan codes.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Try refreshing the page after enabling camera access.
            </p>
          </div>
          <div className="space-x-2">
            <Button variant="outline" onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
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

      {/* Success sound audio element */}
      <audio ref={audioRef} preload="auto">
        <source src="/sounds/beep-success.mp3" type="audio/mpeg" />
      </audio>

      {error ? (
        <div className="p-6 text-center space-y-4">
          <Camera className="w-12 h-12 mx-auto text-muted-foreground" />
          <div className="space-y-2">
            <p className="text-destructive font-medium">{error}</p>
            <p className="text-sm text-muted-foreground">
              Make sure you have a camera connected and have granted camera permissions.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Try refreshing the page or checking your browser settings.
            </p>
          </div>
          <div className="space-x-2">
            <Button variant="outline" onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      ) : (
        <div className="aspect-square relative">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
            autoPlay
          />
          <div className="absolute inset-0">
            <div className="absolute inset-0 border-2 border-primary/50 rounded-lg m-4" />
            <div className="absolute inset-0 m-4 flex items-center justify-center">
              <div className="w-48 h-48 border-2 border-primary animate-pulse rounded-lg" />
            </div>
          </div>
          {!isScanning && !error && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
              <div className="text-center space-y-4">
                <Camera className="w-8 h-8 mx-auto animate-pulse" />
                <p className="text-sm">Initializing camera...</p>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
} 