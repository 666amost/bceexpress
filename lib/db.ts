import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

// Initialize Supabase client with explicit URL and key values
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ""

// Membuat client dengan opsi yang lebih lengkap
export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    fetch: fetch.bind(globalThis)
  },
  // Opsi ini membantu mengurangi peringatan browser
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

export type ShipmentStatus = "processed" | "shipped" | "in_transit" | "out_for_delivery" | "delivered" | "exception"

export interface ShipmentHistory {
  id: string
  awb_number: string
  status: ShipmentStatus
  location: string
  notes?: string
  photo_url?: string
  created_at: string
  latitude?: number
  longitude?: number
}

export interface Shipment {
  awb_number: string
  sender_name: string
  sender_address: string
  sender_phone: string
  receiver_name: string
  receiver_address: string
  receiver_phone: string
  weight: number
  dimensions: string
  service_type: string
  current_status: ShipmentStatus
  created_at: string
  updated_at: string
}

// Fetch shipment by AWB number
export async function getShipmentByAwb(awbNumber: string): Promise<Shipment | null> {
  const { data, error } = await supabase.from("shipments").select("*").eq("awb_number", awbNumber).single()

  if (error || !data) {
    return null
  }

  return data as Shipment
}

// Fetch shipment history by AWB number
export async function getShipmentHistory(awbNumber: string): Promise<ShipmentHistory[]> {
  const { data, error } = await supabase
    .from("shipment_history")
    .select("*")
    .eq("awb_number", awbNumber)
    .order("created_at", { ascending: false })

  if (error || !data) {
    return []
  }

  return data as ShipmentHistory[]
}

// Add new shipment history entry
export async function addShipmentHistory(
  historyEntry: Omit<ShipmentHistory, "id" | "created_at">,
): Promise<ShipmentHistory | null> {
  // Update the current status in the shipments table
  const { error: updateError } = await supabase
    .from("shipments")
    .update({
      current_status: historyEntry.status,
      updated_at: new Date().toISOString(),
    })
    .eq("awb_number", historyEntry.awb_number)

  if (updateError) {
    return null
  }

  // Add the history entry
  const { data, error } = await supabase.from("shipment_history").insert([historyEntry]).select().single()

  if (error || !data) {
    return null
  }

  return data as ShipmentHistory
}

// Upload proof of delivery image
export async function uploadImage(file: File, awbNumber: string): Promise<string | null> {
  const fileExt = file.name.split(".").pop()
  const fileName = `${awbNumber}-${Date.now()}.${fileExt}`
  const filePath = `proof-of-delivery/${fileName}`

  const { error } = await supabase.storage.from("shipment-photos").upload(filePath, file)

  if (error) {
    return null
  }

  const { data } = supabase.storage.from("shipment-photos").getPublicUrl(filePath)

  return data.publicUrl
}

// Check if AWB exists in manifest
export async function checkManifestAwb(awbNumber: string): Promise<any> {
  const { data, error } = await supabase.from("manifest").select("*").eq("awb_no", awbNumber).single()

  if (error) {
    return null
  }

  return data
}

// Create shipment from manifest
export async function createShipmentFromManifest(awbNumber: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("create_shipment_from_manifest", { awb_number: awbNumber })

    if (error) {
      return false
    }

    return true
  } catch (error) {
    return false
  }
}

// Tambahan baru: Fungsi untuk mengambil resi yang belum disinkronisasi
export async function getUndeliveredShipments(awbNumber?: string) {
  let query = supabase
    .from('shipment_history')
    .select('*')
    .eq('status', 'delivered')
    .like('awb_number', 'BE%');

  if (awbNumber) {
    query = query.eq('awb_number', awbNumber);  // Filter hanya untuk AWB spesifik
  }

  const { data, error } = await query;
  
  if (error) {
    return [];  // Kembalikan array kosong jika ada error
  }

  return data;  // Kembalikan array dari resi yang memenuhi kriteria
}

// Fungsi baru untuk mengambil nama pengguna berdasarkan user_id
export async function getUserNameById(userId: string): Promise<string | null> {
  if (!userId) {
    return null;  // Kembalikan null jika user_id kosong
  }
  
  const { data, error } = await supabase
    .from('user')  // Ganti dengan nama tabel user yang benar
    .select('name')  // Asumsikan field 'name' untuk nama pengguna; ganti jika berbeda
    .eq('id', userId)
    .single();  // Ambil satu baris
  
  if (error || !data) {
    return null;  // Kembalikan null jika error
  }
  
  return data.name;  // Kembalikan nama pengguna
}

export async function getPhotoUrlFromHistory(awb_number: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('shipment_history')
      .select('photo_url')
      .eq('awb_number', awb_number)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      return null;
    }
    
    if (data && data.length > 0) {
      return data[0].photo_url || null;
    } else {
      return null;
    }
  } catch (error) {
    return null;
  }
}
