"use client"

import React, { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { FaPrint, FaTimes, FaBoxOpen, FaMapMarkerAlt, FaUser, FaPhone, FaCalendarAlt } from 'react-icons/fa';

// Tambahkan mapping kode bandara dan kode area
const airportCodes: Record<string, string> = {
  'JAKARTA BARAT': 'JKB',
  'JAKARTA PUSAT': 'JKP',
  'JAKARTA TIMUR': 'JKT',
  'JAKARTA SELATAN': 'JKS',
  'JAKARTA UTARA': 'JKU',
};
const areaCodes: Record<string, string> = {
  // Heading mappings
  'GREEN LAKE CITY': 'GLC',
  'GRENLAKE CITY': 'GLC',
  'GRENLAKE CITY / BARAT': 'GLC',
  // Jakarta Barat - GLC group
  'CENGKARENG': 'GLC',
  'GROGOL PETAMBURAN': 'GLC',
  'KALIDERES': 'GLC',
  'KEBON JERUK': 'GLC',
  'KEMBANGAN': 'GLC',
  'PALMERAH': 'GLC',
  // Jakarta Selatan - GLC group
  'CILANDAK': 'GLC',
  'JAGAKARSA': 'GLC',
  'KEBAYORAN BARU': 'GLC',
  'KEBAYORAN LAMA': 'GLC',
  'MAMPANG PRAPATAN': 'GLC',
  'PASAR MINGGU': 'GLC',
  'PESANGGRAHAN': 'GLC',
  // Jakarta Utara - GLC group
  'PENJARINGAN': 'GLC',

  // Kreko mappings
  'KREKOT': 'KMY',
  'KREKOT / PUSAT': 'KMY',
  // Jakarta Barat - KMY group
  'TAMAN SARI': 'KMY',
  'TAMBORA': 'KMY',
  // Jakarta Selatan - KMY group
  'PANCORAN': 'KMY',
  'SETIABUDI': 'KMY',
  'TEBET': 'KMY',
  // Jakarta Utara - KMY group
  'CILINCING': 'KMY',
  'KELAPA GADING': 'KMY',
  'KOJA': 'KMY',
  'PADEMANGAN': 'KMY',
  'TANJUNG PRIOK': 'KMY'
};

interface ManifestBookingData {
  id?: string;
  awb_no: string;
  awb_date: string;
  kirim_via: string;
  kota_tujuan: string;
  kecamatan: string;
  metode_pembayaran: string;
  agent_customer: string;
  nama_pengirim: string;
  nomor_pengirim: string;
  nama_penerima: string;
  nomor_penerima: string;
  alamat_penerima: string;
  coli: number;
  berat_kg: number;
  harga_per_kg: number;
  sub_total: number;
  biaya_admin: number;
  biaya_packaging: number;
  biaya_transit: number;
  total: number;
  isi_barang: string;
  catatan?: string;
}

interface AWBPrintLabelProps {
  awbData: ManifestBookingData;
  onClose: () => void;
}

export const AWBPrintLabel: React.FC<AWBPrintLabelProps> = ({ awbData, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);
  // Hitung kode bandara dan area
  const airportCode = airportCodes[awbData.kota_tujuan] || '';
  const areaCode = areaCodes[awbData.kecamatan] || '';

  const handlePrint = () => {
    if (printRef.current) {
      const printContent = printRef.current.innerHTML;
      const originalContent = document.body.innerHTML;
      
      document.body.innerHTML = printContent;
      window.print();
      document.body.innerHTML = originalContent;
      window.location.reload(); // Reload to restore React functionality
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header with actions */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">AWB Label Print Preview</h2>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold airport-code">{airportCode}</div>
            <div className="text-lg font-semibold area-code">{areaCode}</div>
          </div>
           <div className="flex gap-2">
             <Button onClick={handlePrint} className="flex items-center gap-2">
               <FaPrint className="h-4 w-4" />
               Print
             </Button>
             <Button variant="outline" onClick={onClose}>
               <FaTimes className="h-4 w-4" />
             </Button>
           </div>
         </div>

        {/* Print content */}
        <div ref={printRef} className="p-6">
          <style jsx>{`
            @media print {
              body { margin: 0; }
              .print-container { page-break-inside: avoid; }
            }
          `}</style>
          
          <div className="print-container">
            {/* Company Header */}
            <div className="text-center mb-6 border-b-2 border-gray-300 pb-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <FaBoxOpen className="h-8 w-8 text-blue-600" />
                <h1 className="text-2xl font-bold text-blue-900">BCE Express</h1>
              </div>
              <p className="text-gray-600">Better Cargo Experience - Professional Logistics Services</p>
              <p className="text-sm text-gray-500">Air Waybill (AWB) Shipping Label</p>
            </div>

            {/* AWB Information */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="space-y-3">
                <div className="border-2 border-blue-300 p-3 rounded-lg bg-blue-50">
                  <label className="text-xs font-semibold text-blue-700 uppercase tracking-wide">AWB Number</label>
                  <div className="text-2xl font-bold font-mono text-blue-900 mt-1">
                    {awbData.awb_no}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">AWB Date</label>
                    <div className="text-sm font-medium mt-1">
                      {formatDate(awbData.awb_date)}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Kirim Via</label>
                    <div className="text-sm font-medium mt-1">
                      {awbData.kirim_via}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Payment Method</label>
                  <div className="text-sm font-medium mt-1 px-2 py-1 bg-green-100 text-green-800 rounded inline-block">
                    {awbData.metode_pembayaran}
                  </div>
                </div>
                
                <div>
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Agent</label>
                  <div className="text-sm font-medium mt-1">
                    {awbData.agent_customer}
                  </div>
                </div>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Sender and Receiver Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Sender */}
              <div className="border-2 border-green-300 p-4 rounded-lg bg-green-50">
                <div className="flex items-center gap-2 mb-3">
                  <FaUser className="h-5 w-5 text-green-600" />
                  <h3 className="font-bold text-green-800 uppercase tracking-wide">Pengirim (Sender)</h3>
                </div>
                
                <div className="space-y-2">
                  <div>
                    <label className="text-xs font-semibold text-green-700">Nama</label>
                    <div className="font-medium text-gray-900">{awbData.nama_pengirim}</div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-semibold text-green-700">Nomor Telepon</label>
                    <div className="font-medium text-gray-900 flex items-center gap-1">
                      <FaPhone className="h-3 w-3" />
                      {awbData.nomor_pengirim}
                    </div>
                  </div>
                </div>
              </div>

              {/* Receiver */}
              <div className="border-2 border-red-300 p-4 rounded-lg bg-red-50">
                <div className="flex items-center gap-2 mb-3">
                  <FaMapMarkerAlt className="h-5 w-5 text-red-600" />
                  <h3 className="font-bold text-red-800 uppercase tracking-wide">Penerima (Receiver)</h3>
                </div>
                
                <div className="space-y-2">
                  <div>
                    <label className="text-xs font-semibold text-red-700">Nama</label>
                    <div className="font-medium text-gray-900">{awbData.nama_penerima}</div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-semibold text-red-700">Nomor Telepon</label>
                    <div className="font-medium text-gray-900 flex items-center gap-1">
                      <FaPhone className="h-3 w-3" />
                      {awbData.nomor_penerima}
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-semibold text-red-700">Alamat</label>
                    <div className="font-medium text-gray-900 text-sm leading-tight">
                      {awbData.alamat_penerima}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-red-700">Kota</label>
                      <div className="font-bold text-red-900">{awbData.kota_tujuan}</div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-red-700">Kecamatan</label>
                      <div className="font-medium text-gray-900">{awbData.kecamatan}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Package Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-4">
                <h3 className="font-bold text-gray-800 uppercase tracking-wide border-b pb-2">Package Details</h3>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-orange-100 rounded-lg">
                    <label className="text-xs font-semibold text-orange-700 uppercase block">Coli</label>
                    <div className="text-2xl font-bold text-orange-900">{awbData.coli}</div>
                  </div>
                  
                  <div className="text-center p-3 bg-blue-100 rounded-lg">
                    <label className="text-xs font-semibold text-blue-700 uppercase block">Berat</label>
                    <div className="text-2xl font-bold text-blue-900">{awbData.berat_kg} KG</div>
                  </div>
                  
                  <div className="text-center p-3 bg-purple-100 rounded-lg">
                    <label className="text-xs font-semibold text-purple-700 uppercase block">Rate/KG</label>
                    <div className="text-lg font-bold text-purple-900">
                      Rp {awbData.harga_per_kg.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Isi Barang</label>
                  <div className="font-medium text-gray-900 bg-gray-100 p-2 rounded text-sm">
                    {awbData.isi_barang}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-gray-800 uppercase tracking-wide border-b pb-2">Cost Breakdown</h3>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Sub Total:</span>
                    <span className="font-medium">Rp {awbData.sub_total.toLocaleString()}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span>Biaya Admin:</span>
                    <span className="font-medium">Rp {awbData.biaya_admin.toLocaleString()}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span>Biaya Packaging:</span>
                    <span className="font-medium">Rp {awbData.biaya_packaging.toLocaleString()}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span>Biaya Transit:</span>
                    <span className="font-medium">Rp {awbData.biaya_transit.toLocaleString()}</span>
                  </div>
                  
                  <Separator />
                  
                  <div className="flex justify-between text-lg font-bold bg-yellow-100 p-2 rounded">
                    <span>Total:</span>
                    <span className="text-yellow-800">Rp {awbData.total.toLocaleString()}</span>
                  </div>
                </div>

                {awbData.catatan && (
                  <div>
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Catatan</label>
                    <div className="font-medium text-gray-900 bg-gray-100 p-2 rounded text-sm">
                      {awbData.catatan}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t-2 border-gray-300 pt-4 text-center text-xs text-gray-600">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="font-semibold">Tanda Tangan Pengirim</div>
                  <div className="h-16 border-b border-gray-300 mt-8"></div>
                </div>
                <div>
                  <div className="font-semibold">Cap & Tanda Tangan Petugas</div>
                  <div className="h-16 border-b border-gray-300 mt-8"></div>
                </div>
                <div>
                  <div className="font-semibold">Tanda Tangan Penerima</div>
                  <div className="h-16 border-b border-gray-300 mt-8"></div>
                </div>
              </div>
              
              <div className="mt-4 text-center">
                <p>Generated on {new Date().toLocaleDateString('id-ID')} • BCE Express System</p>
                <p className="text-xs">Terima kasih telah menggunakan layanan BCE Express</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
