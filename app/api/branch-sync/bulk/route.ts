import { type NextRequest, NextResponse } from "next/server"
import { sendScanKeluarToBranch, sendScanTTDToBranch, extractCourierName } from "@/lib/branch-sync"
import { getUndeliveredShipments, getUserNameById, getPhotoUrlFromHistory } from "@/lib/db"
import type { BranchSyncResult } from "@/types"

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      return NextResponse.json({ error: 'Invalid JSON format in request body' }, { status: 400 });
    }

    const { action, awb_numbers, status_filter } = body;

    if (!action || !['scankeluar', 'scanttd', 'bulk_delivered'].includes(action)) {
      return NextResponse.json({ 
        error: 'Invalid action. Must be scankeluar, scanttd, or bulk_delivered' 
      }, { status: 400 })
    }

    const results: BranchSyncResult[] = [];
    const errors: string[] = [];

    if (action === 'bulk_delivered') {
      // Bulk sync delivered shipments
      try {
        const shipments = await getUndeliveredShipments();
        const deliveredShipments = shipments?.filter(s => 
          s.status === 'delivered' && 
          s.awb_number.startsWith('BE') && 
          s.photo_url
        ) || [];

        for (const shipment of deliveredShipments) {
          try {
            let namaKurir: string | null = null;
            if (shipment.user_id) {
              namaKurir = await getUserNameById(shipment.user_id);
            }
            
            if (!namaKurir) {
              namaKurir = extractCourierName(shipment.notes, shipment.location);
            }

            const photoUrl = await getPhotoUrlFromHistory(shipment.awb_number);
            
            if (photoUrl && namaKurir) {
              const syncSuccess = await sendScanTTDToBranch({
                no_resi: shipment.awb_number,
                nama_kurir: namaKurir,
                armada: "motor",
                plat_armada: "BCEJKT",
                gambar: photoUrl,
                pemindai: shipment.location || "System"
              });

              results.push({
                success: syncSuccess,
                awb_number: shipment.awb_number,
                action: 'scanttd',
                timestamp: new Date().toISOString(),
                error: syncSuccess ? undefined : 'Failed to sync to branch'
              });
            }
          } catch (error) {
            errors.push(`${shipment.awb_number}: ${error}`);
          }
        }
      } catch (error) {
        return NextResponse.json({ 
          error: 'Failed to fetch shipments for bulk sync' 
        }, { status: 500 })
      }
    } else if (awb_numbers && Array.isArray(awb_numbers)) {
      // Manual sync for specific AWBs
      for (const awb_number of awb_numbers) {
        try {
          // This would require additional logic to fetch shipment details
          // and determine the appropriate sync action
          errors.push(`${awb_number}: Manual sync not yet implemented`);
        } catch (error) {
          errors.push(`${awb_number}: ${error}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      results,
      errors,
      total_processed: results.length,
      total_successful: results.filter(r => r.success).length,
      total_failed: results.filter(r => !r.success).length + errors.length
    })

  } catch (error) {
    console.error('Error in bulk sync:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const status = searchParams.get('status')

    // Get shipments that need syncing
    const shipments = await getUndeliveredShipments();
    const filteredShipments = shipments?.filter(s => {
      if (status === 'delivered') {
        return s.status === 'delivered' && s.awb_number.startsWith('BE') && s.photo_url;
      }
      if (status === 'out_for_delivery') {
        return s.status === 'out_for_delivery' && s.awb_number.startsWith('BE');
      }
      return s.awb_number.startsWith('BE');
    }).slice(0, limit) || [];

    const syncCandidates = filteredShipments.map(shipment => ({
      awb_number: shipment.awb_number,
      status: shipment.status,
      location: shipment.location,
      notes: shipment.notes,
      has_photo: !!shipment.photo_url,
      created_at: shipment.created_at,
      updated_at: shipment.updated_at
    }));

    return NextResponse.json({
      success: true,
      data: syncCandidates,
      total: syncCandidates.length,
      filters: { status, limit }
    })

  } catch (error) {
    console.error('Error fetching sync candidates:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
