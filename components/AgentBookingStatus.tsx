"use client"

import React, { useState, useEffect } from "react"
import { supabaseClient } from "../lib/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { FaSearch, FaFilter, FaClock, FaCheckCircle, FaTimesCircle, FaMoneyBillWave, FaCalendarAlt, FaUser, FaMapMarkerAlt } from "react-icons/fa"

interface BookingStatusProps {
  userRole: string | null
  branchOrigin: string | null
}

interface BookingData {
  id: string
  awb_no: string
  awb_date: string
  nama_penerima: string
  kota_tujuan: string
  total: number
  status: string
  payment_status: string
  verified_time?: string
  input_time: string
}

export default function BookingStatus({ userRole, branchOrigin }: BookingStatusProps) {
  const [bookings, setBookings] = useState<BookingData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState({
    status: "",
    payment_status: "",
    date_from: "",
    date_to: ""
  })

  const fetchBookings = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) {
        setError("User tidak ditemukan")
        return
      }

      let query = supabaseClient
        .from('manifest_booking')
        .select('*')
        .eq('agent_id', user.id)
        .order('created_at', { ascending: false })

      // Apply filters
      if (filter.status) {
        query = query.eq('status', filter.status)
      }
      if (filter.payment_status) {
        query = query.eq('payment_status', filter.payment_status)
      }
      if (filter.date_from) {
        query = query.gte('awb_date', filter.date_from)
      }
      if (filter.date_to) {
        query = query.lte('awb_date', filter.date_to)
      }

      const { data, error: fetchError } = await query

      if (fetchError) {
        setError("Gagal mengambil data: " + fetchError.message)
      } else {
        setBookings(data || [])
      }
    } catch (err) {
      setError("Terjadi kesalahan: " + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBookings()
  }, [filter]) // Re-fetch when filter changes

  const getStatusBadge = (status: string) => {
    const statusColors = {
      pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
      verified: "bg-green-100 text-green-800 border-green-300",
      rejected: "bg-red-100 text-red-800 border-red-300"
    }
    
    const statusText = {
      pending: "Menunggu Verifikasi",
      verified: "Terverifikasi",
      rejected: "Ditolak"
    }

    return (
      <span className={`px-2 py-1 rounded-full text-xs border ${statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800 border-gray-300'}`}>
        {statusText[status as keyof typeof statusText] || status}
      </span>
    )
  }

  const getPaymentBadge = (payment_status: string) => {
    const paymentColors = {
      outstanding: "bg-orange-100 text-orange-800 border-orange-300",
      lunas: "bg-blue-100 text-blue-800 border-blue-300"
    }
    
    const paymentText = {
      outstanding: "Outstanding",
      lunas: "Lunas"
    }

    return (
      <span className={`px-2 py-1 rounded-full text-xs border ${paymentColors[payment_status as keyof typeof paymentColors] || 'bg-gray-100 text-gray-800 border-gray-300'}`}>
        {paymentText[payment_status as keyof typeof paymentText] || payment_status}
      </span>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <h2 className="text-2xl font-bold mb-6 text-green-600 dark:text-green-400">
        Status Booking Pengiriman
      </h2>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <div>
          <label className="block text-sm font-medium mb-2">Status Verifikasi</label>
          <select
            value={filter.status}
            onChange={(e) => setFilter({...filter, status: e.target.value})}
            className="w-full border rounded px-3 py-2 dark:bg-gray-600"
          >
            <option value="">Semua Status</option>
            <option value="pending">Menunggu Verifikasi</option>
            <option value="verified">Terverifikasi</option>
            <option value="rejected">Ditolak</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Status Pembayaran</label>
          <select
            value={filter.payment_status}
            onChange={(e) => setFilter({...filter, payment_status: e.target.value})}
            className="w-full border rounded px-3 py-2 dark:bg-gray-600"
          >
            <option value="">Semua Status</option>
            <option value="outstanding">Outstanding</option>
            <option value="lunas">Lunas</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Dari Tanggal</label>
          <input
            type="date"
            value={filter.date_from}
            onChange={(e) => setFilter({...filter, date_from: e.target.value})}
            className="w-full border rounded px-3 py-2 dark:bg-gray-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Sampai Tanggal</label>
          <input
            type="date"
            value={filter.date_to}
            onChange={(e) => setFilter({...filter, date_to: e.target.value})}
            className="w-full border rounded px-3 py-2 dark:bg-gray-600"
          />
        </div>
      </div>

      {/* Results Summary */}
      <div className="mb-4 flex justify-between items-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Menampilkan {bookings.length} booking
        </p>
        <button
          onClick={fetchBookings}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm"
        >
          Refresh
        </button>
      </div>

      {/* Bookings Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">AWB Booking</th>
              <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">Tanggal</th>
              <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">Penerima</th>
              <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">Tujuan</th>
              <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-right">Total</th>
              <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">Status Verifikasi</th>
              <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">Status Pembayaran</th>
              <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">Waktu Verifikasi</th>
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 ? (
              <tr>
                <td colSpan={8} className="border border-gray-300 dark:border-gray-600 px-4 py-8 text-center text-gray-500">
                  Tidak ada data booking ditemukan
                </td>
              </tr>
            ) : (
              bookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-mono text-sm">
                    {booking.awb_no}
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                    {formatDate(booking.awb_date)}
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                    {booking.nama_penerima}
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                    {booking.kota_tujuan}
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-right font-semibold">
                    {formatCurrency(booking.total)}
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">
                    {getStatusBadge(booking.status)}
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">
                    {getPaymentBadge(booking.payment_status)}
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center text-sm">
                    {booking.verified_time ? formatDate(booking.verified_time) : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Statistics */}
      {bookings.length > 0 && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Pending</h3>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {bookings.filter(b => b.status === 'pending').length}
            </p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-green-800 dark:text-green-200">Terverifikasi</h3>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {bookings.filter(b => b.status === 'verified').length}
            </p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Ditolak</h3>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {bookings.filter(b => b.status === 'rejected').length}
            </p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">Total Outstanding</h3>
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
              {formatCurrency(
                bookings
                  .filter(b => b.payment_status === 'outstanding')
                  .reduce((sum, b) => sum + b.total, 0)
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
