"use client"

import { useState, useEffect } from "react"
import { supabaseClient } from "../lib/auth"
import * as XLSX from 'xlsx'
import { FaDownload } from 'react-icons/fa'

interface PaymentHistoryType {
  id?: string;
  awb_no: string;
  awb_date: string;
  nama_pengirim: string;
  nama_penerima: string;
  original_amount: number;
  discount: number;
  final_amount: number;
  agent_customer: string;
  payment_date: string;
}

interface UnpaidType {
  awb_no: string;
  awb_date: string;
  nama_pengirim: string;
  nama_penerima: string;
  total: number;
  buktimembayar: boolean;
  potongan: number;
  agent_customer: string;
  balance: number;
  discountedTotal: number;
  index: number;
  selected: boolean;
}

export default function PelunasanResi({ userRole, branchOrigin }: { userRole: string, branchOrigin: string }) {
  const [activeTab, setActiveTab] = useState<string>("history") // "history" or "add"
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryType[]>([])
  const [unpaidData, setUnpaidData] = useState<UnpaidType[]>([])
  const [search, setSearch] = useState<string>("")
  const [agentList, setAgentList] = useState<string[]>([])
  const [selectedAgent, setSelectedAgent] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>("")
  const [expandedGroups, setExpandedGroups] = useState<{ [date: string]: boolean }>({})

  // Fetch payment history on component mount
  useEffect(() => {
    fetchPaymentHistory()
    fetchUnpaidData()
    fetchAgents()
  }, [])

  async function fetchPaymentHistory() {
    setLoading(true)
    try {
      // Central users: query central tables, Branch users: query branch tables with filtering
      let query;
      if (userRole === 'cabang') {
        query = supabaseClient
          .from("pelunasan_cabang")
          .select("*")
          .eq('origin_branch', branchOrigin)
          .order("payment_date", { ascending: false })
      } else {
        // Central users query central table without any filtering
        query = supabaseClient
          .from("pelunasan")
          .select("*")
          .order("payment_date", { ascending: false })
      }

      const { data, error } = await query

      if (error) {
        setError(`Error fetching payment history: ${error.message}`)
      } else {
        setPaymentHistory(data || [])
      }
    } catch (err) {
      setError(`Unexpected error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function fetchUnpaidData() {
    try {
      // Central users: query central tables, Branch users: query branch tables with filtering
      let query;
      if (userRole === 'cabang') {
        query = supabaseClient
          .from("manifest_cabang")
          .select("awb_no, awb_date, nama_pengirim, nama_penerima, total, buktimembayar, potongan, agent_customer")
          .eq("buktimembayar", false)
          .eq('origin_branch', branchOrigin)
      } else {
        // Central users query central table without any filtering
        query = supabaseClient
          .from("manifest")
          .select("awb_no, awb_date, nama_pengirim, nama_penerima, total, buktimembayar, potongan, agent_customer")
          .eq("buktimembayar", false)
      }

      const { data: fetchedData, error } = await query

      if (error) {
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
      setError(`Unexpected error: ${err.message}`)
    }
  }

  async function fetchAgents() {
    try {
      // Central users: query central tables, Branch users: query branch tables with filtering
      let query;
      if (userRole === 'cabang') {
        query = supabaseClient
          .from("manifest_cabang")
          .select("agent_customer")
          .eq('origin_branch', branchOrigin)
      } else {
        // Central users query central table without any filtering
        query = supabaseClient
          .from("manifest")
          .select("agent_customer")
      }

      const { data, error } = await query
      if (error) {
        // Silent error - agents are not critical
      } else {
        const distinctAgents = Array.from(new Set(data.map((item: any) => item.agent_customer).filter(Boolean))) as string[]
        setAgentList(distinctAgents)
      }
    } catch (err) {
      // Silent error - agents are not critical
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
        // Determine tables based on user role
        const pelunasanTable = userRole === 'cabang' ? "pelunasan_cabang" : "pelunasan"
        const manifestTable = userRole === 'cabang' ? "manifest_cabang" : "manifest"
        
        // 1. Insert into pelunasan table
        const pelunasanData: any = {
          awb_no: row.awb_no,
          awb_date: row.awb_date,
          nama_pengirim: row.nama_pengirim,
          nama_penerima: row.nama_penerima,
          original_amount: row.balance,
          discount: row.potongan,
          final_amount: row.discountedTotal,
          agent_customer: row.agent_customer,
          payment_date: new Date().toISOString().split("T")[0],
        }
        
        // Add origin_branch for branch users
        if (userRole === 'cabang') {
          pelunasanData.origin_branch = branchOrigin
        }
        
        const { error: insertError } = await supabaseClient.from(pelunasanTable).insert(pelunasanData)

        if (insertError) {
          throw insertError
        }

        // 2. Update manifest table to mark as paid
        const { error: updateError } = await supabaseClient
          .from(manifestTable)
          .update({
            buktimembayar: true,
            potongan: row.potongan || 0,
            total: row.discountedTotal,
          })
          .eq("awb_no", row.awb_no)

        if (updateError) {
          throw updateError
        }
      }

      // Success - refresh data
      alert(`Successfully processed ${selectedRows.length} payments!`)
      fetchPaymentHistory()
      fetchUnpaidData()
    } catch (err) {
      setError(`Error processing payments: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Calculate the sum of selected items
  const calculateTotalSelected = () => {
    return unpaidData.filter((row) => row.selected).reduce((sum, row) => sum + Number(row.discountedTotal || 0), 0)
  }

  // Replace the downloadCSV function with this new one
  const downloadXLSXForDate = (date, items) => {
    if (items.length === 0) return;
    
    const worksheet = XLSX.utils.json_to_sheet(
      items.map((item, index) => ({
        'No': index + 1,
        'No Bukti': item.awb_no,
        'Tgl Bayar': item.payment_date,
        'Pengirim': item.nama_pengirim,
        'Penerima': item.nama_penerima,
        'Agent/Customer': item.agent_customer,
        'Original Amount': item.original_amount,
        'Discount': item.discount,
        'Final Amount': item.final_amount
      }))
    );
    
    // Set column widths based on headers
    worksheet['!cols'] = [
      { wch: 5 },  // No
      { wch: 15 }, // No Bukti
      { wch: 12 }, // Tgl Bayar
      { wch: 15 }, // Pengirim
      { wch: 15 }, // Penerima
      { wch: 15 }, // Agent/Customer
      { wch: 15 }, // Original Amount
      { wch: 12 }, // Discount
      { wch: 15 }  // Final Amount
    ];
    
    // Add borders and styles
    if (worksheet['!ref']) {
      const range = XLSX.utils.decode_range(worksheet['!ref']);
      for (let rowNum = range.s.r; rowNum <= range.e.r; rowNum++) {
        for (let colNum = range.s.c; colNum <= range.e.c; colNum++) {
          const cellAddress = XLSX.utils.encode_cell({ r: rowNum, c: colNum });
          if (!worksheet[cellAddress]) continue;
          
          worksheet[cellAddress].s = {
            border: {
              top: { style: "thin" },
              bottom: { style: "thin" },
              left: { style: "thin" },
              right: { style: "thin" }
            }
          };
          
          if (rowNum === range.s.r) {  // Header row
            worksheet[cellAddress].s.font = { bold: true };
          }
          
          // Format numbers for amount columns (e.g., columns 6-8, assuming 0-based index)
          if (colNum >= 6 && colNum <= 8 && typeof worksheet[cellAddress].v === 'number') {
            worksheet[cellAddress].z = '#,##0.00';  // Format as number with commas
          }
        }
      }
    }
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Payment Invoice');
    const filename = `INV/${date.replace(/-/g, '/')}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

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
  const groupPaymentHistoryByDate = (history: PaymentHistoryType[]): {date: string, items: PaymentHistoryType[]}[] => {
    const grouped: { [date: string]: PaymentHistoryType[] } = {};
    history.forEach((item) => {
      const date = item.payment_date;
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(item);
    });
    return Object.entries(grouped).map(([date, items]) => ({ date, items }));
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
        <h2 className="text-xl font-bold text-blue-900 dark:text-blue-100">Pelunasan Resi</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 rounded-md transition-colors ${
              activeTab === "history" 
                ? "bg-blue-600 dark:bg-blue-700 text-white" 
                : "bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500"
            }`}
          >
            Payment History
          </button>
          <button
            onClick={() => setActiveTab("add")}
            className={`px-4 py-2 rounded-md transition-colors ${
              activeTab === "add" 
                ? "bg-blue-600 dark:bg-blue-700 text-white" 
                : "bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500"
            }`}
          >
            Add Payment
          </button>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md border border-red-200 dark:border-red-800">{error}</div>}

      {/* Search bar */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-gray-700 dark:text-gray-300">Search:</span>
        <input
          className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm flex-grow bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by AWB, pengirim, penerima"
        />
      </div>

      {/* Payment History Tab */}
      {activeTab === "history" && (
        <div>
          <div className="space-y-4">
            {groupedHistory.map((group) => {
              const formattedDate = formatDateToInvoice(group.date);
              const totalSTTB = group.items.length;
              const totalPayment = group.items.reduce((sum, row) => sum + Number(row.final_amount || 0), 0);
              const isExpanded = expandedGroups[group.date];

              return (
                <div key={group.date} className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => toggleGroup(group.date)}
                    className="w-full text-left text-lg font-bold text-blue-600 dark:text-blue-400 hover:underline flex justify-between items-center"
                  >
                    <span>{formattedDate}</span>
                    <span className="flex items-center text-gray-800 dark:text-gray-200">
                      Total STTB: {totalSTTB} | Total Payment: Rp. {totalPayment}
                      {isExpanded ? ' ▲' : ' ▼'}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="mt-4">
                      <div className="flex justify-end mb-2">
                        <button
                          onClick={() => downloadXLSXForDate(group.date, group.items)}
                          className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-800 mr-2 flex items-center gap-2 transition-colors"
                        >
                          <FaDownload /> Download XLSX for {group.date}
                        </button>
                      </div>
                      <div className="overflow-x-auto transition-all duration-300 ease-in-out">
                        <table className="min-w-full text-sm table-auto divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-blue-50 dark:bg-blue-900/50">
                            <tr>
                              <th className="px-4 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">No Bukti</th>
                              <th className="px-4 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Pengirim</th>
                              <th className="px-4 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Penerima</th>
                              <th className="px-4 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Agent/Customer</th>
                              <th className="px-4 py-2 text-right font-semibold text-gray-600 dark:text-gray-300">Original Amount</th>
                              <th className="px-4 py-2 text-right font-semibold text-gray-600 dark:text-gray-300">Discount</th>
                              <th className="px-4 py-2 text-right font-semibold text-gray-600 dark:text-gray-300">Final Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {group.items.map((row) => (
                              <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                                <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{row.awb_no}</td>
                                <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{row.nama_pengirim}</td>
                                <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{row.nama_penerima}</td>
                                <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{row.agent_customer}</td>
                                <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">Rp. {row.original_amount}</td>
                                <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">Rp. {row.discount}</td>
                                <td className="px-4 py-2 text-right font-bold text-gray-900 dark:text-gray-100">Rp. {row.final_amount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Payment Tab */}
      {activeTab === "add" && (
        <div>
          {/* Agent Selection Section */}
          <div className="mb-4">
            <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300">Pilih Agent/Customer:</label>
            <select
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
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
            <div className="text-center py-4 text-gray-600 dark:text-gray-400">Loading data...</div>
          ) : filteredUnpaidData.length === 0 ? (
            <div className="text-center py-4 bg-gray-50 dark:bg-gray-700 rounded-md text-gray-600 dark:text-gray-400">No unpaid shipments found</div>
          ) : (
            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <table className="min-w-full text-sm table-auto divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-blue-50 dark:bg-blue-900/50">
                  <tr>
                    <th className="px-4 py-2">
                      <input
                        type="checkbox"
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4"
                      />
                    </th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">No STTB</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Tgl STTB</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Pengirim</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Penerima</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-600 dark:text-gray-300">Balance</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-600 dark:text-gray-300">Discount</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-600 dark:text-gray-300">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredUnpaidData.map((row) => (
                    <tr key={row.awb_no} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                      <td className="px-4 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={row.selected || false}
                          onChange={(e) => handleRowChange(row.index, "selected", e.target.checked)}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{row.awb_no}</td>
                      <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{row.awb_date}</td>
                      <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{row.nama_pengirim}</td>
                      <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{row.nama_penerima}</td>
                      <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">Rp. {row.balance}</td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={row.potongan || 0}
                          onChange={(e) => handleRowChange(row.index, "potongan", e.target.value)}
                          className="border border-gray-300 dark:border-gray-600 rounded px-1 py-1 w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
                        />
                      </td>
                      <td className="px-4 py-2 text-right font-bold text-gray-900 dark:text-gray-100">Rp. {row.discountedTotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Action Buttons */}
          {filteredUnpaidData.some((row) => row.selected) && (
            <div className="mt-4 bg-blue-50 dark:bg-blue-900/30 p-4 rounded-md border border-blue-200 dark:border-blue-800">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Total Selected: Rp. {calculateTotalSelected().toLocaleString()}
                </span>
                <button
                  onClick={handleSaveChanges}
                  className="px-4 py-2 bg-green-600 dark:bg-green-700 text-white rounded hover:bg-green-700 dark:hover:bg-green-800 transition-colors"
                  disabled={loading}
                >
                  {loading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
