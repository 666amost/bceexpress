"use client"

import React, { useState, useMemo, useRef, useEffect } from "react"
import { supabaseClient } from "../lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { FaPlus, FaTrash } from "react-icons/fa"
import PrintLayout from "./PrintLayout"

interface BulkAwbFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  userRole: string | null;
  branchOrigin: string | null;
}

interface AwbEntry {
  id: string; // Unique ID for React key management
  awb_no: string;
  nama_penerima: string;
  nomor_penerima: string;
  alamat_penerima: string;
  coli: number;
  isi_barang: string;
  berat_kg: number;
  harga_per_kg: number;
  sub_total: number;
  biaya_admin: number;
  biaya_packaging: number;
  biaya_transit: number;
  total: number;
  metode_pembayaran: string;
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
  "UDR CASH", "SEA CASH", "GLC UDR TRF", "GLC SEA TRF", "COD UDR", "COD SEA",
  "KMY UDR TRF", "KMY SEA TRF", "KARTINI KIKI", "DUTA GARDEN FRENITA", "FELLISIA PORIS EX 3",
  "OTTY OFFICIAL", "CITRA 3 RENY", "HENDI", "PRALITA", "SALIM", "ISKANDAR", "IMAM",
  "DONI", "HERFAN", "EZZA", "YANDRI", "DIKY", "YOS", "INDAH SUSHI TIME",
  "CENTRAL NURSERY BANGKA", "MAMAPIA", "AMELIA PEDINDANG", "HENDRY LIMIA", "JESS DOT",
  "SEPIRING RASA BASO", "CHRISTINE PADEMANGAN", "Amertha / Holai Resto"
]

const metodePembayaran = ["cash", "transfer", "cod"]
const kirimVia = ["udara", "darat"]
const kotaTujuan = ["bangka", "kalimantan barat", "belitung", "bali"]

// Data spesifik untuk cabang Tanjung Pandan (origin_branch = 'tanjung_pandan')
const kotaWilayahTanjungPandan = {
  jakarta: ["JKT"], // Simplified wilayah for Jakarta area
  tangerang: ["TNG"],
  bekasi: ["BKS"],
  depok: ["DPK"],
  bogor: ["BGR"],
};

const hargaPerKgTanjungPandan = {
  JKT: 20000,
  TNG: 23000,
  BKS: 23000,
  DPK: 27000,
  BGR: 23000,
};

const agentListTanjungPandan = [
  "COD", "TRANSFER", "CASH"
];

const metodePembayaranTanjungPandan = ["cash", "transfer", "cod"];
const kirimViaTanjungPandan = ["udara", "darat"];

function generateAwbNo() {
  const timestamp = Date.now().toString()
  const lastSixDigits = timestamp.slice(-6)
  return "BCE" + lastSixDigits
}



export default function BulkAwbForm({ onSuccess, onCancel, userRole, branchOrigin }: BulkAwbFormProps) {
  const { toast } = useToast();

  const [templateForm, setTemplateForm] = useState({
    nama_pengirim: "BCE Express",
    nomor_pengirim: "08",
    kirim_via: "udara",
    kota_tujuan: "",
    wilayah: "",
    agent_customer: "",
    awb_date: new Date().toISOString().slice(0, 10),
    isi_barang_umum: "Makanan",
  })

  const [awbEntries, setAwbEntries] = useState<AwbEntry[]>([])
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const printRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const allPrintsContainerRef = useRef<HTMLDivElement>(null);

  // Determine which data source to use based on userRole
  const currentKotaWilayah = userRole === 'cabang' ? kotaWilayahTanjungPandan : kotaWilayahPusat;
  const currentHargaPerKg = userRole === 'cabang' ? hargaPerKgTanjungPandan : hargaPerKg;
  const currentAgentList = userRole === 'cabang' ? agentListTanjungPandan : agentList;
  const currentMetodePembayaran = userRole === 'cabang' ? metodePembayaranTanjungPandan : metodePembayaran;
  const currentKirimVia = userRole === 'cabang' ? kirimViaTanjungPandan : kirimVia;
  const currentKotaTujuan = Object.keys(currentKotaWilayah);

  const wilayahOptions = useMemo(() => currentKotaWilayah[templateForm.kota_tujuan] || [], [templateForm.kota_tujuan, currentKotaWilayah]);

  // Effect to update harga_per_kg for new entries based on template's wilayah
  useEffect(() => {
    if (templateForm.wilayah && currentHargaPerKg[templateForm.wilayah]) {
      setAwbEntries(prevEntries => prevEntries.map(entry => ({
        ...entry,
        harga_per_kg: currentHargaPerKg[templateForm.wilayah],
        sub_total: entry.berat_kg * currentHargaPerKg[templateForm.wilayah],
        total: entry.berat_kg * currentHargaPerKg[templateForm.wilayah] + Number(entry.biaya_admin) + Number(entry.biaya_packaging) + Number(entry.biaya_transit)
      })));
    }
  }, [templateForm.wilayah, currentHargaPerKg]);

  const handleTemplateChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setTemplateForm((f) => ({ ...f, [name]: value }))
    setError("")
    setSuccess("")
  }

  const handleAwbEntryChange = (id: string, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setAwbEntries((prevEntries) =>
      prevEntries.map((entry) => {
        if (entry.id === id) {
          let updatedValue: string | number = value;
          if (type === 'number') {
            updatedValue = parseFloat(value) || 0;
          }
          const updatedEntry = { ...entry, [name]: updatedValue };

          // Recalculate sub_total and total if relevant fields change
          if (['berat_kg', 'harga_per_kg', 'biaya_admin', 'biaya_packaging', 'biaya_transit'].includes(name)) {
            const sub_total = updatedEntry.berat_kg * updatedEntry.harga_per_kg;
            const total = sub_total + Number(updatedEntry.biaya_admin) + Number(updatedEntry.biaya_packaging) + Number(updatedEntry.biaya_transit);
            return { ...updatedEntry, sub_total, total };
          }
          return updatedEntry;
        }
        return entry;
      })
    )
    setError("")
    setSuccess("")
  }

  const addAwbEntry = () => {
    const newId = Date.now().toString();
    const newAwbNo = generateAwbNo();
    setAwbEntries((prevEntries) => [
      ...prevEntries,
      {
        id: newId,
        awb_no: newAwbNo,
        nama_penerima: "",
        nomor_penerima: "",
        alamat_penerima: "",
        coli: 1,
        isi_barang: templateForm.isi_barang_umum,
        berat_kg: 1,
        harga_per_kg: currentHargaPerKg[templateForm.wilayah] || 0, // Set default from template
        sub_total: 0,
        biaya_admin: 0,
        biaya_packaging: 0,
        biaya_transit: 0,
        total: 0,
        metode_pembayaran: "",
      },
    ]);
  }

  const removeAwbEntry = (id: string) => {
    setAwbEntries((prevEntries) => prevEntries.filter((entry) => entry.id !== id))
  }

  const saveAwbEntries = async () => {
    setError("");
    setSuccess("");

    // Validate template form fields
    if (!templateForm.nama_pengirim || !templateForm.nomor_pengirim || !templateForm.kirim_via || !templateForm.kota_tujuan || !templateForm.wilayah || !templateForm.agent_customer) {
      setError("Mohon lengkapi semua field template pengirim wajib.");
      toast({
        title: "Validasi Gagal",
        description: "Mohon lengkapi semua field template pengirim wajib.",
        variant: "destructive",
      });
      return false;
    }

    if (awbEntries.length === 0) {
      setError("Mohon tambahkan setidaknya satu resi untuk disimpan.");
      toast({
        title: "Tidak ada resi untuk disimpan.",
        description: "Mohon tambahkan setidaknya satu resi.",
        variant: "destructive",
      });
      return false;
    }

    // Validate individual AWB entries
    for (const entry of awbEntries) {
      if (!entry.awb_no || !entry.nama_penerima || !entry.nomor_penerima || !entry.alamat_penerima || !entry.berat_kg || !entry.metode_pembayaran) {
        setError(`Mohon lengkapi semua field wajib untuk Resi ${entry.awb_no || "baru"}.`);
        toast({
          title: "Validasi Gagal",
          description: `Mohon lengkapi semua field wajib untuk Resi ${entry.awb_no || "baru"}.`,
          variant: "destructive",
        });
        return false;
      }
    }

    const targetTable = userRole === 'cabang' ? 'manifest_cabang' : 'manifest';

    try {
      const recordsToInsert = awbEntries.map(entry => ({
        ...entry,
        awb_date: templateForm.awb_date,
        kirim_via: templateForm.kirim_via,
        kota_tujuan: templateForm.kota_tujuan,
        wilayah: templateForm.wilayah,
        metode_pembayaran: entry.metode_pembayaran,
        agent_customer: templateForm.agent_customer,
        nama_pengirim: templateForm.nama_pengirim,
        nomor_pengirim: templateForm.nomor_pengirim,
        isi_barang: entry.isi_barang || templateForm.isi_barang_umum,
        origin_branch: userRole === 'cabang' ? branchOrigin : null,
      }));

      // Remove the temporary 'id' field before inserting to Supabase
      const finalRecordsToInsert = recordsToInsert.map(({ id, ...rest }) => rest);

      const { error: sbError } = await supabaseClient.from(targetTable).insert(finalRecordsToInsert);

      if (sbError) {
        setError("Gagal menyimpan data bulk: " + sbError.message);
        toast({
          title: "Gagal menyimpan data bulk.",
          description: sbError.message || "Terjadi kesalahan saat menyimpan data.",
          variant: "destructive",
        });
        return false;
      } else {
        setSuccess("Data bulk berhasil disimpan!");
        toast({
          title: "Sukses!",
          description: "Data bulk berhasil disimpan.",
          variant: "default",
        });
        return true;
      }
    } catch (err: any) {
      setError("Terjadi kesalahan: " + err.message);
      toast({
        title: "Terjadi kesalahan.",
        description: err.message || "Terjadi kesalahan yang tidak diketahui.",
        variant: "destructive",
      });
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const saved = await saveAwbEntries();
    if (saved) {
      setAwbEntries([]); // Clear entries after successful submission
      onSuccess(); // Callback to hide the form
    }
  }

  const handlePrintAll = async () => {
    const saved = await saveAwbEntries();
    if (!saved) return; // Stop if saving failed

    if (awbEntries.length === 0) {
      toast({
        title: "Tidak ada resi untuk dicetak.",
        description: "Mohon tambahkan setidaknya satu resi.",
        variant: "destructive",
      });
      return;
    }

    const contentToPrint = allPrintsContainerRef.current;

    if (contentToPrint) {
      try {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
          alert('Popup diblokir. Mohon izinkan popup di browser Anda.');
          return;
        }

        // Get CSS from PrintLayout component with page break styles
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
            page-break-after: always;
          }

          .print-only:last-child {
            page-break-after: avoid; /* Prevent extra blank page at the end */
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
              position: relative;
              width: 100mm;
              height: 100mm;
              margin: 0;
              padding: 0;
              background-color: #fff !important;
              page-break-after: always;
            }

            .print-only:last-child {
              page-break-after: avoid;
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

        // Wait a moment to ensure all PrintLayout components are rendered
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Get the rendered HTML content from the existing PrintLayout components
        const renderedContent = contentToPrint.innerHTML;

        // Create the complete HTML with preview controls
        const fullHtml = `
          <html>
            <head>
              <title>Preview AWB Bulk - ${awbEntries.length} Resi</title>
              <style>
                /* Print controls - modern and simple */
                .print-controls {
                  position: fixed;
                  top: 24px;
                  right: 24px;
                  z-index: 1000;
                  background: rgba(255, 255, 255, 0.95);
                  backdrop-filter: blur(10px);
                  padding: 20px;
                  border-radius: 16px;
                  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
                  border: 1px solid rgba(255, 255, 255, 0.2);
                  min-width: 280px;
                }
                
                .info-text {
                  margin-bottom: 16px;
                  font-size: 15px;
                  color: #1f2937;
                  font-weight: 500;
                  line-height: 1.4;
                }
                
                .button-group {
                  display: flex;
                  gap: 12px;
                }
                
                .print-btn {
                  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
                  color: white;
                  border: none;
                  padding: 8px 16px;
                  border-radius: 10px;
                  font-size: 13px;
                  font-weight: 600;
                  cursor: pointer;
                  flex: 1;
                  transition: all 0.2s ease;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 6px;
                }
                
                .print-btn:hover {
                  transform: translateY(-1px);
                  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.3);
                }
                
                .close-btn {
                  background: #f3f4f6;
                  color: #374151;
                  border: none;
                  padding: 8px 16px;
                  border-radius: 10px;
                  font-size: 13px;
                  font-weight: 600;
                  cursor: pointer;
                  flex: 1;
                  transition: all 0.2s ease;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 6px;
                }
                
                .close-btn:hover {
                  background: #e5e7eb;
                  transform: translateY(-1px);
                }
                
                /* Hide print controls when printing */
                @media print {
                  .print-controls {
                    display: none !important;
                  }
                }
                
                /* All the existing print styles */
                ${printLayoutCss}
              </style>
            </head>
            <body>
              <div class="print-controls">
                <div class="info-text">
                  Preview ${awbEntries.length} Resi AWB<br/>
                  Pastikan semua resi sesuai sebelum mencetak
                </div>
                <div class="button-group">
                  <button class="print-btn" onclick="window.print()">
                    <span>🖨️</span>
                    <span>CETAK SEMUA</span>
                  </button>
                  <button class="close-btn" onclick="window.close()">
                    <span>✕</span>
                    <span>TUTUP</span>
                  </button>
                </div>
              </div>
              ${renderedContent}
            </body>
          </html>
        `;

        printWindow.document.write(fullHtml);
        printWindow.document.close();
        printWindow.focus();

      } catch (error) {
        console.error("Error generating or printing:", error);
        toast({
          title: "Gagal mencetak.",
          description: "Terjadi kesalahan saat mencetak: " + error.message,
          variant: "destructive",
        });
      }

    } else {
      toast({
        title: `Gagal mencetak.`,
        description: "Konten cetak tidak ditemukan.",
        variant: "destructive",
      });
    }

    setAwbEntries([]); // Clear entries after successful submission and printing
    onSuccess(); // Callback to hide the form
  };

  const handleDownloadAllPdf = async (e: React.FormEvent) => {
    e.preventDefault();
    const saved = await saveAwbEntries();
    if (!saved) return; // Stop if saving failed

    setSuccess("Data bulk berhasil disimpan! Memulai unduhan PDF...");
    toast({
      title: "Data disimpan!",
      description: "Data bulk berhasil disimpan. Memulai unduhan PDF...",
      variant: "default",
    });

    const entriesToDownload = [...awbEntries]; // Capture current state

    // Tunggu sebentar untuk memastikan PrintLayout ter-render dengan data terbaru
    await new Promise(resolve => setTimeout(resolve, 600)); // Tunggu 600ms

    const html2pdf = await import('html2pdf.js');

    // Get the content of the entire container, not individual refs
    const contentToPrint = allPrintsContainerRef.current;

    if (contentToPrint) {
      // Add a temporary style to ensure page breaks are respected
      const pdfSpecificStyle = document.createElement('style');
      pdfSpecificStyle.innerHTML = `
        .awb-print-page {
          page-break-after: always;
        }
        .awb-print-page:last-child {
          page-break-after: avoid; /* Prevent extra blank page at the end */
        }
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
      contentToPrint.appendChild(pdfSpecificStyle);

      const options = {
        filename: 'Bulk_AWB_' + new Date().toISOString().slice(0, 10) + '.pdf', // Single filename for bulk
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
          format: [100, 100],
          orientation: 'portrait',
          compress: true
        }
      };

      try {
        await html2pdf.default()
          .set(options)
          .from(contentToPrint)
          .save();
      } finally {
        contentToPrint.removeChild(pdfSpecificStyle); // Clean up
      }

    } else {
      toast({
        title: `Gagal mengunduh PDF.`, // Generic error for bulk
        description: "Konten cetak tidak ditemukan.",
        variant: "destructive",
      });
    }

    setAwbEntries([]); // Clear entries after successful submission
    onSuccess(); // Callback to hide the form
  };

  return (
    <form onSubmit={handleSubmit} autoComplete="off" className="w-full max-w-none mx-auto px-4 py-6 bg-transparent">
      <h2 className="text-2xl font-extrabold text-blue-900 dark:text-blue-100 mb-4 tracking-tight">
        Input AWB BULK
      </h2>
      {error && <div className="mb-2 p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg font-semibold shadow border border-red-200 dark:border-red-800">{error}</div>}
      {success && (
        <div className="mb-2 p-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg font-semibold shadow border border-green-200 dark:border-green-800">{success}</div>
      )}

      {/* Section: Template Pengiriman Umum */}
      <section className="bg-white/70 dark:bg-gray-800/80 rounded-lg p-3 border border-blue-100 dark:border-gray-600 shadow mb-4">
        <h3 className="text-xl font-bold text-blue-800 dark:text-blue-200 mb-3">TEMPLATE PENGIRIMAN UNTUK BULK</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col">
            <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Nama Pengirim</label>
            <Input
              type="text"
              name="nama_pengirim"
              value={templateForm.nama_pengirim}
              onChange={handleTemplateChange}
              required
              className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Nomor Pengirim</label>
            <Input
              type="tel"
              name="nomor_pengirim"
              value={templateForm.nomor_pengirim}
              onChange={handleTemplateChange}
              required
              className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Kirim Via</label>
            <select
              name="kirim_via"
              value={templateForm.kirim_via}
              onChange={handleTemplateChange}
              required
              className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
            >
              <option value="">Pilih</option>
              {currentKirimVia.map((opt) => (
                <option key={opt} value={opt}>
                  {opt.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Kota Tujuan</label>
            <select
              name="kota_tujuan"
              value={templateForm.kota_tujuan}
              onChange={handleTemplateChange}
              required
              className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
            >
              <option value="">Pilih</option>
              {currentKotaTujuan.map((opt) => (
                <option key={opt} value={opt}>
                  {opt.replace(/\b\w/g, (l) => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Wilayah</label>
            <select
              name="wilayah"
              value={templateForm.wilayah}
              onChange={handleTemplateChange}
              required
              disabled={!templateForm.kota_tujuan}
              className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900 disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:text-gray-500 dark:disabled:text-gray-400"
            >
              <option value="">Pilih</option>
              {wilayahOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Agent</label>
            <select
              name="agent_customer"
              value={templateForm.agent_customer}
              onChange={handleTemplateChange}
              required
              className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
            >
              <option value="">Pilih</option>
              {currentAgentList.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Tanggal AWB</label>
            <Input
              type="date"
              name="awb_date"
              value={templateForm.awb_date}
              onChange={handleTemplateChange}
              required
              className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Isi Barang Umum (Default)</label>
            <Input
              type="text"
              name="isi_barang_umum"
              value={templateForm.isi_barang_umum}
              onChange={handleTemplateChange}
              placeholder="Contoh: Pakaian"
              className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
            />
          </div>
        </div>
      </section>

      {/* Section: Daftar Resi yang akan Dibuat */}
      <section className="bg-white/70 dark:bg-gray-800/80 rounded-lg p-3 border border-blue-100 dark:border-gray-600 shadow mb-4">
        <h3 className="text-xl font-bold text-blue-800 dark:text-blue-200 mb-3">DAFTAR RESI YANG AKAN DIBUAT</h3>

        {awbEntries.map((entry, index) => (
          <div key={entry.id} className="border border-blue-200 dark:border-gray-600 rounded-lg p-3 mb-3 relative">
            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Resi #{index + 1}</h4>
            <button
              type="button"
              onClick={() => removeAwbEntry(entry.id)}
              className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition"
              aria-label="Hapus Resi"
            >
              <FaTrash className="text-xs" />
            </button>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex flex-col">
                <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Nomor Resi (AWB)</label>
                <Input
                  type="text"
                  name="awb_no"
                  value={entry.awb_no}
                  readOnly
                  className="bg-gray-100 dark:bg-gray-600 rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 px-2 py-1 text-sm shadow-sm transition text-gray-700 dark:text-gray-300"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Nama Penerima</label>
                <Input
                  type="text"
                  name="nama_penerima"
                  value={entry.nama_penerima}
                  onChange={(e) => handleAwbEntryChange(entry.id, e)}
                  required
                  className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Nomor Penerima</label>
                <Input
                  type="tel"
                  name="nomor_penerima"
                  value={entry.nomor_penerima}
                  onChange={(e) => handleAwbEntryChange(entry.id, e)}
                  required
                  className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
                />
              </div>
              <div className="flex flex-col lg:col-span-3">
                <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Alamat Penerima</label>
                <textarea
                  name="alamat_penerima"
                  value={entry.alamat_penerima}
                  onChange={(e) => handleAwbEntryChange(entry.id, e)}
                  required
                  className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900 min-h-[60px]"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Coli</label>
                <Input
                  type="number"
                  name="coli"
                  value={entry.coli}
                  onChange={(e) => handleAwbEntryChange(entry.id, e)}
                  min={1}
                  required
                  className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Isi Barang</label>
                <Input
                  type="text"
                  name="isi_barang"
                  value={entry.isi_barang}
                  onChange={(e) => handleAwbEntryChange(entry.id, e)}
                  placeholder="Override default isi barang"
                  className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Berat (kg)</label>
                <Input
                  type="number"
                  name="berat_kg"
                  value={entry.berat_kg}
                  onChange={(e) => handleAwbEntryChange(entry.id, e)}
                  min={0.1}
                  step={0.1}
                  required
                  className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Harga/kg</label>
                <Input
                  type="number"
                  name="harga_per_kg"
                  value={entry.harga_per_kg}
                  onChange={(e) => handleAwbEntryChange(entry.id, e)}
                  className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Subtotal</label>
                <Input
                  type="number"
                  name="sub_total"
                  value={entry.sub_total}
                  readOnly
                  className="bg-gray-100 dark:bg-gray-600 rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 px-2 py-1 text-sm shadow-sm transition text-gray-700 dark:text-gray-300"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Biaya Admin</label>
                <Input
                  type="number"
                  name="biaya_admin"
                  value={entry.biaya_admin}
                  onChange={(e) => handleAwbEntryChange(entry.id, e)}
                  className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Biaya Packaging</label>
                <Input
                  type="number"
                  name="biaya_packaging"
                  value={entry.biaya_packaging}
                  onChange={(e) => handleAwbEntryChange(entry.id, e)}
                  className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Biaya Transit</label>
                <Input
                  type="number"
                  name="biaya_transit"
                  value={entry.biaya_transit}
                  onChange={(e) => handleAwbEntryChange(entry.id, e)}
                  className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Total</label>
                <Input
                  type="number"
                  name="total"
                  value={entry.total}
                  readOnly
                  className="bg-gray-100 dark:bg-gray-600 rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 px-2 py-1 text-base shadow-sm transition font-bold text-gray-700 dark:text-gray-200"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Metode Pembayaran</label>
                <select
                  name="metode_pembayaran"
                  value={entry.metode_pembayaran}
                  onChange={(e) => handleAwbEntryChange(entry.id, e)}
                  required
                  className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
                >
                  <option value="">Pilih</option>
                  {currentMetodePembayaran.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ))}

        <Button
          type="button"
          onClick={addAwbEntry}
          className="mt-4 flex items-center gap-2 bg-blue-500 dark:bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors"
        >
          <FaPlus /> Tambah Resi
        </Button>
      </section>

      {/* Hidden print frames */}
      <div className="hidden">
        <div ref={allPrintsContainerRef}>
          {awbEntries.map((entry, index) => (
            <div
              key={entry.id}
              ref={(el) => { printRefs.current[entry.id] = el; }}
              className="awb-print-page"
              style={index < awbEntries.length - 1 ? { pageBreakAfter: 'always' } : {}}
            >
              <PrintLayout data={{
                ...entry,
                awb_date: templateForm.awb_date,
                kirim_via: templateForm.kirim_via,
                kota_tujuan: templateForm.kota_tujuan,
                wilayah: templateForm.wilayah,
                agent_customer: templateForm.agent_customer,
                nama_pengirim: templateForm.nama_pengirim,
                nomor_pengirim: templateForm.nomor_pengirim,
              }} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-end gap-2 mt-4">
        {onCancel && (
          <Button type="button" onClick={onCancel} className="w-full sm:w-auto px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
            Batal
          </Button>
        )}
        <Button
          type="submit"
          className="w-full sm:w-auto px-6 py-2 bg-green-600 dark:bg-green-700 text-white font-bold rounded shadow-lg hover:bg-green-700 dark:hover:bg-green-800 transition text-base"
        >
          SIMPAN SEMUA RESI
        </Button>
        <Button
          type="button"
          onClick={handlePrintAll}
          className="w-full sm:w-auto px-6 py-2 bg-blue-600 dark:bg-blue-700 text-white font-bold rounded shadow-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition text-base"
        >
          SIMPAN DAN CETAK SEMUA
        </Button>
        <Button
          type="button"
          onClick={handleDownloadAllPdf}
          className="w-full sm:w-auto px-6 py-2 bg-red-600 dark:bg-red-700 text-white font-bold rounded shadow-lg hover:bg-red-700 dark:hover:bg-red-800 transition text-base"
        >
          SIMPAN DAN DOWNLOAD SEMUA PDF
        </Button>
      </div>
    </form>
  )
} 