import { createClient } from "@supabase/supabase-js"
import { Database } from "@/lib/database.types"

// Interface for manifest data
interface ManifestData {
  nama_penerima: string;
  alamat_penerima: string;
  nomor_penerima?: string;
  manifest_source?: string;
}

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
  updated_by?: string
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
  // CRITICAL: Check current status before updating
  // This is lightweight query using primary key index (~1-5ms)
  const { data: currentShipment } = await supabase
    .from("shipments")
    .select("current_status")
    .eq("awb_number", historyEntry.awb_number)
    .maybeSingle()

  // Prevent overriding delivered status with any other status
  // This is the final safety net - protects against any bypass
  if (currentShipment?.current_status === "delivered" && historyEntry.status !== "delivered") {
    return null
  }

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
export async function checkManifestAwb(awbNumber: string): Promise<ManifestData | null> {
  try {
    // Bersihkan AWB number dari karakter tidak perlu
    const cleanAwb = awbNumber.trim().toUpperCase();
    
    // Beberapa kemungkinan format AWB (dengan atau tanpa prefix)
    let awbsToCheck = [cleanAwb];
    
    // Jika AWB dimulai dengan BCE atau BE, tambahkan versi tanpa prefix
    if (cleanAwb.startsWith('BCE')) {
      awbsToCheck.push(cleanAwb.substring(3)); // Tanpa 'BCE'
    } else if (cleanAwb.startsWith('BE')) {
      awbsToCheck.push(cleanAwb.substring(2)); // Tanpa 'BE'
    } 
    // Jika AWB adalah angka saja, tambahkan versi dengan prefix
    else if (/^\d+$/.test(cleanAwb)) {
      awbsToCheck.push('BCE' + cleanAwb);
      awbsToCheck.push('BE' + cleanAwb);
    }
    
    // Coba semua format AWB yang mungkin
    for (const awbFormat of awbsToCheck) {
      // Cek di tabel manifest dulu - hanya ambil data yang diperlukan kurir
      const { data: manifestData, error: manifestError } = await supabase
        .from("manifest")
        .select("nama_penerima,alamat_penerima,nomor_penerima")
        .ilike("awb_no", awbFormat)
        .maybeSingle();

      if (!manifestError && manifestData) {
        return { ...manifestData, manifest_source: "central" };
      }

      // Jika tidak ditemukan di manifest, cek di manifest_cabang
      const { data: branchData, error: branchError } = await supabase
        .from("manifest_cabang")
        .select("nama_penerima,alamat_penerima,nomor_penerima")
        .ilike("awb_no", awbFormat)
        .maybeSingle();

      if (!branchError && branchData) {
        return { ...branchData, manifest_source: "cabang" };
      }
    }

    // Jika tidak ditemukan di keduanya dengan semua format yang dicoba
    return null;
  } catch (err: unknown) {
    return null;
  }
}

// Create shipment from manifest
export async function createShipmentFromManifest(awbNumber: string): Promise<boolean> {
  try {
    // Cek apakah data tersedia di manifest
    const manifestData = await checkManifestAwb(awbNumber);
    
    if (!manifestData) {
      return false;
    }
    
    // Pastikan data penerima tersedia
    if (!manifestData.nama_penerima || !manifestData.alamat_penerima) {
      return false;
    }
    
    // Buat shipment dengan data yang tersedia, Auto Generate untuk sisanya
    const { error } = await supabase.from("shipments").insert([{
      awb_number: awbNumber,
      sender_name: "Auto Generated",
      sender_address: "Auto Generated",
      sender_phone: "Auto Generated",
      receiver_name: manifestData.nama_penerima || "Auto Generated",
      receiver_address: manifestData.alamat_penerima || "Auto Generated",
      receiver_phone: manifestData.nomor_penerima || "Auto Generated",
      weight: 1, // Default weight
      dimensions: "10x10x10", // Default dimensions
      service_type: "Standard",
      current_status: "processed",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }]);
    
    return !error;
  } catch (error: unknown) {
    return false;
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
  } catch (error: unknown) {
    return null;
  }
}

// Interface for booking data
export interface BookingData {
  awb_no: string;
  awb_date: string;
  kirim_via: string;
  kota_tujuan: string;
  wilayah: string;
  metode_pembayaran: string;
  agent_customer: string;
  nama_pengirim: string;
  nomor_pengirim: string;
  nama_penerima: string;
  nomor_penerima: string;
  alamat_penerima: string;
  coli: number;
  berat_kg: number;
  harga_per_kg: number;
  sub_total: number;
  biaya_admin: number;
  biaya_packaging: number;
  biaya_transit: number;
  total: number;
  isi_barang: string;
  catatan: string;
  agent_id: string;
  origin_branch: string;
}

// Create a new booking entry
export async function createBooking(bookingData: BookingData): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("manifest_booking")
      .insert([{
        ...bookingData,
        status: 'pending',
        payment_status: 'outstanding'
      }]);
    
    return !error;
  } catch (error: unknown) {
    console.error('Error creating booking:', error);
    return false;
  }
}

export interface ManifestCabangData {
  awb_no: string;
  origin_branch: string;
  nama_pengirim: string;
  nomor_pengirim: string;
  nama_penerima: string;
  nomor_penerima: string;
  alamat_penerima: string;
  kota_tujuan: string;
  wilayah: string;
  kecamatan: string;
  created_at: string;
  updated_at: string;
}

export async function getManifestCabangByAwb(awbNumber: string): Promise<ManifestCabangData | null> {
  try {
    const { data, error } = await supabase
      .from("manifest_cabang")
      .select("awb_no, origin_branch, nama_pengirim, nomor_pengirim, nama_penerima, nomor_penerima, alamat_penerima, kota_tujuan, wilayah, kecamatan, created_at, updated_at")
      .eq("awb_no", awbNumber)
      .single();

    if (error || !data) {
      return null;
    }

    return data as ManifestCabangData;
  } catch (error: unknown) {
    return null;
  }
}