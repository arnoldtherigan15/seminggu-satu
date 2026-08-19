-- ============================================================
-- Budget per kategori, per bulan -- "Makan & Minum max Rp2jt bulan ini"
-- dst. 1 baris = budget 1 kategori buat 1 bulan tertentu (period
-- 'YYYY-MM'), unique biar ga dobel per kategori+bulan.
-- ============================================================
create table personal_budgets (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references personal_categories(id),
  period      text not null,                      -- 'YYYY-MM'
  amount      bigint not null check (amount > 0),  -- rupiah, integer
  created_at  timestamptz not null default now(),
  unique (category_id, period)
);

alter table personal_budgets enable row level security;
-- Sama pola kayak tabel personal_* lainnya -- cuma lewat service_role di
-- edge function personal-api. GRANT eksplisit di sini juga (lihat
-- fix_service_role_grants.sql / fix_personal_finance_grants.sql -- default
-- privileges nggak otomatis nempel ke tabel baru kalau dibikin lewat
-- sesi/role yang beda dari yang nge-set default privileges-nya).
grant all privileges on personal_budgets to service_role;
