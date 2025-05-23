"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner, faSignOutAlt, faUser, faBox, faCheckCircle, faExclamationCircle } from '@fortawesome/free-solid-svg-icons'
import { supabaseClient } from "@/lib/auth"
import { Input } from "@/components/ui/input"
import dynamic from 'next/dynamic'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ThemeToggle } from "@/components/theme-toggle"

const CourierShipmentList = dynamic(() => import('./courier-shipment-list').then(mod => mod.CourierShipmentList), { ssr: false, loading: () => <div>Loading shipments...</div> })

export function LeaderDashboard() {
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [couriers, setCouriers] = useState<any[]>([])
  const [selectedCourier, setSelectedCourier] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("couriers")
  const [courierStats, setCourierStats] = useState<
    Record<string, { total: number; completed: number; pending: number }>
  >({})
  const [totalShipments, setTotalShipments] = useState(0)
  const [totalCompleted, setTotalCompleted] = useState(0)
  const [totalPending, setTotalPending] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any>(null)
  const [isPendingModalOpen, setIsPendingModalOpen] = useState(false)
  const [pendingShipments, setPendingShipments] = useState<any[]>([])
  const [dataRange, setDataRange] = useState(1) // Default to 1 day for faster loading

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
          .select("id, role")
          .eq("id", session.user.id)
          .single()

        if (error) {
          setIsLoading(false)
          return
        }

        if (userData?.role !== "admin" && userData?.role !== "leader") {
          router.push("/courier/dashboard")
          return
        }

        setUser(userData)
        await loadDashboardData()
      } catch (err) {
        setIsLoading(false)
      }
    }

    loadUserProfile()
  }, [router])

  // Fixed date range function with proper UTC handling
  const getDateRange = (days: number) => {
    const now = new Date()
    
    // Create end date (end of today in UTC)
    const endDate = new Date(Date.UTC(
      now.getFullYear(), 
      now.getMonth(), 
      now.getDate(), 
      23, 59, 59, 999
    ))
    
    // Create start date (start of X days ago in UTC)
    const startDate = new Date(Date.UTC(
      now.getFullYear(), 
      now.getMonth(), 
      now.getDate() - (days - 1),
      0, 0, 0, 0
    ))
    
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    }
  }

  const loadDashboardData = async (daysToLoad?: number) => {
    setIsLoading(true)
    
    // Use parameter if provided, otherwise use state
    const currentRange = daysToLoad !== undefined ? daysToLoad : dataRange
    
    try {
      // Get consistent date range
      const { startDate, endDate } = getDateRange(currentRange)

      // Load couriers first (small dataset)
      const { data: courierData, error: courierError } = await supabaseClient
        .from("users")
        .select("id, name, email, role")
        .or("role.eq.courier,role.eq.couriers")
        .order("name", { ascending: true })

      if (courierError || !courierData) {
        setIsLoading(false)
        return
      }

      // Get shipments within date range with consistent filtering
      const { data: recentShipments, error: shipmentsError } = await supabaseClient
        .from("shipments")
        .select("awb_number, current_status, courier_id, created_at")
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .order("created_at", { ascending: false })

      if (shipmentsError) {
        setIsLoading(false)
        return
      }

      const shipmentsData = recentShipments || []

      // Get total counts with SAME date filtering
      const [totalCountResult, completedCountResult] = await Promise.all([
        // Total shipments count with same date filter
        supabaseClient
          .from("shipments")
          .select("*", { count: 'exact', head: true })
          .gte("created_at", startDate)
          .lte("created_at", endDate),
        
        // Completed shipments count with same date filter
        supabaseClient
          .from("shipments")
          .select("*", { count: 'exact', head: true })
          .eq("current_status", "delivered")
          .gte("created_at", startDate)
          .lte("created_at", endDate)
      ])

      // Process shipment stats efficiently
      const stats: Record<string, { total: number; completed: number; pending: number }> = {}
      const allPendingShipments: any[] = []
      let totalShipmentCount = totalCountResult.count || 0
      let totalCompletedCount = completedCountResult.count || 0
      let totalPendingCount = 0

      // Group shipments by courier_id for efficient processing
      const shipmentsByCourier = shipmentsData.reduce((acc, shipment) => {
        if (!acc[shipment.courier_id]) {
          acc[shipment.courier_id] = []
        }
        acc[shipment.courier_id].push(shipment)
        return acc
      }, {} as Record<string, any[]>)

      // Calculate stats for each courier
      courierData.forEach((courier) => {
        const courierShipments = shipmentsByCourier[courier.id] || []
        const total = courierShipments.length
        const completed = courierShipments.filter((s) => s.current_status === "delivered").length
        const pendingShipmentsList = courierShipments.filter((s) => s.current_status !== "delivered")
        const pending = pendingShipmentsList.length

        stats[courier.id] = { total, completed, pending }
        totalPendingCount += pending

        // Add to pending shipments with courier info (limit to 50 for modal)
        allPendingShipments.push(...pendingShipmentsList.slice(0, 50).map(shipment => ({ 
          ...shipment, 
          courierId: courier.id 
        })))
      })

      // Get latest locations with same date filtering
      const { data: latestLocations } = await supabaseClient
        .from("shipment_history")
        .select("notes, latitude, longitude, created_at")
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .order("created_at", { ascending: false })
        .limit(50)

      // Match locations to couriers efficiently
      const couriersWithLocations = courierData.map((courier) => {
        const courierUsername = courier.email.split("@")[0]
        const locationEntry = latestLocations?.find((entry: any) =>
          entry.notes &&
          (entry.notes.toLowerCase().includes(courier.name.toLowerCase()) ||
            entry.notes.toLowerCase().includes(courierUsername.toLowerCase()))
        )
        
        return {
          ...courier,
          latestLatitude: locationEntry?.latitude || null,
          latestLongitude: locationEntry?.longitude || null
        }
      })

      // Update state
      setCouriers(couriersWithLocations)
      setCourierStats(stats)
      setTotalShipments(totalShipmentCount)
      setTotalCompleted(totalCompletedCount)
      setTotalPending(totalPendingCount)
      setPendingShipments(allPendingShipments.slice(0, 100))

    } catch (err) {
      // Handle error silently
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await supabaseClient.auth.signOut()
      router.push("/admin")
    } catch (err) {
      // Handle error
    }
  }

  const handleRefresh = () => {
    setIsLoading(true)
    loadDashboardData()
  }

  const handleRangeChange = (days: number) => {
    setDataRange(days)
    setIsLoading(true)
    // Pass days directly to avoid state race condition
    loadDashboardData(days)
  }

  const handleSearch = async () => {
    if (searchQuery.trim()) {
      const { data, error } = await supabaseClient.from('shipments').select('*').eq('awb_number', searchQuery).single();
      if (error) {
        setSearchResults({ error: 'Shipment not found' });
      } else {
        const courierData = await supabaseClient.from('users').select('name').eq('id', data.courier_id).single();
        setSearchResults({ ...data, courier: courierData.data ? courierData.data.name : 'Unknown' });
      }
    }
  };

  async function deleteShipmentHistory(awbNumber: string) {
    const { data, error } = await supabaseClient.from('shipment_history').delete().eq('awb_number', awbNumber);
    if (error) {
      alert(`Deletion from history failed: ${error.message || 'Unknown error'}`);
    } else {
      return true;
    }
    return false;
  }

  const handleDeleteShipment = async (awbNumber: string) => {
    if (window.confirm('Are you sure you want to delete this shipment?')) {
      try {
        const historyDeleted = await deleteShipmentHistory(awbNumber);
        if (historyDeleted) {
          const { error } = await supabaseClient.from('shipments').delete().eq('awb_number', awbNumber);
          if (error) {
            alert(`Deletion failed: ${error.message || 'Unknown error'}`);
          } else {
            await loadDashboardData();
          }
        }
      } catch (err) {
        alert('An unexpected error occurred during deletion.');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <FontAwesomeIcon icon={faSpinner} className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Robert Dashboard</h1>
        <div className="flex flex-wrap gap-4 justify-center md:justify-end items-center">
          <div className="flex flex-wrap gap-2">
            {[1, 3, 7, 14, 30].map((days) => (
              <Button 
                key={days}
                variant={dataRange === days ? "default" : "outline"}
                size="sm"
                onClick={() => handleRangeChange(days)}
              >
                {days}d
              </Button>
            ))}
          </div>
          <Button variant="outline" onClick={handleRefresh}>
            Refresh Data
          </Button>
          <Button variant="outline" onClick={handleLogout}>
            <FontAwesomeIcon icon={faSignOutAlt} className="h-4 w-4 mr-2" /> Logout
          </Button>
          <ThemeToggle className="ml-4" />
        </div>
      </div>

      {/* Data Range Info */}
      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          📊 Showing data from last <strong>{dataRange} day{dataRange > 1 ? 's' : ''}</strong> for optimal performance.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
        <div className="bg-blue-50/70 dark:bg-blue-900/40 rounded-xl shadow-lg p-8 flex flex-col gap-2 items-center">
          <FontAwesomeIcon icon={faUser} className="h-8 w-8 text-blue-500 mb-2" />
          <span className="text-lg font-semibold text-zinc-700 dark:text-zinc-200">Total Couriers</span>
          <span className="text-4xl font-extrabold text-zinc-900 dark:text-white">{couriers.length}</span>
        </div>
        <div className="bg-orange-50/70 dark:bg-orange-900/40 rounded-xl shadow-lg p-8 flex flex-col gap-2 items-center">
          <FontAwesomeIcon icon={faBox} className="h-8 w-8 text-orange-500 mb-2" />
          <span className="text-lg font-semibold text-zinc-700 dark:text-zinc-200">
            {dataRange === 1 ? "Today's Shipments" : "Recent Shipments"}
          </span>
          <span className="text-4xl font-extrabold text-zinc-900 dark:text-white">{totalShipments}</span>
          <span className="text-xs text-zinc-500">({dataRange} day{dataRange > 1 ? 's' : ''})</span>
        </div>
        <div className="bg-yellow-50/70 dark:bg-yellow-900/40 rounded-xl shadow-lg p-8 flex flex-col gap-2 items-center">
          <FontAwesomeIcon icon={faExclamationCircle} className="h-8 w-8 text-yellow-500 mb-2" />
          <span className="text-lg font-semibold text-zinc-700 dark:text-zinc-200">Pending Deliveries</span>
          <span className="text-4xl font-extrabold text-zinc-900 dark:text-white">{totalPending}</span>
          <Button onClick={() => setIsPendingModalOpen(true)} variant="link" size="sm">(view top 100)</Button>
        </div>
        <div className="bg-green-50/70 dark:bg-green-900/40 rounded-xl shadow-lg p-8 flex flex-col gap-2 items-center">
          <FontAwesomeIcon icon={faCheckCircle} className="h-8 w-8 text-green-500 mb-2" />
          <span className="text-lg font-semibold text-zinc-700 dark:text-zinc-200">
            {dataRange === 1 ? "Today's Completed" : "Completed Deliveries"}
          </span>
          <span className="text-4xl font-extrabold text-zinc-900 dark:text-white">{totalCompleted}</span>
          <span className="text-xs text-zinc-500">({dataRange} day{dataRange > 1 ? 's' : ''})</span>
        </div>
      </div>

      {/* Courier Performance */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-8 mb-10">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="couriers">Couriers</TabsTrigger>
            <TabsTrigger value="shipments">Shipments</TabsTrigger>
            <TabsTrigger value="search">Search</TabsTrigger>
          </TabsList>

          <TabsContent value="couriers">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {couriers.map((courier) => (
                <div
                  key={courier.id}
                  className={`bg-zinc-50 dark:bg-zinc-800 rounded-xl shadow p-6 flex flex-col gap-2 transition hover:shadow-2xl cursor-pointer border border-transparent hover:border-blue-400 ${selectedCourier === courier.id ? "border-blue-500 bg-blue-50/60 dark:bg-blue-900/30" : ""}`}
                  onClick={() => setSelectedCourier(courier.id)}
                  onDoubleClick={() => {
                    setSelectedCourier(courier.id);
                    setActiveTab("shipments");
                  }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <FontAwesomeIcon icon={faUser} className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="font-medium text-lg text-zinc-800 dark:text-zinc-100">{courier.name}</h3>
                      <p className="text-xs text-zinc-400">{courier.email}</p>
                    </div>
                  </div>
                  <div className="flex gap-4 mt-2">
                    <div className="flex flex-col items-center">
                      <FontAwesomeIcon icon={faBox} className="h-4 w-4 text-blue-500" />
                      <span className="text-2xl font-bold">{courierStats[courier.id]?.total || 0}</span>
                      <span className="text-xs text-zinc-400">Total</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <FontAwesomeIcon icon={faExclamationCircle} className="h-4 w-4 text-yellow-500" />
                      <span className="text-2xl font-bold">{courierStats[courier.id]?.pending || 0}</span>
                      <span className="text-xs text-zinc-400">Pending</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <FontAwesomeIcon icon={faCheckCircle} className="h-4 w-4 text-green-500" />
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

          <TabsContent value="search">
            <div className="mb-4 flex gap-2">
              <Input placeholder="Cari nomor resi (AWB)" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              <Button onClick={handleSearch}>Cari</Button>
            </div>
            {searchResults ? (
              <Card>
                <CardHeader>
                  <CardTitle>Hasil Pencarian</CardTitle>
                </CardHeader>
                <CardContent>
                  {searchResults.error ? (
                    <p>{searchResults.error}</p>
                  ) : (
                    <div>
                      <p><strong>Nomor Resi:</strong> {searchResults.awb_number}</p>
                      <p><strong>Kurir:</strong> {searchResults.courier}</p>
                      <Button onClick={() => handleDeleteShipment(searchResults.awb_number)} className="mt-2 bg-red-500">
                        Delete Shipment
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <p>Masukkan nomor resi untuk mencari.</p>
            )}
          </TabsContent>
        </Tabs>
      </div>

    <Dialog open={isPendingModalOpen} onOpenChange={setIsPendingModalOpen}>
      <DialogContent className="max-w-md sm:max-w-lg md:max-w-xl">
        <DialogHeader>
          <DialogTitle>Pending Deliveries (Top 100)</DialogTitle>
        </DialogHeader>
        <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
          <table className="min-w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-1/2">AWB Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-1/2">Courier</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {pendingShipments.map((shipment) => (
                <tr key={shipment.awb_number} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition duration-200">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 truncate">
                    {shipment.awb_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 truncate">
                    {couriers.find(c => c.id === shipment.courierId)?.name || 'Unknown'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  </div>
)
}
