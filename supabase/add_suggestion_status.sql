-- ============================================================
-- Fitur baru: admin bisa "Approve" usulan di Kotak Pos Warga (bukan cuma
-- Tolak/hapus). Usulan yang disetujui dapet badge "✅ Disetujui" di halaman
-- warga, TAPI tetep auto-kehapus 7 hari SETELAH disetujui (bukan dari
-- created_at) -- ngasih jeda biar badge-nya sempat keliatan sebelum
-- dibersihin, konsisten sama semangat "Mading yang selalu fresh".
--
-- Usulan yang belum di-approve TIDAK auto-expire (tetap nunggu admin
-- approve/tolak manual, sama kayak sebelumnya).
--
-- Jalanin di dev DULU baru production, SQL Editor sama kayak biasa.
-- ============================================================

alter table suggestions add column if not exists status text not null default 'open';
alter table suggestions add column if not exists approved_at timestamptz;
