"use client"

import { useState, useEffect, useMemo } from "react"
import { supabaseClient } from "../lib/auth"
import { createStyledExcelWithHTML } from "../lib/excel-utils"

export default function DailyReport({ userRole, branchOrigin }) {
  // ================== BRANCH / ROLE SWITCH ==================
  const BRANCH_USING_CABANG_TABLE = ["bangka", "tanjung_pandan"]; // tambah branch lain bila perlu
  const isBranchMode =
    userRole === "cabang" ||
    (userRole === "admin" && BRANCH_USING_CABANG_TABLE.includes(branchOrigin));
  // ===========================================================

  const [data, setData] = useState([])  // State untuk menyimpan data laporan
  const [selectedDateFrom, setSelectedDateFrom] = useState("") // State baru untuk filter tanggal Dari
  const [selectedDateTo, setSelectedDateTo] = useState("") // State baru untuk filter tanggal Sampai
  const [selectedKirimVia, setSelectedKirimVia] = useState("")  // State untuk filter kirim via
  const [selectedAgentCustomer, setSelectedAgentCustomer] = useState("")  // State untuk filter Agent/Customer
  const [selectedKotaTujuan, setSelectedKotaTujuan] = useState("")  // State baru untuk filter kota tujuan
  const [selectedWilayah, setSelectedWilayah] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // ================== LISTS ==================
  const agentList = isBranchMode
    ? (branchOrigin === 'bangka'
        ? [
            "555 in2 PKP",
            "BELINYU AGEN",
            "KOLIM SLT",
            "SUNGAILIAT AGEN",
            "TOBOALI (ABING)",
            "KOBA (ABING)",
            "JEBUS (MARETTA)",
            "JEBUS (ROBI SAFARI)",
            "MENTOK (LILY)",
            "ACHUANG KOBA",
            "BCE TONI WEN",
            "7FUN SLT",
            "ASIONG SAUCU",
            "AFUK BOM2 SAUCU",
            "TONI SAUCU",
            "AFO SAUCU",
            "KEN KEN SAUCU",
            "ADI BOB SAUCU",
            "AFEN SAUCU",
            "AHEN SAUCU",
            "AKIUNG SAUCU",
            "ALIM SAUCU",
            "ALIONG SAUCU",
            "APHING SAUCU",
            "ATER SAUCU",
            "BULL BULL SAUCU",
            "CHANDRA SAUCU",
            "DANIEL SAUCU",
            "DEDI PEN SAUCU",
            "EDO SAUCU",
            "HENDRA ABOY SAUCU",
            "NYUNNYUN SAUCU",
            "RIO SAUCU",
            "YOPY SAUCU",
            "ACN SNACK",
            "ACS SNACK",
            "ADOK RUMAH MAKAN",
            "JI FUN MESU",
            "BE YOU",
            "BEST DURIAN",
            "BOM BOM BUAH",
            "TOKO AGUNG",
            "AINY OTAK OTAK",
            "APO SPX SLT",
            "AFUI SPX P3",
            "ASUN OTAK OTAK",
            "BANGKA CITRA SNACK",
            "BANGKA BULIONG SNACK",
            "BILLY JNE",
            "TOKO BINTANG 5",
            "CENTRAL FOOD",
            "CENTRAL NURSERY BANGKA",
            "CHIKA",
            "GLORIA MOTOR",
            "HELDA ASIAT",
            "HANS KOKO DURIAN",
            "KIM NYUN AGEN",
            "AFAT SUBUR",
            "MR ADOX",
            "PEMPEK KOKO LINGGAU",
            "PEMPEK SUMBER RASA",
            "PEMPEK WONG KITO",
            "RAJAWALI (AKHIONG)",
            "THEW FU CAU AWEN",
            "THEW FU CAU PAULUS",
            "COD UDARA",
            "COD LAUT"
          ]
        : ["COD", "TRANSFER", "CASH", "Wijaya Crab"])
    : [
      "GLC COD UDR",
      "GLC COD DRT",
      "OTTY OFFICIAL",
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
    ];

  const kotaTujuan = isBranchMode
    ? (branchOrigin === 'bangka'
        ? ["JAKARTA BARAT", "JAKARTA PUSAT", "JAKARTA SELATAN", "JAKARTA TIMUR", "JAKARTA UTARA", "TANGERANG", "TANGERANG SELATAN", "TANGERANG KABUPATEN", "BEKASI KOTA", "BEKASI KABUPATEN", "DEPOK", "BOGOR KOTA", "BOGOR KABUPATEN"]
        : ["jakarta", "tangerang", "bekasi", "depok", "bogor"])
    : ["bangka", "kalimantan barat", "belitung", "bali"];

  const kotaWilayah = isBranchMode
    ? (branchOrigin === 'bangka'
        ? {
            "JAKARTA BARAT": ["Cengkareng", "Grogol", "Kebon jeruk", "Kali deres", "Pal merah", "Kembangan", "Taman sari", "Tambora"],
            "JAKARTA PUSAT": ["Cempaka putih", "Gambir", "Johar baru", "Kemayoran", "Menteng", "Sawah besar", "Senen", "Tanah abang"],
            "JAKARTA SELATAN": ["Cilandak", "Jagakarsa", "Kebayoran baru", "Kebayoran lama", "Mampang prapatan", "Pasar minggu", "Pesanggrahan", "Pancoran", "Setiabudi", "Tebet"],
            "JAKARTA TIMUR": ["Cakung", "Cipayung", "Ciracas", "Duren sawit", "Jatinegara", "Kramat jati", "Makasar", "Matraman", "Pasar rebo", "Pulo gadung"],
            "JAKARTA UTARA": ["Penjaringan", "Cilincing", "Kelapa gading", "Koja", "Pademangan", "Tanjung priok", "Kebon Bawang", "Papanggo", "Sungai Bambu", "Tj Priok", "Warakas", "Sunter Jaya", "Sunter Agung"],
            "TANGERANG": ["Batuceper", "Benda", "Cibodas", "Ciledug", "Cipondoh", "Jatiuwung", "Karangtengah", "Karawaci", "Larangan", "Neglasari", "Periuk", "Pinang", "Tangerang"],
            "TANGERANG SELATAN": ["Ciputat", "Ciputat Timur", "Pamulang", "Pondok Aren", "Serpong", "Serpong Utara"],
            "TANGERANG KABUPATEN": ["Kelapa Dua", "Curug", "Kosambi", "Legok", "Pagedangan", "Pasar Kemis", "Teluknaga", "Balaraja", "Cikupa", "Cisauk", "Pakuhaji", "Panongan", "Rajeg", "Sepatan", "Sepatan Timur", "Sindang Jaya", "Solear", "Tigaraksa"],
            "BEKASI KOTA": ["Bantargebang", "Bekasi Barat", "Bekasi Selatan", "Bekasi Timur", "Bekasi Utara", "Jatiasih", "Jatisampurna", "Medan Satria", "Mustikajaya", "pondokgede", "pondokmelati", "Rawalumbu"],
            "BEKASI KABUPATEN": ["Tarumajaya", "Babelan", "Cibarusah", "Cibitung", "Cikarang Barat", "Cikarang Pusat", "Cikarang Selatan", "Cikarang Timur", "Cikarang Utara", "Karangbahagia", "Kedungwaringin", "Serang Baru", "Setu", "Tambun Selatan", "Tambun Utara"],
            "DEPOK": ["Beji", "Bojongsari", "Cilodong", "Cimanggis", "Cinere", "Cipayung", "Limo", "Pancoran Mas", "Sawangan", "Sukmajaya", "Tapos"],
            "BOGOR KOTA": ["Bogor Barat", "Bogor Selatan", "Bogor Tengah", "Bogor Timur", "Bogor Utara", "Tanah Sereal"],
            "BOGOR KABUPATEN": ["Babakan Madang", "Bojonggede", "Cibinong", "Cileungsi", "Gunung Putri", "Gunung Sindur", "Citeureup", "Jonggol", "Ciomas", "Ciseeng", "Tajurhalang", "Caringin", "Dramaga", "Cariu", "Klapanunggal", "Rumpin", "Ciawi", "Tamansari"]
          }
        : {
            jakarta: ["JKT"],
            tangerang: ["TGT"],
            bekasi: ["BKS"],
            depok: ["DPK"],
            bogor: ["BGR"]
          })
    : {
        bangka: ["Pangkal Pinang", "Sungailiat", "Belinyu", "Jebus", "Koba", "Toboali", "Mentok"],
        "kalimantan barat": ["Pontianak", "Singkawang", "Sungai Pinyuh"],
        belitung: ["Tj Pandan"],
        bali: ["Denpasar"]
      };

  const wilayahOptions = useMemo(() => kotaWilayah[selectedKotaTujuan] || [], [selectedKotaTujuan, kotaWilayah]);

  // Fetch data berdasarkan filter yang dipilih, termasuk kota tujuan dan rentang tanggal
  useEffect(() => {
    if (selectedDateFrom || selectedDateTo || selectedKirimVia || selectedAgentCustomer || selectedKotaTujuan || selectedWilayah) {
      fetchDailyReport()
    }
  }, [selectedDateFrom, selectedDateTo, selectedKirimVia, selectedAgentCustomer, selectedKotaTujuan, selectedWilayah])

  async function fetchDailyReport() {
    setLoading(true)
    setError("")
    try {
      let query;
      if (isBranchMode) {
        query = supabaseClient
          .from("manifest_cabang")
          .select("*")
          .eq('origin_branch', branchOrigin)
          .order("awb_date", { ascending: false })
      } else {
        query = supabaseClient
          .from("manifest")
          .select("*")
          .order("awb_date", { ascending: false })
      }

      // Apply date range filter
      if (selectedDateFrom && selectedDateTo) {
        query = query.gte("awb_date", selectedDateFrom).lte("awb_date", selectedDateTo)
      } else if (selectedDateFrom) {
        query = query.gte("awb_date", selectedDateFrom)
      } else if (selectedDateTo) {
        query = query.lte("awb_date", selectedDateTo)
      }

      if (selectedKirimVia) query = query.eq("kirim_via", selectedKirimVia)
      if (selectedAgentCustomer) query = query.eq("agent_customer", selectedAgentCustomer)
      if (selectedKotaTujuan) query = query.eq("kota_tujuan", selectedKotaTujuan)
      if (selectedWilayah) query = query.eq("wilayah", selectedWilayah)

      const { data: fetchedData, error: fetchError } = await query

      if (fetchError) {
        setError(`Error fetching data: ${fetchError.message}`)
      } else {
        setData(fetchedData || [])
      }
    } catch (err) {
      setError(`Unexpected error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Enhanced downloadXLSX with HTML approach first, then reliable XLSX fallback
  const downloadXLSX = () => {
    if (data.length === 0) {
      alert("No data to download")
      return
    }

    const headers = [
      'AWB (No Resi)',
      'Pengirim', 
      'Penerima',
      'Coli',
      'Kg',
      'Harga (Ongkir)',
      'Admin',
      'Packaging',
      'Cash',
      'Transfer', 
      'COD',
      'Wilayah'
    ]

    const formattedData = data.map(item => ({
      'AWB (No Resi)': item.awb_no,
      'Pengirim': item.nama_pengirim,
      'Penerima': item.nama_penerima,
      'Coli': item.coli,
      'Kg': item.berat_kg,
      'Harga (Ongkir)': item.harga_per_kg || item.ongkir || 0,
      'Admin': item.biaya_admin || item.admin || 0,
      'Packaging': item.biaya_packaging || 0,
      'Cash': item.metode_pembayaran === 'cash' ? item.total : 0,
      'Transfer': item.metode_pembayaran === 'transfer' ? item.total : 0,
      'COD': item.metode_pembayaran === 'cod' ? item.total : 0,
      'Wilayah': item.wilayah
    }))

    const today = new Date().toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    let dateRange = ''
    if (selectedDateFrom || selectedDateTo) {
      if (selectedDateFrom && selectedDateTo) {
        const fromFormatted = selectedDateFrom.split('-').reverse().join('-')
        const toFormatted = selectedDateTo.split('-').reverse().join('-')
        dateRange = `${fromFormatted} s/d ${toFormatted}`
      } else if (selectedDateFrom) {
        const fromFormatted = selectedDateFrom.split('-').reverse().join('-')
        dateRange = `Dari ${fromFormatted}`
      } else if (selectedDateTo) {
        const toFormatted = selectedDateTo.split('-').reverse().join('-')
        dateRange = `Sampai ${toFormatted}`
      }
    }

    createStyledExcelWithHTML({
      title: 'Daily Report',
      headers,
      data: formattedData,
      fileName: `daily_report_${today.replace(/\s+/g, '_')}.xls`,
      currency: 'Rp',
      currencyColumns: [5, 6, 7, 8, 9, 10],
      numberColumns: [3, 4],
      dateRange
    })
  }

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Popup diblokir. Mohon izinkan popup di browser Anda.')
      return
    }

    const totalKg = data.reduce((sum, item) => sum + (item.berat_kg || 0), 0)
    const totalAdmin = data.reduce((sum, item) => sum + (item.biaya_admin || item.admin || 0), 0)
    const totalCash = data.filter(item => item.metode_pembayaran === 'cash').reduce((sum, item) => sum + (item.total || 0), 0)
    const totalTransfer = data.filter(item => item.metode_pembayaran === 'transfer').reduce((sum, item) => sum + (item.total || 0), 0)
    const totalCOD = data.filter(item => item.metode_pembayaran === 'cod').reduce((sum, item) => sum + (item.total || 0), 0)
    const grandTotal = data.reduce((sum, item) => sum + (item.total || 0), 0)

    let dateRangeText = ''
    if (selectedDateFrom && selectedDateTo) {
      const fromFormatted = selectedDateFrom.split('-').reverse().join('-')
      const toFormatted = selectedDateTo.split('-').reverse().join('-')
      dateRangeText = `${fromFormatted} s/d ${toFormatted}`
    } else if (selectedDateFrom) {
      const fromFormatted = selectedDateFrom.split('-').reverse().join('-')
      dateRangeText = `Dari ${fromFormatted}`
    } else if (selectedDateTo) {
      const toFormatted = selectedDateTo.split('-').reverse().join('-')
      dateRangeText = `Sampai ${toFormatted}`
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Daily Report</title>
          <style>
            @page { margin: 20mm; size: A4; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; font-size: 10px; line-height: 1.5; color: #1f2937; background: #ffffff; font-weight: 400; }
            .document-header { border-bottom: 2px solid #e5e7eb; padding-bottom: 24px; margin-bottom: 32px; }
            .header-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
            .company-info { display: block; }
            .company-name { display: block; font-size: 28px; font-weight: 700; color: #1e40af; letter-spacing: -0.5px; margin-bottom: 2px; }
            .company-tagline { display: block; font-size: 11px; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: 1px; margin-top: 0; }
            .document-meta { text-align: right; color: #4b5563; font-size: 9px; line-height: 1.4; }
            .report-title-section { text-align: center; margin: 24px 0; }
            .report-title { font-size: 22px; font-weight: 600; color: #111827; margin-bottom: 8px; letter-spacing: -0.3px; }
            .report-subtitle { font-size: 12px; color: #6b7280; font-weight: 500; }
            .report-parameters { background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px 20px; margin-bottom: 28px; display: flex; justify-content: space-between; align-items: center; }
            .param-group { display: flex; gap: 24px; }
            .param-item { font-size: 10px; }
            .param-label { color: #6b7280; font-weight: 500; margin-right: 6px; }
            .param-value { color: #1f2937; font-weight: 600; }
            .data-table { width: 100%; border-collapse: collapse; margin-bottom: 32px; background: #ffffff; border: 1px solid #e5e7eb; }
            .data-table thead th { background: #1e40af; color: #ffffff; font-weight: 600; padding: 14px 10px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 1px solid #1d4ed8; }
            .data-table thead th.text-right { text-align: right; }
            .data-table tbody td { padding: 12px 10px; border-bottom: 1px solid #f3f4f6; font-size: 9px; color: #374151; }
            .data-table tbody tr:nth-child(even) { background: #f9fafb; }
            .data-table tbody tr:hover { background: #f3f4f6; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .font-medium { font-weight: 500; }
            .font-semibold { font-weight: 600; }
            .awb-number { font-weight: 600; color: #1e40af; }
            .currency { font-weight: 500; color: #374151; }
            .total-currency { font-weight: 600; color: #1e40af; }
            .summary-section { background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #cbd5e1; padding: 24px; margin-top: 32px; page-break-inside: avoid; break-inside: avoid; }
            .summary-title { font-size: 14px; font-weight: 600; color: #1e40af; margin-bottom: 20px; text-align: center; text-transform: uppercase; letter-spacing: 1px; }
            .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-bottom: 20px; }
            .summary-item { background: #ffffff; padding: 16px; border: 1px solid #e5e7eb; text-align: center; }
            .summary-label { font-size: 9px; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
            .summary-value { font-size: 12px; font-weight: 600; color: #1f2937; }
            .grand-total-section { background: #1e40af; color: #ffffff; padding: 20px; text-align: center; margin-top: 16px; }
            .grand-total-label { font-size: 11px; font-weight: 500; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px; color: #bfdbfe; }
            .grand-total-value { font-size: 18px; font-weight: 700; color: #ffffff; }
            .document-footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; font-size: 8px; color: #9ca3af; }
            .footer-left { font-weight: 500; }
            .footer-right { text-align: right; }
            @media print { body { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; } .no-print { display: none !important; } .summary-section { page-break-inside: avoid !important; break-inside: avoid !important; } }
          </style>
        </head>
        <body>
          <div class="document-header">
            <div class="header-top">
              <div class="company-info">
                <div class="company-name">BCE EXPRESS</div>
                <div class="company-tagline">BETTER CARGO EXPERIENCE</div>
              </div>
              <div class="document-meta">
                <div><strong>Document ID:</strong> DR-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}</div>
                <div><strong>Generated:</strong> ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>
            <div class="report-title-section">
              <div class="report-title">DAILY REPORT</div>
              <div class="report-subtitle">Laporan Pengiriman Harian</div>
            </div>
          </div>

          <div class="report-parameters">
            <div class="param-group">
              <div class="param-item"><span class="param-label">REPORTING PERIOD:</span><span class="param-value">${dateRangeText || 'ALL PERIODS'}</span></div>
              ${selectedKirimVia ? `<div class="param-item"><span class="param-label">KIRIM VIA:</span><span class="param-value">${selectedKirimVia.toUpperCase()}</span></div>` : ''}
              ${selectedAgentCustomer ? `<div class="param-item"><span class="param-label">AGENT/CUSTOMER:</span><span class="param-value">${selectedAgentCustomer.toUpperCase()}</span></div>` : ''}
              ${selectedKotaTujuan ? `<div class="param-item"><span class="param-label">KOTA TUJUAN:</span><span class="param-value">${selectedKotaTujuan.toUpperCase()}</span></div>` : ''}
              ${selectedWilayah ? `<div class="param-item"><span class="param-label">WILAYAH:</span><span class="param-value">${selectedWilayah.toUpperCase()}</span></div>` : ''}
            </div>
            <div class="param-item"><span class="param-label">TOTAL RECORDS:</span><span class="param-value">${data.length}</span></div>
          </div>

          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 3%;">#</th>
                <th style="width: 10%;">AWB NUMBER</th>
                <th style="width: 8%;">DATE</th>
                <th style="width: 12%;">SENDER</th>
                <th style="width: 12%;">RECIPIENT</th>
                <th style="width: 5%;">COLI</th>
                <th style="width: 6%;">KG</th>
                <th class="text-right" style="width: 8%;">BASE RATE</th>
                <th class="text-right" style="width: 6%;">ADMIN</th>
                <th class="text-right" style="width: 6%;">PACKAGING</th>
                <th class="text-right" style="width: 7%;">CASH</th>
                <th class="text-right" style="width: 7%;">TRANSFER</th>
                <th class="text-right" style="width: 7%;">COD</th>
                <th style="width: 6%;">WILAYAH</th>
              </tr>
            </thead>
            <tbody>
              ${data.map((item, index) => `
                <tr>
                  <td class="text-center font-medium">${index + 1}</td>
                  <td class="awb-number">${item.awb_no}</td>
                  <td class="font-medium">${new Date(item.awb_date).toLocaleDateString('en-GB')}</td>
                  <td>${item.nama_pengirim}</td>
                  <td>${item.nama_penerima}</td>
                  <td class="text-center font-medium">${item.coli}</td>
                  <td class="text-right font-medium">${(item.berat_kg || 0).toLocaleString('id-ID')}</td>
                  <td class="text-right currency">${(item.harga_per_kg || item.ongkir || 0).toLocaleString('id-ID')}</td>
                  <td class="text-right currency">${(item.biaya_admin || item.admin || 0).toLocaleString('id-ID')}</td>
                  <td class="text-right currency">${(item.biaya_packaging || 0).toLocaleString('id-ID')}</td>
                  <td class="text-right total-currency">${item.metode_pembayaran === 'cash' ? `Rp. ${(item.total || 0).toLocaleString('id-ID')}` : '-'}</td>
                  <td class="text-right total-currency">${item.metode_pembayaran === 'transfer' ? `Rp. ${(item.total || 0).toLocaleString('id-ID')}` : '-'}</td>
                  <td class="text-right total-currency">${item.metode_pembayaran === 'cod' ? `Rp. ${(item.total || 0).toLocaleString('id-ID')}` : '-'}</td>
                  <td class="font-medium">${item.wilayah}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="summary-section">
            <div class="summary-title">SUMMARY REPORT</div>
            <div class="summary-grid">
              <div class="summary-item"><div class="summary-label">Total Shipments</div><div class="summary-value">${data.length} AWB</div></div>
              <div class="summary-item"><div class="summary-label">Total Coli</div><div class="summary-value">${data.reduce((s,i)=>s+(i.coli||0),0).toLocaleString('id-ID')}</div></div>
              <div class="summary-item"><div class="summary-label">Total Weight</div><div class="summary-value">${totalKg.toLocaleString('id-ID')} kg</div></div>
              <div class="summary-item"><div class="summary-label">Admin Fees</div><div class="summary-value">Rp ${(totalAdmin).toLocaleString('id-ID')}</div></div>
              <div class="summary-item"><div class="summary-label">Packaging</div><div class="summary-value">Rp ${(data.reduce((s,i)=>s+(i.biaya_packaging||0),0)).toLocaleString('id-ID')}</div></div>
              <div class="summary-item"><div class="summary-label">Total Cash</div><div class="summary-value">Rp ${(totalCash).toLocaleString('id-ID')}</div></div>
              <div class="summary-item"><div class="summary-label">Total Transfer</div><div class="summary-value">Rp ${(totalTransfer).toLocaleString('id-ID')}</div></div>
              <div class="summary-item"><div class="summary-label">Total COD</div><div class="summary-value">Rp ${(totalCOD).toLocaleString('id-ID')}</div></div>
              <div class="summary-item"><div class="summary-label">Total Revenue</div><div class="summary-value">Rp ${grandTotal.toLocaleString('id-ID')}</div></div>
              <div class="summary-item"><div class="summary-label">Avg. per AWB</div><div class="summary-value">Rp ${data.length>0? Math.round(grandTotal/data.length).toLocaleString('id-ID'):'0'}</div></div>
              <div class="summary-item"><div class="summary-label">Processing Date</div><div class="summary-value">${new Date().toLocaleDateString('en-GB')}</div></div>
            </div>
          </div>

          <div class="document-footer">
            <div class="footer-left">
              <div>BCE EXPRESS - BUSINESS DOCUMENT</div>
              <div>This report contains business information</div>
            </div>
            <div class="footer-right">
              <div>Page 1 of 1</div>
              <div>Generated by BCE Management System v2.0</div>
            </div>
          </div>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-100 mb-4">Daily Report</h2>
      <div className="mb-4 flex flex-wrap items-center gap-2 no-print">
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filter by Date From:</label>
        <input type="date" value={selectedDateFrom} onChange={(e) => setSelectedDateFrom(e.target.value)} className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400" />
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filter by Date To:</label>
        <input type="date" value={selectedDateTo} onChange={(e) => setSelectedDateTo(e.target.value)} className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400" />
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filter by Kirim Via:</label>
        <select value={selectedKirimVia} onChange={(e) => setSelectedKirimVia(e.target.value)} className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400">
          <option value="">Semua</option>
          <option value="udara">Udara</option>
          <option value="darat">Darat</option>
        </select>
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filter by Agent/Customer:</label>
        <select value={selectedAgentCustomer} onChange={(e) => setSelectedAgentCustomer(e.target.value)} className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400">
          <option value="">Semua</option>
          {agentList.map(agent => (<option key={agent} value={agent}>{agent}</option>))}
        </select>
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filter by Kota Tujuan:</label>
        <select value={selectedKotaTujuan} onChange={(e) => setSelectedKotaTujuan(e.target.value)} className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400">
          <option value="">Semua</option>
          {kotaTujuan.map(kota => (<option key={kota} value={kota}>{kota.toUpperCase()}</option>))}
        </select>
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filter by Wilayah:</label>
        <select value={selectedWilayah} onChange={(e) => setSelectedWilayah(e.target.value)} className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400">
          <option value="">Semua</option>
          {wilayahOptions.map(w => (<option key={w} value={w}>{w.toUpperCase()}</option>))}
        </select>
      </div>

      {data.length > 0 && (
        <div className="mb-4 flex justify-end no-print">
          <button onClick={downloadXLSX} className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-800 mr-2 transition-colors">Download XLSX</button>
          <button onClick={handlePrint} className="px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded hover:bg-red-700 dark:hover:bg-red-800 transition-colors">Print</button>
        </div>
      )}

      {error && <div className="mb-2 p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded border border-red-200 dark:border-red-800">{error}</div>}
      {loading ? (
        <div className="text-center py-4 text-gray-600 dark:text-gray-400">Loading...</div>
      ) : (
        <>
          <div className="overflow-x-auto w-full bg-white dark:bg-gray-800 rounded shadow sm:overflow-visible border border-gray-200 dark:border-gray-700">
            <table className="min-w-full text-sm divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-blue-50 dark:bg-blue-900/50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">No</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">AWB (No Resi)</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">Pengirim</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">Penerima</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">Coli</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">Kg</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">Harga(Ongkir)</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">Admin</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">Packaging</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 bg-blue-100 dark:bg-blue-800 text-gray-900 dark:text-gray-100">Cash</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 bg-blue-100 dark:bg-blue-800 text-gray-900 dark:text-gray-100">Transfer</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 bg-blue-100 dark:bg-blue-800 text-gray-900 dark:text-gray-100">COD</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">Wilayah</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, index) => (
                  <tr key={item.awb_no || `item-${index}`} className="even:bg-gray-50 dark:even:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{index + 1}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{item.awb_no}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{item.nama_pengirim}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{item.nama_penerima}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{item.coli}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{item.berat_kg}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{item.harga_per_kg || item.ongkir}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{item.biaya_admin || item.admin || 0}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{item.biaya_packaging || 0}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-blue-100 dark:bg-blue-800 text-gray-900 dark:text-gray-100">{item.metode_pembayaran === 'cash' ? `Rp. ${(item.total || 0).toLocaleString('en-US')}` : 'Rp. 0'}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-blue-100 dark:bg-blue-800 text-gray-900 dark:text-gray-100">{item.metode_pembayaran === 'transfer' ? `Rp. ${(item.total || 0).toLocaleString('en-US')}` : 'Rp. 0'}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-blue-100 dark:bg-blue-800 text-gray-900 dark:text-gray-100">{item.metode_pembayaran === 'cod' ? `Rp. ${(item.total || 0).toLocaleString('en-US')}` : 'Rp. 0'}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{item.wilayah}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.length > 0 && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Total Keseluruhan:</h3>
              <p className="text-gray-800 dark:text-gray-200">Total Kg: {data.reduce((sum, item) => sum + (item.berat_kg || 0), 0).toLocaleString('en-US')}</p>
              <p className="text-gray-800 dark:text-gray-200">Total Admin: Rp. {data.reduce((sum, item) => sum + (item.biaya_admin || item.admin || 0), 0).toLocaleString('en-US')}</p>
              <p className="text-gray-800 dark:text-gray-200">Total Cash: Rp. {data.filter(item => item.metode_pembayaran === 'cash').reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString('en-US')}</p>
              <p className="text-gray-800 dark:text-gray-200">Total Transfer: Rp. {data.filter(item => item.metode_pembayaran === 'transfer').reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString('en-US')}</p>
              <p className="text-gray-800 dark:text-gray-200">Total COD: Rp. {data.filter(item => item.metode_pembayaran === 'cod').reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString('en-US')}</p>
              <p className="text-gray-800 dark:text-gray-200">Total Semua: Rp. {data.reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString('en-US')}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
