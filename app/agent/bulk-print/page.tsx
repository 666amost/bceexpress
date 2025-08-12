'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabaseClient } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
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
  status: string // Default status untuk keperluan display
  created_at: string
  wilayah?: string
}

function BulkPrintContent(): JSX.Element {
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [awbs, setAwbs] = useState<AWBDetails[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')
  const [printReady, setPrintReady] = useState<boolean>(false)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false)

  const fetchAWBs = useCallback(async (awbNumbers: string[]): Promise<void> => {
    try {
      setLoading(true)
      
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
        .in('awb_no', awbNumbers)
        .order('created_at', { ascending: false })

      if (error) throw error

      const formattedData = data?.map((booking: Record<string, unknown>) => ({
        awb_no: booking.awb_no as string,
        awb_date: booking.awb_date as string,
        kirim_via: (booking.kirim_via as string) || 'DARAT',
        kota_tujuan: booking.kota_tujuan as string,
        kecamatan: (booking.kecamatan as string) || (booking.wilayah as string) || booking.kota_tujuan as string, // Fallback chain
        metode_pembayaran: booking.metode_pembayaran as string,
        agent_customer: (booking.agent_customer as string) || '',
        nama_pengirim: booking.nama_pengirim as string,
        nomor_pengirim: (booking.nomor_pengirim as string) || '',
        nama_penerima: booking.nama_penerima as string,
        nomor_penerima: (booking.nomor_penerima as string) || '',
        alamat_penerima: (booking.alamat_penerima as string) || '',
        coli: (booking.coli as number) || 1,
        berat_kg: (booking.berat_kg as number) || 1,
        harga_per_kg: (booking.harga_per_kg as number) || 0,
        sub_total: (booking.sub_total as number) || 0,
        biaya_admin: (booking.biaya_admin as number) || 0,
        biaya_packaging: (booking.biaya_packaging as number) || 0,
        biaya_transit: (booking.biaya_transit as number) || 0,
        total: (booking.total as number) || 0,
        isi_barang: (booking.isi_barang as string) || '',
        catatan: booking.catatan as string | undefined,
        status: 'pending', // Default status untuk AWB yang baru dibuat
        created_at: booking.created_at as string,
        wilayah: (booking.wilayah as string) || (booking.kota_tujuan as string) // Use actual wilayah field first, then kota_tujuan as fallback
      })) || []

      setAwbs(formattedData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch AWB data')
    } finally {
      setLoading(false)
    }
  }, [])

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
              const awbParam = searchParams.get('awbs');
              if (awbParam) {
                const awbNumbers = awbParam.split(',').filter(Boolean);
                if (awbNumbers.length > 0) {
                  fetchAWBs(awbNumbers);
                }
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
  }, [searchParams, fetchAWBs])

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

  // Authentication check for mobile app - with smart bypass
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

  // After AWBs are loaded, trigger printReady after next tick
  useEffect(() => {
    if (!loading && awbs.length > 0) {
      setPrintReady(false);
      // Wait for refs to attach
      setTimeout(() => {
        setPrintReady(true);
      }, 0);
    } else {
      setPrintReady(false);
    }
  }, [loading, awbs]);

  const handlePrint = useCallback((): void => {
    window.print()
  }, [])

  const handleDownloadPDF = useCallback(async (): Promise<void> => {
    if (!awbs.length || !printReady) {
      toast({
        title: "AWB belum siap.",
        description: "Tunggu beberapa detik hingga semua label siap sebelum mengunduh PDF.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingPDF(true);
    toast({
      title: "Memproses PDF...",
      description: `Membuat PDF untuk ${awbs.length} resi. Mohon tunggu...`,
      variant: "default",
    });

    setTimeout(async () => {
      try {
        const html2canvas = await import('html2canvas');
        const { jsPDF } = await import('jspdf');

        const pdf = new jsPDF({
          unit: 'mm',
          format: [100, 100],
          orientation: 'portrait'
        });

        let isFirstPage = true;

        for (let i = 0; i < awbs.length; i++) {
          const awb = awbs[i];
          
          const visibleElement = document.querySelector(`[data-awb="${awb.awb_no}"] .print-layout-container`) as HTMLElement;

          if (visibleElement) {
            if (!isFirstPage) {
              pdf.addPage();
            }

            try {
              await new Promise<void>(resolve => setTimeout(resolve, 300));
              
              const canvas = await html2canvas.default(visibleElement, {
                scale: 3,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                width: 378,
                height: 378,
                scrollX: 0,
                scrollY: 0
              });

              const dataURL = canvas.toDataURL('image/jpeg', 1.0);

              if (dataURL && typeof dataURL === 'string' && dataURL.startsWith('data:image/')) {
                pdf.addImage(dataURL, 'JPEG', 0, 0, 100, 100);
                isFirstPage = false;
              }
            } catch (elementError) {
              // Silent error handling - continue with next AWB
              continue;
            }
          }
        }

        if (!isFirstPage) {
          pdf.save(`bulk-awb-${awbs.length}-labels.pdf`);
          toast({
            title: "PDF Berhasil Dibuat!",
            description: `PDF dengan ${awbs.length} AWB telah diunduh.`,
            variant: "default",
          });
        } else {
          throw new Error('Tidak ada AWB yang berhasil diproses. Coba tunggu beberapa detik lagi untuk memastikan halaman sudah sepenuhnya dimuat.');
        }

      } catch (error) {
        toast({
          title: "Gagal mengunduh PDF.",
          description: error instanceof Error ? error.message : "Terjadi kesalahan saat membuat PDF. Silakan coba lagi.",
          variant: "destructive",
        });
      } finally {
        setIsGeneratingPDF(false);
      }
    }, 1000);
  }, [awbs, toast, printReady])

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
              Pending: {awbs.filter(awb => (awb.status || '').toLowerCase() === 'pending').length}
            </Badge>
            <Badge variant="outline" className="bg-blue-50">
              In Transit: {awbs.filter(awb => (awb.status || '').toLowerCase() === 'in transit').length}
            </Badge>
            <Badge variant="outline" className="bg-green-50">
              Delivered: {awbs.filter(awb => (awb.status || '').toLowerCase() === 'delivered').length}
            </Badge>
          </div>
        </div>
      </div>

      {/* Print Content */}
      <div id="bulk-print-content" className="container mx-auto p-4 print:p-0">
        {awbs.map((awb, index) => (
          <div 
            key={awb.awb_no} 
            className={`print-page-container ${index > 0 ? 'print:page-break-before' : ''}`}
            data-awb={awb.awb_no}
          >
            <div className="print-layout-container">
              <PrintLayout data={awb} />
            </div>
          </div>
        ))}
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          .print\\:hidden {
            display: none !important;
          }
          
          .print\\:p-0 {
            padding: 0 !important;
          }
          
          .print\\:page-break-before {
            page-break-before: always !important;
            break-before: page !important;
          }
          
          body {
            margin: 0;
            padding: 0;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          .container {
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          .print-page-container {
            width: 100mm;
            height: 100mm;
            margin: 0;
            padding: 0;
            page-break-inside: avoid;
            break-inside: avoid;
            display: block;
            position: relative;
            overflow: hidden;
          }
          
          .print-layout-container {
            width: 100mm;
            height: 100mm;
            margin: 0;
            padding: 0;
            display: block;
            position: relative;
          }
          
          @page {
            size: 100mm 100mm;
            margin: 0;
          }
        }
        
        @media screen {
          .print-page-container {
            border: 1px dashed #ccc;
            margin: 20px auto;
            width: 100mm;
            height: 100mm;
            display: block;
            position: relative;
            overflow: hidden;
          }
          
          .print-layout-container {
            width: 100%;
            height: 100%;
          }
        }
      `}</style>
    </div>
  )
}

function LoadingFallback(): JSX.Element {
  return (
    <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  )
}

export default function BulkPrintPage(): JSX.Element {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <BulkPrintContent />
    </Suspense>
  )
}
