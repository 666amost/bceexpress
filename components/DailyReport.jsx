"use client"

import { useState, useEffect } from "react"
import { supabaseClient } from "../lib/auth"

export default function DailyReport() {
  const [data, setData] = useState([])  // State untuk menyimpan data laporan
  const [selectedDate, setSelectedDate] = useState("")  // State untuk filter tanggal
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Fetch data berdasarkan tanggal yang dipilih
  useEffect(() => {
    if (selectedDate) {
      fetchDailyReport(selectedDate)
    }
  }, [selectedDate])

  async function fetchDailyReport(date) {
    setLoading(true)
    setError("")
    try {
      const { data: fetchedData, error: fetchError } = await supabaseClient
        .from("manifest")  // Ganti dengan tabel yang sesuai, misalnya "manifest"
        .select("*")
        .eq("awb_date", date)  // Filter berdasarkan kolom tanggal, asumsi kolom "awb_date"
        .order("awb_date", { ascending: false })

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

    const headers = ["AWB No", "AWB Date", "Pengirim", "Penerima", "Total"]  // Sesuaikan header dengan kolom data

    const rows = data.map((item) => [
      item.awb_no,
      item.awb_date,
      item.nama_pengirim,
      item.nama_penerima,
      item.total,
    ])

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `daily_report_${selectedDate}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold text-blue-900 mb-4">Daily Report</h2>
      
      {/* Filter berdasarkan tanggal */}
      <div className="mb-4 flex items-center gap-2">
        <label className="text-sm font-semibold">Filter by Date:</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        />
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
          <div className="overflow-x-auto bg-white rounded shadow">
            <table className="min-w-full text-sm divide-y divide-gray-200">
              <thead className="bg-blue-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">AWB No</th>
                  <th className="px-4 py-2 text-left font-semibold">AWB Date</th>
                  <th className="px-4 py-2 text-left font-semibold">Pengirim</th>
                  <th className="px-4 py-2 text-left font-semibold">Penerima</th>
                  <th className="px-4 py-2 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, index) => (
                  <tr key={item.awb_no || `item-${index}`} className="even:bg-gray-50">
                    <td className="px-4 py-2">{item.awb_no}</td>
                    <td className="px-4 py-2">{item.awb_date}</td>
                    <td className="px-4 py-2">{item.nama_pengirim}</td>
                    <td className="px-4 py-2">{item.nama_penerima}</td>
                    <td className="px-4 py-2 text-right">{item.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
} 