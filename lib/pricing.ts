export type OriginCode = 'DKI_JAKARTA' | 'BANGKA' | 'TANJUNG_PANDAN'

export interface PriceOption {
  code: string
  label: string
  pricePerKg: number
}

export interface TransitOption {
  code: string
  label: string
  fee: number
}

export const ORIGINS: { code: OriginCode; label: string }[] = [
  { code: 'DKI_JAKARTA', label: 'JAKARTA' },
  { code: 'BANGKA', label: 'BANGKA' },
  { code: 'TANJUNG_PANDAN', label: 'TANJUNG PANDAN' },
]

// Jakarta -> Bangka/Kalbar/Bali/Tanjung Pandan (use city-level prices)
const pusatCities: Record<string, number> = {
  // Bangka
  'BANGKA / PANGKAL PINANG': 28000,
  'BANGKA / SUNGAILIAT': 30000,
  'BANGKA / BELINYU': 28000,
  'BANGKA / JEBUS': 28000,
  'BANGKA / KOBA': 31000,
  'BANGKA / TOBOALI': 32000,
  'BANGKA / MENTOK': 32000,
  // Kalimantan Barat
  'KALIMANTAN BARAT / PONTIANAK': 32000,
  'KALIMANTAN BARAT / SINGKAWANG': 35000,
  'KALIMANTAN BARAT / SUNGAI PINYUH': 35000,
  // Tanjung Pandan (Belitung)
  'BELITUNG / TANJUNG PANDAN': 28000,
  // Bali
  'BALI / DENPASAR': 30000,
}

const jakartaToOthers: PriceOption[] = Object.entries(pusatCities).map(([label, pricePerKg]) => ({
  code: label.toUpperCase().replace(/\s+/g, '_'),
  label,
  pricePerKg,
}))

// Bangka -> JABODETABEK groups (region-level prices)
const bangkaToJabodetabek: PriceOption[] = [
  { code: 'JAKARTA_BARAT', label: 'DKI JAKARTA / JAKARTA BARAT', pricePerKg: 27000 },
  { code: 'JAKARTA_PUSAT', label: 'DKI JAKARTA / JAKARTA PUSAT', pricePerKg: 27000 },
  { code: 'JAKARTA_SELATAN', label: 'DKI JAKARTA / JAKARTA SELATAN', pricePerKg: 29000 },
  { code: 'JAKARTA_TIMUR', label: 'DKI JAKARTA / JAKARTA TIMUR', pricePerKg: 29000 },
  { code: 'JAKARTA_UTARA', label: 'DKI JAKARTA / JAKARTA UTARA', pricePerKg: 27000 },
  { code: 'TANGERANG_KOTA', label: 'BANTEN / TANGERANG KOTA', pricePerKg: 27000 },
  { code: 'TANGERANG_SELATAN', label: 'BANTEN / TANGERANG SELATAN', pricePerKg: 30000 },
  { code: 'TANGERANG_KABUPATEN', label: 'BANTEN / TANGERANG KABUPATEN', pricePerKg: 35000 },
  { code: 'BEKASI_KOTA', label: 'JAWA BARAT / BEKASI KOTA', pricePerKg: 32000 },
  { code: 'BEKASI_KABUPATEN', label: 'JAWA BARAT / BEKASI KABUPATEN', pricePerKg: 32000 },
  { code: 'DEPOK', label: 'JAWA BARAT / DEPOK', pricePerKg: 35000 },
  { code: 'BOGOR_KOTA', label: 'JAWA BARAT / BOGOR KOTA', pricePerKg: 35000 },
  { code: 'BOGOR_KABUPATEN', label: 'JAWA BARAT / BOGOR KABUPATEN', pricePerKg: 35000 },
]

// Tanjung Pandan -> JABODETABEK (uses same pricing structure as Bangka for now)
// In a real implementation, you may want to adjust these prices for Tanjung Pandan specifically
const tanjungPandanToJabodetabek: PriceOption[] = bangkaToJabodetabek.map(option => ({
  ...option,
  pricePerKg: option.pricePerKg // Maintain same prices as Bangka for now
}))

export const DESTINATIONS_BY_ORIGIN: Record<OriginCode, PriceOption[]> = {
  DKI_JAKARTA: jakartaToOthers,
  BANGKA: bangkaToJabodetabek,
  TANJUNG_PANDAN: tanjungPandanToJabodetabek // Tanjung Pandan now uses its own pricing structure
}

export function calculatePrice(pricePerKg: number, weightKg: number) {
  const berat = Math.max(1, Math.ceil(Number(weightKg)))
  const subtotal = pricePerKg * berat
  const adminFee = 0
  const total = subtotal + adminFee
  return { berat, subtotal, adminFee, total }
}

// Grouped destinations for two-step selection (Wilayah -> Kota/Area)
export type DestinationGroup = { name: string; items: PriceOption[] }

const group = (name: string, predicate: (p: PriceOption) => boolean, items: PriceOption[]) => ({
  name,
  items: items.filter(predicate),
})

const jakartaGroups: DestinationGroup[] = [
  group('BANGKA', (p) => p.label.startsWith('BANGKA / '), jakartaToOthers),
  group('KALIMANTAN BARAT', (p) => p.label.startsWith('KALIMANTAN BARAT'), jakartaToOthers),
  group('BELITUNG', (p) => p.label.startsWith('BELITUNG'), jakartaToOthers),
  group('BALI', (p) => p.label.startsWith('BALI'), jakartaToOthers),
]

const bangkaGroups: DestinationGroup[] = [
  group('DKI JAKARTA', (p) => p.code.startsWith('JAKARTA_'), bangkaToJabodetabek),
  group('BANTEN', (p) => p.code.startsWith('TANGERANG_'), bangkaToJabodetabek),
  group('JAWA BARAT', (p) => ['BEKASI_KOTA','BEKASI_KABUPATEN','DEPOK','BOGOR_KOTA','BOGOR_KABUPATEN'].includes(p.code), bangkaToJabodetabek),
]

// Tanjung Pandan destination groups (same structure as Bangka)
const tanjungPandanGroups: DestinationGroup[] = [
  group('DKI JAKARTA', (p) => p.code.startsWith('JAKARTA_'), tanjungPandanToJabodetabek),
  group('BANTEN', (p) => p.code.startsWith('TANGERANG_'), tanjungPandanToJabodetabek),
  group('JAWA BARAT', (p) => ['BEKASI_KOTA','BEKASI_KABUPATEN','DEPOK','BOGOR_KOTA','BOGOR_KABUPATEN'].includes(p.code), tanjungPandanToJabodetabek),
]

export const DESTINATION_GROUPS_BY_ORIGIN: Record<OriginCode, DestinationGroup[]> = {
  DKI_JAKARTA: jakartaGroups,
  BANGKA: bangkaGroups,
  TANJUNG_PANDAN: tanjungPandanGroups // Tanjung Pandan now uses its own destination groups
}

// Transit options keyed by destination code (Bangka -> JABODETABEK cases)
export const TRANSIT_OPTIONS: Record<string, TransitOption[]> = {
  // Tangerang Kabupaten
  TANGERANG_KABUPATEN: [
    { code: 'TELUKNAGA', label: 'Teluknaga', fee: 20000 },
    { code: 'BALARAJA', label: 'Balaraja', fee: 50000 },
    { code: 'PAKUHAJI', label: 'Pakuhaji', fee: 50000 },
    { code: 'RAJEG', label: 'Rajeg', fee: 50000 },
    { code: 'SEPATAN_TIMUR', label: 'Sepatan Timur', fee: 30000 },
    { code: 'SEPATAN', label: 'Sepatan', fee: 30000 },
    { code: 'SINDANG_JAYA', label: 'Sindang Jaya', fee: 20000 },
    { code: 'SOLEAR', label: 'Solear', fee: 100000 },
    { code: 'TIGARAKSA', label: 'Tigaraksa', fee: 75000 },
    { code: 'MAUK', label: 'Mauk', fee: 75000 },
  ],
  // Bekasi (gabungan beberapa kecamatan; sebagian masuk kota/kabupaten)
  BEKASI_KOTA: [
    { code: 'JATISAMPURNA', label: 'Jatisampurna', fee: 30000 },
  ],
  BEKASI_KABUPATEN: [
    { code: 'TARUMAJAYA', label: 'Tarumajaya', fee: 30000 },
    { code: 'BABELAN', label: 'Babelan', fee: 30000 },
    { code: 'CIBARUSAH', label: 'Cibarusah', fee: 30000 },
    { code: 'CIBITUNG', label: 'Cibitung', fee: 50000 },
    { code: 'CIKARANG_BARAT', label: 'Cikarang Barat', fee: 75000 },
    { code: 'CIKARANG_PUSAT', label: 'Cikarang Pusat', fee: 75000 },
    { code: 'CIKARANG_UTARA', label: 'Cikarang Utara', fee: 75000 },
    { code: 'CIKARANG_SELATAN', label: 'Cikarang Selatan', fee: 100000 },
    { code: 'CIKARANG_TIMUR', label: 'Cikarang Timur', fee: 100000 },
    { code: 'KARANG_BAHAGIA', label: 'Karangbahagia', fee: 75000 },
    { code: 'KEDUNGWARINGIN', label: 'Kedungwaringin', fee: 100000 },
    { code: 'SERANG_BARU', label: 'Serang Baru', fee: 100000 },
    { code: 'SETU', label: 'Setu', fee: 100000 },
    { code: 'TAMBUN_SELATAN', label: 'Tambun Selatan', fee: 50000 },
    { code: 'TAMBUN_UTARA', label: 'Tambun Utara', fee: 50000 },
  ],
  // Depok
  DEPOK: [
    { code: 'TAPOS', label: 'Tapos', fee: 30000 },
  ],
  // Bogor Kota
  BOGOR_KOTA: [
    { code: 'BOGOR_BARAT', label: 'Bogor Barat', fee: 100000 },
    { code: 'BOGOR_SELATAN', label: 'Bogor Selatan', fee: 100000 },
    { code: 'BOGOR_TENGAH', label: 'Bogor Tengah', fee: 100000 },
    { code: 'BOGOR_TIMUR', label: 'Bogor Timur', fee: 100000 },
    { code: 'BOGOR_UTARA', label: 'Bogor Utara', fee: 100000 },
    { code: 'TANAH_SEREAL', label: 'Tanah Sereal', fee: 100000 },
  ],
  // Bogor Kabupaten
  BOGOR_KABUPATEN: [
    { code: 'GUNUNG_SINDUR', label: 'Gunung Sindur', fee: 100000 },
    { code: 'BABAKAN_MADANG', label: 'Babakan Madang', fee: 100000 },
    { code: 'BOJONGGEDE', label: 'Bojonggede', fee: 75000 },
    { code: 'CIBINONG', label: 'Cibinong', fee: 50000 },
    { code: 'CILEUNGSI', label: 'Cileungsi', fee: 75000 },
    { code: 'GUNUNG_PUTRI', label: 'Gunung Putri', fee: 75000 },
    { code: 'CITEUREUP', label: 'Citeureup', fee: 100000 },
    { code: 'JONGGOL', label: 'Jonggol', fee: 100000 },
    { code: 'CIOMAS', label: 'Ciomas', fee: 100000 },
    { code: 'CISEENG', label: 'Ciseeng', fee: 100000 },
    { code: 'TAJURHALANG', label: 'Tajurhalang', fee: 100000 },
    { code: 'CARINGIN', label: 'Caringin', fee: 100000 },
    { code: 'DRAMAGA', label: 'Dramaga', fee: 100000 },
    { code: 'CARIU', label: 'Cariu', fee: 100000 },
    { code: 'KLAPANUNGGAL', label: 'Klapanunggal', fee: 100000 },
    { code: 'RUMPIN', label: 'Rumpin', fee: 100000 },
    { code: 'CIAWI', label: 'Ciawi', fee: 150000 },
    { code: 'TAMANSARI', label: 'Tamansari', fee: 150000 },
  ],
}
