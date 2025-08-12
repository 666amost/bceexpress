"use client"

import React, { useState, useMemo, useRef } from "react"
import { supabaseClient } from "../lib/auth"
import { getEnhancedAgentList } from "../lib/agent-mapping"
import PrintLayout from "./PrintLayout"

// Mapping kode wilayah khusus untuk print (sesuai headings di jakarta.type)
const areaCodeMapping: Record<string, string> = {
  // Heading mappings
  'GREEN LAKE CITY': 'GLC',
  'GRENLAKE CITY': 'GLC',
  'GRENLAKE CITY / BARAT': 'GLC',
  // Jakarta Barat - GLC group
  'CENGKARENG': 'GLC',
  'GROGOL': 'GLC',
  'KEBON JERUK': 'GLC',
  'KALI DERES': 'GLC',
  'PAL MERAH': 'GLC',
  'KEMBANGAN': 'GLC',
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
  // Jakarta Pusat - GLC group
  'TANAH ABANG': 'GLC',
  // Bogor - GLC group
  'GUNUNG SINDUR': 'GLC',

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
  'TANJUNG PRIOK': 'KMY',
  // Jakarta Pusat - KMY group (special cases)
  'TANAH ABANG (gelora)': 'KMY'
};

interface BangkaBulkAwbFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  userRole: string | null;
  branchOrigin: string | null;
  initialData?: Record<string, unknown> | null;
  isEditing?: boolean;
}

interface AwbEntry {
  id: string;
  awb_no: string;
  nama_penerima: string;
  nomor_penerima: string;
  alamat_penerima: string;
  coli: number;
  isi_barang: string;
  berat_kg: number;
  harga_per_kg: number;
  sub_total: number;
  biaya_admin: number;
  biaya_packaging: number;
  biaya_transit: number;
  total: number;
  kota_tujuan: string;
  kecamatan: string;
}

interface Template {
  awb_date: string;
  kirim_via: string;
  kota_tujuan: string;
  kecamatan: string;
  metode_pembayaran: string;
  agent_customer: string;
  nama_pengirim: string;
  nomor_pengirim: string;
  biaya_admin: number;
  biaya_packaging: number;
  biaya_transit: number;
  berat_kg: number;
  harga_per_kg: number;
}

// Type for valid kota keys
type KotaKey = keyof typeof kotaWilayahJabodetabek;
// Data untuk wilayah Jabodetabek
const kotaWilayahJabodetabek = {
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
      "Rajeg", "Sepatan", "Sepatan Timur", "Sindang Jaya", "Solear", "Tigaraksa"
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
}

const baseAgentListJabodetabek = [
  "555 in2 PKP",
  "BELINYU AGEN",
  "KOLIM SLT",
  "SUNGAILIAT AGEN",
  "TOBOALI (ABING)",
  "KOBA (ABING)",
  "JEBUS (MARETTA)",
  "JEBUS (ROBI SAFARI)",
  "MENTOK (LILY)",
  "ACHUANG KOBA",
  "BCE TONI WEN",
  "7FUN SLT",
  "ASIONG SAUCU",
  "AFUK BOM2 SAUCU",
  "TONI SAUCU",
  "AFO SAUCU",
  "KEN KEN SAUCU",
  "ADI BOB SAUCU",
  "AFEN SAUCU",
  "AHEN SAUCU",
  "AKIUNG SAUCU",
  "ALIM SAUCU",
  "ALIONG SAUCU",
  "APHING SAUCU",
  "ATER SAUCU",
  "BULL BULL SAUCU",
  "CHANDRA SAUCU",
  "DANIEL SAUCU",
  "DEDI PEN SAUCU",
  "EDO SAUCU",
  "HENDRA ABOY SAUCU",
  "NYUNNYUN SAUCU",
  "RIO SAUCU",
  "YOPY SAUCU",
  "ACN SNACK",
  "ACS SNACK",
  "ADOK RUMAH MAKAN",
  "JI FUN MESU",
  "BE YOU",
  "BEST DURIAN",
  "BOM BOM BUAH",
  "TOKO AGUNG",
  "AINY OTAK OTAK",
  "APO SPX SLT",
  "AFUI SPX P3",
  "ASUN OTAK OTAK",
  "BANGKA CITRA SNACK",
  "BANGKA BULIONG SNACK",
  "BILLY JNE",
  "TOKO BINTANG 5",
  "CENTRAL FOOD",
  "CENTRAL NURSERY BANGKA",
  "CHIKA",
  "GLORIA MOTOR",
  "HELDA ASIAT",
  "HANS KOKO DURIAN",
  "KIM NYUN AGEN",
  "AFAT SUBUR",
  "MR ADOX",
  "PEMPEK KOKO LINGGAU",
  "PEMPEK SUMBER RASA",
  "PEMPEK WONG KITO",
  "RAJAWALI (AKHIONG)",
  "THEW FU CAU AWEN",
  "THEW FU CAU PAULUS",
  "COD UDARA",
  "COD LAUT"
]

// Enhanced agent list with email mappings
const agentListJabodetabek = getEnhancedAgentList(baseAgentListJabodetabek)

const metodePembayaran = ["cash", "transfer", "cod"]
const kirimVia = ["udara", "darat"]

// Daftar kecamatan khusus Jakarta Utara
const kecamatanJakutKhusus = [
  'Kebon Bawang', 'Papanggo', 'Sungai Bambu', 'Tj Priok', 'Warakas',
  'Sunter Jaya', 'Sunter Agung'
];

function generateAwbNo() {
  const timestamp = Date.now().toString()
  const lastSixDigits = timestamp.slice(-6)
  return "BCE" + lastSixDigits
}

function getPriceByArea(kotaTujuan: string, kecamatan: string): number {
  // Logika harga khusus Jakarta Utara
  if (kotaTujuan === 'JAKARTA UTARA') {
    if ([
      'Kebon Bawang', 'Papanggo', 'Sungai Bambu', 'Tj Priok', 'Warakas', 'Koja'
    ].includes(kecamatan)) {
      return 30000;
    } else if ([
      'Sunter Jaya', 'Sunter Agung'
    ].includes(kecamatan)) {
      return 27000;
    } else {
      return 27000;
    }
  }
  // Logika harga khusus Jakarta Pusat  
  else if (kotaTujuan === 'JAKARTA PUSAT') {
    // Semua kecamatan di Jakarta Pusat menggunakan harga 27000
    return 27000;
  }
  // Logika harga khusus Tangerang
  else if (kotaTujuan === 'TANGERANG') {
    if (['Neglasari', 'Benda', 'Jatiuwung', 'Cibodas', 'Periuk'].includes(kecamatan)) {
      return 30000;
    } else {
      return 27000;
    }
  }
  // Logika harga khusus Tangerang Selatan
  else if (kotaTujuan === 'TANGERANG SELATAN') {
    if (kecamatan === 'Serpong Utara') {
      return 27000;
    } else {
      return 30000;
    }
  }
  // Logika harga khusus Tangerang Kabupaten
  else if (kotaTujuan === 'TANGERANG KABUPATEN') {
    if (['Kelapa Dua', 'Curug', 'Kosambi', 'Pagedangan'].includes(kecamatan)) {
      return 30000;
    } else {
      return 35000;
    }
  }

  // Harga default sesuai wilayah
  const wilayah = kotaTujuan.toUpperCase();
  if (wilayah.includes('JAKARTA')) {
    if (wilayah.includes('BARAT') || wilayah.includes('PUSAT')) {
      return 27000;
    } else if (wilayah.includes('SELATAN') || wilayah.includes('TIMUR')) {
      return 29000;
    } else if (wilayah.includes('UTARA')) {
      return 27000;
    }
  } else if (wilayah.includes('TANGERANG')) {
    if (wilayah.includes('SELATAN')) {
      return 30000;
    } else if (wilayah.includes('KABUPATEN')) {
      return 35000;
    } else {
      return 27000;
    }
  } else if (wilayah.includes('BEKASI')) {
    return 32000;
  } else if (wilayah.includes('DEPOK')) {
    return 35000;
  } else if (wilayah.includes('BOGOR')) {
    return 35000;
  }
  return 27000;
}

function getTransitFee(kotaTujuan: string, kecamatan: string): number {
  const wilayah = `${kotaTujuan} ${kecamatan}`.toUpperCase();
  
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

export default function BangkaBulkAwbForm({ onSuccess, onCancel, userRole, branchOrigin, initialData = null, isEditing = false }: BangkaBulkAwbFormProps) {
  const [template, setTemplate] = useState<Template>({
    awb_date: new Date().toISOString().slice(0, 10),
    kirim_via: "",
    kota_tujuan: "",
    kecamatan: "",
    metode_pembayaran: "",
    agent_customer: "",
    nama_pengirim: "",
    nomor_pengirim: "",
    biaya_admin: 0,
    biaya_packaging: 0,
    biaya_transit: 0,
    berat_kg: 1,
    harga_per_kg: 0
  })

  const [awbEntries, setAwbEntries] = useState<AwbEntry[]>([])
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [showPrintPreview, setShowPrintPreview] = useState(false)
  const printFrameRef = useRef<HTMLDivElement>(null)

  const kecamatanOptions = useMemo(() => {
    if (template.kota_tujuan === 'JAKARTA UTARA') {
      return [
        ...kotaWilayahJabodetabek['JAKARTA UTARA'].kecamatan,
        ...kecamatanJakutKhusus.filter(k => !kotaWilayahJabodetabek['JAKARTA UTARA'].kecamatan.includes(k))
      ];
    }
    return template.kota_tujuan ? kotaWilayahJabodetabek[template.kota_tujuan as KotaKey]?.kecamatan || [] : [];
  }, [template.kota_tujuan]);

  React.useEffect(() => {
    if (template.kota_tujuan && kotaWilayahJabodetabek[template.kota_tujuan as KotaKey]) {
      setTemplate((f) => ({ ...f, harga_per_kg: kotaWilayahJabodetabek[template.kota_tujuan as KotaKey].harga }))
    }
  }, [template.kota_tujuan])

  React.useEffect(() => {
    setAwbEntries((prevEntries) =>
      prevEntries.map((entry) => {
        const sub_total = entry.berat_kg * template.harga_per_kg;
        const total = sub_total + Number(template.biaya_admin) + Number(template.biaya_packaging) + Number(template.biaya_transit);
        return {
          ...entry,
          harga_per_kg: template.harga_per_kg,
          kota_tujuan: template.kota_tujuan,
          kecamatan: template.kecamatan,
          sub_total,
          total,
        };
      })
    );
  }, [template.harga_per_kg, template.biaya_admin, template.biaya_packaging, template.biaya_transit, template.kecamatan, template.kota_tujuan]);

  React.useEffect(() => {
    const sub_total = template.berat_kg * template.harga_per_kg
    const total = sub_total + Number(template.biaya_admin) + Number(template.biaya_packaging) + Number(template.biaya_transit)
    setTemplate((f) => ({ ...f, sub_total, total }))
  }, [template.berat_kg, template.harga_per_kg, template.biaya_admin, template.biaya_packaging, template.biaya_transit])

  const handleTemplateChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let kotaTujuan = name === 'kota_tujuan' ? value : template.kota_tujuan;
    let kecamatan = name === 'kecamatan' ? value : template.kecamatan;

    if (name === 'kota_tujuan' || name === 'kecamatan') {
      const harga = getPriceByArea(kotaTujuan, kecamatan);
      const transit = getTransitFee(kotaTujuan, kecamatan);
      setTemplate(prev => ({
        ...prev,
        [name]: value,
        harga_per_kg: harga,
        biaya_transit: transit,
        sub_total: harga * (prev.berat_kg || 0),
        total: (harga * (prev.berat_kg || 0)) + (prev.biaya_admin || 0) + (prev.biaya_packaging || 0) + transit
      }));
    } else {
      setTemplate(prev => ({
        ...prev,
        [name]: value
      }));
    }
    setError("");
    setSuccess("");
  };

  const handleAwbEntryChange = (id: string, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setAwbEntries((prev) =>
      prev.map((entry) => {
        if (entry.id === id) {
          const updatedEntry = { ...entry, [name]: value }
          if (name === "berat_kg" || name === "harga_per_kg") {
            const berat = name === "berat_kg" ? Number(value) : entry.berat_kg
            const harga = name === "harga_per_kg" ? Number(value) : entry.harga_per_kg
            const sub_total = berat * harga
            const total = sub_total + Number(template.biaya_admin) + Number(template.biaya_packaging) + Number(template.biaya_transit)
            return { ...updatedEntry, sub_total, total }
          }
          return updatedEntry
        }
        return entry
      })
    )
  }

  const addAwbEntry = () => {
    const newEntry: AwbEntry = {
      id: Date.now().toString(),
      awb_no: generateAwbNo(),
      nama_penerima: "",
      nomor_penerima: "",
      alamat_penerima: "",
      coli: 1,
      isi_barang: "",
      berat_kg: 1,
      harga_per_kg: template.kota_tujuan ? kotaWilayahJabodetabek[template.kota_tujuan as KotaKey].harga : 0,
      sub_total: 0,
      biaya_admin: template.biaya_admin,
      biaya_packaging: template.biaya_packaging,
      biaya_transit: template.biaya_transit,
      total: 0,
      kota_tujuan: template.kota_tujuan,
      kecamatan: template.kecamatan,
    }
    setAwbEntries((prev) => [...prev, newEntry])
  }

  const removeAwbEntry = (id: string) => {
    setAwbEntries((prev) => prev.filter((entry) => entry.id !== id))
  }

  const saveAwbEntries = async () => {
    setError("")
    setSuccess("")

    if (!template.kota_tujuan || !template.kecamatan || !template.nama_pengirim) {
      setError("Mohon lengkapi data template terlebih dahulu.")
      return
    }

    if (awbEntries.length === 0) {
      setError("Mohon tambahkan minimal satu entri AWB.")
      return
    }

    const entriesToSave = awbEntries.map((entry) => ({
      ...entry,
      awb_date: template.awb_date,
      kirim_via: template.kirim_via,
      metode_pembayaran: template.metode_pembayaran,
      agent_customer: template.agent_customer,
      nama_pengirim: template.nama_pengirim,
      nomor_pengirim: template.nomor_pengirim,
      biaya_admin: template.biaya_admin,
      biaya_packaging: template.biaya_packaging,
      biaya_transit: template.biaya_transit,
      origin_branch: branchOrigin,
    }))

    try {
      const { error: sbError } = await supabaseClient
        .from("manifest_cabang")
        .insert(entriesToSave)

      if (sbError) {
        setError("Gagal menyimpan data: " + sbError.message)
        return
      }

      setSuccess("Data berhasil disimpan!")
      setAwbEntries([])
      setTemplate({
        awb_date: new Date().toISOString().slice(0, 10),
        kirim_via: "",
        kota_tujuan: "",
        kecamatan: "",
        metode_pembayaran: "",
        agent_customer: "",
        nama_pengirim: "",
        nomor_pengirim: "",
        biaya_admin: 0,
        biaya_packaging: 0,
        biaya_transit: 0,
        berat_kg: 1,
        harga_per_kg: 0
      })
      if (onSuccess) onSuccess()
    } catch (err) {
      setError("Terjadi kesalahan: " + (err instanceof Error ? err.message : String(err)))
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    await saveAwbEntries()
  }

  const handlePrintAll = async () => {
    if (awbEntries.length === 0) {
      setError("Tidak ada data untuk dicetak.")
      return
    }

    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      setError("Popup diblokir. Mohon izinkan popup di browser Anda.")
      return
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Cetak AWB</title>
          <style>
            @page {
              size: 100mm 100mm;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
            }
            .print-only {
              width: 100mm;
              height: 100mm;
              page-break-after: always;
            }
          </style>
        </head>
        <body>
    `)

    for (const entry of awbEntries) {
      const data = {
        ...entry,
        awb_date: template.awb_date,
        kirim_via: template.kirim_via,
        metode_pembayaran: template.metode_pembayaran,
        agent_customer: template.agent_customer,
        nama_pengirim: template.nama_pengirim,
        nomor_pengirim: template.nomor_pengirim,
        biaya_admin: template.biaya_admin,
        biaya_packaging: template.biaya_packaging,
        biaya_transit: template.biaya_transit,
      }

      // Create a temporary div to render PrintLayout
      const tempDiv = document.createElement("div")
      tempDiv.style.position = "absolute"
      tempDiv.style.left = "-9999px"
      tempDiv.className = "print-only"
      document.body.appendChild(tempDiv)

      // Use React to render PrintLayout into tempDiv
      const { createRoot } = await import('react-dom/client')
      const root = createRoot(tempDiv)
      
      // Render the PrintLayout component
      await new Promise<void>((resolve) => {
        root.render(React.createElement(PrintLayout, { data }))
        // Wait a bit for rendering to complete
        setTimeout(() => {
          printWindow.document.write(tempDiv.innerHTML)
          root.unmount()
          document.body.removeChild(tempDiv)
          resolve()
        }, 100)
      })
    }

    printWindow.document.write("</body></html>")
    printWindow.document.close()
    printWindow.print()
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-none mx-0 px-0 py-6 bg-transparent">
      {error && <div className="mb-2 p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg font-semibold shadow border border-red-200 dark:border-red-800">{error}</div>}
      {success && (
        <div className="mb-2 p-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg font-semibold shadow border border-green-200 dark:border-green-800">{success}</div>
      )}

      {/* Template Section */}
      <section className="bg-white/70 dark:bg-gray-800/80 rounded-lg p-3 border border-blue-100 dark:border-gray-600 shadow flex flex-col md:flex-row gap-6 items-end mb-2">
        <div className="flex flex-col w-full md:w-40">
          <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Tanggal AWB</label>
          <input
            type="date"
            name="awb_date"
            value={template.awb_date}
            onChange={handleTemplateChange}
            required
            className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
          />
        </div>
        <div className="flex flex-col w-full md:w-32">
          <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Kirim Via</label>
          <select
            name="kirim_via"
            value={template.kirim_via}
            onChange={handleTemplateChange}
            required
            className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
          >
            <option value="">Pilih</option>
            {kirimVia.map((opt) => (
              <option key={opt} value={opt}>
                {opt.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col w-full md:w-40">
          <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Kota Tujuan</label>
          <select
            name="kota_tujuan"
            value={template.kota_tujuan}
            onChange={handleTemplateChange}
            required
            className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
          >
            <option value="">Pilih</option>
            {Object.keys(kotaWilayahJabodetabek).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col w-full md:w-36">
          <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Kecamatan</label>
          <select
            name="kecamatan"
            value={template.kecamatan}
            onChange={handleTemplateChange}
            required
            disabled={!template.kota_tujuan}
            className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900 disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:text-gray-500 dark:disabled:text-gray-400"
          >
            <option value="">Pilih</option>
            {kecamatanOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col w-40">
          <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Agent</label>
          <select
            name="agent_customer"
            value={template.agent_customer}
            onChange={handleTemplateChange}
            required
            className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
          >
            <option value="">Pilih</option>
            {agentListJabodetabek.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="bg-white/70 dark:bg-gray-800/80 rounded-lg p-3 border border-blue-100 dark:border-gray-600 shadow flex flex-wrap gap-4 items-end mb-2">
        <div className="flex flex-col w-40 min-w-[140px]">
          <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Nama Pengirim</label>
          <input
            type="text"
            name="nama_pengirim"
            value={template.nama_pengirim}
            onChange={handleTemplateChange}
            required
            className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
          />
        </div>
        <div className="flex flex-col w-40 min-w-[140px]">
          <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Nomor Pengirim</label>
          <input
            type="tel"
            name="nomor_pengirim"
            value={template.nomor_pengirim}
            onChange={handleTemplateChange}
            required
            className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
          />
        </div>
        <div className="flex flex-col w-full md:w-28">
          <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Biaya Admin</label>
          <input
            type="number"
            name="biaya_admin"
            value={template.biaya_admin}
            onChange={handleTemplateChange}
            className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
          />
        </div>
        <div className="flex flex-col w-full md:w-28">
          <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Biaya Packaging</label>
          <input
            type="number"
            name="biaya_packaging"
            value={template.biaya_packaging}
            onChange={handleTemplateChange}
            className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
          />
        </div>
        <div className="flex flex-col w-full md:w-28">
          <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Biaya Transit</label>
          <input
            type="number"
            name="biaya_transit"
            value={template.biaya_transit}
            onChange={handleTemplateChange}
            className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
          />
        </div>
        <div className="flex flex-col w-full md:w-32">
          <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Metode</label>
          <select
            name="metode_pembayaran"
            value={template.metode_pembayaran}
            onChange={handleTemplateChange}
            required
            className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
          >
            <option value="">Pilih</option>
            {metodePembayaran.map((opt) => (
              <option key={opt} value={opt}>
                {opt.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* AWB Entries Section */}
      <section className="bg-white/70 dark:bg-gray-800/80 rounded-lg p-3 border border-blue-100 dark:border-gray-600 shadow mb-2">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200">Daftar AWB</h3>
          <button
            type="button"
            onClick={addAwbEntry}
            className="px-4 py-2 bg-green-600 dark:bg-green-700 text-white font-bold rounded shadow hover:bg-green-700 dark:hover:bg-green-800 transition-colors"
          >
            Tambah AWB
          </button>
        </div>

        {awbEntries.map((entry) => (
          <div key={entry.id} className="bg-white dark:bg-gray-700 rounded-lg p-4 mb-4 border border-gray-200 dark:border-gray-600">
            <div className="flex justify-between items-start mb-4">
              <div className="flex flex-col w-40">
                <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Nomor AWB</label>
                <input
                  type="text"
                  name="awb_no"
                  value={entry.awb_no}
                  readOnly
                  className="bg-gray-100 dark:bg-gray-600 rounded border border-blue-200 dark:border-gray-600 px-2 py-1 text-sm text-gray-700 dark:text-gray-300"
                />
              </div>
              <button
                type="button"
                onClick={() => removeAwbEntry(entry.id)}
                className="px-3 py-1 bg-red-600 dark:bg-red-700 text-white font-bold rounded shadow hover:bg-red-700 dark:hover:bg-red-800 transition-colors"
              >
                Hapus
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex flex-col">
                <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Nama Penerima</label>
                <input
                  type="text"
                  name="nama_penerima"
                  value={entry.nama_penerima}
                  onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => handleAwbEntryChange(entry.id, e)}
                  required
                  className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Nomor Penerima</label>
                <input
                  type="tel"
                  name="nomor_penerima"
                  value={entry.nomor_penerima}
                  onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => handleAwbEntryChange(entry.id, e)}
                  required
                  className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Alamat Penerima</label>
                  <textarea
  name="alamat_penerima"
  value={entry.alamat_penerima}
  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleAwbEntryChange(entry.id, e)}
  required
  className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900 min-h-[80px]"
/>
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Coli</label>
                <input
                  type="number"
                  name="coli"
                  value={entry.coli}
                  onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => handleAwbEntryChange(entry.id, e)}
                  min={1}
                  required
                  className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Isi Barang</label>
                <textarea
                  name="isi_barang"
                  value={entry.isi_barang}
                  onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => handleAwbEntryChange(entry.id, e)}
                  className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900 min-h-[80px]"
                  placeholder="Contoh: Pakaian, Elektronik, Makanan"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Berat (kg)</label>
                <input
                  type="number"
                  name="berat_kg"
                  value={entry.berat_kg}
                  onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => handleAwbEntryChange(entry.id, e)}
                  min={1}
                  step={0.1}
                  required
                  className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Harga/kg</label>
                <input
                  type="number"
                  name="harga_per_kg"
                  value={entry.harga_per_kg}
                  onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => handleAwbEntryChange(entry.id, e)}
                  className="rounded border border-blue-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 w-full px-2 py-1 text-sm shadow-sm transition bg-white text-gray-900"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Subtotal</label>
                <input
                  type="number"
                  name="sub_total"
                  value={entry.sub_total}
                  readOnly
                  className="bg-gray-100 dark:bg-gray-600 rounded border border-blue-200 dark:border-gray-600 px-2 py-1 text-sm text-gray-700 dark:text-gray-300"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Total</label>
                <input
                  type="number"
                  name="total"
                  value={entry.total}
                  readOnly
                  className="bg-gray-100 dark:bg-gray-600 rounded border border-blue-200 dark:border-gray-600 px-2 py-1 text-sm font-bold text-gray-700 dark:text-gray-300"
                />
              </div>
            </div>
          </div>
        ))}
      </section>

      <div className="flex flex-col md:flex-row justify-between mt-2 gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded mb-2 md:mb-0 hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
            Batal
          </button>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 dark:bg-blue-700 text-white font-bold rounded shadow-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition text-base"
          >
            SIMPAN
          </button>
          <button
            type="button"
            onClick={handlePrintAll}
            className="px-6 py-2 bg-green-600 dark:bg-green-700 text-white font-bold rounded shadow-lg hover:bg-green-700 dark:hover:bg-green-800 transition text-base"
          >
            CETAK SEMUA
          </button>
        </div>
      </div>
    </form>
  )
} 