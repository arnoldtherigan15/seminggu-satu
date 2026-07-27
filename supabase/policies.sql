-- ============================================================
-- Seminggu Satu — Row Level Security Policies (Fase 3)
-- Jalanin SETELAH schema.sql (tabel harus udah ada).
-- Sama kayak Fase 1: coba di "seminggu-satu-dev" dulu, baru production.
--
-- KENAPA KEBANYAKAN TABEL "DIKUNCI TOTAL" DARI ANON KEY?
-- Aplikasi ini login-nya custom (nomor WA + password), BUKAN Supabase
-- Auth. RLS nggak bisa ngecek "siapa yang login" kayak biasanya
-- (auth.uid()). Jadi polanya disamain kayak sistem yang jalan sekarang
-- di Apps Script: SEMUA aksi warga (checkin, submit quest, like, dst)
-- verifikasi token dulu di Edge Function (Fase 5), baru boleh baca/
-- tulis data pakai service_role key (yang emang bebas dari RLS).
-- Browser (anon/publishable key) cuma dikasih akses ke data yang
-- MEMANG publik, atau insert form pendaftaran (persis kayak form
-- sekarang, nggak butuh login).
-- ============================================================

-- ------------------------------------------------------------
-- BATCHES — publik, dipakai buat tau batch mana yang lagi buka
-- ------------------------------------------------------------
create policy "batches_public_read" on batches
  for select to anon using (true);

-- ------------------------------------------------------------
-- REGISTRATIONS — publik boleh DAFTAR (insert), tapi nggak boleh baca
-- data pendaftar lain (nama, WA, bukti bayar itu privat)
-- ------------------------------------------------------------
create policy "registrations_public_insert" on registrations
  for insert to anon with check (true);

-- ------------------------------------------------------------
-- CHALLENGES — publik boleh liat challenge yang lagi aktif aja
-- ------------------------------------------------------------
create policy "challenges_public_read_active" on challenges
  for select to anon using (active = true);

-- ------------------------------------------------------------
-- EVENT_PHOTOS — galeri publik (dipajang di /balai & halaman galeri)
-- ------------------------------------------------------------
create policy "event_photos_public_read" on event_photos
  for select to anon using (true);

-- ------------------------------------------------------------
-- APP_CONFIG — baca publik TAPI CUMA key WORKSHOPS_JSON (dipakai config
-- workshop di homepage). JANGAN pernah `using (true)` di sini -- tabel
-- ini juga nyimpen ADMIN_SESSION_TOKEN/ADMIN_SESSION_EXPIRY (sesi admin
-- yang lagi aktif), jadi kalau semua key kebuka publik = siapapun bisa
-- nyolong sesi admin tanpa password. Tulis tetap admin-only lewat Edge
-- Function (service_role).
-- ------------------------------------------------------------
create policy "app_config_public_read" on app_config
  for select to anon using (key = 'WORKSHOPS_JSON');

-- Ketemu pas Fase 7: RLS policy doang nggak cukup, role "anon" juga
-- butuh GRANT dasar di level Postgres (mirip gap service_role di Fase 5a).
-- Lihat fix_anon_grants.sql.
grant usage on schema public to anon;
grant select on batches, challenges, content_items, event_photos, app_config to anon;

-- ------------------------------------------------------------
-- CONTENT_ITEMS — galeri/testimoni/rekomendasi/links, semuanya konten
-- yang emang ditampilin di halaman publik
-- ------------------------------------------------------------
create policy "content_items_public_read" on content_items
  for select to anon using (true);

-- ------------------------------------------------------------
-- Sisanya (members, quest_submissions, quest_likes, board_messages,
-- suggestions, suggestion_votes, leads, workshop_costs) SENGAJA nggak
-- dikasih policy sama sekali -> otomatis ketutup total dari anon key.
-- Semua akses ke tabel-tabel ini lewat Edge Function pakai service_role
-- (Fase 5). `workshop_costs` khususnya data finansial -- jangan pernah
-- dikasih akses publik.
-- ------------------------------------------------------------
