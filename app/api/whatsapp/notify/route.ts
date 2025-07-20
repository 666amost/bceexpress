import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const authorization = req.headers.get('authorization');
    const { type, record, old_record } = body;

    // Validasi environment variables
    if (!process.env.WA_WEBHOOK_SECRET) {
      console.error('WA_WEBHOOK_SECRET not configured');
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
        console.error('WhatsApp environment variables not configured:', {
          WAHA_API_URL: process.env.WAHA_API_URL ? 'SET' : 'NOT SET',
          WA_GROUP_ID: process.env.WA_GROUP_ID ? 'SET' : 'NOT SET'
        });
        // Return success but log error - don't fail the webhook
        return NextResponse.json({ ok: true, warning: 'WhatsApp notification skipped - environment not configured' });
      }

      const awb = record.awb_number;
      const status = record.status;
      const note = record.notes || '';

      const groupId = process.env.WA_GROUP_ID.endsWith('@g.us')
        ? process.env.WA_GROUP_ID
        : process.env.WA_GROUP_ID + '@g.us';
      const text = `Paket Terkirim!\nAWB: ${awb}\nStatus: ${status}\nNote: ${note}`;

      try {
        await sendMessage(groupId, text);
      } catch (whatsappError) {
        console.error('WhatsApp send error:', whatsappError);
        // Return success but log error - don't fail the webhook
        return NextResponse.json({ ok: true, warning: 'WhatsApp notification failed but webhook succeeded' });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function sendMessage(phoneOrGroup: string, message: string) {
  const res = await fetch(`${process.env.WAHA_API_URL}/api/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session: process.env.WAHA_SESSION || 'default',
      chatId: phoneOrGroup,
      text: message
    })
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`WhatsApp API error: ${res.status} - ${errorText}`);
  }
  
  return res.json();
} 