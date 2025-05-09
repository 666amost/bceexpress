"use client"
// This is a new file for the branch dashboard
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import AwbForm from "@/components/AwbForm"
import HistoryManifest from "@/components/HistoryManifest"
import { FaPlus } from "react-icons/fa"
import PelunasanResi from "@/components/PelunasanResi"
import BranchNavbar from "@/components/branch-navbar"

// Placeholder komponen untuk menu baru
function DailyReportComponent() {
  return (
    <div className="mt-4 p-4 bg-blue-100 text-blue-900 rounded">
      Fitur Daily Report (Manifest Harian) akan segera hadir.
    </div>
  )
}

function RecapComponent() {
  return <div className="mt-4 p-4 bg-blue-100 text-blue-900 rounded">Fitur Recap akan segera hadir.</div>
}

function OutstandingReportComponent() {
  return <div className="mt-4 p-4 bg-blue-100 text-blue-900 rounded">Fitur Outstanding Report akan segera hadir.</div>
}

// Placeholder komponen pelunasan dan payment jika belum ada
function PelunasanTable() {
  return <HistoryManifest mode="pelunasan" />
}
function PaymentTable() {
  return <div className="mt-4 p-4 bg-blue-100 text-blue-900 rounded">Fitur Data Payment akan segera hadir.</div>
}

// Ubah fungsi BranchDashboard untuk menggunakan BranchNavbar
export default function BranchDashboard() {
  const [selectedMenu, setSelectedMenu] = useState("awb")
  const [selectedSubMenu, setSelectedSubMenu] = useState("input")
  const [userRole, setUserRole] = useState<string | null>(null)
  const [showAwbForm, setShowAwbForm] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const checkAccess = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await import("@/lib/auth").then((m) => m.supabaseClient.auth.getSession())
      if (sessionError || !session || !session.user) {
        router.push("/branch/login")
        return
      }
      const userId = session.user.id
      const { data: userData, error: queryError } = await import("@/lib/auth").then((m) =>
        m.supabaseClient.from("users").select("role").eq("id", userId).single(),
      )
      if (queryError) {
        setUserRole("Error: " + queryError.message)
      } else if (userData && userData.role === "branch") {
        setUserRole(userData.role)
      } else {
        setUserRole(userData ? userData.role : "Tidak ditemukan")
        router.push("/branch/login")
      }
    }
    checkAccess()
  }, [router])

  if (userRole !== "branch") {
    return <div>Anda tidak memiliki akses ke halaman ini. Role Anda: {userRole}. Silakan periksa role di Supabase.</div>
  }

  // Fungsi untuk menangani perubahan menu
  const handleMenuChange = (menu: string, submenu?: string) => {
    setSelectedMenu(menu)
    if (submenu) {
      setSelectedSubMenu(submenu)
    } else if (menu === "awb") {
      setSelectedSubMenu("input")
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      {/* Navbar dengan menu dropdown */}
      <BranchNavbar selectedMenu={selectedMenu} selectedSubMenu={selectedSubMenu} onMenuChange={handleMenuChange} />

      {/* Main content */}
      <main className="flex-1 p-4 md:p-8 pt-24 w-full">
        <div className="bg-white rounded-xl shadow-xl p-8 w-full">
          {selectedSubMenu === "input_resi" && (
            <AwbForm onSuccess={() => setShowAwbForm(false)} onCancel={() => setShowAwbForm(false)} />
          )}
          {selectedSubMenu === "search_manifest" && (
            <HistoryManifest mode="pelunasan" /> // Render with edit features
          )}
          {selectedSubMenu === "pelunasan" && (
            <PelunasanResi /> // Render with filters
          )}
          {selectedMenu === "awb" &&
            selectedSubMenu === "input" &&
            (showAwbForm ? (
              <AwbForm onSuccess={() => setShowAwbForm(false)} onCancel={() => setShowAwbForm(false)} />
            ) : (
              <>
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-xl font-bold text-white bg-blue-600 px-4 py-2 rounded">History Manifest</h2>
                  <button
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700"
                    onClick={() => setShowAwbForm(true)}
                  >
                    <FaPlus /> Tambahkan
                  </button>
                </div>
                <HistoryManifest mode="" />
              </>
            ))}
          {selectedMenu === "awb" && selectedSubMenu === "pelunasan" && <PelunasanTable />}
          {selectedMenu === "payment" && <PaymentTable />}
          {selectedMenu === "daily_report" && <DailyReportComponent />}
          {selectedMenu === "recap" && <RecapComponent />}
          {selectedMenu === "outstanding" && <OutstandingReportComponent />}
        </div>
      </main>
    </div>
  )
}
