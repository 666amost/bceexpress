import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const authorization = req.headers.get('authorization');
  const { awb, status, courierName, note, receiverPhone } = body;

  if (authorization !== process.env.WA_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  if (status === 'delivered') {
    const groupId = process.env.WA_GROUP_ID?.endsWith('@g.us')
      ? process.env.WA_GROUP_ID
      : process.env.WA_GROUP_ID + '@g.us';
    const text = ` Paket Terkirim!\nAWB: ${awb}\nStatus: ${status}\nKurir: ${courierName}\nNote: ${note}`;
    await sendMessage(groupId, text);

    if (receiverPhone) {
      let phoneId = receiverPhone;
      if (phoneId.startsWith('0')) {
        phoneId = '62' + phoneId.slice(1);
      }
      if (!phoneId.endsWith('@c.us')) {
        phoneId = phoneId + '@c.us';
      }
      await sendMessage(phoneId, text);
    }
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