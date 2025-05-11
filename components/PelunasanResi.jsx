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
  const [expandedGroups, setExpandedGroups] = useState({})

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

  // Function to toggle expansion
  const toggleGroup = (date) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [date]: !prev[date],  // Toggle the state for the specific date
    }));
  };

  // Add this new function to format the date
  const formatDateToInvoice = (dateString) => {
    const [year, month, day] = dateString.split('-');  // Assuming date is in YYYY-MM-DD format
    return `INV/${year}/${month}/${day}`;
  };

  // Add this new function to group payment history by payment_date
  const groupPaymentHistoryByDate = (history) => {
    const grouped = history.reduce((acc, item) => {
      const date = item.payment_date;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(item);
      return acc;
    }, {});

    return Object.entries(grouped).map(([date, items]) => ({
      date,
      items,
    }));
  };

  // Filter unpaid data based on search and selected agent
  const filteredUnpaidData = unpaidData.filter(
    (row) =>
      (selectedAgent ? row.agent_customer?.toLowerCase() === selectedAgent.toLowerCase() : true) &&
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

  // Now compute groupedHistory after the function is defined
  const groupedHistory = groupPaymentHistoryByDate(filteredPaymentHistory);

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
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition"
              disabled={paymentHistory.length === 0}
            >
              Download CSV
            </button>
          </div>

          {loading ? (
            <div className="text-center py-4">Loading payment history...</div>
          ) : paymentHistory.length === 0 ? (
            <div className="text-center py-4 bg-gray-50 rounded-md">No payment history found</div>
          ) : (
            <div className="space-y-4">
              {groupedHistory.map((group) => {
                const formattedDate = formatDateToInvoice(group.date);
                const totalSTTB = group.items.length;
                const totalPayment = group.items.reduce((sum, row) => sum + Number(row.final_amount || 0), 0);
                const isExpanded = expandedGroups[group.date];

                return (
                  <div key={group.date} className="bg-white shadow-md rounded-lg p-4 border border-gray-200">
                    <button
                      onClick={() => toggleGroup(group.date)}
                      className="w-full text-left text-lg font-bold text-blue-600 hover:underline flex justify-between items-center"
                    >
                      <span>{formattedDate}</span>
                      <span className="flex items-center">
                        Total STTB: {totalSTTB} | Total Payment: Rp. {totalPayment}
                        {isExpanded ? ' ▲' : ' ▼'}
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="mt-4 overflow-x-auto transition-all duration-300 ease-in-out">
                        <table className="min-w-full text-sm table-auto divide-y divide-gray-200">
                          <thead className="bg-blue-50">
                            <tr>
                              <th className="px-4 py-2 text-left font-semibold text-gray-600">No Bukti</th>
                              <th className="px-4 py-2 text-left font-semibold text-gray-600">Pengirim</th>
                              <th className="px-4 py-2 text-left font-semibold text-gray-600">Penerima</th>
                              <th className="px-4 py-2 text-left font-semibold text-gray-600">Agent/Customer</th>
                              <th className="px-4 py-2 text-right font-semibold text-gray-600">Original Amount</th>
                              <th className="px-4 py-2 text-right font-semibold text-gray-600">Discount</th>
                              <th className="px-4 py-2 text-right font-semibold text-gray-600">Final Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {group.items.map((row) => (
                              <tr key={row.id} className="hover:bg-gray-50 transition">
                                <td className="px-4 py-2">{row.awb_no}</td>
                                <td className="px-4 py-2">{row.nama_pengirim}</td>
                                <td className="px-4 py-2">{row.nama_penerima}</td>
                                <td className="px-4 py-2">{row.agent_customer}</td>
                                <td className="px-4 py-2 text-right">Rp. {row.original_amount}</td>
                                <td className="px-4 py-2 text-right">Rp. {row.discount}</td>
                                <td className="px-4 py-2 text-right font-bold">Rp. {row.final_amount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
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
            <div className="bg-white shadow-md rounded-lg p-4 border border-gray-200">
              <table className="min-w-full text-sm table-auto divide-y divide-gray-200">
                <thead className="bg-blue-50">
                  <tr>
                    <th className="px-4 py-2">
                      <input
                        type="checkbox"
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4"
                      />
                    </th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">No STTB</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Tgl STTB</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Pengirim</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Penerima</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-600">Balance</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-600">Discount</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-600">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredUnpaidData.map((row) => (
                    <tr key={row.awb_no} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={row.selected || false}
                          onChange={(e) => handleRowChange(row.index, "selected", e.target.checked)}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="px-4 py-2">{row.awb_no}</td>
                      <td className="px-4 py-2">{row.awb_date}</td>
                      <td className="px-4 py-2">{row.nama_pengirim}</td>
                      <td className="px-4 py-2">{row.nama_penerima}</td>
                      <td className="px-4 py-2 text-right">Rp. {row.balance}</td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={row.potongan || 0}
                          onChange={(e) => handleRowChange(row.index, "potongan", e.target.value)}
                          className="border rounded px-1 py-1 w-full"
                        />
                      </td>
                      <td className="px-4 py-2 text-right font-bold">Rp. {row.discountedTotal}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-blue-50">
                  <tr>
                    <td colSpan={7} className="px-4 py-2 text-right font-semibold text-gray-600">
                      Total Selected:
                    </td>
                    <td className="px-4 py-2 text-right font-bold">Rp. {calculateTotalSelected()}</td>
                  </tr>
                </tfoot>
              </table>
              <div className="flex justify-center mt-4">
                <button
                  onClick={handleSaveChanges}
                  disabled={loading || unpaidData.filter((row) => row.selected).length === 0}
                  className="px-6 py-2 bg-blue-600 text-white font-bold rounded shadow-lg hover:bg-blue-700 transition text-base disabled:bg-gray-400"
                >
                  {loading ? "Processing..." : "Process Payment"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
