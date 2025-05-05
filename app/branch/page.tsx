"use client"
// This is a new file for the branch dashboard
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseClient } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import QRCode from 'qrcode';  // For QR code generation
import JsBarcode from 'jsbarcode';  // For Code128 generation
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Plane, Ship } from 'lucide-react';

interface Shipment {
  id: string;
  awb_number: string;
  sender_name: string;
  sender_address: string;
  sender_phone: string;
  receiver_name: string;
  receiver_address: string;
  receiver_phone: string;
  weight: number;
  dimensions: string;
  service_type: string;
  current_status: string;
  created_at: string;  // Ensure this is included for sorting
  ongkos_kirim: number;  // Added for shipping cost
  coli: number;  // Ensure this is present
}

export default function BranchDashboard() {
  const [resiInput, setResiInput] = useState('');  // For manual awb_number
  const [resiNumber, setResiNumber] = useState('');  // Generated or manual awb_number
  const [senderName, setSenderName] = useState('');
  const [senderAddress, setSenderAddress] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverAddress, setReceiverAddress] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [weight, setWeight] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [coli, setColi] = useState('1');  // Default to 1
  const [manifestData, setManifestData] = useState<Shipment[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));  // Default to current month, e.g., '2024-10'
  const [ongkosKirim, setOngkosKirim] = useState('');
  const router = useRouter();

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
      if (sessionError || !session || !session.user) {
        router.push('/branch/login');
        return;
      }
      const userId = session.user.id;
      const { data: userData, error: queryError } = await supabaseClient.from('users').select('role').eq('id', userId).single();
      if (queryError) {
        setUserRole('Error: ' + queryError.message);
      } else if (userData && userData.role === 'branch') {
        setUserRole(userData.role);
      } else {
        setUserRole(userData ? userData.role : 'Tidak ditemukan');
        router.push('/branch/login');
      }
    };
    checkAccess();
  }, [router]);

  if (userRole !== 'branch') {
    return <div>Anda tidak memiliki akses ke halaman ini. Role Anda: {userRole}. Silakan periksa role di Supabase.</div>;
  }

  const generateResi = () => {
    const uniqueCode = String(Math.floor(1000000000 + Math.random() * 9000000000)).padStart(10, '0');  // Ensure exactly 10 digits, e.g., 0502056470
    const fullResi = `BCEX${uniqueCode}`;
    setResiNumber(fullResi);
  };

  const handleManualResi = () => {
    setResiNumber(resiInput);
  };

  const handleSubmitResi = async () => {
    if (!resiNumber || !senderName || !senderAddress || !senderPhone || !receiverName || !receiverAddress || !receiverPhone || !weight || !dimensions || !serviceType || !ongkosKirim) {
      alert('Harap isi semua field.');
      return;
    }
    const newShipment = {
      awb_number: resiNumber,
      sender_name: senderName,
      sender_address: senderAddress,
      sender_phone: senderPhone,
      receiver_name: receiverName,
      receiver_address: receiverAddress,
      receiver_phone: receiverPhone,
      weight: parseFloat(weight),
      dimensions: dimensions,
      service_type: serviceType,
      current_status: 'Processed',  // As per user's schema and workflow
      ongkos_kirim: parseFloat(ongkosKirim) || 0,
      coli: parseInt(coli) || 1,  // Use the input value or default to 1
    };
    try {
      const { error } = await supabaseClient.from('shipments').insert([newShipment]);
      if (error) {
        console.error('Supabase error:', error);
        alert('Error menyimpan data: ' + (error.message || 'Periksa konsol untuk detail lebih lanjut.'));
      } else {
        alert('Data berhasil disimpan!');
        setResiInput('');
        setResiNumber('');
        setSenderName('');
        setSenderAddress('');
        setSenderPhone('');
        setReceiverName('');
        setReceiverAddress('');
        setReceiverPhone('');
        setWeight('');
        setDimensions('');
        setServiceType('');
        setOngkosKirim('');
        setColi('1');
      }
    } catch (err: unknown) {
      console.error('Unhandled error:', err);
      if (err instanceof Error) {
        alert('Terjadi error tak terduga: ' + err.message + '. Periksa Supabase apakah tabel ada.');
      } else {
        alert('Terjadi error tak terduga.');
      }
    }
  };

  const handlePrintLabel = async () => {
    if (!resiNumber) {
      alert('Harap generate atau masukkan resi terlebih dahulu.');
      return;
    }

    const printWindow = window.open('', '', 'width=800,height=1100');
    if (!printWindow) {
      alert('Gagal membuka jendela cetak.');
      return;
    }

    let printContent = `
      <style>
        @page {
          size: letter portrait;
          margin: 0;
        }
        body { margin: 0; padding: 0; }
        .resi-sheet {
          width: 100vw;
          height: 100vh;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        }
        .resi-label {
          width: 100vw;
          height: 32.7vh;
          min-height: 32.7vh;
          max-height: 32.7vh;
          box-sizing: border-box;
          padding: 0 8px 0 8px;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
        }
        .cut-line {
          width: 100vw;
          border-bottom: 2px dashed #000;
          margin: 0;
        }
        .label-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #000;
          padding: 4px 0 4px 0;
        }
        .logo {
          height: 38px;
          margin-right: 12px;
        }
        .resi-number {
          font-size: 2em;
          font-weight: bold;
          letter-spacing: 2px;
          text-align: right;
        }
        .barcode-row {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          margin: 4px 0 4px 0;
        }
        .barcode-img {
          width: 97%;
          height: 80px;
          object-fit: contain;
        }
        .main-row {
          display: flex;
          flex-direction: row;
          align-items: flex-start;
          gap: 16px;
          margin-top: 4px;
        }
        .qr-block {
          flex: 0 0 140px;
          display: flex;
          align-items: flex-start;
          justify-content: center;
        }
        .qr-img {
          width: 130px;
          height: 130px;
          object-fit: contain;
        }
        .info-block {
          flex: 1;
          font-size: 1.15em;
          font-weight: bold;
          line-height: 1.4;
          word-break: break-word;
        }
        .address-block {
          margin-bottom: 8px;
        }
        .instruction {
          font-size: 0.95em;
          color: #222;
          border-top: 1px solid #000;
          margin-top: 4px;
          padding-top: 2px;
        }
      </style>
      <div class="resi-sheet">
    `;

    async function getImages() {
      const qrCanvas = document.createElement('canvas');
      await QRCode.toCanvas(qrCanvas, resiNumber, { margin: 0, scale: 8, errorCorrectionLevel: 'H' });
      const qrData = qrCanvas.toDataURL('image/png');
      const barcodeCanvas = document.createElement('canvas');
      JsBarcode(barcodeCanvas, resiNumber, { format: 'CODE128', width: 6, height: 110, displayValue: false, margin: 0 });
      const barcodeData = barcodeCanvas.toDataURL('image/png');
      return { qrData, barcodeData };
    }

    getImages().then(({ qrData, barcodeData }) => {
      for (let i = 0; i < 3; i++) {
        printContent += `
          <div class="resi-label">
            <div class="label-header">
              <img src="/images/bce-logo.png" class="logo" />
              <div class="resi-number">${resiNumber}</div>
            </div>
            <div class="barcode-row">
              <img src="${barcodeData}" class="barcode-img" />
            </div>
            <div class="main-row">
              <div class="info-block">
                <div class="address-block">To:<br>${receiverName}<br>${receiverAddress}<br>Telp: ${receiverPhone}</div>
                <div class="address-block">From:<br>${senderName}<br>${senderAddress}<br>Telp: ${senderPhone}</div>
                <div>Berat: ${weight} kg &nbsp; | &nbsp; Dimensi: ${dimensions}</div>
                <div>Layanan: ${serviceType}</div>
              </div>
              <div class="qr-block">
                <img src="${qrData}" class="qr-img" />
              </div>
            </div>
            <div class="instruction">
              Mohon jangan dilipat. Scan barcode/QR untuk tracking. Pastikan data sesuai sebelum pengiriman.
            </div>
          </div>
          ${i < 2 ? '<div class="cut-line"></div>' : ''}
        `;
      }
      printContent += '</div>';
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    });
  };

  const fetchManifest = async (month: string) => {
    try {
      const [year, monthNum] = month.split('-');
      const firstDay = new Date(Date.UTC(parseInt(year), parseInt(monthNum) - 1, 1));  // Adjust for GMT +7 by using UTC and adding offset if needed
      firstDay.setUTCHours(7, 0, 0, 0);  // GMT +7 offset
      const lastDay = new Date(Date.UTC(parseInt(year), parseInt(monthNum), 0));
      lastDay.setUTCHours(7, 0, 0, 0);  // GMT +7 offset
      
      const { data, error } = await supabaseClient.from('shipments').select('*').gte('created_at', firstDay.toISOString()).lte('created_at', lastDay.toISOString()).order('created_at', { ascending: true });
      if (error) {
        console.error('Error fetching manifest data:', error);
        alert('Gagal memuat laporan: ' + error.message);
      } else {
        console.log('Fetched manifest data:', data);
        setManifestData(data as Shipment[]);
      }
    } catch (err) {
      console.error('Unhandled error in fetchManifest:', err);
      alert('Terjadi error tak terduga saat memuat laporan. Periksa konsol untuk detail.');
    }
  };

  const handleDownloadCSV = () => {
    if (manifestData.length === 0) return;  // Check if data exists
    const headers = ['Tgl', 'No. Resi', 'Penerima', 'Alamat', 'Layanan', 'Ongkos Kirim'];
    const csvRows = [
      headers,
      ...manifestData.map(item => [
        new Date(item.created_at).toLocaleDateString(),
        item.awb_number,
        item.receiver_name,
        item.receiver_address,
        item.service_type,
        item.ongkos_kirim ? item.ongkos_kirim.toString() : 'N/A'
      ])
    ];
    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'manifest_bulanan.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handlePrintManifestLabel = async (shipment: Shipment) => {
    if (!shipment.awb_number) {
      alert('AWB number is missing for this shipment.');
      return;
    }

    const printWindow = window.open('', '', 'width=800,height=1100');
    if (!printWindow) {
      alert('Gagal membuka jendela cetak.');
      return;
    }

    async function getImages() {
      const qrCanvas = document.createElement('canvas');
      await QRCode.toCanvas(qrCanvas, shipment.awb_number, { margin: 0, scale: 8, errorCorrectionLevel: 'H' });
      const qrData = qrCanvas.toDataURL('image/png');
      const barcodeCanvas = document.createElement('canvas');
      JsBarcode(barcodeCanvas, shipment.awb_number, { format: 'CODE128', width: 6, height: 110, displayValue: false, margin: 0 });
      const barcodeData = barcodeCanvas.toDataURL('image/png');
      return { qrData, barcodeData };
    }

    getImages().then(({ qrData, barcodeData }) => {
      let printContent = `
        <style>
          @page { size: letter portrait; margin: 0; }
          body { margin: 0; padding: 0; }
          .resi-sheet { width: 100vw; height: 100vh; min-height: 100vh; display: flex; flex-direction: column; box-sizing: border-box; }
          .resi-label { width: 100vw; height: 32.7vh; min-height: 32.7vh; max-height: 32.7vh; box-sizing: border-box; padding: 0 8px 0 8px; display: flex; flex-direction: column; justify-content: flex-start; }
          .cut-line { width: 100vw; border-bottom: 2px dashed #000; margin: 0; }
          .label-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #000; padding: 4px 0 4px 0; }
          .logo { height: 38px; margin-right: 12px; }
          .resi-number { font-size: 2em; font-weight: bold; letter-spacing: 2px; text-align: right; }
          .barcode-row { width: 100%; display: flex; justify-content: center; align-items: center; margin: 4px 0 4px 0; }
          .barcode-img { width: 97%; height: 80px; object-fit: contain; }
          .main-row { display: flex; flex-direction: row; align-items: flex-start; gap: 16px; margin-top: 4px; }
          .qr-block { flex: 0 0 140px; display: flex; align-items: flex-start; justify-content: center; }
          .qr-img { width: 130px; height: 130px; object-fit: contain; }
          .info-block { flex: 1; font-size: 1.15em; font-weight: bold; line-height: 1.4; word-break: break-word; }
          .address-block { margin-bottom: 8px; }
          .instruction { font-size: 0.95em; color: #222; border-top: 1px solid #000; margin-top: 4px; padding-top: 2px; }
        </style>
        <div class="resi-sheet">
      `;

      for (let i = 0; i < 3; i++) {
        printContent += `
          <div class="resi-label">
            <div class="label-header">
              <img src="/images/bce-logo.png" class="logo" />
              <div class="resi-number">${shipment.awb_number}</div>
            </div>
            <div class="barcode-row">
              <img src="${barcodeData}" class="barcode-img" />
            </div>
            <div class="main-row">
              <div class="info-block">
                <div class="address-block">To:<br>${shipment.receiver_name}<br>${shipment.receiver_address}<br>Telp: ${shipment.receiver_phone}</div>
                <div class="address-block">From:<br>${shipment.sender_name}<br>${shipment.sender_address}<br>Telp: ${shipment.sender_phone}</div>
                <div>Berat: ${shipment.weight} kg &nbsp; | &nbsp; Dimensi: ${shipment.dimensions}</div>
                <div>Layanan: ${shipment.service_type}</div>
              </div>
              <div class="qr-block">
                <img src="${qrData}" class="qr-img" />
              </div>
            </div>
            <div class="instruction">
              Mohon jangan dilipat. Scan barcode/QR untuk tracking. Pastikan data sesuai sebelum pengiriman.
            </div>
          </div>
          ${i < 2 ? '<div class="cut-line"></div>' : ''}
        `;
      }
      printContent += '</div>';
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    });
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Branch Dashboard</h1>
      
      <Tabs defaultValue="input" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="input">Input Pengiriman</TabsTrigger>
          <TabsTrigger value="manifest">Manifest Bulanan</TabsTrigger>
        </TabsList>

        <TabsContent value="input">
          <Card>
            <CardHeader>
              <CardTitle>Input Data Pengiriman</CardTitle>
              <CardDescription>Isi form di bawah ini untuk menambahkan data pengiriman baru</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label>AWB Number</Label>
                      <div className="flex gap-2 mt-2">
                        <Input 
                          placeholder="Masukkan AWB manual" 
                          value={resiInput} 
                          onChange={(e) => setResiInput(e.target.value)}
                          className="flex-1"
                        />
                        <Button onClick={generateResi} variant="outline">Generate</Button>
                        <Button onClick={handleManualResi} variant="outline">Manual</Button>
                      </div>
                      {resiNumber && (
                        <p className="mt-2 text-sm font-medium">Resi: {resiNumber}</p>
                      )}
                    </div>

                    <Separator />

                    <div>
                      <Label>Data Pengirim</Label>
                      <div className="space-y-4 mt-2">
                        <Input 
                          placeholder="Nama Pengirim" 
                          value={senderName} 
                          onChange={(e) => setSenderName(e.target.value)}
                        />
                        <Input 
                          placeholder="Alamat Pengirim" 
                          value={senderAddress} 
                          onChange={(e) => setSenderAddress(e.target.value)}
                        />
                        <Input 
                          placeholder="No. Telepon Pengirim" 
                          value={senderPhone} 
                          onChange={(e) => setSenderPhone(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label>Data Penerima</Label>
                      <div className="space-y-4 mt-2">
                        <Input 
                          placeholder="Nama Penerima" 
                          value={receiverName} 
                          onChange={(e) => setReceiverName(e.target.value)}
                        />
                        <Input 
                          placeholder="Alamat Penerima" 
                          value={receiverAddress} 
                          onChange={(e) => setReceiverAddress(e.target.value)}
                        />
                        <Input 
                          placeholder="No. Telepon Penerima" 
                          value={receiverPhone} 
                          onChange={(e) => setReceiverPhone(e.target.value)}
                        />
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <Label>Detail Pengiriman</Label>
                      <div className="space-y-4 mt-2">
                        <div className="p-4 border rounded bg-gray-50">
                          <Label>Coli (default 1)</Label>
                          <Input
                            type="number"
                            placeholder="Jumlah Coli"
                            value={coli}
                            onChange={(e) => setColi(e.target.value)}
                          />
                        </div>
                        <div className="p-4 border rounded bg-gray-50">
                          <Label>Jenis Kiriman</Label>
                          <div className="flex items-center gap-2">
                            <select
                              value={serviceType}
                              onChange={(e) => setServiceType(e.target.value)}
                              className="w-full p-2 border rounded"
                            >
                              <option value="">Pilih Jenis Kiriman</option>
                              <option value="standard">Standard</option>
                              <option value="onedays">Onedays</option>
                              <option value="darat">Darat</option>
                            </select>
                            {serviceType === 'standard' && <Plane className="w-6 h-6" />}
                            {serviceType === 'onedays' && <Plane className="w-6 h-6" />}
                            {serviceType === 'darat' && <Ship className="w-6 h-6" />}
                          </div>
                        </div>
                        <Input 
                          type="number" 
                          placeholder="Ongkos Kirim" 
                          value={ongkosKirim} 
                          onChange={(e) => setOngkosKirim(e.target.value)}
                        />
                        <Input 
                          type="number" 
                          placeholder="Berat (kg)" 
                          value={weight} 
                          onChange={(e) => setWeight(e.target.value)}
                        />
                        <Input 
                          placeholder="Dimensi (e.g., 10x10x10 cm)" 
                          value={dimensions} 
                          onChange={(e) => setDimensions(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-4">
                  <Button onClick={handlePrintLabel} variant="outline">
                    Cetak Label
                  </Button>
                  <Button onClick={handleSubmitResi}>
                    Simpan Data
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manifest">
          <Card>
            <CardHeader>
              <CardTitle>Laporan Manifest Bulanan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label>Pilih Bulan</Label>
                  <Input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="mt-2"
                  />
                  <Button onClick={() => fetchManifest(selectedMonth)} className="mt-2">Muat Laporan untuk Bulan Ini</Button>
                </div>
                <div>
                  <Button onClick={handleDownloadCSV} variant="outline" className="mb-4">Download CSV</Button>
                </div>
                <div className="border rounded-lg">
                  <div className="grid grid-cols-7 gap-4 p-4 bg-gray-50 font-medium">
                    <div>Tgl</div>
                    <div>No. Resi</div>
                    <div>Penerima</div>
                    <div>Alamat</div>
                    <div>Layanan</div>
                    <div>Ongkos Kirim</div>
                    <div>Coli</div>
                    <div>Aksi</div>
                  </div>
                  <div className="divide-y">
                    {manifestData.map((item) => (
                      <div key={item.awb_number || item.id} className="grid grid-cols-8 gap-4 p-4 hover:bg-gray-50">
                        <div>{new Date(item.created_at).toLocaleDateString()}</div>
                        <div>{item.awb_number}</div>
                        <div>{item.receiver_name}</div>
                        <div>{item.receiver_address}</div>
                        <div>{item.service_type}</div>
                        <div>{item.ongkos_kirim ? item.ongkos_kirim.toString() : 'N/A'}</div>
                        <div>{item.coli ? item.coli.toString() : '1'}</div>
                        <div><Button onClick={() => handlePrintManifestLabel(item)} variant="outline" size="sm">Cetak Label</Button></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 