"use client"

import React, { useState, useMemo, useRef } from "react"
import { supabaseClient } from "../lib/auth"
import PrintLayout from "./PrintLayout"

interface BangkaAwbFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  initialData: any | null;
  isEditing: boolean;
  userRole: string | null;
  branchOrigin: string | null;
}

// Data untuk wilayah Jabodetabek
const kotaWilayahJabodetabek = {
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
}

const agentListJabodetabek = [
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

// Daftar kecamatan khusus Jakarta Utara
const kecamatanJakutKhusus = [
  'Kebon Bawang', 'Papanggo', 'Sungai Bambu', 'Tj Priok', 'Warakas',
  'Sunter Jaya', 'Sunter Agung'
];

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
      // Kecamatan khusus di Tangerang dengan harga 30000
      if (wilayah.includes('NEGLASARI') || 
          wilayah.includes('BENDA') || 
          wilayah.includes('JATIUWUNG') || 
          wilayah.includes('CIBODAS')) {
        price = 30000;
      } else {
        price = 27000;
      }
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

export default function BangkaAwbForm({ onSuccess, onCancel, initialData, isEditing, userRole, branchOrigin }: BangkaAwbFormProps) {
  const [form, setForm] = useState(
    initialData || {
      awb_no: "",
      awb_date: new Date().toISOString().slice(0, 10),
      kirim_via: "",
      kota_tujuan: "",
      kecamatan: "",
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
  const [showPrintPreview, setShowPrintPreview] = useState(false)
  const printFrameRef = useRef<HTMLDivElement>(null)

  const kecamatanOptions = useMemo(() => {
    if (form.kota_tujuan === 'JAKARTA UTARA') {
      return [
        ...kotaWilayahJabodetabek['JAKARTA UTARA'].kecamatan,
        ...kecamatanJakutKhusus.filter(k => !kotaWilayahJabodetabek['JAKARTA UTARA'].kecamatan.includes(k))
      ];
    }
    return form.kota_tujuan ? kotaWilayahJabodetabek[form.kota_tujuan]?.kecamatan || [] : [];
  }, [form.kota_tujuan]);

  React.useEffect(() => {
    if (form.kota_tujuan && kotaWilayahJabodetabek[form.kota_tujuan]) {
      setForm((f) => ({ ...f, harga_per_kg: kotaWilayahJabodetabek[form.kota_tujuan].harga }))
    }
  }, [form.kota_tujuan])

  React.useEffect(() => {
    const sub_total = form.berat_kg * form.harga_per_kg
    const total = sub_total + Number(form.biaya_admin) + Number(form.biaya_packaging) + Number(form.biaya_transit)
    setForm((f) => ({ ...f, sub_total, total }))
  }, [form.berat_kg, form.harga_per_kg, form.biaya_admin, form.biaya_packaging, form.biaya_transit])

  const handleChange = (e) => {
    const { name, value } = e.target;
    let kotaTujuan = name === 'kota_tujuan' ? value : form.kota_tujuan;
    let kecamatan = name === 'kecamatan' ? value : form.kecamatan;

    // Jika field yang diubah adalah kota_tujuan atau kecamatan
    if (name === 'kota_tujuan' || name === 'kecamatan') {
      let harga = form.harga_per_kg;
      let transit = form.biaya_transit;
      
      // Logika harga khusus Jakarta Utara
      if (kotaTujuan === 'JAKARTA UTARA') {
        if ([
          'Kebon Bawang', 'Papanggo', 'Sungai Bambu', 'Tj Priok', 'Warakas'
        ].includes(kecamatan)) {
          harga = 30000;
        } else if ([
          'Sunter Jaya', 'Sunter Agung'
        ].includes(kecamatan)) {
          harga = 27000;
        } else {
          harga = 27000;
        }
      } 
      // Logika harga khusus Tangerang
      else if (kotaTujuan === 'TANGERANG') {
        if (['Neglasari', 'Benda', 'Jatiuwung', 'Cibodas'].includes(kecamatan)) {
          harga = 30000;
        } else {
          harga = 27000;
        }
      }
      // Logika harga khusus Tangerang Selatan
      else if (kotaTujuan === 'TANGERANG SELATAN') {
        if (kecamatan === 'Serpong Utara') {
          harga = 27000;
        } else {
          harga = 30000;
        }
      }
      // Logika harga khusus Tangerang Kabupaten
      else if (kotaTujuan === 'TANGERANG KABUPATEN') {
        if (['Kelapa Dua', 'Curug', 'Kosambi', 'Pagedangan'].includes(kecamatan)) {
          harga = 30000;
        } else {
          harga = 35000;
        }
      }
      else {
        harga = getPriceByArea(kotaTujuan);
      }
      
      transit = getTransitFee(`${kotaTujuan} ${kecamatan}`.toUpperCase());
      setForm(prev => ({
        ...prev,
        [name]: value,
        harga_per_kg: harga,
        biaya_transit: transit,
        sub_total: harga * (prev.berat_kg || 0),
        total: (harga * (prev.berat_kg || 0)) + (prev.biaya_admin || 0) + (prev.biaya_packaging || 0) + transit
      }));
    } else {
      setForm(prev => ({
        ...prev,
        [name]: value
      }));
    }
    setError("");
    setSuccess("");
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
    if (!form.awb_no || !form.kota_tujuan || !form.kecamatan || !form.nama_pengirim || !form.nama_penerima) {
      setError("Mohon lengkapi semua field wajib.")
      return
    }

    try {
      if (isEditing && initialData?.awb_no) {
        const { error: sbError } = await supabaseClient
          .from('manifest_cabang')
          .update({ ...form, origin_branch: branchOrigin })
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
                kecamatan: "",
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
        const { error: sbError } = await supabaseClient
          .from('manifest_cabang')
          .insert([{ ...form, origin_branch: branchOrigin }])

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
                kecamatan: "",
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
    if (!form.awb_no || !form.kota_tujuan || !form.kecamatan || !form.nama_pengirim || !form.nama_penerima) {
      setError("Mohon lengkapi semua field wajib.");
      return;
    }

    try {
      const { error: sbError } = await supabaseClient
        .from('manifest_cabang')
        .insert([{ ...form, origin_branch: branchOrigin }]);

      if (sbError) {
        setError("Gagal menyimpan data: " + sbError.message);
        return;
      } else {
        setSuccess("Data berhasil disimpan!");
        
        setTimeout(async () => {
          if (printFrameRef.current) {
            try {
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
                .shipping-details {
                  margin-top: -2mm !important;
                }
                .agent-code-box .agent-abbr-left {
                  position: relative !important;
                  top: -3mm !important;
                }
              `;
              printFrameRef.current.appendChild(pdfSpecificStyle);

              const html2pdf = await import('html2pdf.js');
              
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
                  width: 378,
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
              
              await html2pdf.default()
                .set(options)
                .from(printFrameRef.current)
                .save();

              printFrameRef.current.removeChild(pdfSpecificStyle);
                
              setForm({
                awb_no: "",
                awb_date: new Date().toISOString().slice(0, 10),
                kirim_via: "",
                kota_tujuan: "",
                kecamatan: "",
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
        }, 600);
      }
    } catch (err) {
      setError("Terjadi kesalahan: " + err.message);
    }
  }

  const handlePrint = (onAfterPrint) => {
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
          alert('Terjadi kesalahan saat mencetak: ' + error.message + '. Silakan coba lagi atau periksa pengaturan browser.');
        }
      }
    }, 100);
  };

  return (
    <>
      <div className="hidden">
        <div ref={printFrameRef}>
          <PrintLayout data={form} />
        </div>
      </div>

      <form onSubmit={handleSubmit} autoComplete="off" className="w-full max-w-none mx-0 px-0 py-6 bg-transparent">
        <h2 className="text-2xl font-extrabold text-blue-900 dark:text-blue-100 mb-4 tracking-tight">
          {isEditing ? "Edit AWB Manifest Bangka" : "Input AWB Manifest Bangka"}
        </h2>
        {error && <div className="mb-2 p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg font-semibold shadow border border-red-200 dark:border-red-800">{error}</div>}
        {success && (
          <div className="mb-2 p-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg font-semibold shadow border border-green-200 dark:border-green-800">{success}</div>
        )}
        <section className="bg-white/70 dark:bg-gray-800/80 rounded-lg p-3 border border-blue-100 dark:border-gray-600 shadow flex flex-col md:flex-row gap-6 items-end mb-2">
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
              {kirimVia.map((opt) => (
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
              {Object.keys(kotaWilayahJabodetabek).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col w-36 md:ml-4">
            <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Kecamatan</label>
            <select
              name="kecamatan"
              value={form.kecamatan}
              onChange={handleChange}
              required
              disabled={!form.kota_tujuan}
              className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900 disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:text-gray-500 dark:disabled:text-gray-400"
            >
              <option value="">Pilih</option>
              {kecamatanOptions.map((opt) => (
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
              {agentListJabodetabek.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </section>
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
    </>
  )
} 