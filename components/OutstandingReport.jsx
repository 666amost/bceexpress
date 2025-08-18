"use client"

import { useState, useEffect, useCallback } from "react"
import { supabaseClient } from "../lib/auth"
import { FaDownload, FaPrint } from 'react-icons/fa'
import { createStyledExcelWithHTML } from "../lib/excel-utils"
import { getEnhancedAgentList, getAllAgentIdentifiers } from "../lib/agent-mapping"

const baseAgentListBangka = [
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
  ,
  // Added new Bangka agents
  "YENNY",
  "TATA",
  "PHING BCE",
  "AJIN",
  "NINA SARJU"
];

const baseAgentListTanjungPandan = [
  "COD",
  "TRANSFER", 
  "CASH",
  "Wijaya Crab"
];

// Enhanced agent lists with email mappings
const agentListBangka = getEnhancedAgentList(baseAgentListBangka);
const agentListTanjungPandan = getEnhancedAgentList(baseAgentListTanjungPandan);

/**
 * @param {{ userRole: string, branchOrigin: string }} props
 */
export default function OutstandingReport({ userRole, branchOrigin }) {
  // ================== BRANCH / ROLE SWITCH ==================
  const BRANCH_USING_CABANG_TABLE = ["bangka", "tanjung_pandan"]; // tambah branch lain bila perlu
  const isBranchMode =
    (userRole === "cabang" && BRANCH_USING_CABANG_TABLE.includes(branchOrigin)) ||
    (userRole === "admin" && BRANCH_USING_CABANG_TABLE.includes(branchOrigin));
  // ===========================================================

  const [agentList, setAgentList] = useState([])
  const [selectedAgent, setSelectedAgent] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [outstandingData, setOutstandingData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const currentAgentList = isBranchMode ? (branchOrigin === 'bangka' ? agentListBangka : agentListTanjungPandan) : agentList;

  useEffect(() => {
    fetchAgents()
    fetchOutstandingData()
  }, [selectedAgent, startDate, endDate]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchAgents() {
    try {
      // Branch mode: query cabang tables, Central mode: query central tables
      let query;
      if (isBranchMode) {
        query = supabaseClient
          .from("manifest_cabang")
          .select("agent_customer")
          .eq('origin_branch', branchOrigin)
      } else {
        // Central users query central table without any filtering
        query = supabaseClient
          .from("manifest")
          .select("agent_customer")
      }
      
      const { data, error } = await query
      
      if (error) throw error
      
      const distinctAgents = [...new Set(data.map(item => item.agent_customer).filter(Boolean))]
      setAgentList(distinctAgents)
    } catch (err) {
      setError("Failed to fetch agents")
    }
  }

  async function fetchOutstandingData() {
    setLoading(true)
    try {
      // Branch mode: query cabang tables, Central mode: query central tables
      let query;
      if (isBranchMode) {
        // For bangka branch use kecamatan, for tanjung_pandan use wilayah
        const locationColumn = branchOrigin === 'bangka' ? 'kecamatan' : 'wilayah';
        
        query = supabaseClient
          .from("manifest_cabang")
          .select(`
            awb_no,
            awb_date,
            ${locationColumn},
            nama_pengirim,
            nama_penerima,
            total,
            berat_kg,
            biaya_admin,
            biaya_packaging,
            biaya_transit,
            agent_customer
          `)
          .eq("buktimembayar", false)
          .eq('origin_branch', branchOrigin)
          .order("awb_date", { ascending: false })
      } else {
        query = supabaseClient
          .from("manifest")
          .select(`
            awb_no,
            awb_date,
            wilayah,
            nama_pengirim,
            nama_penerima,
            total,
            berat_kg,
            biaya_admin,
            biaya_packaging,
            biaya_transit,
            agent_customer
          `)
          .eq("buktimembayar", false)
          .order("awb_date", { ascending: false })
      }

      if (selectedAgent) {
        // Use enhanced agent matching for emails
        const agentIdentifiers = getAllAgentIdentifiers(selectedAgent)
        query = query.in("agent_customer", agentIdentifiers)
      }

      if (startDate) {
        query = query.gte("awb_date", startDate)
      }

      if (endDate) {
        query = query.lte("awb_date", endDate)
      }

      const { data, error } = await query

      if (error) throw error

      // Process data with correct Total Ongkir calculation (match DailyReport)
      const processedData = data.map(item => {
        // Ambil ongkir x kg dari field total jika sudah hasil kali di database, jika tidak, fallback ke harga_per_kg * berat_kg
        let ongkir = 0;
        if (item.total != null) {
          ongkir = item.total - (item.biaya_admin || 0) - (item.biaya_packaging || 0) - (item.biaya_transit || 0);
        } else if (item.harga_per_kg != null && item.berat_kg != null) {
          ongkir = item.harga_per_kg * item.berat_kg;
        }
        const berat = item.berat_kg || 0;
        const adm = item.biaya_admin || 0;
        const packing = item.biaya_packaging || 0;
        const transit = item.biaya_transit || 0;
        const totalOngkir = ongkir + adm + packing + transit;
        return {
          ...item,
          wilayah: userRole === 'cabang' && branchOrigin === 'bangka' ? item.kecamatan : item.wilayah,
          ongkir: ongkir, // ongkir x kg
          kg: berat,
          adm,
          packing,
          transit,
          tot_ongkir: totalOngkir
        }
      })

      setOutstandingData(processedData)
    } catch (err) {
      setError("Failed to fetch outstanding data")
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadXLSX = () => {
    if (outstandingData.length === 0) {
      alert("No data to download");
      return;
    }

    const headers = [
      'AWB Number',
      'Date', 
      'Wilayah',
      'Sender',
      'Recipient',
      'Rate/Ongkir',
      'Weight (Kg)',
      'Admin Fee',
      'Packaging',
      'Transit',
      'Total Ongkir'
    ]

    const formattedData = outstandingData.map(item => ({
      'AWB Number': item.awb_no,
      'Date': item.awb_date,
      'Wilayah': item.wilayah,
      'Sender': item.nama_pengirim,
      'Recipient': item.nama_penerima,
      'Rate/Ongkir': item.ongkir || 0,
      'Weight (Kg)': item.kg || 0,
      'Admin Fee': item.adm || 0,
      'Packaging': item.packing || 0,
      'Transit': item.transit || 0,
      'Total Ongkir': item.tot_ongkir || 0
    }))

    // Create date range string if filters are applied
    let dateRange = ''
    if (startDate || endDate) {
      if (startDate && endDate) {
        // Convert YYYY-MM-DD to DD-MM-YYYY format
        const fromFormatted = startDate.split('-').reverse().join('-')
        const toFormatted = endDate.split('-').reverse().join('-')
        dateRange = `${fromFormatted} s/d ${toFormatted}`
      } else if (startDate) {
        const fromFormatted = startDate.split('-').reverse().join('-')
        dateRange = `Dari ${fromFormatted}`
      } else if (endDate) {
        const toFormatted = endDate.split('-').reverse().join('-')
        dateRange = `Sampai ${toFormatted}`
      }
    }
    if (selectedAgent) {
      dateRange = dateRange ? `${dateRange} - ${selectedAgent}` : selectedAgent
    }

    const reportTitle = selectedAgent ? `Outstanding Report ${selectedAgent}` : 'Outstanding Report';

    createStyledExcelWithHTML({
      title: reportTitle,
      headers,
      data: formattedData,
      fileName: `outstanding_report_${selectedAgent ? selectedAgent + '_' : ''}${new Date().toISOString().split('T')[0]}.xls`,
      currency: 'Rp',
      currencyColumns: [5, 7, 8, 9, 10], // Rate/Ongkir, Admin Fee, Packaging, Transit, Total Ongkir columns
      numberColumns: [6], // Weight (Kg) column
      dateRange: dateRange
    })
  }

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    printWindow.document.write(`
      <html>
        <head>
          <title>Outstanding Report</title>
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
              /* Ensure children stack vertically */
              display: block;
            }
            
            .company-name {
              display: block; /* Ensure block display for vertical stacking */
              font-size: 28px;
              font-weight: 700;
              color: #1e40af;
              letter-spacing: -0.5px;
              margin-bottom: 2px; /* Adjust margin below name */
            }
            
            .company-tagline {
              display: block; /* Ensure block display for vertical stacking */
              font-size: 11px;
              color: #6b7280;
              font-weight: 500;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-top: 0; /* Ensure no top margin */
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
            
            .awb-number {
              font-weight: 600;
              color: #1e40af;
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
                <div><strong>Document ID:</strong> OUT-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}</div>
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
              <div class="report-title">OUTSTANDING REPORT${selectedAgent ? ` - ${selectedAgent}` : ''}</div>
              <div class="report-subtitle">Pending Pembayaran</div>
            </div>
          </div>
          
          <div class="report-parameters">
            <div class="param-group">
              <div class="param-item">
                <span class="param-label">REPORTING PERIOD:</span>
                <span class="param-value">${startDate && endDate ? `${new Date(startDate).toLocaleDateString('en-GB')} - ${new Date(endDate).toLocaleDateString('en-GB')}` : 'ALL PERIODS'}</span>
              </div>
              ${selectedAgent ? `
              <div class="param-item">
                <span class="param-label">AGENT:</span>
                <span class="param-value">${selectedAgent}</span>
              </div>
              ` : ''}
            </div>
            <div class="param-item">
              <span class="param-label">TOTAL RECORDS:</span>
              <span class="param-value">${outstandingData.length}</span>
            </div>
          </div>
          
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 4%;">#</th>
                <th style="width: 12%;">AWB NUMBER</th>
                <th style="width: 9%;">DATE</th>
                <th style="width: 11%;">DESTINATION</th>
                <th style="width: 16%;">SENDER</th>
                <th style="width: 16%;">RECIPIENT</th>
                <th class="text-right" style="width: 8%;">BASE RATE</th>
                <th class="text-right" style="width: 5%;">WEIGHT</th>
                <th class="text-right" style="width: 6%;">ADMIN</th>
                <th class="text-right" style="width: 6%;">PACK</th>
                <th class="text-right" style="width: 6%;">TRANSIT</th>
                <th class="text-right" style="width: 11%;">TOTAL AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              ${outstandingData.map((item, index) => `
                <tr>
                  <td class="text-center font-medium">${index + 1}</td>
                  <td class="awb-number">${item.awb_no}</td>
                  <td class="font-medium">${new Date(item.awb_date).toLocaleDateString('en-GB')}</td>
                  <td class="font-medium">${item.wilayah}</td>
                  <td>${item.nama_pengirim}</td>
                  <td>${item.nama_penerima}</td>
                  <td class="text-right currency">${(item.ongkir || 0).toLocaleString('id-ID')}</td>
                  <td class="text-right font-medium">${(item.kg || 0).toLocaleString('id-ID')} kg</td>
                  <td class="text-right currency">${(item.adm || 0).toLocaleString('id-ID')}</td>
                  <td class="text-right currency">${(item.packing || 0).toLocaleString('id-ID')}</td>
                  <td class="text-right currency">${(item.transit || 0).toLocaleString('id-ID')}</td>
                  <td class="text-right total-currency">${(item.tot_ongkir || 0).toLocaleString('id-ID')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="summary-section">
            <div class="summary-title">SUMMARY</div>
            
            <div class="summary-grid">
              <div class="summary-item">
                <div class="summary-label">Total Weight</div>
                <div class="summary-value">${(outstandingData.reduce((sum, item) => sum + (item.kg || 0), 0)).toLocaleString('id-ID')} kg</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Admin Fees</div>
                <div class="summary-value">Rp ${(outstandingData.reduce((sum, item) => sum + (item.adm || 0), 0)).toLocaleString('id-ID')}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Packaging</div>
                <div class="summary-value">Rp ${(outstandingData.reduce((sum, item) => sum + (item.packing || 0), 0)).toLocaleString('id-ID')}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Transit Costs</div>
                <div class="summary-value">Rp ${(outstandingData.reduce((sum, item) => sum + (item.transit || 0), 0)).toLocaleString('id-ID')}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Base Shipping</div>
                <div class="summary-value">Rp ${(outstandingData.reduce((sum, item) => sum + (item.ongkir || 0), 0)).toLocaleString('id-ID')}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Total Shipments</div>
                <div class="summary-value">${outstandingData.length} AWB</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Avg. per AWB</div>
                <div class="summary-value">Rp ${outstandingData.length > 0 ? Math.round((outstandingData.reduce((sum, item) => sum + (item.tot_ongkir || 0), 0)) / outstandingData.length).toLocaleString('id-ID') : '0'}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Processing Date</div>
                <div class="summary-value">${new Date().toLocaleDateString('en-GB')}</div>
              </div>
            </div>
            
            <div class="grand-total-section">
              <div class="grand-total-label">TOTAL OUTSTANDING</div>
              <div class="grand-total-value">Rp ${(outstandingData.reduce((sum, item) => sum + (item.tot_ongkir || 0), 0)).toLocaleString('id-ID')}</div>
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
  }

  return (
    <div className="p-4 dark:bg-gray-900 dark:text-gray-100 min-h-screen">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-blue-900 dark:text-blue-100 mb-4">Outstanding Report</h2>
        
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Agent/Customer</label>
            <select
              className="w-full border rounded-md px-3 py-2 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 focus:ring-blue-500 focus:border-blue-500"
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
            >
              <option value="">All Agents</option>
              {currentAgentList.map((agent) => (
                <option key={agent} value={agent}>
                  {agent}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
            <input
              type="date"
              className="w-full border rounded-md px-3 py-2 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 focus:ring-blue-500 focus:border-blue-500"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
            <input
              type="date"
              className="w-full border rounded-md px-3 py-2 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 focus:ring-blue-500 focus:border-blue-500"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 mb-4">
          <button
            onClick={handleDownloadXLSX}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 mr-2 flex items-center gap-2"
          >
            <FaDownload /> Download XLSX
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 flex items-center gap-2"
          >
            <FaPrint /> Print
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 border-collapse dark:bg-gray-800 dark:border-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-2 text-left border border-gray-300 dark:border-gray-600 dark:text-gray-200">No</th>
                <th className="px-4 py-2 text-left border border-gray-300 dark:border-gray-600 dark:text-gray-200">Awb</th>
                <th className="px-4 py-2 text-left border border-gray-300 dark:border-gray-600 dark:text-gray-200">Tgl</th>
                <th className="px-4 py-2 text-left border border-gray-300 dark:border-gray-600 dark:text-gray-200">Wilayah</th>
                <th className="px-4 py-2 text-left border border-gray-300 dark:border-gray-600 dark:text-gray-200">Pengirim</th>
                <th className="px-4 py-2 text-left border border-gray-300 dark:border-gray-600 dark:text-gray-200">Penerima</th>
                <th className="px-4 py-2 text-right border border-gray-300 dark:border-gray-600 dark:text-gray-200">Ongkir</th>
                <th className="px-4 py-2 text-right border border-gray-300 dark:border-gray-600 dark:text-gray-200">Kg</th>
                <th className="px-4 py-2 text-right border border-gray-300 dark:border-gray-600 dark:text-gray-200">Adm</th>
                <th className="px-4 py-2 text-right border border-gray-300 dark:border-gray-600 dark:text-gray-200">Packing</th>
                <th className="px-4 py-2 text-right border border-gray-300 dark:border-gray-600 dark:text-gray-200">Transit</th>
                <th className="px-4 py-2 text-right border border-gray-300 dark:border-gray-600 dark:text-gray-200">Total Ongkir</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="12" className="px-4 py-2 text-center border border-gray-300 dark:border-gray-600 dark:text-gray-300">
                    Loading...
                  </td>
                </tr>
              ) : outstandingData.length === 0 ? (
                <tr>
                  <td colSpan="12" className="px-4 py-2 text-center border border-gray-300 dark:border-gray-600 dark:text-gray-300">
                    No outstanding data found
                  </td>
                </tr>
              ) : (
                outstandingData.map((item, index) => (
                  <tr key={item.awb_no} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 dark:text-gray-300">{index + 1}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 dark:text-gray-300">{item.awb_no}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 dark:text-gray-300">{item.awb_date}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 dark:text-gray-300">{item.wilayah}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 dark:text-gray-300">{item.nama_pengirim}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 dark:text-gray-300">{item.nama_penerima}</td>
                    <td className="px-4 py-2 text-right border border-gray-300 dark:border-gray-600 dark:text-gray-300">Rp. {(item.ongkir || 0).toLocaleString('en-US')}</td>
                    <td className="px-4 py-2 text-right border border-gray-300 dark:border-gray-600 dark:text-gray-300">{(item.kg || 0).toLocaleString('en-US')}</td>
                    <td className="px-4 py-2 text-right border border-gray-300 dark:border-gray-600 dark:text-gray-300">Rp. {(item.adm || 0).toLocaleString('en-US')}</td>
                    <td className="px-4 py-2 text-right border border-gray-300 dark:border-gray-600 dark:text-gray-300">Rp. {(item.packing || 0).toLocaleString('en-US')}</td>
                    <td className="px-4 py-2 text-right border border-gray-300 dark:border-gray-600 dark:text-gray-300">Rp. {(item.transit || 0).toLocaleString('en-US')}</td>
                    <td className="px-4 py-2 text-right font-bold border border-gray-300 dark:border-gray-600 dark:text-green-400">Rp. {(item.tot_ongkir || 0).toLocaleString('en-US')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {outstandingData.length > 0 && (
          <div className="mt-4 p-4 bg-blue-50 rounded border border-blue-200 flex flex-row flex-wrap items-center gap-4 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-200">
            <h3 className="text-sm font-semibold">Total:</h3>
            <p>Total Kg: {outstandingData.reduce((sum, item) => sum + (item.kg || 0), 0).toLocaleString('en-US')}</p>
            <p>Total Adm: Rp. {outstandingData.reduce((sum, item) => sum + (item.adm || 0), 0).toLocaleString('en-US')}</p>
            <p>Total Packing: Rp. {outstandingData.reduce((sum, item) => sum + (item.packing || 0), 0).toLocaleString('en-US')}</p>
            <p>Total Transit: Rp. {outstandingData.reduce((sum, item) => sum + (item.transit || 0), 0).toLocaleString('en-US')}</p>
            <p>Grand Total Ongkir: Rp. {outstandingData.reduce((sum, item) => sum + (item.tot_ongkir || 0), 0).toLocaleString('en-US')}</p>
          </div>
        )}
      </div>
    </div>
  )
} 