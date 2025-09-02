'use client'

import { useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
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

  // Smart authentication check for mobile app - with bypass
  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        // Check if running in mobile app context
        const userAgent = navigator.userAgent || '';
        const isMobileApp = userAgent.includes('BCE-Agent-Mobile') || 
                           window.location.hostname === 'capacitor' ||
                           window.parent !== window; // iframe context
        
        // For mobile app, check if parent app has session first
        if (isMobileApp) {
          const mobileSession = localStorage.getItem('mobile_session');
          const authTimestamp = localStorage.getItem('mobile_auth_timestamp');
          
          if (mobileSession && authTimestamp) {
            const sessionAge = Date.now() - parseInt(authTimestamp);
            // If mobile session is valid (less than 24 hours), skip auth check
            if (sessionAge < 24 * 60 * 60 * 1000) {
              // Skip authentication check for mobile
              return;
            }
          }
          
          // If no valid mobile session, post message to parent for auth
          window.parent?.postMessage({
            type: 'AUTH_CHECK_REQUIRED',
            url: window.location.href
          }, '*');
          return; // Don't do strict auth check, let parent handle
        }
        
        // Only do strict authentication check for web browser access
        const { data: { session } } = await supabaseClient.auth.getSession()
        if (!session) {
          window.location.href = '/agent/login';
          return;
        }
        
        // Check user role for web browser
        const { data: userData } = await supabaseClient
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single()
        
        if (!userData || userData.role !== 'agent') {
          setError('Unauthorized access. Agent login required.')
          setTimeout(() => {
            window.location.href = '/agent/login';
          }, 2000);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown authentication error';
        // Don't show error for mobile app context
        const userAgent = navigator.userAgent || '';
        const isMobileApp = userAgent.includes('BCE-Agent-Mobile') || 
                           window.location.hostname === 'capacitor' ||
                           window.parent !== window;
        
        if (!isMobileApp) {
          setError(`Authentication error: ${errorMessage}. Please login again.`);
        }
      }
    }
    
    checkAuthentication()
  }, [])

  // Extract fetchAWBData as useCallback to fix dependency issues
  const fetchAWBData = useCallback(async (): Promise<void> => {
    try {
      // Check if running in mobile app and handle session
      if (typeof window !== 'undefined') {
        const userAgent = navigator.userAgent || '';
        const isMobileApp = userAgent.includes('BCE-Agent-Mobile') || 
                           window.location.hostname === 'capacitor' ||
                           window.parent !== window;
        
        if (isMobileApp) {
          // For mobile app, try to restore session if available
          const mobileSession = localStorage.getItem('mobile_session');
          if (mobileSession) {
            try {
              const sessionData = JSON.parse(mobileSession);
              // Try to set session if available
              await supabaseClient.auth.setSession(sessionData);
            } catch (sessionError: unknown) {
              // Continue anyway, maybe manual session is already active
              // Silent error handling for mobile session restoration
            }
          }
        }
      }
      
      const { data, error } = await supabaseClient
        .from('manifest_cabang')
        .select('*')
        .eq('awb_no', awb_no)
        .single();

      if (error) {
        setError('AWB tidak ditemukan');
        return;
      }

      if (data) {
        // Map data to format expected by PrintLayout
        const processedData = {
          ...data,
          // Preserve actual wilayah field from database, fallback to kota_tujuan only if wilayah is empty
          wilayah: data.wilayah || data.kota_tujuan, // Use actual wilayah field first, then kota_tujuan as fallback
          agent_customer: data.agent_customer || data.origin_branch || 'Agent' // Fallback for agent display
        };
        setAwbData(processedData);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Terjadi kesalahan saat mengambil data AWB: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [awb_no]);

  // Listen for session data from mobile app parent
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'SESSION_DATA' || event.data.type === 'RESTORE_SESSION') {
        // Received session data from mobile parent
        if (event.data.sessionData) {
          supabaseClient.auth.setSession(event.data.sessionData)
            .then(() => {
              // Session restored successfully
              // Refresh data after session restore
              if (awb_no) {
                fetchAWBData();
              }
            })
            .catch((sessionError: unknown) => {
              const errorMessage = sessionError instanceof Error ? sessionError.message : 'Unknown session error';
              setError(`Failed to restore session: ${errorMessage}`);
            });
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [awb_no, fetchAWBData])

  useEffect(() => {
    if (awb_no) {
      fetchAWBData();
    }
  }, [awb_no, fetchAWBData]);

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
          color: #000000 !important;
        }
        .logo-qr {
          padding-top: 0mm !important;
        }
        .shipping-details {
          margin-top: -2mm !important;
          color: #000000 !important;
        }
        .agent-code-box .agent-abbr-left {
          position: relative !important;
          top: -3mm !important;
          color: #ffffff !important; /* Tetap putih untuk kontras dengan background hitam */
        }
        /* Force semua teks menjadi hitam untuk PDF kecuali yang sudah ditentukan */
        .shipping-label,
        .shipping-label *:not(.agent-abbr-left) {
          color: #000000 !important;
        }
        /* Pastikan address box dan semua child elementnya hitam */
        .address-box,
        .address-box *,
        .address-box .sender-info,
        .address-box .sender-info *,
        .address-box .recipient-info,
        .address-box .recipient-info * {
          color: #000000 !important;
        }
        /* Pastikan awb number dan shipping details hitam */
        .awb-number,
        .awb-number *,
        .shipping-details,
        .shipping-details * {
          color: #000000 !important;
        }
        /* Background tetap putih untuk PDF */
        .shipping-label {
          background-color: #ffffff !important;
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
