// app/api/whatsapp/notify-customer/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, record, old_record } = body;
    const authorization = req.headers.get('authorization');

    // --- Security check (same as notify route) ---
    if (!process.env.WA_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }
    if (authorization !== process.env.WA_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // --- Basic validation ---
    if (!record || !record.awb_number || !record.status) {
      return NextResponse.json({ error: 'Invalid record data' }, { status: 400 });
    }

    // Trigger only when status becomes delivered
    const isDeliveredInsert =
      type === 'INSERT' && record.status === 'delivered';
    const isDeliveredUpdate =
      type === 'UPDATE' &&
      record.status === 'delivered' &&
      old_record?.status !== 'delivered';

    if (isDeliveredInsert || isDeliveredUpdate) {
      if (!process.env.WAHA_API_URL) {
        return NextResponse.json({
          ok: true,
          warning: 'WhatsApp notification skipped - WAHA_API_URL missing',
        });
      }

      const awb = record.awb_number;
      const phoneRaw = record.receiver_phone || record.receiver_number;
      if (!phoneRaw) {
        return NextResponse.json({
          ok: true,
          warning: 'receiver_phone missing - message not sent',
        });
      }

      const chatId = toChatId(phoneRaw);
      const message = buildDeliveredMsg(awb);

      try {
        await sendMessageSequence(chatId, message);
      } catch {
        return NextResponse.json({
          ok: true,
          warning: 'WhatsApp notification failed but webhook succeeded',
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ===== Message templates ===== */
const DELIVERED_TEMPLATES = [
  (awb: string) => `Halo, kiriman Anda (AWB ${awb}) telah diterima. Terima kasih sudah mempercayakan pengiriman pada kami.`,
  (awb: string) => `Hai! Paket dengan AWB ${awb} statusnya *DELIVERED*. Lihat detail tracking di bcexp.id.`,
  (awb: string) => `Hello, paket AWB ${awb} sudah sampai tujuan. Jika ada pertanyaan balas pesan ini ya.`,
  (awb: string) => `Salam, paket Anda (AWB ${awb}) telah terkirim. Terima kasih!`,
];
function buildDeliveredMsg(awb: string) {
  return DELIVERED_TEMPLATES[Math.floor(Math.random() * DELIVERED_TEMPLATES.length)](awb);
}

/* ===== Helpers ===== */
function toChatId(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  if (!digits.startsWith('62')) digits = '62' + digits;
  return `${digits}@c.us`;
}

async function sendMessageSequence(chatId: string, message: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.WAHA_API_KEY) headers['X-Api-Key'] = process.env.WAHA_API_KEY;

  const session = process.env.WAHA_SESSION || 'default';

  // 1. seen
  await fetch(`${process.env.WAHA_API_URL}/api/sendSeen`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ chatId, session }),
  });

  // 2. typing
  await fetch(`${process.env.WAHA_API_URL}/api/startTyping`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ chatId, session }),
  });

  // 3. delay (15–35s by default, override via env)
  await randomDelay(
    Number(process.env.MIN_DELAY_MS ?? 15000),
    Number(process.env.MAX_DELAY_MS ?? 35000)
  );

  // 4. stop typing
  await fetch(`${process.env.WAHA_API_URL}/api/stopTyping`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ chatId, session }),
  });

  // 5. send message
  const res = await fetch(`${process.env.WAHA_API_URL}/api/sendText`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      chatId,
      text: message,
      session,
      reply_to: null,
      linkPreview: true,
      linkPreviewHighQuality: false,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`WhatsApp API error: ${res.status} - ${errorText}`);
  }
  return res.json();
}

function randomDelay(min: number, max: number) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((r) => setTimeout(r, ms));
}
