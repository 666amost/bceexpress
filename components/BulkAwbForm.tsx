"use client"

import React, { useState, useMemo, useRef, useEffect } from "react"
import dynamic from 'next/dynamic'
import { supabaseClient } from "../lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { FaPlus, FaTrash } from "react-icons/fa"
import PrintLayout from "./PrintLayout"
import html2canvas from 'html2canvas'
import * as ReactDOM from 'react-dom/client'

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
  kota_tujuan: string;
  wilayah: string;
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
  "COD",
  "TRANSFER",
  "CASH",
  "Wijaya Crab"
];

const metodePembayaranTanjungPandan = ["cash", "transfer", "cod"];
const kirimViaTanjungPandan = ["udara", "darat"];

function generateAwbNo() {
  const timestamp = Date.now().toString()
  const lastSixDigits = timestamp.slice(-6)
  return "BCE" + lastSixDigits
}

// Fungsi untuk mendapatkan harga berdasarkan wilayah
function getPriceByArea(wilayah: string): number {
  // Harga default
  let price = 27000;

  // Harga untuk wilayah Jakarta
  if (wilayah.includes('JAKARTA')) {
    if (wilayah.includes('BARAT') || wilayah.includes('PUSAT')) {
      price = 27000;
    } else if (wilayah.includes('SELATAN') || wilayah.includes('TIMUR')) {
      price = 29000;
    } else if (wilayah.includes('UTARA')) {
      price = 30000;
    }
  }
  // Harga untuk wilayah Tangerang
  else if (wilayah.includes('TANGERANG')) {
    if (wilayah.includes('SELATAN')) {
      price = 30000;
    } else if (wilayah.includes('KABUPATEN')) {
      price = 35000;
    } else {
      price = 27000;
    }
  }
  // Harga untuk wilayah Bekasi
  else if (wilayah.includes('BEKASI')) {
    price = 32000;
  }
  // Harga untuk wilayah Depok
  else if (wilayah.includes('DEPOK')) {
    price = 35000;
  }
  // Harga untuk wilayah Bogor
  else if (wilayah.includes('BOGOR')) {
    price = 35000;
  }

  return price;
}

// Fungsi untuk mendapatkan biaya transit berdasarkan wilayah
function getTransitFee(wilayah: string): number {
  // Tangerang Kabupaten
  if (wilayah.includes('TELUKNAGA')) return 20000;
  if (wilayah.includes('BALARAJA')) return 50000;
  if (wilayah.includes('PAKUHAJI')) return 50000;
  if (wilayah.includes('RAJEG')) return 50000;
  if (wilayah.includes('SEPATAN TIMUR')) return 30000;
  if (wilayah.includes('SEPATAN')) return 30000;
  if (wilayah.includes('SINDANG JAYA')) return 20000;
  if (wilayah.includes('SOLEAR')) return 100000;
  if (wilayah.includes('TIGARAKSA')) return 75000;

  // Bekasi
  if (wilayah.includes('JATISAMPURNA')) return 30000;
  if (wilayah.includes('TARUMAJAYA')) return 30000;
  if (wilayah.includes('BABELAN')) return 30000;
  if (wilayah.includes('CIBARUSAH')) return 30000;
  if (wilayah.includes('CIBITUNG')) return 50000;
  if (wilayah.includes('CIKARANG BARAT')) return 75000;
  if (wilayah.includes('CIKARANG PUSAT')) return 75000;
  if (wilayah.includes('CIKARANG UTARA')) return 75000;
  if (wilayah.includes('CIKARANG SELATAN')) return 100000;
  if (wilayah.includes('CIKARANG TIMUR')) return 100000;
  if (wilayah.includes('KARANGBAHAGIA')) return 75000;
  if (wilayah.includes('KEDUNGWARINGIN')) return 100000;
  if (wilayah.includes('SERANG BARU')) return 100000;
  if (wilayah.includes('SETU') && wilayah.includes('BEKASI')) return 100000;
  if (wilayah.includes('TAMBUN SELATAN')) return 50000;
  if (wilayah.includes('TAMBUN UTARA')) return 50000;

  // Depok
  if (wilayah.includes('TAPOS')) return 30000;

  // Bogor
  if (wilayah.includes('BOGOR BARAT')) return 100000;
  if (wilayah.includes('BOGOR SELATAN')) return 100000;
  if (wilayah.includes('BOGOR TENGAH')) return 100000;
  if (wilayah.includes('BOGOR TIMUR')) return 100000;
  if (wilayah.includes('BOGOR UTARA')) return 100000;
  if (wilayah.includes('TANAH SEREAL')) return 100000;
  if (wilayah.includes('GUNUNG SINDUR')) return 100000;
  if (wilayah.includes('BABAKAN MADANG')) return 100000;
  if (wilayah.includes('BOJONG GEDE')) return 75000;
  if (wilayah.includes('CIBINONG')) return 50000;
  if (wilayah.includes('CILEUNGSI')) return 75000;
  if (wilayah.includes('GUNUNG PUTRI')) return 75000;

  // Kecamatan Bogor dengan transit 100.000
  const kecamatanBogor100k = [
    'CITEUREUP', 'JONGGOL', 'CIOMAS', 'CISEENG', 'TAJURHALANG',
    'CARINGIN', 'DRAMAGA', 'CARIU', 'KLAPANUNGGAL', 'RUMPIN'
  ];
  if (kecamatanBogor100k.some(kec => wilayah.includes(kec))) return 100000;

  // Kecamatan Bogor dengan transit 150.000
  if (wilayah.includes('CIAWI') || wilayah.includes('TAMANSARI')) return 150000;

  return 0; // Default jika tidak ada biaya transit
}

export default function BulkAwbForm({ onSuccess, onCancel, userRole, branchOrigin }: BulkAwbFormProps) {
  const { toast } = useToast();

  const [templateForm, setTemplateForm] = useState({
    nama_pengirim: "BCE Express",
    nomor_pengirim: "0",
    kirim_via: "udara",
    agent_customer: "",
    awb_date: new Date().toISOString().slice(0, 10),
    metode_pembayaran: "",
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

  const handleTemplateChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setTemplateForm((f) => ({ ...f, [name]: value }))
    setError("")
    setSuccess("")
  }

  const handleAwbEntryChange = (id: string, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    setAwbEntries(prev => prev.map(entry => {
      if (entry.id === id) {
        const updatedEntry = { ...entry, [name]: value };
        
        // Jika yang diubah adalah wilayah, update harga dan biaya transit
        if (name === 'wilayah') {
          const newPrice = getPriceByArea(value);
          const transitFee = getTransitFee(value);
          updatedEntry.harga_per_kg = newPrice;
          updatedEntry.biaya_transit = transitFee;
          updatedEntry.sub_total = newPrice * (updatedEntry.berat_kg || 0);
          updatedEntry.total = updatedEntry.sub_total + 
                             (updatedEntry.biaya_admin || 0) + 
                             (updatedEntry.biaya_packaging || 0) + 
                             transitFee;
        }
        
        return updatedEntry;
      }
      return entry;
    }));
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
        isi_barang: "",
        berat_kg: 1,
        harga_per_kg: 0,
        sub_total: 0,
        biaya_admin: 0,
        biaya_packaging: 0,
        biaya_transit: 0,
        total: 0,
        kota_tujuan: "",
        wilayah: "",
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
    if (!templateForm.nama_pengirim || !templateForm.nomor_pengirim || !templateForm.kirim_via || !templateForm.agent_customer || !templateForm.metode_pembayaran) {
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
      if (!entry.awb_no || !entry.nama_penerima || !entry.nomor_penerima || !entry.alamat_penerima || !entry.berat_kg || !entry.kota_tujuan || !entry.wilayah) {
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
        metode_pembayaran: templateForm.metode_pembayaran,
        agent_customer: templateForm.agent_customer,
        nama_pengirim: templateForm.nama_pengirim,
        nomor_pengirim: templateForm.nomor_pengirim,
        isi_barang: entry.isi_barang || "",
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
    // Check if running in browser
    if (typeof window === 'undefined') {
      toast({
        title: "Gagal mencetak.",
        description: "Pencetakan hanya tersedia di browser.",
        variant: "destructive",
      });
      return;
    }

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

        // Wait a moment to ensure all PrintLayout components are rendered
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Get the rendered HTML content from the existing PrintLayout components
        const renderedContent = contentToPrint.innerHTML;

        // Hardcoded CSS for print styles
        const printLayoutCss = `
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
            page-break-after: avoid;
          }

          .shipping-label {
            width: 100%;
            height: 100%;
            border: 1px solid #000;
            padding: 3mm 3mm 3mm 3mm;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }

          /* ... rest of the existing CSS ... */

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

            /* ... rest of the print media query styles ... */
          }
        `;

        // Create the complete HTML with preview controls
        const fullHtml = `
          <html>
            <head>
              <title>Preview AWB Bulk - ${awbEntries.length} Resi</title>
              <style>
                ${printLayoutCss}
                
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
    if (!saved) return;

    // Check if running in browser
    if (typeof window === 'undefined') {
      toast({
        title: "Gagal mengunduh PDF.",
        description: "Unduhan PDF hanya tersedia di browser.",
        variant: "destructive",
      });
      return;
    }

    setSuccess("Data bulk berhasil disimpan! Memulai unduhan PDF...");
    toast({
      title: "Data disimpan!",
      description: "Data bulk berhasil disimpan. Memulai unduhan PDF...",
      variant: "default",
    });

    if (awbEntries.length === 0) {
      toast({
        title: "Tidak ada resi untuk diunduh.",
        description: "Mohon tambahkan setidaknya satu resi.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Import jsPDF dan html2pdf
      const jspdfModule = await import('jspdf');
      const jsPDF = jspdfModule.default;
      const html2pdf = await import('html2pdf.js');
      
      // Buat PDF dengan margin yang minimal
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [100, 100],
        compress: true,
        hotfixes: ["px_scaling"],
        putOnlyUsedFonts: true,
        floatPrecision: 16
      });

      // Buat container sementara untuk AWB
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.width = '100mm';
      tempContainer.style.height = '100mm';
      tempContainer.style.padding = '0';
      tempContainer.style.margin = '0';
      tempContainer.style.overflow = 'hidden';
      tempContainer.style.backgroundColor = '#ffffff';
      tempContainer.style.border = 'none';
      tempContainer.style.boxSizing = 'border-box';
      tempContainer.style.display = 'block';
      tempContainer.style.fontFamily = 'Arial, sans-serif';
      document.body.appendChild(tempContainer);

      // Import JsBarcode
      const JsBarcode = (await import('jsbarcode')).default;
      
      // Import QRCode
      const QRCode = (await import('qrcode')).default;

      // Fungsi untuk membuat singkatan dari nama agent (sama seperti di PrintLayout.jsx)
      const generateAbbreviation = (agentName) => {
        if (!agentName) return "";
        const words = agentName.trim().split(/\s+/);
        
        if (words.length === 1 && words[0].length <= 4) {
          return words[0].toUpperCase();
        }
        
        const nameWithoutSpaces = agentName.replace(/\s+/g, '');
        if (nameWithoutSpaces.length <= 4) {
          return nameWithoutSpaces.toUpperCase();
        }
        
        let abbr = words.map(word => word[0].toUpperCase()).join('');
        
        if (abbr.length < 4) {
          const firstWord = words[0].toUpperCase();
          let index = 1;
          while (abbr.length < 4 && index < firstWord.length) {
            abbr += firstWord[index];
            index++;
          }
        }
        
        if (abbr.length < 4 && words.length > 1) {
          const secondWord = words[1].toUpperCase();
          let index = 1;
          while (abbr.length < 4 && index < secondWord.length) {
            abbr += secondWord[index];
            index++;
          }
        }
        
        return abbr.slice(0, 4);
      };

      // Untuk setiap AWB, buat HTML langsung dan convert ke PDF
      for (let i = 0; i < awbEntries.length; i++) {
        const entry = awbEntries[i];
        
        // Clear container
        tempContainer.innerHTML = '';
        
        // Buat canvas untuk barcode
        const barcodeCanvas = document.createElement('canvas');
        JsBarcode(barcodeCanvas, entry.awb_no, {
          format: "CODE128",
          width: 2,
          height: 50,
          displayValue: false,
          background: "#ffffff",
          lineColor: "#000000",
          margin: 0
        });
        
        // Buat QR code canvas
        const qrCanvas = document.createElement('canvas');
        await QRCode.toCanvas(qrCanvas, entry.awb_no, {
          width: 150,
          margin: 0,
          color: {
            dark: "#000000",
            light: "#ffffff"
          }
        });
        
        // Buat HTML untuk AWB
        tempContainer.innerHTML = `
          <div style="width:100mm; height:100mm; padding:0; margin:0; box-sizing:border-box; font-family:Arial, sans-serif; font-size:10px; border:none; overflow:hidden;">
            <div style="width:100%; height:100%; border:1px solid #000; padding:3mm; box-sizing:border-box; position:relative; background-color:#ffffff;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2mm;">
                <div style="font-weight:bold; font-size:16px;">
                  BCE EXPRESS
                </div>
                <div style="font-weight:bold; font-size:20px; text-align:right;">
                  ${entry.wilayah ? entry.wilayah.substring(0, 3).toUpperCase() : entry.kota_tujuan.substring(0, 3).toUpperCase()}
                </div>
              </div>

              <div style="display:flex; align-items:center; margin-top:-2mm; margin-bottom:1mm; gap:2mm;">
                <div style="border:2px solid #000; padding:2mm; display:flex; align-items:center; justify-content:center; min-width:20mm; height:20mm; background-color:#000; flex-shrink:0;">
                  <div style="font-size:20px; font-weight:bold; text-align:center; color:#fff;">
                    ${generateAbbreviation(templateForm.agent_customer)}
                  </div>
                </div>
                <div style="display:flex; flex-direction:column; align-items:center; border:2px solid #000; padding:1mm; flex:1;">
                  <img src="${barcodeCanvas.toDataURL()}" alt="Barcode" style="width:100%; height:15mm;" />
                  <div style="font-weight:bold; font-size:14px; margin-top:1mm;">${entry.awb_no}</div>
                </div>
              </div>

              <div style="display:flex; flex-direction:row; align-items:baseline; gap:8mm; margin-bottom:1mm; font-size:12px; padding-left:2mm;">
                <div>coli : ${entry.coli || 1}</div>
                <div>berat : ${entry.berat_kg || 1} kg</div>
                <div>biaya kirim: Rp ${entry.sub_total.toLocaleString('id-ID') || 0}</div>
                <div style="font-weight:bold;">total : Rp ${entry.total.toLocaleString('id-ID') || 0}</div>
                <div>${templateForm.awb_date}</div>
              </div>

              <div style="display:flex; flex:1; margin-bottom:0;">
                <div style="flex:1; border:1px solid #000; padding:1mm; margin-right:3mm; display:flex; flex-direction:column; justify-content:flex-start; font-size:11px; font-weight:bold; height:40mm; overflow-y:auto;">
                  <div style="margin-bottom:2mm;">
                    <div style="border-bottom:1px dotted #999; padding-bottom:0.6mm; margin-bottom:0; line-height:1.4;">Pengirim: ${templateForm.nama_pengirim}</div>
                    <div style="border-bottom:1px dotted #999; padding-bottom:0.6mm; margin-bottom:0; line-height:1.4;">No. Pengirim: ${templateForm.nomor_pengirim}</div>
                    <div style="border-bottom:1px dotted #999; padding-bottom:0.6mm; margin-bottom:0; line-height:1.4;">Isi Barang: ${entry.isi_barang || '-'}</div>
                  </div>
                  <div>
                    <div style="border-bottom:1px dotted #999; padding-bottom:0.6mm; margin-bottom:0; line-height:1.4;">Penerima: ${entry.nama_penerima}</div>
                    <div style="border-bottom:1px dotted #999; padding-bottom:0.6mm; margin-bottom:0; line-height:1.4;">No. Penerima: ${entry.nomor_penerima}</div>
                    <div>Alamat: ${entry.alamat_penerima}</div>
                  </div>
                </div>
                <div style="width:30mm; height:45mm; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; padding-top:1mm; min-height:35mm;">
                  <img src="${qrCanvas.toDataURL()}" style="width:30mm; height:30mm; display:block; box-sizing:border-box;" alt="QR Code" />
                  <div style="font-size:15px; font-weight:bold; width:100%; text-align:center; margin-top:1mm;">
                    ${templateForm.metode_pembayaran.toUpperCase()}
                  </div>
                </div>
              </div>

              <div style="width:100%; margin-top:auto;">
                <div style="border-top:1px dotted #000; margin-bottom:2mm;"></div>
                <div style="display:flex; justify-content:space-between; align-items:flex-end; font-size:8px; font-style:italic;">
                  <div style="flex:1; text-align:left; line-height:1.3;">
                    *Syarat dan ketentuan pengiriman<br />
                    sesuai dengan kebijakan BCE Express
                  </div>
                  <div style="text-align:right; white-space:nowrap; display:flex; align-items:center; justify-content:flex-end; color:black;">
                    <span style="font-size:10px; margin-right:2px;">☎</span>
                    0812-9056-8532
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
        
        // Berikan waktu untuk render
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Convert ke canvas
        const html2canvasModule = await import('html2canvas');
        const html2canvas = html2canvasModule.default;
        const canvas = await html2canvas(tempContainer, {
          scale: 4, // Tingkatkan kualitas rendering
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          windowWidth: tempContainer.scrollWidth,
          windowHeight: tempContainer.scrollHeight,
          x: 0,
          y: 0,
          width: tempContainer.offsetWidth,
          height: tempContainer.offsetHeight,
          imageTimeout: 0,
          onclone: (clonedDoc) => {
            const clonedElement = clonedDoc.querySelector('div');
            if (clonedElement) {
              clonedElement.style.transform = 'scale(1)';
              clonedElement.style.transformOrigin = 'top left';
            }
          }
        });
        
        // Tambahkan gambar ke PDF - gunakan compression NONE
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        pdf.addImage(imgData, 'JPEG', 0, 0, 100, 100, undefined, 'NONE', 0);
        
        // Tambahkan halaman baru jika bukan entry terakhir
        if (i < awbEntries.length - 1) {
          pdf.addPage([100, 100], 'portrait');
          // Reset margin halaman ke 0
          pdf.setPage(i + 2); // Pindah ke halaman yang baru dibuat
          pdf.internal.pageSize.width = 100;
          pdf.internal.pageSize.height = 100;
          pdf.internal.pageSize.getWidth = function() { return 100; };
          pdf.internal.pageSize.getHeight = function() { return 100; };
        }
      }
      
      // Hapus container sementara
      document.body.removeChild(tempContainer);
      
      // Optimalkan PDF sebelum disimpan
      try {
        // Set compress options
        pdf.setProperties({
          title: 'BCE Express Bulk AWB',
          subject: 'Shipping Labels',
          creator: 'BCE Express System',
          keywords: 'awb,shipping,label',
          author: 'BCE Express'
        });
        
        // Simpan PDF dengan metadata
        pdf.save('Bulk_AWB_' + new Date().toISOString().slice(0, 10) + '.pdf');
      } catch (error) {
        // Fallback save
        pdf.save('Bulk_AWB_' + new Date().toISOString().slice(0, 10) + '.pdf');
      }

      toast({
        title: "PDF Dibuat!",
        description: `PDF dengan ${awbEntries.length} AWB telah dibuat.`,
        variant: "default",
      });

      setAwbEntries([]);
      onSuccess();

    } catch (error) {
      toast({
        title: "Gagal mengunduh PDF.",
        description: "Terjadi kesalahan saat mengunduh PDF: " + error.message,
        variant: "destructive",
      });
    }
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
              inputMode="numeric"
              pattern="[0-9]*"
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
            <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Metode Pembayaran</label>
            <select
              name="metode_pembayaran"
              value={templateForm.metode_pembayaran}
              onChange={handleTemplateChange}
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
                <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Kota Tujuan</label>
                <select
                  name="kota_tujuan"
                  value={entry.kota_tujuan}
                  onChange={(e) => handleAwbEntryChange(entry.id, e)}
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
                  value={entry.wilayah}
                  onChange={(e) => handleAwbEntryChange(entry.id, e)}
                  required
                  disabled={!entry.kota_tujuan}
                  className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900 disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:text-gray-500 dark:disabled:text-gray-400"
                >
                  <option value="">Pilih</option>
                  {currentKotaWilayah[entry.kota_tujuan] && currentKotaWilayah[entry.kota_tujuan].map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
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
                  inputMode="numeric"
                  pattern="[0-9]*"
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
                  inputMode="numeric"
                  pattern="[0-9]*"
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
                  placeholder="isi barang"
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
                  inputMode="numeric"
                  pattern="[0-9]*"
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
                  inputMode="numeric"
                  pattern="[0-9]*"
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
                  inputMode="numeric"
                  pattern="[0-9]*"
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
                  inputMode="numeric"
                  pattern="[0-9]*"
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
                  inputMode="numeric"
                  pattern="[0-9]*"
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
                  inputMode="numeric"
                  pattern="[0-9]*"
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
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="bg-gray-100 dark:bg-gray-600 rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 px-2 py-1 text-base shadow-sm transition font-bold text-gray-700 dark:text-gray-200"
                />
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
              data-id={entry.id}
              style={index < awbEntries.length - 1 ? { pageBreakAfter: 'always' } : {}}
            >
              <PrintLayout data={{
                ...entry,
                awb_date: templateForm.awb_date,
                kirim_via: templateForm.kirim_via,
                kota_tujuan: entry.kota_tujuan,
                wilayah: entry.wilayah,
                agent_customer: templateForm.agent_customer,
                nama_pengirim: templateForm.nama_pengirim,
                nomor_pengirim: templateForm.nomor_pengirim,
                usePlainText: true, // Pass flag to use text instead of logo
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