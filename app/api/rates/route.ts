import { NextResponse } from 'next/server'
import { ORIGINS, DESTINATIONS_BY_ORIGIN, DESTINATION_GROUPS_BY_ORIGIN, TRANSIT_OPTIONS } from '@/lib/pricing'

export async function GET() {
  return NextResponse.json({ success: true, data: { origins: ORIGINS, destinations: DESTINATIONS_BY_ORIGIN, groups: DESTINATION_GROUPS_BY_ORIGIN, transits: TRANSIT_OPTIONS } })
}
