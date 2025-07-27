"use client"

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabaseClient } from '../../../../lib/auth';
import PrintLayout from '../../../../components/PrintLayout';

interface AWBData {
  id: string;
  awb_no: string;
  awb_date: string;
  kirim_via: string;
  kota_tujuan: string;
  kecamatan: string;
  wilayah?: string;
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
  status: string;
  origin_branch: string;
  created_at: string;
}

export default function PrintLabelPage() {
  const params = useParams();
  const awb_no = params.awb_no as string;
  const [awbData, setAwbData] = useState<AWBData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleDownloadPDF = async () => {
    if (!awbData) return;
    
    try {
      // Find the print layout element on current page
      const element = document.querySelector('.print-layout-container') as HTMLElement;
      if (!element) {
        alert('Print layout not found');
        return;
      }

      // Add PDF-specific styling
      const pdfSpecificStyle = document.createElement('style');
      pdfSpecificStyle.innerHTML = `
        .payment-method-code {
          font-size: 20px !important;
          font-weight: bold !important;
          width: 100% !important;
          text-align: center !important;
          margin-top: -1mm !important;
          display: block !important;
          position: relative !important;
          top: -1mm !important;
        }
        .logo-qr {
          padding-top: 0mm !important;
        }
        .shipping-details {
          margin-top: -2mm !important;
        }
        .agent-code-box .agent-abbr-left {
          position: relative !important;
          top: -3mm !important;
        }
      `;
      element.appendChild(pdfSpecificStyle);

      // Import html2pdf
      const html2pdf = await import('html2pdf.js');
      
      // Configuration for better PDF quality
      const options = {
        filename: `${awbData.awb_no}.pdf`,
        margin: 0,
        image: { 
          type: 'jpeg', 
          quality: 1.0 
        },
        html2canvas: { 
          scale: 4,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          width: 378, // 100mm * 3.78 (96 DPI to mm conversion * scale)
          height: 378,
          scrollX: 0,
          scrollY: 0
        },
        jsPDF: { 
          unit: 'mm', 
          format: [100, 100] as [number, number], 
          orientation: 'portrait',
          compress: true
        }
      };
      
      // Generate and download PDF
      await html2pdf.default()
        .set(options)
        .from(element)
        .save();

      // Remove the style after PDF generation
      element.removeChild(pdfSpecificStyle);
        
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Gagal membuat PDF. Silakan coba lagi.');
    }
  };

  useEffect(() => {
    const fetchAWBData = async () => {
      try {
        const { data, error } = await supabaseClient
          .from('manifest_booking')
          .select('*')
          .eq('awb_no', awb_no)
          .single();

        if (error) {
          console.error('Error fetching AWB:', error);
          setError('AWB tidak ditemukan');
          return;
        }

        if (data) {
          // Map data to format expected by PrintLayout
          const processedData = {
            ...data,
            wilayah: data.kota_tujuan, // For airport code mapping
            agent_customer: data.agent_customer || data.origin_branch || 'Agent' // Fallback for agent display
          };
          setAwbData(processedData);
        }
      } catch (err) {
        console.error('Error:', err);
        setError('Terjadi kesalahan saat mengambil data AWB');
      } finally {
        setLoading(false);
      }
    };

    if (awb_no) {
      fetchAWBData();
    }
  }, [awb_no]);

  useEffect(() => {
    // Auto print when data is loaded
    if (awbData && !loading) {
      const timer = setTimeout(() => {
        window.print();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [awbData, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Loading Resi data...</p>
        </div>
      </div>
    );
  }

  if (error || !awbData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p>{error || 'Resi tidak ditemukan'}</p>
          <button 
            onClick={() => window.close()} 
            className="mt-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Tutup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Show print button only on screen, not when printing */}
      <div className="no-print p-4 text-center border-b">
        <h1 className="text-xl font-bold mb-4">Print Label Resi: {awbData.awb_no}</h1>
        <div className="space-x-4">
          <button 
            onClick={() => window.print()} 
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Print
          </button>
          <button 
            onClick={handleDownloadPDF} 
            className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Download PDF
          </button>
          <button 
            onClick={() => window.close()} 
            className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
      
      <div className="print-layout-container">
        <PrintLayout data={awbData} />
      </div>
      
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          
          body {
            margin: 0;
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          @page {
            size: 100mm 100mm;
            margin: 0;
          }
        }
        
        @media screen {
          .print-only {
            border: 1px dashed #ccc;
            margin: 20px auto;
          }
        }
      `}</style>
    </div>
  );
}
