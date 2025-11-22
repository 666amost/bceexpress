// app/api/whatsapp/auto-reply/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ORIGINS, DESTINATIONS_BY_ORIGIN, calculatePrice, type OriginCode } from '@/lib/pricing';

// Add OPTIONS method to handle pre-flight checks
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

// Add GET method for health checks
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'whatsapp-auto-reply',
    timestamp: new Date().toISOString()
  });
}

// ================== Types ==================
interface MessageData {
  from: string;
  fromMe: boolean;
  body?: string;
  source?: string;
  id?: string;
}
interface WahaWebhookBody {
  event: 'message' | 'ack' | 'presence' | string;
  session: string;
  payload: MessageData;
}

interface ShipmentData {
  awb_number: string;
  status: string;
  location: string | null;
  notes: string | null;
}

// ================== Supabase Client ==================
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration missing');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// ================== Rate Limiting ==================
// Simple in-memory store for tracking user message counts
// In production, consider using Redis or database for persistence
const userMessageCount: Map<string, { count: number; lastMessage: number }> = new Map();
const MAX_REPLIES = 3;
const RESET_AFTER_HOURS = 24; // Reset count after 24 hours
// Short-lived dedupe cache to ignore duplicate webhook events for the same incoming message
// Keyed by message id (if provided) or fallback to `from|body` signature. Entries expire quickly.
const recentIncomingMessages: Map<string, number> = new Map();
const RECENT_MSG_TTL_MS = 60 * 1000; // 60s

// ================== Handler ==================
export async function POST(req: NextRequest) {
  try {
    // Body must be read ONCE to avoid "Body is unusable" errors
    let body: WahaWebhookBody;
    
    try {
      const raw = await req.text();
      body = JSON.parse(raw);
    } catch (parseError) {
      // Return 200 OK even for parsing errors to prevent retry loops
      return NextResponse.json({ ok: true, skipped: true, reason: 'invalid_payload' });
    }

    // Prune expired entries from recentIncomingMessages (simple cleanup)
    const nowTs = Date.now();
    recentIncomingMessages.forEach((ts, k) => {
      if (nowTs - ts > RECENT_MSG_TTL_MS) recentIncomingMessages.delete(k);
    });

    // Ignore non-message events or messages without text
    if (!body.event || !body.event.startsWith('message') || !body.payload?.body) {
      return NextResponse.json({ ok: true, info: `Event '${body.event}' ignored` });
    }

    // Deduplicate multiple webhook events for the same incoming message.
    // Use payload.id when available (WAHA typically provides message id). Fallback to from|body signature.
    const incomingId = body.payload?.id ? String(body.payload.id) : `${body.payload?.from || ''}|${(body.payload?.body || '').slice(0,200)}`;
    if (incomingId) {
      if (recentIncomingMessages.has(incomingId)) {
        return NextResponse.json({ ok: true, skipped: true, reason: 'duplicate_event' });
      }
      recentIncomingMessages.set(incomingId, nowTs);
    }

    const { from, fromMe, id: messageId } = body.payload;
    const messageText = (body.payload.body || '').trim();
    // Debug: log incoming payload key info to help map JIDs -> phone numbers
    try {
      console.log('WA webhook payload key:', JSON.stringify((body.payload as any)._data?.key || body.payload));
    } catch (e) {
      // ignore logging errors
    }

    // Derive reply chat id and normalized phone (used for sends and rate-limiting)
    const _replyTarget = deriveReplyTarget(body.payload as any);
    const replyChatId = _replyTarget.chatId;
    // keep `from` variable but use `normalizedFrom` from replyTarget for rate-limiting
    const _normalizedFromFallback = normalizePhoneNumber(String(from || '').replace('@c.us', ''));
    // we'll set normalizedFrom later (after message flows) using replyTarget.phone where appropriate
    
    // Skip messages from bot, group chats, or API-sent messages
    // IMPORTANT: source='api' means message was sent by bot via API
    if (fromMe || from.endsWith('@g.us') || body.payload.source === 'api') {
      return NextResponse.json({ 
        ok: true, 
        info: 'Message from bot/group/api, skipped',
        debug: { fromMe, from, source: body.payload.source }
      });
    }

    // Check if message contains AWB number (BCE* or BE*)
    // Match: BCE or BE followed by 5-15 digits/letters (case insensitive)
    const awbMatch = messageText.match(/\b(BCE|BE)[A-Z0-9]{5,15}\b/i);
    
    if (awbMatch) {
      const awbNumber = awbMatch[0].toUpperCase();
      
      try {
        const shipmentData = await getShipmentByAWB(awbNumber);
        
        if (shipmentData) {
          const replyText = formatShipmentInfo(shipmentData);
          await sendTextSafe(replyChatId, replyText, messageId);
          
          return NextResponse.json({ 
            ok: true, 
            info: `Shipment info sent for AWB: ${awbNumber}` 
          });
        } else {
          const notFoundText = `Nomor resi ${awbNumber} tidak ditemukan.\n\nPastikan nomor resi benar atau hubungi admin pengiriman untuk bantuan.`;
          await sendTextSafe(replyChatId, notFoundText, messageId);
          
          return NextResponse.json({ 
            ok: true, 
            info: `AWB not found: ${awbNumber}` 
          });
        }
      } catch (dbError) {
        const errorText = `Maaf, terjadi kesalahan saat mengambil data resi ${awbNumber}.\n\nSilakan coba lagi atau hubungi admin pengiriman.`;
        await sendTextSafe(replyChatId, errorText, messageId);
        
        return NextResponse.json({ 
          ok: true, 
          warning: 'Database error when fetching shipment',
          error: dbError instanceof Error ? dbError.message : String(dbError)
        });
      }
    }

    // Check for "cek ongkir" keywords
    const messageLower = messageText.toLowerCase();
    
    // Format: "ongkir jakarta bali 5" or "ongkir bangka bekasi 2.5"
    const ongkirMatch = messageLower.match(/^(?:cek\s+)?ongkir\s+(\w+)\s+(.+?)\s+([\d.]+)$/i);
    
    if (ongkirMatch) {
      const [, asalRaw, tujuanRaw, beratRaw] = ongkirMatch;
      const berat = parseFloat(beratRaw);
      
      if (berat <= 0 || isNaN(berat)) {
        await sendTextSafe(replyChatId, '❌ Berat harus lebih dari 0 kg');
        return NextResponse.json({ ok: true, info: 'Invalid weight' });
      }
      
      try {
        const ongkirResult = await calculateOngkir(asalRaw, tujuanRaw, berat);
        await sendTextSafe(replyChatId, ongkirResult, messageId);
        return NextResponse.json({ ok: true, info: 'Ongkir calculated' });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        await sendTextSafe(replyChatId, errorMsg, messageId);
        return NextResponse.json({ ok: true, info: 'Ongkir error', error: errorMsg });
      }
    }
    
    // Keyword "cek ongkir" tanpa format lengkap
    if (messageLower.includes('cek ongkir') || messageLower.includes('ongkir') || messageLower.includes('harga kirim')) {
      const ongkirText = `📦 CEK ONGKIR BCE EXPRESS

Format: ongkir [asal] [tujuan] [berat]

Contoh:
• ongkir jakarta bangka 5
• ongkir bangka bekasi 2.5
• ongkir tanjung pandan jakarta 10

Kota yang tersedia:
📍 Asal: Jakarta, Bangka, Tanjung Pandan
📍 Tujuan: Lihat di bcexp.id

Atau kunjungi: https://bcexp.id

TERIMA KASIH! 🙏`;
      
      try {
        await sendTextSafe(replyChatId, ongkirText, messageId);
        return NextResponse.json({ ok: true, info: 'Ongkir info sent' });
      } catch (sendError) {
        return NextResponse.json({ 
          ok: true, 
          warning: 'Failed to send ongkir info',
          error: sendError instanceof Error ? sendError.message : String(sendError)
        });
      }
    }

    // No AWB detected - send welcome message with rate limiting

    // Check and update user message count
    // Prefer the phone extracted from webhook (replyTarget.phone) when available
    const normalizedFrom = (_replyTarget && _replyTarget.phone) ? _replyTarget.phone : normalizePhoneNumber(from.replace('@c.us', ''));
    const now = Date.now();
    const userKey = normalizedFrom;
    
    // Get or initialize user count
    let userData = userMessageCount.get(userKey);
    if (!userData) {
      userData = { count: 0, lastMessage: now };
      userMessageCount.set(userKey, userData);
    }
    
    // Reset count if it's been more than 24 hours since last message
    const hoursSinceLastMessage = (now - userData.lastMessage) / (1000 * 60 * 60);
    if (hoursSinceLastMessage >= RESET_AFTER_HOURS) {
      userData.count = 0;
    }
    
    // Check if user has exceeded max replies
    if (userData.count >= MAX_REPLIES) {
      return NextResponse.json({ 
        ok: true, 
        info: `User ${normalizedFrom} has reached max replies (${MAX_REPLIES}), skipping` 
      });
    }
    
    // Increment count and update timestamp
    userData.count++;
    userData.lastMessage = now;
    userMessageCount.set(userKey, userData);

    // Choose reply text based on message count
    let replyText: string;
    if (userData.count === 1) {
      // PESAN PERTAMA - Welcome message
      replyText = `Halo! Terima kasih telah menggunakan BCE EXPRESS 📦

Untuk cek resi paket Anda, silakan ketik nomor resi.
Contoh: BCE12345678 atau BE12345678

Untuk cek ongkir, ketik: "cek ongkir"

Info penting:
• Bukti POD & tracking lengkap: bcexp.id
• Pertanyaan pengiriman: Hubungi admin di area pengiriman

⚠️ Mohon jangan telepon, ini adalah sistem otomatis.

TERIMA KASIH! 🙏`;
    } else {
      // PESAN KEDUA/KETIGA - Reminder message
      replyText = `Untuk pertanyaan pengiriman hubungi Admin di area pengiriman.

WhatsApp ini hanya chat otomatis untuk:
✅ Cek status resi (ketik nomor resi)
✅ Cek ongkir (ketik "cek ongkir")

Tracking paket lengkap: bcexp.id

TERIMA KASIH! 🙏`;
    }

    try {
      await sendTextSafe(replyChatId, replyText, messageId);
    } catch (sendError) {
      return NextResponse.json({ 
        ok: true, 
        warning: 'Failed to send message but webhook accepted',
        error: sendError instanceof Error ? sendError.message : String(sendError)
      });
    }
    
    return NextResponse.json({ 
      ok: true, 
      info: `Reply sent (${userData.count}/${MAX_REPLIES})` 
    });
  } catch (err: unknown) {
    // Return 200 OK even for other errors to prevent retry loops
    return NextResponse.json({ 
      ok: true, 
      error: 'Error processing webhook', 
      details: err instanceof Error ? err.message : String(err) 
    });
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

// Derive a reply chatId and normalized phone from various webhook fields.
function deriveReplyTarget(payload: any): { chatId: string; phone: string } {
  // Prefer the provider's stable whatsapp JID if available (example: remoteJidAlt = '62812...@s.whatsapp.net')
  const alt = payload?._data?.key?.remoteJidAlt || payload?._data?.key?.remoteJid;
  if (typeof alt === 'string') {
    // If it's an s.whatsapp.net jid, convert to c.us (the WAHA API expects @c.us)
    if (/@s\.whatsapp\.net$/.test(alt)) {
      const phone = alt.replace(/@s\.whatsapp\.net$/, '').replace(/\D/g, '');
      const normalized = normalizePhoneNumber(phone);
      return { chatId: `${normalized}@c.us`, phone: normalized };
    }
    // If it's already a c.us/g.us/lid style jid, try to extract digits and normalize
    const cleaned = String(alt).replace(/@.*/, '');
    const digits = cleaned.replace(/\D/g, '');
    const normalized = normalizePhoneNumber(digits);
    return { chatId: `${normalized}@c.us`, phone: normalized };
  }

  // Fallback to payload.from
  const from = String(payload?.from || '');
  // If payload.from already ends with @c.us or @g.us, use as-is (but prefer numeric chat id)
  if (/@(c|g)\.us$/.test(from)) {
    const digits = from.replace(/@.*/, '').replace(/\D/g, '');
    const normalized = normalizePhoneNumber(digits);
    return { chatId: `${normalized}@c.us`, phone: normalized };
  }

  // Last-resort: strip domain and non-digits then normalize
  const digits = from.replace(/@.*/, '').replace(/\D/g, '');
  const normalized = normalizePhoneNumber(digits);
  return { chatId: `${normalized}@c.us`, phone: normalized };
}

// ================== Ongkir Calculator ==================
async function calculateOngkir(asalRaw: string, tujuanRaw: string, berat: number): Promise<string> {
  // Normalize asal
  const asalNormalized = asalRaw.toLowerCase().trim();
  let originCode: OriginCode | null = null;
  
  if (asalNormalized.includes('jakarta')) {
    originCode = 'DKI_JAKARTA';
  } else if (asalNormalized.includes('bangka')) {
    originCode = 'BANGKA';
  } else if (asalNormalized.includes('tanjung') || asalNormalized.includes('pandan')) {
    originCode = 'TANJUNG_PANDAN';
  }
  
  if (!originCode) {
    return `❌ Kota asal "${asalRaw}" tidak tersedia.

Kota asal yang tersedia:
• Jakarta
• Bangka
• Tanjung Pandan`;
  }
  
  // Get destinations for origin
  const destinations = DESTINATIONS_BY_ORIGIN[originCode];
  const tujuanNormalized = tujuanRaw.toLowerCase().trim();
  
  // Find matching destination
  const destination = destinations.find(d => 
    d.label.toLowerCase().includes(tujuanNormalized) ||
    d.code.toLowerCase().includes(tujuanNormalized.replace(/\s+/g, '_'))
  );
  
  if (!destination) {
    const availableCities = destinations
      .map(d => d.label.split(' / ')[1] || d.label)
      .slice(0, 5)
      .join('\n• ');
      
    return `❌ Kota tujuan "${tujuanRaw}" tidak ditemukan.

Beberapa kota tujuan tersedia:
• ${availableCities}
...

Cek lengkap: bcexp.id`;
  }
  
  // Calculate price
  const calc = calculatePrice(destination.pricePerKg, berat);
  const originLabel = ORIGINS.find(o => o.code === originCode)?.label || asalRaw;
  const tujuanLabel = destination.label.split(' / ')[1] || destination.label;
  
  return `📦 ONGKIR ${originLabel} → ${tujuanLabel}

Berat: ${calc.berat} kg
Tarif/kg: Rp ${destination.pricePerKg.toLocaleString('id-ID')}
Subtotal: Rp ${calc.subtotal.toLocaleString('id-ID')}
${calc.adminFee > 0 ? `Admin: Rp ${calc.adminFee.toLocaleString('id-ID')}\n` : ''}
💰 Total: Rp ${calc.total.toLocaleString('id-ID')}

Detail lengkap: bcexp.id`;
}

// ================== Shipment Database Functions ==================
async function getShipmentByAWB(awbNumber: string): Promise<ShipmentData | null> {
  const supabase = getSupabaseClient();
  
  // Try shipment_history first (latest status) - this is where webhook updates go
  let { data, error } = await supabase
    .from('shipment_history')
    .select('awb_number, status, location, notes')
    .eq('awb_number', awbNumber)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // If not found in history, try case-insensitive search
  if (!data && !error) {
    const historyResult = await supabase
      .from('shipment_history')
      .select('awb_number, status, location, notes')
      .ilike('awb_number', awbNumber)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
  
    data = historyResult.data;
    error = historyResult.error;
  }

  // If still not found, check manifest_cabang (warehouse data)
  if (!data && !error) {
    const manifestResult = await supabase
      .from('manifest_cabang')
      .select('awb_no, origin_branch, created_at')
      .or(`awb_no.eq.${awbNumber},awb_no.ilike.${awbNumber}`)
      .maybeSingle();

    if (manifestResult.data) {
      const warehouseLocation = manifestResult.data.origin_branch?.toLowerCase().includes('bangka')
        ? 'WAREHOUSE_BANGKA'
        : manifestResult.data.origin_branch?.toLowerCase().includes('tanjung')
        ? 'WAREHOUSE_TJQ'
        : `WAREHOUSE_${manifestResult.data.origin_branch?.toUpperCase() || 'UNKNOWN'}`;

      return {
        awb_number: manifestResult.data.awb_no,
        status: 'processed',
        location: warehouseLocation,
        notes: `Package at ${manifestResult.data.origin_branch || 'branch'} warehouse`
      };
    }
  }

  if (error || !data) {
    return null;
  }
  
  return data as ShipmentData;
}

function formatShipmentInfo(shipment: ShipmentData): string {
  const formattedStatus = shipment.status.charAt(0).toUpperCase() + shipment.status.slice(1);
  
  let message = `AWB: ${shipment.awb_number}\n`;
  message += `Status: ${formattedStatus}\n`;
  
  if (shipment.location) {
    message += `Lok: ${shipment.location}\n`;
  }
  
  if (shipment.notes) {
    message += `Note: ${shipment.notes}`;
  }
  
  return message;
}

/**
 * Send text quickly to WAHA without long delays/typing to prevent CF 524 timeout.
 * We add a local timeout using AbortController and log WAHA responses.
 */
async function sendTextSafe(phoneOrGroup: string, text: string, replyToMessageId?: string) {
  if (!process.env.WAHA_API_URL) {
    throw new Error('WAHA_API_URL not configured');
  }
  
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.WAHA_API_KEY) headers['X-Api-Key'] = process.env.WAHA_API_KEY;

  const chatId = /@(c|g)\.us$/.test(phoneOrGroup)
    ? phoneOrGroup
    : `${normalizePhoneNumber(phoneOrGroup)}@c.us`;

  const session = process.env.WAHA_SESSION_CUSTOMER || 'bot_customer';

  const controller = new AbortController();
  const timeoutMs = Number(process.env.WAHA_TIMEOUT_MS ?? 8000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let retryCount = 0;
  const maxRetries = 1;
  
  try {
    while (true) {
      try {
        // Optionally emulate typing to make replies more natural.
        // Keep typing short to avoid hitting request timeout.
        const enableTyping = (process.env.WA_ENABLE_TYPING ?? '0') === '1';
        if (enableTyping) {
          try {
            // startTyping
            await fetch(`${process.env.WAHA_API_URL}/api/startTyping`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ chatId, session }),
              signal: controller.signal
            });

            const typingDelayMin = Number(process.env.WA_TYPING_MIN_MS ?? 300);
            const typingDelayMax = Number(process.env.WA_TYPING_MAX_MS ?? 1000);
            await new Promise(r => setTimeout(r, Math.floor(Math.random() * (typingDelayMax - typingDelayMin + 1)) + typingDelayMin));

            // stopTyping
            await fetch(`${process.env.WAHA_API_URL}/api/stopTyping`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ chatId, session }),
              signal: controller.signal
            });
          } catch (e) {
            // typing emulation failed — ignore and continue to send text
          }
        }

        const requestBody: Record<string, unknown> = { 
          chatId, 
          text, 
          session,
          linkPreview: false
        };

        if (replyToMessageId) {
          requestBody.reply_to = replyToMessageId;
        }

        const res = await fetch(`${process.env.WAHA_API_URL}/api/sendText`, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        let bodyText = '';
        try {
          bodyText = await res.text();
        } catch (e) {
          // ignore
        }

        if (!res.ok) {
          throw new Error(`WAHA ${res.status}: ${bodyText || 'No response body'}`);
        }
        
        return bodyText ? JSON.parse(bodyText) : { success: true };
      } catch (error) {
        retryCount++;
        
        if (retryCount > maxRetries) {
          throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } finally {
    clearTimeout(timer);
  }
}
