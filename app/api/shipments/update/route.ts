import { type NextRequest, NextResponse } from "next/server"
import { addShipmentHistory } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      return NextResponse.json({ error: 'Invalid JSON format in request body' }, { status: 400 });
    }
    const { awb_number, status, location, notes, photo_url, latitude, longitude } = body

    if (!awb_number || !status || !location) {
      return NextResponse.json({ error: "AWB number, status, and location are required" }, { status: 400 })
    }

    // Add shipment history
    const result = await addShipmentHistory({
      awb_number,
      status,
      location,
      notes: notes || null,
      photo_url: photo_url || null,
      latitude: latitude || null,
      longitude: longitude || null,
    })

    if (!result) {
      return NextResponse.json({ error: "Failed to update shipment" }, { status: 500 })
    }

    // Integrasi ke REST API cabang jika status delivered dan ada photo_url
    if (status === "delivered" && result.photo_url) {
      try {
        const axios = (await import("axios")).default;
        const FormData = (await import("form-data")).default;
        // Download gambar dari Supabase Storage
        const imageResponse = await fetch(result.photo_url);
        const imageBuffer = await imageResponse.arrayBuffer();
        const formData = new FormData();
        formData.append("no_resi", awb_number);
        formData.append("keterangan", notes || "Diterima langsung");
        formData.append("nama_kuri", location || "Kurir");
        formData.append("armada", "");
        formData.append("plat_armada", "");
        formData.append("pemindai", location || "Kurir");
        formData.append("gambar", result.photo_url);
        await axios.post(
          "https://www.best.borneoekspedisi.com/api/trackings",
          formData,
          {
            headers: {
              ...formData.getHeaders(),
              "X-API-KEY": "borneo-test-api-key",
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
          }
        );
      } catch (err) {
        const errorAny = err as any;
        let errorLog: any = { message: "Gagal sync ke API cabang", error: errorAny };
        if (errorAny.response) {
          errorLog.response = {
            status: errorAny.response.status,
            data: errorAny.response.data,
          };
        }
        console.error(JSON.stringify(errorLog));
        // Tidak mengganggu response utama
      }
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
