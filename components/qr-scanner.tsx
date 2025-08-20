"use client"

import { useEffect, useRef, useState } from "react"
import { Html5Qrcode, Html5QrcodeResult } from "html5-qrcode"
import { Button } from "@/components/ui/button"
import browserBeep from "browser-beep"
import { toast } from "sonner"
import { supabaseClient } from "@/lib/auth"

interface QRScannerProps {
  onScan: (result: string) => void
  onClose: () => void
  hideCloseButton?: boolean
  disableAutoUpdate?: boolean
  /**
   * Optional sizing (percentage of container) for the white scan frame.
   * widthPercent / heightPercent should be between 0.1 - 1.0.
   * If omitted, fallback logic (square ~70% of min dimension) is used.
   */
  qrboxSize?: { widthPercent?: number; heightPercent?: number }
  /**
   * Provide a single percentage (0.1 - 1.0) of the smaller container dimension
   * to force a square (1:1) scan box. Takes precedence over qrboxSize.
   */
  squarePercent?: number
}

interface ManifestData {
  nama_penerima: string
  alamat_penerima: string
  nomor_penerima: string
  manifest_source: "borneo_branch" | "cabang" | "central"
}

interface TorchFeature {
  apply: (value: boolean) => Promise<void>
}

export function QRScanner({ onScan, onClose, hideCloseButton = false, disableAutoUpdate = false, qrboxSize, squarePercent }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const lastScannedRef = useRef<string>("")
  const beepTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [isTorchAvailable, setIsTorchAvailable] = useState(false)
  const [isTorchOn, setIsTorchOn] = useState(false)
  const torchFeatureRef = useRef<TorchFeature | null>(null)
  const deviceIdRef = useRef<string | null>(null)
  const resizeTimeoutRef = useRef<number | null>(null)

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

  const checkManifestAwb = async (awb: string): Promise<ManifestData | null> => {
    try {
      const cleanAwb = awb.trim().toUpperCase();
      
      // OPTIMIZED: Route based on prefix for better performance
      if (cleanAwb.startsWith('BE')) {
        // For BE resi: Directly call Borneo web cabang API
        try {
          const branchResponse = await fetch(`/api/manifest/search?awb_number=${cleanAwb}`);
          
          if (branchResponse.ok) {
            const branchData = await branchResponse.json();
            
            if (branchData.success && branchData.data) {
              const borneoBranchManifest = branchData.data;
              
              // Map Borneo API response to expected format
              return {
                nama_penerima: borneoBranchManifest.penerima?.nama_penerima || borneoBranchManifest.penerima || "Auto Generated",
                alamat_penerima: borneoBranchManifest.penerima?.alamat_penerima || borneoBranchManifest.alamat_penerima || "Auto Generated",
                nomor_penerima: borneoBranchManifest.penerima?.no_penerima || borneoBranchManifest.telepon_penerima || "Auto Generated",
                manifest_source: "borneo_branch"
              };
            }
          }
        } catch (branchError) {
          console.error('Error fetching from Borneo branch:', branchError);
        }
      } else if (cleanAwb.startsWith('BCE')) {
        // For BCE resi: Check manifest_cabang first, then manifest
        
        // 1. Check manifest_cabang table first
        const { data: branchData, error: branchError } = await supabaseClient
          .from("manifest_cabang")
          .select("nama_penerima,alamat_penerima,nomor_penerima")
          .ilike("awb_no", cleanAwb)
          .maybeSingle();
        if (!branchError && branchData) {
          return { ...branchData, manifest_source: "cabang" };
        }
        
        // 2. Check central manifest table
        const { data: centralData, error: centralError } = await supabaseClient
          .from("manifest")
          .select("nama_penerima,alamat_penerima,nomor_penerima")
          .ilike("awb_no", cleanAwb)
          .maybeSingle();
        if (!centralError && centralData) {
          return { ...centralData, manifest_source: "central" };
        }
      }
      
      return null;
    } catch (err) {
      console.error('Error in checkManifestAwb:', err);
      return null;
    }
  };

  const updateShipmentStatus = async (awbNumber: string): Promise<boolean> => {
    // Type-safe, robust update/insert logic for shipment and shipment_history
    const currentDate: string = new Date().toISOString();
    const status = "out_for_delivery";
    const location = "Sorting Center";
    // Get current user session
    const { data: session } = await supabaseClient.auth.getSession();
    const userId: string | undefined = session?.session?.user?.id;
    const userName: string = currentUser || session?.session?.user?.email?.split("@")[0] || "courier";
    if (!userId) return false;

    // Check if shipment exists
    const { data: existing, error: existingError } = await supabaseClient
      .from("shipments")
      .select("awb_number,current_status,courier_id")
      .eq("awb_number", awbNumber)
      .maybeSingle();
    if (existingError) return false;

    let shipmentSuccess = false;
    if (!existing) {
      // Try to get manifest data for better shipment creation
      const manifestData = await checkManifestAwb(awbNumber);
      
      const shipmentData = {
        awb_number: awbNumber,
        sender_name: "Auto Generated",
        sender_address: "Auto Generated", 
        sender_phone: "Auto Generated",
        receiver_name: manifestData?.nama_penerima || "Auto Generated",
        receiver_address: manifestData?.alamat_penerima || "Auto Generated",
        receiver_phone: manifestData?.nomor_penerima || "Auto Generated",
        weight: 1,
        dimensions: "10x10x10",
        service_type: "Standard",
        current_status: status,
        created_at: currentDate,
        updated_at: currentDate,
        courier_id: userId,
      };
      
      // Insert new shipment
      const { error: insertError } = await supabaseClient.from("shipments").insert([shipmentData]);
      if (insertError) return false;
      shipmentSuccess = true;
    } else if (existing.current_status && existing.current_status.toLowerCase() === "out_for_delivery") {
      // Transfer shipment to new courier
      const { data: updateResult, error: updateError } = await supabaseClient
        .from("shipments")
        .update({
          current_status: status,
          updated_at: currentDate,
          courier_id: userId,
        })
        .eq("awb_number", awbNumber)
        .select("awb_number, courier_id");
      if (updateError || !updateResult || updateResult.length === 0) return false;
      if (updateResult[0].courier_id === userId) {
        shipmentSuccess = true;
      } else {
        return false;
      }
    } else {
      // Update shipment status only
      const { error: updateError } = await supabaseClient
        .from("shipments")
        .update({
          current_status: status,
          updated_at: currentDate,
        })
        .eq("awb_number", awbNumber);
      if (updateError) return false;
      shipmentSuccess = true;
    }

    // Add shipment_history if not exists
    if (shipmentSuccess) {
      const { data: existingHistory } = await supabaseClient
        .from("shipment_history")
        .select("id")
        .eq("awb_number", awbNumber)
        .eq("status", status)
        .maybeSingle();
      if (!existingHistory) {
        const { error: historyError } = await supabaseClient.from("shipment_history").insert([
          {
            awb_number: awbNumber,
            status,
            location,
            notes: `QR Scanner - Out for Delivery by ${userName}`,
            created_at: currentDate,
          },
        ]);
        if (historyError) return false;
      }
      return true;
    }
    return false;
  }

  const startScanning = async () => {
    try {
      const devices = await Html5Qrcode.getCameras()
      const backCamera = devices.find(device => device.label.toLowerCase().includes('back'))
      const deviceId = backCamera ? backCamera.id : devices[0].id
      deviceIdRef.current = deviceId

      scannerRef.current = new Html5Qrcode("qr-reader")
      // Compute qrbox dynamically based on the container size and props.
      const computeQrbox = (): number | { width: number; height: number } => {
        try {
          const el = document.getElementById("qr-reader")
          if (!el) return 250
          const rect = el.getBoundingClientRect()
          const minDim = Math.min(rect.width, rect.height)

          if (typeof squarePercent === "number") {
            const p = Math.max(0.1, Math.min(1, squarePercent))
            return Math.floor(minDim * p)
          }

          if (qrboxSize && (qrboxSize.widthPercent || qrboxSize.heightPercent)) {
            const wp = Math.max(0.1, Math.min(1, qrboxSize.widthPercent ?? 0.7))
            const hp = Math.max(0.1, Math.min(1, qrboxSize.heightPercent ?? wp))
            return { width: Math.floor(rect.width * wp), height: Math.floor(rect.height * hp) }
          }

          // Default: square 90% of the smaller dimension
          return Math.floor(minDim * 0.9)
        } catch (err) {
          return 250
        }
      }

      const qrboxOption = computeQrbox()

      await scannerRef.current.start(
        deviceId,
        {
          fps: 10,
          qrbox: qrboxOption,
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

      // Check for torch capability and turn on after scanner starts
      try {
        if (scannerRef.current) {
          const capabilities = scannerRef.current.getRunningTrackCameraCapabilities();
          const torchFeature = capabilities?.torchFeature?.();
          if (torchFeature && typeof torchFeature.apply === 'function') {
            setIsTorchAvailable(true);
            torchFeatureRef.current = torchFeature;
            // Turn torch on automatically
            await torchFeature.apply(true);
            setIsTorchOn(true);
          } else {
            setIsTorchAvailable(false);
            setIsTorchOn(false);
            torchFeatureRef.current = null;
          }
        } else {
          setIsTorchAvailable(false);
          setIsTorchOn(false);
          torchFeatureRef.current = null;
        }
      } catch (err) {
        // Silently handle torch errors
        setIsTorchAvailable(false);
        setIsTorchOn(false);
        torchFeatureRef.current = null;
      }

    } catch (err) {
      // Silently handle scanner start errors
      toast.error("Gagal memulai kamera. Silakan coba lagi.")
    }
  }

  const stopScanning = async () => {
    if (scannerRef.current?.isScanning) {
      // Turn torch off before stopping scanner
      if (isTorchOn && torchFeatureRef.current) {
        try {
          await torchFeatureRef.current.apply(false);
          setIsTorchOn(false);
        } catch (err) {
          // Silently handle torch turn off errors
        }
      }

      await scannerRef.current.stop()
      setIsScanning(false)
    }
  }

  useEffect(() => {
    // Auto-start scanning when component mounts
    startScanning()

    // Restart scanner on window resize to recompute qrbox for different device ratios
    const handleResize = () => {
      // Debounce rapid resize events
      if (resizeTimeoutRef.current) {
        window.clearTimeout(resizeTimeoutRef.current)
      }
      resizeTimeoutRef.current = window.setTimeout(async () => {
        try {
          if (scannerRef.current?.isScanning) {
            await scannerRef.current.stop()
            // small delay to allow camera to release
            setTimeout(() => {
              // restart scanning using current settings
              startScanning()
            }, 300)
          }
        } catch (err) {
          // ignore
        }
      }, 250)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      // Cleanup function to stop scanning and remove listeners when component unmounts
      const cleanup = async () => {
        try {
          window.removeEventListener('resize', handleResize)
          if (resizeTimeoutRef.current) {
            window.clearTimeout(resizeTimeoutRef.current)
            resizeTimeoutRef.current = null
          }
          if (scannerRef.current?.isScanning) {
            if (isTorchOn && torchFeatureRef.current) {
              try {
                await torchFeatureRef.current.apply(false)
              } catch (err) {
                // Silently handle torch turn off errors
              }
            }
            await scannerRef.current.stop()
          }
        } catch (err) {
          // Silently handle cleanup errors
        }
      }
      cleanup()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="w-full h-full flex flex-col">
      <div id="qr-reader" className="w-full h-full flex-1" />
      {!hideCloseButton && (
        <div className="absolute top-2 right-2">
          <Button variant="outline" onClick={onClose} size="sm">
            Close
          </Button>
        </div>
      )}
    </div>
  )
}