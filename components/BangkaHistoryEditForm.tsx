"use client"

import React, { useState, useEffect } from "react"
import { supabaseClient } from "../lib/auth"
import { getEnhancedAgentList, getAgentForEmail, getAllAgentIdentifiers } from "../lib/agent-mapping"
import { baseAgentListBangka } from "../lib/agents"

interface ManifestData {
  id?: string;
  awb_no: string;
  awb_date: string;
  kirim_via?: string;
  kota_tujuan: string;
  kecamatan?: string;
  wilayah?: string;
  metode_pembayaran?: string;
  agent_customer?: string;
  nama_pengirim?: string;
  nomor_pengirim?: string;
  nama_penerima?: string;
  nomor_penerima?: string;
  alamat_penerima?: string;
  coli?: number | string;
  berat_kg?: number | string;
  harga_per_kg?: number | string;
  sub_total?: number | string;
  biaya_admin?: number | string;
  biaya_packaging?: number | string;
  biaya_transit?: number | string;
  total?: number | string;
  isi_barang?: string;
  potongan?: number | string;
  status_pelunasan?: string;
}

type UserRole = 'admin' | 'cabang' | 'couriers' | 'branch';

interface BangkaHistoryEditFormProps {
  selectedItem: ManifestData;
  onSave: (data: ManifestData) => void;
  onCancel: () => void;
  saving: boolean;
  /** current user's role from parent so we can lock fields for non-admins */
  userRole: UserRole;
}

// Data wilayah untuk Bangka dengan struktur kecamatan
const kotaWilayahBangka = {
  "JAKARTA BARAT": {
    kecamatan: [
      "Cengkareng", "Grogol", "Kebon jeruk", "Kali deres", "Pal merah", "Kembangan",
      "Taman sari", "Tambora"
    ],
    harga: 27000
  },
  "JAKARTA PUSAT": {
    kecamatan: [
      "Cempaka putih", "Gambir", "Johar baru", "Kemayoran", "Menteng", 
      "Sawah besar", "Senen", "Tanah abang"
    ],
    harga: 27000
  },
  "JAKARTA SELATAN": {
    kecamatan: [
      "Cilandak", "Jagakarsa", "Kebayoran baru", "Kebayoran lama", "Mampang prapatan", 
      "Pasar minggu", "Pesanggrahan", "Pancoran", "Setiabudi", "Tebet"
    ],
    harga: 29000
  },
  "JAKARTA TIMUR": {
    kecamatan: [
      "Cakung", "Cipayung", "Ciracas", "Duren sawit", "Jatinegara", "Kramat jati",
      "Makasar", "Matraman", "Pasar rebo", "Pulo gadung"
    ],
    harga: 29000
  },
  "JAKARTA UTARA": {
    kecamatan: [
      "Penjaringan", "Cilincing", "Kelapa gading", "Koja", "Pademangan", "Tanjung priok"
    ],
    harga: 27000
  },
  "TANGERANG": {
    kecamatan: [
      "Batuceper", "Benda", "Cibodas", "Ciledug", "Cipondoh", "Jatiuwung", 
      "Karangtengah", "Karawaci", "Larangan", "Neglasari", "Periuk", "Pinang", "Tangerang"
    ],
    harga: 27000
  },
  "TANGERANG SELATAN": {
    kecamatan: [
      "Ciputat", "Ciputat Timur", "Pamulang", "Pondok Aren", "Serpong", "Serpong Utara"
    ],
    harga: 30000
  },
  "TANGERANG KABUPATEN": {
    kecamatan: [
      "Kelapa Dua", "Curug", "Kosambi", "Legok", "Pagedangan", "Pasar Kemis", 
      "Teluknaga", "Balaraja", "Cikupa", "Cisauk", "Pakuhaji", "Panongan", 
      "Rajeg", "Sepatan", "Sepatan Timur", "Sindang Jaya", "Solear", "Tigaraksa"
    ],
    harga: 35000
  },
  "BEKASI KOTA": {
    kecamatan: [
      "Bantargebang", "Bekasi Barat", "Bekasi Selatan", "Bekasi Timur", "Bekasi Utara",
      "Jatiasih", "Jatisampurna", "Medan Satria", "Mustikajaya", "pondokgede",
      "pondokmelati", "Rawalumbu"
    ],
    harga: 32000
  },
  "BEKASI KABUPATEN": {
    kecamatan: [
      "Tarumajaya", "Babelan", "Cibarusah", "Cibitung", "Cikarang Barat", "Cikarang Pusat",
      "Cikarang Selatan", "Cikarang Timur", "Cikarang Utara", "Karangbahagia",
      "Kedungwaringin", "Serang Baru", "Setu", "Tambun Selatan", "Tambun Utara"
    ],
    harga: 32000
  },
  "DEPOK": {
    kecamatan: [
      "Beji", "Bojongsari", "Cilodong", "Cimanggis", "Cinere", "Cipayung",
      "Limo", "Pancoran Mas", "Sawangan", "Sukmajaya", "Tapos"
    ],
    harga: 35000
  },
  "BOGOR KOTA": {
    kecamatan: [
      "Bogor Barat", "Bogor Selatan", "Bogor Tengah", "Bogor Timur", "Bogor Utara", "Tanah Sereal"
    ],
    harga: 35000
  },
  "BOGOR KABUPATEN": {
    kecamatan: [
      "Babakan Madang", "Bojonggede", "Cibinong", "Cileungsi", "Gunung Putri", 
      "Gunung Sindur", "Citeureup", "Jonggol", "Ciomas", "Ciseeng", "Tajurhalang",
      "Caringin", "Dramaga", "Cariu", "Klapanunggal", "Rumpin", "Ciawi", "Tamansari"
    ],
    harga: 35000
  }
};

const kirimViaBangka = ["udara", "darat"];
const metodePembayaranBangka = ["cash", "transfer", "cod"];

export default function BangkaHistoryEditForm({ 
  selectedItem: initialSelectedItem, 
  onSave, 
  onCancel, 
  saving,
  userRole
}: BangkaHistoryEditFormProps) {
  const [selectedItem, setSelectedItem] = useState<ManifestData>(initialSelectedItem);

  // Get enhanced agent list with email mappings
  const enhancedAgentList = getEnhancedAgentList(baseAgentListBangka);

  // Function to get display value for agent dropdown
  const getAgentDisplayValue = (agentCustomer: string | undefined): string => {
    if (!agentCustomer) return "";
    
    // Check if it's an email that maps to an agent name
    const mappedAgent = getAgentForEmail(agentCustomer);
    if (mappedAgent) {
      return mappedAgent;
    }
    
    // Return as is if it's already an agent name
    return agentCustomer;
  };

  // Function to handle agent selection change
  const handleAgentChange = (selectedAgentName: string): void => {
    // For simplicity, we'll store the agent name in the database
    // The mapping logic will handle email lookups when needed
    setSelectedItem({ ...selectedItem, agent_customer: selectedAgentName });
  };

  // Update form ketika selectedItem berubah
  useEffect(() => {
    setSelectedItem(initialSelectedItem);
  }, [initialSelectedItem]);

  // Auto calculate sub_total dan total
  useEffect(() => {
    const sub_total = (parseFloat(String(selectedItem.berat_kg) || '0')) * (parseFloat(String(selectedItem.harga_per_kg) || '0'));
    const total = sub_total
      + (parseFloat(String(selectedItem.biaya_admin) || '0'))
      + (parseFloat(String(selectedItem.biaya_packaging) || '0'))
      + (parseFloat(String(selectedItem.biaya_transit) || '0'));
    
    setSelectedItem(prev => ({ ...prev, sub_total, total }));
  }, [selectedItem.berat_kg, selectedItem.harga_per_kg, selectedItem.biaya_admin, selectedItem.biaya_packaging, selectedItem.biaya_transit]);

  // Auto update harga_per_kg dan wilayah saat kota_tujuan atau kecamatan berubah
  useEffect(() => {
    if (selectedItem.kota_tujuan && selectedItem.kecamatan) {
      const kotaData = kotaWilayahBangka[selectedItem.kota_tujuan as keyof typeof kotaWilayahBangka];
      if (kotaData && kotaData.kecamatan.includes(selectedItem.kecamatan)) {
        setSelectedItem(prev => ({
          ...prev,
          harga_per_kg: kotaData.harga,
          wilayah: selectedItem.kecamatan // Set wilayah sama dengan kecamatan untuk bangka
        }));
      }
    }
  }, [selectedItem.kota_tujuan, selectedItem.kecamatan]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(selectedItem);
  };

  const getKecamatanOptions = (): string[] => {
    if (!selectedItem.kota_tujuan) return [];
    const kotaData = kotaWilayahBangka[selectedItem.kota_tujuan as keyof typeof kotaWilayahBangka];
    return kotaData ? kotaData.kecamatan : [];
  };

  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-blue-900 dark:text-blue-100">Edit AWB - Bangka</h2>
        <button 
          onClick={onCancel} 
          className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
        >
          Batal
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-4 rounded shadow border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* AWB No */}
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Nomor Resi (AWB)</label>
            <input
              type="text"
              value={selectedItem.awb_no}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedItem({ ...selectedItem, awb_no: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
            />
          </div>

          {/* AWB Date */}
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Tanggal AWB</label>
            <input
              type="date"
              value={selectedItem.awb_date}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedItem({ ...selectedItem, awb_date: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
            />
          </div>

          {/* Kirim Via */}
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Kirim Via</label>
            <select
              value={selectedItem.kirim_via?.toLowerCase() || ""}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedItem({ ...selectedItem, kirim_via: e.target.value.toUpperCase() })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
            >
              <option value="">Pilih</option>
              {kirimViaBangka.map((opt) => (
                <option key={opt} value={opt}>
                  {opt.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Metode Pembayaran */}
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Metode Pembayaran</label>
            <select
              value={selectedItem.metode_pembayaran?.toLowerCase() || ""}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedItem({ ...selectedItem, metode_pembayaran: e.target.value.toUpperCase() })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
            >
              <option value="">Pilih</option>
              {metodePembayaranBangka.map((opt) => (
                <option key={opt} value={opt}>
                  {opt.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Agent Customer */}
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Agent</label>
            <select
              value={getAgentDisplayValue(selectedItem.agent_customer)}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleAgentChange(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
            >
              <option value="">Pilih</option>
              {enhancedAgentList.map((agent) => (
                <option key={agent} value={agent}>
                  {agent}
                </option>
              ))}
            </select>
          </div>

          {/* Kota Tujuan */}
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Kota Tujuan</label>
            <select
              value={selectedItem.kota_tujuan}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedItem({ ...selectedItem, kota_tujuan: e.target.value, kecamatan: "", wilayah: "" })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
            >
              <option value="">Pilih</option>
              {Object.keys(kotaWilayahBangka).map((kota) => (
                <option key={kota} value={kota}>
                  {kota}
                </option>
              ))}
            </select>
          </div>

          {/* Kecamatan */}
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Kecamatan</label>
            <select
              value={selectedItem.kecamatan || ""}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedItem({ ...selectedItem, kecamatan: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:text-gray-500 dark:disabled:text-gray-400"
              disabled={!selectedItem.kota_tujuan}
            >
              <option value="">Pilih Kecamatan</option>
              {getKecamatanOptions().map((kecamatan) => (
                <option key={kecamatan} value={kecamatan}>
                  {kecamatan}
                </option>
              ))}
            </select>
          </div>

          {/* Wilayah (Auto-filled) */}
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Wilayah</label>
            <input
              type="text"
              value={selectedItem.wilayah || ""}
              readOnly
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 cursor-not-allowed"
              placeholder="Akan terisi otomatis sesuai kecamatan"
            />
          </div>

          {/* Coli */}
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Coli</label>
            <input
              type="number"
              value={selectedItem.coli || ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedItem({ ...selectedItem, coli: parseInt(e.target.value) || 0 })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
            />
          </div>

          {/* Berat KG */}
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Berat (KG)</label>
            <input
              type="number"
              step="0.1"
              value={selectedItem.berat_kg || ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedItem({ ...selectedItem, berat_kg: parseFloat(e.target.value) || 0 })}
              disabled={userRole !== 'admin'}
              className={`w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 ${userRole !== 'admin' ? 'bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed' : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white'} focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400`}
            />
            {/* Note removed: berat (KG) remains disabled for non-admins but no explanatory note shown */}
          </div>

          {/* Harga Per KG */}
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Harga Per KG</label>
            <input
              type="number"
              value={selectedItem.harga_per_kg || ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedItem({ ...selectedItem, harga_per_kg: parseInt(e.target.value) || 0 })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
            />
          </div>

          {/* Sub Total (Auto calculated) */}
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Sub Total</label>
            <input
              type="number"
              value={selectedItem.sub_total || ""}
              readOnly
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 cursor-not-allowed"
            />
          </div>

          {/* Biaya Admin */}
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Biaya Admin</label>
            <input
              type="number"
              value={selectedItem.biaya_admin || ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedItem({ ...selectedItem, biaya_admin: parseInt(e.target.value) || 0 })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
            />
          </div>

          {/* Biaya Packaging */}
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Biaya Packaging</label>
            <input
              type="number"
              value={selectedItem.biaya_packaging || ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedItem({ ...selectedItem, biaya_packaging: parseInt(e.target.value) || 0 })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
            />
          </div>

          {/* Biaya Transit */}
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Biaya Transit</label>
            <input
              type="number"
              value={selectedItem.biaya_transit || ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedItem({ ...selectedItem, biaya_transit: parseInt(e.target.value) || 0 })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
            />
          </div>

          {/* Total (Auto calculated) */}
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Total</label>
            <input
              type="number"
              value={selectedItem.total || ""}
              readOnly
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 cursor-not-allowed"
            />
          </div>

          {/* Isi Barang */}
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Isi Barang</label>
            <input
              type="text"
              value={selectedItem.isi_barang || ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedItem({ ...selectedItem, isi_barang: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
            />
          </div>

          {/* Nama Pengirim */}
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Nama Pengirim</label>
            <input
              type="text"
              value={selectedItem.nama_pengirim || ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedItem({ ...selectedItem, nama_pengirim: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
            />
          </div>

          {/* Nomor Pengirim */}
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Nomor Pengirim</label>
            <input
              type="text"
              value={selectedItem.nomor_pengirim || ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedItem({ ...selectedItem, nomor_pengirim: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
            />
          </div>

          {/* Nama Penerima */}
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Nama Penerima</label>
            <input
              type="text"
              value={selectedItem.nama_penerima || ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedItem({ ...selectedItem, nama_penerima: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
            />
          </div>

          {/* Nomor Penerima */}
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Nomor Penerima</label>
            <input
              type="text"
              value={selectedItem.nomor_penerima || ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedItem({ ...selectedItem, nomor_penerima: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
            />
          </div>

          {/* Alamat Penerima */}
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Alamat Penerima</label>
            <input
              type="text"
              value={selectedItem.alamat_penerima || ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedItem({ ...selectedItem, alamat_penerima: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white rounded hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </div>
  );
}
