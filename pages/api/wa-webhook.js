export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { authorization } = req.headers;
  const { awb, status, courierName, note, receiverPhone } = req.body;

  if (authorization !== process.env.WA_WEBHOOK_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  if (status === 'delivered') {
    const groupId = process.env.WA_GROUP_ID.endsWith('@g.us')
      ? process.env.WA_GROUP_ID
      : process.env.WA_GROUP_ID + '@g.us';
    const text = ` Paket Terkirim!\nAWB: ${awb}\nStatus: ${status}\nKurir: ${courierName}\nNote: ${note}`;
    await sendMessage(groupId, text);
    console.log('Pesan delivered dikirim ke grup:', text);

    // Kirim ke nomor penerima jika ada
    if (receiverPhone) {
      let phoneId = receiverPhone;
      if (phoneId.startsWith('0')) {
        phoneId = '62' + phoneId.slice(1);
      }
      if (!phoneId.endsWith('@c.us')) {
        phoneId = phoneId + '@c.us';
      }
      await sendMessage(phoneId, text);
      console.log('Pesan delivered dikirim ke penerima:', phoneId);
    }
  }

  res.json({ ok: true });
}

async function sendMessage(phoneOrGroup, message) {
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