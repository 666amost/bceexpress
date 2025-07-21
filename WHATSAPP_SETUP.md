# WhatsApp Integration Setup

## Environment Variables yang Diperlukan

Untuk mengintegrasikan WhatsApp notification dengan sistem, Anda perlu mengatur environment variables berikut:

### 1. WA_WEBHOOK_SECRET
Secret key untuk mengamankan webhook dari Supabase ke Vercel
```
WA_WEBHOOK_SECRET=botkontol666
```

### 2. WAHA_API_URL
URL endpoint WAHA (WhatsApp HTTP API) server
```
WAHA_API_URL=http://your-waha-server:3000
```

### 3. WAHA_SESSION
Session name untuk WAHA (default: 'default')
```
WAHA_SESSION=bot_group
```

### 4. WA_GROUP_ID
ID grup WhatsApp untuk menerima notifikasi (tanpa @g.us suffix)
```
WA_GROUP_ID=6281380800298-1585973791
```

## Cara Setup

### 1. Setup WAHA Server
1. Install WAHA (WhatsApp HTTP API)
2. Jalankan server WAHA
3. Scan QR code untuk login WhatsApp
4. Catat URL server WAHA

### 2. Setup Environment Variables di Vercel
1. Buka dashboard Vercel
2. Pilih project Anda
3. Buka tab "Settings" > "Environment Variables"
4. Tambahkan semua environment variables di atas

### 3. Setup Supabase Webhook (HTTP Request)
1. Buka dashboard Supabase
2. Pilih project Anda
3. Buka "Database" > "Webhooks"
4. Buat webhook baru dengan:
   - **Type**: HTTP Request
   - **Table**: `shipment_history`
   - **Events**: `INSERT`, `UPDATE`
   - **URL**: `https://bcexpress.vercel.app/api/whatsapp/notify`
   - **Method**: `POST`
   - **Headers**: 
     ```
     Authorization: botkontol666
     Content-Type: application/json
     ```

### 4. Test Konfigurasi
1. Akses `/api/whatsapp/status` untuk mengecek status konfigurasi
2. Update status shipment menjadi "delivered"
3. Cek apakah notifikasi terkirim ke grup WhatsApp

## Alur Kerja

```
1. Kurir Update Status → Database
2. Supabase Webhook → HTTP Request → Vercel API
3. Vercel API → Validasi → WhatsApp Notification
```

## Troubleshooting

### Error 500 pada Webhook
- Pastikan semua environment variables terkonfigurasi
- Cek log di Vercel untuk detail error
- Pastikan WAHA server berjalan dan terhubung

### Notifikasi Tidak Terkirim
- Cek status WAHA session
- Pastikan grup ID benar
- Cek log WhatsApp untuk error

### Webhook Tidak Terpanggil
- Pastikan webhook URL benar
- Cek authorization header
- Pastikan Supabase webhook aktif
- Pastikan table `shipment_history` ada dan memiliki data

### Environment Variables Check
- Akses `/api/whatsapp/status` untuk mengecek konfigurasi
- Pastikan semua variables ter-set dengan benar 