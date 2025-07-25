// app/api/whatsapp/notify-customer/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // Untuk mencegah error bila webhook dipanggil tanpa body
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.log('Invalid request body');
      return NextResponse.json({ ok: true, skipped: true, reason: 'invalid_body' });
    }

    // --- AUTH (sama seperti notify) ---
    const rawAuth = req.headers.get('authorization') ?? '';
    const token = rawAuth.replace(/^Bearer\s+/i, '').trim();
    if (!process.env.WA_WEBHOOK_SECRET) {
      console.log('Webhook secret not configured');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }
    if (token !== process.env.WA_WEBHOOK_SECRET) {
      console.log('Unauthorized webhook call');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // --- Validasi tipe webhook Supabase (harus UPDATE dari tabel shipment) ---
    const { type, table } = body;
    if (type !== 'UPDATE' || table !== 'shipments') {
      console.log('Skipping: Invalid trigger type or table', { type, table });
      return NextResponse.json({ ok: true, skipped: true, reason: 'invalid_trigger' });
    }

    // --- Ambil record lama/baru (format Supabase pg_net) ---
    const src = body.new ?? body.record ?? null; // Untuk UPDATE, harus ada new record
    const oldSrc = body.old ?? body.old_record ?? null; // Untuk UPDATE, harus ada old record

    if (!src || !oldSrc) {
      console.log('Skipping: Missing new or old record data', { hasNew: !!src, hasOld: !!oldSrc });
      return NextResponse.json({ ok: true, skipped: true, reason: 'missing_record_data' });
    }

    // ===>> TABLE SHIPMENTS FIELDS
    const awb_number = src.awb_number;
    const status = (src.status ?? '').toLowerCase();
    const oldStatus = (oldSrc.status ?? '').toLowerCase();
    const phoneRaw = src.receiver_phone;
    const receiverNameRaw = src?.receiver_name; // <---- ADD

    // Log the incoming data for debugging
    console.log('Incoming webhook data:', {
      type,
      awb_number,
      status,
      oldStatus,
      phoneRaw,
      receiverNameRaw,
      bodyKeys: Object.keys(body)
    });

    // Validate required fields
    if (!awb_number || !status) {
      console.log('Skipping: Missing required fields', { awb_number, status });
      return NextResponse.json({ ok: true, skipped: true, warning: 'missing fields', keys: Object.keys(src || {}) });
    }

    // 1. Validasi perubahan status ke delivered
    const isDeliveredStatusChange = status === 'delivered' && oldStatus !== 'delivered';
    
    if (!isDeliveredStatusChange) {
      console.log('Skipping: Not a change to delivered status', { status, oldStatus });
      return NextResponse.json({ ok: true, skipped: true, reason: 'not_delivered_status_change' });
    }

    // 2. Validasi nomor telepon
    if (!phoneRaw) {
      console.log('Skipping: No receiver phone number', { awb_number });
      return NextResponse.json({ ok: true, skipped: true, reason: 'no_phone_number' });
    }

    // Validate phone number format
    let chatId;
    try {
      chatId = toChatId(phoneRaw);
    } catch (phoneError) {
      console.log('Skipping: Invalid phone number format', { awb_number, phoneRaw, error: phoneError.message });
      return NextResponse.json({ ok: true, skipped: true, reason: 'invalid_phone_format' });
    }

    // 3. Validasi konfigurasi WAHA
    if (!process.env.WAHA_API_URL) {
      console.log('Skipping: WAHA not configured');
      return NextResponse.json({ ok: true, skipped: true, reason: 'waha_not_configured' });
    }

    // Check WAHA connection first
    try {
      const healthCheck = await fetch(`${process.env.WAHA_API_URL}/api/status`, {
        headers: process.env.WAHA_API_KEY ? { 'X-Api-Key': process.env.WAHA_API_KEY } : {}
      });
      
      if (!healthCheck.ok) {
        console.error('WAHA health check failed:', await healthCheck.text());
        return NextResponse.json({ ok: true, warning: 'WAHA service unavailable' });
      }
    } catch (error) {
      console.error('WAHA connection check failed:', error);
      return NextResponse.json({ ok: true, warning: 'WAHA connection failed' });
    }

    const message = buildDeliveredMsg(awb_number, receiverNameRaw);

    console.log('Attempting to send WhatsApp message:', { 
      awb_number, 
      chatId, 
      messageLength: message.length,
      receiverName: receiverNameRaw 
    });

    try {
      await sendMessageSequence(chatId, message);
      console.log('WhatsApp message sent successfully:', { awb_number, chatId });
      return NextResponse.json({ ok: true });
    } catch (error) {
      console.error('WhatsApp notification error:', error);
      return NextResponse.json({ ok: true, warning: 'WhatsApp notification failed' });
    }
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
  
  // Validate Indonesian phone number format
  if (digits.length < 10 || digits.length > 15) {
    throw new Error(`Invalid phone number format: ${phone} (${digits})`);
  }
  
  return `${digits}@c.us`;
}

async function sendMessageSequence(chatId: string, text: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.WAHA_API_KEY) headers['X-Api-Key'] = process.env.WAHA_API_KEY;
  const session = process.env.WAHA_SESSION || 'default';

  // Helper function for retrying failed requests
  async function retryFetch(url: string, options: RequestInit, retries = 3) {
    let lastError: Error | null = null;
    
    for (let i = 0; i < retries; i++) {
      try {
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const res = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (res.ok) return res;
        
        // Get error details from response
        const errorText = await res.text();
        lastError = new Error(`HTTP ${res.status}: ${errorText}`);
        console.log(`Retry ${i + 1}/${retries} failed:`, lastError.message);
        
        // If response not OK, wait before retry
        await new Promise(r => setTimeout(r, 2000 * (i + 1)));
      } catch (err) {
        lastError = err as Error;
        console.log(`Retry ${i + 1}/${retries} failed:`, err);
        
        if (i === retries - 1) throw err;
        // If network error, wait before retry
        await new Promise(r => setTimeout(r, 2000 * (i + 1)));
      }
    }
    
    throw new Error(`Failed after ${retries} retries. Last error: ${lastError?.message}`);
  }

  try {
    // Send seen status
    await retryFetch(`${process.env.WAHA_API_URL}/api/sendSeen`, 
      { method: 'POST', headers, body: JSON.stringify({ chatId, session }) });

    // Start typing
    await retryFetch(`${process.env.WAHA_API_URL}/api/startTyping`,
      { method: 'POST', headers, body: JSON.stringify({ chatId, session }) });

    // Random delay (reduced for better performance)
    await randomDelay(3000, 8000);

    // Stop typing
    await retryFetch(`${process.env.WAHA_API_URL}/api/stopTyping`,
      { method: 'POST', headers, body: JSON.stringify({ chatId, session }) });

    // Send the actual message
    const res = await retryFetch(`${process.env.WAHA_API_URL}/api/sendText`, {
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
    
    return res;
  } catch (error) {
    console.error('Failed to send message sequence:', error);
    throw error;
  }
}

function randomDelay(min: number, max: number) {
  return new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min + 1)) + min));
}

// End of file
