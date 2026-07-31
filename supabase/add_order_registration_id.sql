-- ============================================================
-- Nyambungin event_orders ke registrations (opsional) -- biar link
-- pesanan bisa di-personalisasi per peserta terdaftar (admin generate
-- link+pesan WA per orang dari daftar Registrations, peserta tinggal
-- pilih menu tanpa perlu ketik nama sendiri) DAN admin bisa liat siapa
-- yang belum pesan tanpa nebak-nebak dari nama.
--
-- Nullable -- pesanan manual/tanpa link personalisasi tetep boleh nggak
-- punya registration_id.
--
-- Jalanin di dev DULU baru production, SQL Editor sama kayak biasa.
-- ============================================================

alter table event_orders add column if not exists registration_id uuid references registrations(id) on delete set null;
