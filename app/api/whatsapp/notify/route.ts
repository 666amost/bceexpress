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
      console.log('[Webhook] Processing delivery notification:', { 
        type, 
        status: record.status, 
        oldStatus: old_record?.status,
        awb: record.awb_number 
      });

      // Validasi environment variables untuk WhatsApp
      if (!process.env.WAHA_API_URL) {
        console.error('[Config] WAHA_API_URL is missing');
        return NextResponse.json({ ok: true, warning: 'WhatsApp notification skipped - WAHA_API_URL not configured' });
      }
      
      if (!process.env.WA_GROUP_ID) {
        console.error('[Config] WA_GROUP_ID is missing');
        return NextResponse.json({ ok: true, warning: 'WhatsApp notification skipped - WA_GROUP_ID not configured' });
      }

      // Validasi format WAHA_API_URL
      try {
        new URL(process.env.WAHA_API_URL);
      } catch (error) {
        console.error('[Config] Invalid WAHA_API_URL:', process.env.WAHA_API_URL);
        return NextResponse.json({ ok: true, warning: 'WhatsApp notification skipped - Invalid WAHA_API_URL' });
      }

      const awb = record.awb_number;
      const status = record.status;
      const note = record.notes || '';

      // WA_GROUP_ID sudah divalidasi sebelumnya, jadi pasti ada
      const groupId = process.env.WA_GROUP_ID.endsWith('@g.us')
        ? process.env.WA_GROUP_ID
        : process.env.WA_GROUP_ID + '@g.us';
      
      console.log('[DEBUG] WAHA Config:', {
        apiUrl: process.env.WAHA_API_URL,
        groupId,
        hasApiKey: !!process.env.WAHA_API_KEY,
        session: process.env.WAHA_SESSION || 'default'
      });
      
      // Ubah format pesan tanpa 'Paket Terkirim!'
      const text = `AWB: ${awb}\nStatus: ${status}\nNote: ${note}`;

      try {
        await sendMessageSequence(groupId, text);
      } catch (whatsappError) {
        console.error('[WA] Error sending message:', whatsappError);
        // Return success but log error - don't fail the webhook
        return NextResponse.json({ ok: true, warning: 'WhatsApp notification failed but webhook succeeded' });
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

    // 3. Wait for a short duration to simulate typing
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 4. Send message
    console.log(`[WA] Sending message to ${phoneOrGroup}: ${message}`);
    const response = await fetch(`${process.env.WAHA_API_URL}/api/sendText`, {
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

    console.log(`[WA] Message sequence completed for ${phoneOrGroup}`);
    return await response.json();
  } catch (error) {
    console.error(`[WA] Error in message sequence:`, error);
    throw error;
  }
}

