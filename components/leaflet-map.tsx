"use client"

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabaseClient } from '@/lib/auth'
import { DeliveryTruck as DeliveryTruckIcon } from '@carbon/icons-react' // Import Carbon icon
import { renderToString } from 'react-dom/server'

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
  const iconSvg = renderToString(
    <DeliveryTruckIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
  );
  return L.divIcon({
    html: `
      <div style="text-align: center; white-space: nowrap;">
        <div style="background-color: white; border-radius: 50%; padding: 4px; border: 2px solid #3b82f6; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
          ${iconSvg}
        </div>
        <div style="font-size: 0.7rem; font-weight: bold; color: #333; margin-top: 2px;">
          ${courierName}
        </div>
      </div>
    `,
    className: 'custom-courier-marker',
    iconSize: L.point(40, 40), // Adjust size based on content
    iconAnchor: L.point(20, 40), // Anchor to the bottom-middle of the icon
  });
};

interface CourierLocation {
  courier_id: string;
  latitude: number;
  longitude: number;
  updated_at: string;
  courier_name?: string; // Add courier name for display
}

export function LeafletMap() {
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Record<string, L.Marker>>({})
  const [courierLocations, setCourierLocations] = useState<CourierLocation[]>([])
  const [mapKey, setMapKey] = useState(0) // Add key to force re-render
  const lastFetchTime = useRef<number>(0) // Track last successful fetch time
  const isFetching = useRef<boolean>(false) // Prevent concurrent fetches

  const fetchCourierLocations = async () => {
    // Prevent concurrent fetches and rate limiting
    const now = Date.now();
    if (isFetching.current || (now - lastFetchTime.current < 4 * 60 * 1000)) { // 4 minutes minimum between fetches
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

      // Fetch latest locations for all couriers
      const { data: locations, error: locationsError } = await supabaseClient
        .from('courier_current_locations')
        .select('*')
        .order('updated_at', { ascending: false }); // Order by most recent first

      if (locationsError) {
        return;
      }

      // Map locations to include courier names
      const mergedData = locations.map(loc => {
        const courier = couriers?.find(c => c.id === loc.courier_id);
        return {
          ...loc,
          courier_name: courier?.name || 'Unknown Courier'
        };
      });

      setCourierLocations(mergedData);
      lastFetchTime.current = now; // Update last successful fetch time

    } catch (error) {
    } finally {
      isFetching.current = false;
    }
  };

  useEffect(() => {
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

    // Set up interval for refreshing locations (every 5 minutes to match courier update frequency)
    const intervalId = setInterval(() => {
      fetchCourierLocations();
    }, 5 * 60 * 1000); // 300 seconds = 5 minutes (reduced from 2 minutes)

    return () => {
      // Clear interval on component unmount
      clearInterval(intervalId);
      // Clean up map if needed (optional, as modal handles its unmount)
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapKey]); // Add mapKey as dependency to force re-initialization

  useEffect(() => {
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