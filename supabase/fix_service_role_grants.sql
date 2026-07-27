-- ============================================================
-- Fix: tabel yang dibikin manual lewat SQL Editor (Fase 1) ternyata
-- nggak otomatis dapet akses buat service_role (dipakai semua Edge
-- Function di Fase 5). Tanpa ini, insert/select dari Edge Function
-- bakal gagal "permission denied for table ...".
--
-- Jalanin di dev (kalau belum) dan di production.
-- ============================================================
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

-- Biar tabel baru di masa depan (kalau ada) otomatis ke-grant juga,
-- nggak perlu diinget-inget manual tiap bikin tabel baru.
alter default privileges in schema public grant all privileges on tables to service_role;
alter default privileges in schema public grant all privileges on sequences to service_role;
