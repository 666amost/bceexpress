import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const awbNumber = formData.get("awbNumber") as string

    if (!file || !awbNumber) {
      return NextResponse.json({ error: "File and AWB number are required" }, { status: 400 })
    }

    const fileExt = file.name.split(".").pop()
    const fileName = `${awbNumber}-${Date.now()}.${fileExt}`
    const filePath = `proof-of-delivery/${fileName}`

    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    // Upload to Supabase Storage
    const { error: storageError } = await supabase.storage.from("shipment-photos").upload(filePath, buffer, {
      contentType: file.type,
    })

    if (storageError) {
      console.error("Supabase storage error:", storageError)
      return NextResponse.json({ error: "Failed to upload file" }, { status: 500 })
    }

    // Get public URL
    const { data } = supabase.storage.from("shipment-photos").getPublicUrl(filePath)

    const podImageUrl = data.publicUrl

    // Simpan URL ke database (ganti 'shipment_history' dengan nama tabel Anda jika berbeda)
    const { error: dbError } = await supabase
      .from("shipment_history") // Pastikan ini nama tabel yang benar
      .update({ photo_url: podImageUrl })
      .eq("awb_number", awbNumber) // Pastikan ini nama kolom nomor resi yang benar

    if (dbError) {
      console.error("Supabase database error:", dbError)
      return NextResponse.json({ error: "Failed to save POD URL to database" }, { status: 500 })
    }

    return NextResponse.json({ url: podImageUrl })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
