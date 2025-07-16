require('dotenv').config({ path: '.env.local' });
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const { downloadSessionFromSupabase, uploadSessionToSupabase } = require('./lib/supabase-session.ts');
const qrcode = require('qrcode-terminal');
const express = require('express');
const app = express();
app.use(express.json());

let sock; // pastikan sock global

app.post('/wa-webhook', async (req, res) => {
  const { authorization } = req.headers;
  const { awb, status, courierName, note } = req.body;

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
      await sock.sendMessage(groupId, { text });
      console.log('Pesan delivered dikirim ke grup:', text);
    }, delay);
  }

  res.json({ ok: true });
});

app.listen(3001, () => {
  console.log('Bot WhatsApp webhook listening on port 3001');
});

// Inisialisasi sock seperti biasa, pastikan sock global
async function startBot() {
  await downloadSessionFromSupabase();
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
  sock = makeWASocket({ auth: state });

  sock.ev.on('creds.update', async () => {
    await saveCreds();
    await uploadSessionToSupabase(); // update session ke Supabase
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      qrcode.generate(qr, { small: true }); // Tampilkan QR code di terminal
    }
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        startBot();
      }
    } else if (connection === 'open') {
      console.log('Bot is connected');
      setTimeout(() => {
        const groupId = process.env.WA_GROUP_ID.endsWith('@g.us')
          ? process.env.WA_GROUP_ID
          : process.env.WA_GROUP_ID + '@g.us';
        sock.sendMessage(groupId, { text: 'TEST BOT COK' });
        // Test ke nomor pribadi juga:
        // sock.sendMessage('62xxxxxxxxxx@s.whatsapp.net', { text: 'Tes ke nomor pribadi' });
      }, 5000);
    }
  });

  // Contoh kirim pesan ke grup:
  // await sock.sendMessage('6281380800298-1585973791@g.us', { text: 'TEST BOT RESI' });
}
startBot(); 