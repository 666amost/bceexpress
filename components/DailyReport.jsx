"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { supabaseClient } from "../lib/auth"
import { createStyledExcelWithHTML } from "../lib/excel-utils"
import { getEnhancedAgentList, doesAgentMatch, getAllAgentIdentifiers } from "../lib/agent-mapping"
import { baseAgentListBangka, baseAgentListTanjungPandan, baseAgentListCentral } from "../lib/agents"
import { areaCodeData } from '@/lib/area-codes';

export default function DailyReport({ userRole, branchOrigin }) {
  // ================== BRANCH / ROLE SWITCH ==================
  const BRANCH_USING_CABANG_TABLE = ["bangka", "tanjung_pandan"]; // tambah branch lain bila perlu
  const isBranchMode =
    (userRole === "cabang" && BRANCH_USING_CABANG_TABLE.includes(branchOrigin)) ||
    (userRole === "admin" && BRANCH_USING_CABANG_TABLE.includes(branchOrigin));
  // ===========================================================

  const [data, setData] = useState([])  // State untuk menyimpan data laporan
  const [selectedDateFrom, setSelectedDateFrom] = useState("") // State baru untuk filter tanggal Dari
  const [selectedDateTo, setSelectedDateTo] = useState("") // State baru untuk filter tanggal Sampai
  const [selectedKirimVia, setSelectedKirimVia] = useState("")  // State untuk filter kirim via
  const [selectedAgentCustomer, setSelectedAgentCustomer] = useState("")  // State untuk filter Agent/Customer
  const [selectedKotaTujuan, setSelectedKotaTujuan] = useState("")  // State baru untuk filter kota tujuan
  const [selectedWilayah, setSelectedWilayah] = useState("")
  const [selectedAreaCode, setSelectedAreaCode] = useState("")  // State baru untuk filter area code (GLC/KMY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // ================== LISTS ==================

  // ...existing code...

  // Fetch function must be defined after all dependencies
  const fetchDailyReport = useCallback(async () => {
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

      if (selectedKirimVia) query = query.ilike("kirim_via", selectedKirimVia)
      if (selectedAgentCustomer) {
        // Allow typing: match agent name text (ilike) OR any mapped emails (in)
        const agentIdentifiers = getAllAgentIdentifiers(selectedAgentCustomer || "")
  // debug logs removed

        // Build OR conditions: agent_customer.ilike.%<text>% OR agent_customer.in.("email1","email2")
        const orClauses = [];
        
        // Include mapped emails if available (this is the primary match for mapped agents)
        if (agentIdentifiers.length > 1) { // More than just the agent name itself
          const emailsOnly = agentIdentifiers.filter(id => id.includes('@'));
          if (emailsOnly.length > 0) {
            const inList = emailsOnly.map(e => `\"${e}\"`).join(',');
            orClauses.push(`agent_customer.in.(${inList})`);
          }
        }
        
        // Also match free-text agent names (partial) - for both display names and direct agent_customer entries
        orClauses.push(`agent_customer.ilike.%${selectedAgentCustomer}%`);
        
  // debug logs removed
        
        if (orClauses.length > 0) {
          query = query.or(orClauses.join(','));
        }
      }
      if (selectedKotaTujuan) query = query.eq("kota_tujuan", selectedKotaTujuan)
      if (selectedWilayah) {
        // For branch mode (manifest_cabang) the area is stored in `kecamatan`.
        // Use `kecamatan` when in branch mode, otherwise use `wilayah`.
        if (isBranchMode) {
          query = query.eq("kecamatan", selectedWilayah)
        } else {
          query = query.eq("wilayah", selectedWilayah)
        }
      }
      if (selectedAreaCode && isBranchMode) {
        // Area code filter HANYA untuk branch mode (manifest_cabang)
        const areaWilayahList = areaCodeData[selectedAreaCode] || []
        if (areaWilayahList.length > 0) {
          // Search in kecamatan field untuk branch mode
          const orConditions = areaWilayahList.map(area => `kecamatan.ilike.%${area}%`);
          if (orConditions.length > 0) {
            query = query.or(orConditions.join(','));
          }
        }
      }

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
  }, [isBranchMode, branchOrigin, selectedDateFrom, selectedDateTo, selectedKirimVia, selectedAgentCustomer, selectedKotaTujuan, selectedWilayah, selectedAreaCode]);

  // Use centralized agent lists
  const agentList = isBranchMode
    ? (branchOrigin === 'bangka'
        ? getEnhancedAgentList(baseAgentListBangka)
        : getEnhancedAgentList(baseAgentListTanjungPandan))
  : getEnhancedAgentList(baseAgentListCentral);

  const kotaTujuan = isBranchMode
    ? (branchOrigin === 'bangka'
        ? ["JAKARTA BARAT", "JAKARTA PUSAT", "JAKARTA SELATAN", "JAKARTA TIMUR", "JAKARTA UTARA", "TANGERANG", "TANGERANG SELATAN", "TANGERANG KABUPATEN", "BEKASI KOTA", "BEKASI KABUPATEN", "DEPOK", "BOGOR KOTA", "BOGOR KABUPATEN"]
        : ["jakarta", "tangerang", "bekasi", "depok", "bogor"])
    : ["bangka", "kalimantan barat", "belitung", "bali"];

  const kotaWilayah = useMemo(() => {
    return isBranchMode
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
  }, [isBranchMode, branchOrigin]);

  const wilayahOptions = useMemo(() => {
    // Prioritas 1: Area code filter untuk branch mode
    if (isBranchMode && selectedAreaCode && areaCodeData[selectedAreaCode]) {
      return areaCodeData[selectedAreaCode];
    }
    // Prioritas 2: Kota tujuan filter (untuk semua mode)
    if (selectedKotaTujuan && kotaWilayah[selectedKotaTujuan]) {
      return kotaWilayah[selectedKotaTujuan];
    }
    // Prioritas 3: Default untuk branch mode tanpa filter area code dan kota tujuan
    if (isBranchMode && !selectedAreaCode && !selectedKotaTujuan) {
      const allAreaOptions = [...areaCodeData["BCE GLC"], ...areaCodeData["BCE KMY"]];
      return [...new Set(allAreaOptions)]; // Remove duplicates
    }
    // Default: kosong
    return [];
  }, [selectedKotaTujuan, selectedAreaCode, kotaWilayah, isBranchMode]);

  // useEffect hook to fetch data on component mount and when filters change
  useEffect(() => {
    fetchDailyReport();
  }, [fetchDailyReport]);

  // Reset area code untuk central mode (non-branch)
  useEffect(() => {
    if (!isBranchMode && selectedAreaCode) {
      setSelectedAreaCode("");
    }
  }, [isBranchMode, selectedAreaCode]);

  // Reset wilayah when area code changes (hanya untuk branch mode)
  useEffect(() => {
    if (isBranchMode && selectedAreaCode) {
      setSelectedWilayah("");
      setSelectedKotaTujuan(""); // Reset kota tujuan ketika area code dipilih
    }
  }, [selectedAreaCode, isBranchMode]);

  // Reset area code when kota tujuan changes (hanya untuk branch mode)
  useEffect(() => {
    if (isBranchMode && selectedKotaTujuan) {
      setSelectedAreaCode("");
    }
  }, [selectedKotaTujuan, isBranchMode]);

  // Function to download Excel file
  const downloadXLSX = useCallback(() => {
    if (data.length === 0) {
      alert('Tidak ada data untuk diexport.');
      return;
    }

    const headers = [
      'AWB Number',
      'Date',
      'Sender',
      'Recipient', 
      'Coli',
      'Weight (Kg)',
      'Rate/Ongkir',
      'Admin Fee',
      'Packaging',
      'Transit',
      'Cash',
      'Transfer', 
      'COD',
      'Wilayah'
    ];

    // Format data as objects with key-value pairs matching headers
    const excelData = data.map((item) => ({
      'AWB Number': item.awb_no,
      'Date': new Date(item.awb_date).toLocaleDateString('en-GB'),
      'Sender': item.nama_pengirim,
      'Recipient': item.nama_penerima,
      'Coli': item.coli,
      'Weight (Kg)': item.berat_kg || 0,
      'Rate/Ongkir': item.harga_per_kg || item.ongkir || 0,
      'Admin Fee': item.biaya_admin || item.admin || 0,
      'Packaging': item.biaya_packaging || 0,
      'Transit': item.biaya_transit || 0,
      'Cash': (item.metode_pembayaran || '').toLowerCase() === 'cash' ? (item.total || 0) : 0,
      'Transfer': (item.metode_pembayaran || '').toLowerCase() === 'transfer' ? (item.total || 0) : 0,
      'COD': (item.metode_pembayaran || '').toLowerCase() === 'cod' ? (item.total || 0) : 0,
  // prefer kecamatan (branch mode) but fall back to wilayah
  'Wilayah': item.kecamatan || item.wilayah
    }));

    let dateRangeText = '';
    if (selectedDateFrom && selectedDateTo) {
      const fromFormatted = selectedDateFrom.split('-').reverse().join('-');
      const toFormatted = selectedDateTo.split('-').reverse().join('-');
      dateRangeText = `${fromFormatted} s/d ${toFormatted}`;
    } else if (selectedDateFrom) {
      const fromFormatted = selectedDateFrom.split('-').reverse().join('-');
      dateRangeText = `Dari ${fromFormatted}`;
    } else if (selectedDateTo) {
      const toFormatted = selectedDateTo.split('-').reverse().join('-');
      dateRangeText = `Sampai ${toFormatted}`;
    } else {
      dateRangeText = 'Semua Periode';
    }

    const filename = `DailyReport_${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}.xls`;

    createStyledExcelWithHTML({
      title: 'Daily Report',
      headers,
      data: excelData,
      fileName: filename,
      currency: 'Rp',
      currencyColumns: [6, 7, 8, 9, 10, 11, 12], // Rate, Admin, Packaging, Transit, Cash, Transfer, COD columns
      numberColumns: [4, 5], // Coli and Weight columns
      dateRange: dateRangeText
    });
  }, [data, selectedDateFrom, selectedDateTo]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Popup diblokir. Mohon izinkan popup di browser Anda.')
      return
    }

    const totalKg = data.reduce((sum, item) => sum + (item.berat_kg || 0), 0)
    const totalAdmin = data.reduce((sum, item) => sum + (item.biaya_admin || item.admin || 0), 0)
    const totalTransit = data.reduce((sum, item) => sum + (item.biaya_transit || 0), 0)
    const totalCash = data.filter(item => (item.metode_pembayaran || '').toLowerCase() === 'cash').reduce((sum, item) => sum + (item.total || 0), 0)
    const totalTransfer = data.filter(item => (item.metode_pembayaran || '').toLowerCase() === 'transfer').reduce((sum, item) => sum + (item.total || 0), 0)
    const totalCOD = data.filter(item => (item.metode_pembayaran || '').toLowerCase() === 'cod').reduce((sum, item) => sum + (item.total || 0), 0)
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
                <th class="text-right" style="width: 6%;">TRANSIT</th>
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
                  <td class="text-right currency">${(item.biaya_transit || 0).toLocaleString('id-ID')}</td>
                  <td class="text-right total-currency">${(item.metode_pembayaran || '').toLowerCase() === 'cash' ? `Rp. ${(item.total || 0).toLocaleString('id-ID')}` : '-'}</td>
                  <td class="text-right total-currency">${(item.metode_pembayaran || '').toLowerCase() === 'transfer' ? `Rp. ${(item.total || 0).toLocaleString('id-ID')}` : '-'}</td>
                  <td class="text-right total-currency">${(item.metode_pembayaran || '').toLowerCase() === 'cod' ? `Rp. ${(item.total || 0).toLocaleString('id-ID')}` : '-'}</td>
                  <td class="font-medium">${item.kecamatan || item.wilayah}</td>
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
              <div class="summary-item"><div class="summary-label">Transit Fees</div><div class="summary-value">Rp ${(totalTransit).toLocaleString('id-ID')}</div></div>
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
        <input list="agent-options" value={selectedAgentCustomer} onChange={(e) => setSelectedAgentCustomer(e.target.value)} placeholder="Ketik untuk mencari agent" className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400" />
        <datalist id="agent-options">
          <option value="">Semua</option>
          {agentList.map(agent => (<option key={agent} value={agent}>{agent}</option>))}
        </datalist>
        {/* Area Code filter hanya untuk branch mode (manifest_cabang) */}
        {isBranchMode && (
          <>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filter by Area Code:</label>
            <select value={selectedAreaCode} onChange={(e) => setSelectedAreaCode(e.target.value)} className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400">
              <option value="">Semua</option>
              <option value="BCE GLC">BCE GLC</option>
              <option value="BCE KMY">BCE KMY</option>
            </select>
          </>
        )}
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filter by Kota Tujuan:</label>
        <select value={selectedKotaTujuan} onChange={(e) => setSelectedKotaTujuan(e.target.value)} className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400">
          <option value="">Semua</option>
          {kotaTujuan.map(kota => (<option key={kota} value={kota}>{kota.toUpperCase()}</option>))}
        </select>
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filter by Wilayah:</label>
        <select value={selectedWilayah} onChange={(e) => setSelectedWilayah(e.target.value)} className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400">
          <option value="">Semua</option>
          {wilayahOptions.map((w, index) => (<option key={`${w}-${index}`} value={w}>{w.toUpperCase()}</option>))}
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
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">Transit</th>
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
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{item.biaya_transit || 0}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-blue-100 dark:bg-blue-800 text-gray-900 dark:text-gray-100">{(item.metode_pembayaran || '').toLowerCase() === 'cash' ? `Rp. ${(item.total || 0).toLocaleString('en-US')}` : 'Rp. 0'}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-blue-100 dark:bg-blue-800 text-gray-900 dark:text-gray-100">{(item.metode_pembayaran || '').toLowerCase() === 'transfer' ? `Rp. ${(item.total || 0).toLocaleString('en-US')}` : 'Rp. 0'}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-blue-100 dark:bg-blue-800 text-gray-900 dark:text-gray-100">{(item.metode_pembayaran || '').toLowerCase() === 'cod' ? `Rp. ${(item.total || 0).toLocaleString('en-US')}` : 'Rp. 0'}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{item.kecamatan || item.wilayah}</td>
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
              <p className="text-gray-800 dark:text-gray-200">Total Transit: Rp. {data.reduce((sum, item) => sum + (item.biaya_transit || 0), 0).toLocaleString('en-US')}</p>
              <p className="text-gray-800 dark:text-gray-200">Total Cash: Rp. {data.filter(item => (item.metode_pembayaran || '').toLowerCase() === 'cash').reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString('en-US')}</p>
              <p className="text-gray-800 dark:text-gray-200">Total Transfer: Rp. {data.filter(item => (item.metode_pembayaran || '').toLowerCase() === 'transfer').reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString('en-US')}</p>
              <p className="text-gray-800 dark:text-gray-200">Total COD: Rp. {data.filter(item => (item.metode_pembayaran || '').toLowerCase() === 'cod').reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString('en-US')}</p>
              <p className="text-gray-800 dark:text-gray-200">Total Semua: Rp. {data.reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString('en-US')}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
