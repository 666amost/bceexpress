"use client"

import React, { useState, useMemo } from "react"
import { supabaseClient } from "../lib/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { FaPlus, FaPrint, FaSave, FaUndo, FaTimes, FaCalculator, FaTruck, FaUser, FaMapMarkerAlt, FaBoxes, FaCalendarAlt } from "react-icons/fa"
import { useToast } from "@/components/ui/use-toast"
import PrintLayout from "./PrintLayout"

interface AgentBookingFormProps {
  onSuccess: () => void
  onCancel: () => void
  initialData?: Record<string, unknown> | null
  isEditing?: boolean
  userRole: string | null
  branchOrigin: string | null
}

interface FormData {
  awb_no: string
  awb_date: string
  kirim_via: string
  kota_tujuan: string
  kecamatan: string
  metode_pembayaran: string
  agent_customer: string
  nama_pengirim: string
  nomor_pengirim: string
  nama_penerima: string
  nomor_penerima: string
  alamat_penerima: string
  coli: number
  berat_kg: number
  harga_per_kg: number
  sub_total: number
  biaya_admin: number
  biaya_packaging: number
  biaya_transit: number
  total: number
  isi_barang: string
  catatan: string
}

// Data untuk wilayah Jabodetabek (copy dari BangkaAwbForm)
const kotaWilayahJabodetabek = {
  "JAKARTA BARAT": {
    kecamatan: [
      "Cengkareng", "Grogol", "Kebon jeruk", "Kali deres", "Pal merah", "Kembangan",
      "Taman sari", "Tambora"
    ],
    harga: 27000
  },
  "JAKARTA PUSAT": {
    kecamatan: [
      "Cempaka putih", "Gambir", "Johar baru", "Kemayoran", "Menteng", 
      "Sawah besar", "Senen", "Tanah abang"
    ],
    harga: 27000
  },
  "JAKARTA SELATAN": {
    kecamatan: [
      "Cilandak", "Jagakarsa", "Kebayoran baru", "Kebayoran lama", "Mampang prapatan",
      "Pancoran", "Pasar minggu", "Pesanggrahan", "Setiabudi", "Tebet"
    ],
    harga: 27000
  },
  "JAKARTA TIMUR": {
    kecamatan: [
      "Cakung", "Cipayung", "Ciracas", "Duren sawit", "Jatinegara", "Kramat jati",
      "Makasar", "Matraman", "Pasar rebo", "Pulo gadung"
    ],
    harga: 29000
  },
  "JAKARTA UTARA": {
    kecamatan: [
      "Penjaringan", "Cilincing", "Kelapa gading", "Koja", "Pademangan", "Tanjung priok"
    ],
    harga: 27000
  },
  "TANGERANG": {
    kecamatan: [
      "Batuceper", "Benda", "Cibodas", "Ciledug", "Cipondoh", "Jatiuwung", 
      "Karangtengah", "Karawaci", "Larangan", "Neglasari", "Periuk", "Pinang", "Tangerang"
    ],
    harga: 27000
  },
  "TANGERANG SELATAN": {
    kecamatan: [
      "Ciputat", "Ciputat Timur", "Pamulang", "Pondok Aren", "Serpong", "Serpong Utara"
    ],
    harga: 30000
  },
  "TANGERANG KABUPATEN": {
    kecamatan: [
      "Kelapa Dua", "Curug", "Kosambi", "Legok", "Pagedangan", "Pasar Kemis", 
      "Teluknaga", "Balaraja", "Cikupa", "Cisauk", "Pakuhaji", "Panongan", 
      "Rajeg", "Sepatan", "Sepatan Timur", "Sindang Jaya", "Solear", "Tigaraksa"
    ],
    harga: 35000
  },
  "BEKASI KOTA": {
    kecamatan: [
      "Bantargebang", "Bekasi Barat", "Bekasi Selatan", "Bekasi Timur", "Bekasi Utara",
      "Jatiasih", "Jatisampurna", "Medan Satria", "Mustikajaya", "pondokgede",
      "pondokmelati", "Rawalumbu"
    ],
    harga: 32000
  },
  "BEKASI KABUPATEN": {
    kecamatan: [
      "Tarumajaya", "Babelan", "Cibarusah", "Cibitung", "Cikarang Barat", "Cikarang Pusat",
      "Cikarang Selatan", "Cikarang Timur", "Cikarang Utara", "Karangbahagia",
      "Kedungwaringin", "Serang Baru", "Setu", "Tambun Selatan", "Tambun Utara"
    ],
    harga: 32000
  },
  "DEPOK": {
    kecamatan: [
      "Beji", "Bojongsari", "Cilodong", "Cimanggis", "Cinere", "Cipayung",
      "Limo", "Pancoran Mas", "Sawangan", "Sukmajaya", "Tapos"
    ],
    harga: 35000
  },
  "BOGOR KOTA": {
    kecamatan: [
      "Bogor Barat", "Bogor Selatan", "Bogor Tengah", "Bogor Timur", "Bogor Utara", "Tanah Sereal"
    ],
    harga: 35000
  },
  "BOGOR KABUPATEN": {
    kecamatan: [
      "Babakan Madang", "Bojonggede", "Cibinong", "Cileungsi", "Gunung Putri", 
      "Gunung Sindur", "Citeureup", "Jonggol", "Ciomas", "Ciseeng", "Tajurhalang",
      "Caringin", "Dramaga", "Cariu", "Klapanunggal", "Rumpin", "Ciawi", "Tamansari"
    ],
    harga: 35000
  }
}

// Agent list (sesuai dengan system yang ada)
const agentListJabodetabek = [
  "UDR CASH",
  "SEA CASH", 
  "GLC UDR TRF",
  "GLC SEA TRF",
  "COD UDR",
  "COD SEA",
  "KMY UDR TRF",
  "KMY SEA TRF",
  // ... bisa ditambah sesuai kebutuhan
]

const metodePembayaran = ["cash", "transfer", "cod"]
const kirimVia = ["udara", "darat"]

// Daftar kecamatan khusus Jakarta Utara untuk pricing
const kecamatanJakutKhusus = [
  'Kebon Bawang', 'Papanggo', 'Sungai Bambu', 'Tj Priok', 'Warakas', 'Koja'
]

const kecamatanSunter = ['Sunter Jaya', 'Sunter Agung']

export default function AgentBookingForm({ onSuccess, onCancel, initialData, isEditing, userRole, branchOrigin }: AgentBookingFormProps) {
  const [form, setForm] = useState<FormData>({
    awb_no: initialData?.awb_no as string || "",
    awb_date: initialData?.awb_date as string || new Date().toISOString().slice(0, 10),
    kirim_via: initialData?.kirim_via as string || "",
    kota_tujuan: initialData?.kota_tujuan as string || "",
    kecamatan: initialData?.kecamatan as string || "",
    metode_pembayaran: initialData?.metode_pembayaran as string || "",
    agent_customer: initialData?.agent_customer as string || "",
    nama_pengirim: initialData?.nama_pengirim as string || "",
    nomor_pengirim: initialData?.nomor_pengirim as string || "",
    nama_penerima: initialData?.nama_penerima as string || "",
    nomor_penerima: initialData?.nomor_penerima as string || "",
    alamat_penerima: initialData?.alamat_penerima as string || "",
    coli: initialData?.coli as number || 1,
    berat_kg: initialData?.berat_kg as number || 1,
    harga_per_kg: initialData?.harga_per_kg as number || 0,
    sub_total: initialData?.sub_total as number || 0,
    biaya_admin: initialData?.biaya_admin as number || 0,
    biaya_packaging: initialData?.biaya_packaging as number || 0,
    biaya_transit: initialData?.biaya_transit as number || 0,
    total: initialData?.total as number || 0,
    isi_barang: initialData?.isi_barang as string || "",
    catatan: initialData?.catatan as string || "",
  })

  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPrintDialog, setShowPrintDialog] = useState(false)
  
  const { toast } = useToast()

  // Get current user for agent_id
  const [currentUser, setCurrentUser] = useState<{id: string, role: string, origin_branch: string | null} | null>(null)

  React.useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (user) {
        const { data: userData } = await supabaseClient
          .from('users')
          .select('role, origin_branch')
          .eq('id', user.id)
          .single()
        
        if (userData) {
          setCurrentUser({
            id: user.id,
            role: userData.role,
            origin_branch: userData.origin_branch
          })
        }
      }
    }
    getCurrentUser()
  }, [])

  // Generate AWB Number with AGNT suffix
  const generateAwbNo = () => {
    const today = new Date()
    const year = today.getFullYear().toString().slice(-2)
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0')
    return `BCE${year}${month}${day}${random}AGNT`
  }

  // Auto-generate AWB if empty
  React.useEffect(() => {
    if (!form.awb_no && !isEditing) {
      setForm(prev => ({ ...prev, awb_no: generateAwbNo() }))
    }
  }, [form.awb_no, isEditing])

  // Calculate pricing
  const availableKecamatan = useMemo(() => {
    if (!form.kota_tujuan) return []
    const kota = kotaWilayahJabodetabek[form.kota_tujuan as keyof typeof kotaWilayahJabodetabek]
    return kota ? kota.kecamatan : []
  }, [form.kota_tujuan])

  // Update harga when kota/kecamatan changes
  React.useEffect(() => {
    if (form.kota_tujuan && form.kecamatan) {
      let harga = 0
      const kotaData = kotaWilayahJabodetabek[form.kota_tujuan as keyof typeof kotaWilayahJabodetabek]
      
      if (kotaData) {
        harga = kotaData.harga
        
        // Special pricing logic untuk Jakarta Utara
        if (form.kota_tujuan === 'JAKARTA UTARA') {
          if (kecamatanJakutKhusus.includes(form.kecamatan)) {
            harga = 30000
          } else if (kecamatanSunter.includes(form.kecamatan)) {
            harga = 27000
          } else {
            harga = 27000
          }
        }
        // Special pricing untuk Tangerang
        else if (form.kota_tujuan === 'TANGERANG') {
          if (['Neglasari', 'Benda', 'Jatiuwung', 'Cibodas'].includes(form.kecamatan)) {
            harga = 30000
          } else {
            harga = 27000
          }
        }
      }
      
      setForm(prev => ({ ...prev, harga_per_kg: harga }))
    }
  }, [form.kota_tujuan, form.kecamatan])

  // Auto calculate totals
  React.useEffect(() => {
    const subTotal = form.berat_kg * form.harga_per_kg
    const total = subTotal + form.biaya_admin + form.biaya_packaging + form.biaya_transit
    setForm(prev => ({ 
      ...prev, 
      sub_total: subTotal,
      total: total
    }))
  }, [form.berat_kg, form.harga_per_kg, form.biaya_admin, form.biaya_packaging, form.biaya_transit])

  // Manual price calculation trigger
  const calculatePrice = () => {
    const subTotal = form.berat_kg * form.harga_per_kg
    const total = subTotal + form.biaya_admin + form.biaya_packaging + form.biaya_transit
    setForm(prev => ({ 
      ...prev, 
      sub_total: subTotal,
      total: total
    }))
    toast({
      title: "Harga berhasil dihitung",
      description: `Total: Rp ${total.toLocaleString()}`,
    })
  }

  const handleSubmit = async () => {
    if (!currentUser) {
      setError("User tidak ditemukan. Silakan login ulang.")
      return
    }

    // Validation
    if (!form.awb_no || !form.nama_pengirim || !form.nama_penerima || !form.kota_tujuan || !form.kecamatan) {
      setError("Mohon lengkapi semua field yang wajib diisi")
      return
    }

    setIsSubmitting(true)
    setError("")

    try {
      const bookingData = {
        ...form,
        agent_id: currentUser.id,
        origin_branch: currentUser.origin_branch || '',
        status: 'pending',
        payment_status: 'outstanding',
        input_time: new Date().toISOString()
      }

      if (isEditing && initialData?.awb_no) {
        const { error: sbError } = await supabaseClient
          .from('manifest_booking')
          .update(bookingData)
          .eq("awb_no", initialData.awb_no)

        if (sbError) {
          setError("Gagal memperbarui booking: " + sbError.message)
          return
        } else {
          setSuccess("Booking berhasil diperbarui!")
        }
      } else {
        const { error: sbError } = await supabaseClient
          .from('manifest_booking')
          .insert([bookingData])

        if (sbError) {
          setError("Gagal menyimpan booking: " + sbError.message)
          return
        } else {
          setSuccess("Booking berhasil disimpan!")
        }
      }

      setShowPrintDialog(true)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError("Terjadi kesalahan: " + errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePrint = (callback?: () => void) => {
    window.print()
    setTimeout(() => {
      if (callback) callback()
      onSuccess()
    }, 100)
  }

  const resetForm = () => {
    setForm({
      awb_no: generateAwbNo(),
      awb_date: new Date().toISOString().slice(0, 10),
      kirim_via: "",
      kota_tujuan: "",
      kecamatan: "",
      metode_pembayaran: "",
      agent_customer: "",
      nama_pengirim: "",
      nomor_pengirim: "",
      nama_penerima: "",
      nomor_penerima: "",
      alamat_penerima: "",
      coli: 1,
      berat_kg: 1,
      harga_per_kg: 0,
      sub_total: 0,
      biaya_admin: 0,
      biaya_packaging: 0,
      biaya_transit: 0,
      total: 0,
      isi_barang: "",
      catatan: "",
    })
    setError("")
    setSuccess("")
  }

  if (showPrintDialog) {
    return (
      <>
        <div className="hidden">
          <PrintLayout data={form} />
        </div>
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 no-print">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Booking berhasil disimpan!</h3>
            <p className="mb-4">Apakah Anda ingin mencetak AWB booking sekarang?</p>
            <div className="flex gap-2">
              <button
                onClick={() => handlePrint()}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Print AWB
              </button>
              <button
                onClick={onSuccess}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
              >
                Tidak Print
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header Section */}
      <div className="mb-6 bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FaBoxes className="text-green-600 dark:text-green-400" />
            {isEditing ? "Edit Booking" : "Input Booking Pengiriman"}
          </h2>
          <Badge variant="outline" className="text-xs">
            Agent Booking
          </Badge>
        </div>
        
        {error && (
          <Alert className="mb-4 border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
            <AlertDescription className="text-red-700 dark:text-red-300">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-4 border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
            <AlertDescription className="text-green-700 dark:text-green-300">
              {success}
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Main Form Card */}
      <Card className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-bold text-blue-900 dark:text-blue-100 flex items-center gap-2">
            <FaTruck />
            Detail Pengiriman
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* AWB Info Section */}
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                  <FaBoxes className="text-green-600" />
                  No. AWB Booking *
                </Label>
                <Input
                  value={form.awb_no}
                  onChange={(e) => setForm({...form, awb_no: e.target.value})}
                  className="bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600"
                  readOnly
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                  <FaCalendarAlt className="text-blue-600" />
                  Tanggal AWB *
                </Label>
                <Input
                  type="date"
                  value={form.awb_date}
                  onChange={(e) => setForm({...form, awb_date: e.target.value})}
                  className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                  <FaTruck className="text-purple-600" />
                  Kirim Via *
                </Label>
                <Select value={form.kirim_via} onValueChange={(value) => setForm({...form, kirim_via: value})}>
                  <SelectTrigger className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                    <SelectValue placeholder="Pilih Kirim Via" />
                  </SelectTrigger>
                  <SelectContent>
                    {kirimVia.map(via => (
                      <SelectItem key={via} value={via}>{via.toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                  <FaMapMarkerAlt className="text-red-600" />
                  Kota Tujuan *
                </Label>
                <Select value={form.kota_tujuan} onValueChange={(value) => setForm({...form, kota_tujuan: value, kecamatan: ""})}>
                  <SelectTrigger className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                    <SelectValue placeholder="Pilih Kota Tujuan" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(kotaWilayahJabodetabek).map(kota => (
                      <SelectItem key={kota} value={kota}>{kota}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                  <FaMapMarkerAlt className="text-orange-600" />
                  Kecamatan *
                </Label>
                <Select value={form.kecamatan} onValueChange={(value) => setForm({...form, kecamatan: value})} disabled={!form.kota_tujuan}>
                  <SelectTrigger className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                    <SelectValue placeholder="Pilih Kecamatan" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableKecamatan.map(kec => (
                      <SelectItem key={kec} value={kec}>{kec}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                  <FaCalculator className="text-green-600" />
                  Metode Pembayaran *
                </Label>
                <Select value={form.metode_pembayaran} onValueChange={(value) => setForm({...form, metode_pembayaran: value})}>
                  <SelectTrigger className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                    <SelectValue placeholder="Pilih Metode Pembayaran" />
                  </SelectTrigger>
                  <SelectContent>
                    {metodePembayaran.map(metode => (
                      <SelectItem key={metode} value={metode}>{metode.toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                  <FaUser className="text-indigo-600" />
                  Agent/Customer
                </Label>
                <Input
                  value={form.agent_customer}
                  onChange={(e) => setForm({...form, agent_customer: e.target.value})}
                  className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600"
                  placeholder="Nama agent atau customer"
                />
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Sender & Receiver Section */}
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100 flex items-center gap-2">
              <FaUser />
              Informasi Pengirim & Penerima
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sender Info */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-700 dark:text-gray-300 border-b pb-2">Data Pengirim</h4>
                
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                    <FaUser className="text-blue-600" />
                    Nama Pengirim *
                  </Label>
                  <Input
                    value={form.nama_pengirim}
                    onChange={(e) => setForm({...form, nama_pengirim: e.target.value})}
                    className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600"
                    placeholder="Nama lengkap pengirim"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                    <FaUser className="text-blue-600" />
                    Nomor Pengirim
                  </Label>
                  <Input
                    value={form.nomor_pengirim}
                    onChange={(e) => setForm({...form, nomor_pengirim: e.target.value})}
                    className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600"
                    placeholder="Nomor telepon pengirim"
                  />
                </div>
              </div>

              {/* Receiver Info */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-700 dark:text-gray-300 border-b pb-2">Data Penerima</h4>
                
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                    <FaUser className="text-green-600" />
                    Nama Penerima *
                  </Label>
                  <Input
                    value={form.nama_penerima}
                    onChange={(e) => setForm({...form, nama_penerima: e.target.value})}
                    className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600"
                    placeholder="Nama lengkap penerima"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                    <FaUser className="text-green-600" />
                    Nomor Penerima
                  </Label>
                  <Input
                    value={form.nomor_penerima}
                    onChange={(e) => setForm({...form, nomor_penerima: e.target.value})}
                    className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600"
                    placeholder="Nomor telepon penerima"
                  />
                </div>
              </div>
            </div>

            {/* Address Section */}
            <div>
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                <FaMapMarkerAlt className="text-red-600" />
                Alamat Penerima
              </Label>
              <Textarea
                value={form.alamat_penerima}
                onChange={(e) => setForm({...form, alamat_penerima: e.target.value})}
                className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600"
            rows={3}
                placeholder="Alamat lengkap penerima"
              />
            </div>
          </div>

          <Separator className="my-6" />

          {/* Items & Pricing Section */}
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100 flex items-center gap-2">
              <FaBoxes />
              Informasi Barang & Pricing
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Items Info */}
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                    <FaBoxes className="text-blue-600" />
                    Jumlah Coli
                  </Label>
                  <Input
                    type="number"
                    value={form.coli}
                    onChange={(e) => setForm({...form, coli: parseInt(e.target.value) || 1})}
                    className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600"
                    min="1"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                    <FaBoxes className="text-blue-600" />
                    Berat (Kg)
                  </Label>
                  <Input
                    type="number"
                    value={form.berat_kg}
                    onChange={(e) => setForm({...form, berat_kg: parseFloat(e.target.value) || 1})}
                    className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600"
                    min="0.1"
                    step="0.1"
                  />
                </div>
              </div>

              {/* Pricing Info */}
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                    <FaCalculator className="text-green-600" />
                    Harga per Kg
                  </Label>
                  <Input
                    type="number"
                    value={form.harga_per_kg}
                    onChange={(e) => setForm({...form, harga_per_kg: parseFloat(e.target.value) || 0})}
                    className="bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                    readOnly
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                    <FaCalculator className="text-green-600" />
                    Sub Total
                  </Label>
                  <Input
                    type="number"
                    value={form.sub_total}
                    onChange={(e) => setForm({...form, sub_total: parseFloat(e.target.value) || 0})}
                    className="bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                    readOnly
                  />
                </div>
              </div>

              {/* Additional Costs */}
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                    <FaCalculator className="text-yellow-600" />
                    Biaya Admin
                  </Label>
                  <Input
                    type="number"
                    value={form.biaya_admin}
                    onChange={(e) => setForm({...form, biaya_admin: parseFloat(e.target.value) || 0})}
                    className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600"
                    min="0"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                    <FaCalculator className="text-yellow-600" />
                    Biaya Packaging
                  </Label>
                  <Input
                    type="number"
                    value={form.biaya_packaging}
                    onChange={(e) => setForm({...form, biaya_packaging: parseFloat(e.target.value) || 0})}
                    className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600"
                    min="0"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                    <FaCalculator className="text-yellow-600" />
                    Biaya Transit
                  </Label>
                  <Input
                    type="number"
                    value={form.biaya_transit}
                    onChange={(e) => setForm({...form, biaya_transit: parseFloat(e.target.value) || 0})}
                    className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600"
                    min="0"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-green-600 dark:text-green-400 mb-2 flex items-center gap-1">
                    <FaCalculator className="text-green-600" />
                    Total Biaya
                  </Label>
                  <Input
                    type="number"
                    value={form.total}
                    className="bg-green-50 dark:bg-green-900 border border-green-300 dark:border-green-600 text-green-800 dark:text-green-200 font-semibold"
                    readOnly
                  />
                </div>
              </div>
            </div>

            {/* Items Description */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                  <FaBoxes className="text-blue-600" />
                  Isi Barang
                </Label>
                <Input
                  value={form.isi_barang}
                  onChange={(e) => setForm({...form, isi_barang: e.target.value})}
                  className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600"
                  placeholder="Deskripsi isi barang"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                  <FaBoxes className="text-blue-600" />
                  Catatan
                </Label>
                <Textarea
                  value={form.catatan}
                  onChange={(e) => setForm({...form, catatan: e.target.value})}
                  className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600"
                  rows={2}
                  placeholder="Catatan tambahan"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-8 pt-6 border-t border-gray-200 dark:border-gray-600">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="w-full sm:w-auto flex items-center gap-2 border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              <FaTimes />
              Batal
            </Button>

            <div className="flex gap-2">
              <Button
                type="button"
                onClick={calculatePrice}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
              >
                <FaCalculator />
                Hitung Harga
              </Button>

              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!form.awb_no || !form.nama_pengirim || !form.nama_penerima || !form.kota_tujuan || !form.metode_pembayaran || !form.awb_date || !form.kirim_via}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
              >
                <FaSave />
                {isEditing ? "Update Booking" : "Simpan Booking"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
