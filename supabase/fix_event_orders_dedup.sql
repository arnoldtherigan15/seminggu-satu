-- ============================================================
-- Bug: peserta yang GANTI pesanan lewat link personal (?rid=...) nggak
-- nge-replace pesanan lama, malah bikin baris baru -- soalnya submit-order
-- selalu INSERT, nggak pernah ngecek "orang ini udah pernah pesen belum
-- buat batch ini". Efeknya: data di admin keliatan "kayak nggak berubah"
-- padahal sebenernya ada 2 baris, yang lama nongol duluan (ORDER BY
-- created_at ascending).
--
-- Ini SENGAJA cuma buat link PERSONAL (registration_id ada isinya) --
-- link generik/grup (registration_id kosong, buat pesenin banyak orang
-- pake 1 link) tetep boleh insert baru tiap submit, itu emang desainnya.
--
-- Jalanin di dev DULU baru production, SQL Editor sama kayak biasa.
-- ============================================================

-- 1) Bersihin duplikat yang KETERLANJUR ada: buat tiap (batch_id,
--    registration_id) yang punya >1 baris, simpen yang PALING BARU
--    (created_at terbesar -- itu pilihan terakhir orangnya), hapus sisanya.
delete from event_orders a
using event_orders b
where a.registration_id is not null
  and a.registration_id = b.registration_id
  and a.batch_id = b.batch_id
  and a.created_at < b.created_at;

-- 2) Cegah duplikat ke depannya di level DB (jaga-jaga kalau ada jalur lain
--    yang lupa dicek) -- partial index, cuma berlaku buat baris yang punya
--    registration_id (link personal), bukan link generik.
create unique index if not exists event_orders_batch_reg_uniq
  on event_orders (batch_id, registration_id)
  where registration_id is not null;
