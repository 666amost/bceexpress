import { type NextRequest, NextResponse } from "next/server"
import { fetchManifestFromBranch } from "@/lib/branch-sync"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const awb_number = searchParams.get('awb_number')

    if (!awb_number) {
      return NextResponse.json({ error: 'AWB number is required' }, { status: 400 })
    }

    console.warn(`Fetching manifest for AWB: ${awb_number}`);

    // Fetch manifest data from branch system
    const manifestData = await fetchManifestFromBranch(awb_number)

    if (!manifestData) {
      console.warn(`Manifest not found for AWB: ${awb_number}`);
      return NextResponse.json({ 
        success: false,
        error: 'Manifest not found in branch system',
        awb_number 
      }, { status: 200 }) // Return 200 instead of 404 for frontend handling
    }

    console.warn(`Manifest found for AWB: ${awb_number}`);
    return NextResponse.json({ 
      success: true,
      data: manifestData
    })

  } catch (error) {
    console.error('Error in manifest search API:', error)
    
    // More detailed error response
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    return NextResponse.json({ 
      success: false,
      error: 'Failed to fetch manifest from branch system',
      details: errorMessage
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      return NextResponse.json({ error: 'Invalid JSON format in request body' }, { status: 400 });
    }

    const { awb_numbers } = body;

    if (!awb_numbers || !Array.isArray(awb_numbers) || awb_numbers.length === 0) {
      return NextResponse.json({ 
        error: 'awb_numbers array is required and must not be empty' 
      }, { status: 400 })
    }

    const results = [];
    const errors = [];

    // Fetch multiple manifests
    for (const awb_number of awb_numbers) {
      try {
        const manifestData = await fetchManifestFromBranch(awb_number);
        if (manifestData) {
          results.push({
            awb_number,
            success: true,
            data: manifestData
          });
        } else {
          errors.push({
            awb_number,
            error: 'Manifest not found'
          });
        }
      } catch (error) {
        errors.push({
          awb_number,
          error: 'Failed to fetch manifest'
        });
      }
    }

    return NextResponse.json({ 
      success: true,
      results,
      errors,
      total_requested: awb_numbers.length,
      total_found: results.length,
      total_errors: errors.length
    })

  } catch (error) {
    console.error('Error in bulk manifest fetch:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
