"use client"

import React, { useState, useRef, useEffect, Suspense, useTransition, lazy } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMapPin, faSpinner, faUpload } from '@fortawesome/free-solid-svg-icons'
import {
  ChevronLeft,
  Close as CloseIcon,
  Camera as CameraIcon,
  CheckmarkFilled as CheckmarkIcon,
  Information as InfoIcon,
} from '@carbon/icons-react'
import { supabaseClient } from "@/lib/auth"
import type { ShipmentStatus } from "@/lib/db"
import type { ManifestCabangData, ManifestData } from "@/types"
import imageCompression from "browser-image-compression"
import browserBeep from "browser-beep"
import { toast } from "sonner"
import debounce from "lodash/debounce"

// Type definitions
interface ShipmentDetails {
  awb_number: string;
  receiver_name: string;
  receiver_address: string;
  receiver_phone: string;
  sender_name?: string;
  sender_phone?: string;
  weight?: number;
  current_status: string;
  from_manifest?: boolean;
  manifest_source?: "central" | "cabang" | "borneo_branch";
}

interface ShipmentCheckResult {
  exists: boolean;
  current_status?: string;
}

// Extended shipment details with manifest data
interface ExtendedShipmentDetails extends ShipmentDetails {
  sender_address?: string;
  dimensions?: string;
  service_type?: string;
}

interface DatabaseResponse<T> {
  data: T | null;
  error: Error | null;
}

// Lazy load komponen preview foto
const PhotoPreview = lazy(() => Promise.resolve({
  default: ({ src }: { src: string }) => (
    <img
      src={src || "/placeholder.svg"}
      alt="Preview"
      className="mx-auto photo-preview max-h-32 sm:max-h-48 rounded-lg shadow-md"
    />
  )
}));

function CourierUpdateFormComponent() {
  const searchParams = useSearchParams()
  const initialAwb = searchParams.get("awb") || ""
  const initialStatus = searchParams.get("status") || ""

  const [awbNumber, setAwbNumber] = useState(initialAwb)
  const [status, setStatus] = useState<ShipmentStatus | "">(initialStatus as ShipmentStatus || "")
  const [location, setLocation] = useState("")
  const [notes, setNotes] = useState("")
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shipmentDetails, setShipmentDetails] = useState<ExtendedShipmentDetails | null>(null)
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const beepTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [useHighCompression, setUseHighCompression] = useState(false)
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(0);
  const [showShipmentDetails, setShowShipmentDetails] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Simplified handlers
  const handleCameraCapture = () => cameraInputRef.current?.click()
  const handleGallerySelect = () => fileInputRef.current?.click()

  const resetForm = () => {
    setSuccess(false)
    setAwbNumber("")
    setStatus("")
    setLocation("")
    setNotes("")
    setPhoto(null)
    setPhotoPreview(null)
    setError(null)
    setShipmentDetails(null)
    setGpsCoords(null)
  }

  useEffect(() => {
    async function getCurrentUser() {
      const { data } = await supabaseClient.auth.getSession()
      if (data.session) {
        const { data: userData } = await supabaseClient
          .from("users")
          .select("*")
          .eq("id", data.session.user.id)
          .single()

        if (userData) {
          setCurrentUser(userData.name)
        } else {
          const username = data.session.user.email?.split("@")[0] || "courier"
          setCurrentUser(username)
        }
      }
    }
    getCurrentUser()
  }, [])

  const playBeep = () => {
    if (beepTimeoutRef.current) return
    
    const audioPath = status === 'delivered' ? '/sounds/scan_delivered.mp3' : '/sounds/scan_success.mp3'
    const audio = new Audio(audioPath)
    audio.volume = 1
    audio.play().catch(() => {}) // Silently handle errors
    
    beepTimeoutRef.current = setTimeout(() => {
      beepTimeoutRef.current = null
    }, 1000)
  }

  const fetchShipmentDetails = async (awb: string) => {
    try {
      // Add timeout for all database operations
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database timeout')), 8000)
      );

      // First check if the shipment already exists
      const shipmentPromise = supabaseClient
        .from("shipments")
        .select("*")
        .eq("awb_number", awb)
        .maybeSingle();

      const { data: shipmentData, error: shipmentError } = await Promise.race([
        shipmentPromise,
        timeoutPromise
      ]) as DatabaseResponse<ShipmentDetails>;

      if (!shipmentError && shipmentData) {
        setShipmentDetails(shipmentData)
        return
      }

      // If shipment doesn't exist, check if it exists in manifest (central)
      const manifestPromise = supabaseClient
        .from("manifest")
        .select("*")
        .eq("awb_no", awb)
        .maybeSingle();

      const { data: manifestData, error: manifestError } = await Promise.race([
        manifestPromise,
        timeoutPromise
      ]) as DatabaseResponse<ManifestData>;

      if (!manifestError && manifestData) {
        // If found in central manifest, show the data
        setShipmentDetails({
          awb_number: manifestData.awb_no,
          receiver_name: manifestData.nama_penerima,
          receiver_address: manifestData.alamat_penerima || '',
          receiver_phone: manifestData.nomor_penerima || '',
          sender_name: manifestData.nama_pengirim,
          sender_phone: manifestData.nomor_pengirim || '',
          weight: manifestData.berat_kg || 0,
          current_status: "in_transit",
          from_manifest: true,
          manifest_source: "central"
        })

        toast.info("Data ditemukan di manifest pusat", {
          description: "Data akan otomatis diisi dari manifest pusat",
          duration: 3000,
        })
        return
      }

      // If not found in central manifest, check manifest_cabang (branch)
      const manifestCabangPromise = supabaseClient
        .from("manifest_cabang")
        .select("*")
        .eq("awb_no", awb)
        .maybeSingle();

      const { data: manifestCabangData, error: manifestCabangError } = await Promise.race([
        manifestCabangPromise,
        timeoutPromise
      ]) as DatabaseResponse<ManifestCabangData>;

      if (!manifestCabangError && manifestCabangData) {
        // If found in branch manifest, show the data
        setShipmentDetails({
          awb_number: manifestCabangData.awb_no,
          receiver_name: manifestCabangData.nama_penerima,
          receiver_address: manifestCabangData.alamat_penerima || '',
          receiver_phone: manifestCabangData.nomor_penerima || '',
          sender_name: manifestCabangData.nama_pengirim,
          sender_phone: manifestCabangData.nomor_pengirim || '',
          weight: manifestCabangData.berat_kg || 0,
          current_status: "in_transit",
          from_manifest: true,
          manifest_source: "cabang"
        })

        toast.info("Data ditemukan di manifest cabang", {
          description: "Data akan otomatis diisi dari manifest cabang",
          duration: 3000,
        })
        return
      }

      // If not found in either manifest, check web cabang borneo for BE resi
      if (manifestError && manifestCabangError && awb.startsWith('BE')) {
        try {
          // Call branch API to get manifest data for BE resi
          const branchResponse = await fetch(`/api/manifest/search?awb_number=${awb}`);
          
          if (branchResponse.ok) {
            const branchData = await branchResponse.json();
            
            if (branchData.success && branchData.data) {
              const branchManifest = branchData.data;
              
              // SIMPLIFIED: Map Borneo web data to same fields as manifest_cabang  
              setShipmentDetails({
                awb_number: awb,
                receiver_name: branchManifest.penerima || '',
                receiver_address: branchManifest.alamat_penerima || '',
                receiver_phone: branchManifest.telepon_penerima || '',
                sender_name: branchManifest.pengirim || '',
                sender_phone: '', // Web Borneo doesn't provide sender phone
                weight: branchManifest.berat || 0,
                current_status: "in_transit",
                from_manifest: true,
                manifest_source: "borneo_branch"
              });

              toast.success("Data ditemukan di web cabang Borneo", {
                description: "Data penerima: " + (branchManifest.penerima || "N/A"),
                duration: 3000,
              });
              return;
            }
          }
        } catch (branchError) {
          console.error('Error fetching from branch:', branchError);
        }
        // Jika BE resi tidak ditemukan di web cabang, biarkan auto-generate tanpa toast
      }

      // If not found in any manifest (including branch), no toast - silent behavior
      // Data akan auto-generated tanpa notifikasi yang mengganggu
    } catch (err) {
      if (err instanceof Error) {
        toast.error("Gagal mengambil detail shipment", {
          description: err.message,
          duration: 3000,
        })
      }
    }
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setPhotoLoading(true);
      setPhotoProgress(0);
      const file = e.target.files[0]
      
      // Reset input value untuk memungkinkan select file yang sama
      e.target.value = ''
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error("File tidak valid", { description: "Hanya file gambar yang diperbolehkan." })
        setPhotoLoading(false);
        setPhotoProgress(0);
        return
      }
      
      if (file.size > 10 * 1024 * 1024) { // Increased to 10MB for high resolution photos
        toast.error("File terlalu besar", { description: "Ukuran file maksimal 10MB." })
        setPhotoLoading(false);
        setPhotoProgress(0);
        return
      }

      // Show loading toast dengan timeout yang lebih panjang untuk low-end
      const loadingToast = toast.loading("Memproses foto...", { duration: 15000 })

      // OPTIMIZED: Adaptive compression for low-end devices
      const getCompressionOptions = (fileSize: number) => {
        // Detect low-end device capabilities with safe type casting
        const navigatorExtended = navigator as Navigator & { deviceMemory?: number };
        const isLowEndDevice = navigator.hardwareConcurrency <= 2 || 
                              (navigatorExtended.deviceMemory && navigatorExtended.deviceMemory <= 2) ||
                              /Android [1-6]|iPhone [1-7]|iPad [1-6]/.test(navigator.userAgent);
        
        // OPTIMIZED: Manual toggle overrides auto-detection
        if (useHighCompression) {
          return {
            maxSizeMB: 0.1, // 100KB for manual high compression
            maxWidthOrHeight: 600, // Even smaller resolution
            useWebWorker: false,
            initialQuality: 0.5, // Lower quality
            alwaysKeepResolution: false,
            fileType: 'image/jpeg',
            onProgress: (p: number) => setPhotoProgress(Math.round(p))
          }
        }
        
        if (isLowEndDevice) {
          return {
            maxSizeMB: 0.15, // 150KB for auto-detected low-end
            maxWidthOrHeight: 800, // Smaller resolution
            useWebWorker: false,
            initialQuality: 0.6,
            alwaysKeepResolution: false,
            fileType: 'image/jpeg',
            onProgress: (p: number) => setPhotoProgress(Math.round(p))
          }
        }
        
        if (fileSize > 8 * 1024 * 1024) { // > 8MB - aggressive compression
          return {
            maxSizeMB: 0.8, // Reduced from 1.5MB
            maxWidthOrHeight: 1200, // Reduced from 1600
            useWebWorker: false,
            initialQuality: 0.65, // Reduced quality
            alwaysKeepResolution: false,
            fileType: 'image/jpeg',
            onProgress: (p: number) => setPhotoProgress(Math.round(p))
          }
        } else if (fileSize > 3 * 1024 * 1024) { // > 3MB (reduced from 2MB)
          return {
            maxSizeMB: 0.6, // Reduced from 1MB
            maxWidthOrHeight: 1400, // Reduced from 1920
            useWebWorker: false,
            initialQuality: 0.7, // Reduced quality
            alwaysKeepResolution: false,
            fileType: 'image/jpeg',
            onProgress: (p: number) => setPhotoProgress(Math.round(p))
          }
        } else {
          return {
            maxSizeMB: 0.4, // Reduced from 0.8MB
            maxWidthOrHeight: 1600, // Reduced from 2048
            useWebWorker: false,
            initialQuality: 0.75, // Reduced from 0.9
            alwaysKeepResolution: false,
            fileType: 'image/jpeg',
            onProgress: (p: number) => setPhotoProgress(Math.round(p))
          }
        }
      }

      let processedFile: File = file;
      try {
        const options = getCompressionOptions(file.size)
        // imageCompression supports onProgress callback (0-100)
        processedFile = await imageCompression(file, options)
        
        // Validate compressed file
        if (!processedFile || processedFile.size === 0) {
          throw new Error("Compression resulted in empty file")
        }
        
      } catch (compressionError) {
        // console.warn("Compression failed, trying with reduced options:", compressionError)
        
        // OPTIMIZED: Fallback compression for low-end devices
        try {
          const fallbackOptions = {
            maxSizeMB: useHighCompression ? 0.08 : 0.3, // Even smaller if toggle is on
            maxWidthOrHeight: useHighCompression ? 500 : 1000, // Smaller resolution if toggle is on
            useWebWorker: false,
            initialQuality: useHighCompression ? 0.4 : 0.5, // Lower quality if toggle is on
            fileType: 'image/jpeg', // Force JPEG
            onProgress: (p: number) => setPhotoProgress(Math.round(p))
          }
          processedFile = await imageCompression(file, fallbackOptions)
          
          if (!processedFile || processedFile.size === 0) {
            throw new Error("Fallback compression failed")
          }
          
        } catch (fallbackError) {
          // Last resort: Use original but show warning for large files
          processedFile = file
          if (file.size > 2 * 1024 * 1024) { // > 2MB
            toast.warning("Foto tidak dikompres", { 
              description: "Upload mungkin lambat pada koneksi lemah",
              duration: 3000
            })
          }
        }
      }
      
      // FileReader progress
      const processFile = (fileToProcess: File) => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          
          reader.onload = (event) => {
            if (event.target?.result) {
              setPhotoProgress(100)
              resolve(event.target.result as string)
            } else {
              reject(new Error("Failed to read file"))
            }
          }
          
          reader.onerror = () => {
            reject(new Error("FileReader error"))
          }
          reader.onprogress = (event) => {
            if (event.lengthComputable) {
              setPhotoProgress(80 + Math.round((event.loaded / event.total) * 20))
            }
          }
          
          // OPTIMIZED: Timeout yang lebih panjang untuk low-end devices
          setTimeout(() => {
            reject(new Error("FileReader timeout"))
          }, 15000) // Increased from 10s to 15s
          
          reader.readAsDataURL(fileToProcess)
        })
      }

      try {
        const previewUrl = await processFile(processedFile)
        setPhoto(processedFile)
        setPhotoPreview(previewUrl)
        toast.dismiss(loadingToast)
        toast.success("Foto berhasil dipilih", { 
          description: `File: ${processedFile.name} (${(processedFile.size / 1024).toFixed(1)}KB)`,
          duration: 2000
        })
        
      } catch (error) {
        // console.error("Photo processing error:", error)
        setPhoto(null)
        setPhotoPreview(null)
        toast.dismiss(loadingToast)
        toast.error("Gagal memproses foto", { 
          description: "Silakan coba lagi atau pilih foto lain",
          duration: 3000
        })
        
        // Reset states
        // setPhoto(null) // This is now handled by the finally block
        // setPhotoPreview(null) // This is now handled by the finally block
      } finally {
        setTimeout(() => { setPhotoLoading(false); setPhotoProgress(0); }, 500)
      }
    }
  }

  const removePhoto = () => {
    setPhoto(null)
    setPhotoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
    if (cameraInputRef.current) cameraInputRef.current.value = ""
    toast.info("Photo removed", { duration: 1500 })
  }

  const getCurrentLocation = () => {
    if (!navigator.geolocation) return
    
    setLocation("Getting location...")
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords
        setGpsCoords({ lat, lng })
        
        try {
          // Use Nominatim (OpenStreetMap) reverse geocoding - free service
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=id&addressdetails=1`,
            {
              headers: {
                'User-Agent': 'CourierApp/1.0'
              }
            }
          )
          
          if (response.ok) {
            const data = await response.json()
            if (data && data.address) {
              // Build a readable address from components
              const addr = data.address
              const parts = []
              
              // Add road/street if available
              if (addr.road) parts.push(addr.road)
              else if (addr.pedestrian) parts.push(addr.pedestrian)
              else if (addr.footway) parts.push(addr.footway)
              
              // Add area info
              if (addr.suburb) parts.push(addr.suburb)
              else if (addr.neighbourhood) parts.push(addr.neighbourhood)
              else if (addr.village) parts.push(addr.village)
              
              // Add city/town
              if (addr.city) parts.push(addr.city)
              else if (addr.town) parts.push(addr.town)
              else if (addr.county) parts.push(addr.county)
              
              const locationName = parts.join(', ')
              
              if (locationName) {
                setLocation(locationName)
                toast.success("Lokasi berhasil didapat", {
                  description: locationName,
                  duration: 3000
                })
                return
              }
            }
          }
        } catch (error) {
          console.log('Reverse geocoding failed:', error)
        }
        
        // Fallback: Show coordinates with a more user-friendly format
        setLocation(`GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`)
        toast.info("GPS koordinat berhasil didapat", {
          description: `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`,
          duration: 3000
        })
      },
      (error) => {
        setLocation("")
        toast.error("Gagal mendapatkan lokasi", {
          description: "Pastikan GPS aktif dan izin lokasi diberikan",
          duration: 3000
        })
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    )
  }
  
  useEffect(() => {
    if (initialAwb) {
      fetchShipmentDetails(initialAwb);
    }
  }, [initialAwb]);
  
  useEffect(() => {
    if (initialStatus === 'delivered') {
      setTimeout(() => {
        getCurrentLocation();
      }, 500);
    }
  }, [initialStatus]);


  const uploadImage = async (file: File, awbNumber: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split(".").pop()
      const fileName = `${awbNumber}-${Date.now()}.${fileExt}`
      const filePath = `proof-of-delivery/${fileName}`
      const arrayBuffer = await file.arrayBuffer()
      const buffer = new Uint8Array(arrayBuffer)

      // OPTIMIZED: Timeout yang disesuaikan untuk low-end devices dan koneksi lemah
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Upload timeout')), 30000) // Increased from 15s to 30s
      );

      const uploadPromise = supabaseClient.storage
        .from("shipment-photos")
        .upload(filePath, buffer, {
          contentType: file.type,
        });

      const { error } = await Promise.race([uploadPromise, timeoutPromise]) as DatabaseResponse<unknown>;

      if (error) {
        return null;
      }

      const { data } = supabaseClient.storage.from("shipment-photos").getPublicUrl(filePath)
      return data.publicUrl
    } catch (error) {
      return null
    }
  }

  const createShipmentFromManifest = async (awbNumber: string): Promise<boolean> => {
    try {
      // Add timeout for manifest operations
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Manifest timeout')), 8000)
      );

      // First try to create from central manifest
      const centralManifestPromise = supabaseClient
        .from("manifest")
        .select("*")
        .eq("awb_no", awbNumber)
        .maybeSingle();

      const { data: manifestData, error: manifestError } = await Promise.race([
        centralManifestPromise,
        timeoutPromise
      ]) as DatabaseResponse<ManifestData>;

      if (!manifestError && manifestData) {
        // Create shipment from central manifest with upsert for safety
        const insertPromise = supabaseClient.from("shipments").upsert([
          {
            awb_number: awbNumber,
            sender_name: manifestData.nama_pengirim || "Auto Generated",
            sender_address: manifestData.alamat_penerima || "Auto Generated", // Use alamat_penerima as sender address fallback
            sender_phone: manifestData.nomor_pengirim || "Auto Generated",
            receiver_name: manifestData.nama_penerima || "Auto Generated",
            receiver_address: manifestData.alamat_penerima || "Auto Generated",
            receiver_phone: manifestData.nomor_penerima || "Auto Generated",
            weight: manifestData.berat_kg || 1,
            dimensions: "10x10x10", // Default dimensions since not in manifest
            service_type: "Standard",
            current_status: status as string,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ], { 
          onConflict: 'awb_number',
          ignoreDuplicates: false 
        });

        const { error: insertError } = await Promise.race([insertPromise, timeoutPromise]) as DatabaseResponse<unknown>;

        if (!insertError) {
          toast.success("Shipment dibuat dari manifest pusat")
          return true
        }
      }

      // If not found in central manifest, try branch manifest
      const branchManifestPromise = supabaseClient
        .from("manifest_cabang")
        .select("*")
        .eq("awb_no", awbNumber)
        .maybeSingle();

      const { data: manifestCabangData, error: manifestCabangError } = await Promise.race([
        branchManifestPromise,
        timeoutPromise
      ]) as DatabaseResponse<ManifestCabangData>;

      if (!manifestCabangError && manifestCabangData) {
        // Create shipment from branch manifest with upsert for safety
        const insertPromise = supabaseClient.from("shipments").upsert([
          {
            awb_number: awbNumber,
            sender_name: manifestCabangData.nama_pengirim || "Auto Generated",
            sender_address: manifestCabangData.alamat_penerima || "Auto Generated", // Use alamat_penerima as sender address fallback
            sender_phone: manifestCabangData.nomor_pengirim || "Auto Generated", 
            receiver_name: manifestCabangData.nama_penerima || "Auto Generated",
            receiver_address: manifestCabangData.alamat_penerima || "Auto Generated",
            receiver_phone: manifestCabangData.nomor_penerima || "Auto Generated",
            weight: manifestCabangData.berat_kg || 1,
            dimensions: "10x10x10", // Default dimensions since not in manifest 
            service_type: "Standard",
            current_status: status as string,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ], { 
          onConflict: 'awb_number',
          ignoreDuplicates: false 
        });

        const { error: insertError } = await Promise.race([insertPromise, timeoutPromise]) as DatabaseResponse<unknown>;

        if (!insertError) {
          toast.success("Shipment dibuat dari manifest cabang")
          return true
        }
      }

      // If not found in either local manifest, try web cabang Borneo for BE resi  
      if (manifestError && manifestCabangError && awbNumber.startsWith('BE')) {
        try {
          // Call branch API to get manifest data for BE resi
          const branchResponse = await fetch(`/api/manifest/search?awb_number=${awbNumber}`);
          
          if (branchResponse.ok) {
            const branchData = await branchResponse.json();
            
            if (branchData.success && branchData.data) {
              const branchManifest = branchData.data;
              
              // Create shipment from Borneo web cabang data - SIMPLIFIED like manifest_cabang
              const insertPromise = supabaseClient.from("shipments").upsert([
                {
                  awb_number: awbNumber,
                  sender_name: branchManifest.pengirim || "Auto Generated",
                  sender_address: branchManifest.alamat_penerima || "Auto Generated", // Use alamat_penerima as fallback
                  sender_phone: "Auto Generated", // Web Borneo doesn't have sender phone
                  receiver_name: branchManifest.penerima || "Auto Generated",
                  receiver_address: branchManifest.alamat_penerima || "Auto Generated", 
                  receiver_phone: branchManifest.telepon_penerima || "Auto Generated",
                  weight: branchManifest.berat || 1,
                  dimensions: "10x10x10", // Default dimensions
                  service_type: branchManifest.jenis_layanan || "Standard",
                  current_status: status as string,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
              ], { 
                onConflict: 'awb_number',
                ignoreDuplicates: false 
              });

              const { error: insertError } = await Promise.race([insertPromise, timeoutPromise]) as DatabaseResponse<unknown>;

              if (!insertError) {
                toast.success("Shipment dibuat dari web cabang Borneo")
                return true
              }
            }
          }
        } catch (branchError) {
          console.error('Error fetching from Borneo branch:', branchError);
        }
      }

      // If not found in any manifest, fallback to basic shipment
      return await createBasicShipment(awbNumber)
    } catch (error) {
      return await createBasicShipment(awbNumber)
    }
  }

  const createBasicShipment = async (awbNumber: string): Promise<boolean> => {
    try {
      // Add timeout for basic shipment creation
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Create timeout')), 10000)
      );

      // If shipmentDetails exists and has from_manifest flag, use that data
      if (shipmentDetails && shipmentDetails.from_manifest) {
        const insertPromise = supabaseClient.from("shipments").upsert([
          {
            awb_number: awbNumber,
            sender_name: shipmentDetails.sender_name || "Auto Generated",
            sender_address: shipmentDetails.sender_address || "Auto Generated",
            sender_phone: shipmentDetails.sender_phone || "Auto Generated",
            receiver_name: shipmentDetails.receiver_name || "Auto Generated",
            receiver_address: shipmentDetails.receiver_address || "Auto Generated",
            receiver_phone: shipmentDetails.receiver_phone || "Auto Generated",
            weight: shipmentDetails.weight || 1,
            dimensions: shipmentDetails.dimensions || "10x10x10",
            service_type: shipmentDetails.service_type || "Standard",
            current_status: status as string,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ], { 
          onConflict: 'awb_number',
          ignoreDuplicates: false 
        });

        const { error } = await Promise.race([insertPromise, timeoutPromise]) as DatabaseResponse<unknown>;

        return !error
      } else {
        // Fallback to basic data if no manifest data found
        const insertPromise = supabaseClient.from("shipments").upsert([
          {
            awb_number: awbNumber,
            sender_name: "Auto Generated",
            sender_address: "Auto Generated", 
            sender_phone: "Auto Generated",
            receiver_name: "Auto Generated",
            receiver_address: "Auto Generated",
            receiver_phone: "Auto Generated",
            weight: 1,
            dimensions: "10x10x10",
            service_type: "Standard",
            current_status: status as string,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ], { 
          onConflict: 'awb_number',
          ignoreDuplicates: false 
        });
        
        const { error } = await Promise.race([insertPromise, timeoutPromise]) as DatabaseResponse<unknown>;
        return !error
      }
    } catch (error) {
      return false
    }
  }

  const checkShipmentExists = async (awbNumber: string): Promise<ShipmentCheckResult> => {
    try {
      const { data, error } = await supabaseClient
        .from("shipments")
        .select("awb_number, current_status")
        .eq("awb_number", awbNumber)
        .maybeSingle()

      if (error) {
        return { exists: false }
      }
      if (data) {
        return { exists: true, current_status: data.current_status }
      }
      return { exists: false }
    } catch (error) {
      return { exists: false }
    }
  }

  const addShipmentHistory = async (
    awbNumber: string,
    status: string,
    location: string,
    notes: string | null,
    photoUrl: string | null,
    latitude: number | null,
    longitude: number | null,
  ): Promise<boolean> => {
    try {
      const historyNotes = currentUser ? `Updated by ${currentUser}. ${notes || ""}` : notes || ""
      
      const insertPromise = supabaseClient.from("shipment_history").insert([
        {
          awb_number: awbNumber,
          status,
          location,
          notes: historyNotes.trim(),
          photo_url: photoUrl,
          latitude,
          longitude,
          created_at: new Date().toISOString(),
        },
      ])

      // Add timeout for history creation
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('History timeout')), 10000)
      );
      
      const { error } = await Promise.race([insertPromise, timeoutPromise]) as DatabaseResponse<unknown>;
      return !error
    } catch (error) {
      return false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Basic validation
    if (!awbNumber || !status || !location) {
      setError("AWB number, status, and location are required")
      return
    }

    if (status === "delivered" && !location) {
      setError("Location is required for 'Delivered' status.")
      return
    }

    setIsLoading(true)

    // Operation timeout for the whole process
    const operationTimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Operation timeout')), 25000)
    );

    try {
      await Promise.race([
        (async () => {
          let imageUrl: string | null = null
          if (photo) {
            imageUrl = await uploadImage(photo, awbNumber)
            if (!imageUrl) {
              setError("Gagal mengupload gambar. Silakan coba lagi.")
              setIsLoading(false)
              return
            }
          }

          const shipmentCheck = await checkShipmentExists(awbNumber)
          if (shipmentCheck.exists && shipmentCheck.current_status === 'delivered') {
            toast.error("RESI INI SUDAH DELIVERY.", {
              description: "MOHON CEK KEMBALI RESI YG AKAN DI UPDATE.\nJIKA SUDAH BENAR. HARAP HUB AMOS",
              duration: 6000
            });
            setIsLoading(false)
            return
          }
          if (!shipmentCheck.exists) {
            const created = await createShipmentFromManifest(awbNumber)
            if (!created) {
              setError("Gagal membuat shipment baru. Silakan coba lagi.")
              setIsLoading(false)
              return
            }
          }

          const historyAdded = await addShipmentHistory(
            awbNumber,
            status,
            location,
            notes,
            imageUrl,
            gpsCoords?.lat || null,
            gpsCoords?.lng || null,
          )

          if (!historyAdded) {
            // Cek status terakhir di shipment_history
            try {
              const { data: lastHistory, error: lastHistoryError } = await supabaseClient
                .from("shipment_history")
                .select("status, notes, created_at")
                .eq("awb_number", awbNumber)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
              if (!lastHistoryError && lastHistory && lastHistory.status === 'delivered') {
                // Ambil nama kurir dari notes jika ada
                let kurir = '';
                if (lastHistory.notes) {
                  const byMatch = lastHistory.notes.match(/by\s+([\w.@]+)/i);
                  if (byMatch && byMatch[1]) {
                    kurir = byMatch[1];
                  }
                }
                setError(`Resi ${awbNumber} sudah di-delivered oleh kurir${kurir ? ' ' + kurir : ''}. Tidak bisa update status lagi.`)
              } else {
                setError("Gagal menambahkan riwayat shipment. Silakan coba lagi.")
              }
            } catch (e) {
              setError("Gagal menambahkan riwayat shipment. Silakan coba lagi.")
            }
            setIsLoading(false)
            return
          }

          const { error: updateError } = await supabaseClient
            .from("shipments")
            .update({ current_status: status, updated_at: new Date().toISOString() })
            .eq("awb_number", awbNumber)

          if (updateError) {
            setError("Gagal mengupdate status shipment. Silakan coba lagi.")
            setIsLoading(false)
            return
          }

          setSuccess(true)
          playBeep()

          // Trigger /api/sync jika resi BE dan status delivered
          if (
            awbNumber.startsWith('BE') &&
            status === 'delivered'
          ) {
            // Fire and forget, tidak perlu tunggu response
            fetch(`/api/sync?awb_number=${encodeURIComponent(awbNumber)}`)
              .catch(() => {/* silent error */});
          }
        })(),
        operationTimeout
      ]);

    } catch (error) {
      if (error instanceof Error && error.message === 'Operation timeout') {
        setError("Operasi timeout. Periksa koneksi internet dan coba lagi.")
      } else {
        setError("Terjadi kesalahan. Silakan coba lagi.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-100 to-white dark:from-green-900 dark:to-gray-900 flex justify-center items-center p-4">
        <Card className="max-w-sm mx-auto bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-green-200 dark:border-green-700">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckmarkIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Success!</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Shipment <span className="font-mono font-medium">{awbNumber}</span> updated to{" "}
              <span className="font-medium text-green-600">{status.replace(/_/g, " ")}</span>
            </p>
            <div className="space-y-3">
              <Button
                onClick={resetForm}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11"
              >
                Update Another
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/courier/dashboard")}
                className="w-full h-11"
              >
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-white dark:from-black dark:to-gray-900 p-2 md:p-4">
      <Card className="max-w-md mx-auto bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
        <CardContent className="p-4">
          {/* Header - Compact */}
          <div className="flex items-center justify-between mb-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => router.push("/courier/dashboard")}
              className="flex items-center gap-1 text-gray-600 hover:text-gray-900 p-1"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="text-sm">Back</span>
            </Button>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Update Status</h1>
            {shipmentDetails && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowShipmentDetails(!showShipmentDetails)}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 p-1"
              >
                <InfoIcon className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Shipment Details - Collapsible */}
          {shipmentDetails && showShipmentDetails && (
            <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-700">
              <div className="space-y-1 text-xs">
                <p><span className="text-blue-600 dark:text-blue-400 font-medium">To:</span> {shipmentDetails.receiver_name}</p>
                <p><span className="text-blue-600 dark:text-blue-400 font-medium">Phone:</span> {shipmentDetails.receiver_phone || "Auto Generated"}</p>
                <p><span className="text-blue-600 dark:text-blue-400 font-medium">Address:</span> {shipmentDetails.receiver_address}</p>
                <p><span className="text-blue-600 dark:text-blue-400 font-medium">Status:</span> {shipmentDetails.current_status?.replace(/_/g, " ") || "out for delivery"}</p>
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* AWB Number */}
            <div>
              <Label htmlFor="courier-awb" className="text-sm font-medium mb-2 block">AWB Number</Label>
              <AwbInput awbNumber={awbNumber} setAwbNumber={setAwbNumber} fetchShipmentDetails={fetchShipmentDetails} />
            </div>

            {/* Status & Location - Grid for mobile */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="shipment-status" className="text-sm font-medium mb-2 block">Status</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as ShipmentStatus)} disabled={initialStatus === 'delivered'}>
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="out_for_delivery">Out For Delivery</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="location" className="text-sm font-medium mb-2 block">Location</Label>
                <div className="flex gap-1">
                  <Input
                    id="location"
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Enter location"
                    className="h-10 text-sm"
                    required
                  />
                  <Button
                    type="button"
                    onClick={getCurrentLocation}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-2 h-10 shrink-0"
                  >
                    <FontAwesomeIcon icon={faMapPin} className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Photo Upload - Mobile optimized */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Photo Proof (Optional)</Label>
              
              {!photoPreview ? (
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4">
                  <div className="text-center mb-3">
                    <CameraIcon className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">Upload delivery proof</p>
                  </div>
                  
                  {/* Hidden inputs */}
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                  
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <Button
                      type="button"
                      onClick={handleCameraCapture}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white h-10 text-sm"
                      disabled={photoLoading}
                    >
                      <CameraIcon className="h-3 w-3 mr-1" />
                      Camera
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGallerySelect}
                      className="w-full h-10 text-sm"
                      disabled={photoLoading}
                    >
                      <FontAwesomeIcon icon={faUpload} className="h-3 w-3 mr-1" />
                      Gallery
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-center text-xs text-red-600">
                    <input 
                      type="checkbox" 
                      checked={useHighCompression} 
                      onChange={(e) => setUseHighCompression(e.target.checked)} 
                      className="mr-2" 
                    />
                    <span>High compression</span>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <Suspense fallback={<div className="h-32 bg-gray-200 rounded-lg animate-pulse"></div>}>
                    <PhotoPreview src={photoPreview} />
                  </Suspense>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={removePhoto}
                    className="absolute top-2 right-2 bg-red-100 hover:bg-red-200 text-red-700 w-6 h-6 p-0 rounded-full"
                  >
                    <CloseIcon className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {photoLoading && (
                <div className="mt-3 text-center">
                  <p className="text-xs text-gray-600 mb-2">Processing... {photoProgress}%</p>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${photoProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {gpsCoords && (
                <p className="mt-2 text-xs text-gray-500">
                  GPS: {gpsCoords.lat.toFixed(4)}, {gpsCoords.lng.toFixed(4)}
                </p>
              )}
            </div>

            {/* Notes - Compact */}
            <div>
              <Label htmlFor="notes" className="text-sm font-medium mb-2 block">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                rows={2}
                className="text-sm resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                Logged by: {currentUser || "admin"}
              </p>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold h-12 rounded-lg"
            >
              {isLoading ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin className="h-4 w-4 mr-2" />
                  Updating...
                </>
              ) : (
                "Update Status"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

// Component for AWB Input with debounced search
const AwbInput = ({ awbNumber, setAwbNumber, fetchShipmentDetails }: {
  awbNumber: string;
  setAwbNumber: (value: string) => void;
  fetchShipmentDetails: (awb: string) => void;
}) => {
  const debouncedFetch = debounce((awb: string) => {
    if (awb.length >= 8) { // Minimum AWB length
      fetchShipmentDetails(awb);
    }
  }, 500);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setAwbNumber(value);
    debouncedFetch(value);
  };

  return (
    <Input
      id="courier-awb"
      type="text"
      value={awbNumber}
      onChange={handleChange}
      placeholder="Enter AWB number"
      className="h-10 text-sm font-mono tracking-wide"
      required
      autoComplete="off"
      autoCapitalize="characters"
    />
  );
};

export default function CourierUpdateForm() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <CourierUpdateFormComponent />
    </Suspense>
  )
}