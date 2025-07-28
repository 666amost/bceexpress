"use client"

import React, { useState } from "react"
import { QRScanner } from "./qr-scanner"
import { supabaseClient } from "../lib/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface BranchBookingScannerProps {
  userRole: string | null
  branchOrigin: string | null
  onBookingFound: (booking: Record<string, unknown>) => void
}

export default function BranchBookingScanner({ 
  userRole, 
  branchOrigin, 
  onBookingFound 
}: BranchBookingScannerProps) {
  const [showQRScanner, setShowQRScanner] = useState(false)
  const [manualAWB, setManualAWB] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // Only show for admin and cabang roles
  if (userRole !== 'admin' && userRole !== 'cabang') {
    return null
  }

  const searchBookingByAWB = async (awbNo: string) => {
    if (!awbNo.trim()) return

    try {
      setLoading(true)
      setError("")
      
      let query = supabaseClient
        .from('manifest_booking')
        .select(`
          *,
          users!manifest_booking_user_id_fkey (
            name,
            email
          )
        `)
        .eq('awb_no', awbNo.trim())
        .eq('status', 'pending')

      // Filter by branch origin for cabang users
      if (userRole === 'cabang' && branchOrigin) {
        query = query.eq('origin_branch', branchOrigin)
      }

      const { data, error: fetchError } = await query

      if (fetchError) {
        setError("Gagal mencari booking: " + fetchError.message)
        return
      }

      if (data && data.length > 0) {
        const booking = {
          ...data[0],
          agent_name: data[0].users?.name || 'Unknown',
          agent_email: data[0].users?.email || 'Unknown'
        }
        onBookingFound(booking)
        setManualAWB("")
        setShowQRScanner(false)
      } else {
        setError(`Booking dengan AWB ${awbNo} tidak ditemukan atau sudah diverifikasi`)
      }
    } catch (err) {
      setError("Terjadi kesalahan: " + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const handleQRScan = (scannedText: string) => {
    searchBookingByAWB(scannedText)
  }

  const handleManualSearch = () => {
    if (manualAWB.trim()) {
      searchBookingByAWB(manualAWB)
    }
  }

  const closeQRScanner = () => {
    setShowQRScanner(false)
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-blue-600 dark:text-blue-400">
           Scan & Verifikasi Booking Agent
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Manual Search */}
          <div className="flex gap-2">
            <Input
              placeholder="Masukkan AWB No untuk verifikasi..."
              value={manualAWB}
              onChange={(e) => setManualAWB(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleManualSearch()}
              className="flex-1"
            />
            <Button 
              onClick={handleManualSearch}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? "Mencari..." : "🔍 Cari"}
            </Button>
          </div>

          {/* QR Scanner Button */}
          <div className="text-center">
            <Button
              onClick={() => setShowQRScanner(!showQRScanner)}
              className={`${
                showQRScanner 
                  ? "bg-red-600 hover:bg-red-700" 
                  : "bg-green-600 hover:bg-green-700"
              } text-white`}
            >
              {showQRScanner ? "🛑 Tutup Scanner" : "📷 Buka QR Scanner"}
            </Button>
          </div>

          {/* QR Scanner */}
          {showQRScanner && (
            <div className="mt-4">
              <QRScanner 
                onScan={handleQRScan}
                onClose={closeQRScanner}
                disableAutoUpdate={true}
              />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
