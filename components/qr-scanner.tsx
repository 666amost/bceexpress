"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { X, Camera } from "lucide-react"
import { BrowserQRCodeReader } from '@zxing/browser'
import { IScannerControls } from '@zxing/browser/esm/common/IScannerControls'

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
  const readerRef = useRef<BrowserQRCodeReader | null>(null)
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
          // Try to access the camera with mobile-friendly constraints
          const constraints = {
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          }
          
          const stream = await navigator.mediaDevices.getUserMedia(constraints)
          stream.getTracks().forEach(track => track.stop())
          setHasPermission(true)
          setError(null)
        } catch (err) {
          console.error('Initial camera access error:', err)
          
          // Try with basic constraints
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
              video: { facingMode: 'environment' } 
            })
            stream.getTracks().forEach(track => track.stop())
            setHasPermission(true)
            setError(null)
          } catch (basicErr) {
            console.error('Basic camera access error:', basicErr)
            setError("Could not access camera. Please check your camera permissions.")
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
    let currentStream: MediaStream | null = null

    const startScanner = async () => {
      try {
        if (!videoRef.current) return

        // Create reader with default settings
        const reader = new BrowserQRCodeReader()
        readerRef.current = reader

        try {
          // Try to get the stream with mobile-friendly constraints
          const constraints = {
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          }

          currentStream = await navigator.mediaDevices.getUserMedia(constraints)
          if (videoRef.current) {
            videoRef.current.srcObject = currentStream
          }

          setIsScanning(true)

          const controls = await reader.decodeFromVideoDevice(
            undefined, // Let the browser choose the best camera
            videoRef.current,
            (result, error) => {
              if (mounted && result) {
                console.log('Code detected:', result.getText())
                if (audioRef.current) {
                  audioRef.current.play().catch(console.error)
                }
                onScan(result.getText())
              }
              if (error && !error.message?.includes('No MultiFormat Readers were able to detect the code.')) {
                console.error('Scanning error:', error)
              }
            }
          )
          
          controlsRef.current = controls
        } catch (err) {
          console.error('Error with preferred constraints:', err)
          
          // Try with basic constraints
          try {
            const basicConstraints = {
              video: { facingMode: 'environment' }
            }
            
            currentStream = await navigator.mediaDevices.getUserMedia(basicConstraints)
            if (videoRef.current) {
              videoRef.current.srcObject = currentStream
            }

            setIsScanning(true)

            const controls = await reader.decodeFromVideoDevice(
              undefined,
              videoRef.current,
              (result, error) => {
                if (mounted && result) {
                  if (audioRef.current) {
                    audioRef.current.play().catch(console.error)
                  }
                  onScan(result.getText())
                }
              }
            )
            
            controlsRef.current = controls
          } catch (basicErr) {
            console.error('Error with basic constraints:', basicErr)
            throw new Error("Could not start the camera. Please try again or check your camera permissions.")
          }
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
        controlsRef.current.stop()
      }
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop())
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null
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

      {error && (
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
      )}
    </Card>
  )
} 