"use client"

import { useEffect, useState, useRef } from "react"
import { supabaseClient } from "../lib/auth"
import PrintLayout from "./PrintLayout" // Pastikan ini merujuk ke PrintLayout.jsx yang sudah diperbarui
import AwbForm from "./AwbForm"

const agentList = [
  'GLC COD UDR',
  'GLC COD DRT',
  'GLC DRT',
  'Duta Garden',
  'Poris Residence',
  'Kartini',
  'UDR CASH',
  'SEA CASH',
  'GLC UDR TRF',
  'GLC SEA TRF',
  'COD UDR',
  'COD SEA',
  'KMY UDR TRF',
  'KMY SEA TRF',
  'KARTINI KIKI',
  'DUTA GARDEN FRENITA',
  'FELLISIA PORIS EX 3',
  'OTTY OFFICIAL',
  'CITRA 3 RENY',
  'HENDI',
  'PRALITA',
  'SALIM',
  'ISKANDAR',
  'IMAM',
  'DONI',
  'HERFAN',
  'EZZA',
  'YANDRI',
  'DIKY',
  'YOS',
  'INDAH SUSHI TIME',
  'CENTRAL NURSERY BANGKA',
  'MAMAPIA',
  'AMELIA PEDINDANG',
  'HENDRY LIMIA',
  'JESS DOT',
  'SEPIRING RASA BASO',
  'CHRISTINE PADEMANGAN'
];

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
  const [userRole, setUserRole] = useState(null);

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
    const fetchUserRole = async () => {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user) {
        const { data: userData } = await supabaseClient.from('users').select('role').eq('id', user.id).single();
        if (userData) {
          setUserRole(userData.role);
        }
      }
    };
    fetchUserRole();
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

  // === FUNGSI HANDLE PRINT YANG DIUPDATE ===
  const handlePrint = (row) => {
    setPrintData(row)
    setShowPrintLayout(true)

    // CSS dari PrintLayout.jsx yang sudah diperbarui (DISINKRONKAN)
    const printLayoutCss = `
      /* === START: CSS disinkronkan dari PrintLayout.jsx === */
      .print-only {
        display: block;
        width: 100mm;
        height: 100mm;
        padding: 0;
        margin: 0 auto;
        box-sizing: border-box;
        font-family: Arial, sans-serif;
        font-size: 10px;
      }

      .shipping-label {
        width: 100%;
        height: 100%;
        border: 1px solid #000;
        padding: 0mm 3mm 3mm 3mm; 
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
      }

      .top-header-container {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        width: 100%;
        padding-bottom: 0mm;
      }

      .top-header-logo {
        display: flex;
        justify-content: flex-start;
        width: 100%;
        padding-bottom: 0mm;
      }

      .header-logo {
        width: 20mm;
        height: auto;
        display: block;
        box-sizing: border-box;
      }

      .barcode-section {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-top: -4mm;
        margin-bottom: 1mm;
        border: 2px solid #000;
        padding: 1mm;
      }

      .barcode-section svg {
        width: 100%;
        height: 15mm;
      }

      .awb-number {
        font-weight: bold;
        font-size: 14px;
        margin-top: 1mm;
      }

      .shipping-details {
        display: flex;
        flex-direction: row;
        align-items: baseline;
        gap: 8mm;
        margin-bottom: 1mm;
        font-size: 12px;
        padding-left: 2mm;
      }

      .content-section {
        display: flex;
        flex: 1;
        margin-bottom: 1mm;
      }

      .address-box {
        flex: 1;
        border: 1px solid #000;
        padding: 1mm;
        margin-right: 3mm;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        font-size: 11px;  /* Enlarge font size */
        font-weight: bold;  /* Make text bold */
      }

      .address-box .sender-info > div,
      .address-box .recipient-info > div {
        border-bottom: 1px dotted #999;
        padding-bottom: 0.6mm;
        margin-bottom: 0mm;
        line-height: 1.4;
      }
      .address-box .recipient-info > div:last-child {
        border-bottom: none;
      }

      .address-box .sender-info {
        margin-bottom: 5mm;
      }

      .logo-qr {
        width: 30mm;
        height: auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        padding-top: 7mm;
      }

      .qr-code {
        width: 30mm !important;
        height: 30mm !important;
        display: block !important;
        box-sizing: border-box;
      }

      .footer-container {
        width: 100%;
        margin-top: auto;
      }

      .dotted-line {
        border-top: 1px dotted #000;
        margin-bottom: 2mm;
      }

      .footer {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        font-size: 8px;
        font-style: italic;
        padding-top: 0mm;
      }

      .terms-text {
        flex: 1;
        text-align: left;
        line-height: 1.3;
      }

      .admin-contact {
        text-align: right;
        white-space: nowrap;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        color: black;
      }

      .airport-code {
        font-size: 20px;  /* Matches logo prominence */
        font-weight: bold;
        margin-top: 4mm;
        text-align: right;
        margin-right: 2mm;
        width: 20mm;  /* Set to match logo width */
        display: flex;
        align-items: center;
        justify-content: flex-end;
      }

      @media print {
        @page {
          size: 100mm 100mm;
          margin: 0;
        }

        body {
          margin: 0;
          -webkit-print-color-adjust: exact !important;
          color-adjust: exact !important;
        }

        .print-only {
          position: absolute;
          left: 0;
          top: 0;
          width: 100mm;
          height: 100mm;
          margin: 0;
          padding: 0;
          background-color: #fff !important;
        }

        body > *:not(.print-only) {
          display: none !important;
          visibility: hidden !important;
        }

        .print-only,
        .print-only * {
          visibility: visible !important;
        }
      }
      /* === END: CSS disinkronkan dari PrintLayout.jsx === */
    `;

    setTimeout(() => {
      if (printFrameRef.current) {
        const printWindow = window.open("", "_blank")
        if (printWindow) {
          printWindow.document.write("<html><head><title>Print</title>")
          printWindow.document.write("<style>")
          printWindow.document.write(printLayoutCss)
          printWindow.document.write("</style></head><body>")
          printWindow.document.write(printFrameRef.current.innerHTML)
          printWindow.document.write("</body></html>")
          printWindow.document.close()
          setTimeout(() => printWindow.print(), 500)
          setTimeout(() => {
            printWindow.close()
            setPrintData(null)
            setShowPrintLayout(false)
          }, 1000)
        }
      }
    }, 100)
  }
  // === AKHIR FUNGSI HANDLE PRINT YANG DIUPDATE ===

  const handleEditAwb = (item) => {
    setSelectedItem(item)
    setShowEditForm(true)
  }

  const handleEditSuccess = () => {
    setShowEditForm(false)
    setSelectedItem(null)
    supabaseClient
      .from("manifest")
      .select("*")
      .order("awb_date", { ascending: false })
      .then(({ data }) => {
        setData(data || [])
      })
  }

  const handleDownloadPDF = async (row) => {
    setPrintData(row);
    setTimeout(async () => {
      const element = printFrameRef.current;
      if (element) {
        const html2pdf = await import('html2pdf.js');
        html2pdf.default()
          .set({
            filename: row.awb_no + '.pdf',
            margin: 0,
            jsPDF: { unit: 'mm', format: [100, 100], orientation: 'portrait' }
          })
          .from(element)
          .save();
        setPrintData(null);
      }
    }, 100);
  };

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
                          className="bg-blue-400 hover:bg-blue-500 text-xs px-2 py-1 rounded"
                          onClick={() => handleDownloadPDF(m)}
                        >
                          Download PDF
                        </button>
                        {(userRole === 'admin' || userRole === 'branch') && (
                          <button
                            className="bg-red-400 hover:bg-red-500 text-xs px-2 py-1 rounded"
                            onClick={async () => {
                              if (confirm("Hapus item ini?")) {
                                try {
                                  const { error } = await supabaseClient
                                    .from("manifest")
                                    .delete()
                                    .eq("awb_no", m.awb_no);
                                  if (error) {
                                    console.error("Error deleting item:", error);
                                    alert("Gagal menghapus item: " + error.message);
                                  } else {
                                    setData(data.filter((item) => item.awb_no !== m.awb_no));
                                    supabaseClient
                                      .from("manifest")
                                      .select("*")
                                      .order("awb_date", { ascending: false })
                                      .then(({ data: freshData }) => {
                                        setData(freshData || []);
                                      });
                                  }
                                } catch (err) {
                                  console.error("Unexpected error:", err);
                                  alert("Terjadi kesalahan saat menghapus item.");
                                }
                              }
                            }}
                          >
                            Delete
                          </button>
                        )}
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