"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCamera, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { supabaseClient, getPooledClient, getAuthenticatedClient, withRetry } from "@/lib/auth"
import { QRScanner } from "./qr-scanner"

interface BulkUpdateModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (count: number) => void
}

export function BulkUpdateModal({ isOpen, onClose, onSuccess }: BulkUpdateModalProps) {
  const [awbNumbers, setAwbNumbers] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [showScanner, setShowScanner] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<string>("")
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [modalKey, setModalKey] = useState<string>(Date.now().toString())

  const playScanSuccessSound = () => {
    const audio = new Audio('/sounds/scan_success.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {
      // Silently handle audio play errors
    });
  };

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
          setCurrentUser(userData)
        } else {
          // If user record doesn't exist but we have session, create a basic user object
          const username = data.session.user.email?.split("@")[0] || "courier"
          setCurrentUser({
            name: username,
            email: data.session.user.email,
          })
        }
      }
    }

    getCurrentUser()
  }, [])

  // Reset state when modal is opened
  useEffect(() => {
    if (isOpen) {
      // Force reset all states when modal opens
      setError(null)
      setProcessingStatus("")
      setIsLoading(false)
      setShowScanner(false)
      setAbortController(null)
      
      // Generate new modal key to force re-render
      setModalKey(Date.now().toString())
      

    }
  }, [isOpen])

  // Cleanup effect to reset all states when component unmounts or modal closes
  useEffect(() => {
    if (!isOpen) {
      // Cancel any ongoing operations
      if (abortController) {
        abortController.abort()
      }
      
      // Force reset all states when modal is closed
      setIsLoading(false)
      setError(null)
      setProcessingStatus("")
      setShowScanner(false)
      setAbortController(null)
    }
  }, [isOpen, abortController])

  const handleQRScan = (result: string) => {
    // Add the scanned AWB to the list
    const currentAwbs = awbNumbers.trim() ? awbNumbers.split(/[\n,\s]+/) : []

    // Check if the AWB is already in the list
    if (!currentAwbs.includes(result)) {
      const newAwbList = [...currentAwbs, result]
      setAwbNumbers(newAwbList.join("\n"))
      playScanSuccessSound();
    }

    // Close the scanner
    setShowScanner(false)
  }

  // Function to check if AWB exists in manifest (both central and branch) with timeout
  const checkManifestAwb = async (awb: string) => {
    try {
      // Use authenticated client for better reliability
      const client = await getAuthenticatedClient();
      
      // Fast timeout for manifest check
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 1500) // Reduced to 1.5 seconds
      );

      // First check central manifest with minimal retry
      const centralResult = await withRetry(async () => {
        const centralPromise = client
        .from("manifest")
        .select("*")
        .eq("awb_no", awb)
          .maybeSingle();

        return await Promise.race([centralPromise, timeoutPromise]) as any;
      }, 1, 200); // 1 retry with 200ms base delay

      if (!centralResult.error && centralResult.data) {
        return { ...centralResult.data, manifest_source: "central" }
      }

      // If not found in central, check branch manifest with fast timeout
      const branchTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 1500)
      );

      const branchResult = await withRetry(async () => {
        const branchPromise = client
        .from("manifest_cabang")
        .select("*")
        .eq("awb_no", awb)
          .maybeSingle();

        return await Promise.race([branchPromise, branchTimeoutPromise]) as any;
      }, 1, 200); // 1 retry with 200ms base delay

      if (!branchResult.error && branchResult.data) {
        return { ...branchResult.data, manifest_source: "cabang" }
      }

      return null
    } catch (err) {
      // Return null on timeout or error to continue with auto-generated data
      return null
    }
  }

  // Function to create shipment with manifest data (handles both central and branch) with timeout
  const createShipmentWithManifestData = async (awb: string, manifestData: any, courierId: string) => {
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 10000)
      );

      const insertPromise = supabaseClient.from("shipments").insert([
        {
          awb_number: awb,
          sender_name: manifestData.nama_pengirim || "Auto Generated",
          sender_address: manifestData.alamat_pengirim || "Auto Generated",
          sender_phone: manifestData.nomor_pengirim || "Auto Generated",
          receiver_name: manifestData.nama_penerima || "Auto Generated",
          receiver_address: manifestData.alamat_penerima || "Auto Generated",
          receiver_phone: manifestData.nomor_penerima || "Auto Generated",
          weight: manifestData.berat_kg || 1,
          dimensions: manifestData.dimensi || "10x10x10",
          service_type: "Standard",
          current_status: "out_for_delivery",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          courier_id: courierId,
        },
      ]);

      await Promise.race([insertPromise, timeoutPromise]);
      
      const source = manifestData.manifest_source === "central" ? "manifest pusat" : "manifest cabang"
      return { success: true, message: `Created from ${source}` }
    } catch (err) {
      return { success: false, message: `Error: ${err}` }
    }
  }

  // Function to create basic shipment with timeout
  const createBasicShipment = async (awb: string, courierId: string) => {
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 10000)
      );

      const insertPromise = supabaseClient.from("shipments").insert([
        {
          awb_number: awb,
          sender_name: "Auto Generated",
          sender_address: "Auto Generated",
          sender_phone: "Auto Generated",
          receiver_name: "Auto Generated",
          receiver_address: "Auto Generated",
          receiver_phone: "Auto Generated",
          weight: 1,
          dimensions: "10x10x10",
          service_type: "Standard",
          current_status: "out_for_delivery",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          courier_id: courierId,
        },
      ]);

      await Promise.race([insertPromise, timeoutPromise]);
      return { success: true, message: "Created with auto-generated data" }
    } catch (err) {
      return { success: false, message: `Error: ${err}` }
    }
  }

  // Function to update existing shipment with timeout
  const updateExistingShipment = async (awb: string, courierId: string, status: string) => {
    try {
      const client = await getAuthenticatedClient();
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 2000) // Fast timeout for updates
      );

      await withRetry(async () => {
        const updatePromise = client
        .from("shipments")
        .update({
          current_status: status,
          updated_at: new Date().toISOString(),
          courier_id: courierId,
        })
          .eq("awb_number", awb);

        return await Promise.race([updatePromise, timeoutPromise]);
      }, 1, 300); // 1 retry with 300ms base delay

      return { success: true, message: "Updated existing shipment" }
    } catch (err) {
      return { success: false, message: `Error: ${err}` }
    }
  }

  // Function to add shipment history with timeout
  const addShipmentHistory = async (awb: string, status: string, location: string, notes: string) => {
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 10000)
      );

      const insertPromise = supabaseClient.from("shipment_history").insert([
        {
          awb_number: awb,
          status,
          location,
          notes,
          created_at: new Date().toISOString(),
        },
      ]);

      await Promise.race([insertPromise, timeoutPromise]);
      return { success: true, message: "Added to shipment history" }
    } catch (err) {
      return { success: false, message: `Error: ${err}` }
    }
  }

  // Process AWBs in batches to prevent overwhelming the database
  const processBatch = async (awbBatch: string[], courierId: string, courierName: string, location: string, status: string) => {
    const results = await Promise.allSettled(
      awbBatch.map(async (awb) => {
        try {
          // Add minimal random delay to spread database load
          const randomDelay = Math.random() * 200; // 0-200ms random delay
          await new Promise(resolve => setTimeout(resolve, randomDelay));

          // Use authenticated client for reliable database access
          const client = await getAuthenticatedClient();

          // Check if shipment exists with optimized timeout
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 2000) // Reduced to 2 seconds
          );

          const { data: existingShipment } = await withRetry(async () => {
            const existingPromise = client
              .from("shipments")
              .select("awb_number")
              .eq("awb_number", awb)
              .maybeSingle();

            return await Promise.race([existingPromise, timeoutPromise]) as any;
          }, 1, 300); // 1 retry with 300ms base delay

          if (!existingShipment) {
            // Check if AWB exists in manifest with shorter timeout
            const manifestData = await checkManifestAwb(awb)

            if (manifestData) {
              // Create shipment with manifest data using upsert
              const createResult = await createShipmentWithManifestDataUpsert(awb, manifestData, courierId)
              if (!createResult.success) {
                // If failed to create with manifest data, try basic shipment
                await createBasicShipmentUpsert(awb, courierId)
              }
            } else {
              // If not in manifest, create basic shipment using upsert
              await createBasicShipmentUpsert(awb, courierId)
            }
          } else {
            // Update existing shipment
            await updateExistingShipment(awb, courierId, status)
          }

          // Add shipment history entry with shorter timeout
          await addShipmentHistoryOptimized(awb, status, location, `Bulk update - Out for Delivery by ${courierName}`)

          return { awb, success: true }
        } catch (err: any) {
          
          return { awb, success: false, error: err }
        }
      })
    );

    return results.filter(result => result.status === 'fulfilled' && result.value.success).length;
  }

  // Optimized upsert functions for high concurrency
  const createShipmentWithManifestDataUpsert = async (awb: string, manifestData: any, courierId: string) => {
    try {
      const client = await getAuthenticatedClient();
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 3000) // Optimized timeout
      );

      await withRetry(async () => {
        const upsertPromise = client.from("shipments").upsert([
          {
            awb_number: awb,
            sender_name: manifestData.nama_pengirim || "Auto Generated",
            sender_address: manifestData.alamat_pengirim || "Auto Generated",
            sender_phone: manifestData.nomor_pengirim || "Auto Generated",
            receiver_name: manifestData.nama_penerima || "Auto Generated",
            receiver_address: manifestData.alamat_penerima || "Auto Generated",
            receiver_phone: manifestData.nomor_penerima || "Auto Generated",
            weight: manifestData.berat_kg || 1,
            dimensions: manifestData.dimensi || "10x10x10",
            service_type: "Standard",
            current_status: "out_for_delivery",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            courier_id: courierId,
          },
        ], { 
          onConflict: 'awb_number',
          ignoreDuplicates: false 
        });

        return await Promise.race([upsertPromise, timeoutPromise]);
      }, 2, 500); // 2 retries with 500ms base delay
      
      const source = manifestData.manifest_source === "central" ? "manifest pusat" : "manifest cabang"
      return { success: true, message: `Created from ${source}` }
    } catch (err) {
      return { success: false, message: `Error: ${err}` }
    }
  }

  const createBasicShipmentUpsert = async (awb: string, courierId: string) => {
    try {
      const client = await getAuthenticatedClient();
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 3000) // Optimized timeout
      );

      await withRetry(async () => {
        const upsertPromise = client.from("shipments").upsert([
          {
            awb_number: awb,
            sender_name: "Auto Generated",
            sender_address: "Auto Generated",
            sender_phone: "Auto Generated",
            receiver_name: "Auto Generated",
            receiver_address: "Auto Generated",
            receiver_phone: "Auto Generated",
            weight: 1,
            dimensions: "10x10x10",
            service_type: "Standard",
            current_status: "out_for_delivery",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            courier_id: courierId,
          },
        ], { 
          onConflict: 'awb_number',
          ignoreDuplicates: false 
        });

        return await Promise.race([upsertPromise, timeoutPromise]);
      }, 2, 500); // 2 retries with 500ms base delay

      return { success: true, message: "Created with auto-generated data" }
    } catch (err) {
      return { success: false, message: `Error: ${err}` }
    }
  }

  // Optimized history insertion with conflict handling
  const addShipmentHistoryOptimized = async (awb: string, status: string, location: string, notes: string) => {
    try {
      const client = await getAuthenticatedClient();
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 2000) // Fast timeout for history
      );

      // Add unique timestamp to prevent conflicts
      const uniqueTimestamp = new Date().toISOString() + '_' + Math.random().toString(36).substr(2, 9);

      const result = await withRetry(async () => {
        const insertPromise = client.from("shipment_history").insert([
          {
            awb_number: awb,
            status,
            location,
            notes,
          },
        ]);

        return await Promise.race([insertPromise, timeoutPromise]);
      }, 1, 300); // 1 retry with 300ms base delay

      // Handle 409 conflict error gracefully
      if (result && typeof result === 'object' && 'error' in result && result.error && typeof result.error === 'object' && 'code' in result.error && result.error.code === '23505') {
        return { success: true, message: "History entry already exists" }
      }

      return { success: true, message: "Added to shipment history" }
    } catch (err: any) {
      // Handle 409 conflict errors gracefully
      if (err?.message?.includes('409') || err?.code === '23505') {
        return { success: true, message: "History entry conflict resolved" }
      }
      return { success: false, message: `Error: ${err}` }
    }
  }

  const handleSubmit = async () => {
    // Prevent multiple simultaneous submissions
    if (isLoading) {
      return
    }
    
    // Cancel any previous operation
    if (abortController) {
      abortController.abort()
    }
    
    // Create new abort controller for this operation
    const newAbortController = new AbortController()
    setAbortController(newAbortController)
    
    setIsLoading(true)
    setError("")
    setProcessingStatus("Memulai proses...")

    // Add overall timeout protection (5 minutes max)
    const overallTimeout = setTimeout(() => {
      newAbortController.abort()
      setError("Proses timeout. Silakan coba lagi dengan batch yang lebih kecil.")
      setIsLoading(false)
      setProcessingStatus("")
    }, 300000) // 5 minutes

    try {
      // Check if operation was aborted
      if (newAbortController.signal.aborted) {
        throw new Error('Operation aborted')
      }

      const awbList = awbNumbers
        .split(/[\n,\s]+/)
        .map((awb) => awb.trim())
        .filter((awb) => awb.length > 0)

      if (awbList.length === 0) {
        setError("Please enter at least one AWB number")
        return
      }

      // Verify authentication before processing
      setProcessingStatus("Memverifikasi autentikasi...")
      
      try {
        // Use authenticated client to ensure session is valid
        const authClient = await getAuthenticatedClient()
      } catch (authError) {
        setError("Session tidak valid. Silakan login ulang.")
        return
      }

      // Check if operation was aborted
      if (newAbortController.signal.aborted) {
        throw new Error('Operation aborted')
      }

      // Get current user session
      const { data: session, error: sessionError } = await supabaseClient.auth.getSession()

      if (sessionError || !session?.session?.user?.id) {
        setError("Session tidak ditemukan. Silakan login ulang.")
        return
      }

      const courierId = session.session.user.id
      const courierName = currentUser?.name || session.session.user.email?.split("@")[0] || "courier"

      let totalSuccessCount = 0
      const location = "Sorting Center"
      const status = "out_for_delivery"
      
      // Detect mobile device and adjust batch size accordingly
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      const isLowEndDevice = /Android.*Mobile|webOS|BlackBerry|IEMobile/i.test(navigator.userAgent)
      
      // Use smaller batch size for mobile devices, especially low-end ones
      const batchSize = isLowEndDevice ? 2 : (isMobile ? 3 : 5)

      // Process AWBs in batches
      for (let i = 0; i < awbList.length; i += batchSize) {
        // Check if operation was aborted before each batch
        if (newAbortController.signal.aborted) {
          throw new Error('Operation aborted')
        }
        
        const batch = awbList.slice(i, i + batchSize)
        const batchNumber = Math.floor(i / batchSize) + 1
        const totalBatches = Math.ceil(awbList.length / batchSize)
        
        setProcessingStatus(`Memproses batch ${batchNumber}/${totalBatches} (${batch.length} AWB)...`)

        try {
          const batchSuccessCount = await processBatch(batch, courierId, courierName, location, status)
          totalSuccessCount += batchSuccessCount
        } catch (err) {
          // Continue with next batch even if this one fails
          setProcessingStatus(`Batch ${batchNumber} gagal, melanjutkan ke batch berikutnya...`)
        }

        // Add shorter delay between batches for faster processing
        if (i + batchSize < awbList.length) {
          // Longer delay for mobile devices to prevent overwhelming
          const baseDelay = isLowEndDevice ? 800 : (isMobile ? 500 : 300)
          const delay = Math.random() * baseDelay + baseDelay; // Double the base delay with randomization
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }

      // Check if operation was aborted before final steps
      if (newAbortController.signal.aborted) {
        throw new Error('Operation aborted')
      }

      // Show final status
      setProcessingStatus(`Selesai! ${totalSuccessCount}/${awbList.length} AWB berhasil diproses.`)
      
      // Wait briefly to show the final status
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Notify parent component about success and close modal
      onSuccess(totalSuccessCount)

      // Reset form and close modal
      setAwbNumbers("")
      onClose()
    } catch (error: any) {
      // Don't show error if operation was intentionally aborted
      if (error?.message === 'Operation aborted') {
        return
      }
      
      // Handle specific error types
      if (error?.message?.includes('401') || error?.message?.includes('Unauthorized')) {
        setError("Session expired. Silakan login ulang.")
      } else if (error?.message?.includes('timeout') || error?.message?.includes('Timeout')) {
        setError("Request timeout. Silakan coba lagi dengan batch yang lebih kecil.")
      } else {
        setError(`Terjadi kesalahan: ${error?.message || 'Unknown error'}. Silakan coba lagi.`)
      }
    } finally {
      // Clear the timeout
      clearTimeout(overallTimeout)
      
      // Always reset loading state regardless of success or error
      setIsLoading(false)
      setProcessingStatus("")
      setAbortController(null)
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          if (isLoading) {
            // Prevent closing modal during processing unless explicitly cancelled
            const shouldClose = confirm("Proses sedang berjalan. Apakah Anda yakin ingin membatalkan?")
            if (shouldClose && abortController) {
              abortController.abort()
              setIsLoading(false)
              setProcessingStatus("")
              onClose()
            }
          } else {
            onClose()
          }
        }
      }}
    >
      <DialogContent key={modalKey} className={`sm:max-w-md p-6 ${showScanner ? "" : "bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700"}`}>
        {showScanner ? (
          <QRScanner onScan={handleQRScan} onClose={() => setShowScanner(false)} />
        ) : (
          <>
            <DialogHeader className="mb-4">
              <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white">Bulk Update AWB Numbers</DialogTitle>
              <DialogDescription className="text-gray-600 dark:text-gray-400">
                Enter multiple AWB numbers (one per line or separated by commas) to update their status to{" "}
                <b className="text-blue-600 dark:text-blue-400">Out For Delivery</b>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="awb-numbers" className="text-gray-700 dark:text-gray-300 font-semibold">AWB Numbers</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowScanner(true)}
                    className="flex items-center gap-1 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                  >
                    <FontAwesomeIcon icon={faCamera} className="h-4 w-4" />
                    <span>Scan QR</span>
                  </Button>
                </div>
                <Textarea
                  id="awb-numbers"
                  placeholder="Enter AWB numbers here..."
                  rows={6}
                  value={awbNumbers}
                  onChange={(e) => setAwbNumbers(e.target.value)}
                  className="font-mono bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-muted-foreground">
                  contoh: BCE123456789, BCE987654321, BE0423056087 hati-hati dijalan
                </p>
                {currentUser && (
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    Updates will be attributed to: <span className="font-semibold">{currentUser.name || currentUser.email?.split("@")[0]}</span>
                  </p>
                )}
              </div>
            </div>

            <DialogFooter className="flex flex-col space-y-2 mt-4">
              {processingStatus && (
                <div className="w-full text-center text-sm text-blue-600 dark:text-blue-400 mb-2">
                  {processingStatus}
                </div>
              )}
              <div className="flex justify-end space-x-2 w-full">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    if (isLoading && abortController) {
                      // Cancel the ongoing operation
                      abortController.abort()
                      setIsLoading(false)
                      setProcessingStatus("Dibatalkan oleh user")
                      setTimeout(() => {
                        setProcessingStatus("")
                        onClose()
                      }, 1000)
                    } else {
                      onClose()
                    }
                  }} 
                  className="border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800/50"
                >
                  {isLoading ? "Cancel Operation" : "Cancel"}
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={isLoading || awbNumbers.trim().length === 0} 
                  className="bg-yellow-500 hover:bg-yellow-600 dark:bg-yellow-600 dark:hover:bg-yellow-700 font-bold text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} className="mr-2 h-4 w-4 animate-spin" /> Processing...
                    </>
                  ) : (
                    "Update All For Delivery"
                  )}
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
