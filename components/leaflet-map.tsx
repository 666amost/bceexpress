"use client"

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabaseClient } from '@/lib/auth'
import React from 'react'

// Fix for default icon issues with Leaflet and Webpack/Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'leaflet/images/marker-icon-2x.png',
  iconUrl: 'leaflet/images/marker-icon.png',
  shadowUrl: 'leaflet/images/marker-shadow.png',
});

// Define default coordinates
const DEFAULT_LAT = -6.1791898249760635;
const DEFAULT_LNG = 106.71296491328197;

// Define a custom icon for couriers using L.divIcon
const createCourierIcon = (courierName: string) => {
  const imageUrl = '/leaflet/images/courier_map.png'; // Corrected path
  return L.divIcon({
    html: `
      <div style="text-align: center; white-space: nowrap;">
        <div style="background-color: white; border-radius: 50%; padding: 4px; border: 2px solid #3b82f6; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.2); width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
          <img src="${imageUrl}" style="width: 32px; height: 32px; object-fit: contain;" />
        </div>
        <div style="font-size: 0.7rem; font-weight: bold; color: #333; margin-top: 2px;">
          ${courierName}
        </div>
      </div>
    `,
    className: 'custom-courier-marker',
    iconSize: L.point(48, 48), // Adjust size based on content
    iconAnchor: L.point(24, 48), // Anchor to the bottom-middle of the icon
    popupAnchor: L.point(0, -60) // Adjust popup position (X: centered, Y: up from iconAnchor)
  });
};

interface CourierLocation {
  courier_id: string;
  latitude: number;
  longitude: number;
  updated_at: string;
  courier_name?: string; // Add courier name for display
}

interface LeafletMapProps {
    onCouriersUpdated?: (lastUpdate: string | null, hasCouriers: boolean) => void;
}

export function LeafletMap({ onCouriersUpdated }: LeafletMapProps) {
  const [courierLocations, setCourierLocations] = React.useState<CourierLocation[]>([])
  const [mapKey, setMapKey] = React.useState<number>(Date.now()) // Add key to force re-render
  const lastFetchTime = React.useRef<number>(0) // Track last successful fetch time
  const isFetching = React.useRef<boolean>(false) // Prevent concurrent fetches
  const [lastMapUpdateTime, setLastMapUpdateTime] = React.useState<string | null>(null); // Track when map data was last updated
  const [lastRealtimeUpdate, setLastRealtimeUpdate] = React.useState<string | null>(null); // Track realtime updates
  const subscriptionRef = React.useRef<any>(null); // Reference to store subscription

  const mapRef = React.useRef<L.Map | null>(null)
  const markersRef = React.useRef<Record<string, L.Marker>>({})

  // Tentukan semua nama tabel yang mungkin digunakan untuk lokasi kurir
  const possibleTableNames = React.useMemo(() => [
    'courier_current_locations',
    'courier_locations',
    'shipment_history' // Karena mungkin lokasi tersimpan di sini
  ], []);

  const processLocations = React.useCallback(async (locations: any[], couriers: any[]) => {
    // Define an inactivity threshold (e.g., 30 minutes for active couriers - diperpanjang)
    const INACTIVITY_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes in milliseconds
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
      onCouriersUpdated(currentUpdateTime, mergedData.length > 0);
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
          .select('courier_id, latitude, longitude, created_at')
          .not('latitude', 'is', null)
          .not('longitude', 'is', null)
          .order('created_at', { ascending: false })
          .limit(100);

        if (!historyError && shipmentHistory && shipmentHistory.length > 0) {
          // Ambil lokasi terbaru untuk setiap kurir dari shipment_history
          const latestLocationByCourier = new Map();
          
          shipmentHistory.forEach(entry => {
            if (entry.courier_id && !latestLocationByCourier.has(entry.courier_id)) {
              latestLocationByCourier.set(entry.courier_id, {
                courier_id: entry.courier_id,
                latitude: entry.latitude,
                longitude: entry.longitude,
                updated_at: entry.created_at
              });
            }
          });
          
          const locations = Array.from(latestLocationByCourier.values());
          await processLocations(locations, couriers);
        }
      } else {
        // Gunakan data dari courier_current_locations
        await processLocations(currentLocations, couriers);
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

  React.useEffect(() => {
    // Clean up existing map if it exists
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    // Initialize map with new default coordinates
    mapRef.current = L.map('map-container').setView([DEFAULT_LAT, DEFAULT_LNG], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(mapRef.current);

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
      
      // Clean up map if needed
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapKey, fetchCourierLocations, setupRealtimeSubscription, startPolling, possibleTableNames]);

  React.useEffect(() => {
    if (mapRef.current) {
      // Clear existing markers
      Object.values(markersRef.current).forEach(marker => {
        mapRef.current?.removeLayer(marker);
      });
      markersRef.current = {};

      let bounds = new L.LatLngBounds([]);

      if (courierLocations.length > 0) {
        courierLocations.forEach((loc) => {
          const newMarker = L.marker([loc.latitude, loc.longitude], { icon: createCourierIcon(loc.courier_name || 'Kurir') })
            .bindPopup(`<b>${loc.courier_name}</b><br>Lat: ${loc.latitude.toFixed(4)}<br>Lon: ${loc.longitude.toFixed(4)}<br>Updated: ${new Date(loc.updated_at).toLocaleTimeString()}`);
          
          newMarker.addTo(mapRef.current!);
          // Add click listener to zoom in on the marker
          newMarker.on('click', () => {
            mapRef.current?.setView([loc.latitude, loc.longitude], 15); // Zoom to level 15
          });

          markersRef.current[loc.courier_id] = newMarker;
          bounds.extend([loc.latitude, loc.longitude]);
        });
        
        // Fit map to bounds of all markers
        if (bounds.isValid()) {
          mapRef.current.fitBounds(bounds, { padding: [50, 50] }); // Add some padding
        }
      } else {
        // If no couriers, set default view to updated coordinates
        mapRef.current.setView([DEFAULT_LAT, DEFAULT_LNG], 10);
      }
    }
  }, [courierLocations]); // Rerun when courierLocations changes

  return (
    <div key={mapKey} id="map-container" className="w-full h-full rounded-lg" />
  );
} 