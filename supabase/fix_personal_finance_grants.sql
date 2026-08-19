-- ============================================================
-- Sama kasusnya kayak fix_service_role_grants.sql: tabel personal_*
-- (personal_finance_schema.sql) nggak otomatis dapet akses service_role,
-- jadi Edge Function personal-api gagal "permission denied for table
-- personal_accounts" pas insert/select.
--
-- Jalanin di dev dan production.
-- ============================================================
grant all privileges on personal_accounts, personal_categories, personal_transactions to service_role;
