'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabaseClient } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import PrintLayout from '@/components/PrintLayout'
import { FaPrint, FaDownload } from 'react-icons/fa'

interface AWBDetails {
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
  catatan?: string
  status: string
  created_at: string
  wilayah?: string
}

export default function BulkPrintPage(): JSX.Element {
  const searchParams = useSearchParams()
  const [awbs, setAwbs] = useState<AWBDetails[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')

  const fetchAWBs = useCallback(async (awbNumbers: string[]): Promise<void> => {
    try {
      setLoading(true)
      
      const { data, error } = await supabaseClient
        .from('manifest_booking')
        .select('*')
        .in('awb_no', awbNumbers)
        .order('created_at', { ascending: false })

      if (error) throw error

      const formattedData = data?.map((booking: any) => ({
        awb_no: booking.awb_no,
        awb_date: booking.awb_date,
        kirim_via: booking.kirim_via,
        kota_tujuan: booking.kota_tujuan,
        kecamatan: booking.kecamatan,
        metode_pembayaran: booking.metode_pembayaran,
        agent_customer: booking.agent_customer,
        nama_pengirim: booking.nama_pengirim,
        nomor_pengirim: booking.nomor_pengirim,
        nama_penerima: booking.nama_penerima,
        nomor_penerima: booking.nomor_penerima,
        alamat_penerima: booking.alamat_penerima,
        coli: booking.coli,
        berat_kg: booking.berat_kg,
        harga_per_kg: booking.harga_per_kg,
        sub_total: booking.sub_total,
        biaya_admin: booking.biaya_admin,
        biaya_packaging: booking.biaya_packaging,
        biaya_transit: booking.biaya_transit,
        total: booking.total,
        isi_barang: booking.isi_barang,
        catatan: booking.catatan,
        status: booking.status,
        created_at: booking.created_at,
        wilayah: booking.kota_tujuan
      })) || []

      setAwbs(formattedData)
    } catch (err) {
      console.error('Error fetching AWBs:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch AWB data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const awbParam = searchParams.get('awbs')
    if (awbParam) {
      const awbNumbers = awbParam.split(',').filter(Boolean)
      if (awbNumbers.length > 0) {
        fetchAWBs(awbNumbers)
      } else {
        setError('No valid AWB numbers provided')
        setLoading(false)
      }
    } else {
      setError('No AWB numbers provided')
      setLoading(false)
    }
  }, [searchParams, fetchAWBs])

  const handlePrint = useCallback((): void => {
    window.print()
  }, [])

  const handleDownloadPDF = useCallback(async (): Promise<void> => {
    const html2pdf = (await import('html2pdf.js')).default
    const element = document.getElementById('bulk-print-content')
    
    if (!element) return

    const options = {
      margin: 0.5,
      filename: `bulk-awb-${awbs.length}-labels.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    }

    try {
      await html2pdf().set(options).from(element).save()
    } catch (error) {
      console.error('Error generating PDF:', error)
    }
  }, [awbs.length])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading AWB data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Hidden in print */}
      <div className="print:hidden bg-white shadow-sm p-4 mb-6">
        <div className="container mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Bulk AWB Print</h1>
              <p className="text-sm text-gray-600">
                Found {awbs.length} AWB label{awbs.length !== 1 ? 's' : ''} ready for printing
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handlePrint}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <FaPrint className="h-4 w-4 mr-2" />
                Print All
              </Button>
              <Button
                onClick={handleDownloadPDF}
                variant="outline"
                className="border-blue-300 text-blue-600 hover:bg-blue-50"
              >
                <FaDownload className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </div>
          
          {/* Status Summary */}
          <div className="flex gap-2 mt-4">
            <Badge variant="outline" className="bg-yellow-50">
              Pending: {awbs.filter(awb => awb.status.toLowerCase() === 'pending').length}
            </Badge>
            <Badge variant="outline" className="bg-blue-50">
              In Transit: {awbs.filter(awb => awb.status.toLowerCase() === 'in transit').length}
            </Badge>
            <Badge variant="outline" className="bg-green-50">
              Delivered: {awbs.filter(awb => awb.status.toLowerCase() === 'delivered').length}
            </Badge>
          </div>
        </div>
      </div>

      {/* Print Content */}
      <div id="bulk-print-content" className="container mx-auto p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2 print:gap-2">
          {awbs.map((awb) => (
            <div key={awb.awb_no} className="break-inside-avoid">
              <PrintLayout data={awb} />
            </div>
          ))}
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          .print\\:hidden {
            display: none !important;
          }
          
          .print\\:grid-cols-2 {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          
          .print\\:gap-2 {
            gap: 0.5rem !important;
          }
          
          body {
            margin: 0;
            padding: 0;
            background: white !important;
          }
          
          .container {
            max-width: none !important;
            margin: 0 !important;
            padding: 0.5rem !important;
          }
          
          .break-inside-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  )
}
