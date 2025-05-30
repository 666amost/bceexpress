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
      setAbortController(null)
    }
  }, [isOpen, abortController])

  // Ultra-fast manifest check with aggressive timeout
  const checkManifestAwb = async (awb: string) => {
    try {
      const client = await getPooledClient(); // Use pooled client for better performance
      
      // Super fast timeout - 500ms max
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 500)
      );

      // Check central manifest first (no retry for speed)
      try {
        const centralPromise = client
          .from("manifest")
          .select("nama_pengirim,alamat_pengirim,nomor_pengirim,nama_penerima,alamat_penerima,nomor_penerima,berat_kg,dimensi")
          .eq("awb_no", awb)
          .maybeSingle();

        const centralResult = await Promise.race([centralPromise, timeoutPromise]) as any;
        
        if (!centralResult.error && centralResult.data) {
          return { ...centralResult.data, manifest_source: "central" }
        }
      } catch (e) {
        // Ignore central manifest errors for speed
      }

      // Quick check branch manifest
      try {
        const branchPromise = client
          .from("manifest_cabang")
          .select("nama_pengirim,alamat_pengirim,nomor_pengirim,nama_penerima,alamat_penerima,nomor_penerima,berat_kg,dimensi")
          .eq("awb_no", awb)
          .maybeSingle();

        const branchResult = await Promise.race([branchPromise, timeoutPromise]) as any;
        
        if (!branchResult.error && branchResult.data) {
          return { ...branchResult.data, manifest_source: "cabang" }
        }
      } catch (e) {
        // Ignore branch manifest errors for speed
      }

      return null
    } catch (err) {
      return null
    }
  }

  // Ultra-fast parallel processing for maximum speed
  const processAwbsParallel = async (awbList: string[], courierId: string, courierName: string) => {
    const location = "Sorting Center"
    const status = "out_for_delivery"
    const timestamp = new Date().toISOString()
    
    // Process all AWBs in parallel for maximum speed
    const results = await Promise.allSettled(
      awbList.map(async (awb, index) => {
        try {
          // Stagger requests slightly to avoid overwhelming database
          await new Promise(resolve => setTimeout(resolve, index * 10)); // 10ms stagger
          
          const client = await getPooledClient();
          
          // Fast timeout for all operations
          const fastTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 800) // 800ms max per AWB
          );

          // Check if shipment exists (super fast)
          const existingCheck = client
            .from("shipments")
            .select("awb_number")
            .eq("awb_number", awb)
            .maybeSingle();

          const { data: existingShipment } = await Promise.race([existingCheck, fastTimeout]) as any;

          let shipmentOperation;
          
          if (!existingShipment) {
            // Quick manifest check in parallel
            const manifestPromise = checkManifestAwb(awb);
            
            // Prepare basic shipment data
            const basicShipmentData = {
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
              current_status: status,
              created_at: timestamp,
              updated_at: timestamp,
              courier_id: courierId,
            };

            // Wait for manifest check (with timeout)
            const manifestData = await Promise.race([
              manifestPromise,
              new Promise(resolve => setTimeout(() => resolve(null), 300)) // 300ms timeout for manifest
            ]);

            // Use manifest data if available, otherwise use basic data
            const shipmentData = manifestData ? {
              ...basicShipmentData,
              sender_name: manifestData.nama_pengirim || "Auto Generated",
              sender_address: manifestData.alamat_pengirim || "Auto Generated",
              sender_phone: manifestData.nomor_pengirim || "Auto Generated", 
              receiver_name: manifestData.nama_penerima || "Auto Generated",
              receiver_address: manifestData.alamat_penerima || "Auto Generated",
              receiver_phone: manifestData.nomor_penerima || "Auto Generated",
              weight: manifestData.berat_kg || 1,
              dimensions: manifestData.dimensi || "10x10x10",
            } : basicShipmentData;

            // Create shipment with upsert for safety
            shipmentOperation = client
              .from("shipments")
              .upsert([shipmentData], { 
                onConflict: 'awb_number',
                ignoreDuplicates: false 
              });
          } else {
            // Update existing shipment
            shipmentOperation = client
              .from("shipments")
              .update({
                current_status: status,
                updated_at: timestamp,
                courier_id: courierId,
              })
              .eq("awb_number", awb);
          }

          // Execute shipment operation and history insert in parallel
          const historyOperation = client
            .from("shipment_history")
            .insert([{
              awb_number: awb,
              status,
              location,
              notes: `Bulk update - Out for Delivery by ${courierName}`,
              created_at: timestamp,
            }]);

          // Execute both operations in parallel with timeout
          await Promise.race([
            Promise.all([shipmentOperation, historyOperation]),
            fastTimeout
          ]);

          return { awb, success: true };
        } catch (err: any) {
          // Log error but don't fail the entire batch
          console.warn(`Failed to process AWB ${awb}:`, err);
          return { awb, success: false, error: err.message };
        }
      })
    );

    // Count successful operations
    const successCount = results.filter(result => 
      result.status === 'fulfilled' && result.value.success
    ).length;

    return successCount;
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
    setProcessingStatus("Memproses...")

    // Short timeout for fast processing (30 seconds max)
    const overallTimeout = setTimeout(() => {
      newAbortController.abort()
      setError("Proses timeout. Silakan coba lagi.")
      setIsLoading(false)
      setProcessingStatus("")
    }, 30000) // 30 seconds

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
        setError("Masukkan minimal satu nomor resi")
        return
      }

      // Quick auth verification
      const { data: session, error: sessionError } = await supabaseClient.auth.getSession()

      if (sessionError || !session?.session?.user?.id) {
        setError("Session tidak ditemukan. Silakan login ulang.")
        return
      }

      const courierId = session.session.user.id
      const courierName = currentUser?.name || session.session.user.email?.split("@")[0] || "courier"

      // Check if operation was aborted
      if (newAbortController.signal.aborted) {
        throw new Error('Operation aborted')
      }

      setProcessingStatus(`Proses ${awbList.length} resi...`)

      // Process all AWBs in parallel for maximum speed
      const successCount = await processAwbsParallel(awbList, courierId, courierName)

      // Check if operation was aborted before final steps
      if (newAbortController.signal.aborted) {
        throw new Error('Operation aborted')
      }

      // Show final status
      setProcessingStatus(`Selesai! ${successCount}/${awbList.length} berhasil`)
      
      // Brief pause to show result
      await new Promise(resolve => setTimeout(resolve, 500))

      // Play success sound
      playScanSuccessSound()

      // Notify parent component about success and close modal
      onSuccess(successCount)

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
        setError("Request timeout. Silakan coba lagi.")
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
      <DialogContent key={modalKey} className="w-[95vw] max-w-[420px] max-h-[90vh] p-4 sm:p-6 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 mx-auto overflow-hidden">
          <DialogHeader className="mb-3 sm:mb-4">
              <DialogTitle className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white break-words">Bulk Update Manual</DialogTitle>
              <DialogDescription className="text-sm sm:text-base text-gray-600 dark:text-gray-400 break-words">
                Masukkan nomor resi satu per baris atau dipisahkan dengan koma untuk mengupdate status ke{" "}
                <b className="text-blue-600 dark:text-blue-400">Out For Delivery</b>
                <br />
                
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 sm:space-y-4 py-2 sm:py-4 overflow-hidden">
              {error && <p className="text-sm text-red-500 px-1 break-words">{error}</p>}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="awb-numbers" className="text-sm sm:text-base text-gray-700 dark:text-gray-300 font-semibold">AWB Numbers</Label>
                </div>
                <Textarea
                  id="awb-numbers"
                  placeholder="Masukkan nomor resi di sini..."
                  rows={5}
                  value={awbNumbers}
                  onChange={(e) => setAwbNumbers(e.target.value)}
                  className="text-sm sm:text-base font-mono bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:ring-blue-500 focus:border-blue-500 min-h-[120px] resize-none w-full"
                />
                <p className="text-xs text-muted-foreground px-1 break-words">
                  contoh: BCE556786, 556744, Hanya untuk resi manual
                </p>
                {currentUser && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 px-1 break-words">
                    Updates will be attributed to: <span className="font-semibold break-all">{currentUser.name || currentUser.email?.split("@")[0]}</span>
                  </p>
                )}
              </div>
            </div>

            <DialogFooter className="flex flex-col space-y-3 mt-3 sm:mt-4">
              {processingStatus && (
                <div className="w-full text-center text-sm text-blue-600 dark:text-blue-400 mb-2 px-2 break-words max-w-full overflow-hidden">
                  <div className="truncate max-w-full" title={processingStatus}>
                    {processingStatus}
                  </div>
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    if (isLoading && abortController) {
                      // Cancel the ongoing operation
                      abortController.abort()
                      setIsLoading(false)
                      setProcessingStatus("Dibatalkan")
                      setTimeout(() => {
                        setProcessingStatus("")
                        onClose()
                      }, 1000)
                    } else {
                      onClose()
                    }
                  }} 
                  className="w-full sm:w-auto border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800/50 text-sm sm:text-base py-2 sm:py-3 min-w-0"
                >
                  <span className="truncate">{isLoading ? "Batal" : "Cancel"}</span>
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={isLoading || awbNumbers.trim().length === 0} 
                  className="w-full sm:flex-1 bg-yellow-500 hover:bg-yellow-600 dark:bg-yellow-600 dark:hover:bg-yellow-700 font-bold text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base py-2 sm:py-3 min-w-0"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center min-w-0">
                      <FontAwesomeIcon icon={faSpinner} className="mr-2 h-4 w-4 animate-spin flex-shrink-0" /> 
                      <span className="truncate">Processing...</span>
                    </div>
                  ) : (
                    <span className="truncate">Update For Delivery</span>
                  )}
                </Button>
              </div>
            </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
