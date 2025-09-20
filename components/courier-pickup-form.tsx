"use client"

import { useState, useEffect, useRef, useMemo, useLayoutEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { X, Plus, Download, Package, User, MapPin, Truck, CreditCard, FileText } from "lucide-react"
import { supabaseClient } from "@/lib/auth"
import { useToast } from "@/hooks/use-toast"
import { airportCodes as airportCodesLib, areaCodes as areaCodesLib } from "@/lib/area-codes"
import PrintLayout from "./PrintLayout"
import CustomerSelector from "./CustomerSelector"

interface AwbFormData {
  awb_no: string
  awb_date: string
  kirim_via: string
  kota_tujuan: string
  wilayah: string
  metode_pembayaran: string
  agent_customer: string
  nama_pengirim: string
  nomor_pengirim: string
  nama_penerima: string
  nomor_penerima: string
  alamat_penerima: string
  coli: number | ''
  berat_kg: number | ''
  harga_per_kg: number | ''
  sub_total: number | ''
  biaya_admin: number | ''
  biaya_packaging: number | ''
  biaya_transit: number | ''
  total: number | ''
  isi_barang: string
  kecamatan?: string
  origin_branch?: string
}

interface User {
  id: string
  name?: string
  email?: string
  role?: string
  branch?: string
}

interface CourierPickupFormProps {
  onClose: () => void
  onSuccess?: () => void
  currentUser: User
  branchOrigin: string | null
}

const kotaWilayahPusat = {
  bangka: ["Pangkal Pinang", "Sungailiat", "Belinyu", "Jebus", "Koba", "Toboali", "Mentok"],
  "kalimantan barat": ["Pontianak", "Singkawang", "Sungai Pinyuh"],
  belitung: ["Tj Pandan"],
  bali: ["Denpasar"],
}

const hargaPerKg = {
  "Pangkal Pinang": 28000,
  Sungailiat: 30000,
  Belinyu: 28000,
  Jebus: 28000,
  Koba: 31000,
  Toboali: 32000,
  Mentok: 32000,
  Pontianak: 32000,
  Singkawang: 35000,
  "Sungai Pinyuh": 35000,
  "Tj Pandan": 28000,
  "Denpasar": 30000,
}

const agentList = [
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
  "OTTY OFFICIAL",
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
  "CHRISTINE PADEMANGAN",
  "Amertha / Holai Resto"
]

// Data for Tanjung Pandan branch
const kotaWilayahTanjungPandan = {
  jakarta: ["JKT"],
  tangerang: ["TGT"],
  bekasi: ["BKS"],
  depok: ["DPK"],
  bogor: ["BGR"],
}

const hargaPerKgTanjungPandan = {
  JKT: 21000,
  TGT: 24000,
  BKS: 24000,
  DPK: 28000,
  BGR: 24000,
}

const agentListTanjungPandan = [
  "COD",
  "TRANSFER",
  "CASH",
  "Wijaya Crab"
]

function generateAwbNo(originBranch?: string | null): string {
  const timestamp = Date.now().toString()
  const lastSixDigits = timestamp.slice(-6)
  const normalized = originBranch ? originBranch.toLowerCase() : undefined
  const suffix = normalized === 'tanjung_pandan' ? 'TJQ' : ''
  return "BCE" + lastSixDigits + suffix
}

export function CourierPickupForm({ onClose, onSuccess, currentUser, branchOrigin }: CourierPickupFormProps) {
  const { toast } = useToast()
  const printFrameRef = useRef<HTMLDivElement>(null)
  const [showCustomerSelector, setShowCustomerSelector] = useState(false)

  // Helper to get local date string in Asia/Jakarta timezone
  function getLocalDateString(): string {
    return new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'Asia/Jakarta', 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    }).format(new Date())
  }

  const [form, setForm] = useState<AwbFormData>({
    awb_no: "",
    awb_date: getLocalDateString(),
    kirim_via: "udara",
    kota_tujuan: "",
    wilayah: "",
    metode_pembayaran: "cash",
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
  })

  const [isSubmitting, setIsSubmitting] = useState(false)

  // Determine which data source to use based on branchOrigin
  const currentKotaWilayah = branchOrigin === 'tanjung_pandan' ? kotaWilayahTanjungPandan : kotaWilayahPusat
  const currentHargaPerKg = branchOrigin === 'tanjung_pandan' ? hargaPerKgTanjungPandan : hargaPerKg
  const currentAgentList = branchOrigin === 'tanjung_pandan' ? agentListTanjungPandan : agentList
  const currentKotaTujuan = Object.keys(currentKotaWilayah)

  const wilayahOptions = useMemo(() => {
    const options = currentKotaWilayah[form.kota_tujuan as keyof typeof currentKotaWilayah]
    return (options as string[]) || []
  }, [form.kota_tujuan, currentKotaWilayah])

  // Update price when wilayah changes
  useEffect(() => {
    if (form.wilayah && currentHargaPerKg[form.wilayah as keyof typeof currentHargaPerKg]) {
      setForm(f => ({ ...f, harga_per_kg: currentHargaPerKg[form.wilayah as keyof typeof currentHargaPerKg] }))
    }
  }, [form.wilayah, currentHargaPerKg])

  // Calculate totals
  useEffect(() => {
    const berat = form.berat_kg === '' ? 0 : Number(form.berat_kg)
    const harga = form.harga_per_kg === '' ? 0 : Number(form.harga_per_kg)
    const admin = form.biaya_admin === '' ? 0 : Number(form.biaya_admin)
    const pack = form.biaya_packaging === '' ? 0 : Number(form.biaya_packaging)
    const transit = form.biaya_transit === '' ? 0 : Number(form.biaya_transit)
    const sub_total = berat * harga
    const total = sub_total + admin + pack + transit
    setForm(f => ({ ...f, sub_total, total }))
  }, [form.berat_kg, form.harga_per_kg, form.biaya_admin, form.biaya_packaging, form.biaya_transit])

  const numericFields = new Set([
    'coli', 'berat_kg', 'harga_per_kg', 'sub_total', 'biaya_admin', 'biaya_packaging', 'biaya_transit', 'total'
  ])

  const handleNumericFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Select entire value so typing replaces immediately
    requestAnimationFrame(() => e.target.select())
  }

  const handleNumericBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    if (value.trim() === '') {
      setForm(f => ({ ...f, [name]: '' }))
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    if (numericFields.has(name)) {
      if (value === '') {
        setForm(f => ({ ...f, [name]: '' }))
        return
      }
      const num = Number(value)
      setForm(f => ({ ...f, [name]: isNaN(num) ? '' : num }))
    } else {
      setForm(f => ({ ...f, [name]: value }))
    }
  }

  const sanitizedNumeric = (v: number | '' , fallback: number) => {
    if (v === '' || isNaN(Number(v))) return fallback
    return Number(v)
  }


  const handleSelectChange = (name: string, value: string) => {
    setForm(f => ({ ...f, [name]: value }))
  }

  const handleGenerateAwb = () => {
    setForm(f => ({ ...f, awb_no: generateAwbNo(branchOrigin) }))
  }

  // Handle customer selection and populate form (similar to AwbForm)
  const handleCustomerSelect = (customer: {
    nama_pengirim?: string
    nomor_pengirim?: string | null
    nama_penerima?: string
    nomor_penerima?: string | null
    alamat_penerima?: string | null
    kota_tujuan?: string | null
    wilayah?: string | null
    kirim_via?: string | null
    metode_pembayaran?: string | null
    agent_customer?: string | null
    isi_barang?: string | null
  }) => {
    setForm(prev => ({
      ...prev,
      nama_pengirim: customer.nama_pengirim || '',
      nomor_pengirim: customer.nomor_pengirim || '',
      nama_penerima: customer.nama_penerima || '',
      nomor_penerima: customer.nomor_penerima || '',
      alamat_penerima: customer.alamat_penerima || '',
      kota_tujuan: customer.kota_tujuan || '',
      wilayah: customer.wilayah || '',
      kirim_via: customer.kirim_via || '',
      metode_pembayaran: customer.metode_pembayaran || '',
      agent_customer: customer.agent_customer || '',
      isi_barang: customer.isi_barang || ''
    }))

    // Update harga_per_kg if wilayah maps to a price
    if (customer.wilayah && currentHargaPerKg[customer.wilayah as keyof typeof currentHargaPerKg]) {
      setForm(prev => ({
        ...prev,
        harga_per_kg: currentHargaPerKg[customer.wilayah as keyof typeof currentHargaPerKg],
      }))
    }

    toast({ title: 'Customer diimport', description: 'Data customer berhasil dimasukkan ke form.', variant: 'default' })
    setShowCustomerSelector(false)
  }

  const formatCurrency = (amount: number | string): string => {
    const num = typeof amount === 'string' ? parseFloat(amount) || 0 : amount
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num)
  }

  // Validate required fields and focus the first missing one.
  const validateRequired = (): boolean => {
    const requiredMap: Array<{ key: keyof AwbFormData; selector: string }> = [
      { key: 'awb_no', selector: '#awb_no' },
      { key: 'kota_tujuan', selector: '#select-kota_tujuan' },
      { key: 'wilayah', selector: '#select-wilayah' },
      { key: 'agent_customer', selector: '#select-agent_customer' },
      { key: 'nama_pengirim', selector: '#nama_pengirim' },
      { key: 'nama_penerima', selector: '#nama_penerima' },
    ]
    for (const item of requiredMap) {
      const value = form[item.key]
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        // Show toast once
        toast({
          title: 'Data Tidak Lengkap',
          description: 'Mohon lengkapi semua field yang wajib diisi.',
          variant: 'destructive',
        })
        const el = document.querySelector<HTMLInputElement | HTMLElement>(item.selector)
        if (el) {
          // For shadcn Select trigger, focus the trigger button
          if ('focus' in el) el.focus()
        }
        return false
      }
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateRequired()) return

    setIsSubmitting(true)

    try {
      // Use exact same logic as AwbForm.tsx - always save to 'manifest' table for couriers
      const targetTable = 'manifest'
      
      // Prepare sanitized payload & save to database first
      const payload = {
        ...form,
        coli: sanitizedNumeric(form.coli, 1),
        berat_kg: sanitizedNumeric(form.berat_kg, 1),
        harga_per_kg: sanitizedNumeric(form.harga_per_kg, 0),
        sub_total: sanitizedNumeric(form.sub_total, 0),
        biaya_admin: sanitizedNumeric(form.biaya_admin, 0),
        biaya_packaging: sanitizedNumeric(form.biaya_packaging, 0),
        biaya_transit: sanitizedNumeric(form.biaya_transit, 0),
        total: sanitizedNumeric(form.total, 0),
      }
      const { error } = await supabaseClient
        .from(targetTable)
        .insert([payload])

      if (error) throw error

      toast({
        title: "Sukses",
        description: "AWB berhasil dibuat dan disimpan!",
        variant: "default",
      })

      // Call success callback if provided
      if (onSuccess) {
        onSuccess()
      }

      // Reset form
      setForm({
        ...form,
        awb_no: "",
        nama_pengirim: "",
        nomor_pengirim: "",
        nama_penerima: "",
        nomor_penerima: "",
        alamat_penerima: "",
        isi_barang: "",
        coli: 1,
        berat_kg: 1,
      })

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Terjadi kesalahan saat menyimpan data."
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!validateRequired()) return

    try {
      // Save to database first (same flow as /branch)
      const targetTable = 'manifest'
      const payload = {
        ...form,
        coli: sanitizedNumeric(form.coli, 1),
        berat_kg: sanitizedNumeric(form.berat_kg, 1),
        harga_per_kg: sanitizedNumeric(form.harga_per_kg, 0),
        sub_total: sanitizedNumeric(form.sub_total, 0),
        biaya_admin: sanitizedNumeric(form.biaya_admin, 0),
        biaya_packaging: sanitizedNumeric(form.biaya_packaging, 0),
        biaya_transit: sanitizedNumeric(form.biaya_transit, 0),
        total: sanitizedNumeric(form.total, 0),
      }
      const { error: sbError } = await supabaseClient.from(targetTable).insert([payload])
      if (sbError) {
        toast({ title: "Error", description: `Gagal menyimpan data: ${sbError.message}`, variant: "destructive" })
        return
      }

      // Delay to allow PrintLayout effects (barcode/QR) to render
      setTimeout(async () => {
        const element = printFrameRef.current
        if (!element) return
        // Prefer capturing the exact .print-only node to ensure correct sizing
        const targetNode = element.querySelector('.print-only') as HTMLElement | null
        const captureEl = targetNode ?? element

        try {
          // Style tweaks for consistent black text and white background
          const pdfSpecificStyle = document.createElement('style')
          pdfSpecificStyle.innerHTML = `
            .shipping-label { background-color: #ffffff !important; }
            .shipping-label, .shipping-label *:not(.agent-abbr-left) { color: #000000 !important; }
            .agent-abbr-left { color: #ffffff !important; }
          `
          captureEl.appendChild(pdfSpecificStyle)

          // Inject a temporary "generated by" footer without editing PrintLayout.jsx
          const shippingLabel = captureEl.querySelector('.shipping-label') as HTMLElement | null
          let footerEl: HTMLDivElement | null = null
          let previousPositionStyle: string | null = null
          if (shippingLabel) {
            // Ensure positioning context so absolute footer anchors to the label box
            previousPositionStyle = shippingLabel.getAttribute('style') || null
            const computedPos = window.getComputedStyle(shippingLabel).position
            if (computedPos === 'static') {
              shippingLabel.style.position = 'relative'
            }

            footerEl = document.createElement('div')
            footerEl.textContent = `generated by: ${currentUser?.name || currentUser?.email || currentUser?.id || 'unknown'}`
            footerEl.setAttribute('data-temp-generated-by', 'true')
            footerEl.style.position = 'absolute'
            footerEl.style.bottom = '2mm'
            footerEl.style.right = '3mm'
            footerEl.style.fontSize = '8px'
            footerEl.style.fontStyle = 'italic'
            footerEl.style.color = '#000000'
            footerEl.style.pointerEvents = 'none'
            footerEl.style.background = 'transparent'
            footerEl.style.zIndex = '2'
            shippingLabel.appendChild(footerEl)
          }

          // Import html2pdf like in HistoryManifest
          const html2pdf = await import('html2pdf.js')
          const options = {
            filename: `AWB_${form.awb_no}.pdf`,
            margin: 0 as number,
            image: { type: 'jpeg', quality: 1.0 },
            html2canvas: {
              // Use the same 100x100mm mapping: 100mm ≈ 378px at 96 DPI
              scale: 3,
              useCORS: true,
              allowTaint: true,
              backgroundColor: '#ffffff',
              width: 378,
              height: 378,
              scrollX: 0,
              scrollY: 0,
              letterRendering: true,
              logging: false
            },
            jsPDF: {
              unit: 'mm',
              format: [100, 100] as [number, number],
              orientation: 'portrait',
              compress: true
            }
          }

          await html2pdf.default()
            .set(options)
            .from(captureEl)
            .save()

          // Cleanup injected nodes/styles
          captureEl.removeChild(pdfSpecificStyle)
          if (shippingLabel && footerEl) {
            shippingLabel.removeChild(footerEl)
            // Restore previous inline style if any
            if (previousPositionStyle !== null) {
              shippingLabel.setAttribute('style', previousPositionStyle)
            } else {
              shippingLabel.removeAttribute('style')
            }
          }

          toast({ title: "Berhasil", description: `PDF AWB ${form.awb_no} terunduh.`, variant: "default" })
          onSuccess?.()
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Terjadi kesalahan saat membuat PDF.'
          toast({ title: 'Error PDF', description: msg, variant: 'destructive' })
        }
      }, 600)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Terjadi kesalahan saat membuat PDF."
      toast({ title: "Error", description: errorMessage, variant: "destructive" })
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Package className="h-5 w-5" />
            Pickup AWB
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* AWB Number Generation */}
            <div>
              <Label htmlFor="awb_no" className="text-sm font-medium">No. AWB</Label>
              <div className="flex flex-row gap-2 items-center mt-1">
                <div className="min-w-0 max-w-[220px]">
                  <Input
                    id="awb_no"
                    name="awb_no"
                    value={form.awb_no}
                    onChange={handleChange}
                    placeholder="Generate AWB Number"
                    readOnly
                    className="font-mono h-10 w-full"
                  />
                </div>
                <div className="flex-shrink-0">
                  <Button
                    type="button"
                    onClick={handleGenerateAwb}
                    aria-label="Generate AWB"
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-full w-10 h-10 flex items-center justify-center"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Sender Information */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 text-sm font-semibold text-gray-700">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Pengirim
                </div>
                <div>
                  <Button
                    type="button"
                    onClick={() => setShowCustomerSelector(true)}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    Import Customer
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label htmlFor="nama_pengirim" className="text-sm">Nama Pengirim</Label>
                  <Input
                    id="nama_pengirim"
                    name="nama_pengirim"
                    value={form.nama_pengirim}
                    onChange={handleChange}
                    placeholder="Nama lengkap pengirim"
                  />
                </div>
                <div>
                  <Label htmlFor="nomor_pengirim" className="text-sm">Nomor Telepon</Label>
                  <Input
                    id="nomor_pengirim"
                    name="nomor_pengirim"
                    value={form.nomor_pengirim}
                    onChange={handleChange}
                    placeholder="08xxxxxxxxxx"
                  />
                </div>
              </div>
            </div>

            {/* Receiver Information */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <MapPin className="h-4 w-4" />
                Penerima
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label htmlFor="nama_penerima" className="text-sm">Nama Penerima</Label>
                  <Input
                    id="nama_penerima"
                    name="nama_penerima"
                    value={form.nama_penerima}
                    onChange={handleChange}
                    placeholder="Nama lengkap penerima"
                  />
                </div>
                <div>
                  <Label htmlFor="nomor_penerima" className="text-sm">Nomor Telepon</Label>
                  <Input
                    id="nomor_penerima"
                    name="nomor_penerima"
                    value={form.nomor_penerima}
                    onChange={handleChange}
                    placeholder="08xxxxxxxxxx"
                  />
                </div>
                <div>
                  <Label htmlFor="alamat_penerima" className="text-sm">Alamat Lengkap</Label>
                  <Textarea
                    id="alamat_penerima"
                    name="alamat_penerima"
                    value={form.alamat_penerima}
                    onChange={handleChange}
                    placeholder="Alamat lengkap dengan kode pos"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Destination */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Truck className="h-4 w-4" />
                Tujuan
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="kota_tujuan" className="text-sm">Kota Tujuan</Label>
                  <Select value={form.kota_tujuan} onValueChange={(value) => handleSelectChange("kota_tujuan", value)}>
                    <SelectTrigger id="select-kota_tujuan">
                      <SelectValue placeholder="Pilih kota" />
                    </SelectTrigger>
                    <SelectContent>
                      {currentKotaTujuan.map((kota) => (
                        <SelectItem key={kota} value={kota}>
                          {kota}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="wilayah" className="text-sm">Wilayah</Label>
                  <Select value={form.wilayah} onValueChange={(value) => handleSelectChange("wilayah", value)}>
                    <SelectTrigger id="select-wilayah">
                      <SelectValue placeholder="Pilih wilayah" />
                    </SelectTrigger>
                    <SelectContent>
                      {wilayahOptions.map((wilayah) => (
                        <SelectItem key={wilayah} value={wilayah}>
                          {wilayah}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Shipment Details */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <FileText className="h-4 w-4" />
                Detail Kiriman
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label htmlFor="isi_barang" className="text-sm">Isi Barang</Label>
                  <Input
                    id="isi_barang"
                    name="isi_barang"
                    value={form.isi_barang}
                    onChange={handleChange}
                    placeholder="Deskripsi barang"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="coli" className="text-sm">Jumlah Coli</Label>
                    <Input
                      id="coli"
                      name="coli"
                      type="number"
                      min="1"
                      value={form.coli}
                      onChange={handleChange}
                      onFocus={handleNumericFocus}
                      onBlur={handleNumericBlur}
                    />
                  </div>
                  <div>
                    <Label htmlFor="berat_kg" className="text-sm">Berat (kg)</Label>
                    <Input
                      id="berat_kg"
                      name="berat_kg"
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={form.berat_kg}
                      onChange={handleChange}
                      onFocus={handleNumericFocus}
                      onBlur={handleNumericBlur}
                    />
                  </div>
                  <div>
                    <Label htmlFor="harga_per_kg" className="text-sm">Harga per kg</Label>
                    <Input
                      id="harga_per_kg"
                      name="harga_per_kg"
                      type="number"
                      min="0"
                      value={form.harga_per_kg}
                      onChange={handleChange}
                      onFocus={handleNumericFocus}
                      onBlur={handleNumericBlur}
                      placeholder="Harga per kg"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Payment & Service */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <CreditCard className="h-4 w-4" />
                Pembayaran & Layanan
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label htmlFor="kirim_via" className="text-sm">Kirim Via</Label>
                  <Select value={form.kirim_via} onValueChange={(value) => handleSelectChange("kirim_via", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="udara">Udara</SelectItem>
                      <SelectItem value="darat">Darat</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="metode_pembayaran" className="text-sm">Metode Pembayaran</Label>
                  <Select value={form.metode_pembayaran} onValueChange={(value) => handleSelectChange("metode_pembayaran", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="transfer">Transfer</SelectItem>
                      <SelectItem value="cod">COD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="agent_customer" className="text-sm">Agent</Label>
                  <Select value={form.agent_customer} onValueChange={(value) => handleSelectChange("agent_customer", value)}>
                    <SelectTrigger id="select-agent_customer">
                      <SelectValue placeholder="Pilih agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {currentAgentList.map((agent) => (
                        <SelectItem key={agent} value={agent}>
                          {agent}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Additional Fees */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <CreditCard className="h-4 w-4" />
                Biaya Tambahan
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="biaya_admin" className="text-xs">Admin</Label>
                  <Input
                    id="biaya_admin"
                    name="biaya_admin"
                    type="number"
                    min="0"
                    value={form.biaya_admin}
                    onChange={handleChange}
                    onFocus={handleNumericFocus}
                    onBlur={handleNumericBlur}
                  />
                </div>
                <div>
                  <Label htmlFor="biaya_packaging" className="text-xs">Packaging</Label>
                  <Input
                    id="biaya_packaging"
                    name="biaya_packaging"
                    type="number"
                    min="0"
                    value={form.biaya_packaging}
                    onChange={handleChange}
                    onFocus={handleNumericFocus}
                    onBlur={handleNumericBlur}
                  />
                </div>
                <div>
                  <Label htmlFor="biaya_transit" className="text-xs">Transit</Label>
                  <Input
                    id="biaya_transit"
                    name="biaya_transit"
                    type="number"
                    min="0"
                    value={form.biaya_transit}
                    onChange={handleChange}
                    onFocus={handleNumericFocus}
                    onBlur={handleNumericBlur}
                  />
                </div>
              </div>
            </div>

            {/* Cost Summary */}
            {(typeof form.harga_per_kg === 'number' ? form.harga_per_kg : Number(form.harga_per_kg || 0)) > 0 && (
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <h3 className="font-semibold text-sm">Ringkasan Biaya</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span>Harga per kg:</span><span>{formatCurrency(form.harga_per_kg)}</span></div>
                  <div className="flex justify-between"><span>Sub total ({form.berat_kg} kg):</span><span>{formatCurrency(form.sub_total)}</span></div>
                  <div className="flex justify-between"><span>Biaya admin:</span><span>{formatCurrency(form.biaya_admin)}</span></div>
                  <div className="flex justify-between"><span>Biaya packaging:</span><span>{formatCurrency(form.biaya_packaging)}</span></div>
                  <div className="flex justify-between"><span>Biaya transit:</span><span>{formatCurrency(form.biaya_transit)}</span></div>
                  <div className="flex justify-between border-t pt-2 font-semibold"><span>Total:</span><span>{formatCurrency(form.total)}</span></div>
                </div>
              </div>
            )}

            {/* Single Action: Download PDF (auto-saves) */}
            <div className="flex pt-4">
              <Button
                type="button"
                onClick={handleDownloadPDF}
                disabled={!form.awb_no || isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <Download className="h-4 w-4 mr-2" />
                Download PDF (Auto Save)
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      
      {/* Customer Selector Modal */}
      {showCustomerSelector && (
        <CustomerSelector
          onCustomerSelect={handleCustomerSelect}
          onClose={() => setShowCustomerSelector(false)}
          branchOrigin={branchOrigin}
          userRole={currentUser?.role}
        />
      )}

      {/* Off-screen Print container (rendered, not display:none) */}
      {/* Keep the print DOM attached and measurable; hide visually without display:none */}
      <div
        ref={printFrameRef}
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          opacity: 0,
          zIndex: -1,
        }}
      >
        <PrintLayout data={{ ...form, kecamatan: form.wilayah }} />
      </div>
    </div>
  )
}