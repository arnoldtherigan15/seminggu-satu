# Migrasi Backend: Google Apps Script → Supabase
_Seminggu Satu by Arnold_

Dokumen ini rencana buat pindahin backend dari Google Apps Script (Sheets) ke Supabase (Postgres + Storage + Edge Functions), biar dapet REST endpoint beneran, lebih cepat, dan nggak kena limit kuota Apps Script. Dikerjain **per fase, satu-satu**, tiap fase ada checklist + cara ngetesnya — centang di sini tiap kelar biar progress kebaca jelas.

---

## 🎯 Tujuan
- Lepas dari limit Apps Script (cold-start, kuota eksekusi harian, concurrent execution).
- Ada endpoint REST asli (`GET /events`, dst) — bukan `exec?action=...` JSONP.
- Tetap gratis/murah di skala komunitas kita (ratusan warga, bukan jutaan request).

---

## ✅ Keputusan (FIXED)
1. Backend baru: **Supabase** (Postgres + Storage + Edge Functions + Cron), free tier.
2. Selama migrasi: **Apps Script TETAP jalan apa adanya** — dua backend hidup paralel sampai semua fase ketest, baru cutover. **Nggak ada downtime** buat warga.
3. Frontend tetap statis di GitHub Pages, cuma pelan-pelan ganti target `fetch(...)`-nya.
4. Push notif (OneSignal) & notif Telegram: logic-nya sama persis, cuma dipanggil dari Edge Function, bukan dari Apps Script.
5. `Google_Script_Code.js` tetap disimpen lokal sebagai arsip — nggak perlu dihapus setelah cutover.
6. **Ada 2 project Supabase**, biar testing nggak nyenggol data warga asli:
   - `seminggu-satu` → **production**, dipakai otomatis kalau situs diakses lewat `seminggusatu.com`.
   - `seminggu-satu-dev` → **dev/testing**, dipakai otomatis di luar itu (localhost, `file://`, dst).
   - `env.js` udah diatur auto-switch berdasarkan domain (lihat komentar di file-nya) — nggak perlu ganti manual.
   - Tiap ada perubahan skema/data (Fase 1 & 4 dst), **kerjain di project dev dulu**, baru kalau udah oke direplikasi ke production.

---

## 🔐 Aturan Kunci API (penting, baca sebelum Fase 0)
Supabase kasih 2 macam key (di dashboard terbaru namanya "Publishable" & "Secret", dulu disebut "anon" & "service_role" — fungsinya sama):
- **Publishable key** (`sb_publishable_...`, dulu disebut `anon`/`public` key) → AMAN dicommit ke repo & kepake di frontend (mirip `GOOGLE_SCRIPT_URL` di `env.js` sekarang). Proteksinya dari Row Level Security (Fase 3), bukan dari key-nya disembunyiin.
- **Secret key** (`sb_secret_...`, dulu disebut `service_role` key) → **JANGAN PERNAH** masuk ke file apapun di repo/frontend. Key ini bisa baca/tulis SEMUA data tanpa filter. Cuma dipakai di sisi server (disimpen sebagai secret di Edge Function), nggak pernah nyampe browser.

---

## 🗂️ Peta Tabel (ringkasan — detail penuh udah dibahas di chat sebelumnya)
> Cakupan migrasi ini **1 project penuh** (bukan cuma Balai Warga/`warga/`) — termasuk konten halaman publik & data keuangan admin.

| Tabel baru | Ganti Sheet apa |
|---|---|
| `members` | Sheet `"members"` |
| `batches` | Sheet `"batches"` |
| `registrations` | **10 sheet per-batch** (6 struktur kolom beda: 3d-frame, paper-journal, upcycle-journal, bookmark, reka-rekat, journaling-date — batch-nya sendiri terus nambah tiap ada volume baru) |
| `challenges` | Sheet `"challenges"` |
| `quest_submissions` | Sheet `"quest_submissions"` |
| `quest_likes` | Sheet `"quest_likes"` |
| `event_photos` | Sheet `"event_photos"` |
| `board_messages` | Sheet `"board_messages"` (Mading Warga) |
| `suggestions` + `suggestion_votes` | Sheet `"suggestions"` (vote yang tadinya JSON array dipisah jadi tabel sendiri) |
| `leads` | Sheet leads CRM |
| `app_config` | Sheet `"app-config"` (`getConfigValue_`/`setConfigValue_`) |
| `content_items` | Sheet `"galeri"`, `"testimoni"`, `"recommendation"`, `"links"` (pola `CONTENT_DEFS` di kode — 4 sheet digabung 1 tabel + `content_type`) |
| `workshop_costs` | Sheet `"modal-config"` — data biaya/modal, **finansial internal, no akses publik** |

> Loyalty & leaderboard **nggak butuh tabel sendiri** — dihitung on-the-fly dari `registrations` + `quest_submissions` (sama kayak `loyaltyMembers_` sekarang, tapi versi SQL).

---

# 🚦 FASE EKSEKUSI

## Fase 0 — Bikin Akun & Project Supabase ⭐ mulai di sini
Paling dasar duluan, murni klik-klik, ~10 menit:
- [x] Buka [supabase.com](https://supabase.com) → **Sign in with GitHub** (pakai akun `arnoldtherigan15` yang udah kepake buat repo ini)
- [x] **New Project** → nama `seminggu-satu` (production), region **Asia-Pacific (Singapore)**
- [x] Set database password yang kuat → **simpen di password manager**
- [x] Tunggu provisioning sampai status project jadi "Active"
- [x] Catat **Project URL** & **Publishable key** project production → udah masuk ke `env.js`
- [x] **New Project** lagi → nama `seminggu-satu-dev`, region **sama** (Singapore), password boleh beda
- [x] Catat **Project URL** & **Publishable key** project dev ini → udah masuk ke `env.js`
- **Tes:** ✅ `env.js` udah punya 2 pasang URL+key (prod & dev), nggak ada lagi tulisan "PASTE_..._DI_SINI".

## Fase 1 — Bikin Skema Tabel
> Kerjain di project **`seminggu-satu-dev`** dulu — kalau lancar, baru dijalanin lagi (SQL yang sama) di project production.
- [x] File udah siap: [`supabase/schema.sql`](supabase/schema.sql) — isi `CREATE TABLE` semua tabel di atas
- [x] Buka project **seminggu-satu-dev** → **SQL Editor** → **New query**
- [x] Paste SELURUH isi `supabase/schema.sql` → klik **Run** → 12 tabel muncul di Table Editor ✅
- [x] Ulangi 2 langkah di atas (paste + Run) di project **seminggu-satu** (production)
- **Tes:** ✅ 12 tabel keliatan di Table Editor di KEDUA project (dev & production).
- [x] **Tambahan** (scope melebar ke seluruh project, bukan cuma Balai Warga): `schema.sql` udah nambah 2 tabel baru (`content_items`, `workshop_costs`) — buka lagi SQL Editor di dev & production, jalanin cuma bagian baru ini:
  ```sql
  create table content_items (
    id           uuid primary key default gen_random_uuid(),
    content_type text not null,
    title        text,
    extra        jsonb not null default '{}',
    created_at   timestamptz not null default now()
  );
  alter table content_items enable row level security;
  create index content_items_type_idx on content_items (content_type);

  create table workshop_costs (
    id            uuid primary key default gen_random_uuid(),
    workshop_type text not null,
    batch         text not null default '',
    name          text not null,
    amount        numeric not null default 0,
    kind          text not null default 'per-peserta' check (kind in ('tetap', 'per-peserta')),
    created_at    timestamptz not null default now()
  );
  alter table workshop_costs enable row level security;
  create index workshop_costs_workshop_type_idx on workshop_costs (workshop_type);
  ```
- **Tes:** ✅ 14 tabel total (bukan 12 lagi) di Table Editor di KEDUA project.


## Fase 2 — Setup Storage (buat foto)
- [x] Bikin bucket: `payment-proofs` (**private**), `registration-photos`, `profile-photos`, `quest-photos`, `event-photos` (**public**) — beres di dev & production
- **Tes:** ✅ 5 bucket ada di kedua project.
- [x] **Tambahan (ketemu pas audit ulang)**: foto check-in journal mingguan (`memberCheckin_` → folder Drive "Weekly Journal Photos") belum ada bucket-nya! Bikin 1 bucket lagi: `journal-photos` (**public** — foto ini ikut nongol di galeri juga, sama kayak event-photos)
- **Tes:** ✅ 6 bucket total (bukan 5) di dev & production.

## Fase 3 — Keamanan (Row Level Security)
> RLS udah nyala di semua tabel sejak Fase 1 (tapi tanpa policy = ketutup total). Fase ini nambahin policy buat tabel yang MEMANG boleh diakses langsung dari browser.
>
> Login aplikasi ini custom (WA + password), bukan Supabase Auth — jadi RLS nggak bisa ngecek "siapa yang login". Polanya: publik cuma dikasih baca data publik (galeri, config, challenge aktif) + insert form pendaftaran; SISANYA (members, quest_submissions, quest_likes, board_messages, suggestions, suggestion_votes, leads) sengaja dibiarin nggak ada policy = ketutup total, semua akses lewat Edge Function pakai token (Fase 5), sama persis kayak sistem sekarang.
- [x] File udah siap: [`supabase/policies.sql`](supabase/policies.sql)
- [x] Buka project **seminggu-satu-dev** → **SQL Editor** → **New query** → paste isi `policies.sql` → **Run**
- [x] Ulangi di project **seminggu-satu** (production)
- **Tes:** ✅ dijalanin sukses di dev & production.
- [x] **Tambahan**: `policies.sql` udah nambah 1 policy baru buat `content_items` (public read, karena galeri/testimoni/rekomendasi/links emang tampil di web publik) — jalanin lagi di dev & production:
  ```sql
  create policy "content_items_public_read" on content_items
    for select to anon using (true);
  ```
- **Tes:** ✅ policy baru jalan di dev & production (`workshop_costs` tetep TANPA policy — data finansial, harus tetep ketutup total).
- [x] 🚨 **BUG KEAMANAN ketemu pas audit Fase 7, udah di-fix**: policy `app_config_public_read` ditulis `using (true)` = SEMUA key kebuka publik, padahal tabel yang sama juga nyimpen `ADMIN_SESSION_TOKEN`/`ADMIN_SESSION_EXPIRY` (sesi admin aktif, dari Fase 5e). Siapapun yang punya anon key (publik, ada di `env.js`) bisa curi sesi admin & masuk sebagai admin tanpa password. Untungnya belum kebobolan — ketemu juga role `anon` belum pernah di-`GRANT SELECT` sama sekali di level Postgres (mirip gap `service_role` di Fase 5a), jadi semua tabel publik masih 100% ketutup walau policy-nya salah dari awal. Fix keduanya sekaligus: [`supabase/fix_anon_grants.sql`](supabase/fix_anon_grants.sql), dijalanin di dev & production.
- **Tes:** ✅ dicek langsung dari luar (curl pakai anon key, bukan dari SQL Editor yang bypass RLS): `ADMIN_SESSION_TOKEN` udah nggak kebaca (`[]`) di dev & production, sementara `batches`/`challenges`/`content_items`/`event_photos` udah bisa dibaca (data asli muncul, bukan lagi `permission denied`) di keduanya.

## Fase 4 — Migrasi Data Lama
> Karena datanya masih dikit (puluhan baris/sheet), sebagian besar tabel dikerjain via **export CSV → rename header → Import** di Table Editor. Buat 2 tabel yang paling ribet (`registrations`, dan referensi antar-tabel di quest), lebih AMAN input manual langsung di Table Editor daripada maksa CSV.
>
> ⚠️ Aku (Claude) **cuma baca kode** `Google_Script_Code.js`, **bukan isi Sheet asli** — jadi kalau kolom di sheet kamu ternyata beda urutan/nama dari yang kutulis di bawah, screenshot aja baris header-nya, aku sesuaikan.
>
> Urutan: **dev dulu semua langkah di bawah → baru ulangi di production** kalau udah lancar.

### 4a. Perbaikan kecil (kalau belum jalanin ALTER-nya)
- [x] Kalau kolom `app_config.value` masih tipe `jsonb` (dari sebelum aku perbaiki `schema.sql`), jalanin ini dulu di SQL Editor (dev & prod):
  ```sql
  alter table app_config alter column value type text using value::text;
  ```

### 4b. Paling gampang — CSV export → rename header → Import
Caranya SAMA buat semua tabel di bawah: buka tab sheet-nya di Google Sheets → **File → Download → Comma Separated Values (.csv)** → buka CSV-nya (spreadsheet app apa aja) → ganti nama kolom di baris pertama sesuai tabel kanan → **hapus kolom `id` lama** (biar Postgres bikinin `id` baru otomatis) → simpan → di Supabase **Table Editor → pilih tabel → Insert → Import data from CSV**.

- [x] **`event_photos`**: `tag, photoUrl, caption, timestamp, eventDate` → `tag, photo_url, caption, created_at, event_date`
- [x] **`board_messages`**: `wa, nickname, text, ts` → `wa, nickname, message, created_at` (beberapa emoji rusak/mojibake di teks lama dibersihin manual pas migrasi)
- [x] **`leads`**: `platform, username, status, following, notes, lastContact, createdAt` → `platform, username, status, following, notes, last_contact, created_at`
- [x] **`suggestions`**: `wa, nickname, category, text, ts` → `wa, nickname, category, message, created_at` (kolom `votes` di-skip — vote lama di-reset ke 0, kecuali 1 vote asli yang opsional diinput manual ke `suggestion_votes`)
- [x] **`batches`**: `workshopType, sheetName, label, active, createdAt, eventDate` → `workshop_type, sheet_name, label, active, created_at, event_date` (`sheet_name` ternyata TETEP dipertahankan, dipakai buat cocokin `registrations` ke batch yang bener di 4g — nambah 1 kolom via ALTER dulu)
- **Tes:** ✅ 5 tabel beres di dev & production.

### 4c. `content_items` — gabungan 4 sheet konten (galeri, testimoni, recommendation, links)
- [x] Digabung via script (bukan manual) jadi `content_items_import.csv` — 8 galeri + 7 testimoni + 3 links = 18 baris, `recommendation` kosong (di-skip)
- [x] Import ke dev & production
- **Tes:** ✅ 18 baris masuk, JSON di kolom `extra` valid.

### 4d. `workshop_costs` — biaya/modal (ganti `modal-config`)
Kolom asli: `Workshop | Nama Biaya | Biaya | Tipe | Batch` → CSV export → rename header `workshop_type, name, amount, kind, batch` → **hapus kolom `id`** (nggak ada di sheet asli, aman) → Import biasa ke `workshop_costs`.
- [x] Kolom `batch`: baris yang kosong di sheet asli **biarin kosong string `""`** (bukan `null`) — itu artinya "biaya general" buat workshop itu (bukan spesifik 1 batch)
- [x] Kolom `kind` ("Tipe" di sheet): pastikan isinya persis `tetap` atau `per-peserta` (huruf kecil semua) — tabel ini punya aturan cuma nerima 2 nilai itu
- **Tes:** ✅ 2 baris (bookmark-journal-sheraton, reka-rekat) beres di dev & production.

### 4e. Agak ribet — ada referensi antar-tabel (challenges → quest_submissions → quest_likes)
> ⚠️ **Ketemu perubahan desain di tengah jalan**: data asli `quest_likes` ternyata dipakai buat like ke 3 jenis konten (`quest_submissions`, `event_photos`, DAN key sintetis check-in mingguan `jw_...` yang bukan baris tabel) — bukan cuma ke `quest_submissions` doang kayak dugaan awal. Makanya:
> - `challenges`, `quest_submissions`, `event_photos` — kolom `id` JADI TEXT (pakai id asli dari sheet, mis. `qmruso2ur`), BUKAN uuid seperti rencana awal.
> - `quest_likes` jadi polymorphic — kolom `target_id` (TEXT, tanpa foreign key), bukan `submission_id`.
> - `event_photos` yang udah keimpor di 4b ke-**reset & diimpor ulang** (id lama sempet kebuang, sekarang dibalikin).
> - File fix skema: [`supabase/fix_polymorphic_ids.sql`](supabase/fix_polymorphic_ids.sql) (drop & bikin ulang 4 tabel ini dari nol, aman karena belum ada data penting).
- [x] Jalanin `fix_polymorphic_ids.sql` di dev & production
- [x] Import ulang `event_photos` (9 baris, id asli balik) — `event_photos_import_v2.csv`
- [x] Import `challenges` (17 baris, id asli) — `challenges_import.csv`
- [x] Import `quest_submissions` (36 baris, id asli + `challenge_id` id asli) — `quest_submissions_import.csv`
- [x] Import `quest_likes` (220 baris, `target_id` polymorphic) — `quest_likes_import.csv`
- **Tes:** ✅ semua nyambung tanpa perlu mapping manual (id asli dipertahankan, bukan uuid baru) — beres di dev & production.

### 4f. Paling sensitif — `members`
- [x] Digabung via script (mojibake di dalam catatan journal ikut dibersihin, tanpa ngerusak struktur JSON): `members_import.csv` — 42 warga
- [x] `public_opt_in`: `1`→`true`, kosong→`false` (2 warga opt-in: Arnold & Ikbar)
- [x] `journal_records`/`mood_records` kosong → `{}`
- [x] Import ke dev & production
- **Tes:** ✅ 42 baris, 42 WA unik, semua JSON valid, nggak ada mojibake sisa.
- 💡 Token lama ikut dipindah (bukan di-skip) — kalau logic login di Edge Function (Fase 5) samain cara ceknya, warga yang lagi auto-login nggak perlu login ulang.

### 4g. Paling ribet — `registrations` (gabungan 10 sheet workshop, 6 struktur beda)
10 sheet batch yang ada sekarang: `3d-frame-25-april-2026`, `3d-frame-journaling-vol-2-8-agustus-2026`, `paper-journal-28-mar-2026`, `paper-journal-29-mar-2026`, `upcycle-journal-17-mei-2026`, `bookmark-27-mei-2026`, `reka-rekat-20-jun-2026`, `reka-rekat-vol-3-17-aug-2026`, `reka-rekat-vol1`, `journaling-date-vol-5`. Semuanya masuk 1 tabel `registrations`, `workshop_type` beda-beda, sisanya (warna/jumlah foto) masuk `extra`.

> Ternyata datanya jauh lebih banyak dari perkiraan (115 baris total, bukan "dikit") — jadi diproses via script (bukan input manual), sama kayak tabel-tabel lain. `batch_id` nggak bisa ditebak manual (UUID auto-generated), jadi disambungin otomatis lewat kolom sementara `source_sheet` yang di-join ke `batches.sheet_name`.
>
> ⚠️ **Ketemu bug serius di tengah proses ini**: function pembersih mojibake (`clean()`) yang dipakai dari Fase 4e-4f ternyata NGOSONGIN teks jadi string kosong (bukan cuma buang emoji rusak), dan verifikasi sebelumnya salah (cuma cek "nggak ada mojibake tersisa", yang otomatis lolos juga kalau teksnya kosong). Akibatnya `challenges` (title/theme/description), `quest_submissions` (caption), `event_photos` (caption), `members` (nickname/bio/catatan journal) yang UDAH diimpor sempet rusak di dev & production. Sudah diperbaiki via `supabase/../fix_corrupted_text.sql` (70 UPDATE + 7 fix catatan journal) — dikonfirmasi beres di dev & production sebelum lanjut.

| Sheet (workshop_type) | Kolom asli → masuk `extra` (jsonb) |
|---|---|
| `3d-frame-journaling` (2 sheet) | `Frame Terpilih` → `{"frame": "..."}`, Foto 1-4 → `{"photos": ["url1","url2","url3","url4"]}` |
| `journaling-date` (1 sheet) | Cuma `nickname`, `wa`, Foto 1-4 → `extra.photos` — TANPA consent/payment/ig (event gratis khusus member) |
| `reka-rekat` (3 sheet) | Foto 1-4 → `extra.photos` (nggak ada kolom extra lain) |
| `paper-journal` (2 sheet) | `Inisial, Front Cover Word, Warna Cover, Warna Flap, Warna Tali, Link Foto Charm` → `{"initial","frontCoverWord","colorCover","colorFlap","colorStrap","charmUrl"}` |
| `upcycle-journal` (1 sheet) | `Inisial, Jenis Cover, Jenis Flap, Warna Tali, Link Foto Charm` → `{"initial","coverType","flapType","colorStrap","charmUrl"}` |
| `bookmark-journal` (1 sheet) | `Rantai, Pita`, Foto 1-4 → `{"rantai","pita","photos":[...]}` |

- [x] Digabung via script → `registrations_import.csv` (115 baris: 3d-frame 22, paper-journal 19, upcycle 12, bookmark 10, reka-rekat 46, journaling-date 6)
- [x] `alter table registrations add column source_sheet text;` → import CSV → `update ... set batch_id = b.id from batches b where r.source_sheet = b.sheet_name;` → cek 0 baris `batch_id is null` → `alter table registrations drop column source_sheet;`
- [x] Beres di dev & production
- **Tes:** ✅ 115 baris masuk, semua ke-link ke `batch_id` yang bener, nggak ada yang `null`.

### 4h. Foto (opsional, boleh nyusul)
- [ ] Migrasi fisik foto dari Drive ke Storage bucket **BOLEH ditunda** — link Drive lama masih jalan selama file-nya nggak dihapus/permission-nya tetep publik. Kalau mau pindahin sekarang: download dari folder Drive → upload ke bucket `event-photos`/`profile-photos`/dst → copy URL publik barunya → update kolom yang sesuai.
- **Tes:** (kalau dipindah) link foto baru kebuka di browser.

## Fase 5 — Tulis Edge Functions (logic custom)
> ⚠️ Daftar ini sempet nggak lengkap — direvisi total setelah audit ulang `Google_Script_Code.js` (`doPost`/`doGet`/`handleMember` menyeluruh, bukan dari ingatan). 3 hal yang sempet kelewat: **submit registrasi workshop** (paling penting — 6 jenis event + upload foto/bukti bayar), 2 aksi member (`memberSetMood`, `memberUpdateProfile`), dan 12 dari 15 endpoint GET publik.

Port satu-satu dari fungsi `_` yang udah ada di `Google_Script_Code.js`:

**a) Registrasi publik (PALING PENTING, paling gede)** ✅ SELESAI
- [x] `register-workshop` — 1 Edge Function nanganin ke-6 jenis (`3d-frame-journaling`, `paper-journal`, `upcycle-journal`, `bookmark-journal`, `reka-rekat`, `journaling-date`), port dari 6 blok `if/else if (data.workshopType === ...)` di `doPost`. Upload foto/bukti bayar (base64) → Storage bucket yang sesuai → `registrations.extra`/`payment_proof_url`.
- [x] `telegram-notify` — jadi shared helper (`_shared/telegram.ts`), dipanggil dari `register-workshop` (bukan function terpisah, karena nggak pernah dipanggil langsung dari client)
- [x] Deployed & tested di dev & production (member-check, quota check, validasi workshopType semua kekonfirmasi jalan)
- 💡 Ketemu 1 gap infra pas testing: tabel yang dibikin manual lewat SQL Editor (Fase 1) nggak otomatis ke-grant ke `service_role` → Edge Function gagal "permission denied". Fixed via `supabase/fix_service_role_grants.sql` (dev & production).

**b) Member auth & profil** ✅ SELESAI
- [x] `member-setup`, `member-login`, `member-session` (auth WA + password) — dites: setup, login (password bener/salah), session token
- [x] `member-set-mood` (dari `memberSetMood`)
- [x] `member-update-profile` (dari `memberUpdateProfile`)
- [x] Deployed & tested di dev, deployed ke production (smoke test read-only, nggak nyentuh akun member asli)

**c) Aksi member (butuh token)** ✅ SELESAI
- [x] `member-checkin`, `member-submit-quest`, `member-edit-quest`, `member-toggle-like`
- [x] `member-post-board`, `member-post-suggestion`, `member-vote-suggestion`
- [x] Deployed & tested di dev (semua 7 dicoba beneran termasuk toggle like/unlike), deployed ke production
- 💡 `send-push`/`telegram-notify` jadi shared helper (`_shared/push.ts`, `_shared/telegram.ts`), dipanggil dari `member-submit-quest` & `register-workshop` — bukan function terpisah, samain kayak keputusan telegram-notify di grup (a)

**d) Endpoint baca (GET) — 15 total, dari `doGet` (`page=...`)** ✅ SELESAI
- [x] `config`, `challenges` (`active=true`), `content` — TERNYATA nggak perlu Edge Function sama sekali, langsung query REST bawaan Supabase (`GET /rest/v1/app_config?key=eq.WORKSHOPS_JSON`, `GET /rest/v1/challenges?active=eq.true`, `GET /rest/v1/content_items?content_type=eq.galeri`) karena RLS publiknya udah ada dari Fase 3.
- [x] `loyalty` — Edge Function, dites pakai data member asli
- [x] `member-status`, `member-check` — Edge Function
- [x] `leaderboard`, `member-quests`, `quest-gallery` — Edge Function, dites (leaderboard nampilin ranking asli dari 43 warga)
- [x] `member-events` — Edge Function
- [x] `board` — Edge Function
- [x] `public-profile`, `showcase` — Edge Function, dites (showcase nunjukin 42 member, 44 karya cocok sama data production)
- [x] `balai-weather` — Edge Function
- [x] `suggestions` — Edge Function
- [x] 12 Edge Function + 3 direct-REST semuanya deployed & tested di dev, deployed & smoke-tested di production
- 💡 Logic berat yang dipakai bareng banyak endpoint (loyalty aggregation, quest gallery, nickname map) dijadiin 1 shared module (`_shared/queries.ts`) biar nggak duplikat kode
- ⚠️ **Ketemu 1 lagi yang kelewat pas audit Fase 7**: endpoint "cek kuota" (`doGet` tanpa `page` param sama sekali — dipanggil dari homepage + ke-6 halaman registrasi buat nampilin sisa kuota tiap workshop + warna upcycle bag yang udah abis). Jadi Edge Function baru `workshop-counts`. Udah ditulis, di-deploy, dan dites di dev & production (hasil count per-workshop + `takenBags` cocok sama data asli).

**e) Admin & lain-lain** ✅ SELESAI — 🎉 FASE 5 KELAR TOTAL
- [x] `admin-api` — 1 Edge Function, router internal 37 action (mirip `handleAdmin`): login, getRegistrations, getSummary, getLoyalty, getOverview, claimReward, saveLoyaltyNotes, listBatches, newBatch, setActiveBatch, renameBatch, getChallenges, saveChallenge, deleteChallenge, getEventPhotos, addEventPhoto, deleteEventPhoto, getLeaderboard, getActivity, getMembers, getSuggestions, deleteSuggestion, getConfig, saveConfig, getPrep, savePrep, getIdeas, saveIdeas, getContent, saveContent, getModal, saveModal, setAttendance, getLeads, addLead, updateLead, deleteLead
- [x] `send-push` (OneSignal) — udah jadi shared helper (`_shared/push.ts`) dari grup (c), dipakai bareng
- [x] Auth admin: `ADMIN_PASSWORD_HASH`/`ADMIN_SALT` jadi Edge Function secret (nilai hash SAMA kayak Apps Script lama, password admin nggak berubah), sesi disimpen di `app_config` (ganti `PropertiesService`)
- [x] Deployed & tested penuh di dev (login pakai password asli berhasil, getSummary/getChallenges/getMembers ✅), deployed ke production (secret ke-set, smoke test login rejection ✅)
- 💡 **1 action SENGAJA di-skip**: `registerBatch` (dulu buat "daftarin tab sheet existing jadi batch arsip") — nggak relevan lagi karena `registrations` sekarang 1 tabel gabungan, bukan sheet per-batch. Kalau perlu suatu saat, tinggal insert manual ke tabel `batches`.

- **Tes:** semua 25 Edge Function (register-workshop, 5 auth/profil, 7 aksi member, 12 endpoint baca, admin-api) dicoba manual lewat `curl` di dev DAN production, pakai data asli hasil migrasi Fase 4. Upload foto (`register-workshop`, `member-update-profile`, dst) pakai `uploadBase64` ke bucket yang sesuai, siap dites end-to-end pas Fase 7 (submit form beneran dari browser).

## Fase 6 — Cron Jobs
> ⚠️ Ketemu 1 cron yang kelewat pas audit ulang: `sendDailyReminder` (reminder event H-1/hari-H ke Telegram admin, jam 8 pagi) — jadi 3 job, bukan 2. Juga dikonfirmasi: fitur **snail-mail nggak butuh cron sama sekali** (murni client-side, baca `warga/snail_mail.js` + bandingin tanggal di browser).
- [x] 3 Edge Function ditulis & dites manual dulu (dev + production): `cron-daily-birthday-push`, `cron-weekly-checkin-push`, `cron-daily-reminder`
- [x] Secret `ONESIGNAL_APP_ID`/`ONESIGNAL_REST_KEY` di-set di production (sebelumnya belum ada, push OneSignal baru bener-bener aktif dari sekarang)
- [x] Dijadwalin via `pg_cron`+`pg_net` (`supabase/schedule_cron_jobs.sql`, di production): `daily-birthday-push` (09:00 WIB tiap hari), `weekly-checkin-push` (09:00 WIB tiap Minggu), `daily-event-reminder` (08:00 WIB tiap hari)
- **Tes:** ✅ trigger manual dulu (weekly-checkin beneran ngirim push ke warga yang belum check-in), baru dijadwalin — `select * from cron.job` confirm 3 job `active = true` dengan schedule yang bener.

## Fase 7 — Ganti Frontend
> ⚠️ Audit ulang total dari kode (`grep -rl "GOOGLE_SCRIPT_URL"` di semua `.js`/`.html`), bukan dari ingatan — sesuai instruksi "jangan ada yang kelewat". Ketemu 1 gap nyata (endpoint `workshop-counts`, udah dibikin & di-deploy, lihat catatan Fase 5d), 1 bug keamanan (`app_config` kebuka publik semua key, lihat catatan Fase 3, udah di-fix), dan 1 file mati yang aman diabaikan (`main.js` root — lihat catatan di bawah; `index.html` root sendiri TETAP dipindah karena ada panggilan quota-check yang masih hidup).
> ✅ **FASE 7 KELAR TOTAL** (semua file dipindah, syntax-checked) — tapi belum ada satupun yang dicoba beneran di browser sungguhan (nggak ada headless browser di environment ini). Sebelum lanjut Fase 8, tolong coba manual: 1 form registrasi, buka `warga/` (login+beberapa tab), buka `admin/` (terutama tab Peserta/Finance/Prep), `loyalty/`, `balai/`, homepage.
- [x] `SUPABASE_URL` + `SUPABASE_ANON_KEY` **udah ada** di `env.js` dari Fase 0 (bukan tugas baru, checklist lama salah/ketinggalan)

**Pendekatan yang dipakai (biar konsisten di semua file):**
- Semua panggilan `fetchJSONP(...)`/`?callback=` diganti jadi `fetch(...)` biasa — nggak perlu JSONP lagi karena Edge Function itu API REST asli yang udah dukung CORS.
- Endpoint jenis "Edge Function" (custom logic) → `${SUPABASE_URL}/functions/v1/<nama-function>`, method sesuai (GET pakai query string, POST pakai JSON body), selalu kirim header `apikey: SUPABASE_ANON_KEY`.
- Endpoint jenis "direct-REST" (`config`, `challenges`, `content`) → `${SUPABASE_URL}/rest/v1/<table>?...` langsung ke PostgREST bawaan Supabase, header `apikey` + `Authorization: Bearer SUPABASE_ANON_KEY`.
- 💀 **`main.js` (root) & bagian registrasi di `index.html` (root) — DIABAIKAN, bukan gap.** Dikonfirmasi lewat grep: nggak ada satupun halaman (termasuk `index.html` sendiri) yang nge-`<script src="main.js">` ke file ini. Ini sisa dari homepage lama (form 2-sesi "28/29 Maret") yang udah digantiin halaman registrasi terpisah per workshop, tapi filenya nggak pernah dihapus. Nggak perlu dimigrasi karena kodenya nggak pernah jalan di browser manapun.

**Checklist per file (urutan disaranin: config/content dulu, baru registrasi, baru warga, baru admin):**

- [x] `gallery-config.js`, `recommendation-config.js`, `testimony-config.js` — ganti JSONP `?page=content&type=X` → direct-REST `GET .../rest/v1/content_items?content_type=eq.X`, flatten `extra` ke top-level biar shape sama kayak versi statis. Dicek lewat curl pakai anon key: `testimoni` & `links` datanya cocok; `recommendation` emang kosong dari sononya (di-skip pas Fase 4c karena sheet aslinya juga kosong) — otomatis fallback ke data statis, sesuai desain.
- [x] `workshop-config.js` — ganti JSONP `?page=config` → direct-REST `GET .../rest/v1/app_config?key=eq.WORKSHOPS_JSON`, retry-loop nunggu `SUPABASE_URL` kebaca dipertahankan sama persis kayak versi lama. `WORKSHOPS_JSON` masih kosong di dev (belum pernah disave lewat admin panel) → otomatis fallback ke `WORKSHOPS` statis, sesuai desain juga.
- [x] `links/index.html` — 3 panggilan (bukan 2, ketemu 1 lagi pas ngerjain: `fetchJSONP(GS, "qta")` tanpa page param = quota check juga): config → direct-REST, quota → `workshop-counts`, `content&type=links` → direct-REST. Helper `fetchJSONP` diganti `supaGet`/`fnGet`.
- [x] `index.html` (root) — `fetchJSONP(GOOGLE_SCRIPT_URL, 'handleQuota')` (baris ~843, fungsi `initWorkshops`) → `GET .../functions/v1/workshop-counts`
- **Tes (file-file di atas):** `node --check` semua `.js` + extract `<script>` inline pakai `new Function()`/`node --check` — semua lolos. Endpoint asli (direct-REST & `workshop-counts`) udah dicoba manual pakai `curl` dengan anon key yang PERSIS sama kayak yang dipakai browser, hasilnya cocok sama data production asli. **Belum dicoba di browser beneran** (nggak ada headless browser di environment ini) — tolong buka `index.html` & `links/index.html` langsung buat mastiin kartu workshop & link custom muncul benar sebelum lanjut ke halaman registrasi.
- [x] 6 halaman registrasi (`3d-frame-journaling`, `paper-journal`, `upcycle-journal`, `bookmark-journal`, `reka-rekat`, `journaling-date` — masing-masing `main.js`), pola SAMA persis di ke-6nya:
  - `fetchJSONP(GOOGLE_SCRIPT_URL, 'handleQuota', ...)` (cek kuota awal, saat halaman dibuka) → `GET .../functions/v1/workshop-counts`
  - `fetchJSONP(GOOGLE_SCRIPT_URL, 'handlePreSubmit')` (cek ulang kuota sesaat sebelum submit, kecuali `upcycle-journal` yang cuma cek 1x) → `GET .../functions/v1/workshop-counts` (dipanggil lagi, endpoint sama)
  - `fetch(GOOGLE_SCRIPT_URL, {method:'POST', body: JSON.stringify(payload)})` (submit form) → `POST .../functions/v1/register-workshop`, body sama persis (field-field udah dikonfirmasi cocok pas Fase 5a)
  - Khusus `journaling-date/main.js`: ada tambahan `?page=memberCheck&wa=...` (cek status member sebelum daftar event gratis) → `GET .../functions/v1/member-check?wa=...`
- **Tes:** `node --check` semua 6 file lolos, nggak ada lagi sisa `GOOGLE_SCRIPT_URL`/`fetchJSONP` (dicek pakai grep). **Belum dicoba submit beneran di browser** — tolong coba isi & submit minimal 1 form (yang paling murah/gampang di-cancel) buat mastiin alur end-to-end (cek kuota → isi form → upload foto → submit → redirect ke success.html) beneran jalan sebelum aku lanjut ke `warga`/`admin`.
- [x] `loyalty/index.html` — `?page=loyalty&wa=...` → `GET .../functions/v1/loyalty?wa=...`
- [x] `balai/index.html` — 2 panggilan: `?page=publicProfile&id=...` → `GET .../functions/v1/public-profile?id=...`; `?page=showcase` → `GET .../functions/v1/showcase`
- [x] `warga/main.js` (paling gede, 6800+ baris) — semua action ketemu 1:1 Edge Function yang udah ada, dipindah semua lewat 1 helper `apiPost(payload)` (POST, action-based, cukup 1 lookup table `action→nama function`) + helper `fnGet`/`restGet` (GET). `page=challenges` dipindah ke direct-REST (`GET .../rest/v1/challenges?active=eq.true`), sisanya (12 action + 11 GET page) ke Edge Function masing-masing.
- [x] `admin/index.html` — helper `api(action, payload)` diganti jadi `POST .../functions/v1/admin-api`. Ketemu 1 gap tambahan yang HARUS dibenerin biar nggak salah data: backend baru pakai `batchId` (UUID) buat identifikasi batch di `getRegistrations`/`setActiveBatch`/`renameBatch`, bukan `sheetName` kayak dulu (nggak ada lagi konsep "sheet") — semua tempat yang nyimpen/ngirim `sheetName` (dropdown batch di tab Peserta & Finance, batch info, rename, set aktif) diganti pakai `b.id`. Juga: `getRegistrations` sekarang balikin `items` (array objek terstruktur), BUKAN `{headers, rows}` (baris mentah sheet) — ditulis adapter `itemsToSheetShape()` yang nyusun ulang jadi tabel (kolom `extra` per jenis workshop diberi label ramah, kolom `photos` array dipecah jadi "Foto 1/2/3/dst") biar tampilan & fitur cari/export CSV yang udah ada tetep jalan tanpa ditulis ulang total. `setAttendance` juga berubah dari `{sheetName, row}` (index baris) jadi `{registrationId}` (UUID asli) — checkbox kehadiran di tab Prep disesuaikan. Tombol "Daftarkan tab lama" (`registerBatch`, udah di-skip dari backend sejak Fase 5e) dihapus dari UI karena nggak relevan lagi.
- **Tes:** `node --check` semua `.js` + extract-`<script>` semua `.html` yang diubah — semua lolos tanpa error. Sisa `GOOGLE_SCRIPT_URL`/`fetchJSONP` di seluruh repo dicek pakai grep: cuma tinggal di `env.js`/`env.example.js` (deklarasi konstan, sengaja dipertahankan buat Fase 8) dan `main.js` root (dead code, lihat catatan di atas) — bersih dari semua file yang aktif dipakai. **Belum dicoba beneran di browser** (nggak ada headless browser di environment ini) — terutama admin panel (tab Peserta/Finance/Prep, karena shape datanya beneran berubah, bukan cuma ganti URL) butuh dicoba manual: buka tiap tab, cek batch/kehadiran/CSV export tampil & kesimpan dengan benar, sebelum dianggap kelar total.

## Fase 8 — Testing Paralel & Cutover
- [ ] Jalanin 1-2 minggu dengan DUA backend nyala bareng (Apps Script standby, Supabase yang aktif dipakai)
- [ ] Kalau lancar, matiin trigger Apps Script (birthday/weekly push) biar nggak dobel kirim
- **Tes:** dipantau beberapa hari, nggak ada komplain/bug dari warga yang make.

---

## 🔗 Dependensi antar fase
```
Fase 0 (akun) → Fase 1 (tabel) → Fase 2 (storage) → Fase 3 (security)
                                            └─ Fase 4 (migrasi data lama)
                                            └─ Fase 5 (edge functions) → Fase 6 (cron)
                                                      └─ Fase 7 (ganti frontend) → Fase 8 (cutover)
```

---

_Rekomendasi: mulai **Fase 0** sekarang (~10 menit), kabarin begitu udah nyampe langkah "catat Project URL & anon key" — abis itu kita lanjut Fase 1 bikinin file `.sql`-nya._
