import { NextRequest, NextResponse } from 'next/server';

const GREETINGS = ['Hi', 'Halo', 'Hai', 'Salam', 'Hello'];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { awb_number, receiver_phone, current_status } = body;

    if (!awb_number || !receiver_phone || !current_status) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Format pesan dengan salam random
    const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    const message = `${greeting}, Paket dengan No. ${awb_number} sudah diterima.\nTracking bcexp.id, Input no AWB`;
    const phoneId = normalizePhoneNumber(receiver_phone);

    try {
      await sendMessageSequence(phoneId, message);
    } catch (err) {
      return NextResponse.json({ error: 'Failed to send WhatsApp', details: err instanceof Error ? err.message : err }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error', details: error instanceof Error ? error.message : error }, { status: 500 });
  }
}

// Tambahkan handler GET untuk auto-reply jika user membalas (simulasi, karena WhatsApp webhook reply perlu endpoint terpisah)
export async function GET(req: NextRequest) {
  // Simulasi auto-reply jika user membalas
  return NextResponse.json({ reply: 'Untuk pertanyaan mengenai pengiriman bisa hub Admin di area pengiriman' });
}

function normalizePhoneNumber(phone: string): string {
  if (phone.startsWith('62')) return phone;
  if (phone.startsWith('08')) return '62' + phone.slice(1);
  return phone;
}

async function sendMessageSequence(phoneOrGroup: string, message: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (process.env.WAHA_API_KEY) {
    headers['X-Api-Key'] = process.env.WAHA_API_KEY;
  }
  await fetch(`${process.env.WAHA_API_URL}/api/sendSeen`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      chatId: phoneOrGroup,
      session: process.env.WAHA_SESSION || 'default',
    })
  });
  await fetch(`${process.env.WAHA_API_URL}/api/startTyping`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      chatId: phoneOrGroup,
      session: process.env.WAHA_SESSION || 'default',
    })
  });
  await randomDelay(30000, 60000);
  await fetch(`${process.env.WAHA_API_URL}/api/stopTyping`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      chatId: phoneOrGroup,
      session: process.env.WAHA_SESSION || 'default',
    })
  });
  const res = await fetch(`${process.env.WAHA_API_URL}/api/sendText`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      chatId: phoneOrGroup,
      text: message,
      session: process.env.WAHA_SESSION || 'default',
      reply_to: null,
      linkPreview: true,
      linkPreviewHighQuality: false
    })
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`WhatsApp API error: ${res.status} - ${errorText}`);
  }
  return res.json();
}

function randomDelay(min: number, max: number) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, ms));
} 