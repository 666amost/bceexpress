import { NextRequest, NextResponse } from 'next/server';

// ===================================================================
// BAGIAN 1: INTERFACE (TIPE) YANG LEBIH AKURAT UNTUK WAHA
// ===================================================================
interface MessageData {
  from: string;
  fromMe: boolean;
  body?: string;
}
interface WahaWebhookBody {
  event: 'message' | 'ack' | 'presence' | string;
  session: string;
  payload: MessageData;
}

// ===================================================================
// BAGIAN 2: FUNGSI UTAMA WEBHOOK (POST HANDLER)
// ===================================================================
export async function POST(req: NextRequest) {
  try {
    const body: WahaWebhookBody = await req.json();

    if (body.event !== 'message' || !body.payload || !body.payload.body) {
      console.log(`Event '${body.event}' diterima dan diabaikan.`);
      return NextResponse.json({ ok: true, info: `Event '${body.event}' ignored.` });
    }

    const { from, fromMe } = body.payload;
    if (fromMe) {
      return NextResponse.json({ ok: true, info: 'Message from bot, not replying.' });
    }

    const replyText =
`Untuk pertanyaan mengenai pengiriman bisa hubungi Admin di area pengiriman.

Whatsapp ini hanya chat otomatis untuk laporan paket diterima.

Akses bcexp.id untuk tracking paket dengan input no AWB.

TERIMA KASIH.`;

    await sendMessageSequence(from, replyText);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error in webhook handler:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : error },
      { status: 500 }
    );
  }
}

// ===================================================================
// BAGIAN 3: FUNGSI PEMBANTU (HELPER FUNCTIONS)
// ===================================================================
function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('08')) return '62' + digits.slice(1);
  if (digits.startsWith('8'))  return '62' + digits;
  return digits;
}

async function sendMessageSequence(phoneOrGroup: string, message: string) {
  const typingDelay = Math.floor(Math.random() * (30000 - 10000 + 1)) + 10000;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.WAHA_API_KEY) headers['X-Api-Key'] = process.env.WAHA_API_KEY;

  const chatId = phoneOrGroup.includes('@c.us')
    ? phoneOrGroup
    : `${normalizePhoneNumber(phoneOrGroup)}@c.us`;
  const session = process.env.WAHA_SESSION || 'default';

  await fetch(`${process.env.WAHA_API_URL}/api/sendSeen`,    { method: 'POST', headers, body: JSON.stringify({ chatId, session }) });
  await fetch(`${process.env.WAHA_API_URL}/api/startTyping`, { method: 'POST', headers, body: JSON.stringify({ chatId, session }) });
  await new Promise(r => setTimeout(r, typingDelay));
  await fetch(`${process.env.WAHA_API_URL}/api/stopTyping`,  { method: 'POST', headers, body: JSON.stringify({ chatId, session }) });

  const res = await fetch(`${process.env.WAHA_API_URL}/api/sendText`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ chatId, text: message, session })
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`WhatsApp API error: ${res.status} - ${errorText}`);
  }
  return res.json();
}
