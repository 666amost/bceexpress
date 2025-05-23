"use client"

import { useEffect, useState, useRef } from "react"
import { supabaseClient } from "../lib/auth"
import PrintLayout from "./PrintLayout" // Pastikan ini merujuk ke PrintLayout.jsx yang sudah diperbarui
import AwbForm from "./AwbForm"

const agentList = [
  'GLC COD UDR',
  'GLC COD DRT',
  'UDR CASH',
  'SEA CASH',
  'GLC UDR TRF',
  'GLC SEA TRF',
  'COD UDR',
  'COD SEA',
  'KMY UDR TRF',
  'KMY SEA TRF',
  'KARTINI KIKI',
  'DUTA GARDEN FRENITA',
  'FELLISIA PORIS EX 3',
  'OTTY OFFICIAL',
  'CITRA 3 RENY',
  'HENDI',
  'PRALITA',
  'SALIM',
  'ISKANDAR',
  'IMAM',
  'DONI',
  'HERFAN',
  'EZZA',
  'YANDRI',
  'DIKY',
  'YOS',
  'INDAH SUSHI TIME',
  'CENTRAL NURSERY BANGKA',
  'MAMAPIA',
  'AMELIA PEDINDANG',
  'HENDRY LIMIA',
  'JESS DOT',
  'SEPIRING RASA BASO',
  'CHRISTINE PADEMANGAN'
];

const kotaTujuan = ["bangka", "kalimantan barat", "belitung", "bali"];
const kirimVia = ["udara", "darat"];
const metodePembayaran = ["cash", "transfer", "cod"];
const kotaWilayah = {
  bangka: ["Pangkal Pinang", "Sungailiat", "Belinyu", "Jebus", "Koba", "Toboali", "Mentok"],
  "kalimantan barat": ["Pontianak", "Singkawang", "Sungai Pinyuh"],
  belitung: ["Tj Pandan"],
  bali: ["Denpasar"],
};

const agentListTanjungPandan = [
  'COD',
  'TRANSFER',
  'CASH'
];

interface ManifestData {
  id?: string;
  awb_no: string;
  awb_date: string;
  kirim_via?: string;
  kota_tujuan: string;
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

export default function HistoryManifest({ mode, userRole, branchOrigin }: { mode: string, userRole: string, branchOrigin: string }) {
  const [data, setData] = useState<ManifestData[]>([])
  const [loading, setLoading] = useState(true)
  const [editData, setEditData] = useState<ManifestData | null>(null)
  const [editPotongan, setEditPotongan] = useState(0)
  const [editStatus, setEditStatus] = useState("lunas")
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [printData, setPrintData] = useState<ManifestData | null>(null)
  const [showPrintLayout, setShowPrintLayout] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ManifestData | null>(null)
  const printFrameRef = useRef<HTMLDivElement>(null)

  const currentAgentList = userRole === 'cabang' ? agentListTanjungPandan : agentList;

  useEffect(() => {
    if (selectedItem) {
      const sub_total = (parseFloat(String(selectedItem.berat_kg) || '0')) * (parseFloat(String(selectedItem.harga_per_kg) || '0'));
      const total = sub_total
        + (parseFloat(String(selectedItem.biaya_admin) || '0'))
        + (parseFloat(String(selectedItem.biaya_packaging) || '0'))
        + (parseFloat(String(selectedItem.biaya_transit) || '0'));
      setSelectedItem(prev => prev ? { ...prev, sub_total, total } : null);
    }
  }, [selectedItem?.berat_kg, selectedItem?.harga_per_kg, selectedItem?.biaya_admin, selectedItem?.biaya_packaging, selectedItem?.biaya_transit]);

  useEffect(() => {
    setLoading(true)
    let query;
    
    // Central users (admin, courier, branch pusat): use central tables without branch filtering
    // Branch users (role 'cabang'): use branch tables with branch filtering
    if (userRole === 'cabang') {
      query = supabaseClient
        .from('manifest_cabang')
        .select('*')
        .eq('origin_branch', branchOrigin)
        .order('awb_date', { ascending: false });
    } else {
      // Central users always query central table without any branch filtering
      query = supabaseClient
        .from('manifest')
        .select('*')
        .order('awb_date', { ascending: false });
    }
    
    query.then(({ data }) => {
      setData(data || [])
      setLoading(false)
    })
  }, [saving, userRole, branchOrigin])

  const openEditModal = (row) => {
    setEditData(row)
    setEditPotongan(row.potongan || 0)
    setEditStatus(row.status_pelunasan || "lunas")
  }

  const closeEditModal = () => {
    setEditData(null)
    setEditPotongan(0)
    setEditStatus("lunas")
  }

  const handleEditSave = async () => {
    setSaving(true)
    const targetTable = userRole === 'cabang' ? "manifest_cabang" : "manifest"
    await supabaseClient
      .from(targetTable)
      .update({ status_pelunasan: editStatus, potongan: editPotongan })
      .eq("id", editData?.id)
    setSaving(false)
    closeEditModal()
  }

  // === FUNGSI HANDLE PRINT YANG DIUPDATE ===
  const handlePrint = (row) => {
    setPrintData(row)
    setShowPrintLayout(true)

    // CSS dari PrintLayout.jsx yang sudah diperbarui (DISINKRONKAN)
    const printLayoutCss = `
      /* === START: CSS disinkronkan dari PrintLayout.jsx === */
      .print-only {
        display: block;
        width: 100mm;
        height: 100mm;
        padding: 0;
        margin: 0 auto;
        box-sizing: border-box;
        font-family: Arial, sans-serif;
        font-size: 10px;
      }

      .shipping-label {
        width: 100%;
        height: 100%;
        border: 1px solid #000;
        padding: 0mm 3mm 3mm 3mm; 
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
      }

      .top-header-container {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        width: 100%;
        padding-bottom: 0mm;
      }

      .top-header-logo {
        display: flex;
        justify-content: flex-start;
        width: 100%;
        padding-bottom: 0mm;
      }

      .header-logo {
        width: 20mm;
        height: auto;
        display: block;
        box-sizing: border-box;
      }

      .barcode-section {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-top: -4mm;
        margin-bottom: 1mm;
        border: 2px solid #000;
        padding: 1mm;
      }

      .barcode-section svg {
        width: 100%;
        height: 15mm;
      }

      .awb-number {
        font-weight: bold;
        font-size: 14px;
        margin-top: 1mm;
      }

      .shipping-details {
        display: flex;
        flex-direction: row;
        align-items: baseline;
        gap: 8mm;
        margin-bottom: 1mm;
        font-size: 12px;
        padding-left: 2mm;
      }

      .content-section {
        display: flex;
        flex: 1;
        margin-bottom: 1mm;
      }

      .address-box {
        flex: 1;
        border: 1px solid #000;
        padding: 1mm;
        margin-right: 3mm;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        font-size: 11px;  /* Enlarge font size */
        font-weight: bold;  /* Make text bold */
      }

      .address-box .sender-info > div,
      .address-box .recipient-info > div {
        border-bottom: 1px dotted #999;
        padding-bottom: 0.6mm;
        margin-bottom: 0mm;
        line-height: 1.4;
      }
      .address-box .recipient-info > div:last-child {
        border-bottom: none;
      }

      .address-box .sender-info {
        margin-bottom: 2mm;
      }

      .logo-qr {
        width: 30mm;
        height: auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        padding-top: 7mm;
      }

      .qr-code {
        width: 30mm !important;
        height: 30mm !important;
        display: block !important;
        box-sizing: border-box;
      }

      .footer-container {
        width: 100%;
        margin-top: auto;
      }

      .dotted-line {
        border-top: 1px dotted #000;
        margin-bottom: 2mm;
      }

      .footer {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        font-size: 8px;
        font-style: italic;
        padding-top: 0mm;
      }

      .terms-text {
        flex: 1;
        text-align: left;
        line-height: 1.3;
      }

      .admin-contact {
        text-align: right;
        white-space: nowrap;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        color: black;
      }

      .airport-code {
        font-size: 20px;  /* Matches logo prominence */
        font-weight: bold;
        margin-top: 4mm;
        text-align: right;
        margin-right: 2mm;
        width: 20mm;  /* Set to match logo width */
        display: flex;
        align-items: center;
        justify-content: flex-end;
      }

      .agent-abbr {
          font-size: 15px;
          font-weight: bold;
          width: 100%;
          text-align: center;
          margin-top: 0mm;
          position: relative;
          top: 2mm;
        }

      @media print {
        @page {
          size: 100mm 100mm;
          margin: 0;
        }

        body {
          margin: 0;
          -webkit-print-color-adjust: exact !important;
          color-adjust: exact !important;
        }

        .print-only {
          position: absolute;
          left: 0;
          top: 0;
          width: 100mm;
          height: 100mm;
          margin: 0;
          padding: 0;
          background-color: #fff !important;
        }

        body > *:not(.print-only) {
          display: none !important;
          visibility: hidden !important;
        }

        .print-only,
        .print-only * {
          visibility: visible !important;
        }
      }
      /* === END: CSS disinkronkan dari PrintLayout.jsx === */
    `;

    setTimeout(() => {
      if (printFrameRef.current) {
        const printWindow = window.open("", "_blank")
        if (printWindow) {
          printWindow.document.write("<html><head><title>Print</title>")
          printWindow.document.write("<style>")
          printWindow.document.write(printLayoutCss)
          printWindow.document.write("</style></head><body>")
          printWindow.document.write(printFrameRef.current.innerHTML)
          printWindow.document.write("</body></html>")
          printWindow.document.close()
          setTimeout(() => printWindow.print(), 500)
          setTimeout(() => {
            printWindow.close()
            setPrintData(null)
            setShowPrintLayout(false)
          }, 1000)
        }
      }
    }, 100)
  }
  // === AKHIR FUNGSI HANDLE PRINT YANG DIUPDATE ===

  const handleEditAwb = (item) => {
    setSelectedItem(item);
    setShowEditForm(true);
  }

  const handleSaveEdit = async () => {
    if (!selectedItem) return;
    setSaving(true);
    try {
      const { error } = await supabaseClient
        .from(userRole === 'cabang' ? "manifest_cabang" : "manifest")
        .update({
          awb_no: selectedItem.awb_no,
          awb_date: selectedItem.awb_date,
          kirim_via: selectedItem.kirim_via,
          kota_tujuan: selectedItem.kota_tujuan,
          wilayah: selectedItem.wilayah,
          metode_pembayaran: selectedItem.metode_pembayaran,
          agent_customer: selectedItem.agent_customer,
          nama_pengirim: selectedItem.nama_pengirim,
          nomor_pengirim: selectedItem.nomor_pengirim,
          nama_penerima: selectedItem.nama_penerima,
          nomor_penerima: selectedItem.nomor_penerima,
          alamat_penerima: selectedItem.alamat_penerima,
          coli: selectedItem.coli,
          berat_kg: selectedItem.berat_kg,
          harga_per_kg: selectedItem.harga_per_kg,
          sub_total: selectedItem.sub_total,
          biaya_admin: selectedItem.biaya_admin,
          biaya_packaging: selectedItem.biaya_packaging,
          biaya_transit: selectedItem.biaya_transit,
          total: selectedItem.total,
        })
        .eq("awb_no", selectedItem.awb_no);

      if (error) {
        alert("Gagal memperbarui data: " + error.message);
      } else {
        alert("Data berhasil diperbarui!");
        supabaseClient
          .from(userRole === 'cabang' ? "manifest_cabang" : "manifest")
          .select("*")
          .order("awb_date", { ascending: false })
          .then(({ data }) => {
            setData(data || []);
          });
        setShowEditForm(false);
        setSelectedItem(null);
      }
    } catch (err) {
      alert("Terjadi kesalahan saat memperbarui data.");
    } finally {
      setSaving(false);
    }
  }

  const handleCancelEdit = () => {
    setShowEditForm(false);
    setSelectedItem(null);
  }

  const handleDownloadPDF = async (row) => {
    setPrintData(row);
    setTimeout(async () => {
      const element = printFrameRef.current;
      if (element) {
        const html2pdf = await import('html2pdf.js');
        html2pdf.default()
          .set({
            filename: row.awb_no + '.pdf',
            margin: 0,
            jsPDF: { unit: 'mm', format: [100, 100], orientation: 'portrait' }
          })
          .from(element)
          .save();
        setPrintData(null);
      }
    }, 100);
  };

  if (showEditForm && selectedItem) {
    const wilayahOptions = kotaWilayah[selectedItem.kota_tujuan] || [];

    return (
      <div className="mt-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-blue-900 dark:text-blue-100">Edit AWB</h2>
          <button onClick={handleCancelEdit} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
            Batal
          </button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); handleSaveEdit(); }} className="bg-white dark:bg-gray-800 p-4 rounded shadow border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Nomor Resi (AWB)</label>
              <input
                type="text"
                value={selectedItem.awb_no}
                onChange={(e) => setSelectedItem({ ...selectedItem, awb_no: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Tanggal AWB</label>
              <input
                type="date"
                value={selectedItem.awb_date}
                onChange={(e) => setSelectedItem({ ...selectedItem, awb_date: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Kirim Via</label>
              <select
                name="kirim_via"
                value={selectedItem.kirim_via}
                onChange={(e) => setSelectedItem({ ...selectedItem, kirim_via: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
              >
                <option value="">Pilih</option>
                {kirimVia.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Kota Tujuan</label>
              <select
                name="kota_tujuan"
                value={selectedItem.kota_tujuan}
                onChange={(e) => setSelectedItem({ ...selectedItem, kota_tujuan: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
              >
                <option value="">Pilih</option>
                {kotaTujuan.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt.replace(/\b\w/g, (l) => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Wilayah</label>
              <select
                name="wilayah"
                value={selectedItem.wilayah}
                onChange={(e) => setSelectedItem({ ...selectedItem, wilayah: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:text-gray-500 dark:disabled:text-gray-400"
                disabled={!selectedItem.kota_tujuan}
              >
                <option value="">Pilih</option>
                {wilayahOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Agent</label>
              <select
                name="agent_customer"
                value={selectedItem.agent_customer}
                onChange={(e) => setSelectedItem({ ...selectedItem, agent_customer: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
              >
                <option value="">Pilih</option>
                {currentAgentList.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Nama Pengirim</label>
              <input
                type="text"
                value={selectedItem.nama_pengirim}
                onChange={(e) => setSelectedItem({ ...selectedItem, nama_pengirim: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Nama Penerima</label>
              <input
                type="text"
                value={selectedItem.nama_penerima}
                onChange={(e) => setSelectedItem({ ...selectedItem, nama_penerima: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Nomor Penerima</label>
              <input
                type="text"
                value={selectedItem.nomor_penerima || ''}
                onChange={(e) => setSelectedItem({ ...selectedItem, nomor_penerima: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Metode Pembayaran</label>
              <select
                name="metode_pembayaran"
                value={selectedItem.metode_pembayaran}
                onChange={(e) => setSelectedItem({ ...selectedItem, metode_pembayaran: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
              >
                <option value="">Pilih</option>
                {metodePembayaran.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Berat (kg)</label>
              <input
                type="number"
                value={selectedItem.berat_kg || 0}
                onChange={(e) => setSelectedItem({ ...selectedItem, berat_kg: Number(e.target.value) })}
                min={0}
                step={0.1}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Harga/kg</label>
              <input
                type="number"
                value={selectedItem.harga_per_kg || 0}
                onChange={(e) => setSelectedItem({ ...selectedItem, harga_per_kg: e.target.value })}
                min={0}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Biaya Admin</label>
              <input
                type="number"
                value={selectedItem.biaya_admin || 0}
                onChange={(e) => setSelectedItem({ ...selectedItem, biaya_admin: e.target.value })}
                min={0}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Biaya Packaging</label>
              <input
                type="number"
                value={selectedItem.biaya_packaging || 0}
                onChange={(e) => setSelectedItem({ ...selectedItem, biaya_packaging: e.target.value })}
                min={0}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Biaya Transit</label>
              <input
                type="number"
                value={selectedItem.biaya_transit || 0}
                onChange={(e) => setSelectedItem({ ...selectedItem, biaya_transit: e.target.value })}
                min={0}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Total</label>
              <input
                type="number"
                value={selectedItem.total || 0}
                readOnly
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
              />
            </div>
          </div>
          <button type="submit" className="mt-4 px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors" disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="hidden">
        <div ref={printFrameRef}>{printData && <PrintLayout data={printData} />}</div>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span className="text-gray-700 dark:text-gray-300">Search:</span>
        <input
          className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by AWB, customer, etc."
        />
      </div>
      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded shadow border border-gray-200 dark:border-gray-700">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-blue-600 dark:bg-blue-700 text-white">
              <th className="px-2 py-2">No STTB</th>
              <th className="px-2 py-2">Tgl STTB</th>
              <th className="px-2 py-2">Kirim Via</th>
              <th className="px-2 py-2">Tujuan</th>
              <th className="px-2 py-2">Agen/Customer</th>
              <th className="px-2 py-2">Bayar</th>
              <th className="px-2 py-2">Pengirim</th>
              <th className="px-2 py-2">Penerima</th>
              <th className="px-2 py-2">Kg</th>
              <th className="px-2 py-2">Isi Barang</th>
              <th className="px-2 py-2">Total STTB</th>
              {mode === "pelunasan" && <th className="px-2 py-2">Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={mode === "pelunasan" ? 12 : 11} className="text-center py-4 text-gray-600 dark:text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={mode === "pelunasan" ? 12 : 11} className="text-center py-4 text-gray-600 dark:text-gray-400">
                  Belum ada data manifest.
                </td>
              </tr>
            ) : (
              data
                .filter(
                  (item) =>
                    item.awb_no?.toLowerCase().includes(search.toLowerCase()) ||
                    item.kota_tujuan?.toLowerCase().includes(search.toLowerCase()) ||
                    item.agent_customer?.toLowerCase().includes(search.toLowerCase()) ||
                    item.nama_pengirim?.toLowerCase().includes(search.toLowerCase()) ||
                    item.nama_penerima?.toLowerCase().includes(search.toLowerCase()),
                )
                .map((m, idx) => (
                  <tr key={m.id || m.awb_no || idx} className="even:bg-blue-50 dark:even:bg-gray-700 hover:bg-blue-100 dark:hover:bg-gray-600 transition-colors">
                    <td className="px-2 py-1 text-gray-900 dark:text-gray-100">{m.awb_no}</td>
                    <td className="px-2 py-1 text-gray-900 dark:text-gray-100">{m.awb_date}</td>
                    <td className="px-2 py-1 text-gray-900 dark:text-gray-100">{m.kirim_via}</td>
                    <td className="px-2 py-1 text-gray-900 dark:text-gray-100">{m.kota_tujuan}</td>
                    <td className="px-2 py-1 text-gray-900 dark:text-gray-100">{m.agent_customer}</td>
                    <td className="px-2 py-1 text-gray-900 dark:text-gray-100">{m.metode_pembayaran}</td>
                    <td className="px-2 py-1 text-gray-900 dark:text-gray-100">{m.nama_pengirim}</td>
                    <td className="px-2 py-1 text-gray-900 dark:text-gray-100">{m.nama_penerima}</td>
                    <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-100">{m.berat_kg}</td>
                    <td className="px-2 py-1 text-gray-900 dark:text-gray-100">{m.isi_barang || '-'}</td>
                    <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-100">{m.total}</td>
                    {mode === "pelunasan" && (
                      <td className="px-2 py-1 flex gap-2">
                        <button
                          className="bg-black dark:bg-gray-700 text-white hover:bg-gray-800 dark:hover:bg-gray-600 text-xs px-2 py-1 rounded transition-colors"
                          onClick={() => handleEditAwb(m)}
                        >
                          Edit
                        </button>
                        <button
                          className="bg-green-500 dark:bg-green-600 text-white hover:bg-green-600 dark:hover:bg-green-700 text-xs px-2 py-1 rounded transition-colors"
                          onClick={() => handlePrint(m)}
                        >
                          Print
                        </button>
                        <button
                          className="bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700 text-xs px-2 py-1 rounded transition-colors"
                          onClick={() => handleDownloadPDF(m)}
                        >
                          Download PDF
                        </button>
                        {(userRole === 'admin' || userRole === 'branch' || userRole === 'cabang') && (
                          <button
                            className="bg-red-500 dark:bg-red-600 text-white hover:bg-red-600 dark:hover:bg-red-700 text-xs px-2 py-1 rounded transition-colors"
                            onClick={async () => {
                              if (confirm(`Hapus resi ini (AWB: ${m.awb_no})? Karena ini akan menghapus permanen.`)) {
                                try {
                                  const targetTable = userRole === 'cabang' ? "manifest_cabang" : "manifest"
                                  const { error } = await supabaseClient
                                    .from(targetTable)
                                    .delete()
                                    .eq("awb_no", m.awb_no);
                                  if (error) {
                                    alert("Gagal menghapus item: " + error.message);
                                  } else {
                                    setData(data.filter((item) => item.awb_no !== m.awb_no));
                                    supabaseClient
                                      .from(targetTable)
                                      .select("*")
                                      .order("awb_date", { ascending: false })
                                      .then(({ data: freshData }) => {
                                        setData(freshData || []);
                                      });
                                  }
                                } catch (err) {
                                  alert("Terjadi kesalahan saat menghapus item.");
                                }
                              }
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}