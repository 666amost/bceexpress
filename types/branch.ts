// Branch-specific type definitions
export type UserRole = 'admin' | 'branch' | 'cabang' | 'couriers';

export interface BranchUser {
  id: string;
  email: string;
  role: UserRole;
  origin_branch: string | null;
  name?: string;
}

export interface AWBFormData extends Record<string, string | number | boolean | null | undefined> {
  awb_no: string;
  awb_date: string;
  kirim_via: string;
  kota_tujuan: string;
  kecamatan: string;
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
  catatan?: string;
  origin_branch?: string;
}

export interface BranchComponentProps {
  userRole: UserRole | null;
  branchOrigin: string | null;
}

export interface FormComponentProps extends BranchComponentProps {
  onSuccess: () => void;
  onCancel: () => void;
  initialData?: AWBFormData | null;
  isEditing?: boolean;
}

// Type guards
export function isValidUserRole(role: string | null): role is UserRole {
  return role !== null && ['admin', 'branch', 'cabang', 'couriers'].includes(role);
}

export function isValidBranchOrigin(origin: string | null): origin is string {
  return origin !== null && origin.trim().length > 0;
}

// Branch validation utilities
export function validateBranchAccess(userRole: UserRole | null, branchOrigin: string | null): boolean {
  if (!userRole) return false;
  
  if (userRole === 'admin') return true;
  
  if (userRole === 'cabang') {
    return branchOrigin === 'bangka' || branchOrigin === 'tanjung_pandan';
  }
  
  return ['branch', 'couriers'].includes(userRole);
}

export function getBranchSpecificData<T>(
  branchOrigin: string | null, 
  bangkaData: T, 
  tanjungPandanData: T, 
  defaultData: T
): T {
  if (!branchOrigin) return defaultData;
  
  switch (branchOrigin) {
    case 'bangka':
      return bangkaData;
    case 'tanjung_pandan':
      return tanjungPandanData;
    default:
      return defaultData;
  }
}
