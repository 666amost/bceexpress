require('dotenv').config({ path: '.env.local' });
const express = require('express');
const fetch = require('node-fetch');
const app = express();
app.use(express.json());

const WAHA_API_URL = process.env.WAHA_API_URL;
const WAHA_SESSION = process.env.WAHA_SESSION || 'default';

async function sendMessage(phoneOrGroup, message) {
  // phoneOrGroup bisa berupa nomor (628xxxx@s.whatsapp.net) atau groupId (@g.us)
  const res = await fetch(`${WAHA_API_URL}/api/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session: WAHA_SESSION,
      chatId: phoneOrGroup,
      text: message
    })
  });
  return res.json();
}

app.post('/wa-webhook', async (req, res) => {
  const { authorization } = req.headers;
  const { awb, status, courierName, note, receiverPhone } = req.body;

  // Validasi secret
  if (authorization !== process.env.WA_WEBHOOK_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  if (status === 'delivered') {
    // Delay random 15-35 detik
    const delay = Math.floor(Math.random() * (35000 - 15000 + 1)) + 15000;
    setTimeout(async () => {
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
    }, delay);
  }

  res.json({ ok: true });
});

app.listen(3001, () => {
  console.log('Bot WhatsApp webhook listening on port 3001');
}); 