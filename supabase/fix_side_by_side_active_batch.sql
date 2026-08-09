-- ============================================================
-- URGENT FIX: counter "Sisa Tiket" & early bird Side by Side selalu
-- nunjukkin angka penuh (15 & 3) walau udah ada pendaftar -- karena
-- workshop-counts CUMA ngitung dari batch yang `active = true`, dan
-- "side-by-side" belum pernah punya batch aktif sama sekali (beda dari
-- WORKSHOPS_JSON config yang udah diisi via admin panel -- itu cuma
-- data tampilan, bukan batch pendaftaran).
--
-- Akibatnya 2 pendaftaran yang udah masuk kesimpen dengan batch_id
-- NULL -- makanya tetep keliatan di tabel Pendaftar (nggak difilter
-- per-batch), tapi nggak pernah ke-hitung sama workshop-counts.
--
-- Jalanin di PRODUCTION SEKARANG (ini yang kena masalahnya). Aman
-- dijalanin ulang (idempotent).
-- ============================================================

-- 1) Bikin batch aktif buat side-by-side (kalau belum ada sama sekali)
insert into batches (workshop_type, label, event_date, active)
select 'side-by-side', 'Batch 1', '2026-09-05', true
where not exists (select 1 from batches where workshop_type = 'side-by-side');

-- 2) Tarik pendaftaran yang udah masuk (batch_id NULL) ke batch aktif ini
update registrations
set batch_id = (select id from batches where workshop_type = 'side-by-side' and active = true limit 1)
where workshop_type = 'side-by-side' and batch_id is null;

-- Cek hasilnya
select id, active, label, event_date from batches where workshop_type = 'side-by-side';
select id, full_name, batch_id from registrations where workshop_type = 'side-by-side';
