"use client"

import React, { useState } from 'react'
import CustomerManager from './CustomerManager'

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

interface CustomerSelectorProps {
  onCustomerSelect: (customer: Customer) => void
  onClose: () => void
  branchOrigin: string | null
  userRole?: string | null
}

export default function CustomerSelector({ onCustomerSelect, onClose, branchOrigin, userRole }: CustomerSelectorProps) {
  const handleCustomerSelect = (customer: Customer): void => {
    onCustomerSelect(customer)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Import Data Customer
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
          >
            ×
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <CustomerManager 
            mode="select" 
            onCustomerSelect={handleCustomerSelect}
            branchOrigin={branchOrigin}
            userRole={userRole}
          />
        </div>
      </div>
    </div>
  )
}
