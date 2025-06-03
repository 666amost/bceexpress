# Excel Export Improvements - Branch Module

## Ringkasan Perubahan

Telah diimplementasikan styling Excel yang professional untuk semua export di module `/branch` agar sesuai dengan screenshot yang diberikan (format OTTY OFFICIAL).

## Fitur Baru

### 1. Utility Function (`lib/excel-utils.js`)

- **`createStyledExcelWorkbook`**: Function utama untuk membuat Excel dengan styling professional
- **`createOttyOfficialExport`**: Function khusus untuk format OTTY OFFICIAL yang sesuai screenshot

### 2. Styling Features

#### Header Professional
- **Title Row**: Background biru gelap (`#1F4E79`), font putih, bold, size 14
- **Date Row**: Background biru muda (`#D9E2F3`), font hitam, bold
- **Column Headers**: Background biru medium (`#4472C4`), font putih, bold

#### Data Styling
- **Alternating Rows**: Abu-abu muda (`#F2F2F2`) dan putih untuk readability
- **Currency Formatting**: Format "Rp #,##0" untuk kolom mata uang
- **Number Alignment**: Right-align untuk angka, left-align untuk teks
- **Borders**: Thin borders untuk semua cell
- **Auto Width**: Column width disesuaikan dengan content

#### Total Row
- **Background**: Kuning (`#FFE699`) untuk highlight
- **Font**: Bold untuk emphasis
- **Auto Calculate**: Otomatis menghitung total untuk kolom numerik

### 3. Updated Components

#### Daily Report (`components/DailyReport.jsx`)
```javascript
// Headers yang diupdate
const headers = [
  'AWB (No Resi)', 'Pengirim', 'Penerima', 'Coli', 'Kg',
  'Harga (Ongkir)', 'Admin', 'Packaging', 'Cash', 'Transfer', 'COD', 'Wilayah'
]

// Currency columns: [5, 6, 7, 8, 9, 10]
// Number columns: [3, 4]
```

#### Outstanding Report (`components/OutstandingReport.jsx`)
```javascript
// Headers yang diupdate
const headers = [
  'No AWB', 'Tanggal', 'Kota Tujuan', 'Pengirim', 'Penerima',
  'Total Ongkir', 'Total Dibayar', 'Sisa Piutang'
]

// Currency columns: [5, 6, 7]
```

#### Sales Report (`components/Salesreport.jsx`)
```javascript
// Headers yang diupdate
const headers = [
  'AWB (awb_no)', 'Tgl AWB', 'Tujuan', 'Via Pengiriman', 'Pengirim',
  'Penerima', 'Kg', 'Harga (Ongkir)', 'Admin', 'Packaging', 'Total'
]

// Currency columns: [7, 8, 9, 10]
// Number columns: [6]
```

#### Recap Manifest (`components/RecapManifest.jsx`)
```javascript
// Headers yang diupdate
const headers = [
  'Tgl', 'Total AWB', 'Total Coli', 'Kg',
  'Cash', 'Transfer', 'COD', 'Total Pembayaran'
]

// Currency columns: [4, 5, 6, 7]
// Number columns: [1, 2, 3]
```

#### Pelunasan Resi (`components/PelunasanResi.tsx`)
```javascript
// Format OTTY OFFICIAL sesuai screenshot
const headers = [
  'NO AWB', 'TANGGAL', 'KOTA TUJUAN', 'PENGIRIM', 'PENERIMA',
  'ONGKIR', 'KG', 'BIAYA LAIN LAIN', 'TOTAL ONGKIR'
]

// Currency columns: [5, 7, 8]
// Number columns: [6]
```

## Cara Penggunaan

### Basic Usage
```javascript
import { createStyledExcelWorkbook } from "../lib/excel-utils"

createStyledExcelWorkbook({
  title: 'Report Title',
  headers: ['Column1', 'Column2', 'Column3'],
  data: formattedData,
  sheetName: 'Sheet Name',
  fileName: 'output.xlsx',
  currency: 'Rp',
  currencyColumns: [1, 2], // Index kolom currency (0-based)
  numberColumns: [0], // Index kolom number (0-based)
  includeTotal: true
})
```

### OTTY OFFICIAL Format
```javascript
import { createOttyOfficialExport } from "../lib/excel-utils"

createOttyOfficialExport(data, 'date_range')
```

## Hasil

Sekarang semua export Excel dari module `/branch` memiliki:

1. ✅ **Professional Styling** - Sesuai dengan format screenshot
2. ✅ **Consistent Formatting** - Semua komponen menggunakan styling yang sama
3. ✅ **Currency Formatting** - Format "Rp" yang tepat
4. ✅ **Auto Totals** - Perhitungan otomatis untuk kolom numerik
5. ✅ **Responsive Columns** - Width kolom disesuaikan dengan content
6. ✅ **Color Coding** - Header, data, dan total dengan warna berbeda
7. ✅ **Border & Alignment** - Professional table borders dan alignment

## File yang Diubah

- `lib/excel-utils.js` *(NEW)*
- `lib/excel-test-data.js` *(NEW)*
- `components/DailyReport.jsx` *(UPDATED)*
- `components/OutstandingReport.jsx` *(UPDATED)*
- `components/Salesreport.jsx` *(UPDATED)*
- `components/RecapManifest.jsx` *(UPDATED)*
- `components/PelunasanResi.tsx` *(UPDATED)*

Sekarang export Excel dari `/branch` sudah memiliki styling yang professional dan presisi seperti yang diminta! 