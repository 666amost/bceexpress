"use client"

import { useState, useEffect } from "react"
import { supabaseClient } from "../lib/auth"
import XLSX from "xlsx"

const kirimViaOptions = ["udara", "darat"]  // Diambil dari AwbForm.jsx
const kotaTujuanOptions = ["bangka", "kalimantan barat", "belitung", "bali"]  // Diambil dari AwbForm.jsx dan HistoryManifest.jsx

export default function RecapManifest() {
  const [data, setData] = useState([])  // State untuk menyimpan data laporan
  const [selectedKirimVia, setSelectedKirimVia] = useState("")  // Filter Kirim via
  const [selectedTujuan, setSelectedTujuan] = useState("")  // Filter Tujuan
  const [fromDate, setFromDate] = useState("")  // Filter dari tanggal
  const [toDate, setToDate] = useState("")  // Filter sampai tanggal
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Fungsi untuk fetch data dengan filter
  async function fetchRecapData() {
    setLoading(true)
    setError("")
    try {
      let query = supabaseClient.from("manifest").select("*").order("awb_date", { ascending: false })
      
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
    const today = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase();
    const dataHeaders = ['No', 'Tgl', 'Total AWB', 'Total Coli', 'Kg', 'Cash', 'Transfer', 'COD', 'Total Pembayaran'].map(header => header.toUpperCase());
    const dataRows = data.map((item, index) => [
      index + 1,
      item.date,
      item.totalAWB,
      item.totalColi,
      item.totalKg,
      item.cash,
      item.transfer,
      item.cod,
      item.totalAWB + item.cash + item.transfer + item.cod
    ]);
    const totalsRow = ['Total Keseluruhan', '', data.reduce((sum, item) => sum + item.totalAWB, 0), data.reduce((sum, item) => sum + item.totalColi, 0), data.reduce((sum, item) => sum + item.totalKg, 0), data.reduce((sum, item) => sum + item.cash, 0), data.reduce((sum, item) => sum + item.transfer, 0), data.reduce((sum, item) => sum + item.cod, 0), data.reduce((sum, item) => sum + (item.totalAWB + item.cash + item.transfer + item.cod), 0)];
    const allRows = [['Report dibuat pada: ' + today], dataHeaders, ...dataRows, totalsRow];
    const worksheet = XLSX.utils.aoa_to_sheet(allRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Recap Manifest');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `recap_manifest_${today.replace(/\//g, '-')}.xlsx`);
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold text-blue-900 mb-4">Recap Manifest</h2>
      
      {/* Bagian Filter, tambahkan class no-print */}
      <div className="mb-4 flex flex-wrap items-center gap-2 no-print">
        <label className="text-sm font-semibold">Filter by Kirim Via:</label>
        <select
          value={selectedKirimVia}
          onChange={(e) => setSelectedKirimVia(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="">Semua</option>
          {kirimViaOptions.map((option) => (
            <option key={option} value={option}>
              {option.toUpperCase()}
            </option>
          ))}
        </select>
        
        <label className="text-sm font-semibold">Filter by Tujuan:</label>
        <select
          value={selectedTujuan}
          onChange={(e) => setSelectedTujuan(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="">Semua</option>
          {kotaTujuanOptions.map((option) => (
            <option key={option} value={option}>
              {option.toUpperCase()}
            </option>
          ))}
        </select>
        
        <label className="text-sm font-semibold">Dari Tanggal:</label>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        />
        
        <label className="text-sm font-semibold">Sampai Tanggal:</label>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        />
        
        <button
          onClick={fetchRecapData}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          disabled={loading}
        >
          {loading ? "Memuat..." : "Tampilkan"}
        </button>
        
        <button
          onClick={handleCancel}
          className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
        >
          Cancel
        </button>
      </div>

      {/* Tombol download dan print, tambahkan class no-print */}
      <div className="mb-4 flex justify-end no-print">
        <button
          onClick={downloadXLSX}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mr-2"
        >
          Download XLSX
        </button>
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Print
        </button>
      </div>

      {error && <div className="mb-2 p-2 bg-red-100 text-red-700 rounded">{error}</div>}
      
      {loading ? (
        <div className="text-center py-4">Loading...</div>
      ) : (
        <>
          <div className="overflow-x-auto w-full bg-white rounded shadow">
            <table className="min-w-full text-sm divide-y divide-gray-200">
              <thead className="bg-blue-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold border">No</th>
                  <th className="px-4 py-2 text-left font-semibold border">Tgl</th>
                  <th className="px-4 py-2 text-left font-semibold border">Total AWB</th>
                  <th className="px-4 py-2 text-left font-semibold border">Total Coli</th>
                  <th className="px-4 py-2 text-left font-semibold border">Kg</th>
                  <th className="px-4 py-2 text-left font-semibold border bg-blue-100">Cash</th>
                  <th className="px-4 py-2 text-left font-semibold border bg-blue-100">Transfer</th>
                  <th className="px-4 py-2 text-left font-semibold border bg-blue-100">COD</th>
                  <th className="px-4 py-2 text-left font-semibold border">Total Pembayaran</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, index) => (
                  <tr key={item.date || index} className="even:bg-gray-50">
                    <td className="px-4 py-2 border">{index + 1}</td>
                    <td className="px-4 py-2 border">{item.date}</td>
                    <td className="px-4 py-2 border">{item.totalAWB}</td>
                    <td className="px-4 py-2 border">{item.totalColi}</td>
                    <td className="px-4 py-2 border">{item.totalKg}</td>
                    <td className="px-4 py-2 border bg-blue-100">{item.cash}</td>
                    <td className="px-4 py-2 border bg-blue-100">{item.transfer}</td>
                    <td className="px-4 py-2 border bg-blue-100">{item.cod}</td>
                    <td className="px-4 py-2 border">{item.totalAWB + item.cash + item.transfer + item.cod}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Total di Bawah Tabel */}
          {data.length > 0 && (
            <div className="mt-4 p-4 bg-blue-50 rounded border border-blue-200 flex flex-row flex-wrap items-center gap-4">
              <h3 className="text-sm font-semibold">Total:</h3>
              <p>Total AWB: {data.reduce((sum, item) => sum + item.totalAWB, 0)}</p>
              <p>Total Coli: {data.reduce((sum, item) => sum + item.totalColi, 0)}</p>
              <p>Total Kg: {data.reduce((sum, item) => sum + item.totalKg, 0)}</p>
              <p>Total Cash: Rp. {data.reduce((sum, item) => sum + item.cash, 0).toLocaleString('en-US')}</p>
              <p>Total Transfer: Rp. {data.reduce((sum, item) => sum + item.transfer, 0).toLocaleString('en-US')}</p>
              <p>Total COD: Rp. {data.reduce((sum, item) => sum + item.cod, 0).toLocaleString('en-US')}</p>
              <p>Total Pembayaran: Rp. {data.reduce((sum, item) => sum + (item.totalAWB + item.cash + item.transfer + item.cod), 0).toLocaleString('en-US')}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}