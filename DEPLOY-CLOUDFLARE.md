# Deploy ke Cloudflare Pages

Versi ini berjalan **sepenuhnya di Cloudflare**:

- **Frontend** → Cloudflare Pages (static assets)
- **API** → Pages Functions (Hono, runtime Workers)
- **Database** → Cloudflare D1 (SQLite)
- **Foto** → Cloudflare R2
- **Realtime** → polling otomatis 5 detik (bukan SSE)
- **Kompresi foto** → dilakukan di browser (canvas → WebP), bukan `sharp`

> Branch: `cloudflare-pages`

---

## 1. Prasyarat

- Node.js 20+
- Akun Cloudflare
- `wrangler` (sudah ada di devDependencies)

```bash
npm install
```

---

## 2. Buat resource Cloudflare

```bash
npx wrangler login
```

### D1

```bash
npx wrangler d1 create kuesioner-db
```

Salin `database_id` dari output ke `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "kuesioner-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### R2

```bash
npx wrangler r2 bucket create kuesioner-uploads
```

R2 binding sudah ada di `wrangler.toml` (`binding = "BUCKET"`).

---

## 3. Jalankan migrasi D1

```bash
# remote (production)
npx wrangler d1 migrations apply kuesioner-db --remote

# lokal (development)
npx wrangler d1 migrations apply kuesioner-db --local
```

Migration membuat tabel + admin default:

- Username: `admin`
- Password: `admin123`

**Segera ganti password** setelah login pertama (menu Pengaturan).

---

## 4. Set secret

```bash
npx wrangler pages secret put JWT_SECRET --project-name kuesioner
# masukkan string acak panjang, contoh hasil: openssl rand -hex 32

# opsional, jika memakai Turnstile
npx wrangler pages secret put TURNSTILE_SECRET_KEY --project-name kuesioner
```

`MAX_UPLOAD_MB` sudah diset di `[vars]` (`wrangler.toml`).

---

## 5. Deploy

```bash
npm run cf:deploy
```

Atau build lalu deploy manual:

```bash
npm run cf:build
npx wrangler pages deploy client/dist --project-name kuesioner
```

Saat pertama kali, Wrangler akan menawarkan membuat project Pages.

URL akan seperti:

```
https://kuesioner.pages.dev
```

---

## 6. Deploy via GitHub (opsional)

Di dashboard Cloudflare → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**:

| Setting | Nilai |
|---|---|
| Repository | `donyp/kuesioner` |
| Branch | `cloudflare-pages` |
| Build command | `npm run build` |
| Build output directory | `client/dist` |
| Root directory | `/` |

Lalu tambahkan binding di **Settings → Functions**:

- **D1**: variable `DB` → database `kuesioner-db`
- **R2**: variable `BUCKET` → bucket `kuesioner-uploads`

Tambahkan environment variable/secret:

- `JWT_SECRET`
- `TURNSTILE_SECRET_KEY` (opsional)

> `functions/` otomatis dideteksi Cloudflare Pages.

---

## 7. Development lokal

```bash
copy .dev.vars.example .dev.vars
npm run cf:migrate:local
npm run cf:dev
```

Buka `http://localhost:8788`.

`wrangler pages dev` menjalankan static assets + Functions + D1/R2 lokal (tersimpan di `.wrangler/state`).

---

## 8. Perbedaan dengan versi Node lokal

| Fitur | Node lokal | Cloudflare |
|---|---|---|
| Server | Fastify | Hono di Pages Functions |
| Database | `node:sqlite` (`data/app.db`) | D1 |
| Upload | `sharp` → WebP di server | canvas → WebP di browser, simpan di R2 |
| File serving | `/uploads/...` | `/api/files/:id` (admin only) |
| Realtime | SSE | polling 5 detik |
| Cleanup retensi | cron internal | lazy cleanup saat form/stats diakses |
| Hapus form | hapus file disk + DB | hapus object R2 + DB |

---

## 9. Catatan biaya & limit

- **Pages**: gratis (500 build/bulan)
- **D1**: gratis 5GB storage + 5 juta baris baca/hari
- **R2**: gratis 10GB storage, operasi kelas A/B terbatas
- **Workers**: 100.000 request/hari gratis

Untuk kuesioner skala kecil–menengah, semua masuk free tier.

---

## 10. Troubleshooting

**`database_id` placeholder error**
→ Ganti `00000000-...` di `wrangler.toml` dengan ID asli dari `wrangler d1 create`.

**Login gagal / cookie tidak tersimpan**
→ Pastikan `JWT_SECRET` sudah diset sebagai secret, bukan hanya `[vars]`.
→ Di production harus HTTPS (Pages sudah HTTPS).

**Foto gagal upload**
→ Cek binding R2 bernama `BUCKET` sudah terpasang.
→ Pastikan ukuran setelah kompresi < 5MB.

**API 404**
→ Pastikan file `functions/api/[[path]].js` ikut ter-deploy dan build output `client/dist`.
