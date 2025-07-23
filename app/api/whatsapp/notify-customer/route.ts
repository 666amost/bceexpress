// app/api/whatsapp/notify-customer/route.ts
import { NextRequest, NextResponse } from 'next/server';

// Queue untuk menangani pesan customer
let customerMessageQueue: {chatId: string, message: string}[] = [];
let isCustomerProcessing = false;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // --- AUTH (sama seperti notify) ---
    const rawAuth = req.headers.get('authorization') ?? '';
    const token = rawAuth.replace(/^Bearer\s+/i, '').trim();
    if (!process.env.WA_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }
    if (token !== process.env.WA_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // --- Ambil record lama/baru (format Supabase pg_net) ---
    const { type } = body;
    const src    = body.record ?? body.new ?? body.data ?? body;
    const oldSrc = body.old_record ?? body.old ?? {};

    // ===>> TABLE SHIPMENTS FIELDS
    const awb_number = src?.awb_number ?? src?.awb ?? src?.no_awb;
    const status     = (src?.current_status ?? src?.status ?? '').toLowerCase();
    const oldStatus  = (oldSrc?.current_status ?? oldSrc?.status ?? '').toLowerCase();
    const phoneRaw   = src?.receiver_phone ?? src?.receiver_number ?? src?.phone;
    const receiverNameRaw = src?.receiver_name; // <---- ADD

    // Jangan bikin 400 supaya log bersih
    if (!awb_number || !status) {
      return NextResponse.json({ ok: true, skipped: true, warning: 'missing fields', keys: Object.keys(src || {}) });
    }

    const isDeliveredInsert =
      type === 'INSERT' && status === 'delivered';
    const isDeliveredUpdate =
      type === 'UPDATE' && status === 'delivered' && oldStatus !== 'delivered';

    if (!(isDeliveredInsert || isDeliveredUpdate)) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    if (!phoneRaw) {
      return NextResponse.json({ ok: true, warning: 'receiver_phone missing' });
    }
    if (!process.env.WAHA_API_URL) {
      return NextResponse.json({ ok: true, warning: 'WAHA_API_URL missing' });
    }

    const chatId  = toChatId(phoneRaw);
    const message = buildDeliveredMsg(awb_number, receiverNameRaw); // <---- PASS NAME

    // Tambahkan ke queue
    customerMessageQueue.push({ chatId, message });
    
    // Mulai proses queue jika belum berjalan
    if (!isCustomerProcessing) {
      processCustomerMessageQueue();
    }
    
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ================== Templates ================== */
function cleanName(name?: string | null) {
  if (!name) return null;
  const n = String(name).trim();
  return /auto\s*generated/i.test(n) ? null : n;
}

const DELIVERED_TEMPLATES = [
  (awb: string, name?: string) =>
    `Halo${name ? ` ${name}` : ''}, kiriman Anda (AWB ${awb}) telah diterima. Terima kasih sudah mempercayakan pengiriman pada kami.`,
  (awb: string, name?: string) =>
    `Hai${name ? ` ${name}` : ''}! Paket dengan AWB ${awb} statusnya *DELIVERED*. Lihat detail tracking di bcexp.id.`,
  (awb: string, name?: string) =>
    `Hello${name ? ` ${name}` : ''}, paket AWB ${awb} sudah sampai tujuan. Jika ada pertanyaan balas pesan ini ya.`,
  (awb: string, name?: string) =>
    `Salam${name ? ` ${name}` : ''}, paket Anda (AWB ${awb}) telah terkirim. Terima kasih!`
];

function buildDeliveredMsg(awb: string, rawName?: string) {
  const name = cleanName(rawName) || undefined;
  const tpl = DELIVERED_TEMPLATES[Math.floor(Math.random() * DELIVERED_TEMPLATES.length)];
  return tpl(awb, name);
}

/* ================== Helpers ================== */
function toChatId(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  if (!digits.startsWith('62')) digits = '62' + digits;
  return `${digits}@c.us`;
}

async function sendMessageSequence(chatId: string, text: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.WAHA_API_KEY) headers['X-Api-Key'] = process.env.WAHA_API_KEY;
  const session = process.env.WAHA_SESSION || 'default';

  await fetch(`${process.env.WAHA_API_URL}/api/sendSeen`,    { method: 'POST', headers, body: JSON.stringify({ chatId, session }) });
  await fetch(`${process.env.WAHA_API_URL}/api/startTyping`, { method: 'POST', headers, body: JSON.stringify({ chatId, session }) });
  await randomDelay(Number(process.env.MIN_DELAY_MS ?? 15000), Number(process.env.MAX_DELAY_MS ?? 35000));
  await fetch(`${process.env.WAHA_API_URL}/api/stopTyping`,  { method: 'POST', headers, body: JSON.stringify({ chatId, session }) });

  const res = await fetch(`${process.env.WAHA_API_URL}/api/sendText`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      chatId,
      text,
      session,
      reply_to: null,
      linkPreview: true,
      linkPreviewHighQuality: false
    })
  });
  if (!res.ok) throw new Error(await res.text());
}

function randomDelay(min: number, max: number) {
  return new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min + 1)) + min));
}

async function processCustomerMessageQueue() {
  if (isCustomerProcessing || customerMessageQueue.length === 0) return;
  
  isCustomerProcessing = true;
  
  while (customerMessageQueue.length > 0) {
    const message = customerMessageQueue[0];
    try {
      await sendMessageSequence(message.chatId, message.message);
      // Tunggu 5 detik sebelum mengirim pesan berikutnya
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error) {
      console.error('Error sending customer message:', error);
    }
    customerMessageQueue.shift(); // Hapus pesan yang sudah diproses
  }
  
  isCustomerProcessing = false;
}
