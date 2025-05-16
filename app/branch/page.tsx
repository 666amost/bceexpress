"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import BranchNavbar from "@/components/branch-navbar"
import AwbForm from "@/components/AwbForm"
import HistoryManifest from "@/components/HistoryManifest"
import PelunasanResi from "@/components/PelunasanResi"
import { FaPlus } from "react-icons/fa"
import DailyReport from "@/components/DailyReport"
import RecapManifest from "@/components/RecapManifest"
import Salesreport from '@/components/Salesreport'
import OutstandingReport from '@/components/OutstandingReport'

export default function BranchPage() {
  const [selectedMenu, setSelectedMenu] = useState("transaction")
  const [selectedSubMenu, setSelectedSubMenu] = useState("input_resi")
  const [isClient, setIsClient] = useState(false)
  const [showAwbForm, setShowAwbForm] = useState(false)
  const [userRole, setUserRole] = useState(null)
  const router = useRouter()

  useEffect(() => {
    setIsClient(true)
    checkAuth()
    const fetchUserRole = async () => {
      try {
        const { supabaseClient } = await import("@/lib/auth")
        const { data: { user } } = await supabaseClient.auth.getUser()
        if (user) {
          const { data: userData } = await supabaseClient.from('users').select('role').eq('id', user.id).single()
          if (userData) {
            setUserRole(userData.role)
          }
        }
      } catch (error) {
        console.error("Error fetching user role:", error)
      }
    }
    fetchUserRole()
  }, [])

  const checkAuth = async () => {
    try {
      const { supabaseClient } = await import("@/lib/auth")
      const { data } = await supabaseClient.auth.getSession()
      if (!data.session) {
        router.push("/branch/login")
      }
    } catch (error) {
      router.push("/branch/login")
    }
  }

  const handleMenuChange = (menu: string, submenu?: string) => {
    setSelectedMenu(menu)
    if (submenu) {
      setSelectedSubMenu(submenu)
    } else {
      // Set default submenu for each main menu
      if (menu === "transaction") {
        setSelectedSubMenu("input_resi")
      } else if (menu === "report") {
        setSelectedSubMenu("daily_report")
      }
    }
  }

  if (!isClient) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <BranchNavbar selectedMenu={selectedMenu} selectedSubMenu={selectedSubMenu} onMenuChange={handleMenuChange} />
      <div className="pt-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {selectedMenu === "transaction" && (
          <>
            {selectedSubMenu === "input_resi" &&
              (showAwbForm ? (
                <AwbForm 
                  onSuccess={() => setShowAwbForm(false)} 
                  onCancel={() => setShowAwbForm(false)} 
                  initialData={null}
                  isEditing={false}
                />
              ) : (
                <>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-white bg-blue-600 px-4 py-2 rounded">Input Resi</h2>
                    <button
                      className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700"
                      onClick={() => setShowAwbForm(true)}
                    >
                      <FaPlus /> Tambahkan
                    </button>
                  </div>
                  <AwbForm 
                    onSuccess={() => setShowAwbForm(false)} 
                    onCancel={() => setShowAwbForm(false)} 
                    initialData={null} 
                    isEditing={false} />
                </>
              ))}
            {selectedSubMenu === "search_manifest" && (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-white bg-blue-600 px-4 py-2 rounded">Search Manifest</h2>
                </div>
                <HistoryManifest mode="pelunasan" />
              </>
            )}
            {selectedSubMenu === "pelunasan" && (
              userRole === 'admin' || userRole === 'branch' ? (
                <PelunasanResi />
              ) : (
                <div className="p-4 text-center text-red-500">Anda tidak memiliki akses ke bagian ini. Hanya untuk admin atau branch.</div>
              )
            )}
          </>
        )}
        {selectedMenu === "report" && (
          userRole === 'admin' || userRole === 'branch' ? (
            <div className="py-6">
              {selectedSubMenu === "daily_report" && <DailyReport />}
              {selectedSubMenu === "recap" && <RecapManifest />}
              {selectedSubMenu === "outstanding" && <OutstandingReport />}
              {selectedSubMenu === "sale" && <Salesreport />}
            </div>
          ) : (
            <div className="p-4 text-center text-red-500">Anda tidak memiliki akses ke bagian ini. Hanya untuk admin atau branch.</div>
          )
        )}
      </div>
    </div>
  )
}
