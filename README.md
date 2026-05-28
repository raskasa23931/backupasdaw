# Cloud Checker Bot - Vercel Backup

Bot Telegram backup untuk deploy di Vercel. Menggunakan MongoDB Atlas sebagai database.

## Setup Deploy ke Vercel

### 1. Upload ke GitHub
Upload seluruh isi folder ini ke repository GitHub baru (public atau private).

### 2. Deploy ke Vercel
- Buka https://vercel.com
- Klik **Add New Project**
- Import repo GitHub kamu
- Klik **Deploy**

### 3. Set Environment Variables di Vercel
Buka **Project → Settings → Environment Variables**, tambahkan:

| Variable | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Token bot backup dari @BotFather |
| `ADMIN_PASSWORD` | Password admin kamu |
| `MONGODB_URI` | Connection string MongoDB Atlas |

Format MONGODB_URI:
```
mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/cloudchecker?retryWrites=true&w=majority
```

### 4. Register Webhook
Setelah deploy berhasil, buka URL ini di browser:
```
https://YOUR-VERCEL-URL.vercel.app/setup
```
Webhook Telegram akan otomatis terdaftar.

### 5. Test Bot
Buka bot backup di Telegram → ketik `/start`

## Catatan
- Database MongoDB **terpisah** dari bot utama (Base44)
- License key perlu di-generate ulang di bot backup via `/admin`
- Atau bisa import manual ke MongoDB collection `license_keys`

## File Structure
```
vercel-bot/
├── api/
│   └── webhook.js     # Main handler
├── lib/
│   ├── aws.js         # AWS checker
│   ├── cloud.js       # Linode & DigitalOcean
│   ├── db.js          # MongoDB database
│   └── telegram.js    # Telegram API helper
├── package.json
├── vercel.json
└── README.md
```
