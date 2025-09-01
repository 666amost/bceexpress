"use client"

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { supabaseClient } from '@/lib/auth'
import { getEnhancedAgentList } from '../lib/agent-mapping'
import { baseAgentListBangka, baseAgentListTanjungPandan, baseAgentListCentral } from '../lib/agents'

interface Customer {
  id: string
  customer_name: string
  customer_phone: string | null
  nama_pengirim: string
  nomor_pengirim: string | null
  nama_penerima: string
  nomor_penerima: string | null
  alamat_penerima: string | null
  kota_tujuan: string | null
  kecamatan: string | null // untuk branch bangka
  wilayah: string | null // untuk branch tanjung_pandan dan pusat
  kirim_via: string | null
  isi_barang: string | null
  metode_pembayaran: string | null
  agent_customer: string | null
  notes: string | null
  branch_origin: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface CustomerFormData {
  nama_pengirim: string
  nomor_pengirim: string
  nama_penerima: string
  nomor_penerima: string
  alamat_penerima: string
  kota_tujuan: string
  kecamatan: string // untuk branch bangka
  wilayah: string // untuk branch tanjung_pandan dan pusat
  kirim_via: string
  isi_barang: string
  metode_pembayaran: string
  agent_customer: string
}

interface BangkaMapping {
  kecamatan: string[]
}

interface CustomerManagerProps {
  branchOrigin: string | null
  userRole?: string | null // tambahkan userRole prop
  onCustomerSelect?: (customer: Customer) => void
  mode?: 'manage' | 'select' // mode untuk manage customer atau select customer
}

export default function CustomerManager({ branchOrigin, userRole, onCustomerSelect, mode = 'manage' }: CustomerManagerProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  
  const defaultFormData: CustomerFormData = {
    nama_pengirim: '',
    nomor_pengirim: '',
    nama_penerima: '',
    nomor_penerima: '',
    alamat_penerima: '',
    kota_tujuan: '',
    kecamatan: '',
    wilayah: '',
    kirim_via: '',
    isi_barang: '',
    metode_pembayaran: '',
    agent_customer: ''
  }

  const [formData, setFormData] = useState<CustomerFormData>(defaultFormData)

  // Get dropdown data based on branch
  const dropdownData = useMemo(() => {
    // Normalize case untuk comparison
    const normalizedBranch = branchOrigin?.toLowerCase()
    
    if (normalizedBranch === 'bangka') {
      // Data dari BangkaAwbForm - struktur hirarkis
      const kotaWilayahJabodetabek = {
        "JAKARTA BARAT": {
          kecamatan: [
            "Cengkareng", "Grogol", "Kebon jeruk", "Kali deres", "Pal merah", "Kembangan",
            "Taman sari", "Tambora"
          ]
        },
        "JAKARTA PUSAT": {
          kecamatan: [
            "Cempaka putih", "Gambir", "Johar baru", "Kemayoran", "Menteng", 
            "Sawah besar", "Senen", "Tanah abang", "Tanah abang (gelora)"
          ]
        },
        "JAKARTA SELATAN": {
          kecamatan: [
            "Cilandak", "Jagakarsa", "Kebayoran baru", "Kebayoran lama", "Mampang prapatan", 
            "Pasar minggu", "Pesanggrahan", "Pancoran", "Setiabudi", "Tebet"
          ]
        },
        "JAKARTA TIMUR": {
          kecamatan: [
            "Cakung", "Cipayung", "Ciracas", "Duren sawit", "Jatinegara", "Kramat jati",
            "Makasar", "Matraman", "Pasar rebo", "Pulo gadung"
          ]
        },
        "JAKARTA UTARA": {
          kecamatan: [
            "Penjaringan", "Cilincing", "Kelapa gading", "Koja", "Pademangan", "Tanjung priok"
          ]
        },
        "TANGERANG": {
          kecamatan: [
            "Batuceper", "Benda", "Cibodas", "Ciledug", "Cipondoh", "Jatiuwung", 
            "Karangtengah", "Karawaci", "Larangan", "Neglasari", "Periuk", "Pinang", "Tangerang"
          ]
        },
        "TANGERANG SELATAN": {
          kecamatan: [
            "Ciputat", "Ciputat Timur", "Pamulang", "Pondok Aren", "Serpong", "Serpong Utara"
          ]
        },
        "TANGERANG KABUPATEN": {
          kecamatan: [
            "Kelapa Dua", "Curug", "Kosambi", "Legok", "Pagedangan", "Pasar Kemis", 
            "Teluknaga", "Balaraja", "Cikupa", "Cisauk", "Pakuhaji", "Panongan", 
            "Rajeg", "Sepatan", "Sepatan Timur", "Sindang Jaya", "Solear", "Tigaraksa", "Mauk"
          ]
        },
        "BEKASI KOTA": {
          kecamatan: [
            "Bantargebang", "Bekasi Barat", "Bekasi Selatan", "Bekasi Timur", "Bekasi Utara",
            "Jatiasih", "Jatisampurna", "Medan Satria", "Mustikajaya", "pondokgede",
            "pondokmelati", "Rawalumbu"
          ]
        },
        "BEKASI KABUPATEN": {
          kecamatan: [
            "Tarumajaya", "Babelan", "Cibarusah", "Cibitung", "Cikarang Barat", "Cikarang Pusat",
            "Cikarang Selatan", "Cikarang Timur", "Cikarang Utara", "Karangbahagia",
            "Kedungwaringin", "Serang Baru", "Setu", "Tambun Selatan", "Tambun Utara"
          ]
        },
        "DEPOK": {
          kecamatan: [
            "Beji", "Bojongsari", "Cilodong", "Cimanggis", "Cinere", "Cipayung",
            "Limo", "Pancoran Mas", "Sawangan", "Sukmajaya", "Tapos"
          ]
        },
        "BOGOR KOTA": {
          kecamatan: [
            "Bogor Barat", "Bogor Selatan", "Bogor Tengah", "Bogor Timur", "Bogor Utara", "Tanah Sereal"
          ]
        },
        "BOGOR KABUPATEN": {
          kecamatan: [
            "Babakan Madang", "Bojonggede", "Cibinong", "Cileungsi", "Gunung Putri", 
            "Gunung Sindur", "Citeureup", "Jonggol", "Ciomas", "Ciseeng", "Tajurhalang",
            "Caringin", "Dramaga", "Cariu", "Klapanunggal", "Rumpin", "Ciawi", "Tamansari"
          ]
        }
      }
      
      return {
        agents: getEnhancedAgentList(baseAgentListBangka),
        kotaWilayahMapping: kotaWilayahJabodetabek,
        destinations: Object.keys(kotaWilayahJabodetabek),
        locationField: 'kecamatan' as const,
        paymentMethods: ['cash', 'transfer', 'cod'],
        shippingMethods: ['udara', 'darat']
      }
    } else if (normalizedBranch === 'tanjung_pandan') {
      // Data dari AwbForm untuk Tanjung Pandan
      const kotaWilayahTanjungPandan = {
        jakarta: ["JKT"],
        tangerang: ["TGT"],
        bekasi: ["BKS"],
        depok: ["DPK"],
        bogor: ["BGR"],
      }
      
      return {
        agents: [
          { value: "COD", label: "COD" },
          { value: "TRANSFER", label: "TRANSFER" },
          { value: "CASH", label: "CASH" },
          { value: "Wijaya Crab", label: "Wijaya Crab" }
        ],
        kotaWilayahMapping: kotaWilayahTanjungPandan,
        destinations: Object.keys(kotaWilayahTanjungPandan),
        locationField: 'wilayah' as const,
        paymentMethods: ['cash', 'transfer', 'cod'],
        shippingMethods: ['udara', 'darat']
      }
    } else {
      // PUSAT - Data dari AwbForm untuk pusat
      const kotaWilayahPusat = {
        bangka: ["Pangkal Pinang", "Sungailiat", "Belinyu", "Jebus", "Koba", "Toboali", "Mentok"],
        "kalimantan barat": ["Pontianak", "Singkawang", "Sungai Pinyuh"],
        belitung: ["Tj Pandan"],
        bali: ["Denpasar"],
      }
      
      return {
        agents: [
          { value: "UDR CASH", label: "UDR CASH" },
          { value: "SEA CASH", label: "SEA CASH" },
          { value: "GLC UDR TRF", label: "GLC UDR TRF" },
          { value: "GLC SEA TRF", label: "GLC SEA TRF" },
          { value: "COD UDR", label: "COD UDR" },
          { value: "COD SEA", label: "COD SEA" },
          { value: "KMY UDR TRF", label: "KMY UDR TRF" },
          { value: "KMY SEA TRF", label: "KMY SEA TRF" },
          { value: "KARTINI KIKI", label: "KARTINI KIKI" },
          { value: "DUTA GARDEN FRENITA", label: "DUTA GARDEN FRENITA" },
          { value: "FELLISIA PORIS EX 3", label: "FELLISIA PORIS EX 3" },
          { value: "OTTY OFFICIAL", label: "OTTY OFFICIAL" },
          { value: "CITRA 3 RENY", label: "CITRA 3 RENY" },
          { value: "HENDI", label: "HENDI" },
          { value: "PRALITA", label: "PRALITA" },
          { value: "SALIM", label: "SALIM" },
          { value: "ISKANDAR", label: "ISKANDAR" },
          { value: "IMAM", label: "IMAM" },
          { value: "DONI", label: "DONI" },
          { value: "HERFAN", label: "HERFAN" },
          { value: "EZZA", label: "EZZA" },
          { value: "YANDRI", label: "YANDRI" },
          { value: "DIKY", label: "DIKY" },
          { value: "YOS", label: "YOS" },
          { value: "INDAH SUSHI TIME", label: "INDAH SUSHI TIME" },
          { value: "CENTRAL NURSERY BANGKA", label: "CENTRAL NURSERY BANGKA" },
          { value: "MAMAPIA", label: "MAMAPIA" },
          { value: "AMELIA PEDINDANG", label: "AMELIA PEDINDANG" },
          { value: "HENDRY LIMIA", label: "HENDRY LIMIA" },
          { value: "JESS DOT", label: "JESS DOT" },
          { value: "SEPIRING RASA BASO", label: "SEPIRING RASA BASO" },
          { value: "CHRISTINE PADEMANGAN", label: "CHRISTINE PADEMANGAN" },
          { value: "Amertha / Holai Resto", label: "Amertha / Holai Resto" }
        ],
        kotaWilayahMapping: kotaWilayahPusat,
        destinations: Object.keys(kotaWilayahPusat),
        locationField: 'wilayah' as const,
        paymentMethods: ['cash', 'transfer', 'cod'],
        shippingMethods: ['udara', 'darat']
      }
    }
  }, [branchOrigin])

  // Dynamic location options berdasarkan kota tujuan yang dipilih
  const locationOptions = useMemo(() => {
    if (!formData.kota_tujuan || !dropdownData.kotaWilayahMapping) return []
    
    const mapping = dropdownData.kotaWilayahMapping[formData.kota_tujuan as keyof typeof dropdownData.kotaWilayahMapping]
    
    // Untuk BANGKA, mapping berupa object dengan property kecamatan
    if (branchOrigin?.toLowerCase() === 'bangka' && mapping && typeof mapping === 'object' && 'kecamatan' in mapping) {
      return (mapping as BangkaMapping).kecamatan || []
    }
    
    // Untuk TANJUNG_PANDAN dan PUSAT, mapping berupa array langsung
    return (mapping as string[]) || []
  }, [formData.kota_tujuan, dropdownData, branchOrigin])

  // Reset location field when kota_tujuan changes
  useEffect(() => {
    if (formData.kota_tujuan) {
      setFormData(prev => ({
        ...prev,
        [dropdownData.locationField]: ''
      }))
    }
  }, [formData.kota_tujuan, dropdownData.locationField])

  // Load customers
  const loadCustomers = useCallback(async (): Promise<void> => {
    try {
      setLoading(true)
      
      // Build query dengan filter branch_origin
      let query = supabaseClient
        .from('customers')
        .select('*')
      
      // Filter berdasarkan branch_origin (hanya tampilkan customer dari branch yang sama)
      if (branchOrigin) {
        // Gunakan case-insensitive comparison
        query = query.ilike('branch_origin', branchOrigin)
      }
      
      const { data, error: sbError } = await query.order('customer_name', { ascending: true })

      if (sbError) {
        throw sbError
      }

      setCustomers(data || [])
      setFilteredCustomers(data || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError('Gagal memuat data customer: ' + errorMessage)
    } finally {
      setLoading(false)
    }
  }, [branchOrigin])

  // Filter customers based on search
  useEffect(() => {
    if (!searchTerm) {
      setFilteredCustomers(customers)
    } else {
      const filtered = customers.filter(customer =>
        customer.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.nama_pengirim.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.nama_penerima.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (customer.customer_phone && customer.customer_phone.includes(searchTerm)) ||
        (customer.kota_tujuan && customer.kota_tujuan.toLowerCase().includes(searchTerm.toLowerCase()))
      )
      setFilteredCustomers(filtered)
    }
  }, [searchTerm, customers])

  useEffect(() => {
    void loadCustomers()
  }, [loadCustomers]) // Reload customers ketika loadCustomers berubah

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>): void => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!formData.nama_pengirim || !formData.nama_penerima) {
      setError('Nama pengirim dan penerima wajib diisi')
      return
    }

    try {
      const customerData = {
        ...formData,
        customer_name: formData.nama_pengirim, // gunakan nama pengirim sebagai customer name
        customer_phone: formData.nomor_pengirim, // gunakan nomor pengirim sebagai customer phone
        branch_origin: branchOrigin,
        is_active: true
      }

      if (editingCustomer) {
        // Update existing customer
        const { error: sbError } = await supabaseClient
          .from('customers')
          .update(customerData)
          .eq('id', editingCustomer.id)

        if (sbError) throw sbError
        setSuccess('Customer berhasil diperbarui!')
      } else {
        // Create new customer
        const { error: sbError } = await supabaseClient
          .from('customers')
          .insert([customerData])

        if (sbError) throw sbError
        setSuccess('Customer berhasil ditambahkan!')
      }

      await loadCustomers()
      setFormData(defaultFormData)
      setShowForm(false)
      setEditingCustomer(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError('Gagal menyimpan customer: ' + errorMessage)
    }
  }

  const handleEdit = (customer: Customer): void => {
    setEditingCustomer(customer)
    setFormData({
      nama_pengirim: customer.nama_pengirim,
      nomor_pengirim: customer.nomor_pengirim || '',
      nama_penerima: customer.nama_penerima,
      nomor_penerima: customer.nomor_penerima || '',
      alamat_penerima: customer.alamat_penerima || '',
      kota_tujuan: customer.kota_tujuan || '',
      kecamatan: customer.kecamatan || '',
      wilayah: customer.wilayah || '',
      kirim_via: customer.kirim_via || '',
      isi_barang: customer.isi_barang || '',
      metode_pembayaran: customer.metode_pembayaran || '',
      agent_customer: customer.agent_customer || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (customer: Customer): Promise<void> => {
    if (!confirm(`Yakin ingin menghapus customer "${customer.nama_pengirim}" secara permanen? Data yang dihapus tidak dapat dikembalikan.`)) {
      return
    }

    try {
      const { error: sbError } = await supabaseClient
        .from('customers')
        .delete()
        .eq('id', customer.id)

      if (sbError) throw sbError
      
      setSuccess('Customer berhasil dihapus secara permanen!')
      await loadCustomers()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError('Gagal menghapus customer: ' + errorMessage)
    }
  }

  const handleSelect = (customer: Customer): void => {
    if (onCustomerSelect) {
      onCustomerSelect(customer)
    }
  }

  const resetForm = (): void => {
    setFormData(defaultFormData)
    setEditingCustomer(null)
    setShowForm(false)
    setError('')
    setSuccess('')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg text-gray-600 dark:text-gray-300">Memuat data customer...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {mode === 'select' ? 'Pilih Customer' : 'Kelola Customer'}
        </h2>
        {/* Tampilkan tombol tambah customer dalam kedua mode */}
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          + Tambah Customer
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg border border-green-200 dark:border-green-800">
          {success}
        </div>
      )}

      {/* Search */}
      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Cari customer (nama, telepon, kota tujuan...)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>

      {/* Customer Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingCustomer ? 'Edit Customer' : 'Tambah Customer Baru'}
              </h3>
              <button
                onClick={resetForm}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nama Pengirim *
                  </label>
                  <input
                    type="text"
                    name="nama_pengirim"
                    value={formData.nama_pengirim}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Telepon Pengirim
                  </label>
                  <input
                    type="text"
                    name="nomor_pengirim"
                    value={formData.nomor_pengirim}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nama Penerima *
                  </label>
                  <input
                    type="text"
                    name="nama_penerima"
                    value={formData.nama_penerima}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Telepon Penerima
                  </label>
                  <input
                    type="text"
                    name="nomor_penerima"
                    value={formData.nomor_penerima}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Alamat Penerima
                  </label>
                  <textarea
                    name="alamat_penerima"
                    value={formData.alamat_penerima}
                    onChange={handleInputChange}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Kota Tujuan
                  </label>
                  <select
                    name="kota_tujuan"
                    value={formData.kota_tujuan}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Pilih Kota Tujuan...</option>
                    {dropdownData.destinations.map((dest) => (
                      <option key={dest} value={dest}>{dest}</option>
                    ))}
                  </select>
                </div>

                {/* Location field - Dynamic based on branch */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {dropdownData.locationField === 'kecamatan' ? 'Kecamatan' : 'Wilayah'}
                  </label>
                  <select
                    name={dropdownData.locationField}
                    value={formData[dropdownData.locationField] || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                    disabled={!formData.kota_tujuan}
                  >
                    <option value="">
                      {formData.kota_tujuan 
                        ? `Pilih ${dropdownData.locationField === 'kecamatan' ? 'Kecamatan' : 'Wilayah'}...`
                        : 'Pilih Kota Tujuan dulu...'
                      }
                    </option>
                    {locationOptions.map((location: string) => (
                      <option key={location} value={location}>
                        {location}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Kirim Via
                  </label>
                  <select
                    name="kirim_via"
                    value={formData.kirim_via}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Pilih Kirim Via...</option>
                    {dropdownData.shippingMethods.map((method) => (
                      <option key={method} value={method}>{method}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Metode Pembayaran
                  </label>
                  <select
                    name="metode_pembayaran"
                    value={formData.metode_pembayaran}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Pilih Metode Pembayaran...</option>
                    {dropdownData.paymentMethods.map((method) => (
                      <option key={method} value={method}>{method}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Agent Customer
                  </label>
                  <select
                    name="agent_customer"
                    value={formData.agent_customer}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Pilih Agent...</option>
                    {dropdownData.agents.map((agent, index) => (
                      <option key={typeof agent === 'string' ? agent : agent.value} value={typeof agent === 'string' ? agent : agent.value}>
                        {typeof agent === 'string' ? agent : agent.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Isi Barang
                  </label>
                  <input
                    type="text"
                    name="isi_barang"
                    value={formData.isi_barang}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  {editingCustomer ? 'Update' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Pengirim
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Penerima
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Tujuan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {customer.customer_name}
                      </div>
                      {customer.customer_phone && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {customer.customer_phone}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm text-gray-900 dark:text-white">
                        {customer.nama_pengirim}
                      </div>
                      {customer.nomor_pengirim && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {customer.nomor_pengirim}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm text-gray-900 dark:text-white">
                        {customer.nama_penerima}
                      </div>
                      {customer.nomor_penerima && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {customer.nomor_penerima}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {customer.kota_tujuan}
                      {customer.kecamatan && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {customer.kecamatan}
                        </div>
                      )}
                      {customer.wilayah && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {customer.wilayah}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    {mode === 'select' ? (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleSelect(customer)}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          Pilih
                        </button>
                        {/* Admin bisa edit/delete bahkan dalam mode select */}
                        {userRole === 'admin' && (
                          <>
                            <button
                              onClick={() => handleEdit(customer)}
                              className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(customer)}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                            >
                              Hapus
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEdit(customer)}
                          className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                        >
                          Edit
                        </button>
                        {/* Hanya admin yang bisa delete */}
                        {userRole === 'admin' && (
                          <button
                            onClick={() => handleDelete(customer)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 ml-2"
                          >
                            Hapus
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredCustomers.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            {searchTerm ? 'Tidak ada customer yang sesuai dengan pencarian' : 'Belum ada data customer'}
          </div>
        )}
      </div>
    </div>
  )
}
