"use client"
import { Button } from "@/components/ui/button"
import { Loader2, LogOut, Eye, Package, CheckCircle } from "lucide-react"
import { supabaseClient } from "@/lib/auth"
import { BulkUpdateModal } from "./bulk-update-modal"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { isInCapacitor, handleCapacitorLogout } from "@/lib/capacitor-utils"

interface User {
  id: string;
  name?: string;
  email?: string;
}

interface Shipment {
  id?: string;
  awb_number: string;
  receiver_name?: string;
  receiver_address?: string;
  created_at: string;
  updated_at?: string;
  location?: string;
  latest_update?: {
    created_at: string;
  };
}

export function CourierDashboardWithUpdate() {
  const [isLoading, setIsLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [completedCount, setCompletedCount] = useState(0)
  const [lastCompletedAwb, setLastCompletedAwb] = useState("")
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)
  const [totalBulkShipments, setTotalBulkShipments] = useState(0)
  const [pendingDeliveries, setPendingDeliveries] = useState(0)
  const [bulkShipmentAwbs, setBulkShipmentAwbs] = useState<Shipment[]>([])
  const [pendingShipments, setPendingShipments] = useState<Shipment[]>([])
  const [showBulkDetails, setShowBulkDetails] = useState(false)
  const [showPendingDetails, setShowPendingDetails] = useState(false)
  const [completedTodayShipments, setCompletedTodayShipments] = useState<Shipment[]>([])
  const [showCompletedTodayDetails, setShowCompletedTodayDetails] = useState(false)

  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    async function loadUserProfile() {
      try {
        const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession()
        if (sessionError) {
          setIsLoading(false)
          return
        }
        if (!sessionData?.session?.user?.id) {
          router.push("/courier")
          return
        }

        const userId = sessionData.session.user.id
        const { data: userData, error: userError } = await supabaseClient
          .from("users")
          .select("*")
          .eq("id", userId)
          .single()

        if (userError) {
          setIsLoading(false)
          return
        }

        setCurrentUser(userData as User)
        loadShipmentData(userData as User)
      } catch (err: unknown) {
        setIsLoading(false)
      }
    }

    loadUserProfile()
  }, [router])

  const loadShipmentData = async (user: User) => {
    setIsLoading(true)
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayISOString = today.toISOString()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayISOString = yesterday.toISOString()

      const courierId = user?.id
      const courierName = user?.name || user?.email?.split("@")[0] || ""

      // Get today's bulk shipments
      const { data: bulkShipmentsData, error: bulkShipmentsError } = await supabaseClient
        .from("shipments")
        .select("*")
        .eq("current_status", "out_for_delivery")
        .eq("courier_id", courierId)
        .gte("created_at", todayISOString)
        .order("created_at", { ascending: false })

      if (bulkShipmentsError) {
      } else {
        setTotalBulkShipments(bulkShipmentsData?.length || 0)
        setBulkShipmentAwbs(bulkShipmentsData || [])
      }

      // Get pending deliveries (shipments from before today that are still out_for_delivery or shipped)
      const { data: pendingData, error: pendingError } = await supabaseClient
        .from("shipments")
        .select("*")
        .eq("courier_id", courierId)
        .in("current_status", ["out_for_delivery", "shipped"])
        .lt("created_at", todayISOString)
        .order("created_at", { ascending: false })

      if (pendingError) {
      } else {
        setPendingDeliveries(pendingData?.length || 0)
        setPendingShipments(pendingData || [])
      }

      // Count completed today
      const { data: completedTodayData, error: completedTodayError } = await supabaseClient
        .from("shipment_history")
        .select("*")
        .eq("status", "delivered")
        .ilike("notes", `%${courierName}%`)
        .gte("created_at", todayISOString)

      if (completedTodayError) {
      } else {
        setCompletedCount(completedTodayData?.length || 0)
        setCompletedTodayShipments(completedTodayData || [])
        if (completedTodayData && completedTodayData.length > 0) {
          const sortedData = [...completedTodayData].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          )
          setLastCompletedAwb(sortedData[0].awb_number)
        } else {
          setLastCompletedAwb("")
        }
      }
    } catch (error: unknown) {
    } finally {
      setIsLoading(false)
    }
  }

  const handleBulkUpdateSuccess = (count: number) => {
    // Show toast notification but don't close modal automatically
    toast({
      title: "Bulk Update Successful",
      description: `${count} shipments have been updated to "Out for Delivery" status.`,
    })

    // Refresh data after successful update
    if (currentUser) {
      loadShipmentData(currentUser)
    }
  }

  const handleLogout = async () => {
    // Check if running in Capacitor iframe context
    if (isInCapacitor()) {
      console.warn('CourierDashboardWithUpdate: Using Capacitor logout flow');
      
      await handleCapacitorLogout(async () => {
        await supabaseClient.auth.signOut()
      });
      
      // Don't use router.push in Capacitor context
      // Parent container will handle navigation
      return;
    }

    // Normal web browser logout flow
    console.warn('CourierDashboardWithUpdate: Using web browser logout flow');
    
    try {
      await supabaseClient.auth.signOut()
      router.push("/courier")
    } catch (err: unknown) {
      // Silent error during sign out
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const displayName = currentUser?.name || currentUser?.email?.split("@")[0] || ""
  const emailDisplay = currentUser?.email || ""

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Courier Dashboard</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            Welcome, <span className="font-semibold">{displayName}</span>
          </p>
          <p className="text-sm text-zinc-400">{emailDisplay}</p>
          {lastCompletedAwb && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
              Last AWB job finished: <span className="font-mono">{lastCompletedAwb}</span>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" /> Logout
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
        <div className="bg-blue-50/70 dark:bg-blue-900/40 rounded-xl shadow-lg p-8 flex flex-col gap-2 relative transition hover:shadow-2xl">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-6 w-6 text-blue-500" />
            <span className="text-lg font-semibold text-zinc-700 dark:text-zinc-200">Today's Assignments</span>
          </div>
          <span className="text-5xl font-extrabold text-zinc-900 dark:text-white">{totalBulkShipments}</span>
          {totalBulkShipments > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBulkDetails(true)}
              className="absolute right-6 top-6"
            >
              <Eye className="h-4 w-4 mr-1" /> View
            </Button>
          )}
        </div>

        <div className="bg-green-50/70 dark:bg-green-900/40 rounded-xl shadow-lg p-8 flex flex-col gap-2 relative transition hover:shadow-2xl">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="h-6 w-6 text-green-500" />
            <span className="text-lg font-semibold text-zinc-700 dark:text-zinc-200">Completed Today</span>
          </div>
          <span className="text-5xl font-extrabold text-zinc-900 dark:text-white">{completedCount}</span>
          {completedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCompletedTodayDetails(true)}
              className="absolute right-6 top-6"
            >
              <Eye className="h-4 w-4 mr-1" /> View
            </Button>
          )}
        </div>

        <div className="bg-yellow-50/70 dark:bg-yellow-900/40 rounded-xl shadow-lg p-8 flex flex-col gap-2 relative transition hover:shadow-2xl">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-6 w-6 text-yellow-500" />
            <span className="text-lg font-semibold text-zinc-700 dark:text-zinc-200">Pending Deliveries</span>
          </div>
          <span className="text-5xl font-extrabold text-zinc-900 dark:text-white">{pendingDeliveries}</span>
          {pendingDeliveries > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPendingDetails(true)}
              className="absolute right-6 top-6"
            >
              <Eye className="h-4 w-4 mr-1" /> View
            </Button>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col md:flex-row gap-4 mb-10">
        <Button
          className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-black font-semibold py-6 text-lg flex-1 shadow"
          onClick={() => setIsBulkModalOpen(true)}
        >
          Bulk Shipped Update
        </Button>
        <Button
          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-6 text-lg flex-1 shadow"
          onClick={() => router.push("/courier/update")}
        >
          Update Shipment Status
        </Button>
      </div>

      {/* Bulk Update Modal */}
      <BulkUpdateModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onSuccess={handleBulkUpdateSuccess}
      />

      {/* Bulk Shipments Details Dialog */}
      <Dialog open={showBulkDetails} onOpenChange={setShowBulkDetails}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Bulk Shipments Details</DialogTitle>
            <DialogDescription>
              These are the shipments that have been marked as "Out For Delivery" and are pending delivery
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto mt-4">
            {bulkShipmentAwbs.length > 0 ? (
              <div className="space-y-3">
                {bulkShipmentAwbs.map((shipment) => (
                  <div
                    key={shipment.awb_number}
                    className="p-3 border rounded-md flex justify-between items-center hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-blue-500" />
                        <span className="font-mono font-medium">{shipment.awb_number}</span>
                        <Badge variant="outline" className="ml-2">
                          Out For Delivery
                        </Badge>
                      </div>
                      <p className="text-sm mt-1">
                        {shipment.receiver_name !== "Auto Generated"
                          ? `${shipment.receiver_name} - ${shipment.receiver_address}`
                          : "Auto Generated Shipment"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Updated: {shipment.updated_at ? new Date(shipment.updated_at).toLocaleString() : "N/A"}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => router.push(`/courier/update?awb=${shipment.awb_number}`)}>
                      Update
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">No bulk shipments found</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Pending Deliveries Dialog */}
      <Dialog open={showPendingDetails} onOpenChange={setShowPendingDetails}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Pending Deliveries</DialogTitle>
            <DialogDescription>
              These are shipments from previous days that are still pending delivery
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto mt-4">
            {pendingShipments.length > 0 ? (
              <div className="space-y-3">
                {pendingShipments.map((shipment) => (
                  <div
                    key={shipment.awb_number}
                    className="p-3 border rounded-md flex justify-between items-center hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-yellow-500" />
                        <span className="font-mono font-medium">{shipment.awb_number}</span>
                        <Badge variant="outline" className="text-xs">
                          OFD
                        </Badge>
                      </div>
                      <p className="text-sm mt-1">
                        {shipment.receiver_name !== "Auto Generated"
                          ? `${shipment.receiver_name} - ${shipment.receiver_address}`
                          : "Auto Generated Shipment"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Created: {new Date(shipment.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => router.push(`/courier/update?awb=${shipment.awb_number}`)}>
                      Update
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">No pending deliveries found</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Completed Today Details Dialog */}
      <Dialog open={showCompletedTodayDetails} onOpenChange={setShowCompletedTodayDetails}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Shipments Completed Today</DialogTitle>
            <DialogDescription>These are the shipments that you have marked as "Delivered" today.</DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto mt-4">
            {completedTodayShipments.length > 0 ? (
              <div className="space-y-3">
                {completedTodayShipments.map((shipment) => (
                  <div
                    key={shipment.id}
                    className="p-3 border rounded-md flex justify-between items-center hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="font-mono font-medium">{shipment.awb_number}</span>
                      </div>
                      <p className="text-sm mt-1">Location: {shipment.location}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Completed at: {new Date(shipment.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">No shipments completed today</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}