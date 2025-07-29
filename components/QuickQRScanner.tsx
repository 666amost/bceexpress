"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { supabaseClient } from "../lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { FaCheckCircle, FaTimes, FaSpinner, FaQrcode } from "react-icons/fa"
import { useToast } from "@/components/ui/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
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
  const [isLoading, setIsLoading] = useState(false)
  const [showScanner, setShowScanner] = useState(true)
  const [isScanning, setIsScanning] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const lastScannedRef = useRef<string>("")
  const lastScanTimeRef = useRef<number>(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const isStoppingRef = useRef<boolean>(false)
  const { toast } = useToast()

  const validateAwb = useCallback((awb: string): boolean => {
    const cleanAwb = awb.trim().toUpperCase()
    // AWB harus dimulai dengan BCE dan minimal 6 karakter (BCE + kode agent)
    return cleanAwb.startsWith('BCE') && cleanAwb.length >= 6
  }, [])

  const playScanSound = useCallback((status: 'success' | 'error') => {
    // Stop any currently playing audio first
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }

    const soundFile = status === 'success' ? '/sounds/scan_success.mp3' : '/sounds/scan_error.mp3'
    audioRef.current = new Audio(soundFile)
    audioRef.current.volume = 0.7
    audioRef.current.play().catch(() => {
      // Silently handle audio play errors
    })
  }, [])

  // Direct verification function - no intermediate booking view
  const verifyBookingDirectly = useCallback(async (awbNo: string): Promise<void> => {
    try {
      setIsLoading(true)
      
      // First get booking data
      let query = supabaseClient
        .from('manifest_booking')
        .select('*')
        .eq('awb_no', awbNo)
        .eq('status', 'pending')

      // Filter by branch origin for cabang users
      if (userRole === 'cabang' && branchOrigin) {
        query = query.eq('origin_branch', branchOrigin)
      }

      const { data, error } = await query

      if (error) {
        playScanSound('error')
        toast({
          title: "Database Error",
          description: "Gagal mengakses database: " + error.message,
          variant: "destructive"
        })
        return
      }

      if (!data || data.length === 0) {
        playScanSound('error')
        toast({
          title: "Booking Tidak Ditemukan",
          description: `AWB ${awbNo} tidak ditemukan atau sudah diverifikasi`,
          variant: "destructive"
        })
        return
      }

      const booking = data[0] as BookingData

      // Validate required fields before proceeding
      if (!booking.awb_no || !booking.awb_date || !booking.kota_tujuan || !booking.nama_pengirim || !booking.nama_penerima) {
        playScanSound('error')
        toast({
          title: "Data Tidak Lengkap",
          description: "Booking ditemukan tetapi data tidak lengkap. Harap lengkapi data melalui verifikasi manual.",
          variant: "destructive"
        })
        return
      }

      // Get agent details separately if agent_id exists
      let agentDetails: { name: string; email: string } = { name: 'Unknown Agent', email: 'unknown@email.com' }
      if (booking.agent_id) {
        const { data: userData, error: userError } = await supabaseClient
          .from('users')
          .select('name, email')
          .eq('id', booking.agent_id)
          .single()
        
        if (userData && !userError) {
          agentDetails = userData
        }
      }

      // Calculate totals
      const subTotal: number = booking.sub_total || booking.total || 0
      const total: number = booking.total || 0

      // Update booking status to verified
      const { error: updateError } = await supabaseClient
        .from('manifest_booking')
        .update({ 
          status: 'verified',
          verified_time: new Date().toISOString()
        })
        .eq('id', booking.id)

      if (updateError) {
        playScanSound('error')
        toast({
          title: "Error",
          description: "Gagal mengupdate status booking: " + updateError.message,
          variant: "destructive"
        })
        return
      }

      // Get current user's origin_branch to ensure RLS compliance
      const { data: currentUser, error: currentUserError } = await supabaseClient
        .from('users')
        .select('origin_branch, role')
        .eq('id', (await supabaseClient.auth.getUser()).data.user?.id)
        .single()

      if (currentUserError) {
        console.error('Error getting current user:', currentUserError)
      }

      // Use current user's origin_branch if available, otherwise use branchOrigin prop
      const finalOriginBranch: string = currentUser?.origin_branch || branchOrigin || booking.origin_branch || 'unknown'

      // Check if AWB already exists in manifest_cabang to prevent duplicates
      const { data: existingManifest, error: checkError } = await supabaseClient
        .from('manifest_cabang')
        .select('awb_no')
        .eq('awb_no', booking.awb_no)
        .limit(1)

      if (checkError) {
        playScanSound('error')
        toast({
          title: "Error",
          description: "Gagal memeriksa data existing: " + checkError.message,
          variant: "destructive"
        })
        
        // Rollback booking status
        await supabaseClient
          .from('manifest_booking')
          .update({ status: 'pending' })
          .eq('id', booking.id)
        
        return
      }

      if (existingManifest && existingManifest.length > 0) {
        playScanSound('error')
        toast({
          title: "AWB Sudah Ada",
          description: `AWB ${booking.awb_no} sudah ada di manifest cabang`,
          variant: "destructive"
        })
        
        // Rollback booking status
        await supabaseClient
          .from('manifest_booking')
          .update({ status: 'pending' })
          .eq('id', booking.id)
        
        return
      }

      // Insert into manifest_cabang with all required fields
      const manifestData = {
        awb_no: booking.awb_no,
        awb_date: booking.awb_date,
        kirim_via: booking.kirim_via || 'darat',
        kota_tujuan: booking.kota_tujuan,
        wilayah: booking.wilayah || booking.kecamatan || '',
        metode_pembayaran: booking.metode_pembayaran || 'COD',
        agent_customer: agentDetails.email || agentDetails.name || 'Unknown',
        nama_pengirim: booking.nama_pengirim,
        nomor_pengirim: booking.nomor_pengirim || '',
        nama_penerima: booking.nama_penerima,
        nomor_penerima: booking.nomor_penerima || '',
        alamat_penerima: booking.alamat_penerima || '',
        coli: booking.coli || 1,
        berat_kg: booking.berat_kg || 1,
        harga_per_kg: booking.harga_per_kg || 0,
        sub_total: subTotal,
        biaya_admin: booking.biaya_admin || 0,
        biaya_packaging: booking.biaya_packaging || 0,
        biaya_transit: booking.biaya_transit || 0,
        total: total,
        isi_barang: booking.isi_barang || '',
        catatan: booking.catatan || `Auto-verified from QR scan on ${new Date().toISOString()}`,
        buktimembayar: booking.buktimembayar || false,
        potongan: booking.potongan || 0,
        status_pelunasan: booking.status_pelunasan || 'outstanding',
        origin_branch: finalOriginBranch
      }

      const { data: insertResult, error: insertError } = await supabaseClient
        .from('manifest_cabang')
        .insert([manifestData])
        .select()

      if (insertError) {
        playScanSound('error')
        toast({
          title: "Error",
          description: "Gagal memasukkan ke manifest: " + insertError.message,
          variant: "destructive"
        })
        
        // Rollback booking status update
        const { error: rollbackError } = await supabaseClient
          .from('manifest_booking')
          .update({ status: 'pending' })
          .eq('id', booking.id)
        
        if (rollbackError) {
          console.error('Rollback error:', rollbackError)
        }
        
        return
      }

      playScanSound('success')
      toast({
        title: "✅ Verifikasi Berhasil",
        description: `AWB ${awbNo} telah diverifikasi dan ditransfer ke manifest`,
        variant: "default"
      })

      // Reset scanner to continue scanning instead of closing
      setTimeout(() => {
        lastScannedRef.current = ""
        lastScanTimeRef.current = 0
        isStoppingRef.current = false
        setShowScanner(true)
      }, 2000)

    } catch (error) {
      playScanSound('error')
      toast({
        title: "Error",
        description: "Terjadi kesalahan: " + (error instanceof Error ? error.message : 'Unknown error'),
        variant: "destructive"
      })
    } finally {
      isStoppingRef.current = false
      setIsLoading(false)
    }
  }, [userRole, branchOrigin, playScanSound, toast])

  const handleQRScan = useCallback((result: string): void => {
    const now = Date.now()
    const timeSinceLastScan = now - lastScanTimeRef.current
    
    if (result && !isLoading && !isStoppingRef.current) {
      const cleanAwb = result.trim().toUpperCase()
      
      // Prevent duplicate scans within 5 seconds AND same AWB
      if (cleanAwb === lastScannedRef.current && timeSinceLastScan < 5000) {
        return
      }
      
      lastScannedRef.current = cleanAwb
      lastScanTimeRef.current = now
      
      if (!validateAwb(cleanAwb)) {
        playScanSound('error')
        toast({
          title: "Format AWB Tidak Valid",
          description: "QR Code harus berformat AWB booking (BCE + kode agent)",
          variant: "destructive"
        })
        
        // Reset after validation failure
        setTimeout(() => {
          lastScannedRef.current = ""
        }, 3000)
        return
      }

      // Call verification function immediately
      verifyBookingDirectly(cleanAwb)
    }
  }, [isLoading, validateAwb, playScanSound, toast, verifyBookingDirectly])

  const startScanning = useCallback(async (): Promise<void> => {
    // Reset stopping flag at start
    isStoppingRef.current = false
    
    try {
      const devices = await Html5Qrcode.getCameras()
      if (devices.length === 0) {
        throw new Error("Tidak ada kamera yang tersedia")
      }

      // Try to find back camera first
      let deviceId: string = devices[0].id
      const backCamera = devices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear') ||
        device.label.toLowerCase().includes('environment')
      )
      if (backCamera) {
        deviceId = backCamera.id
      }

      scannerRef.current = new Html5Qrcode("qr-reader")
      
      await scannerRef.current.start(
        deviceId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText: string, result: Html5QrcodeResult) => {
          handleQRScan(decodedText)
        },
        (errorMessage: string) => {
          // Silently ignore scan errors
        }
      )
      
      setIsScanning(true)
      isStoppingRef.current = false

    } catch (err: unknown) {
      isStoppingRef.current = false
      toast({
        title: "Camera Error",
        description: "Gagal memulai kamera. Pastikan tidak ada aplikasi lain yang menggunakan kamera dan izin kamera sudah diberikan.",
        variant: "destructive"
      })
    }
  }, [handleQRScan, toast])

  const stopScanning = useCallback(async (): Promise<void> => {
    // Prevent multiple stop attempts
    if (isStoppingRef.current || !scannerRef.current || !isScanning) {
      return
    }

    try {
      isStoppingRef.current = true
      
      await scannerRef.current.stop()
      scannerRef.current.clear()
      scannerRef.current = null
      setIsScanning(false)
      
    } catch (err: unknown) {
      // Only log significant errors, ignore transition errors
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (!errorMessage.includes('transition') && !errorMessage.includes('already')) {
        console.error("Error stopping scanner:", err)
      }
    } finally {
      // Always reset the stopping flag
      setTimeout(() => {
        isStoppingRef.current = false
      }, 100)
    }
  }, [isScanning])

  // Proper cleanup with camera stop
  const handleClose = useCallback((): void => {
    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    
    // Stop scanner first, then close
    stopScanning().finally(() => {
      onClose()
    })
  }, [stopScanning, onClose])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [handleClose])

  useEffect(() => {
    if (showScanner && !isLoading) {
      // Start scanning when scanner should be shown
      const timer = setTimeout(() => {
        startScanning()
      }, 300) // Small delay to ensure DOM is ready

      return () => {
        clearTimeout(timer)
      }
    } else {
      // Stop scanning when hiding scanner or when loading
      if (isScanning) {
        stopScanning()
      }
    }
  }, [showScanner, isLoading, startScanning, stopScanning, isScanning])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up scanner
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {
          // Silently handle any stop errors during cleanup
        }).finally(() => {
          if (scannerRef.current) {
            try {
              scannerRef.current.clear()
            } catch {
              // Silently handle clear errors
            }
            scannerRef.current = null
          }
          isStoppingRef.current = false
        })
      } else {
        isStoppingRef.current = false
      }
      
      // Clean up audio
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  return (
    <Dialog open={true} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <FaQrcode className="h-5 w-5 text-blue-600" />
            Quick AWB Verification
          </DialogTitle>
          <DialogDescription>
            Arahkan kamera ke QR Code AWB booking untuk verifikasi otomatis
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 pt-4">
          <div className="space-y-4">
            {showScanner ? (
              <>
                <div className="text-center text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Arahkan kamera ke QR Code AWB booking untuk verifikasi langsung
                </div>
                
                {/* QR Scanner Container */}
                <div className="relative border rounded-lg overflow-hidden">
                  <div id="qr-reader" className="w-full min-h-[320px] rounded-lg overflow-hidden"></div>
                  
                  {/* Scanning indicator */}
                  {isScanning && !isLoading && (
                    <div className="absolute bottom-2 left-2 right-2">
                      <div className="bg-black/50 text-white text-sm px-3 py-2 rounded-lg text-center flex items-center justify-center gap-2">
                        {/* Minimalist search icon */}
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="2"/>
                          <path d="M15 15L19 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        Scanning... Arahkan ke QR Code AWB
                      </div>
                    </div>
                  )}
                  
                  {isLoading && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                      <div className="text-white text-center">
                        <FaSpinner className="h-8 w-8 animate-spin mx-auto mb-2" />
                        <div className="text-sm">Memverifikasi booking...</div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="border rounded-lg p-8 text-center min-h-[300px] flex flex-col items-center justify-center">
                <FaQrcode className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 mb-4">Scanner dijeda</p>
                <Button 
                  onClick={() => setShowScanner(true)} 
                  variant="outline"
                  disabled={isLoading}
                >
                  Lanjutkan Scan
                </Button>
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="flex justify-center mt-4">
            <Button
              onClick={handleClose}
              variant="outline"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <FaSpinner className="h-4 w-4 animate-spin mr-2" />
                  Memproses...
                </>
              ) : (
                <>
                  <FaTimes className="h-4 w-4 mr-2" />
                  Tutup
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
