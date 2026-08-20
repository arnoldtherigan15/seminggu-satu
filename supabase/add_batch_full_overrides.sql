-- ============================================================
-- Lanjutan dari add_batch_event_overrides.sql -- batch sekarang jadi
-- pemilik data PENUH (harga, kuota, tanggal buka/tutup, early bird),
-- bukan cuma lokasi/jam/maps/WA. Kosong = ikut Config workshop kayak
-- biasa (pola override>fallback yang sama, cuma diperluas). Ini yang
-- bikin tiap batch (Vol 1, Vol 2, dst) bisa punya harga/kuota/jadwal
-- sendiri-sendiri, dan yang bikin 2+ batch bisa buka bareng dengan
-- data masing-masing yang bener (bukan ketuker kayak sebelumnya).
-- ============================================================
alter table batches
  add column if not exists normal_price numeric,
  add column if not exists early_bird_price numeric,
  add column if not exists early_bird_due_date date,
  add column if not exists early_bird_max_count integer,
  add column if not exists max_quota integer,
  add column if not exists open_date date,
  add column if not exists close_date date,
  add column if not exists workshop_date text;
