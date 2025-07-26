"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import AgentNavbar from "@/components/agent-navbar"
import AgentBookingForm from "@/components/AgentBookingForm"
import AgentBookingStatus from "@/components/AgentBookingStatus"
import AgentDashboard from "@/components/AgentDashboard"
import { supabaseClient } from "../../lib/auth"

export default function AgentPage() {
  const [selectedMenu, setSelectedMenu] = useState("dashboard")
  const [selectedSubMenu, setSelectedSubMenu] = useState("")
  const [isClient, setIsClient] = useState(false)
  const [showBookingForm, setShowBookingForm] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [branchOrigin, setBranchOrigin] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data } = await supabaseClient.auth.getSession()
        
        if (!data.session) {
          router.push("/agent/login")
          return
        }

        const userId = data.session.user.id
        const { data: userData, error } = await supabaseClient
          .from('users')
          .select('role, origin_branch')
          .eq('id', userId)
          .single()

        if (error || !userData) {
          console.error('Error fetching user data:', error)
          router.push("/agent/login")
          return
        }

        if (userData.role !== 'agent') {
          console.error('User is not an agent:', userData.role)
          router.push("/agent/login")
          return
        }

        setUserRole(userData.role)
        setBranchOrigin(userData.origin_branch)
        setIsClient(true)
      } catch (error) {
        console.error('Auth check error:', error)
        router.push("/agent/login")
      }
    }

    checkAuth()
  }, [router])

  const handleMenuChange = (menu: string, submenu?: string) => {
    setSelectedMenu(menu)
    setSelectedSubMenu(submenu || "")
    setShowBookingForm(false)

    // Handle specific menu actions
    if (menu === "booking" && submenu === "input_booking") {
      setShowBookingForm(true)
    }
  }

  const handleShowBookingForm = () => {
    setSelectedMenu("booking")
    setSelectedSubMenu("input_booking")
    setShowBookingForm(true)
  }

  const handleSuccess = () => {
    setShowBookingForm(false)
    setSelectedMenu("dashboard")
    setSelectedSubMenu("")
  }

  const handleCancel = () => {
    setShowBookingForm(false)
    setSelectedMenu("dashboard")
    setSelectedSubMenu("")
  }

  // Show loading spinner while checking auth
  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <AgentNavbar
        selectedMenu={selectedMenu}
        selectedSubMenu={selectedSubMenu}
        onMenuChange={handleMenuChange}
      />
      
      <div className="pt-16"> {/* Add padding top for fixed navbar */}
        {/* Dashboard */}
        {selectedMenu === "dashboard" && (
          <AgentDashboard
            userRole={userRole}
            branchOrigin={branchOrigin}
            onShowBookingForm={handleShowBookingForm}
          />
        )}

        {/* Booking Menu */}
        {selectedMenu === "booking" && (
          <div className="container mx-auto px-4 py-6">
            {selectedSubMenu === "input_booking" && showBookingForm && (
              <AgentBookingForm
                onSuccess={handleSuccess}
                onCancel={handleCancel}
                userRole={userRole}
                branchOrigin={branchOrigin}
              />
            )}
            
            {selectedSubMenu === "print_awb" && (
              <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
                <h2 className="text-2xl font-bold mb-6 text-green-600 dark:text-green-400">
                  Print AWB Booking
                </h2>
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🖨️</div>
                  <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Fitur Print AWB
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Fitur untuk print ulang AWB booking yang sudah dibuat.
                  </p>
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    🚧 Coming Soon - Dalam pengembangan
                  </p>
                </div>
              </div>
            )}

            {/* Default booking view when no submenu selected */}
            {!selectedSubMenu && (
              <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
                <h2 className="text-2xl font-bold mb-6 text-green-600 dark:text-green-400">
                  Booking Pengiriman
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <button
                    onClick={() => handleMenuChange("booking", "input_booking")}
                    className="p-6 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                  >
                    <div className="text-4xl mb-3">📝</div>
                    <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">Input Booking</h3>
                    <p className="text-green-600 dark:text-green-400 text-sm">Buat booking pengiriman baru</p>
                  </button>
                  
                  <button
                    onClick={() => handleMenuChange("booking", "print_awb")}
                    className="p-6 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    <div className="text-4xl mb-3">🖨️</div>
                    <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200">Print AWB</h3>
                    <p className="text-blue-600 dark:text-blue-400 text-sm">Print ulang AWB booking</p>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* History Menu */}
        {selectedMenu === "history" && (
          <div className="container mx-auto px-4 py-6">
            {selectedSubMenu === "booking_status" && (
              <AgentBookingStatus
                userRole={userRole}
                branchOrigin={branchOrigin}
              />
            )}
            
            {selectedSubMenu === "payment_status" && (
              <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
                <h2 className="text-2xl font-bold mb-6 text-green-600 dark:text-green-400">
                  Status Pembayaran
                </h2>
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">💰</div>
                  <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Status Pembayaran Detail
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Lihat detail status pembayaran dan outstanding untuk setiap booking.
                  </p>
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    🚧 Coming Soon - Dalam pengembangan
                  </p>
                </div>
              </div>
            )}

            {/* Default history view when no submenu selected */}
            {!selectedSubMenu && (
              <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
                <h2 className="text-2xl font-bold mb-6 text-green-600 dark:text-green-400">
                  History & Status
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <button
                    onClick={() => handleMenuChange("history", "booking_status")}
                    className="p-6 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    <div className="text-4xl mb-3">📋</div>
                    <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200">Status Booking</h3>
                    <p className="text-blue-600 dark:text-blue-400 text-sm">Lihat status verifikasi booking</p>
                  </button>
                  
                  <button
                    onClick={() => handleMenuChange("history", "payment_status")}
                    className="p-6 bg-purple-100 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-700 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                  >
                    <div className="text-4xl mb-3">💳</div>
                    <h3 className="text-lg font-semibold text-purple-800 dark:text-purple-200">Status Pembayaran</h3>
                    <p className="text-purple-600 dark:text-purple-400 text-sm">Detail pembayaran & outstanding</p>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
