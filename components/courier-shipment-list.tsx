"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Oval } from 'react-loading-icons';
import { DeliveryParcel as DeliveryParcelIcon, Package as PackageIcon, Checkmark as CheckCircleIcon, Warning as AlertTriangleIcon, Time as ClockIcon } from '@carbon/icons-react';
import { supabaseClient } from "@/lib/auth";

interface CourierShipmentListProps {
  courierId: string;
  onDeleteShipment?: (shipmentId: string) => void;
}

export function CourierShipmentList({ courierId, onDeleteShipment }: CourierShipmentListProps) {
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


  useEffect(() => {
    loadCourierData();
  }, [courierId]);

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


  const loadCourierData = async () => {
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

      // === Mengambil SEMUA data history (tanpa filter tanggal) dan menyertakan lokasi ===
      const { data: allHistoryData, error: historyError } = await supabaseClient
        .from("shipment_history")
        .select("awb_number, created_at, latitude, longitude, notes, location") // *** Altitude dihapus ***
        .order("created_at", { ascending: false }); // Tetap urutkan


      if (historyError) {
        setDebugInfo(`Error fetching all history: ${historyError.message}`);
        setIsLoading(false);
        return;
      }

      setDebugInfo(`Workspaceed ${allHistoryData?.length || 0} total history entries.`);

      // Filter history data berdasarkan nama atau email kurir di kolom 'notes'
      const courierUsername = courierData.email.split("@")[0];
      const courierHistoryData =
        allHistoryData?.filter( // Menggunakan allHistoryData
          (entry) =>
            entry.notes && // Pastikan notes tidak null atau undefined
            (entry.notes.toLowerCase().includes(courierData.name.toLowerCase()) ||
              entry.notes.toLowerCase().includes(courierUsername.toLowerCase())),
        ) || [];

      setDebugInfo(`Found ${courierHistoryData.length} relevant history entries for courier ${courierData.name} after filtering by notes.`);

      // Get unique AWB numbers from relevant history
      const awbNumbers = Array.from(new Set(courierHistoryData.map((item) => item.awb_number))).filter(Boolean);

      setDebugInfo(`Found ${awbNumbers.length} unique AWB numbers from relevant history after filtering.`);

      // === Mengambil detail shipment menggunakan query .in() ===
      const shipmentDetails: any[] = [];
      if (awbNumbers.length > 0) { // Hanya lakukan query jika ada AWB
          const { data: shipmentsData, error: shipmentsError } = await supabaseClient
            .from("shipments")
            .select("*")
            .in('awb_number', awbNumbers); // Ambil semua shipments yang AWB-nya ada di daftar AWB relevant

          if (shipmentsError) {
            setDebugInfo(`Error fetching shipments: ${shipmentsError.message}`);
            setIsLoading(false);
            return;
          }

          setDebugInfo(`Workspaceed ${shipmentsData?.length || 0} shipment details using .in().`);

           for (const shipment of shipmentsData || []) {
               // Cari latest history entry untuk shipment ini dari courierHistoryData (history relevant)
               // courierHistoryData sudah diurutkan berdasarkan created_at descending dari allHistoryData
               const latestHistory = courierHistoryData
                .find((item) => item.awb_number === shipment.awb_number); // Cari entri terbaru untuk AWB ini


                shipmentDetails.push({
                    ...shipment,
                    latest_update: latestHistory, // latestHistory sekarang menyertakan 'location'
                });
          }

      } else {
         setDebugInfo("No relevant AWB numbers found, skipping shipment details fetch.");
      }
      // === Akhir Mengambil detail shipment ===

       // === Urutkan shipmentDetails berdasarkan created_at latest_update (terbaru di atas) ===
       shipmentDetails.sort((a, b) => {
         const dateA = a.latest_update ? new Date(a.latest_update.created_at).getTime() : 0;
         const dateB = b.latest_update ? new Date(b.latest_update.created_at).getTime() : 0;

         const comparisonResult = dateB - dateA; // Logika descending

         return comparisonResult; // Urutan menurun (terbaru lebih dulu)
       });
       // === Akhir Pengurutan ===


      setShipments(shipmentDetails); // Set state shipments dengan data yang sudah diurutkan
      setDebugInfo(`Finished loading courier data for ${courierData?.name}.`);
      // Perhitungan jumlah per kategori akan dilakukan di useEffect setelah state shipments terupdate
      setIsLoading(false);
    } catch (err) {
      setDebugInfo(`Error loading courier data: ${err}`);
      setIsLoading(false);
    }
  };

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
        <TabsList className="mb-4 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          <TabsTrigger value="ongoing" className="rounded-lg font-bold text-xs sm:text-sm data-[state=active]:bg-gray-700 data-[state=active]:text-white dark:data-[state=active]:bg-gray-700 dark:text-gray-300">
            Ongoing
            <Badge variant="secondary" className="ml-2 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
              {ongoingCount} {/* Menggunakan state ongoingCount */}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="completed" className="rounded-lg font-bold text-xs sm:text-sm data-[state=active]:bg-gray-700 data-[state=active]:text-white dark:data-[state=active]:bg-gray-700 dark:text-gray-300">
            Completed
            <Badge
              variant="secondary"
              className="ml-2 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
            >
              {completedCount} {/* Menggunakan state completedCount */}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="issues" className="rounded-lg font-bold text-xs sm:text-sm data-[state=active]:bg-gray-700 data-[state=active]:text-white dark:data-[state=active]:bg-gray-700 dark:text-gray-300">
            Issues
            <Badge variant="secondary" className="ml-2 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
              {issuesCount} {/* Menggunakan state issuesCount */}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="all" className="rounded-lg font-bold text-xs sm:text-sm data-[state=active]:bg-gray-700 data-[state=active]:text-white dark:data-[state=active]:bg-gray-700 dark:text-gray-300">
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

        <TabsContent value="issues">
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
  if (shipments.length === 0) {
    return <div className="text-center py-8 text-gray-500 dark:text-gray-400">No shipments found</div>;
  }

  return (
    <div className="space-y-4">
      {shipments.map((shipment) => (
        <Card key={shipment.awb_number} className="overflow-hidden dark:border-gray-700 dark:bg-gray-900">
          <CardContent className="p-0">
            <div className="flex flex-col md:flex-row">
              <div className="p-4 md:w-1/4 bg-gray-100 dark:bg-gray-800">
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
                  {/* Prioritize Latest Update on top for mobile */}
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Latest Update</p>
                    <p className="font-medium text-gray-800 dark:text-gray-200">
                      {shipment.latest_update?.location ||
                       (shipment.latest_update?.latitude != null && shipment.latest_update?.longitude != null
                         ? `${shipment.latest_update.latitude?.toFixed(6)}, ${shipment.latest_update.longitude?.toFixed(6)}`
                         : "No location"
                       )}
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{shipment.latest_update?.notes || "No notes"}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {shipment.latest_update ? new Date(shipment.latest_update.created_at).toLocaleString() : ""}
                    </p>
                  </div>

                  {/* Receiver Info below Latest Update on mobile */}
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Receiver</p>
                    <p className="font-medium text-gray-800 dark:text-gray-200">{shipment.receiver_name || "N/A"}</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{shipment.receiver_address || "N/A"}</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{shipment.receiver_phone || "N/A"}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
