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
    const worksheet = XLSX.utils.json_to_sheet(
      outstandingData.map((item, index) => ({
        No: index + 1,
        "No AWB": item.awb_no,
        "Tanggal": item.awb_date,
        "Kota Tujuan": item.kota_tujuan,
        "Pengirim": item.nama_pengirim,
        "Penerima": item.nama_penerima,
        "Total Ongkir": item.total,
        "Total Dibayar": item.total_paid,
        "Sisa Piutang": item.remaining_debt
      }))
    )

    const workbook = XLSX.utils.book_new()
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
          <table className="min-w-full bg-white border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">No</th>
                <th className="px-4 py-2 text-left">No AWB</th>
                <th className="px-4 py-2 text-left">Tanggal</th>
                <th className="px-4 py-2 text-left">Kota Tujuan</th>
                <th className="px-4 py-2 text-left">Pengirim</th>
                <th className="px-4 py-2 text-left">Penerima</th>
                <th className="px-4 py-2 text-right">Total Ongkir</th>
                <th className="px-4 py-2 text-right">Total Dibayar</th>
                <th className="px-4 py-2 text-right">Sisa Piutang</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="px-4 py-2 text-center">
                    Loading...
                  </td>
                </tr>
              ) : outstandingData.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-4 py-2 text-center">
                    No outstanding data found
                  </td>
                </tr>
              ) : (
                outstandingData.map((item, index) => (
                  <tr key={item.awb_no} className="hover:bg-gray-50">
                    <td className="px-4 py-2">{index + 1}</td>
                    <td className="px-4 py-2">{item.awb_no}</td>
                    <td className="px-4 py-2">{item.awb_date}</td>
                    <td className="px-4 py-2">{item.kota_tujuan}</td>
                    <td className="px-4 py-2">{item.nama_pengirim}</td>
                    <td className="px-4 py-2">{item.nama_penerima}</td>
                    <td className="px-4 py-2 text-right">Rp. {item.total}</td>
                    <td className="px-4 py-2 text-right">Rp. {item.total_paid}</td>
                    <td className="px-4 py-2 text-right font-bold">Rp. {item.remaining_debt}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
} 