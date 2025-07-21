import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  // WAHA akan mengirim payload pesan masuk di body
  // Bisa ditambah validasi jika perlu
  return NextResponse.json({ reply: 'Untuk pertanyaan mengenai pengiriman bisa hub Admin di area pengiriman' });
} 