-- ============================================================
-- Prep (FAQ & header) selama ini nunjukin lokasi/jam/link WA dari
-- Config workshop (SATU nilai global per tipe workshop), padahal
-- batch lama (mis. Vol 3) venue-nya beda dari batch yang lagi aktif
-- sekarang (Vol 4) -- alhasil pas milih batch lama, datanya ketuker
-- ikut batch aktif. Kolom ini opsional per batch (null = ikut Config
-- kayak sebelumnya), diisi Arnold cuma buat batch yang detailnya
-- beda dari Config saat ini.
-- ============================================================
alter table batches
  add column if not exists location_name text,
  add column if not exists maps_link text,
  add column if not exists workshop_time text,
  add column if not exists whatsapp_group_link text;
