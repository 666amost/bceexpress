
"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { X } from "lucide-react"
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCamera } from '@fortawesome/free-solid-svg-icons'
import { supabaseClient } from "@/lib/auth"
import { QRScanner } from "./qr-scanner"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

// Type guard for BranchManifestData (Borneo manifest)
function isBranchManifestData(data: unknown): data is import("@/types").BranchManifestData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'pengirim' in data &&
    'penerima' in data &&
    typeof (data as { pengirim?: unknown }).pengirim === 'object' &&
    typeof (data as { penerima?: unknown }).penerima === 'object'
  );
}

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
      // Only check the exact AWB, do not generate variants
      const { data: branchData, error: branchError } = await supabaseClient
        .from("manifest_cabang")
        .select("nama_penerima,alamat_penerima,nomor_penerima")
        .ilike("awb_no", cleanAwb)
        .maybeSingle();
      if (!branchError && branchData) {
        return { ...branchData, manifest_source: "cabang" };
      }
      const { data: centralData, error: centralError } = await supabaseClient
        .from("manifest")
        .select("nama_penerima,alamat_penerima,nomor_penerima")
        .ilike("awb_no", cleanAwb)
        .maybeSingle();
      if (!centralError && centralData) {
        return { ...centralData, manifest_source: "central" };
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
        const existingItemIndex = scannedItems.findIndex(item => item.awb === awb);
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

  const handleClose = () => {
    setShowScanner(false);
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FontAwesomeIcon icon={faCamera} className="h-5 w-5" />
            {prefillStatus === 'delivered' ? 'Delivered AWB Scanner' : 'Continuous AWB Scanner'}
          </DialogTitle>
          <DialogDescription>
            {prefillStatus === 'delivered'
              ? 'Scan resi untuk langsung update status ke Delivered. Resi akan diarahkan ke form update dengan status Delivered yang sudah terisi.'
              : 'Scan Resi Otomatis. Resi akan diproses dan ditambahkan ke daftar hari ini. ( jangan lupa STOP CAMERA untuk menghentikan proses)'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-4">
            {showScanner && (
              <div className="border rounded-lg overflow-hidden">
                <QRScanner
                  onScan={handleQRScan}
                  onClose={() => setShowScanner(false)}
                  hideCloseButton={true}
                  disableAutoUpdate={true}
                />
              </div>
            )}
            {!showScanner && (
              <div className="border rounded-lg p-8 text-center">
                <FontAwesomeIcon icon={faCamera} className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">Scanner is paused</p>
                <Button onClick={() => setShowScanner(true)}>
                  Resume Scanning
                </Button>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-green-200 dark:bg-green-900 p-2 rounded">
                <div className="text-lg font-bold text-green-800 dark:text-green-400">{successCount}</div>
                <div className="text-xs text-green-800 dark:text-green-400">Success</div>
              </div>
              <div className="bg-red-200 dark:bg-red-900 p-2 rounded">
                <div className="text-lg font-bold text-red-800 dark:text-red-400">{errorCount}</div>
                <div className="text-xs text-red-800 dark:text-red-400">Error</div>
              </div>
              <div className="bg-yellow-200 dark:bg-yellow-900 p-2 rounded">
                <div className="text-lg font-bold text-yellow-800 dark:text-yellow-400">{duplicateCount}</div>
                <div className="text-xs text-yellow-800 dark:text-yellow-400">Duplicate</div>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Scan Results</h3>
              <Button variant="outline" size="sm" onClick={handleClose}>
                <X className="h-4 w-4 mr-1" />
                Close
              </Button>
            </div>
            <ScrollArea className="h-[400px] border rounded-lg p-2">
              {scannedItems.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No items scanned yet
                </div>
              ) : (
                <div className="space-y-2">
                  {scannedItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 border rounded text-sm">
                      {item.status === 'success' && (
                        <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">
                          ✓
                        </div>
                      )}
                      {item.status === 'error' && (
                        <div className="h-4 w-4 rounded-full bg-red-500 flex items-center justify-center text-white text-xs">
                          !
                        </div>
                      )}
                      {item.status === 'duplicate' && (
                        <div className="h-4 w-4 rounded-full bg-yellow-500 flex items-center justify-center text-white text-xs">
                          !
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="font-mono font-medium">{item.awb}</div>
                        <div className="text-xs text-muted-foreground">{item.message}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                      <Badge
                        variant={item.status === 'success' ? 'default' :
                                item.status === 'error' ? 'destructive' : 'secondary'}
                      >
                        {item.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
        {isProcessing && (
          <div className="text-center text-sm text-blue-600 dark:text-blue-400">
            Processing AWB...
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
