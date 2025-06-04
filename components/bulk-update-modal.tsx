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
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const submitButtonRef = useRef<HTMLButtonElement>(null)

  const playScanSuccessSound = () => {
    const audio = new Audio('/sounds/scan_success.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {
      // Silently handle audio play errors
    });
  };

  const handleQRScan = (result: string) => {
    if (result) {
      const newAwb = result.trim();
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

  // Ultra-fast parallel processing with better error handling
  const processAwbsParallel = async (awbList: string[], courierId: string, courierName: string) => {
    const location = "Sorting Center"
    const status = "out_for_delivery"
    const timestamp = new Date().toISOString()
    
    // Process all AWBs in parallel but with better error handling
    const results = await Promise.allSettled(
      awbList.map(async (awb, index) => {
        try {
          // Stagger requests to avoid overwhelming database
          await new Promise(resolve => setTimeout(resolve, index * 50)); // Increased to 50ms stagger
          
          const client = await getPooledClient();
          
          // Longer timeout for more reliable operations
          const operationTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 2000) // Increased to 2 seconds
          );

          // Check if shipment exists
          const existingCheck = client
            .from("shipments")
            .select("awb_number")
            .eq("awb_number", awb)
            .maybeSingle();

          const { data: existingShipment } = await Promise.race([existingCheck, operationTimeout]) as any;

          let shipmentSuccess = false;
          let historySuccess = false;
          
          // Step 1: Handle shipment creation/update
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
              new Promise(resolve => setTimeout(() => resolve(null), 500)) // Increased timeout for manifest
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

            // Create shipment with retry
            try {
              const shipmentOperation = client
                .from("shipments")
                .upsert([shipmentData], { 
                  onConflict: 'awb_number',
                  ignoreDuplicates: false 
                });

              await Promise.race([shipmentOperation, operationTimeout]);
              shipmentSuccess = true;
            } catch (shipmentError) {
              // Try one more time with basic data
              try {
                const retryOperation = client
                  .from("shipments")
                  .upsert([basicShipmentData], { 
                    onConflict: 'awb_number',
                    ignoreDuplicates: false 
                  });
                await Promise.race([retryOperation, operationTimeout]);
                shipmentSuccess = true;
              } catch (retryError) {
                // Shipment retry failed - continue to next step
              }
            }
          } else {
            // Update existing shipment
            try {
              const updateOperation = client
                .from("shipments")
                .update({
                  current_status: status,
                  updated_at: timestamp,
                  courier_id: courierId,
                })
                .eq("awb_number", awb);

              await Promise.race([updateOperation, operationTimeout]);
              shipmentSuccess = true;
            } catch (updateError) {
              // Shipment update failed - continue to next step
            }
          }

          // Step 2: Insert history record (only if shipment operation succeeded)
          if (shipmentSuccess) {
            try {
              const historyOperation = client
                .from("shipment_history")
                .insert([{
                  awb_number: awb,
                  status,
                  location,
                  notes: `Bulk update - Out for Delivery by ${courierName}`,
                  created_at: timestamp,
                }]);

              await Promise.race([historyOperation, operationTimeout]);
              historySuccess = true;
            } catch (historyError) {
              
              // Retry history insert with different timestamp to avoid conflicts
              try {
                const retryTimestamp = new Date(Date.now() + index).toISOString();
                const retryHistoryOperation = client
                  .from("shipment_history")
                  .insert([{
                    awb_number: awb,
                    status,
                    location,
                    notes: `Bulk update - Out for Delivery by ${courierName}`,
                    created_at: retryTimestamp,
                  }]);

                await Promise.race([retryHistoryOperation, operationTimeout]);
                historySuccess = true;
              } catch (retryHistoryError) {
                // History retry failed - operation incomplete
              }
            }
          }

          // Only consider success if both operations succeeded
          if (shipmentSuccess && historySuccess) {
            return { awb, success: true, shipmentSuccess, historySuccess };
          } else {
            return { awb, success: false, shipmentSuccess, historySuccess, error: 'Incomplete operation' };
          }

        } catch (err: any) {
          // Log error but don't fail the entire batch
          return { awb, success: false, error: err.message };
        }
      })
    );

    // Count successful operations (both shipment and history must succeed)
    const successCount = results.filter(result => 
      result.status === 'fulfilled' && result.value.success
    ).length;

    // Track failed results for debugging (without console logging)
    const failedResults = results
      .filter((result): result is PromiseFulfilledResult<any> => 
        result.status === 'fulfilled' && !result.value.success
      );

    return successCount;
  }

  const handleSubmit = async () => {
    if (!currentUser || !currentUser.id) {
      setError("User not authenticated.")
      return
    }

    const awbList = awbNumbers
      .split(/\s*,\s*|\s+|\n/) // Split by comma, space, or newline
      .filter(Boolean) // Remove empty strings
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
      const successfulUpdatesCount = await processAwbsParallel(
        awbList,
        currentUser.id,
        currentUser.name || currentUser.email.split("@")[0],
      )

      toast.success("Bulk Update Complete", {
        description: `Successfully processed ${successfulUpdatesCount} shipments.`,
        duration: 5000,
      })
      onSuccess(successfulUpdatesCount)
      onClose()
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setProcessingStatus("Operation cancelled.")
        toast.info("Update Cancelled", { description: "Bulk update operation was cancelled." });
      } else {
        setError(err.message || "An unknown error occurred during bulk update.")
        toast.error("Bulk Update Failed", {
          description: err.message || "An unknown error occurred.",
          duration: 5000,
        });
      }
    } finally {
      setIsLoading(false)
      setAbortController(null)
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
                    } else {
                      setShowScanner(true)
                    }
                  }} 
                  className="w-full sm:w-auto border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800/50 text-sm sm:text-base py-2 sm:py-3 min-w-0 order-2 sm:order-1"
                >
                  <span className="truncate">{isLoading ? "Batal" : "Scan QR"}</span>
                </Button>
              </div>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
