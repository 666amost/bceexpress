"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  UserMultiple as UserMultipleIcon,
  WarningFilled as WarningIcon,
  CheckmarkFilled as CheckmarkIcon,
  Search as SearchIcon,
  Box as BoxIcon,
  DeliveryParcel as DeliveryParcelIcon,
  Renew as RefreshIcon,
  ChartArea as ChartIcon,
  LocationFilled as LocationPointIcon,
} from '@carbon/icons-react';
import { supabaseClient } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import dynamic from 'next/dynamic';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Oval as LoadingIcon } from 'react-loading-icons';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TrackingResults } from "@/components/tracking-results";
import * as Tooltip from '@radix-ui/react-tooltip';
import { CourierCard } from './CourierCard';
import { BulkUpdateModal } from './BulkUpdateModal';

const CourierShipmentList = dynamic(() => import('@/components/courier-shipment-list').then(mod => mod.CourierShipmentList), { 
  ssr: false, 
  loading: () => (
    <div className="flex justify-center items-center py-12">
      <div className="text-center">
        <LoadingIcon className="h-12 w-12 animate-spin mx-auto mb-4" style={{ color: '#4a5568', fontWeight: 'bold' }} />
        <p className="text-gray-600 dark:text-gray-400 font-semibold animate-pulse">Loading shipments...</p>
      </div>
    </div>
  )
});

const LeafletMap = dynamic(() => import('@/components/leaflet-map').then(mod => mod.LeafletMap), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center items-center py-12">
      <div className="text-center">
        <LoadingIcon className="h-12 w-12 animate-spin mx-auto mb-4" style={{ color: '#4a5568', fontWeight: 'bold' }} />
        <p className="text-gray-600 dark:text-gray-400 font-semibold animate-pulse">Loading map...</p>
      </div>
    </div>
  )
});

// Interfaces
interface Shipment {
  awb_number: string;
  current_status: string;
  courier_id: string;
  created_at: string;
  updated_at: string;
  city?: string;
}


interface Courier {
  id: string;
  name: string;
  email: string;
  role: string;
  latestLatitude?: number | null;
  latestLongitude?: number | null;
  latestLocationTime?: string | null;
  latestAwb?: string | null;
}

interface SearchResult extends Shipment {
  courier: string;
}

// Tambahkan tipe untuk live shipment activity
interface LiveShipmentActivityItem {
  awb_number: string;
  current_status: string;
  updated_at: string;
  courier_name: string;
  city?: string | null;
}

interface AdminLeaderContentProps {
  activeView: 'overview' | 'couriers' | 'shipments' | 'search';
  onTabChange: (tab: 'overview' | 'couriers' | 'shipments' | 'search') => void;
}

export function AdminLeaderContent({ activeView, onTabChange }: AdminLeaderContentProps) {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // State for shipment status update modal
  const [isStatusUpdateModalOpen, setIsStatusUpdateModalOpen] = useState<boolean>(false);
  const [selectedShipmentForUpdate, setSelectedShipmentForUpdate] = useState<SearchResult | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");
  const [updateNotes, setUpdateNotes] = useState<string>("");
  const [statusUpdateError, setStatusUpdateError] = useState<string>("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [courierStats, setCourierStats] = useState<Record<string, { total: number; completed: number; pending: number }>>({});
  const [totalShipments, setTotalShipments] = useState(0);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [totalPending, setTotalPending] = useState(0);
  const [dailyTarget, setDailyTarget] = useState(0);
  const [todayCompleted, setTodayCompleted] = useState(0);
  const [manifestTotal, setManifestTotal] = useState(0); // Total resi dari manifest_cabang hari ini
  const [pendingShipments, setPendingShipments] = useState<Shipment[]>([]);
  const [dataRange, setDataRange] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | { error: string } | null>(null);
  const [selectedCourier, setSelectedCourier] = useState<string | null>(null);
  const [isPendingModalOpen, setIsPendingModalOpen] = useState(false);
  const [isLocationMapOpen, setIsLocationMapOpen] = useState(false);
  const [isManifestModalOpen, setIsManifestModalOpen] = useState(false);
  const [sortOption, setSortOption] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">('asc');
  const [highPriorityThreshold, setHighPriorityThreshold] = useState(5);
  const [prioritySort, setPrioritySort] = useState<boolean>(false);
  const [mapRefreshKey, setMapRefreshKey] = useState(0);
  const [lastMapUpdateTime, setLastMapUpdateTime] = useState<string | null>(null);
  const [hasActiveCouriers, setHasActiveCouriers] = useState<boolean>(false);
  type MapControls = { zoomIn: () => void; zoomOut: () => void; fitAll: () => void; toggleHeatmap: () => void; toggleCluster: () => void };
  const [mapControls, setMapControls] = useState<MapControls | null>(null);
  
  // State untuk live shipment activity
  const [liveShipments, setLiveShipments] = useState<LiveShipmentActivityItem[]>([]);
  const [displayedShipments, setDisplayedShipments] = useState<LiveShipmentActivityItem[]>([]);
  const liveListRef = useRef<HTMLDivElement>(null);
  const [courierDailySummary, setCourierDailySummary] = useState<Array<{id:string; name:string; delivered:number; total:number; otd:number; lastAwbs:string[]}>>([]);
  const [courierSummarySort, setCourierSummarySort] = useState<'best'|'worst'>('best');
  const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
  const [bulkUpdateCourierId, setBulkUpdateCourierId] = useState<string>('');
  const [bulkUpdateStatus, setBulkUpdateStatus] = useState<string>('delivered');
  const [bulkUpdateNotes, setBulkUpdateNotes] = useState<string>('');
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [bulkUpdateError, setBulkUpdateError] = useState<string>('');
  const [totalPendingByCourier, setTotalPendingByCourier] = useState<Record<string, number>>({});

  const [activeCourierCount, setActiveCourierCount] = useState<number>(0);
  const handleCouriersUpdated = useCallback((lastUpdate: string | null, hasCouriers: boolean) => {
    setLastMapUpdateTime(lastUpdate);
    setHasActiveCouriers(hasCouriers);
  }, []);
  const handleActiveCountUpdated = useCallback((count: number) => {
    setActiveCourierCount(count);
  }, []);

  const fetchTotalPendingByCourier = useCallback(async () => {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoISO = sevenDaysAgo.toISOString();

      const { data: allPending } = await supabaseClient
        .from("shipments")
        .select("courier_id")
        .neq("current_status", "delivered")
        .lt("created_at", sevenDaysAgoISO);

      if (allPending) {
        const counts: Record<string, number> = {};
        allPending.forEach(s => {
          counts[s.courier_id] = (counts[s.courier_id] || 0) + 1;
        });
        setTotalPendingByCourier(counts);
      }
    } catch {
      setTotalPendingByCourier({});
    }
  }, []);

  useEffect(() => {
    if (isBulkUpdateModalOpen) {
      fetchTotalPendingByCourier();
    }
  }, [isBulkUpdateModalOpen, fetchTotalPendingByCourier]);

  const handleBulkUpdateSubmit = async () => {
    if (!bulkUpdateCourierId) {
      setBulkUpdateError("Please select a courier");
      return;
    }
    
    setIsBulkUpdating(true);
    setBulkUpdateError("");
    
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoISO = sevenDaysAgo.toISOString();

      const { data: pendingShipmentsList, error: fetchError } = await supabaseClient
        .from("shipments")
        .select("awb_number, current_status, created_at")
        .eq("courier_id", bulkUpdateCourierId)
        .neq("current_status", "delivered")
        .lt("created_at", sevenDaysAgoISO)
        .order("created_at", { ascending: true });

      if (fetchError) throw new Error(fetchError.message);

      if (!pendingShipmentsList || pendingShipmentsList.length === 0) {
        setBulkUpdateError("No old pending shipments found (older than 7 days).");
        setIsBulkUpdating(false);
        return;
      }

      const currentDate = new Date().toISOString();
      const awbNumbers = pendingShipmentsList.map(s => s.awb_number);
      
      const { error: updateError } = await supabaseClient
        .from("shipments")
        .update({ 
          current_status: bulkUpdateStatus, 
          updated_at: currentDate 
        })
        .in("awb_number", awbNumbers);

      if (updateError) throw new Error(updateError.message);

      const historyRecords = pendingShipmentsList.map((shipment) => ({
        awb_number: shipment.awb_number,
        status: bulkUpdateStatus,
        location: "Admin Bulk Update",
        notes: bulkUpdateNotes || `Bulk updated by admin to ${bulkUpdateStatus}`,
        created_at: currentDate,
      }));

      const batchSize = 100;
      for (let i = 0; i < historyRecords.length; i += batchSize) {
        const batch = historyRecords.slice(i, i + batchSize);
        const { error: historyError } = await supabaseClient
          .from("shipment_history")
          .insert(batch);
        
        if (historyError) throw new Error(historyError.message);
      }

      const detailMessage = `Successfully updated ${pendingShipmentsList.length} old pending shipments (>7 days) to ${bulkUpdateStatus}\n\nFirst 10 AWB:\n${awbNumbers.slice(0, 10).join('\n')}\n${awbNumbers.length > 10 ? `\n...and ${awbNumbers.length - 10} more` : ''}`;
      
      alert(detailMessage);
      setIsBulkUpdateModalOpen(false);
      setBulkUpdateCourierId('');
      setBulkUpdateStatus('delivered');
      setBulkUpdateNotes('');
      await loadDashboardData();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setBulkUpdateError(errorMessage);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const fetchLiveShipments = useCallback(async () => {
    try {
      // Ambil 3 shipment terakhir yang statusnya diupdate
      const { data: shipments, error } = await supabaseClient
        .from("shipments")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(3);

      if (error) {
        setLiveShipments([]);
        return;
      }
      
      if (!shipments || shipments.length === 0) {
        setLiveShipments([]);
        return;
      }

      // Ambil nama kurir
      const courierIds = shipments.map(s => s.courier_id).filter(Boolean);
      let courierNames: Record<string, string> = {};
      
      if (courierIds.length > 0) {
        const { data: courierData } = await supabaseClient
          .from("users")
          .select("id, name")
          .in("id", courierIds);
        
        if (courierData) {
          courierNames = courierData.reduce((acc, courier) => {
            acc[courier.id] = courier.name;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      const liveData = shipments.map(s => ({
        awb_number: s.awb_number || "UNKNOWN",
        current_status: s.current_status || "unknown",
        updated_at: s.updated_at || new Date().toISOString(),
        courier_name: courierNames[s.courier_id] || "Unknown",
        city: s.city || null,
      })).filter(item => item.awb_number !== "UNKNOWN");

      setLiveShipments(liveData);
    } catch {
      setLiveShipments([]);
    }
  }, []);

  const getDateRange = useCallback((days: number) => {
    const now = new Date();
    const endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999));
    const startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1), 0, 0, 0, 0));
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
  }, []);

  const loadDashboardData = useCallback(async (daysToLoad?: number) => {
    setIsLoading(true);
    const currentRange = daysToLoad !== undefined ? daysToLoad : dataRange;
    
    try {
      const { startDate, endDate } = getDateRange(currentRange);

      const { data: courierData, error: courierError } = await supabaseClient
        .from("users")
        .select("id, name, email, role")
        .or("role.eq.courier,role.eq.couriers")
        .order("name", { ascending: true });

      if (courierError || !courierData) {
        setIsLoading(false);
        return;
      }

      const { data: recentShipments, error: shipmentsError } = await supabaseClient
        .from("shipments")
        .select("awb_number, current_status, courier_id, created_at, updated_at")
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .order("created_at", { ascending: false });

      if (shipmentsError) {
        setIsLoading(false);
        return;
      }

  const shipmentsData = recentShipments || [];

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
      ]);

  const stats: Record<string, { total: number; completed: number; pending: number }> = {};
  const allPendingShipments: Shipment[] = [];
      let totalShipmentCount = totalCountResult.count || 0;
      let totalCompletedCount = completedCountResult.count || 0;
      let totalPendingCount = 0;

      courierData.forEach((courier) => {
        // Cocokkan baik berdasarkan users.id maupun users.email karena data lama bisa menyimpan email di kolom courier_id
        const courierShipments = shipmentsData.filter((s) => s.courier_id === courier.id || s.courier_id === courier.email);
        const total = courierShipments.length;
        const completed = courierShipments.filter((s) => s.current_status === "delivered").length;
        const pendingShipmentsList = courierShipments.filter((s) => s.current_status !== "delivered");
        const pending = pendingShipmentsList.length;

        stats[courier.id] = { total, completed, pending };
        totalPendingCount += pending;

        allPendingShipments.push(...pendingShipmentsList.slice(0, 50).map(shipment => ({ 
          ...shipment, 
          courier_id: courier.id 
        })));
      });

      setCouriers(courierData);
  setCourierStats(stats);
      setTotalShipments(totalShipmentCount);
      setTotalCompleted(totalCompletedCount);
      setTotalPending(totalPendingCount);
      setPendingShipments(allPendingShipments.slice(0, 100));

      // Build per-courier summary for the SELECTED RANGE using updated_at window so delivered dalam rentang terhitung walau created lebih lama
      const { data: shipmentsUpdatedInRange } = await supabaseClient
        .from('shipments')
        .select('awb_number, current_status, courier_id, created_at, updated_at')
        .gte('updated_at', startDate)
        .lte('updated_at', endDate)
        .order('updated_at', { ascending: false });
  // Gabungkan shipments yang masuk range via updated_at dan created_at untuk menghindari kosong pada kasus tertentu
  const shipmentsUpdMap = new Map<string, Shipment & { updated_at: string }>();
  (shipmentsData || []).forEach((s: Shipment) => shipmentsUpdMap.set(s.awb_number, s as Shipment & { updated_at: string }));
  (shipmentsUpdatedInRange || []).forEach((s: Shipment) => shipmentsUpdMap.set(s.awb_number, s as Shipment & { updated_at: string }));
  const shipmentsUpd = Array.from(shipmentsUpdMap.values());
      const byCourierToday: Array<{id:string; name:string; delivered:number; total:number; otd:number; lastAwbs:string[]}> = [];
      courierData.forEach(c => {
        // Lagi-lagi cocokkan id ATAU email
        const all = shipmentsUpd.filter(s => s.courier_id === c.id || s.courier_id === c.email);
        const delivered = all.filter(s => s.current_status === 'delivered').length;
        const total = all.length; // total aktifitas update dalam rentang
        const otd = total > 0 ? Math.round((delivered / total) * 100) : 0;
        const lastAwbs = all
          .sort((a,b)=> new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
          .slice(0,3)
          .map(s=> s.awb_number);
        byCourierToday.push({ id: c.id, name: c.name, delivered, total, otd, lastAwbs });
      });
      setCourierDailySummary(byCourierToday);

      // Fetch daily target (total shipments for today)
      const { startDate: todayStart, endDate: todayEnd } = getDateRange(1);
      const { count: dailyTargetCount } = await supabaseClient
        .from("shipments")
        .select("*", { count: 'exact', head: true })
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd);
      
      // Fetch today completed
      const { count: todayCompletedCount } = await supabaseClient
        .from("shipments")
        .select("*", { count: 'exact', head: true })
        .eq("current_status", "delivered")
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd);

      setDailyTarget(dailyTargetCount || 0);
      setTodayCompleted(todayCompletedCount || 0);

      // Fetch manifest total (total resi dari manifest_cabang hari ini)
      const { count: manifestTotalCount } = await supabaseClient
        .from("manifest_cabang")
        .select("*", { count: 'exact', head: true })
        .gte("awb_date", todayStart.split('T')[0]) // awb_date adalah date, jadi ambil bagian tanggal saja
        .lte("awb_date", todayEnd.split('T')[0]);

      setManifestTotal(manifestTotalCount || 0);

    } catch (err) {
      // Handle error silently
    } finally {
      setIsLoading(false);
    }
  }, [dataRange, getDateRange]);

  const sortedCouriers = useMemo(() => {
    const sortableCouriers = [...couriers];
    
    if (prioritySort) {
      sortableCouriers.sort((a, b) => {
        const pendingA = courierStats[a.id]?.pending || 0;
        const pendingB = courierStats[b.id]?.pending || 0;
        
        if (pendingA > highPriorityThreshold && pendingB <= highPriorityThreshold) return -1;
        if (pendingA <= highPriorityThreshold && pendingB > highPriorityThreshold) return 1;
        
        return pendingB - pendingA;
      });
      return sortableCouriers;
    }
    
    sortableCouriers.sort((a, b) => {
      let valA: string | number;
      let valB: string | number;

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
      } else {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return sortableCouriers;
  }, [couriers, courierStats, sortOption, sortOrder, prioritySort, highPriorityThreshold]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Saat data baru masuk, update displayedShipments dengan animasi scroll
  useEffect(() => {
    if (liveShipments.length === 0) return;
    
    // Jika data berubah (ada data baru di liveShipments[0]), animasi scroll
    if (
      displayedShipments.length > 0 &&
      liveShipments[0]?.awb_number !== displayedShipments[0]?.awb_number
    ) {
      // Animasi scroll ke bawah
      if (liveListRef.current) {
        liveListRef.current.style.transform = 'translateY(20px)';
        setTimeout(() => {
          setDisplayedShipments(liveShipments.slice(0, 3));
          if (liveListRef.current) {
            liveListRef.current.style.transform = 'translateY(0)';
          }
        }, 250);
      } else {
        setDisplayedShipments(liveShipments.slice(0, 3));
      }
    } else if (displayedShipments.length === 0) {
      setDisplayedShipments(liveShipments.slice(0, 3));
    }
  }, [displayedShipments, liveShipments]);

  // Auto-refresh live shipment activity setiap 10 detik
  useEffect(() => {
    fetchLiveShipments();
    const interval = setInterval(fetchLiveShipments, 10000);
    return () => clearInterval(interval);
  }, [fetchLiveShipments]);

  const handleRefresh = () => {
    setIsLoading(true);
    loadDashboardData();
  };

  const handleFixSync = useCallback(async (mismatches: Array<{awb: string; shipmentStatus: string; historyStatus: string}>) => {
    try {
      const currentDate = new Date().toISOString();
      let fixedCount = 0;

      for (const mismatch of mismatches) {
        const { error } = await supabaseClient
          .from("shipments")
          .update({
            current_status: mismatch.historyStatus,
            updated_at: currentDate
          })
          .eq("awb_number", mismatch.awb);

        if (!error) {
          fixedCount++;
        }
      }

      alert(`✅ Sync Fixed!\n\nUpdated ${fixedCount} out of ${mismatches.length} shipments.\nShipments table now matches history table.`);
      await loadDashboardData();
    } catch (err) {
      alert('Error fixing sync: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }, [loadDashboardData]);

  const handleVerifySync = useCallback(async (courierId: string) => {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoISO = sevenDaysAgo.toISOString();

      const { data: pendingShipments } = await supabaseClient
        .from("shipments")
        .select("awb_number, current_status")
        .eq("courier_id", courierId)
        .neq("current_status", "delivered")
        .lt("created_at", sevenDaysAgoISO);

      if (!pendingShipments || pendingShipments.length === 0) {
        alert("✅ All synced! No old pending shipments found.");
        return;
      }

      const mismatchList: Array<{awb: string; shipmentStatus: string; historyStatus: string}> = [];
      
      for (const ship of pendingShipments) {
        const { data: historyData } = await supabaseClient
          .from("shipment_history")
          .select("status")
          .eq("awb_number", ship.awb_number)
          .order("created_at", { ascending: false })
          .limit(1);

        const latestHistoryStatus = historyData?.[0]?.status;
        if (latestHistoryStatus && latestHistoryStatus !== ship.current_status) {
          mismatchList.push({
            awb: ship.awb_number,
            shipmentStatus: ship.current_status,
            historyStatus: latestHistoryStatus
          });
        }
      }

      if (mismatchList.length > 0) {
        const mismatchText = mismatchList.map(m => 
          `${m.awb}: shipment=${m.shipmentStatus}, history=${m.historyStatus}`
        ).join('\n');
        
        const userConfirm = confirm(
          `⚠️ Found mismatches:\n\n${mismatchText}\n\nTotal old pending: ${pendingShipments.length}\n\n` +
          `Do you want to FIX SYNC automatically?\n` +
          `This will update shipments table to match history table.`
        );

        if (userConfirm) {
          await handleFixSync(mismatchList);
        }
      } else {
        alert(`✅ Status synced!\n\nOld pending shipments: ${pendingShipments.length}\nAll shipments and history are in sync.`);
      }
    } catch (err) {
      alert('Error verifying sync: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }, [handleFixSync]);

  const handleRangeChange = (days: number) => {
    setDataRange(days);
    setIsLoading(true);
    loadDashboardData(days);
  };

  const handleSearch = async () => {
    setSearchResults(null);
    if (!searchQuery.trim()) return;

    const { data: awbShipment, error: awbError } = await supabaseClient
      .from('shipments')
      .select('*, updated_at')
      .eq('awb_number', searchQuery.trim())
      .single();

    if (awbShipment) {
      const { data: courierData } = await supabaseClient
        .from('users')
        .select('name')
        .eq('id', awbShipment.courier_id)
        .single();
      setSearchResults([{
        ...awbShipment,
        courier: courierData?.name || 'Unknown',
      }]);
      return;
    }

    const { data: couriersFound, error: courierSearchError } = await supabaseClient
      .from('users')
      .select('id, name')
      .ilike('name', `%${searchQuery.trim()}%`);

    if (couriersFound && couriersFound.length > 0) {
      const courierIds = couriersFound.map(c => c.id);
      const { startDate, endDate } = getDateRange(dataRange);
      const { data: courierShipments, error: shipmentsByCourierError } = await supabaseClient
        .from('shipments')
        .select('*, updated_at')
        .in('courier_id', courierIds)
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .order('updated_at', { ascending: false });

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

    setSearchResults({ error: 'No shipments or couriers found in filter ini' });
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex justify-center items-center">
          <div className="text-center">
            <LoadingIcon className="h-16 w-16 animate-spin mx-auto mb-4" style={{ color: '#1e40af', fontWeight: 'bold' }} />
            <p className="text-blue-900 dark:text-white font-semibold animate-pulse">Loading Dashboard...</p>
          </div>
        </div>
      );
    }

    // Overview view (main dashboard)
    if (activeView === 'overview') {
      return (
        <div className="space-y-6">
          {/* Header with filters */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-blue-100 dark:border-gray-700 p-6">
            <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div>
                <h2 className="text-xl font-bold text-blue-900 dark:text-white">BCE Express Dashboard</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Monitoring For Couriers BCE Express</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 7, 14, 30].map((days) => (
                  <Button 
                    key={days}
                  variant={dataRange === days ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleRangeChange(days)}
                  className={`${dataRange === days 
                    ? "bg-blue-600 hover:bg-blue-700 text-white" 
                    : "border-blue-200 dark:border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30"}`}
                >
                  {days}d
                </Button>
              ))}
              <Button 
                variant="outline" 
                onClick={handleRefresh}
                className="border-blue-200 dark:border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30"
              >
                <RefreshIcon className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Cards Grid - 2x2 on mobile, 4 columns on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-6 mb-4 sm:mb-6">
          {/* Live Shipment Activity Card - hanya tampil di desktop */}
          <div className="hidden lg:flex relative col-span-1 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl shadow-lg border border-blue-500 p-3 text-center flex-col aspect-square overflow-hidden">
            <div className="flex items-center justify-center gap-1 mb-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white dark:bg-gray-200 text-blue-600 dark:text-blue-700 shadow-md">
                Live Activity ({liveShipments.length})
              </span>
            </div>
            <div className="flex-1 flex flex-col justify-center overflow-hidden">
              <div
                ref={liveListRef}
                className="w-full flex flex-col gap-1 transition-transform duration-500 overflow-hidden"
              >
                {displayedShipments.slice(0, 2).map((item, idx) => (
                  <div
                    key={item.awb_number}
                    className={`rounded-lg px-2 py-1.5 flex flex-col text-left border border-blue-300 dark:border-blue-500 bg-white/90 dark:bg-gray-700/90 shadow-sm ${idx === 0 ? "font-bold" : "opacity-80"}`}
                  >
                    <div className="flex items-center gap-1 mb-1">
                      <span className="font-mono font-bold text-blue-700 dark:text-blue-300 text-xs truncate">{item.awb_number}</span>
                      {item.current_status === 'delivered' ? (
                        <span className="text-xs font-bold bg-green-200 text-green-800 rounded px-1 py-0.5 flex-shrink-0">✓</span>
                      ) : (
                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 rounded px-1 py-0.5 flex-shrink-0">●</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      <span className="font-semibold text-gray-700">{item.courier_name}</span>
                      <span className="mx-1">•</span>
                      <span>{new Date(item.updated_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))}
                {displayedShipments.length === 0 && (
                  <div className="flex flex-col items-center justify-center text-center py-4">
                    <svg className="h-6 w-6 text-white mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" />
                    </svg>
                    <span className="text-white text-xs">No recent activity</span>
                  </div>
                )}
              </div>
            </div>
            {displayedShipments.length > 2 && (
              <div className="mt-1 text-xs text-blue-100 font-medium">
                +{displayedShipments.length - 2} more
              </div>
            )}
          </div>
          
          {/* Card statistik - grid 2x2 di mobile, 4 kolom di desktop */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl sm:rounded-2xl shadow-lg border border-blue-400 p-3 sm:p-4 lg:p-6 text-center hover:shadow-xl transition-all duration-300 hover:scale-105 aspect-square flex flex-col justify-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 bg-white/20 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-2 sm:mb-3">
              <DeliveryParcelIcon className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-white" />
            </div>
            <span className="text-xs sm:text-sm font-bold text-white block mb-1">
              {dataRange === 1 ? "Today's" : "Recent"}
            </span>
            <span className="text-xl sm:text-2xl lg:text-4xl font-black text-white">{totalShipments}</span>
            <span className="text-xs text-blue-100 block">shipments</span>
          </div>
          
          <div className="bg-gradient-to-br from-red-500 to-red-700 rounded-xl sm:rounded-2xl shadow-lg border border-red-400 p-3 sm:p-4 lg:p-6 text-center hover:shadow-xl transition-all duration-300 hover:scale-105 aspect-square flex flex-col justify-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 bg-white/20 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-2 sm:mb-3 relative">
              <WarningIcon className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-white" />
              {totalPending > 0 && (
                <span className="absolute w-2 h-2 bg-yellow-400 rounded-full animate-ping top-0 right-0" />
              )}
            </div>
            <span className="text-xs sm:text-sm font-bold text-white block mb-1">Pending</span>
            <span className="text-xl sm:text-2xl lg:text-4xl font-black text-white block">
              {totalPending}
            </span>
            <Button onClick={() => setIsPendingModalOpen(true)} variant="link" size="sm" className="text-xs p-0 h-auto text-red-100 hover:text-white mt-1">
              (view details)
            </Button>
          </div>
          
          <div className="bg-gradient-to-br from-green-500 to-green-700 rounded-xl sm:rounded-2xl shadow-lg border border-green-400 p-3 sm:p-4 lg:p-6 text-center hover:shadow-xl transition-all duration-300 hover:scale-105 aspect-square flex flex-col justify-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 bg-white/20 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-2 sm:mb-3">
              <CheckmarkIcon className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-white" />
            </div>
            <span className="text-xs sm:text-sm font-bold text-white block mb-1">Completed</span>
            <span className="text-xl sm:text-2xl lg:text-4xl font-black text-white">{totalCompleted}</span>
            <span className="text-xs text-green-100 block">deliveries</span>
          </div>
          
          {/* Progress Pengiriman Hari Ini - Card ke-4 di mobile, sejajar dalam grid 2x2 */}
          <div className="lg:hidden bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl shadow-lg border border-blue-400 p-3 text-center flex flex-col justify-center items-center aspect-square">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-2">
              <ChartIcon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <span className="text-xs font-bold text-white block mb-1">Progress</span>
            <div className="flex items-center justify-center text-xs mb-2">
              <span className="font-bold text-white">{todayCompleted}</span>
              <span className="text-blue-100 mx-1">/</span>
              <span className="font-bold text-white">{dailyTarget}</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
              <div
                className="bg-white h-2 rounded-full transition-all duration-500"
                style={{ width: `${dailyTarget > 0 ? Math.min(100, Math.round((todayCompleted/dailyTarget)*100)) : 0}%` }}
              ></div>
            </div>
            <span className="text-xs text-blue-100 mt-1">today</span>
          </div>
        </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-blue-100 dark:border-gray-700 p-4 sm:p-6">
            <h3 className="text-lg font-bold text-blue-900 dark:text-white mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Button 
                className="bg-blue-600 hover:bg-blue-700 text-white h-12 w-full text-sm sm:text-base"
                onClick={() => setIsLocationMapOpen(true)}
              >
                <LocationPointIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                View Courier Locations
              </Button>
              <Button 
                variant="outline" 
                className="border-red-200 text-red-700 hover:bg-red-50 h-12 w-full text-sm sm:text-base"
                onClick={() => setIsPendingModalOpen(true)}
              >
                <WarningIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                View Pending Shipments
              </Button>
              <Button 
                variant="outline" 
                className="border-green-200 text-green-700 hover:bg-green-50 h-12 w-full text-sm sm:text-base"
                onClick={() => setIsManifestModalOpen(true)}
              >
                <ChartIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                View Manifest ({manifestTotal})
              </Button>
              <Button 
                className="bg-orange-600 hover:bg-orange-700 text-white h-12 w-full text-sm sm:text-base"
                onClick={() => setIsBulkUpdateModalOpen(true)}
              >
                <RefreshIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                Bulk Update Status
              </Button>
            </div>
          </div>        {/* Courier daily summary (delivered/total/otd) */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-blue-100 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-blue-900 dark:text-white">Courier Summary (Today)</h3>
            <div className="flex items-center gap-2">
              <Button size="sm" variant={courierSummarySort==='best'?'default':'outline'} onClick={()=>setCourierSummarySort('best')}>Best</Button>
              <Button size="sm" variant={courierSummarySort==='worst'?'default':'outline'} onClick={()=>setCourierSummarySort('worst')}>Worst</Button>
              <Button size="sm" variant="outline" onClick={()=> { setSortOption('completed'); setSortOrder(courierSummarySort==='best'?'desc':'asc'); onTabChange('couriers'); }}>View All</Button>
            </div>
          </div>
          {courierDailySummary.length === 0 ? (
            <p className="text-sm text-gray-500">No data today.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {courierDailySummary
                .sort((a,b)=> courierSummarySort==='best' ? b.otd - a.otd : a.otd - b.otd)
                .slice(0,12)
                .map(c => (
                <div key={c.id} className="rounded-lg border border-blue-100 dark:border-gray-700 p-3 flex items-center justify-between hover:bg-blue-50/40 dark:hover:bg-blue-900/20 transition">
                  <div className="min-w-0">
                    <div className="font-semibold text-blue-900 dark:text-white truncate">{c.name}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-300">Delivered {c.delivered} / {c.total}</div>
                    {c.lastAwbs.length>0 && (
                      <div className="text-[11px] text-gray-500 mt-1">
                        Last AWB:
                        <span className="ml-1 font-mono">{c.lastAwbs.join(', ')}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-green-600 dark:text-green-400">{c.otd}%</div>
                    <Button size="sm" variant="outline" className="mt-1 text-xs"
                      onClick={() => { setSelectedCourier(c.id); onTabChange('shipments'); }}>
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mobile Live Activity Section - only visible on mobile */}
        <div className="lg:hidden bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl shadow-lg border border-blue-500 p-4">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-lg font-bold px-3 py-1 rounded-full bg-white dark:bg-gray-200 text-blue-600 dark:text-blue-700 shadow-md">
              Live Activity ({liveShipments.length})
            </span>
          </div>
          <div className="space-y-3">
            {displayedShipments.slice(0, 3).map((item, idx) => (
              <div
                key={item.awb_number}
                className={`rounded-lg px-3 py-3 border border-blue-300 dark:border-blue-500 bg-white/90 dark:bg-gray-700/90 ${idx === 0 ? "font-bold" : "opacity-80"}`}
              >
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-mono font-bold text-blue-700 dark:text-blue-300 text-sm">{item.awb_number}</span>
                  {item.current_status === 'delivered' ? (
                    <span className="text-xs font-bold bg-green-200 text-green-800 rounded px-2 py-0.5">Delivered</span>
                  ) : (
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 rounded px-2 py-0.5 capitalize">{item.current_status.replace(/_/g, " ")}</span>
                  )}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-300 flex flex-wrap items-center gap-2">
                  <span>by <span className="font-semibold text-gray-800">{item.courier_name}</span></span>
                  <span>•</span>
                  <span>{new Date(item.updated_at).toLocaleTimeString()}</span>
                  {item.city && (
                    <>
                      <span>•</span>
                      <span>{item.city}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
            {displayedShipments.length === 0 && (
              <div className="py-6 flex flex-col items-center justify-center">
                <svg className="h-6 w-6 text-white mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" />
                </svg>
                <span className="text-white text-sm">No recent shipment activity</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Couriers view
  if (activeView === 'couriers') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 justify-between mb-4">
          <Button
            variant={prioritySort ? "default" : "outline"}
            onClick={() => setPrioritySort(!prioritySort)}
            className={`${prioritySort ? 'bg-red-600 hover:bg-red-700 text-white' : 'border-blue-200 dark:border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30'}`}
          >
            {prioritySort ? "Priority: ON" : "Priority: OFF"}
          </Button>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="border-blue-200 dark:border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30">
                  Sort By: {sortOption === 'name' ? 'Name' : sortOption === 'total' ? 'Total' : sortOption === 'pending' ? 'Pending' : 'Completed'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setSortOption('name')}>Name</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOption('total')}>Total Shipments</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOption('pending')}>Pending</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOption('completed')}>Completed</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedCouriers.map((courier) => (
            <CourierCard
              key={courier.id}
              courier={courier}
              stats={courierStats[courier.id] || { total: 0, pending: 0, completed: 0 }}
              isSelected={selectedCourier === courier.id}
              isHighPriority={(courierStats[courier.id]?.pending || 0) > highPriorityThreshold}
              onClick={() => setSelectedCourier(courier.id)}
              onDoubleClick={() => {
                setSelectedCourier(courier.id);
                onTabChange("shipments");
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  // Shipments view
  if (activeView === 'shipments') {
    return (
      <div className="space-y-6">
        {selectedCourier ? (
          <CourierShipmentList courierId={selectedCourier} dataRange={dataRange} isAdminView={true} />
        ) : (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-blue-100 dark:border-gray-700">
            <BoxIcon className="h-16 w-16 text-blue-400 mx-auto mb-4" />
            <p className="text-blue-900 dark:text-white font-semibold">Select a courier from the Couriers tab to view their shipments</p>
          </div>
        )}
      </div>
    );
  }

  // Search view
  if (activeView === 'search') {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-blue-100 dark:border-gray-700 p-4 sm:p-6">
          <div className="max-w-md mx-auto">
            <div className="mb-4 flex flex-col sm:flex-row gap-2">
              <Input 
                placeholder="Enter AWB number or courier name..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
                className="border-blue-200 focus:border-blue-500 w-full"
              />
              <Button 
                onClick={handleSearch}
                className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
              >
                <SearchIcon className="h-4 w-4" />
              </Button>
            </div>
            {searchResults ? (
              Array.isArray(searchResults) ? (
                searchResults.length > 0 ? (
                  <div className="space-y-4">
                    {searchResults.map((shipment) => (
                      <div key={shipment.awb_number} className="overflow-x-auto w-full">
                        <Card className="border-blue-100 dark:border-gray-700 shadow-md min-w-[320px] max-w-full">
                          <CardContent className="p-0">
                            {/* Render TrackingResults untuk setiap hasil pencarian resi */}
                            <div className="w-full max-w-full overflow-x-auto">
                              <TrackingResults awbNumber={shipment.awb_number} isPublicView={false} />
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 justify-end p-4 border-t mt-2">
                              <Button
                                variant="outline"
                                className="border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 w-full sm:w-auto"
                                onClick={() => {
                                  setSelectedShipmentForUpdate(shipment);
                                  setNewStatus(shipment.current_status);
                                  setUpdateNotes("");
                                  setStatusUpdateError("");
                                  setIsStatusUpdateModalOpen(true);
                                }}
                              >
                                Update Shipment
                              </Button>
                              <Button
                                variant="destructive"
                                className="border-red-300 text-red-700 hover:bg-red-50 w-full sm:w-auto"
                                onClick={async () => {
                                  if (confirm(`Delete AWB ${shipment.awb_number}?`)) {
                                    try {
                                      // Hapus dari shipment_history
                                      const { error: historyError } = await supabaseClient
                                        .from('shipment_history')
                                        .delete()
                                        .eq('awb_number', shipment.awb_number);

                                      if (historyError) {
                                        alert('Gagal menghapus shipment_history: ' + historyError.message);
                                        return;
                                      }

                                      // Hapus dari shipments
                                      const { error: shipmentError } = await supabaseClient
                                        .from('shipments')
                                        .delete()
                                        .eq('awb_number', shipment.awb_number);

                                      if (shipmentError) {
                                        alert('Gagal menghapus shipments: ' + shipmentError.message);
                                        return;
                                      }

                                      // Update hasil pencarian
                                      setSearchResults((prev) => {
                                        if (Array.isArray(prev)) {
                                          return prev.filter((s) => s.awb_number !== shipment.awb_number);
                                        }
                                        return prev;
                                      });
                                      alert(`AWB ${shipment.awb_number} berhasil dihapus.`);
                                    } catch (err) {
                                      alert('Terjadi error saat menghapus AWB.');
                                    }
                                  }
                                }}
                              >
                                Delete AWB
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center">No shipments found.</p>
                )
              ) : (
                <p className="text-red-600 text-center">{(searchResults as { error: string }).error}</p>
              )
            ) : (
              <div className="text-center py-8">
                <SearchIcon className="h-12 w-12 text-blue-400 mx-auto mb-4" />
                <p className="text-blue-900 dark:text-white font-semibold">Enter AWB number or courier name to search</p>
              </div>
            )}
          </div>
        </div>
        {/* Modal Update Status Shipment - letakkan di luar map agar tidak menyebabkan error JSX */}
        <Dialog open={isStatusUpdateModalOpen} onOpenChange={setIsStatusUpdateModalOpen}>
          <DialogContent className="max-w-md rounded-lg" aria-describedby="status-update-desc">
            <DialogHeader>
              <DialogTitle>Update Shipment Status</DialogTitle>
            </DialogHeader>
            <p id="status-update-desc" className="sr-only">Form untuk mengupdate status pengiriman</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!selectedShipmentForUpdate || !newStatus) {
                  setStatusUpdateError("Please select a status");
                  return;
                }
                setIsUpdatingStatus(true);
                setStatusUpdateError("");
                try {
                  const currentDate = new Date().toISOString();
                  // Update shipment status
                  const { error: updateError } = await supabaseClient
                    .from("shipments")
                    .update({ current_status: newStatus, updated_at: currentDate })
                    .eq("awb_number", selectedShipmentForUpdate.awb_number);
                  if (updateError) {
                    setStatusUpdateError(updateError.message || "Failed to update status");
                    setIsUpdatingStatus(false);
                    return;
                  }
                  // Add shipment history entry
                  const { error: historyError } = await supabaseClient
                    .from("shipment_history")
                    .insert({
                      awb_number: selectedShipmentForUpdate.awb_number,
                      status: newStatus,
                      location: "Admin Update", // Provide default location for admin updates
                      notes: updateNotes || `Status updated by admin to ${newStatus}`,
                      created_at: currentDate,
                    });
                  if (historyError) {
                    setStatusUpdateError(historyError.message || "Failed to add history");
                    setIsUpdatingStatus(false);
                    return;
                  }
                  setIsStatusUpdateModalOpen(false);
                  setSelectedShipmentForUpdate(null);
                  setNewStatus("");
                  setUpdateNotes("");
                  // Refresh search results
                  handleSearch();
                  alert("Status updated successfully");
                } catch (err: unknown) {
                  const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
                  setStatusUpdateError(`An unexpected error occurred: ${errorMessage}`);
                } finally {
                  setIsUpdatingStatus(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="processed">Processed</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="in_transit">In Transit</SelectItem>
                    <SelectItem value="out_for_delivery">Out For Delivery</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="exception">Exception</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes (optional)</label>
                <Textarea
                  value={updateNotes}
                  onChange={e => setUpdateNotes(e.target.value)}
                  placeholder="Add notes for this status update..."
                  className="w-full min-h-[60px]"
                />
              </div>
              {statusUpdateError && (
                <div className="text-red-600 text-sm">{statusUpdateError}</div>
              )}
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setIsStatusUpdateModalOpen(false)} disabled={isUpdatingStatus}>
                  Cancel
                </Button>
                <Button type="submit" variant="default" disabled={isUpdatingStatus}>
                  {isUpdatingStatus ? "Updating..." : "Update"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

    // Search view
    if (activeView === 'search') {
      return (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-blue-100 dark:border-gray-700 p-6">
            <div className="max-w-md mx-auto">
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Enter AWB number or courier name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 border-blue-200 focus:border-blue-500"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <SearchIcon className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>
            </div>

            {searchResults ? (
              Array.isArray(searchResults) ? (
                searchResults.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {searchResults.map((shipment) => (
                      <Card key={shipment.awb_number} className="border-blue-100 dark:border-gray-700">
                        <CardContent className="p-4">
                          <h3 className="font-bold text-blue-900 dark:text-white">AWB: {shipment.awb_number}</h3>
                          <p><strong>Courier:</strong> {shipment.courier}</p>
                          <p><strong>Status:</strong> {shipment.current_status?.replace(/_/g, " ") || "N/A"}</p>
                          {shipment.updated_at && (
                            <p><strong>Last Updated:</strong> {new Date(shipment.updated_at).toLocaleString()}</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center">No shipments found.</p>
                )
              ) : (
                <p className="text-red-600 text-center">{searchResults.error}</p>
              )
            ) : (
              <div className="text-center py-8">
                <SearchIcon className="h-12 w-12 text-blue-400 mx-auto mb-4" />
                <p className="text-blue-900 dark:text-white font-semibold">Enter AWB number or courier name to search</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      {renderContent()}

      {/* Modal: View Courier Locations (LeafletMap) */}
      <Dialog open={isLocationMapOpen} onOpenChange={setIsLocationMapOpen}>
        <DialogContent className="max-w-3xl w-full h-[80vh] sm:h-[80vh] p-0 overflow-hidden rounded-lg" aria-describedby="map-dialog-desc">
          <DialogHeader className="px-4 pt-3 pb-2">
            <DialogTitle className="text-blue-900 dark:text-white font-bold flex items-center gap-2 text-sm sm:text-base">
              <LocationPointIcon className="h-4 w-4 sm:h-5 sm:w-5" /> Courier Locations
            </DialogTitle>
          </DialogHeader>
          
          <div className="relative w-full h-[calc(80vh-60px)]">
            <LeafletMap externalControls={(api) => setMapControls(api)} onCouriersUpdated={handleCouriersUpdated} onActiveCountUpdated={handleActiveCountUpdated} autoFitOnLoad={false} />
            
            {/* Floating controls at bottom - visible above popup */}
            <div className="absolute bottom-2 left-2 right-2 z-[1000] bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-lg p-2">
              <div className="flex items-center justify-between gap-1.5 sm:gap-2 flex-wrap">
                <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                  <span className="hidden sm:inline text-[10px] font-semibold text-gray-600 dark:text-gray-300 mr-1">Controls:</span>
                  <Button variant="outline" onClick={() => mapControls?.zoomOut?.()} aria-label="Zoom out" className="h-7 sm:h-8 px-2 sm:px-3 text-[10px] sm:text-xs">Zoom −</Button>
                  <Button variant="outline" onClick={() => mapControls?.fitAll()} aria-label="Fit all" className="h-7 sm:h-8 px-2 sm:px-3 text-[10px] sm:text-xs">Fit</Button>
                  <Button variant="outline" onClick={() => mapControls?.toggleHeatmap()} aria-label="Toggle heatmap" className="h-7 sm:h-8 px-2 sm:px-3 text-[10px] sm:text-xs">Heat</Button>
                  <Button variant="outline" onClick={() => mapControls?.toggleCluster()} aria-label="Toggle clustering" className="h-7 sm:h-8 px-2 sm:px-3 text-[10px] sm:text-xs">Cluster</Button>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className={"inline-flex items-center rounded-full px-1.5 sm:px-2 py-0.5 sm:py-1 text-[9px] sm:text-[11px] font-medium " + (activeCourierCount>0?"bg-green-100 text-green-700":"bg-gray-100 text-gray-500")}>{activeCourierCount} aktif</span>
                  {lastMapUpdateTime && (
                    <span className="hidden sm:inline text-[10px] text-gray-500 dark:text-gray-400">Update: {new Date(lastMapUpdateTime).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <p id="map-dialog-desc" className="sr-only">Peta lokasi kurir dengan fitur cluster, heatmap, dan replay 1 jam terakhir.</p>
        </DialogContent>
      </Dialog>

      {/* Modal: View Manifest */}
      <ManifestModal open={isManifestModalOpen} onOpenChange={setIsManifestModalOpen} />

      {/* Pending Modal */}
      <Dialog open={isPendingModalOpen} onOpenChange={setIsPendingModalOpen}>
        <DialogContent className="max-w-md sm:max-w-2xl max-h-[80vh] rounded-lg shadow-xl" aria-describedby="pending-dialog-desc">
          <DialogHeader>
            <DialogTitle className="text-red-600 font-bold flex items-center gap-2">
              <span className="relative">
                <WarningIcon className="h-5 w-5" />
                {pendingShipments.length > 0 && (
                  <span className="absolute w-2 h-2 bg-red-500 rounded-full animate-ping -top-1 -right-1" />
                )}
              </span>
              <span>Pending Deliveries (Top 100)</span>
              {pendingShipments.length > 0 && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  {pendingShipments.length} Items
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <p id="pending-dialog-desc" className="sr-only">Daftar pengiriman yang belum delivered untuk periode terpilih.</p>
          <div className="overflow-y-auto max-h-[50vh]">
            {pendingShipments.length > 0 ? (
              <div className="space-y-2">
                {pendingShipments.map((shipment: Shipment): JSX.Element => {
                  const courier: Courier | undefined = couriers.find((c: Courier) => c.id === shipment.courier_id);
                  return (
                    <div key={shipment.awb_number} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-red-900">AWB: {shipment.awb_number}</p>
                          <p className="text-sm text-red-700">Status: {shipment.current_status?.replace(/_/g, " ") || "N/A"}</p>
                          {shipment.city && (
                            <p className="text-sm text-red-600">City: {shipment.city}</p>
                          )}
                          <p className="text-xs text-red-500">
                            Updated: {new Date(shipment.updated_at).toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-700 mt-1">
                            Kurir: <span className="font-semibold">{courier ? courier.name : 'Unknown'}</span>
                            {courier && courier.email ? (
                              <span className="ml-2 text-gray-400">({courier.email})</span>
                            ) : null}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">No pending shipments found</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Update Modal */}
      <BulkUpdateModal
        open={isBulkUpdateModalOpen}
        onOpenChange={(open) => {
          setIsBulkUpdateModalOpen(open);
          if (!open) setBulkUpdateError('');
        }}
        couriers={couriers}
        totalPendingByCourier={totalPendingByCourier}
        selectedCourierId={bulkUpdateCourierId}
        selectedStatus={bulkUpdateStatus}
        notes={bulkUpdateNotes}
        error={bulkUpdateError}
        isUpdating={isBulkUpdating}
        onCourierChange={setBulkUpdateCourierId}
        onStatusChange={setBulkUpdateStatus}
        onNotesChange={setBulkUpdateNotes}
        onSubmit={handleBulkUpdateSubmit}
        onVerifySync={handleVerifySync}
      />
      </>
    );
  }


interface ManifestRow {
  id: string;
  awb_no: string;
  awb_date: string;
  origin_branch: string;
  kota_tujuan: string;
  alamat_penerima?: string | null;
}

interface ManifestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ManifestModal({ open, onOpenChange }: ManifestModalProps) {

  const [data, setData] = React.useState<ManifestRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedAddress, setSelectedAddress] = React.useState<string | null>(null);
  const [isAddressDialogOpen, setIsAddressDialogOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const handleCopyAddress = async () => {
    if (!selectedAddress) return;
    try {
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(selectedAddress);
      } else {
        const el = document.createElement('textarea');
        el.value = selectedAddress;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // ignore
    }
  };

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    supabaseClient
      .from("manifest_cabang")
      .select("id, awb_no, awb_date, origin_branch, kota_tujuan, alamat_penerima")
      .order("awb_date", { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setData(data || []);
        setLoading(false);
      });
  }, [open]);

  const filteredData = React.useMemo(() => {
    if (!searchQuery.trim()) return data;
    
    const query = searchQuery.toLowerCase().trim();
    return data.filter((row) => {
      return (
        row.awb_no?.toLowerCase().includes(query) ||
        row.kota_tujuan?.toLowerCase().includes(query) ||
        row.alamat_penerima?.toLowerCase().includes(query) ||
        row.origin_branch?.toLowerCase().includes(query)
      );
    });
  }, [data, searchQuery]);

  const handleClearSearch = React.useCallback(() => {
    setSearchQuery("");
  }, []);

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-full rounded-lg" aria-describedby="manifest-dialog-desc">
        <DialogHeader>
          <DialogTitle className="text-green-700 dark:text-green-400 font-bold flex items-center gap-2">
            <ChartIcon className="h-5 w-5" /> Manifest Cabang
          </DialogTitle>
        </DialogHeader>
        <p id="manifest-dialog-desc" className="sr-only">Daftar manifest cabang hari ini</p>
        
        <div className="px-4 pb-2">
          <div className="relative">
            <svg 
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none" 
              fill="none" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth="2" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari..."
              className="w-full px-3 py-2 pl-10 pr-10 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label="Clear search"
              >
                <svg className="h-4 w-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
              Ditemukan {filteredData.length} dari {data.length} data
            </p>
          )}
        </div>

        <div className="overflow-x-auto max-h-[60vh]">
          {loading ? (
            <div className="text-center py-8 text-green-700 dark:text-green-400 font-semibold">Loading manifest...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-600 dark:text-red-400 font-semibold">{error}</div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {searchQuery ? `Tidak ditemukan data dengan kata kunci "${searchQuery}"` : 'No manifest data found.'}
            </div>
          ) : (
            <table className="min-w-full text-xs sm:text-sm">
              <thead>
                <tr className="bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-300">
                  <th className="px-2 py-1">AWB</th>
                  <th className="px-2 py-1">Tanggal</th>
                  <th className="px-2 py-1">Tujuan</th>
                  <th className="px-2 py-1">Alamat Penerima</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row) => (
                  <tr key={row.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-green-50 dark:hover:bg-green-900/20">
                    <td className="px-2 py-1 font-mono text-gray-900 dark:text-gray-100">{row.awb_no}</td>
                    <td className="px-2 py-1 text-gray-900 dark:text-gray-100">{row.awb_date}</td>
                    <td className="px-2 py-1 text-gray-900 dark:text-gray-100">{row.kota_tujuan}</td>
                    <td className="px-2 py-1 max-w-[260px]">
                      {row.alamat_penerima ? (
                        <Tooltip.Provider>
                          <Tooltip.Root>
                            <Tooltip.Trigger asChild>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedAddress(row.alamat_penerima || null);
                                  setIsAddressDialogOpen(true);
                                }}
                                className="truncate text-sm text-gray-700 dark:text-gray-300 max-w-[240px] text-left flex items-center gap-2"
                                style={{ cursor: 'pointer' }}
                              >
                                <span className="flex-1 truncate">{row.alamat_penerima}</span>
                                <span className="text-gray-400 dark:text-gray-500 text-sm ml-1">›</span>
                              </button>
                            </Tooltip.Trigger>
                            <Tooltip.Content side="top" align="center" className="bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 text-xs rounded px-2 py-1 max-w-[320px] break-words">
                              {row.alamat_penerima}
                              <Tooltip.Arrow className="fill-current text-gray-800 dark:text-gray-200" />
                            </Tooltip.Content>
                          </Tooltip.Root>
                        </Tooltip.Provider>
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Dialog to show full address on click (mobile-friendly) */}
    <Dialog open={isAddressDialogOpen} onOpenChange={setIsAddressDialogOpen}>
      <DialogContent className="max-w-md w-full rounded-lg" aria-describedby="address-dialog-desc">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-gray-800 dark:text-gray-200">Alamat Penerima</DialogTitle>
        </DialogHeader>
        <p id="address-dialog-desc" className="sr-only">Detail alamat penerima lengkap</p>
        <div className="p-4">
          <p className="text-sm text-gray-700 dark:text-gray-300 break-words">{selectedAddress ?? '-'}</p>
        </div>
        <div className="p-4 pt-0 flex justify-end gap-2">
          <Button onClick={handleCopyAddress} className="bg-green-600 hover:bg-green-700 text-white" size="sm">
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button onClick={() => setIsAddressDialogOpen(false)} className="bg-blue-600 hover:bg-blue-700 text-white" size="sm">Close</Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
