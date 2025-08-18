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

// Tambahkan mapping kode bandara dan kode area dengan explicit typing
interface CityData {
  kecamatan: string[];
  harga: number;
}

type KotaWilayah = Record<string, CityData>;

const kotaWilayahJabodetabek: KotaWilayah = {
  "JAKARTA BARAT": {
    kecamatan: [
      "Cengkareng", "Grogol", "Kebon jeruk", "Kali deres", "Pal merah", "Kembangan",
      "Taman sari", "Tambora"
    ],
    harga: 27000
  },
  "JAKARTA PUSAT": {
    kecamatan: [
      "Cempaka putih", "Gambir", "Johar baru", "Kemayoran", "Menteng", 
      "Sawah besar", "Senen", "Tanah abang", "Tanah abang (gelora)"
    ],
    harga: 27000
  },
  "JAKARTA SELATAN": {
    kecamatan: [
      "Cilandak", "Jagakarsa", "Kebayoran baru", "Kebayoran lama", "Mampang prapatan", 
      "Pasar minggu", "Pesanggrahan", "Pancoran", "Setiabudi", "Tebet"
    ],
    harga: 29000
  },
  "JAKARTA TIMUR": {
    kecamatan: [
      "Cakung", "Cipayung", "Ciracas", "Duren sawit", "Jatinegara", "Kramat jati",
      "Makasar", "Matraman", "Pasar rebo", "Pulo gadung"
    ],
    harga: 29000
  },
  "JAKARTA UTARA": {
    kecamatan: [
      "Penjaringan", "Cilincing", "Kelapa gading", "Koja", "Pademangan", "Tanjung priok"
    ],
    harga: 27000
  },
  "TANGERANG": {
    kecamatan: [
      "Batuceper", "Benda", "Cibodas", "Ciledug", "Cipondoh", "Jatiuwung", 
      "Karangtengah", "Karawaci", "Larangan", "Neglasari", "Periuk", "Pinang", "Tangerang"
    ],
    harga: 27000
  },
  "TANGERANG SELATAN": {
    kecamatan: [
      "Ciputat", "Ciputat Timur", "Pamulang", "Pondok Aren", "Serpong", "Serpong Utara"
    ],
    harga: 30000
  },
  "TANGERANG KABUPATEN": {
    kecamatan: [
      "Kelapa Dua", "Curug", "Kosambi", "Legok", "Pagedangan", "Pasar Kemis", 
      "Teluknaga", "Balaraja", "Cikupa", "Cisauk", "Pakuhaji", "Panongan", 
      "Rajeg", "Sepatan", "Sepatan Timur", "Sindang Jaya", "Solear", "Tigaraksa", "Mauk"
    ],
    harga: 35000
  },
  "BEKASI KOTA": {
    kecamatan: [
      "Bantargebang", "Bekasi Barat", "Bekasi Selatan", "Bekasi Timur", "Bekasi Utara",
      "Jatiasih", "Jatisampurna", "Medan Satria", "Mustikajaya", "pondokgede",
      "pondokmelati", "Rawalumbu"
    ],
    harga: 32000
  },
  "BEKASI KABUPATEN": {
    kecamatan: [
      "Tarumajaya", "Babelan", "Cibarusah", "Cibitung", "Cikarang Barat", "Cikarang Pusat",
      "Cikarang Selatan", "Cikarang Timur", "Cikarang Utara", "Karangbahagia",
      "Kedungwaringin", "Serang Baru", "Setu", "Tambun Selatan", "Tambun Utara"
    ],
    harga: 32000
  },
  "DEPOK": {
    kecamatan: [
      "Beji", "Bojongsari", "Cilodong", "Cimanggis", "Cinere", "Cipayung",
      "Limo", "Pancoran Mas", "Sawangan", "Sukmajaya", "Tapos"
    ],
    harga: 35000
  },
  "BOGOR KOTA": {
    kecamatan: [
      "Bogor Barat", "Bogor Selatan", "Bogor Tengah", "Bogor Timur", "Bogor Utara", "Tanah Sereal"
    ],
    harga: 35000
  },
  "BOGOR KABUPATEN": {
    kecamatan: [
      "Babakan Madang", "Bojonggede", "Cibinong", "Cileungsi", "Gunung Putri", 
      "Gunung Sindur", "Citeureup", "Jonggol", "Ciomas", "Ciseeng", "Tajurhalang",
      "Caringin", "Dramaga", "Cariu", "Klapanunggal", "Rumpin", "Ciawi", "Tamansari"
    ],
    harga: 35000
  }
};

// Fungsi untuk mendapatkan harga berdasarkan wilayah (sama seperti di BangkaAwbForm)
function getPriceByArea(wilayah: string): number {
  // Harga default
  let price = 27000;

  // Harga untuk wilayah Jakarta
  if (wilayah.includes('JAKARTA')) {
    if (wilayah.includes('BARAT') || wilayah.includes('PUSAT')) {
      price = 27000;
    } else if (wilayah.includes('SELATAN') || wilayah.includes('TIMUR')) {
      price = 29000;
    } else if (wilayah.includes('UTARA')) {
      if (wilayah.includes('KOJA') || wilayah.includes('CILINCING')) {
        price = 30000;
      } else {
        price = 27000;
      }
    }
  }
  // Harga untuk wilayah Tangerang
  else if (wilayah.includes('TANGERANG')) {
    if (wilayah.includes('SELATAN')) {
      // Special case for Serpong Utara - should be 27000 according to jakarta.type
      if (wilayah.includes('SERPONG UTARA')) {
        price = 27000;
      } else {
        price = 30000;
      }
    } else if (wilayah.includes('KABUPATEN')) {
      // Special cases for Tangerang Kabupaten with 27000 pricing
      if (wilayah.includes('KELAPA DUA')) {
        price = 27000;
      }
      // Special cases for Tangerang Kabupaten with 30000 pricing
      else if (wilayah.includes('CURUG') || 
          wilayah.includes('KOSAMBI') ||
          wilayah.includes('PAGEDANGAN')) {
        price = 30000;
      } else {
        price = 35000;
      }
    } else {
      // Kecamatan khusus di Tangerang dengan harga 30000
      if (wilayah.includes('NEGLASARI') || 
          wilayah.includes('BENDA') || 
          wilayah.includes('JATIUWUNG') || 
          wilayah.includes('CIBODAS') ||
          wilayah.includes('PERIUK')) {
        price = 30000;
      } else {
        price = 27000;
      }
    }
  }
  // Harga untuk wilayah Bekasi
  else if (wilayah.includes('BEKASI')) {
    price = 32000;
  }
  // Harga untuk wilayah Depok
  else if (wilayah.includes('DEPOK')) {
    price = 35000;
  }
  // Harga untuk wilayah Bogor
  else if (wilayah.includes('BOGOR')) {
    price = 35000;
  }

  return price;
}

// Tambahkan mapping kode bandara dan kode area dengan explicit typing
const airportCodes: Record<string, string> = {
  'JAKARTA BARAT': 'JKB',
  'JAKARTA PUSAT': 'JKP',
  'JAKARTA TIMUR': 'JKT',
  'JAKARTA SELATAN': 'JKS',
  'JAKARTA UTARA': 'JKU',
  'TANGERANG': 'TNG',
  'TANGERANG SELATAN': 'TGS',
  'TANGERANG KABUPATEN': 'TGK',
  'BEKASI KOTA': 'BKK',
  'BEKASI KABUPATEN': 'BKB',
  'DEPOK': 'DPK',
  'BOGOR KOTA': 'BGR',
  'BOGOR KABUPATEN': 'BGB'
};
const areaCodes: Record<string, string> = {
  // Heading mappings
  'GREEN LAKE CITY': 'GLC',
  'GRENLAKE CITY': 'GLC',
  'GRENLAKE CITY / BARAT': 'GLC',
  // Jakarta Barat - GLC group
  'CENGKARENG': 'GLC',
  'Cengkareng': 'GLC',
  'GROGOL PETAMBURAN': 'GLC',
  'Grogol': 'GLC',
  'KALIDERES': 'GLC',
  'Kali deres': 'GLC',
  'KEBON JERUK': 'GLC',
  'Kebon jeruk': 'GLC',
  'KEMBANGAN': 'GLC',
  'Kembangan': 'GLC',
  'PALMERAH': 'GLC',
  'Pal merah': 'GLC',
  // Jakarta Selatan - GLC group
  'CILANDAK': 'GLC',
  'Cilandak': 'GLC',
  'JAGAKARSA': 'GLC',
  'Jagakarsa': 'GLC',
  'KEBAYORAN BARU': 'GLC',
  'Kebayoran baru': 'GLC',
  'KEBAYORAN LAMA': 'GLC',
  'Kebayoran lama': 'GLC',
  'MAMPANG PRAPATAN': 'GLC',
  'Mampang prapatan': 'GLC',
  'PASAR MINGGU': 'GLC',
  'Pasar minggu': 'GLC',
  'PESANGGRAHAN': 'GLC',
  'Pesanggrahan': 'GLC',
  // Jakarta Utara - GLC group
  'PENJARINGAN': 'GLC',
  'Penjaringan': 'GLC',
  // Jakarta Pusat - GLC group
  'TANAH ABANG': 'GLC',
  'Tanah abang': 'GLC',
  // Bogor - GLC group
  'GUNUNG SINDUR': 'GLC',
  'Gunung Sindur': 'GLC',

  // Kreko mappings
  'KREKOT': 'KMY',
  'KREKOT / PUSAT': 'KMY',
  // Jakarta Barat - KMY group
  'TAMAN SARI': 'KMY',
  'Taman sari': 'KMY',
  'TAMBORA': 'KMY',
  'Tambora': 'KMY',
  // Jakarta Selatan - KMY group
  'PANCORAN': 'KMY',
  'Pancoran': 'KMY',
  'SETIABUDI': 'KMY',
  'Setiabudi': 'KMY',
  'TEBET': 'KMY',
  'Tebet': 'KMY',
  // Jakarta Utara - KMY group
  'CILINCING': 'KMY',
  'Cilincing': 'KMY',
  'KELAPA GADING': 'KMY',
  'Kelapa gading': 'KMY',
  'KOJA': 'KMY',
  'Koja': 'KMY',
  'PADEMANGAN': 'KMY',
  'Pademangan': 'KMY',
  'TANJUNG PRIOK': 'KMY',
  'Tanjung priok': 'KMY',
  // Jakarta Pusat - KMY group (special cases)
  'TANAH ABANG (gelora)': 'KMY',
  'Tanah abang (gelora)': 'KMY'
};

// Fungsi untuk mendapatkan biaya transit berdasarkan wilayah (sama seperti di BangkaAwbForm)
function getTransitFee(wilayah: string): number {
  // Tangerang Kabupaten
  if (wilayah.includes('TELUKNAGA')) return 20000;
  if (wilayah.includes('BALARAJA')) return 50000;
  if (wilayah.includes('PAKUHAJI')) return 50000;
  if (wilayah.includes('RAJEG')) return 50000;
  if (wilayah.includes('SEPATAN TIMUR')) return 30000;
  if (wilayah.includes('SEPATAN')) return 30000;
  if (wilayah.includes('SINDANG JAYA')) return 20000;
  if (wilayah.includes('SOLEAR')) return 100000;
  if (wilayah.includes('TIGARAKSA')) return 75000;
  if (wilayah.includes('MAUK')) return 75000;

  // Bekasi
  if (wilayah.includes('JATISAMPURNA')) return 30000;
  if (wilayah.includes('TARUMAJAYA')) return 30000;
  if (wilayah.includes('BABELAN')) return 30000;
  if (wilayah.includes('CIBARUSAH')) return 30000;
  if (wilayah.includes('CIBITUNG')) return 50000;
  if (wilayah.includes('CIKARANG BARAT')) return 75000;
  if (wilayah.includes('CIKARANG PUSAT')) return 75000;
  if (wilayah.includes('CIKARANG UTARA')) return 75000;
  if (wilayah.includes('CIKARANG SELATAN')) return 100000;
  if (wilayah.includes('CIKARANG TIMUR')) return 100000;
  if (wilayah.includes('KARANGBAHAGIA')) return 75000;
  if (wilayah.includes('KEDUNGWARINGIN')) return 100000;
  if (wilayah.includes('SERANG BARU')) return 100000;
  if (wilayah.includes('SETU') && wilayah.includes('BEKASI')) return 100000;
  if (wilayah.includes('TAMBUN SELATAN')) return 50000;
  if (wilayah.includes('TAMBUN UTARA')) return 50000;

  // Depok
  if (wilayah.includes('TAPOS')) return 30000;

  // Bogor
  if (wilayah.includes('BOGOR BARAT')) return 100000;
  if (wilayah.includes('BOGOR SELATAN')) return 100000;
  if (wilayah.includes('BOGOR TENGAH')) return 100000;
  if (wilayah.includes('BOGOR TIMUR')) return 100000;
  if (wilayah.includes('BOGOR UTARA')) return 100000;
  if (wilayah.includes('TANAH SEREAL')) return 100000;
  if (wilayah.includes('GUNUNG SINDUR')) return 100000;
  if (wilayah.includes('BABAKAN MADANG')) return 100000;
  if (wilayah.includes('BOJONGGEDE')) return 75000;
  if (wilayah.includes('CIBINONG')) return 50000;
  if (wilayah.includes('CILEUNGSI')) return 75000;
  if (wilayah.includes('GUNUNG PUTRI')) return 75000;

  // Kecamatan Bogor dengan transit 100.000
  const kecamatanBogor100k = [
    'CITEUREUP', 'JONGGOL', 'CIOMAS', 'CISEENG', 'TAJURHALANG',
    'CARINGIN', 'DRAMAGA', 'CARIU', 'KLAPANUNGGAL', 'RUMPIN'
  ];
  if (kecamatanBogor100k.some(kec => wilayah.includes(kec))) return 100000;

  // Kecamatan Bogor dengan transit 150.000
  if (wilayah.includes('CIAWI') || wilayah.includes('TAMANSARI')) return 150000;

  return 0; // Default jika tidak ada biaya transit
}

interface FormDataType {
  awb_no: string;
  awb_date: string;
  kirim_via: string;
  kota_tujuan: string;
  wilayah: string;
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

// Interface for tracking display values of numeric fields
interface NumericDisplayState {
  coli: string;
  berat_kg: string;
}

export const AWBCreationForm: React.FC = () => {
  const { toast } = useToast();
  const { currentAgent, isLoading, addAWB } = useAgent();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [submittedAWB, setSubmittedAWB] = useState<string>('');

  // State for tracking display values of numeric fields
  const [numericDisplay, setNumericDisplay] = useState<NumericDisplayState>({
    coli: '1',
    berat_kg: '1'
  });

  // Helper to get local date string in Asia/Jakarta timezone
  function getLocalDateString(): string {
    const now = new Date();
    // Convert to Asia/Jakarta (WIB, GMT+7)
    const jakartaDate = new Date(now.getTime() + (7 * 60 - now.getTimezoneOffset()) * 60000);
    return jakartaDate.toISOString().slice(0, 10);
  }

  const [formData, setFormData] = useState<FormDataType>({
    awb_no: '',
    awb_date: getLocalDateString(),
    kirim_via: 'udara', // Default to udara
    kota_tujuan: '',
    wilayah: '',
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
    biaya_admin: 0,
    biaya_packaging: 0,
    biaya_transit: 0,
    total: 0,
    isi_barang: '',
    catatan: ''
  });

  // Calculate kecamatan options
  const kecamatanOptions = useMemo(() => {
    if (!formData.kota_tujuan || !kotaWilayahJabodetabek[formData.kota_tujuan]) {
      return [];
    }
    return kotaWilayahJabodetabek[formData.kota_tujuan].kecamatan;
  }, [formData.kota_tujuan]);

  // Hitung kode bandara dan area
  const selectedCity = formData.kota_tujuan;
  const selectedDistrict = formData.kecamatan;
  const airportCode = airportCodes[selectedCity] || '';
  const areaCode = areaCodes[selectedDistrict] || '';

  // Generate AWB number function
  const generateNewAWBNumber = useCallback((): void => {
    if (currentAgent?.email) {
      const randomPart: string = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
      // Ambil 3 huruf pertama dari id login/email sebelum '@', jika ada
      const loginId: string = currentAgent.email.split('@')[0].slice(0, 3).toUpperCase();
      const awbNumber: string = `BCE${randomPart}${loginId}`;
      setFormData((prev: FormDataType): FormDataType => ({
        ...prev,
        awb_no: awbNumber,
        agent_customer: currentAgent.email
      }));
    }
  }, [currentAgent?.email]); // Only depend on email, not the entire currentAgent object

  // Auto calculate pricing
  const updatePricing = useCallback((): void => {
    if (formData.kota_tujuan && formData.berat_kg > 0) {
      // Use getPriceByArea for more accurate pricing (same as BangkaAwbForm)
      const wilayahForPricing = `${formData.kota_tujuan} ${formData.kecamatan}`.toUpperCase();
      let hargaPerKg = getPriceByArea(wilayahForPricing);
      
      // Apply discount for specific agents
      if (currentAgent?.email === 'blyagent01@bce.com' || currentAgent?.email === 'blyagent02@bce.com') {
        hargaPerKg = Math.max(0, hargaPerKg - 3000);
      }
      
      const subTotal = formData.berat_kg * hargaPerKg;
      const total = subTotal + formData.biaya_admin + formData.biaya_packaging + formData.biaya_transit;
      
      setFormData(prev => ({
        ...prev,
        harga_per_kg: hargaPerKg,
        sub_total: subTotal,
        total: total
      }));
    }
  }, [formData.kota_tujuan, formData.kecamatan, formData.berat_kg, formData.biaya_admin, formData.biaya_packaging, formData.biaya_transit, currentAgent?.email]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value, type } = e.target;
    
    // Handle numeric fields that should clear when focused
    if (name === 'coli' || name === 'berat_kg') {
      // Update display state
      setNumericDisplay(prev => ({
        ...prev,
        [name]: value
      }));
      
      // Update form data with proper numeric conversion
      setFormData(prev => {
        const numericValue = value.trim() === '' ? (name === 'coli' ? 1 : 1) : parseFloat(value);
        return {
          ...prev,
          [name]: isNaN(numericValue) ? (name === 'coli' ? 1 : 1) : Math.max(name === 'coli' ? 1 : 0.1, numericValue)
        };
      });
      return;
    }
    
    // Handle other fields normally
    setFormData(prev => {
      if (name in prev) {
        return {
          ...prev,
          [name as keyof FormDataType]: type === 'number' ? (parseFloat(value) || 0) : value
        };
      }
      return prev;
    });
  }, []);

  // Handle focus events for numeric fields to clear them
  const handleNumericFocus = useCallback((fieldName: 'coli' | 'berat_kg'): void => {
    setNumericDisplay(prev => ({
      ...prev,
      [fieldName]: ''
    }));
  }, []);

  // Handle blur events for numeric fields to restore default if empty
  const handleNumericBlur = useCallback((fieldName: 'coli' | 'berat_kg'): void => {
    if (numericDisplay[fieldName].trim() === '') {
      const defaultValue = fieldName === 'coli' ? '1' : '1';
      setNumericDisplay(prev => ({
        ...prev,
        [fieldName]: defaultValue
      }));
      setFormData(prev => ({
        ...prev,
        [fieldName]: fieldName === 'coli' ? 1 : 1
      }));
    }
  }, [numericDisplay]);

  const handleSelectChange = useCallback((name: string, value: string): void => {
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      
      // Reset kecamatan and calculate wilayah when kota_tujuan changes
      if (name === 'kota_tujuan') {
        newData.kecamatan = '';
        newData.wilayah = airportCodes[value] || '';
        newData.biaya_transit = 0; // Reset biaya transit when city changes
      }
      
      // Calculate wilayah and biaya_transit when kecamatan changes
      if (name === 'kecamatan' && newData.kota_tujuan) {
        const airportCode = airportCodes[newData.kota_tujuan] || '';
        const areaCode = areaCodes[value] || '';
        
        // Calculate biaya transit based on kecamatan
        const transitFee = getTransitFee(`${newData.kota_tujuan} ${value}`.toUpperCase());
        newData.biaya_transit = transitFee;
        
        // For Bangka branch: use kecamatan directly as wilayah
        if (currentAgent?.branchOrigin?.toLowerCase().includes('bangka')) {
          newData.wilayah = value; // Use kecamatan directly
        } else {
          // For other branches: use airport code + area code format
          if (areaCode) {
            newData.wilayah = `${airportCode}/${areaCode}`;
          } else {
            newData.wilayah = airportCode;
          }
        }
      }
      
      return newData;
    });
  }, [currentAgent?.branchOrigin]);

  const validateForm = useCallback((): boolean => {
    const requiredFields: Array<{ field: keyof FormDataType; label: string }> = [
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
      const fieldValue = formData[field];
      if (!fieldValue || String(fieldValue).trim() === '') {
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
  }, [formData, toast]);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
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

    if (isSubmitting) {
      return; // Prevent double submission
    }

    setIsSubmitting(true);

    try {
      // Use addAWB from AgentContext (already implements direct database insert)
      const result = await addAWB({
        awb_no: formData.awb_no,
        awb_date: formData.awb_date,
        kirim_via: formData.kirim_via || 'DARAT',
        kota_tujuan: formData.kota_tujuan,
        wilayah: formData.wilayah,
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
        biaya_admin: formData.biaya_admin || 0,
        biaya_packaging: formData.biaya_packaging || 0,
        biaya_transit: formData.biaya_transit || 0,
        total: formData.total || 0,
        isi_barang: formData.isi_barang,
        catatan: formData.catatan
      });

      if (result) {
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
            kirim_via: 'udara', // Default to udara
            kota_tujuan: '',
            wilayah: '',
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
            biaya_admin: 0,
            biaya_packaging: 0,
            biaya_transit: 0,
            total: 0,
            isi_barang: '',
            catatan: ''
          });
          generateNewAWBNumber();
        }, 10000); // Increased from 3000 to 10000 (10 seconds)
      }

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
  }, [currentAgent, formData, addAWB, isSubmitting, validateForm, toast, generateNewAWBNumber]);

  const handlePrintAWB = useCallback((): void => {
    if (submittedAWB) {
      window.open(`/agent/print-label/${submittedAWB}`, '_blank');
    }
  }, [submittedAWB]);

  useEffect(() => {
    updatePricing();
  }, [updatePricing]);

  // Sync numeric display with form data when form data changes programmatically
  useEffect(() => {
    setNumericDisplay(prev => ({
      ...prev,
      coli: formData.coli.toString(),
      berat_kg: formData.berat_kg.toString()
    }));
  }, [formData.coli, formData.berat_kg]);

  // Auto generate AWB on component mount
  useEffect(() => {
    if (currentAgent?.email && !formData.awb_no) {
      generateNewAWBNumber();
    }
  }, [currentAgent?.email, formData.awb_no, generateNewAWBNumber]);

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

  if (showSuccess) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-green-600">
            <FaCheckCircle className="h-16 w-16 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Booking Created Successfully!</h3>
            <p className="text-gray-600 mb-2">Resi Number: <span className="font-bold text-blue-600">{submittedAWB}</span></p>
            <p className="text-sm text-gray-500 mb-6">Form akan reset otomatis dalam 10 detik</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={handlePrintAWB} className="bg-blue-600 hover:bg-blue-700">
                <FaPrint className="h-4 w-4 mr-2" />
                Print Resi
              </Button>
              <Button 
                onClick={() => {
                  setShowSuccess(false);
                  setFormData({
                    awb_no: '',
                    awb_date: new Date().toISOString().split('T')[0],
                    kirim_via: 'udara',
                    kota_tujuan: '',
                    wilayah: '',
                    kecamatan: '',
                    metode_pembayaran: 'CASH',
                    agent_customer: currentAgent?.email || '',
                    nama_pengirim: '',
                    nomor_pengirim: '',
                    nama_penerima: '',
                    nomor_penerima: '',
                    alamat_penerima: '',
                    coli: 1,
                    berat_kg: 1,
                    harga_per_kg: 0,
                    sub_total: 0,
                    biaya_admin: 0,
                    biaya_packaging: 0,
                    biaya_transit: 0,
                    total: 0,
                    isi_barang: '',
                    catatan: ''
                  });
                  generateNewAWBNumber();
                }} 
                variant="outline"
              >
                <FaRedo className="h-4 w-4 mr-2" />
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
          <div className="text-right">
            <div className="text-lg font-bold airport-code">{airportCode}</div>
            <div className="text-sm font-semibold area-code">{areaCode}</div>
          </div>
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
                placeholder="BCE123456XYZ"
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
                  <SelectItem value="darat">DARAT</SelectItem>
                  <SelectItem value="udara">UDARA</SelectItem>
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
                value={numericDisplay.coli}
                onChange={handleInputChange}
                onFocus={() => handleNumericFocus('coli')}
                onBlur={() => handleNumericBlur('coli')}
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
                value={numericDisplay.berat_kg}
                onChange={handleInputChange}
                onFocus={() => handleNumericFocus('berat_kg')}
                onBlur={() => handleNumericBlur('berat_kg')}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
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
              <Label htmlFor="biaya_packaging">Biaya Packaging</Label>
              <Input
                id="biaya_packaging"
                name="biaya_packaging"
                type="number"
                value={formData.biaya_packaging}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <Label htmlFor="biaya_transit">Biaya Transit</Label>
              <Input
                id="biaya_transit"
                name="biaya_transit"
                type="number"
                value={formData.biaya_transit}
                onChange={handleInputChange}
                readOnly
                className="bg-gray-50"
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
