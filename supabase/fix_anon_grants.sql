-- ============================================================
-- Fix untuk Fase 7: 2 masalah ketemu pas nyiapin direct-REST reads
-- buat frontend publik (config/challenges/content_items/dst).
--
-- 1) BUG KEAMANAN (PENTING, jalanin SQL ini SEBELUM lanjut Fase 7):
--    Policy "app_config_public_read" ditulis `using (true)` -- itu artinya
--    SEMUA baris di app_config kebuka ke publik, termasuk baris
--    ADMIN_SESSION_TOKEN & ADMIN_SESSION_EXPIRY (token login admin yang
--    aktif disimpen di tabel yang sama). Siapapun yang punya anon key
--    (yang emang publik, ada di env.js) bisa baca token sesi admin yang
--    lagi aktif & pura-pura jadi admin TANPA tau password sama sekali.
--    Fix: batasin policy-nya cuma buat key "WORKSHOPS_JSON" (satu-satunya
--    yang emang perlu dibaca publik langsung).
--
-- 2) GAP INFRA (mirip yang ketemu di Fase 5a buat service_role): role
--    "anon" ternyata belum pernah di-GRANT SELECT ke tabel manapun --
--    RLS policy-nya udah bener dari Fase 3, tapi tanpa GRANT dasar ini
--    PostgREST selalu balikin "permission denied" duluan sebelum policy
--    sempet dicek. Dikonfirmasi lewat curl langsung: batches, challenges,
--    content_items, event_photos, app_config semua masih 42501.
--
-- Jalanin di SQL Editor, dev DULU baru production (sama kayak biasa).
-- ============================================================

-- 1) Perbaikan policy app_config: cuma key WORKSHOPS_JSON yang publik
drop policy if exists "app_config_public_read" on app_config;
create policy "app_config_public_read" on app_config
  for select to anon using (key = 'WORKSHOPS_JSON');

-- 2) Grant SELECT ke anon buat 5 tabel yang emang didesain publik
grant usage on schema public to anon;
grant select on batches, challenges, content_items, event_photos, app_config to anon;

-- Cek: query ini HARUS balikin baris WORKSHOPS_JSON aja (bukan error,
-- bukan semua key)
select key from app_config;
