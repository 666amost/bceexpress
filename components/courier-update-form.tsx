"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMapPin, faSpinner } from '@fortawesome/free-solid-svg-icons'
import {
  ChevronLeft,
  Map as MapIcon,
  Upload as UploadIcon,
  Close as CloseIcon,
  Camera as CameraIcon,
  CheckmarkFilled as CheckmarkIcon,
} from '@carbon/icons-react'
import { supabaseClient } from "@/lib/auth"
import type { ShipmentStatus } from "@/lib/db"
import imageCompression from "browser-image-compression"
import browserBeep from "browser-beep"
import { toast } from "sonner"

// Create a client component wrapper for the search params
function CourierUpdateFormWithSearchParams() {
  const [awbFromUrl, setAwbFromUrl] = useState("")

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    setAwbFromUrl(searchParams.get("awb") || "")
  }, [])

  return <CourierUpdateFormInner initialAwb={awbFromUrl} />
}

// The inner component that doesn't directly use useSearchParams
function CourierUpdateFormInner({ initialAwb = "" }: { initialAwb: string }) {
  const [awbNumber, setAwbNumber] = useState(initialAwb)
  const [status, setStatus] = useState<ShipmentStatus | "">("")
  const [location, setLocation] = useState("")
  const [notes, setNotes] = useState("")
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shipmentDetails, setShipmentDetails] = useState<any>(null)
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const beepTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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

  useEffect(() => {
    if (initialAwb) {
      setAwbNumber(initialAwb)
      fetchShipmentDetails(initialAwb)
    }
  }, [initialAwb])

  const playBeep = () => {
    if (!beepTimeoutRef.current) {
      const audio = new Audio('/sounds/scan_success.mp3');
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
      // First check if the shipment already exists
      const { data: shipmentData, error: shipmentError } = await supabaseClient
        .from("shipments")
        .select("*")
        .eq("awb_number", awb)
        .single()

      if (!shipmentError && shipmentData) {
        setShipmentDetails(shipmentData)
        return
      }

      // If shipment doesn't exist, check if it exists in manifest (central)
      const { data: manifestData, error: manifestError } = await supabaseClient
        .from("manifest")
        .select("*")
        .eq("awb_no", awb)
        .single()

      if (!manifestError && manifestData) {
        // If found in central manifest, show the data
        setShipmentDetails({
          awb_number: manifestData.awb_no,
          receiver_name: manifestData.nama_penerima,
          receiver_address: manifestData.alamat_penerima,
          receiver_phone: manifestData.nomor_penerima,
          sender_name: manifestData.nama_pengirim,
          sender_phone: manifestData.nomor_pengirim,
          weight: manifestData.berat_kg,
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
      const { data: manifestCabangData, error: manifestCabangError } = await supabaseClient
        .from("manifest_cabang")
        .select("*")
        .eq("awb_no", awb)
        .single()

      if (!manifestCabangError && manifestCabangData) {
        // If found in branch manifest, show the data
        setShipmentDetails({
          awb_number: manifestCabangData.awb_no,
          receiver_name: manifestCabangData.nama_penerima,
          receiver_address: manifestCabangData.alamat_penerima,
          receiver_phone: manifestCabangData.nomor_penerima,
          sender_name: manifestCabangData.nama_pengirim,
          sender_phone: manifestCabangData.nomor_pengirim,
          weight: manifestCabangData.berat_kg,
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

      // If not found in either manifest, show message
      if (manifestError && manifestCabangError) {
        toast.warning("AWB tidak ditemukan di manifest", {
          description: "Shipment akan dibuat dengan data auto-generated",
          duration: 3000,
        })
      }
    } catch (err) {
      // Silently handle fetch errors - user will see appropriate toast messages
    }
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      const options = { maxSizeMB: 1.5, maxWidthOrHeight: 1920, useWebWorker: true, quality: 0.85 }
      try {
        const compressedFile = await imageCompression(file, options)
        setPhoto(compressedFile)
        const reader = new FileReader()
        reader.onload = (e) => {
          setPhotoPreview(e.target?.result as string)
        }
        reader.readAsDataURL(compressedFile)
      } catch (error) {
        // If compression fails, use original file
        setPhoto(file)
        const reader = new FileReader()
        reader.onload = (e) => {
          setPhotoPreview(e.target?.result as string)
        }
        reader.readAsDataURL(file)
      }
    }
  }

  const removePhoto = () => {
    setPhoto(null)
    setPhotoPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
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
        (error) => {
          setLocation("")
          // Silently handle geolocation errors
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
      )
    } else {
      // Geolocation not supported - silently handle
    }
  }

  const uploadImage = async (file: File, awbNumber: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split(".").pop()
      const fileName = `${awbNumber}-${Date.now()}.${fileExt}`
      const filePath = `proof-of-delivery/${fileName}`
      const arrayBuffer = await file.arrayBuffer()
      const buffer = new Uint8Array(arrayBuffer)

      // Add timeout for upload operation
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Upload timeout')), 20000)
      );

      const uploadPromise = supabaseClient.storage
        .from("shipment-photos")
        .upload(filePath, buffer, {
          contentType: file.type,
        });

      const { error } = await Promise.race([uploadPromise, timeoutPromise]) as any;

      if (error) {
        console.error("Upload error:", error);
        return null;
      }

      const { data } = supabaseClient.storage.from("shipment-photos").getPublicUrl(filePath)
      return data.publicUrl
    } catch (error) {
      console.error("Image upload failed:", error);
      return null
    }
  }

  const createShipmentFromManifest = async (awbNumber: string): Promise<boolean> => {
    try {
      // First try to create from central manifest
      const { data: manifestData, error: manifestError } = await supabaseClient
        .from("manifest")
        .select("*")
        .eq("awb_no", awbNumber)
        .single()

      if (!manifestError && manifestData) {
        // Create shipment from central manifest
        const { error: insertError } = await supabaseClient.from("shipments").insert([
          {
            awb_number: awbNumber,
            sender_name: manifestData.nama_pengirim || "Auto Generated",
            sender_address: manifestData.alamat_pengirim || "Auto Generated", 
            sender_phone: manifestData.nomor_pengirim || "Auto Generated",
            receiver_name: manifestData.nama_penerima || "Auto Generated",
            receiver_address: manifestData.alamat_penerima || "Auto Generated",
            receiver_phone: manifestData.nomor_penerima || "Auto Generated",
            weight: manifestData.berat_kg || 1,
            dimensions: manifestData.dimensi || "10x10x10",
            service_type: "Standard",
            current_status: status as string,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])

        if (!insertError) {
          toast.success("Shipment dibuat dari manifest pusat")
          return true
        }
      }

      // If not found in central manifest, try branch manifest
      const { data: manifestCabangData, error: manifestCabangError } = await supabaseClient
        .from("manifest_cabang")
        .select("*")
        .eq("awb_no", awbNumber)
        .single()

      if (!manifestCabangError && manifestCabangData) {
        // Create shipment from branch manifest
        const { error: insertError } = await supabaseClient.from("shipments").insert([
          {
            awb_number: awbNumber,
            sender_name: manifestCabangData.nama_pengirim || "Auto Generated",
            sender_address: manifestCabangData.alamat_pengirim || "Auto Generated",
            sender_phone: manifestCabangData.nomor_pengirim || "Auto Generated", 
            receiver_name: manifestCabangData.nama_penerima || "Auto Generated",
            receiver_address: manifestCabangData.alamat_penerima || "Auto Generated",
            receiver_phone: manifestCabangData.nomor_penerima || "Auto Generated",
            weight: manifestCabangData.berat_kg || 1,
            dimensions: manifestCabangData.dimensi || "10x10x10",
            service_type: "Standard",
            current_status: status as string,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])

        if (!insertError) {
          toast.success("Shipment dibuat dari manifest cabang")
          return true
        }
      }

      // If not found in either manifest, fallback to basic shipment
      return await createBasicShipment(awbNumber)
    } catch (error) {
      return await createBasicShipment(awbNumber)
    }
  }

  const createBasicShipment = async (awbNumber: string): Promise<boolean> => {
    try {
      // If shipmentDetails exists and has from_manifest flag, use that data
      if (shipmentDetails && shipmentDetails.from_manifest) {
        const { error } = await supabaseClient.from("shipments").insert([
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
        ])

        if (error) {
          return false
        }
        return true
      }

      // Fallback to basic auto-generated shipment
      const { error } = await supabaseClient.from("shipments").insert([
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
      ])

      if (error) {
        return false
      }
      return true
    } catch (error) {
      return false
    }
  }

  const checkShipmentExists = async (awbNumber: string): Promise<boolean> => {
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), 10000)
      );

      const queryPromise = supabaseClient
        .from("shipments")
        .select("awb_number")
        .eq("awb_number", awbNumber)
        .single();

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;

      if (error) {
        console.error("Check shipment error:", error);
        return false;
      }
      return !!data
    } catch (error) {
      console.error("Check shipment failed:", error);
      return false
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
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Update timeout')), 15000)
      );

      // Update shipment status first
      const updatePromise = supabaseClient
        .from("shipments")
        .update({ current_status: status, updated_at: new Date().toISOString() })
        .eq("awb_number", awbNumber);

      const { error: updateError } = await Promise.race([updatePromise, timeoutPromise]) as any;

      if (updateError) {
        console.error("Update shipment error:", updateError);
        return false;
      }

      let updatedNotes = notes || ""
      if (!updatedNotes.includes(currentUser || "")) {
        updatedNotes = updatedNotes ? `${updatedNotes} - Updated by ${currentUser}` : `Updated by ${currentUser}`
      }

      // Insert history record
      const insertPromise = supabaseClient.from("shipment_history").insert([
        {
          awb_number: awbNumber,
          status,
          location,
          notes: updatedNotes,
          photo_url: photoUrl,
          latitude,
          longitude,
          created_at: new Date().toISOString(),
        },
      ]);

      const { error: insertError } = await Promise.race([insertPromise, timeoutPromise]) as any;

      if (insertError) {
        console.error("Insert history error:", insertError);
        return false;
      }
      return true
    } catch (error) {
      console.error("Add shipment history failed:", error);
      return false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    if (!awbNumber || !status || !location) {
      setError("AWB number, status, and location are required")
      setIsLoading(false)
      return
    }

    try {
      // Add timeout for all operations
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Operation timeout')), 30000)
      );

      const shipmentExists = await Promise.race([
        checkShipmentExists(awbNumber),
        timeoutPromise
      ]) as boolean;

      if (!shipmentExists) {
        // Try to create shipment from manifest first
        const created = await Promise.race([
          createShipmentFromManifest(awbNumber),
          timeoutPromise
        ]) as boolean;

        if (!created) {
          setError("Failed to create shipment. Please try again.")
          setIsLoading(false)
          return
        }
      }

      let photoUrl: string | null = null
      if (photo) {
        try {
          photoUrl = await Promise.race([
            uploadImage(photo, awbNumber),
            timeoutPromise
          ]) as string | null;
        } catch (uploadError) {
          console.error("Photo upload failed:", uploadError);
          // Continue without photo if upload fails
          photoUrl = null;
        }
      }

      const result = await Promise.race([
        addShipmentHistory(
          awbNumber,
          status,
          location,
          notes || null,
          photoUrl,
          gpsCoords?.lat || null,
          gpsCoords?.lng || null,
        ),
        timeoutPromise
      ]) as boolean;

      if (result) {
        setSuccess(true)

        // Tambahkan logika trigger sync hanya jika status adalah "delivered"
        if (status === "delivered") {
          try {
            const syncTimeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Sync timeout')), 10000)
            );

            const response = await Promise.race([
              fetch(`/api/sync?awb_number=${awbNumber}`, {
                method: 'GET',
              }),
              syncTimeoutPromise
            ]) as Response;

            if (response.ok) {
              // Sync successful - silently handle
              toast.success("Status diperbarui dan disinkronkan ke cabang.")
            } else {
              // Sync failed - show error toast
              toast.error("Update sukses, tapi sinkronisasi gagal.")
            }
          } catch (syncError) {
            // Sync error - silently handle
            console.error("Sync error:", syncError);
          }
        }
      } else {
        setError("Failed to update shipment status. Please try again.")
      }
    } catch (error) {
      console.error("Submit error:", error);
      if (error instanceof Error && error.message === 'Operation timeout') {
        setError("Operation timed out. Please check your connection and try again.")
      } else {
        setError("An unexpected error occurred. Please try again.")
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
              <p className="text-muted-foreground mb-6">
                The shipment status for AWB <span className="font-mono font-medium">{awbNumber}</span> has been updated to <span className="font-medium">{status.replace(/_/g, " ")}</span>.
              </p>
              <div className="flex flex-col space-y-3 sm:flex-row sm:space-x-4 sm:space-y-0 justify-center">
                <Button onClick={() => router.push(`/track/${awbNumber}`)} className="font-bold bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-600">
                  View Tracking
                </Button>
                <Button variant="outline" onClick={() => router.push("/courier/dashboard")} className="border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800/50">
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
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-white dark:from-black dark:to-gray-900 flex justify-center items-start p-4 sm:p-6">
      <Card className="w-full max-w-lg md:max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
        <CardContent className="pt-6">
          <div className="mb-6">
            <Button variant="outline" size="sm" onClick={() => router.push("/courier/dashboard")} className="border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800/50">
              <ChevronLeft className="w-4 h-4 mr-2" /> Back to Dashboard
            </Button>
          </div>

          {shipmentDetails && (
            <div className="mb-6 p-4 bg-muted/50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">Shipment Details</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300">Receiver: <span className="font-medium">{shipmentDetails.receiver_name}</span></p>
              <p className="text-sm text-gray-700 dark:text-gray-300">Phone: <span className="font-medium">{shipmentDetails.receiver_phone || "N/A"}</span></p>
              <p className="text-sm text-gray-700 dark:text-gray-300">Address: <span className="font-medium">{shipmentDetails.receiver_address}</span></p>
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                Current Status: <span className="font-medium text-blue-600 dark:text-blue-400">{shipmentDetails.current_status?.replace(/_/g, " ") || "New from Manifest"}</span>
              </p>
              {shipmentDetails.from_manifest && (
                <p className="text-sm text-green-600 dark:text-green-400 font-medium mt-1">Data loaded from manifest ({shipmentDetails.manifest_source})</p>
              )}
            </div>
          )}

          {error && (
            <Alert variant="destructive" className="mb-6 border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
              <AlertDescription className="text-red-700 dark:text-red-300">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <Label htmlFor="courier-awb" className="text-gray-700 dark:text-gray-300 font-semibold">AWB Number</Label>
              </div>
              <Input
                id="courier-awb"
                placeholder="Enter AWB Number"
                value={awbNumber}
                onChange={(e) => {
                  setAwbNumber(e.target.value)
                  if (e.target.value.length >= 10) {
                    fetchShipmentDetails(e.target.value)
                  }
                }}
                required
                className="font-mono bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <Label htmlFor="shipment-status" className="text-gray-700 dark:text-gray-300 font-semibold">Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as ShipmentStatus)}>
                <SelectTrigger id="shipment-status" className="bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500">
                  <SelectValue placeholder="Select Status" className="text-gray-400 dark:text-gray-600" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
                  <SelectItem value="out_for_delivery">Out For Delivery</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                 <Label htmlFor="location" className="text-gray-700 dark:text-gray-300 font-semibold">Current Location</Label>
                 <Button type="button" onClick={getCurrentLocation} className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-600">
                  <FontAwesomeIcon icon={faMapPin} className="w-4 h-4 mr-1" />
                  <span>Get GPS</span>
                </Button>
              </div>
              <Input
                id="location"
                placeholder="Enter location or use GPS"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:ring-blue-500 focus:border-blue-500"
                required={status === "delivered"} // Require location only for 'delivered' status
              />
              {gpsCoords && (
                <p className="text-xs text-muted-foreground mt-1">
                  Lat: {gpsCoords.lat.toFixed(6)}, Lng: {gpsCoords.lng.toFixed(6)}
                </p>
              )}
            </div>

            <div>
              <Label className="text-gray-700 dark:text-gray-300 font-semibold">Proof of Delivery</Label>
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center bg-gray-50 dark:bg-gray-800">
                <input
                  type="file"
                  id="delivery-photo"
                  accept="image/*"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handlePhotoChange}
                />

                {photoPreview ? (
                  <div className="mb-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoPreview || "/placeholder.svg"}
                      alt="Preview"
                      className="mx-auto photo-preview max-h-60 rounded-lg shadow-md"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={removePhoto}
                      className="mt-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <CloseIcon className="h-4 w-4 mr-1" /> Remove Photo
                    </Button>
                  </div>
                ) : (
                  <div>
                    <CameraIcon className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-600 mb-3" />
                    <p className="text-gray-600 dark:text-gray-400 mb-3">Upload photo proof of delivery (Optional)</p>
                    <Button type="button" onClick={() => fileInputRef.current?.click()} className="font-bold bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-600">
                      <UploadIcon className="w-4 h-4 mr-2" /> Select Photo
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="notes" className="text-gray-700 dark:text-gray-300 font-semibold">Notes (Optional)</Label>
              <Textarea
                id="notes"
                rows={3}
                placeholder="Add any additional notes about this update"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:ring-blue-500 focus:border-blue-500"
              />
              {currentUser && (
                <p className="text-xs text-muted-foreground mt-1">
                  Your name (<span className="font-semibold">{currentUser}</span>) will be added to the update notes.
                </p>
              )}
            </div>

            <Button type="submit" className="w-full font-bold py-3 bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-600" disabled={isLoading || (status === 'delivered' && !location)}>
              {isLoading ? (
                 <><span className="animate-spin"><FontAwesomeIcon icon={faSpinner} className="h-5 w-5 mr-2" /></span> Updating...</>
              ) : (
                "Update Status"
              )}
            </Button>
             {status === 'delivered' && !location && (
                 <p className="text-sm text-red-500 mt-2 text-center">* Location is required for 'Delivered' status.</p>
             )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

// Export the wrapper component
export function CourierUpdateForm() {
  return <CourierUpdateFormWithSearchParams />
}
