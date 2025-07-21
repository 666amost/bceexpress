import { NextRequest, NextResponse } from 'next/server';

// ===================================================================
// BAGIAN 1: INTERFACE (TIPE) YANG LEBIH AKURAT UNTUK WAHA
// ===================================================================

// Mendefinisikan struktur data untuk pesan yang masuk
interface MessageData {
  from: string;      // Nomor pengirim (e.g., "6281234567890@c.us")
  fromMe: boolean;   // Apakah pesan dari bot itu sendiri?
  body?: string;      // Isi pesan teks (opsional, karena bisa jadi gambar/stiker)
}

// Mendefinisikan struktur utama dari body webhook WAHA
interface WahaWebhookBody {
  event: 'message' | 'ack' | 'presence' | string; // Tipe event yang dikirim
  session: string;
  data: MessageData; // Data payload, spesifik untuk event 'message'
}

// ===================================================================
// BAGIAN 2: FUNGSI UTAMA WEBHOOK (POST HANDLER)
// ===================================================================

export async function POST(req: NextRequest) {
  try {
    const body: WahaWebhookBody = await req.json();

    // --- PERBAIKAN UTAMA: Periksa tipe event ---
    // Hanya proses jika event adalah 'message' dan ada isi pesannya.
    if (body.event !== 'message' || !body.data || !body.data.body) {
      // Jika ini event lain (ack, presence, dll) atau bukan pesan teks,
      // abaikan dengan mengirim respons sukses. Ini akan menghentikan error 400.
      console.log(`Event '${body.event}' diterima dan diabaikan.`);
      return NextResponse.json({ ok: true, info: `Event '${body.event}' ignored.` });
    }

    // Dari sini, kita tahu ini adalah pesan teks yang valid.
    const { from, fromMe } = body.data;

    // Jangan balas pesan dari bot sendiri
    if (fromMe) {
      return NextResponse.json({ ok: true, info: 'Message from bot, not replying.' });
    }

    // --- LOGIKA AUTO-REPLY SEDERHANA ---
    // Kirim balasan standar untuk setiap pesan yang masuk.
    const replyText = 'Untuk pertanyaan mengenai pengiriman bisa hubungi Admin di area pengiriman.\n\nWhatsapp ini hanya chat otomatis untuk laporan paket diterima.';
    await sendMessageSequence(from, replyText);

    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error("Error in webhook handler:", error);
    return NextResponse.json({ error: 'Internal server error', details: error instanceof Error ? error.message : error }, { status: 500 });
  }
}

// ===================================================================
// BAGIAN 3: FUNGSI PEMBANTU (HELPER FUNCTIONS)
// ===================================================================

// Fungsi normalisasi nomor WA (sudah bagus, tidak perlu diubah)
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

// Fungsi untuk mengirim pesan (sudah bagus, tidak perlu diubah)
async function sendMessageSequence(phoneOrGroup: string, message: string) {
  // Delay 10-30 detik agar lebih aman
  const typingDelay = Math.floor(Math.random() * (30000 - 10000 + 1)) + 10000;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (process.env.WAHA_API_KEY) {
    headers['X-Api-Key'] = process.env.WAHA_API_KEY;
  }

  // Pastikan chatId selalu format @c.us
  const chatId = phoneOrGroup.includes('@c.us') ? phoneOrGroup : `${normalizePhoneNumber(phoneOrGroup)}@c.us`;
  const session = process.env.WAHA_SESSION || 'default';

  await fetch(`${process.env.WAHA_API_URL}/api/sendSeen`, {
    method: 'POST', headers, body: JSON.stringify({ chatId, session })
  });
  await fetch(`${process.env.WAHA_API_URL}/api/startTyping`, {
    method: 'POST', headers, body: JSON.stringify({ chatId, session })
  });
  await new Promise(resolve => setTimeout(resolve, typingDelay));
  await fetch(`${process.env.WAHA_API_URL}/api/stopTyping`, {
    method: 'POST', headers, body: JSON.stringify({ chatId, session })
  });

  const res = await fetch(`${process.env.WAHA_API_URL}/api/sendText`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ chatId, text: message, session })
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`WhatsApp API error: ${res.status} - ${errorText}`);
    // Tidak melempar error agar proses utama tidak berhenti total
  }
  return res.json();
} 