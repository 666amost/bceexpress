"use client"

import { useState, useEffect } from "react"
import { supabaseClient } from "../lib/auth"
import { FaDownload, FaPrint } from 'react-icons/fa'
import { createStyledExcelWithHTML } from "../lib/excel-utils"

const kirimViaOptions = ["udara", "darat"]  // Diambil dari AwbForm.jsx
const kotaTujuanOptions = ["bangka", "kalimantan barat", "belitung", "bali"]  // Diambil dari AwbForm.jsx dan HistoryManifest.jsx

/**
 * @param {{ userRole: string, branchOrigin: string }} props
 */
export default function RecapManifest({ userRole, branchOrigin }) {
  const [data, setData] = useState([])  // State untuk menyimpan data laporan
  const [selectedKirimVia, setSelectedKirimVia] = useState("")  // Filter Kirim via
  const [selectedTujuan, setSelectedTujuan] = useState("")  // Filter Tujuan
  const [fromDate, setFromDate] = useState("")  // Filter dari tanggal
  const [toDate, setToDate] = useState("")  // Filter sampai tanggal
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const kotaTujuanOptionsFinal = userRole === 'cabang' ? ["jakarta", "tangerang", "bekasi", "depok", "bogor"] : ["bangka", "kalimantan barat", "belitung", "bali"];

  // Fungsi untuk fetch data dengan filter
  async function fetchRecapData() {
    setLoading(true)
    setError("")
    try {
      // Central users: query central tables, Branch users: query branch tables with filtering
      let query;
      if (userRole === 'cabang') {
        query = supabaseClient
          .from("manifest_cabang")
          .select("*")
          .eq('origin_branch', branchOrigin)
          .order("awb_date", { ascending: false })
      } else {
        // Central users query central table without any filtering
        query = supabaseClient
          .from("manifest")
          .select("*")
          .order("awb_date", { ascending: false })
      }
      
      if (selectedKirimVia) {
        query = query.eq("kirim_via", selectedKirimVia)
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
          const groupedData = fetchedData.reduce((acc, item) => {
            const date = item.awb_date;
            if (!acc[date]) {
              acc[date] = { totalAWB: 0, totalColi: 0, totalKg: 0, cash: 0, transfer: 0, cod: 0, count: 0 };
            }
            acc[date].totalAWB += 1;  // Count each item as one AWB entry
            acc[date].totalColi += item.coli || 0;
            acc[date].totalKg += item.berat_kg || 0;
            if (item.metode_pembayaran === 'cash') acc[date].cash += item.total || 0;
            if (item.metode_pembayaran === 'transfer') acc[date].transfer += item.total || 0;
            if (item.metode_pembayaran === 'cod') acc[date].cod += item.total || 0;
            acc[date].count += 1;  // For numbering if needed
            return acc;
          }, {});
          const processedData = Object.entries(groupedData).map(([date, totals]) => ({ date, ...totals }));
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
      'Tgl',
      'Total AWB',
      'Total Coli',
      'Kg',
      'Cash',
      'Transfer',
      'COD',
      'Total Pembayaran'
    ]

    const formattedData = data.map(item => ({
      'Tgl': item.date,
      'Total AWB': item.totalAWB,
      'Total Coli': item.totalColi,
      'Kg': item.totalKg,
      'Cash': item.cash,
      'Transfer': item.transfer,
      'COD': item.cod,
      'Total Pembayaran': item.cash + item.transfer + item.cod
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
      currencyColumns: [4, 5, 6, 7], // Cash, Transfer, COD, Total Pembayaran
      numberColumns: [1, 2, 3], // Total AWB, Total Coli, Kg
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
          <h2>Recap Manifest</h2>
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Tgl</th>
                <th>Total AWB</th>
                <th>Total Coli</th>
                <th>Kg</th>
                <th class="text-right">Cash</th>
                <th class="text-right">Transfer</th>
                <th class="text-right">COD</th>
                <th class="text-right">Total Pembayaran</th>
              </tr>
            </thead>
            <tbody>
              ${data.map((item, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${item.date}</td>
                  <td>${item.totalAWB || 0}</td>
                  <td>${item.totalColi || 0}</td>
                  <td>${item.totalKg || 0}</td>
                  <td class="text-right">Rp. ${(item.cash || 0).toLocaleString('en-US')}</td>
                  <td class="text-right">Rp. ${(item.transfer || 0).toLocaleString('en-US')}</td>
                  <td class="text-right">Rp. ${(item.cod || 0).toLocaleString('en-US')}</td>
                  <td class="text-right font-bold">Rp. ${((item.cash || 0) + (item.transfer || 0) + (item.cod || 0)).toLocaleString('en-US')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="totals-section">
            <h3>Total:</h3>
            <p>Total AWB: ${data.reduce((sum, item) => sum + (item.totalAWB || 0), 0)}</p>
            <p>Total Coli: ${data.reduce((sum, item) => sum + (item.totalColi || 0), 0)}</p>
            <p>Total Kg: ${data.reduce((sum, item) => sum + (item.totalKg || 0), 0)}</p>
            <p>Total Cash: Rp. ${data.reduce((sum, item) => sum + (item.cash || 0), 0).toLocaleString('en-US')}</p>
            <p>Total Transfer: Rp. ${data.reduce((sum, item) => sum + (item.transfer || 0), 0).toLocaleString('en-US')}</p>
            <p>Total COD: Rp. ${data.reduce((sum, item) => sum + (item.cod || 0), 0).toLocaleString('en-US')}</p>
            <p>Total Pembayaran: Rp. ${data.reduce((sum, item) => sum + ((item.cash || 0) + (item.transfer || 0) + (item.cod || 0)), 0).toLocaleString('en-US')}</p>
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
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">Rp. {((item.cash || 0) + (item.transfer || 0) + (item.cod || 0)).toLocaleString('en-US')}</td>
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
              <p className="text-gray-800 dark:text-gray-200">Total Pembayaran: Rp. {data.reduce((sum, item) => sum + ((item.cash || 0) + (item.transfer || 0) + (item.cod || 0)), 0).toLocaleString('en-US')}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}