"use client"

import React, { useState, useEffect } from 'react';
import { supabaseClient } from '../lib/auth';  // Ganti impor ini
import { createStyledExcelWithHTML } from '../lib/excel-utils';

const agentListTanjungPandan = [
  "COD",
  "TRANSFER",
  "CASH",
  "Wijaya Crab"
];

const SalesReport = ({ userRole, branchOrigin }) => {
  const [agent, setAgent] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Tambahkan state untuk daftar agen
  const [agentList, setAgentList] = useState([]);

  const currentAgentList = userRole === 'cabang' ? agentListTanjungPandan : agentList;

  useEffect(() => {
    fetchAgents();
    fetchData();
  }, []);

  // Tambahkan useEffect untuk mengambil daftar agen saat komponen dimuat
  useEffect(() => {
    fetchAgentsForSalesReport();
  }, [userRole, branchOrigin]);

  // Tambahkan fungsi untuk mengambil daftar agen (mirip dengan OutstandingReport)
  async function fetchAgentsForSalesReport() {
    try {
      let query;
      if (userRole === 'cabang') {
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
      // Central users: query central tables, Branch users: query branch tables with filtering
      let query;
      if (userRole === 'cabang') {
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
      const matchesAgent = agent ? item.agent_customer === agent : true;  // Ganti 'agent' dengan 'agent_customer'
      const matchesDateRange = fromDate && toDate ? new Date(item.awb_date) >= new Date(fromDate) && new Date(item.awb_date) <= new Date(toDate) : true;
      return matchesAgent && matchesDateRange;
    });

    const uniqueData = Array.from(new Set(filtered.map(item => item.awb_no))).map(awb_no => 
      filtered.find(item => item.awb_no === awb_no)
    );
    setFilteredData(uniqueData);
  };

  const downloadXLSX = () => {
    if (filteredData.length === 0) {
      alert('No data to download');
      return;
    }

    const headers = [
      'AWB (awb_no)',
      'Tgl AWB',
      'Tujuan',
      'Via Pengiriman',
      'Pengirim',
      'Penerima',
      'Kg',
      'Harga (Ongkir)',
      'Admin',
      'Packaging',
      'Total'
    ]

    const formattedData = filteredData.map(item => ({
      'AWB (awb_no)': item.awb_no,
      'Tgl AWB': item.awb_date,
      'Tujuan': item.kota_tujuan,
      'Via Pengiriman': item.kirim_via,
      'Pengirim': item.nama_pengirim,
      'Penerima': item.nama_penerima,
      'Kg': item.berat_kg,
      'Harga (Ongkir)': item.harga_per_kg,
      'Admin': item.biaya_admin,
      'Packaging': item.biaya_packaging,
      'Total': item.total
    }))

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
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Sales Report</title>
          <style>
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th, td { border: 1px solid black; padding: 4px; text-align: left; }
            th { background-color: #f2f2f2; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .totals-section { margin-top: 10px; padding: 8px; background-color: #e0f2f7; border: 1px solid #b0bec5; border-radius: 4px; font-size: 10px; }
            .totals-section h3 { font-weight: bold; margin-bottom: 5px; }
            .totals-section p { margin: 2px 0; }
          </style>
        </head>
        <body>
          <h2>Sales Report</h2>
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>AWB (awb_no)</th>
                <th>Tgl AWB</th>
                <th>Tujuan</th>
                <th>Via Pengiriman</th>
                <th>Pengirim</th>
                <th>Penerima</th>
                <th class="text-right">Kg</th>
                <th class="text-right">Harga (Ongkir)</th>
                <th class="text-right">Admin</th>
                <th class="text-right">Packaging</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${filteredData.map((item, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${item.awb_no}</td>
                  <td>${item.awb_date}</td>
                  <td>${item.kota_tujuan}</td>
                  <td>${item.kirim_via}</td>
                  <td>${item.nama_pengirim}</td>
                  <td>${item.nama_penerima}</td>
                  <td class="text-right">${item.berat_kg}</td>
                  <td class="text-right">${item.harga_per_kg}</td>
                  <td class="text-right">${item.biaya_admin}</td>
                  <td class="text-right">${item.biaya_packaging}</td>
                  <td class="text-right font-bold">${item.total}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="totals-section">
            <h3>Total:</h3>
            <p>Total Kg: ${filteredData.reduce((sum, item) => sum + (item.berat_kg || 0), 0).toLocaleString('en-US')}</p>
            <p>Total Harga (Ongkir): Rp. ${filteredData.reduce((sum, item) => sum + (item.harga_per_kg || 0), 0).toLocaleString('en-US')}</p>
            <p>Total Admin: Rp. ${filteredData.reduce((sum, item) => sum + (item.biaya_admin || 0), 0).toLocaleString('en-US')}</p>
            <p>Total Packaging: Rp. ${filteredData.reduce((sum, item) => sum + (item.biaya_packaging || 0), 0).toLocaleString('en-US')}</p>
            <p>Total Keseluruhan: Rp. ${filteredData.reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString('en-US')}</p>
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
              <th className="border p-2 text-left dark:border-gray-600 dark:text-gray-200">Tujuan</th>
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
                <td className="border p-2 dark:border-gray-600">{item.kota_tujuan}</td>
                <td className="border p-2 dark:border-gray-600">{item.kirim_via}</td>
                <td className="border p-2 dark:border-gray-600">{item.nama_pengirim}</td>
                <td className="border p-2 dark:border-gray-600">{item.nama_penerima}</td>
                <td className="border p-2 text-right dark:border-gray-600">{item.berat_kg}</td>
                <td className="border p-2 text-right dark:border-gray-600">{item.harga_per_kg}</td>
                <td className="border p-2 text-right dark:border-gray-600">{item.biaya_admin}</td>
                <td className="border p-2 text-right dark:border-gray-600">{item.biaya_packaging}</td>
                <td className="border p-2 text-right font-bold dark:border-gray-600 dark:text-green-400">{item.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {filteredData.length > 0 && (
        <div className="mt-4 p-4 bg-blue-50 rounded border border-blue-200 flex flex-row flex-wrap items-center gap-4 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-200">
          <h3 className="text-sm font-semibold">Total:</h3>
          <p className="dark:text-gray-300">Total Kg: {filteredData.reduce((sum, item) => sum + (item.berat_kg || 0), 0).toLocaleString('en-US')}</p>
          <p className="dark:text-gray-300">Total Harga (Ongkir): Rp. {filteredData.reduce((sum, item) => sum + (item.harga_per_kg || 0), 0).toLocaleString('en-US')}</p>
          <p className="dark:text-gray-300">Total Admin: Rp. {filteredData.reduce((sum, item) => sum + (item.biaya_admin || 0), 0).toLocaleString('en-US')}</p>
          <p className="dark:text-gray-300">Total Packaging: Rp. {filteredData.reduce((sum, item) => sum + (item.biaya_packaging || 0), 0).toLocaleString('en-US')}</p>
          <p className="dark:text-gray-300">Total Keseluruhan: Rp. {filteredData.reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString('en-US')}</p>
        </div>
      )}
      {loading && <p className="dark:text-gray-300">Loading data...</p>}
      {error && <p className="text-red-500 dark:text-red-300">{error}</p>}
    </div>
  );
};

export default SalesReport;
