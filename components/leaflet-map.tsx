"use client"

import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabaseClient } from '@/lib/auth'
import React from 'react'
import { RealtimeChannel } from '@supabase/supabase-js';
import 'leaflet.heat';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
// Marker clustering for performance when many couriers
import 'leaflet.markercluster';

interface IconPrototype extends L.Icon.Default {
  _getIconUrl?: string;
}

interface Location {
  courier_id: string;
  latitude: number;
  longitude: number;
  updated_at: string;
  created_at: string;
  notes: string;
}

interface Courier {
  id: string;
  name: string;
}

interface ShipmentHistoryLocation {
  awb_number: string;
  status?: string | null;
  created_at: string;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  location?: string | null;
}

interface CourierRouteSummary {
  awbNumber: string;
  deliveredAt: string;
  // Coordinates can be missing if no history row stored lat/lng for this AWB
  latitude?: number;
  longitude?: number;
  previousAwbNumber?: string;
}

// Fix for default icon issues with Leaflet and Webpack/Next.js
delete (L.Icon.Default.prototype as IconPrototype)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'leaflet/images/marker-icon-2x.png',
  iconUrl: 'leaflet/images/marker-icon.png',
  shadowUrl: 'leaflet/images/marker-shadow.png',
});

// Define default coordinates
const DEFAULT_LAT = -6.1791898249760635;
const DEFAULT_LNG = 106.71296491328197;
const INACTIVITY_MINUTES_GLOBAL = Number(process.env.NEXT_PUBLIC_COURIER_INACTIVE_MINUTES ?? '30');

// Define a custom icon for couriers using L.divIcon
const createCourierIcon = (courierName: string, borderColor: string) => {
  const imageUrl = '/leaflet/images/courier_map.png'; // Corrected path
  return L.divIcon({
    html: `
      <div class="courier-marker-container">
        <div class="courier-marker-icon" style="border-color:${borderColor};">
          <img src="${imageUrl}" alt="${courierName}" />
        </div>
        <div class="courier-marker-label">${courierName}</div>
      </div>
    `,
    className: 'custom-courier-marker',
    iconSize: [48, 60],
    iconAnchor: [24, 48],
    popupAnchor: [0, -50]
  });
};

interface CourierLocation {
  courier_id: string;
  latitude: number;
  longitude: number;
  updated_at: string;
  courier_name?: string; // Add courier name for display
}

interface MapExternalControlsApi {
  zoomIn: () => void;
  zoomOut: () => void;
  fitAll: () => void;
  toggleHeatmap: () => void;
  toggleCluster: () => void;
}

interface LeafletMapProps {
  onCouriersUpdated?: (lastUpdate: string | null, activeCount: number) => void;
  externalControls?: (api: MapExternalControlsApi) => void;
  autoFitOnLoad?: boolean; // if true, map fits all markers first time
}

export function LeafletMap({ onCouriersUpdated, externalControls, autoFitOnLoad = false }: LeafletMapProps) {
  const [courierLocations, setCourierLocations] = React.useState<CourierLocation[]>([])
  const [mapKey, setMapKey] = React.useState<number>(Date.now()) // Add key to force re-render
  const lastFetchTime = React.useRef<number>(0) // Track last successful fetch time
  const isFetching = React.useRef<boolean>(false) // Prevent concurrent fetches
  const [lastMapUpdateTime, setLastMapUpdateTime] = React.useState<string | null>(null); // Track when map data was last updated
  const [lastRealtimeUpdate, setLastRealtimeUpdate] = React.useState<string | null>(null); // Track realtime updates
  const subscriptionRef = React.useRef<RealtimeChannel | null>(null); // Reference to store subscription

  const mapRef = React.useRef<L.Map | null>(null)
  const markersRef = React.useRef<Record<string, L.Marker>>({})
  const clusterGroupRef = React.useRef<L.MarkerClusterGroup | null>(null)
  const pathLayerRef = React.useRef<L.LayerGroup | null>(null)
  const activeCourierIdRef = React.useRef<string | null>(null)
  const playbackLayerRef = React.useRef<L.LayerGroup | null>(null)
  const playbackTimerRef = React.useRef<number | null>(null)
  const [searchQuery, setSearchQuery] = React.useState<string>("")
  const [suggestions, setSuggestions] = React.useState<Array<{ id: string; name: string; lat: number; lng: number }>>([])
  const heatLayerRef = React.useRef<L.Layer | null>(null)
  const [clusterEnabled, setClusterEnabled] = React.useState<boolean>(true)
  const hasInitialFitRef = React.useRef<boolean>(false)

  // Add CSS styles to the document head for better marker rendering
  React.useEffect(() => {
    // Add custom CSS to document head
    const style = document.createElement('style');
    style.innerHTML = `
      /* Hide all default Leaflet controls */
      .leaflet-control-zoom,
      .leaflet-control-container .leaflet-top.leaflet-left,
      .leaflet-bar {
        display: none !important;
      }
      
      .courier-marker-container {
        text-align: center;
        position: relative;
        width: 48px;
      }
      .courier-marker-icon {
        background-color: white;
        border-radius: 50%;
        padding: 4px;
        border: 2px solid #3b82f6; /* overridden inline by freshness color */
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto;
      }
      .courier-marker-icon img {
        width: 32px;
        height: 32px;
        object-fit: contain;
      }
      .courier-marker-label {
        font-size: 0.7rem;
        font-weight: bold;
        color: #333;
        margin-top: 2px;
        background-color: rgba(255,255,255,0.8);
        border-radius: 3px;
        padding: 0 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 80px;
        margin: 2px auto 0;
      }
      .leaflet-div-icon {
        background: transparent;
        border: none;
      }
      .leaflet-marker-icon {
        filter: drop-shadow(0 0 1px rgba(0,0,0,0.5));
      }
      .courier-path-line {
        stroke-dasharray: 12 10;
        animation: courier-path-dash 1.2s linear infinite;
      }
      @keyframes courier-path-dash {
        from { stroke-dashoffset: 0; }
        to { stroke-dashoffset: 44; }
      }
      .courier-path-origin {
        filter: drop-shadow(0 0 6px rgba(37, 99, 235, 0.5));
      }
      .courier-popup {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        min-width: 200px;
        max-width: 100%;
      }
      .courier-popup__title {
        font-weight: 700;
        font-size: 0.95rem;
        margin-bottom: 4px;
        color: #1d4ed8;
      }
      .courier-popup__subtitle {
        font-size: 0.75rem;
        color: #374151;
        margin-bottom: 6px;
      }
      .courier-popup__coords {
        font-size: 0.72rem;
        color: #4b5563;
        margin-bottom: 6px;
      }
      .courier-popup__section {
        background: rgba(59, 130, 246, 0.08);
        border: 1px solid rgba(37, 99, 235, 0.25);
        border-radius: 6px;
        padding: 6px;
        margin-bottom: 6px;
      }
      .courier-popup__section-title {
        font-size: 0.75rem;
        font-weight: 600;
        color: #1d4ed8;
        margin-bottom: 4px;
      }
      .courier-popup__awb {
        font-family: 'Roboto Mono', 'Courier New', monospace;
        font-size: 0.9rem;
        font-weight: 700;
        color: #111827;
      }
      .courier-popup__meta {
        font-size: 0.72rem;
        color: #374151;
        line-height: 1.25;
        white-space: normal;
        word-break: break-word;
        overflow-wrap: anywhere;
      }
      .courier-popup__hint {
        font-size: 0.7rem;
        color: #2563eb;
        font-weight: 600;
        margin-top: 4px;
      }
      .courier-popup__note {
        font-size: 0.7rem;
        color: #1f2937;
        margin-top: 4px;
        line-height: 1.25;
        white-space: normal;
        word-break: break-word;
      }
      .courier-popup__empty {
        font-size: 0.72rem;
        color: #6b7280;
        margin-top: 4px;
      }
      /* Make Leaflet popup wrapper responsive */
      .leaflet-popup-content-wrapper {
        max-width: 320px;
        border-radius: 10px;
      }
      .leaflet-popup-content {
        margin: 8px 10px;
      }
      @media (max-width: 640px) {
        .leaflet-popup-content-wrapper { max-width: 84vw; }
        .courier-popup { min-width: 0; }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Tentukan semua nama tabel yang mungkin digunakan untuk lokasi kurir
  const possibleTableNames = React.useMemo(() => [
    'courier_current_locations',
    'courier_locations',
    'shipment_history' // Karena mungkin lokasi tersimpan di sini
  ], []);

  const processLocations = React.useCallback(async (locations: Location[], couriers: Courier[]) => {
    // Inactivity threshold (minutes) can be configured via NEXT_PUBLIC_COURIER_INACTIVE_MINUTES, default 30
    const INACTIVITY_MINUTES = Number(process.env.NEXT_PUBLIC_COURIER_INACTIVE_MINUTES ?? '30');
    const INACTIVITY_THRESHOLD_MS = Math.max(1, INACTIVITY_MINUTES) * 60 * 1000;
    const currentTime = Date.now();

    // Filter out locations older than the inactivity threshold and map to include courier names
    const mergedData = locations
      .filter(loc => {
        const updatedTime = new Date(loc.updated_at || loc.created_at).getTime();
        return (currentTime - updatedTime) <= INACTIVITY_THRESHOLD_MS;
      })
      .map(loc => {
        const courier = couriers?.find(c => c.id === loc.courier_id);
        return {
          ...loc,
          courier_name: courier?.name || 'Unknown Courier',
          updated_at: loc.updated_at || loc.created_at
        };
      });

    setCourierLocations(mergedData);
    const currentUpdateTime = new Date().toISOString();
    setLastMapUpdateTime(currentUpdateTime);

    if (onCouriersUpdated) {
      onCouriersUpdated(currentUpdateTime, mergedData.length);
    }
    
    lastFetchTime.current = Date.now();
  }, [onCouriersUpdated]);

  const fetchCourierLocations = React.useCallback(async () => {
    // Prevent concurrent fetches
    if (isFetching.current) {
      return;
    }

    isFetching.current = true;
    
    try {
      // Fetch all courier IDs and names
      const { data: couriers, error: couriersError } = await supabaseClient
        .from('users')
        .select('id, name')
        .or('role.eq.courier,role.eq.couriers');

      if (couriersError) {
        return;
      }

      // Coba cek tabel courier_current_locations
      const { data: currentLocations, error: currentLocationsError } = await supabaseClient
        .from('courier_current_locations')
        .select('*')
        .order('updated_at', { ascending: false });

      // Jika tabel courier_current_locations tidak ditemukan, coba ambil dari shipment_history
      if (currentLocationsError || !currentLocations || currentLocations.length === 0) {
        // Fetch dari shipment_history sebagai fallback
        const { data: shipmentHistory, error: historyError } = await supabaseClient
          .from('shipment_history')
          .select('courier_id, latitude, longitude, created_at, notes')
          .not('latitude', 'is', null)
          .not('longitude', 'is', null)
          .order('created_at', { ascending: false })
          .limit(200);

        if (!historyError && shipmentHistory && shipmentHistory.length > 0) {
          // Ambil lokasi terbaru untuk setiap kurir dari shipment_history
          const latestLocationByCourier = new Map<string, Location>();
          
          // Pastikan hanya mengambil data dengan courier_id yang valid
          shipmentHistory.forEach(entry => {
            if (
              entry.courier_id && 
              entry.latitude && 
              entry.longitude && 
              !latestLocationByCourier.has(entry.courier_id)
            ) {
              latestLocationByCourier.set(entry.courier_id, {
                courier_id: entry.courier_id,
                latitude: entry.latitude,
                longitude: entry.longitude,
                updated_at: entry.created_at,
                notes: entry.notes,
                created_at: entry.created_at
              });
            }
          });
          
          const locations = Array.from(latestLocationByCourier.values());
          await processLocations(locations, couriers as Courier[]);
        }
      } else {
        // Gunakan data dari courier_current_locations
        // Ambil hanya lokasi terbaru untuk setiap kurir
        const latestLocationByCourier = new Map<string, Location>();
        
        currentLocations.forEach((loc: Location) => {
          if (!latestLocationByCourier.has(loc.courier_id) || 
              new Date(loc.updated_at) > new Date(latestLocationByCourier.get(loc.courier_id)!.updated_at)) {
            latestLocationByCourier.set(loc.courier_id, loc);
          }
        });
        
        const uniqueLocations = Array.from(latestLocationByCourier.values());
        await processLocations(uniqueLocations, couriers as Courier[]);
      }

    } catch (error) {
      // Error handling
    } finally {
      isFetching.current = false;
    }
  }, [processLocations]);

  // Function to set up real-time subscription
  const setupRealtimeSubscription = React.useCallback(() => {
    // Clean up any existing subscription first
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    // Coba setup subscription untuk semua tabel yang mungkin
    possibleTableNames.forEach(tableName => {
      const channel = supabaseClient.channel(`realtime-${tableName}`);
      
      channel
        .on('postgres_changes', {
          event: '*', // Listen for all events (insert, update, delete)
          schema: 'public',
          table: tableName
        }, (payload) => {
          // Update status
          const currentTime = new Date().toISOString();
          setLastRealtimeUpdate(currentTime);
          
          // Force refresh lokasi
          fetchCourierLocations();
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            // console.log(`Successfully subscribed to ${tableName}`);
          }
        });
      
      // Simpan satu subscription saja untuk dibersihkan nanti
      if (tableName === possibleTableNames[0]) {
        subscriptionRef.current = channel;
      }
    });
  }, [fetchCourierLocations, possibleTableNames]);

  // Fungsi untuk polling manual (backup untuk realtime)
  const startPolling = React.useCallback(() => {
    // Set interval polling yang lebih sering (1 menit)
    const intervalId = setInterval(() => {
      fetchCourierLocations();
    }, 60 * 1000); // 60 seconds = 1 minute
    
    return intervalId;
  }, [fetchCourierLocations]);

  const fetchHeatmapPoints = React.useCallback(async (): Promise<Array<[number, number, number]>> => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabaseClient
      .from('shipment_history')
      .select('latitude, longitude, created_at')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .gte('created_at', twoHoursAgo)
      .order('created_at', { ascending: true })
      .limit(2000);
    if (error || !data) return [];
    const now = Date.now();
    return (data as Array<{latitude:number; longitude:number; created_at:string}>).map(r => {
      const t = new Date(r.created_at).getTime();
      const ageMin = Math.max(0, (now - t) / 60000);
      const weight = Math.max(0.3, 1 - ageMin / 120);
      return [r.latitude as number, r.longitude as number, weight];
    });
  }, []);

  const toggleHeatmap = React.useCallback(async () => {
    if (!mapRef.current) return;
    if (heatLayerRef.current) {
      mapRef.current.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
      return;
    }
    const pts = await fetchHeatmapPoints();
    if (pts.length === 0) return;
  const heat = (L as unknown as { heatLayer: (points: Array<[number, number, number]>, options: Record<string, unknown>) => L.Layer }).heatLayer;
  const hl = heat(pts, { radius: 26, blur: 22, maxZoom: 17, minOpacity: 0.35, gradient: {0.1:'#bfdbfe',0.35:'#93c5fd',0.6:'#3b82f6',0.85:'#1d4ed8',1:'#0b3ea1'} });
    hl.addTo(mapRef.current);
    heatLayerRef.current = hl;
  }, [fetchHeatmapPoints]);

  // Fungsi untuk membersihkan semua marker
  const clearAllMarkers = React.useCallback(() => {
    if (mapRef.current) {
      Object.values(markersRef.current).forEach(marker => {
        mapRef.current?.removeLayer(marker);
      });
      markersRef.current = {};
    }
  }, []);

  const escapeHtml = React.useCallback((value: string): string => {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }, []);

  const getFreshnessBorderColor = React.useCallback((updatedAtIso: string): string => {
    const t = new Date(updatedAtIso).getTime();
    const diffMin = Math.max(0, Math.floor((Date.now() - t) / 60000));
    if (diffMin <= 5) return '#10b981'; // green
    if (diffMin <= INACTIVITY_MINUTES_GLOBAL) return '#f59e0b'; // amber (<= inactive threshold)
    return '#9ca3af'; // gray (should be filtered out but keep safe default)
  }, []);

  const formatTimestamp = React.useCallback((isoDate: string | null | undefined): string => {
    if (!isoDate) {
      return '-';
    }
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }
    return date.toLocaleString('id-ID', {
      hour12: false,
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  const formatRelativeMinutes = React.useCallback((isoDate: string | null | undefined): string => {
    if (!isoDate) return '-';
    const now = Date.now();
    const t = new Date(isoDate).getTime();
    if (Number.isNaN(t)) return '-';
    const diffMin = Math.max(0, Math.floor((now - t) / 60000));
    if (diffMin < 1) return 'baru saja';
    if (diffMin < 60) return `${diffMin} menit yang lalu`;
    const hours = Math.floor(diffMin / 60);
    const minutes = diffMin % 60;
    return minutes === 0 ? `${hours} jam yang lalu` : `${hours} jam ${minutes} menit yang lalu`;
  }, []);

  const getDefaultPopupContent = React.useCallback((location: CourierLocation): string => {
    const courierName = escapeHtml(location.courier_name ?? 'Kurir');
    const rel = formatRelativeMinutes(location.updated_at);
    return `
      <div class="courier-popup">
        <div class="courier-popup__title">${courierName}</div>
        <div class="courier-popup__subtitle">Update terakhir ${formatTimestamp(location.updated_at)} · ${rel}</div>
        <div class="courier-popup__coords">Lat ${location.latitude.toFixed(4)}, Lng ${location.longitude.toFixed(4)}</div>
        <div class="courier-popup__hint">Klik marker untuk perjalanan & AWB terakhir. <button class="replay-btn" data-courier="${location.courier_id}" style="margin-left:6px;color:#1d4ed8;">Replay 30 menit</button></div>
      </div>
    `;
  }, [escapeHtml, formatRelativeMinutes, formatTimestamp]);

  const getLoadingPopupContent = React.useCallback((courierName: string): string => {
    return `
      <div class="courier-popup">
        <div class="courier-popup__title">${escapeHtml(courierName)}</div>
        <div class="courier-popup__meta">Memuat perjalanan terakhir...</div>
      </div>
    `;
  }, [escapeHtml]);

  const getNoHistoryPopupContent = React.useCallback((location: CourierLocation): string => {
    const base = getDefaultPopupContent(location).replace('Klik marker untuk perjalanan & AWB terakhir.', 'Belum ada histori perjalanan dengan lokasi.');
    return base;
  }, [getDefaultPopupContent]);

  const getLatestAwbPopupContent = React.useCallback((location: CourierLocation, summary: CourierRouteSummary): string => {
    // Popup when latest delivered AWB has no lat/lng yet; still show AWB details but no path
    const courierName = escapeHtml(location.courier_name ?? 'Kurir');
    const rel = formatRelativeMinutes(location.updated_at);

    return `
      <div class="courier-popup">
        <div class="courier-popup__title">${courierName}</div>
        <div class="courier-popup__subtitle">Update terakhir ${formatTimestamp(location.updated_at)} · ${rel}</div>
        <div class="courier-popup__coords">Lat ${location.latitude.toFixed(4)}, Lng ${location.longitude.toFixed(4)}</div>
        <div class="courier-popup__section">
          <div class="courier-popup__section-title">AWB</div>
          <div class="courier-popup__meta">Terbaru: <span class="courier-popup__awb">${escapeHtml(summary.awbNumber)}</span></div>
          ${summary.previousAwbNumber ? `<div class="courier-popup__meta">Sebelumnya: <span class="courier-popup__awb">${escapeHtml(summary.previousAwbNumber)}</span></div>` : ''}
          <div class="courier-popup__empty">Tidak ada titik lokasi pada AWB terbaru ini.</div>
        </div>
        <div class="courier-popup__hint">Klik marker lagi untuk menutup. <button class="replay-btn" data-courier="${location.courier_id}" style="margin-left:6px;color:#1d4ed8;">Replay 30 menit</button></div>
      </div>
    `;
  }, [escapeHtml, formatRelativeMinutes, formatTimestamp]);

  const getRoutePopupContent = React.useCallback((location: CourierLocation, route: CourierRouteSummary): string => {
    const courierName = escapeHtml(location.courier_name ?? 'Kurir');
    const rel = formatRelativeMinutes(location.updated_at);

    return `
      <div class="courier-popup">
        <div class="courier-popup__title">${courierName}</div>
        <div class="courier-popup__subtitle">Update terakhir ${formatTimestamp(location.updated_at)} · ${rel}</div>
        <div class="courier-popup__coords">Lat ${location.latitude.toFixed(4)}, Lng ${location.longitude.toFixed(4)}</div>
        <div class="courier-popup__section">
          <div class="courier-popup__section-title">AWB</div>
          <div class="courier-popup__meta">Terbaru: <span class="courier-popup__awb">${escapeHtml(route.awbNumber)}</span></div>
          ${route.previousAwbNumber ? `<div class="courier-popup__meta">Sebelumnya: <span class="courier-popup__awb">${escapeHtml(route.previousAwbNumber)}</span></div>` : ''}
        </div>
        <div class="courier-popup__hint">Klik marker lagi untuk sembunyikan perjalanan. <button class="replay-btn" data-courier="${location.courier_id}" style="margin-left:6px;color:#1d4ed8;">Replay 30 menit</button></div>
      </div>
    `;
  }, [escapeHtml, formatRelativeMinutes, formatTimestamp]);

  const clearPathLayer = React.useCallback(() => {
    if (pathLayerRef.current) {
      pathLayerRef.current.remove();
      pathLayerRef.current = null;
    }
  }, []);

  // wireReplayButton is defined after startPlayback; placeholder will be replaced below

  const clearPlayback = React.useCallback(() => {
    if (playbackTimerRef.current) {
      window.clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
    if (playbackLayerRef.current) {
      playbackLayerRef.current.remove();
      playbackLayerRef.current = null;
    }
  }, []);

  const fetchCourierPlaybackPoints = React.useCallback(async (courierId: string): Promise<Array<{lat:number; lng:number; t?: string}>> => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    // Prefer courier_current_locations (verified table) using updated_at only
    try {
      const { data: currentLocs, error: curErr } = await supabaseClient
        .from('courier_current_locations')
        .select('latitude, longitude, updated_at')
        .eq('courier_id', courierId)
        .gte('updated_at', thirtyMinAgo)
        .order('updated_at', { ascending: true })
        .limit(100);
      if (!curErr && currentLocs && currentLocs.length > 1) {
        return (currentLocs as Array<{latitude:number; longitude:number; updated_at?:string}>).map(r => ({ lat: r.latitude, lng: r.longitude, t: r.updated_at }));
      }
      // If still less than 2 points, take last 20 by time regardless of window and sort asc
      const { data: lastLocs } = await supabaseClient
        .from('courier_current_locations')
        .select('latitude, longitude, updated_at')
        .eq('courier_id', courierId)
        .order('updated_at', { ascending: false })
        .limit(20);
      if (lastLocs && lastLocs.length > 1) {
        const arr = (lastLocs as Array<{latitude:number; longitude:number; updated_at?:string}>).reverse();
        return arr.map(r => ({ lat: r.latitude, lng: r.longitude, t: r.updated_at }));
      }
    } catch {
      // ignore
    }
    return [];
  }, []);

  const startPlayback = React.useCallback(async (courierId: string, btn?: HTMLButtonElement) => {
    if (!mapRef.current) return;
    clearPlayback();
    const pts = await fetchCourierPlaybackPoints(courierId);
    if (!pts || pts.length < 2) {
      // Try to notify via popup if exists
      const m = markersRef.current[courierId];
      if (m && m.getPopup()) {
        const el = m.getPopup()!.getElement();
        if (el) {
          const hint = document.createElement('div');
          hint.style.fontSize = '0.75rem';
          hint.style.color = '#ef4444';
          hint.style.marginTop = '6px';
          hint.textContent = 'Replay tidak tersedia (tidak ada jejak lokasi 30 menit).';
          el.appendChild(hint);
        }
      }
      if (btn) {
        btn.title = 'Replay tidak tersedia (tidak ada jejak lokasi 30 menit)';
        btn.style.color = '#ef4444';
        setTimeout(() => { btn.style.color = '#1d4ed8'; }, 1500);
      }
      return;
    }
    const layer = L.layerGroup();
    const line = L.polyline(pts.map(p => [p.lat, p.lng]) as L.LatLngExpression[], { color: '#10b981', weight: 3, opacity: 0.85 });
    line.addTo(layer);
    const mover = L.circleMarker([pts[0].lat, pts[0].lng], { radius: 6, color: '#10b981', fillColor: '#a7f3d0', fillOpacity: 0.9 });
    mover.addTo(layer);
    layer.addTo(mapRef.current);
    playbackLayerRef.current = layer;

    // If the courier popup is open, close it during replay to prevent auto-pan from keeping focus on the marker
    const marker = markersRef.current[courierId];
    if (marker && typeof marker.isPopupOpen === 'function' && marker.isPopupOpen()) {
      try { marker.closePopup(); } catch { /* ignore */ }
      if (btn) {
        btn.title = 'Popup disembunyikan sementara agar rute terlihat penuh';
      }
    }
    // Adaptive speed: target total ~12s, min 300ms/step, max 1200ms/step
    const steps = pts.length - 1;
    const targetTotal = 12000;
    const stepDur = Math.min(1200, Math.max(300, Math.floor(targetTotal / Math.max(1, steps))));

    // Smooth easing between points using requestAnimationFrame
    let idx = 0;
    const animateSegment = () => {
      if (idx >= pts.length - 1) { clearPlayback(); return; }
      const from = pts[idx];
      const to = pts[idx + 1];
      const start = performance.now();
      const ease = (t: number) => t * (2 - t); // easeOutQuad
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / stepDur);
        const e = ease(p);
        const lat = from.lat + (to.lat - from.lat) * e;
        const lng = from.lng + (to.lng - from.lng) * e;
        mover.setLatLng([lat, lng]);
        if (p < 1 && playbackLayerRef.current) {
          requestAnimationFrame(tick);
        } else {
          idx += 1;
          animateSegment();
        }
      };
      requestAnimationFrame(tick);
    };
    animateSegment();
    // Fit view to playback line (ensure full route is visible)
    mapRef.current.fitBounds(line.getBounds().pad(0.25), { animate: true, padding: [32, 48] as unknown as L.PointExpression });
  }, [clearPlayback, fetchCourierPlaybackPoints]);

  const wireReplayButton = React.useCallback((marker: L.Marker, courierId: string) => {
    const popupEl = marker.getPopup()?.getElement();
    if (popupEl) {
      const btn = popupEl.querySelector<HTMLButtonElement>('button.replay-btn');
      if (btn) {
        btn.onclick = (e) => {
          e.preventDefault();
          startPlayback(courierId, btn);
        };
      }
    }
  }, [startPlayback]);

  const fetchCourierRecentPath = React.useCallback(async (courierId: string): Promise<CourierRouteSummary | null> => {
    try {
      const { data: deliveredShipments, error: shipmentsError } = await supabaseClient
        .from('shipments')
        .select('awb_number, updated_at, current_status')
        .eq('courier_id', courierId)
        // Case-insensitive status filter to avoid mismatch (e.g., Delivered/delivered)
        .in('current_status', ['delivered', 'Delivered', 'DELIVERED'])
        .order('updated_at', { ascending: false })
        .limit(2);

      if (shipmentsError || !deliveredShipments || deliveredShipments.length === 0) {
        return null;
      }

      const shipment = deliveredShipments[0];
      const previousShipment = deliveredShipments.length > 1 ? deliveredShipments[1] : null;
      if (!shipment) {
        return null;
      }

      // Try to find the latest history row WITH coordinates for this AWB
      const { data: historyRows, error: historyError } = await supabaseClient
        .from('shipment_history')
        .select('awb_number, status, created_at, latitude, longitude, notes, location')
        .eq('awb_number', shipment.awb_number)
        .order('created_at', { ascending: false })
        .limit(20); // check up to 20 recent entries to locate coordinates if exist

      if (historyError || !historyRows || historyRows.length === 0) {
        // Return summary WITHOUT coordinates so UI can still show the correct latest AWB
        return {
          awbNumber: shipment.awb_number,
          deliveredAt: shipment.updated_at,
          previousAwbNumber: previousShipment?.awb_number ?? undefined,
        };
      }

      // Pick the first row that has lat/lng; otherwise fallback to first row (no coords)
      const historyEntryWithCoords = (historyRows as ShipmentHistoryLocation[]).find(h => h.latitude != null && h.longitude != null);
      const topEntry = historyEntryWithCoords ?? (historyRows[0] as ShipmentHistoryLocation);

      return {
        awbNumber: shipment.awb_number,
        deliveredAt: topEntry.created_at,
        latitude: topEntry.latitude ?? undefined,
        longitude: topEntry.longitude ?? undefined,
        previousAwbNumber: previousShipment?.awb_number ?? undefined,
      };
    } catch (error) {
      return null;
    }
  }, []);

  const handleCourierMarkerClick = React.useCallback(async (location: CourierLocation) => {
    const courierId = location.courier_id;
    const marker = markersRef.current[courierId];
    if (!marker) {
      return;
    }

    if (activeCourierIdRef.current === courierId) {
      clearPathLayer();
      clearPlayback();
      activeCourierIdRef.current = null;
      marker.setPopupContent(getDefaultPopupContent(location));
      marker.openPopup();
      wireReplayButton(marker, courierId);
      return;
    }

    activeCourierIdRef.current = courierId;

    const courierName = location.courier_name ?? 'Kurir';
    if (!marker.getPopup()) {
      marker.bindPopup(getLoadingPopupContent(courierName));
    } else {
      marker.setPopupContent(getLoadingPopupContent(courierName));
    }
    marker.openPopup();

    const routeSummary = await fetchCourierRecentPath(courierId);

    if (activeCourierIdRef.current !== courierId) {
      return;
    }

    clearPathLayer();

    if (!mapRef.current) {
      marker.setPopupContent(getDefaultPopupContent(location));
      marker.openPopup();
      wireReplayButton(marker, courierId);
      return;
    }

    if (!routeSummary) {
      marker.setPopupContent(getNoHistoryPopupContent(location));
      marker.openPopup();
      return;
    }

    // If the latest AWB has no coordinates, just show its info without drawing a path
    if (routeSummary.latitude == null || routeSummary.longitude == null) {
      marker.setPopupContent(getLatestAwbPopupContent(location, routeSummary));
      marker.openPopup();
      if (mapRef.current) {
        // nudge view a bit to keep popup fully visible
        const currentCenter = mapRef.current.getCenter();
        mapRef.current.panTo(currentCenter, { animate: true });
      }
      wireReplayButton(marker, courierId);
      return;
    }

    const pathGroup = L.layerGroup();
    const routePoints: L.LatLngExpression[] = [
      [routeSummary.latitude, routeSummary.longitude],
      [location.latitude, location.longitude],
    ];

    const pathLine = L.polyline(routePoints, {
      color: '#2563eb',
      weight: 4,
      opacity: 0.85,
      dashArray: '12 10',
      className: 'courier-path-line',
    });
    pathLine.addTo(pathGroup);

    const originMarker = L.circleMarker([routeSummary.latitude, routeSummary.longitude], {
      radius: 8,
      color: '#1d4ed8',
      weight: 2,
      fillColor: '#bfdbfe',
      fillOpacity: 0.95,
      className: 'courier-path-origin',
    });
    originMarker.bindTooltip(`AWB ${escapeHtml(routeSummary.awbNumber)}`, { direction: 'top' });
    originMarker.addTo(pathGroup);

    pathGroup.addTo(mapRef.current);
    pathLayerRef.current = pathGroup;

    const bounds = L.latLngBounds(routePoints);
    mapRef.current.fitBounds(bounds.pad(0.2), {
      animate: true,
      paddingTopLeft: [32, 140] as unknown as L.PointExpression, // extra top space for popup
      paddingBottomRight: [32, 32] as unknown as L.PointExpression
    });

    marker.setPopupContent(getRoutePopupContent(location, routeSummary));
    marker.openPopup();
    // Wire replay button
    wireReplayButton(marker, courierId);
    // After opening the popup, nudge map down a bit so the popup does not cover the origin point
    if (mapRef.current) {
      mapRef.current.panBy([0, 80], { animate: true });
    }
  }, [clearPathLayer, escapeHtml, fetchCourierRecentPath, getDefaultPopupContent, getLoadingPopupContent, getNoHistoryPopupContent, getRoutePopupContent, getLatestAwbPopupContent, clearPlayback, wireReplayButton]);

  React.useEffect(() => {
    // Clean up existing map if it exists
    if (mapRef.current) {
      clearAllMarkers();
      mapRef.current.remove();
      mapRef.current = null;
    }

    // Initialize map with new default coordinates
    mapRef.current = L.map('map-container', {
      attributionControl: true,
      zoomControl: false,
      minZoom: 5,
      maxZoom: 18,
    }).setView([DEFAULT_LAT, DEFAULT_LNG], 10);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors · Leaflet × Amos',
      maxZoom: 18,
    }).addTo(mapRef.current);

    // Prepare cluster group
    clusterGroupRef.current = L.markerClusterGroup({
      disableClusteringAtZoom: 16,
      maxClusterRadius: 60,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true
    });
    clusterGroupRef.current.addTo(mapRef.current);

    // Provide external control API to parent
    if (externalControls) {
      externalControls({
        zoomIn: () => { if (mapRef.current) mapRef.current.zoomIn(); },
        zoomOut: () => { if (mapRef.current) mapRef.current.zoomOut(); },
        fitAll: () => {
          if (!mapRef.current) return;
          const markers = Object.values(markersRef.current);
            const b = new L.LatLngBounds([]);
            markers.forEach(m => b.extend(m.getLatLng()));
            if (markers.length > 0 && b.isValid()) {
              mapRef.current.fitBounds(b.pad(0.2));
            } else {
              mapRef.current.setView([DEFAULT_LAT, DEFAULT_LNG], 10);
            }
        },
        toggleHeatmap: () => { toggleHeatmap(); },
        toggleCluster: () => { setClusterEnabled(prev => !prev); }
      });
    }

    // Initial fetch
    fetchCourierLocations();

    // Set up realtime subscription
    setupRealtimeSubscription();

    // Set up polling interval as fallback
    const intervalId = startPolling();

    return () => {
      // Clean up on component unmount
      clearInterval(intervalId);
      
      // Unsubscribe from all channels
      possibleTableNames.forEach(tableName => {
        supabaseClient.removeChannel(supabaseClient.channel(`realtime-${tableName}`));
      });
      
      clearPathLayer();
      activeCourierIdRef.current = null;
      if (heatLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
      
      // Clean up map if needed
      if (mapRef.current) {
        clearAllMarkers();
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapKey, fetchCourierLocations, setupRealtimeSubscription, startPolling, possibleTableNames, clearAllMarkers, clearPathLayer, clearPlayback, toggleHeatmap]);

  React.useEffect(() => {
      if (mapRef.current) {
      // Clear existing markers
      if (clusterGroupRef.current) {
        clusterGroupRef.current.clearLayers();
      } else {
        Object.values(markersRef.current).forEach(marker => {
          mapRef.current?.removeLayer(marker);
        });
      }
      markersRef.current = {};
      clearPathLayer();
      activeCourierIdRef.current = null;

      let bounds = new L.LatLngBounds([]);

      if (courierLocations.length > 0) {
        // Create a unique set of courier IDs to prevent duplicates
        const uniqueCouriers = new Map<string, CourierLocation>();
        
        // Only keep the most recent location for each courier
        courierLocations.forEach(loc => {
          const existingLoc = uniqueCouriers.get(loc.courier_id);
          if (!existingLoc || new Date(loc.updated_at) > new Date(existingLoc.updated_at)) {
            uniqueCouriers.set(loc.courier_id, loc);
          }
        });
        
        // Create markers for unique couriers
        Array.from(uniqueCouriers.values()).forEach((loc) => {
          // Remove existing marker for this courier if it exists (handle both clustered and non-clustered cases)
          const existing = markersRef.current[loc.courier_id];
          if (existing) {
            if (clusterGroupRef.current && clusterGroupRef.current.hasLayer(existing)) {
              try { clusterGroupRef.current.removeLayer(existing); } catch { /* ignore */ }
            }
            if (mapRef.current && mapRef.current.hasLayer(existing)) {
              try { mapRef.current.removeLayer(existing); } catch { /* ignore */ }
            }
          }
          
          // Add a small random offset to prevent exact overlapping markers
          const jitter = 0.00002; // Small coordinate offset
          const jitteredLat = loc.latitude + (Math.random() - 0.5) * jitter;
          const jitteredLng = loc.longitude + (Math.random() - 0.5) * jitter;
          
          const borderColor = getFreshnessBorderColor(loc.updated_at);
          const newMarker = L.marker([jitteredLat, jitteredLng], { 
            icon: createCourierIcon(loc.courier_name || 'Kurir', borderColor),
            riseOnHover: true, // Rise above other markers on hover
            zIndexOffset: 1000 // Ensure higher z-index
          });

          newMarker.bindPopup(getDefaultPopupContent(loc), {
            autoPan: true,
            autoPanPadding: L.point(24, 24),
            closeButton: true,
            maxWidth: 360,
            keepInView: true,
          });
          if (clusterGroupRef.current) {
            clusterGroupRef.current.addLayer(newMarker);
          } else {
            newMarker.addTo(mapRef.current!);
          }

          // Add click listener to toggle detailed route
          newMarker.on('click', () => {
            // Don’t pre-center on the marker; let the route fitBounds show both points
            handleCourierMarkerClick(loc);
          });

          markersRef.current[loc.courier_id] = newMarker;
          bounds.extend([loc.latitude, loc.longitude]);
        });
        
        // Fit map to bounds of all markers
        if (autoFitOnLoad && bounds.isValid() && !hasInitialFitRef.current) {
          mapRef.current.fitBounds(bounds, { padding: [50, 50] });
          hasInitialFitRef.current = true;
        }
      } else {
        // If no couriers, set default view to updated coordinates
        mapRef.current.setView([DEFAULT_LAT, DEFAULT_LNG], 10);
      }
    }
  }, [clearPathLayer, courierLocations, getDefaultPopupContent, handleCourierMarkerClick, getFreshnessBorderColor, clusterEnabled]); // Rerun when courierLocations or cluster setting changes

  // React to cluster toggle by attaching/removing cluster layer
  React.useEffect(() => {
    if (!mapRef.current) return;
    if (clusterEnabled) {
      if (!clusterGroupRef.current) {
        clusterGroupRef.current = L.markerClusterGroup({
          disableClusteringAtZoom: 16,
          maxClusterRadius: 60,
          showCoverageOnHover: false,
          spiderfyOnMaxZoom: true
        });
        clusterGroupRef.current.addTo(mapRef.current);
      }
    } else if (clusterGroupRef.current) {
      clusterGroupRef.current.clearLayers();
      mapRef.current.removeLayer(clusterGroupRef.current);
      clusterGroupRef.current = null;
    }
  }, [clusterEnabled]);

  React.useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) { setSuggestions([]); return; }
    const unique = new Map<string, CourierLocation>();
    courierLocations.forEach(loc => {
      const prev = unique.get(loc.courier_id);
      if (!prev || new Date(loc.updated_at) > new Date(prev.updated_at)) {
        unique.set(loc.courier_id, loc);
      }
    });
    const list = Array.from(unique.values())
      .filter(loc => loc.courier_id.toLowerCase().includes(q) || (loc.courier_name ?? '').toLowerCase().includes(q))
      .slice(0, 8)
      .map(loc => ({ id: loc.courier_id, name: loc.courier_name ?? 'Kurir', lat: loc.latitude, lng: loc.longitude }));
    setSuggestions(list);
  }, [searchQuery, courierLocations]);

  return (
    <div className="relative w-full h-full">
      <div key={mapKey} id="map-container" className="w-full h-full rounded-lg" />

      {/* Search input */}
      <div className="absolute top-2 left-2 z-[1000]">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari kurir (nama/ID)"
          className="px-3 py-2 text-sm bg-white/90 backdrop-blur rounded-md shadow border border-gray-300 w-[220px] sm:w-[260px] focus:w-[260px] transition-all"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const q = searchQuery.trim().toLowerCase();
              const found = Object.entries(markersRef.current).find(([id, marker]) => {
                const loc = courierLocations.find(c => c.courier_id === id);
                const name = (loc?.courier_name ?? '').toLowerCase();
                return id.toLowerCase() === q || name.includes(q);
              });
              if (found && mapRef.current) {
                const [id, marker] = found;
                const loc = courierLocations.find(c => c.courier_id === id);
                if (loc) {
                  mapRef.current.setView([loc.latitude, loc.longitude], Math.max(mapRef.current.getZoom(), 15), { animate: true });
                  marker.openPopup();
                }
              }
            }
          }}
        />
        {suggestions.length > 0 && (
          <div className="mt-1 max-h-44 overflow-auto bg-white/95 backdrop-blur rounded-md shadow border border-gray-200 w-[220px] sm:w-[260px]">
            {suggestions.map(s => (
              <button
                key={s.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between"
                onClick={() => {
                  setSearchQuery(s.name);
                  if (mapRef.current) {
                    mapRef.current.setView([s.lat, s.lng], Math.max(mapRef.current.getZoom(), 15), { animate: true });
                  }
                  const m = markersRef.current[s.id];
                  if (m) { try { m.openPopup(); } catch { /* noop */ } }
                  setSuggestions([]);
                }}
              >
                <span className="truncate mr-2">{s.name}</span>
                <span className="text-[10px] text-gray-500">{s.id.slice(0,6)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
