"use client"

import { useEffect, useState, useRef } from "react"
import { supabaseClient } from "../lib/auth"
import PrintLayout from "./PrintLayout"
import AwbForm from "./AwbForm"

export default function HistoryManifest({ mode }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [editData, setEditData] = useState(null)
  const [editPotongan, setEditPotongan] = useState(0)
  const [editStatus, setEditStatus] = useState("lunas")
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [printData, setPrintData] = useState(null)
  const [showPrintLayout, setShowPrintLayout] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const printFrameRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    supabaseClient
      .from("manifest")
      .select("*")
      .order("awb_date", { ascending: false })
      .then(({ data }) => {
        setData(data || [])
        setLoading(false)
      })
  }, [saving])

  const openEditModal = (row) => {
    setEditData(row)
    setEditPotongan(row.potongan || 0)
    setEditStatus(row.status_pelunasan || "lunas")
  }

  const closeEditModal = () => {
    setEditData(null)
    setEditPotongan(0)
    setEditStatus("lunas")
  }

  const handleEditSave = async () => {
    setSaving(true)
    await supabaseClient
      .from("manifest")
      .update({ status_pelunasan: editStatus, potongan: editPotongan })
      .eq("id", editData.id)
    setSaving(false)
    closeEditModal()
  }

  const handlePrint = (row) => {
    setPrintData(row)

    // Use setTimeout to ensure the print frame is rendered before printing
    setTimeout(() => {
      if (printFrameRef.current) {
        const printContent = printFrameRef.current
        const originalContents = document.body.innerHTML

        document.body.innerHTML = printContent.innerHTML
        window.print()
        document.body.innerHTML = originalContents

        // Re-initialize the component after printing
        setPrintData(null)
      }
    }, 100)
  }

  const handleEditAwb = (item) => {
    setSelectedItem(item)
    setShowEditForm(true)
  }

  const handleEditSuccess = () => {
    setShowEditForm(false)
    setSelectedItem(null)
    // Refresh data
    supabaseClient
      .from("manifest")
      .select("*")
      .order("awb_date", { ascending: false })
      .then(({ data }) => {
        setData(data || [])
      })
  }

  if (showEditForm && selectedItem) {
    return (
      <div className="mt-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-blue-900">Edit AWB</h2>
          <button onClick={() => setShowEditForm(false)} className="px-4 py-2 bg-gray-200 rounded">
            Back to List
          </button>
        </div>
        <AwbForm
          initialData={selectedItem}
          onSuccess={handleEditSuccess}
          onCancel={() => setShowEditForm(false)}
          isEditing={true}
        />
      </div>
    )
  }

  return (
    <div className="mt-6">
      {/* Hidden print frame */}
      <div className="hidden">
        <div ref={printFrameRef}>{printData && <PrintLayout data={printData} />}</div>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span>Search:</span>
        <input
          className="border rounded px-2 py-1 text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by AWB, customer, etc."
        />
      </div>
      <div className="overflow-x-auto bg-white rounded shadow border">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-blue-600 text-white">
              <th className="px-2 py-2">No STTB</th>
              <th className="px-2 py-2">Tgl STTB</th>
              <th className="px-2 py-2">Kirim Via</th>
              <th className="px-2 py-2">Tujuan</th>
              <th className="px-2 py-2">Agen/Customer</th>
              <th className="px-2 py-2">Bayar</th>
              <th className="px-2 py-2">Pengirim</th>
              <th className="px-2 py-2">Penerima</th>
              <th className="px-2 py-2">Kg</th>
              <th className="px-2 py-2">Total STTB</th>
              {mode === "pelunasan" && <th className="px-2 py-2">Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={mode === "pelunasan" ? 11 : 10} className="text-center py-4">
                  Loading...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={mode === "pelunasan" ? 11 : 10} className="text-center py-4">
                  Belum ada data manifest.
                </td>
              </tr>
            ) : (
              data
                .filter(
                  (item) =>
                    item.awb_no?.toLowerCase().includes(search.toLowerCase()) ||
                    item.kota_tujuan?.toLowerCase().includes(search.toLowerCase()) ||
                    item.agent_customer?.toLowerCase().includes(search.toLowerCase()) ||
                    item.nama_pengirim?.toLowerCase().includes(search.toLowerCase()) ||
                    item.nama_penerima?.toLowerCase().includes(search.toLowerCase()),
                )
                .map((m, idx) => (
                  <tr key={m.id || m.awb_no || idx} className="even:bg-blue-50">
                    <td className="px-2 py-1">{m.awb_no}</td>
                    <td className="px-2 py-1">{m.awb_date}</td>
                    <td className="px-2 py-1">{m.kirim_via}</td>
                    <td className="px-2 py-1">{m.kota_tujuan}</td>
                    <td className="px-2 py-1">{m.agent_customer}</td>
                    <td className="px-2 py-1">{m.metode_pembayaran}</td>
                    <td className="px-2 py-1">{m.nama_pengirim}</td>
                    <td className="px-2 py-1">{m.nama_penerima}</td>
                    <td className="px-2 py-1 text-right">{m.berat_kg}</td>
                    <td className="px-2 py-1 text-right">{m.total}</td>
                    {mode === "pelunasan" && (
                      <td className="px-2 py-1 flex gap-2">
                        <button
                          className="bg-yellow-400 hover:bg-yellow-500 text-xs px-2 py-1 rounded"
                          onClick={() => handleEditAwb(m)}
                        >
                          Edit
                        </button>
                        <button
                          className="bg-green-400 hover:bg-green-500 text-xs px-2 py-1 rounded"
                          onClick={() => handlePrint(m)}
                        >
                          Print
                        </button>
                        <button
                          className="bg-red-400 hover:bg-red-500 text-xs px-2 py-1 rounded"
                          onClick={async () => {
                            if (confirm("Hapus item ini?")) {
                              await supabaseClient.from("manifest").delete().eq("id", m.id)
                              setData(data.filter((item) => item.id !== m.id))
                            }
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
