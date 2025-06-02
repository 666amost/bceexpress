"use client"

import { useState, useEffect, useMemo } from "react"
import { supabaseClient } from "../lib/auth"
import { createStyledExcelWithHTML } from "../lib/excel-utils"

export default function DailyReport({ userRole, branchOrigin }) {
  const [data, setData] = useState([])  // State untuk menyimpan data laporan
  const [selectedDateFrom, setSelectedDateFrom] = useState("") // State baru untuk filter tanggal Dari
  const [selectedDateTo, setSelectedDateTo] = useState("") // State baru untuk filter tanggal Sampai
  const [selectedKirimVia, setSelectedKirimVia] = useState("")  // State untuk filter kirim via
  const [selectedAgentCustomer, setSelectedAgentCustomer] = useState("")  // State untuk filter Agent/Customer
  const [selectedKotaTujuan, setSelectedKotaTujuan] = useState("")  // State baru untuk filter kota tujuan
  const [selectedWilayah, setSelectedWilayah] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const agentList = userRole === 'cabang'
    ? ["COD", "TRANSFER", "CASH"]
    : [
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
  const kotaTujuan = userRole === 'cabang'
    ? ["jakarta", "tangerang", "bekasi", "depok", "bogor"]
    : ["bangka", "kalimantan barat", "belitung", "bali"];
  const kotaWilayah = userRole === 'cabang'
    ? {
        jakarta: ["JKT"],
        tangerang: ["TGT"],
        bekasi: ["BKS"],
        depok: ["DPK"],
        bogor: ["BGR"]
      }
    : {
        bangka: ["Pangkal Pinang", "Sungailiat", "Belinyu", "Jebus", "Koba", "Toboali", "Mentok"],
        "kalimantan barat": ["Pontianak", "Singkawang", "Sungai Pinyuh"],
        belitung: ["Tj Pandan"],
        bali: ["Denpasar"]
      };
  const wilayahOptions = useMemo(() => kotaWilayah[selectedKotaTujuan] || [], [selectedKotaTujuan, kotaWilayah]);

  // Fetch data berdasarkan filter yang dipilih, termasuk kota tujuan dan rentang tanggal
  useEffect(() => {
    if (selectedDateFrom || selectedDateTo || selectedKirimVia || selectedAgentCustomer || selectedKotaTujuan || selectedWilayah) {
      fetchDailyReport()
    }
  }, [selectedDateFrom, selectedDateTo, selectedKirimVia, selectedAgentCustomer, selectedKotaTujuan, selectedWilayah])  // Tambahkan selectedDateFrom dan selectedDateTo ke dependencies

  async function fetchDailyReport() {
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
      
      // Apply date range filter
      if (selectedDateFrom && selectedDateTo) {
        // Filter between two dates (inclusive)
        query = query
          .gte("awb_date", selectedDateFrom)
          .lte("awb_date", selectedDateTo);
      } else if (selectedDateFrom) {
        // Filter from a specific date onwards
        query = query.gte("awb_date", selectedDateFrom);
      } else if (selectedDateTo) {
        // Filter up to a specific date
        query = query.lte("awb_date", selectedDateTo);
      }
      // Note: If neither selectedDateFrom nor selectedDateTo is set, no date filter is applied,
      // fetching all data (sorted by date desc) which matches other filters.
      
      if (selectedKirimVia) {
        query = query.eq("kirim_via", selectedKirimVia)
      }
      if (selectedAgentCustomer) {
        query = query.eq("agent_customer", selectedAgentCustomer)
      }
      if (selectedKotaTujuan) {  // Tambahkan filter untuk kota tujuan
        query = query.eq("kota_tujuan", selectedKotaTujuan)
      }
      if (selectedWilayah) {
        query = query.eq("wilayah", selectedWilayah)
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

  // Enhanced downloadXLSX with HTML approach first, then reliable XLSX fallback
  const downloadXLSX = () => {
    if (data.length === 0) {
      alert("No data to download")
      return
    }

    const headers = [
      'AWB (No Resi)',
      'Pengirim', 
      'Penerima',
      'Coli',
      'Kg',
      'Harga (Ongkir)',
      'Admin',
      'Packaging',
      'Cash',
      'Transfer', 
      'COD',
      'Wilayah'
    ]

    const formattedData = data.map(item => ({
      'AWB (No Resi)': item.awb_no,
      'Pengirim': item.nama_pengirim,
      'Penerima': item.nama_penerima,
      'Coli': item.coli,
      'Kg': item.berat_kg,
      'Harga (Ongkir)': item.harga_per_kg || item.ongkir || 0,
      'Admin': item.biaya_admin || item.admin || 0,
      'Packaging': item.biaya_packaging || 0,
      'Cash': item.metode_pembayaran === 'cash' ? item.total : 0,
      'Transfer': item.metode_pembayaran === 'transfer' ? item.total : 0,
      'COD': item.metode_pembayaran === 'cod' ? item.total : 0,
      'Wilayah': item.wilayah
    }))

    const today = new Date().toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    // Create date range string if filters are applied
    let dateRange = ''
    if (selectedDateFrom || selectedDateTo) {
      if (selectedDateFrom && selectedDateTo) {
        // Convert YYYY-MM-DD to DD-MM-YYYY format
        const fromFormatted = selectedDateFrom.split('-').reverse().join('-')
        const toFormatted = selectedDateTo.split('-').reverse().join('-')
        dateRange = `${fromFormatted} s/d ${toFormatted}`
      } else if (selectedDateFrom) {
        const fromFormatted = selectedDateFrom.split('-').reverse().join('-')
        dateRange = `Dari ${fromFormatted}`
      } else if (selectedDateTo) {
        const toFormatted = selectedDateTo.split('-').reverse().join('-')
        dateRange = `Sampai ${toFormatted}`
      }
    }

    // Try HTML approach first for guaranteed styling
    createStyledExcelWithHTML({
      title: 'Daily Report',
      headers,
      data: formattedData,
      fileName: `daily_report_${today.replace(/\s+/g, '_')}.xls`,
      currency: 'Rp',
      currencyColumns: [5, 6, 7, 8, 9, 10], // Currency columns
      numberColumns: [3, 4], // Number columns
      dateRange: dateRange // Use formatted date range
    })
  }

  // Tambahkan fungsi handlePrint di dalam komponen, misalnya setelah fungsi downloadXLSX
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-100 mb-4">Daily Report</h2>
      
      <div className="mb-4 flex flex-wrap items-center gap-2 no-print">
        {/* Date Range Filter */}
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filter by Date From:</label>
        <input
          type="date"
          value={selectedDateFrom}
          onChange={(e) => setSelectedDateFrom(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
        />

        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filter by Date To:</label>
        <input
          type="date"
          value={selectedDateTo}
          onChange={(e) => setSelectedDateTo(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
        />
        
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filter by Kirim Via:</label>
        <select
          value={selectedKirimVia}
          onChange={(e) => setSelectedKirimVia(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
        >
          <option value="">Semua</option>
          <option value="udara">Udara</option>
          <option value="darat">Darat</option>
        </select>
        
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filter by Agent/Customer:</label>
        <select
          value={selectedAgentCustomer}
          onChange={(e) => setSelectedAgentCustomer(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
        >
          <option value="">Semua</option>
          {agentList.map((agent) => (
            <option key={agent} value={agent}>
              {agent}
            </option>
          ))}
        </select>
        
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filter by Kota Tujuan:</label>
        <select
          value={selectedKotaTujuan}
          onChange={(e) => setSelectedKotaTujuan(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
        >
          <option value="">Semua</option>
          {kotaTujuan.map((kota) => (
            <option key={kota} value={kota}>
              {kota.toUpperCase()} 
            </option>
          ))}
        </select>
        
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filter by Wilayah:</label>
        <select
          value={selectedWilayah}
          onChange={(e) => setSelectedWilayah(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
        >
          <option value="">Semua</option>
          {wilayahOptions.map((wilayah) => (
            <option key={wilayah} value={wilayah}>
              {wilayah.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      {/* Tombol Download XLSX dan Print, tambahkan class no-print */}
      {data.length > 0 && (
        <div className="mb-4 flex justify-end no-print">
          <button
            onClick={downloadXLSX}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-800 mr-2 transition-colors"
          >
            Download XLSX
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded hover:bg-red-700 dark:hover:bg-red-800 transition-colors"
          >
            Print
          </button>
        </div>
      )}

      {error && <div className="mb-2 p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded border border-red-200 dark:border-red-800">{error}</div>}
      {loading ? (
        <div className="text-center py-4 text-gray-600 dark:text-gray-400">Loading...</div>
      ) : (
        <>
          <div className="overflow-x-auto w-full bg-white dark:bg-gray-800 rounded shadow sm:overflow-visible border border-gray-200 dark:border-gray-700">
            <table className="min-w-full text-sm divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-blue-50 dark:bg-blue-900/50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">No</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">AWB (No Resi)</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">Pengirim</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">Penerima</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">Coli</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">Kg</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">Harga(Ongkir)</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">Admin</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">Packaging</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 bg-blue-100 dark:bg-blue-800 text-gray-900 dark:text-gray-100">Cash</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 bg-blue-100 dark:bg-blue-800 text-gray-900 dark:text-gray-100">Transfer</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 bg-blue-100 dark:bg-blue-800 text-gray-900 dark:text-gray-100">COD</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">Wilayah</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, index) => (
                  <tr key={item.awb_no || `item-${index}`} className="even:bg-gray-50 dark:even:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{index + 1}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{item.awb_no}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{item.nama_pengirim}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{item.nama_penerima}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{item.coli}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{item.berat_kg}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{item.harga_per_kg || item.ongkir}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{item.biaya_admin || item.admin || 0}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{item.biaya_packaging || 0}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-blue-100 dark:bg-blue-800 text-gray-900 dark:text-gray-100">
                      {item.metode_pembayaran === 'cash' ? `Rp. ${(item.total || 0).toLocaleString('en-US')}` : 'Rp. 0'}
                    </td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-blue-100 dark:bg-blue-800 text-gray-900 dark:text-gray-100">
                      {item.metode_pembayaran === 'transfer' ? `Rp. ${(item.total || 0).toLocaleString('en-US')}` : 'Rp. 0'}
                    </td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-blue-100 dark:bg-blue-800 text-gray-900 dark:text-gray-100">
                      {item.metode_pembayaran === 'cod' ? `Rp. ${(item.total || 0).toLocaleString('en-US')}` : 'Rp. 0'}
                    </td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{item.wilayah}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.length > 0 && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Total Keseluruhan:</h3>
              <p className="text-gray-800 dark:text-gray-200">Total Cash: Rp. {data.filter(item => item.metode_pembayaran === 'cash').reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString('en-US')}</p>
              <p className="text-gray-800 dark:text-gray-200">Total Transfer: Rp. {data.filter(item => item.metode_pembayaran === 'transfer').reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString('en-US')}</p>
              <p className="text-gray-800 dark:text-gray-200">Total COD: Rp. {data.filter(item => item.metode_pembayaran === 'cod').reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString('en-US')}</p>
              <p className="text-gray-800 dark:text-gray-200">Total Semua: Rp. {data.reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString('en-US')}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
} 