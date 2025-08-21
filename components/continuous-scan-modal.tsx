"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
// ScrollArea removed - unused import
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes, faCamera } from '@fortawesome/free-solid-svg-icons'
import { supabaseClient } from "@/lib/auth"
import { QRScanner } from "./qr-scanner"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

// Type guard removed - unused function
interface ContinuousScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  prefillStatus?: string;
}

interface ScannedItem {
  awb: string;
  status: 'success' | 'error' | 'duplicate';
  message: string;
  timestamp: Date;
}

export function ContinuousScanModal({ isOpen, onClose, onSuccess, prefillStatus }: ContinuousScanModalProps) {
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; name: string; role: string } | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const processedAwbsRef = useRef<string[]>([]);
  const { toast } = useToast();
  const router = useRouter();

  const playScanSound = (status: 'success' | 'error' | 'duplicate') => {
    const audio = new Audio(status === 'success' ? '/sounds/scan_success.mp3' : '/sounds/scan_error.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {});
  };

  useEffect(() => {
    async function getCurrentUser() {
      const { data } = await supabaseClient.auth.getSession();
      if (data.session) {
        const { data: userData } = await supabaseClient
          .from("users")
          .select("*")
          .eq("id", data.session.user.id)
          .single();

        if (userData) {
          setCurrentUser(userData);
        } else {
          const username = data.session.user.email?.split("@")[0] || "courier";
          setCurrentUser({
            id: data.session.user.id || "",
            name: username,
            email: data.session.user.email || "",
            role: "courier",
          });
        }
      }
    }
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (isOpen) {
      setScannedItems([]);
      setShowScanner(true);
    } else {
      setShowScanner(false);
    }
  }, [isOpen]);

  const validateAwb = (awb: string): boolean => {
    const cleanAwb = awb.trim().toUpperCase();
    // Only allow AWB that starts with BE or BCE (no length/format check)
    // Example: BE..., BCE...
    return cleanAwb.startsWith("BE") || cleanAwb.startsWith("BCE");
  };

  const checkManifestAwb = async (awb: string) => {
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
      return null;
    }
  };

  const createShipmentWithManifestData = async (awb: string, manifestData: Record<string, unknown>, courierId: string) => {
    try {
      const shipmentData = {
        awb_number: awb,
        sender_name: "Auto Generated",
        sender_address: "Auto Generated",
        sender_phone: "Auto Generated",
        receiver_name: manifestData.nama_penerima || "Auto Generated",
        receiver_address: manifestData.alamat_penerima || "Auto Generated",
        receiver_phone: manifestData.nomor_penerima || "Auto Generated",
        weight: 1,
        dimensions: "10x10x10",
        service_type: "Standard",
        current_status: "out_for_delivery",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        courier_id: courierId,
      };
      await supabaseClient.from("shipments").insert([shipmentData]);
      const source = manifestData.manifest_source === "central" ? "manifest pusat" : "manifest cabang";
      return { success: true, message: `Created from ${source}` };
    } catch (err) {
      return { success: false, message: `Error: ${err}` };
    }
  };

  const createBasicShipment = async (awb: string, courierId: string) => {
    try {
      await supabaseClient.from("shipments").insert([
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
      return { success: true, message: "Created with auto-generated data" };
    } catch (err) {
      return { success: false, message: `Error: ${err}` };
    }
  };

  const updateExistingShipment = async (awb: string, courierId: string) => {
    try {
      await supabaseClient
        .from("shipments")
        .update({
          current_status: "out_for_delivery",
          updated_at: new Date().toISOString(),
          courier_id: courierId,
        })
        .eq("awb_number", awb);
      return { success: true, message: "Updated existing shipment" };
    } catch (err) {
      return { success: false, message: `Error: ${err}` };
    }
  };

  const addShipmentHistory = async (awb: string, courierName: string) => {
    try {
      await supabaseClient.from("shipment_history").insert([
        {
          awb_number: awb,
          status: "out_for_delivery",
          location: "Sorting Center",
          notes: `Continuous scan - Out for Delivery by ${courierName}`,
          created_at: new Date().toISOString(),
        },
      ]);
      return { success: true };
    } catch (err) {
      return { success: false };
    }
  };

  const processAwb = async (awb: string) => {
    setIsProcessing(true);
    let status: ScannedItem['status'] = 'error';
    let message: string = 'Processing failed';
    try {
      if (!validateAwb(awb)) {
        status = 'error';
        message = 'Invalid AWB format (must start with BCE or BE)';
      } else if (processedAwbsRef.current.includes(awb)) {
        status = 'duplicate';
        message = 'Already scanned in this session';
      } else {
        const { data: session } = await supabaseClient.auth.getSession();
        const courierId = session?.session?.user?.id;
        const courierName = currentUser?.name || session?.session?.user?.email?.split("@")[0] || "courier";
        if (!courierId) {
          status = 'error';
          message = 'No courier session found';
        } else {
          const { data: existingShipment } = await supabaseClient
            .from("shipments")
            .select("awb_number, current_status")
            .eq("awb_number", awb)
            .single();
          if (existingShipment && existingShipment.current_status && existingShipment.current_status.toLowerCase() === 'delivered') {
            status = 'error';
            message = 'RESI INI SUDAH DELIVERY. MOHON CEK KEMBALI RESI YG AKAN DI UPDATE. JIKA SUDAH BENAR. HARAP HUB AMOS';
            toast({
              title: "RESI SUDAH DELIVERED",
              description: "MOHON CEK KEMBALI RESI YG AKAN DI UPDATE.\nJIKA SUDAH BENAR. HARAP HUB AMOS",
              variant: "destructive",
            });
          } else {
            let result;
            if (!existingShipment) {
              const manifestData = await checkManifestAwb(awb);
              if (manifestData) {
                if (manifestData.nama_penerima && manifestData.alamat_penerima) {
                  result = await createShipmentWithManifestData(awb, manifestData, courierId);
                  if (!result.success) {
                    result = await createBasicShipment(awb, courierId);
                  }
                } else {
                  result = await createBasicShipment(awb, courierId);
                }
              } else {
                result = await createBasicShipment(awb, courierId);
              }
            } else {
              result = await updateExistingShipment(awb, courierId);
            }
            if (result.success) {
              await addShipmentHistory(awb, courierName);
              processedAwbsRef.current.push(awb);
              status = 'success';
              message = result.message;
              toast({
                title: "AWB Processed",
                description: `${awb} successfully added to today's assignments`,
              });
              if (prefillStatus === 'delivered') {
                onClose();
                router.push(`/courier/update?awb=${awb}&status=delivered`);
                return;
              }
            } else {
              status = 'error';
              message = result.message;
            }
          }
        }
      }
    } catch (error) {
      status = 'error';
      message = 'Processing error occurred';
    }
    const updatedItem: ScannedItem = {
      awb,
      status: status,
      message: message,
      timestamp: new Date(),
    };
    setScannedItems(prev => {
      const existingItemIndex = prev.findIndex(item => item.awb === awb);
      if (existingItemIndex > -1) {
        const newState = [...prev];
        newState[existingItemIndex] = updatedItem;
        return newState;
      } else {
        return [updatedItem, ...prev];
      }
    });
    playScanSound(status);
    setIsProcessing(false);
  };

  const handleQRScan = (result: string) => {
    if (!isProcessing) {
      const cleanAwb = result.trim().toUpperCase();
      setTimeout(() => {
        processAwb(cleanAwb);
      }, 300);
    }
  };

  // Helper: detect native scanner availability in a type-safe way
  const isNativeScannerAvailable = (): boolean => {
    try {
      return typeof window !== 'undefined' && !!window.AndroidNativeScanner && typeof window.AndroidNativeScanner.scan === 'function';
    } catch (err) {
      return false;
    }
  };

  const handleStartCamera = async () => {
    if (isNativeScannerAvailable()) {
      // Setup native callback that delegates to existing handler
      window.onScanResult = (awb: string) => {
        try {
          // reuse existing handler for dedupe/processing
          handleQRScan(awb);
        } catch (err) {
          // swallow errors; user-visible feedback via toast where appropriate
        }
      };

      try {
        // Enable continuous mode if supported
        window.AndroidNativeScanner?.setContinuous?.(true);
        window.AndroidNativeScanner?.scan();
        setShowScanner(true);
      } catch (err) {
        toast({ title: 'Gagal memulai native scanner', description: 'Silakan coba mode web', variant: 'destructive' });
        // fallback to web scanner
        setShowScanner(true);
      }
    } else {
      // Web fallback
      setShowScanner(true);
    }
  };

  const handleStopCamera = () => {
    if (isNativeScannerAvailable()) {
      try {
        window.AndroidNativeScanner?.stop();
      } catch (err) {
        // swallow
      }
      // cleanup callback
      try {
        window.onScanResult = undefined;
      } catch (err) {
        // swallow
      }
    }
    setShowScanner(false);
  };

  const handleClose = () => {
    // Ensure native scanner is stopped and callback cleared
    if (isNativeScannerAvailable()) {
      try {
        window.AndroidNativeScanner?.stop();
      } catch (err) {
        // swallow
      }
      try {
        window.onScanResult = undefined;
      } catch (err) {
        // swallow
      }
    } else {
      setShowScanner(false);
    }
    onClose();
    if (scannedItems.some(item => item.status === 'success')) {
      onSuccess();
    }
  };

  const successCount = scannedItems.filter(item => item.status === 'success').length;
  const errorCount = scannedItems.filter(item => item.status === 'error').length;
  const duplicateCount = scannedItems.filter(item => item.status === 'duplicate').length;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
  <DialogContent showCloseButton={false} className="w-[95vw] max-w-md mx-auto p-0 border-0">
  <DialogTitle className="sr-only">Continuous AWB Scanner</DialogTitle>
        <Card className="h-[90vh] flex flex-col overflow-hidden bg-gray-50 border border-gray-200 shadow-lg">
            <CardHeader className="bg-white border-b border-gray-200">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">Continuous AWB Scanner</CardTitle>
                <Button variant="ghost" size="sm" onClick={handleClose} className="h-8 w-8 p-0">
                  <FontAwesomeIcon icon={faTimes} className="h-4 w-4" />
                </Button>
              </div>
              <DialogDescription className="text-gray-600">
                Scan otomatis resi, hentikan kamera sebelum menutup.
              </DialogDescription>
            </CardHeader>
            <CardContent className="flex-1 p-4 flex flex-col bg-white">
              {/* Camera */}
      <div className="relative w-full aspect-square sm:aspect-square bg-black rounded-lg overflow-hidden mb-4 border border-gray-300 flex-shrink-0">
                {showScanner ? (
                  isNativeScannerAvailable() ? (
                    // Native scanner overlay (visual only). Actual scanning handled by APK.
                    <div className="flex flex-col items-center justify-center h-full text-white bg-black bg-opacity-50">
                      <div className="border-2 border-white rounded-lg w-3/4 h-3/4 relative">
                        <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-white" />
                        <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-white" />
                        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-white" />
                        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-white" />
                      </div>
                      <p className="mt-4 text-sm">🚀 Native Scanner Active</p>
                      <p className="text-xs opacity-75">CameraX + ZXing</p>
                    </div>
                  ) : (
                    <QRScanner
                      onScan={handleQRScan}
                      onClose={handleStopCamera}
                      hideCloseButton
                      disableAutoUpdate
                      squarePercent={0.9}
                    />
                  )
                ) : (
                  <div className="flex items-center justify-center h-full">
                      <Button onClick={handleStartCamera} size="lg">
                        <FontAwesomeIcon icon={faCamera} className="mr-2 h-4 w-4" />
                        Start Camera
                      </Button>
                  </div>
                )}
                {showScanner && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute bottom-3 left-1/2 transform -translate-x-1/2 z-10"
                    onClick={handleStopCamera}
                  >
                    Stop
                  </Button>
                )}
              </div>
              {/* Stats */}
              <div className="flex gap-2 mb-4 px-2">
                {/* Success */}
                  <div className="flex-1 flex flex-col items-center border border-gray-200 rounded-lg p-2">
                  <span className="text-3xl sm:text-4xl font-extrabold text-green-600">{successCount}</span>
                  <span className="mt-1 text-xs sm:text-sm uppercase text-gray-700">Success</span>
                  <div className="w-6 sm:w-8 h-1 bg-green-600 rounded mt-1"></div>
                </div>
                {/* Error */}
                  <div className="flex-1 flex flex-col items-center border border-gray-200 rounded-lg p-2">
                  <span className="text-3xl sm:text-4xl font-extrabold text-red-600">{errorCount}</span>
                  <span className="mt-1 text-xs sm:text-sm uppercase text-gray-700">Error</span>
                  <div className="w-6 sm:w-8 h-1 bg-red-600 rounded mt-1"></div>
                </div>
                {/* Duplicate */}
                  <div className="flex-1 flex flex-col items-center border border-gray-200 rounded-lg p-2">
                  <span className="text-3xl sm:text-4xl font-extrabold text-yellow-600">{duplicateCount}</span>
                  <span className="mt-1 text-xs sm:text-sm uppercase text-gray-700">Duplicate</span>
                  <div className="w-6 sm:w-8 h-1 bg-yellow-600 rounded mt-1"></div>
                </div>
              </div>
              {/* Results */}
              <div className="flex-1 overflow-auto bg-gray-50 rounded-lg border border-gray-200 p-3">
                {scannedItems.length === 0 ? (
                  <div className="text-center text-muted-foreground mt-8">No items scanned yet</div>
                ) : (
                  <div className="space-y-2">
                    {scannedItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-white rounded-md border border-gray-100 shadow-sm"
                      >
                        <div className="font-mono text-sm truncate">{item.awb}</div>
                        <Badge
                          className="capitalize"
                          variant={
                            item.status === 'success'
                              ? 'default'
                              : item.status === 'error'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {item.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </DialogContent>
    </Dialog>
  );
}
