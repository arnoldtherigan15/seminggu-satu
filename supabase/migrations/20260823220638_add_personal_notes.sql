-- ============================================================
-- Personal Notes -- catatan bebas Arnold (bukan bisnis Seminggu
-- Satu), numpang di section "Personal" yang sama kayak Financial
-- Tracker. Banyak notes, masing-masing title + body (rich text HTML,
-- format sama kayak Prep > Full Notes / .rn-editor).
-- ============================================================

create table personal_notes (
  id         uuid primary key default gen_random_uuid(),
  title      text not null default '',
  body_html  text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index personal_notes_updated_idx on personal_notes (updated_at desc);

alter table personal_notes enable row level security;
-- Sengaja NGGAK ada policy publik -- cuma diakses lewat service role di
-- personal-api (requireAdminAuth), sama pola kayak semua tabel personal_* lain.

-- GRANT eksplisit -- tabel baru di project ini nggak reliably kewarisin
-- default-privileges grant (lihat fix_service_role_grants.sql).
grant all privileges on personal_notes to service_role;
