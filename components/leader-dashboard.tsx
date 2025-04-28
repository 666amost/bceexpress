"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, LogOut, User, Package, CheckCircle, AlertCircle } from "lucide-react"
import { supabaseClient } from "@/lib/auth"
import { CourierShipmentList } from "./courier-shipment-list"

export function LeaderDashboard() {
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [couriers, setCouriers] = useState<any[]>([])
  const [selectedCourier, setSelectedCourier] = useState<string | null>(null)
  const [courierStats, setCourierStats] = useState<
    Record<string, { total: number; completed: number; pending: number }>
  >({})
  const [totalShipments, setTotalShipments] = useState(0)
  const [totalCompleted, setTotalCompleted] = useState(0)
  const [totalPending, setTotalPending] = useState(0)
  const [debugInfo, setDebugInfo] = useState<string>("")

  const router = useRouter()

  useEffect(() => {
    async function loadUserProfile() {
      try {
        const {
          data: { session },
        } = await supabaseClient.auth.getSession()

        if (!session) {
          router.push("/courier")
          return
        }

        const { data: userData, error } = await supabaseClient
          .from("users")
          .select("id, role") // Hanya ambil id dan role untuk verifikasi awal
          .eq("id", session.user.id)
          .single()

        if (error) {
          console.error("Error fetching user profile:", error)
          setIsLoading(false)
          return
        }

        if (userData?.role !== "admin" && userData?.role !== "leader") {
          router.push("/courier/dashboard")
          return
        }

        setUser(userData)
        await loadCouriers()
      } catch (err) {
        console.error("Error loading dashboard:", err)
        setIsLoading(false)
      }
    }

    loadUserProfile()
  }, [router])

  const loadCouriers = async () => {
    setIsLoading(true)
    setDebugInfo("Loading couriers...")
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession()

      // Fetch couriers
      let { data: courierData, error } = await supabaseClient
        .from("users")
        .select("id, name, email, role")
        .eq("role", "couriers")
        .order("name", { ascending: true })

      if (!courierData || courierData.length === 0) {
        const { data: courierDataSingular, error: errorSingular } = await supabaseClient
          .from("users")
          .select("id, name, email, role")
          .eq("role", "courier")
          .order("name", { ascending: true })

        if (courierDataSingular && courierDataSingular.length > 0) {
          courierData = courierDataSingular
          error = errorSingular
        }
      }

      if (!courierData || courierData.length === 0) {
        const { data: allUsers, error: allUsersError } = await supabaseClient
          .from("users")
          .select("id, name, email, role")
          .order("name", { ascending: true })

        if (allUsers) {
          courierData = allUsers.filter(
            (user) =>
              user.role === "courier" || user.role === "couriers" || user.role?.toLowerCase().includes("courier"),
          )
          error = allUsersError
        }
      }

      if (error) {
        console.error("Error fetching couriers:", error)
        setDebugInfo(`Error fetching couriers: ${error.message}`)
        return
      }

      setDebugInfo(`Found ${courierData?.length || 0} couriers`)
      setCouriers(courierData || [])

      const stats: Record<string, { total: number; completed: number; pending: number }> = {}
      let totalShipmentCount = 0
      let totalCompletedCount = 0
      let totalPendingCount = 0

      for (const courier of courierData) {
        setDebugInfo(`Processing courier: ${courier.name}`)

        // Fetch shipment stats for the courier (from 'shipments' table)
        const { data: courierShipments, error: shipmentsError } = await supabaseClient
          .from("shipments")
          .select("awb_number, current_status")
          .eq("courier_id", courier.id)

        if (shipmentsError) {
          console.error(`Error fetching shipments for ${courier.name}:`, shipmentsError)
          continue
        }

        const total = courierShipments?.length || 0
        const completed = courierShipments?.filter((shipment) => shipment.current_status === "delivered").length || 0
        const pending = courierShipments?.filter((shipment) => shipment.current_status !== "delivered").length || 0

        stats[courier.id] = { total, completed, pending }
        totalShipmentCount += total
        totalCompletedCount += completed
        totalPendingCount += pending

        // Fetch latest GPS location for the courier (from 'shipment_history' table)
        const { data: allHistoryData, error: historyError } = await supabaseClient
          .from("shipment_history")
          .select("*, created_at, latitude, longitude")
          .order("created_at", { ascending: false })

        if (historyError) {
          console.error(`Error fetching history for ${courier.name}:`, historyError)
          continue
        }

        const courierUsername = courier.email.split("@")[0]
        const courierHistoryData =
          allHistoryData?.filter(
            (entry) =>
              entry.notes &&
              (entry.notes.toLowerCase().includes(courier.name.toLowerCase()) ||
                entry.notes.toLowerCase().includes(courierUsername.toLowerCase())),
          ) || []

        const latestEntry = courierHistoryData[0]
        courier.latestLatitude = latestEntry?.latitude
        courier.latestLongitude = latestEntry?.longitude

        setDebugInfo(
          `Courier ${courier.name}: ${total} total, ${completed} completed, ${pending} pending, Lat: ${courier.latestLatitude}, Lon: ${courier.latestLongitude}`,
        )
      }

      setCourierStats(stats)
      setTotalShipments(totalShipmentCount)
      setTotalCompleted(totalCompletedCount)
      setTotalPending(totalPendingCount)
      setCouriers(courierData.map((courier) => ({ ...courier }))) // Ensure couriers state is updated with new properties
    } catch (err) {
      console.error("Error loading couriers:", err)
      setDebugInfo(`Error loading couriers: ${err}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await supabaseClient.auth.signOut()
      router.push("/courier")
    } catch (err) {
      console.error("Error signing out:", err)
    }
  }

  const handleRefresh = () => {
    setIsLoading(true)
    loadCouriers()
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Leader Dashboard</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh}>
            Refresh Data
          </Button>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" /> Logout
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
        <div className="bg-blue-50/70 dark:bg-blue-900/40 rounded-xl shadow-lg p-8 flex flex-col gap-2 items-center">
          <User className="h-8 w-8 text-blue-500 mb-2" />
          <span className="text-lg font-semibold text-zinc-700 dark:text-zinc-200">Total Couriers</span>
          <span className="text-4xl font-extrabold text-zinc-900 dark:text-white">{couriers.length}</span>
            </div>
        <div className="bg-orange-50/70 dark:bg-orange-900/40 rounded-xl shadow-lg p-8 flex flex-col gap-2 items-center">
          <Package className="h-8 w-8 text-orange-500 mb-2" />
          <span className="text-lg font-semibold text-zinc-700 dark:text-zinc-200">Total Shipments</span>
          <span className="text-4xl font-extrabold text-zinc-900 dark:text-white">{totalShipments}</span>
            </div>
        <div className="bg-yellow-50/70 dark:bg-yellow-900/40 rounded-xl shadow-lg p-8 flex flex-col gap-2 items-center">
          <AlertCircle className="h-8 w-8 text-yellow-500 mb-2" />
          <span className="text-lg font-semibold text-zinc-700 dark:text-zinc-200">Pending Deliveries</span>
          <span className="text-4xl font-extrabold text-zinc-900 dark:text-white">{totalPending}</span>
            </div>
        <div className="bg-green-50/70 dark:bg-green-900/40 rounded-xl shadow-lg p-8 flex flex-col gap-2 items-center">
          <CheckCircle className="h-8 w-8 text-green-500 mb-2" />
          <span className="text-lg font-semibold text-zinc-700 dark:text-zinc-200">Completed Deliveries</span>
          <span className="text-4xl font-extrabold text-zinc-900 dark:text-white">{totalCompleted}</span>
            </div>
      </div>

      {/* Courier Performance */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-8 mb-10">
          <Tabs defaultValue="couriers" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="couriers">Couriers</TabsTrigger>
              <TabsTrigger value="shipments">Shipments</TabsTrigger>
            </TabsList>

            <TabsContent value="couriers">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {couriers.map((courier) => (
                <div
                    key={courier.id}
                  className={`bg-zinc-50 dark:bg-zinc-800 rounded-xl shadow p-6 flex flex-col gap-2 transition hover:shadow-2xl cursor-pointer border border-transparent hover:border-blue-400 ${selectedCourier === courier.id ? "border-blue-500 bg-blue-50/60 dark:bg-blue-900/30" : ""}`}
                    onClick={() => setSelectedCourier(courier.id)}
                  >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <User className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                      <h3 className="font-medium text-lg text-zinc-800 dark:text-zinc-100">{courier.name}</h3>
                      <p className="text-xs text-zinc-400">{courier.email}</p>
                        </div>
                      </div>
                  <div className="flex gap-4 mt-2">
                    <div className="flex flex-col items-center">
                      <Package className="h-4 w-4 text-blue-500" />
                      <span className="text-2xl font-bold">{courierStats[courier.id]?.total || 0}</span>
                      <span className="text-xs text-zinc-400">Total</span>
                        </div>
                    <div className="flex flex-col items-center">
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                      <span className="text-2xl font-bold">{courierStats[courier.id]?.pending || 0}</span>
                      <span className="text-xs text-zinc-400">Pending</span>
                        </div>
                    <div className="flex flex-col items-center">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-2xl font-bold">{courierStats[courier.id]?.completed || 0}</span>
                      <span className="text-xs text-zinc-400">Completed</span>
                        </div>
                      </div>
                      {courier.latestLatitude && courier.latestLongitude && (
                    <div className="mt-3">
                      <p className="text-xs text-zinc-400">Last Location:</p>
                            <a
                              href={`https://www.google.com/maps/place/${courier.latestLatitude},${courier.latestLongitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                            >
                              {courier.latestLatitude?.toFixed(6)}, {courier.latestLongitude?.toFixed(6)}
                            </a>
                        </div>
                      )}
                </div>
                ))}
                {couriers.length === 0 && (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    No couriers found. Please check your database.
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="shipments">
              {selectedCourier ? (
                <CourierShipmentList courierId={selectedCourier} />
              ) : (
                <div className="text-center py-8 text-muted-foreground">Select a courier to view their shipments</div>
              )}
            </TabsContent>
          </Tabs>
      </div>

      {/* Debug info - remove in production */}
      {debugInfo && (
        <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-md text-xs font-mono">
          <p className="font-bold mb-2">Debug Info:</p>
          <pre>{debugInfo}</pre>
        </div>
      )}
    </div>
  )
}
