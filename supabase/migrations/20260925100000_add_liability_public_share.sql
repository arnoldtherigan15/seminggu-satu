-- ============================================================
-- Hutang (Liabilities) -- 2 tambahan:
-- 1. Bukti bayar per cicilan (foto, sama pola kayak payment-proofs
--    registrasi workshop -- private bucket, path doang yang kesimpen).
-- 2. Link publik read-only per hutang (token acak) -- biar orang yang
--    Arnold utangin bisa liat progress cicilannya sendiri tanpa perlu
--    login, tanpa bisa liat data finance Arnold yang lain.
-- ============================================================

alter table personal_liability_payments add column payment_proof_url text;

alter table personal_liabilities add column public_token text unique default gen_random_uuid()::text;
-- Backfill hutang yang udah ada sebelum kolom ini -- DEFAULT cuma kepake
-- buat baris baru, yang lama tetep NULL kalau nggak di-backfill manual.
update personal_liabilities set public_token = gen_random_uuid()::text where public_token is null;
