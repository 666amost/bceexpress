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
  const [dashboardStats, setDashboardStats] = useState({ totalAWB: 0, totalAgents: 0, totalWilayah: 0 })
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
    
    const fetchDashboardStats = async () => {
      try {
        const { supabaseClient } = await import("@/lib/auth")
        const { data: manifestData, error } = await supabaseClient.from('manifest').select('awb_no, agent_customer, wilayah')
        
        if (error) {
          console.error("Error fetching stats:", error)
          return
        }
        
        if (manifestData) {
          const uniqueAWB = [...new Set(manifestData.map(item => item.awb_no).filter(Boolean))].length
          const uniqueAgents = [...new Set(manifestData.map(item => item.agent_customer).filter(Boolean))].length
          const uniqueWilayah = [...new Set(manifestData.map(item => item.wilayah).filter(Boolean))].length
          
          setDashboardStats({
            totalAWB: uniqueAWB,
            totalAgents: uniqueAgents,
            totalWilayah: uniqueWilayah,
          })
        }
      } catch (err) {
        console.error("Unexpected error fetching stats:", err)
      }
    }
    
    fetchDashboardStats()
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
        {selectedMenu === "transaction" && selectedSubMenu === "input_resi" && !showAwbForm && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-blue-100 p-6 rounded-lg shadow">
              <h3 className="text-lg font-bold text-blue-800">Total AWB</h3>
              <p className="text-2xl font-bold">{dashboardStats.totalAWB}</p>
            </div>
            <div className="bg-green-100 p-6 rounded-lg shadow">
              <h3 className="text-lg font-bold text-green-800">Total Agent</h3>
              <p className="text-2xl font-bold">{dashboardStats.totalAgents}</p>
            </div>
            <div className="bg-yellow-100 p-6 rounded-lg shadow">
              <h3 className="text-lg font-bold text-yellow-800">Total Wilayah</h3>
              <p className="text-2xl font-bold">{dashboardStats.totalWilayah}</p>
            </div>
          </div>
        )}
        
        {selectedMenu === "transaction" && (
          <>
            {selectedSubMenu === "input_resi" && showAwbForm && (
              <AwbForm 
                onSuccess={() => setShowAwbForm(false)} 
                onCancel={() => setShowAwbForm(false)} 
                initialData={null}
                isEditing={false}
              />
            )}
            {selectedSubMenu === "input_resi" && !showAwbForm && (
              <div className="flex justify-end items-center mb-4">
                <button
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700"
                  onClick={() => setShowAwbForm(true)}
                >
                  <FaPlus /> Tambahkan
                </button>
              </div>
            )}
            {selectedSubMenu === "search_manifest" && (
              <HistoryManifest mode="pelunasan" />
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
