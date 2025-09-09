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
  const [currentUserName, setCurrentUserName] = useState('');

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

  // Fetch current logged-in user (for print footer)
  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        let user = null;
        if (supabaseClient.auth && typeof supabaseClient.auth.getUser === 'function') {
          const { data } = await supabaseClient.auth.getUser();
          user = data?.user;
        } else if (supabaseClient.auth && typeof supabaseClient.auth.user === 'function') {
          user = supabaseClient.auth.user();
        } else if (supabaseClient.auth && supabaseClient.auth.user) {
          user = supabaseClient.auth.user;
        }
        if (user) {
          let rawName = user.user_metadata?.full_name || user.user_metadata?.name || user.email || user.id || '';
          let displayName = rawName;
            if (rawName.includes('@')) displayName = rawName.split('@')[0];
            else if (rawName.trim().includes(' ')) displayName = rawName.trim().split(/\s+/)[0];
          setCurrentUserName(displayName);
        }
      } catch (e) {
        /* ignore */
      }
    }
    fetchCurrentUser();
  }, []);

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
    const printWindow = window.open('', '_blank');
    if (!printWindow) { alert('Popup diblokir. Mohon izinkan popup di browser Anda.'); return; }

    const destinationHeader = (isBranchMode && branchOrigin === 'bangka') ? 'KECAMATAN' : 'DESTINATION';

    const groupedHtml = Object.keys(groupedByAgent).map(agentKey => {
      const rows = groupedByAgent[agentKey];
      const subtotal = rows.reduce((s, it) => ({
        berat: s.berat + (it.berat_kg || 0),
        shipping: s.shipping + (it.harga_ongkir || 0),
        admin: s.admin + (it.biaya_admin || 0),
        pack: s.pack + (it.biaya_packaging || 0),
        transit: s.transit + (it.biaya_transit || 0),
        total: s.total + (it.total_fix || 0)
      }), { berat: 0, shipping: 0, admin: 0, pack: 0, transit: 0, total: 0 });

      const rowsHtml = rows.map((item, idx) => `
        <tr>
          <td class="text-center font-medium">${idx + 1}</td>
          <td class="awb-number">${item.awb_no}</td>
          <td class="font-medium">${new Date(item.awb_date).toLocaleDateString('en-GB')}</td>
          <td class="font-medium">${(isBranchMode && branchOrigin === 'bangka') ? (item.kecamatan || '') : (item.kota_tujuan || '')}</td>
          <td class="text-center font-medium">${(item.kirim_via || '').toString().toUpperCase()}</td>
          <td>${item.nama_pengirim || ''}</td>
          <td>${item.nama_penerima || ''}</td>
          <td class="text-right font-medium">${(item.berat_kg || 0).toLocaleString('id-ID')} kg</td>
          <td class="text-right currency">${(item.harga_ongkir || 0).toLocaleString('id-ID')}</td>
          <td class="text-right currency">${(item.biaya_admin || 0).toLocaleString('id-ID')}</td>
          <td class="text-right currency">${(item.biaya_packaging || 0).toLocaleString('id-ID')}</td>
          <td class="text-right currency">${(item.biaya_transit || 0).toLocaleString('id-ID')}</td>
          <td class="text-right total-currency">${(item.total_fix || 0).toLocaleString('id-ID')}</td>
        </tr>`).join('');

      return `
      <section class="agent-section">
        <div class="agent-header">
          <div class="agent-name">${agentKey}</div>
          <div class="agent-metrics">
            <div class="metric"><span class="metric-label">Shipments</span><span class="metric-value">${rows.length} AWB</span></div>
            <div class="metric"><span class="metric-label">Subtotal</span><span class="metric-value">Rp ${subtotal.total.toLocaleString('id-ID')}</span></div>
          </div>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>AWB</th>
              <th>Date</th>
              <th>${destinationHeader}</th>
              <th>Via</th>
              <th>Sender</th>
              <th>Recipient</th>
              <th class="text-right">Kg</th>
              <th class="text-right">Rate</th>
              <th class="text-right">Admin</th>
              <th class="text-right">Pack</th>
              <th class="text-right">Transit</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr class="subtotal-row">
              <td colspan="7" class="text-right subtotal-label">SUBTOTAL</td>
              <td class="text-right font-medium">${subtotal.berat.toLocaleString('id-ID')} kg</td>
              <td class="text-right font-medium">${subtotal.shipping.toLocaleString('id-ID')}</td>
              <td class="text-right font-medium">${subtotal.admin.toLocaleString('id-ID')}</td>
              <td class="text-right font-medium">${subtotal.pack.toLocaleString('id-ID')}</td>
              <td class="text-right font-medium">${subtotal.transit.toLocaleString('id-ID')}</td>
              <td class="text-right font-semibold">${subtotal.total.toLocaleString('id-ID')}</td>
            </tr>
          </tfoot>
        </table>
      </section>`;
    }).join('');

    const totalWeight = filteredData.reduce((s,i)=>s+(i.berat_kg||0),0);
    const totalShipping = filteredData.reduce((s,i)=>s+(i.harga_ongkir||0),0);
    const totalAdmin = filteredData.reduce((s,i)=>s+(i.biaya_admin||0),0);
    const totalPack = filteredData.reduce((s,i)=>s+(i.biaya_packaging||0),0);
    const totalTransit = filteredData.reduce((s,i)=>s+(i.biaya_transit||0),0);
    const grandTotal = filteredData.reduce((s,i)=>s+(i.total_fix||0),0);

    printWindow.document.write(`
    <html>
      <head>
        <title>Sales Report</title>
        <style>
          @page { margin:20mm; size:A4; }
          * { box-sizing:border-box; }
          body { font-family:'Inter','Helvetica Neue',Arial,sans-serif; font-size:11px; line-height:1.55; color:#1f2937; background:#ffffff; }
          .document-header { border-bottom:2px solid #e5e7eb; padding-bottom:20px; margin-bottom:28px; }
          .header-top { display:flex; justify-content:space-between; align-items:flex-start; }
          .company-info { display:block; }
          .company-name { font-size:30px; font-weight:700; color:#1e40af; letter-spacing:-0.5px; margin-bottom:4px; }
          .company-tagline { font-size:12px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:1px; }
          .document-meta { text-align:right; font-size:10px; color:#4b5563; line-height:1.4; }
          .report-title-section { text-align:center; margin-top:18px; }
          .report-title { font-size:24px; font-weight:700; letter-spacing:-0.3px; color:#111827; }
          .report-subtitle { font-size:12px; font-weight:600; color:#6b7280; margin-top:4px; }
          .report-parameters { background:#f8fafc; border:1px solid #e2e8f0; padding:14px 18px; display:flex; justify-content:space-between; align-items:center; margin-bottom:26px; }
          .param-group { display:flex; gap:28px; flex-wrap:wrap; }
          .param-item { font-size:11px; }
          .param-label { color:#6b7280; font-weight:600; margin-right:6px; }
          .param-value { font-weight:700; color:#1f2937; }
          /* Allow page to start listing immediately; don't force whole large section to next page */
          .agent-section { margin-bottom:30px; border:1px solid #e2e8f0; }
          .agent-header { page-break-after:avoid; break-after:avoid; }
          .agent-header { background:linear-gradient(135deg,#f1f5f9 0%,#e2e8f0 100%); padding:14px 18px; display:flex; justify-content:space-between; align-items:center; }
          .agent-name { font-weight:700; font-size:14px; color:#1e40af; letter-spacing:0.5px; }
          .agent-metrics { display:flex; gap:22px; }
          .metric { text-align:right; }
          .metric-label { display:block; font-size:9px; text-transform:uppercase; letter-spacing:0.7px; color:#64748b; font-weight:600; }
          .metric-value { display:block; font-size:11px; font-weight:700; color:#1f2937; }
          .data-table { width:100%; border-collapse:collapse; background:#ffffff; }
          .data-table thead th { background:#1e40af; color:#ffffff; font-weight:600; padding:10px 8px; font-size:10px; text-transform:uppercase; letter-spacing:0.6px; border-bottom:1px solid #1d4ed8; }
          .data-table tbody td { padding:9px 8px; border-bottom:1px solid #f1f5f9; font-size:10px; }
          .data-table tbody tr:nth-child(even) { background:#f9fafb; }
          .data-table tfoot td { background:#f1f5f9; font-size:10px; }
          .subtotal-row td { padding:10px 8px; font-weight:600; }
          .subtotal-label { font-weight:700; color:#1e3a8a; letter-spacing:0.5px; }
          .awb-number { font-weight:600; color:#1e40af; }
          .currency { font-weight:500; }
          .total-currency { font-weight:700; color:#1e40af; }
          .summary-wrapper { background:linear-gradient(135deg,#f8fafc 0%, #f1f5f9 100%); border:1px solid #cbd5e1; padding:24px; page-break-inside:avoid; break-inside:avoid; }
          .summary-title { font-size:15px; font-weight:700; color:#1e40af; text-align:center; margin-bottom:18px; letter-spacing:1px; text-transform:uppercase; }
          .summary-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:18px; }
          .summary-item { background:#ffffff; border:1px solid #e2e8f0; padding:14px; text-align:center; }
          .summary-label { font-size:9px; font-weight:600; letter-spacing:0.6px; text-transform:uppercase; color:#64748b; margin-bottom:6px; }
          .summary-value { font-size:13px; font-weight:700; color:#1f2937; }
          .grand-total { margin-top:22px; background:#1e40af; color:#ffffff; text-align:center; padding:20px 10px; }
          .grand-total-label { font-size:10px; letter-spacing:1px; font-weight:600; color:#bfdbfe; text-transform:uppercase; margin-bottom:6px; }
          .grand-total-value { font-size:20px; font-weight:800; }
          .document-footer { margin-top:38px; padding-top:16px; border-top:1px solid #e5e7eb; display:flex; justify-content:space-between; font-size:9px; color:#9ca3af; }
          .footer-left { font-weight:600; }
          .footer-right { text-align:right; }
          @media print { body {-webkit-print-color-adjust:exact !important; color-adjust:exact !important;} .agent-section { page-break-inside:auto !important; break-inside:auto !important; } .data-table { page-break-inside:auto; } .data-table tr { page-break-inside:avoid; } }
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
              <div><strong>Document ID:</strong> SR-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}${String(new Date().getDate()).padStart(2,'0')}-${Math.random().toString(36).substr(2,5).toUpperCase()}</div>
              <div><strong>Generated:</strong> ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})} ${new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div>
            </div>
          </div>
          <div class="report-title-section">
            <div class="report-title">SALES REPORT${agent ? ` - ${agent}` : ''}</div>
            <div class="report-subtitle">Transactional Summary</div>
          </div>
        </div>
        <div class="report-parameters">
          <div class="param-group">
            <div class="param-item"><span class="param-label">PERIOD:</span><span class="param-value">${fromDate && toDate ? `${new Date(fromDate).toLocaleDateString('en-GB')} - ${new Date(toDate).toLocaleDateString('en-GB')}` : 'ALL PERIODS'}</span></div>
            ${agent ? `<div class="param-item"><span class="param-label">AGENT:</span><span class="param-value">${agent}</span></div>` : ''}
          </div>
          <div class="param-item"><span class="param-label">RECORDS:</span><span class="param-value">${filteredData.length}</span></div>
        </div>
        ${groupedHtml}
        <div class="summary-wrapper">
          <div class="summary-title">SUMMARY</div>
          <div class="summary-grid">
            <div class="summary-item"><div class="summary-label">Total Weight</div><div class="summary-value">${totalWeight.toLocaleString('id-ID')} kg</div></div>
            <div class="summary-item"><div class="summary-label">Shipping</div><div class="summary-value">Rp ${totalShipping.toLocaleString('id-ID')}</div></div>
            <div class="summary-item"><div class="summary-label">Admin Fees</div><div class="summary-value">Rp ${totalAdmin.toLocaleString('id-ID')}</div></div>
            <div class="summary-item"><div class="summary-label">Packaging</div><div class="summary-value">Rp ${totalPack.toLocaleString('id-ID')}</div></div>
            <div class="summary-item"><div class="summary-label">Transit</div><div class="summary-value">Rp ${totalTransit.toLocaleString('id-ID')}</div></div>
            <div class="summary-item"><div class="summary-label">Total Shipments</div><div class="summary-value">${filteredData.length} AWB</div></div>
            <div class="summary-item"><div class="summary-label">Avg Per AWB</div><div class="summary-value">Rp ${filteredData.length>0?Math.round(grandTotal/filteredData.length).toLocaleString('id-ID'):'0'}</div></div>
            <div class="summary-item"><div class="summary-label">Processing Date</div><div class="summary-value">${new Date().toLocaleDateString('en-GB')}</div></div>
          </div>
          <div class="grand-total">
            <div class="grand-total-label">TOTAL SALES</div>
            <div class="grand-total-value">Rp ${grandTotal.toLocaleString('id-ID')}</div>
          </div>
        </div>
        <div class="document-footer">
          <div class="footer-left">
            <div>BCE EXPRESS - BUSINESS DOCUMENT</div>
            <div>This report contains business information</div>
            <div>Periksa kembali data yang tercantum dalam laporan ini</div>
          </div>
          <div class="footer-right">
            <div>Generated by ${currentUserName || 'BCE'}</div>
          </div>
        </div>
      </body>
    </html>`);
    printWindow.document.close();
    printWindow.print();
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
