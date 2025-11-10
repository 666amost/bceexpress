// app/api/whatsapp/notify-customer/route.ts
import { NextRequest, NextResponse } from 'next/server';

// Rate limiting: max 15 customer notifications per day
const MAX_DAILY_NOTIFICATIONS = 15;
const notificationLog = new Map<string, { count: number; resetAt: number }>();

function canSendNotification(): boolean {
  const today = new Date().toISOString().split('T')[0];
  const log = notificationLog.get(today);
  const now = Date.now();

  if (!log || now > log.resetAt) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    notificationLog.set(today, { count: 0, resetAt: tomorrow.getTime() });
    return true;
  }

  return log.count < MAX_DAILY_NOTIFICATIONS;
}

function incrementNotificationCount() {
  const today = new Date().toISOString().split('T')[0];
  const log = notificationLog.get(today);
  if (log) {
    log.count++;
  }
}

export async function POST(req: NextRequest) {
  // Check rate limit first
  if (!canSendNotification()) {
    return NextResponse.json({ 
      ok: true, 
      skipped: true, 
      reason: 'daily_limit_reached',
      message: `Daily notification limit (${MAX_DAILY_NOTIFICATIONS}) reached`
    });
  }
  try {
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'invalid_body' });
    }

    const rawAuth = req.headers.get('authorization') ?? '';
    const token = rawAuth.replace(/^Bearer\s+/i, '').trim();
    if (!process.env.WA_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }
    if (token !== process.env.WA_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { type, table } = body;
    if (type !== 'UPDATE' || table !== 'shipments') {
      return NextResponse.json({ ok: true, skipped: true, reason: 'invalid_trigger' });
    }

    const src = body.new ?? body.record ?? null;
    const oldSrc = body.old ?? body.old_record ?? null;

    if (!src || !oldSrc) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'missing_record_data' });
    }

    const awb_number = src.awb_number;
    const status = (src.current_status ?? src.status ?? '').toLowerCase();
    const oldStatus = (oldSrc.current_status ?? oldSrc.status ?? '').toLowerCase();
    const phoneRaw = src.receiver_phone;
    const receiverNameRaw = src?.receiver_name;

    if (!awb_number || !status) {
      return NextResponse.json({ ok: true, skipped: true, warning: 'missing fields', keys: Object.keys(src || {}) });
    }

    // FILTER: Only BCE prefix (not BE)
    if (!awb_number.toUpperCase().startsWith('BCE')) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'not_bce_prefix' });
    }

    // Random selection: 50% chance to skip (untuk randomize 15 dari banyak request)
    if (Math.random() > 0.5) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'random_skip' });
    }

    const isDeliveredStatusChange = status === 'delivered' && oldStatus !== 'delivered';
    
    if (!isDeliveredStatusChange) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'not_delivered_status_change' });
    }

    if (!phoneRaw) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'no_phone_number' });
    }

    let chatId;
    try {
      chatId = toChatId(phoneRaw);
    } catch (phoneError) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'invalid_phone_format' });
    }

    if (!process.env.WAHA_API_URL) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'waha_not_configured' });
    }

    try {
      const healthCheck = await fetch(`${process.env.WAHA_API_URL}/api/sessions`, {
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

    try {
      await sendMessageSequence(chatId, message);
      
      // Increment counter after successful send
      incrementNotificationCount();
      
      return NextResponse.json({ ok: true, sent: true, awb: awb_number });
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
    `Halo${name ? ` ${name}` : ''}, kiriman Anda dari BCE Express ${awb} telah diterima. Terima kasih sudah mempercayakan pengiriman pada kami.`,
  (awb: string, name?: string) =>
    `Hai${name ? ` ${name}` : ''}! Paket dengan AWB ${awb} statusnya DELIVERED. Lihat detail tracking di bcexp.id.`,
  (awb: string, name?: string) =>
    `Hello${name ? ` ${name}` : ''}, Paket AWB ${awb} sudah sampai tujuan. Jika ada pertanyaan cek bcexp.id`,
  (awb: string, name?: string) =>
    `Salam${name ? ` ${name}` : ''}, paket Anda (AWB ${awb}) telah terkirim. Terima kasih!`
  ,(awb: string, name?: string) =>
    `Terima kasih${name ? ` ${name}` : ''} sudah menggunakan BCE Express, paket dengan nomor AWB ${awb} sudah diterima. Mohon simpan bukti penerimaan ini untuk referensi.`,
  (awb: string, name?: string) =>
    `Paket BCE Express Resi ${awb}${name ? ` untuk ${name}` : ''} telah berhasil dikirim dan diterima. Untuk pertanyaan terkait pengiriman hubungi admin pengiriman.`,
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
        // console.log(`Retry ${i + 1}/${retries} failed:`, lastError.message);
        
        // If response not OK, wait before retry
        await new Promise(r => setTimeout(r, 2000 * (i + 1)));
      } catch (err) {
        lastError = err as Error;
        // console.log(`Retry ${i + 1}/${retries} failed:`, err);
        
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

