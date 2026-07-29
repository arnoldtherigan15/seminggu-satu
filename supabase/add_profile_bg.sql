-- ============================================================
-- Fitur baru: cover/sampul profil warga (pilih dari pattern-pattern
-- scrapbook bawaan ATAU upload pattern sendiri, maks 1) yang dipajang
-- di halaman "Profil Kamu" (warga) dan di profil publik (/balai/?w=<id>).
--
-- profile_bg: "" = belum milih (default). "pattern-1".."pattern-19" =
--   salah satu pattern bawaan (lihat warga/assets/pattern-*.webp).
--   "custom" = pakai pattern upload sendiri (URL-nya di
--   profile_bg_custom). Divalidasi juga di member-update-profile,
--   bukan cuma di frontend.
-- profile_bg_custom: URL hasil upload sendiri warga (Supabase Storage,
--   bucket profile-photos). Cuma 1 slot -- upload baru nimpa yang lama.
--
-- Jalanin di dev DULU baru production, SQL Editor sama kayak biasa.
-- ============================================================

alter table members add column if not exists profile_bg text not null default '';
alter table members add column if not exists profile_bg_custom text not null default '';
