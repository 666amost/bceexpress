"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { supabaseClient } from "../lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { FaCheckCircle, FaTimes, FaSpinner, FaQrcode } from "react-icons/fa"
import { useToast } from "@/components/ui/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Html5Qrcode, Html5QrcodeResult } from "html5-qrcode"

interface QuickQRScannerProps {
  userRole: string | null
  branchOrigin: string | null
  onClose: () => void
}

interface BookingData {
  id: string
  awb_no: string
  awb_date: string
  nama_pengirim: string
  nama_penerima: string
  kota_tujuan: string
  kecamatan: string
  coli: number
  berat_kg: number
  total: number
  status: string
  agent_id: string
  agent_name?: string
  agent_email?: string
  alamat_penerima: string
  nomor_pengirim: string
  nomor_penerima: string
  isi_barang: string
  origin_branch: string
  // Additional fields that might be present
  kirim_via?: string
  wilayah?: string
  metode_pembayaran?: string
  harga_per_kg?: number
  sub_total?: number
  biaya_admin?: number
  biaya_packaging?: number
  biaya_transit?: number
  catatan?: string
  buktimembayar?: boolean
  potongan?: number
  status_pelunasan?: string
}

export default function QuickQRScanner({ userRole, branchOrigin, onClose }: QuickQRScannerProps) {
  const [scannedBooking, setScannedBooking] = useState<BookingData | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showScanner, setShowScanner] = useState(true)
  const [isScanning, setIsScanning] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const lastScannedRef = useRef<string>("")
  const { toast } = useToast()

  const validateAwb = useCallback((awb: string): boolean => {
    const cleanAwb = awb.trim().toUpperCase()
    return cleanAwb.startsWith('BCE') && cleanAwb.endsWith('AGT')
  }, [])

  const playScanSound = useCallback((status: 'success' | 'error') => {
    const soundFile = status === 'success' ? '/sounds/scan_success.mp3' : '/sounds/scan_error.mp3';
    const audio = new Audio(soundFile);
    audio.volume = 0.7; // Slightly higher volume for better feedback
    audio.play().catch(() => {
      // Silently handle audio play errors
    });
  }, [])

  const handleQRScan = useCallback((result: string) => {
    if (result && !isLoading) {
      const cleanAwb = result.trim().toUpperCase();
      
      if (!validateAwb(cleanAwb)) {
        toast({
          title: "Format AWB Tidak Valid",
          description: "QR Code harus berformat AWB booking (BCE...AGT)",
          variant: "destructive"
        });
        playScanSound('error');
        return;
      }

      // Immediate processing without delay for faster response - inline to avoid circular dependency
      setIsLoading(true)
      setShowScanner(false)
      
      ;(async () => {
        try {
          let query = supabaseClient
            .from('manifest_booking')
            .select('*')
            .eq('awb_no', cleanAwb)
            .eq('status', 'pending')

          // Filter by branch origin for cabang users
          if (userRole === 'cabang' && branchOrigin) {
            query = query.eq('origin_branch', branchOrigin)
          }

          const { data, error } = await query

          if (error) {
            toast({
              title: "Error",
              description: "Gagal mencari booking: " + error.message,
              variant: "destructive"
            })
            setShowScanner(true)
            return
          }

          if (data && data.length > 0) {
            // Get agent details
            const agentDetails = data[0].agent_id ? await getAgentDetails(data[0].agent_id) : { name: 'Unknown', email: 'Unknown' }
            
            const booking = {
              ...data[0],
              agent_name: agentDetails.name,
              agent_email: agentDetails.email
            }
            
            setScannedBooking(booking)
            playScanSound('success')
            setShowScanner(false)
          } else {
            toast({
              title: "Booking Tidak Ditemukan",
              description: `AWB ${cleanAwb} tidak ditemukan atau sudah diverifikasi`,
              variant: "destructive"
            })
            playScanSound('error')
            setShowScanner(true)
          }
        } catch (err) {
          toast({
            title: "Error",
            description: "Terjadi kesalahan saat mencari booking",
            variant: "destructive"
          })
          playScanSound('error')
          setShowScanner(true)
        } finally {
          setIsLoading(false)
        }
      })()
    }
  }, [isLoading, toast, validateAwb, playScanSound, userRole, branchOrigin]);

  const startScanning = useCallback(async () => {
    try {
      const devices = await Html5Qrcode.getCameras()
      if (devices.length === 0) {
        throw new Error("No cameras found")
      }

      // Try to find back camera first, then fallback to any available camera
      let deviceId = devices[0].id // Default to first camera
      const backCamera = devices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear') ||
        device.label.toLowerCase().includes('environment')
      )
      if (backCamera) {
        deviceId = backCamera.id
      }

      scannerRef.current = new Html5Qrcode("qr-reader")
      
      // Try with optimized settings first
      try {
        await scannerRef.current.start(
          deviceId,
          {
            fps: 30,
            qrbox: { width: 320, height: 250 },
            aspectRatio: 1.28,
            videoConstraints: {
              facingMode: "environment"
            }
          },
          async (decodedText: string, result: Html5QrcodeResult) => {
            if (decodedText === lastScannedRef.current) {
              return
            }
            
            lastScannedRef.current = decodedText
            handleQRScan(decodedText)
            
            setTimeout(() => {
              lastScannedRef.current = ""
            }, 500)
          },
          (errorMessage: string) => {
            // Silently ignore scan errors
          }
        )
      } catch (firstAttemptError) {
        console.warn("First attempt failed, trying with basic settings:", firstAttemptError)
        
        // Fallback to basic settings if advanced settings fail
        await scannerRef.current.start(
          deviceId,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 }
          },
          async (decodedText: string, result: Html5QrcodeResult) => {
            if (decodedText === lastScannedRef.current) {
              return
            }
            
            lastScannedRef.current = decodedText
            handleQRScan(decodedText)
            
            setTimeout(() => {
              lastScannedRef.current = ""
            }, 500)
          },
          (errorMessage: string) => {
            // Silently ignore scan errors
          }
        )
      }
      
      setIsScanning(true)

      // Try to enable torch (optional)
      try {
        const capabilities = scannerRef.current.getRunningTrackCameraCapabilities();
        const torchFeature = capabilities?.torchFeature?.();
        if (torchFeature) {
          await torchFeature.apply(true);
        }
      } catch (err) {
        // Torch not available, ignore
      }

    } catch (err) {
      console.error("Failed to start camera:", err)
      toast({
        title: "Camera Error",
        description: "Gagal memulai kamera. Pastikan tidak ada aplikasi lain yang menggunakan kamera dan izin kamera sudah diberikan.",
        variant: "destructive"
      })
    }
  }, [handleQRScan, toast])

  const stopScanning = useCallback(async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop()
        scannerRef.current.clear()
        scannerRef.current = null
        setIsScanning(false)
      } catch (err) {
        // Silently handle stop errors
      }
    }
  }, [isScanning])

  const handleQRScannerError = (error: string) => {
    console.warn("QR Scanner Error:", error);
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  useEffect(() => {
    if (showScanner && !scannedBooking) {
      // Start scanning when scanner should be shown
      const timer = setTimeout(() => {
        startScanning()
      }, 300) // Small delay to ensure DOM is ready

      return () => {
        clearTimeout(timer)
        stopScanning()
      }
    } else {
      // Stop scanning when hiding scanner or when booking found
      stopScanning()
    }
  }, [showScanner, scannedBooking, startScanning, stopScanning])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanning()
    }
  }, [stopScanning])

  const getAgentDetails = async (agentId: string) => {
    try {
      const { data: userData, error } = await supabaseClient
        .from('users')
        .select('name, email')
        .eq('id', agentId)
        .single()
      
      if (error || !userData) {
        return { name: 'Unknown Agent', email: 'unknown@email.com' }
      }
      
      return userData
    } catch (err) {
      return { name: 'Unknown Agent', email: 'unknown@email.com' }
    }
  }

  const handleVerify = async () => {
    if (!scannedBooking) return

    setIsVerifying(true)
    try {
      // Update status to verified
      const { error: updateError } = await supabaseClient
        .from('manifest_booking')
        .update({ 
          status: 'verified',
          verified_time: new Date().toISOString()
        })
        .eq('id', scannedBooking.id)

      if (updateError) throw updateError

      // Insert into manifest_cabang with all required fields
      const manifestData = {
        awb_no: scannedBooking.awb_no,
        awb_date: scannedBooking.awb_date,
        kirim_via: scannedBooking.kirim_via || 'darat', // Default to 'darat' if not specified
        kota_tujuan: scannedBooking.kota_tujuan,
        wilayah: scannedBooking.wilayah || scannedBooking.kecamatan || '', // Use kecamatan as wilayah fallback
        metode_pembayaran: scannedBooking.metode_pembayaran || 'COD', // Default to COD
        agent_customer: scannedBooking.agent_email || scannedBooking.agent_name || 'Unknown',
        nama_pengirim: scannedBooking.nama_pengirim,
        nomor_pengirim: scannedBooking.nomor_pengirim,
        nama_penerima: scannedBooking.nama_penerima,
        nomor_penerima: scannedBooking.nomor_penerima,
        alamat_penerima: scannedBooking.alamat_penerima,
        coli: scannedBooking.coli,
        berat_kg: scannedBooking.berat_kg,
        harga_per_kg: scannedBooking.harga_per_kg || 0,
        sub_total: scannedBooking.sub_total || scannedBooking.total || 0,
        biaya_admin: scannedBooking.biaya_admin || 0,
        biaya_packaging: scannedBooking.biaya_packaging || 0,
        biaya_transit: scannedBooking.biaya_transit || 0,
        total: scannedBooking.total,
        isi_barang: scannedBooking.isi_barang,
        catatan: scannedBooking.catatan || '',
        buktimembayar: scannedBooking.buktimembayar || false,
        potongan: scannedBooking.potongan || 0,
        status_pelunasan: scannedBooking.status_pelunasan || 'belum_lunas',
        origin_branch: scannedBooking.origin_branch || branchOrigin || 'unknown'
      }

      const { error: insertError } = await supabaseClient
        .from('manifest_cabang')
        .insert([manifestData])

      if (insertError) {
        console.error('Insert error details:', insertError)
        throw insertError
      }

      toast({
        title: "Booking Berhasil Diverifikasi",
        description: `AWB ${scannedBooking.awb_no} telah diverifikasi dan ditransfer ke manifest`,
        variant: "default"
      })

      playScanSound('success') // Add success sound for verification
      onClose()
    } catch (error) {
      console.error('Error verifying booking:', error)
      toast({
        title: "Error",
        description: "Gagal memverifikasi booking: " + (error instanceof Error ? error.message : 'Unknown error'),
        variant: "destructive"
      })
      playScanSound('error') // Add error sound for verification failure
    } finally {
      setIsVerifying(false)
    }
  }

  const handleCancel = () => {
    setScannedBooking(null)
    setShowScanner(true) // This will trigger useEffect to restart scanning
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <FaQrcode className="h-5 w-5 text-blue-600" />
            Scan QR AWB Booking
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 pt-4">
          {!scannedBooking ? (
            // Scanner View
            <div className="space-y-4">
              {showScanner ? (
                <>
                  <div className="text-center text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Arahkan kamera ke QR Code AWB booking
                  </div>
                  
                  {/* QR Scanner Container */}
                  <div className="relative border rounded-lg overflow-hidden">
                    <div id="qr-reader" className="w-full min-h-[320px] rounded-lg overflow-hidden"></div>
                    
                    {/* Scanning indicator */}
                    {isScanning && (
                      <div className="absolute bottom-2 left-2 right-2">
                        <div className="bg-black/50 text-white text-sm px-3 py-2 rounded-lg text-center">
                          🔍 Scanning... Arahkan ke QR Code atau Barcode
                        </div>
                      </div>
                    )}
                    
                    {isLoading && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                        <div className="text-white text-center">
                          <FaSpinner className="h-8 w-8 animate-spin mx-auto mb-2" />
                          <div className="text-sm">Mencari booking...</div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="border rounded-lg p-8 text-center min-h-[300px] flex flex-col items-center justify-center">
                  <FaQrcode className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500 mb-4">Scanner dijeda</p>
                  <Button onClick={() => setShowScanner(true)} variant="outline">
                    Lanjutkan Scan
                  </Button>
                </div>
              )}
            </div>
          ) : (
            // Booking Detail View
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4 space-y-3">
                  {/* AWB Info */}
                  <div className="text-center pb-3 border-b">
                    <h3 className="text-lg font-bold text-blue-600">
                      {scannedBooking.awb_no}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {new Date(scannedBooking.awb_date).toLocaleDateString('id-ID')}
                    </p>
                  </div>

                  {/* Agent Info */}
                  <div className="space-y-1">
                    <div className="text-xs text-gray-500 uppercase font-medium">Agent</div>
                    <div className="text-sm font-medium">
                      {scannedBooking.agent_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {scannedBooking.agent_email}
                    </div>
                  </div>

                  {/* Sender & Receiver */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="text-xs text-gray-500 uppercase font-medium">Pengirim</div>
                      <div className="text-sm font-medium">
                        {scannedBooking.nama_pengirim}
                      </div>
                      <div className="text-xs text-gray-500">
                        {scannedBooking.nomor_pengirim}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-gray-500 uppercase font-medium">Penerima</div>
                      <div className="text-sm font-medium">
                        {scannedBooking.nama_penerima}
                      </div>
                      <div className="text-xs text-gray-500">
                        {scannedBooking.nomor_penerima}
                      </div>
                    </div>
                  </div>

                  {/* Destination */}
                  <div className="space-y-1">
                    <div className="text-xs text-gray-500 uppercase font-medium">Tujuan</div>
                    <div className="text-sm font-medium">
                      {scannedBooking.kota_tujuan}
                    </div>
                    <div className="text-xs text-gray-500">
                      {scannedBooking.kecamatan}
                    </div>
                  </div>

                  {/* Package Details */}
                  <div className="flex justify-between items-center pt-2 border-t">
                    <div className="text-center">
                      <div className="text-xs text-gray-500 uppercase font-medium">Coli</div>
                      <div className="text-sm font-bold">
                        {scannedBooking.coli}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500 uppercase font-medium">Berat</div>
                      <div className="text-sm font-bold">
                        {scannedBooking.berat_kg} kg
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500 uppercase font-medium">Total</div>
                      <div className="text-sm font-bold text-blue-600">
                        Rp {scannedBooking.total.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Package Content */}
                  <div className="space-y-1">
                    <div className="text-xs text-gray-500 uppercase font-medium">Isi Barang</div>
                    <div className="text-sm">
                      {scannedBooking.isi_barang}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  className="flex-1 h-11"
                  disabled={isVerifying}
                >
                  Scan Lagi
                </Button>
                <Button
                  onClick={handleVerify}
                  className="flex-1 h-11 bg-green-600 hover:bg-green-700 text-white"
                  disabled={isVerifying}
                >
                  {isVerifying ? (
                    <>
                      <FaSpinner className="h-4 w-4 animate-spin mr-2" />
                      Verifikasi...
                    </>
                  ) : (
                    <>
                      <FaCheckCircle className="h-4 w-4 mr-2" />
                      Verifikasi
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
