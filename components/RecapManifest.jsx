"use client"

import { useState, useEffect } from "react"
import { supabaseClient } from "../lib/auth"
import { FaDownload, FaPrint } from 'react-icons/fa'
import { createStyledExcelWithHTML } from "../lib/excel-utils"
import { getEnhancedAgentList } from "../lib/agent-mapping"

const kirimViaOptions = ["udara", "darat"]  // Diambil dari AwbForm.jsx
const kotaTujuanOptions = ["bangka", "kalimantan barat", "belitung", "bali"]  // Diambil dari AwbForm.jsx dan HistoryManifest.jsx

/**
 * @param {{ userRole: string, branchOrigin: string }} props
 */
export default function RecapManifest({ userRole, branchOrigin }) {
  // ================== BRANCH / ROLE SWITCH ==================
  const BRANCH_USING_CABANG_TABLE = ["bangka", "tanjung_pandan"]; // tambah branch lain bila perlu
  // normalize branchOrigin for consistent comparisons / DB queries
  const normalizedBranchOrigin = (branchOrigin || '').toString().toLowerCase().trim();
  const isBranchMode =
    (userRole === "cabang" && BRANCH_USING_CABANG_TABLE.includes(normalizedBranchOrigin)) ||
    (userRole === "admin" && BRANCH_USING_CABANG_TABLE.includes(normalizedBranchOrigin));
  // ===========================================================

  const [data, setData] = useState([])  // State untuk menyimpan data laporan
  const [selectedKirimVia, setSelectedKirimVia] = useState("")  // Filter Kirim via
  const [selectedTujuan, setSelectedTujuan] = useState("")  // Filter Tujuan
  const [fromDate, setFromDate] = useState("")  // Filter dari tanggal
  const [toDate, setToDate] = useState("")  // Filter sampai tanggal
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const kotaTujuanOptionsFinal = isBranchMode 
    ? (branchOrigin === 'bangka' 
        ? ["JAKARTA BARAT", "JAKARTA PUSAT", "JAKARTA SELATAN", "JAKARTA TIMUR", "JAKARTA UTARA", "TANGERANG", "TANGERANG SELATAN", "TANGERANG KABUPATEN", "BEKASI KOTA", "BEKASI KABUPATEN", "DEPOK", "BOGOR KOTA", "BOGOR KABUPATEN"] 
        : ["jakarta", "tangerang", "bekasi", "depok", "bogor"]) 
    : ["bangka", "kalimantan barat", "belitung", "bali"];

  // Fungsi untuk fetch data dengan filter
  async function fetchRecapData() {
    setLoading(true)
    setError("")
    try {
      // Branch mode: query cabang tables, Central mode: query central tables
      let query;
      if (isBranchMode) {
        query = supabaseClient
          .from("manifest_cabang")
          .select("*")
          .eq('origin_branch', normalizedBranchOrigin)
          .order("awb_date", { ascending: false })
      } else {
        // Central users query central table without any filtering
        query = supabaseClient
          .from("manifest")
          .select("*")
          .order("awb_date", { ascending: false })
      }
      
      // Match DailyReport behavior: use case-insensitive match for kirim_via
      if (selectedKirimVia) {
        query = query.ilike("kirim_via", selectedKirimVia)
      }
      if (selectedTujuan) {
        query = query.eq("kota_tujuan", selectedTujuan)
      }
      if (fromDate && toDate) {
        query = query.gte("awb_date", fromDate).lte("awb_date", toDate)
      } else if (fromDate) {
        query = query.gte("awb_date", fromDate)
      } else if (toDate) {
        query = query.lte("awb_date", toDate)
      }
      
      const { data: fetchedData, error: fetchError } = await query
      
      if (fetchError) {
        setError(`Error fetching data: ${fetchError.message}`)
      } else {
        if (fetchedData) {
          const toNumber = (v) => {
            // convert numeric-like strings to numbers, preserve 0 for falsy values
            const n = Number(v);
            return Number.isNaN(n) ? 0 : n;
          };

          // Compute totals prioritizing DB-provided `total` (as used by DailyReport)
          // Fallback to computed value when `total` is missing/invalid

          const groupedData = fetchedData.reduce((acc, item) => {
            const date = item.awb_date;
            if (!acc[date]) {
              acc[date] = {
                totalAWB: 0,
                totalColi: 0,
                totalKg: 0,
                cash: 0,
                transfer: 0,
                cod: 0,
                totalAdmin: 0,
                totalPackaging: 0,
        totalOngkir: 0,
        totalTransit: 0,
        totalFix: 0,
                count: 0
              };
            }
    const coli = toNumber(item.coli);
    const berat = toNumber(item.berat_kg);
    const hargaPerKg = toNumber(item.harga_per_kg);
    const adm = toNumber(item.biaya_admin);
    const pack = toNumber(item.biaya_packaging);
    const transit = toNumber(item.biaya_transit);

    // Prefer DB-calculated `total` (consistent with DailyReport's calculateTotalBreakdown)
    const dbTotal = toNumber(item.total);
    // compute total consistent with SalesReport when dbTotal not available
    const fallbackWithoutTransit = (berat * hargaPerKg) + adm + pack;
    const fallbackWithTransit = fallbackWithoutTransit + transit;
    const lineTotal = dbTotal > 0 ? dbTotal : fallbackWithTransit;

            acc[date].totalAWB += 1;
            acc[date].totalColi += coli;
            acc[date].totalKg += berat;
            acc[date].totalAdmin += adm;
            acc[date].totalPackaging += pack;
            acc[date].totalOngkir += berat * hargaPerKg;
            acc[date].totalTransit += transit;
            acc[date].totalFix += lineTotal;

            const metode = (item.metode_pembayaran || '').toString().toLowerCase();
            if (metode === 'cash') acc[date].cash += lineTotal;
            if (metode === 'transfer') acc[date].transfer += lineTotal;
            if (metode === 'cod') acc[date].cod += lineTotal;

            acc[date].count += 1;
            return acc;
          }, {});

          const processedData = Object.entries(groupedData).map(([date, totals]) => ({
            date,
            totalAWB: totals.totalAWB,
            totalColi: totals.totalColi,
            totalKg: totals.totalKg,
            cash: totals.cash,
            transfer: totals.transfer,
            cod: totals.cod,
            totalAdmin: totals.totalAdmin,
            totalPackaging: totals.totalPackaging,
            totalOngkir: totals.totalOngkir,
            totalFix: totals.totalFix,
            totalTransit: totals.totalTransit,
            count: totals.count
          }));
          // Sort by date descending for consistency
          processedData.sort((a, b) => new Date(b.date) - new Date(a.date));
          setData(processedData);
        } else {
          setData([]);
        }
      }
    } catch (err) {
      setError(`Unexpected error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Reset filter
  const handleCancel = () => {
    setSelectedKirimVia("")
    setSelectedTujuan("")
    setFromDate("")
    setToDate("")
    setData([])  // Kosongkan data
    setError("")
  }

  const downloadXLSX = () => {
    if (data.length === 0) {
      alert("No data to download");
      return;
    }

    const headers = [
      'Date',
      'Total AWB',
      'Coli',
      'Weight (Kg)',
      'Cash',
      'Transfer',
      'COD',
      'Total Payment'
    ]

    const formattedData = data.map(item => ({
      'Date': item.date,
      'Total AWB': item.totalAWB,
      'Coli': item.totalColi,
      'Weight (Kg)': item.totalKg,
      'Cash': item.cash,
      'Transfer': item.transfer,
      'COD': item.cod,
      'Total Payment': (item.totalFix ?? (item.cash + item.transfer + item.cod))
    }))

    // Create date range string if filters are applied
    let dateRange = ''
    const filters = []
    
    if (fromDate || toDate) {
      if (fromDate && toDate) {
        // Convert YYYY-MM-DD to DD-MM-YYYY format
        const fromFormatted = fromDate.split('-').reverse().join('-')
        const toFormatted = toDate.split('-').reverse().join('-')
        filters.push(`${fromFormatted} s/d ${toFormatted}`)
      } else if (fromDate) {
        const fromFormatted = fromDate.split('-').reverse().join('-')
        filters.push(`Dari ${fromFormatted}`)
      } else if (toDate) {
        const toFormatted = toDate.split('-').reverse().join('-')
        filters.push(`Sampai ${toFormatted}`)
      }
    }
    
    if (selectedKirimVia) {
      filters.push(`Via: ${selectedKirimVia.toUpperCase()}`)
    }
    
    if (selectedTujuan) {
      filters.push(`Tujuan: ${selectedTujuan.toUpperCase()}`)
    }
    
    dateRange = filters.join(' - ')

    createStyledExcelWithHTML({
      title: 'Recap Manifest',
      headers,
      data: formattedData,
      fileName: `recap_manifest_${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}.xls`,
      currency: 'Rp',
      currencyColumns: [4, 5, 6, 7], // Cash, Transfer, COD, Total Payment
      numberColumns: [1, 2, 3], // Total AWB, Coli, Weight (Kg)
      dateRange: dateRange
    })
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Popup diblokir. Mohon izinkan popup di browser Anda.')
      return
    }
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Recap Manifest</title>
          <style>
            @page {
              margin: 20mm;
              size: A4;
            }
            
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
              font-size: 10px;
              line-height: 1.5;
              color: #1f2937;
              background: #ffffff;
              font-weight: 400;
            }
            
            .document-header {
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 24px;
              margin-bottom: 32px;
            }
            
            .header-top {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 16px;
            }
            
            .company-info {
              display: block;
            }
            
            .company-name {
              display: block;
              font-size: 28px;
              font-weight: 700;
              color: #1e40af;
              letter-spacing: -0.5px;
              margin-bottom: 2px;
            }
            
            .company-tagline {
              display: block;
              font-size: 11px;
              color: #6b7280;
              font-weight: 500;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-top: 0;
            }
            
            .document-meta {
              text-align: right;
              color: #4b5563;
              font-size: 9px;
              line-height: 1.4;
            }
            
            .report-title-section {
              text-align: center;
              margin: 24px 0;
            }
            
            .report-title {
              font-size: 22px;
              font-weight: 600;
              color: #111827;
              margin-bottom: 8px;
              letter-spacing: -0.3px;
            }
            
            .report-subtitle {
              font-size: 12px;
              color: #6b7280;
              font-weight: 500;
            }
            
            .report-parameters {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              padding: 16px 20px;
              margin-bottom: 28px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            
            .param-group {
              display: flex;
              gap: 24px;
            }
            
            .param-item {
              font-size: 10px;
            }
            
            .param-label {
              color: #6b7280;
              font-weight: 500;
              margin-right: 6px;
            }
            
            .param-value {
              color: #1f2937;
              font-weight: 600;
            }
            
            .data-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 32px;
              background: #ffffff;
              border: 1px solid #e5e7eb;
            }
            
            .data-table thead th {
              background: #1e40af;
              color: #ffffff;
              font-weight: 600;
              padding: 14px 10px;
              text-align: left;
              font-size: 9px;
              text-transform: uppercase;
              letter-spacing: 0.8px;
              border-bottom: 1px solid #1d4ed8;
            }
            
            .data-table thead th.text-right {
              text-align: right;
            }
            
            .data-table tbody td {
              padding: 12px 10px;
              border-bottom: 1px solid #f3f4f6;
              font-size: 9px;
              color: #374151;
            }
            
            .data-table tbody tr:nth-child(even) {
              background: #f9fafb;
            }
            
            .data-table tbody tr:hover {
              background: #f3f4f6;
            }
            
            .text-right {
              text-align: right;
            }
            
            .text-center {
              text-align: center;
            }
            
            .font-medium {
              font-weight: 500;
            }
            
            .font-semibold {
              font-weight: 600;
            }
            
            .currency {
              font-weight: 500;
              color: #374151;
            }
            
            .total-currency {
              font-weight: 600;
              color: #1e40af;
            }
            
            .summary-section {
              background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
              border: 1px solid #cbd5e1;
              padding: 24px;
              margin-top: 32px;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            
            .summary-title {
              font-size: 14px;
              font-weight: 600;
              color: #1e40af;
              margin-bottom: 20px;
              text-align: center;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 16px;
              margin-bottom: 20px;
            }
            
            .summary-item {
              background: #ffffff;
              padding: 16px;
              border: 1px solid #e5e7eb;
              text-align: center;
            }
            
            .summary-label {
              font-size: 9px;
              color: #6b7280;
              font-weight: 500;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 6px;
            }
            
            .summary-value {
              font-size: 12px;
              font-weight: 600;
              color: #1f2937;
            }
            
            .grand-total-section {
              background: #1e40af;
              color: #ffffff;
              padding: 20px;
              text-align: center;
              margin-top: 16px;
            }
            
            .grand-total-label {
              font-size: 11px;
              font-weight: 500;
              margin-bottom: 6px;
              text-transform: uppercase;
              letter-spacing: 1px;
              color: #bfdbfe;
            }
            
            .grand-total-value {
              font-size: 18px;
              font-weight: 700;
              color: #ffffff;
            }
            
            .document-footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 8px;
              color: #9ca3af;
            }
            
            .footer-left {
              font-weight: 500;
            }
            
            .footer-right {
              text-align: right;
            }
            
            @media print {
              body {
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
              
              .no-print {
                display: none !important;
              }
              
              .summary-section {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
            }
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
                <div><strong>Document ID:</strong> RCP-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}</div>
                <div><strong>Generated:</strong> ${new Date().toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                })} at ${new Date().toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}</div>
              </div>
            </div>
            
            <div class="report-title-section">
              <div class="report-title">RECAP MANIFEST</div>
              <div class="report-subtitle">Rekapitulasi Pengiriman Harian</div>
            </div>
          </div>
          
          <div class="report-parameters">
            <div class="param-group">
              <div class="param-item">
                <span class="param-label">PERIOD:</span>
                <span class="param-value">${fromDate && toDate ? `${new Date(fromDate).toLocaleDateString('en-GB')} - ${new Date(toDate).toLocaleDateString('en-GB')}` : 'ALL PERIODS'}</span>
              </div>
              ${selectedKirimVia ? `
              <div class="param-item">
                <span class="param-label">VIA:</span>
                <span class="param-value">${selectedKirimVia.toUpperCase()}</span>
              </div>
              ` : ''}
              ${selectedTujuan ? `
              <div class="param-item">
                <span class="param-label">DESTINATION:</span>
                <span class="param-value">${selectedTujuan.toUpperCase()}</span>
              </div>
              ` : ''}
            </div>
            <div class="param-item">
              <span class="param-label">TOTAL RECORDS:</span>
              <span class="param-value">${data.length}</span>
            </div>
          </div>
          
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 5%;">#</th>
                <th style="width: 12%;">DATE</th>
                <th class="text-right" style="width: 10%;">TOTAL AWB</th>
                <th class="text-right" style="width: 10%;">TOTAL COLI</th>
                <th class="text-right" style="width: 8%;">WEIGHT (KG)</th>
                <th class="text-right" style="width: 13%;">CASH</th>
                <th class="text-right" style="width: 13%;">TRANSFER</th>
                <th class="text-right" style="width: 13%;">COD</th>
                <th class="text-right" style="width: 16%;">TOTAL PAYMENT</th>
              </tr>
            </thead>
            <tbody>
              ${data.map((item, index) => `
                <tr>
                  <td class="text-center font-medium">${index + 1}</td>
                  <td class="font-medium">${new Date(item.date).toLocaleDateString('en-GB')}</td>
                  <td class="text-right font-medium">${(item.totalAWB || 0).toLocaleString('id-ID')}</td>
                  <td class="text-right font-medium">${(item.totalColi || 0).toLocaleString('id-ID')}</td>
                  <td class="text-right font-medium">${(item.totalKg || 0).toLocaleString('id-ID')}</td>
                  <td class="text-right currency">${(item.cash || 0).toLocaleString('id-ID')}</td>
                  <td class="text-right currency">${(item.transfer || 0).toLocaleString('id-ID')}</td>
                  <td class="text-right currency">${(item.cod || 0).toLocaleString('id-ID')}</td>
                  <td class="text-right total-currency">${((item.cash || 0) + (item.transfer || 0) + (item.cod || 0)).toLocaleString('id-ID')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="summary-section">
            <div class="summary-title">SUMMARY</div>
            
            <div class="summary-grid">
              <div class="summary-item">
                <div class="summary-label">Total AWB</div>
                <div class="summary-value">${data.reduce((sum, item) => sum + (item.totalAWB || 0), 0).toLocaleString('id-ID')}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Total Coli</div>
                <div class="summary-value">${data.reduce((sum, item) => sum + (item.totalColi || 0), 0).toLocaleString('id-ID')}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Total Weight</div>
                <div class="summary-value">${data.reduce((sum, item) => sum + (item.totalKg || 0), 0).toLocaleString('id-ID')} kg</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Avg per Day</div>
                <div class="summary-value">${data.length > 0 ? Math.round(data.reduce((sum, item) => sum + (item.totalAWB || 0), 0) / data.length).toLocaleString('id-ID') : '0'} AWB</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Cash Payments</div>
                <div class="summary-value">Rp ${data.reduce((sum, item) => sum + (item.cash || 0), 0).toLocaleString('id-ID')}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Transfer Payments</div>
                <div class="summary-value">Rp ${data.reduce((sum, item) => sum + (item.transfer || 0), 0).toLocaleString('id-ID')}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">COD Payments</div>
                <div class="summary-value">Rp ${data.reduce((sum, item) => sum + (item.cod || 0), 0).toLocaleString('id-ID')}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Report Date</div>
                <div class="summary-value">${new Date().toLocaleDateString('en-GB')}</div>
              </div>
            </div>
            
            <div class="grand-total-section">
              <div class="grand-total-label">TOTAL REVENUE</div>
              <div class="grand-total-value">Rp ${data.reduce((sum, item) => sum + (item.totalFix || ((item.cash || 0) + (item.transfer || 0) + (item.cod || 0))), 0).toLocaleString('id-ID')}</div>
            </div>
          </div>
          
          <div class="document-footer">
            <div class="footer-left">
              <div>BCE EXPRESS - BUSINESS DOCUMENT</div>
              <div>This report contains business information</div>
              <div>Periksa kembali data yang tercantum dalam laporan ini</div>
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
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-100 mb-4">Recap Manifest</h2>
      
      {/* Bagian Filter, tambahkan class no-print */}
      <div className="mb-4 flex flex-wrap items-center gap-2 no-print">
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filter by Kirim Via:</label>
        <select
          value={selectedKirimVia}
          onChange={(e) => setSelectedKirimVia(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
        >
          <option value="">Semua</option>
          {kirimViaOptions.map((option) => (
            <option key={option} value={option}>
              {option.toUpperCase()}
            </option>
          ))}
        </select>
        
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filter by Tujuan:</label>
        <select
          value={selectedTujuan}
          onChange={(e) => setSelectedTujuan(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
        >
          <option value="">Semua</option>
          {kotaTujuanOptionsFinal.map((option) => (
            <option key={option} value={option}>
              {option.toUpperCase()}
            </option>
          ))}
        </select>
        
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Dari Tanggal:</label>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
        />
        
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Sampai Tanggal:</label>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
        />
        
        <button
          onClick={fetchRecapData}
          className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors"
          disabled={loading}
        >
          {loading ? "Memuat..." : "Tampilkan"}
        </button>
        
        <button
          onClick={handleCancel}
          className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Tombol download dan print, tambahkan class no-print */}
      <div className="mb-4 flex justify-end no-print">
        <button
          onClick={downloadXLSX}
          className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-800 mr-2 flex items-center gap-2 transition-colors"
        >
          <FaDownload /> Download XLSX
        </button>
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded hover:bg-red-700 dark:hover:bg-red-800 flex items-center gap-2 transition-colors"
        >
          <FaPrint /> Print
        </button>
      </div>

      {error && <div className="mb-2 p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded border border-red-200 dark:border-red-800">{error}</div>}
      
      {loading ? (
        <div className="text-center py-4 text-gray-600 dark:text-gray-400">Loading...</div>
      ) : (
        <>
          <div className="overflow-x-auto w-full bg-white dark:bg-gray-800 rounded shadow border border-gray-200 dark:border-gray-700">
            <table className="min-w-full text-sm divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-blue-50 dark:bg-blue-900/50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">No</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">Tgl</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">Total AWB</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">Total Coli</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">Kg</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 bg-blue-100 dark:bg-blue-800 text-gray-900 dark:text-gray-100">Cash</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 bg-blue-100 dark:bg-blue-800 text-gray-900 dark:text-gray-100">Transfer</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 bg-blue-100 dark:bg-blue-800 text-gray-900 dark:text-gray-100">COD</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">Total Pembayaran</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, index) => (
                  <tr key={item.date || index} className="even:bg-gray-50 dark:even:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{index + 1}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{item.date}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{item.totalAWB || 0}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{item.totalColi || 0}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{item.totalKg || 0}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-blue-100 dark:bg-blue-800 text-gray-900 dark:text-gray-100">Rp. {(item.cash || 0).toLocaleString('en-US')}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-blue-100 dark:bg-blue-800 text-gray-900 dark:text-gray-100">Rp. {(item.transfer || 0).toLocaleString('en-US')}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-blue-100 dark:bg-blue-800 text-gray-900 dark:text-gray-100">Rp. {(item.cod || 0).toLocaleString('en-US')}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">Rp. {(item.totalFix || ((item.cash || 0) + (item.transfer || 0) + (item.cod || 0))).toLocaleString('en-US')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Total di Bawah Tabel */}
          {data.length > 0 && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-800 flex flex-row flex-wrap items-center gap-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Total:</h3>
              <p className="text-gray-800 dark:text-gray-200">Total AWB: {data.reduce((sum, item) => sum + (item.totalAWB || 0), 0)}</p>
              <p className="text-gray-800 dark:text-gray-200">Total Coli: {data.reduce((sum, item) => sum + (item.totalColi || 0), 0)}</p>
              <p className="text-gray-800 dark:text-gray-200">Total Kg: {data.reduce((sum, item) => sum + (item.totalKg || 0), 0)}</p>
              <p className="text-gray-800 dark:text-gray-200">Total Cash: Rp. {data.reduce((sum, item) => sum + (item.cash || 0), 0).toLocaleString('en-US')}</p>
              <p className="text-gray-800 dark:text-gray-200">Total Transfer: Rp. {data.reduce((sum, item) => sum + (item.transfer || 0), 0).toLocaleString('en-US')}</p>
              <p className="text-gray-800 dark:text-gray-200">Total COD: Rp. {data.reduce((sum, item) => sum + (item.cod || 0), 0).toLocaleString('en-US')}</p>
              <p className="text-gray-800 dark:text-gray-200">Total Pembayaran: Rp. {data.reduce((sum, item) => sum + (item.totalFix || ((item.cash || 0) + (item.transfer || 0) + (item.cod || 0))), 0).toLocaleString('en-US')}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}