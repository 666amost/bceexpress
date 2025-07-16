"use client";

import type React from "react";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Oval } from 'react-loading-icons';
import { DeliveryParcel as DeliveryParcelIcon, Package as PackageIcon, Checkmark as CheckCircleIcon, Warning as AlertTriangleIcon, Time as ClockIcon, LocationFilled as LocationPointIcon } from '@carbon/icons-react';
import { supabaseClient } from "@/lib/auth";

interface CourierShipmentListProps {
  courierId: string;
  onDeleteShipment?: (shipmentId: string) => void;
  dataRange: number;
}

// Utility function to get date range (copied from leader-dashboard.tsx)
const getDateRange = (days: number) => {
  const now = new Date();
  
  const endDate = new Date(Date.UTC(
    now.getFullYear(), 
    now.getMonth(), 
    now.getDate(), 
    23, 59, 59, 999
  ));
  
  const startDate = new Date(Date.UTC(
    now.getFullYear(), 
    now.getMonth(), 
    now.getDate() - (days - 1),
    0, 0, 0, 0
  ));
  
  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  };
};

export function CourierShipmentList({ courierId, onDeleteShipment, dataRange }: CourierShipmentListProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [courier, setCourier] = useState<any>(null);
  const [shipments, setShipments] = useState<any[]>([]); // State untuk semua shipment yang terkait dengan kurir
  const [activeTab, setActiveTab] = useState("ongoing");
  const [debugInfo, setDebugInfo] = useState<string>("");

  // === State untuk menyimpan jumlah per kategori ===
  const [ongoingCount, setOngoingCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [issuesCount, setIssuesCount] = useState(0);
  const [allCount, setAllCount] = useState(0);
  // === Akhir State jumlah ===


  const loadCourierData = useCallback(async () => {
    setIsLoading(true);
    setDebugInfo("Loading courier data...");
    try {
      // Get courier details
      const { data: courierData, error: courierError } = await supabaseClient
        .from("users")
        .select("*")
        .eq("id", courierId)
        .single();

      if (courierError) {
        setDebugInfo(`Error fetching courier: ${courierError.message}`);
        setIsLoading(false);
        return;
      }

      setCourier(courierData);
      setDebugInfo(`Workspaceed courier: ${courierData?.name}`);

      // === Ambil data shipment dari tabel shipments untuk kurir ini ===
      const { startDate, endDate } = getDateRange(dataRange);
      const { data: shipmentsByCourier, error: shipmentsByCourierError } = await supabaseClient
        .from("shipments")
        .select("*")
        .eq("courier_id", courierId)
        .gte("created_at", startDate)
        .lte("created_at", endDate);

      if (shipmentsByCourierError) {
        setDebugInfo(`Error fetching shipments by courier: ${shipmentsByCourierError.message}`);
        setIsLoading(false);
        return;
      }

      // === Ambil data history yang relevan langsung dari database dengan filter ===
      const courierUsername = courierData.email.split("@")[0];
      const { data: courierHistoryData, error: historyError } = await supabaseClient
        .from("shipment_history")
        .select("awb_number, created_at, latitude, longitude, notes, location, status")
        .or(`notes.ilike.%${courierData.name.toLowerCase()}%,notes.ilike.%${courierUsername.toLowerCase()}%`)
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .order("created_at", { ascending: false });

      if (historyError) {
        setDebugInfo(`Error fetching all history: ${historyError.message}`);
        setIsLoading(false);
        return;
      }

      setDebugInfo(`Workspaceed ${courierHistoryData?.length || 0} relevant history entries directly from DB.`);

      // Get unique AWB numbers from relevant history
      const awbNumbersFromHistory = Array.from(new Set(courierHistoryData.map((item) => item.awb_number))).filter(Boolean);

      setDebugInfo(`Found ${awbNumbersFromHistory.length} unique AWB numbers from relevant history after filtering.`);

      // Pre-process courierHistoryData into a map for faster lookups
      const historyMap = new Map<string, any[]>();
      for (const entry of courierHistoryData || []) {
        if (!historyMap.has(entry.awb_number)) {
          historyMap.set(entry.awb_number, []);
        }
        historyMap.get(entry.awb_number)?.push(entry);
      }

      // === Ambil detail shipment dari AWB hasil history ===
      let shipmentDetails: any[] = [];
      if (awbNumbersFromHistory.length > 0) {
        const { data: shipmentsData, error: shipmentsError } = await supabaseClient
          .from("shipments")
          .select("*")
          .in('awb_number', awbNumbersFromHistory);

        if (shipmentsError) {
          setDebugInfo(`Error fetching shipments: ${shipmentsError.message}`);
          setIsLoading(false);
          return;
        }

        for (const shipment of shipmentsData || []) {
          const allShipmentHistory = historyMap.get(shipment.awb_number) || [];
          const latestHistory = allShipmentHistory.length > 0 ? allShipmentHistory[0] : null;
          shipmentDetails.push({
            ...shipment,
            latest_update: latestHistory,
            all_history: allShipmentHistory,
          });
        }
      }

      // === Tambahkan shipment yang belum ada di shipmentDetails (tidak punya history) ===
      const awbInDetails = new Set(shipmentDetails.map(s => s.awb_number));
      const shipmentsWithoutHistory = (shipmentsByCourier || []).filter(s => !awbInDetails.has(s.awb_number));
      for (const shipment of shipmentsWithoutHistory) {
        shipmentDetails.push({
          ...shipment,
          latest_update: null,
          all_history: [],
        });
      }

      // === Urutkan shipmentDetails berdasarkan created_at (terbaru di atas) ===
      shipmentDetails.sort((a, b) => {
        const dateA = a.latest_update ? new Date(a.latest_update.created_at).getTime() : new Date(a.created_at).getTime();
        const dateB = b.latest_update ? new Date(b.latest_update.created_at).getTime() : new Date(b.created_at).getTime();
        return dateB - dateA;
      });

      setShipments(shipmentDetails);
      setDebugInfo(`Finished loading courier data for ${courierData?.name}.`);
      setIsLoading(false);
    } catch (err) {
      setDebugInfo(`Error loading courier data: ${err}`);
      setIsLoading(false);
    }
  }, [courierId, setIsLoading, setDebugInfo, setCourier, setShipments, dataRange]);

  useEffect(() => {
    loadCourierData();
  }, [courierId, loadCourierData]);

   // === Effect untuk menghitung ulang jumlah saat data shipments berubah ===
  useEffect(() => {
    const totalOngoing = shipments.filter((s) => !["delivered", "exception"].includes(s.current_status)).length;
    const totalCompleted = shipments.filter((s) => s.current_status === "delivered").length;
    const totalIssues = shipments.filter((s) => s.current_status === "exception").length;
    const totalAll = shipments.length;

    setOngoingCount(totalOngoing);
    setCompletedCount(totalCompleted);
    setIssuesCount(totalIssues);
    setAllCount(totalAll);

  }, [shipments]); // Jalankan effect ini setiap kali state 'shipments' berubah
  // === Akhir Effect hitung jumlah ===

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "processed":
        return <ClockIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />;
      case "shipped":
        return <PackageIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />;
      case "in_transit":
        return <PackageIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />;
      case "out_for_delivery":
        return <DeliveryParcelIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />;
      case "delivered":
        return <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />;
      case "exception":
        return <AlertTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />;
      default:
        return <PackageIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />;
    }
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Oval className="h-8 w-8 animate-spin text-gray-500 dark:text-gray-400" />
      </div>
    );
  }

  // Filter shipments based on active tab (menggunakan shipments state lengkap)
  const filteredShipments = shipments.filter((shipment) => {
    if (activeTab === "ongoing") {
      return !["delivered", "exception"].includes(shipment.current_status);
    } else if (activeTab === "completed") {
      return shipment.current_status === "delivered";
    } else if (activeTab === "issues") {
      return shipment.current_status === "exception";
    }
    return true; // all tab
  });


  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-1">{courier?.name}'s Shipments</h2> {/* Judul kembali ke umum */}
        <p className="text-muted-foreground">Showing all shipment activity for {courier?.email}</p> {/* Deskripsi kembali ke umum */}
      </div>

      <Tabs defaultValue="ongoing" onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 mb-4 bg-gray-50 dark:bg-gray-800 rounded-xl p-1 shadow-inner">
          <TabsTrigger value="ongoing" className="rounded-lg font-bold text-xs sm:text-sm data-[state=active]:bg-gray-900 data-[state=active]:text-white dark:data-[state=active]:bg-gray-900 dark:data-[state=active]:text-white transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700/50">
            Ongoing
            <Badge variant="secondary" className="ml-2 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
              {ongoingCount} {/* Menggunakan state ongoingCount */}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="completed" className="rounded-lg font-bold text-xs sm:text-sm data-[state=active]:bg-gray-900 data-[state=active]:text-white dark:data-[state=active]:bg-gray-900 dark:data-[state=active]:text-white transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700/50">
            Completed
            <Badge
              variant="secondary"
              className="ml-2 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
            >
              {completedCount} {/* Menggunakan state completedCount */}
            </Badge>
          </TabsTrigger>
          
          <TabsTrigger value="all" className="rounded-lg font-bold text-xs sm:text-sm data-[state=active]:bg-gray-900 data-[state=active]:text-white dark:data-[state=active]:bg-gray-900 dark:data-[state=active]:text-white transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700/50">
            All
            <Badge variant="secondary" className="ml-2 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
              {allCount} {/* Menggunakan state allCount */}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* === Bagian TabsContent: Gunakan filteredShipments yang sudah dihitung === */}
        <TabsContent value="ongoing">
          <ShipmentList shipments={filteredShipments} getStatusIcon={getStatusIcon} formatStatus={formatStatus} />
        </TabsContent>

        <TabsContent value="completed">
          <ShipmentList shipments={filteredShipments} getStatusIcon={getStatusIcon} formatStatus={formatStatus} />
        </TabsContent>

        
        <TabsContent value="all">
          <ShipmentList shipments={filteredShipments} getStatusIcon={getStatusIcon} formatStatus={formatStatus} />
        </TabsContent>
        {/* === Akhir Bagian TabsContent === */}

      </Tabs>

      {/* Debug info - remove in production */}
      {debugInfo && (
        <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-md text-xs font-mono">
          <p className="font-bold mb-2">Debug Info:</p>
          <pre>{debugInfo}</pre>
        </div>
      )}
    </div>
  );
}

function ShipmentList({
  shipments,
  getStatusIcon,
  formatStatus,
}: {
  shipments: any[];
  getStatusIcon: (status: string) => React.ReactNode;
  formatStatus: (status: string) => string;
}) {
  const [expandedShipments, setExpandedShipments] = useState<Set<string>>(new Set());

  const toggleExpanded = (awbNumber: string) => {
    const newExpanded = new Set(expandedShipments);
    if (newExpanded.has(awbNumber)) {
      newExpanded.delete(awbNumber);
    } else {
      newExpanded.add(awbNumber);
    }
    setExpandedShipments(newExpanded);
  };

  if (shipments.length === 0) {
    return <div className="text-center py-8 text-gray-500 dark:text-gray-400">No shipments found</div>;
  }

  return (
    <div className="space-y-4">
      {shipments.map((shipment) => (
        <Card key={shipment.awb_number} className="overflow-hidden dark:border-gray-800 dark:bg-gray-900 shadow-lg hover:shadow-xl transition-shadow duration-200">
          <CardContent className="p-0">
            <div className="flex flex-col md:flex-row">
              <div className="p-4 md:w-1/4 bg-gray-50 dark:bg-gray-800 border-r border-gray-100 dark:border-gray-800">
                <p className="font-mono text-sm mb-1 text-gray-800 dark:text-gray-200">{shipment.awb_number}</p>
                <div className="flex items-center text-gray-700 dark:text-gray-300">
                  {getStatusIcon(shipment.current_status)}
                  <span className="ml-2 font-medium">{formatStatus(shipment.current_status)}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Last update: {shipment.updated_at ? new Date(shipment.updated_at).toLocaleString() : "N/A"}
                </p>
              </div>

              <div className="p-4 md:w-3/4 border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {/* Latest Update with enhanced GPS display */}
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Latest Update</p>
                    {shipment.latest_update?.latitude != null && shipment.latest_update?.longitude != null && (
                      <p className="font-bold text-gray-800 dark:text-gray-200 mb-1">
                        Current GPS Location
                      </p>
                    )}
                    <p className="font-medium text-gray-800 dark:text-gray-200">
                      {shipment.latest_update?.location || "No location text"}
                    </p>
                    
                    {/* GPS Coordinates as clickable link */}
                    {shipment.latest_update?.latitude != null && shipment.latest_update?.longitude != null && (
                      <div className="mt-1">
                        <a
                          href={`https://www.google.com/maps/place/${shipment.latest_update.latitude},${shipment.latest_update.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-mono bg-blue-50 dark:bg-blue-900/30 rounded px-2 py-1 border border-blue-200 dark:border-blue-600 hover:border-blue-400 dark:hover:border-blue-400 transition-colors shadow-sm"
                        >
                          <LocationPointIcon className="h-3 w-3 mr-1 text-blue-600 dark:text-blue-400" /> {shipment.latest_update.latitude?.toFixed(6)}, {shipment.latest_update.longitude?.toFixed(6)}
                        </a>
                      </div>
                       )}
                    
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{shipment.latest_update?.notes || "No notes"}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {shipment.latest_update ? new Date(shipment.latest_update.created_at).toLocaleString() : ""}
                    </p>
                  </div>

                  {/* Receiver Info */}
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Receiver</p>
                    <p className="font-bold text-gray-800 dark:text-gray-200">{shipment.receiver_name || "N/A"}</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{shipment.receiver_address || "N/A"}</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{shipment.receiver_phone || "N/A"}</p>
                  </div>
                </div>

                {/* Activity History Toggle */}
                {shipment.all_history && shipment.all_history.length > 1 && (
                  <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                    <button
                      onClick={() => toggleExpanded(shipment.awb_number)}
                      className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium flex items-center gap-1"
                    >
                      {expandedShipments.has(shipment.awb_number) ? '▼' : '▶'} 
                      View Activity History ({shipment.all_history.length} entries)
                    </button>

                    {expandedShipments.has(shipment.awb_number) && (
                      <div className="mt-3 space-y-3 max-h-60 overflow-y-auto">
                        {shipment.all_history.map((history: any, index: number) => (
                          <div key={`${history.awb_number}-${index}`} className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 shadow-sm">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  {getStatusIcon(history.status)}
                                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                    {formatStatus(history.status)}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                  {history.location || "No location"}
                                </p>
                                {history.notes && (
                                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                    {history.notes}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {new Date(history.created_at).toLocaleString()}
                                </p>
                                {/* GPS link for each history entry */}
                                {history.latitude != null && history.longitude != null && (
                                  <a
                                    href={`https://www.google.com/maps/place/${history.latitude},${history.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-mono bg-blue-50 dark:bg-blue-900/30 rounded px-1 py-0.5 border border-blue-200 dark:border-blue-600 hover:border-blue-400 dark:hover:border-blue-400 transition-colors mt-1"
                                  >
                                    <LocationPointIcon className="h-3 w-3 mr-1" /> GPS
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
