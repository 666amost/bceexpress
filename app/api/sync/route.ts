
import { NextResponse } from "next/server";
import { getUndeliveredShipments, getUserNameById, getPhotoUrlFromHistory } from "@/lib/db";
import axios from "axios";


export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const awbNumber: string | null = url.searchParams.get("awb_number");

  if (!awbNumber) {
    return NextResponse.json({ error: "AWB number is required" }, { status: 400 });
  }

  try {
    const shipments = await getUndeliveredShipments(awbNumber);

    if (!shipments || shipments.length === 0) {
      return NextResponse.json({ success: true, message: "No shipments to sync for this AWB" });
    }

    for (const shipment of shipments) {
      if (
        shipment.status === "delivered" &&
        typeof shipment.awb_number === "string" &&
        shipment.awb_number.startsWith("BE")
      ) {
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
            namaKurir = "Kurir Default";
          }

          if (
            !shipment.awb_number ||
            shipment.awb_number.length < 12 ||
            shipment.awb_number.length > 14
          ) {
            continue;
          }
          if (!shipment.notes || shipment.notes.length === 0) {
            continue;
          }
          if (!namaKurir || !shipment.location) {
            continue;
          }
          if (shipment.location && shipment.location.length < 5) {
            continue;
          }

          const photoUrl: string | null = await getPhotoUrlFromHistory(shipment.awb_number);

          if (photoUrl) {
            // Compose JSON payload for scanttd endpoint
            const payload: {
              no_resi: string;
              keterangan: string;
              nama_kurir: string;
              pemindai: string;
              gambar: string;
              armada: string;
              plat_armada: string;
            } = {
              no_resi: shipment.awb_number,
              keterangan: shipment.notes,
              nama_kurir: namaKurir,
              pemindai: shipment.location,
              gambar: photoUrl,
              armada: "motor",
              plat_armada: "BCEJKT",
            };

            const MAX_RETRIES = 3;
            const retryDelay = (retries: number): number => 1000 * 2 ** retries;

            for (let retries = 0; retries <= MAX_RETRIES; retries++) {
              try {
                const response = await axios.post(
                  "https://www.best.borneoekspedisi.com/api/scanttd",
                  payload,
                  {
                    headers: {
                      "X-API-KEY": "borneo-test-api-key",
                      "Content-Type": "application/json",
                    },
                    timeout: 30000,
                  }
                );

                if (response.status === 200) {
                  break;
                } else {
                  throw new Error(`Respons tidak sukses: ${response.status}`);
                }
              } catch (err: unknown) {
                if (err && typeof err === "object" && "response" in err) {
                  const axiosError = err as { response: { status: number } };
                  if (
                    axiosError.response &&
                    axiosError.response.status === 429 &&
                    retries < MAX_RETRIES
                  ) {
                    await new Promise((resolve) => setTimeout(resolve, retryDelay(retries)));
                  } else {
                    throw err;
                  }
                } else {
                  throw err;
                }
              }
            }
          }
        } catch {
          // No log
        }
      }
    }

    return NextResponse.json({ success: true, message: "Sync completed for specified AWB" });
  } catch {
    return NextResponse.json({ error: "Internal server error during sync" }, { status: 500 });
  }
}
