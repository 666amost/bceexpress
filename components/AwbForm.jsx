"use client"

import React, { useState, useMemo, useRef } from "react"
import { supabaseClient } from "../lib/auth"
import PrintLayout from "./PrintLayout" // Pastikan ini merujuk ke PrintLayout.jsx yang sudah diperbarui

const kotaWilayah = {
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
  "CHRISTINE PADEMANGAN"
]

const metodePembayaran = ["cash", "transfer", "cod"]
const kirimVia = ["udara", "darat"]
const kotaTujuan = ["bangka", "kalimantan barat", "belitung", "bali"]

function generateAwbNo() {
  const timestamp = Date.now().toString()
  const lastSixDigits = timestamp.slice(-6)
  return "BCE" + lastSixDigits
}

export default function AwbForm({ onSuccess, onCancel, initialData, isEditing }) {
  const [form, setForm] = useState(
    initialData || {
      awb_no: "",
      awb_date: new Date().toISOString().slice(0, 10),
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
    },
  )
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [showPrintPreview, setShowPrintPreview] = useState(false) // State ini mungkin tidak digunakan secara langsung untuk pencetakan iframe
  const printFrameRef = useRef(null) // Ref untuk div tersembunyi yang merender PrintLayout
  const wilayahOptions = useMemo(() => kotaWilayah[form.kota_tujuan] || [], [form.kota_tujuan])

  React.useEffect(() => {
    if (form.wilayah && hargaPerKg[form.wilayah]) {
      setForm((f) => ({ ...f, harga_per_kg: hargaPerKg[form.wilayah] }))
    }
  }, [form.wilayah])

  React.useEffect(() => {
    const sub_total = form.berat_kg * form.harga_per_kg
    const total = sub_total + Number(form.biaya_admin) + Number(form.biaya_packaging) + Number(form.biaya_transit)
    setForm((f) => ({ ...f, sub_total, total }))
  }, [form.berat_kg, form.harga_per_kg, form.biaya_admin, form.biaya_packaging, form.biaya_transit])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
    setError("")
    setSuccess("")
  }

  const handleSelectChange = (name, value) => {
    setForm((f) => ({ ...f, [name]: value }))
    setError("")
    setSuccess("")
  }

  const handleGenerateAwb = (e) => {
    e.preventDefault()
    setForm((f) => ({ ...f, awb_no: generateAwbNo() }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    if (!form.awb_no || !form.kota_tujuan || !form.wilayah || !form.nama_pengirim || !form.nama_penerima) {
      setError("Mohon lengkapi semua field wajib.")
      return
    }

    try {
      if (isEditing && initialData?.awb_no) {
        const { error: sbError } = await supabaseClient
          .from("manifest")
          .update({ ...form })
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
                awb_date: new Date().toISOString().slice(0, 10),
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
        const { error: sbError } = await supabaseClient.from("manifest").insert([{ ...form }])
        if (sbError) {
          setError("Gagal menyimpan data: " + sbError.message)
          return
        } else {
          setSuccess("Data berhasil disimpan!")
          setTimeout(() => {
            handlePrint(() => {
              setForm({
                awb_no: "",
                awb_date: new Date().toISOString().slice(0, 10),
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
      setError("Terjadi kesalahan: " + err.message)
    }
  }

  const handleDownloadPDF = async (e) => {
    e.preventDefault && e.preventDefault();
    setError("");
    setSuccess("");
    if (!form.awb_no || !form.kota_tujuan || !form.wilayah || !form.nama_pengirim || !form.nama_penerima) {
      setError("Mohon lengkapi semua field wajib.");
      return;
    }
    try {
      const { error: sbError } = await supabaseClient.from("manifest").insert([{ ...form }]);
      if (sbError) {
        setError("Gagal menyimpan data: " + sbError.message);
        return;
      } else {
        setSuccess("Data berhasil disimpan!");
        // Tunggu PrintLayout render, lalu generate PDF
        setTimeout(async () => {
          if (printFrameRef.current) {
            const html2pdf = await import('html2pdf.js');
            html2pdf.default()
              .set({
                filename: form.awb_no + '.pdf',
                margin: 0,
                jsPDF: { unit: 'mm', format: [100, 100], orientation: 'portrait' }
              })
              .from(printFrameRef.current)
              .save()
              .then(() => {
                // Reset form setelah PDF selesai didownload
                setForm({
                  awb_no: "",
                  awb_date: new Date().toISOString().slice(0, 10),
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
          }
        }, 100);
      }
    } catch (err) {
      setError("Terjadi kesalahan: " + err.message);
    }
  }

  // === FUNGSI HANDLE PRINT YANG DIUPDATE ===
  const handlePrint = (onAfterPrint) => {
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
        font-size: 11px;
        font-weight: bold;
      }

      .address-box .sender-info > div,
      .address-box .recipient-info > div {
        border-bottom: 1px dotted #999;
        padding-bottom: 0.6mm;
        margin-bottom: 0.5mm;
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
          console.error('Error saat mencetak:', error);
          alert('Terjadi kesalahan saat mencetak: ' + error.message + '. Silakan coba lagi atau periksa pengaturan browser.');
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
        <h2 className="text-2xl font-extrabold text-blue-900 mb-4 tracking-tight">
          {isEditing ? "Edit AWB Manifest" : "Input AWB Manifest"}
        </h2>
        {error && <div className="mb-2 p-2 bg-red-100 text-red-700 rounded-lg font-semibold shadow">{error}</div>}
        {success && (
          <div className="mb-2 p-2 bg-green-100 text-green-700 rounded-lg font-semibold shadow">{success}</div>
        )}
        {/* Section 1: Data Pengiriman - Improved spacing for landscape mode */}
        <section className="bg-white/70 rounded-lg p-3 border border-blue-100 shadow flex flex-col md:flex-row gap-4 items-end mb-2">
          {/* AWB Number with Generate button - Fixed width to prevent overlap */}
          <div className="flex flex-col w-full md:w-64">
            <label className="text-xs font-semibold mb-1 text-blue-900">Nomor Resi (AWB)</label>
            <div className="flex w-full gap-2 items-center">
              <input
                type="text"
                name="awb_no"
                value={form.awb_no}
                onChange={handleChange}
                required
                className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 flex-grow px-2 py-1 text-sm shadow-sm transition bg-white"
              />
              <button
                onClick={handleGenerateAwb}
                type="button"
                className="flex-shrink-0 px-4 py-1 bg-blue-600 text-white font-bold rounded shadow hover:bg-blue-700 text-sm whitespace-nowrap"
              >
                Generate
              </button>
            </div>
          </div>

          {/* Date field - Separated with proper spacing */}
          <div className="flex flex-col w-full md:w-40">
            <label className="text-xs font-semibold mb-1 text-blue-900">Tanggal AWB</label>
            <input
              type="date"
              name="awb_date"
              value={form.awb_date}
              onChange={handleChange}
              required
              className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition bg-white"
            />
          </div>

          <div className="flex flex-col w-full md:w-32">
            <label className="text-xs font-semibold mb-1 text-blue-900">Kirim Via</label>
            <select
              name="kirim_via"
              value={form.kirim_via}
              onChange={handleChange}
              required
              className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition bg-white"
            >
              <option value="">Pilih</option>
              {kirimVia.map((opt) => (
                <option key={opt} value={opt}>
                  {opt.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col w-full md:w-40">
            <label className="text-xs font-semibold mb-1 text-blue-900">Kota Tujuan</label>
            <select
              name="kota_tujuan"
              value={form.kota_tujuan}
              onChange={handleChange}
              required
              className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition bg-white"
            >
              <option value="">Pilih</option>
              {kotaTujuan.map((opt) => (
                <option key={opt} value={opt}>
                  {opt.replace(/\b\w/g, (l) => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col w-full md:w-36">
            <label className="text-xs font-semibold mb-1 text-blue-900">Wilayah</label>
            <select
              name="wilayah"
              value={form.wilayah}
              onChange={handleChange}
              required
              disabled={!form.kota_tujuan}
              className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition bg-white disabled:bg-gray-100"
            >
              <option value="">Pilih</option>
              {wilayahOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col w-full md:w-40">
            <label className="text-xs font-semibold mb-1 text-blue-900">Agent</label>
            <select
              name="agent_customer"
              value={form.agent_customer}
              onChange={handleChange}
              required
              className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition bg-white"
            >
              <option value="">Pilih</option>
              {agentList.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </section>
        {/* Section 2: Data Penerima */}
        <section className="bg-white/70 rounded-lg p-3 border border-blue-100 shadow flex flex-wrap gap-4 items-end mb-2">
          <div className="flex flex-col w-40 min-w-[140px]">
            <label className="text-xs font-semibold mb-1 text-blue-900">Nama Pengirim</label>
            <input
              type="text"
              name="nama_pengirim"
              value={form.nama_pengirim}
              onChange={handleChange}
              required
              className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition bg-white"
            />
          </div>
          <div className="flex flex-col w-40 min-w-[140px]">
            <label className="text-xs font-semibold mb-1 text-blue-900">Nomor Pengirim</label>
            <input
              type="text"
              name="nomor_pengirim"
              value={form.nomor_pengirim}
              onChange={handleChange}
              required
              className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition bg-white"
            />
          </div>
          <div className="flex flex-col w-40 min-w-[140px]">
            <label className="text-xs font-semibold mb-1 text-blue-900">Nama Penerima</label>
            <input
              type="text"
              name="nama_penerima"
              value={form.nama_penerima}
              onChange={handleChange}
              required
              className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition bg-white"
            />
          </div>
          <div className="flex flex-col w-40 min-w-[140px]">
            <label className="text-xs font-semibold mb-1 text-blue-900">Nomor Penerima</label>
            <input
              type="text"
              name="nomor_penerima"
              value={form.nomor_penerima}
              onChange={handleChange}
              required
              className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition bg-white"
            />
          </div>
          <div className="flex flex-col w-full md:flex-1 md:min-w-[180px]"> {/* Make full width on mobile, flex on md+ */}
            <label className="text-xs font-semibold mb-1 text-blue-900">Alamat Penerima</label>
            <textarea
              id="alamat_penerima"
              name="alamat_penerima"
              value={form.alamat_penerima}
              onChange={handleChange}
              required
              className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition bg-white min-h-[120px] md:min-h-[80px]" // Height already adjusted for mobile/md+
            />
          </div>
          <div className="flex flex-col w-24 min-w-[70px]">
            <label className="text-xs font-semibold mb-1 text-blue-900">Coli</label>
            <input
              type="number"
              name="coli"
              value={form.coli}
              onChange={handleChange}
              min={1}
              required
              className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition bg-white"
            />
          </div>
          {/* Moved Isi Barang field here */}
          <div className="flex flex-col w-40 min-w-[140px]"> {/* Adjust width as needed */}
            <label className="text-xs font-semibold mb-1 text-blue-900">Isi Barang</label>
            <textarea
              name="isi_barang"
              value={form.isi_barang}
              onChange={handleChange}
              className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition bg-white min-h-[32px]" // Keep smaller height
              placeholder="Contoh: Pakaian, Elektronik, Makanan"
            />
          </div>
        </section>
        {/* Section 3: Ongkos & Biaya - Made responsive */}
        <section className="bg-white/70 rounded-lg p-3 border border-blue-100 shadow flex flex-col md:flex-wrap md:flex-row gap-4 items-end mb-2">
          <div className="flex flex-col w-full md:w-28">
            <label className="text-xs font-semibold mb-1 text-blue-900">Berat (kg)</label>
            <input
              type="number"
              name="berat_kg"
              value={form.berat_kg}
              onChange={handleChange}
              min={1}
              step={0.1}
              required
              className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition bg-white"
            />
          </div>
          <div className="flex flex-col w-full md:w-28">
            <label className="text-xs font-semibold mb-1 text-blue-900">Harga/kg</label>
            <input
              type="number"
              name="harga_per_kg"
              value={form.harga_per_kg}
              onChange={handleChange}
              className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition bg-white"
            />
          </div>
          <div className="flex flex-col w-full md:w-28">
            <label className="text-xs font-semibold mb-1 text-blue-900">Subtotal</label>
            <input
              type="number"
              name="sub_total"
              value={form.sub_total}
              readOnly
              className="bg-gray-100 rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition"
            />
          </div>
          <div className="flex flex-col w-full md:w-28">
            <label className="text-xs font-semibold mb-1 text-blue-900">Biaya Admin</label>
            <input
              type="number"
              name="biaya_admin"
              value={form.biaya_admin}
              onChange={handleChange}
              className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition bg-white"
            />
          </div>
          <div className="flex flex-col w-full md:w-28">
            <label className="text-xs font-semibold mb-1 text-blue-900">Biaya Packaging</label>
            <input
              type="number"
              name="biaya_packaging"
              value={form.biaya_packaging}
              onChange={handleChange}
              className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition bg-white"
            />
          </div>
          <div className="flex flex-col w-full md:w-28">
            <label className="text-xs font-semibold mb-1 text-blue-900">Biaya Transit</label>
            <input
              type="number"
              name="biaya_transit"
              value={form.biaya_transit}
              onChange={handleChange}
              className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition bg-white"
            />
          </div>
          <div className="flex flex-col w-full md:w-32 md:ml-auto">
            <label className="text-xs font-semibold mb-1 text-blue-900">Total</label>
            <input
              type="number"
              name="total"
              value={form.total}
              readOnly
              className="bg-gray-100 rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-base shadow-sm transition font-bold"
            />
          </div>
          <div className="flex flex-col w-full md:w-32 md:ml-auto">
            <label className="text-xs font-semibold mb-1 text-blue-900">Metode</label>
            <select
              name="metode_pembayaran"
              value={form.metode_pembayaran}
              onChange={handleChange}
              required
              className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition bg-white"
            >
              <option value="">Pilih</option>
              {metodePembayaran.map((opt) => (
                <option key={opt} value={opt}>
                  {opt.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </section>
        <div className="flex flex-col md:flex-row justify-between mt-2 gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-200 rounded mb-2 md:mb-0">
              Batal
            </button>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white font-bold rounded shadow-lg hover:bg-blue-700 transition text-base"
            >
              {isEditing ? "UPDATE DAN PRINT" : "SIMPAN DAN PRINT"}
            </button>
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="px-6 py-2 bg-red-600 text-white font-bold rounded shadow-lg hover:bg-red-700 transition text-base"
            >
              DOWNLOAD PDF
            </button>
          </div>
        </div>
      </form>
    </>
  )
}