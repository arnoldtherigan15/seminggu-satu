-- ============================================================
-- Nambahin kolom "source" ke personal_transactions -- biar transaksi
-- yang masuk lewat Impor AI (screenshot) bisa dibedain dari yang
-- diketik manual, ditampilin sebagai badge di UI.
-- ============================================================
alter table personal_transactions add column source text not null default 'manual';
