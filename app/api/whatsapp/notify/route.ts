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
  const session = process.env.WAHA_SESSION || 'default';
  console.log(`[WA] Starting message sequence for ${phoneOrGroup}`);

  try {
    // 1. Send seen with retry and timeout
    await retryOperation(async () => {
      console.log(`[WA] Sending seen to ${phoneOrGroup}`);
      const response = await fetchWithTimeout(
        `${process.env.WAHA_API_URL}/api/sendSeen`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ chatId: phoneOrGroup, session })
        },
        3000
      );
      if (!response.ok) throw new Error(await response.text());
    }, 2, 1000);

    // 2. Start typing
    console.log(`[WA] Starting typing for ${phoneOrGroup}`);
    await fetchWithTimeout(
      `${process.env.WAHA_API_URL}/api/startTyping`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ chatId: phoneOrGroup, session })
      },
      3000
    );

    // 3. Wait random 5-10 seconds
    const delay = Math.floor(Math.random() * (10000 - 5000 + 1)) + 5000;
    console.log(`[WA] Waiting ${delay}ms before sending message`);
    await new Promise(resolve => setTimeout(resolve, delay));

    // 4. Stop typing
    console.log(`[WA] Stopping typing for ${phoneOrGroup}`);
    await fetchWithTimeout(
      `${process.env.WAHA_API_URL}/api/stopTyping`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ chatId: phoneOrGroup, session })
      },
      3000
    );
    // 5. Send text message with retry and timeout
    const result = await retryOperation(async () => {
      console.log(`[WA] Sending message to ${phoneOrGroup}`);
      const response = await fetchWithTimeout(
        `${process.env.WAHA_API_URL}/api/sendText`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            chatId: phoneOrGroup,
            text: message,
            session,
            reply_to: null,
            linkPreview: true,
            linkPreviewHighQuality: false
          })
        },
        3000
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[WA] API error: ${response.status} - ${errorText}`);
        throw new Error(errorText);
      }

      console.log(`[WA] Message sent successfully to ${phoneOrGroup}`);
      return response.json();
    }, 3, 1000); // 3 retries with 1s delay

    return result;
  } catch (error) {
    console.error(`[WA] Error in message sequence:`, error);
    throw error;
  }
}

function randomDelay(min: number, max: number) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, options: any, timeout = 3000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

async function retryOperation<T>(operation: () => Promise<T>, maxRetries = 2, delay = 1000): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      console.log(`[Retry] Attempt ${i + 1} failed:`, error);
      if (i === maxRetries - 1) throw error;
      console.log(`[Retry] Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Retry operation failed');
}

async function processMessageQueue() {
  if (isProcessing || messageQueue.length === 0) return;
  
  isProcessing = true;
  console.log(`[Queue] Starting to process ${messageQueue.length} messages`);
  
  while (messageQueue.length > 0) {
    const message = messageQueue[0];
    try {
      console.log(`[Queue] Processing message for ${message.phoneOrGroup}`);
      await sendMessageSequence(message.phoneOrGroup, message.message);
      console.log(`[Queue] Message processed successfully`);
      
      // Tunggu 3 detik sebelum next message
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      console.error('[Queue] Error processing message:', error);
      // Optional: Retry failed messages by pushing back to queue
      if (error.message.includes('ETIMEDOUT')) {
        console.log('[Queue] Timeout error, will retry message later');
        messageQueue.push(message);
      }
    }
    messageQueue.shift(); // Hapus pesan yang sudah diproses
  }
  
  console.log('[Queue] Finished processing all messages');
  isProcessing = false;
} 