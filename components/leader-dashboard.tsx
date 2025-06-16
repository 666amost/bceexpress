"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Logout as LogoutIcon,
  UserMultiple as UserMultipleIcon,
  Package as PackageIcon,
  WarningFilled as WarningIcon,
  CheckmarkFilled as CheckmarkIcon,
  Search as SearchIcon,
  TrashCan as TrashCanIcon,
  Box as BoxIcon,
  Delivery as DeliveryIcon,
  DeliveryParcel as DeliveryParcelIcon,
  Renew as RefreshIcon,
  ChartArea as ChartIcon,
  LocationFilled as LocationPointIcon,
} from '@carbon/icons-react'
import { supabaseClient } from "@/lib/auth"
import { Input } from "@/components/ui/input"
import dynamic from 'next/dynamic'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ThemeToggle } from "@/components/theme-toggle"
import { Oval as LoadingIcon } from 'react-loading-icons'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

const CourierShipmentList = dynamic(() => import('./courier-shipment-list').then(mod => mod.CourierShipmentList), { 
  ssr: false, 
  loading: () => (
    <div className="flex justify-center items-center py-12">
      <div className="text-center">
        <LoadingIcon className="h-12 w-12 animate-spin mx-auto mb-4" style={{ color: '#4a5568', fontWeight: 'bold' }} />
        <p className="text-gray-600 dark:text-gray-400 font-semibold animate-pulse">Loading shipments...</p>
      </div>
    </div>
  )
})

const LeafletMap = dynamic(() => import('./leaflet-map').then(mod => mod.LeafletMap), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center items-center py-12">
      <div className="text-center">
        <LoadingIcon className="h-12 w-12 animate-spin mx-auto mb-4" style={{ color: '#4a5568', fontWeight: 'bold' }} />
        <p className="text-gray-600 dark:text-gray-400 font-semibold animate-pulse">Loading map...</p>
      </div>
    </div>
  )
})

export function LeaderDashboard() {
  const router = useRouter()

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [couriers, setCouriers] = useState<any[]>([])
  const [courierStats, setCourierStats] = useState<Record<string, { total: number; completed: number; pending: number }>>({})
  const [totalShipments, setTotalShipments] = useState(0)
  const [totalCompleted, setTotalCompleted] = useState(0)
  const [totalPending, setTotalPending] = useState(0)
  const [pendingShipments, setPendingShipments] = useState<any[]>([])
  const [dataRange, setDataRange] = useState(1) // Default to 1 day
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[] | { error: string } | null>(null)
  const [activeTab, setActiveTab] = useState("couriers")
  const [selectedCourier, setSelectedCourier] = useState<string | null>(null)
  const [isPendingModalOpen, setIsPendingModalOpen] = useState(false)
  const [isLocationMapOpen, setIsLocationMapOpen] = useState(false) // State for location map modal
  const [mapRefreshKey, setMapRefreshKey] = useState(0) // Key to force map refresh
  const [sortOption, setSortOption] = useState<string>('name') // Default sort by name
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">('asc') // Default sort ascending
  const [lastMapUpdateTime, setLastMapUpdateTime] = useState<string | null>(null); // State for last map update time
  const [hasActiveCouriers, setHasActiveCouriers] = useState<boolean>(false); // State for active couriers status
  const [highPriorityThreshold, setHighPriorityThreshold] = useState(5); // Kurir dengan > 5 pending dianggap prioritas tinggi
  const [prioritySort, setPrioritySort] = useState<boolean>(false); // Auto-sort by priority

  const getDateRange = useCallback((days: number) => {
    const now = new Date()
    
    const endDate = new Date(Date.UTC(
      now.getFullYear(), 
      now.getMonth(), 
      now.getDate(), 
      23, 59, 59, 999
    ))
    
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
  }, []);

  const loadDashboardData = useCallback(async (daysToLoad?: number) => {
    setIsLoading(true)
    
    const currentRange = daysToLoad !== undefined ? daysToLoad : dataRange
    
    try {
      const { startDate, endDate } = getDateRange(currentRange)

      const { data: courierData, error: courierError } = await supabaseClient
        .from("users")
        .select("id, name, email, role")
        .or("role.eq.courier,role.eq.couriers")
        .order("name", { ascending: true })

      if (courierError || !courierData) {
        setIsLoading(false)
        return
      }

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

      const [totalCountResult, completedCountResult] = await Promise.all([
        supabaseClient
          .from("shipments")
          .select("*", { count: 'exact', head: true })
          .gte("created_at", startDate)
          .lte("created_at", endDate),
        
        supabaseClient
          .from("shipments")
          .select("*", { count: 'exact', head: true })
          .eq("current_status", "delivered")
          .gte("created_at", startDate)
          .lte("created_at", endDate)
      ])

      const stats: Record<string, { total: number; completed: number; pending: number }> = {}
      const allPendingShipments: any[] = []
      let totalShipmentCount = totalCountResult.count || 0
      let totalCompletedCount = completedCountResult.count || 0
      let totalPendingCount = 0

      const shipmentsByCourier = shipmentsData.reduce((acc, shipment) => {
        if (!acc[shipment.courier_id]) {
          acc[shipment.courier_id] = []
        }
        acc[shipment.courier_id].push(shipment)
        return acc
      }, {} as Record<string, any[]>)

      courierData.forEach((courier) => {
        const courierShipments = shipmentsByCourier[courier.id] || []
        const total = courierShipments.length
        const completed = courierShipments.filter((s) => s.current_status === "delivered").length
        const pendingShipmentsList = courierShipments.filter((s) => s.current_status !== "delivered")
        const pending = pendingShipmentsList.length

        stats[courier.id] = { total, completed, pending }
        totalPendingCount += pending

        allPendingShipments.push(...pendingShipmentsList.slice(0, 50).map(shipment => ({ 
          ...shipment, 
          courierId: courier.id 
        })))
      })

      const { data: latestLocations } = await supabaseClient
        .from("shipment_history")
        .select("notes, latitude, longitude, created_at, awb_number")
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .order("created_at", { ascending: false })
        .limit(200)

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
          latestLongitude: locationEntry?.longitude || null,
          latestLocationTime: locationEntry?.created_at || null,
          latestAwb: locationEntry?.awb_number || null
        }
      })

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
  }, [dataRange, getDateRange]);

  const sortedCouriers = useMemo(() => {
    const sortableCouriers = [...couriers];
    
    // First sort by priority if enabled
    if (prioritySort) {
      sortableCouriers.sort((a, b) => {
        const pendingA = courierStats[a.id]?.pending || 0;
        const pendingB = courierStats[b.id]?.pending || 0;
        
        // High priority couriers at the top
        if (pendingA > highPriorityThreshold && pendingB <= highPriorityThreshold) return -1;
        if (pendingA <= highPriorityThreshold && pendingB > highPriorityThreshold) return 1;
        
        // Then sort by pending count if both are high priority or both are not
        return pendingB - pendingA;
      });
      
      // Return early if prioritySort is enabled
      return sortableCouriers;
    }
    
    // Otherwise use normal sorting
    sortableCouriers.sort((a, b) => {
      let valA: any;
      let valB: any;

      if (sortOption === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (sortOption === 'total') {
        valA = courierStats[a.id]?.total || 0;
        valB = courierStats[b.id]?.total || 0;
      } else if (sortOption === 'pending') {
        valA = courierStats[a.id]?.pending || 0;
        valB = courierStats[b.id]?.pending || 0;
      } else if (sortOption === 'completed') {
        valA = courierStats[a.id]?.completed || 0;
        valB = courierStats[b.id]?.completed || 0;
      } else if (sortOption === 'lastSeen') {
        valA = a.latestLocationTime ? new Date(a.latestLocationTime).getTime() : 0;
        valB = b.latestLocationTime ? new Date(b.latestLocationTime).getTime() : 0;

        // Handle cases where one or both couriers have no latestLocationTime
        if (valA === 0 && valB === 0) return 0;
        if (valA === 0) return sortOrder === 'asc' ? 1 : -1; // No time means less recent, so put it at the end for asc
        if (valB === 0) return sortOrder === 'asc' ? -1 : 1; // No time means less recent, so put it at the end for asc
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return sortableCouriers;
  }, [couriers, courierStats, sortOption, sortOrder, prioritySort, highPriorityThreshold]);

  const loadUserProfile = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data: userData, error: userError } = await supabaseClient.auth.getUser()

      if (userError || !userData?.user) {
        router.push("/admin")
        return
      }

      const user = userData.user
      setUser(user)

      // Load dashboard data after user profile is loaded
      await loadDashboardData() // Memanggil fungsi loadDashboardData
    } catch (err) {
      setIsLoading(false)
    }
  }, [router, loadDashboardData]); // Tambahkan loadDashboardData sebagai dependensi

  useEffect(() => {
    loadUserProfile()
  }, [loadUserProfile])

  useEffect(() => {
    setIsRefreshing(isLoading)
  }, [isLoading])

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

  const handleCouriersUpdated = useCallback((lastUpdate: string | null, hasCouriers: boolean) => {
    setLastMapUpdateTime(lastUpdate);
    setHasActiveCouriers(hasCouriers);
  }, []);

  const handleRangeChange = (days: number) => {
    setDataRange(days)
    setIsLoading(true)
    loadDashboardData(days)
  }

  const handleSearch = async () => {
    setSearchResults(null); // Clear previous results
    if (!searchQuery.trim()) {
      return;
    }

    // Attempt to search by AWB number first
    const { data: awbShipment, error: awbError } = await supabaseClient
      .from('shipments')
      .select('*, updated_at') // Ensure updated_at is selected
      .eq('awb_number', searchQuery.trim())
      .single();

    if (awbShipment) {
      const { data: courierData } = await supabaseClient
        .from('users')
        .select('name')
        .eq('id', awbShipment.courier_id)
        .single();
      setSearchResults([{ // Wrap in array even for single result for consistent rendering
        ...awbShipment,
        courier: courierData?.name || 'Unknown',
      }]);
      return;
    }

    // If AWB not found, attempt to search by courier name
    const { data: couriersFound, error: courierSearchError } = await supabaseClient
      .from('users')
      .select('id, name')
      .ilike('name', `%${searchQuery.trim()}%`); // Case-insensitive partial match

    if (couriersFound && couriersFound.length > 0) {
      const courierIds = couriersFound.map(c => c.id);
      const { startDate, endDate } = getDateRange(dataRange); // Get date range
      const { data: courierShipments, error: shipmentsByCourierError } = await supabaseClient
        .from('shipments')
        .select('*, updated_at') // Ensure updated_at is selected
        .in('courier_id', courierIds)
        .gte("created_at", startDate) // Apply date filter
        .lte("created_at", endDate) // Apply date filter
        .order('updated_at', { ascending: false }); // Order by updated_at

      if (courierShipments && courierShipments.length > 0) {
        const resultsWithCourierNames = courierShipments.map(shipment => {
          const matchedCourier = couriersFound.find(c => c.id === shipment.courier_id);
          return {
            ...shipment,
            courier: matchedCourier?.name || 'Unknown',
          };
        });
        setSearchResults(resultsWithCourierNames);
        return;
      }
    }

    // If no results found by AWB or courier name
    setSearchResults({ error: 'No shipments or couriers found di filter ini' });
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
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-white dark:from-black dark:to-gray-900 flex justify-center items-center">
        <div className="text-center">
          <LoadingIcon className="h-16 w-16 animate-spin mx-auto mb-4" style={{ color: '#4a5568', fontWeight: 'bold' }} />
          <p className="text-gray-600 dark:text-gray-400 font-semibold animate-pulse">Loading Dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <a href="https://www.bcexp.id/" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                  BCE Express
                </h1>
              </a>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Monitoring For Couriers BCE Express
              </p>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-4 justify-center sm:justify-end items-center">
              <div className="flex flex-wrap gap-1 sm:gap-2">
                {[1, 2, 7, 14, 30].map((days) => (
                  <Button 
                    key={days}
                    variant={dataRange === days ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleRangeChange(days)}
                    className={`h-8 px-3 text-xs font-bold ${dataRange === days 
                        ? "bg-gray-800 hover:bg-gray-700 text-white dark:bg-gray-700 dark:hover:bg-gray-600" 
                        : "border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"}
                      shadow-sm hover:shadow transition-all duration-200`}
                  >
                    {days}d
                  </Button>
                ))}
              </div>
              <Button 
                variant="outline" 
                onClick={handleRefresh}
                className="h-8 px-3 text-xs font-bold border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 shadow-sm hover:shadow transition-all duration-200"
              >
                <RefreshIcon className="h-3 w-3 mr-1" style={{ fontWeight: 'bold' }} />
                Refresh
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsLocationMapOpen(true)} // Open map modal
                className="h-8 px-3 text-xs font-bold border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 shadow-sm hover:shadow transition-all duration-200"
              >
                <LocationPointIcon className="h-4 w-4 mr-2 text-gray-700 dark:text-gray-300" />
                Lokasi Kurir
              </Button>
              <Button 
                variant="outline" 
                onClick={handleLogout}
                className="h-8 px-3 text-xs font-bold border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 shadow-sm hover:shadow transition-all duration-200"
              >
                <LogoutIcon className="h-4 w-4 mr-2 text-gray-700 dark:text-gray-300" />
                Logout
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </div>

        <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-xs sm:text-sm text-gray-800 dark:text-gray-200 font-medium text-center flex items-center justify-center gap-2">
            <ChartIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" style={{ fontWeight: 'bold' }} />
            Monitoring data from last <strong>{dataRange} day{dataRange > 1 ? 's' : ''}</strong>
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6 text-center hover:shadow-xl transition-all duration-300 hover:scale-105">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-200 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <UserMultipleIcon className="h-6 w-6 sm:h-8 sm:w-8 text-gray-700 dark:text-gray-300" style={{ fontWeight: 'bold' }} />
            </div>
            <span className="text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1">Total Couriers</span>
            <span className="text-2xl sm:text-4xl font-black text-gray-900 dark:text-white">{couriers.length}</span>
          </div>
          
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6 text-center hover:shadow-xl transition-all duration-300 hover:scale-105">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-200 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <DeliveryParcelIcon className="h-6 w-6 sm:h-8 sm:w-8 text-gray-700 dark:text-gray-300" style={{ fontWeight: 'bold' }} />
            </div>
            <span className="text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1">
              {dataRange === 1 ? "Today's" : "Recent"}
            </span>
            <span className="text-2xl sm:text-4xl font-black text-gray-900 dark:text-white">{totalShipments}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 block">shipments</span>
          </div>
          
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-red-200 dark:border-red-700 p-4 sm:p-6 text-center hover:shadow-xl transition-all duration-300 hover:scale-105">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-100 dark:bg-red-900/60 rounded-2xl flex items-center justify-center mx-auto mb-3 relative">
              <WarningIcon className="h-6 w-6 sm:h-8 sm:w-8 text-red-600 dark:text-red-400" style={{ fontWeight: 'bold' }} />
              {totalPending > 0 && (
                <span className="absolute w-2 h-2 bg-red-500 rounded-full animate-ping top-0 right-0" />
              )}
            </div>
            <span className="text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1">Pending</span>
            <span className="text-2xl sm:text-4xl font-black text-red-600 dark:text-red-400 block">
              {totalPending}
            </span>
            <Button onClick={() => setIsPendingModalOpen(true)} variant="link" size="sm" className="text-xs p-0 h-auto text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 mt-1">
              (view details)
            </Button>
          </div>
          
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-green-200 dark:border-green-700 p-4 sm:p-6 text-center hover:shadow-xl transition-all duration-300 hover:scale-105">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-100 dark:bg-green-900/60 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <CheckmarkIcon className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 dark:text-green-400" style={{ fontWeight: 'bold' }} />
            </div>
            <span className="text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1">Completed</span>
            <span className="text-2xl sm:text-4xl font-black text-green-600 dark:text-green-400">{totalCompleted}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 block">deliveries</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-6 bg-gray-50 dark:bg-gray-800 rounded-xl p-1 shadow-inner">
              <TabsTrigger value="couriers" className="rounded-lg font-bold text-xs sm:text-sm data-[state=active]:bg-gray-800 data-[state=active]:text-white dark:data-[state=active]:bg-gray-700 dark:text-gray-300 transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700/50">
                <UserMultipleIcon className="h-4 w-4 mr-1 sm:mr-2 text-gray-700 dark:text-gray-300 data-[state=active]:text-white dark:data-[state=active]:text-white" style={{ fontWeight: 'bold' }} />
                Couriers
              </TabsTrigger>
              <TabsTrigger value="shipments" className="rounded-lg font-bold text-xs sm:text-sm data-[state=active]:bg-gray-800 data-[state=active]:text-white dark:data-[state=active]:bg-gray-700 dark:text-gray-300 transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700/50 relative">
                <PackageIcon className="h-4 w-4 mr-1 sm:mr-2 text-gray-700 dark:text-gray-300 data-[state=active]:text-white dark:data-[state=active]:text-white" style={{ fontWeight: 'bold' }} />
                Shipments
              </TabsTrigger>
              <TabsTrigger value="search" className="rounded-lg font-bold text-xs sm:text-sm data-[state=active]:bg-gray-800 data-[state=active]:text-white dark:data-[state=active]:bg-gray-700 dark:text-gray-300 transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700/50">
                <SearchIcon className="h-4 w-4 mr-1 sm:mr-2 text-gray-700 dark:text-gray-300 data-[state=active]:text-white dark:data-[state=active]:text-white" style={{ fontWeight: 'bold' }} />
                Search
              </TabsTrigger>
            </TabsList>

            <TabsContent value="couriers">
              <div className="flex justify-end mb-4 gap-2">
                <Button
                  variant={prioritySort ? "default" : "outline"}
                  onClick={() => setPrioritySort(!prioritySort)}
                  className={`h-8 px-3 text-xs font-bold ${prioritySort ? 'bg-red-600 hover:bg-red-700 text-white' : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'} shadow-sm`}
                >
                  {prioritySort ? "Priority Sort: ON" : "Priority Sort: OFF"}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-8 px-3 text-xs font-bold border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 shadow-sm">
                      Sort By: {sortOption === 'name' ? 'Name' : sortOption === 'total' ? 'Total Shipments' : sortOption === 'pending' ? 'Pending Shipments' : sortOption === 'completed' ? 'Completed Shipments' : 'Last Seen'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                    <DropdownMenuItem onClick={() => setSortOption('name')} className="text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">Name</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortOption('total')} className="text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">Total Shipments</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortOption('pending')} className="text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">Pending Shipments</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortOption('completed')} className="text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">Completed Shipments</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortOption('lastSeen')} className="text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">Last Seen</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="outline"
                  className="h-8 px-3 text-xs font-bold border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 shadow-sm"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                >
                  {sortOrder === 'asc' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                  )}
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {sortedCouriers.map((courier) => (
                  <div
                    key={courier.id}
                    className={`bg-gray-50 dark:bg-gray-800 rounded-xl shadow-md border-2 p-4 transition-all duration-300 cursor-pointer hover:shadow-lg ${
                      selectedCourier === courier.id 
                        ? "border-gray-500 bg-gray-100 dark:bg-gray-700 dark:border-gray-500 shadow-lg" 
                        : courierStats[courier.id]?.pending > highPriorityThreshold
                        ? "border-red-300 dark:border-red-800"
                        : "border-transparent hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                    onClick={() => setSelectedCourier(courier.id)}
                    onDoubleClick={() => {
                      setSelectedCourier(courier.id);
                      setActiveTab("shipments");
                    }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full ${
                        courierStats[courier.id]?.pending > highPriorityThreshold
                        ? 'bg-red-100 dark:bg-red-900/50'
                        : 'bg-gray-200 dark:bg-gray-700'
                      } flex items-center justify-center`}>
                        <UserMultipleIcon className={`h-5 w-5 sm:h-6 sm:w-6 ${
                          courierStats[courier.id]?.pending > highPriorityThreshold
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-gray-700 dark:text-gray-300'
                        }`} style={{ fontWeight: 'bold' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm sm:text-base text-gray-800 dark:text-gray-100 truncate">
                          {courier.name}
                          {courierStats[courier.id]?.pending > highPriorityThreshold && (
                            <span className="inline-flex items-center ml-2 px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                              Priority
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{courier.email}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
                      <div className="bg-white dark:bg-gray-900 rounded-lg p-2">
                        <BoxIcon className="h-4 w-4 text-gray-700 dark:text-gray-300 mx-auto mb-1" style={{ fontWeight: 'bold' }} />
                        <span className="text-sm sm:text-base font-black text-gray-900 dark:text-white block">{courierStats[courier.id]?.total || 0}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Total</span>
                      </div>
                      <div className="bg-white dark:bg-gray-900 rounded-lg p-2 relative">
                        <WarningIcon className="h-4 w-4 text-red-600 dark:text-red-400 mx-auto mb-1" style={{ fontWeight: 'bold' }} />
                        <span className="text-sm sm:text-base font-black text-red-600 dark:text-red-400 block">
                          {courierStats[courier.id]?.pending || 0}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Pending</span>
                      </div>
                      <div className="bg-white dark:bg-gray-900 rounded-lg p-2">
                        <CheckmarkIcon className="h-4 w-4 text-green-600 dark:text-green-400 mx-auto mb-1" style={{ fontWeight: 'bold' }} />
                        <span className="text-sm sm:text-base font-black text-green-600 dark:text-green-400 block">{courierStats[courier.id]?.completed || 0}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Done</span>
                      </div>
                    </div>
                    
                    {courier.latestLatitude && courier.latestLongitude ? (
                      <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 border border-blue-200 dark:border-blue-700 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-blue-700 dark:text-blue-300 font-semibold flex items-center gap-1">
                            <LocationPointIcon className="h-4 w-4 mr-1 text-blue-600 dark:text-blue-400" /> Latest GPS Location
                          </p>
                          {courier.latestLocationTime && (
                            <p className="text-xs text-blue-600 dark:text-blue-400">
                              {new Date(courier.latestLocationTime).toLocaleTimeString()}
                            </p>
                          )}
                        </div>
                        <a
                          href={`https://www.google.com/maps/place/${courier.latestLatitude},${courier.latestLongitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-mono bg-white dark:bg-gray-800 rounded px-2 py-1 border border-blue-200 dark:border-blue-600 hover:border-blue-400 dark:hover:border-blue-400 transition-colors shadow-inner"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {courier.latestLatitude?.toFixed(6)}, {courier.latestLongitude?.toFixed(6)}
                        </a>
                        {courier.latestAwb && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                            From: {courier.latestAwb}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600 shadow-sm">
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center flex items-center justify-center">
                          <LocationPointIcon className="h-4 w-4 mr-1 text-gray-500 dark:text-gray-400" /> No recent GPS location
                        </p>
                        {courier.latestLocationTime && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">
                            Last seen: {new Date(courier.latestLocationTime).toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {couriers.length === 0 && (
                  <div className="col-span-full text-center py-12">
                    <UserMultipleIcon className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" style={{ fontWeight: 'bold' }} />
                    <p className="text-gray-500 dark:text-gray-400 font-semibold">No couriers found</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="shipments">
              {selectedCourier ? (
                <CourierShipmentList courierId={selectedCourier} dataRange={dataRange} />
              ) : (
                <div className="text-center py-12">
                  <BoxIcon className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" style={{ fontWeight: 'bold' }} />
                  <p className="text-gray-500 dark:text-gray-400 font-semibold">Select a courier to view their shipments</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="search">
              <div className="max-w-md mx-auto">
                <div className="mb-4 flex gap-2">
                  <Input 
                    placeholder="Enter AWB number or courier name..." 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleSearch();
                      }
                    }}
                    className="border-gray-300 focus:border-gray-500 dark:border-gray-600 dark:focus:border-gray-500 dark:bg-gray-700 dark:text-gray-100 shadow-sm"
                  />
                  <Button 
                    onClick={handleSearch}
                    className="bg-gray-700 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-500 font-bold text-white shadow-sm"
                  >
                    <SearchIcon className="h-4 w-4 text-white" style={{ fontWeight: 'bold' }} />
                  </Button>
                </div>
                {searchResults ? (
                  // Check if searchResults is an array (multiple shipments or single AWB result wrapped in array)
                  Array.isArray(searchResults) ? (
                    searchResults.length > 0 ? (
                      <div className="space-y-3">
                        {searchResults.map((shipment) => (
                          <Card key={shipment.awb_number} className="border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm">
                            <CardContent className="p-4">
                              <p className="dark:text-gray-200"><strong>AWB Number:</strong> {shipment.awb_number}</p>
                              <p className="dark:text-gray-200"><strong>Courier:</strong> {shipment.courier}</p>
                              {shipment.updated_at && (
                                <p className="dark:text-gray-200"><strong>Last Updated:</strong> {new Date(shipment.updated_at).toLocaleString()}</p>
                              )}
                              <Button
                                onClick={() => handleDeleteShipment(shipment.awb_number)}
                                className="mt-3 bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 font-bold w-full shadow-sm"
                              >
                                <TrashCanIcon className="h-4 w-4 mr-2" style={{ fontWeight: 'bold' }} />
                                Delete Shipment
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 font-semibold text-center">No shipments found for this search.</p>
                    )
                  ) : ( // It's an error object
                    <p className="text-red-600 dark:text-red-400 font-semibold text-center">{searchResults.error}</p>
                  )
                ) : (
                  <div className="text-center py-8">
                    <SearchIcon className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" style={{ fontWeight: 'bold' }} />
                    <p className="text-gray-500 dark:text-gray-400 font-semibold">Enter AWB number or courier name to search</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <Dialog open={isPendingModalOpen} onOpenChange={setIsPendingModalOpen}>
          <DialogContent className="max-w-md sm:max-w-2xl max-h-[80vh] dark:bg-gray-800 dark:border-gray-600 rounded-lg shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-red-600 dark:text-red-400 font-bold flex items-center gap-2">
                <div className="relative">
                  <WarningIcon className="h-5 w-5" style={{ fontWeight: 'bold' }} />
                  {pendingShipments.length > 0 && (
                    <span className="absolute w-2 h-2 bg-red-500 rounded-full animate-ping -top-1 -right-1" />
                  )}
                </div>
                Pending Deliveries (Top 100)
                {pendingShipments.length > 0 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                    {pendingShipments.length} Items
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="overflow-auto max-h-[60vh]">
              <div className="space-y-3">
                {pendingShipments.map((shipment) => (
                  <Card key={shipment.awb_number} className="overflow-hidden dark:border-gray-800 dark:bg-gray-900 shadow-lg hover:shadow-xl transition-shadow duration-200">
                    <CardContent className="p-0">
                      <div className="flex flex-col">
                        <div className="p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                          <div className="flex justify-between items-center">
                            <p className="font-mono text-sm font-bold text-gray-800 dark:text-gray-200">{shipment.awb_number}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(shipment.created_at).toLocaleDateString()}
                              </span>
                              <WarningIcon className="h-4 w-4 text-red-500 dark:text-red-400" style={{ fontWeight: 'bold' }} />
                            </div>
                          </div>
                          <p className="text-xs text-gray-700 dark:text-gray-300">
                            Courier: {couriers.find(c => c.id === shipment.courierId)?.name || 'Unknown'}
                          </p>
                        </div>
                        
                        <div className="p-3">
                          <div className="grid grid-cols-1 gap-2 text-sm">
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                              <p className="font-medium text-gray-800 dark:text-gray-200">
                                {shipment.current_status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                              </p>
                            </div>
                            
                            {/* Try to find related location data */}
                            {couriers.find(c => c.id === shipment.courierId)?.latestAwb === shipment.awb_number && (
                              <div className="mt-1">
                                <p className="text-xs text-gray-500 dark:text-gray-400">Last Known Location</p>
                                <div className="mt-1">
                                  {couriers.find(c => c.id === shipment.courierId)?.latestLatitude && (
                                    <a
                                      href={`https://www.google.com/maps/place/${couriers.find(c => c.id === shipment.courierId)?.latestLatitude},${couriers.find(c => c.id === shipment.courierId)?.latestLongitude}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-mono bg-blue-50 dark:bg-blue-900/30 rounded px-2 py-1 border border-blue-200 dark:border-blue-600 hover:border-blue-400 dark:hover:border-blue-400 transition-colors shadow-sm"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <LocationPointIcon className="h-3 w-3 mr-1 text-blue-600 dark:text-blue-400" /> 
                                      {couriers.find(c => c.id === shipment.courierId)?.latestLatitude?.toFixed(6)}, 
                                      {couriers.find(c => c.id === shipment.courierId)?.latestLongitude?.toFixed(6)}
                                    </a>
                                  )}
                                </div>
                                {couriers.find(c => c.id === shipment.courierId)?.latestLocationTime && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {new Date(couriers.find(c => c.id === shipment.courierId)?.latestLocationTime || '').toLocaleString()}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {pendingShipments.length === 0 && (
                  <div className="text-center py-8">
                    <CheckmarkIcon className="h-12 w-12 text-green-500 dark:text-green-400 mx-auto mb-4" style={{ fontWeight: 'bold' }} />
                    <p className="text-gray-500 dark:text-gray-400 font-semibold">No pending deliveries</p>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Live Location Map Modal */}
        <Dialog open={isLocationMapOpen} onOpenChange={setIsLocationMapOpen}>
          <DialogContent className="max-w-4xl sm:max-w-5xl max-h-[90vh] dark:bg-gray-800 dark:border-gray-600 rounded-lg shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-white font-bold flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <LocationPointIcon className="h-5 w-5" style={{ fontWeight: 'bold' }} />
                  Live Courier Locations
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                    <span className="w-2 h-2 mr-1 bg-green-500 rounded-full animate-pulse"></span>
                    Auto-update
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMapRefreshKey(prev => prev + 1)}
                    className="h-8 px-3 text-xs font-bold border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    <RefreshIcon className="h-3 w-3 mr-1" style={{ fontWeight: 'bold' }} />
                    Refresh Now
                  </Button>
                </div>
              </DialogTitle>
            </DialogHeader>
            <div className="h-[60vh] w-full">
              {isLocationMapOpen && <LeafletMap key={mapRefreshKey} onCouriersUpdated={handleCouriersUpdated} />}
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {lastMapUpdateTime ? `Last Updated: ${new Date(lastMapUpdateTime).toLocaleTimeString()}` : 'Loading map data...'}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center">
                <span className="w-2 h-2 mr-1 bg-blue-500 rounded-full animate-pulse"></span>
                Data diperbarui Jika ada aktifitas
              </p>
            </div>
            {!hasActiveCouriers && (lastMapUpdateTime !== null) && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Tidak ada kurir aktif saat ini.
                </p>
            )}
          </DialogContent>
        </Dialog>

      </div>
    </div>
  )
}
