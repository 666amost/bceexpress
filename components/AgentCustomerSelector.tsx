"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/db'
import { Search, UserPlus, X, Check, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'

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

interface AgentCustomerSelectorProps {
  onSelect: (customer: AgentCustomer) => void
  onClose: () => void
  branchOrigin: string // For bangka branch to access all agent customers
}

export function AgentCustomerSelector({ onSelect, onClose, branchOrigin }: AgentCustomerSelectorProps) {
  const [customers, setCustomers] = useState<AgentCustomer[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<AgentCustomer[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  // Fetch customers - bangka branch can see all agent customers
  const fetchCustomers = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true)
      
      let query = supabase
        .from('agent_customers')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      // If not bangka branch, don't show any customers
      // (This component is specifically for bangka branch to import agent customers)
      if (branchOrigin !== 'bangka') {
        setCustomers([])
        setFilteredCustomers([])
        setIsLoading(false)
        return
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching agent customers:', error)
        toast({
          title: "Error",
          description: "Failed to fetch agent customers",
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
  }, [supabase, toast, branchOrigin])

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
      customer.alamat_penerima?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.agent_email.toLowerCase().includes(searchTerm.toLowerCase())
    )
    
    setFilteredCustomers(filtered)
  }, [customers])

  // Handle search
  const handleSearch = (value: string): void => {
    setSearchTerm(value)
    filterCustomers(value)
  }

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[80vh] flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Import Agent Customer
              <Badge variant="outline" className="ml-2">
                Branch: {branchOrigin}
              </Badge>
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search agent customers..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-y-auto">
          {branchOrigin !== 'bangka' ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              <Users className="h-8 w-8 mb-2" />
              <div>Access Restricted</div>
              <div className="text-sm">Only Bangka branch can import agent customers</div>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-gray-500">Loading agent customers...</div>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              <Users className="h-8 w-8 mb-2" />
              <div>No agent customers found</div>
              <div className="text-sm">No customers created by agents yet</div>
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
                        <Badge variant="secondary" className="text-xs">
                          Agent: {customer.agent_email}
                        </Badge>
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
                        <Badge variant="outline" className="text-xs">
                          Created: {new Date(customer.created_at).toLocaleDateString()}
                        </Badge>
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
