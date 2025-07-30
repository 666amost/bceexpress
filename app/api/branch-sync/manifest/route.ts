import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const no_resi = searchParams.get('no_resi')

    if (!no_resi) {
      return NextResponse.json({ error: 'Nomor resi is required' }, { status: 400 })
    }

    // Call API web cabang untuk mendapatkan detail manifest
    const response = await fetch(`https://www.best.borneoekspedisi.com/api/trackings/${no_resi}`, {
      method: 'GET',
      headers: {
        'X-API-KEY': 'borneo-test-api-key',
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'Manifest not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Failed to fetch manifest from branch system' }, { status: response.status })
    }

    const manifestData = await response.json()
    
    return NextResponse.json({ 
      success: true, 
      data: manifestData 
    })

  } catch (error) {
    console.error('Error fetching manifest:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
