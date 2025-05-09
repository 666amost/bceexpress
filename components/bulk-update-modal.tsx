"use client"

import { useState, useEffect } from "react"
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
import { Camera, Loader2 } from "lucide-react"
import { supabaseClient } from "@/lib/auth"
import { QRScanner } from "./qr-scanner"

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
  const [showScanner, setShowScanner] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<string>("")

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
      setError(null)
      setProcessingStatus("")
    }
  }, [isOpen])

  const handleQRScan = (result: string) => {
    // Add the scanned AWB to the list
    const currentAwbs = awbNumbers.trim() ? awbNumbers.split(/[\n,\s]+/) : []

    // Check if the AWB is already in the list
    if (!currentAwbs.includes(result)) {
      const newAwbList = [...currentAwbs, result]
      setAwbNumbers(newAwbList.join("\n"))
    }

    // Close the scanner
    setShowScanner(false)
  }

  // Function to check if AWB exists in manifest
  const checkManifestAwb = async (awb: string) => {
    try {
      const { data, error } = await supabaseClient.from("manifest").select("*").eq("awb_no", awb).single()
      if (error) {
        console.log(`AWB ${awb} not found in manifest:`, error.message)
        return null
      }
      return data
    } catch (err) {
      console.error(`Error checking manifest for AWB ${awb}:`, err)
      return null
    }
  }

  // Function to create shipment with manifest data
  const createShipmentWithManifestData = async (awb: string, manifestData: any, courierId: string) => {
    try {
      // Create a new shipment with data from manifest
      await supabaseClient.from("shipments").insert([
        {
          awb_number: awb,
          sender_name: manifestData.nama_pengirim || "Auto Generated",
          sender_address: manifestData.alamat_pengirim || "Auto Generated",
          sender_phone: manifestData.nomor_pengirim || "Auto Generated",
          receiver_name: manifestData.nama_penerima || "Auto Generated",
          receiver_address: manifestData.alamat_penerima || "Auto Generated",
          receiver_phone: manifestData.nomor_penerima || "Auto Generated",
          weight: manifestData.berat_kg || 1,
          dimensions: manifestData.dimensi || "10x10x10",
          service_type: "Standard",
          current_status: "out_for_delivery",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          courier_id: courierId,
        },
      ])
      return { success: true, message: "Created from manifest data" }
    } catch (err) {
      console.error(`Error creating shipment with manifest data for AWB ${awb}:`, err)
      return { success: false, message: `Error: ${err}` }
    }
  }

  // Function to create basic shipment
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
      ])
      return { success: true, message: "Created with auto-generated data" }
    } catch (err) {
      console.error(`Error creating basic shipment for AWB ${awb}:`, err)
      return { success: false, message: `Error: ${err}` }
    }
  }

  // Function to update existing shipment
  const updateExistingShipment = async (awb: string, courierId: string, status: string) => {
    try {
      await supabaseClient
        .from("shipments")
        .update({
          current_status: status,
          updated_at: new Date().toISOString(),
          courier_id: courierId,
        })
        .eq("awb_number", awb)
      return { success: true, message: "Updated existing shipment" }
    } catch (err) {
      console.error(`Error updating existing shipment for AWB ${awb}:`, err)
      return { success: false, message: `Error: ${err}` }
    }
  }

  // Function to add shipment history
  const addShipmentHistory = async (awb: string, status: string, location: string, notes: string) => {
    try {
      await supabaseClient.from("shipment_history").insert([
        {
          awb_number: awb,
          status,
          location,
          notes,
          created_at: new Date().toISOString(),
        },
      ])
      return { success: true, message: "Added to shipment history" }
    } catch (err) {
      console.error(`Error adding history for AWB ${awb}:`, err)
      return { success: false, message: `Error: ${err}` }
    }
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    setError("")
    setProcessingStatus("Memulai proses...")

    try {
      const awbList = awbNumbers
        .split(/[\n,\s]+/)
        .map((awb) => awb.trim())
        .filter((awb) => awb.length > 0)

      if (awbList.length === 0) {
        setError("Please enter at least one AWB number")
        setIsLoading(false)
        return
      }

      // Get current user session
      const { data: session } = await supabaseClient.auth.getSession()
      const courierId = session?.session?.user?.id
      const courierName = currentUser?.name || session?.session?.user?.email?.split("@")[0] || "courier"

      if (!courierId) {
        setError("No courier session found")
        setIsLoading(false)
        return
      }

      let successCount = 0
      const location = "Sorting Center"
      const status = "out_for_delivery"

      // Process each AWB number
      for (let i = 0; i < awbList.length; i++) {
        const awb = awbList[i]
        setProcessingStatus(`Memproses AWB ${i + 1}/${awbList.length}: ${awb}...`)

        try {
          // Check if shipment exists
          const { data: existingShipment } = await supabaseClient
            .from("shipments")
            .select("awb_number")
            .eq("awb_number", awb)
            .single()

          // If shipment doesn't exist, try to create it from manifest
          if (!existingShipment) {
            // Check if AWB exists in manifest
            const manifestData = await checkManifestAwb(awb)

            if (manifestData) {
              // Create shipment with manifest data
              const createResult = await createShipmentWithManifestData(awb, manifestData, courierId)
              if (!createResult.success) {
                // If failed to create with manifest data, try basic shipment
                await createBasicShipment(awb, courierId)
              }
            } else {
              // If not in manifest, create basic shipment
              await createBasicShipment(awb, courierId)
            }
          } else {
            // Update existing shipment
            await updateExistingShipment(awb, courierId, status)
          }

          // Add shipment history entry
          await addShipmentHistory(awb, status, location, `Bulk update - Out for Delivery by ${courierName}`)

          successCount++
        } catch (err) {
          console.error(`Error processing AWB ${awb}:`, err)
          // Continue with next AWB even if this one fails
        }
      }

      // Notify parent component about success and close modal
      onSuccess(successCount)

      // Reset form and close modal
      setAwbNumbers("")
      onClose()
    } catch (error) {
      console.error("Bulk update error:", error)
      setError("An error occurred during bulk update. Please try again.")
      setIsLoading(false)
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isLoading) {
          onClose()
        }
      }}
    >
      <DialogContent className={showScanner ? "sm:max-w-md" : "sm:max-w-md"}>
        {showScanner ? (
          <QRScanner onScan={handleQRScan} onClose={() => setShowScanner(false)} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Bulk Update AWB Numbers</DialogTitle>
              <DialogDescription>
                Enter multiple AWB numbers (one per line or separated by commas) to update their status to{" "}
                <b>Out For Delivery</b>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="awb-numbers">AWB Numbers</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowScanner(true)}
                    className="flex items-center gap-1"
                  >
                    <Camera className="h-4 w-4" />
                    <span>Scan QR</span>
                  </Button>
                </div>
                <Textarea
                  id="awb-numbers"
                  placeholder="Enter AWB numbers here..."
                  rows={6}
                  value={awbNumbers}
                  onChange={(e) => setAwbNumbers(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  contoh: BCE123456789, BCE987654321, BE0423056087 hati-hati dijalan
                </p>
                {currentUser && (
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    Updates will be attributed to: {currentUser.name || currentUser.email?.split("@")[0]}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter className="flex flex-col space-y-2">
              {processingStatus && (
                <div className="w-full text-center text-sm text-blue-600 dark:text-blue-400 mb-2">
                  {processingStatus}
                </div>
              )}
              <div className="flex justify-end space-x-2 w-full">
                <Button variant="outline" onClick={onClose} disabled={isLoading}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
                    </>
                  ) : (
                    "Update All For Delivery"
                  )}
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
