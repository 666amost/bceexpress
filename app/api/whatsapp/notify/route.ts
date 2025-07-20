import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const authorization = req.headers.get('authorization');
  const { type, record, old_record } = body;

  if (authorization !== process.env.WA_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Trigger hanya jika status delivered
  if (
    (type === 'INSERT' && record.status === 'delivered') ||
    (type === 'UPDATE' && record.status === 'delivered' && old_record.status !== 'delivered')
  ) {
    const awb = record.awb_number;
    const status = record.status;
    const note = record.notes || '';

    const groupId = process.env.WA_GROUP_ID?.endsWith('@g.us')
      ? process.env.WA_GROUP_ID
      : process.env.WA_GROUP_ID + '@g.us';
    const text = `Paket Terkirim!\nAWB: ${awb}\nStatus: ${status}\nNote: ${note}`;

    await sendMessage(groupId, text);
  }

  return NextResponse.json({ ok: true });
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
  return res.json();
} 