"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/db'
import { Search, UserPlus, X, Check, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface AgentCustomer {
  id: string
  nama_pengirim: string
  nomor_pengirim: string | null
  nama_penerima: string
  nomor_penerima: string | null
  alamat_penerima: string | null
  kota_tujuan: string | null
  kecamatan: string | null
  wilayah: string | null
  kirim_via: string | null
  isi_barang: string | null
  metode_pembayaran: string | null
  agent_email: string
  agent_customer: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface CustomerSelectorProps {
  onSelect: (customer: AgentCustomer) => void
  onClose: () => void
  agentEmail: string
}

// Data untuk wilayah Jabodetabek (sama seperti di AWBCreationForm)
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
} as const

type KotaKey = keyof typeof kotaWilayahJabodetabek

export function CustomerSelector({ onSelect, onClose, agentEmail }: CustomerSelectorProps) {
  const [customers, setCustomers] = useState<AgentCustomer[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<AgentCustomer[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const { toast } = useToast()

  // Form state untuk create customer
  const [newCustomer, setNewCustomer] = useState({
    nama_pengirim: '',
    nomor_pengirim: '',
    nama_penerima: '',
    nomor_penerima: '',
    alamat_penerima: '',
    kota_tujuan: '',
    kecamatan: '',
    wilayah: '',
    kirim_via: 'udara',
    isi_barang: '',
    metode_pembayaran: 'CASH',
    notes: ''
  })

  // Fetch customers
  const fetchCustomers = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true)
      
      // Filter customers by agent email in the codebase (simple RLS)
      const { data, error } = await supabase
        .from('agent_customers')
        .select('*')
        .eq('agent_email', agentEmail) // Only fetch customers for this agent
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching customers:', error)
        toast({
          title: "Error",
          description: `Failed to fetch customers: ${error.message || 'Unknown error'}`,
          variant: "destructive"
        })
        return
      }

      setCustomers(data || [])
      setFilteredCustomers(data || [])
    } catch (error) {
      console.error('Error:', error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast, agentEmail]) // Removed supabase as it's an outer scope value

  // Filter customers based on search term
  const filterCustomers = useCallback((searchTerm: string): void => {
    if (!searchTerm.trim()) {
      setFilteredCustomers(customers)
      return
    }

    const filtered = customers.filter(customer => 
      customer.nama_pengirim.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.nomor_pengirim?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.nama_penerima.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.nomor_penerima?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.alamat_penerima?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    
    setFilteredCustomers(filtered)
  }, [customers])

  // Handle search
  const handleSearch = (value: string): void => {
    setSearchTerm(value)
    filterCustomers(value)
  }

  // Handle new customer form change
  const handleNewCustomerChange = (field: string, value: string): void => {
    setNewCustomer(prev => {
      const updated = { ...prev, [field]: value }
      
      // Auto update wilayah when kota_tujuan or kecamatan changes
      if (field === 'kota_tujuan' || field === 'kecamatan') {
        if (updated.kota_tujuan && updated.kecamatan) {
          updated.wilayah = `${updated.kota_tujuan} ${updated.kecamatan}`.toUpperCase()
        }
      }
      
      return updated
    })
  }

  // Get kecamatan options based on selected kota
  const getKecamatanOptions = (): string[] => {
    if (!newCustomer.kota_tujuan || !(newCustomer.kota_tujuan in kotaWilayahJabodetabek)) {
      return []
    }
    return [...kotaWilayahJabodetabek[newCustomer.kota_tujuan as KotaKey].kecamatan]
  }

  // Create new customer
  const handleCreateCustomer = async (): Promise<void> => {
    if (!newCustomer.nama_pengirim || !newCustomer.nama_penerima) {
      toast({
        title: "Validation Error",
        description: "Please fill in required fields: Nama Pengirim and Nama Penerima",
        variant: "destructive"
      })
      return
    }

    if (!agentEmail) {
      toast({
        title: "Authentication Error",
        description: "Agent email is required",
        variant: "destructive"
      })
      return
    }

    try {
      setIsCreating(true)
      
      const customerData = {
        nama_pengirim: newCustomer.nama_pengirim.trim(),
        nomor_pengirim: newCustomer.nomor_pengirim?.trim() || null,
        nama_penerima: newCustomer.nama_penerima.trim(),
        nomor_penerima: newCustomer.nomor_penerima?.trim() || null,
        alamat_penerima: newCustomer.alamat_penerima?.trim() || null,
        kota_tujuan: newCustomer.kota_tujuan || null,
        kecamatan: newCustomer.kecamatan || null,
        wilayah: newCustomer.kota_tujuan && newCustomer.kecamatan 
          ? `${newCustomer.kota_tujuan} ${newCustomer.kecamatan}`.toUpperCase()
          : null,
        kirim_via: newCustomer.kirim_via || 'udara',
        isi_barang: newCustomer.isi_barang?.trim() || null,
        metode_pembayaran: newCustomer.metode_pembayaran || 'CASH',
        agent_email: agentEmail,
        agent_customer: agentEmail,
        notes: newCustomer.notes?.trim() || null,
        is_active: true
      }

      const { data, error } = await supabase
        .from('agent_customers')
        .insert([customerData])
        .select()
        .single()

      if (error) {
        console.error('Error creating customer:', error)
        toast({
          title: "Error", 
          description: `Failed to create customer: ${error.message || 'Unknown error'}`,
          variant: "destructive"
        })
        return
      }

      toast({
        title: "Success",
        description: "Customer created successfully",
        variant: "default"
      })

      // Reset form and refresh list
      setNewCustomer({
        nama_pengirim: '',
        nomor_pengirim: '',
        nama_penerima: '',
        nomor_penerima: '',
        alamat_penerima: '',
        kota_tujuan: '',
        kecamatan: '',
        wilayah: '',
        kirim_via: 'udara',
        isi_barang: '',
        metode_pembayaran: 'CASH',
        notes: ''
      })
      
      setShowCreateForm(false)
      await fetchCustomers()

      // Auto select the newly created customer
      if (data) {
        onSelect(data)
      }
    } catch (error) {
      console.error('Error:', error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      })
    } finally {
      setIsCreating(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  if (showCreateForm) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Create New Customer
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCreateForm(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nama_pengirim">Nama Pengirim *</Label>
                <Input
                  id="nama_pengirim"
                  value={newCustomer.nama_pengirim}
                  onChange={(e) => handleNewCustomerChange('nama_pengirim', e.target.value)}
                  placeholder="Enter sender name"
                />
              </div>
              <div>
                <Label htmlFor="nomor_pengirim">Nomor Pengirim</Label>
                <Input
                  id="nomor_pengirim"
                  value={newCustomer.nomor_pengirim}
                  onChange={(e) => handleNewCustomerChange('nomor_pengirim', e.target.value)}
                  placeholder="Enter sender phone"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nama_penerima">Nama Penerima *</Label>
                <Input
                  id="nama_penerima"
                  value={newCustomer.nama_penerima}
                  onChange={(e) => handleNewCustomerChange('nama_penerima', e.target.value)}
                  placeholder="Enter receiver name"
                />
              </div>
              <div>
                <Label htmlFor="nomor_penerima">Nomor Penerima</Label>
                <Input
                  id="nomor_penerima"
                  value={newCustomer.nomor_penerima}
                  onChange={(e) => handleNewCustomerChange('nomor_penerima', e.target.value)}
                  placeholder="Enter receiver phone"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="alamat_penerima">Alamat Penerima</Label>
              <Textarea
                id="alamat_penerima"
                value={newCustomer.alamat_penerima}
                onChange={(e) => handleNewCustomerChange('alamat_penerima', e.target.value)}
                placeholder="Enter receiver address"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="kota_tujuan">Kota Tujuan</Label>
                <Select 
                  value={newCustomer.kota_tujuan} 
                  onValueChange={(value) => handleNewCustomerChange('kota_tujuan', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kota tujuan" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(kotaWilayahJabodetabek).map((kota) => (
                      <SelectItem key={kota} value={kota}>
                        {kota}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="kecamatan">Kecamatan</Label>
                <Select 
                  value={newCustomer.kecamatan} 
                  onValueChange={(value) => handleNewCustomerChange('kecamatan', value)}
                  disabled={!newCustomer.kota_tujuan}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kecamatan" />
                  </SelectTrigger>
                  <SelectContent>
                    {getKecamatanOptions().map((kecamatan) => (
                      <SelectItem key={kecamatan} value={kecamatan}>
                        {kecamatan}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="kirim_via">Kirim Via</Label>
                <Select 
                  value={newCustomer.kirim_via} 
                  onValueChange={(value) => handleNewCustomerChange('kirim_via', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih metode pengiriman" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="udara">Udara</SelectItem>
                    <SelectItem value="darat">Darat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="metode_pembayaran">Metode Pembayaran</Label>
                <Select 
                  value={newCustomer.metode_pembayaran} 
                  onValueChange={(value) => handleNewCustomerChange('metode_pembayaran', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih metode pembayaran" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">CASH</SelectItem>
                    <SelectItem value="TRANSFER">TRANSFER</SelectItem>
                    <SelectItem value="COD">COD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="isi_barang">Isi Barang</Label>
              <Input
                id="isi_barang"
                value={newCustomer.isi_barang}
                onChange={(e) => handleNewCustomerChange('isi_barang', e.target.value)}
                placeholder="Enter package contents"
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={newCustomer.notes}
                onChange={(e) => handleNewCustomerChange('notes', e.target.value)}
                placeholder="Additional notes"
                rows={2}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleCreateCustomer}
                disabled={isCreating}
                className="flex-1"
              >
                {isCreating ? 'Creating...' : 'Create Customer'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowCreateForm(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[80vh] flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Select Customer
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={() => setShowCreateForm(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              New Customer
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-gray-500">Loading customers...</div>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              <Users className="h-8 w-8 mb-2" />
              <div>No customers found</div>
              <div className="text-sm">Create your first customer to get started</div>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCustomers.map((customer) => (
                <Card 
                  key={customer.id} 
                  className="p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => onSelect(customer)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{customer.nama_pengirim}</h4>
                        {customer.nomor_pengirim && (
                          <Badge variant="outline" className="text-xs">
                            {customer.nomor_pengirim}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="text-sm text-gray-600">
                        <div>Penerima: {customer.nama_penerima}</div>
                        {customer.nomor_penerima && (
                          <div>No. Penerima: {customer.nomor_penerima}</div>
                        )}
                        {customer.wilayah && (
                          <div>Tujuan: {customer.wilayah}</div>
                        )}
                        {customer.isi_barang && (
                          <div>Barang: {customer.isi_barang}</div>
                        )}
                      </div>
                      
                      <div className="flex gap-2 text-xs">
                        {customer.kirim_via && (
                          <Badge variant="secondary">
                            {customer.kirim_via}
                          </Badge>
                        )}
                        {customer.metode_pembayaran && (
                          <Badge variant="outline">
                            {customer.metode_pembayaran}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <Button variant="outline" size="sm">
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
