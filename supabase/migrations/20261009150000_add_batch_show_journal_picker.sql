-- Per-batch toggle (BUKAN per-tipe/Config) buat private-uc -- Arnold mau bisa
-- matiin pilihan Tipe/Warna Journal & Warna Tali di SATU batch tertentu aja
-- (mis. batch yang journal-nya udah fix/dipaketin, nggak perlu peserta
-- milih lagi), tanpa ngaruh ke batch lain tipe yang sama. Default true
-- (tampil) biar batch lama/batch baru yang belum di-set eksplisit tetep
-- nampilin picker-nya kayak sekarang -- consistent sama pola hide_from_picker.
alter table batches add column show_journal_picker boolean not null default true;
