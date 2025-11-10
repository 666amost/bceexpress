import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[Tracking API] Missing Supabase credentials!')
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'apikey': supabaseServiceKey
    }
  }
})

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const awbNumber = searchParams.get("awb")
  const testMode = searchParams.get("test")

  if (!awbNumber) {
    return NextResponse.json({ error: "AWB number is required" }, { status: 400 })
  }

  // Disable test mode in production
  if (testMode === "true" && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Test mode not available in production" }, { status: 403 })
  }

  if (testMode === "true") {
    try {
      const { data: testData, error: testError, count } = await supabaseAdmin
        .from("manifest_cabang")
        .select("awb_no", { count: 'exact' })
        .limit(5)

      return NextResponse.json({
        test: true,
        supabase_configured: !!(supabaseUrl && supabaseServiceKey),
        manifest_cabang_accessible: !testError,
        sample_count: count,
        sample_data: testData,
        error: testError
      })
    } catch (err) {
      return NextResponse.json({
        test: true,
        error: 'Failed to test database connection',
        details: err
      })
    }
  }

  try {
    const { data: shipmentData, error: shipmentError } = await supabaseAdmin
      .from("shipments")
      .select("*")
      .eq("awb_number", awbNumber)
      .maybeSingle()

    const { data: historyData } = await supabaseAdmin
      .from("shipment_history")
      .select("*")
      .eq("awb_number", awbNumber)
      .order("created_at", { ascending: false })

    const { data: manifestData } = await supabaseAdmin
      .from("manifest_cabang")
      .select("*")
      .or(`awb_no.eq.${awbNumber},awb_no.ilike.${awbNumber}`)
      .maybeSingle()

    if (!shipmentData && !manifestData) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 })
    }

    let combinedHistory = historyData || []

    if (manifestData) {
      const warehouseLocation = manifestData.origin_branch?.toLowerCase().includes('bangka')
        ? 'WAREHOUSE_BANGKA'
        : manifestData.origin_branch?.toLowerCase().includes('tanjung')
        ? 'WAREHOUSE_TJQ'
        : `WAREHOUSE_${manifestData.origin_branch?.toUpperCase() || 'UNKNOWN'}`

      const warehouseEntry = {
        id: 'manifest-entry',
        awb_number: awbNumber,
        status: 'processed',
        location: warehouseLocation,
        notes: `Package received at ${manifestData.origin_branch || 'branch'} warehouse`,
        created_at: manifestData.created_at || new Date().toISOString()
      }

      combinedHistory = [...combinedHistory, warehouseEntry].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    }

    return NextResponse.json({
      type: shipmentData ? "shipment" : "manifest",
      data: {
        shipment: shipmentData,
        manifestCabang: manifestData,
        history: combinedHistory
      }
    })

  } catch (error) {
    console.error('[Tracking API] Unexpected error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
