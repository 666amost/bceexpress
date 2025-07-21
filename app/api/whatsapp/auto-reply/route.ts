import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('WAHA payload:', body); // Logging untuk debugging
    const { from } = body;
    if (!from) {
      return NextResponse.json({ error: 'No sender (from) in payload' }, { status: 400 });
    }
    const replyText = 'untuk pertanyaan mengenai pengiriman bisa hub Admin di area pengiriman\n\nWhatsapp ini hanya chat otomatis untuk laporan paket diterima';

    // Normalisasi nomor WA (jika perlu)
    const phoneId = normalizePhoneNumber(from);
    if (!phoneId) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    }

    // Kirim balasan ke WhatsApp via WAHA API
    await sendMessageSequence(phoneId, replyText);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Auto-reply error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error instanceof Error ? error.message : error }, { status: 500 });
  }
}

function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  // Ambil hanya digit (buang @c.us jika ada)
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('08')) return '62' + digits.slice(1);
  if (digits.startsWith('8')) return '62' + digits; // handle jika tanpa 0
  return digits;
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