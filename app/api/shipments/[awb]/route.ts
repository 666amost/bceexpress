import { NextRequest, NextResponse } from 'next/server'
import { supabaseServerClient } from '@/lib/auth'

interface Params {
  awb: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
): Promise<NextResponse> {
  try {
    const awb = params.awb

    if (!awb) {
      return NextResponse.json(
        { error: 'AWB number is required' },
        { status: 400 }
      )
    }

    // Fetch shipment details
    const { data: shipment, error: shipmentError } = await supabaseServerClient
      .from('shipments')
      .select('*')
      .eq('awb', awb)
      .single()

    if (shipmentError) {
      return NextResponse.json({ error: 'Failed to fetch shipment details' }, { status: 500 })
    }

    if (!shipment) {
      return NextResponse.json(
        { error: 'Shipment not found' },
        { status: 404 }
      )
    }

    // Fetch shipment history
    const { data: history, error: historyError } = await supabaseServerClient
      .from('shipment_history')
      .select('*')
      .eq('awb', awb)
      .order('created_at', { ascending: false })

    if (historyError) {
      return NextResponse.json({ error: 'Failed to fetch shipment history' }, { status: 500 })
    }

    return NextResponse.json({
      shipment,
      history: history || []
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
