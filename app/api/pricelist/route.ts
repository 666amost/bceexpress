import fs from 'fs'
import path from 'path'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// Generic parser that supports both simple lists and tab-separated kec/kel/harga files.
function parseTypeFile(content: string) {
  const lines = content.split(/\r?\n/)
  // If file looks like plain lines of area names (no tabs), return list
  const hasTabs = lines.some(l => l.includes('\t'))
  if (!hasTabs) {
    const names = lines.map(l => l.trim()).filter(Boolean).filter(l => !l.startsWith('#'))
    return { type: 'list', data: names }
  }

  const result: Record<string, Record<string, number>> = {}
  let currentKecamatan = ''
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const parts = line.split('\t').map((s) => s.trim()).filter(Boolean)
    if (parts.length === 3 && /HARGA/i.test(parts[2]) === false) {
      const [kec, kel, hargaRaw] = parts
      currentKecamatan = kec || currentKecamatan
      const harga = Number(hargaRaw.replace(/[^0-9.-]/g, ''))
      if (!result[currentKecamatan]) result[currentKecamatan] = {}
      result[currentKecamatan][kel] = isNaN(harga) ? 0 : harga
    } else if (parts.length === 2) {
      const [kec, kel] = parts
      if (kec && kel && /HARGA/i.test(kec) === false) {
        currentKecamatan = kec
        if (!result[currentKecamatan]) result[currentKecamatan] = {}
        result[currentKecamatan][kel] = result[currentKecamatan][kel] ?? 0
      }
    }
  }
  return { type: 'table', data: result }
}

export async function GET(_req: NextRequest) {
  try {
    const publi = path.join(process.cwd(), 'public')
    const files = fs.readdirSync(publi).filter(f => f.endsWith('.type'))
  type Parsed = { type: 'list' | 'table'; data: string[] | Record<string, Record<string, number>> }
  const aggregated: Record<string, Parsed> = {}
    for (const file of files) {
      const full = path.join(publi, file)
      const content = fs.readFileSync(full, 'utf8')
        const parsed = parseTypeFile(content) as Parsed
      const regionName = path.basename(file, '.type')
      aggregated[regionName] = parsed
    }

    return NextResponse.json({ success: true, data: aggregated })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
