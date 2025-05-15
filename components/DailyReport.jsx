"use client"

import { useState, useEffect } from "react"
import { supabaseClient } from "../lib/auth"
import * as XLSX from 'xlsx'

const kotaTujuan = ["bangka", "kalimantan barat", "belitung", "bali"];  // Daftar kota tujuan dari konteks lain

export default function DailyReport() {
  const [data, setData] = useState([])  // State untuk menyimpan data laporan
  const [selectedDate, setSelectedDate] = useState("")  // State untuk filter tanggal
  const [selectedKirimVia, setSelectedKirimVia] = useState("")  // State untuk filter kirim via
  const [selectedAgentCustomer, setSelectedAgentCustomer] = useState("")  // State untuk filter Agent/Customer
  const [selectedKotaTujuan, setSelectedKotaTujuan] = useState("")  // State baru untuk filter kota tujuan
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

  // Fetch data berdasarkan filter yang dipilih, termasuk kota tujuan
  useEffect(() => {
    if (selectedDate || selectedKirimVia || selectedAgentCustomer || selectedKotaTujuan) {
      fetchDailyReport()
    }
  }, [selectedDate, selectedKirimVia, selectedAgentCustomer, selectedKotaTujuan])  // Tambahkan selectedKotaTujuan ke dependencies

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
      if (selectedKotaTujuan) {  // Tambahkan filter untuk kota tujuan
        query = query.eq("kota_tujuan", selectedKotaTujuan)
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

  // Fungsi untuk download XLSX berdasarkan data yang sudah difilter
  const downloadXLSX = () => {
    if (data.length === 0) {
      alert("No data to download")
      return
    }

    const today = new Date().toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).toUpperCase();
    
    const dataHeaders = ['No', 'AWB (No Resi)', 'Pengirim', 'Penerima', 'Coli', 'Kg', 'Harga (Ongkir)', 'Admin', 'Packaging', 'Cash', 'Transfer', 'COD', 'Wilayah'].map(header => header.toUpperCase());
    const dataRows = data.map((item, index) => [
      index + 1,
      item.awb_no,
      item.nama_pengirim,
      item.nama_penerima,
      item.coli,
      item.berat_kg,
      item.harga_per_kg || item.ongkir,
      (item.biaya_admin || item.admin || 0),
      (item.biaya_packaging || 0),
      item.metode_pembayaran === 'cash' ? item.total : 0,
      item.metode_pembayaran === 'transfer' ? item.total : 0,
      item.metode_pembayaran === 'cod' ? item.total : 0,
      item.wilayah
    ]);
    
    const totalCash = data.filter(item => item.metode_pembayaran === 'cash').reduce((sum, item) => sum + (item.total || 0), 0);
    const totalTransfer = data.filter(item => item.metode_pembayaran === 'transfer').reduce((sum, item) => sum + (item.total || 0), 0);
    const totalCOD = data.filter(item => item.metode_pembayaran === 'cod').reduce((sum, item) => sum + (item.total || 0), 0);
    const totalSemua = data.reduce((sum, item) => sum + (item.total || 0), 0);
    const totalsRow = ['Total Keseluruhan', '', '', '', '', '', '', '', '', totalCash, totalTransfer, totalCOD, totalSemua].map(text => typeof text === 'string' ? text.toUpperCase() : text);
    
    const allRows = [['Report dibuat pada: ' + today], dataHeaders, ...dataRows, totalsRow];
    
    const worksheet = XLSX.utils.aoa_to_sheet(allRows);
    
    // Setel lebar kolom berdasarkan panjang header (approximasi)
    worksheet['!cols'] = [
      { wch: 5 },   // No
      { wch: 15 },  // AWB (No Resi)
      { wch: 15 },  // Pengirim
      { wch: 15 },  // Penerima
      { wch: 10 },  // Coli
      { wch: 5 },   // Kg
      { wch: 12 },  // Harga (Ongkir)
      { wch: 10 },  // Admin
      { wch: 12 },  // Packaging
      { wch: 10 },  // Cash
      { wch: 12 },  // Transfer
      { wch: 10 },  // COD
      { wch: 15 }   // Wilayah
    ];
    
    // Setel border, bold untuk header, tanggal, dan total
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    for (let rowNum = range.s.r; rowNum <= range.e.r; rowNum++) {
      for (let colNum = range.s.c; colNum <= range.e.c; colNum++) {
        const cellAddress = XLSX.utils.encode_cell({ r: rowNum, c: colNum });
        if (!worksheet[cellAddress]) continue;
        
        // Bold untuk baris tanggal (baris 0), header (baris 1), dan total (baris terakhir)
        if (rowNum === 0 || rowNum === 1 || rowNum === range.e.r) {  // Baris 0: tanggal, Baris 1: header, Baris terakhir: total
          worksheet[cellAddress].s = {
            font: { bold: true },
            border: {
              top: { style: "thin" },
              bottom: { style: "thin" },
              left: { style: "thin" },
              right: { style: "thin" }
            }
          };
        } else {
          // Border untuk seluruh tabel
          worksheet[cellAddress].s = {
            border: {
              top: { style: "thin" },
              bottom: { style: "thin" },
              left: { style: "thin" },
              right: { style: "thin" }
            }
          };
          
          // Format angka untuk kolom yang relevan
          if (colNum >= 7 && colNum <= 11 && typeof worksheet[cellAddress].v === 'number') {  // Kolom 8-12 (indeks 7-11: Admin, Packaging, Cash, Transfer, COD)
            worksheet[cellAddress].z = '"rp." #,##0';  // Format sebagai "rp. 20,000"
            worksheet[cellAddress].t = 's';  // Treat as string
          }
        }
      }
    }
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Daily Report');
    
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `daily_report_${today.replace(/\//g, '-')}.xlsx`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Tambahkan fungsi handlePrint di dalam komponen, misalnya setelah fungsi downloadXLSX
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold text-blue-900 mb-4">Daily Report</h2>
      
      <div className="mb-4 flex flex-wrap items-center gap-2 no-print">
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
        
        <label className="text-sm font-semibold">Filter by Kota Tujuan:</label>
        <select
          value={selectedKotaTujuan}
          onChange={(e) => setSelectedKotaTujuan(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="">Semua</option>
          {kotaTujuan.map((kota) => (
            <option key={kota} value={kota}>
              {kota.toUpperCase()} 
            </option>
          ))}
        </select>
      </div>

      {/* Tombol Download XLSX dan Print, tambahkan class no-print */}
      {data.length > 0 && (
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
                    <td className="px-4 py-2 border border-gray-300">{item.biaya_admin || item.admin || 0}</td>
                    <td className="px-4 py-2 border border-gray-300">{item.biaya_packaging || 0}</td>
                    <td className="px-4 py-2 border border-gray-300 bg-blue-100">
                      {item.metode_pembayaran === 'cash' ? `Rp. ${(item.total || 0).toLocaleString('en-US')}` : 'Rp. 0'}
                    </td>
                    <td className="px-4 py-2 border border-gray-300 bg-blue-100">
                      {item.metode_pembayaran === 'transfer' ? `Rp. ${(item.total || 0).toLocaleString('en-US')}` : 'Rp. 0'}
                    </td>
                    <td className="px-4 py-2 border border-gray-300 bg-blue-100">
                      {item.metode_pembayaran === 'cod' ? `Rp. ${(item.total || 0).toLocaleString('en-US')}` : 'Rp. 0'}
                    </td>
                    <td className="px-4 py-2 border border-gray-300">{item.wilayah}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.length > 0 && (
            <div className="mt-4 p-4 bg-blue-50 rounded border border-blue-200">
              <h3 className="text-sm font-semibold">Total Keseluruhan:</h3>
              <p>Total Cash: Rp. {data.filter(item => item.metode_pembayaran === 'cash').reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString('en-US')}</p>
              <p>Total Transfer: Rp. {data.filter(item => item.metode_pembayaran === 'transfer').reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString('en-US')}</p>
              <p>Total COD: Rp. {data.filter(item => item.metode_pembayaran === 'cod').reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString('en-US')}</p>
              <p>Total Semua: Rp. {data.reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString('en-US')}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
} 