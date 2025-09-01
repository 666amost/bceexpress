"use client"

import React, { useState, useMemo, useRef } from "react"
import { supabaseClient } from "../lib/auth"
import PrintLayout from "./PrintLayout" // Pastikan ini merujuk ke PrintLayout.jsx yang sudah diperbarui
import CustomerSelector from "./CustomerSelector"
import { AwbFormData, ChangeEvent, FormEvent } from "../types"

interface Customer {
  id: string
  customer_name: string
  customer_phone: string | null
  nama_pengirim: string
  nomor_pengirim: string | null
  nama_penerima: string
  nomor_penerima: string | null
  alamat_penerima: string | null
  kota_tujuan: string | null
  kecamatan: string | null // untuk branch bangka
  wilayah: string | null // untuk branch tanjung_pandan dan pusat
  kirim_via: string | null
  isi_barang: string | null
  metode_pembayaran: string | null
  agent_customer: string | null
  notes: string | null
  branch_origin: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface AwbFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  initialData: Partial<AwbFormData> | null;
  isEditing: boolean;
  userRole: string | null;
  branchOrigin: string | null;
}

const kotaWilayahPusat = {
  bangka: ["Pangkal Pinang", "Sungailiat", "Belinyu", "Jebus", "Koba", "Toboali", "Mentok"],
  "kalimantan barat": ["Pontianak", "Singkawang", "Sungai Pinyuh"],
  belitung: ["Tj Pandan"],
  bali: ["Denpasar"],
}

const hargaPerKg = {
  "Pangkal Pinang": 28000,
  Sungailiat: 30000,
  Belinyu: 28000,
  Jebus: 28000,
  Koba: 31000,
  Toboali: 32000,
  Mentok: 32000,
  Pontianak: 32000,
  Singkawang: 35000,
  "Sungai Pinyuh": 35000,
  "Tj Pandan": 28000,
  "Denpasar": 30000,
}

const agentList = [
  "UDR CASH",
  "SEA CASH",
  "GLC UDR TRF",
  "GLC SEA TRF",
  "COD UDR",
  "COD SEA",
  "KMY UDR TRF",
  "KMY SEA TRF",
  "KARTINI KIKI",
  "DUTA GARDEN FRENITA",
  "FELLISIA PORIS EX 3",
  "OTTY OFFICIAL",
  "CITRA 3 RENY",
  "HENDI",
  "PRALITA",
  "SALIM",
  "ISKANDAR",
  "IMAM",
  "DONI",
  "HERFAN",
  "EZZA",
  "YANDRI",
  "DIKY",
  "YOS",
  "INDAH SUSHI TIME",
  "CENTRAL NURSERY BANGKA",
  "MAMAPIA",
  "AMELIA PEDINDANG",
  "HENDRY LIMIA",
  "JESS DOT",
  "SEPIRING RASA BASO",
  "CHRISTINE PADEMANGAN",
  "Amertha / Holai Resto"
]

const metodePembayaran = ["cash", "transfer", "cod"]
const kirimVia = ["udara", "darat"]
const kotaTujuan = ["bangka", "kalimantan barat", "belitung", "bali"]

// Data spesifik untuk cabang Tanjung Pandan (origin_branch = 'tanjung_pandan')
const kotaWilayahTanjungPandan = {
  jakarta: ["JKT"], // Simplified wilayah for Jakarta area
  tangerang: ["TGT"],
  bekasi: ["BKS"],
  depok: ["DPK"],
  bogor: ["BGR"],
};

const hargaPerKgTanjungPandan = {
  JKT: 21000,
  TGT: 24000,
  BKS: 24000,
  DPK: 28000,
  BGR: 24000,
};

const agentListTanjungPandan = [
  "COD",
  "TRANSFER",
  "CASH",
  "Wijaya Crab"
];

const metodePembayaranTanjungPandan = ["cash", "transfer", "cod"]; // Same as pusat for now
const kirimViaTanjungPandan = ["udara", "darat"]; // Same as pusat for now

function generateAwbNo(originBranch?: string | null) {
  const timestamp = Date.now().toString()
  const lastSixDigits = timestamp.slice(-6)
  // Normalize originBranch safely (handle null) for case-insensitive comparison
  const normalized = originBranch ? originBranch.toLowerCase() : undefined
  const suffix = normalized === 'tanjung_pandan' ? 'TJQ' : ''
  return "BCE" + lastSixDigits + suffix
}

export default function AwbForm({ onSuccess, onCancel, initialData, isEditing, userRole, branchOrigin }: AwbFormProps) {
  // Helper to get local date string in Asia/Jakarta timezone using Intl
  function getLocalDateString(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }

  const [form, setForm] = useState<AwbFormData>(
    {
      awb_no: "",
      awb_date: getLocalDateString(),
      kirim_via: "",
      kota_tujuan: "",
      wilayah: "",
      metode_pembayaran: "",
      agent_customer: "",
      nama_pengirim: "",
      nomor_pengirim: "",
      nama_penerima: "",
      nomor_penerima: "",
      alamat_penerima: "",
      coli: 1,
      berat_kg: 1,
      harga_per_kg: 0,
      sub_total: 0,
      biaya_admin: 0,
      biaya_packaging: 0,
      biaya_transit: 0,
      total: 0,
      isi_barang: "",
      ...initialData
    },
  )
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [showPrintPreview, setShowPrintPreview] = useState(false) // State ini mungkin tidak digunakan secara langsung untuk pencetakan iframe
  const [showCustomerSelector, setShowCustomerSelector] = useState(false)
  const printFrameRef = useRef<HTMLDivElement>(null) // Ref untuk div tersembunyi yang merender PrintLayout
  // Determine which data source to use based on branchOrigin (not userRole)
  const currentKotaWilayah = branchOrigin === 'tanjung_pandan' ? kotaWilayahTanjungPandan : kotaWilayahPusat;
  const currentHargaPerKg = branchOrigin === 'tanjung_pandan' ? hargaPerKgTanjungPandan : hargaPerKg;
  const currentAgentList = branchOrigin === 'tanjung_pandan' ? agentListTanjungPandan : agentList;
  const currentMetodePembayaran = branchOrigin === 'tanjung_pandan' ? metodePembayaranTanjungPandan : metodePembayaran;
  const currentKirimVia = branchOrigin === 'tanjung_pandan' ? kirimViaTanjungPandan : kirimVia;
  const currentKotaTujuan = Object.keys(currentKotaWilayah);

  const wilayahOptions = useMemo(() => {
    const options = currentKotaWilayah[form.kota_tujuan as keyof typeof currentKotaWilayah];
    return (options as string[]) || [];
  }, [form.kota_tujuan, currentKotaWilayah])

  React.useEffect(() => {
    if (form.wilayah && currentHargaPerKg[form.wilayah as keyof typeof currentHargaPerKg]) {
      setForm((f) => ({ ...f, harga_per_kg: currentHargaPerKg[form.wilayah as keyof typeof currentHargaPerKg] }))
    }
  }, [form.wilayah, currentHargaPerKg])

  React.useEffect(() => {
    const sub_total = Number(form.berat_kg) * Number(form.harga_per_kg)
    const total = sub_total + Number(form.biaya_admin) + Number(form.biaya_packaging) + Number(form.biaya_transit)
    setForm((f) => ({ ...f, sub_total, total }))
  }, [form.berat_kg, form.harga_per_kg, form.biaya_admin, form.biaya_packaging, form.biaya_transit])

  // Handle customer selection from CustomerSelector for AwbForm (uses wilayah instead of kecamatan)
  const handleCustomerSelect = (customer: Customer): void => {
    setForm(prev => ({
      ...prev,
      nama_pengirim: customer.nama_pengirim || '',
      nomor_pengirim: customer.nomor_pengirim || '',
      nama_penerima: customer.nama_penerima || '',
      nomor_penerima: customer.nomor_penerima || '',
      alamat_penerima: customer.alamat_penerima || '',
      kota_tujuan: customer.kota_tujuan || '',
      wilayah: customer.wilayah || '', // AwbForm uses wilayah instead of kecamatan
      kirim_via: customer.kirim_via || '',
      metode_pembayaran: customer.metode_pembayaran || '',
      agent_customer: customer.agent_customer || '',
      isi_barang: customer.isi_barang || ''
    }))
    
    // Update harga berdasarkan customer data
    if (customer.wilayah && currentHargaPerKg[customer.wilayah as keyof typeof currentHargaPerKg]) {
      setForm(prev => ({
        ...prev,
        harga_per_kg: currentHargaPerKg[customer.wilayah as keyof typeof currentHargaPerKg],
        sub_total: currentHargaPerKg[customer.wilayah as keyof typeof currentHargaPerKg] * (prev.berat_kg || 0),
        total: (currentHargaPerKg[customer.wilayah as keyof typeof currentHargaPerKg] * (prev.berat_kg || 0)) + (prev.biaya_admin || 0) + (prev.biaya_packaging || 0) + (prev.biaya_transit || 0)
      }));
    }
    
    setError('');
    setSuccess('Data customer berhasil diimport!');
    setTimeout(() => setSuccess(''), 3000);
  }

  const handleChange = (e: ChangeEvent) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
    setError("")
    setSuccess("")
  }

  const handleSelectChange = (name: string, value: string) => {
    setForm((f) => ({ ...f, [name]: value }))
    setError("")
    setSuccess("")
  }

  const handleGenerateAwb = (e: FormEvent) => {
    e.preventDefault()
  setForm((f) => ({ ...f, awb_no: generateAwbNo(branchOrigin) }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    if (!form.awb_no || !form.kota_tujuan || !form.wilayah || !form.nama_pengirim || !form.nama_penerima) {
      setError("Mohon lengkapi semua field wajib.")
      return
    }

    // Determine the target table
    const targetTable = branchOrigin === 'tanjung_pandan' ? 'manifest_cabang' : 'manifest';

    // Add origin_branch if inserting into manifest_cabang
    const dataToSave = branchOrigin === 'tanjung_pandan' ? { ...form, origin_branch: branchOrigin } : form;

    try {
      if (isEditing && initialData?.awb_no) {
        const { error: sbError } = await supabaseClient
          .from(targetTable)
          .update(dataToSave)
          .eq("awb_no", initialData.awb_no)

        if (sbError) {
          setError("Gagal memperbarui data: " + sbError.message)
          return
        } else {
          setSuccess("Data berhasil diperbarui!")
          setTimeout(() => {
            handlePrint(() => {
              setForm({
                awb_no: "",
                awb_date: getLocalDateString(),
                kirim_via: "",
                kota_tujuan: "",
                wilayah: "",
                metode_pembayaran: "",
                agent_customer: "",
                nama_pengirim: "",
                nomor_pengirim: "",
                nama_penerima: "",
                nomor_penerima: "",
                alamat_penerima: "",
                coli: 1,
                berat_kg: 1,
                harga_per_kg: 0,
                sub_total: 0,
                biaya_admin: 0,
                biaya_packaging: 0,
                biaya_transit: 0,
                total: 0,
                isi_barang: "",
              });
            });
          }, 100);
        }
      } else {
        const { error: sbError } = await supabaseClient.from(targetTable).insert([dataToSave])
        if (sbError) {
          setError("Gagal menyimpan data: " + sbError.message)
          return
        } else {
          setSuccess("Data berhasil disimpan!")
          setTimeout(() => {
            handlePrint(() => {
              setForm({
                awb_no: "",
                awb_date: getLocalDateString(),
                kirim_via: "",
                kota_tujuan: "",
                wilayah: "",
                metode_pembayaran: "",
                agent_customer: "",
                nama_pengirim: "",
                nomor_pengirim: "",
                nama_penerima: "",
                nomor_penerima: "",
                alamat_penerima: "",
                coli: 1,
                berat_kg: 1,
                harga_per_kg: 0,
                sub_total: 0,
                biaya_admin: 0,
                biaya_packaging: 0,
                biaya_transit: 0,
                total: 0,
                isi_barang: "",
              });
            });
          }, 100);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError("Terjadi kesalahan: " + errorMessage)
    }
  }

  const handleDownloadPDF = async (e?: FormEvent) => {
    if (e?.preventDefault) {
      e.preventDefault();
    }
    setError("");
    setSuccess("");
    if (!form.awb_no || !form.kota_tujuan || !form.wilayah || !form.nama_pengirim || !form.nama_penerima) {
      setError("Mohon lengkapi semua field wajib.");
      return;
    }

    try {
      const targetTable = branchOrigin === 'tanjung_pandan' ? 'manifest_cabang' : 'manifest';
      const dataToSave = branchOrigin === 'tanjung_pandan' ? { ...form, origin_branch: branchOrigin } : form;

      const { error: sbError } = await supabaseClient.from(targetTable).insert([dataToSave]);
      if (sbError) {
        setError("Gagal menyimpan data: " + sbError.message);
        return;
      } else {
        setSuccess("Data berhasil disimpan!");
        
        // Tunggu sebentar untuk memastikan PrintLayout ter-render
        setTimeout(async () => {
          if (printFrameRef.current) {
            try {
              // Tambahkan CSS khusus untuk PDF yang menaikkan posisi payment method code
              const pdfSpecificStyle = document.createElement('style');
              pdfSpecificStyle.innerHTML = `
                .payment-method-code {
                  font-size: 20px !important;
                  font-weight: bold !important;
                  width: 100% !important;
                  text-align: center !important;
                  margin-top: -1mm !important;
                  display: block !important;
                  position: relative !important;
                  top: -1mm !important;
                }
                .logo-qr {
                  padding-top: 0mm !important;
                }
                /* CSS untuk menaikkan detail pengiriman */
                .shipping-details {
                  margin-top: -2mm !important;
                }
                /* CSS untuk menaikkan teks agent di dalam kotaknya */
                .agent-code-box .agent-abbr-left {
                  position: relative !important;
                  top: -3mm !important; /* Sesuaikan nilai ini jika perlu */
                }
              `;
              printFrameRef.current.appendChild(pdfSpecificStyle);

              // Import html2pdf
              const html2pdf = await import('html2pdf.js');
              
              // Konfigurasi untuk PDF yang lebih baik
              const options = {
                filename: form.awb_no + '.pdf',
                margin: 0,
                image: { 
                  type: 'jpeg', 
                  quality: 1.0 
                },
                html2canvas: { 
                  scale: 3,
                  useCORS: true,
                  allowTaint: true,
                  backgroundColor: '#ffffff',
                  width: 378, // 100mm * 3.78 (96 DPI to mm conversion * scale)
                  height: 378,
                  scrollX: 0,
                  scrollY: 0
                },
                jsPDF: { 
                  unit: 'mm', 
                  format: [100, 100] as [number, number], 
                  orientation: 'portrait',
                  compress: true
                }
              };
              
              // Generate PDF langsung dari element yang sudah ter-render
              await html2pdf.default()
                .set(options)
                .from(printFrameRef.current)
                .save();

              // Hapus style khusus PDF setelah selesai
              printFrameRef.current.removeChild(pdfSpecificStyle);
                
              // Reset form setelah PDF selesai didownload
              setForm({
                awb_no: "",
                awb_date: getLocalDateString(),
                kirim_via: "",
                kota_tujuan: "",
                wilayah: "",
                metode_pembayaran: "",
                agent_customer: "",
                nama_pengirim: "",
                nomor_pengirim: "",
                nama_penerima: "",
                nomor_penerima: "",
                alamat_penerima: "",
                coli: 1,
                berat_kg: 1,
                harga_per_kg: 0,
                sub_total: 0,
                biaya_admin: 0,
                biaya_packaging: 0,
                biaya_transit: 0,
                total: 0,
                isi_barang: "",
              });
            } catch (error) {
              alert('Gagal membuat PDF. Silakan coba lagi.');
            }
          }
        }, 600); // Tunggu lebih lama untuk memastikan rendering selesai
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError("Terjadi kesalahan: " + errorMessage);
    }
  }

  // === FUNGSI HANDLE PRINT YANG DIUPDATE ===
  const handlePrint = (onAfterPrint: () => void) => {
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
        overflow: hidden;
      }

      .top-header-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        padding-bottom: 0mm;
      }

      .top-header-left {
        flex: 0 0 auto;
      }

      .top-header-center {
        flex: 1;
        text-align: center;
      }

      .top-header-right {
        flex: 0 0 auto;
      }

      .cod-text {
        font-size: 14px;
        font-weight: bold;
      }

      .header-logo {
        width: 20mm;
        height: auto;
        display: block;
        box-sizing: border-box;
      }

      .barcode-container {
        display: flex;
        align-items: center;
        margin-top: -2mm;
        margin-bottom: 1mm;
        flex-shrink: 0;
        gap: 2mm;
      }

      .agent-code-box {
        border: 2px solid #000;
        padding: 2mm;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 20mm;
        height: 20mm;
        flex-shrink: 0;
        background-color: #000;
      }

      .agent-abbr-left {
        font-size: 20px;
        font-weight: bold;
        text-align: center;
        color: #fff;
      }

      .barcode-section {
        display: flex;
        flex-direction: column;
        align-items: center;
        border: 2px solid #000;
        padding: 1mm;
        flex: 1;
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
        flex-shrink: 0;
      }

      .total-bold {
        font-weight: bold;
      }

      .content-section {
        display: flex;
        flex: 1;
        margin-bottom: 0mm;
        overflow: hidden;
      }

      .address-box {
        flex: 1;
        border: 1px solid #000;
        padding: 1mm;
        margin-right: 3mm;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        font-size: 11px;
        font-weight: bold;
        height: 40mm;
        overflow-y: auto;
        ::-webkit-scrollbar {
          display: none;
        }
        -ms-overflow-style: none;
        scrollbar-width: none;
        flex-shrink: 0;
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
        height: 45mm;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        padding-top: 1mm;
        flex-shrink: 0;
        min-height: 35mm;
        overflow: visible;
      }

      .qr-code {
        width: 30mm !important;
        height: 30mm !important;
        display: block !important;
        box-sizing: border-box;
      }

      .payment-method-code {
        font-size: 15px;
        font-weight: bold;
        width: 100%;
        text-align: center;
        margin-top: 1mm;
        display: block;
      }

      .footer-container {
        width: 100%;
        margin-top: auto;
        flex-shrink: 0;
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
        padding-top: 0;
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
        font-size: 20px;
        font-weight: bold;
        text-align: right;
        margin-right: 2mm;
        margin-top: -3mm;
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

        .shipping-label {
           width: 100%;
           height: 100%;
           box-sizing: border-box;
           display: flex;
           flex-direction: column;
           overflow: hidden;
        }

        .top-header-container, .barcode-container, .shipping-details, .footer-container {
            flex-shrink: 0;
        }

        .content-section {
            flex: 1;
            display: flex;
            flex-direction: row;
            overflow: hidden;
        }

        .address-box {
            flex: 1;
            padding: 1mm;
            margin-right: 3mm;
            overflow-y: auto;
            font-size: 11px;
            font-weight: bold;
            border: 1px solid #000;
            display: flex;
            flex-direction: column;
            flex-shrink: 0;
        }

        .logo-qr {
            width: 30mm;
            height: 45mm;
            flex-shrink: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            padding-top: 1mm;
            min-height: 35mm;
            overflow: visible;
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

        .barcode-container {
          display: flex;
          align-items: center;
          margin-top: -2mm;
          margin-bottom: 1mm;
          flex-shrink: 0;
          gap: 2mm;
        }

        .agent-code-box {
          border: 2px solid #000;
          padding: 2mm;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 20mm;
          height: 20mm;
          flex-shrink: 0;
          background-color: #000;
        }

        .agent-abbr-left {
          font-size: 20px;
          font-weight: bold;
          text-align: center;
          color: #fff;
        }

        .barcode-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          border: 2px solid #000;
          padding: 1mm;
          flex: 1;
        }

        .payment-method-code {
          font-size: 15px;
          font-weight: bold;
          width: 100%;
          text-align: center;
          margin-top: 0mm;
          position: relative;
          top: 1mm;
        }

        .total-bold {
          font-weight: bold;
        }
      }
      /* === END: CSS disinkronkan dari PrintLayout.jsx === */
    `;

    setTimeout(() => {
      if (printFrameRef.current) {
        try {
          const printWindow = window.open('', '_blank');
          if (!printWindow) {
            throw new Error('Popup diblokir. Mohon izinkan popup di browser Anda.');
          }
          printWindow.document.write('<html><head><title>Cetak AWB</title>');
          printWindow.document.write('<style>');
          printWindow.document.write(printLayoutCss);
          printWindow.document.write('</style></head><body>');
          printWindow.document.write(printFrameRef.current.innerHTML);
          printWindow.document.write('</body></html>');
          printWindow.document.close();
          
          printWindow.addEventListener('afterprint', () => {
            printWindow.close();
            if (onSuccess) onSuccess();
            if (onAfterPrint) onAfterPrint();
          });
          
          setTimeout(() => printWindow.print(), 750);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
          alert('Terjadi kesalahan saat mencetak: ' + errorMessage + '. Silakan coba lagi atau periksa pengaturan browser.');
        }
      }
    }, 100);
  };
  // === AKHIR FUNGSI HANDLE PRINT YANG DIUPDATE ===

  return (
    <>
      {/* Hidden print frame */}
      {/* Ini adalah tempat di mana PrintLayout dirender agar kontennya bisa diambil oleh fungsi cetak */}
      <div className="hidden">
        <div ref={printFrameRef}>
          <PrintLayout data={form} />
        </div>
      </div>

      <form onSubmit={handleSubmit} autoComplete="off" className="w-full max-w-none mx-0 px-0 py-6 bg-transparent">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <h2 className="text-2xl font-extrabold text-blue-900 dark:text-blue-100 tracking-tight">
            {isEditing ? "Edit AWB Manifest" : "Input AWB Manifest"}
          </h2>
          <button
            type="button"
            onClick={() => setShowCustomerSelector(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Import Customer
          </button>
        </div>
        {error && <div className="mb-2 p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg font-semibold shadow border border-red-200 dark:border-red-800">{error}</div>}
        {success && (
          <div className="mb-2 p-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg font-semibold shadow border border-green-200 dark:border-green-800">{success}</div>
        )}
        {/* Section 1: Data Pengiriman - Improved spacing for landscape mode */}
        <section className="bg-white/70 dark:bg-gray-800/80 rounded-lg p-3 border border-blue-100 dark:border-gray-600 shadow flex flex-col md:flex-row gap-6 items-end mb-2">
          {/* AWB Number with Generate button - Fixed width to prevent overlap */}
          <div className="flex flex-col w-full md:w-64">
            <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Nomor Resi (AWB)</label>
            <div className="flex w-full gap-2 items-center">
              <input
                type="text"
                name="awb_no"
                value={form.awb_no}
                onChange={handleChange}
                required
                className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 flex-grow px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900 min-w-0"
                style={{ minWidth: 0 }}
              />
              <button
                onClick={handleGenerateAwb}
                type="button"
                className="flex-shrink-0 px-4 py-1 bg-blue-600 dark:bg-blue-700 text-white font-bold rounded shadow hover:bg-blue-700 dark:hover:bg-blue-800 text-sm whitespace-nowrap transition-colors"
                style={{ zIndex: 1 }}
              >
                Generate
              </button>
            </div>
          </div>
          {/* Geser field lain ke kanan di desktop */}
          <div className="flex flex-col w-full md:w-40 md:ml-4">
            <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Tanggal AWB</label>
            <input
              type="date"
              name="awb_date"
              value={form.awb_date}
              onChange={handleChange}
              required
              className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
            />
          </div>
          <div className="flex flex-col w-full md:w-32 md:ml-4">
            <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Kirim Via</label>
            <select
              name="kirim_via"
              value={form.kirim_via}
              onChange={handleChange}
              required
              className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
            >
              <option value="">Pilih</option>
              {currentKirimVia.map((opt) => (
                <option key={opt} value={opt}>
                  {opt.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col w-full md:w-40 md:ml-4">
            <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Kota Tujuan</label>
            <select
              name="kota_tujuan"
              value={form.kota_tujuan}
              onChange={handleChange}
              required
              className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
            >
              <option value="">Pilih</option>
              {currentKotaTujuan.map((opt) => (
                <option key={opt} value={opt}>
                  {opt.replace(/\b\w/g, (l) => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col w-full md:w-36 md:ml-4">
            <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Wilayah</label>
            <select
              name="wilayah"
              value={form.wilayah}
              onChange={handleChange}
              required
              disabled={!form.kota_tujuan}
              className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900 disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:text-gray-500 dark:disabled:text-gray-400"
            >
              <option value="">Pilih</option>
              {wilayahOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col w-40 md:ml-4">
            <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Agent</label>
            <select
              name="agent_customer"
              value={form.agent_customer}
              onChange={handleChange}
              required
              className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
            >
              <option value="">Pilih</option>
              {currentAgentList.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </section>
        {/* Section 2: Data Penerima */}
        <section className="bg-white/70 dark:bg-gray-800/80 rounded-lg p-3 border border-blue-100 dark:border-gray-600 shadow flex flex-wrap gap-4 items-end mb-2">
          <div className="flex flex-col w-40 min-w-[140px]">
            <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Nama Pengirim</label>
            <input
              type="text"
              name="nama_pengirim"
              value={form.nama_pengirim}
              onChange={handleChange}
              required
              className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
            />
          </div>
          <div className="flex flex-col w-40 min-w-[140px]">
            <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Nomor Pengirim</label>
            <input
              type="tel"
              name="nomor_pengirim"
              value={form.nomor_pengirim}
              onChange={handleChange}
              required
              className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
            />
          </div>
          <div className="flex flex-col w-40 min-w-[140px]">
            <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Nama Penerima</label>
            <input
              type="text"
              name="nama_penerima"
              value={form.nama_penerima}
              onChange={handleChange}
              required
              className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
            />
          </div>
          <div className="flex flex-col w-40 min-w-[140px]">
            <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Nomor Penerima</label>
            <input
              type="tel"
              name="nomor_penerima"
              value={form.nomor_penerima}
              onChange={handleChange}
              required
              className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
            />
          </div>
          {/* FIELD ALAMAT PENERIMA FULL WIDTH */}
          <div className="flex flex-col w-full">
            <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Alamat Penerima</label>
            <textarea
              id="alamat_penerima"
              name="alamat_penerima"
              value={form.alamat_penerima}
              onChange={handleChange}
              required
              className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900 min-h-[120px] md:min-h-[80px]"
            />
          </div>
          <div className="flex flex-col w-24 min-w-[70px]">
            <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Coli</label>
            <input
              type="number"
              name="coli"
              value={form.coli}
              onChange={handleChange}
              min={1}
              required
              className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
            />
          </div>
          {/* Moved Isi Barang field here */}
          <div className="flex flex-col w-40 min-w-[140px]">
            <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Isi Barang</label>
            <textarea
              name="isi_barang"
              value={form.isi_barang}
              onChange={handleChange}
              className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900 min-h-[32px]"
              placeholder="Contoh: Pakaian, Elektronik, Makanan"
            />
          </div>
        </section>
        {/* Section 3: Ongkos & Biaya - Made responsive */}
        <section className="bg-white/70 dark:bg-gray-800/80 rounded-lg p-3 border border-blue-100 dark:border-gray-600 shadow flex flex-col md:flex-wrap md:flex-row gap-4 items-end mb-2">
          <div className="flex flex-col w-full md:w-28">
            <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Berat (kg)</label>
            <input
              type="number"
              name="berat_kg"
              value={form.berat_kg}
              onChange={handleChange}
              min={1}
              step={0.1}
              required
              className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
            />
          </div>
          <div className="flex flex-col w-full md:w-28">
            <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Harga/kg</label>
            <input
              type="number"
              name="harga_per_kg"
              value={form.harga_per_kg}
              onChange={handleChange}
              className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
            />
          </div>
          <div className="flex flex-col w-full md:w-28">
            <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Subtotal</label>
            <input
              type="number"
              name="sub_total"
              value={form.sub_total}
              readOnly
              className="bg-gray-100 dark:bg-gray-600 rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition text-gray-700 dark:text-gray-300"
            />
          </div>
          <div className="flex flex-col w-full md:w-28">
            <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Biaya Admin</label>
            <input
              type="number"
              name="biaya_admin"
              value={form.biaya_admin}
              onChange={handleChange}
              className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
            />
          </div>
          <div className="flex flex-col w-full md:w-28">
            <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Biaya Packaging</label>
            <input
              type="number"
              name="biaya_packaging"
              value={form.biaya_packaging}
              onChange={handleChange}
              className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
            />
          </div>
          <div className="flex flex-col w-full md:w-28">
            <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Biaya Transit</label>
            <input
              type="number"
              name="biaya_transit"
              value={form.biaya_transit}
              onChange={handleChange}
              className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
            />
          </div>
          <div className="flex flex-col w-full md:w-32 md:ml-auto">
            <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Total</label>
            <input
              type="number"
              name="total"
              value={form.total}
              readOnly
              className="bg-gray-100 dark:bg-gray-600 rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-base shadow-sm transition font-bold text-gray-700 dark:text-gray-200"
            />
          </div>
          <div className="flex flex-col w-full md:w-32 md:ml-auto">
            <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Metode</label>
            <select
              name="metode_pembayaran"
              value={form.metode_pembayaran}
              onChange={handleChange}
              required
              className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
            >
              <option value="">Pilih</option>
              {currentMetodePembayaran.map((opt) => (
                <option key={opt} value={opt}>
                  {opt.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </section>
        <div className="flex flex-col md:flex-row justify-between mt-2 gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded mb-2 md:mb-0 hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
              Batal
            </button>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 dark:bg-blue-700 text-white font-bold rounded shadow-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition text-base"
            >
              {isEditing ? "UPDATE DAN PRINT" : "SIMPAN DAN PRINT"}
            </button>
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="px-6 py-2 bg-red-600 dark:bg-red-700 text-white font-bold rounded shadow-lg hover:bg-red-700 dark:hover:bg-red-800 transition text-base"
            >
              DOWNLOAD PDF
            </button>
          </div>
        </div>
      </form>

      {/* Customer Selector Modal */}
      {showCustomerSelector && (
        <CustomerSelector
          onCustomerSelect={handleCustomerSelect}
          onClose={() => setShowCustomerSelector(false)}
          branchOrigin={branchOrigin}
          userRole={userRole}
        />
      )}
    </>
  )
}