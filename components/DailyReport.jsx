"use client"

import { useState, useEffect } from "react"
import { supabaseClient } from "../lib/auth"

export default function DailyReport() {
  const [data, setData] = useState([])  // State untuk menyimpan data laporan
  const [selectedDate, setSelectedDate] = useState("")  // State untuk filter tanggal
  const [selectedKirimVia, setSelectedKirimVia] = useState("")  // New state for kirim via
  const [selectedAgentCustomer, setSelectedAgentCustomer] = useState("")  // New state for Agent/Customer
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Final agentList with absolute no duplicates
  const agentList = [
    "GLC COD UDR",
    "GLC COD DRT",
    "GLC DRT",
    "Duta Garden",
    "Poris Residence",
    "Kartini",
    "OTTY OFFICIAL",  // Single, unique instance
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

  // Fetch data berdasarkan tanggal yang dipilih
  useEffect(() => {
    if (selectedDate || selectedKirimVia || selectedAgentCustomer) {
      fetchDailyReport()
    }
  }, [selectedDate, selectedKirimVia, selectedAgentCustomer])

  async function fetchDailyReport() {
    setLoading(true)
    setError("")
    try {
      let query = supabaseClient.from("manifest").select("*").order("awb_date", { ascending: false })
      
      if (selectedDate) {
        query = query.eq("awb_date", selectedDate)
      }
      if (selectedKirimVia) {
        query = query.eq("kirim_via", selectedKirimVia)
      }
      if (selectedAgentCustomer) {
        query = query.eq("agent_customer", selectedAgentCustomer)
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
  }

  // Fungsi untuk download CSV berdasarkan data yang sudah difilter
  const downloadCSV = () => {
    if (data.length === 0) {
      alert("No data to download")
      return
    }

    const headers = ['No', 'AWB (No Resi)', 'Pengirim', 'Penerima', 'Coli', 'Kg', 'Harga (Ongkir)', 'Admin', 'Packaging', 'Cash', 'Transfer', 'COD', 'Wilayah'];
    
    const rows = data.map((item, index) => [
      index + 1,
      item.awb_no,
      item.nama_pengirim,
      item.nama_penerima,
      item.coli,
      item.berat_kg,
      item.harga_per_kg || item.ongkir,
      item.biaya_admin || item.admin,
      item.biaya_packaging,
      item.metode_pembayaran === 'cash' ? item.total : 0,
      item.metode_pembayaran === 'transfer' ? item.total : 0,
      item.metode_pembayaran === 'cod' ? item.total : 0,
      item.wilayah
    ]);
    
    // Add totals row
    const totalCash = data.filter(item => item.metode_pembayaran === 'cash').reduce((sum, item) => sum + (item.total || 0), 0);
    const totalTransfer = data.filter(item => item.metode_pembayaran === 'transfer').reduce((sum, item) => sum + (item.total || 0), 0);
    const totalCOD = data.filter(item => item.metode_pembayaran === 'cod').reduce((sum, item) => sum + (item.total || 0), 0);
    const totalSemua = data.reduce((sum, item) => sum + (item.total || 0), 0);
    
    const totalsRow = ['Total Keseluruhan', '', '', '', '', '', '', '', '', totalCash, totalTransfer, totalCOD, totalSemua];
    
    const allRows = [...rows, totalsRow];  // Combine data rows with totals row
    
    const csvContent = [headers, ...allRows.map(row => row.map(value => (typeof value === 'number' ? value.toLocaleString('id-ID') : value)).join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `daily_report_${selectedDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold text-blue-900 mb-4">Daily Report</h2>
      
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="text-sm font-semibold">Filter by Date:</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        />
        
        <label className="text-sm font-semibold">Filter by Kirim Via:</label>
        <select
          value={selectedKirimVia}
          onChange={(e) => setSelectedKirimVia(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="">Semua</option>
          <option value="udara">Udara</option>
          <option value="darat">Darat</option>
        </select>
        
        <label className="text-sm font-semibold">Filter by Agent/Customer:</label>
        <select
          value={selectedAgentCustomer}
          onChange={(e) => setSelectedAgentCustomer(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="">Semua</option>
          {agentList.map((agent) => (
            <option key={agent} value={agent}>
              {agent}
            </option>
          ))}
        </select>
      </div>

      {/* Tombol Download CSV di pojok kanan atas */}
      {data.length > 0 && (
        <div className="mb-4 flex justify-end">
          <button
            onClick={downloadCSV}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Download CSV
          </button>
        </div>
      )}

      {error && <div className="mb-2 p-2 bg-red-100 text-red-700 rounded">{error}</div>}
      {loading ? (
        <div className="text-center py-4">Loading...</div>
      ) : (
        <>
          <div className="overflow-x-auto w-full bg-white rounded shadow sm:overflow-visible">
            <table className="min-w-full text-sm divide-y divide-gray-200">
              <thead className="bg-blue-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300">No</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300">AWB (No Resi)</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300">Pengirim</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300">Penerima</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300">Coli</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300">Kg</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300">Harga(Ongkir)</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300">Admin</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300">Packaging</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 bg-blue-100">Cash</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 bg-blue-100">Transfer</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 bg-blue-100">COD</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300">Wilayah</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, index) => (
                  <tr key={item.awb_no || `item-${index}`} className="even:bg-gray-50">
                    <td className="px-4 py-2 border border-gray-300">{index + 1}</td>
                    <td className="px-4 py-2 border border-gray-300">{item.awb_no}</td>
                    <td className="px-4 py-2 border border-gray-300">{item.nama_pengirim}</td>
                    <td className="px-4 py-2 border border-gray-300">{item.nama_penerima}</td>
                    <td className="px-4 py-2 border border-gray-300">{item.coli}</td>
                    <td className="px-4 py-2 border border-gray-300">{item.berat_kg}</td>
                    <td className="px-4 py-2 border border-gray-300">{item.harga_per_kg || item.ongkir}</td>
                    <td className="px-4 py-2 border border-gray-300">{item.biaya_admin || item.admin}</td>
                    <td className="px-4 py-2 border border-gray-300">{item.biaya_packaging}</td>
                    <td className="px-4 py-2 border border-gray-300 bg-blue-100">{item.metode_pembayaran === 'cash' ? `Rp. ${(item.total || 0).toLocaleString('id-ID')}` : 'Rp. 0'}</td>
                    <td className="px-4 py-2 border border-gray-300 bg-blue-100">{item.metode_pembayaran === 'transfer' ? `Rp. ${(item.total || 0).toLocaleString('id-ID')}` : 'Rp. 0'}</td>
                    <td className="px-4 py-2 border border-gray-300 bg-blue-100">{item.metode_pembayaran === 'cod' ? `Rp. ${(item.total || 0).toLocaleString('id-ID')}` : 'Rp. 0'}</td>
                    <td className="px-4 py-2 border border-gray-300">{item.wilayah}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.length > 0 && (
            <div className="mt-4 p-4 bg-blue-50 rounded border border-blue-200">
              <h3 className="text-sm font-semibold">Total Keseluruhan:</h3>
              <p>Total Cash: Rp. {data.filter(item => item.metode_pembayaran === 'cash').reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString('id-ID')}</p>
              <p>Total Transfer: Rp. {data.filter(item => item.metode_pembayaran === 'transfer').reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString('id-ID')}</p>
              <p>Total COD: Rp. {data.filter(item => item.metode_pembayaran === 'cod').reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString('id-ID')}</p>
              <p>Total Semua: Rp. {data.reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString('id-ID')}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
} 