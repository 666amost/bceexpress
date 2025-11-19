// app/api/whatsapp/notify-customer/route.ts
import { NextRequest, NextResponse } from 'next/server';

const MAX_DAILY_NOTIFICATIONS = Number(process.env.WA_MAX_DAILY_NOTIFICATIONS ?? 30);
const notificationLog = new Map<string, { count: number; resetAt: number }>();
const sentToCustomers = new Map<string, Set<string>>();

function canSendNotification(): boolean {
  const today = new Date().toISOString().split('T')[0];
  const log = notificationLog.get(today);
  const now = Date.now();

  if (!log || now > log.resetAt) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    notificationLog.set(today, { count: 0, resetAt: tomorrow.getTime() });
    sentToCustomers.clear();
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

function hasNotifiedCustomerToday(phone: string): boolean {
  const today = new Date().toISOString().split('T')[0];
  const todaySet = sentToCustomers.get(today);
  if (!todaySet) {
    sentToCustomers.set(today, new Set([phone]));
    return false;
  }
  return todaySet.has(phone);
}

function markCustomerNotified(phone: string) {
  const today = new Date().toISOString().split('T')[0];
  const todaySet = sentToCustomers.get(today);
  if (todaySet) {
    todaySet.add(phone);
  }
}

export async function POST(req: NextRequest) {
  // TEMPORARY CHANGE: disable this route so the bot only sends to group and auto-reply.
  // To re-enable, remove this early return.
  return NextResponse.json({ ok: true, skipped: true, reason: 'notify_customer_temporarily_disabled' });

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

    if (!awb_number.toUpperCase().startsWith('BCE')) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'not_bce_prefix' });
    }

    const isDeliveredStatusChange = status === 'delivered' && oldStatus !== 'delivered';
    
    if (!isDeliveredStatusChange) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'not_delivered_status_change' });
    }

    if (!phoneRaw) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'no_phone_number' });
    }

    const normalizedPhone = normalizePhone(phoneRaw);
    
    if (hasNotifiedCustomerToday(normalizedPhone)) {
      return NextResponse.json({ 
        ok: true, 
        skipped: true, 
        reason: 'customer_already_notified_today',
        phone: normalizedPhone.slice(0, 4) + '****'
      });
    }

    if (!canSendNotification()) {
      return NextResponse.json({ 
        ok: true, 
        skipped: true, 
        reason: 'daily_limit_reached',
        message: `Daily notification limit (${MAX_DAILY_NOTIFICATIONS}) reached`
      });
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
      const healthHeaders: Record<string, string> = {};
      const wahaKey = process.env.WAHA_API_KEY;
      if (wahaKey) healthHeaders['X-Api-Key'] = wahaKey as string;

      const healthCheck = await fetch(`${process.env.WAHA_API_URL}/api/sessions`, {
        headers: Object.keys(healthHeaders).length ? healthHeaders : undefined
      });

      if (!healthCheck.ok) {
        return NextResponse.json({ ok: true, warning: 'WAHA service unavailable' });
      }
    } catch (error) {
      return NextResponse.json({ ok: true, warning: 'WAHA connection failed' });
    }

    const message = buildDeliveredMsg(awb_number, receiverNameRaw);

    try {
      await sendMessageSequence(chatId, message);
      
      incrementNotificationCount();
      markCustomerNotified(normalizedPhone);
      
      return NextResponse.json({ 
        ok: true, 
        sent: true, 
        awb: awb_number,
        phone: normalizedPhone.slice(0, 4) + '****'
      });
    } catch (error) {
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
function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (!digits) return '';

  // Local Indonesian formats
  if (digits.startsWith('0')) return '62' + digits.slice(1);
  if (digits.startsWith('62')) return digits;
  // Mobile local without leading 0 (e.g. 812345...) -> assume local
  if (digits.startsWith('8')) return '62' + digits;

  // If it looks like a full international number (length >= 10), keep as-is
  if (digits.length >= 10) return digits;

  // Fallback: return digits (do not force-prepend 62)
  return digits;
}

function toChatId(phone: string): string {
  const digits = normalizePhone(phone);

  if (!digits) throw new Error(`Invalid phone number format: ${phone} -> empty after normalization`);

  // Accept reasonable international lengths (8-15 digits)
  if (digits.length < 8 || digits.length > 15) {
    throw new Error(`Invalid phone number format: ${phone} (${digits})`);
  }

  return `${digits}@c.us`;
}

async function sendMessageSequence(chatId: string, text: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const wahaKey2 = process.env.WAHA_API_KEY;
  if (wahaKey2) headers['X-Api-Key'] = wahaKey2 as string;
  const session = process.env.WAHA_SESSION_CUSTOMER || 'bot_customer';

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

    // Optionally emulate typing (configurable). Keep typing short to avoid timeouts.
    const enableTyping = (process.env.WA_ENABLE_TYPING ?? '1') === '1';
    if (enableTyping) {
      await retryFetch(`${process.env.WAHA_API_URL}/api/startTyping`,
        { method: 'POST', headers, body: JSON.stringify({ chatId, session }) });

      const minDelay = Number(process.env.WA_TYPING_MIN_MS ?? 300);
      const maxDelay = Number(process.env.WA_TYPING_MAX_MS ?? 1000);
      await randomDelay(minDelay, maxDelay);

      await retryFetch(`${process.env.WAHA_API_URL}/api/stopTyping`,
        { method: 'POST', headers, body: JSON.stringify({ chatId, session }) });
    }

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

