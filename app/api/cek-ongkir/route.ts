import { NextResponse } from 'next/server'
import { DESTINATIONS_BY_ORIGIN, calculatePrice, type OriginCode, TRANSIT_OPTIONS } from '@/lib/pricing'

type CekRequest = {
  origin: OriginCode
  destinationCode: string
  berat_kg: number
  transitCode?: string
}

export async function POST(req: Request) {
  try {
    const body: CekRequest = await req.json()
  const { origin, destinationCode, berat_kg, transitCode } = body
    if (!origin || !destinationCode || !berat_kg) {
      return NextResponse.json({ success: false, error: 'Missing required fields (origin, destinationCode, berat_kg)' }, { status: 400 })
    }

    const options = DESTINATIONS_BY_ORIGIN[origin]
    const found = options.find(o => o.code === destinationCode)
    if (!found) return NextResponse.json({ success: false, error: 'Destination not found for origin' }, { status: 404 })

  const calc = calculatePrice(found.pricePerKg, berat_kg)
  const transitList = TRANSIT_OPTIONS[destinationCode] || []
  const transitFee = transitCode ? (transitList.find(t => t.code === transitCode)?.fee || 0) : 0
  const total = calc.total + transitFee
  return NextResponse.json({ success: true, data: { harga_per_kg: found.pricePerKg, berat: calc.berat, subtotal: calc.subtotal, adminFee: calc.adminFee, transitFee, total } })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
