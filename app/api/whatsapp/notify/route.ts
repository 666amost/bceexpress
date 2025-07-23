import { NextRequest, NextResponse } from 'next/server';

// Tambahkan queue untuk menangani pesan
let messageQueue: {phoneOrGroup: string, message: string}[] = [];
let isProcessing = false;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const authorization = req.headers.get('authorization');
    const { type, record, old_record } = body;

    // Validasi environment variables
    if (!process.env.WA_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    if (authorization !== process.env.WA_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Validasi data yang diperlukan
    if (!record || !record.awb_number || !record.status) {
      return NextResponse.json({ error: 'Invalid record data' }, { status: 400 });
    }

    // Trigger hanya jika status delivered
    if (
      (type === 'INSERT' && record.status === 'delivered') ||
      (type === 'UPDATE' && record.status === 'delivered' && old_record?.status !== 'delivered')
    ) {
      // Validasi environment variables untuk WhatsApp
      if (!process.env.WAHA_API_URL || !process.env.WA_GROUP_ID) {
        // Return success but log error - don't fail the webhook
        return NextResponse.json({ ok: true, warning: 'WhatsApp notification skipped - environment not configured' });
      }

      const awb = record.awb_number;
      const status = record.status;
      const note = record.notes || '';

      const groupId = process.env.WA_GROUP_ID.endsWith('@g.us')
        ? process.env.WA_GROUP_ID
        : process.env.WA_GROUP_ID + '@g.us';
      // Ubah format pesan tanpa 'Paket Terkirim!'
      const text = `AWB: ${awb}\nStatus: ${status}\nNote: ${note}`;

      // Tambahkan pesan ke queue
      messageQueue.push({ phoneOrGroup: groupId, message: text });
      
      // Mulai proses queue jika belum berjalan
      if (!isProcessing) {
        processMessageQueue();
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function sendMessageSequence(phoneOrGroup: string, message: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (process.env.WAHA_API_KEY) {
    headers['X-Api-Key'] = process.env.WAHA_API_KEY;
  }
  // 1. Send seen
  await fetch(`${process.env.WAHA_API_URL}/api/sendSeen`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      chatId: phoneOrGroup,
      session: process.env.WAHA_SESSION || 'default',
    })
  });
  // 2. Start typing
  await fetch(`${process.env.WAHA_API_URL}/api/startTyping`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      chatId: phoneOrGroup,
      session: process.env.WAHA_SESSION || 'default',
    })
  });
  // 3. Wait random 30-60 seconds
  await randomDelay(30000, 60000);
  // 4. Stop typing
  await fetch(`${process.env.WAHA_API_URL}/api/stopTyping`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      chatId: phoneOrGroup,
      session: process.env.WAHA_SESSION || 'default',
    })
  });
  // 5. Send text message
  const res = await fetch(`${process.env.WAHA_API_URL}/api/sendText`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      chatId: phoneOrGroup,
      text: message,
      session: process.env.WAHA_SESSION || 'default',
      reply_to: null,
      linkPreview: true,
      linkPreviewHighQuality: false
    })
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`WhatsApp API error: ${res.status} - ${errorText}`);
  }
  return res.json();
}

function randomDelay(min: number, max: number) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processMessageQueue() {
  if (isProcessing || messageQueue.length === 0) return;
  
  isProcessing = true;
  
  while (messageQueue.length > 0) {
    const message = messageQueue[0];
    try {
      await sendMessageSequence(message.phoneOrGroup, message.message);
      // Tunggu 5 detik sebelum mengirim pesan berikutnya
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error) {
      console.error('Error sending message:', error);
    }
    messageQueue.shift(); // Hapus pesan yang sudah diproses
  }
  
  isProcessing = false;
} 