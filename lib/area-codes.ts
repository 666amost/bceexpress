// Centralized area and airport code mappings
export const airportCodes: Record<string, string> = {
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

// Authoritative mapping derived from public/kecamatan_wilayah.types.ts
export const areaCodes: Record<string, string> = {
  'BABAKAN MADANG': 'KMY',
  'BABELAN': 'KMY',
  'BALARAJA': 'GLC',
  'BANTARGEBANG': 'KMY',
  'BATUCEPER': 'GLC',
  'BEJI': 'KMY',
  'BEKASI BARAT': 'KMY',
  'BEKASI KABUPATEN': 'GLC',
  'BEKASI SELATAN': 'KMY',
  'BEKASI TIMUR': 'KMY',
  'BEKASI UTARA': 'KMY',
  'BENDA': 'GLC',
  'BOGOR BARAT': 'KMY',
  'BOGOR KABUPATEN': 'GLC',
  'BOGOR KOTA': 'GLC',
  'BOGOR SELATAN': 'KMY',
  'BOGOR TENGAH': 'KMY',
  'BOGOR TIMUR': 'KMY',
  'BOGOR UTARA': 'KMY',
  'BOJONGGEDE': 'KMY',
  'BOJONGSARI': 'KMY',
  'CAKUNG': 'KMY',
  'CEMPAKA PUTIH': 'KMY',
  'CENGKARENG': 'GLC',
  'CIBARUSAH': 'KMY',
  'CIBINONG': 'KMY',
  'CIBITUNG': 'KMY',
  'CIBODAS': 'GLC',
  'CIKARANG BARAT': 'KMY',
  'CIKARANG PUSAT': 'KMY',
  'CIKARANG SELATAN': 'KMY',
  'CIKARANG TIMUR': 'KMY',
  'CIKARANG UTARA': 'KMY',
  'CIKUPA': 'GLC',
  'CILANDAK': 'GLC',
  'CILEDUG': 'GLC',
  'CILEUNGSI': 'KMY',
  'CILINCING': 'KMY',
  'CILODONG': 'KMY',
  'CIMANGGIS': 'KMY',
  'CINERE': 'KMY',
  'CIPAYUNG': 'KMY',
  'CIPONDOH': 'GLC',
  'CIPUTAT': 'GLC',
  'CIPUTAT TIMUR': 'GLC',
  'CIRACAS': 'KMY',
  'CISAUK': 'GLC',
  'CURUG': 'GLC',
  'DUREN SAWIT': 'KMY',
  'GAMBIR': 'KMY',
  'GREENLAKE CITY / BARAT': 'GLC',
  'GROGOL': 'GLC',
  'GUNUNG PUTRI': 'KMY',
  'GUNUNG SINDUR': 'GLC',
  'JAGAKARSA': 'GLC',
  'JAKARTA PUSAT': 'GLC',
  'JAKARTA SELATAN': 'GLC',
  'JAKARTA TIMUR': 'GLC',
  'JAKARTA UTARA': 'GLC',
  'JATIASIH': 'KMY',
  'JATINEGARA': 'KMY',
  'JATIUWUNG': 'GLC',
  'JOHAR BARU': 'KMY',
  'KALI DERES': 'GLC',
  'KARANGBAHAGIA': 'KMY',
  'KARANGTENGAH': 'GLC',
  'KARAWACI': 'GLC',
  'KEBAYORAN BARU': 'GLC',
  'KEBAYORAN LAMA': 'GLC',
  'KEBON JERUK': 'GLC',
  'KEDUNGWARINGIN': 'KMY',
  'KELAPA DUA': 'GLC',
  'KELAPA GADING': 'KMY',
  'KEMAYORAN': 'KMY',
  'KEMBANGAN': 'GLC',
  'KOJA': 'KMY',
  'KOSAMBI': 'GLC',
  'KRAMAT JATI': 'KMY',
  'KREKOT / PUSAT': 'KMY',
  'LARANGAN': 'GLC',
  'LEGOK': 'GLC',
  'LIMO': 'KMY',
  'MAKASAR': 'KMY',
  'MAMPANG PRAPATAN': 'GLC',
  'MATRAMAN': 'KMY',
  'MEDAN SATRIA': 'KMY',
  'MENTENG': 'KMY',
  'MUSTIKAJAYA': 'KMY',
  'NEGLASARI': 'GLC',
  'PADEMANGAN': 'KMY',
  'PAGEDANGAN': 'GLC',
  'PAKUHAJI': 'GLC',
  'PAL MERAH': 'GLC',
  'PAMULANG': 'GLC',
  'PANCORAN': 'KMY',
  'PANCORAN MAS': 'KMY',
  'PANONGAN': 'GLC',
  'PASAR KEMIS': 'GLC',
  'PASAR MINGGU': 'GLC',
  'PASAR REBO': 'KMY',
  'PENJARINGAN': 'GLC',
  'PERIUK': 'GLC',
  'PESANGGRAHAN': 'GLC',
  'PINANG': 'GLC',
  'PONDOK AREN': 'GLC',
  'PONDOKGEDE': 'KMY',
  'PONDOKMELATI': 'KMY',
  'PULO GADUNG': 'KMY',
  'RAJEG': 'GLC',
  'RAWALUMBU': 'KMY',
  'SAWAH BESAR': 'KMY',
  'SAWANGAN': 'KMY',
  'SENEN': 'KMY',
  'SEPATAN': 'GLC',
  'SEPATAN TIMUR': 'GLC',
  'SERANG BARU': 'KMY',
  'SERPONG': 'GLC',
  'SERPONG UTARA': 'GLC',
  'SETIABUDI': 'KMY',
  'SETU': 'KMY',
  'SINDANG JAYA': 'GLC',
  'SOLEAR': 'GLC',
  'SUKMAJAYA': 'KMY',
  'TAMAN SARI': 'KMY',
  'TAMBORA': 'KMY',
  'TAMBUN SELATAN': 'KMY',
  'TAMBUN UTARA': 'KMY',
  'TANAH ABANG': 'KMY',
  'TANAH ABANG (GELORA)': 'GLC',
  'TANAH SEREAL': 'KMY',
  'TANGERANG': 'GLC',
  'TANGERANG KABUPATEN': 'GLC',
  'TANGERANG SELATAN': 'GLC',
  'TANJUNG PRIOK': 'KMY',
  'TAPOS': 'KMY',
  'TARUMAJAYA': 'KMY',
  'TEBET': 'KMY',
  'TIGARAKSA': 'GLC',
};

// Provide both the raw mapping name used in several components and a grouped area list
export const areaCodeMapping = areaCodes;

// Build grouped lists dynamically from areaCodes to avoid duplication
export const areaCodeData: Record<string, string[]> = {
  'BCE GLC': Object.keys(areaCodes).filter(k => areaCodes[k] === 'GLC'),
  'BCE KMY': Object.keys(areaCodes).filter(k => areaCodes[k] === 'KMY')
};

// Normalize kecamatan string to a canonical form used in areaCodes keys.
// Strategy:
// - Trim, uppercase, collapse spaces.
// - If exact key exists in areaCodes, return it.
// - Otherwise, try to find a key where either key includes the normalized input or vice versa.
// - Fallback to the uppercase trimmed input.
export function normalizeKecamatan(input?: string | null): string {
  if (!input) return "";
  let s = String(input).trim().toUpperCase();
  // collapse multiple spaces
  s = s.replace(/\s+/g, ' ');

  if (areaCodes[s]) return s;

  const keys = Object.keys(areaCodes);
  // try exact-inside matches
  for (const k of keys) {
    if (k === s) return k;
  }
  for (const k of keys) {
    if (k.includes(s) || s.includes(k)) return k;
  }

  return s;
}

const areaCodesDefaultExport: {
  airportCodes: Record<string, string>;
  areaCodes: Record<string, string>;
  areaCodeMapping: Record<string, string>;
  areaCodeData: Record<string, string[]>;
} = {
  airportCodes,
  areaCodes,
  areaCodeMapping,
  areaCodeData
};

export default areaCodesDefaultExport;
