# Kuesioner

Web kuesioner mirip Google Forms. Pengisi form **tidak perlu login** dan **tidak ada data identitas pengisi yang disimpan**. Admin memiliki dashboard untuk membuat form, melihat statistik real-time, dan mengelola respons anonim.

## Fitur

- Admin login (single admin)
- CRUD form + form builder (drag urutan via tombol, tipe pertanyaan lengkap)
- Tipe pertanyaan: teks pendek/panjang, pilihan ganda, checkbox, dropdown, skala linear, section, upload foto
- Upload 1 foto per submission, max 5MB, otomatis dikompres ke WebP (EXIF dihapus)
- Form publik tanpa login via `/f/:slug`
- Statistik real-time (SSE + fallback polling): total respons, views, tren 14 hari, breakdown per pertanyaan
- Export CSV, daftar respons anonim, hapus semua respons
- Dark UI, sederhana, tanpa efek glass
- SQLite lokal (file `data/app.db`)
- File upload otomatis dihapus saat form dihapus (cascade)
- Rate limit submit & login, honeypot, opsional Cloudflare Turnstile

## Tech Stack

- **Backend:** Node.js 22+ (memakai `node:sqlite` bawaan), Fastify 5, Zod, sharp, JWT cookie
- **Frontend:** React 18, Vite, TailwindCSS, React Query, Recharts, lucide-react
- **DB:** SQLite (`data/app.db`)

## Prasyarat

- Node.js **22.5+** (disarankan 24) — karena memakai modul `node:sqlite`
- npm

## Setup

```bash
npm install
copy .env.example .env
node server/db/migrate.js
node server/db/seed.js
npm run dev
```

Buka:
- Admin: http://localhost:5173/login
- Form publik: http://localhost:5173/f/:slug

Login default: **admin / admin123** (ubah di `.env` sebelum seed, atau lewat menu Pengaturan).

## Production

```bash
npm run build
npm start
```

Server akan menyajikan `client/dist` sekaligus API di `http://localhost:4000`.
Set `NODE_ENV=production` agar cookie memakai flag `Secure` (wajib di belakang HTTPS).

## Struktur

```
server/
  index.js            # entry Fastify
  db/                 # koneksi node:sqlite, migrasi, seed
  routes/             # auth, forms, questions, public, submissions, stats, export, settings
  middleware/         # auth JWT, rate limit
  lib/                # event bus (SSE), cleanup file
client/
  src/pages/          # Login, Dashboard, FormBuilder, FormStats, Responses, Settings, PublicForm
  src/components/     # Layout
data/app.db           # database lokal (gitignored)
storage/uploads/      # foto (gitignored)
```

## Privasi

- Tabel `submissions` hanya berisi UUID + timestamp + jawaban.
- Tidak menyimpan nama, email, IP, user-agent, atau fingerprint.
- Rate limit disimpan di memori (tidak persisten).
- File foto diberi nama UUID, tanpa metadata EXIF, dan dihapus saat form dihapus.
- Opsional retensi file (hari) di menu Pengaturan; `0` = simpan sampai form dihapus.

## Deploy ke Cloudflare Pages

Branch `cloudflare-pages` berisi versi yang berjalan sepenuhnya di Cloudflare:

- Pages (static) + Pages Functions (Hono)
- D1 untuk database
- R2 untuk foto
- Realtime via polling 5 detik
- Kompresi foto di browser

Panduan lengkap: [`DEPLOY-CLOUDFLARE.md`](./DEPLOY-CLOUDFLARE.md)

## Catatan

- `node:sqlite` masih ditandai eksperimental oleh Node, tetapi stabil untuk penggunaan lokal.
- Untuk skala besar, migrasi ke PostgreSQL dan object storage disarankan.
