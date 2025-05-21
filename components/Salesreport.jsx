"use client"

import React, { useState, useEffect } from 'react';
import { supabaseClient } from '../lib/auth';  // Ganti impor ini
import * as XLSX from 'xlsx';  // Tambahkan import ini di bagian atas file

const SalesReport = () => {
  const [agent, setAgent] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const agentList = [
    'GLC COD UDR',
    'GLC COD DRT',
    'OTTY OFFICIAL',
    'UDR CASH',
    'SEA CASH',
    'GLC UDR TRF',
    'GLC SEA TRF',
    'COD UDR',
    'COD SEA',
    'KMY UDR TRF',
    'KMY SEA TRF',
    'KARTINI KIKI',
    'DUTA GARDEN FRENITA',
    'FELLISIA PORIS EX 3',
    'CITRA 3 RENY',
    'HENDI',
    'PRALITA',
    'SALIM',
    'ISKANDAR',
    'IMAM',
    'DONI',
    'HERFAN',
    'EZZA',
    'YANDRI',
    'DIKY',
    'YOS',
    'INDAH SUSHI TIME',
    'CENTRAL NURSERY BANGKA',
    'MAMAPIA',
    'AMELIA PEDINDANG',
    'HENDRY LIMIA',
    'JESS DOT',
    'SEPIRING RASA BASO',
    'CHRISTINE PADEMANGAN'
  ];  // Tambahkan array agentList di dalam komponen

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: manifestData, error } = await supabaseClient.from('manifest').select('*').order('awb_date', { ascending: true });
      if (error) {
        console.error('Error fetching data:', error);  // Log error dengan detail
        setError(`Error fetching data: ${error.message || 'Unknown error'}`);  // Set error dengan pesan yang lebih informatif
      } else {
        setData(manifestData || []);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
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

    const today = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase();
    const dataHeaders = ['No', 'AWB (awb_no)', 'Tgl AWB', 'Tujuan', 'Via Pengiriman', 'Pengirim', 'Penerima', 'Kg', 'Harga (Ongkir)', 'Admin', 'Packaging', 'Total'].map(header => header.toUpperCase());
    const dataRows = filteredData.map((item, index) => [
      index + 1,
      item.awb_no,
      item.awb_date,
      item.kota_tujuan,
      item.kirim_via,
      item.nama_pengirim,
      item.nama_penerima,
      item.berat_kg,
      item.harga_per_kg,
      item.biaya_admin,
      item.biaya_packaging,
      item.total
    ]);

    const allRows = [['Report dibuat pada: ' + today], dataHeaders, ...dataRows];
    const worksheet = XLSX.utils.aoa_to_sheet(allRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales Report');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `sales_report_${today.replace(/\//g, '-')}.xlsx`);
    link.click();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Sale Report</h2>
      <div className="mb-4 no-print">
        <label className="block mb-2">Filter Agent:</label>
        <select
          value={agent}
          onChange={(e) => setAgent(e.target.value)}
          className="border p-2 w-full"
        >
          <option value="">Semua</option>
          {agentList.map((agentOption) => (
            <option key={agentOption} value={agentOption}>
              {agentOption}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-4 no-print">
        <label className="block mb-2">Dari tanggal:</label>
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="border p-2 w-full" />
      </div>
      <div className="mb-4 no-print">
        <label className="block mb-2">Sampai tanggal:</label>
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="border p-2 w-full" />
      </div>
      <button onClick={handleFilter} className="bg-blue-600 text-white px-4 py-2 rounded no-print">Filter</button>
      
      {filteredData.length > 0 && (
        <div className="mb-4 flex justify-end no-print">
          <button onClick={downloadXLSX} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mr-2">Download XLSX</button>
          <button onClick={handlePrint} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Print</button>
        </div>
      )}
      
      {filteredData.length > 0 && (
        <table className="mt-4 w-full border-collapse border border-gray-300">
          <thead>
            <tr>
              <th className="border p-2">No</th>
              <th className="border p-2">AWB (awb_no)</th>
              <th className="border p-2">Tgl AWB</th>
              <th className="border p-2">Tujuan</th>
              <th className="border p-2">Via Pengiriman</th>
              <th className="border p-2">Pengirim</th>
              <th className="border p-2">Penerima</th>
              <th className="border p-2">Kg</th>
              <th className="border p-2">Harga (Ongkir)</th>
              <th className="border p-2">Admin</th>
              <th className="border p-2">Packaging</th>
              <th className="border p-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, index) => (
              <tr key={item.awb_no}>
                <td className="border p-2">{index + 1}</td>
                <td className="border p-2">{item.awb_no}</td>
                <td className="border p-2">{item.awb_date}</td>
                <td className="border p-2">{item.kota_tujuan}</td>
                <td className="border p-2">{item.kirim_via}</td>
                <td className="border p-2">{item.nama_pengirim}</td>
                <td className="border p-2">{item.nama_penerima}</td>
                <td className="border p-2">{item.berat_kg}</td>
                <td className="border p-2">{item.harga_per_kg}</td>
                <td className="border p-2">{item.biaya_admin}</td>
                <td className="border p-2">{item.biaya_packaging}</td>
                <td className="border p-2">{item.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {filteredData.length > 0 && (
        <div className="mt-4 p-4 bg-blue-50 rounded border border-blue-200 flex flex-row flex-wrap items-center gap-4">
          <h3 className="text-sm font-semibold">Total:</h3>
          <p>Total Kg: {filteredData.reduce((sum, item) => sum + (item.berat_kg || 0), 0).toLocaleString('en-US')}</p>
          <p>Total Harga (Ongkir): Rp. {filteredData.reduce((sum, item) => sum + (item.harga_per_kg || 0), 0).toLocaleString('en-US')}</p>
          <p>Total Admin: Rp. {filteredData.reduce((sum, item) => sum + (item.biaya_admin || 0), 0).toLocaleString('en-US')}</p>
          <p>Total Packaging: Rp. {filteredData.reduce((sum, item) => sum + (item.biaya_packaging || 0), 0).toLocaleString('en-US')}</p>
          <p>Total Keseluruhan: Rp. {filteredData.reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString('en-US')}</p>
        </div>
      )}
      {loading && <p>Loading data...</p>}
      {error && <p className="text-red-500">{error}</p>}
    </div>
  );
};

export default SalesReport;
