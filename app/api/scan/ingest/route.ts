// app/api/scan/ingest/route.ts
//
// API route for ingesting a scanned airway bill (AWB) into the BCE Express
// system.  This endpoint mirrors much of the client‑side logic used by the
// React continuous scanner and QR scanner components, but runs entirely on
// the server using a Supabase service role key.  It accepts an AWB number
// via the `awb` query parameter or request JSON body and will:
//   1. Validate the AWB prefix (must start with BE or BCE).
//   2. Retrieve manifest data from either a remote Borneo API (for BE
//      numbers) or the `manifest_cabang`/`manifest` tables.
//   3. Create or update a shipment record with the provided or auto
//      generated data.
//   4. Append a record to `shipment_history` indicating the item is now
//      `out_for_delivery`.
//
// Responses are JSON objects containing a `success` boolean and a
// human‑readable `message`.  The caller should treat non‑2xx responses as
// failures.  This file targets Next.js 15's App Router.

import { NextRequest, NextResponse } from 'next/server'
import { createClient, PostgrestError } from '@supabase/supabase-js'

// Utility: create a Supabase client using service role credentials.  The
// service role key must never be exposed to the browser.  Define
// SUPABASE_SERVICE_ROLE_KEY in your `.env.local` or Vercel project settings.
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
    },
  },
)

/**
 * Attempt to fetch manifest data for the given AWB.  For codes starting
 * with "BE" this calls the Borneo branch API at `/api/manifest/search` on
 * your own domain.  For codes starting with "BCE" it looks in the
 * `manifest_cabang` table first, then the `manifest` table.  Returns
 * recipient name/address/phone and a `manifest_source` string or `null` if
 * nothing is found.  If any network or database error occurs, `null` is
 * returned.
 */
// Types for Supabase rows we care about
type ManifestRow = {
  nama_penerima?: string | null
  alamat_penerima?: string | null
  nomor_penerima?: string | null
}

type ManifestResult = ManifestRow & { manifest_source?: 'cabang' | 'central' | 'borneo_branch' }

async function getManifestData(awb: string): Promise<ManifestResult | null> {
  const cleanAwb = awb.trim().toUpperCase()
  try {
    if (cleanAwb.startsWith('BE')) {
      const branchRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/api/manifest/search?awb_number=${cleanAwb}`)
      if (branchRes.ok) {
        const branchData = await branchRes.json()
        if (branchData?.success && branchData.data) {
          const m = branchData.data
          // safe extraction without using `any`
          const penerima = (m && typeof m === 'object' && 'penerima' in m) ? (m as Record<string, unknown>).penerima : undefined
          const nama = penerima && typeof penerima === 'object' && 'nama_penerima' in (penerima as Record<string, unknown>)
            ? String((penerima as Record<string, unknown>)['nama_penerima'])
            : typeof m === 'object' && 'penerima' in (m as Record<string, unknown>) && typeof (m as Record<string, unknown>)['penerima'] === 'string'
              ? String((m as Record<string, unknown>)['penerima'])
              : undefined
          const alamat = penerima && typeof penerima === 'object' && 'alamat_penerima' in (penerima as Record<string, unknown>)
            ? String((penerima as Record<string, unknown>)['alamat_penerima'])
            : typeof (m as Record<string, unknown>)['alamat_penerima'] === 'string'
              ? String((m as Record<string, unknown>)['alamat_penerima'])
              : undefined
          const nomor = penerima && typeof penerima === 'object' && 'no_penerima' in (penerima as Record<string, unknown>)
            ? String((penerima as Record<string, unknown>)['no_penerima'])
            : typeof (m as Record<string, unknown>)['telepon_penerima'] === 'string'
              ? String((m as Record<string, unknown>)['telepon_penerima'])
              : undefined
          return {
            nama_penerima: nama ?? 'Auto Generated',
            alamat_penerima: alamat ?? 'Auto Generated',
            nomor_penerima: nomor ?? 'Auto Generated',
            manifest_source: 'borneo_branch',
          }
        }
      }
    } else if (cleanAwb.startsWith('BCE')) {
      // Look up in manifest_cabang
      {
        const { data, error } = await supabase
          .from('manifest_cabang')
          .select('nama_penerima,alamat_penerima,nomor_penerima')
          .ilike('awb_no', cleanAwb)
          .maybeSingle()
        if (!error && data) {
          const row = data as ManifestRow
          return { ...row, manifest_source: 'cabang' }
        }
      }
      // Fallback to central manifest
      {
        const { data, error } = await supabase
          .from('manifest')
          .select('nama_penerima,alamat_penerima,nomor_penerima')
          .ilike('awb_no', cleanAwb)
          .maybeSingle()
        if (!error && data) {
          const row = data as ManifestRow
          return { ...row, manifest_source: 'central' }
        }
      }
    }
  } catch {
    // ignore errors and fall through to return null
  }
  return null
}

/** Create a new shipment record based on the AWB and optional manifest data. */
async function createShipment(awb: string, manifestData: ManifestResult | null, courierId: string | null, status: string = 'out_for_delivery') {
  const now = new Date().toISOString()
  const shipment = {
    awb_number: awb,
    sender_name: 'Auto Generated',
    sender_address: 'Auto Generated',
    sender_phone: 'Auto Generated',
    receiver_name: manifestData?.nama_penerima ?? 'Auto Generated',
    receiver_address: manifestData?.alamat_penerima ?? 'Auto Generated',
    receiver_phone: manifestData?.nomor_penerima ?? 'Auto Generated',
    weight: 1,
    dimensions: '10x10x10',
    service_type: 'Standard',
  current_status: status,
    created_at: now,
    updated_at: now,
    courier_id: courierId,
  }
  const { error } = await supabase.from('shipments').insert([shipment])
  if (error) {
    return { success: false, message: 'Failed to create shipment: ' + error.message }
  }
  const sourceDesc = manifestData?.manifest_source === 'central'
    ? 'manifest pusat'
    : manifestData?.manifest_source === 'cabang'
      ? 'manifest cabang'
      : manifestData?.manifest_source === 'borneo_branch'
        ? 'manifest borneo'
        : 'auto generated'
  return { success: true, message: `Created from ${sourceDesc}` }
}

/** Update an existing shipment, assigning it to a courier if provided. */
async function updateShipment(awb: string, courierId: string | null, status: string = 'out_for_delivery') {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('shipments')
    .update({
  current_status: status,
      updated_at: now,
      courier_id: courierId,
    })
    .eq('awb_number', awb)
  if (error) {
    return { success: false, message: 'Failed to update shipment: ' + error.message }
  }
  return { success: true, message: 'Updated existing shipment' }
}

/** Append a history record for the AWB indicating Out for Delivery. */
async function addHistory(awb: string, courierName: string, status: string = 'out_for_delivery', courierId: string | null = null) {
  const now = new Date().toISOString()
  const notes = status === 'delivered'
    ? `Native scanner - Delivered by ${courierName}`
    : `Native scanner - Out for Delivery by ${courierName}`
  const history: Record<string, unknown> = {
    awb_number: awb,
    status,
    location: 'Sorting Center',
    notes,
    created_at: now,
  }
  if (courierId) {
    history['courier_id'] = courierId
  }
  const res = await supabase.from('shipment_history').insert([history])
  const error = res.error as PostgrestError | null
  if (error) {
    // Treat unique-constraint duplicate history as idempotent success
    const msg = error.message ?? String(error)
  const code = error.code as string | undefined
  if (typeof msg === 'string' && msg.toLowerCase().includes('duplicate key')) {
      return { success: true, message: 'duplicate history ignored' }
    }
  if (code === '23505') {
      return { success: true, message: 'duplicate history ignored' }
    }
    return { success: false, message: 'Failed to add history: ' + msg }
  }
  return { success: true, message: '' }
}

/** Main handler for GET and POST requests.  Processes a scanned AWB. */
export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}

async function handle(request: NextRequest) {
  try {
    let awb: string | null = null
    let courierId: string | null = null
    let courierName = 'courier'
    let incomingStatus: string | undefined
    if (request.method === 'GET') {
      const { searchParams } = new URL(request.url)
      awb = searchParams.get('awb') ?? searchParams.get('awb_number')
      courierId = searchParams.get('courierId')
      courierName = searchParams.get('courierName') ?? courierName
      incomingStatus = searchParams.get('status') ?? searchParams.get('current_status') ?? undefined
    } else if (request.method === 'POST') {
      const raw = await request.text().catch(() => '')
      let body: Record<string, unknown> = {}
      if (raw) {
        try {
          body = JSON.parse(raw) as Record<string, unknown>
        } catch {
          body = {}
        }
      }
      awb = (typeof body['awb'] === 'string' ? body['awb'] : (typeof body['awb_number'] === 'string' ? body['awb_number'] : null))
      // Fallback to query params so POST?awb=... also works
      if (!awb) {
        const { searchParams } = new URL(request.url)
        awb = searchParams.get('awb') ?? searchParams.get('awb_number')
      }
      courierId = typeof body['courierId'] === 'string' ? body['courierId'] : null
      courierName = typeof body['courierName'] === 'string' ? body['courierName'] : courierName
      incomingStatus = typeof body['status'] === 'string' ? body['status'] : (typeof body['current_status'] === 'string' ? body['current_status'] : undefined)
    }
    if (!awb || typeof awb !== 'string') {
      return NextResponse.json({ success: false, message: 'Missing AWB' }, { status: 400 })
    }
    awb = awb.trim().toUpperCase()
    if (!awb.startsWith('BE') && !awb.startsWith('BCE')) {
      return NextResponse.json({ success: false, message: 'Invalid AWB prefix' }, { status: 400 })
    }

    // If courierId isn't provided, attempt to derive it from the Supabase access
    // token stored in the `sb-access-token` cookie.  When the Android WebView
    // request includes cookies from the authenticated session, this allows
    // server‑side association of the scanned AWB with the logged‑in courier.
    if (!courierId) {
      try {
        const cookieToken = request.cookies.get('sb-access-token')?.value
          ?? request.cookies.get('sb:access-token')?.value
          ?? request.cookies.get('sb:token')?.value
        // Authorization: Bearer <token> fallback
        const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization')
        const bearer = typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')
          ? authHeader.slice(7).trim()
          : null
        const token = cookieToken ?? bearer
        if (token) {
          const { data: userResponse } = await supabase.auth.getUser(token)
          if (userResponse?.user?.id) {
            courierId = userResponse.user.id
            const meta = (userResponse.user.user_metadata || {}) as Record<string, unknown>
            if (typeof meta['name'] === 'string' && meta['name']) {
              courierName = meta['name'] as string
            } else if (typeof userResponse.user.email === 'string') {
              courierName = userResponse.user.email.split('@')[0]
            }
          }
        }
      } catch {
        // ignore errors when deriving courier from cookie/header
      }
    }
    // Check existing shipment
    const { data: existing, error: existingError } = await supabase
      .from('shipments')
      .select('awb_number,current_status')
      .eq('awb_number', awb)
      .maybeSingle()
    if (existingError) {
      return NextResponse.json({ success: false, message: 'Database error' }, { status: 500 })
    }
    if (existing && existing.current_status && existing.current_status.toLowerCase() === 'delivered') {
      return NextResponse.json({ success: false, message: 'Already delivered' }, { status: 400 })
    }
    let result
    const allowed = new Set(['out_for_delivery', 'delivered'])
    const status = typeof incomingStatus === 'string' && allowed.has(incomingStatus.toLowerCase()) ? incomingStatus.toLowerCase() : 'out_for_delivery'
    if (!existing) {
      const manifest = await getManifestData(awb)
      result = await createShipment(awb, manifest, courierId, status)
    } else {
      result = await updateShipment(awb, courierId, status)
    }
    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }
  // Append history.  Do not fail the whole request if history insertion fails.
  const historyStatus = status === 'delivered' ? 'delivered' : 'out_for_delivery'
  const historyResult = await addHistory(awb, courierName, historyStatus, courierId)
  const combinedMessage = result.message + (historyResult.success ? '' : `; history error: ${historyResult.message}`)
  return NextResponse.json({ success: true, message: combinedMessage }, { status: 200 })
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Unexpected error' }, { status: 500 })
  }
}
