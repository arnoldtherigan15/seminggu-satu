-- ============================================================
-- Deskripsi/tema bisa beda tiap BATCH (mis. Reka Rekat ganti tema tiap
-- volume), bukan cuma 1 teks tetap di level Config kayak sebelumnya --
-- kalau kosong, tetap ikut deskripsi Config (sama pola field override
-- lain: location/price/venue/dst).
-- ============================================================
alter table batches add column description text;
