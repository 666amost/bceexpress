import { NextRequest, NextResponse } from 'next/server';

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
      if (!process.env.WAHA_API_URL) {
        return NextResponse.json({ ok: true, warning: 'WhatsApp notification skipped - WAHA_API_URL not configured' });
      }
      
      if (!process.env.WA_GROUP_ID) {
        return NextResponse.json({ ok: true, warning: 'WhatsApp notification skipped - WA_GROUP_ID not configured' });
      }

      // Validasi format WAHA_API_URL
      const wahaApiUrl = process.env.WAHA_API_URL;
      if (!wahaApiUrl) {
        return NextResponse.json({ ok: true, warning: 'WhatsApp notification skipped - WAHA_API_URL not configured' });
      }

      try {
        new URL(wahaApiUrl);
      } catch (error) {
        return NextResponse.json({ ok: true, warning: 'WhatsApp notification skipped - Invalid WAHA_API_URL' });
      }

      const awb = record.awb_number;
      const status = record.status;
      const note = record.notes || '';

      // WA_GROUP_ID sudah divalidasi sebelumnya, jadi pasti ada
      const groupId = (process.env.WA_GROUP_ID || '').endsWith('@g.us')
        ? process.env.WA_GROUP_ID
        : `${process.env.WA_GROUP_ID}@g.us`;
      

      
      // Ubah format pesan tanpa 'Paket Terkirim!'
      const text = `AWB: ${awb}\nStatus: ${status}\nNote: ${note}`;

      if (!groupId) {
        return NextResponse.json({ ok: true, warning: 'WhatsApp notification skipped - Invalid WA_GROUP_ID' });
      }

      // Langsung queue pesan tanpa menunggu
      sendMessageSequence(groupId, text)
        .catch(error => {
          console.error('Failed to send WhatsApp message:', error);
        });
      
      // Respond immediately to webhook
      return NextResponse.json({ 
        ok: true,
        message: 'Message queued for delivery',
        queueSize: messageQueue.length + 1
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Queue for handling concurrent messages
const messageQueue: { phoneOrGroup: string; message: string }[] = [];
let isProcessing = false;

function randomDelay(min: number, max: number) {
  return new Promise(resolve => {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    setTimeout(resolve, delay);
  });
}

async function fetchWithTimeout(url: string, options: RequestInit, timeout = 5000) {
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

async function retryFetch(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetchWithTimeout(url, options);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      await new Promise(resolve => setTimeout(resolve, (i + 1) * 2000));
    }
  }
  throw new Error('Max retries reached');
}

async function sendMessageSequence(phoneOrGroup: string, message: string) {
  // Check for duplicate messages in queue
  const isDuplicate = messageQueue.some(item => 
    item.phoneOrGroup === phoneOrGroup && 
    item.message === message
  );

  if (!isDuplicate) {
    // Add message to queue only if not duplicate
    messageQueue.push({ phoneOrGroup, message });
  
    // Start processing if not already processing
    if (!isProcessing) {
      processQueue();
    }
  }

  return { queued: !isDuplicate };
}

async function processQueue() {
  if (isProcessing || messageQueue.length === 0) return;
  
  isProcessing = true;
  while (messageQueue.length > 0) {
    const { phoneOrGroup, message } = messageQueue[0];
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (process.env.WAHA_API_KEY) {
        headers['X-Api-Key'] = process.env.WAHA_API_KEY;
      }
      const session = process.env.WAHA_SESSION || 'default';


      // 1. Send seen with random delay (1-3 seconds)
      await randomDelay(1000, 3000);
      await retryFetch(`${process.env.WAHA_API_URL}/api/sendSeen`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          chatId: phoneOrGroup,
          session: process.env.WAHA_SESSION || 'default',
        })
      });

      // 2. Start typing with random delay (2-4 seconds)
      await randomDelay(2000, 4000);
      await retryFetch(`${process.env.WAHA_API_URL}/api/startTyping`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          chatId: phoneOrGroup,
          session: process.env.WAHA_SESSION || 'default',
        })
      });

      // 3. Simulate human typing time based on message length (50-80ms per character)
      const typingTime = Math.max(
        3000,
        Math.min(15000, message.length * (Math.random() * 30 + 50))
      );
      await randomDelay(typingTime, typingTime + 2000);

      // 4. Send message

      const response = await retryFetch(`${process.env.WAHA_API_URL}/api/sendText`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          chatId: phoneOrGroup,
          text: message,
          session: process.env.WAHA_SESSION || 'default',
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${await response.text()}`);
      }


      
      // Remove message from queue after successful sending
      messageQueue.shift();
      
      // Add delay between messages (5-10 seconds)
      if (messageQueue.length > 0) {
        await randomDelay(5000, 10000);
      }
    } catch (error) {

      
      // On error, move message to end of queue for retry
      if (error.message.includes('timeout') || error.message.includes('rate limit')) {
        const failedMessage = messageQueue.shift();
        if (failedMessage) {
          messageQueue.push(failedMessage);

          // Add longer delay before retry (15-30 seconds)
          await randomDelay(15000, 30000);
        }
      } else {
        // For other errors, remove from queue
        messageQueue.shift();
      }
    }
  }
  
  isProcessing = false;

}

