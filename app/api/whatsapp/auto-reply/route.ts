// app/api/whatsapp/auto-reply/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
}
interface WahaWebhookBody {
  event: 'message' | 'ack' | 'presence' | string;
  session: string;
  payload: MessageData;
}

interface ShipmentData {
  awb_number: string;
  current_status: string;
  notes: string | null;
  receiver_name: string | null;
  receiver_phone: string | null;
  origin: string | null;
  destination: string | null;
  created_at: string;
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

    // Ignore non-message events or messages without text
    if (body.event !== 'message' || !body.payload?.body) {
      return NextResponse.json({ ok: true, info: `Event '${body.event}' ignored` });
    }

    const { from, fromMe } = body.payload;
    const messageText = (body.payload.body || '').trim();
    
    // Skip messages from bot or group chats
    if (fromMe || from.endsWith('@g.us')) {
      return NextResponse.json({ ok: true, info: 'Message from bot or group chat, skipped' });
    }

    // Check if message contains AWB number (BCE* or BE*)
    const awbMatch = messageText.match(/\b(BCE|BE)[A-Z0-9]{8,}\b/i);
    
    if (awbMatch) {
      const awbNumber = awbMatch[0].toUpperCase();
      
      try {
        const shipmentData = await getShipmentByAWB(awbNumber);
        
        if (shipmentData) {
          const replyText = formatShipmentInfo(shipmentData);
          await sendTextSafe(from, replyText);
          
          return NextResponse.json({ 
            ok: true, 
            info: `Shipment info sent for AWB: ${awbNumber}` 
          });
        } else {
          const notFoundText = `Nomor resi ${awbNumber} tidak ditemukan.\n\nPastikan nomor resi benar atau hubungi admin pengiriman untuk bantuan.`;
          await sendTextSafe(from, notFoundText);
          
          return NextResponse.json({ 
            ok: true, 
            info: `AWB not found: ${awbNumber}` 
          });
        }
      } catch (dbError) {
        const errorText = `Maaf, terjadi kesalahan saat mengambil data resi ${awbNumber}.\n\nSilakan coba lagi atau hubungi admin pengiriman.`;
        await sendTextSafe(from, errorText);
        
        return NextResponse.json({ 
          ok: true, 
          warning: 'Database error when fetching shipment',
          error: dbError instanceof Error ? dbError.message : String(dbError)
        });
      }
    }

    // No AWB detected - send welcome message with rate limiting

    // Check and update user message count
    const normalizedFrom = normalizePhoneNumber(from.replace('@c.us', ''));
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
      replyText = `Halo! Terima kasih telah menggunakan BCE EXPRESS 📦

Untuk cek resi paket Anda, silakan ketik nomor resi (contoh: BCE12345678 atau BE12345678)

Info penting:
• Bukti POD & tracking: bcexp.id
• Pertanyaan pengiriman: Hubungi admin di area pengiriman

⚠️ Mohon jangan telepon, ini adalah sistem otomatis.

TERIMA KASIH! 🙏`;
    } else {
      replyText = `Untuk pertanyaan pengiriman hubungi Admin di area pengiriman.

WhatsApp ini hanya chat otomatis untuk:
✅ Cek status resi (ketik nomor resi)
✅ Laporan paket diterima

Tracking paket lengkap: bcexp.id

TERIMA KASIH! 🙏`;
    }

    try {
      await sendTextSafe(from, replyText); // fast send, no typing/delay to avoid 524
    } catch (sendError) {
      // Log error but still return success to prevent retry loops
      // Return 200 OK even for WAHA API errors
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

// ================== Shipment Database Functions ==================
async function getShipmentByAWB(awbNumber: string): Promise<ShipmentData | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('shipments')
    .select('awb_number, current_status, notes, receiver_name, receiver_phone, origin, destination, created_at')
    .eq('awb_number', awbNumber)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return data as ShipmentData;
}

function formatShipmentInfo(shipment: ShipmentData): string {
  const statusEmoji = getStatusEmoji(shipment.current_status);
  const formattedStatus = shipment.current_status.toUpperCase();
  
  let message = `📦 *INFORMASI RESI*\n\n`;
  message += `Nomor Resi: *${shipment.awb_number}*\n`;
  message += `Status: ${statusEmoji} *${formattedStatus}*\n`;
  
  if (shipment.origin) {
    message += `Asal: ${shipment.origin}\n`;
  }
  
  if (shipment.destination) {
    message += `Tujuan: ${shipment.destination}\n`;
  }
  
  if (shipment.receiver_name && !shipment.receiver_name.toLowerCase().includes('auto generated')) {
    message += `Penerima: ${shipment.receiver_name}\n`;
  }
  
  if (shipment.notes) {
    message += `\n📝 Catatan:\n${shipment.notes}\n`;
  }
  
  message += `\n🌐 Tracking lengkap: bcexp.id`;
  message += `\n\n💬 Pertanyaan? Hubungi admin pengiriman`;
  
  return message;
}

function getStatusEmoji(status: string): string {
  const statusLower = status.toLowerCase();
  
  if (statusLower.includes('delivered')) return '✅';
  if (statusLower.includes('transit') || statusLower.includes('in transit')) return '🚚';
  if (statusLower.includes('picked') || statusLower.includes('pickup')) return '📥';
  if (statusLower.includes('pending')) return '⏳';
  if (statusLower.includes('returned')) return '↩️';
  if (statusLower.includes('cancelled')) return '❌';
  
  return '📍';
}

/**
 * Send text quickly to WAHA without long delays/typing to prevent CF 524 timeout.
 * We add a local timeout using AbortController and log WAHA responses.
 */
async function sendTextSafe(phoneOrGroup: string, text: string) {
  // Exit early if WAHA not configured
  if (!process.env.WAHA_API_URL) {
    throw new Error('WAHA_API_URL not configured');
  }
  
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.WAHA_API_KEY) headers['X-Api-Key'] = process.env.WAHA_API_KEY;

  const chatId = /@(c|g)\.us$/.test(phoneOrGroup)
    ? phoneOrGroup
    : `${normalizePhoneNumber(phoneOrGroup)}@c.us`;

  const session = process.env.WAHA_SESSION || 'default';

  // Use a shorter timeout for webhook calls to prevent 524 errors
  const controller = new AbortController();
  const timeoutMs = Number(process.env.WAHA_TIMEOUT_MS ?? 8000); // 8s default, faster than previous 15s
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let retryCount = 0;
  const maxRetries = 1; // Only retry once for webhook calls
  
  try {
    while (true) {
      try {
        const res = await fetch(`${process.env.WAHA_API_URL}/api/sendText`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ 
            chatId, 
            text, 
            session,
            linkPreview: false // Disable link preview to speed up responses
          }),
          signal: controller.signal
        });

        let bodyText = '';
        try {
          bodyText = await res.text();
        } catch (e) {
          // If we can't get response text, continue with empty response
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
        
        // Wait briefly before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } finally {
    clearTimeout(timer);
  }
}
