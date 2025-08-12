"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import BranchNavbar from "@/components/branch-navbar"
import AwbForm from "@/components/AwbForm"
import BulkAwbForm from "@/components/BulkAwbForm"
import BangkaAwbForm from "@/components/BangkaAwbForm"
import BangkaBulkAwbForm from "@/components/BangkaBulkAwbForm"
import HistoryManifest from "@/components/HistoryManifest"
import PelunasanResi from "@/components/PelunasanResi"
// REMOVED: BookingVerification - tidak diperlukan lagi
import { FaPlus, FaTruck, FaUser, FaMapMarkerAlt, FaCalendarDay, FaCalendarWeek, FaHistory } from "react-icons/fa"
import DailyReport from "@/components/DailyReport"
import RecapManifest from "@/components/RecapManifest"
import Salesreport from '@/components/Salesreport'
import OutstandingReport from '@/components/OutstandingReport'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Oval as LoadingIcon } from 'react-loading-icons'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import BranchDashboard from "@/components/branchdashboard";
import BranchDebugger from "@/components/BranchDebugger";
import { supabaseClient } from "../../lib/auth"
import type { UserRole, AWBFormData } from "@/types/branch"
import { isValidUserRole, validateBranchAccess } from "@/types/branch"

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

export default function BranchPage() {
  const [selectedMenu, setSelectedMenu] = useState("transaction")
  const [selectedSubMenu, setSelectedSubMenu] = useState("input_resi")
  const [isClient, setIsClient] = useState(false)
  const [showAwbForm, setShowAwbForm] = useState(false)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [branchOrigin, setBranchOrigin] = useState<string | null>(null)
  const [showBulkForm, setShowBulkForm] = useState(false)
  const [selectedAwb, setSelectedAwb] = useState<AWBFormData | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setIsClient(true);
    // Check auth immediately on mount
    (async () => {
      try {
        const { data } = await supabaseClient.auth.getSession();
        if (!data.session) {
          router.push("/branch/login");
        }
      } catch (error) {
        router.push("/branch/login");
      }
    })();
    // Defer user role fetch to next tick to avoid blocking initial paint
    setTimeout(() => {
      (async () => {
        try {
          const { data: { user } } = await supabaseClient.auth.getUser();
          if (user) {
            const { data: userData } = await supabaseClient
              .from("users")
              .select("role, origin_branch")
              .eq("id", user.id)
              .single();
            if (userData) {
              const role = userData.role as string;
              if (isValidUserRole(role)) {
                setUserRole(role);
                setBranchOrigin(userData.origin_branch as string);
              } else {
                console.warn('Invalid user role:', role);
              }
            }
          }
        } catch {
          // Silent error - will fallback to default behavior
        }
      })();
    }, 0);
  }, [router]);

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

  const handleSuccess = () => {
    setSelectedAwb(null)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setSelectedAwb(null)
    setIsEditing(false)
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
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8 mt-16">
        {/* Render components based on selectedSubMenu */}
        {selectedMenu === "transaction" && (
          <>
            {selectedSubMenu === "input_resi" && (
              showAwbForm ? (
                branchOrigin === "bangka" ? (
                  <BangkaAwbForm
                    onSuccess={handleSuccess}
                    onCancel={handleCancel}
                    initialData={selectedAwb}
                    isEditing={isEditing}
                    userRole={userRole}
                    branchOrigin={branchOrigin}
                  />
                ) : (
                  <AwbForm 
                    onSuccess={handleSuccess}
                    onCancel={handleCancel}
                    initialData={selectedAwb}
                    isEditing={isEditing}
                    userRole={userRole}
                    branchOrigin={branchOrigin}
                  />
                )
              ) : (
                <BranchDashboard 
                  userRole={userRole}
                  branchOrigin={branchOrigin}
                  onShowAwbForm={setShowAwbForm}
                />
              )
            )}
            {selectedSubMenu === "debug" && userRole === 'admin' && (
              <BranchDebugger />
            )}
            {selectedSubMenu === "search_manifest" && userRole && (
              <HistoryManifest mode="pelunasan" 
                userRole={userRole as 'admin' | 'cabang' | 'couriers' | 'branch'}
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
            {/* REMOVED: booking_verification - tidak diperlukan lagi */}
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
        {/* Hanya tampilkan form bulk jika tombol di dashboard diklik */}
        {showBulkForm && selectedMenu === "transaction" && selectedSubMenu === "input_resi" && (
          branchOrigin === "bangka" ? (
            <BangkaBulkAwbForm
              onSuccess={handleSuccess}
              onCancel={handleCancel}
              userRole={userRole}
              branchOrigin={branchOrigin}
            />
          ) : (
            <BulkAwbForm
              onSuccess={handleSuccess}
              onCancel={handleCancel}
              userRole={userRole}
              branchOrigin={branchOrigin}
            />
          )
        )}
      </div>
    </div>
  )
}
