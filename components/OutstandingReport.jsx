"use client"

import { useState, useEffect } from "react"
import { supabaseClient } from "../lib/auth"
import * as XLSX from 'xlsx'
import { FaDownload, FaPrint } from 'react-icons/fa'

export default function OutstandingReport() {
  const [agentList, setAgentList] = useState([])
  const [selectedAgent, setSelectedAgent] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [outstandingData, setOutstandingData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetchAgents()
    fetchOutstandingData()
  }, [selectedAgent, startDate, endDate])

  async function fetchAgents() {
    try {
      const { data, error } = await supabaseClient
        .from("manifest")
        .select("agent_customer")
      
      if (error) throw error
      
      const distinctAgents = [...new Set(data.map(item => item.agent_customer).filter(Boolean))]
      setAgentList(distinctAgents)
    } catch (err) {
      console.error("Error fetching agents:", err)
      setError("Failed to fetch agents")
    }
  }

  async function fetchOutstandingData() {
    setLoading(true)
    try {
      let query = supabaseClient
        .from("manifest")
        .select(`
          awb_no,
          awb_date,
          kota_tujuan,
          nama_pengirim,
          nama_penerima,
          total,
          agent_customer
        `)
        .eq("buktimembayar", false)

      if (selectedAgent) {
        query = query.eq("agent_customer", selectedAgent)
      }

      if (startDate) {
        query = query.gte("awb_date", startDate)
      }

      if (endDate) {
        query = query.lte("awb_date", endDate)
      }

      const { data, error } = await query

      if (error) throw error

      // Process the data to include payment information
      const processedData = await Promise.all(
        data.map(async (item) => {
          // Get total paid amount from pelunasan table
          const { data: paymentData, error: paymentError } = await supabaseClient
            .from("pelunasan")
            .select("final_amount")
            .eq("awb_no", item.awb_no)

          if (paymentError) throw paymentError

          const totalPaid = paymentData.reduce((sum, payment) => sum + (payment.final_amount || 0), 0)
          const remainingDebt = (item.total || 0) - totalPaid

          return {
            ...item,
            total_paid: totalPaid,
            remaining_debt: remainingDebt
          }
        })
      )

      setOutstandingData(processedData)
    } catch (err) {
      console.error("Error fetching outstanding data:", err)
      setError("Failed to fetch outstanding data")
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadXLSX = () => {
    if (outstandingData.length === 0) {
      alert("No data to download");
      return;
    }
    const today = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase();
    const dataHeaders = ['No', 'No AWB', 'Tanggal', 'Kota Tujuan', 'Pengirim', 'Penerima', 'Total Ongkir', 'Total Dibayar', 'Sisa Piutang'].map(header => header.toUpperCase());
    const dataRows = outstandingData.map((item, index) => [
      index + 1,
      item.awb_no,
      item.awb_date,
      item.kota_tujuan,
      item.nama_pengirim,
      item.nama_penerima,
      item.total || 0,
      item.total_paid || 0,
      item.remaining_debt || 0
    ]);

    const totalOngkirSum = outstandingData.reduce((sum, item) => sum + (item.total || 0), 0);
    const totalDibayarSum = outstandingData.reduce((sum, item) => sum + (item.total_paid || 0), 0);
    const totalSisaPiutangSum = outstandingData.reduce((sum, item) => sum + (item.remaining_debt || 0), 0);

    const totalsRow = ['Total Keseluruhan', '', '', '', '', '', totalOngkirSum, totalDibayarSum, totalSisaPiutangSum];

    const allRows = [['Report dibuat pada: ' + today], dataHeaders, ...dataRows, totalsRow];

    const worksheet = XLSX.utils.aoa_to_sheet(allRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Outstanding Report")
    XLSX.writeFile(workbook, `outstanding_report_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    printWindow.document.write(`
      <html>
        <head>
          <title>Outstanding Report</title>
          <style>
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid black; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h2>Outstanding Report</h2>
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>No AWB</th>
                <th>Tanggal</th>
                <th>Kota Tujuan</th>
                <th>Pengirim</th>
                <th>Penerima</th>
                <th>Total Ongkir</th>
                <th>Total Dibayar</th>
                <th>Sisa Piutang</th>
              </tr>
            </thead>
            <tbody>
              ${outstandingData.map((item, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${item.awb_no}</td>
                  <td>${item.awb_date}</td>
                  <td>${item.kota_tujuan}</td>
                  <td>${item.nama_pengirim}</td>
                  <td>${item.nama_penerima}</td>
                  <td>Rp. ${item.total}</td>
                  <td>Rp. ${item.total_paid}</td>
                  <td>Rp. ${item.remaining_debt}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div style="margin-top: 20px; padding: 10px; background-color: #e0f2f7; border: 1px solid #b0bec5; border-radius: 4px;">
            <h3 style="font-weight: bold; margin-bottom: 10px;">Total:</h3>
            <p>Total Ongkir: Rp. ${outstandingData.reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString('en-US')}</p>
            <p>Total Dibayar: Rp. ${outstandingData.reduce((sum, item) => sum + (item.total_paid || 0), 0).toLocaleString('en-US')}</p>
            <p>Total Sisa Piutang: Rp. ${outstandingData.reduce((sum, item) => sum + (item.remaining_debt || 0), 0).toLocaleString('en-US')}</p>
          </div>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  return (
    <div className="p-4">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-blue-900 mb-4">Outstanding Report</h2>
        
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Agent/Customer</label>
            <select
              className="w-full border rounded-md px-3 py-2"
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
            >
              <option value="">All Agents</option>
              {agentList.map((agent) => (
                <option key={agent} value={agent}>
                  {agent}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              className="w-full border rounded-md px-3 py-2"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              className="w-full border rounded-md px-3 py-2"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 mb-4">
          <button
            onClick={handleDownloadXLSX}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mr-2 flex items-center gap-2"
          >
            <FaDownload /> Download XLSX
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-2"
          >
            <FaPrint /> Print
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 border-collapse">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left border border-gray-300">No</th>
                <th className="px-4 py-2 text-left border border-gray-300">No AWB</th>
                <th className="px-4 py-2 text-left border border-gray-300">Tanggal</th>
                <th className="px-4 py-2 text-left border border-gray-300">Kota Tujuan</th>
                <th className="px-4 py-2 text-left border border-gray-300">Pengirim</th>
                <th className="px-4 py-2 text-left border border-gray-300">Penerima</th>
                <th className="px-4 py-2 text-right border border-gray-300">Total Ongkir</th>
                <th className="px-4 py-2 text-right border border-gray-300">Total Dibayar</th>
                <th className="px-4 py-2 text-right border border-gray-300">Sisa Piutang</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="px-4 py-2 text-center border border-gray-300">
                    Loading...
                  </td>
                </tr>
              ) : outstandingData.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-4 py-2 text-center border border-gray-300">
                    No outstanding data found
                  </td>
                </tr>
              ) : (
                outstandingData.map((item, index) => (
                  <tr key={item.awb_no} className="hover:bg-gray-50">
                    <td className="px-4 py-2 border border-gray-300">{index + 1}</td>
                    <td className="px-4 py-2 border border-gray-300">{item.awb_no}</td>
                    <td className="px-4 py-2 border border-gray-300">{item.awb_date}</td>
                    <td className="px-4 py-2 border border-gray-300">{item.kota_tujuan}</td>
                    <td className="px-4 py-2 border border-gray-300">{item.nama_pengirim}</td>
                    <td className="px-4 py-2 border border-gray-300">{item.nama_penerima}</td>
                    <td className="px-4 py-2 text-right border border-gray-300">Rp. {item.total}</td>
                    <td className="px-4 py-2 text-right border border-gray-300">Rp. {item.total_paid}</td>
                    <td className="px-4 py-2 text-right font-bold border border-gray-300">Rp. {item.remaining_debt}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {outstandingData.length > 0 && (
          <div className="mt-4 p-4 bg-blue-50 rounded border border-blue-200 flex flex-row flex-wrap items-center gap-4">
            <h3 className="text-sm font-semibold">Total:</h3>
            <p>Total Ongkir: Rp. {outstandingData.reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString('en-US')}</p>
            <p>Total Dibayar: Rp. {outstandingData.reduce((sum, item) => sum + (item.total_paid || 0), 0).toLocaleString('en-US')}</p>
            <p>Total Sisa Piutang: Rp. {outstandingData.reduce((sum, item) => sum + (item.remaining_debt || 0), 0).toLocaleString('en-US')}</p>
          </div>
        )}
      </div>
    </div>
  )
} 