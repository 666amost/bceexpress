// app/api/whatsapp/auto-reply/route.ts
import { NextRequest, NextResponse } from 'next/server';

// ================== Types ==================
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

// ================== Handler ==================
export async function POST(req: NextRequest) {
  try {
    // Body must be read ONCE to avoid "Body is unusable" errors
    const raw = await req.text();
    const body: WahaWebhookBody = JSON.parse(raw);

    // Ignore non-message events or messages without text
    if (body.event !== 'message' || !body.payload?.body) {
      return NextResponse.json({ ok: true, info: `Event '${body.event}' ignored` });
    }

    const { from, fromMe } = body.payload;
    
    // Skip messages from bot or group chats
    if (fromMe || from.endsWith('@g.us')) {
      return NextResponse.json({ ok: true, info: 'Message from bot or group chat, skipped' });
    }

    const replyText = `Untuk pertanyaan mengenai pengiriman bisa hubungi Admin di area pengiriman.\n\nWhatsapp ini hanya chat otomatis untuk laporan paket diterima.\n\nAkses bcexp.id untuk tracking paket dengan input no AWB.\n\nTERIMA KASIH.`;

    await sendTextSafe(from, replyText); // fast send, no typing/delay to avoid 524
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

// ================== Helpers ==================
function normalizePhoneNumber(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('08')) return '62' + digits.slice(1);
  if (digits.startsWith('8')) return '62' + digits;
  return digits;
}

/**
 * Send text quickly to WAHA without long delays/typing to prevent CF 524 timeout.
 * We add a local timeout using AbortController and log WAHA responses.
 */
async function sendTextSafe(phoneOrGroup: string, text: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.WAHA_API_KEY) headers['X-Api-Key'] = process.env.WAHA_API_KEY;

  const chatId = /@(c|g)\.us$/.test(phoneOrGroup)
    ? phoneOrGroup
    : `${normalizePhoneNumber(phoneOrGroup)}@c.us`;

  const session = process.env.WAHA_SESSION || 'default';

  const controller = new AbortController();
  const timeoutMs = Number(process.env.WAHA_TIMEOUT_MS ?? 15000); // 15s default
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${process.env.WAHA_API_URL}/api/sendText`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ chatId, text, session }),
      signal: controller.signal
    });

    const bodyText = await res.text();

    if (!res.ok) throw new Error(`WAHA ${res.status}: ${bodyText}`);
    return JSON.parse(bodyText);
  } finally {
    clearTimeout(timer);
  }
}
