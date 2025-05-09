"use client"

import { useState, useEffect } from "react"
import { supabaseClient } from "../lib/auth"

export default function PelunasanResi() {
  const [activeTab, setActiveTab] = useState("history") // "history" or "add"
  const [paymentHistory, setPaymentHistory] = useState([])
  const [unpaidData, setUnpaidData] = useState([])
  const [search, setSearch] = useState("")
  const [agentList, setAgentList] = useState([])
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Fetch payment history on component mount
  useEffect(() => {
    fetchPaymentHistory()
    fetchUnpaidData()
    fetchAgents()
  }, [])

  async function fetchPaymentHistory() {
    setLoading(true)
    try {
      const { data, error } = await supabaseClient
        .from("pelunasan")
        .select("*")
        .order("payment_date", { ascending: false })

      if (error) {
        console.error("Error fetching payment history:", error)
        setError(`Error fetching payment history: ${error.message}`)
      } else {
        setPaymentHistory(data || [])
      }
    } catch (err) {
      console.error("Unexpected error:", err)
      setError(`Unexpected error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function fetchUnpaidData() {
    try {
      // Only fetch unpaid manifests (buktimembayar = false or null)
      const { data: fetchedData, error } = await supabaseClient
        .from("manifest")
        .select("awb_no, awb_date, nama_pengirim, nama_penerima, total, buktimembayar, potongan, agent_customer")
        .eq("buktimembayar", false)

      if (error) {
        console.error("Error fetching unpaid data:", error)
        setError(`Error fetching unpaid data: ${error.message}`)
      } else {
        // Calculate discounted total for each row
        const processedData = fetchedData.map((row, index) => {
          const potongan = Number(row.potongan || 0)
          const originalTotal = Number(row.total || 0)
          const discountedTotal = originalTotal - potongan

          return {
            ...row,
            balance: originalTotal,
            potongan: potongan,
            discountedTotal: discountedTotal,
            index,
            selected: false,
          }
        })

        setUnpaidData(processedData)
      }
    } catch (err) {
      console.error("Unexpected error fetching unpaid data:", err)
      setError(`Unexpected error: ${err.message}`)
    }
  }

  async function fetchAgents() {
    try {
      const { data, error } = await supabaseClient.from("manifest").select("agent_customer")
      if (error) {
        console.error("Error fetching agents:", error)
      } else {
        const distinctAgents = [...new Set(data.map((item) => item.agent_customer).filter(Boolean))]
        setAgentList(distinctAgents)
      }
    } catch (err) {
      console.error("Unexpected error in fetchAgents:", err)
    }
  }

  const handleRowChange = (index, field, value) => {
    setUnpaidData((prevData) => {
      const newData = [...prevData]
      const dataIndex = newData.findIndex((item) => item.index === index)

      if (dataIndex === -1) return prevData

      if (field === "selected") {
        newData[dataIndex].selected = value
      } else if (field === "potongan") {
        const newPotongan = Number(value) || 0
        const balance = Number(newData[dataIndex].balance) || 0
        newData[dataIndex].potongan = newPotongan
        newData[dataIndex].discountedTotal = balance - newPotongan
      }

      return newData
    })
  }

  const handleSelectAll = (checked) => {
    setUnpaidData((prevData) =>
      prevData.map((row) => ({
        ...row,
        selected: checked,
      })),
    )
  }

  const handleSaveChanges = async () => {
    const selectedRows = unpaidData.filter((row) => row.selected)

    if (selectedRows.length === 0) {
      setError("No items selected for payment")
      return
    }

    setLoading(true)
    setError("")

    try {
      // Process each selected row
      for (const row of selectedRows) {
        // 1. Insert into pelunasan table
        const { error: insertError } = await supabaseClient.from("pelunasan").insert({
          awb_no: row.awb_no,
          awb_date: row.awb_date,
          nama_pengirim: row.nama_pengirim,
          nama_penerima: row.nama_penerima,
          original_amount: row.balance,
          discount: row.potongan,
          final_amount: row.discountedTotal,
          agent_customer: row.agent_customer,
          payment_date: new Date().toISOString().split("T")[0],
        })

        if (insertError) {
          console.error(`Error inserting row with AWB ${row.awb_no} to pelunasan:`, insertError)
          throw insertError
        }

        // 2. Update manifest table to mark as paid
        const { error: updateError } = await supabaseClient
          .from("manifest")
          .update({
            buktimembayar: true,
            potongan: row.potongan || 0,
            total: row.discountedTotal,
          })
          .eq("awb_no", row.awb_no)

        if (updateError) {
          console.error(`Error updating row with AWB ${row.awb_no}:`, updateError)
          throw updateError
        }
      }

      // Success - refresh data
      alert(`Successfully processed ${selectedRows.length} payments!`)
      fetchPaymentHistory()
      fetchUnpaidData()
    } catch (err) {
      console.error("Error processing payments:", err)
      setError(`Error processing payments: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Calculate the sum of selected items
  const calculateTotalSelected = () => {
    return unpaidData.filter((row) => row.selected).reduce((sum, row) => sum + Number(row.discountedTotal || 0), 0)
  }

  // Download payment history as CSV
  const downloadCSV = () => {
    if (paymentHistory.length === 0) {
      alert("No payment data to download")
      return
    }

    // Create CSV header
    const headers = [
      "No Bukti",
      "Tgl Bayar",
      "Pengirim",
      "Penerima",
      "Agent/Customer",
      "Original Amount",
      "Discount",
      "Final Amount",
    ]

    // Create CSV rows
    const rows = paymentHistory.map((item) => [
      item.awb_no,
      item.payment_date,
      item.nama_pengirim,
      item.nama_penerima,
      item.agent_customer,
      item.original_amount,
      item.discount,
      item.final_amount,
    ])

    // Combine header and rows
    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n")

    // Create a blob and download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `payment_history_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Filter unpaid data based on search and selected agent
  const filteredUnpaidData = unpaidData.filter(
    (row) =>
      (selectedAgent ? row.agent_customer === selectedAgent : true) &&
      (search
        ? row.awb_no?.toLowerCase().includes(search.toLowerCase()) ||
          row.nama_pengirim?.toLowerCase().includes(search.toLowerCase()) ||
          row.nama_penerima?.toLowerCase().includes(search.toLowerCase())
        : true),
  )

  // Filter payment history based on search
  const filteredPaymentHistory = paymentHistory.filter(
    (row) =>
      row.awb_no?.toLowerCase().includes(search.toLowerCase()) ||
      row.nama_pengirim?.toLowerCase().includes(search.toLowerCase()) ||
      row.nama_penerima?.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-blue-900">Pelunasan Resi</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 rounded-md ${
              activeTab === "history" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"
            }`}
          >
            Payment History
          </button>
          <button
            onClick={() => setActiveTab("add")}
            className={`px-4 py-2 rounded-md ${
              activeTab === "add" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"
            }`}
          >
            Add Payment
          </button>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">{error}</div>}

      {/* Search bar */}
      <div className="flex items-center gap-2 mb-2">
        <span>Search:</span>
        <input
          className="border rounded px-2 py-1 text-sm flex-grow"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by AWB, pengirim, penerima"
        />
      </div>

      {/* Payment History Tab */}
      {activeTab === "history" && (
        <div>
          <div className="flex justify-end mb-2">
            <button
              onClick={downloadCSV}
              className="px-4 py-2 bg-green-100 text-white rounded-md hover:bg-green-100 opacity-100 block"
              disabled={paymentHistory.length === 0}
            >
              Download CSV
            </button>
          </div>

          {loading ? (
            <div className="text-center py-4">Loading payment history...</div>
          ) : filteredPaymentHistory.length === 0 ? (
            <div className="text-center py-4 bg-gray-50 rounded-md">No payment history found</div>
          ) : (
            <div className="overflow-x-auto bg-white rounded shadow border max-w-full w-full">
              <table className="min-w-full text-sm table-auto">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="px-2 py-2">No Bukti</th>
                    <th className="px-2 py-2">Tgl Bayar</th>
                    <th className="px-2 py-2">Pengirim</th>
                    <th className="px-2 py-2">Penerima</th>
                    <th className="px-2 py-2">Agent/Customer</th>
                    <th className="px-2 py-2">Original Amount</th>
                    <th className="px-2 py-2">Discount</th>
                    <th className="px-2 py-2">Final Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPaymentHistory.map((row) => (
                    <tr key={row.id} className="even:bg-blue-50">
                      <td className="px-2 py-1">{row.awb_no}</td>
                      <td className="px-2 py-1">{row.payment_date}</td>
                      <td className="px-2 py-1">{row.nama_pengirim}</td>
                      <td className="px-2 py-1">{row.nama_penerima}</td>
                      <td className="px-2 py-1">{row.agent_customer}</td>
                      <td className="px-2 py-1 text-right">{row.original_amount}</td>
                      <td className="px-2 py-1 text-right">{row.discount}</td>
                      <td className="px-2 py-1 text-right font-bold">{row.final_amount}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100">
                    <td colSpan={5} className="px-2 py-2 text-right font-bold">
                      Total:
                    </td>
                    <td colSpan={3} className="px-2 py-2 text-right font-bold">
                      {filteredPaymentHistory.reduce((sum, row) => sum + Number(row.final_amount || 0), 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Payment Tab */}
      {activeTab === "add" && (
        <div>
          {/* Agent Selection Section */}
          <div className="mb-4">
            <label className="block text-xs font-semibold mb-1">Pilih Agent/Customer:</label>
            <select
              className="border rounded px-2 py-1 text-sm w-full"
              onChange={(e) => setSelectedAgent(e.target.value)}
              value={selectedAgent || ""}
            >
              <option value="">Pilih Agent</option>
              {agentList.map((agent) => (
                <option key={agent} value={agent}>
                  {agent}
                </option>
              ))}
            </select>
          </div>

          {/* Unpaid Shipments Table */}
          {loading ? (
            <div className="text-center py-4">Loading data...</div>
          ) : filteredUnpaidData.length === 0 ? (
            <div className="text-center py-4 bg-gray-50 rounded-md">No unpaid shipments found</div>
          ) : (
            <>
              <div className="overflow-x-auto bg-white rounded shadow border max-w-full w-full">
                <table className="min-w-full text-sm table-auto">
                  <thead>
                    <tr className="bg-blue-600 text-white">
                      <th className="px-2 py-2">
                        <input
                          type="checkbox"
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="w-4 h-4"
                        />
                      </th>
                      <th className="px-2 py-2">No STTB</th>
                      <th className="px-2 py-2">Tgl STTB</th>
                      <th className="px-2 py-2">Pengirim</th>
                      <th className="px-2 py-2">Penerima</th>
                      <th className="px-2 py-2">Balance</th>
                      <th className="px-2 py-2">Discount</th>
                      <th className="px-2 py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUnpaidData.map((row) => (
                      <tr key={row.awb_no} className="even:bg-blue-50">
                        <td className="px-2 py-1 text-center">
                          <input
                            type="checkbox"
                            checked={row.selected || false}
                            onChange={(e) => handleRowChange(row.index, "selected", e.target.checked)}
                            className="w-4 h-4"
                          />
                        </td>
                        <td className="px-2 py-1">{row.awb_no}</td>
                        <td className="px-2 py-1">{row.awb_date}</td>
                        <td className="px-2 py-1">{row.nama_pengirim}</td>
                        <td className="px-2 py-1">{row.nama_penerima}</td>
                        <td className="px-2 py-1 text-right">{row.balance}</td>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            value={row.potongan || 0}
                            onChange={(e) => handleRowChange(row.index, "potongan", e.target.value)}
                            className="border rounded px-1 py-1 w-full"
                          />
                        </td>
                        <td className="px-2 py-1 text-right font-bold">{row.discountedTotal}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100">
                      <td colSpan={5} className="px-2 py-2 text-right font-bold">
                        Total Selected:
                      </td>
                      <td colSpan={3} className="px-2 py-2 text-right font-bold">
                        {calculateTotalSelected()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex justify-center mt-4">
                <button
                  onClick={handleSaveChanges}
                  disabled={loading || unpaidData.filter((row) => row.selected).length === 0}
                  className="px-6 py-2 bg-blue-600 text-white font-bold rounded shadow-lg hover:bg-blue-700 transition text-base disabled:bg-gray-400"
                >
                  {loading ? "Processing..." : "Process Payment"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
