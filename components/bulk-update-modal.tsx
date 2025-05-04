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
import QRCode from "qrcode"
import JsBarcode from "jsbarcode"

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

  const handleSubmit = async () => {
    if (!awbNumbers.trim()) {
      setError("Please enter at least one AWB number")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Parse AWB numbers (split by newline, comma, or space)
      const awbList = awbNumbers
        .split(/[\n,\s]+/)
        .map((awb) => awb.trim())
        .filter((awb) => awb.length > 0)

      if (awbList.length === 0) {
        setError("No valid AWB numbers found")
        setIsLoading(false)
        return
      }

      let successCount = 0
      const location = "Sorting Center"
      const status = "out_for_delivery"
      const currentDate = new Date().toISOString()

      // Get courier name and ID
      const courierName = currentUser?.name || currentUser?.email?.split("@")[0] || "courier"
      const courierId = currentUser?.id

      // Process each AWB number
      for (const awb of awbList) {
        // Check if shipment exists
        const { data: existingShipment } = await supabaseClient
          .from("shipments")
          .select("awb_number")
          .eq("awb_number", awb)
          .single()

        // If shipment doesn't exist, create it with courier_id
        if (!existingShipment) {
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
              current_status: status,
              created_at: currentDate,
              updated_at: currentDate,
              courier_id: courierId,
            },
          ])
        } else {
          // Update existing shipment with courier_id
          await supabaseClient
            .from("shipments")
            .update({
              current_status: status,
              updated_at: currentDate,
              courier_id: courierId,
            })
            .eq("awb_number", awb)
        }

        // Add shipment history entry
        await supabaseClient.from("shipment_history").insert([
          {
            awb_number: awb,
            status,
            location,
            notes: `Bulk update - Out for Delivery by ${courierName}`,
            created_at: currentDate,
          },
        ])

        successCount++
      }

      onSuccess(successCount)
      setAwbNumbers("")
      onClose()
    } catch (error) {
      console.error("Bulk update error:", error)
      setError("An error occurred during bulk update. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={showScanner ? "sm:max-w-md" : "sm:max-w-md"}>
        {showScanner ? (
          <QRScanner onScan={handleQRScan} onClose={() => setShowScanner(false)} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Bulk Update AWB Numbers</DialogTitle>
              <DialogDescription>
                Enter multiple AWB numbers (one per line or separated by commas) to update their status to <b>Out For Delivery</b>
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
                <p className="text-xs text-muted-foreground">contoh: BCE123456789, BCE987654321, BE0423056087
                hati-hati dijalan</p>
                {currentUser && (
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    Updates will be attributed to: {currentUser.name || currentUser.email?.split("@")[0]}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
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
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
