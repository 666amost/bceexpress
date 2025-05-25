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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Oval as LoadingIcon } from 'react-loading-icons'

export default function BranchPage() {
  const [selectedMenu, setSelectedMenu] = useState("transaction")
  const [selectedSubMenu, setSelectedSubMenu] = useState("input_resi")
  const [isClient, setIsClient] = useState(false)
  const [showAwbForm, setShowAwbForm] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [branchOrigin, setBranchOrigin] = useState<string | null>(null)
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
          const { data: userData } = await supabaseClient.from('users').select('role, origin_branch').eq('id', user.id).single()
          if (userData) {
            setUserRole(userData.role)
            setBranchOrigin(userData.origin_branch)
          }
        }
      } catch (error) {
        // Silent error - will fallback to default behavior
      }
    }
    fetchUserRole()
    
    const fetchDashboardStats = async () => {
      try {
        const { supabaseClient } = await import("@/lib/auth")
        
        // First get user role to determine which table to query
        const { data: { user } } = await supabaseClient.auth.getUser()
        if (!user) return
        
        const { data: userData } = await supabaseClient.from('users').select('role, origin_branch').eq('id', user.id).single()
        if (!userData) return
        
        // Determine table based on user role
        const isUserBranch = userData.role === 'cabang'
        const targetTable = isUserBranch ? 'manifest_cabang' : 'manifest'
        
        let query = supabaseClient.from(targetTable).select('awb_no, agent_customer, wilayah')
        
        // For branch users, filter by their branch origin
        if (isUserBranch && userData.origin_branch) {
          query = query.eq('origin_branch', userData.origin_branch)
        }
        
        const { data: manifestData, error } = await query
        
        if (error) {
          return
        }
        
        if (manifestData) {
          const uniqueAWB = Array.from(new Set(manifestData.map(item => item.awb_no).filter(Boolean))).length
          const uniqueAgents = Array.from(new Set(manifestData.map(item => item.agent_customer).filter(Boolean))).length
          const uniqueWilayah = Array.from(new Set(manifestData.map(item => item.wilayah).filter(Boolean))).length
          
          setDashboardStats({
            totalAWB: uniqueAWB,
            totalAgents: uniqueAgents,
            totalWilayah: uniqueWilayah,
          })
        }
      } catch (err) {
        // Silent error - dashboard stats are not critical
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
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-white dark:from-black dark:to-gray-900 flex justify-center items-center">
        <div className="text-center">
          <LoadingIcon className="h-16 w-16 animate-spin mx-auto mb-4" style={{ color: '#4a5568', fontWeight: 'bold' }} />
          <p className="text-gray-600 dark:text-gray-400 font-semibold animate-pulse">Loading Branch Dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-white dark:from-black dark:to-gray-900">
      <BranchNavbar selectedMenu={selectedMenu} selectedSubMenu={selectedSubMenu} onMenuChange={handleMenuChange} />
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {selectedMenu === "transaction" && selectedSubMenu === "input_resi" && !showAwbForm && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6 text-center hover:shadow-xl transition-all duration-300 hover:scale-105">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold text-blue-800 dark:text-blue-200">Total AWB</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{dashboardStats.totalAWB}</p>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6 text-center hover:shadow-xl transition-all duration-300 hover:scale-105">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold text-green-800 dark:text-green-200">Total Agent</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{dashboardStats.totalAgents}</p>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6 text-center hover:shadow-xl transition-all duration-300 hover:scale-105">
               <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold text-yellow-800 dark:text-yellow-200">Total Wilayah</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{dashboardStats.totalWilayah}</p>
              </CardContent>
            </Card>
          </div>
        )}
        
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          {selectedMenu === "transaction" && (
            <>
              {selectedSubMenu === "input_resi" && showAwbForm && (
                <AwbForm 
                  onSuccess={() => setShowAwbForm(false)} 
                  onCancel={() => setShowAwbForm(false)} 
                  initialData={null}
                  isEditing={false}
                  userRole={userRole}
                  branchOrigin={branchOrigin}
                />
              )}
              {selectedSubMenu === "input_resi" && !showAwbForm && (
                <div className="flex justify-end items-center mb-4">
                  <Button
                    className="flex items-center gap-2 bg-blue-600 dark:bg-blue-700 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors"
                    onClick={() => setShowAwbForm(true)}
                  >
                    <FaPlus /> Tambahkan
                  </Button>
                </div>
              )}
              {selectedSubMenu === "search_manifest" && userRole && (
                <HistoryManifest mode="pelunasan" 
                  userRole={userRole}
                  branchOrigin={branchOrigin || ''}
                />
              )}
              {selectedSubMenu === "pelunasan" && userRole && (
                userRole === 'admin' || userRole === 'branch' || userRole === 'cabang' ? (
                  <PelunasanResi 
                    userRole={userRole}
                    branchOrigin={branchOrigin || ''}
                  />
                ) : (
                  <div className="p-4 text-center text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">Anda tidak memiliki akses ke bagian ini. Hanya untuk admin, branch, atau cabang.</div>
                )
              )}
            </>
          )}
          {selectedMenu === "report" && userRole && (
            userRole === 'admin' || userRole === 'branch' || userRole === 'cabang' ? (
              <div className="py-6">
                {selectedSubMenu === "daily_report" && <DailyReport userRole={userRole} branchOrigin={branchOrigin || ''} />}
                {selectedSubMenu === "recap" && <RecapManifest 
                  userRole={userRole}
                  branchOrigin={branchOrigin || ''}
                />}
                {selectedSubMenu === "outstanding" && <OutstandingReport 
                  userRole={userRole}
                  branchOrigin={branchOrigin || ''}
                />}
                {selectedSubMenu === "sale" && <Salesreport 
                  userRole={userRole}
                  branchOrigin={branchOrigin || ''}
                />}
              </div>
            ) : (
              <div className="p-4 text-center text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">Anda tidak memiliki akses ke bagian ini. Hanya untuk admin, branch, atau cabang.</div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
