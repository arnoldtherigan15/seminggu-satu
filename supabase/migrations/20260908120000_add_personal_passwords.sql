-- ============================================================
-- Personal Password Manager -- daftar password Arnold (bukan bisnis
-- Seminggu Satu), numpang di section "Personal" yang sama kayak
-- Financial Tracker & Notes. Password DISIMPAN TERENKRIPSI
-- (password_encrypted, lihat _shared/vault-crypto.ts) -- bukan
-- plaintext -- didekripsi cuma pas ditampilin ke admin lewat
-- personal-api (requireAdminAuth).
-- ============================================================

create table personal_passwords (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  username            text,
  password_encrypted  text not null,
  url                 text,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index personal_passwords_title_idx on personal_passwords (title);

alter table personal_passwords enable row level security;
-- Sengaja NGGAK ada policy publik -- cuma diakses lewat service role di
-- personal-api (requireAdminAuth), sama pola kayak semua tabel personal_* lain.

-- GRANT eksplisit -- tabel baru di project ini nggak reliably kewarisin
-- default-privileges grant (lihat fix_service_role_grants.sql).
grant all privileges on personal_passwords to service_role;
