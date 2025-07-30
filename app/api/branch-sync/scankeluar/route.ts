import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      return NextResponse.json({ error: 'Invalid JSON format in request body' }, { status: 400 });
    }

    const { no_resi, nama_kurir, armada, plat_armada, pemindai } = body

    if (!no_resi || !nama_kurir || !armada || !plat_armada || !pemindai) {
      return NextResponse.json({ 
        error: "no_resi, nama_kurir, armada, plat_armada, dan pemindai are required" 
      }, { status: 400 })
    }

    // Send scan keluar to branch system
    const response = await fetch('https://www.best.borneoekspedisi.com/api/scankeluar', {
      method: 'POST',
      headers: {
        'X-API-KEY': 'borneo-test-api-key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        no_resi,
        nama_kurir,
        armada,
        plat_armada,
        pemindai
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({ 
        error: 'Failed to send scan keluar to branch system',
        details: errorText
      }, { status: response.status })
    }

    const result = await response.json()
    
    return NextResponse.json({ 
      success: true, 
      message: 'Scan keluar berhasil dikirim ke web cabang',
      data: result 
    })

  } catch (error) {
    console.error('Error sending scan keluar:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
