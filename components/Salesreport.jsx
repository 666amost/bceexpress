"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { supabaseClient } from '../lib/auth';  // Ganti impor ini
import { createStyledExcelWithHTML } from '../lib/excel-utils';
import { getEnhancedAgentList, doesAgentMatch, getAllAgentIdentifiers } from '../lib/agent-mapping';

const SalesReport = ({ userRole, branchOrigin }) => {
  // ================== BRANCH / ROLE SWITCH ==================
  const BRANCH_USING_CABANG_TABLE = ["bangka", "tanjung_pandan"]; // tambah branch lain bila perlu
  const isBranchMode =
    (userRole === "cabang" && BRANCH_USING_CABANG_TABLE.includes(branchOrigin)) ||
    (userRole === "admin" && BRANCH_USING_CABANG_TABLE.includes(branchOrigin));
  // ===========================================================

  const [agent, setAgent] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agentList, setAgentList] = useState([]);

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
  ];

  const baseAgentListTanjungPandan = [
    "COD",
    "TRANSFER",
    "CASH",
    "Wijaya Crab"
  ];

  const baseAgentListCentral = [
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

  // Enhanced agent lists with email mappings
  const agentListBangka = getEnhancedAgentList(baseAgentListBangka);
  const agentListTanjungPandan = getEnhancedAgentList(baseAgentListTanjungPandan);
  const agentListCentral = getEnhancedAgentList(baseAgentListCentral);

  const currentAgentList = isBranchMode 
    ? (branchOrigin === 'bangka' ? agentListBangka : agentListTanjungPandan) 
    : agentListCentral;

  const kotaTujuan = isBranchMode
    ? branchOrigin === 'bangka' 
        ? ["JAKARTA BARAT", "JAKARTA PUSAT", "JAKARTA SELATAN", "JAKARTA TIMUR", "JAKARTA UTARA", "TANGERANG", "TANGERANG SELATAN", "TANGERANG KABUPATEN", "BEKASI KOTA", "BEKASI KABUPATEN", "DEPOK", "BOGOR KOTA", "BOGOR KABUPATEN"]
        : ["jakarta", "tangerang", "bekasi", "depok", "bogor"]
    : ["bangka", "kalimantan barat", "belitung", "bali"];

  useEffect(() => {
    fetchAgents();
    fetchData();
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Tambahkan useEffect untuk mengambil daftar agen saat komponen dimuat
  useEffect(() => {
    fetchAgentsForSalesReport();
  }, [userRole, branchOrigin]) // eslint-disable-line react-hooks/exhaustive-deps

  // Tambahkan fungsi untuk mengambil daftar agen (mirip dengan OutstandingReport)
  async function fetchAgentsForSalesReport() {
    try {
      let query;
      if (isBranchMode) {
        query = supabaseClient
          .from("manifest_cabang")
          .select("agent_customer")
          .eq('origin_branch', branchOrigin);
      } else {
        query = supabaseClient
          .from("manifest")
          .select("agent_customer");
      }

      const { data, error } = await query;

      if (error) throw error;

      const distinctAgents = [...new Set(data.map(item => item.agent_customer).filter(Boolean))];
      setAgentList(distinctAgents);
    } catch (err) {
      // Silently handle fetch error
    }
  }

  const fetchAgents = async () => {
    try {
      let query = supabaseClient.from("manifest").select("agent_customer");
      const { data, error } = await query;
      if (error) throw error;
      const distinctAgents = [...new Set(data.map(item => item.agent_customer).filter(Boolean))];
      setAgentList(distinctAgents);
    } catch (err) {
      setError("Failed to fetch agents");
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      // Branch mode: query cabang tables, Central mode: query central tables
      let query;
      if (isBranchMode) {
        query = supabaseClient
          .from('manifest_cabang')
          .select('*')
          .eq('origin_branch', branchOrigin)
          .order('awb_date', { ascending: false })
      } else {
        // Central users query central table without any filtering
        query = supabaseClient
          .from('manifest')
          .select('*')
          .order('awb_date', { ascending: false })
      }
      
      const { data: manifestData, error } = await query
      if (error) {
        setError(`Error fetching data: ${error.message || 'Unknown error'}`);
      } else {
        setData(manifestData || []);
      }
    } catch (err) {
      setError(`Unexpected error: ${err.message || 'Please check connection'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    if (!agent && !fromDate && !toDate) {
      alert('Please fill in at least one filter.');
      return;
    }

    const filtered = data.filter(item => {
      const matchesAgent = agent ? doesAgentMatch(item.agent_customer, agent) : true;  // Use enhanced agent matching
      const matchesDateRange = fromDate && toDate ? new Date(item.awb_date) >= new Date(fromDate) && new Date(item.awb_date) <= new Date(toDate) : true;
      return matchesAgent && matchesDateRange;
    });

    // Map data agar kolom Harga (Ongkir) dan Total benar
    const mapped = filtered.map(item => {
      // Harga (Ongkir) ambil dari field harga_per_kg
      const hargaOngkir = item.harga_per_kg || 0;
      const berat = item.berat_kg || 0;
      const adm = item.biaya_admin || 0;
      const packing = item.biaya_packaging || 0;
      // Total = (Kg x Harga Ongkir) + Admin + Packaging
      const total = (berat * hargaOngkir) + adm + packing;
      return {
        ...item,
        harga_ongkir: hargaOngkir,
        total_fix: total
      }
    });

    const uniqueData = Array.from(new Set(mapped.map(item => item.awb_no))).map(awb_no => 
      mapped.find(item => item.awb_no === awb_no)
    );
    setFilteredData(uniqueData);
  };

  const downloadXLSX = () => {
    if (filteredData.length === 0) {
      alert('No data to download');
      return;
    }

    // Dynamic header based on branch - use Kecamatan for Bangka branch
    const destinationHeader = (isBranchMode && branchOrigin === 'bangka') ? 'Kecamatan' : 'Tujuan';
    
    const headers = [
      'AWB (awb_no)',
      'Tgl AWB',
      destinationHeader,
      'Via Pengiriman',
      'Pengirim',
      'Penerima',
      'Kg',
      'Harga (Ongkir)',
      'Admin',
      'Packaging',
      'Total'
    ]

    const formattedData = filteredData.map(item => {
      const destinationValue = (isBranchMode && branchOrigin === 'bangka') ? item.kecamatan : item.kota_tujuan;
      return {
        'AWB (awb_no)': item.awb_no,
        'Tgl AWB': item.awb_date,
        [destinationHeader]: destinationValue,
        'Via Pengiriman': item.kirim_via,
        'Pengirim': item.nama_pengirim,
        'Penerima': item.nama_penerima,
        'Kg': item.berat_kg,
        'Harga (Ongkir)': item.harga_ongkir,
        'Admin': item.biaya_admin,
        'Packaging': item.biaya_packaging,
        'Total': item.total_fix
      }
    })

    const today = new Date().toLocaleDateString('id-ID', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })

    // Create date range string if filters are applied
    let dateRange = ''
    if (fromDate || toDate) {
      if (fromDate && toDate) {
        // Convert YYYY-MM-DD to DD-MM-YYYY format
        const fromFormatted = fromDate.split('-').reverse().join('-')
        const toFormatted = toDate.split('-').reverse().join('-')
        dateRange = `${fromFormatted} s/d ${toFormatted}`
      } else if (fromDate) {
        const fromFormatted = fromDate.split('-').reverse().join('-')
        dateRange = `Dari ${fromFormatted}`
      } else if (toDate) {
        const toFormatted = toDate.split('-').reverse().join('-')
        dateRange = `Sampai ${toFormatted}`
      }
    }
    if (agent) {
      dateRange = dateRange ? `${dateRange} - ${agent}` : agent
    }

    createStyledExcelWithHTML({
      title: 'Sales Report',
      headers,
      data: formattedData,
      fileName: `sales_report_${today.replace(/\s+/g, '_')}.xls`,
      currency: 'Rp',
      currencyColumns: [7, 8, 9, 10], // Harga, Admin, Packaging, Total
      numberColumns: [6], // Kg
      dateRange: dateRange
    })
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Popup diblokir. Mohon izinkan popup di browser Anda.')
      return
    }

    // Dynamic header and field based on branch - use Kecamatan for Bangka branch
    const destinationHeader = (isBranchMode && branchOrigin === 'bangka') ? 'KECAMATAN' : 'DESTINATION';
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Sales Report</title>
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
                <div><strong>Document ID:</strong> SLS-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}</div>
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
              <div class="report-title">SALES REPORT${agent ? ` - ${agent}` : ''}</div>
              <div class="report-subtitle">Laporan Penjualan Detail</div>
            </div>
          </div>
          
          <div class="report-parameters">
            <div class="param-group">
              <div class="param-item">
                <span class="param-label">PERIOD:</span>
                <span class="param-value">${fromDate && toDate ? `${new Date(fromDate).toLocaleDateString('en-GB')} - ${new Date(toDate).toLocaleDateString('en-GB')}` : 'ALL PERIODS'}</span>
              </div>
              ${agent ? `
              <div class="param-item">
                <span class="param-label">AGENT:</span>
                <span class="param-value">${agent}</span>
              </div>
              ` : ''}
            </div>
            <div class="param-item">
              <span class="param-label">TOTAL RECORDS:</span>
              <span class="param-value">${filteredData.length}</span>
            </div>
          </div>
          
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 4%;">#</th>
                <th style="width: 12%;">AWB NUMBER</th>
                <th style="width: 9%;">DATE</th>
                <th style="width: 11%;">${destinationHeader}</th>
                <th style="width: 8%;">VIA</th>
                <th style="width: 15%;">SENDER</th>
                <th style="width: 15%;">RECIPIENT</th>
                <th class="text-right" style="width: 6%;">WEIGHT</th>
                <th class="text-right" style="width: 8%;">RATE</th>
                <th class="text-right" style="width: 6%;">ADMIN</th>
                <th class="text-right" style="width: 6%;">PACK</th>
                <th class="text-right" style="width: 10%;">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${filteredData.map((item, index) => `
                <tr>
                  <td class="text-center font-medium">${index + 1}</td>
                  <td class="awb-number">${item.awb_no}</td>
                  <td class="font-medium">${new Date(item.awb_date).toLocaleDateString('en-GB')}</td>
                  <td class="font-medium">${(isBranchMode && branchOrigin === 'bangka') ? item.kecamatan : item.kota_tujuan}</td>
                  <td class="text-center font-medium">${item.kirim_via.toUpperCase()}</td>
                  <td>${item.nama_pengirim}</td>
                  <td>${item.nama_penerima}</td>
                  <td class="text-right font-medium">${(item.berat_kg || 0).toLocaleString('id-ID')} kg</td>
                  <td class="text-right currency">${(item.harga_ongkir || 0).toLocaleString('id-ID')}</td>
                  <td class="text-right currency">${(item.biaya_admin || 0).toLocaleString('id-ID')}</td>
                  <td class="text-right currency">${(item.biaya_packaging || 0).toLocaleString('id-ID')}</td>
                  <td class="text-right total-currency">${(item.total_fix || 0).toLocaleString('id-ID')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="summary-section">
            <div class="summary-title">SUMMARY</div>
            
            <div class="summary-grid">
              <div class="summary-item">
                <div class="summary-label">Total Weight</div>
                <div class="summary-value">${filteredData.reduce((sum, item) => sum + (item.berat_kg || 0), 0).toLocaleString('id-ID')} kg</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Shipping Rates</div>
                <div class="summary-value">Rp ${filteredData.reduce((sum, item) => sum + (item.harga_ongkir || 0), 0).toLocaleString('id-ID')}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Admin Fees</div>
                <div class="summary-value">Rp ${filteredData.reduce((sum, item) => sum + (item.biaya_admin || 0), 0).toLocaleString('id-ID')}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Packaging</div>
                <div class="summary-value">Rp ${filteredData.reduce((sum, item) => sum + (item.biaya_packaging || 0), 0).toLocaleString('id-ID')}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Total Shipments</div>
                <div class="summary-value">${filteredData.length} AWB</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Avg. per AWB</div>
                <div class="summary-value">Rp ${filteredData.length > 0 ? Math.round(filteredData.reduce((sum, item) => sum + (item.total_fix || 0), 0) / filteredData.length).toLocaleString('id-ID') : '0'}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Avg. Weight</div>
                <div class="summary-value">${filteredData.length > 0 ? Math.round(filteredData.reduce((sum, item) => sum + (item.berat_kg || 0), 0) / filteredData.length).toLocaleString('id-ID') : '0'} kg</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Report Date</div>
                <div class="summary-value">${new Date().toLocaleDateString('en-GB')}</div>
              </div>
            </div>
            
            <div class="grand-total-section">
              <div class="grand-total-label">TOTAL SALES</div>
              <div class="grand-total-value">Rp ${filteredData.reduce((sum, item) => sum + (item.total_fix || 0), 0).toLocaleString('id-ID')}</div>
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
    <div className="p-4 dark:bg-gray-900 dark:text-gray-100 min-h-screen">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200">Sale Report</h2>
      <div className="mb-4 no-print">
        <label className="block mb-2 text-gray-700 dark:text-gray-300">Filter Agent:</label>
        <select
          value={agent}
          onChange={(e) => setAgent(e.target.value)}
          className="border p-2 w-full rounded-md dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Semua</option>
          {currentAgentList.map((agentOption) => (
            <option key={agentOption} value={agentOption}>
              {agentOption}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-4 no-print">
        <label className="block mb-2 text-gray-700 dark:text-gray-300">Dari tanggal:</label>
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="border p-2 w-full rounded-md dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 focus:ring-blue-500 focus:border-blue-500" />
      </div>
      <div className="mb-4 no-print">
        <label className="block mb-2 text-gray-700 dark:text-gray-300">Sampai tanggal:</label>
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="border p-2 w-full rounded-md dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 focus:ring-blue-500 focus:border-blue-500" />
      </div>
      <button onClick={handleFilter} className="bg-blue-600 text-white px-4 py-2 rounded no-print hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800">Filter</button>
      
      {filteredData.length > 0 && (
        <div className="mb-4 flex justify-end gap-2 no-print">
          <button onClick={downloadXLSX} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800">Download XLSX</button>
          <button onClick={handlePrint} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800">Print</button>
        </div>
      )}
      
      {filteredData.length > 0 && (
        <table className="mt-4 w-full border-collapse border border-gray-300 dark:border-gray-600 dark:text-gray-200">
          <thead>
            <tr>
              <th className="border p-2 text-left dark:border-gray-600 dark:text-gray-200">No</th>
              <th className="border p-2 text-left dark:border-gray-600 dark:text-gray-200">AWB (awb_no)</th>
              <th className="border p-2 text-left dark:border-gray-600 dark:text-gray-200">Tgl AWB</th>
              <th className="border p-2 text-left dark:border-gray-600 dark:text-gray-200">{(isBranchMode && branchOrigin === 'bangka') ? 'Kecamatan' : 'Tujuan'}</th>
              <th className="border p-2 text-left dark:border-gray-600 dark:text-gray-200">Via Pengiriman</th>
              <th className="border p-2 text-left dark:border-gray-600 dark:text-gray-200">Pengirim</th>
              <th className="border p-2 text-left dark:border-gray-600 dark:text-gray-200">Penerima</th>
              <th className="border p-2 text-right dark:border-gray-600 dark:text-gray-200">Kg</th>
              <th className="border p-2 text-right dark:border-gray-600 dark:text-gray-200">Harga (Ongkir)</th>
              <th className="border p-2 text-right dark:border-gray-600 dark:text-gray-200">Admin</th>
              <th className="border p-2 text-right dark:border-gray-600 dark:text-gray-200">Packaging</th>
              <th className="border p-2 text-right dark:border-gray-600 dark:text-gray-200">Total</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, index) => (
              <tr key={item.awb_no} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300">
                <td className="border p-2 dark:border-gray-600">{index + 1}</td>
                <td className="border p-2 dark:border-gray-600">{item.awb_no}</td>
                <td className="border p-2 dark:border-gray-600">{item.awb_date}</td>
                <td className="border p-2 dark:border-gray-600">{(isBranchMode && branchOrigin === 'bangka') ? item.kecamatan : item.kota_tujuan}</td>
                <td className="border p-2 dark:border-gray-600">{item.kirim_via}</td>
                <td className="border p-2 dark:border-gray-600">{item.nama_pengirim}</td>
                <td className="border p-2 dark:border-gray-600">{item.nama_penerima}</td>
                <td className="border p-2 text-right dark:border-gray-600">{item.berat_kg}</td>
                <td className="border p-2 text-right dark:border-gray-600">{item.harga_ongkir}</td>
                <td className="border p-2 text-right dark:border-gray-600">{item.biaya_admin}</td>
                <td className="border p-2 text-right dark:border-gray-600">{item.biaya_packaging}</td>
                <td className="border p-2 text-right font-bold dark:border-gray-600 dark:text-green-400">{item.total_fix}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {filteredData.length > 0 && (
        <div className="mt-4 p-4 bg-blue-50 rounded border border-blue-200 flex flex-row flex-wrap items-center gap-4 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-200">
          <h3 className="text-sm font-semibold">Total:</h3>
          <p className="dark:text-gray-300">Total Kg: {filteredData.reduce((sum, item) => sum + (item.berat_kg || 0), 0).toLocaleString('en-US')}</p>
          <p className="dark:text-gray-300">Total Harga (Ongkir): Rp. {filteredData.reduce((sum, item) => sum + (item.harga_ongkir || 0), 0).toLocaleString('en-US')}</p>
          <p className="dark:text-gray-300">Total Admin: Rp. {filteredData.reduce((sum, item) => sum + (item.biaya_admin || 0), 0).toLocaleString('en-US')}</p>
          <p className="dark:text-gray-300">Total Packaging: Rp. {filteredData.reduce((sum, item) => sum + (item.biaya_packaging || 0), 0).toLocaleString('en-US')}</p>
          <p className="dark:text-gray-300">Total Keseluruhan: Rp. {filteredData.reduce((sum, item) => sum + (item.total_fix || 0), 0).toLocaleString('en-US')}</p>
        </div>
      )}
      {loading && <p className="dark:text-gray-300">Loading data...</p>}
      {error && <p className="text-red-500 dark:text-red-300">{error}</p>}
    </div>
  );
};

export default SalesReport;
