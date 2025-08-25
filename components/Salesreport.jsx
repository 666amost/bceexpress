"use client"

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabaseClient } from '../lib/auth';  // Ganti impor ini
import { createStyledExcelWithHTML } from '../lib/excel-utils';
import { getEnhancedAgentList, doesAgentMatch, getAllAgentIdentifiers, getAgentForEmail } from '../lib/agent-mapping';
import * as XLSX from 'xlsx';
import { baseAgentListBangka, baseAgentListTanjungPandan, baseAgentListCentral } from '../lib/agents';

const SalesReport = ({ userRole, branchOrigin }) => {
  // ================== BRANCH / ROLE SWITCH ==================
  const BRANCH_USING_CABANG_TABLE = ["bangka", "tanjung_pandan"]; // tambah branch lain bila perlu
  // normalize branchOrigin for consistent comparisons / DB queries
  const normalizedBranchOrigin = (branchOrigin || '').toString().toLowerCase().trim();
  const isBranchMode =
    (userRole === "cabang" && BRANCH_USING_CABANG_TABLE.includes(normalizedBranchOrigin)) ||
    (userRole === "admin" && BRANCH_USING_CABANG_TABLE.includes(normalizedBranchOrigin));
  // ===========================================================

  const [agent, setAgent] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [collapsedAgents, setCollapsedAgents] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agentList, setAgentList] = useState([]);

  // Enhanced agent lists with email mappings
  const agentListBangka = getEnhancedAgentList(baseAgentListBangka);
  const agentListTanjungPandan = getEnhancedAgentList(baseAgentListTanjungPandan);
  const agentListCentral = getEnhancedAgentList(baseAgentListCentral);

  const currentAgentList = isBranchMode 
    ? (branchOrigin === 'bangka' ? agentListBangka : agentListTanjungPandan) 
    : agentListCentral;

  const kotaTujuan = isBranchMode
  ? normalizedBranchOrigin === 'bangka' 
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
          .eq('origin_branch', normalizedBranchOrigin);
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
          .eq('origin_branch', normalizedBranchOrigin)
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
      const transit = item.biaya_transit || 0;
      // Total = (Kg x Harga Ongkir) + Admin + Packaging + Transit
      const total = (berat * hargaOngkir) + adm + packing + transit;
      return {
        ...item,
        harga_ongkir: hargaOngkir,
        biaya_transit: transit,
        total_fix: total
      }
    });

    const uniqueData = Array.from(new Set(mapped.map(item => item.awb_no))).map(awb_no => 
      mapped.find(item => item.awb_no === awb_no)
    );
    setFilteredData(uniqueData);
  };

  // Group filtered data by agent_customer for clearer UI
  const groupedByAgent = useMemo(() => {
    const groups = {};
    for (const item of filteredData) {
      // Normalize agent key: map emails to agent name when possible
      const mapped = getAgentForEmail(item.agent_customer || '') || item.agent_customer || 'UNKNOWN';
      const key = mapped;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    // Sort agents alphabetically for predictable order
    const ordered = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'id')).reduce((acc, k) => {
      acc[k] = groups[k];
      return acc;
    }, {});
    return ordered;
  }, [filteredData]);

  const toggleAgentCollapse = useCallback((agentKey) => {
    setCollapsedAgents(prev => {
      const next = { ...prev, [agentKey]: !prev[agentKey] };
      try { localStorage.setItem('salesreport_collapsed_agents', JSON.stringify(next)); } catch (e) { /* ignore */ }
      return next;
    });
  }, []);

  // Load persisted collapse state on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('salesreport_collapsed_agents');
      if (raw) {
        const parsed = JSON.parse(raw);
        setCollapsedAgents(parsed || {});
      }
    } catch (e) { /* ignore */ }
  }, []);

  // Helper to sanitize sheet names for Excel
  const sanitizeSheetName = (name) => {
    if (!name) return 'Sheet';
    const invalid = /[\\\/\?\*\[\]:]/g;
    let s = name.replace(invalid, ' - ');
    if (s.length > 31) s = s.substring(0, 31);
    return s;
  };

  // New: export one sheet per agent
  const downloadXLSXPerAgent = () => {
    if (filteredData.length === 0) { alert('No data to download'); return; }
    const destinationHeader = (isBranchMode && branchOrigin === 'bangka') ? 'Kecamatan' : 'Tujuan';
    const wb = XLSX.utils.book_new();

    Object.keys(groupedByAgent).forEach(agentKey => {
      const rows = groupedByAgent[agentKey];
      const sheetData = [];
  // header row (added Transit column)
  sheetData.push(['No', 'AWB (awb_no)', 'Tgl AWB', destinationHeader, 'Via Pengiriman', 'Pengirim', 'Penerima', 'Kg', 'Harga (Ongkir)', 'Admin', 'Packaging', 'Transit', 'Total']);

      rows.forEach((item, idx) => {
        const dest = (isBranchMode && branchOrigin === 'bangka') ? item.kecamatan : item.kota_tujuan;
        sheetData.push([
          idx + 1,
          item.awb_no || '',
          item.awb_date || '',
          dest || '',
          item.kirim_via || '',
          item.nama_pengirim || '',
          item.nama_penerima || '',
          Number(item.berat_kg || 0),
          Number(item.harga_ongkir || 0),
          Number(item.biaya_admin || 0),
          Number(item.biaya_packaging || 0),
          Number(item.biaya_transit || 0),
          Number(item.total_fix || 0)
        ]);
      });

      // subtotal
      const subtotal = rows.reduce((s, it) => ({
        berat: s.berat + (it.berat_kg || 0),
        total: s.total + (it.total_fix || 0)
      }), { berat: 0, total: 0 });
  sheetData.push([]);
  // Adjusted subtotal placement to account for Transit column (total is at index 12)
  sheetData.push(['', '', '', '', '', '', 'SUBTOTAL', subtotal.berat, '', '', '', '', subtotal.total]);

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      // Keep raw values (no visual formatting) but ensure numeric cells are numeric
      try {
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r + 1; R <= range.e.r; ++R) {
          // Kg column (c=7) - number
          const kgCell = XLSX.utils.encode_cell({ r: R, c: 7 });
          if (ws[kgCell]) {
            const v = ws[kgCell].v;
            ws[kgCell].t = 'n';
            ws[kgCell].v = typeof v === 'number' ? v : Number(String(v).replace(',', '.')) || 0;
          }

          // Currency columns (c=8,9,10,11,12) - store as raw numbers (no currency formatting)
          [8, 9, 10, 11, 12].forEach(c => {
            const addr = XLSX.utils.encode_cell({ r: R, c });
            if (ws[addr]) {
              const val = ws[addr].v;
              ws[addr].t = 'n';
              ws[addr].v = typeof val === 'number' ? val : Number(String(val).replace(/[^0-9.\-]/g, '')) || 0;
            }
          });
        }
      } catch (err) { /* ignore formatting errors */ }

      const sheetName = sanitizeSheetName(agentKey || 'Agent');
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    const today = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
    const fileName = `sales_report_${today.replace(/\s+/g, '_')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const downloadXLSX = () => {
    if (filteredData.length === 0) {
      alert('No data to download');
      return;
    }

    // Dynamic header based on branch - use Kecamatan for Bangka branch
    const destinationHeader = (isBranchMode && branchOrigin === 'bangka') ? 'Kecamatan' : 'Tujuan';
    // add Agent column and group rows by agent for clearer export
    const headers = [
      'Agent',
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
      'Transit',
      'Total'
    ]

    const formattedData = [];
    Object.keys(groupedByAgent).forEach(agentKey => {
      const rows = groupedByAgent[agentKey];
      // Agent header row
      formattedData.push({
        'Agent': agentKey,
        'AWB (awb_no)': '',
        'Tgl AWB': '',
        [destinationHeader]: '',
        'Via Pengiriman': '',
        'Pengirim': '',
        'Penerima': '',
        'Kg': '',
        'Harga (Ongkir)': '',
        'Admin': '',
        'Packaging': '',
        'Total': ''
      });

    rows.forEach(item => {
        const destinationValue = (isBranchMode && branchOrigin === 'bangka') ? item.kecamatan : item.kota_tujuan;
        formattedData.push({
          'Agent': '',
          'AWB (awb_no)': item.awb_no,
          'Tgl AWB': item.awb_date,
          [destinationHeader]: destinationValue,
          'Via Pengiriman': item.kirim_via,
          'Pengirim': item.nama_pengirim,
          'Penerima': item.nama_penerima,
          'Kg': item.berat_kg || 0,
          'Harga (Ongkir)': item.harga_ongkir || 0,
          'Admin': item.biaya_admin || 0,
      'Packaging': item.biaya_packaging || 0,
      'Transit': item.biaya_transit || 0,
      'Total': item.total_fix || 0
        });
      });

      // subtotal row for agent
      // subtotal row for agent (include Transit in calculation)
      const subtotal = rows.reduce((s, it) => ({
        berat: s.berat + (it.berat_kg || 0),
        harga: s.harga + (it.harga_ongkir || 0),
        admin: s.admin + (it.biaya_admin || 0),
        pack: s.pack + (it.biaya_packaging || 0),
        transit: s.transit + (it.biaya_transit || 0),
        total: s.total + (it.total_fix || 0)
      }), { berat: 0, harga: 0, admin: 0, pack: 0, transit: 0, total: 0 });

      formattedData.push({
        'Agent': 'SUBTOTAL',
        'AWB (awb_no)': '',
        'Tgl AWB': '',
        [destinationHeader]: '',
        'Via Pengiriman': '',
        'Pengirim': '',
        'Penerima': '',
        'Kg': subtotal.berat,
        'Harga (Ongkir)': '',
        'Admin': '',
        'Packaging': '',
        'Transit': '',
        'Total': subtotal.total
      });

      // empty spacer row
      formattedData.push({
        'Agent': '',
        'AWB (awb_no)': '',
        'Tgl AWB': '',
        [destinationHeader]: '',
        'Via Pengiriman': '',
        'Pengirim': '',
        'Penerima': '',
        'Kg': '',
        'Harga (Ongkir)': '',
        'Admin': '',
        'Packaging': '',
        'Transit': '',
        'Total': ''
      });
    });

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
  // shifted indexes because we added 'Agent' column at start
  currencyColumns: [8, 9, 10, 11, 12], // Harga, Admin, Packaging, Transit, Total
  numberColumns: [7], // Kg
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
    // build grouped HTML for print (reuse CSS above)
    const groupedHtml = Object.keys(groupedByAgent).map(agentKey => {
      const rows = groupedByAgent[agentKey];
      const subtotal = rows.reduce((s, it) => ({
        berat: s.berat + (it.berat_kg || 0),
        harga: s.harga + (it.harga_ongkir || 0),
        admin: s.admin + (it.biaya_admin || 0),
        pack: s.pack + (it.biaya_packaging || 0),
        total: s.total + (it.total_fix || 0)
      }), { berat: 0, harga: 0, admin: 0, pack: 0, total: 0 });

    const rowsHtml = rows.map((item, idx) => `
        <tr>
          <td class="text-center font-medium">${idx + 1}</td>
          <td class="awb-number">${item.awb_no}</td>
          <td class="font-medium">${new Date(item.awb_date).toLocaleDateString('en-GB')}</td>
          <td class="font-medium">${(isBranchMode && branchOrigin === 'bangka') ? item.kecamatan : item.kota_tujuan}</td>
          <td class="text-center font-medium">${(item.kirim_via || '').toString().toUpperCase()}</td>
          <td>${item.nama_pengirim || ''}</td>
          <td>${item.nama_penerima || ''}</td>
          <td class="text-right font-medium">${(item.berat_kg || 0).toLocaleString('id-ID')} kg</td>
          <td class="text-right currency">${(item.harga_ongkir || 0).toLocaleString('id-ID')}</td>
          <td class="text-right currency">${(item.biaya_admin || 0).toLocaleString('id-ID')}</td>
      <td class="text-right currency">${(item.biaya_packaging || 0).toLocaleString('id-ID')}</td>
      <td class="text-right currency">${(item.biaya_transit || 0).toLocaleString('id-ID')}</td>
      <td class="text-right total-currency">${(item.total_fix || 0).toLocaleString('id-ID')}</td>
        </tr>
      `).join('');

      return `
        <div style="margin-bottom:18px; border:1px solid #e5e7eb;">
          <div style="padding:10px 14px; display:flex; justify-content:space-between; align-items:center; background:#f1f5f9;">
            <div style="font-weight:700; color:#1e40af;">${agentKey}</div>
            <div style="text-align:right;">
              <div style="font-size:12px;">${rows.length} AWB</div>
              <div style="font-weight:700; color:#1e40af;">Total: Rp ${subtotal.total.toLocaleString('id-ID')}</div>
            </div>
          </div>
          <table style="width:100%; border-collapse:collapse;">
            <thead>
          <tr style="background:#ffffff;">
                <th style="padding:8px; text-align:left; font-size:10px;">#</th>
                <th style="padding:8px; text-align:left; font-size:10px;">AWB</th>
                <th style="padding:8px; text-align:left; font-size:10px;">Date</th>
                <th style="padding:8px; text-align:left; font-size:10px;">${destinationHeader}</th>
                <th style="padding:8px; text-align:left; font-size:10px;">Via</th>
                <th style="padding:8px; text-align:left; font-size:10px;">Sender</th>
                <th style="padding:8px; text-align:left; font-size:10px;">Recipient</th>
                <th style="padding:8px; text-align:right; font-size:10px;">Kg</th>
                <th style="padding:8px; text-align:right; font-size:10px;">Rate</th>
                <th style="padding:8px; text-align:right; font-size:10px;">Admin</th>
            <th style="padding:8px; text-align:right; font-size:10px;">Pack</th>
            <th style="padding:8px; text-align:right; font-size:10px;">Transit</th>
            <th style="padding:8px; text-align:right; font-size:10px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      `;
    }).join('');

    // write the full document reusing previous CSS + groupedHtml inserted in body
    printWindow.document.write(`
      <html>
        <head>
          <title>Sales Report</title>
          <style>
            @page { margin: 20mm; size: A4; }
            body { font-family: 'Inter', Arial, sans-serif; font-size: 10px; color: #1f2937; }
            .document-header { border-bottom: 2px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 16px; }
            .company-name { font-size: 20px; font-weight:700; color:#1e40af }
            .report-title { font-size:18px; font-weight:600; text-align:center; margin:6px 0 10px }
            .report-parameters { background:#f8fafc; padding:10px; border:1px solid #e2e8f0; margin-bottom:12px }
            table { width:100%; border-collapse:collapse }
            th, td { padding:6px 8px; border-bottom:1px solid #eee; font-size:10px }
            .text-right { text-align:right }
            .summary-section { margin-top:16px }
          </style>
        </head>
        <body>
          <div class="document-header">
            <div class="company-name">BCE EXPRESS</div>
            <div style="text-align:center;">SALES REPORT${agent ? ` - ${agent}` : ''}</div>
          </div>
          <div class="report-parameters">
            <div>PERIOD: ${fromDate && toDate ? `${new Date(fromDate).toLocaleDateString('en-GB')} - ${new Date(toDate).toLocaleDateString('en-GB')}` : 'ALL PERIODS'}</div>
            ${agent ? `<div>AGENT: ${agent}</div>` : ''}
            <div>TOTAL RECORDS: ${filteredData.length}</div>
          </div>

          ${groupedHtml}

          <div class="summary-section" style="margin-top:16px; display:flex; justify-content:flex-end;">
            <div style="width:360px; background:linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border:1px solid #cbd5e1; padding:12px;">
              <div style="font-weight:600; margin-bottom:8px; text-align:center; text-transform:uppercase; color:#1e40af">SUMMARY</div>
              <table style="width:100%; border-collapse:collapse; font-size:11px;">
                <tr>
                  <td style="padding:6px 4px; color:#6b7280">Total Weight</td>
                  <td style="padding:6px 4px; text-align:right; font-weight:600">${filteredData.reduce((sum, item) => sum + (item.berat_kg || 0), 0).toLocaleString('id-ID')} kg</td>
                </tr>
                <tr>
                  <td style="padding:6px 4px; color:#6b7280">Total Shipping</td>
                  <td style="padding:6px 4px; text-align:right;">Rp ${filteredData.reduce((sum, item) => sum + (item.harga_ongkir || 0), 0).toLocaleString('id-ID')}</td>
                </tr>
                <tr>
                  <td style="padding:6px 4px; color:#6b7280">Total Admin</td>
                  <td style="padding:6px 4px; text-align:right;">Rp ${filteredData.reduce((sum, item) => sum + (item.biaya_admin || 0), 0).toLocaleString('id-ID')}</td>
                </tr>
                <tr>
                  <td style="padding:6px 4px; color:#6b7280">Total Packaging</td>
                  <td style="padding:6px 4px; text-align:right;">Rp ${filteredData.reduce((sum, item) => sum + (item.biaya_packaging || 0), 0).toLocaleString('id-ID')}</td>
                </tr>
                <tr>
                  <td style="padding:10px 4px; font-weight:700; border-top:1px solid #e5e7eb">TOTAL SALES</td>
                  <td style="padding:10px 4px; text-align:right; font-weight:700; border-top:1px solid #e5e7eb">Rp ${filteredData.reduce((sum, item) => sum + (item.total_fix || 0), 0).toLocaleString('id-ID')}</td>
                </tr>
              </table>
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
          <button onClick={downloadXLSXPerAgent} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800">Download per-Agent (sheets)</button>
          <button onClick={handlePrint} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800">Print</button>
        </div>
      )}
      
      {filteredData.length > 0 && (
        <div className="mt-4">
          {Object.keys(groupedByAgent).map((agentKey) => {
            const rows = groupedByAgent[agentKey];
            const subtotal = rows.reduce((s, it) => ({
              berat: s.berat + (it.berat_kg || 0),
              harga: s.harga + (it.harga_ongkir || 0),
              admin: s.admin + (it.biaya_admin || 0),
              pack: s.pack + (it.biaya_packaging || 0),
              transit: s.transit + (it.biaya_transit || 0),
              total: s.total + (it.total_fix || 0)
            }), { berat: 0, harga: 0, admin: 0, pack: 0, transit: 0, total: 0 });

            const isCollapsed = !!collapsedAgents[agentKey];
            return (
              <div key={agentKey} className="mb-6 border rounded-md bg-white dark:bg-gray-800 dark:border-gray-700">
                <div className="flex items-center justify-between p-3 border-b dark:border-gray-700">
                  <div>
                    <div className="text-sm font-semibold text-blue-700 dark:text-blue-300">{agentKey}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{rows.length} AWB</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right text-sm">
                      <div className="text-xs text-gray-500">Total Kg</div>
                      <div className="font-semibold">{subtotal.berat.toLocaleString('en-US')} kg</div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="text-xs text-gray-500">Total</div>
                      <div className="font-semibold text-green-600 dark:text-green-300">Rp. {subtotal.total.toLocaleString('en-US')}</div>
                    </div>
                    <button onClick={() => toggleAgentCollapse(agentKey)} className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm">
                      {isCollapsed ? 'Expand' : 'Collapse'}
                    </button>
                  </div>
                </div>

                {!isCollapsed && (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-900">
                        <th className="p-2 text-left text-xs">No</th>
                        <th className="p-2 text-left text-xs">AWB</th>
                        <th className="p-2 text-left text-xs">Tgl</th>
                        <th className="p-2 text-left text-xs">{(isBranchMode && branchOrigin === 'bangka') ? 'Kecamatan' : 'Tujuan'}</th>
                        <th className="p-2 text-left text-xs">Via</th>
                        <th className="p-2 text-left text-xs">Pengirim</th>
                        <th className="p-2 text-left text-xs">Penerima</th>
                        <th className="p-2 text-right text-xs">Kg</th>
                        <th className="p-2 text-right text-xs">Harga</th>
                        <th className="p-2 text-right text-xs">Admin</th>
                        <th className="p-2 text-right text-xs">Pack</th>
                        <th className="p-2 text-right text-xs">Transit</th>
                        <th className="p-2 text-right text-xs">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((item, i) => (
                        <tr key={item.awb_no + i} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="p-2 text-xs">{i + 1}</td>
                          <td className="p-2 text-xs">{item.awb_no}</td>
                          <td className="p-2 text-xs">{item.awb_date}</td>
                          <td className="p-2 text-xs">{(isBranchMode && branchOrigin === 'bangka') ? item.kecamatan : item.kota_tujuan}</td>
                          <td className="p-2 text-xs">{item.kirim_via}</td>
                          <td className="p-2 text-xs">{item.nama_pengirim}</td>
                          <td className="p-2 text-xs">{item.nama_penerima}</td>
                          <td className="p-2 text-right text-xs">{(item.berat_kg || 0).toLocaleString('en-US')}</td>
                          <td className="p-2 text-right text-xs">{(item.harga_ongkir || 0).toLocaleString('en-US')}</td>
                          <td className="p-2 text-right text-xs">{(item.biaya_admin || 0).toLocaleString('en-US')}</td>
                          <td className="p-2 text-right text-xs">{(item.biaya_packaging || 0).toLocaleString('en-US')}</td>
                          <td className="p-2 text-right text-xs">{(item.biaya_transit || 0).toLocaleString('en-US')}</td>
                          <td className="p-2 text-right text-xs font-semibold text-green-600 dark:text-green-300">{(item.total_fix || 0).toLocaleString('en-US')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })}
        </div>
      )}
      {filteredData.length > 0 && (
        <div className="mt-4 p-4 bg-blue-50 rounded border border-blue-200 flex flex-row flex-wrap items-center gap-4 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-200">
          <h3 className="text-sm font-semibold">Total:</h3>
          <p className="dark:text-gray-300">Total Kg: {filteredData.reduce((sum, item) => sum + (item.berat_kg || 0), 0).toLocaleString('en-US')}</p>
          <p className="dark:text-gray-300">Total Harga (Ongkir): Rp. {filteredData.reduce((sum, item) => sum + (item.harga_ongkir || 0), 0).toLocaleString('en-US')}</p>
          <p className="dark:text-gray-300">Total Admin: Rp. {filteredData.reduce((sum, item) => sum + (item.biaya_admin || 0), 0).toLocaleString('en-US')}</p>
          <p className="dark:text-gray-300">Total Packaging: Rp. {filteredData.reduce((sum, item) => sum + (item.biaya_packaging || 0), 0).toLocaleString('en-US')}</p>
          <p className="dark:text-gray-300">Total Transit: Rp. {filteredData.reduce((sum, item) => sum + (item.biaya_transit || 0), 0).toLocaleString('en-US')}</p>
          <p className="dark:text-gray-300">Total Keseluruhan: Rp. {filteredData.reduce((sum, item) => sum + (item.total_fix || 0), 0).toLocaleString('en-US')}</p>
        </div>
      )}
      {loading && <p className="dark:text-gray-300">Loading data...</p>}
      {error && <p className="text-red-500 dark:text-red-300">{error}</p>}
    </div>
  );
};

export default SalesReport;
