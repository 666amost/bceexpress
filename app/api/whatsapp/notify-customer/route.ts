import { NextRequest, NextResponse } from 'next/server';

const GREETINGS = ['Hi', 'Halo', 'Hai', 'Salam', 'Hello'];
const TARGET_STATUS = 'delivered';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      awb_number,
      receiver_phone,       // <-- pastikan benar, atau ganti jadi receiver_number
      receiver_number,
      current_status
    } = body;

    const phoneRaw = receiver_phone || receiver_number; // fallback
    if (!awb_number || !phoneRaw || !current_status) {
      return NextResponse.json({ error: 'Invalid payload', body }, { status: 400 });
    }
    if (current_status.toLowerCase() !== TARGET_STATUS) {
      return NextResponse.json({ skipped: true, reason: 'status not delivered' });
    }

    const chatId = toChatId(phoneRaw);
    const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    const message = `${greeting}, Paket dengan No. ${awb_number} sudah diterima.\nTracking bcexp.id, Input no AWB`;

    const result = await sendText(chatId, message);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : error },
      { status: 500 }
    );
  }
}

function toChatId(phone: string): string {
  // keep digits only
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  if (!digits.startsWith('62')) digits = '62' + digits;
  return `${digits}@c.us`;
}

async function sendText(chatId: string, text: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.WAHA_API_KEY) headers['X-Api-Key'] = process.env.WAHA_API_KEY;

  const res = await fetch(`${process.env.WAHA_API_URL}/api/sendText`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      chatId,
      text,
      session: process.env.WAHA_SESSION || 'default',
      linkPreview: true,
      linkPreviewHighQuality: false
    })
  });

  if (!res.ok) {
    throw new Error(`WAHA error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}