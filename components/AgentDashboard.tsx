"use client"

import React, { useState, useEffect } from "react"
import { supabaseClient } from "../lib/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { FaPlus, FaBoxes, FaChartBar, FaMoneyBillWave, FaCalendarDay, FaClock, FaCheckCircle, FaTimesCircle, FaHistory } from "react-icons/fa"

interface AgentDashboardProps {
  userRole: string | null
  branchOrigin: string | null
  onShowBookingForm: () => void
}

interface DashboardStats {
  totalBookings: number
  pendingBookings: number
  verifiedBookings: number
  rejectedBookings: number
  totalOutstanding: number
  totalLunas: number
  todayBookings: number
}

interface RecentBooking {
  awb_no: string
  awb_date: string
  nama_penerima: string
  kota_tujuan: string
  total: number
  status: string
  payment_status: string
}

export default function AgentDashboard({ userRole, branchOrigin, onShowBookingForm }: AgentDashboardProps) {
  const [stats, setStats] = useState<DashboardStats>({
    totalBookings: 0,
    pendingBookings: 0,
    verifiedBookings: 0,
    rejectedBookings: 0,
    totalOutstanding: 0,
    totalLunas: 0,
    todayBookings: 0
  })
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [userInfo, setUserInfo] = useState<{name: string, email: string, origin_branch: string | null} | null>(null)

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) {
        setError("Tidak dapat mengakses data user")
        return
      }

      // Get user info
      const { data: userData } = await supabaseClient
        .from('users')
        .select('name, email, origin_branch')
        .eq('id', user.id)
        .single()

      if (userData) {
        setUserInfo(userData)
      }

      // Get booking statistics
      const { data: bookings, error: bookingError } = await supabaseClient
        .from('manifest_booking')
        .select('*')
        .eq('agent_id', user.id)
        .order('created_at', { ascending: false })

      if (bookingError) {
        setError("Gagal memuat data booking: " + bookingError.message)
        return
      }

      if (bookings) {
        const today = new Date().toISOString().slice(0, 10)
        
        const totalBookings = bookings.length
        const pendingBookings = bookings.filter(b => b.status === 'pending').length
        const verifiedBookings = bookings.filter(b => b.status === 'verified').length
        const rejectedBookings = bookings.filter(b => b.status === 'rejected').length
        const todayBookings = bookings.filter(b => b.awb_date === today).length
        
        const totalOutstanding = bookings
          .filter(b => b.payment_status === 'outstanding')
          .reduce((sum, b) => sum + (b.total || 0), 0)
        
        const totalLunas = bookings
          .filter(b => b.payment_status === 'lunas')
          .reduce((sum, b) => sum + (b.total || 0), 0)

        setStats({
          totalBookings,
          pendingBookings,
          verifiedBookings,
          rejectedBookings,
          totalOutstanding,
          totalLunas,
          todayBookings
        })

        // Set recent bookings
        setRecentBookings(bookings.slice(0, 10))
      }

    } catch (err) {
      setError("Terjadi kesalahan saat memuat dashboard")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR'
    }).format(amount)
  }

  if (loading && !userInfo) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Memuat dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* User Info Section */}
      {userInfo && (
        <div className="mb-6 bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                Selamat Datang, {userInfo.name}!
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {userInfo.email}
                </Badge>
                {userInfo.origin_branch && (
                  <Badge variant="outline" className="text-xs">
                    {userInfo.origin_branch.replace(/_/g, ' ').toUpperCase()}
                  </Badge>
                )}
                <Badge variant="default" className="text-xs bg-green-600">
                  Agent Dashboard
                </Badge>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <Alert className="mb-6 border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
          <AlertDescription className="text-red-700 dark:text-red-300">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Actions */}
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <FaPlus className="text-green-600" />
          Aksi Cepat
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-br from-green-600 to-green-700 text-white shadow-xl border-0 hover:shadow-2xl transition-all duration-300 cursor-pointer" onClick={onShowBookingForm}>
            <CardContent className="p-6 text-center">
              <FaBoxes className="text-4xl mb-3 mx-auto opacity-90" />
              <h4 className="text-lg font-semibold mb-2">Input Booking Baru</h4>
              <p className="text-green-100 text-sm">Buat booking pengiriman baru</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-xl border-0">
            <CardContent className="p-6 text-center">
              <FaCalendarDay className="text-4xl mb-3 mx-auto opacity-90" />
              <h4 className="text-lg font-semibold mb-2">Booking Hari Ini</h4>
              <p className="text-3xl font-bold">{stats.todayBookings}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-600 to-purple-700 text-white shadow-xl border-0">
            <CardContent className="p-6 text-center">
              <FaMoneyBillWave className="text-4xl mb-3 mx-auto opacity-90" />
              <h4 className="text-lg font-semibold mb-2">Total Outstanding</h4>
              <p className="text-xl font-bold">{formatCurrency(stats.totalOutstanding)}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <FaChartBar className="text-blue-600" />
          Statistik Booking
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Card className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-4 text-center">
            <CardHeader className="pb-1 sm:pb-2">
              <CardTitle className="text-base sm:text-lg font-bold text-blue-800 dark:text-blue-200 flex items-center justify-center gap-1 sm:gap-2">
                <FaBoxes />
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">{stats.totalBookings}</p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-4 text-center">
            <CardHeader className="pb-1 sm:pb-2">
              <CardTitle className="text-base sm:text-lg font-bold text-yellow-800 dark:text-yellow-200 flex items-center justify-center gap-1 sm:gap-2">
                <FaClock />
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">{stats.pendingBookings}</p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-4 text-center">
            <CardHeader className="pb-1 sm:pb-2">
              <CardTitle className="text-base sm:text-lg font-bold text-green-800 dark:text-green-200 flex items-center justify-center gap-1 sm:gap-2">
                <FaCheckCircle />
                Verified
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">{stats.verifiedBookings}</p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-4 text-center">
            <CardHeader className="pb-1 sm:pb-2">
              <CardTitle className="text-base sm:text-lg font-bold text-red-800 dark:text-red-200 flex items-center justify-center gap-1 sm:gap-2">
                <FaTimesCircle />
                Rejected
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">{stats.rejectedBookings}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator className="my-6" />

      {/* Payment & Recent Bookings Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Payment Summary */}
        <Card className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold text-blue-900 dark:text-blue-100 flex items-center gap-2">
              <FaMoneyBillWave />
              Ringkasan Pembayaran
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <span className="text-gray-700 dark:text-gray-300 font-medium">Outstanding:</span>
              <span className="font-bold text-orange-600 dark:text-orange-400">{formatCurrency(stats.totalOutstanding)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <span className="text-gray-700 dark:text-gray-300 font-medium">Lunas:</span>
              <span className="font-bold text-green-600 dark:text-green-400">{formatCurrency(stats.totalLunas)}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <span className="font-bold text-gray-700 dark:text-gray-300">Total:</span>
              <span className="font-bold text-xl text-blue-600 dark:text-blue-400">{formatCurrency(stats.totalOutstanding + stats.totalLunas)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Recent Bookings */}
        <Card className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold text-blue-900 dark:text-blue-100 flex items-center gap-2">
              <FaHistory />
              Booking Terbaru
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center text-gray-600 dark:text-gray-400 py-4">Memuat booking terbaru...</div>
            ) : recentBookings.length > 0 ? (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {recentBookings.slice(0, 5).map((booking) => (
                  <div
                    key={booking.awb_no}
                    className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex-1">
                      <div className="font-semibold text-gray-800 dark:text-gray-200">{booking.awb_no}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{booking.nama_penerima}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-500">{booking.kota_tujuan}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-800 dark:text-gray-200">{formatCurrency(booking.total)}</div>
                      <Badge 
                        variant={booking.status === 'verified' ? 'default' : booking.status === 'pending' ? 'secondary' : 'destructive'}
                        className="text-xs"
                      >
                        {booking.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-600 dark:text-gray-400 py-4">Belum ada booking</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tips Section */}
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-bold text-blue-800 dark:text-blue-200 flex items-center gap-2">
            💡 Tips untuk Agent
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-blue-700 dark:text-blue-300 space-y-2 text-sm leading-relaxed">
            <li>• Input booking H-1 untuk memastikan pengiriman sameday berjalan lancar</li>
            <li>• Pastikan data penerima dan alamat lengkap untuk menghindari penolakan</li>
            <li>• Print AWB booking setelah input dan tempel di paket sebelum drop ke cabang</li>
            <li>• Monitor status verifikasi booking Anda secara berkala</li>
            <li>• Pembayaran outstanding akan ditagihkan secara batch oleh cabang</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
