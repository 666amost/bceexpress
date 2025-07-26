import { NextResponse } from "next/server";
import { getUndeliveredShipments, getUserNameById, getPhotoUrlFromHistory } from "@/lib/db";  // Tambahkan getUserNameById dan getPhotoUrlFromHistory
import axios from 'axios';
import FormData from 'form-data';

export async function GET(request: Request) {  // Ubah untuk menerima parameter query, misalnya AWB spesifik
  const url = new URL(request.url);
  const awbNumber = url.searchParams.get('awb_number');  // Ambil AWB dari query parameter, e.g., ?awb_number=BE000TEST

  if (!awbNumber) {
    return NextResponse.json({ error: 'AWB number is required' }, { status: 400 });
  }

  try {
    const shipments = await getUndeliveredShipments(awbNumber);

    if (!shipments || shipments.length === 0) {
      return NextResponse.json({ success: true, message: "No shipments to sync for this AWB" });
    }

    for (const shipment of shipments) {
      if (shipment.status === "delivered" && shipment.awb_number.startsWith('BE') && shipment.photo_url) {
        try {
          let namaKurir: string | null = null;
          if (shipment.user_id) {
            namaKurir = await getUserNameById(shipment.user_id);
          }
          
          if (!namaKurir && shipment.notes) {
            const byMatch = shipment.notes.match(/by\s+(\w+)/i);
            const dashMatch = shipment.notes.match(/-\s+(\w+)/i);
            const bulkMatch = shipment.notes.match(/Bulk update - Shipped by\s+(\w+)/i);
            
            if (byMatch && byMatch[1]) {
              namaKurir = byMatch[1];
            } else if (dashMatch && dashMatch[1]) {
              namaKurir = dashMatch[1];
            } else if (bulkMatch && bulkMatch[1]) {
              namaKurir = bulkMatch[1];
            }
          }
          
          if (!namaKurir) {
            namaKurir = "Kurir Default";  // Fallback tanpa log
          }
          
          if (!shipment.awb_number || shipment.awb_number.length < 12 || shipment.awb_number.length > 14) {
            continue;  // Lewati tanpa log
          }
          if (!shipment.notes || shipment.notes.length === 0) {
            continue;  // Lewati tanpa log
          }
          if (!namaKurir || !shipment.location) {
            continue;  // Lewati tanpa log
          }
          
          if (shipment.location && shipment.location.length < 5) {
            continue;  // Lewati tanpa log
          }
          
          let photoUrl: string | null = await getPhotoUrlFromHistory(shipment.awb_number);
          
          if (photoUrl) {
            if (shipment.awb_number.length < 12 || shipment.awb_number.length > 14) {
              continue;
            }
            if (!shipment.notes || shipment.notes.length === 0) {
              continue;
            }
            if (!namaKurir || namaKurir.length === 0) {
              continue;
            }
            if (!shipment.location || shipment.location.length < 5) {
              continue;
            }
            
            const formData = new FormData();
            formData.append("no_resi", shipment.awb_number);
            formData.append("keterangan", shipment.notes);
            formData.append("nama_kurir", namaKurir);
            formData.append("pemindai", shipment.location);
            formData.append("gambar", photoUrl);
            formData.append("armada", "motor");
            formData.append("plat_armada", "BCEJKT");
            
            const MAX_RETRIES = 3;
            const retryDelay = (retries: number) => 1000 * (2 ** retries);
            
            for (let retries = 0; retries <= MAX_RETRIES; retries++) {
              try {
                const response = await axios.post(
                  "https://www.best.borneoekspedisi.com/api/trackings",
                  formData,
                  {
                    headers: {
                      ...formData.getHeaders(),
                      "X-API-KEY": "borneo-test-api-key",
                    },
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity,
                    timeout: 30000,
                  }
                );
                
                if (response.status === 200) {
                  break;  // Berhasil, lanjutkan
                } else {
                  throw new Error(`Respons tidak sukses: ${response.status}`);
                }
              } catch (err: unknown) {
                // Type guard untuk axios error
                if (err && typeof err === 'object' && 'response' in err) {
                  const axiosError = err as { response: { status: number } };
                  if (axiosError.response && axiosError.response.status === 429 && retries < MAX_RETRIES) {
                    await new Promise(resolve => setTimeout(resolve, retryDelay(retries)));
                  } else {
                    throw err;
                  }
                } else {
                  throw err;
                }
              }
            }
          }
        } catch (err) {
          // Tidak ada log di sini
        }
      }
    }

    return NextResponse.json({ success: true, message: "Sync completed for specified AWB" });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error during sync' }, { status: 500 });
  }
}
