"use client"

import { useState, useEffect, useRef } from "react"
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
import { toast } from "sonner"
import { QRScanner } from './qr-scanner'
import { Dialog as UIDialog, DialogContent as UIDialogContent, DialogHeader as UIDialogHeader, DialogTitle as UIDialogTitle, DialogFooter as UIDialogFooter } from "@/components/ui/dialog"

interface BulkUpdateModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (count: number) => void
  currentUser?: {
    id: string;
    name?: string;
    email?: string;
  }
}

interface ExistingShipment {
  awb_number: string;
  current_status: string;
}

interface ManifestData {
  nama_penerima: string;
  alamat_penerima: string;
  nomor_penerima: string;
}

interface UpdateResult {
  awb: string;
  success: boolean;
  error?: string;
  shipmentSuccess?: boolean;
  historySuccess?: boolean;
}

export function BulkUpdateModal({ isOpen, onClose, onSuccess, currentUser }: BulkUpdateModalProps) {
  const [awbNumbers, setAwbNumbers] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [processingStatus, setProcessingStatus] = useState<string>("")
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [modalKey, setModalKey] = useState<string>(Date.now().toString())
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [recapModal, setRecapModal] = useState<{ successCount: number, deliveredAwbs: string[] } | null>(null)
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const submitButtonRef = useRef<HTMLButtonElement>(null)

  const playScanSuccessSound = () => {
    const audio = new Audio('/sounds/scan_success.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {
      // Silently handle audio play errors
    });
  };

  // Validasi format AWB harus dimulai dengan BCE atau BE
  const validateAwb = (awb: string): boolean => {
    const cleanAwb = awb.trim().toUpperCase()
    return cleanAwb.startsWith('BCE') || cleanAwb.startsWith('BE')
  }

  const handleQRScan = (result: string) => {
    if (result) {
      const newAwb = result.trim().toUpperCase();
      
      // Validasi format AWB
      if (!validateAwb(newAwb)) {
        toast.error("Invalid AWB format", { 
          description: "AWB number must start with BCE or BE",
          duration: 2000
        });
        return;
      }
      
      const currentAwbs = awbNumbers.split(/\s*,\s*|\s+|\n/).filter(Boolean);

      if (!currentAwbs.includes(newAwb)) {
        setAwbNumbers(prev => (prev ? `${prev}\n${newAwb}` : newAwb));
        playScanSuccessSound();
      } else {
        toast.warning("Duplicate AWB scanned!", {
          description: `${newAwb} has already been added.`, 
          duration: 2000,
        });
      }
    }
    setShowScanner(false);
  };

  const handleQRScannerError = (error: string) => {
    toast.error("QR Scanner Error", { description: error });
    setShowScanner(false);
  };

  // Handle mobile keyboard detection
  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        const viewport = window.visualViewport;
        if (viewport) {
          const keyboardHeight = window.innerHeight - viewport.height;
          setIsKeyboardOpen(keyboardHeight > 150); // Threshold for keyboard detection
        }
      }
    };

    const handleVisualViewportChange = () => {
      if (typeof window !== 'undefined' && window.visualViewport) {
        const keyboardHeight = window.innerHeight - window.visualViewport.height;
        setIsKeyboardOpen(keyboardHeight > 150);
      }
    };

    if (typeof window !== 'undefined') {
      // Modern browsers with Visual Viewport API
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', handleVisualViewportChange);
      }
      
      // Fallback for older browsers
      window.addEventListener('resize', handleResize);
      
      return () => {
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', handleVisualViewportChange);
        }
        window.removeEventListener('resize', handleResize);
      };
    }
  }, []);

  // Auto-scroll to submit button when keyboard opens and textarea is focused
  useEffect(() => {
    if (isKeyboardOpen && textareaRef.current === document.activeElement) {
      setTimeout(() => {
        submitButtonRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest',
          inline: 'nearest'
        });
      }, 300); // Delay to allow keyboard animation
    }
  }, [isKeyboardOpen]);

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

        // Note: currentUser is now passed as a prop, no need to set local state
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
      setIsKeyboardOpen(false)
      setShowScanner(false)
      
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
      setIsKeyboardOpen(false)
      setShowScanner(false)
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

      // Bersihkan AWB number dari karakter tidak perlu
      const cleanAwb = awb.trim().toUpperCase();
      
      // Beberapa kemungkinan format AWB (dengan atau tanpa prefix)
      let awbsToCheck = [cleanAwb];
      
      // Jika AWB dimulai dengan BCE atau BE, tambahkan versi tanpa prefix
      if (cleanAwb.startsWith('BCE')) {
        awbsToCheck.push(cleanAwb.substring(3)); // Tanpa 'BCE'
      } else if (cleanAwb.startsWith('BE')) {
        awbsToCheck.push(cleanAwb.substring(2)); // Tanpa 'BE'
      } 
      // Jika AWB adalah angka saja, tambahkan versi dengan prefix
      else if (/^\d+$/.test(cleanAwb)) {
        awbsToCheck.push('BCE' + cleanAwb);
        awbsToCheck.push('BE' + cleanAwb);
      }
      
      // Coba semua format AWB yang mungkin dengan timeout
      for (const awbFormat of awbsToCheck) {
        // Check central manifest first (no retry for speed)
        try {
          const centralPromise = client
            .from("manifest")
            .select("nama_penerima,alamat_penerima,nomor_penerima")
            .ilike("awb_no", awbFormat)
            .maybeSingle();

          const centralResult = await Promise.race([centralPromise, timeoutPromise]) as { data?: unknown; error?: string };
          
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
            .select("nama_penerima,alamat_penerima,nomor_penerima")
            .ilike("awb_no", awbFormat)
            .maybeSingle();

          const branchResult = await Promise.race([branchPromise, timeoutPromise]) as { data?: unknown; error?: string };
          
          if (!branchResult.error && branchResult.data) {
            return { ...branchResult.data, manifest_source: "cabang" }
          }
        } catch (e) {
          // Ignore branch manifest errors for speed
        }
      }

      // 3. Jika tidak ditemukan di manifest lokal, cek web cabang Borneo untuk BE resi
      if (cleanAwb.startsWith('BE')) {
        try {
          const branchResponse = await fetch(`/api/manifest/search?awb_number=${cleanAwb}`);
          
          if (branchResponse.ok) {
            const branchData = await branchResponse.json();
            
            if (branchData.success && branchData.data) {
              const borneoBranchManifest = branchData.data;
              
              // Return raw Borneo data with manifest_source marker
              return {
                ...borneoBranchManifest,
                manifest_source: "borneo_branch"
              };
            }
          }
        } catch (branchError) {
          console.error('Error fetching from Borneo branch:', branchError);
        }
      }

      return null
    } catch (err) {
      return null
    }
  }

  // Ultra-fast parallel processing with better error handling
  // OPTIMASI: Fungsi bulk update yang efisien untuk 20-30 resi
  const processAwbsParallel = async (awbList: string[], courierId: string, courierName: string) => {
    const location = "Sorting Center"
    const status = "out_for_delivery"
    const timestamp = new Date().toISOString()
    
    // OPTIMASI: Batch processing untuk menghindari overload
    const BATCH_SIZE = 5
    const results: UpdateResult[] = []
    
    for (let i = 0; i < awbList.length; i += BATCH_SIZE) {
      const batch = awbList.slice(i, i + BATCH_SIZE)
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(awbList.length / BATCH_SIZE)
      
      setProcessingStatus(`Processing batch ${batchNumber}/${totalBatches}...`)
      
      // Process batch in parallel
      const batchPromises = batch.map(async (awb, index) => {
        try {
          // Small delay untuk menghindari collision
          await new Promise(resolve => setTimeout(resolve, index * 20))
          
          const client = await getPooledClient()
          
          // Quick check existing shipment with explicit columns
          const { data: existing, error: existingError } = await client
            .from("shipments")
            .select("awb_number,current_status")
            .eq("awb_number", awb)
            .maybeSingle()
          
          if (existingError) {
            console.error(`Error checking existing shipment for ${awb}:`, existingError);
            return { awb, success: false, error: `Database error: ${existingError.message}` }
          }
          
          // Skip jika sudah delivered
          if (existing?.current_status === 'delivered') {
            return { awb, success: false, error: 'Already delivered' }
          }
          
          let shipmentSuccess = false
          let historySuccess = false
          
          // Create/update shipment dengan data dari manifest jika tersedia
          if (!existing) {
            // Check manifest untuk data yang lebih lengkap
            const manifestData = await checkManifestAwb(awb);
            
            let shipmentData;
            let dataSource = "auto_generated";
            
            if (manifestData) {
              // Always use manifest data if available, fallback to empty string if missing
              dataSource = manifestData.manifest_source || "manifest";
              let senderName = '';
              let senderAddress = '';
              let senderPhone = '';
              let receiverName = '';
              let receiverAddress = '';
              let receiverPhone = '';
              if (manifestData.manifest_source === 'borneo_branch') {
                // Use correct structure from Borneo API response
                const borneoData = manifestData as import("@/types").BranchManifestData;
                senderName = borneoData.pengirim?.nama_pengirim || '';
                senderAddress = borneoData.pengirim?.alamat_pengirim || '';
                senderPhone = borneoData.pengirim?.no_pengirim || '';
                receiverName = borneoData.penerima?.nama_penerima || '';
                receiverAddress = borneoData.penerima?.alamat_penerima || '';
                receiverPhone = borneoData.penerima?.no_penerima || '';
              } else {
                // Local manifest structure
                const localData = manifestData as {
                  nama_pengirim?: string;
                  alamat_pengirim?: string;
                  nomor_pengirim?: string;
                  nama_penerima?: string;
                  alamat_penerima?: string;
                  nomor_penerima?: string;
                };
                senderName = localData.nama_pengirim || '';
                senderAddress = localData.alamat_pengirim || '';
                senderPhone = localData.nomor_pengirim || '';
                receiverName = localData.nama_penerima || '';
                receiverAddress = localData.alamat_penerima || '';
                receiverPhone = localData.nomor_penerima || '';
              }
              shipmentData = {
                awb_number: awb,
                sender_name: senderName,
                sender_address: senderAddress, 
                sender_phone: senderPhone,
                receiver_name: receiverName,
                receiver_address: receiverAddress,
                receiver_phone: receiverPhone,
                weight: 1,
                dimensions: "10x10x10",
                service_type: "Standard",
                current_status: status,
                created_at: timestamp,
                updated_at: timestamp,
                courier_id: courierId,
              };
            } else {
              // No manifest data found
              shipmentData = {
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
            }
            
            // Create new shipment with proper error handling
            const { error: shipmentError } = await client
              .from("shipments")
              .insert([shipmentData]); // Wrap in array for better compatibility
            
            if (shipmentError) {
              console.error(`Error creating shipment for ${awb}:`, shipmentError);
              return { awb, success: false, error: `Insert error: ${shipmentError.message}` }
            }
            shipmentSuccess = true
          } else {
            // Update existing shipment with proper error handling
            const { error: updateError } = await client
              .from("shipments")
              .update({
                current_status: status,
                updated_at: timestamp,
                courier_id: courierId,
              })
              .eq("awb_number", awb)
            
            if (updateError) {
              console.error(`Error updating shipment for ${awb}:`, updateError);
              return { awb, success: false, error: `Update error: ${updateError.message}` }
            }
            shipmentSuccess = true
          }
          
          // Add history record if shipment successful
          if (shipmentSuccess) {
            const { error: historyError } = await client
              .from("shipment_history")
              .insert([{
                awb_number: awb,
                status,
                location,
                notes: `Bulk update - Out for Delivery by ${courierName}`,
                created_at: new Date(Date.now() + i + index).toISOString(), // Unique timestamp
              }])
            
            if (historyError) {
              console.error(`Error creating history for ${awb}:`, historyError);
              // Don't fail the whole operation for history errors
              historySuccess = false
            } else {
              historySuccess = true
            }
          }
          
          return {
            awb,
            success: shipmentSuccess && historySuccess,
            shipmentSuccess,
            historySuccess,
          }
          
        } catch (error) {
          return {
            awb,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      })
      
      // Wait for batch completion
      const batchResults = await Promise.allSettled(batchPromises)
      
      // Collect results
      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          results.push({
            awb: 'unknown',
            success: false,
            error: 'Processing failed'
          })
        }
      })
      
      // Small delay between batches
      if (i + BATCH_SIZE < awbList.length) {
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }
    
    // Process results
    const successCount = results.filter(r => r.success).length
    const deliveredAwbs = results
      .filter(r => r.error === 'Already delivered')
      .map(r => r.awb)
    
    if (deliveredAwbs.length > 0) {
      setRecapModal({ successCount, deliveredAwbs })
    }
    
    return { successCount, deliveredAwbs }
  }

  const handleSubmit = async () => {
    if (!currentUser || !currentUser.id) {
      setError("User not authenticated.")
      return
    }

    const awbList = awbNumbers
      .split(/\s*,\s*|\s+|\n/)
      .filter(Boolean)
      .map((awb) => awb.trim())

    if (awbList.length === 0) {
      setError("Please enter at least one AWB number.")
      return
    }

    setError(null)
    setIsLoading(true)
    setProcessingStatus("Processing AWBs...")
    const controller = new AbortController()
    setAbortController(controller)

    try {
      // Ambil hasil recap dari processAwbsParallel
      const { successCount, deliveredAwbs } = await processAwbsParallel(
        awbList,
        currentUser.id,
        currentUser.name || currentUser.email?.split("@")[0] || "courier",
      )

      if (deliveredAwbs.length > 0) {
        setRecapModal({ successCount, deliveredAwbs })
        // Tunggu user close modal recap
        return
      }
      // Jika semua berhasil, langsung close
      toast.success("Bulk Update Complete", {
        description: `Successfully processed ${successCount} shipments.`,
        duration: 5000,
      })
      onSuccess(successCount)
      onClose()
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setProcessingStatus("Operation cancelled.")
        toast.info("Update Cancelled", { description: "Bulk update operation was cancelled." });
      } else {
        const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during bulk update.";
        setError(errorMessage)
        toast.error("Bulk Update Failed", {
          description: errorMessage,
          duration: 5000,
        });
      }
    } finally {
      setIsLoading(false)
      setAbortController(null)
    }
  }

  // Handler untuk close recap modal
  const handleCloseRecapModal = () => {
    if (recapModal) {
      onSuccess(recapModal.successCount)
      onClose()
      setRecapModal(null)
    }
  }

  const handleCancel = () => {
    if (abortController) {
      abortController.abort()
    }
    onClose()
  }

  return (
    <>
      {/* Mobile viewport fix for keyboard handling */}
      <style jsx global>{`
        @media (max-width: 640px) {
          .mobile-keyboard-open {
            position: fixed !important;
            top: 10px !important;
            bottom: auto !important;
            max-height: 60vh !important;
            transform: none !important;
          }
          
          .mobile-keyboard-open .dialog-content {
            max-height: 60vh !important;
            overflow-y: auto !important;
          }
          
          .mobile-keyboard-footer {
            position: sticky !important;
            bottom: 0 !important;
            background: white !important;
            border-top: 1px solid #e5e7eb !important;
            margin-top: auto !important;
            z-index: 10 !important;
          }
          
          .dark .mobile-keyboard-footer {
            background: #111827 !important;
            border-top-color: #374151 !important;
          }
        }
        
        /* Hide default dialog close button ONLY for bulk update modal */
        .bulk-update-modal [data-radix-collection-item] button[aria-label="Close"] {
          display: none !important;
        }
        
        .bulk-update-modal button[data-state] > svg {
          display: none !important;
        }
        
        .bulk-update-modal .dialog-content button[type="button"]:has(svg) {
          display: none !important;
        }
      `}</style>
      
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
        <div className="bulk-update-modal">
        {/* Recap Modal Popup */}
        {recapModal && (
          <UIDialog open={true}>
            <UIDialogContent className="max-w-md">
              <UIDialogHeader>
                <UIDialogTitle>Rekap Bulk Update</UIDialogTitle>
              </UIDialogHeader>
              <div className="py-4">
                <p className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-100">
                  {recapModal.successCount} resi berhasil diupdate.
                </p>
                <p className="mb-2 text-base text-red-600 dark:text-red-400">
                  {recapModal.deliveredAwbs.length} resi sudah delivered:
                </p>
                <ul className="list-disc ml-6 text-sm text-gray-700 dark:text-gray-200">
                  {recapModal.deliveredAwbs.map((awb) => (
                    <li key={awb}>{awb}</li>
                  ))}
                </ul>
              </div>
              <UIDialogFooter>
                <Button onClick={handleCloseRecapModal} className="w-full">OK</Button>
              </UIDialogFooter>
            </UIDialogContent>
          </UIDialog>
        )}
        <DialogContent 
          key={modalKey} 
          className={`w-[95vw] max-w-[420px] ${isKeyboardOpen ? 'max-h-[60vh] mobile-keyboard-open' : 'max-h-[90vh]'} p-4 sm:p-6 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 mx-auto overflow-hidden dialog-content`}
        >
          <DialogHeader className="mb-3 sm:mb-4">
              <DialogTitle className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white break-words">Bulk Update Manual</DialogTitle>
              <DialogDescription className="text-sm sm:text-base text-gray-600 dark:text-gray-400 break-words">
                Masukkan nomor resi satu per baris atau dipisahkan dengan koma untuk mengupdate status ke{" "}
                <b className="text-blue-600 dark:text-blue-400">Out For Delivery</b>
                <br />
                
              </DialogDescription>
            </DialogHeader>

            <div className={`space-y-3 sm:space-y-4 py-2 sm:py-4 overflow-hidden ${isKeyboardOpen ? 'max-h-[25vh] overflow-y-auto' : ''}`}>
              {error && <p className="text-sm text-red-500 px-1 break-words">{error}</p>}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="awb-numbers" className="text-sm sm:text-base text-gray-700 dark:text-gray-300 font-semibold">AWB Numbers</Label>
                </div>
                {showScanner ? (
                  <div className="p-4">
                    <QRScanner onScan={handleQRScan} onClose={() => setShowScanner(false)} />
                    <Button onClick={() => setShowScanner(false)} className="mt-4 w-full">
                      Back to Manual Entry
                    </Button>
                  </div>
                ) : (
                  <Textarea
                    id="awb-numbers"
                    placeholder="Masukkan nomor resi di sini..."
                    rows={isKeyboardOpen ? 3 : 5}
                    value={awbNumbers}
                    onChange={(e) => setAwbNumbers(e.target.value)}
                    className="text-sm sm:text-base font-mono bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:ring-blue-500 focus:border-blue-500 min-h-[120px] resize-none w-full"
                    ref={textareaRef}
                    onFocus={() => {
                      // Small delay to ensure keyboard is open before scrolling
                      setTimeout(() => {
                        if (isKeyboardOpen) {
                          submitButtonRef.current?.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'nearest' 
                          });
                        }
                      }, 500);
                    }}
                  />
                )}
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

            <DialogFooter className={`flex flex-col space-y-3 mt-3 sm:mt-4 ${isKeyboardOpen ? 'sticky bottom-0 bg-white dark:bg-gray-900 pt-3 border-t border-gray-200 dark:border-gray-700 mobile-keyboard-footer' : ''}`}>
              {processingStatus && (
                <div className="w-full text-center text-sm text-blue-600 dark:text-blue-400 mb-2 px-2 break-words max-w-full overflow-hidden">
                  <div className="truncate max-w-full" title={processingStatus}>
                    {processingStatus}
                  </div>
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full">
                <Button 
                  onClick={handleSubmit} 
                  disabled={isLoading || awbNumbers.trim().length === 0} 
                  className="w-full sm:flex-1 bg-yellow-500 hover:bg-yellow-600 dark:bg-yellow-600 dark:hover:bg-yellow-700 font-bold text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base py-2 sm:py-3 min-w-0 order-1 sm:order-2"
                  ref={submitButtonRef}
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
                    } else if (isLoading) {
                      // If loading but no abort controller, just close
                      onClose()
                    } else {
                      setShowScanner(true)
                    }
                  }} 
                  className="w-full sm:w-auto border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800/50 text-sm sm:text-base py-2 sm:py-3 min-w-0 order-2 sm:order-1"
                >
                  <span className="truncate">{isLoading ? "Batal" : "Scan QR"}</span>
                </Button>
                <Button 
                  variant="outline" 
                  onClick={onClose}
                  disabled={isLoading}
                  className="w-full sm:w-auto border-2 border-gray-400 text-gray-700 hover:bg-gray-100 hover:border-gray-500 dark:border-gray-500 dark:text-gray-300 dark:hover:bg-gray-800/50 dark:hover:border-gray-400 text-sm sm:text-base py-2 sm:py-3 px-4 min-w-0 order-3 disabled:opacity-50 font-medium"
                >
                  <span className="truncate">Tutup</span>
                </Button>
              </div>
            </DialogFooter>
        </DialogContent>
        </div>
      </Dialog>
    </>
  )
}
