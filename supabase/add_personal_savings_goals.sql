-- ============================================================
-- Target tabungan (savings goals) -- "Nabung buat laptop baru, target
-- Rp15jt". Progress-nya DIHITUNG dari log setoran (contributions), bukan
-- angka tunggal yang diedit langsung -- sama pola kayak saldo akun
-- (personal_finance_schema.sql), biar ada riwayat "kapan nabung berapa"
-- yang lebih konkret & memotivasi drpd cuma satu angka opak.
-- ============================================================
create table personal_savings_goals (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  target_amount bigint not null check (target_amount > 0),
  icon          text,
  archived      boolean not null default false,
  created_at    timestamptz not null default now()
);

create table personal_savings_contributions (
  id         uuid primary key default gen_random_uuid(),
  goal_id    uuid not null references personal_savings_goals(id) on delete cascade,
  amount     bigint not null,  -- boleh negatif (ambil dari tabungan)
  date       date not null default current_date,
  note       text,
  created_at timestamptz not null default now()
);
create index personal_savings_contributions_goal_idx on personal_savings_contributions (goal_id);

alter table personal_savings_goals enable row level security;
alter table personal_savings_contributions enable row level security;
-- Sama pola kayak tabel personal_* lainnya -- GRANT eksplisit biar ga
-- kena bug "permission denied for table" (lihat fix_service_role_grants.sql).
grant all privileges on personal_savings_goals, personal_savings_contributions to service_role;
