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
import { Camera, MapPin, Upload, X, CheckCircle, ArrowLeft, QrCode } from "lucide-react"
import { supabaseClient } from "@/lib/auth"
import type { ShipmentStatus } from "@/lib/db"
import { QRScannerQuagga } from "@/components/qr-scanner-quagga"
import imageCompression from "browser-image-compression"

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
  const [showScanner, setShowScanner] = useState(false)

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

  const fetchShipmentDetails = async (awb: string) => {
    try {
      const { data, error } = await supabaseClient.from("shipments").select("*").eq("awb_number", awb).single()
      if (!error && data) {
        setShipmentDetails(data)
      }
    } catch (err) {
      console.error("Error fetching shipment details:", err)
    }
  }

  const handleQRScan = (result: string) => {
    setAwbNumber(result)
    setShowScanner(false)
    fetchShipmentDetails(result)
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
        console.log("Error during image compression:", error)
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
          console.error("Geolocation error:", error)
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
      )
    } else {
      console.error("Geolocation not supported")
    }
  }

  const uploadImage = async (file: File, awbNumber: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split(".").pop()
      const fileName = `${awbNumber}-${Date.now()}.${fileExt}`
      const filePath = `proof-of-delivery/${fileName}`
      const arrayBuffer = await file.arrayBuffer()
      const buffer = new Uint8Array(arrayBuffer)
      const { error } = await supabaseClient.storage.from("shipment-photos").upload(filePath, buffer, {
        contentType: file.type,
      })
      if (error) {
        console.error("Supabase storage error:", error)
        return null
      }
      const { data } = supabaseClient.storage.from("shipment-photos").getPublicUrl(filePath)
      return data.publicUrl
    } catch (error) {
      console.error("Upload error:", error)
      return null
    }
  }

  const checkShipmentExists = async (awbNumber: string): Promise<boolean> => {
    try {
      const { data, error } = await supabaseClient
        .from("shipments")
        .select("awb_number")
        .eq("awb_number", awbNumber)
        .single()
      if (error) {
        console.error("Error checking shipment:", error)
        return false
      }
      return !!data
    } catch (error) {
      console.error("Error checking shipment:", error)
      return false
    }
  }

  const createShipment = async (awbNumber: string): Promise<boolean> => {
    try {
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
        console.error("Error creating shipment:", error)
        return false
      }
      return true
    } catch (error) {
      console.error("Error creating shipment:", error)
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
      const { error: updateError } = await supabaseClient
        .from("shipments")
        .update({ current_status: status, updated_at: new Date().toISOString() })
        .eq("awb_number", awbNumber)
      if (updateError) {
        console.error("Error updating shipment status:", updateError)
        return false
      }
      let updatedNotes = notes || ""
      if (!updatedNotes.includes(currentUser || "")) {
        updatedNotes = updatedNotes ? `${updatedNotes} - Updated by ${currentUser}` : `Updated by ${currentUser}`
      }
      const { error } = await supabaseClient.from("shipment_history").insert([
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
      ])
      if (error) {
        console.error("Error adding shipment history:", error)
        return false
      }
      return true
    } catch (error) {
      console.error("Error adding shipment history:", error)
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
      const shipmentExists = await checkShipmentExists(awbNumber)
      if (!shipmentExists) {
        const created = await createShipment(awbNumber)
        if (!created) {
          setError("Failed to create shipment. Please try again.")
          setIsLoading(false)
          return
        }
      }

      let photoUrl = null
      if (photo) {
        photoUrl = await uploadImage(photo, awbNumber)
      }

      const result = await addShipmentHistory(
        awbNumber,
        status,
        location,
        notes || null,
        photoUrl,
        gpsCoords?.lat || null,
        gpsCoords?.lng || null,
      )

      if (result) {
        setSuccess(true)
      } else {
        setError("Failed to update shipment status. Please try again.")
      }
    } catch (error) {
      console.error("Error updating status:", error)
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Status Updated Successfully!</h3>
            <p className="text-muted-foreground mb-6">
              The shipment status for AWB {awbNumber} has been updated to {status.replace(/_/g, " ")}.
            </p>
            <div className="flex justify-center space-x-4">
              <Button onClick={() => router.push(`/track/${awbNumber}`)}>View Tracking</Button>
              <Button variant="outline" onClick={() => router.push("/courier/dashboard")}>
                Back to Dashboard
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (showScanner) {
    return (
      <Card>
        <CardContent className="pt-6">
          <QRScannerQuagga onScan={handleQRScan} onClose={() => setShowScanner(false)} />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-6">
          <Button variant="outline" size="sm" onClick={() => router.push("/courier/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>
        </div>

        {shipmentDetails && (
          <div className="mb-4 p-3 bg-muted/50 rounded-md">
            <h3 className="font-medium mb-1">Shipment Details</h3>
            <p className="text-sm">Receiver: {shipmentDetails.receiver_name}</p>
            <p className="text-sm">Address: {shipmentDetails.receiver_address}</p>
            <p className="text-sm">Current Status: {shipmentDetails.current_status.replace(/_/g, " ")}</p>
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <Label htmlFor="courier-awb">AWB Number</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowScanner(true)}
                  className="flex items-center gap-1"
                >
                  <QrCode className="h-4 w-4" />
                  <span>Scan QR</span>
                </Button>
              </div>
              <Input
                id="courier-awb"
                placeholder="Enter AWB Number"
                value={awbNumber}
                onChange={(e) => setAwbNumber(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="shipment-status">Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as ShipmentStatus)}>
                <SelectTrigger id="shipment-status">
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="out_for_delivery">Out For Delivery</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="location">Current Location</Label>
              <div className="flex">
                <Input
                  id="location"
                  placeholder="Enter location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="rounded-r-none"
                  required
                />
                <Button type="button" onClick={getCurrentLocation} className="rounded-l-none">
                  <MapPin className="h-4 w-4 mr-2" /> GPS
                </Button>
              </div>
              {gpsCoords && (
                <p className="text-xs text-muted-foreground mt-1">
                  Lat: {gpsCoords.lat.toFixed(6)}, Lng: {gpsCoords.lng.toFixed(6)}
                </p>
              )}
            </div>

            <div>
              <Label>Proof of Delivery</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
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
                      className="mx-auto photo-preview max-h-40 rounded-lg shadow"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={removePhoto}
                      className="mt-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <X className="h-4 w-4 mr-1" /> Remove Photo
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground mb-2">Upload photo proof of delivery</p>
                    <Button type="button" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-4 w-4 mr-2" /> Select Photo
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                rows={3}
                placeholder="Add any additional notes about this update"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              {currentUser && (
                <p className="text-xs text-muted-foreground mt-1">
                  Your name ({currentUser}) will be added to the update.
                </p>
              )}
            </div>

            <Button type="submit" className="w-full font-bold py-3" disabled={isLoading}>
              {isLoading ? "Updating..." : "Update Status"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// Export the wrapper component
export function CourierUpdateForm() {
  return <CourierUpdateFormWithSearchParams />
}
