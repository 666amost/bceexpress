"use client"

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { FaCheckCircle, FaPrint, FaExclamationTriangle, FaRedo } from 'react-icons/fa';
import { useAgent } from '../context/AgentContext';

// Data wilayah dan harga
const kotaWilayahJabodetabek = {
  "JAKARTA BARAT": { kecamatan: ["Cengkareng", "Grogol petamburan", "Kalideres", "Kebon jeruk", "Kembangan", "Palmerah", "Tambora", "Taman sari"], harga: 28000 },
  "JAKARTA PUSAT": { kecamatan: ["Cempaka putih", "Gambir", "Johar baru", "Kemayoran", "Menteng", "Sawah besar", "Senen", "Tanah abang"], harga: 27000 },
  "JAKARTA TIMUR": { kecamatan: ["Cakung", "Ciracas", "Cipayung", "Duren sawit", "Jatinegara", "Kramat jati", "Makasar", "Matraman", "Pasar rebo", "Pulogadung"], harga: 29000 },
  "JAKARTA SELATAN": { kecamatan: ["Cilandak", "Jagakarsa", "Kebayoran baru", "Kebayoran lama", "Mampang prapatan", "Pancoran", "Pasar minggu", "Pesanggrahan", "Setiabudi", "Tebet"], harga: 30000 },
  "JAKARTA UTARA": { kecamatan: ["Cilincing", "Kelapa gading", "Koja", "Pademangan", "Penjaringan", "Tanjung priok"], harga: 31000 },
  "BOGOR": { kecamatan: ["Bogor Barat", "Bogor Tengah", "Bogor Timur", "Bogor Utara", "Bogor Selatan", "Tanah Sareal"], harga: 32000 },
  "DEPOK": { kecamatan: ["Beji", "Bojongsari", "Cilodong", "Cimanggis", "Cinere", "Cipayung", "Limo", "Pancoran Mas", "Sawangan", "Sukmajaya", "Tapos"], harga: 33000 },
  "TANGERANG": { kecamatan: ["Benda", "Jatiuwung", "Larangan", "Karawaci", "Tangerang"], harga: 34000 },
  "BEKASI": { kecamatan: ["Bekasi Barat", "Bekasi Selatan", "Bekasi Timur", "Bekasi Utara", "Bantargebang", "Jatiasih", "Jatisampurna", "Medan Satria", "Mustika Jaya", "Pondokgede", "Pondok Melati", "Rawalumbu"], harga: 35000 }
};

interface FormDataType {
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
  catatan: string;
}

export const AWBCreationForm: React.FC = () => {
  const { toast } = useToast();
  const { currentAgent, isLoading, addAWB } = useAgent(); // Add addAWB here
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [submittedAWB, setSubmittedAWB] = useState<string>('');

  const [formData, setFormData] = useState<FormDataType>({
    awb_no: '',
    awb_date: new Date().toISOString().split('T')[0],
    kirim_via: 'UDARA', // Default to UDARA
    kota_tujuan: '',
    kecamatan: '',
    metode_pembayaran: 'CASH',
    agent_customer: '',
    nama_pengirim: '',
    nomor_pengirim: '',
    nama_penerima: '',
    nomor_penerima: '',
    alamat_penerima: '',
    coli: 1,
    berat_kg: 1,
    harga_per_kg: 0,
    sub_total: 0,
    biaya_admin: 2000,
    biaya_packaging: 0,
    biaya_transit: 0,
    total: 0,
    isi_barang: '',
    catatan: ''
  });

  // Calculate kecamatan options
  const kecamatanOptions = useMemo(() => {
    if (!formData.kota_tujuan || !kotaWilayahJabodetabek[formData.kota_tujuan as keyof typeof kotaWilayahJabodetabek]) {
      return [];
    }
    return kotaWilayahJabodetabek[formData.kota_tujuan as keyof typeof kotaWilayahJabodetabek].kecamatan;
  }, [formData.kota_tujuan]);

  // Generate AWB number function
  const generateNewAWBNumber = useCallback(() => {
    if (currentAgent) {
      const timestamp = Date.now().toString().slice(-6); // 6 digits for XXXXXX
      const awbNumber = `BCE${timestamp}AGT`;
      setFormData(prev => ({ ...prev, awb_no: awbNumber, agent_customer: currentAgent.email }));
    }
  }, [currentAgent]);

  // Auto calculate pricing
  useEffect(() => {
    if (formData.kota_tujuan && formData.berat_kg > 0) {
      const cityData = kotaWilayahJabodetabek[formData.kota_tujuan as keyof typeof kotaWilayahJabodetabek];
      if (cityData) {
        const hargaPerKg = cityData.harga;
        const subTotal = formData.berat_kg * hargaPerKg;
        const total = subTotal + formData.biaya_admin + formData.biaya_packaging + formData.biaya_transit;
        
        setFormData(prev => ({
          ...prev,
          harga_per_kg: hargaPerKg,
          sub_total: subTotal,
          total: total
        }));
      }
    }
  }, [formData.kota_tujuan, formData.berat_kg, formData.biaya_admin, formData.biaya_packaging, formData.biaya_transit]);

  // Auto generate AWB on component mount
  useEffect(() => {
    generateNewAWBNumber();
  }, [generateNewAWBNumber]);

  // Show loading while agent data loads
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="flex items-center justify-center space-x-2">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-600">Loading agent data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show error if no agent
  if (!currentAgent) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-red-600">
            <FaExclamationTriangle className="h-8 w-8 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Agent Data Not Available</h3>
            <p className="text-sm mb-4">Please refresh the page or contact support if the issue persists.</p>
            <div className="text-xs bg-gray-100 p-2 rounded">
              Debug: currentAgent = {JSON.stringify(currentAgent)}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      
      // Reset kecamatan when kota_tujuan changes
      if (name === 'kota_tujuan') {
        newData.kecamatan = '';
      }
      
      return newData;
    });
  };

  const validateForm = (): boolean => {
    const requiredFields = [
      { field: 'kota_tujuan', label: 'Kota Tujuan' },
      { field: 'kecamatan', label: 'Kecamatan' },
      { field: 'nama_pengirim', label: 'Nama Pengirim' },
      { field: 'nomor_pengirim', label: 'Nomor Pengirim' },
      { field: 'nama_penerima', label: 'Nama Penerima' },
      { field: 'nomor_penerima', label: 'Nomor Penerima' },
      { field: 'alamat_penerima', label: 'Alamat Penerima' },
      { field: 'isi_barang', label: 'Isi Barang' }
    ];

    for (const { field, label } of requiredFields) {
      if (!formData[field as keyof FormDataType] || String(formData[field as keyof FormDataType]).trim() === '') {
        toast({
          title: "Validation Error",
          description: `${label} is required`,
          variant: "destructive"
        });
        return false;
      }
    }

    if (formData.berat_kg <= 0) {
      toast({
        title: "Validation Error",
        description: "Berat must be greater than 0",
        variant: "destructive"
      });
      return false;
    }

    if (formData.coli <= 0) {
      toast({
        title: "Validation Error",
        description: "Jumlah Coli must be greater than 0",
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentAgent?.email) {
      console.error('Agent email missing:', currentAgent);
      toast({
        title: "Error",
        description: "Agent information not available. Please refresh the page.",
        variant: "destructive"
      });
      return;
    }

    // Validate form before submission
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Use addAWB from AgentContext (already implements direct database insert)
      const result = await addAWB({
        awb_no: formData.awb_no,
        awb_date: formData.awb_date,
        kirim_via: formData.kirim_via || 'DARAT',
        kota_tujuan: formData.kota_tujuan,
        kecamatan: formData.kecamatan,
        metode_pembayaran: formData.metode_pembayaran,
        agent_customer: currentAgent.email,
        nama_pengirim: formData.nama_pengirim,
        nomor_pengirim: formData.nomor_pengirim,
        nama_penerima: formData.nama_penerima,
        nomor_penerima: formData.nomor_penerima,
        alamat_penerima: formData.alamat_penerima,
        coli: formData.coli || 1,
        berat_kg: formData.berat_kg || 1,
        harga_per_kg: formData.harga_per_kg || 0,
        sub_total: formData.sub_total || 0,
        biaya_admin: formData.biaya_admin || 2000,
        biaya_packaging: formData.biaya_packaging || 0,
        biaya_transit: formData.biaya_transit || 0,
        total: formData.total || 0,
        isi_barang: formData.isi_barang,
        catatan: formData.catatan
      });

      setSubmittedAWB(formData.awb_no);
      setShowSuccess(true);
      
      toast({
        title: "Booking Created Successfully",
        description: `Resi ${formData.awb_no} has been created`,
      });

      // Reset form untuk booking baru
      setTimeout(() => {
        setShowSuccess(false);
        setFormData({
          awb_no: '',
          awb_date: new Date().toISOString().split('T')[0],
          kirim_via: 'UDARA', // Default to UDARA
          kota_tujuan: '',
          kecamatan: '',
          metode_pembayaran: 'CASH',
          agent_customer: currentAgent.email,
          nama_pengirim: '',
          nomor_pengirim: '',
          nama_penerima: '',
          nomor_penerima: '',
          alamat_penerima: '',
          coli: 1,
          berat_kg: 1,
          harga_per_kg: 0,
          sub_total: 0,
          biaya_admin: 2000,
          biaya_packaging: 0,
          biaya_transit: 0,
          total: 0,
          isi_barang: '',
          catatan: ''
        });
        generateNewAWBNumber();
      }, 3000);

    } catch (error) {
      console.error('Error creating booking:', error);
      console.error('Form data:', JSON.stringify(formData, null, 2));
      console.error('Agent data:', JSON.stringify(currentAgent, null, 2));
      
      // Extract error message from Error object
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to create booking. Please try again.';
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintAWB = () => {
    if (submittedAWB) {
      window.open(`/agent/print-label/${submittedAWB}`, '_blank');
    }
  };

  if (showSuccess) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-green-600">
            <FaCheckCircle className="h-16 w-16 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Booking Created Successfully!</h3>
            <p className="text-gray-600 mb-6">Resi Number: {submittedAWB}</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={handlePrintAWB} className="bg-blue-600 hover:bg-blue-700">
                <FaPrint className="h-4 w-4 mr-2" />
                Print Resi
              </Button>
              <Button 
                onClick={() => setShowSuccess(false)} 
                variant="outline"
              >
                Create New Booking
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Create New Booking</span>
          <Button
            onClick={generateNewAWBNumber}
            variant="outline"
            size="sm"
            type="button"
          >
            <FaRedo className="h-4 w-4 mr-2" />
            New AWB
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* AWB Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="awb_no">AWB Number</Label>
              <Input
                id="awb_no"
                name="awb_no"
                value={formData.awb_no}
                onChange={handleInputChange}
                placeholder="BCE123456AGT"
                required
                readOnly
                className="bg-gray-50"
              />
            </div>
            <div>
              <Label htmlFor="awb_date">AWB Date</Label>
              <Input
                id="awb_date"
                name="awb_date"
                type="date"
                value={formData.awb_date}
                onChange={handleInputChange}
                required
              />
            </div>
            <div>
              <Label htmlFor="kirim_via">Kirim Via</Label>
              <Select value={formData.kirim_via} onValueChange={(value) => handleSelectChange('kirim_via', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DARAT">DARAT</SelectItem>
                  <SelectItem value="LAUT">LAUT</SelectItem>
                  <SelectItem value="UDARA">UDARA</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Destination */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="kota_tujuan">Kota Tujuan</Label>
              <Select value={formData.kota_tujuan} onValueChange={(value) => handleSelectChange('kota_tujuan', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kota tujuan" />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(kotaWilayahJabodetabek).map(kota => (
                    <SelectItem key={kota} value={kota}>{kota}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="kecamatan">Kecamatan</Label>
              <Select value={formData.kecamatan} onValueChange={(value) => handleSelectChange('kecamatan', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kecamatan" />
                </SelectTrigger>
                <SelectContent>
                  {kecamatanOptions.map(kecamatan => (
                    <SelectItem key={kecamatan} value={kecamatan}>{kecamatan}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sender Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nama_pengirim">Nama Pengirim</Label>
              <Input
                id="nama_pengirim"
                name="nama_pengirim"
                value={formData.nama_pengirim}
                onChange={handleInputChange}
                required
              />
            </div>
            <div>
              <Label htmlFor="nomor_pengirim">Nomor Pengirim</Label>
              <Input
                id="nomor_pengirim"
                name="nomor_pengirim"
                value={formData.nomor_pengirim}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>

          {/* Receiver Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nama_penerima">Nama Penerima</Label>
              <Input
                id="nama_penerima"
                name="nama_penerima"
                value={formData.nama_penerima}
                onChange={handleInputChange}
                required
              />
            </div>
            <div>
              <Label htmlFor="nomor_penerima">Nomor Penerima</Label>
              <Input
                id="nomor_penerima"
                name="nomor_penerima"
                value={formData.nomor_penerima}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="alamat_penerima">Alamat Penerima</Label>
            <Input
              id="alamat_penerima"
              name="alamat_penerima"
              value={formData.alamat_penerima}
              onChange={handleInputChange}
              required
            />
          </div>

          {/* Package Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="coli">Jumlah Coli</Label>
              <Input
                id="coli"
                name="coli"
                type="number"
                min="1"
                value={formData.coli}
                onChange={handleInputChange}
                required
              />
            </div>
            <div>
              <Label htmlFor="berat_kg">Berat (Kg)</Label>
              <Input
                id="berat_kg"
                name="berat_kg"
                type="number"
                min="0.1"
                step="0.1"
                value={formData.berat_kg}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="isi_barang">Isi Barang</Label>
            <Input
              id="isi_barang"
              name="isi_barang"
              value={formData.isi_barang}
              onChange={handleInputChange}
              required
            />
          </div>

          <div>
            <Label htmlFor="catatan">Catatan</Label>
            <Input
              id="catatan"
              name="catatan"
              value={formData.catatan}
              onChange={handleInputChange}
            />
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="harga_per_kg">Harga per Kg</Label>
              <Input
                id="harga_per_kg"
                name="harga_per_kg"
                type="number"
                value={formData.harga_per_kg}
                onChange={handleInputChange}
                readOnly
                className="bg-gray-50"
              />
            </div>
            <div>
              <Label htmlFor="sub_total">Sub Total</Label>
              <Input
                id="sub_total"
                name="sub_total"
                type="number"
                value={formData.sub_total}
                onChange={handleInputChange}
                readOnly
                className="bg-gray-50"
              />
            </div>
            <div>
              <Label htmlFor="biaya_admin">Biaya Admin</Label>
              <Input
                id="biaya_admin"
                name="biaya_admin"
                type="number"
                value={formData.biaya_admin}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <Label htmlFor="total">Total</Label>
              <Input
                id="total"
                name="total"
                type="number"
                value={formData.total}
                onChange={handleInputChange}
                readOnly
                className="bg-gray-50 font-bold"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <Label htmlFor="metode_pembayaran">Metode Pembayaran</Label>
            <Select value={formData.metode_pembayaran} onValueChange={(value) => handleSelectChange('metode_pembayaran', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">CASH</SelectItem>
                <SelectItem value="TRANSFER">TRANSFER</SelectItem>
                <SelectItem value="COD">COD</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Creating Booking...
              </>
            ) : (
              'Create Booking'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
