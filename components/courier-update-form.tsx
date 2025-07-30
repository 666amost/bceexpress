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
      className="mx-auto photo-preview max-h-48 sm:max-h-60 rounded-lg shadow-md"
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

  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

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
    if (!beepTimeoutRef.current) {
      let audioPath = '/sounds/scan_success.mp3';
      if (status === 'delivered') {
        audioPath = '/sounds/scan_delivered.mp3';
      }
      const audio = new Audio(audioPath);
      audio.volume = 1;
      audio.play()
        .catch(() => {
          // Silently handle audio play errors
        });

      beepTimeoutRef.current = setTimeout(() => {
        beepTimeoutRef.current = null
      }, 1000)
    }
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
    
    // Reset both input values
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
    const cameraInput = document.getElementById('delivery-photo-camera') as HTMLInputElement
    if (cameraInput) {
      cameraInput.value = ""
    }
    
    toast.info("Foto dihapus", { duration: 1500 })
  }

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      setLocation("Getting location...")
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude
          const lng = position.coords.longitude
          setGpsCoords({ lat, lng })
          setLocation("Current GPS Location")
        },
        () => {
          setLocation("")
          // Silently handle geolocation errors
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
      )
    } else {
      // Geolocation not supported - silently handle
    }
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
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-white dark:from-black dark:to-gray-900 flex justify-center items-center p-4 sm:p-6">
        <Card className="w-full max-w-sm md:max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                <CheckmarkIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Status Updated Successfully!</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm">
                Shipment <span className="font-semibold">{awbNumber}</span> has been updated to <span className="font-semibold text-green-600">{status.replace(/_/g, " ")}</span>
              </p>
              <div className="flex flex-col space-y-3 justify-center">
                <Button 
                  onClick={() => router.push(`/track/${awbNumber}`)} 
                  className="font-bold bg-blue-600 hover:bg-blue-700 text-white h-11 px-6"
                >
                  View Tracking
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => router.push("/courier/dashboard")} 
                  className="border-gray-300 text-gray-700 hover:bg-gray-100 h-11 px-6"
                >
                  Back to Dashboard
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-white dark:from-black dark:to-gray-900 flex justify-center items-start p-2 sm:p-4 md:p-6">
      <Card className="w-full max-w-lg md:max-w-2xl bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
        <CardContent className="p-4 sm:p-6">
          <div className="mb-4 sm:mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => router.push("/courier/dashboard")}
                className="flex items-center gap-1 text-gray-600 hover:text-gray-900 p-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="text-sm">Back</span>
              </Button>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Update Shipment Status</h1>
            </div>
          </div>
        {shipmentDetails && (
          <div className="mb-4 bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
            <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">Shipment Details</h3>
            <div className="space-y-1 text-sm">
              <p><span className="text-gray-500 dark:text-gray-400">Receiver:</span> <span className="font-medium text-gray-900 dark:text-white">{shipmentDetails.receiver_name}</span></p>
              <p><span className="text-gray-500 dark:text-gray-400">Phone:</span> <span className="font-medium text-gray-900 dark:text-white">{shipmentDetails.receiver_phone || "Auto Generated"}</span></p>
              <p><span className="text-gray-500 dark:text-gray-400">Address:</span> <span className="font-medium text-gray-900 dark:text-white">{shipmentDetails.receiver_address}</span></p>
              <p><span className="text-gray-500 dark:text-gray-400">Current Status:</span> <span className="font-medium text-blue-600 dark:text-blue-400">{shipmentDetails.current_status?.replace(/_/g, " ") || "out for delivery"}</span></p>
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
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
            <Label htmlFor="courier-awb" className="text-gray-700 dark:text-gray-300 font-medium text-sm">AWB Number</Label>
            <div className="mt-2">
              <AwbInput awbNumber={awbNumber} setAwbNumber={setAwbNumber} fetchShipmentDetails={fetchShipmentDetails} />
            </div>
          </div>

          {/* Status */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
            <Label htmlFor="shipment-status" className="text-gray-700 dark:text-gray-300 font-medium text-sm">Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as ShipmentStatus)} disabled={initialStatus === 'delivered'}>
              <SelectTrigger className="mt-2 h-12 text-base bg-white dark:bg-gray-700">
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="out_for_delivery">Out For Delivery</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Current Location */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
            <div className="flex justify-between items-center mb-2">
              <Label htmlFor="location" className="text-gray-700 dark:text-gray-300 font-medium text-sm">Current Location</Label>
              <Button 
                type="button" 
                onClick={getCurrentLocation} 
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-sm"
              >
                <FontAwesomeIcon icon={faMapPin} className="h-3 w-3 mr-1" />
                Get GPS
              </Button>
            </div>
            <Input
              id="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Enter location or use GPS"
              className="h-12 text-base bg-white dark:bg-gray-700"
              required
            />
            {gpsCoords && (
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                Lat: {gpsCoords.lat.toFixed(6)}, Lng: {gpsCoords.lng.toFixed(6)}
              </p>
            )}
          </div>

          {/* Photo Upload */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
            <Label className="text-gray-700 dark:text-gray-300 font-medium text-sm">Proof of Delivery</Label>
            
            {!photoPreview ? (
              <div className="mt-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                  <CameraIcon className="h-6 w-6 text-gray-400" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm">Upload photo proof of delivery (Optional)</p>
                <div className="space-y-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                    id="delivery-photo-file"
                  />
                  <Button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 text-base"
                    disabled={photoLoading}
                  >
                    <CameraIcon className="h-4 w-4 mr-2" />
                    Camera
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-11 text-base border-gray-300 dark:border-gray-600"
                    disabled={photoLoading}
                  >
                    <FontAwesomeIcon icon={faUpload} className="h-4 w-4 mr-2" />
                    Gallery
                  </Button>
                  <div className="flex items-center text-xs text-red-600 mt-2">
                    <input 
                      type="checkbox" 
                      checked={useHighCompression} 
                      onChange={(e) => setUseHighCompression(e.target.checked)} 
                      className="mr-2" 
                    />
                    <span>LOW QUALITY (for slow device/weak network)</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-3 relative">
                <Suspense fallback={<div className="h-48 bg-gray-200 rounded-lg animate-pulse"></div>}>
                  <PhotoPreview src={photoPreview} />
                </Suspense>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={removePhoto}
                  className="absolute top-2 right-2 bg-red-100 hover:bg-red-200 text-red-700 w-7 h-7 p-0 rounded-full"
                >
                  <CloseIcon className="h-3 w-3" />
                </Button>
              </div>
            )}

            {photoLoading && (
              <div className="mt-4 text-center text-xs text-gray-600 dark:text-gray-400">
                <p className="mb-2">Processing photo... {photoProgress}%</p>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${photoProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
            <Label htmlFor="notes" className="text-gray-700 dark:text-gray-300 font-medium text-sm">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes about this update"
              rows={3}
              className="mt-2 text-base resize-none bg-white dark:bg-gray-700"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Your name ({currentUser || "admin"}) will be added to the update notes.
            </p>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold text-base h-12 rounded-lg"
            >
              {isLoading ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin className="h-4 w-4 mr-2" />
                  Updating Status...
                </>
              ) : (
                "Update Status"
              )}
            </Button>
          </div>
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
      className="h-12 text-base font-mono tracking-wide"
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