// Common types used throughout the application
export interface AwbFormData {
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
}

export interface ShipmentDetails {
  awb_number: string;
  sender_name: string;
  sender_address: string;
  sender_phone: string;
  receiver_name: string;
  receiver_address: string;
  receiver_phone: string;
  weight: number;
  dimensions: string;
  service_type: string;
  current_status: string;
  created_at: string;
  updated_at: string;
  courier_id?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

// Branch sync types (for Borneo web cabang API)
export interface BranchManifestData {
  id: string;
  no_resi: string;
  // Pengirim object structure from Borneo API
  pengirim: {
    id: string;
    nama_pengirim: string;
    alamat_pengirim: string;
    no_pengirim: string;
    nama_perusahaan_pengirim?: string;
    id_kecamatan_pengirim: string;
    created_at: string;
    updated_at: string;
  };
  // Penerima object structure from Borneo API
  penerima: {
    id: string;
    nama_penerima: string;
    alamat_penerima: string;
    no_penerima: string;
    nama_perusahaan_penerima?: string;
    id_kecamatan_penerima: string;
    created_at: string;
    updated_at: string;
  };
  // Additional fields from Borneo API
  id_outlet_terima: string;
  id_pengirim: string;
  id_penerima: string;
  id_barang: string;
  id_ongkir: string;
  id_layanan: string;
  admin: string;
  created_at: string;
  updated_at: string;
  manifest_source?: string;
}

// Local database manifest_cabang table type
export interface ManifestCabangData {
  id: string;
  created_at: string;
  awb_no: string;
  awb_date: string;
  kirim_via?: string;
  kota_tujuan: string;
  wilayah?: string;
  metode_pembayaran: string;
  agent_customer?: string;
  nama_pengirim: string;
  nomor_pengirim?: string;
  nama_penerima: string;
  nomor_penerima?: string;
  alamat_penerima?: string;
  coli?: number;
  berat_kg?: number;
  harga_per_kg?: number;
  sub_total?: number;
  biaya_admin?: number;
  biaya_packaging?: number;
  biaya_transit?: number;
  total?: number;
  isi_barang?: string;
  catatan?: string;
  buktimembayar?: boolean;
  potongan?: number;
  status_pelunasan?: string;
  origin_branch: string;
}

// Local database manifest table type (central)
export interface ManifestData {
  id: string;
  created_at: string;
  awb_no: string;
  awb_date: string;
  kirim_via?: string;
  kota_tujuan: string;
  wilayah?: string;
  metode_pembayaran: string;
  agent_customer?: string;
  nama_pengirim: string;
  nomor_pengirim?: string;
  nama_penerima: string;
  nomor_penerima?: string;
  alamat_penerima?: string;
  coli?: number;
  berat_kg?: number;
  harga_per_kg?: number;
  sub_total?: number;
  biaya_admin?: number;
  biaya_packaging?: number;
  biaya_transit?: number;
  total?: number;
  isi_barang?: string;
  catatan?: string;
  buktimembayar?: boolean;
  potongan?: number;
  status_pelunasan?: string;
}

export interface ScanKeluarRequest {
  no_resi: string;
  nama_kurir: string;
  armada: string;
  plat_armada: string;
  pemindai: string;
}

export interface ScanTTDRequest {
  no_resi: string;
  nama_kurir: string;
  armada: string;
  plat_armada: string;
  gambar: string;
  pemindai: string;
}

export interface BranchSyncResult {
  success: boolean;
  awb_number: string;
  action: 'scankeluar' | 'scanttd' | 'fetch';
  timestamp: string;
  error?: string;
}

export interface PaymentHistoryType {
  id: string;
  awb_no: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  status: string;
}

export interface DashboardStats {
  awbPerAgentChartData: Record<string, unknown>[] | null;
  [key: string]: unknown;
}

export interface Shipment {
  awb_number: string;
  current_status: string;
  courier_id: string;
  created_at: string;
  updated_at: string;
}

export interface ContinuousScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

// Event handler types
export interface ChangeEvent {
  target: {
    name: string;
    value: string;
  };
}

export interface FormEvent {
  preventDefault: () => void;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface BulkUpdateResult {
  awb: string;
  success: boolean;
  error?: string;
  shipmentSuccess?: boolean;
  historySuccess?: boolean;
}